/**
 * OpenRouter LLM client with forced tool_choice + prose/JSON recovery.
 *
 * Not all models reliably support forced tool_choice — see
 * docs/llm-structured-output-compat.md for tested models and failure patterns.
 */
import OpenAI from 'openai'
import type { FunctionParameters } from 'openai/resources/shared'
import type { LLMClient, LLMOptions, LLMStructuredOptions } from '../types.js'
import { validateStructuredOutput } from './schema-validate.js'
import { parseStructuredFromAssistantMessage } from './structured-parse.js'

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

  async structured<T>(prompt: string, schema: object, options?: LLMStructuredOptions): Promise<T> {
    let lastError = 'No tool call in OpenRouter response'
    for (let attempt = 1; attempt <= 2; attempt++) {
      const start = Date.now()
      const messages: Array<{ role: 'system' | 'user'; content: string }> = []
      if (options?.system) {
        messages.push({ role: 'system', content: options.system })
      }
      messages.push({ role: 'user', content: prompt })

      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 2048,
        temperature: 0.2,
        messages,
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
        try {
          const parsed = JSON.parse(toolCall.function.arguments) as unknown
          const validationErrors = validateStructuredOutput(parsed, schema)
          if (validationErrors.length === 0) {
            return parsed as T
          }
          lastError = `Structured output schema mismatch: ${validationErrors.join('; ')}`
          continue
        } catch (err: any) {
          lastError = `Tool-call JSON parse failed: ${err?.message ?? 'unknown error'}`
          continue
        }
      }

      // Recovery path for models that accept tools but return prose text.
      const parsedFromText = parseStructuredFromAssistantMessage<T>(
        response.choices[0]?.message?.content,
        schema
      )
      if (parsedFromText.value !== undefined) {
        return parsedFromText.value
      }
      lastError = parsedFromText.error ?? 'No structured output in tool call or assistant text'
    }
    throw new Error(lastError)
  }
}
