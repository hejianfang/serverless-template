// Model Pool 定价信息
export interface ModelPoolPricing {
  input: number;
  cachedInput: number;
  output: number;
  currency: string;
}

// Model Pool 类型
export interface ModelPool {
  poolId: string;
  poolName: string;
  modelId: string;
  instanceCount: number;
  hasPricing: boolean;
  pricing?: ModelPoolPricing;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  version: number;
  tags: string[];
}

// Model Pools API 响应类型
export interface ModelPoolsResponse {
  count: number;
  pools: ModelPool[];
}

// API 端点
const MODEL_POOLS_ENDPOINT =
  'https://95ubyy2z2j.execute-api.ap-southeast-1.amazonaws.com/api/model-pools';

/**
 * 获取活跃的 Model Pool IDs
 * @returns 活跃的 poolId 数组
 */
export async function getActiveModelPoolIds(): Promise<string[]> {
  try {
    // 发送 GET 请求
    const response = await fetch(MODEL_POOLS_ENDPOINT, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 检查 HTTP 状态码
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // 解析响应
    const data = (await response.json()) as ModelPoolsResponse;

    // 过滤出 isActive 为 true 的 pools，并提取 poolId
    const activePoolIds = data.pools.filter((pool) => pool.isActive).map((pool) => pool.poolId);

    return activePoolIds;
  } catch (error) {
    // 处理错误
    if (error instanceof Error) {
      throw new Error(`Failed to fetch model pools: ${error.message}`);
    }
    throw new Error('Failed to fetch model pools');
  }
}

/**
 * 获取所有 Model Pools（包含完整信息）
 * @returns Model Pools 响应
 */
export async function getModelPools(): Promise<ModelPoolsResponse> {
  try {
    // 发送 GET 请求
    const response = await fetch(MODEL_POOLS_ENDPOINT, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 检查 HTTP 状态码
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // 解析响应
    const data = (await response.json()) as ModelPoolsResponse;

    return data;
  } catch (error) {
    // 处理错误
    if (error instanceof Error) {
      throw new Error(`Failed to fetch model pools: ${error.message}`);
    }
    throw new Error('Failed to fetch model pools');
  }
}

/**
 * 获取活跃的 Model Pools（完整信息）
 * @returns 活跃的 Model Pool 数组
 */
export async function getActiveModelPools(): Promise<ModelPool[]> {
  try {
    const data = await getModelPools();

    // 过滤出 isActive 为 true 的 pools
    const activePools = data.pools.filter((pool) => pool.isActive);

    return activePools;
  } catch (error) {
    // 处理错误
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch active model pools');
  }
}
