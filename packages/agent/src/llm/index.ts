import type { LLMClient, LLMConfig, LLMRouteConfig, LLMProvider } from '../types.js'
import { AnthropicClient } from './anthropic.js'
import { OpenAIClient } from './openai.js'
import { OpenRouterClient } from './openrouter.js'
import { VercelGatewayClient } from './vercel.js'

export { AnthropicClient } from './anthropic.js'
export { OpenAIClient } from './openai.js'
export { OpenRouterClient } from './openrouter.js'
export { VercelGatewayClient } from './vercel.js'

export interface LLMClientConfig {
  apiKey: string
  model?: string
  baseURL?: string
  headers?: Record<string, string>
}

export function createLLMClient(
  provider: LLMProvider,
  config: LLMClientConfig
): LLMClient {
  if (provider === 'anthropic') {
    return new AnthropicClient(config)
  }

  if (provider === 'openai') {
    return new OpenAIClient(config)
  }

  if (provider === 'vercel') {
    return new VercelGatewayClient(config)
  }

  return new OpenRouterClient(config)
}

export function resolveLLMRoute(
  llmConfig: LLMConfig | undefined,
  functionName: string,
  override?: Partial<LLMRouteConfig>
): LLMRouteConfig | undefined {
  const configuredRoute = llmConfig?.routes?.[functionName]
  const defaultRoute: Partial<LLMRouteConfig> | undefined = llmConfig
    ? {
        provider: llmConfig.defaultProvider,
        model: llmConfig.defaultModel,
        baseURL: llmConfig.baseURLs?.[llmConfig.defaultProvider],
      }
    : undefined

  const baseRoute: Partial<LLMRouteConfig> | undefined = configuredRoute ?? defaultRoute
  if (!baseRoute && !override) return undefined

  const provider = override?.provider ?? baseRoute?.provider
  const model = override?.model ?? baseRoute?.model
  if (!provider || !model) return undefined

  const baseURL = override?.baseURL
    ?? baseRoute?.baseURL
    ?? llmConfig?.baseURLs?.[provider]

  const resolved: LLMRouteConfig = {
    provider,
    model,
    baseURL,
    apiKey: override?.apiKey
      ?? baseRoute?.apiKey
      ?? llmConfig?.apiKeys?.[provider],
    fallbackModels: override?.fallbackModels ?? baseRoute?.fallbackModels,
    providerOptions: override?.providerOptions ?? baseRoute?.providerOptions,
  }

  return resolved
}
