/**
 * HTTP webhook routes for the chat bot.
 *
 * The Vercel Chat SDK handles incoming webhooks from Slack and Teams.
 * These routes mount the bot's webhook handlers onto your existing
 * Hono server so you don't need a separate process.
 */

import { Hono } from "hono";
import type { Chat } from "chat";
import type { ChatConfig } from "./types.js";
import { createChatBot } from "./bot.js";

/**
 * Create Hono routes that handle chat platform webhooks.
 *
 * Mount these on your existing API server:
 *
 * ```ts
 * import { createChatRoutes } from "@open-los/chat";
 * app.route("/chat", createChatRoutes(chatConfig));
 * ```
 *
 * This exposes:
 *   POST /chat/slack/events     — Slack event subscription
 *   POST /chat/slack/actions    — Slack interactive components
 *   POST /chat/slack/commands   — Slack slash commands
 *   POST /chat/teams/messages   — Teams bot messages
 *   GET  /chat/health           — Chat bot health check
 */
export function createChatRoutes(config: ChatConfig): Hono {
  const app = new Hono();
  const bot = createChatBot(config);

  // Health check
  app.get("/health", (c) =>
    c.json({
      status: "ok",
      adapters: {
        slack: !!config.slack,
        teams: !!config.teams,
      },
    })
  );

  // Slack webhook routes
  if (config.slack) {
    // Slack sends event subscriptions here
    app.post("/slack/events", async (c) => {
      const body = await c.req.json();

      // Handle Slack URL verification challenge
      if (body.type === "url_verification") {
        return c.json({ challenge: body.challenge });
      }

      // Delegate to Chat SDK's Slack adapter
      await bot.handleWebhook("slack", {
        headers: Object.fromEntries(c.req.raw.headers.entries()),
        body,
      });

      return c.json({ ok: true });
    });

    // Slack interactive components (buttons, modals)
    app.post("/slack/actions", async (c) => {
      const body = await c.req.json();
      await bot.handleWebhook("slack", {
        headers: Object.fromEntries(c.req.raw.headers.entries()),
        body,
        type: "action",
      });
      return c.json({ ok: true });
    });

    // Slack slash commands
    app.post("/slack/commands", async (c) => {
      const body = await c.req.parseBody();
      await bot.handleWebhook("slack", {
        headers: Object.fromEntries(c.req.raw.headers.entries()),
        body,
        type: "command",
      });
      return c.json({ response_type: "in_channel" });
    });
  }

  // Teams webhook routes
  if (config.teams) {
    app.post("/teams/messages", async (c) => {
      const body = await c.req.json();
      await bot.handleWebhook("teams", {
        headers: Object.fromEntries(c.req.raw.headers.entries()),
        body,
      });
      return c.json({ ok: true });
    });
  }

  return app;
}
