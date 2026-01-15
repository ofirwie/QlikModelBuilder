/**
 * Space Catalog Service
 * Handles space management, member resolution, and space statistics
 */

import { ApiClient, ResolvedUser } from '../../utils/api-client';
import { CacheManager } from '../../utils/cache-manager';
import { logger } from '../../utils/logger.js';
import {
  SpaceCatalogSearchOptions,
  SpaceCatalogResult,
  QlikSpace,
  SpaceMember,
  SpaceStatistics,
  SpaceFacets,
  SpaceSummary,
  MainItemType,
  DatasetSubType
} from './catalog-types';

const log = logger.child({ service: 'SpaceCatalog' });

export class SpaceCatalogService {
  private readonly apiClient: ApiClient;
  private readonly cacheManager: CacheManager;

  private spacesCache = new Map<string, QlikSpace[]>();
  private spaceDetailsCache = new Map<string, QlikSpace>();

  private searchPerformance = {
    totalSearches: 0,
    cacheHits: 0,
    apiCalls: 0,
    averageSearchTime: 0
  };

  constructor(apiClient: ApiClient, cacheManager: CacheManager) {
    this.apiClient = apiClient;
    this.cacheManager = cacheManager;
    logger.debug('[SpaceCatalogService] Initialized');
  }

  /**
   * Get spaces catalog with optional filtering
   */
  async getSpacesCatalog(options: SpaceCatalogSearchOptions & {
    force?: boolean;
    useCache?: boolean;
    includeMembers?: boolean;
    includeCounts?: boolean;
    getAllSpaces?: boolean;
    maxSpaces?: number;
  } = {}): Promise<SpaceCatalogResult> {
    const startTime = Date.now();
    this.searchPerformance.totalSearches++;

    const isSearch = !!(options.query || options.spaceType || options.ownerId ||
                       options.memberUserId || options.hasDataAssets);

    const {
      force = false,
      useCache = true,
      includeMembers = true,
      includeCounts = true,
      getAllSpaces = false,
      maxSpaces,
      ...filterOptions
    } = options;

    logger.debug(`[SpaceCatalogService] Operation: ${isSearch ? 'search' : 'scan'}, includeCounts: ${includeCounts}`);

    try {
      const needsAllSpaces = getAllSpaces || maxSpaces !== undefined;
      const cacheKey = this.generateCacheKey({
        ...options,
        getAllSpaces: needsAllSpaces,
        effectiveLimit: needsAllSpaces ? (maxSpaces || 'all') : options.limit
      });

      if (!force && useCache && this.spacesCache.has(cacheKey)) {
        logger.debug('[SpaceCatalogService] Returning cached results');
        this.searchPerformance.cacheHits++;
        const cachedSpaces = this.spacesCache.get(cacheKey);

        if (cachedSpaces) {
          const searchTime = Date.now() - startTime;
          return this.buildCatalogResult(cachedSpaces, cachedSpaces.length, searchTime);
        }
      }

      let allSpaces: QlikSpace[];

      if (needsAllSpaces) {
        logger.debug(`[SpaceCatalogService] Fetching ALL spaces (maxSpaces: ${maxSpaces || 'unlimited'})`);
        allSpaces = await this.fetchAllSpacesWithPagination({
          ...filterOptions,
          targetCount: maxSpaces,
          includeMembers
        });
      } else if (options.query || options.spaceType || options.ownerId) {
        logger.debug('[SpaceCatalogService] Using filtered search strategy');
        allSpaces = await this.fetchFilteredSpaces(options);
      } else {
        logger.debug('[SpaceCatalogService] Using full catalog scan strategy');
        allSpaces = await this.fetchAllSpaces(options);
      }

      let filteredSpaces = allSpaces;

      if (options.memberUserId) {
        filteredSpaces = filteredSpaces.filter(space =>
          space.members?.some(member => member.userId === options.memberUserId)
        );
      }

      if (options.hasDataAssets !== undefined) {
        filteredSpaces = filteredSpaces.filter(space =>
          options.hasDataAssets ?
            (space.dataAssets?.length ?? 0) > 0 :
            (space.dataAssets?.length ?? 0) === 0
        );
      }

      if (options.minItems !== undefined && options.minItems !== null) {
        const minItemsValue = options.minItems;
        filteredSpaces = filteredSpaces.filter(space =>
          (space.statistics?.totalItems ?? 0) >= minItemsValue
        );
      }

      if (options.sortBy) {
        filteredSpaces = this.sortSpaces(filteredSpaces, options.sortBy, options.sortOrder);
      }

      const totalBeforePagination = filteredSpaces.length;
      let paginatedSpaces = filteredSpaces;

      if (!needsAllSpaces) {
        const offset = options.offset || 0;
        const limit = options.limit || 100;
        paginatedSpaces = filteredSpaces.slice(offset, offset + limit);
      }

      if (useCache) {
        this.spacesCache.set(cacheKey, paginatedSpaces);
      }

      const searchTime = Date.now() - startTime;
      this.updatePerformanceMetrics(searchTime);

      return this.buildCatalogResult(paginatedSpaces, totalBeforePagination, searchTime);
    } catch (error) {
      log.debug('[SpaceCatalogService] Failed to get spaces catalog:', error);
      throw error;
    }
  }

  /**
   * Get detailed information about a specific space
   */
  async getSpaceDetails(
    spaceId: string,
    includeMembers: boolean = true,
    includeItems: boolean = true
  ): Promise<QlikSpace | null> {
    try {
      logger.debug(`[SpaceCatalogService] Getting details for space: ${spaceId}`);

      const cacheKey = spaceId;
      if (this.spaceDetailsCache.has(cacheKey)) {
        return this.spaceDetailsCache.get(cacheKey)!;
      }

      const spaceInfo = await this.apiClient.makeRequest(`/api/v1/spaces/${spaceId}`, 'GET');

      const ownerId = spaceInfo.ownerId || spaceInfo.owner?.id;
      const resolvedUsers = ownerId ?
        await this.apiClient.resolveOwnersToUsers([ownerId]) :
        new Map<string, ResolvedUser>();

      const detailedSpace = await this.createFullSpace(
        spaceInfo,
        includeMembers,
        includeItems
      );

      this.spaceDetailsCache.set(cacheKey, detailedSpace);

      return detailedSpace;
    } catch (error) {
      log.debug(`[SpaceCatalogService] Failed to get space details for ${spaceId}:`, error);
      return null;
    }
  }

  /**
   * Fetch space members with resolved names
   */
  async fetchSpaceMembers(spaceId: string): Promise<SpaceMember[]> {
    try {
      const response = await this.apiClient.makeRequest(`/api/v1/spaces/${spaceId}/assignments`, 'GET');
      const members = response.data || response || [];

      const userIds = members
        .map((member: any) => member.assigneeId)
        .filter(Boolean);

      if (userIds.length === 0) return members;

      logger.debug(`[SpaceCatalogService] Resolving ${userIds.length} member names for space ${spaceId}`);
      const resolvedUsers = await this.apiClient.resolveOwnersToUsers(userIds);

      const enhancedMembers = members.map((member: any) => {
        const actualUserId = member.assigneeId;
        const resolvedUser = resolvedUsers.get(actualUserId);

        return {
          ...member,
          userId: actualUserId,
          userName: resolvedUser?.displayName || `User ${actualUserId?.substring(0, 8)}...`,
          userEmail: resolvedUser?.email || 'unknown@example.com',
          role: member.roles?.[0] || 'member',
          status: resolvedUser?.status || 'unknown',
          isActive: true
        };
      });

      logger.debug(`[SpaceCatalogService] Resolved ${enhancedMembers.length} members with names`);
      return enhancedMembers;
    } catch (error) {
      log.debug(`[SpaceCatalogService] Failed to fetch members for space ${spaceId}:`, error);
      return [];
    }
  }

  /**
   * Get lightweight counts for a space
   */
  async getSpaceCounts(spaceId: string): Promise<{ itemCount: number; memberCount: number }> {
    try {
      logger.debug(`[SpaceCatalogService] Getting counts for space ${spaceId}`);

      const seenItemIds = new Set<string>();
      let currentUrl: string | null = `/items?spaceId=${spaceId}&limit=100&offset=0`;
      let pageNum = 1;

      while (currentUrl) {
        const itemsResponse = await this.apiClient.makeRequest(currentUrl, 'GET');
        const items = itemsResponse?.data || [];

        let newItems = 0;
        for (const item of items) {
          if (item.id && !seenItemIds.has(item.id)) {
            seenItemIds.add(item.id);
            newItems++;
          }
        }

        if (itemsResponse?.links?.next?.href) {
          let nextHref = itemsResponse.links.next.href;
          nextHref = nextHref.replace('/api/v1/', '/');

          if (nextHref.startsWith('http')) {
            const url = new URL(nextHref);
            currentUrl = url.pathname.replace('/api/v1/', '/') + url.search;
          } else {
            currentUrl = nextHref;
          }
        } else {
          currentUrl = null;
        }

        pageNum++;
        if (pageNum > 50) break;
      }

      const membersResponse = await this.apiClient.makeRequest(
        `/api/v1/spaces/${spaceId}/assignments?limit=100`,
        'GET'
      );
      const memberCount = (membersResponse?.data || []).length;

      return { itemCount: seenItemIds.size, memberCount };
    } catch (error) {
      logger.debug(`[SpaceCatalogService] Failed: ${error instanceof Error ? error.message : String(error)}`);
      return { itemCount: 0, memberCount: 0 };
    }
  }

  /**
   * Get data connections for a space
   */
  async getSpaceDataConnections(spaceId: string): Promise<any[]> {
    try {
      const response = await this.apiClient.makeRequest(`/api/v1/data-connections?spaceId=${spaceId}`, 'GET');
      return response.data || response || [];
    } catch (error) {
      log.debug(`[SpaceCatalogService] Failed to get data connections for space ${spaceId}:`, error);
      return [];
    }
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.spacesCache.clear();
    this.spaceDetailsCache.clear();
    logger.debug('[SpaceCatalogService] All caches cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): any {
    return {
      spacesCache: this.spacesCache.size,
      spaceDetailsCache: this.spaceDetailsCache.size,
      performance: this.searchPerformance
    };
  }

  // ===== PRIVATE METHODS =====

  private async fetchAllSpacesWithPagination(options: {
    targetCount?: number;
    includeMembers?: boolean;
    includeItems?: boolean;
    query?: string;
    spaceType?: string;
    ownerId?: string;
  }): Promise<QlikSpace[]> {
    const allSpaces: any[] = [];
    let offset = 0;
    const batchSize = 100;
    let hasMore = true;
    const targetCount = options.targetCount || Infinity;

    while (hasMore && allSpaces.length < targetCount) {
      const params = new URLSearchParams();
      params.set('limit', String(batchSize));
      params.set('offset', String(offset));

      if (options.query) params.set('query', options.query);
      if (options.ownerId) params.set('ownerId', options.ownerId);
      if (options.spaceType && options.spaceType !== 'all') {
        params.set('type', options.spaceType);
      }

      const url = `/api/v1/spaces?${params.toString()}`;
      const response = await this.apiClient.makeRequest(url, 'GET');
      const batch = response.data || response || [];

      if (!Array.isArray(batch) || batch.length === 0) {
        hasMore = false;
      } else {
        const remaining = targetCount - allSpaces.length;
        const toAdd = batch.slice(0, remaining);
        allSpaces.push(...toAdd);

        offset += batch.length;
        hasMore = batch.length === batchSize && allSpaces.length < targetCount;
      }
    }

    if (options.includeMembers || options.includeItems) {
      return await this.enrichSpaces(allSpaces, {
        includeMembers: options.includeMembers,
        includeItems: options.includeItems
      });
    }

    return allSpaces;
  }

  private async fetchAllSpaces(options: Partial<SpaceCatalogSearchOptions>): Promise<QlikSpace[]> {
    this.searchPerformance.apiCalls++;

    const allSpaces: any[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const spacesUrl = `/api/v1/spaces?limit=${limit}&offset=${offset}`;
      const response = await this.apiClient.makeRequest(spacesUrl, 'GET');
      const spaces = response.data || response || [];

      if (spaces.length === 0) {
        hasMore = false;
      } else {
        allSpaces.push(...spaces);
        hasMore = spaces.length === limit;
        offset += spaces.length;
      }
    }

    return this.enrichSpaces(allSpaces, options);
  }

  private async fetchFilteredSpaces(options: SpaceCatalogSearchOptions): Promise<QlikSpace[]> {
    this.searchPerformance.apiCalls++;

    let allMatchingSpaces: any[] = [];

    if (options.query && options.query.trim().split(/\s+/).length > 1) {
      allMatchingSpaces = await this.fetchSpacesWithQuery(options, options.query);

      if (allMatchingSpaces.length === 0) {
        const tokens = options.query.toLowerCase().split(/\s+/).filter(t => t.length > 0);

        for (const token of tokens) {
          const tokenResults = await this.fetchSpacesWithQuery(options, token);

          for (const space of tokenResults) {
            if (!allMatchingSpaces.find(s => s.id === space.id)) {
              allMatchingSpaces.push(space);
            }
          }
        }
      }
    } else {
      allMatchingSpaces = await this.fetchSpacesWithQuery(options, options.query);
    }

    const enrichedSpaces = await this.enrichSpaces(allMatchingSpaces, options);

    if (options.query && options.query.trim().split(/\s+/).length > 1) {
      return this.performTokenBasedSearch(enrichedSpaces, options.query);
    }

    return enrichedSpaces;
  }

  private async fetchSpacesWithQuery(options: SpaceCatalogSearchOptions, query?: string): Promise<any[]> {
    const allSpaces: any[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const params = this.buildApiQueryParams({ ...options, query }, offset, limit);
      const spacesUrl = `/api/v1/spaces?${params.toString()}`;

      const response = await this.apiClient.makeRequest(spacesUrl, 'GET');
      const spaces = response.data || response || [];

      if (spaces.length === 0) {
        hasMore = false;
      } else {
        allSpaces.push(...spaces);
        hasMore = spaces.length === limit;
        offset += spaces.length;
      }
    }

    return allSpaces;
  }

  private performTokenBasedSearch(spaces: QlikSpace[], query: string): QlikSpace[] {
    const queryLower = query.toLowerCase();
    const queryTokens = queryLower.split(/[\s,._\-\/]+/).filter(t => t.length > 0);

    const scoredSpaces = spaces.map(space => {
      let score = 0;
      let matchedTokens = 0;

      const searchableContent = [
        space.name,
        space.description,
        space.spaceInfo.ownerName,
        ...space.members.map(m => m.userName),
        ...space.dataAssets.map(d => d.name),
        ...space.spaceItems.map(i => i.name)
      ].filter(Boolean).join(' ').toLowerCase();

      for (const token of queryTokens) {
        if (searchableContent.includes(token)) {
          matchedTokens++;

          if (space.name.toLowerCase().includes(token)) {
            score += 10;
          } else if (space.description?.toLowerCase().includes(token)) {
            score += 5;
          } else {
            score += 1;
          }
        }
      }

      if (matchedTokens === queryTokens.length) {
        score += 20;
      }

      return { space, score, matchedTokens };
    });

    return scoredSpaces
      .filter(item => item.matchedTokens > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.space);
  }

  private buildApiQueryParams(options: SpaceCatalogSearchOptions, offset: number, limit: number): URLSearchParams {
    const params = new URLSearchParams();

    params.append('limit', limit.toString());
    params.append('offset', offset.toString());

    if (options.query) {
      params.append('name', options.query);
    }

    if (options.spaceType && options.spaceType !== 'all') {
      params.append('type', options.spaceType);
    }

    if (options.ownerId) {
      params.append('ownerId', options.ownerId);
    }

    if (options.sortBy) {
      const sortPrefix = options.sortOrder === 'desc' ? '-' : '+';
      const sortField = this.mapSortField(options.sortBy);
      params.append('sort', `${sortPrefix}${sortField}`);
    }

    return params;
  }

  private mapSortField(sortBy: string): string {
    const mapping: Record<string, string> = {
      'created': 'createdAt',
      'modified': 'updatedAt',
      'name': 'name',
      'itemCount': 'name',
      'memberCount': 'name'
    };

    return mapping[sortBy] || 'name';
  }

  private async enrichSpaces(
    spaces: any[],
    options: Partial<SpaceCatalogSearchOptions>
  ): Promise<QlikSpace[]> {
    if (spaces.length === 0) return [];

    const ownerIds = [...new Set(spaces
      .map(s => s.ownerId || s.owner?.id)
      .filter(Boolean))] as string[];

    const resolvedUsers = ownerIds.length > 0 ?
      await this.apiClient.resolveOwnersToUsers(ownerIds) :
      new Map<string, ResolvedUser>();

    const enrichedSpaces = await Promise.all(
      spaces.map(async (spaceInfo) => {
        try {
          const shouldFetchMembers = options.includeMembers !== false;
          const shouldFetchItems = options.includeItems === true;

          if (shouldFetchMembers || shouldFetchItems) {
            const detailedSpace = await this.getSpaceDetails(
              spaceInfo.id,
              shouldFetchMembers,
              shouldFetchItems
            );
            return detailedSpace || this.createBasicSpace(spaceInfo, resolvedUsers);
          }

          let basicSpace = this.createBasicSpace(spaceInfo, resolvedUsers);

          const counts = await this.getSpaceCounts(spaceInfo.id);
          basicSpace.statistics.totalItems = counts.itemCount;
          basicSpace.statistics.totalMembers = counts.memberCount;
          basicSpace.statistics.storageUsed = 0;

          return basicSpace;
        } catch (error) {
          log.debug(`[SpaceCatalogService] Failed to enrich space ${spaceInfo.id}:`, error);
          return this.createBasicSpace(spaceInfo, resolvedUsers);
        }
      })
    );

    return enrichedSpaces;
  }

  private async createFullSpace(
    spaceInfo: any,
    includeMembers: boolean,
    includeItems: boolean
  ): Promise<QlikSpace> {
    const ownerId = spaceInfo.ownerId || spaceInfo.owner?.id;
    const resolvedUsers = ownerId ?
      await this.apiClient.resolveOwnersToUsers([ownerId]) :
      new Map<string, ResolvedUser>();

    const ownerUser = ownerId ? resolvedUsers.get(ownerId) : null;

    const members = includeMembers ?
      await this.fetchSpaceMembers(spaceInfo.id) : [];

    const counts = await this.getSpaceCounts(spaceInfo.id);

    const membersByRole: Record<string, number> = {};
    members.forEach((member: any) => {
      const role = member.roles?.[0] || member.role || 'member';
      membersByRole[role] = (membersByRole[role] || 0) + 1;
    });

    const statistics: SpaceStatistics = {
      totalItems: counts.itemCount,
      itemsByType: {},
      totalMembers: counts.memberCount,
      membersByRole: membersByRole,
      lastActivity: spaceInfo.updatedAt || spaceInfo.createdAt || '',
      storageUsed: 0
    };

    return {
      id: spaceInfo.id,
      name: spaceInfo.name || 'Unnamed Space',
      description: spaceInfo.description || '',
      type: spaceInfo.type || 'shared',
      spaceInfo: {
        ownerId: ownerId,
        ownerName: ownerUser?.displayName || 'Unknown Owner',
        ownerEmail: ownerUser?.email || '',
        createdDate: spaceInfo.createdAt || '',
        modifiedDate: spaceInfo.updatedAt || '',
        isActive: true,
        visibility: 'private'
      },
      members: members,
      dataAssets: [],
      spaceItems: [],
      statistics: statistics
    };
  }

  private createBasicSpace(
    spaceInfo: any,
    resolvedUsers: Map<string, ResolvedUser>
  ): QlikSpace {
    const ownerId = spaceInfo.ownerId || spaceInfo.owner?.id;
    const ownerUser = ownerId ? resolvedUsers.get(ownerId) : null;

    const basicStats = {
      totalItems: -1,
      itemsByType: {},
      totalMembers: -1,
      membersByRole: {},
      lastActivity: spaceInfo.updatedAt || spaceInfo.createdAt,
      storageUsed: -1
    };

    return {
      id: spaceInfo.id,
      name: spaceInfo.name,
      description: spaceInfo.description || '',
      type: spaceInfo.type || 'unknown',
      spaceInfo: {
        ownerId: ownerId || 'unknown',
        ownerName: ownerUser?.displayName || 'Unknown',
        ownerEmail: ownerUser?.email || 'unknown@example.com',
        createdDate: spaceInfo.createdAt || new Date().toISOString(),
        modifiedDate: spaceInfo.updatedAt || new Date().toISOString(),
        isActive: true,
        visibility: spaceInfo.visibility || 'private'
      },
      members: [],
      dataAssets: [],
      spaceItems: [],
      statistics: basicStats
    };
  }

  private sortSpaces(spaces: QlikSpace[], sortBy?: string, sortOrder?: string): QlikSpace[] {
    const order = sortOrder === 'desc' ? -1 : 1;

    return [...spaces].sort((a: QlikSpace, b: QlikSpace) => {
      switch (sortBy) {
        case 'created':
          return order * (new Date(a.spaceInfo.createdDate).getTime() - new Date(b.spaceInfo.createdDate).getTime());
        case 'modified':
          return order * (new Date(a.spaceInfo.modifiedDate).getTime() - new Date(b.spaceInfo.modifiedDate).getTime());
        case 'itemCount':
          return order * (a.statistics.totalItems - b.statistics.totalItems);
        case 'memberCount':
          return order * (a.statistics.totalMembers - b.statistics.totalMembers);
        case 'name':
        default:
          return order * a.name.localeCompare(b.name);
      }
    });
  }

  private buildFacets(spaces: QlikSpace[]): SpaceFacets {
    const spaceTypeCount = this.groupBy(spaces, 'type');
    const ownerCount = new Map<string, { count: number; name: string }>();

    spaces.forEach((space: QlikSpace) => {
      const ownerId = space.spaceInfo.ownerId;
      if (!ownerCount.has(ownerId)) {
        ownerCount.set(ownerId, { count: 0, name: space.spaceInfo.ownerName });
      }
      ownerCount.get(ownerId)!.count++;
    });

    const itemTypeCounts: Record<string, number> = {};
    spaces.forEach((space: QlikSpace) => {
      if (space.statistics.itemsByType) {
        Object.entries(space.statistics.itemsByType).forEach(([type, count]) => {
          itemTypeCounts[type] = (itemTypeCounts[type] || 0) + count;
        });
      }
    });

    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const activityRanges = {
      'last24Hours': 0,
      'lastWeek': 0,
      'lastMonth': 0,
      'older': 0
    };

    spaces.forEach((space: QlikSpace) => {
      const lastActivity = new Date(space.statistics.lastActivity);
      if (lastActivity > dayAgo) activityRanges.last24Hours++;
      else if (lastActivity > weekAgo) activityRanges.lastWeek++;
      else if (lastActivity > monthAgo) activityRanges.lastMonth++;
      else activityRanges.older++;
    });

    return {
      spaceTypes: Object.entries(spaceTypeCount).map(([type, count]) => ({ type, count })),
      owners: Array.from(ownerCount.entries())
        .map(([ownerId, data]) => ({ ownerId, ownerName: data.name, count: data.count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      itemTypes: Object.entries(itemTypeCounts).map(([type, count]) => ({ type, count })),
      activityRanges: Object.entries(activityRanges).map(([range, count]) => ({ range, count }))
    };
  }

  private buildSummary(allSpaces: QlikSpace[]): SpaceSummary {
    return {
      totalSpaces: allSpaces.length,
      totalItems: allSpaces.reduce((sum, space) => sum + space.statistics.totalItems, 0),
      totalMembers: allSpaces.reduce((sum, space) => sum + space.statistics.totalMembers, 0),
      totalDataAssets: allSpaces.reduce((sum, space) =>
        sum + (space.statistics.dataAssetsCount || 0), 0),

      averageStats: {
        itemsPerSpace: allSpaces.length > 0
          ? allSpaces.reduce((sum, space) => sum + space.statistics.totalItems, 0) / allSpaces.length
          : 0,
        membersPerSpace: allSpaces.length > 0
          ? allSpaces.reduce((sum, space) => sum + space.statistics.totalMembers, 0) / allSpaces.length
          : 0
      },

      topSpacesByItems: allSpaces
        .sort((a, b) => b.statistics.totalItems - a.statistics.totalItems)
        .slice(0, 10)
        .map(space => ({
          name: space.name,
          items: space.statistics.totalItems,
          type: space.type
        })),

      topSpacesByMembers: allSpaces
        .sort((a, b) => b.statistics.totalMembers - a.statistics.totalMembers)
        .slice(0, 10)
        .map(space => ({
          name: space.name,
          members: space.statistics.totalMembers,
          type: space.type
        })),

      recentActivity: allSpaces
        .sort((a, b) => new Date(b.statistics.lastActivity).getTime() - new Date(a.statistics.lastActivity).getTime())
        .slice(0, 10)
        .map(space => ({
          name: space.name,
          lastActivity: space.statistics.lastActivity,
          type: space.type
        }))
    };
  }

  private buildCatalogResult(
    spaces: QlikSpace[],
    totalBeforePagination: number,
    searchTime: number
  ): SpaceCatalogResult {
    const facets = this.buildFacets(spaces);
    const summary = this.buildSummary(spaces);

    return {
      spaces,
      totalCount: totalBeforePagination || spaces.length,
      searchTime,
      facets,
      summary
    };
  }

  private generateCacheKey(options: any): string {
    const keyParts = [
      'spaces',
      options.query || '',
      options.spaceType || 'all',
      options.ownerId || '',
      options.memberUserId || '',
      options.hasDataAssets !== undefined ? `hasData:${options.hasDataAssets}` : '',
      options.minItems || '',
      options.sortBy || '',
      options.sortOrder || '',
      options.includeMembers ? 'members' : '',
      options.includeItems ? 'items' : '',
      options.getAllSpaces ? 'getAllSpaces' : '',
      options.effectiveLimit || options.limit || '100',
      options.offset || '0'
    ];

    return keyParts.filter(Boolean).join(':');
  }

  private updatePerformanceMetrics(searchTime: number): void {
    this.searchPerformance.averageSearchTime =
      (this.searchPerformance.averageSearchTime * (this.searchPerformance.totalSearches - 1) + searchTime) /
      this.searchPerformance.totalSearches;
  }

  private groupBy<T>(array: T[], key: keyof T): Record<string, number> {
    return array.reduce((result: Record<string, number>, item) => {
      const value = String(item[key]);
      result[value] = (result[value] || 0) + 1;
      return result;
    }, {});
  }
}
