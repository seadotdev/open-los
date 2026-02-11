import { Command } from 'commander';
import { getClient } from '../client.js';
import {
  formatOutput,
  handleError,
  success,
  getGlobalOptions,
  type GlobalOptions,
} from '../utils.js';

export function registerRelationshipCommands(program: Command): void {
  const relationship = program
    .command('relationship')
    .description('Manage entity relationships');

  // Create relationship
  relationship
    .command('create')
    .description('Create a relationship between entities')
    .requiredOption('-f, --from <id>', 'Source entity ID')
    .requiredOption('-t, --to <id>', 'Target entity ID')
    .requiredOption('--type <type>', 'Relationship type (owns/guarantees/directs)')
    .option('-p, --pct <percent>', 'Ownership percentage (for owns type)')
    .option('--metadata <json>', 'Additional metadata as JSON')
    .action(async (opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const data: Record<string, unknown> = {
          from_entity_id: opts.from,
          to_entity_id: opts.to,
          type: opts.type,
        };

        if (opts.pct) data.ownership_pct = parseFloat(opts.pct);
        if (opts.metadata) data.metadata = JSON.parse(opts.metadata);

        const result = await client.createRelationship(data as Parameters<typeof client.createRelationship>[0]);

        if (globals.format === 'table') {
          success(`Created relationship ${result.id}`);
        }
        console.log(formatOutput(result, globals.format));
      } catch (err) {
        handleError(err);
      }
    });

  // Get borrower group
  program
    .command('borrower-group <dealId>')
    .description('Get the borrower group hierarchy for a deal')
    .action(async (dealId, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const result = await client.getBorrowerGroup(dealId);
        console.log(formatOutput(result, globals.format));
      } catch (err) {
        handleError(err);
      }
    });
}
