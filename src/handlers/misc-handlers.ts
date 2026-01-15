/**
 * Misc Handlers - Connect MCP tools to miscellaneous services
 * Updated with platform support for Cloud and On-Premise
 */

import { SimpleNaturalLanguageService } from '../services/natural-language-service-simple.js';
import { ReloadService } from '../services/reload-service.js';
import { ApiClient } from '../utils/api-client.js';
import { CacheManager } from '../utils/cache-manager.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ service: 'MiscHandlers' });

/**
 * Handler for insight_advisor tool
 * Insight Advisor / Natural Language API wrapper
 * Works on both Cloud and On-Premise (requires Insight Advisor Chat license on-premise)
 */
export async function handleInsightAdvisor(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug(`[MiscHandlers] insight_advisor called (platform: ${platform})`);

  try {
    if (!args?.text) {
      throw new Error('text is required');
    }

    // Note: appId is optional - if not provided, NL API will search across available apps

    const nlService = new SimpleNaturalLanguageService(apiClient, platform);
    const result = await nlService.askQuestion({
      text: args.text,
      appId: args.appId
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  } catch (error) {
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
 * Handler for get_reload_info tool
 * Get app reload history and status
 */
export async function handleGetReloadInfo(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug(`[MiscHandlers] get_reload_info called (platform: ${platform})`);

  try {
    if (!args?.appId) {
      throw new Error('appId is required');
    }

    // Use ReloadService which has platform support
    const reloadService = new ReloadService(apiClient, cacheManager, platform, tenantUrl);
    const reloadInfo = await reloadService.getAppReloadHistory(args.appId, args.limit || 10);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          platform,
          appId: args.appId,
          reloadInfo,
          timestamp: new Date().toISOString()
        }, null, 2)
      }]
    };
  } catch (error) {
    log.debug('[MiscHandlers] Error in get_reload_info:', error);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        }, null, 2)
      }]
    };
  }
}
