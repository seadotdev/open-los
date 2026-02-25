# Open LOS Web Demo Deployment — Implementation Plan

## Vision

A publicly accessible demo at **demo.open-los.dev** where anyone can:
1. Explore the LOS through an interactive web UI with embedded terminal
2. Install the CLI (`npm i -g @open-los/cli`) and point it at the demo server
3. Add Open LOS as an MCP tool to their AI agent with one command
4. Run the full conformance suite against the live demo
5. Get isolated sandbox tenants so experiments don't collide

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                    demo.open-los.dev                      │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  Web App     │  │  API Server  │  │  Terminal WS   │  │
│  │  (Next.js)   │  │  (Hono)      │  │  Proxy         │  │
│  │              │  │  /v1/*       │  │  /ws/terminal   │  │
│  │  - Dashboard │  │              │  │                │  │
│  │  - Terminal  │  │  ┌────────┐  │  │  xterm.js ↔    │  │
│  │  - API Docs  │  │  │ SQLite │  │  │  CLI process   │  │
│  │  - Agent     │  │  │ (Turso)│  │  │                │  │
│  │    Playground│  │  └────────┘  │  └────────────────┘  │
│  └─────────────┘  └──────────────┘                       │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  MCP Gateway  (SSE transport for remote agents)     │ │
│  │  /mcp/sse                                           │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
         ▲               ▲                ▲
         │               │                │
    Web Browser     CLI Client      AI Agent (MCP)
    (any user)    (npm install)    (Claude Code, etc.)
```

---

## Phase 1: Remote-Ready API & CLI (`packages/api`, `packages/cli`)

### 1.1 — API: Demo Mode & Sandbox Tenants

**Goal**: Allow the API server to run in "demo mode" with auto-provisioned tenants.

**Changes to `packages/api`**:

- **`src/middleware/demo-auth.ts`** (new) — Middleware that:
  - Accepts `Authorization: Bearer demo_<random>` tokens
  - Auto-creates a tenant for each unique demo token (maps token → tenant_id)
  - Sets `X-Actor` and `X-Tenant-Id` headers from the token
  - Tokens are stateless JWT-like (signed with a server secret, containing tenant_id + actor)
  - Demo tokens expire after 24 hours
  - Each demo tenant gets pre-seeded sample data (1 deal in each stage, sample entities, spreads)

- **`src/middleware/rate-limit.ts`** (new) — Per-tenant rate limiting:
  - 100 requests/minute per tenant in demo mode
  - Prevents abuse of shared infrastructure

- **`src/seed/demo-data.ts`** (new) — Seed function that populates a tenant with:
  - 5 sample deals across different stages
  - 10 entities (mix of companies and people)
  - Relationships, documents, spreads, covenants
  - Gives new users something to explore immediately

- **`src/server.ts`** — Add `/v1/demo/provision` endpoint:
  ```
  POST /v1/demo/provision
  → { token: "demo_abc123", expires_at: "...", tenant_id: "demo_abc123", api_url: "https://demo.open-los.dev" }
  ```

- **Environment variables**:
  ```
  DEMO_MODE=true
  DEMO_SECRET=<signing-secret>
  DEMO_TENANT_TTL=86400        # 24h
  DEMO_MAX_TENANTS=1000
  ```

### 1.2 — CLI: Remote Server Support

**Goal**: `los` CLI can target a remote server instead of localhost.

**Changes to `packages/cli`**:

- **`src/config.ts`** (new or extend) — Configuration management:
  ```
  los config set server https://demo.open-los.dev
  los config set token demo_abc123
  los config get server
  ```
  Stored in `~/.open-los/config.json`

- **`src/commands/connect.ts`** (new) — One-step demo connection:
  ```bash
  # Provisions a demo tenant and saves config
  los connect demo
  # → Provisioned demo tenant. Token saved to ~/.open-los/config.json
  # → Server: https://demo.open-los.dev
  # → Tenant: demo_7f3a2b
  # → Expires: 2024-01-16T10:00:00Z

  # Connect to any remote server
  los connect https://my-los.company.com --token <token>
  ```

- **All existing commands** — Update HTTP client to read server URL and auth token from config, falling back to `http://localhost:3000` with no auth.

### 1.3 — MCP Server: Remote/SSE Transport

**Goal**: MCP server can connect to a remote API instead of running embedded, using SSE transport for web-based agents.

**Changes to `packages/mcp-server`**:

- **`src/transports/sse.ts`** (new) — SSE (Server-Sent Events) transport:
  - Implements MCP's SSE transport spec
  - Allows browser-based and remote agents to connect
  - Mounted at `/mcp/sse` on the API server

- **`src/context-remote.ts`** (new) — Remote service context:
  - Instead of direct DB access, proxies all service calls through the REST API
  - Constructor takes `{ apiUrl, token }`
  - Allows `npx @open-los/mcp-server --remote https://demo.open-los.dev --token demo_abc123`

- **`.mcp.json` snippet** for users to add to their agent:
  ```json
  {
    "mcpServers": {
      "open-los-demo": {
        "command": "npx",
        "args": ["@open-los/mcp-server", "--remote", "https://demo.open-los.dev", "--token", "YOUR_TOKEN"]
      }
    }
  }
  ```

---

## Phase 2: Web Application (`packages/web`)

### 2.1 — Project Setup

**New package**: `packages/web` (Next.js 14+ App Router)

**Tech stack**:
- Next.js (App Router) — SSR, API routes for terminal proxy
- Tailwind CSS — Styling (matches existing dark theme prototype)
- xterm.js + @xterm/addon-fit — Embedded terminal
- Monaco Editor — Code snippet editing
- React Query — API data fetching
- Shadcn/ui — Component library

### 2.2 — Landing Page & Onboarding

**Route**: `/`

- Hero section explaining Open LOS
- "Try the Demo" button → provisions a demo tenant and redirects to dashboard
- "Install CLI" section with copy-paste commands:
  ```bash
  npm install -g @open-los/cli
  los connect demo
  ```
- "Add to Your Agent" section with the MCP snippet
- Architecture diagram (interactive)

### 2.3 — Dashboard

**Route**: `/dashboard`

Built on the existing `frontend/experimental/` activity feed design:

- **Activity Feed** — Real-time audit trail (polls `/v1/audit-events`)
- **Pipeline View** — Deals by stage (kanban-style from `frontend/traditional/`)
- **Quick Stats** — Deal count, total exposure, pending approvals
- **Action Items** — Items requiring attention (from agent's `getActionItems()`)

### 2.4 — Interactive Web Terminal

**Route**: `/terminal` (also embedded as a panel in dashboard)

**Architecture**:
```
Browser (xterm.js) ←WebSocket→ Terminal Proxy ←spawn→ CLI process
```

- **`packages/web/src/app/api/terminal/route.ts`** — WebSocket endpoint:
  - Spawns a `los` CLI process per session (with demo tenant config pre-loaded)
  - Pipes stdin/stdout between WebSocket and CLI process
  - Kills process on disconnect
  - Session timeout: 30 minutes
  - Max concurrent sessions: 50

- **Terminal UI features**:
  - Full xterm.js terminal with ANSI color support
  - Pre-loaded with demo tenant credentials
  - Welcome message showing available commands
  - Command history (session-local)
  - Copy/paste support
  - Resizable panel

- **Guided walkthrough mode**:
  - Step-by-step tutorial overlay
  - "Type this command" prompts with auto-complete
  - Explains each response
  - Covers: create deal → add entity → upload doc → spread → transition stages

### 2.5 — Agent Playground

**Route**: `/playground`

Interactive environment to test AI agent interactions:

- **MCP Tool Tester** — Form-based UI to call any MCP tool manually:
  - Dropdown of all available tools
  - Auto-generated form from Zod schemas
  - JSON request/response viewer
  - Copy as cURL / copy as MCP call

- **Scenario Runner** — Pre-built agent scenarios:
  - "Originate a $1M commercial loan for Acme Corp"
  - "Underwrite and evaluate a deal with financial spreads"
  - "Set up covenant monitoring for an active loan"
  - "Multi-entity deal with guarantors"
  - Each scenario shows the sequence of MCP calls and responses

- **Agent Chat Interface** — If user provides their own API key:
  - Chat with Claude about deals in their demo tenant
  - Claude uses MCP tools to interact with the LOS
  - Shows tool calls in a side panel
  - Demonstrates the "AI as equal actor" principle

### 2.6 — API Documentation

**Route**: `/docs`

- Interactive API docs (Swagger/OpenAPI-style, generated from Hono routes)
- "Try it" buttons that execute against the user's demo tenant
- Code examples in cURL, JavaScript, Python
- MCP tool reference with schemas

---

## Phase 3: One-Command Agent Integration

### 3.1 — `npx @open-los/create` (Bootstrap Command)

**New package**: `packages/create-open-los`

Single command to add Open LOS to any project/agent:

```bash
# Add MCP server to Claude Code
npx @open-los/create mcp

# Add to Claude Code with demo server
npx @open-los/create mcp --demo

# Scaffold a new project using Open LOS
npx @open-los/create app

# Add CLI and connect to demo
npx @open-los/create cli --demo
```

**`mcp` subcommand**:
1. Detects if `.mcp.json` exists
2. Adds `open-los` server entry
3. If `--demo`: auto-provisions demo tenant, includes token
4. If local: points to `npx tsx packages/mcp-server/src/server.ts`
5. Prints confirmation and next steps

**`cli` subcommand**:
1. Installs `@open-los/cli` globally (or as dev dependency)
2. If `--demo`: runs `los connect demo` automatically
3. Prints quick-start commands

**`app` subcommand**:
1. Scaffolds a Next.js project with Open LOS SDK pre-configured
2. Includes example pages for deal management
3. Pre-wired API client pointing to demo or local

### 3.2 — Claude Code Skill / Snippet

A skill definition that users can give to their Claude Code agent:

**`packages/skills/open-los.md`** — Instruction set:
```markdown
# Open LOS Skill

You have access to an Open LOS (Loan Origination System) instance.

## Available MCP Tools
- deal.create, deal.get, deal.list, deal.update
- entity.create, entity.list
- relationship.create, relationship.list
- document.upload, document.list
- spread.create, spread.getRatios
- covenant.create, covenant.test
- facility.create, facility.list
- stage.transition, stage.getGuards
- gate.create, gate.evaluate
- audit.listByDeal
- underwriting.evaluate
- monitoring.ingest, monitoring.getStatus

## Workflow Pattern
1. Create deal with borrower info
2. Create entities (company + guarantors)
3. Link entities to deal via relationships
4. Upload/create financial documents
5. Create financial spreads and compute ratios
6. Set up covenants and test them
7. Create facilities (loan terms)
8. Transition through stages: broker → origination → underwriting → closing → monitoring
9. Use audit.listByDeal to review history
```

---

## Phase 4: Deployment Infrastructure

### 4.1 — Containerization

**`Dockerfile`** (root):
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY packages/ ./packages/
RUN npm ci --workspace=packages/core --workspace=packages/api --workspace=packages/mcp-server --workspace=packages/cli --workspace=packages/web
RUN npm run build --workspace=packages/web
EXPOSE 3000
CMD ["node", "packages/api/dist/cli.js", "--demo"]
```

**`docker-compose.yml`**:
```yaml
services:
  api:
    build: .
    ports: ["3000:3000"]
    environment:
      - DEMO_MODE=true
      - DB_PATH=/data/demo.db
      - DEMO_SECRET=${DEMO_SECRET}
    volumes:
      - los-data:/data

  web:
    build:
      context: .
      dockerfile: packages/web/Dockerfile
    ports: ["3001:3000"]
    environment:
      - API_URL=http://api:3000
    depends_on: [api]

volumes:
  los-data:
```

### 4.2 — Hosting Recommendation

**Primary**: **Railway** or **Fly.io**
- Both support persistent volumes (for SQLite/Turso)
- Easy Docker deployment
- Auto-TLS
- Reasonable free tiers for demos

**Alternative**: **Render** (free tier for demos)

**Database**: **Turso** (LibSQL cloud)
- SQLite-compatible (zero code changes)
- Edge replication
- Free tier: 9GB storage, 500M reads/month
- Eliminates need for persistent volumes

**Static assets / CDN**: **Vercel** or **Cloudflare Pages** for the web frontend

### 4.3 — CI/CD Pipeline

**`.github/workflows/deploy-demo.yml`**:
```yaml
name: Deploy Demo
on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test
      - run: npm run typecheck

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Railway/Fly
        run: # provider-specific deploy command
```

### 4.4 — Monitoring & Cleanup

- **Demo tenant cleanup** — Cron job deletes tenants older than 24h
- **Health check** — `/v1/health` endpoint (already exists or trivial to add)
- **Usage metrics** — Track demo provisioning, API calls per tenant
- **Error tracking** — Sentry or similar
- **Uptime monitoring** — UptimeRobot or similar

---

## Phase 5: Agentic Testing Framework

### 5.1 — Remote Conformance Runner

**Extend `packages/conformance`**:

```bash
# Run conformance suite against demo server
npm run test:conformance -- --server https://demo.open-los.dev --token demo_abc123

# Run against local
npm run test:conformance
```

- Modify conformance runner to support remote HTTP targets
- Add `--server` and `--token` flags
- Output: standard TAP/JUnit results

### 5.2 — Agent Evaluation Harness

**New package**: `packages/eval`

Test how well AI agents perform loan origination tasks:

- **Scenario definitions** (YAML, extending conformance format):
  ```yaml
  name: "Full deal origination"
  description: "Agent must originate a $2M commercial loan"

  initial_state:
    # Pre-seeded data
    entities: [...]

  goal:
    deal:
      stage: closing
      borrower_name: "Acme Corp"
      requested_amount: 200000000  # $2M in cents
    required_artifacts:
      - financial_spread
      - covenant_setup
      - facility_terms

  evaluation:
    max_steps: 50
    max_time: 120s
    scoring:
      - name: "Deal created correctly"
        check: deal.requested_amount == 200000000
        weight: 1
      - name: "All stages traversed"
        check: audit contains transitions through all stages
        weight: 2
      - name: "Financial analysis complete"
        check: spread.ratios exist and are valid
        weight: 2
  ```

- **Agent adapters** — Pluggable interface for testing different agents:
  - Claude Code (via MCP)
  - Custom agents (via REST API)
  - ChatGPT / other LLMs (via function calling → REST)

- **Evaluation metrics**:
  - Task completion rate
  - Number of API calls (efficiency)
  - Error recovery (how agent handles 400s)
  - Time to completion
  - Audit trail correctness

### 5.3 — Multi-Agent Collaboration Tests

Test scenarios where multiple agents work on the same deal:

```yaml
name: "Handoff: Broker agent → Underwriter agent"
agents:
  - name: broker-agent
    role: "Creates deal and gathers initial documents"
    actor: "broker-ai"
  - name: underwriter-agent
    role: "Evaluates deal and makes credit decision"
    actor: "underwriter-ai"

steps:
  - agent: broker-agent
    goal: "Create deal for Acme Corp, $5M, add financials"
    until: deal.stage == "underwriting"

  - agent: underwriter-agent
    goal: "Evaluate deal, set covenants, approve or decline"
    until: deal.stage == "closing" OR deal.stage == "declined"

evaluation:
  - "Both agents' actions appear in audit trail"
  - "Stage transitions follow valid paths"
  - "No data corruption from concurrent access"
```

### 5.4 — Chaos Testing for Agents

Test agent resilience:

- **Rate limit testing** — Agent hits rate limits, must back off
- **Invalid state testing** — Deals pre-loaded in invalid states
- **Permission denial** — Some operations blocked, agent must find alternatives
- **Concurrent modification** — Two agents modifying same deal
- **Partial failure** — API returns 500 on some calls, agent must retry

---

## Phase 6: npm Publishing & Distribution

### 6.1 — Package Publishing

Publish to npm under `@open-los` scope:

| Package | npm name | Purpose |
|---------|----------|---------|
| `packages/cli` | `@open-los/cli` | CLI tool |
| `packages/mcp-server` | `@open-los/mcp-server` | MCP server for agents |
| `packages/core` | `@open-los/core` | Core domain library |
| `packages/agent` | `@open-los/agent` | Agent orchestration SDK |
| `packages/api` | `@open-los/api` | Self-hosted API server |
| `packages/create-open-los` | `@open-los/create` | Bootstrap command |
| `packages/eval` | `@open-los/eval` | Agent evaluation harness |

### 6.2 — Quick Start Flows

**Flow 1: "I want to try it in my browser"**
```
Visit demo.open-los.dev → Click "Try Demo" → Use web terminal + dashboard
```

**Flow 2: "I want my AI agent to use it"**
```bash
npx @open-los/create mcp --demo
# Done. Your agent now has LOS tools.
```

**Flow 3: "I want to install the CLI"**
```bash
npm install -g @open-los/cli
los connect demo
los deal list
```

**Flow 4: "I want to self-host"**
```bash
npx @open-los/create app
# or
docker run -p 3000:3000 ghcr.io/open-los/open-los
```

**Flow 5: "I want to evaluate my agent against it"**
```bash
npx @open-los/eval --scenario full-origination --agent my-agent.ts
```

---

## Implementation Order & Priority

| Priority | Phase | Effort | Description |
|----------|-------|--------|-------------|
| **P0** | 1.1 | 3 days | Demo mode API + sandbox tenants |
| **P0** | 1.2 | 2 days | CLI remote server support |
| **P0** | 4.1 | 1 day | Dockerfile + docker-compose |
| **P0** | 4.2 | 1 day | Deploy to Railway/Fly.io |
| **P1** | 2.1-2.2 | 2 days | Web app setup + landing page |
| **P1** | 2.4 | 3 days | Web terminal (xterm.js + WS proxy) |
| **P1** | 1.3 | 2 days | MCP SSE transport for remote agents |
| **P1** | 3.1 | 2 days | `npx @open-los/create` bootstrap |
| **P2** | 2.3 | 3 days | Dashboard (activity feed + pipeline) |
| **P2** | 2.5 | 3 days | Agent playground |
| **P2** | 3.2 | 1 day | Claude Code skill definition |
| **P2** | 5.1 | 2 days | Remote conformance runner |
| **P3** | 2.6 | 2 days | API documentation |
| **P3** | 5.2 | 5 days | Agent evaluation harness |
| **P3** | 5.3 | 3 days | Multi-agent collaboration tests |
| **P3** | 5.4 | 2 days | Chaos testing |
| **P3** | 6.1 | 2 days | npm publishing pipeline |

**Total estimated scope**: ~37 days of focused development

**MVP (P0 only)**: ~7 days — Gets a deployed demo with CLI access
**Demo-ready (P0+P1)**: ~16 days — Adds web UI with terminal + MCP remote
**Full platform (all)**: ~37 days — Complete testing and distribution platform

---

## Key Design Decisions

1. **SQLite/Turso over Postgres** — Zero operational complexity, matches existing architecture, Turso gives cloud scale without code changes

2. **Tenant isolation via existing multi-tenancy** — The `X-Tenant-Id` header system already exists; demo mode just auto-provisions tenants

3. **xterm.js real terminal over simulated** — Real CLI process gives authentic experience, avoids maintaining a fake terminal layer

4. **SSE transport for MCP** — Standard MCP transport that works over HTTP, enabling remote agent connections without custom protocols

5. **YAML-driven eval over code-heavy** — Extends the existing conformance test pattern, keeping agent evaluations declarative and accessible

6. **No user accounts** — Demo uses ephemeral tokens, no sign-up friction. Self-hosted version handles its own auth.
