# Open LOS

Open-source, AI-native loan origination system for B2B lenders. Headless REST API that AI agents and humans operate equally.

Replaces legacy platforms (nCino, Mambu, Temenos) with modern infrastructure: deterministic financial calculations, immutable audit trails, and zero vendor lock-in.

## Quick Start

```bash
npm install
npm test                                    # 161 conformance tests
npm run start --workspace=packages/api      # Start API server

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

## What It Does

Complete B2B lending lifecycle as a headless REST API:

1. **Broker** — Inbound deal intake, document upload, initial data capture
2. **Origination** — Deal triage, qualification, early risk assessment, entity graph modeling
3. **Underwriting** — Financial spreading (P&L, balance sheet computed ratios), multi-entity analysis, covenant structuring
4. **Closing** — Facility setup, approval workflows, loan account creation, disbursement
5. **Monitoring** — Bank transaction ingestion, liquidity analysis, automated covenant testing, breach detection, alerts

## Design Principles

- **AI is a first-class citizen** — same APIs, audit trails, and permissions as humans
- **The AI explains; the system computes** — financial calculations are deterministic code, never delegated to AI
- **Immutable audit trail** — every mutation logs the actor (human or AI), timestamp, and field-level diffs
- **Headless by design** — no UI opinions; use any frontend, AI agent, CLI, or MCP client
- **Data sovereignty** — self-hosted, MIT licensed, no vendor lock-in
- **Zero external dependencies** — runs on SQLite in-memory by default, no Docker/Postgres/Redis required

## Features

| Feature | Status |
|---------|--------|
| Deal lifecycle (5 stages) | Done |
| Stage guards & overrides | Done |
| Document management | Done |
| Audit trail (immutable) | Done |
| Entity graph (companies, people, relationships) | Done |
| Financial spreading & ratios | Done |
| Covenants (tests, grace periods, waivers) | Done |
| Bank transaction monitoring | Done |
| Liquidity & alerts | Done |
| Email ingestion | Done |
| Facilities | Done |
| Approval workflow | Done |
| Loan ledger (Mambu-compatible) | Done |
| Chat interface (Slack, Teams) | Done |

## Project Structure

```
packages/
  core/           # Domain logic, services, database schema (28 tables)
  api/            # Hono HTTP server
  agent/          # AI agent orchestration layer
  chat/           # Chat interface (Slack, Teams)
  cli/            # Command-line interface
  conformance/    # YAML-driven test suites (161+ tests)
  mcp-server/     # Model Context Protocol server
  simulation/     # Lending scenario simulator
  shadow/         # Shadow comparison system
  shadow-cli/     # Shadow CLI

schemas/          # JSON Schema definitions
conformance/      # Test cases and fixtures
openapi/          # OpenAPI 3.1 spec
docs/             # Architecture documentation
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript (strict mode) |
| HTTP | Hono |
| ORM | Drizzle |
| Database | SQLite (default), LibSQL, PostgreSQL |
| Testing | Vitest, YAML conformance suites |
| AI | Anthropic SDK, OpenAI SDK |
| Chat | Slack, Microsoft Teams |

## Chat Interface (Slack & Teams)

Control Open LOS from Slack or Microsoft Teams. Set platform credentials and the bot mounts automatically:

```bash
# Enable Slack
SLACK_BOT_TOKEN=xoxb-... SLACK_SIGNING_SECRET=... npm run start --workspace=packages/api

# Enable Teams
TEAMS_APP_ID=... TEAMS_APP_PASSWORD=... npm run start --workspace=packages/api
```

Available commands: `/los-deals`, `/los-deal <id>`, `/los-new-deal`, `/los-advance <id>`, `/los-portfolio`. See [packages/chat/README.md](./packages/chat/README.md) for details.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `DB_PATH` | `:memory:` | SQLite database path |
| `ANTHROPIC_API_KEY` | — | Claude API key (for AI agent features) |
| `OPENAI_API_KEY` | — | OpenAI API key (for AI agent features) |
| `SLACK_BOT_TOKEN` | — | Slack bot token (enables Slack chat) |
| `SLACK_SIGNING_SECRET` | — | Slack request signing secret |
| `TEAMS_APP_ID` | — | Teams app ID (enables Teams chat) |
| `TEAMS_APP_PASSWORD` | — | Teams app password |
| `REDIS_URL` | — | Redis URL for chat state (optional) |

## Development

```bash
npm run build                                           # Type check
npx vitest run packages/conformance/src/smoke.test.ts   # Run specific test suite
npm run dev --workspace=packages/api                    # Watch mode
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.

## Documentation

- [SPEC.md](./docs/SPEC.md) — Product specification
- [MANIFESTO.md](./docs/MANIFESTO.md) — Project manifesto
- [AI_NATIVE_ARCHITECTURE.md](./docs/AI_NATIVE_ARCHITECTURE.md) — AI integration architecture
- [openapi/v1.yaml](./openapi/v1.yaml) — API contract (OpenAPI 3.1)
- [AGENTS.md](./docs/AGENTS.md) — Agent instructions and coding standards

## Who It's For

- Fintechs needing loan origination without Salesforce pricing
- Credit unions wanting modern software with a small IT team
- Emerging lenders building competitive advantage through AI-native operations

## License

[MIT](./LICENSE)
