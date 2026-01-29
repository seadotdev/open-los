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
  AppError,
} from "@open-los/core";
import type { Database } from "@open-los/core";
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
  getNow: () => string;
  users?: Map<string, { id: string; role: string }>;
}

export function createApp(ctx: AppContext) {
  const app = new Hono();

  // CORS
  app.use("*", cors());

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

export async function createAppWithDb(getNow?: () => string) {
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
    getNow: clock,
    users: new Map(),
  };

  return { app: createApp(ctx), ctx };
}
