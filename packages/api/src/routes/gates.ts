import { Hono } from "hono";
import type { AppContext } from "../server.js";
import { stripNulls } from "../utils.js";

export function gateRoutes(ctx: AppContext) {
  const app = new Hono();

  // ─── Policy Management ──────────────────────────────────────────────────────

  // POST /v1/gates/policies — create a gate policy
  app.post("/gates/policies", async (c) => {
    const actor = c.req.header("X-Actor") ?? "system";
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const body = await c.req.json();

    const result = await ctx.approvalGateService.createPolicy(body, actor, tenantId);
    return c.json(stripNulls(result), 201);
  });

  // GET /v1/gates/policies — list gate policies
  app.get("/gates/policies", async (c) => {
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const action = c.req.query("action");
    const loanLine = c.req.query("loan_line");
    const enabledStr = c.req.query("enabled");
    const enabled = enabledStr !== undefined ? enabledStr === "true" : undefined;

    const result = await ctx.approvalGateService.listPolicies(tenantId, {
      action,
      loan_line: loanLine,
      enabled,
    });
    return c.json(stripNulls(result), 200);
  });

  // GET /v1/gates/policies/:policyId — get a specific policy
  app.get("/gates/policies/:policyId", async (c) => {
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const policyId = c.req.param("policyId");

    const result = await ctx.approvalGateService.getPolicy(policyId, tenantId);
    return c.json(stripNulls(result), 200);
  });

  // PATCH /v1/gates/policies/:policyId — update a policy
  app.patch("/gates/policies/:policyId", async (c) => {
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const policyId = c.req.param("policyId");
    const body = await c.req.json();

    const result = await ctx.approvalGateService.updatePolicy(policyId, body, tenantId);
    return c.json(stripNulls(result), 200);
  });

  // DELETE /v1/gates/policies/:policyId — disable a policy
  app.delete("/gates/policies/:policyId", async (c) => {
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const policyId = c.req.param("policyId");

    await ctx.approvalGateService.deletePolicy(policyId, tenantId);
    return c.body(null, 204);
  });

  // ─── Gate Records ───────────────────────────────────────────────────────────

  // GET /v1/gates/records — list gate records
  app.get("/gates/records", async (c) => {
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const status = c.req.query("status");
    const dealId = c.req.query("deal_id");
    const action = c.req.query("action");

    const result = await ctx.approvalGateService.listGateRecords(tenantId, {
      status,
      deal_id: dealId,
      action,
    });
    return c.json(stripNulls(result), 200);
  });

  // GET /v1/gates/records/:recordId — get a specific gate record
  app.get("/gates/records/:recordId", async (c) => {
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const recordId = c.req.param("recordId");

    const result = await ctx.approvalGateService.getGateRecord(recordId, tenantId);
    return c.json(stripNulls(result), 200);
  });

  // POST /v1/gates/records/:recordId/decide — approve or reject a gate
  app.post("/gates/records/:recordId/decide", async (c) => {
    const actor = c.req.header("X-Actor") ?? "system";
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const recordId = c.req.param("recordId");
    const body = await c.req.json();

    const result = await ctx.approvalGateService.decide(
      recordId,
      body,
      actor,
      tenantId
    );
    return c.json(stripNulls(result), 200);
  });

  // POST /v1/gates/records/:recordId/bypass — emergency bypass
  app.post("/gates/records/:recordId/bypass", async (c) => {
    const actor = c.req.header("X-Actor") ?? "system";
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const recordId = c.req.param("recordId");
    const body = await c.req.json();

    const result = await ctx.approvalGateService.bypass(
      recordId,
      body.rationale,
      actor,
      tenantId
    );
    return c.json(stripNulls(result), 200);
  });

  // ─── Gate Check (pre-flight) ────────────────────────────────────────────────

  // POST /v1/gates/check — check whether an action requires a gate
  app.post("/gates/check", async (c) => {
    const actor = c.req.header("X-Actor") ?? "system";
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const body = await c.req.json();

    try {
      const result = await ctx.approvalGateService.check(
        body.action,
        body.context || {},
        actor,
        body.approved_gate_record_id,
        tenantId
      );
      return c.json(stripNulls(result), 200);
    } catch (err: unknown) {
      // Re-throw — the global error handler will catch GateRequiredError
      throw err;
    }
  });

  return app;
}
