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

export function registerFacilityCommands(program: Command): void {
  const facility = program
    .command('facility')
    .description('Manage loan facilities');

  // Create facility
  facility
    .command('create <dealId>')
    .description('Create a new facility')
    .requiredOption('-t, --type <type>', 'Facility type (term_loan/revolver/letter_of_credit)')
    .requiredOption('-a, --amount <amount>', 'Facility amount (supports k/m/b suffixes)')
    .option('-c, --currency <code>', 'Currency code (default: USD)')
    .option('--rate-type <type>', 'Interest rate type (fixed/floating)')
    .option('--rate <value>', 'Interest rate value (as decimal, e.g., 0.055 for 5.5%)')
    .option('--spread <value>', 'Interest rate spread (for floating)')
    .option('--term <months>', 'Term in months')
    .action(async (dealId, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const data: Record<string, unknown> = {
          type: opts.type,
          amount: parseAmount(opts.amount),
        };

        if (opts.currency) data.currency = opts.currency;
        if (opts.rateType) data.interest_rate_type = opts.rateType;
        if (opts.rate) data.interest_rate_value = parseFloat(opts.rate);
        if (opts.spread) data.interest_rate_spread = parseFloat(opts.spread);
        if (opts.term) data.term_months = parseInt(opts.term);

        const result = await client.createFacility(dealId, data as Parameters<typeof client.createFacility>[1]);

        if (globals.format === 'table') {
          success(`Created facility ${result.id}`);
        }
        console.log(formatOutput(result, globals.format));
      } catch (err) {
        handleError(err);
      }
    });

  // List facilities
  facility
    .command('list <dealId>')
    .description('List facilities for a deal')
    .action(async (dealId, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const result = await client.listFacilities(dealId);

        if (globals.format === 'table') {
          console.log(formatOutput(result.facilities, globals.format));
        } else {
          console.log(formatOutput(result, globals.format));
        }
      } catch (err) {
        handleError(err);
      }
    });

  // Get facility
  facility
    .command('get <dealId> <facilityId>')
    .description('Get facility details')
    .action(async (dealId, facilityId, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const result = await client.getFacility(dealId, facilityId);
        console.log(formatOutput(result, globals.format));
      } catch (err) {
        handleError(err);
      }
    });

  // Update facility
  facility
    .command('update <dealId> <facilityId>')
    .description('Update facility fields')
    .option('-a, --amount <amount>', 'Facility amount')
    .option('-c, --currency <code>', 'Currency code')
    .option('--rate-type <type>', 'Interest rate type')
    .option('--rate <value>', 'Interest rate value')
    .option('--spread <value>', 'Interest rate spread')
    .option('--term <months>', 'Term in months')
    .option('-s, --status <status>', 'Status (proposed/approved/active/closed)')
    .action(async (dealId, facilityId, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const data: Record<string, unknown> = {};

        if (opts.amount) data.amount = parseAmount(opts.amount);
        if (opts.currency) data.currency = opts.currency;
        if (opts.rateType) data.interest_rate_type = opts.rateType;
        if (opts.rate) data.interest_rate_value = parseFloat(opts.rate);
        if (opts.spread) data.interest_rate_spread = parseFloat(opts.spread);
        if (opts.term) data.term_months = parseInt(opts.term);
        if (opts.status) data.status = opts.status;

        const result = await client.updateFacility(dealId, facilityId, data);

        if (globals.format === 'table') {
          success(`Updated facility ${facilityId}`);
        }
        console.log(formatOutput(result, globals.format));
      } catch (err) {
        handleError(err);
      }
    });

  // Delete facility
  facility
    .command('delete <dealId> <facilityId>')
    .description('Delete a facility')
    .action(async (dealId, facilityId, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        await client.deleteFacility(dealId, facilityId);
        success(`Deleted facility ${facilityId}`);
      } catch (err) {
        handleError(err);
      }
    });
}
