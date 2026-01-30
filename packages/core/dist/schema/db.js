import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { sql } from "drizzle-orm";
import * as schema from "./tables.js";
export function createDatabase(url = ":memory:") {
    const client = createClient({ url });
    const db = drizzle(client, { schema });
    return db;
}
export async function migrateDatabase(db) {
    await db.run(sql `CREATE TABLE IF NOT EXISTS deals (
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
    await db.run(sql `CREATE TABLE IF NOT EXISTS documents (
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
    await db.run(sql `CREATE TABLE IF NOT EXISTS audit_events (
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
    await db.run(sql `CREATE TABLE IF NOT EXISTS stage_transitions (
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
    await db.run(sql `CREATE TABLE IF NOT EXISTS entities (
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
    await db.run(sql `CREATE TABLE IF NOT EXISTS relationships (
    id TEXT PRIMARY KEY,
    from_entity_id TEXT NOT NULL REFERENCES entities(id),
    to_entity_id TEXT NOT NULL REFERENCES entities(id),
    type TEXT NOT NULL,
    ownership_pct REAL,
    metadata TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(from_entity_id, to_entity_id, type)
  )`);
    await db.run(sql `CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL,
    deal_id TEXT NOT NULL REFERENCES deals(id),
    template_version TEXT,
    markdown TEXT NOT NULL,
    frozen_at TEXT NOT NULL
  )`);
    await db.run(sql `CREATE TABLE IF NOT EXISTS spreads (
    id TEXT PRIMARY KEY,
    deal_id TEXT NOT NULL REFERENCES deals(id),
    entity_id TEXT NOT NULL,
    period TEXT NOT NULL,
    line_items TEXT,
    ratios TEXT,
    created_at TEXT NOT NULL
  )`);
    await db.run(sql `CREATE TABLE IF NOT EXISTS covenants (
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
    await db.run(sql `CREATE TABLE IF NOT EXISTS covenant_tests (
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
    await db.run(sql `CREATE TABLE IF NOT EXISTS waivers (
    id TEXT PRIMARY KEY,
    covenant_id TEXT NOT NULL REFERENCES covenants(id),
    reason TEXT NOT NULL,
    approved_by TEXT NOT NULL,
    valid_from TEXT,
    valid_until TEXT,
    created_at TEXT NOT NULL
  )`);
    // ─── Monitoring Tables ─────────────────────────────────────────────────────────
    await db.run(sql `CREATE TABLE IF NOT EXISTS ingestions (
    id TEXT PRIMARY KEY,
    deal_id TEXT NOT NULL REFERENCES deals(id),
    source_type TEXT NOT NULL,
    records_accepted INTEGER NOT NULL,
    created_at TEXT NOT NULL
  )`);
    await db.run(sql `CREATE TABLE IF NOT EXISTS bank_transactions (
    id TEXT PRIMARY KEY,
    deal_id TEXT NOT NULL REFERENCES deals(id),
    ingestion_id TEXT NOT NULL REFERENCES ingestions(id),
    date TEXT NOT NULL,
    amount INTEGER NOT NULL,
    description TEXT NOT NULL,
    category TEXT,
    created_at TEXT NOT NULL
  )`);
    await db.run(sql `CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    deal_id TEXT NOT NULL REFERENCES deals(id),
    type TEXT NOT NULL,
    severity TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
    // ─── Communications Tables ─────────────────────────────────────────────────────
    await db.run(sql `CREATE TABLE IF NOT EXISTS communications (
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
    await db.run(sql `CREATE TABLE IF NOT EXISTS facilities (
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
    await db.run(sql `CREATE TABLE IF NOT EXISTS approval_requests (
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
    // ─── Skills Tables ─────────────────────────────────────────────────────────────
    await db.run(sql `CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    trigger TEXT,
    path TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'public',
    owner_id TEXT,
    version TEXT DEFAULT '1.0.0',
    tags TEXT,
    usage_count INTEGER DEFAULT 0,
    last_used_at TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    UNIQUE(tenant_id, scope, name)
  )`);
    await db.run(sql `CREATE TABLE IF NOT EXISTS skill_invocations (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    skill_id TEXT NOT NULL REFERENCES skills(id),
    skill_version TEXT,
    deal_id TEXT REFERENCES deals(id),
    entity_id TEXT REFERENCES entities(id),
    actor TEXT NOT NULL,
    actor_type TEXT,
    ai_provider TEXT,
    status TEXT NOT NULL,
    completed_at TEXT,
    output_summary TEXT,
    created_at TEXT NOT NULL
  )`);
    // ─── Indexes for Performance ─────────────────────────────────────────────────────
    await db.run(sql `CREATE INDEX IF NOT EXISTS idx_deals_tenant_stage ON deals(tenant_id, stage)`);
    await db.run(sql `CREATE INDEX IF NOT EXISTS idx_deals_tenant_created ON deals(tenant_id, created_at)`);
    await db.run(sql `CREATE INDEX IF NOT EXISTS idx_audit_deal_type ON audit_events(deal_id, type)`);
    await db.run(sql `CREATE INDEX IF NOT EXISTS idx_audit_deal_timestamp ON audit_events(deal_id, timestamp)`);
    await db.run(sql `CREATE INDEX IF NOT EXISTS idx_documents_deal ON documents(deal_id)`);
    await db.run(sql `CREATE INDEX IF NOT EXISTS idx_relationships_from ON relationships(from_entity_id)`);
    await db.run(sql `CREATE INDEX IF NOT EXISTS idx_relationships_to ON relationships(to_entity_id)`);
    await db.run(sql `CREATE INDEX IF NOT EXISTS idx_entities_tenant ON entities(tenant_id)`);
    await db.run(sql `CREATE INDEX IF NOT EXISTS idx_covenants_deal ON covenants(deal_id)`);
    await db.run(sql `CREATE INDEX IF NOT EXISTS idx_covenant_tests_covenant ON covenant_tests(covenant_id)`);
    await db.run(sql `CREATE INDEX IF NOT EXISTS idx_spreads_deal ON spreads(deal_id)`);
    await db.run(sql `CREATE INDEX IF NOT EXISTS idx_skills_tenant_scope ON skills(tenant_id, scope)`);
    await db.run(sql `CREATE INDEX IF NOT EXISTS idx_skill_invocations_skill ON skill_invocations(skill_id)`);
    await db.run(sql `CREATE INDEX IF NOT EXISTS idx_skill_invocations_deal ON skill_invocations(deal_id)`);
    await db.run(sql `CREATE INDEX IF NOT EXISTS idx_skill_invocations_actor ON skill_invocations(actor)`);
}
export { schema };
//# sourceMappingURL=db.js.map