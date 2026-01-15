/**
 * Object Data Service - Extracts data from Qlik visualizations and hypercubes
 *
 * Handles:
 * - Get object data from charts, tables, KPIs
 * - Create custom hypercubes
 * - Extract sheets and objects
 * - App metadata extraction
 * - Evaluate expressions
 */

import { SessionService, schema } from './session-service.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ service: 'ObjectData' });
import {
  AppSession,
  AppMetadataOptions,
  AppMetadataCompleteResult,
  SimpleSheet,
  SimpleObject,
  ContainerInfo,
  ObjectDataSample,
  HypercubeData
} from './app-types.js';

export class ObjectDataService {
  private sessionService: SessionService;

  constructor(sessionService: SessionService) {
    this.sessionService = sessionService;
  }

  /**
   * Get object data - session-aware
   */
  async getObjectData(
    appId: string,
    objectId: string,
    options: any = {},
    useSession: boolean = true
  ): Promise<ObjectDataSample | null> {
    log.debug(`[ObjectDataService] Getting object data for ${objectId} (useSession: ${useSession})`);

    let session: any = null;
    let doc: any = null;
    let shouldCloseSession = false;

    try {
      if (useSession) {
        const appSession = await this.sessionService.getOrCreateSession(appId);
        session = appSession.session;
        doc = appSession.doc;
        log.debug(`📊 Using persistent session with ${appSession.currentSelections.size} active selections`);
      } else {
        const temp = await this.sessionService.createTemporarySession(appId);
        session = temp.session;
        doc = temp.doc;
        shouldCloseSession = true;
        log.debug(`📊 Using temporary session (no selections)`);
      }

      const originalObject = await doc.getObject(objectId);
      const originalLayout = await originalObject.getLayout();

      log.debug(`[Object Data] Retrieved ${objectId}:`, {
        type: originalLayout.qInfo?.qType,
        hasHyperCube: !!originalLayout.qHyperCube,
        originalMode: originalLayout.qHyperCube?.qMode || 'unknown'
      });

      let extractedData: any;

      if (originalLayout.qInfo?.qType === 'kpi') {
        log.debug('[Object Data] Detected KPI object');
        extractedData = await this.extractKPIData(originalLayout, originalObject);
      } else if (!originalLayout.qHyperCube) {
        throw new Error('Object does not contain a hypercube');
      } else {
        extractedData = await this.extractDirectFromHypercube(originalLayout, originalObject, options);
      }

      if (shouldCloseSession && session) {
        await session.close();
      }

      if (!extractedData || !extractedData.data || extractedData.data.length === 0) {
        log.debug(`No data found for object ${objectId}`);
        return null;
      }

      return this.convertToObjectDataSample(extractedData, objectId);

    } catch (error) {
      if (shouldCloseSession && session) {
        try {
          await session.close();
        } catch (closeError) {
          log.debug('Error closing session:', closeError);
        }
      }
      log.debug(`Failed to get object data for ${objectId}:`, error);
      throw error;
    }
  }

  /**
   * Get complete app metadata
   */
  async getAppMetadataComplete(
    appId: string,
    options: AppMetadataOptions = {}
  ): Promise<AppMetadataCompleteResult> {
    log.debug(`🔍 Getting complete metadata for app ${appId}`);

    try {
      const appInfo = await this.getBasicAppInfo(appId);

      const result: AppMetadataCompleteResult = {
        appInfo,
        sheets: [],
        totalVisualizationObjects: 0,
        extractionStats: {
          totalLayoutContainers: 0,
          totalNestedObjects: 0,
          successfulExtractions: 0,
          failedExtractions: 0,
          visualizationTypeBreakdown: {},
          containerAnalysis: {
            totalContainers: 0,
            containersWithNested: 0,
            averageNestedPerContainer: 0,
            maxNestingDepth: 0
          },
          dataExtractionStats: {
            objectsWithData: 0,
            totalDataRows: 0,
            hypercubesExtracted: 0,
            listObjectsExtracted: 0,
            fieldValuesExtracted: 0,
            dataExtractionErrors: 0
          }
        }
      };

      if (options.includeRestMetadata !== false) {
        try {
          result.restMetadata = await this.sessionService.getApiClient().getAppMetadata(appId);
        } catch (error) {
          log.warn('Failed to get REST metadata:', error);
        }
      }

      if (options.includeSheets !== false && options.includeObjects !== false) {
        try {
          const sheetsData = await this.getAllSheetsWithObjects(appId, options);
          result.sheets = sheetsData;

          result.totalVisualizationObjects = sheetsData.reduce(
            (sum, sheet) => sum + sheet.totalObjects, 0
          );

          result.extractionStats = this.buildExtractionStats(sheetsData);

          if (options.includeObjectData) {
            result.appDataSummary = this.buildAppDataSummary(sheetsData);
          }

        } catch (error) {
          log.debug('Failed to get Engine objects:', error);
          throw error;
        }
      }

      return result;

    } catch (error) {
      log.debug(`Failed to get complete metadata for app ${appId}:`, error);
      throw error;
    }
  }

  /**
   * Create custom hypercube
   * Uses persistent session to preserve selections and executeWithRetry for stability
   */
  async fetchHypercubeData(
    appId: string,
    hypercubeDef: any,
    maxRows: number = 1000
  ): Promise<HypercubeData> {
    log.debug(`[ObjectDataService] Fetching hypercube data for app ${appId}`);

    return this.sessionService.executeWithRetry(appId, async (doc, appSession) => {
      log.debug(`✅ Using persistent session with ${appSession.currentSelections.size} selections`);

      const tempObject = await doc.createSessionObject({
        qInfo: {
          qType: 'temp-hypercube'
        },
        qHyperCubeDef: hypercubeDef
      });

      const layout = await tempObject.getLayout();
      const hyperCube = layout.qHyperCube;

      if (!hyperCube) {
        await doc.destroySessionObject(tempObject.id);
        throw new Error('No hypercube found in layout');
      }

      const totalRows = hyperCube.qSize.qcy;
      const totalCols = hyperCube.qSize.qcx;
      const rowsToFetch = Math.min(totalRows, maxRows);

      log.debug(`📊 Hypercube size: ${totalRows} rows x ${totalCols} cols`);
      log.debug(`📊 Fetching ${rowsToFetch} rows...`);

      const dataPages = await tempObject.getHyperCubeData('/qHyperCubeDef', [{
        qTop: 0,
        qLeft: 0,
        qWidth: totalCols,
        qHeight: rowsToFetch
      }]);

      if (!dataPages || dataPages.length === 0 || !dataPages[0].qMatrix) {
        await doc.destroySessionObject(tempObject.id);
        throw new Error('No data returned from hypercube');
      }

      log.debug(`✅ Retrieved ${dataPages[0].qMatrix.length} rows of data`);

      const formattedData = this.formatHypercubeData(dataPages[0], hyperCube);

      // Cleanup session object (but NOT the session itself - it's persistent)
      await doc.destroySessionObject(tempObject.id);

      return formattedData;
    });
  }

  /**
   * Evaluate expression
   * Uses executeWithRetry for automatic reconnection on socket errors
   */
  async evaluateExpression(appId: string, expression: string): Promise<any> {
    log.debug(`[ObjectDataService] Evaluating expression for app ${appId}`);

    return this.sessionService.executeWithRetry(appId, async (doc) => {
      try {
        const result = await doc.evaluate(expression);

        return {
          expression,
          result: result.qText || result.qNum,
          numericValue: result.qNum,
          textValue: result.qText,
          isNumeric: result.qIsNumeric,
          evaluatedAt: new Date().toISOString()
        };

      } catch (error: any) {
        log.debug('❌ Error evaluating expression:', error);
        return {
          expression,
          error: error.message || 'Expression evaluation failed',
          evaluatedAt: new Date().toISOString()
        };
      }
    });
  }

  /**
   * Get app's load script
   */
  async getAppScript(appId: string): Promise<{
    success: boolean;
    script: string;
    sections: Array<{ name: string; content: string }>;
    elapsedMs: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      const { session, doc } = await this.sessionService.connectWithRetry(appId);

      const script: string = await this.sessionService.withTimeout(
        doc.getScript(),
        30000,
        'Get script'
      );

      await session.close();

      // Parse script into sections
      const sections: Array<{ name: string; content: string }> = [];
      const tabPattern = /\/\/\/\$tab\s+([^\n]+)\n/g;
      let lastIndex = 0;
      let match;

      while ((match = tabPattern.exec(script)) !== null) {
        if (lastIndex > 0 && sections.length > 0) {
          const prevContent = script.substring(lastIndex, match.index).trim();
          sections[sections.length - 1].content = prevContent;
        }
        sections.push({
          name: match[1].trim(),
          content: ''
        });
        lastIndex = match.index + match[0].length;
      }

      if (sections.length > 0 && lastIndex < script.length) {
        sections[sections.length - 1].content = script.substring(lastIndex).trim();
      }

      if (sections.length === 0 && script.trim()) {
        sections.push({
          name: 'Main',
          content: script.trim()
        });
      }

      return {
        success: true,
        script,
        sections,
        elapsedMs: Date.now() - startTime
      };

    } catch (error: any) {
      return {
        success: false,
        script: '',
        sections: [],
        elapsedMs: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Analyze data model
   */
  async analyzeDataModel(appId: string): Promise<any> {
    log.debug(`[ObjectDataService] Analyzing data model for app ${appId}`);

    const { session, doc } = await this.sessionService.createTemporarySession(appId);

    try {
      log.debug(`✅ Connected to app ${appId} for data model analysis`);

      const tablesAndKeys = await doc.getTablesAndKeys({
        qcx: 1000,
        qcy: 1000
      });

      await session.close();

      const analysis = {
        tables: tablesAndKeys.qtr || [],
        keys: tablesAndKeys.qk || [],
        issues: {
          syntheticKeys: [] as any[],
          circularReferences: [] as any[],
          islandTables: [] as any[]
        }
      };

      // Analyze for synthetic keys
      analysis.issues.syntheticKeys = analysis.keys.filter(
        (key: any) => key.qKeyFields && key.qKeyFields.length > 1
      );

      // Analyze for island tables
      const connectedTables = new Set();
      analysis.keys.forEach((key: any) => {
        if (key.qTables) {
          key.qTables.forEach((table: string) => connectedTables.add(table));
        }
      });

      analysis.issues.islandTables = analysis.tables.filter(
        (table: any) => !connectedTables.has(table.qName)
      );

      return analysis;

    } catch (error) {
      if (session) {
        try {
          await session.close();
        } catch (closeError) {
          log.debug('Error closing session:', closeError);
        }
      }
      log.debug(`Failed to analyze data model for app ${appId}:`, error);
      throw error;
    }
  }

  /**
   * Get all sheets with objects
   */
  async getAllSheetsWithObjects(appId: string, options: AppMetadataOptions): Promise<SimpleSheet[]> {
    log.debug(`🔌 Connecting to Engine API for app ${appId}`);

    const { session, doc } = await this.sessionService.createTemporarySession(appId);

    try {
      log.debug(`✅ Connected to Engine API`);

      const sheets = await this.getSheetsWithObjects(doc, options);

      await session.close();
      log.debug(`🔌 Engine API connection closed`);

      return sheets;

    } catch (error) {
      if (session) {
        try {
          await session.close();
        } catch (closeError) {
          log.debug('Error closing session:', closeError);
        }
      }
      throw error;
    }
  }

  // ===== PRIVATE HELPER METHODS =====

  private async getBasicAppInfo(appId: string): Promise<{ id: string; name: string; owner: string; }> {
    try {
      const basicApp = await this.sessionService.getApiClient().getApp(appId);
      const ownerId = basicApp.owner || basicApp.attributes?.owner;

      const resolvedUsers = await this.sessionService.getApiClient().resolveOwnersToUsers([ownerId]);
      const resolvedUser = resolvedUsers.get(ownerId);

      return {
        id: appId,
        name: basicApp.name || basicApp.attributes?.name || 'Unknown App',
        owner: resolvedUser?.displayName || ownerId
      };
    } catch (error) {
      log.debug(`Failed to get basic app info for ${appId}:`, error);
      throw error;
    }
  }

  private async getSheetsWithObjects(doc: any, options: AppMetadataOptions): Promise<SimpleSheet[]> {
    log.debug(`📄 Getting sheets`);

    try {
      const sessionObjectDef = {
        qInfo: {
          qType: 'SheetsContainer',
          qId: ''
        },
        qAppObjectListDef: {
          qType: 'sheet',
          qData: {
            title: '/qMeta/title',
            description: '/qMeta/description',
            rank: '/rank',
            thumbnail: '/qMeta/dynamicColor'
          }
        }
      };

      const sessionObject = await doc.createSessionObject(sessionObjectDef);
      const layout = await sessionObject.getLayout();
      const sheetList = layout.qAppObjectList.qItems || [];

      log.debug(`Found ${sheetList.length} sheets`);

      const sheets: SimpleSheet[] = [];

      for (const sheetItem of sheetList) {
        try {
          const sheet = await this.extractSheetData(doc, sheetItem, options);
          sheets.push(sheet);
        } catch (error) {
          log.debug(`Failed to extract sheet ${sheetItem.qInfo.qId}:`, error);
        }
      }

      await doc.destroySessionObject(sessionObject.id);

      return sheets;

    } catch (error) {
      log.debug('Failed to get sheets:', error);
      throw error;
    }
  }

  private async extractSheetData(
    doc: any,
    sheetItem: any,
    options: AppMetadataOptions
  ): Promise<SimpleSheet> {
    const sheetId = sheetItem.qInfo.qId;
    log.debug(`📊 Extracting objects from sheet: ${sheetId}`);

    try {
      const sheetObject = await doc.getObject(sheetId);
      const sheetLayout = await sheetObject.getLayout();

      const sheetData: SimpleSheet = {
        id: sheetId,
        title: sheetLayout.qMeta?.title || sheetItem.qData?.title || 'Untitled Sheet',
        description: sheetLayout.qMeta?.description || sheetItem.qData?.description || '',
        totalObjects: 0,
        visualizationObjects: [],
        containerInfo: []
      };

      if (sheetLayout.cells) {
        const { extractedObjects, containerInfo } = await this.extractObjectsFromCells(
          doc,
          sheetLayout.cells,
          options
        );

        sheetData.visualizationObjects = extractedObjects;
        sheetData.containerInfo = containerInfo;
        sheetData.totalObjects = extractedObjects.length;
      }

      if (options.includeObjectData) {
        const allDimensions = new Set<string>();
        const allMeasures = new Set<string>();
        let totalDataRows = 0;

        sheetData.visualizationObjects.forEach(obj => {
          obj.dimensions?.forEach(d => allDimensions.add(d.label));
          obj.measures?.forEach(m => allMeasures.add(m.label));
          if (obj.sampleData) {
            totalDataRows += obj.sampleData.length;
          }
        });

        sheetData.sheetDataSummary = {
          totalDataRows,
          uniqueDimensions: Array.from(allDimensions),
          uniqueMeasures: Array.from(allMeasures),
          dataSourceTables: [],
          lastDataRefresh: new Date().toISOString()
        };
      }

      return sheetData;

    } catch (error) {
      log.debug(`Failed to extract sheet data for ${sheetId}:`, error);
      throw error;
    }
  }

  private async extractObjectsFromCells(
    doc: any,
    cells: any[],
    options: AppMetadataOptions
  ): Promise<{ extractedObjects: SimpleObject[], containerInfo: ContainerInfo[] }> {
    const extractedObjects: SimpleObject[] = [];
    const containerInfo: ContainerInfo[] = [];
    const processedIds = new Set<string>();

    for (const cell of cells) {
      try {
        if (!cell.name || !cell.type) continue;
        if (processedIds.has(cell.name)) continue;

        processedIds.add(cell.name);

        if (cell.type === 'container' || cell.type === 'layoutcontainer') {
          const container = await this.extractContainer(doc, cell, options, 0);
          if (container) {
            containerInfo.push(container);
            extractedObjects.push(...container.nestedObjects);
          }
        } else {
          const simpleObj = await this.extractSingleObject(doc, cell.name, cell.type, options);
          if (simpleObj) {
            extractedObjects.push(simpleObj);
          }
        }
      } catch (error) {
        log.debug(`Failed to extract object ${cell.name}:`, error);
      }
    }

    return { extractedObjects, containerInfo };
  }

  private async extractSingleObject(
    doc: any,
    objectId: string,
    objectType: string,
    options: AppMetadataOptions,
    parentContainer?: string,
    nestingLevel: number = 0
  ): Promise<SimpleObject | null> {
    try {
      const obj = await doc.getObject(objectId);
      const layout = await obj.getLayout();

      const simpleObject: SimpleObject = {
        id: objectId,
        type: objectType || layout.qInfo?.qType || 'unknown',
        title: layout.title || layout.qMeta?.title || '',
        subtitle: layout.subtitle || '',
        parentContainer,
        nestingLevel
      };

      if (layout.qHyperCube && options.includeObjectData) {
        const hypercubeInfo = await this.extractHypercubeInfo(layout.qHyperCube, obj, options);

        simpleObject.dimensions = hypercubeInfo.dimensions;
        simpleObject.measures = hypercubeInfo.measures;

        if (hypercubeInfo.sampleData && hypercubeInfo.sampleData.length > 0) {
          simpleObject.sampleData = hypercubeInfo.sampleData;
          simpleObject.dataExtractedAt = new Date().toISOString();
        }
      }

      if (layout.qListObject && options.includeObjectData) {
        const listInfo = await this.extractListObjectInfo(layout.qListObject, obj, options);
        simpleObject.dimensions = [{
          label: layout.title || 'List',
          fieldName: layout.qListObject.qDimensionInfo?.qGroupFieldDefs?.[0] || '',
          dataType: 'text',
          distinctValues: listInfo.cardinality
        }];

        if (listInfo.sampleValues) {
          simpleObject.sampleData = listInfo.sampleValues.map((v: any) => ({ value: v }));
        }
      }

      return simpleObject;

    } catch (error) {
      log.debug(`Failed to extract object ${objectId}:`, error);
      return null;
    }
  }

  private async extractContainer(
    doc: any,
    containerCell: any,
    options: AppMetadataOptions,
    currentDepth: number = 0
  ): Promise<ContainerInfo | null> {
    if (currentDepth >= (options.maxContainerDepth || 3)) {
      log.warn(`Max container depth reached for ${containerCell.name}`);
      return null;
    }

    try {
      const containerObj = await doc.getObject(containerCell.name);
      const containerLayout = await containerObj.getLayout();

      const container: ContainerInfo = {
        id: containerCell.name,
        type: containerCell.type,
        title: containerLayout.title || containerLayout.qMeta?.title || 'Container',
        isContainer: true,
        nestedObjects: [],
        totalNestedCount: 0
      };

      if (containerLayout.cells && Array.isArray(containerLayout.cells)) {
        for (const nestedCell of containerLayout.cells) {
          if (nestedCell.name && nestedCell.type) {
            const nestedObj = await this.extractSingleObject(
              doc,
              nestedCell.name,
              nestedCell.type,
              options,
              containerCell.name,
              currentDepth + 1
            );

            if (nestedObj) {
              container.nestedObjects.push(nestedObj);
            }
          }
        }
      }

      container.totalNestedCount = container.nestedObjects.length;
      return container;

    } catch (error) {
      log.debug(`Failed to extract container ${containerCell.name}:`, error);
      return null;
    }
  }

  private async extractHypercubeInfo(
    hypercube: any,
    objHandle: any,
    options: AppMetadataOptions
  ): Promise<any> {
    const dimensions: any[] = [];
    const measures: any[] = [];
    let sampleData: any[] = [];

    // Extract dimensions
    if (hypercube.qDimensionInfo) {
      hypercube.qDimensionInfo.forEach((dimInfo: any, index: number) => {
        dimensions.push({
          label: dimInfo.qFallbackTitle || `Dimension ${index + 1}`,
          fieldName: dimInfo.qGroupFieldDefs?.[0] || '',
          dataType: this.mapQlikDataType(dimInfo.qTags?.[0]),
          distinctValues: dimInfo.qCardinal
        });
      });
    }

    // Extract measures
    if (hypercube.qMeasureInfo) {
      hypercube.qMeasureInfo.forEach((measureInfo: any, index: number) => {
        measures.push({
          label: measureInfo.qFallbackTitle || `Measure ${index + 1}`,
          expression: measureInfo.qDef?.qDef || measureInfo.qDef || 'Unknown',
          format: measureInfo.qNumFormat ? {
            type: this.mapQlikNumberFormat(measureInfo.qNumFormat.qType),
            pattern: measureInfo.qNumFormat.qFmt,
            decimals: measureInfo.qNumFormat.qDec
          } : undefined,
          min: measureInfo.qMin,
          max: measureInfo.qMax
        });
      });
    }

    const totalRows = hypercube.qSize?.qcy || 0;

    if (options.sampleDataOnly && totalRows > 0) {
      try {
        const maxSampleRows = Math.min(options.maxDataRows || 100, totalRows);
        let dataMatrix: any[] = [];

        if (hypercube.qDataPages && hypercube.qDataPages.length > 0 && hypercube.qDataPages[0].qMatrix) {
          dataMatrix = hypercube.qDataPages[0].qMatrix.slice(0, maxSampleRows);
        } else {
          const dataPages = await objHandle.getHyperCubeData('/qHyperCubeDef', [{
            qTop: 0,
            qLeft: 0,
            qWidth: -1,
            qHeight: maxSampleRows
          }]);

          if (dataPages && dataPages[0]?.qMatrix) {
            dataMatrix = dataPages[0].qMatrix;
          }
        }

        if (dataMatrix.length > 0) {
          sampleData = dataMatrix.map((row: any) => {
            const rowData: Record<string, any> = {};

            dimensions.forEach((dim, dimIndex) => {
              if (row[dimIndex]) {
                rowData[dim.label] = row[dimIndex].qText || '';
              }
            });

            measures.forEach((measure, measureIndex) => {
              const cellIndex = dimensions.length + measureIndex;
              if (row[cellIndex]) {
                const cell = row[cellIndex];
                if (typeof cell.qNum === 'number' && !isNaN(cell.qNum)) {
                  rowData[measure.label] = cell.qNum;
                } else {
                  rowData[measure.label] = cell.qText || 0;
                }
              }
            });

            return rowData;
          });
        }
      } catch (error) {
        log.debug('Failed to extract sample data:', error);
      }
    }

    return { dimensions, measures, sampleData, totalRows };
  }

  private async extractListObjectInfo(listObject: any, objHandle: any, options: AppMetadataOptions): Promise<any> {
    const result = {
      cardinality: listObject.qDimensionInfo?.qCardinal || 0,
      sampleValues: [] as string[]
    };

    if (options.sampleDataOnly && listObject.qDataPages && listObject.qDataPages[0]) {
      const dataPage = listObject.qDataPages[0];
      result.sampleValues = dataPage.qMatrix
        .slice(0, options.maxDataRows || 10)
        .map((row: any) => row[0]?.qText || '');
    }

    return result;
  }

  private async extractDirectFromHypercube(
    originalLayout: any,
    originalObject: any,
    options: any = {}
  ): Promise<any> {
    log.debug('[Direct Hypercube] Extracting data directly from original hypercube');

    const originalHyperCube = originalLayout.qHyperCube;
    const maxRows = Math.min(options.maxRows || 1000, 10000);

    const data = await this.extractDataFromHypercube(originalHyperCube, originalObject);

    return {
      objectType: originalLayout.qInfo?.qType || 'unknown',
      dimensions: originalHyperCube.qDimensionInfo?.map((dim: any, index: number) => ({
        label: dim.qFallbackTitle,
        fieldName: dim.qGroupFieldDefs?.[0] || dim.qFieldDefs?.[0],
        position: index,
        type: 'dimension'
      })) || [],
      measures: originalHyperCube.qMeasureInfo?.map((measure: any, index: number) => ({
        label: measure.qFallbackTitle,
        expression: measure.qDef?.qDef || 'Unknown',
        position: index + (originalHyperCube.qDimensionInfo?.length || 0),
        type: 'measure'
      })) || [],
      data: data,
      totalRows: data.length,
      extractionMetadata: {
        timestamp: new Date().toISOString(),
        objectType: originalLayout.qInfo?.qType,
        originalMode: originalHyperCube.qMode,
        extractionMode: 'direct-hypercube-access'
      }
    };
  }

  private async extractDataFromHypercube(hyperCube: any, object: any): Promise<any[]> {
    log.debug('[Extract Data] Extracting data from original hypercube');

    const needsDataFetch = !hyperCube.qDataPages ||
                          hyperCube.qDataPages.length === 0 ||
                          !hyperCube.qDataPages[0]?.qMatrix ||
                          hyperCube.qDataPages[0].qMatrix.length === 0;

    let dataMatrix: any[] = [];

    if (needsDataFetch && hyperCube.qSize && hyperCube.qSize.qcy > 0) {
      log.debug(`[Extract Data] Fetching ${hyperCube.qSize.qcy} rows...`);

      try {
        const dataPages = await object.getHyperCubeData('/qHyperCubeDef', [{
          qTop: 0,
          qLeft: 0,
          qHeight: Math.min(hyperCube.qSize.qcy, 10000),
          qWidth: hyperCube.qSize.qcx
        }]);

        if (dataPages && dataPages[0]?.qMatrix) {
          dataMatrix = dataPages[0].qMatrix;
          log.debug(`[Extract Data] Successfully fetched ${dataMatrix.length} rows`);
        }

      } catch (fetchError) {
        log.debug('[Extract Data] Error fetching data:', fetchError);
        throw fetchError;
      }
    } else if (hyperCube.qDataPages && hyperCube.qDataPages[0]?.qMatrix) {
      dataMatrix = hyperCube.qDataPages[0].qMatrix;
      log.debug(`[Extract Data] Using existing data: ${dataMatrix.length} rows`);
    }

    const dimensionCount = hyperCube.qDimensionInfo?.length || 0;
    const measureCount = hyperCube.qMeasureInfo?.length || 0;

    return dataMatrix.map((row: any[]) => {
      const processedRow: any[] = [];

      for (let i = 0; i < dimensionCount; i++) {
        processedRow.push({
          text: row[i]?.qText || '',
          number: row[i]?.qNum,
          isNull: row[i]?.qIsNull || false
        });
      }

      for (let i = 0; i < measureCount; i++) {
        const cellIndex = dimensionCount + i;
        const cell = row[cellIndex];

        processedRow.push({
          text: cell?.qText || '',
          number: cell?.qNum,
          isNull: cell?.qIsNull || false
        });
      }

      return processedRow;
    });
  }

  private async extractKPIData(layout: any, object: any): Promise<any> {
    log.debug('[KPI Extraction] Extracting KPI data');

    return {
      objectType: 'kpi',
      dimensions: [],
      measures: [{
        label: layout.title || 'KPI Value',
        expression: layout.qHyperCube?.qMeasureInfo?.[0]?.qDef?.qDef || 'Unknown',
        position: 0,
        type: 'measure'
      }],
      data: [[{
        text: layout.qHyperCube?.qDataPages?.[0]?.qMatrix?.[0]?.[0]?.qText || '',
        number: layout.qHyperCube?.qDataPages?.[0]?.qMatrix?.[0]?.[0]?.qNum || 0,
        isNull: false
      }]],
      totalRows: 1,
      extractionMetadata: {
        timestamp: new Date().toISOString(),
        objectType: 'kpi',
        extractionMode: 'kpi-extraction'
      }
    };
  }

  private convertToObjectDataSample(extractedData: any, objectId: string): ObjectDataSample {
    const sampleData: Array<Record<string, any>> = [];
    const columnInfo: Array<any> = [];

    if (extractedData.data && Array.isArray(extractedData.data)) {
      extractedData.data.forEach((row: any, rowIndex: number) => {
        const simpleRow: Record<string, any> = {};

        extractedData.dimensions?.forEach((dim: any, dimIndex: number) => {
          const cell = row[dimIndex];
          simpleRow[dim.label] = cell?.text || '';
        });

        extractedData.measures?.forEach((measure: any, measureIndex: number) => {
          const cellIndex = extractedData.dimensions.length + measureIndex;
          const cell = row[cellIndex];

          if (cell && typeof cell.number === 'number' && !isNaN(cell.number)) {
            simpleRow[measure.label] = cell.number;
          } else {
            simpleRow[measure.label] = cell?.text || 0;
          }
        });

        sampleData.push(simpleRow);
      });
    }

    extractedData.dimensions?.forEach((dim: any) => {
      columnInfo.push({
        name: dim.label,
        type: 'dimension',
        dataType: 'text'
      });
    });

    extractedData.measures?.forEach((measure: any) => {
      columnInfo.push({
        name: measure.label,
        type: 'measure',
        dataType: 'numeric',
        expression: measure.expression
      });
    });

    return {
      objectId,
      objectType: extractedData.objectType || 'unknown',
      sampleData,
      totalRows: extractedData.totalRows || sampleData.length,
      columnInfo,
      dataExtractedAt: new Date().toISOString()
    };
  }

  private formatHypercubeData(dataPage: any, hyperCube: any): HypercubeData {
    const matrix = dataPage.qMatrix;
    const dimensions = hyperCube.qDimensionInfo || [];
    const measures = hyperCube.qMeasureInfo || [];

    const columns = [
      ...dimensions.map((dim: any, idx: number) => ({
        name: dim.qFallbackTitle,
        type: 'dimension' as const,
        index: idx,
        field: dim.qGroupFieldDefs?.[0] || dim.qFieldDefs?.[0]
      })),
      ...measures.map((measure: any, idx: number) => ({
        name: measure.qFallbackTitle,
        type: 'measure' as const,
        index: dimensions.length + idx,
        expression: measure.qDef?.qDef,
        format: measure.qNumFormat
      }))
    ];

    const rows = matrix.map((row: any[], rowIndex: number) => {
      const rowData: any = {};

      row.forEach((cell: any, cellIndex: number) => {
        const column = columns[cellIndex];
        if (column) {
          if (column.type === 'dimension') {
            rowData[column.name] = cell.qText || '';
          } else {
            rowData[column.name] = {
              value: cell.qNum !== undefined ? cell.qNum : null,
              text: cell.qText || '',
              ...(column.format && { format: column.format })
            };
          }
        }
      });

      return rowData;
    });

    return {
      columns,
      rows,
      totalRows: hyperCube.qSize.qcy,
      fetchedRows: rows.length,
      hasMore: rows.length < hyperCube.qSize.qcy
    };
  }

  private buildExtractionStats(sheets: SimpleSheet[]): any {
    const stats = {
      totalLayoutContainers: 0,
      totalNestedObjects: 0,
      successfulExtractions: 0,
      failedExtractions: 0,
      visualizationTypeBreakdown: {} as Record<string, number>,
      containerAnalysis: {
        totalContainers: 0,
        containersWithNested: 0,
        averageNestedPerContainer: 0,
        maxNestingDepth: 0
      },
      dataExtractionStats: {
        objectsWithData: 0,
        totalDataRows: 0,
        hypercubesExtracted: 0,
        listObjectsExtracted: 0,
        fieldValuesExtracted: 0,
        dataExtractionErrors: 0
      }
    };

    let maxDepth = 0;
    let totalNestedObjects = 0;

    sheets.forEach(sheet => {
      stats.containerAnalysis.totalContainers += sheet.containerInfo.length;
      stats.totalLayoutContainers += sheet.containerInfo.length;

      sheet.containerInfo.forEach(container => {
        if (container.nestedObjects.length > 0) {
          stats.containerAnalysis.containersWithNested++;
          totalNestedObjects += container.nestedObjects.length;
        }
      });

      sheet.visualizationObjects.forEach(obj => {
        stats.successfulExtractions++;

        const type = obj.type || 'unknown';
        stats.visualizationTypeBreakdown[type] = (stats.visualizationTypeBreakdown[type] || 0) + 1;

        if (obj.nestingLevel && obj.nestingLevel > maxDepth) {
          maxDepth = obj.nestingLevel;
        }

        if (obj.sampleData && obj.sampleData.length > 0) {
          stats.dataExtractionStats.objectsWithData++;
          stats.dataExtractionStats.totalDataRows += obj.sampleData.length;
          stats.dataExtractionStats.hypercubesExtracted++;
        }
      });
    });

    stats.totalNestedObjects = totalNestedObjects;
    stats.containerAnalysis.maxNestingDepth = maxDepth;
    stats.containerAnalysis.averageNestedPerContainer =
      stats.containerAnalysis.totalContainers > 0
        ? Math.round((totalNestedObjects / stats.containerAnalysis.totalContainers) * 100) / 100
        : 0;

    return stats;
  }

  private buildAppDataSummary(sheets: SimpleSheet[]): any {
    const allDimensions = new Set<string>();
    const allMeasures = new Set<string>();
    const dataSources = new Set<string>();
    let totalDataPoints = 0;

    sheets.forEach(sheet => {
      sheet.visualizationObjects.forEach(obj => {
        obj.dimensions?.forEach(dim => {
          if (dim.fieldName) {
            allDimensions.add(dim.fieldName);
            const parts = dim.fieldName.split('.');
            if (parts.length > 1) {
              dataSources.add(parts[0]);
            }
          }
        });

        obj.measures?.forEach(measure => {
          if (measure.expression) {
            allMeasures.add(measure.label);
          }
        });

        if (obj.sampleData) {
          totalDataPoints += obj.sampleData.length *
            ((obj.dimensions?.length || 0) + (obj.measures?.length || 0));
        }
      });
    });

    const uniqueObjects = sheets.reduce((sum, sheet) => sum + sheet.totalObjects, 0);
    const complexity =
      uniqueObjects < 10 ? 'simple' :
      uniqueObjects < 50 ? 'moderate' : 'complex';

    return {
      totalDataPoints,
      dimensionsUsed: Array.from(allDimensions),
      measuresUsed: Array.from(allMeasures),
      dataSources: Array.from(dataSources),
      dataModelComplexity: complexity,
      estimatedDataFreshness: new Date().toISOString()
    };
  }

  private mapQlikDataType(qTag?: string): 'text' | 'numeric' | 'date' | 'timestamp' | 'dual' {
    if (!qTag) return 'text';

    const tag = qTag.toLowerCase();
    if (tag.includes('$numeric') || tag.includes('$integer')) return 'numeric';
    if (tag.includes('$date')) return 'date';
    if (tag.includes('$timestamp')) return 'timestamp';
    if (tag.includes('$text')) return 'text';

    return 'dual';
  }

  private mapQlikNumberFormat(qType?: string): string {
    switch (qType) {
      case 'F': return 'fixed';
      case 'I': return 'integer';
      case 'M': return 'money';
      case 'D': return 'date';
      case 'T': return 'time';
      case 'TS': return 'timestamp';
      case 'IV': return 'interval';
      default: return 'number';
    }
  }
}
