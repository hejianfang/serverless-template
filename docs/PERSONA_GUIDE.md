# Persona 管理指南

## 概述

PersonaSim 后端已升级为支持 **30 个详细 Persona** 的管理系统。每个 Persona 都有完整的 system prompt,可以直接用于 AI 分析。

## 目录结构

```
src/config/
  ├── personas/              # 存放所有 persona 配置
  │   ├── 001-tongtong-mami.json
  │   ├── 002-xxx.json
  │   ├── 003-xxx.json
  │   └── ... (共 30 个)
  ├── personas.ts            # 加载和管理逻辑
  └── prompt.json           # 已废弃(保留作为模板参考)
```

## Persona 文件格式

每个 persona 文件 (`.json`) 包含以下字段:

```json
{
  "userId": "001",
  "name": "潼潼妈咪",
  "description": "00后新手宝妈，成都常驻，注重安全与理性消费，独立带娃经验丰富",
  "category": "母婴",
  "priceRange": "中等偏理性",
  "systemPrompt": "# 小红书母婴素人博主「潼潼妈咪」评测/种草判读器...\n\n完整的 system prompt 内容"
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `userId` | string | ✅ | 唯一标识,格式: "001" - "030" |
| `name` | string | ✅ | 显示名称,如 "潼潼妈咪" |
| `description` | string | ✅ | 简短描述,便于管理和理解 |
| `category` | string | ❌ | 分类标签,如 "母婴"、"美妆"、"科技" 等 |
| `priceRange` | string | ❌ | 价格范围描述 |
| `systemPrompt` | string | ✅ | 完整的 system prompt,将直接发送给 AI |

## 如何添加新的 Persona

### 1. 创建新文件

在 `src/config/personas/` 目录下创建新的 JSON 文件:

```bash
# 文件命名格式: {userId}-{slug}.json
# 例如: 002-beauty-girl.json
```

### 2. 编写 Persona 配置

参考 `001-tongtong-mami.json` 的格式:

```json
{
  "userId": "002",
  "name": "美妆小仙女",
  "description": "95后美妆达人,热衷尝试新品,追求性价比",
  "category": "美妆",
  "priceRange": "¥50-300",
  "systemPrompt": "你的完整 persona prompt 内容...\n\n包含:\n- 人设描述\n- 决策规则\n- 输出格式\n- JSON 模板"
}
```

### 3. systemPrompt 编写建议

一个完整的 `systemPrompt` 应该包含:

1. **角色定位**: 明确角色身份和特征
2. **决策规则**: 如何判断是否打开、点赞、评论、购买
3. **输出格式**: 严格的 JSON 输出要求
4. **示例模板**: 提供 JSON 输出示例

参考 `001-tongtong-mami.json` 的结构:
- 第 1 部分: 人设与边界
- 第 2 部分: 输入说明
- 第 3 部分: 任务目标
- 第 4 部分: 决策与字段规则
- 第 5 部分: 触发逻辑
- 第 6 部分: 输出格式与校验
- 第 7 部分: 输出 JSON 模板

### 4. 验证文件格式

```bash
# 验证 JSON 格式是否有效
node -e "console.log(JSON.parse(require('fs').readFileSync('./src/config/personas/002-xxx.json', 'utf-8')))"

# 或使用 jq 工具
cat src/config/personas/002-xxx.json | jq .
```

### 5. 测试加载

```bash
npx tsx -e "
import { getPersonaById } from './src/config/personas';
const persona = getPersonaById('002');
console.log(persona ? '✓ 加载成功' : '❌ 加载失败');
console.log(persona);
"
```

## 使用方式

### 在代码中获取 Personas

```typescript
import { getPersonas, getPersonaById, getPersonaConfigs } from '../config/personas';

// 获取所有 personas (简化版,用于 AI 分析)
const personas = getPersonas();
// 返回: Persona[] (包含 userId, name, priceRange, systemPrompt)

// 获取所有 persona 配置 (完整版)
const configs = getPersonaConfigs();
// 返回: PersonaConfig[] (包含所有字段)

// 获取单个 persona
const persona = getPersonaById('001');
// 返回: PersonaConfig | undefined
```

### 在 AI 分析中使用

当前 `ai-analyzer.ts` 已更新,会自动:

1. 加载所有 personas
2. 为每个 persona 构建 AI 消息:
   ```typescript
   const messages = [
     {
       role: 'system',
       content: persona.systemPrompt,  // 直接使用完整 prompt
     },
     {
       role: 'user',
       content: [
         {
           type: 'image',
           image: { format: 'jpeg', source_url: contentUrl },
         },
       ],
     },
   ];
   ```
3. 调用 AI 分析,获取用户行为数据

## 注意事项

### ✅ 推荐做法

- 使用清晰的文件命名: `{userId}-{slug}.json`
- userId 保持三位数格式: "001", "002", ..., "030"
- systemPrompt 尽量详细,包含所有决策规则
- 定期验证 JSON 格式是否有效
- 使用版本控制追踪每个 persona 的修改历史

### ⚠️ 避免的做法

- ❌ 不要在 systemPrompt 中使用未转义的引号
- ❌ 不要遗漏必填字段 (userId, name, description, systemPrompt)
- ❌ 不要使用重复的 userId
- ❌ 不要在 JSON 中使用注释 (JSON 不支持注释)

## 故障排查

### Persona 加载失败

检查日志:
```bash
# 查看加载日志
npx tsx -e "import { getPersonaConfigs } from './src/config/personas'; getPersonaConfigs();"
```

常见问题:
1. JSON 格式错误 → 使用 `jq` 或 JSON 验证工具检查
2. 文件权限问题 → 检查文件读取权限
3. 字段缺失 → 对照 PersonaConfigSchema 检查必填字段

### TypeScript 类型错误

如果遇到类型错误,检查:
1. 是否使用了正确的类型 (`Persona` vs `PersonaConfig`)
2. 是否引用了不存在的字段
3. 是否正确导入类型定义

## 开发建议

### 批量创建 Personas

可以创建一个脚本批量生成 persona 文件:

```typescript
// scripts/generate-personas.ts
import fs from 'fs';
import path from 'path';

const personas = [
  {
    userId: '002',
    name: '美妆小仙女',
    description: '...',
    category: '美妆',
    priceRange: '¥50-300',
    systemPrompt: '...',
  },
  // ... 更多 personas
];

personas.forEach((persona) => {
  const filePath = path.join(
    __dirname,
    `../src/config/personas/${persona.userId}-${slugify(persona.name)}.json`
  );
  fs.writeFileSync(filePath, JSON.stringify(persona, null, 2));
  console.log(`✓ 创建: ${filePath}`);
});
```

### 重新加载 Personas

在开发环境中,如果修改了 persona 文件,可以调用 `reloadPersonas()`:

```typescript
import { reloadPersonas } from '../config/personas';

// 清除缓存并重新加载
reloadPersonas();
```

## 未来扩展

如果需要动态管理 personas (增删改),可以考虑:

1. 迁移到数据库 (DynamoDB)
2. 添加 CRUD API
3. 提供管理界面

当前的文件系统方案适合固定的 30 个 personas,便于版本控制和部署。

## 更新记录

- **2025-10-24**: 初始版本,实现基于文件的 persona 管理系统
  - 创建 personas 目录结构
  - 实现加载和缓存机制
  - 集成到 ai-analyzer.ts
  - 添加类型定义和验证
