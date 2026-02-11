/**
 * In-memory store for the Mambu Digital Twin.
 *
 * All state lives here. Reset between test runs via store.reset().
 * Keyed by encodedKey (UUID-like identifier Mambu uses internally).
 */

import { randomUUID } from "node:crypto";
import type { Client } from "../types/client.js";
import type { LoanProduct } from "../types/loan-product.js";
import type { LoanAccount, LoanBalances } from "../types/loan-account.js";
import type { LoanTransaction } from "../types/loan-transaction.js";
import type { ScheduleEntry } from "../types/schedule.js";
import type { CreditArrangement } from "../types/credit-arrangement.js";
import type { FilterCriterion, SortingCriteria } from "../types/common.js";

export function generateEncodedKey(): string {
  return randomUUID().replace(/-/g, "");
}

export function generateId(prefix: string, counter: number): string {
  return `${prefix}${String(counter).padStart(6, "0")}`;
}

export function emptyBalances(): LoanBalances {
  return {
    principalDue: 0,
    principalPaid: 0,
    principalBalance: 0,
    interestDue: 0,
    interestPaid: 0,
    interestBalance: 0,
    interestFromArrearsBalance: 0,
    interestFromArrearsDue: 0,
    interestFromArrearsPaid: 0,
    feesDue: 0,
    feesPaid: 0,
    feesBalance: 0,
    penaltyDue: 0,
    penaltyPaid: 0,
    penaltyBalance: 0,
    holdBalance: 0,
    redrawBalance: 0,
    totalBalance: 0,
  };
}

export class MambuStore {
  clients = new Map<string, Client>();
  loanProducts = new Map<string, LoanProduct>();
  loanAccounts = new Map<string, LoanAccount>();
  loanTransactions = new Map<string, LoanTransaction[]>(); // keyed by parentAccountKey
  schedules = new Map<string, ScheduleEntry[]>(); // keyed by parentAccountKey
  creditArrangements = new Map<string, CreditArrangement>();

  // Link tables
  creditArrangementAccounts = new Map<string, string[]>(); // arrangement key → loan keys

  // Counters for human-readable IDs
  private clientCounter = 0;
  private loanProductCounter = 0;
  private loanCounter = 0;
  private transactionCounter = 0;
  private creditArrangementCounter = 0;

  private getNow: () => string;

  constructor(getNow?: () => string) {
    this.getNow = getNow ?? (() => new Date().toISOString());
  }

  now(): string {
    return this.getNow();
  }

  reset(): void {
    this.clients.clear();
    this.loanProducts.clear();
    this.loanAccounts.clear();
    this.loanTransactions.clear();
    this.schedules.clear();
    this.creditArrangements.clear();
    this.creditArrangementAccounts.clear();
    this.clientCounter = 0;
    this.loanProductCounter = 0;
    this.loanCounter = 0;
    this.transactionCounter = 0;
    this.creditArrangementCounter = 0;
  }

  nextClientId(): string {
    return generateId("", ++this.clientCounter);
  }

  nextLoanProductId(): string {
    return generateId("LP", ++this.loanProductCounter);
  }

  nextLoanId(): string {
    return generateId("LA", ++this.loanCounter);
  }

  nextTransactionId(): string {
    return generateId("TX", ++this.transactionCounter);
  }

  nextCreditArrangementId(): string {
    return generateId("CA", ++this.creditArrangementCounter);
  }

  // ── Generic pagination + filtering helpers ──────────────────────────────

  paginate<T>(items: T[], offset: number, limit: number): T[] {
    return items.slice(offset, offset + limit);
  }

  applyFilters<T extends Record<string, unknown>>(
    items: T[],
    filters?: FilterCriterion[]
  ): T[] {
    if (!filters || filters.length === 0) return items;

    return items.filter((item) =>
      filters.every((f) => matchFilter(item, f))
    );
  }

  applySorting<T extends Record<string, unknown>>(
    items: T[],
    sorting?: SortingCriteria
  ): T[] {
    if (!sorting) return items;
    const { field, order } = sorting;
    const dir = order === "DESC" ? -1 : 1;
    return [...items].sort((a, b) => {
      const va = a[field];
      const vb = b[field];
      if (va === vb) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "string" && typeof vb === "string")
        return va.localeCompare(vb) * dir;
      if (typeof va === "number" && typeof vb === "number")
        return (va - vb) * dir;
      return 0;
    });
  }

  // ── Loan account helpers ────────────────────────────────────────────────

  addTransaction(accountKey: string, tx: LoanTransaction): void {
    const existing = this.loanTransactions.get(accountKey) ?? [];
    existing.push(tx);
    this.loanTransactions.set(accountKey, existing);
  }

  getTransactions(accountKey: string): LoanTransaction[] {
    return this.loanTransactions.get(accountKey) ?? [];
  }

  getSchedule(accountKey: string): ScheduleEntry[] {
    return this.schedules.get(accountKey) ?? [];
  }

  setSchedule(accountKey: string, entries: ScheduleEntry[]): void {
    this.schedules.set(accountKey, entries);
  }
}

function matchFilter(
  item: Record<string, unknown>,
  filter: FilterCriterion
): boolean {
  const value = getNestedValue(item, filter.field);
  const target = filter.value;

  switch (filter.operator) {
    case "EQUALS":
      return String(value).toLowerCase() === String(target).toLowerCase();
    case "EQUALS_CASE_SENSITIVE":
      return String(value) === String(target);
    case "DIFFERENT_THAN":
      return String(value).toLowerCase() !== String(target).toLowerCase();
    case "MORE_THAN":
      return Number(value) > Number(target);
    case "LESS_THAN":
      return Number(value) < Number(target);
    case "BETWEEN":
      return (
        Number(value) >= Number(target) &&
        Number(value) <= Number(filter.secondValue)
      );
    case "STARTS_WITH":
      return String(value)
        .toLowerCase()
        .startsWith(String(target).toLowerCase());
    case "STARTS_WITH_CASE_SENSITIVE":
      return String(value).startsWith(String(target));
    case "IN":
      return (filter.values ?? []).some(
        (v) => String(v).toLowerCase() === String(value).toLowerCase()
      );
    case "EMPTY":
      return value == null || value === "";
    case "NOT_EMPTY":
      return value != null && value !== "";
    case "ON":
    case "AFTER":
    case "AFTER_INCLUSIVE":
    case "BEFORE":
    case "BEFORE_INCLUSIVE": {
      const d = new Date(String(value)).getTime();
      const t = new Date(String(target)).getTime();
      if (filter.operator === "ON") return isSameDay(d, t);
      if (filter.operator === "AFTER") return d > t;
      if (filter.operator === "AFTER_INCLUSIVE") return d >= t;
      if (filter.operator === "BEFORE") return d < t;
      if (filter.operator === "BEFORE_INCLUSIVE") return d <= t;
      return false;
    }
    default:
      return true;
  }
}

function isSameDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getUTCFullYear() === db.getUTCFullYear() &&
    da.getUTCMonth() === db.getUTCMonth() &&
    da.getUTCDate() === db.getUTCDate()
  );
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
