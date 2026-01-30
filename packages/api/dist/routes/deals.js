import { Hono } from "hono";
import { stripNulls } from "../utils.js";
export function dealRoutes(ctx) {
    const app = new Hono();
    // POST /v1/deals
    app.post("/deals", async (c) => {
        const actor = c.req.header("X-Actor") ?? "system";
        const body = await c.req.json();
        const deal = await ctx.dealService.create(body, actor);
        return c.json(stripNulls(deal), 201);
    });
    // GET /v1/deals
    app.get("/deals", async (c) => {
        const stage = c.req.query("stage");
        const limit = c.req.query("limit") ? parseInt(c.req.query("limit"), 10) : undefined;
        const cursor = c.req.query("cursor");
        const result = await ctx.dealService.list({ stage, limit, cursor });
        return c.json(stripNulls(result), 200);
    });
    // GET /v1/deals/:dealId
    app.get("/deals/:dealId", async (c) => {
        const dealId = c.req.param("dealId");
        const deal = await ctx.dealService.getById(dealId);
        return c.json(stripNulls(deal), 200);
    });
    // PATCH /v1/deals/:dealId
    app.patch("/deals/:dealId", async (c) => {
        const dealId = c.req.param("dealId");
        const actor = c.req.header("X-Actor") ?? "system";
        const body = await c.req.json();
        const deal = await ctx.dealService.update(dealId, body, actor);
        return c.json(stripNulls(deal), 200);
    });
    return app;
}
//# sourceMappingURL=deals.js.map