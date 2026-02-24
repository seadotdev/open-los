/**
 * Shared contract types — generated from JSON Schema definitions in /schemas/.
 *
 * These types define the canonical data structures shared between the LOS,
 * SIM (loanville2), and UW Bench (rl-benchmarks). The LOS owns these
 * definitions; consumer repos conform to them.
 *
 * DO NOT edit these types directly — update the JSON Schema first, then
 * regenerate. Manual edits will be overwritten.
 */

// ---------------------------------------------------------------------------
// UnderwritingRun — schemas/underwriting-run.schema.json
// ---------------------------------------------------------------------------

export interface RunCase {
  case_id: string;
  source: "benchmark" | "simulator" | "production";
  segment: string;
  jurisdiction?: string;
  currency?: string;
  requested_amount?: number;
  requested_tenor_months?: number;
  requested_purpose?: string;
}

export interface RunPolicy {
  policy_id: string;
  model: string;
  prompt_hash?: string;
  tools_version?: string;
  params?: Record<string, unknown>;
}

export interface ExtractedFinancials {
  revenue_ttm?: number;
  gross_margin?: number;
  ebitda_ttm?: number;
  net_income?: number;
  annual_expenses?: number;
}

export interface ExtractedBanking {
  avg_daily_balance_90d?: number;
  nsf_12m?: number;
  total_deposits_12m?: number;
  total_withdrawals_12m?: number;
}

export interface ExtractedBusiness {
  industry?: string;
  years_trading?: number;
  employee_count?: number;
  company_name?: string;
}

export interface RawDocument {
  doc_id: string;
  type: string;
  bytes_sha?: string;
}

export interface RunInputs {
  raw_documents?: RawDocument[];
  financials?: ExtractedFinancials;
  banking?: ExtractedBanking;
  business?: ExtractedBusiness;
  missing_info?: string[];
}

export interface TraceStep {
  t: string;
  type: "tool_call" | "note" | "reasoning" | "doc_request";
  name?: string;
  args?: Record<string, unknown>;
  result?: Record<string, unknown>;
  content?: string;
}

export interface TraceCost {
  tokens_in?: number;
  tokens_out?: number;
  estimated_cost_usd?: number;
}

export interface RunTrace {
  steps?: TraceStep[];
  latency_ms?: number;
  cost?: TraceCost;
}

export interface DecisionTerms {
  /** Loan amount */
  amount?: number;
  /** Annual percentage rate as decimal. 0.095 = 9.5%. */
  apr?: number;
  /** Loan tenor in months */
  tenor_months?: number;
  /** Named fees (e.g. origination, commitment) */
  fees?: Record<string, number>;
}

export interface DecisionRationale {
  summary?: string;
  key_factors?: string[];
  what_would_change?: string[];
}

export type DecisionAction = "approve" | "decline" | "counter" | "refer" | "pending";

export interface RunDecision {
  action: DecisionAction;
  risk_grade?: string;
  prob_default_12m?: number;
  terms?: DecisionTerms;
  conditions?: string[];
  covenants?: string[];
  rationale?: DecisionRationale;
  confidence?: number;
}

export interface GoldLabel {
  true_outcome?: "good" | "bad" | "fraud";
  correct_action?: "approve" | "decline";
  months_before_default?: number | null;
  [key: string]: unknown;
}

export interface LoanOutcomeLabel {
  defaulted?: boolean;
  was_fraud?: boolean;
  months_paid?: number;
  interest_paid?: number;
  principal_lost?: number;
  principal_recovered?: number;
  [key: string]: unknown;
}

export interface RunLabels {
  available?: boolean;
  gold?: GoldLabel | null;
  outcome?: LoanOutcomeLabel | null;
}

export interface RunScores {
  gates?: Record<string, unknown> | null;
  uw_quality?: Record<string, unknown> | null;
  business?: Record<string, unknown> | null;
  overall?: Record<string, unknown> | null;
}

export interface UnderwritingRun {
  run_id: string;
  timestamp_utc: string;
  case: RunCase;
  policy: RunPolicy;
  inputs?: RunInputs;
  trace?: RunTrace;
  decision: RunDecision;
  labels?: RunLabels;
  scores?: RunScores;
}

// ---------------------------------------------------------------------------
// BorrowerDossier — schemas/borrower-dossier.schema.json
// ---------------------------------------------------------------------------

export interface Transaction {
  date: string;
  description: string;
  amount: number;
}

export interface MonthlyStatement {
  month: string;
  opening_balance: number;
  deposits?: Transaction[];
  withdrawals?: Transaction[];
  ending_balance: number;
  total_deposits?: number;
  total_withdrawals?: number;
}

export interface QuarterlyIncome {
  quarter: string;
  revenue: number;
  expenses: number;
  gross_profit?: number;
  gross_margin_pct?: number;
  net_income: number;
  net_margin_pct?: number;
}

export interface FinancialDossier {
  company_name: string;
  sector: string;
  years_in_business?: number;
  annual_revenue: number;
  annual_expenses?: number;
  net_income?: number;
  employee_count?: number;
  bank_statements?: MonthlyStatement[];
  quarterly_income?: QuarterlyIncome[];
  narrative?: string;
  loan_request_amount: number;
  loan_purpose?: string;
}

export interface BorrowerDossier {
  borrower_id: string;
  true_outcome?: "good" | "bad" | "fraud";
  months_before_default?: number | null;
  dossier: FinancialDossier;
}

// ---------------------------------------------------------------------------
// ExtractionResult — schemas/extraction-result.schema.json
// ---------------------------------------------------------------------------

export interface ExtractionFields {
  Revenue?: number | null;
  Cogs?: number | null;
  Ebitda?: number | null;
  NetIncome?: number | null;
  CashAtBank?: number | null;
  TradeDebtors?: number | null;
  TradeCreditors?: number | null;
  Stock?: number | null;
}

export interface FieldEvidence {
  period_column?: string;
  unit_scale?: "full" | "thousands" | "millions";
  source_sheet?: string;
  source_row?: string;
  confidence?: number;
  [key: string]: unknown;
}

export interface ExtractionEvidence {
  Revenue?: FieldEvidence;
  Cogs?: FieldEvidence;
  Ebitda?: FieldEvidence;
  NetIncome?: FieldEvidence;
  CashAtBank?: FieldEvidence;
  TradeDebtors?: FieldEvidence;
  TradeCreditors?: FieldEvidence;
  Stock?: FieldEvidence;
}

export interface ExtractionMetadata {
  model?: string;
  latency_ms?: number;
  tokens_used?: number;
  case_id?: string;
  policy_id?: string;
  run_id?: string;
  [key: string]: unknown;
}

export interface ExtractionResult {
  extraction_id: string;
  deal_id?: string;
  company_name: string;
  period: string;
  source_document_ids?: string[];
  fields: ExtractionFields;
  evidence?: ExtractionEvidence;
  metadata?: ExtractionMetadata;
  created_at?: string;
}

// ---------------------------------------------------------------------------
// LosEventEnvelope — schemas/los-event-envelope.schema.json
// ---------------------------------------------------------------------------

export type LosEventType =
  | "deal.created"
  | "deal.updated"
  | "stage.transitioned"
  | "document.uploaded"
  | "document.classified"
  | "spread.created"
  | "entity.created"
  | "entity.linked"
  | "evaluation.started"
  | "evaluation.completed"
  | "facility.created"
  | "facility.converted"
  | "loan.created"
  | "loan.state_changed"
  | "loan.transaction_posted"
  | "covenant.created"
  | "covenant.tested"
  | "covenant.waived"
  | "alert.created";

export interface LosEventMetadata {
  run_id?: string;
  correlation_id?: string;
  source?: "api" | "agent" | "simulation" | "system";
  [key: string]: unknown;
}

export interface LosEventEnvelope {
  event_id: string;
  event_type: LosEventType;
  deal_id: string;
  tenant_id?: string;
  actor: string;
  timestamp: string;
  sequence?: number;
  payload?: Record<string, unknown>;
  metadata?: LosEventMetadata;
}
