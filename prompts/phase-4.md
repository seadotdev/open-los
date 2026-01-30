# Phase 4: Underwriting + Covenants — Suites 05-06

## Completion Promise

When all tests in suites 00-06 pass, output exactly: `UNDERWRITING COVENANTS PASSING`

## Context

You are continuing work on the Open LOS — an open-source B2B Lending CRM.

Phase 3 is complete. Suites 00-04 pass. You have:
- Full stage machine, audit, deal CRUD, documents
- Entity graph with relationships, borrower group queries
- Template engine with mustache rendering, frozen artifacts

Read these files:
- `AGENTS.md` — coding standards
- `openapi/v1.yaml` — API contract (underwriting/spread, covenants sections)
- `schemas/covenant.schema.json`, `schemas/covenant-test.schema.json`
- `conformance/cases/05_underwriting.yaml` — underwriting tests to pass
- `conformance/cases/06_covenants.yaml` — covenant tests to pass
- `conformance/fixtures/deals/deal_001_small_sme/docs/accounts.csv` — financial data fixture
- `conformance/fixtures/deals/deal_001_small_sme/expected/ratios.json` — expected ratios
- `conformance/fixtures/deals/deal_001_small_sme/expected/covenant_schedule.json` — expected covenant results

Explore existing code in `packages/core/src/` and `packages/api/src/`.

## What to Build

### 1. Financial Spread Tables

**Drizzle schema — `spreads` table:**
- id (uuid PK)
- deal_id (FK → deals)
- entity_id (FK → entities)
- period (text — e.g. "FY2024", "H1-2025")
- line_items (json — array of {category, label, amount})
- ratios (json — computed ratio object)
- created_at

**Drizzle schema — `line_items` table (optional, can use JSON):**
- id, spread_id (FK), category, label, amount (integer, minor units)

### 2. Spread Service

**`SpreadService.create(dealId, input)`**

Accept financial data as:
- **JSON body:** `{entity_id, period, line_items: [{category, label, amount}]}`
- **CSV file upload:** parse CSV with columns: category, label, amount, period

**Categories (standardized):**
- `revenue` — Total revenue
- `cogs` — Cost of goods sold
- `operating_expense` — Operating expenses
- `interest_expense` — Interest expense
- `tax` — Income tax
- `depreciation` — Depreciation & amortization
- `current_assets` — Total current assets
- `current_liabilities` — Total current liabilities
- `total_debt` — Total debt
- `total_equity` — Total equity
- `cash` — Cash and equivalents

### 3. Ratio Engine (Deterministic)

Compute these ratios from line items (all amounts in minor units):

```
net_income = revenue - cogs - operating_expense - interest_expense - tax

current_ratio = current_assets / current_liabilities
debt_to_equity = total_debt / total_equity
dscr = (net_income + depreciation + interest_expense) / interest_expense
gross_margin = (revenue - cogs) / revenue
net_margin = net_income / revenue
leverage = total_debt / (net_income + depreciation)
```

**Edge cases:**
- Division by zero → return `null` (not error)
- Missing line items → default to 0
- Negative values are valid (negative equity, negative net income)

**Precision:** Round ratios to 3 decimal places.

### 4. Underwriting API Routes

- `POST /v1/deals/:dealId/spread` — create spread (JSON or multipart CSV)
- `GET /v1/deals/:dealId/ratios` — get computed ratios for all periods

### 5. Covenant Table + Service

**Drizzle schema — `covenants` table:**
- id (uuid PK)
- deal_id (FK → deals)
- name (text, required)
- type (text: "financial" | "reporting" | "information")
- metric (text — e.g. "dscr", "leverage", "min_liquidity", "gross_margin", "current_ratio")
- operator (text: ">=", "<=", ">", "<", "==")
- threshold (real)
- frequency (text: "monthly" | "quarterly" | "annually")
- grace_period_days (integer, default 0)
- notes (text)
- created_at

**Drizzle schema — `covenant_tests` table:**
- id (uuid PK)
- covenant_id (FK → covenants)
- deal_id (FK → deals)
- status (text: "pass" | "fail" | "warning" | "grace_period" | "waived")
- actual_value (real)
- threshold (real)
- operator (text)
- metric (text)
- tested_at (timestamp)
- grace_period_expires (timestamp, nullable)

**Drizzle schema — `waivers` table:**
- id (uuid PK)
- covenant_id (FK → covenants)
- reason (text, required)
- approved_by (text, required)
- valid_from (timestamp)
- valid_until (timestamp)
- created_at

### 6. Covenant Service

**`CovenantService.create(dealId, input)`** — create typed covenant, emit COVENANT_CREATED audit.

**`CovenantService.test(dealId, options)`** — run covenant tests:
1. Get all covenants for deal (or specific IDs if provided)
2. Get latest ratios/metrics for the deal
3. For each covenant:
   a. Get actual value for the metric from ratios
   b. Compare actual vs threshold using operator
   c. If fail and grace_period_days > 0 and not already in grace: status = "grace_period", compute grace_period_expires
   d. If fail and grace period expired: status = "fail"
   e. If waiver is active (valid_from <= now <= valid_until): status = "waived"
   f. Otherwise: status = "pass"
4. Store test results, emit COVENANT_TESTED audit
5. Return results array

**Metric mapping:**
- `dscr` → spread.ratios.dscr
- `leverage` → spread.ratios.leverage
- `min_liquidity` → spread.line_items.cash (from latest spread)
- `gross_margin` → spread.ratios.gross_margin
- `current_ratio` → spread.ratios.current_ratio

**`CovenantService.waive(covenantId, input)`** — record waiver, emit COVENANT_WAIVED audit.

### 7. Covenant API Routes

- `POST /v1/deals/:dealId/covenants` — createCovenant
- `GET /v1/deals/:dealId/covenants` — listCovenants
- `POST /v1/deals/:dealId/covenants/test` — testCovenants
- `POST /v1/covenants/:covenantId/waivers` — createWaiver

## Test Command

```bash
npm run test:conformance
```

All suites 00-06 must pass.

## Key Rules

1. Don't break suites 00-04
2. Ratio computation is deterministic — same inputs always produce same outputs
3. All amounts are integers in minor units (cents/pence)
4. Round ratios to 3 decimal places
5. Division by zero returns null, not error
6. Grace periods are date-based, not test-count-based
7. Waivers have optional time bounds (valid_from, valid_until)
8. All mutations produce audit events

## Fixture Validation

The spread from `conformance/fixtures/deals/deal_001_small_sme/docs/accounts.csv` (FY2024) must produce ratios matching `conformance/fixtures/deals/deal_001_small_sme/expected/ratios.json`:
- current_ratio: 2.0
- debt_to_equity: 0.667
- dscr: 8.167
- gross_margin: 0.4
- net_margin: 0.165
- leverage: 1.86

## Done Criteria

All tests in suites 00-06 pass (~125 tests). Output: `UNDERWRITING COVENANTS PASSING`
