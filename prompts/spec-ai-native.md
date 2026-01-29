# Spec Refinement: AI-Native Architecture

## Completion Promise

When the revised spec is complete and coherent, output exactly: `SPEC READY`

## Your Role

You are a **critical reviewer** creating a revised version of `docs/AI_NATIVE_ARCHITECTURE.md`.

Write your revised spec to: `docs/AI_NATIVE_ARCHITECTURE_ralph_revised.md`

Your job is to:

1. Find gaps, contradictions, and ambiguities in the original
2. Cross-check against what already exists in the codebase
3. Ensure the revised spec is implementable without guesswork
4. Remove over-engineering and scope creep
5. Make sure it builds on (not replaces) what's already built

## Files to Read

**The original spec:**
- `docs/AI_NATIVE_ARCHITECTURE.md` — the draft to revise

**What already exists (don't break or duplicate):**
- `packages/core/src/schema/tables.ts` — current DB schema
- `packages/core/src/services/*.ts` — current services
- `openapi/v1.yaml` — current API contract
- `SPEC.md` — original product vision

## Review Checklist

### 1. Schema Alignment

- Does the spec add tables that duplicate what exists?
- Are new foreign keys compatible with existing tables?
- Are dimension tables (regions, industries) necessary or over-engineered?
- Will the new indexes conflict with or duplicate existing ones?

### 2. Service Alignment

- Does the spec describe services that already exist?
- Are new methods compatible with existing service interfaces?
- Is there duplication between `AnalyticsService` and existing services?

### 3. API Alignment

- Do new endpoints conflict with existing `/v1/*` routes?
- Is the analytics query format compatible with existing patterns?
- Are the MCP tools just wrappers around existing endpoints or new logic?

### 4. Feasibility

- Is Drizzle Cube a real library or hallucinated? (Verify before including)
- Is pg_mooncake production-ready?
- Can this be built incrementally or does it require big-bang changes?

### 5. Scope Creep

- What can be cut without losing core value?
- Are snapshot tables premature optimization?
- Is the transaction pattern detection necessary for MVP?

### 6. Missing Details

- How are daily snapshots generated? (Cron? Event-driven?)
- How does the MCP server authenticate?
- What happens when dimensions are missing from deals?

## Output

Write `docs/AI_NATIVE_ARCHITECTURE_ralph_revised.md` with:

1. **Corrections** — Fix any errors or hallucinations from the original
2. **Clarifications** — Add missing details
3. **Simplifications** — Remove unnecessary complexity
4. **Alignment notes** — Show how new things connect to existing code

Structure the revised spec with these sections at the end:

```markdown
## Implementation Notes

### What Already Exists (Do Not Rebuild)
- [List existing components this builds on]

### New Tables Required
- [List only genuinely new tables with schema]

### New Services Required
- [List only genuinely new services with interfaces]

### New API Endpoints Required
- [List only genuinely new endpoints]

### Migration Path
- [Step-by-step path from current state to this spec]

### Open Questions
- [Any decisions that need human input]
```

## Iteration Protocol

Each iteration:
1. Read the current state of `docs/AI_NATIVE_ARCHITECTURE_ralph_revised.md` (or create it on first pass)
2. Focus on one category of issues (schema, services, API, feasibility, scope, or missing details)
3. Make targeted improvements
4. Note what you changed at the top of the file in a changelog

After the spec is coherent and implementable, output: `SPEC READY`

## Key Constraints

- **Don't hallucinate libraries** — verify external dependencies exist before recommending
- **Don't duplicate existing code** — reference what's in `packages/core/src/`
- **Don't over-scope** — MVP first, advanced features later
- **Don't break existing tests** — 161 tests pass, they must continue to pass
- **Be specific** — vague specs lead to wrong implementations
