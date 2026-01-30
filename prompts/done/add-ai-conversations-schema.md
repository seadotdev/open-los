# Task: Add AI Conversation Tables to Schema

## Context

We need to persist AI conversations per deal for audit, cost tracking, and institutional memory. See `docs/PRD_AI_CONVERSATIONS.md` for full requirements.

## Justification

Based on research into craft-agents-oss (an AI-native ticketing system), we identified four architectural requirements that must be designed into the schema now:

1. **Conversation persistence** - Cannot retrofit message history onto existing audit_events without losing structure
2. **Token/cost tracking** - Enables per-deal AI cost attribution and usage monitoring
3. **Tool call audit** - Regulatory requirement to show what AI recommended vs what humans decided
4. **Permission scoping** - Different deal stages need different AI autonomy levels

## Instructions

Add two tables to `packages/core/src/schema/tables.ts`:

### 1. `ai_conversations` table

After the `communications` table, add:

```typescript
// ─── AI Conversation Tables ─────────────────────────────────────────────────────

export const aiConversations = sqliteTable("ai_conversations", {
  id: text("id").primaryKey(),
  deal_id: text("deal_id")
    .notNull()
    .references(() => deals.id),
  stage: text("stage").notNull(), // deal stage when conversation started
  permission_mode: text("permission_mode").notNull().default("ask"), // "explore" | "ask" | "auto"
  model: text("model").notNull(), // "claude-3-opus", "gpt-4", etc.

  // Token tracking
  input_tokens: integer("input_tokens").default(0),
  output_tokens: integer("output_tokens").default(0),
  cost_usd: real("cost_usd").default(0),

  // Summary for list views
  summary: text("summary"),

  // Lifecycle
  status: text("status").notNull().default("active"), // "active" | "archived"
  created_by: text("created_by").notNull(),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
});
```

### 2. `ai_messages` table

Immediately after `ai_conversations`:

```typescript
export const aiMessages = sqliteTable("ai_messages", {
  id: text("id").primaryKey(),
  conversation_id: text("conversation_id")
    .notNull()
    .references(() => aiConversations.id),

  role: text("role").notNull(), // "user" | "assistant" | "system"
  content: text("content").notNull(),

  // Tool use tracking
  tool_calls: text("tool_calls", { mode: "json" }), // [{name, input, output}]

  // Per-message token tracking
  input_tokens: integer("input_tokens"),
  output_tokens: integer("output_tokens"),

  // Attachments (document IDs)
  attachments: text("attachments", { mode: "json" }),

  created_at: text("created_at").notNull(),
});
```

## Validation

After adding the tables:

1. Run `bun run db:generate` to generate migration
2. Run `bun run db:migrate` to apply
3. Ensure existing tests still pass

## Not In Scope

- Service layer for conversations (separate task)
- API endpoints (separate task)
- UI components (separate task)
