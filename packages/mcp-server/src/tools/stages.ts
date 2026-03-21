import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServiceContext } from "../context.js";
import { toolResult, toolError } from "../helpers.js";

// Schemas

export const stageTransitionSchema = {
  deal_id: z.string(),
  to_stage: z.string().describe("Target stage: origination, underwriting, closing, monitoring"),
  rationale: z.string().optional(),
  override: z.boolean().optional().describe("Override failed guards"),
  override_rationale: z.string().optional(),
  actor: z.string().optional().default("mcp-agent"),
  tenant_id: z.string().optional().default("default"),
};

export const stageHistorySchema = {
  deal_id: z.string(),
  tenant_id: z.string().optional().default("default"),
};

// Handlers

export async function handleStageTransition(
  ctx: ServiceContext,
  params: {
    deal_id: string;
    to_stage: string;
    rationale?: string;
    override?: boolean;
    override_rationale?: string;
    actor?: string;
    tenant_id?: string;
  }
) {
  const {
    deal_id: dealId,
    actor = "mcp-agent",
    tenant_id: tenantId = "default",
    ...body
  } = params;

  // Determine the gate action
  const gateAction = body.override
    ? "deal.stage_override"
    : "deal.stage_advance";

  // Check approval gate before proceeding
  const gateContext = await ctx.approvalGateService.buildDealContext(dealId, tenantId);
  await ctx.approvalGateService.check(
    gateAction,
    gateContext,
    actor,
    undefined,
    tenantId
  );

  // In sandbox mode, the actor is the authorized user
  const user = { id: actor, role: "credit_lead" };
  return ctx.stageService.transition(dealId, body, actor, user, tenantId);
}

export async function handleStageHistory(
  ctx: ServiceContext,
  params: { deal_id: string; tenant_id?: string }
) {
  return ctx.stageService.listByDeal(params.deal_id, params.tenant_id ?? "default");
}

// MCP registration

export function registerStageTools(server: McpServer, ctx: ServiceContext) {
  server.tool(
    "deal.transition_stage",
    "Transition a deal to a new stage. Checks approval gates and stage guards automatically.",
    stageTransitionSchema,
    async (params) => {
      try {
        return toolResult(await handleStageTransition(ctx, params));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "deal.history",
    "Get stage transition history for a deal",
    stageHistorySchema,
    async (params) => {
      try {
        return toolResult(await handleStageHistory(ctx, params));
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
