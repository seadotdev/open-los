/**
 * Shadow CLI Commands
 *
 * Registers the `los shadow` command group that provides
 * system-of-record abstraction for lenders.
 *
 * Usage:
 *   los shadow connect salesforce --instance-url https://myorg.my.salesforce.com
 *   los shadow discover
 *   los shadow sync --dry-run
 *   los shadow status
 *   los shadow diff
 */

import { Command } from "commander";

export function registerShadowCommands(program: Command): void {
  const shadow = program
    .command("shadow")
    .description("Shadow mode — sync with external systems of record (Salesforce, HubSpot, nCino)");

  // ── Connection Management ─────────────────────────────────────

  const connect = shadow
    .command("connect <adapter>")
    .description("Connect to an external system of record")
    .option("--instance-url <url>", "Instance URL (Salesforce/nCino)")
    .option("--client-id <id>", "OAuth client ID")
    .option("--client-secret <secret>", "OAuth client secret")
    .option("--api-key <key>", "API key (HubSpot)")
    .option("--access-token <token>", "Access token (HubSpot)")
    .option("--username <user>", "Username (Salesforce JWT)")
    .option("--private-key <path>", "Private key path (Salesforce JWT)")
    .option("--namespace <ns>", "nCino namespace (default: LLC_BI)")
    .option("--name <name>", "Connection name")
    .option("--enable-cdc", "Enable Change Data Capture (Salesforce)")
    .option("--enable-webhooks", "Enable webhook subscriptions (HubSpot)")
    .action(async (adapter: string, opts) => {
      console.log(`Connecting to ${adapter}...`);
      console.log(`Adapter: ${adapter}`);
      console.log(`Options: ${JSON.stringify(opts, null, 2)}`);

      // TODO: Implementation
      // 1. Validate adapter type
      // 2. Build config from options
      // 3. Initialize adapter
      // 4. Test connection
      // 5. Save connection profile to local config
      // 6. Run initial schema discovery

      console.log(`\nConnection saved. Run \`los shadow discover\` to map fields.`);
    });

  shadow
    .command("test")
    .description("Test the active connection")
    .option("--connection <id>", "Connection ID (default: active)")
    .action(async (opts) => {
      console.log("Testing connection...");
      // TODO: Load connection, initialize adapter, call testConnection()
    });

  shadow
    .command("connections")
    .description("List all configured connections")
    .action(async () => {
      console.log("Configured connections:");
      // TODO: Load and display all saved connection profiles
    });

  shadow
    .command("disconnect <id>")
    .description("Remove a connection")
    .action(async (id: string) => {
      console.log(`Disconnecting ${id}...`);
      // TODO: Remove connection profile and sync state
    });

  // ── Schema Discovery ──────────────────────────────────────────

  shadow
    .command("discover")
    .description("Discover external schema and propose field mappings")
    .option("--connection <id>", "Connection ID (default: active)")
    .option("--object <name>", "Discover specific object type only")
    .option("--sample <n>", "Sample N records for analysis", "100")
    .action(async (opts) => {
      console.log("Discovering external schema...");
      // TODO: Implementation
      // 1. Load connection & adapter
      // 2. Call adapter.discoverSchema()
      // 3. For each object, call suggestEntityMapping() and suggestFieldMapping()
      // 4. Display mapping proposals with confidence scores
      // 5. Save proposals for `los shadow mappings` review

      console.log("\nSchema discovery complete.");
      console.log("Run `los shadow mappings` to review and accept field mappings.");
    });

  // ── Mapping Management ────────────────────────────────────────

  const mappings = shadow
    .command("mappings")
    .description("Review and manage field mappings");

  mappings
    .command("list")
    .description("List current field mappings")
    .option("--connection <id>", "Connection ID")
    .option("--entity <type>", "Filter by target entity")
    .option("--pending", "Show only unconfirmed mappings")
    .action(async (opts) => {
      console.log("Field mappings:");
      // TODO: Display mapping table with source → target + confidence
    });

  mappings
    .command("accept")
    .description("Accept proposed mappings")
    .option("--all-high-confidence", "Accept all mappings with confidence >= 0.8")
    .option("--id <id>", "Accept a specific mapping by ID")
    .action(async (opts) => {
      // TODO: Mark mappings as confirmed
    });

  mappings
    .command("edit <source>")
    .description("Edit a field mapping")
    .option("--target <field>", "Target Open LOS field (e.g., deals.purpose)")
    .option("--transform <type>", "Transform type (e.g., stage_normalize, to_minor_units)")
    .option("--direction <dir>", "Sync direction (inbound/outbound/bidirectional)")
    .option("--disable", "Disable this mapping")
    .action(async (source: string, opts) => {
      console.log(`Editing mapping for ${source}...`);
      // TODO: Update mapping in connection profile
    });

  mappings
    .command("remove <id>")
    .description("Remove a field mapping")
    .action(async (id: string) => {
      console.log(`Removing mapping ${id}...`);
      // TODO: Delete mapping from connection profile
    });

  // ── Sync Operations ───────────────────────────────────────────

  shadow
    .command("sync")
    .description("Sync data between Open LOS and the external system")
    .option("--connection <id>", "Connection ID (default: active)")
    .option("--dry-run", "Preview changes without executing")
    .option("--incremental", "Only sync changes since last sync")
    .option("--object <name>", "Sync specific object type only")
    .option("--entity <type>", "Sync specific entity type only")
    .option("--since <date>", "Sync records modified since date (ISO format)")
    .option("--direction <dir>", "Sync direction (inbound/outbound/bidirectional)", "inbound")
    .option("--limit <n>", "Maximum records to sync")
    .action(async (opts) => {
      const mode = opts.dryRun ? "DRY RUN" : "LIVE";
      console.log(`Sync [${mode}] — direction: ${opts.direction}`);

      // TODO: Implementation
      // 1. Load connection, adapter, mappings
      // 2. Generate sync plan (plan.ts)
      // 3. Display plan summary
      // 4. If not dry-run, execute the plan
      // 5. Update sync state
      // 6. Display results

      if (opts.dryRun) {
        console.log("\nDry run complete. No changes were made.");
        console.log("Remove --dry-run to execute the sync.");
      }
    });

  // ── Status & Inspection ───────────────────────────────────────

  shadow
    .command("status")
    .description("Show shadow sync status")
    .option("--connection <id>", "Connection ID (default: all)")
    .action(async (opts) => {
      // TODO: Implementation
      // Display:
      // - Connection details and health
      // - Last sync time
      // - Record counts by entity
      // - Pending inbound/outbound changes
      // - Conflict count
      // - Mapping coverage percentage
      // - Enriched fields (computed by Open LOS but not in SoR)

      console.log("Shadow Status");
      console.log("═".repeat(50));
      console.log("Connection:  (not configured)");
      console.log("Last sync:   —");
      console.log("Records:     0 deals | 0 entities | 0 documents");
      console.log("Pending:     0 inbound | 0 outbound");
      console.log("Conflicts:   0");
      console.log("Coverage:    0% fields mapped");
    });

  shadow
    .command("diff")
    .description("Show differences between shadow and source system")
    .option("--connection <id>", "Connection ID")
    .option("--entity <type>", "Filter by entity type")
    .argument("[id]", "Specific record ID (external or internal)")
    .action(async (id, opts) => {
      // TODO: Implementation
      // For each record (or a specific record):
      // - Fetch current state from external system
      // - Compare against local shadow copy
      // - Display field-level diff table
      // - Highlight enrichments (fields only in Open LOS)

      if (id) {
        console.log(`Diff for record ${id}:`);
      } else {
        console.log("Diff summary (all records):");
      }
      console.log("(no connection configured)");
    });

  shadow
    .command("conflicts")
    .description("List and resolve sync conflicts")
    .option("--connection <id>", "Connection ID")
    .option("--resolve <strategy>", "Resolve all with strategy (keep_external/keep_internal/keep_newest)")
    .action(async (opts) => {
      console.log("Sync conflicts:");
      // TODO: Display conflict list with resolution options
    });

  // ── Shadow Data Operations ────────────────────────────────────

  const deal = shadow
    .command("deal")
    .description("Work with shadowed deals");

  deal
    .command("list")
    .description("List deals from the shadow ledger")
    .option("-s, --stage <stage>", "Filter by stage")
    .option("-l, --limit <n>", "Limit results", "20")
    .action(async (opts) => {
      // TODO: Query shadow ledger for deals (with provenance data)
      console.log("Shadow deals:");
    });

  deal
    .command("get <id>")
    .description("Get a deal from the shadow ledger (by external or internal ID)")
    .action(async (id: string) => {
      // TODO: Look up by external ID or internal ID
      // Display deal with provenance annotations
      console.log(`Shadow deal ${id}:`);
    });

  // ── Push Operations (Phase 3) ─────────────────────────────────

  shadow
    .command("push")
    .description("Push changes from Open LOS back to the system of record")
    .option("--connection <id>", "Connection ID")
    .option("--all-pending", "Push all pending outbound changes")
    .argument("[entity] [id]", "Push a specific record")
    .action(async (entity, id, opts) => {
      // TODO: Implementation
      // 1. Identify outbound changes
      // 2. Map canonical → external fields
      // 3. Push via adapter.pushRecord()
      // 4. Update sync state

      console.log("Push requires write-back phase (phase 3). Current phase: mirror");
    });

  // ── Analytics / Value Proof ───────────────────────────────────

  const analyze = shadow
    .command("analyze")
    .description("Run analytics on shadowed data to prove value");

  analyze
    .command("pipeline")
    .description("Pipeline health metrics from shadowed data")
    .action(async () => {
      // TODO: Implementation
      // - Total deal count by stage
      // - Average time per stage
      // - Conversion rates
      // - Pipeline velocity
      // - Missing data flags

      console.log("Pipeline Analysis (shadow data)");
      console.log("═".repeat(50));
      console.log("(requires synced data — run `los shadow sync` first)");
    });

  analyze
    .command("portfolio")
    .description("Portfolio risk summary from shadowed data")
    .action(async () => {
      // TODO: Implementation
      // - Total exposure
      // - Concentration by industry/geography
      // - Covenant health (if spreads available)
      // - Stale data warnings

      console.log("Portfolio Risk Summary (shadow data)");
      console.log("═".repeat(50));
      console.log("(requires synced data — run `los shadow sync` first)");
    });

  analyze
    .command("deal <id>")
    .description("Deep analysis of a single shadowed deal")
    .action(async (id: string) => {
      // TODO: Aggregate all data for this deal across sources
      console.log(`Deal Analysis: ${id}`);
    });

  shadow
    .command("report")
    .description("Generate a value-proof report comparing shadow vs. source system")
    .option("--format <fmt>", "Output format (text/json/markdown)", "text")
    .action(async (opts) => {
      // TODO: Implementation
      // Show:
      // - Data completeness improvement (source vs. enriched)
      // - Fields added by Open LOS that don't exist in SoR
      // - Deals with issues (covenant warnings, missing docs)
      // - Missing documents
      // - Stale data

      console.log("Shadow CLI Value Report");
      console.log("═".repeat(50));
      console.log("(requires synced data — run `los shadow sync` first)");
    });
}
