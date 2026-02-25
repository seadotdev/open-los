import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServiceContext } from "../context.js";

export function registerDealResources(server: McpServer, ctx: ServiceContext) {
  // deal://{dealId} — composite deal view
  server.resource(
    "deal",
    "deal://{dealId}",
    {
      description:
        "Composite deal view: deal details, documents, financial ratios, and covenants",
    },
    async (uri) => {
      const dealId = uri.pathname.replace(/^\/\//, "");

      const [deal, docs, ratios, covenants] = await Promise.all([
        ctx.dealService.getById(dealId).catch(() => null),
        ctx.documentService.listByDeal(dealId).catch(() => []),
        ctx.spreadService.getRatios(dealId).catch(() => null),
        ctx.covenantService.list(dealId).catch(() => ({ covenants: [] })),
      ]);

      const composite = { deal, documents: docs, ratios, covenants };
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(composite, null, 2),
          },
        ],
      };
    }
  );

  // deal://{dealId}/documents
  server.resource(
    "deal-documents",
    "deal://{dealId}/documents",
    { description: "Documents associated with a deal" },
    async (uri) => {
      const parts = uri.pathname.replace(/^\/\//, "").split("/");
      const dealId = parts[0];
      const docs = await ctx.documentService.listByDeal(dealId);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({ documents: docs }, null, 2),
          },
        ],
      };
    }
  );

  // deal://{dealId}/financials
  server.resource(
    "deal-financials",
    "deal://{dealId}/financials",
    { description: "Financial spread ratios for a deal" },
    async (uri) => {
      const parts = uri.pathname.replace(/^\/\//, "").split("/");
      const dealId = parts[0];
      const ratios = await ctx.spreadService.getRatios(dealId);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(ratios, null, 2),
          },
        ],
      };
    }
  );

  // deal://{dealId}/timeline
  server.resource(
    "deal-timeline",
    "deal://{dealId}/timeline",
    { description: "Audit events and stage transitions for a deal" },
    async (uri) => {
      const parts = uri.pathname.replace(/^\/\//, "").split("/");
      const dealId = parts[0];

      const [audit, transitions] = await Promise.all([
        ctx.auditService.listByDeal(dealId).catch(() => ({ events: [] })),
        ctx.stageService.listByDeal(dealId).catch(() => ({ transitions: [] })),
      ]);

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({ audit, transitions }, null, 2),
          },
        ],
      };
    }
  );
}
