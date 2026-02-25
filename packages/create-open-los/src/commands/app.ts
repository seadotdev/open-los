import { Command } from "commander";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

export function appCommand(): Command {
  return new Command("app")
    .description("Scaffold a new project using Open LOS")
    .argument("[directory]", "Project directory", "my-los-app")
    .option("--demo", "Pre-configure for demo server")
    .action(async (directory, opts) => {
      const dir = resolve(directory);

      if (existsSync(dir)) {
        console.error(`Directory ${directory} already exists.`);
        process.exit(1);
      }

      console.log(`Scaffolding Open LOS app in ${directory}...`);

      mkdirSync(dir, { recursive: true });
      mkdirSync(join(dir, "src"), { recursive: true });

      // package.json
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          {
            name: directory,
            version: "0.1.0",
            private: true,
            type: "module",
            scripts: {
              dev: "tsx src/index.ts",
              start: "node --loader tsx src/index.ts",
            },
            dependencies: {
              "@open-los/cli": "^0.1.0",
              tsx: "^4.0.0",
            },
          },
          null,
          2
        ) + "\n"
      );

      // .mcp.json
      const mcpConfig = opts.demo
        ? {
            mcpServers: {
              "open-los": {
                command: "npx",
                args: ["@open-los/mcp-server", "--remote", "https://demo.open-los.dev"],
              },
            },
          }
        : {
            mcpServers: {
              "open-los": {
                command: "npx",
                args: ["tsx", "packages/mcp-server/src/main.ts"],
                env: { OPEN_LOS_DB_PATH: "./data/dev.db" },
              },
            },
          };
      writeFileSync(join(dir, ".mcp.json"), JSON.stringify(mcpConfig, null, 2) + "\n");

      // src/index.ts - example usage
      writeFileSync(
        join(dir, "src", "index.ts"),
        `/**
 * Example Open LOS integration
 *
 * This file demonstrates how to interact with Open LOS via its REST API.
 * For AI agents, use the MCP server configured in .mcp.json instead.
 */

const API_URL = process.env.LOS_API_URL || "http://localhost:3000";

async function main() {
  // Check health
  const health = await fetch(\`\${API_URL}/health\`).then(r => r.json());
  console.log("API Status:", health);

  // List deals
  const deals = await fetch(\`\${API_URL}/v1/deals\`, {
    headers: { "X-Actor": "my-app", "X-Tenant-Id": "default" },
  }).then(r => r.json());
  console.log("Deals:", deals);
}

main().catch(console.error);
`
      );

      console.log(`\nProject created at ${directory}/`);
      console.log("\nNext steps:");
      console.log(`  cd ${directory}`);
      console.log("  npm install");
      console.log("  npm run dev");
    });
}
