import * as readline from "node:readline";
import { createServiceContext } from "./context.js";
import type { ServiceContext } from "./context.js";
import { formatJson, formatError } from "./helpers.js";
import { handleEntityCreate, handleEntityGet, handleEntityList, handleEntityResolve, handleEntityUpdate, handleEntityDelete } from "./tools/entities.js";
import { handleDealCreate, handleDealGet, handleDealUpdate, handleDealList } from "./tools/deals.js";
import { handleStageTransition, handleStageHistory } from "./tools/stages.js";
import { handleDocumentUpload, handleDocumentList } from "./tools/documents.js";
import { handleSpreadCreate, handleSpreadGetRatios } from "./tools/spreads.js";
import { handleEvaluate } from "./tools/underwriting.js";
import { handleRelationshipCreate } from "./tools/relationships.js";
import { handleCovenantCreate, handleCovenantList, handleCovenantTest } from "./tools/covenants.js";
import { handleFacilityCreate, handleFacilityList } from "./tools/facilities.js";
import { handleLoanCreate, handleLoanGet, handleLoanBalance, handleLoanSchedule, handleLoanTransact } from "./tools/loans.js";
import { handleMonitoringIngest, handleMonitoringStatus } from "./tools/monitoring.js";
import { handleAuditList } from "./tools/audit.js";
import { handleDepositCreate, handleDepositList } from "./tools/deposits.js";

interface ReplState {
  lastDealId?: string;
  lastEntityId?: string;
  lastLoanId?: string;
  actor: string;
  tenantId: string;
}

function resolveAlias(state: ReplState, value: string): string {
  if (value === "$last_deal" && state.lastDealId) return state.lastDealId;
  if (value === "$last_entity" && state.lastEntityId) return state.lastEntityId;
  if (value === "$last_loan" && state.lastLoanId) return state.lastLoanId;
  return value;
}

function captureId(state: ReplState, result: unknown) {
  if (result && typeof result === "object") {
    const obj = result as Record<string, unknown>;
    if (typeof obj.id === "string") {
      const id = obj.id as string;
      if (id.startsWith("deal_")) state.lastDealId = id;
      else if (id.startsWith("ent_")) state.lastEntityId = id;
      else if (id.startsWith("loan_") || id.startsWith("la_")) state.lastLoanId = id;
    }
    // Also capture from nested results
    if (typeof obj.deal_id === "string") state.lastDealId = obj.deal_id as string;
    if (typeof obj.run_id === "string" && typeof obj.case === "object") {
      // UnderwritingRun
      const c = obj.case as Record<string, unknown>;
      if (typeof c.case_id === "string") state.lastDealId = c.case_id as string;
    }
  }
}

// Simple argument parser for REPL commands
function parseArgs(input: string): { positional: string[]; flags: Record<string, string> } {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  const tokens: string[] = [];

  // Tokenize respecting quotes
  let current = "";
  let inQuote = false;
  let quoteChar = "";
  for (const ch of input) {
    if (inQuote) {
      if (ch === quoteChar) {
        inQuote = false;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
    } else if (ch === " " || ch === "\t") {
      if (current) {
        tokens.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.startsWith("--")) {
      const key = t.slice(2);
      const next = tokens[i + 1];
      if (next && !next.startsWith("-")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = "true";
      }
    } else if (t.startsWith("-") && t.length === 2) {
      const key = t.slice(1);
      const next = tokens[i + 1];
      if (next && !next.startsWith("-")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = "true";
      }
    } else {
      positional.push(t);
    }
  }

  return { positional, flags };
}

async function dispatch(
  ctx: ServiceContext,
  state: ReplState,
  line: string
): Promise<unknown> {
  const { positional, flags } = parseArgs(line);
  const [domain, action, ...rest] = positional;
  const actor = state.actor;
  const tenant_id = state.tenantId;

  // Resolve aliases in all positional args and flag values
  const resolvedRest = rest.map((r) => resolveAlias(state, r));
  for (const [k, v] of Object.entries(flags)) {
    flags[k] = resolveAlias(state, v);
  }

  switch (domain) {
    case "entity":
      switch (action) {
        case "create":
          return handleEntityCreate(ctx, {
            type: flags.t ?? flags.type ?? "company",
            name: flags.n ?? flags.name ?? resolvedRest[0] ?? "Unnamed",
            legal_name: flags["legal-name"],
            jurisdiction: flags.j ?? flags.jurisdiction,
            actor,
            tenant_id,
          });
        case "get":
          return handleEntityGet(ctx, { id: resolveAlias(state, resolvedRest[0] ?? flags.id ?? ""), tenant_id });
        case "list":
          return handleEntityList(ctx, { type: flags.t ?? flags.type, tenant_id });
        case "resolve":
          return handleEntityResolve(ctx, {
            name: flags.n ?? flags.name,
            registration_number: flags["reg-number"] ?? flags.registration_number,
            lei: flags.lei,
            jurisdiction: flags.j ?? flags.jurisdiction,
            tenant_id,
          });
        case "update":
          return handleEntityUpdate(ctx, {
            id: resolveAlias(state, resolvedRest[0] ?? flags.id ?? ""),
            name: flags.n ?? flags.name,
            actor,
            tenant_id,
          });
        case "delete":
          return handleEntityDelete(ctx, { id: resolveAlias(state, resolvedRest[0] ?? flags.id ?? ""), tenant_id });
        default:
          throw new Error(`Unknown entity action: ${action}. Try: create, get, list, resolve, update, delete`);
      }

    case "deal":
      switch (action) {
        case "create":
          return handleDealCreate(ctx, {
            borrower_name: flags.b ?? flags.borrower ?? resolvedRest[0] ?? "Unknown",
            jurisdiction: flags.j ?? flags.jurisdiction,
            requested_amount: flags.a ?? flags.amount ? parseInt(flags.a ?? flags.amount) : undefined,
            purpose: flags.p ?? flags.purpose,
            primary_entity_id: flags.entity,
            actor,
            tenant_id,
          });
        case "get":
          return handleDealGet(ctx, { id: resolveAlias(state, resolvedRest[0] ?? flags.id ?? ""), tenant_id });
        case "update":
          return handleDealUpdate(ctx, {
            id: resolveAlias(state, resolvedRest[0] ?? flags.id ?? ""),
            borrower_name: flags.b ?? flags.borrower,
            purpose: flags.p ?? flags.purpose,
            origination_outcome: flags.outcome,
            actor,
            tenant_id,
          });
        case "list":
          return handleDealList(ctx, { stage: flags.s ?? flags.stage, tenant_id });
        case "advance":
          return handleStageTransition(ctx, {
            deal_id: resolveAlias(state, resolvedRest[0] ?? flags.id ?? ""),
            to_stage: flags.t ?? flags.to ?? resolvedRest[1] ?? "",
            rationale: flags.r ?? flags.rationale,
            override: flags.override === "true",
            actor,
            tenant_id,
          });
        case "history":
          return handleStageHistory(ctx, { deal_id: resolveAlias(state, resolvedRest[0] ?? flags.id ?? "") });
        default:
          throw new Error(`Unknown deal action: ${action}. Try: create, get, update, list, advance, history`);
      }

    case "deals":
      return handleDealList(ctx, { tenant_id });

    case "entities":
      return handleEntityList(ctx, { tenant_id });

    case "document":
    case "doc":
      switch (action) {
        case "upload":
          return handleDocumentUpload(ctx, {
            deal_id: resolveAlias(state, resolvedRest[0] ?? ""),
            doc_type: flags.type ?? "general",
            filename: flags.filename ?? "document.pdf",
            content: flags.content ?? "",
            actor,
            tenant_id,
          });
        case "list":
          return handleDocumentList(ctx, { deal_id: resolveAlias(state, resolvedRest[0] ?? ""), tenant_id });
        default:
          throw new Error(`Unknown document action: ${action}. Try: upload, list`);
      }

    case "spread":
      switch (action) {
        case "create":
          return handleSpreadCreate(ctx, {
            deal_id: resolveAlias(state, resolvedRest[0] ?? ""),
            period: flags.period ?? "2024",
            line_items: flags.items ? JSON.parse(flags.items) : undefined,
            actor,
          });
        case "ratios":
          return handleSpreadGetRatios(ctx, { deal_id: resolveAlias(state, resolvedRest[0] ?? "") });
        default:
          throw new Error(`Unknown spread action: ${action}. Try: create, ratios`);
      }

    case "evaluate":
      return handleEvaluate(ctx, {
        deal_id: resolveAlias(state, action ?? ""),
        mode: flags.mode ?? "full",
        allow_rules_fallback: flags["allow-rules-fallback"] === "true",
        actor,
        tenant_id,
      });

    case "relationship":
      if (action === "create") {
        return handleRelationshipCreate(ctx, {
          from_entity_id: resolveAlias(state, flags.from ?? ""),
          to_entity_id: resolveAlias(state, flags.to ?? ""),
          type: flags.t ?? flags.type ?? "subsidiary",
          ownership_pct: flags["ownership-pct"] ? parseFloat(flags["ownership-pct"]) : undefined,
          actor,
        });
      }
      throw new Error(`Unknown relationship action: ${action}. Try: create`);

    case "covenant":
      switch (action) {
        case "create":
          return handleCovenantCreate(ctx, {
            deal_id: resolveAlias(state, resolvedRest[0] ?? ""),
            name: flags.n ?? flags.name ?? "Unnamed",
            type: flags.t ?? flags.type ?? "financial",
            metric: flags.metric,
            operator: flags.operator,
            threshold: flags.threshold ? parseFloat(flags.threshold) : undefined,
            frequency: flags.frequency,
            actor,
          });
        case "list":
          return handleCovenantList(ctx, { deal_id: resolveAlias(state, resolvedRest[0] ?? "") });
        case "test":
          return handleCovenantTest(ctx, { deal_id: resolveAlias(state, resolvedRest[0] ?? ""), actor });
        default:
          throw new Error(`Unknown covenant action: ${action}. Try: create, list, test`);
      }

    case "facility":
      switch (action) {
        case "create":
          return handleFacilityCreate(ctx, {
            deal_id: resolveAlias(state, resolvedRest[0] ?? ""),
            type: flags.t ?? flags.type ?? "term_loan",
            amount: parseInt(flags.a ?? flags.amount ?? "0"),
            currency: flags.currency ?? "USD",
            actor,
          });
        case "list":
          return handleFacilityList(ctx, { deal_id: resolveAlias(state, resolvedRest[0] ?? "") });
        default:
          throw new Error(`Unknown facility action: ${action}. Try: create, list`);
      }

    case "loan":
      switch (action) {
        case "create":
          return handleLoanCreate(ctx, {
            deal_id: resolveAlias(state, resolvedRest[0] ?? ""),
            loan_amount: parseInt(flags.a ?? flags.amount ?? "0"),
            facility_id: flags.f ?? flags.facility,
            interest_rate: flags.rate ? parseFloat(flags.rate) : undefined,
            term_months: flags.term ? parseInt(flags.term) : undefined,
            account_holder_id: flags.holder,
            actor,
            tenant_id,
          });
        case "get":
          return handleLoanGet(ctx, { id: resolveAlias(state, resolvedRest[0] ?? ""), tenant_id });
        case "balance":
          return handleLoanBalance(ctx, { id: resolveAlias(state, resolvedRest[0] ?? ""), tenant_id });
        case "schedule":
          return handleLoanSchedule(ctx, { id: resolveAlias(state, resolvedRest[0] ?? ""), tenant_id });
        case "transact":
          return handleLoanTransact(ctx, {
            id: resolveAlias(state, resolvedRest[0] ?? ""),
            type: flags.t ?? flags.type ?? "",
            amount: flags.a ?? flags.amount ? parseInt(flags.a ?? flags.amount) : undefined,
            value_date: flags["value-date"],
            notes: flags.n ?? flags.notes,
            actor,
            tenant_id,
          });
        default:
          throw new Error(`Unknown loan action: ${action}. Try: create, get, balance, schedule, transact`);
      }

    case "monitoring":
      switch (action) {
        case "ingest":
          return handleMonitoringIngest(ctx, {
            deal_id: resolveAlias(state, resolvedRest[0] ?? ""),
            source_type: flags.source ?? "bank_transactions",
            transactions: flags.data ? JSON.parse(flags.data) : [],
            actor,
          });
        case "status":
          return handleMonitoringStatus(ctx, { deal_id: resolveAlias(state, resolvedRest[0] ?? ""), actor });
        default:
          throw new Error(`Unknown monitoring action: ${action}. Try: ingest, status`);
      }

    case "audit":
      return handleAuditList(ctx, {
        deal_id: resolveAlias(state, action ?? ""),
        type: flags.t ?? flags.type,
        actor: flags.by,
        limit: flags.l ?? flags.limit ? parseInt(flags.l ?? flags.limit) : undefined,
      });

    case "deposit":
      switch (action) {
        case "create":
          return handleDepositCreate(ctx, {
            type: flags.t ?? flags.type ?? "checking",
            holder: flags.holder ?? resolvedRest[0] ?? "",
            currency: flags.currency ?? "USD",
            actor,
            tenant_id,
          });
        case "list":
          return handleDepositList(ctx, { tenant_id });
        default:
          throw new Error(`Unknown deposit action: ${action}. Try: create, list`);
      }

    case "set":
      if (action === "actor") {
        state.actor = resolvedRest[0] ?? flags.id ?? "repl";
        return { actor: state.actor };
      }
      if (action === "tenant") {
        state.tenantId = resolvedRest[0] ?? flags.id ?? "default";
        return { tenant_id: state.tenantId };
      }
      throw new Error(`Unknown setting: ${action}. Try: actor, tenant`);

    case "state":
      return {
        actor: state.actor,
        tenant_id: state.tenantId,
        last_deal: state.lastDealId ?? null,
        last_entity: state.lastEntityId ?? null,
        last_loan: state.lastLoanId ?? null,
      };

    default:
      throw new Error(
        `Unknown command: ${domain}. Try: entity, deal, document, spread, evaluate, relationship, covenant, facility, loan, monitoring, audit, deposit, set, state`
      );
  }
}

function printHelp() {
  console.log(`
Commands:
  entity create|get|list|resolve|update|delete  Manage entities
  deal create|get|update|list|advance|history  Manage deals
  deals                                   Shorthand for deal list
  entities                                Shorthand for entity list
  document upload|list                    Manage documents
  spread create|ratios                    Financial spreads
  evaluate <dealId>                       Run underwriting
  relationship create                     Entity relationships
  covenant create|list|test               Manage covenants
  facility create|list                    Manage facilities
  loan create|get|balance|schedule|transact  Manage loans
  monitoring ingest|status                Monitoring data
  audit <dealId>                          Audit trail
  deposit create|list                     Deposit accounts

  set actor <id>                          Change actor
  set tenant <id>                         Change tenant
  state                                   Show session state

Aliases:
  $last_deal      Last created/returned deal ID
  $last_entity    Last created/returned entity ID
  $last_loan      Last created/returned loan ID

  help            Show this help
  quit / exit     Exit REPL
`);
}

export async function startRepl() {
  const ctx = await createServiceContext();
  const state: ReplState = { actor: "repl", tenantId: "default" };

  console.log("Open LOS Sandbox (in-memory)");
  console.log("Type 'help' for commands, 'quit' to exit.\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "open-los> ",
  });

  rl.prompt();

  rl.on("line", async (line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      rl.prompt();
      return;
    }
    if (trimmed === "quit" || trimmed === "exit") {
      rl.close();
      return;
    }
    if (trimmed === "help") {
      printHelp();
      rl.prompt();
      return;
    }

    try {
      const result = await dispatch(ctx, state, trimmed);
      captureId(state, result);
      console.log(formatJson(result));
    } catch (err) {
      const { code, message } = formatError(err);
      console.error(`Error [${code}]: ${message}`);
    }

    rl.prompt();
  });

  rl.on("close", () => {
    console.log("\nGoodbye.");
    process.exit(0);
  });
}
