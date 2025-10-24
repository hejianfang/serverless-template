// Chat API 调用封装

// 消息内容块类型（支持多模态内容）
export interface ContentBlock {
  type: 'text' | 'image' | string;
  text?: string;
  source?: {
    type: string;
    media_type?: string;
    data?: string;
    url?: string;
  };
  [key: string]: unknown;
}

// 消息类型
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentBlock[];
}

// 请求参数类型
export interface ChatAPIRequest {
  modelKey: string;
  messages: Message[];
  instanceId?: number;
  options?: {
    temperature?: number;
    maxTokens?: number;
    [key: string]: unknown;
  };
}

// Token 使用统计（匹配实际 API 返回格式）
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheReadInputTokens: number;
  cacheReadInputTokenCount: number;
  cacheWriteInputTokens: number;
  cacheWriteInputTokenCount: number;
  serverToolUsage: Record<string, unknown>;
}

// 性能统计（匹配实际 API 返回格式）
export interface Performance {
  latency: number;
  retries: number;
  timestamp: number;
}

// 响应内容（匹配实际 API 返回格式）
export interface ResponseContent {
  content: string;
  usage: TokenUsage;
}

// API 响应类型（匹配实际 API 返回格式）
export interface ChatAPIResponse {
  success: boolean;
  modelKey?: string;
  instanceLabel?: string;
  provider?: string;
  actualModelId?: string;
  response?: ResponseContent;
  performance?: Performance;
  error?: {
    code: string;
    message: string;
  };
}

// Chat API 端点
const CHAT_API_ENDPOINT =
  'https://95ubyy2z2j.execute-api.ap-southeast-1.amazonaws.com/api/chat/test';

/**
 * Sleep 函数（用于轮询间隔）
 */
async function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const timer = globalThis.setTimeout || Function('return this')().setTimeout;
    timer(resolve, ms);
  });
}

/**
 * 任务状态响应
 */
interface TaskStatusResponse {
  success: boolean;
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message: string;
  result?: ChatAPIResponse;
  error?: {
    message: string;
  };
}

/**
 * 调用 Chat API（异步版本，支持轮询）
 * @param params 请求参数
 * @param pollOptions 轮询选项
 * @returns Chat API 响应
 */
export async function callChatAPI(
  params: ChatAPIRequest,
  pollOptions: {
    maxAttempts?: number; // 最大轮询次数，默认 60 次
    pollInterval?: number; // 轮询间隔（毫秒），默认 2000ms
  } = {}
): Promise<ChatAPIResponse> {
  const { modelKey, messages, instanceId = 0, options } = params;
  const { maxAttempts = 60, pollInterval = 2000 } = pollOptions;

  // 验证必需参数
  if (!modelKey) {
    throw new Error('modelKey is required');
  }

  if (!messages || messages.length === 0) {
    throw new Error('messages is required and cannot be empty');
  }

  try {
    // 1. 发送 POST 请求创建任务
    const createResponse = await fetch(CHAT_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        modelKey,
        messages,
        instanceId,
        options,
      }),
    });

    // 检查创建任务的响应
    if (!createResponse.ok) {
      let errorMessage = `HTTP error! status: ${createResponse.status}`;
      try {
        const errorData = (await createResponse.json()) as {
          message?: string;
          error?: string;
        };
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        // 解析失败，使用默认错误消息
      }
      throw new Error(errorMessage);
    }

    const createData = (await createResponse.json()) as {
      success: boolean;
      taskId?: string;
      statusUrl?: string;
      error?: string;
    };

    if (!createData.success || !createData.taskId) {
      throw new Error(createData.error || '创建任务失败');
    }

    const { taskId } = createData;
    console.log('[Chat API] 任务已创建', { taskId });

    // 2. 轮询任务状态
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // 等待一段时间再查询（第一次立即查询）
      if (attempt > 0) {
        await sleep(pollInterval);
      }

      const statusResponse = await fetch(`${CHAT_API_ENDPOINT}/${taskId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!statusResponse.ok) {
        console.warn('[Chat API] 状态查询失败', {
          taskId,
          status: statusResponse.status,
        });
        continue; // 继续轮询
      }

      const statusData = (await statusResponse.json()) as TaskStatusResponse;

      console.log('[Chat API] 任务状态', {
        taskId,
        status: statusData.status,
        attempt: attempt + 1,
      });

      // 3. 根据状态处理
      if (statusData.status === 'completed' && statusData.result) {
        console.log('[Chat API] 任务完成', { taskId });
        return statusData.result;
      }

      if (statusData.status === 'failed') {
        throw new Error(statusData.error?.message || '任务处理失败');
      }

      // pending 或 processing 状态，继续轮询
    }

    // 超过最大轮询次数
    throw new Error(`任务超时：已轮询 ${maxAttempts} 次，任务仍未完成`);
  } catch (error) {
    // 处理错误
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to call Chat API');
  }
}
