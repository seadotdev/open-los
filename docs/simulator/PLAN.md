# Simulator Plan

## Objective

Build a ledger-correct, reproducible simulation that lets you:

1. **Prove the LOS increases lender throughput and reduces friction** (token/ops efficiency, fewer dropped tasks, better auditability) when managing many concurrent deals.
2. **Benchmark LLM underwriting quality** from P&L + balance sheet + bank statements, comparing LOS-tools vs raw-files holdouts, including macro stress and fraud packs.
3. **Later, test "shrewd operator" behavior** (businesses competing, taking loans, gaming incentives) once (1) and (2) are solid.

## Compromises

- **Snapshots/runs first** (reproducible benchmarks) vs always-on universe (marketing later).
- **Start clean, then add mess:** clean artifacts and one bank account in v0; introduce multi-account, AR/AP timing, and messy docs only when paired with CLIs that consolidate/audit them.
- **One product, one decision early:** start with a single facility type (e.g., term loan) and approve/decline outputs; add pricing/covenants/multi-facility later.
- **Truth vs perception split:** TigerBeetle is canonical money truth; lenders/LOS can drift and be wrong—reconciliation/audit tools are the product.
- **Coordination later:** book transfer/merge is tested early as LOS mechanics; lender-to-lender negotiation/coordination comes later.

## Roadmap

### v0 — Foundation

TigerBeetle ledger + seeded sim runner + scenario pack format + harness (LOS vs raw-file, bash sandbox).

### v1 — Underwriting + Ops MVP

- Clean P&L / BS / bank, single account, working-cap templates, one facility type, approve/decline.
- Core CLI: `deal/inbox`, `ingest+validate`, `risk snapshot`, `audit/reconcile`.
- Benchmark Pack A (clean baseline).

### v2 — Macro Stress + Servicing

- Add a "Covid/GFC-like" shock pack; delinquency/collections task load.
- CLI: `servicing status/tasklist`, `portfolio summary/stress`.
- Benchmark Pack B (stress).

### v3 — Fraud Pack v1

- Inject a small set of fraud archetypes.
- CLI: `fraud scan`, `provenance report`, stronger `ingest validate`.
- Benchmark Pack C (fraud).

### v4+ — Capability-gated complexity expansion

- **Multi-bank accounts** ⇄ `bank consolidate/anomalies`
- **AR/AP timing** ⇄ `working-cap snapshot/reconcile`
- **Multi-facility + waterfalls** ⇄ `exposure/payment apply/covenants`
- **Book purchase & multi-tenant merge** ⇄ `transfer import/reconcile` + audit pack
- **Coordination/negotiation** (optional) with commitment/ack scaffolding
- **Business "shrewdness" gameplay** (objective 3) once the above is stable
