/**
 * Catalog Handlers - Connect MCP tools to catalog service
 * Updated with platform support for Cloud and On-Premise
 * Note: handleSearchApps and handleGetSpaceItems replaced by search-handlers.ts
 */

import { DataCatalogService, getDataCatalogService } from '../services/data-catalog-service.js';
import { ApiClient } from '../utils/api-client.js';
import { CacheManager } from '../utils/cache-manager.js';
import { logger } from '../utils/logger.js';
import { createMcpResponse, createMcpError, McpResponse } from './response-helper.js';

const log = logger.child({ service: 'CatalogHandlers' });

/**
 * Handler for get_spaces_catalog tool
 * Gets comprehensive space catalog information
 * On-premise: Returns streams instead of spaces
 */
export async function handleGetSpacesCatalog(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<McpResponse> {
  log.debug(`[CatalogHandlers] get_spaces_catalog called (platform: ${platform})`);

  try {
    if (platform === 'on-premise') {
      return await handleGetStreamsCatalogOnPrem(apiClient, args);
    }

    // Cloud implementation - use DataCatalogService
    const isFullScan = !args.query &&
                      (!args.spaceType || args.spaceType === 'all') &&
                      !args.ownerId &&
                      !args.memberUserId &&
                      !args.hasDataAssets &&
                      !args.minItems;

    const operation = isFullScan ? 'scan' : 'search';
    log.debug(`[CatalogHandlers] ${operation}ing spaces catalog (Cloud)`);

    const catalogService = getDataCatalogService(apiClient, cacheManager);

    const results = await catalogService.getSpacesCatalog({
      query: args.query,
      spaceType: args.spaceType,
      ownerId: args.ownerId,
      memberUserId: args.memberUserId,
      hasDataAssets: args.hasDataAssets,
      minItems: args.minItems,
      limit: args.limit || (isFullScan ? 1000 : 50),
      offset: args.offset || 0,
      sortBy: args.sortBy || 'name',
      sortOrder: args.sortOrder || 'asc',
      includeMembers: args.includeMembers ?? true,
      includeCounts: args.includeCounts ?? true,
      force: args.force || false,
      useCache: args.useCache ?? !args.force
    });

    return createMcpResponse({
      ...results,
      platform: 'cloud'
    });
  } catch (error) {
    log.debug('[CatalogHandlers] Error in get_spaces_catalog:', error);
    return createMcpError(error instanceof Error ? error.message : String(error));
  }
}

/**
 * On-Premise: Get streams catalog via QRS
 * Streams are the on-premise equivalent of Spaces
 */
async function handleGetStreamsCatalogOnPrem(
  apiClient: ApiClient,
  args: any
): Promise<McpResponse> {
  try {
    log.debug('[CatalogHandlers] Getting streams catalog (On-Premise)');
    const startTime = Date.now();

    // Build QRS filter if query is provided
    let endpoint = '/qrs/stream/full';
    if (args.query) {
      const filter = `name like '*${args.query}*'`;
      endpoint = `/qrs/stream/full?filter=${encodeURIComponent(filter)}`;
    }

    const streamsResponse = await apiClient.makeRequest(endpoint);
    const allStreams = streamsResponse.data || streamsResponse || [];

    // Apply sorting
    const sortBy = args.sortBy || 'name';
    const sortOrder = args.sortOrder || 'asc';
    allStreams.sort((a: any, b: any) => {
      let valA = a[sortBy === 'created' ? 'createdDate' : sortBy === 'modified' ? 'modifiedDate' : sortBy];
      let valB = b[sortBy === 'created' ? 'createdDate' : sortBy === 'modified' ? 'modifiedDate' : sortBy];
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (sortOrder === 'asc') return valA > valB ? 1 : -1;
      return valA < valB ? 1 : -1;
    });

    // Apply pagination
    const offset = args.offset || 0;
    const limit = args.limit || 50;
    const paginatedStreams = allStreams.slice(offset, offset + limit);

    // Get app counts for each stream if requested
    const streams = await Promise.all(paginatedStreams.map(async (stream: any) => {
      const streamData: any = {
        id: stream.id,
        name: stream.name,
        type: 'stream',
        spaceInfo: {
          ownerId: stream.owner?.id,
          ownerName: stream.owner?.name || stream.owner?.userId,
          createdDate: stream.createdDate,
          modifiedDate: stream.modifiedDate,
          isActive: true,
          visibility: 'internal'
        },
        members: [],
        dataAssets: [],
        spaceItems: [],
        statistics: {
          itemCount: 0,
          appCount: 0,
          dataAssetCount: 0,
          memberCount: 0
        }
      };

      // Get app count in this stream if requested
      if (args.includeCounts !== false) {
        try {
          const appsResponse = await apiClient.makeRequest(
            `/qrs/app/count?filter=stream.id eq ${stream.id}`
          );
          const appCount = appsResponse.value || appsResponse || 0;
          streamData.statistics.itemCount = appCount;
          streamData.statistics.appCount = appCount;
        } catch (e) {
          // Ignore count errors
        }
      }

      return streamData;
    }));

    const searchTime = Date.now() - startTime;

    // Calculate facets
    const facets = {
      byType: { stream: streams.length },
      byOwner: {} as Record<string, number>
    };
    streams.forEach((s: any) => {
      const owner = s.spaceInfo.ownerName || 'Unknown';
      facets.byOwner[owner] = (facets.byOwner[owner] || 0) + 1;
    });

    return createMcpResponse({
      success: true,
      platform: 'on-premise',
      spaces: streams, // Keep 'spaces' key for compatibility
      streams: streams, // Also include as 'streams' for clarity
      totalCount: allStreams.length,
      returnedCount: streams.length,
      searchTime,
      facets,
      summary: {
        totalStreams: allStreams.length,
        totalApps: streams.reduce((sum: number, s: any) => sum + (s.statistics.appCount || 0), 0)
      },
      note: 'On-premise uses Streams instead of Spaces. The spaces field contains stream data for compatibility.'
    });
  } catch (error) {
    log.debug('[CatalogHandlers] Error in on-premise streams catalog:', error);
    return createMcpError(
      error instanceof Error ? error.message : String(error),
      { platform: 'on-premise' }
    );
  }
}
