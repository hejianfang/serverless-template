// GET /sessions/{sessionId}/users/{userId} - 获取用户详情
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { createHandler } from '../../libs/middleware';
import { successResponse, apiError, getPathParam } from '../../libs/api-gateway';
import { getItem } from '../../libs/dynamodb';
import type { UserEntity } from '../../schemas/user';
import { logger } from '../../libs/logger';

const getUserHandler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    // 获取路径参数
    const sessionId = getPathParam(event, 'sessionId');
    const userId = getPathParam(event, 'userId');

    logger.info('查询用户详情', { sessionId, userId });

    // 从 DynamoDB 获取用户
    const user = await getItem<UserEntity>(
      `SESSION#${sessionId}`,
      `USER#${userId}`
    );

    if (!user) {
      return apiError.notFound(`用户不存在: ${userId}`);
    }

    logger.info('查询成功', { sessionId, userId, status: user.status });

    // 返回用户详情(移除内部字段)
    return successResponse({
      userId: user.userId,
      name: user.name,
      opened: user.opened,
      liked: user.liked,
      commented: user.commented,
      purchased: user.purchased,
      browseTime: user.browseTime,
      interest: user.interest,
      priceRange: user.priceRange,
      status: user.status,
      innerMonologue: user.innerMonologue,
      timeline: user.timeline,
      insights: user.insights,
      createdAt: user.createdAt,
    });
  } catch (error) {
    logger.error('查询用户详情失败', { error });

    if (error instanceof Error) {
      return apiError.internal('查询用户详情失败: ' + error.message);
    }

    return apiError.internal('查询用户详情失败');
  }
};

export const handler = createHandler(getUserHandler);
