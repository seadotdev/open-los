# PRD: Deal Lifecycle Gap Analysis

**Status:** Draft
**Date:** 2026-02-20
**Author:** Auto-generated from codebase analysis

---

## 1. Purpose

This document maps the full deal lifecycle — from intake through terminal outcomes — against the current Open LOS implementation. Each stage is assessed for what exists, what is partially built, and what is missing entirely. The goal is to identify the gaps that prevent an end-to-end deal flow from working without manual workarounds.

---

## 2. Lifecycle Stages Assessed

| # | Stage | Coverage |
|---|-------|----------|
| 1 | Check inbox for new deals | Partial |
| 2 | Find deal, check if exists or needs updating | Partial |
| 3 | Approve deal for underwriting, connect open banking | Partial |
| 4 | Request additional information | Missing |
| 5 | Move deal to IC | Missing |
| 6 | Approve deal, generate loan closing docs | Partial |
| 7 | Signed deal, move to servicing | Partial |
| 8 | Review repayments and late payments | Partial |
| 9 | Redemption / delinquent / bankrupt | Partial |

---

## 3. Stage-by-Stage Analysis

### 3.1 Check Inbox for New Deals

**What a user expects:** Open a queue of inbound deal submissions (email, broker portal, API) triaged by urgency. See new deals that need attention, with attachments already parsed.

**What exists:**
- `EmailService` (`packages/core/src/services/email.ts`) ingests RFC 822 emails, parses headers/body/attachments, auto-links to deals via `[DEAL-XXXXX]` subject pattern.
- `communications` table stores emails with threading (`thread_id`), attachments stored as documents.
- API route `POST /v1/email/ingest` accepts raw `.eml` files or base64 payloads.

**What is missing:**

| Gap | Description | Priority |
|-----|-------------|----------|
| **No inbox/queue abstraction** | There is no concept of an inbox, task queue, or work items. A user cannot query "show me deals that need my attention." Emails land in `communications` but nothing surfaces them as actionable items. | P0 |
| **No notification system** | No push notifications, no webhook dispatching, no event bus. When a new email arrives with a deal reference, no one is notified. | P1 |
| **No unlinked email triage** | Emails without a `[DEAL-XXXXX]` subject tag get a `null` deal_id. There is no workflow to manually link orphaned emails to deals or create new deals from them. | P1 |
| **No broker portal / intake form** | New deals can only be created via `POST /v1/deals` API. There is no self-service intake form, no broker submission portal, no public-facing application flow. | P2 |
| **No email-to-deal auto-creation** | If an email arrives from an unknown sender with no deal reference, the system cannot auto-create a deal from it. The email just sits in `communications` with `deal_id: null`. | P2 |

---

### 3.2 Find a Deal and Check if It Exists or Needs Updating

**What a user expects:** Search for a borrower or deal, see if there is an existing active deal for that borrower, compare incoming data against what is on file, and flag what needs updating.

**What exists:**
- `DealService.list()` supports filtering by `stage` and cursor pagination.
- `DealService.getById()` retrieves a single deal.
- `EntityService` manages entities with `registration_number`, `lei`, and `identifiers` array for matching.
- `RelationshipService` tracks entity graphs (ownership, guarantees, directs).
- Deals track `borrower_registration_number` for basic matching.

**What is missing:**

| Gap | Description | Priority |
|-----|-------------|----------|
| **No deal deduplication / match check** | There is no API or service method that answers "does a deal already exist for this borrower?" You cannot search deals by `borrower_name` or `borrower_registration_number`. The `list()` method only filters by `stage`. | P0 |
| **No full-text or fuzzy search** | No search across deal fields, entity names, or document content. Finding a deal requires knowing its UUID or paging through the list. | P0 |
| **No diff/comparison view** | No mechanism to compare incoming deal data against existing data and highlight what changed. Updates are applied blindly via `PATCH /v1/deals/:id`. | P1 |
| **No "needs attention" flags** | No concept of stale deals, missing fields, or deals that have been sitting in a stage too long. No SLA tracking. | P1 |
| **No entity resolution** | While entities have `identifiers` and `registration_number`, there is no matching/resolution service that deduplicates entities across deals or links an incoming borrower to an existing entity record. | P2 |

---

### 3.3 Approve Deal for Underwriting, Connect Open Banking

**What a user expects:** Review the deal, approve it to proceed to underwriting. Connect the borrower's bank account via Open Banking to pull transaction data. Run initial financial analysis.

**What exists:**
- Stage transitions: `broker` -> `origination` -> `underwriting` with guards and role-based access (`packages/core/src/services/stage.ts`).
- `ApprovalService` (`packages/core/src/services/approval.ts`) supports `stage_transition`, `facility_approval`, and `covenant_waiver` approval types with pending/approved/rejected/cancelled workflow.
- `SpreadService` creates financial spreads from line items or direct metrics, computes ratios (DSCR, leverage, gross_margin, current_ratio, debt_to_equity, net_margin).
- `MonitoringService.ingest()` accepts bank transactions (JSON or CSV).
- `FacilityService` manages loan facilities (term_loan, revolver, letter_of_credit) with amounts, rates, terms.
- Stage guards enforce prerequisites: origination requires borrower_name, jurisdiction, requested_amount, purpose; underwriting requires `origination_outcome === "proceed"` and at least 1 document.

**What is missing:**

| Gap | Description | Priority |
|-----|-------------|----------|
| **No Open Banking integration** | Bank transaction ingestion is manual (CSV upload or JSON POST). There is no integration with Open Banking providers (Plaid, TrueLayer, Yapily, etc.) for automated account linking and transaction pulling. | P0 |
| **No underwriting decision model** | Spreads compute ratios but there is no scoring model, no risk rating, no automated pass/fail recommendation. The origination outcome is a free-text field set via `PATCH`. | P1 |
| **No credit check integration** | No integration with credit bureaus (Experian, Equifax, TransUnion) or company data providers (Companies House, D&B). | P1 |
| **No affordability / eligibility engine** | No rules engine that evaluates whether a deal meets lending criteria before proceeding to underwriting. Stage guards check data completeness, not financial eligibility. | P2 |

---

### 3.4 Request Additional Information

**What a user expects:** Flag that a deal is missing information. Send a structured request to the borrower/broker. Track what was asked, when, and whether it was received. Block deal progression until info is provided.

**What exists:**
- `communications` table can store notes and emails.
- `documents` table tracks uploaded files.
- Audit events record all changes.

**What is missing:**

| Gap | Description | Priority |
|-----|-------------|----------|
| **No information request workflow** | There is no concept of an "information request" — no table, no service, no API. A user cannot formally request information from a borrower and track whether it was fulfilled. | P0 |
| **No request templates** | No predefined templates for common information requests (e.g., "please provide 3 years of audited accounts"). The `TemplateService` exists for document generation but not for outbound requests. | P1 |
| **No borrower-facing portal** | No way for borrowers to receive and respond to information requests. All communication is one-way (ingest emails). | P1 |
| **No conditional stage blocking** | While stage guards check data completeness, there is no mechanism to say "this deal is blocked pending information request #X" and auto-unblock when the info arrives. | P1 |
| **No outbound email** | `EmailService` only ingests inbound emails. There is no outbound email capability — no SMTP integration, no send endpoint. | P2 |

---

### 3.5 Move Deal to IC (Investment Committee)

**What a user expects:** Package the deal for Investment Committee review. Generate an IC memo. Track committee members' votes. Record the IC decision with conditions.

**What exists:**
- The stage pipeline is: `broker` -> `origination` -> `underwriting` -> `closing` -> `monitoring`.
- `TemplateService` and `ArtifactService` can generate documents (IC memos could be rendered from templates).
- `ApprovalService` supports approval requests with pending/approved/rejected states.

**What is missing:**

| Gap | Description | Priority |
|-----|-------------|----------|
| **No IC stage in pipeline** | The stage machine has no `ic_review` stage. Deals go directly from `underwriting` to `closing`. There is no place in the workflow for IC review. | P0 |
| **No committee voting** | `ApprovalService` supports single-approver decisions. There is no multi-approver voting (e.g., 3 of 5 committee members must approve). No quorum logic. | P0 |
| **No IC memo generation** | While templates and artifacts exist, there are no IC-specific templates. No automated aggregation of deal data, spreads, ratios, and risk assessment into a memo format. | P1 |
| **No conditional approval** | The approval model is binary (approved/rejected). There is no "approved with conditions" state — no way to attach conditions that must be satisfied before closing. | P1 |
| **No committee scheduling** | No concept of IC meeting dates, agenda management, or deal queueing for the next committee session. | P2 |

---

### 3.6 Approve Deal, Generate Loan Closing Docs

**What a user expects:** After IC approval, generate the closing document package (loan agreement, security documents, board resolutions). Track the document checklist. Prepare for signing.

**What exists:**
- `TemplateService` manages Handlebars templates. `ArtifactService` renders templates into frozen markdown artifacts.
- `DocumentService` manages document uploads with versioning, checksums, and phase tagging.
- `FacilityService` captures loan terms (type, amount, rate, term).
- `loan-integration.ts` provides `createLoanAccountFromFacility()` and `createApprovedLoanFromFacility()` to create loan accounts from approved facilities.

**What is missing:**

| Gap | Description | Priority |
|-----|-------------|----------|
| **No closing document package** | No predefined closing document checklist. No automated generation of loan agreements, security documents, guarantees, board resolutions. Templates exist but no closing-specific templates are defined. | P0 |
| **No closing checklist workflow** | No structured checklist for closing conditions (e.g., "security registered", "insurance confirmed", "board resolution received"). The `closing` stage guard only checks `deal_in_underwriting`. | P1 |
| **No document signing integration** | No integration with e-signature platforms (DocuSign, Adobe Sign, HelloSign). Documents are uploaded and stored but there is no signing workflow. | P1 |
| **No conditions precedent tracking** | No table or service to track conditions precedent (CPs) and conditions subsequent (CSs) — the specific items that must be satisfied before and after closing. | P1 |
| **No counterparty document exchange** | No mechanism to share documents with borrowers or external counsel for review and execution. | P2 |

---

### 3.7 Signed Deal, Move to Servicing

**What a user expects:** Once all documents are signed, activate the loan. Disburse funds. Transition the deal from origination to servicing/monitoring.

**What exists:**
- `closing` -> `monitoring` stage transition exists.
- `LoanAccountService` provides a full Mambu-compatible loan ledger with states: `PENDING_APPROVAL` -> `APPROVED` -> `ACTIVE` -> `CLOSED`.
- Disbursement workflow: `LoanAccountService.disburse()` moves account to `ACTIVE`, records principal, generates repayment schedule.
- Facility-to-loan integration creates loan accounts from approved facilities.
- Repayment schedule auto-generated on first disbursement (supports equal installments, balloon, interest-only; monthly/quarterly/annually).

**What is missing:**

| Gap | Description | Priority |
|-----|-------------|----------|
| **No "signed" confirmation step** | No mechanism to record that all documents have been signed. The stage transition from `closing` to `monitoring` has no guard checking that signing is complete. | P1 |
| **No disbursement authorization workflow** | Disbursement is a direct API call. No multi-approval workflow for fund release (e.g., "maker-checker" for payments). | P1 |
| **No payment integration** | Disbursement records a ledger entry but does not trigger an actual payment. No integration with banking rails (FPS, BACS, SWIFT, ACH). | P1 |
| **No servicing handoff** | The `monitoring` stage conflates ongoing monitoring with loan servicing. No distinct servicing team assignment, no servicing onboarding checklist. | P2 |

---

### 3.8 Review Repayments and Late Payments

**What a user expects:** See a dashboard of all active loans. Track repayments against schedule. Get alerted when payments are late. Manage collections for overdue accounts.

**What exists:**
- `LoanAccountService.repay()` processes repayments with automatic allocation (penalties -> fees -> interest -> principal) or custom allocation.
- `repayment_schedule` table tracks each installment: due date, amounts due/paid, state (PENDING / PARTIALLY_PAID / PAID / LATE / GRACE_PERIOD).
- `LoanAccountService.checkArrears()` computes arrears status (days in arrears, overdue amount, overdue installments).
- `LoanAccountService.updateArrearsStatus()` transitions accounts between `ACTIVE` and `ACTIVE_IN_ARREARS`.
- `MonitoringService.getStatus()` returns liquidity, alerts, and covenant status.
- Alert types: `covenant_breach`, `liquidity_warning`, `data_gap`, `payment_missed`.
- Covenant testing with grace periods, waivers, and automated breach detection.

**What is missing:**

| Gap | Description | Priority |
|-----|-------------|----------|
| **No repayment dashboard / portfolio view** | No API endpoint to get an aggregate view across all loans (total outstanding, total overdue, repayments due this week). `loans:search` exists but cross-account transaction search returns 501. | P0 |
| **No late payment notifications** | Alerts are generated and stored in the `alerts` table but never dispatched. No email, SMS, or webhook notification when a payment is missed. | P0 |
| **No collections workflow** | When a loan enters `ACTIVE_IN_ARREARS`, there is no escalation path. No collections task assignment, no dunning letter generation, no call scheduling. | P1 |
| **No automated arrears sweep** | `updateArrearsStatus()` must be called per-account via API. There is no batch job or scheduler that sweeps all active loans daily to update arrears status. | P1 |
| **No payment matching** | Repayments are manually posted via API. No mechanism to match incoming bank payments to loan accounts (auto-reconciliation). | P2 |

---

### 3.9 Redemption / Delinquent / Bankrupt

**What a user expects:** Handle terminal outcomes: borrower pays off early (redemption), borrower falls seriously behind (delinquency classification), borrower enters insolvency. Each has different workflows, fees, and reporting requirements.

**What exists:**
- Loan close sub-states: `PAID_OFF`, `WRITTEN_OFF`, `REFINANCED`, `RESCHEDULED`, `WITHDRAWN`, `REJECTED`.
- `LoanAccountService.writeOff()` writes off all outstanding balances and closes the account.
- `LoanAccountService.close()` supports all sub-states.
- `LOCKED` state exists for accounts under investigation.
- Arrears tracking with `days_in_arrears` and `arrears_since` fields.
- `checkDealArrearsStatus()` aggregates arrears across all loans for a deal.

**What is missing:**

| Gap | Description | Priority |
|-----|-------------|----------|
| **No delinquency classification ladder** | No 30/60/90/120+ day delinquency buckets. No automatic reclassification as arrears age. No provisioning calculation. | P0 |
| **No early redemption / prepayment workflow** | No calculation of prepayment penalties, breakage costs, or exit fees. `close(PAID_OFF)` zeroes balances without computing any early redemption charges. | P1 |
| **No bankruptcy / insolvency handling** | No borrower-level insolvency status. No mechanism to freeze all deals for a bankrupt entity. No proof-of-debt generation. No creditor meeting tracking. | P1 |
| **No workout / restructuring flow** | While `RESCHEDULED` exists as a sub-state, there is no workflow to restructure loan terms (extend maturity, reduce rate, capitalize arrears) and generate a new schedule. | P1 |
| **No recovery tracking** | After write-off, no mechanism to track partial recoveries or debt sales. Once written off, the account is terminal. | P2 |
| **No regulatory reporting** | No generation of regulatory reports (arrears reports, provisioning schedules, NPL reporting). No FCA/PRA reporting templates. | P2 |

---

## 4. Cross-Cutting Gaps

These gaps affect multiple lifecycle stages:

| Gap | Description | Stages Affected | Priority |
|-----|-------------|----------------|----------|
| **No user/auth system** | All endpoints use `X-Actor` header for identity. No authentication, no sessions, no role management beyond hardcoded `TRANSITION_ROLES`. | All | P0 |
| **No task/work queue** | No concept of tasks, assignments, or work items. Deals have `assigned_to` but there is no task management layer. | 1, 4, 5, 8 | P0 |
| **No event bus / webhooks** | All operations are synchronous request-response. No event publishing, no webhook dispatch, no async workflows. | 1, 4, 7, 8 | P0 |
| **No scheduler / batch jobs** | No cron jobs, no batch processing. Arrears updates, covenant testing, and interest accrual all require manual API calls. | 8, 9 | P1 |
| **No frontend** | `frontend/` contains placeholder `app.js` files. No UI exists. All interaction is API-only or CLI. | All | P1 |
| **No multi-tenancy enforcement** | `tenant_id` exists on most tables but tenant isolation is enforced only by convention (passing header). No middleware enforcing tenant boundaries. | All | P1 |
| **No file storage** | Documents are stored as BLOBs in SQLite. No object storage integration (S3, GCS, Azure Blob). | 1, 4, 6 | P2 |
| **No reporting / analytics** | No aggregate queries, no dashboards, no export capabilities beyond raw API responses. | 5, 8, 9 | P2 |

---

## 5. Recommended Implementation Order

Based on what blocks the most user journeys:

### Phase 1: Core Deal Flow (unblocks stages 1-5)

1. **Deal search and deduplication** — Add borrower search, fuzzy matching, entity resolution.
2. **Inbox / work queue** — Task abstraction over deals, emails, and approval requests. "Show me what needs my attention."
3. **Information request workflow** — Table, service, API for requesting and tracking outstanding information from borrowers.
4. **IC stage and committee voting** — Add `ic_review` stage, multi-approver voting with quorum, conditional approvals.
5. **Open Banking integration** — Plaid/TrueLayer adapter for automated bank data pull.

### Phase 2: Closing and Servicing (unblocks stages 6-7)

6. **Closing document package** — Templates for loan agreements, closing checklists, conditions precedent/subsequent tracking.
7. **Document signing integration** — DocuSign/Adobe Sign adapter for e-signature workflows.
8. **Disbursement authorization** — Maker-checker workflow for fund release.
9. **Notification system** — Email dispatch (outbound SMTP), webhook delivery, in-app notification queue.

### Phase 3: Portfolio Management (unblocks stages 8-9)

10. **Automated arrears sweep** — Batch job to update all loan arrears status daily.
11. **Delinquency classification** — 30/60/90/120+ buckets with auto-reclassification and provisioning.
12. **Portfolio dashboard API** — Aggregate endpoints for total outstanding, overdue, repayments due.
13. **Collections workflow** — Escalation paths, dunning letters, task assignment for overdue accounts.
14. **Early redemption** — Prepayment penalty calculator, breakage cost computation, redemption statement generation.

### Phase 4: Operational Maturity

15. **User authentication and RBAC** — Replace `X-Actor` header with proper auth. Role-based access control.
16. **Event bus and webhooks** — Publish domain events, deliver webhooks to external systems.
17. **Regulatory reporting** — Arrears reports, provisioning schedules, NPL reporting.
18. **Frontend** — Build UI for deal management, portfolio monitoring, inbox.

---

## 6. Current Architecture Strengths

The existing codebase provides a solid foundation:

- **Clean service layer separation** — Each domain (deals, stages, approvals, monitoring, loans) has its own service with clear boundaries.
- **Full audit trail** — Every mutation records an audit event with actor, timestamp, and change details.
- **Stage machine with guards** — Transitions are validated with configurable guards and role-based permissions. Overrides require credit_lead role and rationale.
- **Mambu-compatible loan ledger** — The loan account and transaction model closely follows Mambu's API patterns, making future migration/integration straightforward.
- **Idempotent financial operations** — Disbursements, repayments, and fees support idempotency keys to prevent duplicates.
- **Covenant testing framework** — Automated covenant testing with grace periods, waivers, and multiple metric types.
- **OpenAPI spec** — `openapi/v1.yaml` documents the API contract.
- **Conformance test suite** — `packages/conformance/` has test coverage across major features.

---

## 7. Summary

The system covers the **middle** of the deal lifecycle well — the plumbing for stage transitions, underwriting spreads, facility management, loan servicing, and covenant monitoring is solid. The primary gaps are at the **edges**: intake/triage (how deals enter the system), collaboration (how people request and share information), decision governance (IC review and multi-party approvals), closing execution (document generation and signing), and terminal outcomes (delinquency classification, restructuring, bankruptcy). Addressing these gaps in the order described above would progressively unlock complete end-to-end deal workflows.
