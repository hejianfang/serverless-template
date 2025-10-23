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

// Token 使用统计
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// 性能统计
export interface Performance {
  duration: number;
  requestTime: string;
  responseTime: string;
}

// 响应数据类型
export interface ChatAPIResponseData {
  response: string;
  tokenUsage?: TokenUsage;
  performance?: Performance;
}

// API 响应类型
export interface ChatAPIResponse {
  success: boolean;
  data?: ChatAPIResponseData;
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

    // 解析响应
    const data = (await response.json()) as ChatAPIResponse;

    // 检查 HTTP 状态码
    if (!response.ok) {
      throw new Error(data.error?.message || `HTTP error! status: ${response.status}`);
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
