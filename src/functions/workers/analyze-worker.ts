// Worker Lambda: 处理 AI 分析任务
import { SQSEvent, SQSHandler } from 'aws-lambda';
import { logger } from '../../libs/logger';
import { buildS3Url } from '../../libs/s3';
import { putItem, batchPutItems } from '../../libs/dynamodb';
import { analyzeContent } from '../../services/ai-analyzer';
import type { SessionEntity } from '../../schemas/session';
import type { UserEntity } from '../../schemas/user';
import type { AnalysisMessage } from '../../libs/sqs';

/**
 * SQS 触发的 Worker Lambda
 * 处理异步的 AI 分析任务
 */
export const handler: SQSHandler = async (event: SQSEvent) => {
  logger.info('Worker 开始处理 SQS 消息', { recordCount: event.Records.length });

  // 处理每条消息
  for (const record of event.Records) {
    try {
      // 解析消息体
      const message: AnalysisMessage = JSON.parse(record.body);
      const { sessionId, objectKey, contentTitle, personaCount = 30 } = message;

      logger.info('开始处理分析任务', { sessionId, objectKey, personaCount });

      // 执行 AI 分析
      await processAnalysis(sessionId, objectKey, contentTitle, personaCount);

      logger.info('分析任务完成', { sessionId });
    } catch (error) {
      logger.error('处理 SQS 消息失败', {
        error,
        messageId: record.messageId,
        body: record.body,
      });

      // 抛出错误，让 SQS 重试
      throw error;
    }
  }
};

/**
 * 执行 AI 分析
 */
async function processAnalysis(
  sessionId: string,
  objectKey: string,
  contentTitle?: string,
  personaCount: number = 30
): Promise<void> {
  try {
    logger.info('开始 AI 分析', { sessionId, objectKey, personaCount });

    // 生成预签名下载 URL（用于 AI 分析）
    const contentUrl = await buildS3Url(objectKey);

    // 调用 AI 分析服务（传入 objectKey 用于检测图片格式）
    const analysisResult = await analyzeContent(contentUrl, contentTitle, objectKey, personaCount);

    // 创建 USER 实体数组
    const userEntities: UserEntity[] = analysisResult.users.map((user) => ({
      PK: `SESSION#${sessionId}`,
      SK: `USER#${user.userId}`,
      GSI1PK: `SESSION#${sessionId}`,
      GSI1SK: `STATUS#${user.status}#${user.userId}`,
      entityType: 'USER',
      sessionId,
      ...user,
    }));

    // 批量写入用户数据
    await batchPutItems(userEntities);

    logger.info('用户数据已写入', { sessionId, userCount: userEntities.length });

    // 更新 SESSION 状态为 completed
    const updatedSessionEntity: SessionEntity = {
      PK: `SESSION#${sessionId}`,
      SK: 'METADATA',
      GSI1PK: 'SESSIONS',
      GSI1SK: `STATUS#completed#${new Date().toISOString()}`,
      entityType: 'SESSION',
      sessionId,
      objectKey,
      contentTitle,
      status: 'completed',
      totalUsers: personaCount, // 使用实际分析的人设数量
      metrics: analysisResult.metrics,
      journeySteps: analysisResult.journeySteps,
      summary: analysisResult.summary,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ttl: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60,
    };

    await putItem(updatedSessionEntity);

    logger.info('会话分析完成', { sessionId, status: 'completed' });
  } catch (error) {
    logger.error('AI 分析失败', { error, sessionId });

    // 更新会话状态为 failed
    const failedSessionEntity: Partial<SessionEntity> = {
      PK: `SESSION#${sessionId}`,
      SK: 'METADATA',
      status: 'failed',
      updatedAt: new Date().toISOString(),
    };

    await putItem(failedSessionEntity as SessionEntity);

    // 重新抛出错误，让 SQS 知道处理失败
    throw error;
  }
}
