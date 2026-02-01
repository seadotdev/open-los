import { Hono } from "hono";
import type {
  AgentService,
  PostService,
  KnowledgeService,
  CoordinationService,
  NotificationService,
} from "@open-los/social";
import { agentRoutes } from "./agents.js";
import { postRoutes } from "./posts.js";
import { knowledgeRoutes } from "./knowledge.js";
import { coordinationRoutes } from "./coordination.js";
import { notificationRoutes } from "./notifications.js";

export interface SocialContext {
  agentService: AgentService;
  postService: PostService;
  knowledgeService: KnowledgeService;
  coordinationService: CoordinationService;
  notificationService: NotificationService;
}

export function socialRoutes(ctx: SocialContext) {
  const app = new Hono();

  // Mount sub-routes
  app.route("/social", agentRoutes(ctx));
  app.route("/social", postRoutes(ctx));
  app.route("/social", knowledgeRoutes(ctx));
  app.route("/social", coordinationRoutes(ctx));
  app.route("/social", notificationRoutes(ctx));

  return app;
}
