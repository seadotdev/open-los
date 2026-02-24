#!/usr/bin/env npx tsx
import { startMcp } from "./mcp.js";
import { startCli } from "./cli.js";
import { startRepl } from "./repl.js";

const args = process.argv.slice(2);

if (args[0] === "mcp") {
  await startMcp();
} else if (args.length === 0) {
  await startRepl();
} else {
  await startCli(args);
}
