import { logger } from '../../../utils/logger';
import type { LLMConfig, LLMMessage, LLMProvider, LLMStreamChunk, ToolCall } from '../llm';
import { createProvider } from '../llm';
import type { ToolRegistry } from '../tools';
import type { ToolContext, ToolResult } from '../tools/types';

export interface AgentEngineOptions {
  llmConfig: LLMConfig;
  toolRegistry: ToolRegistry;
  systemPrompt?: string;
  maxIterations?: number;
  contextWindowSize?: number;
  onStreamChunk?: (chunk: LLMStreamChunk) => void;
  abortSignal?: AbortSignal;
}

export interface AgentEngineResult {
  success: boolean;
  content: string;
  toolResults: ToolResult[];
  iterations: number;
  error?: string;
}

export class AgentEngine {
  private provider: LLMProvider;
  private toolRegistry: ToolRegistry;
  private systemPrompt: string;
  private maxIterations: number;
  private contextWindowSize: number;

  constructor(options: AgentEngineOptions) {
    this.provider = createProvider(options.llmConfig);
    this.toolRegistry = options.toolRegistry;
    this.systemPrompt = options.systemPrompt || '';
    this.maxIterations = options.maxIterations ?? 20;
    this.contextWindowSize = options.contextWindowSize ?? 10;
  }

  async execute(
    userMessage: string,
    toolContext: ToolContext,
    options?: { onStreamChunk?: (chunk: LLMStreamChunk) => void; abortSignal?: AbortSignal }
  ): Promise<AgentEngineResult> {
    const messages: LLMMessage[] = [];

    if (this.systemPrompt) {
      messages.push({ role: 'system', content: this.systemPrompt });
    }

    messages.push({ role: 'user', content: userMessage });

    const toolResults: ToolResult[] = [];
    let iteration = 0;

    while (iteration < this.maxIterations) {
      if (options?.abortSignal?.aborted) {
        return {
          success: false,
          content: '',
          toolResults,
          iterations: iteration,
          error: 'Execution aborted',
        };
      }

      iteration++;
      logger.info({ iteration }, 'AgentEngine iteration start');

      try {
        const trimmedMessages = this.trimMessages(messages);
        const tools = this.toolRegistry.getAllTools();

        let response: import('../llm').LLMResponse;

        if (options?.onStreamChunk) {
          response = await this.provider.streamChat(
            trimmedMessages,
            tools,
            {
              temperature: 0.7,
              maxTokens: 4096,
            },
            options.onStreamChunk
          );
        } else {
          response = await this.provider.chat(trimmedMessages, tools, {
            temperature: 0.7,
            maxTokens: 4096,
          });
        }

        if (response.toolCalls.length > 0) {
          // Add assistant message with tool calls
          messages.push({
            role: 'assistant',
            content: response.content,
            tool_calls: response.toolCalls,
          });

          // Execute each tool call
          for (const toolCall of response.toolCalls) {
            if (options?.abortSignal?.aborted) {
              return {
                success: false,
                content: '',
                toolResults,
                iterations: iteration,
                error: 'Execution aborted',
              };
            }

            const result = await this.executeToolCall(toolCall, toolContext);
            toolResults.push(result);

            // Format tool result in a clean, readable way for the LLM
            let output = '';
            if (result.ok) {
              output = result.summary || 'Tool executed successfully';
              if (result.stdout) {
                output += '\n\nOutput:\n' + result.stdout;
              }
              if (result.stderr) {
                output += '\n\nErrors:\n' + result.stderr;
              }
            } else {
              output = `Error: ${result.summary || 'Tool execution failed'}`;
            }

            // Add tool result message
            messages.push({
              role: 'tool',
              content: output,
              tool_call_id: toolCall.id,
            });

            logger.info({ toolCall: toolCall.name, result: result.summary }, 'Tool executed and result added to messages');
          }

          // Continue to next iteration to let LLM analyze tool results
          logger.info({ toolCallsExecuted: response.toolCalls.length }, 'Continuing to next iteration');
        } else {
          // No tool calls, this is the final response
          messages.push({
            role: 'assistant',
            content: response.content,
          });

          logger.info({ contentLength: response.content.length, iteration }, 'AgentEngine completed successfully');

          return {
            success: true,
            content: response.content,
            toolResults,
            iterations: iteration,
          };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error({ iteration, error: errorMessage }, 'AgentEngine iteration error');

        return {
          success: false,
          content: '',
          toolResults,
          iterations: iteration,
          error: errorMessage,
        };
      }
    }

    logger.warn({ iterations: iteration }, 'AgentEngine reached max iterations');

    return {
      success: false,
      content: '',
      toolResults,
      iterations: iteration,
      error: `Reached maximum iterations (${this.maxIterations})`,
    };
  }

  private trimMessages(messages: LLMMessage[]): LLMMessage[] {
    if (messages.length <= this.contextWindowSize + 1) {
      return messages;
    }

    const systemMessages = messages.filter((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');

    const recentMessages = nonSystemMessages.slice(-this.contextWindowSize);

    return [...systemMessages, ...recentMessages];
  }

  private async executeToolCall(toolCall: ToolCall, context: ToolContext): Promise<ToolResult> {
    logger.info({ tool: toolCall.name, args: toolCall.arguments }, 'Executing tool call');

    const result = await this.toolRegistry.executeTool(toolCall.name, toolCall.arguments, context);

    logger.info(
      { tool: toolCall.name, ok: result.ok, summary: result.summary },
      'Tool call completed'
    );

    return result;
  }
}
