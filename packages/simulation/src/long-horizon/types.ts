/**
 * Long-Horizon Benchmark Types
 *
 * Inspired by LongCLI-Bench (arxiv.org/abs/2602.14337), this benchmark
 * tests LLM ability to execute long, multi-step CLI sessions that simulate
 * realistic "day-in-the-life" loan origination workflows.
 *
 * Key differences from the CRM test:
 * - Multi-turn: each session is a conversation with 10-25+ dependent steps
 * - Stateful: outputs from step N (deal IDs, entity IDs) feed into step N+1
 * - Step-level scoring: pinpoints exactly where the model breaks down
 * - Context accumulation: system prompt grows with each step's results
 * - Regression detection: ensures earlier steps aren't forgotten
 */

import type { TaskCategory, ValidatorType } from "../crm-test/types.js";

// ============================================================================
// SESSION DEFINITIONS
// ============================================================================

/**
 * A long-horizon session represents a full "day-in-the-life" scenario
 * for a loan officer / credit analyst / portfolio manager.
 */
export interface Session {
  id: string;
  /** Human-readable session title */
  name: string;
  /** What role is the user playing */
  persona: SessionPersona;
  /** Narrative description of what this session simulates */
  description: string;
  /** Difficulty level based on number of steps and complexity */
  difficulty: "standard" | "complex" | "expert";
  /** Total expected number of CLI commands across all steps */
  expectedCommandCount: number;
  /** The ordered steps in this session */
  steps: SessionStep[];
  /** Tags for filtering */
  tags: string[];
}

/** The role being simulated */
export type SessionPersona =
  | "loan_officer"
  | "credit_analyst"
  | "portfolio_manager"
  | "relationship_manager"
  | "operations_analyst";

/**
 * A single step within a long-horizon session.
 *
 * Each step gives the LLM a natural language instruction that depends on
 * the accumulated state from previous steps. The LLM must produce correct
 * CLI commands that reference IDs and data from earlier in the session.
 */
export interface SessionStep {
  id: string;
  /** Step number within the session (1-based) */
  stepNumber: number;
  /** Human-readable description */
  name: string;
  /** The natural language instruction for this step */
  prompt: string;
  /** Category of operation for scoring breakdown */
  category: TaskCategory;
  /**
   * Variables this step needs from previous steps' outputs.
   * Key = variable name used in prompt (e.g., "deal_id"),
   * Value = which step produced it (e.g., "step_1.deal_id").
   * These get injected into the prompt template at runtime.
   */
  dependsOn: Record<string, string>;
  /**
   * Variables this step produces that later steps can reference.
   * Key = variable name, Value = description of what it is.
   */
  produces: Record<string, string>;
  /** Validators for this step's response */
  validators: StepValidator[];
  /**
   * Whether this is a "checkpoint" step that the LLM must pass
   * for subsequent steps to make sense. If a checkpoint fails,
   * later steps that depend on it are marked as "blocked".
   */
  isCheckpoint: boolean;
  /** Whether this step involves referencing data from N steps ago (tests long-range memory) */
  longRangeRef?: {
    /** How many steps back the reference goes */
    distance: number;
    /** What is being referenced */
    description: string;
  };
}

/**
 * Validator for a single step in the session.
 * Similar to CRM test validators but extended with session-aware checks.
 */
export interface StepValidator {
  type: StepValidatorType;
  description: string;
  weight: number;
  config: Record<string, unknown>;
}

export type StepValidatorType =
  | ValidatorType
  | "references_previous_id"    // Correctly uses an ID from a previous step
  | "context_consistency"       // Maintains consistency with earlier context
  | "multi_command_count"       // Produces the expected number of commands
  | "no_repeated_creation";     // Doesn't re-create something that already exists

// ============================================================================
// EXECUTION RESULTS
// ============================================================================

/** Result of running a single step */
export interface StepResult {
  stepId: string;
  stepNumber: number;
  stepName: string;
  category: TaskCategory;
  modelId: string;
  /** The prompt actually sent (with variables substituted) */
  resolvedPrompt: string;
  /** Raw LLM response */
  rawResponse: string;
  /** Validator results */
  validatorResults: StepValidatorResult[];
  /** Weighted score (0-100) */
  score: number;
  /** Whether the step passed (score >= 70) */
  passed: boolean;
  /** Time to generate response (ms) */
  latencyMs: number;
  /** Token usage */
  tokens?: { prompt: number; completion: number; total: number };
  /** Response type */
  responseType: "success" | "refusal" | "error" | "timeout" | "empty" | "blocked";
  /** Error message if any */
  error?: string;
  /**
   * IDs / values extracted from the response that later steps need.
   * Populated by the runner from the step's `produces` spec.
   */
  extractedValues: Record<string, string>;
  /** Cumulative conversation token count at this step */
  cumulativeTokens: number;
  /** Whether this step was blocked due to a failed checkpoint */
  blockedBy?: string;
}

export interface StepValidatorResult {
  validatorType: StepValidatorType;
  description: string;
  passed: boolean;
  score: number;
  weight: number;
  details: string;
}

// ============================================================================
// SESSION RESULTS
// ============================================================================

/** Result of running a full session for a single model */
export interface SessionResult {
  sessionId: string;
  sessionName: string;
  persona: SessionPersona;
  difficulty: string;
  modelId: string;
  modelName: string;
  /** Individual step results in order */
  stepResults: StepResult[];
  /** Overall session score (0-100) */
  overallScore: number;
  /** How far the model got before "derailing" (first failed checkpoint) */
  derailPoint: number | null;
  /** Completion rate: steps passed / total steps */
  completionRate: number;
  /** Score by category */
  categoryScores: Record<string, { score: number; steps: number; passed: number }>;
  /** Step-level scoring curve (shows score decay over session length) */
  scoreCurve: number[];
  /** Total tokens used */
  totalTokens: { prompt: number; completion: number };
  /** Total latency */
  totalLatencyMs: number;
  /** Failure analysis */
  failures: SessionFailure[];
}

/** Describes a specific failure in the session */
export interface SessionFailure {
  stepId: string;
  stepNumber: number;
  failureType: SessionFailureType;
  description: string;
  /** How many subsequent steps were affected */
  cascadeCount: number;
}

export type SessionFailureType =
  | "wrong_command"          // Used the wrong CLI command
  | "missing_id_reference"  // Failed to use an ID from a previous step
  | "stale_id_reference"    // Used an ID from the wrong step
  | "hallucinated_command"  // Invented a command that doesn't exist
  | "wrong_sequence"        // Commands in wrong order
  | "context_forgotten"     // Forgot information from earlier in the session
  | "over_specification"    // Redundantly specified defaults
  | "missing_flags"         // Omitted required flags
  | "wrong_flag_value"      // Flag has incorrect value
  | "empty_response"        // Returned empty/refusal
  | "blocked_by_checkpoint" // Was blocked due to earlier checkpoint failure
  | "repeated_creation";    // Re-created something that already exists

// ============================================================================
// BENCHMARK REPORT
// ============================================================================

/** Full benchmark report across all sessions and models */
export interface BenchmarkReport {
  runId: string;
  runAt: string;
  benchmarkVersion: string;
  /** Models tested */
  models: string[];
  /** Sessions run */
  sessionsRun: number;
  /** Total steps across all sessions */
  totalSteps: number;
  /** Per-model session results */
  modelResults: Record<string, SessionResult[]>;
  /** Rankings */
  rankings: BenchmarkRanking[];
  /** Aggregate analysis */
  analysis: BenchmarkAnalysis;
}

export interface BenchmarkRanking {
  rank: number;
  modelId: string;
  /** Average score across all sessions */
  avgScore: number;
  /** Average completion rate */
  avgCompletionRate: number;
  /** Average derail point (how far they get) */
  avgDerailPoint: number | null;
  /** Total tokens used */
  totalTokens: number;
}

export interface BenchmarkAnalysis {
  /** At which step number do models typically start failing? */
  avgDerailStep: number | null;
  /** Score degradation curve (average score at step 1, 2, 3, ...) */
  avgScoreCurve: number[];
  /** Which categories are hardest across all models */
  hardestCategories: Array<{ category: string; avgScore: number }>;
  /** Most common failure types */
  topFailureTypes: Array<{ type: SessionFailureType; count: number; pct: number }>;
  /** Sessions where models diverge most */
  highVarianceSessions: Array<{
    sessionId: string;
    sessionName: string;
    scores: Record<string, number>;
    spread: number;
  }>;
}

// ============================================================================
// RUNNER CONFIG
// ============================================================================

export interface LongHorizonConfig {
  /** OpenRouter API key */
  apiKey: string;
  /** Models to test */
  models: LHModelConfig[];
  /** Base URL for OpenRouter API */
  baseUrl: string;
  /** Timeout per request (ms) */
  timeoutMs: number;
  /** Number of retries on transient failures */
  retries: number;
  /** Sessions to run (empty = all) */
  sessionFilter?: string[];
  /** Whether to print verbose output */
  verbose: boolean;
  /** Enable tool calling mode */
  toolCalling?: boolean;
}

export interface LHModelConfig {
  id: string;
  name: string;
  maxTokens: number;
  temperature: number;
}
