import { z } from 'zod';
import { logger } from '../libs/logger';
import { PERSONAS_DATA } from './personas-data';

/**
 * Persona 配置 Schema
 */
export const PersonaConfigSchema = z.object({
  id: z.number(), // 数字 ID: 1 - 30
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
  id: number;
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
 * 从内联数据加载所有 persona 配置
 */
function loadPersonasFromData(): PersonaConfig[] {
  logger.info('开始加载 Personas 配置');

  // 验证并解析所有 persona 数据
  const personas: PersonaConfig[] = [];

  for (const data of PERSONAS_DATA) {
    try {
      // 验证数据格式
      const persona = PersonaConfigSchema.parse(data);
      personas.push(persona);
      logger.debug('成功加载 persona', { userId: persona.userId, name: persona.name });
    } catch (error) {
      logger.error('加载 persona 数据失败', { userId: data.userId, error });
      // 继续加载其他数据
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
  // 使用缓存,避免重复处理
  if (cachedPersonas === null) {
    cachedPersonas = loadPersonasFromData();
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
    id: config.id,
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
