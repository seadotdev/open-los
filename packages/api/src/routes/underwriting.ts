import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import type { AppContext } from "../server.js";
import { stripNulls } from "../utils.js";
import {
  LoanOriginationAgent,
  createLLMClient,
  createAgentServices,
  resolveLLMRoute,
  evaluateStandalone,
} from "@open-los/agent";
import type { UnderwritePolicy, ModelConfig, LLMProvider } from "@open-los/agent";
import type {
  LineItem,
  CreateSpreadInput,
  MetricsInput,
  UnderwritingRun,
  RunCase,
  RunPolicy,
  RunDecision,
  DecisionTerms,
  DecisionRationale,
  RunTrace,
  TraceCost,
  FinancialDossier,
} from "@open-los/core";

interface CreateSpreadJsonBody {
  entity_id?: string;
  period: string;
  line_items?: LineItem[];
  metrics?: MetricsInput;
}

interface ParsedLineItem extends LineItem {
  period?: string;
}

function parseProvider(value: unknown, fallback?: string): LLMProvider | null {
  const candidate = (typeof value === "string" ? value : fallback) ?? "anthropic";
  if (
    candidate === "anthropic"
    || candidate === "openrouter"
    || candidate === "openai"
    || candidate === "vercel"
  ) {
    return candidate;
  }
  return null;
}

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampInt(value: number, min: number, max: number): number {
  const rounded = Math.round(value);
  return Math.min(max, Math.max(min, rounded));
}

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

function parseCSV(csvContent: string, filterPeriod?: string): LineItem[] {
  const lines = csvContent.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const categoryIdx = headers.indexOf("category");
  const labelIdx = headers.indexOf("label");
  const amountIdx = headers.indexOf("amount");
  const periodIdx = headers.indexOf("period");

  if (categoryIdx === -1 || labelIdx === -1 || amountIdx === -1) {
    return [];
  }

  const items: ParsedLineItem[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    if (cols.length > amountIdx) {
      const item: ParsedLineItem = {
        category: cols[categoryIdx],
        label: cols[labelIdx],
        amount: parseInt(cols[amountIdx], 10),
      };
      if (periodIdx !== -1 && cols[periodIdx]) {
        item.period = cols[periodIdx];
      }
      items.push(item);
    }
  }

  // Filter by period if specified and period column exists
  if (filterPeriod && periodIdx !== -1) {
    const filtered = items.filter((item) => item.period === filterPeriod);
    return filtered.map(({ period, ...rest }) => rest);
  }

  // Remove period field from results
  return items.map(({ period, ...rest }) => rest);
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function underwritingRoutes(ctx: AppContext) {
  const app = new Hono();

  // POST /v1/deals/:dealId/spread - create spread (JSON or multipart CSV)
  app.post("/deals/:dealId/spread", async (c) => {
    const dealId = c.req.param("dealId");
    const actor = c.req.header("X-Actor") ?? "system";
    const contentType = c.req.header("Content-Type") ?? "";

    let input: CreateSpreadInput;
    let hasMetrics = false;

    if (contentType.includes("multipart/form-data")) {
      // Handle multipart form with CSV file
      const formData = await c.req.formData();
      const entityId = formData.get("entity_id") as string;
      const period = formData.get("period") as string;
      const file = formData.get("file") as File | null;

      let lineItems: LineItem[] = [];
      if (file) {
        const csvContent = await file.text();
        lineItems = parseCSV(csvContent, period);
      }

      input = { entity_id: entityId, period, line_items: lineItems };
    } else {
      // Handle JSON body
      const body = (await c.req.json()) as CreateSpreadJsonBody;
      hasMetrics = !!body.metrics && Object.keys(body.metrics).length > 0;

      input = {
        entity_id: body.entity_id,
        period: body.period,
        line_items: body.line_items,
        metrics: body.metrics,
      };
    }

    const result = await ctx.spreadService.create(dealId, input, actor);

    // Return 201 for metrics-based spreads (covenant tests expect this), 200 for line_items
    // Don't strip nulls - tests expect null for invalid computations (division by zero)
    const statusCode = hasMetrics ? 201 : 200;
    return c.json(result, statusCode);
  });

  // Alias /spreads for compatibility
  app.post("/deals/:dealId/spreads", async (c) => {
    const dealId = c.req.param("dealId");
    const actor = c.req.header("X-Actor") ?? "system";
    const body = (await c.req.json()) as CreateSpreadJsonBody;
    const hasMetrics = !!body.metrics && Object.keys(body.metrics).length > 0;

    const input: CreateSpreadInput = {
      entity_id: body.entity_id,
      period: body.period,
      line_items: body.line_items,
      metrics: body.metrics,
    };

    const result = await ctx.spreadService.create(dealId, input, actor);
    const statusCode = hasMetrics ? 201 : 200;
    return c.json(result, statusCode);
  });

  // GET /v1/deals/:dealId/ratios - get computed ratios for all periods
  app.get("/deals/:dealId/ratios", async (c) => {
    const dealId = c.req.param("dealId");
    const result = await ctx.spreadService.getRatios(dealId);
    // Don't strip nulls - preserve null values for ratios
    return c.json(result, 200);
  });

  // POST /v1/deals/:dealId/evaluate - trigger underwriting evaluation
  //
  // When dossier is provided AND mode=full, uses the rich prompt builder
  // (buildUnderwritingPrompt) for LLM-quality underwriting.
  // Otherwise follows agent evaluate or rules-only.
  app.post("/deals/:dealId/evaluate", async (c) => {
    const dealId = c.req.param("dealId");
    const actor = c.req.header("X-Actor") ?? "system";
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const startTime = Date.now();

    const body = await c.req.json() as {
      policy?: UnderwritePolicy;
      provider?: string;
      mode?: "full" | "rules_only";
      allow_rules_fallback?: boolean;
      dossier?: FinancialDossier;
      models?: ModelConfig;
    };

    const mode = body.mode ?? "full";
    const allowRulesFallback = body.allow_rules_fallback ?? false;
    const policy = body.policy ?? {};
    const fallbackNotes: string[] = [];
    const policyParams = policy.params ?? {};

    // --- Full Mode with inline dossier: use rich prompt builder ---
    if (mode === "full" && body.dossier) {
      const requestedProvider = parseProvider(body.provider, ctx.llmConfig?.defaultProvider);
      if (!requestedProvider) {
        return c.json(
          { error: "Invalid provider. Expected 'anthropic', 'openrouter', 'openai', or 'vercel'." },
          400
        );
      }
      const route = resolveLLMRoute(ctx.llmConfig, "underwrite", {
        provider: requestedProvider,
        model: body.models?.default ?? policy.model,
      });
      const routeProvider = route?.provider ?? requestedProvider;
      const apiKey = route?.apiKey ?? "";

      if (route && apiKey) {
        try {
          const response = await evaluateStandalone(
            ctx,
            policy,
            body.dossier,
            route.provider,
            { ...body.models, default: route.model }
          );
          // Override case_id with the deal ID
          response.case.case_id = dealId;

          await ctx.auditService.record({
            deal_id: dealId,
            type: "DEAL_UPDATED",
            actor,
            timestamp: new Date().toISOString(),
            changes: [
              { field: "evaluation", before: null, after: { run_id: response.run_id, action: response.decision.action, risk_grade: response.decision.risk_grade, mode: "full_dossier", allow_rules_fallback: allowRulesFallback } },
            ],
          });

          return c.json(stripNulls(response), 200);
        } catch (err: any) {
          if (!allowRulesFallback) {
            return c.json({ error: `Full dossier underwriting failed: ${err?.message ?? "unknown error"}` }, 502);
          }
          fallbackNotes.push(`dossier_full_failed:${err?.message ?? "unknown error"}`);
          console.warn(`[evaluate] dossier-based evaluation failed: ${err?.message}, falling back`);
        }
      } else {
        if (!allowRulesFallback) {
          return c.json(
            { error: `mode=full requires API key for provider=${routeProvider} (or set allow_rules_fallback=true)` },
            503
          );
        }
        fallbackNotes.push(`missing_api_key:${routeProvider}`);
      }
    }

    // --- Full Agent Mode: LLM-powered evaluation (existing path) ---
    if (mode === "full") {
      const requestedProvider = parseProvider(body.provider, ctx.llmConfig?.defaultProvider);
      if (!requestedProvider) {
        return c.json(
          { error: "Invalid provider. Expected 'anthropic', 'openrouter', 'openai', or 'vercel'." },
          400
        );
      }
      const route = resolveLLMRoute(ctx.llmConfig, "underwrite", {
        provider: requestedProvider,
        model: policy.model,
      });
      const routeProvider = route?.provider ?? requestedProvider;
      const apiKey = route?.apiKey ?? "";

      if (!apiKey) {
        if (!allowRulesFallback) {
          return c.json(
            { error: `mode=full requires API key for provider=${routeProvider} (or set allow_rules_fallback=true)` },
            503
          );
        }
        fallbackNotes.push(`missing_api_key:${routeProvider}`);
        console.warn(`[evaluate] mode=full requested but no API key for provider=${routeProvider}, falling back to rules_only`);
      } else {
        const agentServices = createAgentServices(ctx, { tenantId, actor });
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
          model: route?.model ?? policy.model ?? ctx.llmConfig?.defaultModel ?? "rules_only",
          params: {
            persona: policy.persona,
            target_yield_pct: policy.target_yield_pct,
            max_single_loan: policy.max_single_loan,
            total_capital: policy.total_capital,
            sector_limits: policy.sector_limits,
            ...policy.params,
          },
        };

        let response: UnderwritingRun | null = null;
        try {
          response = await agent.evaluate(
            dealId,
            runPolicy,
            { tenantId, actor },
            { allowRulesFallback }
          );
        } catch (err: any) {
          if (!allowRulesFallback) {
            return c.json({ error: `Full agent underwriting failed: ${err?.message ?? "unknown error"}` }, 502);
          }
          fallbackNotes.push(`agent_full_failed:${err?.message ?? "unknown error"}`);
          console.warn(`[evaluate] full agent evaluation failed: ${err?.message}, falling back to rules_only`);
        }
        if (!response) {
          // fall through to explicit rules path when fallback is enabled
        } else {

          // Log evaluation as audit event
          await ctx.auditService.record({
            deal_id: dealId,
            type: "DEAL_UPDATED",
            actor,
            timestamp: new Date().toISOString(),
            changes: [
              { field: "evaluation", before: null, after: { run_id: response.run_id, action: response.decision.action, risk_grade: response.decision.risk_grade, mode: "full", allow_rules_fallback: allowRulesFallback } },
            ],
          });

          return c.json(stripNulls(response), 200);
        }
      }
    }

    // --- Rules-Only Mode (default) ---

    // Fetch the deal
    const deal = await ctx.dealService.getById(dealId, tenantId);

    // Fetch spreads/ratios for the deal
    const ratioResult = await ctx.spreadService.getRatios(dealId);
    const ratios = ratioResult?.ratios?.[0] ?? {};

    // Fetch documents
    const docs = await ctx.documentService.listByDeal(dealId, tenantId);

    // Fetch audit trail (not critical, ignore errors)
    let auditResult: { events: unknown[] } = { events: [] };
    try {
      auditResult = await ctx.auditService.listByDeal(dealId);
    } catch { /* ok */ }

    // --- Thin Agent: Rules-based evaluation ---
    // This provides a deterministic evaluation path that works without
    // an LLM. Used for integration testing and as a fallback.
    const requestedAmount = deal.requested_amount ?? 0;
    const requestedAmountDollars = requestedAmount / 100; // minor units → dollars
    const maxLoan = asFiniteNumber(policy.max_single_loan)
      ?? asFiniteNumber(policyParams["max_single_loan"])
      ?? 500000;
    const targetYield = asFiniteNumber(policy.target_yield_pct)
      ?? asFiniteNumber(policyParams["target_yield_pct"])
      ?? 10.0;
    const defaultTenorMonths = clampInt(
      asFiniteNumber(policyParams["default_tenor_months"]) ?? 24,
      1,
      360,
    );
    const originationFeePct = clampNumber(
      asFiniteNumber(policyParams["origination_fee_pct"]) ?? 1.0,
      0,
      100,
    );
    const originationFeeRate = originationFeePct / 100;
    const aprCapDecimal = clampNumber(
      asFiniteNumber(policyParams["apr_cap_decimal"]) ?? 0.55,
      0,
      0.55,
    );
    const counterOfferMaxPctOfMaxLoan = clampNumber(
      asFiniteNumber(policyParams["counter_offer_max_pct_of_max_loan"]) ?? 80.0,
      0,
      100,
    );
    const counterOfferMaxFractionOfMaxLoan = counterOfferMaxPctOfMaxLoan / 100;

    // Extract key ratios
    const dscr = typeof ratios.dscr === "number" ? ratios.dscr : null;
    const grossMargin = typeof ratios.gross_margin === "number" ? ratios.gross_margin : null;
    const netMargin = typeof ratios.net_margin === "number" ? ratios.net_margin : null;
    const currentRatio = typeof ratios.current_ratio === "number" ? ratios.current_ratio : null;

    // Decision logic
    let action: string = "approve";
    let riskGrade = "B";
    let confidence = 0.70;
    let probDefault = 0.05;
    const keyFactors: string[] = [];
    const conditions: string[] = [];
    const whatWouldChange: string[] = [];

    // Rule 1: Amount exceeds max
    if (requestedAmountDollars > maxLoan) {
      action = "decline";
      riskGrade = "D";
      confidence = 0.95;
      probDefault = 0.30;
      keyFactors.push(`Requested amount $${requestedAmountDollars.toLocaleString()} exceeds maximum $${maxLoan.toLocaleString()}`);
      whatWouldChange.push("Reduce loan amount below maximum threshold");
    }

    // Rule 2: DSCR check
    if (dscr !== null && dscr < 1.0) {
      action = "decline";
      riskGrade = "D";
      confidence = 0.90;
      probDefault = 0.40;
      keyFactors.push(`DSCR ${dscr.toFixed(2)}x is below 1.0x minimum`);
      whatWouldChange.push("Improve cash flow to achieve DSCR >= 1.2x");
    } else if (dscr !== null && dscr < 1.2) {
      if (action === "approve") action = "refer";
      riskGrade = "C";
      probDefault = 0.15;
      keyFactors.push(`DSCR ${dscr.toFixed(2)}x is marginal (below 1.2x)`);
      conditions.push("Quarterly financial reporting required");
    } else if (dscr !== null) {
      keyFactors.push(`DSCR ${dscr.toFixed(2)}x provides adequate debt service coverage`);
    }

    // Rule 3: Margin check
    if (grossMargin !== null && grossMargin < 0.10) {
      if (action === "approve") action = "refer";
      riskGrade = "C";
      probDefault = Math.max(probDefault, 0.20);
      keyFactors.push(`Gross margin ${(grossMargin * 100).toFixed(1)}% is very thin`);
      whatWouldChange.push("Improve gross margins above 15%");
    } else if (grossMargin !== null) {
      keyFactors.push(`Gross margin ${(grossMargin * 100).toFixed(1)}% is healthy`);
    }

    // Rule 4: Sector concentration check
    if (policy.sector_limits && deal.custom_fields) {
      const sector = (deal.custom_fields as Record<string, unknown>).sector as string;
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

    // If still approve, set good risk grade
    if (action === "approve") {
      if (dscr !== null && dscr >= 1.5 && grossMargin !== null && grossMargin >= 0.25) {
        riskGrade = "A";
        probDefault = 0.02;
        confidence = 0.85;
      } else {
        riskGrade = "B";
        probDefault = 0.05;
        confidence = 0.75;
      }
    }

    // Build terms (only if approved/counter)
    const terms: DecisionTerms = {};
    if (action === "approve" || action === "counter") {
      const baseRate = targetYield / 100;
      // Risk premium based on grade
      const riskPremium = riskGrade === "A" ? 0.0 : riskGrade === "B" ? 0.02 : 0.05;
      terms.amount = action === "counter"
        ? Math.min(requestedAmountDollars, maxLoan * counterOfferMaxFractionOfMaxLoan)
        : requestedAmountDollars;
      const apr = baseRate + riskPremium;
      terms.apr = clampNumber(apr, 0, aprCapDecimal); // Decimal form (0.095 = 9.5%)
      terms.tenor_months = defaultTenorMonths;
      terms.fees = { origination: Math.round(terms.amount * originationFeeRate) };
    }

    // Build rationale
    const rationale: DecisionRationale = {
      summary: action === "approve"
        ? `Approved based on ${keyFactors.length > 0 ? keyFactors[0].toLowerCase() : "acceptable risk profile"}.`
        : action === "decline"
          ? `Declined: ${keyFactors.length > 0 ? keyFactors[0] : "insufficient risk profile"}.`
          : `Referred for manual review: ${keyFactors.length > 0 ? keyFactors[0] : "marginal indicators"}.`,
      key_factors: keyFactors,
      what_would_change: whatWouldChange,
    };

    const latencyMs = Date.now() - startTime;

    // Build trace
    const trace: RunTrace = {
      steps: [
        {
          t: new Date(startTime).toISOString(),
          type: "reasoning" as const,
          name: "rules_evaluation",
          content: `Evaluated ${Object.keys(ratios).length} financial ratios, ${Array.isArray(docs) ? docs.length : 0} documents`,
        },
        ...(fallbackNotes.length > 0 ? [{
          t: new Date().toISOString(),
          type: "note" as const,
          name: "llm_fallback",
          content: `Fell back to rules_only: ${fallbackNotes.join(", ")}`,
        }] : []),
        {
          t: new Date().toISOString(),
          type: "note" as const,
          name: "evaluation_mode",
          content: mode === "full"
            ? (fallbackNotes.length > 0 ? "full_requested_rules_fallback" : "full")
            : "rules_only",
        },
      ],
      latency_ms: latencyMs,
      cost: { tokens_in: 0, tokens_out: 0, estimated_cost_usd: 0 },
    };

    // Assemble the response
    const runId = randomUUID();

    const runCase: RunCase = {
      case_id: dealId,
      source: "production",
      segment: "smb_term_loan",
      jurisdiction: deal.jurisdiction ?? "US",
      currency: "USD",
      requested_amount: requestedAmountDollars,
      requested_purpose: deal.purpose ?? undefined,
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
        ...policy.params,
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

    // Log evaluation as audit event
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
            fallback_reason: fallbackNotes.length > 0 ? fallbackNotes.join(", ") : null,
            allow_rules_fallback: allowRulesFallback,
          },
        },
      ],
    });

    return c.json(stripNulls(response), 200);
  });

  // POST /v1/underwrite - standalone underwriting (no deal required)
  //
  // Accepts a dossier + policy inline, builds a rich prompt, calls the LLM,
  // and returns an UnderwritingRun. This is the "underwrite only" entry point.
  app.post("/underwrite", async (c) => {
    const actor = c.req.header("X-Actor") ?? "system";

    const body = await c.req.json() as {
      dossier: FinancialDossier;
      policy?: UnderwritePolicy;
      provider?: string;
      models?: ModelConfig;
    };

    if (!body.dossier) {
      return c.json({ error: "dossier is required" }, 400);
    }

    const policy = body.policy ?? {};
    const requestedProvider = parseProvider(body.provider, ctx.llmConfig?.defaultProvider);
    if (!requestedProvider) {
      return c.json(
        { error: "Invalid provider. Expected 'anthropic', 'openrouter', 'openai', or 'vercel'." },
        400
      );
    }

    const route = resolveLLMRoute(ctx.llmConfig, "underwrite", {
      provider: requestedProvider,
      model: body.models?.default ?? policy.model,
    });

    const response = await evaluateStandalone(
      ctx,
      policy,
      body.dossier,
      route?.provider ?? requestedProvider,
      { ...body.models, default: route?.model ?? body.models?.default ?? policy.model }
    );
    return c.json(stripNulls(response), 200);
  });

  return app;
}
