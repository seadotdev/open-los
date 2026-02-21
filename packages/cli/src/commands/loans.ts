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

export function registerLoanCommands(program: Command): void {
  const loan = program
    .command('loan')
    .description('Manage loan accounts and transactions');

  // Create loan
  loan
    .command('create <dealId>')
    .description('Create a new loan account for a deal')
    .requiredOption('-a, --amount <amount>', 'Loan amount (supports k/m/b suffixes)')
    .option('-f, --facility <id>', 'Facility ID')
    .option('--rate <value>', 'Interest rate (as decimal)')
    .option('--term <months>', 'Term in months')
    .option('--holder <id>', 'Account holder entity ID')
    .option('--entity <id>', 'Account holder entity ID (alias for --holder)')
    .action(async (dealId, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const accountHolderId = opts.entity ?? opts.holder;
        const data: Record<string, unknown> = {
          loan_amount: parseAmount(opts.amount),
        };

        if (opts.facility) data.facility_id = opts.facility;
        if (opts.rate) data.interest_rate = parseFloat(opts.rate);
        if (opts.term) data.term_months = parseInt(opts.term);
        if (accountHolderId) data.account_holder_id = accountHolderId;

        const result = await client.createLoanForDeal(dealId, data as Parameters<typeof client.createLoanForDeal>[1]);

        if (globals.format === 'table') {
          success(`Created loan ${result.id}`);
        }
        console.log(formatOutput(result, globals.format));
      } catch (err) {
        handleError(err);
      }
    });

  // Create loan from facility
  loan
    .command('from-facility <facilityId>')
    .description('Create a loan account from an approved facility')
    .option('-a, --amount <amount>', 'Override loan amount')
    .action(async (facilityId, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const data: Record<string, unknown> = {};
        if (opts.amount) data.loan_amount = parseAmount(opts.amount);

        const result = await client.createLoanFromFacility(facilityId, data as Parameters<typeof client.createLoanFromFacility>[1]);

        if (globals.format === 'table') {
          success(`Created loan ${result.id} from facility`);
        }
        console.log(formatOutput(result, globals.format));
      } catch (err) {
        handleError(err);
      }
    });

  // Get loan
  loan
    .command('get <id>')
    .description('Get loan account details')
    .action(async (id, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const result = await client.getLoan(id);
        console.log(formatOutput(result, globals.format));
      } catch (err) {
        handleError(err);
      }
    });

  // List loans for deal
  loan
    .command('list <dealId>')
    .description('List loan accounts for a deal')
    .action(async (dealId, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const result = await client.listLoansForDeal(dealId);

        if (globals.format === 'table') {
          console.log(formatOutput(result.loans, globals.format));
        } else {
          console.log(formatOutput(result, globals.format));
        }
      } catch (err) {
        handleError(err);
      }
    });

  // Get balance
  loan
    .command('balance <id>')
    .description('Get loan account balance')
    .action(async (id, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const result = await client.getLoanBalance(id);
        console.log(formatOutput(result, globals.format));
      } catch (err) {
        handleError(err);
      }
    });

  // Get schedule
  loan
    .command('schedule <id>')
    .description('Get loan repayment schedule')
    .action(async (id, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const result = await client.getLoanSchedule(id);

        if (globals.format === 'table') {
          console.log(formatOutput(result.schedule, globals.format));
        } else {
          console.log(formatOutput(result, globals.format));
        }
      } catch (err) {
        handleError(err);
      }
    });

  // Get arrears
  loan
    .command('arrears <id>')
    .description('Get loan arrears status')
    .action(async (id, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const result = await client.getLoanArrears(id);
        console.log(formatOutput(result, globals.format));
      } catch (err) {
        handleError(err);
      }
    });

  // Create transaction
  loan
    .command('transact <loanId>')
    .description('Create a loan transaction')
    .requiredOption('-t, --type <type>', 'Transaction type (APPROVAL/DISBURSEMENT/REPAYMENT/FEE/INTEREST_APPLIED/WRITE_OFF)')
    .option('-a, --amount <amount>', 'Transaction amount')
    .option('--value-date <date>', 'Value date (ISO format)')
    .option('-n, --notes <text>', 'Transaction notes')
    .action(async (loanId, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const data: Record<string, unknown> = {
          type: opts.type,
        };

        if (opts.amount) data.amount = parseAmount(opts.amount);
        if (opts.valueDate) data.value_date = opts.valueDate;
        if (opts.notes) data.notes = opts.notes;

        const result = await client.createLoanTransaction(loanId, data as Parameters<typeof client.createLoanTransaction>[1]);

        if (globals.format === 'table') {
          success(`Created transaction ${result.id}`);
        }
        console.log(formatOutput(result, globals.format));
      } catch (err) {
        handleError(err);
      }
    });

  // List transactions
  loan
    .command('transactions <loanId>')
    .description('List transactions for a loan')
    .action(async (loanId, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const result = await client.listLoanTransactions(loanId);

        if (globals.format === 'table') {
          console.log(formatOutput(result.transactions, globals.format));
        } else {
          console.log(formatOutput(result, globals.format));
        }
      } catch (err) {
        handleError(err);
      }
    });
}
