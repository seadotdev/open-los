/**
 * Core types for the LLM CLI Testing Harness
 *
 * This harness tests how well different LLM models can understand and operate
 * the Open LOS system with varying levels of instruction clarity.
 */

// ============================================================================
// Model Provider Types
// ============================================================================

export type ModelProvider = 'anthropic' | 'openai' | 'google' | 'mistral' | 'local';

export interface ModelConfig {
  provider: ModelProvider;
  model: string;
  apiKey: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ProviderResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  latencyMs: number;
  raw?: unknown;
}

// ============================================================================
// Vagueness Levels
// ============================================================================

/**
 * Vagueness levels for test instructions:
 * - explicit: Full JSON examples with exact field names
 * - guided: Natural language with hints about required fields
 * - conversational: Natural request like a real user would ask
 * - vague: Minimal information, model must infer intent
 * - adversarial: Misleading or ambiguous instructions
 */
export type VaguenessLevel = 'explicit' | 'guided' | 'conversational' | 'vague' | 'adversarial';

export interface InstructionVariant {
  level: VaguenessLevel;
  instruction: string;
  hints?: string[];
}

// ============================================================================
// Test Scenarios
// ============================================================================

export interface TestScenario {
  id: string;
  name: string;
  description: string;
  category: ScenarioCategory;

  /** System context provided to the model */
  systemContext: string;

  /** The task instructions at different vagueness levels */
  instructions: InstructionVariant[];

  /** Expected API calls the model should generate */
  expectedCalls: ExpectedApiCall[];

  /** Validation rules for the scenario */
  validations: ValidationRule[];

  /** Setup state required before the test */
  setup?: TestSetup;
}

export type ScenarioCategory =
  | 'deal_lifecycle'
  | 'stage_transitions'
  | 'document_management'
  | 'entity_ownership'
  | 'covenant_testing'
  | 'monitoring'
  | 'multi_step_workflow';

export interface ExpectedApiCall {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  pathPattern: string;  // Regex pattern
  bodyValidation?: Record<string, unknown>;
  headerValidation?: Record<string, string>;
  critical: boolean;  // Must be present for scenario to pass
}

export interface TestSetup {
  deals?: Array<{
    id: string;
    borrower_name: string;
    stage?: string;
    [key: string]: unknown;
  }>;
  entities?: Array<{
    id: string;
    name: string;
    type: 'company' | 'person';
    [key: string]: unknown;
  }>;
  documents?: Array<{
    deal_id: string;
    doc_type: string;
    filename: string;
  }>;
  covenants?: Array<{
    id: string;
    deal_id: string;
    name: string;
    type: string;
    metric: string;
    operator: string;
    threshold: number;
  }>;
}

// ============================================================================
// Validation Framework
// ============================================================================

export interface ValidationRule {
  id: string;
  type: ValidationType;
  target: string;  // JSONPath or field name
  expected?: unknown;
  errorMessage: string;
}

export type ValidationType =
  | 'schema_compliance'
  | 'field_present'
  | 'field_value'
  | 'field_type'
  | 'api_call_made'
  | 'api_call_order'
  | 'header_present'
  | 'audit_event_created';

export interface ValidationResult {
  ruleId: string;
  passed: boolean;
  actual?: unknown;
  expected?: unknown;
  message: string;
}

// ============================================================================
// Experiment Execution
// ============================================================================

export interface ExperimentConfig {
  id: string;
  name: string;
  description: string;
  models: ModelConfig[];
  scenarios: string[];  // Scenario IDs
  vaguenessLevels: VaguenessLevel[];
  iterations: number;  // How many times to run each combination
  saveResponses: boolean;
  outputDir: string;
}

export interface ExperimentRun {
  experimentId: string;
  runId: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'failed';
  results: ScenarioResult[];
  summary?: ExperimentSummary;
}

export interface ScenarioResult {
  scenarioId: string;
  model: string;
  vaguenessLevel: VaguenessLevel;
  iteration: number;

  /** The instruction given to the model */
  instruction: string;

  /** Raw response from the model */
  modelResponse: string;

  /** Parsed API calls extracted from response */
  extractedCalls: ExtractedApiCall[];

  /** Validation results */
  validations: ValidationResult[];

  /** Did the model successfully complete the scenario? */
  success: boolean;

  /** Failure reason if unsuccessful */
  failureReason?: string;

  /** Performance metrics */
  metrics: {
    latencyMs: number;
    inputTokens: number;
    outputTokens: number;
    apiCallsGenerated: number;
    validationsPassed: number;
    validationsFailed: number;
  };
}

export interface ExtractedApiCall {
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
  matched: boolean;  // Did this match an expected call?
}

export interface ExperimentSummary {
  totalScenarios: number;
  totalRuns: number;

  /** Success rate by model */
  byModel: Record<string, ModelSummary>;

  /** Success rate by vagueness level */
  byVagueness: Record<VaguenessLevel, VaguenessSummary>;

  /** Success rate by scenario category */
  byCategory: Record<ScenarioCategory, number>;

  /** Which touchpoints are most problematic? */
  touchpointFailures: TouchpointFailure[];
}

export interface ModelSummary {
  model: string;
  provider: ModelProvider;
  totalRuns: number;
  successfulRuns: number;
  successRate: number;
  avgLatencyMs: number;
  avgTokens: number;
  byVagueness: Record<VaguenessLevel, number>;
}

export interface VaguenessSummary {
  level: VaguenessLevel;
  totalRuns: number;
  successfulRuns: number;
  successRate: number;
  commonFailures: string[];
}

export interface TouchpointFailure {
  touchpoint: string;
  failureCount: number;
  failureRate: number;
  affectedScenarios: string[];
  commonErrors: string[];
}

// ============================================================================
// Touchpoint Definitions
// ============================================================================

/**
 * Critical touchpoints that must be validated
 */
export const TOUCHPOINTS = {
  // Header handling
  ACTOR_HEADER: 'X-Actor header extraction',
  TENANT_HEADER: 'X-Tenant-Id header extraction',

  // Deal operations
  DEAL_CREATE: 'Deal creation with required fields',
  DEAL_UPDATE: 'Deal update operations',
  DEAL_STAGE_TRANSITION: 'Stage transition validation',

  // Entity operations
  ENTITY_CREATE: 'Entity creation with type validation',
  RELATIONSHIP_CREATE: 'Relationship with ownership percentage',

  // Document handling
  DOCUMENT_UPLOAD: 'Document upload with correct type',

  // Financial operations
  SPREAD_CREATE: 'Financial spread with line items',
  RATIO_CALCULATION: 'Ratio computation accuracy',

  // Covenant operations
  COVENANT_CREATE: 'Covenant with operator validation',
  COVENANT_TEST: 'Covenant test execution',

  // Audit trail
  AUDIT_EVENT: 'Audit event creation',

  // Error handling
  VALIDATION_ERROR: 'Validation error responses',
  PERMISSION_ERROR: 'Permission denied responses',
} as const;

export type Touchpoint = keyof typeof TOUCHPOINTS;
