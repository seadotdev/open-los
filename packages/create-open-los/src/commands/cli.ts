import { Command } from "commander";
import { execSync } from "node:child_process";

export function cliCommand(): Command {
  return new Command("cli")
    .description("Install the Open LOS CLI and connect to a server")
    .option("--demo", "Connect to the public demo server")
    .option("--global", "Install CLI globally", true)
    .action(async (opts) => {
      console.log("Installing @open-los/cli...");
      try {
        const flag = opts.global ? "-g" : "--save-dev";
        execSync(`npm install ${flag} @open-los/cli`, { stdio: "inherit" });
      } catch {
        console.log("Note: npm install skipped (package may not be published yet).");
        console.log("For local development, use: npx tsx packages/cli/src/index.ts");
      }

      if (opts.demo) {
        console.log("\nConnecting to demo server...");
        try {
          execSync("los connect demo", { stdio: "inherit" });
        } catch {
          console.log("Run 'los connect demo' manually after installation.");
        }
      }

      console.log("\nQuick start:");
      console.log("  los deal list");
      console.log("  los deal create 'Acme Corp'");
      console.log("  los entity list");
      console.log("  los health");
    });
}
