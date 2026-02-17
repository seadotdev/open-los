# Open LOS

Open-source B2B Lending CRM — headless API first.

## LLM Context Outlines

Copy-paste these into LLM chats to give context about this project. Three versions at different lengths.

### One-liner

```
Open LOS is an open-source, AI-native loan origination system for B2B lenders. It replaces legacy platforms like nCino/Salesforce with a headless API that AI agents and humans operate equally — handling the full lending lifecycle from broker intake through monitoring, with deterministic financial calculations and immutable audit trails. MIT licensed, TypeScript, zero external dependencies.
```

### Short summary

```
Open LOS is an open-source B2B loan origination system (MIT licensed, TypeScript).

The problem it solves: Enterprise lending software (nCino, Mambu, Temenos) was built for humans clicking through forms. These vendors are now restricting API access as AI threatens their moats. Lenders are locked into expensive platforms they can't extend, can't integrate AI into, and can't leave.

What Open LOS does: Provides the complete lending lifecycle as a headless REST API that AI agents and humans consume equally:
- Broker intake and deal triage
- Multi-entity underwriting with financial spreading and ratio computation
- Covenant structuring, automated testing, grace periods, and waivers
- Facility setup, loan accounts, disbursements, repayments, arrears tracking
- Post-close monitoring via bank transaction ingestion, liquidity analysis, and alerts

Key design decisions:
- AI is a first-class citizen, not an afterthought — same APIs, same audit trails, same permissions as humans
- Financial calculations are deterministic and computed by the system, never by AI — the AI explains, the system computes
- Immutable audit trail on every mutation — who did it (human or AI), when, and what changed
- Data sovereignty — you host it, you own the data, no vendor lock-in
- Zero external dependencies — runs on SQLite in-memory by default

Who it's for: Fintechs, credit unions, and emerging lenders who need modern lending infrastructure but can't afford or don't want enterprise vendor lock-in. The "next JPMorgan" — too small for incumbents to care about, too ambitious to stay small.

Tech: TypeScript, Hono, Drizzle ORM, SQLite/LibSQL. Monorepo. 161+ conformance tests. OpenAPI 3.1 spec.
```

### Detailed summary

````
Open LOS — Open-source AI-native Loan Origination System

## Why it exists
Enterprise lending software (nCino on Salesforce, Mambu, Temenos) was built for a world where humans typed data into forms. These platforms are now actively restricting API access as AI threatens to make their UIs irrelevant. Open LOS asks: what would lending software look like if built for the AI era from day one?

## What it does
Complete B2B lending lifecycle as a headless REST API:

1. Broker — Inbound deal intake, document upload, initial data capture
2. Origination — Deal triage, qualification, early risk assessment, entity graph modeling
3. Underwriting — Financial spreading (P&L, balance sheet → computed ratios like DSCR, leverage, margins), multi-entity analysis, covenant structuring, scenario analysis via sandboxes
4. Closing — Facility setup (loan terms, rates, schedules), approval workflows, loan account creation, disbursement
5. Monitoring — Bank transaction ingestion, liquidity/runway analysis, automated covenant testing, breach detection, alerts, arrears tracking

## Core architecture principles
- Humans and AI are equal actors — same REST API, same permissions, same audit trail
- The AI explains; the system computes — financial calculations (ratios, covenant tests, liquidity) are deterministic code, never delegated to AI. Eliminates hallucination risk for numbers that matter
- Immutable audit trail — every mutation logs the actor (human or AI, including model and session), timestamp, and field-level diffs. When a regulator asks "why was this loan approved?", there's an answer
- Headless by design — no UI opinions. Use any frontend, AI agent, CLI, or MCP client
- Data sovereignty — self-hosted, MIT licensed. Your data never leaves your infrastructure. Switch AI providers at will

## Who it's for
- Fintechs needing loan origination without Salesforce pricing
- Credit unions wanting modern software with a small IT team
- Emerging lenders building competitive advantage through AI-native operations
- Anyone told "you need enterprise software to do serious lending" who suspects that's no longer true

## Strategic position
Exploits five moats being destroyed at incumbents (learned interfaces, hardcoded workflows, talent scarcity, bundling lock-in, data access barriers) while building on five moats that hold (regulatory compliance, transaction embedding, system of record status, network effects, proprietary customer data enablement).

Passes the vertical software durability test: proprietary data (enables customer's data sovereignty), regulatory lock-in (immutable audit trails satisfy examiner requirements), transaction embedded (loan ledger sits in the actual flow of money from lender to borrower).

## Technical shape
- Stack: TypeScript (strict), Hono HTTP framework, Drizzle ORM, SQLite/LibSQL
- Monorepo: packages/core (domain services, 28-table schema), packages/api (REST routes), packages/conformance (YAML-driven tests), packages/agent (AI orchestration)
- API: REST JSON, OpenAPI 3.1 spec, X-Actor header for audit, X-Tenant-Id for multi-tenancy
- Tests: 161+ YAML conformance tests covering the full deal lifecycle
- Run: npm install && npm test && npm run start --workspace=packages/api
- Zero external dependencies by default — runs on SQLite in-memory, no Docker/Postgres/Redis required
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
