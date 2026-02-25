/**
 * Configuration and context types for the chat bot.
 */

import type { CoreServices } from "@open-los/agent";
import type { LLMClient } from "@open-los/agent";

export interface SlackConfig {
  appToken: string;
  botToken: string;
  signingSecret: string;
}

export interface TeamsConfig {
  appId: string;
  appPassword: string;
}

export interface RedisConfig {
  url: string;
}

export interface ChatConfig {
  /** Core LOS services (from AppContext) */
  coreServices: CoreServices;

  /** LLM client for natural language processing */
  llmClient?: LLMClient;

  /** Slack adapter configuration */
  slack?: SlackConfig;

  /** Microsoft Teams adapter configuration */
  teams?: TeamsConfig;

  /** Redis for production state management (omit for in-memory) */
  redis?: RedisConfig;

  /** Bot display name */
  botName?: string;

  /** Default tenant ID for multi-tenant isolation */
  defaultTenantId?: string;
}

/** Shared context passed to all handlers */
export interface BotContext {
  coreServices: CoreServices;
  llmClient?: LLMClient;
  defaultTenantId: string;
}

/** Parsed command from a chat message */
export interface ParsedCommand {
  action:
    | "list_deals"
    | "get_deal"
    | "create_deal"
    | "deal_status"
    | "advance_deal"
    | "portfolio"
    | "help"
    | "unknown";
  dealId?: string;
  params?: Record<string, string>;
  rawText: string;
}
