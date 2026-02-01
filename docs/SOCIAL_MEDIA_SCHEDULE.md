# Social Media Posting Schedule: Open LOS Story Arc

> A content calendar that tells the story of building an AI-native Loan Origination System in public.

---

## Post 1: The Origin Story
**Theme:** Why now is different
**Related Commit:** `e20adaf` → `ff485da` (Jan 28-29)

### Draft

Something our customers always ask us is "which LOS should we use?"

Our answer has always been "they're all terrible."

But here's what changed: it used to be that "terrible" was acceptable because the alternatives were worse. Building your own LOS meant a 3-year, $5M project. The vendor's mediocre system was still better than the risk of building.

That calculation just flipped.

Claude wrote 80% of Open LOS in a weekend. Not a prototype—161 conformance tests, 21 database tables, full deal lifecycle, covenant tracking, loan ledger. The kind of system that would have taken a team of 5 engineers two years.

The cost of building quality software has collapsed. The only moat enterprise vendors have left is your fear of switching.

Meanwhile, Salesforce is restricting API access for AI agents. They can see what's coming. When an AI can do in 30 seconds what their UI does in 30 minutes, the UI isn't a feature anymore—it's friction.

So while I was driving, I sketched out what a lending system would look like if you assumed AI agents would be the primary operators from day one. Not "AI-enabled." AI-native.

Here it is: [link]

The interesting question isn't whether this works. It's what happens to the $50B enterprise software market when building becomes 100x cheaper but the problems stay the same.

---

## Post 2: The Separation Principle
**Theme:** The insight that AI should never touch the math
**Related Commit:** `f0ffa95` AGENTS.md (Jan 29)

### Draft

The most common question about Open LOS: "How do you prevent AI hallucination in financial calculations?"

The answer reveals something important about where AI actually creates value.

We don't use AI for the math. At all. DSCR, leverage ratios, covenant tests—these are deterministic functions. Code computes them. Every time. Reproducibly. Auditibly.

The AI's job is everything *around* the math:
- Extract the numbers from messy documents
- Explain why the ratio matters for this specific deal
- Draft the narrative that goes in the credit memo
- Notice patterns across the portfolio humans would miss

Here's the principle: **AI is for judgment and language. Code is for computation and rules.**

The moment you let AI "calculate" a financial ratio, you've introduced a failure mode that will eventually blow up in an audit. The moment you force humans to manually extract data from PDFs, you've wasted $200/hour on a task AI does better.

Most "AI-enabled" enterprise software gets this backwards. They bolt AI onto legacy systems to do tricks—auto-fill a form, suggest a next step. The computation is still trapped in spaghetti code that nobody can audit.

AI-native means designing the boundary correctly from the start. The system of record is deterministic and auditable. The intelligence layer is probabilistic and replaceable. They communicate through typed APIs.

When a regulator asks "how did you calculate this covenant test?", you show them the function. When they ask "who decided this deal was worth pursuing?", you show them the AI session log and the human approval.

Clarity of responsibility. That's what "AI-native" actually means.

---

## Post 3: The Migration Trap
**Theme:** Fear of switching is the real lock-in
**Related Commit:** `014c16d` PRD_PARALLEL_MIGRATION_VALIDATION (Jan 30)

### Draft

"Can this sync with our existing systems?"

This question kept coming up, and the subtext was always the same: "We'd love to use something better, but we can't risk migrating."

Here's the uncomfortable truth: **your vendor's biggest competitive advantage is your fear.**

Not their features. Not their security. Not their compliance certifications. Your fear that migration will break something, that you'll lose data, that the cutover will fail during a critical period.

This fear is rational. I've seen migrations go catastrophically wrong. But it's also cultivated. Vendors make data export painful on purpose. They don't document their schemas. They charge for "migration assistance." Every friction is a feature.

So we built shadow mode.

Run Open LOS as a read-only replica of your current system. For weeks. For months. As long as you need.

- Real data flows in continuously (CDC, API sync, CSV imports)
- Both systems process the same inputs
- Automated comparison: do the outputs match?
- Daily reports showing coverage and discrepancies

You're not trusting a demo. You're validating against your actual loan book.

The insight: **migration risk is only unmanageable if you have to migrate all at once.** Shadow mode makes migration incremental. Move one workflow at a time. Roll back anything that doesn't work. Keep the old system running until you're bored of checking it.

This isn't just a feature. It's a direct attack on the psychology that keeps people trapped.

---

## Post 4: What CIOs Actually Worry About
**Theme:** Enterprise objections are proxies
**Related Commit:** `d39862d` ENTERPRISE_FAQ (Jan 30)

### Draft

Talked to a bank CIO last week. "My board will never approve open source for our loan book."

I've heard this objection a hundred times. It's never actually about open source.

**The real concern: "If something goes wrong, I need someone to blame."**

With a vendor, you have a contract, an SLA, a throat to choke. With open source, who do you call at 2am when the system is down?

This is a legitimate concern, but it reveals a mindset worth examining.

The vendor SLA doesn't prevent outages. It just defines who gets yelled at. Your borrowers don't care about your vendor contract—they care whether their disbursement arrived.

What actually prevents outages:
- Code you can read and debug yourself
- Engineers who understand the system
- Tests that prove behavior before deployment
- Architecture simple enough to reason about

Open LOS has 161 conformance tests. Every behavior is specified in YAML. Your engineers can read the entire codebase in a day. When something breaks, you fix it—you don't open a ticket and wait.

**The second hidden concern: "I don't want to be the person who championed the weird choice."**

If everyone uses Salesforce and Salesforce fails, that's a market failure. If you championed the open source option and it fails, that's your failure.

This is career risk management, not technology evaluation. It's also why innovation happens at the edges—startups and smaller institutions that can't afford the "safe" enterprise option.

The counter-argument: in 3 years, not having AI-native infrastructure will be the weird choice. The question is whether you want to be ahead of that curve or behind it.

---

## Post 5: Tests That Teach
**Theme:** What conformance tests reveal about domain understanding
**Related Commits:** `3be4cdc` Lending business simulation (Jan 30)

### Draft

Most test suites are afterthoughts. You build the feature, then write tests to prove it works.

We did it backwards. The tests were written first, by someone who understands lending. The code exists to make the tests pass.

```yaml
- name: covenant_breach_with_grace_period_no_immediate_alert
  steps:
    - action: create_covenant
      type: financial
      metric: dscr
      threshold: 1.2
      grace_period_days: 30
    - action: record_financials
      dscr: 1.1
    - action: test_covenant
    - assert: status equals "grace_period"
    - assert: no alert created
    - action: advance_time_days 31
    - action: test_covenant
    - assert: alert created
      type: covenant_breach
```

This test encodes domain knowledge that took decades to accumulate:
- Grace periods exist because temporary covenant breaches are common and often cure themselves
- Alerts should fire when breaches persist, not on first detection
- The system needs time-awareness for covenant logic

**The insight: tests are the most honest documentation.**

PRDs lie. Specs drift. Code comments rot. But if a test passes, that behavior exists. If a test fails, that behavior is broken.

We have 161 of these. Each one documents a behavior that matters for lending. A new engineer can read the test suite and understand how lending actually works—not how the docs say it works.

An AI agent can parse the YAML and know what's possible. No hallucination about capabilities that don't exist.

A regulator can review the tests and see exactly what the system enforces. Not marketing claims. Executable proofs.

The spec IS the tests. If it's not tested, it doesn't exist.

---

## Post 6: Where AI Destroys Value
**Theme:** The anti-patterns to avoid
**Related Commit:** `a3f5d3d` AI_NATIVE_WORKFLOW design (Jan 30)

### Draft

Everyone talks about where AI creates value. Let's talk about where it destroys value in lending.

**1. AI making lending decisions**

An AI that approves or rejects loans is a liability time bomb. You can't explain its reasoning to a regulator. You can't prove it's not discriminating. You can't audit why this loan was approved and that one wasn't.

The value is: AI surfaces information. Humans make decisions. The decision is logged with the human's identity, not "the algorithm."

**2. AI in the calculation path**

The moment DSCR flows through a language model, you've introduced non-determinism into your financial calculations. Run it twice, get different answers. Auditor asks how you calculated it, you shrug.

The value is: AI extracts the inputs. Deterministic code computes the outputs. Same inputs → same outputs. Forever.

**3. AI as the system of record**

I've seen startups where the "database" is ChatGPT conversations. No joke. "What was the loan amount?" "Let me check the thread." This is insane.

The value is: AI operates on a real database through typed APIs. The database is the source of truth. AI sessions are logged but ephemeral.

**4. AI that can't be replaced**

If your workflow requires GPT-4 specifically, you're vendor-locked to OpenAI. When they raise prices or change behavior, you're stuck.

The value is: AI layer is an interface. Swap Claude for GPT for Llama. The rest of the system doesn't care.

The pattern: AI is powerful precisely because it's fuzzy and flexible. Your system of record needs to be the opposite. Keep them separate. Connect them cleanly.

---

## Post 7: The Model Portability Problem
**Theme:** AI vendor lock-in is the new frontier
**Related Commit:** `8c074ed` CLI testing harness (Jan 30)

### Draft

We escaped Oracle. We escaped Salesforce. We're about to walk into OpenAI lock-in.

Think about it:
- Your prompts are tuned for GPT-4's quirks
- Your workflows depend on specific context windows
- Your costs are based on one vendor's pricing
- Your compliance depends on one vendor's data policies

When OpenAI changes their model (they will), raises prices (they will), or changes their terms (they will), you'll discover how locked in you are.

This is why we built the CLI testing harness.

```bash
./run.sh --model claude-opus-4 --scenario underwriting
./run.sh --model gpt-4o --scenario underwriting
./run.sh --model llama-70b --scenario underwriting
```

Same scenarios. Different models. Measured outputs.

Not because we know which model is best—we don't. But because:

1. **Models change monthly.** The best model in January isn't the best model in June.
2. **Costs vary wildly.** Claude might be 3x better for document extraction but 2x more expensive. Is that worth it for your volume?
3. **Compliance requirements vary.** Some clients can use cloud APIs. Others need on-prem models only.
4. **Failure modes differ.** Claude hallucinates differently than GPT. You want to know how each fails on your specific data.

The goal isn't to pick the best model. It's to treat models as interchangeable components you can swap based on the task, the cost, and the constraints.

Your database doesn't care if you switch from Postgres to MySQL. Your AI layer shouldn't care if you switch from Claude to Llama.

That's the moat: not being locked into anyone's moat.

---

## Post 8: Documentation as Commitment
**Theme:** Why auto-docs are about trust, not convenience
**Related Commit:** `350122d` Auto-documentation system (Jan 30)

### Draft

Here's a pattern I've seen destroy developer trust:

1. Feature ships
2. Docs say "coming soon"
3. Six months later, docs still say "coming soon"
4. Feature changes, old docs are now wrong
5. Nobody trusts the docs
6. Everyone reads the code
7. Code becomes the only documentation
8. New people can't onboard
9. Velocity dies

The problem isn't that developers are lazy. It's that documentation has no forcing function. Code has to work or the tests fail. Docs can be wrong indefinitely.

So we automated it.

Every commit triggers documentation generation. Not optional. Not "when we have time." Every commit.

- Release log (what changed)
- Blog draft (why it matters)
- Social content (how to talk about it)
- Migration notes (if breaking)

```
git commit → post-commit hook → LLM generates docs → docs committed
```

The LLM isn't magic here. It reads the diff and the existing docs and produces a first draft. Humans review. But the draft exists immediately. There's no "documentation sprint" because documentation is continuous.

**The deeper insight: auto-docs are a commitment device.**

By making documentation automatic, you're saying "we will communicate every change." Not "we'll communicate important changes when someone remembers." Every change.

This is what "building in public" actually requires. Not occasional blog posts. Continuous, automatic, honest communication about what you're building.

When your docs are always current, people start trusting them. When people trust docs, they can onboard faster. When people onboard faster, the project grows.

Documentation isn't overhead. It's compounding trust.

---

## Post 9: Executable Specifications
**Theme:** Why YAML tests change how you build
**Related Commit:** `b9d60eb` Spec-driven test suite (Jan 30)

### Draft

There are three ways to specify what software should do:

**1. Natural language documents**

"The system shall support covenant grace periods of configurable duration during which breaches do not trigger alerts."

Problem: ambiguous. What's "configurable"? What happens at the boundary? Do alerts fire on day 30 or day 31?

**2. Code**

```typescript
if (daysSinceBreach > covenant.gracePeriodDays) {
  createAlert(...)
}
```

Problem: you have to read implementation to understand intent. Mixed with error handling, edge cases, performance optimizations. The "what" is buried in the "how."

**3. Executable specifications**

```yaml
- name: grace_period_boundary_test
  steps:
    - create_covenant:
        grace_period_days: 30
    - record_breach
    - advance_time_days: 30
    - assert: no_alert
    - advance_time_days: 1
    - assert: alert_created
```

This is unambiguous, readable, and executable. It specifies behavior without implementation details. It's documentation that can't drift because if it's wrong, the build fails.

**The forcing function:**

When your spec is executable, you can't hand-wave. You can't write "configurable duration" and leave it undefined. You have to specify the exact behavior in a way a computer can verify.

This is painful at first. It forces precision when you'd rather be vague. But that precision is exactly what lending software needs.

When a regulator asks "what happens if a covenant is breached during a grace period?", you don't explain. You show them the test. When an auditor asks "how do you calculate DSCR?", you show them the test that specifies the formula.

161 tests. Each one a legal commitment to specific behavior.

The spec is the tests. If it's not in a test, we're not promising it.

---

## Post 10: The Endgame
**Theme:** Where this leads if we're right
**Related to:** Current state + IDEAS.md

### Draft

Let's play out the implications.

**If AI-maintained code is cheaper and better than human-only code:**

The $50B enterprise software market reprices. Not gradually—suddenly. The moment a startup ships 80% of Salesforce's functionality for $0, the value prop of the incumbent evaporates.

We're not there yet. But we're closer than people think. Open LOS exists because the gap between "what AI can build" and "what enterprises need" has mostly closed for certain domains.

**If open source wins in business infrastructure:**

Data sovereignty becomes the default expectation, not a premium feature. "You host our data" becomes as suspicious as "we read your email to show ads."

The vendors that survive will be the ones providing genuine value—implementation help, insurance, SLAs—not lock-in.

**If the next generation of lenders is AI-native from day one:**

They'll operate at 10x the efficiency of legacy institutions. Not because they're smarter, but because they don't have 30 years of accumulated software debt.

A 5-person fintech will handle the loan volume of a 50-person traditional lender. The cost structures will be so different that legacy players can't compete on price.

**The uncomfortable implication:**

If we're right, most enterprise software companies are walking dead. Their revenue is locked-in contracts, not delivered value. When those contracts come up for renewal, the math won't work anymore.

This isn't certain. We could be wrong about timing. We could be wrong about which domains flip first. But the direction seems clear.

What we're building:
- MCP server for native AI agent integration
- Skills system for encoding human expertise as reusable workflows
- Self-improving loops that learn from successful operations
- On-prem model support for fully sovereign deployments

The incumbents are building walls. We're building the thing that makes walls irrelevant.

[link to repo]

---

## Posting Cadence

| Post | Suggested Timing | Platform Focus |
|------|------------------|----------------|
| 1 | Day 1 | Twitter/X, LinkedIn, HN |
| 2 | Day 3-4 | Twitter/X thread |
| 3 | Day 6-7 | LinkedIn (enterprise audience) |
| 4 | Day 9-10 | LinkedIn, Twitter/X |
| 5 | Day 12-13 | Twitter/X |
| 6 | Day 15-16 | Twitter/X thread |
| 7 | Day 18-19 | Twitter/X, Dev community |
| 8 | Day 22-23 | Twitter/X |
| 9 | Day 26-27 | Twitter/X thread |
| 10 | Day 30+ | All platforms |

---

## Content Principles

1. **Lead with insight, not announcement** — What's the non-obvious thing you learned?
2. **Be specific** — Names, numbers, examples. Vague = forgettable.
3. **Admit uncertainty** — "We don't know" is more credible than false confidence
4. **Make predictions** — Take positions that could be wrong
5. **Show the work** — Code, tests, architecture. Not just claims.

---

## Metrics to Track

| Metric | Why It Matters |
|--------|---------------|
| Replies with pushback | Sign of genuine engagement, not just likes |
| "I hadn't thought about it that way" | Insight landed |
| DMs asking specific questions | Qualified interest |
| Forks, not just stars | Intent to use |
| Posts referenced by others | Ideas spreading |
