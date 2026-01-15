/**
 * App Module - Re-exports all app services and types
 *
 * This module splits the original qlik-app-service.ts (3,493 lines) into:
 * - app-types.ts: All interfaces and type definitions
 * - session-service.ts: Enigma.js session management
 * - selection-service.ts: Field selections and values
 * - object-data-service.ts: Object data extraction and hypercubes
 * - field-mapping-service.ts: Field and master item mapping
 */

// Export all types
export * from './app-types.js';

// Export all services
export { SessionService, schema } from './session-service.js';
export { SelectionService } from './selection-service.js';
export { ObjectDataService } from './object-data-service.js';
export { FieldMappingService } from './field-mapping-service.js';

// Backward compatibility - QlikAppService facade
import { ApiClient } from '../../utils/api-client.js';
import { CacheManager } from '../../utils/cache-manager.js';
import { logger } from '../../utils/logger.js';

import { SessionService, getSessionService } from './session-service.js';
import { SelectionService } from './selection-service.js';
import { ObjectDataService } from './object-data-service.js';
import { FieldMappingService } from './field-mapping-service.js';

import {
  QlikAppServiceOptions,
  AppMetadataOptions,
  AppMetadataCompleteResult,
  SelectionRequest,
  ObjectDataSample,
  SimpleSheet,
  FieldInfo,
  ScriptResult
} from './app-types.js';

const log = logger.child({ service: 'QlikApp' });

/**
 * QlikAppService - Backward compatible facade
 *
 * This class delegates to the new split services while maintaining
 * the original API for existing code.
 */
export class QlikAppService {
  private readonly sessionService: SessionService;
  private readonly selectionService: SelectionService;
  private readonly objectDataService: ObjectDataService;
  private readonly fieldMappingService: FieldMappingService;

  constructor(
    apiClient: ApiClient,
    cacheManager: CacheManager,
    platform: 'cloud' | 'on-premise' = 'cloud',
    tenantUrl: string = '',
    options?: QlikAppServiceOptions
  ) {
    // Use singleton to preserve sessions across handler calls
    this.sessionService = getSessionService(apiClient, platform, tenantUrl, options);
    this.selectionService = new SelectionService(this.sessionService);
    this.objectDataService = new ObjectDataService(this.sessionService);
    this.fieldMappingService = new FieldMappingService(this.sessionService);
  }

  // ===== SESSION MANAGEMENT =====

  async getOrCreateSession(appId: string) {
    return this.sessionService.getOrCreateSession(appId);
  }

  async closeSession(appId: string): Promise<void> {
    return this.sessionService.closeSession(appId);
  }

  async closeAllSessions(): Promise<void> {
    return this.sessionService.closeAllSessions();
  }

  async closeConnections(): Promise<void> {
    return this.sessionService.closeAllSessions();
  }

  // ===== SELECTION METHODS =====

  async applySelections(
    appId: string,
    selections: SelectionRequest[],
    clearPrevious: boolean = true
  ): Promise<any> {
    return this.selectionService.applySelections(appId, selections, clearPrevious);
  }

  async clearSelections(appId: string): Promise<any> {
    return this.selectionService.clearSelections(appId);
  }

  async getCurrentSelections(appId: string): Promise<any> {
    return this.selectionService.getCurrentSelections(appId);
  }

  async getAvailableFields(appId: string): Promise<any> {
    return this.selectionService.getAvailableFields(appId);
  }

  async getFieldValues(
    appId: string,
    fieldName: string,
    options?: { searchPattern?: string; maxValues?: number }
  ): Promise<{ values: any[]; totalCount: number }> {
    return this.selectionService.getFieldValues(appId, fieldName, options);
  }

  // ===== OBJECT DATA METHODS =====

  async getObjectData(
    appId: string,
    objectId: string,
    options?: any,
    useSession?: boolean
  ): Promise<ObjectDataSample | null> {
    return this.objectDataService.getObjectData(appId, objectId, options, useSession);
  }

  async getAppMetadataComplete(
    appId: string,
    options?: AppMetadataOptions
  ): Promise<AppMetadataCompleteResult> {
    return this.objectDataService.getAppMetadataComplete(appId, options);
  }

  async fetchHypercubeData(
    appId: string,
    hypercubeDef: any,
    maxRows?: number
  ): Promise<any> {
    return this.objectDataService.fetchHypercubeData(appId, hypercubeDef, maxRows);
  }

  async evaluateExpression(appId: string, expression: string): Promise<any> {
    return this.objectDataService.evaluateExpression(appId, expression);
  }

  async getAppScript(appId: string): Promise<ScriptResult> {
    return this.objectDataService.getAppScript(appId);
  }

  async analyzeDataModel(appId: string): Promise<any> {
    return this.objectDataService.analyzeDataModel(appId);
  }

  async getAllSheetsWithObjects(appId: string, options: AppMetadataOptions): Promise<SimpleSheet[]> {
    return this.objectDataService.getAllSheetsWithObjects(appId, options);
  }

  // ===== FIELD MAPPING METHODS =====

  async mapAllFields(appId: string, batchSize?: number) {
    return this.fieldMappingService.mapAllFields(appId, batchSize);
  }

  async mapAllMasterDimensions(appId: string, batchSize?: number) {
    return this.fieldMappingService.mapAllMasterDimensions(appId, batchSize);
  }

  async mapAllMasterMeasures(appId: string, batchSize?: number) {
    return this.fieldMappingService.mapAllMasterMeasures(appId, batchSize);
  }

  async mapAllFieldsAndMasterItems(appId: string, batchSize?: number) {
    return this.fieldMappingService.mapAllFieldsAndMasterItems(appId, batchSize);
  }

  async mapFieldsWithTimeout(appId: string, options?: any) {
    return this.fieldMappingService.mapFieldsWithTimeout(appId, options);
  }

  async mapMasterDimensionsWithTimeout(appId: string, options?: any) {
    return this.fieldMappingService.mapMasterDimensionsWithTimeout(appId, options);
  }

  async mapMasterMeasuresWithTimeout(appId: string, options?: any) {
    return this.fieldMappingService.mapMasterMeasuresWithTimeout(appId, options);
  }

  async mapAllWithTimeout(appId: string, options?: any) {
    return this.fieldMappingService.mapAllWithTimeout(appId, options);
  }

  // ===== MCP HANDLERS (preserved for compatibility) =====

  async handleGetAppMetadataComplete(args: any): Promise<{ content: { type: string; text: string }[] }> {
    if (!args?.appId) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'App ID is required',
            appId: null,
            result: null
          }, null, 2)
        }]
      };
    }

    try {
      const result = await this.getAppMetadataComplete(args.appId, {
        includeRestMetadata: args.includeRestMetadata !== false,
        includeEngineMetadata: args.includeEngineMetadata !== false,
        includeSheets: args.includeSheets !== false,
        includeObjects: args.includeObjects !== false,
        includeObjectData: args.includeObjectData === true,
        maxDataRows: args.maxDataRows || 100,
        extractFieldValues: args.extractFieldValues === true,
        sampleDataOnly: args.sampleDataOnly !== false
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            appId: args.appId,
            extractedSuccessfully: true,
            result: {
              appInfo: result.appInfo,
              totalSheets: result.sheets.length,
              totalVisualizationObjects: result.totalVisualizationObjects,
              extractionStats: result.extractionStats,
              sheets: result.sheets.map(sheet => ({
                id: sheet.id,
                title: sheet.title,
                totalObjects: sheet.totalObjects,
                visualizationObjects: sheet.visualizationObjects.map(obj => ({
                  id: obj.id,
                  type: obj.type,
                  title: obj.title,
                  subtitle: obj.subtitle,
                  dimensions: obj.dimensions?.map(d => ({
                    label: d.label,
                    fieldName: d.fieldName,
                    dataType: d.dataType,
                    distinctValues: d.distinctValues
                  })),
                  measures: obj.measures?.map(m => ({
                    label: m.label,
                    expression: m.expression,
                    format: m.format
                  })),
                  chartConfiguration: obj.chartConfiguration,
                  parentContainer: obj.parentContainer,
                  nestingLevel: obj.nestingLevel,
                  lastDataUpdate: obj.lastDataUpdate
                })),
                containerInfo: sheet.containerInfo.map(container => ({
                  id: container.id,
                  type: container.type,
                  title: container.title,
                  isContainer: container.isContainer,
                  totalNestedCount: container.totalNestedCount,
                  nestedObjectTypes: container.nestedObjects.map(obj => obj.type)
                }))
              })),
              restMetadata: result.restMetadata,
              engineMetadata: result.engineMetadata
            },
            generatedAt: new Date().toISOString()
          }, null, 2)
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'Metadata extraction failed',
            message: error instanceof Error ? error.message : String(error),
            appId: args.appId,
            suggestion: 'Check Engine API permissions and app structure'
          }, null, 2)
        }]
      };
    }
  }

  async handleGetObjectData(args: any): Promise<{ content: { type: string; text: string }[] }> {
    if (!args?.appId || !args?.objectId) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'App ID and Object ID are required',
            appId: args?.appId || null,
            objectId: args?.objectId || null,
            result: null
          }, null, 2)
        }]
      };
    }

    try {
      const useSession = args.useSession !== false;

      const objectData = await this.getObjectData(args.appId, args.objectId, {
        maxRows: args.maxRows || 100,
        includeFieldValues: args.includeFieldValues !== false,
        sampleOnly: args.sampleOnly !== false
      }, useSession);

      if (!objectData) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              appId: args.appId,
              objectId: args.objectId,
              result: null,
              message: 'No data found for this object or object does not exist',
              suggestion: 'Verify the object ID and ensure the object contains data'
            }, null, 2)
          }]
        };
      }

      let currentSelections = null;
      if (useSession) {
        try {
          currentSelections = await this.getCurrentSelections(args.appId);
        } catch (e) {
          log.debug('Could not get current selections:', e);
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            appId: args.appId,
            objectId: args.objectId,
            useSession,
            currentSelections,
            objectData: {
              objectType: objectData.objectType,
              totalRows: objectData.totalRows,
              sampleRows: objectData.sampleData.length,
              columnInfo: objectData.columnInfo,
              sampleData: objectData.sampleData.slice(0, 10),
              dataExtractedAt: objectData.dataExtractedAt
            },
            extractionOptions: {
              maxRows: args.maxRows || 100,
              includeFieldValues: args.includeFieldValues !== false,
              sampleOnly: args.sampleOnly !== false
            },
            generatedAt: new Date().toISOString()
          }, null, 2)
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'Object data extraction failed',
            message: error instanceof Error ? error.message : String(error),
            appId: args.appId,
            objectId: args.objectId,
            suggestion: 'Check Engine API permissions and verify object exists'
          }, null, 2)
        }]
      };
    }
  }
}
