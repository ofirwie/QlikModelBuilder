/**
 * Lineage Handlers - Connect MCP tools to lineage services
 * Note: Lineage features use QRI (Qlik Resource Identifiers) which are Cloud-only
 */

import { LineageService, getLineageService } from '../services/lineage-service.js';
import { DataCatalogService, getDataCatalogService } from '../services/data-catalog-service.js';
import { ApiClient } from '../utils/api-client.js';
import { CacheManager } from '../utils/cache-manager.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ service: 'LineageHandlers' });

/**
 * Helper to check if platform supports lineage
 * Lineage/QRI features are Cloud-only
 */
function checkCloudOnly(platform: string): { isCloudOnly: boolean; response?: any } {
  if (platform === 'on-premise') {
    return {
      isCloudOnly: true,
      response: {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Lineage features are only available on Qlik Cloud',
            reason: 'Lineage uses QRI (Qlik Resource Identifiers) which are Cloud-specific. On-premise Qlik Sense does not support lineage tracking.',
            platform: 'on-premise',
            suggestion: 'Use qlik_search to find apps and datasets, or qlik_get_spaces_catalog to explore streams.'
          }, null, 2)
        }]
      }
    };
  }
  return { isCloudOnly: false };
}

/**
 * Handler for get_lineage tool
 * Get lineage information for a dataset or resource
 * CLOUD-ONLY: Uses QRI identifiers
 */
export async function handleGetLineage(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug(`[LineageHandlers] get_lineage called (platform: ${platform})`);

  // Check for Cloud-only feature
  const cloudCheck = checkCloudOnly(platform);
  if (cloudCheck.isCloudOnly) {
    return cloudCheck.response!;
  }

  try {
    if (!args?.nodeId) {
      throw new Error('nodeId is required');
    }

    if (!args.nodeId.startsWith('qri:')) {
      throw new Error('nodeId must be a QRI (Qlik Resource Identifier). Use dataset.rawDataset.secureQri');
    }

    const catalogService = getDataCatalogService(apiClient, cacheManager);
    const lineageService = getLineageService(apiClient, cacheManager, catalogService);

    const graphs = await lineageService.getLineage({
      nodeId: args.nodeId,
      direction: args.direction || 'both',
      levels: args.levels !== undefined ? args.levels : 5,
      includeFields: args.includeFields || false,
      includeTables: args.includeTables || false,
      includeDetails: true
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          platform: 'cloud',
          graphs,
          nodeId: args.nodeId,
          timestamp: new Date().toISOString()
        }, null, 2)
      }]
    };
  } catch (error) {
    log.debug('[LineageHandlers] Error in get_lineage:', error);
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

