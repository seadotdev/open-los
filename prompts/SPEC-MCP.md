# MCP Server Spec

> Model Context Protocol server for AI agent integration with Open LOS

## Overview

This spec defines an MCP (Model Context Protocol) server that:
1. Exposes Open LOS functionality as MCP tools for AI assistants
2. Provides resources for deal context and documents
3. Enables AI agents to operate the LOS with the same capabilities as humans
4. Integrates with the existing audit trail (actor headers)

### What This Is NOT

- **Not replacing the REST API** — MCP wraps the existing API
- **Not a separate service** — runs in the same process as the API
- **Not Claude-specific** — follows the open MCP standard

---

## MCP Concepts Mapping

| MCP Concept | Open LOS Mapping |
|-------------|------------------|
| **Tools** | API operations (create deal, add document, test covenant) |
| **Resources** | Read-only data (deal details, documents, spreads) |
| **Prompts** | Skills (underwriting-checklist, covenant-analysis) |

---

## Tools

Tools are actions the AI can take. Each tool maps to one or more API calls.

### Deal Tools

```typescript
const tools = {
  // === DEAL LIFECYCLE ===

  create_deal: {
    description: "Create a new deal in the origination pipeline",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Deal name/title" },
        deal_type: {
          type: "string",
          enum: ["term_loan", "revolving_credit", "equipment_finance", "real_estate"],
          description: "Type of lending facility"
        },
        requested_amount: { type: "number", description: "Requested loan amount in minor units (cents)" },
        currency: { type: "string", default: "USD" },
        primary_entity_id: { type: "string", description: "ID of the primary borrower entity" },
        source: { type: "string", description: "How the deal was sourced" },
      },
      required: ["name", "deal_type"],
    },
  },

  get_deal: {
    description: "Get full details of a deal including related entities, documents, and current stage",
    inputSchema: {
      type: "object",
      properties: {
        deal_id: { type: "string", description: "Deal ID" },
        include: {
          type: "array",
          items: { type: "string", enum: ["entities", "documents", "facilities", "covenants", "spreads"] },
          description: "Related data to include",
        },
      },
      required: ["deal_id"],
    },
  },

  list_deals: {
    description: "List deals with optional filtering by stage, type, or entity",
    inputSchema: {
      type: "object",
      properties: {
        stage: { type: "string", enum: ["broker", "origination", "underwriting", "closing", "monitoring"] },
        deal_type: { type: "string" },
        entity_id: { type: "string", description: "Filter by related entity" },
        limit: { type: "number", default: 20 },
        offset: { type: "number", default: 0 },
      },
    },
  },

  advance_deal_stage: {
    description: "Move a deal to the next stage (e.g., origination → underwriting)",
    inputSchema: {
      type: "object",
      properties: {
        deal_id: { type: "string" },
        to_stage: { type: "string", enum: ["origination", "underwriting", "closing", "monitoring"] },
        rationale: { type: "string", description: "Reason for advancing (required if overriding guards)" },
        override: { type: "boolean", description: "Override stage guards if conditions not met" },
      },
      required: ["deal_id", "to_stage"],
    },
  },

  update_deal: {
    description: "Update deal properties",
    inputSchema: {
      type: "object",
      properties: {
        deal_id: { type: "string" },
        name: { type: "string" },
        deal_type: { type: "string" },
        requested_amount: { type: "number" },
        custom_fields: { type: "object" },
      },
      required: ["deal_id"],
    },
  },

  // === ENTITIES ===

  create_entity: {
    description: "Create a company or person entity",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        type: { type: "string", enum: ["company", "person"] },
        tax_id: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        address: { type: "object" },
        metadata: { type: "object" },
      },
      required: ["name", "type"],
    },
  },

  link_entity_to_deal: {
    description: "Add an entity to a deal with a specific role",
    inputSchema: {
      type: "object",
      properties: {
        deal_id: { type: "string" },
        entity_id: { type: "string" },
        role: {
          type: "string",
          enum: ["borrower", "guarantor", "sponsor", "broker", "legal_counsel"],
        },
      },
      required: ["deal_id", "entity_id", "role"],
    },
  },

  create_relationship: {
    description: "Create a relationship between entities (ownership, guarantee, directorship)",
    inputSchema: {
      type: "object",
      properties: {
        from_entity_id: { type: "string" },
        to_entity_id: { type: "string" },
        relationship_type: { type: "string", enum: ["owns", "guarantees", "directs"] },
        percentage: { type: "number", description: "Ownership percentage (for 'owns' type)" },
      },
      required: ["from_entity_id", "to_entity_id", "relationship_type"],
    },
  },

  // === DOCUMENTS ===

  upload_document: {
    description: "Upload a document to a deal",
    inputSchema: {
      type: "object",
      properties: {
        deal_id: { type: "string" },
        filename: { type: "string" },
        content_base64: { type: "string", description: "Base64-encoded file content" },
        document_type: {
          type: "string",
          enum: ["financial_statement", "tax_return", "bank_statement", "legal", "collateral", "other"],
        },
        period: { type: "string", description: "Fiscal period (e.g., 'FY2023', 'Q1-2024')" },
        notes: { type: "string" },
      },
      required: ["deal_id", "filename", "content_base64"],
    },
  },

  list_documents: {
    description: "List documents for a deal",
    inputSchema: {
      type: "object",
      properties: {
        deal_id: { type: "string" },
        document_type: { type: "string" },
      },
      required: ["deal_id"],
    },
  },

  // === FINANCIAL ANALYSIS ===

  create_spread: {
    description: "Create a financial spread (structured financial data) for a deal",
    inputSchema: {
      type: "object",
      properties: {
        deal_id: { type: "string" },
        entity_id: { type: "string" },
        period: { type: "string", description: "Fiscal period (FY2023)" },
        period_type: { type: "string", enum: ["annual", "quarterly", "monthly"] },
        statement_type: { type: "string", enum: ["audited", "reviewed", "compiled", "internal"] },
        income_statement: {
          type: "object",
          properties: {
            revenue: { type: "number" },
            cost_of_goods_sold: { type: "number" },
            gross_profit: { type: "number" },
            operating_expenses: { type: "number" },
            ebitda: { type: "number" },
            depreciation: { type: "number" },
            interest_expense: { type: "number" },
            net_income: { type: "number" },
          },
        },
        balance_sheet: {
          type: "object",
          properties: {
            cash: { type: "number" },
            accounts_receivable: { type: "number" },
            inventory: { type: "number" },
            total_current_assets: { type: "number" },
            fixed_assets: { type: "number" },
            total_assets: { type: "number" },
            accounts_payable: { type: "number" },
            short_term_debt: { type: "number" },
            total_current_liabilities: { type: "number" },
            long_term_debt: { type: "number" },
            total_liabilities: { type: "number" },
            equity: { type: "number" },
          },
        },
      },
      required: ["deal_id", "entity_id", "period"],
    },
  },

  calculate_ratios: {
    description: "Calculate financial ratios for a deal based on spread data",
    inputSchema: {
      type: "object",
      properties: {
        deal_id: { type: "string" },
        ratios: {
          type: "array",
          items: { type: "string", enum: ["dscr", "leverage", "current_ratio", "quick_ratio", "debt_to_equity"] },
          description: "Ratios to calculate (omit for all)",
        },
      },
      required: ["deal_id"],
    },
  },

  // === COVENANTS ===

  create_covenant: {
    description: "Create a financial covenant for a deal",
    inputSchema: {
      type: "object",
      properties: {
        deal_id: { type: "string" },
        name: { type: "string", description: "e.g., 'Minimum DSCR'" },
        metric: { type: "string", enum: ["dscr", "leverage", "current_ratio", "minimum_cash"] },
        operator: { type: "string", enum: ["gte", "lte", "gt", "lt", "eq"] },
        threshold: { type: "number" },
        frequency: { type: "string", enum: ["monthly", "quarterly", "annually"] },
        grace_period_days: { type: "number", default: 0 },
      },
      required: ["deal_id", "name", "metric", "operator", "threshold", "frequency"],
    },
  },

  test_covenant: {
    description: "Test a covenant against current financial data",
    inputSchema: {
      type: "object",
      properties: {
        covenant_id: { type: "string" },
        as_of_date: { type: "string", description: "ISO date for test" },
      },
      required: ["covenant_id"],
    },
  },

  // === FACILITIES ===

  create_facility: {
    description: "Create a loan facility on a deal",
    inputSchema: {
      type: "object",
      properties: {
        deal_id: { type: "string" },
        facility_type: { type: "string", enum: ["term_loan", "revolver", "delayed_draw"] },
        amount: { type: "number" },
        currency: { type: "string", default: "USD" },
        interest_rate_type: { type: "string", enum: ["fixed", "floating"] },
        interest_rate_value: { type: "number", description: "Rate as decimal (0.05 = 5%)" },
        interest_rate_spread: { type: "number", description: "Spread over base rate" },
        term_months: { type: "number" },
        amortization: { type: "string", enum: ["amortizing", "bullet", "interest_only"] },
      },
      required: ["deal_id", "facility_type", "amount"],
    },
  },

  // === MONITORING ===

  ingest_bank_transactions: {
    description: "Ingest bank statement transactions for monitoring",
    inputSchema: {
      type: "object",
      properties: {
        deal_id: { type: "string" },
        entity_id: { type: "string" },
        account_identifier: { type: "string" },
        transactions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              date: { type: "string" },
              description: { type: "string" },
              amount: { type: "number" },
              balance: { type: "number" },
            },
          },
        },
      },
      required: ["deal_id", "entity_id", "transactions"],
    },
  },

  get_liquidity_analysis: {
    description: "Get liquidity analysis based on bank transactions",
    inputSchema: {
      type: "object",
      properties: {
        deal_id: { type: "string" },
        days: { type: "number", default: 90 },
      },
      required: ["deal_id"],
    },
  },

  // === AUDIT ===

  get_audit_trail: {
    description: "Get audit trail for a deal showing all changes",
    inputSchema: {
      type: "object",
      properties: {
        deal_id: { type: "string" },
        limit: { type: "number", default: 50 },
      },
      required: ["deal_id"],
    },
  },
};
```

---

## Resources

Resources are read-only data the AI can access for context.

```typescript
const resources = {
  // Deal details
  "deal://{deal_id}": {
    description: "Full deal details including stage, entities, and metadata",
    mimeType: "application/json",
  },

  // Deal documents list
  "deal://{deal_id}/documents": {
    description: "List of documents attached to the deal",
    mimeType: "application/json",
  },

  // Specific document content
  "document://{document_id}": {
    description: "Document metadata and content",
    mimeType: "application/json", // includes base64 content
  },

  // Financial spreads
  "deal://{deal_id}/spreads": {
    description: "Financial spread data for the deal",
    mimeType: "application/json",
  },

  // Covenant status
  "deal://{deal_id}/covenants": {
    description: "Covenants and their current compliance status",
    mimeType: "application/json",
  },

  // Entity details
  "entity://{entity_id}": {
    description: "Entity details including relationships",
    mimeType: "application/json",
  },

  // Bank transaction summary
  "deal://{deal_id}/transactions": {
    description: "Recent bank transactions and liquidity summary",
    mimeType: "application/json",
  },

  // Audit trail
  "deal://{deal_id}/audit": {
    description: "Audit trail of all changes to the deal",
    mimeType: "application/json",
  },
};
```

---

## Prompts (Skills Integration)

MCP prompts map to the Skills system:

```typescript
const prompts = {
  "underwriting-checklist": {
    description: "Standard due diligence checklist for commercial loan underwriting",
    arguments: [
      { name: "deal_id", description: "Deal to underwrite", required: true },
    ],
  },

  "covenant-analysis": {
    description: "Analyze and test financial covenants",
    arguments: [
      { name: "deal_id", description: "Deal to analyze", required: true },
    ],
  },

  "deal-scoring": {
    description: "Score a deal using the standard risk matrix",
    arguments: [
      { name: "deal_id", description: "Deal to score", required: true },
    ],
  },
};
```

---

## Implementation

### MCP Server Setup

```typescript
// packages/mcp/src/server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

export function createMcpServer(services: Services) {
  const server = new Server(
    {
      name: "open-los",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    }
  );

  // Register tool handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: Object.entries(tools).map(([name, def]) => ({
      name,
      description: def.description,
      inputSchema: def.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Route to appropriate service
    const result = await executeToolCall(services, name, args);

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  });

  // Register resource handlers
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: Object.entries(resources).map(([uri, def]) => ({
      uri,
      name: uri,
      description: def.description,
      mimeType: def.mimeType,
    })),
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    const data = await readResource(services, uri);

    return {
      contents: [{
        uri,
        mimeType: "application/json",
        text: JSON.stringify(data, null, 2),
      }],
    };
  });

  // Register prompt handlers (skills)
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: Object.entries(prompts).map(([name, def]) => ({
      name,
      description: def.description,
      arguments: def.arguments,
    })),
  }));

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const skill = await services.skill.load(name);
    const deal = args?.deal_id ? await services.deal.getById(args.deal_id) : null;

    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: buildPromptWithContext(skill, deal),
          },
        },
      ],
    };
  });

  return server;
}

// Tool execution router
async function executeToolCall(services: Services, name: string, args: unknown) {
  switch (name) {
    case "create_deal":
      return services.deal.create(args as CreateDealInput, "mcp-agent");
    case "get_deal":
      return services.deal.getById((args as { deal_id: string }).deal_id);
    case "advance_deal_stage":
      return services.stage.transition(
        (args as any).deal_id,
        (args as any).to_stage,
        { rationale: (args as any).rationale, override: (args as any).override },
        "mcp-agent"
      );
    // ... other tools
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// Resource reader
async function readResource(services: Services, uri: string) {
  const [type, id, ...rest] = uri.replace("://", "/").split("/").filter(Boolean);

  switch (type) {
    case "deal":
      if (rest[0] === "documents") {
        return services.document.listByDeal(id);
      } else if (rest[0] === "spreads") {
        return services.spread.listByDeal(id);
      } else if (rest[0] === "covenants") {
        return services.covenant.listByDeal(id);
      }
      return services.deal.getById(id);
    case "document":
      return services.document.getById(id);
    case "entity":
      return services.entity.getById(id);
    default:
      throw new Error(`Unknown resource type: ${type}`);
  }
}
```

### Actor Identification

The MCP server passes actor information to all service calls:

```typescript
// Extract actor from MCP request metadata or use default
function getActor(request: McpRequest): string {
  // MCP doesn't have standard actor headers, so we use metadata or default
  return request.metadata?.actor || "mcp-agent";
}

function getActorType(request: McpRequest): string {
  return "ai"; // MCP requests are always from AI
}
```

### Running the Server

```typescript
// packages/mcp/src/index.ts
import { createMcpServer } from "./server.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServices } from "@open-los/core";

async function main() {
  const services = await createServices({ dbPath: process.env.DB_PATH });
  const server = createMcpServer(services);
  const transport = new StdioServerTransport();

  await server.connect(transport);
}

main().catch(console.error);
```

### Package Structure

```
packages/mcp/
  package.json
  tsconfig.json
  src/
    index.ts          # Entry point
    server.ts         # MCP server setup
    tools/
      index.ts        # Tool definitions
      deal.ts         # Deal-related tools
      entity.ts       # Entity tools
      document.ts     # Document tools
      financial.ts    # Spread/covenant tools
    resources/
      index.ts        # Resource handlers
    prompts/
      index.ts        # Prompt/skill handlers
```

---

## Claude Desktop Configuration

```json
{
  "mcpServers": {
    "open-los": {
      "command": "node",
      "args": ["./packages/mcp/dist/index.js"],
      "env": {
        "DB_PATH": "./data/los.db"
      }
    }
  }
}
```

---

## Implementation Order

1. **Phase 1: Package Setup**
   - Create `packages/mcp` with package.json, tsconfig
   - Add MCP SDK dependency
   - Basic server skeleton

2. **Phase 2: Core Tools**
   - Implement deal tools (create, get, list, advance)
   - Implement entity tools (create, link, relationships)
   - Test with Claude Desktop

3. **Phase 3: Resources**
   - Implement resource handlers
   - Add deal, document, entity resources

4. **Phase 4: Financial Tools**
   - Spread creation tools
   - Covenant tools
   - Ratio calculation

5. **Phase 5: Skills/Prompts**
   - Integrate with SkillService
   - Implement prompt handlers

6. **Phase 6: Monitoring Tools**
   - Bank transaction ingestion
   - Liquidity analysis
   - Alert tools

---

## Out of Scope (Future)

| Feature | Reason to Defer |
|---------|-----------------|
| SSE transport | Start with stdio for simplicity |
| Authentication | Local server, trust the caller |
| Rate limiting | Not needed for local usage |
| Batch operations | Add based on usage patterns |
| Streaming responses | MCP doesn't support well yet |
