// POST /sessions/analyze - 创建分析会话
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { createHandler } from '../../libs/middleware';
import { successResponse, apiError } from '../../libs/api-gateway';
import { checkObjectExists, buildS3Url } from '../../libs/s3';
import { putItem, batchPutItems } from '../../libs/dynamodb';
import { analyzeContent } from '../../services/ai-analyzer';
import type { SessionEntity } from '../../schemas/session';
import type { UserEntity } from '../../schemas/user';
import { logger } from '../../libs/logger';

/**
 * 创建分析会话请求体
 */
interface AnalyzeRequest {
  sessionId: string; // 会话 ID (从 /upload-url 获取)
  objectKey: string; // S3 对象键 (从 /upload-url 获取)
  contentTitle?: string; // 可选标题
}

const analyzeHandler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    // 解析请求体（httpJsonBodyParser 中间件已自动解析）
    const body: AnalyzeRequest = (event.body as unknown as AnalyzeRequest) || {};

    if (!body.sessionId) {
      return apiError.badRequest('缺少 sessionId');
    }

    if (!body.objectKey) {
      return apiError.badRequest('缺少 objectKey');
    }

    const { sessionId, objectKey } = body;
    const timestamp = new Date().toISOString();

    logger.info('开始创建分析会话', { sessionId, objectKey });

    // 1. 验证文件已上传
    const exists = await checkObjectExists(objectKey);
    if (!exists) {
      return apiError.badRequest('文件未上传或已过期,请重新获取上传 URL');
    }

    // 生成预签名下载 URL（用于 AI 分析）
    const contentUrl = await buildS3Url(objectKey);

    logger.info('文件验证成功', { sessionId, objectKey, contentUrl });

    // 2. 创建 SESSION 实体(状态为 analyzing)
    const sessionEntity: SessionEntity = {
      PK: `SESSION#${sessionId}`,
      SK: 'METADATA',
      GSI1PK: 'SESSIONS',
      GSI1SK: `STATUS#analyzing#${timestamp}`,
      entityType: 'SESSION',
      sessionId,
      objectKey, // 存储 S3 对象键
      contentTitle: body.contentTitle,
      status: 'analyzing',
      totalUsers: 30,
      metrics: {
        interest: 0,
        open: 0,
        like: 0,
        comment: 0,
        purchase: 0,
      },
      journeySteps: [],
      summary: {
        totalViews: 0,
        openCount: 0,
        likeCount: 0,
        commentCount: 0,
        purchaseCount: 0,
        avgBrowseTime: 0,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
      ttl: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60, // 90天后过期
    };

    await putItem(sessionEntity);

    logger.info('会话实体已创建', { sessionId });

    // 3. 异步调用 AI 分析(在后台执行,不阻塞响应)
    analyzeInBackground(sessionId, objectKey, body.contentTitle).catch((error) => {
      logger.error('后台分析失败', { error, sessionId });
    });

    // 4. 返回响应
    return successResponse(
      {
        sessionId,
        status: 'analyzing',
        message: '分析已开始,请稍后查看结果',
      },
      201
    );
  } catch (error) {
    logger.error('创建分析会话失败', { error });

    if (error instanceof Error) {
      return apiError.internal('创建分析会话失败: ' + error.message);
    }

    return apiError.internal('创建分析会话失败');
  }
};

/**
 * 后台执行 AI 分析
 */
async function analyzeInBackground(
  sessionId: string,
  objectKey: string,
  contentTitle?: string
): Promise<void> {
  try {
    logger.info('开始后台 AI 分析', { sessionId, objectKey });

    // 生成预签名下载 URL（用于 AI 分析）
    const contentUrl = await buildS3Url(objectKey);

    // 调用 AI 分析服务（传入 objectKey 用于检测图片格式）
    const analysisResult = await analyzeContent(contentUrl, contentTitle, objectKey);

    // 创建 USER 实体数组
    const userEntities: UserEntity[] = analysisResult.users.map((user) => ({
      PK: `SESSION#${sessionId}`,
      SK: `USER#${user.userId}`,
      GSI1PK: `SESSION#${sessionId}`,
      GSI1SK: `STATUS#${user.status}#${user.userId}`,
      entityType: 'USER',
      sessionId,
      ...user,
    }));

    // 批量写入用户数据
    await batchPutItems(userEntities);

    logger.info('用户数据已写入', { sessionId, userCount: userEntities.length });

    // 更新 SESSION 状态为 completed
    const updatedSessionEntity: SessionEntity = {
      PK: `SESSION#${sessionId}`,
      SK: 'METADATA',
      GSI1PK: 'SESSIONS',
      GSI1SK: `STATUS#completed#${new Date().toISOString()}`,
      entityType: 'SESSION',
      sessionId,
      objectKey, // 存储 S3 对象键
      contentTitle,
      status: 'completed',
      totalUsers: 30,
      metrics: analysisResult.metrics,
      journeySteps: analysisResult.journeySteps,
      summary: analysisResult.summary,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ttl: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60,
    };

    await putItem(updatedSessionEntity);

    logger.info('会话分析完成', { sessionId });
  } catch (error) {
    logger.error('后台分析失败', { error, sessionId });

    // 更新会话状态为 failed
    const failedSessionEntity: Partial<SessionEntity> = {
      PK: `SESSION#${sessionId}`,
      SK: 'METADATA',
      status: 'failed',
      updatedAt: new Date().toISOString(),
    };

    await putItem(failedSessionEntity as SessionEntity);
  }
}

export const handler = createHandler(analyzeHandler);
