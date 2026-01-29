# PRD: AI Conversation Persistence

## Context

Research into [craft-agents-oss](https://github.com/lukilabs/craft-agents-oss) (1.8k stars) revealed patterns for "AI-native" applications. Their core insight: **AI conversations are first-class entities, not ephemeral chat sessions.**

For a regulated lending CRM with audit requirements, this means every AI interaction on a deal should be logged, queryable, and attributable.

## Requirements

### 1. Conversation Persistence per Deal

Every AI interaction associated with a deal must be stored with:
- Full message history (user prompts + AI responses)
- Association to deal and stage
- Actor attribution (who initiated)
- Timestamp for each message

**Why:** Enables "what did the AI recommend about this covenant 3 weeks ago?" queries. Essential for audit trails and institutional memory.

### 2. Token/Cost Tracking per Deal

Each conversation must track:
- Input tokens consumed
- Output tokens generated
- Total cost in USD
- Model used (for cost attribution accuracy)

**Why:** Enables per-deal AI cost attribution, usage monitoring, and potential client billing. Also identifies expensive analysis patterns.

### 3. Audit Trail for AI Interactions

AI conversations must integrate with existing `auditEvents` table:
- Conversation creation logged as audit event
- Links between AI recommendations and subsequent deal actions
- Immutable record of what AI suggested vs what human decided

**Why:** Regulatory defensibility. If a deal goes bad, you can show what AI recommended and what humans chose to do.

### 4. Permission Scoping (Deal-Level)

Conversations should support permission modes:
- `explore` - AI can read deal data, cannot modify
- `ask` - AI proposes changes, human approves
- `auto` - AI can execute approved action types

**Why:** Different stages need different autonomy levels. Broker intake = high autonomy. Credit decision = human-in-loop.

---

## Schema Design

### New Table: `ai_conversations`

```typescript
export const aiConversations = sqliteTable("ai_conversations", {
  id: text("id").primaryKey(),
  deal_id: text("deal_id")
    .notNull()
    .references(() => deals.id),
  stage: text("stage").notNull(),              // deal stage when conversation started
  permission_mode: text("permission_mode")      // "explore" | "ask" | "auto"
    .notNull()
    .default("ask"),
  model: text("model").notNull(),              // "claude-3-opus", "gpt-4", etc.

  // Token tracking
  input_tokens: integer("input_tokens").default(0),
  output_tokens: integer("output_tokens").default(0),
  cost_usd: real("cost_usd").default(0),

  // Summary for list views (AI-generated)
  summary: text("summary"),

  // Lifecycle
  status: text("status").notNull().default("active"), // "active" | "archived"
  created_by: text("created_by").notNull(),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
});
```

### New Table: `ai_messages`

```typescript
export const aiMessages = sqliteTable("ai_messages", {
  id: text("id").primaryKey(),
  conversation_id: text("conversation_id")
    .notNull()
    .references(() => aiConversations.id),

  role: text("role").notNull(),                // "user" | "assistant" | "system"
  content: text("content").notNull(),

  // Tool use tracking (for audit)
  tool_calls: text("tool_calls", { mode: "json" }),  // [{name, input, output}]

  // Per-message token tracking (for cost drill-down)
  input_tokens: integer("input_tokens"),
  output_tokens: integer("output_tokens"),

  // Attachments (references to documents table)
  attachments: text("attachments", { mode: "json" }), // document IDs

  created_at: text("created_at").notNull(),
});
```

### Indexes

```typescript
// Fast lookup by deal
index("ai_conversations_deal_idx").on(aiConversations.deal_id);

// Fast lookup by deal + stage
index("ai_conversations_deal_stage_idx").on(aiConversations.deal_id, aiConversations.stage);

// Message ordering
index("ai_messages_conversation_idx").on(aiMessages.conversation_id, aiMessages.created_at);
```

---

## Integration Points

### With Existing Tables

| Existing Table | Integration |
|----------------|-------------|
| `deals` | FK from `ai_conversations.deal_id` |
| `auditEvents` | Log conversation creation with `type: "ai_conversation_created"` |
| `documents` | `ai_messages.attachments` references document IDs |
| `stageTransitions` | Can link AI recommendation to transition via audit metadata |

### With Future Features

| Feature | How Conversations Support It |
|---------|------------------------------|
| AI copilot sidebar | Conversations persist sidebar state |
| Financial analysis | Analysis results stored as messages with tool_calls |
| Document generation | Generated docs linked via attachments |
| Credit committee review | Share conversation link for context |

---

## UX Considerations (Deferred)

These are **not** in scope for the schema work but inform the design:

1. **Inbox view** - List conversations by deal, filter by stage/status
2. **Timeline integration** - Show conversations in deal activity feed
3. **Search** - Full-text search across conversation content
4. **Export** - Export conversation as markdown for memos

---

## Open Questions

1. **Message content storage** - Store as plain text or structured blocks (for code, tables)?
2. **Streaming** - Do we need to support partial message storage during streaming?
3. **Context window** - Should we store the full context sent to the model, or just user-visible content?
4. **Retention** - Any retention policy for old conversations?

---

## References

- [craft-agents-oss](https://github.com/lukilabs/craft-agents-oss) - Session/status patterns
- [Anthropic Claude Agent SDK](https://github.com/anthropics/claude-code) - Permission model inspiration
