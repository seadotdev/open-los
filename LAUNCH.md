# Introducing Open LOS: Banking Software for the AI Era

## The Problem

Last month, Slack restricted API access for AI agent companies. Salesforce has been aggressively defending their APIs against autonomous agents. The pattern is unmistakable: incumbent software vendors see AI as an existential threat and are responding by building walls.

This should concern you if you're a builder.

When your software vendor decides to restrict what you can do with your data, you don't get a vote. When they build an inferior AI assistant and mandate its use, you're stuck with it. When they raise prices because you can't leave, you pay.

The result is a worse experience for customers. You're constrained to whatever AI capabilities your vendor deigns to provide, regardless of what's actually possible with your data.

## Our Thesis

We believe the future belongs to those who own their own systems of record.

There has never been a better time to run open infrastructure. AI has collapsed the cost of building and maintaining quality software. The only reason to pay enterprise software prices today is lock-in, not value.

So we asked ourselves: what would a lending platform look like if we built it today, designed for AI from the start, and made it fully open?

## Introducing Open LOS

**Open LOS** is an open-source, headless B2B lending platform built for the AI era.

It is:

- **AI-native**: Designed from day one for AI agents. Humans and AI are symmetric—they call the same APIs, get the same audit trails, and have equal capabilities. This isn't AI bolted onto legacy architecture; it's a system where AI agents are first-class citizens.

- **Headless**: No UI opinions. Build your own frontend, generate one with AI, or skip the UI entirely and let agents drive the system. You choose how humans interact with it.

- **Deterministic at the core**: Financial calculations, covenant tests, and stage transitions are mathematical operations, not AI magic. The results are correct and auditable. AI can explain, but the system computes.

- **Fully auditable**: Every mutation creates an immutable audit event. Actor identity (human or AI, including which model and session), timestamp, what changed, and why. Designed for regulators who ask hard questions.

- **MIT licensed**: Your data is yours. No API policies, no vendor lock-in, no restrictions on what you can build. Fork it, modify it, run it on your infrastructure.

## What's Included

Open LOS is a complete loan origination system:

**Deal Lifecycle**
- Five stages: Broker → Origination → Underwriting → Closing → Monitoring
- Stage guards that enforce valid transitions
- Override capabilities for authorized roles
- Full history of every stage change

**Entity Management**
- Companies and individuals
- Ownership graphs with percentage stakes
- Guarantor relationships
- Director relationships
- Borrower group computation

**Financial Analysis**
- Spread creation from P&L and balance sheet data
- Ratio computation: DSCR, leverage, current ratio, gross margin, net margin, debt-to-equity
- Deterministic—no AI in the math

**Covenants**
- Financial, reporting, and information covenants
- Automated testing
- Grace periods
- Waiver workflows with approval tracking
- Alert generation on breach

**Loan Accounts**
- Full ledger with state machine
- Disbursement and repayment tracking
- Interest calculation (fixed/floating)
- Arrears detection
- Repayment schedule generation
- Mambu-compatible data model

**Monitoring**
- Bank transaction ingestion
- Automatic categorization
- Liquidity analysis and runway calculation
- Covenant testing during monitoring
- Alert system for breaches and warnings

**Approval Workflows**
- Stage transition approvals
- Facility approvals
- Covenant waiver approvals
- Full audit trail of decisions

## Built for AI, Maintained by AI

Open LOS is not just designed for AI to use—it's developed and maintained with AI assistance.

- **161 conformance tests** ensure correct behavior
- **Comprehensive documentation** written for AI consumption
- **OpenAPI 3.1 specification** for complete API coverage
- **MCP (Model Context Protocol) design** for agent integration

This is state-of-the-art software that gets better as AI capabilities improve. We're not maintaining legacy code; we're continuously evolving with the tools.

## The Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript (strict mode) |
| HTTP Framework | Hono |
| ORM | Drizzle |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Testing | Vitest + YAML conformance tests |

Simple. Modern. Proven.

## Who This Is For

Open LOS is designed for the next generation of lenders:

- **Fintechs** that need loan origination without enterprise pricing
- **Credit unions** that want modern systems on modest budgets
- **Neobanks** that need to move fast
- **Lending startups** building new products
- **Anyone** who wants to own their infrastructure

If you've been told you need Salesforce or nCino to do serious lending, we respectfully disagree.

## Getting Started

```bash
git clone https://github.com/seadotdev/open-los
cd open-los
npm install
npm test                               # Run 161 conformance tests
npm run start --workspace=packages/api # Start server on :3000
```

That's it. You're running a complete loan origination system.

## What's Next

Open LOS is production-ready at its core, but we're actively building:

- **MCP server** for seamless AI agent integration
- **Analytics endpoints** for portfolio monitoring
- **Frontend starter** with AI SDK integration
- **Open banking integrations** (Codat, GoCardless)
- **Additional ledger features** (fee structures, penalty calculation)

## The Bet

We're betting that:

1. Open source wins in infrastructure
2. AI-maintained software outcompetes human-only development
3. Data sovereignty becomes a competitive advantage
4. The next great financial institutions will be AI-native

The incumbents are building walls. We're building an alternative.

---

**Open LOS is MIT licensed and available now.**

GitHub: [seadotdev/open-los](https://github.com/seadotdev/open-los)

Read the [Manifesto](./MANIFESTO.md) | Read the [Spec](./SPEC.md) | Read the [AI Architecture](./docs/AI_NATIVE_ARCHITECTURE.md)
