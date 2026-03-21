#!/usr/bin/env node
import { serve } from "@hono/node-server";
import {
  createCoreServiceGraph,
} from "@open-los/core";
import { createApp, buildLLMConfigFromEnv } from "./server.js";
import type { AppContext } from "./server.js";

const PORT = parseInt(process.env.PORT || "3000", 10);
const DB_PATH = process.env.DB_PATH || ":memory:";

async function main() {
  console.log(`Starting Open LOS API...`);
  console.log(`  Database: ${DB_PATH}`);
  console.log(`  Port: ${PORT}`);

  // Create database + service graph
  const core = await createCoreServiceGraph({ dbUrl: DB_PATH });
  console.log(`  Database migrated`);

  // LLM config from environment (optional — only needed for mode: "full")
  const llmConfig = buildLLMConfigFromEnv();

  const ctx: AppContext = {
    ...core,
    users: new Map(),
    llmConfig,
  };

  // Create app
  const app = createApp(ctx);

  // Health check
  app.get("/health", (c) => c.json({ status: "ok", timestamp: core.getNow() }));

  // Chat bot status
  const chatPlatforms: string[] = [];
  if (process.env.SLACK_BOT_TOKEN) chatPlatforms.push("Slack");
  if (process.env.TEAMS_APP_ID) chatPlatforms.push("Teams");
  if (chatPlatforms.length > 0) {
    console.log(`  Chat: ${chatPlatforms.join(", ")} enabled`);
  }

  // Start server
  serve({ fetch: app.fetch, port: PORT }, (info) => {
    console.log(`\nOpen LOS API running at http://localhost:${info.port}`);
    console.log(`\nTry:`);
    console.log(`  curl http://localhost:${info.port}/health`);
    console.log(`  curl http://localhost:${info.port}/v1/deals`);
    console.log(`  curl -X POST http://localhost:${info.port}/v1/deals -H "Content-Type: application/json" -d '{"borrower_name":"Acme Ltd"}'`);
    if (chatPlatforms.length > 0) {
      console.log(`\nChat bot (${chatPlatforms.join(", ")}):`);
      console.log(`  curl http://localhost:${info.port}/chat/health`);
    }
  });
}

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
