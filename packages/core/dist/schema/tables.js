import { sqliteTable, text, integer, blob, real } from "drizzle-orm/sqlite-core";
export const deals = sqliteTable("deals", {
    id: text("id").primaryKey(),
    tenant_id: text("tenant_id").notNull().default("default"),
    borrower_name: text("borrower_name").notNull(),
    borrower_registration_number: text("borrower_registration_number"),
    jurisdiction: text("jurisdiction"),
    requested_amount: integer("requested_amount"),
    purpose: text("purpose"),
    stage: text("stage").notNull().default("broker"),
    origination_outcome: text("origination_outcome"),
    assigned_to: text("assigned_to"),
    primary_entity_id: text("primary_entity_id"),
    custom_fields: text("custom_fields", { mode: "json" }),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
    deleted_at: text("deleted_at"), // null = active, ISO timestamp = soft deleted
});
export const documents = sqliteTable("documents", {
    id: text("id").primaryKey(),
    deal_id: text("deal_id")
        .notNull()
        .references(() => deals.id),
    doc_type: text("doc_type").notNull(),
    phase: text("phase"),
    filename: text("filename").notNull(),
    label: text("label"),
    mime_type: text("mime_type"),
    size_bytes: integer("size_bytes"),
    checksum: text("checksum"),
    content: blob("content"),
    version: integer("version").notNull().default(1),
    source: text("source"), // "email_attachment" | null
    created_at: text("created_at").notNull(),
    created_by: text("created_by"),
    deleted_at: text("deleted_at"), // null = active, ISO timestamp = soft deleted
});
export const auditEvents = sqliteTable("audit_events", {
    id: text("id").primaryKey(),
    seq: integer("seq").notNull(),
    deal_id: text("deal_id")
        .notNull()
        .references(() => deals.id),
    type: text("type").notNull(),
    actor: text("actor").notNull(),
    timestamp: text("timestamp").notNull(),
    object_type: text("object_type"),
    object_id: text("object_id"),
    changes: text("changes", { mode: "json" }),
    metadata: text("metadata", { mode: "json" }),
});
export const stageTransitions = sqliteTable("stage_transitions", {
    id: text("id").primaryKey(),
    deal_id: text("deal_id")
        .notNull()
        .references(() => deals.id),
    from_stage: text("from_stage").notNull(),
    to_stage: text("to_stage").notNull(),
    actor: text("actor").notNull(),
    rationale: text("rationale"),
    override: integer("override", { mode: "boolean" }).default(false),
    override_rationale: text("override_rationale"),
    checklist_snapshot: text("checklist_snapshot", { mode: "json" }),
    transitioned_at: text("transitioned_at").notNull(),
});
export const entities = sqliteTable("entities", {
    id: text("id").primaryKey(),
    tenant_id: text("tenant_id").notNull().default("default"),
    type: text("type").notNull(), // "company" | "person"
    name: text("name").notNull(),
    legal_name: text("legal_name"),
    registration_number: text("registration_number"),
    lei: text("lei"),
    jurisdiction: text("jurisdiction"),
    identifiers: text("identifiers", { mode: "json" }), // array of {scheme, value, authority?, confidence?}
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at"),
    deleted_at: text("deleted_at"), // null = active, ISO timestamp = soft deleted
});
export const relationships = sqliteTable("relationships", {
    id: text("id").primaryKey(),
    from_entity_id: text("from_entity_id")
        .notNull()
        .references(() => entities.id),
    to_entity_id: text("to_entity_id")
        .notNull()
        .references(() => entities.id),
    type: text("type").notNull(), // "owns" | "guarantees" | "directs"
    ownership_pct: real("ownership_pct"),
    metadata: text("metadata", { mode: "json" }),
    created_at: text("created_at").notNull(),
});
export const artifacts = sqliteTable("artifacts", {
    id: text("id").primaryKey(),
    template_id: text("template_id").notNull(),
    deal_id: text("deal_id")
        .notNull()
        .references(() => deals.id),
    template_version: text("template_version"),
    markdown: text("markdown").notNull(),
    frozen_at: text("frozen_at").notNull(),
});
export const spreads = sqliteTable("spreads", {
    id: text("id").primaryKey(),
    deal_id: text("deal_id")
        .notNull()
        .references(() => deals.id),
    entity_id: text("entity_id").notNull(),
    period: text("period").notNull(),
    line_items: text("line_items", { mode: "json" }), // array of {category, label, amount}
    ratios: text("ratios", { mode: "json" }), // computed ratio object
    created_at: text("created_at").notNull(),
});
export const covenants = sqliteTable("covenants", {
    id: text("id").primaryKey(),
    deal_id: text("deal_id")
        .notNull()
        .references(() => deals.id),
    name: text("name").notNull(),
    type: text("type").notNull(), // "financial" | "reporting" | "information"
    metric: text("metric").notNull(),
    operator: text("operator"), // ">=", "<=", ">", "<", "=="
    threshold: real("threshold"),
    frequency: text("frequency"), // "monthly" | "quarterly" | "annually"
    grace_period_days: integer("grace_period_days").default(0),
    notes: text("notes"),
    reporting_deadline_days: integer("reporting_deadline_days"),
    created_at: text("created_at").notNull(),
});
export const covenantTests = sqliteTable("covenant_tests", {
    id: text("id").primaryKey(),
    covenant_id: text("covenant_id")
        .notNull()
        .references(() => covenants.id),
    deal_id: text("deal_id")
        .notNull()
        .references(() => deals.id),
    status: text("status").notNull(), // "pass" | "fail" | "warning" | "grace_period" | "waived"
    actual_value: real("actual_value"),
    threshold: real("threshold"),
    operator: text("operator"),
    metric: text("metric"),
    tested_at: text("tested_at").notNull(),
    grace_period_expires: text("grace_period_expires"),
});
export const waivers = sqliteTable("waivers", {
    id: text("id").primaryKey(),
    covenant_id: text("covenant_id")
        .notNull()
        .references(() => covenants.id),
    reason: text("reason").notNull(),
    approved_by: text("approved_by").notNull(),
    valid_from: text("valid_from"),
    valid_until: text("valid_until"),
    created_at: text("created_at").notNull(),
});
// ─── Monitoring Tables ─────────────────────────────────────────────────────────
export const ingestions = sqliteTable("ingestions", {
    id: text("id").primaryKey(),
    deal_id: text("deal_id")
        .notNull()
        .references(() => deals.id),
    source_type: text("source_type").notNull(), // "bank_transactions" | "accounting"
    records_accepted: integer("records_accepted").notNull(),
    created_at: text("created_at").notNull(),
});
export const bankTransactions = sqliteTable("bank_transactions", {
    id: text("id").primaryKey(),
    deal_id: text("deal_id")
        .notNull()
        .references(() => deals.id),
    ingestion_id: text("ingestion_id")
        .notNull()
        .references(() => ingestions.id),
    date: text("date").notNull(), // ISO date (YYYY-MM-DD)
    amount: integer("amount").notNull(), // Minor units, negative = debit/outflow
    description: text("description").notNull(),
    category: text("category"),
    created_at: text("created_at").notNull(),
});
export const alerts = sqliteTable("alerts", {
    id: text("id").primaryKey(),
    deal_id: text("deal_id")
        .notNull()
        .references(() => deals.id),
    type: text("type").notNull(), // "covenant_breach" | "liquidity_warning" | "data_gap" | "payment_missed"
    severity: text("severity").notNull(), // "info" | "warning" | "critical"
    message: text("message").notNull(),
    created_at: text("created_at").notNull(),
});
// ─── Communications Tables ─────────────────────────────────────────────────────
export const communications = sqliteTable("communications", {
    id: text("id").primaryKey(),
    deal_id: text("deal_id").references(() => deals.id), // nullable - may not be linked to a deal
    type: text("type").notNull(), // "email" | "note" | "meeting"
    subject: text("subject"),
    from_address: text("from_address"),
    to_addresses: text("to_addresses", { mode: "json" }), // array of strings
    body: text("body"),
    thread_id: text("thread_id"), // Message-ID or In-Reply-To for threading
    attachments: text("attachments", { mode: "json" }), // array of document IDs
    created_at: text("created_at").notNull(),
});
// ─── Facilities Tables ─────────────────────────────────────────────────────────
export const facilities = sqliteTable("facilities", {
    id: text("id").primaryKey(),
    deal_id: text("deal_id")
        .notNull()
        .references(() => deals.id),
    type: text("type").notNull(), // "term_loan" | "revolver" | "letter_of_credit"
    amount: integer("amount").notNull(), // minor units
    currency: text("currency").notNull().default("USD"),
    interest_rate_type: text("interest_rate_type"), // "fixed" | "floating"
    interest_rate_value: real("interest_rate_value"), // e.g., 0.05 for 5%
    interest_rate_spread: real("interest_rate_spread"), // spread over base rate
    term_months: integer("term_months"),
    repayment_schedule: text("repayment_schedule", { mode: "json" }),
    status: text("status").notNull().default("proposed"), // "proposed" | "approved" | "active" | "closed"
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at"),
});
// ─── Approval Workflow Tables ─────────────────────────────────────────────────────
export const approvalRequests = sqliteTable("approval_requests", {
    id: text("id").primaryKey(),
    deal_id: text("deal_id")
        .notNull()
        .references(() => deals.id),
    type: text("type").notNull(), // "stage_transition" | "facility_approval" | "covenant_waiver"
    requested_by: text("requested_by").notNull(),
    requested_at: text("requested_at").notNull(),
    status: text("status").notNull().default("pending"), // "pending" | "approved" | "rejected" | "cancelled"
    decided_by: text("decided_by"),
    decided_at: text("decided_at"),
    decision_rationale: text("decision_rationale"),
    payload: text("payload", { mode: "json" }), // type-specific data
});
// ─── Loan Ledger Tables (Mambu-compatible) ─────────────────────────────────────
export const loanAccounts = sqliteTable("loan_accounts", {
    id: text("id").primaryKey(),
    tenant_id: text("tenant_id").notNull().default("default"),
    // Mambu-style identifiers
    encoded_key: text("encoded_key").notNull().unique(), // UUID for API compatibility
    account_id: text("account_id").notNull().unique(), // Human-readable (e.g., "LN-00001")
    // Relationships
    deal_id: text("deal_id").references(() => deals.id), // Link to originating deal
    facility_id: text("facility_id").references(() => facilities.id), // Link to facility
    // Account holder (maps to Mambu's accountHolderType + accountHolderKey)
    account_holder_type: text("account_holder_type").notNull(), // "CLIENT" (maps to entity)
    account_holder_id: text("account_holder_id").notNull(), // → entities.id
    // State machine (Mambu states)
    state: text("state").notNull().default("PENDING_APPROVAL"),
    // "PARTIAL_APPLICATION" | "PENDING_APPROVAL" | "APPROVED" | "ACTIVE" | "ACTIVE_IN_ARREARS" | "LOCKED" | "CLOSED"
    sub_state: text("sub_state"),
    // "WITHDRAWN" | "REJECTED" | "WRITTEN_OFF" | "PAID_OFF" | "REFINANCED" | "RESCHEDULED"
    // Terms (copied from facility at creation, immutable after approval)
    loan_amount: integer("loan_amount").notNull(), // Approved amount (minor units)
    currency: text("currency").notNull().default("USD"),
    interest_rate: real("interest_rate"), // Annual rate (0.05 = 5%)
    interest_rate_type: text("interest_rate_type"), // "FIXED" | "FLOATING"
    interest_rate_spread: real("interest_rate_spread"), // Spread over base (floating)
    interest_calculation_method: text("interest_calculation_method"), // "DECLINING_BALANCE" | "FLAT"
    repayment_method: text("repayment_method"), // "EQUAL_INSTALLMENTS" | "BALLOON" | "INTEREST_ONLY"
    repayment_frequency: text("repayment_frequency"), // "MONTHLY" | "QUARTERLY" | "ANNUALLY"
    term_months: integer("term_months"),
    grace_period_days: integer("grace_period_days").default(0),
    first_repayment_date: text("first_repayment_date"), // ISO date
    // Balances (updated on each transaction)
    principal_disbursed: integer("principal_disbursed").default(0),
    principal_outstanding: integer("principal_outstanding").default(0),
    principal_paid: integer("principal_paid").default(0),
    interest_accrued: integer("interest_accrued").default(0),
    interest_paid: integer("interest_paid").default(0),
    fees_outstanding: integer("fees_outstanding").default(0),
    fees_paid: integer("fees_paid").default(0),
    penalties_outstanding: integer("penalties_outstanding").default(0),
    penalties_paid: integer("penalties_paid").default(0),
    // Arrears tracking
    days_in_arrears: integer("days_in_arrears").default(0),
    arrears_since: text("arrears_since"), // ISO date when arrears started
    // Lifecycle timestamps
    approved_at: text("approved_at"),
    approved_by: text("approved_by"),
    disbursed_at: text("disbursed_at"),
    disbursed_by: text("disbursed_by"),
    closed_at: text("closed_at"),
    closed_by: text("closed_by"),
    locked_at: text("locked_at"),
    // Extension
    custom_fields: text("custom_fields", { mode: "json" }),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at"),
});
export const loanTransactions = sqliteTable("loan_transactions", {
    id: text("id").primaryKey(),
    tenant_id: text("tenant_id").notNull().default("default"),
    // Mambu-style identifier
    encoded_key: text("encoded_key").notNull().unique(),
    // Parent
    loan_account_id: text("loan_account_id")
        .notNull()
        .references(() => loanAccounts.id),
    // Transaction type (Mambu-compatible subset)
    type: text("type").notNull(),
    // State changes: "APPROVAL" | "PENDING_APPROVAL" | "UNDO_APPROVAL" | "REJECT" | "WITHDRAW" | "LOCK" | "UNLOCK"
    // Financial: "DISBURSEMENT" | "REPAYMENT" | "FEE" | "INTEREST_APPLIED" | "PENALTY_APPLIED" | "WRITE_OFF"
    // Adjustments: "DISBURSEMENT_ADJUSTMENT" | "REPAYMENT_ADJUSTMENT" | "FEE_ADJUSTMENT" | "INTEREST_ADJUSTMENT" | "WRITE_OFF_ADJUSTMENT"
    // Dates (Mambu uses three dates)
    entry_date: text("entry_date").notNull(), // When posted to system
    value_date: text("value_date").notNull(), // Effective date for interest calc
    booking_date: text("booking_date"), // When hit the books (often same as entry)
    // Amounts (minor units)
    amount: integer("amount").notNull(), // Total transaction amount
    principal_amount: integer("principal_amount"), // Principal portion
    interest_amount: integer("interest_amount"), // Interest portion
    fees_amount: integer("fees_amount"), // Fees portion
    penalties_amount: integer("penalties_amount"), // Penalties portion
    // Balance after transaction (snapshot for audit)
    balance_principal: integer("balance_principal"),
    balance_interest: integer("balance_interest"),
    balance_fees: integer("balance_fees"),
    balance_total: integer("balance_total"),
    // Reversal tracking
    original_transaction_id: text("original_transaction_id"), // If this is a reversal
    reversed_by_transaction_id: text("reversed_by_transaction_id"), // If this was reversed
    // Disbursement details (when type = DISBURSEMENT)
    disbursement_details: text("disbursement_details", { mode: "json" }),
    // { method, channel, expected_date, fees: [] }
    // Repayment allocation (when type = REPAYMENT)
    repayment_allocation: text("repayment_allocation", { mode: "json" }),
    // { allocation_order, custom_amounts: { principal, interest, fees, penalties } }
    // Idempotency (Mambu pattern - prevents duplicate transactions)
    idempotency_key: text("idempotency_key").unique(),
    // Audit
    actor: text("actor").notNull(),
    notes: text("notes"),
    created_at: text("created_at").notNull(),
});
export const repaymentSchedule = sqliteTable("repayment_schedule", {
    id: text("id").primaryKey(),
    loan_account_id: text("loan_account_id")
        .notNull()
        .references(() => loanAccounts.id),
    // Installment identity
    installment_number: integer("installment_number").notNull(),
    encoded_key: text("encoded_key").notNull(),
    // Due date
    due_date: text("due_date").notNull(), // ISO date
    // Expected amounts (minor units)
    principal_due: integer("principal_due").notNull().default(0),
    interest_due: integer("interest_due").notNull().default(0),
    fees_due: integer("fees_due").notNull().default(0),
    penalties_due: integer("penalties_due").notNull().default(0),
    // Paid amounts
    principal_paid: integer("principal_paid").notNull().default(0),
    interest_paid: integer("interest_paid").notNull().default(0),
    fees_paid: integer("fees_paid").notNull().default(0),
    penalties_paid: integer("penalties_paid").notNull().default(0),
    // State
    state: text("state").notNull().default("PENDING"),
    // "PENDING" | "PARTIALLY_PAID" | "PAID" | "LATE" | "GRACE_PERIOD"
    // Tracking
    last_payment_date: text("last_payment_date"),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at"),
});
//# sourceMappingURL=tables.js.map