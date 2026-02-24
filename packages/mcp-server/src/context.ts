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
  SandboxService,
  InMemoryGitProvider,
  DepositAccountService,
  ApprovalGateService,
  ApprovalService,
} from "@open-los/core";
import type { Database } from "@open-los/core";

export interface LLMConfig {
  defaultProvider: "anthropic" | "openrouter";
  defaultModel: string;
  apiKeys: Record<string, string>;
}

export interface ServiceContext {
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
  sandboxService: SandboxService;
  depositAccountService: DepositAccountService;
  approvalGateService: ApprovalGateService;
  approvalService: ApprovalService;
  llmConfig?: LLMConfig;
  getNow: () => string;
}

export async function createServiceContext(
  dbPath?: string
): Promise<ServiceContext> {
  const resolvedPath = dbPath ?? process.env.OPEN_LOS_DB_PATH ?? ":memory:";
  const db = createDatabase(resolvedPath);
  await migrateDatabase(db);

  const clock = () => new Date().toISOString();
  const auditService = new AuditService(db);
  const dealService = new DealService(db, auditService, clock);
  const documentService = new DocumentService(db, auditService, clock);
  const stageService = new StageService(db, auditService, clock);
  const entityService = new EntityService(db, auditService, clock);
  const relationshipService = new RelationshipService(db, auditService, clock);
  const templateService = new TemplateService();
  const artifactService = new ArtifactService(
    db,
    auditService,
    templateService,
    clock
  );
  const spreadService = new SpreadService(db, auditService, clock);
  const covenantService = new CovenantService(db, auditService, clock);
  const monitoringService = new MonitoringService(db, auditService, clock);
  const emailService = new EmailService(db, auditService, clock);
  const loanAccountService = new LoanAccountService(db, auditService, clock);
  const facilityService = new FacilityService(db, auditService, clock);
  const depositAccountService = new DepositAccountService(db, clock);
  const gitProvider = new InMemoryGitProvider();
  const sandboxService = new SandboxService(
    db,
    auditService,
    gitProvider,
    clock
  );
  const approvalGateService = new ApprovalGateService(db, auditService, clock);
  const approvalService = new ApprovalService(db, auditService, clock);

  // LLM config from environment (optional — only needed for mode: "full")
  const llmConfig: LLMConfig | undefined = (() => {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    if (!anthropicKey && !openrouterKey) return undefined;
    return {
      defaultProvider: (anthropicKey
        ? "anthropic"
        : "openrouter") as LLMConfig["defaultProvider"],
      defaultModel:
        process.env.LOS_DEFAULT_MODEL ?? "claude-sonnet-4-5-20250929",
      apiKeys: {
        ...(anthropicKey && { anthropic: anthropicKey }),
        ...(openrouterKey && { openrouter: openrouterKey }),
      },
    };
  })();

  return {
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
    sandboxService,
    depositAccountService,
    approvalGateService,
    approvalService,
    llmConfig,
    getNow: clock,
  };
}
