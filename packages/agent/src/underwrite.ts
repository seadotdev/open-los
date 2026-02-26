/**
 * Standalone underwriting — prompt engineering + LLM evaluation.
 *
 * This module contains the rich prompt builder ported from loanville's llm.py.
 * It's the single source of truth for underwriting prompt construction,
 * used by both the API routes and MCP tools.
 */

import { randomUUID } from "node:crypto"
import { createLLMClient, resolveLLMRoute } from "./llm/index.js"
import type { LLMConfig, LLMProvider } from "./types.js"
import type {
  UnderwritingRun,
  RunCase,
  RunPolicy,
  RunDecision,
  DecisionTerms,
  RunTrace,
  FinancialDossier,
  QuarterlyIncome,
  MonthlyStatement,
} from "@open-los/core"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Policy parameters for underwriting — sent by the sim or CLI */
export interface UnderwritePolicy {
  policy_id?: string
  model?: string
  persona?: string
  target_yield_pct?: number
  max_single_loan?: number
  total_capital?: number
  sector_limits?: Record<string, number>
  existing_portfolio?: Array<{
    borrower_name: string
    sector: string
    remaining_balance: number
    interest_rate: number
  }>
  params?: Record<string, unknown>
}

/** Model configuration for underwriting stages */
export interface ModelConfig {
  default?: string
  credit_analysis?: string
  fraud_detection?: string
  structuring?: string
  summary?: string
}

/** Minimal context needed for evaluateStandalone */
export interface UnderwriteContext {
  llmConfig?: LLMConfig
}

// ---------------------------------------------------------------------------
// Prompt Engineering — ported from loanville llm.py
// ---------------------------------------------------------------------------

function formatPortfolioSummary(policy: UnderwritePolicy): string {
  const lines: string[] = []
  const portfolio = policy.existing_portfolio
  if (!portfolio || portfolio.length === 0) {
    lines.push("  (No existing loans)")
    return lines.join("\n")
  }

  const totalDeployed = portfolio.reduce((s, l) => s + l.remaining_balance, 0)
  const totalCapital = policy.total_capital ?? 0
  const sectorExposure: Record<string, number> = {}
  for (const loan of portfolio) {
    sectorExposure[loan.sector] = (sectorExposure[loan.sector] ?? 0) + loan.remaining_balance
  }

  lines.push(`  Total Capital: $${totalCapital.toLocaleString()}`)
  lines.push(`  Currently Deployed: $${totalDeployed.toLocaleString()}`)
  lines.push(`  Available Capital: $${(totalCapital - totalDeployed).toLocaleString()}`)
  lines.push("")
  lines.push("  Existing Loans:")
  for (const loan of portfolio) {
    lines.push(
      `    - ${loan.borrower_name} (${loan.sector}): ` +
      `$${loan.remaining_balance.toLocaleString()} remaining at ${loan.interest_rate}%`
    )
  }
  lines.push("")
  lines.push("  Current Sector Exposure:")
  const sectorLimits = policy.sector_limits ?? {}
  for (const [sector, amount] of Object.entries(sectorExposure).sort()) {
    const pct = totalCapital > 0 ? (amount / totalCapital * 100) : 0
    const limit = (sectorLimits[sector] ?? 0.25) * 100
    lines.push(`    - ${sector}: $${amount.toLocaleString()} (${pct.toFixed(1)}% of capital, limit: ${limit.toFixed(0)}%)`)
  }

  return lines.join("\n")
}

function formatQuarterlyTable(quarters: QuarterlyIncome[]): string {
  if (!quarters || quarters.length === 0) return "  (No quarterly data available)"

  const lines: string[] = []
  let header = `  ${"".padEnd(20)}`
  for (const q of quarters) {
    header += q.quarter.padStart(14)
  }
  lines.push(header)
  lines.push(`  ${"─".repeat(20)}${"─".repeat(14).repeat(quarters.length)}`)

  let rowRev = `  ${"Revenue".padEnd(20)}`
  let rowExp = `  ${"Expenses".padEnd(20)}`
  let rowNi = `  ${"Net Income".padEnd(20)}`
  let rowNm = `  ${"Net Margin".padEnd(20)}`
  for (const q of quarters) {
    rowRev += `$${q.revenue.toLocaleString()}`.padStart(14)
    rowExp += `($${q.expenses.toLocaleString()})`.padStart(14)
    rowNi += `$${q.net_income.toLocaleString()}`.padStart(14)
    const nm = q.net_margin_pct ?? (q.revenue > 0 ? (q.net_income / q.revenue * 100) : 0)
    rowNm += `${nm.toFixed(1)}%`.padStart(14)
  }
  lines.push(rowRev)
  lines.push(rowExp)
  lines.push(rowNi)
  lines.push(rowNm)

  return lines.join("\n")
}

function formatBankStatements(statements: MonthlyStatement[]): string {
  if (!statements || statements.length === 0) return "  (No bank statement data available)"

  const MAX_TXNS_PER_MONTH = 50
  const MAX_TOTAL_CHARS = 12000
  let truncated = false

  const entries = statements.map(s => {
    const deposits = s.deposits ? s.deposits.slice(0, MAX_TXNS_PER_MONTH) : undefined
    const withdrawals = s.withdrawals ? s.withdrawals.slice(0, MAX_TXNS_PER_MONTH) : undefined
    if ((s.deposits?.length ?? 0) > MAX_TXNS_PER_MONTH || (s.withdrawals?.length ?? 0) > MAX_TXNS_PER_MONTH) {
      truncated = true
    }

    const entry: Record<string, unknown> = {
      month: s.month,
      opening_balance: s.opening_balance,
      ending_balance: s.ending_balance,
    }
    if (deposits) {
      entry.deposits = deposits.map(t => ({
        date: t.date,
        description: t.description,
        amount: t.amount,
      }))
      entry.total_deposits = s.total_deposits ?? deposits.reduce((sum, t) => sum + t.amount, 0)
    }
    if (withdrawals) {
      entry.withdrawals = withdrawals.map(t => ({
        date: t.date,
        description: t.description,
        amount: t.amount,
      }))
      entry.total_withdrawals = s.total_withdrawals ?? withdrawals.reduce((sum, t) => sum + t.amount, 0)
    }
    return entry
  })

  let output = JSON.stringify(entries, null, 2)
  if (output.length > MAX_TOTAL_CHARS) {
    output = output.slice(0, MAX_TOTAL_CHARS)
    truncated = true
  }
  if (truncated) {
    output += "\n\n[truncated: statements were reduced for token budget]"
  }
  return output
}

/**
 * Build a rich underwriting prompt from policy + dossier.
 *
 * Mirrors the prompt quality of loanville's llm.py — lender persona,
 * portfolio context, sector limits, quarterly income table, narrative,
 * bank statements inline, and analysis instructions.
 */
export function buildUnderwritingPrompt(
  policy: UnderwritePolicy,
  dossier: FinancialDossier,
): { system: string; user: string } {
  const persona = policy.persona ?? "a conservative commercial lender"
  const targetYield = policy.target_yield_pct ?? 10.0
  const maxLoan = policy.max_single_loan ?? 500000
  const sectorLimits = policy.sector_limits ?? {}

  const sectorLimitsStr = Object.entries(sectorLimits)
    .sort()
    .map(([sector, pct]) => `    - ${sector}: max ${(pct * 100).toFixed(0)}% of total capital`)
    .join("\n") || "    (none specified)"

  const system = `${persona}

YOUR LENDING GUIDELINES:
- Target Portfolio Yield: ${targetYield}% annual
- Maximum Single Loan Amount: $${maxLoan.toLocaleString()}
- Sector Concentration Limits:
${sectorLimitsStr}

YOUR CURRENT PORTFOLIO:
${formatPortfolioSummary(policy)}

INSTRUCTIONS:
Evaluate the loan application below. You must analyze:

1. CREDITWORTHINESS: Review the quarterly income statements carefully.
   - Look at revenue trends across quarters — is revenue growing, flat, or declining?
   - Look at margin trends — are margins stable, expanding, or compressing?
   - Can this business service the debt from free cash flow?

2. FRAUD DETECTION: Carefully examine the financial data and bank statement
   transactions for any patterns or anomalies that could indicate fabrication,
   misrepresentation, or financial manipulation. Consider what normal business
   transactions look like and flag anything unusual.

3. PORTFOLIO FIT: Would this loan breach your sector concentration limits?
   - Consider your existing exposure to this sector
   - Factor in the new loan amount when checking limits

When you are ready to give your final decision, respond with ONLY a valid JSON
object in exactly this format:
{
  "decision": "APPROVE" or "REJECT",
  "reasoning": "Your 2-4 sentence analysis summary",
  "term_sheet": {
    "loan_amount": <number or null if rejected>,
    "interest_rate": <annual rate as percentage e.g. 8.5, or null if rejected>,
    "term_months": <integer or null if rejected>
  }
}

Respond with ONLY the JSON when giving your final answer. No other text.`

  // --- User prompt ---
  const userLines: string[] = []
  userLines.push("Please evaluate the following loan application:")
  userLines.push("")
  userLines.push("=".repeat(60))
  userLines.push(`LOAN APPLICATION: ${dossier.company_name}`)
  userLines.push("=".repeat(60))
  userLines.push(`Sector: ${dossier.sector}`)
  if (dossier.years_in_business != null) {
    userLines.push(`Years in Business: ${dossier.years_in_business}`)
  }
  if (dossier.employee_count != null) {
    userLines.push(`Employee Count: ${dossier.employee_count}`)
  }
  userLines.push(`Loan Requested: $${dossier.loan_request_amount.toLocaleString()}`)
  if (dossier.loan_purpose) {
    userLines.push(`Loan Purpose: ${dossier.loan_purpose}`)
  }
  userLines.push("")

  if (dossier.narrative) {
    userLines.push("--- COMPANY NARRATIVE ---")
    userLines.push(dossier.narrative)
    userLines.push("")
  }

  if (dossier.quarterly_income && dossier.quarterly_income.length > 0) {
    userLines.push("--- QUARTERLY INCOME STATEMENTS ---")
    userLines.push("")
    userLines.push(formatQuarterlyTable(dossier.quarterly_income))
    userLines.push("")
  }

  userLines.push("--- ANNUAL TOTALS ---")
  userLines.push(`Annual Revenue:  $${dossier.annual_revenue.toLocaleString()}`)
  if (dossier.annual_expenses != null) {
    userLines.push(`Annual Expenses: $${dossier.annual_expenses.toLocaleString()}`)
  }
  if (dossier.net_income != null) {
    userLines.push(`Net Income:      $${dossier.net_income.toLocaleString()}`)
    if (dossier.annual_revenue > 0) {
      userLines.push(`Net Margin:      ${(dossier.net_income / dossier.annual_revenue * 100).toFixed(1)}%`)
    }
  }
  userLines.push("")

  if (dossier.bank_statements && dossier.bank_statements.length > 0) {
    userLines.push("--- 12-MONTH BANK STATEMENTS ---")
    userLines.push(formatBankStatements(dossier.bank_statements))
    userLines.push("")
    userLines.push("NOTE: The raw 12-month bank statements are provided above for analysis.")
    userLines.push("Examine deposit patterns, customer names, and anomalies.")
  } else {
    userLines.push("NOTE: Your evaluation is based on the quarterly income and annual data above.")
    userLines.push("No raw bank statement data is available for this application.")
  }

  return { system, user: userLines.join("\n") }
}

// ---------------------------------------------------------------------------
// Standalone underwriting via LLM (no deal required)
// ---------------------------------------------------------------------------

function estimateCost(tokensIn: number, tokensOut: number, model: string): number {
  const costs: Record<string, { input: number; output: number }> = {
    "claude-sonnet-4-5-20250929": { input: 3, output: 15 },
    "claude-haiku-4-5-20251001": { input: 0.8, output: 4 },
  }
  const c = costs[model] ?? { input: 3, output: 15 }
  return (tokensIn * c.input + tokensOut * c.output) / 1_000_000
}

/**
 * Run a standalone LLM underwriting evaluation.
 *
 * Uses buildUnderwritingPrompt to construct the same quality prompt as the
 * sim's llm.py, calls the LLM, and returns an UnderwritingRun.
 */
export async function evaluateStandalone(
  ctx: UnderwriteContext,
  policy: UnderwritePolicy,
  dossier: FinancialDossier,
  provider?: LLMProvider,
  models?: ModelConfig,
): Promise<UnderwritingRun> {
  const startTime = Date.now()
  const runId = randomUUID()

  const route = resolveLLMRoute(ctx.llmConfig, "underwrite", {
    provider,
    model: models?.default ?? policy.model,
  })

  if (!route) {
    throw new Error("No LLM route configured for function=underwrite")
  }

  const model = route.model
  const apiKey = route.apiKey ?? ""

  if (!apiKey) {
    throw new Error(`No API key configured for provider=${route.provider}`)
  }

  const { system, user } = buildUnderwritingPrompt(policy, dossier)

  const llmClient = createLLMClient(route.provider, {
    apiKey,
    model,
    baseURL: route.baseURL,
  })

  const decisionSchema = {
    type: "object" as const,
    properties: {
      decision: { type: "string", enum: ["APPROVE", "REJECT"] },
      reasoning: { type: "string" },
      term_sheet: {
        type: "object",
        properties: {
          loan_amount: { type: "number" },
          interest_rate: { type: "number" },
          term_months: { type: "number" },
        },
      },
    },
    required: ["decision", "reasoning"],
  }

  const traceSteps: RunTrace["steps"] = []
  let tokensIn = 0
  let tokensOut = 0
  let costUsd = 0

  traceSteps.push({
    t: new Date(startTime).toISOString(),
    type: "reasoning" as const,
    name: "prompt_construction",
    content: `Built underwriting prompt: ${system.length + user.length} chars, model=${model}`,
  })

  let decision: RunDecision

  try {
    const llmResult = await llmClient.structured<{
      decision: string
      reasoning: string
      term_sheet?: { loan_amount?: number; interest_rate?: number; term_months?: number }
    }>(user, decisionSchema, {
      system,
      model,
      fallbackModels: route.fallbackModels,
      providerOptions: route.providerOptions,
    })

    const llmAny = llmClient as any
    if (typeof llmAny.tokensIn === "number") {
      tokensIn = llmAny.tokensIn
      tokensOut = llmAny.tokensOut ?? 0
      costUsd = estimateCost(tokensIn, tokensOut, model)
    }

    const action = llmResult.decision?.toUpperCase() === "APPROVE" ? "approve" : "decline"
    const ts = llmResult.term_sheet

    const terms: DecisionTerms = {}
    if (action === "approve" && ts) {
      terms.amount = ts.loan_amount ?? dossier.loan_request_amount
      // interest_rate comes as percentage (e.g. 8.5), convert to decimal APR (0.085)
      terms.apr = ts.interest_rate != null ? ts.interest_rate / 100 : 0.10
      if (terms.apr > 0.55) terms.apr = 0.55
      terms.tenor_months = ts.term_months ?? 24
      terms.fees = { origination: Math.round((terms.amount ?? 0) * 0.01) }
    }

    decision = {
      action: action as RunDecision["action"],
      risk_grade: action === "approve" ? "B" : "D",
      prob_default_12m: action === "approve" ? 0.05 : 0.30,
      terms,
      conditions: [],
      covenants: [],
      rationale: {
        summary: llmResult.reasoning || "No reasoning provided",
        key_factors: [],
        what_would_change: [],
      },
      confidence: 0.75,
    }

    traceSteps.push({
      t: new Date().toISOString(),
      type: "tool_call" as const,
      name: "llm_evaluate",
      content: `LLM evaluation via ${model}: ${decision.action}`,
    })
  } catch (err: any) {
    decision = {
      action: "decline",
      risk_grade: "D",
      prob_default_12m: 0.50,
      terms: {},
      conditions: [],
      covenants: [],
      rationale: {
        summary: `LLM evaluation failed: ${err?.message ?? "unknown error"}`,
        key_factors: [],
        what_would_change: [],
      },
      confidence: 0.0,
    }

    traceSteps.push({
      t: new Date().toISOString(),
      type: "note" as const,
      name: "llm_error",
      content: `LLM call failed: ${err?.message ?? "unknown error"}`,
    })
  }

  const latencyMs = Date.now() - startTime

  const trace: RunTrace = {
    steps: traceSteps,
    latency_ms: latencyMs,
    cost: { tokens_in: tokensIn, tokens_out: tokensOut, estimated_cost_usd: costUsd },
  }

  const runCase: RunCase = {
    case_id: dossier.company_name,
    source: "production",
    segment: "smb_term_loan",
    currency: "USD",
    requested_amount: dossier.loan_request_amount,
    requested_purpose: dossier.loan_purpose,
  }

  const runPolicy: RunPolicy = {
    policy_id: policy.policy_id ?? "standalone",
    model,
    params: {
      persona: policy.persona,
      target_yield_pct: policy.target_yield_pct,
      max_single_loan: policy.max_single_loan,
      total_capital: policy.total_capital,
      sector_limits: policy.sector_limits,
      ...policy.params,
    },
  }

  return {
    run_id: runId,
    timestamp_utc: new Date().toISOString(),
    case: runCase,
    policy: runPolicy,
    decision,
    trace,
  }
}
