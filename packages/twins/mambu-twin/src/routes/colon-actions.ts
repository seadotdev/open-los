/**
 * Mambu colon-action routes.
 *
 * Mambu uses a non-standard URL pattern for actions: `/loans/{id}:changeState`,
 * `/loans:search`, `/loans/transactions/{id}:adjust`. The colon is part of the
 * path segment, not a separator.
 *
 * Hono's router can match `/:param\\:suffix` patterns for param-based routes,
 * but NOT literal+colon patterns like `/loans\\:search`. We handle the literal
 * ones via middleware that rewrites the URL before routing.
 */

import { Hono } from "hono";
import type { MambuStore } from "../store/index.js";
import { findLoan } from "./loan-accounts.js";
import { mambuError, parsePagination } from "./helpers.js";
import { generateEncodedKey } from "../store/index.js";
import type { LoanAccountState, LoanAccount } from "../types/loan-account.js";
import type { LoanTransaction } from "../types/loan-transaction.js";
import type { Client } from "../types/client.js";

const ALLOWED_TRANSITIONS: Record<string, LoanAccountState[]> = {
  PARTIAL_APPLICATION: ["PENDING_APPROVAL", "APPROVED"],
  PENDING_APPROVAL: ["APPROVED", "CLOSED_REJECTED"],
  APPROVED: ["ACTIVE", "CLOSED_REJECTED"],
  ACTIVE: ["ACTIVE_IN_ARREARS", "CLOSED", "CLOSED_WRITTEN_OFF"],
  ACTIVE_IN_ARREARS: ["ACTIVE", "CLOSED", "CLOSED_WRITTEN_OFF"],
  CLOSED: [],
  CLOSED_WRITTEN_OFF: [],
  CLOSED_REJECTED: [],
};

const STATE_MAPPING: Record<string, LoanAccountState> = {
  REQUEST_APPROVAL: "PENDING_APPROVAL",
  APPROVE: "APPROVED",
  REJECT: "CLOSED_REJECTED",
  WITHDRAW: "CLOSED_REJECTED",
  UNDO_APPROVE: "PENDING_APPROVAL",
  CLOSE: "CLOSED",
  WRITE_OFF: "CLOSED_WRITTEN_OFF",
};

export function colonActionRoutes(store: MambuStore) {
  const app = new Hono();

  // ── Middleware: rewrite colon-action URLs ──────────────────────────────
  // Converts /loans:search → /loans/_action/search
  // Converts /clients:search → /clients/_action/search
  // Converts /loans/TX001:adjust → /loans/TX001/_action/adjust
  app.use("*", async (c, next) => {
    const url = new URL(c.req.url);
    const path = url.pathname;

    // Match /something:action patterns
    const rewritten = path.replace(
      /([^/]+):(\w+)$/,
      "$1/_action/$2"
    );

    if (rewritten !== path) {
      url.pathname = rewritten;
      // Create new request with rewritten URL
      const newReq = new Request(url.toString(), {
        method: c.req.method,
        headers: c.req.raw.headers,
        body: c.req.raw.body,
        // @ts-expect-error duplex needed for streaming body
        duplex: "half",
      });
      // Replace the request
      Object.defineProperty(c.req, "raw", { value: newReq, configurable: true });
      Object.defineProperty(c.req, "url", { value: url.toString(), configurable: true });
    }

    await next();
  });

  // ── Rewritten search routes ───────────────────────────────────────────

  // POST /loans:search → /loans/_action/search
  app.post("/loans/_action/search", async (c) => {
    const body = await c.req.json();
    const { offset, limit } = parsePagination(c);

    let items = Array.from(store.loanAccounts.values());
    items = store.applyFilters(
      items as unknown as Record<string, unknown>[],
      body.filterCriteria
    ) as unknown as LoanAccount[];
    if (body.sortingCriteria) {
      items = store.applySorting(
        items as unknown as Record<string, unknown>[],
        body.sortingCriteria
      ) as unknown as LoanAccount[];
    }

    return c.json(store.paginate(items, offset, limit), 200);
  });

  // POST /clients:search → /clients/_action/search
  app.post("/clients/_action/search", async (c) => {
    const body = await c.req.json();
    const { offset, limit } = parsePagination(c);

    let items = Array.from(store.clients.values());
    items = store.applyFilters(
      items as unknown as Record<string, unknown>[],
      body.filterCriteria
    ) as unknown as Client[];
    if (body.sortingCriteria) {
      items = store.applySorting(
        items as unknown as Record<string, unknown>[],
        body.sortingCriteria
      ) as unknown as Client[];
    }

    return c.json(store.paginate(items, offset, limit), 200);
  });

  // POST /loans/{id}:changeState → /loans/{id}/_action/changeState
  app.post("/loans/:loanAccountId/_action/changeState", async (c) => {
    const loanId = c.req.param("loanAccountId");
    const loan = findLoan(store, loanId);
    if (!loan) {
      return c.json(mambuError(404, "NOT_FOUND", `Loan account ${loanId} not found`), 404);
    }

    const body = await c.req.json();
    const targetState = STATE_MAPPING[body.action as string];
    if (!targetState) {
      return c.json(mambuError(400, "VALIDATION", `Unknown action: ${body.action}`), 400);
    }

    const allowed = ALLOWED_TRANSITIONS[loan.accountState] ?? [];
    if (!allowed.includes(targetState)) {
      return c.json(
        mambuError(409, "STATE_CONFLICT", `Cannot transition from ${loan.accountState} to ${targetState}`),
        409
      );
    }

    loan.accountState = targetState;
    loan.lastModifiedDate = store.now();

    if (targetState === "APPROVED") {
      loan.approvedDate = store.now();
    }
    if (targetState === "CLOSED_REJECTED") {
      loan.accountSubState = body.action === "WITHDRAW" ? "WITHDRAWN" : "REJECTED";
      loan.closedDate = store.now();
    }
    if (targetState === "CLOSED") {
      loan.accountSubState = "REPAID";
      loan.closedDate = store.now();
    }
    if (targetState === "CLOSED_WRITTEN_OFF") {
      loan.accountSubState = "WRITTEN_OFF";
      loan.closedDate = store.now();
    }

    return c.json(loan, 200);
  });

  // POST /loans/transactions/{txId}:adjust → /loans/transactions/{txId}/_action/adjust
  app.post("/loans/transactions/:txId/_action/adjust", async (c) => {
    const txId = c.req.param("txId");

    let originalTx: LoanTransaction | undefined;
    for (const txns of store.loanTransactions.values()) {
      originalTx = txns.find((t) => t.id === txId || t.encodedKey === txId);
      if (originalTx) break;
    }

    if (!originalTx) {
      return c.json(mambuError(404, "NOT_FOUND", `Transaction ${txId} not found`), 404);
    }

    const loan = store.loanAccounts.get(originalTx.parentAccountKey);
    if (!loan) {
      return c.json(mambuError(404, "NOT_FOUND", "Parent loan account not found"), 404);
    }

    const body = await c.req.json();
    const now = store.now();

    const affected = originalTx.affectedAmounts;

    if (originalTx.type === "REPAYMENT") {
      loan.balances.principalBalance += affected.principalAmount;
      loan.balances.principalPaid -= affected.principalAmount;
      loan.balances.interestBalance += affected.interestAmount;
      loan.balances.interestPaid -= affected.interestAmount;
      loan.balances.feesBalance += affected.feesAmount;
      loan.balances.feesPaid -= affected.feesAmount;
      loan.balances.penaltyBalance += affected.penaltyAmount;
      loan.balances.penaltyPaid -= affected.penaltyAmount;
    } else if (originalTx.type === "DISBURSEMENT") {
      loan.balances.principalBalance -= affected.principalAmount;
      loan.balances.principalDue -= affected.principalAmount;
    } else if (originalTx.type === "FEE_APPLIED") {
      loan.balances.feesDue -= affected.feesAmount;
      loan.balances.feesBalance -= affected.feesAmount;
    }

    loan.balances.totalBalance =
      loan.balances.principalBalance +
      loan.balances.interestBalance +
      loan.balances.feesBalance +
      loan.balances.penaltyBalance;

    loan.lastModifiedDate = now;

    const adjustmentTx: LoanTransaction = {
      encodedKey: generateEncodedKey(),
      id: store.nextTransactionId(),
      type: `${originalTx.type}_ADJUSTMENT` as LoanTransaction["type"],
      amount: originalTx.amount,
      valueDate: body.valueDate ?? now,
      bookingDate: now,
      creationDate: now,
      parentAccountKey: loan.encodedKey,
      affectedAmounts: {
        principalAmount: -affected.principalAmount,
        interestAmount: -affected.interestAmount,
        feesAmount: -affected.feesAmount,
        penaltyAmount: -affected.penaltyAmount,
        fundsAmount: 0,
        fractionAmount: 0,
        overdraftAmount: 0,
        overdraftFeesAmount: 0,
        overdraftInterestAmount: 0,
        technicalOverdraftAmount: 0,
        technicalOverdraftInterestAmount: 0,
      },
      accountBalances: {
        principalBalance: loan.balances.principalBalance,
        redrawBalance: loan.balances.redrawBalance,
        totalBalance: loan.balances.totalBalance,
        advancePosition: 0,
        arrearsPosition: 0,
        expectedPrincipalRedraw: 0,
      },
      originalTransactionKey: originalTx.encodedKey,
    };

    originalTx.adjustmentTransactionKey = adjustmentTx.encodedKey;
    store.addTransaction(loan.encodedKey, adjustmentTx);

    return c.json(adjustmentTx, 200);
  });

  // POST /loans/transactions:search → /loans/transactions/_action/search
  app.post("/loans/transactions/_action/search", async (c) => {
    const body = await c.req.json();
    const { offset, limit } = parsePagination(c);

    let allTxns: LoanTransaction[] = [];
    for (const txns of store.loanTransactions.values()) {
      allTxns = allTxns.concat(txns);
    }

    allTxns = store.applyFilters(
      allTxns as unknown as Record<string, unknown>[],
      body.filterCriteria
    ) as unknown as LoanTransaction[];

    if (body.sortingCriteria) {
      allTxns = store.applySorting(
        allTxns as unknown as Record<string, unknown>[],
        body.sortingCriteria
      ) as unknown as LoanTransaction[];
    }

    return c.json(store.paginate(allTxns, offset, limit), 200);
  });

  return app;
}
