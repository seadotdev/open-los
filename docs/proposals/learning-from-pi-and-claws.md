# What We Can Learn from Pi, NanoClaw, and the Claw Ecosystem

> A deeper assessment for Open LOS, building on the earlier [agentic-patterns-from-pi.md](./agentic-patterns-from-pi.md)

## Note on Sources

The primary blog post ([mariozechner.at/posts/2025-11-30-pi-coding-agent](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/)) returned a 403 when accessed. This analysis is synthesized from multiple secondary sources: Armin Ronacher's analysis, the pi-mono GitHub repository, npm package documentation, DeepWiki analysis, Simon Willison's coverage of Karpathy's "Claws" commentary, and the NanoClaw repository and documentation.

---

## 1. The Core Thesis: Minimalism as Architecture

Pi's success (powering OpenClaw to 190k+ GitHub stars) with just four tools demonstrates something that goes beyond "less is more." It's a claim about where intelligence should live.

**Pi's position**: The model is the architecture. The harness is just plumbing.

- System prompt: <1,000 tokens (vs. several thousand in Claude Code, Cursor, etc.)
- Tools: Read, Write, Edit, Bash — that's it
- No MCP, no sub-agents, no todo lists, no specialized search tools

**The argument**: Frontier models have been RL-trained extensively on coding tasks. They know what bash is. They know how files work. Adding a "search in codebase" tool just adds tokens to the system prompt without adding capability. If you need ripgrep, run `rg` via bash. The model figures it out.

**Terminal-Bench 2.0 validated this**: Pi with Claude Opus held its own against specialized harnesses (Codex, Cursor, Windsurf) despite having a fraction of the tooling. The takeaway: agent performance is bottlenecked by the model, not the harness. A minimal harness lets the model show its actual capability.

### What this means for Open LOS

Our previous proposal suggested reducing 18+ action types to 4 primitives (`api_call`, `assert`, `store`, `compute`). That remains directionally right, but the deeper lesson is about **where to invest complexity**.

Pi's lesson isn't "have fewer tools." It's "don't duplicate what the model already knows." Our simulation runner's 18-action switch statement isn't bad because it has 18 cases — it's bad because each case hardcodes knowledge that an LLM could derive from an API description. The action `create_deal` is just `api_call("POST", "/v1/deals", ...)` with domain context. The model can figure that out if we give it the API schema.

**Concrete implication**: Instead of reducing to 4 generic primitives, we should ask: what does the model genuinely NOT know that we need to teach it? For a lending domain, that's things like:
- What constitutes a valid stage transition
- What financial ratios mean in context
- What a covenant breach implies for workflow
- How to interpret spread line items

Everything else (HTTP calls, JSON manipulation, test assertions) is model-native knowledge.

---

## 2. Context Budget as First-Class Constraint

Pi treats context window management as an architectural constraint, not an afterthought.

**The numbers**:
- Pi's system prompt + tool definitions: ~1,000 tokens
- A typical MCP server (Playwright): 21 tools, 13,700 tokens
- Another MCP server (Chrome DevTools): 26 tools, 18,000 tokens
- That's 7-9% of context window gone before work begins

Pi's response: no MCP support, ever. Instead, progressive disclosure — load documentation when needed, not on every session. CLI tools with README files that the agent reads on demand.

**Pi's compaction strategy**:
- Automatic compaction triggers on context overflow (recover and retry) or approaching the limit (proactive)
- Compaction is lossy — it summarizes older messages while keeping recent ones
- Full history persists in JSONL; compaction only affects the LLM's view
- The `transformContext` hook allows custom pruning before each LLM call

### What this means for Open LOS

We have an MCP server in our architecture plan (`docs/AI_NATIVE_ARCHITECTURE.md`). Pi's argument against MCP is worth taking seriously, but our situation is different:

**Where Pi's argument applies to us**: If we load 30+ MCP tool definitions into every session for a lending platform, we're burning context on tools the user might not need. A session about covenant monitoring doesn't need deal creation tools loaded.

**Where it doesn't**: Pi is a general-purpose coding agent where the model can derive tool usage from bash + file access. Our domain (lending) has specialized semantics that models won't infer from raw HTTP calls alone. A `deal.transition_stage` tool with proper validation feedback is genuinely more useful than `api_call("POST", "/v1/deals/{id}/transition")`.

**The synthesis**: Progressive tool loading. Start sessions with a minimal tool set (deal.get, deal.list, deal.search — the "orientation" tools), then load domain-specific tools based on what the user is actually doing. This is what Pi calls "skills > MCP for token efficiency."

**Practical pattern**:
```
Session starts → load 5-6 core tools (~500 tokens)
User asks about covenants → lazy-load covenant tools (~300 tokens)
User asks about transactions → lazy-load transaction analytics tools (~400 tokens)
Never loaded: document upload, spread creation, stage transition (not needed this session)
```

This is also how the agentic software ideas in `docs/IDEAS.md` describe skill loading: "discover skill metadata (name, description) upfront, and only load the full documentation when the agent actually uses that skill."

---

## 3. Skills as Code Transformation (The NanoClaw Insight)

This is the idea Karpathy called out as having "slightly blown his mind." NanoClaw's approach:

**Traditional approach**: Configuration files, feature flags, if-then-else branching
```
config.yaml:
  channels:
    - whatsapp: true
    - telegram: false
    - discord: false
  storage:
    type: sqlite  # or postgres, or s3
```

**NanoClaw's approach**: Skills are markdown files (`.claude/skills/add-telegram/SKILL.md`) that teach an AI agent how to modify the actual source code. Want Telegram? Run `/add-telegram`. Claude Code reads the skill file, modifies your fork's source code, and you end up with clean code that does exactly what you need.

**Key rules**:
- A skill PR must not modify any source files — it only adds a SKILL.md
- The skill contains instructions Claude follows to add the feature — not pre-built code
- "Customization = code changes. No configuration sprawl."
- "If you like having config files, tell Claude to add them."

**Karpathy's formulation**: "The implied new meta is to write the most maximally forkable repo and then have skills that fork it into any desired more exotic configuration."

### Why this is genuinely new

This inverts the traditional open-source model:

| Traditional OSS | NanoClaw/Skills model |
|---|---|
| One codebase, many configs | Many forks, each clean |
| Feature flags accumulate | Each fork has only what it needs |
| Complexity grows with features | Complexity stays constant |
| Contributors add code | Contributors add instructions |
| Users configure | Users transform |
| Codebase must handle all cases | Each instance handles one case |

The prerequisite: the codebase must be small enough that an AI can understand and modify it. NanoClaw is ~3,900 lines across 15 files. That's the constraint that makes this work.

### What this means for Open LOS

This pattern maps onto several things we're already thinking about:

**1. Platform customization**

From `docs/principles-and-ideas.md`: "The UX is very customisable. Users can modify any page and an agent will create their modifications."

The NanoClaw insight takes this further. Instead of building a configuration system for lending workflows (which stage comes after which, what documents are required, what covenants to check), we could provide skills that transform the codebase:

```
/add-invoice-finance      → modifies deal stages, adds invoice-specific fields
/add-regulatory-reporting  → adds FCA reporting endpoints and scheduled jobs
/add-multi-currency       → transforms amount fields, adds currency conversion
/add-syndication          → adds participant tracking, allocation waterfall
```

Each of these would be a SKILL.md that an AI reads and executes against a fork, producing clean code without the feature ever needing to be a flag.

**2. Conformance test customization**

Our simulation/conformance framework currently has hardcoded workflow templates. Instead of parameterizing them infinitely, we could provide skills:

```
/add-persona-trade-finance  → creates test scenarios for trade finance workflows
/add-persona-real-estate    → creates test scenarios for CRE lending
/add-mambu-adapter          → generates API adapter for Mambu's specific endpoints
```

**3. The constraint this imposes**

For this to work, the core must stay small enough for an AI to comprehend and safely modify. This is a genuine architectural constraint — it argues against building a maximally feature-rich platform and toward building a maximally comprehensible one.

From our `docs/IDEAS.md`: "AI is inverting this. The best AI code is simple and close to the model." The skills-as-transformation pattern is the logical extension.

---

## 4. The Agent Loop: What Pi Gets Right Technically

Beyond philosophy, Pi's agent loop has specific technical patterns worth studying:

### 4a. Partial JSON Streaming

As the LLM streams tool call arguments, Pi progressively parses them so the UI can show partial results. You see a file diff streaming in as the agent generates it. This is critical for UX — without it, tool calls feel like black boxes with loading spinners.

**Relevance**: If we build agentic workflows for deal analysis (LLM reads spread, reasons about covenant compliance, generates recommendations), streaming partial results would dramatically improve the experience vs. waiting for a complete response.

### 4b. Message Queue with Two Modes

Pi's agent loop supports message queuing with two modes:
- **One-at-a-time**: User input is queued and delivered at safe points between tool calls
- **All-at-once**: All queued messages delivered together

This prevents race conditions where a user sends a correction while the agent is mid-execution. The loop asks for queued messages after each turn and injects them before the next assistant response.

**Relevance**: For interactive simulation runs or deal review sessions, users need to be able to steer the agent mid-execution ("skip that step", "try a different approach", "focus on the covenant section"). Pi's steering vs. follow-up distinction maps directly to our interactive runner proposal.

### 4c. State as a Single Object

All agent state lives in a single `AgentState` object — serializable, persistable, inspectable. This enables:
- Session persistence (save/restore)
- Forking (branch a session to explore alternatives)
- Debugging (inspect exactly what the agent saw)

**Relevance**: This validates the session persistence proposal from our earlier analysis. For simulation runs, being able to fork a session at the point a capability gap was detected and explore alternatives is genuinely useful.

### 4d. No Max Steps

Pi's agent loop has no max-steps parameter. It loops until the model says it's done. Mario's reasoning: he never found a use case for capping it. The model either completes the task or gets stuck, and in either case an arbitrary step limit doesn't help.

**Relevance**: This is worth considering for our simulation runner. Currently `runSimulation()` iterates through a fixed workflow. A more Pi-like approach would give the LLM agent the scenario description and let it run until it considers the scenario complete, with the ability to add steps or skip steps based on what it discovers.

---

## 5. The "Maximally Forkable Repo" Idea

Karpathy's framing deserves separate attention. The claim is that the best architecture for AI-era software is:

1. A small, comprehensible core
2. Skills that transform the core into specific configurations
3. Forks as the unit of customization (not config files)

This is essentially **composition by code generation** rather than composition by configuration.

### The prerequisites for this to work

1. **The core must be small enough for an AI to fully understand** — NanoClaw targets ~4,000 lines. Pi's coding agent core is similarly compact.

2. **The core must be cleanly structured** — no tangled dependencies, clear boundaries, each file doing one thing.

3. **Skills must be well-tested patterns** — a SKILL.md that produces broken code on 30% of forks isn't useful. Skills need to be deterministic transformations.

4. **The fork must remain updatable** — if the upstream core changes, forks need to be able to pull changes without conflicts with skill-applied modifications. This is the hard unsolved problem.

### Where this maps to Open LOS

Our situation is different from NanoClaw (we're not a 4,000-line chatbot), but the principle applies at the package level:

- `packages/core` could be maximally forkable — clean schema, clear services, minimal coupling
- Skills transform a fork of core for specific lending verticals (trade finance, CRE, SME, invoice discounting)
- The conformance suite validates that transformations don't break invariants

The risk: lending platforms inevitably grow complex. A 4,000-line lending core would be missing critical functionality. The question is whether we can maintain the "fits in an AI's head" property at the package level even if the total system is larger.

---

## 6. Security: Pi's Nihilism vs. NanoClaw's Containers

Pi and NanoClaw take opposite security approaches, both instructive:

**Pi**: Full YOLO mode. No permission checks, no sandboxing. "Everybody is running in YOLO mode anyways to get any productive work done, so why not make it the default and only option?"

**NanoClaw**: Every agent session runs inside an isolated Linux container with its own filesystem, IPC namespace, and process space. Agents can only access directories explicitly mounted. Bash commands run inside the container, not on the host.

**NanoClaw's insight**: Container isolation means bash access becomes safe by default. You don't need application-level permission checks if the execution environment itself is constrained. The agent can `rm -rf /` inside its container and nothing bad happens.

### What this means for Open LOS

For a lending platform handling financial data, Pi's nihilism is obviously not viable. But NanoClaw's approach is worth studying:

- Simulation runs could execute in containers with only the API endpoint mounted
- LLM-generated code (for custom scenario generation) runs in sandboxes
- The agent can freely use bash, install packages, run analysis scripts — all inside a container with no access to production data beyond what's explicitly provided

This connects to our existing thinking in `docs/IDEAS.md`: "Everything should be a sandbox job" and "agents need to run multi-step operations...that's dozens of steps, each potentially modifying files, installing packages, running scripts."

---

## 7. Concrete Takeaways for Open LOS

Ranked by conviction level:

### High conviction — should adopt

1. **Progressive tool/context loading**: Don't dump all MCP tools into every session. Load core tools first, lazy-load domain tools based on the conversation. This is well-validated by Pi and aligns with our existing skills thinking.

2. **Agent state as a single serializable object**: Makes session persistence, forking, and debugging trivial. Our simulation runner should adopt this pattern.

3. **Streaming partial results for agentic workflows**: Any LLM-powered analysis (deal review, covenant assessment, portfolio analysis) should stream partial results, not block until complete.

4. **Domain knowledge in skills, not system prompts**: Lending domain knowledge (what DSCR means, how stage transitions work, what a covenant breach implies) should be in loadable skill files, not burned into system prompts.

### Medium conviction — worth experimenting with

5. **Skills as code transformation for platform customization**: Compelling for vertical-specific customizations (trade finance, CRE, SME lending). Requires keeping packages small and cleanly structured. Worth prototyping with one vertical.

6. **Container-isolated execution for LLM-generated code**: If we build LLM-powered scenario generation (the LLMAgent from our simulation framework), running generated code in containers is the right security model.

7. **Removing max-step limits from simulation runs**: Let the LLM agent decide when a scenario is complete rather than iterating through a fixed workflow. Requires good compaction/context management.

### Lower conviction — interesting but uncertain

8. **The "maximally forkable repo" model for the whole platform**: Works well for 4,000-line chatbots. Less clear how it scales to a lending platform with complex domain logic, schema migrations, and regulatory requirements. Worth watching how the Claw ecosystem evolves.

9. **Full YOLO mode for development**: Pi's argument that permission prompts slow down development without adding security is valid for personal coding agents but not for multi-tenant financial platforms. We need a middle ground.

---

## 8. Relationship to Our Existing Architecture

| Our current plan | Pi/Claw insight | Recommendation |
|---|---|---|
| MCP server with 30+ tools | Pi says no MCP; NanoClaw uses Agent SDK directly | Keep MCP but implement progressive loading |
| 18 hardcoded action types | Pi uses 4 generic tools | Reduce to domain primitives + LLM-derived actions |
| Rule-based workflow templates | Pi/NanoClaw use skills as markdown | Convert templates to loadable skill files |
| Planned LLMAgent (placeholder) | Pi proves minimal harness + good model = good results | Prioritize making LLMAgent work with minimal tooling |
| Web UI as primary interface | Pi is CLI-first; NanoClaw is messaging-first | Our CLI-first + activity hub approach aligns well |
| Configuration via code/env vars | NanoClaw: customization = code changes via skills | Worth adopting for vertical customization |
| No execution isolation | NanoClaw: containers by default | Adopt for simulation runs and generated code |

---

## References

- [Pi blog post](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/) — Mario Zechner (403 at time of access)
- [pi-mono repository](https://github.com/badlogic/pi-mono) — Mario Zechner
- [Pi: The Minimal Agent Within OpenClaw](https://lucumr.pocoo.org/2026/1/31/pi/) — Armin Ronacher
- [NanoClaw repository](https://github.com/qwibitai/nanoclaw) — Gavriel Cohen
- [Andrej Karpathy talks about "Claws"](https://simonwillison.net/2026/Feb/21/claws/) — Simon Willison
- [OpenClaw — Wikipedia](https://en.wikipedia.org/wiki/OpenClaw)
- [Four Tools and a Lobster](https://random.qmx.me/posts/2026/02/04/four-tools-and-a-lobster/)
- [Previous analysis: agentic-patterns-from-pi.md](./agentic-patterns-from-pi.md)
