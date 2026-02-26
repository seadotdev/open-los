/**
 * @open-los/agent
 *
 * Loan Origination Agent Service
 *
 * Transforms open-los from software into an outcome-delivering service.
 */

export { LoanOriginationAgent } from './agent'
export * from './interface/types'
export * from './types'
export { createLLMClient } from './llm/index'
export { resolveLLMRoute } from './llm/index'
export { createAgentServices } from './adapters/los-adapter'
export type { CoreServices, AdapterContext } from './adapters/los-adapter'
export { buildUnderwritingPrompt, evaluateStandalone } from './underwrite'
export type { UnderwritePolicy, ModelConfig, UnderwriteContext } from './underwrite'
