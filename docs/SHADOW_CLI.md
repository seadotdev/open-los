# Shadow CLI: Lending X — System-of-Record Abstraction Layer

## The Problem

A lender evaluating Open LOS faces a cold-start problem. They already have:

- A **CRM** (HubSpot, Salesforce) holding borrower relationships, pipeline, and notes
- A **LOS** (nCino, Encompass, Mambu, or a spreadsheet) managing loan lifecycle
- **Custom fields, workflows, and reports** that took years to configure
- **Regulatory audit trails** that cannot be interrupted

Asking them to migrate is asking them to bet the business. The risk equation doesn't work.

## The Thesis

Instead of asking lenders to replace their system of record, run **alongside it**.

Open LOS becomes a **system of engagement** — a better operational surface that reads from and writes back to whatever the lender already uses. The lender works in the shadow CLI. The system of record stays intact. Value is proven before any migration conversation begins.

This is the playbook that Rippling, Ramp, and every successful neo-ERP has run: land as a sidecar, prove compounding value, become the new center of gravity.

## Precedents

| Company | Shadow Pattern | System of Record | Outcome |
|---------|---------------|-------------------|---------|
| **Rippling** | HR/IT/Finance cloud runs alongside existing payroll, benefits, IT | ADP, Workday, Gusto | Employee data becomes the compound nucleus; legacy systems become optional backends |
| **Ramp** | Expense/AP/Procurement layer on top of ERP | QuickBooks, NetSuite | Operational data flows through Ramp; ERP becomes the accounting ledger |
| **Brex** | Corporate card + spend mgmt with deep ERP sync | NetSuite, QuickBooks, Sage | Brex captures real-time spend; syncs downstream for GL posting |
| **Plaid** | Unified banking API abstracts 12,000+ institutions | Individual bank APIs | Applications code to one interface; Plaid handles the sprawl |
| **nCino** | LOS built natively on Salesforce | Salesforce is the SoR | Proves that lending can be layered onto an existing platform |

The common architecture: **capture operational data through a superior interface, sync it back to the system of record, and let the legacy system do what it's good at (compliance, reporting, GL) while the new system handles what it's bad at (UX, automation, intelligence).**

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Shadow CLI  (`los shadow`)                  │
│                                                                 │
│  The lender's daily interface. Abstracts the system of record.  │
│  Every command reads from / writes to the canonical model       │
│  AND syncs changes back to the source system.                   │
│                                                                 │
│  los shadow status                                              │
│  los shadow deal list                                           │
│  los shadow deal get <id>                                       │
│  los shadow sync --dry-run                                      │
│  los shadow diff                                                │
│  los shadow connect salesforce                                  │
└──────────────────────────────────┬──────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Canonical Domain Model                      │
│                                                                 │
│  Open LOS core: Deals, Entities, Facilities, Loans,            │
│  Documents, Covenants, Spreads, Audit Trail                    │
│                                                                 │
│  This is the single internal representation.                    │
│  All adapters map to/from this model.                           │
│  SQLite (local) — zero infrastructure required.                 │
└──────────────────────────────────┬──────────────────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
         ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
         │  Salesforce   │ │   HubSpot    │ │    nCino     │
         │   Adapter     │ │   Adapter    │ │   Adapter    │
         │              │ │              │ │              │
         │ REST + SOQL  │ │  REST v3 API │ │ SF + nCino   │
         │ Bulk API 2.0 │ │  CRM Objects │ │   Objects    │
         │ CDC / Events │ │  Webhooks    │ │   Custom     │
         └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
                │                │                │
                ▼                ▼                ▼
         ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
         │  Salesforce   │ │   HubSpot    │ │    nCino     │
         │   Instance    │ │   Account    │ │  on SF Org   │
         └──────────────┘ └──────────────┘ └──────────────┘

         ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
         │    Mambu      │ │  Spreadsheet │ │   Generic    │
         │   Adapter     │ │   Adapter    │ │  REST/CSV    │
         │  (via twin)   │ │  (existing)  │ │   Adapter    │
         └──────────────┘ └──────────────┘ └──────────────┘
```

### Key Design Decisions

**1. Adapter Pattern with Anti-Corruption Layer**

Each external system gets an adapter that implements a standard interface. The adapter is responsible for:
- **Inbound mapping**: External schema → Open LOS canonical model
- **Outbound mapping**: Open LOS canonical model → External schema
- **Field discovery**: Detecting custom fields, picklist values, object relationships
- **Conflict resolution**: Handling concurrent edits in both systems

The anti-corruption layer ensures that Salesforce's data model (Opportunities, Custom Objects) never leaks into the core domain. The domain stays clean regardless of how many backends are connected.

**2. Shadow Ledger (Read-Replica with Write-Back)**

Open LOS maintains a local SQLite copy of all data synced from the source system. This shadow ledger:
- Enables offline operation and fast queries
- Provides the substrate for AI analysis (spreads, covenants, monitoring)
- Records which fields came from the source system vs. were enriched locally
- Tracks sync state per record (synced, pending, conflict, stale)

**3. Provenance Tracking**

Every field in the canonical model carries provenance metadata:

```typescript
interface FieldProvenance {
  source: "salesforce" | "hubspot" | "ncino" | "manual" | "ai" | "computed";
  sourceObjectType: string;    // e.g., "Opportunity", "hs_deal"
  sourceFieldName: string;     // e.g., "Amount", "dealstage"
  sourceRecordId: string;      // e.g., "006xx000001234"
  lastSyncedAt: string;        // ISO timestamp
  syncDirection: "inbound" | "outbound" | "bidirectional";
  confidence: number;          // 0-1 for AI-extracted fields
}
```

This solves the "where did this number come from?" compliance question and enables smart conflict resolution.

**4. Strangler Fig Progression**

The shadow CLI is designed for a natural progression:

```
Phase 1: READ-ONLY MIRROR
  └─ Sync data from SoR into Open LOS
  └─ Run analytics, spreads, covenant tests on the shadow
  └─ Zero risk — nothing writes back
  └─ Value: "Here's what your portfolio actually looks like"

Phase 2: ENRICHMENT
  └─ Add data that doesn't exist in the SoR (spreads, covenants, AI analysis)
  └─ Shadow becomes the analytical layer
  └─ SoR still owns deal lifecycle
  └─ Value: "Here's risk you couldn't see before"

Phase 3: WRITE-BACK
  └─ Shadow CLI becomes the operational interface
  └─ Changes sync back to the SoR
  └─ SoR becomes the compliance/GL backend
  └─ Value: "Work here, everything stays in sync"

Phase 4: PRIMARY
  └─ Open LOS is the system of record
  └─ Legacy system is deprecated or kept for GL only
  └─ Value: "You've already been running on it for months"
```

## The Customization Problem

The hardest part isn't the API integration — it's the **semantic mapping**.

A typical Salesforce org has 200-500 custom fields on their Opportunity object. nCino adds another 100+ custom objects. HubSpot deals have custom properties with arbitrary names. Every lender's data model is a snowflake.

The existing `packages/shadow` field-variations database (1,165 patterns) is the foundation. But for CRM/LOS adapters, we need a more dynamic approach:

### Schema Discovery Protocol

```
1. CONNECT
   └─ Authenticate to the external system
   └─ Enumerate available objects/entities

2. DISCOVER
   └─ For each relevant object (Opportunity, Contact, Custom Objects):
     └─ Fetch field metadata (name, type, label, picklist values)
     └─ Sample 100 records for data pattern analysis
     └─ Match fields against the field-variations database
     └─ Flag high-confidence mappings and ambiguous ones

3. PROPOSE
   └─ Present a mapping proposal to the user:
     ┌──────────────────────────────────────────────────────────────┐
     │  Salesforce Field        →  Open LOS Field     Confidence   │
     │  ─────────────────────────────────────────────────────────   │
     │  Amount                  →  requested_amount      0.98      │
     │  StageName               →  stage (normalized)    0.95      │
     │  Account.Name            →  borrower_name         0.97      │
     │  Loan_Purpose__c         →  purpose               0.85      │
     │  Custom_Rate__c          →  ??? (suggest)         0.40      │
     │  Internal_Score__c       →  custom_fields.score   0.30      │
     └──────────────────────────────────────────────────────────────┘

4. CONFIRM
   └─ User accepts, adjusts, or rejects mappings
   └─ Mappings are saved as a connection profile
   └─ Re-discovery can be triggered when the source schema changes

5. SYNC
   └─ Execute sync using confirmed mappings
   └─ Track provenance on every field
```

### AI-Assisted Mapping

For the long tail of custom fields that don't match any known pattern, the agent layer can:
- Analyze field labels and sample values to suggest mappings
- Compare custom field semantics against the Open LOS schema
- Propose new `custom_fields` entries for data that has no canonical equivalent
- Learn from user corrections to improve future suggestions

## Adapter Interface

```typescript
/**
 * Standard interface for all system-of-record adapters.
 * Extends the existing SpreadsheetAdapter pattern to support
 * full CRM/LOS systems with bidirectional sync.
 */
interface ShadowAdapter {
  readonly type: AdapterType;
  readonly name: string;
  readonly capabilities: AdapterCapabilities;

  // Lifecycle
  initialize(config: AdapterConfig): Promise<void>;
  testConnection(): Promise<ConnectionTestResult>;
  dispose(): Promise<void>;

  // Schema Discovery
  discoverSchema(): Promise<ExternalSchema>;
  discoverCustomFields(objectType: string): Promise<CustomFieldMetadata[]>;
  sampleRecords(objectType: string, limit?: number): Promise<ExternalRecord[]>;

  // Inbound (External → Open LOS)
  fetchRecords(query: FetchQuery): Promise<FetchResult>;
  fetchRecord(objectType: string, externalId: string): Promise<ExternalRecord>;
  watchChanges?(callback: (event: ChangeEvent) => void): WatchHandle;

  // Outbound (Open LOS → External)
  pushRecord(objectType: string, data: Record<string, unknown>): Promise<PushResult>;
  pushBatch(objectType: string, records: Record<string, unknown>[]): Promise<BatchPushResult>;

  // Sync State
  getLastSyncToken(): Promise<string | null>;
  setLastSyncToken(token: string): Promise<void>;
}

type AdapterType =
  | "salesforce"
  | "hubspot"
  | "ncino"
  | "mambu"
  | "encompass"
  | "spreadsheet"
  | "csv"
  | "rest_generic";

interface AdapterCapabilities {
  /** Supports reading data from the source */
  read: boolean;
  /** Supports writing data back to the source */
  write: boolean;
  /** Supports real-time change notifications */
  realtime: boolean;
  /** Supports bulk operations */
  bulk: boolean;
  /** Supports incremental sync via change tokens */
  incrementalSync: boolean;
  /** Supports custom field discovery */
  customFieldDiscovery: boolean;
  /** Supports file/document extraction */
  documents: boolean;
  /** Maximum records per API call */
  batchSize: number;
  /** Rate limit (requests per minute, 0 = unlimited) */
  rateLimit: number;
}
```

## CLI Commands

The shadow CLI is a new command group within the existing `los` CLI:

```bash
# ── Connection Management ──────────────────────────────────────

# Connect to a system of record
los shadow connect salesforce \
  --instance-url https://myorg.my.salesforce.com \
  --client-id xxx --client-secret xxx

los shadow connect hubspot --api-key xxx

los shadow connect ncino \
  --instance-url https://myorg.my.salesforce.com \
  --namespace ncino

los shadow connect spreadsheet --file ./pipeline.xlsx

# Test connection
los shadow test

# List active connections
los shadow connections

# ── Schema Discovery ───────────────────────────────────────────

# Discover the external schema and propose mappings
los shadow discover
los shadow discover --object Opportunity --sample 100

# Review and accept proposed mappings
los shadow mappings
los shadow mappings accept --all-high-confidence
los shadow mappings edit Opportunity.Custom_Rate__c \
  --target facilities.interest_rate_value

# ── Sync Operations ────────────────────────────────────────────

# Preview what would sync (dry run)
los shadow sync --dry-run
los shadow sync --dry-run --object Opportunity

# Execute sync
los shadow sync                      # Full sync
los shadow sync --incremental        # Only changes since last sync
los shadow sync --object Contact     # Sync specific object type
los shadow sync --since 2025-01-01   # Sync from date

# View sync status
los shadow status
# Output:
#   Connection:  Salesforce (myorg.my.salesforce.com)
#   Last sync:   2025-06-15T14:30:00Z (2 hours ago)
#   Records:     1,247 deals | 3,891 entities | 456 documents
#   Pending:     12 outbound changes | 3 conflicts
#   Health:      ██████████░░ 87% fields mapped

# ── Shadow Operations ──────────────────────────────────────────

# Work with data through the canonical model
los shadow deal list
los shadow deal get SF-OPP-001234    # by external ID
los shadow deal get <open-los-id>    # by internal ID

# See the diff between shadow and source
los shadow diff
los shadow diff deal SF-OPP-001234
# Output:
#   Deal: Acme Corp Working Capital (SF-OPP-001234)
#   ┌─────────────────┬──────────────┬──────────────┐
#   │ Field           │ Salesforce   │ Open LOS     │
#   │─────────────────┼──────────────┼──────────────│
#   │ amount          │ $5,000,000   │ $5,000,000   │
#   │ stage           │ "Underwrite" │ underwriting │
#   │ dscr            │ —            │ 1.45         │ ← enriched
#   │ covenant_status │ —            │ 2 pass, 1 ⚠  │ ← enriched
#   └─────────────────┴──────────────┴──────────────┘

# Push enrichments back to source (phase 3)
los shadow push deal SF-OPP-001234
los shadow push --all-pending

# ── Analytics / Value Proof ────────────────────────────────────

# Run Open LOS analytics on shadowed data
los shadow analyze pipeline          # Pipeline health metrics
los shadow analyze portfolio         # Portfolio risk summary
los shadow analyze deal <id>         # Deep deal analysis

# Generate comparison report
los shadow report
# Output:
#   Shadow CLI Value Report
#   ═══════════════════════
#   Data completeness:  78% → 94% (+16pp with enrichment)
#   Fields not in SoR:  DSCR, debt-to-equity, covenant status,
#                       liquidity score, concentration risk
#   Deals with issues:  14 of 247 have covenant warnings
#   Missing documents:  23 deals missing financials
#   Stale data:         7 deals not updated in >30 days
```

## Adapter Sketches

### Salesforce Adapter

```
Object Mapping:
  Opportunity         →  deals
  Account             →  entities (type: company)
  Contact             →  entities (type: person)
  OpportunityLineItem →  facilities
  ContentDocument     →  documents
  Task / Event        →  communications
  Custom Objects      →  custom_fields / relationships

Auth: OAuth 2.0 JWT Bearer Flow (server-to-server)
Sync: Salesforce Change Data Capture (CDC) for real-time
Bulk: Bulk API 2.0 for initial load
Query: SOQL for flexible record fetching
Custom fields: Tooling API / Describe calls

Stage mapping (example):
  "Prospecting"        → broker
  "Qualification"      → broker
  "Application"        → origination
  "Credit Review"      → underwriting
  "Approved"           → closing
  "Funded"             → monitoring
  "Closed Won"         → monitoring
  "Closed Lost"        → (soft delete / archive)
```

### HubSpot Adapter

```
Object Mapping:
  deals               →  deals
  companies           →  entities (type: company)
  contacts            →  entities (type: person)
  line_items          →  facilities
  engagements         →  communications
  files               →  documents
  associations        →  relationships

Auth: Private app access token or OAuth 2.0
Sync: Webhooks for real-time (subscription API)
Bulk: CRM Search API with pagination
Query: CRM Search API with filters
Custom properties: Properties API

Stage mapping:
  Deal pipelines map to deal stages
  Pipeline stages are fully customizable — discovery required
```

### nCino Adapter

```
Object Mapping:
  LLC_BI__Loan__c           →  deals + facilities
  LLC_BI__Legal_Entities__c →  entities
  LLC_BI__Collateral__c     →  custom_fields (collateral)
  LLC_BI__Covenant2__c      →  covenants
  LLC_BI__Pricing_Stream__c →  facilities.interest_rate_*
  LLC_BI__Product_Package__c→  facilities.type
  ContentDocument           →  documents

Auth: Same as Salesforce (nCino runs on SF platform)
Sync: Salesforce CDC (nCino objects are SF custom objects)
Complexity: nCino namespace (LLC_BI__) + customer customizations on top

The nCino adapter extends the Salesforce adapter with nCino-specific
object awareness and field mappings.
```

## Handling Data Sprawl

The core challenge: loan data is never in one place. A typical deal touches:

```
CRM (Salesforce/HubSpot)     →  Borrower relationship, pipeline, notes, tasks
LOS (nCino/Encompass)        →  Application, underwriting, docs, compliance
Email                        →  Broker submissions, borrower communication
Spreadsheets                 →  Pipeline tracking, manual underwriting
Doc Management (SharePoint)  →  Financial statements, legal docs
Accounting (QuickBooks)      →  Borrower financials for spreading
Core Banking (FIS/Jack Henry) →  Loan servicing, payments, balances
```

The shadow CLI addresses this by being a **data aggregation point** that understands the lending domain. Instead of requiring all data to be in one system, it:

1. **Connects to multiple sources simultaneously** — a lender can have Salesforce as CRM + nCino as LOS + SharePoint for docs, and the shadow CLI maps all three into a unified deal view.

2. **Tracks data lineage** — every field knows which source system it came from, when it was last synced, and whether there are conflicts.

3. **Fills gaps with enrichment** — if the CRM has the deal amount but not the DSCR, the shadow CLI can compute it from financial data in the spreadsheet adapter.

4. **Provides a unified query surface** — `los shadow deal get` returns a complete picture regardless of how many systems contributed data.

## Sync Engine Design

Building on the existing `packages/shadow` sync engine:

```typescript
interface SyncPlan {
  /** What would be created/updated/deleted */
  operations: SyncOperation[];
  /** Conflicts that need resolution */
  conflicts: SyncConflict[];
  /** Summary statistics */
  summary: {
    creates: number;
    updates: number;
    deletes: number;
    conflicts: number;
    noChange: number;
  };
}

interface SyncOperation {
  type: "create" | "update" | "delete";
  direction: "inbound" | "outbound";
  entity: TargetEntity;
  externalId: string;
  internalId?: string;
  changes: FieldChange[];
  provenance: FieldProvenance;
}

interface SyncConflict {
  entity: TargetEntity;
  externalId: string;
  internalId: string;
  field: string;
  externalValue: unknown;
  internalValue: unknown;
  externalModifiedAt: string;
  internalModifiedAt: string;
  suggestedResolution: "keep_external" | "keep_internal" | "manual";
}

interface FieldChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  source: string;
}
```

### Conflict Resolution Strategy

```
1. LAST-WRITE-WINS (default for non-financial fields)
   └─ Whichever system was modified more recently wins
   └─ Suitable for: names, addresses, notes, status

2. SOURCE-OF-TRUTH PER FIELD
   └─ Configurable per mapping: "Salesforce owns stage, Open LOS owns DSCR"
   └─ Suitable for: fields that are only edited in one system

3. MANUAL RESOLUTION (for financial fields)
   └─ Conflicts queued for user review via `los shadow conflicts`
   └─ Suitable for: amounts, rates, terms — where discrepancies matter

4. APPEND-ONLY (for audit/communications)
   └─ Both sides contribute, nothing is overwritten
   └─ Suitable for: notes, emails, audit events
```

## Implementation Roadmap

### Phase 1: Foundation
- Adapter interface definition
- Connection management (config storage, auth token handling)
- Schema discovery protocol
- Field mapping engine (extending existing field-variations)
- Sync state tracking tables
- CLI command group (`los shadow`)

### Phase 2: Salesforce Adapter
- OAuth 2.0 JWT bearer flow
- Describe API for schema discovery
- SOQL query builder for record fetching
- Bulk API 2.0 for initial sync
- Standard object mappings (Opportunity → Deal, Account → Entity)
- Custom field discovery and mapping suggestions

### Phase 3: HubSpot Adapter
- Private app / OAuth authentication
- CRM object discovery
- Properties API for custom field detection
- Deal pipeline → stage mapping
- Association mapping → relationships

### Phase 4: Write-Back
- Outbound change queue
- Conflict detection and resolution
- Batch push operations
- Audit trail for outbound changes

### Phase 5: nCino Adapter
- nCino namespace detection
- LLC_BI__ object mapping
- Covenant and pricing stream sync
- Document sync via Salesforce ContentDocument

### Phase 6: Intelligence Layer
- AI-assisted field mapping for unknown custom fields
- Portfolio analytics on shadow data
- Value-proof report generation
- Anomaly detection across synced data

## Why This Works

**For the lender:**
- Zero migration risk — shadow mode changes nothing in their existing systems
- Immediate value — analytics and insights from day one
- Gradual adoption — they control the pace of transition
- No vendor lock-in — Open LOS is MIT licensed, they own everything

**For Open LOS:**
- Dramatically lower adoption friction
- Proves value before asking for commitment
- Builds switching costs through enrichment data
- Creates a natural upsell path from shadow → primary

**For the market:**
- Every lender becomes reachable regardless of their current stack
- The "spreadsheet LOS" segment (thousands of small lenders) can onboard in minutes
- Enterprise lenders can pilot without a procurement cycle

## Relationship to Existing Code

| Existing Package | Role in Shadow CLI |
|---|---|
| `packages/shadow` (spreadsheet sync) | Foundation — field variations, sync engine, and transform logic are directly reusable. CRM adapters follow the same pattern as spreadsheet adapters. |
| `packages/twins/mambu-twin` | Proves the adapter pattern works — the Mambu twin is effectively an adapter that speaks Mambu's API while using Open LOS internals. Reverse this: speak Open LOS while using Mambu's API. |
| `packages/core` | The canonical domain model. Shadow data maps into these 28 tables. All services (spreads, covenants, monitoring) work on shadow data identically. |
| `packages/cli` | The shadow CLI extends the existing CLI with a new command group. Same LosClient, same output formatting. |
| `packages/agent` | AI agents can operate on shadow data. "Analyze my Salesforce pipeline" becomes a real command. |
| `packages/conformance` | Conformance tests ensure shadow-synced data passes the same validation as directly-created data. |
