# Open LOS: Launch Video Script

> **Format:** Video blog post / founder narrative
> **Duration:** ~8-10 minutes
> **Tone:** Thoughtful, visionary, technically grounded

---

## COLD OPEN (30 seconds)

*[Screen: Code scrolling, then cuts to you]*

**[You]:**
We just open-sourced a B2B lending system. The whole thing. 161 conformance tests. Full API. Deal lifecycle, financial spreading, covenant monitoring, audit trails—everything a bank needs to manage loans.

But here's what's interesting: we built it in weeks, not years. And we built it *for* AI agents, not despite them.

This isn't a demo. It's a declaration.

The SaaS era is ending. Something different is beginning.

---

## PART 1: WHY WE'RE BUILDING THIS (2 minutes)

*[Screen: Architecture diagram, then back to you]*

**[You]:**
Let me tell you what I kept seeing in enterprise software—especially financial services.

Companies pay millions for systems they can't modify. They wait months for features they could describe in a sentence. They feed their most sensitive data into black boxes they don't control. And now they're being told: "Trust AI"—but they can't see how any of it works.

That's backwards.

The promise of AI isn't "trust us, we'll automate everything." The promise is: **you** get to control what happens. You get the intelligence. You own the reasoning. You see every decision.

*[Screen: Code showing actor identification headers]*

```
X-Actor: claude-code
X-Actor-Type: ai
X-Actor-Session: session_abc123
```

**[You]:**
Open LOS is a lending system where humans and AI are *equal actors*. Same API. Same permissions. Same validation. The only difference is the audit tag.

An AI agent can create a deal, upload documents, run covenant tests, draft a credit memo. A human can do the same thing. The system doesn't care—it just logs who did what, when, and why.

*[Screen: Audit event schema]*

**[You]:**
Every single mutation is recorded. Not because regulations require it—though they do—but because **auditability is the foundation of trust**. When AI helps you make a decision, you should be able to trace exactly what it saw and what it did.

---

## PART 2: WHO THIS IS FOR (1.5 minutes)

*[Screen: Screenshots of different users]*

**[You]:**
So who is this actually for?

**First: Lenders who want control.** Private credit funds, alternative lenders, banks running specialized portfolios. If you're managing a hundred million in loans and you're stuck between a legacy system you can't modify and a SaaS vendor who won't give you your data—this is your exit.

**Second: AI-native teams.** If you're building with Claude, ChatGPT, or your own models, you need a backend that speaks their language. Not "we have an AI feature"—actually designed for agents. MCP tools, structured context, deterministic computations that AI can explain but doesn't control.

**Third: Developers and builders.** Open source means you can fork it, extend it, deploy it on-prem, wire it into your existing stack. Every schema is typed. Every endpoint is documented. 161 test cases show you exactly what the system does.

*[Screen: Test output running]*

**[You]:**
This isn't a toy. It's production-ready infrastructure you can actually bet on.

---

## PART 3: THE END OF SAAS (2 minutes)

*[Screen: Timeline of software eras]*

**[You]:**
Let me make a claim that might sound dramatic: **SaaS as we know it is ending.**

Not tomorrow. Not completely. But the model is fracturing.

*[Screen: SaaS characteristics list]*

For twenty years, SaaS meant: we host it, we update it, you pay monthly, and in exchange, you get a login. You didn't run the code. You didn't own the infrastructure. You trusted the vendor.

That made sense when software was hard to run. When you needed a data center and a team of DBAs. When deploying an update was a six-month project.

But that's not the world anymore.

*[Screen: Modern deployment tools]*

**[You]:**
Today, infrastructure is programmable. Vercel, Railway, Fly, Supabase—you can deploy a full stack in minutes. AI can write, test, and ship code faster than most teams can review it. The hard part isn't running software anymore. The hard part is **knowing what to build**.

And here's the thing about SaaS: when you pay for a hosted service, you're paying for *their* idea of what you need. Their roadmap. Their priorities. Their trade-offs.

*[Screen: Enterprise software feature bloat meme]*

**[You]:**
Enterprise SaaS has become bloated, slow, and generic. It optimizes for the average customer, which means it's perfect for no one. And the AI features? Usually bolted on. A chatbot here, a summary there. Not designed from the ground up.

The alternative isn't going back to on-prem nightmares. It's **open source systems that you can deploy anywhere, modify freely, and connect to AI environments you control.**

That's what Open LOS represents.

---

## PART 4: NEW ENTERPRISE TECHNOLOGY (2 minutes)

*[Screen: Architecture diagram - "AI Execution Environments"]*

**[You]:**
So what does new enterprise technology actually look like?

Here's our architecture diagram. Notice something?

*[Highlight the "AI Execution Environments" box]*

**[You]:**
The AI isn't inside the system. It's outside. Claude Code, ChatGPT, Cursor, custom agents—they all connect via standard protocols. MCP, REST, webhooks.

*[Screen: Core architecture principles]*

**[You]:**
The backend is what I call a **domain-aware database**. It knows the rules of lending. It knows what a valid stage transition is. It computes financial ratios deterministically. It enforces permissions and logs everything.

But it doesn't *think*. Thinking happens in AI environments that **you** control.

```typescript
// Financial ratios are computed server-side, deterministically
const leverage = totalDebt / ebitda;
const dscr = netOperatingIncome / debtService;
// AI explains these; it doesn't compute them
```

*[Screen: API response with _context hints]*

**[You]:**
The API is designed for AI consumption. Every response includes context: what actions are available, what's blocking progress, what's missing. So an AI agent can reason about the system without endless back-and-forth.

```json
{
  "data": { "stage": "underwriting" },
  "_context": {
    "available_actions": [
      { "tool": "deal.transition_stage", "to": "closing" }
    ],
    "warnings": [
      { "code": "MISSING_GUARANTOR", "message": "No personal guarantor" }
    ]
  }
}
```

**[You]:**
This is what AI-native enterprise software looks like. Not "we added AI." Built for a world where AI agents are first-class participants.

---

## PART 5: FROM PROOF OF CONCEPT TO PRODUCTION (1.5 minutes)

*[Screen: Commit history / development velocity]*

**[You]:**
Some people see a project like this and think: "Nice proof of concept. Call me when it's enterprise-ready."

Here's my response: **the line between proof of concept and production has collapsed.**

*[Screen: Conformance test output]*

**[You]:**
Open LOS has 161 conformance tests. Full deal lifecycle. Document management. Financial spreading with computed ratios. Covenant testing with grace periods and waivers. Bank transaction monitoring. Email ingestion. Approval workflows.

We built this in weeks, not years. Not because we cut corners—because the tools have changed.

*[Screen: Modern development stack]*

**[You]:**
TypeScript catches errors at compile time. Drizzle gives us type-safe database queries. Vitest runs hundreds of tests in seconds. AI assistants help write, debug, and refactor code continuously.

But more importantly: **we designed for AI from day one.** Every service is testable. Every computation is deterministic. Every response validates against a schema. That discipline makes development faster, not slower.

*[Screen: "The Best AI Code is Simple and Close to the Model"]*

**[You]:**
There's a saying in AI development: the best code is simple and close to the model. Complexity becomes technical debt faster than ever. Scaffolding becomes obsolete in months.

Open LOS is ~10,000 lines of TypeScript. That's it. And it does what systems with millions of lines of code do—because it does less magic and more solid engineering.

Small proof of concepts can become viable enterprise technology in months, not years. The question isn't "is it big enough?" It's "is it correct?"

---

## PART 6: THE FUTURE IS OPEN (1.5 minutes)

*[Screen: Open source ecosystem logos]*

**[You]:**
Let me make a prediction about enterprise software.

The winners of the next decade will be **open source systems of record**.

*[Screen: "Systems of Record" definition]*

**[You]:**
A system of record is where the truth lives. For lending, it's deals, borrowers, financial statements, covenants, audit trails. This data is too important to be trapped in a vendor's database.

When your system of record is open source:

*[List appears one by one]*

- **You can deploy it anywhere.** On-prem for compliance. Cloud for convenience. Hybrid for flexibility.

- **You own your data schema.** No begging for exports. No vendor lock-in. No "we deprecated that field."

- **AI can actually help.** Because it can see the code, understand the model, and operate against well-documented APIs.

- **You can extend it.** Fork it, add features, share improvements. Your edge cases don't wait for a product roadmap.

*[Screen: GitHub repo]*

**[You]:**
This is why we open-sourced everything. The spec, the schemas, the tests, the implementation. Clone it. Run it. Break it. Make it better.

*[Screen: Community contribution montage]*

**[You]:**
The future of enterprise software isn't one vendor with all the answers. It's open systems that a thousand teams can adapt, a thousand AI agents can operate, and a thousand businesses can trust—because they can verify.

---

## CLOSING (30 seconds)

*[Screen: Back to you]*

**[You]:**
So here's Open LOS. A complete lending operating system. Headless API. AI-native design. Open source.

If you're running a lending operation and you're tired of your software limiting what's possible—try it.

If you're building AI agents and you need a real backend to test against—try it.

If you're a developer who believes the future is open systems that humans and AI operate together—join us.

The SaaS era gave us convenience. The next era gives us control.

*[Screen: URL and GitHub link]*

**[You]:**
Link in the description. Star the repo. Let's build.

---

## END CARD

```
Open LOS
github.com/seadotdev/open-los

Open source B2B lending infrastructure
Designed for humans and AI agents

#OpenSource #AI #Fintech #Enterprise
```

---

## NOTES FOR PRODUCTION

**B-roll suggestions:**
- Code scrolling / IDE shots
- Terminal with tests running
- Architecture diagrams
- API documentation
- GitHub activity

**Graphics to prepare:**
- Timeline: Mainframe → Client-Server → SaaS → Open + AI-Native
- Architecture diagram from AI_NATIVE_ARCHITECTURE.md
- Actor identification headers
- API response with _context
- Test count badge

**Quotes to potentially include on screen:**
- "The backend is like a domain-aware database. It knows what a valid stage transition is, computes ratios deterministically, enforces permissions, and logs everything. But it doesn't think."
- "Humans and AI are equal actors"
- "The best AI code is simple and close to the model"

**Tone guidance:**
- Confident but not arrogant
- Technical depth without jargon overload
- Vision-forward but grounded in what's actually built
- Invitation, not pitch

---

## KEY MESSAGES SUMMARY

1. **Why we're building:** Enterprise software is locked down, slow, and not designed for AI. We built an alternative.

2. **Who it's for:** Lenders who want control, AI-native teams, developers and builders.

3. **End of SaaS:** The hosting advantage is gone. Open source + modern infra + AI development velocity changes everything.

4. **New enterprise tech:** AI-native means AI is external, the backend is deterministic, and everything is auditable.

5. **POC to production:** Discipline + modern tools + AI assistance = enterprise-grade systems built in weeks.

6. **Future is open:** Open source systems of record give you deployment flexibility, data ownership, AI compatibility, and extensibility.
