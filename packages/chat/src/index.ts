/**
 * @open-los/chat
 *
 * Chat interface for controlling Open LOS from Slack, Microsoft Teams, and more.
 * Built on the Vercel Chat SDK (npm i chat).
 */

export { createChatBot } from "./bot.js";
export { createChatRoutes } from "./routes.js";
export type { ChatConfig, BotContext, SlackConfig, TeamsConfig } from "./types.js";
