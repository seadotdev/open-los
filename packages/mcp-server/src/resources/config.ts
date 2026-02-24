import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServiceContext } from "../context.js";
import { STAGE_GUARDS } from "@open-los/core";

export function registerConfigResources(server: McpServer, _ctx: ServiceContext) {
  // config://stages — stage names and guard descriptions
  server.resource(
    "stages",
    "config://stages",
    { description: "Stage pipeline configuration: stage names and their entry guards" },
    async (uri) => {
      const stages = Object.entries(STAGE_GUARDS).map(([name, guards]) => ({
        name,
        guards: guards.map((g) => g.item),
      }));

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({ stages }, null, 2),
          },
        ],
      };
    }
  );
}
