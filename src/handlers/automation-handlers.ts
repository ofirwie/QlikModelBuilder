/**
 * Automation Handlers - Connect MCP tools to automation service
 * Note: Automations are Cloud-only feature
 */

import { AutomationService } from '../services/automation-service.js';
import { ApiClient } from '../utils/api-client.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ service: 'AutomationHandlers' });

/**
 * Handler for qlik_automation_list tool
 * List all automations
 */
export async function handleAutomationList(
  apiClient: ApiClient,
  args: any
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug('[AutomationHandlers] automation_list called');

  try {
    const automationService = new AutomationService(apiClient);

    const automations = await automationService.listAutomations({
      fields: args.fields,
      filter: args.filter,
      limit: args.limit,
      sort: args.sort
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          automations,
          count: automations.length
        }, null, 2)
      }]
    };
  } catch (error) {
    log.debug('[AutomationHandlers] Error in automation_list:', error);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }, null, 2)
      }]
    };
  }
}

/**
 * Handler for qlik_automation_get_details tool
 * Get full details of a specific automation
 */
export async function handleAutomationGetDetails(
  apiClient: ApiClient,
  args: any
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug('[AutomationHandlers] automation_get_details called');

  try {
    if (!args.automationId) {
      throw new Error('automationId is required');
    }

    const automationService = new AutomationService(apiClient);
    const automation = await automationService.getAutomationDetails(args.automationId);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          automation
        }, null, 2)
      }]
    };
  } catch (error) {
    log.debug('[AutomationHandlers] Error in automation_get_details:', error);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }, null, 2)
      }]
    };
  }
}

/**
 * Handler for qlik_automation_run tool
 * Execute an automation
 */
export async function handleAutomationRun(
  apiClient: ApiClient,
  args: any
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug('[AutomationHandlers] automation_run called');

  try {
    if (!args.automationId) {
      throw new Error('automationId is required');
    }

    const automationService = new AutomationService(apiClient);
    const runDetails = await automationService.runAutomation(args.automationId);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          run: runDetails,
          message: `Automation ${args.automationId} execution started. Run ID: ${runDetails.id}`
        }, null, 2)
      }]
    };
  } catch (error) {
    log.debug('[AutomationHandlers] Error in automation_run:', error);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }, null, 2)
      }]
    };
  }
}

/**
 * Handler for qlik_automation_list_runs tool
 * List all runs for a specific automation
 */
export async function handleAutomationListRuns(
  apiClient: ApiClient,
  args: any
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug('[AutomationHandlers] automation_list_runs called');

  try {
    if (!args.automationId) {
      throw new Error('automationId is required');
    }

    const automationService = new AutomationService(apiClient);
    const runs = await automationService.listAutomationRuns(args.automationId, {
      fields: args.fields,
      filter: args.filter,
      limit: args.limit,
      sort: args.sort
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          runs,
          count: runs.length
        }, null, 2)
      }]
    };
  } catch (error) {
    log.debug('[AutomationHandlers] Error in automation_list_runs:', error);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }, null, 2)
      }]
    };
  }
}
