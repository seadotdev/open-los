# Open LOS Conformance Test Suite

This directory contains the specification-driven test suite for Open LOS. **The tests ARE the specification.** Any implementation that passes these tests is a conformant Open LOS implementation.

## Philosophy

Traditional software treats tests as verification of implementation. We invert this:

1. **Tests define behavior** — YAML test cases are the authoritative specification
2. **Implementation is interchangeable** — Use any language/framework you prefer
3. **Migrate freely** — Pass the tests = conformant implementation
4. **Extend safely** — Add custom features while maintaining core compatibility

## Test Structure

```
conformance/
├── cases/                    # Test specifications (YAML)
│   ├── 00_smoke.yaml        # Basic CRUD operations
│   ├── 01_stages.yaml       # Deal lifecycle, stage guards
│   ├── 02_audit.yaml        # Immutable audit trail
│   ├── 03_templates.yaml    # Document templates
│   ├── 04_entity_graph.yaml # Entities and relationships
│   ├── 05_underwriting.yaml # Financial spreading, ratios
│   ├── 06_covenants.yaml    # Covenant management
│   ├── 07_monitoring.yaml   # Transaction monitoring
│   ├── 08_email.yaml        # Email ingestion
│   ├── 09_loans.yaml        # Loan ledger, state machine
│   ├── 10_facilities.yaml   # Facility management
│   ├── 11_errors.yaml       # Error response format
│   ├── 12_tenants.yaml      # Multi-tenant isolation
│   └── 13_idempotency.yaml  # Idempotent operations
├── fixtures/                 # Test data files
│   ├── templates/           # Markdown templates
│   └── deals/               # Sample deal data
└── README.md                # This file
```

## Running Tests

### Against the Reference Implementation

```bash
# Install dependencies
npm install

# Run all conformance tests
npm test

# Run a specific suite
npx vitest run packages/conformance/src/smoke.test.ts

# Watch mode
npx vitest packages/conformance/src
```

### Against Your Own Implementation

To test your own implementation, you need to:

1. Start your implementation's HTTP server
2. Set the base URL environment variable
3. Run the test suite

```bash
# Start your server (example)
./my-implementation --port 8080

# Run tests against your implementation
CONFORMANCE_BASE_URL=http://localhost:8080 npm test
```

**Note:** The test runner currently runs against the in-process reference implementation. To run against an external server, you'll need to modify `packages/conformance/src/runner.ts` to make actual HTTP requests instead of using the Hono app's `request()` method.

## Test Format

Each test case follows this structure:

```yaml
version: "0.1.0"
suite: suite_name
description: Description of what this suite tests

---
test: unique_test_identifier
meta:
  name: "Human-readable test name"
  now: "2026-01-15T10:00:00Z"  # Deterministic timestamp

arrange:
  reset_db: true  # true = fresh DB, false = continue from previous
  seed:
    tenant: { id: "t1" }
    users:
      - { id: "u_analyst", role: "analyst" }
    deals:
      - { id: "d1", borrower_name: "Acme", stage: "broker" }

steps:
  - id: step_name
    http:
      actor: "u_analyst"     # Sets X-Actor header
      method: POST
      path: /v1/deals
      json:
        borrower_name: "Test Corp"
    expect:
      status: 201
      json_schema: "schemas/deal.schema.json"
      json_contains:
        borrower_name: "Test Corp"
      json_path_assertions:
        - path: "$.id"
          exists: true
      save:
        deal_id: "$.id"

  - id: use_saved_value
    http:
      method: GET
      path: /v1/deals/${deal_id}
    expect:
      status: 200
```

## Assertion Reference

### Status Code
```yaml
expect:
  status: 200  # Expected HTTP status
```

### JSON Schema Validation
```yaml
expect:
  json_schema: "schemas/deal.schema.json"
```

### Contains Assertion
```yaml
expect:
  json_contains:
    field: "value"
    nested:
      field: "value"
```

### JSONPath Assertions
```yaml
expect:
  json_path_assertions:
    - path: "$.id"
      exists: true
    - path: "$.amount"
      eq: 1000000
    - path: "$.count"
      gte: 1
    - path: "$.ratio"
      lte: 1.5
    - path: "$.account_id"
      regex: "^LN-\\d{5}$"
    - path: "$.message"
      contains: "success"
    - path: "$.data"
      not_contains: "secret"
    - path: "$.rate"
      approx: { value: 0.075, tolerance: 0.001 }
```

### Save Values
```yaml
expect:
  save:
    deal_id: "$.id"
    account_id: "$.account_id"
```

## Implementing a Conformant System

### Required Endpoints

See `openapi/v1.yaml` for the complete API specification. Key endpoints:

| Category | Endpoints |
|----------|-----------|
| Deals | `POST/GET/PATCH /v1/deals`, `GET /v1/deals/{id}` |
| Stages | `POST/GET /v1/deals/{id}/stage-transitions` |
| Documents | `POST/GET /v1/deals/{id}/documents` |
| Entities | `POST/GET/PATCH/DELETE /v1/entities` |
| Relationships | `POST /v1/relationships` |
| Covenants | `POST/GET /v1/deals/{id}/covenants`, `POST /covenants/{id}/waivers` |
| Monitoring | `POST /v1/deals/{id}/monitoring/ingest` |
| Loans | `POST/GET/PATCH /v1/loans`, `POST /v1/loans/{id}/transactions` |
| Facilities | `POST/GET/PATCH/DELETE /v1/deals/{id}/facilities` |
| Audit | `GET /v1/deals/{id}/audit` |

### Required Headers

| Header | Description | Default |
|--------|-------------|---------|
| `X-Actor` | User performing the action | `system` |
| `X-Tenant-Id` | Tenant identifier | `default` |
| `Content-Type` | Request content type | `application/json` |
| `Idempotency-Key` | For idempotent operations | (optional) |

### Error Response Format

All errors must follow this structure:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description"
  }
}
```

Error codes:
- `VALIDATION_ERROR` (400)
- `NOT_FOUND` (404)
- `FORBIDDEN` (403)
- `INVALID_TRANSITION` (400)
- `STAGE_GUARD_FAILED` (400)
- `OVERRIDE_REQUIRED` (400)
- `CONFLICT` (409)

### Deterministic Behavior

Tests use fixed timestamps via the `meta.now` field. Your implementation must:

1. Accept a clock/time source that can be injected for testing
2. Use this clock for all `created_at`, `updated_at`, and time-based calculations
3. Produce identical results given identical inputs and timestamps

### Financial Calculations

Ratios must be computed as specified:

```
current_ratio = current_assets / current_liabilities
debt_to_equity = total_debt / total_equity
dscr = (net_income + depreciation + interest) / interest
gross_margin = (revenue - cogs) / revenue
net_margin = net_income / revenue
leverage = total_debt / (net_income + depreciation)
```

All ratios rounded to 3 decimal places. Division by zero returns `null`.

### Loan State Machine

```
PENDING_APPROVAL → APPROVED → ACTIVE → CLOSED
       ↓              ↓         ↓
    (REJECT)      (WITHDRAW)  ACTIVE_IN_ARREARS
       ↓              ↓         ↓
    CLOSED         CLOSED     LOCKED → CLOSED
```

Valid transitions and sub-states must match the specification.

## Contributing

When adding new features:

1. **Write tests first** — Define behavior in YAML before implementing
2. **Add JSON schemas** — Define response structures in `schemas/`
3. **Update OpenAPI spec** — Keep `openapi/v1.yaml` in sync
4. **Document** — Update docs/SPECIFICATION.md

The test suite is the source of truth.

## Test Coverage

| Suite | Tests | Coverage |
|-------|-------|----------|
| Smoke | 10 | Basic CRUD |
| Stages | 25+ | Lifecycle, guards, overrides |
| Audit | 8 | Immutability |
| Templates | 6 | Rendering, artifacts |
| Entity Graph | 12 | Entities, relationships |
| Underwriting | 15 | Spreads, ratios |
| Covenants | 18 | Tests, waivers, grace periods |
| Monitoring | 20 | Transactions, liquidity |
| Email | 6 | Ingestion, threading |
| Loans | 30+ | State machine, transactions |
| Facilities | 10 | CRUD, conversion |
| Errors | 12 | Response format |
| Tenants | 8 | Isolation |
| Idempotency | 6 | Deduplication |

Total: **180+ specification tests**
