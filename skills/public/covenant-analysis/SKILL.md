---
name: covenant-analysis
description: How to evaluate and test financial covenants on loan facilities
trigger: When testing covenants or reviewing compliance
tags:
  - covenants
  - compliance
  - monitoring
---

# Covenant Analysis

## Purpose

This skill guides the evaluation, testing, and monitoring of financial covenants on loan facilities. Use this when setting up new covenants, performing periodic compliance testing, or evaluating covenant modification requests.

## Covenant Types

### Financial Covenants

Quantitative tests based on financial metrics:

| Covenant | Metric | Typical Threshold | Testing Frequency |
|----------|--------|-------------------|-------------------|
| DSCR | Debt Service Coverage | ≥ 1.25x | Quarterly |
| Leverage | Total Debt / EBITDA | ≤ 3.5x | Quarterly |
| Current Ratio | Current Assets / Current Liabilities | ≥ 1.2x | Quarterly |
| Fixed Charge Coverage | (EBITDA - CapEx) / Fixed Charges | ≥ 1.1x | Quarterly |
| Tangible Net Worth | Equity - Intangibles | ≥ $X | Annually |

### Reporting Covenants

Information delivery requirements:

- Annual audited financial statements (within 120 days of FYE)
- Quarterly financial statements (within 45 days of quarter end)
- Monthly bank statements
- Annual budget/projections
- Insurance certificates renewal

### Information Covenants

Disclosure requirements:

- Material adverse change notification
- Litigation notice (>$X threshold)
- Change in ownership notification
- Default under other agreements
- Environmental incidents

See [ratio-definitions.md](ratio-definitions.md) for detailed calculation methods.

## Testing Methodology

### Step 1: Gather Information

- [ ] Obtain most recent financial statements
- [ ] Verify statement period matches testing period
- [ ] Check for restatements or adjustments
- [ ] Identify any one-time items requiring adjustment

### Step 2: Calculate Metrics

For each financial covenant:

1. Extract required line items from financials
2. Apply any defined adjustments (see loan agreement definitions)
3. Calculate the ratio/metric
4. Compare to threshold
5. Document calculation with source references

### Step 3: Determine Compliance

| Result | Status | Action Required |
|--------|--------|-----------------|
| Metric meets threshold | Pass | Document and file |
| Metric fails but in grace | Grace Period | Notify borrower, set cure deadline |
| Metric fails, grace expired | Breach | Escalate to workout |
| Waiver in effect | Waived | Document waiver coverage |

### Step 4: Document Results

Create covenant test record with:
- Test date
- Reporting period
- Actual value calculated
- Threshold value
- Pass/fail status
- Supporting calculation
- Analyst signature

## Grace Period Handling

### Standard Grace Periods

| Covenant Type | Typical Grace | Cure Options |
|---------------|---------------|--------------|
| DSCR | 30 days | Equity injection, debt paydown |
| Leverage | 30 days | Debt paydown, EBITDA adjustment |
| Reporting | 10 days | Delivery of required documents |
| Information | 5 days | Delivery of notice |

### Grace Period Rules

1. Grace period starts on test date, not notification date
2. Borrower must be notified within 5 business days of breach
3. Cure must be completed, not just initiated, by grace expiration
4. Multiple breaches may trigger cross-default provisions

## Waiver Documentation

When documenting a covenant waiver:

### Required Information

- [ ] Covenant being waived
- [ ] Specific testing period(s) covered
- [ ] Actual vs. required values
- [ ] Reason for breach
- [ ] Borrower's remediation plan
- [ ] Fee charged (if any)
- [ ] Approving authority
- [ ] Expiration date of waiver

### Waiver Letter Template

```
Re: Limited Waiver of [Covenant Name]

Borrower: [Entity Name]
Facility: [Facility Description]
Covenant: [Covenant Name] requiring [Threshold]
Test Period: [Period]
Actual Result: [Value]

This letter confirms that Lender waives compliance with the above covenant
for the specified period only. This waiver:
- Does not extend to any other period
- Does not modify the underlying covenant requirement
- Is subject to payment of waiver fee of $[Amount]
- Expires on [Date] unless renewed

All other terms of the Credit Agreement remain in full force and effect.
```

## Output

Generate a covenant compliance report including:

1. **Summary Table** - All covenants with current status
2. **Detailed Calculations** - For each financial covenant
3. **Trend Analysis** - Covenant headroom over time
4. **Risk Assessment** - Covenants at risk of future breach
5. **Recommendations** - Actions if any covenant is stressed
