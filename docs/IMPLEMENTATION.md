# PersonaSim 后端实现文档

## 📋 项目概述

PersonaSim 是一个基于 AWS Lambda 的 Serverless 后端服务,用于分析小红书内容并生成模拟用户行为数据。

## 🗄️ 数据库设计

### DynamoDB 单表设计

**表名**: `personasim-backend-main-{stage}`

#### 主键设计
- **PK** (分区键): String
- **SK** (排序键): String

#### 全局二级索引 (GSI-1)
- **GSI1PK** (分区键): String
- **GSI1SK** (排序键): String

### 实体类型

#### 1. SESSION 实体 (分析会话)

```typescript
{
  // 主键
  PK: "SESSION#2025-01-23-abc123",
  SK: "METADATA",

  // GSI
  GSI1PK: "SESSIONS",
  GSI1SK: "STATUS#completed#2025-01-23T10:30:00.000Z",

  // 业务字段
  entityType: "SESSION",
  sessionId: "2025-01-23-abc123",
  contentUrl: "s3://bucket/photo.jpg",
  contentTitle: "春季新品发布",
  status: "completed", // analyzing | completed | failed
  totalUsers: 30,

  // 聚合指标
  metrics: {
    interest: 73,
    open: 67,
    like: 54,
    comment: 23,
    purchase: 18
  },

  // 转化漏斗
  journeySteps: [...],

  // 统计摘要
  summary: { totalViews: 30, openCount: 20, ... },

  // 时间戳
  createdAt: "2025-01-23T10:30:00.000Z",
  updatedAt: "2025-01-23T10:35:00.000Z",
  ttl: 1740384000
}
```

#### 2. USER 实体 (模拟用户)

```typescript
{
  // 主键
  PK: "SESSION#2025-01-23-abc123",
  SK: "USER#001",

  // GSI
  GSI1PK: "SESSION#2025-01-23-abc123",
  GSI1SK: "STATUS#purchased#001",

  // 业务字段
  entityType: "USER",
  sessionId: "2025-01-23-abc123",
  userId: "001",
  name: "李华",

  // 行为标识
  opened: true,
  liked: true,
  commented: false,
  purchased: false,

  // 用户画像
  browseTime: 185,
  interest: 75,
  priceRange: "¥150-280",
  status: "liked",

  // 内心独白
  innerMonologue: "看起来还不错...",

  // 行为时间线
  timeline: [...],

  // 用户洞察
  insights: "潜在客户,需要更强的购买动机",

  createdAt: "2025-01-23T10:30:00.000Z"
}
```

## 🔌 API 端点

### 基础 URL
```
https://{api-id}.execute-api.ap-southeast-1.amazonaws.com
```

### 1. POST /sessions/analyze
**创建分析会话**

**请求体**:
```json
{
  "imageData": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  "contentTitle": "春季新品发布" // 可选
}
```

**响应** (201):
```json
{
  "success": true,
  "data": {
    "sessionId": "2025-01-23-abc123",
    "status": "analyzing",
    "message": "分析已开始,请稍后查看结果"
  },
  "meta": {
    "timestamp": "2025-01-23T10:30:00.000Z"
  }
}
```

### 2. GET /sessions
**获取会话列表**

**查询参数**:
- `status`: 状态筛选 (analyzing | completed | failed)
- `limit`: 每页数量 (1-100, 默认 20)
- `nextToken`: 分页 token

**响应** (200):
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "sessionId": "2025-01-23-abc123",
        "contentUrl": "s3://bucket/photo.jpg",
        "contentTitle": "春季新品发布",
        "status": "completed",
        "totalUsers": 30,
        "metrics": { "interest": 73, ... },
        "createdAt": "2025-01-23T10:30:00.000Z",
        "updatedAt": "2025-01-23T10:35:00.000Z"
      }
    ],
    "pagination": {
      "limit": 20,
      "nextToken": "eyJQSyI6...",
      "hasMore": false
    }
  }
}
```

### 3. GET /sessions/{sessionId}
**获取会话详情**

**响应** (200):
```json
{
  "success": true,
  "data": {
    "sessionId": "2025-01-23-abc123",
    "contentUrl": "s3://bucket/photo.jpg",
    "contentTitle": "春季新品发布",
    "status": "completed",
    "totalUsers": 30,
    "metrics": {
      "interest": 73,
      "open": 67,
      "like": 54,
      "comment": 23,
      "purchase": 18
    },
    "journeySteps": [
      { "label": "浏览", "value": "100%", "count": 30 },
      { "label": "打开", "value": "67%", "count": 20 },
      ...
    ],
    "summary": {
      "totalViews": 30,
      "openCount": 20,
      "likeCount": 16,
      "commentCount": 7,
      "purchaseCount": 5,
      "avgBrowseTime": 158
    },
    "createdAt": "2025-01-23T10:30:00.000Z",
    "updatedAt": "2025-01-23T10:35:00.000Z"
  }
}
```

### 4. GET /sessions/{sessionId}/users
**获取会话的用户列表**

**查询参数**:
- `status`: 状态筛选 (viewed | opened | liked | commented | purchased)
- `limit`: 每页数量 (1-100, 默认 30)
- `nextToken`: 分页 token

**响应** (200):
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "userId": "001",
        "name": "李华",
        "status": "purchased",
        "interest": 85,
        "browseTime": 300
      },
      ...
    ],
    "pagination": {
      "limit": 30,
      "nextToken": null,
      "hasMore": false
    }
  }
}
```

### 5. GET /sessions/{sessionId}/users/{userId}
**获取用户详情**

**响应** (200):
```json
{
  "success": true,
  "data": {
    "userId": "001",
    "name": "李华",
    "opened": true,
    "liked": true,
    "commented": true,
    "purchased": true,
    "browseTime": 300,
    "interest": 85,
    "priceRange": "¥134-281",
    "status": "purchased",
    "innerMonologue": "太心动了!虽然有点小贵...",
    "timeline": [
      { "time": "0s", "action": "查看内容封面", "active": true },
      { "time": "4s", "action": "打开内容详情", "active": true },
      ...
    ],
    "insights": "高价值用户,对内容高度认可",
    "createdAt": "2025-01-23T10:30:00.000Z"
  }
}
```

## 🏗️ 项目结构

```
src/
├── functions/
│   ├── sessions/
│   │   ├── analyze.ts      # POST /sessions/analyze
│   │   ├── list.ts         # GET /sessions
│   │   └── get.ts          # GET /sessions/{sessionId}
│   ├── users/
│   │   ├── list.ts         # GET /sessions/{sessionId}/users
│   │   └── get.ts          # GET /sessions/{sessionId}/users/{userId}
│   └── health/
│       └── check.ts        # GET /health
├── libs/
│   ├── dynamodb.ts         # DynamoDB 客户端
│   ├── s3.ts               # S3 上传工具
│   ├── api-gateway.ts      # API 响应工具
│   ├── chat-api.ts         # AI API 调用
│   ├── middleware.ts       # Lambda 中间件
│   └── logger.ts           # 日志工具
├── services/
│   └── ai-analyzer.ts      # AI 分析服务
├── schemas/
│   ├── session.ts          # Session 数据验证
│   └── user.ts             # User 数据验证
└── types/
    └── index.ts            # 类型定义
```

## 🚀 部署

### 前置要求
- Node.js 20+
- AWS CLI 已配置
- AWS 账户

### 部署步骤

```bash
# 1. 安装依赖
npm install

# 2. 类型检查
npm run type-check

# 3. 代码检查
npm run lint

# 4. 部署到 dev 环境
npm run deploy:dev

# 5. 查看部署信息
npm run info
```

### 环境变量

部署后自动设置:
- `MAIN_TABLE_NAME`: DynamoDB 表名
- `CONTENT_BUCKET_NAME`: S3 存储桶名
- `STAGE`: 环境阶段 (dev/staging/prod)
- `LOG_LEVEL`: 日志级别

需要手动配置:
- `AI_MODEL_KEY`: AI 模型密钥

## 🔒 安全配置

- **S3**: 已启用私有访问控制
- **DynamoDB**: 使用 IAM 角色权限
- **API Gateway**: 支持 CORS
- **Lambda**: 启用 X-Ray 追踪

## 📊 监控与日志

- **CloudWatch Logs**: 自动收集 Lambda 日志
- **X-Ray**: 分布式追踪
- **DynamoDB Streams**: 启用数据流

## 🔄 数据生命周期

- **TTL**: 90天后自动清理会话数据
- **S3 Lifecycle**: 90天后删除上传的图片

## 📝 后续优化建议

1. **性能优化**
   - 添加 API Gateway 缓存
   - 使用 DynamoDB DAX 加速查询
   - 实现 Lambda 预留并发

2. **功能增强**
   - 添加用户认证 (Cognito)
   - 实现 WebSocket 实时更新
   - 支持批量分析

3. **监控增强**
   - 添加自定义 CloudWatch Metrics
   - 配置告警规则
   - 实现错误追踪 (Sentry)

## 🐛 故障排查

### 常见问题

1. **Lambda 超时**
   - 检查 AI API 响应时间
   - 调整 timeout 配置

2. **DynamoDB 容量不足**
   - 检查是否需要调整按需模式
   - 优化查询条件

3. **S3 权限问题**
   - 验证 IAM 角色权限
   - 检查 bucket 策略

## 📞 支持

如有问题,请创建 Issue 或联系开发团队。
