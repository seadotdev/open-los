/**
 * Base provider interface for LLM integrations
 */

import type { ModelConfig, ProviderResponse } from '../types.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export abstract class BaseProvider {
  protected config: ModelConfig;

  constructor(config: ModelConfig) {
    this.config = config;
  }

  abstract chat(messages: ChatMessage[]): Promise<ProviderResponse>;

  get modelName(): string {
    return this.config.model;
  }

  get providerName(): string {
    return this.config.provider;
  }
}

/**
 * Creates a provider instance based on config
 */
export async function createProvider(config: ModelConfig): Promise<BaseProvider> {
  switch (config.provider) {
    case 'anthropic':
      const { AnthropicProvider } = await import('./anthropic.js');
      return new AnthropicProvider(config);

    case 'openai':
      const { OpenAIProvider } = await import('./openai.js');
      return new OpenAIProvider(config);

    case 'google':
      const { GoogleProvider } = await import('./google.js');
      return new GoogleProvider(config);

    case 'mistral':
      const { MistralProvider } = await import('./mistral.js');
      return new MistralProvider(config);

    case 'local':
      const { LocalProvider } = await import('./local.js');
      return new LocalProvider(config);

    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}
