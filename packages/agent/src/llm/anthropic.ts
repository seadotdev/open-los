import Anthropic from '@anthropic-ai/sdk'
import type { LLMClient, LLMOptions } from '../types.js'

export interface AnthropicClientConfig {
  apiKey: string
  model?: string
}

export class AnthropicClient implements LLMClient {
  private client: Anthropic
  private model: string
  public tokensIn = 0
  public tokensOut = 0
  public latencyMs = 0

  constructor(config: AnthropicClientConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey })
    this.model = config.model ?? 'claude-sonnet-4-5-20250929'
  }

  async complete(prompt: string, options?: LLMOptions): Promise<string> {
    const start = Date.now()
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: options?.maxTokens ?? 2048,
      temperature: options?.temperature ?? 0.3,
      messages: [{ role: 'user', content: prompt }],
    })
    this.latencyMs += Date.now() - start
    this.tokensIn += response.usage.input_tokens
    this.tokensOut += response.usage.output_tokens

    const textBlock = response.content.find((b) => b.type === 'text')
    return textBlock?.type === 'text' ? textBlock.text : ''
  }

  async structured<T>(prompt: string, schema: object): Promise<T> {
    const start = Date.now()
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
      tools: [
        {
          name: 'structured_output',
          description: 'Return structured data matching the schema',
          input_schema: schema as Anthropic.Tool['input_schema'],
        },
      ],
      tool_choice: { type: 'tool', name: 'structured_output' },
    })
    this.latencyMs += Date.now() - start
    this.tokensIn += response.usage.input_tokens
    this.tokensOut += response.usage.output_tokens

    const toolBlock = response.content.find((b) => b.type === 'tool_use')
    if (toolBlock?.type === 'tool_use') {
      return toolBlock.input as T
    }
    throw new Error('No tool_use block in Anthropic response')
  }
}
