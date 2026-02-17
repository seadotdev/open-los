# Open LOS

Open-source B2B Lending CRM — headless API first.

## LLM Context Outlines

Copy-paste these into LLM chats to give context about this project.

### One-liner

```
Open LOS is an open-source, headless, API-first B2B loan origination system (LOS) built in TypeScript. It manages the full lending lifecycle — from broker intake through underwriting, closing, and post-close monitoring — with immutable audit trails, deterministic financial calculations, and first-class AI/agent support via REST APIs.
```

### Short summary

```
Open LOS is an open-source B2B loan origination system (MIT licensed).

Tech stack: TypeScript, Hono (HTTP), Drizzle ORM, SQLite/LibSQL, Vitest. Monorepo with npm workspaces.

Key packages:
- packages/core — domain logic, services, database schema (28 tables via Drizzle)
- packages/api — Hono REST API server (v1 endpoints)
- packages/conformance — YAML-driven integration tests (161+ cases)
- packages/agent — AI agent orchestration layer
- openapi/v1.yaml — OpenAPI 3.1 spec
- schemas/ — JSON Schema definitions

Deal lifecycle stages: Broker → Origination → Underwriting → Closing → Monitoring

Core features: deal management, stage machine with guards, entity graph (companies/people/relationships), document management, financial spreading & ratios, covenants (tests/grace periods/waivers), facilities & loan accounts (Mambu-compatible ledger), bank transaction monitoring, liquidity alerts, email ingestion, approval workflows, sandboxes for AI analysis, immutable audit trail, multi-tenancy.

Design principles: headless API-first, AI and humans as equal API consumers, deterministic financial computations (never delegated to AI), immutable audit trails, zero external dependencies by default (runs on SQLite in-memory).
```

### Detailed technical summary

````
Open LOS — Open-source B2B Loan Origination System

## What it is
A headless, API-first loan origination platform. MIT licensed. Designed so AI agents and humans are equal consumers of the same REST API. All financial calculations are deterministic (computed by the system, never by AI). Every mutation is logged in an immutable audit trail.

## Tech stack
- Language: TypeScript (strict mode)
- HTTP framework: Hono
- ORM: Drizzle (type-safe, SQLite/LibSQL)
- Database: SQLite in-memory (default) or file-based SQLite / LibSQL (Turso) in production
- Tests: Vitest + YAML-driven conformance tests (161+ cases)
- Monorepo: npm workspaces

## Project structure
```
packages/
  core/           # Domain services (20+), DB schema (28 tables via Drizzle)
  api/            # Hono HTTP server, REST routes (15 route files)
  conformance/    # YAML-driven integration test runner
  agent/          # AI agent orchestration layer (outcome-oriented interface)
  cli/            # Command-line interface
  simulation/     # Business scenario testing
  experiments/    # LLM model comparison harness
frontend/         # Two static UI prototypes (experimental feed-based + traditional)
schemas/          # JSON Schema definitions
openapi/          # OpenAPI 3.1 spec (v1.yaml)
conformance/      # YAML test cases and fixtures
docs/             # SPEC.md, MANIFESTO.md, AGENTS.md, architecture docs
```

## Deal lifecycle (stage machine)
Broker → Origination → Underwriting → Closing → Monitoring
Each transition has guards (required fields, documents, outcomes) and is logged with actor + rationale.

## Core domain services
- Deals — create, update, list with stage tracking and custom fields
- Entities — companies and people with identifiers (LEI, registration numbers)
- Relationships — ownership (with %), guarantees, directorships as a graph
- Documents — upload, version, classify; email attachment extraction
- Spreads — financial statement line items with computed ratios (EBITDA, DSCR, Debt/EBITDA, ROE)
- Covenants — financial/reporting/information covenants; test against metrics; grace periods and waivers
- Facilities — structured loan products with terms (amount, rate, tenure, repayment type)
- Loan accounts — full lifecycle (APPROVED → ACTIVE → ARREARS → CLOSED), disbursements, repayments, fees, repayment schedule
- Monitoring — bank transaction ingestion, liquidity/runway calculation, covenant breach detection, alerts
- Email — parse inbound emails, extract attachments, link to deals
- Approvals — approval requests with decisions and rationale
- Sandboxes — isolated version-controlled environments for AI analysis
- Audit — immutable event log of every mutation (actor, timestamp, object_type, changes)

## API shape (REST, JSON, base path /v1)
- Headers: X-Actor (required for audit), X-Tenant-Id (multi-tenancy)
- Pagination: limit + cursor
- Amounts: stored in minor units (cents/pence)
- Errors: { error: { code, message, details, retryable } }
- Key endpoints: /deals, /entities, /documents, /facilities, /loans, /covenants, /monitoring, /sandboxes, /audit, /email/intake, /templates

## Running it
npm install && npm test                              # install + run 161 conformance tests
npm run start --workspace=packages/api               # start on :3000 (in-memory DB)
DB_PATH=./data.db npm run start --workspace=packages/api  # persistent SQLite

## Environment variables
PORT (default 3000), DB_PATH (default :memory:), CORS_ORIGINS
````

## Purpose

This repo serves two purposes:

1. **Capture ideas** — Ideas should go into `/docs`, either appended to an existing doc where they clearly fit, or as a new doc.
2. **Iterate the codebase** — Build and improve the actual code.

If a request is obviously about capturing an idea rather than changing code, skip straight to #1.

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

- [SPEC.md](./docs/SPEC.md) — Product specification
- [AGENTS.md](./docs/AGENTS.md) — Agent instructions and coding standards
- [MANIFESTO.md](./docs/MANIFESTO.md) — Project manifesto
- [openapi/v1.yaml](./openapi/v1.yaml) — API contract
- [docs/AI_NATIVE_ARCHITECTURE.md](./docs/AI_NATIVE_ARCHITECTURE.md) — AI integration architecture
- [docs/auto-docs/](./docs/auto-docs/) — Auto-documentation system

## Auto-Documentation System

Open LOS includes a comprehensive self-documenting system that automatically generates customer-facing content for every change.

### What Gets Generated

| Content Type | Trigger | Purpose |
|-------------|---------|---------|
| **Release Logs** | Every commit | Technical changelog entries |
| **Blog Posts** | Feature commits | Customer-facing impact articles |
| **Social Media** | Every release | Twitter, LinkedIn, Discord content |
| **Video Scripts** | Features/releases | Demo script prompts |
| **Feature Demos** | New features | CLI/UI motion demo specs |
| **Migration Guides** | Breaking changes | Upgrade documentation |

### Quick Start

```bash
# Install documentation git hooks
./docs/auto-docs/scripts/install-hooks.sh

# Generate all documentation for current commit
npm run docs:generate

# Generate specific documentation type
npm run docs:release-log
npm run docs:blog
npm run docs:social
npm run docs:video
npm run docs:demo

# Generate version bump documentation
npm run docs:version-bump -- --version 1.0.0
```

### How It Works

1. **Post-Commit Hook**: Automatically generates release logs after each commit
2. **Pre-Push Hook**: Validates documentation exists before pushing (warns for missing docs)
3. **PR Requirements**: Feature commits should have blog post drafts
4. **Version Bumps**: Major/minor versions trigger full documentation suite

### Generated Content Location

```
docs/auto-docs/generated/
├── releases/       # Release logs per commit
├── blog/           # Blog post drafts
├── social/         # Social media content
├── videos/         # Video scripts
├── demos/          # Feature demo specs
├── migrations/     # Migration guides
└── announcements/  # Version announcements
```

### Templates

Customize documentation output by editing templates in `docs/auto-docs/templates/`:

- `release-log.md` — Technical changelog format
- `blog-post.md` — Customer blog article structure
- `social-tweet.md` — Multi-platform social content
- `video-script.md` — Short/long-form video scripts
- `feature-demo.md` — CLI/UI demo specifications

### Configuration

Edit `docs/auto-docs/config.json` to customize:
- Which documentation types to generate
- Hook behavior and requirements
- Social media platforms and hashtags
- Video and demo specifications

### Building in Public

This auto-documentation system enables "building in public" by ensuring:

- Every change is communicated to customers
- Technical updates are translated to business value
- Social presence is maintained automatically
- Video content is always scripted and ready
- Breaking changes are properly documented

## License

MIT
