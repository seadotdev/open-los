import { Hono } from "hono";
import { stripNulls } from "../utils.js";
export function documentRoutes(ctx) {
    const app = new Hono();
    // POST /v1/deals/:dealId/documents
    app.post("/deals/:dealId/documents", async (c) => {
        const dealId = c.req.param("dealId");
        const actor = c.req.header("X-Actor") ?? "system";
        const body = await c.req.json();
        const doc = await ctx.documentService.upload(dealId, body, actor);
        return c.json(stripNulls(doc), 202);
    });
    // GET /v1/deals/:dealId/documents
    app.get("/deals/:dealId/documents", async (c) => {
        const dealId = c.req.param("dealId");
        const docs = await ctx.documentService.listByDeal(dealId);
        return c.json(stripNulls({ documents: docs }), 200);
    });
    return app;
}
//# sourceMappingURL=documents.js.map