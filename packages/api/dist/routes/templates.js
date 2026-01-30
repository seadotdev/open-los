import { Hono } from "hono";
import { stripNulls } from "../utils.js";
export function templateRoutes(ctx) {
    const app = new Hono();
    // GET /v1/templates
    app.get("/templates", async (c) => {
        const phase = c.req.query("phase");
        const doc_type = c.req.query("doc_type");
        const templates = ctx.templateService.list({ phase, doc_type });
        return c.json({ templates: stripNulls(templates) }, 200);
    });
    // POST /v1/templates/render
    app.post("/templates/render", async (c) => {
        const body = await c.req.json();
        const { template_id, deal_id, overrides } = body;
        // Get the deal
        const deal = await ctx.dealService.getById(deal_id);
        // Convert deal to context object
        const dealContext = {
            id: deal.id,
            borrower_name: deal.borrower_name,
            borrower_registration_number: deal.borrower_registration_number,
            jurisdiction: deal.jurisdiction,
            requested_amount: deal.requested_amount,
            purpose: deal.purpose,
            stage: deal.stage,
            origination_outcome: deal.origination_outcome,
            assigned_to: deal.assigned_to,
            created_at: deal.created_at,
            updated_at: deal.updated_at,
        };
        const result = ctx.templateService.render({
            template_id,
            deal: dealContext,
            overrides,
        });
        return c.json(stripNulls(result), 200);
    });
    // GET /v1/deals/:dealId/artifacts
    app.get("/deals/:dealId/artifacts", async (c) => {
        const dealId = c.req.param("dealId");
        const artifacts = await ctx.artifactService.listByDeal(dealId);
        return c.json({ artifacts: stripNulls(artifacts) }, 200);
    });
    // POST /v1/deals/:dealId/artifacts
    app.post("/deals/:dealId/artifacts", async (c) => {
        const dealId = c.req.param("dealId");
        const actor = c.req.header("X-Actor") ?? "system";
        const body = await c.req.json();
        const artifact = await ctx.artifactService.freeze({
            template_id: body.template_id,
            deal_id: dealId,
            overrides: body.overrides,
        }, actor);
        return c.json(stripNulls(artifact), 201);
    });
    return app;
}
//# sourceMappingURL=templates.js.map