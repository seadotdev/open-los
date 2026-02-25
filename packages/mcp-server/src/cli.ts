import { Command } from "commander";
import { createServiceContext } from "./context.js";
import type { ServiceContext } from "./context.js";
import { formatJson, formatCompact, parseAmount } from "./helpers.js";
import { handleEntityCreate, handleEntityGet, handleEntityList, handleEntityUpdate, handleEntityDelete } from "./tools/entities.js";
import { handleDealCreate, handleDealGet, handleDealUpdate, handleDealList } from "./tools/deals.js";
import { handleStageTransition, handleStageHistory } from "./tools/stages.js";
import { handleDocumentUpload, handleDocumentList } from "./tools/documents.js";
import { handleSpreadCreate, handleSpreadGetRatios } from "./tools/spreads.js";
import { handleEvaluate, handleUnderwrite } from "./tools/underwriting.js";
import { handleRelationshipCreate } from "./tools/relationships.js";
import { handleCovenantCreate, handleCovenantList, handleCovenantTest } from "./tools/covenants.js";
import { handleFacilityCreate, handleFacilityList } from "./tools/facilities.js";
import { handleLoanCreate, handleLoanGet, handleLoanBalance, handleLoanSchedule, handleLoanTransact } from "./tools/loans.js";
import { handleMonitoringIngest, handleMonitoringStatus } from "./tools/monitoring.js";
import { handleAuditList } from "./tools/audit.js";
import { handleDepositCreate, handleDepositList } from "./tools/deposits.js";
import { startMcp } from "./mcp.js";

function output(data: unknown, format: string) {
  if (format === "compact") {
    console.log(formatCompact(data));
  } else {
    console.log(formatJson(data));
  }
}

export async function startCli(args: string[]) {
  const ctx = await createServiceContext();

  const program = new Command()
    .name("open-los")
    .description("Open LOS sandbox — in-process lending toolkit")
    .option("--db <path>", "Database path (default: in-memory)")
    .option("--actor <id>", "Actor ID", "cli")
    .option("--tenant <id>", "Tenant ID", "default")
    .option("--format <fmt>", "Output format: json|compact", "json");

  function globals() {
    const opts = program.opts();
    return {
      actor: opts.actor as string,
      tenant_id: opts.tenant as string,
      format: opts.format as string,
    };
  }

  // --- Entity commands ---
  const entity = program.command("entity").description("Manage entities");

  entity
    .command("create")
    .description("Create a new entity")
    .requiredOption("-t, --type <type>", "company or person")
    .requiredOption("-n, --name <name>", "Entity name")
    .option("--legal-name <name>", "Legal name")
    .option("--reg-number <number>", "Registration number")
    .option("-j, --jurisdiction <code>", "Jurisdiction")
    .option("--lei <lei>", "Legal Entity Identifier")
    .action(async (opts) => {
      const g = globals();
      const data: Record<string, unknown> = {
        type: opts.type,
        name: opts.name,
        actor: g.actor,
        tenant_id: g.tenant_id,
      };
      if (opts.legalName) data.legal_name = opts.legalName;
      if (opts.regNumber) data.registration_number = opts.regNumber;
      if (opts.jurisdiction) data.jurisdiction = opts.jurisdiction;
      if (opts.lei) data.lei = opts.lei;
      output(await handleEntityCreate(ctx, data as any), g.format);
    });

  entity
    .command("get <id>")
    .description("Get entity by ID")
    .action(async (id) => {
      const g = globals();
      output(await handleEntityGet(ctx, { id, tenant_id: g.tenant_id }), g.format);
    });

  entity
    .command("list")
    .description("List entities")
    .option("-t, --type <type>", "Filter by type")
    .option("-l, --limit <n>", "Limit results")
    .action(async (opts) => {
      const g = globals();
      output(
        await handleEntityList(ctx, {
          type: opts.type,
          limit: opts.limit ? parseInt(opts.limit) : undefined,
          tenant_id: g.tenant_id,
        }),
        g.format
      );
    });

  entity
    .command("update <id>")
    .description("Update entity fields")
    .option("-n, --name <name>", "Entity name")
    .option("--legal-name <name>", "Legal name")
    .option("-j, --jurisdiction <code>", "Jurisdiction")
    .action(async (id, opts) => {
      const g = globals();
      const data: Record<string, unknown> = { id, actor: g.actor, tenant_id: g.tenant_id };
      if (opts.name) data.name = opts.name;
      if (opts.legalName) data.legal_name = opts.legalName;
      if (opts.jurisdiction) data.jurisdiction = opts.jurisdiction;
      output(await handleEntityUpdate(ctx, data as any), g.format);
    });

  entity
    .command("delete <id>")
    .description("Delete an entity")
    .action(async (id) => {
      const g = globals();
      output(await handleEntityDelete(ctx, { id, tenant_id: g.tenant_id }), g.format);
    });

  // --- Deal commands ---
  const deal = program.command("deal").description("Manage deals");

  deal
    .command("create")
    .description("Create a new deal")
    .requiredOption("-b, --borrower <name>", "Borrower name")
    .option("-j, --jurisdiction <code>", "Jurisdiction")
    .option("-a, --amount <amount>", "Requested amount (supports k/m/b suffixes)")
    .option("-p, --purpose <text>", "Loan purpose")
    .option("--entity <id>", "Primary entity ID")
    .option("--custom <json>", "Custom fields as JSON")
    .action(async (opts) => {
      const g = globals();
      const data: Record<string, unknown> = {
        borrower_name: opts.borrower,
        actor: g.actor,
        tenant_id: g.tenant_id,
      };
      if (opts.jurisdiction) data.jurisdiction = opts.jurisdiction;
      if (opts.amount) data.requested_amount = parseAmount(opts.amount);
      if (opts.purpose) data.purpose = opts.purpose;
      if (opts.entity) data.primary_entity_id = opts.entity;
      if (opts.custom) data.custom_fields = JSON.parse(opts.custom);
      output(await handleDealCreate(ctx, data as any), g.format);
    });

  deal
    .command("get <id>")
    .description("Get deal by ID")
    .action(async (id) => {
      const g = globals();
      output(await handleDealGet(ctx, { id, tenant_id: g.tenant_id }), g.format);
    });

  deal
    .command("update <id>")
    .description("Update deal fields")
    .option("-b, --borrower <name>", "Borrower name")
    .option("-j, --jurisdiction <code>", "Jurisdiction")
    .option("-a, --amount <amount>", "Requested amount")
    .option("-p, --purpose <text>", "Loan purpose")
    .option("--assigned-to <user>", "Assign to user")
    .option("--outcome <outcome>", "Origination outcome")
    .option("--primary-entity <id>", "Primary entity ID")
    .option("--custom <json>", "Custom fields as JSON")
    .action(async (id, opts) => {
      const g = globals();
      const data: Record<string, unknown> = { id, actor: g.actor, tenant_id: g.tenant_id };
      if (opts.borrower) data.borrower_name = opts.borrower;
      if (opts.jurisdiction) data.jurisdiction = opts.jurisdiction;
      if (opts.amount) data.requested_amount = parseAmount(opts.amount);
      if (opts.purpose) data.purpose = opts.purpose;
      if (opts.assignedTo) data.assigned_to = opts.assignedTo;
      if (opts.outcome) data.origination_outcome = opts.outcome;
      if (opts.primaryEntity) data.primary_entity_id = opts.primaryEntity;
      if (opts.custom) data.custom_fields = JSON.parse(opts.custom);
      output(await handleDealUpdate(ctx, data as any), g.format);
    });

  deal
    .command("list")
    .description("List deals")
    .option("-s, --stage <stage>", "Filter by stage")
    .option("-l, --limit <n>", "Limit results")
    .action(async (opts) => {
      const g = globals();
      output(
        await handleDealList(ctx, {
          stage: opts.stage,
          limit: opts.limit ? parseInt(opts.limit) : undefined,
          tenant_id: g.tenant_id,
        }),
        g.format
      );
    });

  deal
    .command("advance <id>")
    .description("Advance deal to a stage")
    .requiredOption("-t, --to <stage>", "Target stage")
    .option("-r, --rationale <text>", "Rationale")
    .option("--override", "Override failed guards")
    .option("--override-rationale <text>", "Override rationale")
    .action(async (id, opts) => {
      const g = globals();
      output(
        await handleStageTransition(ctx, {
          deal_id: id,
          to_stage: opts.to,
          rationale: opts.rationale,
          override: opts.override,
          override_rationale: opts.overrideRationale,
          actor: g.actor,
          tenant_id: g.tenant_id,
        }),
        g.format
      );
    });

  deal
    .command("history <id>")
    .description("Show stage transition history")
    .action(async (id) => {
      const g = globals();
      output(await handleStageHistory(ctx, { deal_id: id }), g.format);
    });

  // --- Document commands ---
  const doc = program.command("document").description("Manage documents");

  doc
    .command("upload <dealId>")
    .description("Upload a document to a deal")
    .requiredOption("--type <type>", "Document type")
    .requiredOption("--filename <name>", "Filename")
    .requiredOption("--content <base64>", "Base64-encoded content")
    .option("--mime-type <type>", "MIME type")
    .action(async (dealId, opts) => {
      const g = globals();
      output(
        await handleDocumentUpload(ctx, {
          deal_id: dealId,
          doc_type: opts.type,
          filename: opts.filename,
          content: opts.content,
          mime_type: opts.mimeType,
          actor: g.actor,
          tenant_id: g.tenant_id,
        }),
        g.format
      );
    });

  doc
    .command("list <dealId>")
    .description("List documents for a deal")
    .action(async (dealId) => {
      const g = globals();
      output(await handleDocumentList(ctx, { deal_id: dealId, tenant_id: g.tenant_id }), g.format);
    });

  // --- Spread commands ---
  const spread = program.command("spread").description("Manage financial spreads");

  spread
    .command("create <dealId>")
    .description("Create a financial spread")
    .requiredOption("--period <period>", "Period label")
    .option("--items <json>", "Line items as JSON array")
    .option("--entity <id>", "Entity ID")
    .action(async (dealId, opts) => {
      const g = globals();
      const data: Record<string, unknown> = {
        deal_id: dealId,
        period: opts.period,
        actor: g.actor,
      };
      if (opts.items) data.line_items = JSON.parse(opts.items);
      if (opts.entity) data.entity_id = opts.entity;
      output(await handleSpreadCreate(ctx, data as any), g.format);
    });

  spread
    .command("ratios <dealId>")
    .description("Get computed financial ratios")
    .action(async (dealId) => {
      output(await handleSpreadGetRatios(ctx, { deal_id: dealId }), globals().format);
    });

  // --- Evaluate (top-level) ---
  program
    .command("evaluate <dealId>")
    .description("Run underwriting evaluation")
    .option("--mode <mode>", "rules_only or full", "rules_only")
    .option("--provider <provider>", "anthropic or openrouter")
    .option("--target-yield <pct>", "Target yield %", parseFloat)
    .option("--max-loan <amount>", "Max single loan $", parseFloat)
    .action(async (dealId, opts) => {
      const g = globals();
      output(
        await handleEvaluate(ctx, {
          deal_id: dealId,
          mode: opts.mode,
          provider: opts.provider,
          target_yield_pct: opts.targetYield,
          max_single_loan: opts.maxLoan,
          actor: g.actor,
          tenant_id: g.tenant_id,
        }),
        g.format
      );
    });

  // --- Standalone underwrite (no deal required) ---
  program
    .command("underwrite")
    .description("Run standalone underwriting — no deal/entity/spread required")
    .requiredOption("--dossier <json>", "Financial dossier as JSON string or @file path")
    .option("--policy <json>", "Policy as JSON string or @file path")
    .option("--provider <provider>", "anthropic or openrouter")
    .option("--model <model>", "LLM model to use")
    .option("--persona <text>", "Lender persona")
    .option("--target-yield <pct>", "Target yield %", parseFloat)
    .option("--max-loan <amount>", "Max single loan $", parseFloat)
    .action(async (opts) => {
      const g = globals();

      // Parse dossier — supports inline JSON or @filepath
      let dossierJson: string;
      if (opts.dossier.startsWith("@")) {
        const fs = await import("node:fs");
        dossierJson = fs.readFileSync(opts.dossier.slice(1), "utf-8");
      } else {
        dossierJson = opts.dossier;
      }
      const dossier = JSON.parse(dossierJson);

      // Parse optional policy
      let policyData: Record<string, unknown> = {};
      if (opts.policy) {
        let policyJson: string;
        if (opts.policy.startsWith("@")) {
          const fs = await import("node:fs");
          policyJson = fs.readFileSync(opts.policy.slice(1), "utf-8");
        } else {
          policyJson = opts.policy;
        }
        policyData = JSON.parse(policyJson);
      }

      output(
        await handleUnderwrite(ctx, {
          dossier,
          provider: opts.provider,
          model: opts.model,
          persona: opts.persona ?? (policyData.persona as string),
          target_yield_pct: opts.targetYield ?? (policyData.target_yield_pct as number),
          max_single_loan: opts.maxLoan ?? (policyData.max_single_loan as number),
          total_capital: policyData.total_capital as number,
          sector_limits: policyData.sector_limits as Record<string, number>,
          existing_portfolio: policyData.existing_portfolio as any,
          policy_id: policyData.policy_id as string,
          actor: g.actor,
          tenant_id: g.tenant_id,
        }),
        g.format
      );
    });

  // --- Relationship commands ---
  const rel = program.command("relationship").description("Manage entity relationships");

  rel
    .command("create")
    .description("Create an entity relationship")
    .requiredOption("--from <id>", "From entity ID")
    .requiredOption("--to <id>", "To entity ID")
    .requiredOption("-t, --type <type>", "Relationship type")
    .option("--ownership-pct <pct>", "Ownership percentage", parseFloat)
    .action(async (opts) => {
      const g = globals();
      output(
        await handleRelationshipCreate(ctx, {
          from_entity_id: opts.from,
          to_entity_id: opts.to,
          type: opts.type,
          ownership_pct: opts.ownershipPct,
          actor: g.actor,
        }),
        g.format
      );
    });

  // --- Covenant commands ---
  const covenant = program.command("covenant").description("Manage covenants");

  covenant
    .command("create <dealId>")
    .description("Create a covenant")
    .requiredOption("-n, --name <name>", "Covenant name")
    .requiredOption("-t, --type <type>", "Covenant type")
    .option("--metric <metric>", "Metric name")
    .option("--operator <op>", "Operator (>=, <=, >)")
    .option("--threshold <n>", "Threshold value", parseFloat)
    .option("--frequency <freq>", "Frequency")
    .action(async (dealId, opts) => {
      const g = globals();
      output(
        await handleCovenantCreate(ctx, {
          deal_id: dealId,
          name: opts.name,
          type: opts.type,
          metric: opts.metric,
          operator: opts.operator,
          threshold: opts.threshold,
          frequency: opts.frequency,
          actor: g.actor,
        }),
        g.format
      );
    });

  covenant
    .command("list <dealId>")
    .description("List covenants for a deal")
    .action(async (dealId) => {
      output(await handleCovenantList(ctx, { deal_id: dealId }), globals().format);
    });

  covenant
    .command("test <dealId>")
    .description("Test covenant compliance")
    .action(async (dealId) => {
      const g = globals();
      output(await handleCovenantTest(ctx, { deal_id: dealId, actor: g.actor }), g.format);
    });

  // --- Facility commands ---
  const facility = program.command("facility").description("Manage loan facilities");

  facility
    .command("create <dealId>")
    .description("Create a facility")
    .requiredOption("-t, --type <type>", "Facility type")
    .requiredOption("-a, --amount <amount>", "Amount (supports k/m/b)")
    .option("--currency <code>", "Currency", "USD")
    .option("--rate-type <type>", "Interest rate type")
    .option("--rate <value>", "Interest rate (decimal)", parseFloat)
    .option("--term <months>", "Term in months", parseInt)
    .action(async (dealId, opts) => {
      const g = globals();
      output(
        await handleFacilityCreate(ctx, {
          deal_id: dealId,
          type: opts.type,
          amount: parseAmount(opts.amount),
          currency: opts.currency,
          interest_rate_type: opts.rateType,
          interest_rate_value: opts.rate,
          term_months: opts.term,
          actor: g.actor,
        }),
        g.format
      );
    });

  facility
    .command("list <dealId>")
    .description("List facilities for a deal")
    .action(async (dealId) => {
      output(await handleFacilityList(ctx, { deal_id: dealId }), globals().format);
    });

  // --- Loan commands ---
  const loan = program.command("loan").description("Manage loan accounts");

  loan
    .command("create <dealId>")
    .description("Create a loan account")
    .requiredOption("-a, --amount <amount>", "Loan amount (supports k/m/b)")
    .option("-f, --facility <id>", "Facility ID")
    .option("--rate <value>", "Interest rate (decimal)", parseFloat)
    .option("--term <months>", "Term in months", parseInt)
    .option("--holder <id>", "Account holder entity ID")
    .action(async (dealId, opts) => {
      const g = globals();
      output(
        await handleLoanCreate(ctx, {
          deal_id: dealId,
          facility_id: opts.facility,
          loan_amount: parseAmount(opts.amount),
          interest_rate: opts.rate,
          term_months: opts.term,
          account_holder_id: opts.holder,
          actor: g.actor,
          tenant_id: g.tenant_id,
        }),
        g.format
      );
    });

  loan
    .command("get <id>")
    .description("Get loan account")
    .action(async (id) => {
      const g = globals();
      output(await handleLoanGet(ctx, { id, tenant_id: g.tenant_id }), g.format);
    });

  loan
    .command("balance <id>")
    .description("Get loan balance")
    .action(async (id) => {
      const g = globals();
      output(await handleLoanBalance(ctx, { id, tenant_id: g.tenant_id }), g.format);
    });

  loan
    .command("schedule <id>")
    .description("Get repayment schedule")
    .action(async (id) => {
      const g = globals();
      output(await handleLoanSchedule(ctx, { id, tenant_id: g.tenant_id }), g.format);
    });

  loan
    .command("transact <id>")
    .description("Record a loan transaction")
    .requiredOption("-t, --type <type>", "Transaction type")
    .option("-a, --amount <amount>", "Amount")
    .option("--value-date <date>", "Value date (ISO)")
    .option("-n, --notes <text>", "Notes")
    .action(async (id, opts) => {
      const g = globals();
      output(
        await handleLoanTransact(ctx, {
          id,
          type: opts.type,
          amount: opts.amount ? parseAmount(opts.amount) : undefined,
          value_date: opts.valueDate,
          notes: opts.notes,
          actor: g.actor,
          tenant_id: g.tenant_id,
        }),
        g.format
      );
    });

  // --- Monitoring commands ---
  const monitoring = program.command("monitoring").description("Monitoring data");

  monitoring
    .command("ingest <dealId>")
    .description("Ingest monitoring data")
    .requiredOption("--source <type>", "Source type")
    .requiredOption("--data <json>", "Transactions as JSON array")
    .action(async (dealId, opts) => {
      const g = globals();
      output(
        await handleMonitoringIngest(ctx, {
          deal_id: dealId,
          source_type: opts.source,
          transactions: JSON.parse(opts.data),
          actor: g.actor,
        }),
        g.format
      );
    });

  monitoring
    .command("status <dealId>")
    .description("Get monitoring status")
    .action(async (dealId) => {
      const g = globals();
      output(await handleMonitoringStatus(ctx, { deal_id: dealId, actor: g.actor }), g.format);
    });

  // --- Audit commands ---
  program
    .command("audit <dealId>")
    .description("List audit events for a deal")
    .option("-t, --type <type>", "Filter by event type")
    .option("--by <actor>", "Filter by actor")
    .option("-l, --limit <n>", "Limit results", parseInt)
    .action(async (dealId, opts) => {
      output(
        await handleAuditList(ctx, {
          deal_id: dealId,
          type: opts.type,
          actor: opts.by,
          limit: opts.limit,
        }),
        globals().format
      );
    });

  // --- Deposit commands ---
  const deposit = program.command("deposit").description("Manage deposit accounts");

  deposit
    .command("create")
    .description("Create a deposit account")
    .requiredOption("-t, --type <type>", "Account type")
    .requiredOption("--holder <id>", "Account holder entity ID")
    .option("--currency <code>", "Currency", "USD")
    .action(async (opts) => {
      const g = globals();
      output(
        await handleDepositCreate(ctx, {
          type: opts.type,
          holder: opts.holder,
          currency: opts.currency,
          actor: g.actor,
          tenant_id: g.tenant_id,
        }),
        g.format
      );
    });

  deposit
    .command("list")
    .description("List deposit accounts")
    .action(async () => {
      const g = globals();
      output(await handleDepositList(ctx, { tenant_id: g.tenant_id }), g.format);
    });

  // --- MCP subcommand ---
  program
    .command("mcp")
    .description("Start MCP stdio server")
    .action(async () => {
      await startMcp();
    });

  await program.parseAsync(["node", "open-los", ...args]);
}
