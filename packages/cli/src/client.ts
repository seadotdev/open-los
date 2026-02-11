/**
 * API Client for Open LOS
 * Handles all HTTP communication with the API server
 */

export interface ClientConfig {
  baseUrl: string;
  actor: string;
  tenantId: string;
}

export class LosClient {
  private config: ClientConfig;

  constructor(config: Partial<ClientConfig> = {}) {
    this.config = {
      baseUrl: config.baseUrl || process.env.LOS_API_URL || 'http://localhost:3000',
      actor: config.actor || process.env.LOS_ACTOR || 'cli',
      tenantId: config.tenantId || process.env.LOS_TENANT_ID || 'default',
    };
  }

  private async request<T>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      headers?: Record<string, string>;
      query?: Record<string, string | number | undefined>;
    } = {}
  ): Promise<T> {
    let url = `${this.config.baseUrl}${path}`;

    // Add query parameters
    if (options.query) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      }
      const queryString = params.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    const headers: Record<string, string> = {
      'X-Actor': this.config.actor,
      'X-Tenant-Id': this.config.tenantId,
      ...options.headers,
    };

    if (options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method,
      headers,
      body: options.body instanceof FormData
        ? options.body
        : options.body
          ? JSON.stringify(options.body)
          : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      let errorMsg = `Request failed: ${response.status}`;
      try {
        const parsed = JSON.parse(text);
        // API returns { error: { code, message, ... } } or { error: "string" }
        if (typeof parsed.error === 'object' && parsed.error?.message) {
          errorMsg = parsed.error.message;
        } else if (typeof parsed.error === 'string') {
          errorMsg = parsed.error;
        } else if (parsed.message) {
          errorMsg = parsed.message;
        }
      } catch {
        if (text) errorMsg = text;
      }
      throw new Error(errorMsg);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  // Health check
  async health(): Promise<{ status: string; timestamp: string }> {
    return this.request('GET', '/health');
  }

  // === DEALS ===

  async createDeal(data: {
    borrower_name: string;
    jurisdiction?: string;
    requested_amount?: number;
    purpose?: string;
    custom_fields?: Record<string, unknown>;
  }): Promise<{ id: string; [key: string]: unknown }> {
    return this.request('POST', '/v1/deals', { body: data });
  }

  async listDeals(options?: {
    stage?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ deals: unknown[]; next_cursor?: string }> {
    return this.request('GET', '/v1/deals', { query: options });
  }

  async getDeal(dealId: string): Promise<unknown> {
    return this.request('GET', `/v1/deals/${dealId}`);
  }

  async updateDeal(dealId: string, data: Record<string, unknown>): Promise<unknown> {
    return this.request('PATCH', `/v1/deals/${dealId}`, { body: data });
  }

  // === STAGE TRANSITIONS ===

  async advanceStage(
    dealId: string,
    data: {
      to_stage: string;
      rationale?: string;
      override?: boolean;
      override_rationale?: string;
    }
  ): Promise<unknown> {
    return this.request('POST', `/v1/deals/${dealId}/stage-transitions`, { body: data });
  }

  async listStageTransitions(dealId: string): Promise<{ transitions: unknown[] }> {
    return this.request('GET', `/v1/deals/${dealId}/stage-transitions`);
  }

  // === ENTITIES ===

  async createEntity(data: {
    type: 'company' | 'person';
    name: string;
    legal_name?: string;
    registration_number?: string;
    jurisdiction?: string;
  }): Promise<{ id: string; [key: string]: unknown }> {
    return this.request('POST', '/v1/entities', { body: data });
  }

  async listEntities(options?: {
    type?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ entities: unknown[]; next_cursor?: string }> {
    return this.request('GET', '/v1/entities', { query: options });
  }

  async getEntity(entityId: string): Promise<unknown> {
    return this.request('GET', `/v1/entities/${entityId}`);
  }

  async updateEntity(entityId: string, data: Record<string, unknown>): Promise<unknown> {
    return this.request('PATCH', `/v1/entities/${entityId}`, { body: data });
  }

  async deleteEntity(entityId: string): Promise<void> {
    return this.request('DELETE', `/v1/entities/${entityId}`);
  }

  // === RELATIONSHIPS ===

  async createRelationship(data: {
    from_entity_id: string;
    to_entity_id: string;
    type: 'owns' | 'guarantees' | 'directs';
    ownership_pct?: number;
    metadata?: Record<string, unknown>;
  }): Promise<{ id: string; [key: string]: unknown }> {
    return this.request('POST', '/v1/relationships', { body: data });
  }

  async getBorrowerGroup(dealId: string): Promise<unknown> {
    return this.request('GET', `/v1/deals/${dealId}/borrower-group`);
  }

  // === DOCUMENTS ===

  async uploadDocument(
    dealId: string,
    data: {
      doc_type: string;
      filename: string;
      content: string; // base64
      mime_type?: string;
    }
  ): Promise<{ id: string; [key: string]: unknown }> {
    return this.request('POST', `/v1/deals/${dealId}/documents`, { body: data });
  }

  async listDocuments(dealId: string): Promise<{ documents: unknown[] }> {
    return this.request('GET', `/v1/deals/${dealId}/documents`);
  }

  // === COVENANTS ===

  async createCovenant(
    dealId: string,
    data: {
      name: string;
      type: 'financial' | 'reporting' | 'information';
      metric?: string;
      operator?: '>=' | '<=' | '>' | '<' | '==';
      threshold?: number;
      frequency?: 'monthly' | 'quarterly' | 'annually';
      grace_period_days?: number;
    }
  ): Promise<{ id: string; [key: string]: unknown }> {
    return this.request('POST', `/v1/deals/${dealId}/covenants`, { body: data });
  }

  async listCovenants(dealId: string): Promise<{ covenants: unknown[] }> {
    return this.request('GET', `/v1/deals/${dealId}/covenants`);
  }

  async testCovenants(
    dealId: string,
    options?: {
      covenant_ids?: string[];
      as_of?: string;
      as_of_period?: string;
    }
  ): Promise<{ results: unknown[] }> {
    return this.request('POST', `/v1/deals/${dealId}/covenants/test`, { body: options || {} });
  }

  async createWaiver(
    covenantId: string,
    data: {
      reason: string;
      approved_by: string;
      valid_from: string;
      valid_until: string;
    }
  ): Promise<{ id: string; [key: string]: unknown }> {
    return this.request('POST', `/v1/covenants/${covenantId}/waivers`, { body: data });
  }

  // === FACILITIES ===

  async createFacility(
    dealId: string,
    data: {
      type: 'term_loan' | 'revolver' | 'letter_of_credit';
      amount: number;
      currency?: string;
      interest_rate_type?: 'fixed' | 'floating';
      interest_rate_value?: number;
      term_months?: number;
    }
  ): Promise<{ id: string; [key: string]: unknown }> {
    return this.request('POST', `/v1/deals/${dealId}/facilities`, { body: data });
  }

  async listFacilities(dealId: string): Promise<{ facilities: unknown[] }> {
    return this.request('GET', `/v1/deals/${dealId}/facilities`);
  }

  async getFacility(dealId: string, facilityId: string): Promise<unknown> {
    return this.request('GET', `/v1/deals/${dealId}/facilities/${facilityId}`);
  }

  async updateFacility(
    dealId: string,
    facilityId: string,
    data: Record<string, unknown>
  ): Promise<unknown> {
    return this.request('PATCH', `/v1/deals/${dealId}/facilities/${facilityId}`, { body: data });
  }

  async deleteFacility(dealId: string, facilityId: string): Promise<void> {
    return this.request('DELETE', `/v1/deals/${dealId}/facilities/${facilityId}`);
  }

  // === LOANS ===

  async createLoan(data: {
    deal_id: string;
    facility_id?: string;
    loan_amount: number;
    interest_rate?: number;
    term_months?: number;
    account_holder_id?: string;
  }): Promise<{ id: string; [key: string]: unknown }> {
    return this.request('POST', '/v1/loans', { body: data });
  }

  async createLoanFromFacility(
    facilityId: string,
    data?: { loan_amount?: number }
  ): Promise<{ id: string; [key: string]: unknown }> {
    return this.request('POST', `/v1/facilities/${facilityId}/loans`, { body: data || {} });
  }

  async getLoan(loanId: string): Promise<unknown> {
    return this.request('GET', `/v1/loans/${loanId}`);
  }

  async listLoansForDeal(dealId: string): Promise<{ loans: unknown[] }> {
    return this.request('GET', `/v1/deals/${dealId}/loans`);
  }

  async getLoanBalance(loanId: string): Promise<unknown> {
    return this.request('GET', `/v1/loans/${loanId}/balance`);
  }

  async getLoanSchedule(loanId: string): Promise<{ schedule: unknown[] }> {
    return this.request('GET', `/v1/loans/${loanId}/schedule`);
  }

  async getLoanArrears(loanId: string): Promise<unknown> {
    return this.request('GET', `/v1/loans/${loanId}/arrears`);
  }

  async createLoanTransaction(
    loanId: string,
    data: {
      type: string;
      amount?: number;
      value_date?: string;
      notes?: string;
    }
  ): Promise<{ id: string; [key: string]: unknown }> {
    return this.request('POST', `/v1/loans/${loanId}/transactions`, { body: data });
  }

  async listLoanTransactions(loanId: string): Promise<{ transactions: unknown[] }> {
    return this.request('GET', `/v1/loans/${loanId}/transactions`);
  }

  // === SPREAD / UNDERWRITING ===

  async createSpread(
    dealId: string,
    data: {
      entity_id?: string;
      period: string;
      line_items: Array<{ category: string; label: string; amount: number }>;
    }
  ): Promise<{ id: string; ratios: unknown }> {
    return this.request('POST', `/v1/deals/${dealId}/spread`, { body: data });
  }

  async getRatios(dealId: string): Promise<{ ratios: unknown[] }> {
    return this.request('GET', `/v1/deals/${dealId}/ratios`);
  }

  // === MONITORING ===

  async ingestMonitoringData(
    dealId: string,
    data: {
      source_type: string;
      transactions: Array<{
        date: string;
        amount: number;
        description?: string;
        category?: string;
      }>;
    }
  ): Promise<{ ingestion_id: string; records_accepted: number }> {
    return this.request('POST', `/v1/deals/${dealId}/monitoring/ingest`, { body: data });
  }

  async getMonitoringStatus(dealId: string): Promise<unknown> {
    return this.request('GET', `/v1/deals/${dealId}/monitoring/status`);
  }

  // === AUDIT ===

  async listAuditEvents(
    dealId: string,
    options?: {
      type?: string;
      actor?: string;
      limit?: number;
      cursor?: string;
    }
  ): Promise<{ events: unknown[]; next_cursor?: string }> {
    return this.request('GET', `/v1/deals/${dealId}/audit`, { query: options });
  }

  // === TEMPLATES ===

  async listTemplates(options?: {
    phase?: string;
    doc_type?: string;
  }): Promise<{ templates: unknown[] }> {
    return this.request('GET', '/v1/templates', { query: options });
  }

  async renderTemplate(data: {
    template_name: string;
    deal_id: string;
    overrides?: Record<string, unknown>;
  }): Promise<{ content: string }> {
    return this.request('POST', '/v1/templates/render', { body: data });
  }

  async listArtifacts(dealId: string): Promise<{ artifacts: unknown[] }> {
    return this.request('GET', `/v1/deals/${dealId}/artifacts`);
  }

  async createArtifact(
    dealId: string,
    data: {
      template_name: string;
      overrides?: Record<string, unknown>;
    }
  ): Promise<{ id: string; [key: string]: unknown }> {
    return this.request('POST', `/v1/deals/${dealId}/artifacts`, { body: data });
  }

  // === DEPOSITS ===

  async createDeposit(data: Record<string, unknown>): Promise<unknown> {
    return this.request('POST', '/v1/deposits', { body: data });
  }

  async listDeposits(): Promise<unknown[]> {
    return this.request('GET', '/v1/deposits');
  }

  async getDeposit(depositId: string): Promise<unknown> {
    return this.request('GET', `/v1/deposits/${depositId}`);
  }

  // === EMAIL ===

  async ingestEmail(data: {
    raw_rfc822_base64: string;
    deal_id?: string;
  }): Promise<{ communication_id: string; documents: unknown[] }> {
    return this.request('POST', '/v1/email/ingest', { body: data });
  }

  async listCommunications(dealId: string): Promise<{ communications: unknown[] }> {
    return this.request('GET', `/v1/deals/${dealId}/communications`);
  }
}

// Singleton for convenience
let defaultClient: LosClient | null = null;

export function getClient(config?: Partial<ClientConfig>): LosClient {
  if (config) {
    return new LosClient(config);
  }
  if (!defaultClient) {
    defaultClient = new LosClient();
  }
  return defaultClient;
}
