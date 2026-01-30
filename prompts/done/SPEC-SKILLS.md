# Skills System Spec

> Markdown-based skills for AI agent workflows in Open LOS

## Overview

This spec defines a skills system that:
1. Enables domain experts to encode lending methodologies without code
2. Follows Anthropic's Agent Skills specification (SKILL.md with YAML frontmatter)
3. Provides lazy loading to avoid context bloat
4. Integrates with the existing AI-native architecture (actor headers, audit trail)

### What This Is NOT

- **Not replacing AGENTS.md** — that's codebase instructions for AI, skills are domain workflows
- **Not code execution** — skills are prompts/checklists, not runnable scripts
- **Not user-specific yet** — start with system skills, add per-user skills later

---

## Skill Structure

### Directory Layout

```
/skills/
  /public/                    # System skills (everyone gets these)
    /underwriting-checklist/
      SKILL.md
      guidelines.md
      red-flags.md
    /covenant-analysis/
      SKILL.md
      ratio-definitions.md
    /dcf-valuation/
      SKILL.md
      industry-multiples.md
      discount-rates.md
    /deal-scoring/
      SKILL.md
      scoring-matrix.md
```

### SKILL.md Format (Anthropic Spec)

```markdown
---
name: underwriting-checklist
description: Standard due diligence checklist for commercial loan underwriting
trigger: When reviewing a deal for credit approval
---

# Underwriting Checklist

## Purpose

This skill guides thorough due diligence for commercial loan underwriting.

## Steps

1. **Borrower Assessment**
   - Verify legal entity status
   - Check management experience
   - Review ownership structure
   - [See: guidelines.md#borrower-assessment]

2. **Financial Analysis**
   - Spread last 3 years financials
   - Calculate key ratios (see ratio-definitions.md)
   - Identify trends and anomalies

3. **Collateral Review**
   - Asset valuations
   - Lien searches
   - Insurance verification

4. **Industry & Market**
   - Industry outlook
   - Competitive position
   - Customer concentration

## Red Flags

See red-flags.md for warning signs that require escalation.

## Output

Generate a structured underwriting memo covering each section.
```

---

## Schema Additions

### 1. Skills Registry (for metadata/discovery)

```typescript
export const skills = sqliteTable("skills", {
  id: text("id").primaryKey(),
  tenant_id: text("tenant_id").notNull().default("default"),

  // Identity
  name: text("name").notNull(),                    // "underwriting-checklist"
  description: text("description").notNull(),      // From YAML frontmatter
  trigger: text("trigger"),                        // When to suggest this skill

  // Location
  path: text("path").notNull(),                    // "/public/underwriting-checklist"
  scope: text("scope").notNull().default("public"), // "public" | "org" | "user"

  // Ownership (for non-public skills)
  owner_id: text("owner_id"),                      // entity.id or user identifier

  // Metadata
  version: text("version").default("1.0.0"),
  tags: text("tags", { mode: "json" }),            // ["underwriting", "credit"]

  // Usage tracking
  usage_count: integer("usage_count").default(0),
  last_used_at: text("last_used_at"),

  // State
  is_active: integer("is_active", { mode: "boolean" }).default(true),

  created_at: text("created_at").notNull(),
  updated_at: text("updated_at"),
});

// Unique constraint: (tenant_id, scope, name)
// Index: idx_skills_tenant_scope
// Index: idx_skills_tags (for tag-based discovery)
```

### 2. Skill Invocations (audit trail)

```typescript
export const skillInvocations = sqliteTable("skill_invocations", {
  id: text("id").primaryKey(),
  tenant_id: text("tenant_id").notNull().default("default"),

  // What was invoked
  skill_id: text("skill_id").notNull().references(() => skills.id),
  skill_version: text("skill_version"),

  // Context
  deal_id: text("deal_id").references(() => deals.id),
  entity_id: text("entity_id").references(() => entities.id),

  // Actor (from headers)
  actor: text("actor").notNull(),
  actor_type: text("actor_type"),                  // "human" | "ai"
  ai_provider: text("ai_provider"),                // "anthropic" | "openai"

  // Outcome
  status: text("status").notNull(),                // "started" | "completed" | "failed"
  completed_at: text("completed_at"),

  // Optional: summary of what was produced
  output_summary: text("output_summary"),

  created_at: text("created_at").notNull(),
});

// Index: idx_invocations_skill
// Index: idx_invocations_deal
// Index: idx_invocations_actor
```

---

## Service Layer

### SkillService

```typescript
interface SkillService {
  // Discovery (returns metadata only, not full content)
  list(options?: { scope?: string; tags?: string[] }): Promise<SkillMetadata[]>;
  getMetadata(nameOrId: string): Promise<SkillMetadata>;
  search(query: string): Promise<SkillMetadata[]>;

  // Loading (returns full content when needed)
  load(nameOrId: string): Promise<SkillContent>;
  loadWithReferences(nameOrId: string): Promise<SkillContentWithRefs>;

  // Registry management
  register(input: RegisterSkillInput): Promise<Skill>;
  update(id: string, input: UpdateSkillInput): Promise<Skill>;
  deactivate(id: string): Promise<void>;

  // Invocation tracking
  startInvocation(skillId: string, context: InvocationContext, actor: string): Promise<SkillInvocation>;
  completeInvocation(invocationId: string, summary?: string): Promise<SkillInvocation>;
  failInvocation(invocationId: string, error: string): Promise<SkillInvocation>;

  // Sync filesystem → database
  syncFromFilesystem(basePath: string): Promise<SyncResult>;
}

interface SkillMetadata {
  id: string;
  name: string;
  description: string;
  trigger?: string;
  scope: "public" | "org" | "user";
  tags: string[];
  version: string;
  usageCount: number;
}

interface SkillContent {
  metadata: SkillMetadata;
  content: string;           // Full SKILL.md content
}

interface SkillContentWithRefs {
  metadata: SkillMetadata;
  content: string;
  references: Array<{       // Referenced files loaded
    name: string;
    content: string;
  }>;
}

interface RegisterSkillInput {
  name: string;
  description: string;
  trigger?: string;
  path: string;
  scope?: "public" | "org" | "user";
  ownerId?: string;
  tags?: string[];
}

interface InvocationContext {
  dealId?: string;
  entityId?: string;
  actorType?: "human" | "ai";
  aiProvider?: string;
}

interface SyncResult {
  added: string[];
  updated: string[];
  removed: string[];
  errors: Array<{ path: string; error: string }>;
}
```

---

## API Design

### Endpoints

```yaml
# List available skills (metadata only)
GET /v1/skills
Query:
  scope: "public" | "org" | "user"
  tags: "underwriting,credit"
Response:
  skills:
    - id: "sk_abc123"
      name: "underwriting-checklist"
      description: "Standard due diligence checklist..."
      trigger: "When reviewing a deal for credit approval"
      scope: "public"
      tags: ["underwriting", "credit"]
      usageCount: 42

# Get skill metadata
GET /v1/skills/{nameOrId}
Response:
  id: "sk_abc123"
  name: "underwriting-checklist"
  description: "..."
  # ... metadata only

# Load full skill content
GET /v1/skills/{nameOrId}/content
Query:
  includeReferences: true    # Also load referenced files
Response:
  metadata: { ... }
  content: "# Underwriting Checklist\n\n..."
  references:
    - name: "guidelines.md"
      content: "..."
    - name: "red-flags.md"
      content: "..."

# Search skills
POST /v1/skills:search
Request:
  query: "covenant"
  scope: "public"
Response:
  skills: [...]

# Register a new skill (admin)
POST /v1/skills
Request:
  name: "custom-checklist"
  description: "Our custom underwriting process"
  path: "/org/custom-checklist"
  scope: "org"
  tags: ["underwriting"]
Response:
  id: "sk_xyz789"
  ...

# Start skill invocation (for tracking)
POST /v1/skills/{nameOrId}/invocations
Request:
  dealId: "deal_123"
  actorType: "ai"
  aiProvider: "anthropic"
Response:
  invocationId: "inv_abc"
  skillId: "sk_abc123"
  status: "started"

# Complete invocation
PATCH /v1/skills/invocations/{invocationId}
Request:
  status: "completed"
  outputSummary: "Generated underwriting memo with 3 red flags identified"

# Get invocation history for a deal
GET /v1/deals/{dealId}/skill-invocations
Response:
  invocations:
    - id: "inv_abc"
      skill: { name: "underwriting-checklist", ... }
      actor: "claude@anthropic.com"
      status: "completed"
      createdAt: "2024-01-15T10:30:00Z"
```

---

## Filesystem Sync

Skills live in the filesystem for easy editing. The database is a registry for discovery and tracking.

### Sync Process

```typescript
// On server startup or explicit trigger
async function syncSkillsFromFilesystem(basePath: string = "./skills") {
  const publicPath = path.join(basePath, "public");
  const skillDirs = await fs.readdir(publicPath);

  for (const dir of skillDirs) {
    const skillMdPath = path.join(publicPath, dir, "SKILL.md");

    if (await fileExists(skillMdPath)) {
      const content = await fs.readFile(skillMdPath, "utf-8");
      const { frontmatter, body } = parseSkillMd(content);

      await skillService.register({
        name: frontmatter.name || dir,
        description: frontmatter.description,
        trigger: frontmatter.trigger,
        path: `/public/${dir}`,
        scope: "public",
        tags: frontmatter.tags || [],
      });
    }
  }
}

function parseSkillMd(content: string): { frontmatter: SkillFrontmatter; body: string } {
  // Parse YAML frontmatter between --- markers
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: content };
  }
  return {
    frontmatter: yaml.parse(match[1]),
    body: match[2],
  };
}
```

---

## Context Hints Integration

Add skill suggestions to the `_context` response hints:

```typescript
// In API response builder
function buildContextHints(deal: Deal): ContextHints {
  return {
    availableActions: [...],
    warnings: [...],
    // NEW: Suggest relevant skills
    suggestedSkills: await skillService.list({
      tags: inferTagsFromDeal(deal),
    }).then(skills => skills.slice(0, 3).map(s => ({
      name: s.name,
      description: s.description,
      trigger: s.trigger,
    }))),
  };
}
```

---

## Initial Skills to Create

### 1. underwriting-checklist

Standard due diligence for commercial loans:
- Borrower assessment
- Financial analysis (integrates with SpreadService)
- Collateral review
- Industry analysis
- Red flags and escalation triggers

### 2. covenant-analysis

How to evaluate and test financial covenants:
- Ratio definitions (DSCR, leverage, current ratio)
- Testing methodology
- Grace period handling
- Waiver documentation

### 3. deal-scoring

Quantitative deal assessment:
- Scoring matrix (borrower strength, collateral, industry)
- Risk rating methodology
- Pricing implications

### 4. monitoring-review

Periodic loan review process:
- Financial update checklist
- Covenant compliance review
- Early warning indicators
- Action item tracking

---

## Implementation Order

1. **Phase 1: Filesystem + Parser**
   - Create `/skills/public/` directory structure
   - Implement SKILL.md parser (YAML frontmatter + markdown body)
   - Create initial skill files (underwriting-checklist, covenant-analysis)

2. **Phase 2: Schema + Service**
   - Add `skills` and `skill_invocations` tables
   - Implement SkillService with list, load, register
   - Add filesystem sync on startup

3. **Phase 3: API Endpoints**
   - Add `/v1/skills` routes
   - Add invocation tracking endpoints
   - Integrate with existing actor headers

4. **Phase 4: Context Integration**
   - Add skill suggestions to `_context` hints
   - Add skill invocation links to deals

5. **Phase 5: Content**
   - Create full content for all initial skills
   - Add reference documents (guidelines, matrices, definitions)

---

## Out of Scope (Future)

| Feature | Reason to Defer |
|---------|-----------------|
| User-specific skills | Need user management first |
| Skill versioning/history | Overkill for MVP |
| Skill approval workflow | Start with admin-only creation |
| Skill dependencies | Keep skills independent initially |
| Skill execution/automation | Skills are prompts, not code |
