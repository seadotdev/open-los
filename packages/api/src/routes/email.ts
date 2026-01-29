import { Hono } from "hono";
import type { AppContext } from "../server.js";
import { stripNulls } from "../utils.js";
import type { EmailIngestInput } from "@open-los/core";

export function emailRoutes(ctx: AppContext) {
  const app = new Hono();

  // POST /v1/email/ingest
  app.post("/email/ingest", async (c) => {
    const actor = c.req.header("X-Actor") ?? "system";
    const contentType = c.req.header("Content-Type") ?? "";

    let rawEml: Buffer | null = null;
    let input: EmailIngestInput = {};

    if (contentType.includes("multipart/form-data")) {
      // Handle multipart form with .eml file
      const formData = await c.req.formData();
      const file = formData.get("file");
      const dealId = formData.get("deal_id") as string | null;

      if (file) {
        // Handle both Blob and File types
        if (typeof (file as Blob).arrayBuffer === "function") {
          const arrayBuffer = await (file as Blob).arrayBuffer();
          rawEml = Buffer.from(arrayBuffer);
        } else if (typeof (file as Blob).text === "function") {
          const text = await (file as Blob).text();
          rawEml = Buffer.from(text);
        } else if (typeof file === "string") {
          rawEml = Buffer.from(file);
        }
      }

      if (dealId) {
        input.deal_id = dealId;
      }
    } else {
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
