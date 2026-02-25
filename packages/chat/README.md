# @open-los/chat

Chat interface for Open LOS — control your loan origination system from Slack, Microsoft Teams, and more.

Built on the [Vercel Chat SDK](https://chat-sdk.dev/) (`npm i chat`). Write bot logic once, deploy to every chat platform.

## Supported Platforms

| Platform | Adapter | Status |
|----------|---------|--------|
| Slack | `@chat-adapter/slack` | Supported |
| Microsoft Teams | `@chat-adapter/teams` | Supported |

## Quick Start

### 1. Set environment variables

```bash
# Slack
SLACK_APP_TOKEN=xapp-...
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...

# Microsoft Teams
TEAMS_APP_ID=...
TEAMS_APP_PASSWORD=...

# State management (optional — uses in-memory if not set)
REDIS_URL=redis://localhost:6379

# LLM for natural language (optional — commands work without it)
ANTHROPIC_API_KEY=sk-ant-...
```

### 2. Start the API server

```bash
SLACK_BOT_TOKEN=xoxb-... npm run start --workspace=packages/api
```

The chat bot mounts automatically at `/chat/*` when platform credentials are detected.

### 3. Configure your Slack/Teams app

**Slack:**
- Set your app's Event Subscription URL to: `https://your-domain.com/chat/slack/events`
- Set Interactivity URL to: `https://your-domain.com/chat/slack/actions`
- Set Slash Command URL to: `https://your-domain.com/chat/slack/commands`

**Teams:**
- Set your bot's Messaging Endpoint to: `https://your-domain.com/chat/teams/messages`

## Available Commands

### Slash Commands

| Command | Description |
|---------|-------------|
| `/los-deals` | List active deals |
| `/los-deal <id>` | Get deal details |
| `/los-new-deal <name> <amount> [purpose] [jurisdiction]` | Create a new deal |
| `/los-advance <id>` | Advance deal to next stage |
| `/los-portfolio` | Portfolio summary |
| `/los-help` | Show available commands |

### Natural Language (@mentions)

Mention the bot in any channel:

- `@open-los list deals` — Show active deals
- `@open-los deal abc123` — Get deal details
- `@open-los create deal for Acme $500000 working_capital` — Start a new deal
- `@open-los advance abc123` — Move deal to next stage
- `@open-los portfolio` — Portfolio overview

### Thread Conversations

After the bot is mentioned, it subscribes to the thread. You can continue chatting:

- `list deals`
- `deal abc123`
- `advance abc123`
- `help`

With an LLM configured, the bot can also handle natural language questions about lending.

## Architecture

```
Slack / Teams
    │
    ▼ webhooks
┌─────────────────────────────────┐
│  Hono API Server (/chat/*)     │
│  packages/api/src/routes/chat   │
└──────────┬──────────────────────┘
           │
┌──────────▼──────────────────────┐
│  @open-los/chat                 │
│  - Vercel Chat SDK (bot core)  │
│  - Slash command handlers       │
│  - @mention handlers            │
│  - Natural language (LLM)       │
│  - Rich card formatting         │
└──────────┬──────────────────────┘
           │
┌──────────▼──────────────────────┐
│  @open-los/agent                │
│  - Service adapter layer        │
│  - LLM client                   │
└──────────┬──────────────────────┘
           │
┌──────────▼──────────────────────┐
│  @open-los/core                 │
│  - Domain services              │
│  - Database (SQLite)            │
│  - Audit trail                  │
└─────────────────────────────────┘
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SLACK_APP_TOKEN` | For Slack | Slack app-level token (xapp-...) |
| `SLACK_BOT_TOKEN` | For Slack | Slack bot user OAuth token (xoxb-...) |
| `SLACK_SIGNING_SECRET` | For Slack | Slack signing secret for request verification |
| `TEAMS_APP_ID` | For Teams | Microsoft Teams app ID |
| `TEAMS_APP_PASSWORD` | For Teams | Microsoft Teams app password |
| `REDIS_URL` | No | Redis URL for production state (defaults to in-memory) |
| `DEFAULT_TENANT_ID` | No | Multi-tenant isolation (defaults to "default") |
| `ANTHROPIC_API_KEY` | No | Enables LLM-powered natural language |
| `OPENROUTER_API_KEY` | No | Alternative LLM provider |
