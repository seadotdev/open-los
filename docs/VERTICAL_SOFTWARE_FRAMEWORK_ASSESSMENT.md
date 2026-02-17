# Vertical Software Framework Assessment: Open LOS

## Context

This assessment applies the framework from Nicolas Bustamante's "10 Years Building Vertical Software: My Perspective on the Selloff" to Open LOS's strategic position. Bustamante built Doctrine (legal information platform competing with LexisNexis/Westlaw) and Fintool (AI equity research competing with Bloomberg/FactSet). His framework identifies ten moats that made vertical software defensible, maps how LLMs affect each, and provides a three-question test for assessing risk.

The framework is applied here from two angles:
1. **Offensive**: How Open LOS exploits the moats being destroyed at incumbents (nCino, Mambu, Temenos, Salesforce)
2. **Defensive**: How Open LOS builds durable moats of its own that survive the LLM era

---

## The Ten Moats Applied to the LOS Market

### 1. Learned Interfaces: Destroyed at Incumbents, Irrelevant to Us

**Bustamante's thesis**: Proprietary interfaces create switching costs through muscle memory. LLMs collapse all interfaces into natural language, making years of training worthless.

**How this applies to lending software**:

nCino is built on Salesforce. Its users have spent years learning Salesforce navigation, custom objects, page layouts, and reporting. "We're a Salesforce shop" is the lending equivalent of "we're a Bloomberg house." The interface IS the lock-in.

Mambu has its own UI conventions. Temenos Infinity has decades of accumulated interface complexity. Every incumbent benefits from interface lock-in that discourages switching.

**Open LOS's position**: We are the Fintool of this analogy, not the Doctrine. Open LOS is headless by design. There is no proprietary interface to learn. AI agents and humans call the same APIs. The agent IS the interface.

This is a pure offensive advantage. Every hour an nCino user spent learning Salesforce navigation is a sunk cost that our AI-native approach renders worthless. We don't need to retrain anyone. Users type what they want in natural language.

**Strategic implication**: This is our primary wedge for customer acquisition. The incumbents' greatest lock-in mechanism is dissolving. Our marketing already exploits this ("Your AI tools work on day one - no integration project"), but we should sharpen the message: *the interface you spent years learning is now your biggest liability, not your biggest asset.*

---

### 2. Custom Workflows and Business Logic: Vaporized at Incumbents, Hybrid Advantage for Us

**Bustamante's thesis**: Traditional vertical software encodes business logic in code (thousands of if/then branches built over years by rare domain-expert engineers). LLMs turn this into markdown files that domain experts can write directly.

**How this applies to lending**:

nCino has years of lending workflow logic encoded in Salesforce Apex classes, validation rules, process builders, and flows. Modifying a covenant test workflow requires Salesforce developers who understand both the platform AND credit analysis. These people are rare and expensive.

**Open LOS's position**: We take a deliberate hybrid approach that is more nuanced than pure "everything is markdown."

- **Deterministic computations stay in code**: Ratio calculations (DSCR, leverage, current ratio), covenant tests, stage transition guards, loan ledger operations. These MUST be auditable, reproducible, and mathematically correct. An LLM cannot be trusted to compute whether a covenant is breached. The system computes; the AI explains.
- **Orchestration and workflow become agent-driven**: How a deal flows from intake to closing, what documents to request, how to triage applications - this is where agent skills (markdown files) replace hardcoded workflows.

This is a stronger position than either extreme. Pure-code incumbents (nCino) can't adapt fast enough. Pure-agent approaches lack the auditability regulators require. Our hybrid model gives us both speed and compliance.

**Strategic implication**: We should articulate this distinction clearly. It's a differentiator against both incumbents ("we adapt faster") and AI-native competitors who might cut corners on deterministic computation ("we're auditable where it matters"). The tagline from our manifesto captures it: *"The AI explains; the system computes."*

---

### 3. Public Data Access: Commoditized (Less Relevant to LOS)

**Bustamante's thesis**: Vertical software that makes public/licensable data searchable (SEC filings, case law, patents) is being commoditized because LLMs can parse this data natively.

**How this applies to lending**:

This moat is less relevant to loan origination systems. Unlike Bloomberg (market data) or LexisNexis (case law), an LOS doesn't primarily monetize data access. The LOS processes the lender's own data: applications, financial statements, covenants, transactions.

However, there are adjacent areas where this matters:
- **Credit bureau data**: Licensed, not public. Proprietary moat holds.
- **Company registry data**: Semi-public. LLMs can parse this.
- **Financial statement parsing**: This was historically hard (custom NLP pipelines, entity extraction). LLMs now do this natively. Our spread creation feature benefits from this - AI agents can extract P&L and balance sheet data from uploaded documents without custom parsers.

**Strategic implication**: We benefit from commoditized data parsing (it makes our document processing more powerful) without being threatened by it (we don't monetize data access). This is a tailwind, not a headwind.

---

### 4. Talent Scarcity: Inverted (Offensive Advantage)

**Bustamante's thesis**: Building vertical software required rare engineers who understand both code and the domain. LLMs allow domain experts to encode methodology directly, removing the engineering bottleneck.

**How this applies to lending**:

Building lending software historically required engineers who understood credit analysis, covenant structures, loan accounting, and regulatory requirements. nCino's competitive advantage partly rested on having accumulated this talent over a decade.

**Open LOS's position**: Two advantages here:

1. **Open source + AI-maintained**: Our manifesto states "AI-maintained software will outcompete human-maintained software on cost and quality." We don't need the same army of specialized engineers that incumbents do. The codebase is maintained with AI assistance, and the 161 conformance tests ensure correctness regardless of who (or what) writes the code.

2. **Domain experts can contribute directly**: Loan officers, credit analysts, and underwriters can describe their workflows in natural language. These become agent skills without requiring a Salesforce developer as intermediary. The talent bottleneck that protected nCino becomes irrelevant.

**Strategic implication**: This is why a team of six can compete with nCino's hundreds of engineers. We should continue emphasizing this in our positioning. The barrier to building credible lending software has collapsed from "years + millions" to "months + frontier model APIs." We are proof of this thesis.

---

### 5. Private and Proprietary Data: Stronger (This Is Where We Enable Our Customers)

**Bustamante's thesis**: Companies that own genuinely irreplicable data see their moats strengthen in the LLM era. The test: can this data be obtained, licensed, or synthesized by someone else?

**How this applies to lending**:

The lender's proprietary data is their competitive advantage:
- Historical deal performance and loss rates
- Borrower relationship history
- Underwriting decisions and outcomes
- Portfolio composition and risk patterns
- Internal credit models and risk appetite

This data is genuinely proprietary. No LLM has it. No competitor can synthesize it.

**Open LOS's position**: We don't own this data - we enable our customers to own it and leverage it. This is the core of our data sovereignty thesis.

The critical insight from Bustamante's framework: *"If your data isn't truly unique, the AI agent will own the relationship with the customer. You become a supplier to the agent, not a vendor to the customer."*

Open LOS inverts this for lenders. Instead of being trapped in Salesforce where the vendor controls API access to their own data, lenders using Open LOS have full sovereignty over their proprietary data. They can feed it to any AI agent, build any model on top of it, switch providers at will.

**Strategic implication**: Our data sovereignty message is even more important than we realized. In Bustamante's framework, data sovereignty isn't just about avoiding lock-in - it's about ensuring the lender's proprietary data (their real moat) remains accessible and leverageable. We should frame this as: *"Your deal history is your moat. Don't let your vendor lock it behind an API wall."*

---

### 6. Bundling: Weakened (We Are the Agent-Native Bundle)

**Bustamante's thesis**: Vertical software companies expand by bundling adjacent capabilities. LLM agents break this because the agent IS the bundle - it can orchestrate across best-of-breed providers in a single workflow.

**How this applies to lending**:

nCino bundles origination, portfolio management, compliance, and analytics on Salesforce. The bundle creates lock-in: once you're using nCino for origination AND compliance AND portfolio monitoring, switching any single piece is prohibitively complex.

**Open LOS's position**: We are the full bundle (deal lifecycle, covenants, monitoring, loan ledger, document management, entity graphs) but delivered headlessly. The agent orchestrates across all modules through a unified API. This is exactly the architecture Bustamante describes as the future.

However, there's a subtle risk here. If agents can orchestrate across any provider, what stops a customer from using Open LOS for origination but a different tool for covenant monitoring? The answer: our unified data model. A deal, its entities, its covenants, its loan account, and its monitoring alerts all share a single source of truth. Fragmenting this across providers creates data consistency problems that are especially dangerous in regulated lending.

**Strategic implication**: Our bundling moat isn't the interface (that's dissolving) - it's the unified data model. A lending deal is an interconnected graph of entities, financials, covenants, facilities, and transactions. Splitting this across providers creates reconciliation risk. We should emphasize: *"One deal, one source of truth, one audit trail."*

---

### 7. Regulatory and Compliance Lock-in: Structural (Our Strongest Defensive Moat)

**Bustamante's thesis**: Regulatory certification, compliance infrastructure, and deep integration with mission-critical workflows are unaffected by LLMs. HIPAA doesn't care about GPT-5.

**How this applies to lending**:

Lending is heavily regulated:
- **Audit trail requirements**: Regulators demand explainability for every lending decision
- **Fair lending compliance**: Equal Credit Opportunity Act, Fair Housing Act
- **Capital adequacy**: Basel III/IV requirements affect how loans are risk-weighted
- **Anti-money laundering**: KYC/AML requirements on entity verification
- **Data retention**: Regulated minimum retention periods for loan documentation

Once a lender has their regulatory workflow embedded in a system - audit trails configured, compliance checks validated, examiner access established - switching is extremely high-risk and high-cost.

**Open LOS's position**: We have built compliance into the architecture from day one:

- **Immutable audit trail**: Every mutation logged with actor identity (human vs. AI, including model and session), timestamp, field-level diffs, and context. This isn't a feature we added - it's how the system works.
- **Deterministic computations**: Financial calculations and covenant tests are reproducible. When a regulator asks "why did this covenant test pass?", there's a deterministic, auditable answer.
- **Actor tracking**: AI agent actions are tracked with the same rigor as human actions. This matters as regulators increasingly scrutinize AI-driven decisions.

This is our strongest defensive moat. Once a lender has run their first regulatory examination on Open LOS - once examiners have validated the audit trail, once compliance teams have signed off on the reporting - switching becomes extremely costly.

**Strategic implication**: We should accelerate building regulatory moats. Specific actions:
- Work with early customers to complete their first regulatory examination using Open LOS
- Build compliance reporting templates that examiners expect
- Get the system validated by compliance consultants who can provide third-party attestation
- Document how AI-actor audit trails satisfy emerging regulatory guidance on AI in lending

Every successful regulatory examination on Open LOS deepens the moat.

---

### 8. Network Effects: Emerging Opportunity

**Bustamante's thesis**: Software that becomes more valuable as more participants use it has sticky network effects. LLMs don't break these.

**How this applies to lending**:

Traditional LOS platforms don't have strong network effects. nCino doesn't become more valuable because another bank uses it.

**Open LOS's position**: As open source, we have a different network effect opportunity:

- **Community contributions**: More users = more contributions = better software for everyone
- **Shared skills/templates**: As agent skills become the new business logic, a community library of lending skills creates a network effect. A DSCR calculation skill validated by 50 lenders is more trustworthy than one written in isolation.
- **Integration ecosystem**: More users = more integrations with credit bureaus, open banking providers, document management systems. Each integration makes the platform more valuable.
- **Broker networks**: If multiple lenders use Open LOS, broker submission becomes standardized. This is a genuine network effect - brokers prefer submitting to lenders whose systems they understand.

**Strategic implication**: Network effects are our long-term moat, but they require critical mass. Prioritize community building and shared skill libraries. The broker submission standardization angle is particularly promising - it's the "Bloomberg IB Chat" equivalent for lending.

---

### 9. Transaction Embedding: Durable (We Sit in the Money Flow)

**Bustamante's thesis**: Software embedded directly in the transaction (payment processing, loan origination, claims processing) has durable moats. An LLM might sit on top as a better interface, but the rails remain essential.

**How this applies to lending**:

Loan origination IS a financial transaction. The LOS is where:
- Facility terms are defined and approved
- Disbursements are authorized
- Repayments are tracked
- Covenants are tested against live data
- Arrears are detected and escalated

This isn't an information retrieval layer (like Bloomberg) or a search interface (like LexisNexis). Open LOS sits in the actual flow of money from lender to borrower and back.

**Open LOS's position**: Our loan ledger (Mambu-compatible data model), facility management, disbursement tracking, and repayment processing embed us directly in the transaction. An AI agent might be the interface through which a loan officer approves a disbursement, but the system that records, validates, and audits that disbursement is Open LOS.

**Strategic implication**: This is a strong moat. We should continue deepening transaction embedding:
- Direct integration with payment rails
- Automated disbursement workflows
- Real-time bank feed monitoring (already in progress)
- Settlement and reconciliation features

The deeper we embed in the money flow, the more durable our position.

---

### 10. System of Record Status: Threatened Long-Term but Architecturally Advantaged

**Bustamante's thesis**: System of record status is threatened long-term because AI agents are building their own contextual memory across systems, potentially becoming the new source of truth.

**How this applies to lending**:

The LOS is the system of record for deals, loan accounts, covenants, and entity relationships. Regulators expect a single, auditable system of record.

**Open LOS's position**: We are architecturally positioned to BE the system of record that agents build on, rather than being displaced by agent memory. Here's why:

1. **Regulatory requirement**: In lending, you can't have the system of record be "the agent's memory." Regulators require a deterministic, auditable, permanent record. This is law, not preference.
2. **AI-native design**: Because we designed for AI agents from day one, the agent doesn't need to build a parallel system of record - it uses ours. The API is the interface. The audit trail captures everything.
3. **Immutability**: Our audit events are immutable. Agent memory is mutable and unreliable. For regulated lending, immutability wins.

The risk Bustamante identifies (agents accumulating context across systems) actually strengthens our position if we're the canonical data layer. The agent can layer its context on top of our system of record, but the regulatory source of truth remains Open LOS.

**Strategic implication**: We should position explicitly as "the system of record that agents build on." This addresses the Bustamante concern directly: *"The agent's memory supplements our system of record. It doesn't replace it. Regulators won't accept an LLM's context window as an audit trail."*

---

## The Three-Question Test

Bustamante provides a simple risk assessment:

### 1. Is the data proprietary?

**Answer: Partially yes.**

Open LOS itself doesn't own proprietary data. But it is the custodian of the lender's proprietary data (deal history, underwriting decisions, borrower relationships). More importantly, we enable data sovereignty - customers own and control their data, which is the lender's actual moat.

The data that flows through Open LOS (deal terms, covenant results, repayment history) is genuinely proprietary to each lender and cannot be replicated.

**Score: Yes (partial)**

### 2. Is there regulatory lock-in?

**Answer: Yes.**

Lending is a regulated industry. Audit trail requirements, fair lending compliance, capital adequacy reporting, AML/KYC - all create genuine switching costs once a lender's compliance infrastructure is built on a system. Our immutable audit trail and deterministic computations are designed specifically for this.

**Score: Yes**

### 3. Is the software embedded in the transaction?

**Answer: Yes.**

Open LOS manages the full loan lifecycle from origination through disbursement, repayment, and monitoring. The loan ledger, facility management, and covenant testing are directly in the flow of money.

**Score: Yes**

### Result: 2-3 "Yes" answers = Lower Risk

Per Bustamante's framework, Open LOS falls in the **"you're probably fine"** category. But this assessment applies to our defensive position. Our offensive position is even stronger: we are the disruptor exploiting destroyed moats at incumbents.

---

## Applying the Framework to Our Competitors

### nCino (High Risk)

| Question | Answer |
|----------|--------|
| Proprietary data? | No. They process lenders' data on Salesforce. No unique data assets. |
| Regulatory lock-in? | Moderate. Built compliance features but on Salesforce platform. |
| Transaction embedded? | Partially. Origination workflows but lean on partners for core banking. |

**Bustamante risk level**: High to Medium. nCino's primary moats are learned interfaces (Salesforce muscle memory) and bundling (entire lending workflow on one platform) - both of which are being destroyed. Their compliance features provide some protection, but these are built on Salesforce's infrastructure, not their own.

### Mambu (Medium Risk)

| Question | Answer |
|----------|--------|
| Proprietary data? | No. Cloud-native core banking, processes customer data. |
| Regulatory lock-in? | Yes. Core banking certification, deep integration. |
| Transaction embedded? | Yes. Loan ledger, disbursements, repayments. |

**Bustamante risk level**: Medium. Mambu has transaction embedding and some regulatory lock-in. Their risk is that the cloud-native, API-first architecture they pioneered is now table stakes - Open LOS offers the same without vendor lock-in.

### Temenos (Medium-Low Risk on Legacy, High Risk on Growth)

| Question | Answer |
|----------|--------|
| Proprietary data? | No. |
| Regulatory lock-in? | Yes. Deep regulatory integration across jurisdictions. |
| Transaction embedded? | Yes. Core banking is deeply embedded in transactions. |

**Bustamante risk level**: Lower risk on existing business (regulatory fortress), but high risk on new customer acquisition. Their learned interface and implementation complexity moats are dissolving.

---

## Strategic Implications for Open LOS

### Where We Attack (Exploiting Destroyed Moats)

1. **Learned interfaces → Natural language**: Every nCino training manual is a switching cost we eliminate. Lead with "no onboarding, no CSMs teaching navigation, no UI change management."

2. **Business logic in code → Agent skills**: Incumbents need Salesforce developers who understand credit analysis. We need credit analysts who can describe their workflow in plain English.

3. **Talent scarcity inverted**: A team of six competing with hundreds of engineers. This is the message for investors and the market.

4. **Bundling weakened**: We offer the full bundle through a single API, not through an interface that locks users in.

### Where We Defend (Building Durable Moats)

1. **Regulatory compliance (Priority 1)**: Get through first regulatory examinations with early customers. Each successful exam deepens the moat. Build compliance reporting templates. Seek third-party attestation.

2. **Transaction embedding (Priority 2)**: Deepen integration with payment rails, bank feeds, and settlement systems. The deeper we sit in the money flow, the more durable our position.

3. **System of record (Priority 3)**: Position as the canonical data layer for AI agents in lending. "The system of record that agents build on."

4. **Network effects (Priority 4)**: Build community skill libraries, broker submission standards, and integration ecosystems. This is the long-term play.

### The Pincer Movement We Inflict

Bustamante describes the threat to incumbents as a pincer movement: startups from below, horizontal platforms from above.

**Open LOS is the attack from below**: A small team with frontier model APIs, domain expertise, and an open-source platform that handles 80%+ of what nCino does at a fraction of the cost.

**The horizontal platforms are the attack from above**: Microsoft Copilot doing financial analysis in Excel, Anthropic's Claude with industry plugins. These platforms lack the regulatory depth and transaction embedding that lending requires, but they erode the information retrieval and workflow automation layers.

**Our positioning**: We are the regulated infrastructure layer that both agents and horizontal platforms need. The agent handles the interface. Open LOS handles the regulated, transactional, auditable core.

---

## Risk Assessment Summary

| Moat | Impact on Incumbents | Open LOS Position |
|------|---------------------|-------------------|
| 1. Learned Interfaces | Destroyed | Offensive advantage (headless) |
| 2. Custom Workflows | Vaporized | Hybrid advantage (deterministic core + agent orchestration) |
| 3. Public Data Access | Commoditized | Tailwind (better document parsing) |
| 4. Talent Scarcity | Inverted | Offensive advantage (6-person team vs. hundreds) |
| 5. Proprietary Data | Stronger | Enabler (data sovereignty for customers) |
| 6. Bundling | Weakened | Neutral to positive (unified data model) |
| 7. Regulatory Lock-in | Structural | Strongest defensive moat |
| 8. Network Effects | Sticky | Emerging opportunity (open source community) |
| 9. Transaction Embedding | Durable | Strong defensive moat (loan ledger, payments) |
| 10. System of Record | Threatened | Architecturally advantaged (regulatory requirement) |

### Bustamante Three-Question Score

| Entity | Proprietary Data? | Regulatory Lock-in? | Transaction Embedded? | Risk Level |
|--------|-------------------|---------------------|-----------------------|------------|
| **Open LOS** | Partial Yes | Yes | Yes | **Lower Risk** |
| nCino | No | Moderate | Partial | **High-Medium** |
| Mambu | No | Yes | Yes | **Medium** |
| Temenos | No | Yes | Yes | **Medium-Low** |

### Net Assessment

Open LOS is positioned on the right side of every trend Bustamante identifies. We exploit the five moats being destroyed at incumbents while building our own position on the five moats that hold. The critical priorities:

1. **Accelerate regulatory moats** - Get through first examinations, build compliance templates
2. **Deepen transaction embedding** - Payment rails, bank feeds, settlement
3. **Maintain the hybrid architecture** - Deterministic core + agent-native orchestration
4. **Build network effects** - Community, skill libraries, broker standards
5. **Own the narrative** - "The system of record that agents build on. Your data sovereignty. Your infrastructure."

---

*Assessment based on framework from Nicolas Bustamante, "10 Years Building Vertical Software: My Perspective on the Selloff" (February 2025). Applied to Open LOS competitive strategy.*
