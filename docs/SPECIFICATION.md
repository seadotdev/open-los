# Open LOS Specification

**The tests ARE the specification.**

This project follows a specification-driven development approach where the conformance test suite serves as the canonical definition of the software's behavior. Any implementation that passes the test suite is, by definition, a conformant implementation.

## Philosophy

Traditional software development treats tests as verification of an implementation. We invert this relationship:

1. **Tests define behavior** — The YAML test cases in `conformance/cases/` are the authoritative specification of what the software must do
2. **Implementation is interchangeable** — The TypeScript/Node.js implementation in `packages/` is just one possible implementation
3. **Migrate freely** — Organizations can rewrite in their preferred stack (Go, Rust, Python, Java, etc.) and validate correctness by running the same test suite
4. **Extend safely** — Custom features can coexist as long as the core specification tests pass

## Benefits

### For Adopters
- **No vendor lock-in** — Switch implementations without losing confidence in correctness
- **Technology freedom** — Use your organization's preferred language/framework
- **Performance optimization** — Rewrite critical paths in faster languages while maintaining compatibility
- **Compliance assurance** — The test suite serves as auditable proof of correct behavior

### For Contributors
- **Clear contracts** — Every feature is defined by its test cases
- **Regression protection** — Changes that break the spec are immediately caught
- **Documentation-as-tests** — Tests serve as executable documentation
- **Parallel development** — Multiple implementations can be developed and compared

## Specification Structure

```
conformance/
  cases/
    00_smoke.yaml       # Basic CRUD, essential operations
    01_stages.yaml      # Deal lifecycle, stage transitions, guards
    02_audit.yaml       # Immutable audit trail
    03_templates.yaml   # Document templates, rendering
    04_entity_graph.yaml # Companies, people, relationships
    05_underwriting.yaml # Financial spreading, ratio computation
    06_covenants.yaml   # Covenant management, testing, waivers
    07_monitoring.yaml  # Transaction ingestion, liquidity, alerts
    08_email.yaml       # Email ingestion, threading
    09_loans.yaml       # Loan ledger, state machine, transactions
    10_facilities.yaml  # Facility management
    11_errors.yaml      # Error responses, validation
    12_tenants.yaml     # Multi-tenant isolation
    13_idempotency.yaml # Idempotent operations
  fixtures/             # Test data files (CSVs, EMLs, etc.)

schemas/                # JSON Schema definitions for response validation
openapi/v1.yaml         # OpenAPI 3.1 contract
```

## Test Format

Each test case follows this structure:

```yaml
test: unique_test_identifier
meta:
  name: "Human-readable description of what this tests"
  now: "2026-01-15T10:00:00Z"  # Deterministic timestamp for this test

arrange:
  reset_db: true  # Start with fresh state (false to chain tests)
  seed:
    tenant: { id: "t1" }
    users:
      - { id: "u_analyst", role: "analyst" }
    deals:
      - { id: "d1", borrower_name: "Acme", stage: "broker", ... }

steps:
  - id: step_name
    http:
      actor: "u_analyst"    # X-Actor header
      method: POST
      path: /v1/deals
      json:
        borrower_name: "Acme Ltd"
    expect:
      status: 201
      json_schema: "schemas/deal.schema.json"
      json_contains:
        stage: "broker"
      json_path_assertions:
        - path: "$.id"
          exists: true
        - path: "$.requested_amount"
          gte: 0
      save:
        deal_id: "$.id"

  - id: subsequent_step
    http:
      method: GET
      path: /v1/deals/${deal_id}  # Variable substitution
    expect:
      status: 200
```

## Assertion Types

| Assertion | Description |
|-----------|-------------|
| `status` | Expected HTTP status code |
| `json_schema` | Path to JSON Schema file for response validation |
| `json_contains` | Response must contain these key-value pairs |
| `json_path_assertions` | Array of JSONPath-based assertions |
| `save` | Extract values into variables for subsequent steps |

### JSONPath Assertions

| Operator | Example | Description |
|----------|---------|-------------|
| `eq` | `eq: "pending"` | Exact equality |
| `gte` | `gte: 100` | Greater than or equal |
| `lte` | `lte: 1000` | Less than or equal |
| `exists` | `exists: true` | Path exists (or not) |
| `regex` | `regex: "^LN-\\d{5}$"` | Matches regular expression |
| `contains` | `contains: "error"` | String contains substring |
| `not_contains` | `not_contains: "password"` | String does not contain |
| `approx` | `approx: {value: 1.5, tolerance: 0.01}` | Approximate numeric match |

## Implementing a Conformant System

To create your own implementation:

1. **Read the tests** — Each YAML file specifies exact behavior
2. **Implement the HTTP API** — Match the paths, methods, and response shapes
3. **Run the test suite** — Point it at your implementation's base URL
4. **Iterate until green** — A passing suite means you're conformant

### Running Tests Against Your Implementation

```bash
# Default: runs against the reference TypeScript implementation
npm test

# Against a custom implementation (planned)
CONFORMANCE_BASE_URL=http://localhost:8080 npm test
```

## Specification Categories

### Core Operations (00_smoke)
- CRUD operations on deals
- Basic response structure
- Field updates and retrieval

### Deal Lifecycle (01_stages)
- Stage transitions: broker → origination → underwriting → closing → monitoring
- Stage guards (required fields, documents, outcomes)
- Role-based permissions
- Override mechanism for credit_lead role

### Audit Trail (02_audit)
- Immutability guarantee (no updates, no deletes)
- Event structure (actor, timestamp, changes)
- Query capabilities (by type, actor, date range)

### Entity Graph (04_entity_graph)
- Entity types: company, person
- Relationship types: owns, guarantees, directs
- Borrower group traversal
- Ownership percentage tracking

### Financial Spreading (05_underwriting)
- Line item aggregation
- Ratio computation (deterministic, 3 decimal places):
  - current_ratio = current_assets / current_liabilities
  - debt_to_equity = total_debt / total_equity
  - dscr = (net_income + depreciation + interest) / interest
  - gross_margin = (revenue - cogs) / revenue
  - net_margin = net_income / revenue
  - leverage = total_debt / (net_income + depreciation)

### Covenants (06_covenants)
- Covenant types: financial, reporting, information
- Operators: >=, <=, >, <, ==
- Test statuses: pass, fail, warning, grace_period, waived
- Grace period handling
- Waiver management

### Monitoring (07_monitoring)
- Transaction ingestion (JSON, CSV)
- Liquidity calculation
- Alert generation
- Covenant testing integration

### Loans (09_loans)
- State machine: PARTIAL_APPLICATION → PENDING_APPROVAL → APPROVED → ACTIVE → CLOSED
- Transaction types: DISBURSEMENT, REPAYMENT, FEE, INTEREST_APPLIED, etc.
- Balance tracking
- Arrears calculation
- Idempotent transactions

### Error Handling (11_errors)
- Validation errors (400)
- Not found errors (404)
- Permission errors (403)
- Conflict errors (409)
- Structured error responses

### Multi-tenancy (12_tenants)
- Tenant isolation via X-Tenant-Id header
- Cross-tenant access prevention
- Default tenant behavior

## Versioning

The specification version follows semantic versioning:

- **Major** — Breaking changes to existing tests
- **Minor** — New test cases, backward compatible
- **Patch** — Clarifications, bug fixes to tests

Current version: `0.1.0`

## Contributing

When adding new features:

1. **Write the tests first** — Define behavior in YAML before implementation
2. **Add JSON schemas** — Define response structures in `schemas/`
3. **Update OpenAPI spec** — Keep `openapi/v1.yaml` in sync
4. **Document the specification** — Update this file with new categories

The test suite is the source of truth. If the tests and implementation disagree, the tests are correct.

## License

The specification (test suite, schemas, OpenAPI) is released under MIT license, enabling free use and adaptation.
