import { Hono } from "hono";
import type { AppContext } from "../server.js";
import { stripNulls } from "../utils.js";

export function settingsRoutes(ctx: AppContext) {
  const app = new Hono();

  // GET /v1/settings — get tenant settings
  app.get("/settings", async (c) => {
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const settings = await ctx.tenantSettingsService.get(tenantId);
    if (!settings) {
      return c.json({ tenant_id: tenantId, disabled_guards: [] }, 200);
    }
    return c.json(stripNulls(settings), 200);
  });

  // PUT /v1/settings — upsert tenant settings
  app.put("/settings", async (c) => {
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const body = await c.req.json();
    const result = await ctx.tenantSettingsService.upsert(tenantId, body);
    return c.json(stripNulls(result), 200);
  });

  return app;
}
