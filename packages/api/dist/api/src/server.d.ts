import { Hono } from "hono";
import { DealService, DocumentService, AuditService, StageService, EntityService, RelationshipService, TemplateService, ArtifactService, SpreadService, CovenantService, MonitoringService, EmailService, LoanAccountService, SkillService } from "@open-los/core";
import type { Database } from "@open-los/core";
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
    skillService: SkillService;
    getNow: () => string;
    users?: Map<string, {
        id: string;
        role: string;
    }>;
}
export declare function createApp(ctx: AppContext): Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
export declare function createAppWithDb(getNow?: () => string): Promise<{
    app: Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
    ctx: AppContext;
}>;
//# sourceMappingURL=server.d.ts.map