/**
 * Spreadsheet Sync Engine
 *
 * Orchestrates the synchronization of data from spreadsheet sources
 * (Excel, Google Sheets, SharePoint) to Open LOS.
 */

import * as crypto from "crypto";
import {
  SpreadsheetAdapter,
  SpreadsheetConnectionConfig,
  SpreadsheetSchema,
  SpreadsheetRow,
  SpreadsheetSyncInput,
  SpreadsheetSyncResult,
  WorksheetSyncResult,
  SyncError,
  FieldMapping,
  TargetEntity,
  CellValue,
  SpreadsheetRowTracking,
} from "./types";
import {
  findBestFieldMapping,
  normalizeStageValue,
  FieldVariation,
} from "./field-variations";
import { ExcelAdapter } from "./excel-adapter";
import { GoogleSheetsAdapter } from "./google-sheets-adapter";
import { SharePointAdapter } from "./sharepoint-adapter";

// =============================================================================
// Sync Engine Types
// =============================================================================

export interface SpreadsheetSyncEngineConfig {
  /** Database interface for persistence */
  db: DatabaseInterface;
  /** Tenant ID for multi-tenancy */
  tenantId: string;
  /** Actor ID for audit trail */
  actorId: string;
}

export interface DatabaseInterface {
  // Row tracking
  getRowTracking(
    connectionId: string,
    worksheet: string,
    sourceRowId: string
  ): Promise<SpreadsheetRowTracking | null>;
  upsertRowTracking(tracking: SpreadsheetRowTracking): Promise<void>;
  listRowTrackings(
    connectionId: string,
    worksheet: string
  ): Promise<SpreadsheetRowTracking[]>;

  // Field mappings
  getMappings(connectionId: string): Promise<FieldMapping[]>;

  // Open LOS entities
  createDeal(data: Record<string, unknown>, actor: string): Promise<string>;
  updateDeal(
    id: string,
    data: Record<string, unknown>,
    actor: string
  ): Promise<void>;
  createEntity(data: Record<string, unknown>, actor: string): Promise<string>;
  updateEntity(
    id: string,
    data: Record<string, unknown>,
    actor: string
  ): Promise<void>;
  createFacility(data: Record<string, unknown>, actor: string): Promise<string>;
  updateFacility(
    id: string,
    data: Record<string, unknown>,
    actor: string
  ): Promise<void>;
  createDocument(data: Record<string, unknown>, actor: string): Promise<string>;
  updateDocument(
    id: string,
    data: Record<string, unknown>,
    actor: string
  ): Promise<void>;
}

export interface MappedRecord {
  targetEntity: TargetEntity;
  data: Record<string, unknown>;
  sourceRowId: string;
  sourceHash: string;
}

// =============================================================================
// Spreadsheet Sync Engine
// =============================================================================

export class SpreadsheetSyncEngine {
  private config: SpreadsheetSyncEngineConfig;
  private adapters: Map<string, SpreadsheetAdapter> = new Map();

  constructor(config: SpreadsheetSyncEngineConfig) {
    this.config = config;
  }

  /**
   * Create and initialize an adapter for a connection
   */
  async createAdapter(
    connectionId: string,
    connectionConfig: SpreadsheetConnectionConfig
  ): Promise<SpreadsheetAdapter> {
    let adapter: SpreadsheetAdapter;

    switch (connectionConfig.type) {
      case "excel":
        adapter = new ExcelAdapter();
        break;
      case "google_sheets":
        adapter = new GoogleSheetsAdapter();
        break;
      case "sharepoint":
        adapter = new SharePointAdapter();
        break;
      default:
        throw new Error(`Unknown connection type: ${(connectionConfig as any).type}`);
    }

    await adapter.initialize(connectionConfig);
    this.adapters.set(connectionId, adapter);

    return adapter;
  }

  /**
   * Get an existing adapter
   */
  getAdapter(connectionId: string): SpreadsheetAdapter | undefined {
    return this.adapters.get(connectionId);
  }

  /**
   * Run a full or incremental sync
   */
  async runSync(
    connectionId: string,
    input: SpreadsheetSyncInput
  ): Promise<SpreadsheetSyncResult> {
    const adapter = this.adapters.get(connectionId);
    if (!adapter) {
      throw new Error(`No adapter found for connection: ${connectionId}`);
    }

    const runId = crypto.randomUUID();
    const startedAt = new Date();
    const worksheetResults: WorksheetSyncResult[] = [];
    const errors: SyncError[] = [];

    try {
      // Discover schema
      const schema = await adapter.discoverSchema();

      // Get field mappings
      const mappings = await this.config.db.getMappings(connectionId);

      // Determine which worksheets to sync
      const worksheetsToSync = input.worksheets
        ? schema.worksheets.filter((ws) => input.worksheets!.includes(ws.name))
        : schema.worksheets;

      // Sync each worksheet
      for (const worksheetSchema of worksheetsToSync) {
        const worksheetMappings = mappings.filter(
          (m) => m.sourceWorksheet === worksheetSchema.name
        );

        // If no explicit mappings, try auto-mapping based on suggestions
        const effectiveMappings =
          worksheetMappings.length > 0
            ? worksheetMappings
            : this.generateAutoMappings(
                connectionId,
                worksheetSchema.name,
                worksheetSchema.columns
              );

        if (effectiveMappings.length === 0) {
          errors.push({
            type: "validation",
            worksheet: worksheetSchema.name,
            message: "No field mappings defined or discoverable for this worksheet",
            severity: "warning",
            timestamp: new Date(),
          });
          continue;
        }

        const result = await this.syncWorksheet(
          adapter,
          connectionId,
          worksheetSchema.name,
          effectiveMappings,
          input
        );

        worksheetResults.push(result);
        errors.push(...result.errors);
      }

      // Calculate summary
      const summary = {
        totalRows: worksheetResults.reduce((sum, r) => sum + r.sourceRowCount, 0),
        processedRows: worksheetResults.reduce((sum, r) => sum + r.processedRows, 0),
        createdRecords: worksheetResults.reduce((sum, r) => sum + r.createdRecords, 0),
        updatedRecords: worksheetResults.reduce((sum, r) => sum + r.updatedRecords, 0),
        skippedRows: worksheetResults.reduce((sum, r) => sum + r.skippedRows, 0),
        failedRows: worksheetResults.reduce((sum, r) => sum + r.failedRows, 0),
      };

      const status =
        summary.failedRows > 0
          ? summary.failedRows === summary.totalRows
            ? "failed"
            : "partial"
          : "completed";

      return {
        runId,
        connectionId,
        status,
        startedAt,
        completedAt: new Date(),
        worksheets: worksheetResults,
        summary,
        errors,
      };
    } catch (error) {
      const err = error as Error;
      errors.push({
        type: "connection",
        worksheet: "*",
        message: err.message,
        severity: "error",
        timestamp: new Date(),
      });

      return {
        runId,
        connectionId,
        status: "failed",
        startedAt,
        completedAt: new Date(),
        worksheets: worksheetResults,
        summary: {
          totalRows: 0,
          processedRows: 0,
          createdRecords: 0,
          updatedRecords: 0,
          skippedRows: 0,
          failedRows: 0,
        },
        errors,
      };
    }
  }

  /**
   * Sync a single worksheet
   */
  private async syncWorksheet(
    adapter: SpreadsheetAdapter,
    connectionId: string,
    worksheetName: string,
    mappings: FieldMapping[],
    input: SpreadsheetSyncInput
  ): Promise<WorksheetSyncResult> {
    const errors: SyncError[] = [];
    let processedRows = 0;
    let createdRecords = 0;
    let updatedRecords = 0;
    let skippedRows = 0;
    let failedRows = 0;

    // Determine target entity (from first mapping)
    const targetEntity = mappings[0]?.targetEntity || "deals";

    // Get source row count
    const sourceRowCount = await adapter.getRowCount(worksheetName);

    // Fetch rows in batches
    let cursor: string | undefined;
    let hasMore = true;
    const batchSize = input.batchSize || 100;

    while (hasMore) {
      const result = await adapter.fetchRows(worksheetName, {
        limit: batchSize,
        cursor,
      });

      for (const row of result.rows) {
        try {
          // Map row to Open LOS format
          const mappedRecord = this.mapRow(row, mappings, targetEntity);

          // Check if we've seen this row before
          const tracking = await this.config.db.getRowTracking(
            connectionId,
            worksheetName,
            String(row.rowNumber)
          );

          if (tracking) {
            // Check if row has changed
            if (tracking.sourceHash === row.hash) {
              skippedRows++;
              processedRows++;
              continue;
            }

            // Update existing record
            if (!input.dryRun && tracking.targetRecordId) {
              await this.updateRecord(
                targetEntity,
                tracking.targetRecordId,
                mappedRecord.data
              );
              updatedRecords++;
            }

            // Update tracking
            await this.config.db.upsertRowTracking({
              ...tracking,
              sourceHash: row.hash,
              syncStatus: "synced",
              lastSyncedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          } else {
            // Create new record
            let targetRecordId: string | undefined;
            if (!input.dryRun) {
              targetRecordId = await this.createRecord(
                targetEntity,
                mappedRecord.data
              );
              createdRecords++;
            }

            // Create tracking record
            await this.config.db.upsertRowTracking({
              id: crypto.randomUUID(),
              connectionId,
              worksheet: worksheetName,
              sourceRowId: String(row.rowNumber),
              targetRecordId,
              targetEntity,
              sourceHash: row.hash,
              syncStatus: "synced",
              lastSyncedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }

          processedRows++;
        } catch (error) {
          const err = error as Error;
          failedRows++;
          processedRows++;

          if (!input.continueOnError) {
            throw error;
          }

          errors.push({
            type: "transform",
            worksheet: worksheetName,
            rowNumber: row.rowNumber,
            message: err.message,
            severity: "error",
            timestamp: new Date(),
          });
        }
      }

      cursor = result.cursor;
      hasMore = result.hasMore;
    }

    return {
      worksheet: worksheetName,
      targetEntity,
      sourceRowCount,
      processedRows,
      createdRecords,
      updatedRecords,
      skippedRows,
      failedRows,
      errors,
    };
  }

  /**
   * Map a spreadsheet row to Open LOS format using field mappings
   */
  private mapRow(
    row: SpreadsheetRow,
    mappings: FieldMapping[],
    targetEntity: TargetEntity
  ): MappedRecord {
    const data: Record<string, unknown> = {};

    for (const mapping of mappings) {
      if (!mapping.enabled) continue;

      const sourceValue = row.data[mapping.sourceColumn];

      // Skip if no value and no default
      if (
        (sourceValue === null || sourceValue === undefined || sourceValue === "") &&
        !mapping.defaultValue
      ) {
        if (mapping.required) {
          throw new Error(
            `Required field "${mapping.sourceColumn}" is empty in row ${row.rowNumber}`
          );
        }
        continue;
      }

      // Get value (source or default)
      let value: CellValue = sourceValue ?? mapping.defaultValue ?? null;

      // Apply transformation
      if (mapping.transform) {
        value = this.applyTransform(value, mapping.transform, mapping.sourceColumn);
      }

      // Apply validations
      if (mapping.validations) {
        for (const validation of mapping.validations) {
          const isValid = this.validateValue(value, validation);
          if (!isValid) {
            if (validation.severity === "error") {
              throw new Error(
                `Validation failed for "${mapping.sourceColumn}" in row ${row.rowNumber}: ${validation.message}`
              );
            }
            // For warnings, we might log but continue
          }
        }
      }

      // Set the value in the target path
      this.setNestedValue(data, mapping.targetField, value);
    }

    return {
      targetEntity,
      data,
      sourceRowId: String(row.rowNumber),
      sourceHash: row.hash,
    };
  }

  /**
   * Apply a transformation to a value
   */
  private applyTransform(
    value: CellValue,
    transform: FieldMapping["transform"],
    columnName: string
  ): CellValue {
    if (!transform) return value;

    const strValue = value === null ? "" : String(value);

    switch (transform.type) {
      case "none":
        return value;

      case "uppercase":
        return strValue.toUpperCase();

      case "lowercase":
        return strValue.toLowerCase();

      case "trim":
        return strValue.trim();

      case "parse_date":
        return this.parseDate(strValue);

      case "parse_currency":
        return this.parseCurrency(strValue);

      case "parse_percentage":
        return this.parsePercentage(strValue);

      case "parse_phone":
        return this.parsePhone(strValue);

      case "parse_boolean":
        return this.parseBoolean(strValue);

      case "stage_normalize":
        const normalized = normalizeStageValue(strValue);
        if (!normalized) {
          console.warn(`Unknown stage value: "${strValue}" in column "${columnName}"`);
          return strValue; // Return original if not recognized
        }
        return normalized;

      case "to_minor_units":
        // Convert dollars to cents (or other currency to minor units)
        const amount = this.parseCurrency(strValue);
        return typeof amount === "number" ? Math.round(amount * 100) : null;

      case "expression":
        // Custom expression evaluation (simplified)
        if (transform.expression) {
          return this.evaluateExpression(transform.expression, value);
        }
        return value;

      default:
        return value;
    }
  }

  /**
   * Parse a date string into ISO format
   */
  private parseDate(value: string): string | null {
    if (!value || value.trim() === "") return null;

    // Try various date formats
    const formats = [
      // ISO
      /^(\d{4})-(\d{2})-(\d{2})$/,
      // US formats
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
      /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
      // European formats
      /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/,
    ];

    for (const format of formats) {
      const match = value.match(format);
      if (match) {
        // Normalize to YYYY-MM-DD
        let year: string, month: string, day: string;

        if (format === formats[0]) {
          // ISO format
          [, year, month, day] = match;
        } else {
          // US/EU formats - assume MM/DD/YYYY or DD/MM/YYYY
          // Try to detect based on values
          const [, first, second, yearStr] = match;
          year = yearStr;

          if (parseInt(first) > 12) {
            // First must be day (EU format)
            day = first.padStart(2, "0");
            month = second.padStart(2, "0");
          } else if (parseInt(second) > 12) {
            // Second must be day (US format)
            month = first.padStart(2, "0");
            day = second.padStart(2, "0");
          } else {
            // Ambiguous - assume US format
            month = first.padStart(2, "0");
            day = second.padStart(2, "0");
          }
        }

        return `${year}-${month}-${day}`;
      }
    }

    // Try parsing with Date
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split("T")[0];
      }
    } catch {
      // Ignore
    }

    return null;
  }

  /**
   * Parse a currency string to a number
   */
  private parseCurrency(value: string): number | null {
    if (!value || value.trim() === "") return null;

    // Remove currency symbols and formatting
    const cleaned = value
      .replace(/[$,\u00A3\u20AC\s]/g, "") // Remove $, EUR, GBP symbols and spaces
      .replace(/\(([^)]+)\)/, "-$1"); // Convert (123) to -123

    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  /**
   * Parse a percentage string to a decimal number
   */
  private parsePercentage(value: string): number | null {
    if (!value || value.trim() === "") return null;

    const cleaned = value.replace(/%/g, "").trim();
    const num = parseFloat(cleaned);
    if (isNaN(num)) return null;

    // If value looks like it's already in decimal form (e.g., 0.075)
    if (num < 1 && !value.includes("%")) {
      return num;
    }

    // Convert percentage to decimal (e.g., 7.5% -> 0.075)
    return num / 100;
  }

  /**
   * Parse a phone number to normalized format
   */
  private parsePhone(value: string): string | null {
    if (!value || value.trim() === "") return null;

    // Extract just the digits
    const digits = value.replace(/\D/g, "");

    if (digits.length < 10) return null;

    // Format as US phone if 10 digits
    if (digits.length === 10) {
      return `+1${digits}`;
    }

    // If 11 digits starting with 1, assume US
    if (digits.length === 11 && digits.startsWith("1")) {
      return `+${digits}`;
    }

    // Otherwise return with + prefix
    return `+${digits}`;
  }

  /**
   * Parse a boolean value
   */
  private parseBoolean(value: string): boolean | null {
    if (!value || value.trim() === "") return null;

    const lower = value.toLowerCase().trim();

    if (["true", "yes", "y", "1", "on", "x", "checked"].includes(lower)) {
      return true;
    }
    if (["false", "no", "n", "0", "off", "", "unchecked"].includes(lower)) {
      return false;
    }

    return null;
  }

  /**
   * Evaluate a simple expression
   */
  private evaluateExpression(expression: string, value: CellValue): CellValue {
    // Very simple expression evaluation
    // In production, use a proper expression parser

    const strValue = String(value ?? "");
    const numValue = parseFloat(strValue) || 0;

    // Handle common expressions
    if (expression.startsWith("UPPER(")) {
      return strValue.toUpperCase();
    }
    if (expression.startsWith("LOWER(")) {
      return strValue.toLowerCase();
    }
    if (expression.startsWith("TRIM(")) {
      return strValue.trim();
    }
    if (expression.includes("* 100")) {
      return numValue * 100;
    }
    if (expression.includes("/ 100")) {
      return numValue / 100;
    }

    return value;
  }

  /**
   * Validate a value against a validation rule
   */
  private validateValue(
    value: CellValue,
    validation: FieldMapping["validations"][0]
  ): boolean {
    const strValue = value === null ? "" : String(value);

    switch (validation.type) {
      case "required":
        return value !== null && value !== undefined && strValue !== "";

      case "min_length":
        return strValue.length >= (validation.value as number);

      case "max_length":
        return strValue.length <= (validation.value as number);

      case "min_value":
        const minNum = parseFloat(strValue);
        return !isNaN(minNum) && minNum >= (validation.value as number);

      case "max_value":
        const maxNum = parseFloat(strValue);
        return !isNaN(maxNum) && maxNum <= (validation.value as number);

      case "pattern":
        const regex = new RegExp(validation.value as string);
        return regex.test(strValue);

      case "email":
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strValue);

      case "phone":
        return /^[\d\s\-\(\)\+\.]{10,}$/.test(strValue);

      case "date":
        return this.parseDate(strValue) !== null;

      case "in_list":
        const list = validation.value as string;
        const items = list.split(",").map((s) => s.trim().toLowerCase());
        return items.includes(strValue.toLowerCase());

      default:
        return true;
    }
  }

  /**
   * Set a value at a nested path in an object
   */
  private setNestedValue(
    obj: Record<string, unknown>,
    path: string,
    value: CellValue
  ): void {
    const parts = path.split(".");
    let current: Record<string, unknown> = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part] || typeof current[part] !== "object") {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    const finalPart = parts[parts.length - 1];

    // Handle array notation like "identifiers[email]"
    const arrayMatch = finalPart.match(/^(\w+)\[(\w+)\]$/);
    if (arrayMatch) {
      const [, arrayName, key] = arrayMatch;
      if (!current[arrayName]) {
        current[arrayName] = [];
      }
      const arr = current[arrayName] as Record<string, unknown>[];
      arr.push({ scheme: key, value });
    } else {
      current[finalPart] = value;
    }
  }

  /**
   * Generate auto-mappings based on column suggestions
   */
  private generateAutoMappings(
    connectionId: string,
    worksheetName: string,
    columns: { header: string; dataType: string; suggestedMapping?: unknown }[]
  ): FieldMapping[] {
    const mappings: FieldMapping[] = [];

    for (const column of columns) {
      if (column.suggestedMapping) {
        const suggestion = column.suggestedMapping as FieldVariation;
        mappings.push({
          id: crypto.randomUUID(),
          connectionId,
          sourceWorksheet: worksheetName,
          sourceColumn: column.header,
          targetEntity: suggestion.targetEntity as TargetEntity,
          targetField: suggestion.targetField,
          transform: suggestion.transform
            ? { type: suggestion.transform }
            : undefined,
          enabled: true,
        });
      } else {
        // Try to find a mapping using field variations
        const bestMapping = findBestFieldMapping(
          column.header,
          column.dataType as any
        );
        if (bestMapping && bestMapping.confidence >= 0.7) {
          mappings.push({
            id: crypto.randomUUID(),
            connectionId,
            sourceWorksheet: worksheetName,
            sourceColumn: column.header,
            targetEntity: bestMapping.targetEntity,
            targetField: bestMapping.targetField,
            transform: bestMapping.transform
              ? { type: bestMapping.transform, params: bestMapping.transformParams }
              : undefined,
            enabled: true,
          });
        }
      }
    }

    return mappings;
  }

  /**
   * Create a record in Open LOS
   */
  private async createRecord(
    entity: TargetEntity,
    data: Record<string, unknown>
  ): Promise<string> {
    const actor = this.config.actorId;

    // Add tenant ID
    const recordData = {
      ...data,
      tenant_id: this.config.tenantId,
    };

    switch (entity) {
      case "deals":
        return this.config.db.createDeal(recordData, actor);
      case "entities":
        return this.config.db.createEntity(recordData, actor);
      case "facilities":
        return this.config.db.createFacility(recordData, actor);
      case "documents":
        return this.config.db.createDocument(recordData, actor);
      default:
        throw new Error(`Unsupported entity type: ${entity}`);
    }
  }

  /**
   * Update a record in Open LOS
   */
  private async updateRecord(
    entity: TargetEntity,
    id: string,
    data: Record<string, unknown>
  ): Promise<void> {
    const actor = this.config.actorId;

    switch (entity) {
      case "deals":
        return this.config.db.updateDeal(id, data, actor);
      case "entities":
        return this.config.db.updateEntity(id, data, actor);
      case "facilities":
        return this.config.db.updateFacility(id, data, actor);
      case "documents":
        return this.config.db.updateDocument(id, data, actor);
      default:
        throw new Error(`Unsupported entity type: ${entity}`);
    }
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    for (const adapter of this.adapters.values()) {
      await adapter.dispose();
    }
    this.adapters.clear();
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new spreadsheet sync engine
 */
export function createSpreadsheetSyncEngine(
  config: SpreadsheetSyncEngineConfig
): SpreadsheetSyncEngine {
  return new SpreadsheetSyncEngine(config);
}
