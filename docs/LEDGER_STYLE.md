# Ledger Style

> *"In finance, there are no rounding errors—only unaudited assumptions."*

<!--
TODO: Source visual assets from https://tigerstyle.dev/ for the deployed version.
Consider similar illustrations for: ledger books, balance scales, audit trails,
transparency/glass metaphors, AI + human collaboration imagery.
-->

This document describes the engineering style for Open LOS. It is not a formatting guide—run `npm run format` for that. Ledger Style is about *how we think* when building financial software in the AI era.

The name comes from the humble ledger: an immutable record of truth that accountants have trusted for centuries. Every entry is permanent. Every balance is verifiable. Every decision has a paper trail.

We write code the same way.

---

## Why Style Matters in Finance

In most software, a bug means a bad user experience. In financial software, a bug means someone's money disappears, a business fails to get funded, or a regulator shuts you down.

The difference between a loan origination system and a todo app isn't complexity—it's *consequence*. When you're managing millions in credit facilities, calculating covenant compliance, or deciding whether a business gets capital, you don't get to "move fast and break things."

And yet: we must still move fast. The old enterprise vendors moved slowly because their incentive was to bill hours, not ship value. We move fast by being *disciplined*, not by being *reckless*.

Ledger Style is the discipline.

---

## The Three Pillars

Every decision in Open LOS code should serve one of three goals:

1. **Auditability** — Can we explain every decision to a regulator, a customer, or ourselves six months from now?
2. **Determinism** — Will the same inputs always produce the same outputs?
3. **Transparency** — Can a human (or AI) understand what this code does without running it?

These aren't just nice-to-haves. They're the foundation of trust in financial software. They're why banks still exist when they could be replaced by spreadsheets.

---

## Auditability

> *"If it's not in the audit log, it didn't happen."*

Every mutation to the system must produce an audit event. This is not optional. This is not "nice to have for compliance." This is the source of truth.

### The Audit Event Contract

Every audit event contains:
- **actor**: Who or what caused this change (user ID, AI agent ID, system)
- **timestamp**: When it happened (ISO 8601 UTC, always)
- **event_type**: What happened (e.g., `deal.stage_changed`, `covenant.waiver_granted`)
- **entity_id**: What was affected
- **changes**: The before/after diff
- **context**: Why it happened (rationale, linked decisions, session ID)

```typescript
// GOOD: Explicit audit event with full context
await auditService.record({
  actor: ctx.userId,
  eventType: 'deal.stage_changed',
  entityId: deal.id,
  changes: {
    before: { stage: 'origination' },
    after: { stage: 'underwriting' }
  },
  context: {
    rationale: 'All required documents received',
    sessionId: ctx.aiSessionId
  }
});

// BAD: Direct database update without audit
await db.update(deals).set({ stage: 'underwriting' }).where(eq(deals.id, dealId));
```

### No Silent Mutations

If code changes state, it must be visible in the audit trail. Period.

This applies to:
- Database writes
- External API calls that modify state
- Cached values that affect decisions
- Configuration changes

If you find yourself writing code that "just updates a field," stop. Ask: "Would a regulator accept 'we just updated a field' as an explanation?"

### Context Is Not Optional

"The stage was changed" is not useful. "The stage was changed to underwriting because documents X, Y, Z were received and verified by user ABC at timestamp T" is useful.

Every audit event should answer the three journalist questions:
- **What** happened?
- **Who** did it?
- **Why** did they do it?

### AI Sessions Are First-Class Audit Citizens

When an AI agent operates the system, we log:
- The session ID (links all actions in one conversation)
- The prompt that triggered the action
- The reasoning the AI provided
- The specific tool calls made

Humans and AI get the same audit treatment. No second-class actors.

---

## Determinism

> *"The same inputs must always produce the same outputs. Always."*

### Financial Calculations Are Mathematics, Not AI

AI is good at reasoning, explaining, and deciding what to do. AI is terrible at arithmetic. We never let AI compute financial values.

```typescript
// GOOD: Deterministic calculation, AI explains the result
const ratio = computeDebtServiceCoverageRatio(spread);
const explanation = await ai.explain(`DSCR is ${ratio}, threshold is 1.25`);

// BAD: AI computes the ratio
const analysis = await ai.analyze('What is the DSCR based on these financials?');
```

### Integer Money, Always

Money is stored as integers in minor units (cents, pence). Never floating point.

```typescript
// GOOD: Integer cents
const amount = 150000; // $1,500.00

// BAD: Floating point dollars
const amount = 1500.00; // Floating point comparison nightmares await
```

Why? Because `0.1 + 0.2 !== 0.3` in IEEE 754 floating point. A regulator will not accept "floating point rounding" as an excuse for a $0.01 discrepancy that became a $10,000 discrepancy at scale.

### Reproducible Covenant Tests

A covenant test must produce the same result if run with:
- The same financial data
- The same covenant definition
- The same test date

```typescript
// The covenant service accepts an explicit test date
const result = covenantService.test(covenant, spread, { testDate: '2024-01-15' });

// NOT: covenantService.test(covenant, spread) — uses implicit "now"
```

This means:
- No `new Date()` calls in calculation paths
- Time is always injected as a parameter
- Randomness is never part of financial logic

### Explicit Division

When dividing, state your intent:

```typescript
// GOOD: Intent is clear
const ratio = divideExact(numerator, denominator);     // Throws if not evenly divisible
const ratio = divideRound(numerator, denominator);     // Rounds to integer
const ratio = divideDecimal(numerator, denominator);   // Returns Decimal type

// BAD: Silent truncation or floating point
const ratio = numerator / denominator;
```

---

## Transparency

> *"Code is read by two audiences: humans debugging at 3am, and AI agents trying to help."*

### No Black Boxes

Every calculation should be traceable. When a ratio is computed, the components are available:

```typescript
// GOOD: Traceable computation
const dscr = {
  value: 1.35,
  numerator: {
    label: 'Net Operating Income',
    value: 540000,
    lineItems: ['revenue', 'cogs', 'operating_expenses']
  },
  denominator: {
    label: 'Debt Service',
    value: 400000,
    lineItems: ['interest_expense', 'principal_payments']
  }
};

// BAD: Magic number
const dscr = 1.35;
```

### State Machines Over Implicit Flow

Deal stages, approval workflows, and covenant states use explicit state machines:

```typescript
// The stage service enforces valid transitions
const canTransition = stageService.canTransition(deal, 'underwriting');
const blockers = stageService.getBlockers(deal, 'underwriting');

// If blockers exist, the transition fails with explanation
if (blockers.length > 0) {
  return { allowed: false, blockers };
}
```

Never write code that assumes "we're probably in the right state." Check. Always.

### Fail Loud, Fail Early

When something is wrong, throw. Don't return null. Don't log and continue. Don't silently default.

```typescript
// GOOD: Loud failure
if (!deal) {
  throw new NotFoundError('deal', dealId);
}

// BAD: Silent null propagation
const deal = await dealService.getById(dealId);
if (!deal) return null;  // Caller now has to guess what went wrong
```

Exceptions should be:
- **Typed**: `NotFoundError`, `ValidationError`, `UnauthorizedError`
- **Contextual**: Include the entity type and ID
- **Actionable**: The error message should suggest what to do

### Responses Tell Stories

API responses include context for decision-making:

```typescript
// GOOD: Rich response with context
{
  "deal": { ... },
  "availableActions": ["advance_stage", "request_documents"],
  "blockers": [
    { "action": "advance_stage", "reason": "Missing required document: Financial Statements" }
  ],
  "warnings": [
    { "type": "covenant_risk", "message": "DSCR approaching threshold (1.28 vs 1.25 minimum)" }
  ]
}

// BAD: Data dump without context
{
  "deal": { ... }
}
```

This is especially important for AI agents. An AI reading a response should understand not just what *is*, but what it *can do* and what *might go wrong*.

---

## Developer Experience

### Naming Things

Names are documentation. They should be precise, unambiguous, and consistent.

**Use domain language:**
```typescript
// GOOD: Domain-specific terms
const debtServiceCoverageRatio = computeDSCR(spread);
const covenantCompliance = testCovenant(covenant, financials);

// BAD: Generic programmer terms
const ratio = calculate(data);
const result = check(obj);
```

**Include units in names:**
```typescript
// GOOD: Units are explicit
const amountCents = 150000;
const durationDays = 30;
const ratePercent = 5.25;
const rateDecimal = 0.0525;

// BAD: Units are ambiguous
const amount = 150000;  // Dollars? Cents? Pesos?
const duration = 30;    // Days? Months? Years?
const rate = 5.25;      // Percent? Decimal? Basis points?
```

**Qualification order (big-endian):**
```typescript
// GOOD: Qualifiers go from general to specific
const loanAccountBalanceCents = ...;
const loanAccountPaymentDueDate = ...;
const loanAccountPaymentAmountCents = ...;

// BAD: Qualifiers scattered
const balanceOfLoanAccount = ...;
const dueDate = ...;
const paymentAmt = ...;
```

### Types Over Comments

TypeScript's type system is the best documentation:

```typescript
// GOOD: The type IS the documentation
type MoneyAmount = {
  value: number;        // Integer in minor units (cents)
  currency: Currency;   // ISO 4217 code
};

type CovenantTestResult = {
  status: 'passing' | 'failing' | 'waived';
  value: number;
  threshold: number;
  margin: number;       // How far from threshold (can be negative)
  testDate: string;     // ISO 8601
};

// BAD: Comments that duplicate types
/** @param amount The amount in cents */
function processPayment(amount: number) { ... }
```

### Test Names Are Specifications

Test names should read like requirements:

```typescript
// GOOD: Specification as test name
describe('CovenantService', () => {
  it('marks covenant as failing when DSCR drops below threshold', () => { ... });
  it('respects grace period before marking covenant as breached', () => { ... });
  it('prevents waiver if user lacks waiver authority', () => { ... });
});

// BAD: Implementation-focused names
describe('CovenantService', () => {
  it('should work', () => { ... });
  it('test waiver flow', () => { ... });
});
```

### 80 Lines, Max

Functions longer than 80 lines are hiding complexity. Extract it.

This isn't about "clean code" aesthetics—it's about *auditability*. When you're debugging why a loan was incorrectly approved at 2am, you need to find the problem fast. Long functions hide problems.

---

## AI-Native Design

> *"Build for the AI agent that will maintain this code long after you've moved on."*

### AI as Reader and Writer

Code in Open LOS is read and modified by AI agents as often as by humans. Write code that:

1. **Has clear boundaries**: AI can understand function scope
2. **Uses consistent patterns**: AI can learn and apply conventions
3. **Fails explicitly**: AI can understand what went wrong
4. **Documents intent**: AI can understand *why*, not just *what*

### The MCP Contract

Every operation available to humans is available to AI via MCP tools. The tool definitions should:

```typescript
// GOOD: Rich context for AI decision-making
{
  name: 'advance_deal_stage',
  description: 'Move a deal to the next stage in the origination pipeline',
  parameters: {
    dealId: { type: 'string', description: 'UUID of the deal' },
    targetStage: { type: 'string', enum: ['origination', 'underwriting', 'closing', 'monitoring'] },
    rationale: { type: 'string', description: 'Explanation for why the deal is ready to advance' }
  },
  returns: {
    success: 'Deal object with new stage',
    failure: 'Object with blockers array explaining why advancement is not allowed'
  }
}
```

### Context Windows Are Expensive

When AI reads our code, every token counts. Write concisely:

```typescript
// GOOD: Dense but clear
const spread = await spreadService.create({ dealId, period, lineItems });
const ratios = spreadService.computeRatios(spread);

// BAD: Verbose ceremony
// First, we need to create a new spread for this deal
const spreadCreationParams = {
  dealId: dealId,
  period: period,
  lineItems: lineItems
};
const newSpread = await spreadService.create(spreadCreationParams);
// Now we can compute the ratios based on the spread
const computedRatios = spreadService.computeRatios(newSpread);
```

---

## Policy Commitments

### Zero Black Boxes

Every calculation is explainable. Every decision is traceable. There is no code that "just works" without us understanding why.

If you can't explain a piece of logic to a regulator in plain English, rewrite it until you can.

### Zero Implicit State

State lives in the database, not in memory, not in closures, not in "well, this should still be set from earlier."

Every function should be callable with just its parameters and database access. No hidden dependencies.

### Zero Tolerance for Data Loss

In lending, data is money. Lost data is lost money—or worse, legal liability.

- Every write is transactional
- Every transaction is atomic
- Every backup is tested
- Every deletion is soft (mark deleted, don't remove)

### Humans and AI Are Equal

The API doesn't care if you're a human clicking buttons or an AI agent making tool calls. Same authentication, same authorization, same validation, same audit trail.

This is not just a technical decision. It's a philosophical commitment to *transparent automation*. When AI acts, it acts *visibly*, with the same accountability as any human user.

### Dependencies Are Debt

Every external dependency is:
- A security surface
- A supply chain risk
- A maintenance burden
- A potential point of failure

We minimize dependencies ruthlessly. We prefer standard library. We vendor when we must depend. We never install a package to save 10 lines of code.

---

## The Ledger Test

Before merging any code, ask:

1. **Can I explain this to a regulator?** If audited, could you trace through this code and explain every decision it makes?

2. **Will this produce the same result tomorrow?** If given the same inputs, will this code behave identically?

3. **Can an AI agent understand and modify this?** Is the code clear enough that an AI could safely change it?

4. **Is there an audit trail?** If this code modifies state, is that modification recorded with full context?

5. **Would I trust my money to this code?** Not hypothetically—actually. Would you let this code manage your business's loan?

If any answer is "no," the code isn't ready.

---

## Closing

The name "Ledger Style" isn't about accounting software. It's about a way of thinking.

For centuries, ledgers have been humanity's tool for establishing truth in commerce. A proper ledger cannot be silently modified. Every entry is visible. The books must balance.

We write software the same way.

In an age where AI can generate code faster than humans can review it, where financial systems run at scales impossible to audit manually, where one bug can move millions of dollars—discipline isn't a luxury. It's survival.

Open LOS is built to be trusted with real money. Ledger Style is how we earn that trust.

---

*This document is inspired by [Tiger Style](https://github.com/tigerbeetle/tigerbeetle/blob/main/docs/TIGER_STYLE.md) from the TigerBeetle project. We admire their commitment to rigorous engineering and adapted their approach for financial software.*
