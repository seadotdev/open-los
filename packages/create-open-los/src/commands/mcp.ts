import { Command } from "commander";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export function mcpCommand(): Command {
  return new Command("mcp")
    .description("Add Open LOS as an MCP server to your AI agent")
    .option("--demo", "Use the public demo server")
    .option("--server <url>", "Custom server URL")
    .option("--token <token>", "Authentication token")
    .option("--local", "Use local development server (default)")
    .option("--path <path>", "Path to .mcp.json", ".mcp.json")
    .action(async (opts) => {
      const mcpPath = resolve(opts.path);

      // Load existing .mcp.json or create new
      let config: Record<string, unknown> = {};
      if (existsSync(mcpPath)) {
        try {
          config = JSON.parse(readFileSync(mcpPath, "utf-8"));
        } catch {
          config = {};
        }
      }

      const servers = (config.mcpServers || {}) as Record<string, unknown>;

      if (opts.demo) {
        // Provision a demo tenant
        console.log("Provisioning demo tenant...");
        const demoUrl = opts.server || "https://demo.open-los.dev";
        try {
          const res = await fetch(`${demoUrl}/v1/demo/provision`, { method: "POST" });
          if (!res.ok) throw new Error(`Failed: ${res.status}`);
          const data = (await res.json()) as { token: string; tenant_id: string; expires_at: string };

          servers["open-los"] = {
            command: "npx",
            args: ["@open-los/mcp-server", "--remote", demoUrl, "--token", data.token],
          };

          console.log(`Demo tenant provisioned: ${data.tenant_id}`);
          console.log(`Token expires: ${data.expires_at}`);
        } catch (err) {
          // Fallback: configure without auto-provisioning
          console.log("Could not reach demo server. Configuring for manual token entry.");
          servers["open-los"] = {
            command: "npx",
            args: ["@open-los/mcp-server", "--remote", demoUrl, "--token", "YOUR_TOKEN"],
          };
        }
      } else if (opts.server) {
        servers["open-los"] = {
          command: "npx",
          args: [
            "@open-los/mcp-server",
            "--remote",
            opts.server,
            ...(opts.token ? ["--token", opts.token] : []),
          ],
        };
      } else {
        // Local mode
        servers["open-los"] = {
          command: "npx",
          args: ["tsx", "packages/mcp-server/src/main.ts"],
          env: {
            OPEN_LOS_DB_PATH: "./data/dev.db",
          },
        };
      }

      config.mcpServers = servers;
      writeFileSync(mcpPath, JSON.stringify(config, null, 2) + "\n");

      console.log(`\nOpen LOS MCP server added to ${mcpPath}`);
      console.log("\nYour AI agent now has access to these tools:");
      console.log("  deal.create, deal.get, deal.list, deal.update");
      console.log("  entity.create, entity.list");
      console.log("  spread.create, spread.getRatios");
      console.log("  covenant.create, covenant.test");
      console.log("  stage.transition, stage.getGuards");
      console.log("  ...and 30+ more");
      console.log("\nRestart your agent to activate the tools.");
    });
}
