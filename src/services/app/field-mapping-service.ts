/**
 * Field Mapping Service - Maps fields and master items from Qlik apps
 *
 * Handles:
 * - Map all fields with metadata
 * - Map master dimensions
 * - Map master measures
 * - Timeout-protected operations
 * - Batch processing
 */

import { SessionService } from './session-service.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ service: 'FieldMapping' });
import {
  FieldInfo,
  FieldMappingResult,
  MasterDimensionResult,
  MasterMeasureResult,
  FieldsWithTimeoutResult,
  DimensionsWithTimeoutResult,
  MeasuresWithTimeoutResult
} from './app-types.js';

export class FieldMappingService {
  private sessionService: SessionService;

  constructor(sessionService: SessionService) {
    this.sessionService = sessionService;
  }

  /**
   * Map all fields from an app with pagination
   */
  async mapAllFields(appId: string, batchSize: number = 50): Promise<FieldMappingResult> {
    log.debug(`[FieldMappingService] Mapping all fields for app ${appId} (batch size: ${batchSize})`);

    const { session, doc } = await this.sessionService.createTemporarySession(appId);
    const allFields: FieldInfo[] = [];

    try {
      log.debug(`✅ Connected to app ${appId} for field mapping`);

      const fieldListObj = await doc.createSessionObject({
        qInfo: { qType: 'FieldList' },
        qFieldListDef: {
          qShowSystem: false,
          qShowHidden: false,
          qShowSemantic: true,
          qShowSrcTables: true
        }
      });

      const fieldListLayout = await fieldListObj.getLayout();
      const fieldItems = fieldListLayout.qFieldList?.qItems || [];

      log.debug(`📊 Found ${fieldItems.length} fields total`);

      let batchNumber = 0;
      for (let i = 0; i < fieldItems.length; i += batchSize) {
        batchNumber++;
        const batch = fieldItems.slice(i, i + batchSize);
        log.debug(`📦 Processing batch ${batchNumber}: fields ${i + 1} to ${Math.min(i + batchSize, fieldItems.length)}`);

        for (const fieldItem of batch) {
          try {
            const fieldInfo: FieldInfo = {
              name: fieldItem.qName,
              cardinality: fieldItem.qCardinal || 0,
              tags: fieldItem.qTags || [],
              isNumeric: fieldItem.qTags?.includes('$numeric') || false,
              dataType: this.detectFieldDataType(fieldItem.qTags || [])
            };

            if (fieldInfo.cardinality > 0 && fieldInfo.cardinality <= 1000) {
              try {
                const sampleValues = await this.getFieldSampleValuesInternal(doc, fieldItem.qName, 5);
                fieldInfo.sampleValues = sampleValues;
              } catch (e) {
                // Skip sample values on error
              }
            }

            allFields.push(fieldInfo);
          } catch (fieldError) {
            log.debug(`⚠️ Error processing field ${fieldItem.qName}:`, fieldError);
          }
        }
      }

      await session.close();

      return {
        fields: allFields,
        totalCount: allFields.length,
        batches: batchNumber
      };

    } catch (error) {
      if (session) {
        try { await session.close(); } catch (e) { /* ignore */ }
      }
      log.debug(`Failed to map fields for app ${appId}:`, error);
      throw error;
    }
  }

  /**
   * Map all master dimensions from an app
   */
  async mapAllMasterDimensions(appId: string, batchSize: number = 50): Promise<MasterDimensionResult> {
    log.debug(`[FieldMappingService] Mapping all master dimensions for app ${appId}`);

    const { session, doc } = await this.sessionService.createTemporarySession(appId);
    const allDimensions: any[] = [];

    try {
      log.debug(`✅ Connected to app ${appId} for master dimension mapping`);

      const dimListObj = await doc.createSessionObject({
        qInfo: { qType: 'DimensionList' },
        qDimensionListDef: {
          qType: 'dimension',
          qData: {
            title: '/title',
            tags: '/tags',
            grouping: '/qDim/qGrouping',
            info: '/qDimInfos'
          }
        }
      });

      const dimListLayout = await dimListObj.getLayout();
      const dimItems = dimListLayout.qDimensionList?.qItems || [];

      log.debug(`📊 Found ${dimItems.length} master dimensions total`);

      let batchNumber = 0;
      for (let i = 0; i < dimItems.length; i += batchSize) {
        batchNumber++;
        const batch = dimItems.slice(i, i + batchSize);
        log.debug(`📦 Processing batch ${batchNumber}: dimensions ${i + 1} to ${Math.min(i + batchSize, dimItems.length)}`);

        for (const dimItem of batch) {
          try {
            const dimension = await doc.getDimension(dimItem.qInfo.qId);
            const dimProps = await dimension.getProperties();

            allDimensions.push({
              id: dimItem.qInfo.qId,
              title: dimProps.qMetaDef?.title || dimItem.qMeta?.title || '',
              description: dimProps.qMetaDef?.description || '',
              tags: dimProps.qMetaDef?.tags || [],
              grouping: dimProps.qDim?.qGrouping || 'N',
              fieldDefs: dimProps.qDim?.qFieldDefs || [],
              fieldLabels: dimProps.qDim?.qFieldLabels || []
            });
          } catch (dimError) {
            log.debug(`⚠️ Error processing dimension ${dimItem.qInfo.qId}:`, dimError);
            allDimensions.push({
              id: dimItem.qInfo.qId,
              title: dimItem.qMeta?.title || dimItem.qData?.title || '',
              description: '',
              tags: dimItem.qMeta?.tags || [],
              grouping: dimItem.qData?.grouping || 'N',
              fieldDefs: [],
              fieldLabels: []
            });
          }
        }
      }

      await session.close();

      return {
        dimensions: allDimensions,
        totalCount: allDimensions.length,
        batches: batchNumber
      };

    } catch (error) {
      if (session) {
        try { await session.close(); } catch (e) { /* ignore */ }
      }
      log.debug(`Failed to map master dimensions for app ${appId}:`, error);
      throw error;
    }
  }

  /**
   * Map all master measures from an app
   */
  async mapAllMasterMeasures(appId: string, batchSize: number = 50): Promise<MasterMeasureResult> {
    log.debug(`[FieldMappingService] Mapping all master measures for app ${appId}`);

    const { session, doc } = await this.sessionService.createTemporarySession(appId);
    const allMeasures: any[] = [];

    try {
      log.debug(`✅ Connected to app ${appId} for master measure mapping`);

      const measureListObj = await doc.createSessionObject({
        qInfo: { qType: 'MeasureList' },
        qMeasureListDef: {
          qType: 'measure',
          qData: {
            title: '/title',
            tags: '/tags',
            measure: '/qMeasure'
          }
        }
      });

      const measureListLayout = await measureListObj.getLayout();
      const measureItems = measureListLayout.qMeasureList?.qItems || [];

      log.debug(`📊 Found ${measureItems.length} master measures total`);

      let batchNumber = 0;
      for (let i = 0; i < measureItems.length; i += batchSize) {
        batchNumber++;
        const batch = measureItems.slice(i, i + batchSize);
        log.debug(`📦 Processing batch ${batchNumber}: measures ${i + 1} to ${Math.min(i + batchSize, measureItems.length)}`);

        for (const measureItem of batch) {
          try {
            const measure = await doc.getMeasure(measureItem.qInfo.qId);
            const measureProps = await measure.getProperties();

            allMeasures.push({
              id: measureItem.qInfo.qId,
              title: measureProps.qMetaDef?.title || measureItem.qMeta?.title || '',
              description: measureProps.qMetaDef?.description || '',
              tags: measureProps.qMetaDef?.tags || [],
              expression: measureProps.qMeasure?.qDef || '',
              label: measureProps.qMeasure?.qLabel || '',
              numFormat: measureProps.qMeasure?.qNumFormat || null
            });
          } catch (measureError) {
            log.debug(`⚠️ Error processing measure ${measureItem.qInfo.qId}:`, measureError);
            allMeasures.push({
              id: measureItem.qInfo.qId,
              title: measureItem.qMeta?.title || measureItem.qData?.title || '',
              description: '',
              tags: measureItem.qMeta?.tags || [],
              expression: measureItem.qData?.measure?.qDef || '',
              label: measureItem.qData?.measure?.qLabel || '',
              numFormat: null
            });
          }
        }
      }

      await session.close();

      return {
        measures: allMeasures,
        totalCount: allMeasures.length,
        batches: batchNumber
      };

    } catch (error) {
      if (session) {
        try { await session.close(); } catch (e) { /* ignore */ }
      }
      log.debug(`Failed to map master measures for app ${appId}:`, error);
      throw error;
    }
  }

  /**
   * Map all fields and master items in one call
   */
  async mapAllFieldsAndMasterItems(appId: string, batchSize: number = 50): Promise<{
    fields: FieldInfo[];
    masterDimensions: any[];
    masterMeasures: any[];
    summary: {
      totalFields: number;
      totalMasterDimensions: number;
      totalMasterMeasures: number;
      totalBatches: number;
    };
  }> {
    log.debug(`[FieldMappingService] Mapping all fields and master items for app ${appId}`);

    const [fieldsResult, dimensionsResult, measuresResult] = await Promise.all([
      this.mapAllFields(appId, batchSize),
      this.mapAllMasterDimensions(appId, batchSize),
      this.mapAllMasterMeasures(appId, batchSize)
    ]);

    return {
      fields: fieldsResult.fields,
      masterDimensions: dimensionsResult.dimensions,
      masterMeasures: measuresResult.measures,
      summary: {
        totalFields: fieldsResult.totalCount,
        totalMasterDimensions: dimensionsResult.totalCount,
        totalMasterMeasures: measuresResult.totalCount,
        totalBatches: fieldsResult.batches + dimensionsResult.batches + measuresResult.batches
      }
    };
  }

  /**
   * Map all fields with full metadata and timeout protection
   */
  async mapFieldsWithTimeout(
    appId: string,
    options: {
      batchSize?: number;
      fieldTimeoutMs?: number;
      totalTimeoutMs?: number;
      includeSampleValues?: boolean;
      maxSampleValues?: number;
    } = {}
  ): Promise<FieldsWithTimeoutResult> {
    const {
      batchSize = 50,
      fieldTimeoutMs = 5000,
      totalTimeoutMs = 300000,
      includeSampleValues = true,
      maxSampleValues = 5
    } = options;

    const startTime = Date.now();
    const errors: string[] = [];
    let session: any = null;
    const allFields: any[] = [];
    let processedCount = 0;
    let skippedCount = 0;
    let batchNumber = 0;
    let timeoutOccurred = false;

    log.debug(`[FieldMappingService] mapFieldsWithTimeout for app ${appId}`);

    try {
      const checkTimeout = () => {
        if (Date.now() - startTime > totalTimeoutMs) {
          timeoutOccurred = true;
          return true;
        }
        return false;
      };

      const { session: s, doc } = await this.sessionService.createTemporarySession(appId);
      session = s;

      log.debug(`✅ Connected to app ${appId}`);

      const fieldListObj: any = await this.sessionService.withTimeout(
        doc.createSessionObject({
          qInfo: { qType: 'FieldList' },
          qFieldListDef: {
            qShowSystem: true,
            qShowHidden: true,
            qShowSemantic: true,
            qShowSrcTables: true,
            qShowDefinitionOnly: false,
            qShowDerivedFields: true,
            qShowImplicit: false
          }
        }),
        10000,
        'Create field list'
      );

      const fieldListLayout: any = await this.sessionService.withTimeout(
        fieldListObj.getLayout(),
        10000,
        'Get field list layout'
      );

      const fieldItems = fieldListLayout.qFieldList?.qItems || [];
      log.debug(`📊 Found ${fieldItems.length} fields total`);

      for (let i = 0; i < fieldItems.length && !checkTimeout(); i += batchSize) {
        batchNumber++;
        const batch = fieldItems.slice(i, i + batchSize);
        const batchEnd = Math.min(i + batchSize, fieldItems.length);
        log.debug(`📦 Batch ${batchNumber}: fields ${i + 1} to ${batchEnd}`);

        for (const fieldItem of batch) {
          if (checkTimeout()) {
            log.debug(`⏱️ Total timeout reached at field ${processedCount}`);
            break;
          }

          try {
            const tagFlags = this.parseFieldTags(fieldItem.qTags || []);

            const fieldInfo: any = {
              name: fieldItem.qName,
              cardinality: fieldItem.qCardinal || 0,
              dataType: this.detectFieldDataType(fieldItem.qTags || []),
              ...tagFlags,
              srcTables: fieldItem.qSrcTables || [],
              sampleValues: []
            };

            if (includeSampleValues && fieldInfo.cardinality > 0 && fieldInfo.cardinality <= 10000 && !fieldInfo.isHidden) {
              try {
                const sampleValues = await this.sessionService.withTimeout(
                  this.getFieldSampleValuesInternal(doc, fieldItem.qName, maxSampleValues),
                  fieldTimeoutMs,
                  `Sample values for ${fieldItem.qName}`
                );
                fieldInfo.sampleValues = sampleValues;
              } catch (e) {
                fieldInfo.sampleValues = [];
              }
            }

            allFields.push(fieldInfo);
            processedCount++;
          } catch (fieldError: any) {
            skippedCount++;
            const errorMsg = `Field ${fieldItem.qName}: ${fieldError.message}`;
            errors.push(errorMsg);
            log.debug(`⚠️ ${errorMsg}`);
          }
        }
      }

      await session.close();
      session = null;

      const elapsedMs = Date.now() - startTime;
      log.debug(`✅ Completed: ${processedCount} processed, ${skippedCount} skipped, ${elapsedMs}ms`);

      return {
        success: true,
        fields: allFields,
        totalCount: fieldItems.length,
        processedCount,
        skippedCount,
        batches: batchNumber,
        timeoutOccurred,
        elapsedMs,
        errors
      };

    } catch (error: any) {
      const elapsedMs = Date.now() - startTime;
      log.debug(`❌ Error: ${error.message}`);
      errors.push(error.message);

      return {
        success: false,
        fields: allFields,
        totalCount: 0,
        processedCount,
        skippedCount,
        batches: batchNumber,
        timeoutOccurred,
        elapsedMs,
        errors
      };
    } finally {
      if (session) {
        try { await session.close(); } catch (e) { /* ignore */ }
      }
    }
  }

  /**
   * Map all master dimensions with timeout protection
   */
  async mapMasterDimensionsWithTimeout(
    appId: string,
    options: {
      batchSize?: number;
      itemTimeoutMs?: number;
      totalTimeoutMs?: number;
    } = {}
  ): Promise<DimensionsWithTimeoutResult> {
    const {
      batchSize = 50,
      itemTimeoutMs = 5000,
      totalTimeoutMs = 300000
    } = options;

    const startTime = Date.now();
    const errors: string[] = [];
    let session: any = null;
    const allDimensions: any[] = [];
    let processedCount = 0;
    let skippedCount = 0;
    let timeoutOccurred = false;

    log.debug(`[FieldMappingService] mapMasterDimensionsWithTimeout for app ${appId}`);

    try {
      const checkTimeout = () => {
        if (Date.now() - startTime > totalTimeoutMs) {
          timeoutOccurred = true;
          return true;
        }
        return false;
      };

      const { session: s, doc } = await this.sessionService.createTemporarySession(appId);
      session = s;

      log.debug(`✅ Connected to app ${appId}`);

      const dimListObj: any = await this.sessionService.withTimeout(
        doc.createSessionObject({
          qInfo: { qType: 'DimensionList' },
          qDimensionListDef: {
            qType: 'dimension',
            qData: {
              title: '/title',
              tags: '/tags',
              grouping: '/qDim/qGrouping',
              info: '/qDimInfos'
            }
          }
        }),
        10000,
        'Create dimension list'
      );

      const dimListLayout: any = await this.sessionService.withTimeout(dimListObj.getLayout(), 10000, 'Get dimension list');
      const dimItems = dimListLayout.qDimensionList?.qItems || [];

      log.debug(`📊 Found ${dimItems.length} master dimensions`);

      for (const dimItem of dimItems) {
        if (checkTimeout()) break;

        try {
          const dimension: any = await this.sessionService.withTimeout(
            doc.getDimension(dimItem.qInfo.qId),
            itemTimeoutMs,
            `Get dimension ${dimItem.qInfo.qId}`
          );

          const dimProps: any = await this.sessionService.withTimeout(
            dimension.getProperties(),
            itemTimeoutMs,
            `Get properties ${dimItem.qInfo.qId}`
          );

          const grouping = dimProps.qDim?.qGrouping || 'N';

          allDimensions.push({
            id: dimItem.qInfo.qId,
            title: dimProps.qMetaDef?.title || '',
            description: dimProps.qMetaDef?.description || '',
            tags: dimProps.qMetaDef?.tags || [],
            grouping,
            groupingType: grouping === 'H' ? 'Hierarchy (Drill-down)' : grouping === 'C' ? 'Cyclic' : 'None',
            isHierarchy: grouping === 'H',
            isCyclic: grouping === 'C',
            fieldCount: (dimProps.qDim?.qFieldDefs || []).length,
            fieldDefs: dimProps.qDim?.qFieldDefs || [],
            fieldLabels: dimProps.qDim?.qFieldLabels || []
          });

          processedCount++;
        } catch (e: any) {
          skippedCount++;
          errors.push(`Dimension ${dimItem.qInfo.qId}: ${e.message}`);
        }
      }

      await session.close();
      session = null;

      return {
        success: true,
        dimensions: allDimensions,
        totalCount: dimItems.length,
        processedCount,
        skippedCount,
        timeoutOccurred,
        elapsedMs: Date.now() - startTime,
        errors
      };

    } catch (error: any) {
      errors.push(error.message);
      return {
        success: false,
        dimensions: allDimensions,
        totalCount: 0,
        processedCount,
        skippedCount,
        timeoutOccurred,
        elapsedMs: Date.now() - startTime,
        errors
      };
    } finally {
      if (session) {
        try { await session.close(); } catch (e) { /* ignore */ }
      }
    }
  }

  /**
   * Map all master measures with timeout protection and reconnect logic
   */
  async mapMasterMeasuresWithTimeout(
    appId: string,
    options: {
      batchSize?: number;
      itemTimeoutMs?: number;
      totalTimeoutMs?: number;
    } = {}
  ): Promise<MeasuresWithTimeoutResult> {
    const {
      batchSize = 50,
      itemTimeoutMs = 5000,
      totalTimeoutMs = 300000
    } = options;

    const startTime = Date.now();
    const errors: string[] = [];
    let session: any = null;
    let doc: any = null;
    const allMeasures: any[] = [];
    let processedCount = 0;
    let skippedCount = 0;
    let reconnects = 0;
    let timeoutOccurred = false;
    let measureItems: any[] = [];

    log.debug(`[FieldMappingService] mapMasterMeasuresWithTimeout for app ${appId}`);

    const ensureConnected = async () => {
      if (session && !session.suspended) {
        return;
      }
      if (session) {
        try { await session.close(); } catch (e) { /* ignore */ }
      }
      reconnects++;
      const conn = await this.sessionService.connectWithRetry(appId);
      session = conn.session;
      doc = conn.doc;
    };

    try {
      const checkTimeout = () => {
        if (Date.now() - startTime > totalTimeoutMs) {
          timeoutOccurred = true;
          return true;
        }
        return false;
      };

      await ensureConnected();

      const measureListObj: any = await this.sessionService.withTimeout(
        doc.createSessionObject({
          qInfo: { qType: 'MeasureList' },
          qMeasureListDef: {
            qType: 'measure',
            qData: {
              title: '/title',
              tags: '/tags',
              measure: '/qMeasure'
            }
          }
        }),
        10000,
        'Create measure list'
      );

      const measureListLayout: any = await this.sessionService.withTimeout(measureListObj.getLayout(), 10000, 'Get measure list');
      measureItems = measureListLayout.qMeasureList?.qItems || [];

      log.debug(`📊 Found ${measureItems.length} master measures`);

      for (const measureItem of measureItems) {
        if (checkTimeout()) break;

        try {
          if (session.suspended) {
            log.debug('🔄 Connection lost, reconnecting...');
            await ensureConnected();
          }

          const measure: any = await this.sessionService.withTimeout(
            doc.getMeasure(measureItem.qInfo.qId),
            itemTimeoutMs,
            `Get measure ${measureItem.qInfo.qId}`
          );

          const measureProps: any = await this.sessionService.withTimeout(
            measure.getProperties(),
            itemTimeoutMs,
            `Get properties ${measureItem.qInfo.qId}`
          );

          const numFormat = measureProps.qMeasure?.qNumFormat || {};

          allMeasures.push({
            id: measureItem.qInfo.qId,
            title: measureProps.qMetaDef?.title || '',
            description: measureProps.qMetaDef?.description || '',
            tags: measureProps.qMetaDef?.tags || [],
            expression: measureProps.qMeasure?.qDef || '',
            label: measureProps.qMeasure?.qLabel || '',
            formatType: numFormat.qType || 'U',
            formatPattern: numFormat.qFmt || '',
            decimals: numFormat.qnDec || 0,
            useThousands: numFormat.qUseThou === 1
          });

          processedCount++;
        } catch (e: any) {
          if (this.sessionService.isConnectionError(e)) {
            log.debug(`🔄 Connection error on measure ${measureItem.qInfo.qId}, reconnecting...`);
            try {
              await ensureConnected();
              const measure: any = await this.sessionService.withTimeout(
                doc.getMeasure(measureItem.qInfo.qId),
                itemTimeoutMs,
                `Get measure ${measureItem.qInfo.qId} (retry)`
              );
              const measureProps: any = await this.sessionService.withTimeout(
                measure.getProperties(),
                itemTimeoutMs,
                `Get properties ${measureItem.qInfo.qId} (retry)`
              );
              const numFormat = measureProps.qMeasure?.qNumFormat || {};
              allMeasures.push({
                id: measureItem.qInfo.qId,
                title: measureProps.qMetaDef?.title || '',
                description: measureProps.qMetaDef?.description || '',
                tags: measureProps.qMetaDef?.tags || [],
                expression: measureProps.qMeasure?.qDef || '',
                label: measureProps.qMeasure?.qLabel || '',
                formatType: numFormat.qType || 'U',
                formatPattern: numFormat.qFmt || '',
                decimals: numFormat.qnDec || 0,
                useThousands: numFormat.qUseThou === 1
              });
              processedCount++;
            } catch (retryErr: any) {
              skippedCount++;
              errors.push(`Measure ${measureItem.qInfo.qId}: ${retryErr.message} (after retry)`);
            }
          } else {
            skippedCount++;
            errors.push(`Measure ${measureItem.qInfo.qId}: ${e.message}`);
          }
        }
      }

      if (session) {
        await session.close();
        session = null;
      }

      return {
        success: true,
        measures: allMeasures,
        totalCount: measureItems.length,
        processedCount,
        skippedCount,
        reconnects,
        timeoutOccurred,
        elapsedMs: Date.now() - startTime,
        errors
      };

    } catch (error: any) {
      errors.push(error.message);
      return {
        success: false,
        measures: allMeasures,
        totalCount: measureItems.length,
        processedCount,
        skippedCount,
        reconnects,
        timeoutOccurred,
        elapsedMs: Date.now() - startTime,
        errors
      };
    } finally {
      if (session) {
        try { await session.close(); } catch (e) { /* ignore */ }
      }
    }
  }

  /**
   * Map everything with timeout protection
   */
  async mapAllWithTimeout(
    appId: string,
    options: {
      totalTimeoutMs?: number;
      includeSampleValues?: boolean;
    } = {}
  ): Promise<{
    success: boolean;
    appId: string;
    fields: FieldsWithTimeoutResult;
    masterDimensions: DimensionsWithTimeoutResult;
    masterMeasures: MeasuresWithTimeoutResult;
    summary: {
      totalFields: number;
      totalMasterDimensions: number;
      totalMasterMeasures: number;
      totalProcessed: number;
      totalSkipped: number;
      totalErrors: number;
      totalReconnects: number;
    };
    elapsedMs: number;
    timeoutOccurred: boolean;
  }> {
    const { totalTimeoutMs = 600000, includeSampleValues = true } = options;
    const startTime = Date.now();

    log.debug(`[FieldMappingService] mapAllWithTimeout for app ${appId} (timeout: ${totalTimeoutMs}ms)`);

    const perOperationTimeout = Math.floor(totalTimeoutMs / 3);

    const fieldsResult = await this.mapFieldsWithTimeout(appId, {
      totalTimeoutMs: perOperationTimeout,
      includeSampleValues
    });

    const dimensionsResult = await this.mapMasterDimensionsWithTimeout(appId, {
      totalTimeoutMs: perOperationTimeout
    });

    const measuresResult = await this.mapMasterMeasuresWithTimeout(appId, {
      totalTimeoutMs: perOperationTimeout
    });

    const elapsedMs = Date.now() - startTime;
    const timeoutOccurred = fieldsResult.timeoutOccurred || dimensionsResult.timeoutOccurred || measuresResult.timeoutOccurred;

    return {
      success: fieldsResult.success && dimensionsResult.success && measuresResult.success,
      appId,
      fields: fieldsResult,
      masterDimensions: dimensionsResult,
      masterMeasures: measuresResult,
      summary: {
        totalFields: fieldsResult.totalCount,
        totalMasterDimensions: dimensionsResult.totalCount,
        totalMasterMeasures: measuresResult.totalCount,
        totalProcessed: fieldsResult.processedCount + dimensionsResult.processedCount + measuresResult.processedCount,
        totalSkipped: fieldsResult.skippedCount + dimensionsResult.skippedCount + measuresResult.skippedCount,
        totalErrors: fieldsResult.errors.length + dimensionsResult.errors.length + measuresResult.errors.length,
        totalReconnects: measuresResult.reconnects || 0
      },
      elapsedMs,
      timeoutOccurred
    };
  }

  // ===== PRIVATE HELPER METHODS =====

  private async getFieldSampleValuesInternal(doc: any, fieldName: string, limit: number = 5): Promise<string[]> {
    try {
      const listObj = await doc.createSessionObject({
        qInfo: { qType: 'FieldValues' },
        qListObjectDef: {
          qDef: { qFieldDefs: [fieldName] },
          qInitialDataFetch: [{
            qTop: 0,
            qLeft: 0,
            qHeight: limit,
            qWidth: 1
          }]
        }
      });

      const layout = await listObj.getLayout();
      const values = layout.qListObject?.qDataPages?.[0]?.qMatrix || [];

      await doc.destroySessionObject(listObj.id);

      return values.map((row: any) => row[0]?.qText || '').filter((v: string) => v);
    } catch (error) {
      return [];
    }
  }

  private detectFieldDataType(tags: string[]): string {
    if (tags.includes('$date')) return 'date';
    if (tags.includes('$timestamp')) return 'timestamp';
    if (tags.includes('$numeric')) return 'numeric';
    if (tags.includes('$integer')) return 'integer';
    if (tags.includes('$text')) return 'text';
    if (tags.includes('$ascii')) return 'text';
    return 'unknown';
  }

  private parseFieldTags(tags: string[]): {
    isNumeric: boolean;
    isInteger: boolean;
    isText: boolean;
    isAscii: boolean;
    isDate: boolean;
    isTimestamp: boolean;
    isKey: boolean;
    isHidden: boolean;
    isSystem: boolean;
    isSynthetic: boolean;
  } {
    return {
      isNumeric: tags.includes('$numeric'),
      isInteger: tags.includes('$integer'),
      isText: tags.includes('$text'),
      isAscii: tags.includes('$ascii'),
      isDate: tags.includes('$date'),
      isTimestamp: tags.includes('$timestamp'),
      isKey: tags.includes('$key'),
      isHidden: tags.includes('$hidden'),
      isSystem: tags.includes('$system'),
      isSynthetic: tags.includes('$synthetic')
    };
  }
}
