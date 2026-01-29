#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const tsxCli = require.resolve("tsx/cli");
const here = dirname(fileURLToPath(import.meta.url));
const cliPath = resolve(here, "../src/cli.ts");

const result = spawnSync(process.execPath, [tsxCli, cliPath, ...process.argv.slice(2)], {
  stdio: "inherit",
});

process.exit(result.status ?? 1);
