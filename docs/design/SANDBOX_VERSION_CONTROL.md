# Sandbox Version Control Design

> Design document for version-controlled sandboxes: isolated workspaces for experimental and exploratory analysis.

## 1. Problem Statement

When performing underwriting analysis or exploratory financial modeling, users and AI agents face a critical friction point:

**Fear of breaking things.** Every change to a spreadsheet, every adjustment to a ratio, every what-if scenario carries the risk of losing a known-good state. This leads to:

1. **Hesitation to experiment** - Users don't explore edge cases because recovery is hard
2. **Manual version management** - "analysis_v2_final_REAL_final.xlsx" proliferates
3. **Lost insights** - Valuable intermediate states aren't captured
4. **No audit trail** - Can't explain how a conclusion was reached
5. **Collaboration friction** - Sharing exploratory work is awkward

For AI agents, this is even more acute. An agent exploring multiple scenarios needs isolation and the ability to checkpoint progress without polluting the main dataset.

## 2. Solution: Git-Powered Sandboxes

A **Sandbox** is an isolated, version-controlled workspace where:

- Agents and users can experiment freely
- Every state is recoverable via checkpoints
- Changes can be branched, forked, compared, or discarded
- The exploration journey is tracked, not just the final outcome

### Core Primitives

```
┌─────────────────────────────────────────────────────────────────┐
│                         MAIN WORKSPACE                          │
│   (Production deals, spreads, covenants - source of truth)     │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ clone/fork
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                          SANDBOX                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Checkpoint 1: "Initial state"                             │   │
│  │ git: sha_000001                                           │   │
│  │ entities: [spread_001, deal_xyz]                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                               │                                  │
│                               │ modify, experiment               │
│                               ▼                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Checkpoint 2: "After sensitivity analysis"               │   │
│  │ git: sha_000002                                           │   │
│  │ entities: [spread_001 (modified), cov_001 (new)]         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                               │                                  │
│                    ┌──────────┴──────────┐                      │
│                    ▼                     ▼                      │
│  ┌────────────────────────┐  ┌────────────────────────┐        │
│  │ Checkpoint 3a:         │  │ Checkpoint 3b:         │        │
│  │ "Conservative scenario"│  │ "Aggressive scenario"  │        │
│  └────────────────────────┘  └────────────────────────┘        │
│                                                                  │
│  Status: active | archived | merged | discarded                  │
└─────────────────────────────────────────────────────────────────┘
```

## 3. Data Model

### Sandbox

```typescript
interface Sandbox {
  id: string;                    // "sbx_abc123"
  tenant_id: string;

  // Identity
  name: string;                  // "What-if: Higher leverage scenario"
  description?: string;

  // Context
  parent_type: "deal" | "portfolio" | "analysis";
  parent_id?: string;            // Link to parent entity

  // Git integration
  git_branch: string;            // "sandbox/sbx_abc123"
  base_commit?: string;          // Starting point

  // Forking
  forked_from_sandbox_id?: string;
  forked_from_checkpoint_id?: string;

  // Lifecycle
  status: "active" | "archived" | "merged" | "discarded";
  created_by: string;
  created_at: string;
  archived_at?: string;
}
```

### Checkpoint

```typescript
interface Checkpoint {
  id: string;                    // "chk_xyz789"
  sandbox_id: string;

  // Identity
  name: string;                  // "Before sensitivity analysis"
  description?: string;

  // Git reference
  git_commit: string;            // Commit SHA
  git_tag?: string;              // Optional named tag

  // State snapshot (for quick restore)
  snapshot: {
    entities: Array<{
      entity_type: string;
      entity_id: string;
      state: Record<string, unknown>;
    }>;
    metrics?: Record<string, unknown>;
  };

  // Change tracking
  changes_summary?: string;
  changed_entities?: string[];   // ["spread:sp_001", "covenant:cov_002"]

  // Metadata
  sequence: number;              // Order within sandbox
  restorable: boolean;
  created_by: string;
  created_at: string;
}
```

### Sandbox Entity

Entities in a sandbox are isolated copies that can be modified without affecting the main workspace:

```typescript
interface SandboxEntity {
  id: string;
  sandbox_id: string;

  // What entity this is
  entity_type: "deal" | "spread" | "artifact" | "covenant" | ...;
  entity_id: string;

  // Origin tracking
  origin: "created" | "imported" | "cloned";
  original_entity_id?: string;   // If cloned, link to source

  // Current state (JSON serialization)
  state: Record<string, unknown>;

  // Lifecycle
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}
```

## 4. API Design

### Sandbox Operations

```
POST   /v1/sandboxes                              Create sandbox
GET    /v1/sandboxes                              List sandboxes
GET    /v1/sandboxes/:id                          Get sandbox
PATCH  /v1/sandboxes/:id/status                   Update status
```

### Checkpoint Operations

```
POST   /v1/sandboxes/:id/checkpoints              Create checkpoint
GET    /v1/sandboxes/:id/checkpoints              List checkpoints
GET    /v1/sandboxes/:id/checkpoints/:checkpointId Get checkpoint
POST   /v1/sandboxes/:id/checkpoints/:checkpointId/restore  Restore
POST   /v1/sandboxes/:id/checkpoints/compare      Compare two checkpoints
```

### Entity Operations

```
POST   /v1/sandboxes/:id/entities/clone           Clone entity from main
POST   /v1/sandboxes/:id/entities                 Create new entity
GET    /v1/sandboxes/:id/entities                 List entities
PATCH  /v1/sandboxes/:id/entities/:type/:entityId Update entity
DELETE /v1/sandboxes/:id/entities/:type/:entityId Delete entity
```

### History Operations

```
GET    /v1/sandboxes/:id/history                  Git commit history
POST   /v1/sandboxes/:id/diff                     Diff between checkpoints
```

## 5. User Workflows

### Workflow 1: Exploratory Analysis

```
1. Analyst creates sandbox linked to deal
   POST /v1/sandboxes { name: "What-if analysis", parent_type: "deal", parent_id: "deal_123" }

2. Clone spread from main workspace into sandbox
   POST /v1/sandboxes/sbx_abc/entities/clone { entity_type: "spread", entity_id: "sp_001" }

3. Modify spread with different assumptions
   PATCH /v1/sandboxes/sbx_abc/entities/spread/sp_001_sbx { state: { revenue: 1200000 } }

4. Checkpoint progress
   POST /v1/sandboxes/sbx_abc/checkpoints { name: "20% revenue increase" }

5. Try another scenario
   PATCH /v1/sandboxes/sbx_abc/entities/spread/sp_001_sbx { state: { revenue: 800000 } }

6. Checkpoint that too
   POST /v1/sandboxes/sbx_abc/checkpoints { name: "20% revenue decrease" }

7. Compare scenarios
   POST /v1/sandboxes/sbx_abc/checkpoints/compare { from: "chk_001", to: "chk_002" }

8. Restore preferred scenario
   POST /v1/sandboxes/sbx_abc/checkpoints/chk_001/restore

9. Archive when done
   PATCH /v1/sandboxes/sbx_abc/status { status: "archived" }
```

### Workflow 2: AI Agent Exploration

```
1. Agent receives task: "Analyze sensitivity to interest rate changes"

2. Agent creates sandbox
   POST /v1/sandboxes { name: "Interest rate sensitivity", parent_type: "deal", parent_id: "deal_123" }

3. Agent clones relevant entities (spread, covenants)
   POST /v1/sandboxes/sbx_xyz/entities/clone { entity_type: "spread", entity_id: "sp_001" }
   POST /v1/sandboxes/sbx_xyz/entities/clone { entity_type: "covenant", entity_id: "cov_001" }

4. Agent runs analysis loop:
   for rate in [4%, 5%, 6%, 7%, 8%]:
     - Modify spread with new interest expense
     - Test covenants against new ratios
     - Checkpoint: "Rate at {rate}%"

5. Agent compares checkpoints to find break-even rate

6. Agent reports findings with checkpoint references

7. User can restore any checkpoint to see exact state
```

### Workflow 3: Fork and Branch

```
1. First analyst creates sandbox and does initial work
   POST /v1/sandboxes { name: "Base case analysis" }
   ... work ...
   POST /v1/sandboxes/sbx_001/checkpoints { name: "Base case complete" }

2. Second analyst forks from that checkpoint
   POST /v1/sandboxes {
     name: "Optimistic scenario",
     fork_from_checkpoint_id: "chk_001"
   }

3. Both analysts work independently

4. Compare results between sandboxes
   - Get final checkpoint from each
   - Compare side-by-side
```

## 6. Git Integration

Sandboxes are powered by Git for robust version control:

### Branch Strategy

```
main                              # Production state (never directly modified by sandboxes)
sandbox/sbx_abc123                # Sandbox branch
sandbox/sbx_def456                # Another sandbox branch
```

### Commit Structure

Each checkpoint creates a commit:

```
commit sha_000003
Author: u_analyst
Date: 2026-01-15T10:30:00Z

Checkpoint: After sensitivity analysis

{
  "checkpoint_id": "chk_003",
  "snapshot": { ... },
  "changed_entities": ["spread:sp_001", "covenant:cov_001"]
}
```

### Provider Abstraction

The system supports multiple Git backends:

```typescript
interface GitProvider {
  createBranch(name: string, fromRef?: string): Promise<string>;
  deleteBranch(name: string): Promise<void>;
  commit(message: string, data?: object): Promise<string>;
  getCommit(sha: string): Promise<Commit>;
  diff(fromSha: string, toSha: string): Promise<string>;
  log(branch: string, limit?: number): Promise<Commit[]>;
}

// Implementations:
// - InMemoryGitProvider (for testing/POC)
// - LocalGitProvider (shell out to git CLI)
// - LibGit2Provider (native bindings)
// - RemoteGitProvider (GitHub/GitLab API)
```

## 7. Why This Works

### For Users

1. **Experiment freely** - No fear of losing work
2. **Natural checkpoints** - "Save game" at any point
3. **Compare scenarios** - See exact differences between approaches
4. **Share exploration** - Others can fork from your checkpoints
5. **Audit trail** - Explain how conclusions were reached

### For AI Agents

1. **Isolation** - Agent experiments don't affect production data
2. **Recovery** - If agent makes mistake, restore previous checkpoint
3. **Exploration** - Agent can try multiple approaches in one sandbox
4. **Reproducibility** - Can re-run agent work from any checkpoint
5. **Visibility** - Human can see agent's exploration journey

### For the System

1. **Clean abstraction** - Sandboxes are self-contained
2. **Scalable** - Each sandbox is independent
3. **Auditable** - Git provides complete history
4. **Extensible** - Easy to add new entity types
5. **Portable** - Git-based, can sync across systems

## 8. Implementation Status

### Phase 1: POC (This Implementation)

- [x] Database schema for sandboxes, checkpoints, entities
- [x] In-memory Git provider
- [x] Sandbox CRUD operations
- [x] Checkpoint creation and restore
- [x] Entity clone/create/update/delete
- [x] Checkpoint comparison
- [x] API endpoints
- [x] Conformance tests

### Phase 2: Production

- [ ] Real Git provider (local filesystem)
- [ ] Merge sandbox changes to main workspace
- [ ] Conflict detection and resolution
- [ ] Sandbox templates (pre-configured for common scenarios)
- [ ] Batch operations (clone multiple entities at once)

### Phase 3: Scale

- [ ] Remote Git provider (GitHub/GitLab)
- [ ] Sandbox sharing across tenants
- [ ] Sandbox metrics and analytics
- [ ] Auto-cleanup of stale sandboxes
- [ ] Integration with AI workflow system

## 9. Example: Underwriting Sandbox

A typical underwriting sandbox might contain:

```yaml
Sandbox: "DEAL-00042 Underwriting Analysis"
Parent: deal_00042
Status: active

Entities:
  - type: deal
    id: deal_00042_sbx
    origin: cloned
    state: { borrower_name: "Acme Corp", requested_amount: 5000000 }

  - type: spread
    id: spread_fy2025_sbx
    origin: cloned
    state:
      period: "FY2025"
      line_items: [...]
      ratios: { dscr: 1.35, leverage: 2.1 }

  - type: covenant
    id: dscr_covenant_sbx
    origin: created
    state:
      name: "Minimum DSCR"
      metric: "dscr"
      operator: ">="
      threshold: 1.25

  - type: artifact
    id: credit_memo_draft_sbx
    origin: created
    state:
      template_id: "credit_memo"
      markdown: "## Credit Memo\n..."

Checkpoints:
  1. "Initial clone" - Starting point
  2. "After spreading FY2025" - Added spread data
  3. "Stress test: -20% revenue" - Tested downside
  4. "Stress test: +10% COGS" - Tested cost pressure
  5. "Final recommendation" - Cleaned up for review
```

## 10. Conclusion

Version-controlled sandboxes solve a fundamental problem in exploratory analysis: enabling fearless experimentation while maintaining complete traceability. By leveraging Git's proven model for version control and adapting it to domain-specific entities (deals, spreads, covenants), we create a powerful primitive for both human analysts and AI agents.

The key insight is that **the exploration journey matters as much as the final answer**. Sandboxes capture that journey in a structured, recoverable way.
