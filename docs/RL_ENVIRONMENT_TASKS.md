# RL Environment Tasks for Open LOS

> **Status:** Draft
> **Last Updated:** 2026-02-04
> **Source:** [Epoch AI - State of RL Environments](https://epoch.ai/gradient-updates/state-of-rl-envs)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Context: The RL Environment Landscape](#2-context-the-rl-environment-landscape)
3. [High-Value Task Categories](#3-high-value-task-categories)
4. [Task Specifications](#4-task-specifications)
5. [Grading & Verification](#5-grading--verification)
6. [Reward Hacking Prevention](#6-reward-hacking-prevention)
7. [Difficulty Calibration](#7-difficulty-calibration)
8. [Implementation Approach](#8-implementation-approach)
9. [Prioritization Matrix](#9-prioritization-matrix)

---

## 1. Executive Summary

This document identifies reinforcement learning (RL) environment tasks that can be built around Open LOS, a B2B lending CRM. Based on Epoch AI's January 2026 research on the state of RL environments, we focus on tasks that:

- **Are verifiable** - Clear pass/fail or scored grading
- **Support long-horizon interactions** - Multi-step workflows spanning multiple API calls
- **Are compositional** - Skills transfer across related tasks
- **Have enterprise value** - Directly map to real lending workflows

**Key insight from Epoch AI:** "Enterprise workflows are going to explode this year. Labs index very heavily on what's valuable and what is quantifiable, and enterprise workflows are perfect for that."

Open LOS is uniquely positioned because:
1. **API-first design** - No buggy UI clones needed; agents interact via clean REST/MCP
2. **Deterministic computations** - Financial ratios, covenant tests have verifiable outputs
3. **Existing conformance suite** - 161+ tests provide foundation for graders
4. **Multi-stage workflows** - 5-stage deal lifecycle provides natural long-horizon tasks

---

## 2. Context: The RL Environment Landscape

### 2.1 Key Findings from Epoch AI Research

| Finding | Implication for Open LOS |
|---------|-------------------------|
| Enterprise workflows are major growth area | Lending CRM workflows are high-value targets |
| Reward hacking is top concern | Must design robust graders using conformance tests |
| Long-horizon tasks are the future | Deal lifecycle spans days/weeks of agent interaction |
| Difficulty calibration matters (2-3% min pass rate) | Need graduated task difficulty |
| Tasks should be compositional | Lending skills (spreading, covenants, docs) build on each other |

### 2.2 Pricing Context

From Epoch AI interviews:
- Tasks: $200-$2,000 per task (up to $20k for complex SWE tasks)
- Environments: $20k-$300k depending on fidelity
- Compute per task during RL training: ~$2,400

This suggests investing in quality over quantity—a poorly designed task wastes the compute spent training on it.

### 2.3 Usage Modes

RL environments can be used for:
1. **Reinforcement Learning** (primary) - Training models via scored rollouts
2. **Benchmarking** - Evaluating model capabilities
3. **Supervised Fine-Tuning** - Using successful trajectories as training data

---

## 3. High-Value Task Categories

### 3.1 Deal Lifecycle Management (Highest Priority)

**Why:** Multi-hop, long-horizon tasks with clear verification criteria. The article specifically calls out "navigating through multiple tabs, browsers, and then submitting something that involves multi-hop steps."

**Open LOS Mapping:**
- 5-stage pipeline: Broker → Origination → Underwriting → Closing → Monitoring
- Stage guards provide clear pass/fail criteria
- Audit trail enables trajectory reconstruction

**Example Tasks:**
- Complete deal intake from broker submission to origination
- Prepare deal for underwriting committee (gather docs, create spread, link entities)
- Execute closing workflow (generate docs, track conditions precedent)
- Full end-to-end deal origination

### 3.2 Financial Spreading & Analysis

**Why:** Deterministic outputs (ratios match expected values). Similar to "Bloomberg terminal clone" example in Epoch article.

**Open LOS Mapping:**
- SpreadService computes ratios deterministically
- Line items must balance and categorize correctly
- Variance analysis between periods is verifiable

**Example Tasks:**
- Parse uploaded financial statements and populate spread
- Compute correct financial ratios from raw data
- Identify discrepancies between management accounts and audited financials
- Generate variance analysis with explanations

### 3.3 Covenant Setup & Monitoring

**Why:** Clear pass/fail grading, multi-step workflows, business-critical accuracy.

**Open LOS Mapping:**
- CovenantService with test/waiver mechanics
- Grace periods and alert thresholds
- Integration with spreads for ratio-based covenants

**Example Tasks:**
- Set up appropriate covenant package based on deal terms
- Detect covenant breach from new spread data
- Process waiver request with proper approval workflow
- Configure alerts for early warning

### 3.4 Entity Graph Management

**Why:** Graph correctness is verifiable, involves complex reasoning about relationships.

**Open LOS Mapping:**
- EntityService with relationship tracking
- Company/person/guarantor types
- Ownership chains and control relationships

**Example Tasks:**
- Build correct entity relationship graph from documents
- Identify ultimate beneficial owners
- Detect circular ownership or related party transactions
- Merge duplicate entities correctly

### 3.5 Document Management

**Why:** Clear verification (correct categorization), practical enterprise workflow.

**Open LOS Mapping:**
- DocumentService with phase-aware requirements
- Document checklists per stage
- Email attachment handling

**Example Tasks:**
- Categorize uploaded documents to correct types
- Identify missing required documents for stage progression
- Match email attachments to relevant deals
- Generate document checklist status

### 3.6 Approval Workflow Orchestration

**Why:** Multi-turn interactions, clear pass/fail on workflow correctness.

**Open LOS Mapping:**
- ApprovalService with multi-stage approvals
- Conditions precedent tracking
- Role-based routing

**Example Tasks:**
- Route approval to correct approvers based on deal size
- Track and verify conditions precedent completion
- Handle approval escalations correctly

---

## 4. Task Specifications

### 4.1 Deal Lifecycle Tasks

#### Task: Complete Broker Intake

```yaml
task_id: deal-lifecycle-001
name: Complete Broker Intake
difficulty: easy
estimated_pass_rate: 30-50%

description: |
  Given a deal in broker stage with uploaded documents,
  complete the intake process by extracting key information
  and transitioning to origination.

initial_state:
  deal:
    stage: broker
    borrower_name: "{{generated}}"
  documents:
    - type: application_form
      content: "{{generated_pdf}}"
    - type: management_accounts
      content: "{{generated_xlsx}}"

success_criteria:
  - deal.stage == "origination"
  - deal.requested_amount != null
  - deal.purpose != null
  - entities.count >= 1
  - entities[0].type == "company"

grader_type: deterministic
max_steps: 20
timeout_seconds: 300
```

#### Task: Full Deal Origination

```yaml
task_id: deal-lifecycle-010
name: Full Deal Origination (End-to-End)
difficulty: hard
estimated_pass_rate: 2-5%

description: |
  Take a deal from broker intake through to closing stage.
  This requires document gathering, entity setup, financial
  spreading, covenant configuration, and approval workflows.

initial_state:
  deal:
    stage: broker
    documents: [application_form]

success_criteria:
  - deal.stage == "closing"
  - spread.exists == true
  - spread.ratios.dscr != null
  - covenants.count >= 2
  - entities.count >= 2
  - relationships.guarantor_exists == true
  - approval.status == "approved"

grader_type: deterministic
max_steps: 100
timeout_seconds: 1800

subtasks:
  - Complete broker intake
  - Create entity graph
  - Upload and categorize documents
  - Create financial spread
  - Set up covenants
  - Submit for approval
  - Transition through stages
```

### 4.2 Financial Spreading Tasks

#### Task: Create Spread from Financial Statements

```yaml
task_id: spread-001
name: Create Spread from Financial Statements
difficulty: medium
estimated_pass_rate: 10-20%

description: |
  Given uploaded financial statements (P&L, Balance Sheet),
  create a properly structured spread with correct line items
  and verify computed ratios.

initial_state:
  deal:
    stage: underwriting
  documents:
    - type: audited_accounts
      content: "{{generated_financials}}"
      # Contains: Revenue, COGS, Operating Expenses,
      # Interest, Tax, Assets, Liabilities, Equity

expected_output:
  spread:
    period: "FY2025"
    line_items:
      - category: revenue
        label: "Total Revenue"
        amount: "{{from_document}}"
      - category: cogs
        label: "Cost of Goods Sold"
        amount: "{{from_document}}"
      # ... etc

success_criteria:
  - spread.line_items.count >= 10
  - spread.ratios.gross_margin == expected_gross_margin (±0.1%)
  - spread.ratios.dscr == expected_dscr (±0.01)
  - spread.ratios.current_ratio == expected_current_ratio (±0.01)
  - line_items_balance == true

grader_type: deterministic
tolerance: 0.001  # For ratio comparisons
```

#### Task: Variance Analysis

```yaml
task_id: spread-005
name: Period-over-Period Variance Analysis
difficulty: medium
estimated_pass_rate: 15-25%

description: |
  Given spreads for two consecutive periods, identify
  material variances (>10% change) and categorize them
  as positive or negative indicators.

initial_state:
  spreads:
    - period: "FY2024"
      line_items: "{{generated}}"
    - period: "FY2025"
      line_items: "{{generated}}"

success_criteria:
  - variances.identified.count == expected_count
  - variances.each.direction_correct == true
  - variances.each.percentage_correct (±1%)
```

### 4.3 Covenant Tasks

#### Task: Configure Covenant Package

```yaml
task_id: covenant-001
name: Configure Standard Covenant Package
difficulty: medium
estimated_pass_rate: 15-25%

description: |
  Given a deal with spread and loan terms, configure
  an appropriate covenant package including financial
  and reporting covenants.

initial_state:
  deal:
    stage: underwriting
    facility_amount: 1000000
    facility_type: term_loan
  spread:
    ratios:
      dscr: 1.8
      leverage: 2.5
      current_ratio: 1.5

expected_covenants:
  - type: financial
    metric: dscr
    operator: gte
    threshold: 1.25  # With headroom below current
  - type: financial
    metric: leverage
    operator: lte
    threshold: 3.0
  - type: reporting
    frequency: quarterly

success_criteria:
  - covenants.count >= 3
  - covenants.dscr.threshold < spread.ratios.dscr
  - covenants.leverage.threshold > spread.ratios.leverage
  - covenants.each.test_frequency != null
```

#### Task: Process Covenant Breach

```yaml
task_id: covenant-010
name: Handle Covenant Breach Workflow
difficulty: hard
estimated_pass_rate: 5-10%

description: |
  A new spread shows a covenant breach. Process the breach
  correctly: run covenant test, determine breach status,
  request waiver if appropriate, or escalate.

initial_state:
  deal:
    stage: monitoring
  covenant:
    metric: dscr
    threshold: 1.25
    grace_period_days: 30
  new_spread:
    ratios:
      dscr: 1.15  # Below threshold

success_criteria:
  - covenant_test.created == true
  - covenant_test.status == "fail"
  - alert.created == true
  - one_of:
      - waiver.requested == true
      - escalation.created == true
```

### 4.4 Entity Graph Tasks

#### Task: Build Borrower Group Structure

```yaml
task_id: entity-001
name: Build Borrower Group from Documents
difficulty: medium
estimated_pass_rate: 10-20%

description: |
  Given corporate documents (formation docs, org chart),
  create the complete entity graph with ownership
  relationships and guarantor linkages.

initial_state:
  deal:
    stage: origination
  documents:
    - type: formation_documents
      content: "{{generated}}"  # Contains ownership info
    - type: org_chart
      content: "{{generated}}"

expected_entities:
  - type: company
    role: borrower
  - type: company
    role: parent
    ownership_pct: 100
  - type: person
    role: guarantor
    relationship_to_borrower: director

success_criteria:
  - entities.borrower.exists == true
  - entities.parent.exists == true
  - relationships.ownership.exists == true
  - relationships.ownership.percentage == 100
  - guarantor.linked == true
```

### 4.5 Document Management Tasks

#### Task: Document Triage

```yaml
task_id: document-001
name: Categorize and Triage Documents
difficulty: easy
estimated_pass_rate: 40-60%

description: |
  Given a batch of uploaded documents with generic names,
  categorize them correctly and flag any missing required
  documents for the current stage.

initial_state:
  deal:
    stage: origination
  documents:
    - filename: "scan001.pdf"  # Actually: management_accounts
    - filename: "doc.xlsx"      # Actually: bank_statements
    - filename: "signed.pdf"    # Actually: application_form

success_criteria:
  - documents.each.type_correct == true
  - missing_documents.identified == ["formation_documents", "id_verification"]
```

### 4.6 Multi-Turn Interaction Tasks

#### Task: Underwriting Q&A Session

```yaml
task_id: interaction-001
name: Handle Underwriter Information Requests
difficulty: hard
estimated_pass_rate: 5-10%

description: |
  Respond to a series of underwriter questions about a deal,
  retrieving correct information from documents, spreads,
  and entity data. Questions escalate in complexity.

initial_state:
  deal:
    stage: underwriting
    full_context: true  # All docs, spreads, entities populated

interaction_rounds:
  - question: "What is the borrower's DSCR?"
    expected: "{{spread.ratios.dscr}}"
  - question: "Who are the guarantors?"
    expected: "{{entities.where(role=guarantor).names}}"
  - question: "Has revenue grown year-over-year?"
    expected: "{{variance_analysis.revenue.direction}}"
  - question: "What's the primary use of funds?"
    expected: "{{deal.purpose}}"
  - question: "Are there any related party transactions in the bank statements?"
    expected: "{{transactions.related_party.summary}}"

success_criteria:
  - answers.each.factually_correct == true
  - answers.each.sourced_from_data == true
  - no_hallucinations == true

grader_type: llm_judge + deterministic_check
```

---

## 5. Grading & Verification

### 5.1 Grader Types

| Type | Use Case | Implementation |
|------|----------|----------------|
| **Deterministic** | Financial ratios, stage transitions, entity counts | Conformance test assertions |
| **Rule-based** | Document categorization, covenant configuration | Pattern matching + business rules |
| **LLM Judge** | Natural language responses, explanation quality | Secondary model evaluation |
| **Hybrid** | Complex tasks with multiple output types | Combine deterministic + LLM |

### 5.2 Leveraging Conformance Tests

Open LOS has 161+ conformance tests that can serve as grader foundations:

```typescript
// Example: Grader for stage transition task
async function gradeStageTransition(
  initialState: DealState,
  finalState: DealState,
  expectedStage: string
): Promise<GradeResult> {
  const checks = [
    {
      name: 'stage_correct',
      passed: finalState.deal.stage === expectedStage,
      weight: 0.4
    },
    {
      name: 'guards_satisfied',
      passed: await verifyGuardsSatisfied(finalState),
      weight: 0.3
    },
    {
      name: 'audit_trail_complete',
      passed: await verifyAuditTrail(initialState, finalState),
      weight: 0.2
    },
    {
      name: 'no_data_corruption',
      passed: await verifyDataIntegrity(finalState),
      weight: 0.1
    }
  ];

  const score = checks.reduce(
    (sum, c) => sum + (c.passed ? c.weight : 0),
    0
  );

  return {
    passed: score >= 0.7,
    score,
    checks
  };
}
```

### 5.3 Grading Infrastructure

```
┌─────────────────────────────────────────────────────────────┐
│                     Task Execution                          │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐                │
│  │ Initial │ -> │  Agent  │ -> │  Final  │                │
│  │  State  │    │ Actions │    │  State  │                │
│  └─────────┘    └─────────┘    └─────────┘                │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      Grader Pipeline                        │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Deterministic│  │  Rule-Based  │  │  LLM Judge   │     │
│  │   Checks     │  │   Checks     │  │  (optional)  │     │
│  │              │  │              │  │              │     │
│  │ - Ratios     │  │ - Doc types  │  │ - Reasoning  │     │
│  │ - Counts     │  │ - Covenants  │  │ - Quality    │     │
│  │ - Stages     │  │ - Workflows  │  │ - Coherence  │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                 │                 │              │
│         └────────────────┼────────────────┘              │
│                          │                                │
│                          ▼                                │
│                  ┌──────────────┐                         │
│                  │   Weighted   │                         │
│                  │    Score     │                         │
│                  └──────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Reward Hacking Prevention

### 6.1 Known Attack Vectors

From Epoch AI: "Reward hacking is a big issue. The model might cheat by searching up a solution, or if you're not careful with how you script the repo, by checking out future commits."

**Potential reward hacks for Open LOS:**

| Attack | Description | Mitigation |
|--------|-------------|------------|
| Direct DB manipulation | Bypass API to modify state | Sandboxed environment with API-only access |
| Audit trail tampering | Delete evidence of shortcuts | Immutable audit log, grader verifies sequence |
| Future state inspection | Read expected outputs | Grader state isolated from agent environment |
| Grader exploitation | Craft outputs that fool grader | Multi-layer grading (deterministic + LLM) |
| Shortcut transitions | Skip required intermediate steps | Verify audit trail shows proper sequence |

### 6.2 Environment Isolation

```typescript
// Task environment setup
interface TaskEnvironment {
  // Agent can only access these
  api: OpenLOSClient;  // Scoped to test tenant

  // Agent cannot access
  // - Database directly
  // - Grader state
  // - Expected outputs
  // - Other tenants
}

// Grader runs in separate context
interface GraderContext {
  initialSnapshot: DatabaseSnapshot;
  finalSnapshot: DatabaseSnapshot;
  auditEvents: AuditEvent[];
  expectedOutcomes: ExpectedOutcome[];
}
```

### 6.3 Audit Trail Verification

Every grader should verify the audit trail shows legitimate progression:

```typescript
function verifyLegitimateProgression(
  auditEvents: AuditEvent[],
  expectedSequence: string[]
): boolean {
  // Extract event types in order
  const actualSequence = auditEvents
    .sort((a, b) => a.seq - b.seq)
    .map(e => e.type);

  // Verify expected events occurred in order
  let expectedIdx = 0;
  for (const actual of actualSequence) {
    if (actual === expectedSequence[expectedIdx]) {
      expectedIdx++;
    }
    if (expectedIdx === expectedSequence.length) {
      return true;
    }
  }

  return false;
}

// Example: Verify stage transition was legitimate
verifyLegitimateProgression(auditEvents, [
  'DEAL_CREATED',
  'DOCUMENT_UPLOADED',
  'ENTITY_CREATED',
  'SPREAD_CREATED',
  'STAGE_TRANSITION'  // Must come after prerequisites
]);
```

---

## 7. Difficulty Calibration

### 7.1 Difficulty Tiers

From Epoch AI: "You want a minimum pass rate of around 2-3%, or at least one success out of 64 or 128 rollouts."

| Tier | Pass Rate | Characteristics | Examples |
|------|-----------|-----------------|----------|
| **Easy** | 30-60% | Single API call, clear instructions | Document categorization, single entity creation |
| **Medium** | 10-30% | Multi-step, some ambiguity | Create spread from documents, configure covenants |
| **Hard** | 2-10% | Long-horizon, complex reasoning | Full deal lifecycle, breach handling |
| **Expert** | <2% | Edge cases, adversarial conditions | Fraud detection, complex restructuring |

### 7.2 Difficulty Progression

Tasks should build on each other (compositional):

```
Level 1: Atomic Operations
├── Create entity
├── Upload document
├── Create single line item
└── Run covenant test

Level 2: Combined Operations
├── Create entity with relationships
├── Categorize document batch
├── Create full spread
└── Configure covenant package

Level 3: Workflows
├── Complete stage transition
├── Process approval request
├── Handle covenant breach
└── Generate closing documents

Level 4: End-to-End
├── Full deal origination
├── Portfolio monitoring cycle
└── Complex restructuring
```

### 7.3 Curriculum Design

```yaml
curriculum:
  name: "Lending Agent Training"

  phases:
    - name: "Foundations"
      duration_fraction: 0.2
      tasks:
        - document-001  # Easy categorization
        - entity-001    # Basic entity creation
        - spread-001    # Simple spreading
      target_pass_rate: 0.4

    - name: "Core Skills"
      duration_fraction: 0.4
      tasks:
        - spread-005    # Variance analysis
        - covenant-001  # Covenant configuration
        - deal-lifecycle-001  # Stage transitions
      target_pass_rate: 0.2

    - name: "Advanced"
      duration_fraction: 0.3
      tasks:
        - covenant-010  # Breach handling
        - interaction-001  # Multi-turn Q&A
        - deal-lifecycle-005  # Multi-stage progression
      target_pass_rate: 0.1

    - name: "Expert"
      duration_fraction: 0.1
      tasks:
        - deal-lifecycle-010  # Full end-to-end
      target_pass_rate: 0.03
```

---

## 8. Implementation Approach

### 8.1 Phase 1: Foundation (Weeks 1-2)

**Goal:** Basic task infrastructure and easy tasks

- [ ] Create `packages/rl-tasks/` package structure
- [ ] Implement task runner with state snapshotting
- [ ] Build deterministic grader framework
- [ ] Implement 5 easy tasks (document, entity basics)
- [ ] Set up task result logging

**Deliverables:**
- Task execution framework
- 5 easy tasks with graders
- Basic metrics dashboard

### 8.2 Phase 2: Core Tasks (Weeks 3-4)

**Goal:** Medium difficulty tasks covering main workflows

- [ ] Implement spread creation tasks (3 variants)
- [ ] Implement covenant tasks (3 variants)
- [ ] Implement entity graph tasks (2 variants)
- [ ] Implement stage transition tasks (3 variants)
- [ ] Add rule-based graders

**Deliverables:**
- 11 medium tasks with graders
- Grader accuracy benchmarks
- Task difficulty calibration data

### 8.3 Phase 3: Long-Horizon Tasks (Weeks 5-6)

**Goal:** Hard tasks requiring multi-step reasoning

- [ ] Implement multi-turn interaction tasks
- [ ] Implement full deal lifecycle tasks
- [ ] Implement breach handling workflows
- [ ] Add LLM judge graders
- [ ] Implement reward hacking tests

**Deliverables:**
- 5 hard tasks with hybrid graders
- Reward hacking test suite
- Curriculum definition

### 8.4 Phase 4: Production Readiness (Weeks 7-8)

**Goal:** Scalable task generation and distribution

- [ ] Implement synthetic data generation for tasks
- [ ] Build task variant generation (parameterized tasks)
- [ ] Create task distribution API
- [ ] Add monitoring and analytics
- [ ] Documentation and examples

**Deliverables:**
- 100+ task variants
- Task distribution API
- Complete documentation

---

## 9. Prioritization Matrix

### 9.1 Task Category Scoring

| Category | Verifiability | Long-Horizon | Compositional | Enterprise Value | **Total** |
|----------|---------------|--------------|---------------|------------------|-----------|
| Deal Lifecycle | 5 | 5 | 5 | 5 | **20** |
| Financial Spreading | 5 | 3 | 4 | 5 | **17** |
| Covenant Monitoring | 5 | 3 | 3 | 5 | **16** |
| Entity Graph | 5 | 2 | 3 | 4 | **14** |
| Approval Workflows | 4 | 4 | 3 | 4 | **15** |
| Document Management | 4 | 2 | 3 | 3 | **12** |

### 9.2 Recommended Implementation Order

1. **Deal Lifecycle** - Highest value, showcases platform capabilities
2. **Financial Spreading** - Highly verifiable, core lending skill
3. **Covenant Monitoring** - Critical for monitoring stage, clear grading
4. **Approval Workflows** - Good multi-turn characteristics
5. **Entity Graph** - Enables more complex deal tasks
6. **Document Management** - Supporting skill for other tasks

### 9.3 Task Portfolio Target

For a complete RL training curriculum:

| Difficulty | Count | Purpose |
|------------|-------|---------|
| Easy | 20 | Warm-up, basic skill acquisition |
| Medium | 40 | Core skill development |
| Hard | 15 | Advanced reasoning, long-horizon |
| Expert | 5 | Stretch goals, edge cases |
| **Total** | **80** | |

With parameterized variants, this can expand to 500+ unique task instances.

---

## Appendix A: Task Schema

```typescript
interface TaskDefinition {
  id: string;
  name: string;
  description: string;

  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  estimatedPassRate: number;  // 0-1

  initialState: {
    deal?: Partial<Deal>;
    entities?: Partial<Entity>[];
    documents?: Partial<Document>[];
    spreads?: Partial<Spread>[];
    covenants?: Partial<Covenant>[];
  };

  successCriteria: SuccessCriterion[];

  graderConfig: {
    type: 'deterministic' | 'rule_based' | 'llm_judge' | 'hybrid';
    tolerance?: number;
    llmModel?: string;
    rubric?: string;
  };

  constraints: {
    maxSteps: number;
    timeoutSeconds: number;
    allowedTools?: string[];
    blockedTools?: string[];
  };

  metadata: {
    category: string;
    skills: string[];
    prerequisites?: string[];  // Other task IDs
  };
}

interface SuccessCriterion {
  path: string;  // JSONPath to check
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'exists';
  expected: unknown;
  weight: number;  // For partial credit
}
```

---

## Appendix B: Example Grader Implementation

```typescript
// packages/rl-tasks/src/graders/spread-grader.ts

import { GradeResult, TaskState } from '../types';

export async function gradeSpreadCreation(
  initial: TaskState,
  final: TaskState,
  expected: ExpectedSpread
): Promise<GradeResult> {
  const checks: Check[] = [];

  // 1. Spread exists
  const spread = final.spreads?.[0];
  checks.push({
    name: 'spread_exists',
    passed: !!spread,
    weight: 0.1,
    message: spread ? 'Spread created' : 'No spread found'
  });

  if (!spread) {
    return { passed: false, score: 0, checks };
  }

  // 2. Line items present
  const lineItemCount = spread.lineItems?.length ?? 0;
  checks.push({
    name: 'line_items_present',
    passed: lineItemCount >= expected.minLineItems,
    weight: 0.2,
    message: `${lineItemCount} line items (expected >= ${expected.minLineItems})`
  });

  // 3. Required categories covered
  const categories = new Set(spread.lineItems?.map(li => li.category));
  const requiredCategories = ['revenue', 'cogs', 'operating_expenses', 'interest', 'tax'];
  const missingCategories = requiredCategories.filter(c => !categories.has(c));
  checks.push({
    name: 'categories_complete',
    passed: missingCategories.length === 0,
    weight: 0.2,
    message: missingCategories.length === 0
      ? 'All required categories present'
      : `Missing: ${missingCategories.join(', ')}`
  });

  // 4. Ratios computed correctly (with tolerance)
  const ratioChecks = [
    { name: 'dscr', expected: expected.ratios.dscr, actual: spread.ratios?.dscr },
    { name: 'gross_margin', expected: expected.ratios.grossMargin, actual: spread.ratios?.grossMargin },
    { name: 'current_ratio', expected: expected.ratios.currentRatio, actual: spread.ratios?.currentRatio }
  ];

  for (const rc of ratioChecks) {
    const tolerance = 0.01;  // 1% tolerance
    const withinTolerance = rc.actual !== undefined &&
      Math.abs(rc.actual - rc.expected) / rc.expected <= tolerance;

    checks.push({
      name: `ratio_${rc.name}`,
      passed: withinTolerance,
      weight: 0.15,
      message: `${rc.name}: ${rc.actual?.toFixed(2)} (expected ${rc.expected.toFixed(2)})`
    });
  }

  // 5. Balance check (assets = liabilities + equity)
  const assets = sumCategory(spread.lineItems, 'total_assets');
  const liabilities = sumCategory(spread.lineItems, 'total_liabilities');
  const equity = sumCategory(spread.lineItems, 'total_equity');
  const balanced = Math.abs(assets - (liabilities + equity)) < 1;  // Allow $1 rounding

  checks.push({
    name: 'balance_sheet_balanced',
    passed: balanced,
    weight: 0.05,
    message: balanced
      ? 'Balance sheet balances'
      : `Imbalance: Assets ${assets} != L+E ${liabilities + equity}`
  });

  // Calculate final score
  const score = checks.reduce((sum, c) => sum + (c.passed ? c.weight : 0), 0);

  return {
    passed: score >= 0.7,
    score,
    checks
  };
}

function sumCategory(lineItems: LineItem[], category: string): number {
  return lineItems
    ?.filter(li => li.category === category)
    .reduce((sum, li) => sum + li.amount, 0) ?? 0;
}
```

---

## Appendix C: References

1. Epoch AI. "State of RL Environments." January 2026. https://epoch.ai/gradient-updates/state-of-rl-envs

2. Open LOS Documentation:
   - [AI Native Architecture](/docs/AI_NATIVE_ARCHITECTURE.md)
   - [Product Specification](/docs/SPEC.md)
   - [Conformance Tests](/conformance/cases/)

3. Related Work:
   - SWE-bench Verified (coding tasks)
   - WebArena (web navigation)
   - WorkArena (enterprise workflows)
