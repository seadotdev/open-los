import type { ServiceContext } from "./context.js";

/**
 * Creates a service context that proxies all calls through the REST API.
 * This allows the MCP server to operate against a remote Open LOS instance
 * without requiring direct database access.
 *
 * Usage:
 *   const ctx = await createRemoteContext({
 *     apiUrl: "https://demo.open-los.dev",
 *     token: "demo_xxx",
 *     actor: "mcp-agent",
 *     tenantId: "default",
 *   });
 */

interface RemoteOpts {
  apiUrl: string;
  token?: string;
  actor?: string;
  tenantId?: string;
}

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

function createHttpClient(opts: RemoteOpts) {
  const baseUrl = opts.apiUrl.replace(/\/+$/, "");
  const actor = opts.actor ?? "mcp-agent";
  const tenantId = opts.tenantId ?? "default";

  async function request(
    method: HttpMethod,
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<unknown> {
    const url = `${baseUrl}/v1${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Actor": actor,
      "X-Tenant-Id": tenantId,
      ...extraHeaders,
    };
    if (opts.token) {
      headers["Authorization"] = `Bearer ${opts.token}`;
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const errBody = await res.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(errBody);
      } catch {
        parsed = errBody;
      }
      const msg =
        typeof parsed === "object" && parsed !== null && "error" in parsed
          ? JSON.stringify((parsed as Record<string, unknown>).error)
          : String(parsed);
      throw new Error(
        `Remote API error (${res.status} ${method} ${path}): ${msg}`,
      );
    }

    const text = await res.text();
    if (!text) return undefined;
    return JSON.parse(text);
  }

  return { request, actor, tenantId };
}

function notAvailable(service: string, method: string): never {
  throw new Error(
    `${service}.${method}() is not available in remote mode. ` +
      `Only methods used by MCP tools are proxied through the REST API.`,
  );
}

/**
 * Creates a proxy-based ServiceContext that forwards service calls to the
 * Open LOS REST API instead of talking to the database directly.
 *
 * Only methods that are actually used by the MCP tool handlers are proxied.
 * Calling any other method throws a descriptive error.
 */
export async function createRemoteContext(
  opts: RemoteOpts,
): Promise<ServiceContext> {
  const http = createHttpClient(opts);

  // Helper to build a proxy that throws on unimplemented methods
  function serviceProxy<T extends object>(
    serviceName: string,
    implementations: Record<string, (...args: unknown[]) => unknown>,
  ): T {
    return new Proxy({} as T, {
      get(_target, prop: string) {
        if (prop in implementations) {
          return implementations[prop];
        }
        return () => notAvailable(serviceName, prop);
      },
    });
  }

  // ── dealService ──────────────────────────────────────────────────────
  const dealService = serviceProxy<ServiceContext["dealService"]>(
    "dealService",
    {
      create: async (body: unknown, actor: string, tenantId: string) =>
        http.request("POST", "/deals", body, {
          "X-Actor": actor,
          "X-Tenant-Id": tenantId,
        }),
      getById: async (id: string, tenantId?: string) =>
        http.request("GET", `/deals/${id}`, undefined, {
          "X-Tenant-Id": tenantId ?? http.tenantId,
        }),
      update: async (
        id: string,
        body: unknown,
        actor: string,
        tenantId: string,
      ) =>
        http.request("PATCH", `/deals/${id}`, body, {
          "X-Actor": actor,
          "X-Tenant-Id": tenantId,
        }),
      list: async (tenantId: string, filters?: unknown) => {
        const f = (filters ?? {}) as Record<string, unknown>;
        const params = new URLSearchParams();
        if (f.stage) params.set("stage", String(f.stage));
        if (f.limit) params.set("limit", String(f.limit));
        if (f.cursor) params.set("cursor", String(f.cursor));
        const qs = params.toString();
        return http.request(
          "GET",
          `/deals${qs ? `?${qs}` : ""}`,
          undefined,
          { "X-Tenant-Id": tenantId },
        );
      },
    },
  );

  // ── entityService ────────────────────────────────────────────────────
  const entityService = serviceProxy<ServiceContext["entityService"]>(
    "entityService",
    {
      create: async (
        body: unknown,
        actor: string,
        _dealId?: string,
        tenantId?: string,
      ) =>
        http.request("POST", "/entities", body, {
          "X-Actor": actor,
          "X-Tenant-Id": tenantId ?? http.tenantId,
        }),
      getById: async (id: string, tenantId?: string) =>
        http.request("GET", `/entities/${id}`, undefined, {
          "X-Tenant-Id": tenantId ?? http.tenantId,
        }),
      list: async (tenantId: string, filters?: unknown) => {
        const f = (filters ?? {}) as Record<string, unknown>;
        const params = new URLSearchParams();
        if (f.type) params.set("type", String(f.type));
        if (f.limit) params.set("limit", String(f.limit));
        if (f.cursor) params.set("cursor", String(f.cursor));
        const qs = params.toString();
        return http.request(
          "GET",
          `/entities${qs ? `?${qs}` : ""}`,
          undefined,
          { "X-Tenant-Id": tenantId },
        );
      },
      update: async (
        id: string,
        body: unknown,
        actor: string,
        _dealId?: string,
        tenantId?: string,
      ) =>
        http.request("PATCH", `/entities/${id}`, body, {
          "X-Actor": actor,
          "X-Tenant-Id": tenantId ?? http.tenantId,
        }),
      delete: async (id: string, tenantId?: string) =>
        http.request("DELETE", `/entities/${id}`, undefined, {
          "X-Tenant-Id": tenantId ?? http.tenantId,
        }),
      findDealIdByEntity: async (_id: string) => {
        // The REST API handles this internally during entity update;
        // in remote mode we return null and let the API server handle the lookup.
        return null;
      },
    },
  );

  // ── documentService ──────────────────────────────────────────────────
  const documentService = serviceProxy<ServiceContext["documentService"]>(
    "documentService",
    {
      upload: async (
        dealId: string,
        body: unknown,
        actor: string,
        tenantId?: string,
      ) =>
        http.request("POST", `/deals/${dealId}/documents`, body, {
          "X-Actor": actor,
          "X-Tenant-Id": tenantId ?? http.tenantId,
        }),
      listByDeal: async (dealId: string, tenantId?: string) =>
        http.request("GET", `/deals/${dealId}/documents`, undefined, {
          "X-Tenant-Id": tenantId ?? http.tenantId,
        }).then((res: unknown) => {
          // The REST API wraps in { documents: [...] }
          if (
            res &&
            typeof res === "object" &&
            "documents" in res
          ) {
            return (res as { documents: unknown[] }).documents;
          }
          return res;
        }),
    },
  );

  // ── spreadService ────────────────────────────────────────────────────
  const spreadService = serviceProxy<ServiceContext["spreadService"]>(
    "spreadService",
    {
      create: async (dealId: string, body: unknown, actor: string) =>
        http.request("POST", `/deals/${dealId}/spread`, body, {
          "X-Actor": actor,
        }),
      getRatios: async (dealId: string) =>
        http.request("GET", `/deals/${dealId}/ratios`),
    },
  );

  // ── stageService ─────────────────────────────────────────────────────
  const stageService = serviceProxy<ServiceContext["stageService"]>(
    "stageService",
    {
      transition: async (
        dealId: string,
        body: unknown,
        actor: string,
        _user?: unknown,
      ) =>
        http.request("POST", `/deals/${dealId}/stage-transitions`, body, {
          "X-Actor": actor,
        }),
      listByDeal: async (dealId: string) =>
        http.request("GET", `/deals/${dealId}/stage-transitions`),
    },
  );

  // ── auditService ─────────────────────────────────────────────────────
  const auditService = serviceProxy<ServiceContext["auditService"]>(
    "auditService",
    {
      listByDeal: async (dealId: string, filters?: unknown) => {
        const f = (filters ?? {}) as Record<string, unknown>;
        const params = new URLSearchParams();
        if (f.type) params.set("type", String(f.type));
        if (f.actor) params.set("actor", String(f.actor));
        if (f.limit) params.set("limit", String(f.limit));
        if (f.cursor) params.set("cursor", String(f.cursor));
        const qs = params.toString();
        return http.request(
          "GET",
          `/deals/${dealId}/audit${qs ? `?${qs}` : ""}`,
        );
      },
      record: async (_event: unknown) => {
        // Audit recording happens server-side in remote mode.
        // This is a no-op since the API routes handle audit internally.
      },
    },
  );

  // ── relationshipService ──────────────────────────────────────────────
  const relationshipService = serviceProxy<
    ServiceContext["relationshipService"]
  >("relationshipService", {
    create: async (body: unknown, actor: string) =>
      http.request("POST", "/relationships", body, { "X-Actor": actor }),
  });

  // ── covenantService ──────────────────────────────────────────────────
  const covenantService = serviceProxy<ServiceContext["covenantService"]>(
    "covenantService",
    {
      create: async (dealId: string, body: unknown, actor: string) =>
        http.request("POST", `/deals/${dealId}/covenants`, body, {
          "X-Actor": actor,
        }),
      list: async (dealId: string) =>
        http.request("GET", `/deals/${dealId}/covenants`),
      test: async (dealId: string, actor: string, opts?: unknown) =>
        http.request("POST", `/deals/${dealId}/covenants/test`, opts, {
          "X-Actor": actor,
        }),
    },
  );

  // ── facilityService ──────────────────────────────────────────────────
  const facilityService = serviceProxy<ServiceContext["facilityService"]>(
    "facilityService",
    {
      create: async (dealId: string, body: unknown, actor: string) =>
        http.request("POST", `/deals/${dealId}/facilities`, body, {
          "X-Actor": actor,
        }),
      list: async (dealId: string) =>
        http.request("GET", `/deals/${dealId}/facilities`),
    },
  );

  // ── loanAccountService ───────────────────────────────────────────────
  const loanAccountService = serviceProxy<
    ServiceContext["loanAccountService"]
  >("loanAccountService", {
    create: async (body: unknown, actor: string, tenantId?: string) =>
      http.request("POST", "/loans", body, {
        "X-Actor": actor,
        "X-Tenant-Id": tenantId ?? http.tenantId,
      }),
    getById: async (id: string, tenantId?: string) =>
      http.request("GET", `/loans/${id}`, undefined, {
        "X-Tenant-Id": tenantId ?? http.tenantId,
      }),
    getBalance: async (id: string, tenantId?: string) =>
      http.request("GET", `/loans/${id}/balance`, undefined, {
        "X-Tenant-Id": tenantId ?? http.tenantId,
      }),
    getSchedule: async (id: string, tenantId?: string) =>
      http.request("GET", `/loans/${id}/schedule`, undefined, {
        "X-Tenant-Id": tenantId ?? http.tenantId,
      }),
    requestApproval: async (
      id: string,
      notes: string,
      actor: string,
      tenantId?: string,
    ) =>
      http.request(
        "POST",
        `/loans/${id}/transactions`,
        { type: "PENDING_APPROVAL", notes },
        {
          "X-Actor": actor,
          "X-Tenant-Id": tenantId ?? http.tenantId,
        },
      ),
    approve: async (
      id: string,
      notes: string,
      actor: string,
      tenantId?: string,
    ) =>
      http.request(
        "POST",
        `/loans/${id}/transactions`,
        { type: "APPROVAL", notes },
        {
          "X-Actor": actor,
          "X-Tenant-Id": tenantId ?? http.tenantId,
        },
      ),
    reject: async (
      id: string,
      notes: string,
      actor: string,
      tenantId?: string,
    ) =>
      http.request(
        "POST",
        `/loans/${id}/transactions`,
        { type: "REJECT", notes },
        {
          "X-Actor": actor,
          "X-Tenant-Id": tenantId ?? http.tenantId,
        },
      ),
    withdraw: async (
      id: string,
      notes: string,
      actor: string,
      tenantId?: string,
    ) =>
      http.request(
        "POST",
        `/loans/${id}/transactions`,
        { type: "WITHDRAW", notes },
        {
          "X-Actor": actor,
          "X-Tenant-Id": tenantId ?? http.tenantId,
        },
      ),
    lock: async (
      id: string,
      notes: string,
      actor: string,
      tenantId?: string,
    ) =>
      http.request(
        "POST",
        `/loans/${id}/transactions`,
        { type: "LOCK", notes },
        {
          "X-Actor": actor,
          "X-Tenant-Id": tenantId ?? http.tenantId,
        },
      ),
    unlock: async (
      id: string,
      notes: string,
      actor: string,
      tenantId?: string,
    ) =>
      http.request(
        "POST",
        `/loans/${id}/transactions`,
        { type: "UNLOCK", notes },
        {
          "X-Actor": actor,
          "X-Tenant-Id": tenantId ?? http.tenantId,
        },
      ),
    close: async (
      id: string,
      subState: string,
      notes: string,
      actor: string,
      tenantId?: string,
    ) =>
      http.request(
        "POST",
        `/loans/${id}/transactions`,
        { type: "CLOSE", sub_state: subState, notes },
        {
          "X-Actor": actor,
          "X-Tenant-Id": tenantId ?? http.tenantId,
        },
      ),
    disburse: async (
      id: string,
      body: unknown,
      actor: string,
      tenantId?: string,
    ) =>
      http.request(
        "POST",
        `/loans/${id}/transactions`,
        { type: "DISBURSEMENT", ...(body as object) },
        {
          "X-Actor": actor,
          "X-Tenant-Id": tenantId ?? http.tenantId,
        },
      ),
    repay: async (
      id: string,
      body: unknown,
      actor: string,
      tenantId?: string,
    ) =>
      http.request(
        "POST",
        `/loans/${id}/transactions`,
        { type: "REPAYMENT", ...(body as object) },
        {
          "X-Actor": actor,
          "X-Tenant-Id": tenantId ?? http.tenantId,
        },
      ),
    applyFee: async (
      id: string,
      body: unknown,
      actor: string,
      tenantId?: string,
    ) =>
      http.request(
        "POST",
        `/loans/${id}/transactions`,
        { type: "FEE", ...(body as object) },
        {
          "X-Actor": actor,
          "X-Tenant-Id": tenantId ?? http.tenantId,
        },
      ),
    applyInterest: async (
      id: string,
      valueDate: string,
      actor: string,
      tenantId?: string,
    ) =>
      http.request(
        "POST",
        `/loans/${id}/transactions`,
        { type: "INTEREST_APPLIED", value_date: valueDate },
        {
          "X-Actor": actor,
          "X-Tenant-Id": tenantId ?? http.tenantId,
        },
      ),
    writeOff: async (
      id: string,
      notes: string,
      actor: string,
      tenantId?: string,
    ) =>
      http.request(
        "POST",
        `/loans/${id}/transactions`,
        { type: "WRITE_OFF", notes },
        {
          "X-Actor": actor,
          "X-Tenant-Id": tenantId ?? http.tenantId,
        },
      ),
  });

  // ── monitoringService ────────────────────────────────────────────────
  const monitoringService = serviceProxy<ServiceContext["monitoringService"]>(
    "monitoringService",
    {
      ingest: async (dealId: string, body: unknown, actor: string) =>
        http.request("POST", `/deals/${dealId}/monitoring/ingest`, body, {
          "X-Actor": actor,
        }),
      getStatus: async (dealId: string, actor: string) =>
        http.request("GET", `/deals/${dealId}/monitoring/status`, undefined, {
          "X-Actor": actor,
        }),
    },
  );

  // ── depositAccountService ────────────────────────────────────────────
  const depositAccountService = serviceProxy<
    ServiceContext["depositAccountService"]
  >("depositAccountService", {
    create: async (body: unknown, actor: string, tenantId?: string) =>
      http.request("POST", "/deposits", body, {
        "X-Actor": actor,
        "X-Tenant-Id": tenantId ?? http.tenantId,
      }),
    list: async (tenantId?: string) =>
      http.request("GET", "/deposits", undefined, {
        "X-Tenant-Id": tenantId ?? http.tenantId,
      }),
  });

  // ── approvalGateService ──────────────────────────────────────────────
  // In remote mode, approval gate checks happen server-side inside the
  // REST API route handlers. The proxy stubs are no-ops so that tool
  // handlers that call them directly (stages, loans) don't fail.
  const approvalGateService = serviceProxy<
    ServiceContext["approvalGateService"]
  >("approvalGateService", {
    buildDealContext: async (_dealId: string) => ({}),
    buildLoanContext: async (_loanId: string, _tenantId?: string) => ({}),
    check: async () => {
      // Gate checks are enforced server-side; skip in remote proxy.
    },
  });

  // ── Stub services not used by MCP tools ──────────────────────────────
  const templateService = serviceProxy<ServiceContext["templateService"]>(
    "templateService",
    {},
  );
  const artifactService = serviceProxy<ServiceContext["artifactService"]>(
    "artifactService",
    {},
  );
  const emailService = serviceProxy<ServiceContext["emailService"]>(
    "emailService",
    {},
  );
  const sandboxService = serviceProxy<ServiceContext["sandboxService"]>(
    "sandboxService",
    {},
  );
  const approvalService = serviceProxy<ServiceContext["approvalService"]>(
    "approvalService",
    {},
  );

  return {
    // db is not available in remote mode; access throws
    db: new Proxy({} as ServiceContext["db"], {
      get() {
        throw new Error(
          "Direct database access is not available in remote mode. " +
            "All operations go through the REST API.",
        );
      },
    }),
    dealService,
    entityService,
    documentService,
    spreadService,
    stageService,
    auditService,
    relationshipService,
    covenantService,
    facilityService,
    loanAccountService,
    monitoringService,
    depositAccountService,
    approvalGateService,
    templateService,
    artifactService,
    emailService,
    sandboxService,
    approvalService,
    getNow: () => new Date().toISOString(),
  } as ServiceContext;
}
