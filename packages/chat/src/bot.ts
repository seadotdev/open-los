/**
 * Open LOS Chat Bot
 *
 * Uses Vercel Chat SDK to create a unified bot for Slack and Teams.
 * Write bot logic once, deploy to both platforms.
 */

import { Chat } from "chat";
import { createSlackAdapter } from "@chat-adapter/slack";
import { createTeamsAdapter } from "@chat-adapter/teams";
import { createMemoryState } from "@chat-adapter/state-memory";
import { createRedisState } from "@chat-adapter/state-redis";
import type { CoreServices } from "@open-los/agent";
import { createAgentServices, createLLMClient } from "@open-los/agent";
import type { LLMClient } from "@open-los/agent";
import { handleMention } from "./handlers/mention.js";
import { handleMessage } from "./handlers/message.js";
import { registerSlashCommands } from "./handlers/commands.js";
import type { ChatConfig, BotContext } from "./types.js";

export function createChatBot(config: ChatConfig): Chat {
  // Build adapters based on config
  const adapters: Record<string, any> = {};

  if (config.slack) {
    adapters.slack = createSlackAdapter({
      appToken: config.slack.appToken,
      botToken: config.slack.botToken,
      signingSecret: config.slack.signingSecret,
    });
  }

  if (config.teams) {
    adapters.teams = createTeamsAdapter({
      appId: config.teams.appId,
      appPassword: config.teams.appPassword,
    });
  }

  // State management: Redis for production, memory for dev
  const state = config.redis
    ? createRedisState({ url: config.redis.url })
    : createMemoryState();

  const bot = new Chat({
    userName: config.botName ?? "open-los",
    adapters,
    state,
  });

  // Build the shared context that handlers use
  const botCtx: BotContext = {
    coreServices: config.coreServices,
    llmClient: config.llmClient,
    defaultTenantId: config.defaultTenantId ?? "default",
  };

  // --- Event handlers ---

  // When someone @mentions the bot in a channel
  bot.onNewMention(async (thread) => {
    await thread.subscribe();
    await handleMention(thread, botCtx);
  });

  // When a message arrives in a subscribed thread
  bot.onSubscribedMessage(async (thread, message) => {
    await handleMessage(thread, message, botCtx);
  });

  // Register slash commands
  registerSlashCommands(bot, botCtx);

  return bot;
}
