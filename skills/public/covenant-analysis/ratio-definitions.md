# Ratio Definitions for Covenant Testing

## Debt Service Coverage Ratio (DSCR)

### Standard Definition

```
DSCR = (EBITDA - CapEx - Taxes - Distributions) / Total Debt Service
```

Where:
- **EBITDA** = Net Income + Interest + Taxes + Depreciation + Amortization
- **CapEx** = Capital Expenditures (maintenance only, if specified)
- **Taxes** = Cash taxes paid
- **Distributions** = Dividends or distributions paid
- **Total Debt Service** = Principal + Interest payments due in period

### Common Adjustments

| Adjustment | Treatment | Documentation |
|------------|-----------|---------------|
| One-time gains | Exclude | Identify in footnotes |
| Restructuring costs | May add back | Per agreement definition |
| Non-cash stock comp | Add back | Usually standard |
| Management fees | May add back | If to related parties |

### Testing Period

- Typically trailing twelve months (TTM) or last four quarters (LFQ)
- Annualized for interim periods if specified
- Pro forma adjustments for acquisitions/dispositions

## Leverage Ratio

### Total Leverage

```
Total Leverage = Total Debt / EBITDA
```

Where:
- **Total Debt** = All interest-bearing obligations
- Includes: term loans, revolvers (drawn), bonds, capital leases, seller notes
- Excludes: trade payables, accrued liabilities (unless specified)

### Senior Leverage

```
Senior Leverage = Senior Debt / EBITDA
```

- Only debt senior in payment priority
- Excludes subordinated debt, mezzanine

### Net Leverage

```
Net Leverage = (Total Debt - Unrestricted Cash) / EBITDA
```

- Cash offset typically capped (e.g., max $5M)
- Must be unrestricted (not pledged, not trapped)

## Current Ratio

### Standard Definition

```
Current Ratio = Current Assets / Current Liabilities
```

Where:
- **Current Assets** = Cash + Receivables + Inventory + Prepaid + Other (due <1 year)
- **Current Liabilities** = Payables + Accrued + Current portion of debt + Other (due <1 year)

### Quick Ratio (Acid Test)

```
Quick Ratio = (Cash + Receivables) / Current Liabilities
```

- Excludes inventory (less liquid)
- Excludes prepaid expenses

## Fixed Charge Coverage Ratio (FCCR)

### Standard Definition

```
FCCR = (EBITDA - CapEx) / Fixed Charges
```

Where Fixed Charges include:
- Interest expense
- Scheduled principal payments
- Lease payments (if not in EBITDA)
- Preferred dividends
- Cash taxes (sometimes)

### Alternative: EBITDA - Maintenance CapEx

Some agreements use:
```
FCCR = (EBITDA - Maintenance CapEx) / Fixed Charges
```

Distinguishing maintenance from growth CapEx requires:
- Management certification
- Auditor review (for larger facilities)
- Historical comparison

## Tangible Net Worth

### Definition

```
Tangible Net Worth = Total Equity - Intangible Assets
```

Where Intangible Assets include:
- Goodwill
- Patents, trademarks (if capitalized)
- Customer lists
- Deferred financing costs (check definition)
- Organization costs

### Minimum TNW Covenant

Often structured as:
```
Minimum TNW = Base Amount + X% of Cumulative Net Income (no reduction for losses)
```

This creates a "ratchet" that increases the requirement as the company profits.

## Interest Coverage Ratio

### EBITDA-based

```
Interest Coverage = EBITDA / Interest Expense
```

### EBIT-based

```
Interest Coverage = EBIT / Interest Expense
```

Note: EBIT version is more conservative (no D&A add-back).

## Calculation Examples

### DSCR Example

| Line Item | Amount | Source |
|-----------|--------|--------|
| Net Income | $2,000,000 | P&L |
| + Interest Expense | $500,000 | P&L |
| + Depreciation | $300,000 | P&L |
| + Amortization | $100,000 | P&L |
| + Tax Expense | $600,000 | P&L |
| = EBITDA | $3,500,000 | |
| - CapEx | ($400,000) | Cash Flow |
| - Cash Taxes | ($550,000) | Cash Flow |
| - Distributions | ($200,000) | Cash Flow |
| = Cash Flow for Debt Service | $2,350,000 | |
| Principal Due | $1,000,000 | Amort Schedule |
| Interest Due | $500,000 | Loan Records |
| = Total Debt Service | $1,500,000 | |
| **DSCR** | **1.57x** | Pass (≥1.25x) |

### Leverage Example

| Line Item | Amount | Source |
|-----------|--------|--------|
| Term Loan A | $5,000,000 | Balance Sheet |
| Term Loan B | $3,000,000 | Balance Sheet |
| Revolver (drawn) | $1,500,000 | Balance Sheet |
| Capital Leases | $500,000 | Balance Sheet |
| = Total Debt | $10,000,000 | |
| TTM EBITDA | $3,500,000 | See above |
| **Leverage** | **2.86x** | Pass (≤3.5x) |
