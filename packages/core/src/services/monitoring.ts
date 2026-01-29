import { eq } from "drizzle-orm";
import type { Database } from "../schema/db.js";
import { deals, ingestions, bankTransactions, alerts, covenants, covenantTests, waivers, spreads } from "../schema/tables.js";
import type { AuditService } from "./audit.js";
import { NotFoundError, ValidationError } from "./errors.js";
import type { CovenantTestResult } from "./covenant.js";
import type { Ratios } from "./spread.js";

export interface TransactionInput {
  date: string;
  amount: number;
  description: string;
  category?: string;
}

export interface IngestInput {
  source_type: string;
  transactions: TransactionInput[];
}

export interface Alert {
  id: string;
  type: "covenant_breach" | "liquidity_warning" | "data_gap" | "payment_missed";
  severity: "info" | "warning" | "critical";
  message: string;
  created_at: string;
}

export interface LiquidityStatus {
  current_balance: number;
  avg_monthly_burn: number | null;
  runway_months: number | null;
  as_of: string | null;
}

export interface MonitoringStatus {
  deal_id: string;
  liquidity: LiquidityStatus;
  alerts: Alert[];
  covenant_status: CovenantTestResult[];
}

function parseCSV(csvContent: string): TransactionInput[] {
  const lines = csvContent.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const dateIdx = headers.indexOf("date");
  const amountIdx = headers.indexOf("amount");
  const descriptionIdx = headers.indexOf("description");
  const categoryIdx = headers.indexOf("category");

  if (dateIdx === -1 || amountIdx === -1) {
    return [];
  }

  const transactions: TransactionInput[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    if (cols.length > Math.max(dateIdx, amountIdx)) {
      transactions.push({
        date: cols[dateIdx],
        amount: parseInt(cols[amountIdx], 10),
        description: cols[descriptionIdx] ?? "",
        category: categoryIdx !== -1 ? cols[categoryIdx] : undefined,
      });
    }
  }

  return transactions;
}

function compareValue(
  actual: number,
  operator: string,
  threshold: number
): boolean {
  switch (operator) {
    case ">=":
      return actual >= threshold;
    case "<=":
      return actual <= threshold;
    case ">":
      return actual > threshold;
    case "<":
      return actual < threshold;
    case "==":
      return actual === threshold;
    default:
      return false;
  }
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export class MonitoringService {
  constructor(
    private db: Database,
    private audit: AuditService,
    private getNow: () => string
  ) {}

  async ingest(dealId: string, input: IngestInput | string, actor: string, isCSV = false) {
    // Validate deal exists
    const dealRows = await this.db
      .select()
      .from(deals)
      .where(eq(deals.id, dealId));
    if (dealRows.length === 0) {
      throw new NotFoundError(`Deal ${dealId} not found`);
    }

    let transactions: TransactionInput[];
    let sourceType: string;

    if (isCSV && typeof input === "string") {
      // Parse CSV
      transactions = parseCSV(input);
      sourceType = "bank_transactions";
    } else if (typeof input === "object") {
      // JSON input
      if (!input.source_type) {
        throw new ValidationError("source_type is required");
      }
      if (!input.transactions || input.transactions.length === 0) {
        throw new ValidationError("transactions array must not be empty");
      }

      // Validate each transaction
      for (const txn of input.transactions) {
        if (!txn.date) {
          throw new ValidationError("Each transaction requires a date");
        }
        if (txn.amount === undefined || txn.amount === null) {
          throw new ValidationError("Each transaction requires an amount");
        }
      }

      transactions = input.transactions;
      sourceType = input.source_type;
    } else {
      throw new ValidationError("Invalid input format");
    }

    if (transactions.length === 0) {
      throw new ValidationError("transactions array must not be empty");
    }

    const now = this.getNow();
    const ingestionId = crypto.randomUUID();

    // Create ingestion record
    await this.db.insert(ingestions).values({
      id: ingestionId,
      deal_id: dealId,
      source_type: sourceType,
      records_accepted: transactions.length,
      created_at: now,
    });

    // Insert transactions
    for (const txn of transactions) {
      await this.db.insert(bankTransactions).values({
        id: crypto.randomUUID(),
        deal_id: dealId,
        ingestion_id: ingestionId,
        date: txn.date,
        amount: txn.amount,
        description: txn.description,
        category: txn.category ?? null,
        created_at: now,
      });
    }

    // Record audit event
    await this.audit.record({
      deal_id: dealId,
      type: "MONITORING_INGESTED",
      actor,
      timestamp: now,
      object_type: "ingestion",
      object_id: ingestionId,
      metadata: {
        ingestion_id: ingestionId,
        source_type: sourceType,
        records_accepted: transactions.length,
      },
    });

    return {
      ingestion_id: ingestionId,
      records_accepted: transactions.length,
    };
  }

  async getStatus(dealId: string, actor: string): Promise<MonitoringStatus> {
    // Validate deal exists
    const dealRows = await this.db
      .select()
      .from(deals)
      .where(eq(deals.id, dealId));
    if (dealRows.length === 0) {
      throw new NotFoundError(`Deal ${dealId} not found`);
    }

    const now = new Date(this.getNow());

    // Get all transactions for deal
    const txnRows = await this.db
      .select()
      .from(bankTransactions)
      .where(eq(bankTransactions.deal_id, dealId));

    // Compute liquidity
    const liquidity = this.computeLiquidity(txnRows, now);

    // Get covenant status and alerts
    const { covenantStatus, covenantAlerts } = await this.testCovenants(dealId, liquidity.current_balance, actor, now);

    // Generate alerts
    const generatedAlerts = await this.generateAlerts(dealId, liquidity, covenantAlerts, now, actor);

    return {
      deal_id: dealId,
      liquidity,
      alerts: generatedAlerts,
      covenant_status: covenantStatus,
    };
  }

  private computeLiquidity(
    transactions: Array<{ date: string; amount: number }>,
    now: Date
  ): LiquidityStatus {
    if (transactions.length === 0) {
      return {
        current_balance: 0,
        avg_monthly_burn: null,
        runway_months: null,
        as_of: null,
      };
    }

    // Current balance is sum of all transactions
    const currentBalance = transactions.reduce((sum, t) => sum + t.amount, 0);

    // Find latest transaction date
    let latestDate: string | null = null;
    for (const txn of transactions) {
      if (!latestDate || txn.date > latestDate) {
        latestDate = txn.date;
      }
    }

    // Group transactions by month (YYYY-MM)
    const monthlyTotals: Record<string, number> = {};
    for (const txn of transactions) {
      const monthKey = txn.date.slice(0, 7); // YYYY-MM
      monthlyTotals[monthKey] = (monthlyTotals[monthKey] ?? 0) + txn.amount;
    }

    // Calculate average monthly burn (only months with net negative, i.e., burn months)
    const burnMonths = Object.values(monthlyTotals).filter((net) => net < 0);
    let avgMonthlyBurn: number | null = null;
    let runwayMonths: number | null = null;

    if (burnMonths.length > 0) {
      // Average burn is the average of monthly net outflows (negative values)
      const totalBurn = burnMonths.reduce((sum, val) => sum + val, 0);
      avgMonthlyBurn = Math.round(Math.abs(totalBurn / burnMonths.length));

      // Runway = current_balance / avg_monthly_burn
      if (avgMonthlyBurn > 0) {
        runwayMonths = Math.round((currentBalance / avgMonthlyBurn) * 10) / 10;
      }
    }

    return {
      current_balance: currentBalance,
      avg_monthly_burn: avgMonthlyBurn,
      runway_months: runwayMonths,
      as_of: latestDate,
    };
  }

  private async testCovenants(
    dealId: string,
    currentBalance: number,
    actor: string,
    now: Date
  ): Promise<{ covenantStatus: CovenantTestResult[]; covenantAlerts: Array<{ name: string; actual: number; threshold: number }> }> {
    const covenantRows = await this.db
      .select()
      .from(covenants)
      .where(eq(covenants.deal_id, dealId));

    // Get latest spread for deal to retrieve ratios
    const spreadRows = await this.db
      .select()
      .from(spreads)
      .where(eq(spreads.deal_id, dealId));

    const latestSpread = spreadRows[spreadRows.length - 1] ?? null;
    const ratios = latestSpread?.ratios as Ratios | null;
    const lineItems = latestSpread?.line_items as Array<{ category: string; label: string; amount: number }> | null;

    const results: CovenantTestResult[] = [];
    const covenantAlerts: Array<{ name: string; actual: number; threshold: number }> = [];
    const testedAt = this.getNow();

    for (const covenant of covenantRows) {
      // Skip non-financial covenants for automated testing
      if (covenant.type !== "financial") {
        continue;
      }

      // Get actual value for the metric
      let actualValue = this.getMetricValue(
        covenant.metric,
        ratios,
        lineItems,
        currentBalance
      );

      const threshold = covenant.threshold ?? 0;
      const operator = covenant.operator ?? ">=";

      // Check if waiver is active
      const activeWaiver = await this.getActiveWaiver(covenant.id, now);

      // Check for previous grace period entry
      const prevTests = await this.db
        .select()
        .from(covenantTests)
        .where(eq(covenantTests.covenant_id, covenant.id));

      const prevGracePeriodTest = prevTests.find(
        (t) => t.status === "grace_period"
      );

      let status: CovenantTestResult["status"];
      let gracePeriodExpires: string | undefined;

      if (activeWaiver) {
        status = "waived";
      } else if (actualValue !== null && compareValue(actualValue, operator, threshold)) {
        status = "pass";
      } else {
        // Failed - check grace period
        const graceDays = covenant.grace_period_days ?? 0;
        if (graceDays > 0) {
          if (prevGracePeriodTest && prevGracePeriodTest.grace_period_expires) {
            // Check if grace period has expired
            const gracePeriodExpiry = new Date(prevGracePeriodTest.grace_period_expires);
            if (now >= gracePeriodExpiry) {
              status = "fail";
            } else {
              status = "grace_period";
              gracePeriodExpires = prevGracePeriodTest.grace_period_expires;
            }
          } else {
            // First time failing, enter grace period
            status = "grace_period";
            gracePeriodExpires = addDays(now, graceDays).toISOString().replace(".000Z", "Z");
          }
        } else {
          status = "fail";
        }

        // Track for alert generation
        if (status === "fail" && actualValue !== null) {
          covenantAlerts.push({
            name: covenant.name,
            actual: actualValue,
            threshold,
          });
        }
      }

      // Store test result
      const testId = crypto.randomUUID();
      await this.db.insert(covenantTests).values({
        id: testId,
        covenant_id: covenant.id,
        deal_id: dealId,
        status,
        actual_value: actualValue,
        threshold,
        operator,
        metric: covenant.metric,
        tested_at: testedAt,
        grace_period_expires: gracePeriodExpires ?? null,
      });

      results.push({
        covenant_id: covenant.id,
        covenant_name: covenant.name,
        status,
        actual_value: actualValue ?? 0,
        threshold,
        operator,
        metric: covenant.metric,
        tested_at: testedAt,
        grace_period_expires: gracePeriodExpires,
      });
    }

    return { covenantStatus: results, covenantAlerts };
  }

  private getMetricValue(
    metric: string,
    ratios: Ratios | null,
    lineItems: Array<{ category: string; label: string; amount: number }> | null,
    currentBalance: number
  ): number | null {
    switch (metric) {
      case "dscr":
        return ratios?.dscr ?? null;
      case "leverage":
        return ratios?.leverage ?? null;
      case "gross_margin":
        return ratios?.gross_margin ?? null;
      case "current_ratio":
        return ratios?.current_ratio ?? null;
      case "debt_to_equity":
        return ratios?.debt_to_equity ?? null;
      case "net_margin":
        return ratios?.net_margin ?? null;
      case "min_liquidity":
        // Use current balance from bank transactions
        return currentBalance;
      default:
        return null;
    }
  }

  private async getActiveWaiver(covenantId: string, asOf: Date) {
    const waiverRows = await this.db
      .select()
      .from(waivers)
      .where(eq(waivers.covenant_id, covenantId));

    for (const waiver of waiverRows) {
      const validFrom = waiver.valid_from
        ? new Date(waiver.valid_from)
        : new Date(waiver.created_at);
      const validUntil = waiver.valid_until ? new Date(waiver.valid_until) : null;

      if (asOf >= validFrom) {
        if (!validUntil || asOf <= validUntil) {
          return waiver;
        }
      }
    }

    return null;
  }

  private async generateAlerts(
    dealId: string,
    liquidity: LiquidityStatus,
    covenantAlerts: Array<{ name: string; actual: number; threshold: number }>,
    now: Date,
    actor: string
  ): Promise<Alert[]> {
    const generatedAlerts: Alert[] = [];
    const nowStr = this.getNow();

    // 1. Liquidity warning: if runway_months < 3
    if (liquidity.runway_months !== null && liquidity.runway_months < 3) {
      const alertId = crypto.randomUUID();
      const message = `Cash runway is ${liquidity.runway_months.toFixed(1)} months (below 3-month threshold)`;

      await this.db.insert(alerts).values({
        id: alertId,
        deal_id: dealId,
        type: "liquidity_warning",
        severity: "warning",
        message,
        created_at: nowStr,
      });

      await this.audit.record({
        deal_id: dealId,
        type: "ALERT_CREATED",
        actor,
        timestamp: nowStr,
        object_type: "alert",
        object_id: alertId,
        metadata: {
          alert_id: alertId,
          alert_type: "liquidity_warning",
          severity: "warning",
        },
      });

      generatedAlerts.push({
        id: alertId,
        type: "liquidity_warning",
        severity: "warning",
        message,
        created_at: nowStr,
      });
    }

    // 2. Covenant breach alerts
    for (const breach of covenantAlerts) {
      const alertId = crypto.randomUUID();
      const message = `Covenant '${breach.name}' breached: actual ${breach.actual} vs threshold ${breach.threshold}`;

      await this.db.insert(alerts).values({
        id: alertId,
        deal_id: dealId,
        type: "covenant_breach",
        severity: "critical",
        message,
        created_at: nowStr,
      });

      await this.audit.record({
        deal_id: dealId,
        type: "ALERT_CREATED",
        actor,
        timestamp: nowStr,
        object_type: "alert",
        object_id: alertId,
        metadata: {
          alert_id: alertId,
          alert_type: "covenant_breach",
          severity: "critical",
          covenant_name: breach.name,
        },
      });

      generatedAlerts.push({
        id: alertId,
        type: "covenant_breach",
        severity: "critical",
        message,
        created_at: nowStr,
      });
    }

    // 3. Data gap alert: if latest transaction is more than 30 days before now
    if (liquidity.as_of) {
      const latestTxnDate = new Date(liquidity.as_of);
      const daysSince = Math.floor((now.getTime() - latestTxnDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSince > 30) {
        const alertId = crypto.randomUUID();
        const message = `No bank transaction data since ${liquidity.as_of} (${daysSince} days ago)`;

        await this.db.insert(alerts).values({
          id: alertId,
          deal_id: dealId,
          type: "data_gap",
          severity: "warning",
          message,
          created_at: nowStr,
        });

        await this.audit.record({
          deal_id: dealId,
          type: "ALERT_CREATED",
          actor,
          timestamp: nowStr,
          object_type: "alert",
          object_id: alertId,
          metadata: {
            alert_id: alertId,
            alert_type: "data_gap",
            severity: "warning",
            days_since_last_transaction: daysSince,
          },
        });

        generatedAlerts.push({
          id: alertId,
          type: "data_gap",
          severity: "warning",
          message,
          created_at: nowStr,
        });
      }
    }

    return generatedAlerts;
  }
}
