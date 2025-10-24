// SQS 操作封装
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { logger } from './logger';

// 初始化 SQS 客户端
const client = new SQSClient({
  region: process.env.AWS_REGION || 'ap-southeast-1',
});

// 分析任务消息
export interface AnalysisMessage {
  sessionId: string;
  objectKey: string;
  contentTitle?: string;
  personaCount?: number; // 分析的人设数量 (5, 10, 15, 20, 30)
}

/**
 * 发送分析任务到 SQS 队列
 * @param message 分析任务消息
 * @returns 消息 ID
 */
export async function sendAnalysisTask(message: AnalysisMessage): Promise<string> {
  const queueUrl = process.env.ANALYSIS_QUEUE_URL;

  if (!queueUrl) {
    throw new Error('ANALYSIS_QUEUE_URL environment variable is not set');
  }

  try {
    const command = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(message),
      MessageAttributes: {
        sessionId: {
          DataType: 'String',
          StringValue: message.sessionId,
        },
      },
    });

    const response = await client.send(command);

    logger.info('SQS 消息发送成功', {
      messageId: response.MessageId,
      sessionId: message.sessionId,
    });

    return response.MessageId || '';
  } catch (error) {
    logger.error('SQS 消息发送失败', { error, message });
    throw error;
  }
}
