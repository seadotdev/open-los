import { eq, and } from "drizzle-orm";
import type { Database } from "../schema/db.js";
import { approvalGatePolicies, approvalGateRecords, deals, facilities, loanAccounts } from "../schema/tables.js";
import type { AuditService } from "./audit.js";
import { NotFoundError, ValidationError, ForbiddenError, GateRequiredError } from "./errors.js";

// ─── Constants ─────────────────────────────────────────────────────────────────

/** All gated actions — each corresponds to a one-way door in the lending workflow */
export const GATE_ACTIONS = [
  "deal.stage_advance",    // advancing deal to next stage
  "deal.stage_override",   // overriding stage guards
  "loan.approve",          // approving a loan account
  "loan.disburse",         // disbursing loan funds
  "loan.write_off",        // writing off a loan
  "loan.close",            // closing a loan account
  "facility.approve",      // changing facility status to approved
  "facility.delete",       // deleting a facility
  "covenant.waive",        // creating a covenant waiver
] as const;

export type GateAction = (typeof GATE_ACTIONS)[number];

export const GATE_MODES = ["auto", "human", "dual"] as const;
export type GateMode = (typeof GATE_MODES)[number];

export const GATE_RECORD_STATUSES = ["pending", "approved", "rejected", "expired", "bypassed"] as const;
export type GateRecordStatus = (typeof GATE_RECORD_STATUSES)[number];

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface CreateGatePolicyInput {
  loan_line?: string;
  action: string;
  mode: string;
  min_amount?: number;
  stages?: string[];
  approver_roles?: string[];
  priority?: number;
  enabled?: boolean;
}

export interface UpdateGatePolicyInput {
  mode?: string;
  min_amount?: number | null;
  stages?: string[] | null;
  approver_roles?: string[] | null;
  priority?: number;
  enabled?: boolean;
}

export interface GateCheckContext {
  deal_id?: string;
  deal_stage?: string;
  amount?: number;
  facility_type?: string;
  loan_id?: string;
  [key: string]: unknown;
}

export interface GateCheckResult {
  allowed: boolean;
  mode: GateMode;
  policy_id: string;
  gate_record_id?: string;
  message: string;
}

export interface ApprovalDecision {
  decision: "approved" | "rejected";
  rationale?: string;
}

interface GateApproval {
  actor: string;
  decision: string;
  rationale?: string;
  at: string;
}

// ─── Service ───────────────────────────────────────────────────────────────────

export class ApprovalGateService {
  constructor(
    private db: Database,
    private audit: AuditService,
    private getNow: () => string
  ) {}

  // ─── Policy CRUD ──────────────────────────────────────────────────────────

  async createPolicy(input: CreateGatePolicyInput, actor: string, tenantId = "default") {
    // Validate action
    if (!input.action) {
      throw new ValidationError("action is required");
    }
    if (!GATE_ACTIONS.includes(input.action as GateAction)) {
      throw new ValidationError(
        `Invalid action: ${input.action}. Must be one of: ${GATE_ACTIONS.join(", ")}`
      );
    }

    // Validate mode
    if (!input.mode) {
      throw new ValidationError("mode is required");
    }
    if (!GATE_MODES.includes(input.mode as GateMode)) {
      throw new ValidationError(
        `Invalid mode: ${input.mode}. Must be one of: ${GATE_MODES.join(", ")}`
      );
    }

    const id = crypto.randomUUID();
    const now = this.getNow();

    const row = {
      id,
      tenant_id: tenantId,
      loan_line: input.loan_line ?? null,
      action: input.action,
      mode: input.mode,
      min_amount: input.min_amount ?? null,
      stages: input.stages ?? null,
      approver_roles: input.approver_roles ?? null,
      priority: input.priority ?? 0,
      enabled: input.enabled !== false,
      created_at: now,
      updated_at: now,
    };

    await this.db.insert(approvalGatePolicies).values(row);

    return {
      id,
      tenant_id: tenantId,
      loan_line: input.loan_line ?? null,
      action: input.action,
      mode: input.mode,
      min_amount: input.min_amount ?? null,
      stages: input.stages ?? null,
      approver_roles: input.approver_roles ?? null,
      priority: input.priority ?? 0,
      enabled: input.enabled !== false,
      created_at: now,
      updated_at: now,
    };
  }

  async getPolicy(policyId: string, tenantId = "default") {
    const rows = await this.db
      .select()
      .from(approvalGatePolicies)
      .where(
        and(
          eq(approvalGatePolicies.id, policyId),
          eq(approvalGatePolicies.tenant_id, tenantId)
        )
      );

    if (rows.length === 0) {
      throw new NotFoundError(`Approval gate policy ${policyId} not found`);
    }

    return rows[0];
  }

  async listPolicies(tenantId = "default", filters?: { action?: string; loan_line?: string; enabled?: boolean }) {
    let rows = await this.db
      .select()
      .from(approvalGatePolicies)
      .where(eq(approvalGatePolicies.tenant_id, tenantId));

    if (filters?.action) {
      rows = rows.filter((r) => r.action === filters.action);
    }
    if (filters?.loan_line !== undefined) {
      rows = rows.filter((r) => r.loan_line === filters.loan_line);
    }
    if (filters?.enabled !== undefined) {
      rows = rows.filter((r) => r.enabled === filters.enabled);
    }

    // Sort by priority descending then action
    rows.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return a.action.localeCompare(b.action);
    });

    return { policies: rows };
  }

  async updatePolicy(policyId: string, input: UpdateGatePolicyInput, tenantId = "default") {
    const existing = await this.getPolicy(policyId, tenantId);

    if (input.mode && !GATE_MODES.includes(input.mode as GateMode)) {
      throw new ValidationError(
        `Invalid mode: ${input.mode}. Must be one of: ${GATE_MODES.join(", ")}`
      );
    }

    const now = this.getNow();
    const updates: Record<string, unknown> = { updated_at: now };

    if (input.mode !== undefined) updates.mode = input.mode;
    if (input.min_amount !== undefined) updates.min_amount = input.min_amount;
    if (input.stages !== undefined) updates.stages = input.stages;
    if (input.approver_roles !== undefined) updates.approver_roles = input.approver_roles;
    if (input.priority !== undefined) updates.priority = input.priority;
    if (input.enabled !== undefined) updates.enabled = input.enabled;

    await this.db
      .update(approvalGatePolicies)
      .set(updates)
      .where(eq(approvalGatePolicies.id, policyId));

    return this.getPolicy(policyId, tenantId);
  }

  async deletePolicy(policyId: string, tenantId = "default") {
    await this.getPolicy(policyId, tenantId); // ensure exists

    // Check for pending records
    const pendingRecords = await this.db
      .select()
      .from(approvalGateRecords)
      .where(
        and(
          eq(approvalGateRecords.policy_id, policyId),
          eq(approvalGateRecords.status, "pending")
        )
      );

    if (pendingRecords.length > 0) {
      throw new ValidationError(
        `Cannot delete policy with ${pendingRecords.length} pending gate record(s). Resolve them first.`
      );
    }

    // Soft-delete: disable rather than remove to preserve audit history
    await this.db
      .update(approvalGatePolicies)
      .set({ enabled: false, updated_at: this.getNow() })
      .where(eq(approvalGatePolicies.id, policyId));
  }

  // ─── Gate Enforcement ─────────────────────────────────────────────────────

  /**
   * Check whether an action requires gate approval.
   * Call this before executing a one-way-door operation.
   *
   * Returns { allowed: true } if no gate applies or if the gate mode is "auto".
   * Throws GateRequiredError if approval is needed and no approved gate record exists.
   */
  async check(
    action: string,
    context: GateCheckContext,
    actor: string,
    approvedGateRecordId?: string,
    tenantId = "default"
  ): Promise<GateCheckResult> {
    // If a pre-approved gate record ID is provided, verify it
    if (approvedGateRecordId) {
      return this.verifyApprovedRecord(approvedGateRecordId, action, tenantId);
    }

    // Find matching policy
    const policy = await this.resolvePolicy(action, context, tenantId);

    // No policy = no gate required
    if (!policy) {
      return { allowed: true, mode: "auto", policy_id: "", message: "No gate policy applies" };
    }

    // Auto mode = no gate required
    if (policy.mode === "auto") {
      return { allowed: true, mode: "auto", policy_id: policy.id, message: "Gate mode is auto" };
    }

    // Gate required — create a pending record and throw
    const recordId = await this.createGateRecord(policy, action, context, actor, tenantId);

    throw new GateRequiredError(
      `Approval required: ${action} requires ${policy.mode} approval`,
      {
        gate_record_id: recordId,
        policy_id: policy.id,
        action,
        mode: policy.mode,
        approver_roles: policy.approver_roles,
        context,
      }
    );
  }

  /**
   * Resolve which policy applies for a given action and context.
   * Uses priority ordering: loan-line-specific > org-wide, higher priority > lower.
   */
  private async resolvePolicy(
    action: string,
    context: GateCheckContext,
    tenantId: string
  ) {
    const allPolicies = await this.db
      .select()
      .from(approvalGatePolicies)
      .where(
        and(
          eq(approvalGatePolicies.tenant_id, tenantId),
          eq(approvalGatePolicies.action, action),
          eq(approvalGatePolicies.enabled, true)
        )
      );

    if (allPolicies.length === 0) return null;

    // Filter by context conditions
    const matching = allPolicies.filter((p) => {
      // Check loan_line scope
      if (p.loan_line && context.facility_type && p.loan_line !== context.facility_type) {
        return false;
      }

      // Check amount threshold
      if (p.min_amount && context.amount !== undefined && context.amount < p.min_amount) {
        return false;
      }

      // Check stage restriction
      if (p.stages && context.deal_stage) {
        const stages = p.stages as string[];
        if (!stages.includes(context.deal_stage)) {
          return false;
        }
      }

      return true;
    });

    if (matching.length === 0) return null;

    // Sort: loan_line-specific first, then by priority descending
    matching.sort((a, b) => {
      // Specific loan_line > null (org-wide)
      if (a.loan_line && !b.loan_line) return -1;
      if (!a.loan_line && b.loan_line) return 1;
      // Higher priority wins
      return b.priority - a.priority;
    });

    return matching[0];
  }

  private async createGateRecord(
    policy: typeof approvalGatePolicies.$inferSelect,
    action: string,
    context: GateCheckContext,
    actor: string,
    tenantId: string
  ): Promise<string> {
    const id = crypto.randomUUID();
    const now = this.getNow();

    // Default expiry: 7 days for human, 14 days for dual
    const expiryDays = policy.mode === "dual" ? 14 : 7;
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    await this.db.insert(approvalGateRecords).values({
      id,
      tenant_id: tenantId,
      policy_id: policy.id,
      deal_id: context.deal_id ?? null,
      action,
      actor,
      status: "pending",
      context_snapshot: context,
      approvals: [],
      decided_by: null,
      decided_at: null,
      decision_rationale: null,
      expires_at: expiresAt.toISOString(),
      created_at: now,
      updated_at: now,
    });

    // Audit trail
    if (context.deal_id) {
      await this.audit.record({
        deal_id: context.deal_id,
        type: "GATE_REQUIRED",
        actor,
        timestamp: now,
        object_type: "approval_gate_record",
        object_id: id,
        metadata: {
          action,
          mode: policy.mode,
          policy_id: policy.id,
          context,
        },
      });
    }

    return id;
  }

  private async verifyApprovedRecord(
    recordId: string,
    action: string,
    tenantId: string
  ): Promise<GateCheckResult> {
    const rows = await this.db
      .select()
      .from(approvalGateRecords)
      .where(
        and(
          eq(approvalGateRecords.id, recordId),
          eq(approvalGateRecords.tenant_id, tenantId)
        )
      );

    if (rows.length === 0) {
      throw new NotFoundError(`Gate record ${recordId} not found`);
    }

    const record = rows[0];

    if (record.action !== action) {
      throw new ValidationError(
        `Gate record ${recordId} is for action '${record.action}', not '${action}'`
      );
    }

    if (record.status !== "approved" && record.status !== "bypassed") {
      throw new ForbiddenError(
        `Gate record ${recordId} has status '${record.status}', expected 'approved' or 'bypassed'`
      );
    }

    // Check expiry
    if (record.expires_at && new Date(record.expires_at) < new Date(this.getNow())) {
      throw new ForbiddenError(`Gate record ${recordId} has expired`);
    }

    return {
      allowed: true,
      mode: "human", // The approval was provided
      policy_id: record.policy_id,
      gate_record_id: recordId,
      message: "Gate approval verified",
    };
  }

  // ─── Gate Record Management ───────────────────────────────────────────────

  async getGateRecord(recordId: string, tenantId = "default") {
    const rows = await this.db
      .select()
      .from(approvalGateRecords)
      .where(
        and(
          eq(approvalGateRecords.id, recordId),
          eq(approvalGateRecords.tenant_id, tenantId)
        )
      );

    if (rows.length === 0) {
      throw new NotFoundError(`Gate record ${recordId} not found`);
    }

    return rows[0];
  }

  async listGateRecords(
    tenantId = "default",
    filters?: { status?: string; deal_id?: string; action?: string }
  ) {
    let rows = await this.db
      .select()
      .from(approvalGateRecords)
      .where(eq(approvalGateRecords.tenant_id, tenantId));

    if (filters?.status) {
      rows = rows.filter((r) => r.status === filters.status);
    }
    if (filters?.deal_id) {
      rows = rows.filter((r) => r.deal_id === filters.deal_id);
    }
    if (filters?.action) {
      rows = rows.filter((r) => r.action === filters.action);
    }

    // Sort by created_at descending
    rows.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return { records: rows };
  }

  /**
   * Approve or reject a pending gate record.
   * For "dual" mode, requires two separate approvers.
   */
  async decide(
    recordId: string,
    input: ApprovalDecision,
    decidedBy: string,
    tenantId = "default"
  ) {
    const record = await this.getGateRecord(recordId, tenantId);

    if (record.status !== "pending") {
      throw new ForbiddenError(
        `Cannot decide on gate record that is already '${record.status}'`
      );
    }

    // Check expiry
    if (record.expires_at && new Date(record.expires_at) < new Date(this.getNow())) {
      // Mark as expired
      await this.db
        .update(approvalGateRecords)
        .set({ status: "expired", updated_at: this.getNow() })
        .where(eq(approvalGateRecords.id, recordId));
      throw new ForbiddenError(`Gate record ${recordId} has expired`);
    }

    // Cannot approve your own request
    if (record.actor === decidedBy) {
      throw new ForbiddenError(
        "Cannot approve your own gate request (maker-checker principle)"
      );
    }

    // Check approver role if policy specifies roles
    const policy = await this.getPolicy(record.policy_id, tenantId);
    // Note: Role checking would be done by the caller who has user context

    const now = this.getNow();
    const existingApprovals = (record.approvals as GateApproval[] | null) ?? [];

    // Check if this person already approved
    if (existingApprovals.some((a) => a.actor === decidedBy)) {
      throw new ForbiddenError("You have already provided a decision on this gate record");
    }

    const newApproval: GateApproval = {
      actor: decidedBy,
      decision: input.decision,
      rationale: input.rationale,
      at: now,
    };

    const updatedApprovals = [...existingApprovals, newApproval];

    // For rejections, immediately reject
    if (input.decision === "rejected") {
      await this.db
        .update(approvalGateRecords)
        .set({
          status: "rejected",
          approvals: updatedApprovals,
          decided_by: decidedBy,
          decided_at: now,
          decision_rationale: input.rationale ?? null,
          updated_at: now,
        })
        .where(eq(approvalGateRecords.id, recordId));

      if (record.deal_id) {
        await this.audit.record({
          deal_id: record.deal_id,
          type: "GATE_REJECTED",
          actor: decidedBy,
          timestamp: now,
          object_type: "approval_gate_record",
          object_id: recordId,
          metadata: {
            action: record.action,
            rationale: input.rationale,
          },
        });
      }

      return this.getGateRecord(recordId, tenantId);
    }

    // For approvals, check mode
    const requiredApprovals = policy.mode === "dual" ? 2 : 1;
    const approvedCount = updatedApprovals.filter((a) => a.decision === "approved").length;

    if (approvedCount >= requiredApprovals) {
      // Fully approved
      await this.db
        .update(approvalGateRecords)
        .set({
          status: "approved",
          approvals: updatedApprovals,
          decided_by: decidedBy,
          decided_at: now,
          decision_rationale: input.rationale ?? null,
          updated_at: now,
        })
        .where(eq(approvalGateRecords.id, recordId));

      if (record.deal_id) {
        await this.audit.record({
          deal_id: record.deal_id,
          type: "GATE_APPROVED",
          actor: decidedBy,
          timestamp: now,
          object_type: "approval_gate_record",
          object_id: recordId,
          metadata: {
            action: record.action,
            mode: policy.mode,
            approvals: updatedApprovals,
            rationale: input.rationale,
          },
        });
      }
    } else {
      // Partial approval (dual mode, first approver)
      await this.db
        .update(approvalGateRecords)
        .set({
          approvals: updatedApprovals,
          updated_at: now,
        })
        .where(eq(approvalGateRecords.id, recordId));

      if (record.deal_id) {
        await this.audit.record({
          deal_id: record.deal_id,
          type: "GATE_PARTIAL_APPROVAL",
          actor: decidedBy,
          timestamp: now,
          object_type: "approval_gate_record",
          object_id: recordId,
          metadata: {
            action: record.action,
            approvals_so_far: approvedCount,
            approvals_required: requiredApprovals,
          },
        });
      }
    }

    return this.getGateRecord(recordId, tenantId);
  }

  /**
   * Bypass a gate (emergency override). Requires explicit rationale.
   */
  async bypass(recordId: string, rationale: string, bypassedBy: string, tenantId = "default") {
    const record = await this.getGateRecord(recordId, tenantId);

    if (record.status !== "pending") {
      throw new ForbiddenError(
        `Cannot bypass gate record that is already '${record.status}'`
      );
    }

    if (!rationale || rationale.trim() === "") {
      throw new ValidationError("Rationale is required for gate bypass");
    }

    const now = this.getNow();

    await this.db
      .update(approvalGateRecords)
      .set({
        status: "bypassed",
        decided_by: bypassedBy,
        decided_at: now,
        decision_rationale: rationale,
        updated_at: now,
      })
      .where(eq(approvalGateRecords.id, recordId));

    if (record.deal_id) {
      await this.audit.record({
        deal_id: record.deal_id,
        type: "GATE_BYPASSED",
        actor: bypassedBy,
        timestamp: now,
        object_type: "approval_gate_record",
        object_id: recordId,
        metadata: {
          action: record.action,
          rationale,
        },
      });
    }

    return this.getGateRecord(recordId, tenantId);
  }

  // ─── Helpers for building context ─────────────────────────────────────────

  /**
   * Build gate check context from a deal.
   */
  async buildDealContext(dealId: string, tenantId = "default"): Promise<GateCheckContext> {
    const dealRows = await this.db
      .select()
      .from(deals)
      .where(and(eq(deals.id, dealId), eq(deals.tenant_id, tenantId)));
    if (dealRows.length === 0) {
      return { deal_id: dealId };
    }
    const deal = dealRows[0];
    return {
      deal_id: dealId,
      deal_stage: deal.stage,
      amount: deal.requested_amount ?? undefined,
    };
  }

  /**
   * Build gate check context from a loan account.
   */
  async buildLoanContext(loanId: string, tenantId = "default"): Promise<GateCheckContext> {
    const loanRows = await this.db
      .select()
      .from(loanAccounts)
      .where(and(eq(loanAccounts.id, loanId), eq(loanAccounts.tenant_id, tenantId)));
    if (loanRows.length === 0) {
      return { loan_id: loanId };
    }
    const loan = loanRows[0];

    // Look up facility type if linked
    let facilityType: string | undefined;
    if (loan.facility_id) {
      const facRows = await this.db
        .select()
        .from(facilities)
        .where(eq(facilities.id, loan.facility_id));
      if (facRows.length > 0) {
        facilityType = facRows[0].type;
      }
    }

    return {
      deal_id: loan.deal_id ?? undefined,
      deal_stage: undefined, // Could look up deal stage if needed
      amount: loan.loan_amount,
      facility_type: facilityType,
      loan_id: loanId,
    };
  }

  /**
   * Build gate check context from a facility.
   */
  async buildFacilityContext(dealId: string, facilityId: string): Promise<GateCheckContext> {
    const facRows = await this.db
      .select()
      .from(facilities)
      .where(eq(facilities.id, facilityId));
    if (facRows.length === 0) {
      return { deal_id: dealId };
    }
    const facility = facRows[0];

    const dealRows = await this.db.select().from(deals).where(eq(deals.id, dealId));
    const deal = dealRows[0];

    return {
      deal_id: dealId,
      deal_stage: deal?.stage,
      amount: facility.amount,
      facility_type: facility.type,
    };
  }
}
