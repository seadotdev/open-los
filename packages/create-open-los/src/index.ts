#!/usr/bin/env npx tsx
import { Command } from "commander";
import { mcpCommand } from "./commands/mcp.js";
import { cliCommand } from "./commands/cli.js";
import { appCommand } from "./commands/app.js";

const program = new Command();

program
  .name("create-open-los")
  .description("Bootstrap Open LOS for your project or AI agent")
  .version("0.1.0");

program.addCommand(mcpCommand());
program.addCommand(cliCommand());
program.addCommand(appCommand());

program.parse();
