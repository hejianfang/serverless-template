// S3 上传工具
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from './logger';

// 初始化 S3 客户端
const client = new S3Client({
  region: process.env.AWS_REGION || 'ap-southeast-1',
});

const BUCKET_NAME = process.env.CONTENT_BUCKET_NAME || '';

/**
 * 上传文件到 S3
 * @param key S3 对象键
 * @param body 文件内容(Buffer 或 string)
 * @param contentType MIME 类型
 * @returns S3 URL
 */
export async function uploadToS3(
  key: string,
  body: Buffer | string,
  contentType: string
): Promise<string> {
  const params: PutObjectCommandInput = {
    Bucket: BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
  };

  try {
    await client.send(new PutObjectCommand(params));

    const url = `s3://${BUCKET_NAME}/${key}`;
    logger.info('文件上传到 S3 成功', { key, url, contentType });

    return url;
  } catch (error) {
    logger.error('文件上传到 S3 失败', { error, key });
    throw error;
  }
}

/**
 * 生成 S3 对象键
 * @param sessionId 会话ID
 * @param fileName 原始文件名
 * @returns S3 对象键
 */
export function generateS3Key(sessionId: string, fileName: string): string {
  const timestamp = Date.now();
  const extension = fileName.split('.').pop() || 'jpg';
  return `sessions/${sessionId}/${timestamp}.${extension}`;
}

/**
 * 从 base64 上传图片到 S3
 * @param sessionId 会话ID
 * @param base64Data base64 编码的图片数据
 * @param fileName 文件名
 * @returns S3 URL
 */
export async function uploadBase64Image(
  sessionId: string,
  base64Data: string,
  fileName: string = 'image.jpg'
): Promise<string> {
  // 移除 data:image/xxx;base64, 前缀
  const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');

  // 转换为 Buffer
  const buffer = Buffer.from(base64Content, 'base64');

  // 检测 MIME 类型
  const contentType = detectImageContentType(base64Data);

  // 生成 S3 键
  const key = generateS3Key(sessionId, fileName);

  // 上传到 S3
  return uploadToS3(key, buffer, contentType);
}

/**
 * 检测图片的 MIME 类型
 * @param base64Data base64 数据
 * @returns MIME 类型
 */
function detectImageContentType(base64Data: string): string {
  if (base64Data.startsWith('data:image/png')) {
    return 'image/png';
  } else if (base64Data.startsWith('data:image/jpeg')) {
    return 'image/jpeg';
  } else if (base64Data.startsWith('data:image/jpg')) {
    return 'image/jpeg';
  } else if (base64Data.startsWith('data:image/webp')) {
    return 'image/webp';
  } else {
    return 'image/jpeg'; // 默认
  }
}

/**
 * 从 multipart form-data 上传图片
 * @param sessionId 会话ID
 * @param fileBuffer 文件 Buffer
 * @param fileName 文件名
 * @param contentType MIME 类型
 * @returns S3 URL
 */
export async function uploadMultipartImage(
  sessionId: string,
  fileBuffer: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  const key = generateS3Key(sessionId, fileName);
  return uploadToS3(key, fileBuffer, contentType);
}

/**
 * 生成 S3 预签名上传 URL
 * @param sessionId 会话ID
 * @param fileName 文件名
 * @param contentType MIME 类型
 * @param expiresIn 过期时间(秒),默认 300 秒(5分钟)
 * @returns 预签名 URL 和对象键
 */
export async function generatePresignedUploadUrl(
  sessionId: string,
  fileName: string = 'content.jpg',
  contentType: string = 'image/jpeg',
  expiresIn: number = 300
): Promise<{
  uploadUrl: string;
  objectKey: string;
  expiresIn: number;
}> {
  const objectKey = generateS3Key(sessionId, fileName);

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: objectKey,
    ContentType: contentType,
  });

  try {
    const uploadUrl = await getSignedUrl(client, command, { expiresIn });

    logger.info('生成预签名 URL 成功', {
      sessionId,
      objectKey,
      expiresIn,
    });

    return {
      uploadUrl,
      objectKey,
      expiresIn,
    };
  } catch (error) {
    logger.error('生成预签名 URL 失败', { error, sessionId });
    throw error;
  }
}

/**
 * 检查 S3 对象是否存在
 * @param objectKey S3 对象键
 * @returns 是否存在
 */
export async function checkObjectExists(objectKey: string): Promise<boolean> {
  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: BUCKET_NAME,
        Key: objectKey,
      })
    );
    return true;
  } catch (error) {
    if ((error as { name: string }).name === 'NotFound') {
      return false;
    }
    throw error;
  }
}

/**
 * 生成 S3 预签名下载 URL
 * @param objectKey S3 对象键
 * @param expiresIn 过期时间(秒),默认 3600 秒(1小时)
 * @param inline 是否在浏览器中直接打开(true)还是下载(false),默认 true
 * @returns 预签名下载 URL
 */
export async function generatePresignedDownloadUrl(
  objectKey: string,
  expiresIn: number = 3600,
  inline: boolean = true
): Promise<string> {
  // 从文件扩展名推断 Content-Type
  const extension = objectKey.split('.').pop()?.toLowerCase() || '';
  const contentTypeMap: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
  };
  const contentType = contentTypeMap[extension] || 'application/octet-stream';

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: objectKey,
    // 设置响应头，inline 表示在浏览器中直接打开，attachment 表示下载
    ResponseContentDisposition: inline ? 'inline' : 'attachment',
    // 设置正确的 Content-Type 以支持浏览器预览
    ResponseContentType: contentType,
  });

  try {
    const downloadUrl = await getSignedUrl(client, command, { expiresIn });

    logger.debug('生成预签名下载 URL 成功', {
      objectKey,
      expiresIn,
      inline,
      contentType,
    });

    return downloadUrl;
  } catch (error) {
    logger.error('生成预签名下载 URL 失败', { error, objectKey });
    throw error;
  }
}

/**
 * 从对象键构建 S3 预签名下载 URL（异步版本）
 * @param objectKey S3 对象键
 * @returns 预签名 HTTPS URL
 */
export async function buildS3Url(objectKey: string): Promise<string> {
  return generatePresignedDownloadUrl(objectKey);
}
