# API 详细文档

本文档详细说明了 PersonaSim Backend 的所有 API 端点。

## 通用说明

### 请求格式

所有请求必须包含以下头部：

```
Content-Type: application/json
```

### 响应格式

所有响应都遵循统一的 JSON 格式：

**成功响应:**
```json
{
  "success": true,
  "data": { /* 响应数据 */ },
  "meta": {
    "timestamp": "2025-01-15T10:00:00Z",
    // 其他元数据
  }
}
```

**错误响应:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": { /* 错误详情 */ }
  },
  "meta": {
    "timestamp": "2025-01-15T10:00:00Z"
  }
}
```

### HTTP 状态码

- `200 OK` - 请求成功
- `201 Created` - 资源创建成功
- `400 Bad Request` - 请求参数错误
- `404 Not Found` - 资源未找到
- `409 Conflict` - 资源冲突
- `500 Internal Server Error` - 服务器错误

---

## 端点详情

### 1. 健康检查

检查服务状态。

**端点:** `GET /health`

**请求示例:**
```bash
curl -X GET https://your-api.execute-api.us-east-1.amazonaws.com/health
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "service": "PersonaSim Backend",
    "timestamp": "2025-01-15T10:00:00Z",
    "version": "1.0.0",
    "environment": "dev",
    "region": "us-east-1"
  },
  "meta": {
    "timestamp": "2025-01-15T10:00:00Z"
  }
}
```

---

### 2. 创建用户

创建新用户。

**端点:** `POST /users`

**请求体:**
```json
{
  "email": "user@example.com",     // 必填，邮箱格式
  "name": "张三",                   // 必填，2-100 字符
  "metadata": {                     // 可选
    "role": "admin",
    "department": "IT"
  }
}
```

**字段验证:**
- `email`: 必须是有效的邮箱格式，5-255 字符
- `name`: 2-100 字符，只能包含中文、英文和空格
- `metadata`: 可选的自定义数据对象

**请求示例:**
```bash
curl -X POST https://your-api.execute-api.us-east-1.amazonaws.com/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "zhangsan@example.com",
    "name": "张三",
    "metadata": {
      "role": "admin"
    }
  }'
```

**成功响应 (201):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "zhangsan@example.com",
    "name": "张三",
    "status": "active",
    "createdAt": "2025-01-15T10:00:00Z",
    "updatedAt": "2025-01-15T10:00:00Z",
    "metadata": {
      "role": "admin"
    }
  },
  "meta": {
    "timestamp": "2025-01-15T10:00:00Z"
  }
}
```

**错误响应示例:**

验证失败 (400):
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "数据验证失败",
    "details": [
      {
        "path": ["email"],
        "message": "无效的邮箱地址"
      }
    ]
  }
}
```

邮箱已存在 (409):
```json
{
  "success": false,
  "error": {
    "code": "ALREADY_EXISTS",
    "message": "该邮箱已被注册"
  }
}
```

---

### 3. 获取用户详情

根据用户 ID 获取用户信息。

**端点:** `GET /users/{id}`

**路径参数:**
- `id`: 用户 UUID

**请求示例:**
```bash
curl -X GET https://your-api.execute-api.us-east-1.amazonaws.com/users/550e8400-e29b-41d4-a716-446655440000
```

**成功响应 (200):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "zhangsan@example.com",
    "name": "张三",
    "status": "active",
    "createdAt": "2025-01-15T10:00:00Z",
    "updatedAt": "2025-01-15T10:00:00Z",
    "metadata": {
      "role": "admin"
    }
  }
}
```

**错误响应 (404):**
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

### 4. 列出用户

获取用户列表，支持分页和过滤。

**端点:** `GET /users`

**查询参数:**
| 参数 | 类型 | 必填 | 说明 | 默认值 |
|------|------|------|------|--------|
| `status` | string | 否 | 用户状态过滤 (active/inactive/suspended) | - |
| `limit` | number | 否 | 每页数量 (1-100) | 20 |
| `page` | number | 否 | 页码 (从 1 开始) | 1 |
| `nextToken` | string | 否 | 分页令牌 | - |

**请求示例:**
```bash
# 获取所有活跃用户
curl -X GET 'https://your-api.execute-api.us-east-1.amazonaws.com/users?status=active&limit=10'

# 使用分页令牌
curl -X GET 'https://your-api.execute-api.us-east-1.amazonaws.com/users?nextToken=eyJpZCI6IjEyMyJ9'
```

**成功响应 (200):**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "email": "zhangsan@example.com",
        "name": "张三",
        "status": "active",
        "createdAt": "2025-01-15T10:00:00Z",
        "updatedAt": "2025-01-15T10:00:00Z"
      }
      // ... 更多用户
    ],
    "nextToken": "eyJpZCI6IjEyMyIsImNyZWF0ZWRBdCI6IjIwMjUtMDEtMTVUMTA6MDA6MDBaIn0="
  },
  "meta": {
    "limit": 10,
    "total": 150,
    "timestamp": "2025-01-15T10:00:00Z"
  }
}
```

---

### 5. 更新用户

更新用户信息（部分更新）。

**端点:** `PUT /users/{id}`

**路径参数:**
- `id`: 用户 UUID

**请求体:**
```json
{
  "name": "李四",                   // 可选
  "status": "inactive",             // 可选: active/inactive/suspended
  "metadata": {                     // 可选
    "role": "user"
  }
}
```

**请求示例:**
```bash
curl -X PUT https://your-api.execute-api.us-east-1.amazonaws.com/users/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "李四",
    "status": "inactive"
  }'
```

**成功响应 (200):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "zhangsan@example.com",
    "name": "李四",
    "status": "inactive",
    "createdAt": "2025-01-15T10:00:00Z",
    "updatedAt": "2025-01-15T11:00:00Z",
    "metadata": {
      "role": "user"
    }
  }
}
```

**错误响应 (404):**
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

### 6. 删除用户

删除指定用户。

**端点:** `DELETE /users/{id}`

**路径参数:**
- `id`: 用户 UUID

**请求示例:**
```bash
curl -X DELETE https://your-api.execute-api.us-east-1.amazonaws.com/users/550e8400-e29b-41d4-a716-446655440000
```

**成功响应 (200):**
```json
{
  "success": true,
  "data": {
    "message": "用户已删除",
    "userId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**错误响应 (404):**
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

## 错误码参考

| 错误码 | HTTP 状态码 | 说明 |
|--------|-------------|------|
| `VALIDATION_ERROR` | 400 | 请求数据验证失败 |
| `BAD_REQUEST` | 400 | 请求格式错误 |
| `UNAUTHORIZED` | 401 | 未授权 |
| `FORBIDDEN` | 403 | 禁止访问 |
| `NOT_FOUND` | 404 | 资源未找到 |
| `ALREADY_EXISTS` | 409 | 资源已存在 |
| `INTERNAL_ERROR` | 500 | 内部服务器错误 |

---

## 使用限制

- 请求频率限制：暂无（AWS API Gateway 默认限制）
- 响应体最大大小：6 MB (Lambda 限制)
- 请求超时：30 秒

---

## 示例代码

### JavaScript/TypeScript

```typescript
// 创建用户
const createUser = async (email: string, name: string) => {
  const response = await fetch('https://your-api/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, name }),
  });

  const data = await response.json();
  return data;
};

// 获取用户列表
const listUsers = async (status?: string) => {
  const params = new URLSearchParams();
  if (status) params.append('status', status);

  const response = await fetch(`https://your-api/users?${params}`);
  const data = await response.json();
  return data;
};
```

### Python

```python
import requests

# 创建用户
def create_user(email, name):
    response = requests.post(
        'https://your-api/users',
        json={'email': email, 'name': name}
    )
    return response.json()

# 获取用户列表
def list_users(status=None):
    params = {'status': status} if status else {}
    response = requests.get('https://your-api/users', params=params)
    return response.json()
```

---

如有疑问，请查看主 [README](../README.md) 或创建 Issue。
