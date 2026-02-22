/**
 * CRM Test Scenarios
 *
 * Each scenario presents a natural language task and validates the LLM's
 * ability to produce correct CLI commands for the Open LOS system.
 *
 * Scenarios are ordered by complexity and cover:
 * 1. Basic CRUD (deals, entities)
 * 2. Understanding defaults (what can be omitted)
 * 3. Multi-step workflows (create deal -> add entity -> link -> advance)
 * 4. Error recovery (what to do when a command fails)
 * 5. Complex queries and updates
 */

import type { TestTask, TaskCategory } from "./types.js";

/** CLI reference that gets included in system prompts */
export const CLI_REFERENCE = `You are a helpful assistant that generates CLI commands for the Open LOS system (a B2B lending CRM/loan origination platform).

The CLI tool is called "los" and uses this structure:
  los <command> [subcommand] [options]

Global options (all commands):
  -u, --api-url <url>     API base URL (default: http://localhost:3000)
  -a, --actor <id>        Actor ID for audit trail (default: cli)
  -t, --tenant-id <id>    Tenant ID (default: default)
  -f, --format <format>   Output format: json, table, compact (default: json)

Available commands:

  los health                           Check API health

  los deal create -b <name> [options]  Create a new deal
    -b, --borrower <name>              Borrower name (required)
    -j, --jurisdiction <code>          Jurisdiction (e.g., UK, US)
    -a, --amount <amount>              Requested amount (supports k/m/b suffixes)
    -p, --purpose <purpose>            Loan purpose
    --custom <json>                    Custom fields as JSON

  los deal list [options]              List deals
    -s, --stage <stage>                Filter by stage
    -l, --limit <n>                    Limit results (default: 20)
    -c, --cursor <cursor>              Pagination cursor

  los deal get <id>                    Get deal details

  los deal update <id> [options]       Update deal fields
    -b, --borrower <name>              Borrower name
    -j, --jurisdiction <code>          Jurisdiction
    -a, --amount <amount>              Requested amount
    -p, --purpose <purpose>            Loan purpose
    --assigned-to <user>               Assign to user
    --outcome <outcome>                Origination outcome (reject/need_info/proceed/refer)
    --primary-entity <id>              Primary entity ID
    --custom <json>                    Custom fields as JSON

  los deal advance <id> -t <stage>     Advance deal to next stage
    -t, --to <stage>                   Target stage (origination/underwriting/closing/monitoring) (required)
    -r, --rationale <text>             Rationale for transition
    --override                         Override failed guards
    --override-rationale <text>        Rationale for override

  los deal history <id>                Show stage transition history

  los entity create -t <type> -n <name> [options]   Create entity
    -t, --type <type>                  Entity type: company or person (required)
    -n, --name <name>                  Entity name (required)
    --legal-name <name>                Legal name
    --reg-number <number>              Registration number
    -j, --jurisdiction <code>          Jurisdiction
    --lei <lei>                        Legal Entity Identifier

  los entity list [options]            List entities
    -t, --type <type>                  Filter by type (company/person)
    -l, --limit <n>                    Limit results (default: 20)

  los entity get <id>                  Get entity details
  los entity update <id> [options]     Update entity fields
  los entity delete <id>               Delete entity

  los relationship create [options]    Create relationship between entities
    --from <id>                        From entity ID (required)
    --to <id>                          To entity ID (required)
    --type <type>                      Relationship type: owns, guarantees, directs (required)
    --ownership-pct <pct>              Ownership percentage

  los doc upload <dealId> [options]    Upload document to deal
    --type <docType>                   Document type (required)
    --file <path>                      File path (required)

  los doc list <dealId>                List documents for a deal

  los covenant create <dealId> [options]   Create covenant
    --name <name>                      Covenant name (required)
    --type <type>                      Type: financial, reporting, information (required)
    --metric <metric>                  Metric (e.g., debt_to_ebitda)
    --operator <op>                    Operator: >=, <=, >, <, ==
    --threshold <n>                    Threshold value
    --frequency <freq>                 Frequency: monthly, quarterly, annually
    --grace-period <days>              Grace period in days

  los covenant list <dealId>           List covenants for a deal
  los covenant test <dealId>           Test covenant compliance

  los facility create <dealId> [options]   Create facility
    --type <type>                      Type: term_loan, revolver, letter_of_credit (required)
    --amount <amount>                  Amount (required)
    --currency <currency>              Currency (default: USD)
    --rate-type <type>                 Interest rate type: fixed, floating
    --rate <rate>                      Interest rate value
    --term <months>                    Term in months

  los facility list <dealId>           List facilities for a deal

  los loan create [options]            Create loan account
    --deal <dealId>                    Deal ID (required)
    --facility <facilityId>            Facility ID
    --amount <amount>                  Loan amount (required)
    --rate <rate>                      Interest rate
    --term <months>                    Term in months
    --holder <entityId>                Account holder entity ID

  los loan get <id>                    Get loan details
  los loan balance <id>                Get loan balance
  los loan schedule <id>               Get repayment schedule
  los loan transact <id> [options]     Record loan transaction
    --type <type>                      Transaction type: APPROVAL, DISBURSEMENT, REPAYMENT
    --amount <amount>                  Amount
    --date <date>                      Value date (YYYY-MM-DD)
    --notes <text>                     Notes

  los spread create <dealId> [options] Create financial spread
    --entity <entityId>                Entity ID
    --period <period>                  Period (e.g., FY2025)
    --items <json>                     Line items as JSON array

  los monitoring ingest <dealId> [options]   Ingest monitoring data
    --source <type>                    Source type (e.g., bank_transactions)
    --data <json>                      Transaction data as JSON

  los monitoring status <dealId>       Check monitoring status

  los audit list <dealId>              List audit events
    --type <type>                      Filter by event type
    --actor <actor>                    Filter by actor

  los deposit create [options]         Create deposit account
    --type <type>                      Type: demand_deposit, time_deposit, certificate_of_deposit
    --holder <name>                    Account holder name
    --currency <currency>              Currency (default: USD)

  los deposit list                     List deposit accounts

Notes on defaults:
- The API URL defaults to http://localhost:3000 — you don't need to specify it
- The actor defaults to "cli"
- The tenant defaults to "default"
- The output format defaults to JSON
- Amount supports suffixes: 5k = 5,000 | 2.5m = 2,500,000 | 1b = 1,000,000,000
- New deals start in the "broker" stage by default
- Currency defaults to USD when not specified
`;

/** Build a system prompt for a specific task, optionally including prior context */
function buildSystemPrompt(extraContext?: string): string {
  let prompt = CLI_REFERENCE;
  if (extraContext) {
    prompt += `\n\nAdditional context from previous operations:\n${extraContext}`;
  }
  prompt += `\n\nRespond with ONLY the CLI command(s) needed. If multiple commands are needed, put each on its own line. Do not add explanations unless the task specifically asks for them. Do not wrap commands in code blocks.`;
  return prompt;
}

/** Build a system prompt that enables scratchpad mode for complex scenarios */
function buildScratchpadPrompt(extraContext?: string): string {
  let prompt = CLI_REFERENCE;
  prompt += `

You are working on a complex lending scenario. In addition to CLI commands, you have a scratchpad available:

OUTPUT MODES:
1. CLI commands — use these for anything the LOS CLI supports directly
2. Scratchpad notes — prefix lines with "# NOTE:" for analysis, reasoning, or tracking information
3. Gap identification — prefix lines with "# GAP:" when you identify something the CLI cannot handle
4. Ad-hoc scripts — wrap in [SCRIPT lang="bash|python|jq"]...[/SCRIPT] for glue code that bridges gaps
5. Risk flags — prefix lines with "# RISK:" to flag compliance, credit, or operational concerns

GUIDELINES:
- Use CLI commands wherever the CLI supports the operation
- When the CLI doesn't support something, identify the gap explicitly and provide a workaround
- Think step-by-step: reason through the problem in your scratchpad before issuing commands
- For multi-entity structures, ensure all entities and relationships are created in the correct order
- Flag any risks, missing documentation, or compliance concerns you notice
- Be creative — if you need to combine CLI outputs, pipe data, or write a quick script, do so`;

  if (extraContext) {
    prompt += `\n\nAdditional context from previous operations:\n${extraContext}`;
  }
  return prompt;
}

// ============================================================================
// TASK DEFINITIONS
// ============================================================================

export const ALL_TASKS: TestTask[] = [
  // -------------------------------------------------------------------------
  // DEAL CREATION — Easy
  // -------------------------------------------------------------------------
  {
    id: "deal-create-basic",
    name: "Create a basic deal",
    category: "deal_creation",
    difficulty: "easy",
    prompt: `Create a new deal for a borrower named "Acme Manufacturing" requesting $5 million for equipment financing.`,
    systemContext: buildSystemPrompt(),
    validators: [
      {
        type: "contains_command",
        description: "Uses 'los deal create'",
        weight: 0.3,
        config: { pattern: "los deal create" },
      },
      {
        type: "flag_present",
        description: "Includes borrower flag (-b or --borrower)",
        weight: 0.2,
        config: { flags: ["-b", "--borrower"] },
      },
      {
        type: "flag_value",
        description: "Borrower name contains 'Acme'",
        weight: 0.2,
        config: { flags: ["-b", "--borrower"], pattern: "Acme" },
      },
      {
        type: "flag_present",
        description: "Includes amount flag (-a or --amount)",
        weight: 0.15,
        config: { flags: ["-a", "--amount"] },
      },
      {
        type: "flag_present",
        description: "Includes purpose flag (-p or --purpose)",
        weight: 0.15,
        config: { flags: ["-p", "--purpose"] },
      },
    ],
    tags: ["basic", "crud"],
  },

  {
    id: "deal-create-with-jurisdiction",
    name: "Create a deal with jurisdiction",
    category: "deal_creation",
    difficulty: "easy",
    prompt: `Create a deal for "London Bridge Capital" in the UK jurisdiction, requesting £2.5 million for commercial property refinancing.`,
    systemContext: buildSystemPrompt(),
    validators: [
      {
        type: "contains_command",
        description: "Uses 'los deal create'",
        weight: 0.2,
        config: { pattern: "los deal create" },
      },
      {
        type: "flag_value",
        description: "Borrower contains 'London Bridge'",
        weight: 0.2,
        config: { flags: ["-b", "--borrower"], pattern: "London Bridge" },
      },
      {
        type: "flag_value",
        description: "Jurisdiction is UK or GB",
        weight: 0.2,
        config: { flags: ["-j", "--jurisdiction"], pattern: "UK|GB" },
      },
      {
        type: "flag_present",
        description: "Includes amount flag",
        weight: 0.2,
        config: { flags: ["-a", "--amount"] },
      },
      {
        type: "flag_present",
        description: "Includes purpose flag",
        weight: 0.2,
        config: { flags: ["-p", "--purpose"] },
      },
    ],
    tags: ["basic", "crud", "jurisdiction"],
  },

  // -------------------------------------------------------------------------
  // DEAL QUERIES — Easy
  // -------------------------------------------------------------------------
  {
    id: "deal-list-all",
    name: "List all deals",
    category: "deal_query",
    difficulty: "easy",
    prompt: `Show me all the deals in the system.`,
    systemContext: buildSystemPrompt(),
    validators: [
      {
        type: "contains_command",
        description: "Uses 'los deal list'",
        weight: 0.6,
        config: { pattern: "los deal list" },
      },
      {
        type: "uses_defaults",
        description: "Does NOT specify unnecessary flags (no --limit when default is fine)",
        weight: 0.4,
        config: { unnecessaryFlags: ["--api-url", "--actor", "--tenant-id"] },
      },
    ],
    tags: ["basic", "query"],
  },

  {
    id: "deal-list-filtered",
    name: "List deals filtered by stage",
    category: "deal_query",
    difficulty: "easy",
    prompt: `Show me all deals that are currently in the underwriting stage.`,
    systemContext: buildSystemPrompt(),
    validators: [
      {
        type: "contains_command",
        description: "Uses 'los deal list'",
        weight: 0.4,
        config: { pattern: "los deal list" },
      },
      {
        type: "flag_value",
        description: "Stage filter is 'underwriting'",
        weight: 0.6,
        config: { flags: ["-s", "--stage"], pattern: "underwriting" },
      },
    ],
    tags: ["basic", "query", "filtering"],
  },

  {
    id: "deal-get-by-id",
    name: "Get a specific deal",
    category: "deal_query",
    difficulty: "easy",
    prompt: `Get the details for deal ID "deal_abc123".`,
    systemContext: buildSystemPrompt(),
    validators: [
      {
        type: "contains_command",
        description: "Uses 'los deal get'",
        weight: 0.5,
        config: { pattern: "los deal get" },
      },
      {
        type: "regex_match",
        description: "Includes the deal ID",
        weight: 0.5,
        config: { pattern: "deal_abc123" },
      },
    ],
    tags: ["basic", "query"],
  },

  // -------------------------------------------------------------------------
  // DEFAULTS UNDERSTANDING — Medium
  // -------------------------------------------------------------------------
  {
    id: "defaults-minimal-deal",
    name: "Create deal with minimal flags (understanding defaults)",
    category: "defaults_understanding",
    difficulty: "medium",
    prompt: `Create a deal for "TechStartup Inc". Only the borrower name is required — use sensible defaults for everything else.`,
    systemContext: buildSystemPrompt(),
    validators: [
      {
        type: "contains_command",
        description: "Uses 'los deal create'",
        weight: 0.3,
        config: { pattern: "los deal create" },
      },
      {
        type: "flag_present",
        description: "Has borrower flag",
        weight: 0.3,
        config: { flags: ["-b", "--borrower"] },
      },
      {
        type: "uses_defaults",
        description: "Does NOT redundantly specify defaults like --api-url, --format, --actor, --tenant-id",
        weight: 0.4,
        config: { unnecessaryFlags: ["--api-url", "-u", "--format", "-f", "--actor", "--tenant-id", "-t"] },
      },
    ],
    tags: ["defaults", "understanding"],
  },

  {
    id: "defaults-format-output",
    name: "Request table format output",
    category: "defaults_understanding",
    difficulty: "medium",
    prompt: `List all deals but display the output as a table instead of JSON.`,
    systemContext: buildSystemPrompt(),
    validators: [
      {
        type: "contains_command",
        description: "Uses 'los deal list'",
        weight: 0.4,
        config: { pattern: "los deal list" },
      },
      {
        type: "flag_value",
        description: "Format flag set to 'table'",
        weight: 0.6,
        config: { flags: ["-f", "--format"], pattern: "table" },
      },
    ],
    tags: ["defaults", "format"],
  },

  // -------------------------------------------------------------------------
  // ENTITY MANAGEMENT — Easy/Medium
  // -------------------------------------------------------------------------
  {
    id: "entity-create-company",
    name: "Create a company entity",
    category: "entity_management",
    difficulty: "easy",
    prompt: `Create a new company entity named "GlobalTech Industries" with legal name "GlobalTech Industries, LLC" registered in the US with registration number REG-2024-001.`,
    systemContext: buildSystemPrompt(),
    validators: [
      {
        type: "contains_command",
        description: "Uses 'los entity create'",
        weight: 0.2,
        config: { pattern: "los entity create" },
      },
      {
        type: "flag_value",
        description: "Type is 'company'",
        weight: 0.15,
        config: { flags: ["-t", "--type"], pattern: "company" },
      },
      {
        type: "flag_value",
        description: "Name contains 'GlobalTech'",
        weight: 0.15,
        config: { flags: ["-n", "--name"], pattern: "GlobalTech" },
      },
      {
        type: "flag_present",
        description: "Has legal name",
        weight: 0.15,
        config: { flags: ["--legal-name"] },
      },
      {
        type: "flag_present",
        description: "Has registration number",
        weight: 0.15,
        config: { flags: ["--reg-number"] },
      },
      {
        type: "flag_value",
        description: "Jurisdiction is US",
        weight: 0.2,
        config: { flags: ["-j", "--jurisdiction"], pattern: "US" },
      },
    ],
    tags: ["basic", "crud", "entity"],
  },

  {
    id: "entity-create-person",
    name: "Create a person entity",
    category: "entity_management",
    difficulty: "easy",
    prompt: `Create a person entity for "Jane Smith" who is the guarantor.`,
    systemContext: buildSystemPrompt(),
    validators: [
      {
        type: "contains_command",
        description: "Uses 'los entity create'",
        weight: 0.3,
        config: { pattern: "los entity create" },
      },
      {
        type: "flag_value",
        description: "Type is 'person'",
        weight: 0.35,
        config: { flags: ["-t", "--type"], pattern: "person" },
      },
      {
        type: "flag_value",
        description: "Name contains 'Jane Smith'",
        weight: 0.35,
        config: { flags: ["-n", "--name"], pattern: "Jane Smith" },
      },
    ],
    tags: ["basic", "crud", "entity"],
  },

  // -------------------------------------------------------------------------
  // DEAL UPDATES — Medium
  // -------------------------------------------------------------------------
  {
    id: "deal-update-outcome",
    name: "Set deal origination outcome",
    category: "deal_update",
    difficulty: "medium",
    prompt: `For deal "deal_xyz789", set the origination outcome to "proceed" and assign it to user "jsmith".`,
    systemContext: buildSystemPrompt(),
    validators: [
      {
        type: "contains_command",
        description: "Uses 'los deal update'",
        weight: 0.2,
        config: { pattern: "los deal update" },
      },
      {
        type: "regex_match",
        description: "Includes deal ID",
        weight: 0.2,
        config: { pattern: "deal_xyz789" },
      },
      {
        type: "flag_value",
        description: "Outcome is 'proceed'",
        weight: 0.3,
        config: { flags: ["--outcome"], pattern: "proceed" },
      },
      {
        type: "flag_value",
        description: "Assigned to 'jsmith'",
        weight: 0.3,
        config: { flags: ["--assigned-to"], pattern: "jsmith" },
      },
    ],
    tags: ["update", "workflow"],
  },

  {
    id: "deal-link-entity",
    name: "Link entity to deal as primary",
    category: "deal_update",
    difficulty: "medium",
    prompt: `Link entity "ent_abc" to deal "deal_123" as the primary entity.`,
    systemContext: buildSystemPrompt(),
    validators: [
      {
        type: "contains_command",
        description: "Uses 'los deal update'",
        weight: 0.3,
        config: { pattern: "los deal update" },
      },
      {
        type: "regex_match",
        description: "References deal ID",
        weight: 0.2,
        config: { pattern: "deal_123" },
      },
      {
        type: "flag_value",
        description: "Primary entity set to ent_abc",
        weight: 0.5,
        config: { flags: ["--primary-entity"], pattern: "ent_abc" },
      },
    ],
    tags: ["update", "relationship"],
  },

  // -------------------------------------------------------------------------
  // STAGE TRANSITIONS — Medium
  // -------------------------------------------------------------------------
  {
    id: "stage-advance",
    name: "Advance deal stage",
    category: "stage_transitions",
    difficulty: "medium",
    prompt: `Move deal "deal_456" from broker stage to origination stage because all initial documents have been received.`,
    systemContext: buildSystemPrompt(),
    validators: [
      {
        type: "contains_command",
        description: "Uses 'los deal advance'",
        weight: 0.3,
        config: { pattern: "los deal advance" },
      },
      {
        type: "regex_match",
        description: "References deal ID",
        weight: 0.2,
        config: { pattern: "deal_456" },
      },
      {
        type: "flag_value",
        description: "Target stage is 'origination'",
        weight: 0.3,
        config: { flags: ["-t", "--to"], pattern: "origination" },
      },
      {
        type: "flag_present",
        description: "Includes rationale flag",
        weight: 0.2,
        config: { flags: ["-r", "--rationale"] },
      },
    ],
    tags: ["workflow", "transitions"],
  },

  {
    id: "stage-advance-override",
    name: "Override stage guard",
    category: "stage_transitions",
    difficulty: "hard",
    prompt: `Deal "deal_789" needs to move to underwriting but the guards are failing because a document is missing. Override the guards with the rationale "Emergency fast-track per VP approval — document to follow within 48 hours".`,
    systemContext: buildSystemPrompt(),
    validators: [
      {
        type: "contains_command",
        description: "Uses 'los deal advance'",
        weight: 0.2,
        config: { pattern: "los deal advance" },
      },
      {
        type: "regex_match",
        description: "References deal ID",
        weight: 0.1,
        config: { pattern: "deal_789" },
      },
      {
        type: "flag_value",
        description: "Target stage is 'underwriting'",
        weight: 0.2,
        config: { flags: ["-t", "--to"], pattern: "underwriting" },
      },
      {
        type: "flag_present",
        description: "Uses --override flag",
        weight: 0.25,
        config: { flags: ["--override"] },
      },
      {
        type: "flag_present",
        description: "Has override rationale",
        weight: 0.25,
        config: { flags: ["--override-rationale"] },
      },
    ],
    tags: ["workflow", "override", "hard"],
  },

  // -------------------------------------------------------------------------
  // RELATIONSHIP MANAGEMENT — Medium
  // -------------------------------------------------------------------------
  {
    id: "relationship-create-ownership",
    name: "Create ownership relationship",
    category: "relationship_management",
    difficulty: "medium",
    prompt: `Create a relationship showing that entity "ent_parent" owns 75% of entity "ent_subsidiary".`,
    systemContext: buildSystemPrompt(),
    validators: [
      {
        type: "contains_command",
        description: "Uses 'los relationship create'",
        weight: 0.2,
        config: { pattern: "los relationship create" },
      },
      {
        type: "flag_value",
        description: "From entity is ent_parent",
        weight: 0.2,
        config: { flags: ["--from"], pattern: "ent_parent" },
      },
      {
        type: "flag_value",
        description: "To entity is ent_subsidiary",
        weight: 0.2,
        config: { flags: ["--to"], pattern: "ent_subsidiary" },
      },
      {
        type: "flag_value",
        description: "Type is 'owns'",
        weight: 0.2,
        config: { flags: ["--type"], pattern: "owns" },
      },
      {
        type: "flag_value",
        description: "Ownership percentage is 75",
        weight: 0.2,
        config: { flags: ["--ownership-pct"], pattern: "75" },
      },
    ],
    tags: ["relationship", "ownership"],
  },

  // -------------------------------------------------------------------------
  // COVENANT MANAGEMENT — Medium/Hard
  // -------------------------------------------------------------------------
  {
    id: "covenant-create",
    name: "Create a financial covenant",
    category: "covenant_management",
    difficulty: "medium",
    prompt: `Add a financial covenant to deal "deal_cov1" requiring the debt-to-EBITDA ratio to stay at or below 3.5x, tested quarterly with a 30-day grace period.`,
    systemContext: buildSystemPrompt(),
    validators: [
      {
        type: "contains_command",
        description: "Uses 'los covenant create'",
        weight: 0.15,
        config: { pattern: "los covenant create" },
      },
      {
        type: "regex_match",
        description: "References deal ID",
        weight: 0.1,
        config: { pattern: "deal_cov1" },
      },
      {
        type: "flag_value",
        description: "Type is financial",
        weight: 0.15,
        config: { flags: ["--type"], pattern: "financial" },
      },
      {
        type: "flag_present",
        description: "Has metric",
        weight: 0.1,
        config: { flags: ["--metric"] },
      },
      {
        type: "flag_value",
        description: "Operator is <=",
        weight: 0.15,
        config: { flags: ["--operator"], pattern: "<=" },
      },
      {
        type: "flag_value",
        description: "Threshold is 3.5",
        weight: 0.1,
        config: { flags: ["--threshold"], pattern: "3\\.5" },
      },
      {
        type: "flag_value",
        description: "Frequency is quarterly",
        weight: 0.1,
        config: { flags: ["--frequency"], pattern: "quarterly" },
      },
      {
        type: "flag_value",
        description: "Grace period is 30",
        weight: 0.15,
        config: { flags: ["--grace-period"], pattern: "30" },
      },
    ],
    tags: ["covenant", "financial"],
  },

  // -------------------------------------------------------------------------
  // FACILITY MANAGEMENT — Medium
  // -------------------------------------------------------------------------
  {
    id: "facility-create",
    name: "Create a term loan facility",
    category: "facility_management",
    difficulty: "medium",
    prompt: `Create a term loan facility for deal "deal_fac1" for $10 million with a fixed interest rate of 5.5% and a 60-month term.`,
    systemContext: buildSystemPrompt(),
    validators: [
      {
        type: "contains_command",
        description: "Uses 'los facility create'",
        weight: 0.15,
        config: { pattern: "los facility create" },
      },
      {
        type: "regex_match",
        description: "References deal ID",
        weight: 0.1,
        config: { pattern: "deal_fac1" },
      },
      {
        type: "flag_value",
        description: "Type is term_loan",
        weight: 0.15,
        config: { flags: ["--type"], pattern: "term_loan" },
      },
      {
        type: "flag_present",
        description: "Has amount",
        weight: 0.15,
        config: { flags: ["--amount"] },
      },
      {
        type: "flag_value",
        description: "Rate type is fixed",
        weight: 0.15,
        config: { flags: ["--rate-type"], pattern: "fixed" },
      },
      {
        type: "flag_present",
        description: "Has rate",
        weight: 0.15,
        config: { flags: ["--rate"] },
      },
      {
        type: "flag_value",
        description: "Term is 60",
        weight: 0.15,
        config: { flags: ["--term"], pattern: "60" },
      },
    ],
    tags: ["facility", "term_loan"],
  },

  // -------------------------------------------------------------------------
  // MULTI-STEP WORKFLOWS — Hard
  // -------------------------------------------------------------------------
  {
    id: "workflow-onboard-borrower",
    name: "Multi-step: onboard a new borrower",
    category: "multi_step_workflow",
    difficulty: "hard",
    prompt: `I need to onboard a new borrower. Please give me the commands to:
1. Create a company entity for "Nordic Shipping AS" in Norway with registration number NO-987654
2. Create a deal for this borrower requesting $15 million for fleet expansion
3. Then list all deals to confirm it was created`,
    systemContext: buildSystemPrompt(),
    validators: [
      {
        type: "contains_command",
        description: "Has entity create command",
        weight: 0.25,
        config: { pattern: "los entity create" },
      },
      {
        type: "contains_command",
        description: "Has deal create command",
        weight: 0.25,
        config: { pattern: "los deal create" },
      },
      {
        type: "contains_command",
        description: "Has deal list command",
        weight: 0.15,
        config: { pattern: "los deal list" },
      },
      {
        type: "correct_sequence",
        description: "Entity creation comes before deal creation",
        weight: 0.2,
        config: { before: "los entity create", after: "los deal create" },
      },
      {
        type: "flag_value",
        description: "Entity type is company",
        weight: 0.15,
        config: { flags: ["-t", "--type"], pattern: "company" },
      },
    ],
    tags: ["workflow", "multi_step", "hard"],
  },

  {
    id: "workflow-full-origination",
    name: "Multi-step: full deal origination flow",
    category: "multi_step_workflow",
    difficulty: "hard",
    prompt: `Walk me through originating a $3 million term loan for "Desert Solar LLC" (a US company, reg number DS-2024-100) for solar panel installation. I need the commands to:
1. Create the company entity
2. Create the deal
3. Advance the deal from broker to origination stage
4. Create a term loan facility
Give me each command on its own line.`,
    systemContext: buildSystemPrompt(),
    validators: [
      {
        type: "contains_command",
        description: "Has entity create",
        weight: 0.15,
        config: { pattern: "los entity create" },
      },
      {
        type: "contains_command",
        description: "Has deal create",
        weight: 0.15,
        config: { pattern: "los deal create" },
      },
      {
        type: "contains_command",
        description: "Has deal advance",
        weight: 0.15,
        config: { pattern: "los deal advance" },
      },
      {
        type: "contains_command",
        description: "Has facility create",
        weight: 0.15,
        config: { pattern: "los facility create" },
      },
      {
        type: "correct_sequence",
        description: "Entity before deal",
        weight: 0.1,
        config: { before: "los entity create", after: "los deal create" },
      },
      {
        type: "correct_sequence",
        description: "Deal before advance",
        weight: 0.1,
        config: { before: "los deal create", after: "los deal advance" },
      },
      {
        type: "correct_sequence",
        description: "Advance before facility",
        weight: 0.1,
        config: { before: "los deal advance", after: "los facility create" },
      },
      {
        type: "no_hallucination",
        description: "No invented commands or flags",
        weight: 0.1,
        config: {
          validCommands: [
            "los entity create", "los deal create", "los deal advance",
            "los facility create", "los deal list", "los deal get",
            "los deal update", "los entity list",
          ],
        },
      },
    ],
    tags: ["workflow", "multi_step", "hard", "comprehensive"],
  },

  // -------------------------------------------------------------------------
  // ERROR RECOVERY — Hard
  // -------------------------------------------------------------------------
  {
    id: "error-missing-required",
    name: "Handle missing required field",
    category: "error_recovery",
    difficulty: "hard",
    prompt: `I tried to create an entity but got this error:
"Error: required option '-t, --type <type>' not specified"

What's the correct command to create a company entity for "FreshFoods Inc"?`,
    systemContext: buildSystemPrompt(),
    validators: [
      {
        type: "contains_command",
        description: "Has entity create",
        weight: 0.3,
        config: { pattern: "los entity create" },
      },
      {
        type: "flag_present",
        description: "Now includes required -t flag",
        weight: 0.35,
        config: { flags: ["-t", "--type"] },
      },
      {
        type: "flag_present",
        description: "Has -n flag for name",
        weight: 0.35,
        config: { flags: ["-n", "--name"] },
      },
    ],
    tags: ["error_recovery", "hard"],
  },

  // -------------------------------------------------------------------------
  // LOAN LIFECYCLE — Medium/Hard
  // -------------------------------------------------------------------------
  {
    id: "loan-create",
    name: "Create a loan account",
    category: "loan_lifecycle",
    difficulty: "medium",
    prompt: `Create a loan account for deal "deal_ln1" with a loan amount of $500,000, interest rate of 6.5%, and a 36-month term. The account holder is entity "ent_holder1".`,
    systemContext: buildSystemPrompt(),
    validators: [
      {
        type: "contains_command",
        description: "Uses 'los loan create'",
        weight: 0.2,
        config: { pattern: "los loan create" },
      },
      {
        type: "flag_value",
        description: "Deal is deal_ln1",
        weight: 0.15,
        config: { flags: ["--deal"], pattern: "deal_ln1" },
      },
      {
        type: "flag_present",
        description: "Has amount",
        weight: 0.15,
        config: { flags: ["--amount"] },
      },
      {
        type: "flag_present",
        description: "Has rate",
        weight: 0.15,
        config: { flags: ["--rate"] },
      },
      {
        type: "flag_value",
        description: "Term is 36",
        weight: 0.15,
        config: { flags: ["--term"], pattern: "36" },
      },
      {
        type: "flag_value",
        description: "Holder is ent_holder1",
        weight: 0.2,
        config: { flags: ["--holder"], pattern: "ent_holder1" },
      },
    ],
    tags: ["loan", "lifecycle"],
  },

  {
    id: "loan-approve-disburse",
    name: "Approve and disburse a loan",
    category: "loan_lifecycle",
    difficulty: "hard",
    prompt: `For loan "loan_001", first approve it and then disburse $500,000 with today's date (2025-01-15).`,
    systemContext: buildSystemPrompt(),
    validators: [
      {
        type: "contains_command",
        description: "Has loan transact for approval",
        weight: 0.25,
        config: { pattern: "los loan transact" },
      },
      {
        type: "regex_match",
        description: "Has APPROVAL transaction type",
        weight: 0.2,
        config: { pattern: "APPROVAL" },
      },
      {
        type: "regex_match",
        description: "Has DISBURSEMENT transaction type",
        weight: 0.2,
        config: { pattern: "DISBURSEMENT" },
      },
      {
        type: "correct_sequence",
        description: "Approval before disbursement",
        weight: 0.2,
        config: { before: "APPROVAL", after: "DISBURSEMENT" },
      },
      {
        type: "regex_match",
        description: "References the loan ID",
        weight: 0.15,
        config: { pattern: "loan_001" },
      },
    ],
    tags: ["loan", "lifecycle", "multi_step", "hard"],
  },

  // -------------------------------------------------------------------------
  // MONITORING — Medium
  // -------------------------------------------------------------------------
  {
    id: "monitoring-check-status",
    name: "Check monitoring status",
    category: "monitoring",
    difficulty: "easy",
    prompt: `Check the monitoring status for deal "deal_mon1".`,
    systemContext: buildSystemPrompt(),
    validators: [
      {
        type: "contains_command",
        description: "Uses monitoring status command",
        weight: 0.5,
        config: { pattern: "los monitoring status" },
      },
      {
        type: "regex_match",
        description: "References deal ID",
        weight: 0.5,
        config: { pattern: "deal_mon1" },
      },
    ],
    tags: ["monitoring", "basic"],
  },

  // -------------------------------------------------------------------------
  // NO HALLUCINATION — Medium
  // -------------------------------------------------------------------------
  {
    id: "no-hallucinate-nonexistent",
    name: "Don't invent commands that don't exist",
    category: "defaults_understanding",
    difficulty: "medium",
    prompt: `Delete deal "deal_del1" from the system.`,
    systemContext: buildSystemPrompt(),
    validators: [
      {
        type: "no_hallucination",
        description: "Should NOT invent a 'los deal delete' command (it doesn't exist in the CLI reference)",
        weight: 1.0,
        config: {
          invalidPatterns: ["los deal delete", "los deal remove", "los deal destroy"],
          validCommands: [
            "los deal create", "los deal list", "los deal get",
            "los deal update", "los deal advance", "los deal history",
          ],
        },
      },
    ],
    tags: ["hallucination", "edge_case"],
  },

  // -------------------------------------------------------------------------
  // AUDIT — Easy
  // -------------------------------------------------------------------------
  {
    id: "audit-list",
    name: "View audit trail",
    category: "deal_query",
    difficulty: "easy",
    prompt: `Show me the audit trail for deal "deal_aud1".`,
    systemContext: buildSystemPrompt(),
    validators: [
      {
        type: "contains_command",
        description: "Uses audit list command",
        weight: 0.5,
        config: { pattern: "los audit list" },
      },
      {
        type: "regex_match",
        description: "References deal ID",
        weight: 0.5,
        config: { pattern: "deal_aud1" },
      },
    ],
    tags: ["audit", "basic"],
  },

  // -------------------------------------------------------------------------
  // DEPOSIT ACCOUNTS — Medium
  // -------------------------------------------------------------------------
  {
    id: "deposit-create",
    name: "Create a deposit account",
    category: "deal_creation",
    difficulty: "medium",
    prompt: `Create a demand deposit account for "Alpine Holdings" in EUR currency.`,
    systemContext: buildSystemPrompt(),
    validators: [
      {
        type: "contains_command",
        description: "Uses deposit create command",
        weight: 0.25,
        config: { pattern: "los deposit create" },
      },
      {
        type: "flag_value",
        description: "Type is demand_deposit",
        weight: 0.25,
        config: { flags: ["--type"], pattern: "demand_deposit" },
      },
      {
        type: "flag_value",
        description: "Holder contains 'Alpine'",
        weight: 0.25,
        config: { flags: ["--holder"], pattern: "Alpine" },
      },
      {
        type: "flag_value",
        description: "Currency is EUR",
        weight: 0.25,
        config: { flags: ["--currency"], pattern: "EUR" },
      },
    ],
    tags: ["deposit", "banking"],
  },

  // =========================================================================
  // COMPLEX DEAL STRUCTURES — Hard (Scratchpad-enabled)
  // =========================================================================

  // ---- MBI (Management Buy-In) ----
  {
    id: "mbi-entity-structure",
    name: "MBI: Build acquisition vehicle entity graph",
    category: "complex_deal_structure",
    difficulty: "hard",
    prompt: `A PE fund called "Northstar Capital Fund III" is backing a Management Buy-In of a UK manufacturing company called "Precision Castings Ltd" (Companies House reg CAS-2019-445, LEI 5493001KJTIIGC8Y1R12).

The deal structure:
- Northstar is creating an SPV called "NC Acquisition HoldCo Ltd" (to be incorporated) that will acquire 100% of Precision Castings
- The incoming CEO "Marcus Webb" is personally investing £500k of co-invest equity alongside the PE fund
- Marcus Webb will also provide a personal guarantee
- Northstar Capital Fund III owns 85% of NC Acquisition HoldCo, Marcus Webb owns 15%

Set up the full entity graph: create all entities and their relationships. Think through the correct order of operations.`,
    systemContext: buildScratchpadPrompt(),
    validators: [
      {
        type: "multi_entity_graph",
        description: "Creates all four entities (PE fund, HoldCo, target, CEO person)",
        weight: 0.25,
        config: {
          expectedEntities: [
            "Northstar Capital",
            "NC Acquisition HoldCo",
            "Precision Castings",
            "Marcus Webb",
          ],
          expectedRelationships: ["owns", "guarantees"],
        },
      },
      {
        type: "correct_sequence",
        description: "Entities created before relationships",
        weight: 0.15,
        config: { before: "los entity create", after: "los relationship create" },
      },
      {
        type: "flag_value",
        description: "Target company has LEI set",
        weight: 0.1,
        config: { flags: ["--lei"], pattern: "5493001KJTIIGC8Y1R12" },
      },
      {
        type: "flag_value",
        description: "Target company reg number included",
        weight: 0.1,
        config: { flags: ["--reg-number"], pattern: "CAS-2019-445" },
      },
      {
        type: "regex_match",
        description: "Ownership percentage 85 appears for PE fund",
        weight: 0.1,
        config: { pattern: "85" },
      },
      {
        type: "regex_match",
        description: "Ownership percentage 15 appears for CEO",
        weight: 0.1,
        config: { pattern: "15" },
      },
      {
        type: "scratchpad_quality",
        description: "Reasons through creation order and structure",
        weight: 0.2,
        config: {
          expectedTopics: ["order", "holdco", "spv", "acquisition", "guarantee"],
        },
      },
    ],
    tags: ["mbi", "complex", "entity_graph", "pe", "scratchpad"],
  },

  {
    id: "mbi-deal-and-facilities",
    name: "MBI: Structure acquisition financing",
    category: "complex_deal_structure",
    difficulty: "hard",
    prompt: `Continuing the Northstar / Precision Castings MBI from the previous step. The entities are already created with these IDs:
- ent_northstar (PE fund)
- ent_holdco (NC Acquisition HoldCo Ltd)
- ent_precision (Precision Castings Ltd — the target)
- ent_webb (Marcus Webb — incoming CEO)

Now structure the acquisition financing. The total enterprise value is £28m. The funding stack:
- £12m Senior Term Loan (floating rate, SONIA + 3.5%, 60-month term) — this is what we're lending
- £4m Revolver (floating rate, SONIA + 3.25%) — also from us
- £2m Capex Facility (floating, SONIA + 3.75%, 48-month term) — also from us
- £10m PE equity from Northstar (not our problem but relevant for leverage calcs)

The borrower is NC Acquisition HoldCo Ltd. Create the deal, set ent_holdco as primary entity, advance it to origination, and create all three facilities.

Also set up a debt-to-EBITDA covenant at <=4.0x tested quarterly, and an interest cover ratio covenant at >=2.0x tested quarterly.`,
    systemContext: buildScratchpadPrompt(`Entities already created:
- ent_northstar: Northstar Capital Fund III (company, UK)
- ent_holdco: NC Acquisition HoldCo Ltd (company, UK)
- ent_precision: Precision Castings Ltd (company, UK, reg CAS-2019-445)
- ent_webb: Marcus Webb (person)
Relationships: ent_northstar owns 85% of ent_holdco, ent_webb owns 15% of ent_holdco, ent_holdco owns 100% of ent_precision, ent_webb guarantees ent_holdco`),
    validators: [
      {
        type: "contains_command",
        description: "Creates the deal",
        weight: 0.1,
        config: { pattern: "los deal create" },
      },
      {
        type: "contains_command",
        description: "Updates deal with primary entity",
        weight: 0.1,
        config: { pattern: "los deal update" },
      },
      {
        type: "flag_value",
        description: "Primary entity set to HoldCo",
        weight: 0.05,
        config: { flags: ["--primary-entity"], pattern: "ent_holdco" },
      },
      {
        type: "contains_command",
        description: "Advances deal to origination",
        weight: 0.1,
        config: { pattern: "los deal advance" },
      },
      {
        type: "regex_match",
        description: "Creates term_loan facility",
        weight: 0.1,
        config: { pattern: "term_loan" },
      },
      {
        type: "regex_match",
        description: "Creates revolver facility",
        weight: 0.1,
        config: { pattern: "revolver" },
      },
      {
        type: "regex_match",
        description: "Three facility create commands",
        weight: 0.1,
        config: { pattern: "los facility create" },
      },
      {
        type: "contains_command",
        description: "Creates covenants",
        weight: 0.1,
        config: { pattern: "los covenant create" },
      },
      {
        type: "regex_match",
        description: "Debt-to-EBITDA covenant referenced",
        weight: 0.05,
        config: { pattern: "debt.to.ebitda|leverage" },
      },
      {
        type: "regex_match",
        description: "Interest cover ratio referenced",
        weight: 0.05,
        config: { pattern: "interest.cover|icr|interest_cover" },
      },
      {
        type: "correct_sequence",
        description: "Deal created before facilities",
        weight: 0.1,
        config: { before: "los deal create", after: "los facility create" },
      },
      {
        type: "scratchpad_quality",
        description: "Reasons through funding stack and ordering",
        weight: 0.05,
        config: {
          expectedTopics: ["senior", "revolver", "capex", "leverage", "covenant"],
        },
      },
    ],
    tags: ["mbi", "complex", "facilities", "covenants", "scratchpad"],
  },

  // ---- MBO (Management Buy-Out) ----
  {
    id: "mbo-full-structure",
    name: "MBO: Founder exit with management rollover",
    category: "complex_deal_structure",
    difficulty: "hard",
    prompt: `Structure an MBO deal. The founder of "Evergreen Logistics Ltd" (UK, reg EVG-2015-300) wants to sell his 100% stake. The management team (COO "Sarah Chen" and CFO "David Park") are buying him out with PE backing from "Bridgewater Growth Partners".

Deal structure:
- New HoldCo: "EL Management BidCo Ltd"
- Bridgewater Growth Partners owns 60% of BidCo
- Sarah Chen owns 25% of BidCo (rollover equity + new investment)
- David Park owns 15% of BidCo (rollover equity + new investment)
- BidCo will acquire 100% of Evergreen Logistics Ltd
- Both Sarah Chen and David Park provide personal guarantees

Financing: £8m Senior Term Loan (fixed 6.25%, 60 months), £2m Revolver (floating, 48 months)

Enterprise value: £18m. The founder is also providing a £2m vendor loan (subordinated) — but the LOS probably can't model vendor loans natively.

Set up everything: entities, relationships, deal, advance to origination, facilities, and flag what the system can't handle.`,
    systemContext: buildScratchpadPrompt(),
    validators: [
      {
        type: "multi_entity_graph",
        description: "Creates all entities in the structure",
        weight: 0.2,
        config: {
          expectedEntities: [
            "Bridgewater Growth",
            "EL Management BidCo",
            "Evergreen Logistics",
            "Sarah Chen",
            "David Park",
          ],
          expectedRelationships: ["owns", "guarantees"],
        },
      },
      {
        type: "contains_command",
        description: "Creates the deal",
        weight: 0.1,
        config: { pattern: "los deal create" },
      },
      {
        type: "contains_command",
        description: "Creates facilities",
        weight: 0.1,
        config: { pattern: "los facility create" },
      },
      {
        type: "identifies_gap",
        description: "Flags that vendor loans / subordinated debt can't be modelled",
        weight: 0.2,
        config: {
          gapKeywords: ["vendor loan", "subordinated", "mezzanine", "cannot model", "not supported"],
        },
      },
      {
        type: "creative_solution",
        description: "Suggests workaround for vendor loan tracking",
        weight: 0.15,
        config: {
          solutionPatterns: ["custom", "note", "manual", "field", "workaround", "script"],
        },
      },
      {
        type: "scratchpad_quality",
        description: "Thinks through MBO structure and funding",
        weight: 0.15,
        config: {
          expectedTopics: ["mbo", "rollover", "vendor", "bidco", "guarantee", "subordinat"],
        },
      },
      {
        type: "risk_awareness",
        description: "Flags risks in the structure",
        weight: 0.1,
        config: {
          riskKeywords: [
            "conflict", "guarantee", "subordinat", "intercreditor",
            "security", "change of control", "key man",
          ],
        },
      },
    ],
    tags: ["mbo", "complex", "entity_graph", "vendor_loan", "gap", "scratchpad"],
  },

  // ---- REFINANCING ----
  {
    id: "refi-existing-loan",
    name: "Refinancing: Replace maturing facility",
    category: "refinancing",
    difficulty: "hard",
    prompt: `A borrower "Atlas Property Group Ltd" (entity ent_atlas, deal deal_atlas_orig) has an existing £5m term loan maturing in 3 months. They want to refinance with us at better terms.

Existing deal context (from our system):
- deal_atlas_orig is in "monitoring" stage with loan_atlas_001 active
- Current rate: fixed 7.5%, remaining balance: £3.2m
- Existing covenants: LTV <= 65%, ICR >= 1.8x (both currently passing)

The refinancing plan:
1. New £6m term loan (fixed 5.75%, 84-month term) — they're drawing extra for refurbishment
2. Keep the same covenant package but tighten LTV to <= 60%
3. The old loan needs to be paid off at completion

Give me the commands to set up the refinancing deal. Think about what data you need to pull from the existing deal, how to set up the new one, and how the old loan gets retired. Flag anything the CLI can't handle natively.`,
    systemContext: buildScratchpadPrompt(`Existing system state:
- Entity: ent_atlas (Atlas Property Group Ltd, company, UK)
- Deal: deal_atlas_orig (monitoring stage)
- Loan: loan_atlas_001 (balance: £3,200,000, rate: 7.5% fixed)
- Covenants on deal_atlas_orig: LTV <= 65% (passing), ICR >= 1.8x (passing)`),
    validators: [
      {
        type: "contains_command",
        description: "Gets existing deal details",
        weight: 0.05,
        config: { pattern: "los deal get" },
      },
      {
        type: "contains_command",
        description: "Creates new refinancing deal",
        weight: 0.1,
        config: { pattern: "los deal create" },
      },
      {
        type: "contains_command",
        description: "Creates new facility",
        weight: 0.1,
        config: { pattern: "los facility create" },
      },
      {
        type: "contains_command",
        description: "Sets up new covenants",
        weight: 0.1,
        config: { pattern: "los covenant create" },
      },
      {
        type: "regex_match",
        description: "References the tighter LTV of 60",
        weight: 0.1,
        config: { pattern: "60" },
      },
      {
        type: "identifies_gap",
        description: "Flags loan retirement/payoff gap",
        weight: 0.15,
        config: {
          gapKeywords: [
            "payoff", "retire", "close", "repay", "settle",
            "no command", "cannot close", "link", "predecessor",
          ],
        },
      },
      {
        type: "creative_solution",
        description: "Suggests how to handle loan payoff and deal linkage",
        weight: 0.15,
        config: {
          solutionPatterns: [
            "REPAYMENT", "transact", "custom", "note", "manual", "reference",
          ],
        },
      },
      {
        type: "scratchpad_quality",
        description: "Reasons through refinancing workflow",
        weight: 0.15,
        config: {
          expectedTopics: [
            "existing", "payoff", "new facility", "covenant", "balance", "refinanc",
          ],
        },
      },
      {
        type: "correct_sequence",
        description: "Deal created before facility",
        weight: 0.1,
        config: { before: "los deal create", after: "los facility create" },
      },
    ],
    tags: ["refinancing", "complex", "gap", "scratchpad"],
  },

  {
    id: "refi-cross-collateral",
    name: "Refinancing: Cross-collateralised portfolio",
    category: "refinancing",
    difficulty: "hard",
    prompt: `"Meridian Developments Ltd" has 4 SPVs, each holding a different property:
- "Meridian Site A Ltd" (ent_ma) — completed office, valued £8m
- "Meridian Site B Ltd" (ent_mb) — completed retail, valued £5m
- "Meridian Site C Ltd" (ent_mc) — development site, valued £3m (projected £7m on completion)
- "Meridian Site D Ltd" (ent_md) — land bank, valued £1.5m

They want to refinance all four under a single cross-collateralised facility: £14m term loan against the portfolio (60% LTV on completed assets, 50% LTV on development/land).

The problem: the LOS doesn't have a native concept of "cross-collateral" or "security packages" that span multiple entities. How would you model this?

Set up whatever you can in the CLI, identify the gaps, and propose a practical workaround — maybe a script that calculates the blended LTV across entities, or using custom fields to track the security package.`,
    systemContext: buildScratchpadPrompt(`Existing entities:
- ent_meridian: Meridian Developments Ltd (parent company)
- ent_ma: Meridian Site A Ltd (subsidiary, owns completed office valued £8m)
- ent_mb: Meridian Site B Ltd (subsidiary, owns completed retail valued £5m)
- ent_mc: Meridian Site C Ltd (subsidiary, development site valued £3m / £7m on completion)
- ent_md: Meridian Site D Ltd (subsidiary, land bank valued £1.5m)
Relationships: ent_meridian owns 100% of each SPV`),
    validators: [
      {
        type: "contains_command",
        description: "Creates a deal",
        weight: 0.1,
        config: { pattern: "los deal create" },
      },
      {
        type: "contains_command",
        description: "Creates a facility",
        weight: 0.1,
        config: { pattern: "los facility create" },
      },
      {
        type: "identifies_gap",
        description: "Flags missing cross-collateral / security package feature",
        weight: 0.2,
        config: {
          gapKeywords: [
            "cross-collateral", "security package", "collateral",
            "no way to link", "multiple entities", "not supported",
            "no security", "no collateral",
          ],
        },
      },
      {
        type: "creative_solution",
        description: "Proposes workaround for cross-collateral tracking",
        weight: 0.25,
        config: {
          solutionPatterns: [
            "custom", "script", "json", "calculate", "blended",
            "ltv", "spread", "monitor", "field",
          ],
        },
      },
      {
        type: "scratchpad_quality",
        description: "Analyses LTV calculations across portfolio",
        weight: 0.2,
        config: {
          expectedTopics: [
            "ltv", "valuation", "completed", "development",
            "portfolio", "blended", "collateral",
          ],
        },
      },
      {
        type: "risk_awareness",
        description: "Flags portfolio concentration or development risk",
        weight: 0.15,
        config: {
          riskKeywords: [
            "development risk", "completion", "valuation",
            "concentration", "land bank", "ltv", "cross-default",
          ],
        },
      },
    ],
    tags: ["refinancing", "cross_collateral", "gap", "creative", "scratchpad"],
  },

  // ---- LENDER BUYOUT ----
  {
    id: "lender-buyout-portfolio",
    name: "Lender buyout: Acquiring a loan book",
    category: "lender_buyout",
    difficulty: "hard",
    prompt: `We are acquiring a portfolio of 3 loans from "Challenger Bank plc" who is exiting the SME lending market. We need to onboard everything into our LOS.

Loan details from Challenger's data room:
1. "Bright Sparks Electrical Ltd" (UK, reg BSE-2020-110) — £800k term loan, 5.5% fixed, 36 months remaining, current balance £520k. Covenants: DSCR >= 1.2x quarterly.
2. "Henderson & Sons Builders" (UK, reg HSB-2018-055) — £1.2m term loan, 6.0% fixed, 48 months remaining, current balance £890k. Covenants: debt/EBITDA <= 3.5x quarterly, ICR >= 1.5x quarterly.
3. "ClearView Glazing Co" (UK, reg CVG-2021-200) — £400k revolver, SONIA+4.0% floating, current drawn £280k, facility limit £400k. No financial covenants (information covenant only — annual accounts).

For each loan, we need to: create the entity, create a deal, set up the facility, create a loan account, record the existing balance as an opening position, and set up covenants.

We also need to ingest 6 months of historical bank transaction data for monitoring — Challenger is providing CSV exports. The CLI's monitoring ingest takes JSON, not CSV.

Walk me through the full onboarding, flag any gaps, and write a script to convert CSV bank statements to the JSON format the monitoring ingest command expects.`,
    systemContext: buildScratchpadPrompt(),
    validators: [
      {
        type: "multi_entity_graph",
        description: "Creates all three borrower entities",
        weight: 0.1,
        config: {
          expectedEntities: [
            "Bright Sparks",
            "Henderson",
            "ClearView",
          ],
          expectedRelationships: [],
        },
      },
      {
        type: "regex_match",
        description: "Creates multiple deals (3 deal create commands)",
        weight: 0.1,
        config: { pattern: "los deal create" },
      },
      {
        type: "regex_match",
        description: "Creates facilities",
        weight: 0.1,
        config: { pattern: "los facility create" },
      },
      {
        type: "regex_match",
        description: "Creates loan accounts",
        weight: 0.1,
        config: { pattern: "los loan create" },
      },
      {
        type: "contains_command",
        description: "Sets up covenants",
        weight: 0.05,
        config: { pattern: "los covenant create" },
      },
      {
        type: "identifies_gap",
        description: "Flags CSV-to-JSON conversion need and/or opening balance gap",
        weight: 0.15,
        config: {
          gapKeywords: [
            "csv", "json", "convert", "transform", "opening balance",
            "historical", "bulk", "import", "migration",
          ],
        },
      },
      {
        type: "creative_solution",
        description: "Provides CSV-to-JSON conversion script",
        weight: 0.2,
        config: {
          solutionPatterns: [
            "csv", "json", "jq", "python", "awk", "script", "convert",
            "parse", "transform", "loop", "for",
          ],
        },
      },
      {
        type: "scratchpad_quality",
        description: "Plans the onboarding systematically",
        weight: 0.1,
        config: {
          expectedTopics: [
            "onboard", "entity", "deal", "facility", "loan",
            "covenant", "monitoring", "historical",
          ],
        },
      },
      {
        type: "risk_awareness",
        description: "Flags due diligence or data quality concerns",
        weight: 0.1,
        config: {
          riskKeywords: [
            "due diligence", "data quality", "verify", "reconcil",
            "audit trail", "kyc", "aml", "documentation",
          ],
        },
      },
    ],
    tags: ["lender_buyout", "portfolio", "migration", "gap", "creative", "scratchpad"],
  },

  {
    id: "lender-buyout-distressed",
    name: "Lender buyout: Acquiring distressed debt at discount",
    category: "lender_buyout",
    difficulty: "hard",
    prompt: `We're buying a single distressed loan from "National Commercial Bank" at a discount. The borrower "Ironworks Manufacturing plc" (UK, reg IWM-2016-080) is in financial difficulty:

Original loan: £5m term loan at 4.5% fixed, 24 months remaining
Purchase price: £3.2m (64 cents on the dollar)
Current balance according to NCB: £4.1m
The borrower's latest debt/EBITDA is 6.2x (covenant threshold was 4.0x — they're in breach)
ICR is 0.8x (threshold was 1.5x — also in breach)
The borrower has missed 2 consecutive quarterly interest payments

We need to:
1. Onboard the entity and deal into our system
2. Record the loan at the PURCHASE PRICE (£3.2m), not the face value
3. The existing covenants are in breach — we need to set up new restructured covenants as part of the workout plan
4. Flag all the issues and suggest how to track the discount/premium, the arrears, and the workout status

The CLI doesn't have concepts for: purchase price vs face value, arrears tracking, workout/restructuring status, or loan-level notes. How would you handle this?`,
    systemContext: buildScratchpadPrompt(),
    validators: [
      {
        type: "contains_command",
        description: "Creates entity for Ironworks",
        weight: 0.05,
        config: { pattern: "los entity create" },
      },
      {
        type: "contains_command",
        description: "Creates deal",
        weight: 0.05,
        config: { pattern: "los deal create" },
      },
      {
        type: "contains_command",
        description: "Creates loan account",
        weight: 0.05,
        config: { pattern: "los loan create" },
      },
      {
        type: "identifies_gap",
        description: "Flags purchase price vs face value gap",
        weight: 0.15,
        config: {
          gapKeywords: [
            "purchase price", "face value", "discount", "par",
            "book value", "mark to market", "carry value",
            "arrears", "missed payment", "workout",
          ],
        },
      },
      {
        type: "identifies_gap",
        description: "Flags arrears/workout tracking gap",
        weight: 0.15,
        config: {
          gapKeywords: [
            "arrears", "missed", "overdue", "workout", "restructur",
            "forbearance", "waiver", "amendment",
          ],
        },
      },
      {
        type: "creative_solution",
        description: "Proposes workarounds using custom fields or scripts",
        weight: 0.2,
        config: {
          solutionPatterns: [
            "custom", "--custom", "json", "field", "note",
            "script", "track", "manual", "metadata",
          ],
        },
      },
      {
        type: "risk_awareness",
        description: "Flags credit and compliance risks of distressed acquisition",
        weight: 0.15,
        config: {
          riskKeywords: [
            "breach", "default", "distressed", "impair",
            "provision", "write-down", "workout", "restructur",
            "cross-default", "material adverse", "insolvency",
          ],
        },
      },
      {
        type: "scratchpad_quality",
        description: "Analyses the distressed loan complexities",
        weight: 0.2,
        config: {
          expectedTopics: [
            "discount", "face value", "arrears", "covenant breach",
            "workout", "restructur", "purchase price",
          ],
        },
      },
    ],
    tags: ["lender_buyout", "distressed", "gap", "creative", "scratchpad"],
  },

  // ---- GAP BRIDGING — scenarios that deliberately stress CLI limitations ----
  {
    id: "gap-syndication",
    name: "Gap: Model a syndicated loan",
    category: "gap_bridging",
    difficulty: "hard",
    prompt: `We're acting as lead arranger on a £50m syndicated facility for "Thames Water Infrastructure Ltd". The syndicate members and their commitments:
- Us (lead arranger): £20m (40%)
- "Barclays Corporate" (participant): £15m (30%)
- "HSBC UK" (participant): £10m (20%)
- "Lloyds Banking Group" (participant): £5m (10%)

The facility is a 5-year term loan at SONIA + 2.75% floating.

The LOS CLI has no concept of syndication, sub-participation, or commitment splits. How would you model this? Think creatively — maybe use custom fields, multiple facilities, scripts to track allocations, or a combination approach.

Set up what you can in the CLI and provide workarounds for everything else.`,
    systemContext: buildScratchpadPrompt(),
    validators: [
      {
        type: "contains_command",
        description: "Creates entities or deal",
        weight: 0.1,
        config: { pattern: "los" },
      },
      {
        type: "identifies_gap",
        description: "Clearly identifies syndication is not supported",
        weight: 0.25,
        config: {
          gapKeywords: [
            "syndication", "syndicated", "participation",
            "commitment", "allocation", "no support", "not supported",
            "no concept", "cannot model",
          ],
        },
      },
      {
        type: "creative_solution",
        description: "Proposes practical workaround for syndication tracking",
        weight: 0.3,
        config: {
          solutionPatterns: [
            "custom", "field", "json", "script", "facility",
            "split", "track", "allocat", "proportion",
            "multiple", "separate",
          ],
        },
      },
      {
        type: "scratchpad_quality",
        description: "Analyses syndication modelling approach",
        weight: 0.2,
        config: {
          expectedTopics: [
            "syndic", "arranger", "participant", "commitment",
            "allocation", "proportion", "drawdown",
          ],
        },
      },
      {
        type: "risk_awareness",
        description: "Flags operational risks of manual syndication tracking",
        weight: 0.15,
        config: {
          riskKeywords: [
            "reconcil", "manual", "error", "audit",
            "regulatory", "reporting", "settlement",
          ],
        },
      },
    ],
    tags: ["gap", "syndication", "creative", "scratchpad"],
  },

  {
    id: "gap-conditions-precedent",
    name: "Gap: Track conditions precedent checklist",
    category: "gap_bridging",
    difficulty: "hard",
    prompt: `Deal "deal_cp_001" for "Greenfield Solar Park Ltd" is in origination. Before we can advance to underwriting, we need to track these Conditions Precedent (CPs):

1. [OUTSTANDING] Certificate of incorporation for new SPV
2. [RECEIVED] Board resolution authorising the borrowing — uploaded as doc
3. [OUTSTANDING] Environmental impact assessment report
4. [RECEIVED] Latest audited financial statements (FY2024) — uploaded as doc
5. [OUTSTANDING] Planning permission confirmation from local council
6. [OUTSTANDING] Insurance certificate for the solar park
7. [RECEIVED] Legal opinion from borrower's counsel — uploaded as doc
8. [OUTSTANDING] Valuation report from independent valuer

The CLI has no CP tracking feature. There's no checklist, no status tracking for pre-conditions, no way to block stage transitions based on CP completion.

Build a practical solution: use what the CLI offers (documents, custom fields, deal updates) and write a script that:
- Stores the CP list somewhere queryable
- Tracks which CPs are received vs outstanding
- Can report on completion percentage
- Could theoretically block deal advancement until all CPs are received`,
    systemContext: buildScratchpadPrompt(`Existing state:
- Deal: deal_cp_001 (Greenfield Solar Park Ltd, origination stage)
- Entity: ent_greenfield (Greenfield Solar Park Ltd)
- Documents already uploaded: board_resolution.pdf, financial_statements_fy2024.pdf, legal_opinion.pdf`),
    validators: [
      {
        type: "identifies_gap",
        description: "Flags missing CP tracking feature",
        weight: 0.15,
        config: {
          gapKeywords: [
            "conditions precedent", "cp tracking", "checklist",
            "no feature", "not supported", "no way to track",
            "no cp", "pre-condition",
          ],
        },
      },
      {
        type: "creative_solution",
        description: "Builds a practical CP tracking solution",
        weight: 0.35,
        config: {
          solutionPatterns: [
            "custom", "json", "script", "bash", "python", "jq",
            "status", "track", "checklist", "field",
            "OUTSTANDING", "RECEIVED", "complete",
          ],
        },
      },
      {
        type: "regex_match",
        description: "Uses deal update custom fields to store CP state",
        weight: 0.15,
        config: { pattern: "los deal update|--custom" },
      },
      {
        type: "scratchpad_quality",
        description: "Designs the CP tracking approach",
        weight: 0.2,
        config: {
          expectedTopics: [
            "checklist", "status", "outstanding", "received",
            "completion", "block", "advance", "custom field",
          ],
        },
      },
      {
        type: "risk_awareness",
        description: "Flags risk of advancing without all CPs",
        weight: 0.15,
        config: {
          riskKeywords: [
            "compliance", "advance", "guard", "block",
            "risk", "missing", "outstanding", "incomplete",
          ],
        },
      },
    ],
    tags: ["gap", "conditions_precedent", "creative", "scratchpad"],
  },

  {
    id: "gap-multi-currency-hedging",
    name: "Gap: Multi-currency deal with FX exposure",
    category: "gap_bridging",
    difficulty: "hard",
    prompt: `"Nordic Transport AS" (Norwegian company) is borrowing from us. The deal structure:
- £10m GBP term loan (our base currency)
- USD $5m letter of credit (for US equipment purchase)
- NOK 20m capex facility (for Norway-based capital expenditure)

The borrower's revenue is 70% in NOK, 20% in EUR, 10% in GBP. So there's significant FX mismatch between their debt currencies and revenue currencies.

The CLI can create facilities in different currencies, but has no concept of:
- FX hedging positions
- Currency exposure reporting
- Cross-currency covenant calculations (e.g., consolidated DSCR needs FX conversion)
- Hedge effectiveness tracking

Set up the facilities you can, identify all the FX-related gaps, and propose how you'd build a monitoring solution — maybe a script that pulls facility balances, applies current FX rates, and calculates consolidated ratios.`,
    systemContext: buildScratchpadPrompt(`Existing state:
- Entity: ent_nordic (Nordic Transport AS, company, Norway)
- Deal: deal_nordic_001 (origination stage)
- Primary entity set to ent_nordic`),
    validators: [
      {
        type: "contains_command",
        description: "Creates GBP facility",
        weight: 0.05,
        config: { pattern: "los facility create" },
      },
      {
        type: "regex_match",
        description: "References multiple currencies",
        weight: 0.1,
        config: { pattern: "(GBP|USD|NOK).*?(GBP|USD|NOK)" },
      },
      {
        type: "regex_match",
        description: "Creates letter_of_credit facility",
        weight: 0.05,
        config: { pattern: "letter_of_credit" },
      },
      {
        type: "identifies_gap",
        description: "Flags FX hedging and cross-currency gaps",
        weight: 0.2,
        config: {
          gapKeywords: [
            "fx", "hedg", "currency exposure", "cross-currency",
            "exchange rate", "conversion", "mismatch",
            "no hedge", "no fx",
          ],
        },
      },
      {
        type: "creative_solution",
        description: "Proposes FX monitoring/calculation solution",
        weight: 0.25,
        config: {
          solutionPatterns: [
            "script", "calculate", "convert", "rate", "api",
            "fx rate", "consolidat", "json", "monitor",
            "curl", "python",
          ],
        },
      },
      {
        type: "scratchpad_quality",
        description: "Analyses FX exposure and hedging needs",
        weight: 0.2,
        config: {
          expectedTopics: [
            "currency", "exposure", "revenue", "mismatch",
            "hedge", "consolidated", "conversion",
          ],
        },
      },
      {
        type: "risk_awareness",
        description: "Flags FX risk to debt service",
        weight: 0.15,
        config: {
          riskKeywords: [
            "fx risk", "currency risk", "mismatch", "unhedged",
            "devaluation", "volatility", "natural hedge",
          ],
        },
      },
    ],
    tags: ["gap", "multi_currency", "fx", "creative", "scratchpad"],
  },

  {
    id: "gap-amendment-waiver",
    name: "Gap: Covenant breach with waiver and amendment",
    category: "gap_bridging",
    difficulty: "hard",
    prompt: `Deal "deal_amend_001" for "Coastal Fisheries Ltd" (ent_coastal) is in monitoring. The latest covenant test results:
- Debt/EBITDA: 4.8x (threshold was <= 4.0x) — BREACH
- Current ratio: 1.1x (threshold was >= 1.25x) — BREACH
- ICR: 2.1x (threshold was >= 1.5x) — passing

The borrower has explained that the breach is temporary due to a one-off equipment replacement cost. They're requesting:
1. A waiver for the Q3 2025 covenant test (one-time, not ongoing)
2. An amendment to relax the debt/EBITDA threshold from 4.0x to 4.5x for the next 4 quarters, reverting to 4.0x after that
3. The current ratio covenant to be deleted entirely as it's not material for this business

The CLI has no concept of:
- Covenant waivers (temporary forgiveness of a breach)
- Covenant amendments (changing thresholds on existing covenants)
- Covenant deletion
- Amendment effective dates or sunset clauses
- Fee tracking (there's usually a waiver fee)

How would you handle this? Use CLI commands where possible, and build workarounds for the rest.`,
    systemContext: buildScratchpadPrompt(`Existing state:
- Deal: deal_amend_001 (Coastal Fisheries Ltd, monitoring stage)
- Entity: ent_coastal
- Loan: loan_coastal_001
- Covenants:
  - cov_001: debt_to_ebitda <= 4.0 quarterly
  - cov_002: current_ratio >= 1.25 quarterly
  - cov_003: icr >= 1.5 quarterly`),
    validators: [
      {
        type: "identifies_gap",
        description: "Flags missing waiver/amendment/deletion capabilities",
        weight: 0.2,
        config: {
          gapKeywords: [
            "waiver", "amendment", "amend", "modify", "delete covenant",
            "no way to", "cannot amend", "no amendment", "sunset",
            "temporary", "time-limited",
          ],
        },
      },
      {
        type: "creative_solution",
        description: "Proposes practical approach to track waivers and amendments",
        weight: 0.25,
        config: {
          solutionPatterns: [
            "custom", "field", "json", "note", "audit", "script",
            "new covenant", "delete", "create", "replace",
            "manual", "track", "record",
          ],
        },
      },
      {
        type: "scratchpad_quality",
        description: "Thinks through the amendment/waiver workflow",
        weight: 0.2,
        config: {
          expectedTopics: [
            "waiver", "amendment", "threshold", "temporary",
            "revert", "sunset", "delete", "current ratio",
          ],
        },
      },
      {
        type: "risk_awareness",
        description: "Flags the credit risk implications",
        weight: 0.2,
        config: {
          riskKeywords: [
            "breach", "default", "waiver fee", "credit risk",
            "deteriorat", "temporary", "one-off", "recurring",
            "audit trail", "approval", "credit committee",
          ],
        },
      },
      {
        type: "contains_command",
        description: "Uses some CLI commands (covenant create/test, deal update, audit)",
        weight: 0.15,
        config: { pattern: "los" },
      },
    ],
    tags: ["gap", "amendment", "waiver", "covenant_breach", "creative", "scratchpad"],
  },

  // ---- COMPLEX MULTI-ENTITY: Group restructuring ----
  {
    id: "complex-group-restructure",
    name: "Complex: Group restructuring with inter-company loans",
    category: "complex_deal_structure",
    difficulty: "hard",
    prompt: `"Wellington Group Holdings Ltd" (ent_wgh) is restructuring its corporate group. Current structure:
- Wellington Group Holdings (parent) owns:
  - Wellington Manufacturing Ltd (ent_wm, 100%)
  - Wellington Distribution Ltd (ent_wd, 100%)
  - Wellington Retail Ltd (ent_wr, 80% — minority shareholder holds 20%)

The restructuring:
1. A new intermediate HoldCo "Wellington OpCo Ltd" is being inserted between the parent and the three operating companies
2. Wellington Group Holdings will own 100% of Wellington OpCo
3. Wellington OpCo will own 100% of Manufacturing and Distribution, and 80% of Retail
4. The existing inter-company loan from Manufacturing to Distribution (£2m) needs to be novated to sit under OpCo
5. The bank facility (£15m term loan, £5m revolver) will move from Group Holdings to OpCo as borrower

The CLI doesn't support:
- Inter-company loan tracking
- Novation of existing facilities
- Changing the borrower on an existing deal
- Corporate restructuring workflows

Model as much as you can. Write a script or set of commands that handles the restructuring step by step, using entity creates, relationship updates, and creative use of deals/custom fields for the rest.`,
    systemContext: buildScratchpadPrompt(`Existing state:
- ent_wgh: Wellington Group Holdings Ltd (parent)
- ent_wm: Wellington Manufacturing Ltd (subsidiary)
- ent_wd: Wellington Distribution Ltd (subsidiary)
- ent_wr: Wellington Retail Ltd (80% owned, 20% minority)
- deal_wgh_001: existing deal with ent_wgh as primary entity (monitoring stage)
- Facilities on deal_wgh_001: term_loan £15m, revolver £5m
- Relationships: ent_wgh owns 100% ent_wm, ent_wgh owns 100% ent_wd, ent_wgh owns 80% ent_wr`),
    validators: [
      {
        type: "contains_command",
        description: "Creates new OpCo entity",
        weight: 0.1,
        config: { pattern: "los entity create" },
      },
      {
        type: "contains_command",
        description: "Creates new relationships for OpCo",
        weight: 0.1,
        config: { pattern: "los relationship create" },
      },
      {
        type: "identifies_gap",
        description: "Flags novation, inter-company loans, borrower change gaps",
        weight: 0.2,
        config: {
          gapKeywords: [
            "novation", "novate", "inter-company", "intercompany",
            "change borrower", "transfer", "reassign",
            "cannot move", "cannot change", "no support",
          ],
        },
      },
      {
        type: "creative_solution",
        description: "Proposes approach to handle restructuring",
        weight: 0.2,
        config: {
          solutionPatterns: [
            "new deal", "close", "custom", "script", "manual",
            "recreate", "migrate", "transfer", "link",
          ],
        },
      },
      {
        type: "multi_entity_graph",
        description: "Creates proper post-restructuring entity graph",
        weight: 0.15,
        config: {
          expectedEntities: ["Wellington OpCo", "OpCo"],
          expectedRelationships: ["owns"],
        },
      },
      {
        type: "scratchpad_quality",
        description: "Plans the restructuring sequence carefully",
        weight: 0.15,
        config: {
          expectedTopics: [
            "opco", "intermediate", "novation", "restructur",
            "facility", "borrower", "relationship",
          ],
        },
      },
      {
        type: "risk_awareness",
        description: "Flags risks around data integrity during restructuring",
        weight: 0.1,
        config: {
          riskKeywords: [
            "audit trail", "data integrity", "minority",
            "consent", "security", "guarantee", "continuity",
          ],
        },
      },
    ],
    tags: ["complex", "restructuring", "multi_entity", "gap", "creative", "scratchpad"],
  },
];

/** Get tasks by category */
export function getTasksByCategory(category: TaskCategory): TestTask[] {
  return ALL_TASKS.filter((t) => t.category === category);
}

/** Get tasks by difficulty */
export function getTasksByDifficulty(difficulty: string): TestTask[] {
  return ALL_TASKS.filter((t) => t.difficulty === difficulty);
}

/** Get tasks by tag */
export function getTasksByTag(tag: string): TestTask[] {
  return ALL_TASKS.filter((t) => t.tags.includes(tag));
}
