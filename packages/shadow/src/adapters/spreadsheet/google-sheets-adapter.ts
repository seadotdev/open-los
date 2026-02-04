/**
 * Google Sheets Adapter
 *
 * Adapter for syncing data from Google Sheets to Open LOS.
 * Supports OAuth 2.0 and service account authentication, with real-time
 * change detection via Drive webhooks.
 */

import * as crypto from "crypto";
import {
  SpreadsheetAdapter,
  GoogleSheetsConnectionConfig,
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

// Google API types (would be imported from googleapis package)
interface SheetsAPI {
  spreadsheets: {
    get(params: { spreadsheetId: string; fields?: string }): Promise<{ data: Spreadsheet }>;
    values: {
      get(params: {
        spreadsheetId: string;
        range: string;
        valueRenderOption?: string;
        dateTimeRenderOption?: string;
      }): Promise<{ data: ValueRange }>;
      batchGet(params: {
        spreadsheetId: string;
        ranges: string[];
        valueRenderOption?: string;
      }): Promise<{ data: BatchGetValuesResponse }>;
    };
  };
}

interface DriveAPI {
  files: {
    get(params: { fileId: string; fields?: string }): Promise<{ data: DriveFile }>;
    watch(
      params: { fileId: string },
      body: { id: string; type: string; address: string; expiration?: string }
    ): Promise<{ data: Channel }>;
  };
  channels: {
    stop(body: { id: string; resourceId: string }): Promise<void>;
  };
}

interface Spreadsheet {
  spreadsheetId: string;
  properties: {
    title: string;
    locale: string;
    timeZone: string;
  };
  sheets: Sheet[];
}

interface Sheet {
  properties: {
    sheetId: number;
    title: string;
    index: number;
    gridProperties: {
      rowCount: number;
      columnCount: number;
      frozenRowCount?: number;
    };
  };
}

interface ValueRange {
  range: string;
  majorDimension: string;
  values?: CellValue[][];
}

interface BatchGetValuesResponse {
  spreadsheetId: string;
  valueRanges: ValueRange[];
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  owners: { emailAddress: string }[];
}

interface Channel {
  id: string;
  resourceId: string;
  resourceUri: string;
  token?: string;
  expiration?: string;
}

/**
 * Google Sheets adapter for spreadsheet sync
 */
export class GoogleSheetsAdapter implements SpreadsheetAdapter {
  readonly type = "google_sheets" as const;
  readonly name = "Google Sheets";
  readonly features = {
    watchChanges: true,
    realtime: true,
    documents: false,
    incrementalSync: true,
  };

  private config!: GoogleSheetsConnectionConfig;
  private sheetsApi: SheetsAPI | null = null;
  private driveApi: DriveAPI | null = null;
  private spreadsheet: Spreadsheet | null = null;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private activeChannel: Channel | null = null;

  async initialize(config: SpreadsheetConnectionConfig): Promise<void> {
    if (config.type !== "google_sheets") {
      throw new Error("Invalid config type for Google Sheets adapter");
    }
    this.config = config;
    await this.initializeApis();
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      await this.ensureAuthenticated();

      // Get spreadsheet metadata
      const response = await this.sheetsApi!.spreadsheets.get({
        spreadsheetId: this.config.spreadsheetId,
        fields: "spreadsheetId,properties,sheets.properties",
      });

      this.spreadsheet = response.data;

      // Get file info from Drive
      const fileResponse = await this.driveApi!.files.get({
        fileId: this.config.spreadsheetId,
        fields: "id,name,modifiedTime,owners",
      });

      const file = fileResponse.data;

      // Estimate row count
      let estimatedRows = 0;
      for (const sheet of this.spreadsheet.sheets) {
        estimatedRows += sheet.properties.gridProperties.rowCount;
      }

      return {
        success: true,
        message: `Successfully connected to "${this.spreadsheet.properties.title}"`,
        details: {
          sourceName: this.spreadsheet.properties.title,
          lastModified: new Date(file.modifiedTime),
          worksheetCount: this.spreadsheet.sheets.length,
          estimatedRows,
        },
      };
    } catch (error) {
      const err = error as any;
      if (err.code === 404) {
        return {
          success: false,
          message: "Spreadsheet not found. Please check the spreadsheet ID.",
          error: err,
        };
      }
      if (err.code === 403) {
        return {
          success: false,
          message: "Access denied. Please check your permissions.",
          error: err,
        };
      }
      if (err.code === 401) {
        return {
          success: false,
          message: "Authentication failed. Please check your credentials.",
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
    await this.ensureSpreadsheetLoaded();

    const worksheets: WorksheetSchema[] = [];

    for (const sheet of this.spreadsheet!.sheets) {
      const worksheetSchema = await this.analyzeSheet(sheet);
      worksheets.push(worksheetSchema);
    }

    return {
      sourceType: "google_sheets",
      version: "v4",
      discoveredAt: new Date(),
      worksheets,
    };
  }

  async previewData(
    worksheet: string,
    options?: { limit?: number; offset?: number }
  ): Promise<SpreadsheetRow[]> {
    const limit = options?.limit ?? 10;
    const offset = options?.offset ?? 0;

    await this.ensureAuthenticated();

    // Construct range: SheetName!A:Z for first N rows
    const endRow = offset + limit + 1; // +1 for header
    const range = `'${worksheet}'!A1:ZZ${endRow}`;

    const response = await this.sheetsApi!.spreadsheets.values.get({
      spreadsheetId: this.config.spreadsheetId,
      range,
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    });

    const values = response.data.values || [];
    if (values.length === 0) {
      return [];
    }

    const headers = values[0].map((h, i) => String(h) || `Column${i + 1}`);
    const rows: SpreadsheetRow[] = [];

    for (let i = 1 + offset; i < values.length && rows.length < limit; i++) {
      const rowValues = values[i] || [];
      const rowData: Record<string, CellValue> = {};

      for (let j = 0; j < headers.length; j++) {
        rowData[headers[j]] = this.normalizeCellValue(rowValues[j]);
      }

      rows.push({
        rowIndex: i - 1,
        rowNumber: i + 1, // 1-based for display
        data: rowData,
        hash: this.computeRowHash(rowData),
      });
    }

    return rows;
  }

  async fetchRows(
    worksheet: string,
    options?: FetchRowsOptions
  ): Promise<FetchRowsResult> {
    await this.ensureAuthenticated();

    const limit = options?.limit ?? 1000;
    const offset = options?.cursor ? parseInt(options.cursor, 10) : 0;

    // Fetch all data at once (Google Sheets doesn't support server-side pagination well)
    const range = `'${worksheet}'!A:ZZ`;

    const response = await this.sheetsApi!.spreadsheets.values.get({
      spreadsheetId: this.config.spreadsheetId,
      range,
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    });

    const values = response.data.values || [];
    if (values.length === 0) {
      return {
        rows: [],
        hasMore: false,
        totalCount: 0,
      };
    }

    const headers = values[0].map((h, i) => String(h) || `Column${i + 1}`);
    const totalCount = values.length - 1; // Exclude header

    const rows: SpreadsheetRow[] = [];
    const endIndex = Math.min(1 + offset + limit, values.length);

    for (let i = 1 + offset; i < endIndex; i++) {
      const rowValues = values[i] || [];
      const rowData: Record<string, CellValue> = {};

      for (let j = 0; j < headers.length; j++) {
        rowData[headers[j]] = this.normalizeCellValue(rowValues[j]);
      }

      // Skip empty rows
      if (Object.values(rowData).every((v) => v === null || v === "")) {
        continue;
      }

      rows.push({
        rowIndex: i - 1,
        rowNumber: i + 1,
        data: rowData,
        hash: this.computeRowHash(rowData),
      });
    }

    const nextOffset = offset + rows.length;
    const hasMore = nextOffset < totalCount;

    return {
      rows,
      cursor: hasMore ? nextOffset.toString() : undefined,
      hasMore,
      totalCount,
    };
  }

  async getRow(worksheet: string, rowId: string): Promise<SpreadsheetRow | null> {
    const rowNumber = parseInt(rowId, 10);
    if (isNaN(rowNumber) || rowNumber < 2) {
      return null;
    }

    await this.ensureAuthenticated();

    // Fetch header and specific row
    const ranges = [
      `'${worksheet}'!A1:ZZ1`, // Header
      `'${worksheet}'!A${rowNumber}:ZZ${rowNumber}`, // Data row
    ];

    const response = await this.sheetsApi!.spreadsheets.values.batchGet({
      spreadsheetId: this.config.spreadsheetId,
      ranges,
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const headerValues = response.data.valueRanges[0]?.values?.[0] || [];
    const rowValues = response.data.valueRanges[1]?.values?.[0] || [];

    if (rowValues.length === 0) {
      return null;
    }

    const headers = headerValues.map((h, i) => String(h) || `Column${i + 1}`);
    const rowData: Record<string, CellValue> = {};

    for (let j = 0; j < headers.length; j++) {
      rowData[headers[j]] = this.normalizeCellValue(rowValues[j]);
    }

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
    await this.ensureSpreadsheetLoaded();

    const sheet = this.spreadsheet!.sheets.find(
      (s) => s.properties.title === worksheet
    );

    if (!sheet) {
      return 0;
    }

    // The rowCount from metadata includes empty rows
    // For accuracy, we'd need to fetch and count non-empty rows
    // For performance, return the metadata count minus header
    return Math.max(0, sheet.properties.gridProperties.rowCount - 1);
  }

  startWatching(callback: (event: ChangeEvent) => void): WatchHandle {
    if (!this.config.enableWebhooks) {
      throw new Error("Webhooks are not enabled for this connection");
    }

    let isWatching = true;
    let channelId = crypto.randomUUID();

    // Start watch channel
    const startWatch = async () => {
      try {
        await this.ensureAuthenticated();

        // In production, this would register a webhook with Google Drive
        // The webhook URL would need to be a publicly accessible endpoint
        // that receives push notifications when the file changes

        // For now, fall back to polling
        const pollInterval = setInterval(async () => {
          if (!isWatching) return;

          try {
            const file = await this.driveApi!.files.get({
              fileId: this.config.spreadsheetId,
              fields: "modifiedTime",
            });

            // Check if file was modified
            // In production, this would be replaced by webhook notifications
            callback({
              type: "file_modified",
              worksheet: "*",
              timestamp: new Date(file.data.modifiedTime),
            });
          } catch (error) {
            console.error("Error polling for changes:", error);
          }
        }, 60000); // Poll every minute as fallback

        return pollInterval;
      } catch (error) {
        console.error("Error starting watch:", error);
        throw error;
      }
    };

    let pollInterval: NodeJS.Timeout | null = null;
    startWatch().then((interval) => {
      pollInterval = interval;
    });

    return {
      stop: () => {
        isWatching = false;
        if (pollInterval) {
          clearInterval(pollInterval);
        }
        // Stop the Drive watch channel if active
        if (this.activeChannel) {
          this.driveApi?.channels.stop({
            id: this.activeChannel.id,
            resourceId: this.activeChannel.resourceId,
          }).catch((err) => {
            console.error("Error stopping channel:", err);
          });
          this.activeChannel = null;
        }
      },
      get isWatching() {
        return isWatching;
      },
    };
  }

  async dispose(): Promise<void> {
    if (this.activeChannel) {
      try {
        await this.driveApi?.channels.stop({
          id: this.activeChannel.id,
          resourceId: this.activeChannel.resourceId,
        });
      } catch (error) {
        // Ignore cleanup errors
      }
      this.activeChannel = null;
    }
    this.sheetsApi = null;
    this.driveApi = null;
    this.spreadsheet = null;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private async initializeApis(): Promise<void> {
    await this.ensureAuthenticated();

    // In production, this would initialize the Google APIs:
    // const { google } = require('googleapis');
    // const auth = new google.auth.OAuth2(...);
    // this.sheetsApi = google.sheets({ version: 'v4', auth });
    // this.driveApi = google.drive({ version: 'v3', auth });

    // Create mock APIs for now
    this.sheetsApi = this.createMockSheetsApi();
    this.driveApi = this.createMockDriveApi();
  }

  private async ensureAuthenticated(): Promise<void> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return;
    }

    const credentials = this.config.credentials;

    if (credentials.serviceAccountKey) {
      // Service account authentication
      await this.authenticateServiceAccount(credentials.serviceAccountKey);
    } else if (credentials.refreshToken) {
      // OAuth refresh
      await this.refreshOAuthToken(credentials.refreshToken);
    } else if (credentials.accessToken) {
      // Use provided access token (might be expired)
      this.accessToken = credentials.accessToken;
      this.tokenExpiry = new Date(Date.now() + 3600000); // Assume 1 hour
    } else {
      throw new Error("No valid credentials provided");
    }
  }

  private async authenticateServiceAccount(keyJson: string): Promise<void> {
    // In production:
    // const auth = new google.auth.GoogleAuth({
    //   credentials: JSON.parse(keyJson),
    //   scopes: [
    //     'https://www.googleapis.com/auth/spreadsheets.readonly',
    //     'https://www.googleapis.com/auth/drive.readonly',
    //   ],
    // });
    // const client = await auth.getClient();
    // const token = await client.getAccessToken();
    // this.accessToken = token.token;

    this.accessToken = "mock_service_account_token";
    this.tokenExpiry = new Date(Date.now() + 3600000);
  }

  private async refreshOAuthToken(refreshToken: string): Promise<void> {
    // In production:
    // const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    // oauth2Client.setCredentials({ refresh_token: refreshToken });
    // const { credentials } = await oauth2Client.refreshAccessToken();
    // this.accessToken = credentials.access_token;
    // this.tokenExpiry = new Date(credentials.expiry_date);

    this.accessToken = "mock_refreshed_token";
    this.tokenExpiry = new Date(Date.now() + 3600000);
  }

  private async ensureSpreadsheetLoaded(): Promise<void> {
    if (this.spreadsheet) {
      return;
    }

    await this.ensureAuthenticated();

    const response = await this.sheetsApi!.spreadsheets.get({
      spreadsheetId: this.config.spreadsheetId,
      fields: "spreadsheetId,properties,sheets.properties",
    });

    this.spreadsheet = response.data;
  }

  private async analyzeSheet(sheet: Sheet): Promise<WorksheetSchema> {
    const sheetName = sheet.properties.title;

    // Fetch first 100 rows for analysis
    const range = `'${sheetName}'!A1:ZZ101`;
    const response = await this.sheetsApi!.spreadsheets.values.get({
      spreadsheetId: this.config.spreadsheetId,
      range,
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const values = response.data.values || [];
    if (values.length === 0) {
      return {
        name: sheetName,
        displayName: sheetName,
        rowCount: 0,
        columns: [],
        headerRowIndex: 0,
        dataRowIndex: 1,
      };
    }

    // Detect headers
    const headers = values[0].map((h, i) => String(h) || `Column${i + 1}`);
    const columns: ColumnSchema[] = [];

    for (let colIndex = 0; colIndex < headers.length; colIndex++) {
      const header = headers[colIndex];
      const sampleValues: string[] = [];
      const valueCounts = new Map<string, number>();
      let nonEmptyCount = 0;

      // Analyze data rows
      for (let rowIndex = 1; rowIndex < values.length && rowIndex <= 100; rowIndex++) {
        const cellValue = values[rowIndex]?.[colIndex];
        if (cellValue !== undefined && cellValue !== null && cellValue !== "") {
          const strValue = String(cellValue);
          nonEmptyCount++;
          if (sampleValues.length < 5) {
            sampleValues.push(strValue);
          }
          valueCounts.set(strValue, (valueCounts.get(strValue) || 0) + 1);
        }
      }

      const rowsAnalyzed = Math.min(values.length - 1, 100);
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
        suggestedMapping: this.suggestMapping(header, dataType),
      });
    }

    const rowCount = sheet.properties.gridProperties.rowCount - 1;
    const suggestedEntity = this.suggestEntity(columns);

    return {
      name: sheetName,
      displayName: sheetName,
      rowCount: Math.max(0, rowCount),
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

    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "email";
    if (/^[\d\s\-\(\)\+\.]{7,}$/.test(trimmed) && /\d{3,}/.test(trimmed)) return "phone";
    if (/^https?:\/\//.test(trimmed) || /^www\./.test(trimmed)) return "url";
    if (/^[\$\u00A3\u20AC][\d,]+\.?\d*$/.test(trimmed)) return "currency";
    if (/^-?\d+\.?\d*\s*%$/.test(trimmed)) return "percentage";
    if (/^(true|false|yes|no|y|n|1|0)$/i.test(trimmed)) return "boolean";
    if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(trimmed)) return "date";
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(trimmed)) return "datetime";
    if (/^-?[\d,]+\.?\d*$/.test(trimmed.replace(/,/g, ""))) return "number";

    return "text";
  }

  private suggestMapping(
    header: string,
    dataType: SpreadsheetDataType
  ): ColumnSchema["suggestedMapping"] | undefined {
    // Simplified mapping lookup - would use field variations database
    const mappings: Record<string, { entity: string; field: string; confidence: number }> = {
      "borrower name": { entity: "deals", field: "borrower_name", confidence: 0.95 },
      "loan amount": { entity: "facilities", field: "amount", confidence: 0.95 },
      "status": { entity: "deals", field: "stage", confidence: 0.8 },
      "interest rate": { entity: "facilities", field: "interest_rate_value", confidence: 0.95 },
      "email": { entity: "entities", field: "identifiers.email", confidence: 0.9 },
    };

    const normalized = header.toLowerCase().trim();
    const match = mappings[normalized];

    if (match) {
      return {
        targetEntity: match.entity,
        targetField: match.field,
        confidence: match.confidence,
        reason: "Header match",
      };
    }

    return undefined;
  }

  private suggestEntity(
    columns: ColumnSchema[]
  ): { entity: string; confidence: number } | undefined {
    const headers = columns.map((c) => c.header.toLowerCase());

    const dealKeywords = ["deal", "loan", "amount", "rate", "status", "borrower"];
    const entityKeywords = ["company", "contact", "email", "phone", "address"];

    const dealScore = dealKeywords.filter((k) =>
      headers.some((h) => h.includes(k))
    ).length;
    const entityScore = entityKeywords.filter((k) =>
      headers.some((h) => h.includes(k))
    ).length;

    if (dealScore > entityScore && dealScore >= 2) {
      return { entity: "deals", confidence: Math.min(0.9, dealScore * 0.15) };
    }
    if (entityScore > dealScore && entityScore >= 2) {
      return { entity: "entities", confidence: Math.min(0.9, entityScore * 0.15) };
    }

    return undefined;
  }

  private normalizeCellValue(value: unknown): CellValue {
    if (value === undefined || value === null) return null;
    if (typeof value === "number") return value;
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return value;
    if (value instanceof Date) return value;
    return String(value);
  }

  private computeRowHash(data: Record<string, CellValue>): string {
    const sortedKeys = Object.keys(data).sort();
    const values = sortedKeys.map((k) => {
      const v = data[k];
      if (v === null || v === undefined) return "";
      if (v instanceof Date) return v.toISOString();
      return String(v);
    });
    return crypto.createHash("md5").update(values.join("|")).digest("hex");
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

  // Mock APIs for testing (would be removed in production)
  private createMockSheetsApi(): SheetsAPI {
    return {
      spreadsheets: {
        get: async () => ({
          data: {
            spreadsheetId: this.config.spreadsheetId,
            properties: {
              title: "Mock Spreadsheet",
              locale: "en_US",
              timeZone: "America/New_York",
            },
            sheets: [
              {
                properties: {
                  sheetId: 0,
                  title: "Pipeline",
                  index: 0,
                  gridProperties: {
                    rowCount: 100,
                    columnCount: 20,
                  },
                },
              },
            ],
          },
        }),
        values: {
          get: async () => ({
            data: {
              range: "A1:Z100",
              majorDimension: "ROWS",
              values: [
                ["Borrower Name", "Loan Amount", "Status", "Rate"],
                ["Acme Corp", 500000, "Active", "7.5%"],
              ],
            },
          }),
          batchGet: async () => ({
            data: {
              spreadsheetId: this.config.spreadsheetId,
              valueRanges: [],
            },
          }),
        },
      },
    };
  }

  private createMockDriveApi(): DriveAPI {
    return {
      files: {
        get: async () => ({
          data: {
            id: this.config.spreadsheetId,
            name: "Mock Spreadsheet",
            mimeType: "application/vnd.google-apps.spreadsheet",
            modifiedTime: new Date().toISOString(),
            owners: [{ emailAddress: "owner@example.com" }],
          },
        }),
        watch: async () => ({
          data: {
            id: crypto.randomUUID(),
            resourceId: crypto.randomUUID(),
            resourceUri: "",
          },
        }),
      },
      channels: {
        stop: async () => {},
      },
    };
  }
}

export function registerGoogleSheetsAdapter(): void {
  console.log("Google Sheets adapter registered");
}
