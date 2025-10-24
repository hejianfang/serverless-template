import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../libs/logger';

/**
 * Persona 配置 Schema
 */
export const PersonaConfigSchema = z.object({
  userId: z.string(), // 用户唯一标识: "001" - "030"
  name: z.string(), // 显示名称
  description: z.string(), // 简短描述
  category: z.string().optional(), // 分类(如: 母婴、美妆、科技等)
  priceRange: z.string().optional(), // 价格范围描述
  systemPrompt: z.string(), // 完整的 system prompt
});

/**
 * Persona 配置类型
 */
export type PersonaConfig = z.infer<typeof PersonaConfigSchema>;

/**
 * 兼容旧版本的 Persona 类型 (用于过渡)
 * 从 PersonaConfig 提取基础信息
 */
export interface Persona {
  userId: string;
  name: string;
  priceRange: string;
  systemPrompt: string;
}

/**
 * Persona 缓存
 */
let cachedPersonas: PersonaConfig[] | null = null;

/**
 * 从 personas 目录加载所有 persona 配置
 */
function loadPersonasFromDirectory(): PersonaConfig[] {
  const personasDir = path.join(__dirname, 'personas');

  // 检查目录是否存在
  if (!fs.existsSync(personasDir)) {
    logger.warn('Personas 目录不存在，返回空数组', { personasDir });
    return [];
  }

  // 读取目录中的所有 JSON 文件
  const files = fs
    .readdirSync(personasDir)
    .filter((file) => file.endsWith('.json'))
    .sort(); // 按文件名排序

  logger.info('发现 persona 文件', { count: files.length, files });

  // 加载并解析每个文件
  const personas: PersonaConfig[] = [];

  for (const file of files) {
    const filePath = path.join(personasDir, file);

    try {
      // 读取文件内容
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      // 验证数据格式
      const persona = PersonaConfigSchema.parse(data);

      personas.push(persona);
      logger.debug('成功加载 persona', { userId: persona.userId, name: persona.name });
    } catch (error) {
      logger.error('加载 persona 文件失败', { file, error });
      // 继续加载其他文件
    }
  }

  logger.info('Personas 加载完成', { total: personas.length });

  return personas;
}

/**
 * 获取所有 Persona 配置
 * @returns Persona 配置数组
 */
export function getPersonaConfigs(): PersonaConfig[] {
  // 使用缓存,避免重复读取文件
  if (cachedPersonas === null) {
    cachedPersonas = loadPersonasFromDirectory();
  }

  return cachedPersonas;
}

/**
 * 获取所有 Personas (兼容旧版本接口)
 * @returns Persona 数组
 */
export function getPersonas(): Persona[] {
  const configs = getPersonaConfigs();

  // 转换为旧版本格式
  return configs.map((config) => ({
    userId: config.userId,
    name: config.name,
    priceRange: config.priceRange || '未知',
    systemPrompt: config.systemPrompt,
  }));
}

/**
 * 根据 userId 获取单个 Persona
 * @param userId 用户ID
 * @returns Persona 配置,如果不存在则返回 undefined
 */
export function getPersonaById(userId: string): PersonaConfig | undefined {
  const configs = getPersonaConfigs();
  return configs.find((p) => p.userId === userId);
}

/**
 * 重新加载 Personas (清除缓存)
 * 用于开发环境或需要动态更新配置时
 */
export function reloadPersonas(): void {
  logger.info('重新加载 Personas');
  cachedPersonas = null;
  getPersonaConfigs();
}
