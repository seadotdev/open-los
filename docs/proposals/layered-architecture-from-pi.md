# Layered Architecture Proposal: What Pi's Component Separation Means for Open LOS

> Builds on: [agentic-patterns-from-pi.md](./agentic-patterns-from-pi.md) and [learning-from-pi-and-claws.md](./learning-from-pi-and-claws.md)
>
> Source: Mario Zechner, "What I learned building an opinionated and minimal coding agent" (2025-11-30)

## The Core Insight

Pi's architecture has four cleanly separated layers, each with a single responsibility:

```
pi-coding-agent    Domain agent — wires tools, prompts, session management
pi-agent-core      Agent loop — tool execution, event streaming, state
pi-ai              LLM abstraction — multi-provider, streaming, context handoff
pi-tui             UI rendering
```

Every layer depends only on the one below it. `pi-coding-agent` doesn't know how to talk to Anthropic vs. OpenAI — that's `pi-ai`'s job. `pi-ai` doesn't know what tools exist — that's `pi-agent-core`'s job. `pi-agent-core` doesn't know anything about coding — that's `pi-coding-agent`'s job.

This separation is what makes Pi flexible despite being minimal. You can swap the LLM provider, change the agent loop behavior, replace the UI, or build a completely different domain agent — all without touching the other layers.

Open LOS doesn't have this separation. This proposal argues it should, and maps out exactly where the boundaries should fall.

---

## How Open LOS Currently Maps

### What we have today

```
packages/agent          LoanOriginationAgent — outcome orchestrator + LLM calls + domain logic
packages/simulation     RuleBasedAgent + LLMAgent — scenario generation + 18-action runner
packages/core           Domain services + schema
packages/api            REST server
packages/cli            CLI for human operators
```

### Where the layers tangle

**Problem 1: No shared agent loop.** `LoanOriginationAgent` (`packages/agent/src/agent.ts`) and `LLMAgent` (`packages/simulation/src/agents/index.ts`) both implement their own LLM interaction patterns. The production agent uses `LLMClient.complete()` and `LLMClient.structured()` inline throughout its methods (lines 335-361, 365-393, 478-499, 514-539, 547-568). The simulation agent calls OpenRouter directly with raw `fetch` (lines 838-912). There's no shared abstraction for "call an LLM, get a response, handle errors, track tokens."

**Problem 2: Domain knowledge baked into the execution engine.** The simulation runner's `executeStep()` (`packages/simulation/src/runner/index.ts:180-385`) is a 200-line switch statement that hardcodes the mapping from 18 action types to specific API endpoints, HTTP methods, and variable interpolation patterns. Every new API endpoint requires a new case in this switch. Meanwhile, the `custom_api_call` action at the bottom (lines 367-381) already proves the generic approach works.

**Problem 3: LLM interface is too thin.** The `LLMClient` interface (`packages/agent/src/agent.ts:44-47`) has just two methods: `complete()` and `structured()`. No streaming, no abort, no context management, no multi-provider support, no token tracking. Compare to Pi's `pi-ai` which provides streaming with partial results, abort signals throughout the pipeline, context serialization/deserialization, and cost tracking — all things a production lending agent needs.

**Problem 4: No shared event/observability model.** Pi emits events from its agent loop for everything — tool calls, LLM responses, state changes. Open LOS has no equivalent. The `LoanOriginationAgent` makes LLM calls and service calls silently. There's no way for a UI, audit trail, or monitoring system to observe what the agent is thinking or doing in real time.

---

## Proposed Layer Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     DOMAIN AGENTS (Layer 4)                     │
│                                                                 │
│  packages/agent         LoanOriginationAgent                    │
│                         Outcome-oriented methods                │
│                         Domain-specific tools & prompts          │
│                         Session management                       │
│                                                                 │
│  packages/simulation    SimulationAgent                          │
│                         Scenario generation                      │
│                         Capability gap detection                 │
│                         Persona-driven workflows                 │
├─────────────────────────────────────────────────────────────────┤
│                     AGENT CORE (Layer 3)                        │
│                                                                 │
│  packages/agent-core    AgentLoop — execute tools, feed results  │
│                           back, repeat until done                │
│                         Tool registry with schema validation     │
│                         Event emitter for all agent activity     │
│                         State management (serializable)          │
│                         Message queue (steering vs. follow-up)   │
├─────────────────────────────────────────────────────────────────┤
│                     LLM ABSTRACTION (Layer 2)                   │
│                                                                 │
│  packages/llm           Multi-provider (Anthropic, OpenAI, etc) │
│                         Streaming with partial results           │
│                         Structured output with schema validation │
│                         Context serialization/deserialization     │
│                         Abort support throughout                 │
│                         Token & cost tracking                    │
│                         Model registry with capabilities         │
├─────────────────────────────────────────────────────────────────┤
│                     DOMAIN PLATFORM (Layer 1)                   │
│                                                                 │
│  packages/core          Schema, services, invariants             │
│  packages/api           REST endpoints                           │
│  packages/cli           Human CLI                                │
│  packages/conformance   YAML test suite                          │
└─────────────────────────────────────────────────────────────────┘
```

Each layer depends only downward. Layer 4 uses Layer 3 to run agent loops. Layer 3 uses Layer 2 to talk to LLMs. Layers 3 and 4 use Layer 1 as their domain substrate.

---

## Layer 2: `packages/llm` — The LLM Abstraction

### What Pi teaches us

Pi's `pi-ai` package solves several problems the article documents extensively:

1. **Provider differences are real and annoying.** Different providers support different fields, return tokens in different formats, and handle tool calling differently. Abstracting this away once means every agent benefits.

2. **Context handoff between providers works.** You can start a session with Claude for reasoning and switch to a cheaper model for data extraction. Thinking traces get converted to content blocks, signed blobs get handled transparently.

3. **Abort support is non-negotiable.** In a lending workflow, a human might cancel a document classification mid-stream. The current `LLMClient.complete()` has no way to do this.

4. **Token tracking matters for B2B.** Open LOS customers will want to know what their AI costs are per deal, per stage, per tenant. This needs to be built into the LLM layer, not bolted on after.

### What this replaces

The current `LLMClient` interface in `packages/agent/src/agent.ts:44-52`:

```typescript
// Current: too thin
interface LLMClient {
  complete(prompt: string, options?: LLMOptions): Promise<string>
  structured<T>(prompt: string, schema: object): Promise<T>
}
```

The simulation's raw `fetch` to OpenRouter in `packages/simulation/src/agents/index.ts:861-882`.

### Proposed interface

```typescript
// packages/llm/src/types.ts

interface LLMProvider {
  id: string                          // 'anthropic' | 'openai' | 'openrouter' | ...
  name: string
}

interface Model {
  id: string                          // 'claude-sonnet-4-5' | 'gpt-5.1-codex' | ...
  provider: string
  capabilities: {
    streaming: boolean
    structuredOutput: boolean
    vision: boolean
    reasoning: boolean
  }
  cost: { input: number; output: number }
  contextWindow: number
  maxOutputTokens: number
}

interface Context {
  messages: Message[]
  // Serializable — can be saved to DB, resumed later, handed to different model
}

interface CompletionOptions {
  signal?: AbortSignal              // Abort at any point
  onEvent?: (event: StreamEvent) => void  // Stream events for UI
  temperature?: number
  maxTokens?: number
  tools?: ToolDefinition[]          // For agent-core to pass through
  structuredOutput?: {
    schema: object
    name?: string
  }
}

interface CompletionResult {
  content: string
  structured?: unknown              // Parsed if structuredOutput was requested
  stopReason: 'end' | 'tool_call' | 'max_tokens' | 'aborted'
  toolCalls?: ToolCall[]
  usage: {
    inputTokens: number
    outputTokens: number
    cacheReadTokens?: number
    cacheWriteTokens?: number
    cost: number                    // In USD
  }
}

// The core interface both agent and simulation use
interface LLMClient {
  complete(model: Model, context: Context, options?: CompletionOptions): Promise<CompletionResult>
  stream(model: Model, context: Context, options?: CompletionOptions): AsyncIterable<StreamEvent> & { result(): Promise<CompletionResult> }
}
```

### Why not use an existing unified SDK?

Pi's article directly addresses this. The Vercel AI SDK and similar libraries:
- Don't play well with self-hosted models (relevant for on-prem lending deployments)
- Have organic API surfaces that accumulate baggage
- Don't support abort properly
- Make context handoff between providers difficult

A focused ~500-line abstraction built on the raw provider SDKs gives us exactly what we need without the baggage. The simulation's `LLMAgent` already talks to OpenRouter via raw `fetch` — this just formalizes that pattern.

---

## Layer 3: `packages/agent-core` — The Agent Loop

### What Pi teaches us

Pi's `pi-agent-core` provides:

1. **A generic agent loop.** Process user message -> LLM responds -> execute tool calls -> feed results back -> repeat until no more tool calls. This is the same loop regardless of whether you're coding or originating loans.

2. **Tool registration with schema validation.** Tools have TypeBox schemas, arguments are validated with AJV before execution. Invalid arguments get detailed error messages sent back to the LLM so it can retry.

3. **Structured split tool results.** Every tool returns separate content for the LLM and for the UI/audit trail. The LLM gets a text summary; the audit trail gets structured data.

4. **Event streaming.** The loop emits events for everything: `tool_call_start`, `tool_call_end`, `llm_response`, `text_delta`, `error`. Any UI or monitoring system can subscribe.

5. **Message queue with two modes.** "Steering" messages interrupt the current step. "Follow-up" messages wait until the current step completes. Both are relevant to human-in-the-loop lending workflows.

### What this replaces

The `executeStep()` switch statement in `packages/simulation/src/runner/index.ts:180-385` and the inline LLM orchestration throughout `packages/agent/src/agent.ts`.

### Proposed design

```typescript
// packages/agent-core/src/types.ts

/**
 * A tool the agent can use. Separates LLM-facing output from audit/UI output.
 * Directly inspired by Pi's structured split tool results.
 */
interface AgentTool<TParams = unknown, TDetails = unknown> {
  name: string
  description: string
  parameters: JSONSchema                // Validated before execution
  execute: (params: TParams, context: ToolContext) => Promise<ToolResult<TDetails>>
}

interface ToolResult<TDetails = unknown> {
  /** Text content sent to the LLM for reasoning */
  output: string
  /** Structured data for audit trail, UI, or downstream processing */
  details?: TDetails
  /** Whether this tool call succeeded */
  success: boolean
  /** Optional error for failed calls */
  error?: string
}

interface ToolContext {
  /** Shared state across tool calls within a session */
  state: Map<string, unknown>
  /** The agent's abort signal */
  signal: AbortSignal
  /** Emit events for real-time observation */
  emit: (event: AgentEvent) => void
}

/**
 * Events emitted by the agent loop. Everything is observable.
 */
type AgentEvent =
  | { type: 'llm_start'; model: string; messageCount: number }
  | { type: 'llm_delta'; delta: string }
  | { type: 'llm_end'; result: CompletionResult }
  | { type: 'tool_start'; tool: string; params: unknown }
  | { type: 'tool_end'; tool: string; result: ToolResult }
  | { type: 'error'; error: Error }
  | { type: 'state_change'; key: string; value: unknown }

/**
 * Serializable agent state. Can be saved to DB, resumed later.
 * Pi's single AgentState object pattern.
 */
interface AgentState {
  id: string
  context: Context                      // LLM message history
  toolState: Record<string, unknown>    // Accumulated tool state (deal_id, etc.)
  events: AgentEvent[]                  // Full event log
  status: 'running' | 'waiting' | 'done' | 'error'
}

/**
 * The agent loop. Model-agnostic, domain-agnostic.
 */
interface AgentLoop {
  run(config: {
    model: Model
    llm: LLMClient
    tools: AgentTool[]
    systemPrompt: string
    initialMessages: Message[]
    state?: AgentState                  // Resume from previous state
    onEvent?: (event: AgentEvent) => void
    signal?: AbortSignal
    /** After each turn, ask for queued messages (human steering) */
    getQueuedMessages?: () => Message[]
  }): AsyncIterable<AgentEvent>
}
```

### How this replaces the 18-action switch statement

The simulation's `executeStep()` switch maps 18 action names to API calls. With `agent-core`, each action becomes a registered tool:

```typescript
// Instead of a case in a switch statement, each action is a tool
const createDealTool: AgentTool<CreateDealParams, { dealId: string }> = {
  name: 'create_deal',
  description: 'Create a new loan deal',
  parameters: CreateDealSchema,
  execute: async (params, ctx) => {
    const res = await apiClient.post('/v1/deals', params)
    if (res.status === 201) {
      ctx.state.set('deal_id', res.data.id)
      return {
        output: `Deal created: ${res.data.id}`,
        details: { dealId: res.data.id },
        success: true,
      }
    }
    return { output: `Failed: ${res.status}`, success: false, error: res.data }
  }
}
```

But more importantly, following Pi's minimal philosophy, you don't need 18 tools. You need 4-5 primitives (as argued in the existing [agentic-patterns-from-pi.md](./agentic-patterns-from-pi.md) proposal). The agent-core layer doesn't care how many tools you register. It validates, executes, and feeds results back regardless.

---

## Layer 4: Domain Agents Become Thin Wiring

### LoanOriginationAgent (production)

With layers 2 and 3 extracted, the `LoanOriginationAgent` becomes much thinner. It no longer handles:
- LLM provider details (Layer 2 handles this)
- Tool execution orchestration (Layer 3 handles this)
- Event streaming (Layer 3 handles this)
- State serialization (Layer 3 handles this)

What remains is purely domain-specific:
- **Which tools to register** (deal lifecycle, document processing, covenant testing)
- **What system prompt to use** (lending domain expertise)
- **How to interpret results** (outcome-oriented response shaping)
- **When to involve humans** (approval gates, risk thresholds)

```typescript
// packages/agent/src/agent.ts — much thinner

class LoanOriginationAgent {
  private loop: AgentLoop            // From agent-core
  private llm: LLMClient            // From packages/llm
  private tools: AgentTool[]         // Domain-specific tools

  constructor(config: {
    llm: LLMClient
    model: Model
    los: OpenLOSServices
  }) {
    this.llm = config.llm
    this.tools = buildLendingTools(config.los)   // Register domain tools
  }

  async submitDeal(request: DealRequest): Promise<DealSubmissionResult> {
    // The agent loop handles orchestration.
    // This method just starts it with the right prompt and interprets the result.
    const events = this.loop.run({
      model: this.model,
      llm: this.llm,
      tools: this.tools,
      systemPrompt: LENDING_SYSTEM_PROMPT,       // ~200 tokens of domain context
      initialMessages: [{
        role: 'user',
        content: `Originate a loan: ${JSON.stringify(request)}`
      }],
      onEvent: (e) => this.audit(e),             // Every event goes to audit trail
    })

    // Collect results
    for await (const event of events) {
      // Real-time streaming to any connected UI
    }
  }
}
```

### SimulationAgent

Similarly, the simulation agent stops being a 200-line switch statement + template system. It becomes:

1. A set of tools (either the 18 specific ones or the 4 primitives)
2. A system prompt describing the lending domain
3. Persona context injected as a user message
4. The generic agent loop from `agent-core` doing the orchestration

The `RuleBasedAgent` still has value as a deterministic baseline that doesn't use an LLM. But the `LLMAgent` benefits enormously from the shared infrastructure.

---

## Key Patterns from Pi Applied to Each Layer

### 1. Structured Split Tool Results (Layer 3)

Pi separates what the LLM sees from what the UI sees. This is directly applicable to lending:

```typescript
// Covenant test tool returns different content for LLM vs audit trail
const testCovenantTool: AgentTool = {
  name: 'test_covenant',
  execute: async (params, ctx) => {
    const results = await los.covenants.test(dealId, params)
    return {
      // LLM gets a summary to reason about
      output: `3 covenants tested: 2 pass, 1 warning (leverage ratio at 3.4x vs 3.5x threshold)`,
      // Audit trail / UI gets the full structured data
      details: {
        results: results.map(r => ({
          covenantId: r.id,
          metric: r.metric,
          actual: r.actualValue,
          threshold: r.threshold,
          status: r.status,
          headroom: r.headroom,
        })),
        testedAt: new Date().toISOString(),
        dealId,
      },
      success: true,
    }
  }
}
```

The LLM doesn't need to see every field of every covenant test result — that wastes context. It needs enough to decide what to do next. But the audit trail needs everything. This split is exactly what Open LOS's `_context` response pattern was reaching for, but it should happen at the tool level, not the API response level.

### 2. Minimal System Prompt (Layer 4)

Pi's system prompt is under 1,000 tokens. The article argues frontier models are RL-trained enough to understand agent patterns inherently. The benchmark results support this.

For the `LoanOriginationAgent`, this means the system prompt should contain:
- Role definition (~50 tokens)
- Tool list with one-line descriptions (~100 tokens for 4-5 tools)
- Key constraints that override model defaults (~100 tokens)
- Pointer to domain knowledge file (~20 tokens)

Everything else — the 88KB spec, stage transition rules, covenant formulas, persona descriptions — lives in files the agent reads on demand via tools. Progressive disclosure, not upfront context dumping.

```
You are a loan origination agent operating the Open LOS platform.

Tools: api_call, compute, store, assert

Constraints:
- Never compute financial ratios yourself. Use the compute tool.
- Never skip stage guards. The platform enforces them.
- All monetary amounts are in minor units (cents).
- Every action is audited. Be explicit about your reasoning.

Domain knowledge: Read /docs/SPEC.md for lending rules and stage transitions.
Read the API docs at /openapi/v1.yaml for available endpoints.
```

~150 tokens. Compare to the current approach where the `LLMAgent`'s `buildSystemPrompt()` (`packages/simulation/src/agents/index.ts:659-696`) dumps all 18 action definitions into every request.

### 3. Context Handoff (Layer 2)

Pi's context serialization enables several lending-specific patterns:

**Multi-model workflows:** Start document classification with a fast, cheap model (Haiku/GPT-4o-mini). Switch to a reasoning model (Opus/o3) for underwriting decisions. The context carries over — the reasoning model sees what the fast model classified.

**Session persistence:** A deal might take weeks. The agent's context (what it's seen, what it's decided, what's pending) needs to serialize to the database and resume when the next document arrives. Pi's `Context` object is JSON-serializable by design.

**Handoff between agents:** A simulation agent discovers a capability gap. Its context (what it tried, what failed, what the error was) can be handed to a development agent that fixes the gap. Same `Context` format, different tools.

### 4. Observable Everything (Layers 3 & 4)

Pi's strongest critique of other agents: "You have zero visibility into what that sub-agent does." This is unacceptable in lending.

The `AgentEvent` stream from Layer 3 provides:
- **Regulatory compliance:** Every LLM call, every tool invocation, every decision point is an auditable event. Map these directly to Open LOS's immutable `auditEvents` table.
- **Human steering:** A loan officer watching the agent can see it's about to make a decision and inject a steering message (Pi's message queue pattern).
- **Debugging:** When a covenant test fails unexpectedly, you can replay the exact sequence of events that led to it.
- **Cost attribution:** Every LLM call has token counts and costs, attributable to a specific deal, stage, and tenant.

### 5. File-Based State Over Built-In Features (Layer 4)

Pi's rejection of built-in to-dos and plan mode in favor of file-based state aligns with Open LOS's existing approach:

- **Deal state** is already in the database (the source of truth)
- **Agent planning** should write to a `PLAN.md` or equivalent attached to the deal, not held in ephemeral memory
- **Workflow progress** is queryable via the API's stage transitions and audit trail

This means the agent layer should be stateless between invocations. All state lives in either:
1. The database (deal state, documents, covenants) — via Layer 1
2. The serialized `AgentState` (LLM context, tool state) — via Layer 3
3. Files attached to deals (plans, analysis notes) — via tools

### 6. No MCP — Progressive CLI Tools (Layer 4)

Pi argues MCP servers waste 13-18k tokens dumping tool definitions into context before you've even started. The alternative: CLI tools with README files the agent reads on demand.

Open LOS already has `packages/cli` with full API coverage. Rather than building an MCP server (currently on the roadmap per `docs/AGENTS.md`), the agent could:

1. Start with 4-5 core tools (~200 tokens of definitions)
2. Read CLI docs on demand when it needs a capability it doesn't have
3. Use the CLI via a `bash` tool for operations not covered by core tools

This keeps the base context budget small and lets the agent discover capabilities progressively. The conformance suite already validates that the CLI works correctly, so the agent can trust it.

---

## What Changes and What Doesn't

### Stays the same
- `packages/core` — domain services, schema, invariants (Layer 1)
- `packages/api` — REST server (Layer 1)
- `packages/conformance` — YAML test suite (Layer 1)
- `packages/cli` — human CLI, now also usable as agent tools (Layer 1)
- The outcome-oriented philosophy of `LoanOriginationAgent` (Layer 4)
- The persona-driven simulation approach (Layer 4)

### New packages
- **`packages/llm`** — Unified LLM client extracted from simulation's raw fetch and agent's LLMClient interface. Multi-provider, streaming, abort, context serialization, token tracking. ~500-800 lines.
- **`packages/agent-core`** — Generic agent loop extracted from patterns implicit in both agent and simulation. Tool registry, event streaming, state management, message queue. ~400-600 lines.

### Refactored packages
- **`packages/agent`** — `LoanOriginationAgent` becomes thinner. Drops inline LLM orchestration, uses `agent-core` loop. Keeps domain-specific tools and outcome-oriented methods.
- **`packages/simulation`** — `RuleBasedAgent` stays as a deterministic baseline. `LLMAgent` uses `packages/llm` instead of raw fetch. Runner's `executeStep()` switch becomes registered tools. Capability gap detection becomes a tool result pattern, not a post-hoc analysis.

---

## Implementation Sequence

### Phase 1: Extract `packages/llm`

Extract the LLM abstraction first because both `packages/agent` and `packages/simulation` need it and currently have their own incompatible implementations.

1. Define the `LLMClient`, `Model`, `Context`, and `CompletionResult` types
2. Implement Anthropic provider (used by `LoanOriginationAgent`)
3. Implement OpenAI-compatible provider (used by simulation's OpenRouter calls)
4. Add context serialization/deserialization
5. Add abort support
6. Add token tracking
7. Migrate `packages/simulation`'s `LLMAgent` to use it
8. Migrate `packages/agent`'s `LLMClient` interface to use it

### Phase 2: Extract `packages/agent-core`

Once the LLM layer exists, extract the generic agent loop.

1. Define `AgentTool`, `ToolResult`, `AgentEvent`, `AgentState` types
2. Implement the agent loop (call LLM -> execute tools -> feed back -> repeat)
3. Add tool schema validation
4. Add event streaming
5. Add state serialization
6. Add message queue (steering + follow-up modes)
7. Write the structured split tool result pattern

### Phase 3: Refactor domain agents

With the infrastructure in place, refactor the domain agents to use it.

1. Convert `executeStep()` switch cases to registered `AgentTool` instances
2. Wire `LoanOriginationAgent` to use the agent loop
3. Wire `LLMAgent` (simulation) to use the agent loop
4. Connect agent events to the audit trail
5. Implement progressive tool loading (start minimal, add tools on demand)

---

## Relationship to Existing Proposals

**[agentic-patterns-from-pi.md](./agentic-patterns-from-pi.md)** proposed 9 patterns. This proposal provides the architectural foundation for implementing several of them:
- Pattern 1 (Minimal Tool Core) — enabled by `agent-core`'s tool registry
- Pattern 2 (Extension System) — enabled by runtime tool registration in `agent-core`
- Pattern 4 (Skills as Declarative Procedures) — skills become tool configurations loaded into `agent-core`
- Pattern 5 (State Persistence) — enabled by `AgentState` serialization in `agent-core`
- Pattern 9 (Message Queue) — built into `agent-core`'s loop

**[learning-from-pi-and-claws.md](./learning-from-pi-and-claws.md)** identified high-conviction takeaways. This proposal implements:
- Progressive tool loading — via `agent-core`'s tool registry + on-demand loading
- Single serializable agent state — `AgentState` in `agent-core`
- Streaming partial results — via `packages/llm`'s streaming support
- Domain knowledge in skills not system prompts — minimal system prompt + file-based domain knowledge

---

## Risk Assessment

**Over-engineering risk.** Pi is a personal tool for one developer. Open LOS is a platform for multiple deployment contexts. The layer boundaries might add complexity that isn't justified yet. Mitigation: start with `packages/llm` (clear, immediate value) and only extract `agent-core` once we have two concrete agent implementations that would benefit from it.

**Abstraction leakage.** Pi's article acknowledges "like any unifying API, it can never be perfect due to leaky abstractions." Provider-specific behavior will leak through. Mitigation: design the `LLMClient` interface for the 80% case and provide escape hatches for provider-specific needs.

**Not-invented-here.** We'd be building our own LLM abstraction when libraries exist. Mitigation: Pi's author tried the alternatives and found them lacking for the same reasons we would (self-hosted model support, abort handling, context handoff). Our abstraction is ~500 lines, not a framework.

**Breaking existing code.** The current `LoanOriginationAgent` and `RuleBasedAgent` work. Refactoring risks introducing bugs. Mitigation: the conformance suite validates behavior. Refactor behind the same public interfaces and let the tests catch regressions.

---

## Decision Points

Before implementation, we need to decide:

1. **How many tools?** Do we go full minimal (4 primitives: `api_call`, `assert`, `store`, `compute`) or keep domain-specific tools (18 actions mapped to registered tools)? The article and benchmarks argue for minimal. The existing proposals argue for minimal. But the `RuleBasedAgent` (no LLM) needs specific action types.

2. **Build or adopt for `packages/llm`?** Build a focused ~500-line abstraction (Pi's approach), or adopt an existing library and accept its constraints? The simulation package already does raw fetch; the agent package already has a thin interface. Neither needs a full framework.

3. **When to extract `agent-core`?** Now (because the pattern is clear) or later (when we have a second real agent implementation that proves the abstraction)? Pi built it from the start. We have the benefit of hindsight.

4. **MCP or not?** The existing roadmap includes MCP. Pi argues against it. The progressive CLI approach is simpler and more token-efficient. But MCP has ecosystem momentum.
