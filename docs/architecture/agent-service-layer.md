# Agent Service Architecture

## The Mental Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                     CUSTOMER INTERFACE                               │
│   "Originate this loan for ABC Corp requesting $2M for expansion"   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    LOAN ORIGINATION AGENT                           │
│                                                                      │
│  Capabilities:                                                       │
│  - Understands loan origination domain                              │
│  - Makes decisions about next steps                                 │
│  - Requests information when needed                                 │
│  - Surfaces decisions that need human approval                      │
│  - Explains its reasoning                                           │
│                                                                      │
│  Outcomes it achieves:                                              │
│  - Deal progresses through stages                                   │
│  - Documents get collected and organized                            │
│  - Financials get spread and analyzed                               │
│  - Covenants get structured and monitored                          │
│  - Risks get surfaced                                               │
│  - Approvals get routed to right people                            │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ (Agent uses these as tools)
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         OPEN-LOS (Backing)                          │
│                                                                      │
│  What it provides to the agent:                                     │
│  - Persistent state (where is this deal?)                          │
│  - Compliance rails (what transitions are valid?)                   │
│  - Audit trail (what happened and why?)                            │
│  - Computation (ratios, covenant tests)                            │
│  - Integration points (email, docs, bank data)                     │
│                                                                      │
│  The customer doesn't interact with this directly.                  │
│  They don't care about it. They care about outcomes.               │
└─────────────────────────────────────────────────────────────────────┘
```

## The Agent Abstraction

### Core Concept: Outcome-Oriented Interface

Instead of exposing REST endpoints for deals, stages, documents, etc., the agent exposes **outcome-oriented intents**:

```typescript
interface LoanOriginationAgent {
  // HIGH-LEVEL OUTCOMES (what customers actually want)

  /**
   * "Originate a loan for this borrower"
   * Agent handles: deal creation, document collection,
   * financial analysis, structuring, approval routing
   */
  originateLoan(request: OriginationRequest): Promise<OriginationOutcome>

  /**
   * "What's the status of this deal?"
   * Agent provides: human-readable summary, blockers,
   * next steps, risk flags, timeline
   */
  getDealStatus(dealId: string): Promise<DealStatusSummary>

  /**
   * "Here's a document for the ABC Corp deal"
   * Agent handles: classification, extraction,
   * linking to right deal, updating progress
   */
  ingestDocument(document: Document): Promise<DocumentProcessingResult>

  /**
   * "Here's the borrower's bank statements"
   * Agent handles: parsing, liquidity analysis,
   * covenant implications, risk flags
   */
  analyzeBankData(dealId: string, data: BankData): Promise<FinancialAnalysis>

  /**
   * "What deals need my attention?"
   * Agent provides: prioritized list with reasons,
   * recommended actions, deadlines
   */
  getActionItems(userId: string): Promise<ActionItem[]>

  /**
   * "Approve this facility with these terms"
   * Agent handles: validation, state transition,
   * downstream effects, notification
   */
  makeDecision(decision: Decision): Promise<DecisionOutcome>
}
```

### The Agent's Internal Loop

```typescript
class LoanOriginationAgent {
  private los: OpenLOS  // The backing system
  private llm: LLM      // Reasoning engine

  async originateLoan(request: OriginationRequest): Promise<OriginationOutcome> {
    // 1. Create deal in backing system (for state tracking)
    const deal = await this.los.deals.create({
      borrower_name: request.borrowerName,
      requested_amount: request.amount,
      purpose: request.purpose,
      jurisdiction: request.jurisdiction
    })

    // 2. Agent determines what's needed
    const plan = await this.llm.planOrigination({
      dealType: this.classifyDealType(request),
      borrowerProfile: request.borrowerInfo,
      amountRange: request.amount,
      jurisdiction: request.jurisdiction
    })

    // 3. Agent works through the plan, using LOS as its tool
    for (const step of plan.steps) {
      switch (step.type) {
        case 'collect_document':
          await this.requestDocument(deal.id, step.documentType)
          break

        case 'analyze_financials':
          const analysis = await this.spreadAndAnalyze(deal.id, step.data)
          // Agent reasons about the analysis
          const risks = await this.llm.identifyRisks(analysis)
          if (risks.length > 0) {
            await this.surfaceRisks(deal.id, risks)
          }
          break

        case 'structure_facility':
          const recommendation = await this.llm.recommendStructure({
            financials: await this.los.spreads.getRatios(deal.id),
            borrowerProfile: request.borrowerInfo,
            marketConditions: await this.getMarketConditions()
          })
          await this.proposeFacility(deal.id, recommendation)
          break

        case 'route_for_approval':
          await this.routeForApproval(deal.id, step.approvalType)
          // Wait for human decision (agent pauses here)
          break

        case 'advance_stage':
          // Agent checks if guards are satisfied
          const canAdvance = await this.los.stages.checkGuards(deal.id, step.targetStage)
          if (canAdvance.satisfied) {
            await this.los.stages.transition(deal.id, step.targetStage)
          } else {
            // Agent works on satisfying guards
            for (const guard of canAdvance.unsatisfied) {
              await this.satisfyGuard(deal.id, guard)
            }
          }
          break
      }
    }

    return this.buildOutcome(deal.id)
  }
}
```

## What Changes for the Customer

### Before (Software-Centric)
```
Customer: "I need to originate a loan"
You: "Here's our LOS. Create a deal, upload documents to the
      documents endpoint, transition stages when guards are
      satisfied, run spreads through the spread endpoint..."
Customer: *trains staff, builds processes, manages workflow*
```

### After (Outcome-Centric)
```
Customer: "I need to originate a loan for ABC Corp, $2M, expansion"
Agent: "I've started the origination. I need:
        - Last 3 years financials
        - Corporate structure documentation
        - Bank statements (last 12 months)

        I'll analyze everything and come back with a recommendation.
        Expected timeline: 48 hours after documents received."

Customer: *uploads documents*

Agent: "Analysis complete. Key findings:
        - Strong cash flow (1.8x DSCR)
        - Clean ownership structure
        - One concern: seasonal revenue dips in Q1

        Recommended structure:
        - $2M term loan, 5yr, 8.5%
        - Quarterly DSCR covenant at 1.25x
        - Cash sweep during Q1

        Do you want me to proceed with this structure?"

Customer: "Yes, proceed"

Agent: "Facility approved and documented. Loan account created.
        First disbursement ready. Monitoring activated.

        I'll alert you if:
        - Covenant tests approach thresholds
        - Liquidity drops below 3 months runway
        - Payment patterns change"
```

## The Abstraction Layers

```
┌─────────────────────────────────────────────────────────┐
│ Layer 4: OUTCOME INTERFACE                              │
│ - Natural language intents                              │
│ - Async workflows with human-in-the-loop               │
│ - Push-based status updates                            │
│ - Decision explanation and transparency                │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 3: AGENT REASONING                                │
│ - Task decomposition (what steps are needed?)          │
│ - Information gathering (what do I need to know?)      │
│ - Risk assessment (what could go wrong?)               │
│ - Decision recommendation (what should we do?)         │
│ - Explanation generation (why this recommendation?)    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 2: DOMAIN TOOLS (Agent's Capabilities)            │
│ - Document classification and extraction               │
│ - Financial analysis and spreading                     │
│ - Covenant structuring and testing                     │
│ - Risk flagging and monitoring                         │
│ - Communication drafting                               │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 1: OPEN-LOS (State & Compliance Backing)          │
│ - Deal state persistence                               │
│ - Stage machine & guards                               │
│ - Audit trail                                          │
│ - Multi-tenancy                                        │
│ - Computation (ratios, covenants)                      │
│ - Integration (email, bank data)                       │
└─────────────────────────────────────────────────────────┘
```

## What Open-LOS Becomes

Open-LOS transforms from "the product" to "the agent's infrastructure":

| Product Mode | Infrastructure Mode |
|--------------|---------------------|
| REST API for humans | Tool interface for agent |
| UI dashboards | Agent memory/state |
| User training needed | Agent knows the domain |
| Process documentation | Agent embodies the process |
| Compliance checklists | Compliance rails (guards) |
| Audit reports | Agent explainability source |

### The Key Insight

**The customer doesn't care about open-los the same way you don't care about the database your bank uses.** You care that:
- Your money is tracked correctly
- Transactions are processed
- You can see your balance
- Fraud is detected

You don't care if it's PostgreSQL or Oracle underneath.

Similarly, your customer cares that:
- Loans get originated correctly
- Risk is assessed properly
- Compliance is maintained
- They can see status and make decisions

They don't care if it's open-los or some other system underneath.

## Agent Service Interface (What You Actually Sell)

```typescript
// This is the product interface
interface LoanOriginationService {
  // Onboarding
  setupLender(config: LenderConfig): Promise<LenderAccount>

  // Core workflow
  submitDeal(request: DealRequest): Promise<DealId>
  uploadDocument(dealId: DealId, doc: Document): Promise<void>
  getStatus(dealId: DealId): Promise<StatusReport>
  getActionItems(): Promise<ActionItem[]>
  makeDecision(dealId: DealId, decision: Decision): Promise<void>

  // Monitoring
  subscribeToAlerts(callback: AlertCallback): Subscription
  getPortfolioHealth(): Promise<PortfolioReport>

  // Transparency
  explainDecision(dealId: DealId, decisionId: string): Promise<Explanation>
  getAuditTrail(dealId: DealId): Promise<AuditEvent[]>
}
```

### Pricing Model

| Model | How It Works |
|-------|--------------|
| Per-origination | $X per successfully closed loan |
| Per-deal-month | $Y per deal in monitoring |
| Outcome-based | % of loan value originated |
| Hybrid | Base + success fee |

The key: **you're not charging for software seats, you're charging for outcomes delivered**.

## Implementation Approach

### Phase 1: Agent Skeleton
```
packages/
├── core/           # (exists) Domain services
├── api/            # (exists) HTTP layer
├── agent/          # (new) Agent service
│   ├── reasoning/  # LLM integration
│   ├── tools/      # Domain tools the agent can use
│   ├── workflows/  # Multi-step workflow orchestration
│   └── interface/  # Outcome-oriented API
```

### Phase 2: Tool Definitions
Wrap open-los services as agent tools:
```typescript
const tools = [
  {
    name: 'create_deal',
    description: 'Create a new loan origination deal',
    parameters: { borrower_name, amount, purpose, jurisdiction },
    execute: (params) => los.deals.create(params)
  },
  {
    name: 'analyze_financials',
    description: 'Spread financial statements and compute ratios',
    parameters: { deal_id, financial_data },
    execute: (params) => los.spreads.create(params)
  },
  // ... etc
]
```

### Phase 3: Workflow Orchestration
Define the high-level workflows:
```typescript
const originationWorkflow = {
  name: 'loan_origination',
  steps: [
    { id: 'intake', type: 'automated', tool: 'create_deal' },
    { id: 'doc_collection', type: 'human_input', request: 'documents' },
    { id: 'analysis', type: 'automated', tool: 'analyze_financials' },
    { id: 'structuring', type: 'agent_reasoning', prompt: 'recommend_structure' },
    { id: 'approval', type: 'human_decision', request: 'facility_approval' },
    { id: 'closing', type: 'automated', tool: 'create_loan_account' },
    { id: 'monitoring', type: 'ongoing', tool: 'monitor_covenant_compliance' }
  ]
}
```

### Phase 4: Reasoning Layer
Add LLM-powered reasoning:
```typescript
class AgentReasoning {
  async planOrigination(context: DealContext): Promise<OriginationPlan>
  async identifyRisks(financials: FinancialData): Promise<Risk[]>
  async recommendStructure(analysis: Analysis): Promise<FacilityRecommendation>
  async explainDecision(decision: Decision): Promise<Explanation>
  async classifyDocument(doc: Document): Promise<DocumentClassification>
}
```

## The Value Proposition Shift

**Before:** "We sell loan origination software. You still need to know how to originate loans."

**After:** "We originate loans for you. You focus on finding borrowers and making credit decisions. We handle everything else."

This is the difference between selling:
- A kitchen (software) vs. meals (outcome)
- A car (software) vs. transportation (outcome)
- A CRM (software) vs. customer relationships managed (outcome)

## Questions This Architecture Answers

1. **"What if the agent makes a mistake?"**
   - Every action is recorded in the audit trail
   - Human decisions are still human decisions
   - Agent explains its reasoning (traceable)
   - Guardrails prevent invalid state transitions

2. **"How do we maintain compliance?"**
   - Open-los enforces the rails (guards, valid transitions)
   - Audit trail is immutable
   - Agent can't bypass compliance, it works within it

3. **"What about edge cases?"**
   - Agent routes to humans when uncertain
   - Explicit "needs_human_decision" workflow states
   - Override capability with rationale (credit_lead role)

4. **"How do customers trust the agent?"**
   - Transparency: every decision is explainable
   - Gradual autonomy: start with recommendations, grow to actions
   - Audit trail: customer can see exactly what happened

5. **"What's our moat?"**
   - Domain expertise embedded in the agent
   - Open-los as robust, tested backing
   - Workflow orchestration that handles complexity
   - Audit/compliance infrastructure
