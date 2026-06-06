import OpenAI from 'openai';
import type { ToolDefinition } from '../tools/types';
import type {
  LLMConfig,
  LLMMessage,
  LLMProvider,
  LLMResponse,
  LLMStreamChunk,
  ToolCall,
} from './types';

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor(config: LLMConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
    this.model = config.modelName;
  }

  private toOpenAIMessages(messages: LLMMessage[]): OpenAI.Chat.ChatCompletionMessageParam[] {
    return messages.map((msg): OpenAI.Chat.ChatCompletionMessageParam => {
      if (msg.role === 'tool') {
        return {
          role: 'tool',
          content: msg.content,
          tool_call_id: msg.tool_call_id || '',
        };
      }
      if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
        return {
          role: 'assistant',
          content: msg.content,
          tool_calls: msg.tool_calls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        };
      }
      return {
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content,
      };
    });
  }

  private toOpenAITools(tools: unknown[]): OpenAI.Chat.ChatCompletionTool[] {
    return (tools as ToolDefinition[]).map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: Object.fromEntries(
            tool.parameters.map((p) => [
              p.name,
              {
                type: p.type,
                description: p.description,
                ...(p.defaultValue !== undefined ? { default: p.defaultValue } : {}),
              },
            ])
          ),
          required: tool.parameters.filter((p) => p.required).map((p) => p.name),
        },
      },
    }));
  }

  private parseToolCalls(
    toolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[] | undefined
  ): ToolCall[] {
    if (!toolCalls) return [];
    return toolCalls.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: (() => {
        try {
          return JSON.parse(tc.function.arguments) as Record<string, unknown>;
        } catch {
          return {};
        }
      })(),
    }));
  }

  async chat(
    messages: LLMMessage[],
    tools: unknown[],
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<LLMResponse> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: this.toOpenAIMessages(messages),
      tools: tools.length > 0 ? this.toOpenAITools(tools) : undefined,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
    });

    const choice = response.choices[0];
    if (!choice) {
      return { content: '', toolCalls: [], finishReason: 'stop' };
    }
    return {
      content: choice.message.content || '',
      toolCalls: this.parseToolCalls(choice.message.tool_calls),
      finishReason: choice.finish_reason || 'stop',
    };
  }

  async streamChat(
    messages: LLMMessage[],
    tools: unknown[],
    options: { temperature?: number; maxTokens?: number },
    onChunk: (chunk: LLMStreamChunk) => void
  ): Promise<LLMResponse> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: this.toOpenAIMessages(messages),
      tools: tools.length > 0 ? this.toOpenAITools(tools) : undefined,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens,
      stream: true,
    });

    let content = '';
    const toolCallBuffers = new Map<number, { id: string; name: string; args: string }>();

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      if (delta.content) {
        content += delta.content;
        onChunk({ content: delta.content });
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const index = tc.index ?? 0;
          const existing = toolCallBuffers.get(index);
          if (existing) {
            if (tc.function?.name) existing.name = tc.function.name;
            if (tc.function?.arguments) existing.args += tc.function.arguments;
            if (tc.id) existing.id = tc.id;
          } else {
            toolCallBuffers.set(index, {
              id: tc.id || `tc_${index}`,
              name: tc.function?.name || '',
              args: tc.function?.arguments || '',
            });
          }
        }
      }

      const finishReason = chunk.choices[0]?.finish_reason;
      if (finishReason) {
        onChunk({ finishReason });
      }
    }

    const toolCalls: ToolCall[] = Array.from(toolCallBuffers.values()).map((buf) => ({
      id: buf.id,
      name: buf.name,
      arguments: (() => {
        try {
          return JSON.parse(buf.args) as Record<string, unknown>;
        } catch {
          return {};
        }
      })(),
    }));

    if (toolCalls.length > 0) {
      onChunk({ toolCalls });
    }

    return {
      content,
      toolCalls,
      finishReason: 'stop',
    };
  }
}
