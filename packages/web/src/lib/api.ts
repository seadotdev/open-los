/**
 * API client for the Open LOS web frontend.
 * Communicates with the backend API server.
 */

const API_URL =
  typeof window !== "undefined"
    ? (window as unknown as Record<string, string>).__NEXT_PUBLIC_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:3000"
    : process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export interface DemoProvisionResponse {
  token: string;
  tenant_id: string;
  actor: string;
  api_url: string;
  expires_at: string;
  expires_in_seconds: number;
}

export interface Deal {
  id: string;
  borrower_name: string;
  stage: string;
  requested_amount?: number;
  purpose?: string;
  jurisdiction?: string;
  created_at: string;
  updated_at: string;
}

export interface Entity {
  id: string;
  type: "company" | "person";
  name: string;
  legal_name?: string;
  jurisdiction?: string;
  created_at: string;
}

export interface AuditEvent {
  id: string;
  object_type: string;
  object_id: string;
  action: string;
  actor: string;
  timestamp: string;
  changes?: Record<string, unknown>;
}

export class ApiClient {
  private baseUrl: string;
  private token: string | null;
  private tenantId: string;
  private actor: string;

  constructor(opts?: {
    baseUrl?: string;
    token?: string;
    tenantId?: string;
    actor?: string;
  }) {
    this.baseUrl = opts?.baseUrl || API_URL;
    this.token = opts?.token || null;
    this.tenantId = opts?.tenantId || "default";
    this.actor = opts?.actor || "web-user";
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const headers: Record<string, string> = {
      "X-Actor": this.actor,
      "X-Tenant-Id": this.tenantId,
    };
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    if (body) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      let msg = `API error ${res.status}`;
      try {
        const parsed = JSON.parse(text);
        msg = parsed?.error?.message || msg;
      } catch {}
      throw new Error(msg);
    }

    if (res.status === 204) return undefined as T;
    return res.json();
  }

  setAuth(token: string, tenantId: string, actor: string) {
    this.token = token;
    this.tenantId = tenantId;
    this.actor = actor;
  }

  // Demo provisioning
  async provisionDemo(): Promise<DemoProvisionResponse> {
    return this.request("POST", "/v1/demo/provision");
  }

  async getDemoInfo(): Promise<{
    demo_mode: boolean;
    version: string;
    features: string[];
  }> {
    return this.request("GET", "/v1/demo/info");
  }

  // Deals
  async listDeals(opts?: {
    stage?: string;
    limit?: number;
  }): Promise<{ deals: Deal[] }> {
    const params = new URLSearchParams();
    if (opts?.stage) params.set("stage", opts.stage);
    if (opts?.limit) params.set("limit", String(opts.limit));
    const qs = params.toString();
    return this.request("GET", `/v1/deals${qs ? `?${qs}` : ""}`);
  }

  async getDeal(id: string): Promise<Deal> {
    return this.request("GET", `/v1/deals/${id}`);
  }

  async createDeal(data: {
    borrower_name: string;
    requested_amount?: number;
    purpose?: string;
  }): Promise<Deal> {
    return this.request("POST", "/v1/deals", data);
  }

  // Entities
  async listEntities(): Promise<{ entities: Entity[] }> {
    return this.request("GET", "/v1/entities");
  }

  // Audit
  async listAuditEvents(
    dealId: string,
    opts?: { limit?: number }
  ): Promise<{ events: AuditEvent[] }> {
    const params = new URLSearchParams();
    if (opts?.limit) params.set("limit", String(opts.limit));
    const qs = params.toString();
    return this.request(
      "GET",
      `/v1/deals/${dealId}/audit${qs ? `?${qs}` : ""}`
    );
  }

  // Health
  async health(): Promise<{ status: string; timestamp: string }> {
    return this.request("GET", "/health");
  }
}
