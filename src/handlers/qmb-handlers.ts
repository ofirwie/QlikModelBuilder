/**
 * QlikModelBuilder - MCP Handlers
 * Handler implementations for QMB tools
 */

import { CallToolResult, TextContent } from '@modelcontextprotocol/sdk/types.js';
import {
  getWizardEngine,
  WizardEntryMode,
  WizardStepId,
  IncrementalStrategy,
} from '../wizard/index.js';

/**
 * Handle QMB tool calls
 */
export async function handleQmbTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<CallToolResult> {
  const wizard = getWizardEngine();

  try {
    switch (toolName) {
      // ============================================================
      // Wizard Lifecycle
      // ============================================================
      case 'qmb_start_wizard': {
        const mode = (args.mode as WizardEntryMode) || 'scratch';
        const projectName = args.projectName as string | undefined;
        const state = wizard.startWizard(mode, projectName);
        return success(`Wizard started in '${mode}' mode.\n\nProject ID: ${state.id}\nCurrent step: ${state.currentStep}\n\nUse qmb_status to see progress.`);
      }

      case 'qmb_status': {
        const status = wizard.getStatus();
        return success(formatStatus(status));
      }

      case 'qmb_go_back': {
        const stepId = args.stepId as WizardStepId | undefined;
        const result = stepId ? wizard.goTo(stepId) : wizard.back();
        if (result.success) {
          return success(`Navigated to step: ${result.currentStep}`);
        } else {
          return error(result.error || 'Navigation failed');
        }
      }

      // ============================================================
      // Space Management
      // ============================================================
      case 'qmb_list_spaces': {
        // TODO: Implement actual Qlik API call
        return success('Space listing not yet implemented. Will connect to Qlik Cloud API.');
      }

      case 'qmb_select_space': {
        const spaceId = args.spaceId as string;
        wizard.selectSpace(spaceId, 'Selected Space', 'shared');
        return success(`Space selected: ${spaceId}`);
      }

      case 'qmb_create_space': {
        const name = args.name as string;
        const type = args.type as 'shared' | 'managed';
        const description = args.description as string | undefined;
        wizard.createNewSpace(name, type, description);
        return success(`New space configured: ${name} (${type})`);
      }

      // ============================================================
      // Connection Management
      // ============================================================
      case 'qmb_list_connections': {
        // TODO: Implement actual Qlik API call
        return success('Connection listing not yet implemented. Will connect to Qlik Cloud API.');
      }

      case 'qmb_select_connection': {
        const connectionId = args.connectionId as string;
        wizard.selectConnection(connectionId, 'Selected Connection');
        return success(`Connection selected: ${connectionId}`);
      }

      case 'qmb_create_connection': {
        const name = args.name as string;
        const type = args.type as string;
        wizard.setConnection({
          name,
          type: type as any,
          server: args.server as string | undefined,
          database: args.database as string | undefined,
          username: args.username as string | undefined,
          password: args.password as string | undefined,
        });
        return success(`Connection configured: ${name} (${type})`);
      }

      case 'qmb_api_wizard': {
        return success('API Connection Wizard started.\n\nPlease provide:\n1. Base URL\n2. Authentication type (none, api_key, bearer, basic, oauth2)\n3. Auth credentials\n4. Additional headers');
      }

      case 'qmb_test_connection': {
        // TODO: Implement actual connection test
        return success('Connection test not yet implemented. Will test actual connectivity.');
      }

      // ============================================================
      // Table Configuration
      // ============================================================
      case 'qmb_list_tables': {
        // TODO: Implement actual database query
        return success('Table listing not yet implemented. Will query database metadata.');
      }

      case 'qmb_add_table': {
        const tableName = args.tableName as string;
        const schema = args.schema as string | undefined;
        const alias = args.alias as string | undefined;
        wizard.addTable({
          name: tableName,
          schema,
          alias,
          fields: [],
          incremental: { strategy: 'none' },
        });
        return success(`Table added: ${schema ? schema + '.' : ''}${tableName}`);
      }

      case 'qmb_remove_table': {
        const tableName = args.tableName as string;
        wizard.removeTable(tableName);
        return success(`Table removed: ${tableName}`);
      }

      case 'qmb_get_table_fields': {
        // TODO: Implement actual database query
        return success('Field listing not yet implemented. Will query table columns.');
      }

      case 'qmb_set_table_fields': {
        const tableName = args.tableName as string;
        const includeFields = args.includeFields as string[] | undefined;
        // TODO: Update table fields
        return success(`Fields configured for table: ${tableName}`);
      }

      // ============================================================
      // Incremental Configuration
      // ============================================================
      case 'qmb_set_incremental': {
        const tableName = args.tableName as string;
        const strategy = args.strategy as IncrementalStrategy;
        const field = args.field as string | undefined;
        const windowSize = args.windowSize as number | undefined;
        const windowUnit = args.windowUnit as 'days' | 'weeks' | 'months' | undefined;
        const keepHistory = args.keepHistory as boolean | undefined;

        wizard.setTableIncremental(tableName, {
          strategy,
          field,
          windowSize,
          windowUnit,
          keepHistory,
        });

        return success(`Incremental configured for ${tableName}: ${strategy}${field ? ` on ${field}` : ''}`);
      }

      case 'qmb_suggest_incremental': {
        const tableName = args.tableName as string;
        // TODO: Implement AI-based suggestion
        return success(`Incremental suggestion for ${tableName}:\n\nLooking for date/timestamp fields...\nRecommendation: Check for ModifiedDate, UpdatedAt, or CreatedAt fields.`);
      }

      // ============================================================
      // Templates
      // ============================================================
      case 'qmb_list_templates': {
        return success('Available templates:\n\n1. sqlserver-basic - Basic SQL Server connection\n2. fact-table - Fact table with incremental by date\n3. dimension-table - Dimension table with full reload');
      }

      case 'qmb_use_template': {
        const templateId = args.templateId as string;
        // TODO: Apply actual template
        return success(`Template applied: ${templateId}`);
      }

      // ============================================================
      // Spec Import
      // ============================================================
      case 'qmb_load_spec': {
        const filePath = args.filePath as string | undefined;
        const content = args.content as string | undefined;
        // TODO: Implement spec extraction
        return success('Spec import not yet fully implemented. Will use Claude to extract configuration from documents.');
      }

      // ============================================================
      // Validation & Review
      // ============================================================
      case 'qmb_validate': {
        const stepArg = args.step as string | undefined;
        let result;

        if (stepArg === 'all') {
          result = wizard.validateAll();
        } else if (stepArg && stepArg !== 'current') {
          result = wizard.validateStep(stepArg as WizardStepId);
        } else {
          result = wizard.validateCurrentStep();
        }

        if (result.valid) {
          const warningText = result.warnings.length > 0
            ? `\n\nWarnings:\n${result.warnings.map(w => `- ${w.message}`).join('\n')}`
            : '';
          return success(`Validation passed!${warningText}`);
        } else {
          return error(`Validation failed:\n${result.errors.map(e => `- ${e.message}`).join('\n')}`);
        }
      }

      case 'qmb_preview_script': {
        const includeComments = args.includeComments !== false;
        const language = (args.language as 'en' | 'he') || 'en';
        const script = wizard.previewScript({ includeComments, commentLanguage: language });
        return success(`Generated Script:\n\n\`\`\`qlik\n${script}\n\`\`\``);
      }

      // ============================================================
      // Deploy
      // ============================================================
      case 'qmb_deploy': {
        const result = await wizard.deploy();
        if (result.success) {
          return success(`Deployment successful!\n\nApp ID: ${result.appId}\nURL: ${result.appUrl}`);
        } else {
          return error(`Deployment failed:\n${result.errors?.join('\n')}`);
        }
      }

      // ============================================================
      // Utilities
      // ============================================================
      case 'qmb_export_state': {
        const stateJson = wizard.exportState();
        return success(`Exported state:\n\n\`\`\`json\n${stateJson}\n\`\`\``);
      }

      case 'qmb_import_state': {
        const stateJson = args.stateJson as string;
        const imported = wizard.resumeWizard(stateJson);
        if (imported) {
          return success('State imported successfully. Use qmb_status to see current state.');
        } else {
          return error('Failed to import state. Invalid JSON format.');
        }
      }

      case 'qmb_quick_start': {
        const projectName = args.projectName as string;
        const sourceType = args.sourceType as string;
        wizard.startWizard('scratch', projectName);
        wizard.setConnection({
          name: `${projectName}_Connection`,
          type: sourceType as any,
          server: args.connectionString as string | undefined,
        });
        return success(`Quick start initialized:\n- Project: ${projectName}\n- Source: ${sourceType}\n\nNext: Add tables with qmb_add_table`);
      }

      case 'qmb_clone': {
        const appId = args.appId as string;
        const newName = args.newName as string | undefined;
        // TODO: Implement app cloning
        return success(`Clone from app ${appId} not yet implemented. Will extract configuration from existing app.`);
      }

      default:
        return error(`Unknown QMB tool: ${toolName}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return error(`Error executing ${toolName}: ${message}`);
  }
}

/**
 * Format status object for display
 */
function formatStatus(status: Record<string, unknown>): string {
  const lines = [
    '=== QlikModelBuilder Status ===',
    '',
    `Project: ${status.projectName || '(unnamed)'}`,
    `Entry Mode: ${status.entryMode}`,
    `Current Step: ${status.currentStep}`,
    '',
    '--- Progress ---',
    `Step ${(status.progress as any)?.current} of ${(status.progress as any)?.total} (${(status.progress as any)?.percentage}%)`,
    '',
    '--- Configuration ---',
    `Space: ${status.hasSpace ? 'Configured' : 'Not set'}`,
    `Connection: ${status.hasConnection ? 'Configured' : 'Not set'}`,
    `Tables: ${status.tableCount}`,
    `Script: ${status.isScriptGenerated ? 'Generated' : 'Not generated'}`,
    `Deployed: ${status.isDeployed ? 'Yes' : 'No'}`,
    '',
    '--- Steps ---',
  ];

  const steps = status.steps as Array<{ id: string; name: string; status: string }>;
  for (const step of steps) {
    const icon = step.status === 'completed' ? '[x]' : step.status === 'current' ? '[>]' : '[ ]';
    lines.push(`${icon} ${step.name}`);
  }

  return lines.join('\n');
}

/**
 * Create success response
 */
function success(message: string): CallToolResult {
  return {
    content: [{ type: 'text', text: message } as TextContent],
  };
}

/**
 * Create error response
 */
function error(message: string): CallToolResult {
  return {
    content: [{ type: 'text', text: `Error: ${message}` } as TextContent],
    isError: true,
  };
}
