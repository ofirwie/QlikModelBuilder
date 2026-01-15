/**
 * Unified Search Service
 * Provides search functionality for both Cloud and On-Premise deployments
 * Replaces: app-search-service.ts, get_space_items functionality
 */

import { ApiClient } from '../utils/api-client.js';
import { CacheManager } from '../utils/cache-manager.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ service: 'UnifiedSearch' });

// ===== INTERFACES =====

export interface SearchParams {
  // What to search
  query?: string;
  types?: string[];  // 'app', 'dataset', 'automation', 'dataconnection', 'all'

  // Where to search
  spaceId?: string;
  spaceName?: string;
  allSpaces?: boolean;

  // Filters
  ownerId?: string;
  ownerName?: string;
  tags?: string[];

  // Date filters
  createdAfter?: string;   // ISO date - items created after this date
  createdBefore?: string;  // ISO date - items created before this date
  modifiedAfter?: string;  // ISO date - items modified after this date
  modifiedBefore?: string; // ISO date - items modified before this date

  // Options
  includeReloadInfo?: boolean;
  includeDetails?: boolean;
  groupBy?: 'none' | 'space' | 'type';

  // Pagination & Limits
  limit?: number;           // Max items to return (after filtering)
  offset?: number;          // Offset for pagination
  maxFetchItems?: number;   // Max items to fetch from API (default: 10000)
  sortBy?: 'name' | 'modified' | 'created' | 'type';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchResult {
  id: string;           // resourceId - use this for other tools (apps, datasets, etc.)
  itemId?: string;      // items API id - only for items API operations
  resourceId: string;   // explicit resourceId for clarity
  resourceType: string; // original resource type from API (app, dataset, qvapp, etc.)
  name: string;
  type: string;         // normalized type (app, dataset, automation, etc.)
  description?: string;
  owner: {
    id: string;
    name: string;
    email?: string;
  };
  space: {
    id: string;
    name: string;
    type: string;
  };
  created: string;
  modified: string;
  size?: number;
  url?: string;
  tags?: string[];
  reloadInfo?: {
    status: string;
    lastReload: string;
  };
}

export interface SearchResponse {
  success: boolean;
  platform: 'cloud' | 'on-premise';
  results: SearchResult[];
  groupedBySpace?: Array<{
    space: { id: string; name: string; type: string };
    count: number;
    items: SearchResult[];
  }>;
  groupedByType?: Array<{
    type: string;
    count: number;
    items: SearchResult[];
  }>;
  metadata: {
    totalCount: number;
    returnedCount: number;
    searchTime: number;
    query?: string;
    filters: string[];
  };
  error?: string;
}

// ===== SERVICE CLASS =====

export class UnifiedSearchService {
  private apiClient: ApiClient;
  private cacheManager: CacheManager;
  private platform: 'cloud' | 'on-premise';
  private tenantUrl: string;

  constructor(
    apiClient: ApiClient,
    cacheManager: CacheManager,
    platform: 'cloud' | 'on-premise',
    tenantUrl: string
  ) {
    this.apiClient = apiClient;
    this.cacheManager = cacheManager;
    this.platform = platform;
    this.tenantUrl = tenantUrl;
  }

  // ===== MAIN SEARCH METHOD =====

  async search(params: SearchParams): Promise<SearchResponse> {
    const startTime = Date.now();
    const filters: string[] = [];

    try {
      // Set defaults
      const limit = params.limit || 50;
      const offset = params.offset || 0;
      const types = params.types || ['all'];
      const groupBy = params.groupBy || 'none';

      // Track filters applied
      if (params.query) filters.push(`query: "${params.query}"`);
      if (params.spaceId) filters.push(`spaceId: ${params.spaceId}`);
      if (params.spaceName) filters.push(`spaceName: "${params.spaceName}"`);
      if (params.ownerId) filters.push(`ownerId: ${params.ownerId}`);
      if (params.ownerName) filters.push(`ownerName: "${params.ownerName}"`);
      if (params.types && !params.types.includes('all')) filters.push(`types: ${params.types.join(', ')}`);

      // Route to platform-specific search
      let results: SearchResult[];
      if (this.platform === 'cloud') {
        results = await this.searchCloud(params, limit, offset);
      } else {
        results = await this.searchOnPrem(params, limit, offset);
      }

      // Apply text search filter if query provided
      if (params.query) {
        results = this.filterByQuery(results, params.query);
      }

      // Apply type filter
      if (!types.includes('all')) {
        results = results.filter(r => types.includes(r.type));
      }

      // Apply owner filter
      if (params.ownerName) {
        const ownerLower = params.ownerName.toLowerCase();
        results = results.filter(r =>
          r.owner.name?.toLowerCase().includes(ownerLower) ||
          r.owner.email?.toLowerCase().includes(ownerLower)
        );
      }

      // Apply date filters
      if (params.createdAfter) {
        const createdAfterDate = new Date(params.createdAfter).getTime();
        results = results.filter(r => {
          const created = new Date(r.created).getTime();
          return !isNaN(created) && created >= createdAfterDate;
        });
        filters.push(`createdAfter: ${params.createdAfter}`);
      }

      if (params.modifiedAfter) {
        const modifiedAfterDate = new Date(params.modifiedAfter).getTime();
        results = results.filter(r => {
          const modified = new Date(r.modified).getTime();
          return !isNaN(modified) && modified >= modifiedAfterDate;
        });
        filters.push(`modifiedAfter: ${params.modifiedAfter}`);
      }

      if (params.createdBefore) {
        const createdBeforeDate = new Date(params.createdBefore).getTime();
        results = results.filter(r => {
          const created = new Date(r.created).getTime();
          return !isNaN(created) && created <= createdBeforeDate;
        });
        filters.push(`createdBefore: ${params.createdBefore}`);
      }

      if (params.modifiedBefore) {
        const modifiedBeforeDate = new Date(params.modifiedBefore).getTime();
        results = results.filter(r => {
          const modified = new Date(r.modified).getTime();
          return !isNaN(modified) && modified <= modifiedBeforeDate;
        });
        filters.push(`modifiedBefore: ${params.modifiedBefore}`);
      }

      // Apply tags filter
      if (params.tags && params.tags.length > 0) {
        const searchTags = params.tags.map(t => t.toLowerCase());
        results = results.filter(r => {
          if (!r.tags || r.tags.length === 0) return false;
          const itemTags = r.tags.map(t => t.toLowerCase());
          return searchTags.some(st => itemTags.includes(st));
        });
        filters.push(`tags: ${params.tags.join(', ')}`);
      }

      // Apply sorting
      results = this.sortResults(results, params.sortBy || 'name', params.sortOrder || 'asc');

      // Apply pagination
      const totalCount = results.length;
      results = results.slice(offset, offset + limit);

      // Build response
      const response: SearchResponse = {
        success: true,
        platform: this.platform,
        results: results,
        metadata: {
          totalCount: totalCount,
          returnedCount: results.length,
          searchTime: Date.now() - startTime,
          query: params.query,
          filters: filters
        }
      };

      // Group if requested
      if (groupBy === 'space') {
        response.groupedBySpace = this.groupBySpace(results);
      } else if (groupBy === 'type') {
        response.groupedByType = this.groupByType(results);
      }

      return response;

    } catch (error) {
      return {
        success: false,
        platform: this.platform,
        results: [],
        metadata: {
          totalCount: 0,
          returnedCount: 0,
          searchTime: Date.now() - startTime,
          query: params.query,
          filters: filters
        },
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  // ===== CLOUD SEARCH =====

  private async searchCloud(params: SearchParams, limit: number, offset: number): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    // Resolve space name to ID if needed
    let spaceId = params.spaceId;
    if (params.spaceName && !spaceId) {
      spaceId = await this.resolveSpaceNameCloud(params.spaceName);
    }

    // Determine resource types to fetch
    const types = params.types || ['all'];
    const resourceTypes: string[] = [];

    if (types.includes('all')) {
      resourceTypes.push('app', 'dataset', 'dataconnection');
    } else {
      if (types.includes('app')) resourceTypes.push('app');
      if (types.includes('dataset')) resourceTypes.push('dataset');
      if (types.includes('dataconnection')) resourceTypes.push('dataconnection');
      if (types.includes('automation')) resourceTypes.push('automation');
    }

    // Max items to fetch from API (default 10000, can be limited for performance)
    const maxFetchItems = params.maxFetchItems || 10000;

    // Fetch items for each resource type with cursor-based pagination
    for (const resourceType of resourceTypes) {
      try {
        const typeResults = await this.fetchAllItemsWithCursor(
          resourceType,
          spaceId,
          params.ownerId,
          maxFetchItems
        );
        for (const item of typeResults) {
          results.push(this.normalizeCloudItem(item, resourceType));
        }
      } catch (error) {
        log.debug(`[UnifiedSearch] Error fetching ${resourceType}:`, error);
      }
    }

    // Fetch reload info if requested (for apps only)
    if (params.includeReloadInfo) {
      await this.enrichWithReloadInfo(results);
    }

    return results;
  }

  /**
   * Fetch all items using cursor-based pagination
   * Handles the Qlik Cloud API pagination with links.next
   */
  private async fetchAllItemsWithCursor(
    resourceType: string,
    spaceId?: string,
    ownerId?: string,
    maxItems: number = 10000
  ): Promise<any[]> {
    const allItems: any[] = [];
    const pageSize = 100;
    let hasMore = true;
    let nextCursor: string | undefined;

    while (hasMore && allItems.length < maxItems) {
      // Build query parameters
      const queryParams = new URLSearchParams();
      queryParams.append('limit', pageSize.toString());
      queryParams.append('resourceType', resourceType);

      if (spaceId) queryParams.append('spaceId', spaceId);
      if (ownerId) queryParams.append('ownerId', ownerId);
      if (nextCursor) queryParams.append('next', nextCursor);

      try {
        const response = await this.apiClient.makeRequest(
          `/api/v1/items?${queryParams.toString()}`,
          'GET'
        );

        // Extract items from response
        const items = response.data || response || [];
        if (Array.isArray(items)) {
          allItems.push(...items);
        }

        // Check for next page cursor
        if (response.links?.next?.href) {
          // Extract cursor from next URL
          const nextUrl = new URL(response.links.next.href, 'https://dummy.com');
          nextCursor = nextUrl.searchParams.get('next') || undefined;
          hasMore = !!nextCursor;
        } else {
          hasMore = false;
        }

        // If we got fewer items than page size, we're done
        if (items.length < pageSize) {
          hasMore = false;
        }

      } catch (error) {
        log.debug(`[UnifiedSearch] Pagination error for ${resourceType}:`, error);
        hasMore = false;
      }
    }

    if (allItems.length >= maxItems) {
      log.debug(`[UnifiedSearch] Reached max items limit (${maxItems}) for ${resourceType}`);
    }

    return allItems;
  }

  private async resolveSpaceNameCloud(spaceName: string): Promise<string | undefined> {
    try {
      // Fetch all spaces with cursor-based pagination
      const allSpaces = await this.fetchAllSpacesWithCursor();
      const searchLower = spaceName.toLowerCase();

      const match = allSpaces.find((s: any) =>
        s.name?.toLowerCase().includes(searchLower)
      );

      return match?.id;
    } catch (error) {
      log.debug('[UnifiedSearch] Error resolving space name:', error);
      return undefined;
    }
  }

  /**
   * Fetch all spaces using cursor-based pagination
   */
  private async fetchAllSpacesWithCursor(maxSpaces: number = 5000): Promise<any[]> {
    const allSpaces: any[] = [];
    const pageSize = 100;
    let hasMore = true;
    let nextCursor: string | undefined;

    while (hasMore && allSpaces.length < maxSpaces) {
      const queryParams = new URLSearchParams();
      queryParams.append('limit', pageSize.toString());
      if (nextCursor) queryParams.append('next', nextCursor);

      try {
        const response = await this.apiClient.makeRequest(
          `/api/v1/spaces?${queryParams.toString()}`,
          'GET'
        );

        const spaces = response.data || response || [];
        if (Array.isArray(spaces)) {
          allSpaces.push(...spaces);
        }

        // Check for next page
        if (response.links?.next?.href) {
          const nextUrl = new URL(response.links.next.href, 'https://dummy.com');
          nextCursor = nextUrl.searchParams.get('next') || undefined;
          hasMore = !!nextCursor;
        } else {
          hasMore = false;
        }

        if (spaces.length < pageSize) {
          hasMore = false;
        }
      } catch (error) {
        log.debug('[UnifiedSearch] Spaces pagination error:', error);
        hasMore = false;
      }
    }

    return allSpaces;
  }

  private normalizeCloudItem(item: any, resourceType: string): SearchResult {
    // IMPORTANT: resourceId is the actual resource ID needed for other tools
    // id (from items API) is only for items API operations
    const resourceId = item.resourceId || item.id;
    const itemId = item.id;
    const originalResourceType = item.resourceType || resourceType;

    return {
      id: resourceId,                     // Use resourceId as primary id for other tools
      itemId: itemId,                     // Keep items API id for reference
      resourceId: resourceId,             // Explicit resourceId for clarity
      resourceType: originalResourceType, // Original resource type from API
      name: item.name || item.resourceAttributes?.name || 'Unknown',
      type: resourceType,                 // Normalized type
      description: item.description || item.resourceAttributes?.description || '',
      owner: {
        id: item.ownerId || item.resourceAttributes?.ownerId || '',
        name: item.ownerName || item.resourceAttributes?.owner || '',
        email: ''
      },
      space: {
        id: item.spaceId || item.resourceAttributes?.spaceId || '',
        name: item.spaceName || '',
        type: 'space'
      },
      created: item.createdAt || item.resourceCreatedAt || '',
      modified: item.updatedAt || item.resourceUpdatedAt || '',
      size: item.resourceSize || 0,
      url: this.generateUrl(resourceId, resourceType),
      tags: item.resourceAttributes?.tags || []
    };
  }

  private async enrichWithReloadInfo(results: SearchResult[]): Promise<void> {
    const apps = results.filter(r => r.type === 'app');

    for (const app of apps) {
      try {
        const reloads = await this.apiClient.makeRequest(
          `/api/v1/reloads?appId=${app.id}&limit=1`,
          'GET'
        );
        const lastReload = reloads.data?.[0] || reloads[0];

        if (lastReload) {
          app.reloadInfo = {
            status: lastReload.status || 'unknown',
            lastReload: lastReload.endTime || lastReload.createdAt || ''
          };
        }
      } catch (error) {
        // Silently skip reload info errors
      }
    }
  }

  // ===== ON-PREMISE SEARCH =====

  private async searchOnPrem(params: SearchParams, limit: number, offset: number): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    // Resolve stream name to ID if needed
    let streamId = params.spaceId;
    if (params.spaceName && !streamId) {
      streamId = await this.resolveStreamNameOnPrem(params.spaceName);
    }

    // Build QRS filter
    const filters: string[] = [];

    if (streamId) {
      filters.push(`stream.id eq ${streamId}`);
    }
    if (params.ownerId) {
      filters.push(`owner.id eq ${params.ownerId}`);
    }
    if (params.query) {
      // QRS uses 'so' for substring of (contains)
      filters.push(`name so '${params.query}'`);
    }

    const filterString = filters.length > 0 ? `?filter=${encodeURIComponent(filters.join(' and '))}` : '';

    // Fetch apps from QRS
    try {
      const apps = await this.apiClient.makeRequest(
        `/qrs/app/full${filterString}`,
        'GET'
      );

      for (const app of (apps || [])) {
        results.push(this.normalizeOnPremApp(app));
      }
    } catch (error) {
      log.debug('[UnifiedSearch] Error fetching on-prem apps:', error);
    }

    return results;
  }

  private async resolveStreamNameOnPrem(streamName: string): Promise<string | undefined> {
    try {
      const streams = await this.apiClient.makeRequest('/qrs/stream/full', 'GET');
      const searchLower = streamName.toLowerCase();

      const match = (streams || []).find((s: any) =>
        s.name?.toLowerCase().includes(searchLower)
      );

      return match?.id;
    } catch (error) {
      log.debug('[UnifiedSearch] Error resolving stream name:', error);
      return undefined;
    }
  }

  private normalizeOnPremApp(app: any): SearchResult {
    // On-Premise: app.id IS the resource ID (no separate items API)
    return {
      id: app.id,
      itemId: app.id,           // Same as id for on-prem
      resourceId: app.id,       // Explicit for clarity
      resourceType: 'App',      // QRS uses 'App' as type
      name: app.name || 'Unknown',
      type: 'app',              // Normalized type
      description: app.description || '',
      owner: {
        id: app.owner?.id || '',
        name: app.owner?.name || app.owner?.userId || '',
        email: ''
      },
      space: {
        id: app.stream?.id || '',
        name: app.stream?.name || 'No Stream',
        type: 'stream'
      },
      created: app.createdDate || '',
      modified: app.modifiedDate || '',
      size: app.fileSize || 0,
      url: this.generateOnPremUrl(app.id),
      tags: app.tags?.map((t: any) => t.name) || []
    };
  }

  // ===== UTILITY METHODS =====

  private filterByQuery(results: SearchResult[], query: string): SearchResult[] {
    const queryLower = query.toLowerCase();
    const terms = queryLower.split(/\s+/).filter(t => t.length > 0);

    return results.filter(item => {
      const searchText = [
        item.name,
        item.description,
        item.owner.name,
        ...(item.tags || [])
      ].join(' ').toLowerCase();

      return terms.every(term => searchText.includes(term));
    });
  }

  private sortResults(results: SearchResult[], sortBy: string, sortOrder: string): SearchResult[] {
    return results.sort((a, b) => {
      let valueA: any;
      let valueB: any;

      switch (sortBy) {
        case 'name':
          valueA = a.name.toLowerCase();
          valueB = b.name.toLowerCase();
          break;
        case 'modified':
          valueA = new Date(a.modified).getTime() || 0;
          valueB = new Date(b.modified).getTime() || 0;
          break;
        case 'created':
          valueA = new Date(a.created).getTime() || 0;
          valueB = new Date(b.created).getTime() || 0;
          break;
        case 'type':
          valueA = a.type;
          valueB = b.type;
          break;
        default:
          valueA = a.name.toLowerCase();
          valueB = b.name.toLowerCase();
      }

      if (valueA < valueB) return sortOrder === 'asc' ? -1 : 1;
      if (valueA > valueB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }

  private groupBySpace(results: SearchResult[]): Array<{ space: any; count: number; items: SearchResult[] }> {
    const groups = new Map<string, { space: any; items: SearchResult[] }>();

    for (const item of results) {
      const spaceId = item.space.id || 'no-space';
      if (!groups.has(spaceId)) {
        groups.set(spaceId, {
          space: item.space,
          items: []
        });
      }
      groups.get(spaceId)!.items.push(item);
    }

    return Array.from(groups.values()).map(g => ({
      space: g.space,
      count: g.items.length,
      items: g.items
    }));
  }

  private groupByType(results: SearchResult[]): Array<{ type: string; count: number; items: SearchResult[] }> {
    const groups = new Map<string, SearchResult[]>();

    for (const item of results) {
      if (!groups.has(item.type)) {
        groups.set(item.type, []);
      }
      groups.get(item.type)!.push(item);
    }

    return Array.from(groups.entries()).map(([type, items]) => ({
      type,
      count: items.length,
      items
    }));
  }

  private generateUrl(appId: string, resourceType: string): string {
    if (!appId || !this.tenantUrl) return '';
    const baseUrl = this.tenantUrl.replace(/\/api\/v1$/, '').replace(/\/$/, '');

    if (resourceType === 'app') {
      return `${baseUrl}/sense/app/${appId}`;
    }
    return '';
  }

  private generateOnPremUrl(appId: string): string {
    if (!appId || !this.tenantUrl) return '';
    const baseUrl = this.tenantUrl.replace(/\/$/, '');
    return `${baseUrl}/sense/app/${appId}`;
  }
}
