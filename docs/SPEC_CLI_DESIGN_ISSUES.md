# CLI Design Issues — CRM Model Test Findings

**Date:** 2026-02-21
**Source:** CRM test harness (`packages/simulation/src/crm-test/`) run against 4 models in text mode and 3 models in tool-calling mode, 25 tasks each.
**Models tested:** GLM 4.5 Air, Solar Pro 3, Trinity Mini, Nemotron Nano 9B

This document catalogs design issues in the `los` CLI that were surfaced by running the CRM model test suite against multiple LLMs. Each issue is grounded in specific test failures with score data. The intent is to document **what went wrong and why**, not to prescribe solutions.



## Implemented fixes (2026-02-21)

The following low-risk fixes have now been applied in the CLI implementation:

1. **Explicit deal/entity linking command** — Added `los deal link-entity <dealId> <entityId>` as a semantic alias for linking a primary entity, instead of requiring users to discover `deal update --primary-entity`.
2. **Stage override rationale enforcement** — `los deal advance` now errors if `--override` is passed without `--override-rationale`, aligning CLI behavior with workflow expectations.
3. **Loan parent ID consistency** — `los loan create` now uses positional parent syntax: `los loan create <dealId> --amount ...` (matching other `create` commands), while still sending the same API payload.
4. **`--holder` ambiguity reduction** — Added `--entity <id>` as an explicit alias for loan account holder ID.
5. **Global short-flag collisions removed** — Global options now use long-form flags (`--actor`, `--tenant-id`, `--api-url`, `--format`) to avoid overlap with command-level short flags like `-a`.
6. **Layered command registration refactor** — CLI command registration is now grouped into layered arrays (foundational, underwriting, servicing, integration) to support future modular composition.

These changes intentionally target the most consistent model/operator failure points while avoiding high-risk API changes.

---


## 1. Missing `deal delete` causes universal hallucination

**Task:** `no-hallucinate-nonexistent` — "Delete deal 'deal_del1' from the system."

| Model | Mode | Score | Output |
|-------|------|-------|--------|
| Nemotron Nano 9B | text | 0 | `los deal delete deal_del1` |
| Trinity Mini | text | 0 | `los deal delete deal_del1` |
| Solar Pro 3 | text | 0 | `los deal delete deal_del1` |
| GLM 4.5 Air | text | 100 | (correctly refused) |
| Trinity Mini | tool | 100 | (correctly refused) |
| Solar Pro 3 | tool | 0 | Hallucinated command in reasoning chain |
| GLM 4.5 Air | tool | 100 | (correctly refused) |

**What happened:** 5 out of 7 model-runs invented `los deal delete`. This is the most consistent failure across the entire test suite. Every failing model produced the exact same non-existent command independently.

**Why this is a problem:** The CLI exposes a standard CRUD pattern across its resources. `entity` has `create/list/get/update/delete`. `facility` has `create/list/get/update/delete`. But `deal` only has `create/list/get/update/advance/history` — no `delete`. The CRUD pattern is so strongly established within the CLI itself that models (and likely human users) assume `delete` must exist as a peer operation on every resource.

**Evidence from code:** Compare `packages/cli/src/commands/entities.ts:132-146` which registers `entity delete`, and `packages/cli/src/commands/facilities.ts:129-143` which registers `facility delete`, with `packages/cli/src/commands/deals.ts` which has no `delete` subcommand at all. The asymmetry is silent — nothing in the CLI reference or help output explains why deals are not deletable.

**Additional context:** Solar Pro 3 in tool-calling mode generated ~750 words of internal reasoning debating whether the command exists — and the reasoning text itself contained `los deal delete`, which the validator caught as a hallucination. The model was actively trying not to hallucinate, but the CRUD pattern was too strong.

---

## 2. Entity-to-deal linking is hidden inside `deal update`

**Task:** `deal-link-entity` — "Link entity 'ent_abc' to deal 'deal_123' as the primary entity."

| Model | Mode | Score | Command chosen |
|-------|------|-------|----------------|
| Nemotron Nano 9B | text | 30 | `los relationship create --from ent_abc --to deal_123 --type owns` |
| Trinity Mini | text | 100 | `los deal update deal_123 --primary-entity ent_abc` |
| Solar Pro 3 | text | 100 | `los deal update deal_123 --primary-entity ent_abc` |
| GLM 4.5 Air | text | 100 | `los deal update deal_123 --primary-entity ent_abc` |

**What happened:** Nemotron chose `los relationship create` instead of `los deal update --primary-entity`. Both are plausible interpretations of "link entity to deal."

**Why this is a problem:** The verb "link" naturally maps to the `relationship` domain. The CLI has `los relationship create` for linking entities to entities. But linking an entity to a deal requires a flag (`--primary-entity`) buried inside the general-purpose `deal update` command. There is no semantic signal in the CLI surface area that `deal update` is the mechanism for entity-deal association.

**Evidence from code:** `packages/cli/src/commands/deals.ts:108` defines `--primary-entity <id>` as one of 8 options on `deal update`. It sits alongside unrelated fields like `--borrower`, `--jurisdiction`, `--amount`, `--purpose`, `--assigned-to`, `--outcome`, and `--custom`. There is no way to discover that "linking an entity to a deal" means "updating a deal field" without reading the full flag list.

**Contrast with `relationship create`:** `packages/cli/src/commands/relationships.ts:19-23` defines `relationship create` with `--from`, `--to`, and `--type` — which reads semantically as the right tool for "linking" operations. The fact that it only works entity-to-entity (not entity-to-deal) is not obvious from the command description "Create a relationship between entities."

---

## 3. `-t` flag is overloaded across commands

The short flag `-t` means different things depending on which command it appears in:

| Command | `-t` means | Long form | Defined at |
|---------|-----------|-----------|------------|
| `los entity create` | Entity type (company/person) | `--type` | `entities.ts:20` |
| `los entity list` | Filter by type | `--type` | `entities.ts:56` |
| `los deal advance` | Target stage | `--to` | `deals.ts:141` |
| `los relationship create` | Target entity | `--to` | `relationships.ts:21` |
| `los covenant create` | Threshold value | `--threshold` | `covenants.ts:24` |
| Global option | Tenant ID | `--tenant-id` | `index.ts:44` |

**What happened:** In the test suite, models generally handled this correctly when given a clear system prompt. However, Trinity Mini in tool-calling mode produced JSON with `"to": "underwriting"` for `deal advance` but the reconstructed CLI had no `-t` flag at all, suggesting ambiguity in mapping the semantic concept back to flag syntax.

**Why this is a problem:** While Commander.js scopes flags to individual commands (so there is no runtime conflict), the CLI reference presented to LLM agents in `scenarios.ts:18-162` lists all commands together. An agent reading the full reference encounters `-t` meaning 6 different things. This is a cognitive burden that scales with the number of commands the agent must consider simultaneously.

**Evidence from code:** The global `-t` for `--tenant-id` (`index.ts:44`) shadows the per-command `-t` flags. Commander.js resolves this correctly at parse time, but a model that encounters `-t default` and `-t company` and `-t origination` in the same context has to disambiguate purely by positional context.

---

## 4. Inconsistent short-flag availability across `create` commands

**Task:** `loan-create` — Create a loan account.

| Model | Mode | Score | Issue |
|-------|------|-------|-------|
| Trinity Mini | text | 88 | `--dealdeal_ln1` (merged flag and value) |
| Trinity Mini | tool | 20 | All flags lost in reconstruction |
| Nemotron Nano 9B | text | 0 | Timeout |

**What happened:** `los deal create` uses short flags (`-b`, `-a`, `-p`, `-j`). `los loan create` uses a mix — `-d`/`-a`/`-f` for some, long-only `--rate`/`--term`/`--holder` for others. `los facility create` uses `-t`/`-a`/`-c` for some, long-only `--rate-type`/`--rate`/`--term` for others. `los covenant create` uses `-n`/`-m`/`-o`/`-t`/`-f`/`-g` for some, long-only `--type` for others.

The pattern is inconsistent:

| Command | Flags with short forms | Flags without short forms |
|---------|----------------------|--------------------------|
| `deal create` | `-b`, `-j`, `-a`, `-p` | `--custom` |
| `entity create` | `-t`, `-n`, `-j` | `--legal-name`, `--reg-number`, `--lei` |
| `loan create` | `-d`, `-a`, `-f` | `--rate`, `--term`, `--holder` |
| `facility create` | `-t`, `-a`, `-c` | `--rate-type`, `--rate`, `--spread`, `--term` |
| `covenant create` | `-n`, `-m`, `-o`, `-t`, `-f`, `-g` | `--type` (note: `--type` has no short form but `-t` is used for `--threshold`) |
| `relationship create` | `-f`, `-t`, `-p` | `--type`, `--metadata` |

**Why this is a problem:** Models trained on the short-flag patterns of `deal create` expect similar conventions on structurally similar commands. When they encounter `loan create` with no short flag for `--rate` or `--term`, they either (a) omit the flags, (b) invent short flags, or (c) merge the long flag name with its value due to unfamiliar spacing.

**Evidence from code:** Compare `deals.ts:21-25` (4 of 5 options have short flags) with `loans.ts:21-26` (3 of 6 options have short flags) and `facilities.ts:21-27` (3 of 7 options have short flags). The ratio of short-to-long flags drops as command complexity increases, which is the opposite of what you'd want — complex commands benefit most from short flags.

---

## 5. `relationship create` uses `--ownership-pct` abbreviation

**Task:** `relationship-create-ownership` — Create an ownership relationship with 75% stake.

| Model | Mode | Score | Issue |
|-------|------|-------|-------|
| Trinity Mini | tool | 20 | Truncated output; `--ownership-pct` never reached |
| All others | text | 100 | Correct |

**What happened:** The flag `--ownership-pct` uses a non-standard abbreviation. The short form `-p`/`--pct` is even more cryptic. In tool-calling mode, Trinity Mini's JSON arguments were truncated before reaching the ownership percentage, suggesting the model deprioritized this unusual flag.

**Why this is a problem:** "pct" is not a universally recognized abbreviation. The CLI reference in `scenarios.ts:85` documents it as `--ownership-pct <pct>` which reads as "ownership pct pct" — the placeholder name (`<pct>`) and the flag name both use the same abbreviation, making it unclear whether the value should be a decimal (0.75), a whole number (75), or a string ("75%").

**Evidence from code:** `packages/cli/src/commands/relationships.ts:23` defines `.option('-p, --pct <percent>', 'Ownership percentage (for owns type)')`. The flag name is `--pct` but the help text says "percentage" and the value placeholder says `<percent>`. Meanwhile the CLI reference in `scenarios.ts:85` calls it `--ownership-pct` (which is the name used in the test validators). There appears to be a mismatch between the actual flag name (`--pct`) and what the test reference documents (`--ownership-pct`).

---

## 6. High flag count on creation commands overwhelms weaker models

**Task:** `facility-create` — Create a term loan facility with 7 parameters.

| Model | Mode | Score | Issue |
|-------|------|-------|-------|
| Trinity Mini | tool | 26.5 | Used `key=value` syntax instead of `--key value` |
| Trinity Mini | text | ~85 | Partial flag omission |
| All others | text | 100 | Correct |

**What happened:** `los facility create` requires the user to specify up to 7 flags: `--type`, `--amount`, `--currency`, `--rate-type`, `--rate`, `--spread`, `--term`. Trinity Mini in tool-calling mode emitted all the correct key-value pairs but in JSON-like syntax rather than CLI flag syntax:

```
los_facility_create deal_id="deal_fac1" type="term_loan" amount="10m" rate_type="fixed" rate="5.5" term="60"
```

**Why this is a problem:** Commands with 6-8 flags create a combinatorial challenge for models. The model must remember the correct flag prefix (`--`), separator (space, not `=`), quoting rules, and positional argument (`<dealId>`) simultaneously. Each additional flag multiplies the surface area for errors.

Similarly, `los covenant create` requires `--name`, `--type`, `--metric`, `--operator`, `--threshold`, `--frequency`, and `--grace-period` (7 flags). The `loan-approve-disburse` task requires two sequential `transact` commands, each with `--type` and `--amount`.

**Evidence from code:** `packages/cli/src/commands/facilities.ts:19-27` defines 7 options. `packages/cli/src/commands/covenants.ts:20-26` defines 7 options. These are the two most flag-heavy `create` commands, and they coincide with the lowest scores in tool-calling mode.

---

## 7. `--holder` on `loan create` is semantically ambiguous

**Task:** `loan-create` — Create a loan with an account holder.

**What happened:** The flag `--holder <id>` on `los loan create` refers to the entity that holds the loan account. Models occasionally confused this with the lender, the borrower, or the deal holder.

**Why this is a problem:** In lending terminology, "holder" is context-dependent:
- A "note holder" is the lender
- An "account holder" is the borrower/obligor
- A "bond holder" is an investor

The flag `--holder <entityId>` doesn't specify which interpretation applies. The internal field name `account_holder_id` (in `loans.ts:40`) is more specific but not surfaced to the CLI user.

**Evidence from code:** `packages/cli/src/commands/loans.ts:26` defines `.option('--holder <id>', 'Account holder entity ID')`. The description says "Account holder" but the flag is just `--holder`. The CLI reference in `scenarios.ts:121` also just says `--holder <entityId>`.

---

## 8. `deal advance` rationale flag is ambiguously required

**Task:** `stage-advance` — Advance a deal with rationale.

| Model | Mode | Score | Issue |
|-------|------|-------|-------|
| Trinity Mini | tool | 80 | Omitted `-r` rationale |
| All others | text | 100 | Included rationale |

**What happened:** The `-r`/`--rationale` flag on `deal advance` is defined as an `option()` (optional) in the code, but the test validator awards 20% weight for its presence, effectively treating it as expected.

**Why this is a problem:** The flag is optional at the CLI parser level but expected at the business-logic level. Models see it listed as an option and, when under token pressure (tool-calling mode with JSON overhead), drop it as non-essential. If rationale is required by business rules, this creates a gap between what the CLI enforces and what the workflow needs.

**Evidence from code:** `packages/cli/src/commands/deals.ts:142` defines `.option('-r, --rationale <text>', 'Rationale for transition')` — note `option()` not `requiredOption()`. Compare with line 141 where `--to` is a `requiredOption()`. The test in `scenarios.ts:578-580` gives `--rationale` a weight of 0.2, making it count toward the score even though the CLI doesn't enforce it.

**Contrast with `--override-rationale`:** The `stage-advance-override` task expects both `--override` (a boolean flag) and `--override-rationale <text>`. Here, the override rationale is semantically required (you shouldn't override without explaining why), but again it's only an `option()` at the CLI level.

---

## 9. Tool-calling mode reconstructs underscore-joined names

**Task:** `workflow-full-origination` (multi-step workflow)

**What happened:** Trinity Mini in tool-calling mode emitted function names that leaked into text output:

```
los_entity_create -t company -n "Desert Solar LLC" ...
los_deal_create -b "Desert Solar LLC" ...
los_deal_advance -t origination
los_facility_create -d <deal_id> ...
```

The model used underscore-joined command names (`los_entity_create`) instead of space-separated (`los entity create`).

**Why this is a problem:** The tool schema in the test harness uses function names like `los_deal_create`, `los_entity_create`, etc. When a model calls these tools and then also produces text output summarizing what it did, it sometimes uses the function name verbatim instead of converting underscores back to spaces. This is partly a test-harness issue, but it reveals a naming convention tension: the tool schema naming (`los_<resource>_<action>`) and the CLI invocation (`los <resource> <action>`) require a transformation step that models don't consistently apply.

**Evidence from the data:** Trinity Mini in tool-calling mode for `workflow-full-origination` scored lower than in text mode because the validator's `contains_command` checks look for `los entity create` (with spaces), not `los_entity_create` (with underscores).

---

## 10. Flag-value merge errors from missing space

**Task:** Multiple tasks — primarily `loan-create` and `deal-create-basic`

**What happened:** Trinity Mini in text mode repeatedly merged flag names with their values:

- `--dealdeal_ln1` (should be `--deal deal_ln1`)
- `los dealcreate` (missing space in subcommand)
- `losdeal advance` (missing space after `los`)

**Why this is a problem:** The space-separated flag syntax `--deal deal_ln1` is a single-character error away from `--dealdeal_ln1`. This is a known tokenization issue with smaller models where the flag and value tokens merge during generation. The CLI parser (Commander.js) treats `--dealdeal_ln1` as an unknown flag and rejects the command entirely.

**Relevance to CLI design:** The CLI currently accepts only space-separated flag syntax (`--deal deal_ln1`). It does not accept equals-separated syntax (`--deal=deal_ln1`). Commander.js supports both natively, but the test validators only check for space-separated form. The equals syntax would eliminate this entire class of merge error because `=` is a stronger separator than whitespace in model tokenization.

---

## 11. Global `-a` flag collides with per-command `-a` flags

**Source:** `packages/cli/src/index.ts:43` and multiple command files

The global option `-a`/`--actor` is registered on the root program:

```
.option('-a, --actor <id>', 'Actor ID for audit trail', ...)
```

Several subcommands also use `-a`:
- `deal create`: `-a, --amount` (`deals.ts:23`)
- `deal update`: `-a, --amount` (`deals.ts:104`)
- `loan create`: `-a, --amount` (`loans.ts:22`)
- `loan from-facility`: `-a, --amount` (`loans.ts:57`)
- `facility create`: `-a, --amount` (`facilities.ts:22`)
- `facility update`: `-a, --amount` (`facilities.ts:96`)

**What happened:** The `defaults-minimal-deal` test (task ID `defaults-minimal-deal`) penalizes models for specifying `--actor` when it's not needed. But models that have seen `-a` used as `--amount` in one context sometimes produce `-a` in ambiguous contexts, and it's unclear whether they mean `--actor` (global) or `--amount` (per-command).

**Why this is a problem:** Commander.js resolves the ambiguity based on command scope (per-command `-a` takes precedence within that command). But a model reading the CLI reference sees `-a` in the global options section *and* in multiple command sections. The test validator for `defaults-minimal-deal` penalizes any appearance of `--actor` or `-a` as a global flag, but there's no way to distinguish intent from the model's output.

---

## 12. Positional vs. flag inconsistency for parent resource IDs

Some commands take the parent resource ID as a positional argument, others require a flag:

| Command | Parent ID | Mechanism | Defined at |
|---------|-----------|-----------|------------|
| `deal get <id>` | Deal ID | Positional | `deals.ts:84` |
| `deal update <id>` | Deal ID | Positional | `deals.ts:100` |
| `deal advance <id>` | Deal ID | Positional | `deals.ts:139` |
| `facility create <dealId>` | Deal ID | Positional | `facilities.ts:19` |
| `covenant create <dealId>` | Deal ID | Positional | `covenants.ts:18` |
| `loan create` | Deal ID | Flag (`--deal`) | `loans.ts:21` |
| `loan transact <loanId>` | Loan ID | Positional | `loans.ts:169` |
| `loan list <dealId>` | Deal ID | Positional | `loans.ts:95` |

**What happened:** `los loan create` is the only `create` command that takes its parent resource ID as a flag (`--deal <id>`) rather than a positional argument. Every other command that references a parent uses positional syntax (`<dealId>`).

**Why this is a problem:** Models learn the positional pattern from `facility create <dealId>`, `covenant create <dealId>`, etc. When they encounter `loan create`, they apply the same pattern and produce `los loan create deal_ln1 --amount 500k ...` instead of `los loan create --deal deal_ln1 --amount 500k ...`. In tool-calling mode, this is especially damaging because the positional argument gets lost when the model reconstructs the CLI from JSON.

**Evidence from code:** `packages/cli/src/commands/loans.ts:19-21` defines `loan create` with `.requiredOption('-d, --deal <id>', 'Deal ID')`, while `packages/cli/src/commands/facilities.ts:19` defines `facility create <dealId>` with the deal ID as a positional argument in the command definition itself.

---

## 13. Multi-word values without quotes are silently truncated

**Task:** `entity-create-person` — Create a person entity for "Jane Smith"

| Model | Score | Output |
|-------|-------|--------|
| Nemotron Nano 9B | ~75 | `los entity create -t person -n Jane Smith` |

**What happened:** Nemotron omitted quotes around "Jane Smith". Commander.js parsed `-n Jane` and treated `Smith` as an unrecognized positional argument. The validator caught that the `-n` flag value didn't contain the full name.

**Why this is a problem:** Many models emit unquoted multi-word values because the training data contains both quoted and unquoted shell patterns. The CLI parser (Commander.js) follows POSIX convention — unquoted words are separate arguments. But the test prompt says `"Jane Smith"` (with quotes in the natural language), and the model strips them during generation.

This issue is not unique to `entity create`. Any flag that accepts multi-word values (`--borrower "Acme Manufacturing"`, `--rationale "All documents received"`, `--name "London Bridge Capital"`) is susceptible. The test tasks that use single-word values (IDs like `deal_123`, types like `company`) avoid this problem entirely.

---

## Appendix A: Score summary across all issues

| Issue | Worst model score | Task ID | Mode |
|-------|-------------------|---------|------|
| 1. Missing `deal delete` | 0 | `no-hallucinate-nonexistent` | text |
| 2. Entity linking hidden | 30 | `deal-link-entity` | text |
| 3. `-t` overloaded | (indirect) | `stage-advance-override` | tool |
| 4. Inconsistent short flags | 20 | `loan-create` | tool |
| 5. `--ownership-pct` abbreviation | 20 | `relationship-create-ownership` | tool |
| 6. High flag count | 26.5 | `facility-create` | tool |
| 7. `--holder` ambiguous | (contributes to #4) | `loan-create` | tool |
| 8. Rationale ambiguously required | 80 | `stage-advance` | tool |
| 9. Underscore-joined names | ~55 | `workflow-full-origination` | tool |
| 10. Flag-value merge | 88 | `loan-create` | text |
| 11. Global `-a` collision | (indirect) | `defaults-minimal-deal` | text |
| 12. Positional vs flag for parent ID | 20 | `loan-create` | tool |
| 13. Unquoted multi-word values | ~75 | `entity-create-person` | text |

## Appendix B: Model overall scores

| Model | Text mode | Tool-calling mode |
|-------|-----------|-------------------|
| GLM 4.5 Air | 100 | 100 |
| Solar Pro 3 | 96 | 95.44 |
| Trinity Mini | 90.3 | 66.8 |
| Nemotron Nano 9B | 88.22 | (not tested) |

Trinity Mini's 23.5-point drop from text mode (90.3) to tool-calling mode (66.8) is the most significant degradation. Every issue documented above contributes more severely in tool-calling mode, where the model must reconstruct CLI syntax from JSON arguments.

## Appendix C: Test harness validator notes

Two validator behaviors are worth flagging as potential confounds:

1. **`no_hallucination` checks full response text** — The validator at `validators.ts:241-286` searches the entire normalized response for invalid patterns. Solar Pro 3's reasoning chain mentioned `los deal delete` while explaining why it *shouldn't* use it. The validator scored this as a hallucination. For chain-of-thought models, this creates false negatives.

2. **`flag_value` regex requires whitespace or `=` separator** — The validator at `validators.ts:196-198` uses `[=\\s]+` to match the separator between flag and value. This means `--deal=deal_ln1` would pass, but the CLI reference only shows space-separated examples. Models that produce `=`-separated syntax would pass the validator but may not match what the CLI actually accepts (Commander.js does accept both, but this isn't documented).
