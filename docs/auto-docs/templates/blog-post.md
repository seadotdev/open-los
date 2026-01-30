# Blog Post Template

<!--
This template generates customer-facing blog posts for each release/feature.
Focus on customer value and practical benefits.
-->

---
title: "{{TITLE}}"
date: {{DATE}}
author: {{AUTHOR}}
category: {{CATEGORY}}
tags: [{{TAGS}}]
featured_image: /blog/images/{{IMAGE_SLUG}}.png
excerpt: "{{EXCERPT}}"
---

# {{HEADLINE}}

{{INTRO_HOOK}}

## What's New

{{FEATURE_OVERVIEW}}

## Why This Matters for Your Business

{{#CUSTOMER_BENEFITS}}
### {{BENEFIT_TITLE}}

{{BENEFIT_DESCRIPTION}}

**Impact**: {{IMPACT_STATEMENT}}

{{/CUSTOMER_BENEFITS}}

## Real-World Use Cases

{{#USE_CASES}}
### {{USE_CASE_TITLE}}

**Scenario**: {{SCENARIO}}

**Before**: {{BEFORE_STATE}}

**After**: {{AFTER_STATE}}

```bash
# Example: {{EXAMPLE_TITLE}}
{{EXAMPLE_CODE}}
```

{{/USE_CASES}}

## Getting Started

### Prerequisites

{{#PREREQUISITES}}
- {{PREREQUISITE}}
{{/PREREQUISITES}}

### Quick Start

```bash
{{QUICK_START_CODE}}
```

### Configuration

{{CONFIGURATION_GUIDE}}

## Feature Deep Dive

{{TECHNICAL_DETAILS}}

### API Examples

```bash
{{API_EXAMPLE}}
```

### Expected Response

```json
{{API_RESPONSE}}
```

## Migration Guide

{{#MIGRATION_REQUIRED}}
If you're upgrading from a previous version:

{{MIGRATION_STEPS}}
{{/MIGRATION_REQUIRED}}

## What's Next

{{ROADMAP_TEASER}}

## Get Involved

- **GitHub**: [Open an issue]({{GITHUB_ISSUES_URL}})
- **Discord**: Join our community at {{DISCORD_URL}}
- **Feedback**: We'd love to hear from you at {{FEEDBACK_EMAIL}}

---

*Open LOS is open-source software, built by the community for the lending industry. Star us on GitHub if you find this useful!*
