import { Hono } from "hono";
import { randomBytes } from "node:crypto";
import type { AppContext } from "../server.js";
import { createDemoToken, isDemoMode } from "../middleware/demo-auth.js";
import { seedDemoTenant } from "../seed/demo-data.js";

/** Track provisioned tenants so we can enforce a capacity limit. */
const provisionedTenants = new Map<
  string,
  { created_at: number; tenant_id: string }
>();

export function demoRoutes(ctx: AppContext) {
  const app = new Hono();

  // -----------------------------------------------------------------------
  // POST /v1/demo/provision
  //
  // Creates a new isolated demo tenant, seeds it with sample data, and
  // returns a signed bearer token the caller can use for subsequent requests.
  // -----------------------------------------------------------------------
  app.post("/demo/provision", async (c) => {
    if (!isDemoMode()) {
      return c.json(
        {
          error: {
            code: "NOT_DEMO",
            message: "Demo mode is not enabled",
          },
        },
        403,
      );
    }

    const maxTenants = parseInt(process.env.DEMO_MAX_TENANTS || "1000", 10);
    const ttl =
      parseInt(process.env.DEMO_TENANT_TTL || "86400", 10) * 1000;

    // Evict expired tenants before checking capacity
    const now = Date.now();
    for (const [key, val] of provisionedTenants) {
      if (now - val.created_at > ttl) {
        provisionedTenants.delete(key);
      }
    }

    if (provisionedTenants.size >= maxTenants) {
      return c.json(
        {
          error: {
            code: "MAX_TENANTS",
            message: "Demo capacity reached. Try again later.",
          },
        },
        503,
      );
    }

    const tenantId = `demo_${randomBytes(8).toString("hex")}`;
    const actor = "demo-user";
    const token = createDemoToken(tenantId, actor);

    // Seed demo data (best-effort — log but don't fail the provision)
    try {
      await seedDemoTenant(ctx, tenantId);
    } catch (err) {
      console.error("Failed to seed demo tenant:", err);
    }

    provisionedTenants.set(tenantId, {
      created_at: Date.now(),
      tenant_id: tenantId,
    });

    const ttlSec = parseInt(process.env.DEMO_TENANT_TTL || "86400", 10);

    return c.json(
      {
        token,
        tenant_id: tenantId,
        actor,
        api_url:
          process.env.DEMO_API_URL ||
          `${c.req.url.split("/v1")[0]}`,
        expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
        expires_in_seconds: ttlSec,
      },
      201,
    );
  });

  // -----------------------------------------------------------------------
  // GET /v1/demo/info
  //
  // Returns public metadata about the demo instance (whether demo mode is
  // active, version, and which features are available to explore).
  // -----------------------------------------------------------------------
  app.get("/demo/info", async (c) => {
    return c.json({
      demo_mode: isDemoMode(),
      version: "0.1.0",
      features: [
        "deal-lifecycle",
        "entity-graph",
        "financial-spreads",
        "covenants",
        "facilities",
        "monitoring",
        "audit-trail",
        "stage-machine",
        "approval-gates",
      ],
    });
  });

  return app;
}
