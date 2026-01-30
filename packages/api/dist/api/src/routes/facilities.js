import { Hono } from "hono";
import { stripNulls } from "../utils.js";
export function facilityRoutes(ctx) {
    const app = new Hono();
    // POST /v1/deals/:dealId/facilities - create facility
    app.post("/deals/:dealId/facilities", async (c) => {
        const dealId = c.req.param("dealId");
        const actor = c.req.header("X-Actor") ?? "system";
        const body = await c.req.json();
        const result = await ctx.facilityService.create(dealId, body, actor);
        return c.json(stripNulls(result), 201);
    });
    // GET /v1/deals/:dealId/facilities - list facilities
    app.get("/deals/:dealId/facilities", async (c) => {
        const dealId = c.req.param("dealId");
        const result = await ctx.facilityService.list(dealId);
        return c.json(stripNulls(result), 200);
    });
    // GET /v1/deals/:dealId/facilities/:facilityId - get facility
    app.get("/deals/:dealId/facilities/:facilityId", async (c) => {
        const dealId = c.req.param("dealId");
        const facilityId = c.req.param("facilityId");
        const result = await ctx.facilityService.getById(dealId, facilityId);
        return c.json(stripNulls(result), 200);
    });
    // PATCH /v1/deals/:dealId/facilities/:facilityId - update facility
    app.patch("/deals/:dealId/facilities/:facilityId", async (c) => {
        const dealId = c.req.param("dealId");
        const facilityId = c.req.param("facilityId");
        const actor = c.req.header("X-Actor") ?? "system";
        const body = await c.req.json();
        const result = await ctx.facilityService.update(dealId, facilityId, body, actor);
        return c.json(stripNulls(result), 200);
    });
    // DELETE /v1/deals/:dealId/facilities/:facilityId - delete facility
    app.delete("/deals/:dealId/facilities/:facilityId", async (c) => {
        const dealId = c.req.param("dealId");
        const facilityId = c.req.param("facilityId");
        const actor = c.req.header("X-Actor") ?? "system";
        const result = await ctx.facilityService.delete(dealId, facilityId, actor);
        return c.json(stripNulls(result), 200);
    });
    return app;
}
//# sourceMappingURL=facilities.js.map