# PersonaSim Backend

基于 AWS Lambda、API Gateway 和 DynamoDB 构建的现代化 Serverless REST API 项目，使用 Serverless Framework 管理部署。

## 📋 目录

- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [开发指南](#开发指南)
- [部署](#部署)
- [API 文档](#api-文档)
- [测试](#测试)

## 🚀 技术栈

### 核心技术
- **TypeScript 5.x** - 类型安全的 JavaScript
- **Node.js 20.x** - 运行时环境
- **AWS Lambda** - 无服务器计算
- **API Gateway HTTP API** - API 管理
- **DynamoDB** - NoSQL 数据库

### 基础设施
- **Serverless Framework 3.x** - 部署和管理工具
- **serverless-esbuild** - 快速打包插件

### 开发工具
- **Vitest** - 现代测试框架
- **ESLint + Prettier** - 代码规范
- **Middy** - Lambda 中间件引擎
- **Zod** - Schema 验证

## 📁 项目结构

```
PersonaSim-backend/
├── src/
│   ├── functions/          # Lambda 函数
│   │   ├── users/          # 用户相关函数
│   │   │   ├── create.ts   # 创建用户
│   │   │   ├── get.ts      # 获取用户
│   │   │   ├── list.ts     # 列出用户
│   │   │   ├── update.ts   # 更新用户
│   │   │   └── delete.ts   # 删除用户
│   │   └── health/
│   │       └── check.ts    # 健康检查
│   ├── libs/               # 共享库
│   │   ├── dynamodb.ts     # DynamoDB 客户端
│   │   ├── api-gateway.ts  # API 响应工具
│   │   ├── middleware.ts   # 中间件
│   │   └── logger.ts       # 日志工具
│   ├── schemas/            # 数据验证模式
│   │   └── user.ts
│   └── types/              # 类型定义
│       └── index.ts
├── tests/                  # 测试文件
│   ├── setup.ts
│   └── unit/
├── docs/                   # 文档
│   ├── API.md
│   └── DEPLOYMENT.md
├── .github/
│   └── workflows/
│       └── ci.yml          # CI/CD 配置
├── serverless.yml          # Serverless 配置
├── package.json
├── tsconfig.json
└── README.md
```

## 🎯 快速开始

### 前置要求

- Node.js 20+
- npm 或 yarn
- AWS CLI 已配置
- AWS 账户

### 安装

1. **克隆项目并安装依赖**

```bash
npm install
```

2. **配置 AWS 凭证**

```bash
aws configure
```

输入你的 AWS Access Key、Secret Key 和 Region。

### 首次部署

```bash
# 部署到开发环境
npm run deploy:dev
```

部署成功后，会输出 API 端点 URL。

## 💻 开发指南

### 可用命令

```bash
# 测试
npm test                # 运行测试
npm run test:ui         # 测试 UI 界面
npm run test:coverage   # 生成覆盖率报告

# 代码质量
npm run lint            # 检查代码规范
npm run lint:fix        # 修复代码规范问题
npm run format          # 格式化代码
npm run type-check      # 类型检查

# 部署
npm run deploy          # 部署（默认 dev 环境）
npm run deploy:dev      # 部署到开发环境
npm run deploy:staging  # 部署到测试环境
npm run deploy:prod     # 部署到生产环境

# 管理
npm run info            # 查看部署信息
npm run logs -- -f functionName  # 查看函数日志
npm run remove          # 删除部署的资源
```

### 添加新的 API 端点

1. **创建 Lambda 函数**

在 `src/functions/` 下创建新的函数文件：

```typescript
// src/functions/example/action.ts
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { createHandler } from '../../libs/middleware';
import { successResponse } from '../../libs/api-gateway';

const actionHandler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  // 你的业务逻辑
  return successResponse({ message: 'Hello!' });
};

export const handler = createHandler(actionHandler);
```

2. **在 serverless.yml 中添加函数定义**

```yaml
functions:
  exampleAction:
    handler: src/functions/example/action.handler
    description: 示例操作
    events:
      - httpApi:
          path: /example
          method: GET
```

3. **重新部署**

```bash
npm run deploy
```

## 🚢 部署

### 手动部署

```bash
# 开发环境
npm run deploy:dev

# 生产环境
npm run deploy:prod
```

### 查看部署信息

```bash
# 查看当前部署的资源
npm run info

# 查看特定环境
serverless info --stage prod
```

### 查看日志

```bash
# 查看特定函数的日志
npm run logs -- -f createUser --stage dev

# 实时查看日志
npm run logs -- -f createUser --stage dev --tail
```

### 删除部署

```bash
# 删除开发环境资源
npm run remove:dev

# 删除生产环境资源
npm run remove:prod
```

### CI/CD 部署

项目包含 GitHub Actions 配置：

- **Push 到 `develop` 分支** → 自动部署到开发环境
- **Push 到 `main` 分支** → 自动部署到生产环境

需要在 GitHub Secrets 中配置：
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

## 📖 API 文档

### 基础 URL

```
https://your-api-id.execute-api.us-east-1.amazonaws.com
```

### 端点列表

#### 健康检查

```http
GET /health
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "service": "PersonaSim Backend",
    "timestamp": "2025-01-15T10:00:00Z"
  }
}
```

#### 创建用户

```http
POST /users
Content-Type: application/json

{
  "email": "user@example.com",
  "name": "张三",
  "metadata": {
    "role": "admin"
  }
}
```

#### 获取用户

```http
GET /users/{id}
```

#### 列出用户

```http
GET /users?status=active&limit=20
```

#### 更新用户

```http
PUT /users/{id}
Content-Type: application/json

{
  "name": "李四",
  "status": "inactive"
}
```

#### 删除用户

```http
DELETE /users/{id}
```

详细 API 文档请查看 [docs/API.md](docs/API.md)

## 🧪 测试

```bash
# 运行所有测试
npm test

# 监听模式
npm test -- --watch

# 生成覆盖率报告
npm run test:coverage

# 打开测试 UI
npm run test:ui
```

### 编写测试

测试文件放在 `tests/` 目录下，使用 `.test.ts` 或 `.spec.ts` 后缀。

```typescript
import { describe, it, expect } from 'vitest';

describe('示例测试', () => {
  it('应该正常工作', () => {
    expect(1 + 1).toBe(2);
  });
});
```

## 🔧 配置

### 环境变量

在 `serverless.yml` 中配置环境变量：

```yaml
provider:
  environment:
    STAGE: ${self:provider.stage}
    USERS_TABLE_NAME: ${self:custom.usersTableName}
    LOG_LEVEL: ${self:custom.logLevel.${self:provider.stage}}
```

### DynamoDB 表设计

**用户表** (`personasim-backend-users-{stage}`)

- **主键:**
  - Partition Key: `id` (String) - UUID
  - Sort Key: `createdAt` (String) - ISO 时间戳

- **全局二级索引:**
  - `email-index`: 按邮箱查询
  - `status-createdAt-index`: 按状态和创建时间查询

## 🤝 贡献

欢迎贡献！请遵循以下步骤：

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📝 许可证

MIT License

## 📞 联系方式

如有问题，请创建 Issue。

---

**祝你使用愉快！** 🎉
