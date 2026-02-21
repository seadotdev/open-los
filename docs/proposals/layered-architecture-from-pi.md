# Forkable Architecture: Splitting the Core LOS for Different Lending Verticals

> Builds on: [agentic-patterns-from-pi.md](./agentic-patterns-from-pi.md) and [learning-from-pi-and-claws.md](./learning-from-pi-and-claws.md)
>
> Key source: Mario Zechner, "What I learned building an opinionated and minimal coding agent" (2025-11-30)

## The Insight

Pi splits into four packages (`pi-ai`, `pi-agent-core`, `pi-coding-agent`, `pi-tui`) so that anyone can replace a single layer without touching the others. Build a different coding agent? Swap `pi-coding-agent`, keep the rest. Change LLM providers? Swap `pi-ai`, keep the rest. The layers compose upward, each depending only on the one below.

The NanoClaw extension takes this further: "skills as code transformation." A skill is a markdown file that teaches an AI how to modify source code. Each deployment is a clean fork of the base, transformed by whichever skills apply. Karpathy called this approach "slightly blowing his mind."

Open LOS's core is a monolith. `packages/core` exports 28 tables and 16 services from one flat `index.ts`. `packages/api` mounts 15 route groups unconditionally. There's no way to fork at the deal lifecycle level without dragging along deposit accounts, Mambu-compatible loan ledgers, and sandbox version control. Every deployer gets all 28 tables whether they need them or not.

This proposal splits the core into layers that different developers can fork at different levels.

---

## What's Actually in the Monolith

Looking at `packages/core/src/index.ts` and `packages/core/src/schema/tables.ts`, there are natural clusters:

**Cluster 1 — Deal Lifecycle** (the foundation everything else touches)
- Tables: `deals`, `entities`, `relationships`, `documents`, `auditEvents`, `stageTransitions`
- Services: `DealService`, `EntityService`, `RelationshipService`, `DocumentService`, `AuditService`, `StageService`
- Lines of real code: ~700

**Cluster 2 — Templates & Artifacts** (document generation)
- Tables: `artifacts`
- Services: `TemplateService`, `ArtifactService`
- Lines: ~200

**Cluster 3 — Underwriting** (credit analysis)
- Tables: `spreads`, `covenants`, `covenantTests`, `waivers`
- Services: `SpreadService` (with `computeRatios()`), `CovenantService`
- Lines: ~500

**Cluster 4 — Facilities & Loan Ledger** (booking)
- Tables: `facilities`, `loanAccounts`, `loanTransactions`, `repaymentSchedule`, `approvalRequests`
- Services: `FacilityService`, `LoanAccountService`, `ApprovalService`, plus `loan-integration.ts` bridge functions
- Lines: ~1200 (the biggest cluster — the Mambu-compatible ledger is substantial)

**Cluster 5 — Monitoring** (post-close)
- Tables: `ingestions`, `bankTransactions`, `alerts`
- Services: `MonitoringService`
- Lines: ~300

**Cluster 6 — Communications** (email/notes)
- Tables: `communications`
- Services: `EmailService`
- Lines: ~200

**Cluster 7 — Deposits** (liability side)
- Tables: `depositAccounts`
- Services: `DepositAccountService`
- Lines: ~150

**Cluster 8 — Sandboxes** (what-if workspaces)
- Tables: `sandboxes`, `checkpoints`, `sandboxEntities`
- Services: `SandboxService`, `InMemoryGitProvider`
- Lines: ~400

**Cluster 9 — AI Conversations** (conversation tracking)
- Tables: `aiConversations`, `aiMessages`
- Services: (none yet — tables only)

The dependency graph between these clusters flows strictly downward:

```
                Deposits  AI Conversations
                   │              │
Sandboxes    Communications      │
    │              │              │
    └──────┬───────┘              │
           │                      │
       Monitoring                 │
           │                      │
     Loan Ledger ─── Approvals    │
           │                      │
       Facilities                 │
           │                      │
      Underwriting   Templates    │
           │              │       │
           └──────┬───────┘       │
                  │               │
            Deal Lifecycle ───────┘
```

Everything depends on Deal Lifecycle. Nothing else has circular dependencies. This is the natural layering.

---

## Fork Levels

### Level 0: Deal Lifecycle Only

**Who:** Someone building a fundamentally different financial product — invoice factoring, trade finance, insurance origination, grant management. They need the deal-as-a-state-machine pattern with entities, documents, and audit, but nothing else.

**What they get:**
- `deals`, `entities`, `relationships`, `documents`, `auditEvents`, `stageTransitions`
- `DealService`, `EntityService`, `RelationshipService`, `DocumentService`, `AuditService`, `StageService`
- The stage machine (`VALID_TRANSITIONS`, `STAGE_GUARDS`, role-based transition control)
- Immutable append-only audit trail
- API routes: `/v1/deals`, `/v1/entities`, `/v1/relationships`, `/v1/documents`, `/v1/audit`, `/v1/stage-transitions`

**What they add themselves:** Everything specific to their vertical. An invoice factoring platform adds receivables, debtors, and dilution tracking. A trade finance platform adds letters of credit, bills of lading, and correspondent banks.

**What they likely change:** The stage names (`broker → origination → underwriting → closing → monitoring` become something domain-specific), the stage guards, the valid transitions. These are currently constants in `packages/core/src/services/stage.ts:12-59` — they need to be injectable or configurable rather than hardcoded.

### Level 1: Deal Lifecycle + Underwriting

**Who:** Any credit-granting business that does financial analysis. Commercial lenders, equipment finance companies, SBA lenders, CDFIs. They need to spread financials, compute ratios, define and test covenants.

**What they get:** Everything from Level 0, plus:
- `spreads`, `covenants`, `covenantTests`, `waivers`
- `SpreadService`, `CovenantService`, `computeRatios()`
- API routes: `/v1/deals/:id/spread`, `/v1/deals/:id/covenants`

**What they don't need:** The loan ledger (they book in their core banking system), monitoring (they have their own), deposits (they're not banks).

### Level 2: Deal Lifecycle + Underwriting + Facilities

**Who:** Lenders who need facility structuring but book loans in an external system (Mambu, FIS, etc.). They originate through Open LOS, structure the facility, then hand off to their booking system.

**What they get:** Everything from Level 1, plus:
- `facilities`, `approvalRequests`
- `FacilityService`, `ApprovalService`
- API routes: `/v1/deals/:id/facilities`, `/v1/approvals`

**What they skip:** The full Mambu-compatible loan ledger (`loanAccounts`, `loanTransactions`, `repaymentSchedule`). They already have a booking system.

### Level 3: Full Origination + Booking

**Who:** New lenders who need everything — origination through to loan account management. Fintech lenders, marketplace lenders, anyone who doesn't have (or wants to replace) a core banking system.

**What they get:** Everything from Level 2, plus:
- `loanAccounts`, `loanTransactions`, `repaymentSchedule`
- `LoanAccountService` with the full Mambu-compatible state machine
- The `loan-integration.ts` bridge (`createLoanAccountFromFacility`, `approveLoanAccount`, etc.)
- API routes: `/v1/facilities/:id/loans`, `/v1/loans/:id/transactions`

### Level 4: Full Stack

**Who:** A bank or credit union that wants the complete platform including deposits, monitoring, communications, and sandboxes.

**What they get:** Everything.

### Level A: Agent Only (Headless Fork)

**Who:** Someone with an existing LOS (Mambu, nCino, or homegrown) who just wants the AI agent layer. They don't fork `packages/core` at all. They implement the `OpenLOSServices` interface (`packages/agent/src/agent.ts:31-42`) as an adapter to their existing system.

**What they get:**
- `packages/agent` — the `LoanOriginationAgent` outcome-oriented orchestrator
- The `OpenLOSServices` interface as their adapter contract

**What they build:** Adapters that translate between the `OpenLOSServices` interface and their existing system's API.

---

## What Has to Change

### 1. Split `packages/core` into composable modules

Currently `packages/core/src/index.ts` exports everything flat. The database migration (`migrateDatabase`) creates all 28 tables. There's no way to create a database with just the deal lifecycle tables.

**Proposed structure:**

```
packages/core/
├── src/
│   ├── index.ts                    # Re-exports everything (backwards compatible)
│   ├── base/                       # Level 0: Deal Lifecycle
│   │   ├── index.ts                # Exports base tables + services
│   │   ├── schema.ts               # deals, entities, relationships, documents, auditEvents, stageTransitions
│   │   ├── migrate.ts              # Creates only base tables
│   │   ├── deal.ts
│   │   ├── entity.ts
│   │   ├── relationship.ts
│   │   ├── document.ts
│   │   ├── audit.ts
│   │   ├── stage.ts                # Stage machine — configurable transitions + guards
│   │   └── errors.ts
│   ├── underwriting/               # Level 1: Spreads + Covenants
│   │   ├── index.ts
│   │   ├── schema.ts               # spreads, covenants, covenantTests, waivers
│   │   ├── migrate.ts
│   │   ├── spread.ts
│   │   └── covenant.ts
│   ├── facilities/                 # Level 2: Facility structuring
│   │   ├── index.ts
│   │   ├── schema.ts               # facilities, approvalRequests
│   │   ├── migrate.ts
│   │   ├── facility.ts
│   │   └── approval.ts
│   ├── ledger/                     # Level 3: Loan ledger (Mambu-compatible)
│   │   ├── index.ts
│   │   ├── schema.ts               # loanAccounts, loanTransactions, repaymentSchedule
│   │   ├── migrate.ts
│   │   ├── loan-account.ts
│   │   └── loan-integration.ts
│   ├── monitoring/                 # Optional: Post-close monitoring
│   │   ├── index.ts
│   │   ├── schema.ts               # ingestions, bankTransactions, alerts
│   │   ├── migrate.ts
│   │   └── monitoring.ts
│   ├── communications/             # Optional: Email/notes
│   │   ├── index.ts
│   │   ├── schema.ts
│   │   ├── migrate.ts
│   │   └── email.ts
│   ├── deposits/                   # Optional: Deposit accounts
│   │   ├── index.ts
│   │   ├── schema.ts
│   │   ├── migrate.ts
│   │   └── deposit-account.ts
│   └── sandbox/                    # Optional: What-if workspaces
│       ├── index.ts
│       ├── schema.ts
│       ├── migrate.ts
│       └── sandbox.ts
```

Each module exports its own tables, services, and a `migrate()` function. The top-level `index.ts` re-exports everything for backwards compatibility — existing code that imports from `@open-los/core` keeps working.

A Level 0 fork imports only `@open-los/core/base`. A Level 1 fork imports `@open-los/core/base` and `@open-los/core/underwriting`. And so on.

### 2. Make migrations composable

Currently `migrateDatabase()` in `packages/core/src/schema/db.ts` runs one monolithic migration. It needs to become:

```typescript
import { migrateBase } from './base/migrate'
import { migrateUnderwriting } from './underwriting/migrate'
import { migrateFacilities } from './facilities/migrate'
import { migrateLedger } from './ledger/migrate'
import { migrateMonitoring } from './monitoring/migrate'

// Full stack (backwards compatible)
export async function migrateDatabase(db: Database) {
  await migrateBase(db)
  await migrateUnderwriting(db)
  await migrateFacilities(db)
  await migrateLedger(db)
  await migrateMonitoring(db)
  // ... etc
}

// Composable: fork picks what they need
export { migrateBase, migrateUnderwriting, migrateFacilities, migrateLedger, migrateMonitoring }
```

### 3. Make the API server composable

Currently `packages/api/src/server.ts:73-95` mounts all 15 route groups unconditionally. The `AppContext` interface requires all 16 services. A Level 0 fork shouldn't need to instantiate a `DepositAccountService`.

**Proposed:**

```typescript
// Base app — always present
export function createBaseApp(ctx: BaseContext) {
  const app = new Hono()
  app.route('/v1', dealRoutes(ctx))
  app.route('/v1', entityRoutes(ctx))
  app.route('/v1', relationshipRoutes(ctx))
  app.route('/v1', documentRoutes(ctx))
  app.route('/v1', auditRoutes(ctx))
  app.route('/v1', stageRoutes(ctx))
  return app
}

// Modules add their routes
export function withUnderwriting(app: Hono, ctx: UnderwritingContext) {
  app.route('/v1', underwritingRoutes(ctx))
  app.route('/v1', covenantRoutes(ctx))
  return app
}

export function withFacilities(app: Hono, ctx: FacilitiesContext) {
  app.route('/v1', facilityRoutes(ctx))
  return app
}

export function withLedger(app: Hono, ctx: LedgerContext) {
  app.route('/v1', loanRoutes(ctx))
  return app
}

// ... etc

// Full app (backwards compatible)
export function createApp(ctx: AppContext) {
  let app = createBaseApp(ctx)
  app = withUnderwriting(app, ctx)
  app = withFacilities(app, ctx)
  app = withLedger(app, ctx)
  app = withMonitoring(app, ctx)
  // ...
  return app
}
```

A Level 0 deployer calls `createBaseApp()`. A Level 2 deployer calls `createBaseApp()` then `withUnderwriting()` then `withFacilities()`.

### 4. Make the stage machine configurable

The current stage machine is hardcoded in `packages/core/src/services/stage.ts:12-60`:

```typescript
// Currently hardcoded
const VALID_TRANSITIONS: Record<string, string> = {
  broker: 'origination',
  origination: 'underwriting',
  underwriting: 'closing',
  closing: 'monitoring',
}
```

This is the right default for commercial lending. But an invoice factoring platform needs different stages (`submission → verification → funding → collection`). An equipment lease needs different stages (`application → credit_check → asset_evaluation → documentation → funding → servicing`).

The stage machine should accept transitions and guards as constructor parameters:

```typescript
interface StageConfig {
  transitions: Record<string, string>   // from → to
  roles: Record<string, string[]>       // "from→to" → allowed roles
  guards: Record<string, StageGuard[]>  // stage → guards
}

// Default commercial lending config (current behavior)
export const COMMERCIAL_LENDING_STAGES: StageConfig = {
  transitions: {
    broker: 'origination',
    origination: 'underwriting',
    underwriting: 'closing',
    closing: 'monitoring',
  },
  roles: {
    'broker→origination': ['originator', 'credit_lead'],
    'origination→underwriting': ['underwriter', 'credit_lead'],
    'underwriting→closing': ['closer', 'credit_lead'],
    'closing→monitoring': ['monitor', 'credit_lead'],
  },
  guards: STAGE_GUARDS,
}

class StageService {
  constructor(
    private db: Database,
    private audit: AuditService,
    private getNow: () => string,
    private config: StageConfig = COMMERCIAL_LENDING_STAGES,  // Injectable
  ) {}
}
```

This is the single most important change for forkability. The deal-as-state-machine is universal; the specific states and transitions are vertical-specific. Splitting these lets a fork keep the machine and replace the configuration.

### 5. Make the agent's service interface partial

Currently `packages/agent/src/agent.ts:31-42` requires all 10 services:

```typescript
interface OpenLOSServices {
  deals: DealService
  stages: StageService
  documents: DocumentService
  entities: EntityService
  spreads: SpreadService
  covenants: CovenantService
  facilities: FacilityService
  loans: LoanService
  monitoring: MonitoringService
  audit: AuditService
}
```

A Level 0 fork can't satisfy this interface. The agent should require only the base services and accept optional modules:

```typescript
interface BaseServices {
  deals: DealService
  stages: StageService
  documents: DocumentService
  entities: EntityService
  audit: AuditService
}

interface AgentConfig {
  los: BaseServices
  modules?: {
    underwriting?: { spreads: SpreadService; covenants: CovenantService }
    facilities?: { facilities: FacilityService }
    ledger?: { loans: LoanService }
    monitoring?: { monitoring: MonitoringService }
  }
  llm: LLMClient
}
```

The agent's methods that depend on optional modules check for their presence. `assessRisks()` only calls `spreads.getRatios()` if the underwriting module is present. `getRecommendation()` only suggests facility structures if the facilities module is present. The outcome-oriented interface adapts to what's available.

---

## What a Fork Actually Looks Like

### Invoice factoring platform (Level 0 fork)

```typescript
import { migrateBase } from '@open-los/core/base'
import { createBaseApp } from '@open-los/api'

// 1. Use the base deal lifecycle
const db = createDatabase('./factoring.db')
await migrateBase(db)

// 2. Add factoring-specific tables
await migrateFactoring(db)  // receivables, debtors, invoices, dilution

// 3. Custom stage config
const FACTORING_STAGES = {
  transitions: {
    submission: 'verification',
    verification: 'approval',
    approval: 'funding',
    funding: 'collection',
    collection: 'settled',
  },
  roles: { /* ... */ },
  guards: { /* ... */ },
}

// 4. Wire services
const stageService = new StageService(db, audit, getNow, FACTORING_STAGES)
const dealService = new DealService(db, audit, getNow)
// ... base services

// 5. Create API — base routes only
let app = createBaseApp({ dealService, stageService, /* ... */ })

// 6. Add factoring-specific routes
app.route('/v1', factoringRoutes(factoringCtx))

// Result: a factoring platform with deals, entities, documents,
// audit trail, and a factoring-specific stage machine.
// No spreads, no covenants, no loan ledger, no deposits.
```

### Equipment finance (Level 1 fork)

```typescript
import { migrateBase } from '@open-los/core/base'
import { migrateUnderwriting } from '@open-los/core/underwriting'
import { createBaseApp, withUnderwriting } from '@open-los/api'

// Uses base + underwriting (need to spread financials and test covenants)
// but books loans in their core banking system (no ledger)
// and adds equipment-specific tables (assets, residual values, depreciation schedules)
```

### Full-stack fintech lender (Level 3 fork)

```typescript
import { migrateDatabase } from '@open-los/core'  // Everything
import { createApp } from '@open-los/api'          // Everything

// Takes the whole stack as-is, maybe adds custom fields
// and a different stage configuration
```

---

## Why This Works (Pi's Lesson Applied)

Pi's architecture succeeded because of one rule: **each layer depends only on the one below it**. `pi-coding-agent` knows about coding but not about HTTP calls to Anthropic. `pi-ai` knows about LLM providers but not about tool execution loops.

The same principle applied to the LOS domain:

- **Base** knows about deals and documents but not about financial analysis
- **Underwriting** knows about spreads and covenants but not about loan booking
- **Ledger** knows about loan accounts and transactions but not about monitoring
- **Each module depends only downward on the base**

The NanoClaw "skills as code transformation" insight applies too. Rather than one repo that tries to be everything:

- `/add-invoice-factoring` transforms a Level 0 fork by adding receivables, debtors, dilution
- `/add-equipment-finance` transforms a Level 1 fork by adding assets, residual values, depreciation
- `/add-trade-finance` transforms a Level 0 fork by adding LCs, bills of lading, correspondent banks

These aren't plugins loaded at runtime. They're source-level transformations of a clean fork. Each deployment is its own codebase, shaped by the skills that were applied to it.

---

## Implementation Sequence

### Phase 1: Reorganize `packages/core` internals

Move files into subdirectories (`base/`, `underwriting/`, `facilities/`, `ledger/`, `monitoring/`, etc.). Keep the top-level `index.ts` re-exporting everything. No behavior changes — just file organization.

**Risk: zero.** No public API changes. Existing imports keep working.

### Phase 2: Make `StageService` configurable

Extract `VALID_TRANSITIONS`, `TRANSITION_ROLES`, and `STAGE_GUARDS` from constants into a `StageConfig` that's injected into the constructor. Default to the current commercial lending configuration.

**Risk: low.** Backwards compatible — the default parameter preserves existing behavior.

### Phase 3: Make migrations composable

Split `migrateDatabase()` into per-module functions. The full `migrateDatabase()` calls all of them in order. Each module can be migrated independently.

**Risk: low.** The full function still works. New per-module functions are additive.

### Phase 4: Make `createApp()` composable

Split `createApp()` into `createBaseApp()` + `with*()` functions. The full `createApp()` still works. `AppContext` stays as-is. New `BaseContext`, `UnderwritingContext`, etc. are subsets.

**Risk: low.** Backwards compatible.

### Phase 5: Make the agent's service interface modular

Split `OpenLOSServices` into `BaseServices` + optional module interfaces. The agent adapts its behavior based on which modules are present.

**Risk: medium.** Agent methods that assume all services exist need null checks or capability detection. But this is a good forcing function — it makes the agent's actual dependencies explicit.

---

## What This Doesn't Change

- **The conformance test suite.** Conformance tests validate the full stack. They keep working against the full `createApp()`. Individual modules can add their own tests.

- **The CLI.** It still wraps the full API. Module-specific CLI commands could be gated on which modules are available, similar to how `packages/shadow-cli` registers its commands conditionally.

- **The LLM/agent-core layers.** Those are a separate concern (covered in the existing proposals). This proposal is purely about the domain platform — making the LOS itself forkable, independent of whether you use an AI agent on top.

- **The database engine.** Still SQLite/LibSQL via Drizzle. Module schemas compose via Drizzle's table definitions.

---

## Relationship to Existing Proposals

**[agentic-patterns-from-pi.md](./agentic-patterns-from-pi.md) Pattern 4 (Skills as Declarative Procedures)** argued for converting workflow templates to named skill files. This proposal provides the substrate: the fork levels determine which skills are available. A Level 0 fork only has deal lifecycle skills. A Level 2 fork also has underwriting and facility structuring skills.

**[learning-from-pi-and-claws.md](./learning-from-pi-and-claws.md) "Skills as Code Transformation"** argued for a maximally forkable repo. This proposal makes that concrete: fork at Level 0/1/2/3, transform with vertical-specific skills, deploy your own codebase. The base layers give you deals + entities + audit for free; your skills add the domain-specific parts.

**Both proposals' "progressive tool loading"** is easier with modular structure. The agent starts with base tools (deal CRUD, document upload, stage transitions). Underwriting tools (spread, covenant test) only load if the underwriting module is present. The agent doesn't waste context budget on tools that don't exist in this fork.
