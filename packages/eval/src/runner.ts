import type { EvalScenario, EvalResult, CheckResult, EvalCheck } from "./types.js";

export class EvalRunner {
  private apiUrl: string;
  private token?: string;

  constructor(apiUrl: string, token?: string) {
    this.apiUrl = apiUrl;
    this.token = token;
  }

  private async apiRequest(method: string, path: string, body?: unknown): Promise<unknown> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Actor": "eval-runner",
      "X-Tenant-Id": "eval",
    };
    if (this.token) headers["Authorization"] = `Bearer ${this.token}`;

    const res = await fetch(`${this.apiUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return undefined;
    return res.json();
  }

  async runScenario(scenario: EvalScenario): Promise<EvalResult> {
    const start = Date.now();
    const errors: string[] = [];
    const checks: CheckResult[] = [];

    // Setup initial state
    if (scenario.initial_state?.deals) {
      for (const deal of scenario.initial_state.deals) {
        try {
          await this.apiRequest("POST", "/v1/deals", deal);
        } catch (err) {
          errors.push(`Failed to seed deal: ${err}`);
        }
      }
    }
    if (scenario.initial_state?.entities) {
      for (const entity of scenario.initial_state.entities) {
        try {
          await this.apiRequest("POST", "/v1/entities", entity);
        } catch (err) {
          errors.push(`Failed to seed entity: ${err}`);
        }
      }
    }

    // Run checks
    for (const check of scenario.goal.checks) {
      try {
        const result = await this.evaluateCheck(check);
        checks.push(result);
      } catch (err) {
        checks.push({
          name: check.name,
          passed: false,
          expected: check.expect,
          actual: `Error: ${err}`,
          weight: check.weight || 1,
        });
      }
    }

    const score = checks.filter(c => c.passed).reduce((sum, c) => sum + c.weight, 0);
    const maxScore = checks.reduce((sum, c) => sum + c.weight, 0);

    return {
      scenario: scenario.name,
      passed: score === maxScore && errors.length === 0,
      score,
      max_score: maxScore,
      duration_ms: Date.now() - start,
      steps_taken: 0,
      checks,
      errors,
    };
  }

  private async evaluateCheck(check: EvalCheck): Promise<CheckResult> {
    // For api_state checks, hit the endpoint and verify the response
    if (check.type === "api_state" && check.endpoint) {
      const data = await this.apiRequest("GET", check.endpoint);
      const actual = check.path ? getNestedValue(data, check.path) : data;
      const passed = deepEqual(actual, check.expect);
      return { name: check.name, passed, expected: check.expect, actual, weight: check.weight || 1 };
    }

    if (check.type === "count" && check.endpoint) {
      const data = await this.apiRequest("GET", check.endpoint) as Record<string, unknown[]>;
      const key = Object.keys(data).find(k => Array.isArray(data[k]));
      const actual = key ? data[key].length : 0;
      const passed = actual === check.expect;
      return { name: check.name, passed, expected: check.expect, actual, weight: check.weight || 1 };
    }

    return {
      name: check.name,
      passed: false,
      expected: check.expect,
      actual: "unsupported check type",
      weight: check.weight || 1,
    };
  }
}

function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === "object" && a !== null && typeof b === "object" && b !== null) {
    const keysA = Object.keys(a as Record<string, unknown>);
    const keysB = Object.keys(b as Record<string, unknown>);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(k => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return false;
}
