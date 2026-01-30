# Phase 3: Entities + Templates — Suites 03-04

## Completion Promise

When all tests in suites 00-04 pass, output exactly: `ENTITIES TEMPLATES PASSING`

## Context

You are continuing work on the Open LOS — an open-source B2B Lending CRM.

Phase 2 is complete. Suites 00 (smoke), 01 (stages), 02 (audit) pass. You have:
- Full 5-stage state machine with guards, role-based permissions, overrides
- Field-level audit diffs, pagination, filtering
- Deal CRUD, document upload, stage transitions

Read these files:
- `AGENTS.md` — coding standards
- `openapi/v1.yaml` — API contract (entities, relationships, templates, artifacts sections)
- `schemas/entity.schema.json`, `schemas/relationship.schema.json`, `schemas/template.schema.json`
- `conformance/cases/03_templates.yaml` — template tests to pass
- `conformance/cases/04_entity_graph.yaml` — entity graph tests to pass
- `conformance/fixtures/templates/credit_memo.md` — template fixture
- `conformance/fixtures/templates/term_sheet.md` — template fixture

Explore `packages/core/src/` and `packages/api/src/` to understand existing code.

## What to Build

### 1. Entity Table + Service

**Drizzle schema — `entities` table:**
- id (uuid PK)
- tenant_id
- type (text: "company" | "person")
- name (text, required)
- legal_name (text)
- registration_number (text)
- lei (text)
- jurisdiction (text)
- identifiers (json — array of {scheme, value, authority, confidence})
- created_at, updated_at

**EntityService:**
- `create(input)` — validate type is company|person, name required. Emit ENTITY_CREATED audit event.
- `getById(id)` — return entity or throw NotFound
- `update(id, changes)` — update fields (type cannot be changed after creation). Emit ENTITY_UPDATED audit with field diffs.
- `list(filters)` — filter by type

### 2. Relationship Table + Service

**Drizzle schema — `relationships` table:**
- id (uuid PK)
- from_entity_id (FK → entities)
- to_entity_id (FK → entities)
- type (text: "owns" | "guarantees" | "directs")
- ownership_pct (real, 0-100, nullable)
- metadata (json)
- created_at

**RelationshipService:**
- `create(input)` — validate both entities exist, validate type, validate ownership_pct range. Emit RELATIONSHIP_CREATED audit.
- `listByEntity(entityId)` — relationships where entity is from or to

### 3. Borrower Group Query

**`GET /v1/deals/:dealId/borrower-group`**

Given a deal with `primary_entity_id` set:
1. Start from the primary entity
2. Traverse all relationships (both directions) to find connected entities
3. Return `{entities: Entity[], relationships: Relationship[]}`

This is a graph traversal — collect all entities reachable from the primary entity through any relationship edges.

### 4. API Routes for Entities + Relationships

- `POST /v1/entities` — createEntity
- `GET /v1/entities` — listEntities (with ?type= filter)
- `GET /v1/entities/:entityId` — getEntity
- `PATCH /v1/entities/:entityId` — updateEntity
- `POST /v1/relationships` — createRelationship
- `GET /v1/deals/:dealId/borrower-group` — getBorrowerGroup

### 5. Template Engine

**Template loading:**
Templates are Markdown files with YAML frontmatter. Load from `conformance/fixtures/templates/` (or a configurable templates directory).

Parse frontmatter to get: id, name, phase, doc_type, version, required_variables.

**Template rendering — mustache-style:**
- Replace `{{variable_name}}` with values from deal context
- Deal context: all deal fields + computed fields
- Support `overrides` object that takes precedence over deal data
- Missing variables render as empty string (not error)

**API routes:**
- `GET /v1/templates` — list available templates. Filter by `?phase=` and `?doc_type=`.
- `POST /v1/templates/render` — render template with deal context
  - Input: `{template_id, deal_id, overrides?}`
  - Output: `{markdown, html, template_version}`
  - `html` is the markdown converted to HTML

### 6. Frozen Artifacts

**Drizzle schema — `artifacts` table:**
- id (uuid PK)
- template_id (text)
- deal_id (FK → deals)
- template_version (text)
- markdown (text — frozen rendered content)
- frozen_at (timestamp)

**API routes:**
- `POST /v1/deals/:dealId/artifacts` — freeze a rendered template
  - Input: `{template_id, overrides?}`
  - Renders the template, stores the markdown as immutable artifact
  - Emit ARTIFACT_FROZEN audit event
- `GET /v1/deals/:dealId/artifacts` — list frozen artifacts for a deal

**Key invariant:** Once frozen, the artifact markdown never changes, even if deal data changes later.

### 7. HTML Export

Use a simple Markdown-to-HTML converter (e.g., `marked` or `markdown-it` npm package) to produce the `html` field in render responses.

## Test Command

```bash
npm run test:conformance
```

All suites 00-04 must pass.

## Key Rules

1. Don't break suites 00-02
2. Entity type cannot be changed after creation
3. Relationships require both entities to exist
4. Template variables use `{{mustache}}` syntax
5. Missing variables render as empty string
6. Frozen artifacts are immutable
7. All mutations produce audit events

## Done Criteria

All tests in suites 00-04 pass (~85 tests). Output: `ENTITIES TEMPLATES PASSING`
