# AGENTS.md — Open LOS

> Open-source B2B Lending CRM. Headless API designed for AI-native workflows.

## Quick Links

- **UI Prototype**: Use [Primer](https://github.com/pierceboggan/primer.git) to scaffold a frontend
- **Flow Diagrams**: Use https://agents.craft.do/mermaid to diagram this application's flows

## Project Overview

Open LOS is a headless lending data platform that serves as the source of truth for B2B lending operations. It is designed to be operated equally by:

- **Humans** via a web UI
- **AI agents** via MCP (Model Context Protocol) or REST API
- **Automated systems** via webhooks and scheduled jobs

The platform does not contain AI "smarts" internally. Instead, it provides a complete, well-structured API that external AI tools can operate against.

### Key Insight

> The backend is like a **domain-aware database**. It knows what a valid stage transition is, computes ratios deterministically, enforces permissions, and logs everything. But it doesn't think—thinking happens in external AI environments that the user controls.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Language | TypeScript (strict mode) |
| HTTP framework | Hono |
| ORM | Drizzle (SQLite for tests, Postgres for prod) |
| Test runner | Vitest |
| Monorepo | npm workspaces |
| Node | >= 20 |

## Repository Structure

```
packages/
  core/           # Domain logic: schemas, state machine, computations
  api/            # Hono HTTP server, routes, middleware
  conformance/    # YAML test runner + conformance suites

openapi/          # OpenAPI v1.yaml
schemas/          # JSON Schema files (*.schema.json)

conformance/
  cases/          # YAML conformance test files
  fixtures/       # Fixture data (deals, templates, etc.)

docs/             # Architecture documentation
prompts/          # Per-phase Ralph loop prompts (if used)
```

## Setup

```bash
# Clone the repo
git clone <repo-url>
cd open-los

# Install dependencies
npm install

# Run tests (161 conformance tests)
npm test

# Start the API server
npm run start --workspace=packages/api

# Or with persistent database
DB_PATH=./data.db npm run start --workspace=packages/api
```

### Setting Up a UI with Primer

To scaffold a frontend for Open LOS:

```bash
git clone https://github.com/pierceboggan/primer.git
cd primer
npm install
```

Then connect it to the Open LOS API running on `http://localhost:3000`.

## Domain Model

### Deal Lifecycle (5 stages)

```
broker → origination → underwriting → closing → monitoring
```

| Stage | Purpose |
|-------|---------|
| **Broker** | Inbound portal, document upload, intake |
| **Origination** | Deal triage, qualification, assignment |
| **Underwriting** | Deep analysis, spreads, ratios, approval workflow |
| **Closing** | Doc generation, e-sign, covenant setup |
| **Monitoring** | Bank data ingestion, covenant testing, alerts |

### Core Objects

- **Deal** — A lending opportunity moving through stages
- **Entity** — Company or person (borrower, guarantor, director)
- **Relationship** — Links between entities (owns, guarantees, directs)
- **Document** — Uploaded files with versioning
- **Spread** — Structured financial statement with line items
- **Covenant** — Contractual tests (DSCR, leverage, liquidity)
- **Audit Event** — Immutable log of all mutations

## Coding Standards

### General

- Use `import type` for type-only imports
- Prefer named exports over default exports
- Use `const` by default; `let` only when mutation is needed
- No `any` types — use `unknown` and narrow
- IDs are UUIDs (v7 preferred for sortability)
- Timestamps are ISO 8601 UTC strings
- Money amounts are integers in minor units (cents/pence)

### API Responses

- All responses must match their JSON Schema in `schemas/`
- Error types must match `schemas/error.schema.json`
- Include `_context` hints for AI consumption (available actions, warnings)

### Mutations

- All mutations must produce audit events
- Stage transitions must go through the stage machine (no direct DB updates to `stage`)
- Every mutation records who did it (human or AI), when, and what changed

## Test Commands

```bash
# Full test suite
npm test

# Conformance tests only
npm run test:conformance

# Smoke tests only (fast, CI gate)
npm run test:smoke

# Type checking
npm run typecheck

# Watch mode
npm run dev --workspace=packages/api
```

## Conformance Test DSL

Tests in `conformance/cases/*.yaml` use a YAML DSL:

```yaml
name: "Deal stage transition"
arrange:
  tenant: { id: "t1" }
  deals:
    - id: "d1"
      borrower_name: "Acme Ltd"
      stage: "broker"

steps:
  - name: "Transition to origination"
    request:
      method: POST
      path: /v1/deals/d1/stage-transitions
      headers:
        X-Actor: alice
      body:
        to_stage: origination
    expect:
      status: 200
      body:
        from_stage: broker
        to_stage: origination
```

The conformance runner starts a fresh server + SQLite DB per test file.

## Key Invariants

1. **Every mutation produces an immutable audit event**
2. **Stage transitions are guarded by the state machine**
3. **Covenants and ratios are deterministic** (no AI in computation path)
4. **Templates render to Markdown** with mustache variable injection
5. **All API responses validate against their JSON Schema**
6. **Time is injectable** (tests freeze time via `meta.now`)

## Time Injection

All services accept a `getNow: () => string` function for testability.

```typescript
// In tests
const fixedTime = "2024-01-15T10:00:00Z";
const { app } = await createAppWithDb(() => fixedTime);

// In production
const getNow = () => new Date().toISOString();
```

## API Design for AI Consumption

### Actor Identification

Every request identifies the actor via headers:

```
X-Actor: alice@lender.com
X-Actor-Type: human
X-Tenant-Id: tenant_123
```

For AI agents:
```
X-Actor: claude-code
X-Actor-Type: ai
X-Actor-AI-Provider: anthropic
X-Actor-Session: session_abc123
```

### Response Format

Responses include contextual hints for AI reasoning:

```json
{
  "data": { ... },
  "_context": {
    "available_actions": [
      { "tool": "deal.transition_stage", "description": "Move to underwriting" }
    ],
    "warnings": [
      { "code": "MISSING_GUARANTOR", "message": "No personal guarantor linked" }
    ],
    "related": [
      { "resource": "deal://deal_abc123/documents" }
    ]
  }
}
```

## MCP Integration

Open LOS exposes tools via MCP for AI agents:

| Tool Category | Examples |
|---------------|----------|
| **Deal lifecycle** | `deal.create`, `deal.get`, `deal.transition_stage` |
| **Documents** | `document.upload`, `document.read`, `document.classify` |
| **Financial** | `spread.create`, `covenant.create`, `covenant.test` |
| **Monitoring** | `monitoring.ingest`, `monitoring.status` |
| **Analytics** | `analytics.pipeline`, `analytics.transactions` |

### Local MCP Setup

```json
// .mcp.json
{
  "mcpServers": {
    "open-los": {
      "command": "npx",
      "args": ["tsx", "packages/mcp-server/src/server.ts"],
      "env": {
        "OPEN_LOS_DB_PATH": "./data/dev.db"
      }
    }
  }
}
```

## Architectural Principles

1. **Backend as Source of Truth** — All state lives in Open LOS. AI tools read/write to this single source.

2. **Humans and AI Are Equal Actors** — The API makes no distinction beyond audit tagging.

3. **Determinism Where It Matters** — Financial computations are reproducible. AI can explain outputs but never computes them.

4. **Rich Context for AI Consumption** — API responses include hints about what actions are available and what's blocking progress.

5. **Audit Everything** — Every mutation records who did it, when, and what changed.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `DB_PATH` | `:memory:` | SQLite database path |

## Commit Style

- Conventional commits: `feat:`, `fix:`, `test:`, `chore:`
- One logical change per commit
- Tests must pass before committing

## PR Workflow for Claude Code Sessions

All Claude Code sessions automatically create and merge PRs via GitHub Actions:

### How It Works

1. **Branch naming**: Claude Code sessions use branches named `claude/*`
2. **Auto-PR creation**: When you push to a `claude/*` branch, a PR is automatically created
3. **CI validation**: The PR runs tests, linting, and type checking
4. **Auto-merge**: If CI passes, the PR is automatically squash-merged to main

### GitHub Actions Workflows

| Workflow | File | Purpose |
|----------|------|---------|
| CI | `.github/workflows/ci.yml` | Runs tests on PRs and main |
| Auto PR | `.github/workflows/auto-pr.yml` | Creates PRs from `claude/*` branches and enables auto-merge |

### Requirements for Auto-Merge

For auto-merge to work, you must enable it in your GitHub repository settings:

1. Go to **Settings** → **General** → **Pull Requests**
2. Check **Allow auto-merge**
3. Optionally, set up **Branch protection rules** on `main` to require status checks

### Manual Override

If you want to review a PR before merging:
- Disable auto-merge on the specific PR in GitHub
- Or remove the `--auto` flag from the workflow for all PRs

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
| MCP server | 🚧 Planned |
| Analytics endpoints | 🚧 Planned |

## Documentation

- [SPEC.md](./SPEC.md) — Full product specification
- [openapi/v1.yaml](./openapi/v1.yaml) — API contract
- [docs/AI_NATIVE_ARCHITECTURE.md](./docs/AI_NATIVE_ARCHITECTURE.md) — AI integration architecture
- [docs/principles-and-ideas.md](./docs/principles-and-ideas.md) — Design principles
