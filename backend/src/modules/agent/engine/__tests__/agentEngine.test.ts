import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentEngine } from '../agentEngine';
import { ToolRegistry } from '../../tools/toolRegistry';
import type { LLMProvider, LLMResponse, LLMStreamChunk, ToolCall } from '../../llm/types';
import type { ToolContext, ToolResult } from '../../tools/types';

class MockLLMProvider implements LLMProvider {
  private responses: LLMResponse[];
  private callCount = 0;

  constructor(responses: LLMResponse[]) {
    this.responses = responses;
  }

  async chat(): Promise<LLMResponse> {
    const response = this.responses[this.callCount] ?? {
      content: 'default',
      toolCalls: [],
      finishReason: 'stop',
    };
    this.callCount++;
    return response;
  }

  async streamChat(
    _messages: unknown,
    _tools: unknown,
    _options: unknown,
    onChunk: (chunk: LLMStreamChunk) => void
  ): Promise<LLMResponse> {
    const response = this.responses[this.callCount] ?? {
      content: 'default',
      toolCalls: [],
      finishReason: 'stop',
    };
    this.callCount++;
    onChunk({ content: response.content, finishReason: response.finishReason });
    return response;
  }
}

const toolContext: ToolContext = {
  worktree: process.cwd(),
  directory: process.cwd(),
  allowOutsideWorktree: false,
};

describe('AgentEngine', () => {
  let toolRegistry: ToolRegistry;

  beforeEach(() => {
    toolRegistry = new ToolRegistry();
  });

  it('returns result directly when LLM responds with plain text', async () => {
    const provider = new MockLLMProvider([
      { content: 'Hello from LLM', toolCalls: [], finishReason: 'stop' },
    ]);

    const engine = new AgentEngine({
      llmConfig: { provider: 'openai', apiKey: 'test', modelName: 'gpt-4' },
      toolRegistry,
      systemPrompt: 'You are a helpful assistant.',
      maxIterations: 5,
    });

    // Override provider with mock
    (engine as unknown as { provider: LLMProvider }).provider = provider;

    const result = await engine.execute('Say hello', toolContext);
    expect(result.success).toBe(true);
    expect(result.content).toBe('Hello from LLM');
    expect(result.iterations).toBe(1);
    expect(result.toolResults).toHaveLength(0);
  });

  it('executes tool calls and continues reasoning', async () => {
    const toolCall: ToolCall = {
      id: 'call_1',
      name: 'execute_command',
      arguments: { command: process.platform === 'win32' ? 'cmd' : 'echo', args: process.platform === 'win32' ? ['/c', 'echo', 'hello'] : ['hello'] },
    };

    const provider = new MockLLMProvider([
      { content: 'I will run a command', toolCalls: [toolCall], finishReason: 'tool_calls' },
      { content: 'Command output was hello', toolCalls: [], finishReason: 'stop' },
    ]);

    const engine = new AgentEngine({
      llmConfig: { provider: 'openai', apiKey: 'test', modelName: 'gpt-4' },
      toolRegistry,
      maxIterations: 5,
    });
    (engine as unknown as { provider: LLMProvider }).provider = provider;

    const result = await engine.execute('Run echo hello', toolContext);
    expect(result.success).toBe(true);
    expect(result.content).toBe('Command output was hello');
    expect(result.iterations).toBe(2);
    expect(result.toolResults.length).toBeGreaterThanOrEqual(1);
    expect(result.toolResults[0].ok).toBe(true);
    expect(result.toolResults[0].tool).toBe('execute_command');
  });

  it('stops after max iterations', async () => {
    const toolCall: ToolCall = {
      id: 'call_loop',
      name: 'execute_command',
      arguments: { command: process.platform === 'win32' ? 'cmd' : 'echo', args: process.platform === 'win32' ? ['/c', 'echo', 'loop'] : ['loop'] },
    };

    // Always return tool calls to force looping
    const provider = new MockLLMProvider(
      Array.from({ length: 25 }, () => ({
        content: 'looping',
        toolCalls: [toolCall],
        finishReason: 'tool_calls' as const,
      }))
    );

    const engine = new AgentEngine({
      llmConfig: { provider: 'openai', apiKey: 'test', modelName: 'gpt-4' },
      toolRegistry,
      maxIterations: 20,
    });
    (engine as unknown as { provider: LLMProvider }).provider = provider;

    const result = await engine.execute('Infinite loop', toolContext);
    expect(result.success).toBe(false);
    expect(result.iterations).toBe(20);
    expect(result.error).toContain('maximum iterations');
  });

  it('trims messages when context window is exceeded', async () => {
    const provider = new MockLLMProvider([
      { content: 'response', toolCalls: [], finishReason: 'stop' },
    ]);

    const engine = new AgentEngine({
      llmConfig: { provider: 'openai', apiKey: 'test', modelName: 'gpt-4' },
      toolRegistry,
      contextWindowSize: 2,
      maxIterations: 5,
    });
    (engine as unknown as { provider: LLMProvider }).provider = provider;

    const result = await engine.execute('Test context window', toolContext);
    expect(result.success).toBe(true);
    expect(result.content).toBe('response');
  });

  it('stops execution when abort signal is triggered', async () => {
    const provider = new MockLLMProvider([
      { content: 'slow response', toolCalls: [], finishReason: 'stop' },
    ]);

    const engine = new AgentEngine({
      llmConfig: { provider: 'openai', apiKey: 'test', modelName: 'gpt-4' },
      toolRegistry,
      maxIterations: 5,
    });
    (engine as unknown as { provider: LLMProvider }).provider = provider;

    const controller = new AbortController();
    controller.abort();

    const result = await engine.execute('Aborted request', toolContext, {
      abortSignal: controller.signal,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Execution aborted');
    expect(result.iterations).toBe(0);
  });

  it('returns error when LLM throws', async () => {
    const failingProvider: LLMProvider = {
      async chat() {
        throw new Error('LLM API error');
      },
      async streamChat() {
        throw new Error('LLM API error');
      },
    };

    const engine = new AgentEngine({
      llmConfig: { provider: 'openai', apiKey: 'test', modelName: 'gpt-4' },
      toolRegistry,
      maxIterations: 5,
    });
    (engine as unknown as { provider: LLMProvider }).provider = failingProvider;

    const result = await engine.execute('Trigger error', toolContext);
    expect(result.success).toBe(false);
    expect(result.error).toBe('LLM API error');
    expect(result.iterations).toBe(1);
  });

  it('streams chunks when onStreamChunk is provided', async () => {
    const provider = new MockLLMProvider([
      { content: 'streamed response', toolCalls: [], finishReason: 'stop' },
    ]);

    const engine = new AgentEngine({
      llmConfig: { provider: 'openai', apiKey: 'test', modelName: 'gpt-4' },
      toolRegistry,
      maxIterations: 5,
    });
    (engine as unknown as { provider: LLMProvider }).provider = provider;

    const chunks: LLMStreamChunk[] = [];
    const result = await engine.execute('Stream test', toolContext, {
      onStreamChunk: (chunk) => chunks.push(chunk),
    });

    expect(result.success).toBe(true);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0].content).toBe('streamed response');
  });
});
