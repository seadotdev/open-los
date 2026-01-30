#!/usr/bin/env npx tsx

/**
 * Main Documentation Orchestrator
 *
 * Generates all documentation artifacts from git commits and changes.
 * This is the primary entry point for the auto-documentation system.
 *
 * Usage:
 *   npx tsx docs/auto-docs/scripts/generate-docs.ts [options]
 *
 * Options:
 *   --commit <sha>       Generate docs for specific commit
 *   --range <from>..<to> Generate docs for commit range
 *   --version <version>  Generate version bump docs
 *   --type <type>        Generate specific type (release|blog|social|video|demo)
 *   --all                Generate all documentation types
 *   --dry-run            Preview without writing files
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const CONFIG = {
  templatesDir: path.join(__dirname, '..', 'templates'),
  outputDir: path.join(__dirname, '..', 'generated'),
  repoRoot: path.join(__dirname, '..', '..', '..'),
};

// Types
interface CommitInfo {
  sha: string;
  shortSha: string;
  author: string;
  email: string;
  date: string;
  message: string;
  body: string;
  filesChanged: FileChange[];
  stats: { additions: number; deletions: number };
}

interface FileChange {
  path: string;
  changeType: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
}

interface GeneratedDocs {
  releaseLog?: string;
  blogPost?: string;
  socialMedia?: string;
  videoScript?: string;
  featureDemo?: string;
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

// Get commit information
function getCommitInfo(sha: string = 'HEAD'): CommitInfo {
  const format = '%H|%h|%an|%ae|%aI|%s|%b';
  const raw = execSync(`git log -1 --format="${format}" ${sha}`, {
    cwd: CONFIG.repoRoot,
    encoding: 'utf-8',
  }).trim();

  const [fullSha, shortSha, author, email, date, message, ...bodyParts] = raw.split('|');

  // Get file changes
  const diffStat = execSync(`git diff-tree --no-commit-id --name-status -r ${sha}`, {
    cwd: CONFIG.repoRoot,
    encoding: 'utf-8',
  }).trim();

  const filesChanged: FileChange[] = diffStat.split('\n').filter(Boolean).map(line => {
    const [status, ...pathParts] = line.split('\t');
    const filePath = pathParts.join('\t');
    const changeType = {
      'A': 'added',
      'M': 'modified',
      'D': 'deleted',
      'R': 'renamed',
    }[status[0]] as FileChange['changeType'] || 'modified';

    return {
      path: filePath,
      changeType,
      additions: 0,
      deletions: 0,
    };
  });

  // Get stats
  const statsRaw = execSync(`git diff-tree --no-commit-id --stat ${sha}`, {
    cwd: CONFIG.repoRoot,
    encoding: 'utf-8',
  }).trim();

  const statsMatch = statsRaw.match(/(\d+) insertions?\(\+\).*?(\d+) deletions?\(-\)/);
  const stats = {
    additions: statsMatch ? parseInt(statsMatch[1]) : 0,
    deletions: statsMatch ? parseInt(statsMatch[2]) : 0,
  };

  return {
    sha: fullSha,
    shortSha,
    author,
    email,
    date,
    message,
    body: bodyParts.join('|'),
    filesChanged,
    stats,
  };
}

// Analyze commit for documentation context
function analyzeCommit(commit: CommitInfo): {
  isFeature: boolean;
  isBugFix: boolean;
  isBreaking: boolean;
  isRefactor: boolean;
  isDocs: boolean;
  isTest: boolean;
  affectedPackages: string[];
  apiChanges: boolean;
  dbChanges: boolean;
  category: string;
  customerImpact: string;
} {
  const message = commit.message.toLowerCase();
  const files = commit.filesChanged.map(f => f.path);

  // Detect commit type from conventional commits or keywords
  const isFeature = message.startsWith('feat') || message.includes('add') || message.includes('new');
  const isBugFix = message.startsWith('fix') || message.includes('bug') || message.includes('issue');
  const isBreaking = message.includes('breaking') || message.includes('!:');
  const isRefactor = message.startsWith('refactor') || message.includes('refactor');
  const isDocs = message.startsWith('docs') || files.some(f => f.endsWith('.md'));
  const isTest = message.startsWith('test') || files.some(f => f.includes('test'));

  // Detect affected packages
  const affectedPackages = [...new Set(
    files
      .filter(f => f.startsWith('packages/'))
      .map(f => f.split('/')[1])
  )];

  // Detect API changes
  const apiChanges = files.some(f =>
    f.includes('routes/') ||
    f.includes('openapi/') ||
    f.includes('api/')
  );

  // Detect database changes
  const dbChanges = files.some(f =>
    f.includes('schema/') ||
    f.includes('tables.ts') ||
    f.includes('migration')
  );

  // Determine category
  let category = 'maintenance';
  if (isFeature) category = 'feature';
  else if (isBugFix) category = 'bugfix';
  else if (isBreaking) category = 'breaking';
  else if (isRefactor) category = 'improvement';
  else if (isDocs) category = 'documentation';
  else if (isTest) category = 'testing';

  // Generate customer impact statement
  let customerImpact = 'Internal improvements with no direct customer impact.';
  if (isFeature) {
    customerImpact = 'New functionality available for customers to leverage.';
  } else if (isBugFix) {
    customerImpact = 'Improved reliability and fixed known issues.';
  } else if (isBreaking) {
    customerImpact = 'ACTION REQUIRED: Review migration guide before updating.';
  } else if (apiChanges) {
    customerImpact = 'API changes that may affect integrations.';
  }

  return {
    isFeature,
    isBugFix,
    isBreaking,
    isRefactor,
    isDocs,
    isTest,
    affectedPackages,
    apiChanges,
    dbChanges,
    category,
    customerImpact,
  };
}

// Load and process template
function loadTemplate(name: string): string {
  const templatePath = path.join(CONFIG.templatesDir, `${name}.md`);
  return fs.readFileSync(templatePath, 'utf-8');
}

// Generate release log
function generateReleaseLog(commit: CommitInfo, analysis: ReturnType<typeof analyzeCommit>): string {
  const template = loadTemplate('release-log');
  const version = getVersionFromPackageJson();

  let content = template
    .replace(/\{\{VERSION\}\}/g, version)
    .replace(/\{\{DATE\}\}/g, commit.date.split('T')[0])
    .replace(/\{\{COMMIT_SHA\}\}/g, commit.sha)
    .replace(/\{\{AUTHOR\}\}/g, commit.author)
    .replace(/\{\{SUMMARY\}\}/g, commit.message);

  // Process files changed
  const filesSection = commit.filesChanged
    .map(f => `- \`${f.path}\` - ${f.changeType}`)
    .join('\n');
  content = content.replace(/\{\{#FILES_CHANGED\}\}[\s\S]*?\{\{\/FILES_CHANGED\}\}/g, filesSection || 'No files changed.');

  // Clean up remaining template sections
  content = content.replace(/\{\{#\w+\}\}[\s\S]*?\{\{\/\w+\}\}/g, '');
  content = content.replace(/\{\{[^}]+\}\}/g, 'N/A');

  return content;
}

// Generate blog post
function generateBlogPost(commit: CommitInfo, analysis: ReturnType<typeof analyzeCommit>): string {
  const version = getVersionFromPackageJson();
  const date = commit.date.split('T')[0];

  // Generate headline based on commit type
  let headline = commit.message;
  if (analysis.isFeature) {
    headline = `New Feature: ${commit.message.replace(/^feat[:\s]*/i, '')}`;
  } else if (analysis.isBugFix) {
    headline = `Reliability Update: ${commit.message.replace(/^fix[:\s]*/i, '')}`;
  } else if (analysis.isBreaking) {
    headline = `Important Update: ${commit.message}`;
  }

  const blogContent = `---
title: "${headline}"
date: ${date}
author: ${commit.author}
category: ${analysis.category}
tags: [open-los, ${analysis.affectedPackages.join(', ')}, ${analysis.category}]
excerpt: "${analysis.customerImpact}"
---

# ${headline}

${analysis.customerImpact}

## What's New

${commit.message}

${commit.body || 'This update brings improvements to the Open LOS platform.'}

## Why This Matters for Your Business

### ${analysis.isFeature ? 'New Capabilities' : analysis.isBugFix ? 'Improved Reliability' : 'Platform Enhancement'}

${analysis.customerImpact}

**Impact**: ${analysis.apiChanges ? 'API updates included' : 'No API changes'}${analysis.dbChanges ? ', database schema updated' : ''}

## Technical Details

### Affected Components

${analysis.affectedPackages.length > 0
  ? analysis.affectedPackages.map(p => `- \`@open-los/${p}\``).join('\n')
  : '- Core platform improvements'}

### Files Modified

${commit.filesChanged.slice(0, 10).map(f => `- \`${f.path}\``).join('\n')}
${commit.filesChanged.length > 10 ? `\n... and ${commit.filesChanged.length - 10} more files` : ''}

## Getting Started

\`\`\`bash
# Update to the latest version
npm update @open-los/api @open-los/core

# Verify the update
npm run test
\`\`\`

${analysis.isBreaking ? `
## Migration Guide

> **BREAKING CHANGE**: This update includes breaking changes.

Please review the following before updating:

1. Check API compatibility with your integrations
2. Run your test suite against the new version
3. Review database migrations if applicable

` : ''}

## What's Next

Stay tuned for more updates as we continue to improve Open LOS.

---

*Open LOS is open-source software. Star us on GitHub!*
`;

  return blogContent;
}

// Generate social media content
function generateSocialMedia(commit: CommitInfo, analysis: ReturnType<typeof analyzeCommit>): string {
  const version = getVersionFromPackageJson();

  // Generate short headline for Twitter
  let headline = commit.message.slice(0, 100);
  let emoji = '🚀';
  if (analysis.isFeature) emoji = '✨';
  else if (analysis.isBugFix) emoji = '🔧';
  else if (analysis.isBreaking) emoji = '⚠️';
  else if (analysis.isDocs) emoji = '📚';

  const tweetContent = `${emoji} ${headline}

${analysis.customerImpact.slice(0, 100)}

Check it out: https://github.com/seadotdev/open-los

#OpenLOS #LendingTech #FinTech #OpenSource`;

  const linkedInContent = `${emoji} ${headline}

${analysis.customerImpact}

What's included:
${commit.filesChanged.slice(0, 5).map(f => `• ${f.path.split('/').pop()}`).join('\n')}

This is part of our commitment to building the best open-source lending CRM.

Learn more: https://github.com/seadotdev/open-los

#LendingIndustry #FinTech #OpenSource #B2BLending #CRM`;

  const discordContent = `# ${emoji} ${headline}

Hey everyone! We just pushed a new update.

## What's New
${commit.message}

## Quick Start
\`\`\`bash
npm update @open-los/api
\`\`\`

## Links
- [GitHub](https://github.com/seadotdev/open-los)

Let us know what you think!`;

  return `# Social Media Content

## Release: ${version}
## Feature: ${headline}
## Date: ${commit.date.split('T')[0]}

---

## Twitter/X (280 chars max)

\`\`\`
${tweetContent}
\`\`\`

---

## LinkedIn

\`\`\`
${linkedInContent}
\`\`\`

---

## Discord

\`\`\`
${discordContent}
\`\`\`
`;
}

// Generate video script
function generateVideoScript(commit: CommitInfo, analysis: ReturnType<typeof analyzeCommit>): string {
  const headline = commit.message;

  return `# Video Script: ${headline}

## Metadata
- **Feature**: ${headline}
- **Version**: ${getVersionFromPackageJson()}
- **Duration**: 60-90 seconds
- **Format**: Short-form demo

---

## Script

### HOOK (0:00 - 0:05)

**Voiceover**:
> "Let me show you the latest update to Open LOS..."

---

### PROBLEM (0:05 - 0:15)

**Voiceover**:
> "Managing lending operations can be complex. ${analysis.customerImpact}"

---

### SOLUTION (0:15 - 0:25)

**Voiceover**:
> "With this update, we've made it easier than ever."

---

### DEMO (0:25 - 0:50)

**Terminal Recording**:

\`\`\`bash
# Start the server
npm run start --workspace=packages/api

# Make an API call demonstrating the feature
curl http://localhost:3000/v1/deals
\`\`\`

**Voiceover**:
> "Here's how it works in practice..."

---

### CTA (0:50 - 1:00)

**Voiceover**:
> "Try it out today! Link in the description."

**On-Screen**:
- GitHub: github.com/seadotdev/open-los
- Star the repo!

---

## Production Notes

### Affected Areas to Demo
${analysis.affectedPackages.map(p => `- ${p}`).join('\n') || '- Core functionality'}

### Key Commands
${commit.filesChanged
  .filter(f => f.path.includes('routes/'))
  .map(f => `- Show ${f.path}`)
  .slice(0, 5)
  .join('\n') || '- General API demonstration'}

### Screen Recording Settings
- Terminal: Clean dark theme
- Font: 18pt monospace
- Resolution: 1920x1080
`;
}

// Generate feature demo
function generateFeatureDemo(commit: CommitInfo, analysis: ReturnType<typeof analyzeCommit>): string {
  const headline = commit.message;
  const slug = headline.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);

  return `# Feature Demo: ${headline}

## Metadata
- **Feature**: ${headline}
- **Version**: ${getVersionFromPackageJson()}
- **Demo Type**: CLI
- **Generated**: ${new Date().toISOString()}

---

## Automated Demo Script

\`\`\`bash
#!/bin/bash
# Auto-generated demo for: ${headline}

set -e

echo "=== Open LOS Demo: ${headline} ==="
echo ""

# Setup
echo "Starting the server..."
npm run start --workspace=packages/api &
SERVER_PID=$!
sleep 3

# Demo sequence
echo ""
echo "=== Demonstrating the feature ==="
echo ""

# Health check
echo "1. Checking server health..."
curl -s http://localhost:3000/health | jq .
echo ""

# Main demo
echo "2. Main feature demonstration..."
curl -s http://localhost:3000/v1/deals | jq .
echo ""

# Cleanup
echo "=== Demo Complete ==="
kill $SERVER_PID 2>/dev/null || true
\`\`\`

---

## Asciinema Config

\`\`\`json
{
  "command": "bash docs/auto-docs/generated/demos/${slug}/demo.sh",
  "title": "${headline}",
  "idle_time_limit": 2
}
\`\`\`

---

## Motion Video Keyframes

\`\`\`yaml
keyframes:
  - time: 0.0
    action: show_logo
    duration: 1.0

  - time: 1.0
    action: transition_to_terminal
    duration: 0.5

  - time: 1.5
    action: run_demo
    duration: 30.0

  - time: 31.5
    action: show_results
    duration: 3.0

  - time: 34.5
    action: show_cta
    duration: 2.0
\`\`\`

---

## Output Artifacts

After running this demo, the following files should be generated:

\`\`\`
demos/${slug}/
├── demo.sh           # Executable script
├── demo.cast         # Asciinema recording
├── keyframes.yaml    # Motion video keyframes
└── README.md         # Demo documentation
\`\`\`
`;
}

// Get version from package.json
function getVersionFromPackageJson(): string {
  const packagePath = path.join(CONFIG.repoRoot, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
  return pkg.version || '0.0.0';
}

// Ensure output directories exist
function ensureOutputDirs() {
  const dirs = [
    path.join(CONFIG.outputDir, 'releases'),
    path.join(CONFIG.outputDir, 'blog'),
    path.join(CONFIG.outputDir, 'social'),
    path.join(CONFIG.outputDir, 'videos'),
    path.join(CONFIG.outputDir, 'demos'),
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// Write generated documentation
function writeGeneratedDocs(docs: GeneratedDocs, commit: CommitInfo, dryRun: boolean) {
  const timestamp = commit.date.split('T')[0];
  const slug = commit.message.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);

  const files: { path: string; content: string }[] = [];

  if (docs.releaseLog) {
    files.push({
      path: path.join(CONFIG.outputDir, 'releases', `${timestamp}-${commit.shortSha}.md`),
      content: docs.releaseLog,
    });
  }

  if (docs.blogPost) {
    files.push({
      path: path.join(CONFIG.outputDir, 'blog', `${timestamp}-${slug}.md`),
      content: docs.blogPost,
    });
  }

  if (docs.socialMedia) {
    files.push({
      path: path.join(CONFIG.outputDir, 'social', `${timestamp}-${slug}.md`),
      content: docs.socialMedia,
    });
  }

  if (docs.videoScript) {
    files.push({
      path: path.join(CONFIG.outputDir, 'videos', `${timestamp}-${slug}.md`),
      content: docs.videoScript,
    });
  }

  if (docs.featureDemo) {
    files.push({
      path: path.join(CONFIG.outputDir, 'demos', `${timestamp}-${slug}.md`),
      content: docs.featureDemo,
    });
  }

  files.forEach(({ path: filePath, content }) => {
    if (dryRun) {
      console.log(`[DRY RUN] Would write: ${filePath}`);
    } else {
      fs.writeFileSync(filePath, content);
      console.log(`Created: ${filePath}`);
    }
  });
}

// Main execution
async function main() {
  const args = parseArgs();
  const dryRun = Boolean(args['dry-run']);
  const commitSha = args.commit as string || 'HEAD';
  const docType = args.type as string;
  const generateAll = Boolean(args.all) || !docType;

  console.log('Open LOS Auto-Documentation Generator');
  console.log('=====================================\n');

  // Ensure output directories exist
  ensureOutputDirs();

  // Get commit info
  console.log(`Analyzing commit: ${commitSha}`);
  const commit = getCommitInfo(commitSha);
  console.log(`  Message: ${commit.message}`);
  console.log(`  Author: ${commit.author}`);
  console.log(`  Files changed: ${commit.filesChanged.length}\n`);

  // Analyze commit
  const analysis = analyzeCommit(commit);
  console.log(`Analysis:`);
  console.log(`  Category: ${analysis.category}`);
  console.log(`  Customer Impact: ${analysis.customerImpact}`);
  console.log(`  Affected Packages: ${analysis.affectedPackages.join(', ') || 'none'}`);
  console.log(`  API Changes: ${analysis.apiChanges}`);
  console.log(`  DB Changes: ${analysis.dbChanges}\n`);

  // Generate documentation
  const docs: GeneratedDocs = {};

  if (generateAll || docType === 'release') {
    console.log('Generating release log...');
    docs.releaseLog = generateReleaseLog(commit, analysis);
  }

  if (generateAll || docType === 'blog') {
    console.log('Generating blog post...');
    docs.blogPost = generateBlogPost(commit, analysis);
  }

  if (generateAll || docType === 'social') {
    console.log('Generating social media content...');
    docs.socialMedia = generateSocialMedia(commit, analysis);
  }

  if (generateAll || docType === 'video') {
    console.log('Generating video script...');
    docs.videoScript = generateVideoScript(commit, analysis);
  }

  if (generateAll || docType === 'demo') {
    console.log('Generating feature demo...');
    docs.featureDemo = generateFeatureDemo(commit, analysis);
  }

  // Write output
  console.log('\nWriting generated documentation...');
  writeGeneratedDocs(docs, commit, dryRun);

  console.log('\nDone!');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
