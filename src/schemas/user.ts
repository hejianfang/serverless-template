// User 相关的数据验证 Schema
import { z } from 'zod';

// 用户行为状态枚举
export const UserStatus = z.enum([
  'viewed', // 仅浏览
  'opened', // 已打开
  'liked', // 已点赞
  'commented', // 已评论
  'purchased', // 已购买
]);

export type UserStatusType = z.infer<typeof UserStatus>;

// 时间线步骤
export const TimelineStepSchema = z.object({
  time: z.string(), // 时间点: "0s", "3s"
  action: z.string(), // 操作描述
  active: z.boolean(), // 是否活跃
});

// User 实体
export const UserEntitySchema = z.object({
  // 主键
  PK: z.string(), // SESSION#{sessionId}
  SK: z.string(), // USER#{userId}

  // GSI
  GSI1PK: z.string(), // SESSION#{sessionId}
  GSI1SK: z.string(), // STATUS#{status}#{userId}

  // 实体类型
  entityType: z.literal('USER'),

  // 业务字段
  sessionId: z.string(), // 所属会话ID
  userId: z.string(), // 用户编号: "001"-"030"
  name: z.string(), // 用户姓名

  // 行为标识
  opened: z.boolean(), // 是否打开
  liked: z.boolean(), // 是否点赞
  commented: z.boolean(), // 是否评论
  purchased: z.boolean(), // 是否购买

  // 用户画像
  browseTime: z.number(), // 浏览时长(秒)
  interest: z.number().min(0).max(100), // 兴趣度(0-100)
  priceRange: z.string(), // 价格敏感度范围: "¥150-280"
  status: UserStatus, // 用户状态

  // 内心独白
  innerMonologue: z.string(),

  // 行为时间线
  timeline: z.array(TimelineStepSchema),

  // 用户洞察(AI 生成)
  insights: z.string(),

  // 时间戳
  createdAt: z.string(), // ISO 8601 时间戳
});

export type UserEntity = z.infer<typeof UserEntitySchema>;

// 查询用户列表请求
export const ListUsersQuerySchema = z.object({
  status: UserStatus.optional(),
  limit: z.coerce.number().min(1).max(100).default(30),
  nextToken: z.string().optional(),
});

export type ListUsersQuery = z.infer<typeof ListUsersQuerySchema>;

// 用户卡片数据(用于列表展示)
export const UserCardSchema = UserEntitySchema.pick({
  userId: true,
  name: true,
  status: true,
  interest: true,
  browseTime: true,
});

export type UserCard = z.infer<typeof UserCardSchema>;

// 用户详情数据(用于弹窗)
export const UserDetailSchema = UserEntitySchema.omit({
  PK: true,
  SK: true,
  GSI1PK: true,
  GSI1SK: true,
  entityType: true,
  sessionId: true,
});

export type UserDetail = z.infer<typeof UserDetailSchema>;
