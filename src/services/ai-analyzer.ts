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
>;

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
 * 分析内容并生成模拟用户数据 (基于 30 个固定人设)
 * @param contentUrl S3 图片 URL
 * @param contentTitle 内容标题
 * @param objectKey S3 对象键（用于检测图片格式）
 * @returns 分析结果
 */
export async function analyzeContent(
  contentUrl: string,
  contentTitle?: string,
  objectKey?: string
): Promise<AnalysisResult> {
  logger.info('开始 AI 分析 (30 个人设)', { contentUrl, contentTitle, objectKey });

  // 获取 30 个固定人设
  const personas = getPersonas();

  // 并发限制 (同时最多 5 个请求)
  const limit = pLimit(5);

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
  contentTitle: string | undefined,
  persona: Persona,
  objectKey?: string
): Promise<UserBehavior> {
  logger.debug('分析人设行为', { userId: persona.userId, name: persona.name });

  // 检测图片格式
  const imageFormat = detectImageFormat(objectKey);

  // 构建针对单个人设的 prompt
  const prompt = buildPersonaPrompt(contentUrl, contentTitle, persona);

  // 调用 Chat API
  const messages: Message[] = [
    {
      role: 'system',
      content:
        '你是一个专业的用户行为分析专家,擅长模拟小红书用户对内容的反应和行为。请根据用户人设,预测该用户看到这个内容后的行为。',
    },
    {
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        {
          type: 'image',
          image: { format: imageFormat, source_url: contentUrl },
        },
      ],
    },
  ];
  // modelKey 需要动态生成
  try {
    const response = await callChatAPI({
      modelKey: await selectModelForAnalysis(),
      messages,
      // options: {
      //   // temperature: 0.8,
      //   maxTokens: 10000,
      // },
    });

    if (!response.success || !response.data) {
      throw new Error('AI 分析失败: ' + (response.error?.message || 'Unknown error'));
    }

    // 解析 AI 返回的单个用户行为
    const userBehavior = parsePersonaBehavior(response.data.response, persona);

    logger.debug('人设分析完成', { userId: persona.userId, status: userBehavior.status });

    return userBehavior;
  } catch (error) {
    logger.error('人设分析失败', { error, userId: persona.userId });
    // 返回默认行为(低兴趣,未打开)
    return generateDefaultPersonaBehavior(persona);
  }
}

/**
 * 构建针对单个人设的分析 prompt
 */
function buildPersonaPrompt(
  contentUrl: string,
  contentTitle: string | undefined,
  persona: Persona
): string {
  return `
请分析这个小红书内容,预测以下用户的行为。

## 内容信息:
- 图片 URL: ${contentUrl}
- 标题: ${contentTitle || '(无标题)'}

## 用户人设:
- 姓名: ${persona.name}
- 年龄: ${persona.age}岁
- 性别: ${persona.gender === 'male' ? '男' : '女'}
- 职业: ${persona.occupation}
- 兴趣爱好: ${persona.interests.join('、')}
- 性格特征: ${persona.personality}
- 购买力: ${persona.purchasingPower === 'low' ? '低' : persona.purchasingPower === 'medium' ? '中' : '高'}
- 价格敏感度: ${persona.priceRange}
- 生活方式: ${persona.lifestyle}
- 社交习惯: ${persona.socialBehavior}

## 任务:
根据用户人设和内容,预测该用户的行为,包括:
1. **是否打开** (opened: boolean) - 是否点击查看详情
2. **是否点赞** (liked: boolean) - 是否点赞
3. **是否评论** (commented: boolean) - 是否发表评论
4. **是否购买** (purchased: boolean) - 是否产生购买行为
5. **浏览时长** (browseTime: number) - 停留时间(0-600秒)
6. **兴趣度** (interest: number) - 对内容的兴趣程度(0-100)
7. **状态** (status) - 最终状态: "viewed"(仅浏览) | "opened"(打开) | "liked"(点赞) | "commented"(评论) | "purchased"(购买)
8. **内心独白** (innerMonologue: string) - 看到内容时的第一反应(20-40字)
9. **行为时间线** (timeline: array) - 3-7个行为步骤,每个包含 time, action, active
10. **用户洞察** (insights: string) - 行为分析总结(30-50字)

请严格按照以下 JSON 格式返回,不要包含任何其他文字:

\`\`\`json
{
  "opened": true,
  "liked": false,
  "commented": false,
  "purchased": false,
  "browseTime": 45,
  "interest": 68,
  "status": "opened",
  "innerMonologue": "这个设计风格挺符合我的审美,可以看看详情。",
  "timeline": [
    { "time": "0s", "action": "看到内容封面", "active": true },
    { "time": "2s", "action": "点击查看详情", "active": true },
    { "time": "15s", "action": "浏览图片", "active": true },
    { "time": "45s", "action": "退出内容", "active": false }
  ],
  "insights": "该用户对内容有一定兴趣,但未产生深度互动,可能价格不符合预期。"
}
\`\`\`
`;
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
      createdAt: new Date().toISOString(),
    };

    return userBehavior;
  } catch (error) {
    logger.error('解析人设行为失败', { error, response, userId: persona.userId });
    // 返回默认行为
    return generateDefaultPersonaBehavior(persona);
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

  // 构建摘要
  const summary = {
    totalViews: totalUsers,
    openCount,
    likeCount,
    commentCount,
    purchaseCount,
    avgBrowseTime,
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
 */
function generateDefaultPersonaBehavior(persona: Persona): UserBehavior {
  // 根据人设的购买力和社交习惯,生成合理的默认行为
  const isHighEngagement =
    persona.socialBehavior.includes('高频') || persona.socialBehavior.includes('活跃');
  const isLowBudget = persona.purchasingPower === 'low';

  const opened = isHighEngagement || Math.random() > 0.5;
  const liked = opened && (isHighEngagement || Math.random() > 0.6);
  const commented = liked && (isHighEngagement || Math.random() > 0.8);
  const purchased = commented && !isLowBudget && Math.random() > 0.7;

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
    insights: `${persona.name}(${persona.occupation})对内容${opened ? '有一定兴趣' : '兴趣度较低'}。`,
    createdAt: new Date().toISOString(),
  };
}
