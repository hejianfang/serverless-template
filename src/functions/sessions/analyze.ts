// POST /sessions/analyze - 创建分析会话
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { createHandler } from '../../libs/middleware';
import { successResponse, apiError } from '../../libs/api-gateway';
import { checkObjectExists } from '../../libs/s3';
import { putItem } from '../../libs/dynamodb';
import { sendAnalysisTask } from '../../libs/sqs';
import type { SessionEntity } from '../../schemas/session';
import { logger } from '../../libs/logger';

/**
 * 创建分析会话请求体
 */
interface AnalyzeRequest {
  sessionId: string; // 会话 ID (从 /upload-url 获取)
  objectKey: string; // S3 对象键 (从 /upload-url 获取)
  contentTitle?: string; // 可选标题
  personaCount?: number; // 分析的人设数量 (5, 10, 15, 20, 30)，默认 30
}

const analyzeHandler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
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
    // 验证和设置 personaCount
    const personaCount = body.personaCount || 30;
    logger.info('开始创建分析会话', { sessionId, objectKey });
    // 1. 验证文件已上传
    const exists = await checkObjectExists(objectKey);
    if (!exists) {
      return apiError.badRequest('文件未上传或已过期,请重新获取上传 URL');
    }

    logger.info('文件验证成功', { sessionId, objectKey });

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
      totalUsers: personaCount,
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
        successCount: 0,
        failedCount: 0,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
      ttl: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60, // 90天后过期
    };

    await putItem(sessionEntity);

    logger.info('会话实体已创建', { sessionId });

    // 3. 发送分析任务到 SQS 队列
    await sendAnalysisTask({
      sessionId,
      objectKey,
      contentTitle: body.contentTitle,
      personaCount,
    });

    logger.info('分析任务已发送到队列', { sessionId });

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

export const handler = createHandler(analyzeHandler);
