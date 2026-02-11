/**
 * Simulation Runner
 *
 * Core engine that executes simulations against the Open LOS API.
 * Each simulation represents a lending business persona attempting
 * to accomplish their workflow objectives.
 */

import type {
  Persona,
  Capability,
  SimulationScenario,
  SimulationResult,
  StepResult,
  WorkflowStep,
} from "../types.js";

export interface SimulationConfig {
  /** Base URL of the Open LOS API */
  baseUrl: string;
  /** Default tenant ID */
  tenantId: string;
  /** Request timeout in ms */
  timeout: number;
  /** Whether to reset database between simulations */
  resetBetweenRuns: boolean;
  /** Parallel simulation limit */
  concurrency: number;
  /** Verbose logging */
  verbose: boolean;
}

export const DEFAULT_CONFIG: SimulationConfig = {
  baseUrl: "http://localhost:3000",
  tenantId: "sim-tenant",
  timeout: 30000,
  resetBetweenRuns: true,
  concurrency: 1,
  verbose: false,
};

/**
 * HTTP client for making API requests
 */
class ApiClient {
  constructor(
    private config: SimulationConfig,
    private actor: string = "sim-agent"
  ) {}

  async request(
    method: string,
    path: string,
    body?: unknown
  ): Promise<{ status: number; data: unknown; duration: number }> {
    const start = Date.now();
    const url = `${this.config.baseUrl}${path}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Actor": this.actor,
      "X-Tenant-Id": this.config.tenantId,
    };

    const options: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(this.config.timeout),
    };

    if (body && method !== "GET") {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      const duration = Date.now() - start;

      let data: unknown;
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      return { status: response.status, data, duration };
    } catch (error) {
      const duration = Date.now() - start;
      return {
        status: 0,
        data: { error: error instanceof Error ? error.message : "Unknown error" },
        duration,
      };
    }
  }

  async get(path: string) {
    return this.request("GET", path);
  }

  async post(path: string, body: unknown) {
    return this.request("POST", path, body);
  }

  async postAs(path: string, body: unknown, actor: string) {
    return this.requestAs("POST", path, body, actor);
  }

  async requestAs(
    method: string,
    path: string,
    body: unknown,
    actor: string
  ): Promise<{ status: number; data: unknown; duration: number }> {
    const start = Date.now();
    const url = `${this.config.baseUrl}${path}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Actor": actor,
      "X-Tenant-Id": this.config.tenantId,
    };

    const options: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(this.config.timeout),
    };

    if (body && method !== "GET") {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      const duration = Date.now() - start;

      let data: unknown;
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      return { status: response.status, data, duration };
    } catch (error) {
      const duration = Date.now() - start;
      return {
        status: 0,
        data: { error: error instanceof Error ? error.message : "Unknown error" },
        duration,
      };
    }
  }

  async patch(path: string, body: unknown) {
    return this.request("PATCH", path, body);
  }

  async delete(path: string) {
    return this.request("DELETE", path);
  }
}

/**
 * Execution context for a simulation
 */
export interface ExecutionContext {
  client: ApiClient;
  persona: Persona;
  variables: Map<string, unknown>;
  stepResults: StepResult[];
}

/**
 * Step executor - converts workflow steps into API calls
 */
async function executeStep(
  ctx: ExecutionContext,
  step: WorkflowStep
): Promise<StepResult> {
  const startTime = new Date().toISOString();
  const startMs = Date.now();

  // Interpolate variables in params
  const params = interpolateParams(step.params, ctx.variables);

  let response: { status: number; data: unknown; duration: number };

  try {
    switch (step.action) {
      case "create_deal":
        response = await ctx.client.post("/v1/deals", params);
        if (response.status === 201 && response.data && typeof response.data === "object") {
          ctx.variables.set("deal_id", (response.data as any).id);
        }
        break;

      case "update_deal":
        response = await ctx.client.patch(
          `/v1/deals/${ctx.variables.get("deal_id")}`,
          params
        );
        break;

      case "transition_stage":
        // Stage transitions require an authorized actor — use "system" which
        // auto-gets credit_lead role, since simulation actors aren't pre-registered
        response = await ctx.client.postAs(
          `/v1/deals/${ctx.variables.get("deal_id")}/stage-transitions`,
          params,
          "system"
        );
        break;

      case "upload_document":
        response = await ctx.client.post(
          `/v1/deals/${ctx.variables.get("deal_id")}/documents`,
          params
        );
        break;

      case "create_entity":
        response = await ctx.client.post("/v1/entities", params);
        if (response.status === 201 && response.data && typeof response.data === "object") {
          ctx.variables.set("entity_id", (response.data as any).id);
        }
        break;

      case "create_relationship":
        // Link entity to deal via the deal's primary_entity_id field
        // The relationships endpoint is for entity-to-entity relationships
        const entityId = ctx.variables.get("entity_id");
        if (entityId) {
          response = await ctx.client.patch(
            `/v1/deals/${ctx.variables.get("deal_id")}`,
            { primary_entity_id: entityId }
          );
        } else {
          // Fallback for entity-to-entity relationships (owns, guarantees, directs)
          response = await ctx.client.post("/v1/relationships", params);
        }
        break;

      case "create_spread":
        response = await ctx.client.post(
          `/v1/deals/${ctx.variables.get("deal_id")}/spread`,
          params
        );
        break;

      case "define_covenant":
        response = await ctx.client.post(
          `/v1/deals/${ctx.variables.get("deal_id")}/covenants`,
          params
        );
        if (response.status === 201 && response.data && typeof response.data === "object") {
          ctx.variables.set("covenant_id", (response.data as any).id);
        }
        break;

      case "test_covenant":
        // Test covenants endpoint is at /v1/deals/:dealId/covenants/test
        // Optionally pass covenant_ids to test specific covenants
        const covenantId = ctx.variables.get("covenant_id");
        response = await ctx.client.post(
          `/v1/deals/${ctx.variables.get("deal_id")}/covenants/test`,
          covenantId ? { covenant_ids: [covenantId], ...params } : params
        );
        break;

      case "create_facility":
        // Facilities are nested under deals: POST /v1/deals/:dealId/facilities
        response = await ctx.client.post(
          `/v1/deals/${ctx.variables.get("deal_id")}/facilities`,
          params
        );
        if (response.status === 201 && response.data && typeof response.data === "object") {
          ctx.variables.set("facility_id", (response.data as any).id);
        }
        break;

      case "create_loan":
        // Create loan from facility: POST /v1/facilities/:facilityId/loans
        response = await ctx.client.post(
          `/v1/facilities/${ctx.variables.get("facility_id")}/loans`,
          {
            ...params,
            dealId: ctx.variables.get("deal_id"),
            accountHolderId: ctx.variables.get("entity_id"),
          }
        );
        if (response.status === 201 && response.data && typeof response.data === "object") {
          ctx.variables.set("loan_id", (response.data as any).id);
          ctx.variables.set("loan_amount", (response.data as any).loan_amount);
        }
        break;

      case "disburse_loan":
        // Disbursements use the transactions endpoint with type DISBURSEMENT
        // Use the loan amount from context if not explicitly specified
        const disbursementAmount = params.amount || ctx.variables.get("loan_amount");
        response = await ctx.client.post(
          `/v1/loans/${ctx.variables.get("loan_id")}/transactions`,
          {
            type: "DISBURSEMENT",
            amount: disbursementAmount,
            valueDate: params.value_date || new Date().toISOString().split("T")[0],
            notes: params.notes || "Loan disbursement",
          }
        );
        break;

      case "record_repayment":
        // Repayments use the transactions endpoint with type REPAYMENT
        response = await ctx.client.post(
          `/v1/loans/${ctx.variables.get("loan_id")}/transactions`,
          {
            type: "REPAYMENT",
            amount: params.amount,
            valueDate: params.value_date || new Date().toISOString().split("T")[0],
            notes: params.notes,
          }
        );
        break;

      case "ingest_transactions":
        response = await ctx.client.post(
          `/v1/deals/${ctx.variables.get("deal_id")}/monitoring/ingest`,
          params
        );
        break;

      case "check_monitoring":
        response = await ctx.client.get(
          `/v1/deals/${ctx.variables.get("deal_id")}/monitoring/status`
        );
        break;

      case "create_alert":
        response = await ctx.client.post("/v1/alerts", {
          ...params,
          deal_id: ctx.variables.get("deal_id"),
        });
        break;

      case "approve_loan":
        // Approve a loan account: POST /v1/loans/:loanId/transactions with type APPROVAL
        response = await ctx.client.post(
          `/v1/loans/${ctx.variables.get("loan_id")}/transactions`,
          {
            type: "APPROVAL",
            notes: "Approved by simulation",
          }
        );
        break;

      case "request_approval":
        response = await ctx.client.post("/v1/approvals", {
          ...params,
          deal_id: ctx.variables.get("deal_id"),
        });
        break;

      case "custom_api_call":
        const { method = "GET", path, body } = params as any;
        const interpolatedPath = interpolateString(path, ctx.variables);
        if (method === "GET") {
          response = await ctx.client.get(interpolatedPath);
        } else if (method === "POST") {
          response = await ctx.client.post(interpolatedPath, body);
        } else if (method === "PATCH") {
          response = await ctx.client.patch(interpolatedPath, body);
        } else if (method === "DELETE") {
          response = await ctx.client.delete(interpolatedPath);
        } else {
          response = { status: 0, data: { error: `Unknown method: ${method}` }, duration: 0 };
        }
        break;

      default:
        response = { status: 0, data: { error: `Unknown action: ${step.action}` }, duration: 0 };
    }
  } catch (error) {
    response = {
      status: 0,
      data: { error: error instanceof Error ? error.message : "Unknown error" },
      duration: Date.now() - startMs,
    };
  }

  // Determine success with refined logic
  const expectedSuccess = step.expectedOutcome.success;
  const actualSuccess =
    response.status >= 200 && response.status < 300;

  // Detect capability gaps
  const capabilityGap = detectCapabilityGap(step, response);

  // Refined success determination:
  // 1. If a capability gap is detected (404 route missing, 501 not implemented),
  //    mark as failed — that's a platform gap, not a step logic error.
  // 2. If response is 2xx and we expected success, it's a success regardless of
  //    exact status code (201 vs 200 shouldn't cause failure).
  // 3. If response is 400 (validation error) on a step that expected success,
  //    it's a step parameter issue, not a capability gap — still mark as failed
  //    but don't treat as a blocker.
  // 4. If response is 0 (network/timeout error), mark as failed.
  let success: boolean;
  if (capabilityGap.detected) {
    // Capability gap always means failure for the step
    success = false;
  } else if (response.status === 0) {
    // Network or timeout error
    success = false;
  } else {
    // Normal success/failure matching
    success = actualSuccess === expectedSuccess;
  }

  const result: StepResult = {
    stepId: step.id,
    success,
    statusCode: response.status,
    response: response.data,
    duration: response.duration,
    timestamp: startTime,
    capabilityGap,
  };

  if (!actualSuccess && response.data && typeof response.data === "object") {
    const errorData = response.data as any;
    if (errorData.error) {
      result.error = {
        code: errorData.error.code || "UNKNOWN",
        message: errorData.error.message || errorData.error,
        details: errorData.error.details,
      };
    }
  }

  return result;
}

/**
 * Detect if a step result indicates a capability gap (missing platform feature)
 * vs a normal step execution error (bad params, missing prerequisite, etc.)
 */
function detectCapabilityGap(
  step: WorkflowStep,
  response: { status: number; data: unknown }
): StepResult["capabilityGap"] {
  if (response.status === 404) {
    const errorData = response.data as any;
    const message = errorData?.error?.message || errorData?.message || "";
    const responseText = typeof response.data === "string" ? response.data : "";

    // Distinguish route-level 404 (capability gap) from resource-not-found 404.
    // Resource-not-found errors reference a specific ID (e.g., "Deal abc123 not found").
    // Route-level 404s are generic ("Not Found") or reference the endpoint path.
    const isResourceNotFound =
      message.includes("Deal ") ||
      message.includes("Entity ") ||
      message.includes("Loan ") ||
      message.includes("Facility ") ||
      message.includes("Covenant ") ||
      message.includes("Deposit account ");

    if (isResourceNotFound) {
      // This is a normal error — the resource doesn't exist yet, not a missing capability
      return { detected: false };
    }

    // Route-level 404 — the endpoint doesn't exist at all
    return {
      detected: true,
      description: `API endpoint not found: ${step.action} (${message || responseText || "404"})`,
      severity: "blocker",
    };
  }

  // 400 errors are validation issues, not capability gaps — except for specific patterns
  if (response.status === 400) {
    const errorData = response.data as any;
    const message = errorData?.error?.message || "";

    if (message.includes("not supported") || message.includes("not implemented")) {
      return {
        detected: true,
        description: `Feature not supported: ${message}`,
        severity: "major",
      };
    }

    // Normal validation error — not a capability gap
    return { detected: false };
  }

  // 501 Not Implemented is an explicit gap
  if (response.status === 501) {
    return {
      detected: true,
      description: "Feature not implemented",
      severity: "blocker",
    };
  }

  return { detected: false };
}

/**
 * Interpolate variables into params
 */
function interpolateParams(
  params: Record<string, unknown>,
  variables: Map<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      result[key] = interpolateString(value, variables);
    } else if (Array.isArray(value)) {
      // Preserve arrays — interpolate string values within them
      result[key] = value.map((item) => {
        if (typeof item === "string") {
          return interpolateString(item, variables);
        } else if (typeof item === "object" && item !== null) {
          return interpolateParams(item as Record<string, unknown>, variables);
        }
        return item;
      });
    } else if (typeof value === "object" && value !== null) {
      result[key] = interpolateParams(value as Record<string, unknown>, variables);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Interpolate variables in a string
 */
function interpolateString(str: string, variables: Map<string, unknown>): string {
  return str.replace(/\$\{(\w+)\}/g, (_, name) => {
    const value = variables.get(name);
    return value !== undefined ? String(value) : `\${${name}}`;
  });
}

/**
 * Run a single simulation scenario
 */
export async function runSimulation(
  scenario: SimulationScenario,
  persona: Persona,
  config: SimulationConfig = DEFAULT_CONFIG
): Promise<SimulationResult> {
  const client = new ApiClient(config, `sim-${persona.id}`);
  const startTime = new Date().toISOString();
  const startMs = Date.now();

  const ctx: ExecutionContext = {
    client,
    persona,
    variables: new Map(),
    stepResults: [],
  };

  // Execute each step
  for (const step of scenario.workflow) {
    if (config.verbose) {
      console.log(`  [${persona.id}] Executing step: ${step.description}`);
    }

    const result = await executeStep(ctx, step);
    ctx.stepResults.push(result);

    // Stop on blocker gaps
    if (result.capabilityGap?.severity === "blocker") {
      if (config.verbose) {
        console.log(`  [${persona.id}] Blocker gap detected, stopping simulation`);
      }
      break;
    }
  }

  // Aggregate results
  const completedAt = new Date().toISOString();
  const durationMs = Date.now() - startMs;

  // Extract capability gaps
  const capabilityGaps = ctx.stepResults
    .filter((r) => r.capabilityGap?.detected)
    .map((r) => ({
      capabilityId: r.capabilityGap!.capabilityId || "unknown",
      description: r.capabilityGap!.description || "Unknown gap",
      severity: r.capabilityGap!.severity || "minor",
      affectedSteps: [r.stepId],
      recommendation: generateRecommendation(r.capabilityGap!),
    }));

  const successfulSteps = ctx.stepResults.filter((r) => r.success).length;
  const failedSteps = ctx.stepResults.filter((r) => !r.success).length;

  return {
    id: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    scenarioId: scenario.id,
    personaId: persona.id,
    startedAt: startTime,
    completedAt,
    durationMs,
    overallSuccess: failedSteps === 0,
    stepResults: ctx.stepResults,
    capabilityGaps,
    summary: {
      totalSteps: ctx.stepResults.length,
      successfulSteps,
      failedSteps,
      blockerGaps: capabilityGaps.filter((g) => g.severity === "blocker").length,
      majorGaps: capabilityGaps.filter((g) => g.severity === "major").length,
      minorGaps: capabilityGaps.filter((g) => g.severity === "minor").length,
    },
  };
}

/**
 * Generate recommendation for a capability gap
 */
function generateRecommendation(gap: NonNullable<StepResult["capabilityGap"]>): string {
  if (!gap.detected) return "";

  if (gap.description?.includes("not found")) {
    return "Add new API endpoint to support this functionality";
  }
  if (gap.description?.includes("currency")) {
    return "Extend currency support in the data model and API";
  }
  if (gap.description?.includes("not supported")) {
    return "Implement support for this feature";
  }

  return "Investigate and implement required functionality";
}

/**
 * Run multiple simulations in parallel (with concurrency limit)
 */
export async function runSimulations(
  scenarios: Array<{ scenario: SimulationScenario; persona: Persona }>,
  config: SimulationConfig = DEFAULT_CONFIG
): Promise<SimulationResult[]> {
  const results: SimulationResult[] = [];
  const { concurrency } = config;

  for (let i = 0; i < scenarios.length; i += concurrency) {
    const batch = scenarios.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(({ scenario, persona }) =>
        runSimulation(scenario, persona, config)
      )
    );
    results.push(...batchResults);
  }

  return results;
}
