import { Hono } from "hono";
import { stripNulls } from "../utils.js";
export function stageRoutes(ctx) {
    const app = new Hono();
    // POST /v1/deals/:dealId/stage-transitions
    app.post("/deals/:dealId/stage-transitions", async (c) => {
        const dealId = c.req.param("dealId");
        const actor = c.req.header("X-Actor") ?? "system";
        const body = await c.req.json();
        // Look up user context from seeded users
        const user = ctx.users?.get(actor);
        const transition = await ctx.stageService.transition(dealId, body, actor, user);
        return c.json(stripNulls(transition), 200);
    });
    // GET /v1/deals/:dealId/stage-transitions
    app.get("/deals/:dealId/stage-transitions", async (c) => {
        const dealId = c.req.param("dealId");
        const transitions = await ctx.stageService.listByDeal(dealId);
        return c.json(stripNulls({ transitions }), 200);
    });
    return app;
}
//# sourceMappingURL=stages.js.map