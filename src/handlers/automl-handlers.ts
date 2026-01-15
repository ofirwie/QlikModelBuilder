/**
 * AutoML Handlers - Connect MCP tools to AutoML service
 * Note: AutoML is Cloud-only feature
 */

import { QlikAutoMLService } from '../services/qlik-automl-service.js';
import { DataCatalogService } from '../services/data-catalog-service.js';
import { ApiClient } from '../utils/api-client.js';
import { CacheManager } from '../utils/cache-manager.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ service: 'AutoMLHandlers' });

/**
 * Cloud-only gate - returns error for on-premise
 */
function checkCloudOnly(platform: string): { content: Array<{ type: string; text: string }> } | null {
  if (platform === 'on-premise') {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: 'AutoML is only available on Qlik Cloud',
          reason: 'AutoML APIs require Qlik Cloud infrastructure',
          platform: 'on-premise'
        }, null, 2)
      }]
    };
  }
  return null;
}

/**
 * Handler for qlik_automl_get_experiments tool
 * List AutoML experiments
 */
export async function handleAutoMLGetExperiments(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug('[AutoMLHandlers] automl_get_experiments called');

  const cloudCheck = checkCloudOnly(platform);
  if (cloudCheck) return cloudCheck;

  try {
    const catalogService = new DataCatalogService(apiClient, cacheManager);
    const autoMLService = new QlikAutoMLService(apiClient, catalogService);
    const result = await autoMLService.listExperiments({
      spaceId: args.spaceId,
      limit: args.limit,
      offset: args.offset
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          experiments: result.experiments,
          total: result.total,
          count: result.experiments.length
        }, null, 2)
      }]
    };
  } catch (error) {
    log.debug('[AutoMLHandlers] Error in automl_get_experiments:', error);
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
 * Handler for qlik_automl_get_experiment tool
 * Get experiment details
 */
export async function handleAutoMLGetExperiment(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug('[AutoMLHandlers] automl_get_experiment called');

  const cloudCheck = checkCloudOnly(platform);
  if (cloudCheck) return cloudCheck;

  try {
    if (!args.experimentId) {
      throw new Error('experimentId is required');
    }

    const catalogService = new DataCatalogService(apiClient, cacheManager);
    const autoMLService = new QlikAutoMLService(apiClient, catalogService);
    const experiment = await autoMLService.getExperiment(args.experimentId);

    let versions = undefined;
    if (args.includeVersions) {
      const result = await autoMLService.listExperimentVersions(args.experimentId);
      versions = result.versions;
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          experiment,
          versions
        }, null, 2)
      }]
    };
  } catch (error) {
    log.debug('[AutoMLHandlers] Error in automl_get_experiment:', error);
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
 * Handler for qlik_automl_list_deployments tool
 * List all ML deployments
 */
export async function handleAutoMLListDeployments(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug('[AutoMLHandlers] automl_list_deployments called');

  const cloudCheck = checkCloudOnly(platform);
  if (cloudCheck) return cloudCheck;

  try {
    const catalogService = new DataCatalogService(apiClient, cacheManager);
    const autoMLService = new QlikAutoMLService(apiClient, catalogService);
    const result = await autoMLService.listDeployments({
      spaceId: args.spaceId,
      limit: args.limit,
      offset: args.offset
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          deployments: result.deployments,
          total: result.total,
          count: result.deployments.length
        }, null, 2)
      }]
    };
  } catch (error) {
    log.debug('[AutoMLHandlers] Error in automl_list_deployments:', error);
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
 * Handler for qlik_automl_get_deployment tool
 * Get deployment details
 */
export async function handleAutoMLGetDeployment(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug('[AutoMLHandlers] automl_get_deployment called');

  const cloudCheck = checkCloudOnly(platform);
  if (cloudCheck) return cloudCheck;

  try {
    if (!args.deploymentId) {
      throw new Error('deploymentId is required');
    }

    const catalogService = new DataCatalogService(apiClient, cacheManager);
    const autoMLService = new QlikAutoMLService(apiClient, catalogService);
    const deployment = await autoMLService.getDeployment(args.deploymentId);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          deployment
        }, null, 2)
      }]
    };
  } catch (error) {
    log.debug('[AutoMLHandlers] Error in automl_get_deployment:', error);
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
