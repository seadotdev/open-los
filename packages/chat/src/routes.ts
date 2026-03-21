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

      return bot.webhooks.slack(c.req.raw);
    });

    // Slack interactive components (buttons, modals)
    app.post("/slack/actions", (c) => bot.webhooks.slack(c.req.raw));

    // Slack slash commands
    app.post("/slack/commands", (c) => bot.webhooks.slack(c.req.raw));
  }

  // Teams webhook routes
  if (config.teams) {
    app.post("/teams/messages", (c) => bot.webhooks.teams(c.req.raw));
  }

  return app;
}
