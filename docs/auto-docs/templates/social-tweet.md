# Social Media Template

<!--
This template generates social media content for multiple platforms.
Each section is optimized for the platform's character limits and style.
-->

## Release: {{VERSION}}
## Feature: {{FEATURE_NAME}}
## Date: {{DATE}}

---

## Twitter/X (Primary - 280 chars max)

### Announcement Tweet

```
{{EMOJI}} {{HEADLINE}}

{{SHORT_DESCRIPTION}}

{{#KEY_BENEFITS}}
{{BULLET}} {{BENEFIT}}
{{/KEY_BENEFITS}}

{{LINK}}

#OpenLOS #LendingTech #FinTech #OpenSource
```

### Thread (for major releases)

**Tweet 1/{{THREAD_COUNT}}**:
```
{{EMOJI}} Big news! {{HEADLINE}}

Here's what's new in Open LOS {{VERSION}} {{THREAD_EMOJI}}
```

{{#THREAD_TWEETS}}
**Tweet {{INDEX}}/{{THREAD_COUNT}}**:
```
{{CONTENT}}
```

{{/THREAD_TWEETS}}

**Final Tweet**:
```
Ready to try it out?

{{CTA}}

{{LINK}}

#OpenLOS #LendingCRM #FinTech
```

---

## LinkedIn (Professional - 3000 chars max)

```
{{HEADLINE}} {{EMOJI}}

{{PROFESSIONAL_INTRO}}

{{#BUSINESS_BENEFITS}}
{{BULLET}} {{BENEFIT_TITLE}}: {{BENEFIT_DESCRIPTION}}
{{/BUSINESS_BENEFITS}}

{{INDUSTRY_CONTEXT}}

{{CTA_PROFESSIONAL}}

{{LINK}}

#LendingIndustry #FinTech #OpenSource #B2BLending #CRM #SoftwareDevelopment
```

---

## Discord Announcement

```
# {{EMOJI}} {{HEADLINE}}

Hey everyone! {{INFORMAL_INTRO}}

## What's New
{{#FEATURES}}
- **{{FEATURE_NAME}}**: {{FEATURE_DESCRIPTION}}
{{/FEATURES}}

## Quick Start
\`\`\`bash
{{QUICK_COMMAND}}
\`\`\`

## Links
- [Release Notes]({{RELEASE_NOTES_URL}})
- [Documentation]({{DOCS_URL}})
- [GitHub]({{GITHUB_URL}})

{{CTA_COMMUNITY}}
```

---

## Hacker News (Title + Comment)

### Title (80 chars max)
```
{{HN_TITLE}}
```

### First Comment
```
{{HN_INTRO}}

{{TECHNICAL_SUMMARY}}

Key highlights:
{{#TECHNICAL_HIGHLIGHTS}}
- {{HIGHLIGHT}}
{{/TECHNICAL_HIGHLIGHTS}}

{{HN_CTA}}
```

---

## Product Hunt (for major versions)

### Tagline (60 chars)
```
{{PH_TAGLINE}}
```

### Description (260 chars)
```
{{PH_DESCRIPTION}}
```

### Makers Comment
```
{{PH_MAKERS_COMMENT}}
```

---

## Reddit (r/fintech, r/opensource, r/programming)

### Title
```
{{REDDIT_TITLE}}
```

### Body
```
{{REDDIT_INTRO}}

## What is Open LOS?
{{PROJECT_DESCRIPTION}}

## What's New in {{VERSION}}
{{#NEW_FEATURES}}
- **{{FEATURE}}**: {{DESCRIPTION}}
{{/NEW_FEATURES}}

## Try It Out
\`\`\`bash
{{TRY_IT_CODE}}
\`\`\`

{{REDDIT_CTA}}

[GitHub]({{GITHUB_URL}}) | [Docs]({{DOCS_URL}})
```

---

## Image Suggestions

### Twitter Card
- Dimensions: 1200x628px
- Content: {{IMAGE_CONTENT_TWITTER}}

### LinkedIn Image
- Dimensions: 1200x627px
- Content: {{IMAGE_CONTENT_LINKEDIN}}

### Discord Banner
- Dimensions: 960x540px
- Content: {{IMAGE_CONTENT_DISCORD}}

---

## Hashtag Reference

### Primary
#OpenLOS #LendingCRM #FinTech #OpenSource

### Secondary
#B2BLending #LoanOrigination #CreditManagement #API #TypeScript

### Trending (check before posting)
{{TRENDING_HASHTAGS}}

---

## Posting Schedule

| Platform | Best Time | Frequency |
|----------|-----------|-----------|
| Twitter/X | 9-11 AM EST | Every release |
| LinkedIn | 8-10 AM EST | Major releases |
| Discord | Any | Every release |
| HN | 9 AM EST | Major releases |
| Reddit | 10 AM EST | Major releases |
