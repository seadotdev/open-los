/**
 * CRM Model Test Harness Types
 *
 * Types for testing how well small LLMs handle CRM-type interactions
 * via the Open LOS CLI. Each test scenario gives the model a natural
 * language task and expects it to produce correct CLI commands.
 */

/** A single test task that an LLM must complete */
export interface TestTask {
  id: string;
  /** Human-readable task name */
  name: string;
  /** Category of CRM functionality being tested */
  category: TaskCategory;
  /** Difficulty level */
  difficulty: "easy" | "medium" | "hard";
  /** Natural language instruction given to the LLM */
  prompt: string;
  /** What the system prompt should contain (CLI help text, context, etc.) */
  systemContext: string;
  /** Validators that check the LLM's response */
  validators: Validator[];
  /** Optional: state from previous tasks that feeds into this one */
  dependsOn?: string[];
  /** Tags for filtering */
  tags: string[];
}

export type TaskCategory =
  | "deal_creation"
  | "deal_query"
  | "deal_update"
  | "entity_management"
  | "relationship_management"
  | "document_management"
  | "stage_transitions"
  | "financial_spreading"
  | "covenant_management"
  | "facility_management"
  | "loan_lifecycle"
  | "monitoring"
  | "multi_step_workflow"
  | "error_recovery"
  | "defaults_understanding"
  | "complex_deal_structure"
  | "refinancing"
  | "lender_buyout"
  | "gap_bridging";

/** Validator that checks a specific aspect of the LLM's response */
export interface Validator {
  type: ValidatorType;
  /** What this validator checks */
  description: string;
  /** Weight for scoring (0-1) */
  weight: number;
  /** Validator-specific config */
  config: Record<string, unknown>;
}

export type ValidatorType =
  | "contains_command"       // Response contains a specific CLI command
  | "command_structure"      // CLI command has correct structure (subcommand, flags)
  | "flag_present"           // A specific flag is present
  | "flag_value"             // A flag has the expected value
  | "no_hallucination"       // Doesn't invent flags/commands that don't exist
  | "json_parseable"         // Response contains parseable JSON where expected
  | "correct_sequence"       // Multiple commands are in correct order
  | "uses_defaults"          // Correctly relies on defaults rather than specifying everything
  | "error_handling"         // Correctly handles/suggests error recovery
  | "id_reference"           // Correctly references IDs from previous outputs
  | "regex_match"            // Custom regex match
  | "identifies_gap"         // Recognises when the CLI can't handle something
  | "creative_solution"      // Provides a workaround (script, manual step, etc.)
  | "multi_entity_graph"     // Entity relationships are properly modelled
  | "risk_awareness"         // Flags risks, conflicts, or missing safeguards
  | "scratchpad_quality";    // Uses scratchpad notes to reason through complexity

/** Result of running a single validator */
export interface ValidatorResult {
  validatorType: ValidatorType;
  description: string;
  passed: boolean;
  score: number;        // 0.0 to 1.0
  weight: number;
  details: string;      // Human-readable explanation
}

/** Result of a single test task for a single model */
export interface TaskResult {
  taskId: string;
  taskName: string;
  category: TaskCategory;
  difficulty: string;
  modelId: string;
  /** Raw LLM response */
  rawResponse: string;
  /** Individual validator results */
  validatorResults: ValidatorResult[];
  /** Weighted score (0-100) */
  score: number;
  /** Time to generate response (ms) */
  latencyMs: number;
  /** Token usage if available */
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  /** Whether the model refused or failed to respond */
  responseType: "success" | "refusal" | "error" | "timeout" | "empty";
  /** Error message if any */
  error?: string;
}

/** Aggregated results for a single model across all tasks */
export interface ModelReport {
  modelId: string;
  modelName: string;
  /** Overall score (0-100) */
  overallScore: number;
  /** Score by category */
  categoryScores: Record<TaskCategory, {
    score: number;
    tasksRun: number;
    tasksPassed: number;
  }>;
  /** Score by difficulty */
  difficultyScores: Record<string, {
    score: number;
    tasksRun: number;
    tasksPassed: number;
  }>;
  /** Common failure patterns */
  failurePatterns: FailurePattern[];
  /** Individual task results */
  taskResults: TaskResult[];
  /** Total cost estimate */
  totalTokens: { prompt: number; completion: number };
  /** Average latency */
  avgLatencyMs: number;
}

/** A pattern of failures observed across tasks */
export interface FailurePattern {
  pattern: string;
  description: string;
  occurrences: number;
  affectedTasks: string[];
  severity: "high" | "medium" | "low";
}

/** Full test suite report comparing all models */
export interface TestSuiteReport {
  runId: string;
  runAt: string;
  /** Models tested */
  models: string[];
  /** Total tasks per model */
  totalTasks: number;
  /** Per-model reports */
  modelReports: ModelReport[];
  /** Model ranking */
  rankings: Array<{
    rank: number;
    modelId: string;
    overallScore: number;
    strengths: string[];
    weaknesses: string[];
  }>;
  /** Tasks where models diverge most */
  highVarianceTasks: Array<{
    taskId: string;
    taskName: string;
    scores: Record<string, number>;
    spread: number;
  }>;
}

/** Configuration for the test runner */
export interface TestRunnerConfig {
  /** OpenRouter API key */
  apiKey: string;
  /** Models to test */
  models: ModelConfig[];
  /** Base URL for OpenRouter API */
  baseUrl: string;
  /** Timeout per request (ms) */
  timeoutMs: number;
  /** Number of retries on transient failures */
  retries: number;
  /** Tasks to run (empty = all) */
  taskFilter?: string[];
  /** Categories to test (empty = all) */
  categoryFilter?: TaskCategory[];
  /** Max concurrent requests */
  concurrency: number;
  /** Whether to print verbose output */
  verbose: boolean;
  /** Enable tool calling mode (send CLI commands as tool schemas) */
  toolCalling?: boolean;
}

/** Configuration for a model to test */
export interface ModelConfig {
  /** OpenRouter model ID (e.g., "google/gemma-2-9b-it:free") */
  id: string;
  /** Human-readable name */
  name: string;
  /** Max tokens to request */
  maxTokens: number;
  /** Temperature */
  temperature: number;
}

/** OpenAI-compatible tool definition for function calling */
export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, {
        type: string;
        description?: string;
        enum?: string[];
      }>;
      required?: string[];
    };
  };
}

/** A tool call returned by the model */
export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}
