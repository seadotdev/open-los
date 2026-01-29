import type { Database } from "../schema/db.js";
import type { AuditService } from "./audit.js";
import type { CovenantTestResult } from "./covenant.js";
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
export declare class MonitoringService {
    private db;
    private audit;
    private getNow;
    constructor(db: Database, audit: AuditService, getNow: () => string);
    ingest(dealId: string, input: IngestInput | string, actor: string, isCSV?: boolean): Promise<{
        ingestion_id: `${string}-${string}-${string}-${string}-${string}`;
        records_accepted: number;
    }>;
    getStatus(dealId: string, actor: string): Promise<MonitoringStatus>;
    private computeLiquidity;
    private testCovenants;
    private getMetricValue;
    private getActiveWaiver;
    private generateAlerts;
}
//# sourceMappingURL=monitoring.d.ts.map