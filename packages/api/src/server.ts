import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  createDatabase,
  migrateDatabase,
  DealService,
  DocumentService,
  AuditService,
  StageService,
  EntityService,
  RelationshipService,
  TemplateService,
  ArtifactService,
  SpreadService,
  CovenantService,
  MonitoringService,
  EmailService,
  LoanAccountService,
  FacilityService,
  AppError,
} from "@open-los/core";
import type { Database } from "@open-los/core";
import {
  createDatabase as createSocialDatabase,
  migrateDatabase as migrateSocialDatabase,
  AgentService,
  PostService,
  KnowledgeService,
  CoordinationService,
  NotificationService,
  SocialError,
} from "@open-los/social";
import type { Database as SocialDatabase } from "@open-los/social";
import { dealRoutes } from "./routes/deals.js";
import { documentRoutes } from "./routes/documents.js";
import { auditRoutes } from "./routes/audit.js";
import { stageRoutes } from "./routes/stages.js";
import { entityRoutes } from "./routes/entities.js";
import { relationshipRoutes } from "./routes/relationships.js";
import { templateRoutes } from "./routes/templates.js";
import { underwritingRoutes } from "./routes/underwriting.js";
import { covenantRoutes } from "./routes/covenants.js";
import { monitoringRoutes } from "./routes/monitoring.js";
import { emailRoutes } from "./routes/email.js";
import { loanRoutes } from "./routes/loans.js";
import { facilityRoutes } from "./routes/facilities.js";
import { socialRoutes } from "./routes/social/index.js";

export interface AppContext {
  db: Database;
  dealService: DealService;
  documentService: DocumentService;
  auditService: AuditService;
  stageService: StageService;
  entityService: EntityService;
  relationshipService: RelationshipService;
  templateService: TemplateService;
  artifactService: ArtifactService;
  spreadService: SpreadService;
  covenantService: CovenantService;
  monitoringService: MonitoringService;
  emailService: EmailService;
  loanAccountService: LoanAccountService;
  facilityService: FacilityService;
  // Social network services
  socialDb?: SocialDatabase;
  agentService?: AgentService;
  postService?: PostService;
  knowledgeService?: KnowledgeService;
  coordinationService?: CoordinationService;
  notificationService?: NotificationService;
  getNow: () => string;
  users?: Map<string, { id: string; role: string }>;
}

function getCorsOrigins(): string[] | undefined {
  const raw = process.env.CORS_ORIGINS ?? process.env.CORS_ORIGIN;
  if (!raw || raw.trim() === "" || raw.trim() === "*") {
    return undefined;
  }
  const origins = raw.split(",").map((origin) => origin.trim()).filter(Boolean);
  return origins.length > 0 ? origins : undefined;
}

export function createApp(ctx: AppContext) {
  const app = new Hono();

  // CORS
  const corsOrigins = getCorsOrigins();
  app.use("*", cors(corsOrigins ? { origin: corsOrigins } : undefined));

  // Mount routes
  app.route("/v1", dealRoutes(ctx));
  app.route("/v1", documentRoutes(ctx));
  app.route("/v1", auditRoutes(ctx));
  app.route("/v1", stageRoutes(ctx));
  app.route("/v1", entityRoutes(ctx));
  app.route("/v1", relationshipRoutes(ctx));
  app.route("/v1", templateRoutes(ctx));
  app.route("/v1", underwritingRoutes(ctx));
  app.route("/v1", covenantRoutes(ctx));
  app.route("/v1", monitoringRoutes(ctx));
  app.route("/v1", emailRoutes(ctx));
  app.route("/v1", loanRoutes(ctx));
  app.route("/v1", facilityRoutes(ctx));

  // Mount social routes if services are available
  if (ctx.agentService && ctx.postService && ctx.knowledgeService && ctx.coordinationService && ctx.notificationService) {
    app.route("/v1", socialRoutes({
      agentService: ctx.agentService,
      postService: ctx.postService,
      knowledgeService: ctx.knowledgeService,
      coordinationService: ctx.coordinationService,
      notificationService: ctx.notificationService,
    }));
  }

  // Global error handler
  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json(
        {
          error: {
            code: err.code,
            message: err.message,
            details: err.details,
            retryable: err.retryable,
          },
        },
        err.statusCode as 400
      );
    }

    if (err instanceof SocialError) {
      return c.json(
        {
          error: {
            code: err.code,
            message: err.message,
            details: err.details,
            retryable: err.retryable,
          },
        },
        err.statusCode as 400
      );
    }

    console.error("Unhandled error:", err);
    return c.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Internal server error",
          retryable: false,
        },
      },
      500
    );
  });

  return app;
}

export async function createAppWithDb(getNow?: () => string, options?: { enableSocial?: boolean }) {
  const db = createDatabase(":memory:");
  await migrateDatabase(db);

  const clock = getNow ?? (() => new Date().toISOString());
  const auditService = new AuditService(db);
  const dealService = new DealService(db, auditService, clock);
  const documentService = new DocumentService(db, auditService, clock);
  const stageService = new StageService(db, auditService, clock);
  const entityService = new EntityService(db, auditService, clock);
  const relationshipService = new RelationshipService(db, auditService, clock);
  const templateService = new TemplateService();
  const artifactService = new ArtifactService(db, auditService, templateService, clock);
  const spreadService = new SpreadService(db, auditService, clock);
  const covenantService = new CovenantService(db, auditService, clock);
  const monitoringService = new MonitoringService(db, auditService, clock);
  const emailService = new EmailService(db, auditService, clock);
  const loanAccountService = new LoanAccountService(db, auditService, clock);
  const facilityService = new FacilityService(db, auditService, clock);

  const ctx: AppContext = {
    db,
    dealService,
    documentService,
    auditService,
    stageService,
    entityService,
    relationshipService,
    templateService,
    artifactService,
    spreadService,
    covenantService,
    monitoringService,
    emailService,
    loanAccountService,
    facilityService,
    getNow: clock,
    users: new Map(),
  };

  // Initialize social services if enabled
  if (options?.enableSocial !== false) {
    const socialDb = createSocialDatabase(":memory:");
    await migrateSocialDatabase(socialDb);

    ctx.socialDb = socialDb;
    ctx.agentService = new AgentService(socialDb, clock);
    ctx.postService = new PostService(socialDb, clock);
    ctx.knowledgeService = new KnowledgeService(socialDb, clock);
    ctx.coordinationService = new CoordinationService(socialDb, clock);
    ctx.notificationService = new NotificationService(socialDb, clock);
  }

  return { app: createApp(ctx), ctx };
}
