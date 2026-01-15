/**
 * Selection Service - Manages field selections in Qlik apps
 *
 * Handles:
 * - Apply selections (values, search, range)
 * - Clear selections
 * - Get current selections
 * - Get available fields
 * - Get field values
 */

import { SessionService } from './session-service.js';
import { AppSession, SelectionRequest, FieldInfo } from './app-types.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ service: 'Selection' });

export class SelectionService {
  private sessionService: SessionService;

  constructor(sessionService: SessionService) {
    this.sessionService = sessionService;
  }

  /**
   * Apply selections to an app
   * Uses executeWithRetry for automatic reconnection on socket errors
   */
  async applySelections(
    appId: string,
    selections: SelectionRequest[],
    clearPrevious: boolean = true
  ): Promise<any> {
    log.debug(`🎯 Applying ${selections.length} selections to app ${appId}`);

    return this.sessionService.executeWithRetry(appId, async (doc, appSession) => {
      const results = [];

      // Clear previous selections if requested
      if (clearPrevious) {
        await doc.clearAll();
        appSession.currentSelections.clear();
        log.debug('🧹 Cleared all previous selections');
      }

      // Apply each selection
      for (const selection of selections) {
        try {
          const field = await doc.getField(selection.field);
          let success = false;
          let method = 'unknown';

          if (selection.searchString) {
            success = await field.selectAll(selection.searchString);
            method = 'search';
            log.debug(`🔍 Search selection on ${selection.field}: "${selection.searchString}"`);

          } else if (selection.rangeSelection) {
            const range = {
              qRangeInfo: [{
                qRangeLo: selection.rangeSelection.min,
                qRangeHi: selection.rangeSelection.max,
                qMeasure: ''
              }]
            };
            success = await field.selectValues(range);
            method = 'range';
            log.debug(`📊 Range selection on ${selection.field}: ${selection.rangeSelection.min} to ${selection.rangeSelection.max}`);

          } else if (selection.values) {
            const qValues = selection.values.map((value: any) => {
              if (typeof value === 'number') {
                return { qNumber: value, qIsNumeric: true };
              } else {
                return { qText: String(value) };
              }
            });

            success = await field.selectValues(qValues, false, selection.exclude || false);
            method = selection.exclude ? 'exclude' : 'include';
            log.debug(`✅ Value selection on ${selection.field}: ${selection.values.length} values`);
          }

          // Store selection info
          appSession.currentSelections.set(selection.field, {
            ...selection,
            method,
            appliedAt: new Date(),
            success
          });

          results.push({
            field: selection.field,
            method,
            success,
            valuesCount: selection.values?.length
          });

        } catch (fieldError: any) {
          log.debug(`❌ Failed to apply selection on field ${selection.field}:`, fieldError);
          results.push({
            field: selection.field,
            success: false,
            error: fieldError.message || 'Field selection failed'
          });
        }
      }

      return {
        success: true,
        appId,
        sessionId: doc.id,
        results,
        totalSelections: appSession.currentSelections.size
      };
    });
  }

  /**
   * Clear all selections
   * Uses executeWithRetry for automatic reconnection on socket errors
   */
  async clearSelections(appId: string): Promise<any> {
    log.debug(`🧹 Clearing all selections for app ${appId}`);

    return this.sessionService.executeWithRetry(appId, async (doc, appSession) => {
      await doc.clearAll();
      appSession.currentSelections.clear();

      return {
        success: true,
        message: 'All selections cleared'
      };
    });
  }

  /**
   * Get current selections
   * Uses executeWithRetry for automatic reconnection on socket errors
   */
  async getCurrentSelections(appId: string): Promise<any> {
    log.debug(`📋 Getting current selections for app ${appId}`);

    return this.sessionService.executeWithRetry(appId, async (doc, appSession) => {
      const selectionsObj = await doc.createSessionObject({
        qInfo: {
          qType: 'CurrentSelections'
        },
        qSelectionObjectDef: {}
      });

      const layout = await selectionsObj.getLayout();
      const qlikSelections = layout.qSelectionObject?.qSelections || [];

      // Combine with stored selection info
      const enrichedSelections = qlikSelections.map((sel: any) => {
        const storedInfo = appSession.currentSelections.get(sel.qField);
        return {
          field: sel.qField,
          selected: sel.qSelected,
          selectedCount: sel.qSelectedCount,
          total: sel.qTotal,
          isNumeric: sel.qIsNum,
          locked: sel.qLocked,
          ...(storedInfo ? {
            method: storedInfo.method,
            appliedAt: storedInfo.appliedAt,
            originalRequest: storedInfo
          } : {})
        };
      });

      // Cleanup session object
      await doc.destroySessionObject(selectionsObj.id);

      return {
        selections: enrichedSelections,
        totalFields: enrichedSelections.length
      };
    });
  }

  /**
   * Get available fields in the app
   * Uses executeWithRetry for automatic reconnection on socket errors
   */
  async getAvailableFields(appId: string): Promise<any> {
    log.debug(`🔍 Getting available fields for app ${appId}`);

    return this.sessionService.executeWithRetry(appId, async (doc, appSession) => {
      const fieldListObj = await doc.createSessionObject({
        qInfo: {
          qType: 'FieldList'
        },
        qFieldListDef: {
          qShowSystem: false,
          qShowHidden: false,
          qShowSemantic: true,
          qShowSrcTables: true
        }
      });

      const layout = await fieldListObj.getLayout();
      const fields = layout.qFieldList?.qItems || [];

      const fieldDetails = await Promise.all(
        fields.map(async (field: any) => {
          try {
            const fieldObj = await doc.getField(field.qName);
            const fieldInfo = await fieldObj.getCardinal();

            return {
              name: field.qName,
              cardinality: fieldInfo.qCardinal,
              tags: field.qTags || [],
              isNumeric: field.qIsNumeric,
              dataType: this.mapQlikDataType(field.qTags?.[0]),
              sampleValues: await this.getFieldSampleValuesFromDoc(doc, field.qName, 5)
            };
          } catch (error) {
            return {
              name: field.qName,
              error: 'Could not get field details'
            };
          }
        })
      );

      await doc.destroySessionObject(fieldListObj.id);

      return {
        totalFields: fieldDetails.length,
        fields: fieldDetails
      };
    });
  }

  /**
   * Get sample values from a field (legacy - uses AppSession)
   */
  async getFieldSampleValues(
    appSession: AppSession,
    fieldName: string,
    limit: number = 10
  ): Promise<string[]> {
    return this.getFieldSampleValuesFromDoc(appSession.doc, fieldName, limit);
  }

  /**
   * Get sample values from a field using doc directly
   */
  private async getFieldSampleValuesFromDoc(
    doc: any,
    fieldName: string,
    limit: number = 10
  ): Promise<string[]> {
    try {
      const listObj = await doc.createSessionObject({
        qInfo: { qType: 'FieldValues' },
        qListObjectDef: {
          qFieldDefs: [fieldName],
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

      return values.map((row: any) => row[0].qText);
    } catch (error) {
      log.debug(`Could not get sample values for field ${fieldName}:`, error);
      return [];
    }
  }

  /**
   * Get field values with search pattern
   * Uses executeWithRetry for automatic reconnection on socket errors
   */
  async getFieldValues(
    appId: string,
    fieldName: string,
    options: { searchPattern?: string; maxValues?: number } = {}
  ): Promise<{ values: any[]; totalCount: number }> {
    const { searchPattern, maxValues = 100 } = options;

    return this.sessionService.executeWithRetry(appId, async (doc) => {
      const listObj = await doc.createSessionObject({
        qInfo: { qType: 'FieldValuesList' },
        qListObjectDef: {
          qDef: {
            qFieldDefs: [fieldName]
          },
          qInitialDataFetch: [{
            qTop: 0,
            qLeft: 0,
            qHeight: maxValues,
            qWidth: 1
          }]
        }
      });

      // Apply search if provided
      if (searchPattern) {
        await listObj.searchListObjectFor('/qListObjectDef', searchPattern);
      }

      const layout = await listObj.getLayout();
      const dataPage = layout.qListObject?.qDataPages?.[0] || { qMatrix: [] };

      const values = dataPage.qMatrix.map((row: any) => ({
        text: row[0].qText,
        number: row[0].qNum,
        state: row[0].qState === 'S' ? 'selected' :
               row[0].qState === 'O' ? 'optional' :
               row[0].qState === 'X' ? 'excluded' : 'locked',
        frequency: row[0].qFrequency
      }));

      await doc.destroySessionObject(listObj.id);

      return {
        values,
        totalCount: layout.qListObject?.qSize?.qcy || values.length
      };
    });
  }

  /**
   * Map Qlik data type from tag
   */
  private mapQlikDataType(qTag?: string): 'text' | 'numeric' | 'date' | 'timestamp' | 'dual' {
    if (!qTag) return 'text';

    const tag = qTag.toLowerCase();
    if (tag.includes('$numeric') || tag.includes('$integer')) return 'numeric';
    if (tag.includes('$date')) return 'date';
    if (tag.includes('$timestamp')) return 'timestamp';
    if (tag.includes('$text')) return 'text';

    return 'dual';
  }
}
