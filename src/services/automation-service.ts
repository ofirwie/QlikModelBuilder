/**
 * Automation Service - Manages Qlik Cloud automations
 *
 * Provides automation management capabilities:
 * - List automations with filters
 * - Get automation details
 * - List automation runs
 * - Run automations
 */

import { ApiClient } from '../utils/api-client.js';
import { logger } from '../utils/logger.js';
import {
  Automation,
  AutomationRun,
  AutomationRunDetails
} from '../types/automation.js';

export class AutomationService {
  private apiClient: ApiClient;

  constructor(apiClient: ApiClient) {
    this.apiClient = apiClient;
  }

  /**
   * List automations
   * Retrieves a list of automations that the requesting user has access to
   */
  async listAutomations(options: {
    fields?: string;
    filter?: string;
    limit?: number;
    sort?: string;
  } = {}): Promise<Automation[]> {
    try {
      logger.debug('[AutomationService] Listing automations');

      const params: any = {};
      if (options.fields) params.fields = options.fields;
      if (options.filter) params.filter = options.filter;
      if (options.limit) params.limit = options.limit;
      if (options.sort) params.sort = options.sort;

      const response = await this.apiClient.makeRequest('/api/v1/automations', 'GET', undefined, { useCache: true });

      const automations = response.data || response || [];
      logger.debug(`[AutomationService] Found ${automations.length} automations`);

      return automations;
    } catch (error) {
      logger.error('[AutomationService] Error listing automations', error instanceof Error ? error : undefined);
      throw error;
    }
  }

  /**
   * Get automation details
   * Retrieves the full definition of an automation
   */
  async getAutomationDetails(automationId: string): Promise<Automation> {
    try {
      logger.debug(`[AutomationService] Getting automation ${automationId}`);

      const response = await this.apiClient.makeRequest(`/api/v1/automations/${automationId}`, 'GET');

      logger.debug(`[AutomationService] Retrieved automation: ${response.name}`);

      return response;
    } catch (error) {
      logger.error('[AutomationService] Error getting automation', error instanceof Error ? error : undefined);
      throw error;
    }
  }

  /**
   * List automation runs
   * Retrieves a list of runs for a specific automation
   */
  async listAutomationRuns(
    automationId: string,
    options: {
      fields?: string;
      filter?: string;
      limit?: number;
      sort?: string;
    } = {}
  ): Promise<AutomationRun[]> {
    try {
      logger.debug(`[AutomationService] Listing runs for automation ${automationId}`);

      const params: any = {};
      if (options.fields) params.fields = options.fields;
      if (options.filter) params.filter = options.filter;
      if (options.limit) params.limit = options.limit;
      if (options.sort) params.sort = options.sort;

      const response = await this.apiClient.makeRequest(
        `/automations/${automationId}/runs`,
        'GET',
        undefined,
        { useCache: false }
      );

      const runs = response.data || response || [];
      logger.debug(`[AutomationService] Found ${runs.length} runs`);

      return runs;
    } catch (error) {
      logger.error('[AutomationService] Error listing automation runs', error instanceof Error ? error : undefined);
      throw error;
    }
  }

  /**
   * Run an automation
   * Creates a run for a specific automation
   */
  async runAutomation(automationId: string): Promise<AutomationRunDetails> {
    try {
      logger.debug(`[AutomationService] Running automation ${automationId}`);

      const response = await this.apiClient.makeRequest(
        `/automations/${automationId}/actions/execute`,
        'POST',
        { context: 'api' }
      );

      logger.debug(`[AutomationService] Automation run queued: ${response.id}`);

      return response;
    } catch (error) {
      logger.error('[AutomationService] Error running automation', error instanceof Error ? error : undefined);
      throw error;
    }
  }
}
