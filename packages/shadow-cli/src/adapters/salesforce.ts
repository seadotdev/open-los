/**
 * Salesforce Adapter
 *
 * Connects to a Salesforce org and provides bidirectional sync
 * with Open LOS. Supports standard and custom objects, bulk
 * operations, and Change Data Capture for real-time sync.
 *
 * Authentication: OAuth 2.0 JWT Bearer Flow (server-to-server)
 * Query: SOQL for flexible record fetching
 * Bulk: Bulk API 2.0 for initial load
 * CDC: Salesforce Change Data Capture events
 *
 * This is a structural implementation — API calls are stubbed
 * with TODO markers for the actual HTTP client integration.
 */

import type {
  ShadowAdapter,
  AdapterConfig,
  SalesforceConfig,
  AdapterCapabilities,
  ConnectionTestResult,
  ExternalSchema,
  ExternalObjectSchema,
  ExternalFieldSchema,
  ExternalRecord,
  FetchQuery,
  FetchResult,
  PushResult,
  BatchPushResult,
  ChangeEvent,
  WatchHandle,
} from "./types.js";
import { suggestEntityMapping, suggestFieldMapping } from "./mapping-engine.js";

// =============================================================================
// Salesforce Object → Open LOS Mapping
// =============================================================================

/** Objects we care about for lending workflows */
const LENDING_OBJECTS = [
  "Opportunity",
  "Account",
  "Contact",
  "OpportunityLineItem",
  "ContentDocument",
  "ContentVersion",
  "Task",
  "Event",
  "Note",
];

// =============================================================================
// Adapter Implementation
// =============================================================================

export class SalesforceAdapter implements ShadowAdapter {
  readonly type = "salesforce" as const;
  readonly name = "Salesforce";
  readonly capabilities: AdapterCapabilities = {
    read: true,
    write: true,
    realtime: true,
    bulk: true,
    incrementalSync: true,
    customFieldDiscovery: true,
    documents: true,
    batchSize: 200,
    rateLimit: 100,
  };

  private config: SalesforceConfig | null = null;
  private accessToken: string | null = null;
  private instanceUrl: string | null = null;
  private lastSyncToken: string | null = null;

  async initialize(config: AdapterConfig): Promise<void> {
    if (config.type !== "salesforce") {
      throw new Error(`SalesforceAdapter received config type "${config.type}"`);
    }
    this.config = config;
    this.instanceUrl = config.instanceUrl;

    // Authenticate
    await this.authenticate();
  }

  async testConnection(): Promise<ConnectionTestResult> {
    if (!this.config || !this.accessToken) {
      return { success: false, message: "Not initialized" };
    }

    try {
      // TODO: GET /services/data/vXX.0/ to verify connection
      // For now, return success if we have a token
      return {
        success: true,
        message: `Connected to ${this.instanceUrl}`,
        details: {
          orgName: this.instanceUrl ?? undefined,
          apiVersion: this.config.apiVersion ?? "59.0",
          authenticatedUser: this.config.username,
          features: [
            "SOQL",
            "Bulk API 2.0",
            ...(this.config.enableCdc ? ["Change Data Capture"] : []),
          ],
        },
      };
    } catch (err) {
      return {
        success: false,
        message: `Connection failed: ${err instanceof Error ? err.message : String(err)}`,
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  }

  async dispose(): Promise<void> {
    this.accessToken = null;
    this.config = null;
  }

  // ── Schema Discovery ──────────────────────────────────────────

  async discoverSchema(): Promise<ExternalSchema> {
    this.requireConfig();
    const objects: ExternalObjectSchema[] = [];

    for (const objectName of LENDING_OBJECTS) {
      try {
        const fields = await this.discoverFields(objectName);
        const objectSchema: ExternalObjectSchema = {
          apiName: objectName,
          label: objectName,
          fields,
        };

        // Suggest entity mapping
        const suggestion = suggestEntityMapping(objectSchema);
        if (suggestion) {
          objectSchema.suggestedEntity = suggestion.entity;
          objectSchema.entityConfidence = suggestion.confidence;
        }

        objects.push(objectSchema);
      } catch {
        // Object might not exist in this org — skip
      }
    }

    // Also discover nCino objects if namespace is configured
    if (this.config?.ncinoNamespace) {
      const ncinoObjects = [
        `${this.config.ncinoNamespace}__Loan__c`,
        `${this.config.ncinoNamespace}__Legal_Entities__c`,
        `${this.config.ncinoNamespace}__Covenant2__c`,
        `${this.config.ncinoNamespace}__Collateral__c`,
        `${this.config.ncinoNamespace}__Product_Package__c`,
      ];

      for (const objectName of ncinoObjects) {
        try {
          const fields = await this.discoverFields(objectName);
          const objectSchema: ExternalObjectSchema = {
            apiName: objectName,
            label: objectName.replace(`${this.config.ncinoNamespace}__`, "").replace("__c", ""),
            fields,
          };

          const suggestion = suggestEntityMapping(objectSchema);
          if (suggestion) {
            objectSchema.suggestedEntity = suggestion.entity;
            objectSchema.entityConfidence = suggestion.confidence;
          }

          objects.push(objectSchema);
        } catch {
          // Object not available
        }
      }
    }

    return {
      adapterType: "salesforce",
      discoveredAt: new Date().toISOString(),
      objects,
    };
  }

  async discoverFields(objectType: string): Promise<ExternalFieldSchema[]> {
    this.requireConfig();

    // TODO: Call Salesforce Describe API
    // GET /services/data/vXX.0/sobjects/{objectType}/describe/
    // Parse the field metadata from the response

    // Stub: return common fields for known objects
    const commonFields = this.getKnownFieldsForObject(objectType);
    return commonFields.map((f) => {
      const suggestion = suggestFieldMapping(f);
      return {
        ...f,
        suggestedMapping: suggestion ?? undefined,
      };
    });
  }

  async sampleRecords(objectType: string, limit = 10): Promise<ExternalRecord[]> {
    this.requireConfig();

    // TODO: SOQL query
    // SELECT Id, ... FROM {objectType} ORDER BY LastModifiedDate DESC LIMIT {limit}

    return [];
  }

  // ── Inbound ───────────────────────────────────────────────────

  async fetchRecords(query: FetchQuery): Promise<FetchResult> {
    this.requireConfig();

    // TODO: Build and execute SOQL query
    // Use Bulk API 2.0 for large datasets (>2000 records)
    // Use standard REST API for smaller queries

    // Example SOQL generation:
    // const soql = this.buildSOQL(query);
    // const response = await this.soqlQuery(soql);

    return {
      records: [],
      hasMore: false,
    };
  }

  async fetchRecord(objectType: string, externalId: string): Promise<ExternalRecord | null> {
    this.requireConfig();

    // TODO: GET /services/data/vXX.0/sobjects/{objectType}/{externalId}

    return null;
  }

  async countRecords(objectType: string): Promise<number> {
    this.requireConfig();

    // TODO: SELECT COUNT() FROM {objectType}

    return 0;
  }

  watchChanges(callback: (event: ChangeEvent) => void): WatchHandle {
    if (!this.config?.enableCdc) {
      throw new Error("CDC not enabled. Set enableCdc: true in config.");
    }

    // TODO: Subscribe to Salesforce CDC channels
    // POST /cometd/XX.0 (CometD/Bayeux protocol)
    // Subscribe to /data/ChangeEvents or /data/{ObjectName}ChangeEvent

    let watching = true;

    return {
      stop() { watching = false; },
      get isWatching() { return watching; },
    };
  }

  // ── Outbound ──────────────────────────────────────────────────

  async pushRecord(objectType: string, externalId: string | null, data: Record<string, unknown>): Promise<PushResult> {
    this.requireConfig();

    // TODO: If externalId is null → POST (create), else PATCH (update)
    // POST   /services/data/vXX.0/sobjects/{objectType}/
    // PATCH  /services/data/vXX.0/sobjects/{objectType}/{externalId}

    return { success: false, errors: ["Not implemented"] };
  }

  async pushBatch(objectType: string, records: Array<{ externalId: string | null; data: Record<string, unknown> }>): Promise<BatchPushResult> {
    this.requireConfig();

    // TODO: Use Composite API or Bulk API 2.0
    // POST /services/data/vXX.0/composite/sobjects

    return {
      results: records.map(() => ({ success: false, errors: ["Not implemented"] })),
      successCount: 0,
      failureCount: records.length,
    };
  }

  // ── Sync State ────────────────────────────────────────────────

  async getLastSyncToken(): Promise<string | null> {
    return this.lastSyncToken;
  }

  async setLastSyncToken(token: string): Promise<void> {
    this.lastSyncToken = token;
  }

  // ── Private ───────────────────────────────────────────────────

  private requireConfig(): asserts this is { config: SalesforceConfig } {
    if (!this.config) throw new Error("Adapter not initialized");
  }

  private async authenticate(): Promise<void> {
    if (!this.config) throw new Error("No config");

    // TODO: Implement OAuth 2.0 JWT Bearer Flow
    // POST https://login.salesforce.com/services/oauth2/token
    // grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer
    // assertion=<signed JWT>
    //
    // For development, also support username/password flow:
    // grant_type=password
    // client_id, client_secret, username, password

    this.accessToken = "stub_token";
  }

  /**
   * Return known field metadata for standard Salesforce objects.
   * In production, this comes from the Describe API.
   */
  private getKnownFieldsForObject(objectType: string): ExternalFieldSchema[] {
    const knownFields: Record<string, ExternalFieldSchema[]> = {
      Opportunity: [
        { apiName: "Id", label: "Record ID", externalType: "id", dataType: "string", required: true, isCustom: false },
        { apiName: "Name", label: "Opportunity Name", externalType: "string", dataType: "string", required: true, isCustom: false },
        { apiName: "Amount", label: "Amount", externalType: "currency", dataType: "currency", required: false, isCustom: false },
        { apiName: "StageName", label: "Stage", externalType: "picklist", dataType: "picklist", required: true, isCustom: false,
          picklistValues: ["Prospecting", "Qualification", "Needs Analysis", "Value Proposition", "Id. Decision Makers", "Perception Analysis", "Proposal/Price Quote", "Negotiation/Review", "Closed Won", "Closed Lost"] },
        { apiName: "CloseDate", label: "Close Date", externalType: "date", dataType: "date", required: true, isCustom: false },
        { apiName: "Description", label: "Description", externalType: "textarea", dataType: "textarea", required: false, isCustom: false },
        { apiName: "AccountId", label: "Account ID", externalType: "reference", dataType: "reference", required: false, isCustom: false, referenceTo: "Account" },
        { apiName: "OwnerId", label: "Owner ID", externalType: "reference", dataType: "reference", required: false, isCustom: false },
        { apiName: "LastModifiedDate", label: "Last Modified Date", externalType: "datetime", dataType: "datetime", required: false, isCustom: false },
        { apiName: "CreatedDate", label: "Created Date", externalType: "datetime", dataType: "datetime", required: false, isCustom: false },
      ],
      Account: [
        { apiName: "Id", label: "Record ID", externalType: "id", dataType: "string", required: true, isCustom: false },
        { apiName: "Name", label: "Account Name", externalType: "string", dataType: "string", required: true, isCustom: false },
        { apiName: "BillingCountry", label: "Billing Country", externalType: "string", dataType: "string", required: false, isCustom: false },
        { apiName: "Industry", label: "Industry", externalType: "picklist", dataType: "picklist", required: false, isCustom: false },
        { apiName: "Phone", label: "Phone", externalType: "phone", dataType: "phone", required: false, isCustom: false },
        { apiName: "Website", label: "Website", externalType: "url", dataType: "url", required: false, isCustom: false },
        { apiName: "Type", label: "Account Type", externalType: "picklist", dataType: "picklist", required: false, isCustom: false },
        { apiName: "LastModifiedDate", label: "Last Modified Date", externalType: "datetime", dataType: "datetime", required: false, isCustom: false },
      ],
      Contact: [
        { apiName: "Id", label: "Record ID", externalType: "id", dataType: "string", required: true, isCustom: false },
        { apiName: "FirstName", label: "First Name", externalType: "string", dataType: "string", required: false, isCustom: false },
        { apiName: "LastName", label: "Last Name", externalType: "string", dataType: "string", required: true, isCustom: false },
        { apiName: "Email", label: "Email", externalType: "email", dataType: "email", required: false, isCustom: false },
        { apiName: "Phone", label: "Phone", externalType: "phone", dataType: "phone", required: false, isCustom: false },
        { apiName: "AccountId", label: "Account ID", externalType: "reference", dataType: "reference", required: false, isCustom: false, referenceTo: "Account" },
        { apiName: "Title", label: "Title", externalType: "string", dataType: "string", required: false, isCustom: false },
        { apiName: "LastModifiedDate", label: "Last Modified Date", externalType: "datetime", dataType: "datetime", required: false, isCustom: false },
      ],
    };

    return knownFields[objectType] ?? [];
  }
}
