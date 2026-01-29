import { eq } from "drizzle-orm";
import { artifacts, deals } from "../schema/tables.js";
import { NotFoundError } from "./errors.js";
export class ArtifactService {
    db;
    audit;
    templateService;
    getNow;
    constructor(db, audit, templateService, getNow) {
        this.db = db;
        this.audit = audit;
        this.templateService = templateService;
        this.getNow = getNow;
    }
    async freeze(input, actor) {
        // Get the deal
        const dealRows = await this.db
            .select()
            .from(deals)
            .where(eq(deals.id, input.deal_id));
        if (dealRows.length === 0) {
            throw new NotFoundError(`Deal ${input.deal_id} not found`);
        }
        const deal = dealRows[0];
        // Convert deal to context object
        const dealContext = {
            id: deal.id,
            borrower_name: deal.borrower_name,
            borrower_registration_number: deal.borrower_registration_number,
            jurisdiction: deal.jurisdiction,
            requested_amount: deal.requested_amount,
            purpose: deal.purpose,
            stage: deal.stage,
            origination_outcome: deal.origination_outcome,
            assigned_to: deal.assigned_to,
            created_at: deal.created_at,
            updated_at: deal.updated_at,
        };
        // Render the template
        const rendered = this.templateService.render({
            template_id: input.template_id,
            deal: dealContext,
            overrides: input.overrides,
        });
        const id = crypto.randomUUID();
        const now = this.getNow();
        const artifact = {
            id,
            template_id: input.template_id,
            deal_id: input.deal_id,
            template_version: rendered.template_version,
            markdown: rendered.markdown,
            frozen_at: now,
        };
        await this.db.insert(artifacts).values(artifact);
        // Record audit event
        await this.audit.record({
            deal_id: input.deal_id,
            type: "ARTIFACT_FROZEN",
            actor,
            timestamp: now,
            object_type: "artifact",
            object_id: id,
            metadata: {
                template_id: input.template_id,
                template_version: rendered.template_version,
            },
        });
        return artifact;
    }
    async listByDeal(dealId) {
        const rows = await this.db
            .select()
            .from(artifacts)
            .where(eq(artifacts.deal_id, dealId));
        return rows;
    }
    async getById(id) {
        const rows = await this.db.select().from(artifacts).where(eq(artifacts.id, id));
        if (rows.length === 0) {
            throw new NotFoundError(`Artifact ${id} not found`);
        }
        return rows[0];
    }
}
//# sourceMappingURL=artifact.js.map