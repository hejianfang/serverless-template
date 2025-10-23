# PersonaSim API 接口文档

## 📋 目录

- [概述](#概述)
- [基础信息](#基础信息)
- [认证](#认证)
- [Sessions 接口](#sessions-接口)
  - [获取上传 URL](#1-获取上传-url)
  - [触发分析](#2-触发分析)
  - [获取会话列表](#3-获取会话列表)
  - [获取会话详情](#4-获取会话详情)
- [Users 接口](#users-接口)
  - [获取用户列表](#5-获取用户列表)
  - [获取用户详情](#6-获取用户详情)
- [Health Check](#health-check)
- [错误处理](#错误处理)
- [完整使用示例](#完整使用示例)

---

## 概述

PersonaSim 后端提供了一套完整的 REST API，用于分析小红书内容并模拟 30 个固定用户的行为反应。

核心功能：
- ✅ S3 预签名 URL 上传（高效、安全）
- ✅ 基于 30 个固定人设的 AI 行为分析
- ✅ 会话管理和查询
- ✅ 用户行为详情查看

---

## 基础信息

### Base URL

```
开发环境: https://{api-id}.execute-api.ap-southeast-1.amazonaws.com
生产环境: https://{api-id}.execute-api.ap-southeast-1.amazonaws.com
```

部署后通过 CloudFormation 输出获取实际 URL：
```bash
serverless info
```

### 请求格式

- **Content-Type**: `application/json`
- **响应格式**: JSON

### 通用响应格式

**成功响应**:
```json
{
  "success": true,
  "data": { /* 返回数据 */ }
}
```

**错误响应**:
```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "错误描述"
  }
}
```

---

## 认证

当前版本暂无认证机制（开发阶段），API 公开访问。

生产环境建议添加：
- API Key 认证
- IAM 认证
- JWT Token

---

## Sessions 接口

### 1. 获取上传 URL

生成 S3 预签名上传 URL，用于前端直接上传图片。

**请求**:
```http
POST /sessions/upload-url
Content-Type: application/json

{
  "fileName": "content.jpg",      // 可选，默认 "content.jpg"
  "contentType": "image/jpeg"     // 可选，默认 "image/jpeg"
}
```

**请求参数**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| fileName | string | 否 | 文件名，默认 "content.jpg" |
| contentType | string | 否 | MIME 类型，支持 image/jpeg, image/png, image/webp |

**响应**:
```json
{
  "success": true,
  "data": {
    "sessionId": "2025-10-23-abc123",
    "uploadUrl": "https://personasim-content-dev.s3.ap-southeast-1.amazonaws.com/...",
    "objectKey": "sessions/2025-10-23-abc123/1729662000000.jpg",
    "expiresIn": 300,
    "message": "请在 300 秒内使用 PUT 方法上传图片到 uploadUrl"
  }
}
```

**响应字段**:

| 字段 | 类型 | 说明 |
|------|------|------|
| sessionId | string | 会话 ID，用于后续调用 |
| uploadUrl | string | S3 预签名上传 URL（5 分钟有效） |
| objectKey | string | S3 对象键，用于触发分析 |
| expiresIn | number | URL 有效期（秒） |

**前端上传示例**:
```javascript
// 1. 获取上传 URL
const response = await fetch('/sessions/upload-url', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fileName: file.name,
    contentType: file.type,
  }),
});

const { data } = await response.json();
const { sessionId, uploadUrl, objectKey } = data;

// 2. 直接上传到 S3
await fetch(uploadUrl, {
  method: 'PUT',
  body: file,
  headers: { 'Content-Type': file.type },
});

// 3. 继续调用分析接口...
```

---

### 2. 触发分析

上传图片后，触发 AI 分析生成 30 个用户的行为数据。

**请求**:
```http
POST /sessions/analyze
Content-Type: application/json

{
  "sessionId": "2025-10-23-abc123",
  "objectKey": "sessions/2025-10-23-abc123/1729662000000.jpg",
  "contentTitle": "春季新品发布"  // 可选
}
```

**请求参数**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| sessionId | string | 是 | 从 `/upload-url` 获取的会话 ID |
| objectKey | string | 是 | 从 `/upload-url` 获取的对象键 |
| contentTitle | string | 否 | 内容标题，用于 AI 分析 |

**响应**:
```json
{
  "success": true,
  "data": {
    "sessionId": "2025-10-23-abc123",
    "status": "analyzing",
    "message": "分析已开始,请稍后查看结果"
  }
}
```

**分析流程**:
1. 后端验证文件是否存在于 S3
2. 创建 SESSION 实体（状态：analyzing）
3. 异步执行 AI 分析（30 次并发调用）
4. 立即返回响应（不阻塞）
5. 分析完成后更新状态为 completed

**注意事项**:
- 分析是异步的，立即返回 `analyzing` 状态
- 需要轮询 `/sessions/{sessionId}` 查看分析结果
- 分析时长：约 30-60 秒（取决于 AI 响应速度）
- 如果文件不存在，返回 `400 Bad Request`

---

### 3. 获取会话列表

查询所有分析会话，支持按状态筛选和分页。

**请求**:
```http
GET /sessions?status=completed&limit=20&nextToken=abc123
```

**查询参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| status | string | 否 | 筛选状态：analyzing, completed, failed |
| limit | number | 否 | 每页数量，默认 20，最大 100 |
| nextToken | string | 否 | 分页令牌（从上次响应获取） |

**响应**:
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "sessionId": "2025-10-23-abc123",
        "contentUrl": "https://personasim-content-dev.s3...",
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
        "summary": {
          "totalViews": 30,
          "openCount": 20,
          "likeCount": 16,
          "commentCount": 7,
          "purchaseCount": 5,
          "avgBrowseTime": 158
        },
        "createdAt": "2025-10-23T12:00:00.000Z",
        "updatedAt": "2025-10-23T12:01:30.000Z"
      }
    ],
    "nextToken": "xyz789"  // 有更多数据时返回
  }
}
```

**字段说明**:

| 字段 | 说明 |
|------|------|
| metrics.interest | 平均兴趣度 (0-100) |
| metrics.open | 打开率百分比 |
| metrics.like | 点赞率百分比 |
| metrics.comment | 评论率百分比 |
| metrics.purchase | 购买率百分比 |
| summary.avgBrowseTime | 平均浏览时长（秒） |

---

### 4. 获取会话详情

获取单个会话的完整信息，包括所有指标和转化漏斗。

**请求**:
```http
GET /sessions/{sessionId}
```

**路径参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| sessionId | string | 会话 ID |

**响应**:
```json
{
  "success": true,
  "data": {
    "sessionId": "2025-10-23-abc123",
    "contentUrl": "https://personasim-content-dev.s3...",
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
      { "label": "点赞", "value": "54%", "count": 16 },
      { "label": "评论", "value": "23%", "count": 7 },
      { "label": "购买", "value": "18%", "count": 5 }
    ],
    "summary": {
      "totalViews": 30,
      "openCount": 20,
      "likeCount": 16,
      "commentCount": 7,
      "purchaseCount": 5,
      "avgBrowseTime": 158
    },
    "createdAt": "2025-10-23T12:00:00.000Z",
    "updatedAt": "2025-10-23T12:01:30.000Z"
  }
}
```

**状态值**:
- `analyzing`: 正在分析中
- `completed`: 分析完成
- `failed`: 分析失败

---

## Users 接口

### 5. 获取用户列表

获取某个会话的所有用户行为数据。

**请求**:
```http
GET /sessions/{sessionId}/users?status=purchased&limit=30
```

**路径参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| sessionId | string | 会话 ID |

**查询参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| status | string | 否 | 筛选状态：viewed, opened, liked, commented, purchased |
| limit | number | 否 | 每页数量，默认 30 |

**响应**:
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "userId": "001",
        "name": "李华",
        "opened": true,
        "liked": true,
        "commented": false,
        "purchased": false,
        "browseTime": 145,
        "interest": 78,
        "priceRange": "¥20-100",
        "status": "liked",
        "innerMonologue": "这个产品看起来不错，价格有点超预算了。",
        "insights": "大学生用户，对时尚类内容兴趣度高，但购买力有限。",
        "createdAt": "2025-10-23T12:01:15.000Z"
      }
    ]
  }
}
```

**用户字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| userId | string | 用户 ID (001-030) |
| name | string | 用户姓名 |
| opened | boolean | 是否打开内容 |
| liked | boolean | 是否点赞 |
| commented | boolean | 是否评论 |
| purchased | boolean | 是否购买 |
| browseTime | number | 浏览时长（秒） |
| interest | number | 兴趣度 (0-100) |
| priceRange | string | 价格敏感度范围 |
| status | string | 最终状态 |
| innerMonologue | string | 内心独白 |
| insights | string | 用户洞察 |

---

### 6. 获取用户详情

获取单个用户的完整行为数据，包括时间线。

**请求**:
```http
GET /sessions/{sessionId}/users/{userId}
```

**路径参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| sessionId | string | 会话 ID |
| userId | string | 用户 ID (001-030) |

**响应**:
```json
{
  "success": true,
  "data": {
    "userId": "001",
    "name": "李华",
    "opened": true,
    "liked": true,
    "commented": false,
    "purchased": false,
    "browseTime": 145,
    "interest": 78,
    "priceRange": "¥20-100",
    "status": "liked",
    "innerMonologue": "这个产品看起来不错，价格有点超预算了。",
    "timeline": [
      { "time": "0s", "action": "看到内容封面", "active": true },
      { "time": "2s", "action": "点击查看详情", "active": true },
      { "time": "15s", "action": "浏览产品图片", "active": true },
      { "time": "45s", "action": "查看价格", "active": true },
      { "time": "90s", "action": "点赞", "active": true },
      { "time": "145s", "action": "退出内容", "active": false }
    ],
    "insights": "大学生用户，对时尚类内容兴趣度高，但购买力有限。价格是主要购买障碍。",
    "createdAt": "2025-10-23T12:01:15.000Z"
  }
}
```

---

## Health Check

检查 API 健康状态。

**请求**:
```http
GET /health
```

**响应**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-10-23T12:00:00.000Z",
    "version": "1.0.0",
    "region": "ap-southeast-1"
  }
}
```

---

## 错误处理

### 错误代码

| HTTP 状态码 | 错误代码 | 说明 |
|------------|----------|------|
| 400 | BAD_REQUEST | 请求参数错误 |
| 404 | NOT_FOUND | 资源不存在 |
| 500 | INTERNAL_ERROR | 服务器内部错误 |

### 错误响应示例

```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "缺少 sessionId"
  }
}
```

### 常见错误

#### 1. 文件未上传
```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "文件未上传或已过期,请重新获取上传 URL"
  }
}
```
**解决**: 重新调用 `/sessions/upload-url` 获取新的上传 URL

#### 2. 会话不存在
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "会话不存在"
  }
}
```

#### 3. 用户不存在
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "用户不存在"
  }
}
```

---

## 完整使用示例

### React 示例

```typescript
import { useState } from 'react';

const API_BASE_URL = 'https://your-api-id.execute-api.ap-southeast-1.amazonaws.com';

export const usePersonaSim = () => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const analyzeContent = async (file: File, title?: string) => {
    try {
      setLoading(true);
      setProgress(0);

      // 步骤 1: 获取上传 URL (10%)
      const uploadUrlResponse = await fetch(`${API_BASE_URL}/sessions/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
        }),
      });

      const { data: uploadData } = await uploadUrlResponse.json();
      const { sessionId, uploadUrl, objectKey } = uploadData;
      setProgress(10);

      // 步骤 2: 上传到 S3 (40%)
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const uploadProgress = Math.round((e.loaded / e.total) * 30);
          setProgress(10 + uploadProgress); // 10% -> 40%
        }
      });

      await new Promise((resolve, reject) => {
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.onload = () => resolve(xhr.response);
        xhr.onerror = reject;
        xhr.send(file);
      });
      setProgress(40);

      // 步骤 3: 触发分析 (50%)
      const analyzeResponse = await fetch(`${API_BASE_URL}/sessions/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          objectKey,
          contentTitle: title,
        }),
      });

      await analyzeResponse.json();
      setProgress(50);

      // 步骤 4: 轮询结果 (50% -> 100%)
      const pollResult = async (): Promise<any> => {
        const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}`);
        const { data } = await response.json();

        if (data.status === 'completed') {
          setProgress(100);
          return data;
        } else if (data.status === 'failed') {
          throw new Error('分析失败');
        } else {
          // 继续轮询
          setProgress((prev) => Math.min(prev + 5, 95));
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return pollResult();
        }
      };

      const result = await pollResult();
      return result;

    } catch (error) {
      console.error('分析失败:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return { analyzeContent, loading, progress };
};

// 使用示例
const MyComponent = () => {
  const { analyzeContent, loading, progress } = usePersonaSim();

  const handleFileUpload = async (file: File) => {
    const result = await analyzeContent(file, '我的内容');
    console.log('分析结果:', result);
  };

  return (
    <div>
      <input type="file" onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) handleFileUpload(file);
      }} />
      {loading && <div>分析进度: {progress}%</div>}
    </div>
  );
};
```

### JavaScript/Fetch 示例

```javascript
async function analyzeContent(file, title) {
  // 1. 获取上传 URL
  const uploadUrlRes = await fetch('/sessions/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
    }),
  });

  const { data: uploadData } = await uploadUrlRes.json();
  const { sessionId, uploadUrl, objectKey } = uploadData;

  // 2. 上传到 S3
  await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  });

  // 3. 触发分析
  await fetch('/sessions/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, objectKey, contentTitle: title }),
  });

  // 4. 轮询结果
  while (true) {
    const res = await fetch(`/sessions/${sessionId}`);
    const { data } = await res.json();

    if (data.status === 'completed') {
      return data;
    } else if (data.status === 'failed') {
      throw new Error('分析失败');
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}
```

---

## 性能优化建议

### 1. 使用 WebSocket 替代轮询
当前使用轮询查询分析结果，建议未来升级为 WebSocket 实时推送。

### 2. 缓存会话列表
前端可以缓存已完成的会话列表，减少 API 调用。

### 3. 批量查询用户
如果需要多个用户详情，考虑添加批量查询接口。

---

## 版本历史

- **v1.0.0** (2025-10-23)
  - 初始版本
  - 支持 S3 预签名上传
  - 基于 30 个固定人设的 AI 分析
  - 完整的会话和用户管理接口

---

如有问题，请查看 [系统流程文档](./WORKFLOW.md) 或 [部署文档](./DEPLOYMENT.md)。
