import { Hono } from "hono";
import type { AppContext } from "../server.js";
import { stripNulls } from "../utils.js";

export function auditRoutes(ctx: AppContext) {
  const app = new Hono();

  // GET /v1/deals/:dealId/audit
  app.get("/deals/:dealId/audit", async (c) => {
    const dealId = c.req.param("dealId");
    const type = c.req.query("type");
    const actor = c.req.query("actor");
    const limit = c.req.query("limit")
      ? parseInt(c.req.query("limit")!, 10)
      : undefined;
    const cursor = c.req.query("cursor");

    const result = await ctx.auditService.listByDeal(dealId, {
      type,
      actor,
      limit,
      cursor,
    });

    return c.json(stripNulls(result), 200);
  });

  // PATCH /v1/deals/:dealId/audit/:eventId — immutability guard
  app.patch("/deals/:dealId/audit/:eventId", (c) => {
    return c.json(
      {
        error: {
          code: "METHOD_NOT_ALLOWED",
          message: "Audit events are immutable and cannot be modified",
          retryable: false,
        },
      },
      405
    );
  });

  // DELETE /v1/deals/:dealId/audit/:eventId — immutability guard
  app.delete("/deals/:dealId/audit/:eventId", (c) => {
    return c.json(
      {
        error: {
          code: "METHOD_NOT_ALLOWED",
          message: "Audit events are immutable and cannot be deleted",
          retryable: false,
        },
      },
      405
    );
  });

  return app;
}
