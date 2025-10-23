// Session 相关的数据验证 Schema
import { z } from 'zod';

// 会话状态枚举
export const SessionStatus = z.enum(['analyzing', 'completed', 'failed']);
export type SessionStatusType = z.infer<typeof SessionStatus>;

// 指标数据
export const MetricsSchema = z.object({
  interest: z.number().min(0).max(100), // 对小红书感兴趣 %
  open: z.number().min(0).max(100), // 会打开内容 %
  like: z.number().min(0).max(100), // 会点赞 %
  comment: z.number().min(0).max(100), // 会评论 %
  purchase: z.number().min(0).max(100), // 会购买 %
});

// 用户旅程步骤
export const JourneyStepSchema = z.object({
  label: z.string(), // 步骤名称: 浏览、打开、点赞、评论、购买
  value: z.string(), // 百分比: "100%"
  count: z.number(), // 用户数量
});

// 统计摘要
export const SummarySchema = z.object({
  totalViews: z.number(), // 总浏览数
  openCount: z.number(), // 打开数
  likeCount: z.number(), // 点赞数
  commentCount: z.number(), // 评论数
  purchaseCount: z.number(), // 购买数
  avgBrowseTime: z.number(), // 平均浏览时长(秒)
  successCount: z.number().default(0), // AI 分析成功的人设数量
  failedCount: z.number().default(0), // AI 分析失败的人设数量
});

// Session 实体
export const SessionEntitySchema = z.object({
  // 主键
  PK: z.string(), // SESSION#{sessionId}
  SK: z.string(), // METADATA

  // GSI
  GSI1PK: z.string(), // SESSIONS
  GSI1SK: z.string(), // STATUS#{status}#{timestamp}

  // 实体类型
  entityType: z.literal('SESSION'),

  // 业务字段
  sessionId: z.string(), // 会话唯一ID
  objectKey: z.string(), // S3 对象键
  contentUrl: z.string().optional(), // S3 图片URL（已废弃，保留用于兼容）
  contentTitle: z.string().optional(), // 内容标题(可选)
  status: SessionStatus, // 状态
  totalUsers: z.number().default(30), // 模拟用户总数

  // 聚合指标
  metrics: MetricsSchema,

  // 转化漏斗
  journeySteps: z.array(JourneyStepSchema),

  // 统计摘要
  summary: SummarySchema,

  // 时间戳
  createdAt: z.string(), // ISO 8601 时间戳
  updatedAt: z.string(), // ISO 8601 时间戳

  // TTL (可选)
  ttl: z.number().optional(), // Unix 时间戳
});

export type SessionEntity = z.infer<typeof SessionEntitySchema>;

// 创建会话请求
export const CreateSessionRequestSchema = z.object({
  contentTitle: z.string().optional(),
});

export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;

// 更新会话状态请求
export const UpdateSessionStatusSchema = z.object({
  status: SessionStatus,
  metrics: MetricsSchema.optional(),
  journeySteps: z.array(JourneyStepSchema).optional(),
  summary: SummarySchema.optional(),
});

export type UpdateSessionStatus = z.infer<typeof UpdateSessionStatusSchema>;

// 查询会话列表请求
export const ListSessionsQuerySchema = z.object({
  status: SessionStatus.optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  nextToken: z.string().optional(),
});

export type ListSessionsQuery = z.infer<typeof ListSessionsQuerySchema>;
