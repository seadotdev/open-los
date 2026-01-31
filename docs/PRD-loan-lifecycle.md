# Product Requirements Document: Loan Lifecycle Management

**Version:** 1.0
**Date:** 2026-01-31
**Status:** Draft

---

## Executive Summary

This PRD documents the complete loan lifecycle from broker introduction through monitoring, including jobs to be done at each stage, current implementation status, and gap analysis. The Open LOS platform is a specification-driven B2B lending CRM with a conformance test suite that defines system behavior.

---

## Table of Contents

1. [Overview](#overview)
2. [Stage 1: Broker Introduction](#stage-1-broker-introduction)
3. [Stage 2: Loan Origination](#stage-2-loan-origination)
4. [Stage 3: Underwriting](#stage-3-underwriting)
5. [Stage 4: Loan Closing](#stage-4-loan-closing)
6. [Stage 5: Loan Monitoring](#stage-5-loan-monitoring)
7. [Cross-Cutting Concerns](#cross-cutting-concerns)
8. [Gap Analysis Summary](#gap-analysis-summary)
9. [Implementation Priorities](#implementation-priorities)

---

## Overview

### Loan Lifecycle Stages

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   BROKER    │───▶│ ORIGINATION │───▶│ UNDERWRITING│───▶│   CLOSING   │───▶│  MONITORING │
│ Introduction│    │             │    │             │    │             │    │             │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### Technology Stack

- **Backend:** TypeScript/Node.js with Hono framework
- **Database:** SQLite with Drizzle ORM
- **Architecture:** Monorepo with `@open-los/core` (business logic) and `@open-los/api` (HTTP layer)

---

## Stage 1: Broker Introduction

### Purpose
Inbound deal intake portal where brokers submit deals with minimal information and required documents.

### Jobs to be Done

| ID | Job to be Done | User Story | Priority |
|----|----------------|------------|----------|
| B-01 | Submit new loan application | As a broker, I need to submit a new loan application with basic borrower information | P0 |
| B-02 | Upload supporting documents | As a broker, I need to upload supporting documents (tax returns, financials, ID) | P0 |
| B-03 | Track application status | As a broker, I need to see the status of my submitted applications | P1 |
| B-04 | Receive submission confirmation | As a broker, I need confirmation that my application was received | P1 |
| B-05 | Submit via email | As a broker, I need to submit documents via email attachment | P1 |
| B-06 | Edit submitted application | As a broker, I need to update/correct application details before review | P1 |
| B-07 | View document checklist | As a broker, I need to see what documents are required vs submitted | P2 |
| B-08 | Broker portal login | As a broker, I need a secure login to access my applications | P1 |
| B-09 | Broker onboarding/registration | As a new broker, I need to register and get approved to submit deals | P1 |
| B-10 | View broker commission info | As a broker, I need to see commission structure and tracking | P2 |

### Current Implementation

| Feature | Status | Files | Notes |
|---------|--------|-------|-------|
| Create deal with basic info | ✅ Implemented | `services/deal.ts` | borrower_name, jurisdiction, requested_amount, purpose |
| Document upload | ✅ Implemented | `services/document.ts` | PDF, CSV, images supported |
| Document versioning | ✅ Implemented | `services/document.ts` | Version tracking, checksums |
| Email ingestion | ✅ Implemented | `services/email.ts` | .eml parsing, attachment extraction |
| Deal listing/filtering | ✅ Implemented | `services/deal.ts` | Cursor pagination, stage filtering |
| Stage guards validation | ✅ Implemented | `services/stage.ts` | Required fields checked |
| Audit trail | ✅ Implemented | `services/audit.ts` | Immutable event logging |

### Gap Analysis

| Gap ID | Missing Feature | Impact | Effort |
|--------|-----------------|--------|--------|
| B-GAP-01 | **Broker portal/UI** | Brokers cannot self-service; no frontend exists | High | Large |
| B-GAP-02 | **Broker authentication/registration** | No broker user management or onboarding | High | Medium |
| B-GAP-03 | **Document checklist per deal type** | No configurable required document lists | Medium | Small |
| B-GAP-04 | **Submission notifications** | No email/SMS confirmation to brokers | Medium | Small |
| B-GAP-05 | **Broker dashboard** | No visibility into application pipeline | Medium | Medium |
| B-GAP-06 | **Document preview** | Cannot preview uploaded documents in-app | Low | Medium |
| B-GAP-07 | **Broker commission tracking** | No commission calculation or tracking | Low | Medium |
| B-GAP-08 | **OCR/Document parsing** | Manual data entry; no automatic extraction | Medium | Large |
| B-GAP-09 | **Duplicate detection** | No check for duplicate applications | Medium | Small |
| B-GAP-10 | **Broker rating/scoring** | No broker performance tracking | Low | Medium |

---

## Stage 2: Loan Origination

### Purpose
Internal pipeline management where loan officers qualify or disqualify deals, track communications, and set origination outcomes.

### Jobs to be Done

| ID | Job to be Done | User Story | Priority |
|----|----------------|------------|----------|
| O-01 | Review incoming applications | As an originator, I need to review broker-submitted applications | P0 |
| O-02 | Qualify/disqualify deals | As an originator, I need to mark deals as proceed or decline | P0 |
| O-03 | Advance deals to underwriting | As an originator, I need to move qualified deals to underwriting | P0 |
| O-04 | Record decline reasons | As an originator, I need to document why deals were declined | P1 |
| O-05 | Request additional documents | As an originator, I need to request missing documents from brokers | P1 |
| O-06 | Track communication history | As an originator, I need to see all communications for a deal | P1 |
| O-07 | Assign deals to underwriters | As an originator, I need to assign qualified deals to specific underwriters | P1 |
| O-08 | Override stage guards | As a credit lead, I need to override guards with documented rationale | P1 |
| O-09 | View origination pipeline | As an originator, I need a dashboard of my deals by status | P1 |
| O-10 | Set deal priority | As an originator, I need to flag high-priority deals | P2 |
| O-11 | Preliminary credit check | As an originator, I need to run preliminary credit/background checks | P1 |
| O-12 | SLA tracking | As a manager, I need to track time deals spend in each stage | P2 |

### Current Implementation

| Feature | Status | Files | Notes |
|---------|--------|-------|-------|
| Stage transitions | ✅ Implemented | `services/stage.ts` | broker→origination→underwriting |
| Origination outcome | ✅ Implemented | `routes/deals.ts` | proceed/decline flag |
| Role-based permissions | ✅ Implemented | `services/stage.ts` | originator, credit_lead roles |
| Override mechanism | ✅ Implemented | `services/stage.ts` | Requires rationale |
| Transition history | ✅ Implemented | `services/stage.ts` | Checklist snapshots stored |
| Stage guards | ✅ Implemented | `services/stage.ts` | Outcome + document requirements |

### Gap Analysis

| Gap ID | Missing Feature | Impact | Effort |
|--------|-----------------|--------|--------|
| O-GAP-01 | **Decline reason capture** | No structured decline reason tracking | Medium | Small |
| O-GAP-02 | **Document request workflow** | Cannot formally request documents from brokers | High | Medium |
| O-GAP-03 | **Communication logging** | No phone call/meeting notes tracking | Medium | Small |
| O-GAP-04 | **Deal assignment** | No assignment of deals to specific users | Medium | Small |
| O-GAP-05 | **Pipeline dashboard/UI** | No visual pipeline management interface | High | Large |
| O-GAP-06 | **Priority/flagging** | No deal priority or flag system | Low | Small |
| O-GAP-07 | **Credit bureau integration** | No automated credit check integration | Medium | Large |
| O-GAP-08 | **SLA/timer tracking** | No tracking of stage duration or SLA breaches | Medium | Medium |
| O-GAP-09 | **Notification system** | No alerts when deals require action | Medium | Medium |
| O-GAP-10 | **Bulk operations** | Cannot perform operations on multiple deals | Low | Small |
| O-GAP-11 | **Deal notes/comments** | No internal notes or comments on deals | Medium | Small |
| O-GAP-12 | **Origination workflow rules** | No configurable auto-routing or rules engine | Medium | Large |

---

## Stage 3: Underwriting

### Purpose
Deep financial analysis including spreads, ratio computation, covenant setup, and multi-entity analysis to determine creditworthiness and loan terms.

### Jobs to be Done

| ID | Job to be Done | User Story | Priority |
|----|----------------|------------|----------|
| U-01 | Create financial spreads | As an underwriter, I need to input/upload financial statements | P0 |
| U-02 | Compute financial ratios | As an underwriter, I need automatic ratio calculations (DSCR, leverage, etc.) | P0 |
| U-03 | Define covenants | As an underwriter, I need to set up loan covenants with thresholds | P0 |
| U-04 | Test covenants | As an underwriter, I need to test proposed covenants against historicals | P0 |
| U-05 | Multi-entity analysis | As an underwriter, I need to analyze borrower groups and guarantors | P1 |
| U-06 | Generate term sheet | As an underwriter, I need to produce a term sheet document | P1 |
| U-07 | Create credit memo | As an underwriter, I need to create a credit memo for approval | P1 |
| U-08 | Industry comparison | As an underwriter, I need to compare metrics against industry benchmarks | P2 |
| U-09 | Trend analysis | As an underwriter, I need to see multi-period trends in financials | P1 |
| U-10 | Scenario modeling | As an underwriter, I need to model different scenarios (base/stress) | P2 |
| U-11 | Collateral valuation | As an underwriter, I need to assess and document collateral | P1 |
| U-12 | Risk rating assignment | As an underwriter, I need to assign a risk rating to the deal | P1 |
| U-13 | Approval workflow | As an underwriter, I need credit committee approval | P1 |
| U-14 | Underwriting checklist | As an underwriter, I need a checklist of required analyses | P2 |

### Current Implementation

| Feature | Status | Files | Notes |
|---------|--------|-------|-------|
| Financial spreads | ✅ Implemented | `services/spread.ts` | Line items and direct metrics |
| Ratio computation | ✅ Implemented | `services/spread.ts` | 6 ratios: current_ratio, debt_to_equity, dscr, gross_margin, net_margin, leverage |
| Covenant creation | ✅ Implemented | `services/covenant.ts` | Financial, reporting, information types |
| Covenant testing | ✅ Implemented | `services/covenant.ts` | Pass/fail/warning/grace_period/waived |
| Entity management | ✅ Implemented | `services/entity.ts` | Company/person with identifiers |
| Relationship graphing | ✅ Implemented | `services/relationship.ts` | owns, guarantees, directs |
| Borrower group detection | ✅ Implemented | `services/entity.ts` | Graph traversal |
| Template rendering | ✅ Implemented | `services/template.ts` | Markdown to HTML |
| Artifact freezing | ✅ Implemented | `services/artifact.ts` | Term sheet/credit memo snapshots |
| CSV spread upload | ✅ Implemented | `routes/underwriting.ts` | Multipart CSV support |
| Multi-period spreads | ✅ Implemented | `services/spread.ts` | Period-based storage |
| Grace periods | ✅ Implemented | `services/covenant.ts` | grace_period_days field |
| Waivers | ✅ Implemented | `services/covenant.ts` | Waiver creation and tracking |

### Gap Analysis

| Gap ID | Missing Feature | Impact | Effort |
|--------|-----------------|--------|--------|
| U-GAP-01 | **Industry benchmarks** | No comparison against market/industry data | Medium | Large |
| U-GAP-02 | **Trend visualization** | No charts/graphs for multi-period analysis | Medium | Medium |
| U-GAP-03 | **Scenario modeling** | No stress testing or scenario analysis | Medium | Large |
| U-GAP-04 | **Collateral management** | No collateral tracking or valuation module | High | Medium |
| U-GAP-05 | **Risk rating system** | No credit risk scoring or rating framework | High | Medium |
| U-GAP-06 | **Credit committee workflow** | No formal approval routing for credit decisions | Medium | Medium |
| U-GAP-07 | **Additional ratios** | Limited to 6 ratios; may need more | Low | Small |
| U-GAP-08 | **Automated spreading** | No OCR/parsing of financial statements | Medium | Large |
| U-GAP-09 | **Underwriting checklist** | No configurable analysis checklist | Low | Small |
| U-GAP-10 | **Peer analysis** | No comparison with similar deals in portfolio | Low | Medium |
| U-GAP-11 | **Cash flow analysis** | Limited cash flow statement support | Medium | Medium |
| U-GAP-12 | **UCC/Lien search integration** | No integration with lien search services | Medium | Large |
| U-GAP-13 | **KYC/AML checks** | No automated compliance checking | High | Large |
| U-GAP-14 | **Environmental/ESG screening** | No ESG risk assessment | Low | Medium |

---

## Stage 4: Loan Closing

### Purpose
Document finalization, facility structuring, approval workflows, loan account creation, and transition to servicing.

### Jobs to be Done

| ID | Job to be Done | User Story | Priority |
|----|----------------|------------|----------|
| C-01 | Define loan facilities | As a closer, I need to structure term loans, revolvers, LCs | P0 |
| C-02 | Create loan accounts | As a closer, I need to create loan accounts from approved facilities | P0 |
| C-03 | Execute disbursements | As a closer, I need to disburse funds to borrower | P0 |
| C-04 | Facility approval workflow | As a closer, I need manager approval for facility terms | P1 |
| C-05 | Generate loan documents | As a closer, I need to produce loan agreements, notes, security docs | P1 |
| C-06 | Manage conditions precedent | As a closer, I need to track closing conditions and satisfaction | P1 |
| C-07 | Record fee collection | As a closer, I need to record origination/closing fees | P1 |
| C-08 | Fund source management | As a closer, I need to track funding sources and allocations | P2 |
| C-09 | Closing checklist | As a closer, I need a checklist of closing requirements | P1 |
| C-10 | Legal document execution | As a closer, I need to track signature collection | P1 |
| C-11 | Escrow management | As a closer, I need to manage escrow accounts if applicable | P2 |
| C-12 | Transition to servicing | As a closer, I need to hand off to monitoring with complete data | P0 |
| C-13 | Loan booking | As a closer, I need to book the loan in the system of record | P0 |
| C-14 | Disbursement scheduling | As a closer, I need to schedule future disbursements | P2 |

### Current Implementation

| Feature | Status | Files | Notes |
|---------|--------|-------|-------|
| Facility creation | ✅ Implemented | `services/facility.ts` | term_loan, revolver, letter_of_credit |
| Facility status management | ✅ Implemented | `services/facility.ts` | proposed→approved→active→closed |
| Loan account creation | ✅ Implemented | `services/loan-account.ts` | From entity with facility reference |
| Loan state machine | ✅ Implemented | `services/loan-account.ts` | PENDING_APPROVAL→APPROVED→ACTIVE→... |
| Disbursement transactions | ✅ Implemented | `services/loan-account.ts` | With balance updates |
| Fee application | ✅ Implemented | `services/loan-account.ts` | Fee transaction type |
| Approval workflow | ✅ Implemented | `services/approval.ts` | Stage, facility, waiver approvals |
| Balance tracking | ✅ Implemented | `services/loan-account.ts` | Principal, interest, fees, penalties |
| Idempotent transactions | ✅ Implemented | `services/loan-account.ts` | Idempotency-Key header |
| Account ID generation | ✅ Implemented | `services/loan-account.ts` | LN-00001 format |
| Mambu compatibility | ✅ Implemented | `services/loan-account.ts` | encoded_key UUID |

### Gap Analysis

| Gap ID | Missing Feature | Impact | Effort |
|--------|-----------------|--------|--------|
| C-GAP-01 | **Loan document generation** | No automated loan agreement generation | High | Large |
| C-GAP-02 | **Conditions precedent tracking** | No CP checklist or satisfaction workflow | High | Medium |
| C-GAP-03 | **E-signature integration** | No DocuSign/HelloSign integration | Medium | Medium |
| C-GAP-04 | **Closing checklist** | No configurable closing requirements | Medium | Small |
| C-GAP-05 | **Funding source tracking** | No tracking of where funds come from | Medium | Medium |
| C-GAP-06 | **Multi-tranche facilities** | Limited support for complex structures | Medium | Medium |
| C-GAP-07 | **Escrow accounts** | No escrow management functionality | Low | Medium |
| C-GAP-08 | **Wire transfer integration** | No integration with payment systems | Medium | Large |
| C-GAP-09 | **Disbursement schedule** | No scheduled future disbursements | Medium | Medium |
| C-GAP-10 | **UCC filing tracking** | No UCC filing status tracking | Medium | Small |
| C-GAP-11 | **Insurance tracking** | No insurance certificate management | Medium | Small |
| C-GAP-12 | **Title/recording tracking** | No real estate recording tracking | Low | Small |
| C-GAP-13 | **Syndication support** | No participant/syndication management | Low | Large |
| C-GAP-14 | **Core banking integration** | No integration with external LOS/core banking | Medium | Large |

---

## Stage 5: Loan Monitoring

### Purpose
Ongoing loan servicing including payment collection, transaction monitoring, covenant compliance, and portfolio management.

### Jobs to be Done

| ID | Job to be Done | User Story | Priority |
|----|----------------|------------|----------|
| M-01 | Track loan payments | As a monitor, I need to record and track loan payments | P0 |
| M-02 | Monitor covenant compliance | As a monitor, I need to test covenants each period | P0 |
| M-03 | Ingest bank transactions | As a monitor, I need to import borrower bank transactions | P0 |
| M-04 | Calculate liquidity metrics | As a monitor, I need to see borrower liquidity/runway | P0 |
| M-05 | Generate alerts | As a monitor, I need alerts for covenant breaches, missed payments | P0 |
| M-06 | Apply interest charges | As a monitor, I need to accrue and apply interest | P0 |
| M-07 | Handle arrears | As a monitor, I need to manage loans in arrears | P1 |
| M-08 | Process covenant waivers | As a monitor, I need to request/approve covenant waivers | P1 |
| M-09 | Portfolio reporting | As a manager, I need portfolio-level reports and analytics | P1 |
| M-10 | Risk migration tracking | As a manager, I need to track risk rating changes | P2 |
| M-11 | Maturity management | As a monitor, I need to track upcoming maturities | P1 |
| M-12 | Renewal/extension workflow | As a monitor, I need to process loan renewals | P2 |
| M-13 | Modification workflow | As a monitor, I need to process loan modifications | P2 |
| M-14 | Collections workflow | As a monitor, I need to manage delinquent accounts | P1 |
| M-15 | Financial statement collection | As a monitor, I need to collect and spread periodic financials | P1 |
| M-16 | Borrower communication | As a monitor, I need to send payment reminders, notices | P2 |
| M-17 | Write-off processing | As a monitor, I need to process charge-offs/write-offs | P1 |
| M-18 | Payoff processing | As a monitor, I need to process loan payoffs | P1 |

### Current Implementation

| Feature | Status | Files | Notes |
|---------|--------|-------|-------|
| Payment (repayment) processing | ✅ Implemented | `services/loan-account.ts` | Principal/interest/fee allocation |
| Transaction ingestion | ✅ Implemented | `services/monitoring.ts` | JSON and CSV formats |
| Liquidity calculation | ✅ Implemented | `services/monitoring.ts` | Balance, burn rate, runway |
| Covenant testing | ✅ Implemented | `services/covenant.ts` | Against latest spread |
| Alert generation | ✅ Implemented | `services/monitoring.ts` | covenant_breach, liquidity_warning, data_gap, payment_missed |
| Interest application | ✅ Implemented | `services/loan-account.ts` | INTEREST_APPLIED transaction |
| Arrears detection | ✅ Implemented | `services/loan-account.ts` | ACTIVE_IN_ARREARS state |
| Waiver management | ✅ Implemented | `services/covenant.ts` | Waiver creation and approval |
| Write-off processing | ✅ Implemented | `services/loan-account.ts` | WRITE_OFF transaction |
| Penalty application | ✅ Implemented | `services/loan-account.ts` | PENALTY_APPLIED transaction |
| Loan search | ✅ Implemented | `services/loan-account.ts` | EQUALS, IN, BETWEEN filters |
| Account locking | ✅ Implemented | `services/loan-account.ts` | LOCK/UNLOCK transitions |
| Custom payment allocation | ✅ Implemented | `services/loan-account.ts` | Override default allocation |

### Gap Analysis

| Gap ID | Missing Feature | Impact | Effort |
|--------|-----------------|--------|--------|
| M-GAP-01 | **Interest accrual engine** | No automatic daily interest accrual | High | Large |
| M-GAP-02 | **Payment schedule generation** | No amortization schedule generation | High | Medium |
| M-GAP-03 | **Portfolio reporting** | No aggregate portfolio analytics/reports | Medium | Medium |
| M-GAP-04 | **Maturity calendar** | No maturity tracking or alerts | Medium | Small |
| M-GAP-05 | **Modification workflow** | No structured loan modification process | Medium | Medium |
| M-GAP-06 | **Renewal workflow** | No renewal/extension processing | Medium | Medium |
| M-GAP-07 | **Collections workflow** | No collections queue or workflow | Medium | Medium |
| M-GAP-08 | **Payment reminders** | No automated borrower notifications | Medium | Small |
| M-GAP-09 | **Bank feed integration** | Must manually upload; no Plaid/Yodlee | Medium | Large |
| M-GAP-10 | **Reporting period management** | No structured financial reporting periods | Low | Small |
| M-GAP-11 | **Risk rating updates** | No risk rating migration workflow | Medium | Medium |
| M-GAP-12 | **GL/accounting integration** | No general ledger postings | Medium | Large |
| M-GAP-13 | **Regulatory reporting** | No Call Report or regulatory data export | Medium | Large |
| M-GAP-14 | **Watch list management** | No watch list or criticized asset tracking | Medium | Medium |
| M-GAP-15 | **Participation accounting** | No syndication/participation tracking | Low | Large |
| M-GAP-16 | **ACH/auto-debit** | No automatic payment collection | Medium | Large |

---

## Cross-Cutting Concerns

### Authentication & Authorization

| Gap ID | Missing Feature | Impact | Effort |
|--------|-----------------|--------|--------|
| X-GAP-01 | **User authentication** | No login/session management | Critical | Medium |
| X-GAP-02 | **Role-based access control** | Roles defined but not enforced via auth | High | Medium |
| X-GAP-03 | **SSO/SAML integration** | No enterprise SSO | Medium | Medium |
| X-GAP-04 | **API key management** | No API key auth for integrations | Medium | Small |
| X-GAP-05 | **Audit user tracking** | Actor field exists but no auth to populate | High | Small |

### User Interface

| Gap ID | Missing Feature | Impact | Effort |
|--------|-----------------|--------|--------|
| X-GAP-06 | **Web application frontend** | No UI; API-only | Critical | Large |
| X-GAP-07 | **Mobile application** | No mobile access | Low | Large |
| X-GAP-08 | **Reporting/BI dashboard** | No visual analytics | Medium | Large |

### Integrations

| Gap ID | Missing Feature | Impact | Effort |
|--------|-----------------|--------|--------|
| X-GAP-09 | **Credit bureau integration** | No automated credit pulls | Medium | Large |
| X-GAP-10 | **KYC/AML service integration** | No compliance automation | High | Large |
| X-GAP-11 | **Document management system** | Basic storage; no full DMS | Medium | Medium |
| X-GAP-12 | **Core banking integration** | No connection to bank systems | Medium | Large |
| X-GAP-13 | **Payment processor integration** | No ACH/wire automation | Medium | Large |
| X-GAP-14 | **Accounting system integration** | No GL sync | Medium | Large |

### Infrastructure

| Gap ID | Missing Feature | Impact | Effort |
|--------|-----------------|--------|--------|
| X-GAP-15 | **Production database** | SQLite not production-ready at scale | High | Medium |
| X-GAP-16 | **File storage service** | No S3/cloud document storage | Medium | Small |
| X-GAP-17 | **Background job processing** | No async job queue | Medium | Medium |
| X-GAP-18 | **Caching layer** | No Redis/caching for performance | Low | Small |
| X-GAP-19 | **Search/indexing** | No full-text search (Elasticsearch) | Low | Medium |

---

## Gap Analysis Summary

### By Priority (Critical/High Impact)

| Priority | Count | Key Gaps |
|----------|-------|----------|
| **Critical** | 2 | User authentication, Web frontend |
| **High** | 12 | RBAC enforcement, Collateral management, Risk rating, Loan docs, CPs, Interest accrual, Payment schedule, KYC/AML, Production DB |
| **Medium** | 45+ | Document requests, Pipelines, Notifications, Integrations, Workflows |
| **Low** | 15+ | Mobile, Peer analysis, ESG, Participation accounting |

### By Stage

| Stage | Implemented Features | Major Gaps | Completeness |
|-------|---------------------|------------|--------------|
| Broker Introduction | 7 | Broker portal, Auth, Document checklist | 60% |
| Origination | 6 | Pipeline UI, Document requests, Assignment | 55% |
| Underwriting | 13 | Benchmarks, Collateral, Risk rating, KYC | 70% |
| Closing | 11 | Loan docs, CPs, E-signature, Funding | 65% |
| Monitoring | 13 | Interest accrual, Amort schedule, Collections | 70% |
| Cross-Cutting | 4 | Auth, UI, Integrations | 25% |

### By Effort

| Effort Level | Count | Examples |
|--------------|-------|----------|
| **Small** | 18 | Document checklist, Decline reasons, Priority flags |
| **Medium** | 35 | Document requests, Risk rating, Collateral tracking, Payment schedule |
| **Large** | 22 | Frontend, Credit bureau, OCR, Core banking, Accrual engine |

---

## Implementation Priorities

### Phase 1: Foundation (Critical)
1. **X-GAP-01: User authentication** - Basic auth with session management
2. **X-GAP-06: Web application frontend** - React/Next.js UI for core workflows
3. **X-GAP-02: Role-based access control** - Enforce roles at API layer
4. **X-GAP-15: Production database** - PostgreSQL migration

### Phase 2: Core Workflows (High Priority)
1. **C-GAP-02: Conditions precedent tracking** - CP checklist and satisfaction
2. **U-GAP-04: Collateral management** - Basic collateral tracking
3. **U-GAP-05: Risk rating system** - Credit risk scoring
4. **M-GAP-01: Interest accrual engine** - Daily interest calculation
5. **M-GAP-02: Payment schedule generation** - Amortization schedules
6. **O-GAP-02: Document request workflow** - Formal document requests

### Phase 3: Compliance & Integration (High Priority)
1. **U-GAP-13: KYC/AML checks** - Basic compliance workflow
2. **C-GAP-01: Loan document generation** - Template-based doc generation
3. **O-GAP-05: Pipeline dashboard** - Visual deal management
4. **M-GAP-03: Portfolio reporting** - Basic portfolio analytics

### Phase 4: Automation & Enhancement (Medium Priority)
1. **X-GAP-09: Credit bureau integration** - Automated credit pulls
2. **C-GAP-03: E-signature integration** - DocuSign/HelloSign
3. **M-GAP-09: Bank feed integration** - Plaid/Yodlee connection
4. **B-GAP-08: OCR/Document parsing** - Automated data extraction
5. **M-GAP-07: Collections workflow** - Delinquency management

### Phase 5: Advanced Features (Lower Priority)
1. **U-GAP-03: Scenario modeling** - Stress testing
2. **U-GAP-01: Industry benchmarks** - Market comparisons
3. **M-GAP-12: GL/accounting integration** - ERP connection
4. **C-GAP-13: Syndication support** - Participation management

---

## Appendix A: Current Implementation Files

| Component | File Path | Lines |
|-----------|-----------|-------|
| Deal Service | `packages/core/src/services/deal.ts` | ~200 |
| Stage Service | `packages/core/src/services/stage.ts` | 244 |
| Document Service | `packages/core/src/services/document.ts` | ~150 |
| Email Service | `packages/core/src/services/email.ts` | 281 |
| Spread Service | `packages/core/src/services/spread.ts` | 328 |
| Covenant Service | `packages/core/src/services/covenant.ts` | 464 |
| Entity Service | `packages/core/src/services/entity.ts` | 217 |
| Relationship Service | `packages/core/src/services/relationship.ts` | 177 |
| Template Service | `packages/core/src/services/template.ts` | 226 |
| Artifact Service | `packages/core/src/services/artifact.ts` | 104 |
| Facility Service | `packages/core/src/services/facility.ts` | 207 |
| Loan Account Service | `packages/core/src/services/loan-account.ts` | 2193 |
| Loan Integration Service | `packages/core/src/services/loan-integration.ts` | 263 |
| Approval Service | `packages/core/src/services/approval.ts` | 190 |
| Monitoring Service | `packages/core/src/services/monitoring.ts` | 594 |
| Audit Service | `packages/core/src/services/audit.ts` | 109 |
| Database Schema | `packages/core/src/schema/tables.ts` | 469 |

## Appendix B: API Endpoints

### Broker/Origination
- `POST /v1/deals` - Create deal
- `GET /v1/deals` - List deals
- `GET /v1/deals/{dealId}` - Get deal
- `PATCH /v1/deals/{dealId}` - Update deal
- `POST /v1/deals/{dealId}/documents` - Upload document
- `GET /v1/deals/{dealId}/documents` - List documents
- `POST /v1/deals/{dealId}/stage-transitions` - Transition stage
- `GET /v1/deals/{dealId}/stage-transitions` - List transitions

### Underwriting
- `POST /v1/deals/{dealId}/spread` - Create spread
- `POST /v1/deals/{dealId}/covenants` - Create covenant
- `GET /v1/deals/{dealId}/covenants` - List covenants
- `POST /v1/deals/{dealId}/covenants/test` - Test covenants
- `POST /v1/covenants/{covenantId}/waivers` - Create waiver
- `POST /v1/entities` - Create entity
- `GET /v1/entities` - List entities
- `POST /v1/entities/{fromEntityId}/relationships` - Create relationship

### Closing
- `POST /v1/deals/{dealId}/facilities` - Create facility
- `GET /v1/deals/{dealId}/facilities` - List facilities
- `PATCH /v1/deals/{dealId}/facilities/{facilityId}` - Update facility
- `POST /v1/loans` - Create loan account
- `POST /v1/loans:search` - Search loans
- `GET /v1/loans/{loanId}` - Get loan
- `GET /v1/loans/{loanId}/balance` - Get balance
- `POST /v1/loans/{loanId}/transactions` - Create transaction

### Monitoring
- `POST /v1/deals/{dealId}/monitoring/ingest` - Ingest transactions
- `GET /v1/deals/{dealId}/monitoring/liquidity` - Get liquidity
- `GET /v1/deals/{dealId}/monitoring/status` - Get monitoring status

### Support
- `POST /v1/email/ingest` - Ingest email
- `GET /v1/deals/{dealId}/audit` - Get audit trail

---

*Document generated by analysis of Open LOS codebase*
