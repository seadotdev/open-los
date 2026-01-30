# Phase 6: Architecture Fixes & Missing Features

## Completion Promise

When all issues are addressed and all tests pass, output exactly: `PHASE 6 COMPLETE`

## Context

An architecture review identified critical issues and missing features. This phase addresses them before adding new functionality.

Read these files:
- `AGENTS.md` — coding standards
- `packages/core/src/schema/tables.ts` — current DB schema
- `packages/core/src/services/*.ts` — current services
- `packages/api/src/routes/*.ts` — current routes

## Critical Issues to Fix

### 1. Tenant Isolation (Security Critical)

**Problem:** `tenant_id` exists on tables but queries don't filter by it. Any user can access any tenant's data.

**Fix:**
- Add `tenantId` parameter to all service methods
- Add `WHERE tenant_id = ?` to ALL queries (deals, entities, documents, audit, etc.)
- Create middleware that extracts tenant from request (X-Tenant-Id header for now)
- Inject tenant into service context

Example pattern:
```typescript
// Before (broken)
async getById(id: string) {
  return this.db.select().from(deals).where(eq(deals.id, id));
}

// After (secure)
async getById(tenantId: string, id: string) {
  return this.db.select().from(deals)
    .where(and(eq(deals.tenant_id, tenantId), eq(deals.id, id)));
}
```

### 2. Database Indexes (Performance Critical)

**Problem:** No indexes defined. Queries will be slow at scale.

**Fix:** Add to schema migration:
```sql
CREATE INDEX idx_deals_tenant_stage ON deals(tenant_id, stage);
CREATE INDEX idx_deals_tenant_created ON deals(tenant_id, created_at);
CREATE INDEX idx_audit_deal_type ON audit_events(deal_id, type);
CREATE INDEX idx_audit_deal_timestamp ON audit_events(deal_id, timestamp);
CREATE INDEX idx_documents_deal ON documents(deal_id);
CREATE INDEX idx_relationships_from ON relationships(from_entity_id);
CREATE INDEX idx_relationships_to ON relationships(to_entity_id);
CREATE INDEX idx_entities_tenant ON entities(tenant_id);
CREATE INDEX idx_covenants_deal ON covenants(deal_id);
CREATE INDEX idx_covenant_tests_covenant ON covenant_tests(covenant_id);
CREATE INDEX idx_spreads_deal ON spreads(deal_id);
```

### 3. Duplicate Ratio Computation

**Problem:** `SpreadService` and `CovenantService` both compute financial ratios independently. Risk of divergence.

**Fix:**
- Create `packages/core/src/services/ratios.ts`
- Export `computeRatios(lineItems: LineItem[]): RatioResult`
- Use this single function in both SpreadService and CovenantService

### 4. Missing Facility/Loan Product Model

**Problem:** SPEC.md describes facilities (term loans, revolvers) but no table exists.

**Fix:** Add `facilities` table:
```typescript
export const facilities = sqliteTable("facilities", {
  id: text("id").primaryKey(),
  deal_id: text("deal_id").notNull().references(() => deals.id),
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
```

Add FacilityService with CRUD + audit events.

### 5. Missing Approval Workflow

**Problem:** SPEC.md describes approval gates but no approval_requests table or workflow exists.

**Fix:** Add approval workflow:
```typescript
export const approvalRequests = sqliteTable("approval_requests", {
  id: text("id").primaryKey(),
  deal_id: text("deal_id").notNull().references(() => deals.id),
  type: text("type").notNull(), // "stage_transition" | "facility_approval" | "covenant_waiver"
  requested_by: text("requested_by").notNull(),
  requested_at: text("requested_at").notNull(),
  status: text("status").notNull().default("pending"), // "pending" | "approved" | "rejected" | "cancelled"
  decided_by: text("decided_by"),
  decided_at: text("decided_at"),
  decision_rationale: text("decision_rationale"),
  payload: text("payload", { mode: "json" }), // type-specific data
});
```

Add ApprovalService with request/approve/reject methods + audit events.

### 6. Explicit Audit Immutability Routes

**Problem:** Tests expect PATCH/DELETE on `/v1/deals/:dealId/audit/:eventId` to return 405, but routes don't exist explicitly. Currently works by accident (Hono returns 404/405 for undefined routes).

**Fix:** Explicitly define routes in `packages/api/src/routes/audit.ts`:
```typescript
// Already exists but verify:
app.patch("/deals/:dealId/audit/:eventId", (c) => {
  return c.json({
    error: {
      code: "METHOD_NOT_ALLOWED",
      message: "Audit events are immutable and cannot be modified",
      retryable: false,
    },
  }, 405);
});

app.delete("/deals/:dealId/audit/:eventId", (c) => {
  return c.json({
    error: {
      code: "METHOD_NOT_ALLOWED",
      message: "Audit events are immutable and cannot be deleted",
      retryable: false,
    },
  }, 405);
});
```

## Minor Improvements

### 7. Soft Delete Pattern

Add `deleted_at` column to deals, entities, documents:
```typescript
deleted_at: text("deleted_at"), // null = active, ISO timestamp = deleted
```

Filter queries with `WHERE deleted_at IS NULL` by default. Add `includeDeleted` option to list methods.

### 8. Stage Guards Configuration

Move hardcoded stage guards from `StageService.getChecklist()` to a config structure:
```typescript
const STAGE_GUARDS: Record<string, Array<{item: string, check: (deal: Deal, context: GuardContext) => boolean}>> = {
  origination: [
    { item: "borrower_name", check: (d) => !!d.borrower_name },
    { item: "jurisdiction", check: (d) => !!d.jurisdiction },
    // ...
  ],
  // ...
};
```

### 9. Document Injectable Clock Pattern

Add to `AGENTS.md`:
```markdown
## Time Injection

All services accept a `getNow: () => string` function for testability.

In tests:
```typescript
const fixedTime = "2024-01-15T10:00:00Z";
const { app } = await createAppWithDb(() => fixedTime);
```

In production, use `() => new Date().toISOString()`.
```

## Verification

After implementing:
1. Run `npx vitest run` — all 161 tests must pass
2. Run `npm run build` — TypeScript must compile
3. Run `npm run typecheck` — no type errors

## Done Criteria

All critical issues fixed, all tests pass. Output: `PHASE 6 COMPLETE`
