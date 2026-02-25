#!/usr/bin/env npx tsx
import { Command } from "commander";
import { startMcp } from "./mcp.js";
import { startCli } from "./cli.js";
import { startRepl } from "./repl.js";
import { createRemoteContext } from "./remote.js";

const program = new Command()
  .name("open-los")
  .description("Open LOS MCP server, CLI, and REPL")
  .option("--remote <url>", "Connect to a remote Open LOS API instead of a local database")
  .option("--token <token>", "Authentication token for the remote API")
  .option("--actor <actor>", "Actor identity for audit trail", "mcp-agent")
  .option("--tenant <tenantId>", "Tenant ID for multi-tenant mode", "default");

// Sub-command: mcp (stdio transport)
program
  .command("mcp")
  .description("Start MCP server over stdio transport")
  .action(async () => {
    const opts = program.opts();
    if (opts.remote) {
      const ctx = await createRemoteContext({
        apiUrl: opts.remote,
        token: opts.token,
        actor: opts.actor,
        tenantId: opts.tenant,
      });
      await startMcp(ctx);
    } else {
      await startMcp();
    }
  });

// Parse and route
const args = process.argv.slice(2);

// Handle legacy argument styles (no commander sub-commands)
if (args.length === 0) {
  // No args: start REPL
  await startRepl();
} else if (args[0] === "mcp" && !args.includes("--help") && !args.includes("-h")) {
  // Let commander handle it, including --remote flag
  program.parse(process.argv);
} else if (args[0] === "--remote" || args.includes("--remote")) {
  // Top-level --remote flag implies MCP mode
  // Parse to get options, then start MCP with remote context
  program.parse(process.argv);
  const opts = program.opts();
  if (opts.remote) {
    const ctx = await createRemoteContext({
      apiUrl: opts.remote,
      token: opts.token,
      actor: opts.actor,
      tenantId: opts.tenant,
    });
    await startMcp(ctx);
  }
} else {
  // Otherwise treat as CLI args
  await startCli(args);
}
