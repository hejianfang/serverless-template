# S3 预签名 URL 上传指南

## 📋 概述

PersonaSim 后端使用 S3 预签名 URL 实现高效的图片上传流程,前端直接上传到 S3,不经过后端中转。

## 🔄 上传流程

### 步骤 1: 获取上传 URL

**请求:**
```http
POST /sessions/upload-url
Content-Type: application/json

{
  "fileName": "content.jpg",      // 可选,默认 "content.jpg"
  "contentType": "image/jpeg"      // 可选,默认 "image/jpeg"
}
```

**响应:**
```json
{
  "success": true,
  "data": {
    "sessionId": "2025-01-23-abc123",
    "uploadUrl": "https://personasim-content-dev.s3.ap-southeast-1.amazonaws.com/sessions/...",
    "objectKey": "sessions/2025-01-23-abc123/1737622800000.jpg",
    "expiresIn": 300,
    "message": "请在 300 秒内使用 PUT 方法上传图片到 uploadUrl"
  }
}
```

### 步骤 2: 直接上传到 S3

使用返回的 `uploadUrl` 直接上传图片:

```javascript
// 前端示例代码
const uploadImage = async (file: File) => {
  // 1. 获取上传 URL
  const response = await fetch('https://api.example.com/sessions/upload-url', {
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
    headers: {
      'Content-Type': file.type,
    },
  });

  // 3. 返回 sessionId 和 objectKey,用于后续分析
  return { sessionId, objectKey };
};
```

### 步骤 3: 触发 AI 分析

上传完成后,触发分析:

**请求:**
```http
POST /sessions/analyze
Content-Type: application/json

{
  "sessionId": "2025-01-23-abc123",
  "objectKey": "sessions/2025-01-23-abc123/1737622800000.jpg",
  "contentTitle": "春季新品发布"  // 可选
}
```

**响应:**
```json
{
  "success": true,
  "data": {
    "sessionId": "2025-01-23-abc123",
    "status": "analyzing",
    "message": "分析已开始,请稍后查看结果"
  }
}
```

### 步骤 4: 查询分析结果

```http
GET /sessions/{sessionId}
```

## 🎯 优势

### 1. 性能提升
- ✅ 前端直接上传到 S3,速度更快
- ✅ 支持大文件上传(最大 5GB)
- ✅ Lambda 不处理文件传输,降低延迟

### 2. 成本优化
- ✅ Lambda 执行时间更短
- ✅ 不占用 Lambda 带宽配额
- ✅ 按需付费,只为存储付费

### 3. 用户体验
- ✅ 前端可显示上传进度
- ✅ 支持断点续传
- ✅ 更好的错误处理

## 🔒 安全性

### 预签名 URL 特点:
- ⏱️ **有效期**: 5 分钟 (300 秒)
- 🔐 **只读权限**: 只能 PUT 上传,不能读取或删除
- 🎯 **单次使用**: 每次上传需要新的 URL
- 📁 **路径隔离**: 每个会话有独立的 S3 路径

### 文件验证:
- 后端在分析前验证文件是否存在
- 如果文件不存在或已过期,返回错误
- 前端需重新获取上传 URL

## 📱 前端完整示例

```typescript
// React 示例
import { useState } from 'react';

const ImageUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleUpload = async (file: File) => {
    try {
      setUploading(true);

      // 1. 获取上传 URL
      const urlResponse = await fetch('/api/sessions/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
        }),
      });

      const { data } = await urlResponse.json();
      const { sessionId, uploadUrl, objectKey } = data;

      // 2. 上传到 S3 (支持进度监控)
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      await new Promise((resolve, reject) => {
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.onload = () => resolve(xhr.response);
        xhr.onerror = reject;
        xhr.send(file);
      });

      // 3. 触发分析
      const analyzeResponse = await fetch('/api/sessions/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          objectKey,
          contentTitle: '我的内容',
        }),
      });

      const { data: result } = await analyzeResponse.json();
      console.log('分析已启动:', result);

      // 4. 轮询结果
      const checkResult = async () => {
        const response = await fetch(`/api/sessions/${sessionId}`);
        const { data } = await response.json();

        if (data.status === 'completed') {
          console.log('分析完成:', data);
          return data;
        } else if (data.status === 'failed') {
          throw new Error('分析失败');
        } else {
          // 继续轮询
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return checkResult();
        }
      };

      const finalResult = await checkResult();
      return finalResult;

    } catch (error) {
      console.error('上传失败:', error);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
        }}
      />
      {uploading && <div>上传进度: {progress}%</div>}
    </div>
  );
};
```

## 🚨 错误处理

### 常见错误:

#### 1. 上传 URL 过期
```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "文件未上传或已过期,请重新获取上传 URL"
  }
}
```
**解决**: 重新调用 `/sessions/upload-url` 获取新的 URL

#### 2. 文件类型不支持
**解决**: 确保 `contentType` 为图片类型 (`image/jpeg`, `image/png`, `image/webp`)

#### 3. 文件过大
**解决**: S3 支持最大 5GB,但建议图片不超过 10MB

## 📊 与旧方案对比

| 特性 | 旧方案 (Base64) | 新方案 (预签名 URL) |
|------|----------------|-------------------|
| **上传速度** | 较慢 | 快 |
| **Lambda 成本** | 高 | 低 |
| **文件大小限制** | 6MB | 5GB |
| **进度监控** | 不支持 | 支持 |
| **带宽占用** | Lambda | S3 直连 |

## 🔍 调试技巧

### 1. 检查 S3 对象是否存在

```bash
aws s3 ls s3://personasim-content-dev/sessions/2025-01-23-abc123/
```

### 2. 测试预签名 URL

```bash
# 生成 URL
curl -X POST https://api.example.com/sessions/upload-url

# 上传测试文件
curl -X PUT "<uploadUrl>" \
  -H "Content-Type: image/jpeg" \
  --data-binary @test.jpg
```

### 3. 查看 CloudWatch 日志

```bash
# 查看上传 URL 生成日志
npm run logs -- -f getUploadUrl --tail

# 查看分析触发日志
npm run logs -- -f analyzeSession --tail
```

## 📝 注意事项

1. **URL 有效期**: 预签名 URL 在 5 分钟后失效,前端需在此时间内完成上传
2. **并发上传**: 每次上传都需要新的 sessionId 和 uploadUrl
3. **文件验证**: 后端会验证文件是否存在,请确保上传成功后再调用分析接口
4. **CORS 配置**: S3 bucket 已配置 CORS,允许前端直接上传

## 🎓 最佳实践

1. **错误重试**: 实现上传失败自动重试机制
2. **进度反馈**: 向用户显示上传进度
3. **超时处理**: 设置合理的超时时间 (建议 30 秒)
4. **文件校验**: 上传前在前端验证文件类型和大小
5. **用户提示**: 明确告知用户上传状态和预计等待时间

---

如有问题,请查看 [主文档](./IMPLEMENTATION.md) 或创建 Issue。
