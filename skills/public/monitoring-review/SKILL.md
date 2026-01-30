---
name: monitoring-review
description: Periodic loan review process for portfolio monitoring
trigger: When conducting periodic loan reviews or annual reviews
tags:
  - monitoring
  - review
  - portfolio
  - compliance
---

# Monitoring Review

## Purpose

This skill guides the periodic review process for loans in the monitoring stage. Use this for annual reviews, quarterly check-ins, or ad-hoc reviews triggered by early warning indicators.

## Review Types

| Review Type | Frequency | Trigger | Depth |
|-------------|-----------|---------|-------|
| Annual Review | Every 12 months | Calendar | Full |
| Quarterly Check | Every 3 months | Calendar | Standard |
| Triggered Review | As needed | Early warning | Focused |
| Renewal Review | At maturity | Renewal request | Full |

## Review Process

### Step 1: Pre-Review Preparation

Gather required documents:

- [ ] Most recent financial statements
- [ ] Latest covenant compliance certificate
- [ ] Bank statement summary (last 6 months)
- [ ] Accounts receivable aging
- [ ] Accounts payable aging
- [ ] Collateral status update
- [ ] Insurance certificate renewal
- [ ] Any borrower correspondence

Check system data:

- [ ] Payment history (on-time, late, missed)
- [ ] Outstanding loan balance and availability
- [ ] Covenant test history
- [ ] Prior review notes and action items
- [ ] Alert history

### Step 2: Financial Update Assessment

#### Trend Analysis

Compare current period to:
- Prior year same period
- Year-over-year change
- Original underwriting projections

Key metrics to track:

| Metric | Current | Prior | YoY Change | UW Projection | Variance |
|--------|---------|-------|------------|---------------|----------|
| Revenue | | | | | |
| Gross Margin | | | | | |
| EBITDA | | | | | |
| Net Income | | | | | |
| Total Debt | | | | | |
| Cash Balance | | | | | |

#### Ratio Analysis

Calculate and compare covenant ratios:

| Ratio | Current | Threshold | Headroom | Trend |
|-------|---------|-----------|----------|-------|
| DSCR | | | | |
| Leverage | | | | |
| Current Ratio | | | | |

### Step 3: Covenant Compliance Review

For each covenant:

- [ ] Verify compliance status
- [ ] Calculate headroom to breach
- [ ] Identify trending concerns
- [ ] Document any waivers in effect
- [ ] Review cure actions if in grace period

See covenant-analysis skill for detailed testing methodology.

### Step 4: Collateral Review

- [ ] Verify insurance current and adequate
- [ ] Check for new liens (updated lien search)
- [ ] Review collateral condition (if applicable)
- [ ] Update collateral values if stale (>12 months)
- [ ] Recalculate LTV with current balance

### Step 5: Early Warning Indicators

Check for warning signs:

**Financial Warnings**
- [ ] DSCR headroom < 15%
- [ ] Leverage trending toward breach
- [ ] Working capital deterioration
- [ ] Declining gross margins (>3 points)
- [ ] Increasing DSO/DIO

**Operational Warnings**
- [ ] Key customer loss
- [ ] Management departure
- [ ] Regulatory action
- [ ] Litigation filed
- [ ] Industry disruption

**Payment Warnings**
- [ ] Any payments >10 days late
- [ ] Revolver utilization >80% for >60 days
- [ ] NSF or rejected payments
- [ ] Request for payment deferrals

**Relationship Warnings**
- [ ] Unresponsive to information requests
- [ ] Delayed financial reporting
- [ ] Unusual transaction patterns
- [ ] Request for significant modifications

### Step 6: Risk Rating Update

Based on review findings, reassess risk rating:

| Finding | Rating Impact |
|---------|---------------|
| Improved financial performance | May warrant upgrade |
| Stable, meeting covenants | Maintain current |
| Covenant headroom tightening | Consider downgrade watch |
| Covenant breach (cured) | May warrant downgrade |
| Multiple warnings triggered | Downgrade recommended |
| Payment issues | Downgrade required |

See deal-scoring skill for risk rating methodology.

### Step 7: Action Item Development

Based on review findings, determine required actions:

**Standard Actions**
- Update risk rating in system
- Document review findings
- Set next review date
- Archive supporting documents

**Enhanced Monitoring Actions** (if concerns identified)
- Increase reporting frequency
- Request additional collateral
- Tighten covenant thresholds
- Reduce facility availability

**Workout Actions** (if significant deterioration)
- Transfer to workout/special assets
- Engage workout specialist
- Develop remediation plan
- Consider collateral liquidation

### Step 8: Borrower Communication

If review identifies issues:

1. Schedule call with borrower management
2. Discuss financial performance
3. Understand business drivers and challenges
4. Review borrower's remediation plans
5. Document discussion and commitments

## Review Documentation

Create review memo including:

1. **Review Summary** - Overall assessment and rating
2. **Financial Summary** - Key metrics and trends
3. **Covenant Status** - Compliance and headroom
4. **Collateral Update** - Coverage and condition
5. **Early Warning Check** - Indicators flagged
6. **Risk Rating** - Current and recommended
7. **Action Items** - Required follow-up with owners
8. **Next Review** - Scheduled date and type

## Output

Generate a portfolio review report including:

1. **Executive Summary** - One-paragraph assessment
2. **Financial Performance** - Trend tables and analysis
3. **Covenant Compliance** - Status of all covenants
4. **Risk Assessment** - Rating and any changes
5. **Action Plan** - Next steps with responsibilities
6. **Appendices** - Supporting calculations and documents
