# Open source B2B Lending CRM

# Overview

> Designing a b2b lending CRM,
> 

> Elaborate on the shape of this, but keep it very focussed, summary for each section and the key questions you see for each that need answering so that I can turn this into a product spec to build and open source
> 

> Deal management stages
broker - inbound portal and upload
Origination - deal triage and bickering
Underwriting - deep dive analysis and scenarios and decisions, agentic copilot
Closing - gpt pro and docsign and covenants
Monitoring - open banking / codat and analysis and covenants and liquidity
> 

> Template systems
defaults include business structures, document types per phase all saved in markdown editor that steers exports. Meeting notes, memos, emails
Formal schemas sync with seadev
> 

> Data
financial data extraction and spreading via seadev
Open banking gocardless, accounting codat
S&P data model, fraud pep checks database
Meeting notes SDK
Send/receive emails using inbound and loops
> 

> Data model
multi entity underwriting by default
Log and audit all changes
Rigid core with flexible append ?
> 

> LLM
Ai sdk pinned to side
Analysis through sandbox which exports markdown + html
> 

> Stack
Tanstack as far as possible
Fast simple extensible
All configurable items are git version controlled, with branches and deployment and rollbacks
All markdown is obsidian format
What other AI native standards??
> 

## Overall shape of the product

**Summary:** A workflow-first, data-centric “deal operating system” for B2B lending, where *every deal* moves through a governed state machine (Broker → Origination → Underwriting → Closing → Monitoring), backed by a canonical data model (multi-entity by default), with **Git-versioned configuration + Markdown templates**, and an **AI copilot** that drafts + explains, but all *computations and decisions are auditable and reproducible*.

**Key questions to answer up front**

- What is the primary “customer” persona: **lender**, **credit team**, **broker**, or **both** (two-sided)?
- Multi-tenant model: do you host **many lenders** in one instance (true multi-tenant) or **single tenant deployments**?
- What’s the “source of truth”: DB-first with Git export, or **Git-first** with runtime sync into DB?
- What is the minimum open-source footprint vs “optional proprietary connectors” (Codat, DocuSign, etc.)?

---

## Deal management stages

### 1) Broker stage — inbound portal + upload

**Summary:** A broker-facing intake portal that creates a **Deal** with a minimal schema, validates required fields + docs, and routes it into origination with a clean audit trail and deduplication.

**Core capabilities**

- Public/private **inbound portal** with authenticated broker orgs
- Deal intake form + bulk upload (drag-drop) with virus scanning + file normalization
- Required-doc checklist driven by *template system* (phase-aware)
- Auto-link inbound emails/attachments to a deal (if using inbound email routing)
- Broker status page (what’s missing, what’s accepted/rejected)

**Key questions**

- What is the canonical “intake minimum”: borrower legal name, requested amount, purpose, jurisdiction, last FY accounts, bank statements, etc.?
- How do you identify / authenticate brokers: SSO, magic link, broker org admin?
- Do you support *multiple submissions* per borrower (dedupe rules)?
- What is the UX contract: “upload first, fill later” vs “form first, upload later”?
- What file types must be supported (PDF, XLSX, CSV, scanned images), and do you allow password-protected files?

---

### 2) Origination — deal triage + “bucketing/bickering”

**Summary:** Internal pipeline management: assign owners, qualify/disqualify quickly, track comms, and capture the early decision narrative (why we’re spending underwriting time).

**Core capabilities**

- Pipeline views: Kanban by stage, lists with filters, SLA timers
- Qualification checklist + quick risk flags (industry, geography, size, leverage)
- Internal discussion thread per deal (“bickering”), plus broker Q&A log
- Tasks + handoffs (origination → underwriting) with clear acceptance criteria
- Lightweight credit snapshot from available data (no deep spreading yet)

**Key questions**

- What does “triage” mean in your world: automated scoring, manual checklist, or both?
- What are the standard early outcomes: reject, ask for more info, proceed, refer?
- Who can override a rejection / proceed decision?
- What are the “buckets”: by product type, risk tier, industry, or team?

---

### 3) Underwriting — deep analysis + scenarios + decisions + agentic copilot

**Summary:** The underwriting workspace is the heart: structured multi-entity analysis, spreading, scenario/risk cases, approval workflow, and a copilot that drafts memos and highlights gaps—while every output cites sources and is reproducible.

**Core capabilities**

- Multi-entity borrower group modeling (holdco/opco/guarantors) + relationship graph
- Financial spreading (via seadev) + normalized ratio engine + covenant sizing
- Scenario engine: base/downside/upside; sensitivity tables; liquidity runway
- Decision journal: recommendations, approvals, conditions, and rationale
- **Agentic copilot**: reads docs, suggests missing items, drafts credit memo, generates questions, proposes covenants and conditions, explains anomalies
- “Explainability”: every derived metric links to source statements / transactions

**Key questions**

- What is the underwriting “unit”: a single facility, multiple facilities, or a borrower group with multiple requests?
- What ratios / metrics are standard vs configurable per lender/product?
- What is the approval chain (roles, thresholds, committees)?
- What must be deterministic (spreads, ratios, covenants), and what can be AI-assisted (narrative, summaries)?
- What is the policy on AI: allowed to recommend? allowed to decide? must always cite?

---

### 4) Closing — docs, e-sign, covenants, conditions precedent

**Summary:** Convert approved terms into signed documents, track conditions precedent (CPs), finalize covenant definitions, and generate an immutable closing package.

**Core capabilities**

- Term sheet → doc set generation (from Markdown templates) with version control
- Doc signing integration (DocuSign or pluggable)
- Closing checklist: CPs, KYC/AML, legal review, board approvals, filings
- Covenant configuration: definitions, testing frequency, grace periods, reporting packs
- Final “closing record”: signed PDFs + final terms + covenant schedule

**Key questions**

- What document set is in-scope for v1 (term sheet, facility agreement, guarantees, debentures, board minutes)?
- Do you need clause libraries / playbooks, or just templated docs?
- How do you manage negotiation edits: tracked changes, redlines, or “upload final only”?
- Are covenants *typed and machine-readable* (preferred), or just text?
- Do you need funds flow / disbursement tracking in-product?

---

### 5) Monitoring — open banking + accounting feeds + covenant & liquidity analytics

**Summary:** Ongoing risk management: ingest bank + accounting data, compute covenant tests, detect early warning signals, and manage waivers/amendments.

**Core capabilities**

- Data refresh pipelines (open banking + accounting) with monitoring dashboards
- Covenant engine: scheduled tests, alerting, waiver workflows, amendment history
- Liquidity and runway analytics; variance vs underwriting model
- Exception management: missing data, broken connections, delayed reporting
- “Renewal” workflow: re-underwrite using historical monitoring data

**Key questions**

- Which covenants are you actually enforcing (leverage, DSCR, minimum liquidity, revenue floors)?
- What are alert thresholds and who gets notified (email, Slack, in-app)?
- How do you handle data gaps: fall back to uploads? manual overrides?
- Are you monitoring **entity-level** covenants, **group-level**, or both?
- Do you need borrower-facing reporting portal?

---

## Template systems

**Summary:** A Git-versioned template engine where “default docs per phase” and artifacts (meeting notes, memos, emails) are **Markdown-first (Obsidian-compatible)**, but export cleanly to HTML/PDF/DOCX. Templates are typed via schemas and can be synchronized with “seadev” schemas.

**Core capabilities**

- Template registry: by **phase**, **document type**, **product type**, **jurisdiction**
- Markdown editor with frontmatter for structured fields + Obsidian links
- Variable injection: deal/entity/financial metrics/covenants into templates
- Export pipeline: Markdown → HTML/PDF (and optionally DOCX)
- Governance: approvals, versioning, and “effective date” (for compliance)

**Key questions**

- What templating syntax: mustache/handlebars, MDX, liquid, or custom?
- Where do templates live: DB mirrored to Git, or Git as the primary store?
- How strict are schemas: freeform markdown vs required frontmatter fields?
- Do you need multilingual templates?
- How do you prevent template drift from underwriting data (frozen snapshots at close)?

---

## Data & integrations

**Summary:** A pluggable ingestion layer that turns messy external data into canonical objects: financial statements/spreads (seadev), open banking (GoCardless), accounting (Codat), entity master/risk data (“S&P model”), fraud/PEP checks, meeting notes SDK, and full email threading.

**Core capabilities**

- Connector framework: auth, sync schedules, retries, dead-letter queue
- Data normalization into canonical tables + “raw payload” storage for audit/debug
- Document extraction queue: parse PDFs/XLSX, map to spreads/metrics
- Email integration: send/receive, thread linking to deal, attachment capture

**Key questions**

- Which connectors are **required for OSS** vs “enterprise adapters”?
- Auth patterns: OAuth for Codat/GoCardless; service accounts; per-tenant keys?
- Data refresh cadence: real-time webhooks vs nightly sync?
- Do you store raw bank transactions (sensitive) or only derived aggregates?
- What’s the privacy/compliance posture (PII retention, encryption, audit access)?

---

## Data model

**Summary:** A rigid, well-typed core schema for deals/parties/facilities/financials/covenants/documents + an extension system (“flex append”) that lets OSS adopters add fields without forking the DB schema.

**Recommended core objects**

- **Workspace/Tenant**
- **Deal**
- **Entity** (company/person) + **Relationships** (ownership, guarantee, director)
- **Facility/Loan** (terms, pricing, schedule)
- **Document** + **DocumentVersion**
- **FinancialStatement / Spread** + **LineItems** + **Ratios**
- **Covenant** + **CovenantTest** + **Breach/Waiver**
- **Task/ChecklistItem**
- **Communication** (email/messages/meeting notes)
- **DecisionLog** (recommendations, approvals, rationale)
- **AuditEvent** (who/what/when diff)
- **IntegrationAccount** + **ExternalDataSnapshot**

**Flex append approaches (pick one)**

- JSONB “custom_fields” + JSON Schema per object type (simple, pragmatic)
- Extension tables (“facts”) keyed by object_id + typed value columns (more queryable)
- Event-sourcing (max auditability, higher complexity)

**Key questions**

- Multi-entity underwriting: do you model it as a **graph** (preferred) or a simple list?
- How do you represent complex structures: multiple guarantors, cross-collateral, syndication?
- What is the audit requirement: field-level diffs, full snapshots, or event sourcing?
- Do you need time-travel queries (“what did we know at approval time”)?
- What is your extension guarantee for open-source: backward compatibility rules?

---

## LLM layer

**Summary:** An AI “sidecar” in the UI plus a backend tool-runtime: the copilot can read deal context, call tools (search, compute, draft), run analysis in a sandbox, and export artifacts as Markdown/HTML—while keeping strict traceability and safe execution.

**Core capabilities**

- Pinned AI panel: chat + suggested actions + citations
- Tool calling: “fetch docs”, “summarize”, “draft memo”, “generate covenant language”
- RAG over deal docs + templates + policies
- **Sandboxed analysis**: run underwriting computations (prefer deterministic code paths), export to Markdown/HTML
- Observability: trace prompts, tool calls, token usage, outcomes

**Key questions**

- Model strategy: single provider vs bring-your-own-model?
- What are the hard guardrails: no sending PII to certain models, no autonomous decisions, mandatory citations?
- How are prompts/tools versioned: Git like templates?
- How do you evaluate regressions (golden test cases, scorecards, diffing memos)?
- What’s your policy for “agentic” actions (creating tasks, sending emails, changing fields)?

---

## Stack & “config as code” operations

**Summary:** TanStack-first frontend, TypeScript end-to-end, fast iteration, and GitOps for configuration. Everything configurable (templates, workflows, covenants, schemas) is versioned, branchable, deployable, and rollbackable.

**Concrete shape**

- Frontend: TanStack Router + Query + Table + Form
- Backend: TypeScript API + worker system for sync/extraction/monitoring jobs
- DB: Postgres (strong fit for audit + JSONB extensions)
- Storage: object store for docs + immutable versions
- GitOps: separate “config repo” (or folder) that is deployed alongside app

**Key questions**

- Monorepo vs polyrepo (core vs connectors vs app)?
- How do you “deploy config”: CI that validates schemas/templates, then promotes to environments?
- Do you support on-prem/self-host first (common for open source in lending)?
- What’s the plugin boundary: connectors as packages? runtime-loaded modules?
- How do you keep the app fast with heavy docs + analytics (background materialization)?

---

## Other AI-native standards to consider

**Summary:** Use emerging interoperability + observability standards so your CRM can plug into the agent ecosystem without reinventing glue, and so your AI behavior is inspectable in production.

**Standards worth aligning to**

- **Model Context Protocol (MCP)** for standardizing how your copilot connects to tools and context servers (useful if you want your CRM to expose “tools” to other agents, or consume tools consistently). ([Model Context Protocol](https://modelcontextprotocol.io/specification/2025-03-26?utm_source=chatgpt.com))
- **Agent2Agent (A2A) Protocol** if you expect multiple agents/systems to coordinate (e.g., “credit agent” ↔ “collections agent” ↔ “document agent”) across vendors. ([a2a-protocol.org](https://a2a-protocol.org/latest/?utm_source=chatgpt.com))
- **OpenTelemetry GenAI semantic conventions** to standardize tracing of prompts, tool calls, token usage, and agent workflows (critical for debugging underwriting copilots). ([OpenTelemetry](https://opentelemetry.io/docs/specs/semconv/gen-ai/?utm_source=chatgpt.com))
- **MCP-specific OpenTelemetry conventions** if you adopt MCP and want consistent tracing across MCP servers/clients. ([OpenTelemetry](https://opentelemetry.io/docs/specs/semconv/gen-ai/mcp/?utm_source=chatgpt.com))
- **JSON Schema-defined tool interfaces** (tool/function calling) so tools are typed, validated, and testable. OpenAI’s function calling guide is explicitly JSON Schema-based. ([OpenAI Platform](https://platform.openai.com/docs/guides/function-calling?utm_source=chatgpt.com))
- **AGENTS.md** in your open-source repo to guide coding agents contributing to your project (Git-native, simple Markdown standard). ([Agents](https://agents.md/))

**Key questions**

- Do you want your CRM to be an MCP *server* (expose underwriting/document tools) or just an MCP *client*?
- Will you orchestrate multiple internal agents (then A2A becomes more relevant)?
- What telemetry do you consider mandatory for AI features (prompts, artifacts, decisions)?
- Do you want “policy as code” for AI (allowed tools/actions per role)?

---

## A tight “spec-to-build” checklist (what you should lock next)

If you answer these, you can turn everything above into an implementable product spec quickly:

1. **Canonical objects**: Deal / Entity graph / Facility / Financials / Covenants / Documents / DecisionLog
2. **Stage gates**: entry/exit criteria for each stage + who can transition
3. **Template contract**: Markdown + frontmatter schema + export targets + Git versioning
4. **Connector contract**: raw payload, normalized tables, refresh policy, error handling
5. **Audit contract**: what is logged, diff granularity, time-travel requirements
6. **AI contract**: tools, allowed actions, sandbox, evaluation + observability requirements

If you want, I can also rewrite this into an actual **product spec skeleton** (headings + numbered requirements + acceptance criteria style), but the structure above is already organized to drop directly into that format.

> I want to keep it simple but extensible, and something that a developer would look and and agree with from an architect and maintenance perspective.
> 

> From business perspective, standards that you would expect, we can roll things out later, but we should keep it flexible and adaptive considering we have AI data processing capabilities to lean on
> 

> It shouldn’t be too enterprise, more focus on lean modern Ai enabled teams
> 

> So for each question, answer with a choice and a justification and a risk for that choice and top alternative you’d pick
> 

Below are **concrete default choices** that keep the product **simple, maintainable, and extensible**, with **AI used to reduce manual work** (extraction, summarization, drafting) rather than forcing enterprise-grade workflow engines up front.

I’m answering **every key question** with:

- **Choice**
- **Justification**
- **Risk**
- **Top alternative**

---

# Platform-level decisions

### Primary customer persona

- **Choice:** **Internal lender/credit team first**, broker portal as a “thin edge” (upload + status only).
- **Justification:** Keeps the product coherent and adoption-driven; brokers are valuable, but internal teams feel the daily pain and define underwriting/monitoring requirements.
- **Risk:** Slower broker adoption and less standardization of inbound submissions early on.
- **Top alternative:** **Two-sided from day 1** (brokers + lenders) if your GTM is broker-led; expect 2–3× surface area.

### Multi-tenant model

- **Choice:** **Logical multi-tenancy in schema** (tenant_id everywhere) but ship **single-tenant deploys first** (self-host friendly).
- **Justification:** Best of both: architecture stays clean, OSS adopters can self-host, and you retain a path to SaaS.
- **Risk:** If you later go true SaaS, you’ll need extra work on tenant isolation, billing, rate limits.
- **Top alternative:** **True multi-tenant SaaS from day 1** (harder security + operational burden).

### Source of truth: DB vs Git

- **Choice:** **DB as source of truth for runtime data**, **Git as source of truth for config** (templates, schemas, workflow rules, covenant definitions).
- **Justification:** Deals and events need transactional integrity; config benefits from code review, branching, rollbacks.
- **Risk:** Drift between “what’s deployed” and “what’s in Git” if you allow in-app edits.
- **Top alternative:** **Git-first for everything** (beautiful purity, but painful for real-time collaborative CRM usage).

### Open-source footprint vs proprietary connectors

- **Choice:** **Open-source core + connector interfaces + 1–2 reference connectors**, keep high-maintenance/commercial connectors optional.
- **Justification:** OSS thrives when core is complete; connectors are the natural extension point without bloating maintenance.
- **Risk:** Some users want “batteries included” integrations.
- **Top alternative:** OSS includes **all** connectors (fast adoption, but ongoing churn + vendor API breakage becomes your problem).

---

# Deal stages

## Broker stage

### Intake minimum: what’s required?

- **Choice:** **Minimal viable intake**: borrower legal name + jurisdiction + requested amount + purpose + contact + “upload pack”.
- **Justification:** Reduce form friction; lean on AI to classify docs and backfill fields.
- **Risk:** Triage becomes messy if too many deals arrive incomplete.
- **Top alternative:** **Structured intake v1** with required fields (industry, revenue band, debt amount, security type).

### Broker authentication

- **Choice:** **Magic-link + broker orgs** (email domain + admin approval), upgrade to SSO later.
- **Justification:** Fast and dev-friendly; enough security for early stage; avoids enterprise SAML.
- **Risk:** Weaker enterprise compliance expectations.
- **Top alternative:** **OIDC SSO** for broker orgs (more work, higher trust).

### Multiple submissions / dedupe

- **Choice:** **Allow multiple submissions**, but implement **soft dedupe warnings** (same legal entity + reg number + similar amount within N days).
- **Justification:** Brokers will resubmit; don’t block flow—just reduce duplicates.
- **Risk:** Duplicate deals can pollute pipeline metrics.
- **Top alternative:** **Hard dedupe** (reject duplicates) — better hygiene, worse broker UX.

### UX contract: upload vs form

- **Choice:** **Upload-first**, then AI-assisted “extract & propose fields”, with a human confirm step.
- **Justification:** Matches reality of broker packs; leverages AI where it shines.
- **Risk:** AI extraction errors can cause mis-triage if not confirmed.
- **Top alternative:** **Form-first** for data correctness; slower adoption.

### File support and password-protected files

- **Choice:** Support **PDF, XLSX, CSV, images**, and **explicitly do not support password-protected files in v1** (ask broker to re-upload).
- **Justification:** Keeps ingestion pipeline reliable and secure.
- **Risk:** You’ll lose some deals initially if brokers insist on locked PDFs.
- **Top alternative:** Support password-protected files via broker-provided password (security and UX complexity).

---

## Origination stage

### Triage approach

- **Choice:** **Manual checklist + lightweight rule flags** (e.g., excluded industries, min revenue band), add scoring later.
- **Justification:** Simple, explainable, and adaptable; avoids building a scoring model prematurely.
- **Risk:** Inconsistent triage across originators.
- **Top alternative:** **Configurable scoring rubric** (weighted rules) that still stays deterministic.

### Standard early outcomes

- **Choice:** **4 outcomes**: Reject, Need Info, Pre-Approve (Proceed), Refer (to senior/credit).
- **Justification:** Keeps metrics and pipeline clean.
- **Risk:** Some teams want more nuanced states.
- **Top alternative:** Add “Hold / Defer” as a 5th.

### Override policy

- **Choice:** **Role-based override** (e.g., “Credit Lead” can override Reject/Proceed), with mandatory rationale.
- **Justification:** Simple governance without committees.
- **Risk:** Power concentration; potential inconsistency.
- **Top alternative:** **Two-person rule** for overrides (adds friction but reduces mistakes).

### Bucketing

- **Choice:** Bucket by **product type + risk tier** only (industry tags as metadata).
- **Justification:** Product/risk drive underwriting path; industry can remain a filter/tag.
- **Risk:** Industry-specific workflows might matter later.
- **Top alternative:** Bucket by **team** (originator pod owns verticals) if org structure is stable.

---

## Underwriting stage

### Underwriting “unit”

- **Choice:** **Borrower group (entity graph) + one or more facilities** per deal.
- **Justification:** Most real underwriting is group-based; facilities are the outputs.
- **Risk:** More complex than “single facility only.”
- **Top alternative:** **Single facility v1**, add group modeling later (faster but likely rework).

### Ratios/metrics: standard vs configurable

- **Choice:** Ship a **standard core set** (liquidity, leverage, DSCR, gross margin, runway) and allow **configurable formula definitions** in Git.
- **Justification:** Gives “standards you’d expect” without hardcoding forever.
- **Risk:** Formula flexibility can lead to inconsistent reporting if unmanaged.
- **Top alternative:** Hardcode metrics initially and expose a plugin API later (simpler now, less flexible).

### Approval chain design

- **Choice:** **Simple thresholds + roles** (amount/risk-based): Analyst → Manager → Credit Lead.
- **Justification:** Lean teams don’t want committee engines; still provides control.
- **Risk:** Larger lenders may outgrow it.
- **Top alternative:** **Configurable approval workflow** (YAML-defined states) but keep it intentionally limited.

### Deterministic vs AI-assisted

- **Choice:** **Deterministic for numbers + covenant tests**, AI-assisted for **drafting, summarizing, anomaly detection, checklists**.
- **Justification:** Architecturally clean: computations are testable; AI boosts throughput without being a source of truth.
- **Risk:** Users may over-trust AI narrative.
- **Top alternative:** AI-generated “suggested metrics” allowed, but require explicit confirmation and provenance links.

### AI policy: recommend vs decide

- **Choice:** AI can **recommend and draft**, cannot **finalize decisions or stage transitions**; always attach citations to sources.
- **Justification:** Keeps accountability human; reduces legal/compliance risk.
- **Risk:** Slower “autonomous” workflows.
- **Top alternative:** Allow “auto-create tasks/checklists” (safe actions) while still blocking approvals.

---

## Closing stage

### Document set in v1

- **Choice:** **Term sheet + conditions precedent checklist + covenant schedule + signing packet assembly** (upload facility agreement if you don’t generate it yet).
- **Justification:** You get most operational value without building a full legal doc generator.
- **Risk:** Users may expect full facility agreement automation.
- **Top alternative:** Generate **facility agreement** from templates only for one product type/jurisdiction.

### Clause libraries vs templated docs

- **Choice:** **Templated docs only**; clause library later.
- **Justification:** Clause libraries become “enterprise legal ops” quickly.
- **Risk:** Less flexibility during negotiation.
- **Top alternative:** A minimal **clause snippet library** (Markdown includes) without full playbook logic.

### Negotiation edits handling

- **Choice:** **Versioned uploads** + “final executed” marking; no tracked-changes collaboration in v1.
- **Justification:** Keeps scope sane and auditable.
- **Risk:** Legal teams may find it clunky.
- **Top alternative:** Integrate with a doc platform later; or store redlines as separate versions.

### Covenants typed vs text

- **Choice:** **Typed covenants** (structured) + optional “free-text notes”.
- **Justification:** Monitoring only works if covenants are machine-readable.
- **Risk:** Upfront modeling effort; edge cases.
- **Top alternative:** Text-only v1 and “monitor manually” (but then monitoring becomes weak).

### Funds flow / disbursement tracking

- **Choice:** **Out of scope v1**, but include a simple “disbursement record” object stub.
- **Justification:** Keep closing lean; don’t become a payments system early.
- **Risk:** Some lenders consider this core.
- **Top alternative:** Simple ledger: date, amount, account, reference—no automation.

---

## Monitoring stage

### Which covenants enforced (initial set)

- **Choice:** Start with **Minimum Liquidity**, **DSCR (or EBITDA coverage)**, **Leverage**, plus **Reporting timeliness**.
- **Justification:** These cover most SME/mid-market monitoring needs.
- **Risk:** Some products need bespoke covenants.
- **Top alternative:** Add “Revenue covenant” / “MRR covenant” if you lend to SaaS.

### Alerts & notifications

- **Choice:** **In-app + email**, with Slack later.
- **Justification:** Minimal integrations; email is universal.
- **Risk:** Teams live in Slack and may miss emails.
- **Top alternative:** Add Slack webhook as a simple optional integration.

### Handling data gaps

- **Choice:** **Graceful degradation**: flag missing feeds, request uploads, allow manual override with audit note.
- **Justification:** Real-world data is messy; don’t block monitoring entirely.
- **Risk:** Manual overrides can hide issues.
- **Top alternative:** Strict “no data, covenant fails” rule (harsh but consistent).

### Entity vs group covenant testing

- **Choice:** Support **group-level by default**, entity-level as optional per covenant.
- **Justification:** Matches underwriting unit (group); keeps model consistent.
- **Risk:** Some lenders require entity-level compliance.
- **Top alternative:** Always compute both and choose which is binding per covenant.

### Borrower-facing portal

- **Choice:** **Not in v1** (internal-only), but design APIs so it can be added.
- **Justification:** Borrower portal multiplies scope (auth, UX, permissions).
- **Risk:** More manual borrower comms.
- **Top alternative:** Minimal portal: “upload requested docs + see covenant status”.

---

# Template system

### Templating syntax

- **Choice:** **Markdown + frontmatter + simple mustache-style variables**.
- **Justification:** Easy for devs, readable diffs in Git, low magic.
- **Risk:** Complex logic becomes awkward.
- **Top alternative:** **MDX** or **Liquid** if you truly need conditionals/loops (more power, more complexity).

### Where templates live

- **Choice:** Templates live in **Git**, synced into app at deploy time; app can render but not edit by default.
- **Justification:** “Config as code” keeps architecture clean and reviewable.
- **Risk:** Non-dev users can’t tweak templates quickly.
- **Top alternative:** Allow in-app edits that open PRs (nice, but more engineering).

### Strict schemas vs freeform

- **Choice:** **Lightly strict**: required frontmatter keys for key doc types; freeform body.
- **Justification:** Enough structure for automation, not enterprise rigidity.
- **Risk:** Inconsistent templates if governance is weak.
- **Top alternative:** Fully strict schemas (strong consistency, slower iteration).

### Multilingual templates

- **Choice:** **No multilingual in v1**.
- **Justification:** Not needed for lean teams unless you’re global day one.
- **Risk:** Limits adoption in non-English contexts.
- **Top alternative:** Add i18n for UI first, templates later.

### Preventing template drift

- **Choice:** **Freeze “rendered artifacts” at milestones** (approval + closing) as immutable Markdown/PDF outputs linked to the template version hash.
- **Justification:** Keeps auditability without complex doc management.
- **Risk:** Users may re-render accidentally if not careful.
- **Top alternative:** Full document “effective date” system with governed publishing (enterprise-ish).

---

# Data & integrations

### Required OSS connectors vs enterprise

- **Choice:** OSS includes **inbound email parsing + file upload ingestion + generic CSV/XLS import**; keep Codat/GoCardless as optional adapters.
- **Justification:** Avoid vendor lock-in and API churn in core OSS.
- **Risk:** Users want instant “bank feed” value.
- **Top alternative:** Ship **one** accounting + **one** banking connector as reference implementations.

### Auth patterns

- **Choice:** **OAuth per tenant** for third-party connectors, secrets stored encrypted; local dev uses env vars.
- **Justification:** Standard, secure, and maintainable.
- **Risk:** Secret handling and rotation complexity.
- **Top alternative:** Bring-your-own-credentials via external secret manager integration.

### Refresh cadence

- **Choice:** **Daily scheduled sync + manual “refresh now”**.
- **Justification:** Simple and reliable; enough for most monitoring covenants.
- **Risk:** Miss intraday deterioration signals.
- **Top alternative:** Webhooks + near-real-time sync (more moving parts).

### Store raw bank transactions vs derived aggregates

- **Choice:** Store **raw transactions** in a restricted table with **configurable retention** + always keep derived aggregates.
- **Justification:** Supports explainability (“why did liquidity drop?”) and audit trails.
- **Risk:** Sensitive data footprint increases compliance burden.
- **Top alternative:** Store **derived only** and keep raw externally (less risk, less debugging power).

### Privacy/compliance posture

- **Choice:** **Security baseline**: encryption at rest, per-tenant access controls, audit log, configurable retention, PII redaction for AI.
- **Justification:** “Expected standards” without enterprise bloat.
- **Risk:** Some customers require SOC2/SAML/data residency.
- **Top alternative:** Add “compliance packs” later (SAML, SCIM, residency, SOC2 controls).

---

# Data model

### Multi-entity modeling: graph vs list

- **Choice:** **Graph** (Entity + Relationship edges), but keep UI simple (tree/ownership view).
- **Justification:** Minimal schema change later; real underwriting needs relationships.
- **Risk:** More complex querying and UI.
- **Top alternative:** List of entities with a “primary borrower” (fast, but rework later).

### Complex structures (guarantors, cross-collateral, syndication)

- **Choice:** Model **guarantees and collateral as first-class objects**, leave syndication as “notes/participants” initially.
- **Justification:** Guarantees/collateral impact risk and docs; syndication can come later.
- **Risk:** If you are a syndication platform, this is insufficient.
- **Top alternative:** Full facility participant model with allocations (enterprise-ish).

### Audit requirement

- **Choice:** **Field-level audit events** (who/when/what changed) + immutable document versions.
- **Justification:** Most value with low complexity; devs understand it.
- **Risk:** Hard to reconstruct exact historical state if many changes occurred.
- **Top alternative:** Event sourcing (powerful, but heavy).

### Time-travel queries

- **Choice:** **Snapshots at key milestones** (submitted, approved, closed) + audit log in between.
- **Justification:** Gives “what did we know then?” without event-sourcing.
- **Risk:** Not full time-travel for arbitrary timestamps.
- **Top alternative:** Periodic snapshots (nightly) for richer history.

### Backward compatibility rules for OSS

- **Choice:** **Versioned schemas + migration scripts**; promise backwards compatibility on core objects for N minor versions.
- **Justification:** Maintains trust and upgrade path.
- **Risk:** Slows refactors.
- **Top alternative:** Move fast/break things early, stabilize later (ok pre-1.0, risky after adoption).

---

# LLM layer

### Model strategy

- **Choice:** **Provider-agnostic interface**, ship with **one default provider** adapter.
- **Justification:** Simple onboarding, avoids lock-in, keeps architecture clean.
- **Risk:** Abstraction can leak; adapters need maintenance.
- **Top alternative:** Single provider only (fastest, but constraints later).

### Hard guardrails

- **Choice:** **Role-based tool permissions + mandatory citations + optional PII redaction + “no autonomous approvals”**.
- **Justification:** Clear safety boundary and accountability.
- **Risk:** Users want more automation.
- **Top alternative:** Allow “auto-draft + auto-create tasks” while still blocking approvals.

### Prompts/tools versioning

- **Choice:** **Git-version prompts/tool manifests** alongside templates.
- **Justification:** Reviewable, reproducible, rollbacks.
- **Risk:** Slower iteration for non-dev users.
- **Top alternative:** Store in DB with export-to-Git (more flexible, more drift risk).

### Regression evaluation

- **Choice:** **Golden deal packs** (docs + expected outputs) + automated diff tests for memos/covenant extraction.
- **Justification:** Keeps AI changes safe and maintainable.
- **Risk:** Requires curating test data.
- **Top alternative:** Manual reviews only (faster now, risky later).

### Agentic actions policy

- **Choice:** **Suggest-first**: AI proposes changes, human confirms; allow safe actions like drafting notes/emails.
- **Justification:** Prevents silent corruption of deal data.
- **Risk:** Less “magic”.
- **Top alternative:** Auto-apply low-risk changes (tags, task creation) with undo.

---

# Stack & GitOps operations

### Monorepo vs polyrepo

- **Choice:** **Monorepo** for OSS core + connectors.
- **Justification:** Easier dependency management and contributor experience.
- **Risk:** Repo can grow large.
- **Top alternative:** Split connectors into separate repos once ecosystem grows.

### Deploying config

- **Choice:** Config repo with **CI validation** (schemas, templates render tests), deploy via **versioned releases**.
- **Justification:** Clean and professional for architects; avoids runtime surprises.
- **Risk:** Adds CI complexity.
- **Top alternative:** In-app config editing (fast, less controlled).

### Self-host vs cloud-first

- **Choice:** **Self-host friendly first**, cloud later.
- **Justification:** Open source adoption in lending often prefers control.
- **Risk:** Support burden across environments.
- **Top alternative:** Cloud-first SaaS with limited self-host (simpler ops for you).

### Plugin boundary

- **Choice:** Connectors as **packages implementing a stable interface** (typed contracts).
- **Justification:** Easy to maintain and test; avoids runtime loading complexity.
- **Risk:** Version compatibility issues.
- **Top alternative:** Runtime-loaded plugins (powerful, harder to secure/operate).

### Performance with heavy docs + analytics

- **Choice:** **Background workers** for extraction/spreading/materialization; UI reads precomputed views.
- **Justification:** Fast UX, clean separation.
- **Risk:** Staleness and job monitoring needs.
- **Top alternative:** Compute-on-read (simpler, slower and costlier).

---

# AI-native standards decisions

### MCP: server or client?

- **Choice:** **MCP client first** (your copilot can call external tools consistently).
- **Justification:** Immediate value without committing to exposing your CRM as a platform.
- **Risk:** Harder later if you want others to call *your* underwriting tools.
- **Top alternative:** Add MCP server later to expose “Deal Context”, “Covenant Test”, “Doc Render”.

### Multiple agents (A2A) now or later?

- **Choice:** **Single orchestrator agent** with tool calls; postpone multi-agent protocols.
- **Justification:** Lean teams don’t need agent swarms; fewer failure modes.
- **Risk:** Harder to scale complexity later.
- **Top alternative:** Introduce specialized agents later (doc agent, data agent) and adopt A2A when needed.

### Telemetry requirements

- **Choice:** **OpenTelemetry traces** for AI actions + job pipeline + audit events.
- **Justification:** This is “architect-approved” without being enterprise theatre.
- **Risk:** Adds instrumentation work.
- **Top alternative:** App-level logs + minimal metrics (fast, less debuggable).

### Policy as code for AI

- **Choice:** **Simple YAML policy**: allowed tools/actions per role + per stage.
- **Justification:** Flexible, versioned, and understandable.
- **Risk:** Policy sprawl if unmanaged.
- **Top alternative:** Hardcoded policies until usage stabilizes.

---

If you want the next step without blowing scope: I can turn these choices into a **product spec skeleton** with:

- core entities,
- APIs per stage,
- minimal UI screens,
- job workers,
- and “config as code” folder structure (templates/prompts/schemas/workflows),
    
    so a developer can start building immediately.
    

# **Product**

[https://chatgpt.com/c/69689d2c-ef34-8330-9025-fa626b7b794f](https://chatgpt.com/c/69689d2c-ef34-8330-9025-fa626b7b794f)

> So what I want to capture is the idea that if we created an AI-native, open-source CRM for business lending, that people would be compelled to try because it would be cheap and easy to use and extensible and sensible base with lots of useful AI primitives. I would want to think about what kind of AI-native capabilities we should be thinking about. So my first thought is training your own models. If someone…
> 

Yep — “AI-native, open-source CRM for business lending” is compelling if the AI isn’t bolted on, but *structural*: every object and workflow in the CRM is designed to be machine-assisted, auditable, and extensible.

Below is a menu of AI-native capabilities that fit lending specifically, plus a pragmatic way to package them so people are *compelled to try* (cheap/easy) and then *stick* (power/extensibility).

---

## What “AI-native” should mean in a lending CRM

### 1) Every record has **a living underwriting narrative**

Instead of notes being a junk drawer, the system maintains a continuously-updated “credit memo draft” for each borrower/deal:

- business overview + model (what they do, how they make money)
- key risks + mitigants
- financial summary and trends
- covenant rationale
- conditions precedent checklist
- open questions / missing docs
- recommended structure and pricing (with rationale)

This alone is sticky: people want *less typing, more decision-quality*.

**AI primitive:** structured summarization + citation to source docs/data + change tracking.

---

### 2) A **document and data ingestion engine** that feels magical

Business lending is docs + messy financials. Make ingestion the “wow” moment:

- bank statements, tax returns, management accounts, AR/AP aging, contracts, invoices
- automatic entity extraction: owners, UBOs, counterparties, locations
- auto-map to borrower profile fields and financial statements
- detect anomalies: missing pages, inconsistent totals, altered statements, stale docs
- normalize to lender’s schema (chart of accounts mapping)

**AI primitives:** extraction, table understanding, entity resolution, anomaly detection.

---

### 3) **KYB/KYC/AML copilots** that produce *audit-ready* outputs

The CRM should produce not just a “pass/fail” but:

- what was checked
- what was found
- why something is a concern
- what evidence supports the conclusion
- suggested next step (request docs / escalate / reject)

**AI primitives:** investigative workflows + evidence linking + deterministic policy checks with LLM “explanations” layered on top.

---

### 4) “Agentic workflows” for **the boring-but-critical lending loops**

People will keep using it if it runs the grind:

- chasing missing docs automatically (polite emails + escalation rules)
- generating borrower follow-up questions based on gaps
- “conditions tracker” that nudges parties
- renewal / annual review automation (request updated FS, re-rate risk, update memo)
- covenant monitoring tasks and reminders

**AI primitives:** workflow agent + templated comms + task planning + policy constraints.

---

### 5) **Deal structuring recommendations** (with guardrails)

Not “the AI decided” — but “here are 3 structures and why”:

- term / revolver / blended
- covenants suggested given volatility + leverage
- collateral package recommendations
- pricing bands based on risk tier + comparable historical book
- conditions precedent tailored to the specific risks (customer concentration, AR quality, etc.)

**AI primitives:** retrieval over lender’s playbook + past deals + simple risk model + LLM rationale.

---

### 6) **Collections + early warning signals**

A lending CRM that predicts and *prevents* badness:

- signals from borrower comms (“we’re fine” language patterns, delays)
- financial drift (margin compression, cash conversion cycle changes)
- covenant breach probability
- “watchlist” auto-populated with reasons + suggested actions

**AI primitives:** time-series features + classification + comms analysis + alert explanations.

---

### 7) An **AI memory layer** that’s safe and useful

CRMs die because knowledge is trapped in individuals. Give every borrower:

- a “single source of truth” timeline of events
- “what happened last time” retrieval (renewal, exception approvals)
- meeting notes that become tasks + updates to the credit narrative

**AI primitives:** RAG over internal notes/docs + structured event extraction + task creation.

---

## Training your own models: how to make it real (and not scary)

“Train your own models” *is* compelling — but for most lenders the first desire is:

1. **Use our data privately**
2. **Customize behavior to our policy**
3. **Prove it’s reliable and auditable**

So position “training” as a ladder:

### Level 1: Customization without training

- prompt templates per workflow (underwriting memo, KYB summary, doc chase)
- retrieval over your own policies + playbooks + past deals
- “field mappings” and rule-based thresholds

### Level 2: Fine-tune small task models (practical)

- doc classification (which doc is this?)
- entity matching / dedupe (is this the same borrower?)
- risk tagger (“customer concentration risk” yes/no with evidence)

### Level 3: Full model training (rare, but make it possible)

- a model registry + dataset builder inside the product
- labeling UI (“approve/decline reason”, “missing data categories”)
- evaluation harness baked in (more below)

**Key: ship the infrastructure so power users can go deep, but everyone gets value at Level 1.**

---

## The “AI primitives” that make this extensible (open-source flywheel)

If you want developers to extend it, define a small set of first-class primitives that plugins can rely on:

### A) Evidence-first RAG (citations everywhere)

Any AI output must attach source spans:

- doc page/line references
- table cell references
- transaction IDs
- external check artifacts (KYB results)

### B) Prompt + workflow versioning (like migrations for AI)

- every prompt/workflow has a version
- outputs are reproducible (same inputs → same run configuration)
- you can roll back

### C) Evaluation and monitoring built in

This is a *huge* differentiator in lending:

- golden test cases per workflow (20–200 examples)
- regression checks when prompts/models change
- metrics: factuality (citation coverage), policy adherence, time saved
- human review queues when confidence is low

### D) Policy engine + “LLM under constraints”

- deterministic rules for hard constraints (e.g., debt service coverage thresholds)
- LLM used for interpretation + drafting + triage, not for final enforcement
- red-team modes: hallucination checks, missing-citation checks

### E) Agent sandbox + tool permissions

For any “agent” actions:

- allowlist tools (send email, update stage, request docs)
- require approvals for risky actions
- full audit log: what it tried, what it did, why

---

## Lending-specific “killer features” that feel cheap/easy to try

If you want immediate adoption, optimize the first 30 minutes:

1. **Upload a borrower doc pack → instant borrower profile + memo draft**
2. **Connect bank feed / accounting export → instant normalized FS**
3. **Generate missing-doc checklist + borrower email in one click**
4. **Show the timeline + open risks + next-best actions**

That’s the demo loop people repeat.

---

## Suggested MVP vs “later”

### MVP (compelling, buildable)

- borrower/deal objects + timeline
- doc ingestion + extraction + mapping
- memo draft with citations
- missing-doc automation + comm templates
- basic policy checks + exceptions workflow
- plugin interface for new “AI skills”

### Later (defensible moat)

- early warning + watchlist models
- pricing/structure recommender trained on book
- covenant monitoring integrations
- active learning loops + fine-tunes
- marketplace for plugins (open-source community)

---

## A concrete next step: pick 3 flagship workflows

If you pick just three to design “AI-native” end-to-end, I’d pick:

1. **Borrower onboarding + doc pack ingestion**
2. **Credit memo generation with evidence + policy checks**
3. **Conditions + doc chase automation**

Those three touch the highest-frequency pain and show immediate value.

If you continue your sentence (“If someone…”), I can help turn that into:

- the exact user story,
- the AI capability set behind it, and
- what you’d open-source first vs keep as optional hosted services.

# Tech

[https://chatgpt.com/c/6968a0c0-efb4-832b-aa35-e4e67a0e9dbf](https://chatgpt.com/c/6968a0c0-efb4-832b-aa35-e4e67a0e9dbf)

> If I wanted to build software with AI the fastest and most effective way possible, where I don't need it to be deployed and running, I just need to build the shape of the software as quickly as possible and as robustly as possible in a way that I can build it later, so to speak. I'm thinking of getting the spec or the shape of it and rapidly iterating on the APIs and the data model and the interfaces and APIs that would be needed to build it later in a way that allows me to put together a proof of concept and test it and validate it with AI and then put the AI into building iterations on it in a way that it's pure conceptual model and sort of structural design and sort of building along those lines, basically. What would that look like? I can imagine it's designing the APIs and designing tests more than designing layouts and structures. I can imagine it's... providing sample data and running that data through tests, or it's simulating the business process where an expert judge model tries to achieve something with the app and assesses the input and output and decides whether the transformation is correct. So I'm wondering, is it maybe a CLI that mocks up various commands or interfaces? Is a CLI the most effective feedback loop where an AI can design both sides of a CLI, or is it an API? Help me reason about what the best way to turn a need into a spec. I don't want the software, but I want the spec. I want high-fidelity shape and parameters that I can then build software into as quickly as possible.
> 

You’re basically describing **“software architecture as an executable spec”**: a thing that’s *not* production software, but is **high-fidelity enough** that:

- you can validate the workflow end-to-end,
- you can evolve the API + data model quickly,
- you can test correctness and edge cases,
- and later, building the real system is mostly “swap mocks for real implementations.”

The fastest way to do that is to treat the “shape” as a **contract + scenarios + invariants**, and make it *runnable* via either a CLI or a thin HTTP API (or both).

## What “the spec” should be made of

Think in layers, from most stable to most changeable:

### 1) Domain language and boundaries (most important)

A one-page glossary and a “what’s in / what’s out” boundary list.

- Entities and their meanings (“Order”, “Quote”, “EligibilityCheck”)
- Commands and outcomes (“Approve”, “Reject”, “Schedule”)
- Invariants (“you can’t approve a canceled order”)

If you don’t nail this, APIs/data models will churn endlessly.

### 2) Use-case scripts (scenarios)

Write scenarios like a screenplay:

- Given state
- When action
- Then outcome

Do 10–30 scenarios covering: happy paths, sad paths, weird paths.

These become your **acceptance tests** and the backbone of iteration.

### 3) Contracts (API, events, data model)

Instead of building code, you build:

- **Request/response shapes** (JSON schemas, OpenAPI)
- **Event shapes** (AsyncAPI or just event JSON schemas)
- **Data model constraints** (SQL DDL or a conceptual ERD + constraints)

The goal is: anyone can implement it later without guessing.

### 4) Executable spec harness (the “proof without product”)

This is your key idea: **simulate** the app’s behavior and validate it with tests + AI judges.

- A deterministic “reference” implementation (can be simple/incomplete)
- A fake persistence layer (in-memory)
- Property tests and golden tests
- An “expert judge” model that tries to accomplish tasks and scores results

This harness is what you iterate on.

---

## CLI vs API as the feedback loop

### CLI is usually fastest for *spec iteration*

**Why CLI is great for this phase:**

- Super tight loop: `run scenario → inspect output → change contract → rerun`
- Easy to express workflows and sequences
- AI can generate both “user commands” and “system responses” cleanly
- Works offline; minimal boilerplate
- Output can be “canonical” (JSON printed) which is perfect for tests

**When CLI breaks down:**

- You need to validate real client/server boundaries (auth, pagination, versioning)
- You need realistic integrations (webhooks, third-party clients)
- You want to hand the spec to other teams who think in HTTP contracts

### HTTP API is best when the contract must be “real”

If the future build will be API-first, you’ll eventually want:

- OpenAPI spec
- Versioning rules
- Error model
- Idempotency model
- Pagination model
- Authz/authn model (even if mocked)

But you can still prototype this without a deployment: run a local server or even just validate OpenAPI + contract tests without building full logic.

### The sweet spot: **CLI + canonical JSON contracts**

My recommendation for your exact goal:

1. Make **the domain model and operations** expressible as CLI commands.
2. Make **all outputs and inputs** match the eventual JSON API shapes.
3. Generate OpenAPI *from* those schemas later.

So your CLI is basically a **human-friendly test driver** for your future API.

---

## The “executable spec” workflow that works well with AI

### Step A — Start with “operations” not screens

Write a list of verbs:

- `create_thing`
- `validate_thing`
- `transition_state`
- `compute_quote`
- `schedule_job`
- `reconcile_payment`

For each operation define:

- Inputs (required/optional)
- Outputs
- Errors (typed)
- Side effects (events emitted, state transitions)

This becomes your **operation catalog**.

### Step B — Define state machines explicitly

Most business systems are state machines hiding in code.

Define states + transitions early:

- states: `Draft → Submitted → Approved → Fulfilled → Closed`
- transitions: who can do them, preconditions, emitted events

This alone prevents tons of rework.

### Step C — Create three kinds of tests (these become your spec)

1. **Acceptance scenarios** (Given/When/Then)
2. **Contract tests** (schema validation, error shape, backwards-compat)
3. **Property tests** (invariants always hold, random sequences don’t break rules)

You don’t need real persistence; you need correctness.

### Step D — Add an “expert judge” loop (your idea is solid)

Have an LLM play “user/agent” that tries to accomplish tasks:

- “Create an order, apply discount, ensure tax is recalculated correctly”
- “Try invalid actions; confirm correct error type and message”
- “Attempt to violate invariants; ensure system blocks it”

And a separate judge model grades:

- Did it achieve the intended goal?
- Are outputs consistent with the contract?
- Are errors correctly typed?
- Are invariants maintained?

This is especially powerful when you have ambiguous business rules: the judge can flag places where the spec is underspecified.

### Step E — Freeze “shape” using versioned schemas

Your output is a versioned set of artifacts:

- `/schemas/*.json` (JSON Schema for entities, inputs, outputs)
- `/openapi.yaml` (or generated)
- `/scenarios/*.feature` (Gherkin or similar)
- `/invariants.md` (human-readable rules)
- `/changelog.md` (what changed and why)

Now you have a spec you can build to.

---

## What this looks like concretely (a template)

### 1) Operation catalog (example)

**Operation:** `QuotePrice`

**Input:** `{ customer_id, items[], shipping_address, currency }`

**Output:** `{ quote_id, line_items[], subtotal, tax, shipping, total, expires_at }`

**Errors:**

- `InvalidAddress`
- `UnsupportedCurrency`
- `ItemUnavailable`
    
    **Events:**
    
- `QuoteCreated`

### 2) Canonical error model (hugely important)

Define one error envelope that never changes:

```json
{
  "error": {
    "code": "ItemUnavailable",
    "message": "Item 123 is out of stock",
    "details": { "item_id": "123" },
    "retryable": false
  }
}

```

This saves months later.

### 3) CLI driver that mirrors future API

- `app quote-price --input quote_request.json`
- output is always JSON matching the contract
- tests diff JSON output against expected

### 4) Scenarios

- `scenario: quote with taxable items`
- `scenario: quote expires and cannot be accepted`
- `scenario: invalid discount rejected`

---

## How AI helps most (and where it lies)

AI is great at:

- generating exhaustive edge cases
- proposing consistent schema shapes
- expanding scenarios into tests
- spotting missing invariants
- generating migration-safe versioning rules

AI is risky at:

- inventing business rules you didn’t specify
- creating inconsistent naming across artifacts
- “helpfully” changing the contract style mid-stream

So you want to constrain it with:

- a naming guide
- a canonical error envelope
- schema-first generation
- contract tests that fail loudly

---

## A practical “best way to turn a need into a spec” playbook

1. Write 10–20 bullet **jobs-to-be-done** (“A user needs to X so that Y”).
2. Convert each to a **scenario** with success + failure variants.
3. Extract the **operations** implied by scenarios.
4. Define **schemas** for operation inputs/outputs and core entities.
5. Define **invariants** and **state machines**.
6. Build a thin **CLI runner** that executes scenarios against a mock/reference model.
7. Add **AI agent/judge** to try adversarial and exploratory workflows.
8. Iterate until scenarios stabilize and contract churn slows.
9. Freeze v1 of contracts; produce OpenAPI and a “build guide.”

That produces exactly what you want: “high-fidelity shape and parameters” with proof.

---

## If you only pick one: pick CLI-first, schema-first

If your goal is *fastest* and *most robust spec*:

- **Schema-first** (JSON Schema/OpenAPI-ish)
- **CLI as the primary harness**
- **Scenarios + invariants as tests**
- **AI agent + judge to explore gaps**

Then when you’re ready, the “real build” is largely:

- Replace mock storage with DB
- Replace reference functions with real services
- Wrap the same operations behind HTTP endpoints

---

If you tell me the domain in one sentence (even vague: “marketplace refunds”, “B2B invoicing”, “clinical triage”, “creator payouts”), I can sketch a concrete first-pass spec kit: operation catalog + canonical entities + error model + 10 starter scenarios + an iteration loop that uses AI judges.

[https://chatgpt.com/c/69689e60-6aec-8331-be2d-9801e01c33e2](https://chatgpt.com/c/69689e60-6aec-8331-be2d-9801e01c33e2)

> to get a series of, I wanna build a CRM, but I don't wanna build very many integration touch points if I can possibly avoid it. And I also want to avoid building core logic, so it's a business lending CRM. So a lot of the logic should be some held logic, but as many interfaces as possible, I want to pick the best open source providers. So I'm thinking from where the journey starts at origination and then calendar sync.
> 

If your goal is **“business lending CRM”** with **minimal integration touch points** and **minimal custom core logic**, the trick is to **separate “system of record” (loan/ledger) from “system of work” (CRM/tasks)** and make everything talk through **one orchestration layer** (events/workflows), not a spiderweb of point-to-point integrations.

## A practical reference architecture (low-touchpoint)

### 1) Lending core (don’t build this)

Use an open-source **loan/ledger platform** as your “truth” for loan state, balances, schedules, and (ideally) accounting.

**Best-known open options**

- **Apache Fineract** – core banking + loans/savings + accounting + reporting; built to handle the loan lifecycle via APIs. ([fineract.apache.org](https://fineract.apache.org/?utm_source=chatgpt.com))
- **Mifos X** – core banking platform with customers, savings/loan accounts, payments orchestration, ledger/reporting. ([GitHub](https://github.com/openMF/mifos-x?utm_source=chatgpt.com))

These become your “held logic” layer: approvals, disbursement, repayment, status transitions live here (as much as possible). Your CRM shouldn’t be calculating amortization schedules or maintaining balances.

### 2) CRM / “system of work” (don’t build from scratch)

Pick a CRM you can extend with custom entities (Applications, Borrowers, Guarantors, Documents, Covenants, Underwriting Tasks), but avoid inventing a whole UI/permissions/audit trail layer.

**Good open-source CRM candidates**

- **EspoCRM** – open-source CRM with a REST API and a clean architecture for customization. ([GitHub](https://github.com/espocrm/espocrm?utm_source=chatgpt.com))
- **SuiteCRM** – widely used open-source CRM option (strong ecosystem). ([TechRadar](https://www.techradar.com/best/the-best-open-source-crm-of-year?utm_source=chatgpt.com))

If you want to move fastest with custom “lending objects,” EspoCRM is often friendlier to developers (cleaner extension patterns), while SuiteCRM is a big tent.

### 3) Workflow/orchestration (the “one integration surface area”)

This is how you avoid building loads of bespoke integration touchpoints.

- Put **all side-effects** here: create tasks, request docs, send emails, schedule meetings, push statuses, notify Slack, etc.
- The CRM and lending core publish events; the workflow engine consumes events and calls APIs.

**Two common approaches**

- **BPMN/workflow engines** (great for “loan stage gates” and human tasks): Flowable / jBPM / etc. ([meirwah.github.io](https://meirwah.github.io/awesome-workflow-engines/?utm_source=chatgpt.com))
- **Automation/orchestration platforms** (fast connectors, fewer custom adapters): **n8n** is popular and self-hostable, with lots of integrations. ([GitHub](https://github.com/n8n-io/n8n?utm_source=chatgpt.com))

**Security note if you pick n8n:** there have been recent critical issues reported affecting self-hosted instances; you’d want it patched, locked down (not public), and with least-privilege credentials. ([TechRadar](https://www.techradar.com/pro/security/thousands-of-n8n-instances-under-threat-from-top-security-issue?utm_source=chatgpt.com))

### 4) Calendar sync (start here like you said)

You have two paths:

**Path A (fewest integrations): expose CalDAV**

- Run an open-source **CalDAV server** (or CalDAV-compatible calendar service) and have users subscribe/connect from their calendar clients.
- **Radicale** is a lightweight CalDAV/CardDAV server that works out of the box. ([radicale.org](https://radicale.org/v3.html?utm_source=chatgpt.com))

This avoids building/maintaining *multiple* Google/Microsoft sync implementations at first. Users can connect via standard CalDAV.

**Path B (best UX for Google/Microsoft): one “calendar adapter”**

- If you need 2-way sync with Google Calendar / Outlook, accept you’ll have an adapter.
- Keep it **one adapter service** (or one workflow integration), not embedded everywhere.

## “Origination → calendar sync” journey (minimal moving parts)

**Objects**

- Lead/Referral → Borrower → Application → Opportunity/Deal (CRM)
- Loan Account (Fineract/Mifos)
- Meeting (Calendar), Tasks (CRM), Documents (storage)

**Flow**

1. **Application created** in CRM (or from a web form)
2. Workflow creates a **loan application record** in lending core (or only once qualified)
3. Workflow assigns underwriting tasks (CRM) + triggers doc requests
4. When borrower needs a call, workflow **creates a calendar event** (CalDAV first; Google/M365 adapter later)
5. Status changes in lending core emit events → workflow updates CRM pipeline stages automatically

## Recommended “best open source providers” shortlist (by role)

- **CRM/UI:** EspoCRM (extensible + REST) ([GitHub](https://github.com/espocrm/espocrm?utm_source=chatgpt.com))
- **Loan/ledger core:** Apache Fineract or Mifos X ([fineract.apache.org](https://fineract.apache.org/?utm_source=chatgpt.com))
- **Workflow/orchestration:** BPMN list starting point (Flowable/jBPM/etc.) ([meirwah.github.io](https://meirwah.github.io/awesome-workflow-engines/?utm_source=chatgpt.com))
- **Automation/connectors:** n8n (self-host, lots of connectors) — but treat hardening/patching as mandatory ([GitHub](https://github.com/n8n-io/n8n?utm_source=chatgpt.com))
- **Calendar standard:** Radicale (CalDAV/CardDAV) ([radicale.org](https://radicale.org/v3.html?utm_source=chatgpt.com))

## MVP plan that keeps integrations low

1. Stand up **EspoCRM** + your lending entities (Application, Borrower, Guarantor, Doc Checklist, Underwriting Task).
2. Stand up **Fineract or Mifos X** only for the **loan account lifecycle** you refuse to re-implement.
3. Add **one workflow layer** (start simple: event webhooks + workflows; later BPMN if needed).
4. Do **CalDAV via Radicale** for meeting scheduling first.
5. Only once product/GT-M fit is clear: add **Google/M365 calendar adapter** as a single isolated service.

If you tell me (a) how regulated/strict your audit/compliance needs are and (b) whether your users live in Google Workspace or Microsoft 365, I can narrow this to one concrete stack and a first-week build plan.

> I also look up things like open company identifiers and person identifiers. So I've seen SMP has their open source, open use company identifiers, so that would be the core backbone of the data model. And any entity would connect to that or try and connect to that and reference that. And then also I've seen MOOC has an open sanctions list for different regions, so a sanctions database that operates at different regional levels. And so I think about kind of what the flow looks like for that, for that ecosystem kind of KYC, KYB, all the related data pulls that are necessary for everyone to run, but are not necessarily that differentiated, giving you a shape for what that would look like. And…
> 

Yep — what you’re describing is basically **“an identifiers-first entity graph + a compliance screening service”** that every part of the CRM/lending stack references, so you don’t end up re-implementing KYB/KYC logic in five places.

Below is a concrete “shape” you can use.

---

## 1) Make identifiers the spine of your data model

### Canonical Entity (your internal ID)

Create **one internal ID** for every real-world thing you care about:

- `Entity` (Company | Person | Vessel | Address | Document)
- `entity_id` = your UUID (never changes)
- `identifiers[]` = list of external IDs you can resolve to

A good identifier record shape:

```
identifier {
  scheme: "lei" | "opencorporates" | "companies_house_uri" | "wikidata" | ...
  value: string
  authority: string (optional)
  confidence: 0..1
  first_seen_at, last_seen_at
  source: {name, url, retrieved_at}
}

```

**Why:** everything in the CRM (applications, deals, contacts) points to `entity_id`, and the entity points outwards to authoritative IDs.

### Practical open “company identifier” sources

- **LEI (GLEIF / Global LEI Index)** for standardized legal-entity reference data (when a borrower has an LEI, it’s gold). ([Home – GLEIF](https://www.gleif.org/en/lei-data/global-lei-index?utm_source=chatgpt.com))
- **OpenCorporates** as a cross-jurisdiction company directory with an API + provenance (helpful when you don’t have LEI). ([api.opencorporates.com](https://api.opencorporates.com/?utm_source=chatgpt.com))
- **Companies House / UK company URIs** (if you’re UK-heavy, this is a nice stable URI form). ([Data.gov.uk](https://www.data.gov.uk/dataset/5a33338a-e142-4f05-9458-ca7283f410b3/company-identifiers-uris?utm_source=chatgpt.com))

Licensing note: OpenCorporates’ free API access is tied to open-data/share-alike usage and attribution terms—worth deciding early whether you’re “open” or “commercial.” ([api.opencorporates.com](https://api.opencorporates.com/documentation/API-Reference?utm_source=chatgpt.com))

---

## 2) Sanctions / PEP as a dedicated “screening service” (not scattered logic)

What you called “MOOC” sounds like **OpenSanctions**, which is open-source and aggregates sanctions + PEP + related entities. ([GitHub](https://github.com/opensanctions/opensanctions?utm_source=chatgpt.com))

Key pieces that make it very usable as a backbone:

- **OpenSanctions data + entity model** (built on “Follow the Money” schema + deduplication). ([GitHub](https://github.com/opensanctions/opensanctions?utm_source=chatgpt.com))
- **Yente**: an API you can run on-prem as a “KYC appliance” for search/matching so customer data doesn’t leave your infra. ([GitHub](https://github.com/opensanctions/yente?utm_source=chatgpt.com))
- Dataset scoping like **`/search/sanctions`** or jurisdiction-specific datasets (screen only what you need per region). ([api.opensanctions.org](https://api.opensanctions.org/?utm_source=chatgpt.com))

### Important near-term UK-specific change (Jan 28, 2026)

OpenSanctions has announced the UK is moving to the **UK Sanctions List (UKSL)** as the single official designations source, and that their older HMT/OFSI consolidated dataset reference will be deprecated on **January 28, 2026**. ([OpenSanctions](https://discuss.opensanctions.org/t/upcoming-changes-to-the-uk-sanctions-lists/237?utm_source=chatgpt.com))

If you’re building now, design your “dataset policy” so you can flip sources without rewriting your app.

---

## 3) The “ecosystem flow” for KYB/KYC (minimal touchpoints)

### The principle

Your CRM, loan core, doc system, etc. should all call **one** internal service:

> Entity & Compliance Service
> 
> 
> *Resolve identities → enrich → screen → store evidence → emit decisions/events.*
> 

Everything else is a client of that service.

### A clean end-to-end flow (origination → underwriting → servicing)

### A) On lead / application creation (KYB bootstrap)

1. User enters: *company name + jurisdiction + reg number (if known)*
2. **Entity service resolves**:
    - If LEI provided: fetch LEI reference data ([Home – GLEIF](https://www.gleif.org/en/lei-data/global-lei-index?utm_source=chatgpt.com))
    - Else: try OpenCorporates lookup & capture provenance ([api.opencorporates.com](https://api.opencorporates.com/?utm_source=chatgpt.com))
    - Else (UK): resolve via Companies House URI ([Data.gov.uk](https://www.data.gov.uk/dataset/5a33338a-e142-4f05-9458-ca7283f410b3/company-identifiers-uris?utm_source=chatgpt.com))
3. Create/attach your internal `entity_id` and store all identifiers.

Output back to CRM:

- `entity_id`, best-known legal name/address, identifiers, confidence, provenance snapshot.

### B) Ownership/director graph (KYB deepening)

You’ll eventually need **UBO/directors** for many regimes. Even if you don’t have a perfect open dataset globally, you can model it as:

- `owns(Company -> Person/Company)` edges with provenance + timestamps
- Store “unknown / unverified” edges too (so you can request docs to confirm)

### C) Screening (sanctions + PEP + watchlists)

When an entity (company or person) is created/updated or when ownership edges change:

1. Send a screening request to your **screening adapter** (Yente/OpenSanctions):
    - Screen the company
    - Screen directors/UBOs
    - Screen related entities (where policy requires)
2. Record:
    - match candidates, scores, and the **exact dataset scope** used (e.g., `sanctions`, `gb_fcdo_sanctions`, `us_ofac_sdn`) ([api.opensanctions.org](https://api.opensanctions.org/?utm_source=chatgpt.com))
    - analyst disposition: false positive / escalated / confirmed
    - full audit trail (who, when, why)

### D) Decisioning + tasks (don’t bake into CRM)

Your CRM should not contain screening logic. Instead:

- Screening service emits events:
    - `screening.completed`
    - `screening.hit`
    - `screening.needs_review`
- Workflow engine turns that into tasks:
    - “Request proof of address”
    - “Escalate to compliance”
    - “Block disbursement until cleared”

### E) Ongoing rescreening (servicing hygiene)

Add scheduled jobs:

- Rescreen high-risk entities daily/weekly
- Rescreen everyone monthly/quarterly
- Immediate rescreen if OpenSanctions dataset updates (you can key off your own “dataset snapshot version”)

---

## 4) What the “data pulls that aren’t differentiated” look like (as components)

Think of these as pluggable providers behind your Entity service:

### Providers (examples)

- **Legal entity reference**: LEI / OpenCorporates / Companies House URI ([Home – GLEIF](https://www.gleif.org/en/lei-data/global-lei-index?utm_source=chatgpt.com))
- **Sanctions + PEP**: OpenSanctions/Yente ([GitHub](https://github.com/opensanctions/yente?utm_source=chatgpt.com))
- **Internal watchlists**: your own tables (fraud rings, previous defaults, etc.)

### The adapter contract (so you can swap later)

Every provider implements:

- `resolve(query) -> candidates[]`
- `enrich(entity_id) -> facts[] + provenance`
- `screen(entity_id, scope_policy) -> matches[] + evidence`

That’s how you avoid “integration touch points” everywhere else.

---

## 5) The big design win: “Identifiers-first” prevents duplicated entities

If you anchor everything on your internal `entity_id` and keep identifiers as edges:

- you can merge entities later (dedupe)
- you can explain *why* you think Acme Ltd is the same as “ACME LIMITED”
- you can re-run screening with a new dataset or new matching logic without rewriting CRM objects

---

If you tell me which jurisdictions you care about first (e.g., **UK + EU + US** vs “global from day 1”), I can propose a default **scope policy matrix** (which sanctions datasets to screen at which stage, and how often to rescreen) that’s realistic for an MVP and won’t explode your operational load.

# Dev

> This looks great. I want to now work on a comprehensive test set as a spec. This will allow us to build the app via spec and brute force the app with Ai coding
> 

> Here is an example [https://simonwillison.net/2025/Dec/15/porting-justhtml/](https://simonwillison.net/2025/Dec/15/porting-justhtml/)
> 

> Help me think about how we could use that principle here, by designing the interfaces/apis/tests that mean we can ship this
> 

You’re pointing at exactly the right principle: **if you can reduce the product to a robust, language/tool-agnostic conformance suite, you can let coding agents “fill in the implementation” with high confidence**. That’s the core lesson Simon calls out—*robust test suite → safe agentic loop*, plus starting with a **thin end-to-end “smoke slice”** before going wide. ([Simon Willison’s Weblog](https://simonwillison.net/2025/Dec/15/porting-justhtml/))

And Drew’s “whenwords” pushes the same idea to an extreme: **SPEC.md + tests.yaml + INSTALL.md (+ AGENTS.md)** becomes the “product”, and implementations become replaceable. ([Drew Breunig](https://www.dbreunig.com/2026/01/08/a-software-library-with-no-code.html))

Below is a concrete way to apply that to your B2B lending CRM so you can **ship a real app** (not just a library) while still being spec-driven and AI-buildable.

---

# 1) Translate the principle into a CRM-friendly shape

A CRM is harder than a pure function library because it has:

- persistence
- async jobs
- permissions
- file uploads
- integrations
- UI + API

So your “conformance suite” needs **three layers**:

### Layer A — Deterministic domain conformance (fast, stable)

These are pure or near-pure behaviors:

- stage transitions
- required fields/checklists
- audit log semantics
- covenant computations
- template rendering outputs
- “deal graph” invariants

✅ This is where you want the **big, robust test suite**.

### Layer B — HTTP API contract conformance (still stable)

- OpenAPI/JSON Schema for request/response bodies
- scenario tests that hit endpoints and compare JSON + snapshots

✅ This is your “headless lending OS”. UI can be thin.

### Layer C — End-to-end UX smoke tests (small, not comprehensive)

- 5–15 Playwright tests to make sure the product is usable
- don’t try to encode every behavior in UI tests

✅ Keep this small to avoid flakiness.

This mirrors what made JustHTML portable: **a huge deterministic suite + thin smoke tests first**. ([Simon Willison’s Weblog](https://simonwillison.net/2025/Dec/15/porting-justhtml/))

---

# 2) Make the spec repo look like “whenwords”, but for an app

You want the repo itself to be the “truth” an agent can implement against.

## Recommended repo layout

```
/SPEC.md
/AGENTS.md
/INSTALL.md

/openapi/v1.yaml
/schemas/*.schema.json

/conformance/
  /cases/
    core_deals.yaml
    stages.yaml
    audit.yaml
    templates.yaml
    underwriting.yaml
    covenants.yaml
    monitoring.yaml
    email_ingest.yaml
    permissions.yaml
  /fixtures/
    /deals/
      deal_001_small_sme/
        entities.json
        request.json
        docs/
          accounts.csv
          bank_txns.csv
          inbox_email_1.eml
        expected/
          extracted.json
          spread.json
          ratios.json
          credit_memo.md
          covenant_schedule.json
          monitoring_report.md
  /snapshots/
    ...

```

### What each file is for

- **SPEC.md**: rules of the world (states, invariants, “must” behaviors, error semantics)
- **openapi/v1.yaml**: the public contract (so agents can build endpoints)
- **schemas/**: canonical object schemas (Deal, Entity, Facility, DocumentVersion, CovenantTest…)
- **conformance/cases/*.yaml**: language-agnostic tests (the “html5lib-tests” equivalent)
- **conformance/fixtures/**: synthetic deal packs and deterministic expected outputs
- **AGENTS.md**: “how to work in this repo” for coding agents (commit rhythm, how to run tests, style)
- **INSTALL.md**: the short copy/paste prompt to generate an implementation (like whenwords) ([Drew Breunig](https://www.dbreunig.com/2026/01/08/a-software-library-with-no-code.html))

That last point matters: Drew explicitly shows how the install instructions can literally be a prompt. ([Drew Breunig](https://www.dbreunig.com/2026/01/08/a-software-library-with-no-code.html))

---

# 3) Define “the implementation” as an interface boundary

To make this buildable by brute-force AI coding, you need a **single stable boundary**.

For this product, the best boundary is:

## A headless HTTP API + deterministic export functions

- The implementation must expose **HTTP endpoints** (OpenAPI)
- It must implement **deterministic business rules**:
    - stage machine
    - checklist generation
    - audit log diffs
    - template rendering → markdown/html
    - covenant tests
- It may implement AI features, but AI must not be required for conformance (more on that below)

This avoids the trap Drew warns about: for complex systems, specs alone get messy unless grounded by testability and repeatability. ([Drew Breunig](https://www.dbreunig.com/2026/01/08/a-software-library-with-no-code.html))

---

# 4) Design a conformance DSL that’s easy for agents + humans

You want tests that are:

- **language-agnostic**
- **simple enough** that any harness can run them
- **explicit about state and expectations**

## A practical YAML test DSL (minimal, but expressive)

Here’s a pattern that works well:

```yaml
version: "0.1.0"
meta:
  name: "Broker upload-first to origination"
  now: "2026-01-01T12:00:00Z"

arrange:
  reset_db: true
  seed:
    tenant:
      id: "t1"
    users:
      - id: "u_broker"
        role: "broker"
      - id: "u_originator"
        role: "originator"

steps:
  - id: create_deal
    http:
      actor: "u_broker"
      method: POST
      path: /v1/broker/deals
      json:
        borrower_name: "Acme Ltd"
        jurisdiction: "GB"
        requested_amount: 250000
        purpose: "Working capital"
    expect:
      status: 201
      json_schema: "schemas/deal.schema.json"
      save:
        deal_id: "$.id"

  - id: upload_pack
    http:
      actor: "u_broker"
      method: POST
      path: /v1/deals/${deal_id}/documents
      multipart:
        - field: file
          file: "conformance/fixtures/deals/deal_001_small_sme/docs/accounts.csv"
        - field: meta
          json:
            doc_type: "accounts"
            phase: "broker"
    expect:
      status: 202
      json_contains:
        deal_id: "${deal_id}"

  - id: transition_to_origination_fails_if_missing_minimum
    http:
      actor: "u_originator"
      method: POST
      path: /v1/deals/${deal_id}/stage-transitions
      json:
        to_stage: "origination"
    expect:
      status: 409
      json_contains:
        code: "STAGE_GUARD_FAILED"

  - id: set_missing_field
    http:
      actor: "u_originator"
      method: PATCH
      path: /v1/deals/${deal_id}
      json:
        borrower_registration_number: "12345678"
    expect:
      status: 200

  - id: transition_to_origination_ok
    http:
      actor: "u_originator"
      method: POST
      path: /v1/deals/${deal_id}/stage-transitions
      json:
        to_stage: "origination"
    expect:
      status: 200
      json_contains:
        stage: "origination"

assertions:
  - name: "Audit log records both changes"
    http:
      actor: "u_originator"
      method: GET
      path: /v1/deals/${deal_id}/audit
    expect:
      status: 200
      json_path_assertions:
        - path: "$.events.length"
          gte: 2
        - path: "$.events[0].type"
          eq: "DEAL_CREATED"

```

Why this DSL works:

- It reads like a **product spec**
- It’s implementable by agents
- It creates a stable “conformance suite” you can grow over time

This is the same “reduce the problem to tests” insight Simon highlights. ([Simon Willison’s Weblog](https://simonwillison.net/2025/Dec/15/porting-justhtml/))

---

# 5) Decide what “comprehensive” means (so you can actually ship)

You don’t want 10,000 tests like a browser spec. But you do want enough that:

- a coding agent can build the app
- refactors are safe
- contributors can add features by adding tests

## A realistic target for v1

- **150–400 conformance tests** total
- organized into ~8 suites
- plus ~10 E2E UI smoke tests

That’s “comprehensive enough to ship” without turning enterprise.

---

# 6) What suites to write first (highest leverage)

Here’s the order I’d do it, because it maps to shipping milestones:

## Suite 0 — Smoke slice (Milestone 0.5)

Exactly like Simon’s “Milestone 0.5 — end-to-end smoke parse”. ([Simon Willison’s Weblog](https://simonwillison.net/2025/Dec/15/porting-justhtml/))

For you, smoke slice is:

- create deal
- upload a doc
- transition stage (guarded)
- audit log exists
- render one markdown template

✅ This should be 5–10 tests, and run in CI on every commit.

## Suite 1 — Stage machine conformance

- allowed transitions
- required fields per stage
- checklist generation per stage
- “reject/need-info/proceed/refer” outcomes

## Suite 2 — Audit log semantics

- every mutation produces an audit event
- audit event includes:
    - actor
    - timestamp
    - object type + id
    - changed fields + before/after
- stage transitions append to stage history

## Suite 3 — Template rendering

- given:
    - a markdown template (Obsidian style + frontmatter)
    - a deal snapshot
- expect:
    - markdown output matches snapshot
    - html export matches snapshot (or at least parses + contains key strings)

This is where snapshot testing shines.

## Suite 4 — Multi-entity graph invariants

- borrower group graph creation
- guarantor relationships
- group-level rollups (e.g., aggregated liquidity)
- permissions on entity visibility

## Suite 5 — Underwriting computations (deterministic)

- spread from known inputs
- ratios computed
- scenario adjustments
- output JSON exactly matches expected

Start from machine-readable fixtures (CSV/JSON), add PDF extraction later.

## Suite 6 — Covenants engine

- typed covenants
- test pass/fail outcomes
- grace periods
- waiver recording

## Suite 7 — Monitoring refresh + alerts (deterministic)

- ingest bank_txns.csv fixture
- compute liquidity, runway
- generate covenant test record
- emit alert events

## Suite 8 — Email ingest

- given `.eml` fixture with attachment
- system should:
    - create communication record
    - attach document
    - link to deal by token or subject key

---

# 7) How to treat AI in a conformance suite (so tests don’t become flaky)

This is a big one.

### Rule: conformance should not require non-deterministic LLM output

Otherwise your CI becomes probabilistic and your spec becomes unstable.

## Recommended approach: “AI optional, but interfaces mandatory”

### What you *do* specify and test

- The **AI tool interface** exists:
    - `/v1/ai/suggest-missing-docs`
    - `/v1/ai/draft-credit-memo`
    - `/v1/ai/extract-fields`
- The responses conform to **JSON Schema**
- The system stores AI outputs as:
    - `Artifact` (markdown)
    - `ProposedFieldChange[]` with confidence + citations
- The system never auto-applies changes without confirmation

### How to test it deterministically

You run conformance in **“AI replay mode”**:

- request goes in
- implementation loads a fixture response from `conformance/fixtures/ai_replays/...`
- returns deterministic output

So your spec still defines “AI features”, but CI doesn’t depend on a model.

This aligns with Drew’s warning about how hard it is to validate spec-only behavior across changing generation environments. ([Drew Breunig](https://www.dbreunig.com/2026/01/08/a-software-library-with-no-code.html))

---

# 8) Interfaces/APIs to lock early (so the test suite is a stable contract)

If you lock these, the rest is “implementation detail” agents can brute-force.

## Core resources

- `Deal`
- `Entity`
- `Relationship`
- `Document` + `DocumentVersion`
- `ChecklistItem`
- `AuditEvent`
- `DecisionLog`
- `Template` (from Git) + `RenderedArtifact`
- `FinancialSnapshot` / `Spread`
- `Covenant` + `CovenantTest` + `Waiver`

## Core endpoints (minimal set)

- Deals:
    - `POST /v1/deals`
    - `GET /v1/deals/:id`
    - `PATCH /v1/deals/:id`
    - `POST /v1/deals/:id/stage-transitions`
- Docs:
    - `POST /v1/deals/:id/documents`
    - `GET /v1/documents/:id/versions`
- Audit:
    - `GET /v1/deals/:id/audit`
- Templates:
    - `POST /v1/templates/render`
    - `GET /v1/deals/:id/artifacts`
- Underwriting / covenants:
    - `POST /v1/deals/:id/spread`
    - `POST /v1/deals/:id/covenants/test`
- Monitoring:
    - `POST /v1/deals/:id/monitoring/ingest` (for fixtures / generic imports)
    - `GET /v1/deals/:id/monitoring/status`

Everything else can come later.

---

# 9) CI loop design: “agentic loop ready”

Simon’s flow was:

1. write spec
2. implement a tiny smoke slice
3. add CI early
4. let agent run until tests pass ([Simon Willison’s Weblog](https://simonwillison.net/2025/Dec/15/porting-justhtml/))

You can copy that pattern directly.

## CI expectations for your repo

- `conformance:smoke` runs in < 1 minute
- `conformance:full` runs in < 10 minutes
- deterministic fixtures only
- no external network calls
- time is frozen in tests

---

# 10) The “INSTALL.md” prompt you want (copy/paste)

Model it after whenwords’ INSTALL.md idea. ([Drew Breunig](https://www.dbreunig.com/2026/01/08/a-software-library-with-no-code.html))

Example:

> Implement the Lending CRM server in TypeScript (Node).
> 
> 1. Read SPEC.md for all behavior.
> 2. Implement OpenAPI contract in openapi/v1.yaml.
> 3. Implement the conformance runner for conformance/cases/*.yaml.
> 4. All conformance tests must pass.
> 5. Use Postgres (or sqlite in test mode) and store audit events for all mutations.
> 6. Implement templates as Git-synced markdown with frontmatter.
> 7. Provide `npm test` that runs smoke then full.

That prompt becomes the “launcher” for brute-force AI coding.

---

# A good next step (very concrete)

If you want, I can draft **v0.1** of:

1. `SPEC.md` outline (only the normative “MUST/SHOULD” statements)
2. `openapi/v1.yaml` skeleton (just the core endpoints)
3. 10–15 **smoke + stage + audit** conformance tests in the YAML DSL

That’s the minimum package that lets you start the agentic loop and “ship by tests” without getting stuck in enterprise scope.