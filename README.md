# Open LOS

Open-source, AI-native loan origination system for B2B lenders. Headless REST API that AI agents and humans operate equally.

Replaces legacy platforms (nCino, Mambu, Temenos) with modern infrastructure: deterministic financial calculations, immutable audit trails, and zero vendor lock-in.

**For:** fintechs, credit unions, and emerging lenders who need modern lending infrastructure without enterprise vendor lock-in.

## Quick Start

```bash
npm install
npm test                                    # 249 tests
npm run start --workspace=packages/api      # API on :3000

# With persistent database
DB_PATH=./data.db npm run start --workspace=packages/api
```

```bash
# Create a deal
curl -X POST http://localhost:3000/v1/deals \
  -H "Content-Type: application/json" \
  -d '{"borrower_name":"Acme Ltd","jurisdiction":"UK","requested_amount":500000,"purpose":"Working capital"}'

# List deals
curl http://localhost:3000/v1/deals

# Advance stage
curl -X POST http://localhost:3000/v1/deals/{id}/stage-transitions \
  -H "Content-Type: application/json" \
  -H "X-Actor: alice" \
  -d '{"to_stage":"origination"}'
```

## What It Does

Complete B2B lending lifecycle as a headless REST API:

1. **Broker** — Deal intake, document upload, initial data capture
2. **Origination** — Triage, qualification, risk assessment, entity graph modeling
3. **Underwriting** — Financial spreading, computed ratios (DSCR, leverage, margins), covenant structuring
4. **Closing** — Facility setup, approval workflows, loan accounts, disbursement
5. **Monitoring** — Bank transaction ingestion, liquidity analysis, covenant testing, breach detection, alerts

### Features

Deal lifecycle (5 stages) with stage guards and overrides. Document management. Immutable audit trail. Entity graph (companies, people, relationships). Financial spreading and ratios. Covenants with testing, grace periods, and waivers. Bank transaction monitoring. Liquidity analysis and alerts. Email ingestion. Facilities. Approval workflows. Loan ledger (Mambu-compatible). Chat interface (Slack, Teams).

## Design Principles

- **AI is a first-class citizen** — same APIs, audit trails, and permissions as humans
- **The AI explains; the system computes** — financial calculations are deterministic code, never delegated to AI
- **Immutable audit trail** — every mutation logs the actor (human or AI), timestamp, and field-level diffs
- **Headless by design** — no UI opinions; use any frontend, AI agent, CLI, or MCP client
- **Data sovereignty** — self-hosted, MIT licensed, no vendor lock-in
- **Zero external dependencies** — runs on SQLite in-memory by default, no Docker/Postgres/Redis required

## Project Structure

```
packages/
  core/           # Domain logic, services, database schema (28 tables)
  api/            # Hono HTTP server
  agent/          # AI agent orchestration
  chat/           # Slack & Teams interface
  cli/            # Command-line interface
  conformance/    # YAML-driven test suites
  mcp-server/     # Model Context Protocol server
  simulation/     # Lending scenario simulator

openapi/          # OpenAPI 3.1 spec
docs/             # Architecture docs, spec, manifesto
```

## Tech Stack

TypeScript (strict), Hono, Drizzle ORM, SQLite/LibSQL/PostgreSQL, Vitest.

## Environment Variables

See [`.env.example`](./.env.example) for the full list. Key variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `DB_PATH` | `:memory:` | SQLite database path |
| `ANTHROPIC_API_KEY` | — | For AI agent features |
| `SLACK_BOT_TOKEN` | — | Enables Slack chat |
| `TEAMS_APP_ID` | — | Enables Teams chat |

## Documentation

- [Product Spec](./docs/SPEC.md)
- [Manifesto](./docs/MANIFESTO.md)
- [AI Architecture](./docs/AI_NATIVE_ARCHITECTURE.md)
- [OpenAPI Spec](./openapi/v1.yaml)
- [Contributing](./CONTRIBUTING.md)
- [Security](./SECURITY.md)

## License

[MIT](./LICENSE)
