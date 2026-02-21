/**
 * CLI Tool Definitions for Tool Calling Mode
 *
 * Defines each LOS CLI command as an OpenAI-compatible function/tool schema.
 * When tool calling is enabled, models receive these tool definitions and
 * should call the appropriate tool with correct arguments instead of
 * generating raw CLI text.
 */

import type { ToolDefinition, ToolCall } from "./types.js";

/** All CLI commands as tool definitions */
export const CLI_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "los_health",
      description: "Check the API health status",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "los_deal_create",
      description: "Create a new deal for a borrower",
      parameters: {
        type: "object",
        properties: {
          borrower: { type: "string", description: "Borrower name" },
          jurisdiction: { type: "string", description: "Jurisdiction code (e.g., UK, US)" },
          amount: { type: "string", description: "Requested amount (supports k/m/b suffixes)" },
          purpose: { type: "string", description: "Loan purpose" },
          custom: { type: "string", description: "Custom fields as JSON" },
        },
        required: ["borrower"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "los_deal_list",
      description: "List deals, optionally filtered by stage",
      parameters: {
        type: "object",
        properties: {
          stage: { type: "string", description: "Filter by stage" },
          limit: { type: "string", description: "Limit results (default: 20)" },
          cursor: { type: "string", description: "Pagination cursor" },
          format: { type: "string", description: "Output format: json, table, compact", enum: ["json", "table", "compact"] },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "los_deal_get",
      description: "Get details for a specific deal",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "Deal ID" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "los_deal_update",
      description: "Update deal fields",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "Deal ID" },
          borrower: { type: "string", description: "Borrower name" },
          jurisdiction: { type: "string", description: "Jurisdiction" },
          amount: { type: "string", description: "Requested amount" },
          purpose: { type: "string", description: "Loan purpose" },
          assigned_to: { type: "string", description: "Assign to user" },
          outcome: { type: "string", description: "Origination outcome", enum: ["reject", "need_info", "proceed", "refer"] },
          primary_entity: { type: "string", description: "Primary entity ID" },
          custom: { type: "string", description: "Custom fields as JSON" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "los_deal_advance",
      description: "Advance deal to next stage",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "Deal ID" },
          to: { type: "string", description: "Target stage", enum: ["origination", "underwriting", "closing", "monitoring"] },
          rationale: { type: "string", description: "Rationale for transition" },
          override: { type: "string", description: "Set to 'true' to override failed guards", enum: ["true", "false"] },
          override_rationale: { type: "string", description: "Rationale for override" },
        },
        required: ["id", "to"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "los_deal_history",
      description: "Show stage transition history for a deal",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "Deal ID" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "los_entity_create",
      description: "Create a new entity (company or person)",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", description: "Entity type", enum: ["company", "person"] },
          name: { type: "string", description: "Entity name" },
          legal_name: { type: "string", description: "Legal name" },
          reg_number: { type: "string", description: "Registration number" },
          jurisdiction: { type: "string", description: "Jurisdiction code" },
          lei: { type: "string", description: "Legal Entity Identifier" },
        },
        required: ["type", "name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "los_entity_list",
      description: "List entities",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", description: "Filter by type", enum: ["company", "person"] },
          limit: { type: "string", description: "Limit results (default: 20)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "los_entity_get",
      description: "Get entity details",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "Entity ID" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "los_entity_update",
      description: "Update entity fields",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "Entity ID" },
          name: { type: "string", description: "Entity name" },
          legal_name: { type: "string", description: "Legal name" },
          reg_number: { type: "string", description: "Registration number" },
          jurisdiction: { type: "string", description: "Jurisdiction code" },
          lei: { type: "string", description: "Legal Entity Identifier" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "los_entity_delete",
      description: "Delete an entity",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "Entity ID" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "los_relationship_create",
      description: "Create relationship between entities",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string", description: "From entity ID" },
          to: { type: "string", description: "To entity ID" },
          type: { type: "string", description: "Relationship type", enum: ["owns", "guarantees", "directs"] },
          ownership_pct: { type: "string", description: "Ownership percentage" },
        },
        required: ["from", "to", "type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "los_doc_upload",
      description: "Upload a document to a deal",
      parameters: {
        type: "object",
        properties: {
          deal_id: { type: "string", description: "Deal ID" },
          type: { type: "string", description: "Document type" },
          file: { type: "string", description: "File path" },
        },
        required: ["deal_id", "type", "file"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "los_doc_list",
      description: "List documents for a deal",
      parameters: {
        type: "object",
        properties: {
          deal_id: { type: "string", description: "Deal ID" },
        },
        required: ["deal_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "los_covenant_create",
      description: "Create a covenant for a deal",
      parameters: {
        type: "object",
        properties: {
          deal_id: { type: "string", description: "Deal ID" },
          name: { type: "string", description: "Covenant name" },
          type: { type: "string", description: "Covenant type", enum: ["financial", "reporting", "information"] },
          metric: { type: "string", description: "Metric (e.g., debt_to_ebitda)" },
          operator: { type: "string", description: "Comparison operator", enum: [">=", "<=", ">", "<", "=="] },
          threshold: { type: "string", description: "Threshold value" },
          frequency: { type: "string", description: "Testing frequency", enum: ["monthly", "quarterly", "annually"] },
          grace_period: { type: "string", description: "Grace period in days" },
        },
        required: ["deal_id", "name", "type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "los_covenant_list",
      description: "List covenants for a deal",
      parameters: {
        type: "object",
        properties: {
          deal_id: { type: "string", description: "Deal ID" },
        },
        required: ["deal_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "los_covenant_test",
      description: "Test covenant compliance for a deal",
      parameters: {
        type: "object",
        properties: {
          deal_id: { type: "string", description: "Deal ID" },
        },
        required: ["deal_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "los_facility_create",
      description: "Create a loan facility for a deal",
      parameters: {
        type: "object",
        properties: {
          deal_id: { type: "string", description: "Deal ID" },
          type: { type: "string", description: "Facility type", enum: ["term_loan", "revolver", "letter_of_credit"] },
          amount: { type: "string", description: "Facility amount" },
          currency: { type: "string", description: "Currency (default: USD)" },
          rate_type: { type: "string", description: "Interest rate type", enum: ["fixed", "floating"] },
          rate: { type: "string", description: "Interest rate value" },
          term: { type: "string", description: "Term in months" },
        },
        required: ["deal_id", "type", "amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "los_facility_list",
      description: "List facilities for a deal",
      parameters: {
        type: "object",
        properties: {
          deal_id: { type: "string", description: "Deal ID" },
        },
        required: ["deal_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "los_loan_create",
      description: "Create a loan account",
      parameters: {
        type: "object",
        properties: {
          deal: { type: "string", description: "Deal ID" },
          facility: { type: "string", description: "Facility ID" },
          amount: { type: "string", description: "Loan amount" },
          rate: { type: "string", description: "Interest rate" },
          term: { type: "string", description: "Term in months" },
          holder: { type: "string", description: "Account holder entity ID" },
        },
        required: ["deal", "amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "los_loan_get",
      description: "Get loan details",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "Loan ID" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "los_loan_balance",
      description: "Get loan balance",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "Loan ID" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "los_loan_schedule",
      description: "Get repayment schedule",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "Loan ID" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "los_loan_transact",
      description: "Record a loan transaction",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "Loan ID" },
          type: { type: "string", description: "Transaction type", enum: ["APPROVAL", "DISBURSEMENT", "REPAYMENT"] },
          amount: { type: "string", description: "Transaction amount" },
          date: { type: "string", description: "Value date (YYYY-MM-DD)" },
          notes: { type: "string", description: "Notes" },
        },
        required: ["id", "type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "los_spread_create",
      description: "Create a financial spread",
      parameters: {
        type: "object",
        properties: {
          deal_id: { type: "string", description: "Deal ID" },
          entity: { type: "string", description: "Entity ID" },
          period: { type: "string", description: "Period (e.g., FY2025)" },
          items: { type: "string", description: "Line items as JSON array" },
        },
        required: ["deal_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "los_monitoring_ingest",
      description: "Ingest monitoring data for a deal",
      parameters: {
        type: "object",
        properties: {
          deal_id: { type: "string", description: "Deal ID" },
          source: { type: "string", description: "Source type (e.g., bank_transactions)" },
          data: { type: "string", description: "Transaction data as JSON" },
        },
        required: ["deal_id", "source"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "los_monitoring_status",
      description: "Check monitoring status for a deal",
      parameters: {
        type: "object",
        properties: {
          deal_id: { type: "string", description: "Deal ID" },
        },
        required: ["deal_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "los_audit_list",
      description: "List audit events for a deal",
      parameters: {
        type: "object",
        properties: {
          deal_id: { type: "string", description: "Deal ID" },
          type: { type: "string", description: "Filter by event type" },
          actor: { type: "string", description: "Filter by actor" },
        },
        required: ["deal_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "los_deposit_create",
      description: "Create a deposit account",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", description: "Deposit type", enum: ["demand_deposit", "time_deposit", "certificate_of_deposit"] },
          holder: { type: "string", description: "Account holder name" },
          currency: { type: "string", description: "Currency (default: USD)" },
        },
        required: ["type", "holder"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "los_deposit_list",
      description: "List deposit accounts",
      parameters: { type: "object", properties: {} },
    },
  },
];

/**
 * Map from tool function names to the flag mappings used to reconstruct CLI text.
 *
 * Each entry maps a tool argument name to its CLI flag equivalent.
 * Positional args use a special "$positional" key.
 */
const FLAG_MAP: Record<string, Record<string, string>> = {
  los_health: {},
  los_deal_create: {
    borrower: "-b",
    jurisdiction: "-j",
    amount: "-a",
    purpose: "-p",
    custom: "--custom",
  },
  los_deal_list: {
    stage: "-s",
    limit: "-l",
    cursor: "-c",
    format: "-f",
  },
  los_deal_get: { id: "$positional" },
  los_deal_update: {
    id: "$positional",
    borrower: "-b",
    jurisdiction: "-j",
    amount: "-a",
    purpose: "-p",
    assigned_to: "--assigned-to",
    outcome: "--outcome",
    primary_entity: "--primary-entity",
    custom: "--custom",
  },
  los_deal_advance: {
    id: "$positional",
    to: "-t",
    rationale: "-r",
    override: "--override",
    override_rationale: "--override-rationale",
  },
  los_deal_history: { id: "$positional" },
  los_entity_create: {
    type: "-t",
    name: "-n",
    legal_name: "--legal-name",
    reg_number: "--reg-number",
    jurisdiction: "-j",
    lei: "--lei",
  },
  los_entity_list: {
    type: "-t",
    limit: "-l",
  },
  los_entity_get: { id: "$positional" },
  los_entity_update: {
    id: "$positional",
    name: "-n",
    legal_name: "--legal-name",
    reg_number: "--reg-number",
    jurisdiction: "-j",
    lei: "--lei",
  },
  los_entity_delete: { id: "$positional" },
  los_relationship_create: {
    from: "--from",
    to: "--to",
    type: "--type",
    ownership_pct: "--ownership-pct",
  },
  los_doc_upload: {
    deal_id: "$positional",
    type: "--type",
    file: "--file",
  },
  los_doc_list: { deal_id: "$positional" },
  los_covenant_create: {
    deal_id: "$positional",
    name: "--name",
    type: "--type",
    metric: "--metric",
    operator: "--operator",
    threshold: "--threshold",
    frequency: "--frequency",
    grace_period: "--grace-period",
  },
  los_covenant_list: { deal_id: "$positional" },
  los_covenant_test: { deal_id: "$positional" },
  los_facility_create: {
    deal_id: "$positional",
    type: "--type",
    amount: "--amount",
    currency: "--currency",
    rate_type: "--rate-type",
    rate: "--rate",
    term: "--term",
  },
  los_facility_list: { deal_id: "$positional" },
  los_loan_create: {
    deal: "--deal",
    facility: "--facility",
    amount: "--amount",
    rate: "--rate",
    term: "--term",
    holder: "--holder",
  },
  los_loan_get: { id: "$positional" },
  los_loan_balance: { id: "$positional" },
  los_loan_schedule: { id: "$positional" },
  los_loan_transact: {
    id: "$positional",
    type: "--type",
    amount: "--amount",
    date: "--date",
    notes: "--notes",
  },
  los_spread_create: {
    deal_id: "$positional",
    entity: "--entity",
    period: "--period",
    items: "--items",
  },
  los_monitoring_ingest: {
    deal_id: "$positional",
    source: "--source",
    data: "--data",
  },
  los_monitoring_status: { deal_id: "$positional" },
  los_audit_list: {
    deal_id: "$positional",
    type: "--type",
    actor: "--actor",
  },
  los_deposit_create: {
    type: "--type",
    holder: "--holder",
    currency: "--currency",
  },
  los_deposit_list: {},
};

/**
 * Convert tool call(s) back to CLI text so existing text-mode validators work.
 *
 * e.g. tool call { name: "los_deal_create", arguments: { borrower: "Acme", amount: "5m" } }
 *   -> "los deal create -b \"Acme\" -a 5m"
 */
export function toolCallsToCli(toolCalls: ToolCall[]): string {
  return toolCalls
    .map((tc) => {
      const funcName = tc.function.name;
      // Convert function name to CLI command: los_deal_create -> los deal create
      const command = funcName.replace(/_/g, " ");

      let args: Record<string, string>;
      try {
        const parsed = JSON.parse(tc.function.arguments || "{}");
        args = parsed && typeof parsed === "object" ? parsed : {};
      } catch {
        return command;
      }

      const flags = FLAG_MAP[funcName] || {};
      const positionals: string[] = [];
      const flagParts: string[] = [];

      for (const [argName, argValue] of Object.entries(args)) {
        if (argValue === undefined || argValue === null) continue;
        const flag = flags[argName];
        if (!flag) {
          // Unknown arg, add as long flag
          flagParts.push(`--${argName.replace(/_/g, "-")} ${quoteIfNeeded(String(argValue))}`);
        } else if (flag === "$positional") {
          positionals.push(String(argValue));
        } else if (flag === "--override" && (argValue === "true" || argValue === true)) {
          flagParts.push("--override");
        } else {
          flagParts.push(`${flag} ${quoteIfNeeded(String(argValue))}`);
        }
      }

      const parts = [command];
      if (positionals.length > 0) parts.push(...positionals);
      if (flagParts.length > 0) parts.push(...flagParts);
      return parts.join(" ");
    })
    .join("\n");
}

function quoteIfNeeded(val: string): string {
  if (val.includes(" ") || val.includes('"')) {
    return `"${val.replace(/"/g, '\\"')}"`;
  }
  return val;
}
