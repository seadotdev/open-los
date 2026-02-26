/**
 * OpenRouter LLM client with forced tool_choice + prose/JSON recovery.
 *
 * Not all models reliably support forced tool_choice - see
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
  baseURL?: string
  defaultModel?: string
  headers?: Record<string, string>
}

/**
 * Models that use internal reasoning tokens (o1-style).
 * These need max_completion_tokens instead of max_tokens, and
 * reasoning_effort: "low" for structured output to avoid exhausting
 * the token budget on thinking before producing a tool call.
 */
const REASONING_MODEL_PATTERNS = [
  'openai/o1', 'openai/o3', 'openai/o4',
  'openai/gpt-5',
  'x-ai/grok-3-mini', 'x-ai/grok-4',
]

function isReasoningModel(model: string): boolean {
  return REASONING_MODEL_PATTERNS.some(p => model.startsWith(p))
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
      baseURL: config.baseURL ?? 'https://openrouter.ai/api/v1',
      defaultHeaders: config.headers,
    })
    this.model = config.model ?? config.defaultModel ?? 'anthropic/claude-sonnet-4-5-20250929'
  }

  private resolveModel(options?: LLMOptions): string | string[] {
    const primary = options?.model ?? this.model
    if (options?.fallbackModels && options.fallbackModels.length > 0) {
      return [primary, ...options.fallbackModels]
    }
    return primary
  }

  private resolvePrimaryModel(options?: LLMOptions): string {
    return options?.model ?? this.model
  }

  private resolveModelLabel(options?: LLMOptions): string {
    const model = this.resolveModel(options)
    return Array.isArray(model) ? model.join(', ') : model
  }

  private applyProviderOptions(
    request: Record<string, unknown>,
    options?: LLMOptions
  ): Record<string, unknown> {
    if (options?.providerOptions) {
      request.providerOptions = options.providerOptions
    }
    return request
  }

  async complete(prompt: string, options?: LLMOptions): Promise<string> {
    const start = Date.now()
    const request = this.applyProviderOptions(
      {
        model: this.resolveModel(options),
        max_tokens: options?.maxTokens ?? 2048,
        temperature: options?.temperature ?? 0.3,
        messages: [{ role: 'user', content: prompt }],
      },
      options
    )

    const response = await this.client.chat.completions.create(request as any)
    this.latencyMs += Date.now() - start
    this.tokensIn += response.usage?.prompt_tokens ?? 0
    this.tokensOut += response.usage?.completion_tokens ?? 0

    return response.choices[0]?.message?.content ?? ''
  }

  async structured<T>(prompt: string, schema: object, options?: LLMStructuredOptions): Promise<T> {
    let lastError = 'No tool call in OpenRouter response'

    for (let attempt = 1; attempt <= 2; attempt++) {
      const start = Date.now()
      const primaryModel = this.resolvePrimaryModel(options)
      const model = this.resolveModel(options)
      const reasoning = isReasoningModel(primaryModel)
      const tokenParam = reasoning
        ? { max_completion_tokens: options?.maxTokens ?? 4096 }
        : { max_tokens: options?.maxTokens ?? 2048 }

      const messages: Array<{ role: 'system' | 'user'; content: string }> = []
      if (options?.system) {
        messages.push({ role: 'system', content: options.system })
      }
      messages.push({ role: 'user', content: prompt })

      let response: any
      try {
        const request = this.applyProviderOptions(
          {
            model,
            ...tokenParam,
            temperature: options?.temperature ?? 0.2,
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
            ...(reasoning ? ({ reasoning_effort: 'low' } as any) : {}),
          },
          options
        )
        response = await this.client.chat.completions.create(request as any)
      } catch (toolErr: any) {
        const msg = toolErr?.message ?? ''
        if (msg.includes('tool use') || msg.includes('tool_choice') || toolErr?.status === 404) {
          const jsonHint = '\n\nIMPORTANT: You MUST respond with ONLY a valid JSON object (no markdown, no commentary).'
          const fallbackMessages: Array<{ role: 'system' | 'user'; content: string }> = []
          if (options?.system) {
            fallbackMessages.push({ role: 'system', content: options.system })
          }
          fallbackMessages.push({ role: 'user', content: prompt + jsonHint })

          const fallbackRequest = this.applyProviderOptions(
            {
              model,
              ...tokenParam,
              temperature: options?.temperature ?? 0.2,
              messages: fallbackMessages,
              ...(reasoning ? ({ reasoning_effort: 'low' } as any) : {}),
            },
            options
          )
          response = await this.client.chat.completions.create(fallbackRequest as any)
        } else {
          throw toolErr
        }
      }

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

      const parsedFromText = parseStructuredFromAssistantMessage<T>(
        response.choices[0]?.message?.content,
        schema
      )
      if (parsedFromText.value !== undefined) {
        return parsedFromText.value
      }

      lastError = parsedFromText.error ?? 'No structured output in tool call or assistant text'
    }

    throw new Error(`No structured output from model ${this.resolveModelLabel(options)}: ${lastError}`)
  }
}
