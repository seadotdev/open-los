# Phase 5: Monitoring + Email + Full Regression — Suites 07-08

## Completion Promise

When all tests in suites 00-08 pass, output exactly: `ALL SUITES PASSING`

## Context

You are completing the Open LOS — an open-source B2B Lending CRM.

Phase 4 is complete. Suites 00-06 pass. You have:
- Full stage machine, audit, deal CRUD, documents
- Entity graph with relationships, borrower group queries
- Template engine with frozen artifacts
- Financial spreading with deterministic ratio engine
- Typed covenants with test execution, grace periods, waivers

Read these files:
- `AGENTS.md` — coding standards
- `openapi/v1.yaml` — API contract (monitoring, email sections)
- `conformance/cases/07_monitoring.yaml` — monitoring tests to pass
- `conformance/cases/08_email.yaml` — email tests to pass
- `conformance/fixtures/deals/deal_001_small_sme/docs/bank_txns.csv` — bank transaction fixture
- `conformance/fixtures/deals/deal_001_small_sme/docs/inbox_email_1.eml` — email fixture

Explore existing code in `packages/core/src/` and `packages/api/src/`.

## What to Build

### 1. Bank Transaction Ingestion

**Drizzle schema — `bank_transactions` table:**
- id (uuid PK)
- deal_id (FK → deals)
- ingestion_id (uuid — groups a batch)
- date (text — ISO date)
- amount (integer — minor units, negative = debit/outflow)
- description (text)
- category (text)
- created_at

**Drizzle schema — `ingestions` table:**
- id (uuid PK)
- deal_id (FK → deals)
- source_type (text: "bank_transactions" | "accounting")
- records_accepted (integer)
- created_at

### 2. Monitoring Service

**`MonitoringService.ingest(dealId, input)`**

Accept bank transactions as:
- **JSON body:** `{source_type, transactions: [{date, amount, description, category}]}`
- **CSV file:** parse CSV with columns: date, amount, description, category

Validate:
- source_type is required
- transactions array must not be empty
- Each transaction needs date and amount

Store transactions, emit MONITORING_INGESTED audit event.

**`MonitoringService.getStatus(dealId)`**

Compute and return:

```json
{
  "deal_id": "...",
  "liquidity": {
    "current_balance": <sum of all transactions>,
    "avg_monthly_burn": <average monthly net outflow>,
    "runway_months": <current_balance / avg_monthly_burn>,
    "as_of": <latest transaction date>
  },
  "alerts": [...],
  "covenant_status": [...]
}
```

**Liquidity computation:**
1. `current_balance` = sum of all transaction amounts
2. Group transactions by month
3. `avg_monthly_burn` = average of monthly net amounts (only months with net negative, i.e., burn months)
4. `runway_months` = current_balance / abs(avg_monthly_burn)
5. If no burn (all months positive), runway_months = null

### 3. Alert Generation

When computing monitoring status, generate alerts:

**Liquidity warning:** If runway_months < 3:
```json
{
  "type": "liquidity_warning",
  "severity": "warning",
  "message": "Cash runway is X.X months (below 3-month threshold)"
}
```

**Covenant breach:** If any covenant test returns "fail":
```json
{
  "type": "covenant_breach",
  "severity": "critical",
  "message": "Covenant 'NAME' breached: actual VALUE vs threshold THRESHOLD"
}
```

**Data gap:** If latest transaction is more than 30 days before `now`:
```json
{
  "type": "data_gap",
  "severity": "warning",
  "message": "No bank transaction data since DATE (N days ago)"
}
```

Store alerts in an `alerts` table:
- id, deal_id, type, severity, message, created_at

Emit ALERT_CREATED audit events.

### 4. Monitoring API Routes

- `POST /v1/deals/:dealId/monitoring/ingest` — ingest transactions (JSON or multipart CSV)
- `GET /v1/deals/:dealId/monitoring/status` — get monitoring status with liquidity, alerts, covenant status

### 5. Email Parsing

**Drizzle schema — `communications` table:**
- id (uuid PK)
- deal_id (FK → deals, nullable)
- type (text: "email" | "note" | "meeting")
- subject (text)
- from_address (text)
- to_addresses (json — array of strings)
- body (text)
- thread_id (text — from Message-ID / In-Reply-To / References)
- created_at

### 6. Email Service

**`EmailService.ingest(file, dealId?)`**

Parse `.eml` file:
1. Extract headers: From, To, Subject, Date, Message-ID, In-Reply-To, References
2. Extract body (text/plain preferred, fall back to text/html)
3. Extract attachments

Use a lightweight EML parser (e.g., `mailparser` or `postal-mime` npm package).

**Deal auto-linking:**
If `deal_id` not provided, try to match:
1. Look for `[DEAL-XXXXX]` pattern in subject line
2. Match against deal short reference or ID prefix
3. If no match, set deal_id to null

**Attachment handling:**
For each attachment:
1. Create a Document record linked to the deal
2. Store the attachment content
3. Return attachment info in response

**Threading:**
Use Message-ID as thread_id. If In-Reply-To or References headers exist, use those to establish the thread chain.

Emit EMAIL_INGESTED audit event.

### 7. Email API Routes

- `POST /v1/email/ingest` — ingest .eml file (multipart)
- `GET /v1/deals/:dealId/communications` — list communications for a deal

### 8. Full Regression

After implementing monitoring and email:
1. Run ALL suites 00-08
2. Fix any regressions
3. Ensure all ~160 tests pass

## Test Command

```bash
npm run test:conformance
```

All suites 00-08 must pass.

## Key Rules

1. Don't break suites 00-06
2. Liquidity computation is deterministic from transaction data
3. Alert thresholds: runway < 3 months = warning, covenant breach = critical
4. Email parsing must handle multipart MIME with attachments
5. Auto-linking is best-effort — null deal_id is acceptable if no match
6. All mutations produce audit events
7. Amounts in minor units, negative = debit/outflow

## Done Criteria

All tests in suites 00-08 pass (~160 tests). Output: `ALL SUITES PASSING`

This completes the headless API. The system is ready for:
- Frontend development (Angular against OpenAPI contract)
- Additional integrations (Codat, GoCardless, etc.)
- AI copilot features (document extraction, memo drafting, etc.)
