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

export function registerDepositCommands(program: Command): void {
  const deposit = program
    .command('deposit')
    .description('Manage deposit accounts');

  // Create deposit account
  deposit
    .command('create')
    .description('Create a new deposit account')
    .requiredOption('-t, --type <type>', 'Account type (demand_deposit/time_deposit/certificate_of_deposit)')
    .requiredOption('--holder <name>', 'Account holder name')
    .option('--holder-id <id>', 'Account holder entity ID')
    .option('-c, --currency <code>', 'Currency code (default: USD)')
    .option('-b, --balance <amount>', 'Initial balance')
    .option('--rate <value>', 'Interest rate (as decimal)')
    .option('--maturity <date>', 'Maturity date (ISO format)')
    .option('--custom <json>', 'Custom fields as JSON')
    .action(async (opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const data: Record<string, unknown> = {
          type: opts.type,
          account_holder: opts.holder,
        };

        if (opts.holderId) data.account_holder_id = opts.holderId;
        if (opts.currency) data.currency = opts.currency;
        if (opts.balance) data.balance = parseAmount(opts.balance);
        if (opts.rate) data.interest_rate = parseFloat(opts.rate);
        if (opts.maturity) data.maturity_date = opts.maturity;
        if (opts.custom) data.custom_fields = JSON.parse(opts.custom);

        const result = await client.createDeposit(data);

        if (globals.format === 'table') {
          success(`Created deposit account ${(result as Record<string, unknown>).id}`);
        }
        console.log(formatOutput(result, globals.format));
      } catch (err) {
        handleError(err);
      }
    });

  // List deposit accounts
  deposit
    .command('list')
    .description('List deposit accounts')
    .action(async (opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const result = await client.listDeposits();

        if (globals.format === 'table') {
          console.log(formatOutput(result, globals.format));
        } else {
          console.log(formatOutput(result, globals.format));
        }
      } catch (err) {
        handleError(err);
      }
    });

  // Get deposit account
  deposit
    .command('get <id>')
    .description('Get deposit account details')
    .action(async (id, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const result = await client.getDeposit(id);
        console.log(formatOutput(result, globals.format));
      } catch (err) {
        handleError(err);
      }
    });
}
