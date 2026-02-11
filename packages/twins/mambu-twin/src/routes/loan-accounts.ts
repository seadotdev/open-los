import { Hono } from "hono";
import type { MambuStore } from "../store/index.js";
import { generateEncodedKey, emptyBalances } from "../store/index.js";
import type { LoanAccount, CreateLoanAccountInput, LoanAccountState } from "../types/loan-account.js";
import { mambuError, parsePagination } from "./helpers.js";

/** Mambu loan account state machine transitions */
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

export function loanAccountRoutes(store: MambuStore) {
  const app = new Hono();

  // GET /loans — list loan accounts
  app.get("/", (c) => {
    const { offset, limit } = parsePagination(c);
    const accountState = c.req.query("accountState");
    const accountHolderType = c.req.query("accountHolderType");
    const accountHolderKey = c.req.query("accountHolderKey");
    const branchId = c.req.query("branchId");
    const creditArrangementKey = c.req.query("creditArrangementKey");

    let items = Array.from(store.loanAccounts.values());

    if (accountState) items = items.filter((la) => la.accountState === accountState);
    if (accountHolderType) items = items.filter((la) => la.accountHolderType === accountHolderType);
    if (accountHolderKey) items = items.filter((la) => la.accountHolderKey === accountHolderKey);
    if (branchId) items = items.filter((la) => la.assignedBranchKey === branchId);
    if (creditArrangementKey) items = items.filter((la) => la.creditArrangementKey === creditArrangementKey);

    items.sort((a, b) => a.creationDate.localeCompare(b.creationDate));
    const page = store.paginate(items, offset, limit);

    const detailsLevel = c.req.query("detailsLevel") ?? "BASIC";
    const result = detailsLevel === "FULL" ? page : page.map(toBasicLoan);

    return c.json(result, 200);
  });

  // POST /loans — create loan account
  app.post("/", async (c) => {
    const body = (await c.req.json()) as CreateLoanAccountInput;

    if (!body.loanAmount || !body.productTypeKey || !body.accountHolderKey || !body.accountHolderType) {
      return c.json(
        mambuError(400, "VALIDATION", "loanAmount, productTypeKey, accountHolderKey, and accountHolderType are required"),
        400
      );
    }

    // Validate holder exists
    if (body.accountHolderType === "CLIENT") {
      const client = findByIdOrKey(store.clients, body.accountHolderKey);
      if (!client) {
        return c.json(mambuError(400, "VALIDATION", `Client ${body.accountHolderKey} not found`), 400);
      }
    }

    // Validate product exists
    const product = findByIdOrKey(store.loanProducts, body.productTypeKey);
    if (!product) {
      return c.json(mambuError(400, "VALIDATION", `Loan product ${body.productTypeKey} not found`), 400);
    }

    const now = store.now();
    const encodedKey = generateEncodedKey();

    const loan: LoanAccount = {
      encodedKey,
      id: body.id ?? store.nextLoanId(),
      loanName: body.loanName ?? `Loan ${body.accountHolderKey}`,
      loanAmount: body.loanAmount,
      productTypeKey: product.encodedKey,
      accountHolderKey: body.accountHolderKey,
      accountHolderType: body.accountHolderType,
      accountState: "PARTIAL_APPLICATION",
      assignedBranchKey: body.assignedBranchKey,
      assignedCentreKey: body.assignedCentreKey,
      assignedUserKey: body.assignedUserKey,
      creditArrangementKey: body.creditArrangementKey,
      currencyCode: body.currencyCode ?? "USD",
      scheduleSettings: body.scheduleSettings ?? {
        repaymentInstallments: product.defaultTermMonths ?? 12,
        repaymentPeriodCount: 1,
        repaymentPeriodUnit: "MONTHS",
        repaymentScheduleMethod: "FIXED",
        gracePeriod: product.gracePeriodDays ?? 0,
        gracePeriodType: "NONE",
        amortizationMethod: "STANDARD_PAYMENTS",
      },
      interestSettings: body.interestSettings ?? {
        interestRate: product.interestRateSettings?.defaultRate ?? 0,
        interestRateSource: "FIXED_INTEREST_RATE",
        interestCalculationMethod: (product.interestCalculationMethod as "FLAT" | "DECLINING_BALANCE") ?? "DECLINING_BALANCE",
        interestChargeFrequency: "ANNUALIZED",
        interestType: "SIMPLE_INTEREST",
        interestApplicationMethod: "REPAYMENT_DUE_DATE",
      },
      penaltySettings: body.penaltySettings ?? {
        penaltyRate: 0,
        loanPenaltyCalculationMethod: "NONE",
        loanPenaltyGracePeriod: 0,
      },
      prepaymentSettings: body.prepaymentSettings,
      disbursementDetails: body.disbursementDetails,
      balances: emptyBalances(),
      guarantors: body.guarantors,
      tranches: body.tranches,
      notes: body.notes,
      creationDate: now,
      lastModifiedDate: now,
    };

    store.loanAccounts.set(encodedKey, loan);

    // Link to credit arrangement if specified
    if (body.creditArrangementKey) {
      const existing = store.creditArrangementAccounts.get(body.creditArrangementKey) ?? [];
      existing.push(encodedKey);
      store.creditArrangementAccounts.set(body.creditArrangementKey, existing);
    }

    return c.json(loan, 201);
  });

  // POST /loans:search — search loan accounts
  app.post("/\\:search", async (c) => {
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

    const page = store.paginate(items, offset, limit);
    return c.json(page, 200);
  });

  // GET /loans/:loanAccountId — get loan account
  app.get("/:loanAccountId", (c) => {
    const loanId = c.req.param("loanAccountId");
    const loan = findLoan(store, loanId);
    if (!loan) {
      return c.json(mambuError(404, "NOT_FOUND", `Loan account ${loanId} not found`), 404);
    }

    const detailsLevel = c.req.query("detailsLevel") ?? "BASIC";
    return c.json(detailsLevel === "FULL" ? loan : toBasicLoan(loan), 200);
  });

  // PATCH /loans/:loanAccountId — partial update
  app.patch("/:loanAccountId", async (c) => {
    const loanId = c.req.param("loanAccountId");
    const loan = findLoan(store, loanId);
    if (!loan) {
      return c.json(mambuError(404, "NOT_FOUND", `Loan account ${loanId} not found`), 404);
    }

    const body = await c.req.json();
    if (Array.isArray(body)) {
      for (const op of body) {
        applyPatch(loan as unknown as Record<string, unknown>, op);
      }
    } else {
      // Don't allow overwriting computed/read-only fields
      const { encodedKey: _ek, id: _id, creationDate: _cd, balances: _b, ...updates } = body;
      Object.assign(loan, updates);
    }

    loan.lastModifiedDate = store.now();
    return c.json(loan, 200);
  });

  // PUT /loans/:loanAccountId — full update
  app.put("/:loanAccountId", async (c) => {
    const loanId = c.req.param("loanAccountId");
    const loan = findLoan(store, loanId);
    if (!loan) {
      return c.json(mambuError(404, "NOT_FOUND", `Loan account ${loanId} not found`), 404);
    }

    const body = await c.req.json();
    const preserved = {
      encodedKey: loan.encodedKey,
      id: loan.id,
      creationDate: loan.creationDate,
      balances: loan.balances,
      accountState: loan.accountState,
      accountSubState: loan.accountSubState,
    };
    Object.assign(loan, body, preserved);
    loan.lastModifiedDate = store.now();
    return c.json(loan, 200);
  });

  // DELETE /loans/:loanAccountId — delete (draft only)
  app.delete("/:loanAccountId", (c) => {
    const loanId = c.req.param("loanAccountId");
    const loan = findLoan(store, loanId);
    if (!loan) {
      return c.json(mambuError(404, "NOT_FOUND", `Loan account ${loanId} not found`), 404);
    }
    if (loan.accountState !== "PARTIAL_APPLICATION") {
      return c.json(
        mambuError(409, "STATE_CONFLICT", "Can only delete loans in PARTIAL_APPLICATION state"),
        409
      );
    }
    store.loanAccounts.delete(loan.encodedKey);
    return c.body(null, 204);
  });

  // POST /loans/:loanAccountId:changeState — change account state
  app.post("/:loanAccountId\\:changeState", async (c) => {
    const loanId = c.req.param("loanAccountId");
    const loan = findLoan(store, loanId);
    if (!loan) {
      return c.json(mambuError(404, "NOT_FOUND", `Loan account ${loanId} not found`), 404);
    }

    const body = await c.req.json();
    const targetState = body.action as string;

    const stateMapping: Record<string, LoanAccountState> = {
      REQUEST_APPROVAL: "PENDING_APPROVAL",
      APPROVE: "APPROVED",
      REJECT: "CLOSED_REJECTED",
      WITHDRAW: "CLOSED_REJECTED",
      UNDO_APPROVE: "PENDING_APPROVAL",
      CLOSE: "CLOSED",
      WRITE_OFF: "CLOSED_WRITTEN_OFF",
    };

    const newState = stateMapping[targetState];
    if (!newState) {
      return c.json(mambuError(400, "VALIDATION", `Unknown action: ${targetState}`), 400);
    }

    const allowed = ALLOWED_TRANSITIONS[loan.accountState] ?? [];
    if (!allowed.includes(newState)) {
      return c.json(
        mambuError(409, "STATE_CONFLICT", `Cannot transition from ${loan.accountState} to ${newState}`),
        409
      );
    }

    loan.accountState = newState;
    loan.lastModifiedDate = store.now();

    if (newState === "APPROVED") {
      loan.approvedDate = store.now();
    }
    if (newState === "CLOSED_REJECTED") {
      loan.accountSubState = targetState === "WITHDRAW" ? "WITHDRAWN" : "REJECTED";
      loan.closedDate = store.now();
    }
    if (newState === "CLOSED") {
      loan.accountSubState = "REPAID";
      loan.closedDate = store.now();
    }
    if (newState === "CLOSED_WRITTEN_OFF") {
      loan.accountSubState = "WRITTEN_OFF";
      loan.closedDate = store.now();
    }

    return c.json(loan, 200);
  });

  // GET /loans/:loanAccountId/schedule — get schedule
  app.get("/:loanAccountId/schedule", (c) => {
    const loanId = c.req.param("loanAccountId");
    const loan = findLoan(store, loanId);
    if (!loan) {
      return c.json(mambuError(404, "NOT_FOUND", `Loan account ${loanId} not found`), 404);
    }

    const entries = store.getSchedule(loan.encodedKey);
    return c.json({ installments: entries, currency: { code: loan.currencyCode ?? "USD", digitsAfterDecimal: 2 } }, 200);
  });

  // GET /loans/:loanAccountId/transactions — get transactions
  app.get("/:loanAccountId/transactions", (c) => {
    const loanId = c.req.param("loanAccountId");
    const loan = findLoan(store, loanId);
    if (!loan) {
      return c.json(mambuError(404, "NOT_FOUND", `Loan account ${loanId} not found`), 404);
    }

    const { offset, limit } = parsePagination(c);
    const txns = store.getTransactions(loan.encodedKey);
    return c.json(store.paginate(txns, offset, limit), 200);
  });

  return app;
}

function findLoan(store: MambuStore, idOrKey: string): LoanAccount | undefined {
  const byKey = store.loanAccounts.get(idOrKey);
  if (byKey) return byKey;
  for (const loan of store.loanAccounts.values()) {
    if (loan.id === idOrKey) return loan;
  }
  return undefined;
}

export { findLoan };

function findByIdOrKey<T extends { encodedKey: string; id: string }>(
  map: Map<string, T>,
  idOrKey: string
): T | undefined {
  const byKey = map.get(idOrKey);
  if (byKey) return byKey;
  for (const item of map.values()) {
    if (item.id === idOrKey) return item;
  }
  return undefined;
}

function toBasicLoan(loan: LoanAccount): Partial<LoanAccount> {
  const { balances: _b, scheduleSettings: _s, interestSettings: _i, penaltySettings: _p, prepaymentSettings: _pp, guarantors: _g, tranches: _t, ...basic } = loan;
  return basic;
}

function applyPatch(target: Record<string, unknown>, op: { op: string; path: string; value?: unknown }): void {
  const path = op.path.replace(/^\//, "");
  if (op.op === "REPLACE" || op.op === "ADD") {
    target[path] = op.value;
  } else if (op.op === "REMOVE") {
    delete target[path];
  }
}
