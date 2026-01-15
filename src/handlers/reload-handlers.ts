/**
 * Reload Handlers - Connect MCP tools to reload service
 * Updated with platform support for Cloud and On-Premise
 */

import { ReloadService } from '../services/reload-service.js';
import { ApiClient } from '../utils/api-client.js';
import { CacheManager } from '../utils/cache-manager.js';
import { logger } from '../utils/logger.js';
import { createMcpResponse, createMcpError, McpResponse } from './response-helper.js';

const log = logger.child({ service: 'ReloadHandlers' });

/**
 * Handler for trigger_app_reload tool
 * Triggers a reload for a specific app
 */
export async function handleTriggerAppReload(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<McpResponse> {
  log.debug(`[ReloadHandlers] trigger_app_reload called for app: ${args.appId} (platform: ${platform})`);

  try {
    if (!args.appId) {
      throw new Error('appId is required');
    }

    const reloadService = new ReloadService(apiClient, cacheManager, platform, tenantUrl);

    const result = await reloadService.triggerReload(args.appId, {
      partial: args.partial || false,
      skipStore: args.skipStore || false,
      waitForCompletion: args.waitForCompletion || false,
      timeoutSeconds: args.timeoutSeconds || 300,
      pollIntervalSeconds: args.pollIntervalSeconds || 5
    });

    return createMcpResponse(result);
  } catch (error) {
    log.debug('[ReloadHandlers] Error in trigger_app_reload:', error);
    return createMcpError(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Handler for get_reload_status tool
 * Gets the current status of a reload task
 */
export async function handleGetReloadStatus(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<McpResponse> {
  log.debug(`[ReloadHandlers] get_reload_status called for reload: ${args.reloadId} (platform: ${platform})`);

  try {
    if (!args.reloadId) {
      throw new Error('reloadId is required');
    }

    const reloadService = new ReloadService(apiClient, cacheManager, platform, tenantUrl);
    const result = await reloadService.getReloadStatus(args.reloadId);

    return createMcpResponse({
      success: true,
      platform,
      reload: result
    });
  } catch (error) {
    log.debug('[ReloadHandlers] Error in get_reload_status:', error);
    return createMcpError(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Handler for cancel_reload tool
 * Cancels a running reload task
 */
export async function handleCancelReload(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<McpResponse> {
  log.debug(`[ReloadHandlers] cancel_reload called for reload: ${args.reloadId} (platform: ${platform})`);

  try {
    if (!args.reloadId) {
      throw new Error('reloadId is required');
    }

    const reloadService = new ReloadService(apiClient, cacheManager, platform, tenantUrl);
    const result = await reloadService.cancelReload(args.reloadId);

    return createMcpResponse(result);
  } catch (error) {
    log.debug('[ReloadHandlers] Error in cancel_reload:', error);
    return createMcpError(error instanceof Error ? error.message : String(error));
  }
}

