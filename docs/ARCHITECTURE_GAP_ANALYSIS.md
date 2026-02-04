# Architecture Gap Analysis: Towards an Agentic Loan Origination Platform

This document identifies gaps between Open LOS's current architecture and the vision of an **Agentic Customer Platform** adapted for loan origination—a system where AI agents and humans collaborate as true teammates with shared context.

## Executive Summary

Open LOS has strong foundations in several areas:
- **Robust data model** with comprehensive deal lifecycle, financial spreading, and covenant management
- **Immutable audit trail** capturing all mutations with actor context
- **API-first design** enabling both human and AI actors
- **Deterministic financial computations** ensuring reproducibility

However, significant gaps exist across all three layers of an agentic platform:

| Layer | Current State | Gap Severity |
|-------|--------------|--------------|
| **Context Layer** | Basic structured data; limited unstructured capture | 🔴 High |
| **Action Layer** | No agents, no UI, framework only | 🔴 High |
| **Coordination Layer** | Audit exists; no orchestration | 🟡 Medium |

---

## Layer 1: Context Layer Gaps

*"Context is having the right information at the right time, combined with the judgment to know what to do with it."*

### 1.1 Complete Customer Data

#### ✅ What We Have
- Structured deal records with full lifecycle tracking
- Entity graph (companies, people, relationships)
- Document storage with versioning
- Email ingestion with threading
- Bank transaction history
- Financial spreads with computed ratios

#### 🔴 Critical Gaps

| Gap | Description | Impact |
|-----|-------------|--------|
| **No full-text search** | Cannot search across communications, documents, or notes | AI cannot find relevant historical context |
| **No semantic/vector search** | No embeddings, no similarity matching | Cannot answer "deals similar to this one" |
| **No call transcript capture** | Only email; no phone call or meeting notes structure | Missing 50%+ of borrower communication context |
| **No unified timeline** | Events scattered across tables; no single chronological view | Hard to understand "what happened with this deal" |
| **No document content indexing** | Documents stored as blobs; content not searchable | Critical information locked in PDFs |
| **Limited communication context** | Communications lack sentiment, key topics, action items | AI cannot understand conversation substance |

#### 📋 Recommendations
1. Implement vector embeddings for documents and communications
2. Add full-text search (e.g., SQLite FTS5, or dedicated search service)
3. Create unified activity timeline combining all deal events
4. Add structured call/meeting records with transcript support
5. Implement document OCR and content extraction pipeline

---

### 1.2 Business Context

#### ✅ What We Have
- Stage transition history with override rationale
- Covenant definitions capturing business rules
- Audit trail with actor and timestamp

#### 🔴 Critical Gaps

| Gap | Description | Impact |
|-----|-------------|--------|
| **No decision rationale capture** | Why was this deal approved? Why this interest rate? | Institutional knowledge lost; AI cannot learn from past decisions |
| **No precedent tracking** | No way to find "we did something similar before" | Each decision made in isolation |
| **No exception documentation** | When rules were bent and why is not captured | No pattern of justified exceptions |
| **No credit policy storage** | Underwriting guidelines exist in people's heads | AI cannot apply business rules consistently |
| **No risk appetite definition** | What risks the organization accepts/avoids | AI cannot make risk-aligned recommendations |
| **No product configuration** | Loan products, terms, pricing rules not structured | AI cannot recommend appropriate products |

#### 📋 Recommendations
1. Add `decisions` table capturing rationale for key decisions (approval, pricing, exceptions)
2. Create `policies` table with versioned credit policies and guidelines
3. Implement `precedents` linking current decisions to historical examples
4. Add `products` table defining loan products with eligibility rules
5. Create `risk_appetite` configuration capturing risk tolerances

---

### 1.3 Team Context

#### ✅ What We Have
- Actor tracking on all mutations (X-Actor header)
- Role-based stage transition permissions (defined in code)
- Approval workflow with decision tracking

#### 🔴 Critical Gaps

| Gap | Description | Impact |
|-----|-------------|--------|
| **No user/team model** | No users table; actors are just strings | Cannot model expertise, workload, or preferences |
| **No expertise mapping** | Who knows about construction lending? | AI cannot route to right person or learn from experts |
| **No workload tracking** | Who has capacity for new deals? | Cannot optimize assignment |
| **No collaboration patterns** | How does underwriting work with origination? | AI doesn't understand hand-off protocols |
| **No communication preferences** | How does each person prefer to be notified? | AI cannot personalize interactions |
| **No performance context** | What's this person's close rate? Average cycle time? | AI cannot weight recommendations by track record |

#### 📋 Recommendations
1. Add `users` and `teams` tables with roles, expertise tags, and capacity
2. Create `assignments` table tracking deal ownership and delegation
3. Implement `expertise_areas` linking users to specializations
4. Add user preferences for notifications and AI interaction style
5. Build performance metrics per user/team for AI to reference

---

### 1.4 Industry Intelligence

#### ✅ What We Have
- Simulation personas modeling 40+ lender types
- Business model definitions (invoice finance, ABL, etc.)
- Dimension tables for region, industry, product type

#### 🔴 Critical Gaps

| Gap | Description | Impact |
|-----|-------------|--------|
| **No cross-organization learning** | Each tenant is isolated; no shared intelligence | Cannot say "lenders like you typically..." |
| **No market data integration** | Interest rates, economic indicators, sector health | Decisions made without market context |
| **No benchmarking** | How does our portfolio compare? | Cannot identify outliers or opportunities |
| **No industry-specific knowledge base** | What's normal for construction vs. healthcare lending? | AI gives generic advice |
| **No default/loss history patterns** | What borrower characteristics predict problems? | Cannot learn from industry experience |

#### 📋 Recommendations
1. Design anonymized aggregation for cross-tenant insights (opt-in)
2. Integrate market data feeds (interest rates, economic indicators)
3. Build benchmarking service comparing portfolio to industry norms
4. Create industry-specific knowledge bases for common loan types
5. Implement risk pattern recognition from historical outcomes

---

### 1.5 Domain Knowledge

#### ✅ What We Have
- Comprehensive LOS domain model (deals, entities, covenants, etc.)
- Financial ratio computations with standard formulas
- Stage guards encoding workflow rules
- 161+ conformance tests capturing expected behavior

#### 🟡 Partial Gaps

| Gap | Description | Impact |
|-----|-------------|--------|
| **No structured risk signals** | Beyond covenant breach; what else indicates trouble? | Miss early warning signs |
| **No deal pattern library** | Common deal structures and their outcomes | Reinvent the wheel each time |
| **No playbooks** | Step-by-step guides for common scenarios | AI cannot guide users through complex processes |
| **No FAQ/knowledge base** | Common questions and answers | Users ask AI questions it cannot answer |
| **Limited outcome tracking** | What happened after we closed? Defaults? Payoffs? | Cannot learn what predicts success |

#### 📋 Recommendations
1. Add `risk_signals` table with early warning indicator definitions
2. Create `playbooks` for common workflows (new deal, covenant cure, restructure)
3. Build internal knowledge base with domain expertise
4. Implement deal outcome tracking (default, payoff, restructure) with correlation analysis
5. Add pattern matching to identify "deals like this" with outcomes

---

## Layer 2: Action Layer Gaps

*"Context alone isn't enough. You need applications that can actually apply it to drive value."*

### 2.1 Application Hub (UI)

#### ✅ What We Have
- Headless API enabling any frontend
- OpenAPI specification for API contract

#### 🔴 Critical Gaps

| Gap | Description | Impact |
|-----|-------------|--------|
| **No frontend** | Completely headless; no UI implemented | Cannot demonstrate value; adoption blocked |
| **No role-based views** | Everyone sees everything (when UI exists) | Information overload; no focus |
| **No workflow-driven UI** | UI must be action-oriented, not just data display | Users don't know what to do next |
| **No AI-native interface** | No conversational UI, no AI recommendations | AI is invisible |

#### 📋 Recommendations
1. Build React frontend with role-based dashboards (Originator, Underwriter, etc.)
2. Implement "smart inbox" showing what needs attention today
3. Add AI recommendations surface throughout UI
4. Create conversational interface for AI interaction
5. Build mobile-responsive design for field use

---

### 2.2 AI Agents (Autonomous Workers)

#### ✅ What We Have
- MCP server design in documentation
- Simulation agents for testing
- Experiment framework for model evaluation
- AI conversation/message tracking tables

#### 🔴 Critical Gaps

| Gap | Description | Impact |
|-----|-------------|--------|
| **No production AI agents** | Only testing/simulation; no real work done by AI | The "agentic" part is missing |
| **No MCP server implementation** | Designed but not built | AI cannot interact with system |
| **No autonomous task execution** | AI cannot complete tasks without human each step | Not a true teammate |
| **No proactive recommendations** | AI only responds; never initiates | Misses opportunities to help |
| **No multi-step workflows** | AI cannot orchestrate complex tasks | Limited to simple queries |

#### Specific Agent Gaps

| Missing Agent | Use Case |
|--------------|----------|
| **Document Analyst** | Read uploaded documents, extract key terms, flag issues |
| **Financial Analyst** | Review spreads, identify anomalies, suggest questions |
| **Covenant Monitor** | Track covenants, alert on approaching breaches, suggest actions |
| **Deal Researcher** | Research borrowers, find public information, compile profiles |
| **Communication Assistant** | Draft emails, summarize threads, suggest follow-ups |
| **Portfolio Analyst** | Identify portfolio risks, concentration issues, trends |

#### 📋 Recommendations
1. Implement MCP server with full tool suite
2. Build Document Analyst agent with extraction and analysis
3. Create proactive alert system with AI-generated recommendations
4. Implement multi-step workflow orchestration
5. Add agent task queue for async processing

---

### 2.3 AI Assistant (Every User's Expert)

#### ✅ What We Have
- AI conversation schema supporting context tracking
- Permission modes (explore/ask/auto)

#### 🔴 Critical Gaps

| Gap | Description | Impact |
|-----|-------------|--------|
| **No conversational interface** | No way to talk to AI naturally | Friction to use AI |
| **No role-specific guidance** | AI doesn't know user's role or context | Generic, unhelpful responses |
| **No memory/continuity** | Each conversation starts fresh | Must re-explain context each time |
| **No write-back capability** | AI cannot update CRM based on conversation | Still manual data entry |
| **No tool integration** | AI cannot take actions, only answer questions | Limited utility |

#### 📋 Recommendations
1. Implement chat interface with Vercel AI SDK (as designed in AI_NATIVE_ARCHITECTURE.md)
2. Add user context injection (role, current deals, recent activity)
3. Implement conversation memory with retrieval
4. Enable AI to execute tools with appropriate permissions
5. Build role-specific prompts and capabilities

---

## Layer 3: Coordination Layer Gaps

*"For humans and agents to work as true collaborators, you need coordination that goes beyond traditional workflow automation."*

### 3.1 Agent Management

#### ✅ What We Have
- Actor tracking distinguishes human vs. AI (X-Actor-Type header)
- Permission modes in AI conversation schema

#### 🔴 Critical Gaps

| Gap | Description | Impact |
|-----|-------------|--------|
| **No agent registry** | What agents exist? What can each do? | Cannot manage AI workforce |
| **No task assignment to agents** | Cannot delegate work to AI | Human must do everything |
| **No @mention capability** | Cannot summon AI in context | AI is out of workflow |
| **No autonomy levels** | Cannot set "ask first" vs "just do it" | Wrong balance of control |
| **No agent permissions model** | What is this agent allowed to do? | Security/compliance risk |
| **No human-in-the-loop gates** | Cannot require approval for AI actions | Cannot use AI for sensitive tasks |

#### 📋 Recommendations
1. Create `agents` table with capabilities, permissions, status
2. Implement task assignment that can target human or agent
3. Build @mention system in communications/comments
4. Add autonomy configuration per agent per task type
5. Implement approval gates for AI-initiated mutations

---

### 3.2 Connected Systems

#### ✅ What We Have
- RESTful API for external integration
- Loan ledger designed for Mambu compatibility
- Email ingestion supporting external mail systems

#### 🔴 Critical Gaps

| Gap | Description | Impact |
|-----|-------------|--------|
| **No webhook/event publishing** | External systems cannot subscribe to events | One-way integration only |
| **No integration framework** | Each integration is custom | Slow to add new systems |
| **No standard connectors** | Accounting, CRM, credit bureau, banking | Manual data gathering |
| **No data sync** | Cannot keep external systems in sync | Duplicate data entry |
| **No API for agents to use external tools** | AI cannot call external services | Limited AI capability |

#### Key Missing Integrations

| Integration | Purpose |
|-------------|---------|
| **Credit Bureaus** | Pull credit reports, scores |
| **Company Registries** | Verify business information |
| **Banking/Open Banking** | Real-time transaction access |
| **Accounting Systems** | Sync financial data |
| **Document Generation** | Create loan documents |
| **E-Signature** | Execute documents |
| **Communication Platforms** | Slack, Teams, email |

#### 📋 Recommendations
1. Implement event bus with webhook publishing
2. Create integration framework with standard connector interface
3. Build core connectors (credit bureau, company registry, accounting)
4. Add external tool definitions for AI agents
5. Implement bidirectional sync for key integrations

---

### 3.3 Unified Governance

#### ✅ What We Have
- Comprehensive audit trail (all mutations logged)
- Multi-tenant isolation (tenant_id on all tables)
- Role-based permissions (defined in stage service)

#### 🟡 Partial Gaps

| Gap | Description | Impact |
|-----|-------------|--------|
| **No enforced RBAC** | Roles defined but not enforced at API level | Anyone can do anything via API |
| **No data access controls** | No field-level or record-level security | Sensitive data exposed |
| **No compliance framework** | No structured approach to regulatory requirements | Compliance risk |
| **No data retention policies** | No automated archival or deletion | Storage bloat, compliance issues |
| **No AI governance** | No tracking of AI decisions for explainability | Regulatory risk with AI |

#### 📋 Recommendations
1. Implement API-level RBAC middleware
2. Add field-level security for sensitive data (SSN, financials)
3. Create compliance module (SOC2, lending regulations)
4. Implement data retention and archival policies
5. Add AI explainability tracking (why AI made recommendations)

---

## Priority Roadmap

### Phase 1: Foundation (Enable Basic AI Interaction)
1. **Implement MCP server** - Allow AI to interact with system
2. **Add users/teams tables** - Model who's using the system
3. **Implement basic RBAC** - Enforce permissions at API level
4. **Build chat interface** - Enable conversational AI

### Phase 2: Context (Make AI Smart)
5. **Add full-text search** - Let AI find relevant information
6. **Implement vector embeddings** - Enable semantic search
7. **Add decision rationale capture** - Learn from past decisions
8. **Create unified timeline** - Complete view of deal history

### Phase 3: Agents (Deploy AI Workers)
9. **Build Document Analyst agent** - Automate document review
10. **Create proactive alert system** - AI-driven recommendations
11. **Implement multi-step workflows** - Complex task orchestration
12. **Add agent management** - Control and monitor AI workers

### Phase 4: Platform (Scale and Connect)
13. **Build frontend** - User interface for the platform
14. **Implement integrations** - Connect to external systems
15. **Add industry intelligence** - Cross-tenant insights
16. **Create governance framework** - Compliance and explainability

---

## Conclusion

Open LOS has strong architectural foundations but lacks the three critical elements of an agentic platform:

1. **Rich Context** - Data exists but is not accessible to AI in meaningful ways
2. **Active Agents** - AI framework exists but no agents do real work
3. **Coordination** - Audit exists but no orchestration between humans and AI

The gap is not in the data model or API design—these are solid. The gap is in:
- **Accessibility**: Making context available to AI (search, embeddings, unified views)
- **Intelligence**: Building agents that can act autonomously with appropriate controls
- **Integration**: Connecting to the broader ecosystem of tools and data

Closing these gaps will transform Open LOS from a "system of record" into a "system of intelligence" where AI agents are true teammates in the lending process.
