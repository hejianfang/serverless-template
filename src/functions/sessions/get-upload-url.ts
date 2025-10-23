// POST /sessions/upload-url - 获取 S3 预签名上传 URL
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { createHandler } from '../../libs/middleware';
import { successResponse, apiError } from '../../libs/api-gateway';
import { generatePresignedUploadUrl } from '../../libs/s3';
import { logger } from '../../libs/logger';

/**
 * 请求体
 */
interface GetUploadUrlRequest {
  fileName?: string; // 可选文件名
  contentType?: string; // 可选 MIME 类型
}

/**
 * 生成会话 ID
 */
function generateSessionId(): string {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const random = Math.random().toString(36).substring(2, 8);
  return `${date}-${random}`;
}

const getUploadUrlHandler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    // 解析请求体（httpJsonBodyParser 中间件已自动解析）
    const body: GetUploadUrlRequest = (event.body as unknown as GetUploadUrlRequest) || {};

    // 生成会话 ID
    const sessionId = generateSessionId();

    // 获取文件名和 MIME 类型
    const fileName = body.fileName || 'content.jpg';
    const contentType = body.contentType || 'image/jpeg';

    logger.info('生成上传 URL', { sessionId, fileName, contentType });

    // 生成预签名 URL
    const { uploadUrl, objectKey, expiresIn } = await generatePresignedUploadUrl(
      sessionId,
      fileName,
      contentType
    );

    // 返回响应
    return successResponse(
      {
        sessionId,
        uploadUrl,
        objectKey,
        expiresIn,
        message: `请在 ${expiresIn} 秒内使用 PUT 方法上传图片到 uploadUrl`,
      },
      200
    );
  } catch (error) {
    logger.error('生成上传 URL 失败', { error });

    if (error instanceof Error) {
      return apiError.internal('生成上传 URL 失败: ' + error.message);
    }

    return apiError.internal('生成上传 URL 失败');
  }
};

export const handler = createHandler(getUploadUrlHandler);
