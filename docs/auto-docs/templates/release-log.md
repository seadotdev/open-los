# Release Log Template

<!--
This template is used by the auto-documentation system to generate release logs.
Variables are replaced by the generator script.
-->

## Release: {{VERSION}}

**Date**: {{DATE}}
**Commit**: {{COMMIT_SHA}}
**Author**: {{AUTHOR}}

---

### Summary

{{SUMMARY}}

### Changes

#### Files Modified
{{#FILES_CHANGED}}
- `{{FILE_PATH}}` - {{CHANGE_TYPE}}
{{/FILES_CHANGED}}

#### Features Added
{{#FEATURES}}
- {{FEATURE_NAME}}: {{FEATURE_DESCRIPTION}}
{{/FEATURES}}

#### Bug Fixes
{{#FIXES}}
- {{FIX_ID}}: {{FIX_DESCRIPTION}}
{{/FIXES}}

#### API Changes
{{#API_CHANGES}}
| Endpoint | Change | Description |
|----------|--------|-------------|
{{#ENDPOINTS}}
| `{{METHOD}} {{PATH}}` | {{CHANGE_TYPE}} | {{DESCRIPTION}} |
{{/ENDPOINTS}}
{{/API_CHANGES}}

#### Database Migrations
{{#MIGRATIONS}}
- {{MIGRATION_NAME}}: {{MIGRATION_DESCRIPTION}}
{{/MIGRATIONS}}

### Breaking Changes

{{#BREAKING_CHANGES}}
> **WARNING**: Breaking change in this release

{{BREAKING_DESCRIPTION}}

**Migration Steps**:
{{#MIGRATION_STEPS}}
1. {{STEP}}
{{/MIGRATION_STEPS}}
{{/BREAKING_CHANGES}}

### Dependencies Updated
{{#DEPENDENCIES}}
- `{{PACKAGE_NAME}}`: {{OLD_VERSION}} → {{NEW_VERSION}}
{{/DEPENDENCIES}}

### Testing

- Conformance tests: {{TEST_STATUS}}
- Test coverage: {{COVERAGE}}%

---

**Full Changelog**: {{CHANGELOG_LINK}}
