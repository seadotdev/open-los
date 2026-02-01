# Social Media Posting Schedule: Open LOS Story Arc

> A content calendar that tells the story of building an AI-native Loan Origination System in public.

---

## Post 1: The Origin Story
**Theme:** The frustration that sparked the idea
**Related Commit:** `e20adaf` → `ff485da` (Jan 28-29)

### Draft

Something our customers always ask us is "which LOS should we use?"

Our answer: "They're all terrible."

- Salesforce is cutting off API access for AI agents
- Legacy systems are designed for humans typing into forms
- Vendors charge you to access your own data
- Adding AI to these systems is like putting a Tesla motor in a horse carriage

So while I was on a long drive, I designed what an AI-native LOS would actually look like.

Here it is: [link to repo]

- Headless API-first
- AI and humans are symmetric (same APIs, same audit trails)
- Financial calculations are deterministic (AI explains, code computes)
- MIT licensed. Your data. Your infrastructure. No permission needed.

161 conformance tests. Full deal lifecycle. Ready to run.

What would you build differently?

---

## Post 2: The Reaction Post
**Theme:** Digging into what resonated from Post 1
**Related Commit:** `f0ffa95` AGENTS.md (Jan 29)

### Draft

Got a lot of interesting conversations out of the Open LOS post.

Three things people kept asking:

**1. "How do you prevent AI hallucination in financial calculations?"**

We don't use AI for the math. DSCR, leverage ratios, liquidity metrics—these are deterministic code. The AI can *explain* why your DSCR is 1.25x. It cannot *calculate* it. Hallucination risk eliminated where it matters most.

**2. "What does 'AI-native' actually mean?"**

It means the system was designed assuming AI agents would operate it from day one. Not retrofitted. The AGENTS.md file in the repo is instructions for AI models to understand and modify the codebase itself.

**3. "Is this actually usable or just a demo?"**

161 conformance tests. 21 database tables. Full 5-stage deal lifecycle. Covenant tracking with grace periods and waivers. Bank transaction monitoring. Mambu-compatible loan ledger.

It's not a demo. It's infrastructure.

---

## Post 3: The Spreadsheet Question
**Theme:** Shadow migration / running alongside existing systems
**Related Commit:** `014c16d` PRD_PARALLEL_MIGRATION_VALIDATION (Jan 30)

### Draft

"Can this sync with our existing spreadsheets and systems?"

This question came up a lot. The honest answer: migrating lending systems is terrifying.

So we designed shadow mode.

```
Your existing LOS (system of record)
         ↓
    Data replication layer
         ↓
Open LOS Shadow (read-write copy)
         ↓
Continuous validation + comparison
```

Run Open LOS alongside your current system. For weeks. For months.

- Ingest your real data via CDC, API polling, CSV, webhooks
- Compare outputs: do the covenant tests match? Do the calculations agree?
- Get a "migration readiness score" before you flip anything

No big-bang cutover. Prove it works with YOUR data first.

The PRD is in the repo if you want the full technical spec.

---

## Post 4: The Enterprise Objections
**Theme:** Addressing what CIOs are worried about
**Related Commit:** `d39862d` ENTERPRISE_FAQ (Jan 30)

### Draft

Had a conversation with a bank CIO last week.

"This sounds great but my board will never approve open source for our loan book."

Fair. Let's talk about what they're actually worried about:

**"Open source isn't secure"**
Linux runs 96% of the world's top servers. Postgres stores trillions in financial data. The fallacy is security through obscurity. We give you code you can actually audit.

**"We can't be compliant"**
Every action—human or AI—creates an immutable audit event. Actor identity, timestamp, field-level diff. When regulators ask "who approved this?", you have evidence. Black-box SaaS gives you a dashboard.

**"What if you abandon the project?"**
You have the code. Unlike a vendor shutdown, nothing changes. Run your version forever. Hire anyone to maintain it.

**"Our current LOS works fine"**
It "works" like a fax machine "works." What you're not measuring: deals lost to 5-day term sheets, breaches caught quarterly instead of real-time, analyst time on data entry.

Full FAQ in the repo: /docs/ENTERPRISE_FAQ.md

---

## Post 5: The Simulation Suite
**Theme:** How we validate lending logic at scale
**Related Commits:** `3be4cdc` Lending business simulation (Jan 30)

### Draft

How do you test a lending system properly?

Unit tests aren't enough. You need to simulate actual lending operations at scale.

We built a simulation suite that runs thousands of lending scenarios:

- Companies with different financial profiles
- Multiple covenant structures
- Deals progressing through stages
- Bank transactions triggering alerts
- Edge cases that break in production

The simulation generates realistic:
- Balance sheets and P&L statements
- Bank transaction histories
- Document flows
- Covenant breach scenarios

Then validates that Open LOS handles them correctly.

It's not just "does the code work?"—it's "does the code work for the messy reality of lending?"

---

## Post 6: The AI Workflow
**Theme:** How AI agents actually interact with the system
**Related Commit:** `a3f5d3d` AI_NATIVE_WORKFLOW design (Jan 30)

### Draft

"AI-native" isn't just marketing. Here's how it actually works:

**The architecture separates what AI should do from what it shouldn't:**

| AI Does | Humans Do |
|---------|-----------|
| Extract data from documents | Verify extracted data |
| Draft credit memos | Approve credit memos |
| Flag covenant breaches | Decide on waivers |
| Suggest next actions | Make judgment calls |

**AI agents call the same APIs as humans.** There's no "AI mode"—just authenticated actors with roles. The audit trail treats Claude the same as a human underwriter.

**Sessions are logged.** Which model. Which prompt. What actions it took. When regulators ask "was AI involved in this decision?", the answer is traceable.

The AI is the associate that does prep work 24/7. Humans are senior bankers that make decisions.

---

## Post 7: The CLI Testing Harness
**Theme:** Experimenting with different AI models
**Related Commit:** `8c074ed` CLI testing harness (Jan 30)

### Draft

Which AI model is best for lending operations?

We don't know. Neither do you. That's why we built a CLI testing harness.

```bash
./experiments/run.sh --model claude-opus-4 --scenario underwriting
./experiments/run.sh --model gpt-4 --scenario covenant-review
./experiments/run.sh --model llama-local --scenario document-extraction
```

Same scenarios. Different models. Measurable outputs.

- How accurate is document extraction?
- How good are the credit memo drafts?
- How fast does it process a deal pipeline?
- What does it cost per deal?

The models are improving monthly. Your lending system shouldn't be locked to one vendor's AI.

Swap models like you swap database drivers. Keep what works.

---

## Post 8: Auto-Documentation
**Theme:** Building in public with automated content
**Related Commit:** `350122d` Auto-documentation system (Jan 30)

### Draft

Hot take: most software documentation is written after the fact and already outdated.

We automated it.

Every commit to Open LOS triggers:
- Release log generation
- Blog post draft (for features)
- Social media content
- Video script prompts
- Migration guides (for breaking changes)

```
docs/auto-docs/generated/
├── releases/       # Per-commit changelogs
├── blog/           # Customer-facing articles
├── social/         # Twitter/LinkedIn ready
├── videos/         # Demo scripts
└── migrations/     # Upgrade guides
```

Why? Because building in public means every change should be communicated. And humans are bad at remembering to document.

Git hooks + templates + LLM = documentation that exists.

---

## Post 9: Tests as Specification
**Theme:** How conformance tests define the system
**Related Commit:** `b9d60eb` Spec-driven test suite (Jan 30)

### Draft

Our tests aren't just tests. They're the specification.

```yaml
# conformance/cases/06_covenants.yaml

- name: covenant_breach_triggers_alert
  steps:
    - action: create_deal
    - action: add_covenant
      type: financial
      metric: dscr
      threshold: 1.2
    - action: record_financial_data
      dscr: 1.1
    - action: run_covenant_test
    - assert: alert_created
      type: covenant_breach
```

161 tests across 9 YAML suites. Each one documents a behavior the system must have.

Benefits:
- New contributor? Read the tests to understand the domain
- AI agent? Parse the YAML to know what's possible
- Regulator? This is what the system does, proven

The spec IS the tests. The tests ARE the spec.

No drift between documentation and reality.

---

## Post 10: What's Next
**Theme:** Roadmap and call to action
**Related to:** Current state + IDEAS.md

### Draft

Open LOS has been live for 3 days. Here's what we're building next:

**Near term:**
- MCP server for seamless Claude/Cursor integration
- Open banking connectors (Codat, GoCardless)
- Self-serve analytics layer
- Frontend starter kit (or AI-generate your own)

**Exploring:**
- Skills system where your ops team can encode their workflows as markdown
- Self-improving software—analyzing successful agent sessions to improve future ones
- On-prem model deployment for fully air-gapped operations

**The bet we're making:**

1. Open source wins in infrastructure
2. AI-maintained software outcompetes human-only development
3. Data sovereignty becomes competitive advantage
4. The next great financial institutions will be AI-native

The incumbents are building walls. We're building the alternative.

GitHub: seadotdev/open-los

What would you add to the roadmap?

---

## Posting Cadence

| Post | Suggested Timing | Platform Focus |
|------|------------------|----------------|
| 1 | Day 1 | Twitter/X, LinkedIn |
| 2 | Day 2-3 | Twitter/X thread |
| 3 | Day 4-5 | LinkedIn (enterprise audience) |
| 4 | Day 6-7 | LinkedIn, HN comment |
| 5 | Day 8-10 | Twitter/X |
| 6 | Day 11-13 | Twitter/X thread |
| 7 | Day 14-16 | Twitter/X, Dev community |
| 8 | Day 18-20 | Twitter/X |
| 9 | Day 22-24 | Twitter/X thread |
| 10 | Day 28-30 | All platforms |

---

## Content Principles

1. **Lead with the problem** — Each post starts with something people recognize and care about
2. **Show, don't tell** — Code snippets, diagrams, concrete examples
3. **Invite conversation** — End with questions, not just announcements
4. **Build on previous posts** — Reference earlier content to create continuity
5. **Be opinionated** — Take positions people can agree or disagree with

---

## Hashtags & Keywords

- #fintech #lending #opensource #AI #LOS
- "AI-native" "headless API" "loan origination"
- Tag: @anthropic when mentioning Claude integration
- Avoid: buzzword soup, empty hype

---

## Metrics to Track

| Metric | Why It Matters |
|--------|---------------|
| GitHub stars | Direct interest |
| Repo forks | Intent to use/contribute |
| LinkedIn engagement | Enterprise reach |
| DMs/emails | Qualified leads |
| "Which LOS" questions decrease | Market education |
