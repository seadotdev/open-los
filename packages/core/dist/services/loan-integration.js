import { eq } from "drizzle-orm";
import { facilities, deals } from "../schema/tables.js";
import { NotFoundError } from "./errors.js";
/**
 * Integration helpers for connecting the loan ledger with other Open LOS components.
 * These functions provide the glue between facility approval workflow and loan account creation.
 */
/**
 * Maps Open LOS facility interest rate type to Mambu-style rate type
 */
function mapInterestRateType(facilityRateType) {
    if (!facilityRateType)
        return undefined;
    return facilityRateType === "fixed" ? "FIXED" : "FLOATING";
}
/**
 * Maps Open LOS facility type to repayment method
 */
function mapRepaymentMethod(facilityType) {
    switch (facilityType) {
        case "revolver":
            return "INTEREST_ONLY";
        case "letter_of_credit":
            return "BALLOON";
        case "term_loan":
        default:
            return "EQUAL_INSTALLMENTS";
    }
}
/**
 * Calculate first repayment date based on facility disbursement date
 * Default: First of next month after a 30-day grace period
 */
function calculateFirstRepaymentDate(disbursementDate, gracePeriodDays = 30) {
    const disbursement = new Date(disbursementDate);
    const firstRepayment = new Date(disbursement);
    firstRepayment.setDate(firstRepayment.getDate() + gracePeriodDays);
    // Move to first of next month
    firstRepayment.setMonth(firstRepayment.getMonth() + 1);
    firstRepayment.setDate(1);
    return firstRepayment.toISOString().split("T")[0];
}
/**
 * Creates a loan account from an approved facility.
 * This should be called when a facility transitions to 'approved' or 'active' status.
 *
 * @param db Database instance
 * @param loanAccountService LoanAccountService instance
 * @param input Configuration for creating the loan
 * @param actor The user/system creating the loan
 * @param tenantId Tenant ID
 * @returns The created loan account
 */
export async function createLoanAccountFromFacility(db, loanAccountService, input, actor, tenantId = "default") {
    // Get facility details
    const facilityRows = await db
        .select()
        .from(facilities)
        .where(eq(facilities.id, input.facility_id));
    if (facilityRows.length === 0) {
        throw new NotFoundError(`Facility ${input.facility_id} not found`);
    }
    const facility = facilityRows[0];
    // Get deal details
    const dealRows = await db.select().from(deals).where(eq(deals.id, input.deal_id));
    if (dealRows.length === 0) {
        throw new NotFoundError(`Deal ${input.deal_id} not found`);
    }
    const deal = dealRows[0];
    // Use deal's primary entity if no account holder specified
    const accountHolderId = input.account_holder_id || deal.primary_entity_id;
    if (!accountHolderId) {
        throw new NotFoundError("No account holder specified and deal has no primary entity");
    }
    // Calculate first repayment date
    const now = new Date().toISOString().split("T")[0];
    const firstRepaymentDate = input.first_repayment_date ?? calculateFirstRepaymentDate(now, input.grace_period_days);
    // Build loan account input
    const loanInput = {
        account_holder_type: "CLIENT",
        account_holder_id: accountHolderId,
        facility_id: input.facility_id,
        deal_id: input.deal_id,
        loan_amount: facility.amount,
        currency: facility.currency,
        interest_rate: facility.interest_rate_value ?? undefined,
        interest_rate_type: mapInterestRateType(facility.interest_rate_type),
        interest_rate_spread: facility.interest_rate_spread ?? undefined,
        interest_calculation_method: "DECLINING_BALANCE",
        repayment_method: mapRepaymentMethod(facility.type),
        repayment_frequency: input.repayment_frequency ?? "MONTHLY",
        term_months: facility.term_months ?? undefined,
        grace_period_days: input.grace_period_days ?? 0,
        first_repayment_date: firstRepaymentDate,
        custom_fields: input.custom_fields,
    };
    // Create the loan account
    const loanAccount = await loanAccountService.create(loanInput, actor, tenantId);
    return loanAccount;
}
/**
 * Helper to auto-approve a loan account after creation (for streamlined workflow)
 */
export async function approveLoanAccount(loanAccountService, loanAccountId, notes, actor, tenantId = "default") {
    return loanAccountService.approve(loanAccountId, notes, actor, tenantId);
}
/**
 * Full workflow: Create and approve loan from facility
 * Use this when the facility has been approved and you want to immediately
 * create an approved loan account ready for disbursement.
 */
export async function createApprovedLoanFromFacility(db, loanAccountService, input, approvalNotes, actor, tenantId = "default") {
    // Create the loan account
    const loanAccount = await createLoanAccountFromFacility(db, loanAccountService, input, actor, tenantId);
    // Approve it
    await loanAccountService.approve(loanAccount.id, approvalNotes, actor, tenantId);
    // Return updated loan account
    return loanAccountService.getById(loanAccount.id, tenantId);
}
/**
 * Get loan balance for covenant testing
 * Returns the total outstanding balance for a loan associated with a deal
 */
export async function getLoanBalanceForDeal(loanAccountService, dealId, tenantId = "default") {
    const result = await loanAccountService.listByDeal(dealId, tenantId);
    let totalOutstanding = 0;
    let principalOutstanding = 0;
    for (const loan of result.loan_accounts) {
        if (loan.state !== "CLOSED") {
            totalOutstanding +=
                (loan.principal_outstanding ?? 0) +
                    (loan.interest_accrued ?? 0) +
                    (loan.fees_outstanding ?? 0) +
                    (loan.penalties_outstanding ?? 0);
            principalOutstanding += loan.principal_outstanding ?? 0;
        }
    }
    return {
        total_outstanding: totalOutstanding,
        principal_outstanding: principalOutstanding,
    };
}
/**
 * Check arrears for all loans in a deal
 * Returns arrears status aggregated across all loans
 */
export async function checkDealArrearsStatus(loanAccountService, dealId, asOfDate, tenantId = "default") {
    const result = await loanAccountService.listByDeal(dealId, tenantId);
    let anyInArrears = false;
    let maxDaysInArrears = 0;
    let totalOverdueAmount = 0;
    let accountsInArrears = 0;
    for (const loan of result.loan_accounts) {
        if (["ACTIVE", "ACTIVE_IN_ARREARS"].includes(loan.state)) {
            const arrears = await loanAccountService.checkArrears(loan.id, asOfDate, tenantId);
            if (arrears.in_arrears) {
                anyInArrears = true;
                accountsInArrears++;
                totalOverdueAmount += arrears.overdue_amount;
                if (arrears.days_in_arrears > maxDaysInArrears) {
                    maxDaysInArrears = arrears.days_in_arrears;
                }
            }
        }
    }
    return {
        any_in_arrears: anyInArrears,
        max_days_in_arrears: maxDaysInArrears,
        total_overdue_amount: totalOverdueAmount,
        accounts_in_arrears: accountsInArrears,
    };
}
//# sourceMappingURL=loan-integration.js.map