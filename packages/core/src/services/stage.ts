import { eq, asc } from "drizzle-orm";
import type { Database } from "../schema/db.js";
import { deals, documents, stageTransitions } from "../schema/tables.js";
import type { AuditService } from "./audit.js";
import {
  StageGuardError,
  InvalidTransitionError,
  ForbiddenError,
  OverrideRequiredError,
} from "./errors.js";

const VALID_TRANSITIONS: Record<string, string> = {
  broker: "origination",
  origination: "underwriting",
  underwriting: "closing",
  closing: "monitoring",
};

/** Which roles can perform each transition (from → to) */
const TRANSITION_ROLES: Record<string, string[]> = {
  "broker→origination": ["originator", "credit_lead"],
  "origination→underwriting": ["underwriter", "credit_lead"],
  "underwriting→closing": ["closer", "credit_lead"],
  "closing→monitoring": ["monitor", "credit_lead"],
};

/** Context available for evaluating stage guards */
export interface GuardContext {
  deal: Record<string, unknown>;
  docCount: number;
}

/** Stage guard configuration */
export interface StageGuard {
  item: string;
  check: (ctx: GuardContext) => boolean;
}

/**
 * Stage guards configuration: defines what must be satisfied before entering each stage.
 * Each guard has an item name and a check function that receives the guard context.
 */
export const STAGE_GUARDS: Record<string, StageGuard[]> = {
  origination: [
    { item: "borrower_name", check: (ctx) => !!ctx.deal.borrower_name },
    { item: "jurisdiction", check: (ctx) => !!ctx.deal.jurisdiction },
    { item: "requested_amount", check: (ctx) => ctx.deal.requested_amount != null },
    { item: "purpose", check: (ctx) => !!ctx.deal.purpose },
  ],
  underwriting: [
    { item: "origination_outcome_proceed", check: (ctx) => ctx.deal.origination_outcome === "proceed" },
    { item: "documents_uploaded", check: (ctx) => ctx.docCount >= 1 },
  ],
  closing: [
    { item: "deal_in_underwriting", check: (ctx) => ctx.deal.stage === "underwriting" },
  ],
  monitoring: [
    { item: "deal_in_closing", check: (ctx) => ctx.deal.stage === "closing" },
  ],
};

interface TransitionInput {
  to_stage: string;
  rationale?: string;
  override?: boolean;
  override_rationale?: string;
}

export interface UserContext {
  id: string;
  role: string;
}

export class StageService {
  constructor(
    private db: Database,
    private audit: AuditService,
    private getNow: () => string
  ) {}

  async transition(
    dealId: string,
    input: TransitionInput,
    actor: string,
    user?: UserContext
  ) {
    const rows = await this.db
      .select()
      .from(deals)
      .where(eq(deals.id, dealId));
    if (rows.length === 0) {
      throw new InvalidTransitionError(`Deal ${dealId} not found`);
    }
    const deal = rows[0];
    const fromStage = deal.stage;
    const toStage = input.to_stage;

    // 1. Validate transition is a valid forward step
    const allowed = VALID_TRANSITIONS[fromStage];
    if (allowed !== toStage) {
      throw new InvalidTransitionError(
        `Cannot transition from ${fromStage} to ${toStage}`,
        { from_stage: fromStage, to_stage: toStage }
      );
    }

    // 2. Check role-based permissions
    const transitionKey = `${fromStage}→${toStage}`;
    const allowedRoles = TRANSITION_ROLES[transitionKey];
    if (user && allowedRoles) {
      if (input.override) {
        if (user.role !== "credit_lead") {
          throw new ForbiddenError(
            `Only credit_lead can override transitions`,
            { required_roles: ["credit_lead"], actor_role: user.role }
          );
        }
      } else if (!allowedRoles.includes(user.role)) {
        throw new ForbiddenError(
          `Role '${user.role}' is not permitted to transition from ${fromStage} to ${toStage}`,
          { required_roles: allowedRoles, actor_role: user.role }
        );
      }
    }

    // 3. Check stage guards
    const docRows = await this.db
      .select()
      .from(documents)
      .where(eq(documents.deal_id, dealId));

    const checklist = this.getChecklist(deal, toStage, docRows.length);
    const unsatisfied = checklist.filter((c) => !c.satisfied);

    if (unsatisfied.length > 0) {
      if (input.override) {
        // Verify override is valid
        if (!user || user.role !== "credit_lead") {
          throw new ForbiddenError(
            `Only credit_lead can override transitions`,
            { required_roles: ["credit_lead"] }
          );
        }
        if (
          !input.override_rationale ||
          input.override_rationale.trim() === ""
        ) {
          throw new OverrideRequiredError("Override requires a rationale", {
            missing: "override_rationale",
          });
        }
        // Override accepted — proceed despite unsatisfied guards
      } else {
        throw new StageGuardError(
          `Stage guard failed: ${unsatisfied.map((c) => c.item).join(", ")}`,
          { unsatisfied: unsatisfied.map((c) => c.item), checklist }
        );
      }
    }

    // 4. Validate override request format even when guards pass
    if (input.override) {
      if (!user || user.role !== "credit_lead") {
        throw new ForbiddenError(
          `Only credit_lead can override transitions`,
          { required_roles: ["credit_lead"] }
        );
      }
      if (
        !input.override_rationale ||
        input.override_rationale.trim() === ""
      ) {
        throw new OverrideRequiredError("Override requires a rationale", {
          missing: "override_rationale",
        });
      }
    }

    // 5. Record transition
    const id = crypto.randomUUID();
    const now = this.getNow();

    const transition = {
      id,
      deal_id: dealId,
      from_stage: fromStage,
      to_stage: toStage,
      actor,
      rationale: input.rationale ?? null,
      override: input.override ?? false,
      override_rationale: input.override_rationale ?? null,
      checklist_snapshot: checklist,
      transitioned_at: now,
    };

    await this.db.insert(stageTransitions).values(transition);

    // Update deal stage
    await this.db
      .update(deals)
      .set({ stage: toStage, updated_at: now })
      .where(eq(deals.id, dealId));

    // Record audit event
    await this.audit.record({
      deal_id: dealId,
      type: "STAGE_TRANSITION",
      actor,
      timestamp: now,
      object_type: "deal",
      object_id: dealId,
      changes: [{ field: "stage", before: fromStage, after: toStage }],
    });

    return transition;
  }

  async listByDeal(dealId: string) {
    const rows = await this.db
      .select()
      .from(stageTransitions)
      .where(eq(stageTransitions.deal_id, dealId))
      .orderBy(asc(stageTransitions.transitioned_at));

    return rows;
  }

  private getChecklist(
    deal: Record<string, unknown>,
    toStage: string,
    docCount: number
  ): Array<{ item: string; satisfied: boolean }> {
    const guards = STAGE_GUARDS[toStage];
    if (!guards) {
      return [];
    }

    const ctx: GuardContext = { deal, docCount };
    return guards.map((guard) => ({
      item: guard.item,
      satisfied: guard.check(ctx),
    }));
  }
}
