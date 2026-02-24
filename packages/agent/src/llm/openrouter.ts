import OpenAI from 'openai'
import type { FunctionParameters } from 'openai/resources/shared'
import type { LLMClient, LLMOptions } from '../types.js'

export interface OpenRouterClientConfig {
  apiKey: string
  model?: string
}

export class OpenRouterClient implements LLMClient {
  private client: OpenAI
  private model: string
  public tokensIn = 0
  public tokensOut = 0
  public latencyMs = 0

  constructor(config: OpenRouterClientConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
    })
    this.model = config.model ?? 'anthropic/claude-sonnet-4-5-20250929'
  }

  async complete(prompt: string, options?: LLMOptions): Promise<string> {
    const start = Date.now()
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: options?.maxTokens ?? 2048,
      temperature: options?.temperature ?? 0.3,
      messages: [{ role: 'user', content: prompt }],
    })
    this.latencyMs += Date.now() - start
    this.tokensIn += response.usage?.prompt_tokens ?? 0
    this.tokensOut += response.usage?.completion_tokens ?? 0

    return response.choices[0]?.message?.content ?? ''
  }

  async structured<T>(prompt: string, schema: object): Promise<T> {
    const start = Date.now()
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 2048,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'structured_output',
            description: 'Return structured data matching the schema',
            parameters: schema as FunctionParameters,
          },
        },
      ],
      tool_choice: { type: 'function', function: { name: 'structured_output' } },
    })
    this.latencyMs += Date.now() - start
    this.tokensIn += response.usage?.prompt_tokens ?? 0
    this.tokensOut += response.usage?.completion_tokens ?? 0

    const toolCall = response.choices[0]?.message?.tool_calls?.[0]
    if (toolCall?.function?.arguments) {
      return JSON.parse(toolCall.function.arguments) as T
    }
    throw new Error('No tool call in OpenRouter response')
  }
}
