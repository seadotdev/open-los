import Anthropic from '@anthropic-ai/sdk'
import type { LLMClient, LLMOptions, LLMStructuredOptions, LLMUsageSnapshot } from '../types.js'
import { validateStructuredOutput } from './schema-validate.js'
import { extractUsageFromResponse } from './usage.js'

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
  private rawTokensIn = 0
  private rawTokensOut = 0
  private billedTokensIn = 0
  private billedTokensOut = 0
  private billedCostUsd = 0
  private hasBilledTokensIn = false
  private hasBilledTokensOut = false
  private hasBilledCost = false

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
    this.recordUsage(response)

    const textBlock = response.content.find((b) => b.type === 'text')
    return textBlock?.type === 'text' ? textBlock.text : ''
  }

  async structured<T>(prompt: string, schema: object, options?: LLMStructuredOptions): Promise<T> {
    let lastError = 'No tool_use block in Anthropic response'
    for (let attempt = 1; attempt <= 2; attempt++) {
      const start = Date.now()
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2048,
        temperature: 0.2,
        system: options?.system,
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
      this.recordUsage(response)

      const toolBlock = response.content.find((b) => b.type === 'tool_use')
      if (toolBlock?.type !== 'tool_use') {
        lastError = 'No tool_use block in Anthropic response'
        continue
      }

      const validationErrors = validateStructuredOutput(toolBlock.input, schema)
      if (validationErrors.length === 0) {
        return toolBlock.input as T
      }

      lastError = `Structured output schema mismatch: ${validationErrors.join('; ')}`
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
        ['usage', 'input_tokens'],
        ['usage', 'prompt_tokens'],
      ],
      outputTokenPaths: [
        ['usage', 'output_tokens'],
        ['usage', 'completion_tokens'],
      ],
      billedInputTokenPaths: [
        ['usage', 'billed_input_tokens'],
        ['usage', 'billable_input_tokens'],
      ],
      billedOutputTokenPaths: [
        ['usage', 'billed_output_tokens'],
        ['usage', 'billable_output_tokens'],
      ],
      billedCostPaths: [
        ['usage', 'billed_cost_usd'],
        ['usage', 'total_cost_usd'],
        ['usage', 'cost_usd'],
        ['usage', 'cost'],
        ['billing', 'total_cost_usd'],
        ['billing', 'cost_usd'],
        ['billing', 'cost'],
        ['total_cost_usd'],
        ['cost_usd'],
        ['cost'],
      ],
      promptCostPaths: [
        ['usage', 'input_cost'],
        ['usage', 'prompt_cost'],
        ['usage', 'input_cost_usd'],
        ['usage', 'prompt_cost_usd'],
      ],
      completionCostPaths: [
        ['usage', 'output_cost'],
        ['usage', 'completion_cost'],
        ['usage', 'output_cost_usd'],
        ['usage', 'completion_cost_usd'],
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
