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

export function registerGateCommands(program: Command): void {
  const gate = program
    .command('gate')
    .description('Manage approval gates for one-way-door operations');

  // ─── Policy Management ──────────────────────────────────────────────────────

  const policy = gate
    .command('policy')
    .description('Manage gate policies');

  // Create policy
  policy
    .command('create')
    .description('Create a gate policy for an action')
    .requiredOption('-a, --action <action>', 'Action to gate (deal.stage_advance, loan.approve, loan.disburse, loan.write_off, loan.close, facility.approve, facility.delete, covenant.waive, deal.stage_override)')
    .requiredOption('-m, --mode <mode>', 'Gate mode (auto/human/dual)')
    .option('-l, --loan-line <type>', 'Loan line / facility type (term_loan/revolver/letter_of_credit)')
    .option('--min-amount <amount>', 'Minimum amount threshold (supports k/m/b suffixes)')
    .option('--stages <stages>', 'Comma-separated deal stages this gate applies to')
    .option('--approver-roles <roles>', 'Comma-separated approver roles')
    .option('--priority <n>', 'Priority (higher overrides lower)', '0')
    .action(async (opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const data: Record<string, unknown> = {
          action: opts.action,
          mode: opts.mode,
        };

        if (opts.loanLine) data.loan_line = opts.loanLine;
        if (opts.minAmount) data.min_amount = parseAmount(opts.minAmount);
        if (opts.stages) data.stages = opts.stages.split(',');
        if (opts.approverRoles) data.approver_roles = opts.approverRoles.split(',');
        if (opts.priority) data.priority = parseInt(opts.priority);

        const result = await client.createGatePolicy(data);

        if (globals.format === 'table') {
          success(`Created gate policy ${result.id}`);
        }
        console.log(formatOutput(result, globals.format));
      } catch (err) {
        handleError(err);
      }
    });

  // List policies
  policy
    .command('list')
    .description('List gate policies')
    .option('-a, --action <action>', 'Filter by action')
    .option('-l, --loan-line <type>', 'Filter by loan line')
    .option('-e, --enabled', 'Show only enabled policies')
    .action(async (opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const result = await client.listGatePolicies({
          action: opts.action,
          loan_line: opts.loanLine,
          enabled: opts.enabled ? true : undefined,
        });

        if (globals.format === 'table') {
          console.log(formatOutput(result.policies, globals.format));
        } else {
          console.log(formatOutput(result, globals.format));
        }
      } catch (err) {
        handleError(err);
      }
    });

  // Get policy
  policy
    .command('get <policyId>')
    .description('Get gate policy details')
    .action(async (policyId, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const result = await client.getGatePolicy(policyId);
        console.log(formatOutput(result, globals.format));
      } catch (err) {
        handleError(err);
      }
    });

  // Update policy
  policy
    .command('update <policyId>')
    .description('Update gate policy')
    .option('-m, --mode <mode>', 'Gate mode (auto/human/dual)')
    .option('--min-amount <amount>', 'Minimum amount threshold')
    .option('--stages <stages>', 'Comma-separated deal stages')
    .option('--approver-roles <roles>', 'Comma-separated approver roles')
    .option('--priority <n>', 'Priority')
    .option('--enable', 'Enable the policy')
    .option('--disable', 'Disable the policy')
    .action(async (policyId, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const data: Record<string, unknown> = {};

        if (opts.mode) data.mode = opts.mode;
        if (opts.minAmount) data.min_amount = parseAmount(opts.minAmount);
        if (opts.stages) data.stages = opts.stages.split(',');
        if (opts.approverRoles) data.approver_roles = opts.approverRoles.split(',');
        if (opts.priority) data.priority = parseInt(opts.priority);
        if (opts.enable) data.enabled = true;
        if (opts.disable) data.enabled = false;

        const result = await client.updateGatePolicy(policyId, data);

        if (globals.format === 'table') {
          success(`Updated gate policy ${policyId}`);
        }
        console.log(formatOutput(result, globals.format));
      } catch (err) {
        handleError(err);
      }
    });

  // Delete (disable) policy
  policy
    .command('delete <policyId>')
    .description('Disable a gate policy')
    .action(async (policyId, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        await client.deleteGatePolicy(policyId);
        success(`Disabled gate policy ${policyId}`);
      } catch (err) {
        handleError(err);
      }
    });

  // ─── Gate Records ───────────────────────────────────────────────────────────

  // List pending gates
  gate
    .command('pending')
    .description('List pending gate approvals')
    .option('-d, --deal <dealId>', 'Filter by deal')
    .option('-a, --action <action>', 'Filter by action')
    .action(async (opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const result = await client.listGateRecords({
          status: 'pending',
          deal_id: opts.deal,
          action: opts.action,
        });

        if (globals.format === 'table') {
          console.log(formatOutput(result.records, globals.format));
        } else {
          console.log(formatOutput(result, globals.format));
        }
      } catch (err) {
        handleError(err);
      }
    });

  // Get gate record
  gate
    .command('get <recordId>')
    .description('Get gate record details')
    .action(async (recordId, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const result = await client.getGateRecord(recordId);
        console.log(formatOutput(result, globals.format));
      } catch (err) {
        handleError(err);
      }
    });

  // Approve a gate
  gate
    .command('approve <recordId>')
    .description('Approve a pending gate')
    .option('-r, --rationale <text>', 'Approval rationale')
    .action(async (recordId, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const result = await client.decideGate(recordId, {
          decision: 'approved',
          rationale: opts.rationale,
        });

        if (globals.format === 'table') {
          success(`Gate ${recordId} approved (status: ${(result as Record<string, unknown>).status})`);
        }
        console.log(formatOutput(result, globals.format));
      } catch (err) {
        handleError(err);
      }
    });

  // Reject a gate
  gate
    .command('reject <recordId>')
    .description('Reject a pending gate')
    .requiredOption('-r, --rationale <text>', 'Rejection rationale')
    .action(async (recordId, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const result = await client.decideGate(recordId, {
          decision: 'rejected',
          rationale: opts.rationale,
        });

        if (globals.format === 'table') {
          success(`Gate ${recordId} rejected`);
        }
        console.log(formatOutput(result, globals.format));
      } catch (err) {
        handleError(err);
      }
    });

  // Bypass a gate (emergency)
  gate
    .command('bypass <recordId>')
    .description('Emergency bypass a pending gate (requires rationale)')
    .requiredOption('-r, --rationale <text>', 'Bypass rationale (required)')
    .action(async (recordId, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const result = await client.bypassGate(recordId, opts.rationale);

        if (globals.format === 'table') {
          success(`Gate ${recordId} bypassed`);
        }
        console.log(formatOutput(result, globals.format));
      } catch (err) {
        handleError(err);
      }
    });

  // Check if an action would require a gate (dry run)
  gate
    .command('check')
    .description('Check if an action requires gate approval')
    .requiredOption('-a, --action <action>', 'Action to check')
    .option('-d, --deal <dealId>', 'Deal ID for context')
    .option('--amount <amount>', 'Amount for threshold checks')
    .option('--facility-type <type>', 'Facility type for loan-line policies')
    .option('--stage <stage>', 'Deal stage for stage-based policies')
    .action(async (opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const context: Record<string, unknown> = {};
        if (opts.deal) context.deal_id = opts.deal;
        if (opts.amount) context.amount = parseAmount(opts.amount);
        if (opts.facilityType) context.facility_type = opts.facilityType;
        if (opts.stage) context.deal_stage = opts.stage;

        const result = await client.checkGate(opts.action, context);
        console.log(formatOutput(result, globals.format));
      } catch (err) {
        handleError(err);
      }
    });
}
