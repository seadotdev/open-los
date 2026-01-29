# Open LOS: AI-Native Architecture (Revised)

> **Status:** Draft v2 (Revised)
> **Last Updated:** 2025-01-29
> **Revision Author:** Ralph (Claude)

---

## Changelog

### v2 (2025-01-29)
- **CORRECTED**: Drizzle Cube verified as real library (v0.3.5, MIT license)
- **CORRECTED**: pg_mooncake verified but marked as experimental (not production-ready)
- **REMOVED**: Dimension tables for region/industry/product_type (over-engineering for MVP)
- **REMOVED**: Snapshot tables and daily materialization jobs (premature optimization)
- **REMOVED**: Transaction pattern detection tables (defer to Phase 3+)
- **SIMPLIFIED**: Analytics layer to build on existing services, not parallel infrastructure
- **CLARIFIED**: MCP server as thin wrapper around existing REST API
- **ALIGNED**: Schema changes to be additive, not replacing existing tables
- **ADDED**: Implementation Notes section with migration path

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [What Already Exists](#2-what-already-exists)
3. [Architectural Principles](#3-architectural-principles)
4. [MCP Server Design](#4-mcp-server-design)
5. [Analytics Layer (Simplified)](#5-analytics-layer-simplified)
6. [Schema Additions (Minimal)](#6-schema-additions-minimal)
7. [API Additions](#7-api-additions)
8. [Security & Audit Model](#8-security--audit-model)
9. [Implementation Notes](#9-implementation-notes)

---

## 1. Executive Summary

### Vision

Open LOS is a **headless lending data platform** that serves as the source of truth for B2B lending operations. It is designed to be operated equally by:

- **Humans** via a web UI
- **AI agents** via MCP (Model Context Protocol) or REST API
- **Automated systems** via webhooks and scheduled jobs

The platform does not contain AI "smarts" internally. Instead, it provides a complete, well-structured API that external AI tools can operate against.

### Key Insight

> The backend is like a **domain-aware database**. It knows what a valid stage transition is, computes ratios deterministically, enforces permissions, and logs everything. But it doesn't think—thinking happens in external AI environments that the user controls.

---

## 2. What Already Exists

**DO NOT REBUILD OR DUPLICATE THESE.**

### 2.1 Current Database Schema (`packages/core/src/schema/tables.ts`)

| Table | Purpose | Status |
|-------|---------|--------|
| `deals` | Core deal tracking with stages | ✅ Complete |
| `documents` | Document storage with versioning | ✅ Complete |
| `auditEvents` | Full audit trail | ✅ Complete |
| `stageTransitions` | Stage change history | ✅ Complete |
| `entities` | Companies and persons | ✅ Complete |
| `relationships` | Entity connections (owns, guarantees, directs) | ✅ Complete |
| `artifacts` | Frozen template outputs | ✅ Complete |
| `spreads` | Financial data with computed ratios | ✅ Complete |
| `covenants` | Covenant definitions | ✅ Complete |
| `covenantTests` | Covenant test results | ✅ Complete |
| `waivers` | Covenant waivers | ✅ Complete |
| `ingestions` | Data ingestion tracking | ✅ Complete |
| `bankTransactions` | Bank transaction data | ✅ Complete |
| `alerts` | System alerts | ✅ Complete |
| `communications` | Email/notes storage | ✅ Complete |
| `facilities` | Loan facility structures | ✅ Complete |
| `approvalRequests` | Approval workflows | ✅ Complete |
| `loanAccounts` | Mambu-compatible loan ledger | ✅ Complete |
| `loanTransactions` | Loan transaction history | ✅ Complete |
| `repaymentSchedule` | Payment schedules | ✅ Complete |

### 2.2 Current Services (`packages/core/src/services/`)

| Service | Key Methods | Status |
|---------|-------------|--------|
| `DealService` | create, getById, update, list | ✅ Complete |
| `DocumentService` | upload, get, list | ✅ Complete |
| `AuditService` | record, list | ✅ Complete |
| `StageService` | transition, getStageInfo | ✅ Complete |
| `EntityService` | create, get, list | ✅ Complete |
| `RelationshipService` | create, list | ✅ Complete |
| `SpreadService` | create, getRatios, getLatestSpread | ✅ Complete |
| `CovenantService` | create, list, test, createWaiver | ✅ Complete |
| `MonitoringService` | ingest, getStatus (includes liquidity, alerts, covenant status) | ✅ Complete |
| `FacilityService` | create, update, list | ✅ Complete |
| `LoanAccountService` | Mambu-compatible ledger | ✅ Complete |

### 2.3 Current API (`openapi/v1.yaml`)

All CRUD operations are already exposed:
- `/v1/deals/*` - Deal lifecycle
- `/v1/deals/{dealId}/documents` - Document management
- `/v1/deals/{dealId}/stage-transitions` - Stage management
- `/v1/deals/{dealId}/spread` - Financial spreads
- `/v1/deals/{dealId}/covenants/*` - Covenant management
- `/v1/deals/{dealId}/monitoring/*` - Bank data ingestion and status
- `/v1/entities/*` - Entity management
- `/v1/relationships` - Entity relationships

---

## 3. Architectural Principles

*(Unchanged from original—these are sound)*

### P1: Backend as Source of Truth
All state lives in Open LOS. AI tools read from and write to this single source.

### P2: Humans and AI Are Equal Actors
The API makes no distinction between human and AI callers beyond audit tagging.

### P3: Determinism Where It Matters
Financial computations (ratios, covenant tests, liquidity calculations) are deterministic and reproducible. AI can explain these outputs but never computes them.

### P4: Rich Context for AI Consumption
API responses include structured hints: what actions are available, what's blocking progress, what's missing.

### P5: First-Class Analytics
Analytics queries are modeled in the ORM and exposed via API. AI can answer "show me deals by region over time" by calling analytics endpoints, not by fetching all data and computing.

### P6: Audit Everything
Every mutation records who did it (human or AI), when, and what changed.

---

## 4. MCP Server Design

### 4.1 Architecture Decision

**The MCP server is a thin wrapper around the existing REST API.** It does not implement new business logic—it translates MCP protocol to REST calls.

```
┌─────────────────────────────────────────┐
│         MCP-Compatible Clients          │
│  (Claude Code, Cursor, Custom Agents)   │
└─────────────────┬───────────────────────┘
                  │ MCP Protocol (stdio/SSE)
                  ▼
┌─────────────────────────────────────────┐
│           MCP Server Layer              │
│                                         │
│  - Tool definitions (schemas)           │
│  - Protocol translation                 │
│  - Response enrichment (_context)       │
│  - Authentication passthrough           │
└─────────────────┬───────────────────────┘
                  │ HTTP/REST
                  ▼
┌─────────────────────────────────────────┐
│        Existing REST API (/v1/*)        │
│                                         │
│  - All existing endpoints unchanged     │
│  - Same validation, same services       │
└─────────────────────────────────────────┘
```

### 4.2 Tool Categories

**Note**: Each MCP tool maps 1:1 to an existing REST endpoint. No new backend logic required.

#### Deal Lifecycle Tools

| Tool | Maps To | Description |
|------|---------|-------------|
| `deal.create` | `POST /v1/deals` | Create a new deal |
| `deal.get` | `GET /v1/deals/{id}` | Get deal with context |
| `deal.update` | `PATCH /v1/deals/{id}` | Update deal fields |
| `deal.list` | `GET /v1/deals` | Search/filter deals |
| `deal.transition_stage` | `POST /v1/deals/{id}/stage-transitions` | Move to next stage |

#### Document Tools

| Tool | Maps To | Description |
|------|---------|-------------|
| `document.upload` | `POST /v1/deals/{id}/documents` | Upload document |
| `document.list` | `GET /v1/deals/{id}/documents` | List documents |
| `document.get` | `GET /v1/documents/{id}` | Get document metadata |

#### Financial Tools

| Tool | Maps To | Description |
|------|---------|-------------|
| `spread.create` | `POST /v1/deals/{id}/spread` | Create spread |
| `spread.get` | `GET /v1/deals/{id}/ratios` | Get computed ratios |
| `covenant.create` | `POST /v1/deals/{id}/covenants` | Define covenant |
| `covenant.test` | `POST /v1/deals/{id}/covenants/test` | Run covenant tests |
| `covenant.waive` | `POST /v1/covenants/{id}/waivers` | Create waiver |

#### Monitoring Tools

| Tool | Maps To | Description |
|------|---------|-------------|
| `monitoring.ingest` | `POST /v1/deals/{id}/monitoring/ingest` | Ingest bank data |
| `monitoring.status` | `GET /v1/deals/{id}/monitoring/status` | Get liquidity + alerts |

#### Analytics Tools (NEW - see Section 5)

| Tool | Maps To | Description |
|------|---------|-------------|
| `analytics.pipeline` | `GET /v1/analytics/pipeline` | Pipeline metrics |
| `analytics.portfolio` | `GET /v1/analytics/portfolio` | Portfolio breakdown |

### 4.3 Response Enrichment

The MCP server enriches responses with `_context` for AI consumption. This is **presentation logic only**—computed from the response data, not from new backend queries.

```typescript
// Example: MCP server enrichment (no backend changes needed)
function enrichDealResponse(deal: Deal): EnrichedResponse {
  const warnings: Warning[] = [];
  const actions: Action[] = [];

  // Infer available actions from current state
  if (deal.stage === "origination" && !deal.origination_outcome) {
    actions.push({
      tool: "deal.update",
      description: "Set origination outcome",
      suggested_params: { origination_outcome: "proceed" }
    });
  }

  // Infer warnings from missing data
  if (!deal.requested_amount) {
    warnings.push({
      code: "MISSING_AMOUNT",
      message: "Requested amount not set",
      severity: "warning"
    });
  }

  return {
    data: deal,
    _context: { available_actions: actions, warnings }
  };
}
```

### 4.4 MCP Server Configuration

```json
// .mcp.json
{
  "mcpServers": {
    "open-los": {
      "command": "npx",
      "args": ["tsx", "packages/mcp-server/src/index.ts"],
      "env": {
        "OPEN_LOS_API_URL": "http://localhost:3000",
        "OPEN_LOS_API_KEY": "${OPEN_LOS_API_KEY}"
      }
    }
  }
}
```

---

## 5. Analytics Layer (Simplified)

### 5.1 Design Philosophy

**Start simple. Add complexity only when proven necessary.**

The original spec proposed:
- Dimension tables (regions, industries, product_types)
- Snapshot tables (deal_snapshots, pipeline_metrics, covenant_compliance_history)
- Transaction pattern detection tables
- Drizzle Cube semantic layer
- pg_mooncake columnar storage

**For MVP, we need none of this.** The existing schema already supports basic analytics:
- Deals have `stage`, `created_at`, `updated_at`
- Spreads have `ratios` with computed metrics
- Covenant tests track pass/fail history
- Bank transactions have `category`, `date`, `amount`

### 5.2 MVP Analytics (No Schema Changes)

**Pipeline Analytics** - Query existing `deals` table:
```sql
SELECT stage, COUNT(*) as count, SUM(requested_amount) as total
FROM deals
WHERE tenant_id = ?
GROUP BY stage;
```

**Covenant Health** - Query existing `covenantTests` table:
```sql
SELECT
  status,
  COUNT(*) as count
FROM covenant_tests ct
JOIN covenants c ON ct.covenant_id = c.id
WHERE c.deal_id IN (SELECT id FROM deals WHERE tenant_id = ?)
  AND ct.tested_at = (
    SELECT MAX(tested_at) FROM covenant_tests WHERE covenant_id = ct.covenant_id
  )
GROUP BY status;
```

**Time Series** - Query existing tables with date filtering:
```sql
SELECT
  strftime('%Y-%m', created_at) as month,
  COUNT(*) as deals_created,
  SUM(requested_amount) as total_amount
FROM deals
WHERE tenant_id = ? AND created_at >= date('now', '-1 year')
GROUP BY month
ORDER BY month;
```

### 5.3 Analytics Service (NEW)

Create a single new service that builds on existing data:

```typescript
// packages/core/src/services/analytics.ts

export interface PipelineMetrics {
  by_stage: Array<{ stage: string; count: number; total_amount: number }>;
  total_deals: number;
  total_amount: number;
}

export interface CovenantHealthMetrics {
  total_covenants: number;
  passing: number;
  failing: number;
  in_grace: number;
  waived: number;
  compliance_rate: number;
}

export class AnalyticsService {
  constructor(
    private db: Database,
    private getNow: () => string
  ) {}

  async getPipelineMetrics(tenantId: string): Promise<PipelineMetrics> {
    // Query existing deals table - no new tables needed
    const rows = await this.db
      .select({
        stage: deals.stage,
        count: sql`COUNT(*)`,
        total_amount: sql`COALESCE(SUM(${deals.requested_amount}), 0)`
      })
      .from(deals)
      .where(eq(deals.tenant_id, tenantId))
      .groupBy(deals.stage);

    return {
      by_stage: rows,
      total_deals: rows.reduce((sum, r) => sum + r.count, 0),
      total_amount: rows.reduce((sum, r) => sum + r.total_amount, 0)
    };
  }

  async getCovenantHealth(tenantId: string): Promise<CovenantHealthMetrics> {
    // Query existing covenantTests + covenants tables
    // ... implementation using existing tables
  }

  async getTimeSeries(
    tenantId: string,
    options: { metric: string; granularity: string; range: string }
  ) {
    // Query existing tables with date grouping
    // ... implementation using existing tables
  }
}
```

### 5.4 When to Add Drizzle Cube

[Drizzle Cube](https://github.com/cliftonc/drizzle-cube) is a real library (v0.3.5, MIT license) that provides:
- Type-safe cube definitions from Drizzle schema
- Cube.js-compatible query format
- Multi-tenant security context
- React components for dashboards

**Add Drizzle Cube when:**
- Multiple different analytics consumers need the same metrics
- You need to expose a self-service query interface
- Dashboard complexity exceeds what simple SQL queries provide
- Query performance becomes a bottleneck (cube pre-aggregation)

**Not in MVP.**

### 5.5 When to Add Columnar Storage

[pg_mooncake](https://github.com/Mooncake-Labs/pg_mooncake) is experimental (not production-ready as of late 2025).

**Consider columnar storage when:**
- `bank_transactions` exceeds 10M rows
- `audit_events` queries consistently exceed 1 second
- You're running time-series analytics on historical snapshots

**Not in MVP. Revisit in 6-12 months.**

---

## 6. Schema Additions (Minimal)

### 6.1 What NOT to Add (Deferred)

The original spec proposed many new tables. For MVP, defer all of these:

| Proposed Table | Reason to Defer |
|---------------|-----------------|
| `dim_regions` | Over-engineering; use `jurisdiction` field on deals/entities |
| `dim_industries` | Over-engineering; add `industry` field to entities if needed |
| `dim_product_types` | Over-engineering; use `type` field on facilities |
| `dim_transaction_categories` | Defer to Phase 3 |
| `deal_snapshots` | Premature optimization; query live data |
| `pipeline_metrics` | Premature optimization; compute on demand |
| `covenant_compliance_history` | Already captured in `covenant_tests` table |
| `recurring_transactions` | Defer to Phase 3 |
| `transaction_pattern_rules` | Defer to Phase 3 |

### 6.2 Optional Additions (Phase 2)

These are small, additive changes that may improve analytics without major restructuring:

```typescript
// Add to deals table (migration, not schema rewrite)
// ALTER TABLE deals ADD COLUMN stage_entered_at TEXT;
// ALTER TABLE deals ADD COLUMN closed_at TEXT;

// Add to bank_transactions table (Phase 2)
// ALTER TABLE bank_transactions ADD COLUMN counterparty_name TEXT;
// ALTER TABLE bank_transactions ADD COLUMN is_loan_repayment INTEGER DEFAULT 0;
```

### 6.3 Index Additions (Performance)

Add indexes only after measuring actual query patterns:

```sql
-- Only add if analytics queries are slow
CREATE INDEX IF NOT EXISTS deals_stage_idx ON deals(tenant_id, stage);
CREATE INDEX IF NOT EXISTS deals_created_at_idx ON deals(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS covenant_tests_covenant_tested_idx ON covenant_tests(covenant_id, tested_at);
```

---

## 7. API Additions

### 7.1 New Analytics Endpoints

Add to `openapi/v1.yaml`:

```yaml
/v1/analytics/pipeline:
  get:
    operationId: getPipelineMetrics
    summary: Get deal pipeline metrics by stage
    tags: [analytics]
    responses:
      200:
        content:
          application/json:
            schema:
              type: object
              properties:
                by_stage:
                  type: array
                  items:
                    type: object
                    properties:
                      stage: { type: string }
                      count: { type: integer }
                      total_amount: { type: integer }
                total_deals: { type: integer }
                total_amount: { type: integer }

/v1/analytics/covenant-health:
  get:
    operationId: getCovenantHealth
    summary: Get portfolio-wide covenant compliance metrics
    tags: [analytics]
    responses:
      200:
        content:
          application/json:
            schema:
              type: object
              properties:
                total_covenants: { type: integer }
                passing: { type: integer }
                failing: { type: integer }
                in_grace: { type: integer }
                waived: { type: integer }
                compliance_rate: { type: number }
```

### 7.2 No Changes to Existing Endpoints

All existing endpoints remain unchanged. The MCP server wraps them, not replaces them.

---

## 8. Security & Audit Model

### 8.1 Actor Identification

The existing audit system already tracks actors. Extend the `actor` field to support structured AI identification:

```typescript
// Existing: actor is a string like "alice@lender.com"
// Enhanced: actor can be structured for AI

// Option A: Use prefix convention (no schema change)
const actor = "ai:claude-code:session_abc123";
const actor = "human:alice@lender.com";

// Option B: Add optional columns (Phase 2)
// ALTER TABLE audit_events ADD COLUMN actor_type TEXT; -- "human" | "ai" | "system"
// ALTER TABLE audit_events ADD COLUMN actor_session TEXT;
```

**Recommendation**: Use Option A for MVP (prefix convention). No schema changes required.

### 8.2 MCP Authentication

The MCP server authenticates via:
1. **Local (stdio)**: Inherits user's environment, uses `OPEN_LOS_API_KEY`
2. **Remote (SSE/WebSocket)**: Bearer token in connection handshake

```typescript
// MCP server auth middleware
const apiKey = process.env.OPEN_LOS_API_KEY;
const headers = { Authorization: `Bearer ${apiKey}` };

// All REST calls include auth
const response = await fetch(`${API_URL}/v1/deals`, { headers });
```

### 8.3 Permission Model

**No changes needed.** The existing API enforces permissions. The MCP server passes through authentication; it doesn't implement its own permission layer.

---

## 9. Implementation Notes

### What Already Exists (Do Not Rebuild)

- **21 database tables** covering deals, documents, entities, financials, covenants, monitoring, facilities, and loan ledger
- **15 service classes** with full CRUD operations and business logic
- **45+ API endpoints** in OpenAPI spec
- **Audit trail** capturing all mutations with actor and changes
- **Ratio computation** in SpreadService (deterministic, reproducible)
- **Covenant testing** with grace periods and waivers
- **Liquidity calculation** from bank transactions
- **Alert generation** for covenant breaches, liquidity warnings, data gaps

### New Components Required

| Component | Effort | Dependencies |
|-----------|--------|--------------|
| `AnalyticsService` | Small | Existing services |
| Analytics API endpoints (2) | Small | AnalyticsService |
| MCP Server package | Medium | Existing REST API |
| MCP tool definitions | Medium | MCP SDK |

### Migration Path

**Phase 1: Analytics Foundation (1 week)**
1. Create `packages/core/src/services/analytics.ts`
2. Add `GET /v1/analytics/pipeline` endpoint
3. Add `GET /v1/analytics/covenant-health` endpoint
4. Write tests against existing data

**Phase 2: MCP Server (2 weeks)**
1. Create `packages/mcp-server/` package
2. Implement MCP protocol handler (use `@modelcontextprotocol/sdk`)
3. Define tools that wrap existing REST endpoints
4. Add response enrichment layer (_context)
5. Test with Claude Code locally

**Phase 3: Transaction Intelligence (Future)**
1. Add counterparty extraction to bank transactions
2. Add loan repayment detection heuristics
3. Consider transaction categorization rules

**Phase 4: Advanced Analytics (Future)**
1. Evaluate Drizzle Cube if query complexity grows
2. Evaluate pg_mooncake if transaction volumes exceed 1M rows
3. Add snapshot tables only if point-in-time queries become frequent

### Open Questions

1. **MCP Transport**: Should production MCP server use stdio (local only) or SSE/WebSocket (remote capable)?
   - *Recommendation*: Start with stdio for simplicity; add SSE later if remote AI agents need access

2. **Actor Identification**: Should we add structured actor columns now or use prefix convention?
   - *Recommendation*: Prefix convention for MVP (`ai:claude-code:session_123`)

3. **Analytics Granularity**: Do we need time-series analytics in MVP, or just current state?
   - *Recommendation*: Current state only; add time-series in Phase 2 if needed

4. **Multi-tenancy in MCP**: How does the MCP server know which tenant context to use?
   - *Recommendation*: Pass tenant_id in MCP connection metadata; MCP server includes it in all REST calls

---

## Appendix: Technology Verification

### Drizzle Cube
- **Status**: Real library, production-ready
- **Version**: 0.3.5 (MIT license)
- **GitHub**: https://github.com/cliftonc/drizzle-cube
- **Docs**: https://www.drizzle-cube.dev/
- **Use case**: Deferred to future phase

### pg_mooncake
- **Status**: Experimental, not production-ready
- **Version**: 0.2.x (rewritten in Rust)
- **GitHub**: https://github.com/Mooncake-Labs/pg_mooncake
- **Limitations**: No cloud storage integration, conflicts with pg_duckdb
- **Use case**: Deferred until data volumes require columnar storage

### MCP SDK
- **Status**: Production-ready
- **Package**: `@modelcontextprotocol/sdk`
- **Docs**: https://modelcontextprotocol.io/
- **Use case**: Required for Phase 2
