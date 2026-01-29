import { eq, and } from "drizzle-orm";
import { approvalRequests, deals } from "../schema/tables.js";
import { NotFoundError, ValidationError, ForbiddenError } from "./errors.js";
const VALID_TYPES = ["stage_transition", "facility_approval", "covenant_waiver"];
const VALID_STATUSES = ["pending", "approved", "rejected", "cancelled"];
export class ApprovalService {
    db;
    audit;
    getNow;
    constructor(db, audit, getNow) {
        this.db = db;
        this.audit = audit;
        this.getNow = getNow;
    }
    async request(dealId, input, requestedBy) {
        // Validate deal exists
        const dealRows = await this.db.select().from(deals).where(eq(deals.id, dealId));
        if (dealRows.length === 0) {
            throw new NotFoundError(`Deal ${dealId} not found`);
        }
        // Validate required fields
        if (!input.type) {
            throw new ValidationError("type is required");
        }
        if (!VALID_TYPES.includes(input.type)) {
            throw new ValidationError(`Invalid approval request type: ${input.type}. Must be one of: ${VALID_TYPES.join(", ")}`);
        }
        const id = crypto.randomUUID();
        const now = this.getNow();
        const requestRow = {
            id,
            deal_id: dealId,
            type: input.type,
            requested_by: requestedBy,
            requested_at: now,
            status: "pending",
            decided_by: null,
            decided_at: null,
            decision_rationale: null,
            payload: input.payload ?? null,
        };
        await this.db.insert(approvalRequests).values(requestRow);
        await this.audit.record({
            deal_id: dealId,
            type: "APPROVAL_REQUESTED",
            actor: requestedBy,
            timestamp: now,
            object_type: "approval_request",
            object_id: id,
            metadata: {
                request_id: id,
                request_type: input.type,
            },
        });
        return {
            id,
            deal_id: dealId,
            type: input.type,
            requested_by: requestedBy,
            requested_at: now,
            status: "pending",
            payload: input.payload,
        };
    }
    async getById(dealId, requestId) {
        const rows = await this.db
            .select()
            .from(approvalRequests)
            .where(and(eq(approvalRequests.id, requestId), eq(approvalRequests.deal_id, dealId)));
        if (rows.length === 0) {
            throw new NotFoundError(`Approval request ${requestId} not found`);
        }
        return rows[0];
    }
    async list(dealId, filters) {
        // Validate deal exists
        const dealRows = await this.db.select().from(deals).where(eq(deals.id, dealId));
        if (dealRows.length === 0) {
            throw new NotFoundError(`Deal ${dealId} not found`);
        }
        let rows = await this.db.select().from(approvalRequests).where(eq(approvalRequests.deal_id, dealId));
        if (filters?.status) {
            rows = rows.filter((r) => r.status === filters.status);
        }
        if (filters?.type) {
            rows = rows.filter((r) => r.type === filters.type);
        }
        return { requests: rows };
    }
    async approve(dealId, requestId, decidedBy, rationale) {
        return this.decide(dealId, requestId, { decision: "approved", rationale }, decidedBy);
    }
    async reject(dealId, requestId, decidedBy, rationale) {
        return this.decide(dealId, requestId, { decision: "rejected", rationale }, decidedBy);
    }
    async decide(dealId, requestId, input, decidedBy) {
        const existing = await this.getById(dealId, requestId);
        if (existing.status !== "pending") {
            throw new ForbiddenError(`Cannot decide on approval request that is already ${existing.status}`);
        }
        const now = this.getNow();
        await this.db.update(approvalRequests).set({
            status: input.decision,
            decided_by: decidedBy,
            decided_at: now,
            decision_rationale: input.rationale ?? null,
        }).where(eq(approvalRequests.id, requestId));
        await this.audit.record({
            deal_id: dealId,
            type: input.decision === "approved" ? "APPROVAL_APPROVED" : "APPROVAL_REJECTED",
            actor: decidedBy,
            timestamp: now,
            object_type: "approval_request",
            object_id: requestId,
            metadata: {
                request_id: requestId,
                request_type: existing.type,
                rationale: input.rationale,
            },
        });
        return this.getById(dealId, requestId);
    }
    async cancel(dealId, requestId, cancelledBy) {
        const existing = await this.getById(dealId, requestId);
        if (existing.status !== "pending") {
            throw new ForbiddenError(`Cannot cancel approval request that is already ${existing.status}`);
        }
        // Only the requester can cancel
        if (existing.requested_by !== cancelledBy) {
            throw new ForbiddenError("Only the requester can cancel an approval request");
        }
        const now = this.getNow();
        await this.db.update(approvalRequests).set({
            status: "cancelled",
            decided_by: cancelledBy,
            decided_at: now,
        }).where(eq(approvalRequests.id, requestId));
        await this.audit.record({
            deal_id: dealId,
            type: "APPROVAL_CANCELLED",
            actor: cancelledBy,
            timestamp: now,
            object_type: "approval_request",
            object_id: requestId,
            metadata: {
                request_id: requestId,
                request_type: existing.type,
            },
        });
        return this.getById(dealId, requestId);
    }
}
//# sourceMappingURL=approval.js.map