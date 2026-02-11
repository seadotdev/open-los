import { Command } from 'commander';
import { getClient } from '../client.js';
import {
  formatOutput,
  handleError,
  success,
  getGlobalOptions,
  type GlobalOptions,
} from '../utils.js';

export function registerTemplateCommands(program: Command): void {
  const template = program
    .command('template')
    .description('Manage document templates');

  // List templates
  template
    .command('list')
    .description('List available templates')
    .option('-p, --phase <phase>', 'Filter by phase')
    .option('-t, --doc-type <type>', 'Filter by document type')
    .action(async (opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const result = await client.listTemplates({
          phase: opts.phase,
          doc_type: opts.docType,
        });

        if (globals.format === 'table') {
          console.log(formatOutput(result.templates, globals.format));
        } else {
          console.log(formatOutput(result, globals.format));
        }
      } catch (err) {
        handleError(err);
      }
    });

  // Render template
  template
    .command('render')
    .description('Render a template with deal context')
    .requiredOption('-n, --name <name>', 'Template name')
    .requiredOption('-d, --deal <id>', 'Deal ID')
    .option('-o, --overrides <json>', 'Override values as JSON')
    .action(async (opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const data: Record<string, unknown> = {
          template_name: opts.name,
          deal_id: opts.deal,
        };

        if (opts.overrides) data.overrides = JSON.parse(opts.overrides);

        const result = await client.renderTemplate(data as Parameters<typeof client.renderTemplate>[0]);

        // For rendered content, just output the content directly
        if (globals.format === 'table') {
          console.log(result.content);
        } else {
          console.log(formatOutput(result, globals.format));
        }
      } catch (err) {
        handleError(err);
      }
    });

  // List artifacts
  const artifact = program
    .command('artifact')
    .description('Manage frozen document artifacts');

  artifact
    .command('list <dealId>')
    .description('List artifacts for a deal')
    .action(async (dealId, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const result = await client.listArtifacts(dealId);

        if (globals.format === 'table') {
          console.log(formatOutput(result.artifacts, globals.format));
        } else {
          console.log(formatOutput(result, globals.format));
        }
      } catch (err) {
        handleError(err);
      }
    });

  // Create artifact
  artifact
    .command('create <dealId>')
    .description('Create a frozen artifact from a template')
    .requiredOption('-n, --name <name>', 'Template name')
    .option('-o, --overrides <json>', 'Override values as JSON')
    .action(async (dealId, opts, cmd) => {
      try {
        const globals = getGlobalOptions(cmd.optsWithGlobals() as GlobalOptions);
        const client = getClient({ baseUrl: globals.apiUrl, actor: globals.actor, tenantId: globals.tenantId });

        const data: Record<string, unknown> = {
          template_name: opts.name,
        };

        if (opts.overrides) data.overrides = JSON.parse(opts.overrides);

        const result = await client.createArtifact(dealId, data as Parameters<typeof client.createArtifact>[1]);

        if (globals.format === 'table') {
          success(`Created artifact ${result.id}`);
        }
        console.log(formatOutput(result, globals.format));
      } catch (err) {
        handleError(err);
      }
    });
}
