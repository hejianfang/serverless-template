import { APIGatewayProxyResultV2 } from 'aws-lambda';
import { createHandler } from '../../libs/middleware';
import { successResponse } from '../../libs/api-gateway';
import { logger } from '../../libs/logger';
const healthCheckHandler = async (): Promise<APIGatewayProxyResultV2> => {
  logger.info('健康检查请求');
  const healthData = {
    status: 'healthy',
    service: 'PersonaSim Backend',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.STAGE || 'unknown',
    region: process.env.AWS_REGION || 'unknown',
  };
  return successResponse(healthData);
};
export const handler = createHandler(healthCheckHandler);
