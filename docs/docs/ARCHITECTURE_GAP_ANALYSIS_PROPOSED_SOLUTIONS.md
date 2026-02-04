# Proposed Solutions: QMD and Pi for Agentic Open LOS

Refers to docs/ARCHITECTURE_GAP_ANALYSIS.md

This document analyzes two open-source projects that can address the critical gaps identified in our architecture analysis:

1. **[QMD](https://github.com/tobi/qmd)** - Hybrid search engine for the **Accessibility** problem
2. **[Pi](https://lucumr.pocoo.org/2026/1/31/pi/)** - Minimal agent runtime for the **Intelligence** problem

---

## The Two Core Problems

From our gap analysis, the fundamental issues preventing an agentic platform are:

| Problem | Description | Current State |
|---------|-------------|---------------|
| **Accessibility** | Context exists but AI cannot find it | Data in tables, documents as blobs, no search |
| **Intelligence** | Framework exists but no agents do real work | API designed for AI, but no agent runtime |

These are not feature gaps—they are architectural gaps. Adding more endpoints won't help. We need new subsystems.

---

## Solution 1: QMD for Accessibility

### What QMD Is

QMD is an **on-device hybrid search engine** designed specifically for AI agent workflows. Created by Tobi Lütke, it combines three retrieval methods:

```
┌─────────────────────────────────────────────────────────────┐
│                     QMD Search Pipeline                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Query: "construction loan covenant breach"                 │
│                          │                                   │
│                          ▼                                   │
│   ┌─────────────────────────────────────────┐               │
│   │   Query Expansion (Fine-tuned 1.7B)     │               │
│   │   • Lexical: "construction lending"      │               │
│   │   • Semantic: "building project default" │               │
│   │   • HyDE: hypothetical matching doc      │               │
│   └─────────────────────────────────────────┘               │
│                          │                                   │
│            ┌─────────────┴─────────────┐                    │
│            ▼                           ▼                    │
│   ┌─────────────────┐       ┌─────────────────┐            │
│   │  BM25 Full-Text │       │  Vector Search  │            │
│   │  (SQLite FTS5)  │       │  (sqlite-vec)   │            │
│   └─────────────────┘       └─────────────────┘            │
│            │                           │                    │
│            └─────────────┬─────────────┘                    │
│                          ▼                                   │
│   ┌─────────────────────────────────────────┐               │
│   │   Reciprocal Rank Fusion + Reranking    │               │
│   │   (Qwen 0.6B reranker)                  │               │
│   └─────────────────────────────────────────┘               │
│                          │                                   │
│                          ▼                                   │
│              Ranked Results with Scores                      │
└─────────────────────────────────────────────────────────────┘
```

### Why QMD Solves Our Accessibility Gap

| Gap | How QMD Addresses It |
|-----|---------------------|
| **No full-text search** | BM25 via SQLite FTS5—exact keyword matching |
| **No semantic search** | Vector embeddings via local Gemma model |
| **No query understanding** | Fine-tuned query expansion model generates alternatives |
| **Documents locked in blobs** | Indexes document content, not just metadata |
| **AI can't find context** | MCP server exposes search to AI agents |
| **Cloud dependency** | Runs entirely on-device with local models |

### The Query Expansion Innovation

The [finetune component](https://github.com/tobi/qmd/tree/main/finetune) trains a small model (Qwen3-1.7B) to expand queries:

**Input:** `"auth config"`

**Output:**
```json
{
  "lexical": ["authentication configuration", "auth settings", "login config"],
  "semantic": ["how to configure user authentication", "setting up login credentials"],
  "hyde": "The authentication configuration is managed in config/auth.yaml where you can specify OAuth providers, session timeouts, and password policies..."
}
```

This means when an AI asks about "covenant breach procedures," QMD searches for:
- Exact terms: "covenant breach", "covenant violation"
- Semantic concepts: "loan default process", "borrower non-compliance"
- Hypothetical content: A passage describing what a covenant breach document might contain

### Integration Architecture for Open LOS

```
┌─────────────────────────────────────────────────────────────┐
│                     Open LOS + QMD                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌─────────────┐ │
│  │  Documents   │     │Communications│     │  Decisions  │ │
│  │  (blobs)     │     │  (emails)    │     │  (rationale)│ │
│  └──────┬───────┘     └──────┬───────┘     └──────┬──────┘ │
│         │                    │                    │         │
│         └────────────────────┼────────────────────┘         │
│                              ▼                               │
│                    ┌─────────────────┐                      │
│                    │  Export Pipeline │                      │
│                    │  (to markdown)   │                      │
│                    └────────┬────────┘                      │
│                             ▼                               │
│                    ┌─────────────────┐                      │
│                    │   QMD Index     │                      │
│                    │  • FTS5 index   │                      │
│                    │  • Vector store │                      │
│                    │  • Metadata     │                      │
│                    └────────┬────────┘                      │
│                             │                               │
│              ┌──────────────┴──────────────┐                │
│              ▼                             ▼                │
│     ┌─────────────────┐          ┌─────────────────┐       │
│     │   MCP Server    │          │   Direct API    │       │
│     │  (for agents)   │          │  (for UI/API)   │       │
│     └─────────────────┘          └─────────────────┘       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Plan

**Phase 1: Document Export Pipeline**
```typescript
// New service: packages/core/src/services/search-export.ts
export async function exportDealForSearch(dealId: string): Promise<SearchDocument[]> {
  const deal = await getDeal(dealId);
  const documents = await listDocuments(dealId);
  const communications = await listCommunications(dealId);
  const spreads = await listSpreads(dealId);
  const decisions = await getDecisions(dealId); // New table needed

  return [
    formatDealSummary(deal),
    ...documents.map(extractDocumentContent),
    ...communications.map(formatCommunication),
    ...spreads.map(formatFinancialSummary),
    ...decisions.map(formatDecision),
  ];
}
```

**Phase 2: QMD Integration**
```typescript
// New package: packages/search/
// Wraps QMD CLI and MCP server

export class SearchService {
  async index(docs: SearchDocument[]): Promise<void>;
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  async similar(docId: string): Promise<SearchResult[]>;
}
```

**Phase 3: MCP Exposure**
```typescript
// Add to MCP server tools
{
  name: "search_context",
  description: "Search across all deal documents, communications, and decisions",
  parameters: {
    query: { type: "string", description: "Natural language search query" },
    deal_id: { type: "string", description: "Optional: limit to specific deal" },
    types: { type: "array", description: "Filter by: document, communication, decision" }
  }
}
```

### New Tables Required

```sql
-- Capture decision rationale (identified gap in context layer)
CREATE TABLE decisions (
  id TEXT PRIMARY KEY,
  deal_id TEXT REFERENCES deals(id),
  decision_type TEXT NOT NULL, -- 'approval', 'pricing', 'exception', 'escalation'
  outcome TEXT NOT NULL,       -- 'approved', 'declined', 'modified'
  rationale TEXT NOT NULL,     -- Why this decision was made
  factors TEXT,                -- JSON: key factors considered
  precedents TEXT,             -- JSON: references to similar past decisions
  actor TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Link decisions to similar historical decisions
CREATE TABLE precedent_links (
  decision_id TEXT REFERENCES decisions(id),
  precedent_id TEXT REFERENCES decisions(id),
  similarity_score REAL,
  PRIMARY KEY (decision_id, precedent_id)
);
```

---

## Solution 2: Pi for Intelligence

### What Pi Is

Pi is a **minimal coding agent** by Mario Zechner, used as the core of [OpenClaw](https://github.com/openclaw/openclaw). Its philosophy:

> "LLMs are really good at writing and running code, so embrace this."

Unlike agents with dozens of tools and complex orchestration, Pi has:
- **4 tools**: Read, Write, Edit, Bash
- **Extension system**: Agents can persist state and extend themselves
- **Session trees**: Branch, navigate, and resume work
- **Hot reloading**: Agents modify their own code and test it

### Why Pi Solves Our Intelligence Gap

| Gap | How Pi Addresses It |
|-----|---------------------|
| **No production AI agents** | Pi is a production-ready agent runtime |
| **MCP designed but not built** | Pi doesn't need MCP—it uses Bash to call any CLI |
| **No autonomous task execution** | Extensions enable persistent, resumable work |
| **No proactive recommendations** | Session trees allow background analysis branches |
| **Agents can't extend themselves** | Core philosophy—agent writes its own skills |

### The Minimal Core Philosophy

From [Armin Ronacher's analysis](https://lucumr.pocoo.org/2026/1/31/pi/):

> "Pi's entire idea is that if you want the agent to do something that it doesn't do yet, you don't go and download an extension or a skill. You ask the agent to extend itself. It celebrates the idea of code writing and running code."

This is profound for Open LOS because:

1. **Domain skills emerge naturally**: Instead of pre-building "Document Analyst" or "Covenant Monitor" agents, a Pi-based agent can be asked to build these capabilities for itself using our API.

2. **No skill marketplace needed**: The agent reads our OpenAPI spec, understands it, and creates tools to interact with it.

3. **Continuous improvement**: When the agent encounters a limitation, it extends itself rather than failing.

### The Extension System

Pi extensions can:
- Register tools for the LLM to call
- Persist state into sessions
- Hot reload without breaking context
- Render TUI components
- Branch into sub-sessions for side quests

```
┌─────────────────────────────────────────────────────────────┐
│                    Pi Extension Model                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Session Tree:                                               │
│                                                              │
│     main ──┬── analyze deal #123                            │
│            │      │                                          │
│            │      ├── [branch] fix covenant calc bug         │
│            │      │      └── (merged back)                   │
│            │      │                                          │
│            │      └── generate report                        │
│            │                                                 │
│            └── [branch] review PR #45                        │
│                   └── (separate context)                     │
│                                                              │
│  Extensions:                                                 │
│    • /deals - interact with Open LOS API                     │
│    • /spread - analyze financial data                        │
│    • /search - query QMD index                               │
│    • /todos - track work items                               │
│                                                              │
│  Persisted State:                                            │
│    • Current deal context                                    │
│    • User preferences                                        │
│    • Learned patterns                                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Integration Architecture for Open LOS

```
┌─────────────────────────────────────────────────────────────┐
│                   Open LOS + Pi Runtime                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                    Pi Agent                          │    │
│  │  ┌─────────────────────────────────────────────┐    │    │
│  │  │  Core Tools: Read, Write, Edit, Bash         │    │    │
│  │  └─────────────────────────────────────────────┘    │    │
│  │                        │                             │    │
│  │  ┌─────────────────────┴─────────────────────┐      │    │
│  │  │          Open LOS Extensions              │      │    │
│  │  │  • /api - call Open LOS REST endpoints    │      │    │
│  │  │  • /search - query QMD index              │      │    │
│  │  │  • /analyze - financial analysis skills   │      │    │
│  │  │  • /monitor - covenant tracking           │      │    │
│  │  └───────────────────────────────────────────┘      │    │
│  │                        │                             │    │
│  │  ┌─────────────────────┴─────────────────────┐      │    │
│  │  │          Session State                    │      │    │
│  │  │  • Current deal context                   │      │    │
│  │  │  • Learned domain patterns                │      │    │
│  │  │  • User-specific preferences              │      │    │
│  │  └───────────────────────────────────────────┘      │    │
│  └─────────────────────────────────────────────────────┘    │
│                            │                                 │
│              ┌─────────────┴─────────────┐                  │
│              ▼                           ▼                  │
│     ┌─────────────────┐       ┌─────────────────┐          │
│     │  Open LOS API   │       │   QMD Search    │          │
│     │  (REST)         │       │   (MCP/CLI)     │          │
│     └─────────────────┘       └─────────────────┘          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Plan

**Phase 1: Pi Integration Package**
```typescript
// New package: packages/agent/
// Provides Pi extensions for Open LOS

// Extension: /api - Call Open LOS endpoints
export const apiExtension = {
  name: 'api',
  description: 'Interact with Open LOS REST API',
  commands: {
    deals: 'List and manage deals',
    spreads: 'Create and analyze financial spreads',
    covenants: 'Manage and test covenants',
    documents: 'Upload and retrieve documents',
  },
  // Bash wrapper that handles auth, headers, JSON parsing
  execute: (cmd, args) => {
    return `curl -s -H "X-Actor: ${actor}" ${API_URL}/${cmd} ${args} | jq`;
  }
};
```

**Phase 2: Domain Skills (Agent-Generated)**

Rather than pre-building skills, we provide a bootstrap prompt:

```markdown
You are an Open LOS assistant. You have access to:

1. The Open LOS API at http://localhost:3000/v1
   - OpenAPI spec at /openapi/v1.yaml
   - All requests need X-Actor header

2. QMD search via `qmd query "your search"`
   - Searches documents, communications, decisions
   - Returns ranked results with context

3. Your extension directory at .pi/extensions/
   - You can create new skills as needed
   - Skills persist across sessions

When asked to do something you can't do yet, extend yourself.
Read the OpenAPI spec to understand available endpoints.
Use QMD to find relevant context before making decisions.
```

**Phase 3: Session Management**

```typescript
// New service: packages/core/src/services/agent-session.ts
export interface AgentSession {
  id: string;
  deal_id?: string;
  user_id: string;
  branch: string;
  state: Record<string, unknown>;
  created_at: Date;
  last_active: Date;
}

// Sessions can be associated with deals
// State persists across interactions
// Branches allow parallel analysis
```

### Example: Self-Extending Agent

**User:** "Analyze the financial health of deal #abc123"

**Agent (first time):**
1. Reads OpenAPI spec to understand `/deals/{id}/spreads` endpoint
2. Creates extension skill `analyze-financials.ts`
3. Fetches spread data, computes additional ratios
4. Searches QMD for similar deals and their outcomes
5. Generates analysis with context

**Agent (subsequent times):**
1. Uses cached skill
2. Retrieves spread data
3. Compares to precedents found via QMD
4. Provides contextual recommendations

---

## Combined Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Agentic Open LOS Architecture                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      CONTEXT LAYER (QMD)                         │    │
│  │                                                                   │    │
│  │   Documents ──┐                                                   │    │
│  │   Emails ─────┼──▶ Export ──▶ QMD Index ──▶ Hybrid Search        │    │
│  │   Decisions ──┘              │                                    │    │
│  │                              │                                    │    │
│  │              ┌───────────────┴───────────────┐                   │    │
│  │              │  Query Expansion (1.7B)       │                   │    │
│  │              │  BM25 + Vectors + Reranking   │                   │    │
│  │              └───────────────────────────────┘                   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                    │                                     │
│                                    │ MCP / CLI                           │
│                                    ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      ACTION LAYER (Pi)                           │    │
│  │                                                                   │    │
│  │   ┌─────────────────────────────────────────────────────────┐   │    │
│  │   │                    Pi Agent Runtime                      │   │    │
│  │   │                                                          │   │    │
│  │   │   Core: Read, Write, Edit, Bash                          │   │    │
│  │   │                    │                                     │   │    │
│  │   │   Extensions:      │                                     │   │    │
│  │   │   • /api ──────────┼──▶ Open LOS REST API                │   │    │
│  │   │   • /search ───────┼──▶ QMD hybrid search                │   │    │
│  │   │   • /analyze ──────┼──▶ Financial analysis skills        │   │    │
│  │   │   • /monitor ──────┼──▶ Covenant tracking                │   │    │
│  │   │   • (self-generated skills)                              │   │    │
│  │   │                                                          │   │    │
│  │   │   Session State:                                         │   │    │
│  │   │   • Deal context, learned patterns, preferences          │   │    │
│  │   │   • Branch/tree navigation for parallel work             │   │    │
│  │   └─────────────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                    │                                     │
│                                    │ REST API                            │
│                                    ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      DATA LAYER (Open LOS)                       │    │
│  │                                                                   │    │
│  │   Deals │ Entities │ Documents │ Spreads │ Covenants │ Loans     │    │
│  │                                                                   │    │
│  │   + NEW: Decisions table (rationale, factors, precedents)        │    │
│  │   + NEW: Agent sessions table (state, branches)                  │    │
│  │                                                                   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)

| Task | Component | Effort |
|------|-----------|--------|
| Add `decisions` table with rationale capture | Core | S |
| Create document content export pipeline | Core | M |
| Set up QMD with Open LOS collections | Search | M |
| Create basic Pi extension for API access | Agent | M |

### Phase 2: Search Integration (Weeks 3-4)

| Task | Component | Effort |
|------|-----------|--------|
| Implement incremental QMD indexing on mutations | Core | M |
| Fine-tune query expansion for lending domain | Search | L |
| Add search tool to Pi extensions | Agent | S |
| Create precedent linking on decision creation | Core | M |

### Phase 3: Agent Capabilities (Weeks 5-6)

| Task | Component | Effort |
|------|-----------|--------|
| Build bootstrap prompt with domain context | Agent | M |
| Implement session persistence with deal context | Agent | M |
| Create example skills (financial analysis, covenant monitoring) | Agent | M |
| Add agent session management to API | API | S |

### Phase 4: Integration (Weeks 7-8)

| Task | Component | Effort |
|------|-----------|--------|
| Connect Pi to chat interface (Vercel AI SDK) | Frontend | L |
| Implement human-in-the-loop approval gates | Core | M |
| Add agent activity to audit trail | Core | S |
| Create monitoring dashboard for agent sessions | Frontend | M |

---

## Why This Approach Works

### 1. Minimal New Code

Both QMD and Pi are designed to be thin layers:
- QMD indexes existing content—we just export to markdown
- Pi uses Bash to call our existing API—no new endpoints needed
- Extensions are generated by the agent itself

### 2. Open Source, Local-First

Both projects run entirely on-device:
- No cloud dependencies
- No data leaves the system
- Full control over models and behavior

### 3. Composable Architecture

The three layers are independent:
- QMD can be used without Pi (for human search)
- Pi can be used without QMD (for simple tasks)
- Together they create the agentic experience

### 4. Domain Knowledge Emerges

Instead of encoding lending expertise in code:
- QMD finds relevant precedents and patterns
- Pi learns from examples and extends itself
- The system gets smarter through use

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| QMD query expansion not tuned for lending | Fine-tune on lending vocabulary using finetune pipeline |
| Pi agent makes incorrect API calls | Implement dry-run mode, require confirmation for mutations |
| Search returns irrelevant results | Add feedback loop to improve ranking |
| Agent extends itself incorrectly | Review generated extensions, maintain approved skill library |
| Performance at scale | QMD designed for large collections; Pi sessions are lightweight |

---

## Conclusion

The combination of QMD and Pi addresses our two fundamental gaps:

1. **QMD makes context accessible** through hybrid search that understands both exact terms and semantic meaning, with AI-native output formats.

2. **Pi provides intelligent agents** through a minimal runtime that embraces code generation, with extensions that persist and evolve.

Together, they transform Open LOS from a system of record into a system of intelligence—where AI agents are true teammates with access to the full context of every deal.

The key insight from both projects is the same: **embrace code as the interface**. QMD uses fine-tuned models to generate better queries. Pi uses LLMs to write its own extensions. Neither tries to anticipate every need—they provide foundations that adapt.

This is the path to an agentic loan origination platform.

---

## References

- [QMD Repository](https://github.com/tobi/qmd)
- [QMD Fine-tuning](https://github.com/tobi/qmd/tree/main/finetune)
- [Pi: The Minimal Agent Within OpenClaw](https://lucumr.pocoo.org/2026/1/31/pi/)
- [OpenClaw Repository](https://github.com/openclaw/openclaw)
- [Open LOS Gap Analysis](./ARCHITECTURE_GAP_ANALYSIS.md)
