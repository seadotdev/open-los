/**
 * Chat bot webhook routes.
 *
 * Bridges the @open-los/chat package into the API server.
 * Mounts Slack and Teams webhook endpoints under /chat/*.
 *
 * Requires environment variables for each platform:
 *   Slack:  SLACK_APP_TOKEN, SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET
 *   Teams:  TEAMS_APP_ID, TEAMS_APP_PASSWORD
 *   State:  REDIS_URL (optional, uses in-memory if not set)
 */

import { Hono } from "hono";
import type { AppContext } from "../server.js";

export function chatRoutes(ctx: AppContext): Hono {
  const app = new Hono();

  // Check if any chat platform is configured
  const slackToken = process.env.SLACK_BOT_TOKEN;
  const teamsAppId = process.env.TEAMS_APP_ID;

  if (!slackToken && !teamsAppId) {
    // No chat platforms configured — return a stub that explains how to enable
    app.get("/health", (c) =>
      c.json({
        status: "disabled",
        message: "No chat platforms configured. Set SLACK_BOT_TOKEN or TEAMS_APP_ID to enable.",
      })
    );
    return app;
  }

  // Lazy-load @open-los/chat to avoid import errors when package isn't installed
  let chatInitialized = false;
  let chatApp: Hono | null = null;

  const initChat = async () => {
    if (chatInitialized) return chatApp;
    chatInitialized = true;

    try {
      const { createChatRoutes } = await import("@open-los/chat");
      const { createLLMClient, resolveLLMRoute } = await import("@open-los/agent");

      // Build LLM client if API keys are available
      let llmClient;
      if (ctx.llmConfig) {
        const route = resolveLLMRoute(ctx.llmConfig, "chat");
        if (route?.apiKey) {
          llmClient = createLLMClient(route.provider, {
            apiKey: route.apiKey,
            model: route.model,
            baseURL: route.baseURL,
          });
        }
      }

      chatApp = createChatRoutes({
        coreServices: {
          dealService: ctx.dealService,
          documentService: ctx.documentService,
          stageService: ctx.stageService,
          entityService: ctx.entityService,
          relationshipService: ctx.relationshipService,
          spreadService: ctx.spreadService,
          covenantService: ctx.covenantService,
          facilityService: ctx.facilityService,
          loanAccountService: ctx.loanAccountService,
          monitoringService: ctx.monitoringService,
          auditService: ctx.auditService,
          approvalService: ctx.approvalService,
        },
        llmClient,
        slack: slackToken
          ? {
              appToken: process.env.SLACK_APP_TOKEN ?? "",
              botToken: slackToken,
              signingSecret: process.env.SLACK_SIGNING_SECRET ?? "",
            }
          : undefined,
        teams: teamsAppId
          ? {
              appId: teamsAppId,
              appPassword: process.env.TEAMS_APP_PASSWORD ?? "",
            }
          : undefined,
        redis: process.env.REDIS_URL
          ? { url: process.env.REDIS_URL }
          : undefined,
        defaultTenantId: process.env.DEFAULT_TENANT_ID ?? "default",
      });

      return chatApp;
    } catch (err) {
      console.warn("Failed to initialize chat bot:", err);
      return null;
    }
  };

  // Proxy all requests to the chat sub-app
  app.all("/*", async (c) => {
    const sub = await initChat();
    if (!sub) {
      return c.json(
        { error: "Chat bot not available. Check @open-los/chat is installed." },
        503
      );
    }
    return sub.fetch(c.req.raw);
  });

  return app;
}
