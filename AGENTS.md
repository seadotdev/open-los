# AGENTS.md — Open LOS

## Project

Open-source B2B Lending CRM. Headless API built test-first from a conformance suite.

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
  core/       # Domain logic: schemas, state machine, computations
  api/        # Hono HTTP server, routes, middleware
  conformance/# YAML test runner + conformance suites
openapi/      # OpenAPI v1.yaml
schemas/      # JSON Schema files (*.schema.json)
conformance/
  cases/      # YAML conformance test files
  fixtures/   # Fixture data (deals, templates, etc.)
prompts/      # Per-phase Ralph loop prompts
```

## Coding Standards

- Use `import type` for type-only imports
- Prefer named exports over default exports
- Use `const` by default; `let` only when mutation is needed
- No `any` types — use `unknown` and narrow
- Error types must match `schemas/error.schema.json`
- All API responses must match their JSON Schema
- All mutations must produce audit events
- State transitions must go through the stage machine (no direct DB updates to `stage`)
- IDs are UUIDs (v7 preferred for sortability)
- Timestamps are ISO 8601 UTC strings
- Money amounts are integers in minor units (cents/pence)

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
```

## Conformance Test DSL

Tests in `conformance/cases/*.yaml` use a YAML DSL with:
- `arrange` — seed data (tenant, users, entities)
- `steps` — sequential HTTP calls with `expect` blocks
- `assertions` — final state checks

The conformance runner starts a fresh server + SQLite DB per test file.

## Key Invariants

1. Every mutation produces an immutable audit event
2. Stage transitions are guarded by the state machine
3. Covenants and ratios are deterministic (no AI in computation path)
4. Templates render to Markdown with mustache variable injection
5. All API responses validate against their JSON Schema
6. Time is injectable (tests freeze time via `meta.now`)

## Time Injection

All services accept a `getNow: () => string` function for testability.

In tests:
```typescript
const fixedTime = "2024-01-15T10:00:00Z";
const { app } = await createAppWithDb(() => fixedTime);
```

In production, use `() => new Date().toISOString()`.

This pattern allows:
- Deterministic test execution (same timestamps every run)
- Testing time-dependent logic (grace periods, expiration)
- Consistent audit event timestamps within a test

## Commit Style

- Conventional commits: `feat:`, `fix:`, `test:`, `chore:`
- One logical change per commit
- Tests must pass before committing
