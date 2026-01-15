/**
 * Unified Search Handler
 * Handles qlik_search tool requests for both Cloud and On-Premise
 */

import { UnifiedSearchService, SearchParams } from '../services/unified-search-service.js';
import { ApiClient } from '../utils/api-client.js';
import { CacheManager } from '../utils/cache-manager.js';

export async function handleUnifiedSearch(
  args: any,
  apiClient: ApiClient,
  cacheManager: CacheManager,
  platform: 'cloud' | 'on-premise',
  tenantUrl: string
) {
  try {
    const searchService = new UnifiedSearchService(
      apiClient,
      cacheManager,
      platform,
      tenantUrl
    );

    // Build search params from args
    const searchParams: SearchParams = {
      query: args.query,
      types: args.types,
      spaceId: args.spaceId,
      spaceName: args.spaceName,
      allSpaces: args.allSpaces,
      ownerId: args.ownerId,
      ownerName: args.ownerName,
      tags: args.tags,
      // Date filters
      createdAfter: args.createdAfter,
      createdBefore: args.createdBefore,
      modifiedAfter: args.modifiedAfter,
      modifiedBefore: args.modifiedBefore,
      // Options
      includeReloadInfo: args.includeReloadInfo,
      includeDetails: args.includeDetails,
      groupBy: args.groupBy,
      // Pagination & Limits
      limit: args.limit,
      offset: args.offset,
      maxFetchItems: args.maxFetchItems,
      sortBy: args.sortBy,
      sortOrder: args.sortOrder
    };

    const result = await searchService.search(searchParams);

    // Format response for MCP
    if (result.success) {
      const response: any = {
        success: true,
        platform: result.platform,
        totalCount: result.metadata.totalCount,
        returnedCount: result.metadata.returnedCount,
        searchTime: `${result.metadata.searchTime}ms`
      };

      // Add applied filters
      if (result.metadata.filters.length > 0) {
        response.appliedFilters = result.metadata.filters;
      }

      // Add query if provided
      if (result.metadata.query) {
        response.searchQuery = result.metadata.query;
      }

      // Add grouped or flat results
      if (result.groupedBySpace) {
        response.groupedBySpace = result.groupedBySpace.map(group => ({
          space: group.space,
          count: group.count,
          items: group.items.map(formatResultItem)
        }));
      } else if (result.groupedByType) {
        response.groupedByType = result.groupedByType.map(group => ({
          type: group.type,
          count: group.count,
          items: group.items.map(formatResultItem)
        }));
      } else {
        response.results = result.results.map(formatResultItem);
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }]
      };
    } else {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: result.error,
            platform: result.platform
          }, null, 2)
        }]
      };
    }
  } catch (error: any) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: error.message || 'Search failed'
        }, null, 2)
      }]
    };
  }
}

function formatResultItem(item: any) {
  const formatted: any = {
    id: item.id,                       // resourceId - use this for other tools
    resourceId: item.resourceId,       // Explicit resourceId for clarity
    resourceType: item.resourceType,   // Original resource type from API
    name: item.name,
    type: item.type                    // Normalized type
  };

  // Include itemId if available (Cloud only)
  if (item.itemId && item.itemId !== item.id) {
    formatted.itemId = item.itemId;    // Items API id (only for items API operations)
  }

  if (item.description) {
    formatted.description = item.description;
  }

  formatted.owner = item.owner.name || item.owner.id;
  formatted.space = item.space.name || item.space.id;
  formatted.spaceType = item.space.type;

  if (item.modified) {
    formatted.modified = item.modified;
  }

  if (item.url) {
    formatted.url = item.url;
  }

  if (item.tags && item.tags.length > 0) {
    formatted.tags = item.tags;
  }

  if (item.reloadInfo) {
    formatted.reloadStatus = item.reloadInfo.status;
    formatted.lastReload = item.reloadInfo.lastReload;
  }

  return formatted;
}
