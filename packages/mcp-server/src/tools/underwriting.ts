import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServiceContext } from "../context.js";
import { toolResult, toolError } from "../helpers.js";
import {
  LoanOriginationAgent,
  createLLMClient,
  createAgentServices,
  resolveLLMRoute,
  evaluateStandalone,
} from "@open-los/agent";
import type { UnderwritePolicy, ModelConfig, LLMProvider } from "@open-los/agent";
import type {
  UnderwritingRun,
  RunCase,
  RunPolicy,
  RunDecision,
  DecisionTerms,
  DecisionRationale,
  RunTrace,
  FinancialDossier,
} from "@open-los/core";

function parseProvider(value: unknown, fallback?: string): LLMProvider {
  const candidate = (typeof value === "string" ? value : fallback) ?? "anthropic";
  if (
    candidate === "anthropic"
    || candidate === "openrouter"
    || candidate === "openai"
    || candidate === "vercel"
  ) {
    return candidate;
  }
  throw new Error(`Invalid provider "${candidate}". Expected "anthropic", "openrouter", "openai", or "vercel".`);
}

// Re-export for CLI
export { buildUnderwritingPrompt, evaluateStandalone } from "@open-los/agent";
export type { UnderwritePolicy, ModelConfig } from "@open-los/agent";

// Schema for dossier (used in both evaluate and standalone underwrite)
const quarterlyIncomeSchema = z.object({
  quarter: z.string(),
  revenue: z.number(),
  expenses: z.number(),
  gross_profit: z.number().optional(),
  gross_margin_pct: z.number().optional(),
  net_income: z.number(),
  net_margin_pct: z.number().optional(),
});

const transactionSchema = z.object({
  date: z.string(),
  description: z.string(),
  amount: z.number(),
});

const monthlyStatementSchema = z.object({
  month: z.string(),
  opening_balance: z.number(),
  ending_balance: z.number(),
  deposits: z.array(transactionSchema).optional(),
  withdrawals: z.array(transactionSchema).optional(),
  total_deposits: z.number().optional(),
  total_withdrawals: z.number().optional(),
});

const dossierSchema = z.object({
  company_name: z.string(),
  sector: z.string(),
  years_in_business: z.number().optional(),
  annual_revenue: z.number(),
  annual_expenses: z.number().optional(),
  net_income: z.number().optional(),
  employee_count: z.number().optional(),
  bank_statements: z.array(monthlyStatementSchema).optional(),
  quarterly_income: z.array(quarterlyIncomeSchema).optional(),
  narrative: z.string().optional(),
  loan_request_amount: z.number(),
  loan_purpose: z.string().optional(),
});

// Schema — evaluate (deal-scoped, with optional dossier)

export const evaluateSchema = {
  deal_id: z.string(),
  mode: z
    .enum(["rules_only", "full"])
    .optional()
    .default("full")
    .describe("rules_only = deterministic, full = LLM agent"),
  provider: z
    .enum(["anthropic", "openrouter", "openai", "vercel"])
    .optional()
    .describe("LLM provider (only for mode=full)"),
  allow_rules_fallback: z
    .boolean()
    .optional()
    .default(false)
    .describe("When mode=full, permit deterministic rules fallback if LLM is unavailable/fails"),
  policy_id: z.string().optional(),
  model: z.string().optional(),
  persona: z.string().optional(),
  target_yield_pct: z.number().optional().default(10.0),
  max_single_loan: z.number().optional().default(500000),
  total_capital: z.number().optional(),
  sector_limits: z.record(z.number()).optional(),
  dossier: dossierSchema.optional().describe("Inline financial dossier — when provided, uses rich prompt builder instead of fetching from spreads/docs"),
  tenant_id: z.string().optional().default("default"),
  actor: z.string().optional().default("mcp-agent"),
};

// Schema — standalone underwrite (no deal required)

export const underwriteSchema = {
  dossier: dossierSchema.describe("Full borrower financial dossier"),
  policy_id: z.string().optional(),
  model: z.string().optional(),
  persona: z.string().optional(),
  target_yield_pct: z.number().optional().default(10.0),
  max_single_loan: z.number().optional().default(500000),
  total_capital: z.number().optional(),
  sector_limits: z.record(z.number()).optional(),
  existing_portfolio: z.array(z.object({
    borrower_name: z.string(),
    sector: z.string(),
    remaining_balance: z.number(),
    interest_rate: z.number(),
  })).optional(),
  provider: z.enum(["anthropic", "openrouter", "openai", "vercel"]).optional(),
  tenant_id: z.string().optional().default("default"),
  actor: z.string().optional().default("mcp-agent"),
};

// Handler — evaluate (deal-scoped)

export async function handleEvaluate(
  ctx: ServiceContext,
  params: {
    deal_id: string;
    mode?: string;
    provider?: string;
    allow_rules_fallback?: boolean;
    policy_id?: string;
    model?: string;
    persona?: string;
    target_yield_pct?: number;
    max_single_loan?: number;
    total_capital?: number;
    sector_limits?: Record<string, number>;
    dossier?: FinancialDossier;
    tenant_id?: string;
    actor?: string;
  }
): Promise<UnderwritingRun> {
  const {
    deal_id: dealId,
    mode = "full",
    tenant_id: tenantId = "default",
    actor = "mcp-agent",
    dossier,
    allow_rules_fallback: allowRulesFallback = false,
    ...policyParams
  } = params;

  const startTime = Date.now();
  const fallbackNotes: string[] = [];

  const policy: UnderwritePolicy = {
    policy_id: policyParams.policy_id,
    model: policyParams.model,
    persona: policyParams.persona,
    target_yield_pct: policyParams.target_yield_pct ?? 10.0,
    max_single_loan: policyParams.max_single_loan ?? 500000,
    total_capital: policyParams.total_capital,
    sector_limits: policyParams.sector_limits,
  };

  // --- Full Mode with inline dossier: use rich prompt builder ---
  if (mode === "full" && dossier) {
    const requestedProvider = parseProvider(params.provider, ctx.llmConfig?.defaultProvider);
    const route = resolveLLMRoute(ctx.llmConfig, "underwrite", {
      provider: requestedProvider,
      model: policy.model,
    });
    const routeProvider = route?.provider ?? requestedProvider;
    const apiKey = route?.apiKey ?? "";

    if (route && apiKey) {
      try {
        const response = await evaluateStandalone(
          ctx as any,
          policy,
          dossier,
          route.provider,
          { default: route.model }
        );
        response.case.case_id = dealId;

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
                mode: "full_dossier",
                allow_rules_fallback: allowRulesFallback,
              },
            },
          ],
        });

        return response;
      } catch (err: any) {
        if (!allowRulesFallback) {
          throw new Error(`Full dossier underwriting failed: ${err?.message ?? "unknown error"}`);
        }
        fallbackNotes.push(`dossier_full_failed:${err?.message ?? "unknown error"}`);
      }
    } else {
      if (!allowRulesFallback) {
        throw new Error(`mode=full requires API key for provider=${routeProvider} (or set allow_rules_fallback=true)`);
      }
      fallbackNotes.push(`missing_api_key:${routeProvider}`);
    }
  }

  // --- Full Agent Mode ---
  if (mode === "full") {
    const requestedProvider = parseProvider(params.provider, ctx.llmConfig?.defaultProvider);
    const route = resolveLLMRoute(ctx.llmConfig, "underwrite", {
      provider: requestedProvider,
      model: policy.model,
    });
    const routeProvider = route?.provider ?? requestedProvider;
    const apiKey = route?.apiKey ?? "";

    if (!apiKey && !allowRulesFallback) {
      throw new Error(`mode=full requires API key for provider=${routeProvider} (or set allow_rules_fallback=true)`);
    }

    if (apiKey) {
      const agentServices = createAgentServices(ctx as any, {
        tenantId,
        actor,
      });
      const llmClient = createLLMClient(route!.provider, {
        apiKey,
        model: route!.model,
        baseURL: route!.baseURL,
      });
      const agent = new LoanOriginationAgent({
        los: agentServices,
        llm: llmClient,
        tenantId,
      });

      const runPolicy = {
        policy_id: policy.policy_id ?? `agent_${tenantId}`,
        model:
          route?.model ?? policy.model ?? ctx.llmConfig?.defaultModel ?? "rules_only",
        params: {
          persona: policy.persona,
          target_yield_pct: policy.target_yield_pct,
          max_single_loan: policy.max_single_loan,
          total_capital: policy.total_capital,
          sector_limits: policy.sector_limits,
        },
      };

      const response = await agent.evaluate(
        dealId,
        runPolicy,
        {
          tenantId,
          actor,
        },
        { allowRulesFallback }
      );

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
              allow_rules_fallback: allowRulesFallback,
            },
          },
        ],
      });

      return response;
    }
    // No API key — fall through to rules_only only if explicitly allowed
    fallbackNotes.push(`missing_api_key:${routeProvider}`);
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
    const limit = sector ? policy.sector_limits[sector] : undefined;
    const totalCapital = policy.total_capital;
    const existingExposure = sector && policy.existing_portfolio
      ? policy.existing_portfolio
          .filter((loan) => loan.sector === sector)
          .reduce((sum, loan) => sum + loan.remaining_balance, 0)
      : 0;
    if (sector && limit !== undefined && totalCapital && totalCapital > 0) {
      const projectedPct = (existingExposure + requestedAmountDollars) / totalCapital;
      if (projectedPct > limit) {
        action = "decline";
        riskGrade = "D";
        confidence = Math.max(confidence, 0.90);
        probDefault = Math.max(probDefault, 0.25);
        keyFactors.push(
          `Sector concentration breach for "${sector}": projected ${(projectedPct * 100).toFixed(1)}% exceeds ${(limit * 100).toFixed(1)}% limit`
        );
        whatWouldChange.push(`Reduce sector exposure for ${sector} or increase total capital`);
      } else {
        keyFactors.push(`Sector "${sector}" projected concentration ${(projectedPct * 100).toFixed(1)}% is within ${(limit * 100).toFixed(1)}% limit`);
      }
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
      if (terms.apr > 0.55) terms.apr = 0.55;
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
      ...(fallbackNotes.length > 0
        ? [
            {
              t: new Date().toISOString(),
              type: "note" as const,
              name: "llm_fallback",
              content: `Fell back to rules_only: ${fallbackNotes.join(", ")}`,
            },
          ]
        : []),
      {
        t: new Date().toISOString(),
        type: "note" as const,
        name: "evaluation_mode",
        content:
          mode === "full"
            ? fallbackNotes.length > 0
              ? "full_requested_rules_fallback"
              : "full"
            : "rules_only",
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
    model: "rules_only",
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
        after: {
          run_id: runId,
          action,
          risk_grade: riskGrade,
          mode: mode === "full" ? "rules_fallback" : "rules_only",
          fallback_reason:
            fallbackNotes.length > 0 ? fallbackNotes.join(", ") : null,
          allow_rules_fallback: allowRulesFallback,
        },
      },
    ],
  });

  return response;
}

// Handler — standalone underwrite (no deal)

export async function handleUnderwrite(
  ctx: ServiceContext,
  params: {
    dossier: FinancialDossier;
    policy_id?: string;
    model?: string;
    persona?: string;
    target_yield_pct?: number;
    max_single_loan?: number;
    total_capital?: number;
    sector_limits?: Record<string, number>;
    existing_portfolio?: Array<{
      borrower_name: string;
      sector: string;
      remaining_balance: number;
      interest_rate: number;
    }>;
    provider?: string;
    tenant_id?: string;
    actor?: string;
  }
): Promise<UnderwritingRun> {
  const provider = parseProvider(params.provider, ctx.llmConfig?.defaultProvider);
  const route = resolveLLMRoute(ctx.llmConfig, "underwrite", {
    provider,
    model: params.model,
  });

  const policy: UnderwritePolicy = {
    policy_id: params.policy_id,
    model: params.model,
    persona: params.persona,
    target_yield_pct: params.target_yield_pct ?? 10.0,
    max_single_loan: params.max_single_loan ?? 500000,
    total_capital: params.total_capital,
    sector_limits: params.sector_limits,
    existing_portfolio: params.existing_portfolio,
  };

  return evaluateStandalone(
    ctx as any,
    policy,
    params.dossier,
    route?.provider ?? provider,
    { default: route?.model ?? params.model ?? policy.model }
  );
}

// MCP registration

export function registerUnderwritingTools(
  server: McpServer,
  ctx: ServiceContext
) {
  server.tool(
    "evaluate",
    "Run underwriting evaluation on a deal. Returns decision (approve/decline/refer/counter), risk grade, terms, and rationale. mode=rules_only is deterministic; mode=full uses LLM agent. Optionally accepts inline dossier for rich prompt-based evaluation.",
    evaluateSchema,
    async (params) => {
      try {
        return toolResult(await handleEvaluate(ctx, params));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "underwrite",
    "Standalone underwriting — no deal/entity/spread required. Accepts a financial dossier + policy inline, builds a rich prompt, calls the LLM, and returns an UnderwritingRun with decision.",
    underwriteSchema,
    async (params) => {
      try {
        return toolResult(await handleUnderwrite(ctx, params));
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
