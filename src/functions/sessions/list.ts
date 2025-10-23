// GET /sessions - 获取会话列表
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { createHandler } from '../../libs/middleware';
import { successResponse, apiError, getQueryParam } from '../../libs/api-gateway';
import { queryItems } from '../../libs/dynamodb';
import { ListSessionsQuerySchema, type SessionEntity } from '../../schemas/session';
import { generatePresignedDownloadUrl } from '../../libs/s3';
import { logger } from '../../libs/logger';

const listHandler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    // 解析查询参数
    const status = getQueryParam(event, 'status');
    const limit = getQueryParam(event, 'limit', '20');
    const nextToken = getQueryParam(event, 'nextToken');

    // 验证查询参数
    const query = ListSessionsQuerySchema.parse({
      status,
      limit: limit ? parseInt(limit) : 20,
      nextToken,
    });

    logger.info('查询会话列表', { query });

    // 构建查询条件
    let keyConditionExpression: string;
    let expressionAttributeValues: Record<string, unknown>;

    if (query.status) {
      // 按状态筛选
      keyConditionExpression = 'GSI1PK = :pk AND begins_with(GSI1SK, :sk)';
      expressionAttributeValues = {
        ':pk': 'SESSIONS',
        ':sk': `STATUS#${query.status}`,
      };
    } else {
      // 查询所有会话
      keyConditionExpression = 'GSI1PK = :pk';
      expressionAttributeValues = {
        ':pk': 'SESSIONS',
      };
    }

    // 执行查询
    const { items, lastEvaluatedKey } = await queryItems<SessionEntity>(
      keyConditionExpression,
      expressionAttributeValues,
      {
        indexName: 'GSI1',
        limit: query.limit,
        exclusiveStartKey: query.nextToken
          ? JSON.parse(Buffer.from(query.nextToken, 'base64').toString())
          : undefined,
        scanIndexForward: false, // 降序排列(最新的在前)
      }
    );

    logger.info('查询完成', {
      count: items.length,
      hasMore: !!lastEvaluatedKey,
    });

    // 生成下一页 token
    const nextPageToken = lastEvaluatedKey
      ? Buffer.from(JSON.stringify(lastEvaluatedKey)).toString('base64')
      : undefined;

    // 为每个 session 生成预签名下载 URL
    const sessionsWithUrls = await Promise.all(
      items.map(async (session) => ({
        sessionId: session.sessionId,
        contentUrl: session.objectKey
          ? await generatePresignedDownloadUrl(session.objectKey)
          : session.contentUrl || '', // 向后兼容：使用旧的 contentUrl 或空字符串
        contentTitle: session.contentTitle,
        status: session.status,
        totalUsers: session.totalUsers,
        metrics: session.metrics,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      }))
    );

    // 返回响应
    return successResponse(
      {
        sessions: sessionsWithUrls,
        pagination: {
          limit: query.limit,
          nextToken: nextPageToken,
          hasMore: !!nextPageToken,
        },
      },
      200
    );
  } catch (error) {
    logger.error('查询会话列表失败', { error });

    if (error instanceof Error) {
      return apiError.internal('查询会话列表失败: ' + error.message);
    }

    return apiError.internal('查询会话列表失败');
  }
};

export const handler = createHandler(listHandler);
