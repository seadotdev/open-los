# Open LOS

Open-source B2B Lending CRM — headless API first.

## Quick Start

```bash
# Install dependencies
npm install

# Run tests (161 conformance tests)
npm test

# Start the API server
npm run start --workspace=packages/api

# Or with persistent database
DB_PATH=./data.db npm run start --workspace=packages/api
```

## API Examples

```bash
# Health check
curl http://localhost:3000/health

# Create a deal
curl -X POST http://localhost:3000/v1/deals \
  -H "Content-Type: application/json" \
  -d '{"borrower_name":"Acme Ltd","jurisdiction":"UK","requested_amount":500000,"purpose":"Working capital"}'

# List deals
curl http://localhost:3000/v1/deals

# Get a deal
curl http://localhost:3000/v1/deals/{id}

# Transition to origination stage
curl -X POST http://localhost:3000/v1/deals/{id}/stage-transitions \
  -H "Content-Type: application/json" \
  -H "X-Actor: alice" \
  -d '{"to_stage":"origination"}'
```

## Project Structure

```
packages/
  core/           # Domain logic, services, database schema
  api/            # Hono HTTP server
  conformance/    # YAML-driven test suites

schemas/          # JSON Schema definitions
conformance/      # Test cases and fixtures
openapi/          # OpenAPI 3.1 spec
docs/             # Architecture documentation
```

## What's Implemented

| Feature | Status |
|---------|--------|
| Deal lifecycle (5 stages) | ✅ |
| Stage guards & overrides | ✅ |
| Document management | ✅ |
| Audit trail (immutable) | ✅ |
| Entity graph (companies, people, relationships) | ✅ |
| Financial spreading & ratios | ✅ |
| Covenants (tests, grace periods, waivers) | ✅ |
| Bank transaction monitoring | ✅ |
| Liquidity & alerts | ✅ |
| Email ingestion | ✅ |
| Facilities | ✅ |
| Approval workflow | ✅ |
| Loan ledger (Mambu-compatible) | ✅ |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `DB_PATH` | `:memory:` | SQLite database path |

## Development

```bash
# Type check
npm run build

# Run specific test suite
npx vitest run packages/conformance/src/smoke.test.ts

# Watch mode
npm run dev --workspace=packages/api
```

## Documentation

- [SPEC.md](./SPEC.md) — Product specification
- [openapi/v1.yaml](./openapi/v1.yaml) — API contract
- [docs/AI_NATIVE_ARCHITECTURE.md](./docs/AI_NATIVE_ARCHITECTURE.md) — AI integration architecture

## License

MIT
