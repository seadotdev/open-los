import { OpenRouterClient, type OpenRouterClientConfig } from './openrouter.js'

export interface VercelGatewayClientConfig extends OpenRouterClientConfig {}

export class VercelGatewayClient extends OpenRouterClient {
  constructor(config: VercelGatewayClientConfig) {
    super({
      ...config,
      baseURL: config.baseURL ?? 'https://ai-gateway.vercel.sh/v1',
      defaultModel: config.defaultModel ?? 'openai/gpt-4.1-mini',
    })
  }
}
