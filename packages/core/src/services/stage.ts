import { eq, asc } from "drizzle-orm";
import type { Database } from "../schema/db.js";
import { deals, documents, spreads, stageTransitions } from "../schema/tables.js";
import type { AuditService } from "./audit.js";
import type { TenantSettingsService } from "./tenant-settings.js";
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
  spreadCount: number;
}

/** Stage guard configuration */
export interface StageGuard {
  item: string;
  category: "core" | "optional";
  check: (ctx: GuardContext) => boolean;
}

/**
 * Stage guards configuration: defines what must be satisfied before entering each stage.
 * Each guard has an item name, a category (core guards are always enforced,
 * optional guards can be disabled per tenant), and a check function.
 */
export const STAGE_GUARDS: Record<string, StageGuard[]> = {
  origination: [
    { item: "borrower_name", category: "core", check: (ctx) => !!ctx.deal.borrower_name },
    { item: "jurisdiction", category: "core", check: (ctx) => !!ctx.deal.jurisdiction },
    { item: "requested_amount", category: "core", check: (ctx) => ctx.deal.requested_amount != null },
    { item: "purpose", category: "core", check: (ctx) => !!ctx.deal.purpose },
  ],
  underwriting: [
    { item: "origination_outcome_proceed", category: "core", check: (ctx) => ctx.deal.origination_outcome === "proceed" },
    { item: "documents_uploaded", category: "optional", check: (ctx) => ctx.docCount >= 1 },
    { item: "spread_created", category: "optional", check: (ctx) => ctx.spreadCount >= 1 },
  ],
  closing: [
    { item: "deal_in_underwriting", category: "core", check: (ctx) => ctx.deal.stage === "underwriting" },
  ],
  monitoring: [
    { item: "deal_in_closing", category: "core", check: (ctx) => ctx.deal.stage === "closing" },
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
  private tenantSettingsService?: TenantSettingsService;

  constructor(
    private db: Database,
    private audit: AuditService,
    private getNow: () => string,
    tenantSettingsService?: TenantSettingsService,
  ) {
    this.tenantSettingsService = tenantSettingsService;
  }

  async transition(
    dealId: string,
    input: TransitionInput,
    actor: string,
    user?: UserContext
  ) {
    return this.db.transaction(async (tx) => {
      const rows = await tx.select().from(deals).where(eq(deals.id, dealId));
      if (rows.length === 0) {
        throw new InvalidTransitionError(`Deal ${dealId} not found`);
      }
      const deal = rows[0];
      const fromStage = deal.stage;
      const toStage = input.to_stage;

      const effectiveUser =
        user ?? (actor === "system" ? { id: "system", role: "credit_lead" } : undefined);
      if (!effectiveUser) {
        throw new ForbiddenError(`Actor '${actor}' is not authorized to transition stages`, {
          actor,
        });
      }

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
      if (allowedRoles) {
        if (input.override) {
          if (effectiveUser.role !== "credit_lead") {
            throw new ForbiddenError(`Only credit_lead can override transitions`, {
              required_roles: ["credit_lead"],
              actor_role: effectiveUser.role,
            });
          }
        } else if (!allowedRoles.includes(effectiveUser.role)) {
          throw new ForbiddenError(
            `Role '${effectiveUser.role}' is not permitted to transition from ${fromStage} to ${toStage}`,
            { required_roles: allowedRoles, actor_role: effectiveUser.role }
          );
        }
      }

      // 3. Check stage guards
      const docRows = await tx
        .select()
        .from(documents)
        .where(eq(documents.deal_id, dealId));

      const spreadRows = await tx
        .select()
        .from(spreads)
        .where(eq(spreads.deal_id, dealId));

      const tenantId = (deal as Record<string, unknown>).tenant_id as string | undefined;
      const checklist = await this._evaluateGuards(deal, toStage, docRows.length, spreadRows.length, tenantId);
      const unsatisfied = checklist.filter((c) => !c.satisfied);

      if (unsatisfied.length > 0) {
        if (input.override) {
          // Verify override is valid
          if (effectiveUser.role !== "credit_lead") {
            throw new ForbiddenError(`Only credit_lead can override transitions`, {
              required_roles: ["credit_lead"],
            });
          }
          if (!input.override_rationale || input.override_rationale.trim() === "") {
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
        if (effectiveUser.role !== "credit_lead") {
          throw new ForbiddenError(`Only credit_lead can override transitions`, {
            required_roles: ["credit_lead"],
          });
        }
        if (!input.override_rationale || input.override_rationale.trim() === "") {
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

      await tx.insert(stageTransitions).values(transition);

      // Update deal stage
      await tx
        .update(deals)
        .set({ stage: toStage, updated_at: now })
        .where(eq(deals.id, dealId));

      // Record audit event
      await this.audit.record(
        {
          deal_id: dealId,
          type: "STAGE_TRANSITION",
          actor,
          timestamp: now,
          object_type: "deal",
          object_id: dealId,
          changes: [{ field: "stage", before: fromStage, after: toStage }],
        },
        tx
      );

      return transition;
    });
  }

  async listByDeal(dealId: string) {
    const rows = await this.db
      .select()
      .from(stageTransitions)
      .where(eq(stageTransitions.deal_id, dealId))
      .orderBy(asc(stageTransitions.transitioned_at));

    return rows;
  }

  /**
   * Public entry point: fetch deal + counts and return the guard checklist.
   */
  async getChecklist(
    dealId: string,
    toStage: string,
    tenantId?: string,
  ): Promise<Array<{ item: string; satisfied: boolean }>> {
    const rows = await this.db.select().from(deals).where(eq(deals.id, dealId));
    if (rows.length === 0) {
      return [];
    }
    const deal = rows[0];
    const docRows = await this.db.select().from(documents).where(eq(documents.deal_id, dealId));
    const spreadRows = await this.db.select().from(spreads).where(eq(spreads.deal_id, dealId));
    return this._evaluateGuards(deal, toStage, docRows.length, spreadRows.length, tenantId);
  }

  private async _evaluateGuards(
    deal: Record<string, unknown>,
    toStage: string,
    docCount: number,
    spreadCount: number = 0,
    tenantId?: string,
  ): Promise<Array<{ item: string; satisfied: boolean }>> {
    const guards = STAGE_GUARDS[toStage];
    if (!guards) {
      return [];
    }

    // Look up disabled guards for this tenant (optional guards only)
    let disabledGuards: Set<string> = new Set();
    if (tenantId && this.tenantSettingsService) {
      disabledGuards = await this.tenantSettingsService.getDisabledGuards(tenantId);
    }

    const ctx: GuardContext = { deal, docCount, spreadCount };
    return guards
      .filter((guard) => {
        // Core guards are always enforced; optional guards can be disabled
        if (guard.category === "optional" && disabledGuards.has(guard.item)) {
          return false;
        }
        return true;
      })
      .map((guard) => ({
        item: guard.item,
        satisfied: guard.check(ctx),
      }));
  }
}
