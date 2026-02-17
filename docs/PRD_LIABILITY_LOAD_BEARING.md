# PRD: Liability Load-Bearing LOS

**Version:** 0.1
**Date:** 2026-02-17
**Status:** Draft — Strategy
**Inspired by:** Soren Larson, "Token Counters: Why AI Labs Are Blockbuster" (2025)

---

## Executive Summary

This document proposes transforming Open LOS from a **tool** (processes loans) into a **liability-bearing product** (attests to facts about loans and stands behind them with insurance). The system would maintain a registry of facts it asserts to be true — borrower DSCR, KYC verification, collateral valuations, covenant compliance — and back those assertions with insurance policies. When a fact is proven wrong, a claim flows against coverage.

This is the lending-specific application of counter-positioning against token-maxxing: the LOS doesn't sell API calls, it sells **guaranteed outcomes**.

---

## Table of Contents

1. [Strategic Context](#strategic-context)
2. [The Model](#the-model)
3. [Data Architecture](#data-architecture)
4. [API Surface](#api-surface)
5. [Lifecycle Flows](#lifecycle-flows)
6. [Economics](#economics)
7. [Integration with Existing System](#integration-with-existing-system)
8. [Jobs to Be Done](#jobs-to-be-done)
9. [Gap Analysis](#gap-analysis)
10. [Implementation Phases](#implementation-phases)
11. [Open Questions](#open-questions)

---

## Strategic Context

### The Problem with Selling Tools

Every LOS on the market sells the same thing: a seat license to a data-entry application. The customer does the work, the LOS records it, the vendor collects rent. If the underwriting is wrong, the customer eats the loss. The software has no skin in the game.

This is the Blockbuster model applied to lending infrastructure. You're renting shelf space.

### The Counter-Position

> "The only plausible defense and path for the counter-positioner is one of trust: take on a liability-bearing job that customers come to love and trust or are too afraid to rip and replace."

The alternative: the LOS **asserts facts** about the deals it processes and **bears liability** for those facts being correct. If the system says "DSCR is 1.45x" and it's actually 0.95x, insurance covers the loss.

Precedents in other industries:

| Company | What they guarantee | How they cover |
|---------|---------------------|----------------|
| **Waymo** | Safe ride to destination | Insured per-ride, no human driver liability |
| **Sardine** | Transaction is not fraud | Chargeback Guarantee — Sardine pays if wrong |
| **Shopify** | Revenue alignment | Makes money only when merchants make money |
| **Palantir** | Analytical conclusions | Outcome-based contracting |

Applied to lending:

| Assertion | Category | If wrong, who pays today | If wrong, who pays with liability LOS |
|-----------|----------|--------------------------|---------------------------------------|
| "DSCR is 1.45x" | Financial | The lender | Insurance policy backing the LOS attestation |
| "KYC is verified" | Identity | The lender | Insurance policy backing the LOS attestation |
| "Collateral valued at $2M" | Collateral | The lender | Insurance policy backing the LOS attestation |
| "No covenant breach" | Compliance | The lender | Insurance policy backing the LOS attestation |

The LOS operator's profit equation becomes:

```
Profit = Premium charged to lender
       - Insurance premiums paid
       - Claims paid (accuracy failures)
       - Operating cost (infra + tokens)
```

**The incentive is direct**: be more accurate → fewer claims → higher margins. This is the opposite of the token-counting model where revenue is decoupled from outcome quality.

---

## The Model

### Three Primitives

The liability load-bearing system is built on three primitives:

```
┌─────────────────────┐
│  INSURANCE POLICY    │    Coverage backing assertions
│  (E&O, R&W, etc.)   │    Provider, limits, aggregate cap
└────────┬────────────┘
         │ covers
         ▼
┌─────────────────────┐
│  LIABILITY FACT      │    An assertion the LOS stands behind
│  (attested truth)    │    Category, confidence, liability amount
└────────┬────────────┘
         │ when proven wrong
         ▼
┌─────────────────────┐
│  LIABILITY CLAIM     │    Filed against the policy
│  (loss event)        │    Decide → approve/deny → payout
└─────────────────────┘
```

### Insurance Policies

A policy is an agreement with an insurer to cover a class of attested facts.

| Field | Description | Example |
|-------|-------------|---------|
| `name` | Human-readable policy name | "Underwriting Accuracy Policy Q1 2026" |
| `provider` | Insurance carrier | "Lloyd's Syndicate 1234" |
| `policy_number` | External reference | "POL-2026-001" |
| `coverage_type` | What class of risk | `errors_and_omissions`, `representations_and_warranties`, `fidelity`, `cyber` |
| `coverage_limit` | Max per-claim payout | $5,000,000 |
| `deductible` | Per-claim deductible | $50,000 |
| `premium` | What we pay the insurer | $250,000/yr |
| `aggregate_limit` | Max total payout across all claims | $20,000,000 |
| `aggregate_used` | Running total of approved claims | $0 (initially) |
| `effective_from` / `effective_until` | Policy period | 2026-01-01 to 2026-12-31 |
| `status` | Lifecycle state | `active` → `exhausted` when aggregate hit |

### Liability Facts (Attested Truths)

A fact is a specific assertion the LOS makes about a deal, entity, or financial metric. It carries liability — if wrong, someone pays.

| Field | Description | Example |
|-------|-------------|---------|
| `deal_id` | Which deal this fact pertains to | `deal_abc123` |
| `policy_id` | Which insurance policy covers it (optional) | `pol_xyz789` |
| `category` | Classification | `financial`, `identity`, `collateral`, `compliance`, `legal` |
| `subject_type` / `subject_id` | What the fact is about | `spread` / `spread_2025q4` |
| `assertion` | Human-readable statement | "Borrower DSCR >= 1.25 as of 2025-Q4" |
| `metric` | Machine-readable key | `dscr` |
| `operator` | Comparison | `>=` |
| `asserted_value` | The attested value | `"1.45"` |
| `confidence` | System confidence (0.0–1.0) | `0.95` |
| `liability_amount` | What's at risk if wrong | $250,000 |
| `evidence` | References supporting the fact | `[{type: "spread", id: "sp_123"}]` |
| `status` | Lifecycle | `active` → `invalidated` when proven wrong |
| `expires_at` | Facts can expire, requiring re-attestation | `2026-06-30T00:00:00Z` |

Key design decisions:

- **Facts can be uninsured.** A fact without a `policy_id` is still tracked but carries naked liability. The coverage exposure endpoint makes this visible.
- **Confidence is explicit.** The system records how confident it is. A 0.99 confidence KYC fact is different from a 0.7 confidence collateral estimate.
- **Evidence is linked.** Each fact points to the artifacts that support it — spreads, documents, covenant test results. This creates an audit chain from assertion → evidence → source data.
- **Facts expire.** A DSCR assertion from Q4 2025 should not be relied upon in Q3 2026. Expiration forces re-attestation.

### Liability Claims

When an attested fact is proven wrong, a claim is filed against the covering policy.

| Field | Description | Example |
|-------|-------------|---------|
| `fact_id` | The fact that was wrong | `fact_abc123` |
| `policy_id` | The policy being claimed against | `pol_xyz789` |
| `deal_id` | The deal involved | `deal_abc123` |
| `claim_type` | Nature of the error | `misrepresentation`, `error`, `omission`, `fraud` |
| `description` | What went wrong | "Actual DSCR was 0.95, not 1.45. Borrower provided falsified financials." |
| `claimed_amount` | Loss amount | $150,000 |
| `approved_amount` | What insurance pays (after decide) | $120,000 |
| `status` | Lifecycle | `filed` → `under_review` → `approved` / `denied` |

When a claim is **approved**, the policy's `aggregate_used` increases. When `aggregate_used >= aggregate_limit`, the policy status transitions to `exhausted`.

---

## Data Architecture

### Schema (Three New Tables)

```sql
── insurance_policies ──────────────────────────────────────
  id              TEXT PRIMARY KEY
  tenant_id       TEXT NOT NULL
  name            TEXT NOT NULL
  provider        TEXT NOT NULL
  policy_number   TEXT NOT NULL
  coverage_type   TEXT NOT NULL          -- E&O | R&W | fidelity | cyber
  coverage_limit  INTEGER NOT NULL       -- minor units, max per-claim
  deductible      INTEGER DEFAULT 0      -- minor units
  premium         INTEGER NOT NULL       -- minor units, what we pay
  aggregate_limit INTEGER NOT NULL       -- minor units, max total
  aggregate_used  INTEGER DEFAULT 0      -- running total
  effective_from  TEXT NOT NULL           -- ISO datetime
  effective_until TEXT NOT NULL           -- ISO datetime
  status          TEXT DEFAULT 'active'  -- active | expired | cancelled | exhausted
  metadata        TEXT (JSON)
  created_at      TEXT NOT NULL
  updated_at      TEXT

── liability_facts ─────────────────────────────────────────
  id                  TEXT PRIMARY KEY
  tenant_id           TEXT NOT NULL
  deal_id             TEXT NOT NULL → deals(id)
  policy_id           TEXT → insurance_policies(id)    -- nullable (uninsured)
  category            TEXT NOT NULL     -- financial | identity | collateral | compliance | legal
  subject_type        TEXT NOT NULL     -- deal | entity | facility | covenant | spread
  subject_id          TEXT NOT NULL
  assertion           TEXT NOT NULL     -- human-readable
  metric              TEXT              -- machine-readable key
  operator            TEXT              -- >= | <= | > | < | == | is_true
  asserted_value      TEXT              -- string-encoded
  confidence          REAL              -- 0.0 to 1.0
  liability_amount    INTEGER NOT NULL  -- minor units
  evidence            TEXT (JSON)       -- [{type, id, description}]
  status              TEXT DEFAULT 'active'  -- active | superseded | challenged | invalidated | expired
  attested_by         TEXT NOT NULL
  attested_at         TEXT NOT NULL
  expires_at          TEXT              -- nullable
  invalidated_at      TEXT
  invalidated_by      TEXT
  invalidation_reason TEXT
  created_at          TEXT NOT NULL

── liability_claims ────────────────────────────────────────
  id                  TEXT PRIMARY KEY
  tenant_id           TEXT NOT NULL
  fact_id             TEXT NOT NULL → liability_facts(id)
  policy_id           TEXT NOT NULL → insurance_policies(id)
  deal_id             TEXT NOT NULL → deals(id)
  claim_type          TEXT NOT NULL     -- misrepresentation | error | omission | fraud
  description         TEXT NOT NULL
  claimed_amount      INTEGER NOT NULL  -- minor units
  approved_amount     INTEGER           -- minor units (after decision)
  status              TEXT DEFAULT 'filed'  -- filed | under_review | approved | denied | settled | withdrawn
  filed_by            TEXT NOT NULL
  filed_at            TEXT NOT NULL
  decided_at          TEXT
  decided_by          TEXT
  decision_rationale  TEXT
  evidence            TEXT (JSON)
  created_at          TEXT NOT NULL
```

### Indexes

```sql
idx_liability_facts_deal      ON liability_facts(deal_id)
idx_liability_facts_policy    ON liability_facts(policy_id)
idx_liability_facts_status    ON liability_facts(status)
idx_liability_claims_deal     ON liability_claims(deal_id)
idx_liability_claims_policy   ON liability_claims(policy_id)
idx_insurance_policies_tenant ON insurance_policies(tenant_id)
```

---

## API Surface

### Insurance Policies

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/insurance-policies` | Register a new policy |
| `GET` | `/v1/insurance-policies` | List policies for tenant |
| `GET` | `/v1/insurance-policies/{policyId}` | Get policy details |

### Liability Facts

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/deals/{dealId}/liability-facts` | Attest a new fact |
| `GET` | `/v1/deals/{dealId}/liability-facts` | List facts for a deal |
| `GET` | `/v1/liability-facts/{factId}` | Get fact details |
| `POST` | `/v1/liability-facts/{factId}/challenge` | Invalidate a fact |

### Liability Claims

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/liability-facts/{factId}/claims` | File a claim against coverage |
| `GET` | `/v1/deals/{dealId}/liability-claims` | List claims for a deal |
| `POST` | `/v1/liability-claims/{claimId}/decide` | Approve or deny a claim |

### Coverage Exposure

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/deals/{dealId}/coverage-exposure` | Total liability vs. insured vs. uninsured |

### Coverage Exposure Response Shape

```json
{
  "deal_id": "deal_abc123",
  "total_liability": 45000000,
  "total_insured": 40000000,
  "total_uninsured": 5000000,
  "active_facts": 3,
  "policies": [
    {
      "policy_id": "pol_xyz789",
      "policy_name": "E&O Policy 2026",
      "coverage_limit": 500000000,
      "aggregate_limit": 2000000000,
      "aggregate_used": 12000000,
      "aggregate_remaining": 1988000000,
      "facts_covered": 2,
      "liability_covered": 40000000
    }
  ]
}
```

---

## Lifecycle Flows

### Happy Path: Attest → Hold → Expire

```
Underwriter spreads financials
    │
    ▼
LOS computes DSCR = 1.45
    │
    ▼
POST /liability-facts { assertion: "DSCR >= 1.25", asserted_value: "1.45", confidence: 0.95 }
    │
    ▼
Fact is ACTIVE, covered by E&O policy, expires in 6 months
    │
    ▼
6 months later: fact expires, status → "expired"
    │
    ▼
Re-attestation required with fresh spread data
```

### Failure Path: Attest → Challenge → Claim → Payout

```
Underwriter attests "DSCR >= 1.25" with value 1.45
    │
    ▼
3 months later: borrower defaults, forensic review reveals actual DSCR was 0.95
    │
    ▼
POST /liability-facts/{id}/challenge { reason: "Falsified financials" }
    │
    ▼
Fact status → "invalidated"
    │
    ▼
POST /liability-facts/{id}/claims { claim_type: "misrepresentation", claimed_amount: 1500000 }
    │
    ▼
Claim status: "filed" — insurance review begins
    │
    ▼
POST /liability-claims/{id}/decide { status: "approved", approved_amount: 1200000 }
    │
    ▼
Policy aggregate_used += 1200000
    │
    ▼
If aggregate_used >= aggregate_limit → policy status → "exhausted"
```

### Policy Exhaustion

```
Policy: aggregate_limit = $10M, aggregate_used = $8M
    │
    ▼
New claim approved: $3M
    │
    ▼
aggregate_used = $11M (>= $10M)
    │
    ▼
Policy status → "exhausted"
    │
    ▼
New facts cannot reference this policy
    │
    ▼
Existing active facts become effectively uninsured (coverage exposure reflects this)
```

---

## Economics

### Unit Economics of a Liability-Bearing Fact

```
Revenue per deal:       $5,000  (attestation fee, or baked into origination fee)
Insurance premium:       $250   (allocated per-deal from annual premium)
Expected loss:            $50   (claim rate × avg payout, improves with accuracy)
Token cost:               $10   (AI compute for verification)
─────────────────────────────
Net margin per deal:   $4,690   (93.8%)
```

The key insight: **accuracy is directly monetizable**. Every percentage point improvement in fact accuracy reduces claim rate, which drops straight to the bottom line. This is the opposite of the tool model where quality improvements don't change revenue.

### Risk Tiers

Not all facts carry equal risk. The system should support risk-based pricing:

| Category | Typical Confidence | Typical Liability | Insurance Cost |
|----------|-------------------|-------------------|----------------|
| Financial (computed ratios) | 0.95+ | High | Medium |
| Identity (KYC/KYB) | 0.99+ | Medium | Low |
| Collateral (valuations) | 0.80–0.90 | Very High | High |
| Compliance (regulatory) | 0.90+ | High | Medium |
| Legal (no litigation) | 0.70–0.85 | Medium | High |

---

## Integration with Existing System

The liability layer wraps around — not replaces — the existing deal lifecycle.

### Where Facts Are Generated

| Deal Stage | Facts Generated | Source |
|------------|----------------|--------|
| **Broker** | None (too early) | — |
| **Origination** | Identity facts (KYC verified, registration confirmed) | Entity service, documents |
| **Underwriting** | Financial facts (DSCR, leverage, liquidity), collateral facts | Spread service, covenant tests |
| **Closing** | Compliance facts (all covenants pass, facility terms confirmed) | Covenant service, facility service |
| **Monitoring** | Ongoing financial facts (quarterly re-attestation), compliance facts | Spread service, monitoring service |

### Audit Trail Integration

All liability operations produce audit events using the existing `AuditService`:

| Event Type | When |
|------------|------|
| `LIABILITY_FACT_ATTESTED` | New fact created |
| `LIABILITY_FACT_INVALIDATED` | Fact challenged or expired |
| `LIABILITY_CLAIM_FILED` | Claim filed against policy |
| `LIABILITY_CLAIM_DECIDED` | Claim approved or denied |

### Agent Integration

The agent layer (`packages/agent/`) would expose liability-aware outcomes:

```typescript
// Instead of: "Here are the financials"
// Now: "Here are the financials, and we stand behind them"

interface LiabilityAwareStatus {
  stage: string;
  attested_facts: Array<{
    assertion: string;
    confidence: number;
    covered: boolean;
    liability_amount: number;
  }>;
  coverage_exposure: {
    total_liability: number;
    total_insured: number;
    total_uninsured: number;
  };
}
```

---

## Jobs to Be Done

| ID | Job to be Done | User Story | Priority |
|----|----------------|------------|----------|
| L-01 | Register insurance coverage | As a risk manager, I need to register our E&O and R&W policies so the system knows what's covered | P0 |
| L-02 | Attest facts during underwriting | As an underwriter, I need the system to attest to the financial facts I've computed so we can stand behind them | P0 |
| L-03 | View coverage exposure per deal | As a risk manager, I need to see how much liability is insured vs. uninsured on each deal | P0 |
| L-04 | Challenge a fact when proven wrong | As a risk manager, I need to invalidate a fact that has been disproven | P0 |
| L-05 | File a claim against coverage | As a risk manager, I need to file a claim when a liability fact caused a loss | P0 |
| L-06 | Decide claims (approve/deny) | As an insurance coordinator, I need to record claim decisions and track payouts | P0 |
| L-07 | Track policy aggregate usage | As a risk manager, I need to see how much of our coverage has been consumed | P1 |
| L-08 | Auto-attest from covenant tests | As an underwriter, I want covenant test results to automatically generate liability facts | P1 |
| L-09 | Expire and re-attest facts | As a risk manager, I need facts to expire and require re-attestation with fresh data | P1 |
| L-10 | Portfolio-level exposure dashboard | As a CRO, I need to see aggregate liability exposure across all deals | P2 |
| L-11 | Confidence-weighted pricing | As a product owner, I want to price attestation fees based on confidence and risk tier | P2 |
| L-12 | Auto-generate facts from spreads | As an underwriter, I want the system to automatically generate financial facts when I upload a spread | P2 |

---

## Gap Analysis

| Gap ID | Missing Capability | Impact | Effort | Notes |
|--------|-------------------|--------|--------|-------|
| L-GAP-01 | **No liability layer exists** | Core feature, must be built from scratch | Large | Three new tables, one new service, routes, schemas |
| L-GAP-02 | **No insurance provider integration** | Manual policy registration; no real-time coverage verification | Low | Phase 2; manual entry is sufficient for V1 |
| L-GAP-03 | **No automatic fact generation** | Underwriters must manually attest; no auto-attest from covenant tests or spreads | Medium | Phase 2; manual attestation first, automation later |
| L-GAP-04 | **No portfolio-level exposure** | Can only view per-deal; CRO cannot see aggregate | Medium | Phase 2; add after per-deal is validated |
| L-GAP-05 | **No fact expiration enforcement** | Facts with `expires_at` are not automatically transitioned to `expired` | Low | Cron job or check-on-read pattern |
| L-GAP-06 | **No pricing model** | No way to compute attestation fees or risk-based pricing | Low | Phase 3; business model work, not engineering |
| L-GAP-07 | **No insurance API integration** | Cannot submit claims electronically to carriers | Low | Phase 3; depends on carrier APIs |
| L-GAP-08 | **No re-attestation workflow** | No triggered workflow when a fact expires | Medium | Phase 2; link to monitoring alerts |

---

## Implementation Phases

### Phase 1: Foundation (MVP)

Build the three-table model, service, routes, and conformance tests. Manual policy registration, manual fact attestation, manual claim filing.

**Deliverables:**
- `insurance_policies`, `liability_facts`, `liability_claims` tables
- `LiabilityService` with full CRUD + challenge + claim lifecycle
- API routes (11 endpoints)
- JSON schemas (4 schemas)
- Conformance tests (~22 tests)
- Coverage exposure endpoint

**Success criteria:** A risk manager can register a policy, an underwriter can attest facts on a deal, and when a fact is proven wrong, a claim can be filed and decided with full audit trail.

### Phase 2: Automation

Connect the liability layer to existing services. Covenant test results auto-generate facts. Spread uploads auto-attest financial metrics. Fact expiration triggers monitoring alerts.

**Deliverables:**
- Auto-attestation hooks in `CovenantService.test()` and `SpreadService.create()`
- Expiration check in fact reads (or scheduled job)
- Re-attestation alerts via `MonitoringService`
- Portfolio-level exposure aggregation endpoint

### Phase 3: Economics

Build the pricing and analytics layer. Risk-based attestation pricing. Loss ratio tracking. Insurance carrier API integration.

**Deliverables:**
- Pricing engine for attestation fees
- Loss ratio dashboard (claims paid / premiums paid)
- Carrier submission API integration
- Confidence calibration (are 0.95 confidence facts actually right 95% of the time?)

---

## Open Questions

1. **Should facts be immutable?** Current design allows status transitions (active → invalidated). Should we instead create a new "correction" fact and mark the old one as superseded? This is more consistent with the audit-everything philosophy.

2. **Who attests?** Is it the underwriter (human), the system (computed from spread data), or both? If the system auto-attests from a covenant test, the confidence should reflect the quality of the input data, not just the computation.

3. **What happens to deals when their covering policy is exhausted?** Should the system prevent new attestations against an exhausted policy? Should it alert? Should it require a new policy before the deal can progress?

4. **How does this interact with sandboxes?** Can you attest facts in a sandbox (what-if analysis of liability exposure)? Or are facts always on the main branch?

5. **Is confidence calibrated or aspirational?** If an underwriter says "confidence: 0.95" but their track record shows 80% accuracy, should the system override? This gets into the territory of underwriter performance scoring.

6. **Regulatory implications?** Making formal assertions about loan characteristics may trigger regulatory requirements depending on jurisdiction. Need legal review of what "attestation" means in the context of lending law.

7. **Should the LOS operator be the insured or the insurer?** The current model assumes the LOS operator buys insurance. An alternative: the LOS operator *is* the insurer (self-insurance with reserves), using the system to track exposure. Both models work with the same data architecture.

---

*This document describes a strategic capability for Open LOS. Implementation should follow the phased approach above, starting with the foundation tables and manual workflows before adding automation and economics.*
