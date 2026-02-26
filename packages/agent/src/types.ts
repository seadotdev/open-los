/**
 * Shared types for the Loan Origination Agent.
 *
 * These interfaces define the service contracts that the agent depends on.
 * The adapter layer (adapters/los-adapter.ts) implements these by wrapping
 * the real core services from AppContext.
 */

// ============================================
// Service interfaces the agent consumes
// ============================================

export interface AgentDealService {
  create(params: any): Promise<any>
  get(id: string): Promise<any>
  list(params: any): Promise<any[]>
  getPendingApprovals(tenantId: string): Promise<any[]>
}

export interface AgentStageService {
  checkGuards(dealId: string, stage: string): Promise<{ satisfied: boolean; unsatisfied: any[] }>
  checkGuard(dealId: string, guard: any): Promise<boolean>
  getGuards(stage: string): Promise<any[]>
  transition(dealId: string, stage: string, params: any): Promise<void>
}

export interface AgentDocumentService {
  create(params: any): Promise<any>
  listByDeal(dealId: string): Promise<any[]>
}

export interface AgentEntityService {
  create(params: any): Promise<any>
}

export interface AgentRelationshipService {
  getBorrowerGroup(primaryEntityId: string): Promise<{
    entities: any[]
    relationships: any[]
  }>
}

export interface AgentSpreadService {
  create(params: any): Promise<any>
  getRatios(dealId: string): Promise<any>
}

export interface AgentCovenantService {
  list(dealId: string): Promise<any[]>
}

export interface AgentFacilityService {
  create(params: any): Promise<any>
}

export interface AgentLoanService {
  create(params: any): Promise<any>
}

export interface AgentMonitoringService {
  ingestTransactions(params: any): Promise<void>
  getAlerts(tenantId: string): Promise<any[]>
}

export interface AgentAuditService {
  listByDeal(dealId: string): Promise<any[]>
}

export interface AgentApprovalsService {
  get(id: string): Promise<any>
  decide(id: string, params: any): Promise<void>
}

// ============================================
// Composite service interface
// ============================================

export interface OpenLOSServices {
  deals: AgentDealService
  stages: AgentStageService
  documents: AgentDocumentService
  entities: AgentEntityService
  relationships: AgentRelationshipService
  spreads: AgentSpreadService
  covenants: AgentCovenantService
  facilities: AgentFacilityService
  loans: AgentLoanService
  monitoring: AgentMonitoringService
  audit: AgentAuditService
  approvals: AgentApprovalsService
}

// ============================================
// LLM client interface
// ============================================

export interface LLMOptions {
  temperature?: number
  maxTokens?: number
  model?: string
  fallbackModels?: string[]
  providerOptions?: Record<string, unknown>
}

export interface LLMStructuredOptions {
  system?: string
  temperature?: number
  maxTokens?: number
  model?: string
  fallbackModels?: string[]
  providerOptions?: Record<string, unknown>
}

export interface LLMClient {
  complete(prompt: string, options?: LLMOptions): Promise<string>
  structured<T>(prompt: string, schema: object, options?: LLMStructuredOptions): Promise<T>
}

export type LLMProvider = 'anthropic' | 'openrouter' | 'openai' | 'vercel'

export interface LLMRouteConfig {
  provider: LLMProvider
  model: string
  apiKey?: string
  baseURL?: string
  fallbackModels?: string[]
  providerOptions?: Record<string, unknown>
}

export interface LLMConfig {
  defaultProvider: LLMProvider
  defaultModel: string
  apiKeys: Record<string, string>
  baseURLs?: Partial<Record<LLMProvider, string>>
  routes?: Record<string, LLMRouteConfig>
}

// ============================================
// Agent configuration
// ============================================

export interface AgentConfig {
  los: OpenLOSServices
  llm: LLMClient
  tenantId?: string
}

export interface AgentContext {
  tenantId: string
  actor: string
  dealId?: string
}
