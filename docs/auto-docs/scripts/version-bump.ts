#!/usr/bin/env npx tsx

/**
 * Version Bump Documentation Generator
 *
 * Generates comprehensive documentation for version bumps and breaking changes.
 * Creates migration guides, changelogs, and customer communication templates.
 *
 * Usage:
 *   npx tsx docs/auto-docs/scripts/version-bump.ts --version 1.0.0
 *   npx tsx docs/auto-docs/scripts/version-bump.ts --version 1.0.0 --breaking
 *   npx tsx docs/auto-docs/scripts/version-bump.ts --from 0.1.0 --to 1.0.0
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const CONFIG = {
  outputDir: path.join(__dirname, '..', 'generated'),
  repoRoot: path.join(__dirname, '..', '..', '..'),
};

interface VersionInfo {
  version: string;
  major: number;
  minor: number;
  patch: number;
}

interface ChangelogEntry {
  type: 'feature' | 'fix' | 'breaking' | 'improvement' | 'docs';
  message: string;
  sha: string;
  date: string;
}

// Parse command line arguments
function parseArgs(): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }

  return args;
}

// Parse version string
function parseVersion(version: string): VersionInfo {
  const match = version.match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    throw new Error(`Invalid version format: ${version}`);
  }
  return {
    version: version.replace(/^v/, ''),
    major: parseInt(match[1]),
    minor: parseInt(match[2]),
    patch: parseInt(match[3]),
  };
}

// Determine version bump type
function getVersionBumpType(from: VersionInfo, to: VersionInfo): 'major' | 'minor' | 'patch' {
  if (to.major > from.major) return 'major';
  if (to.minor > from.minor) return 'minor';
  return 'patch';
}

// Get commits between versions
function getCommitsBetweenVersions(fromTag: string, toTag: string): ChangelogEntry[] {
  try {
    const log = execSync(
      `git log ${fromTag}..${toTag} --format="%H|%s|%aI" 2>/dev/null || git log --format="%H|%s|%aI" -20`,
      { cwd: CONFIG.repoRoot, encoding: 'utf-8' }
    ).trim();

    return log.split('\n').filter(Boolean).map(line => {
      const [sha, message, date] = line.split('|');

      let type: ChangelogEntry['type'] = 'improvement';
      if (message.startsWith('feat')) type = 'feature';
      else if (message.startsWith('fix')) type = 'fix';
      else if (message.includes('breaking') || message.includes('BREAKING')) type = 'breaking';
      else if (message.startsWith('docs')) type = 'docs';

      return { type, message, sha, date };
    });
  } catch {
    return [];
  }
}

// Generate changelog
function generateChangelog(version: string, entries: ChangelogEntry[]): string {
  const date = new Date().toISOString().split('T')[0];

  const features = entries.filter(e => e.type === 'feature');
  const fixes = entries.filter(e => e.type === 'fix');
  const breaking = entries.filter(e => e.type === 'breaking');
  const improvements = entries.filter(e => e.type === 'improvement');

  let changelog = `# Changelog

## [${version}] - ${date}

`;

  if (breaking.length > 0) {
    changelog += `### Breaking Changes

${breaking.map(e => `- ${e.message} (${e.sha.slice(0, 7)})`).join('\n')}

`;
  }

  if (features.length > 0) {
    changelog += `### Features

${features.map(e => `- ${e.message} (${e.sha.slice(0, 7)})`).join('\n')}

`;
  }

  if (fixes.length > 0) {
    changelog += `### Bug Fixes

${fixes.map(e => `- ${e.message} (${e.sha.slice(0, 7)})`).join('\n')}

`;
  }

  if (improvements.length > 0) {
    changelog += `### Improvements

${improvements.map(e => `- ${e.message} (${e.sha.slice(0, 7)})`).join('\n')}

`;
  }

  return changelog;
}

// Generate migration guide
function generateMigrationGuide(
  fromVersion: string,
  toVersion: string,
  bumpType: string,
  breakingChanges: ChangelogEntry[]
): string {
  const date = new Date().toISOString().split('T')[0];

  let guide = `# Migration Guide: ${fromVersion} → ${toVersion}

**Date**: ${date}
**Version Bump Type**: ${bumpType.toUpperCase()}
**Breaking Changes**: ${breakingChanges.length}

---

## Overview

This guide helps you migrate from Open LOS ${fromVersion} to ${toVersion}.

`;

  if (bumpType === 'major') {
    guide += `> **Important**: This is a major version upgrade. Please review all breaking changes carefully before upgrading.

`;
  }

  guide += `## Pre-Migration Checklist

- [ ] Backup your database
- [ ] Review breaking changes below
- [ ] Update your integration tests
- [ ] Test in a staging environment first

## Breaking Changes

`;

  if (breakingChanges.length > 0) {
    breakingChanges.forEach((change, index) => {
      guide += `### ${index + 1}. ${change.message}

**Commit**: ${change.sha.slice(0, 7)}

**What Changed**:
- [Describe the change]

**Migration Steps**:
1. [Step 1]
2. [Step 2]

**Code Example**:

Before:
\`\`\`typescript
// Old code
\`\`\`

After:
\`\`\`typescript
// New code
\`\`\`

---

`;
    });
  } else {
    guide += `No breaking changes in this release.

`;
  }

  guide += `## Upgrade Steps

### 1. Update Dependencies

\`\`\`bash
npm update @open-los/api @open-los/core
\`\`\`

### 2. Run Database Migrations (if applicable)

\`\`\`bash
npm run migrate
\`\`\`

### 3. Verify Your Installation

\`\`\`bash
npm run test
npm run start
\`\`\`

### 4. Test Your Integrations

Verify that all API integrations work correctly with the new version.

## Rollback Procedure

If you encounter issues:

1. Restore database backup
2. Revert to previous version:
   \`\`\`bash
   npm install @open-los/api@${fromVersion} @open-los/core@${fromVersion}
   \`\`\`

## Support

- GitHub Issues: https://github.com/seadotdev/open-los/issues
- Documentation: https://github.com/seadotdev/open-los/docs

---

*Generated by Open LOS Auto-Documentation System*
`;

  return guide;
}

// Generate announcement template
function generateAnnouncement(version: string, bumpType: string, entries: ChangelogEntry[]): string {
  const features = entries.filter(e => e.type === 'feature');
  const fixes = entries.filter(e => e.type === 'fix');
  const breaking = entries.filter(e => e.type === 'breaking');

  let emoji = '🚀';
  if (bumpType === 'major') emoji = '🎉';
  else if (bumpType === 'minor') emoji = '✨';
  else if (bumpType === 'patch') emoji = '🔧';

  return `# Version ${version} Announcement

## Email Template

**Subject**: ${emoji} Open LOS ${version} is now available!

---

Dear Open LOS Users,

We're excited to announce the release of Open LOS ${version}!

${bumpType === 'major' ? '**This is a major release with significant updates.**\n\n' : ''}
### What's New

${features.slice(0, 5).map(f => `✨ ${f.message}`).join('\n') || 'Various improvements and optimizations.'}

${fixes.length > 0 ? `### Bug Fixes

${fixes.slice(0, 5).map(f => `🔧 ${f.message}`).join('\n')}
` : ''}

${breaking.length > 0 ? `### ⚠️ Breaking Changes

This release includes breaking changes. Please review the migration guide before upgrading.

` : ''}
### How to Upgrade

\`\`\`bash
npm update @open-los/api @open-los/core
\`\`\`

### Documentation

- [Full Changelog](link-to-changelog)
${breaking.length > 0 ? '- [Migration Guide](link-to-migration-guide)\n' : ''}- [Documentation](link-to-docs)

Thank you for using Open LOS!

Best regards,
The Open LOS Team

---

## Social Media Posts

### Twitter/X

${emoji} Open LOS ${version} is here!

${features[0]?.message || 'New improvements and bug fixes!'}

Upgrade now: npm update @open-los/api

#OpenLOS #LendingTech #FinTech #OpenSource

### LinkedIn

We're pleased to announce the release of Open LOS ${version}!

Key highlights:
${features.slice(0, 3).map(f => `• ${f.message}`).join('\n') || '• Performance improvements\n• Bug fixes'}

${bumpType === 'major' ? 'This major release represents a significant milestone for our open-source lending CRM.\n\n' : ''}
Upgrade today and let us know what you think!

#LendingIndustry #FinTech #OpenSource #B2BLending

---

## Discord Announcement

# ${emoji} Version ${version} Released!

Hey everyone! We just released Open LOS ${version}!

## What's New
${features.slice(0, 5).map(f => `- ${f.message}`).join('\n') || '- Various improvements'}

${breaking.length > 0 ? '## ⚠️ Breaking Changes\nCheck the migration guide before upgrading!\n\n' : ''}
## Upgrade
\`\`\`bash
npm update @open-los/api @open-los/core
\`\`\`

Let us know if you have any questions!
`;
}

// Ensure output directories exist
function ensureOutputDirs() {
  const dirs = [
    path.join(CONFIG.outputDir, 'releases'),
    path.join(CONFIG.outputDir, 'migrations'),
    path.join(CONFIG.outputDir, 'announcements'),
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// Main execution
async function main() {
  const args = parseArgs();

  console.log('Open LOS Version Bump Documentation Generator');
  console.log('=============================================\n');

  const newVersion = args.version as string;
  const fromVersion = args.from as string || '0.0.0';
  const isBreaking = Boolean(args.breaking);

  if (!newVersion && !args.to) {
    console.error('Error: --version or --to is required');
    console.log('\nUsage:');
    console.log('  npx tsx version-bump.ts --version 1.0.0');
    console.log('  npx tsx version-bump.ts --from 0.1.0 --to 1.0.0');
    process.exit(1);
  }

  const toVersion = newVersion || args.to as string;

  ensureOutputDirs();

  // Parse versions
  const from = parseVersion(fromVersion);
  const to = parseVersion(toVersion);
  const bumpType = getVersionBumpType(from, to);

  console.log(`Version Bump: ${from.version} → ${to.version}`);
  console.log(`Bump Type: ${bumpType}`);
  console.log(`Breaking: ${isBreaking || bumpType === 'major'}\n`);

  // Get commits
  const commits = getCommitsBetweenVersions(`v${from.version}`, `v${to.version}`);
  console.log(`Found ${commits.length} commits\n`);

  // Generate documentation
  console.log('Generating documentation...\n');

  // Changelog
  const changelog = generateChangelog(to.version, commits);
  const changelogPath = path.join(CONFIG.outputDir, 'releases', `CHANGELOG-${to.version}.md`);
  fs.writeFileSync(changelogPath, changelog);
  console.log(`Created: ${changelogPath}`);

  // Migration Guide
  const breakingChanges = commits.filter(c => c.type === 'breaking');
  const migration = generateMigrationGuide(from.version, to.version, bumpType, breakingChanges);
  const migrationPath = path.join(CONFIG.outputDir, 'migrations', `MIGRATION-${from.version}-to-${to.version}.md`);
  fs.writeFileSync(migrationPath, migration);
  console.log(`Created: ${migrationPath}`);

  // Announcement
  const announcement = generateAnnouncement(to.version, bumpType, commits);
  const announcementPath = path.join(CONFIG.outputDir, 'announcements', `ANNOUNCE-${to.version}.md`);
  fs.writeFileSync(announcementPath, announcement);
  console.log(`Created: ${announcementPath}`);

  console.log('\nDone! Version bump documentation generated.');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
