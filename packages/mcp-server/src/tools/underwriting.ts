import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServiceContext } from "../context.js";
import { toolResult, toolError } from "../helpers.js";
import {
  LoanOriginationAgent,
  createLLMClient,
  createAgentServices,
} from "@open-los/agent";
import type {
  UnderwritingRun,
  RunCase,
  RunPolicy,
  RunDecision,
  DecisionTerms,
  DecisionRationale,
  RunTrace,
} from "@open-los/core";

// Schema

export const evaluateSchema = {
  deal_id: z.string(),
  mode: z
    .enum(["rules_only", "full"])
    .optional()
    .default("rules_only")
    .describe("rules_only = deterministic, full = LLM agent"),
  provider: z
    .enum(["anthropic", "openrouter"])
    .optional()
    .describe("LLM provider (only for mode=full)"),
  policy_id: z.string().optional(),
  model: z.string().optional(),
  persona: z.string().optional(),
  target_yield_pct: z.number().optional().default(10.0),
  max_single_loan: z.number().optional().default(500000),
  total_capital: z.number().optional(),
  sector_limits: z.record(z.number()).optional(),
  tenant_id: z.string().optional().default("default"),
  actor: z.string().optional().default("mcp-agent"),
};

// Handler

export async function handleEvaluate(
  ctx: ServiceContext,
  params: {
    deal_id: string;
    mode?: string;
    provider?: string;
    policy_id?: string;
    model?: string;
    persona?: string;
    target_yield_pct?: number;
    max_single_loan?: number;
    total_capital?: number;
    sector_limits?: Record<string, number>;
    tenant_id?: string;
    actor?: string;
  }
): Promise<UnderwritingRun> {
  const {
    deal_id: dealId,
    mode = "rules_only",
    tenant_id: tenantId = "default",
    actor = "mcp-agent",
    ...policyParams
  } = params;

  const startTime = Date.now();

  const policy = {
    policy_id: policyParams.policy_id,
    model: policyParams.model,
    persona: policyParams.persona,
    target_yield_pct: policyParams.target_yield_pct ?? 10.0,
    max_single_loan: policyParams.max_single_loan ?? 500000,
    total_capital: policyParams.total_capital,
    sector_limits: policyParams.sector_limits,
  };

  // --- Full Agent Mode ---
  if (mode === "full") {
    const provider = (params.provider ??
      ctx.llmConfig?.defaultProvider ??
      "anthropic") as "anthropic" | "openrouter";
    const apiKey = ctx.llmConfig?.apiKeys[provider] ?? "";

    if (apiKey) {
      const agentServices = createAgentServices(ctx as any, {
        tenantId,
        actor,
      });
      const llmClient = createLLMClient(provider, {
        apiKey,
        model: policy.model ?? ctx.llmConfig?.defaultModel,
      });
      const agent = new LoanOriginationAgent({
        los: agentServices,
        llm: llmClient,
        tenantId,
      });

      const runPolicy = {
        policy_id: policy.policy_id ?? `agent_${tenantId}`,
        model:
          policy.model ?? ctx.llmConfig?.defaultModel ?? "rules_only",
        params: {
          persona: policy.persona,
          target_yield_pct: policy.target_yield_pct,
          max_single_loan: policy.max_single_loan,
          total_capital: policy.total_capital,
          sector_limits: policy.sector_limits,
        },
      };

      const response = await agent.evaluate(dealId, runPolicy, {
        tenantId,
        actor,
      });

      await ctx.auditService.record({
        deal_id: dealId,
        type: "DEAL_UPDATED",
        actor,
        timestamp: new Date().toISOString(),
        changes: [
          {
            field: "evaluation",
            before: null,
            after: {
              run_id: response.run_id,
              action: response.decision.action,
              risk_grade: response.decision.risk_grade,
              mode: "full",
            },
          },
        ],
      });

      return response;
    }
    // No API key — fall through to rules_only
  }

  // --- Rules-Only Mode ---
  const deal = await ctx.dealService.getById(dealId, tenantId);
  const ratioResult = await ctx.spreadService.getRatios(dealId);
  const ratios: Record<string, unknown> =
    (ratioResult as any)?.ratios?.[0] ?? {};
  const docs = await ctx.documentService.listByDeal(dealId, tenantId);

  let auditResult: { events: unknown[] } = { events: [] };
  try {
    auditResult = await ctx.auditService.listByDeal(dealId);
  } catch {
    /* ok */
  }

  const requestedAmount = (deal as any).requested_amount ?? 0;
  const requestedAmountDollars = requestedAmount / 100;
  const maxLoan = policy.max_single_loan ?? 500000;
  const targetYield = policy.target_yield_pct ?? 10.0;

  const dscr =
    typeof ratios.dscr === "number" ? (ratios.dscr as number) : null;
  const grossMargin =
    typeof ratios.gross_margin === "number"
      ? (ratios.gross_margin as number)
      : null;

  let action: string = "approve";
  let riskGrade = "B";
  let confidence = 0.7;
  let probDefault = 0.05;
  const keyFactors: string[] = [];
  const conditions: string[] = [];
  const whatWouldChange: string[] = [];

  // Rule 1: Amount exceeds max
  if (requestedAmountDollars > maxLoan) {
    action = "decline";
    riskGrade = "D";
    confidence = 0.95;
    probDefault = 0.3;
    keyFactors.push(
      `Requested amount $${requestedAmountDollars.toLocaleString()} exceeds maximum $${maxLoan.toLocaleString()}`
    );
    whatWouldChange.push("Reduce loan amount below maximum threshold");
  }

  // Rule 2: DSCR check
  if (dscr !== null && dscr < 1.0) {
    action = "decline";
    riskGrade = "D";
    confidence = 0.9;
    probDefault = 0.4;
    keyFactors.push(`DSCR ${dscr.toFixed(2)}x is below 1.0x minimum`);
    whatWouldChange.push("Improve cash flow to achieve DSCR >= 1.2x");
  } else if (dscr !== null && dscr < 1.2) {
    if (action === "approve") action = "refer";
    riskGrade = "C";
    probDefault = 0.15;
    keyFactors.push(`DSCR ${dscr.toFixed(2)}x is marginal (below 1.2x)`);
    conditions.push("Quarterly financial reporting required");
  } else if (dscr !== null) {
    keyFactors.push(
      `DSCR ${dscr.toFixed(2)}x provides adequate debt service coverage`
    );
  }

  // Rule 3: Margin check
  if (grossMargin !== null && grossMargin < 0.1) {
    if (action === "approve") action = "refer";
    riskGrade = "C";
    probDefault = Math.max(probDefault, 0.2);
    keyFactors.push(
      `Gross margin ${(grossMargin * 100).toFixed(1)}% is very thin`
    );
    whatWouldChange.push("Improve gross margins above 15%");
  } else if (grossMargin !== null) {
    keyFactors.push(
      `Gross margin ${(grossMargin * 100).toFixed(1)}% is healthy`
    );
  }

  // Rule 4: Sector concentration
  if (policy.sector_limits && (deal as any).custom_fields) {
    const sector = ((deal as any).custom_fields as Record<string, unknown>)
      .sector as string;
    if (sector && policy.sector_limits[sector] !== undefined) {
      keyFactors.push(`Sector "${sector}" within concentration limits`);
    }
  }

  // Final grade
  if (action === "approve") {
    if (
      dscr !== null &&
      dscr >= 1.5 &&
      grossMargin !== null &&
      grossMargin >= 0.25
    ) {
      riskGrade = "A";
      probDefault = 0.02;
      confidence = 0.85;
    } else {
      riskGrade = "B";
      probDefault = 0.05;
      confidence = 0.75;
    }
  }

  // Build terms
  const terms: DecisionTerms = {};
  if (action === "approve" || action === "counter") {
    const baseRate = targetYield / 100;
    const riskPremium =
      riskGrade === "A" ? 0.0 : riskGrade === "B" ? 0.02 : 0.05;
    terms.amount =
      action === "counter"
        ? Math.min(requestedAmountDollars, maxLoan * 0.8)
        : requestedAmountDollars;
    terms.apr = baseRate + riskPremium;
    terms.tenor_months = 24;
    terms.fees = { origination: Math.round(terms.amount * 0.01) };
  }

  const rationale: DecisionRationale = {
    summary:
      action === "approve"
        ? `Approved based on ${keyFactors.length > 0 ? keyFactors[0].toLowerCase() : "acceptable risk profile"}.`
        : action === "decline"
          ? `Declined: ${keyFactors.length > 0 ? keyFactors[0] : "insufficient risk profile"}.`
          : `Referred for manual review: ${keyFactors.length > 0 ? keyFactors[0] : "marginal indicators"}.`,
    key_factors: keyFactors,
    what_would_change: whatWouldChange,
  };

  const latencyMs = Date.now() - startTime;
  const runId = randomUUID();

  const trace: RunTrace = {
    steps: [
      {
        t: new Date(startTime).toISOString(),
        type: "reasoning" as const,
        name: "rules_evaluation",
        content: `Evaluated ${Object.keys(ratios).length} financial ratios, ${Array.isArray(docs) ? docs.length : 0} documents`,
      },
    ],
    latency_ms: latencyMs,
    cost: { tokens_in: 0, tokens_out: 0, estimated_cost_usd: 0 },
  };

  const runCase: RunCase = {
    case_id: dealId,
    source: "production",
    segment: "smb_term_loan",
    jurisdiction: (deal as any).jurisdiction ?? "US",
    currency: "USD",
    requested_amount: requestedAmountDollars,
    requested_purpose: (deal as any).purpose ?? undefined,
  };

  const runPolicy: RunPolicy = {
    policy_id: policy.policy_id ?? `rules_${tenantId}`,
    model: policy.model ?? "rules_only",
    params: {
      persona: policy.persona,
      target_yield_pct: policy.target_yield_pct,
      max_single_loan: policy.max_single_loan,
      total_capital: policy.total_capital,
      sector_limits: policy.sector_limits,
    },
  };

  const decision: RunDecision = {
    action: action as RunDecision["action"],
    risk_grade: riskGrade,
    prob_default_12m: probDefault,
    terms,
    conditions,
    covenants: dscr !== null && dscr < 1.5 ? ["DSCR >= 1.2x quarterly"] : [],
    rationale,
    confidence,
  };

  const response: UnderwritingRun = {
    run_id: runId,
    timestamp_utc: new Date().toISOString(),
    case: runCase,
    policy: runPolicy,
    decision,
    trace,
  };

  await ctx.auditService.record({
    deal_id: dealId,
    type: "DEAL_UPDATED",
    actor,
    timestamp: new Date().toISOString(),
    changes: [
      {
        field: "evaluation",
        before: null,
        after: { run_id: runId, action, risk_grade: riskGrade },
      },
    ],
  });

  return response;
}

// MCP registration

export function registerUnderwritingTools(
  server: McpServer,
  ctx: ServiceContext
) {
  server.tool(
    "evaluate",
    "Run underwriting evaluation on a deal. Returns decision (approve/decline/refer/counter), risk grade, terms, and rationale. mode=rules_only is deterministic; mode=full uses LLM agent.",
    evaluateSchema,
    async (params) => {
      try {
        return toolResult(await handleEvaluate(ctx, params));
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
