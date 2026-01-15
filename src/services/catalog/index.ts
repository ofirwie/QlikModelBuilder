/**
 * Catalog Module - Re-exports all catalog services and types
 *
 * This module splits the original data-catalog-service.ts (3,734 lines) into:
 * - catalog-types.ts: All interfaces and type definitions
 * - space-catalog-service.ts: Space management and member resolution
 * - dataset-service.ts: Dataset details and connection analysis
 * - item-search-service.ts: Item search, filtering, and content statistics
 */

// Export all types
export * from './catalog-types.js';

// Export all services
export { SpaceCatalogService } from './space-catalog-service.js';
export { DatasetService } from './dataset-service.js';
export { ItemSearchService } from './item-search-service.js';

// Backward compatibility - DataCatalogService facade
import { ApiClient } from '../../utils/api-client.js';
import { CacheManager } from '../../utils/cache-manager.js';
import { SpaceCatalogService } from './space-catalog-service.js';
import { DatasetService } from './dataset-service.js';
import { ItemSearchService } from './item-search-service.js';
import { ServiceRegistry } from '../../utils/service-registry.js';
import {
  SpaceCatalogSearchOptions,
  SpaceCatalogResult,
  QlikSpace,
  SpaceItemsOptions,
  SpaceItemsResult,
  ContentStatistics,
  DatasetDetails,
  DatasetConnectionInfo
} from './catalog-types.js';

// Singleton instance
let dataCatalogServiceInstance: DataCatalogService | null = null;

/**
 * Get or create the singleton DataCatalogService instance
 */
export function getDataCatalogService(
  apiClient: ApiClient,
  cacheManager: CacheManager
): DataCatalogService {
  if (!dataCatalogServiceInstance) {
    dataCatalogServiceInstance = new DataCatalogService(apiClient, cacheManager);
  }
  return dataCatalogServiceInstance;
}

/**
 * Reset the singleton instance (useful for tenant switching)
 */
export function resetDataCatalogService(): void {
  if (dataCatalogServiceInstance) {
    dataCatalogServiceInstance.clearCaches();
    dataCatalogServiceInstance = null;
  }
}

/**
 * DataCatalogService - Backward compatible facade
 *
 * This class delegates to the new split services while maintaining
 * the original API for existing code.
 */
export class DataCatalogService {
  private readonly spaceCatalogService: SpaceCatalogService;
  private readonly datasetService: DatasetService;
  private readonly itemSearchService: ItemSearchService;

  constructor(apiClient: ApiClient, cacheManager: CacheManager) {
    this.spaceCatalogService = new SpaceCatalogService(apiClient, cacheManager);
    this.datasetService = new DatasetService(apiClient, this.spaceCatalogService);
    this.itemSearchService = new ItemSearchService(
      apiClient,
      this.spaceCatalogService,
      this.datasetService
    );
  }

  // ===== SPACE CATALOG METHODS =====

  async getSpacesCatalog(options: SpaceCatalogSearchOptions & {
    force?: boolean;
    useCache?: boolean;
    includeMembers?: boolean;
    includeCounts?: boolean;
    getAllSpaces?: boolean;
    maxSpaces?: number;
  } = {}): Promise<SpaceCatalogResult> {
    return this.spaceCatalogService.getSpacesCatalog(options);
  }

  async getSpaceDetails(
    spaceId: string,
    includeMembers: boolean = true,
    includeItems: boolean = true
  ): Promise<QlikSpace | null> {
    return this.spaceCatalogService.getSpaceDetails(spaceId, includeMembers, includeItems);
  }

  async getSpaceDataConnections(spaceId: string): Promise<any[]> {
    return this.spaceCatalogService.getSpaceDataConnections(spaceId);
  }

  // ===== DATASET METHODS =====

  async getDatasetDetails(datasetId: string): Promise<DatasetDetails> {
    return this.datasetService.getDatasetDetails(datasetId);
  }

  async analyzeDatasetConnection(dataset: DatasetDetails): Promise<DatasetConnectionInfo> {
    return this.datasetService.analyzeDatasetConnection(dataset);
  }

  async getMultipleDatasetDetails(itemIds: string[]): Promise<DatasetDetails[]> {
    return this.datasetService.getMultipleDatasetDetails(itemIds);
  }

  async searchDataAssets(query: string, options: { limit?: number; offset?: number } = {}): Promise<any> {
    return this.datasetService.searchDataAssets(query, options);
  }

  // ===== ITEM SEARCH METHODS =====

  async getSpaceItems(options: SpaceItemsOptions = {}): Promise<SpaceItemsResult> {
    return this.itemSearchService.getSpaceItems(options);
  }

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
    return this.itemSearchService.getContentStatistics(options);
  }

  // ===== CACHE METHODS =====

  clearCaches(): void {
    this.spaceCatalogService.clearCaches();
    this.datasetService.clearCaches();
  }

  getCacheStats(): any {
    return {
      ...this.spaceCatalogService.getCacheStats(),
      datasetService: 'active'
    };
  }
}
