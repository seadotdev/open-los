---
name: deal-scoring
description: Quantitative deal assessment and risk rating methodology
trigger: When scoring a deal or determining risk rating
tags:
  - risk
  - scoring
  - pricing
  - underwriting
---

# Deal Scoring

## Purpose

This skill provides a systematic methodology for scoring commercial loan deals. The scoring framework assesses risk across multiple dimensions and produces a risk rating that informs pricing, structure, and approval authority.

## Scoring Framework

The deal score is computed across five weighted categories:

| Category | Weight | Description |
|----------|--------|-------------|
| Borrower Strength | 30% | Financial health and management quality |
| Collateral Quality | 20% | Security coverage and liquidity |
| Industry Risk | 15% | Sector outlook and competitive position |
| Transaction Structure | 20% | Terms, covenants, and risk mitigants |
| Relationship Value | 15% | Strategic fit and cross-sell potential |

See [scoring-matrix.md](scoring-matrix.md) for detailed scoring criteria.

## Scoring Process

### Step 1: Gather Scoring Inputs

For each category, collect the required data:

**Borrower Strength**
- [ ] Last 3 years financial statements
- [ ] Management team backgrounds
- [ ] Credit bureau reports on principals
- [ ] Bank reference check results

**Collateral Quality**
- [ ] Appraisals or valuations
- [ ] Lien search results
- [ ] Insurance certificates
- [ ] Collateral aging/condition report

**Industry Risk**
- [ ] Industry reports (IBISWorld, S&P, etc.)
- [ ] Borrower's market position analysis
- [ ] Customer concentration data

**Transaction Structure**
- [ ] Proposed term sheet
- [ ] Covenant package
- [ ] Guarantor financial statements

**Relationship Value**
- [ ] Existing relationship history
- [ ] Cross-sell opportunities identified
- [ ] Strategic alignment assessment

### Step 2: Score Each Factor

Rate each factor on a 1-5 scale:

| Score | Rating | Description |
|-------|--------|-------------|
| 5 | Excellent | Top quartile, minimal risk |
| 4 | Good | Above average, low risk |
| 3 | Acceptable | Average, standard risk |
| 2 | Below Average | Some concerns, elevated risk |
| 1 | Poor | Significant concerns, high risk |

### Step 3: Calculate Weighted Score

```
Weighted Score = Σ (Category Score × Category Weight)
```

Example:
- Borrower: 4 × 0.30 = 1.20
- Collateral: 3 × 0.20 = 0.60
- Industry: 3 × 0.15 = 0.45
- Structure: 4 × 0.20 = 0.80
- Relationship: 2 × 0.15 = 0.30
- **Total: 3.35**

### Step 4: Determine Risk Rating

| Score Range | Risk Rating | Description |
|-------------|-------------|-------------|
| 4.5 - 5.0 | 1 - Exceptional | Virtually no risk of loss |
| 4.0 - 4.49 | 2 - Strong | Minimal risk, excellent credit |
| 3.5 - 3.99 | 3 - Satisfactory | Acceptable risk, good credit |
| 3.0 - 3.49 | 4 - Acceptable | Standard risk, average credit |
| 2.5 - 2.99 | 5 - Watch | Elevated risk, requires monitoring |
| 2.0 - 2.49 | 6 - Substandard | High risk, workout candidate |
| 1.5 - 1.99 | 7 - Doubtful | Very high risk, potential loss |
| 1.0 - 1.49 | 8 - Loss | Expected loss imminent |

## Risk Rating Implications

### Pricing Guidelines

| Risk Rating | Base Spread | Floor Rate |
|-------------|-------------|------------|
| 1-2 | Prime + 0.50% | 5.00% |
| 3 | Prime + 1.00% | 5.50% |
| 4 | Prime + 1.75% | 6.25% |
| 5 | Prime + 2.50% | 7.00% |
| 6+ | Case-by-case | 8.00%+ |

### Approval Authority

| Risk Rating | Maximum Amount | Approver |
|-------------|----------------|----------|
| 1-2 | $5,000,000 | Credit Manager |
| 3 | $3,000,000 | Credit Manager |
| 4 | $2,000,000 | Senior Credit Officer |
| 5 | $1,000,000 | Credit Committee |
| 6+ | Any | Credit Committee + CEO |

### Covenant Requirements

| Risk Rating | DSCR Minimum | Leverage Maximum |
|-------------|--------------|------------------|
| 1-2 | 1.15x | 4.0x |
| 3 | 1.20x | 3.5x |
| 4 | 1.25x | 3.0x |
| 5 | 1.35x | 2.5x |
| 6+ | 1.50x | 2.0x |

## Override Rules

Automatic adjustments regardless of calculated score:

| Condition | Adjustment |
|-----------|------------|
| First-time borrower | -0.5 from score |
| DSCR below 1.0x | Maximum rating 6 |
| Negative equity | Maximum rating 6 |
| Prior bankruptcy (<5 years) | Maximum rating 5 |
| Fraud/integrity concerns | Automatic decline |

## Output

Generate a deal scoring summary including:

1. **Score Summary** - Category scores and weighted total
2. **Risk Rating** - Final rating with justification
3. **Pricing Recommendation** - Suggested spread and fees
4. **Structure Requirements** - Required covenants and conditions
5. **Approval Routing** - Required approver based on amount and rating
6. **Key Risks** - Top 3 risks identified in scoring
7. **Mitigants** - Structural protections addressing key risks
