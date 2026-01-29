#!/usr/bin/env node
import { serve } from "@hono/node-server";
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
} from "@open-los/core";
import { createApp } from "./server.js";
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
  const app = createApp(ctx);

  // Health check
  app.get("/health", (c) => c.json({ status: "ok", timestamp: clock() }));

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
