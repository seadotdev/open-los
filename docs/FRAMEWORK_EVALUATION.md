# Framework Evaluation: The Case Against Rails

This document evaluates why Rails may not be the optimal choice for Open LOS, and considers alternatives—keeping in mind our objective to focus on specification and tests over specific implementation details.

## Context

A common argument for Rails in AI-assisted development:

> "Rails' entire philosophy is 'there's one right way to do things'. When Claude sees a Rails codebase, it knows where things go. Convention over configuration means Claude spends almost zero tokens figuring out structure."

This document challenges that assumption for Open LOS specifically.

---

## 1. The Spec IS the Product—Not the Implementation

Open LOS has **161 YAML-driven conformance tests** that define the API contract independently of implementation. The JSON Schemas and OpenAPI spec are the source of truth. This inverts the Rails paradigm.

```yaml
# Current approach: implementation-agnostic contract
test: covenant_breach_detection
steps:
  - http:
      method: POST
      path: /v1/deals/{deal_id}/covenants/{id}/test
    expect:
      json_schema: "schemas/covenant-test.schema.json"
      json_contains:
        status: "fail"
```

Rails' testing philosophy (RSpec, Minitest) is **implementation-coupled**:
- Tests reference `Deal.create!`, `FactoryBot.build(:covenant)`, internal class structures
- Factory-based testing encodes Ruby-specific assumptions
- Test helpers become Ruby code, not portable specs

If Open LOS's goal is to be **framework-agnostic** (the spec could be implemented in Python, Go, Rust, or rewritten entirely), Rails tests would tie the project to Ruby forever. The current YAML conformance tests can validate *any* implementation.

---

## 2. Type Safety for Financial Systems Is Non-Negotiable

Open LOS handles:
- Covenant threshold calculations (`actual_value >= threshold`)
- Loan ledger balances (DSCR, leverage ratios)
- Audit trail integrity (immutable events)

Ruby is dynamically typed. Consider this Rails equivalent:

```ruby
# Rails: runtime explosion waiting to happen
class Spread < ApplicationRecord
  def current_ratio
    current_assets / current_liabilities  # NoMethodError if nil
  end
end
```

Current TypeScript approach:

```typescript
// Type-safe: compiler catches null issues
function currentRatio(assets: number | null, liabilities: number | null): number | null {
  if (!liabilities || liabilities === 0) return null;
  return assets ? assets / liabilities : null;
}
```

For financial software:
- TypeScript errors at compile time
- Ruby errors at runtime (in production, with customer money)
- Drizzle ORM enforces schema-level type safety
- ActiveRecord validates at runtime, often too late

The "convention over configuration" benefit Rails provides is irrelevant when the wrong calculation type-checks in Ruby but would fail in TypeScript.

---

## 3. The "LLM Catnip" Argument Is Backwards

The argument claims Rails' conventions help Claude write code faster. But **for Open LOS, we want Claude writing specs, not implementation**:

| Approach | What Claude Generates | Lock-in |
|----------|----------------------|---------|
| Rails-first | Ruby models, controllers, migrations | High (Ruby/Rails) |
| Spec-first | YAML tests, JSON Schemas, OpenAPI | Zero (any language) |

From the Open LOS manifesto:
> "Humans and AI agents are first-class citizens with equal API access"

If the API contract is the product, Claude should be generating:
- New conformance test cases in YAML
- JSON Schema extensions for new fields
- OpenAPI endpoint definitions

Not `rails generate scaffold Covenant metric:string threshold:decimal`. That's implementation detail.

---

## 4. Rails Brings 100x the Dependencies Needed

Current stack:
```
packages/core + packages/api total dependencies: ~15
Runtime: Hono, Drizzle, LibSQL, mailparser
```

Rails 8 minimum:
```
Rails gem alone: 50+ transitive dependencies
ActiveRecord, ActionPack, ActiveSupport, ActionMailer, ActionCable...
Bootsnap, Puma, Rack, Thor, Erubi, Builder...
```

For a **headless API** (which Open LOS is), Rails includes:
- View layer (unused in headless API)
- ActionMailer (we have mailparser)
- ActionCable (no WebSockets needed)
- Asset pipeline (no frontend)
- Session management (stateless API)

The "batteries included" philosophy means paying for batteries that will never be used.

---

## 5. Multi-Tenancy and Audit Trails Are Already Solved Simply

Current approach:

```typescript
// Every table has tenant_id, enforced in service layer
const deal = await db.select().from(deals)
  .where(eq(deals.tenant_id, tenantId))
  .where(eq(deals.id, dealId));
```

Rails' approach to multi-tenancy is **fragmented**:
- Acts-as-tenant gem (scope pollution)
- Apartment gem (schema-per-tenant, PostgreSQL-specific)
- Manual `default_scope` (footgun)

Current audit trail:

```typescript
// Explicit, every mutation creates audit event
await auditService.record(db, {
  deal_id: dealId,
  type: 'COVENANT_TESTED',
  actor: actorId,
  changes: { before, after }
});
```

Rails pattern (PaperTrail gem):
- Magic callbacks, hidden behavior
- Monkey-patches ActiveRecord
- Implicit tracking you may not want

The explicit approach is **better for compliance audits**—you can explain exactly what's logged and when.

---

## 6. Velocity Claims Don't Account for Portability

A common claim:
> "One dev did 233 commits averaging 12 per day with ~15,000 lines of code on a Rails 8 prototype."

But Open LOS already has:
- ~2,400 LOC in core services
- ~161 conformance tests
- Full OpenAPI spec
- JSON Schemas
- All in TypeScript with full type coverage

Crucially: **the tests are portable**. If Open LOS were rewritten in Go tomorrow, the YAML conformance tests would still work. A Rails prototype's RSpec tests would be useless for validating a non-Ruby implementation.

---

## 7. SQLite → PostgreSQL Migration Is Easier Without ActiveRecord

Current migration path:
```
SQLite (LibSQL) → Turso (cloud SQLite) → PostgreSQL (if needed)
```

Drizzle ORM makes this trivial:
```typescript
// Same schema, different driver
import { drizzle } from 'drizzle-orm/postgres-js';
// vs
import { drizzle } from 'drizzle-orm/libsql';
```

ActiveRecord's "database agnostic" promise breaks in practice:
- SQLite-specific syntax leaks into migrations
- PostgreSQL-specific features (JSONB, arrays) require migration rewrites
- Schema.rb vs structure.sql debates
- Rails' eager loading behaves differently per database

---

## Alternatives Considered

Given the **spec-first, test-driven, AI-native** philosophy:

### A. Stay TypeScript, Keep Current Stack (Recommended)

**Why**: The architecture is already correct.

Potential enhancements:
- Add `tsx watch` for faster dev cycles (already using tsx)
- Consider Zod for runtime validation alongside JSON Schema
- Add property-based testing (fast-check) for financial calculations

### B. Python + FastAPI

**Pros**:
- Type hints (not as strict as TypeScript, but better than Ruby)
- Pydantic models generate JSON Schema automatically
- SQLAlchemy or SQLModel for ORM
- YAML test runner would still work (HTTP calls are language-agnostic)

**Cons**:
- Weaker compile-time guarantees than TypeScript
- Slower startup than Hono
- GIL limits concurrency

### C. Go + Chi/Echo

**Pros**:
- Compiled, type-safe
- Excellent for financial computations (no floating-point surprises if careful)
- Single binary deployment
- YAML conformance tests still work

**Cons**:
- More verbose than TypeScript
- Less expressive ORMs
- Team may not know Go

### D. Elixir + Phoenix

**Pros**:
- Ecto (ORM) is explicit, no magic
- Pattern matching catches more bugs at compile time
- Built for concurrency (useful for monitoring/alerting)
- Phoenix conventions without Rails' weight

**Cons**:
- Smaller talent pool
- Different paradigm (functional vs OOP)

---

## Conclusion

Rails optimizes for **implementation velocity** at the cost of **specification portability**. Open LOS has deliberately inverted this: the YAML conformance tests and JSON Schemas ARE the product, with TypeScript as an implementation detail.

Switching to Rails would:
1. Couple tests to Ruby forever
2. Lose compile-time type safety for financial calculations
3. Add 100x the dependencies
4. Solve problems that don't exist (view layer, asset pipeline)
5. Make AI agents generate Ruby boilerplate instead of portable specs

The current stack (Hono + Drizzle + YAML conformance tests) is **already optimized for AI collaboration**—not because of convention, but because the spec is machine-readable and implementation-agnostic.

---

## Summary Table

| Criterion | Rails | Current Stack (TypeScript) |
|-----------|-------|---------------------------|
| Test portability | Ruby-only (RSpec/Minitest) | Language-agnostic (YAML/HTTP) |
| Type safety | Runtime (dynamic typing) | Compile-time (TypeScript) |
| Dependencies | 50+ gems minimum | ~15 packages |
| Headless API fit | Includes unused layers | Purpose-built |
| Multi-tenancy | Gem-dependent, fragmented | Built-in, explicit |
| Audit trail | Magic callbacks (PaperTrail) | Explicit recording |
| Database migration | ActiveRecord quirks | Drizzle driver swap |
| AI agent output | Ruby implementation code | Portable specs |
