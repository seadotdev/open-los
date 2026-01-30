# Phase 1: Smoke Slice — Foundation + Suite 00

## Completion Promise

When all tests pass, output exactly: `SMOKE PASSING`

## Context

You are building the Open LOS — an open-source B2B Lending CRM, headless API first.

Read these files to understand the project:
- `AGENTS.md` — coding standards, tech stack, structure
- `SPEC.md` — full product spec (reference, don't implement everything)
- `openapi/v1.yaml` — API contract
- `schemas/*.schema.json` — JSON schemas for all objects
- `conformance/cases/00_smoke.yaml` — the tests you must pass

## What to Build

### 1. Monorepo Structure

```
packages/
  core/          # Domain logic
    src/
      schema/    # Drizzle DB schema
      services/  # Deal, Document, Audit services
    package.json
    tsconfig.json
  api/           # Hono HTTP server
    src/
      routes/    # Route handlers
      middleware/ # Auth, error handling, CORS
      server.ts  # Entry point
    package.json
    tsconfig.json
  conformance/   # Test runner
    src/
      runner.ts  # YAML test runner
      helpers.ts # HTTP client, assertion helpers
    package.json
    tsconfig.json
```

### 2. Database (Drizzle + SQLite)

Create the Drizzle schema for:
- `deals` table — id (uuid), tenant_id, borrower_name, borrower_registration_number, jurisdiction, requested_amount (integer), purpose, stage (text, default "broker"), origination_outcome, assigned_to, primary_entity_id, custom_fields (json), created_at, updated_at
- `documents` table — id, deal_id (FK), doc_type, phase, filename, label, mime_type, size_bytes, checksum, content (blob), version (integer), created_at, created_by
- `audit_events` table — id, deal_id (FK), type, actor, timestamp, object_type, object_id, changes (json), metadata (json)
- `stage_transitions` table — id, deal_id (FK), from_stage, to_stage, actor, rationale, override (boolean), override_rationale, checklist_snapshot (json), transitioned_at

Use SQLite for all tests. IDs are UUIDs (generate with crypto.randomUUID() or uuidv7).

### 3. Core Services

**DealService:**
- `create(input)` — validate required fields (borrower_name), set stage="broker", emit DEAL_CREATED audit
- `getById(id)` — return deal or throw NotFound
- `update(id, changes)` — patch fields, emit DEAL_UPDATED audit with field-level diffs (before/after)
- `list(filters)` — paginated list with cursor support

**DocumentService:**
- `upload(dealId, input)` — store document, emit DOCUMENT_UPLOADED audit
- `listByDeal(dealId)` — list documents for a deal

**AuditService:**
- `record(event)` — insert immutable audit event
- `listByDeal(dealId, filters)` — paginated, filterable audit events

**StageService:**
- `transition(dealId, toStage, actor, options)` — validate transition is allowed (broker→origination only for now), check guards, record transition, update deal stage, emit STAGE_TRANSITION audit
- Basic guard for broker→origination: borrower_name, jurisdiction, requested_amount, purpose must be set

### 4. API Routes (Hono)

Map to `openapi/v1.yaml`:
- `POST /v1/deals` — createDeal
- `GET /v1/deals` — listDeals
- `GET /v1/deals/:dealId` — getDeal
- `PATCH /v1/deals/:dealId` — updateDeal
- `POST /v1/deals/:dealId/stage-transitions` — transitionStage
- `POST /v1/deals/:dealId/documents` — uploadDocument (JSON body with content_base64 for now)
- `GET /v1/deals/:dealId/documents` — listDocuments
- `GET /v1/deals/:dealId/audit` — listAuditEvents

### 5. Middleware

- Error handler: catch errors, return `schemas/error.schema.json` format
- Actor extraction: read `X-Actor` header (or use actor from test DSL)
- CORS: permissive for development
- JSON body parsing

### 6. Conformance Test Runner

Build a Vitest-based runner that:
1. Reads `conformance/cases/00_smoke.yaml`
2. For each test (separated by `---`):
   a. Reset DB (fresh SQLite in-memory)
   b. Seed users/tenant from `arrange`
   c. Execute `steps` sequentially
   d. For each step: make HTTP request, check `expect` (status, json_contains, json_schema, json_path_assertions)
   e. Support `save` to capture values from responses for variable substitution (`${deal_id}`)
3. Report pass/fail per test

### 7. Package Scripts

Each package needs:
- `npm run build` — tsc
- `npm run test` — vitest
- `npm run typecheck` — tsc --noEmit

Root:
- `npm test` — runs all workspace tests
- `npm run test:smoke` — runs conformance smoke suite only

## Key Rules

1. All responses must validate against their JSON Schema
2. All mutations produce audit events
3. Error responses use `schemas/error.schema.json` format with codes: VALIDATION_ERROR, NOT_FOUND, STAGE_GUARD_FAILED
4. Stage transitions go through StageService (never update stage directly)
5. Audit events are immutable (no update/delete)
6. Time is injectable — use a `now` parameter or injectable clock for tests

## Test Command

```bash
cd packages/conformance && npx vitest run
```

Or from root:
```bash
npm run test:smoke
```

## Done Criteria

All 10 tests in `conformance/cases/00_smoke.yaml` pass. Output: `SMOKE PASSING`
