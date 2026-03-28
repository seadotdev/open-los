import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { sql } from "drizzle-orm";
import * as schema from "./tables.js";

export type Database = ReturnType<typeof createDatabase>;

function normalizeDatabaseUrl(url: string) {
  const normalized = url.trim();
  if (
    normalized === ":memory:" ||
    normalized === "file::memory:" ||
    normalized === "file::memory:?cache=shared"
  ) {
    // libsql can isolate in-memory state per connection in this runtime, which
    // causes migrated tables to disappear during request handling. Use a local
    // file-backed database for the default path so all handlers share one schema.
    return "file:./openlos-default.db";
  }
  return normalized;
}

export function createDatabase(url = ":memory:") {
  const client = createClient({ url: normalizeDatabaseUrl(url) });
  const db = drizzle(client, { schema });
  return db;
}

export async function migrateDatabase(db: Database) {
  await db.run(sql`CREATE TABLE IF NOT EXISTS deals (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    borrower_name TEXT NOT NULL,
    borrower_registration_number TEXT,
    jurisdiction TEXT,
    requested_amount INTEGER,
    purpose TEXT,
    stage TEXT NOT NULL DEFAULT 'broker',
    origination_outcome TEXT,
    assigned_to TEXT,
    primary_entity_id TEXT,
    custom_fields TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  )`);

  await db.run(sql`CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    deal_id TEXT NOT NULL REFERENCES deals(id),
    doc_type TEXT NOT NULL,
    phase TEXT,
    filename TEXT NOT NULL,
    label TEXT,
    mime_type TEXT,
    size_bytes INTEGER,
    checksum TEXT,
    content BLOB,
    version INTEGER NOT NULL DEFAULT 1,
    source TEXT,
    created_at TEXT NOT NULL,
    created_by TEXT,
    deleted_at TEXT
  )`);

  await db.run(sql`CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    seq INTEGER NOT NULL,
    deal_id TEXT NOT NULL REFERENCES deals(id),
    type TEXT NOT NULL,
    actor TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    object_type TEXT,
    object_id TEXT,
    changes TEXT,
    metadata TEXT
  )`);

  await db.run(sql`CREATE TABLE IF NOT EXISTS stage_transitions (
    id TEXT PRIMARY KEY,
    deal_id TEXT NOT NULL REFERENCES deals(id),
    from_stage TEXT NOT NULL,
    to_stage TEXT NOT NULL,
    actor TEXT NOT NULL,
    rationale TEXT,
    override INTEGER DEFAULT 0,
    override_rationale TEXT,
    checklist_snapshot TEXT,
    transitioned_at TEXT NOT NULL
  )`);

  await db.run(sql`CREATE TABLE IF NOT EXISTS entities (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    legal_name TEXT,
    registration_number TEXT,
    lei TEXT,
    jurisdiction TEXT,
    identifiers TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT
  )`);

  await db.run(sql`CREATE TABLE IF NOT EXISTS relationships (
    id TEXT PRIMARY KEY,
    from_entity_id TEXT NOT NULL REFERENCES entities(id),
    to_entity_id TEXT NOT NULL REFERENCES entities(id),
    type TEXT NOT NULL,
    ownership_pct REAL,
    metadata TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(from_entity_id, to_entity_id, type)
  )`);

  await db.run(sql`CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL,
    deal_id TEXT NOT NULL REFERENCES deals(id),
    template_version TEXT,
    markdown TEXT NOT NULL,
    frozen_at TEXT NOT NULL
  )`);

  await db.run(sql`CREATE TABLE IF NOT EXISTS spreads (
    id TEXT PRIMARY KEY,
    deal_id TEXT NOT NULL REFERENCES deals(id),
    entity_id TEXT NOT NULL,
    period TEXT NOT NULL,
    line_items TEXT,
    ratios TEXT,
    created_at TEXT NOT NULL
  )`);

  await db.run(sql`CREATE TABLE IF NOT EXISTS covenants (
    id TEXT PRIMARY KEY,
    deal_id TEXT NOT NULL REFERENCES deals(id),
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    metric TEXT NOT NULL,
    operator TEXT,
    threshold REAL,
    frequency TEXT,
    grace_period_days INTEGER DEFAULT 0,
    notes TEXT,
    reporting_deadline_days INTEGER,
    created_at TEXT NOT NULL
  )`);

  await db.run(sql`CREATE TABLE IF NOT EXISTS covenant_tests (
    id TEXT PRIMARY KEY,
    covenant_id TEXT NOT NULL REFERENCES covenants(id),
    deal_id TEXT NOT NULL REFERENCES deals(id),
    status TEXT NOT NULL,
    actual_value REAL,
    threshold REAL,
    operator TEXT,
    metric TEXT,
    tested_at TEXT NOT NULL,
    grace_period_expires TEXT
  )`);

  await db.run(sql`CREATE TABLE IF NOT EXISTS waivers (
    id TEXT PRIMARY KEY,
    covenant_id TEXT NOT NULL REFERENCES covenants(id),
    reason TEXT NOT NULL,
    approved_by TEXT NOT NULL,
    valid_from TEXT,
    valid_until TEXT,
    created_at TEXT NOT NULL
  )`);

  // ─── Monitoring Tables ─────────────────────────────────────────────────────────

  await db.run(sql`CREATE TABLE IF NOT EXISTS ingestions (
    id TEXT PRIMARY KEY,
    deal_id TEXT NOT NULL REFERENCES deals(id),
    source_type TEXT NOT NULL,
    records_accepted INTEGER NOT NULL,
    created_at TEXT NOT NULL
  )`);

  await db.run(sql`CREATE TABLE IF NOT EXISTS bank_transactions (
    id TEXT PRIMARY KEY,
    deal_id TEXT NOT NULL REFERENCES deals(id),
    ingestion_id TEXT NOT NULL REFERENCES ingestions(id),
    date TEXT NOT NULL,
    amount INTEGER NOT NULL,
    description TEXT NOT NULL,
    category TEXT,
    created_at TEXT NOT NULL
  )`);

  await db.run(sql`CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    deal_id TEXT NOT NULL REFERENCES deals(id),
    type TEXT NOT NULL,
    severity TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);

  // ─── Communications Tables ─────────────────────────────────────────────────────

  await db.run(sql`CREATE TABLE IF NOT EXISTS communications (
    id TEXT PRIMARY KEY,
    deal_id TEXT REFERENCES deals(id),
    type TEXT NOT NULL,
    subject TEXT,
    from_address TEXT,
    to_addresses TEXT,
    body TEXT,
    thread_id TEXT,
    attachments TEXT,
    created_at TEXT NOT NULL
  )`);

  // ─── Facilities Tables ─────────────────────────────────────────────────────────

  await db.run(sql`CREATE TABLE IF NOT EXISTS facilities (
    id TEXT PRIMARY KEY,
    deal_id TEXT NOT NULL REFERENCES deals(id),
    type TEXT NOT NULL,
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    interest_rate_type TEXT,
    interest_rate_value REAL,
    interest_rate_spread REAL,
    term_months INTEGER,
    repayment_schedule TEXT,
    status TEXT NOT NULL DEFAULT 'proposed',
    created_at TEXT NOT NULL,
    updated_at TEXT
  )`);

  // ─── Approval Workflow Tables ─────────────────────────────────────────────────────

  await db.run(sql`CREATE TABLE IF NOT EXISTS approval_requests (
    id TEXT PRIMARY KEY,
    deal_id TEXT NOT NULL REFERENCES deals(id),
    type TEXT NOT NULL,
    requested_by TEXT NOT NULL,
    requested_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    decided_by TEXT,
    decided_at TEXT,
    decision_rationale TEXT,
    payload TEXT
  )`);

  // ─── Deposit Account Tables ─────────────────────────────────────────────────────

  await db.run(sql`CREATE TABLE IF NOT EXISTS deposit_accounts (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    account_id TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    account_holder TEXT NOT NULL,
    account_holder_id TEXT,
    currency TEXT NOT NULL DEFAULT 'USD',
    balance INTEGER NOT NULL DEFAULT 0,
    interest_rate REAL,
    maturity_date TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    custom_fields TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT
  )`);

  // ─── Loan Ledger Tables ─────────────────────────────────────────────────────────

  await db.run(sql`CREATE TABLE IF NOT EXISTS loan_accounts (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    encoded_key TEXT NOT NULL UNIQUE,
    account_id TEXT NOT NULL,
    deal_id TEXT REFERENCES deals(id),
    facility_id TEXT REFERENCES facilities(id),
    account_holder_type TEXT NOT NULL,
    account_holder_id TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    sub_state TEXT,
    loan_amount INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    interest_rate REAL,
    interest_rate_type TEXT,
    interest_rate_spread REAL,
    interest_calculation_method TEXT,
    repayment_method TEXT,
    repayment_frequency TEXT,
    term_months INTEGER,
    grace_period_days INTEGER DEFAULT 0,
    first_repayment_date TEXT,
    principal_disbursed INTEGER DEFAULT 0,
    principal_outstanding INTEGER DEFAULT 0,
    principal_paid INTEGER DEFAULT 0,
    interest_accrued INTEGER DEFAULT 0,
    interest_paid INTEGER DEFAULT 0,
    fees_outstanding INTEGER DEFAULT 0,
    fees_paid INTEGER DEFAULT 0,
    penalties_outstanding INTEGER DEFAULT 0,
    penalties_paid INTEGER DEFAULT 0,
    days_in_arrears INTEGER DEFAULT 0,
    arrears_since TEXT,
    approved_at TEXT,
    approved_by TEXT,
    disbursed_at TEXT,
    disbursed_by TEXT,
    closed_at TEXT,
    closed_by TEXT,
    locked_at TEXT,
    custom_fields TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT
  )`);

  await db.run(sql`CREATE TABLE IF NOT EXISTS loan_transactions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    encoded_key TEXT NOT NULL UNIQUE,
    loan_account_id TEXT NOT NULL REFERENCES loan_accounts(id),
    type TEXT NOT NULL,
    entry_date TEXT NOT NULL,
    value_date TEXT NOT NULL,
    booking_date TEXT,
    amount INTEGER NOT NULL,
    principal_amount INTEGER,
    interest_amount INTEGER,
    fees_amount INTEGER,
    penalties_amount INTEGER,
    balance_principal INTEGER,
    balance_interest INTEGER,
    balance_fees INTEGER,
    balance_total INTEGER,
    original_transaction_id TEXT,
    reversed_by_transaction_id TEXT,
    disbursement_details TEXT,
    repayment_allocation TEXT,
    idempotency_key TEXT UNIQUE,
    actor TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL
  )`);

  await db.run(sql`CREATE TABLE IF NOT EXISTS repayment_schedule (
    id TEXT PRIMARY KEY,
    loan_account_id TEXT NOT NULL REFERENCES loan_accounts(id),
    installment_number INTEGER NOT NULL,
    encoded_key TEXT NOT NULL,
    due_date TEXT NOT NULL,
    principal_due INTEGER NOT NULL DEFAULT 0,
    interest_due INTEGER NOT NULL DEFAULT 0,
    fees_due INTEGER NOT NULL DEFAULT 0,
    penalties_due INTEGER NOT NULL DEFAULT 0,
    principal_paid INTEGER NOT NULL DEFAULT 0,
    interest_paid INTEGER NOT NULL DEFAULT 0,
    fees_paid INTEGER NOT NULL DEFAULT 0,
    penalties_paid INTEGER NOT NULL DEFAULT 0,
    state TEXT NOT NULL DEFAULT 'PENDING',
    last_payment_date TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT
  )`);

  // ─── Approval Gate Tables ─────────────────────────────────────────────────────

  await db.run(sql`CREATE TABLE IF NOT EXISTS approval_gate_policies (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    loan_line TEXT,
    action TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'human',
    min_amount INTEGER,
    stages TEXT,
    approver_roles TEXT,
    priority INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT
  )`);

  await db.run(sql`CREATE TABLE IF NOT EXISTS approval_gate_records (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    policy_id TEXT NOT NULL REFERENCES approval_gate_policies(id),
    deal_id TEXT REFERENCES deals(id),
    action TEXT NOT NULL,
    actor TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    context_snapshot TEXT,
    approvals TEXT,
    decided_by TEXT,
    decided_at TEXT,
    decision_rationale TEXT,
    expires_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT
  )`);

  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_loan_accounts_tenant_account_id ON loan_accounts(tenant_id, account_id)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_gate_policies_tenant_action ON approval_gate_policies(tenant_id, action)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_gate_records_tenant_status ON approval_gate_records(tenant_id, status)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_gate_records_deal ON approval_gate_records(deal_id)`);

  // ─── Tenant Settings Table ────────────────────────────────────────────────────

  await db.run(sql`CREATE TABLE IF NOT EXISTS tenant_settings (
    tenant_id TEXT PRIMARY KEY,
    disabled_guards TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT
  )`);

  // ─── Sandbox Tables ─────────────────────────────────────────────────────────

  await db.run(sql`CREATE TABLE IF NOT EXISTS sandboxes (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    name TEXT NOT NULL,
    description TEXT,
    parent_type TEXT NOT NULL,
    parent_id TEXT,
    git_branch TEXT NOT NULL,
    base_commit TEXT,
    forked_from_sandbox_id TEXT,
    forked_from_checkpoint_id TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_by TEXT NOT NULL,
    assigned_to TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    archived_at TEXT
  )`);

  await db.run(sql`CREATE TABLE IF NOT EXISTS checkpoints (
    id TEXT PRIMARY KEY,
    sandbox_id TEXT NOT NULL REFERENCES sandboxes(id),
    name TEXT NOT NULL,
    description TEXT,
    git_commit TEXT NOT NULL,
    git_tag TEXT,
    sequence INTEGER NOT NULL,
    snapshot TEXT,
    changes_summary TEXT,
    changed_entities TEXT,
    metrics TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    restorable INTEGER NOT NULL DEFAULT 1
  )`);

  await db.run(sql`CREATE TABLE IF NOT EXISTS sandbox_entities (
    id TEXT PRIMARY KEY,
    sandbox_id TEXT NOT NULL REFERENCES sandboxes(id),
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    origin TEXT NOT NULL,
    original_entity_id TEXT,
    state TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  )`);

  // ─── Decision Trace Tables ────────────────────────────────────────────────────

  await db.run(sql`CREATE TABLE IF NOT EXISTS decision_traces (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    deal_id TEXT NOT NULL REFERENCES deals(id),
    trigger TEXT NOT NULL,
    task TEXT NOT NULL,
    actor TEXT NOT NULL,
    outcome TEXT,
    outcome_data TEXT,
    conversation_id TEXT,
    parent_trace_id TEXT,
    status TEXT NOT NULL DEFAULT 'in_progress',
    total_duration_ms INTEGER,
    total_tokens_in INTEGER,
    total_tokens_out INTEGER,
    created_at TEXT NOT NULL,
    completed_at TEXT
  )`);

  await db.run(sql`CREATE TABLE IF NOT EXISTS trace_steps (
    id TEXT PRIMARY KEY,
    trace_id TEXT NOT NULL REFERENCES decision_traces(id),
    seq INTEGER NOT NULL,
    type TEXT NOT NULL,
    content TEXT,
    tool_name TEXT,
    tool_input TEXT,
    tool_output TEXT,
    duration_ms INTEGER,
    created_at TEXT NOT NULL
  )`);

  await db.run(sql`CREATE TABLE IF NOT EXISTS trace_evidence (
    id TEXT PRIMARY KEY,
    step_id TEXT NOT NULL REFERENCES trace_steps(id),
    ref_type TEXT NOT NULL,
    ref_id TEXT NOT NULL,
    relevance TEXT,
    created_at TEXT NOT NULL
  )`);

  // ─── AI Conversation Tables ─────────────────────────────────────────────────────

  await db.run(sql`CREATE TABLE IF NOT EXISTS ai_conversations (
    id TEXT PRIMARY KEY,
    deal_id TEXT NOT NULL REFERENCES deals(id),
    stage TEXT NOT NULL,
    permission_mode TEXT NOT NULL DEFAULT 'ask',
    model TEXT NOT NULL,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0,
    summary TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);

  await db.run(sql`CREATE TABLE IF NOT EXISTS ai_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES ai_conversations(id),
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    tool_calls TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,
    attachments TEXT,
    created_at TEXT NOT NULL
  )`);

  // ─── Indexes for Performance ─────────────────────────────────────────────────────

  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_deals_tenant_stage ON deals(tenant_id, stage)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_deals_tenant_created ON deals(tenant_id, created_at)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_audit_deal_type ON audit_events(deal_id, type)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_audit_deal_timestamp ON audit_events(deal_id, timestamp)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_documents_deal ON documents(deal_id)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_relationships_from ON relationships(from_entity_id)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_relationships_to ON relationships(to_entity_id)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_entities_tenant ON entities(tenant_id)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_covenants_deal ON covenants(deal_id)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_covenant_tests_covenant ON covenant_tests(covenant_id)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_spreads_deal ON spreads(deal_id)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_decision_traces_deal ON decision_traces(deal_id)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_decision_traces_tenant ON decision_traces(tenant_id, created_at)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_decision_traces_trigger ON decision_traces(trigger)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_trace_steps_trace ON trace_steps(trace_id, seq)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_trace_evidence_step ON trace_evidence(step_id)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_trace_evidence_ref ON trace_evidence(ref_type, ref_id)`);
}

export { schema };
