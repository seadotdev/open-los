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
