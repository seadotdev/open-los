export interface EvalScenario {
  name: string;
  description: string;

  /** Pre-seed data before the agent starts */
  initial_state?: {
    deals?: Array<Record<string, unknown>>;
    entities?: Array<Record<string, unknown>>;
  };

  /** What the agent should accomplish */
  goal: {
    description: string;
    /** Checks to verify the goal was met */
    checks: EvalCheck[];
  };

  /** Constraints on the agent */
  constraints?: {
    max_steps?: number;
    max_time_seconds?: number;
  };
}

export interface EvalCheck {
  name: string;
  /** Type of check */
  type: "api_state" | "audit_contains" | "count" | "custom";
  /** Endpoint to check */
  endpoint?: string;
  /** JSONPath expression for the value */
  path?: string;
  /** Expected value or condition */
  expect: unknown;
  /** Weight for scoring */
  weight?: number;
}

export interface EvalResult {
  scenario: string;
  passed: boolean;
  score: number;
  max_score: number;
  duration_ms: number;
  steps_taken: number;
  checks: CheckResult[];
  errors: string[];
}

export interface CheckResult {
  name: string;
  passed: boolean;
  expected: unknown;
  actual: unknown;
  weight: number;
}

export interface AgentAdapter {
  name: string;
  /** Execute a single step - returns the API calls made */
  executeGoal(goal: string, apiUrl: string, token: string): Promise<{
    steps: number;
    calls: ApiCall[];
  }>;
}

export interface ApiCall {
  method: string;
  path: string;
  status: number;
  duration_ms: number;
}
