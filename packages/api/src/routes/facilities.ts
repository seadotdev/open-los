import { Hono } from "hono";
import type { AppContext } from "../server.js";
import { stripNulls } from "../utils.js";
import { FacilityService } from "@open-los/core";

export function facilityRoutes(ctx: AppContext & { facilityService: FacilityService }) {
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
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const gateRecordId = c.req.header("X-Gate-Record-Id");
    const body = await c.req.json();

    // Gate check: if status is being changed to "approved", check facility.approve gate
    if (body.status === "approved") {
      const gateContext = await ctx.approvalGateService.buildFacilityContext(dealId, facilityId);
      await ctx.approvalGateService.check(
        "facility.approve",
        gateContext,
        actor,
        gateRecordId ?? undefined,
        tenantId
      );
    }

    const result = await ctx.facilityService.update(dealId, facilityId, body, actor);
    return c.json(stripNulls(result), 200);
  });

  // DELETE /v1/deals/:dealId/facilities/:facilityId - delete facility
  app.delete("/deals/:dealId/facilities/:facilityId", async (c) => {
    const dealId = c.req.param("dealId");
    const facilityId = c.req.param("facilityId");
    const actor = c.req.header("X-Actor") ?? "system";
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const gateRecordId = c.req.header("X-Gate-Record-Id");

    // Gate check: facility.delete
    const gateContext = await ctx.approvalGateService.buildFacilityContext(dealId, facilityId);
    await ctx.approvalGateService.check(
      "facility.delete",
      gateContext,
      actor,
      gateRecordId ?? undefined,
      tenantId
    );

    const result = await ctx.facilityService.delete(dealId, facilityId, actor);
    return c.json(stripNulls(result), 200);
  });

  return app;
}
