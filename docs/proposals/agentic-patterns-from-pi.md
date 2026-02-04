# Agentic Patterns Proposal: Applying Pi Concepts to Open LOS

> Based on concepts from [Pi: The Minimal Agent Within OpenClaw](https://lucumr.pocoo.org/2026/1/31/pi/) by Armin Ronacher

## Executive Summary

This proposal analyzes the architectural patterns from Pi (the coding agent behind OpenClaw) and identifies where they could enhance our simulation framework. Pi's philosophy of "minimal core + aggressive extensibility" and "code writing code" offers compelling patterns for evolving our agent architecture.

---

## Key Pi Concepts & Their Relevance

### 1. Minimal Tool Core

**Pi's Approach**: Only 4 tools - Read, Write, Edit, Bash. Everything else is built through extensions or code generation.

**Current Open LOS State**:
- 18+ action types in `executeStep()` switch statement (`packages/simulation/src/runner/index.ts:140-291`)
- Each action is hardcoded with specific API endpoint mappings

**Proposal**: Refactor toward a minimal primitive set:

```typescript
// Current: 18 specific actions
type WorkflowAction =
  | "create_deal" | "update_deal" | "transition_stage"
  | "create_entity" | "create_relationship" | "create_spread"
  // ... 12 more specific actions
  | "custom_api_call";

// Proposed: 4 primitive actions + composable extensions
type PrimitiveAction =
  | "api_call"      // Generic HTTP operation
  | "assert"        // Validate response/state
  | "store"         // Capture value to context
  | "compute";      // Transform/derive values

// Complex actions become composable sequences
const createDeal = skill("create_deal", [
  { action: "api_call", method: "POST", path: "/v1/deals", body: "{{params}}" },
  { action: "store", key: "deal_id", from: "response.id" },
  { action: "assert", condition: "status == 201" }
]);
```

**Benefits**:
- Simpler core execution engine
- New capabilities without code changes
- Better separation of concerns

**Relevant Files**:
- `packages/simulation/src/runner/index.ts` - executeStep() refactoring
- `packages/simulation/src/agents/index.ts` - template generation

---

### 2. Extension System for Self-Extension

**Pi's Approach**: Agents can extend themselves by writing code. No need to download plugins - ask the agent to create what it needs.

**Current Open LOS State**:
- `LLMAgent` is a placeholder that falls back to `RuleBasedAgent`
- No mechanism for agents to define new capabilities

**Proposal**: Implement an extension registry that agents can populate:

```typescript
// Extension API similar to Pi's
interface ExtensionAPI {
  registerTool(name: string, handler: ToolHandler): void;
  registerSkill(name: string, workflow: WorkflowStep[]): void;
  getState<T>(key: string): T | undefined;
  setState<T>(key: string, value: T): void;
}

// LLMAgent could generate and register new skills
class LLMAgent {
  async generateScenario(persona: Persona): Promise<SimulationScenario> {
    // If existing templates don't cover the persona's needs...
    const customSkill = await this.generateCustomSkill(persona);
    this.extensions.registerSkill(customSkill.name, customSkill.steps);

    return this.buildScenarioUsing(customSkill);
  }
}
```

**Relevant Files**:
- `packages/simulation/src/agents/index.ts:622-651` - LLMAgent implementation
- New file: `packages/simulation/src/extensions/index.ts`

---

### 3. Tree-Based Session Architecture

**Pi's Approach**: Sessions are trees, not linear sequences. Branch for side-quests, rewind and summarize, navigate history.

**Current Open LOS State**:
- Linear workflow execution (`runSimulation()` iterates sequentially)
- No branching or exploration capability
- Blocker gaps halt execution entirely

**Proposal**: Implement execution trees for exploratory testing:

```typescript
interface ExecutionTree {
  id: string;
  parentId?: string;
  context: ExecutionContext;
  steps: StepResult[];
  branches: ExecutionTree[];
}

// Enable branching when hitting capability gaps
async function runSimulationWithBranching(
  scenario: SimulationScenario,
  persona: Persona,
  config: RunnerConfig
): Promise<ExecutionTree> {
  const tree = createExecutionTree();

  for (const step of scenario.workflow) {
    const result = await executeStep(tree.context, step);

    if (result.capabilityGap?.severity === "blocker") {
      // Instead of stopping, create a branch to explore alternatives
      const branch = tree.createBranch(`explore-${result.capabilityGap.capabilityId}`);
      const alternatives = await generateAlternatives(step, persona);

      for (const alt of alternatives) {
        await runSimulationWithBranching(
          { ...scenario, workflow: [alt, ...remainingSteps] },
          persona,
          config
        );
      }
    }

    tree.steps.push(result);
  }

  return tree;
}
```

**Benefits**:
- Discover workarounds for missing capabilities
- Richer gap analysis ("we couldn't do X, but Y worked")
- Enable "what-if" scenario exploration

**Relevant Files**:
- `packages/simulation/src/runner/index.ts:408-479` - runSimulation()
- New concept for simulation results

---

### 4. Skills as Declarative Procedures

**Pi's Approach**: Skills are Agent Skills standard packages with SKILL.md that models invoke via `/skill:name`. They provide procedural steps for common tasks.

**Current Open LOS State**:
- `WORKFLOW_TEMPLATES` are hardcoded arrays (`packages/simulation/src/agents/index.ts:39-218`)
- No discoverability or self-documentation

**Proposal**: Convert templates to skills with metadata:

```typescript
// skills/basic-origination.skill.ts
export const skill = {
  name: "basic-origination",
  description: "Complete workflow from deal creation to facility setup",
  requiredCapabilities: ["deal-lifecycle", "entity-management", "facility-management"],

  // Rich metadata for LLM understanding
  context: `
    This skill tests the core origination workflow that every lending platform must support.
    It creates a deal, adds borrower entities, and sets up the initial facility structure.
    Use this when testing platforms that claim to support commercial lending origination.
  `,

  // Parameterized workflow
  workflow: (params: OriginationParams) => [
    { action: "create_deal", params: params.deal },
    { action: "create_entity", params: params.borrower },
    { action: "create_relationship", params: { type: "borrower" } },
    { action: "create_facility", params: params.facility }
  ],

  // Success criteria
  expectedOutcome: {
    dealCreated: true,
    facilityActive: true,
    minimumStepsCompleted: 4
  }
};
```

**Benefits**:
- LLMAgent can reason about which skills to compose
- Self-documenting test scenarios
- Reusable across different personas

**Relevant Files**:
- `packages/simulation/src/agents/index.ts:39-218` - WORKFLOW_TEMPLATES
- New directory: `packages/simulation/src/skills/`

---

### 5. State Persistence Across Sessions

**Pi's Approach**: Extensions can persist state to disk, enabling hot-reload development loops.

**Current Open LOS State**:
- `ExecutionContext.variables` is ephemeral (Map in memory)
- No persistence between simulation runs
- No ability to resume failed simulations

**Proposal**: Add session persistence for simulation state:

```typescript
interface SessionManager {
  save(sessionId: string, state: SimulationState): Promise<void>;
  load(sessionId: string): Promise<SimulationState | null>;
  listSessions(): Promise<SessionMetadata[]>;
  fork(sessionId: string, branchName: string): Promise<string>;
}

interface SimulationState {
  scenario: SimulationScenario;
  persona: Persona;
  context: SerializedContext;
  stepResults: StepResult[];
  checkpoints: Checkpoint[];
  branches: BranchInfo[];
}

// Enable resume from failure
async function resumeSimulation(
  sessionId: string,
  fromCheckpoint?: string
): Promise<SimulationResult> {
  const state = await sessionManager.load(sessionId);
  const checkpoint = fromCheckpoint
    ? state.checkpoints.find(c => c.id === fromCheckpoint)
    : state.checkpoints[state.checkpoints.length - 1];

  return runSimulation(
    state.scenario,
    state.persona,
    config,
    { resumeFrom: checkpoint }
  );
}
```

**Benefits**:
- Debug failed simulations by resuming from last good state
- Share simulation sessions for collaboration
- Enable incremental testing as API evolves

**Relevant Files**:
- `packages/simulation/src/runner/index.ts:118-123` - ExecutionContext
- New file: `packages/simulation/src/sessions/index.ts`

---

### 6. Hot Reloading for Development

**Pi's Approach**: Extensions and themes hot-reload without session restart. Write code, reload, test in a loop.

**Current Open LOS State**:
- Changes require full restart
- No watch mode for template development

**Proposal**: Add hot-reload support for skills and templates:

```typescript
// In CLI watch mode
class HotReloader {
  private watcher: FSWatcher;
  private skillRegistry: SkillRegistry;

  async start() {
    this.watcher = watch("./skills/**/*.ts", async (event, path) => {
      console.log(`Skill changed: ${path}`);

      // Reload without losing context
      const skill = await this.loadSkill(path);
      this.skillRegistry.register(skill);

      // Optionally re-run affected scenarios
      if (this.config.autoRerun) {
        await this.rerunAffectedScenarios(skill.name);
      }
    });
  }
}

// CLI command
// $ open-los simulate --watch --persona bank-sme-lender
```

**Benefits**:
- Faster iteration on test scenarios
- Interactive development workflow
- Immediate feedback on template changes

**Relevant Files**:
- `packages/simulation/src/cli.ts` - Add --watch flag

---

### 7. Layered Configuration (AGENTS.md Pattern)

**Pi's Approach**: Configuration cascades from global → parent directories → project. AGENTS.md files concatenate for cumulative context.

**Current Open LOS State**:
- Configuration is programmatic only
- No file-based context injection

**Proposal**: Adopt hierarchical context files for personas and capabilities:

```
~/.open-los/
  CONTEXT.md           # Global testing context
  personas/
    PERSONAS.md        # Custom persona definitions

project/
  .open-los/
    CONTEXT.md         # Project-specific context
    settings.json      # Override defaults
    personas/
      custom.json      # Project-specific personas
```

**Context file example**:
```markdown
# Project Testing Context

## API Endpoints
Base URL: https://staging.example.com/api

## Authentication
All requests should use Bearer token from $API_TOKEN environment variable.

## Known Limitations
- Multi-currency not yet deployed to staging
- Document upload limited to 5MB

## Custom Capabilities to Test
- Verify the new covenant breach notification system
- Test the updated approval workflow with 3-level hierarchy
```

**Benefits**:
- Teams can customize without code changes
- Context travels with the project
- Easy onboarding for new team members

**Relevant Files**:
- `packages/simulation/src/runner/index.ts:26-44` - RunnerConfig
- New: configuration loader module

---

### 8. Code Generation Over Protocol (No MCP)

**Pi's Approach**: No MCP support. If you need new capability, write code. "LLMs are really good at writing and running code, so embrace this."

**Current Open LOS State**:
- Fixed action types require code changes to extend
- `custom_api_call` exists but is underutilized

**Proposal**: Lean into code generation for LLMAgent:

```typescript
class LLMAgent {
  async generateScenario(persona: Persona): Promise<SimulationScenario> {
    // Instead of selecting from templates, generate custom code
    const prompt = `
      Given this lending business persona:
      ${JSON.stringify(persona, null, 2)}

      Generate a test workflow as executable TypeScript.
      Available primitives: api_call, assert, store, compute

      Example:
      const workflow = [
        api_call("POST", "/v1/deals", { name: "Test Deal" }),
        store("deal_id", "$.id"),
        api_call("POST", "/v1/deals/{{deal_id}}/entities", { ... }),
        assert("$.status", "equals", "active")
      ];
    `;

    const code = await this.llm.generate(prompt);

    // Execute in sandbox and capture workflow
    return this.executeGeneratedCode(code);
  }
}
```

**Benefits**:
- Unlimited flexibility for edge cases
- Natural fit for LLM capabilities
- No protocol learning curve

**Relevant Files**:
- `packages/simulation/src/agents/index.ts:622-651` - LLMAgent
- Consider sandboxed execution environment

---

### 9. Message Queue Patterns (Steering vs Follow-up)

**Pi's Approach**: Distinguishes between steering messages (interrupt current work) and follow-up messages (wait for completion).

**Current Open LOS State**:
- No interactive intervention during simulation runs
- All-or-nothing execution

**Proposal**: Add intervention points for interactive debugging:

```typescript
interface InteractiveRunner {
  onStepComplete(callback: (step: StepResult, control: StepControl) => void): void;
  onGapDetected(callback: (gap: CapabilityGap, control: GapControl) => void): void;
}

interface StepControl {
  continue(): void;
  pause(): void;
  retry(): void;
  skip(): void;
  branch(alternativeStep: WorkflowStep): void;
}

// Interactive CLI mode
const runner = createInteractiveRunner(scenario, persona);

runner.onGapDetected((gap, control) => {
  console.log(`Gap detected: ${gap.description}`);
  const response = await prompt("Continue, retry, or branch? ");

  switch (response) {
    case "branch":
      const alt = await prompt("Enter alternative action: ");
      control.branch(parseAction(alt));
      break;
    // ...
  }
});

await runner.start();
```

**Benefits**:
- Debug complex scenarios interactively
- Explore alternatives in real-time
- Better understanding of gap causes

**Relevant Files**:
- `packages/simulation/src/runner/index.ts` - Add interactive mode
- `packages/simulation/src/cli.ts` - Add --interactive flag

---

## Implementation Priority

| Priority | Pattern | Effort | Impact |
|----------|---------|--------|--------|
| 1 | Skills as Declarative Procedures | Medium | High - Enables LLMAgent, better organization |
| 2 | State Persistence | Medium | High - Enables resume, debugging |
| 3 | Minimal Tool Core | High | High - Simplifies execution engine |
| 4 | Layered Configuration | Low | Medium - Better team workflow |
| 5 | Extension System | High | High - Full self-extension capability |
| 6 | Tree-Based Sessions | High | Medium - Exploratory testing |
| 7 | Hot Reloading | Medium | Medium - Developer experience |
| 8 | Code Generation | Medium | Medium - Requires LLM integration |
| 9 | Interactive Runner | Medium | Low - Niche debugging use case |

---

## Architecture Diagram: Proposed Evolution

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CONFIGURATION LAYER                               │
│  ~/.open-los/CONTEXT.md → project/.open-los/CONTEXT.md → settings.json     │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             AGENT LAYER                                     │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐      │
│  │  RuleBasedAgent  │    │    LLMAgent      │    │  CustomAgent     │      │
│  │  (templates)     │    │  (code gen)      │    │  (extensions)    │      │
│  └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘      │
│           │                       │                       │                 │
│           └───────────────────────┼───────────────────────┘                 │
│                                   ▼                                         │
│                         ┌──────────────────┐                                │
│                         │  Skill Registry  │                                │
│                         │  (declarative    │                                │
│                         │   workflows)     │                                │
│                         └────────┬─────────┘                                │
└──────────────────────────────────┼──────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXECUTION LAYER                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        Minimal Tool Core                              │  │
│  │  api_call() ──► assert() ──► store() ──► compute()                   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                   │                                         │
│  ┌───────────────────┐   ┌───────┴───────┐   ┌───────────────────┐        │
│  │ Session Manager   │   │ Execution     │   │ Extension API     │        │
│  │ (persistence,     │◄──│ Tree          │──►│ (tools, skills,   │        │
│  │  branching)       │   │ (branching)   │   │  state)           │        │
│  └───────────────────┘   └───────────────┘   └───────────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           REPORTING LAYER                                   │
│  Gap Analysis ──► Priority Scoring ──► Recommendations ──► Export          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Conclusion

The Pi philosophy of "minimal core + self-extension + code generation" aligns well with our simulation framework's goals. The most impactful changes would be:

1. **Converting templates to skills** - Better organization and LLM-friendly
2. **Adding session persistence** - Enable resume and debugging
3. **Simplifying the execution engine** - Fewer primitives, more composition

These changes would position Open LOS for true LLM-powered scenario generation while maintaining the reliability of rule-based testing.

---

## References

- [Pi: The Minimal Agent Within OpenClaw](https://lucumr.pocoo.org/2026/1/31/pi/) - Armin Ronacher
- [Tools: Code Is All You Need](https://lucumr.pocoo.org/2025/7/3/tools/) - Armin Ronacher
- [Pi Mono Repository](https://github.com/badlogic/pi-mono) - Mario Zechner
- [OpenClaw Documentation](https://docs.openclaw.ai/)
