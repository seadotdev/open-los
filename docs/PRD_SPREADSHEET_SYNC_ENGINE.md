# Product Requirements Document: Spreadsheet Sync Engine

> **Version:** 1.0
> **Status:** Draft
> **Last Updated:** 2026-01-31

---

## Executive Summary

Many commercial lenders begin their operations with spreadsheet-based loan origination systems (LOS). Excel files, Google Sheets, and SharePoint folders serve as the initial deal pipeline, borrower tracking, and document management tools before transitioning to purpose-built software.

This PRD defines a **Spreadsheet Sync Engine** that enables seamless migration from these "spreadsheet LOS" systems to Open LOS, providing:

1. **Zero-downtime migration** - Continuous sync during transition period
2. **Data validation** - Ensure data quality and completeness before cutover
3. **Rollback safety** - Ability to revert to spreadsheet system if needed
4. **Audit trail** - Complete history of all synchronized data

---

## Problem Statement

### Current Pain Points

**For Operations Teams:**
- Manual data entry between spreadsheets and new LOS
- Risk of data loss during migration
- No confidence in data completeness
- Fear of losing historical context

**For IT Teams:**
- No standardized migration path from spreadsheets
- Complex data transformation requirements
- Difficulty validating migration success
- No rollback mechanism

**For Leadership:**
- Prolonged parallel operations increase costs
- Delayed LOS adoption due to migration concerns
- Inability to quantify migration progress

### Why Spreadsheets Are Common

1. **Low barrier to entry** - No software procurement needed
2. **Flexible schema** - Easy to add columns as needs evolve
3. **Familiar interface** - No training required
4. **Sharing** - Easy to share via email or SharePoint

### Common Spreadsheet LOS Patterns

| Pattern | Description | Prevalence |
|---------|-------------|------------|
| **Single Pipeline Sheet** | One Excel file with deal pipeline | 60% |
| **Multi-Tab Workbook** | Tabs for pipeline, contacts, documents | 25% |
| **SharePoint Folder Structure** | Folders per deal with nested documents | 40% |
| **Google Sheets Team** | Shared sheets with real-time collaboration | 15% |
| **Hybrid** | Combination of above patterns | 30% |

---

## Target Users

### Primary Users

1. **Loan Officers / Originators**
   - Need their deal history preserved
   - Want minimal disruption during transition
   - Require confidence in data accuracy

2. **Operations Managers**
   - Track migration progress
   - Validate data completeness
   - Make go/no-go decisions

3. **IT Administrators**
   - Configure sync connections
   - Monitor sync health
   - Troubleshoot issues

### Secondary Users

1. **Compliance Officers** - Audit trail requirements
2. **Executives** - Migration progress visibility

---

## Proposed Solution

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Spreadsheet Sources                          │
├─────────────────┬──────────────────┬───────────────────────────┤
│  Excel Files    │  Google Sheets   │     SharePoint            │
│  (.xlsx, .xls)  │  (Drive API)     │     (Graph API)           │
└────────┬────────┴────────┬─────────┴─────────────┬─────────────┘
         │                 │                       │
         ▼                 ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Adapter Layer                                │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐ │
│  │ExcelAdapter  │ │SheetsAdapter │ │SharePointAdapter         │ │
│  │• File watch  │ │• Drive watch │ │• Folder sync             │ │
│  │• Multi-tab   │ │• Real-time   │ │• Document extraction     │ │
│  │• Cell types  │ │• Comments    │ │• Version history         │ │
│  └──────────────┘ └──────────────┘ └──────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Schema Discovery                             │
│  • Auto-detect column types       • Match to LOS entities       │
│  • Identify primary keys          • Suggest field mappings      │
│  • Detect relationships           • Handle custom columns       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Field Mapping Engine                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Common Loan Spreadsheet Fields → Open LOS Fields          │  │
│  │                                                           │  │
│  │ "Borrower Name"      → deals.borrower_name               │  │
│  │ "Loan Amount"        → facilities.amount                 │  │
│  │ "Rate"               → facilities.interest_rate_value    │  │
│  │ "Status"             → deals.stage                       │  │
│  │ "Closing Date"       → deals.custom_fields.closing_date  │  │
│  │ "Contact Email"      → entities.identifiers[email]       │  │
│  └───────────────────────────────────────────────────────────┘  │
│  • Fuzzy column name matching                                   │
│  • Custom transformation rules                                  │
│  • Validation rules per field                                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Sync Engine                                  │
│  • Change detection (hash-based)                                │
│  • Incremental updates                                          │
│  • Conflict resolution                                          │
│  • Retry with backoff                                           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Open LOS                                     │
│  • Deals   • Entities   • Documents   • Facilities             │
│  • Covenants   • Loan Accounts   • Audit Trail                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Functional Requirements

### FR-1: Source Connections

#### FR-1.1: Excel File Support
- **Priority:** P0 (Must Have)
- **Description:** Connect to local or network Excel files (.xlsx, .xls)
- **Acceptance Criteria:**
  - [ ] Parse Excel files with multiple worksheets
  - [ ] Support both .xlsx and legacy .xls formats
  - [ ] Detect file changes via polling or file system watch
  - [ ] Handle large files (up to 100MB) without memory issues
  - [ ] Support password-protected files with provided credentials

#### FR-1.2: Google Sheets Support
- **Priority:** P1 (Should Have)
- **Description:** Connect to Google Sheets via Drive API
- **Acceptance Criteria:**
  - [ ] OAuth 2.0 authentication flow
  - [ ] Service account support for automation
  - [ ] Real-time change detection via Drive webhooks
  - [ ] Support for shared team drives
  - [ ] Handle sheets with >10,000 rows

#### FR-1.3: SharePoint Support
- **Priority:** P0 (Must Have)
- **Description:** Connect to SharePoint document libraries and lists
- **Acceptance Criteria:**
  - [ ] Azure AD authentication (delegated and app-only)
  - [ ] Sync SharePoint lists as structured data
  - [ ] Sync document libraries with folder structure
  - [ ] Extract metadata from documents
  - [ ] Support for SharePoint Online and on-premises (2019+)

### FR-2: Schema Discovery

#### FR-2.1: Automatic Column Detection
- **Priority:** P0 (Must Have)
- **Description:** Automatically detect and classify spreadsheet columns
- **Acceptance Criteria:**
  - [ ] Identify header row automatically
  - [ ] Detect column data types (text, number, date, currency, email, phone)
  - [ ] Identify potential primary key columns
  - [ ] Detect empty/sparse columns
  - [ ] Handle merged cells appropriately

#### FR-2.2: Entity Mapping Suggestions
- **Priority:** P1 (Should Have)
- **Description:** Suggest mappings from spreadsheet columns to Open LOS entities
- **Acceptance Criteria:**
  - [ ] Fuzzy match column names to known loan field patterns
  - [ ] Suggest appropriate Open LOS entity for each sheet/tab
  - [ ] Confidence scores for each mapping suggestion
  - [ ] Learn from user corrections

### FR-3: Field Mapping

#### FR-3.1: Common Loan Field Mappings
- **Priority:** P0 (Must Have)
- **Description:** Pre-built mappings for common loan spreadsheet fields
- **Acceptance Criteria:**
  - [ ] 50+ common column name variations recognized
  - [ ] Support for both US and international terminology
  - [ ] Stage/status value normalization
  - [ ] Currency and amount parsing (handling $, commas, etc.)
  - [ ] Date format auto-detection (MM/DD/YYYY, DD/MM/YYYY, etc.)

#### FR-3.2: Custom Mapping Rules
- **Priority:** P0 (Must Have)
- **Description:** User-defined field mappings and transformations
- **Acceptance Criteria:**
  - [ ] Map any column to any Open LOS field
  - [ ] Expression-based transformations (e.g., `UPPER(name)`, `amount * 100`)
  - [ ] Conditional mappings (e.g., "if status = 'Closed', stage = 'closing'")
  - [ ] Default value assignment
  - [ ] Validation rules (required, format, range)

#### FR-3.3: Multi-Column Mappings
- **Priority:** P1 (Should Have)
- **Description:** Combine multiple columns into single fields
- **Acceptance Criteria:**
  - [ ] Concatenate columns (e.g., First Name + Last Name → borrower_name)
  - [ ] Split columns (e.g., "123 Main St, City, ST 12345" → address fields)
  - [ ] Lookup/reference columns (e.g., "Contact ID" → link to entities table)

### FR-4: Sync Operations

#### FR-4.1: Full Sync
- **Priority:** P0 (Must Have)
- **Description:** Complete synchronization of all data
- **Acceptance Criteria:**
  - [ ] Sync all rows from all configured sheets/tabs
  - [ ] Create corresponding Open LOS records
  - [ ] Track source-to-target record mapping
  - [ ] Report success/failure counts
  - [ ] Resume capability for interrupted syncs

#### FR-4.2: Incremental Sync
- **Priority:** P0 (Must Have)
- **Description:** Sync only changed data
- **Acceptance Criteria:**
  - [ ] Detect row additions, modifications, deletions
  - [ ] Use hash-based change detection
  - [ ] Update only changed fields in target
  - [ ] Handle row reordering
  - [ ] Track sync watermarks

#### FR-4.3: Continuous Sync
- **Priority:** P1 (Should Have)
- **Description:** Real-time or near-real-time sync
- **Acceptance Criteria:**
  - [ ] Configurable sync interval (1 minute to 24 hours)
  - [ ] File change detection for Excel
  - [ ] Webhook-based updates for Google Sheets
  - [ ] Delta queries for SharePoint
  - [ ] Health monitoring and alerting

#### FR-4.4: Bidirectional Sync (Future)
- **Priority:** P2 (Nice to Have)
- **Description:** Write changes back to spreadsheets
- **Acceptance Criteria:**
  - [ ] Sync status updates back to source
  - [ ] Conflict detection and resolution
  - [ ] Audit trail of bidirectional changes

### FR-5: Document Handling

#### FR-5.1: Document Extraction
- **Priority:** P0 (Must Have)
- **Description:** Extract and import documents from SharePoint/folders
- **Acceptance Criteria:**
  - [ ] Identify documents associated with deals (by folder, naming convention)
  - [ ] Import documents to Open LOS document store
  - [ ] Preserve original metadata (created date, modified by)
  - [ ] Support common formats (PDF, Word, Excel, images)
  - [ ] Handle large files (up to 100MB)

#### FR-5.2: Document Classification
- **Priority:** P1 (Should Have)
- **Description:** Automatically classify imported documents
- **Acceptance Criteria:**
  - [ ] Infer doc_type from filename patterns
  - [ ] Use folder structure for classification hints
  - [ ] Apply configurable classification rules
  - [ ] Manual override capability

### FR-6: Validation & Reporting

#### FR-6.1: Data Validation
- **Priority:** P0 (Must Have)
- **Description:** Validate data quality during sync
- **Acceptance Criteria:**
  - [ ] Check required fields are present
  - [ ] Validate field formats (email, phone, SSN, etc.)
  - [ ] Check referential integrity
  - [ ] Identify duplicate records
  - [ ] Generate validation report

#### FR-6.2: Migration Readiness Dashboard
- **Priority:** P1 (Should Have)
- **Description:** Visual dashboard showing migration progress
- **Acceptance Criteria:**
  - [ ] Coverage score (% of source records synced)
  - [ ] Accuracy score (% of fields matching)
  - [ ] Readiness score (composite go/no-go metric)
  - [ ] Entity-level breakdowns
  - [ ] Historical trend charts

#### FR-6.3: Discrepancy Management
- **Priority:** P1 (Should Have)
- **Description:** Track and resolve data discrepancies
- **Acceptance Criteria:**
  - [ ] Log all sync failures with details
  - [ ] Categorize by severity (critical, important, minor)
  - [ ] Workflow for manual resolution
  - [ ] Export discrepancy reports

---

## Non-Functional Requirements

### NFR-1: Performance

| Metric | Requirement |
|--------|-------------|
| Sync throughput | ≥1,000 rows/minute |
| File parse time | ≤10 seconds for 10,000 row file |
| Memory usage | ≤512MB for 100,000 row sync |
| API rate limits | Respect Google/Microsoft limits |

### NFR-2: Reliability

| Metric | Requirement |
|--------|-------------|
| Sync success rate | ≥99.5% of rows successfully synced |
| Data integrity | 100% field accuracy for synced records |
| Error recovery | Automatic retry with exponential backoff |
| Idempotency | Re-running sync produces same result |

### NFR-3: Security

| Requirement | Description |
|-------------|-------------|
| Credential storage | Encrypted at rest (AES-256) |
| OAuth tokens | Secure token refresh flow |
| Audit logging | All sync operations logged |
| Data isolation | Multi-tenant data separation |

### NFR-4: Usability

| Requirement | Description |
|-------------|-------------|
| Setup time | <30 minutes for basic configuration |
| No-code mapping | UI for field mapping without code |
| Documentation | Step-by-step migration guide |
| Error messages | Clear, actionable error messages |

---

## Common Spreadsheet Field Mappings

### Deal Pipeline Fields

| Common Column Names | Open LOS Field | Notes |
|---------------------|----------------|-------|
| "Deal Name", "Loan Name", "Project" | `deals.borrower_name` | Primary identifier |
| "Amount", "Loan Amount", "Principal" | `facilities.amount` | Convert to minor units |
| "Status", "Stage", "Phase" | `deals.stage` | Normalize to enum |
| "Originator", "LO", "Loan Officer" | `deals.assigned_to` | Map to user |
| "Close Date", "Closing", "Target Close" | `deals.custom_fields.target_close` | Parse date |
| "Rate", "Interest Rate", "Coupon" | `facilities.interest_rate_value` | Parse percentage |
| "Term", "Loan Term", "Maturity" | `facilities.term_months` | Convert to months |
| "Type", "Loan Type", "Product" | `facilities.type` | Normalize to enum |
| "Notes", "Comments", "Description" | `deals.custom_fields.notes` | Free text |

### Borrower/Entity Fields

| Common Column Names | Open LOS Field | Notes |
|---------------------|----------------|-------|
| "Borrower", "Company Name", "Entity" | `entities.name` | |
| "Contact", "Primary Contact" | `entities.name` (type: person) | Create relationship |
| "Email", "Contact Email" | `entities.identifiers[email]` | |
| "Phone", "Contact Phone" | `entities.identifiers[phone]` | |
| "Address", "Street Address" | `entities.custom_fields.address` | |
| "City", "State", "Zip" | `entities.custom_fields.*` | |
| "EIN", "Tax ID" | `entities.registration_number` | |

### Stage/Status Mappings

| Common Values | Open LOS Stage |
|---------------|----------------|
| "Lead", "Prospect", "Inquiry" | `broker` |
| "Application", "In Process", "Active" | `origination` |
| "Review", "Underwriting", "Analysis" | `underwriting` |
| "Approved", "Closing", "Pre-Close" | `closing` |
| "Funded", "Closed", "Active Loan" | `monitoring` |
| "Declined", "Withdrawn", "Lost" | `closed` (with sub-status) |

---

## User Interface

### Connection Setup Wizard

```
┌─────────────────────────────────────────────────────────────────┐
│  Step 1 of 4: Choose Source Type                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│   │   📊        │  │   📗        │  │   📁        │           │
│   │   Excel     │  │   Google    │  │ SharePoint  │           │
│   │   Files     │  │   Sheets    │  │             │           │
│   └─────────────┘  └─────────────┘  └─────────────┘           │
│                                                                 │
│   [Back]                                          [Continue →] │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Step 2 of 4: Configure Connection                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Excel File Location:                                          │
│  ┌─────────────────────────────────────────────────┐ [Browse]  │
│  │ /shared/deals/loan_pipeline_2026.xlsx           │           │
│  └─────────────────────────────────────────────────┘           │
│                                                                 │
│  ☑ Watch for changes (sync automatically)                      │
│  ☐ Password protected (enter password below)                   │
│                                                                 │
│  [← Back]                                         [Continue →] │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Step 3 of 4: Review Detected Schema                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Worksheet: "Pipeline" (142 rows)                              │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ Column          │ Type    │ Sample    │ Map To            ││
│  ├─────────────────┼─────────┼───────────┼───────────────────┤│
│  │ Deal Name       │ Text    │ "Acme..." │ deals.borrower... ││
│  │ Amount          │ Currency│ $500,000  │ facilities.amount ││
│  │ Status          │ Text    │ "Active"  │ deals.stage       ││
│  │ Rate            │ Percent │ 7.5%      │ facilities.int... ││
│  │ Originator      │ Text    │ "John D"  │ deals.assigned_to ││
│  │ [+12 more]      │         │           │                   ││
│  └────────────────────────────────────────────────────────────┘│
│                                                                 │
│  [Edit Mappings]                                               │
│                                                                 │
│  [← Back]                                         [Continue →] │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Step 4 of 4: Start Sync                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Ready to sync 142 deals from "loan_pipeline_2026.xlsx"        │
│                                                                 │
│  Sync Mode:                                                    │
│  ◉ Full sync (import all records)                              │
│  ○ Incremental (only new/changed records)                      │
│                                                                 │
│  Schedule:                                                     │
│  ○ One-time sync                                               │
│  ◉ Continuous (every 15 minutes)                               │
│                                                                 │
│  [← Back]                                    [Start Sync →]    │
└─────────────────────────────────────────────────────────────────┘
```

### Migration Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│  Migration Readiness Dashboard                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Readiness Score                                         │  │
│  │                                                          │  │
│  │    ████████████████████████░░░░░░  87%                  │  │
│  │                                                          │  │
│  │  Coverage: 94%    Accuracy: 98%    Gaps: 3 open         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Entity Status                                                  │
│  ┌────────────┬───────────┬───────────┬───────────┬──────────┐ │
│  │ Entity     │ Source    │ Synced    │ Accuracy  │ Status   │ │
│  ├────────────┼───────────┼───────────┼───────────┼──────────┤ │
│  │ Deals      │ 142       │ 138       │ 99.2%     │ ✓ Ready  │ │
│  │ Entities   │ 89        │ 89        │ 100%      │ ✓ Ready  │ │
│  │ Documents  │ 423       │ 398       │ 94.1%     │ ⚠ Review │ │
│  │ Facilities │ 156       │ 152       │ 97.4%     │ ✓ Ready  │ │
│  └────────────┴───────────┴───────────┴───────────┴──────────┘ │
│                                                                 │
│  Recent Sync Activity                                           │
│  • 2026-01-31 10:45:32  Incremental sync: 3 updated, 0 failed  │
│  • 2026-01-31 10:30:15  Incremental sync: 1 created, 0 failed  │
│  • 2026-01-31 10:15:08  Incremental sync: 0 changes            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Spreadsheet-Specific Endpoints

```
# Connection Management
POST   /v1/spreadsheet/connections           # Create connection
GET    /v1/spreadsheet/connections           # List connections
GET    /v1/spreadsheet/connections/:id       # Get connection details
PATCH  /v1/spreadsheet/connections/:id       # Update connection
DELETE /v1/spreadsheet/connections/:id       # Delete connection
POST   /v1/spreadsheet/connections/:id/test  # Test connection

# Schema Discovery
GET    /v1/spreadsheet/connections/:id/discover  # Discover schema
GET    /v1/spreadsheet/connections/:id/preview   # Preview data (first N rows)

# Field Mappings
POST   /v1/spreadsheet/mappings              # Create mapping
GET    /v1/spreadsheet/mappings              # List mappings
GET    /v1/spreadsheet/mappings/:id          # Get mapping
PATCH  /v1/spreadsheet/mappings/:id          # Update mapping
DELETE /v1/spreadsheet/mappings/:id          # Delete mapping
POST   /v1/spreadsheet/mappings/suggest      # Get AI-suggested mappings

# Sync Operations
POST   /v1/spreadsheet/sync                  # Start sync
GET    /v1/spreadsheet/sync/:id              # Get sync status
GET    /v1/spreadsheet/sync                  # List sync history
POST   /v1/spreadsheet/sync/:id/cancel       # Cancel running sync

# Validation & Reports
POST   /v1/spreadsheet/validate              # Run validation
GET    /v1/spreadsheet/readiness             # Get readiness dashboard
GET    /v1/spreadsheet/discrepancies         # List discrepancies
PATCH  /v1/spreadsheet/discrepancies/:id     # Resolve discrepancy
GET    /v1/spreadsheet/report                # Generate report
```

---

## Implementation Plan

### Phase 1: Foundation (Weeks 1-2)
- [ ] Excel adapter with file watching
- [ ] Basic field mapping engine
- [ ] Full sync capability
- [ ] CLI commands for sync

### Phase 2: Core Features (Weeks 3-4)
- [ ] SharePoint adapter (Online)
- [ ] Incremental sync with change detection
- [ ] Common field mappings library
- [ ] Validation engine

### Phase 3: Advanced (Weeks 5-6)
- [ ] Google Sheets adapter
- [ ] Continuous sync with scheduling
- [ ] Readiness dashboard
- [ ] Document extraction

### Phase 4: Polish (Weeks 7-8)
- [ ] UI for connection wizard
- [ ] AI-assisted mapping suggestions
- [ ] Comprehensive reporting
- [ ] Documentation and guides

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Migration success rate | >95% | Records synced / Total source records |
| Data accuracy | >99% | Fields matching exactly |
| Time to first sync | <30 min | From start to first successful sync |
| User satisfaction | >4.5/5 | Post-migration survey |
| Support tickets | <5/migration | Migration-related support requests |

---

## Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Complex spreadsheet structures | High | Medium | Schema preview + manual override |
| Rate limiting (Google/Microsoft) | Medium | High | Intelligent backoff + batching |
| Large file handling | Medium | Medium | Streaming parser + chunking |
| Data quality issues | High | High | Validation + discrepancy workflow |
| User adoption | High | Medium | Wizard UI + documentation |

---

## Appendix

### A. Supported File Formats

| Format | Extension | Support Level |
|--------|-----------|---------------|
| Excel (Modern) | .xlsx | Full |
| Excel (Legacy) | .xls | Full |
| Excel (Macro) | .xlsm | Data only (no macros) |
| CSV | .csv | Full |
| Google Sheets | - | Full (via API) |
| SharePoint List | - | Full |

### B. Column Name Variations Database

See `packages/shadow/src/adapters/spreadsheet/field-variations.ts` for the complete list of 200+ recognized column name variations.

---

*End of Product Requirements Document*
