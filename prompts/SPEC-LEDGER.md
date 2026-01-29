# Loan Ledger Integration Spec

> Mambu-compatible loan ledger for Open LOS

## Overview

This spec defines a loan ledger layer that:
1. Tracks the lender's loan book (disbursements, repayments, balances)
2. Follows Mambu API patterns for enterprise migration path
3. Integrates cleanly with existing Open LOS deal workflow
4. Remains focused on B2B lending (ignores retail banking, deposits, payments gateway)

### What This Is NOT

- **Not replacing `bank_transactions`** - that's borrower bank statement data for monitoring
- **Not a full core banking system** - no GL, no deposits, no payments clearing
- **Not Mambu itself** - a compatible subset focused on loan lifecycle

---

## Concept Mapping: Open LOS → Mambu

| Open LOS Concept | Mambu Concept | Relationship |
|------------------|---------------|--------------|
| `entities` (type: company) | **Client** | 1:1 mapping |
| `entities` (type: person) | **Client** | 1:1 mapping |
| `relationships` (borrower group) | **Group** | Entity graph → Group |
| `deals` | — | No direct equivalent (deals are pre-origination) |
| `facilities` | **Loan Product** (template) | Facility type → product template |
| — (missing) | **Loan Account** | New: tracks actual loan lifecycle |
| `bank_transactions` | — | Borrower data, not lender ledger |
| `covenants` / `covenant_tests` | — | Open LOS specific (Mambu has limited support) |

### Key Insight

Mambu's model separates:
- **Loan Product** = template defining terms, rates, fees, schedules
- **Loan Account** = instance of a product for a specific borrower

Open LOS currently has:
- **Facility** = proposed/approved loan terms on a deal

The integration creates:
- **Loan Account** = when a facility is disbursed, it becomes an active loan account

---

## Deal → Loan Account Lifecycle

```
Deal Workflow (existing)              Loan Ledger (new)
────────────────────────              ─────────────────
broker
    ↓
origination
    ↓
underwriting
    ↓
  Facility created ─────────────────→ (no loan account yet)
    ↓
  Facility approved ────────────────→ Loan Account created (APPROVED state)
    ↓
closing
    ↓
  Deal moves to monitoring ─────────→ Loan Account disbursed (ACTIVE state)
    ↓                                     ↓
monitoring                            Repayments, interest accrual
    ↓                                     ↓
  Loan paid off ────────────────────→ Loan Account CLOSED (PAID_OFF)
```

---

## Schema Additions

### 1. Loan Products (Optional - can use facility types directly)

```typescript
// Only needed if you want reusable product templates
// Otherwise, facility defines terms inline

export const loanProducts = sqliteTable("loan_products", {
  id: text("id").primaryKey(),
  tenant_id: text("tenant_id").notNull().default("default"),

  // Identity
  encoded_key: text("encoded_key").notNull().unique(), // Mambu-style UUID
  name: text("name").notNull(),
  product_type: text("product_type").notNull(), // "FIXED_TERM" | "REVOLVING" | "BULLET"

  // Interest
  interest_calculation_method: text("interest_calculation_method"), // "DECLINING_BALANCE" | "FLAT"
  interest_rate_settings: text("interest_rate_settings", { mode: "json" }),
  // { default_rate, min_rate, max_rate, rate_type: "FIXED" | "FLOATING" }

  // Repayment
  repayment_method: text("repayment_method"), // "EQUAL_INSTALLMENTS" | "BALLOON" | "INTEREST_ONLY"
  repayment_frequency: text("repayment_frequency"), // "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY"
  default_term_months: integer("default_term_months"),
  grace_period_days: integer("grace_period_days").default(0),

  // Fees (simplified - Mambu has complex fee structures)
  fees: text("fees", { mode: "json" }), // [{ name, trigger, amount_type, amount }]

  // State
  state: text("state").notNull().default("ACTIVE"), // "ACTIVE" | "INACTIVE"

  created_at: text("created_at").notNull(),
  updated_at: text("updated_at"),
});
```

### 2. Loan Accounts (Core Addition)

```typescript
export const loanAccounts = sqliteTable("loan_accounts", {
  id: text("id").primaryKey(),
  tenant_id: text("tenant_id").notNull().default("default"),

  // Mambu-style identifiers
  encoded_key: text("encoded_key").notNull().unique(), // UUID for API compatibility
  account_id: text("account_id").notNull().unique(),   // Human-readable (e.g., "LN-00001")

  // Relationships
  deal_id: text("deal_id").references(() => deals.id),           // Link to originating deal
  facility_id: text("facility_id").references(() => facilities.id), // Link to facility
  product_id: text("product_id"),                                  // Optional product template

  // Account holder (maps to Mambu's accountHolderType + accountHolderKey)
  account_holder_type: text("account_holder_type").notNull(), // "CLIENT" (maps to entity)
  account_holder_id: text("account_holder_id").notNull(),     // → entities.id

  // State machine (Mambu states)
  state: text("state").notNull().default("PENDING_APPROVAL"),
  // "PARTIAL_APPLICATION" | "PENDING_APPROVAL" | "APPROVED" |
  // "ACTIVE" | "ACTIVE_IN_ARREARS" | "LOCKED" | "CLOSED"
  sub_state: text("sub_state"),
  // "WITHDRAWN" | "REJECTED" | "WRITTEN_OFF" | "PAID_OFF" |
  // "REFINANCED" | "RESCHEDULED"

  // Terms (copied from facility/product at creation, immutable after approval)
  loan_amount: integer("loan_amount").notNull(),              // Approved amount (minor units)
  currency: text("currency").notNull().default("USD"),
  interest_rate: real("interest_rate"),                       // Annual rate (0.05 = 5%)
  interest_rate_type: text("interest_rate_type"),             // "FIXED" | "FLOATING"
  interest_rate_spread: real("interest_rate_spread"),         // Spread over base (floating)
  interest_calculation_method: text("interest_calculation_method"), // "DECLINING_BALANCE" | "FLAT"
  repayment_method: text("repayment_method"),                 // "EQUAL_INSTALLMENTS" | "BALLOON"
  repayment_frequency: text("repayment_frequency"),           // "MONTHLY" | "QUARTERLY"
  term_months: integer("term_months"),
  grace_period_days: integer("grace_period_days").default(0),
  first_repayment_date: text("first_repayment_date"),         // ISO date

  // Balances (updated on each transaction)
  principal_disbursed: integer("principal_disbursed").default(0),
  principal_outstanding: integer("principal_outstanding").default(0),
  principal_paid: integer("principal_paid").default(0),
  interest_accrued: integer("interest_accrued").default(0),
  interest_paid: integer("interest_paid").default(0),
  fees_outstanding: integer("fees_outstanding").default(0),
  fees_paid: integer("fees_paid").default(0),
  penalties_outstanding: integer("penalties_outstanding").default(0),
  penalties_paid: integer("penalties_paid").default(0),

  // Arrears tracking
  days_in_arrears: integer("days_in_arrears").default(0),
  arrears_since: text("arrears_since"),                       // ISO date when arrears started

  // Lifecycle timestamps
  approved_at: text("approved_at"),
  approved_by: text("approved_by"),
  disbursed_at: text("disbursed_at"),
  disbursed_by: text("disbursed_by"),
  closed_at: text("closed_at"),
  closed_by: text("closed_by"),
  locked_at: text("locked_at"),

  // Extension
  custom_fields: text("custom_fields", { mode: "json" }),

  created_at: text("created_at").notNull(),
  updated_at: text("updated_at"),
});

// Indexes
// idx_loan_accounts_tenant_state
// idx_loan_accounts_holder
// idx_loan_accounts_deal
// idx_loan_accounts_account_id
```

### 3. Loan Transactions

```typescript
export const loanTransactions = sqliteTable("loan_transactions", {
  id: text("id").primaryKey(),
  tenant_id: text("tenant_id").notNull().default("default"),

  // Mambu-style identifier
  encoded_key: text("encoded_key").notNull().unique(),

  // Parent
  loan_account_id: text("loan_account_id")
    .notNull()
    .references(() => loanAccounts.id),

  // Transaction type (Mambu-compatible subset)
  type: text("type").notNull(),
  // State changes: "APPROVAL" | "PENDING_APPROVAL" | "UNDO_APPROVAL" |
  //                "REJECT" | "WITHDRAW" | "LOCK" | "UNLOCK"
  // Financial: "DISBURSEMENT" | "REPAYMENT" | "FEE" | "INTEREST_APPLIED" |
  //            "PENALTY_APPLIED" | "WRITE_OFF"
  // Adjustments: "DISBURSEMENT_ADJUSTMENT" | "REPAYMENT_ADJUSTMENT" |
  //              "FEE_ADJUSTMENT" | "INTEREST_ADJUSTMENT" | "WRITE_OFF_ADJUSTMENT"

  // Dates (Mambu uses three dates)
  entry_date: text("entry_date").notNull(),   // When posted to system
  value_date: text("value_date").notNull(),   // Effective date for interest calc
  booking_date: text("booking_date"),          // When hit the books (often same as entry)

  // Amounts (minor units)
  amount: integer("amount").notNull(),                   // Total transaction amount
  principal_amount: integer("principal_amount"),         // Principal portion
  interest_amount: integer("interest_amount"),           // Interest portion
  fees_amount: integer("fees_amount"),                   // Fees portion
  penalties_amount: integer("penalties_amount"),         // Penalties portion

  // Balance after transaction (snapshot for audit)
  balance_principal: integer("balance_principal"),
  balance_interest: integer("balance_interest"),
  balance_fees: integer("balance_fees"),
  balance_total: integer("balance_total"),

  // Reversal tracking
  original_transaction_id: text("original_transaction_id"), // If this is a reversal
  reversed_by_transaction_id: text("reversed_by_transaction_id"), // If this was reversed

  // Disbursement details (when type = DISBURSEMENT)
  disbursement_details: text("disbursement_details", { mode: "json" }),
  // { method, channel, expected_date, fees: [] }

  // Repayment allocation (when type = REPAYMENT)
  repayment_allocation: text("repayment_allocation", { mode: "json" }),
  // { allocation_order, custom_amounts: { principal, interest, fees, penalties } }

  // Idempotency (Mambu pattern - prevents duplicate transactions)
  idempotency_key: text("idempotency_key").unique(),

  // Audit
  actor: text("actor").notNull(),
  notes: text("notes"),

  created_at: text("created_at").notNull(),
});

// Indexes
// idx_loan_transactions_account
// idx_loan_transactions_type
// idx_loan_transactions_value_date
// idx_loan_transactions_idempotency
```

### 4. Repayment Schedule

```typescript
export const repaymentSchedule = sqliteTable("repayment_schedule", {
  id: text("id").primaryKey(),

  loan_account_id: text("loan_account_id")
    .notNull()
    .references(() => loanAccounts.id),

  // Installment identity
  installment_number: integer("installment_number").notNull(),
  encoded_key: text("encoded_key").notNull(),

  // Due date
  due_date: text("due_date").notNull(), // ISO date

  // Expected amounts (minor units)
  principal_due: integer("principal_due").notNull().default(0),
  interest_due: integer("interest_due").notNull().default(0),
  fees_due: integer("fees_due").notNull().default(0),
  penalties_due: integer("penalties_due").notNull().default(0),

  // Paid amounts
  principal_paid: integer("principal_paid").notNull().default(0),
  interest_paid: integer("interest_paid").notNull().default(0),
  fees_paid: integer("fees_paid").notNull().default(0),
  penalties_paid: integer("penalties_paid").notNull().default(0),

  // State
  state: text("state").notNull().default("PENDING"),
  // "PENDING" | "PARTIALLY_PAID" | "PAID" | "LATE" | "GRACE_PERIOD"

  // Tracking
  last_payment_date: text("last_payment_date"),

  created_at: text("created_at").notNull(),
  updated_at: text("updated_at"),
});

// Unique constraint: (loan_account_id, installment_number)
// Index: idx_schedule_due_date
```

---

## API Design (Mambu-Compatible)

### Base URL Pattern

```
/v1/loans                     # Loan accounts
/v1/loans/{id}/transactions   # Account transactions
/v1/loans/{id}/schedule       # Repayment schedule
/v1/loanproducts              # Product templates (optional)
```

### Headers (Mambu conventions)

```http
Accept: application/vnd.mambu.v2+json  # Version via Accept header
X-Actor: user@example.com              # Audit actor (existing Open LOS pattern)
Idempotency-Key: <uuid>                # For transaction idempotency
```

### Endpoints

#### Loan Accounts

```yaml
# Create loan account (typically from facility approval)
POST /v1/loans
Request:
  accountHolderType: "CLIENT"
  accountHolderKey: "<entity_id>"
  productTypeKey: "<product_id>"        # Optional
  facilityId: "<facility_id>"           # Open LOS extension
  dealId: "<deal_id>"                   # Open LOS extension
  loanAmount: 10000000                  # Minor units
  interestRate: "0.08"
  interestRateType: "FIXED"
  repaymentInstallments: 12
  repaymentPeriodUnit: "MONTHS"
  gracePeriod: 0
  firstRepaymentDate: "2024-02-01"
Response:
  encodedKey: "<uuid>"
  id: "LN-00001"
  accountState: "PENDING_APPROVAL"
  ...

# Get loan account
GET /v1/loans/{id}
GET /v1/loans/{id}?detailsLevel=FULL   # Include schedule + transactions

# Update loan account (only in PENDING_APPROVAL or APPROVED states)
PATCH /v1/loans/{id}
Request:
  loanAmount: 12000000
  interestRate: "0.075"

# Search loan accounts
POST /v1/loans:search
Request:
  filterCriteria:
    - field: "accountState"
      operator: "EQUALS"
      value: "ACTIVE"
    - field: "accountHolderKey"
      operator: "EQUALS"
      value: "<entity_id>"
  sortingCriteria:
    field: "createdAt"
    order: "DESC"
```

#### Transactions (State Changes + Financial)

All state changes and financial operations go through the transactions endpoint:

```yaml
# Request approval
POST /v1/loans/{id}/transactions
Request:
  type: "PENDING_APPROVAL"
  notes: "Ready for credit committee"
Response:
  encodedKey: "<uuid>"
  type: "PENDING_APPROVAL"
  ...

# Approve
POST /v1/loans/{id}/transactions
Request:
  type: "APPROVAL"
  notes: "Approved by credit committee"

# Disburse
POST /v1/loans/{id}/transactions
Headers:
  Idempotency-Key: "<uuid>"
Request:
  type: "DISBURSEMENT"
  amount: 10000000
  valueDate: "2024-01-15"
  disbursementDetails:
    expectedDisbursementDate: "2024-01-15"
    fees: []
  notes: "Initial drawdown"
Response:
  encodedKey: "<uuid>"
  type: "DISBURSEMENT"
  amount: 10000000
  principalAmount: 10000000
  balancePrincipal: 10000000
  ...

# Repayment
POST /v1/loans/{id}/transactions
Headers:
  Idempotency-Key: "<uuid>"
Request:
  type: "REPAYMENT"
  amount: 500000
  valueDate: "2024-02-01"
  notes: "Monthly payment"
Response:
  encodedKey: "<uuid>"
  type: "REPAYMENT"
  amount: 500000
  principalAmount: 420000
  interestAmount: 80000
  balancePrincipal: 9580000
  ...

# Custom repayment allocation
POST /v1/loans/{id}/transactions
Request:
  type: "REPAYMENT"
  amount: 500000
  valueDate: "2024-02-01"
  customPaymentAmounts:
    principal: 500000
    interest: 0
  notes: "Principal-only payment"

# Apply fee
POST /v1/loans/{id}/transactions
Request:
  type: "FEE"
  amount: 10000
  valueDate: "2024-02-15"
  notes: "Late payment fee"

# Write off
POST /v1/loans/{id}/transactions
Request:
  type: "WRITE_OFF"
  notes: "Uncollectible - provisioned"

# Reverse a transaction
POST /v1/loans/{id}/transactions
Request:
  type: "REPAYMENT_ADJUSTMENT"
  originalTransactionKey: "<transaction_encoded_key>"
  notes: "Payment returned - NSF"

# Lock account
POST /v1/loans/{id}/transactions
Request:
  type: "LOCK"
  notes: "Under investigation"

# Close account
POST /v1/loans/{id}/transactions
Request:
  type: "CLOSE"
  notes: "Paid in full"
```

#### Transaction Queries

```yaml
# Get transactions for account
GET /v1/loans/{id}/transactions
GET /v1/loans/{id}/transactions?offset=0&limit=50

# Search transactions across accounts
POST /v1/loans/transactions:search
Request:
  filterCriteria:
    - field: "type"
      operator: "IN"
      values: ["DISBURSEMENT", "REPAYMENT"]
    - field: "valueDate"
      operator: "BETWEEN"
      value: "2024-01-01"
      secondValue: "2024-01-31"
```

#### Schedule

```yaml
# Get repayment schedule
GET /v1/loans/{id}/schedule

# Preview schedule (before disbursement)
GET /v1/loanproducts/{productId}/schedule?loanAmount=10000000&interestRate=0.08&installments=12&firstRepaymentDate=2024-02-01
```

---

## Service Layer

### LoanAccountService

```typescript
interface LoanAccountService {
  // CRUD
  create(input: CreateLoanAccountInput, actor: string): Promise<LoanAccount>;
  getById(id: string): Promise<LoanAccount>;
  getByEncodedKey(encodedKey: string): Promise<LoanAccount>;
  update(id: string, input: UpdateLoanAccountInput, actor: string): Promise<LoanAccount>;
  search(criteria: SearchCriteria): Promise<LoanAccount[]>;

  // State transitions (via transaction)
  requestApproval(id: string, notes: string, actor: string): Promise<LoanTransaction>;
  approve(id: string, notes: string, actor: string): Promise<LoanTransaction>;
  reject(id: string, notes: string, actor: string): Promise<LoanTransaction>;
  withdraw(id: string, notes: string, actor: string): Promise<LoanTransaction>;
  lock(id: string, notes: string, actor: string): Promise<LoanTransaction>;
  unlock(id: string, notes: string, actor: string): Promise<LoanTransaction>;
  close(id: string, notes: string, actor: string): Promise<LoanTransaction>;

  // Financial operations
  disburse(id: string, input: DisburseInput, actor: string): Promise<LoanTransaction>;
  repay(id: string, input: RepayInput, actor: string): Promise<LoanTransaction>;
  applyFee(id: string, input: FeeInput, actor: string): Promise<LoanTransaction>;
  applyInterest(id: string, asOfDate: string, actor: string): Promise<LoanTransaction>;
  writeOff(id: string, notes: string, actor: string): Promise<LoanTransaction>;

  // Reversals
  reverseTransaction(id: string, transactionId: string, notes: string, actor: string): Promise<LoanTransaction>;

  // Queries
  getTransactions(id: string, options?: PaginationOptions): Promise<LoanTransaction[]>;
  getSchedule(id: string): Promise<RepaymentScheduleEntry[]>;
  getBalance(id: string): Promise<AccountBalance>;

  // Arrears
  checkArrears(id: string, asOfDate: string): Promise<ArrearsStatus>;
  updateArrearsStatus(id: string, asOfDate: string): Promise<void>;

  // Helpers
  generateSchedule(terms: LoanTerms, startDate: string): RepaymentScheduleEntry[];
  allocateRepayment(account: LoanAccount, amount: number, customAllocation?: Allocation): Allocation;
}
```

### Key Interfaces

```typescript
interface CreateLoanAccountInput {
  accountHolderType: "CLIENT";
  accountHolderId: string;          // entity.id
  productId?: string;               // loan_products.id
  facilityId?: string;              // facilities.id (Open LOS link)
  dealId?: string;                  // deals.id (Open LOS link)

  loanAmount: number;               // Minor units
  currency?: string;
  interestRate: number;
  interestRateType: "FIXED" | "FLOATING";
  interestRateSpread?: number;
  interestCalculationMethod?: "DECLINING_BALANCE" | "FLAT";
  repaymentMethod?: "EQUAL_INSTALLMENTS" | "BALLOON" | "INTEREST_ONLY";
  repaymentFrequency: "MONTHLY" | "QUARTERLY" | "ANNUALLY";
  termMonths: number;
  gracePeriodDays?: number;
  firstRepaymentDate: string;

  customFields?: Record<string, unknown>;
}

interface DisburseInput {
  amount: number;
  valueDate: string;
  idempotencyKey?: string;
  disbursementDetails?: {
    method?: string;
    channel?: string;
    fees?: Array<{ name: string; amount: number }>;
  };
  notes?: string;
}

interface RepayInput {
  amount: number;
  valueDate: string;
  idempotencyKey?: string;
  customAllocation?: {
    principal?: number;
    interest?: number;
    fees?: number;
    penalties?: number;
  };
  notes?: string;
}

interface AccountBalance {
  principalOutstanding: number;
  interestAccrued: number;
  feesOutstanding: number;
  penaltiesOutstanding: number;
  totalOutstanding: number;
  principalPaid: number;
  interestPaid: number;
  totalPaid: number;
}

interface ArrearsStatus {
  inArrears: boolean;
  daysInArrears: number;
  arrearsSince: string | null;
  overdueInstallments: number;
  overdueAmount: number;
}
```

---

## State Machine

### Loan Account States

```
                                    ┌──────────────┐
                                    │   PARTIAL    │
                                    │ APPLICATION  │
                                    └──────┬───────┘
                                           │ requestApproval()
                                           ▼
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│  ┌──────────────┐   approve()   ┌──────────────┐              │
│  │   PENDING    │──────────────▶│   APPROVED   │              │
│  │   APPROVAL   │               └──────┬───────┘              │
│  └──────┬───────┘                      │                      │
│         │                              │ disburse()           │
│         │ reject()                     ▼                      │
│         │              ┌──────────────────────────────┐       │
│         │              │           ACTIVE             │       │
│         │              └──────────────┬───────────────┘       │
│         │                             │                       │
│         │              ┌──────────────┼───────────────┐       │
│         │              │              │               │       │
│         │              ▼              ▼               ▼       │
│         │     ┌────────────┐  ┌────────────┐  ┌────────────┐ │
│         │     │   ACTIVE   │  │   LOCKED   │  │   CLOSED   │ │
│         │     │ IN_ARREARS │  │            │  │            │ │
│         │     └────────────┘  └────────────┘  └────────────┘ │
│         │                                            ▲       │
│         │                                            │       │
│         ▼                                            │       │
│  ┌──────────────┐                                    │       │
│  │    CLOSED    │────────────────────────────────────┘       │
│  │  (REJECTED)  │                                            │
│  └──────────────┘                                            │
│                                                              │
└────────────────────────────────────────────────────────────────┘

Sub-states for CLOSED:
  - WITHDRAWN (client withdrew application)
  - REJECTED (lender rejected)
  - PAID_OFF (fully repaid)
  - WRITTEN_OFF (bad debt)
  - REFINANCED (replaced by new loan)
  - RESCHEDULED (terms restructured)
```

### Allowed State Transitions

```typescript
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  "PARTIAL_APPLICATION": ["PENDING_APPROVAL"],
  "PENDING_APPROVAL": ["APPROVED", "CLOSED"], // CLOSED with sub_state REJECTED/WITHDRAWN
  "APPROVED": ["ACTIVE", "CLOSED"],           // CLOSED with sub_state WITHDRAWN
  "ACTIVE": ["ACTIVE_IN_ARREARS", "LOCKED", "CLOSED"],
  "ACTIVE_IN_ARREARS": ["ACTIVE", "LOCKED", "CLOSED"],
  "LOCKED": ["ACTIVE", "ACTIVE_IN_ARREARS", "CLOSED"],
  "CLOSED": [], // Terminal state
};
```

---

## Integration Points

### 1. Facility → Loan Account Creation

When a facility is approved and the deal moves to closing/monitoring:

```typescript
// In FacilityService or via workflow
async function onFacilityApproved(facility: Facility, deal: Deal, actor: string) {
  // Create loan account from facility terms
  const loanAccount = await loanAccountService.create({
    accountHolderType: "CLIENT",
    accountHolderId: deal.primary_entity_id,
    facilityId: facility.id,
    dealId: deal.id,
    loanAmount: facility.amount,
    currency: facility.currency,
    interestRate: facility.interest_rate_value,
    interestRateType: facility.interest_rate_type === "fixed" ? "FIXED" : "FLOATING",
    interestRateSpread: facility.interest_rate_spread,
    repaymentFrequency: "MONTHLY",
    termMonths: facility.term_months,
    firstRepaymentDate: calculateFirstRepaymentDate(facility),
  }, actor);

  // Update facility with loan account reference
  await facilityService.update(deal.id, facility.id, {
    loan_account_id: loanAccount.id,
  }, actor);

  return loanAccount;
}
```

### 2. Covenant Testing Integration

Covenant tests can reference loan account balances:

```typescript
// In CovenantService
async function testCovenant(covenant: Covenant, deal: Deal) {
  // Get loan account for this deal
  const loanAccounts = await loanAccountService.search({
    filterCriteria: [{ field: "dealId", operator: "EQUALS", value: deal.id }],
  });

  const balance = await loanAccountService.getBalance(loanAccounts[0].id);

  // Test covenants that reference loan data
  if (covenant.metric === "debt_outstanding") {
    return evaluateCovenant(covenant, balance.totalOutstanding);
  }
  // ... other metrics from spreads, bank_transactions
}
```

### 3. Monitoring Alerts

```typescript
// In MonitoringService - check arrears
async function checkLoansForArrears(dealId: string) {
  const loanAccounts = await loanAccountService.search({
    filterCriteria: [
      { field: "dealId", operator: "EQUALS", value: dealId },
      { field: "state", operator: "IN", values: ["ACTIVE", "ACTIVE_IN_ARREARS"] },
    ],
  });

  for (const account of loanAccounts) {
    const arrears = await loanAccountService.checkArrears(account.id, getNow());

    if (arrears.inArrears && arrears.daysInArrears > 30) {
      await alertService.create({
        deal_id: dealId,
        type: "payment_missed",
        severity: "critical",
        message: `Loan ${account.account_id} is ${arrears.daysInArrears} days in arrears`,
      });
    }
  }
}
```

---

## Migration to Mambu

With this design, migrating to Mambu becomes a data migration + API swap:

### 1. Data Export

```typescript
// Export loan accounts in Mambu format
const mambuClients = entities.map(e => ({
  id: e.id,
  firstName: e.type === "person" ? e.name.split(" ")[0] : undefined,
  lastName: e.type === "person" ? e.name.split(" ").slice(1).join(" ") : undefined,
  companyName: e.type === "company" ? e.name : undefined,
  // ...
}));

const mambuLoans = loanAccounts.map(la => ({
  id: la.account_id,
  encodedKey: la.encoded_key,
  accountHolderType: la.account_holder_type,
  accountHolderKey: la.account_holder_id,
  loanAmount: la.loan_amount,
  interestSettings: {
    interestRate: la.interest_rate,
    interestRateSource: la.interest_rate_type,
  },
  // ...
}));
```

### 2. API Facade

```typescript
// Create a Mambu API client that can replace local service
interface LoanLedgerClient {
  createLoanAccount(input: CreateLoanAccountInput): Promise<LoanAccount>;
  disburse(id: string, input: DisburseInput): Promise<LoanTransaction>;
  repay(id: string, input: RepayInput): Promise<LoanTransaction>;
  // ...
}

// Local implementation
class LocalLoanLedgerClient implements LoanLedgerClient {
  constructor(private service: LoanAccountService) {}
  // Uses local SQLite
}

// Mambu implementation
class MambuLoanLedgerClient implements LoanLedgerClient {
  constructor(private apiKey: string, private tenantUrl: string) {}
  // Calls Mambu API
}
```

---

## Out of Scope (Mambu features we don't need)

| Mambu Feature | Reason to Exclude |
|---------------|-------------------|
| Deposit Accounts | B2B lending focus, not retail banking |
| Savings Products | Not applicable |
| Cards / Card Transactions | Not applicable |
| Payments Gateway (SEPA, FPS) | External payment rails, use separate integration |
| Branches / Centres | Single-tenant focus initially |
| Accounting Rules / GL | Separate accounting system integration |
| Notifications / Webhooks | Use existing Open LOS patterns |
| Custom Views / Reports | Use existing Open LOS patterns |

---

## Implementation Order

1. **Phase 1: Schema + Basic CRUD**
   - Add `loan_accounts`, `loan_transactions`, `repayment_schedule` tables
   - Implement `LoanAccountService` with create, get, list, search
   - Add API routes for `/v1/loans`

2. **Phase 2: State Machine**
   - Implement state transitions (requestApproval → approve → disburse)
   - Add transaction recording for each state change
   - Validate state transition rules

3. **Phase 3: Financial Operations**
   - Implement disburse, repay, applyFee, writeOff
   - Add balance calculations
   - Implement repayment allocation logic

4. **Phase 4: Schedule + Arrears**
   - Generate repayment schedule on disbursement
   - Implement arrears detection
   - Link to monitoring alerts

5. **Phase 5: Integration**
   - Link facility approval → loan account creation
   - Add loan balance to covenant testing
   - Add arrears to monitoring
