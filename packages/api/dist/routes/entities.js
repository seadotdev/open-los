import { Hono } from "hono";
import { stripNulls } from "../utils.js";
export function entityRoutes(ctx) {
    const app = new Hono();
    // POST /v1/entities
    app.post("/entities", async (c) => {
        const actor = c.req.header("X-Actor") ?? "system";
        const body = await c.req.json();
        const entity = await ctx.entityService.create(body, actor);
        return c.json(stripNulls(entity), 201);
    });
    // GET /v1/entities
    app.get("/entities", async (c) => {
        const type = c.req.query("type");
        const limit = c.req.query("limit") ? parseInt(c.req.query("limit"), 10) : undefined;
        const cursor = c.req.query("cursor");
        const result = await ctx.entityService.list({ type, limit, cursor });
        return c.json(stripNulls(result), 200);
    });
    // GET /v1/entities/:entityId
    app.get("/entities/:entityId", async (c) => {
        const entityId = c.req.param("entityId");
        const entity = await ctx.entityService.getById(entityId);
        return c.json(stripNulls(entity), 200);
    });
    // PATCH /v1/entities/:entityId
    app.patch("/entities/:entityId", async (c) => {
        const entityId = c.req.param("entityId");
        const actor = c.req.header("X-Actor") ?? "system";
        const body = await c.req.json();
        // Find deal associated with this entity for audit purposes
        const dealId = await ctx.entityService.findDealIdByEntity(entityId);
        const entity = await ctx.entityService.update(entityId, body, actor, dealId ?? undefined);
        return c.json(stripNulls(entity), 200);
    });
    // DELETE /v1/entities/:entityId
    app.delete("/entities/:entityId", async (c) => {
        const entityId = c.req.param("entityId");
        await ctx.entityService.delete(entityId);
        return new Response(null, { status: 204 });
    });
    return app;
}
//# sourceMappingURL=entities.js.map