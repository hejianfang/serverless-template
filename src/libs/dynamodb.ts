// DynamoDB 客户端封装
import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  UpdateItemCommand,
  DeleteItemCommand,
  QueryCommand,
  type QueryCommandInput,
  type PutItemCommandInput,
  type GetItemCommandInput,
  type UpdateItemCommandInput,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { logger } from './logger';

// 初始化 DynamoDB 客户端
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-southeast-1',
});

const TABLE_NAME = process.env.MAIN_TABLE_NAME || '';

/**
 * 插入项目到 DynamoDB
 */
export async function putItem<T extends Record<string, unknown>>(
  item: T
): Promise<void> {
  const params: PutItemCommandInput = {
    TableName: TABLE_NAME,
    Item: marshall(item, { removeUndefinedValues: true }),
  };

  try {
    await client.send(new PutItemCommand(params));
    logger.debug('DynamoDB putItem 成功', { PK: item.PK, SK: item.SK });
  } catch (error) {
    logger.error('DynamoDB putItem 失败', { error, item });
    throw error;
  }
}

/**
 * 获取单个项目
 */
export async function getItem<T>(
  PK: string,
  SK: string
): Promise<T | null> {
  const params: GetItemCommandInput = {
    TableName: TABLE_NAME,
    Key: marshall({ PK, SK }),
  };

  try {
    const result = await client.send(new GetItemCommand(params));
    if (!result.Item) {
      logger.debug('DynamoDB getItem 未找到', { PK, SK });
      return null;
    }

    const item = unmarshall(result.Item) as T;
    logger.debug('DynamoDB getItem 成功', { PK, SK });
    return item;
  } catch (error) {
    logger.error('DynamoDB getItem 失败', { error, PK, SK });
    throw error;
  }
}

/**
 * 更新项目
 */
export async function updateItem(
  PK: string,
  SK: string,
  updates: Record<string, unknown>
): Promise<void> {
  // 构建 UpdateExpression
  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, unknown> = {};

  Object.entries(updates).forEach(([key, value], index) => {
    const attrName = `#attr${index}`;
    const attrValue = `:val${index}`;
    updateExpressions.push(`${attrName} = ${attrValue}`);
    expressionAttributeNames[attrName] = key;
    expressionAttributeValues[attrValue] = value;
  });

  const params: UpdateItemCommandInput = {
    TableName: TABLE_NAME,
    Key: marshall({ PK, SK }),
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: marshall(expressionAttributeValues),
  };

  try {
    await client.send(new UpdateItemCommand(params));
    logger.debug('DynamoDB updateItem 成功', { PK, SK, updates });
  } catch (error) {
    logger.error('DynamoDB updateItem 失败', { error, PK, SK });
    throw error;
  }
}

/**
 * 删除项目
 */
export async function deleteItem(PK: string, SK: string): Promise<void> {
  const params = {
    TableName: TABLE_NAME,
    Key: marshall({ PK, SK }),
  };

  try {
    await client.send(new DeleteItemCommand(params));
    logger.debug('DynamoDB deleteItem 成功', { PK, SK });
  } catch (error) {
    logger.error('DynamoDB deleteItem 失败', { error, PK, SK });
    throw error;
  }
}

/**
 * 查询项目
 */
export async function queryItems<T>(
  keyConditionExpression: string,
  expressionAttributeValues: Record<string, unknown>,
  options?: {
    indexName?: string;
    limit?: number;
    exclusiveStartKey?: Record<string, unknown>;
    scanIndexForward?: boolean;
  }
): Promise<{
  items: T[];
  lastEvaluatedKey?: Record<string, unknown>;
}> {
  const params: QueryCommandInput = {
    TableName: TABLE_NAME,
    KeyConditionExpression: keyConditionExpression,
    ExpressionAttributeValues: marshall(expressionAttributeValues),
    IndexName: options?.indexName,
    Limit: options?.limit,
    ExclusiveStartKey: options?.exclusiveStartKey
      ? marshall(options.exclusiveStartKey)
      : undefined,
    ScanIndexForward: options?.scanIndexForward ?? true,
  };

  try {
    const result = await client.send(new QueryCommand(params));
    const items = result.Items?.map((item) => unmarshall(item) as T) || [];
    const lastEvaluatedKey = result.LastEvaluatedKey
      ? unmarshall(result.LastEvaluatedKey)
      : undefined;

    logger.debug('DynamoDB query 成功', {
      itemCount: items.length,
      hasMore: !!lastEvaluatedKey,
    });

    return { items, lastEvaluatedKey };
  } catch (error) {
    logger.error('DynamoDB query 失败', { error, params });
    throw error;
  }
}

/**
 * 批量写入项目
 */
export async function batchPutItems<T extends Record<string, unknown>>(
  items: T[]
): Promise<void> {
  // DynamoDB BatchWriteItem 限制每次最多 25 个项目
  const BATCH_SIZE = 25;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);

    // 使用 Promise.all 并发写入
    await Promise.all(batch.map((item) => putItem(item)));

    logger.debug(`批量写入进度: ${i + batch.length}/${items.length}`);
  }

  logger.info(`批量写入完成,共 ${items.length} 个项目`);
}
