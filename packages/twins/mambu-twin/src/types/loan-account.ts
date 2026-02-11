export type LoanAccountState =
  | "PARTIAL_APPLICATION"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "ACTIVE"
  | "ACTIVE_IN_ARREARS"
  | "CLOSED"
  | "CLOSED_WRITTEN_OFF"
  | "CLOSED_REJECTED";

export type LoanAccountSubState =
  | "PARTIALLY_DISBURSED"
  | "LOCKED"
  | "LOCKED_CAPPING"
  | "REFINANCED"
  | "RESCHEDULED"
  | "WITHDRAWN"
  | "REPAID"
  | "REJECTED"
  | "WRITTEN_OFF"
  | "TERMINATED";

export interface LoanScheduleSettings {
  repaymentInstallments?: number;
  repaymentPeriodCount?: number;
  repaymentPeriodUnit?: "DAYS" | "WEEKS" | "MONTHS" | "YEARS";
  repaymentScheduleMethod?: "NONE" | "FIXED" | "DYNAMIC";
  scheduleDueDatesMethod?: "INTERVAL" | "FIXED_DAYS_OF_MONTH";
  fixedDaysOfMonth?: number[];
  shortMonthHandlingMethod?: "LAST_DAY_IN_MONTH" | "FIRST_DAY_OF_NEXT_MONTH";
  gracePeriod?: number;
  gracePeriodType?: "NONE" | "PAY_INTEREST_ONLY" | "INTEREST_FORGIVENESS";
  amortizationMethod?:
    | "STANDARD_PAYMENTS"
    | "BALLOON_PAYMENTS"
    | "OPTIMIZED_PAYMENTS"
    | "PAYMENT_PLAN";
  repaymentReschedulingMethod?: "NONE" | "NEXT_WORKING_DAY" | "PREVIOUS_WORKING_DAY" | "EXTEND_SCHEDULE";
  hasCustomSchedule?: boolean;
  periodicPayment?: number;
  paymentPlan?: Array<{ amount: number; toInstallment: number }>;
  firstRepaymentDate?: string;
}

export interface LoanInterestSettings {
  interestRate?: number;
  interestSpread?: number;
  interestRateSource?: "FIXED_INTEREST_RATE" | "INDEX_INTEREST_RATE";
  interestRateTerms?: "FIXED" | "TIERED" | "TIERED_PERIOD" | "TIERED_BAND";
  interestChargeFrequency?: "ANNUALIZED" | "EVERY_MONTH" | "EVERY_FOUR_WEEKS" | "EVERY_WEEK" | "EVERY_DAY" | "EVERY_X_DAYS";
  interestChargeFrequencyCount?: number;
  interestCalculationMethod?: "FLAT" | "DECLINING_BALANCE" | "DECLINING_BALANCE_DISCOUNTED" | "EQUAL_INSTALLMENTS";
  interestType?: "SIMPLE_INTEREST" | "CAPITALIZED_INTEREST" | "COMPOUNDING_INTEREST";
  interestApplicationMethod?: "AFTER_DISBURSEMENT" | "REPAYMENT_DUE_DATE" | "FIXED_DAYS_OF_MONTH";
  interestBalanceCalculationMethod?: "ONLY_PRINCIPAL" | "PRINCIPAL_AND_INTEREST" | "PRINCIPAL_AND_FEE" | "PRINCIPAL_INTEREST_AND_FEE";
  interestRateReviewUnit?: "DAYS" | "WEEKS" | "MONTHS";
  interestRateReviewCount?: number;
  interestFloorValue?: number;
  interestCeilingValue?: number;
  indexRateSourceKey?: string;
  accrueInterestAfterMaturity?: boolean;
  accrueLateInterest?: boolean;
}

export interface LoanPenaltySettings {
  penaltyRate?: number;
  loanPenaltyCalculationMethod?: "NONE" | "OVERDUE_BALANCE" | "OVERDUE_BALANCE_AND_INTEREST" | "OVERDUE_BALANCE_INTEREST_AND_FEE" | "OUTSTANDING_PRINCIPAL";
  loanPenaltyGracePeriod?: number;
}

export interface LoanPrepaymentSettings {
  prepaymentRecalculationMethod?: string;
  futurePaymentsAcceptance?: "NO_FUTURE_PAYMENTS" | "ACCEPT_FUTURE_PAYMENTS" | "ACCEPT_OVERPAYMENTS";
  principalPaidInstallmentStatus?: string;
  elementsRecalculationMethod?: string;
  applyInterestOnPrepaymentMethod?: string;
}

export interface LoanBalances {
  principalDue: number;
  principalPaid: number;
  principalBalance: number;
  interestDue: number;
  interestPaid: number;
  interestBalance: number;
  interestFromArrearsBalance: number;
  interestFromArrearsDue: number;
  interestFromArrearsPaid: number;
  feesDue: number;
  feesPaid: number;
  feesBalance: number;
  penaltyDue: number;
  penaltyPaid: number;
  penaltyBalance: number;
  holdBalance: number;
  redrawBalance: number;
  totalBalance: number;
}

export interface DisbursementDetails {
  expectedDisbursementDate?: string;
  disbursementDate?: string;
  firstRepaymentDate?: string;
  transactionDetails?: {
    transactionChannelId?: string;
    transactionChannelKey?: string;
  };
  fees?: Array<{ predefinedFeeEncodedKey?: string; amount?: number }>;
}

export interface Guarantor {
  encodedKey?: string;
  guarantorKey?: string;
  guarantorType?: "CLIENT" | "GROUP";
  amount?: number;
  assetName?: string;
}

export interface LoanTranche {
  encodedKey?: string;
  amount?: number;
  expectedDisbursementDate?: string;
  disbursementTransactionKey?: string;
  trancheNumber?: number;
}

export interface LoanAccount {
  encodedKey: string;
  id: string;
  loanName?: string;
  loanAmount: number;
  productTypeKey: string;
  accountHolderKey: string;
  accountHolderType: "CLIENT" | "GROUP";
  accountState: LoanAccountState;
  accountSubState?: LoanAccountSubState;
  assignedBranchKey?: string;
  assignedCentreKey?: string;
  assignedUserKey?: string;
  creditArrangementKey?: string;
  currencyCode?: string;
  scheduleSettings?: LoanScheduleSettings;
  interestSettings?: LoanInterestSettings;
  penaltySettings?: LoanPenaltySettings;
  prepaymentSettings?: LoanPrepaymentSettings;
  disbursementDetails?: DisbursementDetails;
  balances: LoanBalances;
  guarantors?: Guarantor[];
  tranches?: LoanTranche[];
  futurePaymentsAcceptance?: string;
  paymentMethod?: "HORIZONTAL" | "VERTICAL";
  latePaymentsRecalculationMethod?: string;
  lockedOperations?: string[];
  notes?: string;
  migrationEventKey?: string;
  activationTransactionKey?: string;
  accrueInterestAfterMaturity?: boolean;
  accrueLateInterest?: boolean;
  taxRate?: number;
  approvedDate?: string;
  closedDate?: string;
  creationDate: string;
  lastModifiedDate: string;
  [key: string]: unknown;
}

export interface CreateLoanAccountInput {
  id?: string;
  loanName?: string;
  loanAmount: number;
  productTypeKey: string;
  accountHolderKey: string;
  accountHolderType: "CLIENT" | "GROUP";
  assignedBranchKey?: string;
  assignedCentreKey?: string;
  assignedUserKey?: string;
  creditArrangementKey?: string;
  currencyCode?: string;
  scheduleSettings?: LoanScheduleSettings;
  interestSettings?: LoanInterestSettings;
  penaltySettings?: LoanPenaltySettings;
  prepaymentSettings?: LoanPrepaymentSettings;
  disbursementDetails?: DisbursementDetails;
  guarantors?: Guarantor[];
  tranches?: LoanTranche[];
  notes?: string;
  [key: string]: unknown;
}
