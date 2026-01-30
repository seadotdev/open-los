/**
 * Anthropic Claude provider
 * Supports: claude-3-haiku, claude-3-sonnet, claude-3-opus, etc.
 */

import type { ModelConfig, ProviderResponse } from '../types.js';
import { BaseProvider, type ChatMessage } from './base.js';

export class AnthropicProvider extends BaseProvider {
  private baseUrl: string;

  constructor(config: ModelConfig) {
    super(config);
    this.baseUrl = config.baseUrl ?? 'https://api.anthropic.com';
  }

  async chat(messages: ChatMessage[]): Promise<ProviderResponse> {
    const startTime = Date.now();

    // Extract system message if present
    const systemMessage = messages.find(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    const body = {
      model: this.config.model,
      max_tokens: this.config.maxTokens ?? 4096,
      system: systemMessage?.content,
      messages: nonSystemMessages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    };

    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      content: Array<{ type: string; text: string }>;
      usage: { input_tokens: number; output_tokens: number };
    };

    const latencyMs = Date.now() - startTime;

    return {
      content: data.content
        .filter(c => c.type === 'text')
        .map(c => c.text)
        .join('\n'),
      usage: {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
      },
      latencyMs,
      raw: data,
    };
  }
}
