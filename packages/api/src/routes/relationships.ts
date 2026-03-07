import { Hono } from "hono";
import type { AppContext } from "../server.js";
import { stripNulls } from "../utils.js";

export function relationshipRoutes(ctx: AppContext) {
  const app = new Hono();

  // POST /v1/relationships
  app.post("/relationships", async (c) => {
    const actor = c.req.header("X-Actor") ?? "system";
    const body = await c.req.json();
    const relationship = await ctx.relationshipService.create(body, actor);
    return c.json(stripNulls(relationship), 201);
  });

  // GET /v1/deals/:dealId/borrower-group
  app.get("/deals/:dealId/borrower-group", async (c) => {
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const dealId = c.req.param("dealId");

    // Get the deal to find the primary_entity_id
    const deal = await ctx.dealService.getById(dealId, tenantId);

    if (!deal.primary_entity_id) {
      return c.json({ entities: [], relationships: [] }, 200);
    }

    const group = await ctx.relationshipService.getBorrowerGroup(deal.primary_entity_id);
    return c.json(stripNulls(group), 200);
  });

  return app;
}
