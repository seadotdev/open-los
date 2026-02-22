import { Hono } from "hono";
import type { AppContext } from "../server.js";
import { stripNulls } from "../utils.js";
import {
  createLoanAccountFromFacility,
  createApprovedLoanFromFacility,
  getLoanBalanceForDeal,
  checkDealArrearsStatus,
} from "@open-los/core";

export function loanRoutes(ctx: AppContext) {
  const app = new Hono();

  // ─── Loan Accounts ─────────────────────────────────────────────────────────

  // POST /v1/loans - create loan account
  app.post("/loans", async (c) => {
    const actor = c.req.header("X-Actor") ?? "system";
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const body = await c.req.json();
    const result = await ctx.loanAccountService.create(body, actor, tenantId);
    return c.json(stripNulls(result), 201);
  });

  // POST /v1/loans:search - search loan accounts
  app.post("/loans\\:search", async (c) => {
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const body = await c.req.json();
    const result = await ctx.loanAccountService.search(
      {
        filter_criteria: body.filterCriteria,
        sorting_criteria: body.sortingCriteria,
        limit: body.limit,
        cursor: body.cursor,
      },
      tenantId
    );
    return c.json(stripNulls(result), 200);
  });

  // GET /v1/loans/:loanId - get loan account
  app.get("/loans/:loanId", async (c) => {
    const loanId = c.req.param("loanId");
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const result = await ctx.loanAccountService.getById(loanId, tenantId);
    return c.json(stripNulls(result), 200);
  });

  // GET /v1/loans/by-account-id/:accountId - get loan by human-readable ID
  app.get("/loans/by-account-id/:accountId", async (c) => {
    const accountId = c.req.param("accountId");
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const result = await ctx.loanAccountService.getByAccountId(accountId, tenantId);
    return c.json(stripNulls(result), 200);
  });

  // GET /v1/loans/by-encoded-key/:encodedKey - get loan by Mambu-style key
  app.get("/loans/by-encoded-key/:encodedKey", async (c) => {
    const encodedKey = c.req.param("encodedKey");
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const result = await ctx.loanAccountService.getByEncodedKey(encodedKey, tenantId);
    return c.json(stripNulls(result), 200);
  });

  // PATCH /v1/loans/:loanId - update loan account
  app.patch("/loans/:loanId", async (c) => {
    const loanId = c.req.param("loanId");
    const actor = c.req.header("X-Actor") ?? "system";
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const body = await c.req.json();
    const result = await ctx.loanAccountService.update(loanId, body, actor, tenantId);
    return c.json(stripNulls(result), 200);
  });

  // GET /v1/loans/:loanId/balance - get loan balance
  app.get("/loans/:loanId/balance", async (c) => {
    const loanId = c.req.param("loanId");
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const result = await ctx.loanAccountService.getBalance(loanId, tenantId);
    return c.json(stripNulls(result), 200);
  });

  // ─── Loan Transactions (State Changes + Financial) ─────────────────────────

  // POST /v1/loans/:loanId/transactions - create transaction
  app.post("/loans/:loanId/transactions", async (c) => {
    const loanId = c.req.param("loanId");
    const actor = c.req.header("X-Actor") ?? "system";
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const idempotencyKey = c.req.header("Idempotency-Key");
    const gateRecordId = c.req.header("X-Gate-Record-Id");
    const body = await c.req.json();

    // ─── Gate checks for one-way-door transaction types ─────────────────
    const GATED_TYPES: Record<string, string> = {
      APPROVAL: "loan.approve",
      DISBURSEMENT: "loan.disburse",
      WRITE_OFF: "loan.write_off",
      CLOSE: "loan.close",
    };

    const gateAction = GATED_TYPES[body.type];
    if (gateAction) {
      const gateContext = await ctx.approvalGateService.buildLoanContext(loanId, tenantId);
      await ctx.approvalGateService.check(
        gateAction,
        gateContext,
        actor,
        gateRecordId ?? undefined,
        tenantId
      );
    }

    let result;

    switch (body.type) {
      // State transitions
      case "PENDING_APPROVAL":
        result = await ctx.loanAccountService.requestApproval(
          loanId,
          body.notes ?? "",
          actor,
          tenantId
        );
        break;

      case "APPROVAL":
        result = await ctx.loanAccountService.approve(
          loanId,
          body.notes ?? "",
          actor,
          tenantId
        );
        break;

      case "REJECT":
        result = await ctx.loanAccountService.reject(
          loanId,
          body.notes ?? "",
          actor,
          tenantId
        );
        break;

      case "WITHDRAW":
        result = await ctx.loanAccountService.withdraw(
          loanId,
          body.notes ?? "",
          actor,
          tenantId
        );
        break;

      case "LOCK":
        result = await ctx.loanAccountService.lock(
          loanId,
          body.notes ?? "",
          actor,
          tenantId
        );
        break;

      case "UNLOCK":
        result = await ctx.loanAccountService.unlock(
          loanId,
          body.notes ?? "",
          actor,
          tenantId
        );
        break;

      case "CLOSE":
        result = await ctx.loanAccountService.close(
          loanId,
          body.subState,
          body.notes ?? "",
          actor,
          tenantId
        );
        break;

      // Financial operations
      case "DISBURSEMENT":
        result = await ctx.loanAccountService.disburse(
          loanId,
          {
            amount: body.amount,
            value_date: body.valueDate,
            idempotency_key: idempotencyKey ?? body.idempotencyKey,
            disbursement_details: body.disbursementDetails,
            notes: body.notes,
          },
          actor,
          tenantId
        );
        break;

      case "REPAYMENT":
        result = await ctx.loanAccountService.repay(
          loanId,
          {
            amount: body.amount,
            value_date: body.valueDate,
            idempotency_key: idempotencyKey ?? body.idempotencyKey,
            custom_allocation: body.customPaymentAmounts,
            notes: body.notes,
          },
          actor,
          tenantId
        );
        break;

      case "FEE":
        result = await ctx.loanAccountService.applyFee(
          loanId,
          {
            amount: body.amount,
            value_date: body.valueDate,
            idempotency_key: idempotencyKey ?? body.idempotencyKey,
            notes: body.notes,
          },
          actor,
          tenantId
        );
        break;

      case "INTEREST_APPLIED":
        result = await ctx.loanAccountService.applyInterest(
          loanId,
          body.valueDate ?? body.asOfDate,
          actor,
          tenantId
        );
        break;

      case "WRITE_OFF":
        result = await ctx.loanAccountService.writeOff(
          loanId,
          body.notes ?? "",
          actor,
          tenantId
        );
        break;

      default:
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: `Unsupported transaction type: ${body.type}`,
            },
          },
          400
        );
    }

    return c.json(stripNulls(result), 201);
  });

  // GET /v1/loans/:loanId/transactions - list transactions
  app.get("/loans/:loanId/transactions", async (c) => {
    const loanId = c.req.param("loanId");
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const limit = c.req.query("limit")
      ? parseInt(c.req.query("limit")!, 10)
      : undefined;
    const cursor = c.req.query("cursor");
    const result = await ctx.loanAccountService.getTransactions(
      loanId,
      { limit, cursor },
      tenantId
    );
    return c.json(stripNulls(result), 200);
  });

  // POST /v1/loans/transactions:search - search transactions across accounts
  app.post("/loans/transactions\\:search", async (c) => {
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const body = await c.req.json();

    // This would require a more sophisticated search implementation
    // For now, return an error indicating it's not yet implemented
    return c.json(
      {
        error: {
          code: "NOT_IMPLEMENTED",
          message: "Cross-account transaction search is not yet implemented",
        },
      },
      501
    );
  });

  // ─── Repayment Schedule ────────────────────────────────────────────────────

  // GET /v1/loans/:loanId/schedule - get repayment schedule
  app.get("/loans/:loanId/schedule", async (c) => {
    const loanId = c.req.param("loanId");
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const result = await ctx.loanAccountService.getSchedule(loanId, tenantId);
    return c.json(stripNulls(result), 200);
  });

  // ─── Arrears ───────────────────────────────────────────────────────────────

  // GET /v1/loans/:loanId/arrears - check arrears status
  app.get("/loans/:loanId/arrears", async (c) => {
    const loanId = c.req.param("loanId");
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const asOfDate = c.req.query("asOfDate") ?? new Date().toISOString().split("T")[0];
    const result = await ctx.loanAccountService.checkArrears(loanId, asOfDate, tenantId);
    return c.json(stripNulls(result), 200);
  });

  // POST /v1/loans/:loanId/arrears/update - update arrears status
  app.post("/loans/:loanId/arrears/update", async (c) => {
    const loanId = c.req.param("loanId");
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const body = await c.req.json().catch(() => ({}));
    const asOfDate = body.asOfDate ?? new Date().toISOString().split("T")[0];
    await ctx.loanAccountService.updateArrearsStatus(loanId, asOfDate, tenantId);
    return c.json({ success: true }, 200);
  });

  // ─── Deal-Scoped Loans ─────────────────────────────────────────────────────

  // GET /v1/deals/:dealId/loans - list loans for a deal
  app.get("/deals/:dealId/loans", async (c) => {
    const dealId = c.req.param("dealId");
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const result = await ctx.loanAccountService.listByDeal(dealId, tenantId);
    return c.json(stripNulls(result), 200);
  });

  // GET /v1/deals/:dealId/loans/balance - get aggregated loan balance for covenant testing
  app.get("/deals/:dealId/loans/balance", async (c) => {
    const dealId = c.req.param("dealId");
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const result = await getLoanBalanceForDeal(
      ctx.loanAccountService,
      dealId,
      tenantId
    );
    return c.json(stripNulls(result), 200);
  });

  // GET /v1/deals/:dealId/loans/arrears - check arrears status for all loans in deal
  app.get("/deals/:dealId/loans/arrears", async (c) => {
    const dealId = c.req.param("dealId");
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const asOfDate =
      c.req.query("asOfDate") ?? new Date().toISOString().split("T")[0];
    const result = await checkDealArrearsStatus(
      ctx.loanAccountService,
      dealId,
      asOfDate,
      tenantId
    );
    return c.json(stripNulls(result), 200);
  });

  // ─── Facility → Loan Integration ───────────────────────────────────────────

  // POST /v1/facilities/:facilityId/loans - create loan from facility
  app.post("/facilities/:facilityId/loans", async (c) => {
    const facilityId = c.req.param("facilityId");
    const actor = c.req.header("X-Actor") ?? "system";
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const body = await c.req.json();

    const result = await createLoanAccountFromFacility(
      ctx.db,
      ctx.loanAccountService,
      {
        facility_id: facilityId,
        deal_id: body.dealId,
        account_holder_id: body.accountHolderId,
        first_repayment_date: body.firstRepaymentDate,
        repayment_frequency: body.repaymentFrequency,
        grace_period_days: body.gracePeriodDays,
        custom_fields: body.customFields,
      },
      actor,
      tenantId
    );

    return c.json(stripNulls(result), 201);
  });

  // POST /v1/facilities/:facilityId/loans/approved - create pre-approved loan from facility
  app.post("/facilities/:facilityId/loans/approved", async (c) => {
    const facilityId = c.req.param("facilityId");
    const actor = c.req.header("X-Actor") ?? "system";
    const tenantId = c.req.header("X-Tenant-Id") ?? "default";
    const body = await c.req.json();

    const result = await createApprovedLoanFromFacility(
      ctx.db,
      ctx.loanAccountService,
      {
        facility_id: facilityId,
        deal_id: body.dealId,
        account_holder_id: body.accountHolderId,
        first_repayment_date: body.firstRepaymentDate,
        repayment_frequency: body.repaymentFrequency,
        grace_period_days: body.gracePeriodDays,
        custom_fields: body.customFields,
      },
      body.approvalNotes ?? "Auto-approved from facility",
      actor,
      tenantId
    );

    return c.json(stripNulls(result), 201);
  });

  return app;
}
