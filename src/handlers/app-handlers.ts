/**
 * App Handlers - Simple app operations
 */

import { SimpleAppDeveloperService } from '../services/app-developer-service-simple.js';
import { ApiClient } from '../utils/api-client.js';
import { CacheManager } from '../utils/cache-manager.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ service: 'AppHandlers' });

/**
 * Handler for generate_app tool
 * Simple create/update app without smart features
 */
export async function handleGenerateApp(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug(`[AppHandlers] generate_app called (platform: ${platform})`);
  log.debug(`[AppHandlers] Args: listOdbcDsns=${args.listOdbcDsns}, listConnections=${args.listConnections}, appId=${args.appId}`);

  try {
    const appDevService = new SimpleAppDeveloperService(apiClient, cacheManager, platform, tenantUrl);

    const input = {
      appName: args.appName,
      appId: args.appId,
      loadScript: args.loadScript,
      // On-premise only: data connection features
      dataConnection: args.dataConnection,
      listConnections: args.listConnections,
      listOdbcDsns: args.listOdbcDsns,
    };

    log.debug(`[AppHandlers] Calling createOrUpdateApp with input: ${JSON.stringify({ listOdbcDsns: input.listOdbcDsns, listConnections: input.listConnections, appId: input.appId })}`);

    const result = await appDevService.createOrUpdateApp(input);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  } catch (error) {
    log.debug('[AppHandlers] Error:', error);
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
