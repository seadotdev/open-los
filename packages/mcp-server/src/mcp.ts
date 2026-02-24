import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServiceContext } from "./context.js";
import { registerEntityTools } from "./tools/entities.js";
import { registerDealTools } from "./tools/deals.js";
import { registerDocumentTools } from "./tools/documents.js";
import { registerSpreadTools } from "./tools/spreads.js";
import { registerStageTools } from "./tools/stages.js";
import { registerUnderwritingTools } from "./tools/underwriting.js";
import { registerRelationshipTools } from "./tools/relationships.js";
import { registerCovenantTools } from "./tools/covenants.js";
import { registerFacilityTools } from "./tools/facilities.js";
import { registerLoanTools } from "./tools/loans.js";
import { registerMonitoringTools } from "./tools/monitoring.js";
import { registerAuditTools } from "./tools/audit.js";
import { registerDepositTools } from "./tools/deposits.js";
import { registerDealResources } from "./resources/deal.js";
import { registerConfigResources } from "./resources/config.js";

export async function startMcp() {
  const ctx = await createServiceContext();
  const server = new McpServer({
    name: "open-los",
    version: "0.1.0",
  });

  // Register all tools
  registerEntityTools(server, ctx);
  registerDealTools(server, ctx);
  registerDocumentTools(server, ctx);
  registerSpreadTools(server, ctx);
  registerStageTools(server, ctx);
  registerUnderwritingTools(server, ctx);
  registerRelationshipTools(server, ctx);
  registerCovenantTools(server, ctx);
  registerFacilityTools(server, ctx);
  registerLoanTools(server, ctx);
  registerMonitoringTools(server, ctx);
  registerAuditTools(server, ctx);
  registerDepositTools(server, ctx);

  // Register resources
  registerDealResources(server, ctx);
  registerConfigResources(server, ctx);

  // Connect via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
