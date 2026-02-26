import OpenAI from 'openai'
import type { FunctionParameters } from 'openai/resources/shared'
import type { LLMClient, LLMOptions, LLMStructuredOptions, LLMUsageSnapshot } from '../types.js'
import { validateStructuredOutput } from './schema-validate.js'
import { parseStructuredFromAssistantMessage } from './structured-parse.js'
import { extractUsageFromResponse } from './usage.js'

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
  private rawTokensIn = 0
  private rawTokensOut = 0
  private billedTokensIn = 0
  private billedTokensOut = 0
  private billedCostUsd = 0
  private hasBilledTokensIn = false
  private hasBilledTokensOut = false
  private hasBilledCost = false

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
    this.recordUsage(response)

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
      this.recordUsage(response)

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

  getUsage(): LLMUsageSnapshot {
    return {
      tokensIn: this.tokensIn,
      tokensOut: this.tokensOut,
      billedCostUsd: this.hasBilledCost ? this.billedCostUsd : undefined,
      rawTokensIn: this.rawTokensIn,
      rawTokensOut: this.rawTokensOut,
    }
  }

  private recordUsage(response: unknown): void {
    const usage = extractUsageFromResponse(response, {
      inputTokenPaths: [
        ['usage', 'prompt_tokens'],
        ['usage', 'input_tokens'],
        ['usage', 'promptTokens'],
        ['usage', 'inputTokens'],
      ],
      outputTokenPaths: [
        ['usage', 'completion_tokens'],
        ['usage', 'output_tokens'],
        ['usage', 'completionTokens'],
        ['usage', 'outputTokens'],
      ],
      billedInputTokenPaths: [
        ['usage', 'billed_prompt_tokens'],
        ['usage', 'billed_input_tokens'],
        ['usage', 'billable_prompt_tokens'],
        ['usage', 'billable_input_tokens'],
      ],
      billedOutputTokenPaths: [
        ['usage', 'billed_completion_tokens'],
        ['usage', 'billed_output_tokens'],
        ['usage', 'billable_completion_tokens'],
        ['usage', 'billable_output_tokens'],
      ],
      billedCostPaths: [
        ['usage', 'billed_cost_usd'],
        ['usage', 'total_cost_usd'],
        ['usage', 'cost_usd'],
        ['usage', 'total_cost'],
        ['usage', 'cost'],
        ['total_cost_usd'],
        ['cost_usd'],
        ['cost'],
      ],
      promptCostPaths: [
        ['usage', 'prompt_cost'],
        ['usage', 'input_cost'],
        ['usage', 'prompt_cost_usd'],
        ['usage', 'input_cost_usd'],
      ],
      completionCostPaths: [
        ['usage', 'completion_cost'],
        ['usage', 'output_cost'],
        ['usage', 'completion_cost_usd'],
        ['usage', 'output_cost_usd'],
      ],
    })

    this.rawTokensIn += usage.tokensIn
    this.rawTokensOut += usage.tokensOut

    if (usage.billedTokensIn !== undefined) {
      this.hasBilledTokensIn = true
      this.billedTokensIn += usage.billedTokensIn
    }
    if (usage.billedTokensOut !== undefined) {
      this.hasBilledTokensOut = true
      this.billedTokensOut += usage.billedTokensOut
    }
    if (usage.billedCostUsd !== undefined) {
      this.hasBilledCost = true
      this.billedCostUsd += usage.billedCostUsd
    }

    this.tokensIn = this.hasBilledTokensIn ? this.billedTokensIn : this.rawTokensIn
    this.tokensOut = this.hasBilledTokensOut ? this.billedTokensOut : this.rawTokensOut
  }
}
