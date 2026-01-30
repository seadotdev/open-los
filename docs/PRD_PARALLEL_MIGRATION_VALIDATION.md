# PRD: Parallel Migration Validation System

> **Product Name:** Open LOS Shadow Migration
> **Version:** 1.0
> **Status:** Draft
> **Last Updated:** 2026-01-30

---

## Executive Summary

Open LOS Shadow Migration is an **agentic parallel deployment system** that enables enterprise lenders to validate Open LOS as a system of record replacement by running it in shadow mode alongside their existing Loan Origination System.

The system is designed to be **set up by Claude Code in a single session**, deployed **on-premise close to the customer's existing infrastructure**, and validated over weeks/months of parallel operation. This de-risks migration by proving data coverage, feature parity, and operational compatibility before any production cutover.

### Value Proposition

| Stakeholder | Benefit |
|-------------|---------|
| **CTO/VP Engineering** | Zero-risk validation of new LOS; proof of migration feasibility |
| **Compliance/Risk** | Demonstrated data integrity; audit trail of validation results |
| **Operations** | Confidence that day-to-day workflows will function post-migration |
| **Vendor Evaluation** | Concrete evidence for buy vs. build decisions |

---

## Problem Statement

### Current Migration Challenges

1. **High-Risk Cutovers**: Traditional migrations require "big bang" cutovers with significant operational risk
2. **Uncertainty in Data Coverage**: Teams can't prove that the new system handles all their data scenarios until it's too late
3. **Long Evaluation Cycles**: Proof-of-concept projects take 6-12 months before any real validation
4. **Integration Complexity**: Connecting to existing systems requires significant custom development
5. **Resistance to Change**: Users resist migration without proof the new system works with their actual data

### Target Customer Profile

- **Mid-market and enterprise lenders** with existing LOS (Mambu, nCino, custom systems)
- **On-premise or private cloud** deployment requirements
- **Compliance-sensitive** organizations needing audit trails
- **AI-forward** teams wanting to leverage Claude/AI agents for operations
- **Technical teams** capable of running Claude Code or similar tooling

---

## Solution Overview

### Core Concept: Shadow Mode Operation

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Customer's Existing Infrastructure              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌────────────────┐  │
│  │ Existing LOS    │    │ Core Banking    │    │ Document Mgmt  │  │
│  │ (System of      │◄──►│ System          │◄──►│ System         │  │
│  │  Record)        │    │                 │    │                │  │
│  └────────┬────────┘    └────────┬────────┘    └───────┬────────┘  │
│           │                      │                     │           │
│           ▼                      ▼                     ▼           │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              DATA REPLICATION LAYER                          │  │
│  │  • CDC (Change Data Capture) connectors                      │  │
│  │  • API polling adapters                                      │  │
│  │  • File-based ingestion (CSV, SFTP)                          │  │
│  │  • Webhook receivers                                         │  │
│  └────────────────────────────┬─────────────────────────────────┘  │
│                               │                                    │
│                               ▼                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    OPEN LOS SHADOW                           │  │
│  │  ┌──────────────────────────────────────────────────────┐   │  │
│  │  │ Validation Engine                                     │   │  │
│  │  │ • Data ingestion & transformation                     │   │  │
│  │  │ • Continuous comparison (source vs shadow)            │   │  │
│  │  │ • Coverage metrics & gap analysis                     │   │  │
│  │  │ • Validation reports (daily/weekly/on-demand)         │   │  │
│  │  └──────────────────────────────────────────────────────┘   │  │
│  │                                                              │  │
│  │  ┌──────────────────────────────────────────────────────┐   │  │
│  │  │ Open LOS Core (Read-Write Shadow)                     │   │  │
│  │  │ • Full deal lifecycle                                 │   │  │
│  │  │ • Document storage                                    │   │  │
│  │  │ • Entity management                                   │   │  │
│  │  │ • Loan accounts (Mambu-compatible)                    │   │  │
│  │  │ • Covenant monitoring                                 │   │  │
│  │  └──────────────────────────────────────────────────────┘   │  │
│  │                                                              │  │
│  │  ┌──────────────────────────────────────────────────────┐   │  │
│  │  │ Migration Dashboard                                   │   │  │
│  │  │ • Coverage percentage by entity type                  │   │  │
│  │  │ • Data discrepancy alerts                             │   │  │
│  │  │ • Validation history & trends                         │   │  │
│  │  │ • Migration readiness score                           │   │  │
│  │  └──────────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Capabilities

1. **One-Command Setup**: Claude Code can deploy the entire shadow environment from a single prompt
2. **Adapter Framework**: Pluggable connectors for common LOS systems (Mambu, nCino, FIS, custom APIs)
3. **Continuous Validation**: Real-time comparison between source system and Open LOS shadow
4. **Gap Analysis**: Automatic identification of unsupported data types, workflows, or edge cases
5. **Migration Readiness Score**: Quantified confidence metric for go/no-go decisions
6. **Zero Production Impact**: Shadow mode never writes back to source systems

---

## User Stories

### Epic 1: Shadow Environment Setup

```
As a DevOps engineer at a lending company,
I want to run a single Claude Code command that sets up Open LOS in shadow mode,
So that I can start validating migration feasibility within hours, not weeks.
```

**Acceptance Criteria:**
- [ ] Claude Code can analyze existing infrastructure and recommend deployment topology
- [ ] Automated Docker/container deployment with configurable resources
- [ ] Auto-detection of source system type (Mambu, nCino, custom)
- [ ] Connection testing and validation before data sync begins
- [ ] Health check endpoints for monitoring

### Epic 2: Data Replication & Mapping

```
As a data engineer,
I want the shadow system to automatically map and ingest data from our existing LOS,
So that I can see our actual production data in Open LOS format.
```

**Acceptance Criteria:**
- [ ] Schema mapping wizard for custom source systems
- [ ] Pre-built mappings for Mambu, nCino, FIS, Encompass
- [ ] Incremental sync (only changed records after initial load)
- [ ] Conflict resolution strategies (source wins, shadow wins, manual review)
- [ ] Data transformation rules (currency conversion, date formats, etc.)

### Epic 3: Continuous Validation

```
As a product manager,
I want daily validation reports comparing our source LOS to Open LOS shadow,
So that I can track migration readiness over time.
```

**Acceptance Criteria:**
- [ ] Entity-by-entity coverage metrics (deals, documents, entities, loans)
- [ ] Field-level mapping completeness scores
- [ ] Discrepancy detection with root cause categorization
- [ ] Trend graphs showing validation improvements over time
- [ ] Alerting for regressions or new unsupported scenarios

### Epic 4: Gap Analysis & Remediation

```
As a technical architect,
I want to see exactly what data/features our current LOS has that Open LOS cannot support,
So that I can plan remediation or accept documented limitations.
```

**Acceptance Criteria:**
- [ ] Automated gap detection for unsupported fields, workflows, integrations
- [ ] Categorization: Critical (blocks migration), Important (workaround needed), Nice-to-have
- [ ] Suggested remediation paths (custom fields, API extensions, workflow changes)
- [ ] Gap closure tracking over shadow period
- [ ] Export gap analysis for executive reporting

### Epic 5: Migration Readiness & Cutover Planning

```
As a CTO,
I want a single "Migration Readiness Score" that tells me if we're ready to cut over,
So that I can make an informed go/no-go decision.
```

**Acceptance Criteria:**
- [ ] Composite score (0-100) based on coverage, accuracy, performance
- [ ] Breakdown by category (data, documents, workflows, integrations)
- [ ] Historical score tracking with improvement velocity
- [ ] Automated cutover checklist generation
- [ ] Rollback plan documentation

---

## Technical Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    OPEN LOS SHADOW MIGRATION                        │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                     PACKAGES (NEW)                            │ │
│  │                                                                │ │
│  │  packages/                                                     │ │
│  │  ├── shadow/                    # Shadow migration core       │ │
│  │  │   ├── src/                                                 │ │
│  │  │   │   ├── adapters/          # Source system connectors   │ │
│  │  │   │   │   ├── base.ts        # Adapter interface          │ │
│  │  │   │   │   ├── mambu.ts       # Mambu API adapter          │ │
│  │  │   │   │   ├── ncino.ts       # nCino/Salesforce adapter   │ │
│  │  │   │   │   ├── csv.ts         # CSV file adapter           │ │
│  │  │   │   │   └── webhook.ts     # Webhook receiver adapter   │ │
│  │  │   │   ├── sync/              # Data synchronization       │ │
│  │  │   │   │   ├── engine.ts      # Sync orchestration         │ │
│  │  │   │   │   ├── mapper.ts      # Schema mapping             │ │
│  │  │   │   │   └── transform.ts   # Data transformations       │ │
│  │  │   │   ├── validation/        # Comparison & validation    │ │
│  │  │   │   │   ├── comparator.ts  # Record comparison          │ │
│  │  │   │   │   ├── coverage.ts    # Coverage metrics           │ │
│  │  │   │   │   └── reports.ts     # Report generation          │ │
│  │  │   │   ├── dashboard/         # Validation dashboard       │ │
│  │  │   │   │   ├── api.ts         # Dashboard API routes       │ │
│  │  │   │   │   └── metrics.ts     # Metrics aggregation        │ │
│  │  │   │   └── setup/             # Automated setup            │ │
│  │  │   │       ├── detector.ts    # Infrastructure detection   │ │
│  │  │   │       ├── wizard.ts      # Setup wizard logic         │ │
│  │  │   │       └── deploy.ts      # Deployment automation      │ │
│  │  │   └── package.json                                         │ │
│  │  │                                                            │ │
│  │  └── shadow-cli/                # Claude Code interface       │ │
│  │      ├── src/                                                 │ │
│  │      │   ├── commands/          # CLI commands               │ │
│  │      │   │   ├── init.ts        # Initialize shadow env      │ │
│  │      │   │   ├── connect.ts     # Connect to source system   │ │
│  │      │   │   ├── sync.ts        # Run sync operations        │ │
│  │      │   │   ├── validate.ts    # Run validation             │ │
│  │      │   │   ├── report.ts      # Generate reports           │ │
│  │      │   │   └── status.ts      # Check shadow status        │ │
│  │      │   └── prompts/           # AI-friendly prompts        │ │
│  │      │       └── setup.md       # Setup guidance for Claude  │ │
│  │      └── package.json                                         │ │
│  │                                                                │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                   DATABASE SCHEMA (NEW TABLES)                │ │
│  │                                                                │ │
│  │  shadow_connections {                                         │ │
│  │    id, name, adapter_type, config (encrypted JSON)            │ │
│  │    status (connected|disconnected|error), last_sync_at        │ │
│  │  }                                                            │ │
│  │                                                                │ │
│  │  shadow_mappings {                                            │ │
│  │    connection_id, source_entity, target_entity                │ │
│  │    field_mappings (JSON), transform_rules (JSON)              │ │
│  │  }                                                            │ │
│  │                                                                │ │
│  │  shadow_sync_runs {                                           │ │
│  │    id, connection_id, started_at, completed_at                │ │
│  │    records_processed, records_created, records_updated        │ │
│  │    records_failed, error_log (JSON)                           │ │
│  │  }                                                            │ │
│  │                                                                │ │
│  │  shadow_validations {                                         │ │
│  │    id, sync_run_id, entity_type, source_count, shadow_count   │ │
│  │    matched_count, mismatched_count, missing_source_count      │ │
│  │    missing_shadow_count, coverage_pct, accuracy_pct           │ │
│  │  }                                                            │ │
│  │                                                                │ │
│  │  shadow_discrepancies {                                       │ │
│  │    id, validation_id, source_id, shadow_id, entity_type       │ │
│  │    discrepancy_type (missing|mismatch|extra)                  │ │
│  │    field_name, source_value, shadow_value                     │ │
│  │    severity (critical|important|minor), resolved_at           │ │
│  │  }                                                            │ │
│  │                                                                │ │
│  │  shadow_gaps {                                                │ │
│  │    id, connection_id, gap_type (field|workflow|integration)   │ │
│  │    description, source_feature, severity, remediation_plan    │ │
│  │    status (open|in_progress|resolved|accepted)                │ │
│  │  }                                                            │ │
│  │                                                                │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Adapter Interface

```typescript
// packages/shadow/src/adapters/base.ts

export interface SourceAdapter {
  /** Adapter identifier */
  readonly type: string;

  /** Test connection to source system */
  testConnection(): Promise<ConnectionTestResult>;

  /** Discover available entities/tables in source system */
  discoverSchema(): Promise<SourceSchema>;

  /** Fetch records from source system */
  fetchRecords(entity: string, options: FetchOptions): AsyncIterableIterator<SourceRecord>;

  /** Get record by ID for comparison */
  getRecord(entity: string, id: string): Promise<SourceRecord | null>;

  /** Subscribe to changes (CDC if supported) */
  subscribeChanges?(entity: string, callback: ChangeCallback): Subscription;
}

export interface SourceSchema {
  entities: {
    name: string;
    fields: {
      name: string;
      type: string;
      nullable: boolean;
      primaryKey: boolean;
    }[];
    recordCount?: number;
  }[];
}

export interface FetchOptions {
  since?: Date;           // Incremental sync
  limit?: number;         // Batch size
  cursor?: string;        // Pagination
  filters?: Record<string, unknown>;
}
```

### Sync Engine

```typescript
// packages/shadow/src/sync/engine.ts

export interface SyncEngine {
  /** Run full sync for all configured entities */
  runFullSync(connectionId: string): Promise<SyncRunResult>;

  /** Run incremental sync since last run */
  runIncrementalSync(connectionId: string): Promise<SyncRunResult>;

  /** Sync a specific entity type */
  syncEntity(connectionId: string, entity: string): Promise<EntitySyncResult>;

  /** Get sync status */
  getStatus(connectionId: string): Promise<SyncStatus>;

  /** Pause/resume sync */
  pause(connectionId: string): Promise<void>;
  resume(connectionId: string): Promise<void>;
}

export interface SyncRunResult {
  runId: string;
  startedAt: Date;
  completedAt: Date;
  entities: {
    name: string;
    processed: number;
    created: number;
    updated: number;
    failed: number;
    errors: SyncError[];
  }[];
  overallStatus: 'success' | 'partial' | 'failed';
}
```

### Validation Engine

```typescript
// packages/shadow/src/validation/comparator.ts

export interface ValidationEngine {
  /** Run validation comparing source and shadow */
  runValidation(connectionId: string): Promise<ValidationResult>;

  /** Validate specific entity type */
  validateEntity(connectionId: string, entity: string): Promise<EntityValidationResult>;

  /** Get validation history */
  getHistory(connectionId: string, limit?: number): Promise<ValidationResult[]>;

  /** Get discrepancies for review */
  getDiscrepancies(validationId: string, options?: DiscrepancyFilter): Promise<Discrepancy[]>;

  /** Mark discrepancy as resolved/accepted */
  resolveDiscrepancy(discrepancyId: string, resolution: Resolution): Promise<void>;
}

export interface ValidationResult {
  validationId: string;
  connectionId: string;
  runAt: Date;

  summary: {
    totalSourceRecords: number;
    totalShadowRecords: number;
    matchedRecords: number;
    mismatchedRecords: number;
    missingInShadow: number;
    missingInSource: number;
  };

  coverageScore: number;      // 0-100
  accuracyScore: number;      // 0-100
  readinessScore: number;     // Composite 0-100

  byEntity: EntityValidationResult[];
}
```

---

## API Endpoints (New)

### Shadow Management API

```yaml
# Added to openapi/v1.yaml

/v1/shadow/connections:
  POST:
    summary: Create a new source system connection
    requestBody:
      content:
        application/json:
          schema:
            type: object
            required: [name, adapter_type, config]
            properties:
              name:
                type: string
                example: "Production Mambu"
              adapter_type:
                type: string
                enum: [mambu, ncino, csv, webhook, custom_api]
              config:
                type: object
                description: Adapter-specific configuration (encrypted at rest)
    responses:
      201:
        description: Connection created

  GET:
    summary: List all shadow connections
    responses:
      200:
        description: List of connections with status

/v1/shadow/connections/{id}/test:
  POST:
    summary: Test connection to source system
    responses:
      200:
        description: Connection test result

/v1/shadow/connections/{id}/discover:
  GET:
    summary: Discover schema from source system
    responses:
      200:
        description: Source system schema

/v1/shadow/mappings:
  POST:
    summary: Create entity/field mapping
  GET:
    summary: List all mappings
  PUT:
    summary: Update mapping

/v1/shadow/sync:
  POST:
    summary: Trigger sync operation
    requestBody:
      content:
        application/json:
          schema:
            type: object
            properties:
              connection_id:
                type: string
              mode:
                type: string
                enum: [full, incremental]
              entities:
                type: array
                items:
                  type: string
                description: Specific entities to sync (empty = all)

/v1/shadow/sync/{id}/status:
  GET:
    summary: Get sync run status

/v1/shadow/validation:
  POST:
    summary: Trigger validation run
  GET:
    summary: Get validation history

/v1/shadow/validation/{id}:
  GET:
    summary: Get validation result details

/v1/shadow/validation/{id}/discrepancies:
  GET:
    summary: Get discrepancies for validation run
    parameters:
      - name: severity
        in: query
        schema:
          type: string
          enum: [critical, important, minor]
      - name: status
        in: query
        schema:
          type: string
          enum: [open, resolved, accepted]

/v1/shadow/gaps:
  GET:
    summary: Get identified feature/data gaps
  POST:
    summary: Add manually identified gap

/v1/shadow/gaps/{id}:
  PATCH:
    summary: Update gap status/remediation plan

/v1/shadow/readiness:
  GET:
    summary: Get migration readiness dashboard data
    responses:
      200:
        description: Readiness metrics and scores
        content:
          application/json:
            schema:
              type: object
              properties:
                overall_score:
                  type: number
                  minimum: 0
                  maximum: 100
                coverage_score:
                  type: number
                accuracy_score:
                  type: number
                gaps_summary:
                  type: object
                  properties:
                    critical: { type: integer }
                    important: { type: integer }
                    minor: { type: integer }
                trend:
                  type: array
                  items:
                    type: object
                    properties:
                      date: { type: string }
                      score: { type: number }
                recommendations:
                  type: array
                  items:
                    type: string

/v1/shadow/report:
  GET:
    summary: Generate validation report
    parameters:
      - name: format
        in: query
        schema:
          type: string
          enum: [json, pdf, csv]
      - name: from
        in: query
        schema:
          type: string
          format: date
      - name: to
        in: query
        schema:
          type: string
          format: date
```

---

## Claude Code Integration

### Setup Prompt (AGENTS.md Addition)

```markdown
## Shadow Migration Setup

Open LOS includes a shadow migration system that lets you validate it against
an existing LOS. To set this up:

### Quick Start (Single Command)

```bash
npx open-los-shadow init
```

Or via Claude Code:

> "Set up Open LOS in shadow mode to validate against our Mambu instance at
> api.mambu.com. We need to sync deals, documents, and loan accounts."

### What Claude Code Will Do

1. **Detect Infrastructure**: Analyze your environment (Docker, k8s, bare metal)
2. **Configure Adapter**: Set up connection to your source LOS
3. **Map Schema**: Auto-map source fields to Open LOS schema
4. **Initial Sync**: Pull historical data from source system
5. **Start Validation**: Begin continuous comparison
6. **Generate Report**: Create initial gap analysis

### Supported Source Systems

| System | Adapter | Features |
|--------|---------|----------|
| Mambu | `mambu` | Full CDC, loan accounts, transactions |
| nCino | `ncino` | Salesforce API, deals, documents |
| FIS/Fiserv | `fis` | API polling, batch export |
| Encompass | `encompass` | API polling, documents |
| CSV Export | `csv` | File-based, scheduled imports |
| Custom API | `custom_api` | Configurable REST adapter |
| Webhooks | `webhook` | Real-time push from source |

### Example Setup Session

```
User: Set up shadow migration against our production Mambu

Claude: I'll help you set up Open LOS shadow migration against Mambu. Let me:

1. First, I'll check your infrastructure...
   [Runs: docker --version, kubectl version]

   Detected: Docker 24.0, no Kubernetes
   Recommendation: Docker Compose deployment

2. Now I'll create the shadow configuration...
   [Creates: shadow-config.yaml]

3. What's your Mambu API URL and credentials?

User: https://acme.sandbox.mambu.com, API key is MAMBU_API_KEY env var

Claude: Got it. I'll configure the Mambu adapter...
   [Creates: .env.shadow with connection details]
   [Runs: docker-compose -f docker-compose.shadow.yaml up -d]

4. Testing connection to Mambu...
   [Runs: curl POST /v1/shadow/connections/test]
   ✓ Connected successfully
   ✓ Found 1,247 loan accounts
   ✓ Found 3,891 clients
   ✓ Found 892 transactions (last 30 days)

5. Discovering schema and creating mappings...
   [Auto-mapped 47/52 fields, 5 need manual review]

6. Starting initial sync (this may take a while)...
   [Runs: curl POST /v1/shadow/sync {mode: "full"}]

Shadow migration is now running. Check status:
- Dashboard: http://localhost:3000/shadow/dashboard
- API: GET /v1/shadow/readiness

Next steps:
- Review 5 unmapped fields in /shadow/mappings
- Set up scheduled sync (recommended: every 15 minutes)
- Configure alerting for discrepancies
```
```

### CLI Commands

```bash
# Initialize shadow environment
npx open-los-shadow init [--adapter=mambu|ncino|csv|webhook]

# Connect to source system
npx open-los-shadow connect --url=<api-url> --auth=<method>

# Run sync
npx open-los-shadow sync [--full|--incremental] [--entities=deals,loans]

# Run validation
npx open-los-shadow validate [--output=json|csv|pdf]

# Check status
npx open-los-shadow status

# Generate readiness report
npx open-los-shadow report --format=pdf --output=./migration-readiness.pdf
```

---

## Deployment Options

### Option 1: Docker Compose (Recommended for On-Prem)

```yaml
# docker-compose.shadow.yaml

version: '3.8'

services:
  open-los-shadow:
    image: ghcr.io/seadotdev/open-los:shadow-latest
    ports:
      - "3000:3000"
    environment:
      - DB_PATH=file:/data/shadow.db
      - SHADOW_MODE=true
      - SOURCE_ADAPTER=${SOURCE_ADAPTER:-mambu}
      - SOURCE_URL=${SOURCE_URL}
      - SOURCE_API_KEY=${SOURCE_API_KEY}
    volumes:
      - shadow-data:/data
      - ./shadow-config.yaml:/app/config/shadow.yaml:ro
    restart: unless-stopped

  shadow-sync:
    image: ghcr.io/seadotdev/open-los:shadow-latest
    command: ["sync", "--continuous", "--interval=15m"]
    environment:
      - DB_PATH=file:/data/shadow.db
      - SHADOW_MODE=true
    volumes:
      - shadow-data:/data
    depends_on:
      - open-los-shadow
    restart: unless-stopped

volumes:
  shadow-data:
```

### Option 2: Kubernetes (Enterprise)

```yaml
# k8s/shadow-deployment.yaml

apiVersion: apps/v1
kind: Deployment
metadata:
  name: open-los-shadow
spec:
  replicas: 1
  selector:
    matchLabels:
      app: open-los-shadow
  template:
    spec:
      containers:
      - name: open-los
        image: ghcr.io/seadotdev/open-los:shadow-latest
        env:
        - name: SHADOW_MODE
          value: "true"
        - name: SOURCE_API_KEY
          valueFrom:
            secretKeyRef:
              name: source-credentials
              key: api-key
        volumeMounts:
        - name: data
          mountPath: /data
        - name: config
          mountPath: /app/config
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: shadow-data-pvc
      - name: config
        configMap:
          name: shadow-config
```

### Option 3: Standalone Binary (Air-Gapped)

```bash
# For air-gapped/restricted environments
curl -L https://github.com/seadotdev/open-los/releases/download/v1.0.0/open-los-shadow-linux-amd64 -o open-los-shadow
chmod +x open-los-shadow
./open-los-shadow serve --shadow-mode --config=./shadow-config.yaml
```

---

## Validation Metrics & Scoring

### Coverage Score (0-100)

```
Coverage = (Matched Records / Total Source Records) × 100

Per Entity:
- Deals: What % of source deals exist in shadow?
- Documents: What % of source documents are synced?
- Entities: What % of borrowers/companies are mapped?
- Loans: What % of loan accounts are replicated?
- Transactions: What % of transactions are captured?
```

### Accuracy Score (0-100)

```
Accuracy = (Correct Field Values / Total Field Values) × 100

For matched records:
- How many fields have identical values?
- Tolerance for numeric fields (e.g., ±0.01 for currency)
- Date format normalization
- Case-insensitive string comparison
```

### Migration Readiness Score (0-100)

```
Readiness = (Coverage × 0.4) + (Accuracy × 0.4) + (Gap Score × 0.2)

Where:
- Gap Score = 100 - (Critical Gaps × 20) - (Important Gaps × 5) - (Minor Gaps × 1)

Thresholds:
- 90-100: Ready for migration
- 70-89: Minor issues to resolve
- 50-69: Significant work needed
- <50: Major gaps, not ready
```

### Dashboard Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| Overall Readiness | Composite score | ≥90 |
| Data Coverage | Records synced / total | ≥99% |
| Field Accuracy | Correct values / total | ≥99.9% |
| Sync Latency | Time since last sync | <15 min |
| Critical Gaps | Blocking issues | 0 |
| Discrepancy Rate | New discrepancies/day | Decreasing |

---

## Success Criteria

### Phase 1: MVP (4 weeks)

- [ ] Mambu adapter with basic sync
- [ ] CSV import adapter
- [ ] Manual schema mapping
- [ ] Basic validation (record count comparison)
- [ ] CLI for sync and validate commands
- [ ] Simple readiness score

### Phase 2: Production Ready (8 weeks)

- [ ] Incremental sync with CDC
- [ ] Auto schema discovery and mapping suggestions
- [ ] Field-level comparison with discrepancy tracking
- [ ] Gap analysis and remediation tracking
- [ ] Web dashboard for monitoring
- [ ] nCino adapter
- [ ] Docker Compose deployment

### Phase 3: Enterprise (12 weeks)

- [ ] Real-time webhook sync
- [ ] Kubernetes deployment with Helm chart
- [ ] SSO integration for dashboard
- [ ] Custom API adapter builder
- [ ] PDF report generation
- [ ] Alerting integrations (Slack, email, PagerDuty)
- [ ] Multi-tenant shadow (validate multiple branches)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Source API rate limits | Slow sync | Implement backoff, batch requests, off-hours sync |
| Schema changes in source | Broken mappings | Schema drift detection, automated alerts |
| Large data volumes | Performance issues | Streaming sync, pagination, incremental only |
| Sensitive data exposure | Security breach | Encryption at rest, field-level masking options |
| Network latency to source | Sync failures | Retry logic, local caching, resume capability |

---

## Go-to-Market

### Target Segments

1. **Mambu Users**: "Open LOS validates in shadow mode against your Mambu instance—prove migration feasibility in days, not months"

2. **Legacy LOS Users**: "Trapped on an outdated system? Shadow mode lets you validate Open LOS with your real data before committing"

3. **Build vs Buy Evaluators**: "Don't just demo—run Open LOS against your production data in parallel to make an informed decision"

### Sales Motion

1. **Discovery Call**: Identify source LOS, data volume, compliance requirements
2. **Shadow Setup Session**: 2-hour session with Claude Code to deploy shadow
3. **30-Day Parallel Run**: Customer runs shadow mode, reviews weekly reports
4. **Migration Decision**: Present readiness score, gap analysis, cutover plan
5. **Close**: Proceed to production migration or address gaps

### Pricing Consideration

- Shadow mode: **Free** (drives adoption, proves value)
- Production migration: Professional services engagement
- Ongoing support: Subscription based on loan volume

---

## Appendix A: Entity Mapping Reference

### Mambu → Open LOS

| Mambu Entity | Open LOS Entity | Key Mappings |
|--------------|-----------------|--------------|
| `LoanAccount` | `loan_accounts` | `encodedKey` → `encoded_key`, `accountState` → `state` |
| `Client` | `entities` | `id` → `id`, `type: "person"` |
| `Group` | `entities` | `id` → `id`, `type: "company"` |
| `LoanTransaction` | `loan_transactions` | `encodedKey` → `encoded_key` |
| `Document` | `documents` | `encodedKey` → `id` |

### nCino → Open LOS

| nCino Object | Open LOS Entity | Key Mappings |
|--------------|-----------------|--------------|
| `LLC_BI__Loan__c` | `deals` | `Id` → `id`, `Name` → `borrower_name` |
| `Account` | `entities` | `Id` → `id`, `Type` determines entity type |
| `ContentDocument` | `documents` | `Id` → `id`, `VersionData` → `content` |
| `LLC_BI__Covenant__c` | `covenants` | Direct mapping |

---

## Appendix B: Configuration Schema

```yaml
# shadow-config.yaml

version: "1.0"

source:
  adapter: mambu  # mambu | ncino | csv | webhook | custom_api

  # Mambu-specific
  mambu:
    url: https://your-tenant.mambu.com
    api_key: ${MAMBU_API_KEY}  # From environment
    branch_id: optional-branch-filter

  # nCino-specific
  ncino:
    instance_url: https://your-org.my.salesforce.com
    client_id: ${NCINO_CLIENT_ID}
    client_secret: ${NCINO_CLIENT_SECRET}

  # CSV-specific
  csv:
    watch_directory: /data/imports
    file_pattern: "*.csv"

sync:
  mode: incremental  # full | incremental
  interval: 15m      # Sync frequency
  batch_size: 1000   # Records per batch

  entities:
    - name: loans
      enabled: true
      priority: 1
    - name: clients
      enabled: true
      priority: 2
    - name: transactions
      enabled: true
      priority: 3

validation:
  schedule: "0 6 * * *"  # Daily at 6 AM
  tolerance:
    numeric: 0.01        # Allow ±0.01 for currency
    date: 1s             # Allow 1 second variance
  ignore_fields:
    - updated_at
    - sync_timestamp

alerts:
  enabled: true
  channels:
    - type: email
      recipients: [team@company.com]
    - type: slack
      webhook: ${SLACK_WEBHOOK}
  thresholds:
    coverage_drop: 5     # Alert if coverage drops 5%
    accuracy_drop: 1     # Alert if accuracy drops 1%
    critical_gaps: 1     # Alert on any critical gap
```

---

*End of PRD*
