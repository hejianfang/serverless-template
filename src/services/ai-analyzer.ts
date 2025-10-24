// AI 分析服务 - 基于固定人设生成模拟用户行为数据
import { callChatAPI, type Message } from '../libs/chat-api';
import type { UserEntity } from '../schemas/user';
import type { SessionEntity } from '../schemas/session';
import { logger } from '../libs/logger';
import pLimit from 'p-limit';
import { getPersonas, type Persona } from '../config/personas';
import { getActiveModelPoolIds } from '../libs/modelkey-api';

async function selectModelForAnalysis() {
  const activePoolIds = await getActiveModelPoolIds();

  if (activePoolIds.length === 0) {
    throw new Error('没有可用的活跃模型池');
  }

  // 使用第一个活跃的 pool
  return activePoolIds[0];
}
// AI 分析结果
export interface AnalysisResult {
  users: Omit<UserEntity, 'PK' | 'SK' | 'GSI1PK' | 'GSI1SK' | 'entityType' | 'sessionId'>[];
  metrics: SessionEntity['metrics'];
  journeySteps: SessionEntity['journeySteps'];
  summary: SessionEntity['summary'];
}

// 单个用户行为数据
type UserBehavior = Omit<
  UserEntity,
  'PK' | 'SK' | 'GSI1PK' | 'GSI1SK' | 'entityType' | 'sessionId'
> & {
  useFallback: boolean; // 是否使用默认行为
  error?: string; // 错误信息
};

/**
 * 从 objectKey 中检测图片格式
 * @param objectKey S3 对象键
 * @returns 图片格式 (jpeg, png, webp, gif)
 */
function detectImageFormat(objectKey?: string): string {
  if (!objectKey) {
    return 'jpeg'; // 默认格式
  }

  const extension = objectKey.split('.').pop()?.toLowerCase() || '';

  const formatMap: Record<string, string> = {
    jpg: 'jpeg',
    jpeg: 'jpeg',
    png: 'png',
    webp: 'webp',
    gif: 'gif',
  };

  return formatMap[extension] || 'jpeg';
}

/**
 * 从数组中随机选取指定数量的元素（Fisher-Yates 洗牌算法）
 */
function selectRandomPersonas<T>(array: T[], count: number): T[] {
  if (count >= array.length) {
    return array; // 如果请求数量 >= 总数，返回全部
  }

  // Fisher-Yates 洗牌算法
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, count);
}

/**
 * 分析内容并生成模拟用户数据 (基于固定人设)
 * @param contentUrl S3 图片 URL
 * @param contentTitle 内容标题
 * @param objectKey S3 对象键（用于检测图片格式）
 * @param personaCount 分析的人设数量 (5, 10, 15, 20, 30)，默认 30
 * @returns 分析结果
 */
export async function analyzeContent(
  contentUrl: string,
  contentTitle?: string,
  objectKey?: string,
  personaCount: number = 30
): Promise<AnalysisResult> {
  logger.info('开始 AI 分析', { contentUrl, contentTitle, objectKey, personaCount });

  // 获取所有人设
  const allPersonas = getPersonas(); // 30 个

  // 根据 personaCount 选择人设
  const personas =
    personaCount === 30
      ? allPersonas // 使用全部，不随机
      : selectRandomPersonas(allPersonas, personaCount); // 随机选取

  logger.info(`实际分析人设数量: ${personas.length}`, {
    requested: personaCount,
    isRandom: personaCount < 30,
    selectedIds: personas.map((p) => p.userId),
  });

  // 并发限制 (同时最多 5 个请求)
  const limit = pLimit(10);

  try {
    // 为每个人设单独调用 AI 分析
    const userBehaviors = await Promise.all(
      personas.map((persona) =>
        limit(() => analyzePersonaBehavior(contentUrl, contentTitle, persona, objectKey))
      )
    );

    logger.info('所有人设分析完成', { userCount: userBehaviors.length });

    // 聚合结果
    const result = aggregateResults(userBehaviors);

    logger.info('聚合分析完成', {
      metrics: result.metrics,
      summary: result.summary,
    });

    return result;
  } catch (error) {
    logger.error('AI 分析失败', { error, contentUrl });
    throw error;
  }
}

/**
 * 分析单个人设的行为
 */
async function analyzePersonaBehavior(
  contentUrl: string,
  _contentTitle: string | undefined,
  persona: Persona,
  objectKey?: string
): Promise<UserBehavior> {
  logger.debug('分析人设行为', { userId: persona.userId, name: persona.name });

  // 检测图片格式
  const imageFormat = detectImageFormat(objectKey);

  // 使用 persona 的 systemPrompt 作为 system message
  // 不再需要构建 prompt,因为 systemPrompt 已经包含了所有必要的说明
  const messages: Message[] = [
    {
      role: 'system',
      content: persona.systemPrompt,
    },
    {
      role: 'user',
      content: [
        {
          type: 'image',
          image: { format: imageFormat, source_url: contentUrl },
        },
      ],
    },
  ];
  // modelKey 需要动态生成
  const modelKey = await selectModelForAnalysis();
  logger.debug('modelKey', { modelKey });
  try {
    const response = await callChatAPI({
      modelKey,
      messages,
      instanceId: persona.id,
    });

    if (!response.success || !response.response?.content) {
      throw new Error('AI 分析失败: ' + (response.error?.message || 'Unknown error'));
    }

    // 解析 AI 返回的单个用户行为（使用正确的访问路径）
    const userBehavior = parsePersonaBehavior(response.response.content, persona);

    logger.debug('人设分析完成', { userId: persona.userId, status: userBehavior.status });

    return userBehavior;
  } catch (error) {
    logger.error('人设分析失败', { error, userId: persona.userId });
    // 返回默认行为(低兴趣,未打开)，并记录错误信息
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return generateDefaultPersonaBehavior(persona, errorMessage);
  }
}

/**
 * 解析单个人设的 AI 响应
 */
function parsePersonaBehavior(response: string, persona: Persona): UserBehavior {
  try {
    // 提取 JSON 内容(可能包含在 ```json ... ``` 代码块中)
    let jsonContent = response;

    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1];
    }

    // 解析 JSON
    const parsed = JSON.parse(jsonContent);

    // 构建完整的用户行为数据
    const userBehavior: UserBehavior = {
      userId: persona.userId,
      name: persona.name,
      opened: parsed.opened || false,
      liked: parsed.liked || false,
      commented: parsed.commented || false,
      purchased: parsed.purchased || false,
      browseTime: parsed.browseTime || 0,
      interest: parsed.interest || 0,
      priceRange: persona.priceRange,
      status: parsed.status || 'viewed',
      innerMonologue: parsed.innerMonologue || '对这个内容不感兴趣。',
      timeline: parsed.timeline || [
        { time: '0s', action: '看到内容封面', active: true },
        { time: '2s', action: '滑过', active: false },
      ],
      insights: parsed.insights || '该用户对内容无明显兴趣。',
      useFallback: false, // AI 分析成功
      createdAt: new Date().toISOString(),
    };

    return userBehavior;
  } catch (error) {
    logger.error('解析人设行为失败', { error, response, userId: persona.userId });
    // 返回默认行为，并记录解析错误
    const errorMessage = error instanceof Error ? error.message : 'JSON parse error';
    return generateDefaultPersonaBehavior(persona, `解析失败: ${errorMessage}`);
  }
}

/**
 * 聚合所有用户行为结果
 */
function aggregateResults(userBehaviors: UserBehavior[]): AnalysisResult {
  const totalUsers = userBehaviors.length;

  // 统计各项指标
  const openCount = userBehaviors.filter((u) => u.opened).length;
  const likeCount = userBehaviors.filter((u) => u.liked).length;
  const commentCount = userBehaviors.filter((u) => u.commented).length;
  const purchaseCount = userBehaviors.filter((u) => u.purchased).length;

  // 计算平均浏览时长
  const totalBrowseTime = userBehaviors.reduce((sum, u) => sum + u.browseTime, 0);
  const avgBrowseTime = Math.floor(totalBrowseTime / totalUsers);

  // 计算平均兴趣度
  const totalInterest = userBehaviors.reduce((sum, u) => sum + u.interest, 0);
  const avgInterest = Math.floor(totalInterest / totalUsers);

  // 构建指标
  const metrics = {
    interest: avgInterest,
    open: Math.floor((openCount / totalUsers) * 100),
    like: Math.floor((likeCount / totalUsers) * 100),
    comment: Math.floor((commentCount / totalUsers) * 100),
    purchase: Math.floor((purchaseCount / totalUsers) * 100),
  };

  // 构建转化漏斗
  const journeySteps = [
    { label: '浏览', value: '100%', count: totalUsers },
    { label: '打开', value: `${Math.floor((openCount / totalUsers) * 100)}%`, count: openCount },
    { label: '点赞', value: `${Math.floor((likeCount / totalUsers) * 100)}%`, count: likeCount },
    {
      label: '评论',
      value: `${Math.floor((commentCount / totalUsers) * 100)}%`,
      count: commentCount,
    },
    {
      label: '购买',
      value: `${Math.floor((purchaseCount / totalUsers) * 100)}%`,
      count: purchaseCount,
    },
  ];

  // 统计成功/失败数量
  const successCount = userBehaviors.filter((u) => !u.useFallback).length;
  const failedCount = userBehaviors.filter((u) => u.useFallback).length;

  // 构建摘要
  const summary = {
    totalViews: totalUsers,
    openCount,
    likeCount,
    commentCount,
    purchaseCount,
    avgBrowseTime,
    successCount,
    failedCount,
  };

  return {
    users: userBehaviors,
    metrics,
    journeySteps,
    summary,
  };
}

/**
 * 生成单个人设的默认行为 (AI 失败时的后备方案)
 * 使用随机值生成保守的默认行为
 */
function generateDefaultPersonaBehavior(persona: Persona, error?: string): UserBehavior {
  // 生成保守的随机默认行为
  // 由于 AI 分析失败,无法基于详细人设判断,因此使用随机值
  const opened = Math.random() > 0.5;
  const liked = opened && Math.random() > 0.7;
  const commented = liked && Math.random() > 0.85;
  const purchased = commented && Math.random() > 0.9;

  let status: 'viewed' | 'opened' | 'liked' | 'commented' | 'purchased' = 'viewed';
  if (purchased) status = 'purchased';
  else if (commented) status = 'commented';
  else if (liked) status = 'liked';
  else if (opened) status = 'opened';

  return {
    userId: persona.userId,
    name: persona.name,
    opened,
    liked,
    commented,
    purchased,
    browseTime: opened ? Math.floor(Math.random() * 200 + 30) : Math.floor(Math.random() * 10),
    interest: opened ? Math.floor(Math.random() * 40 + 40) : Math.floor(Math.random() * 40),
    priceRange: persona.priceRange,
    status,
    innerMonologue: opened ? '看起来还不错,值得了解一下。' : '对这个内容不太感兴趣。',
    timeline: [
      { time: '0s', action: '看到内容封面', active: true },
      { time: '2s', action: opened ? '点击查看详情' : '滑过', active: opened },
      ...(opened ? [{ time: '30s', action: '浏览内容', active: true }] : []),
    ],
    insights: `${persona.name}对内容${opened ? '有一定兴趣' : '兴趣度较低'}。(AI 分析失败,使用默认值)`,
    useFallback: true, // 使用默认行为
    error, // 记录错误信息
    createdAt: new Date().toISOString(),
  };
}
