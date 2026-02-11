export interface LoanProduct {
  encodedKey: string;
  id: string;
  name: string;
  state: "ACTIVE" | "INACTIVE";
  productType: string;
  interestCalculationMethod?: string;
  repaymentMethod?: string;
  repaymentFrequency?: string;
  defaultTermMonths?: number;
  gracePeriodDays?: number;
  interestRateSettings?: {
    defaultRate?: number;
    minRate?: number;
    maxRate?: number;
    rateType?: "FIXED" | "FLOATING";
  };
  fees?: Array<{
    encodedKey?: string;
    name?: string;
    amount?: number;
    trigger?: string;
  }>;
  creationDate: string;
  lastModifiedDate: string;
}

export interface CreateLoanProductInput {
  id?: string;
  name: string;
  productType?: string;
  interestCalculationMethod?: string;
  repaymentMethod?: string;
  repaymentFrequency?: string;
  defaultTermMonths?: number;
  gracePeriodDays?: number;
  interestRateSettings?: {
    defaultRate?: number;
    minRate?: number;
    maxRate?: number;
    rateType?: "FIXED" | "FLOATING";
  };
}
