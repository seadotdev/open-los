import { Hono } from "hono";
import type { AppContext } from "../server.js";
import { stripNulls } from "../utils.js";

export function stageRoutes(ctx: AppContext) {
  const app = new Hono();

  // POST /v1/deals/:dealId/stage-transitions
  app.post("/deals/:dealId/stage-transitions", async (c) => {
    const dealId = c.req.param("dealId");
    const actor = c.req.header("X-Actor") ?? "system";
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const gateRecordId = c.req.header("X-Gate-Record-Id");
    const body = await c.req.json();

    // Determine the gate action
    const gateAction = body.override ? "deal.stage_override" : "deal.stage_advance";

    // Check approval gate before proceeding
    const gateContext = await ctx.approvalGateService.buildDealContext(dealId);
    await ctx.approvalGateService.check(
      gateAction,
      gateContext,
      actor,
      gateRecordId ?? undefined,
      tenantId
    );

    // Look up user context from seeded users
    const user = ctx.users?.get(actor);

    const transition = await ctx.stageService.transition(
      dealId,
      body,
      actor,
      user
    );
    return c.json(stripNulls(transition), 200);
  });

  // GET /v1/deals/:dealId/stage-transitions
  app.get("/deals/:dealId/stage-transitions", async (c) => {
    const dealId = c.req.param("dealId");
    const transitions = await ctx.stageService.listByDeal(dealId);
    return c.json(stripNulls({ transitions }), 200);
  });

  // GET /v1/deals/:dealId/guards?to_stage=<stage>
  // Check stage guard requirements without actually advancing
  app.get("/deals/:dealId/guards", async (c) => {
    const dealId = c.req.param("dealId");
    const toStage = c.req.query("to_stage");
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";

    if (!toStage) {
      return c.json({ error: "to_stage query parameter is required" }, 400);
    }

    const checklist = await ctx.stageService.getChecklist(dealId, toStage, tenantId);
    return c.json({ checklist }, 200);
  });

  return app;
}
