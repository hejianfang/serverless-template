// GET /sessions/{sessionId} - 获取会话详情
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { createHandler } from '../../libs/middleware';
import { successResponse, apiError, getPathParam } from '../../libs/api-gateway';
import { getItem } from '../../libs/dynamodb';
import type { SessionEntity } from '../../schemas/session';
import { generatePresignedDownloadUrl } from '../../libs/s3';
import { logger } from '../../libs/logger';

const getHandler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    // 获取路径参数
    const sessionId = getPathParam(event, 'sessionId');

    logger.info('查询会话详情', { sessionId });

    // 从 DynamoDB 获取会话
    const session = await getItem<SessionEntity>(
      `SESSION#${sessionId}`,
      'METADATA'
    );

    if (!session) {
      return apiError.notFound(`会话不存在: ${sessionId}`);
    }

    logger.info('查询成功', { sessionId, status: session.status });

    // 生成预签名下载 URL（向后兼容旧数据）
    const contentUrl = session.objectKey
      ? await generatePresignedDownloadUrl(session.objectKey)
      : session.contentUrl || '';

    // 返回会话详情(移除内部字段)
    return successResponse({
      sessionId: session.sessionId,
      contentUrl,
      contentTitle: session.contentTitle,
      status: session.status,
      totalUsers: session.totalUsers,
      metrics: session.metrics,
      journeySteps: session.journeySteps,
      summary: session.summary,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    });
  } catch (error) {
    logger.error('查询会话详情失败', { error });

    if (error instanceof Error) {
      return apiError.internal('查询会话详情失败: ' + error.message);
    }

    return apiError.internal('查询会话详情失败');
  }
};

export const handler = createHandler(getHandler);
