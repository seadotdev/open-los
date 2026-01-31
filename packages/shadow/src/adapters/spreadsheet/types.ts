/**
 * Spreadsheet Sync Engine - Core Types
 *
 * Types and interfaces for syncing data from spreadsheet-based LOS systems
 * (Excel files, Google Sheets, SharePoint) to Open LOS.
 */

// =============================================================================
// Connection Configuration Types
// =============================================================================

export interface ExcelConnectionConfig {
  type: "excel";
  /** Path to Excel file (local or network share) */
  filePath: string;
  /** Password for protected files */
  password?: string;
  /** Watch for file changes */
  watchForChanges?: boolean;
  /** Poll interval in milliseconds (if watching) */
  pollInterval?: number;
}

export interface GoogleSheetsConnectionConfig {
  type: "google_sheets";
  /** Google Sheets document ID */
  spreadsheetId: string;
  /** OAuth credentials or service account key */
  credentials: GoogleCredentials;
  /** Enable real-time webhook updates */
  enableWebhooks?: boolean;
}

export interface GoogleCredentials {
  /** OAuth access token (for user auth) */
  accessToken?: string;
  /** OAuth refresh token */
  refreshToken?: string;
  /** Service account key JSON */
  serviceAccountKey?: string;
}

export interface SharePointConnectionConfig {
  type: "sharepoint";
  /** SharePoint site URL */
  siteUrl: string;
  /** Document library or list name */
  libraryName: string;
  /** Azure AD tenant ID */
  tenantId: string;
  /** Azure AD client ID */
  clientId: string;
  /** Client secret or certificate */
  clientSecret?: string;
  /** Use delegated (user) auth vs app-only */
  useDelegatedAuth?: boolean;
  /** Folder path within the library */
  folderPath?: string;
  /** Sync documents in addition to list data */
  syncDocuments?: boolean;
}

export type SpreadsheetConnectionConfig =
  | ExcelConnectionConfig
  | GoogleSheetsConnectionConfig
  | SharePointConnectionConfig;

// =============================================================================
// Schema Discovery Types
// =============================================================================

export interface SpreadsheetSchema {
  /** Source type */
  sourceType: "excel" | "google_sheets" | "sharepoint";
  /** Version info */
  version: string;
  /** When schema was discovered */
  discoveredAt: Date;
  /** Available worksheets/tabs */
  worksheets: WorksheetSchema[];
}

export interface WorksheetSchema {
  /** Worksheet/tab name */
  name: string;
  /** Display name */
  displayName: string;
  /** Number of data rows (excluding header) */
  rowCount: number;
  /** Detected columns */
  columns: ColumnSchema[];
  /** Detected header row index (0-based) */
  headerRowIndex: number;
  /** First data row index (0-based) */
  dataRowIndex: number;
  /** Suggested Open LOS entity type */
  suggestedEntity?: string;
  /** Confidence score for entity suggestion (0-1) */
  entityConfidence?: number;
}

export interface ColumnSchema {
  /** Column index (0-based) */
  index: number;
  /** Column letter (A, B, AA, etc.) */
  letter: string;
  /** Header value */
  header: string;
  /** Detected data type */
  dataType: SpreadsheetDataType;
  /** Sample values (up to 5) */
  sampleValues: string[];
  /** Is this column likely a primary key? */
  isPrimaryKeyCandidate: boolean;
  /** Percentage of non-empty cells */
  fillRate: number;
  /** Unique value count (if <= 100) */
  uniqueValueCount?: number;
  /** Suggested Open LOS field mapping */
  suggestedMapping?: FieldMappingSuggestion;
}

export type SpreadsheetDataType =
  | "text"
  | "number"
  | "currency"
  | "percentage"
  | "date"
  | "datetime"
  | "boolean"
  | "email"
  | "phone"
  | "url"
  | "empty"
  | "mixed";

export interface FieldMappingSuggestion {
  /** Target entity in Open LOS */
  targetEntity: string;
  /** Target field name */
  targetField: string;
  /** Required transformation */
  transform?: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Reason for suggestion */
  reason: string;
}

// =============================================================================
// Field Mapping Types
// =============================================================================

export interface FieldMapping {
  /** Unique mapping ID */
  id: string;
  /** Connection ID this mapping belongs to */
  connectionId: string;
  /** Source worksheet name */
  sourceWorksheet: string;
  /** Source column header or index */
  sourceColumn: string;
  /** Target Open LOS entity */
  targetEntity: TargetEntity;
  /** Target field path (e.g., "borrower_name", "custom_fields.notes") */
  targetField: string;
  /** Transformation rule */
  transform?: TransformRule;
  /** Validation rules */
  validations?: ValidationRule[];
  /** Default value if source is empty */
  defaultValue?: string;
  /** Is this field required? */
  required?: boolean;
  /** Is this mapping enabled? */
  enabled: boolean;
}

export type TargetEntity =
  | "deals"
  | "entities"
  | "facilities"
  | "documents"
  | "covenants"
  | "loan_accounts"
  | "relationships";

export interface TransformRule {
  /** Transform type */
  type: TransformType;
  /** Transform parameters */
  params?: Record<string, unknown>;
  /** Custom expression (for 'expression' type) */
  expression?: string;
}

export type TransformType =
  | "none"
  | "uppercase"
  | "lowercase"
  | "trim"
  | "parse_date"
  | "parse_currency"
  | "parse_percentage"
  | "parse_phone"
  | "parse_boolean"
  | "lookup"
  | "concatenate"
  | "split"
  | "regex_extract"
  | "stage_normalize"
  | "to_minor_units"
  | "expression";

export interface ValidationRule {
  /** Validation type */
  type: ValidationType;
  /** Expected value or pattern */
  value?: string | number | RegExp;
  /** Error message */
  message: string;
  /** Severity if validation fails */
  severity: "error" | "warning";
}

export type ValidationType =
  | "required"
  | "min_length"
  | "max_length"
  | "min_value"
  | "max_value"
  | "pattern"
  | "email"
  | "phone"
  | "date"
  | "in_list"
  | "unique";

// =============================================================================
// Sync Types
// =============================================================================

export interface SpreadsheetRow {
  /** Row index in source (0-based, excluding header) */
  rowIndex: number;
  /** Original row number in spreadsheet (1-based, for display) */
  rowNumber: number;
  /** Raw cell values by column header */
  data: Record<string, CellValue>;
  /** Hash of row data for change detection */
  hash: string;
  /** Row modification timestamp (if available) */
  modifiedAt?: Date;
}

export type CellValue = string | number | boolean | Date | null;

export interface SpreadsheetSyncInput {
  /** Connection ID */
  connectionId: string;
  /** Sync mode */
  mode: "full" | "incremental";
  /** Specific worksheets to sync (empty = all) */
  worksheets?: string[];
  /** Batch size for processing */
  batchSize?: number;
  /** Whether to continue on row errors */
  continueOnError?: boolean;
  /** Dry run (validate only, don't persist) */
  dryRun?: boolean;
}

export interface SpreadsheetSyncResult {
  /** Sync run ID */
  runId: string;
  /** Connection ID */
  connectionId: string;
  /** Sync status */
  status: "running" | "completed" | "partial" | "failed";
  /** Start time */
  startedAt: Date;
  /** End time */
  completedAt?: Date;
  /** Per-worksheet results */
  worksheets: WorksheetSyncResult[];
  /** Summary statistics */
  summary: {
    totalRows: number;
    processedRows: number;
    createdRecords: number;
    updatedRecords: number;
    skippedRows: number;
    failedRows: number;
  };
  /** Errors encountered */
  errors: SyncError[];
}

export interface WorksheetSyncResult {
  /** Worksheet name */
  worksheet: string;
  /** Target entity */
  targetEntity: string;
  /** Source row count */
  sourceRowCount: number;
  /** Rows processed */
  processedRows: number;
  /** Records created */
  createdRecords: number;
  /** Records updated */
  updatedRecords: number;
  /** Rows skipped (unchanged) */
  skippedRows: number;
  /** Rows failed */
  failedRows: number;
  /** Per-row errors */
  errors: SyncError[];
}

export interface SyncError {
  /** Error type */
  type: "validation" | "transform" | "persist" | "connection";
  /** Worksheet name */
  worksheet: string;
  /** Row number (1-based, for display) */
  rowNumber?: number;
  /** Column name (if applicable) */
  column?: string;
  /** Error message */
  message: string;
  /** Error details */
  details?: Record<string, unknown>;
  /** Severity */
  severity: "error" | "warning";
  /** Timestamp */
  timestamp: Date;
}

// =============================================================================
// Row Tracking Types
// =============================================================================

export interface SpreadsheetRowTracking {
  /** Tracking ID */
  id: string;
  /** Connection ID */
  connectionId: string;
  /** Worksheet name */
  worksheet: string;
  /** Row identifier (primary key value or row index) */
  sourceRowId: string;
  /** Corresponding Open LOS record ID */
  targetRecordId?: string;
  /** Target entity type */
  targetEntity: string;
  /** Hash of row data for change detection */
  sourceHash: string;
  /** Last sync status */
  syncStatus: "synced" | "pending" | "failed";
  /** Last sync timestamp */
  lastSyncedAt?: string;
  /** Last error message */
  lastError?: string;
  /** Created at */
  createdAt: string;
  /** Updated at */
  updatedAt: string;
}

// =============================================================================
// Adapter Interface
// =============================================================================

export interface SpreadsheetAdapter {
  /** Adapter type identifier */
  readonly type: "excel" | "google_sheets" | "sharepoint";

  /** Human-readable name */
  readonly name: string;

  /** Supported features */
  readonly features: {
    /** Supports file/change watching */
    watchChanges: boolean;
    /** Supports real-time updates */
    realtime: boolean;
    /** Supports document extraction */
    documents: boolean;
    /** Supports incremental sync */
    incrementalSync: boolean;
  };

  /**
   * Initialize the adapter with connection configuration
   */
  initialize(config: SpreadsheetConnectionConfig): Promise<void>;

  /**
   * Test connection to source
   */
  testConnection(): Promise<ConnectionTestResult>;

  /**
   * Discover schema (worksheets, columns, types)
   */
  discoverSchema(): Promise<SpreadsheetSchema>;

  /**
   * Get preview data (first N rows)
   */
  previewData(
    worksheet: string,
    options?: { limit?: number; offset?: number }
  ): Promise<SpreadsheetRow[]>;

  /**
   * Fetch all rows from a worksheet
   */
  fetchRows(
    worksheet: string,
    options?: FetchRowsOptions
  ): Promise<FetchRowsResult>;

  /**
   * Get a single row by primary key or index
   */
  getRow(worksheet: string, rowId: string): Promise<SpreadsheetRow | null>;

  /**
   * Get row count for a worksheet
   */
  getRowCount(worksheet: string): Promise<number>;

  /**
   * Start watching for changes (if supported)
   */
  startWatching?(callback: (event: ChangeEvent) => void): WatchHandle;

  /**
   * Extract documents (for SharePoint)
   */
  extractDocuments?(options: ExtractDocumentsOptions): Promise<ExtractedDocument[]>;

  /**
   * Clean up resources
   */
  dispose(): Promise<void>;
}

export interface ConnectionTestResult {
  /** Whether connection succeeded */
  success: boolean;
  /** Status message */
  message: string;
  /** Additional details */
  details?: {
    /** Source file/spreadsheet name */
    sourceName?: string;
    /** Last modified date */
    lastModified?: Date;
    /** Number of worksheets */
    worksheetCount?: number;
    /** Total row count (estimate) */
    estimatedRows?: number;
  };
  /** Error if failed */
  error?: Error;
}

export interface FetchRowsOptions {
  /** Maximum rows to fetch */
  limit?: number;
  /** Pagination cursor */
  cursor?: string;
  /** Only fetch rows modified since this date */
  modifiedSince?: Date;
  /** Specific columns to include */
  columns?: string[];
}

export interface FetchRowsResult {
  /** Fetched rows */
  rows: SpreadsheetRow[];
  /** Cursor for next page */
  cursor?: string;
  /** Whether more rows exist */
  hasMore: boolean;
  /** Total row count (if known) */
  totalCount?: number;
}

export interface ChangeEvent {
  /** Event type */
  type: "row_added" | "row_updated" | "row_deleted" | "file_modified";
  /** Worksheet name */
  worksheet: string;
  /** Affected row (if applicable) */
  row?: SpreadsheetRow;
  /** Row ID (if applicable) */
  rowId?: string;
  /** Event timestamp */
  timestamp: Date;
}

export interface WatchHandle {
  /** Stop watching */
  stop(): void;
  /** Whether currently watching */
  readonly isWatching: boolean;
}

export interface ExtractDocumentsOptions {
  /** Folder path to extract from */
  folderPath?: string;
  /** Only extract documents modified since */
  modifiedSince?: Date;
  /** Maximum number of documents */
  limit?: number;
  /** File extensions to include */
  includeExtensions?: string[];
}

export interface ExtractedDocument {
  /** Document ID in source system */
  sourceId: string;
  /** File name */
  filename: string;
  /** File path in source */
  sourcePath: string;
  /** MIME type */
  mimeType: string;
  /** File size in bytes */
  sizeBytes: number;
  /** Document content (if small enough) */
  content?: Buffer;
  /** URL to download content */
  downloadUrl?: string;
  /** Created date */
  createdAt: Date;
  /** Modified date */
  modifiedAt: Date;
  /** Created by (username) */
  createdBy?: string;
  /** Modified by (username) */
  modifiedBy?: string;
  /** Associated deal identifier (if detectable) */
  dealIdentifier?: string;
  /** Suggested document type */
  suggestedDocType?: string;
}
