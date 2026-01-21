/**
 * Data Handlers - Connect MCP tools to data services
 * Updated with platform support for Cloud and On-Premise
 */

import { DataCatalogService, getDataCatalogService } from '../services/data-catalog-service.js';
import { QlikAppService } from '../services/qlik-app-service.js';
import { getConnectionPool } from '../services/connection-pool.js';
import { VisualizationService, AI_CACHE_OBJECTS, EXISTING_APP_OBJECTS, TENANT_APP_IDS } from '../services/app/visualization-service.js';
import { SessionService } from '../services/app/session-service.js';
import { ApiClient } from '../utils/api-client.js';
import { CacheManager } from '../utils/cache-manager.js';
import { logger } from '../utils/logger.js';
import { AnalysisOutput, DashboardCreationResult } from '../types/analysis.js';
import {
  mapAnalysisToVisualizations,
  validateAnalysisOutput,
  generateSheetUrl,
  getDefaultAppId,
  applyVisualizationRules,
  getAccessInstructions
} from '../services/analysis-to-dashboard.js';

const log = logger.child({ service: 'DataHandlers' });

/**
 * Handler for get_dataset_details tool
 * Get detailed information about a dataset
 * Note: Datasets are a Cloud concept, on-premise uses data connections
 */
export async function handleGetDatasetDetails(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug(`[DataHandlers] get_dataset_details called (platform: ${platform})`);

  try {
    if (!args?.datasetId) {
      throw new Error('datasetId is required');
    }

    if (platform === 'on-premise') {
      // On-premise doesn't have datasets in the same way as Cloud
      // Try to get data connection details instead
      return await handleGetDataConnectionDetails(apiClient, args.datasetId);
    }

    const catalogService = getDataCatalogService(apiClient, cacheManager);
    const details = await catalogService.getDatasetDetails(args.datasetId);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          platform: 'cloud',
          dataset: details,
          timestamp: new Date().toISOString()
        }, null, 2)
      }]
    };
  } catch (error) {
    log.debug('[DataHandlers] Error in get_dataset_details:', error);
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
 * On-Premise: Get data connection details via QRS
 */
async function handleGetDataConnectionDetails(
  apiClient: ApiClient,
  connectionId: string
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const response = await apiClient.makeRequest(`/qrs/dataconnection/${connectionId}`);
    const connection = response.data || response;

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          platform: 'on-premise',
          dataConnection: {
            id: connection.id,
            name: connection.name,
            connectionString: connection.connectionstring,
            type: connection.type,
            owner: connection.owner?.name,
            createdDate: connection.createdDate,
            modifiedDate: connection.modifiedDate
          },
          note: 'On-premise uses Data Connections instead of Datasets. This shows the data connection details.',
          timestamp: new Date().toISOString()
        }, null, 2)
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          platform: 'on-premise',
          error: error instanceof Error ? error.message : String(error),
          note: 'On-premise uses Data Connections instead of Datasets. The provided ID may be a Cloud dataset ID.'
        }, null, 2)
      }]
    };
  }
}

/**
 * Handler for apply_selections tool
 * Apply selections to an app
 * Note: Uses Engine API - Cloud supported, On-premise requires certificate auth
 */
export async function handleApplySelections(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug(`[DataHandlers] apply_selections called (platform: ${platform})`);

  try {
    if (!args?.appId || !args?.selections) {
      throw new Error('appId and selections are required');
    }

    // Pass platform to QlikAppService for platform-aware Engine API
    const qlikAppService = new QlikAppService(apiClient, cacheManager, platform, tenantUrl);
    const result = await qlikAppService.applySelections(args.appId, args.selections);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          platform,
          result,
          timestamp: new Date().toISOString()
        }, null, 2)
      }]
    };
  } catch (error) {
    log.debug('[DataHandlers] Error in apply_selections:', error);
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
 * Handler for clear_selections tool
 * Clear all selections in an app
 * Note: Uses Engine API - Cloud supported, On-premise requires certificate auth
 */
export async function handleClearSelections(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug(`[DataHandlers] clear_selections called (platform: ${platform})`);

  try {
    if (!args?.appId) {
      throw new Error('appId is required');
    }

    // Pass platform to QlikAppService for platform-aware Engine API
    const qlikAppService = new QlikAppService(apiClient, cacheManager, platform, tenantUrl);
    const result = await qlikAppService.clearSelections(args.appId);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          platform,
          result,
          timestamp: new Date().toISOString()
        }, null, 2)
      }]
    };
  } catch (error) {
    log.debug('[DataHandlers] Error in clear_selections:', error);
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
 * Handler for get_current_selections tool
 * Get current selections in an app
 * Note: Uses Engine API - Cloud supported, On-premise requires certificate auth
 */
export async function handleGetCurrentSelections(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug(`[DataHandlers] get_current_selections called (platform: ${platform})`);

  try {
    if (!args?.appId) {
      throw new Error('appId is required');
    }

    // Pass platform to QlikAppService for platform-aware Engine API
    const qlikAppService = new QlikAppService(apiClient, cacheManager, platform, tenantUrl);
    const selections = await qlikAppService.getCurrentSelections(args.appId);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          platform,
          selections,
          timestamp: new Date().toISOString()
        }, null, 2)
      }]
    };
  } catch (error) {
    log.debug('[DataHandlers] Error in get_current_selections:', error);
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
 * Handler for get_available_fields tool
 * Get available fields in an app
 * Uses connection pool with automatic retry on socket errors
 */
export async function handleGetAvailableFields(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug(`[DataHandlers] get_available_fields called (platform: ${platform})`);

  try {
    if (!args?.appId) {
      throw new Error('appId is required');
    }

    // Use connection pool with automatic retry
    const pool = getConnectionPool();
    const fields = await pool.executeWithRetry(args.appId, async (doc) => {
      const tablesAndKeys = await doc.getTablesAndKeys({} as any, {} as any, 0, true, false);
      const fieldList: string[] = [];

      for (const table of tablesAndKeys.qtr || []) {
        for (const field of table.qFields || []) {
          if (!fieldList.includes(field.qName)) {
            fieldList.push(field.qName);
          }
        }
      }

      return fieldList.sort();
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          platform,
          appId: args.appId,
          totalFields: fields.length,
          fields,
          timestamp: new Date().toISOString()
        }, null, 2)
      }]
    };
  } catch (error) {
    log.debug('[DataHandlers] Error in get_available_fields:', error);
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

// ===== NEW HANDLERS - Combined from existing service + external repos =====

/**
 * Handler for qlik_get_app_metadata tool
 * Get comprehensive app metadata including sheets, objects, and data model
 * Uses existing QlikAppService.handleGetAppMetadataComplete
 */
export async function handleGetAppMetadata(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug(`[DataHandlers] get_app_metadata called (platform: ${platform})`);

  try {
    if (!args?.appId) {
      throw new Error('appId is required');
    }

    const qlikAppService = new QlikAppService(apiClient, cacheManager, platform, tenantUrl);
    return await qlikAppService.handleGetAppMetadataComplete({
      appId: args.appId,
      includeSheets: args.includeSheets !== false,
      includeObjects: args.includeObjects !== false,
      includeObjectData: args.includeObjectData === true,
      maxDataRows: args.maxDataRows || 100
    });
  } catch (error) {
    log.debug('[DataHandlers] Error in get_app_metadata:', error);
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
 * Handler for qlik_get_object_data tool
 * Get data from a specific visualization object
 * Uses existing QlikAppService.handleGetObjectData
 */
export async function handleGetObjectData(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug(`[DataHandlers] get_object_data called (platform: ${platform})`);

  try {
    if (!args?.appId || !args?.objectId) {
      throw new Error('appId and objectId are required');
    }

    const qlikAppService = new QlikAppService(apiClient, cacheManager, platform, tenantUrl);
    return await qlikAppService.handleGetObjectData({
      appId: args.appId,
      objectId: args.objectId,
      maxRows: args.maxRows || 100,
      useSession: args.useSession !== false
    });
  } catch (error) {
    log.debug('[DataHandlers] Error in get_object_data:', error);
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
 * Handler for qlik_create_hypercube tool
 * Create a custom hypercube query to retrieve data
 * Uses connection pool with automatic retry on socket errors
 */
export async function handleCreateHypercube(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug(`[DataHandlers] create_hypercube called (platform: ${platform})`);

  try {
    if (!args?.appId || !args?.dimensions || !args?.measures) {
      throw new Error('appId, dimensions, and measures are required');
    }

    // Build hypercube definition
    const hypercubeDef = {
      qDimensions: args.dimensions.map((dim: string) => ({
        qDef: { qFieldDefs: [dim] }
      })),
      qMeasures: args.measures.map((measure: string) => ({
        qDef: { qDef: measure }
      })),
      qInitialDataFetch: [{
        qTop: 0,
        qLeft: 0,
        qWidth: args.dimensions.length + args.measures.length,
        qHeight: args.maxRows || 1000
      }],
      qInterColumnSortOrder: args.sortByMeasure !== undefined
        ? [args.dimensions.length + args.sortByMeasure]
        : undefined
    };

    // Use persistent session from QlikAppService (same session as selections)
    const qlikAppService = new QlikAppService(apiClient, cacheManager, platform, tenantUrl);
    const appSession = await qlikAppService.getOrCreateSession(args.appId);
    const doc = appSession.doc;

    const sessionObj = await doc.createSessionObject({
      qInfo: { qType: 'hypercube' },
      qHyperCubeDef: hypercubeDef
    });

    const layout = await sessionObj.getLayout();
    const qHyperCube = (layout as any).qHyperCube;

    // Extract data
    const dimCount = args.dimensions.length;
    const rows: any[] = [];

    if (qHyperCube?.qDataPages?.[0]?.qMatrix) {
      for (const row of qHyperCube.qDataPages[0].qMatrix) {
        const rowData: any = {};
        args.dimensions.forEach((dim: string, i: number) => {
          rowData[dim] = row[i]?.qText || row[i]?.qNum;
        });
        args.measures.forEach((measure: string, i: number) => {
          rowData[`measure_${i}`] = row[dimCount + i]?.qNum ?? row[dimCount + i]?.qText;
        });
        rows.push(rowData);
      }
    }

    // Cleanup session object (not the session itself!)
    await doc.destroySessionObject(sessionObj.id);

    const result = {
      totalRows: qHyperCube?.qSize?.qcy || rows.length,
      columns: [...args.dimensions, ...args.measures.map((_: string, i: number) => `measure_${i}`)],
      rows
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          platform,
          appId: args.appId,
          dimensions: args.dimensions,
          measures: args.measures,
          data: result,
          timestamp: new Date().toISOString()
        }, null, 2)
      }]
    };
  } catch (error) {
    log.debug('[DataHandlers] Error in create_hypercube:', error);
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
 * Handler for qlik_get_app_sheets tool
 * Get all sheets in a Qlik app
 */
export async function handleGetAppSheets(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug(`[DataHandlers] get_app_sheets called (platform: ${platform})`);

  try {
    if (!args?.appId) {
      throw new Error('appId is required');
    }

    const qlikAppService = new QlikAppService(apiClient, cacheManager, platform, tenantUrl);
    const metadata = await qlikAppService.getAppMetadataComplete(args.appId, {
      includeSheets: true,
      includeObjects: args.includeObjects !== false,
      includeObjectData: false
    });

    const sheets = metadata.sheets.map((sheet: any) => ({
      id: sheet.id,
      title: sheet.title,
      description: sheet.description,
      objectCount: sheet.totalObjects,
      objects: args.includeObjects !== false ? sheet.visualizationObjects?.map((obj: any) => ({
        id: obj.id,
        type: obj.type,
        title: obj.title
      })) : undefined
    }));

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          platform,
          appId: args.appId,
          totalSheets: sheets.length,
          sheets,
          timestamp: new Date().toISOString()
        }, null, 2)
      }]
    };
  } catch (error) {
    log.debug('[DataHandlers] Error in get_app_sheets:', error);
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
 * Handler for qlik_get_sheet_objects tool
 * Get all visualization objects from a specific sheet
 */
export async function handleGetSheetObjects(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug(`[DataHandlers] get_sheet_objects called (platform: ${platform})`);

  try {
    if (!args?.appId || !args?.sheetId) {
      throw new Error('appId and sheetId are required');
    }

    const qlikAppService = new QlikAppService(apiClient, cacheManager, platform, tenantUrl);
    const metadata = await qlikAppService.getAppMetadataComplete(args.appId, {
      includeSheets: true,
      includeObjects: true,
      includeObjectData: false
    });

    const sheet = metadata.sheets.find((s: any) => s.id === args.sheetId);
    if (!sheet) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: `Sheet with ID '${args.sheetId}' not found`,
            availableSheets: metadata.sheets.map((s: any) => ({ id: s.id, title: s.title }))
          }, null, 2)
        }]
      };
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          platform,
          appId: args.appId,
          sheetId: args.sheetId,
          sheetTitle: sheet.title,
          totalObjects: sheet.totalObjects,
          objects: sheet.visualizationObjects?.map((obj: any) => ({
            id: obj.id,
            type: obj.type,
            title: obj.title,
            subtitle: obj.subtitle,
            dimensions: obj.dimensions,
            measures: obj.measures
          })),
          timestamp: new Date().toISOString()
        }, null, 2)
      }]
    };
  } catch (error) {
    log.debug('[DataHandlers] Error in get_sheet_objects:', error);
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
 * Handler for qlik_get_field_values tool
 * Get distinct values from a field
 * Uses connection pool with automatic retry on socket errors
 */
export async function handleGetFieldValues(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug(`[DataHandlers] get_field_values called (platform: ${platform})`);

  try {
    if (!args?.appId || !args?.fieldName) {
      throw new Error('appId and fieldName are required');
    }

    // Use connection pool with automatic retry
    const pool = getConnectionPool();
    const result = await pool.executeWithRetry(args.appId, async (doc) => {
      // Get field values using listbox
      const listObject = await doc.createSessionObject({
        qInfo: { qType: 'listbox' },
        qListObjectDef: {
          qDef: { qFieldDefs: [args.fieldName] },
          qInitialDataFetch: [{
            qTop: 0,
            qLeft: 0,
            qWidth: 1,
            qHeight: args.maxValues || 100
          }]
        }
      });

      const layout = await listObject.getLayout();
      const dataPages = (layout as any).qListObject?.qDataPages?.[0]?.qMatrix || [];

      // Apply search pattern if provided
      let values = dataPages.map((row: any) => ({
        value: row[0]?.qText,
        state: row[0]?.qState, // S=Selected, O=Optional, X=Excluded
        elementNumber: row[0]?.qElemNumber
      }));

      if (args.searchPattern) {
        const pattern = args.searchPattern.replace(/\*/g, '.*');
        const regex = new RegExp(pattern, 'i');
        values = values.filter((v: any) => regex.test(v.value));
      }

      // Cleanup session object
      await doc.destroySessionObject(listObject.id);

      return values;
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          platform,
          appId: args.appId,
          fieldName: args.fieldName,
          totalValues: result.length,
          values: result,
          timestamp: new Date().toISOString()
        }, null, 2)
      }]
    };
  } catch (error) {
    log.debug('[DataHandlers] Error in get_field_values:', error);
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
 * Handler for qlik_get_app_script tool
 * Get the load script from a Qlik app
 * Uses connection pool with automatic retry on socket errors
 */
export async function handleGetAppScript(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug(`[DataHandlers] get_app_script called (platform: ${platform})`);

  try {
    if (!args?.appId) {
      throw new Error('appId is required');
    }

    // Use connection pool with automatic retry
    const pool = getConnectionPool();
    const script = await pool.executeWithRetry(args.appId, async (doc) => {
      return await doc.getScript();
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          platform,
          appId: args.appId,
          scriptLength: script.length,
          script,
          timestamp: new Date().toISOString()
        }, null, 2)
      }]
    };
  } catch (error) {
    log.debug('[DataHandlers] Error in get_app_script:', error);
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
 * Handler for qlik_evaluate_expression tool
 * Evaluate a Qlik expression and return the result
 * Uses connection pool with automatic retry on socket errors
 */
export async function handleEvaluateExpression(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug(`[DataHandlers] evaluate_expression called (platform: ${platform})`);

  try {
    if (!args?.appId || !args?.expression) {
      throw new Error('appId and expression are required');
    }

    // Use connection pool with automatic retry
    const pool = getConnectionPool();
    const result = await pool.executeWithRetry(args.appId, async (doc) => {
      return await doc.evaluate(args.expression);
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          platform,
          appId: args.appId,
          expression: args.expression,
          result,
          timestamp: new Date().toISOString()
        }, null, 2)
      }]
    };
  } catch (error) {
    log.debug('[DataHandlers] Error in evaluate_expression:', error);
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

// ===== FIELD AND MASTER ITEMS MAPPING HANDLERS =====

/**
 * Handler for qlik_map_fields tool
 * Map all fields from an app with pagination
 */
export async function handleMapFields(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug(`[DataHandlers] map_fields called (platform: ${platform})`);

  try {
    if (!args?.appId) {
      throw new Error('appId is required');
    }

    const qlikAppService = new QlikAppService(apiClient, cacheManager, platform, tenantUrl);
    const result = await qlikAppService.mapAllFields(args.appId, args.batchSize || 50);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          platform,
          appId: args.appId,
          ...result,
          timestamp: new Date().toISOString()
        }, null, 2)
      }]
    };
  } catch (error) {
    log.debug('[DataHandlers] Error in map_fields:', error);
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
 * Handler for qlik_map_master_dimensions tool
 * Map all master dimensions from an app with pagination
 */
export async function handleMapMasterDimensions(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug(`[DataHandlers] map_master_dimensions called (platform: ${platform})`);

  try {
    if (!args?.appId) {
      throw new Error('appId is required');
    }

    const qlikAppService = new QlikAppService(apiClient, cacheManager, platform, tenantUrl);
    const result = await qlikAppService.mapAllMasterDimensions(args.appId, args.batchSize || 50);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          platform,
          appId: args.appId,
          ...result,
          timestamp: new Date().toISOString()
        }, null, 2)
      }]
    };
  } catch (error) {
    log.debug('[DataHandlers] Error in map_master_dimensions:', error);
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
 * Handler for qlik_map_master_measures tool
 * Map all master measures from an app with pagination
 */
export async function handleMapMasterMeasures(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug(`[DataHandlers] map_master_measures called (platform: ${platform})`);

  try {
    if (!args?.appId) {
      throw new Error('appId is required');
    }

    const qlikAppService = new QlikAppService(apiClient, cacheManager, platform, tenantUrl);
    const result = await qlikAppService.mapAllMasterMeasures(args.appId, args.batchSize || 50);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          platform,
          appId: args.appId,
          ...result,
          timestamp: new Date().toISOString()
        }, null, 2)
      }]
    };
  } catch (error) {
    log.debug('[DataHandlers] Error in map_master_measures:', error);
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
 * Handler for qlik_map_all tool
 * Map all fields and master items from an app in one call
 */
export async function handleMapAll(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug(`[DataHandlers] map_all called (platform: ${platform})`);

  try {
    if (!args?.appId) {
      throw new Error('appId is required');
    }

    const qlikAppService = new QlikAppService(apiClient, cacheManager, platform, tenantUrl);

    // Use the new timeout + reconnect version
    const result = await qlikAppService.mapAllWithTimeout(args.appId, {
      totalTimeoutMs: 600000,  // 10 minutes
      includeSampleValues: true
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: result.success,
          platform,
          appId: args.appId,
          fields: result.fields,
          masterDimensions: result.masterDimensions,
          masterMeasures: result.masterMeasures,
          summary: result.summary,
          elapsedMs: result.elapsedMs,
          timeoutOccurred: result.timeoutOccurred,
          timestamp: new Date().toISOString()
        }, null, 2)
      }]
    };
  } catch (error) {
    log.debug('[DataHandlers] Error in map_all:', error);
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

// ===== VISUALIZATION HANDLERS =====

// Singleton VisualizationService
let visualizationService: VisualizationService | null = null;

function getVisualizationService(
  apiClient: ApiClient,
  platform: 'cloud' | 'on-premise',
  tenantUrl: string
): VisualizationService {
  if (!visualizationService) {
    const sessionService = new SessionService(apiClient, platform, tenantUrl);
    visualizationService = new VisualizationService(sessionService);
  }
  return visualizationService;
}

/**
 * Handler for qlik_create_sheet tool
 * Create a new sheet in a Qlik app
 */
export async function handleCreateSheet(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug(`[DataHandlers] create_sheet called (platform: ${platform})`);

  try {
    if (!args?.appId || !args?.title) {
      throw new Error('appId and title are required');
    }

    const vizService = getVisualizationService(apiClient, platform, tenantUrl);
    const result = await vizService.createSheet(args.appId, {
      id: args.id,
      title: args.title,
      description: args.description
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: result.success,
          platform,
          appId: args.appId,
          sheetId: result.sheetId,
          message: result.message,
          timestamp: new Date().toISOString()
        }, null, 2)
      }]
    };
  } catch (error) {
    log.debug('[DataHandlers] Error in create_sheet:', error);
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
 * Handler for qlik_create_visualization tool
 * Create a visualization in a sheet
 */
export async function handleCreateVisualization(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug(`[DataHandlers] create_visualization called (platform: ${platform})`);

  try {
    if (!args?.appId || !args?.sheetId || !args?.type || !args?.title) {
      throw new Error('appId, sheetId, type, and title are required');
    }

    if (!args?.dimensions?.length && !args?.measures?.length) {
      throw new Error('At least one dimension or measure is required');
    }

    const vizService = getVisualizationService(apiClient, platform, tenantUrl);
    const result = await vizService.createVisualization(args.appId, {
      id: args.id,
      sheetId: args.sheetId,
      type: args.type,
      title: args.title,
      dimensions: args.dimensions || [],
      measures: (args.measures || []).map((m: any) =>
        typeof m === 'string' ? { expression: m } : m
      ),
      position: args.position
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: result.success,
          platform,
          appId: args.appId,
          sheetId: args.sheetId,
          objectId: result.objectId,
          message: result.message,
          timestamp: new Date().toISOString()
        }, null, 2)
      }]
    };
  } catch (error) {
    log.debug('[DataHandlers] Error in create_visualization:', error);
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
 * Handler for qlik_create_ai_cache tool
 * Create the AI Analytics Cache sheet with pre-built hypercubes
 */
export async function handleCreateAICache(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug(`[DataHandlers] create_ai_cache called (platform: ${platform})`);

  try {
    if (!args?.appId) {
      throw new Error('appId is required');
    }

    const vizService = getVisualizationService(apiClient, platform, tenantUrl);
    const result = await vizService.createAICacheSheet(args.appId);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: result.success,
          platform,
          appId: args.appId,
          sheetId: result.sheetId,
          objects: result.objects,
          cacheObjectKeys: Object.keys(AI_CACHE_OBJECTS),
          message: result.message,
          usage: 'Use qlik_get_object_data with these object IDs for optimized data retrieval',
          timestamp: new Date().toISOString()
        }, null, 2)
      }]
    };
  } catch (error) {
    log.debug('[DataHandlers] Error in create_ai_cache:', error);
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
 * Handler for qlik_get_ai_cache_data tool
 * Get data from a cached AI Analytics object
 */
export async function handleGetAICacheData(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug(`[DataHandlers] get_ai_cache_data called (platform: ${platform})`);

  try {
    if (!args?.appId || !args?.cacheKey) {
      throw new Error('appId and cacheKey are required. Valid cacheKeys: ' + Object.keys(AI_CACHE_OBJECTS).join(', '));
    }

    const cacheKey = args.cacheKey as keyof typeof AI_CACHE_OBJECTS;
    if (!AI_CACHE_OBJECTS[cacheKey]) {
      throw new Error(`Invalid cacheKey. Valid options: ${Object.keys(AI_CACHE_OBJECTS).join(', ')}`);
    }

    const vizService = getVisualizationService(apiClient, platform, tenantUrl);
    const result = await vizService.getDataFromCache(args.appId, cacheKey);

    if (!result.success) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            platform,
            appId: args.appId,
            cacheKey,
            fromCache: false,
            message: 'Cache object not found. Use qlik_create_ai_cache first.',
            timestamp: new Date().toISOString()
          }, null, 2)
        }]
      };
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          platform,
          appId: args.appId,
          cacheKey,
          objectId: AI_CACHE_OBJECTS[cacheKey],
          fromCache: result.fromCache,
          data: result.data,
          timestamp: new Date().toISOString()
        }, null, 2)
      }]
    };
  } catch (error) {
    log.debug('[DataHandlers] Error in get_ai_cache_data:', error);
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

// ===== PRE-BUILT OBJECTS HANDLER =====

/**
 * Handler for qlik_get_existing_kpis tool
 * Get data from pre-built objects that already exist in the app
 */
export async function handleGetExistingKpis(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug(`[DataHandlers] get_existing_kpis called (platform: ${platform})`);

  try {
    const objectKey = args?.objectKey as keyof typeof EXISTING_APP_OBJECTS;
    if (!objectKey || !EXISTING_APP_OBJECTS[objectKey]) {
      throw new Error(`Invalid objectKey. Valid options: ${Object.keys(EXISTING_APP_OBJECTS).join(', ')}`);
    }

    const objectConfig = EXISTING_APP_OBJECTS[objectKey];
    const appId = 'a30ab30d-cf2a-41fa-86ef-cf4f189deecf'; // qmb-main app
    const maxRows = args?.maxRows || 50;

    // Use QlikAppService to get object data (same pattern as handleGetObjectData)
    const qlikAppService = new QlikAppService(apiClient, cacheManager, platform, tenantUrl);
    const objectDataResult = await qlikAppService.handleGetObjectData({
      appId,
      objectId: objectConfig.objectId,
      maxRows,
      useSession: true
    });

    // Parse the result and add our metadata
    const parsedResult = JSON.parse(objectDataResult.content[0].text);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          platform,
          objectKey,
          preBuiltObject: {
            objectId: objectConfig.objectId,
            sheetId: objectConfig.sheetId,
            title: objectConfig.title,
            type: objectConfig.type,
            expectedDimensions: objectConfig.dimensions,
            expectedMeasures: objectConfig.measures
          },
          ...parsedResult,
          hint: 'This is a pre-built object - data is ready to use!',
          timestamp: new Date().toISOString()
        }, null, 2)
      }]
    };
  } catch (error) {
    log.debug('[DataHandlers] Error in get_existing_kpis:', error);
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

// ===== ANALYSIS-TO-DASHBOARD HANDLER =====

/**
 * Handler for qlik_create_dashboard_from_analysis tool
 * Creates a Qlik dashboard from Claude analysis output
 * Uses cognitive visualization rules from qlik-semantic-bridge.skill
 */
export async function handleCreateDashboardFromAnalysis(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.info(`[DataHandlers] create_dashboard_from_analysis called (platform: ${platform})`);

  try {
    // 1. Validate input
    if (!args?.analysis) {
      throw new Error('analysis object is required');
    }

    const analysis: AnalysisOutput = args.analysis;
    const appId = args.appId || getDefaultAppId();
    const sheetTitle = args.sheetTitle || analysis.title || 'Claude Analysis Dashboard';

    // 2. Validate analysis structure
    const validation = validateAnalysisOutput(analysis);
    if (!validation.valid) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Invalid analysis structure',
            validationErrors: validation.errors
          }, null, 2)
        }]
      };
    }

    // 3. Map analysis to visualization specifications
    const visualizationSpecs = mapAnalysisToVisualizations(analysis);

    if (visualizationSpecs.length === 0) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'No visualizations could be generated from the analysis'
          }, null, 2)
        }]
      };
    }

    // 4. Apply visualization rules to each spec
    const ruledSpecs = visualizationSpecs.map(applyVisualizationRules);

    // 5. Create sheet using VisualizationService
    const vizService = getVisualizationService(apiClient, platform, tenantUrl);
    const sheetResult = await vizService.createSheet(appId, {
      title: sheetTitle,
      description: analysis.summary || `Generated from Claude analysis: ${analysis.title}`
    });

    if (!sheetResult.success || !sheetResult.sheetId) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Failed to create sheet',
            details: sheetResult.message
          }, null, 2)
        }]
      };
    }

    const sheetId = sheetResult.sheetId;
    const createdObjects: string[] = [];
    const errors: string[] = [];

    // 6. Create each visualization
    for (const spec of ruledSpecs) {
      try {
        const vizResult = await vizService.createVisualization(appId, {
          sheetId,
          type: spec.type,
          title: spec.title,
          dimensions: spec.dimensions,
          measures: spec.measures.map(m =>
            typeof m === 'string' ? { expression: m } : m
          ),
          position: spec.position
        });

        if (vizResult.success && vizResult.objectId) {
          createdObjects.push(vizResult.objectId);
          log.debug(`[DataHandlers] Created ${spec.type}: ${spec.title} (${vizResult.objectId})`);
        } else {
          errors.push(`Failed to create ${spec.type} "${spec.title}": ${vizResult.message}`);
        }
      } catch (vizError) {
        const errorMsg = vizError instanceof Error ? vizError.message : String(vizError);
        errors.push(`Error creating ${spec.type} "${spec.title}": ${errorMsg}`);
        log.warn(`[DataHandlers] Visualization creation error: ${errorMsg}`);
      }
    }

    // 7. Generate sheet URL (platform-aware)
    const sheetUrl = generateSheetUrl(appId, sheetId, platform);
    const accessInstructions = getAccessInstructions(platform);

    // 8. Build response
    const result: DashboardCreationResult = {
      success: createdObjects.length > 0,
      sheetId,
      sheetUrl,
      objects: createdObjects,
      message: errors.length > 0
        ? `Dashboard created with ${createdObjects.length}/${ruledSpecs.length} visualizations. Errors: ${errors.join('; ')}`
        : `Dashboard created successfully with ${createdObjects.length} visualizations`,
      error: errors.length > 0 ? errors.join('; ') : undefined
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          ...result,
          platform,
          appId,
          analysisTitle: analysis.title,
          visualizationsCreated: createdObjects.length,
          visualizationsRequested: ruledSpecs.length,
          accessInstructions,
          cognitiveRulesApplied: [
            'Rule 18: Bar charts start from 0',
            'Rule 31: Prefer bars over pie (>3 items)',
            'Rule 63: Color-blind safe palette'
          ],
          timestamp: new Date().toISOString()
        }, null, 2)
      }]
    };
  } catch (error) {
    log.error('[DataHandlers] Error in create_dashboard_from_analysis:', error);
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

