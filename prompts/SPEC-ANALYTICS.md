# Analytics Endpoints Spec

> Self-serve analytics for lending portfolio insights

## Overview

This spec defines analytics endpoints that:
1. Provide portfolio-level aggregations (pipeline by stage, volumes, performance)
2. Enable flexible querying without building custom reports
3. Leverage existing audit and deal data (no new data collection)
4. Support both human dashboards and AI-driven insights

### What This Is NOT

- **Not a BI tool replacement** — basic aggregations, not full OLAP
- **Not real-time streaming** — request/response queries
- **Not a data warehouse** — queries against operational data

---

## Analytics Domains

### 1. Pipeline Analytics

Current state of the deal pipeline.

```typescript
interface PipelineMetrics {
  // Counts by stage
  byStage: {
    broker: number;
    origination: number;
    underwriting: number;
    closing: number;
    monitoring: number;
  };

  // Volume by stage (sum of requested_amount)
  volumeByStage: {
    broker: number;
    origination: number;
    underwriting: number;
    closing: number;
    monitoring: number;
  };

  // Weighted pipeline (probability-adjusted)
  weightedPipeline: number;

  // Stage velocity (avg days in each stage)
  avgDaysInStage: {
    broker: number;
    origination: number;
    underwriting: number;
    closing: number;
  };
}
```

### 2. Portfolio Analytics

Deals in monitoring (active loans).

```typescript
interface PortfolioMetrics {
  // Portfolio size
  totalDeals: number;
  totalExposure: number;           // Sum of facility amounts
  totalOutstanding: number;        // From loan accounts

  // Composition
  byDealType: Record<string, { count: number; amount: number }>;
  byIndustry: Record<string, { count: number; amount: number }>;

  // Performance
  covenantCompliance: {
    compliant: number;
    inBreach: number;
    inGrace: number;
    waived: number;
  };

  // Risk distribution
  byRiskRating: Record<string, { count: number; amount: number }>;
}
```

### 3. Activity Analytics

What's happening over time.

```typescript
interface ActivityMetrics {
  period: string;  // "2024-01", "2024-Q1", "2024"

  // Deal flow
  dealsCreated: number;
  dealsClosed: number;           // Moved to monitoring
  dealsDeclined: number;

  // Volume
  volumeOriginated: number;
  volumeDisbursed: number;
  volumeRepaid: number;

  // Velocity
  avgTimeToClose: number;        // Days from creation to monitoring

  // Conversion
  conversionRate: number;        // Deals closed / deals created
}
```

### 4. Covenant Analytics

Covenant health across portfolio.

```typescript
interface CovenantMetrics {
  // Overall health
  totalCovenants: number;
  compliantCount: number;
  breachCount: number;

  // By covenant type
  byMetric: Record<string, {
    total: number;
    compliant: number;
    breached: number;
    avgHeadroom: number;  // How much buffer to threshold
  }>;

  // Trends
  breachTrend: Array<{
    period: string;
    breaches: number;
  }>;
}
```

---

## API Design

### Endpoints

```yaml
# === PIPELINE ===

# Get current pipeline metrics
GET /v1/analytics/pipeline
Query:
  deal_type: "term_loan"           # Optional filter
  source: "broker_a"               # Optional filter
Response:
  byStage: { broker: 5, origination: 12, ... }
  volumeByStage: { broker: 5000000, ... }
  weightedPipeline: 18500000
  avgDaysInStage: { broker: 3.2, origination: 8.5, ... }

# Pipeline trend over time
GET /v1/analytics/pipeline/trend
Query:
  period: "monthly" | "weekly"
  start_date: "2024-01-01"
  end_date: "2024-03-31"
Response:
  periods:
    - period: "2024-01"
      byStage: { broker: 8, ... }
      volumeByStage: { ... }
    - period: "2024-02"
      ...

# === PORTFOLIO ===

# Get portfolio metrics
GET /v1/analytics/portfolio
Response:
  totalDeals: 45
  totalExposure: 125000000
  totalOutstanding: 98000000
  byDealType:
    term_loan: { count: 30, amount: 80000000 }
    revolving_credit: { count: 15, amount: 45000000 }
  covenantCompliance:
    compliant: 40
    inBreach: 3
    inGrace: 2
    waived: 0

# Portfolio composition breakdown
GET /v1/analytics/portfolio/composition
Query:
  group_by: "deal_type" | "industry" | "risk_rating" | "region"
Response:
  groups:
    - name: "term_loan"
      count: 30
      amount: 80000000
      percentage: 64
    - name: "revolving_credit"
      ...

# === ACTIVITY ===

# Get activity metrics for a period
GET /v1/analytics/activity
Query:
  period: "monthly" | "quarterly" | "yearly"
  start_date: "2024-01-01"
  end_date: "2024-03-31"
Response:
  periods:
    - period: "2024-01"
      dealsCreated: 8
      dealsClosed: 3
      dealsDeclined: 1
      volumeOriginated: 12000000
      avgTimeToClose: 45
      conversionRate: 0.38
    - period: "2024-02"
      ...

# === COVENANTS ===

# Get covenant health metrics
GET /v1/analytics/covenants
Response:
  totalCovenants: 120
  compliantCount: 108
  breachCount: 8
  inGraceCount: 4
  byMetric:
    dscr:
      total: 45
      compliant: 42
      breached: 2
      avgHeadroom: 0.15
    leverage:
      total: 40
      compliant: 35
      breached: 4
      avgHeadroom: 0.08

# Covenant breach trend
GET /v1/analytics/covenants/trend
Query:
  period: "monthly"
  months: 12
Response:
  periods:
    - period: "2024-01"
      breaches: 2
      newBreaches: 1
      cured: 0
    - period: "2024-02"
      ...

# === DEAL-LEVEL ===

# Get analytics for a specific deal
GET /v1/deals/{deal_id}/analytics
Response:
  daysInPipeline: 45
  daysInCurrentStage: 12
  stageHistory:
    - stage: "broker"
      enteredAt: "2024-01-01T..."
      exitedAt: "2024-01-03T..."
      daysInStage: 2
    - stage: "origination"
      ...
  covenantHealth:
    total: 4
    compliant: 3
    breached: 1
  documentCompleteness: 0.85   # 85% of required docs uploaded
```

---

## Query Builder (Flexible Analytics)

For advanced queries, provide a simple query DSL:

```yaml
# Flexible analytics query
POST /v1/analytics/query
Request:
  # What to measure
  metrics:
    - "count"
    - "sum:requested_amount"
    - "avg:days_in_stage"

  # How to group
  groupBy:
    - "stage"
    - "deal_type"

  # Filters
  filters:
    - field: "created_at"
      operator: "gte"
      value: "2024-01-01"
    - field: "stage"
      operator: "in"
      values: ["underwriting", "closing"]

  # Sorting
  orderBy:
    field: "count"
    direction: "desc"

  # Pagination
  limit: 10

Response:
  results:
    - stage: "underwriting"
      deal_type: "term_loan"
      count: 8
      sum_requested_amount: 24000000
      avg_days_in_stage: 12.5
    - stage: "underwriting"
      deal_type: "revolving_credit"
      count: 4
      ...
  total: 15
```

### Supported Metrics

| Metric | Description |
|--------|-------------|
| `count` | Number of deals |
| `sum:field` | Sum of numeric field |
| `avg:field` | Average of numeric field |
| `min:field` | Minimum value |
| `max:field` | Maximum value |
| `distinct:field` | Count of distinct values |

### Supported Group By Fields

| Field | Description |
|-------|-------------|
| `stage` | Deal stage |
| `deal_type` | Type of deal |
| `source` | Deal source |
| `primary_entity_id` | Borrower |
| `created_at:month` | Month of creation |
| `created_at:quarter` | Quarter of creation |
| `created_at:year` | Year of creation |

---

## Schema Additions

### Materialized Views (Optional Optimization)

For performance, pre-compute common aggregations:

```typescript
// Only if query performance becomes an issue
export const pipelineSnapshot = sqliteTable("pipeline_snapshots", {
  id: text("id").primaryKey(),
  tenant_id: text("tenant_id").notNull().default("default"),

  // Snapshot timestamp
  snapshot_date: text("snapshot_date").notNull(),  // ISO date

  // Counts
  broker_count: integer("broker_count").default(0),
  origination_count: integer("origination_count").default(0),
  underwriting_count: integer("underwriting_count").default(0),
  closing_count: integer("closing_count").default(0),
  monitoring_count: integer("monitoring_count").default(0),

  // Volumes
  broker_volume: integer("broker_volume").default(0),
  origination_volume: integer("origination_volume").default(0),
  underwriting_volume: integer("underwriting_volume").default(0),
  closing_volume: integer("closing_volume").default(0),
  monitoring_volume: integer("monitoring_volume").default(0),

  created_at: text("created_at").notNull(),
});

// Index: idx_pipeline_snapshots_date
```

---

## Service Layer

### AnalyticsService

```typescript
interface AnalyticsService {
  // Pipeline
  getPipelineMetrics(filters?: PipelineFilters): Promise<PipelineMetrics>;
  getPipelineTrend(period: Period, dateRange: DateRange): Promise<PipelineTrend[]>;

  // Portfolio
  getPortfolioMetrics(): Promise<PortfolioMetrics>;
  getPortfolioComposition(groupBy: string): Promise<CompositionGroup[]>;

  // Activity
  getActivityMetrics(period: Period, dateRange: DateRange): Promise<ActivityMetrics[]>;

  // Covenants
  getCovenantMetrics(): Promise<CovenantMetrics>;
  getCovenantTrend(months: number): Promise<CovenantTrendPoint[]>;

  // Deal-level
  getDealAnalytics(dealId: string): Promise<DealAnalytics>;

  // Flexible query
  query(request: AnalyticsQuery): Promise<AnalyticsQueryResult>;
}

interface PipelineFilters {
  dealType?: string;
  source?: string;
  minAmount?: number;
  maxAmount?: number;
}

interface DateRange {
  startDate: string;  // ISO date
  endDate: string;
}

type Period = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

interface AnalyticsQuery {
  metrics: string[];
  groupBy?: string[];
  filters?: QueryFilter[];
  orderBy?: { field: string; direction: "asc" | "desc" };
  limit?: number;
  offset?: number;
}

interface QueryFilter {
  field: string;
  operator: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in" | "between";
  value: unknown;
  secondValue?: unknown;  // For "between"
}
```

### Implementation Notes

```typescript
// packages/core/src/services/analytics.ts

export function createAnalyticsService(db: Database, services: Services): AnalyticsService {
  return {
    async getPipelineMetrics(filters) {
      // Direct query against deals table
      const stages = ["broker", "origination", "underwriting", "closing", "monitoring"];

      const counts = await db
        .select({
          stage: deals.stage,
          count: sql<number>`count(*)`,
          volume: sql<number>`sum(${deals.requested_amount})`,
        })
        .from(deals)
        .where(and(
          eq(deals.tenant_id, "default"),
          filters?.dealType ? eq(deals.deal_type, filters.dealType) : undefined,
        ))
        .groupBy(deals.stage);

      // Calculate avg days in stage from audit events
      const stageVelocity = await calculateStageVelocity(db);

      return {
        byStage: Object.fromEntries(counts.map(c => [c.stage, c.count])),
        volumeByStage: Object.fromEntries(counts.map(c => [c.stage, c.volume || 0])),
        weightedPipeline: calculateWeightedPipeline(counts),
        avgDaysInStage: stageVelocity,
      };
    },

    async getPortfolioMetrics() {
      // Only deals in monitoring stage
      const portfolio = await db
        .select({
          count: sql<number>`count(*)`,
          totalExposure: sql<number>`sum(${facilities.amount})`,
        })
        .from(deals)
        .leftJoin(facilities, eq(deals.id, facilities.deal_id))
        .where(eq(deals.stage, "monitoring"));

      // Get covenant compliance
      const covenantStatus = await services.covenant.getComplianceSummary();

      return {
        totalDeals: portfolio[0].count,
        totalExposure: portfolio[0].totalExposure || 0,
        covenantCompliance: covenantStatus,
        // ...
      };
    },

    async query(request) {
      // Build dynamic query from request
      const query = buildAnalyticsQuery(request);
      return db.execute(query);
    },
  };
}

// Weighted pipeline: probability * volume
function calculateWeightedPipeline(counts: StageCount[]): number {
  const weights = {
    broker: 0.1,
    origination: 0.25,
    underwriting: 0.5,
    closing: 0.8,
    monitoring: 1.0,
  };

  return counts.reduce((sum, c) => {
    return sum + (c.volume || 0) * (weights[c.stage] || 0);
  }, 0);
}

// Calculate avg days in each stage from audit trail
async function calculateStageVelocity(db: Database): Promise<Record<string, number>> {
  // Query stage_transitions or audit_events
  // Calculate time between stage entries and exits
  // Return averages
}
```

---

## Context Hints Integration

Add analytics to deal `_context`:

```typescript
// In deal response
{
  "id": "deal_123",
  "name": "Acme Corp Term Loan",
  "stage": "underwriting",
  // ... other fields
  "_context": {
    "availableActions": [...],
    "warnings": [...],
    // NEW: Deal analytics
    "analytics": {
      "daysInPipeline": 23,
      "daysInCurrentStage": 8,
      "avgDaysInStageForType": 12,  // Comparison benchmark
      "covenantHealth": "compliant"  // or "at_risk"
    }
  }
}
```

---

## Implementation Order

1. **Phase 1: Pipeline Analytics**
   - Add `GET /v1/analytics/pipeline`
   - Implement stage counts and volumes
   - Add stage velocity calculation

2. **Phase 2: Portfolio Analytics**
   - Add `GET /v1/analytics/portfolio`
   - Implement composition breakdown
   - Add covenant compliance summary

3. **Phase 3: Activity Analytics**
   - Add `GET /v1/analytics/activity`
   - Implement time-series aggregations
   - Calculate conversion rates

4. **Phase 4: Deal Analytics**
   - Add `GET /v1/deals/{id}/analytics`
   - Implement stage history
   - Add document completeness

5. **Phase 5: Query Builder**
   - Add `POST /v1/analytics/query`
   - Implement flexible grouping and filtering
   - Add query validation

6. **Phase 6: Optimization (if needed)**
   - Add materialized views for slow queries
   - Implement caching
   - Add pipeline snapshots

---

## Out of Scope (Future)

| Feature | Reason to Defer |
|---------|-----------------|
| Real-time streaming | Adds complexity, request/response is fine |
| Custom dashboards | Use BI tools for that |
| Export to CSV/Excel | Add when users request |
| Scheduled reports | Use external cron for now |
| Predictive analytics | Needs ML infrastructure |
| Drill-down queries | Keep aggregations simple |
