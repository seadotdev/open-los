/**
 * Google Gemini provider
 * Supports: gemini-1.5-flash, gemini-1.5-pro, gemini-2.0-flash, etc.
 */

import type { ModelConfig, ProviderResponse } from '../types.js';
import { BaseProvider, type ChatMessage } from './base.js';

export class GoogleProvider extends BaseProvider {
  private baseUrl: string;

  constructor(config: ModelConfig) {
    super(config);
    this.baseUrl = config.baseUrl ?? 'https://generativelanguage.googleapis.com';
  }

  async chat(messages: ChatMessage[]): Promise<ProviderResponse> {
    const startTime = Date.now();

    // Convert messages to Gemini format
    const systemInstruction = messages.find(m => m.role === 'system');
    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        maxOutputTokens: this.config.maxTokens ?? 4096,
        temperature: this.config.temperature ?? 0,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: systemInstruction.content }],
      };
    }

    const url = `${this.baseUrl}/v1beta/models/${this.config.model}:generateContent?key=${this.config.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      candidates: Array<{
        content: { parts: Array<{ text: string }> };
      }>;
      usageMetadata: {
        promptTokenCount: number;
        candidatesTokenCount: number;
      };
    };

    const latencyMs = Date.now() - startTime;

    const content = data.candidates[0]?.content?.parts
      ?.map(p => p.text)
      ?.join('\n') ?? '';

    return {
      content,
      usage: {
        inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      },
      latencyMs,
      raw: data,
    };
  }
}
