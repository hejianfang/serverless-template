import { APIGatewayProxyResultV2 } from 'aws-lambda';
import { ApiResponse, ErrorCode } from '../types';
import { logger } from './logger';

// HTTP 状态码
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
} as const;

// 创建成功响应
export function successResponse<T>(
  data: T,
  statusCode: number = HttpStatus.OK,
  meta?: ApiResponse<T>['meta']
): APIGatewayProxyResultV2 {
  const response: ApiResponse<T> = {
    success: true,
    data,
    meta: {
      ...meta,
      timestamp: new Date().toISOString(),
    },
  };

  logger.info('API 成功响应', { statusCode, dataType: typeof data });

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(response),
  };
}

// 创建错误响应
export function errorResponse(
  code: ErrorCode,
  message: string,
  statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR,
  details?: unknown
): APIGatewayProxyResultV2 {
  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      details,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  };

  logger.warn('API 错误响应', { code, message, statusCode });

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(response),
  };
}

// 特定错误响应函数
export const apiError = {
  badRequest: (message: string, details?: unknown) =>
    errorResponse(ErrorCode.BAD_REQUEST, message, HttpStatus.BAD_REQUEST, details),

  notFound: (message: string = '资源未找到') =>
    errorResponse(ErrorCode.NOT_FOUND, message, HttpStatus.NOT_FOUND),

  conflict: (message: string = '资源已存在') =>
    errorResponse(ErrorCode.ALREADY_EXISTS, message, HttpStatus.CONFLICT),

  unauthorized: (message: string = '未授权') =>
    errorResponse(ErrorCode.UNAUTHORIZED, message, HttpStatus.UNAUTHORIZED),

  forbidden: (message: string = '禁止访问') =>
    errorResponse(ErrorCode.FORBIDDEN, message, HttpStatus.FORBIDDEN),

  validation: (message: string, details?: unknown) =>
    errorResponse(ErrorCode.VALIDATION_ERROR, message, HttpStatus.BAD_REQUEST, details),

  internal: (message: string = '内部服务器错误', details?: unknown) =>
    errorResponse(ErrorCode.INTERNAL_ERROR, message, HttpStatus.INTERNAL_SERVER_ERROR, details),
};

// 从查询参数中提取值
export function getQueryParam(
  event: { queryStringParameters?: Record<string, string | undefined> },
  param: string,
  defaultValue?: string
): string | undefined {
  return event.queryStringParameters?.[param] ?? defaultValue;
}

// 从路径参数中提取值
export function getPathParam(
  event: { pathParameters?: Record<string, string | undefined> },
  param: string
): string {
  const value = event.pathParameters?.[param];
  if (!value) {
    throw new Error(`路径参数 '${param}' 未找到`);
  }
  return value;
}
