#!/usr/bin/env node
import { serve } from "@hono/node-server";
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
import type { AppContext } from "./server.js";

const PORT = parseInt(process.env.PORT || "3000", 10);
const DB_PATH = process.env.DB_PATH || ":memory:";

async function main() {
  console.log(`Starting Open LOS API...`);
  console.log(`  Database: ${DB_PATH}`);
  console.log(`  Port: ${PORT}`);

  // Create database
  const db = createDatabase(DB_PATH);
  await migrateDatabase(db);
  console.log(`  Database migrated`);

  // Create services
  const clock = () => new Date().toISOString();
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

  // Create app
  const app = new Hono();
  app.use("*", cors());

  // Health check
  app.get("/health", (c) => c.json({ status: "ok", timestamp: clock() }));

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

  // Error handler
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

  // Start server
  serve({ fetch: app.fetch, port: PORT }, (info) => {
    console.log(`\nOpen LOS API running at http://localhost:${info.port}`);
    console.log(`\nTry:`);
    console.log(`  curl http://localhost:${info.port}/health`);
    console.log(`  curl http://localhost:${info.port}/v1/deals`);
    console.log(`  curl -X POST http://localhost:${info.port}/v1/deals -H "Content-Type: application/json" -d '{"borrower_name":"Acme Ltd"}'`);
  });
}

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
