# Open LOS: AI-Native Architecture

> **Status:** Draft
> **Last Updated:** 2025-01-29
> **Authors:** Architecture Review

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architectural Principles](#2-architectural-principles)
3. [System Architecture](#3-system-architecture)
4. [MCP Server Design](#4-mcp-server-design)
5. [Analytics Layer](#5-analytics-layer)
6. [Data Model for Analytics](#6-data-model-for-analytics)
7. [API Design for AI Consumption](#7-api-design-for-ai-consumption)
8. [Frontend Integration](#8-frontend-integration)
9. [Security & Audit Model](#9-security--audit-model)
10. [Implementation Roadmap](#10-implementation-roadmap)

---

## 1. Executive Summary

### Vision

Open LOS is a **headless lending data platform** that serves as the source of truth for B2B lending operations. It is designed to be operated equally by:

- **Humans** via a web UI
- **AI agents** via MCP (Model Context Protocol) or REST API
- **Automated systems** via webhooks and scheduled jobs

The platform does not contain AI "smarts" internally. Instead, it provides a complete, well-structured API that external AI tools can operate against. AI capabilities are delivered through:

- **Local sandboxes:** Claude Code, Cursor, Windsurf connecting via MCP
- **Cloud chat:** ChatGPT Actions, Claude.ai with MCP
- **Frontend AI:** Vercel AI SDK powering conversational interfaces
- **Custom agents:** Any MCP-compatible or REST client

### Key Insight

> The backend is like a **domain-aware database**. It knows what a valid stage transition is, computes ratios deterministically, enforces permissions, and logs everything. But it doesn't think—thinking happens in external AI environments that the user controls.

---

## 2. Architectural Principles

### P1: Backend as Source of Truth

All state lives in Open LOS. AI tools read from and write to this single source. There is no "AI memory" that diverges from the database.

### P2: Humans and AI Are Equal Actors

The API makes no distinction between human and AI callers beyond audit tagging. Both use the same endpoints, same permissions, same validation.

### P3: Determinism Where It Matters

Financial computations (ratios, covenant tests, liquidity calculations) are deterministic and reproducible. AI can explain these outputs but never computes them.

### P4: Rich Context for AI Consumption

API responses include structured hints: what actions are available, what's blocking progress, what's missing. This helps AI tools reason without excessive back-and-forth.

### P5: First-Class Analytics

Analytics queries are modeled in the ORM and exposed via API. AI can answer "show me deals by region over time" by calling analytics endpoints, not by fetching all data and computing.

### P6: Audit Everything

Every mutation records who did it (human or AI), when, and what changed. The audit trail is the compliance backbone.

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AI Execution Environments                            │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ Claude Code  │  │ ChatGPT      │  │ Cursor/      │  │ Web UI with     │  │
│  │ / Cowork     │  │ Actions      │  │ Windsurf     │  │ AI SDK Chat     │  │
│  │              │  │              │  │              │  │                 │  │
│  │ (local MCP)  │  │ (REST)       │  │ (MCP)        │  │ (AI SDK tools)  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └────────┬────────┘  │
└─────────┼─────────────────┼─────────────────┼──────────────────┼────────────┘
          │                 │                 │                  │
          │ MCP Protocol    │ REST/JSON       │ MCP Protocol     │ REST/JSON
          ▼                 ▼                 ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Open LOS Backend                                   │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │   REST API      │  │   MCP Server    │  │      Analytics Engine       │  │
│  │   /v1/*         │  │                 │  │                             │  │
│  │                 │  │   Tools:        │  │   - Pre-computed metrics    │  │
│  │   - CRUD ops    │  │   - deal.*      │  │   - Time-series queries     │  │
│  │   - Stage mgmt  │  │   - document.*  │  │   - Dimensional slicing     │  │
│  │   - Documents   │  │   - analytics.* │  │   - Transaction patterns    │  │
│  │   - Analytics   │  │                 │  │                             │  │
│  └────────┬────────┘  └────────┬────────┘  └──────────────┬──────────────┘  │
│           │                    │                          │                  │
│           └────────────────────┴──────────────────────────┘                  │
│                                    │                                         │
│  ┌─────────────────────────────────┴─────────────────────────────────────┐  │
│  │                         Core Domain Layer                              │  │
│  │                                                                        │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐  │  │
│  │  │ DealService │ │SpreadService│ │CovenantSvc  │ │ AnalyticsService│  │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────┘  │  │
│  │                                                                        │  │
│  │  Deterministic computations • Validation • Business rules              │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                    │                                         │
│  ┌─────────────────────────────────┴─────────────────────────────────────┐  │
│  │                           Data Layer                                   │  │
│  │                                                                        │  │
│  │  ┌─────────────────────────┐  ┌────────────────────────────────────┐  │  │
│  │  │   Operational Tables    │  │      Analytics Tables              │  │  │
│  │  │                         │  │                                    │  │  │
│  │  │   deals                 │  │   deal_snapshots (daily)           │  │  │
│  │  │   entities              │  │   pipeline_metrics                 │  │  │
│  │  │   documents             │  │   portfolio_aggregates             │  │  │
│  │  │   spreads               │  │   transaction_patterns             │  │  │
│  │  │   covenants             │  │   covenant_compliance_history      │  │  │
│  │  │   bank_transactions     │  │                                    │  │  │
│  │  │   audit_events          │  │   dimensions: regions, industries  │  │  │
│  │  └─────────────────────────┘  └────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. MCP Server Design

The MCP server exposes Open LOS as a tool provider that any MCP-compatible AI can use.

### 4.1 Tool Categories

#### Deal Lifecycle Tools

| Tool | Description | Returns |
|------|-------------|---------|
| `deal.create` | Create a new deal in broker stage | Deal with stage info |
| `deal.get` | Get full deal context | Deal + entities + docs + financials + covenants |
| `deal.update` | Update deal fields | Updated deal |
| `deal.transition_stage` | Move to next stage | Transition result or blockers |
| `deal.list` | Search/filter deals | Paginated deals |

#### Document Tools

| Tool | Description | Returns |
|------|-------------|---------|
| `document.upload` | Upload document to deal | Document metadata |
| `document.read` | Get document content | Text or base64 content |
| `document.classify` | Update doc type/labels | Updated metadata |
| `document.list` | List documents for deal | Document list with metadata |

#### Financial Tools

| Tool | Description | Returns |
|------|-------------|---------|
| `spread.create` | Create spread with line items | Spread with computed ratios |
| `spread.get` | Get spread with ratios | Full spread data |
| `covenant.create` | Define a covenant | Covenant definition |
| `covenant.test` | Run covenant tests | Test results with status |
| `covenant.waive` | Create waiver | Waiver record |

#### Monitoring Tools

| Tool | Description | Returns |
|------|-------------|---------|
| `monitoring.ingest` | Ingest bank transactions | Ingestion result |
| `monitoring.status` | Get liquidity + alerts | Full monitoring status |
| `monitoring.categorize_transactions` | Apply categories to transactions | Categorized transactions |

#### Analytics Tools

| Tool | Description | Returns |
|------|-------------|---------|
| `analytics.pipeline` | Deal pipeline metrics | Counts by stage, conversion rates |
| `analytics.portfolio` | Portfolio composition | Breakdown by dimensions |
| `analytics.time_series` | Metrics over time | Time-bucketed data |
| `analytics.transactions` | Transaction pattern analysis | Grouped/categorized transactions |
| `analytics.covenant_health` | Covenant compliance overview | Compliance rates, breaches |

### 4.2 Resource Definitions

Resources provide read-only context that AI can access:

```typescript
const resources = {
  // Deal context
  "deal://{dealId}": "Full deal with related data",
  "deal://{dealId}/documents": "Document list with metadata",
  "deal://{dealId}/financials": "Latest spread with ratios",
  "deal://{dealId}/timeline": "Audit history as timeline",

  // Entity context
  "entity://{entityId}": "Entity with relationships",
  "entity://{entityId}/group": "Full borrower group graph",

  // Portfolio context
  "portfolio://summary": "Portfolio-wide metrics",
  "portfolio://alerts": "Active alerts across portfolio",

  // Configuration
  "config://stages": "Stage machine with guards",
  "config://doc-types": "Valid document types",
  "config://regions": "Region dimension values",
  "config://industries": "Industry dimension values"
};
```

### 4.3 Tool Response Format

All tool responses follow a consistent structure:

```typescript
interface ToolResponse<T> {
  // The primary data
  data: T;

  // Contextual hints for AI
  _context: {
    // What can be done next
    available_actions: Action[];

    // What's incomplete or blocking
    warnings: Warning[];

    // Related resources to explore
    related: ResourceLink[];
  };

  // For audit correlation
  _meta: {
    request_id: string;
    timestamp: string;
    actor: ActorInfo;
  };
}

interface Action {
  tool: string;
  description: string;
  suggested_params?: Record<string, unknown>;
  reason?: string;
}

interface Warning {
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
  resolution?: string;
}
```

**Example Response:**

```json
{
  "data": {
    "id": "deal_abc123",
    "stage": "origination",
    "borrower_name": "Acme Ltd",
    "requested_amount": 500000
  },
  "_context": {
    "available_actions": [
      {
        "tool": "deal.transition_stage",
        "description": "Move to underwriting",
        "suggested_params": { "toStage": "underwriting" },
        "reason": "All origination requirements met"
      },
      {
        "tool": "document.upload",
        "description": "Upload management accounts",
        "suggested_params": { "docType": "management_accounts" },
        "reason": "Recommended for underwriting"
      }
    ],
    "warnings": [
      {
        "code": "MISSING_GUARANTOR",
        "message": "No personal guarantor linked",
        "severity": "info",
        "resolution": "Consider adding guarantor via entity.create + relationship.create"
      }
    ],
    "related": [
      { "resource": "deal://deal_abc123/documents", "description": "View documents" },
      { "resource": "entity://entity_xyz/group", "description": "View borrower group" }
    ]
  },
  "_meta": {
    "request_id": "req_789",
    "timestamp": "2025-01-29T10:30:00Z",
    "actor": { "id": "claude-code", "type": "ai" }
  }
}
```

---

## 5. Analytics Layer

### 5.1 Design Philosophy

Analytics in Open LOS are **first-class citizens**, not afterthoughts. This means:

1. **Semantic layer via Drizzle Cube**: Business metrics defined as cubes with measures and dimensions
2. **Pre-computed where needed**: Expensive aggregations are materialized in snapshot tables
3. **Exposed via API and MCP**: AI queries using Cube.js JSON format
4. **Dimensionally structured**: Proper dimension tables for slicing
5. **Columnar storage ready**: pg_mooncake can be added for large-scale transaction analytics

### 5.2 Technology Choices

| Layer | Technology | Purpose |
|-------|------------|---------|
| Semantic | [Drizzle Cube](https://www.drizzle-cube.dev/) | Define cubes, measures, dimensions; multi-tenant security |
| Storage (default) | Drizzle ORM + SQLite/Postgres | Operational data with proper indexes |
| Storage (scale) | [pg_mooncake](https://github.com/Mooncake-Labs/pg_mooncake) | Columnstore for transaction-heavy tables |
| Visualization | Drizzle Cube React components | Embeddable dashboards |

**Why Drizzle Cube:**
- Zero infrastructure - runs in the Node.js API process
- Multi-tenant security context built-in
- Type-safe from Drizzle schema
- Cube.js-compatible query format (AI-friendly)
- React components for frontend dashboards

**When to add pg_mooncake:**
- Bank transaction tables exceed 1M rows
- Audit event queries become slow
- Time-series analytics on deal snapshots need acceleration

### 5.3 Cube Definitions

Cubes are defined in TypeScript, deriving type safety from the Drizzle schema:

```typescript
// packages/core/src/analytics/cubes/deals.ts
import { defineCube } from 'drizzle-cube';
import { deals, regions, industries } from '../../schema/tables';

export const dealsCube = defineCube('Deals', {
  title: 'Deal Pipeline',

  // SQL definition with multi-tenant security
  sql: (ctx) => ({
    from: deals,
    joins: [
      { table: regions, on: eq(deals.region_id, regions.id) },
      { table: industries, on: eq(deals.industry_id, industries.id) }
    ],
    where: eq(deals.tenant_id, ctx.security.tenantId) // CRITICAL: tenant isolation
  }),

  // Dimensions: categorical fields for grouping/filtering
  dimensions: {
    id: { sql: deals.id, type: 'string', primaryKey: true },
    stage: { sql: deals.stage, type: 'string', title: 'Deal Stage' },
    regionCode: { sql: deals.region_code, type: 'string', title: 'Region' },
    regionName: { sql: regions.name, type: 'string', title: 'Region Name' },
    industryCode: { sql: deals.industry_code, type: 'string', title: 'Industry' },
    industryName: { sql: industries.name, type: 'string', title: 'Industry Name' },
    productType: { sql: deals.product_type_code, type: 'string', title: 'Product' },
    createdAt: { sql: deals.created_at, type: 'time', title: 'Created' },
    closedAt: { sql: deals.closed_at, type: 'time', title: 'Closed' }
  },

  // Measures: aggregatable metrics
  measures: {
    count: { type: 'count', title: 'Deal Count' },
    totalAmount: {
      type: 'sum',
      sql: deals.requested_amount,
      title: 'Total Amount',
      format: 'currency'
    },
    avgAmount: {
      type: 'avg',
      sql: deals.requested_amount,
      title: 'Average Deal Size',
      format: 'currency'
    },
    avgDaysToClose: {
      type: 'avg',
      sql: sql`JULIANDAY(${deals.closed_at}) - JULIANDAY(${deals.created_at})`,
      title: 'Avg Days to Close',
      filters: [{ dimension: 'stage', operator: 'equals', values: ['monitoring'] }]
    }
  }
});

// Transaction analytics cube
export const transactionsCube = defineCube('Transactions', {
  title: 'Bank Transactions',

  sql: (ctx) => ({
    from: bankTransactions,
    joins: [
      { table: deals, on: eq(bankTransactions.deal_id, deals.id) },
      { table: transactionCategories, on: eq(bankTransactions.category_id, transactionCategories.id) }
    ],
    where: eq(deals.tenant_id, ctx.security.tenantId)
  }),

  dimensions: {
    date: { sql: bankTransactions.date, type: 'time', title: 'Transaction Date' },
    categoryCode: { sql: bankTransactions.category_code, type: 'string', title: 'Category' },
    categoryName: { sql: transactionCategories.name, type: 'string', title: 'Category Name' },
    counterparty: { sql: bankTransactions.counterparty_name, type: 'string', title: 'Counterparty' },
    isLoanRepayment: { sql: bankTransactions.is_loan_repayment, type: 'boolean', title: 'Loan Repayment' },
    dealId: { sql: bankTransactions.deal_id, type: 'string', title: 'Deal' }
  },

  measures: {
    count: { type: 'count', title: 'Transaction Count' },
    totalAmount: { type: 'sum', sql: bankTransactions.amount, title: 'Total Amount' },
    totalInflows: {
      type: 'sum',
      sql: bankTransactions.amount,
      filters: [{ sql: sql`${bankTransactions.amount} > 0` }],
      title: 'Total Inflows'
    },
    totalOutflows: {
      type: 'sum',
      sql: sql`ABS(${bankTransactions.amount})`,
      filters: [{ sql: sql`${bankTransactions.amount} < 0` }],
      title: 'Total Outflows'
    },
    avgTransactionSize: { type: 'avg', sql: sql`ABS(${bankTransactions.amount})`, title: 'Avg Size' }
  }
});

// Covenant health cube
export const covenantsCube = defineCube('Covenants', {
  title: 'Covenant Compliance',

  sql: (ctx) => ({
    from: covenantTests,
    joins: [
      { table: covenants, on: eq(covenantTests.covenant_id, covenants.id) },
      { table: deals, on: eq(covenants.deal_id, deals.id) }
    ],
    where: eq(deals.tenant_id, ctx.security.tenantId)
  }),

  dimensions: {
    testedAt: { sql: covenantTests.tested_at, type: 'time', title: 'Test Date' },
    status: { sql: covenantTests.status, type: 'string', title: 'Status' },
    covenantName: { sql: covenants.name, type: 'string', title: 'Covenant' },
    covenantType: { sql: covenants.type, type: 'string', title: 'Type' },
    metric: { sql: covenants.metric, type: 'string', title: 'Metric' },
    dealId: { sql: deals.id, type: 'string', title: 'Deal' }
  },

  measures: {
    testCount: { type: 'count', title: 'Tests Run' },
    passCount: {
      type: 'count',
      filters: [{ dimension: 'status', operator: 'equals', values: ['pass'] }],
      title: 'Passed'
    },
    failCount: {
      type: 'count',
      filters: [{ dimension: 'status', operator: 'equals', values: ['fail'] }],
      title: 'Failed'
    },
    complianceRate: {
      type: 'number',
      sql: sql`100.0 * COUNT(CASE WHEN ${covenantTests.status} = 'pass' THEN 1 END) / COUNT(*)`,
      title: 'Compliance Rate %'
    }
  }
});
```

### 5.4 Analytics Categories

#### Pipeline Analytics

*"How are deals flowing through the system?"*

- Deals by stage (current snapshot)
- Stage conversion rates (broker → origination → underwriting → closing)
- Time in stage (average, percentiles)
- Stage velocity trends over time
- Rejection/approval rates by stage

#### Portfolio Analytics

*"What does our portfolio look like?"*

- Exposure by region, industry, product type
- Size distribution (requested amounts, approved amounts)
- Concentration analysis (top borrowers, industries)
- Vintage analysis (deals by origination month/quarter)

#### Financial Analytics

*"How healthy are our borrowers?"*

- Ratio distributions across portfolio (DSCR, leverage, margins)
- Covenant compliance rates
- Liquidity runway distributions
- Financial trend analysis (YoY comparisons)

#### Transaction Analytics

*"What patterns exist in bank data?"*

- Transaction categorization (revenue, expenses, loan repayments, intercompany)
- Cash flow patterns by borrower
- Anomaly detection (unusual transactions, missing data)
- Seasonality analysis

#### Operational Analytics

*"How efficient is our process?"*

- Document completeness by stage
- Time to decision
- Touch count per deal
- AI vs human action ratios

### 5.5 Query Patterns

Analytics queries follow a consistent pattern:

```typescript
interface AnalyticsQuery {
  // What to measure
  metrics: MetricSpec[];

  // How to slice
  dimensions?: DimensionSpec[];

  // How to filter
  filters?: FilterSpec[];

  // Time range
  timeRange?: {
    start: string;
    end: string;
    granularity?: "day" | "week" | "month" | "quarter" | "year";
  };

  // Result options
  limit?: number;
  orderBy?: OrderSpec;
}

// Example: Deals by region over time
{
  "metrics": [
    { "name": "deal_count", "aggregation": "count" },
    { "name": "total_amount", "aggregation": "sum", "field": "requested_amount" }
  ],
  "dimensions": [
    { "name": "region" },
    { "name": "time", "granularity": "month" }
  ],
  "filters": [
    { "field": "stage", "operator": "in", "values": ["closing", "monitoring"] }
  ],
  "timeRange": {
    "start": "2024-01-01",
    "end": "2024-12-31",
    "granularity": "month"
  }
}
```

---

## 6. Data Model for Analytics

### 6.1 Dimension Tables

Dimensions are the "slicing" axes for analytics. They are first-class entities with proper foreign keys.

```typescript
// packages/core/src/schema/dimensions.ts

export const regions = sqliteTable("dim_regions", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),        // "uk", "eu", "us"
  name: text("name").notNull(),                  // "United Kingdom"
  parent_id: text("parent_id"),                  // For hierarchies: "europe" → "uk"
  metadata: text("metadata", { mode: "json" }), // Additional attributes
});

export const industries = sqliteTable("dim_industries", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),        // "sic_6201"
  name: text("name").notNull(),                  // "Computer programming"
  sector: text("sector"),                        // "Technology"
  parent_id: text("parent_id"),                  // For hierarchies
  risk_tier: text("risk_tier"),                  // "low", "medium", "high"
});

export const productTypes = sqliteTable("dim_product_types", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),        // "term_loan", "rcf", "invoice_finance"
  name: text("name").notNull(),
  category: text("category"),                    // "debt", "equity", "hybrid"
});

export const transactionCategories = sqliteTable("dim_transaction_categories", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  parent_id: text("parent_id"),

  // Classification hints
  keywords: text("keywords", { mode: "json" }),  // ["loan", "repayment", "interest"]
  amount_patterns: text("amount_patterns", { mode: "json" }), // For rule-based matching

  // Analytics grouping
  cash_flow_type: text("cash_flow_type"),       // "operating", "investing", "financing"
  is_recurring: integer("is_recurring", { mode: "boolean" }),
});
```

### 6.2 Enhanced Operational Tables

Add dimension foreign keys to operational tables:

```typescript
// Deals table with dimension links
export const deals = sqliteTable("deals", {
  id: text("id").primaryKey(),
  tenant_id: text("tenant_id").notNull(),

  // Existing fields...
  borrower_name: text("borrower_name").notNull(),
  requested_amount: integer("requested_amount"),
  stage: text("stage").notNull().default("broker"),

  // Dimension links (nullable - can be enriched later)
  region_id: text("region_id").references(() => regions.id),
  industry_id: text("industry_id").references(() => industries.id),
  product_type_id: text("product_type_id").references(() => productTypes.id),

  // Denormalized for query performance
  region_code: text("region_code"),
  industry_code: text("industry_code"),
  product_type_code: text("product_type_code"),

  // Timestamps for time-series
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
  stage_entered_at: text("stage_entered_at"),
  closed_at: text("closed_at"),
});

// Bank transactions with categorization
export const bankTransactions = sqliteTable("bank_transactions", {
  id: text("id").primaryKey(),
  deal_id: text("deal_id").references(() => deals.id),
  ingestion_id: text("ingestion_id"),

  // Core fields
  date: text("date").notNull(),
  amount: integer("amount").notNull(),
  description: text("description"),

  // Categorization
  category_id: text("category_id").references(() => transactionCategories.id),
  category_code: text("category_code"),
  category_confidence: real("category_confidence"),  // 0-1, for ML categorization
  category_source: text("category_source"),          // "rule", "ml", "manual"

  // Pattern detection
  counterparty_name: text("counterparty_name"),      // Extracted/normalized
  counterparty_entity_id: text("counterparty_entity_id").references(() => entities.id),
  is_recurring: integer("is_recurring", { mode: "boolean" }),
  recurrence_pattern: text("recurrence_pattern"),    // "monthly", "weekly", etc.

  // For loan repayment detection
  is_loan_repayment: integer("is_loan_repayment", { mode: "boolean" }),
  loan_repayment_type: text("loan_repayment_type"),  // "principal", "interest", "fee"

  created_at: text("created_at").notNull(),
});

// Entity with dimension links
export const entities = sqliteTable("entities", {
  id: text("id").primaryKey(),
  tenant_id: text("tenant_id").notNull(),

  // Existing fields...
  name: text("name").notNull(),
  type: text("type").notNull(),
  registration_number: text("registration_number"),
  jurisdiction: text("jurisdiction"),

  // Dimension links
  region_id: text("region_id").references(() => regions.id),
  industry_id: text("industry_id").references(() => industries.id),

  // Denormalized
  region_code: text("region_code"),
  industry_code: text("industry_code"),

  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
});
```

### 6.3 Snapshot Tables

For point-in-time analytics and trend analysis:

```typescript
// Daily deal snapshots for time-series analysis
export const dealSnapshots = sqliteTable("deal_snapshots", {
  id: text("id").primaryKey(),
  snapshot_date: text("snapshot_date").notNull(),  // "2025-01-29"
  deal_id: text("deal_id").notNull().references(() => deals.id),

  // State at snapshot time
  stage: text("stage").notNull(),
  requested_amount: integer("requested_amount"),

  // Dimensions at snapshot time
  region_code: text("region_code"),
  industry_code: text("industry_code"),
  product_type_code: text("product_type_code"),

  // Computed metrics at snapshot time
  days_in_stage: integer("days_in_stage"),
  days_since_created: integer("days_since_created"),
  document_count: integer("document_count"),
  spread_count: integer("spread_count"),

  // Financial health at snapshot time (if spread exists)
  latest_dscr: real("latest_dscr"),
  latest_leverage: real("latest_leverage"),
  latest_runway_months: real("latest_runway_months"),

  // Covenant status at snapshot time
  covenants_total: integer("covenants_total"),
  covenants_passing: integer("covenants_passing"),
  covenants_breached: integer("covenants_breached"),
  covenants_in_grace: integer("covenants_in_grace"),

  created_at: text("created_at").notNull(),
}, (table) => ({
  dateIdx: index("deal_snapshots_date_idx").on(table.snapshot_date),
  dealDateIdx: index("deal_snapshots_deal_date_idx").on(table.deal_id, table.snapshot_date),
}));

// Aggregated pipeline metrics (materialized daily)
export const pipelineMetrics = sqliteTable("pipeline_metrics", {
  id: text("id").primaryKey(),
  snapshot_date: text("snapshot_date").notNull(),
  tenant_id: text("tenant_id").notNull(),

  // Dimension (what we're grouping by)
  dimension_type: text("dimension_type").notNull(),  // "stage", "region", "industry", "product_type"
  dimension_value: text("dimension_value").notNull(),

  // Metrics
  deal_count: integer("deal_count").notNull(),
  total_amount: integer("total_amount"),
  avg_amount: integer("avg_amount"),

  // For stage metrics
  avg_days_in_stage: real("avg_days_in_stage"),
  deals_entered: integer("deals_entered"),     // Entered this stage today
  deals_exited: integer("deals_exited"),       // Left this stage today

  created_at: text("created_at").notNull(),
}, (table) => ({
  dateIdx: index("pipeline_metrics_date_idx").on(table.snapshot_date),
  dimIdx: index("pipeline_metrics_dim_idx").on(table.dimension_type, table.dimension_value),
}));

// Covenant compliance history
export const covenantComplianceHistory = sqliteTable("covenant_compliance_history", {
  id: text("id").primaryKey(),
  snapshot_date: text("snapshot_date").notNull(),
  tenant_id: text("tenant_id").notNull(),

  // Optionally group by dimension
  dimension_type: text("dimension_type"),  // null for portfolio-wide
  dimension_value: text("dimension_value"),

  // Metrics
  total_covenants: integer("total_covenants").notNull(),
  passing: integer("passing").notNull(),
  failing: integer("failing").notNull(),
  in_grace_period: integer("in_grace_period").notNull(),
  waived: integer("waived").notNull(),

  compliance_rate: real("compliance_rate"),  // passing / total

  created_at: text("created_at").notNull(),
});
```

### 6.4 Transaction Pattern Tables

For loan repayment detection and cash flow analysis:

```typescript
// Detected recurring transactions
export const recurringTransactions = sqliteTable("recurring_transactions", {
  id: text("id").primaryKey(),
  deal_id: text("deal_id").notNull().references(() => deals.id),

  // Pattern info
  counterparty_name: text("counterparty_name"),
  category_id: text("category_id").references(() => transactionCategories.id),

  // Recurrence pattern
  frequency: text("frequency").notNull(),  // "weekly", "monthly", "quarterly"
  expected_day: integer("expected_day"),    // Day of month/week
  expected_amount: integer("expected_amount"),
  amount_variance: real("amount_variance"), // Allowed variance

  // Match statistics
  matched_transaction_count: integer("matched_transaction_count"),
  last_matched_date: text("last_matched_date"),
  next_expected_date: text("next_expected_date"),

  // For loan repayment tracking
  is_loan_repayment: integer("is_loan_repayment", { mode: "boolean" }),
  loan_details: text("loan_details", { mode: "json" }),  // { lender, original_amount, etc. }

  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
});

// Transaction pattern rules (for categorization)
export const transactionPatternRules = sqliteTable("transaction_pattern_rules", {
  id: text("id").primaryKey(),
  tenant_id: text("tenant_id").notNull(),

  // Rule definition
  name: text("name").notNull(),
  priority: integer("priority").notNull().default(0),

  // Match criteria
  description_pattern: text("description_pattern"),     // Regex or keywords
  amount_min: integer("amount_min"),
  amount_max: integer("amount_max"),
  counterparty_pattern: text("counterparty_pattern"),

  // Output
  category_id: text("category_id").references(() => transactionCategories.id),
  is_loan_repayment: integer("is_loan_repayment", { mode: "boolean" }),

  // Metadata
  is_active: integer("is_active", { mode: "boolean" }).default(true),
  created_at: text("created_at").notNull(),
});
```

### 6.5 Indexes for Analytics

Critical indexes for analytics query performance:

```typescript
// In schema definition, add indexes:

// Deal analytics
index("deals_stage_idx").on(deals.stage),
index("deals_region_idx").on(deals.region_code),
index("deals_industry_idx").on(deals.industry_code),
index("deals_created_at_idx").on(deals.created_at),
index("deals_tenant_stage_idx").on(deals.tenant_id, deals.stage),

// Transaction analytics
index("bank_txn_deal_date_idx").on(bankTransactions.deal_id, bankTransactions.date),
index("bank_txn_category_idx").on(bankTransactions.category_code),
index("bank_txn_counterparty_idx").on(bankTransactions.counterparty_name),
index("bank_txn_loan_repayment_idx").on(bankTransactions.is_loan_repayment),

// Snapshot analytics
index("deal_snapshots_date_stage_idx").on(dealSnapshots.snapshot_date, dealSnapshots.stage),
index("deal_snapshots_date_region_idx").on(dealSnapshots.snapshot_date, dealSnapshots.region_code),
```

---

## 7. API Design for AI Consumption

### 7.1 Analytics Endpoints

```yaml
# REST API endpoints for analytics

/v1/analytics/pipeline:
  get:
    summary: Get pipeline metrics
    parameters:
      - name: group_by
        in: query
        schema:
          type: string
          enum: [stage, region, industry, product_type]
      - name: time_range
        in: query
        schema:
          type: string
          enum: [7d, 30d, 90d, 1y, all]
      - name: granularity
        in: query
        schema:
          type: string
          enum: [day, week, month, quarter]
    responses:
      200:
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: array
                  items:
                    type: object
                    properties:
                      period: { type: string }
                      dimension: { type: string }
                      deal_count: { type: integer }
                      total_amount: { type: integer }
                      avg_days_in_stage: { type: number }

/v1/analytics/portfolio:
  get:
    summary: Get portfolio composition
    parameters:
      - name: group_by
        in: query
        required: true
        schema:
          type: string
          enum: [region, industry, product_type, stage]
      - name: metric
        in: query
        schema:
          type: string
          enum: [count, amount, avg_amount]
          default: count

/v1/analytics/transactions:
  post:
    summary: Analyze transaction patterns
    requestBody:
      content:
        application/json:
          schema:
            type: object
            properties:
              deal_ids:
                type: array
                items: { type: string }
              entity_ids:
                type: array
                items: { type: string }
              group_by:
                type: string
                enum: [category, counterparty, month, entity]
              filters:
                type: object
                properties:
                  category_codes: { type: array, items: { type: string } }
                  is_loan_repayment: { type: boolean }
                  amount_min: { type: integer }
                  amount_max: { type: integer }
                  date_from: { type: string }
                  date_to: { type: string }

/v1/analytics/covenant-health:
  get:
    summary: Get covenant compliance across portfolio
    parameters:
      - name: group_by
        in: query
        schema:
          type: string
          enum: [deal, region, industry, covenant_type]
      - name: time_range
        in: query
        schema:
          type: string

/v1/analytics/time-series:
  post:
    summary: Flexible time-series query
    requestBody:
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/AnalyticsQuery"
```

### 7.2 MCP Analytics Tools

```typescript
const analyticsTools = {
  "analytics.pipeline": {
    description: `Get deal pipeline metrics.
      Use this to answer questions like:
      - "How many deals are in each stage?"
      - "What's our conversion rate from origination to underwriting?"
      - "Show me deals by region over the last quarter"`,
    inputSchema: {
      type: "object",
      properties: {
        groupBy: {
          type: "string",
          enum: ["stage", "region", "industry", "product_type"],
          description: "How to group the results"
        },
        timeRange: {
          type: "string",
          enum: ["7d", "30d", "90d", "1y", "all"],
          description: "Time period to analyze"
        },
        granularity: {
          type: "string",
          enum: ["day", "week", "month", "quarter"],
          description: "Time granularity for trending"
        }
      }
    }
  },

  "analytics.transactions": {
    description: `Analyze bank transaction patterns.
      Use this to answer questions like:
      - "Show me transactions that look like loan repayments"
      - "Group transactions by category for Acme Ltd"
      - "What are the largest outflows this month?"`,
    inputSchema: {
      type: "object",
      properties: {
        dealIds: { type: "array", items: { type: "string" } },
        entityIds: { type: "array", items: { type: "string" } },
        groupBy: {
          type: "string",
          enum: ["category", "counterparty", "month", "entity"]
        },
        filters: {
          type: "object",
          properties: {
            isLoanRepayment: { type: "boolean" },
            categoryCodes: { type: "array", items: { type: "string" } },
            amountMin: { type: "integer" },
            amountMax: { type: "integer" },
            dateFrom: { type: "string" },
            dateTo: { type: "string" }
          }
        }
      }
    }
  },

  "analytics.custom_query": {
    description: `Run a flexible analytics query with custom metrics and dimensions.
      Use this for complex questions that don't fit other analytics tools.`,
    inputSchema: {
      type: "object",
      properties: {
        metrics: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              aggregation: { type: "string", enum: ["count", "sum", "avg", "min", "max"] },
              field: { type: "string" }
            }
          }
        },
        dimensions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              granularity: { type: "string" }
            }
          }
        },
        filters: { type: "array" },
        timeRange: { type: "object" }
      }
    }
  }
};
```

### 7.3 Example AI Interactions

**User:** "Show me deals by region over the last year"

**AI calls:** `analytics.pipeline({ groupBy: "region", timeRange: "1y", granularity: "month" })`

**Response:**
```json
{
  "data": [
    { "period": "2024-01", "dimension": "uk", "deal_count": 12, "total_amount": 5400000 },
    { "period": "2024-01", "dimension": "eu", "deal_count": 8, "total_amount": 3200000 },
    { "period": "2024-02", "dimension": "uk", "deal_count": 15, "total_amount": 7100000 }
  ],
  "_context": {
    "available_actions": [
      { "tool": "analytics.pipeline", "description": "Drill into specific region", "suggested_params": { "filters": { "region": "uk" } } }
    ],
    "summary": {
      "total_deals": 245,
      "total_amount": 112000000,
      "top_region": "uk",
      "trend": "up_15_pct"
    }
  }
}
```

---

**User:** "Find bank transactions that look like loan repayments for Acme Ltd"

**AI calls:**
1. `entity.search({ name: "Acme" })` → Gets entity_id
2. `analytics.transactions({ entityIds: ["entity_xyz"], filters: { isLoanRepayment: true }, groupBy: "counterparty" })`

**Response:**
```json
{
  "data": {
    "groups": [
      {
        "counterparty": "HSBC LOAN ACCOUNT",
        "transaction_count": 12,
        "total_amount": -240000,
        "avg_amount": -20000,
        "frequency": "monthly",
        "transactions": [
          { "date": "2024-12-01", "amount": -20000, "description": "HSBC LOAN 12345 REPAYMENT" },
          { "date": "2024-11-01", "amount": -20000, "description": "HSBC LOAN 12345 REPAYMENT" }
        ]
      },
      {
        "counterparty": "BARCLAYS BUSINESS",
        "transaction_count": 4,
        "total_amount": -48000,
        "avg_amount": -12000,
        "frequency": "quarterly",
        "transactions": [...]
      }
    ]
  },
  "_context": {
    "warnings": [
      {
        "code": "UNCONFIRMED_LOAN",
        "message": "These appear to be loan repayments but haven't been confirmed",
        "resolution": "Use monitoring.categorize_transactions to confirm"
      }
    ]
  }
}
```

---

## 8. Frontend Integration

### 8.1 AI SDK Integration

The frontend uses Vercel AI SDK to provide conversational access to the backend:

```typescript
// app/api/chat/route.ts
import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { createOpenLOSTools } from '@/lib/open-los-tools';

export async function POST(req: Request) {
  const { messages, context } = await req.json();

  const tools = createOpenLOSTools({
    apiUrl: process.env.OPEN_LOS_API_URL,
    actor: context.userId,
    actorType: 'ai',
    tenantId: context.tenantId
  });

  const result = await streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: `You are an assistant for a B2B lending platform.
             You have access to tools for managing deals, documents, financials, and analytics.
             Always cite specific data when making claims.
             Ask for confirmation before making changes to deals.`,
    messages,
    tools,
    maxSteps: 10,
  });

  return result.toDataStreamResponse();
}
```

### 8.2 Tool Definitions for AI SDK

```typescript
// lib/open-los-tools.ts
import { tool } from 'ai';
import { z } from 'zod';
import { OpenLOSClient } from './open-los-client';

export function createOpenLOSTools(config: OpenLOSConfig) {
  const client = new OpenLOSClient(config);

  return {
    // Deal tools
    getDeal: tool({
      description: 'Get full context for a deal including documents, financials, and covenants',
      parameters: z.object({ dealId: z.string() }),
      execute: async ({ dealId }) => client.deals.get(dealId)
    }),

    searchDeals: tool({
      description: 'Search for deals by borrower name, stage, or other criteria',
      parameters: z.object({
        query: z.string().optional(),
        stage: z.string().optional(),
        region: z.string().optional(),
        limit: z.number().optional()
      }),
      execute: async (params) => client.deals.search(params)
    }),

    // Analytics tools
    getPipelineMetrics: tool({
      description: 'Get deal pipeline metrics grouped by stage, region, industry, or product type',
      parameters: z.object({
        groupBy: z.enum(['stage', 'region', 'industry', 'product_type']),
        timeRange: z.enum(['7d', '30d', '90d', '1y', 'all']).optional(),
        granularity: z.enum(['day', 'week', 'month', 'quarter']).optional()
      }),
      execute: async (params) => client.analytics.pipeline(params)
    }),

    analyzeTransactions: tool({
      description: 'Analyze bank transactions for patterns, loan repayments, or anomalies',
      parameters: z.object({
        dealIds: z.array(z.string()).optional(),
        entityIds: z.array(z.string()).optional(),
        groupBy: z.enum(['category', 'counterparty', 'month', 'entity']).optional(),
        filters: z.object({
          isLoanRepayment: z.boolean().optional(),
          categoryCodes: z.array(z.string()).optional(),
          amountMin: z.number().optional(),
          amountMax: z.number().optional()
        }).optional()
      }),
      execute: async (params) => client.analytics.transactions(params)
    }),

    // Mutation tools (require confirmation in UI)
    transitionStage: tool({
      description: 'Move a deal to the next stage',
      parameters: z.object({
        dealId: z.string(),
        toStage: z.string(),
        rationale: z.string()
      }),
      execute: async (params) => client.deals.transitionStage(params)
    }),

    createSpread: tool({
      description: 'Create a financial spread with line items',
      parameters: z.object({
        dealId: z.string(),
        period: z.string(),
        lineItems: z.array(z.object({
          category: z.string(),
          label: z.string(),
          amount: z.number()
        }))
      }),
      execute: async (params) => client.spreads.create(params)
    })
  };
}
```

---

## 9. Security & Audit Model

### 9.1 Actor Identification

Every request identifies the actor:

```typescript
interface ActorContext {
  id: string;           // "alice@lender.com" or "claude-code-session-xyz"
  type: "human" | "ai" | "system";

  // For AI actors
  aiProvider?: string;  // "anthropic", "openai", "local"
  aiModel?: string;     // "claude-sonnet-4-20250514"
  sessionId?: string;   // For tracing AI conversations

  // For all actors
  tenantId: string;
  roles: string[];      // ["analyst", "underwriter"]
}

// Extracted from headers
// X-Actor: alice@lender.com
// X-Actor-Type: human
// X-Tenant-Id: tenant_123
// X-Actor-Roles: analyst,underwriter

// Or for AI:
// X-Actor: claude-code
// X-Actor-Type: ai
// X-Actor-AI-Provider: anthropic
// X-Actor-Session: session_abc123
```

### 9.2 Audit Trail

All mutations are audited with full actor context:

```typescript
interface AuditEvent {
  id: string;
  tenant_id: string;
  deal_id: string | null;

  // What happened
  type: string;              // "DEAL_CREATED", "STAGE_TRANSITION", etc.
  object_type: string;       // "deal", "document", "spread"
  object_id: string;

  // Who did it
  actor_id: string;
  actor_type: "human" | "ai" | "system";
  actor_ai_provider?: string;
  actor_ai_model?: string;
  actor_session_id?: string;

  // Change details
  changes?: {
    field: string;
    before: unknown;
    after: unknown;
  }[];
  metadata?: Record<string, unknown>;

  // Ordering
  seq: number;
  timestamp: string;
}
```

### 9.3 Permission Model

Permissions are role-based and apply equally to humans and AI:

```yaml
# config/permissions.yaml
roles:
  analyst:
    deal:
      - read
      - update:fields:[borrower_name, purpose, custom_fields]
    document:
      - read
      - upload
    spread:
      - read
      - create
    analytics:
      - read

  underwriter:
    deal:
      - read
      - update
      - transition:to:[underwriting, closing]
    covenant:
      - read
      - create
      - test

  credit_lead:
    deal:
      - read
      - update
      - transition:*
      - override
    covenant:
      - read
      - create
      - test
      - waive
```

---

## 10. Implementation Roadmap

### Phase 1: Analytics Foundation (Current + 2 weeks)

- [ ] Add dimension tables (regions, industries, product_types)
- [ ] Add dimension foreign keys to deals, entities
- [ ] Add transaction categorization fields
- [ ] Create deal_snapshots table and daily snapshot job
- [ ] Implement basic analytics endpoints (pipeline, portfolio)
- [ ] Add analytics indexes

### Phase 2: MCP Server (2-3 weeks)

- [ ] Create `packages/mcp-server/` package
- [ ] Implement core MCP protocol handler
- [ ] Expose deal lifecycle tools
- [ ] Expose document tools
- [ ] Expose analytics tools
- [ ] Add MCP resources for context
- [ ] Test with Claude Code locally

### Phase 3: Transaction Intelligence (2 weeks)

- [ ] Implement transaction categorization rules engine
- [ ] Add loan repayment detection heuristics
- [ ] Create recurring transaction detection
- [ ] Implement transaction analytics endpoints
- [ ] Add counterparty normalization

### Phase 4: Frontend AI Integration (2-3 weeks)

- [ ] Set up AI SDK in frontend
- [ ] Create tool definitions
- [ ] Implement chat interface
- [ ] Add confirmation flows for mutations
- [ ] Implement streaming responses

### Phase 5: Advanced Analytics (Ongoing)

- [ ] Covenant compliance trending
- [ ] Predictive breach probability
- [ ] Portfolio concentration analysis
- [ ] Cohort/vintage analysis
- [ ] Custom report builder

---

## Appendix A: Analytics Query Examples

### A.1 Deals by Region Over Time

```sql
-- Raw SQL equivalent of analytics.pipeline({ groupBy: "region", timeRange: "1y", granularity: "month" })
SELECT
  strftime('%Y-%m', snapshot_date) as period,
  region_code as dimension,
  COUNT(DISTINCT deal_id) as deal_count,
  SUM(requested_amount) as total_amount
FROM deal_snapshots
WHERE snapshot_date >= date('now', '-1 year')
GROUP BY period, dimension
ORDER BY period, dimension;
```

### A.2 Transaction Pattern Detection

```sql
-- Find recurring transactions that might be loan repayments
SELECT
  counterparty_name,
  COUNT(*) as txn_count,
  AVG(amount) as avg_amount,
  STDDEV(amount) as amount_stddev,
  MIN(date) as first_seen,
  MAX(date) as last_seen,
  CASE
    WHEN COUNT(*) >= 3 AND STDDEV(amount) / AVG(amount) < 0.05 THEN 'likely_recurring'
    ELSE 'irregular'
  END as pattern_type
FROM bank_transactions
WHERE amount < 0  -- Outflows only
  AND deal_id = ?
GROUP BY counterparty_name
HAVING COUNT(*) >= 2
ORDER BY txn_count DESC;
```

### A.3 Covenant Compliance by Industry

```sql
SELECT
  i.name as industry,
  COUNT(DISTINCT c.id) as total_covenants,
  SUM(CASE WHEN ct.status = 'pass' THEN 1 ELSE 0 END) as passing,
  SUM(CASE WHEN ct.status = 'fail' THEN 1 ELSE 0 END) as failing,
  ROUND(100.0 * SUM(CASE WHEN ct.status = 'pass' THEN 1 ELSE 0 END) / COUNT(*), 1) as compliance_rate
FROM covenants c
JOIN deals d ON c.deal_id = d.id
JOIN dim_industries i ON d.industry_id = i.id
LEFT JOIN covenant_tests ct ON c.id = ct.covenant_id
  AND ct.tested_at = (SELECT MAX(tested_at) FROM covenant_tests WHERE covenant_id = c.id)
GROUP BY i.name
ORDER BY compliance_rate DESC;
```

---

## Appendix B: MCP Server Configuration

### B.1 Local Development

```json
// .mcp.json in project root
{
  "mcpServers": {
    "open-los": {
      "command": "npx",
      "args": ["tsx", "packages/mcp-server/src/server.ts"],
      "env": {
        "OPEN_LOS_DB_PATH": "./data/dev.db",
        "OPEN_LOS_LOG_LEVEL": "debug"
      }
    }
  }
}
```

### B.2 Production Deployment

```yaml
# docker-compose.yml
services:
  open-los-api:
    image: open-los/api:latest
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://...

  open-los-mcp:
    image: open-los/mcp-server:latest
    ports:
      - "3001:3001"
    environment:
      OPEN_LOS_API_URL: http://open-los-api:3000
      MCP_TRANSPORT: stdio  # or sse, websocket
```

---

## Appendix C: Glossary

| Term | Definition |
|------|------------|
| **Actor** | Human user or AI agent performing actions |
| **Deal** | A lending opportunity moving through stages |
| **Dimension** | Categorical attribute for slicing analytics (region, industry, etc.) |
| **Entity** | Company or person involved in a deal |
| **MCP** | Model Context Protocol - standard for AI tool integration |
| **Snapshot** | Point-in-time capture of state for historical analysis |
| **Spread** | Structured financial statement with normalized line items |
| **Tool** | MCP function that AI can call to interact with the system |
