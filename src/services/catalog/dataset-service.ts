/**
 * Dataset Service
 * Handles dataset details, connection analysis, and data asset management
 */

import { ApiClient } from '../../utils/api-client';
import { logger } from '../../utils/logger.js';
import { SpaceCatalogService } from './space-catalog-service';
import { DatasetDetails, DatasetConnectionInfo, MainItemType, DatasetSubType } from './catalog-types';

const log = logger.child({ service: 'Dataset' });

export class DatasetService {
  private readonly apiClient: ApiClient;
  private readonly spaceCatalogService: SpaceCatalogService;
  private dataAssetSearchCache = new Map<string, any>();

  constructor(apiClient: ApiClient, spaceCatalogService: SpaceCatalogService) {
    this.apiClient = apiClient;
    this.spaceCatalogService = spaceCatalogService;
    logger.debug('[DatasetService] Initialized');
  }

  /**
   * Get detailed information about a dataset
   */
  async getDatasetDetails(datasetId: string): Promise<DatasetDetails> {
    try {
      logger.debug(`[DatasetService] Getting dataset details for datasetId: ${datasetId}`);

      const datasetResponse = await this.apiClient.makeRequest(`/api/v1/data-sets/${datasetId}`, 'GET');
      const dataset = datasetResponse.data || datasetResponse;

      if (!dataset) {
        throw new Error(`Dataset not found: ${datasetId}`);
      }

      logger.debug(`[DatasetService] Dataset found: ${dataset.name}`);

      let item: any = null;
      try {
        const itemsResponse = await this.apiClient.makeRequest(
          `/api/v1/items?resourceId=${datasetId}&resourceType=dataset`,
          'GET'
        );
        const items = itemsResponse.data || itemsResponse;
        if (Array.isArray(items) && items.length > 0) {
          item = items[0];
        }
      } catch (itemError) {
        logger.debug(`[DatasetService] Could not find item entry for dataset`);
      }

      const itemType = item ? this.normalizeItemType(
        item.resourceType || item.type,
        item.name,
        item.resourceSubType,
        item.resourceAttributes
      ) : 'dataset';

      let spaceName = null;
      let spaceTitle = null;
      let spaceType = null;
      let connectionName = null;
      let connectionType = null;
      let isConnectionBased = false;

      const spaceId = item?.spaceId || dataset.spaceId;
      if (spaceId) {
        try {
          const spaceResponse = await this.apiClient.getSpace(spaceId);
          if (spaceResponse) {
            spaceName = spaceResponse.name;
            spaceTitle = spaceResponse.title || spaceResponse.name;
            spaceType = spaceResponse.type;
          }
        } catch (spaceError) {
          try {
            const searchResult = await this.spaceCatalogService.getSpacesCatalog({ limit: 100 });
            const matchingSpace = searchResult.spaces.find(s => s.id === spaceId);
            if (matchingSpace) {
              spaceName = matchingSpace.name;
              spaceTitle = matchingSpace.name;
              spaceType = matchingSpace.type;
            }
          } catch (searchError) {
            log.debug(`[DatasetService] Failed to search for space:`, searchError);
          }
        }
      }

      const hasConnectionId = dataset.createdByConnectionId || dataset.connectionId;
      let appType = null;

      if (hasConnectionId) {
        isConnectionBased = true;

        if (dataset.schemaType === 'qix' || dataset.type === 'QixDataSet') {
          appType = 'qlik';
          connectionName = 'Qlik App Data Connection';
          connectionType = 'qix';
        } else {
          connectionType = dataset.connectionType || dataset.sourceType || 'unknown';

          try {
            const connectionResponse = await this.apiClient.makeRequest(
              `/api/v1/data-connections/${hasConnectionId}`,
              'GET'
            );
            const connection = connectionResponse.data || connectionResponse;
            connectionName = connection.qName || connection.name;
            connectionType = connection.qType || connection.type || connectionType;
          } catch (connError) {
            connectionName = `Connection ${hasConnectionId}`;
          }
        }
      }

      return {
        itemId: item?.id,
        itemName: item?.name || dataset.name,
        itemType: itemType,
        spaceId: spaceId,
        spaceName: spaceName || undefined,
        spaceTitle: spaceTitle || undefined,
        spaceType: spaceType || undefined,

        datasetId: datasetId,
        resourceId: datasetId,
        name: dataset.name || item?.name,
        description: dataset.description || item?.description,

        isConnectionBased: isConnectionBased,
        connectionName: connectionName || undefined,
        connectionType: connectionType || undefined,
        connectionId: dataset.createdByConnectionId,
        appType: appType || undefined,

        size: dataset.size || item?.size,
        rowCount: dataset.rowCount,
        columnCount: dataset.columnCount || dataset.fieldCount,
        sizeFormatted: this.formatFileSize(dataset.operational?.size || dataset.size || item?.size || 0),

        fields: dataset.fields || dataset.columns || [],
        schema: dataset.schema,

        technicalName: dataset.qName || dataset.technicalName || dataset.qualifiedName,
        projectId: dataset.projectId,
        datasetName: dataset.datasetName,
        tableName: dataset.tableName || dataset.name,

        createdDate: dataset.createdDate || item?.createdDate,
        modifiedDate: dataset.modifiedDate || item?.modifiedDate,
        lastReloadDate: dataset.lastReloadDate,
        createdBy: dataset.createdBy,
        modifiedBy: dataset.modifiedBy,

        rawItem: item,
        rawDataset: dataset
      };
    } catch (error) {
      log.debug('[DatasetService] Failed to get dataset details:', error);
      throw error;
    }
  }

  /**
   * Analyze dataset connections for load script generation
   */
  async analyzeDatasetConnection(dataset: DatasetDetails): Promise<DatasetConnectionInfo> {
    const connectionInfo: DatasetConnectionInfo = {
      itemId: dataset.itemId,
      itemName: dataset.itemName,
      spaceName: dataset.spaceName,
      isConnectionBased: dataset.isConnectionBased
    };

    if (dataset.isConnectionBased && dataset.appType === 'qlik') {
      connectionInfo.sourceType = 'qlik_app';
      connectionInfo.connectionType = 'binary';
      connectionInfo.loadScriptGuidance = [
        'This dataset comes from another Qlik app',
        'Use Binary load to get the entire data model',
        'Or use specific LOAD statements from the source app'
      ];

      if (dataset.connectionId) {
        try {
          const sourceApp = await this.findSourceApp(dataset.connectionId);
          if (sourceApp) {
            connectionInfo.sourceApp = sourceApp;
            connectionInfo.binaryLoadSyntax = `Binary [lib://${dataset.spaceName}/${sourceApp.name}];`;
          }
        } catch (error) {
          log.debug('[DatasetService] Could not find source app:', error);
        }
      }
    } else if (dataset.isConnectionBased) {
      connectionInfo.sourceType = 'database';
      connectionInfo.connectionType = dataset.connectionType;
      connectionInfo.connectionName = dataset.connectionName;

      connectionInfo.connectionTemplate = `LIB CONNECT TO '${dataset.spaceName}:${dataset.connectionName}';`;

      if (dataset.technicalName) {
        connectionInfo.loadTemplate = `
LIB CONNECT TO '${dataset.spaceName}:${dataset.connectionName}';

[${dataset.itemName}]:
LOAD *;
SQL SELECT * FROM ${dataset.technicalName};
`;
      } else if (dataset.projectId && dataset.datasetName && dataset.tableName) {
        connectionInfo.loadTemplate = `
LIB CONNECT TO '${dataset.connectionName}';

[${dataset.itemName}]:
LOAD *;
SQL SELECT * FROM \`${dataset.projectId}.${dataset.datasetName}.${dataset.tableName}\`;
`;
      }

      if (dataset.fields && dataset.fields.length > 0) {
        const fieldList = dataset.fields.map((f: any) => f.name || f.datasetFieldName).join(',\n    ');
        connectionInfo.selectiveLoadTemplate = `
LIB CONNECT TO '${dataset.connectionName}';

[${dataset.itemName}]:
LOAD
    ${fieldList};
SQL SELECT
    ${fieldList}
FROM ${dataset.technicalName || dataset.tableName};
`;
      }
    } else {
      const fileName = dataset.itemName;
      const spaceName = dataset.spaceName;

      if (!fileName) {
        connectionInfo.error = 'No file name available';
        return connectionInfo;
      }

      let effectiveSpaceName = spaceName;
      if (!spaceName && dataset.spaceId) {
        connectionInfo.warning = `Space name not resolved. Using placeholder for space ID: ${dataset.spaceId}`;
        connectionInfo.spacePlaceholder = `<SPACE_NAME_FOR_${dataset.spaceId}>`;
        effectiveSpaceName = connectionInfo.spacePlaceholder;
      } else if (!spaceName) {
        effectiveSpaceName = 'DataFiles';
      }

      connectionInfo.fileName = fileName;
      connectionInfo.spaceName = effectiveSpaceName;
      connectionInfo.datasetType = dataset.itemType;
      connectionInfo.sourceType = 'file';
      connectionInfo.fileExtension = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : undefined;

      connectionInfo.connectionTemplate = `lib://${effectiveSpaceName}:DataFiles/${fileName}`;

      let loadSyntax = '';
      switch (connectionInfo.fileExtension) {
        case 'qvd':
          loadSyntax = `LOAD * FROM [${connectionInfo.connectionTemplate}] (qvd);`;
          break;
        case 'csv':
          loadSyntax = `LOAD * FROM [${connectionInfo.connectionTemplate}] (txt, utf8, embedded labels, delimiter is ',');`;
          break;
        case 'xlsx':
        case 'xls':
          loadSyntax = `LOAD * FROM [${connectionInfo.connectionTemplate}] (ooxml, embedded labels, table is Sheet1);`;
          break;
        case 'parquet':
          loadSyntax = `LOAD * FROM [${connectionInfo.connectionTemplate}] (parquet);`;
          break;
        case 'txt':
          loadSyntax = `LOAD * FROM [${connectionInfo.connectionTemplate}] (txt, utf8, embedded labels, delimiter is '\\t');`;
          break;
        case 'json':
          loadSyntax = `LOAD * FROM [${connectionInfo.connectionTemplate}] (json);`;
          break;
        default:
          loadSyntax = `LOAD * FROM [${connectionInfo.connectionTemplate}];`;
      }

      connectionInfo.loadSyntax = loadSyntax;

      connectionInfo.datasetMetadata = {
        resourceId: dataset.resourceId || dataset.datasetId,
        itemId: dataset.itemId,
        rowCount: dataset.rowCount,
        columnCount: dataset.columnCount,
        fields: dataset.fields || [],
        size: dataset.size,
        createdDate: dataset.createdDate,
        modifiedDate: dataset.modifiedDate,
        sourceInfo: {
          type: 'file',
          connectionId: dataset.connectionId,
        }
      };

      connectionInfo.loadScriptGuidance = [
        'This appears to be a file-based dataset',
        'Use the lib://Space:DataFiles/filename syntax',
        `File type: ${connectionInfo.fileExtension || 'unknown'}`,
        `Space: ${effectiveSpaceName}`
      ];

      if (connectionInfo.warning) {
        connectionInfo.loadScriptGuidance.unshift(connectionInfo.warning);
      }
    }

    if (dataset.schema) {
      connectionInfo.schema = dataset.schema;
    }

    return connectionInfo;
  }

  /**
   * Batch get dataset details
   */
  async getMultipleDatasetDetails(itemIds: string[]): Promise<DatasetDetails[]> {
    logger.debug(`[DatasetService] Getting details for ${itemIds.length} datasets`);

    const results = await Promise.all(
      itemIds.map(async (itemId) => {
        try {
          return await this.getDatasetDetails(itemId);
        } catch (error) {
          log.debug(`[DatasetService] Failed to get details for ${itemId}:`, error);
          return {
            datasetId: itemId,
            resourceId: itemId,
            name: 'Unknown',
            itemName: 'Unknown',
            itemType: 'dataset',
            isConnectionBased: false,
            sizeFormatted: '0 Bytes',
            fields: [],
            error: error instanceof Error ? error.message : 'Unknown error'
          } as any;
        }
      })
    );

    return results;
  }

  /**
   * Search for data assets across all spaces
   */
  async searchDataAssets(query: string, options: { limit?: number; offset?: number } = {}): Promise<any> {
    const { limit = 50, offset = 0 } = options;

    try {
      const cacheKey = `data-assets:${query}:${limit}:${offset}`;
      const cachedResult = this.dataAssetSearchCache.get(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      const spaces = await this.spaceCatalogService.getSpacesCatalog({
        includeItems: true,
        includeMembers: false
      });

      const allDataAssets: any[] = [];

      for (const space of spaces.spaces) {
        const spaceDataAssets = space.dataAssets.map(asset => ({
          ...asset,
          spaceName: space.name,
          spaceId: space.id,
          spaceType: space.type,
          spaceOwner: space.spaceInfo.ownerName
        }));

        allDataAssets.push(...spaceDataAssets);
      }

      const queryLower = query.toLowerCase();
      const filteredAssets = allDataAssets.filter(asset =>
        asset.name.toLowerCase().includes(queryLower) ||
        asset.description?.toLowerCase().includes(queryLower) ||
        asset.spaceName.toLowerCase().includes(queryLower) ||
        asset.tags?.some((tag: string) => tag.toLowerCase().includes(queryLower))
      );

      const paginatedAssets = filteredAssets.slice(offset, offset + limit);

      const result = {
        data: paginatedAssets,
        meta: {
          total: filteredAssets.length,
          offset,
          limit,
          hasMore: filteredAssets.length > offset + limit
        }
      };

      this.dataAssetSearchCache.set(cacheKey, result);

      return result;
    } catch (error) {
      log.debug('[DatasetService] Failed to search data assets:', error);
      throw error;
    }
  }

  /**
   * Get dataset size from multiple sources
   */
  async getDatasetSize(item: any): Promise<number> {
    const resourceId = item.resourceId;
    const itemId = item.id;

    if (resourceId) {
      try {
        const response = await this.apiClient.makeRequest(`/api/v1/data-sets/${resourceId}`, 'GET');

        const possibleSizes = [
          response?.operational?.size,
          response?.data?.operational?.size,
          response?.size,
          response?.data?.size,
        ];

        for (const size of possibleSizes) {
          if (size && size > 0) {
            return size;
          }
        }
      } catch (error: any) {
        logger.debug(`[DatasetService] /data-sets API error: ${error.message}`);
      }
    }

    if (itemId) {
      try {
        const response = await this.apiClient.makeRequest(`/api/v1/items/${itemId}`, 'GET');

        if (!resourceId && response?.resourceId) {
          item.resourceId = response.resourceId;
          return await this.getDatasetSize(item);
        }

        const size = response?.size || response?.data?.size || response?.resourceSize || 0;
        if (size > 0) {
          return size;
        }
      } catch (error: any) {
        logger.debug(`[DatasetService] /items API error: ${error.message}`);
      }
    }

    return 0;
  }

  /**
   * Enrich data files with size information
   */
  async enrichDataFilesWithSize(items: any[], sampleLimit?: number): Promise<any> {
    const startTime = Date.now();

    const dataFiles = items.filter(item => {
      const resourceType = (item.resourceType || '').toLowerCase();
      const normalizedType = (item.normalizeItemType || '').toLowerCase();
      const itemName = (item.name || '').toLowerCase();

      const skipTypes = ['app', 'assistant', 'automation', 'note', 'link', 'genericlink'];
      if (skipTypes.includes(resourceType)) {
        return false;
      }

      return (
        resourceType === 'dataset' ||
        normalizedType === 'dataset' ||
        itemName.endsWith('.qvd') ||
        itemName.endsWith('.csv') ||
        itemName.endsWith('.xlsx') ||
        itemName.endsWith('.xls') ||
        itemName.endsWith('.parquet') ||
        itemName.endsWith('.txt') ||
        itemName.endsWith('.json') ||
        itemName.endsWith('.pdf')
      );
    });

    const filesToProcess = sampleLimit && sampleLimit < dataFiles.length ?
      dataFiles.slice(0, sampleLimit) :
      dataFiles;

    let totalSizeBytes = 0;
    let successCount = 0;
    let failureCount = 0;

    const sizeBySpace: Record<string, number> = {};
    const countBySpace: Record<string, number> = {};
    const results: any[] = [];
    const enrichedItems: any[] = [];

    const batchSize = 5;

    for (let i = 0; i < filesToProcess.length; i += batchSize) {
      const batch = filesToProcess.slice(i, i + batchSize);

      const batchPromises = batch.map(async (item) => {
        try {
          if (!item.resourceId && item.id) {
            try {
              const itemResponse = await this.apiClient.makeRequest(`/api/v1/items/${item.id}`, 'GET');
              const itemData = itemResponse?.data || itemResponse;
              item.resourceId = itemData.resourceId;
            } catch (e) {
              // Ignore
            }
          }

          const size = await this.getDatasetSize(item);

          if (size > 0) {
            item.size = size;
            item.sizeFormatted = this.formatFileSize(size);

            totalSizeBytes += size;
            successCount++;

            const spaceName = item.space?.name || item.spaceName || 'Unknown';
            if (!sizeBySpace[spaceName]) {
              sizeBySpace[spaceName] = 0;
              countBySpace[spaceName] = 0;
            }
            sizeBySpace[spaceName] += size;
            countBySpace[spaceName]++;

            results.push({
              name: item.name,
              size: size,
              sizeFormatted: this.formatFileSize(size)
            });

            enrichedItems.push(item);

            return { success: true, item };
          } else {
            failureCount++;
            return { success: false, item };
          }
        } catch (error: any) {
          failureCount++;
          return { success: false, item };
        }
      });

      await Promise.all(batchPromises);
    }

    const processingTime = Date.now() - startTime;

    return {
      processed: filesToProcess.length,
      successful: successCount,
      failed: failureCount,
      totalSizeBytes: totalSizeBytes,
      totalSizeFormatted: this.formatFileSize(totalSizeBytes),
      sizeBySpace: Object.entries(sizeBySpace).map(([space, bytes]) => ({
        space: space,
        sizeBytes: bytes,
        sizeFormatted: this.formatFileSize(bytes),
        fileCount: countBySpace[space]
      })),
      results: results,
      enrichedItems: enrichedItems,
      processingTimeMs: processingTime
    };
  }

  /**
   * Clear caches
   */
  clearCaches(): void {
    this.dataAssetSearchCache.clear();
    logger.debug('[DatasetService] Caches cleared');
  }

  // ===== PRIVATE METHODS =====

  private async findSourceApp(connectionId: string): Promise<any> {
    try {
      const searchResult = await this.apiClient.makeRequest('/api/v1/apps', 'GET');
      const apps = searchResult.data || searchResult || [];

      const sourceApp = apps.find((app: any) =>
        app.id === connectionId ||
        app.resourceId === connectionId
      );

      if (sourceApp) {
        return {
          id: sourceApp.id,
          name: sourceApp.name,
          spaceId: sourceApp.spaceId,
          spaceName: sourceApp.space
        };
      }
    } catch (error) {
      log.debug('[DatasetService] Error finding source app:', error);
    }

    return null;
  }

  private normalizeItemType(
    resourceType?: string,
    itemName?: string,
    resourceSubType?: string,
    resourceAttributes?: any
  ): MainItemType {
    const type = (resourceType || '').toLowerCase();
    const subType = (resourceSubType || '').toLowerCase();
    const name = (itemName || '').toLowerCase();

    if (type === 'dataasset' && subType === 'qix-df') {
      return 'dataset';
    }

    if (type === 'app') {
      if (subType === 'script' ||
          subType === 'load-script' ||
          name.includes('script') ||
          name.includes('load') ||
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

    if (type === 'dataasset' && subType === 'qix-df' && resourceAttributes?.dataSetCount === 0) {
      return 'datafilefolder';
    }

    if (this.isDatasetType(type, name)) {
      return 'dataset';
    }

    if (type === 'note' || type === 'notes') {
      return 'note';
    }

    if (type === 'link' || type === 'url') {
      return 'link';
    }

    if (type === 'glossary') {
      return 'glossary';
    }

    if (type === 'automation' || type === 'qlik-automation' || type === 'automationscript') {
      return 'automation';
    }

    if (type === 'ml-deployment' || type === 'mldeployment' || type === 'automl-deployment') {
      return 'ml-deployment';
    }

    if (type === 'ml-experiment' || type === 'mlexperiment' || type === 'automl-experiment') {
      return 'ml-experiment';
    }

    if (type === 'assistant' || type === 'qlik-assistant' || type === 'answer') {
      return 'assistant';
    }

    if (type === 'knowledgebase' || type === 'knowledge-base' || type === 'kb') {
      return 'knowledge-base';
    }

    return 'datafilefolder';
  }

  private isDatasetType(type: string, name: string): boolean {
    const dataTypes = [
      'dataset', 'datasource', 'qvd', 'csv', 'xlsx', 'excel',
      'parquet', 'json', 'xml', 'txt', 'tsv', 'pdf', 'docx'
    ];

    if (dataTypes.some(t => type.includes(t))) {
      return true;
    }

    return this.hasDataFileExtension(name);
  }

  private hasDataFileExtension(name: string): boolean {
    const dataExtensions = [
      '.qvd', '.csv', '.xlsx', '.xls', '.parquet', '.json', '.xml',
      '.txt', '.tsv', '.dat', '.pdf', '.docx', '.doc'
    ];

    return dataExtensions.some(ext => name.endsWith(ext));
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
