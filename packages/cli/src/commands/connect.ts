import { Command } from "commander";
import { loadConfig, saveConfig, clearConfig, getConfigPath } from "../config.js";
import { success, info, warn, error, handleError, colorize } from "../utils.js";

export function registerConnectCommands(program: Command): void {
  const connect = program
    .command("connect")
    .description("Connect to an Open LOS server");

  // los connect demo
  connect
    .command("demo")
    .description("Connect to the public demo server")
    .option("--server <url>", "Demo server URL", "https://demo.open-los.dev")
    .action(async (opts) => {
      try {
        const serverUrl = opts.server;
        info(`Provisioning demo tenant on ${serverUrl}...`);

        const res = await fetch(`${serverUrl}/v1/demo/provision`, { method: "POST" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error?.message || `Failed to provision: ${res.status}`);
        }

        const data = await res.json();
        saveConfig({
          server: data.api_url || serverUrl,
          token: data.token,
          tenant_id: data.tenant_id,
          actor: data.actor,
          expires_at: data.expires_at,
        });

        success("Connected to demo server!");
        info(`Server: ${data.api_url || serverUrl}`);
        info(`Tenant: ${data.tenant_id}`);
        info(`Expires: ${data.expires_at}`);
        info(`Config saved to ${getConfigPath()}`);
        console.log("");
        info("Try these commands:");
        console.log("  los deal list");
        console.log("  los deal create --borrower-name 'My Company'");
        console.log("  los entity list");
      } catch (err) {
        handleError(err);
      }
    });

  // los connect server <url>
  connect
    .command("server <url>")
    .description("Connect to a specific Open LOS server")
    .option("--token <token>", "Authentication token")
    .option("--actor <actor>", "Actor ID", "cli")
    .option("--tenant-id <id>", "Tenant ID", "default")
    .action(async (url, opts) => {
      try {
        // Test connection
        info(`Testing connection to ${url}...`);
        const res = await fetch(`${url}/health`);
        if (!res.ok) throw new Error(`Server not reachable: ${res.status}`);

        saveConfig({
          server: url,
          token: opts.token,
          tenant_id: opts.tenantId,
          actor: opts.actor,
        });

        success(`Connected to ${url}`);
        info(`Config saved to ${getConfigPath()}`);
      } catch (err) {
        handleError(err);
      }
    });

  // los config
  program
    .command("config")
    .description("Show current configuration")
    .action(() => {
      const config = loadConfig();
      if (!config.server) {
        warn("No server configured. Run 'los connect demo' or 'los connect server <url>'");
        return;
      }
      console.log(JSON.stringify(config, null, 2));
    });

  // los disconnect
  program
    .command("disconnect")
    .description("Clear saved connection config")
    .action(() => {
      clearConfig();
      success("Disconnected. Config cleared.");
    });
}
