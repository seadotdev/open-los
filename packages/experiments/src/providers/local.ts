/**
 * Local/OpenAI-compatible provider
 * Supports: Ollama, LM Studio, LocalAI, vLLM, etc.
 * Any server that exposes OpenAI-compatible API
 */

import type { ModelConfig, ProviderResponse } from '../types.js';
import { BaseProvider, type ChatMessage } from './base.js';

export class LocalProvider extends BaseProvider {
  private baseUrl: string;

  constructor(config: ModelConfig) {
    super(config);
    // Default to Ollama's endpoint
    this.baseUrl = config.baseUrl ?? 'http://localhost:11434';
  }

  async chat(messages: ChatMessage[]): Promise<ProviderResponse> {
    const startTime = Date.now();

    const body = {
      model: this.config.model,
      max_tokens: this.config.maxTokens ?? 4096,
      temperature: this.config.temperature ?? 0,
      stream: false,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    };

    // Try OpenAI-compatible endpoint first (works with LM Studio, LocalAI, vLLM)
    let url = `${this.baseUrl}/v1/chat/completions`;

    // Check if this is Ollama (different endpoint structure)
    if (this.baseUrl.includes('11434') || this.baseUrl.includes('ollama')) {
      url = `${this.baseUrl}/api/chat`;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add API key if provided (some local servers require it)
    if (this.config.apiKey && this.config.apiKey !== 'not-needed') {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Local API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const latencyMs = Date.now() - startTime;

    // Handle Ollama response format
    if ('message' in data) {
      return {
        content: data.message?.content ?? '',
        usage: {
          inputTokens: data.prompt_eval_count ?? 0,
          outputTokens: data.eval_count ?? 0,
        },
        latencyMs,
        raw: data,
      };
    }

    // Handle OpenAI-compatible response format
    return {
      content: data.choices?.[0]?.message?.content ?? '',
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      },
      latencyMs,
      raw: data,
    };
  }
}
