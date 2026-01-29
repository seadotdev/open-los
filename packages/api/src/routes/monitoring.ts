import { Hono } from "hono";
import type { AppContext } from "../server.js";
import { stripNulls } from "../utils.js";
import type { IngestInput, TransactionInput } from "@open-los/core";

interface TransactionInputJson {
  date: string;
  amount: number;
  description: string;
  category?: string;
}

interface IngestJsonBody {
  source_type: string;
  transactions: TransactionInputJson[];
}

function parseCSV(csvContent: string): { source_type: string; transactions: TransactionInput[] } {
  const lines = csvContent.trim().split("\n");
  if (lines.length < 2) {
    return { source_type: "bank_transactions", transactions: [] };
  }

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const dateIdx = headers.indexOf("date");
  const amountIdx = headers.indexOf("amount");
  const descriptionIdx = headers.indexOf("description");
  const categoryIdx = headers.indexOf("category");

  if (dateIdx === -1 || amountIdx === -1) {
    return { source_type: "bank_transactions", transactions: [] };
  }

  const transactions: TransactionInput[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    if (cols.length > Math.max(dateIdx, amountIdx)) {
      transactions.push({
        date: cols[dateIdx],
        amount: parseInt(cols[amountIdx], 10),
        description: descriptionIdx !== -1 ? cols[descriptionIdx] : "",
        category: categoryIdx !== -1 ? cols[categoryIdx] : undefined,
      });
    }
  }

  return { source_type: "bank_transactions", transactions };
}

export function monitoringRoutes(ctx: AppContext) {
  const app = new Hono();

  // POST /v1/deals/:dealId/monitoring/ingest
  app.post("/deals/:dealId/monitoring/ingest", async (c) => {
    const dealId = c.req.param("dealId");
    const actor = c.req.header("X-Actor") ?? "system";
    const contentType = c.req.header("Content-Type") ?? "";

    let input: IngestInput;

    if (contentType.includes("multipart/form-data")) {
      // Handle multipart form with CSV file
      const formData = await c.req.formData();
      const sourceType = formData.get("source_type") as string;
      const file = formData.get("file") as File | null;

      if (!sourceType) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "source_type is required",
              retryable: false,
            },
          },
          400
        );
      }

      if (file) {
        // Handle both Blob and File types
        let csvContent: string;
        if (typeof (file as Blob).text === "function") {
          csvContent = await (file as Blob).text();
        } else if (typeof (file as Blob).arrayBuffer === "function") {
          const arrayBuffer = await (file as Blob).arrayBuffer();
          csvContent = Buffer.from(arrayBuffer).toString("utf-8");
        } else if (typeof file === "string") {
          csvContent = file;
        } else {
          csvContent = "";
        }
        const parsed = parseCSV(csvContent);
        input = {
          source_type: sourceType,
          transactions: parsed.transactions,
        };
      } else {
        input = {
          source_type: sourceType,
          transactions: [],
        };
      }
    } else {
      // Handle JSON body
      const body = (await c.req.json()) as IngestJsonBody;
      input = {
        source_type: body.source_type,
        transactions: body.transactions ?? [],
      };
    }

    const result = await ctx.monitoringService.ingest(dealId, input, actor);
    return c.json(stripNulls(result), 201);
  });

  // GET /v1/deals/:dealId/monitoring/status
  app.get("/deals/:dealId/monitoring/status", async (c) => {
    const dealId = c.req.param("dealId");
    const actor = c.req.header("X-Actor") ?? "system";

    const status = await ctx.monitoringService.getStatus(dealId, actor);
    // Don't strip nulls from monitoring status - liquidity fields can be null by design
    return c.json(status, 200);
  });

  return app;
}
