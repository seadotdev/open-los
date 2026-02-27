import { OpenRouterClient, type OpenRouterClientConfig } from './openrouter.js'

export interface OpenAIClientConfig extends OpenRouterClientConfig {}

export class OpenAIClient extends OpenRouterClient {
  constructor(config: OpenAIClientConfig) {
    super({
      ...config,
      baseURL: config.baseURL ?? 'https://api.openai.com/v1',
      defaultModel: config.defaultModel ?? 'gpt-4.1-mini',
    })
  }
}
