import { Hono } from "hono";
import type { MambuStore } from "../store/index.js";
import { generateEncodedKey } from "../store/index.js";
import type { LoanTransaction, AffectedAmounts, AccountBalancesSnapshot, DisbursementInput, RepaymentInput, FeeInput } from "../types/loan-transaction.js";
import type { LoanAccount } from "../types/loan-account.js";
import type { ScheduleEntry } from "../types/schedule.js";
import { findLoan } from "./loan-accounts.js";
import { mambuError, parsePagination } from "./helpers.js";

export function loanTransactionRoutes(store: MambuStore) {
  const app = new Hono();

  // POST /loans/:loanAccountId/disbursement-transactions
  app.post("/:loanAccountId/disbursement-transactions", async (c) => {
    const loanId = c.req.param("loanAccountId");
    const loan = findLoan(store, loanId);
    if (!loan) {
      return c.json(mambuError(404, "NOT_FOUND", `Loan account ${loanId} not found`), 404);
    }

    if (loan.accountState !== "APPROVED" && loan.accountState !== "PARTIAL_APPLICATION" && loan.accountState !== "ACTIVE") {
      return c.json(
        mambuError(409, "STATE_CONFLICT", `Cannot disburse loan in ${loan.accountState} state`),
        409
      );
    }

    const body = (await c.req.json()) as DisbursementInput;
    const amount = body.amount ?? loan.loanAmount;
    const now = store.now();

    // Update balances
    loan.balances.principalBalance += amount;
    loan.balances.principalDue += amount;
    loan.balances.totalBalance += amount;

    // Transition to ACTIVE
    if (loan.accountState !== "ACTIVE") {
      loan.accountState = "ACTIVE";
      loan.activationTransactionKey = generateEncodedKey();
    }

    // Update disbursement details
    loan.disbursementDetails = {
      ...loan.disbursementDetails,
      disbursementDate: body.valueDate ?? now.split("T")[0],
      firstRepaymentDate: body.firstRepaymentDate ?? loan.disbursementDetails?.firstRepaymentDate,
    };

    loan.lastModifiedDate = now;

    // Generate schedule on first disbursement
    if (store.getSchedule(loan.encodedKey).length === 0) {
      generateSchedule(store, loan);
    }

    const tx = createTransaction(store, loan, "DISBURSEMENT", amount, body.valueDate ?? now, {
      principalAmount: amount,
    });

    return c.json(tx, 201);
  });

  // POST /loans/:loanAccountId/repayment-transactions
  app.post("/:loanAccountId/repayment-transactions", async (c) => {
    const loanId = c.req.param("loanAccountId");
    const loan = findLoan(store, loanId);
    if (!loan) {
      return c.json(mambuError(404, "NOT_FOUND", `Loan account ${loanId} not found`), 404);
    }

    if (loan.accountState !== "ACTIVE" && loan.accountState !== "ACTIVE_IN_ARREARS") {
      return c.json(
        mambuError(409, "STATE_CONFLICT", `Cannot repay loan in ${loan.accountState} state`),
        409
      );
    }

    const body = (await c.req.json()) as RepaymentInput;
    const now = store.now();
    let remaining = body.amount;

    // Allocation order: penalties → fees → interest → principal
    const penaltyPaid = Math.min(remaining, loan.balances.penaltyDue - loan.balances.penaltyPaid);
    remaining -= penaltyPaid;
    loan.balances.penaltyPaid += penaltyPaid;
    loan.balances.penaltyBalance -= penaltyPaid;

    const feesPaid = Math.min(remaining, loan.balances.feesDue - loan.balances.feesPaid);
    remaining -= feesPaid;
    loan.balances.feesPaid += feesPaid;
    loan.balances.feesBalance -= feesPaid;

    const interestPaid = Math.min(remaining, loan.balances.interestDue - loan.balances.interestPaid);
    remaining -= interestPaid;
    loan.balances.interestPaid += interestPaid;
    loan.balances.interestBalance -= interestPaid;

    const principalPaid = Math.min(remaining, loan.balances.principalBalance);
    loan.balances.principalPaid += principalPaid;
    loan.balances.principalBalance -= principalPaid;

    loan.balances.totalBalance =
      loan.balances.principalBalance +
      loan.balances.interestBalance +
      loan.balances.feesBalance +
      loan.balances.penaltyBalance;

    // Update schedule entries
    applyRepaymentToSchedule(store, loan, body.amount);

    // Check if fully repaid
    if (loan.balances.principalBalance <= 0 && loan.balances.totalBalance <= 0) {
      loan.accountState = "CLOSED";
      loan.accountSubState = "REPAID";
      loan.closedDate = now;
    } else if (loan.accountState === "ACTIVE_IN_ARREARS") {
      // Check if arrears cleared
      const schedule = store.getSchedule(loan.encodedKey);
      const hasOverdue = schedule.some(
        (e) => e.state === "LATE" || e.state === "OVERDUE"
      );
      if (!hasOverdue) {
        loan.accountState = "ACTIVE";
      }
    }

    loan.lastModifiedDate = now;

    const tx = createTransaction(store, loan, "REPAYMENT", body.amount, body.valueDate ?? now, {
      principalAmount: principalPaid,
      interestAmount: interestPaid,
      feesAmount: feesPaid,
      penaltyAmount: penaltyPaid,
    });

    return c.json(tx, 201);
  });

  // POST /loans/:loanAccountId/fee-transactions
  app.post("/:loanAccountId/fee-transactions", async (c) => {
    const loanId = c.req.param("loanAccountId");
    const loan = findLoan(store, loanId);
    if (!loan) {
      return c.json(mambuError(404, "NOT_FOUND", `Loan account ${loanId} not found`), 404);
    }

    if (loan.accountState !== "ACTIVE" && loan.accountState !== "ACTIVE_IN_ARREARS") {
      return c.json(
        mambuError(409, "STATE_CONFLICT", `Cannot apply fee to loan in ${loan.accountState} state`),
        409
      );
    }

    const body = (await c.req.json()) as FeeInput;
    const now = store.now();

    loan.balances.feesDue += body.amount;
    loan.balances.feesBalance += body.amount;
    loan.balances.totalBalance += body.amount;
    loan.lastModifiedDate = now;

    const tx = createTransaction(store, loan, "FEE_APPLIED", body.amount, body.valueDate ?? now, {
      feesAmount: body.amount,
    });

    return c.json(tx, 201);
  });

  // POST /loans/:loanAccountId/refund-transactions
  app.post("/:loanAccountId/refund-transactions", async (c) => {
    const loanId = c.req.param("loanAccountId");
    const loan = findLoan(store, loanId);
    if (!loan) {
      return c.json(mambuError(404, "NOT_FOUND", `Loan account ${loanId} not found`), 404);
    }

    const body = await c.req.json();
    const now = store.now();

    // Refund adds back to principal balance
    loan.balances.principalBalance += body.amount;
    loan.balances.principalPaid -= body.amount;
    loan.balances.totalBalance += body.amount;
    loan.lastModifiedDate = now;

    const tx = createTransaction(store, loan, "REFUND", body.amount, body.valueDate ?? now, {
      principalAmount: body.amount,
    });

    return c.json(tx, 201);
  });

  // POST /loans/:loanAccountId/payment-made-transactions
  app.post("/:loanAccountId/payment-made-transactions", async (c) => {
    const loanId = c.req.param("loanAccountId");
    const loan = findLoan(store, loanId);
    if (!loan) {
      return c.json(mambuError(404, "NOT_FOUND", `Loan account ${loanId} not found`), 404);
    }

    // Similar to repayment but for outgoing payments (e.g., to borrower)
    const body = await c.req.json();
    const now = store.now();

    const tx = createTransaction(store, loan, "PAYMENT_MADE", body.amount, body.valueDate ?? now, {
      principalAmount: body.amount,
    });

    loan.lastModifiedDate = now;
    return c.json(tx, 201);
  });

  // POST /loans/:loanAccountId/lock-transactions
  app.post("/:loanAccountId/lock-transactions", async (c) => {
    const loanId = c.req.param("loanAccountId");
    const loan = findLoan(store, loanId);
    if (!loan) {
      return c.json(mambuError(404, "NOT_FOUND", `Loan account ${loanId} not found`), 404);
    }

    const now = store.now();
    loan.accountSubState = "LOCKED";
    loan.lastModifiedDate = now;

    const tx = createTransaction(store, loan, "INTEREST_LOCKED", 0, now, {});
    return c.json(tx, 201);
  });

  // POST /loans/:loanAccountId/unlock-transactions
  app.post("/:loanAccountId/unlock-transactions", async (c) => {
    const loanId = c.req.param("loanAccountId");
    const loan = findLoan(store, loanId);
    if (!loan) {
      return c.json(mambuError(404, "NOT_FOUND", `Loan account ${loanId} not found`), 404);
    }

    const now = store.now();
    if (loan.accountSubState === "LOCKED") {
      loan.accountSubState = undefined;
    }
    loan.lastModifiedDate = now;

    const tx = createTransaction(store, loan, "INTEREST_UNLOCKED", 0, now, {});
    return c.json(tx, 201);
  });

  // GET /loans/transactions/:loanTransactionId — get a specific transaction
  app.get("/transactions/:loanTransactionId", (c) => {
    const txId = c.req.param("loanTransactionId");
    for (const txns of store.loanTransactions.values()) {
      const found = txns.find((t) => t.id === txId || t.encodedKey === txId);
      if (found) return c.json(found, 200);
    }
    return c.json(mambuError(404, "NOT_FOUND", `Transaction ${txId} not found`), 404);
  });

  // POST /loans/transactions/:loanTransactionId:adjust — reverse/adjust a transaction
  app.post("/transactions/:loanTransactionId\\:adjust", async (c) => {
    const txId = c.req.param("loanTransactionId");
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

    // Reverse the original transaction's effects
    const adjustmentType = `${originalTx.type}_ADJUSTMENT` as LoanTransaction["type"];

    // Undo balance changes
    const affected = originalTx.affectedAmounts;
    loan.balances.principalBalance += affected.principalAmount;
    loan.balances.principalPaid -= affected.principalAmount;
    loan.balances.interestBalance += affected.interestAmount;
    loan.balances.interestPaid -= affected.interestAmount;
    loan.balances.feesBalance += affected.feesAmount;
    loan.balances.feesPaid -= affected.feesAmount;
    loan.balances.penaltyBalance += affected.penaltyAmount;
    loan.balances.penaltyPaid -= affected.penaltyAmount;
    loan.balances.totalBalance =
      loan.balances.principalBalance +
      loan.balances.interestBalance +
      loan.balances.feesBalance +
      loan.balances.penaltyBalance;

    loan.lastModifiedDate = now;

    const adjustmentTx = createTransaction(
      store,
      loan,
      adjustmentType,
      originalTx.amount,
      body.valueDate ?? now,
      {
        principalAmount: -affected.principalAmount,
        interestAmount: -affected.interestAmount,
        feesAmount: -affected.feesAmount,
        penaltyAmount: -affected.penaltyAmount,
      }
    );

    adjustmentTx.originalTransactionKey = originalTx.encodedKey;
    originalTx.adjustmentTransactionKey = adjustmentTx.encodedKey;

    return c.json(adjustmentTx, 200);
  });

  // POST /loans/transactions:search — search transactions across all accounts
  app.post("/transactions\\:search", async (c) => {
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

// ── Helpers ─────────────────────────────────────────────────────────────────

function createTransaction(
  store: MambuStore,
  loan: LoanAccount,
  type: LoanTransaction["type"],
  amount: number,
  valueDate: string,
  amounts: Partial<AffectedAmounts>
): LoanTransaction {
  const now = store.now();

  const affectedAmounts: AffectedAmounts = {
    principalAmount: amounts.principalAmount ?? 0,
    interestAmount: amounts.interestAmount ?? 0,
    feesAmount: amounts.feesAmount ?? 0,
    penaltyAmount: amounts.penaltyAmount ?? 0,
    fundsAmount: amounts.fundsAmount ?? 0,
    fractionAmount: amounts.fractionAmount ?? 0,
    overdraftAmount: 0,
    overdraftFeesAmount: 0,
    overdraftInterestAmount: 0,
    technicalOverdraftAmount: 0,
    technicalOverdraftInterestAmount: 0,
  };

  const accountBalances: AccountBalancesSnapshot = {
    principalBalance: loan.balances.principalBalance,
    redrawBalance: loan.balances.redrawBalance,
    totalBalance: loan.balances.totalBalance,
    advancePosition: 0,
    arrearsPosition: 0,
    expectedPrincipalRedraw: 0,
  };

  const tx: LoanTransaction = {
    encodedKey: generateEncodedKey(),
    id: store.nextTransactionId(),
    type,
    amount,
    valueDate,
    bookingDate: now,
    creationDate: now,
    parentAccountKey: loan.encodedKey,
    affectedAmounts,
    accountBalances,
  };

  store.addTransaction(loan.encodedKey, tx);
  return tx;
}

function generateSchedule(store: MambuStore, loan: LoanAccount): void {
  const settings = loan.scheduleSettings;
  if (!settings) return;

  const installments = settings.repaymentInstallments ?? 12;
  const principalPerInstallment = loan.loanAmount / installments;
  const annualRate = loan.interestSettings?.interestRate ?? 0;
  const monthlyRate = annualRate / 100 / 12;

  const entries: ScheduleEntry[] = [];
  let remainingPrincipal = loan.loanAmount;
  let startDate = loan.disbursementDetails?.firstRepaymentDate ??
    settings.firstRepaymentDate ??
    addMonths(store.now().split("T")[0], 1);

  for (let i = 1; i <= installments; i++) {
    const interestDue =
      loan.interestSettings?.interestCalculationMethod === "FLAT"
        ? (loan.loanAmount * monthlyRate)
        : (remainingPrincipal * monthlyRate);

    const principalDue = i === installments
      ? remainingPrincipal  // last installment gets the remainder
      : Math.round(principalPerInstallment * 100) / 100;

    const gracePeriod = settings.gracePeriod ?? 0;
    const isGrace = i <= gracePeriod;

    entries.push({
      encodedKey: generateEncodedKey(),
      parentAccountKey: loan.encodedKey,
      installmentNumber: i,
      dueDate: startDate,
      state: isGrace ? "GRACE_PERIOD" : "PENDING",
      principalDue: isGrace ? 0 : Math.round(principalDue * 100) / 100,
      principalPaid: 0,
      interestDue: Math.round(interestDue * 100) / 100,
      interestPaid: 0,
      feesDue: 0,
      feesPaid: 0,
      penaltyDue: 0,
      penaltyPaid: 0,
    });

    remainingPrincipal -= isGrace ? 0 : principalDue;
    startDate = addMonths(startDate, settings.repaymentPeriodCount ?? 1);
  }

  store.setSchedule(loan.encodedKey, entries);
}

function applyRepaymentToSchedule(
  store: MambuStore,
  loan: LoanAccount,
  amount: number
): void {
  const schedule = store.getSchedule(loan.encodedKey);
  let remaining = amount;

  for (const entry of schedule) {
    if (remaining <= 0) break;
    if (entry.state === "PAID") continue;

    const totalDue =
      (entry.principalDue - entry.principalPaid) +
      (entry.interestDue - entry.interestPaid) +
      (entry.feesDue - entry.feesPaid) +
      (entry.penaltyDue - entry.penaltyPaid);

    if (totalDue <= 0) continue;

    const payment = Math.min(remaining, totalDue);
    remaining -= payment;

    // Allocate within installment: penalty → fees → interest → principal
    let left = payment;

    const penaltyPayment = Math.min(left, entry.penaltyDue - entry.penaltyPaid);
    entry.penaltyPaid += penaltyPayment;
    left -= penaltyPayment;

    const feesPayment = Math.min(left, entry.feesDue - entry.feesPaid);
    entry.feesPaid += feesPayment;
    left -= feesPayment;

    const interestPayment = Math.min(left, entry.interestDue - entry.interestPaid);
    entry.interestPaid += interestPayment;
    left -= interestPayment;

    const principalPayment = Math.min(left, entry.principalDue - entry.principalPaid);
    entry.principalPaid += principalPayment;

    // Update state
    const remainingDue =
      (entry.principalDue - entry.principalPaid) +
      (entry.interestDue - entry.interestPaid) +
      (entry.feesDue - entry.feesPaid) +
      (entry.penaltyDue - entry.penaltyPaid);

    if (remainingDue <= 0.01) {
      entry.state = "PAID";
    } else if (payment > 0) {
      entry.state = "PARTIALLY_PAID";
    }

    entry.lastPaidDate = store.now();
  }
}

function addMonths(dateStr: string, months: number): string {
  const date = new Date(dateStr);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().split("T")[0];
}
