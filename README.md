# PersonaSim Backend

基于 30 个固定人设的小红书内容分析系统 - Serverless 后端

## 📋 项目概述

PersonaSim 是一个智能用户行为模拟系统,通过 AI 分析小红书内容,预测 30 个不同人设的用户行为反应。

### 核心功能

- ✅ **S3 预签名上传**: 高效、安全的图片上传机制
- ✅ **30 个固定人设**: 多样化的真实用户画像
- ✅ **AI 行为预测**: 基于 GPT-4 的个性化行为分析
- ✅ **实时分析**: 异步处理,30-60 秒完成分析
- ✅ **完整 REST API**: 6 个端点,支持会话和用户管理

### 技术栈

- **框架**: Serverless Framework 4.x
- **运行时**: Node.js 20.x (AWS Lambda)
- **数据库**: DynamoDB (单表设计)
- **存储**: S3 (预签名 URL)
- **AI**: GPT-4 via chat-api
- **语言**: TypeScript 5.x

---

## 📚 文档

### 核心文档

| 文档 | 说明 |
|------|------|
| [API 接口文档](./docs/API_REFERENCE.md) | 完整的 API 使用指南 |
| [系统流程](./docs/WORKFLOW.md) | 架构设计和工作流程 |
| [部署指南](./docs/DEPLOYMENT.md) | 详细部署步骤 |
| [S3 上传](./docs/S3_PRESIGNED_UPLOAD.md) | S3 预签名上传说明 |

### 快速链接

- **API 端点**: 查看 [API_REFERENCE.md](./docs/API_REFERENCE.md#sessions-接口)
- **数据库设计**: 查看 [WORKFLOW.md](./docs/WORKFLOW.md#数据库设计)
- **人设配置**: 查看 [src/config/personas.ts](./src/config/personas.ts)
- **错误处理**: 查看 [API_REFERENCE.md](./docs/API_REFERENCE.md#错误处理)

---

## 🏗️ 项目结构

```
PersonaSim-backend/
├── docs/                       # 文档
│   ├── API_REFERENCE.md        # API 接口文档
│   ├── WORKFLOW.md             # 系统流程
│   ├── DEPLOYMENT.md           # 部署指南
│   └── S3_PRESIGNED_UPLOAD.md  # S3 上传说明
├── src/
│   ├── config/                 # 配置文件
│   │   └── personas.ts         # 30 个固定人设
│   ├── functions/              # Lambda 函数
│   │   ├── health/             # 健康检查
│   │   ├── sessions/           # 会话管理
│   │   │   ├── get-upload-url.ts   # 获取上传 URL
│   │   │   ├── analyze.ts          # 触发分析
│   │   │   ├── list.ts             # 会话列表
│   │   │   └── get.ts              # 会话详情
│   │   └── users/              # 用户管理
│   │       ├── list.ts             # 用户列表
│   │       └── get.ts              # 用户详情
│   ├── libs/                   # 工具库
│   │   ├── api-gateway.ts      # API 响应格式化
│   │   ├── chat-api.ts         # AI 服务调用
│   │   ├── dynamodb.ts         # DynamoDB 操作
│   │   ├── logger.ts           # 日志工具
│   │   ├── middleware.ts       # Lambda 中间件
│   │   └── s3.ts               # S3 操作
│   ├── schemas/                # Zod 验证模式
│   │   ├── session.ts          # SESSION 实体
│   │   └── user.ts             # USER 实体
│   └── services/               # 业务逻辑
│       └── ai-analyzer.ts      # AI 分析服务
├── serverless.yml              # Serverless 配置
├── tsconfig.json               # TypeScript 配置
└── package.json                # 项目依赖
```

## 🚀 快速开始

### 1. 环境要求

- Node.js >= 20.x
- npm >= 10.x
- AWS CLI 配置完成
- Serverless Framework >= 4.x

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

创建 `.env` 文件:

```bash
# AI 服务配置
AI_MODEL_KEY=gpt-4
AI_API_ENDPOINT=https://your-chat-api.com

# AWS 区域
AWS_REGION=ap-southeast-1

# 日志级别
LOG_LEVEL=info
```

### 4. 本地开发

```bash
# 类型检查
npm run type-check

# 格式化代码
npm run format
```

### 5. 部署

```bash
# 部署到开发环境
npm run deploy

# 部署到生产环境
npm run deploy:prod

# 查看部署信息
serverless info
```

---

## 🔌 API 端点

### Sessions

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/sessions/upload-url` | 获取 S3 上传 URL |
| POST | `/sessions/analyze` | 触发 AI 分析 |
| GET | `/sessions` | 获取会话列表 |
| GET | `/sessions/{sessionId}` | 获取会话详情 |

### Users

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/sessions/{sessionId}/users` | 获取用户列表 |
| GET | `/sessions/{sessionId}/users/{userId}` | 获取用户详情 |

### Health

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |

详细说明请查看 [API 接口文档](./docs/API_REFERENCE.md)

---

## 🎯 使用流程

### 1. 获取上传 URL

```bash
curl -X POST https://your-api.com/sessions/upload-url \
  -H "Content-Type: application/json" \
  -d '{"fileName": "content.jpg", "contentType": "image/jpeg"}'
```

**响应**:
```json
{
  "success": true,
  "data": {
    "sessionId": "2025-10-23-abc123",
    "uploadUrl": "https://...",
    "objectKey": "sessions/2025-10-23-abc123/1729662000000.jpg"
  }
}
```

### 2. 上传图片到 S3

```bash
curl -X PUT "{uploadUrl}" \
  -H "Content-Type: image/jpeg" \
  --data-binary @image.jpg
```

### 3. 触发分析

```bash
curl -X POST https://your-api.com/sessions/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "2025-10-23-abc123",
    "objectKey": "sessions/2025-10-23-abc123/1729662000000.jpg",
    "contentTitle": "春季新品发布"
  }'
```

### 4. 查询结果

```bash
curl https://your-api.com/sessions/2025-10-23-abc123
```

**响应**:
```json
{
  "success": true,
  "data": {
    "sessionId": "2025-10-23-abc123",
    "status": "completed",
    "metrics": {
      "interest": 73,
      "open": 67,
      "like": 54,
      "comment": 23,
      "purchase": 18
    }
  }
}
```

完整示例请查看 [API 接口文档](./docs/API_REFERENCE.md#完整使用示例)

---

## 📊 人设配置

系统内置 30 个多样化的用户人设,覆盖不同年龄、职业、兴趣和购买力:

### 年龄分布

- **18-24 岁**: 8 人 (学生、应届生、时尚博主等)
- **25-30 岁**: 10 人 (职场新人、市场专员、金融分析师等)
- **31-35 岁**: 7 人 (职场骨干、全职妈妈、企业主管等)
- **36-45 岁**: 5 人 (高管、企业家、培训讲师等)

查看完整人设列表: [src/config/personas.ts](./src/config/personas.ts)

---

## 🛠️ 开发命令

```bash
# 开发
npm run type-check       # 类型检查
npm run format          # 格式化代码

# 部署
npm run deploy          # 部署到 dev
npm run deploy:prod     # 部署到 prod
npm run remove          # 删除部署

# 日志
npm run logs -- -f functionName --tail

# 其他
serverless info         # 查看部署信息
serverless invoke -f functionName   # 调用函数
```

---

## 📄 许可证

MIT License

---

## 📞 联系方式

如有问题,请查看:
- [API 接口文档](./docs/API_REFERENCE.md)
- [系统流程](./docs/WORKFLOW.md)
- [部署指南](./docs/DEPLOYMENT.md)

---

**PersonaSim** - 智能用户行为模拟系统 🚀
