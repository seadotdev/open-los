# Primitives Alignment Assessment

## Warburg's "New Primitives" Theory — Applied to Open LOS

> This assessment maps Bettina Warburg's four primitives of the Agentic Economy against the Open LOS architecture, identifies areas of alignment and gaps, and proposes concrete changes to position Open LOS as infrastructure for the new digital economy.

---

## The Theory

Warburg identifies four fundamental building blocks for a new digital economy — an "Agentic Economy" in which value flows not from clicks or impressions but from **verifiable actions**. Each primitive rests on a different type of graph: networked data structures that connect, verify, and trace digital activity in ways the current web cannot.

### The Four Primitives

**1. Intention** — Systems for expressing and broadcasting what users want. Not imperative commands ("create a deal") but declarative goals ("I need $2M in working capital by Q3, secured against receivables"). Intention graphs connect wants to capabilities, enabling discovery and matching.

**2. Context** — Verified memory and decisions that agents can draw upon. Not just chat history, but structured, trustworthy knowledge: "this borrower's DSCR has been above 1.25 for 8 consecutive quarters, verified by audited financials." Context must be portable, verifiable, and composable across agents and sessions.

**3. Attribution** — Cryptographic proof of who contributed what. When an agent spreads a financial statement, an underwriter approves a covenant waiver, and a model recommends approval — each contribution must be independently verifiable. Attribution enables accountability, compensation, and trust in multi-agent systems.

**4. Simulation** — Environments for testing agent behavior before deployment. Before an AI agent processes real loans, it should prove competence in sandboxed environments with realistic scenarios. Simulation enables trust calibration: "this agent succeeded on 847/850 test scenarios for SBA lending."

Together, these primitives create the underpinnings of an economy where **AI agents are first-class economic actors** — expressing intentions, drawing on verified context, having their contributions attributed, and proving their capabilities through simulation.

---

## Primitive 1: Intention

### What Open LOS Has

The system is fundamentally **imperative**. Users and agents issue commands:

- `POST /v1/deals` — create a deal
- `POST /v1/deals/:id/stage-transitions` — advance a stage
- `POST /v1/spreads` — create a spread

The **agent layer** (`packages/agent`) shows emergent intention patterns:
- `submitDeal()` — a customer expresses a high-level outcome ("originate this loan")
- The AI Native Workflow doc describes "Jobs" with goals: *"Process this deal: spread the financials, analyze the business, prepare a credit memo"*

The **stage machine** encodes a linear intention (broker → origination → underwriting → closing → monitoring), and stage guards represent preconditions for advancing toward the goal.

### What's Missing

**No intention graph.** Intentions are ephemeral — they exist as prompts passed to AI agents, not as persistent, queryable objects in the system. There's no way to ask: "What are the active intentions for this deal?" or "Which deals have a stated goal of closing by March?"

**No goal decomposition.** When an agent receives "originate this loan," it must figure out the sub-steps itself every time. The system doesn't maintain a structured plan that tracks progress toward a declared outcome.

**No broadcasting or matching.** A borrower can't broadcast "I need equipment financing, $500K, manufacturing sector" and have the system match it against lender appetites. Intentions flow one direction: lender creates deal, lender drives process.

**No desired-state declarations.** The system can't express: "The desired state for this deal is: DSCR ≥ 1.25, all covenants passing, facility approved, documents complete." It can test each of these individually, but there's no unified goal object that the system works toward.

### Alignment Score: 2/10

### What Would Close the Gap

```
intentions table:
  id, deal_id, declared_by, type ("origination_goal" | "borrower_need" | "portfolio_target"),
  desired_state (JSON: conditions that define success),
  deadline, priority, status ("active" | "achieved" | "abandoned"),
  decomposition (JSON: sub-intentions with completion tracking)
```

- **Borrower-declared intentions**: "I need $2M working capital" becomes a first-class object
- **Lender-declared intentions**: "Close this deal by Q2 with DSCR ≥ 1.25" becomes trackable
- **Agent plans as intention graphs**: When an agent plans work, the plan is persisted as a decomposed intention tree — not just executed and forgotten
- **Matching primitive**: Borrower intentions matched against lender appetite criteria

---

## Primitive 2: Context

### What Open LOS Has

This is the project's **second-strongest primitive**. Significant context infrastructure exists:

**Audit trail as decision memory.** The append-only audit log (`audit_events`) with monotonic sequencing captures every mutation with actor, timestamp, changes, and metadata. This is a rich decision record — you can reconstruct the entire history of any deal.

**AI conversation persistence.** The `ai_conversations` and `ai_messages` tables store full conversation history per deal/stage, including tool calls, token counts, and model selection. Agents can reference prior sessions.

**Structured financial context.** Spreads with computed ratios, covenant test results with pass/fail/warning status, monitoring alerts with severity — these are structured, queryable context that agents draw upon.

**Entity graph as relationship context.** The entity-relationship model (companies, people, ownership, guarantees, directorships) provides structural context for underwriting decisions.

**Sandbox checkpoints as temporal context.** The sandbox system captures full snapshots at decision points, enabling "at this point in time, here's what we knew and what we decided."

### What's Missing

**Context is not verified.** The audit trail is append-only within the application, but there's no cryptographic proof. An operator with database access could modify historical records. There's no way for an external party (auditor, regulator, borrower) to verify that the context hasn't been tampered with.

**Context is not portable.** Each Open LOS instance is a silo. When a loan is syndicated, participanting lenders can't share verified context. When a borrower applies to multiple lenders, they start from zero each time. Context doesn't travel.

**No "verified vs. asserted" distinction.** Entity data, financial statements, and covenant inputs are all treated as equally trustworthy. There's no metadata tracking: "this revenue figure was extracted by AI from an audited financial statement uploaded by the borrower's accountant" vs. "this was manually entered by an analyst."

**Decision lineage is implicit.** You can reconstruct the chain (document uploaded → spread created → ratio computed → covenant tested → decision made) by querying the audit trail, but there's no explicit decision lineage graph linking inputs to reasoning to outputs.

**Agent context loading is ad-hoc.** The agent's `getStatus()` method loads deal state, documents, and audit history — but this is hardcoded, not a standardized context schema. Different agents would build context differently, with no guarantee of consistency.

### Alignment Score: 7/10

### What Would Close the Gap

- **Cryptographic context commitment**: Hash-chain audit events (each event includes hash of prior event). Periodically publish Merkle roots. External parties can verify: "this context existed at time T and hasn't been modified."
- **Verification metadata**: Every data point gets a `provenance` object: `{ source, source_type ("audited_financial" | "self_reported" | "ai_extracted"), verified_by, confidence, timestamp }`
- **Decision lineage graph**: Explicit links between inputs → reasoning → outputs → approvals. Not just "what changed" but "why it changed and based on what."
- **Portable context format**: Standard serialization of deal context that can be shared across instances, verified by recipients, and used as input to other systems.

---

## Primitive 3: Attribution

### What Open LOS Has

This is the project's **strongest existing primitive**:

**Actor tracking on everything.** Every audit event records `actor` (user ID, agent ID, or "system"). Every document records `created_by`. Every conversation records `created_by`. Every sandbox checkpoint records who created it.

**Immutable, sequenced event log.** Audit events have monotonic sequence numbers, preventing gaps or reordering. The append-only design means historical attribution can't be erased.

**AI session attribution.** When an AI agent operates the system, the full session is logged: which model, what tool calls, what decisions, how many tokens. The Ledger Style document mandates: "Humans and AI get the same audit treatment. No second-class actors."

**Stage transition attribution with rationale.** Every stage transition records who triggered it, what rationale was given, whether it was an override, and the full guard checklist snapshot at that moment.

**Multi-actor attribution.** The system tracks the difference between "system computed this ratio" and "analyst created this spread" and "credit lead approved this waiver." Different actors contribute different things, and each contribution is separately recorded.

### What's Missing

**No cryptographic signatures.** Attribution is based on database records, not cryptographic proof. The `actor` field is a string set by the API caller — it's not a signed assertion. There's no way to prove: "analyst_001 actually approved this, and this approval hasn't been forged."

**No contribution hashing.** When a document is uploaded, the `checksum` field exists in the schema but isn't consistently computed or validated. You can't prove: "this is the exact same document that was uploaded on January 15th."

**No decision signatures.** Approvals, waivers, and stage transitions are database records, not signed commitments. In a legal dispute, the attribution is only as trustworthy as the database operator.

**Weak multi-step attribution chains.** When an agent runs a multi-step workflow (spread financials → test covenants → generate memo → recommend approval), each step is individually attributed, but the causal chain between steps isn't explicitly modeled. You can reconstruct it from timestamps, but there's no explicit "this recommendation was based on these specific inputs."

### Alignment Score: 8/10

### What Would Close the Gap

```typescript
// Signed audit events
interface SignedAuditEvent {
  // ... existing fields ...
  content_hash: string;           // SHA-256 of event content
  previous_hash: string;          // Hash of prior event (chain integrity)
  actor_signature: string;        // Ed25519 signature by the actor
  actor_public_key: string;       // For independent verification
}

// Document integrity
interface DocumentAttestation {
  document_id: string;
  content_hash: string;           // SHA-256 of document bytes
  attested_by: string;
  attested_at: string;
  signature: string;
}

// Decision attribution chain
interface DecisionLineage {
  decision_id: string;
  decision_type: "approval" | "waiver" | "stage_transition" | "recommendation";
  inputs: Array<{
    type: "document" | "spread" | "covenant_test" | "prior_decision";
    id: string;
    content_hash: string;         // Prove these specific inputs were used
  }>;
  reasoning: string;
  decided_by: string;
  decision_signature: string;
}
```

- **Ed25519 key pairs per actor**: Each user/agent gets a signing key. Critical actions are signed.
- **Hash-chained audit events**: Each event references the hash of the prior event. Tampering with any event breaks the chain.
- **Document content hashing**: Compute and store SHA-256 on upload. Validate on retrieval.
- **Explicit decision lineage**: Link decisions to their specific inputs, not just timestamps.

---

## Primitive 4: Simulation

### What Open LOS Has

This is the most **architecturally interesting** primitive — the pieces exist but aren't connected:

**Sandbox system with version control.** The core sandbox service provides isolated, forkable environments with Git-style branching:
- Create a sandbox forked from a deal's current state
- Make experimental changes without affecting production data
- Checkpoint at decision points (full JSON snapshot)
- Compare outcomes between branches
- Restore to any prior checkpoint

**Simulation framework.** `packages/simulation` contains a sophisticated testing infrastructure:
- 200+ lending personas (commercial banks, SBA lenders, equipment finance, etc.)
- Scenario definitions with step-by-step workflows
- Capability gap detection: which features does each persona need?
- Suite-level reporting: success rates by business model, priority improvements

**Digital twin (Mambu).** `packages/twins/mambu-twin` faithfully replicates the Mambu loan accounting API surface, enabling testing of loan lifecycle operations against a known reference implementation.

**Conformance test suite.** 180+ YAML-driven tests that verify API behavior against specification. Any implementation that passes the suite is conformant.

### What's Missing

**Sandbox and simulation are disconnected.** The sandbox system (core) and the simulation framework (packages/simulation) don't talk to each other. An agent can't say: "Run this scenario in a sandbox and show me what happens." These are two halves of the same primitive that haven't been joined.

**No agent competence testing.** The simulation framework tests the *system's* capabilities, not the *agent's* capabilities. There's no mechanism for: "Before this AI agent handles real deals, prove it can succeed on 95% of test scenarios for SBA lending." Agent trust calibration is missing.

**No "what-if" analysis as a first-class operation.** A credit analyst can't ask: "What happens to covenant compliance if revenue drops 20%?" and get a simulated answer. The sandbox infrastructure *could* support this, but there's no API or workflow for it.

**No simulation-based onboarding.** New lender instances don't start with a simulated portfolio to prove the system handles their use case. Personas exist in the simulation framework but aren't used as onboarding templates.

**No continuous agent evaluation.** Agents aren't re-tested as the system evolves. There's no regression testing for agent behavior — only for API behavior (conformance tests).

### Alignment Score: 6/10

### What Would Close the Gap

**1. Wire sandbox into agent workflow:**
```
Agent receives task → creates sandbox fork → executes plan in sandbox →
user reviews simulated outcome → approves → agent applies to production
```

**2. Agent competence certification:**
```
Agent registers → runs persona-specific test suite → receives certification:
  "Agent X: certified for SBA_7a_lending, 847/850 scenarios passed,
   last tested 2026-02-20, weaknesses: [multi-collateral facilities]"
```

**3. What-if API:**
```
POST /v1/deals/:id/simulate
{
  "scenario": "revenue_stress",
  "parameters": { "revenue_change_pct": -20 },
  "evaluate": ["covenant_compliance", "dscr", "liquidity_runway"]
}
→ Returns simulated outcomes without modifying real data
```

**4. Continuous agent evaluation loop:**
```
On every system update → re-run agent test suites →
flag regressions → block deployment if critical scenarios fail
```

---

## Synthesis: The Agentic Economy and Lending

Warburg's four primitives describe the infrastructure for an economy where AI agents are first-class economic actors. Applied to lending, this vision looks like:

| Primitive | Agentic Lending Vision |
|---|---|
| **Intention** | A borrower's agent broadcasts: "Need $2M equipment financing, manufacturing, Northeast US." Lender agents with matching appetite discover and respond. Deal formation happens through intention matching, not cold outreach. |
| **Context** | Every decision in the deal carries verified context: audited financials with provenance, prior lending history with attestations, covenant compliance over time. Any agent entering the deal can trust the context because it's cryptographically verified, not just asserted. |
| **Attribution** | When the deal closes, every contribution is provably attributed: which agent extracted the financials, which model scored the risk, which human approved the exception. Attribution enables accountability and fair compensation in multi-agent workflows. |
| **Simulation** | Before any agent touches a real deal, it's been certified against hundreds of lending scenarios. The lender knows: "This agent handles covenant-heavy deals with 98% accuracy." The borrower knows: "This system has been tested against my exact business model." |

---

## Current Alignment Summary

| Primitive | Score | Open LOS Strength | Critical Gap |
|---|---|---|---|
| **Intention** | 2/10 | Stage machine implies linear intention | No goal graph, no broadcasting, no matching |
| **Context** | 7/10 | Excellent audit trail + AI conversations | Not verified, not portable, no provenance metadata |
| **Attribution** | 8/10 | Strong actor tracking, immutable log | No cryptographic proof, no decision lineage |
| **Simulation** | 6/10 | Sandbox + simulation framework exist | Disconnected from each other and from agents |

---

## Recommendations (Ordered by Impact and Feasibility)

### Tier 1: Connect What Already Exists (Weeks)

**1. Wire Sandbox ↔ Simulation ↔ Agent together.**
This is the single highest-leverage change. All three pieces exist independently. Connecting them creates the Simulation primitive immediately:
- Agent creates sandbox before executing multi-step plans
- Simulation scenarios can run inside sandboxes
- Users review simulated outcomes before committing to production

**2. Add decision lineage to the audit trail.**
Extend audit events with `input_refs` — explicit references to the data that informed each decision. This transforms the audit trail from a flat log into an attribution graph. Minimal schema change, massive increase in Attribution strength.

**3. Compute and validate document checksums.**
The `checksum` field already exists on the documents table. Actually compute SHA-256 on upload and validate on retrieval. Instant cryptographic attribution for documents.

### Tier 2: Build the Missing Primitive (1-2 Months)

**4. Introduce first-class Intentions.**
Add an `intentions` table. Let both borrowers and lenders declare desired outcomes. Let agents decompose intentions into plans. Track progress toward stated goals. This is the biggest architectural gap and the biggest differentiator if built.

**5. Add verification metadata to context.**
Every data point gets provenance: where it came from, who asserted it, what confidence level, whether it's been independently verified. This transforms context from "data in a database" to "verified memory."

**6. Agent competence certification.**
Use the simulation framework to test agents, not just system capabilities. Produce certifications: "Agent X is certified for persona Y with Z% success rate." This is the trust layer that makes the Agentic Economy work.

### Tier 3: Extend Across Boundaries (2-4 Months)

**7. Hash-chained audit events with external anchoring.**
Make the audit trail cryptographically verifiable by external parties. Each event hashes to the prior event; Merkle roots are periodically published. This makes Context and Attribution trustworthy across institutional boundaries.

**8. Portable context format for syndication.**
Define a standard serialization of deal context (with provenance and attribution) that can be shared between Open LOS instances or any conformant system. This makes Context portable.

**9. Intention broadcasting protocol.**
Let borrower agents broadcast intentions to a network of lender instances. This turns Open LOS from a single-institution tool into infrastructure for an intention-matching network.

---

## The Bottom Line

Open LOS has built strong internal infrastructure for two of the four primitives (Context and Attribution) and has the raw components for a third (Simulation). The most critical gap is **Intention** — the system has no way to represent, track, or match what participants actually want.

The deepest insight from Warburg's framework is that these primitives work **together as a system**: Intentions are matched based on verified Context, executed by agents with proven Simulation track records, and every contribution is recorded through Attribution. Open LOS's existing strengths — open source, API-first, AI-native, spec-as-tests — make it the ideal foundation for this architecture. No proprietary LOS could expose these primitives. An open lending protocol can.

The single most impactful near-term action is **connecting the sandbox, simulation, and agent systems** — turning three disconnected components into a unified Simulation primitive. This alone would differentiate Open LOS from every incumbent in the market.
