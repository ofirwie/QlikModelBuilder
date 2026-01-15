/**
 * Qlik Alerts Handlers - Connect MCP tools to Qlik Alert service
 */

import { QlikAlertService } from '../services/qlik-alert-service.js';
import { ApiClient } from '../utils/api-client.js';
import { CacheManager } from '../utils/cache-manager.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ service: 'AlertsHandlers' });

/**
 * Handler for qlik_alert_list tool
 */
export async function handleAlertList(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug('[AlertsHandlers] qlik_alert_list called');

  if (platform === 'on-premise') {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: 'Data Alerting is only available on Qlik Cloud',
          reason: 'Data alerting requires Qlik Cloud event processing and notification infrastructure',
          platform: 'on-premise',
          suggestion: 'Use app-level monitoring or task scheduling for on-premise deployments'
        }, null, 2)
      }]
    };
  }

  try {
    const alertService = new QlikAlertService(apiClient, cacheManager);
    const result = await alertService.listAlerts(args);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  } catch (error) {
    log.debug('[AlertsHandlers] Error in qlik_alert_list:', error);
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
 * Handler for qlik_alert_get tool
 */
export async function handleAlertGet(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug('[AlertsHandlers] qlik_alert_get called');

  if (platform === 'on-premise') {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: 'Data Alerting is only available on Qlik Cloud',
          reason: 'Data alerting requires Qlik Cloud event processing and notification infrastructure',
          platform: 'on-premise',
          suggestion: 'Use app-level monitoring or task scheduling for on-premise deployments'
        }, null, 2)
      }]
    };
  }

  try {
    if (!args.alertId) {
      throw new Error('alertId is required');
    }

    const alertService = new QlikAlertService(apiClient, cacheManager);
    const alert = await alertService.getAlert(args.alertId);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          alert
        }, null, 2)
      }]
    };
  } catch (error) {
    log.debug('[AlertsHandlers] Error in qlik_alert_get:', error);
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
 * Handler for qlik_alert_trigger tool
 */
export async function handleAlertTrigger(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug('[AlertsHandlers] qlik_alert_trigger called');

  if (platform === 'on-premise') {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: 'Data Alerting is only available on Qlik Cloud',
          reason: 'Data alerting requires Qlik Cloud event processing and notification infrastructure',
          platform: 'on-premise',
          suggestion: 'Use app-level monitoring or task scheduling for on-premise deployments'
        }, null, 2)
      }]
    };
  }

  try {
    if (!args.alertId) {
      throw new Error('alertId is required');
    }

    const alertService = new QlikAlertService(apiClient, cacheManager);
    const result = await alertService.triggerAlert(args.alertId);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  } catch (error) {
    log.debug('[AlertsHandlers] Error in qlik_alert_trigger:', error);
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
 * Handler for qlik_alert_delete tool
 */
export async function handleAlertDelete(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug('[AlertsHandlers] qlik_alert_delete called');

  if (platform === 'on-premise') {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: 'Data Alerting is only available on Qlik Cloud',
          reason: 'Data alerting requires Qlik Cloud event processing and notification infrastructure',
          platform: 'on-premise',
          suggestion: 'Use app-level monitoring or task scheduling for on-premise deployments'
        }, null, 2)
      }]
    };
  }

  try {
    if (!args.alertId) {
      throw new Error('alertId is required');
    }

    const alertService = new QlikAlertService(apiClient, cacheManager);
    const result = await alertService.deleteAlert(args.alertId);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  } catch (error) {
    log.debug('[AlertsHandlers] Error in qlik_alert_delete:', error);
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

