import Anthropic from '@anthropic-ai/sdk';
import type { ToolDefinition } from '../tools/types';
import type {
  LLMConfig,
  LLMMessage,
  LLMProvider,
  LLMResponse,
  LLMStreamChunk,
  ToolCall,
} from './types';

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;

  constructor(config: LLMConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
    this.model = config.modelName;
  }

  private toAnthropicMessages(messages: LLMMessage[]): Anthropic.MessageParam[] {
    const result: Anthropic.MessageParam[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        continue;
      }
      if (msg.role === 'tool') {
        result.push({
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Tool result (${msg.tool_call_id || ''}): ${msg.content}`,
            },
          ],
        });
        continue;
      }
      if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
        const content: Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> = [];
        if (msg.content) {
          content.push({ type: 'text', text: msg.content });
        }
        for (const tc of msg.tool_calls) {
          content.push({
            type: 'text',
            text: `<tool_use id="${tc.id}" name="${tc.name}">${JSON.stringify(tc.arguments)}</tool_use>`,
          });
        }
        result.push({ role: 'assistant', content });
        continue;
      }
      result.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    }

    return result;
  }

  private extractSystemPrompt(messages: LLMMessage[]): string | undefined {
    const systemMsg = messages.find((m) => m.role === 'system');
    return systemMsg?.content;
  }

  private parseResponseContent(content: string): { text: string; toolCalls: ToolCall[] } {
    const toolCalls: ToolCall[] = [];
    const toolUseRegex = /<tool_use\s+id="([^"]+)"\s+name="([^"]+)">\s*([\s\S]*?)<\/tool_use>/g;
    let match: RegExpExecArray | null = toolUseRegex.exec(content);

    while (match !== null) {
      const id = match[1] ?? '';
      const name = match[2] ?? '';
      const argsStr = match[3]?.trim() ?? '';
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(argsStr) as Record<string, unknown>;
      } catch {
        args = {};
      }
      toolCalls.push({ id, name, arguments: args });
      match = toolUseRegex.exec(content);
    }

    const text = content.replace(toolUseRegex, '').trim();

    return { text, toolCalls };
  }

  async chat(
    messages: LLMMessage[],
    tools: unknown[],
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<LLMResponse> {
    const system = this.extractSystemPrompt(messages);
    const toolDefs = tools as ToolDefinition[];

    let fullSystem = system || '';
    if (toolDefs.length > 0) {
      const toolDescriptions = toolDefs
        .map(
          (t) =>
            `- ${t.name}: ${t.description}\n  Parameters: ${JSON.stringify(t.parameters.map((p) => p.name))}`
        )
        .join('\n');
      fullSystem += `\n\nYou have access to the following tools:\n${toolDescriptions}\n\nWhen you want to use a tool, respond with:\n<tool_use id="TOOL_ID" name="TOOL_NAME">{"arg1": "value1"}</tool_use>`;
    }

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature ?? 0.7,
      system: fullSystem || undefined,
      messages: this.toAnthropicMessages(messages),
    });

    const rawContent = response.content.map((c) => c.text).join('');
    const parsed = this.parseResponseContent(rawContent);

    return {
      content: parsed.text,
      toolCalls: parsed.toolCalls,
      finishReason: response.stop_reason || 'stop',
    };
  }

  async streamChat(
    messages: LLMMessage[],
    tools: unknown[],
    options: { temperature?: number; maxTokens?: number },
    onChunk: (chunk: LLMStreamChunk) => void
  ): Promise<LLMResponse> {
    const system = this.extractSystemPrompt(messages);
    const toolDefs = tools as ToolDefinition[];

    let fullSystem = system || '';
    if (toolDefs.length > 0) {
      const toolDescriptions = toolDefs
        .map(
          (t) =>
            `- ${t.name}: ${t.description}\n  Parameters: ${JSON.stringify(t.parameters.map((p) => p.name))}`
        )
        .join('\n');
      fullSystem += `\n\nYou have access to the following tools:\n${toolDescriptions}\n\nWhen you want to use a tool, respond with:\n<tool_use id="TOOL_ID" name="TOOL_NAME">{"arg1": "value1"}</tool_use>`;
    }

    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.7,
      system: fullSystem || undefined,
      messages: this.toAnthropicMessages(messages),
    });

    let rawContent = '';

    stream.on('text', (text) => {
      rawContent += text;
      onChunk({ content: text });
    });

    const response = await stream.finalMessage();

    const parsed = this.parseResponseContent(rawContent);

    if (parsed.toolCalls.length > 0) {
      onChunk({ toolCalls: parsed.toolCalls });
    }

    onChunk({ finishReason: response.stop_reason || 'stop' });

    return {
      content: parsed.text,
      toolCalls: parsed.toolCalls,
      finishReason: response.stop_reason || 'stop',
    };
  }
}
