# ideas

# Self improving software


https://factory.ai/news/factory-signals

Signals processes sessions using LLM and embedding-based analysis. The model never surfaces raw conversation content to human analysts. Instead, it extracts abstract patterns and categorized signals that tell us what happened without revealing what was said.

Facet Extraction
Every session gets decomposed into structured metadata. We call these facets: the programming languages involved, the primary intent, how many tool calls were confirmed, whether the session ended in success or abandonment, what frameworks were referenced. These facets enable aggregate analysis across thousands of sessions without anyone reading the underlying conversations.

The facet schema itself evolves over time through semantic clustering. As Signals processes batches of sessions, it generates embeddings for each session's abstracted summary and clusters similar sessions together. The LLM then analyzes these clusters to identify new facet categories worth tracking. When a cluster emerges that doesn't map cleanly to existing facets, Signals proposes a new dimension.

Early versions of Signals had no concept of "branch switches" as a facet. The clustering revealed a group of sessions that shared similar patterns but didn't fit existing categories. When the LLM examined what these sessions had in common, it identified that git branch changes correlated with session complexity and surfaced it as a new dimension worth tracking.

https://x.com/nicbstme/status/2015795605524901957
Why it’s so hard to build in AI?
It’s nearly impossible to predict what scaffolding will become obsolete and when. What appears to be essential infrastructure and industry best practice today can transform into legacy technical debt within months.
The best way to grasp how fast LLMs are eating scaffolding is to look at their system prompt (the top-level instruction that tells the AI how to behave).

AI is inverting this. The best AI code is simple and close to the model


# UI evolution

https://hashbrown.dev/

Embed intelligence into your product's user experience by integrating LLMs with your UI components and client-side logic.

Intelligence where it helps. Nowhere it doesn't.



# Models

make it easy and seamless for people to run fully on prem models



# agentic software

https://x.com/ishanxnagpal/status/2016281522735874441

What an FDE Actually Does
An FDE doesn't wait for you to ask for automation. They watch how you work. They notice you do the same analysis every quarter. They notice you always check the same five metrics. They notice you uploaded the same Excel template three times.
Then they say: "I noticed you keep doing this. Want me to automate it?"

Each user gets their own filesystem rooted at their (user_uuid). System skills live in /public/. Agent reads both.

    /{user_uuid}/ —- memories/ 1 — UserMemories.md — skills/ # their custom skills - watchlists/ artifacts/

    /public/ 1 • skills/ # system skills (everyone gets these) •••

The filesystem enables three loops:
Learning loop. User signs up. Agent asks what they do, how they invest. Writes to UserMemories.md. Every session, reads it first. Doesn't ask "what do you care about" again.

Automation loop. Runs weekly. Agent reviews your conversations, spots repeated templates, repeated document structures, repeated workflows. Emails recommendations. User replies yes. Agent writes SKILL.md. The product customizes itself to how they work.


Outreach loop. User goes quiet. Trigger fires. Agent checks their watchlists, sees something happened. Sends personalized email with research attached. Not a drip campaign. Actual relevance.


https://x.com/nicbstme/status/2015174818497437834
Here’s what I’ll cover:
- The Sandbox Is Not Optional - Why isolated execution environments are essential for multi-step agent workflows

Here’s the thing: agents need to run multi-step operations. A professional investor asks for a DCF valuation and that’s not a single API call. The agent needs to research the company, gather financial data, build a model in Excel, run sensitivity analysis, generate complex charts, iterate on assumptions. That’s dozens of steps, each potentially modifying files, installing packages, running scripts.

Everything should be a sandbox job

/private (read/write) — {user_id}/ artifacts/ memories/ uploads/ /shared (read-only) - forg_id}/

FT • skills/ data/

- Context Is the Product - How we normalize heterogeneous financial data into clean, searchable context
Agent needs one thing: clean context it can reason over.
The normalization layer. Everything becomes one of three formats:
- Markdown for narrative content (filings, transcripts, articles)
- CSV/tables for structured data (financials, metrics, comparisons)
- JSON metadata for searchability (tickers, dates, document types, fiscal periods)


- The Parsing Problem - The hidden complexity of extracting structured data from adversarial SEC filings

- Skills Are Everything - Why markdown-based skills are becoming the product, not the model
1. Non-engineers can create skills. Our analysts write skills. Our customers write skills. A portfolio manager who’s done 500 DCF valuations can encode their methodology in a skill without writing a single line of Python.
2. No deployment needed. Change a skill file and it takes effect immediately. No CI/CD, no code review, no waiting for release cycles. Domain experts can iterate on their own.
Lazy skill loading. We have dozens of skills with extensive documentation like the DCF skill alone has 10+ industry guideline files. Loading all of them into context for every conversation would burn tokens and confuse the model. Instead, we discover skill metadata (name, description) upfront, and only load the full documentation when the agent actually uses that skill.

In October 2025, Anthropic formalized this with Agent Skills a specification for extending Claude with modular capability packages. A skill is a folder containing a `SKILL.md` file with YAML frontmatter (name and description), plus any supporting scripts, references, or data files the agent might need.
We’d been building something similar for months before the announcement. The validation felt good but more importantly, having an industry standard means our skills can eventually be portable.
Without skills, models are surprisingly bad at domain tasks. Ask a frontier model to do a DCF valuation. It knows what DCF is. It can explain the theory. But actually executing one? It will miss critical steps, use wrong discount rates for the industry, forget to add back stock-based compensation, skip sensitivity analysis. The output looks plausible but is subtly wrong in ways that matter.


- The Model Will Eat Your Scaffolding - Designing for obsolescence as models improve
- The S3-First Architecture - Why S3 beats databases for file storage and user data
The S3-First Architecture
Here’s something that surprised me: S3 for files is a better database than a database.
We store user data (watchlists, portfolio, preferences, memories, skills) in S3 as YAML files. S3 is the source of truth. A Lambda function syncs changes to PostgreSQL for fast queries.

- The File System Tools - How ReadFile, WriteFile, and Bash enable complex financial workflows
Agents in financial services need to read and write files. A lot of files. PDFs, spreadsheets, images, code. Here’s how we handle it.
ReadFile handles the complexity:
WriteFile creates artifacts that link back to the UI:
    Files in /private/artifacts/ become clickable links
    computer://user_id/artifacts/chart.png → opens in viewer
Bash gives persistent shell access with 180 second timeout and 100K character output limit. Path normalization on everything (LLMs love trying path traversal attacks, it’s hilarious).
Bash is more important than you think. There’s a growing conviction in the AI community that filesystems and bash are the optimal abstraction for AI agents. Braintrust recently ran an eval comparing SQL agents, bash agents, and hybrid approaches for querying semi-structured data.



- Temporal Changed Everything - Reliable long-running tasks with proper cancellation handling
- Real-Time Streaming - Building responsive UX with delta updates and interactive agent workflows
- Evaluation Is Not Optional - Domain-specific evals that catch errors before they cost money

- Production Monitoring - The observability stack that keeps financial agents reliable
Observability Stack

Braintrust: LLM traces (prompt, response, latency, cost)

Temporal UI: Workflow debugging (step failures, retry history)

Datadog: Infrastructure (CPU, memory, latency percentiles)



https://chat2chart.vercel.app/

templated artifacts

https://newsletter.pragmaticengineer.com/p/ai-first-makeover-craft?hide_intro_popup=true

skills built by customer support
During just two weeks of using Craft Agents, the customer support team have built these skills:

/triage: categorize tickets with parallel workers

/bug-report: process bugs and create Linear issues

/education: handle education license requests

/daily-report: generate an overview of the current ticket queue with Zendesk as a source

/get-user-data: enrich the context with user details from Craft’s database

/feature-request: process feature requests, gather more info when needed, store requests in Craft for processing later


https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals

agents.md as an important artifact. rather than skills we start with agent.md

related, how do we make vercel sandboxs and agents a first class cicitzen
look at how agents are repeating patterns, especially where outcome is successful, and repeate
https://github.com/casey/just/blob/master/examples/cross-platform.just


# analytics

critical is flexible self-serve analytics where the data models are tightly coupled to the internal tool model

# integrations

maybe for core https://github.com/FinAegis/core-banking-prototype-laravel or https://github.com/apache/fineract