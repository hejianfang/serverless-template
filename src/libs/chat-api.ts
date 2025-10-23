// Chat API 调用封装

// 消息类型
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string | any[];
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
 * 调用 Chat API
 * @param params 请求参数
 * @returns Chat API 响应
 */
export async function callChatAPI(params: ChatAPIRequest): Promise<ChatAPIResponse> {
  const { modelKey, messages, instanceId = 0, options } = params;

  // 验证必需参数
  if (!modelKey) {
    throw new Error('modelKey is required');
  }

  if (!messages || messages.length === 0) {
    throw new Error('messages is required and cannot be empty');
  }

  try {
    // 发送 POST 请求
    const response = await fetch(CHAT_API_ENDPOINT, {
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

    // 先检查 HTTP 状态码
    if (!response.ok) {
      // 尝试解析错误信息
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = (await response.json()) as ChatAPIResponse;
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        }
      } catch {
        // 如果无法解析错误响应，使用默认错误消息
      }
      throw new Error(errorMessage);
    }

    // 解析成功响应
    const data = (await response.json()) as ChatAPIResponse;

    // 检查业务层面的 success 标志
    if (!data.success) {
      throw new Error(data.error?.message || 'API returned success: false');
    }

    return data;
  } catch (error) {
    // 处理错误
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to call Chat API');
  }
}
