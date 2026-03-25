# Open LOS Documentation

This directory contains all documentation for Open LOS - an AI-native, open-source Loan Origination System.

## Quick Navigation

| Looking for... | Go to |
|----------------|-------|
| Core vision & philosophy | [MANIFESTO.md](./MANIFESTO.md) |
| Complete system specification | [SPEC.md](./SPEC.md) |
| Architecture overview | [AI_NATIVE_ARCHITECTURE.md](./AI_NATIVE_ARCHITECTURE.md) |
| Product requirements | [PRD-loan-lifecycle.md](./PRD-loan-lifecycle.md) |
| Enterprise concerns | [ENTERPRISE_FAQ.md](./ENTERPRISE_FAQ.md) |

---

## Current Structure

```
docs/
├── README.md                     # This file
│
├── architecture/                 # System architecture & patterns
│   └── agent-service-layer.md
│
├── design/                       # Design documents
│   ├── AI_NATIVE_WORKFLOW.md
│   └── SANDBOX_VERSION_CONTROL.md
│
├── proposals/                    # Technical proposals
│   └── agentic-patterns-from-pi.md
│
├── auto-docs/                    # Automated documentation system
│   ├── templates/
│   ├── generated/
│   └── scripts/
│
└── [Root documents]              # Various docs at root level
```

---

## Recommended Reorganization

The documentation would benefit from the following subdirectory structure:

### `strategic/` - Vision & Positioning
Core philosophy and strategic direction.

| Document | Description |
|----------|-------------|
| MANIFESTO.md | Core philosophy: AI-native, open infrastructure |
| principles-and-ideas.md | CLI-first, agent-driven interaction principles |
| LAUNCH.md | Launch strategy and market positioning |

### `specifications/` - Core Specs & Standards
Technical specifications and conformance requirements.

| Document | Description |
|----------|-------------|
| SPEC.md | Complete B2B lending CRM specification (87KB) |
| SPECIFICATION.md | Condensed specification overview |
| SPEC_SHADOW_MIGRATION.md | Shadow migration specification |
| FRAMEWORK_EVALUATION.md | Rails vs alternatives evaluation |

### `architecture/` - System Design
Architecture, patterns, and engineering standards.

| Document | Description |
|----------|-------------|
| AI_NATIVE_ARCHITECTURE.md | Comprehensive AI-native architecture |
| AI_NATIVE_ARCHITECTURE_ralph_revised.md | Revised architecture version |
| agent-service-layer.md | Agent service layer design |
| AGENTS.md | Agent system overview |
| LEDGER_STYLE.md | Engineering style guide for financial software |
| ARCHITECTURE_GAP_ANALYSIS.md | Analysis of architectural gaps |

### `product/` - Product Requirements
PRDs, feature specs, and product planning.

| Document | Description |
|----------|-------------|
| PRD-loan-lifecycle.md | Complete loan lifecycle (5 stages) |
| PRD_PARALLEL_MIGRATION_VALIDATION.md | Migration validation procedures |
| PRD_SPREADSHEET_SYNC_ENGINE.md | Spreadsheet sync feature |
| PRD_AI_CONVERSATIONS.md | AI conversation features |
| IDEAS.md | Feature ideas and brainstorming |
| FEEDBACK.md | Feedback collection |

### `design/` - Design Documents
Workflow and system design documents.

| Document | Description |
|----------|-------------|
| AI_NATIVE_WORKFLOW.md | Workflow automation & AI-native job abstraction |
| SANDBOX_VERSION_CONTROL.md | Sandbox and version control strategy |

### `business/` - Market & Engagement
Market analysis, engagement strategy, and go-to-market content.

| Document | Description |
|----------|-------------|
| MARKET_HISTORY.md | LOS industry evolution analysis |
| OUTCOME_LED_ENGAGEMENT.md | Customer engagement strategy |
| ENTERPRISE_FAQ.md | Enterprise concerns FAQ |
| LAUNCH_VIDEO_SCRIPT.md | Launch video script |
| SOCIAL_MEDIA_SCHEDULE.md | Social media content plan |

### `proposals/` - Technical Proposals
RFC-style proposals and patterns research.

| Document | Description |
|----------|-------------|
| agentic-patterns-from-pi.md | Agentic patterns from Pi research |

### `auto-docs/` - Documentation Automation
System for generating documentation from commits/PRs.

| Path | Description |
|------|-------------|
| templates/ | Templates for releases, blogs, social, videos |
| generated/ | Auto-generated content |
| scripts/ | Generation scripts and git hooks |
| config.json | Automation configuration |

---

## Document Types

### By Audience

| Audience | Start Here |
|----------|------------|
| **Executives** | MANIFESTO.md, LAUNCH.md, ENTERPRISE_FAQ.md |
| **Architects** | AI_NATIVE_ARCHITECTURE.md, SPEC.md |
| **Product Managers** | PRD-loan-lifecycle.md, IDEAS.md |
| **Engineers** | LEDGER_STYLE.md, AGENTS.md |
| **Marketing** | SOCIAL_MEDIA_SCHEDULE.md, LAUNCH_VIDEO_SCRIPT.md |

### By Document Size

Large documents (>30KB) that require time investment:
- SPEC.md (87KB) - Complete specification
- SPEC_SHADOW_MIGRATION.md (78KB) - Migration spec
- AI_NATIVE_ARCHITECTURE.md (53KB) - Full architecture
- PRD_PARALLEL_MIGRATION_VALIDATION.md (38KB) - Migration PRD
- PRD_SPREADSHEET_SYNC_ENGINE.md (33KB) - Spreadsheet PRD
- PRD-loan-lifecycle.md (31KB) - Loan lifecycle PRD

---

## Contributing to Documentation

1. **New features**: Create or update PRDs in the product section
2. **Architecture changes**: Update relevant architecture docs
3. **Auto-generation**: Use the auto-docs system for release notes and announcements
4. **Style**: Follow the conventions in LEDGER_STYLE.md for technical writing

---

## Known Issues

1. **Flat structure**: Most documents are at root level, making navigation difficult
2. **Duplicate content**: Two versions of AI_NATIVE_ARCHITECTURE exist
3. **Nested docs folder**: `docs/docs/` contains a misplaced file that should be in architecture/

---

## Harness Engineering Control Plane

The repository now includes a deterministic review control-plane for pull requests:

- `/.harness-risk-policy.json` is the machine-readable contract for risk tiers, required checks, docs-drift safeguards, and evidence requirements.
- `/.github/workflows/risk-policy-gate.yml` runs preflight gating before expensive CI fanout jobs.
- `/.github/workflows/review-agent-rerun.yml` is the single canonical rerun comment writer with SHA dedupe.
- `/.github/workflows/review-agent-auto-resolve-threads.yml` auto-resolves bot-only review threads after a clean rerun.
- `/scripts/risk-policy-gate.mjs` and `/scripts/verify-browser-evidence.mjs` provide deterministic local/CI policy evaluation.

Use these commands locally when validating the loop:

```bash
npm run harness:risk-tier
npm run harness-smoke
npm run harness:ui:pre-pr
npm run harness:weekly-metrics
```
