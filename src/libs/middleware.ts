import middy from '@middy/core';
import httpErrorHandler from '@middy/http-error-handler';
import httpCors from '@middy/http-cors';
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Handler } from 'aws-lambda';
import { logger } from './logger';
import { apiError } from './api-gateway';
import { ZodSchema } from 'zod';

// 自定义错误处理中间件
const customErrorHandler = (): middy.MiddlewareObj<
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2
> => {
  const onError: middy.MiddlewareFn<APIGatewayProxyEventV2, APIGatewayProxyResultV2> = async (
    request: middy.Request<APIGatewayProxyEventV2, APIGatewayProxyResultV2>
  ) => {
    const error = request.error as Error;

    if (!error) return;

    logger.error('Lambda 执行错误', error, {
      event: request.event,
    });

    // 根据错误类型返回不同的响应
    if (error.name === 'ValidationError') {
      request.response = apiError.validation(error.message);
      return;
    }

    if (error.message.includes('not found')) {
      request.response = apiError.notFound(error.message);
      return;
    }

    if (error.message.includes('already exists')) {
      request.response = apiError.conflict(error.message);
      return;
    }

    // 默认内部服务器错误
    request.response = apiError.internal('请求处理失败', {
      error: error.message,
    });
  };

  return {
    onError,
  };
};

// 请求日志中间件
const requestLogger = (): middy.MiddlewareObj<APIGatewayProxyEventV2, APIGatewayProxyResultV2> => {
  const before: middy.MiddlewareFn<APIGatewayProxyEventV2, APIGatewayProxyResultV2> = async (
    request: middy.Request<APIGatewayProxyEventV2, APIGatewayProxyResultV2>
  ) => {
    logger.info('接收到请求', {
      path: request.event.rawPath,
      method: request.event.requestContext.http.method,
      requestId: request.event.requestContext.requestId,
    });
  };

  const after: middy.MiddlewareFn<APIGatewayProxyEventV2, APIGatewayProxyResultV2> = async (
    request: middy.Request<APIGatewayProxyEventV2, APIGatewayProxyResultV2>
  ) => {
    logger.info('请求完成', {
      statusCode: typeof request.response === 'object' ? request.response?.statusCode : undefined,
      requestId: request.event.requestContext.requestId,
    });
  };

  return {
    before,
    after,
  };
};

// Zod 验证中间件
export const zodValidator = <T>(
  schema: ZodSchema<T>,
  type: 'body' | 'query' | 'params' = 'body'
) => {
  const before: middy.MiddlewareFn<APIGatewayProxyEventV2, APIGatewayProxyResultV2> = async (
    request: middy.Request<APIGatewayProxyEventV2, APIGatewayProxyResultV2>
  ) => {
    try {
      let dataToValidate;

      switch (type) {
        case 'body':
          dataToValidate = request.event.body;
          break;
        case 'query':
          dataToValidate = request.event.queryStringParameters || {};
          break;
        case 'params':
          dataToValidate = request.event.pathParameters || {};
          break;
      }

      const validated = schema.parse(dataToValidate);

      // 将验证后的数据存储到 event 中
      (request.event as any)[`validated${type.charAt(0).toUpperCase() + type.slice(1)}`] =
        validated;
    } catch (error: any) {
      logger.warn('数据验证失败', { type, error: error.errors });
      throw {
        name: 'ValidationError',
        message: '数据验证失败',
        details: error.errors,
      };
    }
  };

  return {
    before,
  };
};

// 条件 JSON body 解析中间件
const conditionalJsonBodyParser = (): middy.MiddlewareObj<
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2
> => {
  const before: middy.MiddlewareFn<APIGatewayProxyEventV2, APIGatewayProxyResultV2> = async (
    request: middy.Request<APIGatewayProxyEventV2, APIGatewayProxyResultV2>
  ) => {
    // 如果没有 body 或 body 为空，跳过解析
    if (!request.event.body) {
      return;
    }

    // 如果是字符串，尝试解析为 JSON
    if (typeof request.event.body === 'string') {
      try {
        request.event.body = JSON.parse(request.event.body) as any;
      } catch (error) {
        logger.warn('JSON 解析失败', { error, body: request.event.body });
        // 解析失败时保持原始 body
      }
    }
  };

  return {
    before,
  };
};

// 标准中间件包装器
export const createHandler = (
  handler: Handler<APIGatewayProxyEventV2, APIGatewayProxyResultV2>
): middy.MiddyfiedHandler<APIGatewayProxyEventV2, APIGatewayProxyResultV2> => {
  return middy(handler)
    .use(requestLogger())
    .use(conditionalJsonBodyParser())
    .use(httpCors())
    .use(customErrorHandler())
    .use(httpErrorHandler());
};
