export type LLMRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LLMMessage {
  role: LLMRole;
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface LLMResponse {
  content: string;
  toolCalls: ToolCall[];
  finishReason: string;
}

export interface LLMConfig {
  provider: 'openai' | 'anthropic';
  apiKey: string;
  baseUrl?: string;
  modelName: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMStreamChunk {
  content?: string;
  toolCalls?: ToolCall[];
  finishReason?: string;
}

export interface LLMProvider {
  chat(
    messages: LLMMessage[],
    tools: unknown[],
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<LLMResponse>;

  streamChat(
    messages: LLMMessage[],
    tools: unknown[],
    options: { temperature?: number; maxTokens?: number },
    onChunk: (chunk: LLMStreamChunk) => void
  ): Promise<LLMResponse>;
}
