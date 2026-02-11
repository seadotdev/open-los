import { Command } from 'commander';
import { readFileSync } from 'fs';
import { getClient } from '../client.js';
import {
  formatOutput,
  handleError,
  success,
  getGlobalOptions,
  type GlobalOptions,
} from '../utils.js';

export function registerSpreadCommands(program: Command): void {
  const spread = program
    .command('spread')
    .description('Manage financial spreading and ratios');

  // Create spread
  spread
    .command('create <dealId>')
    .description('Create a financial spread from line items')
    .requiredOption('-p, --period <period>', 'Period identifier (e.g., FY2024, Q1-2024)')
    .option('-e, --entity <id>', 'Entity ID')
    .option('-f, --file <path>', 'JSON file with line items')
    .option('-i, --items <json>', 'Line items as JSON array')
    .action(async (dealId, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        let lineItems: Array<{ category: string; label: string; amount: number }>;

        if (opts.file) {
          const content = readFileSync(opts.file, 'utf-8');
          lineItems = JSON.parse(content);
        } else if (opts.items) {
          lineItems = JSON.parse(opts.items);
        } else {
          throw new Error('Either --file or --items must be specified');
        }

        const data: Record<string, unknown> = {
          period: opts.period,
          line_items: lineItems,
        };

        if (opts.entity) data.entity_id = opts.entity;

        const result = await client.createSpread(dealId, data as Parameters<typeof client.createSpread>[1]);

        if (globals.format === 'table') {
          success(`Created spread ${result.id}`);
          console.log('\nComputed ratios:');
        }
        console.log(formatOutput(result, globals.format));
      } catch (err) {
        handleError(err);
      }
    });

  // Get ratios
  spread
    .command('ratios <dealId>')
    .description('Get computed financial ratios for a deal')
    .action(async (dealId, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const result = await client.getRatios(dealId);

        if (globals.format === 'table') {
          console.log(formatOutput(result.ratios, globals.format));
        } else {
          console.log(formatOutput(result, globals.format));
        }
      } catch (err) {
        handleError(err);
      }
    });
}
