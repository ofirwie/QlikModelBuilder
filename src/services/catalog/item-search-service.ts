/**
 * Item Search Service
 * Handles space items search, filtering, grouping, and content statistics
 */

import { ApiClient } from '../../utils/api-client';
import { logger } from '../../utils/logger.js';
import { SpaceCatalogService } from './space-catalog-service';
import { DatasetService } from './dataset-service';
import {
  SpaceItemsOptions,
  SpaceItemsResult,
  SpaceItemResult,
  SpaceGroupResult,
  TypeGroupResult,
  EnhancedSpaceItem,
  ContentStatistics,
  QlikSpace,
  MainItemType
} from './catalog-types';

const log = logger.child({ service: 'ItemSearch' });

export class ItemSearchService {
  private readonly apiClient: ApiClient;
  private readonly spaceCatalogService: SpaceCatalogService;
  private readonly datasetService: DatasetService;
  private contentSearchIndex = new Map<string, Set<string>>();

  constructor(
    apiClient: ApiClient,
    spaceCatalogService: SpaceCatalogService,
    datasetService: DatasetService
  ) {
    this.apiClient = apiClient;
    this.spaceCatalogService = spaceCatalogService;
    this.datasetService = datasetService;
    logger.debug('[ItemSearchService] Initialized');
  }

  /**
   * Unified method to get items from spaces with flexible filtering
   */
  async getSpaceItems(options: SpaceItemsOptions = {}): Promise<SpaceItemsResult> {
    const startTime = Date.now();

    try {
      logger.debug(`[ItemSearchService] Getting space items with options: ${JSON.stringify(options)}`);

      // Handle date filtering
      let effectiveStartDate: string | null = null;
      let effectiveEndDate: string | null = null;

      if (options.startDate || options.endDate) {
        const now = new Date();
        const startDate = options.startDate ? new Date(options.startDate) : new Date(0);
        const endDate = options.endDate ? new Date(options.endDate) : now;

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          throw new Error('Invalid date format. Use ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)');
        }

        effectiveStartDate = startDate.toISOString();
        effectiveEndDate = endDate.toISOString();
      } else if (options.timeframe && options.timeframeUnit) {
        const now = new Date();
        const startDate = new Date();

        switch (options.timeframeUnit) {
          case 'hours':
            startDate.setHours(now.getHours() - options.timeframe);
            break;
          case 'days':
            startDate.setDate(now.getDate() - options.timeframe);
            break;
          case 'weeks':
            startDate.setDate(now.getDate() - (options.timeframe * 7));
            break;
          case 'months':
            startDate.setMonth(now.getMonth() - options.timeframe);
            break;
        }

        effectiveStartDate = startDate.toISOString();
        effectiveEndDate = now.toISOString();
      }

      const limit = Math.min(options.limit || 100, 100);

      // Decode cursor if provided
      let cursorData: any = null;
      if (options.cursor) {
        try {
          cursorData = JSON.parse(Buffer.from(options.cursor, 'base64').toString('utf-8'));
        } catch (e) {
          throw new Error('Invalid cursor format');
        }
      }

      // Single space with cursor
      if (options.spaceId && cursorData) {
        return await this.handleCursorPagination(options, cursorData, limit, startTime);
      }

      // Backward compatibility - offset
      if (options.offset && options.offset > 0 && !options.cursor && options.spaceId) {
        return await this.handleOffsetPagination(options, limit, startTime);
      }

      // First page - no cursor or offset
      let targetSpaces: QlikSpace[] = [];

      if (options.spaceId) {
        const space = await this.spaceCatalogService.getSpaceDetails(options.spaceId, false, false);
        if (space) {
          targetSpaces = [space];
        } else {
          return this.createEmptyResult(options);
        }
      } else if (options.spaceIds && options.spaceIds.length > 0) {
        const spacePromises = options.spaceIds.map(id =>
          this.spaceCatalogService.getSpaceDetails(id, false, false)
        );
        const spaces = await Promise.all(spacePromises);
        targetSpaces = spaces.filter(s => s !== null) as QlikSpace[];
      } else if (options.allSpaces) {
        const catalog = await this.spaceCatalogService.getSpacesCatalog({
          includeMembers: false,
          includeItems: false,
          limit: 1000,
          spaceType: options.spaceType !== 'all' ? options.spaceType : undefined,
          hasDataAssets: options.hasDataAssets
        });
        targetSpaces = catalog.spaces;
      } else {
        return this.createEmptyResult(options);
      }

      logger.debug(`[ItemSearchService] Searching ${targetSpaces.length} spaces`);

      // Collect items from spaces
      const allItems: EnhancedSpaceItem[] = [];

      for (const space of targetSpaces) {
        const { items } = await this.fetchAllSpaceItems(space.id);

        const enhancedItems = items.map((item: any) => ({
          ...item,
          _spaceId: space.id,
          _spaceName: space.name,
          _spaceType: space.type,
          _spaceOwner: space.spaceInfo.ownerName,
          _spaceOwnerId: space.spaceInfo.ownerId
        }));

        allItems.push(...enhancedItems);
      }

      // Resolve owner if needed
      let resolvedOwnerId = options.ownerId;

      if (!resolvedOwnerId && (options.ownerName || options.ownerEmail)) {
        try {
          const users = await this.apiClient.searchUsers(
            options.ownerName || options.ownerEmail || ''
          );

          if (users && users.length > 0) {
            const targetUser = users.find((u: any) =>
              (options.ownerName && u.name?.toLowerCase() === options.ownerName.toLowerCase()) ||
              (options.ownerEmail && u.email?.toLowerCase() === options.ownerEmail.toLowerCase())
            ) || users[0];

            resolvedOwnerId = targetUser.id;
          }
        } catch (error) {
          log.debug('[ItemSearchService] Failed to resolve owner:', error);
        }
      }

      // Apply filters
      let filteredItems = [...allItems];

      // Date filtering
      if (effectiveStartDate || effectiveEndDate) {
        const dateField = options.dateField || 'modified';

        filteredItems = filteredItems.filter(item => {
          const dateStr = dateField === 'created' ? item.createdDate : item.modifiedDate;
          const itemDate = dateStr ? new Date(dateStr) : new Date(0);

          if (itemDate.getTime() === 0) return false;
          if (effectiveStartDate && itemDate < new Date(effectiveStartDate)) return false;
          if (effectiveEndDate && itemDate > new Date(effectiveEndDate)) return false;
          return true;
        });
      }

      // Owner filtering
      if (resolvedOwnerId) {
        filteredItems = filteredItems.filter(item => {
          const itemOwnerId = (typeof item.owner === 'object' ? item.owner?.id : item.owner);
          return itemOwnerId === resolvedOwnerId;
        });
      }

      // Type filtering
      if (options.itemTypes && options.itemTypes.length > 0) {
        const typesLower = options.itemTypes.map(t => t.toLowerCase());
        filteredItems = filteredItems.filter(item => {
          const itemType = this.normalizeItemType(
            item.resourceType || item.type,
            item.name,
            item.resourceSubType
          );
          return typesLower.includes(itemType.toLowerCase());
        });
      }

      // Query filtering
      if (options.query) {
        filteredItems = this.searchItemsByQuery(filteredItems, options.query);
      }

      // Sort
      if (options.sortBy) {
        filteredItems = this.sortItems(filteredItems, options.sortBy, options.sortOrder);
      } else if (effectiveStartDate || effectiveEndDate) {
        filteredItems = this.sortItems(filteredItems, 'modified', 'desc');
      }

      // Pagination
      const totalBeforePagination = filteredItems.length;
      const offset = options.offset || 0;
      const paginatedItems = options.skipPagination
        ? filteredItems
        : filteredItems.slice(offset, offset + limit);
      const hasMore = totalBeforePagination > offset + limit;

      // Generate cursor for next page
      let nextCursor: string | undefined;
      if (hasMore && paginatedItems.length > 0) {
        const newOffset = offset + paginatedItems.length;
        nextCursor = Buffer.from(JSON.stringify({
          offset: newOffset,
          sortBy: options.sortBy || 'modified',
          sortOrder: options.sortOrder || 'desc'
        })).toString('base64');
      }

      // Enhance with owner info if requested
      if (options.includeOwnerInfo && paginatedItems.length > 0) {
        await this.enhanceItemsWithOwnerInfo(paginatedItems);
      }

      // Build result based on grouping options
      let result: SpaceItemsResult;

      if (options.groupBySpace) {
        result = this.buildSpaceGroupedResult(paginatedItems, targetSpaces, options);
      } else if (options.groupByType) {
        result = this.buildTypeGroupedResult(paginatedItems, options);
      } else {
        result = this.buildFlatResult(paginatedItems, options);
      }

      result.metadata = {
        totalItems: totalBeforePagination,
        returnedItems: paginatedItems.length,
        cursor: nextCursor,
        offset: offset,
        limit: limit,
        hasMore: hasMore,
        searchTime: Date.now() - startTime,
        spacesSearched: targetSpaces.length,
        filters: options
      };

      return result;
    } catch (error) {
      log.debug('[ItemSearchService] Failed to get space items:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get comprehensive content statistics
   */
  async getContentStatistics(options: {
    groupBy?: 'space' | 'type' | 'owner';
    spaceName?: string;
    spaceId?: string;
    ownerName?: string;
    ownerId?: string;
    includeSpaceBreakdown?: boolean;
    includeDetailedTable?: boolean;
    includeSizeInfo?: boolean;
    includeDateMetrics?: boolean;
    includeUserMetrics?: boolean;
  } = {}): Promise<ContentStatistics> {
    const startTime = Date.now();

    try {
      let targetSpaces: QlikSpace[] = [];

      if (options.spaceId || options.spaceName || options.ownerId || options.ownerName) {
        const spaceCatalog = await this.spaceCatalogService.getSpacesCatalog({
          query: options.spaceName,
          includeMembers: true,
          includeItems: false
        });

        targetSpaces = spaceCatalog.spaces.filter((space: QlikSpace) => {
          if (options.spaceId && space.id !== options.spaceId) return false;

          if (options.spaceName) {
            const searchName = options.spaceName.toLowerCase();
            if (!space.name.toLowerCase().includes(searchName)) return false;
          }

          if (options.ownerId && space.spaceInfo?.ownerId !== options.ownerId) return false;

          if (options.ownerName) {
            const searchOwner = options.ownerName.toLowerCase();
            const ownerName = (space.spaceInfo?.ownerName || '').toLowerCase();
            if (!ownerName.includes(searchOwner)) return false;
          }

          return true;
        });
      } else {
        const spaceCatalog = await this.spaceCatalogService.getSpacesCatalog({
          includeMembers: true,
          includeItems: false
        });
        targetSpaces = spaceCatalog.spaces;
      }

      if (targetSpaces.length === 0) {
        return this.createEmptyStatistics();
      }

      // Fetch items from target spaces
      let allItems: any[] = [];

      if (options.spaceId) {
        const itemsResult = await this.getSpaceItems({
          spaceId: options.spaceId,
          includeSpaceInfo: true,
          skipPagination: true,
          limit: 10000
        });
        allItems = itemsResult.items || [];
      } else if (targetSpaces.length === 1) {
        const itemsResult = await this.getSpaceItems({
          spaceId: targetSpaces[0].id,
          includeSpaceInfo: true,
          skipPagination: true,
          limit: 10000
        });
        allItems = itemsResult.items || [];
      } else {
        const itemsResult = await this.getSpaceItems({
          spaceIds: targetSpaces.map(s => s.id),
          includeSpaceInfo: true,
          limit: 10000
        });
        allItems = itemsResult.items || [];
      }

      // Process items
      const typeCountMap = new Map<string, number>();
      const spaceItemsMap = new Map<string, any[]>();
      const ownerItemsMap = new Map<string, any[]>();
      const datasetsForSizeEnrichment: any[] = [];
      let totalItems = 0;
      let totalDataAssets = 0;

      for (const item of allItems) {
        const normalizedType = this.normalizeItemType(
          item.resourceType || item.type,
          item.name,
          item.resourceSubType
        );

        item._normalizedType = normalizedType;

        typeCountMap.set(normalizedType, (typeCountMap.get(normalizedType) || 0) + 1);
        totalItems++;

        if (normalizedType === 'dataset' || this.isDataFile(item)) {
          datasetsForSizeEnrichment.push(item);
          totalDataAssets++;
        }

        const spaceName = item.space?.name || item._spaceName || 'Unknown';
        if (!spaceItemsMap.has(spaceName)) {
          spaceItemsMap.set(spaceName, []);
        }
        spaceItemsMap.get(spaceName)!.push(item);

        if (options.includeUserMetrics !== false || options.groupBy === 'owner') {
          const ownerId = item.ownerId || item.owner?.id || 'unknown';
          if (!ownerItemsMap.has(ownerId)) {
            ownerItemsMap.set(ownerId, []);
          }
          ownerItemsMap.get(ownerId)!.push(item);
        }
      }

      // Enrich with size info
      let totalStorage = 0;
      const typeSizeMap = new Map<string, number>();
      const spaceSizeMap = new Map<string, number>();

      if (options.includeSizeInfo !== false && datasetsForSizeEnrichment.length > 0) {
        const sizeStats = await this.datasetService.enrichDataFilesWithSize(datasetsForSizeEnrichment);

        if (sizeStats && sizeStats.enrichedItems) {
          for (const enrichedItem of sizeStats.enrichedItems) {
            const size = enrichedItem.size || 0;
            if (size > 0) {
              totalStorage += size;

              const type = enrichedItem._normalizedType || 'dataset';
              typeSizeMap.set(type, (typeSizeMap.get(type) || 0) + size);

              const spaceName = enrichedItem.space?.name || enrichedItem._spaceName || 'Unknown';
              spaceSizeMap.set(spaceName, (spaceSizeMap.get(spaceName) || 0) + size);
            }
          }
        }
      }

      // Build type distribution
      const typeDistribution: Record<string, any> = {};
      const assetTypes = Array.from(typeCountMap.keys()).sort();

      for (const [type, count] of typeCountMap.entries()) {
        typeDistribution[type] = {
          count: count,
          percentage: totalItems > 0 ? Math.round((count / totalItems) * 100) : 0,
          spacesWithType: 0,
          uniqueOwners: 0,
          totalSizeFormatted: undefined,
          averageSize: undefined
        };

        const typeSize = typeSizeMap.get(type) || 0;
        if (typeSize > 0) {
          typeDistribution[type].totalSizeFormatted = this.formatFileSize(typeSize);
          typeDistribution[type].averageSize = this.formatFileSize(Math.round(typeSize / count));
        }
      }

      // Calculate spaces with type
      for (const [spaceName, items] of spaceItemsMap.entries()) {
        const typesInSpace = new Set<string>();
        const ownersByType = new Map<string, Set<string>>();

        for (const item of items) {
          const type = item._normalizedType;
          typesInSpace.add(type);

          if (!ownersByType.has(type)) {
            ownersByType.set(type, new Set());
          }
          const ownerId = item.ownerId || item.owner?.id || 'unknown';
          ownersByType.get(type)!.add(ownerId);
        }

        for (const type of typesInSpace) {
          if (typeDistribution[type]) {
            typeDistribution[type].spacesWithType++;
          }
        }

        for (const [type, owners] of ownersByType.entries()) {
          if (typeDistribution[type]) {
            typeDistribution[type].uniqueOwners = owners.size;
          }
        }
      }

      // Build detailed table
      const detailedTable: any[][] = [];

      if (options.includeDetailedTable !== false) {
        for (const space of targetSpaces) {
          const spaceItems = spaceItemsMap.get(space.name) || [];
          const spaceTypeCount = new Map<string, number>();

          for (const item of spaceItems) {
            const type = item._normalizedType;
            spaceTypeCount.set(type, (spaceTypeCount.get(type) || 0) + 1);
          }

          const row: any[] = [
            space.name,
            space.type || 'unknown',
            space.spaceInfo?.ownerName || 'Unknown',
            spaceItems.length
          ];

          for (const assetType of assetTypes) {
            row.push(spaceTypeCount.get(assetType) || 0);
          }

          row.push(space.statistics?.totalMembers || 0);

          const spaceStorage = spaceSizeMap.get(space.name) || 0;
          row.push(spaceStorage > 0 ? Math.round(spaceStorage / (1024 * 1024)) : 0);

          detailedTable.push(row);
        }

        detailedTable.sort((a, b) => b[3] - a[3]);
      }

      const totalMembers = targetSpaces.reduce((sum, space) =>
        sum + (space.statistics?.totalMembers || 0), 0);

      return {
        summary: {
          totalSpaces: targetSpaces.length,
          totalItems,
          totalDataAssets,
          totalMembers,
          totalStorage,
          averageItemsPerSpace: targetSpaces.length > 0 ?
            Math.round(totalItems / targetSpaces.length) : 0,
          averageMembersPerSpace: targetSpaces.length > 0 ?
            Math.round(totalMembers / targetSpaces.length) : 0
        },

        assetTypes,
        typeDistribution,
        detailedTable,

        spaceBreakdown: {
          personal: targetSpaces.filter(s => s.type === 'personal').length,
          shared: targetSpaces.filter(s => s.type === 'shared').length,
          managed: targetSpaces.filter(s => s.type === 'managed').length,
          data: targetSpaces.filter(s => s.type === 'data').length
        },

        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      log.debug('[ItemSearchService] Failed to get content statistics:', error);
      throw error;
    }
  }

  /**
   * Build content search index for enhanced search
   */
  async buildContentSearchIndex(spaces: QlikSpace[]): Promise<void> {
    this.contentSearchIndex.clear();

    for (const space of spaces) {
      this.indexContent(space.name.toLowerCase(), space.id);
      this.indexContent(space.description?.toLowerCase() || '', space.id);
      this.indexContent(space.spaceInfo.ownerName.toLowerCase(), space.id);

      const allItems = [...space.dataAssets, ...space.spaceItems];
      for (const item of allItems) {
        this.indexContent(item.name.toLowerCase(), space.id);
        this.indexContent(item.description?.toLowerCase() || '', space.id);

        if (item.tags) {
          for (const tag of item.tags) {
            this.indexContent(tag.toLowerCase(), space.id);
          }
        }
      }

      for (const member of space.members) {
        this.indexContent(member.userName.toLowerCase(), space.id);
      }
    }
  }

  // ===== PRIVATE METHODS =====

  private async handleCursorPagination(
    options: SpaceItemsOptions,
    cursorData: any,
    limit: number,
    startTime: number
  ): Promise<SpaceItemsResult> {
    const params = new URLSearchParams();
    params.set('spaceId', options.spaceId!);
    params.set('limit', String(limit));
    params.set('includeResourceAttributes', 'true');

    if (cursorData.lastItemId) {
      params.set('offset', String(cursorData.offset || 0));
    }

    const url = `/items?${params.toString()}`;
    const response = await this.apiClient.makeRequest(url, 'GET');
    const items = response.data || response || [];

    items.forEach((item: any) => {
      item.resourceSubType = item.resourceAttributes?.resourceSubType || item.resourceSubType;
    });

    const space = await this.spaceCatalogService.getSpaceDetails(options.spaceId!, false, false);
    if (!space) {
      return this.createEmptyResult(options);
    }

    const enhancedItems = items.map((item: any) => ({
      ...item,
      _spaceId: space.id,
      _spaceName: space.name,
      _spaceType: space.type,
      _spaceOwner: space.spaceInfo.ownerName,
      _spaceOwnerId: space.spaceInfo.ownerId
    }));

    let nextCursor: string | undefined;
    const hasMore = items.length === limit;

    if (hasMore && items.length > 0) {
      const lastItem = items[items.length - 1];
      const newOffset = (cursorData.offset || 0) + items.length;
      nextCursor = Buffer.from(JSON.stringify({
        lastItemId: lastItem.id,
        offset: newOffset,
        sortBy: options.sortBy || 'modified',
        sortOrder: options.sortOrder || 'desc'
      })).toString('base64');
    }

    const result = this.buildFlatResult(enhancedItems, options);

    result.metadata = {
      totalItems: -1,
      returnedItems: items.length,
      cursor: nextCursor,
      hasMore: hasMore,
      searchTime: Date.now() - startTime,
      spacesSearched: 1,
      filters: options,
      offset: 0,
      limit: limit
    };

    return result;
  }

  private async handleOffsetPagination(
    options: SpaceItemsOptions,
    limit: number,
    startTime: number
  ): Promise<SpaceItemsResult> {
    const url = `/items?spaceId=${options.spaceId}&limit=${limit}&offset=${options.offset}&includeResourceAttributes=true`;
    const response = await this.apiClient.makeRequest(url, 'GET');
    const items = response.data || response || [];

    items.forEach((item: any) => {
      item.resourceSubType = item.resourceAttributes?.resourceSubType || item.resourceSubType;
    });

    const space = await this.spaceCatalogService.getSpaceDetails(options.spaceId!, false, false);
    if (!space) {
      return this.createEmptyResult(options);
    }

    const enhancedItems = items.map((item: any) => ({
      ...item,
      _spaceId: space.id,
      _spaceName: space.name,
      _spaceType: space.type,
      _spaceOwner: space.spaceInfo.ownerName,
      _spaceOwnerId: space.spaceInfo.ownerId
    }));

    const result = this.buildFlatResult(enhancedItems, options);
    const hasMore = items.length === limit;

    let nextCursor: string | undefined;
    if (hasMore && items.length > 0) {
      const newOffset = options.offset! + items.length;
      nextCursor = Buffer.from(JSON.stringify({
        offset: newOffset,
        sortBy: options.sortBy || 'modified',
        sortOrder: options.sortOrder || 'desc'
      })).toString('base64');
    }

    result.metadata = {
      totalItems: -1,
      returnedItems: items.length,
      cursor: nextCursor,
      offset: options.offset ?? 0,
      limit: limit,
      hasMore: hasMore,
      searchTime: Date.now() - startTime,
      spacesSearched: 1,
      filters: options
    };

    return result;
  }

  private async fetchAllSpaceItems(spaceId: string): Promise<{ items: any[], dataAssets: any[] }> {
    const allItems: any[] = [];
    const seenIds = new Set<string>();
    let hasMore = true;
    let iteration = 0;
    const maxIterations = 100;
    const batchSize = 100;

    let nextUrl: string | null = null;

    while (hasMore && iteration < maxIterations) {
      iteration++;

      let url: string;
      if (nextUrl) {
        url = nextUrl;
      } else if (iteration === 1) {
        url = `/items?spaceId=${spaceId}&limit=${batchSize}&includeResourceAttributes=true`;
      } else {
        break;
      }

      try {
        const response = await this.apiClient.makeRequest(url, 'GET');

        let items: any[] = [];
        if (Array.isArray(response)) {
          items = response;
        } else if (Array.isArray(response.data)) {
          items = response.data;
        } else if (response.data?.items) {
          items = response.data.items;
        } else if (response.items) {
          items = response.items;
        }

        let newItemsCount = 0;
        items.forEach((item: any) => {
          item.resourceSubType = item.resourceAttributes?.resourceSubType || item.resourceSubType;

          if (item.id && !seenIds.has(item.id)) {
            seenIds.add(item.id);
            allItems.push(item);
            newItemsCount++;
          }
        });

        nextUrl = null;

        if (response.links?.next?.href) {
          nextUrl = response.links.next.href;
        } else if (response.data?.links?.next?.href) {
          nextUrl = response.data.links.next.href;
        } else if (response.links?.next) {
          nextUrl = response.links.next;
        } else if (response.next) {
          nextUrl = response.next;
        }

        if (nextUrl) {
          if (nextUrl.includes('next=')) {
            const urlObj = new URL(nextUrl, 'https://atlas.eu.qlikcloud.com');
            const nextCursor = urlObj.searchParams.get('next');
            if (nextCursor) {
              nextUrl = `/items?spaceId=${spaceId}&limit=${batchSize}&includeResourceAttributes=true&next=${nextCursor}`;
            }
          } else if (!nextUrl.startsWith('/')) {
            nextUrl = `/items?${nextUrl}`;
          }
          hasMore = true;
        } else {
          hasMore = false;
        }

        if (items.length === 0 || (newItemsCount === 0 && iteration > 1)) {
          hasMore = false;
        }
      } catch (error: any) {
        if (allItems.length > 0) {
          hasMore = false;
        } else {
          throw error;
        }
      }
    }

    const dataAssets = allItems.filter(item => {
      const type = this.normalizeItemType(
        item.resourceType || item.type,
        item.name,
        item.resourceSubType
      );
      return type === 'dataset';
    });

    return { items: allItems, dataAssets };
  }

  private searchItemsByQuery(items: any[], query: string): any[] {
    const queryLower = query.toLowerCase();
    const queryTokens = queryLower.split(/[\s,._\-\/]+/).filter(t => t.length > 0);

    return items.filter(item => {
      const searchableText = [
        item.name,
        item.description,
        item.type,
        item._spaceName,
        item.tags?.join(' ')
      ].filter(Boolean).join(' ').toLowerCase();

      return queryTokens.every(token => searchableText.includes(token));
    });
  }

  private sortItems(items: any[], sortBy: string, sortOrder?: string): any[] {
    const order = sortOrder === 'desc' ? -1 : 1;

    return [...items].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return order * (a.name || '').localeCompare(b.name || '');
        case 'created':
          const aCreated = a.createdAt || a.created || a.createdDate || 0;
          const bCreated = b.createdAt || b.created || b.createdDate || 0;
          return order * (new Date(aCreated).getTime() - new Date(bCreated).getTime());
        case 'modified':
          const aModified = a.updatedAt || a.modified || a.modifiedDate || 0;
          const bModified = b.updatedAt || b.modified || b.modifiedDate || 0;
          return order * (new Date(aModified).getTime() - new Date(bModified).getTime());
        case 'size':
          return order * ((a.size || 0) - (b.size || 0));
        case 'type':
          const aType = this.normalizeItemType(a.resourceType || a.type, a.name, a.resourceSubType);
          const bType = this.normalizeItemType(b.resourceType || b.type, b.name, b.resourceSubType);
          return order * aType.localeCompare(bType);
        default:
          return 0;
      }
    });
  }

  private buildFlatResult(items: any[], options: SpaceItemsOptions): SpaceItemsResult {
    return {
      success: true,
      items: items.map(item => ({
        id: item.id || item.itemId,
        name: item.name,
        normalizeItemType: this.normalizeItemType(
          item.resourceType || item.type,
          item.name,
          item.resourceSubType
        ),
        resourceType: item.resourceType || item.type,
        owner: item.ownerName || item.owner?.name || 'Unknown',
        ownerId: item.ownerId || item.owner?.id,
        created: item.createdAt || item.created || item.createdDate,
        modified: item.updatedAt || item.modified || item.modifiedDate,
        size: item.size,
        sizeFormatted: this.formatFileSize(item.size || 0),
        description: item.description,
        tags: item.tags || [],
        ...(options.includeSpaceInfo !== false ?
          {
            space: {
              id: item._spaceId,
              name: item._spaceName,
              type: item._spaceType,
              owner: item._spaceOwner
            }
          } : {})
      }))
    };
  }

  private buildSpaceGroupedResult(
    items: any[],
    spaces: QlikSpace[],
    options: SpaceItemsOptions
  ): SpaceItemsResult {
    const itemsBySpace = new Map<string, any[]>();

    items.forEach(item => {
      const spaceId = item._spaceId;
      if (!itemsBySpace.has(spaceId)) {
        itemsBySpace.set(spaceId, []);
      }
      itemsBySpace.get(spaceId)!.push(item);
    });

    return {
      success: true,
      groupedBySpace: spaces
        .filter(space => itemsBySpace.has(space.id))
        .map(space => ({
          space: {
            id: space.id,
            name: space.name,
            type: space.type,
            owner: space.spaceInfo.ownerName
          },
          itemCount: itemsBySpace.get(space.id)?.length || 0,
          items: this.buildFlatResult(itemsBySpace.get(space.id) || [], options).items!
        }))
    };
  }

  private buildTypeGroupedResult(items: any[], options: SpaceItemsOptions): SpaceItemsResult {
    const itemsByType = new Map<string, any[]>();

    items.forEach(item => {
      const type = this.normalizeItemType(
        item.resourceType || item.type,
        item.name,
        item.resourceSubType
      );
      if (!itemsByType.has(type)) {
        itemsByType.set(type, []);
      }
      itemsByType.get(type)!.push(item);
    });

    const sortedTypes = Array.from(itemsByType.entries())
      .sort((a, b) => b[1].length - a[1].length);

    return {
      success: true,
      groupedByType: sortedTypes.map(([type, typeItems]) => ({
        type: type,
        count: typeItems.length,
        items: this.buildFlatResult(typeItems, options).items!
      }))
    };
  }

  private createEmptyResult(options: SpaceItemsOptions): SpaceItemsResult {
    const result: SpaceItemsResult = {
      success: true,
      metadata: {
        totalItems: 0,
        returnedItems: 0,
        offset: options.offset || 0,
        limit: options.limit || 100,
        hasMore: false,
        searchTime: 0,
        spacesSearched: 0,
        filters: {
          query: options.query,
          ownerId: options.ownerId,
          itemTypes: options.itemTypes,
          spaceType: options.spaceType
        }
      }
    };

    if (options.groupBySpace) {
      result.groupedBySpace = [];
    } else if (options.groupByType) {
      result.groupedByType = [];
    } else {
      result.items = [];
    }

    return result;
  }

  private createEmptyStatistics(): ContentStatistics {
    return {
      summary: {
        totalSpaces: 0,
        totalItems: 0,
        totalDataAssets: 0,
        totalMembers: 0,
        totalStorage: 0,
        averageItemsPerSpace: 0,
        averageMembersPerSpace: 0
      },
      assetTypes: [],
      typeDistribution: {},
      detailedTable: [],
      spaceBreakdown: {
        personal: 0,
        shared: 0,
        managed: 0,
        data: 0
      },
      lastUpdated: new Date().toISOString()
    };
  }

  private async enhanceItemsWithOwnerInfo(items: any[]): Promise<void> {
    const ownerIds = [...new Set(items
      .map(item => item.ownerId || item.owner?.id)
      .filter(Boolean))] as string[];

    if (ownerIds.length === 0) return;

    const resolvedUsers = await this.apiClient.resolveOwnersToUsers(ownerIds);

    items.forEach(item => {
      const ownerId = item.ownerId || item.owner?.id;
      if (ownerId && resolvedUsers.has(ownerId)) {
        const user = resolvedUsers.get(ownerId)!;
        item.ownerName = user.displayName;
        item.ownerEmail = user.email;
      }
    });
  }

  private indexContent(content: string, spaceId: string): void {
    if (!content) return;

    const tokens = content.split(/[\s,._\-\/]+/).filter(t => t.length > 0);

    for (const token of tokens) {
      if (!this.contentSearchIndex.has(token)) {
        this.contentSearchIndex.set(token, new Set<string>());
      }
      this.contentSearchIndex.get(token)!.add(spaceId);
    }
  }

  private normalizeItemType(
    resourceType?: string,
    itemName?: string,
    resourceSubType?: string
  ): MainItemType {
    const type = (resourceType || '').toLowerCase();
    const subType = (resourceSubType || '').toLowerCase();
    const name = (itemName || '').toLowerCase();

    if (type === 'dataasset' && subType === 'qix-df') {
      return 'dataset';
    }

    if (type === 'app') {
      if (subType === 'script' || subType === 'load-script' ||
          name.includes('script') || name.includes('load') ||
          name.endsWith('.qvs')) {
        return 'script';
      }
      if (subType === 'dataflow-prep' || subType === 'dataflow') {
        return 'dataflow';
      }
      return 'app';
    }

    if (type === 'qlik-app' || type === 'qvapp') {
      return 'app';
    }

    const dataTypes = [
      'dataset', 'datasource', 'qvd', 'csv', 'xlsx', 'excel',
      'parquet', 'json', 'xml', 'txt', 'tsv', 'pdf', 'docx'
    ];

    if (dataTypes.some(t => type.includes(t))) {
      return 'dataset';
    }

    const dataExtensions = [
      '.qvd', '.csv', '.xlsx', '.xls', '.parquet', '.json', '.xml',
      '.txt', '.tsv', '.dat', '.pdf', '.docx', '.doc'
    ];

    if (dataExtensions.some(ext => name.endsWith(ext))) {
      return 'dataset';
    }

    if (type === 'note' || type === 'notes') return 'note';
    if (type === 'link' || type === 'url') return 'link';
    if (type === 'glossary') return 'glossary';
    if (type === 'automation' || type === 'qlik-automation') return 'automation';
    if (type === 'ml-deployment' || type === 'mldeployment') return 'ml-deployment';
    if (type === 'ml-experiment' || type === 'mlexperiment') return 'ml-experiment';
    if (type === 'assistant' || type === 'qlik-assistant') return 'assistant';
    if (type === 'knowledgebase' || type === 'knowledge-base') return 'knowledge-base';

    return 'datafilefolder';
  }

  private isDataFile(item: any): boolean {
    const name = (item.name || '').toLowerCase();
    const resourceType = (item.resourceType || '').toLowerCase();

    const dataExtensions = [
      '.qvd', '.csv', '.xlsx', '.xls', '.parquet',
      '.json', '.xml', '.txt', '.tsv', '.pdf'
    ];

    return dataExtensions.some(ext => name.endsWith(ext)) ||
           resourceType === 'dataset' ||
           resourceType === 'datasource';
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
