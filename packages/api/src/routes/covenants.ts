import { Hono } from "hono";
import type { AppContext } from "../server.js";
import { stripNulls } from "../utils.js";

export function covenantRoutes(ctx: AppContext) {
  const app = new Hono();

  // POST /v1/deals/:dealId/covenants - create covenant
  app.post("/deals/:dealId/covenants", async (c) => {
    const dealId = c.req.param("dealId");
    const actor = c.req.header("X-Actor") ?? "system";
    const body = await c.req.json();
    const result = await ctx.covenantService.create(dealId, body, actor);
    return c.json(stripNulls(result), 201);
  });

  // GET /v1/deals/:dealId/covenants - list covenants
  app.get("/deals/:dealId/covenants", async (c) => {
    const dealId = c.req.param("dealId");
    const result = await ctx.covenantService.list(dealId);
    return c.json(stripNulls(result), 200);
  });

  // POST /v1/deals/:dealId/covenants/test - test covenants
  app.post("/deals/:dealId/covenants/test", async (c) => {
    const dealId = c.req.param("dealId");
    const actor = c.req.header("X-Actor") ?? "system";
    const body = await c.req.json().catch(() => ({}));
    const result = await ctx.covenantService.test(dealId, actor, {
      covenant_ids: body.covenant_ids,
      as_of: body.as_of,
      as_of_period: body.as_of_period,
    });
    return c.json(stripNulls(result), 200);
  });

  // POST /v1/covenants/:covenantId/waivers - create waiver
  app.post("/covenants/:covenantId/waivers", async (c) => {
    const covenantId = c.req.param("covenantId");
    const actor = c.req.header("X-Actor") ?? "system";
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const gateRecordId = c.req.header("X-Gate-Record-Id");
    const body = await c.req.json();

    // Gate check: covenant.waive — waivers are a one-way door risk decision
    const gateContext = { deal_id: body.deal_id };
    await ctx.approvalGateService.check(
      "covenant.waive",
      gateContext,
      actor,
      gateRecordId ?? undefined,
      tenantId
    );

    const result = await ctx.covenantService.createWaiver(covenantId, body, actor);
    return c.json(stripNulls(result), 201);
  });

  return app;
}
