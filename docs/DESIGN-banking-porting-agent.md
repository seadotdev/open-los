# Banking Porting Agent: Design Document

> Applying StrongDM's Software Factory techniques to build agent-driven banking system twins

## 1. What StrongDM Built (and Why It Matters)

StrongDM's three-person AI team built a **Software Factory** — a non-interactive development pipeline where specs and scenarios drive coding agents that write code, run test harnesses, and converge without human review. Two governing principles: "Code must not be written by humans" and "Code must not be reviewed by humans."

Their headline output is the **Digital Twin Universe (DTU)**: behavioral clones of Okta, Jira, Slack, Google Docs, Google Drive, and Google Sheets. Each twin replicates the real service's API surface, edge cases, and observable behaviors as a self-contained binary. This lets them run thousands of integration test scenarios per hour without hitting rate limits, triggering abuse detection, or accumulating API costs.

### The Key Prompting Insight (Jay Taylor, Hacker News)

> "Use the top popular publicly available reference SDK client libraries as compatibility targets, with the goal always being 100% compatibility."

The trick: don't just match the API spec — target the **SDK client libraries** people actually use. If the official Java SDK, the community TypeScript SDK, and the popular Python wrapper all pass their own test suites against your twin, you have high-fidelity behavioral compatibility. The SDK tests encode real-world usage patterns, edge cases, and assumptions that OpenAPI specs alone miss.

---

## 2. StrongDM's Named Techniques

### 2.1 Digital Twin Universe (DTU)

Build behavioral clones of third-party services. Feed the public API docs + SDK source into a coding agent. Have it produce a self-contained binary (they use Go) that replicates the API. Validate by running existing SDK test suites against the twin.

**Why it works:** Creating a high-fidelity clone of a significant SaaS application was always technically possible but never economically feasible. Coding agents change the economics — a 3-person team cloned 6 major SaaS products in months.

### 2.2 Gene Transfusion

Have agents extract structural patterns from one system and transplant them into another. Not copy-paste — the agent understands the *shape* of a pattern (auth flow, pagination, error handling, state machine) and re-expresses it in a different context.

**Mechanism:** The agent reads System A's implementation, builds an internal model of the pattern, then generates an equivalent implementation for System B — respecting B's idioms, conventions, and constraints.

### 2.3 Semports (Semantic Ports)

Automated, ongoing ports of code from one language to another. Not transpilation — semantic understanding and re-expression.

**Concrete example:** StrongDM runs a daily automated check of `openai/openai-agents-python`. They want those agentic primitives in Go. Every time the Semport process wakes, it considers the most recent commits and evaluates whether they apply to the Go implementation. The Python team ships; the Go codebase receives.

**Key insight:** "How little we think about it: the OpenAI team does great work (in Python), and we receive it (in Go) and it just ... works."

### 2.4 Pyramid Summaries

Multi-resolution documentation for agent consumption. Inspired by map tile systems and pyramid TIFF formats. Generate summaries at multiple zoom levels — a one-liner, a paragraph, a page, and the full detail — so an agent can scan quickly at the top and drill down only where the signal demands it.

**Process:** Generate per-item summaries in parallel, group by compressed representations, synthesize across clusters, expand detail where needed. Mirrors how an executive drills down: org → department → team → individual.

**Why it matters:** Context windows are finite. Attention is precious. Pyramid Summaries let agents see the forest *and* the trees, just not all at once.

---

## 3. What This Means for Open LOS

### 3.1 The Opportunity

Open LOS already has:
- A Mambu-compatible loan ledger spec (`prompts/SPEC-LEDGER.md`)
- A shadow migration system designed for adapter-based source system ingestion (`docs/SPEC_SHADOW_MIGRATION.md`)
- YAML-driven conformance tests that define behavior independently of implementation
- An OpenAPI 3.1 spec (1,540 lines)
- Multi-tenant architecture

The idea: **build Digital Twins of Mambu, Temenos Transact, and nCino** — not to replace them, but to:

1. **Enable migration testing** — Banks can validate their migration from Legacy → Open LOS against a twin that behaves like the legacy system, without needing access to their production environment
2. **De-risk switching costs** — "Try migrating against our twin of your current system. If anything breaks, we see it before you do."
3. **Build the shadow adapters** — The twins serve as development targets for the `packages/shadow/` adapter system
4. **Validate API compatibility** — The existing Mambu ledger spec can be tested against the Mambu twin's SDK

### 3.2 Available Public API Surface

| System | API Docs | SDK/Client Libraries | Feasibility |
|--------|----------|---------------------|-------------|
| **Mambu** | [api.mambu.com](https://api.mambu.com/) (OpenAPI v2 spec) | [Java SDK](https://github.com/mambu-gmbh/Mambu-APIs-Java) (archived), [TS SDK](https://github.com/skyleague/mambu-sdk) (community) | **High** — OpenAPI spec is published, SDKs exist, loan ledger mapping already done |
| **Temenos Transact** | [developer.temenos.com](https://developer.temenos.com/transact-apis), [apidocs.temenos.com](https://apidocs.temenos.com/api-catalog) | Community [T24 REST wrapper](https://github.com/stephentwig/TemenosTransactT24), OpenAPI specs available | **Medium** — API surface is enormous (retail, corporate, treasury, wealth, payments); need to scope to loan lifecycle subset |
| **nCino** | [developer.ncino.com](https://developer.ncino.com/) | Salesforce-based (SOQL/REST), no standalone SDK | **Medium-Low** — Built on Salesforce platform; API is Salesforce-style, not REST-native; Consumer Banking APIs documented, Business Banking coming |

### 3.3 Technique Mapping

| StrongDM Technique | Open LOS Application |
|--------------------|---------------------|
| **DTU** | Build twins of Mambu, Temenos, nCino loan lifecycle APIs as self-contained TypeScript services. Use them as test targets for shadow migration adapters. |
| **Gene Transfusion** | Extract patterns from each banking system's state machines (loan states, approval flows, disbursement logic) and transplant into Open LOS's own deal lifecycle. Learn from their battle-tested patterns. |
| **Semports** | Port the Mambu Java SDK's loan operations to TypeScript. Port Temenos T24 REST patterns to Open LOS's Hono routes. Keep in sync as upstream SDKs evolve. |
| **Pyramid Summaries** | Generate multi-level summaries of each banking system's API surface. Top level: "Mambu has Clients, Loan Products, Loan Accounts, Transactions." Next level: operations per entity. Bottom level: full field-by-field schema. Feed these to agents working on adapters. |

---

## 4. Proposed Architecture: Banking Porting Agent

### 4.1 Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Banking Porting Agent                     │
│                                                             │
│  Input:                                                     │
│  ├── Public API spec (OpenAPI/Swagger)                      │
│  ├── SDK client libraries (Java/TS/Python)                  │
│  ├── SDK test suites (compatibility targets)                │
│  └── Pyramid Summaries of the API surface                   │
│                                                             │
│  Process:                                                   │
│  ├── 1. Ingest & summarize (Pyramid Summaries)              │
│  ├── 2. Build Digital Twin (DTU)                            │
│  ├── 3. Validate against SDK tests (convergence loop)       │
│  ├── 4. Extract patterns (Gene Transfusion)                 │
│  └── 5. Generate shadow adapter (Semport to TS)             │
│                                                             │
│  Output:                                                    │
│  ├── Self-contained twin service (TypeScript/Hono)          │
│  ├── Shadow migration adapter (packages/shadow/adapters/X)  │
│  ├── Conformance test cases (YAML)                          │
│  └── Field mapping documentation                            │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Phase 1: Mambu Twin (Start Here)

Mambu is the natural first target because:
- Open LOS already has a Mambu-compatible ledger spec
- Mambu publishes an OpenAPI v2 spec
- Multiple SDK client libraries exist as compatibility targets
- The domain overlap is highest (loan lifecycle is the core concern)

**Scope for Phase 1 — Loan Lifecycle Subset:**

```
Mambu API v2 Surface to Clone:
├── /clients              → entities (Open LOS)
├── /loans/products       → facilities / loan_products
├── /loans                → loan_accounts
├── /loans/{id}/transactions
│   ├── disbursement      → loan_transactions (DISBURSEMENT)
│   ├── repayment         → loan_transactions (REPAYMENT)
│   ├── fee               → loan_transactions (FEE)
│   └── interest-accrual  → loan_transactions (INTEREST)
├── /loans/{id}/schedule  → repayment_schedule
└── /loans/{id}/states    → loan account state machine
```

**Compatibility Targets:**
1. `skyleague/mambu-sdk` (TypeScript) — generated from Mambu's own OpenAPI spec
2. `mambu-gmbh/Mambu-APIs-Java` (Java, archived) — the official SDK; test suite encodes years of production usage patterns

**Acceptance Criteria:**
- The Mambu twin passes the TypeScript SDK's request/response expectations for the scoped endpoints
- Open LOS's shadow Mambu adapter can read from the twin identically to reading from real Mambu
- Conformance YAML tests cover the twin's loan lifecycle operations

### 4.3 Phase 2: Pattern Extraction (Gene Transfusion)

Once the Mambu twin exists, extract patterns that Open LOS can learn from:

| Pattern | Mambu Implementation | Open LOS Benefit |
|---------|---------------------|-------------------|
| Loan state machine | `PENDING_APPROVAL → APPROVED → ACTIVE → CLOSED` with sub-states for arrears, write-off | Validate our own loan account states match real-world needs |
| Interest accrual | Daily calculation, multiple methods (declining balance, flat, etc.) | Ensure spread service supports the same calculation methods |
| Fee handling | Application fees, late fees, prepayment penalties with configurable triggers | Extend loan_transactions to handle fee diversity |
| Repayment scheduling | Dynamic rescheduling, grace periods, balloon payments | Validate facility/loan account schedule generation |

### 4.4 Phase 3: Temenos / nCino Twins

Apply the same process to expand coverage:

**Temenos Transact** — Scope to:
- Account management (loans, current accounts)
- Transaction posting
- Interest calculation
- Limit/facility management

**nCino** — Scope to:
- Loan origination workflow (their core strength)
- Document requirements and checklist management
- Approval workflow and routing
- Consumer loan product configuration

### 4.5 Pyramid Summary Structure for Agent Context

For each banking system, generate summaries at four levels:

```
Level 0 (one-liner):
  "Mambu: Cloud core banking. Loans, deposits, clients. REST API v2."

Level 1 (paragraph):
  "Mambu API v2 covers client management, loan products, loan accounts,
   transactions (disbursement/repayment/fee), schedules, and GL journal
   entries. Auth via API key or OAuth2. Pagination via offset/limit.
   All money in minor units. Dates in ISO 8601."

Level 2 (page):
  Per-entity breakdown — fields, states, operations, relationships.
  Loan Account: 47 fields, 8 states, 12 operations.
  Client: 23 fields, 3 states, 6 operations.

Level 3 (full detail):
  Complete field-by-field schema with types, constraints, defaults,
  and behavioral notes extracted from SDK source code.
```

This lets the porting agent scan Level 0-1 to decide *where* to work, then drill into Level 2-3 for implementation detail.

---

## 5. Implementation Strategy

### 5.1 The Attractor Pattern (Spec-First, Code-Never)

Following StrongDM's Attractor approach: write the spec, feed it to coding agents, never hand-write the implementation.

For each banking twin, produce:
1. **NLSpec** (natural language specification) — Markdown describing the twin's behavior
2. **Conformance YAML** — Test cases the twin must pass (extends Open LOS's existing pattern)
3. **SDK compatibility harness** — Script that runs the target SDK's operations against the twin

Then feed all three to the coding agent and let it converge.

### 5.2 Fitting Into Open LOS's Existing Architecture

```
packages/
├── shadow/
│   └── src/adapters/
│       ├── mambu/          # Adapter that speaks TO Mambu (or its twin)
│       │   ├── adapter.ts
│       │   ├── client.ts
│       │   ├── mapper.ts   # Mambu → Open LOS field mapping
│       │   └── types.ts
│       ├── temenos/        # Same pattern for Temenos
│       └── ncino/          # Same pattern for nCino
│
├── twins/                  # NEW: Digital Twin services
│   ├── mambu-twin/         # Self-contained Mambu API twin
│   │   ├── src/
│   │   │   ├── server.ts   # Hono app mimicking Mambu API v2
│   │   │   ├── routes/     # /clients, /loans, /loans/transactions
│   │   │   ├── state/      # In-memory or SQLite state
│   │   │   └── sdk-compat/ # SDK test harness
│   │   ├── nlspec.md       # Natural language spec (Attractor-style)
│   │   └── package.json
│   ├── temenos-twin/
│   └── ncino-twin/
│
└── conformance/
    └── cases/
        ├── 20_mambu_compat.yaml    # Twin conformance tests
        ├── 21_temenos_compat.yaml
        └── 22_ncino_compat.yaml
```

### 5.3 The Convergence Loop

```
while not converged:
    1. Agent reads NLSpec + Pyramid Summary for target system
    2. Agent generates/modifies twin implementation
    3. Run conformance YAML tests → collect failures
    4. Run SDK compatibility harness → collect failures
    5. Feed failures back to agent
    6. Agent fixes implementation
    # Converged when: all YAML tests pass + SDK harness passes
```

This is the core Software Factory loop. No human reviews the generated code. The tests *are* the review.

---

## 6. What We Get

### For Open LOS users migrating FROM legacy systems:
- **Zero-risk migration validation** — Run your data through the twin, compare outputs with your production system
- **Shadow mode** — Open LOS runs alongside the twin (standing in for production Mambu/Temenos/nCino), validating every operation matches

### For Open LOS development:
- **Integration tests without vendor accounts** — Test the shadow adapters against twins locally
- **Continuous compatibility** — If Mambu ships a new API version, update the twin (Semport the SDK changes), re-run conformance
- **Pattern learning** — Gene Transfusion extracts battle-tested patterns from banking systems with decades of production experience

### For the market:
- **De-risk the pitch** — "We have a verified-compatible twin of your current system. Migration is testable before you commit."
- **Speed** — A 3-person team cloned 6 SaaS products. The banking API surface (scoped to loan lifecycle) is comparable in complexity to one of those.

---

## 7. Open Questions

1. **Twin fidelity scope** — Do we need to clone the full Mambu API or just the loan lifecycle subset? (Recommendation: subset first, expand on demand)
2. **State persistence** — Should twins use in-memory state (simpler, faster) or SQLite (matches Open LOS's own pattern, enables more complex scenarios)?
3. **SDK test availability** — The Mambu Java SDK is archived. Do its tests still run? Is the community TS SDK tested enough to serve as compatibility target?
4. **nCino's Salesforce dependency** — nCino is built on Salesforce. Cloning a Salesforce-style API (SOQL queries, composite resources) is structurally different from cloning a REST API. May need a different approach.
5. **Temenos scope explosion** — Temenos Transact covers retail, corporate, treasury, wealth, and payments. The loan lifecycle subset needs tight scoping to stay manageable.

---

## Sources

- [Simon Willison: How StrongDM's AI team build serious software without even looking at the code](https://simonwillison.net/2026/Feb/7/software-factory/)
- [StrongDM Software Factory](https://factory.strongdm.ai/)
- [StrongDM Gene Transfusion](https://factory.strongdm.ai/techniques/gene-transfusion)
- [StrongDM Semports](https://factory.strongdm.ai/techniques/semport)
- [StrongDM Pyramid Summaries](https://factory.strongdm.ai/techniques/pyramid-summaries)
- [github.com/strongdm/attractor](https://github.com/strongdm/attractor) — NLSpec for their non-interactive coding agent
- [github.com/strongdm/cxdb](https://github.com/strongdm/cxdb) — AI Context Store (immutable DAG for conversation histories)
- [Mambu API v2](https://api.mambu.com/)
- [Mambu Java SDK](https://github.com/mambu-gmbh/Mambu-APIs-Java) (archived)
- [Mambu TypeScript SDK](https://github.com/skyleague/mambu-sdk) (community)
- [Temenos Developer Portal](https://developer.temenos.com/transact-apis)
- [nCino Developer Portal](https://developer.ncino.com/)
