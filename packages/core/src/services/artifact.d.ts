import type { Database } from "../schema/db.js";
import type { AuditService } from "./audit.js";
import type { TemplateService } from "./template.js";
export interface FreezeArtifactInput {
    template_id: string;
    deal_id: string;
    overrides?: Record<string, unknown>;
}
export declare class ArtifactService {
    private db;
    private audit;
    private templateService;
    private getNow;
    constructor(db: Database, audit: AuditService, templateService: TemplateService, getNow: () => string);
    freeze(input: FreezeArtifactInput, actor: string): Promise<{
        id: `${string}-${string}-${string}-${string}-${string}`;
        template_id: string;
        deal_id: string;
        template_version: string;
        markdown: string;
        frozen_at: string;
    }>;
    listByDeal(dealId: string): Promise<{
        id: string;
        template_id: string;
        deal_id: string;
        template_version: string | null;
        markdown: string;
        frozen_at: string;
    }[]>;
    getById(id: string): Promise<{
        id: string;
        template_id: string;
        deal_id: string;
        template_version: string | null;
        markdown: string;
        frozen_at: string;
    }>;
}
//# sourceMappingURL=artifact.d.ts.map