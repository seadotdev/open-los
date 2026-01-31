/**
 * Excel Adapter
 *
 * Adapter for syncing data from Excel files (.xlsx, .xls) to Open LOS.
 * Supports local files, network shares, and file watching for continuous sync.
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import {
  SpreadsheetAdapter,
  ExcelConnectionConfig,
  SpreadsheetConnectionConfig,
  ConnectionTestResult,
  SpreadsheetSchema,
  WorksheetSchema,
  ColumnSchema,
  SpreadsheetDataType,
  SpreadsheetRow,
  CellValue,
  FetchRowsOptions,
  FetchRowsResult,
  ChangeEvent,
  WatchHandle,
} from "./types";

// ExcelJS types (would be imported from exceljs package)
interface Workbook {
  xlsx: {
    readFile(path: string, options?: { password?: string }): Promise<void>;
  };
  worksheets: Worksheet[];
  getWorksheet(nameOrId: string | number): Worksheet | undefined;
}

interface Worksheet {
  name: string;
  rowCount: number;
  columnCount: number;
  actualRowCount: number;
  actualColumnCount: number;
  getRow(rowNumber: number): Row;
  getColumn(colNumber: number): Column;
  eachRow(
    options: { includeEmpty?: boolean },
    callback: (row: Row, rowNumber: number) => void
  ): void;
}

interface Row {
  values: CellValue[];
  eachCell(
    options: { includeEmpty?: boolean },
    callback: (cell: Cell, colNumber: number) => void
  ): void;
}

interface Column {
  values: CellValue[];
  header?: string;
}

interface Cell {
  value: CellValue;
  type: number;
  text: string;
  result?: CellValue;
  formula?: string;
}

/**
 * Excel file adapter for spreadsheet sync
 */
export class ExcelAdapter implements SpreadsheetAdapter {
  readonly type = "excel" as const;
  readonly name = "Excel Files";
  readonly features = {
    watchChanges: true,
    realtime: false,
    documents: false,
    incrementalSync: true,
  };

  private config!: ExcelConnectionConfig;
  private workbook: Workbook | null = null;
  private lastModified: Date | null = null;
  private watchInterval: NodeJS.Timeout | null = null;

  async initialize(config: SpreadsheetConnectionConfig): Promise<void> {
    if (config.type !== "excel") {
      throw new Error("Invalid config type for Excel adapter");
    }
    this.config = config;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      // Check file exists
      if (!fs.existsSync(this.config.filePath)) {
        return {
          success: false,
          message: `File not found: ${this.config.filePath}`,
        };
      }

      // Check file is readable
      const stats = fs.statSync(this.config.filePath);
      if (!stats.isFile()) {
        return {
          success: false,
          message: `Path is not a file: ${this.config.filePath}`,
        };
      }

      // Try to load the workbook
      await this.loadWorkbook();

      if (!this.workbook) {
        return {
          success: false,
          message: "Failed to load workbook",
        };
      }

      // Get worksheet count and estimated rows
      const worksheetCount = this.workbook.worksheets.length;
      let estimatedRows = 0;
      for (const ws of this.workbook.worksheets) {
        estimatedRows += ws.actualRowCount;
      }

      return {
        success: true,
        message: `Successfully connected to ${path.basename(this.config.filePath)}`,
        details: {
          sourceName: path.basename(this.config.filePath),
          lastModified: stats.mtime,
          worksheetCount,
          estimatedRows,
        },
      };
    } catch (error) {
      const err = error as Error;
      if (err.message?.includes("password")) {
        return {
          success: false,
          message: "File is password protected. Please provide the password.",
          error: err,
        };
      }
      return {
        success: false,
        message: `Connection failed: ${err.message}`,
        error: err,
      };
    }
  }

  async discoverSchema(): Promise<SpreadsheetSchema> {
    await this.ensureWorkbookLoaded();

    const worksheets: WorksheetSchema[] = [];

    for (const ws of this.workbook!.worksheets) {
      const worksheetSchema = await this.analyzeWorksheet(ws);
      worksheets.push(worksheetSchema);
    }

    return {
      sourceType: "excel",
      version: "1.0",
      discoveredAt: new Date(),
      worksheets,
    };
  }

  async previewData(
    worksheet: string,
    options?: { limit?: number; offset?: number }
  ): Promise<SpreadsheetRow[]> {
    const result = await this.fetchRows(worksheet, {
      limit: options?.limit ?? 10,
      cursor: options?.offset?.toString(),
    });
    return result.rows;
  }

  async fetchRows(
    worksheet: string,
    options?: FetchRowsOptions
  ): Promise<FetchRowsResult> {
    await this.ensureWorkbookLoaded();

    const ws = this.workbook!.getWorksheet(worksheet);
    if (!ws) {
      throw new Error(`Worksheet not found: ${worksheet}`);
    }

    const limit = options?.limit ?? 1000;
    const offset = options?.cursor ? parseInt(options.cursor, 10) : 0;

    // Detect header row (usually row 1)
    const headerRow = ws.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers[colNumber - 1] = cell.text || `Column${colNumber}`;
    });

    const rows: SpreadsheetRow[] = [];
    let processedCount = 0;
    let currentOffset = 0;

    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      // Skip header row
      if (rowNumber === 1) return;

      // Handle offset
      if (currentOffset < offset) {
        currentOffset++;
        return;
      }

      // Handle limit
      if (processedCount >= limit) return;

      const rowData: Record<string, CellValue> = {};
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const header = headers[colNumber - 1] || `Column${colNumber}`;
        rowData[header] = this.getCellValue(cell);
      });

      const rowHash = this.computeRowHash(rowData);

      rows.push({
        rowIndex: rowNumber - 2, // 0-based, excluding header
        rowNumber,
        data: rowData,
        hash: rowHash,
      });

      processedCount++;
      currentOffset++;
    });

    const totalCount = ws.actualRowCount - 1; // Exclude header
    const nextOffset = offset + processedCount;
    const hasMore = nextOffset < totalCount;

    return {
      rows,
      cursor: hasMore ? nextOffset.toString() : undefined,
      hasMore,
      totalCount,
    };
  }

  async getRow(worksheet: string, rowId: string): Promise<SpreadsheetRow | null> {
    await this.ensureWorkbookLoaded();

    const ws = this.workbook!.getWorksheet(worksheet);
    if (!ws) {
      return null;
    }

    // rowId can be either row number or a primary key value
    const rowNumber = parseInt(rowId, 10);
    if (isNaN(rowNumber) || rowNumber < 2) {
      // Search by primary key would require knowing which column is the key
      // For now, only support row number lookup
      return null;
    }

    const headerRow = ws.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers[colNumber - 1] = cell.text || `Column${colNumber}`;
    });

    const row = ws.getRow(rowNumber);
    if (!row) {
      return null;
    }

    const rowData: Record<string, CellValue> = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber - 1] || `Column${colNumber}`;
      rowData[header] = this.getCellValue(cell);
    });

    // Check if row is empty
    if (Object.values(rowData).every((v) => v === null || v === "")) {
      return null;
    }

    return {
      rowIndex: rowNumber - 2,
      rowNumber,
      data: rowData,
      hash: this.computeRowHash(rowData),
    };
  }

  async getRowCount(worksheet: string): Promise<number> {
    await this.ensureWorkbookLoaded();

    const ws = this.workbook!.getWorksheet(worksheet);
    if (!ws) {
      return 0;
    }

    return Math.max(0, ws.actualRowCount - 1); // Exclude header
  }

  startWatching(callback: (event: ChangeEvent) => void): WatchHandle {
    if (!this.config.watchForChanges) {
      throw new Error("File watching is not enabled for this connection");
    }

    const pollInterval = this.config.pollInterval ?? 30000; // Default 30 seconds
    let isWatching = true;

    // Store initial modification time
    this.lastModified = fs.statSync(this.config.filePath).mtime;

    this.watchInterval = setInterval(async () => {
      if (!isWatching) return;

      try {
        const stats = fs.statSync(this.config.filePath);
        if (stats.mtime > this.lastModified!) {
          this.lastModified = stats.mtime;

          // Reload workbook
          await this.loadWorkbook();

          // Emit change event
          callback({
            type: "file_modified",
            worksheet: "*",
            timestamp: stats.mtime,
          });
        }
      } catch (error) {
        console.error("Error watching file:", error);
      }
    }, pollInterval);

    return {
      stop: () => {
        isWatching = false;
        if (this.watchInterval) {
          clearInterval(this.watchInterval);
          this.watchInterval = null;
        }
      },
      get isWatching() {
        return isWatching;
      },
    };
  }

  async dispose(): Promise<void> {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
    }
    this.workbook = null;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private async loadWorkbook(): Promise<void> {
    // In production, this would use the exceljs library:
    // const ExcelJS = require('exceljs');
    // this.workbook = new ExcelJS.Workbook();
    // await this.workbook.xlsx.readFile(this.config.filePath, {
    //   password: this.config.password,
    // });

    // For now, create a mock workbook structure
    // This would be replaced with actual ExcelJS implementation
    this.workbook = this.createMockWorkbook();
  }

  private async ensureWorkbookLoaded(): Promise<void> {
    if (!this.workbook) {
      await this.loadWorkbook();
    }
  }

  private async analyzeWorksheet(ws: Worksheet): Promise<WorksheetSchema> {
    const columns: ColumnSchema[] = [];

    // Get headers from first row
    const headerRow = ws.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers.push(cell.text || `Column${colNumber}`);
    });

    // Analyze each column
    for (let colIndex = 0; colIndex < headers.length; colIndex++) {
      const header = headers[colIndex];
      const colNumber = colIndex + 1;
      const column = ws.getColumn(colNumber);

      const sampleValues: string[] = [];
      const valueCounts = new Map<string, number>();
      let nonEmptyCount = 0;
      let rowsAnalyzed = 0;

      // Analyze first 100 rows for type detection
      ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header
        if (rowsAnalyzed >= 100) return;

        const cell = row.values[colNumber] as Cell | undefined;
        if (cell !== undefined && cell !== null) {
          const value = typeof cell === "object" && "text" in cell ? cell.text : String(cell);
          if (value !== "") {
            nonEmptyCount++;
            if (sampleValues.length < 5) {
              sampleValues.push(value);
            }
            valueCounts.set(value, (valueCounts.get(value) || 0) + 1);
          }
        }
        rowsAnalyzed++;
      });

      const fillRate = rowsAnalyzed > 0 ? nonEmptyCount / rowsAnalyzed : 0;
      const dataType = this.detectDataType(sampleValues);
      const isPrimaryKeyCandidate =
        valueCounts.size === nonEmptyCount &&
        nonEmptyCount > 0 &&
        fillRate > 0.9;

      columns.push({
        index: colIndex,
        letter: this.columnIndexToLetter(colIndex),
        header,
        dataType,
        sampleValues,
        isPrimaryKeyCandidate,
        fillRate,
        uniqueValueCount: valueCounts.size <= 100 ? valueCounts.size : undefined,
        suggestedMapping: this.suggestMapping(header, dataType, sampleValues),
      });
    }

    const rowCount = Math.max(0, ws.actualRowCount - 1);
    const suggestedEntity = this.suggestEntity(columns);

    return {
      name: ws.name,
      displayName: ws.name,
      rowCount,
      columns,
      headerRowIndex: 0,
      dataRowIndex: 1,
      suggestedEntity: suggestedEntity?.entity,
      entityConfidence: suggestedEntity?.confidence,
    };
  }

  private detectDataType(samples: string[]): SpreadsheetDataType {
    if (samples.length === 0) return "empty";

    const types = samples.map((s) => this.inferCellType(s));
    const typeSet = new Set(types);

    if (typeSet.size === 1) {
      return types[0];
    }

    // If mixed but mostly one type, use that
    const typeCounts = new Map<SpreadsheetDataType, number>();
    for (const t of types) {
      typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
    }

    const mostCommon = [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (mostCommon && mostCommon[1] / types.length >= 0.8) {
      return mostCommon[0];
    }

    return "mixed";
  }

  private inferCellType(value: string): SpreadsheetDataType {
    if (!value || value.trim() === "") return "empty";

    const trimmed = value.trim();

    // Email
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return "email";
    }

    // Phone
    if (/^[\d\s\-\(\)\+\.]{7,}$/.test(trimmed) && /\d{3,}/.test(trimmed)) {
      return "phone";
    }

    // URL
    if (/^https?:\/\//.test(trimmed) || /^www\./.test(trimmed)) {
      return "url";
    }

    // Currency (with $, EUR, GBP, etc.)
    if (/^[\$\u00A3\u20AC][\d,]+\.?\d*$/.test(trimmed) ||
        /^[\d,]+\.?\d*[\$\u00A3\u20AC]$/.test(trimmed)) {
      return "currency";
    }

    // Percentage
    if (/^-?\d+\.?\d*\s*%$/.test(trimmed)) {
      return "percentage";
    }

    // Boolean
    if (/^(true|false|yes|no|y|n|1|0)$/i.test(trimmed)) {
      return "boolean";
    }

    // Date (various formats)
    if (
      /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(trimmed) ||
      /^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}$/.test(trimmed) ||
      /^\w{3,9}\s+\d{1,2},?\s+\d{4}$/.test(trimmed)
    ) {
      return "date";
    }

    // Datetime
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(trimmed)) {
      return "datetime";
    }

    // Number
    if (/^-?[\d,]+\.?\d*$/.test(trimmed.replace(/,/g, ""))) {
      return "number";
    }

    return "text";
  }

  private suggestMapping(
    header: string,
    dataType: SpreadsheetDataType,
    samples: string[]
  ): ColumnSchema["suggestedMapping"] | undefined {
    // Import field variations for matching
    const mapping = findBestMapping(header.toLowerCase(), dataType);
    if (mapping) {
      return mapping;
    }
    return undefined;
  }

  private suggestEntity(
    columns: ColumnSchema[]
  ): { entity: string; confidence: number } | undefined {
    // Analyze column patterns to suggest entity type
    const headerLower = columns.map((c) => c.header.toLowerCase());

    // Deal indicators
    const dealIndicators = [
      "deal",
      "loan",
      "application",
      "amount",
      "rate",
      "status",
      "stage",
      "borrower",
      "originator",
    ];
    const dealScore = dealIndicators.filter((i) =>
      headerLower.some((h) => h.includes(i))
    ).length;

    // Entity indicators
    const entityIndicators = [
      "company",
      "contact",
      "name",
      "email",
      "phone",
      "address",
      "ein",
      "tax",
    ];
    const entityScore = entityIndicators.filter((i) =>
      headerLower.some((h) => h.includes(i))
    ).length;

    // Facility indicators
    const facilityIndicators = [
      "facility",
      "credit",
      "line",
      "term",
      "maturity",
      "collateral",
    ];
    const facilityScore = facilityIndicators.filter((i) =>
      headerLower.some((h) => h.includes(i))
    ).length;

    if (dealScore >= 3) {
      return { entity: "deals", confidence: Math.min(0.9, dealScore * 0.15) };
    }
    if (entityScore >= 3) {
      return { entity: "entities", confidence: Math.min(0.9, entityScore * 0.15) };
    }
    if (facilityScore >= 2) {
      return { entity: "facilities", confidence: Math.min(0.9, facilityScore * 0.15) };
    }

    return undefined;
  }

  private getCellValue(cell: Cell): CellValue {
    if (cell === null || cell === undefined) {
      return null;
    }

    // Handle formula cells
    if (cell.formula && cell.result !== undefined) {
      return cell.result;
    }

    const value = cell.value;

    if (value === null || value === undefined) {
      return null;
    }

    // Handle Date objects
    if (value instanceof Date) {
      return value;
    }

    // Handle rich text
    if (typeof value === "object" && "richText" in value) {
      return (value as any).richText
        .map((rt: any) => rt.text)
        .join("");
    }

    // Handle hyperlinks
    if (typeof value === "object" && "hyperlink" in value) {
      return (value as any).text || (value as any).hyperlink;
    }

    // Handle error values
    if (typeof value === "object" && "error" in value) {
      return null;
    }

    return value as CellValue;
  }

  private computeRowHash(data: Record<string, CellValue>): string {
    const sortedKeys = Object.keys(data).sort();
    const values = sortedKeys.map((k) => {
      const v = data[k];
      if (v === null || v === undefined) return "";
      if (v instanceof Date) return v.toISOString();
      return String(v);
    });
    return crypto
      .createHash("md5")
      .update(values.join("|"))
      .digest("hex");
  }

  private columnIndexToLetter(index: number): string {
    let letter = "";
    let temp = index;
    while (temp >= 0) {
      letter = String.fromCharCode((temp % 26) + 65) + letter;
      temp = Math.floor(temp / 26) - 1;
    }
    return letter;
  }

  // Mock workbook for testing (would be removed in production)
  private createMockWorkbook(): Workbook {
    return {
      xlsx: {
        readFile: async () => {},
      },
      worksheets: [
        {
          name: "Pipeline",
          rowCount: 100,
          columnCount: 10,
          actualRowCount: 50,
          actualColumnCount: 10,
          getRow: (rowNumber: number) => ({
            values: [],
            eachCell: () => {},
          }),
          getColumn: (colNumber: number) => ({
            values: [],
          }),
          eachRow: () => {},
        },
      ],
      getWorksheet: (nameOrId: string | number) => undefined,
    };
  }
}

// =============================================================================
// Field Mapping Helper
// =============================================================================

/**
 * Find best field mapping for a column header
 */
function findBestMapping(
  header: string,
  dataType: SpreadsheetDataType
): ColumnSchema["suggestedMapping"] | undefined {
  // This would use the field variations database
  // For now, implement basic matching
  const mappings: Record<string, { entity: string; field: string; confidence: number }> = {
    // Deal fields
    "deal name": { entity: "deals", field: "borrower_name", confidence: 0.9 },
    "loan name": { entity: "deals", field: "borrower_name", confidence: 0.9 },
    "project name": { entity: "deals", field: "borrower_name", confidence: 0.8 },
    "borrower": { entity: "deals", field: "borrower_name", confidence: 0.85 },
    "borrower name": { entity: "deals", field: "borrower_name", confidence: 0.95 },
    "amount": { entity: "facilities", field: "amount", confidence: 0.8 },
    "loan amount": { entity: "facilities", field: "amount", confidence: 0.95 },
    "principal": { entity: "facilities", field: "amount", confidence: 0.85 },
    "status": { entity: "deals", field: "stage", confidence: 0.8 },
    "stage": { entity: "deals", field: "stage", confidence: 0.9 },
    "phase": { entity: "deals", field: "stage", confidence: 0.75 },
    "rate": { entity: "facilities", field: "interest_rate_value", confidence: 0.8 },
    "interest rate": { entity: "facilities", field: "interest_rate_value", confidence: 0.95 },
    "coupon": { entity: "facilities", field: "interest_rate_value", confidence: 0.8 },
    "term": { entity: "facilities", field: "term_months", confidence: 0.8 },
    "loan term": { entity: "facilities", field: "term_months", confidence: 0.9 },
    "maturity": { entity: "facilities", field: "term_months", confidence: 0.75 },
    "originator": { entity: "deals", field: "assigned_to", confidence: 0.85 },
    "loan officer": { entity: "deals", field: "assigned_to", confidence: 0.9 },
    "lo": { entity: "deals", field: "assigned_to", confidence: 0.7 },

    // Entity fields
    "company name": { entity: "entities", field: "name", confidence: 0.95 },
    "company": { entity: "entities", field: "name", confidence: 0.85 },
    "entity": { entity: "entities", field: "name", confidence: 0.8 },
    "contact": { entity: "entities", field: "name", confidence: 0.75 },
    "email": { entity: "entities", field: "identifiers.email", confidence: 0.9 },
    "contact email": { entity: "entities", field: "identifiers.email", confidence: 0.95 },
    "phone": { entity: "entities", field: "identifiers.phone", confidence: 0.9 },
    "contact phone": { entity: "entities", field: "identifiers.phone", confidence: 0.95 },
    "ein": { entity: "entities", field: "registration_number", confidence: 0.95 },
    "tax id": { entity: "entities", field: "registration_number", confidence: 0.9 },
  };

  const normalizedHeader = header.toLowerCase().trim();
  const exactMatch = mappings[normalizedHeader];
  if (exactMatch) {
    return {
      targetEntity: exactMatch.entity,
      targetField: exactMatch.field,
      confidence: exactMatch.confidence,
      reason: "Exact header match",
    };
  }

  // Try partial matching
  for (const [pattern, mapping] of Object.entries(mappings)) {
    if (normalizedHeader.includes(pattern) || pattern.includes(normalizedHeader)) {
      return {
        targetEntity: mapping.entity,
        targetField: mapping.field,
        confidence: mapping.confidence * 0.8,
        reason: "Partial header match",
      };
    }
  }

  return undefined;
}

// Register adapter
export function registerExcelAdapter(): void {
  // This would register with the adapter registry
  console.log("Excel adapter registered");
}
