// 测试 Model Pools API 的使用示例

import {
  getActiveModelPoolIds,
  getActiveModelPools,
  getModelPools,
} from '../src/libs/modelkey-api';

async function testModelPoolsAPI() {
  try {
    console.log('=== 测试 1: 获取所有活跃的 poolId ===');
    const activePoolIds = await getActiveModelPoolIds();
    console.log('活跃的 Pool IDs:', activePoolIds);
    console.log('数量:', activePoolIds.length);

    console.log('\n=== 测试 2: 获取所有 Model Pools ===');
    const allPools = await getModelPools();
    console.log('总数量:', allPools.count);
    console.log('Pools:', allPools.pools.map((p) => ({
      poolId: p.poolId,
      isActive: p.isActive,
    })));

    console.log('\n=== 测试 3: 获取活跃的 Model Pools（完整信息）===');
    const activePools = await getActiveModelPools();
    console.log('活跃的 Pools:');
    activePools.forEach((pool) => {
      console.log(`- ${pool.poolId} (${pool.poolName})`);
      console.log(`  Model ID: ${pool.modelId}`);
      console.log(`  实例数: ${pool.instanceCount}`);
      if (pool.hasPricing && pool.pricing) {
        console.log(`  定价: 输入 $${pool.pricing.input}, 输出 $${pool.pricing.output}`);
      }
    });

  } catch (error) {
    console.error('错误:', error);
  }
}

// 运行测试
testModelPoolsAPI();
