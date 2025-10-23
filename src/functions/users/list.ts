// GET /sessions/{sessionId}/users - 获取会话的用户列表
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { createHandler } from '../../libs/middleware';
import {
  successResponse,
  apiError,
  getPathParam,
  getQueryParam,
} from '../../libs/api-gateway';
import { queryItems } from '../../libs/dynamodb';
import { ListUsersQuerySchema, type UserEntity } from '../../schemas/user';
import { logger } from '../../libs/logger';

const listUsersHandler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    // 获取路径参数
    const sessionId = getPathParam(event, 'sessionId');

    // 解析查询参数
    const status = getQueryParam(event, 'status');
    const limit = getQueryParam(event, 'limit', '30');
    const nextToken = getQueryParam(event, 'nextToken');

    // 验证查询参数
    const query = ListUsersQuerySchema.parse({
      status,
      limit: limit ? parseInt(limit) : 30,
      nextToken,
    });

    logger.info('查询用户列表', { sessionId, query });

    // 构建查询条件
    let keyConditionExpression: string;
    let expressionAttributeValues: Record<string, unknown>;

    if (query.status) {
      // 按状态筛选 - 使用 GSI1
      keyConditionExpression = 'GSI1PK = :pk AND begins_with(GSI1SK, :sk)';
      expressionAttributeValues = {
        ':pk': `SESSION#${sessionId}`,
        ':sk': `STATUS#${query.status}`,
      };
    } else {
      // 查询所有用户 - 使用主表
      keyConditionExpression = 'PK = :pk AND begins_with(SK, :sk)';
      expressionAttributeValues = {
        ':pk': `SESSION#${sessionId}`,
        ':sk': 'USER#',
      };
    }

    // 执行查询
    const { items, lastEvaluatedKey } = await queryItems<UserEntity>(
      keyConditionExpression,
      expressionAttributeValues,
      {
        indexName: query.status ? 'GSI1' : undefined,
        limit: query.limit,
        exclusiveStartKey: query.nextToken
          ? JSON.parse(Buffer.from(query.nextToken, 'base64').toString())
          : undefined,
        scanIndexForward: true, // 按用户编号升序
      }
    );

    logger.info('查询完成', {
      sessionId,
      count: items.length,
      hasMore: !!lastEvaluatedKey,
    });

    // 生成下一页 token
    const nextPageToken = lastEvaluatedKey
      ? Buffer.from(JSON.stringify(lastEvaluatedKey)).toString('base64')
      : undefined;

    // 返回响应(只返回卡片需要的字段)
    return successResponse({
      users: items.map((user) => ({
        userId: user.userId,
        name: user.name,
        status: user.status,
        interest: user.interest,
        browseTime: user.browseTime,
      })),
      pagination: {
        limit: query.limit,
        nextToken: nextPageToken,
        hasMore: !!nextPageToken,
      },
    });
  } catch (error) {
    logger.error('查询用户列表失败', { error });

    if (error instanceof Error) {
      return apiError.internal('查询用户列表失败: ' + error.message);
    }

    return apiError.internal('查询用户列表失败');
  }
};

export const handler = createHandler(listUsersHandler);
