import { createDatabase, migrateDatabase } from "../schema/db.js";
import type { Database } from "../schema/db.js";
import { ApprovalGateService } from "./approval-gate.js";
import { ApprovalService } from "./approval.js";
import { ArtifactService } from "./artifact.js";
import { AuditService } from "./audit.js";
import { CollateralService } from "./collateral.js";
import { CovenantService } from "./covenant.js";
import { DealService } from "./deal.js";
import { DepositAccountService } from "./deposit-account.js";
import { DocumentService } from "./document.js";
import { EmailService } from "./email.js";
import { EntityResolutionService } from "./entity-resolution.js";
import { EntityService } from "./entity.js";
import { FacilityService } from "./facility.js";
import { LoanAccountService } from "./loan-account.js";
import { MonitoringService } from "./monitoring.js";
import { RelationshipService } from "./relationship.js";
import { InMemoryGitProvider, SandboxService } from "./sandbox.js";
import { SpreadService } from "./spread.js";
import { StageService } from "./stage.js";
import { TemplateService } from "./template.js";
import { TenantSettingsService } from "./tenant-settings.js";

export interface CoreServiceGraph {
  db: Database;
  dealService: DealService;
  documentService: DocumentService;
  auditService: AuditService;
  stageService: StageService;
  entityService: EntityService;
  entityResolutionService: EntityResolutionService;
  relationshipService: RelationshipService;
  templateService: TemplateService;
  artifactService: ArtifactService;
  spreadService: SpreadService;
  collateralService: CollateralService;
  covenantService: CovenantService;
  monitoringService: MonitoringService;
  emailService: EmailService;
  loanAccountService: LoanAccountService;
  facilityService: FacilityService;
  sandboxService: SandboxService;
  depositAccountService: DepositAccountService;
  approvalGateService: ApprovalGateService;
  approvalService: ApprovalService;
  tenantSettingsService: TenantSettingsService;
  getNow: () => string;
}

export interface CreateCoreServiceGraphOptions {
  db?: Database;
  dbUrl?: string;
  getNow?: () => string;
  migrate?: boolean;
}

export async function createCoreServiceGraph(
  options: CreateCoreServiceGraphOptions = {}
): Promise<CoreServiceGraph> {
  const db = options.db ?? createDatabase(options.dbUrl ?? ":memory:");

  if (options.migrate ?? true) {
    await migrateDatabase(db);
  }

  const clock = options.getNow ?? (() => new Date().toISOString());
  const auditService = new AuditService(db);
  const dealService = new DealService(db, auditService, clock);
  const documentService = new DocumentService(db, auditService, clock);
  const tenantSettingsService = new TenantSettingsService(db, clock);
  const stageService = new StageService(db, auditService, clock, tenantSettingsService);
  const entityService = new EntityService(db, auditService, clock);
  const entityResolutionService = new EntityResolutionService(db);
  const relationshipService = new RelationshipService(db, auditService, clock);
  const templateService = new TemplateService();
  const artifactService = new ArtifactService(db, auditService, templateService, clock);
  const spreadService = new SpreadService(db, auditService, clock);
  const collateralService = new CollateralService(db, auditService, clock);
  const covenantService = new CovenantService(db, auditService, clock, collateralService);
  const monitoringService = new MonitoringService(db, auditService, clock);
  const emailService = new EmailService(db, auditService, clock);
  const loanAccountService = new LoanAccountService(db, auditService, clock, covenantService);
  const facilityService = new FacilityService(db, auditService, clock);
  const depositAccountService = new DepositAccountService(db, clock);
  const gitProvider = new InMemoryGitProvider();
  const sandboxService = new SandboxService(db, auditService, gitProvider, clock);
  const approvalGateService = new ApprovalGateService(db, auditService, clock);
  const approvalService = new ApprovalService(db, auditService, clock);

  return {
    db,
    dealService,
    documentService,
    auditService,
    stageService,
    entityService,
    entityResolutionService,
    relationshipService,
    templateService,
    artifactService,
    spreadService,
    collateralService,
    covenantService,
    monitoringService,
    emailService,
    loanAccountService,
    facilityService,
    sandboxService,
    depositAccountService,
    approvalGateService,
    approvalService,
    tenantSettingsService,
    getNow: clock,
  };
}
