import type { LLMClient } from '../types.js'
import { AnthropicClient } from './anthropic.js'
import { OpenRouterClient } from './openrouter.js'

export { AnthropicClient } from './anthropic.js'
export { OpenRouterClient } from './openrouter.js'

export function createLLMClient(
  provider: 'anthropic' | 'openrouter',
  config: { apiKey: string; model?: string }
): LLMClient {
  if (provider === 'anthropic') {
    return new AnthropicClient(config)
  }
  return new OpenRouterClient(config)
}
