# PersonaSim 系统工作流程

## 📋 目录

- [系统架构](#系统架构)
- [核心概念](#核心概念)
- [数据流程](#数据流程)
- [详细流程说明](#详细流程说明)
- [人设分析机制](#人设分析机制)
- [数据库设计](#数据库设计)
- [时序图](#时序图)
- [状态机](#状态机)

---

## 系统架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                           前端应用 (React)                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  图片上传    │  │  分析结果    │  │  用户详情    │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   API Gateway (HTTP API)                             │
│                         CORS 已启用                                  │
└─────────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │  获取上传URL │ │  触发分析   │ │  查询数据   │
    │   Lambda    │ │   Lambda    │ │   Lambda    │
    └─────────────┘ └─────────────┘ └─────────────┘
              │               │               │
              │               │               │
              ▼               ▼               ▼
    ┌─────────────────────────────────────────────────────┐
    │              DynamoDB 单表设计                       │
    │  ┌──────────────┐  ┌──────────────┐                │
    │  │  SESSION 实体 │  │   USER 实体   │                │
    │  └──────────────┘  └──────────────┘                │
    └─────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────┐
    │              S3 存储桶 (图片存储)                    │
    │         sessions/{sessionId}/{timestamp}.jpg         │
    └─────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────┐
    │              AI 服务 (GPT-4)                         │
    │    30 次并发调用 (每个人设一次)                      │
    └─────────────────────────────────────────────────────┘
```

### 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **前端** | React + TypeScript | 用户界面 |
| **API** | AWS API Gateway (HTTP API) | REST API 网关 |
| **计算** | AWS Lambda (Node.js 20) | 无服务器函数 |
| **数据库** | DynamoDB | NoSQL 数据库 |
| **存储** | S3 | 对象存储 |
| **AI** | GPT-4 (通过 chat-api) | 行为预测 |
| **部署** | Serverless Framework 4 | 基础设施即代码 |

---

## 核心概念

### 1. Session (会话)

一次内容分析的完整生命周期：
- **创建**: 用户上传图片时生成
- **分析**: AI 分析 30 个人设的行为
- **完成**: 所有分析结果聚合完成
- **TTL**: 90 天后自动删除

### 2. Persona (人设)

30 个固定的用户画像：
- 来自 `src/config/personas.ts`
- 包含年龄、性别、职业、兴趣、购买力等
- 每个人设独立进行 AI 分析

### 3. User (用户行为)

每个人设对特定内容的行为预测：
- 是否打开、点赞、评论、购买
- 浏览时长、兴趣度
- 内心独白、行为时间线
- 用户洞察

---

## 数据流程

### 完整流程图

```
┌────────────┐
│ 前端上传图片 │
└────────────┘
      │
      ▼
┌────────────────────────────────────────────┐
│ 步骤 1: 获取上传 URL                        │
│ POST /sessions/upload-url                  │
│ ─────────────────────────────────────      │
│ • 生成 sessionId (2025-10-23-abc123)      │
│ • 生成 S3 预签名 URL (5 分钟有效)          │
│ • 返回 uploadUrl + objectKey              │
└────────────────────────────────────────────┘
      │
      ▼
┌────────────────────────────────────────────┐
│ 步骤 2: 前端直接上传到 S3                   │
│ PUT {uploadUrl}                            │
│ ─────────────────────────────────────      │
│ • 使用 PUT 方法上传文件                     │
│ • 不经过 Lambda,直接到 S3                  │
│ • 前端可监控上传进度                        │
└────────────────────────────────────────────┘
      │
      ▼
┌────────────────────────────────────────────┐
│ 步骤 3: 触发分析                            │
│ POST /sessions/analyze                     │
│ ─────────────────────────────────────      │
│ • 验证文件已上传到 S3                       │
│ • 创建 SESSION 实体 (status: analyzing)   │
│ • 异步启动 AI 分析                         │
│ • 立即返回响应 (不阻塞)                     │
└────────────────────────────────────────────┘
      │
      ▼
┌────────────────────────────────────────────┐
│ 后台分析 (异步执行)                         │
│ ─────────────────────────────────────      │
│ 1. 加载 30 个固定人设                      │
│ 2. 并发调用 AI (每次 5 个)                 │
│    └─ 每个人设单独分析一次                  │
│ 3. 收集所有结果                            │
│ 4. 聚合指标、漏斗、摘要                     │
│ 5. 批量写入 DynamoDB                       │
│ 6. 更新 SESSION 状态为 completed          │
└────────────────────────────────────────────┘
      │
      ▼
┌────────────────────────────────────────────┐
│ 步骤 4: 轮询结果                            │
│ GET /sessions/{sessionId}                  │
│ ─────────────────────────────────────      │
│ • 每 2 秒查询一次                           │
│ • status = analyzing: 继续轮询             │
│ • status = completed: 显示结果             │
│ • status = failed: 显示错误                │
└────────────────────────────────────────────┘
      │
      ▼
┌────────────────────────────────────────────┐
│ 步骤 5: 查看详情                            │
│ GET /sessions/{sessionId}/users            │
│ GET /sessions/{sessionId}/users/{userId}   │
│ ─────────────────────────────────────      │
│ • 查看 30 个用户列表                        │
│ • 查看单个用户详细行为                      │
│ • 包含时间线、洞察等                        │
└────────────────────────────────────────────┘
```

---

## 详细流程说明

### 阶段 1: 获取上传 URL

**触发**: 用户选择图片后

**Lambda 函数**: `getUploadUrl`

**处理流程**:
```javascript
1. 生成唯一 sessionId
   格式: YYYY-MM-DD-{6位随机字符}
   示例: 2025-10-23-abc123

2. 构建 S3 对象键
   格式: sessions/{sessionId}/{timestamp}.{ext}
   示例: sessions/2025-10-23-abc123/1729662000000.jpg

3. 生成 S3 预签名 URL
   - 方法: PUT
   - 有效期: 5 分钟 (300 秒)
   - 权限: 仅上传,不可读取/删除

4. 返回响应
   - sessionId: 用于后续调用
   - uploadUrl: 前端上传地址
   - objectKey: S3 对象键
   - expiresIn: 有效期
```

**关键代码** (src/functions/sessions/get-upload-url.ts:19-22):
```typescript
function generateSessionId(): string {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const random = Math.random().toString(36).substring(2, 8);
  return `${date}-${random}`;
}
```

---

### 阶段 2: 上传图片到 S3

**触发**: 前端收到 uploadUrl 后

**执行者**: 前端浏览器

**处理流程**:
```javascript
1. 前端使用 PUT 方法上传
   fetch(uploadUrl, {
     method: 'PUT',
     body: file,
     headers: { 'Content-Type': file.type }
   })

2. 直接上传到 S3
   - 不经过 Lambda
   - 节省 Lambda 执行时间
   - 支持大文件 (最大 5GB)

3. S3 验证预签名 URL
   - 检查签名是否有效
   - 检查是否过期
   - 检查权限

4. 上传成功
   - 文件存储在 S3
   - 前端继续调用分析接口
```

**优势**:
- ✅ **性能**: 上传速度快,不受 Lambda 超时限制
- ✅ **成本**: 不占用 Lambda 带宽配额
- ✅ **体验**: 前端可显示上传进度

---

### 阶段 3: 触发 AI 分析

**触发**: 图片上传完成后

**Lambda 函数**: `analyzeSession`

**处理流程**:

```javascript
1. 验证请求参数
   - sessionId: 必须
   - objectKey: 必须
   - contentTitle: 可选

2. 验证文件存在
   await checkObjectExists(objectKey)
   - 如果不存在: 返回 400 错误
   - 如果存在: 继续

3. 创建 SESSION 实体
   - PK: SESSION#{sessionId}
   - SK: METADATA
   - status: analyzing
   - 初始化 metrics, summary

4. 异步启动分析
   analyzeInBackground(sessionId, contentUrl, contentTitle)
   - 不等待完成
   - 在后台执行
   - 立即返回响应

5. 返回响应
   {
     sessionId,
     status: 'analyzing',
     message: '分析已开始,请稍后查看结果'
   }
```

**关键代码** (src/functions/sessions/analyze.ts:41-46):
```typescript
// 1. 验证文件已上传
const exists = await checkObjectExists(objectKey);
if (!exists) {
  return apiError.badRequest('文件未上传或已过期,请重新获取上传 URL');
}
```

---

### 阶段 4: AI 分析 (后台异步执行)

**触发**: analyzeInBackground() 函数

**处理流程**:

```javascript
┌─────────────────────────────────────────┐
│ 1. 加载 30 个固定人设                    │
│    const personas = getPersonas()       │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│ 2. 并发分析 (p-limit 控制并发数为 5)     │
│    ┌───────────────────────────────┐   │
│    │  批次 1: 人设 001-005         │   │
│    │  批次 2: 人设 006-010         │   │
│    │  批次 3: 人设 011-015         │   │
│    │  批次 4: 人设 016-020         │   │
│    │  批次 5: 人设 021-025         │   │
│    │  批次 6: 人设 026-030         │   │
│    └───────────────────────────────┘   │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│ 3. 每个人设的分析流程                    │
│    ┌───────────────────────────────┐   │
│    │ 3.1 构建 Prompt               │   │
│    │  - 内容 URL                   │   │
│    │  - 内容标题                    │   │
│    │  - 人设详细信息                │   │
│    │                               │   │
│    │ 3.2 调用 AI                   │   │
│    │  - 模型: GPT-4                │   │
│    │  - 温度: 0.8                  │   │
│    │  - maxTokens: 1000            │   │
│    │                               │   │
│    │ 3.3 解析响应                  │   │
│    │  - 提取 JSON                  │   │
│    │  - 验证字段                    │   │
│    │  - 填充默认值                  │   │
│    └───────────────────────────────┘   │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│ 4. 聚合所有结果                          │
│    • 统计打开/点赞/评论/购买数量          │
│    • 计算平均兴趣度                      │
│    • 计算平均浏览时长                     │
│    • 生成转化漏斗                        │
│    • 生成摘要                            │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│ 5. 批量写入 DynamoDB                    │
│    • 30 个 USER 实体                    │
│    • 每个包含完整行为数据                 │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│ 6. 更新 SESSION 状态                    │
│    • status: completed                  │
│    • metrics: 聚合指标                  │
│    • journeySteps: 转化漏斗             │
│    • summary: 统计摘要                  │
└─────────────────────────────────────────┘
```

**关键代码** (src/services/ai-analyzer.ts:26-61):
```typescript
export async function analyzeContent(
  contentUrl: string,
  contentTitle?: string
): Promise<AnalysisResult> {
  // 获取 30 个固定人设
  const personas = getPersonas();

  // 并发限制 (同时最多 5 个请求)
  const limit = pLimit(5);

  // 为每个人设单独调用 AI 分析
  const userBehaviors = await Promise.all(
    personas.map((persona) =>
      limit(() => analyzePersonaBehavior(contentUrl, contentTitle, persona))
    )
  );

  // 聚合结果
  const result = aggregateResults(userBehaviors);

  return result;
}
```

---

## 人设分析机制

### 人设配置

**文件**: `src/config/personas.ts`

**结构**:
```typescript
interface Persona {
  userId: string;         // "001" - "030"
  name: string;           // 真实中文姓名
  age: number;            // 年龄
  gender: 'male' | 'female';
  occupation: string;     // 职业
  interests: string[];    // 兴趣爱好
  personality: string;    // 性格特征
  purchasingPower: 'low' | 'medium' | 'high';
  priceRange: string;     // 价格敏感度
  lifestyle: string;      // 生活方式
  socialBehavior: string; // 社交习惯
}
```

**示例**:
```typescript
{
  userId: '001',
  name: '李华',
  age: 22,
  gender: 'female',
  occupation: '大学生',
  interests: ['美妆', '时尚', '追星'],
  personality: '外向、追求新鲜事物、冲动消费',
  purchasingPower: 'low',
  priceRange: '¥20-100',
  lifestyle: '校园生活，喜欢社交',
  socialBehavior: '高频互动，爱分享',
}
```

### AI Prompt 构建

**函数**: `buildPersonaPrompt()`

**Prompt 模板**:
```markdown
请分析这个小红书内容,预测以下用户的行为。

## 内容信息:
- 图片 URL: {contentUrl}
- 标题: {contentTitle}

## 用户人设:
- 姓名: {persona.name}
- 年龄: {persona.age}岁
- 性别: {persona.gender}
- 职业: {persona.occupation}
- 兴趣爱好: {persona.interests}
- 性格特征: {persona.personality}
- 购买力: {persona.purchasingPower}
- 价格敏感度: {persona.priceRange}
- 生活方式: {persona.lifestyle}
- 社交习惯: {persona.socialBehavior}

## 任务:
根据用户人设和内容,预测该用户的行为,包括:
1. 是否打开 (opened)
2. 是否点赞 (liked)
3. 是否评论 (commented)
4. 是否购买 (purchased)
5. 浏览时长 (browseTime: 0-600秒)
6. 兴趣度 (interest: 0-100)
7. 最终状态 (status)
8. 内心独白 (innerMonologue)
9. 行为时间线 (timeline)
10. 用户洞察 (insights)

请返回 JSON 格式...
```

### AI 响应解析

**函数**: `parsePersonaBehavior()`

**处理逻辑**:
```javascript
1. 提取 JSON 内容
   - 支持 ```json ... ``` 代码块
   - 支持纯 JSON

2. 解析 JSON
   const parsed = JSON.parse(jsonContent)

3. 构建完整用户行为
   - 填充人设信息 (userId, name, priceRange)
   - 填充 AI 预测结果
   - 添加创建时间

4. 错误处理
   - 如果解析失败: 调用 generateDefaultPersonaBehavior()
   - 返回基于人设特征的默认行为
```

### 结果聚合

**函数**: `aggregateResults()`

**聚合指标**:
```javascript
1. 统计数量
   - openCount: 打开人数
   - likeCount: 点赞人数
   - commentCount: 评论人数
   - purchaseCount: 购买人数

2. 计算平均值
   - avgBrowseTime: 平均浏览时长
   - avgInterest: 平均兴趣度

3. 生成百分比指标
   metrics = {
     interest: avgInterest,
     open: Math.floor((openCount / 30) * 100),
     like: Math.floor((likeCount / 30) * 100),
     comment: Math.floor((commentCount / 30) * 100),
     purchase: Math.floor((purchaseCount / 30) * 100),
   }

4. 构建转化漏斗
   journeySteps = [
     { label: '浏览', value: '100%', count: 30 },
     { label: '打开', value: '67%', count: 20 },
     { label: '点赞', value: '54%', count: 16 },
     { label: '评论', value: '23%', count: 7 },
     { label: '购买', value: '18%', count: 5 }
   ]
```

---

## 数据库设计

### DynamoDB 单表设计

**表名**: `personasim-backend-main-{stage}`

**主键**:
- PK (分区键): String
- SK (排序键): String

**全局二级索引** (GSI-1):
- GSI1PK (分区键): String
- GSI1SK (排序键): String

### 访问模式

| 访问模式 | 索引 | 键条件 |
|---------|------|--------|
| 获取会话详情 | 主表 | PK = SESSION#{sessionId}, SK = METADATA |
| 获取会话的所有用户 | 主表 | PK = SESSION#{sessionId}, SK begins_with USER# |
| 获取特定用户 | 主表 | PK = SESSION#{sessionId}, SK = USER#{userId} |
| 按状态查询会话 | GSI-1 | GSI1PK = SESSIONS, GSI1SK begins_with STATUS#{status} |
| 按状态查询用户 | GSI-1 | GSI1PK = SESSION#{sessionId}, GSI1SK begins_with STATUS#{status} |

### 实体设计

#### SESSION 实体

```javascript
{
  PK: "SESSION#2025-10-23-abc123",
  SK: "METADATA",
  GSI1PK: "SESSIONS",
  GSI1SK: "STATUS#completed#2025-10-23T12:01:30.000Z",
  entityType: "SESSION",
  sessionId: "2025-10-23-abc123",
  contentUrl: "https://personasim-content-dev.s3...",
  contentTitle: "春季新品发布",
  status: "completed",
  totalUsers: 30,
  metrics: {
    interest: 73,
    open: 67,
    like: 54,
    comment: 23,
    purchase: 18
  },
  journeySteps: [
    { label: "浏览", value: "100%", count: 30 },
    { label: "打开", value: "67%", count: 20 },
    // ...
  ],
  summary: {
    totalViews: 30,
    openCount: 20,
    likeCount: 16,
    commentCount: 7,
    purchaseCount: 5,
    avgBrowseTime: 158
  },
  createdAt: "2025-10-23T12:00:00.000Z",
  updatedAt: "2025-10-23T12:01:30.000Z",
  ttl: 1737622800  // 90天后过期
}
```

#### USER 实体

```javascript
{
  PK: "SESSION#2025-10-23-abc123",
  SK: "USER#001",
  GSI1PK: "SESSION#2025-10-23-abc123",
  GSI1SK: "STATUS#liked#001",
  entityType: "USER",
  sessionId: "2025-10-23-abc123",
  userId: "001",
  name: "李华",
  opened: true,
  liked: true,
  commented: false,
  purchased: false,
  browseTime: 145,
  interest: 78,
  priceRange: "¥20-100",
  status: "liked",
  innerMonologue: "这个产品看起来不错，价格有点超预算了。",
  timeline: [
    { time: "0s", action: "看到内容封面", active: true },
    { time: "2s", action: "点击查看详情", active: true },
    // ...
  ],
  insights: "大学生用户，对时尚类内容兴趣度高，但购买力有限。",
  createdAt: "2025-10-23T12:01:15.000Z"
}
```

---

## 时序图

### 完整时序图

```
前端           API Gateway    Lambda           S3         DynamoDB      AI 服务
 │                 │            │              │             │            │
 │                 │            │              │             │            │
 │ 1. 上传图片     │            │              │             │            │
 ├────────────────>│            │              │             │            │
 │                 │ getUploadUrl              │             │            │
 │                 ├───────────>│              │             │            │
 │                 │            │ 生成 sessionId             │            │
 │                 │            │ 生成预签名 URL             │            │
 │                 │<───────────┤              │             │            │
 │<────────────────┤            │              │             │            │
 │ {sessionId, uploadUrl}       │              │             │            │
 │                 │            │              │             │            │
 │ 2. 直接上传到 S3             │              │             │            │
 ├──────────────────────────────┼─────────────>│             │            │
 │<─────────────────────────────┼──────────────┤             │            │
 │ 200 OK          │            │              │             │            │
 │                 │            │              │             │            │
 │ 3. 触发分析     │            │              │             │            │
 ├────────────────>│            │              │             │            │
 │                 │ analyzeSession            │             │            │
 │                 ├───────────>│              │             │            │
 │                 │            │ 验证文件存在  │             │            │
 │                 │            ├─────────────>│             │            │
 │                 │            │<─────────────┤             │            │
 │                 │            │              │             │            │
 │                 │            │ 创建 SESSION (analyzing)   │            │
 │                 │            ├────────────────────────────>│            │
 │                 │<───────────┤              │             │            │
 │<────────────────┤            │              │             │            │
 │ {status: analyzing}          │              │             │            │
 │                 │            │              │             │            │
 │                 │            │ === 后台异步分析 ===        │            │
 │                 │            │              │             │            │
 │                 │            │ 加载 30 个人设              │            │
 │                 │            │              │             │            │
 │                 │            │ 并发分析 (每批 5 个)        │            │
 │                 │            ├───────────────────────────────────────>│
 │                 │            │              │             │ AI 调用 #1 │
 │                 │            │<──────────────────────────────────────┤
 │                 │            ├───────────────────────────────────────>│
 │                 │            │              │             │ AI 调用 #2 │
 │                 │            │<──────────────────────────────────────┤
 │                 │            │              │  ... (30 次)             │
 │                 │            │              │             │            │
 │                 │            │ 聚合结果     │             │            │
 │                 │            │              │             │            │
 │                 │            │ 批量写入 USER 实体          │            │
 │                 │            ├────────────────────────────>│            │
 │                 │            │              │             │            │
 │                 │            │ 更新 SESSION (completed)   │            │
 │                 │            ├────────────────────────────>│            │
 │                 │            │              │             │            │
 │ 4. 轮询结果 (每 2秒)         │              │             │            │
 ├────────────────>│            │              │             │            │
 │                 │ getSession │              │             │            │
 │                 ├───────────>│              │             │            │
 │                 │            │ 查询 SESSION │             │            │
 │                 │            ├────────────────────────────>│            │
 │                 │            │<────────────────────────────┤            │
 │                 │<───────────┤              │             │            │
 │<────────────────┤            │              │             │            │
 │ {status: completed, metrics, ...}           │             │            │
 │                 │            │              │             │            │
```

---

## 状态机

### SESSION 状态转换

```
    ┌──────────┐
    │  START   │
    └────┬─────┘
         │ POST /sessions/analyze
         ▼
   ┌──────────┐
   │analyzing │ ◄─────┐
   └────┬─────┘       │
        │             │ 重试 (失败后)
        │             │
        ├─────────────┤
        │             │
        ▼             │
   AI 分析成功?       │
        │             │
   ┌────┴────┐        │
   │         │        │
  是        否        │
   │         │        │
   ▼         ▼        │
┌─────────┐ ┌──────┐ │
│completed│ │failed│─┘
└─────────┘ └──────┘
   │
   │ TTL: 90 天后
   ▼
┌─────────┐
│ DELETED │
└─────────┘
```

### USER 状态

```
viewed ──> opened ──> liked ──> commented ──> purchased
  │          │         │           │            │
  └──────────┴─────────┴───────────┴────────────┘
              (用户可停留在任何阶段)
```

---

## 性能指标

### 预期性能

| 指标 | 目标值 | 说明 |
|------|--------|------|
| **获取上传 URL** | < 200ms | Lambda 冷启动后 |
| **S3 上传** | 视文件大小 | 前端直连 S3,不受 Lambda 限制 |
| **触发分析响应** | < 500ms | 仅验证文件和创建实体 |
| **AI 分析总时长** | 30-60s | 30 次 AI 调用,每批 5 个 |
| **查询会话** | < 100ms | DynamoDB 查询 |
| **查询用户列表** | < 200ms | DynamoDB 查询 30 条记录 |

### 并发控制

```javascript
// p-limit 控制并发
const limit = pLimit(5);

// 每批最多 5 个并发请求
// 总共 30 次调用 = 6 批
// 每批约 5-10 秒 (AI 响应时间)
// 总计: 30-60 秒
```

### 成本优化

1. **S3 预签名 URL**: 避免 Lambda 处理文件传输
2. **异步分析**: 不阻塞 API 响应,改善用户体验
3. **并发控制**: 避免过多并发导致 AI API 限流
4. **DynamoDB 单表**: 减少查询次数
5. **TTL**: 自动清理过期数据,降低存储成本

---

## 错误处理和重试

### 文件上传失败

```
前端处理:
1. 捕获上传错误
2. 提示用户重试
3. 重新获取上传 URL (可能已过期)
```

### AI 分析失败

```
后台处理:
1. 单个人设失败: 使用 generateDefaultPersonaBehavior()
2. 多个人设失败: 继续处理成功的部分
3. 全部失败: 更新 SESSION 状态为 failed
```

### DynamoDB 写入失败

```
后台处理:
1. 使用 batchPutItems 批量写入
2. 自动重试 (AWS SDK 内置)
3. 失败后更新 SESSION 状态为 failed
```

---

## 监控和日志

### CloudWatch 日志

```javascript
// 所有 Lambda 函数自动记录日志
logger.info('开始 AI 分析', { sessionId, contentUrl });
logger.debug('人设分析完成', { userId, status });
logger.error('AI 分析失败', { error, sessionId });
```

### X-Ray 追踪

```yaml
# serverless.yml
provider:
  tracing:
    lambda: true
    apiGateway: true
```

**追踪内容**:
- API Gateway 请求
- Lambda 执行时间
- DynamoDB 查询
- S3 操作
- 外部 API 调用 (AI 服务)

### 关键指标

1. **API 响应时间**: CloudWatch Metrics
2. **Lambda 错误率**: CloudWatch Alarms
3. **DynamoDB 读写容量**: CloudWatch Metrics
4. **S3 上传成功率**: CloudWatch Logs Insights
5. **AI 调用成功率**: 自定义日志分析

---

## 扩展性考虑

### 未来优化方向

1. **WebSocket 实时推送**
   - 替代轮询,实时通知分析结果
   - 使用 AWS AppSync 或 API Gateway WebSocket

2. **批量分析**
   - 支持一次上传多张图片
   - 并行处理多个 session

3. **自定义人设**
   - 允许用户创建自定义人设
   - 动态选择分析的人设

4. **结果缓存**
   - 相似内容复用分析结果
   - 使用 ElastiCache 或 DAX

5. **高级分析**
   - 对比不同内容的表现
   - 生成优化建议

---

## 总结

PersonaSim 系统通过以下机制实现高效的用户行为模拟:

✅ **前端直连 S3**: 预签名 URL 上传,高性能
✅ **异步分析**: 不阻塞 API 响应,良好用户体验
✅ **固定人设**: 30 个真实用户画像,结果可靠
✅ **并发控制**: 智能批次处理,平衡速度和成本
✅ **单表设计**: DynamoDB 优化查询性能
✅ **自动清理**: TTL 机制,降低存储成本

系统设计遵循 AWS 最佳实践,具备良好的可扩展性和可维护性。

---

如有问题,请查看:
- [API 接口文档](./API_REFERENCE.md)
- [部署文档](./DEPLOYMENT.md)
- [S3 上传文档](./S3_PRESIGNED_UPLOAD.md)
