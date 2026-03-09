import { Command } from 'commander';
import { getClient } from '../client.js';
import {
  formatOutput,
  handleError,
  success,
  parseAmount,
  getGlobalOptions,
  type GlobalOptions,
} from '../utils.js';

export function registerDealCommands(program: Command): void {
  const deal = program
    .command('deal')
    .description('Manage lending deals');

  // Create deal
  deal
    .command('create')
    .description('Create a new deal')
    .requiredOption('-b, --borrower <name>', 'Borrower name')
    .option('-j, --jurisdiction <code>', 'Jurisdiction (e.g., UK, US)')
    .option('-a, --amount <amount>', 'Requested amount (supports k/m/b suffixes)')
    .option('-p, --purpose <purpose>', 'Loan purpose')
    .option('--custom <json>', 'Custom fields as JSON')
    .action(async (opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const data: Record<string, unknown> = {
          borrower_name: opts.borrower,
        };

        if (opts.jurisdiction) data.jurisdiction = opts.jurisdiction;
        if (opts.amount) data.requested_amount = parseAmount(opts.amount);
        if (opts.purpose) data.purpose = opts.purpose;
        if (opts.custom) data.custom_fields = JSON.parse(opts.custom);

        const result = await client.createDeal(data as Parameters<typeof client.createDeal>[0]);

        if (globals.format === 'table') {
          success(`Created deal ${result.id}`);
        }
        console.log(formatOutput(result, globals.format));
      } catch (err) {
        handleError(err);
      }
    });

  // List deals
  deal
    .command('list')
    .description('List deals')
    .option('-s, --stage <stage>', 'Filter by stage')
    .option('-l, --limit <n>', 'Limit results', '20')
    .option('-c, --cursor <cursor>', 'Pagination cursor')
    .action(async (opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const result = await client.listDeals({
          stage: opts.stage,
          limit: parseInt(opts.limit),
          cursor: opts.cursor,
        });

        if (globals.format === 'table') {
          console.log(formatOutput(result.deals, globals.format));
          if (result.next_cursor) {
            console.log(`\nNext cursor: ${result.next_cursor}`);
          }
        } else {
          console.log(formatOutput(result, globals.format));
        }
      } catch (err) {
        handleError(err);
      }
    });

  // Get deal
  deal
    .command('get <id>')
    .description('Get deal details')
    .action(async (id, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const result = await client.getDeal(id);
        console.log(formatOutput(result, globals.format));
      } catch (err) {
        handleError(err);
      }
    });

  // Update deal
  deal
    .command('update <id>')
    .description('Update deal fields')
    .option('-b, --borrower <name>', 'Borrower name')
    .option('-j, --jurisdiction <code>', 'Jurisdiction')
    .option('-a, --amount <amount>', 'Requested amount')
    .option('-p, --purpose <purpose>', 'Loan purpose')
    .option('--assigned-to <user>', 'Assign to user')
    .option('--outcome <outcome>', 'Origination outcome (reject/need_info/proceed/refer)')
    .option('--primary-entity <id>', 'Primary entity ID')
    .option('--custom <json>', 'Custom fields as JSON')
    .action(async (id, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const data: Record<string, unknown> = {};

        if (opts.borrower) data.borrower_name = opts.borrower;
        if (opts.jurisdiction) data.jurisdiction = opts.jurisdiction;
        if (opts.amount) data.requested_amount = parseAmount(opts.amount);
        if (opts.purpose) data.purpose = opts.purpose;
        if (opts.assignedTo) data.assigned_to = opts.assignedTo;
        if (opts.outcome) data.origination_outcome = opts.outcome;
        if (opts.primaryEntity) data.primary_entity_id = opts.primaryEntity;
        if (opts.custom) data.custom_fields = JSON.parse(opts.custom);

        const result = await client.updateDeal(id, data);

        if (globals.format === 'table') {
          success(`Updated deal ${id}`);
        }
        console.log(formatOutput(result, globals.format));
      } catch (err) {
        handleError(err);
      }
    });

  // Advance stage
  deal
    .command('advance <id>')
    .description('Advance deal to the next stage')
    .requiredOption('-t, --to <stage>', 'Target stage (origination/underwriting/closing/monitoring)')
    .option('-r, --rationale <text>', 'Rationale for transition')
    .option('--override', 'Override failed guards')
    .option('--override-rationale <text>', 'Rationale for override')
    .action(async (id, opts, cmd) => {
      try {
        if (opts.override && !opts.overrideRationale) {
          throw new Error('--override-rationale is required when using --override');
        }

        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const result = await client.advanceStage(id, {
          to_stage: opts.to,
          rationale: opts.rationale,
          override: opts.override,
          override_rationale: opts.overrideRationale,
        });

        if (globals.format === 'table') {
          success(`Advanced deal to ${opts.to}`);
        }
        console.log(formatOutput(result, globals.format));
      } catch (err) {
        handleError(err);
      }
    });

  // Link entity to deal
  deal
    .command('link-entity <dealId> <entityId>')
    .description('Link an entity to a deal as the primary entity')
    .action(async (dealId, entityId, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const result = await client.updateDeal(dealId, {
          primary_entity_id: entityId,
        });

        if (globals.format === 'table') {
          success(`Linked entity ${entityId} to deal ${dealId}`);
        }
        console.log(formatOutput(result, globals.format));
      } catch (err) {
        handleError(err);
      }
    });

  // Evaluate deal
  deal
    .command('evaluate <id>')
    .description('Run underwriting evaluation on a deal')
    .option('-m, --mode <mode>', 'Evaluation mode (full or rules_only)', 'rules_only')
    .option('--provider <provider>', 'LLM provider (anthropic/openrouter/openai/vercel)')
    .option('--allow-fallback', 'Allow rules fallback if LLM fails')
    .action(async (id, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const result = await client.evaluateDeal(id, {
          mode: opts.mode,
          provider: opts.provider,
          allow_rules_fallback: opts.allowFallback,
        });

        console.log(formatOutput(result, globals.format));
      } catch (err) {
        handleError(err);
      }
    });

  // Check guards
  deal
    .command('check-guards <id>')
    .description('Check stage guard requirements without advancing')
    .requiredOption('-t, --to <stage>', 'Target stage to check guards for')
    .action(async (id, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const result = await client.checkGuards(id, opts.to);

        if (globals.format === 'table') {
          const checklist = result.checklist || [];
          const allSatisfied = checklist.every((c: { satisfied: boolean }) => c.satisfied);
          if (allSatisfied) {
            success(`All guards satisfied for stage ${opts.to}`);
          } else {
            const unsatisfied = checklist.filter((c: { satisfied: boolean }) => !c.satisfied);
            console.error(`Unsatisfied guards for ${opts.to}:`);
            for (const guard of unsatisfied) {
              console.error(`  ✗ ${guard.item}`);
            }
          }
          console.log(formatOutput(checklist, globals.format));
        } else {
          console.log(formatOutput(result, globals.format));
        }
      } catch (err) {
        handleError(err);
      }
    });

  // Stage history
  deal
    .command('history <id>')
    .description('Show stage transition history')
    .action(async (id, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const result = await client.listStageTransitions(id);

        if (globals.format === 'table') {
          console.log(formatOutput(result.transitions, globals.format));
        } else {
          console.log(formatOutput(result, globals.format));
        }
      } catch (err) {
        handleError(err);
      }
    });
}
