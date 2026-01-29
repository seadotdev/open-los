# Phase 2: Stages + Audit — Suites 01-02

## Completion Promise

When all tests in suites 00, 01, and 02 pass, output exactly: `STAGES AUDIT PASSING`

## Context

You are continuing work on the Open LOS — an open-source B2B Lending CRM.

Phase 1 is complete. The smoke slice (suite 00) passes. You have:
- Monorepo with `packages/core`, `packages/api`, `packages/conformance`
- Drizzle + SQLite DB with deals, documents, audit_events, stage_transitions tables
- Hono API server with deal CRUD, document upload, basic stage transitions, audit log
- YAML conformance test runner

Read these files to understand what exists:
- `AGENTS.md` — coding standards
- `openapi/v1.yaml` — API contract
- `schemas/*.schema.json` — JSON schemas
- `conformance/cases/00_smoke.yaml` — existing passing tests (don't break these)
- `conformance/cases/01_stages.yaml` — stage machine tests to pass
- `conformance/cases/02_audit.yaml` — audit tests to pass

Explore `packages/core/src/` and `packages/api/src/` to understand the existing code.

## What to Build

### 1. Full 5-Stage State Machine

Extend StageService to support all transitions:

```
broker → origination → underwriting → closing → monitoring
```

**Valid transitions (forward only):**
- broker → origination
- origination → underwriting
- underwriting → closing
- closing → monitoring

**Invalid transitions (must reject with INVALID_TRANSITION):**
- Skipping stages (broker → underwriting)
- Going backwards (origination → broker)
- Same stage (broker → broker)

### 2. Role-Based Transition Permissions

Each transition requires a specific role:
- broker → origination: `originator` or `credit_lead`
- origination → underwriting: `underwriter` or `credit_lead`
- underwriting → closing: `closer` or `credit_lead`
- closing → monitoring: `monitor` or `credit_lead`

If the actor doesn't have the required role, return 403 with code `FORBIDDEN`.

### 3. Origination Outcomes

Deals in `origination` stage can have an outcome set via `PATCH /v1/deals/:id`:
- `reject` — blocks all further transitions
- `need_info` — informational, deal stays in origination
- `proceed` — required to transition to underwriting
- `refer` — escalated to credit lead

**Guard for origination → underwriting:** `origination_outcome` must be `proceed`.

### 4. Override Mechanism

A `credit_lead` can override a blocked transition by sending:
```json
{
  "to_stage": "underwriting",
  "override": true,
  "override_rationale": "Approved by committee despite missing proceed outcome"
}
```

Rules:
- Only `credit_lead` role can use override
- Override requires `override_rationale` (non-empty string)
- Override without rationale returns 400

### 5. Stage Guards (Checklist)

Each transition has entry guards. If guards fail, return 409 with `STAGE_GUARD_FAILED`.

**broker → origination guards:**
- borrower_name must be set
- jurisdiction must be set
- requested_amount must be set
- purpose must be set

**origination → underwriting guards:**
- origination_outcome must be "proceed" (unless override)
- At least 1 document uploaded

**underwriting → closing guards:**
- Deal must be in underwriting stage (general rule for all transitions)

**closing → monitoring guards:**
- Deal must be in closing stage

### 6. Checklist Snapshot

Stage transition response includes `checklist_snapshot`: an array of `{item, satisfied}` objects showing what was checked.

### 7. Enhanced Audit Service

**Field-level diffs on DEAL_UPDATED:**
When a deal is PATCHed, the audit event's `changes` array must include:
```json
{
  "field": "purpose",
  "before": "Working capital",
  "after": "Expansion"
}
```

For each field that changed, record before and after values.

**Audit pagination:**
- `GET /v1/deals/:id/audit?limit=N` — limit results
- `GET /v1/deals/:id/audit?cursor=X` — cursor-based pagination
- Response includes `total` count and `cursor` for next page

**Audit filtering:**
- `?type=DEAL_UPDATED` — filter by event type
- `?actor=u_broker` — filter by actor
- Combined filters work

**Audit ordering:**
- Events returned in chronological order (oldest first)

**Audit immutability:**
- No PATCH or DELETE endpoints for audit events
- Existing events are never modified

## Test Command

```bash
npm run test:conformance
```

This should run suites 00, 01, and 02. All must pass.

## Key Rules

1. Don't break suite 00 (smoke tests must still pass)
2. All responses validate against JSON schemas
3. All mutations produce audit events with field-level diffs
4. Error codes: VALIDATION_ERROR, NOT_FOUND, STAGE_GUARD_FAILED, INVALID_TRANSITION, FORBIDDEN, OVERRIDE_REQUIRED
5. Override is only available to credit_lead role
6. Stage transitions are the only way to change deal.stage

## Done Criteria

All tests in suites 00, 01, and 02 pass (~50 tests). Output: `STAGES AUDIT PASSING`
