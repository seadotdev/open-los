import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServiceContext } from "../context.js";
import { toolResult, toolError } from "../helpers.js";

// Schemas

export const loanCreateSchema = {
  deal_id: z.string(),
  facility_id: z.string().optional(),
  loan_amount: z.number().describe("Loan amount in cents (minor units)"),
  interest_rate: z.number().optional().describe("Rate as decimal, e.g. 0.095 = 9.5%"),
  term_months: z.number().optional(),
  account_holder_id: z.string().optional().describe("Entity ID of the account holder"),
  account_holder_type: z.string().optional().default("CLIENT").describe("Account holder type"),
  tenant_id: z.string().optional().default("default"),
  actor: z.string().optional().default("mcp-agent"),
};

export const loanGetSchema = {
  id: z.string(),
  tenant_id: z.string().optional().default("default"),
};

export const loanBalanceSchema = {
  id: z.string(),
  tenant_id: z.string().optional().default("default"),
};

export const loanScheduleSchema = {
  id: z.string(),
  tenant_id: z.string().optional().default("default"),
};

export const loanTransactSchema = {
  id: z.string(),
  type: z.string().describe("Transaction type: APPROVAL, DISBURSEMENT, REPAYMENT, FEE, INTEREST_APPLIED, WRITE_OFF, PENDING_APPROVAL, REJECT, WITHDRAW, LOCK, UNLOCK, CLOSE"),
  amount: z.number().optional().describe("Amount in cents (minor units)"),
  value_date: z.string().optional().describe("ISO date string"),
  notes: z.string().optional(),
  sub_state: z.string().optional().describe("For CLOSE: WITHDRAWN, REJECTED, WRITTEN_OFF, PAID_OFF, REFINANCED, RESCHEDULED"),
  tenant_id: z.string().optional().default("default"),
  actor: z.string().optional().default("mcp-agent"),
};

// Handlers

export async function handleLoanCreate(
  ctx: ServiceContext,
  params: {
    deal_id: string;
    facility_id?: string;
    loan_amount: number;
    interest_rate?: number;
    term_months?: number;
    account_holder_id?: string;
    account_holder_type?: string;
    tenant_id?: string;
    actor?: string;
  }
) {
  const { tenant_id = "default", actor = "mcp-agent", ...rest } = params;
  return ctx.loanAccountService.create(
    {
      ...rest,
      account_holder_type: rest.account_holder_type ?? "CLIENT",
      account_holder_id: rest.account_holder_id ?? "default",
    },
    actor,
    tenant_id
  );
}

export async function handleLoanGet(
  ctx: ServiceContext,
  params: { id: string; tenant_id?: string }
) {
  return ctx.loanAccountService.getById(params.id, params.tenant_id ?? "default");
}

export async function handleLoanBalance(
  ctx: ServiceContext,
  params: { id: string; tenant_id?: string }
) {
  return ctx.loanAccountService.getBalance(params.id, params.tenant_id ?? "default");
}

export async function handleLoanSchedule(
  ctx: ServiceContext,
  params: { id: string; tenant_id?: string }
) {
  return ctx.loanAccountService.getSchedule(params.id, params.tenant_id ?? "default");
}

type LoanSubState = "WITHDRAWN" | "REJECTED" | "WRITTEN_OFF" | "PAID_OFF" | "REFINANCED" | "RESCHEDULED";

export async function handleLoanTransact(
  ctx: ServiceContext,
  params: {
    id: string;
    type: string;
    amount?: number;
    value_date?: string;
    notes?: string;
    sub_state?: string;
    tenant_id?: string;
    actor?: string;
  }
) {
  const { id: loanId, tenant_id: tenantId = "default", actor = "mcp-agent" } = params;

  // Gate checks for one-way-door transaction types
  const GATED_TYPES: Record<string, string> = {
    APPROVAL: "loan.approve",
    DISBURSEMENT: "loan.disburse",
    WRITE_OFF: "loan.write_off",
    CLOSE: "loan.close",
  };

  const gateAction = GATED_TYPES[params.type];
  if (gateAction) {
    const gateContext = await ctx.approvalGateService.buildLoanContext(loanId, tenantId);
    await ctx.approvalGateService.check(gateAction, gateContext, actor, undefined, tenantId);
  }

  switch (params.type) {
    case "PENDING_APPROVAL":
      return ctx.loanAccountService.requestApproval(loanId, params.notes ?? "", actor, tenantId);
    case "APPROVAL":
      return ctx.loanAccountService.approve(loanId, params.notes ?? "", actor, tenantId);
    case "REJECT":
      return ctx.loanAccountService.reject(loanId, params.notes ?? "", actor, tenantId);
    case "WITHDRAW":
      return ctx.loanAccountService.withdraw(loanId, params.notes ?? "", actor, tenantId);
    case "LOCK":
      return ctx.loanAccountService.lock(loanId, params.notes ?? "", actor, tenantId);
    case "UNLOCK":
      return ctx.loanAccountService.unlock(loanId, params.notes ?? "", actor, tenantId);
    case "CLOSE":
      return ctx.loanAccountService.close(
        loanId,
        (params.sub_state ?? "PAID_OFF") as LoanSubState,
        params.notes ?? "",
        actor,
        tenantId
      );
    case "DISBURSEMENT":
      return ctx.loanAccountService.disburse(
        loanId,
        { amount: params.amount!, value_date: params.value_date!, notes: params.notes },
        actor,
        tenantId
      );
    case "REPAYMENT":
      return ctx.loanAccountService.repay(
        loanId,
        { amount: params.amount!, value_date: params.value_date!, notes: params.notes },
        actor,
        tenantId
      );
    case "FEE":
      return ctx.loanAccountService.applyFee(
        loanId,
        { amount: params.amount!, value_date: params.value_date!, notes: params.notes },
        actor,
        tenantId
      );
    case "INTEREST_APPLIED":
      return ctx.loanAccountService.applyInterest(
        loanId,
        params.value_date ?? new Date().toISOString().split("T")[0],
        actor,
        tenantId
      );
    case "WRITE_OFF":
      return ctx.loanAccountService.writeOff(loanId, params.notes ?? "", actor, tenantId);
    default:
      throw new Error(`Unsupported transaction type: ${params.type}`);
  }
}

// MCP registration

export function registerLoanTools(server: McpServer, ctx: ServiceContext) {
  server.tool(
    "loan.create",
    "Create a loan account for a deal. Amounts in cents.",
    loanCreateSchema,
    async (params) => {
      try {
        return toolResult(await handleLoanCreate(ctx, params));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "loan.get",
    "Get loan account details by ID",
    loanGetSchema,
    async (params) => {
      try {
        return toolResult(await handleLoanGet(ctx, params));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "loan.balance",
    "Get loan account balance",
    loanBalanceSchema,
    async (params) => {
      try {
        return toolResult(await handleLoanBalance(ctx, params));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "loan.schedule",
    "Get loan repayment schedule",
    loanScheduleSchema,
    async (params) => {
      try {
        return toolResult(await handleLoanSchedule(ctx, params));
      } catch (err) {
        return toolError(err);
      }
    }
  );

  server.tool(
    "loan.transact",
    "Record a loan transaction (state change or financial operation). Types: PENDING_APPROVAL, APPROVAL, REJECT, WITHDRAW, LOCK, UNLOCK, CLOSE, DISBURSEMENT, REPAYMENT, FEE, INTEREST_APPLIED, WRITE_OFF. Amounts in cents.",
    loanTransactSchema,
    async (params) => {
      try {
        return toolResult(await handleLoanTransact(ctx, params));
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
