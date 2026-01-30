# Open LOS

Open-source B2B Lending CRM — headless API first.

## Purpose

This repo serves two purposes:

1. **Capture ideas** — Ideas should go into `/docs`, either appended to an existing doc where they clearly fit, or as a new doc.
2. **Iterate the codebase** — Build and improve the actual code.

If a request is obviously about capturing an idea rather than changing code, skip straight to #1.

## Quick Start

```bash
# Install dependencies
npm install

# Run tests (161 conformance tests)
npm test

# Start the API server
npm run start --workspace=packages/api

# Or with persistent database
DB_PATH=./data.db npm run start --workspace=packages/api
```

## API Examples

```bash
# Health check
curl http://localhost:3000/health

# Create a deal
curl -X POST http://localhost:3000/v1/deals \
  -H "Content-Type: application/json" \
  -d '{"borrower_name":"Acme Ltd","jurisdiction":"UK","requested_amount":500000,"purpose":"Working capital"}'

# List deals
curl http://localhost:3000/v1/deals

# Get a deal
curl http://localhost:3000/v1/deals/{id}

# Transition to origination stage
curl -X POST http://localhost:3000/v1/deals/{id}/stage-transitions \
  -H "Content-Type: application/json" \
  -H "X-Actor: alice" \
  -d '{"to_stage":"origination"}'
```

## Project Structure

```
packages/
  core/           # Domain logic, services, database schema
  api/            # Hono HTTP server
  conformance/    # YAML-driven test suites

schemas/          # JSON Schema definitions
conformance/      # Test cases and fixtures
openapi/          # OpenAPI 3.1 spec
docs/             # Architecture documentation
```

## What's Implemented

| Feature | Status |
|---------|--------|
| Deal lifecycle (5 stages) | ✅ |
| Stage guards & overrides | ✅ |
| Document management | ✅ |
| Audit trail (immutable) | ✅ |
| Entity graph (companies, people, relationships) | ✅ |
| Financial spreading & ratios | ✅ |
| Covenants (tests, grace periods, waivers) | ✅ |
| Bank transaction monitoring | ✅ |
| Liquidity & alerts | ✅ |
| Email ingestion | ✅ |
| Facilities | ✅ |
| Approval workflow | ✅ |
| Loan ledger (Mambu-compatible) | ✅ |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `DB_PATH` | `:memory:` | SQLite database path |

## Development

```bash
# Type check
npm run build

# Run specific test suite
npx vitest run packages/conformance/src/smoke.test.ts

# Watch mode
npm run dev --workspace=packages/api
```

## Documentation

- [SPEC.md](./docs/SPEC.md) — Product specification
- [AGENTS.md](./docs/AGENTS.md) — Agent instructions and coding standards
- [MANIFESTO.md](./docs/MANIFESTO.md) — Project manifesto
- [openapi/v1.yaml](./openapi/v1.yaml) — API contract
- [docs/AI_NATIVE_ARCHITECTURE.md](./docs/AI_NATIVE_ARCHITECTURE.md) — AI integration architecture
- [docs/auto-docs/](./docs/auto-docs/) — Auto-documentation system

## Auto-Documentation System

Open LOS includes a comprehensive self-documenting system that automatically generates customer-facing content for every change.

### What Gets Generated

| Content Type | Trigger | Purpose |
|-------------|---------|---------|
| **Release Logs** | Every commit | Technical changelog entries |
| **Blog Posts** | Feature commits | Customer-facing impact articles |
| **Social Media** | Every release | Twitter, LinkedIn, Discord content |
| **Video Scripts** | Features/releases | Demo script prompts |
| **Feature Demos** | New features | CLI/UI motion demo specs |
| **Migration Guides** | Breaking changes | Upgrade documentation |

### Quick Start

```bash
# Install documentation git hooks
./docs/auto-docs/scripts/install-hooks.sh

# Generate all documentation for current commit
npm run docs:generate

# Generate specific documentation type
npm run docs:release-log
npm run docs:blog
npm run docs:social
npm run docs:video
npm run docs:demo

# Generate version bump documentation
npm run docs:version-bump -- --version 1.0.0
```

### How It Works

1. **Post-Commit Hook**: Automatically generates release logs after each commit
2. **Pre-Push Hook**: Validates documentation exists before pushing (warns for missing docs)
3. **PR Requirements**: Feature commits should have blog post drafts
4. **Version Bumps**: Major/minor versions trigger full documentation suite

### Generated Content Location

```
docs/auto-docs/generated/
├── releases/       # Release logs per commit
├── blog/           # Blog post drafts
├── social/         # Social media content
├── videos/         # Video scripts
├── demos/          # Feature demo specs
├── migrations/     # Migration guides
└── announcements/  # Version announcements
```

### Templates

Customize documentation output by editing templates in `docs/auto-docs/templates/`:

- `release-log.md` — Technical changelog format
- `blog-post.md` — Customer blog article structure
- `social-tweet.md` — Multi-platform social content
- `video-script.md` — Short/long-form video scripts
- `feature-demo.md` — CLI/UI demo specifications

### Configuration

Edit `docs/auto-docs/config.json` to customize:
- Which documentation types to generate
- Hook behavior and requirements
- Social media platforms and hashtags
- Video and demo specifications

### Building in Public

This auto-documentation system enables "building in public" by ensuring:

- Every change is communicated to customers
- Technical updates are translated to business value
- Social presence is maintained automatically
- Video content is always scripted and ready
- Breaking changes are properly documented

## License

MIT
