/**
 * SharePoint Adapter
 *
 * Adapter for syncing data from SharePoint document libraries and lists to Open LOS.
 * Supports SharePoint Online via Microsoft Graph API, with document extraction
 * and folder-based deal organization.
 */

import * as crypto from "crypto";
import {
  SpreadsheetAdapter,
  SharePointConnectionConfig,
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
  ExtractDocumentsOptions,
  ExtractedDocument,
} from "./types";

// Microsoft Graph types
interface GraphClient {
  api(path: string): GraphRequest;
}

interface GraphRequest {
  select(fields: string): GraphRequest;
  expand(fields: string): GraphRequest;
  filter(filter: string): GraphRequest;
  orderby(orderby: string): GraphRequest;
  top(count: number): GraphRequest;
  skip(count: number): GraphRequest;
  get(): Promise<GraphResponse>;
  post(body: unknown): Promise<GraphResponse>;
}

interface GraphResponse {
  value?: unknown[];
  "@odata.nextLink"?: string;
  [key: string]: unknown;
}

interface SharePointSite {
  id: string;
  name: string;
  displayName: string;
  webUrl: string;
}

interface SharePointList {
  id: string;
  name: string;
  displayName: string;
  list: {
    template: string;
  };
  columns?: SharePointColumn[];
}

interface SharePointColumn {
  id: string;
  name: string;
  displayName: string;
  columnGroup?: string;
  description?: string;
  indexed?: boolean;
  readOnly?: boolean;
  required?: boolean;
  text?: { maxLength?: number };
  number?: { decimalPlaces?: string; displayAs?: string };
  dateTime?: { displayAs?: string; format?: string };
  boolean?: {};
  choice?: { choices?: string[]; displayAs?: string };
  currency?: { locale?: string };
  personOrGroup?: { allowMultipleSelection?: boolean };
  lookup?: { columnName?: string; listId?: string };
}

interface SharePointListItem {
  id: string;
  fields: Record<string, unknown>;
  createdDateTime: string;
  lastModifiedDateTime: string;
  createdBy?: { user?: { displayName?: string; email?: string } };
  lastModifiedBy?: { user?: { displayName?: string; email?: string } };
}

interface DriveItem {
  id: string;
  name: string;
  size: number;
  file?: { mimeType: string };
  folder?: { childCount: number };
  parentReference?: { path?: string };
  createdDateTime: string;
  lastModifiedDateTime: string;
  createdBy?: { user?: { displayName?: string; email?: string } };
  lastModifiedBy?: { user?: { displayName?: string; email?: string } };
  "@microsoft.graph.downloadUrl"?: string;
  webUrl?: string;
}

/**
 * SharePoint adapter for spreadsheet sync
 */
export class SharePointAdapter implements SpreadsheetAdapter {
  readonly type = "sharepoint" as const;
  readonly name = "SharePoint";
  readonly features = {
    watchChanges: true,
    realtime: false,
    documents: true,
    incrementalSync: true,
  };

  private config!: SharePointConnectionConfig;
  private graphClient: GraphClient | null = null;
  private siteId: string | null = null;
  private lists: Map<string, SharePointList> = new Map();
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private deltaLinks: Map<string, string> = new Map();

  async initialize(config: SpreadsheetConnectionConfig): Promise<void> {
    if (config.type !== "sharepoint") {
      throw new Error("Invalid config type for SharePoint adapter");
    }
    this.config = config;
    await this.initializeGraphClient();
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      await this.ensureAuthenticated();

      // Get site info
      const site = await this.getSite();
      this.siteId = site.id;

      // Get library/list info
      const list = await this.getList(this.config.libraryName);

      // Count items
      const countResponse = await this.graphClient!
        .api(`/sites/${this.siteId}/lists/${list.id}/items`)
        .select("id")
        .top(1)
        .get();

      return {
        success: true,
        message: `Successfully connected to "${list.displayName}" in "${site.displayName}"`,
        details: {
          sourceName: `${site.displayName} / ${list.displayName}`,
          worksheetCount: 1, // Lists are like worksheets
        },
      };
    } catch (error) {
      const err = error as any;

      if (err.statusCode === 401 || err.code === "InvalidAuthenticationToken") {
        return {
          success: false,
          message: "Authentication failed. Please check your credentials.",
          error: err,
        };
      }
      if (err.statusCode === 403) {
        return {
          success: false,
          message: "Access denied. Please check your permissions.",
          error: err,
        };
      }
      if (err.statusCode === 404) {
        return {
          success: false,
          message: "Site or list not found. Please check the configuration.",
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
    await this.ensureAuthenticated();
    await this.ensureSiteLoaded();

    const worksheets: WorksheetSchema[] = [];

    // Get the configured list/library
    const list = await this.getList(this.config.libraryName);
    const worksheetSchema = await this.analyzeList(list);
    worksheets.push(worksheetSchema);

    // If syncing documents, treat folder structure as additional "worksheets"
    if (this.config.syncDocuments) {
      const folderSchema = await this.analyzeFolderStructure();
      if (folderSchema) {
        worksheets.push(folderSchema);
      }
    }

    return {
      sourceType: "sharepoint",
      version: "graph-v1.0",
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
    await this.ensureAuthenticated();
    await this.ensureSiteLoaded();

    const list = await this.getList(worksheet);
    const limit = options?.limit ?? 100;

    // Build request
    let request = this.graphClient!
      .api(`/sites/${this.siteId}/lists/${list.id}/items`)
      .expand("fields")
      .select("id,fields,createdDateTime,lastModifiedDateTime,createdBy,lastModifiedBy")
      .top(limit);

    // Handle incremental sync
    if (options?.modifiedSince) {
      const isoDate = options.modifiedSince.toISOString();
      request = request.filter(`lastModifiedDateTime ge ${isoDate}`);
    }

    // Handle pagination
    if (options?.cursor) {
      // SharePoint uses @odata.nextLink for pagination
      // The cursor would be a skip token or the full nextLink
      request = request.skip(parseInt(options.cursor, 10));
    }

    const response = await request.get();
    const items = (response.value || []) as SharePointListItem[];

    // Get column info for header names
    const columns = await this.getListColumns(list.id);
    const columnMap = new Map(columns.map((c) => [c.name, c.displayName]));

    const rows: SpreadsheetRow[] = items.map((item, index) => {
      const rowData: Record<string, CellValue> = {};

      // Map field names to display names
      for (const [fieldName, value] of Object.entries(item.fields)) {
        // Skip internal fields
        if (fieldName.startsWith("@") || fieldName.startsWith("_")) continue;

        const displayName = columnMap.get(fieldName) || fieldName;
        rowData[displayName] = this.normalizeFieldValue(value);
      }

      // Add metadata fields
      rowData["_CreatedDate"] = new Date(item.createdDateTime);
      rowData["_ModifiedDate"] = new Date(item.lastModifiedDateTime);
      rowData["_CreatedBy"] = item.createdBy?.user?.displayName || null;
      rowData["_ModifiedBy"] = item.lastModifiedBy?.user?.displayName || null;

      return {
        rowIndex: index,
        rowNumber: parseInt(item.id, 10),
        data: rowData,
        hash: this.computeRowHash(rowData),
        modifiedAt: new Date(item.lastModifiedDateTime),
      };
    });

    // Calculate pagination
    const hasMore = !!response["@odata.nextLink"];
    const nextOffset = options?.cursor
      ? parseInt(options.cursor, 10) + rows.length
      : rows.length;

    return {
      rows,
      cursor: hasMore ? nextOffset.toString() : undefined,
      hasMore,
    };
  }

  async getRow(worksheet: string, rowId: string): Promise<SpreadsheetRow | null> {
    await this.ensureAuthenticated();
    await this.ensureSiteLoaded();

    const list = await this.getList(worksheet);

    try {
      const response = await this.graphClient!
        .api(`/sites/${this.siteId}/lists/${list.id}/items/${rowId}`)
        .expand("fields")
        .select("id,fields,createdDateTime,lastModifiedDateTime")
        .get();

      const item = response as unknown as SharePointListItem;
      const columns = await this.getListColumns(list.id);
      const columnMap = new Map(columns.map((c) => [c.name, c.displayName]));

      const rowData: Record<string, CellValue> = {};
      for (const [fieldName, value] of Object.entries(item.fields)) {
        if (fieldName.startsWith("@") || fieldName.startsWith("_")) continue;
        const displayName = columnMap.get(fieldName) || fieldName;
        rowData[displayName] = this.normalizeFieldValue(value);
      }

      return {
        rowIndex: parseInt(item.id, 10) - 1,
        rowNumber: parseInt(item.id, 10),
        data: rowData,
        hash: this.computeRowHash(rowData),
        modifiedAt: new Date(item.lastModifiedDateTime),
      };
    } catch (error) {
      const err = error as any;
      if (err.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async getRowCount(worksheet: string): Promise<number> {
    await this.ensureAuthenticated();
    await this.ensureSiteLoaded();

    const list = await this.getList(worksheet);

    // SharePoint doesn't provide a direct count, so we estimate
    // by fetching with a high limit and counting
    let count = 0;
    let nextLink: string | null = null;

    do {
      const request: GraphRequest = nextLink
        ? this.graphClient!.api(nextLink)
        : this.graphClient!
            .api(`/sites/${this.siteId}/lists/${list.id}/items`)
            .select("id")
            .top(5000);

      const response: GraphResponse = await request.get();
      count += (response.value || []).length;
      nextLink = response["@odata.nextLink"] || null;
    } while (nextLink);

    return count;
  }

  startWatching(callback: (event: ChangeEvent) => void): WatchHandle {
    let isWatching = true;
    const pollInterval = 60000; // 1 minute

    const poll = async () => {
      if (!isWatching) return;

      try {
        await this.ensureAuthenticated();
        await this.ensureSiteLoaded();

        const list = await this.getList(this.config.libraryName);

        // Use delta query for efficient change detection
        let deltaRequest = this.deltaLinks.has(list.id)
          ? this.graphClient!.api(this.deltaLinks.get(list.id)!)
          : this.graphClient!
              .api(`/sites/${this.siteId}/lists/${list.id}/items/delta`)
              .select("id,lastModifiedDateTime");

        const response = await deltaRequest.get();
        const items = (response.value || []) as SharePointListItem[];

        // Update delta link for next call
        if (response["@odata.deltaLink"]) {
          this.deltaLinks.set(list.id, response["@odata.deltaLink"] as string);
        }

        // Emit events for changed items
        for (const item of items) {
          const isDeleted = (item as any)["@removed"];

          callback({
            type: isDeleted ? "row_deleted" : "row_updated",
            worksheet: this.config.libraryName,
            rowId: item.id,
            timestamp: new Date(item.lastModifiedDateTime || Date.now()),
          });
        }
      } catch (error) {
        console.error("Error polling SharePoint:", error);
      }

      if (isWatching) {
        setTimeout(poll, pollInterval);
      }
    };

    // Start polling
    poll();

    return {
      stop: () => {
        isWatching = false;
      },
      get isWatching() {
        return isWatching;
      },
    };
  }

  async extractDocuments(
    options?: ExtractDocumentsOptions
  ): Promise<ExtractedDocument[]> {
    await this.ensureAuthenticated();
    await this.ensureSiteLoaded();

    const documents: ExtractedDocument[] = [];
    const folderPath = options?.folderPath || this.config.folderPath || "";
    const limit = options?.limit ?? 1000;

    // Get drive for the document library
    const driveResponse = await this.graphClient!
      .api(`/sites/${this.siteId}/drives`)
      .select("id,name")
      .get();

    const drives = (driveResponse.value || []) as { id: string; name: string }[];
    const drive = drives.find((d) => d.name === this.config.libraryName);

    if (!drive) {
      throw new Error(`Drive not found for library: ${this.config.libraryName}`);
    }

    // Build path for API call
    const apiPath = folderPath
      ? `/drives/${drive.id}/root:/${folderPath}:/children`
      : `/drives/${drive.id}/root/children`;

    // Fetch items recursively
    const fetchItems = async (path: string, currentPath: string): Promise<void> => {
      if (documents.length >= limit) return;

      const response = await this.graphClient!
        .api(path)
        .select("id,name,size,file,folder,parentReference,createdDateTime,lastModifiedDateTime,createdBy,lastModifiedBy,@microsoft.graph.downloadUrl,webUrl")
        .get();

      const items = (response.value || []) as DriveItem[];

      for (const item of items) {
        if (documents.length >= limit) break;

        if (item.file) {
          // It's a file
          const ext = item.name.split(".").pop()?.toLowerCase();

          // Filter by extension if specified
          if (
            options?.includeExtensions &&
            !options.includeExtensions.includes(`.${ext}`)
          ) {
            continue;
          }

          // Filter by modified date if specified
          if (options?.modifiedSince) {
            const modifiedDate = new Date(item.lastModifiedDateTime);
            if (modifiedDate < options.modifiedSince) {
              continue;
            }
          }

          documents.push({
            sourceId: item.id,
            filename: item.name,
            sourcePath: `${currentPath}/${item.name}`,
            mimeType: item.file.mimeType,
            sizeBytes: item.size,
            downloadUrl: item["@microsoft.graph.downloadUrl"] || item.webUrl,
            createdAt: new Date(item.createdDateTime),
            modifiedAt: new Date(item.lastModifiedDateTime),
            createdBy: item.createdBy?.user?.displayName,
            modifiedBy: item.lastModifiedBy?.user?.displayName,
            dealIdentifier: this.inferDealIdentifier(currentPath, item.name),
            suggestedDocType: this.inferDocType(item.name, ext),
          });
        } else if (item.folder) {
          // Recurse into folder
          const childPath = `/drives/${drive.id}/items/${item.id}/children`;
          await fetchItems(childPath, `${currentPath}/${item.name}`);
        }
      }

      // Handle pagination
      if (response["@odata.nextLink"] && documents.length < limit) {
        await fetchItems(response["@odata.nextLink"], currentPath);
      }
    };

    await fetchItems(apiPath, folderPath || "");

    return documents;
  }

  async dispose(): Promise<void> {
    this.graphClient = null;
    this.lists.clear();
    this.deltaLinks.clear();
    this.accessToken = null;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private async initializeGraphClient(): Promise<void> {
    await this.ensureAuthenticated();

    // In production, this would use @microsoft/microsoft-graph-client:
    // const { Client } = require('@microsoft/microsoft-graph-client');
    // this.graphClient = Client.initWithMiddleware({
    //   authProvider: { getAccessToken: () => this.accessToken },
    // });

    this.graphClient = this.createMockGraphClient();
  }

  private async ensureAuthenticated(): Promise<void> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return;
    }

    // Acquire token using client credentials flow
    // In production:
    // const { ConfidentialClientApplication } = require('@azure/msal-node');
    // const cca = new ConfidentialClientApplication({
    //   auth: {
    //     clientId: this.config.clientId,
    //     authority: `https://login.microsoftonline.com/${this.config.tenantId}`,
    //     clientSecret: this.config.clientSecret,
    //   },
    // });
    // const result = await cca.acquireTokenByClientCredential({
    //   scopes: ['https://graph.microsoft.com/.default'],
    // });
    // this.accessToken = result.accessToken;
    // this.tokenExpiry = result.expiresOn;

    this.accessToken = "mock_sharepoint_token";
    this.tokenExpiry = new Date(Date.now() + 3600000);
  }

  private async ensureSiteLoaded(): Promise<void> {
    if (this.siteId) return;

    const site = await this.getSite();
    this.siteId = site.id;
  }

  private async getSite(): Promise<SharePointSite> {
    // Parse site URL to get site path
    const url = new URL(this.config.siteUrl);
    const sitePath = url.pathname.replace(/^\/sites\//, "");

    const response = await this.graphClient!
      .api(`/sites/${url.hostname}:/sites/${sitePath}`)
      .select("id,name,displayName,webUrl")
      .get();

    return response as unknown as SharePointSite;
  }

  private async getList(nameOrId: string): Promise<SharePointList> {
    if (this.lists.has(nameOrId)) {
      return this.lists.get(nameOrId)!;
    }

    const response = await this.graphClient!
      .api(`/sites/${this.siteId}/lists/${nameOrId}`)
      .select("id,name,displayName,list")
      .get();

    const list = response as unknown as SharePointList;
    this.lists.set(nameOrId, list);
    this.lists.set(list.id, list);

    return list;
  }

  private async getListColumns(listId: string): Promise<SharePointColumn[]> {
    const list = this.lists.get(listId);
    if (list?.columns) {
      return list.columns;
    }

    const response = await this.graphClient!
      .api(`/sites/${this.siteId}/lists/${listId}/columns`)
      .select("id,name,displayName,text,number,dateTime,boolean,choice,currency,personOrGroup,lookup,indexed,required,readOnly")
      .get();

    const columns = (response.value || []) as SharePointColumn[];

    // Cache columns
    if (list) {
      list.columns = columns;
    }

    return columns;
  }

  private async analyzeList(list: SharePointList): Promise<WorksheetSchema> {
    const columns = await this.getListColumns(list.id);

    // Filter out internal columns
    const userColumns = columns.filter((c) => {
      if (c.readOnly) return false;
      if (c.name.startsWith("_")) return false;
      if (["ContentType", "Attachments", "Edit", "LinkTitleNoMenu", "LinkTitle"].includes(c.name)) {
        return false;
      }
      return true;
    });

    // Fetch sample data
    const sampleResponse = await this.graphClient!
      .api(`/sites/${this.siteId}/lists/${list.id}/items`)
      .expand("fields")
      .top(100)
      .get();

    const items = (sampleResponse.value || []) as SharePointListItem[];

    const columnSchemas: ColumnSchema[] = userColumns.map((col, index) => {
      const sampleValues: string[] = [];
      const valueCounts = new Map<string, number>();
      let nonEmptyCount = 0;

      for (const item of items) {
        const value = item.fields[col.name];
        if (value !== undefined && value !== null && value !== "") {
          const strValue = String(value);
          nonEmptyCount++;
          if (sampleValues.length < 5) {
            sampleValues.push(strValue);
          }
          valueCounts.set(strValue, (valueCounts.get(strValue) || 0) + 1);
        }
      }

      const fillRate = items.length > 0 ? nonEmptyCount / items.length : 0;
      const dataType = this.inferColumnType(col);
      const isPrimaryKeyCandidate =
        col.indexed === true ||
        col.name.toLowerCase() === "id" ||
        (valueCounts.size === nonEmptyCount && nonEmptyCount > 0 && fillRate > 0.9);

      return {
        index,
        letter: this.columnIndexToLetter(index),
        header: col.displayName,
        dataType,
        sampleValues,
        isPrimaryKeyCandidate,
        fillRate,
        uniqueValueCount: valueCounts.size <= 100 ? valueCounts.size : undefined,
        suggestedMapping: this.suggestMapping(col.displayName, dataType),
      };
    });

    const suggestedEntity = this.suggestEntity(columnSchemas);

    return {
      name: list.name,
      displayName: list.displayName,
      rowCount: items.length, // Would need separate count query for accuracy
      columns: columnSchemas,
      headerRowIndex: 0,
      dataRowIndex: 1,
      suggestedEntity: suggestedEntity?.entity,
      entityConfidence: suggestedEntity?.confidence,
    };
  }

  private async analyzeFolderStructure(): Promise<WorksheetSchema | null> {
    // Analyze folder structure as a "virtual" worksheet for documents
    const documents = await this.extractDocuments({ limit: 100 });

    if (documents.length === 0) {
      return null;
    }

    // Create a schema based on document metadata
    const columns: ColumnSchema[] = [
      {
        index: 0,
        letter: "A",
        header: "Filename",
        dataType: "text",
        sampleValues: documents.slice(0, 5).map((d) => d.filename),
        isPrimaryKeyCandidate: false,
        fillRate: 1,
      },
      {
        index: 1,
        letter: "B",
        header: "Path",
        dataType: "text",
        sampleValues: documents.slice(0, 5).map((d) => d.sourcePath),
        isPrimaryKeyCandidate: false,
        fillRate: 1,
      },
      {
        index: 2,
        letter: "C",
        header: "Deal ID",
        dataType: "text",
        sampleValues: documents.slice(0, 5).map((d) => d.dealIdentifier || ""),
        isPrimaryKeyCandidate: false,
        fillRate: documents.filter((d) => d.dealIdentifier).length / documents.length,
        suggestedMapping: {
          targetEntity: "documents",
          targetField: "deal_id",
          confidence: 0.7,
          reason: "Folder structure pattern",
        },
      },
      {
        index: 3,
        letter: "D",
        header: "Document Type",
        dataType: "text",
        sampleValues: documents.slice(0, 5).map((d) => d.suggestedDocType || ""),
        isPrimaryKeyCandidate: false,
        fillRate: documents.filter((d) => d.suggestedDocType).length / documents.length,
        suggestedMapping: {
          targetEntity: "documents",
          targetField: "doc_type",
          confidence: 0.7,
          reason: "Filename pattern",
        },
      },
    ];

    return {
      name: "Documents",
      displayName: "Documents (from folders)",
      rowCount: documents.length,
      columns,
      headerRowIndex: 0,
      dataRowIndex: 1,
      suggestedEntity: "documents",
      entityConfidence: 0.9,
    };
  }

  private inferColumnType(column: SharePointColumn): SpreadsheetDataType {
    if (column.text) return "text";
    if (column.number) {
      if (column.number.displayAs === "percentage") return "percentage";
      return "number";
    }
    if (column.dateTime) {
      if (column.dateTime.displayAs === "dateOnly") return "date";
      return "datetime";
    }
    if (column.boolean) return "boolean";
    if (column.currency) return "currency";
    if (column.choice) return "text";
    if (column.personOrGroup) return "text";
    if (column.lookup) return "text";
    return "text";
  }

  private normalizeFieldValue(value: unknown): CellValue {
    if (value === undefined || value === null) return null;

    // Handle lookup values
    if (typeof value === "object" && "LookupValue" in (value as any)) {
      return (value as any).LookupValue;
    }

    // Handle person values
    if (typeof value === "object" && "Email" in (value as any)) {
      return (value as any).Email;
    }

    // Handle arrays (multi-select)
    if (Array.isArray(value)) {
      return value.join(", ");
    }

    if (typeof value === "string") return value;
    if (typeof value === "number") return value;
    if (typeof value === "boolean") return value;

    return String(value);
  }

  private suggestMapping(
    header: string,
    dataType: SpreadsheetDataType
  ): ColumnSchema["suggestedMapping"] | undefined {
    const mappings: Record<string, { entity: string; field: string; confidence: number }> = {
      "title": { entity: "deals", field: "borrower_name", confidence: 0.7 },
      "borrower": { entity: "deals", field: "borrower_name", confidence: 0.9 },
      "loan amount": { entity: "facilities", field: "amount", confidence: 0.95 },
      "amount": { entity: "facilities", field: "amount", confidence: 0.8 },
      "status": { entity: "deals", field: "stage", confidence: 0.8 },
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

    const dealKeywords = ["deal", "loan", "amount", "status", "borrower"];
    const dealScore = dealKeywords.filter((k) =>
      headers.some((h) => h.includes(k))
    ).length;

    if (dealScore >= 2) {
      return { entity: "deals", confidence: Math.min(0.9, dealScore * 0.18) };
    }

    return undefined;
  }

  private inferDealIdentifier(path: string, filename: string): string | undefined {
    // Common patterns for deal folders:
    // /Deals/ABC-001-CompanyName/
    // /2026/Q1/Deal123/
    // /Loans/LN-2026-0001/

    const parts = path.split("/").filter(Boolean);

    // Look for pattern like "ABC-001" or "LN-2026-0001"
    for (const part of parts) {
      if (/^[A-Z]{2,4}-\d{3,}/.test(part) || /^\d{4}-\d{4,}/.test(part)) {
        return part;
      }
    }

    // Try to extract from filename
    const filenameMatch = filename.match(/^([A-Z]{2,4}-\d{3,})/);
    if (filenameMatch) {
      return filenameMatch[1];
    }

    return undefined;
  }

  private inferDocType(
    filename: string,
    extension?: string
  ): string | undefined {
    const lowerName = filename.toLowerCase();

    // Common document type patterns
    const patterns: [RegExp, string][] = [
      [/tax\s*return|1040|1120|990/i, "tax_returns"],
      [/financial\s*statement|balance\s*sheet|income\s*statement|p&l/i, "financial_statements"],
      [/bank\s*statement/i, "bank_statements"],
      [/appraisal/i, "appraisal"],
      [/title|deed/i, "title"],
      [/insurance|policy/i, "insurance"],
      [/rent\s*roll/i, "rent_roll"],
      [/lease/i, "lease"],
      [/operating\s*agreement|articles|bylaws/i, "entity_docs"],
      [/guarantee|guaranty/i, "guarantee"],
      [/note|promissory/i, "promissory_note"],
      [/credit\s*report/i, "credit_report"],
      [/application|app\s*form/i, "application"],
    ];

    for (const [pattern, docType] of patterns) {
      if (pattern.test(lowerName)) {
        return docType;
      }
    }

    return undefined;
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

  // Mock Graph client for testing (would be removed in production)
  private createMockGraphClient(): GraphClient {
    const mockRequest = (path: string): GraphRequest => ({
      select: () => mockRequest(path),
      expand: () => mockRequest(path),
      filter: () => mockRequest(path),
      orderby: () => mockRequest(path),
      top: () => mockRequest(path),
      skip: () => mockRequest(path),
      get: async () => ({
        value: [],
      }),
      post: async () => ({}),
    });

    return {
      api: (path: string) => mockRequest(path),
    };
  }
}

export function registerSharePointAdapter(): void {
  console.log("SharePoint adapter registered");
}
