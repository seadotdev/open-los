# Loan Origination Agent Service

This package implements the agent service layer on top of open-los.

## Core Idea

Customers don't buy software. They buy outcomes.

```
Customer wants: "Originate this loan"
Customer gets:  Loan originated, monitored, compliant

They don't care how. They care that it's done right.
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│            Outcome Interface (what customers see)       │
│  submitDeal() → getStatus() → makeDecision()           │
└─────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────────────────────────────────────┐
│            Agent Orchestrator                           │
│  Workflows, reasoning, human-in-the-loop               │
└─────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────────────────────────────────────┐
│            Domain Tools                                 │
│  Wrappers around open-los services as agent tools      │
└─────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────────────────────────────────────┐
│            Open-LOS Core                                │
│  State, compliance rails, audit, computation           │
└─────────────────────────────────────────────────────────┘
```

## Package Structure

```
packages/agent/
├── src/
│   ├── index.ts              # Public API
│   ├── agent.ts              # Main agent orchestrator
│   │
│   ├── interface/            # Outcome-oriented API
│   │   ├── types.ts          # Request/response types
│   │   ├── service.ts        # LoanOriginationService implementation
│   │   └── webhooks.ts       # Push notifications
│   │
│   ├── orchestrator/         # Workflow management
│   │   ├── workflow.ts       # Workflow engine
│   │   ├── state-machine.ts  # Workflow state tracking
│   │   └── human-loop.ts     # Human decision points
│   │
│   ├── reasoning/            # LLM integration
│   │   ├── planner.ts        # Task decomposition
│   │   ├── analyzer.ts       # Risk/financial analysis
│   │   ├── recommender.ts    # Structure recommendations
│   │   └── explainer.ts      # Decision explanations
│   │
│   ├── tools/                # Domain capabilities
│   │   ├── registry.ts       # Tool registration
│   │   ├── deal-tools.ts     # Deal management tools
│   │   ├── document-tools.ts # Document processing
│   │   ├── analysis-tools.ts # Financial analysis
│   │   ├── facility-tools.ts # Facility structuring
│   │   └── monitoring-tools.ts # Ongoing monitoring
│   │
│   └── workflows/            # Pre-defined workflows
│       ├── origination.ts    # Full origination workflow
│       ├── document-intake.ts # Document collection
│       └── monitoring.ts     # Ongoing monitoring
│
├── test/
│   ├── agent.test.ts
│   └── workflows/
│
└── package.json
```

## Key Interfaces

### What Customers Interact With

```typescript
interface LoanOriginationService {
  // Start an origination
  submitDeal(request: DealRequest): Promise<{
    dealId: string
    status: 'started'
    nextSteps: string[]    // What the agent needs from them
    estimatedTimeline: string
  }>

  // Provide information the agent requested
  uploadDocument(dealId: string, doc: Document): Promise<{
    documentId: string
    classification: string  // What the agent thinks this is
    extracted: Record<string, any>  // What the agent extracted
    impact: string          // How this affects the deal
  }>

  // See where things stand
  getStatus(dealId: string): Promise<{
    stage: string
    progress: number        // 0-100
    summary: string         // Human-readable status
    blockers: string[]      // What's holding things up
    nextSteps: string[]     // What needs to happen
    risks: Risk[]           // Identified risks
    recommendation?: Recommendation  // If agent has one
  }>

  // Make decisions when the agent needs human input
  getActionItems(): Promise<ActionItem[]>
  makeDecision(actionId: string, decision: Decision): Promise<{
    result: string
    nextSteps: string[]
  }>

  // Understand what happened
  explainDecision(dealId: string, topic: string): Promise<{
    explanation: string
    supporting_data: Record<string, any>
    audit_references: string[]
  }>
}
```

### What the Agent Uses Internally

```typescript
interface AgentTool {
  name: string
  description: string
  parameters: JSONSchema
  execute: (params: any, context: AgentContext) => Promise<ToolResult>
}

interface AgentContext {
  dealId?: string
  tenantId: string
  actor: string
  los: OpenLOSServices  // Access to backing system
}

interface Workflow {
  id: string
  name: string
  steps: WorkflowStep[]
}

interface WorkflowStep {
  id: string
  type: 'automated' | 'agent_reasoning' | 'human_input' | 'human_decision'
  tool?: string           // For automated steps
  prompt?: string         // For reasoning steps
  request?: string        // For human steps
  condition?: string      // When to execute
  onComplete?: string     // Next step
  onError?: string        // Error handling
}
```

## Usage Example

```typescript
import { LoanOriginationAgent } from '@open-los/agent'
import { createOpenLOS } from '@open-los/core'

// Initialize with backing system
const los = createOpenLOS({ database: db })
const agent = new LoanOriginationAgent({ los, llm: anthropicClient })

// Customer submits a deal
const result = await agent.submitDeal({
  borrowerName: 'ABC Corporation',
  requestedAmount: 2_000_000,
  purpose: 'expansion',
  jurisdiction: 'US-CA',
  borrowerInfo: {
    industry: 'manufacturing',
    yearsInBusiness: 15,
    annualRevenue: 10_000_000
  }
})

// result:
// {
//   dealId: 'deal_abc123',
//   status: 'started',
//   nextSteps: [
//     'Upload last 3 years of audited financials',
//     'Provide corporate structure documentation',
//     'Upload 12 months of bank statements'
//   ],
//   estimatedTimeline: '5-7 business days after documents received'
// }

// Customer uploads documents
await agent.uploadDocument(result.dealId, financialStatements)
await agent.uploadDocument(result.dealId, bankStatements)
await agent.uploadDocument(result.dealId, corpDocs)

// Check status
const status = await agent.getStatus(result.dealId)
// {
//   stage: 'underwriting',
//   progress: 65,
//   summary: 'Financial analysis complete. Facility structure recommended.',
//   blockers: [],
//   nextSteps: ['Review and approve recommended facility structure'],
//   risks: [
//     { level: 'medium', description: 'Seasonal revenue concentration in Q4' }
//   ],
//   recommendation: {
//     type: 'facility_structure',
//     summary: '$2M term loan, 5yr, 8.5%, quarterly DSCR covenant at 1.25x',
//     rationale: 'Strong cash flow supports debt service...'
//   }
// }

// Customer approves
await agent.makeDecision('action_xyz', {
  type: 'approve',
  modifications: { rate: 8.25 }  // Customer negotiated rate
})

// Agent continues to closing, creates loan, activates monitoring
```

## Design Principles

1. **Outcome-first**: API is designed around what customers want to achieve, not what the system can do

2. **Transparency**: Every agent action is explainable and auditable

3. **Human-in-the-loop**: Agent surfaces decisions, doesn't make them unilaterally

4. **Progressive trust**: Start with recommendations, grow to more autonomous actions as trust builds

5. **Rails not walls**: Agent works within compliance framework, can't bypass guards

6. **Backing agnostic**: Customer interface doesn't expose open-los specifics
