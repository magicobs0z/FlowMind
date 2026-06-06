import { AnthropicProvider } from './anthropicProvider';
import { OpenAIProvider } from './openaiProvider';
import type { LLMConfig, LLMProvider } from './types';

export function createProvider(config: LLMConfig): LLMProvider {
  switch (config.provider) {
    case 'openai':
      return new OpenAIProvider(config);
    case 'anthropic':
      return new AnthropicProvider(config);
    default:
      throw new Error(`Unsupported LLM provider: ${config.provider}`);
  }
}
