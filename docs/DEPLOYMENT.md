# 部署指南

本文档详细说明如何使用 Serverless Framework 将 PersonaSim Backend 部署到 AWS。

## 目录

- [前置要求](#前置要求)
- [首次部署](#首次部署)
- [更新部署](#更新部署)
- [多环境部署](#多环境部署)
- [CI/CD 部署](#cicd-部署)
- [故障排查](#故障排查)
- [回滚](#回滚)
- [监控和日志](#监控和日志)

## 前置要求

### 1. AWS 账户设置

确保你有：
- 一个 AWS 账户
- 具有管理员权限的 IAM 用户
- AWS CLI 已安装并配置

### 2. 安装 AWS CLI

```bash
# macOS
brew install awscli

# Linux
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Windows
# 下载并安装 MSI 安装程序
```

### 3. 配置 AWS 凭证

```bash
aws configure
```

输入以下信息：
- AWS Access Key ID
- AWS Secret Access Key
- Default region (建议: ap-southeast-1)
- Default output format (建议: json)

验证配置：
```bash
aws sts get-caller-identity
```

应该返回你的账户信息。

### 4. 安装项目依赖

```bash
npm install
```

## 首次部署

### 步骤 1: 配置 AWS 凭证

确保 AWS CLI 已正确配置（见前置要求）。

### 步骤 2: 部署到开发环境

```bash
npm run deploy:dev
```

Serverless Framework 会：
1. 打包 Lambda 函数（使用 esbuild）
2. 创建 DynamoDB 表
3. 创建 Lambda 函数
4. 创建 API Gateway
5. 配置 IAM 角色和权限

**部署成功后，会显示：**
```
✔ Service deployed to stack personasim-backend-dev (123s)

endpoint: https://xxxxx.execute-api.ap-southeast-1.amazonaws.com
functions:
  healthCheck: personasim-backend-dev-healthCheck (1.2 MB)
  createUser: personasim-backend-dev-createUser (1.2 MB)
  getUser: personasim-backend-dev-getUser (1.2 MB)
  listUsers: personasim-backend-dev-listUsers (1.2 MB)
  updateUser: personasim-backend-dev-updateUser (1.2 MB)
  deleteUser: personasim-backend-dev-deleteUser (1.2 MB)
```

**记录 API 端点 URL** - 这是你的 API 访问地址。

### 步骤 3: 测试部署

```bash
# 测试健康检查端点
curl https://xxxxx.execute-api.ap-southeast-1.amazonaws.com/health
```

预期响应：
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "service": "PersonaSim Backend",
    ...
  }
}
```

## 更新部署

当你修改代码后：

```bash
# 部署更新（默认 dev 环境）
npm run deploy

# 或指定环境
npm run deploy:dev
```

Serverless Framework 会自动：
- 检测变更
- 仅更新修改的资源
- 保持数据不变（如 DynamoDB 表）

## 多环境部署

### 开发环境

```bash
npm run deploy:dev
```

或

```bash
serverless deploy --stage dev
```

### 测试/预发布环境

```bash
npm run deploy:staging
```

### 生产环境

```bash
npm run deploy:prod
```

**注意：** 生产环境会启用额外的保护：
- DynamoDB 时间点恢复
- 表删除保护（DeletionPolicy: Retain）
- INFO 级别日志

### 查看部署信息

```bash
# 查看当前环境信息
npm run info

# 查看特定环境
serverless info --stage prod
```

输出包括：
- API 端点 URL
- Lambda 函数列表
- CloudFormation 栈名称
- 资源信息

## CI/CD 部署

项目包含 GitHub Actions 配置，实现自动化部署。

### 设置 GitHub Secrets

在你的 GitHub 仓库中，添加以下 Secrets：

1. 进入 **Settings** → **Secrets and variables** → **Actions**
2. 添加以下 secrets：
   - `AWS_ACCESS_KEY_ID`: AWS 访问密钥 ID
   - `AWS_SECRET_ACCESS_KEY`: AWS 访问密钥

### 自动部署流程

**开发环境** (自动部署)
- Push 到 `develop` 分支
- 触发测试和部署流程
- 部署到开发环境 (stage: dev)

**生产环境** (自动部署)
- Push 到 `main` 分支
- 触发测试和部署流程
- 部署到生产环境 (stage: prod)

### GitHub Actions 工作流

工作流程：
1. 运行测试
2. 类型检查
3. 代码检查
4. 部署到对应环境

## 管理已部署的资源

### 查看函数日志

```bash
# 查看特定函数的日志
npm run logs -- -f createUser

# 指定环境
npm run logs -- -f createUser --stage prod

# 实时查看日志（tail）
npm run logs -- -f createUser --tail

# 查看最近 30 分钟的日志
npm run logs -- -f createUser --startTime 30m
```

### 调用函数

```bash
# 远程调用函数
npm run invoke -- -f createUser --data '{"body":"{\"email\":\"test@example.com\",\"name\":\"测试\"}"}'

# 指定环境
serverless invoke -f createUser --stage prod --data '{"body":"{...}"}'
```

### 删除部署

⚠️ **警告：这将删除所有资源和数据！**

```bash
# 删除开发环境
npm run remove:dev

# 删除生产环境
npm run remove:prod

# 或使用 serverless 命令
serverless remove --stage dev
```

## 故障排查

### 常见问题

#### 1. AWS 凭证未配置

**错误:**
```
Error: The security token included in the request is invalid
```

**解决:**
```bash
aws configure
# 重新配置 AWS 凭证
```

#### 2. 权限不足

**错误:**
```
User: arn:aws:iam::xxx:user/xxx is not authorized to perform: cloudformation:CreateStack
```

**解决:**
确保 IAM 用户有以下权限：
- CloudFormation
- Lambda
- API Gateway
- DynamoDB
- IAM
- S3
- CloudWatch

或使用管理员账户。

#### 3. 部署超时

**错误:**
```
Deployment took too long
```

**解决:**
- 检查网络连接
- 增加超时时间：`serverless deploy --stage dev --timeout 600`
- 检查 AWS 服务状态

#### 4. Lambda 打包错误

**错误:**
```
Cannot find module 'xxx'
```

**解决:**
```bash
# 清理并重新安装
rm -rf node_modules .serverless
npm install
npm run deploy
```

#### 5. DynamoDB 表已存在

**错误:**
```
Table already exists: personasim-backend-users-dev
```

**解决方案：**

a) 使用不同的 stage 名称
```bash
serverless deploy --stage dev2
```

b) 或删除现有表（⚠️ 会丢失数据）
```bash
aws dynamodb delete-table --table-name personasim-backend-users-dev
```

### 查看部署日志

```bash
# 查看 Serverless 详细日志
serverless deploy --stage dev --verbose

# 查看 CloudFormation 事件
aws cloudformation describe-stack-events \
  --stack-name personasim-backend-dev \
  --max-items 20
```

## 回滚

### 方法 1: 使用 Git 回滚代码

```bash
# 查看提交历史
git log --oneline

# 回滚到特定提交
git checkout <commit-hash>

# 重新部署
npm run deploy:dev
```

### 方法 2: 重新部署旧版本

```bash
# 切换到旧版本的 Git 分支/标签
git checkout v1.0.0

# 重新部署
npm run deploy:prod
```

### 方法 3: 使用 CloudFormation 控制台

1. 打开 AWS CloudFormation 控制台
2. 找到栈 `personasim-backend-{stage}`
3. 查看之前的版本
4. 手动回滚（AWS 支持栈回滚）

## 监控和日志

### CloudWatch 日志

查看 Lambda 函数日志：

```bash
# 使用 Serverless CLI
npm run logs -- -f createUser --tail

# 使用 AWS CLI
aws logs tail /aws/lambda/personasim-backend-dev-createUser --follow

# 或在 AWS Console 查看
# CloudWatch → Log groups → /aws/lambda/personasim-backend-*
```

### CloudWatch 指标

在 AWS Console 查看：
- Lambda → 函数 → 监控
- API Gateway → API → 监控
- DynamoDB → 表 → 指标

关键指标：
- Lambda 调用次数
- Lambda 错误率
- Lambda 持续时间
- API Gateway 延迟
- API Gateway 4XX/5XX 错误
- DynamoDB 读/写容量单位

### X-Ray 追踪

项目已启用 X-Ray 追踪，可以在 AWS Console 查看：

```
X-Ray → 服务映射 / 追踪
```

查看：
- 端到端请求追踪
- 服务依赖关系图
- 性能瓶颈分析

### 设置告警

使用 AWS CloudWatch 告警：

```bash
# Lambda 错误率告警
aws cloudwatch put-metric-alarm \
  --alarm-name personasim-lambda-errors-dev \
  --alarm-description "Lambda 错误率过高" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=personasim-backend-dev-createUser
```

## 成本估算

基于 AWS Free Tier：

| 服务 | 免费额度 | 估计成本 (超出后) |
|------|----------|------------------|
| Lambda | 100 万次请求/月 | $0.20/百万请求 |
| API Gateway HTTP API | 100 万次请求/月 | $1.00/百万请求 |
| DynamoDB | 25 GB 存储 | $0.25/GB/月 |
| CloudWatch | 5 GB 日志 | $0.50/GB |

**典型月度成本：**
- 低流量 (< 10 万请求): $0-5
- 中流量 (< 100 万请求): $5-20
- 高流量 (> 100 万请求): $20+

**查看实际成本：**
```bash
# 使用 AWS Cost Explorer
aws ce get-cost-and-usage \
  --time-period Start=2025-01-01,End=2025-01-31 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=SERVICE
```

## 最佳实践

### 1. 使用不同账户/区域隔离环境

```bash
# 开发环境
export AWS_PROFILE=dev
export AWS_REGION=ap-southeast-1

# 生产环境
export AWS_PROFILE=prod
export AWS_REGION=us-west-2
```

然后部署：
```bash
serverless deploy --stage prod
```

### 2. 定期备份

DynamoDB 按需备份：
```bash
aws dynamodb create-backup \
  --table-name personasim-backend-users-prod \
  --backup-name personasim-users-backup-$(date +%Y%m%d)
```

### 3. 监控成本

启用 AWS Cost Explorer 和预算告警：

```bash
# 创建预算
aws budgets create-budget \
  --account-id YOUR_ACCOUNT_ID \
  --budget file://budget.json
```

### 4. 安全检查

- 定期更新依赖：`npm audit`
- 使用最小权限原则配置 IAM
- 启用 AWS CloudTrail 审计
- 定期审查 IAM 策略

### 5. 性能优化

- 使用 ARM64 架构（成本更低）
- 调整 Lambda 内存大小以优化性能
- 启用 DynamoDB 自动扩缩容
- 使用 CloudFront CDN（如需要）

---

## 快速命令参考

```bash
# 部署
npm run deploy              # 部署（默认 dev）
npm run deploy:dev          # 部署到开发环境
npm run deploy:prod         # 部署到生产环境

# 查看信息
npm run info                # 查看部署信息
serverless info --stage prod

# 日志
npm run logs -- -f createUser         # 查看日志
npm run logs -- -f createUser --tail  # 实时日志

# 调用函数
npm run invoke -- -f createUser --data '{...}'

# 删除
npm run remove:dev          # 删除开发环境
npm run remove:prod         # 删除生产环境
```

---

如有问题，请查看 [README](../README.md) 或创建 Issue。
