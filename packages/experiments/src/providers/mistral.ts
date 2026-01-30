/**
 * Mistral AI provider
 * Supports: mistral-small, mistral-medium, mistral-large, codestral, etc.
 */

import type { ModelConfig, ProviderResponse } from '../types.js';
import { BaseProvider, type ChatMessage } from './base.js';

export class MistralProvider extends BaseProvider {
  private baseUrl: string;

  constructor(config: ModelConfig) {
    super(config);
    this.baseUrl = config.baseUrl ?? 'https://api.mistral.ai';
  }

  async chat(messages: ChatMessage[]): Promise<ProviderResponse> {
    const startTime = Date.now();

    const body = {
      model: this.config.model,
      max_tokens: this.config.maxTokens ?? 4096,
      temperature: this.config.temperature ?? 0,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    };

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Mistral API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
      usage: { prompt_tokens: number; completion_tokens: number };
    };

    const latencyMs = Date.now() - startTime;

    return {
      content: data.choices[0]?.message?.content ?? '',
      usage: {
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
      },
      latencyMs,
      raw: data,
    };
  }
}
