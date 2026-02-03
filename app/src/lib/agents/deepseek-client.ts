// ============================================================
// DeepSeek API 客户端
// ============================================================

import OpenAI from 'openai';

// DeepSeek 客户端（使用 OpenAI SDK，因为 API 兼容）
const deepseekClient = process.env.DEEPSEEK_API_KEY
  ? new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com',
    })
  : null;

// 检查客户端是否可用
export function isDeepSeekAvailable(): boolean {
  return deepseekClient !== null;
}

// 普通对话（非流式）
export async function chat(params: {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}): Promise<string> {
  if (!deepseekClient) {
    throw new Error('DeepSeek client not available. Please set DEEPSEEK_API_KEY.');
  }

  const { messages, temperature = 0.7, maxTokens = 2048, jsonMode = false } = params;

  const response = await deepseekClient.chat.completions.create({
    model: 'deepseek-chat',
    messages,
    temperature,
    max_tokens: maxTokens,
    ...(jsonMode && { response_format: { type: 'json_object' } }),
  });

  return response.choices[0]?.message?.content || '';
}

// JSON 模式对话（自动解析）
export async function chatJSON<T = any>(params: {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
}): Promise<T> {
  const content = await chat({
    ...params,
    jsonMode: true,
  });

  try {
    return JSON.parse(content) as T;
  } catch (error) {
    console.error('[DeepSeek] Failed to parse JSON response:', content);
    throw new Error('Failed to parse JSON response from DeepSeek');
  }
}

// 流式对话
export async function* chatStream(params: {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
}): AsyncGenerator<string, void, unknown> {
  if (!deepseekClient) {
    throw new Error('DeepSeek client not available. Please set DEEPSEEK_API_KEY.');
  }

  const { messages, temperature = 0.7, maxTokens = 2048 } = params;

  const stream = await deepseekClient.chat.completions.create({
    model: 'deepseek-chat',
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}

// 简单的单轮对话
export async function ask(
  prompt: string,
  systemPrompt?: string,
  jsonMode = false
): Promise<string> {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  return chat({ messages, jsonMode });
}

// 带 JSON 输出的单轮对话
export async function askJSON<T = any>(
  prompt: string,
  systemPrompt?: string
): Promise<T> {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  return chatJSON<T>({ messages });
}

export default {
  chat,
  chatJSON,
  chatStream,
  ask,
  askJSON,
  isDeepSeekAvailable,
};
