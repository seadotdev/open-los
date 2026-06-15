import { Hono } from "hono";
import type { AppContext } from "../server.js";
import { stripNulls } from "../utils.js";

export function collateralRoutes(ctx: AppContext) {
  const app = new Hono();

  // ─── Collateral Items ──────────────────────────────────────────────────

  // POST /v1/deals/:dealId/collateral - create collateral item
  app.post("/deals/:dealId/collateral", async (c) => {
    const dealId = c.req.param("dealId");
    const actor = c.req.header("X-Actor") ?? "system";
    const body = await c.req.json();

    const result = await ctx.collateralService.createItem(dealId, body, actor);
    return c.json(stripNulls(result), 201);
  });

  // GET /v1/deals/:dealId/collateral - list collateral items
  app.get("/deals/:dealId/collateral", async (c) => {
    const dealId = c.req.param("dealId");

    const result = await ctx.collateralService.listItems(dealId);
    return c.json(stripNulls({ collateral_items: result }), 200);
  });

  // GET /v1/collateral/:collateralId - get collateral item
  app.get("/collateral/:collateralId", async (c) => {
    const collateralId = c.req.param("collateralId");
    const dealId = c.req.query("dealId");

    if (!dealId) {
      return c.json(
        { error: { code: "VALIDATION_ERROR", message: "dealId query parameter is required" } },
        400
      );
    }

    const result = await ctx.collateralService.getItemById(collateralId, dealId);
    return c.json(stripNulls(result), 200);
  });

  // PATCH /v1/collateral/:collateralId/release - release collateral
  app.patch("/collateral/:collateralId/release", async (c) => {
    const collateralId = c.req.param("collateralId");
    const actor = c.req.header("X-Actor") ?? "system";
    const body = await c.req.json().catch(() => ({}));
    const dealId = body.dealId || c.req.query("dealId");

    if (!dealId) {
      return c.json(
        { error: { code: "VALIDATION_ERROR", message: "dealId is required" } },
        400
      );
    }

    const result = await ctx.collateralService.releaseCollateral(collateralId, dealId, actor);
    return c.json(stripNulls(result), 200);
  });

  // ─── Collateral Valuations ────────────────────────────────────────────

  // POST /v1/collateral/:collateralId/valuations - add valuation
  app.post("/collateral/:collateralId/valuations", async (c) => {
    const collateralId = c.req.param("collateralId");
    const actor = c.req.header("X-Actor") ?? "system";
    const body = await c.req.json();
    const dealId = c.req.query("dealId");

    if (!dealId) {
      return c.json(
        { error: { code: "VALIDATION_ERROR", message: "dealId query parameter is required" } },
        400
      );
    }

    const result = await ctx.collateralService.addValuation(collateralId, dealId, body, actor);
    return c.json(stripNulls(result), 201);
  });

  // GET /v1/collateral/:collateralId/valuations - list valuations
  app.get("/collateral/:collateralId/valuations", async (c) => {
    const collateralId = c.req.param("collateralId");
    const dealId = c.req.query("dealId");
    const purpose = c.req.query("purpose");
    const limit = c.req.query("limit") ? parseInt(c.req.query("limit")!, 10) : undefined;

    if (!dealId) {
      return c.json(
        { error: { code: "VALIDATION_ERROR", message: "dealId query parameter is required" } },
        400
      );
    }

    const result = await ctx.collateralService.listValuations(collateralId, dealId, {
      purpose,
      limit,
    });
    return c.json(stripNulls(result), 200);
  });

  // GET /v1/collateral/:collateralId/valuations/current - get latest valuation
  app.get("/collateral/:collateralId/valuations/current", async (c) => {
    const collateralId = c.req.param("collateralId");
    const dealId = c.req.query("dealId");
    const purpose = c.req.query("purpose");

    if (!dealId) {
      return c.json(
        { error: { code: "VALIDATION_ERROR", message: "dealId query parameter is required" } },
        400
      );
    }

    const result = await ctx.collateralService.getLatestValuation(collateralId, dealId, purpose);

    if (!result) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "No valuation found" } },
        404
      );
    }

    return c.json(stripNulls(result), 200);
  });

  return app;
}
