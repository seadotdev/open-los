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
import type { LLMConfig, LLMProvider, LLMRouteConfig } from "@open-los/agent";

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

const LLM_PROVIDER_ORDER: LLMProvider[] = ["anthropic", "openrouter", "openai", "vercel"];

function isLLMProvider(value: unknown): value is LLMProvider {
  return typeof value === "string" && LLM_PROVIDER_ORDER.includes(value as LLMProvider);
}

function parseRoutes(raw: string | undefined): Record<string, LLMRouteConfig> | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Record<string, Partial<LLMRouteConfig>>;
    const routes: Record<string, LLMRouteConfig> = {};
    for (const [functionName, route] of Object.entries(parsed)) {
      if (!route || !isLLMProvider(route.provider) || typeof route.model !== "string") continue;
      routes[functionName] = {
        provider: route.provider,
        model: route.model,
        apiKey: route.apiKey,
        baseURL: route.baseURL,
        fallbackModels: Array.isArray(route.fallbackModels) ? route.fallbackModels : undefined,
        providerOptions: route.providerOptions,
      };
    }
    return Object.keys(routes).length > 0 ? routes : undefined;
  } catch (err) {
    console.warn("Invalid LOS_LLM_ROUTES JSON; ignoring route overrides", err);
    return undefined;
  }
}

function buildLLMConfigFromEnv(): LLMConfig | undefined {
  const apiKeys: Record<string, string> = {
    ...(process.env.ANTHROPIC_API_KEY && { anthropic: process.env.ANTHROPIC_API_KEY }),
    ...(process.env.OPENROUTER_API_KEY && { openrouter: process.env.OPENROUTER_API_KEY }),
    ...(process.env.OPENAI_API_KEY && { openai: process.env.OPENAI_API_KEY }),
    ...(process.env.AI_GATEWAY_API_KEY && { vercel: process.env.AI_GATEWAY_API_KEY }),
  };
  if (Object.keys(apiKeys).length === 0) return undefined;

  const configuredDefault = process.env.LOS_DEFAULT_PROVIDER;
  const defaultProvider = (
    configuredDefault && isLLMProvider(configuredDefault) && apiKeys[configuredDefault]
      ? configuredDefault
      : LLM_PROVIDER_ORDER.find((provider) => apiKeys[provider])
  ) as LLMProvider;

  return {
    defaultProvider,
    defaultModel: process.env.LOS_DEFAULT_MODEL ?? "claude-sonnet-4-5-20250929",
    apiKeys,
    baseURLs: {
      ...(process.env.LOS_ANTHROPIC_BASE_URL && { anthropic: process.env.LOS_ANTHROPIC_BASE_URL }),
      ...(process.env.LOS_OPENROUTER_BASE_URL && { openrouter: process.env.LOS_OPENROUTER_BASE_URL }),
      ...(process.env.OPENAI_BASE_URL && { openai: process.env.OPENAI_BASE_URL }),
      ...(process.env.LOS_VERCEL_BASE_URL && { vercel: process.env.LOS_VERCEL_BASE_URL }),
    },
    routes: parseRoutes(process.env.LOS_LLM_ROUTES),
  };
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
  const llmConfig: LLMConfig | undefined = buildLLMConfigFromEnv();

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
