/**
 * Shadow CLI - Adapter Types
 *
 * Standard interfaces for system-of-record adapters.
 * Each adapter connects to an external platform (Salesforce, HubSpot, nCino, etc.)
 * and provides bidirectional data mapping to the Open LOS canonical model.
 *
 * Design principle: the canonical model never changes based on the adapter.
 * Adapters translate in both directions, with an anti-corruption layer
 * preventing external schemas from leaking into the domain.
 */

// =============================================================================
// Adapter Type Identifiers
// =============================================================================

export type AdapterType =
  | "salesforce"
  | "hubspot"
  | "ncino"
  | "mambu"
  | "encompass"
  | "spreadsheet"
  | "csv"
  | "rest_generic";

// =============================================================================
// Adapter Capabilities
// =============================================================================

export interface AdapterCapabilities {
  /** Supports reading data from the source */
  read: boolean;
  /** Supports writing data back to the source */
  write: boolean;
  /** Supports real-time change notifications (CDC, webhooks) */
  realtime: boolean;
  /** Supports bulk/batch operations */
  bulk: boolean;
  /** Supports incremental sync via change tokens or timestamps */
  incrementalSync: boolean;
  /** Supports automatic custom field discovery */
  customFieldDiscovery: boolean;
  /** Supports extracting documents/files */
  documents: boolean;
  /** Maximum records per API call (0 = no limit) */
  batchSize: number;
  /** Rate limit in requests per minute (0 = unlimited) */
  rateLimit: number;
}

// =============================================================================
// Connection Configuration
// =============================================================================

export interface SalesforceConfig {
  type: "salesforce";
  instanceUrl: string;
  clientId: string;
  clientSecret: string;
  /** Username for JWT bearer flow */
  username?: string;
  /** Path to private key for JWT bearer flow */
  privateKeyPath?: string;
  /** API version (default: 59.0) */
  apiVersion?: string;
  /** Enable Salesforce CDC for real-time sync */
  enableCdc?: boolean;
  /** nCino namespace prefix (if nCino is installed) */
  ncinoNamespace?: string;
}

export interface HubSpotConfig {
  type: "hubspot";
  /** Private app access token */
  accessToken?: string;
  /** OAuth client ID (for OAuth flow) */
  clientId?: string;
  /** OAuth client secret */
  clientSecret?: string;
  /** OAuth refresh token */
  refreshToken?: string;
  /** Portal/hub ID */
  portalId?: string;
  /** Deal pipeline ID to sync (default: all) */
  pipelineId?: string;
  /** Enable webhook subscriptions */
  enableWebhooks?: boolean;
}

export interface NcinoConfig {
  type: "ncino";
  /** Salesforce instance URL (nCino runs on Salesforce) */
  instanceUrl: string;
  clientId: string;
  clientSecret: string;
  username?: string;
  privateKeyPath?: string;
  apiVersion?: string;
  /** nCino namespace (default: LLC_BI) */
  namespace?: string;
  /** Enable CDC */
  enableCdc?: boolean;
}

export interface MambuConfig {
  type: "mambu";
  /** Mambu tenant URL */
  baseUrl: string;
  /** API key or username */
  apiKey?: string;
  username?: string;
  password?: string;
}

export interface GenericRestConfig {
  type: "rest_generic";
  baseUrl: string;
  /** Auth header value (e.g., "Bearer xxx" or "Basic xxx") */
  authHeader?: string;
  /** Custom headers */
  headers?: Record<string, string>;
  /** Object type → URL path mapping */
  endpoints: Record<string, string>;
}

export type AdapterConfig =
  | SalesforceConfig
  | HubSpotConfig
  | NcinoConfig
  | MambuConfig
  | GenericRestConfig;

// =============================================================================
// Schema Discovery
// =============================================================================

export interface ExternalSchema {
  /** Adapter type that produced this schema */
  adapterType: AdapterType;
  /** When the schema was discovered */
  discoveredAt: string;
  /** Available object types in the external system */
  objects: ExternalObjectSchema[];
}

export interface ExternalObjectSchema {
  /** Object API name (e.g., "Opportunity", "hs_deal") */
  apiName: string;
  /** Human-readable label */
  label: string;
  /** Number of records (estimated) */
  recordCount?: number;
  /** Fields on this object */
  fields: ExternalFieldSchema[];
  /** Suggested Open LOS entity mapping */
  suggestedEntity?: CanonicalEntity;
  /** Confidence of the entity suggestion (0-1) */
  entityConfidence?: number;
}

export interface ExternalFieldSchema {
  /** Field API name */
  apiName: string;
  /** Human-readable label */
  label: string;
  /** Data type in the external system */
  externalType: string;
  /** Normalized data type */
  dataType: ExternalDataType;
  /** Whether the field is required in the source */
  required: boolean;
  /** Whether this is a custom field */
  isCustom: boolean;
  /** Picklist/enum values (if applicable) */
  picklistValues?: string[];
  /** Reference/lookup target object (if applicable) */
  referenceTo?: string;
  /** Sample values (up to 5) */
  sampleValues?: string[];
  /** Suggested Open LOS field mapping */
  suggestedMapping?: FieldMappingSuggestion;
}

export type ExternalDataType =
  | "string"
  | "number"
  | "currency"
  | "percentage"
  | "date"
  | "datetime"
  | "boolean"
  | "email"
  | "phone"
  | "url"
  | "reference"
  | "picklist"
  | "multipicklist"
  | "textarea"
  | "blob"
  | "unknown";

export interface FieldMappingSuggestion {
  /** Target entity in Open LOS */
  targetEntity: CanonicalEntity;
  /** Target field path (e.g., "requested_amount", "custom_fields.score") */
  targetField: string;
  /** Transform required (e.g., "stage_normalize", "to_minor_units") */
  transform?: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Human-readable reason for the suggestion */
  reason: string;
}

export type CanonicalEntity =
  | "deals"
  | "entities"
  | "facilities"
  | "documents"
  | "covenants"
  | "loan_accounts"
  | "relationships"
  | "communications"
  | "spreads";

// =============================================================================
// Field Mapping (Confirmed)
// =============================================================================

export interface FieldMapping {
  /** Unique mapping ID */
  id: string;
  /** Connection ID */
  connectionId: string;
  /** Source object API name */
  sourceObject: string;
  /** Source field API name */
  sourceField: string;
  /** Target Open LOS entity */
  targetEntity: CanonicalEntity;
  /** Target field path */
  targetField: string;
  /** Transform to apply */
  transform?: TransformRule;
  /** Sync direction */
  direction: "inbound" | "outbound" | "bidirectional";
  /** Whether this is a key/identity field for record matching */
  isMatchKey: boolean;
  /** Whether this mapping is active */
  enabled: boolean;
}

export interface TransformRule {
  type: TransformType;
  params?: Record<string, unknown>;
}

export type TransformType =
  | "none"
  | "uppercase"
  | "lowercase"
  | "trim"
  | "parse_date"
  | "parse_currency"
  | "parse_percentage"
  | "to_minor_units"
  | "from_minor_units"
  | "stage_normalize"
  | "stage_denormalize"
  | "lookup"
  | "picklist_map"
  | "concatenate"
  | "split"
  | "regex_extract"
  | "expression";

// =============================================================================
// External Records
// =============================================================================

export interface ExternalRecord {
  /** Object type in external system */
  objectType: string;
  /** Record ID in external system */
  externalId: string;
  /** Field values */
  fields: Record<string, unknown>;
  /** Last modified timestamp */
  lastModifiedAt?: string;
  /** Last modified by (user ID or name) */
  lastModifiedBy?: string;
  /** Created timestamp */
  createdAt?: string;
}

// =============================================================================
// Sync Primitives
// =============================================================================

export interface FetchQuery {
  /** Object type to fetch */
  objectType: string;
  /** Filter conditions */
  filters?: FilterCondition[];
  /** Fields to include (empty = all mapped) */
  fields?: string[];
  /** Maximum records */
  limit?: number;
  /** Pagination cursor/offset */
  cursor?: string;
  /** Only records modified since this timestamp */
  modifiedSince?: string;
  /** Sync token from previous incremental sync */
  syncToken?: string;
}

export interface FilterCondition {
  field: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "like" | "contains";
  value: unknown;
}

export interface FetchResult {
  records: ExternalRecord[];
  /** Cursor for next page */
  cursor?: string;
  /** Whether more records exist */
  hasMore: boolean;
  /** Total count (if available) */
  totalCount?: number;
  /** Sync token for next incremental fetch */
  syncToken?: string;
}

export interface PushResult {
  success: boolean;
  externalId?: string;
  errors?: string[];
}

export interface BatchPushResult {
  results: PushResult[];
  successCount: number;
  failureCount: number;
}

// =============================================================================
// Change Events (for real-time adapters)
// =============================================================================

export interface ChangeEvent {
  type: "created" | "updated" | "deleted" | "undeleted";
  objectType: string;
  externalId: string;
  /** Changed fields (for updates) */
  changedFields?: string[];
  /** Full record (if available) */
  record?: ExternalRecord;
  /** Timestamp of the change */
  timestamp: string;
}

export interface WatchHandle {
  stop(): void;
  readonly isWatching: boolean;
}

// =============================================================================
// Connection Test
// =============================================================================

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  details?: {
    /** Organization/account name */
    orgName?: string;
    /** API version */
    apiVersion?: string;
    /** Available object count */
    objectCount?: number;
    /** Current user */
    authenticatedUser?: string;
    /** Features available */
    features?: string[];
  };
  error?: Error;
}

// =============================================================================
// The Adapter Interface
// =============================================================================

/**
 * Standard interface for all system-of-record adapters.
 *
 * Each adapter translates between an external platform's API/schema
 * and the Open LOS canonical model. The adapter is responsible for:
 *
 * 1. Authentication and connection management
 * 2. Schema discovery (objects, fields, relationships, custom fields)
 * 3. Inbound data fetching (external → canonical)
 * 4. Outbound data pushing (canonical → external)
 * 5. Change detection (CDC, webhooks, polling)
 *
 * Adapters NEVER touch the Open LOS database directly. They return
 * ExternalRecords that the sync engine maps to canonical entities.
 */
export interface ShadowAdapter {
  /** Adapter type identifier */
  readonly type: AdapterType;
  /** Human-readable name (e.g., "Salesforce", "HubSpot CRM") */
  readonly name: string;
  /** What this adapter can do */
  readonly capabilities: AdapterCapabilities;

  // ── Lifecycle ─────────────────────────────────────────────────

  /** Initialize the adapter with connection configuration */
  initialize(config: AdapterConfig): Promise<void>;

  /** Test that the connection works and return details */
  testConnection(): Promise<ConnectionTestResult>;

  /** Clean up resources (tokens, watchers, connections) */
  dispose(): Promise<void>;

  // ── Schema Discovery ──────────────────────────────────────────

  /** Discover all available objects and their fields */
  discoverSchema(): Promise<ExternalSchema>;

  /** Get detailed field metadata for a specific object (including custom fields) */
  discoverFields(objectType: string): Promise<ExternalFieldSchema[]>;

  /** Sample records from an object for mapping analysis */
  sampleRecords(objectType: string, limit?: number): Promise<ExternalRecord[]>;

  // ── Inbound (External → Open LOS) ────────────────────────────

  /** Fetch records matching a query */
  fetchRecords(query: FetchQuery): Promise<FetchResult>;

  /** Fetch a single record by ID */
  fetchRecord(objectType: string, externalId: string): Promise<ExternalRecord | null>;

  /** Count records matching optional filters */
  countRecords(objectType: string, filters?: FilterCondition[]): Promise<number>;

  /** Watch for real-time changes (optional — only if capabilities.realtime) */
  watchChanges?(callback: (event: ChangeEvent) => void): WatchHandle;

  // ── Outbound (Open LOS → External) ───────────────────────────

  /** Push a single record to the external system */
  pushRecord?(objectType: string, externalId: string | null, data: Record<string, unknown>): Promise<PushResult>;

  /** Push a batch of records */
  pushBatch?(objectType: string, records: Array<{ externalId: string | null; data: Record<string, unknown> }>): Promise<BatchPushResult>;

  // ── Sync State ────────────────────────────────────────────────

  /** Get the last sync token (for incremental sync) */
  getLastSyncToken(): Promise<string | null>;

  /** Store the sync token after a successful sync */
  setLastSyncToken(token: string): Promise<void>;
}
