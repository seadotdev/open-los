import { Hono } from "hono";
import { stripNulls } from "../utils.js";
export function emailRoutes(ctx) {
    const app = new Hono();
    // POST /v1/email/ingest
    app.post("/email/ingest", async (c) => {
        const actor = c.req.header("X-Actor") ?? "system";
        const contentType = c.req.header("Content-Type") ?? "";
        let rawEml = null;
        let input = {};
        if (contentType.includes("multipart/form-data")) {
            // Handle multipart form with .eml file
            const formData = await c.req.formData();
            const file = formData.get("file");
            const dealId = formData.get("deal_id");
            if (file) {
                // Handle both Blob and File types
                if (typeof file.arrayBuffer === "function") {
                    const arrayBuffer = await file.arrayBuffer();
                    rawEml = Buffer.from(arrayBuffer);
                }
                else if (typeof file.text === "function") {
                    const text = await file.text();
                    rawEml = Buffer.from(text);
                }
                else if (typeof file === "string") {
                    rawEml = Buffer.from(file);
                }
            }
            if (dealId) {
                input.deal_id = dealId;
            }
        }
        else {
            // Handle JSON body with raw_rfc822_base64
            const body = await c.req.json();
            input = {
                deal_id: body.deal_id,
                raw_rfc822_base64: body.raw_rfc822_base64,
                subject_override: body.subject_override,
            };
        }
        const result = await ctx.emailService.ingest(input, rawEml, actor);
        return c.json(stripNulls(result), 201);
    });
    // GET /v1/deals/:dealId/communications
    app.get("/deals/:dealId/communications", async (c) => {
        const dealId = c.req.param("dealId");
        const result = await ctx.emailService.listByDeal(dealId);
        return c.json(stripNulls(result), 200);
    });
    return app;
}
//# sourceMappingURL=email.js.map