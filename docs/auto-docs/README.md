# Auto-Documentation System

Open LOS uses an automated documentation pipeline to ensure every change is comprehensively documented for customers, stakeholders, and the community.

## Overview

Every commit and PR automatically generates:

1. **Release Logs** - Technical changelog entries
2. **Blog Posts** - Customer-facing impact articles
3. **Social Media** - Tweet-ready announcements
4. **Video Scripts** - Demo script prompts for multimedia content
5. **Feature Demos** - Automated CLI/UI motion demos

## Directory Structure

```
docs/auto-docs/
├── templates/           # Documentation templates
│   ├── release-log.md
│   ├── blog-post.md
│   ├── social-tweet.md
│   ├── video-script.md
│   └── feature-demo.md
├── generated/           # Auto-generated content
│   ├── releases/        # Release logs per version
│   ├── blog/            # Blog post drafts
│   ├── social/          # Social media content
│   ├── videos/          # Video scripts
│   └── demos/           # Feature demo specs
├── scripts/             # Generation scripts
│   ├── generate-docs.ts # Main orchestrator
│   ├── release-log.ts   # Release log generator
│   ├── blog-post.ts     # Blog post generator
│   ├── social-media.ts  # Social media generator
│   ├── video-script.ts  # Video script generator
│   └── feature-demo.ts  # Demo generator
└── README.md            # This file
```

## Git Hooks

### Post-Commit Hook
Automatically generates release logs after each commit:
- Analyzes commit message and changed files
- Creates structured release log entry
- Updates the changelog

### Pre-Push Hook (PR Requirement)
Ensures documentation requirements before pushing:
- Validates feature log exists for new features
- Checks blog post draft is present
- Verifies social media content is ready
- Confirms video script is prepared

## Usage

### Manual Generation

```bash
# Generate all documentation for current changes
npm run docs:generate

# Generate specific documentation type
npm run docs:release-log
npm run docs:blog
npm run docs:social
npm run docs:video
npm run docs:demo

# Generate for a specific commit
npm run docs:generate -- --commit <sha>

# Generate for version bump
npm run docs:version-bump -- --version 1.0.0
```

### Automatic Generation (via hooks)

Documentation is automatically generated:
- **On commit**: Release log entry created
- **On PR**: Full documentation suite generated
- **On version bump**: Breaking change documentation added

## Templates

### Release Log Template
Technical changelog with:
- Version/commit reference
- Changed files summary
- API changes
- Database migrations
- Breaking changes

### Blog Post Template
Customer-focused article with:
- Feature headline
- Customer benefit summary
- Use case examples
- Getting started guide
- Visual demos

### Social Media Template
Platform-optimized content:
- Twitter/X (280 chars)
- LinkedIn (longer form)
- Discord announcement

### Video Script Template
Multimedia production guide:
- Intro hook (5 seconds)
- Problem statement
- Solution demo
- Feature walkthrough
- Call to action

### Feature Demo Template
Automated demo specification:
- CLI commands sequence
- Expected outputs
- UI interaction flow
- Motion video keyframes

## Breaking Changes & Version Bumps

Major version changes trigger enhanced documentation:
- Migration guide generation
- Deprecation notices
- API compatibility matrix
- Customer communication templates

## Configuration

Edit `docs/auto-docs/config.json` to customize:
- Output directories
- Template variables
- Hook behavior
- Generation rules

## Self-Documentation

This system is itself self-documenting. The auto-docs system will:
- Document its own changes
- Generate usage examples
- Create tutorial content
- Maintain API reference
