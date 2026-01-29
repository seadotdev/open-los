---
id: credit_memo
name: Credit Memo
phase: underwriting
doc_type: credit_memo
version: "1.0.0"
required_variables:
  - borrower_name
  - requested_amount
  - purpose
  - jurisdiction
---

# Credit Memo: {{borrower_name}}

**Date:** {{date}}
**Prepared by:** {{prepared_by}}
**Deal Stage:** {{stage}}

---

## 1. Executive Summary

This memo presents the credit assessment for **{{borrower_name}}** ({{jurisdiction}}), requesting a facility of **{{requested_amount}}** for the purpose of {{purpose}}.

## 2. Borrower Overview

| Field | Value |
|-------|-------|
| Legal Name | {{borrower_name}} |
| Registration | {{borrower_registration_number}} |
| Jurisdiction | {{jurisdiction}} |
| Facility Requested | {{requested_amount}} |
| Purpose | {{purpose}} |

## 3. Financial Summary

### Key Ratios ({{period}})

| Ratio | Value | Covenant | Status |
|-------|-------|----------|--------|
| Current Ratio | {{current_ratio}} | >= 1.25 | {{current_ratio_status}} |
| DSCR | {{dscr}} | >= 1.2 | {{dscr_status}} |
| Leverage | {{leverage}} | <= 3.0 | {{leverage_status}} |
| Gross Margin | {{gross_margin}} | >= 30% | {{gross_margin_status}} |

## 4. Recommendation

{{recommendation}}

## 5. Conditions Precedent

{{conditions_precedent}}

---

*This document was generated from template version {{template_version}}.*
