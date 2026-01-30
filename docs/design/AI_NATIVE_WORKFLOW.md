# AI-Native Workflow Automation Design

> Design document for workflow automation in Open LOS that embraces AI as the execution primitive, not just a tool within traditional automation.

## 1. Philosophy: Why Not Zapier?

Traditional workflow automation (Zapier, n8n, Temporal) follows a **graph-of-tasks** model:
- Human defines triggers → conditions → actions
- Human specifies data mappings between steps
- Human handles edge cases with branching logic
- AI is optional, bolted on as a "step"

This inverts the correct abstraction. The AI should **be** the workflow, not a node within it.

### AI-Native Principle

```
Traditional:  Trigger → [Parse Email] → [Extract PDF] → [Call AI] → [Update Record]
AI-Native:    Trigger → AI(context, goal) → Outcome
```

The AI receives:
1. **Context**: The current state (deal, documents, history)
2. **Goal**: What success looks like ("process this deal to first-pass underwriting")
3. **Tools**: Capabilities it can use (spread financials, draft emails, update stages)

The AI decides **how** to accomplish the goal. No human-authored workflow graph.

---

## 2. Core Abstractions

### 2.1 Jobs

A **Job** is the unit of work. It's not a workflow—it's an intention.

```typescript
interface Job {
  id: string;

  // What to do (natural language goal)
  goal: string;

  // What context to load
  context: {
    type: 'deal' | 'inbox' | 'portfolio' | 'custom';
    ref?: string;  // deal_id, etc.
    query?: string; // for portfolio: "all deals in underwriting"
  };

  // Constraints
  constraints?: {
    max_cost_usd?: number;      // Token budget
    max_duration_sec?: number;   // Time limit
    allowed_tools?: string[];    // Restrict capabilities
    require_approval?: boolean;  // Human-in-loop for mutations
  };

  // Execution state
  status: 'pending' | 'running' | 'completed' | 'failed' | 'awaiting_approval';
  result?: JobResult;

  // Metadata
  created_at: string;
  triggered_by: TriggerRef;
  actor: string;  // Who/what created this job
}
```

**Examples of goals:**
- "Process this deal: spread the financials from the uploaded documents, analyze the business, and prepare a first-pass credit memo"
- "Review my inbox and triage any deal-related emails"
- "Check all deals in monitoring for covenant compliance and draft breach notices if needed"
- "Look at deal DEAL-00042 and tell me what's blocking it from moving to underwriting"

### 2.2 Triggers

Triggers create Jobs. Three types:

```typescript
type Trigger =
  | { type: 'event'; event: EventTrigger }
  | { type: 'schedule'; schedule: ScheduleTrigger }
  | { type: 'manual'; }

interface EventTrigger {
  source: 'email' | 'webhook' | 'file_upload' | 'stage_change' | 'alert';
  filter?: Record<string, any>;  // e.g., { from: '*@broker.com' }
}

interface ScheduleTrigger {
  cron: string;      // "0 8 * * *" = 8am daily
  timezone: string;  // "America/New_York"
}
```

### 2.3 Sandboxes

A **Sandbox** is an isolated execution environment where the AI runs. Abstract over:
- Local process (Claude Code, Codex CLI)
- Cloud container (Modal, Fly, AWS Lambda)
- Managed service (Claude.ai computer use, future Anthropic offerings)

```typescript
interface Sandbox {
  id: string;
  type: 'local' | 'container' | 'managed';

  // Capabilities
  capabilities: {
    file_system: boolean;    // Can read/write files
    network: boolean;        // Can make HTTP requests
    shell: boolean;          // Can run commands
    browser: boolean;        // Can browse web (computer use)
  };

  // Resource limits
  limits: {
    memory_mb: number;
    cpu_cores: number;
    timeout_sec: number;
    disk_mb: number;
  };

  // Lifecycle
  provision(): Promise<SandboxHandle>;
  execute(job: Job): Promise<JobResult>;
  teardown(): Promise<void>;
}
```

**Sandbox Provider Abstraction:**

```typescript
interface SandboxProvider {
  name: string;

  // Check if this provider can handle the job
  canHandle(job: Job): boolean;

  // Create a sandbox for execution
  createSandbox(config: SandboxConfig): Promise<Sandbox>;
}

// Implementations:
// - LocalSandboxProvider (runs in current process/subprocess)
// - ModalSandboxProvider (spins up Modal container)
// - ClaudeCodeSandboxProvider (uses Claude Code headless mode)
// - E2BSandboxProvider (uses E2B code interpreter)
```

---

## 3. Two Design Options

### Option A: Minimal — Jobs as Prompts

The simplest possible system. A Job is literally a prompt + context.

**How it works:**
1. Trigger fires → Job created
2. System loads context (deal data, documents, recent activity)
3. System renders prompt: `{system_prompt} + {context} + {goal}`
4. AI executes with tools (Open LOS API as MCP server)
5. Job completes when AI returns

**Configuration file (YAML):**

```yaml
# /jobs/process-new-deal.yaml
name: process-new-deal
description: Automatically process incoming deals

trigger:
  type: event
  source: email
  filter:
    subject_contains: "New Deal"

goal: |
  A new deal has arrived via email. Please:
  1. Extract deal information from the email and attachments
  2. Create a deal record if one doesn't exist
  3. Upload and categorize all attached documents
  4. If financial statements are present, spread them
  5. Write a brief first-pass analysis
  6. Flag anything that needs human attention

context:
  type: email
  include_attachments: true

constraints:
  max_cost_usd: 5.00
  require_approval: false
```

**Pros:**
- Extremely simple to implement and understand
- No new DSL or workflow language to learn
- Fully leverages AI reasoning capabilities
- Easy to modify (just edit the goal text)

**Cons:**
- Less predictable execution (AI might interpret goal differently)
- Harder to estimate costs upfront
- No explicit checkpointing (though AI can use audit trail)

---

### Option B: Skills + Orchestrator

A thin orchestration layer that manages multi-step execution with explicit skills.

**Skills** are documented capabilities:

```yaml
# /skills/spread-financials.yaml
name: spread-financials
description: Extract and structure financial data from documents

inputs:
  - name: deal_id
    type: string
    required: true
  - name: document_ids
    type: array
    required: false
    description: "Specific docs to process. If empty, uses all financial docs."

outputs:
  - name: spread_id
    type: string
  - name: ratios
    type: object

instructions: |
  You are spreading financial statements for underwriting analysis.

  1. Retrieve the deal and its documents
  2. Identify financial statements (income statement, balance sheet, cash flow)
  3. Extract line items into structured format
  4. Calculate standard ratios (DSCR, leverage, current ratio, etc.)
  5. Save via SpreadService

  Use the spread.create tool with extracted line items.
  Return the spread_id and computed ratios.

tools_required:
  - deal.get
  - document.list
  - document.get_content
  - spread.create
```

**Jobs reference skills:**

```yaml
# /jobs/underwriting-pipeline.yaml
name: underwriting-pipeline
trigger:
  type: event
  source: stage_change
  filter:
    to_stage: underwriting

steps:
  - skill: spread-financials
    inputs:
      deal_id: "{{trigger.deal_id}}"

  - skill: analyze-business
    inputs:
      deal_id: "{{trigger.deal_id}}"
      spread_id: "{{steps[0].outputs.spread_id}}"

  - skill: draft-credit-memo
    inputs:
      deal_id: "{{trigger.deal_id}}"
      analysis: "{{steps[1].outputs}}"
    condition: "{{steps[1].outputs.proceed == true}}"
```

**Orchestrator behavior:**
1. Trigger fires → Load job definition
2. For each step:
   - Check condition (if any)
   - Load skill instructions
   - Execute in sandbox with inputs
   - Capture outputs
   - Store checkpoint
3. If step fails: retry with backoff, then pause for human

**Pros:**
- More predictable execution paths
- Reusable skills across jobs
- Easier cost estimation per skill
- Natural checkpointing between steps

**Cons:**
- More complexity to build and maintain
- Risk of over-specifying (defeating AI-native purpose)
- Skills can become stale as AI capabilities evolve

---

## 4. Recommended Approach: Option A with Guardrails

Start with **Option A** (Jobs as Prompts) but add:

### 4.1 Structured Context Loading

Don't just dump data—provide semantically organized context:

```typescript
interface JobContext {
  // Primary entity
  deal?: {
    record: Deal;
    stage: StageInfo;
    documents: DocumentSummary[];
    entities: Entity[];
    recent_activity: AuditEvent[];
    blocking_issues: string[];
  };

  // Communication context
  emails?: {
    unprocessed: Email[];
    recent_threads: EmailThread[];
  };

  // Portfolio context
  portfolio?: {
    deals_by_stage: Record<Stage, DealSummary[]>;
    alerts: Alert[];
    upcoming_deadlines: Deadline[];
  };

  // What the AI can do
  available_tools: ToolDefinition[];

  // What constraints apply
  constraints: JobConstraints;
}
```

### 4.2 Tool Boundaries

Define clear tool categories:

```typescript
const TOOL_TIERS = {
  // Safe - can always use
  read: ['deal.get', 'deal.list', 'document.get', 'spread.get', 'covenant.list'],

  // Mutate - allowed by default, audit-logged
  mutate: ['deal.create', 'document.upload', 'spread.create', 'covenant.test'],

  // Sensitive - require approval or explicit allowlist
  sensitive: ['stage.transition', 'approval.approve', 'email.send'],

  // Dangerous - never auto-execute
  dangerous: ['deal.delete', 'loan.disburse']
};
```

### 4.3 Cost Controls

```typescript
interface CostGuard {
  // Token limits
  max_input_tokens: number;
  max_output_tokens: number;

  // Turn limits (API round-trips)
  max_turns: number;

  // Dollar limit (computed from token usage)
  max_cost_usd: number;

  // Time limit
  max_duration_sec: number;
}

// Default guards for different job types
const COST_PROFILES = {
  triage: { max_turns: 5, max_cost_usd: 0.50 },
  analysis: { max_turns: 20, max_cost_usd: 5.00 },
  deep_work: { max_turns: 50, max_cost_usd: 20.00 }
};
```

### 4.4 Approval Checkpoints

For sensitive operations, pause and request approval:

```typescript
interface ApprovalCheckpoint {
  job_id: string;
  action: string;  // "Send email to borrower" or "Transition to closing"
  context: any;    // What the AI wants to do
  options: ['approve', 'reject', 'modify'];
  timeout_hours: number;  // Auto-reject after N hours
}
```

---

## 5. Trigger Implementation Details

### 5.1 Email Trigger

Leverage existing `EmailService.ingest()`:

```typescript
// In email ingestion flow:
async function processIncomingEmail(raw: string) {
  // 1. Parse and store
  const email = await emailService.ingest(raw, dealId);

  // 2. Check for matching job triggers
  const triggers = await triggerService.findMatching({
    type: 'event',
    source: 'email',
    email
  });

  // 3. Create jobs for each matching trigger
  for (const trigger of triggers) {
    await jobService.create({
      goal: trigger.job.goal,
      context: { type: 'email', ref: email.id },
      triggered_by: { trigger_id: trigger.id, event: 'email_received' }
    });
  }
}
```

**Email trigger patterns:**
- `*@broker.com` → Process as new deal submission
- `RE:` in subject → Add to existing deal conversation
- `[DEAL-XXXXX]` in subject → Auto-link (already implemented)

### 5.2 Schedule Trigger

Simple cron-based scheduler:

```typescript
// /packages/core/src/services/scheduler.ts
interface ScheduledJob {
  id: string;
  name: string;
  cron: string;
  timezone: string;
  job_template: Partial<Job>;
  enabled: boolean;
  last_run?: string;
  next_run: string;
}

// Runner (called by external cron or internal timer)
async function runScheduledJobs() {
  const due = await schedulerService.getDueJobs();

  for (const scheduled of due) {
    await jobService.create({
      ...scheduled.job_template,
      triggered_by: { trigger_id: scheduled.id, event: 'scheduled' }
    });

    await schedulerService.markRun(scheduled.id);
  }
}
```

**Common schedules:**
- `0 8 * * *` — Morning inbox triage
- `0 9 * * 1` — Weekly portfolio review
- `0 0 * * *` — Nightly covenant testing
- `*/15 * * * *` — Check for new emails (if polling)

### 5.3 Event Trigger

Subscribe to internal events:

```typescript
// Events emitted by services
type SystemEvent =
  | { type: 'deal.created'; deal_id: string }
  | { type: 'deal.stage_changed'; deal_id: string; from: Stage; to: Stage }
  | { type: 'document.uploaded'; deal_id: string; document_id: string }
  | { type: 'alert.generated'; alert_id: string; alert_type: string }
  | { type: 'covenant.breached'; deal_id: string; covenant_id: string }
  | { type: 'email.received'; email_id: string; deal_id?: string };

// Trigger matching
function matchesTrigger(event: SystemEvent, trigger: EventTrigger): boolean {
  if (trigger.source !== event.type.split('.')[0]) return false;

  if (trigger.filter) {
    return Object.entries(trigger.filter).every(([key, pattern]) =>
      matchPattern(event[key], pattern)
    );
  }

  return true;
}
```

---

## 6. Sandbox Implementation

### 6.1 Local Sandbox (MVP)

For initial implementation, run in the same process:

```typescript
class LocalSandbox implements Sandbox {
  type = 'local' as const;

  async execute(job: Job): Promise<JobResult> {
    // 1. Load context
    const context = await this.loadContext(job.context);

    // 2. Build messages
    const messages = [
      { role: 'user', content: this.renderPrompt(job, context) }
    ];

    // 3. Execute with tools
    const result = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: job.constraints?.max_output_tokens ?? 4096,
      system: SYSTEM_PROMPT,
      messages,
      tools: this.getTools(job.constraints?.allowed_tools)
    });

    // 4. Handle tool calls in loop
    while (result.stop_reason === 'tool_use') {
      // Execute tools, append results, continue
    }

    return this.parseResult(result);
  }
}
```

### 6.2 Container Sandbox (Future)

For isolation and resource control:

```typescript
class ModalSandbox implements Sandbox {
  type = 'container' as const;

  async execute(job: Job): Promise<JobResult> {
    // Spawn Modal container with:
    // - Open LOS API credentials
    // - Job definition
    // - Claude API key
    // - Resource limits

    const result = await modal.Function.run('execute_job', {
      job,
      api_url: process.env.OPENLOS_API_URL,
      api_key: process.env.OPENLOS_API_KEY
    });

    return result;
  }
}
```

### 6.3 Sandbox Selection

```typescript
function selectSandbox(job: Job): SandboxProvider {
  // Use container for:
  // - Deep work (long running)
  // - Untrusted context (external documents)
  // - High resource needs

  if (job.constraints?.max_duration_sec > 300) {
    return new ModalSandboxProvider();
  }

  if (job.context.type === 'email' && hasExternalAttachments(job)) {
    return new ModalSandboxProvider();  // Isolate external content
  }

  // Default to local for speed
  return new LocalSandboxProvider();
}
```

---

## 7. Configuration & Management

### 7.1 Jobs as Files

Store job definitions in the filesystem (S3 in prod):

```
/jobs/
  ├── triggers/
  │   ├── email-new-deal.yaml
  │   ├── daily-portfolio-review.yaml
  │   └── covenant-breach-response.yaml
  ├── goals/
  │   ├── process-deal.md
  │   ├── draft-credit-memo.md
  │   └── triage-inbox.md
  └── constraints/
      ├── default.yaml
      └── deep-analysis.yaml
```

### 7.2 API for Job Management

```typescript
// Create ad-hoc job
POST /v1/jobs
{
  "goal": "Review deal DEAL-00042 and tell me what's blocking underwriting",
  "context": { "type": "deal", "ref": "deal_id_123" }
}

// List jobs
GET /v1/jobs?status=running

// Get job result
GET /v1/jobs/:id

// Cancel job
POST /v1/jobs/:id/cancel

// List triggers
GET /v1/triggers

// Create trigger
POST /v1/triggers
{
  "name": "process-broker-emails",
  "type": "event",
  "source": "email",
  "filter": { "from": "*@broker.com" },
  "job_template": {
    "goal": "Process this broker submission...",
    "context": { "type": "email" }
  }
}

// Enable/disable trigger
PATCH /v1/triggers/:id { "enabled": false }
```

---

## 8. Example Workflows

### 8.1 New Deal Intake (Email Triggered)

```yaml
name: new-deal-intake
trigger:
  type: event
  source: email
  filter:
    from: "*@broker.com"
    subject_not_contains: "RE:"

goal: |
  A broker has submitted a new deal via email.

  1. Extract the deal summary from the email body
  2. Create a new deal record with:
     - Borrower name
     - Requested amount
     - Purpose (if mentioned)
     - Jurisdiction (if mentioned)
  3. Upload all attachments as documents, categorizing them:
     - Financial statements → "financials"
     - Business plan → "business_plan"
     - Tax returns → "tax_returns"
     - Other → "other"
  4. If financial statements are present, spread them
  5. Write a brief first-pass note summarizing:
     - What we received
     - Initial impressions
     - What's missing
  6. If anything is unclear or concerning, flag for human review

context:
  type: email
  include_attachments: true

constraints:
  profile: analysis
  require_approval: false
```

### 8.2 Morning Inbox Triage (Scheduled)

```yaml
name: morning-inbox-triage
trigger:
  type: schedule
  cron: "0 8 * * 1-5"  # 8am weekdays
  timezone: "America/New_York"

goal: |
  Review my inbox and prepare a morning briefing.

  For each unprocessed email:
  1. Determine if it relates to an existing deal
  2. If yes, link it and summarize the update
  3. If no, determine if it's a new deal submission
  4. Flag anything urgent

  Then compile a briefing:
  - New deal submissions received
  - Updates on existing deals
  - Items requiring immediate attention
  - Items that can wait

context:
  type: inbox
  filter:
    unread: true
    since: "24h"

constraints:
  profile: triage
```

### 8.3 Portfolio Health Check (Scheduled)

```yaml
name: weekly-portfolio-review
trigger:
  type: schedule
  cron: "0 9 * * 1"  # Monday 9am
  timezone: "America/New_York"

goal: |
  Review all active deals and prepare a portfolio health report.

  For each deal in monitoring:
  1. Run covenant tests against latest financials
  2. Check bank transaction data freshness
  3. Review any alerts

  For each deal in underwriting or closing:
  1. Check what's blocking progress
  2. Identify any stale deals (no activity in 14+ days)

  Compile a report:
  - Covenant compliance summary
  - Deals at risk (covenant breach, liquidity warning)
  - Stalled deals requiring attention
  - Upcoming deadlines

context:
  type: portfolio

constraints:
  profile: deep_work
```

### 8.4 Covenant Breach Response (Event Triggered)

```yaml
name: covenant-breach-response
trigger:
  type: event
  source: alert
  filter:
    type: "covenant_breach"

goal: |
  A covenant breach has been detected. Prepare the response.

  1. Review the covenant and breach details
  2. Check if this is first breach or repeat
  3. Look at grace period status
  4. Review recent communications with borrower
  5. Draft an appropriate notice:
     - If first breach with grace period: Friendly reminder
     - If grace period expiring: Formal warning
     - If repeated breach: Escalation notice
  6. Flag for human review before sending

context:
  type: deal
  ref: "{{trigger.deal_id}}"

constraints:
  require_approval: true  # Human must approve before sending
```

---

## 9. Implementation Plan

### Phase 1: Foundation (Week 1-2)

1. **Job Service**
   - Job table in database
   - CRUD operations
   - Status tracking

2. **Local Sandbox**
   - Context loading
   - Tool execution loop
   - Result capture

3. **Manual Trigger**
   - API endpoint to create jobs
   - Basic job runner

### Phase 2: Triggers (Week 3-4)

1. **Event Triggers**
   - Event emission from existing services
   - Trigger matching logic
   - Job creation on match

2. **Schedule Triggers**
   - Cron parsing
   - Scheduler service
   - Next-run calculation

3. **Email Integration**
   - Email polling (or webhook receiver)
   - Email → Job flow

### Phase 3: Robustness (Week 5-6)

1. **Cost Controls**
   - Token tracking
   - Budget enforcement
   - Turn limits

2. **Approval Flow**
   - Checkpoint creation
   - Approval API
   - Timeout handling

3. **Job Configuration**
   - YAML parser for job definitions
   - File-based job storage
   - Hot reload

### Phase 4: Scale (Future)

1. **Container Sandboxes**
   - Modal/E2B integration
   - Resource isolation

2. **Observability**
   - Job metrics
   - Cost analytics
   - Performance tracking

3. **Multi-tenancy**
   - Per-tenant job quotas
   - Isolated execution

---

## 10. Open Questions

1. **Skill Discovery**: Should we pre-index available skills, or let the AI discover them from tool documentation?

2. **Memory/Learning**: Should jobs be able to store learnings for future runs? (e.g., "This broker always sends financials as Excel, not PDF")

3. **Human-in-Loop UX**: How do approval requests surface to users? (Email? Slack? Dashboard?)

4. **Cost Attribution**: How do we attribute job costs to deals/users for billing?

5. **Failure Recovery**: If a job fails mid-execution, how much state do we preserve? Can it resume?

6. **Concurrent Jobs**: Can multiple jobs run on the same deal? How do we handle conflicts?

---

## 11. Non-Goals (Explicitly Avoided)

- **Visual workflow builder**: No drag-and-drop. Goals are text.
- **Complex branching logic**: AI decides, not predetermined paths.
- **Hundreds of connectors**: We connect to Open LOS API. That's it.
- **Low-code/no-code positioning**: This is for AI, not for non-technical users avoiding code.

---

## 12. Success Metrics

1. **Automation Rate**: % of deals that reach underwriting without human intervention
2. **Time to First Pass**: Minutes from email receipt to initial analysis complete
3. **Cost per Deal**: Average AI spend per deal processed
4. **Human Override Rate**: % of AI decisions that humans change
5. **Accuracy**: Spread extraction accuracy vs human review

---

## Appendix A: Database Schema Additions

```typescript
// New tables for job system

export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(),
  tenant_id: text('tenant_id').notNull(),

  // Definition
  goal: text('goal').notNull(),
  context_type: text('context_type').notNull(),
  context_ref: text('context_ref'),
  context_query: text('context_query'),
  constraints: text('constraints'),  // JSON

  // Execution
  status: text('status').notNull().default('pending'),
  sandbox_type: text('sandbox_type'),
  started_at: text('started_at'),
  completed_at: text('completed_at'),

  // Result
  result: text('result'),  // JSON
  error: text('error'),

  // Cost tracking
  input_tokens: integer('input_tokens'),
  output_tokens: integer('output_tokens'),
  total_cost_usd: real('total_cost_usd'),
  turns: integer('turns'),

  // Provenance
  triggered_by: text('triggered_by'),  // JSON: { trigger_id, event }
  actor: text('actor').notNull(),

  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull()
});

export const triggers = sqliteTable('triggers', {
  id: text('id').primaryKey(),
  tenant_id: text('tenant_id').notNull(),

  name: text('name').notNull(),
  description: text('description'),

  // Trigger config
  type: text('type').notNull(),  // 'event' | 'schedule'
  event_source: text('event_source'),  // 'email' | 'stage_change' | etc
  event_filter: text('event_filter'),  // JSON
  cron: text('cron'),
  timezone: text('timezone'),

  // Job template
  job_goal: text('job_goal').notNull(),
  job_context_type: text('job_context_type').notNull(),
  job_constraints: text('job_constraints'),  // JSON

  // State
  enabled: integer('enabled').notNull().default(1),
  last_run_at: text('last_run_at'),
  next_run_at: text('next_run_at'),

  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull()
});

export const approvalCheckpoints = sqliteTable('approval_checkpoints', {
  id: text('id').primaryKey(),
  job_id: text('job_id').notNull().references(() => jobs.id),

  // What needs approval
  action: text('action').notNull(),
  context: text('context').notNull(),  // JSON

  // State
  status: text('status').notNull().default('pending'),
  decision: text('decision'),  // 'approved' | 'rejected' | 'modified'
  decision_by: text('decision_by'),
  decision_at: text('decision_at'),
  decision_rationale: text('decision_rationale'),

  timeout_at: text('timeout_at').notNull(),
  created_at: text('created_at').notNull()
});
```

---

## Appendix B: System Prompt Template

```markdown
You are an AI assistant working within Open LOS, a lending operating system.

## Your Context
{{context_summary}}

## Your Goal
{{job_goal}}

## Available Tools
You have access to the Open LOS API via these tools:
{{tool_list}}

## Constraints
- Maximum turns: {{max_turns}}
- Allowed tools: {{allowed_tools}}
- Require approval for: {{sensitive_actions}}

## Guidelines
1. Work autonomously toward the goal
2. Use tools to read data before making assumptions
3. Log your reasoning in deal notes when making decisions
4. If you encounter something unexpected, flag it rather than guessing
5. If an action requires approval, request it and wait

## Output Format
When complete, summarize:
- What you did
- What you found
- What needs human attention (if anything)
- Any recommendations
```
