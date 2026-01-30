# Technical Specification: Shadow Migration Implementation

> **Version:** 1.0
> **Status:** Draft
> **Last Updated:** 2026-01-30

This document provides implementation details for the Shadow Migration Validation system described in the PRD.

---

## Table of Contents

1. [Package Structure](#1-package-structure)
2. [Database Schema](#2-database-schema)
3. [Adapter System](#3-adapter-system)
4. [Sync Engine](#4-sync-engine)
5. [Validation Engine](#5-validation-engine)
6. [API Implementation](#6-api-implementation)
7. [CLI Implementation](#7-cli-implementation)
8. [Deployment Automation](#8-deployment-automation)
9. [Testing Strategy](#9-testing-strategy)
10. [Migration Path](#10-migration-path)

---

## 1. Package Structure

### New Packages

```
packages/
├── shadow/                          # Core shadow migration logic
│   ├── package.json
│   ├── src/
│   │   ├── index.ts                 # Public exports
│   │   ├── types.ts                 # Type definitions
│   │   │
│   │   ├── adapters/                # Source system adapters
│   │   │   ├── index.ts             # Adapter registry
│   │   │   ├── base.ts              # Base adapter interface
│   │   │   ├── mambu/
│   │   │   │   ├── adapter.ts       # Mambu adapter implementation
│   │   │   │   ├── client.ts        # Mambu API client
│   │   │   │   ├── mapper.ts        # Mambu → Open LOS mapping
│   │   │   │   └── types.ts         # Mambu-specific types
│   │   │   ├── csv/
│   │   │   │   ├── adapter.ts       # CSV file adapter
│   │   │   │   ├── parser.ts        # CSV parsing logic
│   │   │   │   └── watcher.ts       # File system watcher
│   │   │   └── webhook/
│   │   │       ├── adapter.ts       # Webhook receiver adapter
│   │   │       └── handler.ts       # Webhook request handler
│   │   │
│   │   ├── sync/                    # Synchronization engine
│   │   │   ├── engine.ts            # Main sync orchestrator
│   │   │   ├── mapper.ts            # Schema mapping engine
│   │   │   ├── transform.ts         # Data transformation
│   │   │   ├── reconciler.ts        # Record reconciliation
│   │   │   └── scheduler.ts         # Sync scheduling
│   │   │
│   │   ├── validation/              # Validation engine
│   │   │   ├── engine.ts            # Validation orchestrator
│   │   │   ├── comparator.ts        # Record comparison
│   │   │   ├── coverage.ts          # Coverage calculation
│   │   │   ├── accuracy.ts          # Accuracy calculation
│   │   │   ├── readiness.ts         # Readiness score
│   │   │   └── reports.ts           # Report generation
│   │   │
│   │   ├── schema/                  # Database extensions
│   │   │   └── shadow-tables.ts     # Shadow-specific tables
│   │   │
│   │   └── services/                # Shadow services
│   │       ├── connection.ts        # Connection management
│   │       ├── mapping.ts           # Mapping management
│   │       ├── sync.ts              # Sync service
│   │       ├── validation.ts        # Validation service
│   │       └── gap.ts               # Gap analysis service
│   │
│   └── tests/
│       ├── adapters/
│       ├── sync/
│       └── validation/
│
└── shadow-cli/                      # Claude Code CLI interface
    ├── package.json
    ├── src/
    │   ├── index.ts                 # CLI entry point
    │   ├── commands/
    │   │   ├── init.ts              # Initialize shadow env
    │   │   ├── connect.ts           # Connect to source
    │   │   ├── discover.ts          # Discover source schema
    │   │   ├── map.ts               # Configure mappings
    │   │   ├── sync.ts              # Run sync
    │   │   ├── validate.ts          # Run validation
    │   │   ├── status.ts            # Check status
    │   │   └── report.ts            # Generate reports
    │   │
    │   └── prompts/                 # AI guidance
    │       ├── setup.md             # Setup instructions
    │       └── troubleshooting.md   # Common issues
    │
    └── bin/
        └── open-los-shadow          # Executable entry
```

---

## 2. Database Schema

### Shadow Tables Extension

```typescript
// packages/shadow/src/schema/shadow-tables.ts

import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

/**
 * Source system connections
 */
export const shadowConnections = sqliteTable("shadow_connections", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  adapter_type: text("adapter_type").notNull(), // mambu, ncino, csv, webhook, custom_api

  // Encrypted configuration JSON
  config_encrypted: text("config_encrypted").notNull(),

  // Connection status
  status: text("status").notNull().default("disconnected"), // connected, disconnected, error
  status_message: text("status_message"),
  last_connected_at: text("last_connected_at"),
  last_sync_at: text("last_sync_at"),

  // Metadata
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
});

/**
 * Entity and field mappings
 */
export const shadowMappings = sqliteTable("shadow_mappings", {
  id: text("id").primaryKey(),
  connection_id: text("connection_id").notNull().references(() => shadowConnections.id),

  // Source entity info
  source_entity: text("source_entity").notNull(),
  source_primary_key: text("source_primary_key").notNull(),

  // Target entity in Open LOS
  target_entity: text("target_entity").notNull(), // deals, entities, loan_accounts, etc.

  // Field mappings: [{ source: "field", target: "field", transform?: "fn" }]
  field_mappings: text("field_mappings").notNull(), // JSON

  // Transform rules for complex mappings
  transform_rules: text("transform_rules"), // JSON

  // Mapping status
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  auto_generated: integer("auto_generated", { mode: "boolean" }).notNull().default(false),

  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
});

/**
 * Sync run history
 */
export const shadowSyncRuns = sqliteTable("shadow_sync_runs", {
  id: text("id").primaryKey(),
  connection_id: text("connection_id").notNull().references(() => shadowConnections.id),

  // Run timing
  started_at: text("started_at").notNull(),
  completed_at: text("completed_at"),

  // Run mode
  mode: text("mode").notNull(), // full, incremental

  // Statistics
  total_records_processed: integer("total_records_processed").default(0),
  records_created: integer("records_created").default(0),
  records_updated: integer("records_updated").default(0),
  records_skipped: integer("records_skipped").default(0),
  records_failed: integer("records_failed").default(0),

  // Status
  status: text("status").notNull(), // running, completed, failed, cancelled
  error_log: text("error_log"), // JSON array of errors

  // For incremental sync: last processed cursor/timestamp
  sync_cursor: text("sync_cursor"),
});

/**
 * Per-entity sync statistics within a run
 */
export const shadowSyncEntities = sqliteTable("shadow_sync_entities", {
  id: text("id").primaryKey(),
  sync_run_id: text("sync_run_id").notNull().references(() => shadowSyncRuns.id),
  entity: text("entity").notNull(),

  source_count: integer("source_count"),
  processed: integer("processed").default(0),
  created: integer("created").default(0),
  updated: integer("updated").default(0),
  failed: integer("failed").default(0),

  started_at: text("started_at"),
  completed_at: text("completed_at"),
  status: text("status").notNull(), // pending, running, completed, failed
  errors: text("errors"), // JSON
});

/**
 * Validation run results
 */
export const shadowValidations = sqliteTable("shadow_validations", {
  id: text("id").primaryKey(),
  connection_id: text("connection_id").notNull().references(() => shadowConnections.id),
  sync_run_id: text("sync_run_id").references(() => shadowSyncRuns.id),

  run_at: text("run_at").notNull(),
  completed_at: text("completed_at"),

  // Overall metrics
  coverage_score: real("coverage_score"), // 0-100
  accuracy_score: real("accuracy_score"), // 0-100
  readiness_score: real("readiness_score"), // 0-100 composite

  // Summary counts
  total_source_records: integer("total_source_records"),
  total_shadow_records: integer("total_shadow_records"),
  matched_records: integer("matched_records"),
  mismatched_records: integer("mismatched_records"),
  missing_in_shadow: integer("missing_in_shadow"),
  extra_in_shadow: integer("extra_in_shadow"),

  status: text("status").notNull(), // running, completed, failed
});

/**
 * Per-entity validation results
 */
export const shadowValidationEntities = sqliteTable("shadow_validation_entities", {
  id: text("id").primaryKey(),
  validation_id: text("validation_id").notNull().references(() => shadowValidations.id),
  entity: text("entity").notNull(),

  source_count: integer("source_count"),
  shadow_count: integer("shadow_count"),
  matched_count: integer("matched_count"),
  mismatched_count: integer("mismatched_count"),
  missing_count: integer("missing_count"),
  extra_count: integer("extra_count"),

  coverage_pct: real("coverage_pct"),
  accuracy_pct: real("accuracy_pct"),
});

/**
 * Individual discrepancies found during validation
 */
export const shadowDiscrepancies = sqliteTable("shadow_discrepancies", {
  id: text("id").primaryKey(),
  validation_id: text("validation_id").notNull().references(() => shadowValidations.id),

  entity: text("entity").notNull(),
  source_id: text("source_id"),
  shadow_id: text("shadow_id"),

  // Discrepancy type
  type: text("type").notNull(), // missing_in_shadow, missing_in_source, field_mismatch, extra_in_shadow

  // For field mismatches
  field_name: text("field_name"),
  source_value: text("source_value"),
  shadow_value: text("shadow_value"),

  // Classification
  severity: text("severity").notNull(), // critical, important, minor
  category: text("category"), // data_loss, transformation_error, timing_issue, etc.

  // Resolution
  status: text("status").notNull().default("open"), // open, resolved, accepted, ignored
  resolution_notes: text("resolution_notes"),
  resolved_at: text("resolved_at"),
  resolved_by: text("resolved_by"),

  created_at: text("created_at").notNull(),
});

/**
 * Feature/capability gaps identified
 */
export const shadowGaps = sqliteTable("shadow_gaps", {
  id: text("id").primaryKey(),
  connection_id: text("connection_id").notNull().references(() => shadowConnections.id),

  // Gap classification
  gap_type: text("gap_type").notNull(), // field, entity, workflow, integration, feature
  severity: text("severity").notNull(), // critical, important, minor

  // Description
  title: text("title").notNull(),
  description: text("description").notNull(),

  // What exists in source but not in Open LOS
  source_feature: text("source_feature"),
  source_examples: text("source_examples"), // JSON

  // Impact assessment
  affected_records: integer("affected_records"),
  affected_percentage: real("affected_percentage"),

  // Remediation
  remediation_type: text("remediation_type"), // custom_field, api_extension, workflow_change, accept
  remediation_plan: text("remediation_plan"),
  remediation_effort: text("remediation_effort"), // low, medium, high

  // Status tracking
  status: text("status").notNull().default("open"), // open, in_progress, resolved, accepted
  resolved_at: text("resolved_at"),

  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
});

/**
 * Source record tracking (for reconciliation)
 * Stores minimal info about source records for comparison
 */
export const shadowSourceRecords = sqliteTable("shadow_source_records", {
  id: text("id").primaryKey(),
  connection_id: text("connection_id").notNull().references(() => shadowConnections.id),
  entity: text("entity").notNull(),

  source_id: text("source_id").notNull(),
  shadow_id: text("shadow_id"), // Corresponding Open LOS record ID

  // For change detection
  source_hash: text("source_hash"), // Hash of key fields for change detection
  source_updated_at: text("source_updated_at"),

  // Sync status
  sync_status: text("sync_status").notNull(), // synced, pending, failed
  last_synced_at: text("last_synced_at"),
  last_error: text("last_error"),

  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
});

// Indexes for performance
export const shadowIndexes = [
  "CREATE INDEX IF NOT EXISTS idx_shadow_connections_status ON shadow_connections(status)",
  "CREATE INDEX IF NOT EXISTS idx_shadow_sync_runs_connection ON shadow_sync_runs(connection_id, started_at)",
  "CREATE INDEX IF NOT EXISTS idx_shadow_validations_connection ON shadow_validations(connection_id, run_at)",
  "CREATE INDEX IF NOT EXISTS idx_shadow_discrepancies_validation ON shadow_discrepancies(validation_id, severity)",
  "CREATE INDEX IF NOT EXISTS idx_shadow_source_records_lookup ON shadow_source_records(connection_id, entity, source_id)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_shadow_source_records_unique ON shadow_source_records(connection_id, entity, source_id)",
];
```

---

## 3. Adapter System

### Base Adapter Interface

```typescript
// packages/shadow/src/adapters/base.ts

export interface AdapterConfig {
  /** Unique connection identifier */
  connectionId: string;
  /** Adapter-specific configuration */
  config: Record<string, unknown>;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  details?: {
    serverVersion?: string;
    permissions?: string[];
    entities?: string[];
  };
  error?: Error;
}

export interface SourceEntity {
  name: string;
  displayName: string;
  primaryKey: string;
  fields: SourceField[];
  recordCount?: number;
  supportsCDC: boolean;
  supportsIncrementalSync: boolean;
}

export interface SourceField {
  name: string;
  displayName: string;
  type: "string" | "number" | "boolean" | "date" | "datetime" | "json" | "binary";
  nullable: boolean;
  primaryKey: boolean;
  foreignKey?: {
    entity: string;
    field: string;
  };
}

export interface SourceSchema {
  adapter: string;
  version: string;
  entities: SourceEntity[];
  discoveredAt: Date;
}

export interface FetchOptions {
  /** For incremental sync: fetch records modified since this time */
  since?: Date;
  /** Batch size limit */
  limit?: number;
  /** Pagination cursor from previous fetch */
  cursor?: string;
  /** Additional filters */
  filters?: Record<string, unknown>;
  /** Fields to include (empty = all) */
  fields?: string[];
}

export interface SourceRecord {
  id: string;
  entity: string;
  data: Record<string, unknown>;
  metadata: {
    createdAt?: Date;
    updatedAt?: Date;
    version?: number;
    hash?: string;
  };
}

export interface FetchResult {
  records: SourceRecord[];
  cursor?: string;
  hasMore: boolean;
  totalCount?: number;
}

export interface ChangeEvent {
  type: "create" | "update" | "delete";
  entity: string;
  recordId: string;
  record?: SourceRecord;
  timestamp: Date;
}

export interface Subscription {
  unsubscribe(): void;
}

/**
 * Base interface all adapters must implement
 */
export interface SourceAdapter {
  /** Adapter type identifier */
  readonly type: string;

  /** Human-readable adapter name */
  readonly name: string;

  /** Supported features */
  readonly features: {
    cdc: boolean;
    incrementalSync: boolean;
    batchFetch: boolean;
    realtime: boolean;
  };

  /**
   * Initialize the adapter with configuration
   */
  initialize(config: AdapterConfig): Promise<void>;

  /**
   * Test connection to source system
   */
  testConnection(): Promise<ConnectionTestResult>;

  /**
   * Discover available entities and their schemas
   */
  discoverSchema(): Promise<SourceSchema>;

  /**
   * Fetch records from source system
   */
  fetchRecords(entity: string, options?: FetchOptions): Promise<FetchResult>;

  /**
   * Fetch a single record by ID
   */
  getRecord(entity: string, id: string): Promise<SourceRecord | null>;

  /**
   * Get count of records (for coverage calculation)
   */
  getRecordCount(entity: string, options?: FetchOptions): Promise<number>;

  /**
   * Subscribe to real-time changes (if supported)
   */
  subscribeChanges?(
    entity: string,
    callback: (event: ChangeEvent) => void
  ): Subscription;

  /**
   * Clean up resources
   */
  dispose(): Promise<void>;
}

/**
 * Adapter registry for dynamic adapter loading
 */
export class AdapterRegistry {
  private adapters = new Map<string, new () => SourceAdapter>();

  register(type: string, adapter: new () => SourceAdapter): void {
    this.adapters.set(type, adapter);
  }

  create(type: string): SourceAdapter {
    const AdapterClass = this.adapters.get(type);
    if (!AdapterClass) {
      throw new Error(`Unknown adapter type: ${type}`);
    }
    return new AdapterClass();
  }

  listTypes(): string[] {
    return Array.from(this.adapters.keys());
  }
}

export const adapterRegistry = new AdapterRegistry();
```

### Mambu Adapter Implementation

```typescript
// packages/shadow/src/adapters/mambu/adapter.ts

import { SourceAdapter, AdapterConfig, ConnectionTestResult, SourceSchema, FetchOptions, FetchResult, SourceRecord, SourceField } from "../base";

interface MambuConfig {
  url: string;
  apiKey: string;
  branchId?: string;
}

export class MambuAdapter implements SourceAdapter {
  readonly type = "mambu";
  readonly name = "Mambu";
  readonly features = {
    cdc: true,
    incrementalSync: true,
    batchFetch: true,
    realtime: false, // Would need webhooks
  };

  private config!: MambuConfig;
  private connectionId!: string;

  async initialize(adapterConfig: AdapterConfig): Promise<void> {
    this.connectionId = adapterConfig.connectionId;
    this.config = adapterConfig.config as MambuConfig;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const response = await fetch(`${this.config.url}/api/setup/general`, {
        headers: {
          "Accept": "application/vnd.mambu.v2+json",
          "apikey": this.config.apiKey,
        },
      });

      if (!response.ok) {
        return {
          success: false,
          message: `Connection failed: ${response.status} ${response.statusText}`,
        };
      }

      const data = await response.json();

      return {
        success: true,
        message: "Connected successfully",
        details: {
          serverVersion: data.version,
          entities: ["LoanAccount", "Client", "Group", "LoanTransaction", "Document"],
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection error: ${(error as Error).message}`,
        error: error as Error,
      };
    }
  }

  async discoverSchema(): Promise<SourceSchema> {
    // Mambu has a fixed schema, so we return predefined entities
    return {
      adapter: this.type,
      version: "2.0",
      discoveredAt: new Date(),
      entities: [
        {
          name: "LoanAccount",
          displayName: "Loan Accounts",
          primaryKey: "encodedKey",
          supportsCDC: true,
          supportsIncrementalSync: true,
          fields: this.getLoanAccountFields(),
          recordCount: await this.getRecordCount("LoanAccount"),
        },
        {
          name: "Client",
          displayName: "Clients (Individuals)",
          primaryKey: "encodedKey",
          supportsCDC: true,
          supportsIncrementalSync: true,
          fields: this.getClientFields(),
          recordCount: await this.getRecordCount("Client"),
        },
        {
          name: "Group",
          displayName: "Groups (Companies)",
          primaryKey: "encodedKey",
          supportsCDC: true,
          supportsIncrementalSync: true,
          fields: this.getGroupFields(),
          recordCount: await this.getRecordCount("Group"),
        },
        {
          name: "LoanTransaction",
          displayName: "Loan Transactions",
          primaryKey: "encodedKey",
          supportsCDC: true,
          supportsIncrementalSync: true,
          fields: this.getTransactionFields(),
        },
        {
          name: "Document",
          displayName: "Documents",
          primaryKey: "encodedKey",
          supportsCDC: false,
          supportsIncrementalSync: true,
          fields: this.getDocumentFields(),
        },
      ],
    };
  }

  async fetchRecords(entity: string, options?: FetchOptions): Promise<FetchResult> {
    const endpoint = this.getEndpoint(entity);
    const params = new URLSearchParams();

    if (options?.limit) {
      params.set("paginationDetails", "ON");
      params.set("detailsLevel", "FULL");
      params.set("limit", options.limit.toString());
    }

    if (options?.cursor) {
      params.set("offset", options.cursor);
    }

    // Incremental sync support
    const filterCriteria: any[] = [];
    if (options?.since) {
      filterCriteria.push({
        field: "lastModifiedDate",
        operator: "AFTER",
        value: options.since.toISOString(),
      });
    }

    if (this.config.branchId) {
      filterCriteria.push({
        field: "assignedBranchKey",
        operator: "EQUALS",
        value: this.config.branchId,
      });
    }

    const url = `${this.config.url}${endpoint}${params.toString() ? `?${params}` : ""}`;

    const response = await fetch(url, {
      method: filterCriteria.length > 0 ? "POST" : "GET",
      headers: {
        "Accept": "application/vnd.mambu.v2+json",
        "Content-Type": "application/json",
        "apikey": this.config.apiKey,
      },
      body: filterCriteria.length > 0 ? JSON.stringify({
        filterCriteria,
        sortingCriteria: {
          field: "lastModifiedDate",
          order: "ASC",
        },
      }) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Mambu API error: ${response.status} ${response.statusText}`);
    }

    const records = await response.json();
    const totalCount = parseInt(response.headers.get("Items-Total") || "0", 10);
    const offset = parseInt(response.headers.get("Items-Offset") || "0", 10);
    const limit = options?.limit || records.length;

    return {
      records: records.map((r: any) => this.toSourceRecord(entity, r)),
      cursor: (offset + limit < totalCount) ? String(offset + limit) : undefined,
      hasMore: offset + limit < totalCount,
      totalCount,
    };
  }

  async getRecord(entity: string, id: string): Promise<SourceRecord | null> {
    const endpoint = this.getEndpoint(entity);
    const url = `${this.config.url}${endpoint}/${id}`;

    const response = await fetch(url, {
      headers: {
        "Accept": "application/vnd.mambu.v2+json",
        "apikey": this.config.apiKey,
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Mambu API error: ${response.status}`);
    }

    const record = await response.json();
    return this.toSourceRecord(entity, record);
  }

  async getRecordCount(entity: string, options?: FetchOptions): Promise<number> {
    const result = await this.fetchRecords(entity, { ...options, limit: 1 });
    return result.totalCount || 0;
  }

  async dispose(): Promise<void> {
    // Nothing to clean up for REST adapter
  }

  private getEndpoint(entity: string): string {
    const endpoints: Record<string, string> = {
      LoanAccount: "/api/loans",
      Client: "/api/clients",
      Group: "/api/groups",
      LoanTransaction: "/api/loans/transactions:search",
      Document: "/api/documents",
    };
    return endpoints[entity] || `/api/${entity.toLowerCase()}s`;
  }

  private toSourceRecord(entity: string, data: any): SourceRecord {
    return {
      id: data.encodedKey,
      entity,
      data,
      metadata: {
        createdAt: data.creationDate ? new Date(data.creationDate) : undefined,
        updatedAt: data.lastModifiedDate ? new Date(data.lastModifiedDate) : undefined,
      },
    };
  }

  private getLoanAccountFields(): SourceField[] {
    return [
      { name: "encodedKey", displayName: "Encoded Key", type: "string", nullable: false, primaryKey: true },
      { name: "id", displayName: "Account ID", type: "string", nullable: false, primaryKey: false },
      { name: "accountState", displayName: "State", type: "string", nullable: false, primaryKey: false },
      { name: "accountSubState", displayName: "Sub State", type: "string", nullable: true, primaryKey: false },
      { name: "loanAmount", displayName: "Loan Amount", type: "number", nullable: false, primaryKey: false },
      { name: "interestRate", displayName: "Interest Rate", type: "number", nullable: false, primaryKey: false },
      { name: "accountHolderKey", displayName: "Account Holder", type: "string", nullable: false, primaryKey: false, foreignKey: { entity: "Client", field: "encodedKey" } },
      { name: "accountHolderType", displayName: "Holder Type", type: "string", nullable: false, primaryKey: false },
      { name: "productTypeKey", displayName: "Product Key", type: "string", nullable: false, primaryKey: false },
      { name: "assignedBranchKey", displayName: "Branch", type: "string", nullable: true, primaryKey: false },
      { name: "disbursementDetails", displayName: "Disbursement", type: "json", nullable: true, primaryKey: false },
      { name: "balances", displayName: "Balances", type: "json", nullable: true, primaryKey: false },
      { name: "creationDate", displayName: "Created At", type: "datetime", nullable: false, primaryKey: false },
      { name: "lastModifiedDate", displayName: "Updated At", type: "datetime", nullable: false, primaryKey: false },
    ];
  }

  private getClientFields(): SourceField[] {
    return [
      { name: "encodedKey", displayName: "Encoded Key", type: "string", nullable: false, primaryKey: true },
      { name: "id", displayName: "Client ID", type: "string", nullable: false, primaryKey: false },
      { name: "firstName", displayName: "First Name", type: "string", nullable: false, primaryKey: false },
      { name: "lastName", displayName: "Last Name", type: "string", nullable: false, primaryKey: false },
      { name: "emailAddress", displayName: "Email", type: "string", nullable: true, primaryKey: false },
      { name: "state", displayName: "State", type: "string", nullable: false, primaryKey: false },
      { name: "creationDate", displayName: "Created At", type: "datetime", nullable: false, primaryKey: false },
      { name: "lastModifiedDate", displayName: "Updated At", type: "datetime", nullable: false, primaryKey: false },
    ];
  }

  private getGroupFields(): SourceField[] {
    return [
      { name: "encodedKey", displayName: "Encoded Key", type: "string", nullable: false, primaryKey: true },
      { name: "id", displayName: "Group ID", type: "string", nullable: false, primaryKey: false },
      { name: "groupName", displayName: "Name", type: "string", nullable: false, primaryKey: false },
      { name: "creationDate", displayName: "Created At", type: "datetime", nullable: false, primaryKey: false },
      { name: "lastModifiedDate", displayName: "Updated At", type: "datetime", nullable: false, primaryKey: false },
    ];
  }

  private getTransactionFields(): SourceField[] {
    return [
      { name: "encodedKey", displayName: "Encoded Key", type: "string", nullable: false, primaryKey: true },
      { name: "type", displayName: "Type", type: "string", nullable: false, primaryKey: false },
      { name: "amount", displayName: "Amount", type: "number", nullable: false, primaryKey: false },
      { name: "valueDate", displayName: "Value Date", type: "date", nullable: false, primaryKey: false },
      { name: "parentAccountKey", displayName: "Loan Account", type: "string", nullable: false, primaryKey: false, foreignKey: { entity: "LoanAccount", field: "encodedKey" } },
    ];
  }

  private getDocumentFields(): SourceField[] {
    return [
      { name: "encodedKey", displayName: "Encoded Key", type: "string", nullable: false, primaryKey: true },
      { name: "name", displayName: "Name", type: "string", nullable: false, primaryKey: false },
      { name: "type", displayName: "Type", type: "string", nullable: false, primaryKey: false },
      { name: "fileSize", displayName: "File Size", type: "number", nullable: true, primaryKey: false },
      { name: "ownerKey", displayName: "Owner Key", type: "string", nullable: false, primaryKey: false },
    ];
  }
}

// Register the adapter
import { adapterRegistry } from "../base";
adapterRegistry.register("mambu", MambuAdapter);
```

### CSV Adapter Implementation

```typescript
// packages/shadow/src/adapters/csv/adapter.ts

import * as fs from "fs";
import * as path from "path";
import { parse } from "csv-parse";
import { SourceAdapter, AdapterConfig, ConnectionTestResult, SourceSchema, FetchOptions, FetchResult, SourceRecord, SourceField, SourceEntity } from "../base";

interface CSVConfig {
  directory: string;
  filePattern: string;
  entityMappings: {
    filename: string;
    entity: string;
    primaryKey: string;
    delimiter?: string;
  }[];
}

export class CSVAdapter implements SourceAdapter {
  readonly type = "csv";
  readonly name = "CSV Files";
  readonly features = {
    cdc: false,
    incrementalSync: false,
    batchFetch: true,
    realtime: false,
  };

  private config!: CSVConfig;
  private connectionId!: string;

  async initialize(adapterConfig: AdapterConfig): Promise<void> {
    this.connectionId = adapterConfig.connectionId;
    this.config = adapterConfig.config as CSVConfig;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      // Check directory exists
      if (!fs.existsSync(this.config.directory)) {
        return {
          success: false,
          message: `Directory not found: ${this.config.directory}`,
        };
      }

      // Check for expected files
      const files = fs.readdirSync(this.config.directory);
      const foundEntities: string[] = [];

      for (const mapping of this.config.entityMappings) {
        if (files.includes(mapping.filename)) {
          foundEntities.push(mapping.entity);
        }
      }

      return {
        success: true,
        message: `Found ${foundEntities.length} entity files`,
        details: {
          entities: foundEntities,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error accessing directory: ${(error as Error).message}`,
        error: error as Error,
      };
    }
  }

  async discoverSchema(): Promise<SourceSchema> {
    const entities: SourceEntity[] = [];

    for (const mapping of this.config.entityMappings) {
      const filePath = path.join(this.config.directory, mapping.filename);

      if (!fs.existsSync(filePath)) {
        continue;
      }

      const fields = await this.discoverFields(filePath, mapping.delimiter || ",");
      const recordCount = await this.countRecords(filePath);

      entities.push({
        name: mapping.entity,
        displayName: mapping.entity,
        primaryKey: mapping.primaryKey,
        supportsCDC: false,
        supportsIncrementalSync: false,
        fields,
        recordCount,
      });
    }

    return {
      adapter: this.type,
      version: "1.0",
      discoveredAt: new Date(),
      entities,
    };
  }

  async fetchRecords(entity: string, options?: FetchOptions): Promise<FetchResult> {
    const mapping = this.config.entityMappings.find(m => m.entity === entity);
    if (!mapping) {
      throw new Error(`Unknown entity: ${entity}`);
    }

    const filePath = path.join(this.config.directory, mapping.filename);
    const records: SourceRecord[] = [];
    const limit = options?.limit || 1000;
    const offset = parseInt(options?.cursor || "0", 10);

    const fileStream = fs.createReadStream(filePath);
    const parser = fileStream.pipe(
      parse({
        columns: true,
        delimiter: mapping.delimiter || ",",
        skip_empty_lines: true,
      })
    );

    let index = 0;
    for await (const row of parser) {
      if (index >= offset && records.length < limit) {
        records.push({
          id: row[mapping.primaryKey],
          entity,
          data: row,
          metadata: {},
        });
      }
      index++;

      if (records.length >= limit) {
        break;
      }
    }

    const totalCount = await this.countRecords(filePath);
    const nextOffset = offset + records.length;

    return {
      records,
      cursor: nextOffset < totalCount ? String(nextOffset) : undefined,
      hasMore: nextOffset < totalCount,
      totalCount,
    };
  }

  async getRecord(entity: string, id: string): Promise<SourceRecord | null> {
    const result = await this.fetchRecords(entity, { limit: 10000 });
    return result.records.find(r => r.id === id) || null;
  }

  async getRecordCount(entity: string): Promise<number> {
    const mapping = this.config.entityMappings.find(m => m.entity === entity);
    if (!mapping) {
      return 0;
    }
    const filePath = path.join(this.config.directory, mapping.filename);
    return this.countRecords(filePath);
  }

  async dispose(): Promise<void> {
    // Nothing to clean up
  }

  private async discoverFields(filePath: string, delimiter: string): Promise<SourceField[]> {
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath);
      const parser = stream.pipe(
        parse({
          columns: true,
          delimiter,
          to: 1, // Only read first data row
        })
      );

      parser.on("data", (row) => {
        const fields: SourceField[] = Object.keys(row).map(name => ({
          name,
          displayName: name,
          type: this.inferType(row[name]),
          nullable: true,
          primaryKey: false,
        }));
        stream.destroy();
        resolve(fields);
      });

      parser.on("error", reject);
      parser.on("end", () => resolve([]));
    });
  }

  private async countRecords(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      let count = 0;
      const stream = fs.createReadStream(filePath);
      const parser = stream.pipe(
        parse({
          delimiter: ",",
          skip_empty_lines: true,
        })
      );

      parser.on("data", () => count++);
      parser.on("error", reject);
      parser.on("end", () => resolve(count - 1)); // Subtract header row
    });
  }

  private inferType(value: string): SourceField["type"] {
    if (value === "" || value === null || value === undefined) {
      return "string";
    }
    if (!isNaN(Number(value))) {
      return "number";
    }
    if (value === "true" || value === "false") {
      return "boolean";
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return "date";
    }
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      return "datetime";
    }
    return "string";
  }
}

import { adapterRegistry } from "../base";
adapterRegistry.register("csv", CSVAdapter);
```

---

## 4. Sync Engine

```typescript
// packages/shadow/src/sync/engine.ts

import { Database } from "@open-los/core";
import { SourceAdapter, FetchOptions, SourceRecord } from "../adapters/base";
import { SchemaMapper, MappedRecord } from "./mapper";
import { shadowSyncRuns, shadowSyncEntities, shadowSourceRecords } from "../schema/shadow-tables";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface SyncConfig {
  connectionId: string;
  mode: "full" | "incremental";
  entities?: string[];
  batchSize?: number;
  onProgress?: (progress: SyncProgress) => void;
}

export interface SyncProgress {
  entity: string;
  processed: number;
  total: number;
  created: number;
  updated: number;
  failed: number;
}

export interface SyncResult {
  runId: string;
  status: "completed" | "partial" | "failed";
  startedAt: Date;
  completedAt: Date;
  entities: EntitySyncResult[];
  errors: SyncError[];
}

export interface EntitySyncResult {
  entity: string;
  sourceCount: number;
  processed: number;
  created: number;
  updated: number;
  failed: number;
  errors: SyncError[];
}

export interface SyncError {
  entity: string;
  recordId?: string;
  error: string;
  timestamp: Date;
}

export class SyncEngine {
  constructor(
    private db: Database,
    private adapter: SourceAdapter,
    private mapper: SchemaMapper
  ) {}

  async runSync(config: SyncConfig): Promise<SyncResult> {
    const runId = randomUUID();
    const startedAt = new Date();
    const errors: SyncError[] = [];
    const entityResults: EntitySyncResult[] = [];

    // Create sync run record
    await this.db.insert(shadowSyncRuns).values({
      id: runId,
      connection_id: config.connectionId,
      started_at: startedAt.toISOString(),
      mode: config.mode,
      status: "running",
    });

    try {
      // Get entities to sync
      const schema = await this.adapter.discoverSchema();
      const entitiesToSync = config.entities
        ? schema.entities.filter(e => config.entities!.includes(e.name))
        : schema.entities;

      // Sync each entity
      for (const entity of entitiesToSync) {
        const result = await this.syncEntity(
          runId,
          config.connectionId,
          entity.name,
          config.mode,
          config.batchSize || 500,
          config.onProgress
        );
        entityResults.push(result);
        errors.push(...result.errors);
      }

      // Update sync run record
      const status = errors.length === 0 ? "completed" : "partial";
      const completedAt = new Date();

      await this.db
        .update(shadowSyncRuns)
        .set({
          completed_at: completedAt.toISOString(),
          status,
          total_records_processed: entityResults.reduce((sum, e) => sum + e.processed, 0),
          records_created: entityResults.reduce((sum, e) => sum + e.created, 0),
          records_updated: entityResults.reduce((sum, e) => sum + e.updated, 0),
          records_failed: entityResults.reduce((sum, e) => sum + e.failed, 0),
          error_log: JSON.stringify(errors),
        })
        .where(eq(shadowSyncRuns.id, runId));

      return {
        runId,
        status,
        startedAt,
        completedAt,
        entities: entityResults,
        errors,
      };
    } catch (error) {
      // Mark sync as failed
      await this.db
        .update(shadowSyncRuns)
        .set({
          completed_at: new Date().toISOString(),
          status: "failed",
          error_log: JSON.stringify([{
            entity: "global",
            error: (error as Error).message,
            timestamp: new Date(),
          }]),
        })
        .where(eq(shadowSyncRuns.id, runId));

      throw error;
    }
  }

  private async syncEntity(
    runId: string,
    connectionId: string,
    entity: string,
    mode: "full" | "incremental",
    batchSize: number,
    onProgress?: (progress: SyncProgress) => void
  ): Promise<EntitySyncResult> {
    const errors: SyncError[] = [];
    let processed = 0;
    let created = 0;
    let updated = 0;
    let failed = 0;

    // Create entity sync record
    const entitySyncId = randomUUID();
    await this.db.insert(shadowSyncEntities).values({
      id: entitySyncId,
      sync_run_id: runId,
      entity,
      status: "running",
      started_at: new Date().toISOString(),
    });

    try {
      // Get last sync timestamp for incremental
      const fetchOptions: FetchOptions = {
        limit: batchSize,
      };

      if (mode === "incremental") {
        const lastSync = await this.getLastSyncTimestamp(connectionId, entity);
        if (lastSync) {
          fetchOptions.since = lastSync;
        }
      }

      // Fetch and process records in batches
      let hasMore = true;
      let cursor: string | undefined;
      let sourceCount = 0;

      while (hasMore) {
        fetchOptions.cursor = cursor;
        const result = await this.adapter.fetchRecords(entity, fetchOptions);
        sourceCount = result.totalCount || sourceCount;

        for (const record of result.records) {
          try {
            const syncResult = await this.syncRecord(connectionId, entity, record);
            processed++;

            if (syncResult === "created") created++;
            else if (syncResult === "updated") updated++;

            onProgress?.({
              entity,
              processed,
              total: sourceCount,
              created,
              updated,
              failed,
            });
          } catch (error) {
            failed++;
            errors.push({
              entity,
              recordId: record.id,
              error: (error as Error).message,
              timestamp: new Date(),
            });
          }
        }

        cursor = result.cursor;
        hasMore = result.hasMore;
      }

      // Update entity sync record
      await this.db
        .update(shadowSyncEntities)
        .set({
          source_count: sourceCount,
          processed,
          created,
          updated,
          failed,
          completed_at: new Date().toISOString(),
          status: failed > 0 ? "completed" : "completed",
          errors: JSON.stringify(errors),
        })
        .where(eq(shadowSyncEntities.id, entitySyncId));

      return {
        entity,
        sourceCount,
        processed,
        created,
        updated,
        failed,
        errors,
      };
    } catch (error) {
      await this.db
        .update(shadowSyncEntities)
        .set({
          completed_at: new Date().toISOString(),
          status: "failed",
          errors: JSON.stringify([{
            entity,
            error: (error as Error).message,
            timestamp: new Date(),
          }]),
        })
        .where(eq(shadowSyncEntities.id, entitySyncId));

      throw error;
    }
  }

  private async syncRecord(
    connectionId: string,
    entity: string,
    record: SourceRecord
  ): Promise<"created" | "updated" | "skipped"> {
    // Check if we've seen this record before
    const existingMapping = await this.db.query.shadowSourceRecords.findFirst({
      where: and(
        eq(shadowSourceRecords.connection_id, connectionId),
        eq(shadowSourceRecords.entity, entity),
        eq(shadowSourceRecords.source_id, record.id)
      ),
    });

    // Compute hash for change detection
    const newHash = this.computeHash(record.data);

    if (existingMapping) {
      // Check if record has changed
      if (existingMapping.source_hash === newHash) {
        return "skipped";
      }

      // Update existing record
      const mappedRecord = await this.mapper.map(entity, record);
      await this.upsertToOpenLOS(mappedRecord, existingMapping.shadow_id!);

      // Update tracking record
      await this.db
        .update(shadowSourceRecords)
        .set({
          source_hash: newHash,
          source_updated_at: record.metadata.updatedAt?.toISOString(),
          sync_status: "synced",
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .where(eq(shadowSourceRecords.id, existingMapping.id));

      return "updated";
    } else {
      // Create new record
      const mappedRecord = await this.mapper.map(entity, record);
      const shadowId = await this.insertToOpenLOS(mappedRecord);

      // Create tracking record
      await this.db.insert(shadowSourceRecords).values({
        id: randomUUID(),
        connection_id: connectionId,
        entity,
        source_id: record.id,
        shadow_id: shadowId,
        source_hash: newHash,
        source_updated_at: record.metadata.updatedAt?.toISOString(),
        sync_status: "synced",
        last_synced_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      return "created";
    }
  }

  private async insertToOpenLOS(record: MappedRecord): Promise<string> {
    // This would call the appropriate Open LOS service based on entity type
    // For now, return a placeholder
    const id = randomUUID();

    switch (record.targetEntity) {
      case "deals":
        // await this.dealService.create(record.data, "shadow-sync", record.tenantId);
        break;
      case "entities":
        // await this.entityService.create(record.data, "shadow-sync", record.tenantId);
        break;
      case "loan_accounts":
        // await this.loanAccountService.create(record.data, "shadow-sync");
        break;
      // ... other entity types
    }

    return id;
  }

  private async upsertToOpenLOS(record: MappedRecord, shadowId: string): Promise<void> {
    // Update existing Open LOS record
    switch (record.targetEntity) {
      case "deals":
        // await this.dealService.update(shadowId, record.data, "shadow-sync");
        break;
      // ... other entity types
    }
  }

  private async getLastSyncTimestamp(connectionId: string, entity: string): Promise<Date | null> {
    const result = await this.db.query.shadowSourceRecords.findFirst({
      where: and(
        eq(shadowSourceRecords.connection_id, connectionId),
        eq(shadowSourceRecords.entity, entity)
      ),
      orderBy: (records, { desc }) => [desc(records.source_updated_at)],
    });

    return result?.source_updated_at ? new Date(result.source_updated_at) : null;
  }

  private computeHash(data: Record<string, unknown>): string {
    const str = JSON.stringify(data, Object.keys(data).sort());
    // Simple hash function - in production use crypto
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }
}
```

---

## 5. Validation Engine

```typescript
// packages/shadow/src/validation/engine.ts

import { Database } from "@open-los/core";
import { SourceAdapter } from "../adapters/base";
import { shadowValidations, shadowValidationEntities, shadowDiscrepancies, shadowSourceRecords } from "../schema/shadow-tables";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface ValidationConfig {
  connectionId: string;
  entities?: string[];
  tolerance?: {
    numeric: number;
    dateSeconds: number;
  };
  ignoreFields?: string[];
}

export interface ValidationResult {
  validationId: string;
  runAt: Date;
  completedAt: Date;

  coverageScore: number;
  accuracyScore: number;
  readinessScore: number;

  summary: {
    totalSourceRecords: number;
    totalShadowRecords: number;
    matchedRecords: number;
    mismatchedRecords: number;
    missingInShadow: number;
    extraInShadow: number;
  };

  byEntity: EntityValidationResult[];
}

export interface EntityValidationResult {
  entity: string;
  sourceCount: number;
  shadowCount: number;
  matchedCount: number;
  mismatchedCount: number;
  missingCount: number;
  extraCount: number;
  coveragePct: number;
  accuracyPct: number;
}

export interface Discrepancy {
  id: string;
  entity: string;
  sourceId: string | null;
  shadowId: string | null;
  type: "missing_in_shadow" | "missing_in_source" | "field_mismatch" | "extra_in_shadow";
  fieldName?: string;
  sourceValue?: string;
  shadowValue?: string;
  severity: "critical" | "important" | "minor";
  status: "open" | "resolved" | "accepted" | "ignored";
}

export class ValidationEngine {
  constructor(
    private db: Database,
    private adapter: SourceAdapter
  ) {}

  async runValidation(config: ValidationConfig): Promise<ValidationResult> {
    const validationId = randomUUID();
    const runAt = new Date();

    // Create validation record
    await this.db.insert(shadowValidations).values({
      id: validationId,
      connection_id: config.connectionId,
      run_at: runAt.toISOString(),
      status: "running",
    });

    try {
      const schema = await this.adapter.discoverSchema();
      const entitiesToValidate = config.entities
        ? schema.entities.filter(e => config.entities!.includes(e.name))
        : schema.entities;

      const entityResults: EntityValidationResult[] = [];
      let totalSource = 0;
      let totalShadow = 0;
      let totalMatched = 0;
      let totalMismatched = 0;
      let totalMissingInShadow = 0;
      let totalExtraInShadow = 0;

      for (const entity of entitiesToValidate) {
        const result = await this.validateEntity(
          validationId,
          config.connectionId,
          entity.name,
          config
        );
        entityResults.push(result);

        totalSource += result.sourceCount;
        totalShadow += result.shadowCount;
        totalMatched += result.matchedCount;
        totalMismatched += result.mismatchedCount;
        totalMissingInShadow += result.missingCount;
        totalExtraInShadow += result.extraCount;
      }

      // Calculate scores
      const coverageScore = totalSource > 0
        ? ((totalMatched + totalMismatched) / totalSource) * 100
        : 100;

      const accuracyScore = (totalMatched + totalMismatched) > 0
        ? (totalMatched / (totalMatched + totalMismatched)) * 100
        : 100;

      // Readiness score = weighted combination
      const gapPenalty = await this.calculateGapPenalty(config.connectionId);
      const readinessScore = Math.max(0,
        (coverageScore * 0.4) + (accuracyScore * 0.4) + ((100 - gapPenalty) * 0.2)
      );

      const completedAt = new Date();

      // Update validation record
      await this.db
        .update(shadowValidations)
        .set({
          completed_at: completedAt.toISOString(),
          coverage_score: coverageScore,
          accuracy_score: accuracyScore,
          readiness_score: readinessScore,
          total_source_records: totalSource,
          total_shadow_records: totalShadow,
          matched_records: totalMatched,
          mismatched_records: totalMismatched,
          missing_in_shadow: totalMissingInShadow,
          extra_in_shadow: totalExtraInShadow,
          status: "completed",
        })
        .where(eq(shadowValidations.id, validationId));

      return {
        validationId,
        runAt,
        completedAt,
        coverageScore,
        accuracyScore,
        readinessScore,
        summary: {
          totalSourceRecords: totalSource,
          totalShadowRecords: totalShadow,
          matchedRecords: totalMatched,
          mismatchedRecords: totalMismatched,
          missingInShadow: totalMissingInShadow,
          extraInShadow: totalExtraInShadow,
        },
        byEntity: entityResults,
      };
    } catch (error) {
      await this.db
        .update(shadowValidations)
        .set({
          completed_at: new Date().toISOString(),
          status: "failed",
        })
        .where(eq(shadowValidations.id, validationId));

      throw error;
    }
  }

  private async validateEntity(
    validationId: string,
    connectionId: string,
    entity: string,
    config: ValidationConfig
  ): Promise<EntityValidationResult> {
    // Get all tracked source records for this entity
    const trackedRecords = await this.db.query.shadowSourceRecords.findMany({
      where: and(
        eq(shadowSourceRecords.connection_id, connectionId),
        eq(shadowSourceRecords.entity, entity)
      ),
    });

    const sourceCount = await this.adapter.getRecordCount(entity);
    const shadowCount = trackedRecords.filter(r => r.shadow_id).length;

    let matchedCount = 0;
    let mismatchedCount = 0;
    let missingCount = 0;

    // Compare each tracked record
    for (const tracked of trackedRecords) {
      if (!tracked.shadow_id) {
        missingCount++;
        await this.recordDiscrepancy(validationId, {
          entity,
          sourceId: tracked.source_id,
          shadowId: null,
          type: "missing_in_shadow",
          severity: "critical",
        });
        continue;
      }

      // Fetch current source record
      const sourceRecord = await this.adapter.getRecord(entity, tracked.source_id);
      if (!sourceRecord) {
        // Record deleted in source
        await this.recordDiscrepancy(validationId, {
          entity,
          sourceId: tracked.source_id,
          shadowId: tracked.shadow_id,
          type: "missing_in_source",
          severity: "important",
        });
        continue;
      }

      // Fetch shadow record
      const shadowRecord = await this.getShadowRecord(entity, tracked.shadow_id);
      if (!shadowRecord) {
        missingCount++;
        await this.recordDiscrepancy(validationId, {
          entity,
          sourceId: tracked.source_id,
          shadowId: tracked.shadow_id,
          type: "missing_in_shadow",
          severity: "critical",
        });
        continue;
      }

      // Compare records
      const mismatches = this.compareRecords(
        sourceRecord.data,
        shadowRecord,
        config.tolerance,
        config.ignoreFields
      );

      if (mismatches.length === 0) {
        matchedCount++;
      } else {
        mismatchedCount++;
        for (const mismatch of mismatches) {
          await this.recordDiscrepancy(validationId, {
            entity,
            sourceId: tracked.source_id,
            shadowId: tracked.shadow_id,
            type: "field_mismatch",
            fieldName: mismatch.field,
            sourceValue: String(mismatch.sourceValue),
            shadowValue: String(mismatch.shadowValue),
            severity: this.classifySeverity(mismatch.field),
          });
        }
      }
    }

    // Check for records in shadow that don't exist in source (extras)
    const extraCount = shadowCount - (matchedCount + mismatchedCount + missingCount);

    const coveragePct = sourceCount > 0 ? ((matchedCount + mismatchedCount) / sourceCount) * 100 : 100;
    const accuracyPct = (matchedCount + mismatchedCount) > 0 ? (matchedCount / (matchedCount + mismatchedCount)) * 100 : 100;

    // Record entity validation result
    await this.db.insert(shadowValidationEntities).values({
      id: randomUUID(),
      validation_id: validationId,
      entity,
      source_count: sourceCount,
      shadow_count: shadowCount,
      matched_count: matchedCount,
      mismatched_count: mismatchedCount,
      missing_count: missingCount,
      extra_count: extraCount,
      coverage_pct: coveragePct,
      accuracy_pct: accuracyPct,
    });

    return {
      entity,
      sourceCount,
      shadowCount,
      matchedCount,
      mismatchedCount,
      missingCount,
      extraCount,
      coveragePct,
      accuracyPct,
    };
  }

  private compareRecords(
    source: Record<string, unknown>,
    shadow: Record<string, unknown>,
    tolerance?: { numeric: number; dateSeconds: number },
    ignoreFields?: string[]
  ): { field: string; sourceValue: unknown; shadowValue: unknown }[] {
    const mismatches: { field: string; sourceValue: unknown; shadowValue: unknown }[] = [];
    const ignore = new Set(ignoreFields || []);

    for (const [field, sourceValue] of Object.entries(source)) {
      if (ignore.has(field)) continue;

      const shadowValue = shadow[field];

      if (!this.valuesMatch(sourceValue, shadowValue, tolerance)) {
        mismatches.push({ field, sourceValue, shadowValue });
      }
    }

    return mismatches;
  }

  private valuesMatch(
    source: unknown,
    shadow: unknown,
    tolerance?: { numeric: number; dateSeconds: number }
  ): boolean {
    // Null/undefined handling
    if (source === null || source === undefined) {
      return shadow === null || shadow === undefined;
    }
    if (shadow === null || shadow === undefined) {
      return false;
    }

    // Numeric tolerance
    if (typeof source === "number" && typeof shadow === "number") {
      return Math.abs(source - shadow) <= (tolerance?.numeric || 0);
    }

    // Date tolerance
    if (source instanceof Date && shadow instanceof Date) {
      const diffSeconds = Math.abs(source.getTime() - shadow.getTime()) / 1000;
      return diffSeconds <= (tolerance?.dateSeconds || 0);
    }

    // String comparison (case-insensitive by default)
    if (typeof source === "string" && typeof shadow === "string") {
      return source.toLowerCase() === shadow.toLowerCase();
    }

    // Deep equality for objects
    if (typeof source === "object" && typeof shadow === "object") {
      return JSON.stringify(source) === JSON.stringify(shadow);
    }

    // Strict equality fallback
    return source === shadow;
  }

  private async recordDiscrepancy(
    validationId: string,
    discrepancy: Omit<Discrepancy, "id" | "status">
  ): Promise<void> {
    await this.db.insert(shadowDiscrepancies).values({
      id: randomUUID(),
      validation_id: validationId,
      entity: discrepancy.entity,
      source_id: discrepancy.sourceId,
      shadow_id: discrepancy.shadowId,
      type: discrepancy.type,
      field_name: discrepancy.fieldName,
      source_value: discrepancy.sourceValue,
      shadow_value: discrepancy.shadowValue,
      severity: discrepancy.severity,
      status: "open",
      created_at: new Date().toISOString(),
    });
  }

  private classifySeverity(field: string): "critical" | "important" | "minor" {
    const criticalFields = ["id", "amount", "balance", "state", "status"];
    const importantFields = ["date", "name", "type", "rate"];

    if (criticalFields.some(f => field.toLowerCase().includes(f))) {
      return "critical";
    }
    if (importantFields.some(f => field.toLowerCase().includes(f))) {
      return "important";
    }
    return "minor";
  }

  private async getShadowRecord(entity: string, shadowId: string): Promise<Record<string, unknown> | null> {
    // This would query the appropriate Open LOS table
    // Implementation depends on entity type
    return null; // Placeholder
  }

  private async calculateGapPenalty(connectionId: string): Promise<number> {
    // Query gaps and calculate penalty
    // Critical = 20 points, Important = 5 points, Minor = 1 point
    return 0; // Placeholder
  }
}
```

---

## 6. API Implementation

```typescript
// packages/api/src/routes/shadow.ts

import { Hono } from "hono";
import { Context } from "../context";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

const shadowRoutes = new Hono<{ Variables: { ctx: Context } }>();

// Create connection
shadowRoutes.post(
  "/connections",
  zValidator("json", z.object({
    name: z.string().min(1),
    adapter_type: z.enum(["mambu", "ncino", "csv", "webhook", "custom_api"]),
    config: z.record(z.unknown()),
  })),
  async (c) => {
    const body = c.req.valid("json");
    const actor = c.req.header("X-Actor") || "system";

    const connection = await c.var.ctx.shadowService.createConnection(
      body.name,
      body.adapter_type,
      body.config,
      actor
    );

    return c.json(connection, 201);
  }
);

// List connections
shadowRoutes.get("/connections", async (c) => {
  const connections = await c.var.ctx.shadowService.listConnections();
  return c.json({ connections });
});

// Test connection
shadowRoutes.post("/connections/:id/test", async (c) => {
  const id = c.req.param("id");
  const result = await c.var.ctx.shadowService.testConnection(id);
  return c.json(result);
});

// Discover schema
shadowRoutes.get("/connections/:id/discover", async (c) => {
  const id = c.req.param("id");
  const schema = await c.var.ctx.shadowService.discoverSchema(id);
  return c.json(schema);
});

// Create/update mapping
shadowRoutes.post(
  "/mappings",
  zValidator("json", z.object({
    connection_id: z.string(),
    source_entity: z.string(),
    target_entity: z.string(),
    field_mappings: z.array(z.object({
      source: z.string(),
      target: z.string(),
      transform: z.string().optional(),
    })),
  })),
  async (c) => {
    const body = c.req.valid("json");
    const mapping = await c.var.ctx.shadowService.createMapping(body);
    return c.json(mapping, 201);
  }
);

// List mappings
shadowRoutes.get("/mappings", async (c) => {
  const connectionId = c.req.query("connection_id");
  const mappings = await c.var.ctx.shadowService.listMappings(connectionId);
  return c.json({ mappings });
});

// Trigger sync
shadowRoutes.post(
  "/sync",
  zValidator("json", z.object({
    connection_id: z.string(),
    mode: z.enum(["full", "incremental"]).default("incremental"),
    entities: z.array(z.string()).optional(),
  })),
  async (c) => {
    const body = c.req.valid("json");
    const actor = c.req.header("X-Actor") || "system";

    const syncRun = await c.var.ctx.shadowService.startSync(
      body.connection_id,
      body.mode,
      body.entities,
      actor
    );

    return c.json(syncRun, 202);
  }
);

// Get sync status
shadowRoutes.get("/sync/:id/status", async (c) => {
  const id = c.req.param("id");
  const status = await c.var.ctx.shadowService.getSyncStatus(id);
  return c.json(status);
});

// List sync history
shadowRoutes.get("/sync", async (c) => {
  const connectionId = c.req.query("connection_id");
  const limit = parseInt(c.req.query("limit") || "10", 10);
  const runs = await c.var.ctx.shadowService.listSyncRuns(connectionId, limit);
  return c.json({ runs });
});

// Trigger validation
shadowRoutes.post(
  "/validation",
  zValidator("json", z.object({
    connection_id: z.string(),
    entities: z.array(z.string()).optional(),
  })),
  async (c) => {
    const body = c.req.valid("json");
    const validation = await c.var.ctx.shadowService.startValidation(
      body.connection_id,
      body.entities
    );
    return c.json(validation, 202);
  }
);

// Get validation result
shadowRoutes.get("/validation/:id", async (c) => {
  const id = c.req.param("id");
  const result = await c.var.ctx.shadowService.getValidationResult(id);
  return c.json(result);
});

// List validation history
shadowRoutes.get("/validation", async (c) => {
  const connectionId = c.req.query("connection_id");
  const limit = parseInt(c.req.query("limit") || "10", 10);
  const validations = await c.var.ctx.shadowService.listValidations(connectionId, limit);
  return c.json({ validations });
});

// Get discrepancies
shadowRoutes.get("/validation/:id/discrepancies", async (c) => {
  const id = c.req.param("id");
  const severity = c.req.query("severity") as "critical" | "important" | "minor" | undefined;
  const status = c.req.query("status") as "open" | "resolved" | "accepted" | undefined;

  const discrepancies = await c.var.ctx.shadowService.getDiscrepancies(id, {
    severity,
    status,
  });

  return c.json({ discrepancies });
});

// Resolve discrepancy
shadowRoutes.patch(
  "/discrepancies/:id",
  zValidator("json", z.object({
    status: z.enum(["resolved", "accepted", "ignored"]),
    resolution_notes: z.string().optional(),
  })),
  async (c) => {
    const id = c.req.param("id");
    const body = c.req.valid("json");
    const actor = c.req.header("X-Actor") || "system";

    await c.var.ctx.shadowService.resolveDiscrepancy(
      id,
      body.status,
      body.resolution_notes,
      actor
    );

    return c.json({ success: true });
  }
);

// Get/manage gaps
shadowRoutes.get("/gaps", async (c) => {
  const connectionId = c.req.query("connection_id");
  const status = c.req.query("status");
  const gaps = await c.var.ctx.shadowService.listGaps(connectionId, status);
  return c.json({ gaps });
});

shadowRoutes.post(
  "/gaps",
  zValidator("json", z.object({
    connection_id: z.string(),
    gap_type: z.enum(["field", "entity", "workflow", "integration", "feature"]),
    severity: z.enum(["critical", "important", "minor"]),
    title: z.string(),
    description: z.string(),
    source_feature: z.string().optional(),
    remediation_plan: z.string().optional(),
  })),
  async (c) => {
    const body = c.req.valid("json");
    const gap = await c.var.ctx.shadowService.createGap(body);
    return c.json(gap, 201);
  }
);

shadowRoutes.patch(
  "/gaps/:id",
  zValidator("json", z.object({
    status: z.enum(["open", "in_progress", "resolved", "accepted"]).optional(),
    remediation_plan: z.string().optional(),
    remediation_effort: z.enum(["low", "medium", "high"]).optional(),
  })),
  async (c) => {
    const id = c.req.param("id");
    const body = c.req.valid("json");
    const gap = await c.var.ctx.shadowService.updateGap(id, body);
    return c.json(gap);
  }
);

// Get readiness dashboard
shadowRoutes.get("/readiness", async (c) => {
  const connectionId = c.req.query("connection_id");

  if (!connectionId) {
    return c.json({ error: "connection_id is required" }, 400);
  }

  const readiness = await c.var.ctx.shadowService.getReadinessDashboard(connectionId);
  return c.json(readiness);
});

// Generate report
shadowRoutes.get("/report", async (c) => {
  const connectionId = c.req.query("connection_id");
  const format = c.req.query("format") || "json";
  const from = c.req.query("from");
  const to = c.req.query("to");

  if (!connectionId) {
    return c.json({ error: "connection_id is required" }, 400);
  }

  const report = await c.var.ctx.shadowService.generateReport(
    connectionId,
    format as "json" | "csv" | "pdf",
    from ? new Date(from) : undefined,
    to ? new Date(to) : undefined
  );

  if (format === "json") {
    return c.json(report);
  }

  // For CSV/PDF, return file download
  const contentType = format === "csv" ? "text/csv" : "application/pdf";
  c.header("Content-Type", contentType);
  c.header("Content-Disposition", `attachment; filename="shadow-report.${format}"`);
  return c.body(report as string);
});

export { shadowRoutes };
```

---

## 7. CLI Implementation

```typescript
// packages/shadow-cli/src/index.ts

#!/usr/bin/env node

import { Command } from "commander";
import { initCommand } from "./commands/init";
import { connectCommand } from "./commands/connect";
import { syncCommand } from "./commands/sync";
import { validateCommand } from "./commands/validate";
import { statusCommand } from "./commands/status";
import { reportCommand } from "./commands/report";

const program = new Command();

program
  .name("open-los-shadow")
  .description("Open LOS Shadow Migration CLI")
  .version("1.0.0");

program
  .command("init")
  .description("Initialize shadow migration environment")
  .option("-a, --adapter <type>", "Source system adapter", "mambu")
  .option("-d, --directory <path>", "Data directory", "./shadow-data")
  .option("--docker", "Use Docker deployment")
  .action(initCommand);

program
  .command("connect")
  .description("Connect to source system")
  .requiredOption("-u, --url <url>", "Source system URL")
  .option("-k, --api-key <key>", "API key (or use env var)")
  .option("-n, --name <name>", "Connection name")
  .action(connectCommand);

program
  .command("sync")
  .description("Run data synchronization")
  .option("-c, --connection <id>", "Connection ID")
  .option("-m, --mode <mode>", "Sync mode", "incremental")
  .option("-e, --entities <list>", "Entities to sync (comma-separated)")
  .option("--continuous", "Run continuous sync")
  .option("--interval <duration>", "Sync interval", "15m")
  .action(syncCommand);

program
  .command("validate")
  .description("Run validation comparison")
  .option("-c, --connection <id>", "Connection ID")
  .option("-e, --entities <list>", "Entities to validate (comma-separated)")
  .option("-o, --output <format>", "Output format", "table")
  .action(validateCommand);

program
  .command("status")
  .description("Check shadow migration status")
  .option("-c, --connection <id>", "Connection ID")
  .option("-w, --watch", "Watch mode")
  .action(statusCommand);

program
  .command("report")
  .description("Generate migration readiness report")
  .requiredOption("-c, --connection <id>", "Connection ID")
  .option("-f, --format <format>", "Output format", "json")
  .option("-o, --output <path>", "Output file path")
  .action(reportCommand);

program.parse();
```

```typescript
// packages/shadow-cli/src/commands/init.ts

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

interface InitOptions {
  adapter: string;
  directory: string;
  docker?: boolean;
}

export async function initCommand(options: InitOptions): Promise<void> {
  console.log("🚀 Initializing Open LOS Shadow Migration\n");

  // Check prerequisites
  console.log("Checking prerequisites...");

  const hasDocker = checkCommand("docker --version");
  const hasNode = checkCommand("node --version");

  console.log(`  ✓ Node.js: ${hasNode ? "installed" : "not found"}`);
  console.log(`  ✓ Docker: ${hasDocker ? "installed" : "not found"}`);

  // Create directory structure
  console.log(`\nCreating directory structure at ${options.directory}...`);

  const dirs = [
    options.directory,
    path.join(options.directory, "config"),
    path.join(options.directory, "data"),
    path.join(options.directory, "logs"),
  ];

  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`  ✓ Created ${dir}`);
  }

  // Create configuration file
  console.log("\nGenerating configuration...");

  const config = {
    version: "1.0",
    source: {
      adapter: options.adapter,
      [options.adapter]: {
        url: "${SOURCE_URL}",
        api_key: "${SOURCE_API_KEY}",
      },
    },
    sync: {
      mode: "incremental",
      interval: "15m",
      batch_size: 500,
    },
    validation: {
      schedule: "0 6 * * *",
      tolerance: {
        numeric: 0.01,
        date: 1,
      },
    },
  };

  const configPath = path.join(options.directory, "config", "shadow.yaml");
  fs.writeFileSync(configPath, require("yaml").stringify(config));
  console.log(`  ✓ Created ${configPath}`);

  // Create .env template
  const envTemplate = `# Open LOS Shadow Migration Configuration
SOURCE_URL=
SOURCE_API_KEY=
DB_PATH=file:${path.join(options.directory, "data", "shadow.db")}
PORT=3000
`;

  const envPath = path.join(options.directory, ".env.shadow");
  fs.writeFileSync(envPath, envTemplate);
  console.log(`  ✓ Created ${envPath}`);

  // Create Docker Compose if requested
  if (options.docker && hasDocker) {
    console.log("\nGenerating Docker configuration...");

    const dockerCompose = `version: '3.8'

services:
  open-los-shadow:
    image: ghcr.io/seadotdev/open-los:shadow-latest
    ports:
      - "3000:3000"
    env_file:
      - .env.shadow
    volumes:
      - ./data:/data
      - ./config:/app/config:ro
    restart: unless-stopped

  shadow-sync:
    image: ghcr.io/seadotdev/open-los:shadow-latest
    command: ["sync", "--continuous", "--interval=15m"]
    env_file:
      - .env.shadow
    volumes:
      - ./data:/data
      - ./config:/app/config:ro
    depends_on:
      - open-los-shadow
    restart: unless-stopped
`;

    const dockerPath = path.join(options.directory, "docker-compose.yaml");
    fs.writeFileSync(dockerPath, dockerCompose);
    console.log(`  ✓ Created ${dockerPath}`);
  }

  // Print next steps
  console.log("\n✅ Shadow migration environment initialized!\n");
  console.log("Next steps:");
  console.log(`  1. Edit ${envPath} with your source system credentials`);
  console.log(`  2. Review ${configPath} and adjust settings if needed`);

  if (options.docker) {
    console.log(`  3. Run: cd ${options.directory} && docker-compose up -d`);
  } else {
    console.log(`  3. Run: open-los-shadow connect --url <source-url>`);
  }

  console.log("  4. Run: open-los-shadow sync --mode full");
  console.log("  5. Run: open-los-shadow validate");
  console.log("\nFor more help: open-los-shadow --help");
}

function checkCommand(cmd: string): boolean {
  try {
    execSync(cmd, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
```

---

## 8. Deployment Automation

### Docker Image

```dockerfile
# Dockerfile.shadow

FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/api/package.json ./packages/api/
COPY packages/shadow/package.json ./packages/shadow/
COPY packages/shadow-cli/package.json ./packages/shadow-cli/

# Install dependencies
RUN npm ci --workspace=packages/core --workspace=packages/api --workspace=packages/shadow --workspace=packages/shadow-cli

# Copy source
COPY packages/core ./packages/core
COPY packages/api ./packages/api
COPY packages/shadow ./packages/shadow
COPY packages/shadow-cli ./packages/shadow-cli

# Build
RUN npm run build --workspace=packages/core --workspace=packages/api --workspace=packages/shadow --workspace=packages/shadow-cli

# Production image
FROM node:20-alpine

WORKDIR /app

# Copy built files
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/shadow/dist ./packages/shadow/dist
COPY --from=builder /app/packages/shadow-cli/dist ./packages/shadow-cli/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Create data directory
RUN mkdir -p /data

ENV NODE_ENV=production
ENV DB_PATH=file:/data/shadow.db
ENV SHADOW_MODE=true
ENV PORT=3000

EXPOSE 3000

# Entry point supports both server and CLI
ENTRYPOINT ["node", "./packages/api/dist/cli.js"]
CMD ["serve"]
```

### Helm Chart (for Kubernetes)

```yaml
# helm/open-los-shadow/values.yaml

replicaCount: 1

image:
  repository: ghcr.io/seadotdev/open-los
  tag: shadow-latest
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 3000

ingress:
  enabled: false
  className: ""
  annotations: {}
  hosts:
    - host: shadow.example.com
      paths:
        - path: /
          pathType: Prefix

resources:
  limits:
    cpu: 1000m
    memory: 1Gi
  requests:
    cpu: 100m
    memory: 256Mi

persistence:
  enabled: true
  size: 10Gi
  storageClass: ""

config:
  adapter: mambu
  syncInterval: 15m
  validationSchedule: "0 6 * * *"

secrets:
  sourceUrl: ""
  sourceApiKey: ""
```

---

## 9. Testing Strategy

### Unit Tests

```typescript
// packages/shadow/tests/adapters/mambu.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest";
import { MambuAdapter } from "../../src/adapters/mambu/adapter";

describe("MambuAdapter", () => {
  let adapter: MambuAdapter;

  beforeEach(() => {
    adapter = new MambuAdapter();
  });

  describe("testConnection", () => {
    it("should return success when connection is valid", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ version: "7.5" }),
      });

      await adapter.initialize({
        connectionId: "test",
        config: {
          url: "https://test.mambu.com",
          apiKey: "test-key",
        },
      });

      const result = await adapter.testConnection();

      expect(result.success).toBe(true);
      expect(result.details?.serverVersion).toBe("7.5");
    });

    it("should return failure when API returns error", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      await adapter.initialize({
        connectionId: "test",
        config: {
          url: "https://test.mambu.com",
          apiKey: "invalid-key",
        },
      });

      const result = await adapter.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain("401");
    });
  });

  describe("fetchRecords", () => {
    it("should paginate correctly", async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([
            { encodedKey: "1", id: "LN-001" },
            { encodedKey: "2", id: "LN-002" },
          ]),
          headers: new Map([
            ["Items-Total", "5"],
            ["Items-Offset", "0"],
          ]),
        });

      await adapter.initialize({
        connectionId: "test",
        config: {
          url: "https://test.mambu.com",
          apiKey: "test-key",
        },
      });

      const result = await adapter.fetchRecords("LoanAccount", { limit: 2 });

      expect(result.records.length).toBe(2);
      expect(result.hasMore).toBe(true);
      expect(result.cursor).toBe("2");
      expect(result.totalCount).toBe(5);
    });
  });
});
```

### Integration Tests

```yaml
# conformance/cases/shadow_sync.yaml

name: Shadow Sync Tests
setup:
  - description: Create shadow connection
    request:
      method: POST
      path: /v1/shadow/connections
      body:
        name: "Test Mambu"
        adapter_type: "csv"
        config:
          directory: "./test-data"
          entityMappings:
            - filename: "loans.csv"
              entity: "LoanAccount"
              primaryKey: "id"
    expect:
      status: 201
      body:
        id: { save: connection_id }

tests:
  - name: Test connection succeeds
    request:
      method: POST
      path: /v1/shadow/connections/{{connection_id}}/test
    expect:
      status: 200
      body:
        success: true

  - name: Discover schema returns entities
    request:
      method: GET
      path: /v1/shadow/connections/{{connection_id}}/discover
    expect:
      status: 200
      body:
        entities:
          - name: LoanAccount

  - name: Full sync completes
    request:
      method: POST
      path: /v1/shadow/sync
      body:
        connection_id: "{{connection_id}}"
        mode: full
    expect:
      status: 202
      body:
        status: { oneOf: [running, completed] }

  - name: Validation runs successfully
    request:
      method: POST
      path: /v1/shadow/validation
      body:
        connection_id: "{{connection_id}}"
    expect:
      status: 202
```

---

## 10. Migration Path

### Phase 1: Foundation (Weeks 1-4)

1. **Week 1-2**: Adapter Framework
   - Base adapter interface
   - CSV adapter (for testing)
   - Unit tests

2. **Week 3-4**: Sync Engine
   - Basic sync orchestration
   - Record tracking tables
   - Change detection

### Phase 2: Core Features (Weeks 5-8)

1. **Week 5-6**: Mambu Adapter
   - API client
   - Entity mapping
   - Incremental sync

2. **Week 7-8**: Validation Engine
   - Record comparison
   - Discrepancy tracking
   - Coverage metrics

### Phase 3: Production Ready (Weeks 9-12)

1. **Week 9-10**: API & CLI
   - REST endpoints
   - CLI commands
   - Documentation

2. **Week 11-12**: Deployment
   - Docker images
   - Helm chart
   - End-to-end testing

---

*End of Technical Specification*
