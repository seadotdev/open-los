import { Command } from 'commander';
import { getClient } from '../client.js';
import {
  formatOutput,
  handleError,
  success,
  getGlobalOptions,
  type GlobalOptions,
} from '../utils.js';

export function registerCovenantCommands(program: Command): void {
  const covenant = program
    .command('covenant')
    .description('Manage deal covenants');

  // Create covenant
  covenant
    .command('create <dealId>')
    .description('Create a new covenant')
    .requiredOption('-n, --name <name>', 'Covenant name')
    .requiredOption('--type <type>', 'Covenant type (financial/reporting/information)')
    .option('-m, --metric <metric>', 'Financial metric (e.g., dscr, current_ratio)')
    .option('-o, --operator <op>', 'Comparison operator (>=, <=, >, <, ==)')
    .option('-t, --threshold <value>', 'Threshold value')
    .option('-f, --frequency <freq>', 'Testing frequency (monthly/quarterly/annually)')
    .option('-g, --grace-days <days>', 'Grace period in days')
    .action(async (dealId, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const data: Record<string, unknown> = {
          name: opts.name,
          type: opts.type,
        };

        if (opts.metric) data.metric = opts.metric;
        if (opts.operator) data.operator = opts.operator;
        if (opts.threshold) data.threshold = parseFloat(opts.threshold);
        if (opts.frequency) data.frequency = opts.frequency;
        if (opts.graceDays) data.grace_period_days = parseInt(opts.graceDays);

        const result = await client.createCovenant(dealId, data as Parameters<typeof client.createCovenant>[1]);

        if (globals.format === 'table') {
          success(`Created covenant ${result.id}`);
        }
        console.log(formatOutput(result, globals.format));
      } catch (err) {
        handleError(err);
      }
    });

  // List covenants
  covenant
    .command('list <dealId>')
    .description('List covenants for a deal')
    .action(async (dealId, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const result = await client.listCovenants(dealId);

        if (globals.format === 'table') {
          console.log(formatOutput(result.covenants, globals.format));
        } else {
          console.log(formatOutput(result, globals.format));
        }
      } catch (err) {
        handleError(err);
      }
    });

  // Test covenants
  covenant
    .command('test <dealId>')
    .description('Test covenants against current data')
    .option('--ids <ids>', 'Comma-separated covenant IDs to test')
    .option('--as-of <date>', 'Test as of this date (ISO format)')
    .option('--period <period>', 'Test as of this period (e.g., FY2024)')
    .action(async (dealId, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const options: Record<string, unknown> = {};

        if (opts.ids) options.covenant_ids = opts.ids.split(',');
        if (opts.asOf) options.as_of = opts.asOf;
        if (opts.period) options.as_of_period = opts.period;

        const result = await client.testCovenants(dealId, options as Parameters<typeof client.testCovenants>[1]);

        if (globals.format === 'table') {
          console.log(formatOutput(result.results, globals.format));
        } else {
          console.log(formatOutput(result, globals.format));
        }
      } catch (err) {
        handleError(err);
      }
    });

  // Create waiver
  covenant
    .command('waive <covenantId>')
    .description('Create a waiver for a covenant')
    .requiredOption('-r, --reason <text>', 'Reason for waiver')
    .requiredOption('--approved-by <user>', 'Approver user ID')
    .requiredOption('--from <date>', 'Waiver valid from (ISO date)')
    .requiredOption('--until <date>', 'Waiver valid until (ISO date)')
    .action(async (covenantId, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const result = await client.createWaiver(covenantId, {
          reason: opts.reason,
          approved_by: opts.approvedBy,
          valid_from: opts.from,
          valid_until: opts.until,
        });

        if (globals.format === 'table') {
          success(`Created waiver ${result.id}`);
        }
        console.log(formatOutput(result, globals.format));
      } catch (err) {
        handleError(err);
      }
    });
}
