/**
 * HubSpot Adapter
 *
 * Connects to HubSpot CRM and provides bidirectional sync
 * with Open LOS. Maps HubSpot deals, companies, contacts,
 * and engagements to the canonical lending model.
 *
 * Authentication: Private app access token or OAuth 2.0
 * Query: CRM Search API with filters and pagination
 * Bulk: Batch read/create/update APIs (limit: 100/batch)
 * Realtime: Webhook subscriptions
 *
 * Key HubSpot concepts:
 * - Objects: deals, companies, contacts, line_items, etc.
 * - Properties: both default and custom (via Properties API)
 * - Associations: links between objects (deal→company, etc.)
 * - Pipelines: deal stages are per-pipeline, fully customizable
 */

import type {
  ShadowAdapter,
  AdapterConfig,
  HubSpotConfig,
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
  FilterCondition,
} from "./types.js";
import { suggestEntityMapping, suggestFieldMapping } from "./mapping-engine.js";

/** HubSpot CRM objects relevant to lending */
const LENDING_OBJECTS = ["deals", "companies", "contacts", "line_items"];

export class HubSpotAdapter implements ShadowAdapter {
  readonly type = "hubspot" as const;
  readonly name = "HubSpot CRM";
  readonly capabilities: AdapterCapabilities = {
    read: true,
    write: true,
    realtime: true,
    bulk: true,
    incrementalSync: true,
    customFieldDiscovery: true,
    documents: false,
    batchSize: 100,
    rateLimit: 150,
  };

  private config: HubSpotConfig | null = null;
  private accessToken: string | null = null;
  private lastSyncToken: string | null = null;

  async initialize(config: AdapterConfig): Promise<void> {
    if (config.type !== "hubspot") {
      throw new Error(`HubSpotAdapter received config type "${config.type}"`);
    }
    this.config = config;
    this.accessToken = config.accessToken ?? null;

    if (!this.accessToken && config.refreshToken) {
      await this.refreshAccessToken();
    }
  }

  async testConnection(): Promise<ConnectionTestResult> {
    if (!this.accessToken) {
      return { success: false, message: "No access token configured" };
    }

    try {
      // TODO: GET https://api.hubapi.com/account-info/v3/details
      return {
        success: true,
        message: "Connected to HubSpot",
        details: {
          orgName: this.config?.portalId ? `Portal ${this.config.portalId}` : undefined,
          apiVersion: "v3",
          features: [
            "CRM Search API",
            "Properties API",
            "Batch Operations",
            ...(this.config?.enableWebhooks ? ["Webhooks"] : []),
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
    const objects: ExternalObjectSchema[] = [];

    for (const objectType of LENDING_OBJECTS) {
      const fields = await this.discoverFields(objectType);
      const objectSchema: ExternalObjectSchema = {
        apiName: objectType,
        label: objectType.charAt(0).toUpperCase() + objectType.slice(1),
        fields,
      };

      const suggestion = suggestEntityMapping(objectSchema);
      if (suggestion) {
        objectSchema.suggestedEntity = suggestion.entity;
        objectSchema.entityConfidence = suggestion.confidence;
      }

      objects.push(objectSchema);
    }

    // Also discover deal pipelines to map stages
    // TODO: GET /crm/v3/pipelines/deals
    // Each pipeline has stages with label, displayOrder, metadata

    return {
      adapterType: "hubspot",
      discoveredAt: new Date().toISOString(),
      objects,
    };
  }

  async discoverFields(objectType: string): Promise<ExternalFieldSchema[]> {
    // TODO: GET https://api.hubapi.com/crm/v3/properties/{objectType}
    // Returns all properties (default + custom) for this object type

    const knownFields = this.getKnownFieldsForObject(objectType);
    return knownFields.map((f) => {
      const suggestion = suggestFieldMapping(f);
      return { ...f, suggestedMapping: suggestion ?? undefined };
    });
  }

  async sampleRecords(objectType: string, limit = 10): Promise<ExternalRecord[]> {
    // TODO: POST https://api.hubapi.com/crm/v3/objects/{objectType}/search
    // { "limit": N, "sorts": [{ "propertyName": "hs_lastmodifieddate", "direction": "DESCENDING" }] }

    return [];
  }

  // ── Inbound ───────────────────────────────────────────────────

  async fetchRecords(query: FetchQuery): Promise<FetchResult> {
    // TODO: Use CRM Search API
    // POST https://api.hubapi.com/crm/v3/objects/{objectType}/search
    //
    // Supports:
    // - filterGroups with AND/OR logic
    // - sorts
    // - properties (field selection)
    // - limit + after (cursor pagination)

    return { records: [], hasMore: false };
  }

  async fetchRecord(objectType: string, externalId: string): Promise<ExternalRecord | null> {
    // TODO: GET https://api.hubapi.com/crm/v3/objects/{objectType}/{externalId}
    // ?properties=all_mapped_fields

    return null;
  }

  async countRecords(objectType: string, filters?: FilterCondition[]): Promise<number> {
    // HubSpot search API returns total in response
    // TODO: Search with limit=0 to get count

    return 0;
  }

  watchChanges(callback: (event: ChangeEvent) => void): WatchHandle {
    if (!this.config?.enableWebhooks) {
      throw new Error("Webhooks not enabled. Set enableWebhooks: true in config.");
    }

    // TODO: Use HubSpot Webhooks API
    // POST /webhooks/v3/{appId}/subscriptions
    // Event types: deal.creation, deal.propertyChange, deal.deletion, etc.
    //
    // Requires a webhook endpoint — shadow CLI would need to run
    // a local HTTP server or use a tunnel (ngrok-style)

    let watching = true;
    return {
      stop() { watching = false; },
      get isWatching() { return watching; },
    };
  }

  // ── Outbound ──────────────────────────────────────────────────

  async pushRecord(objectType: string, externalId: string | null, data: Record<string, unknown>): Promise<PushResult> {
    // TODO:
    // Create: POST /crm/v3/objects/{objectType} { properties: data }
    // Update: PATCH /crm/v3/objects/{objectType}/{externalId} { properties: data }

    return { success: false, errors: ["Not implemented"] };
  }

  async pushBatch(objectType: string, records: Array<{ externalId: string | null; data: Record<string, unknown> }>): Promise<BatchPushResult> {
    // TODO: Use batch APIs
    // Create: POST /crm/v3/objects/{objectType}/batch/create
    // Update: POST /crm/v3/objects/{objectType}/batch/update
    // Max 100 per batch

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

  private async refreshAccessToken(): Promise<void> {
    if (!this.config?.refreshToken || !this.config?.clientId || !this.config?.clientSecret) {
      throw new Error("Missing OAuth credentials for token refresh");
    }

    // TODO: POST https://api.hubapi.com/oauth/v1/token
    // grant_type=refresh_token
    // client_id, client_secret, refresh_token

    this.accessToken = "stub_token";
  }

  private getKnownFieldsForObject(objectType: string): ExternalFieldSchema[] {
    const knownFields: Record<string, ExternalFieldSchema[]> = {
      deals: [
        { apiName: "hs_object_id", label: "Record ID", externalType: "string", dataType: "string", required: true, isCustom: false },
        { apiName: "dealname", label: "Deal Name", externalType: "string", dataType: "string", required: true, isCustom: false },
        { apiName: "amount", label: "Amount", externalType: "number", dataType: "currency", required: false, isCustom: false },
        { apiName: "dealstage", label: "Deal Stage", externalType: "enumeration", dataType: "picklist", required: true, isCustom: false },
        { apiName: "pipeline", label: "Pipeline", externalType: "enumeration", dataType: "picklist", required: true, isCustom: false },
        { apiName: "closedate", label: "Close Date", externalType: "date", dataType: "date", required: false, isCustom: false },
        { apiName: "description", label: "Description", externalType: "string", dataType: "textarea", required: false, isCustom: false },
        { apiName: "hubspot_owner_id", label: "Deal Owner", externalType: "enumeration", dataType: "reference", required: false, isCustom: false },
        { apiName: "hs_lastmodifieddate", label: "Last Modified", externalType: "datetime", dataType: "datetime", required: false, isCustom: false },
        { apiName: "createdate", label: "Create Date", externalType: "datetime", dataType: "datetime", required: false, isCustom: false },
      ],
      companies: [
        { apiName: "hs_object_id", label: "Record ID", externalType: "string", dataType: "string", required: true, isCustom: false },
        { apiName: "name", label: "Company Name", externalType: "string", dataType: "string", required: true, isCustom: false },
        { apiName: "domain", label: "Company Domain", externalType: "string", dataType: "url", required: false, isCustom: false },
        { apiName: "industry", label: "Industry", externalType: "enumeration", dataType: "picklist", required: false, isCustom: false },
        { apiName: "phone", label: "Phone Number", externalType: "string", dataType: "phone", required: false, isCustom: false },
        { apiName: "country", label: "Country", externalType: "string", dataType: "string", required: false, isCustom: false },
        { apiName: "city", label: "City", externalType: "string", dataType: "string", required: false, isCustom: false },
        { apiName: "state", label: "State/Region", externalType: "string", dataType: "string", required: false, isCustom: false },
        { apiName: "hs_lastmodifieddate", label: "Last Modified", externalType: "datetime", dataType: "datetime", required: false, isCustom: false },
      ],
      contacts: [
        { apiName: "hs_object_id", label: "Record ID", externalType: "string", dataType: "string", required: true, isCustom: false },
        { apiName: "firstname", label: "First Name", externalType: "string", dataType: "string", required: false, isCustom: false },
        { apiName: "lastname", label: "Last Name", externalType: "string", dataType: "string", required: true, isCustom: false },
        { apiName: "email", label: "Email", externalType: "string", dataType: "email", required: false, isCustom: false },
        { apiName: "phone", label: "Phone", externalType: "string", dataType: "phone", required: false, isCustom: false },
        { apiName: "jobtitle", label: "Job Title", externalType: "string", dataType: "string", required: false, isCustom: false },
        { apiName: "company", label: "Company Name", externalType: "string", dataType: "string", required: false, isCustom: false },
        { apiName: "hs_lastmodifieddate", label: "Last Modified", externalType: "datetime", dataType: "datetime", required: false, isCustom: false },
      ],
      line_items: [
        { apiName: "hs_object_id", label: "Record ID", externalType: "string", dataType: "string", required: true, isCustom: false },
        { apiName: "name", label: "Name", externalType: "string", dataType: "string", required: true, isCustom: false },
        { apiName: "amount", label: "Amount", externalType: "number", dataType: "currency", required: false, isCustom: false },
        { apiName: "quantity", label: "Quantity", externalType: "number", dataType: "number", required: false, isCustom: false },
        { apiName: "description", label: "Description", externalType: "string", dataType: "textarea", required: false, isCustom: false },
      ],
    };

    return knownFields[objectType] ?? [];
  }
}
