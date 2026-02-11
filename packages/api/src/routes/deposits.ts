import { Hono } from "hono";
import type { AppContext } from "../server.js";
import { stripNulls } from "../utils.js";

export function depositRoutes(ctx: AppContext) {
  const app = new Hono();

  // POST /v1/deposits - create deposit account
  app.post("/deposits", async (c) => {
    const actor = c.req.header("X-Actor") ?? "system";
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const body = await c.req.json();
    const result = await ctx.depositAccountService.create(body, actor, tenantId);
    return c.json(stripNulls(result), 201);
  });

  // GET /v1/deposits - list deposit accounts
  app.get("/deposits", async (c) => {
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const result = await ctx.depositAccountService.list(tenantId);
    return c.json(result.map(stripNulls), 200);
  });

  // GET /v1/deposits/:depositId - get deposit account
  app.get("/deposits/:depositId", async (c) => {
    const depositId = c.req.param("depositId");
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const result = await ctx.depositAccountService.getById(depositId, tenantId);
    return c.json(stripNulls(result), 200);
  });

  return app;
}
