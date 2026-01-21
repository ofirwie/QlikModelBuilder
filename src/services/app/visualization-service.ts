/**
 * Visualization Service - Creates and manages sheets and visualizations
 *
 * Handles:
 * - Create sheets in apps
 * - Create visualizations (charts, tables, KPIs) in sheets
 * - Manage AI Analytics Cache sheet with pre-built hypercubes
 */

import { SessionService } from './session-service.js';
import { logger } from '../../utils/logger.js';
import { getActiveTenant, getTenant } from '../../config/tenants.js';

const log = logger.child({ service: 'Visualization' });

// ===== APP IDs PER TENANT =====
export const TENANT_APP_IDS: Record<string, string> = {
  'qmb-main': 'e2f1700e-98dc-4ac9-b483-ca4a0de183ce',
  'qmb-main': 'a30ab30d-cf2a-41fa-86ef-cf4f189deecf'
};

// AI Analytics Cache configuration
export const AI_CACHE_SHEET_ID = 'AI_Analytics_Cache';
export const AI_CACHE_OBJECTS = {
  // Based on ITSM Performance Dashboard sheet efaf0403-2c5b-4de2-a095-4211f8ba11d6
  MONTHLY_MTTR: 'AI_Monthly_MTTR',           // Tickets Closed & MTTR per month (combochart)
  CATEGORY_MTTR: 'AI_Category_MTTR',         // Tickets Closed & MTTR per Category
  ADMIN_GROUP_MTTR: 'AI_AdminGroup_MTTR',    // Tickets Closed & MTTR per Admin Group
  SLA_INDICATOR: 'AI_SLA_Indicator',         // SLA Overview
  STATUS_OVERVIEW: 'AI_Status_Overview'      // Open/Closed by status_class
};

// ===== EXISTING OBJECTS IN APP =====
// These are pre-built hypercubes that already exist in QMB BI Analytics app
// Use these FIRST before creating new ones - they have all the KPIs ready!
export const EXISTING_APP_OBJECTS = {
  // Sheet: Incidents vs. Requests (3a4166af-ad69-4273-a36f-ed9e86e273ce)
  INCIDENTS_VS_REQUESTS: {
    objectId: 'ccpcAnY',
    sheetId: '3a4166af-ad69-4273-a36f-ed9e86e273ce',
    title: 'Incidents vs. Requests',
    type: 'combochart',
    dimensions: ['Closed_MonthYear'],
    measures: ['Incidents', 'Requests'],
    keywords: ['מגמה', 'trend', 'חודשי', 'monthly', 'incidents', 'requests', 'תקלות', 'בקשות']
  },

  // Sheet: ITSM Performance Dashboard (4) (25e53365-de28-4f38-8649-c24516fe3996)
  MTTR_PER_CATEGORY: {
    objectId: '5726e819-0f10-4f68-9607-5686ab4cac4c',
    sheetId: '25e53365-de28-4f38-8649-c24516fe3996',
    title: 'Tickets Closed & MTTR per Category',
    type: 'table',
    dimensions: ['Category'],
    measures: ['Totals', 'MTTR', '% MTTR', 'Answers', 'Satisfaction', '% Satisfaction'],
    keywords: ['קטגוריה', 'category', 'mttr', 'זמן טיפול', 'שביעות רצון', 'satisfaction']
  },

  MTTR_PER_ADMIN_GROUP: {
    objectId: '31c414b3-ce40-439a-9146-f0569a91625f',
    sheetId: '25e53365-de28-4f38-8649-c24516fe3996',
    title: 'Tickets Closed & MTTR per Admin Group',
    type: 'table',
    dimensions: ['Admin Groups'],
    measures: ['Totals', 'MTTR', '% MTTR', 'Answers', 'Satisfaction', '% Satisfaction'],
    keywords: ['צוות', 'team', 'admin group', 'קבוצה', 'mttr', 'זמן טיפול']
  },

  // Sheet: ITSM Performance Dashboard (4) - Monthly MTTR Trend
  MONTHLY_MTTR_TREND: {
    objectId: 'de345c0a-8325-4a82-b78d-8ee363aad16a',
    sheetId: '25e53365-de28-4f38-8649-c24516fe3996',
    title: 'Tickets Closed & MTTR per month',
    type: 'combochart',
    dimensions: ['Closed_MonthYear'],
    measures: ['Incidents', 'Requests', 'AVG  MTTR'],
    keywords: ['מגמה', 'trend', 'חודשי', 'monthly', 'mttr', 'זמן טיפול']
  },

  // Sheet: Ticket Sources (32cbf6ac-0c2d-47de-84d8-9eb7dff4bf3e)
  TICKETS_BY_SOURCE: {
    objectId: 'RKcDmP',
    sheetId: '32cbf6ac-0c2d-47de-84d8-9eb7dff4bf3e',
    title: 'Tickets Closed per Source',
    type: 'combochart',
    dimensions: ['EventYearMonth'],
    measures: ['AI Chatbot', 'SSP', 'Email', 'SR Form', 'Other'],
    keywords: ['מקור', 'source', 'ערוץ', 'channel', 'chatbot', 'email', 'ssp']
  },

  // Sheet: SERVICE LEVEL REVIEW - SLA (374d24eb-d2a9-452c-829f-de2802bb189e)
  SLA_BY_ADMIN_GROUP: {
    objectId: 'cmWNKa',
    sheetId: '374d24eb-d2a9-452c-829f-de2802bb189e',
    title: 'SLA By Admin Group',
    type: 'combochart',
    dimensions: ['Admin Group'],
    measures: ['Amount of SRs', 'SLA'],
    keywords: ['sla', 'עמידה', 'צוות', 'team', 'admin group', 'קבוצה', 'חריגה', 'breach']
  },

  SLA_BY_PRIORITY: {
    objectId: 'LbLMjX',
    sheetId: '374d24eb-d2a9-452c-829f-de2802bb189e',
    title: 'SLA By Priority',
    type: 'combochart',
    dimensions: ['priority_color'],
    measures: ['Amount of SRs', 'SLA'],
    keywords: ['sla', 'עדיפות', 'priority', 'דחיפות', 'urgency']
  },

  SLA_BY_ADMINISTRATOR: {
    objectId: 'PGkRdH',
    sheetId: '374d24eb-d2a9-452c-829f-de2802bb189e',
    title: 'SLA By Administrator',
    type: 'combochart',
    dimensions: ['assigned user username'],
    measures: ['Amount of SRs', 'SLA'],
    keywords: ['sla', 'טכנאי', 'technician', 'מטפל', 'administrator', 'assigned']
  },

  // Sheet: SLA Indicator: Resolution Time (6efe8025-1cd5-47f5-854a-894fc13aef6f)
  SLA_RESOLUTION_TIME: {
    objectId: 'VJrEFy',
    sheetId: '6efe8025-1cd5-47f5-854a-894fc13aef6f',
    title: 'Tickets Closed per SLA Indicator (Resolution Time)',
    type: 'combochart',
    dimensions: ['EventYearMonth'],
    measures: ['Within 24 hours', 'Within 1-5 days', '6 days or more'],
    keywords: ['זמן סגירה', 'resolution time', 'sla', '24 שעות', 'days', 'ימים']
  },

  // Sheet: Efficiency Indicator: Assignments (dc5b3b21-cd61-4056-b2f1-b0e69e2e0b33)
  EFFICIENCY_HANDOFFS: {
    objectId: 'fcUJtmP',
    sheetId: 'dc5b3b21-cd61-4056-b2f1-b0e69e2e0b33',
    title: 'Tickets Closed per Efficiency Indicator (Handoffs)',
    type: 'combochart',
    dimensions: ['Closed_MonthYear'],
    measures: ['Zero Assignments', '1 Assignments (No Handoffs)', '2 Assignments (Handed off to one or more others)'],
    keywords: ['יעילות', 'efficiency', 'העברות', 'handoffs', 'assignments', 'מטפלים']
  },

  // Sheet: Backlog analysis (dakSKX)
  BACKLOG_14_DAYS: {
    objectId: 'cxMmyvc',
    sheetId: 'dakSKX',
    title: 'BackLog still open Last 14 Days',
    type: 'barchart',
    dimensions: ['Date'],
    measures: ['#Sr'],
    keywords: ['backlog', 'צבר', 'פתוחות', 'open', '14 days', 'ימים']
  },

  BACKLOG_BY_TYPE: {
    objectId: 'VpQgc',
    sheetId: 'dakSKX',
    title: 'BackLog by Sr_type',
    type: 'linechart',
    dimensions: ['Date', 'sr_type'],
    measures: ['#Sr'],
    keywords: ['backlog', 'צבר', 'סוג', 'type', 'trend', 'מגמה']
  },

  // Sheet: Active Service Records (SRs) (wkHLNjj)
  BREACHES_BY_TYPE: {
    objectId: 'zXfnHk',
    sheetId: 'wkHLNjj',
    title: 'Breaches from Requests and Incidents',
    type: 'barchart',
    dimensions: ['SR Type', 'due_date_flag'],
    measures: ['Breached'],
    keywords: ['חריגות', 'breaches', 'due date', 'תאריך יעד', 'sla', 'פתוחות']
  },

  // Sheet: AI Agents (DWzkaTs)
  AI_AGENTS_TABLE: {
    objectId: 'rQwCm',
    sheetId: 'DWzkaTs',
    title: 'Top Used AI Agents',
    type: 'table',
    dimensions: ['Agent_Name'],
    measures: ['Total Executions', 'Unique Users'],
    keywords: ['ai', 'agents', 'סוכנים', 'chatbot', 'בינה מלאכותית', 'usage']
  },

  AI_AGENTS_EXECUTIONS_KPI: {
    objectId: 'KYrC',
    sheetId: 'DWzkaTs',
    title: 'Total AI Agents Executions',
    type: 'kpi',
    dimensions: [],
    measures: ['Total AI Agents Executions'],
    keywords: ['ai', 'agents', 'סוכנים', 'executions', 'הפעלות', 'total']
  },

  // Sheet: QMB Copilot Usage Dashboard (JfdRFGV)
  COPILOT_TREND: {
    objectId: 'ZEmyMJ',
    sheetId: 'JfdRFGV',
    title: 'Copilot Usage Trend',
    type: 'combochart',
    dimensions: ['EventYearMonth'],
    measures: ['Usage Count'],
    keywords: ['copilot', 'ai', 'usage', 'שימוש', 'trend', 'מגמה']
  }
};

// ===== SEMANTIC QUERY TO OBJECT MAPPING =====
// Maps intent entities (entity + measure + dimension) to pre-built objects
// Used by intent-engine to automatically select best data source
export interface QueryToObjectMapping {
  patterns: {
    entity?: string[];           // incident, request, etc.
    measure?: string[];          // mttr, total_volume, satisfaction
    dimension?: string[];        // category, admin_group, month
    keywords?: string[];         // Hebrew/English keywords
  };
  objectKey: keyof typeof EXISTING_APP_OBJECTS;
  priority: number;              // Higher = prefer this match
  description: string;           // For debugging/logging
}

export const QUERY_TO_OBJECT_MAPPINGS: QueryToObjectMapping[] = [
  // MTTR לפי קטגוריה / MTTR by category
  {
    patterns: {
      measure: ['mttr', 'avg_resolution_time', 'resolution_time'],
      dimension: ['category', 'Category', 'קטגוריה']
    },
    objectKey: 'MTTR_PER_CATEGORY',
    priority: 10,
    description: 'MTTR breakdown by category with satisfaction metrics'
  },
  // MTTR לפי צוות / MTTR by team/group
  {
    patterns: {
      measure: ['mttr', 'avg_resolution_time', 'resolution_time'],
      dimension: ['admin_group', 'assigned_group', 'team', 'צוות', 'קבוצה']
    },
    objectKey: 'MTTR_PER_ADMIN_GROUP',
    priority: 10,
    description: 'MTTR breakdown by admin group with satisfaction metrics'
  },
  // ביצועים לפי קטגוריה / Performance by category
  {
    patterns: {
      keywords: ['ביצועים', 'performance', 'נתח', 'analyze', 'mttr'],
      dimension: ['category', 'Category', 'קטגוריה']
    },
    objectKey: 'MTTR_PER_CATEGORY',
    priority: 8,
    description: 'Performance analysis by category'
  },
  // ביצועים לפי צוות / Performance by team
  {
    patterns: {
      keywords: ['ביצועים', 'performance', 'נתח', 'analyze', 'mttr'],
      dimension: ['admin_group', 'assigned_group', 'team', 'צוות', 'קבוצה']
    },
    objectKey: 'MTTR_PER_ADMIN_GROUP',
    priority: 8,
    description: 'Performance analysis by team'
  },
  // שביעות רצון לפי קטגוריה / Satisfaction by category
  {
    patterns: {
      entity: ['satisfaction'],
      dimension: ['category', 'Category', 'קטגוריה']
    },
    objectKey: 'MTTR_PER_CATEGORY',
    priority: 9,
    description: 'Satisfaction scores by category'
  },
  // שביעות רצון לפי צוות / Satisfaction by team
  {
    patterns: {
      entity: ['satisfaction'],
      dimension: ['admin_group', 'assigned_group', 'team', 'צוות', 'קבוצה']
    },
    objectKey: 'MTTR_PER_ADMIN_GROUP',
    priority: 9,
    description: 'Satisfaction scores by team'
  },
  // תקלות לפי חודש / Incidents by month - trend
  {
    patterns: {
      entity: ['incident', 'request'],
      dimension: ['month', 'חודש', 'Closed_MonthYear', 'trend', 'מגמה']
    },
    objectKey: 'INCIDENTS_VS_REQUESTS',
    priority: 7,
    description: 'Monthly incident vs request trend'
  },
  // מגמה / Trend analysis
  {
    patterns: {
      keywords: ['מגמה', 'trend', 'חודשי', 'monthly', 'לאורך זמן', 'over time']
    },
    objectKey: 'INCIDENTS_VS_REQUESTS',
    priority: 6,
    description: 'Monthly trend analysis'
  },
  // Monthly MTTR trend
  {
    patterns: {
      measure: ['mttr', 'avg_resolution_time'],
      dimension: ['month', 'חודש', 'Closed_MonthYear', 'trend']
    },
    objectKey: 'MONTHLY_MTTR_TREND',
    priority: 9,
    description: 'Monthly MTTR trend with incidents and requests'
  },
  // Tickets by source/channel
  {
    patterns: {
      dimension: ['source', 'מקור', 'channel', 'ערוץ'],
      keywords: ['chatbot', 'email', 'ssp', 'מקור', 'ערוץ']
    },
    objectKey: 'TICKETS_BY_SOURCE',
    priority: 8,
    description: 'Tickets breakdown by source channel'
  },
  // SLA by admin group
  {
    patterns: {
      entity: ['sla'],
      dimension: ['admin_group', 'assigned_group', 'team', 'צוות', 'קבוצה']
    },
    objectKey: 'SLA_BY_ADMIN_GROUP',
    priority: 9,
    description: 'SLA compliance by admin group'
  },
  // SLA breach/compliance
  {
    patterns: {
      keywords: ['sla', 'חריגה', 'breach', 'עמידה', 'compliance']
    },
    objectKey: 'SLA_BY_ADMIN_GROUP',
    priority: 7,
    description: 'SLA breach analysis'
  },
  // SLA by priority
  {
    patterns: {
      entity: ['sla'],
      dimension: ['priority', 'עדיפות', 'urgency', 'דחיפות']
    },
    objectKey: 'SLA_BY_PRIORITY',
    priority: 9,
    description: 'SLA compliance by priority level'
  },
  // SLA by technician/administrator
  {
    patterns: {
      entity: ['sla'],
      dimension: ['technician', 'טכנאי', 'administrator', 'מטפל', 'assigned']
    },
    objectKey: 'SLA_BY_ADMINISTRATOR',
    priority: 9,
    description: 'SLA compliance by technician'
  },
  // Resolution time / SLA time indicator
  {
    patterns: {
      keywords: ['זמן סגירה', 'resolution time', '24 שעות', 'days', 'ימים', 'how long']
    },
    objectKey: 'SLA_RESOLUTION_TIME',
    priority: 8,
    description: 'Tickets by resolution time bands'
  },
  // Efficiency / Handoffs
  {
    patterns: {
      keywords: ['יעילות', 'efficiency', 'העברות', 'handoffs', 'assignments', 'מטפלים']
    },
    objectKey: 'EFFICIENCY_HANDOFFS',
    priority: 8,
    description: 'Efficiency analysis by handoff count'
  },
  // Backlog analysis
  {
    patterns: {
      keywords: ['backlog', 'צבר', 'פתוחות', 'open tickets', 'pending']
    },
    objectKey: 'BACKLOG_14_DAYS',
    priority: 8,
    description: 'Backlog open tickets last 14 days'
  },
  // Backlog by type
  {
    patterns: {
      keywords: ['backlog', 'צבר'],
      dimension: ['type', 'סוג', 'sr_type']
    },
    objectKey: 'BACKLOG_BY_TYPE',
    priority: 9,
    description: 'Backlog breakdown by SR type'
  },
  // Breaches
  {
    patterns: {
      keywords: ['breaches', 'חריגות', 'due date', 'תאריך יעד', 'overdue']
    },
    objectKey: 'BREACHES_BY_TYPE',
    priority: 8,
    description: 'SLA breaches by type'
  },
  // AI Agents
  {
    patterns: {
      keywords: ['ai', 'agents', 'סוכנים', 'chatbot', 'בינה מלאכותית']
    },
    objectKey: 'AI_AGENTS_TABLE',
    priority: 8,
    description: 'AI Agents usage and performance'
  },
  // Copilot usage
  {
    patterns: {
      keywords: ['copilot', 'ai assistant', 'usage', 'שימוש']
    },
    objectKey: 'COPILOT_TREND',
    priority: 8,
    description: 'QMB Copilot usage trend'
  }
];

/**
 * Find the best matching pre-built object for a query intent
 * Returns null if no good match found (should use dynamic hypercube instead)
 */
export function findMatchingObject(
  entity?: string,
  measure?: string,
  dimension?: string,
  keywords?: string[]
): { objectKey: keyof typeof EXISTING_APP_OBJECTS; mapping: QueryToObjectMapping } | null {
  let bestMatch: { objectKey: keyof typeof EXISTING_APP_OBJECTS; mapping: QueryToObjectMapping; score: number } | null = null;

  for (const mapping of QUERY_TO_OBJECT_MAPPINGS) {
    let score = 0;
    let matchCount = 0;
    const requiredMatches = Object.keys(mapping.patterns).filter(k =>
      mapping.patterns[k as keyof typeof mapping.patterns]?.length
    ).length;

    // Check entity match
    if (mapping.patterns.entity && entity) {
      if (mapping.patterns.entity.some(e => e.toLowerCase() === entity.toLowerCase())) {
        score += 3;
        matchCount++;
      }
    }

    // Check measure match
    if (mapping.patterns.measure && measure) {
      if (mapping.patterns.measure.some(m => m.toLowerCase() === measure.toLowerCase())) {
        score += 4;
        matchCount++;
      }
    }

    // Check dimension match
    if (mapping.patterns.dimension && dimension) {
      if (mapping.patterns.dimension.some(d => d.toLowerCase() === dimension.toLowerCase())) {
        score += 4;
        matchCount++;
      }
    }

    // Check keyword match
    if (mapping.patterns.keywords && keywords && keywords.length > 0) {
      for (const keyword of keywords) {
        if (mapping.patterns.keywords.some(k => k.toLowerCase() === keyword.toLowerCase())) {
          score += 2;
          matchCount++;
          break;
        }
      }
    }

    // Add priority bonus
    score += mapping.priority;

    // Only consider if we matched at least one required pattern
    if (matchCount > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = {
        objectKey: mapping.objectKey,
        mapping,
        score
      };
    }
  }

  // Minimum score threshold
  if (bestMatch && bestMatch.score >= 8) {
    return {
      objectKey: bestMatch.objectKey,
      mapping: bestMatch.mapping
    };
  }

  return null;
}

export interface CreateSheetOptions {
  id?: string;
  title: string;
  description?: string;
}

export interface CreateVisualizationOptions {
  id?: string;
  sheetId: string;
  type: 'barchart' | 'linechart' | 'piechart' | 'table' | 'kpi' | 'pivot-table' | 'combochart';
  title: string;
  dimensions: string[];
  measures: Array<{ expression: string; label?: string }>;
  position?: { x: number; y: number; width: number; height: number };
}

export interface CacheObjectDefinition {
  id: string;
  title: string;
  dimensions: string[];
  measures: Array<{ expression: string; label: string }>;
}

export class VisualizationService {
  private sessionService: SessionService;

  constructor(sessionService: SessionService) {
    this.sessionService = sessionService;
  }

  /**
   * Create a new sheet in an app
   */
  async createSheet(appId: string, options: CreateSheetOptions): Promise<{ success: boolean; sheetId: string; message: string }> {
    log.debug(`[VisualizationService] Creating sheet "${options.title}" in app ${appId}`);

    try {
      const appSession = await this.sessionService.getOrCreateSession(appId);
      const doc = appSession.doc;

      const sheetId = options.id || `sheet_${Date.now()}`;

      const sheetDef = {
        qInfo: {
          qId: sheetId,
          qType: 'sheet'
        },
        qMetaDef: {
          title: options.title,
          description: options.description || ''
        },
        qChildListDef: {
          qData: {
            title: '/qMetaDef/title',
            visualization: '/visualization',
            rank: '/rank'
          }
        },
        rank: -1,
        thumbnail: { qStaticContentUrlDef: {} },
        columns: 24,
        rows: 12,
        cells: [],
        title: options.title,
        description: options.description || ''
      };

      const sheet = await doc.createObject(sheetDef);
      await doc.doSave();

      log.debug(`[VisualizationService] Sheet created: ${sheetId}`);

      return {
        success: true,
        sheetId: sheet.id || sheetId,
        message: `Sheet "${options.title}" created successfully`
      };
    } catch (error) {
      log.error(`[VisualizationService] Error creating sheet:`, error);
      return {
        success: false,
        sheetId: '',
        message: `Failed to create sheet: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Create a visualization (chart) in a sheet
   */
  async createVisualization(appId: string, options: CreateVisualizationOptions): Promise<{ success: boolean; objectId: string; message: string }> {
    log.debug(`[VisualizationService] Creating ${options.type} "${options.title}" in sheet ${options.sheetId}`);

    try {
      const appSession = await this.sessionService.getOrCreateSession(appId);
      const doc = appSession.doc;

      const objectId = options.id || `obj_${Date.now()}`;

      // Build hypercube definition
      const qHyperCubeDef: any = {
        qDimensions: options.dimensions.map(dim => ({
          qDef: {
            qFieldDefs: [dim],
            qFieldLabels: [dim]
          }
        })),
        qMeasures: options.measures.map(m => ({
          qDef: {
            qDef: m.expression,
            qLabel: m.label || m.expression
          }
        })),
        qInitialDataFetch: [{
          qTop: 0,
          qLeft: 0,
          qWidth: options.dimensions.length + options.measures.length,
          qHeight: 500
        }],
        qSuppressMissing: true,
        qSuppressZero: false
      };

      // Create the visualization object
      const vizDef: any = {
        qInfo: {
          qId: objectId,
          qType: options.type
        },
        qMetaDef: {
          title: options.title
        },
        qHyperCubeDef,
        title: options.title,
        visualization: options.type,
        showTitles: true
      };

      const vizObject = await doc.createObject(vizDef);

      // Now add it to the sheet as a child
      const sheet = await doc.getObject(options.sheetId);

      // Get current sheet layout to find position
      const sheetLayout = await sheet.getLayout();
      const cells = (sheetLayout as any).cells || [];

      // Calculate position (default: next available slot)
      const pos = options.position || {
        x: 0,
        y: cells.length * 3,
        width: 12,
        height: 6
      };

      // Add cell reference to sheet
      const newCells = [...cells, {
        name: objectId,
        type: options.type,
        col: pos.x,
        row: pos.y,
        colspan: pos.width,
        rowspan: pos.height
      }];

      await sheet.setProperties({
        ...sheetLayout,
        cells: newCells
      });

      await doc.doSave();

      log.debug(`[VisualizationService] Visualization created: ${objectId}`);

      return {
        success: true,
        objectId: vizObject.id || objectId,
        message: `${options.type} "${options.title}" created successfully`
      };
    } catch (error) {
      log.error(`[VisualizationService] Error creating visualization:`, error);
      return {
        success: false,
        objectId: '',
        message: `Failed to create visualization: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Check if AI Analytics Cache sheet exists
   */
  async checkCacheSheetExists(appId: string): Promise<boolean> {
    try {
      const appSession = await this.sessionService.getOrCreateSession(appId);
      const doc = appSession.doc;

      try {
        await doc.getObject(AI_CACHE_SHEET_ID);
        return true;
      } catch {
        return false;
      }
    } catch (error) {
      log.debug(`[VisualizationService] Error checking cache sheet:`, error);
      return false;
    }
  }

  /**
   * Get cached object IDs if they exist
   */
  async getCacheObjectIds(appId: string): Promise<{ exists: boolean; objects: Record<string, string> }> {
    try {
      const appSession = await this.sessionService.getOrCreateSession(appId);
      const doc = appSession.doc;

      const existingObjects: Record<string, string> = {};

      for (const [key, objectId] of Object.entries(AI_CACHE_OBJECTS)) {
        try {
          await doc.getObject(objectId);
          existingObjects[key] = objectId;
        } catch {
          // Object doesn't exist
        }
      }

      return {
        exists: Object.keys(existingObjects).length > 0,
        objects: existingObjects
      };
    } catch (error) {
      log.debug(`[VisualizationService] Error getting cache objects:`, error);
      return { exists: false, objects: {} };
    }
  }

  /**
   * Create the AI Analytics Cache sheet with all pre-built objects
   */
  async createAICacheSheet(appId: string): Promise<{ success: boolean; sheetId: string; objects: string[]; message: string }> {
    log.debug(`[VisualizationService] Creating AI Analytics Cache sheet in app ${appId}`);

    try {
      // First check if it already exists
      const exists = await this.checkCacheSheetExists(appId);
      if (exists) {
        return {
          success: true,
          sheetId: AI_CACHE_SHEET_ID,
          objects: Object.values(AI_CACHE_OBJECTS),
          message: 'AI Analytics Cache sheet already exists'
        };
      }

      // Create the sheet
      const sheetResult = await this.createSheet(appId, {
        id: AI_CACHE_SHEET_ID,
        title: 'AI Analytics Cache',
        description: 'Pre-built hypercubes for AI analytics queries. Do not modify.'
      });

      if (!sheetResult.success) {
        return {
          success: false,
          sheetId: '',
          objects: [],
          message: sheetResult.message
        };
      }

      // Define the cache objects - based on ITSM Performance Dashboard
      // Key insight: When counting tickets, just use Count(distinct sr_id) - no status filter needed
      const cacheDefinitions: CacheObjectDefinition[] = [
        {
          // Monthly trend: Tickets Closed & MTTR per month (like combochart JJrLrfh)
          id: AI_CACHE_OBJECTS.MONTHLY_MTTR,
          title: 'Monthly Closed & MTTR',
          dimensions: ['Closed_MonthYear'],
          measures: [
            { expression: 'Count({<sr_type_index={1}>}distinct sr_id)', label: 'Incidents' },
            { expression: 'Count({<sr_type_index={10}>}distinct sr_id)', label: 'Requests' },
            { expression: 'Avg(SR_AGE_NUM/3600/24)', label: 'AVG MTTR' }
          ]
        },
        {
          // Category breakdown: MTTR per Category (like table f8d273ea)
          id: AI_CACHE_OBJECTS.CATEGORY_MTTR,
          title: 'Category MTTR',
          dimensions: ['Category'],
          measures: [
            { expression: 'Count(distinct sr_id)', label: 'Totals' },
            { expression: 'Avg(SR_AGE_NUM/3600/24)', label: 'MTTR' },
            { expression: 'Count({<satisfaction_survey_answer={">0"}>}distinct sr_id)', label: 'Answers' },
            { expression: 'Avg({<satisfaction_survey_answer={">0"}>}satisfaction_survey_answer)', label: 'Satisfaction' }
          ]
        },
        {
          // Admin Group breakdown: MTTR per Admin Group (like table b441bbe4)
          id: AI_CACHE_OBJECTS.ADMIN_GROUP_MTTR,
          title: 'Admin Group MTTR',
          dimensions: ['assigned_group'],
          measures: [
            { expression: 'Count(distinct sr_id)', label: 'Totals' },
            { expression: 'Avg(SR_AGE_NUM/3600/24)', label: 'MTTR' },
            { expression: 'Count({<satisfaction_survey_answer={">0"}>}distinct sr_id)', label: 'Answers' },
            { expression: 'Avg({<satisfaction_survey_answer={">0"}>}satisfaction_survey_answer)', label: 'Satisfaction' }
          ]
        },
        {
          // SLA Indicator: Breached vs Within Target
          id: AI_CACHE_OBJECTS.SLA_INDICATOR,
          title: 'SLA Indicator',
          dimensions: ['due_date_flag_new'],
          measures: [
            { expression: 'Count({<status_class={"Open"}>}distinct sr_id)', label: 'Open Count' }
          ]
        },
        {
          // Status Overview: Open vs Closed
          id: AI_CACHE_OBJECTS.STATUS_OVERVIEW,
          title: 'Status Overview',
          dimensions: ['status_class', 'sr_type'],
          measures: [
            { expression: 'Count(distinct sr_id)', label: 'Count' }
          ]
        }
      ];

      const createdObjects: string[] = [];

      // Create each visualization
      for (let i = 0; i < cacheDefinitions.length; i++) {
        const def = cacheDefinitions[i];
        const result = await this.createVisualization(appId, {
          id: def.id,
          sheetId: AI_CACHE_SHEET_ID,
          type: 'table',
          title: def.title,
          dimensions: def.dimensions,
          measures: def.measures,
          position: {
            x: (i % 2) * 12,
            y: Math.floor(i / 2) * 6,
            width: 12,
            height: 6
          }
        });

        if (result.success) {
          createdObjects.push(result.objectId);
        } else {
          log.warn(`[VisualizationService] Failed to create ${def.id}: ${result.message}`);
        }
      }

      return {
        success: true,
        sheetId: AI_CACHE_SHEET_ID,
        objects: createdObjects,
        message: `AI Analytics Cache sheet created with ${createdObjects.length} objects`
      };
    } catch (error) {
      log.error(`[VisualizationService] Error creating AI cache sheet:`, error);
      return {
        success: false,
        sheetId: '',
        objects: [],
        message: `Failed to create AI cache sheet: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Get data from a cached object (optimized - uses existing objects)
   */
  async getDataFromCache(appId: string, cacheKey: keyof typeof AI_CACHE_OBJECTS): Promise<{ success: boolean; data: any; fromCache: boolean }> {
    try {
      const objectId = AI_CACHE_OBJECTS[cacheKey];
      const appSession = await this.sessionService.getOrCreateSession(appId);
      const doc = appSession.doc;

      try {
        const obj = await doc.getObject(objectId);
        const layout = await obj.getLayout();
        const qHyperCube = (layout as any).qHyperCube;

        if (qHyperCube?.qDataPages?.[0]?.qMatrix) {
          const dimensions = qHyperCube.qDimensionInfo?.map((d: any) => d.qFallbackTitle) || [];
          const measures = qHyperCube.qMeasureInfo?.map((m: any) => m.qFallbackTitle) || [];

          const rows = qHyperCube.qDataPages[0].qMatrix.map((row: any) => {
            const rowData: any = {};
            dimensions.forEach((dim: string, i: number) => {
              rowData[dim] = row[i]?.qText || row[i]?.qNum;
            });
            measures.forEach((measure: string, i: number) => {
              rowData[measure] = row[dimensions.length + i]?.qNum ?? row[dimensions.length + i]?.qText;
            });
            return rowData;
          });

          return {
            success: true,
            data: {
              totalRows: qHyperCube.qSize?.qcy || rows.length,
              columns: [...dimensions, ...measures],
              rows
            },
            fromCache: true
          };
        }

        return { success: false, data: null, fromCache: false };
      } catch {
        // Object doesn't exist, need to create cache
        return { success: false, data: null, fromCache: false };
      }
    } catch (error) {
      log.debug(`[VisualizationService] Error getting cached data:`, error);
      return { success: false, data: null, fromCache: false };
    }
  }
}

// ===== SMART LINKS GENERATION =====

/**
 * Link types for Qlik Cloud
 */
export type QlikLinkType = 'sheet' | 'object' | 'app' | 'insight';

/**
 * Smart link result
 */
export interface QlikSmartLink {
  url: string;
  title: string;
  titleHe: string;
  type: QlikLinkType;
  objectKey?: keyof typeof EXISTING_APP_OBJECTS;
}

/**
 * Generate a direct link to a Qlik sheet or object
 */
export function generateQlikLink(
  objectKey: keyof typeof EXISTING_APP_OBJECTS,
  tenantId?: string
): QlikSmartLink | null {
  const obj = EXISTING_APP_OBJECTS[objectKey];
  if (!obj) {
    log.warn(`[SmartLinks] Unknown object key: ${objectKey}`);
    return null;
  }

  const tenant = tenantId ? getTenant(tenantId) : getActiveTenant();
  if (!tenant) {
    log.warn(`[SmartLinks] Unknown tenant: ${tenantId}`);
    return null;
  }

  const appId = TENANT_APP_IDS[tenant.id];
  if (!appId) {
    log.warn(`[SmartLinks] No app ID for tenant: ${tenant.id}`);
    return null;
  }

  // Qlik Cloud URL format: https://{tenant}/sense/app/{appId}/sheet/{sheetId}/state/analysis
  // With object focus: https://{tenant}/sense/app/{appId}/sheet/{sheetId}/state/analysis/select/clearall
  const baseUrl = tenant.url;
  const sheetUrl = `${baseUrl}/sense/app/${appId}/sheet/${obj.sheetId}/state/analysis`;

  return {
    url: sheetUrl,
    title: obj.title,
    titleHe: getHebrewTitle(objectKey),
    type: 'sheet',
    objectKey
  };
}

/**
 * Get Hebrew title for object key
 */
function getHebrewTitle(objectKey: keyof typeof EXISTING_APP_OBJECTS): string {
  const hebrewTitles: Record<keyof typeof EXISTING_APP_OBJECTS, string> = {
    INCIDENTS_VS_REQUESTS: 'תקלות מול בקשות',
    MTTR_PER_CATEGORY: 'זמן טיפול לפי קטגוריה',
    MTTR_PER_ADMIN_GROUP: 'זמן טיפול לפי צוות',
    MONTHLY_MTTR_TREND: 'מגמת זמן טיפול חודשית',
    TICKETS_BY_SOURCE: 'קריאות לפי מקור',
    SLA_BY_ADMIN_GROUP: 'עמידה ב-SLA לפי צוות',
    SLA_BY_PRIORITY: 'עמידה ב-SLA לפי עדיפות',
    SLA_BY_ADMINISTRATOR: 'עמידה ב-SLA לפי טכנאי',
    SLA_RESOLUTION_TIME: 'זמני סגירה',
    EFFICIENCY_HANDOFFS: 'יעילות - העברות בין מטפלים',
    BACKLOG_14_DAYS: 'צבר 14 יום אחרונים',
    BACKLOG_BY_TYPE: 'צבר לפי סוג',
    BREACHES_BY_TYPE: 'חריגות לפי סוג',
    AI_AGENTS_TABLE: 'סוכני AI',
    AI_AGENTS_EXECUTIONS_KPI: 'הפעלות סוכני AI',
    COPILOT_TREND: 'שימוש ב-Copilot'
  };
  return hebrewTitles[objectKey] || objectKey;
}

/**
 * Generate links for drill-down options based on current object
 */
export function getDrillDownLinks(
  currentObjectKey: keyof typeof EXISTING_APP_OBJECTS,
  tenantId?: string
): QlikSmartLink[] {
  const links: QlikSmartLink[] = [];

  // Define drill-down relationships
  const drillDownMap: Partial<Record<keyof typeof EXISTING_APP_OBJECTS, Array<keyof typeof EXISTING_APP_OBJECTS>>> = {
    INCIDENTS_VS_REQUESTS: ['MTTR_PER_CATEGORY', 'MTTR_PER_ADMIN_GROUP', 'SLA_BY_ADMIN_GROUP'],
    MTTR_PER_CATEGORY: ['MTTR_PER_ADMIN_GROUP', 'SLA_BY_ADMIN_GROUP', 'EFFICIENCY_HANDOFFS'],
    MTTR_PER_ADMIN_GROUP: ['MTTR_PER_CATEGORY', 'SLA_BY_ADMIN_GROUP', 'SLA_BY_ADMINISTRATOR'],
    MONTHLY_MTTR_TREND: ['MTTR_PER_CATEGORY', 'MTTR_PER_ADMIN_GROUP', 'BACKLOG_14_DAYS'],
    TICKETS_BY_SOURCE: ['MTTR_PER_CATEGORY', 'INCIDENTS_VS_REQUESTS'],
    SLA_BY_ADMIN_GROUP: ['SLA_BY_ADMINISTRATOR', 'SLA_BY_PRIORITY', 'SLA_RESOLUTION_TIME'],
    SLA_BY_PRIORITY: ['SLA_BY_ADMIN_GROUP', 'SLA_BY_ADMINISTRATOR', 'BREACHES_BY_TYPE'],
    SLA_BY_ADMINISTRATOR: ['SLA_BY_ADMIN_GROUP', 'SLA_BY_PRIORITY', 'MTTR_PER_ADMIN_GROUP'],
    SLA_RESOLUTION_TIME: ['SLA_BY_ADMIN_GROUP', 'EFFICIENCY_HANDOFFS'],
    EFFICIENCY_HANDOFFS: ['MTTR_PER_CATEGORY', 'MTTR_PER_ADMIN_GROUP'],
    BACKLOG_14_DAYS: ['BACKLOG_BY_TYPE', 'BREACHES_BY_TYPE'],
    BACKLOG_BY_TYPE: ['BACKLOG_14_DAYS', 'INCIDENTS_VS_REQUESTS'],
    BREACHES_BY_TYPE: ['SLA_BY_ADMIN_GROUP', 'SLA_BY_PRIORITY'],
    AI_AGENTS_TABLE: ['COPILOT_TREND'],
    AI_AGENTS_EXECUTIONS_KPI: ['AI_AGENTS_TABLE', 'COPILOT_TREND'],
    COPILOT_TREND: ['AI_AGENTS_TABLE']
  };

  const relatedObjects = drillDownMap[currentObjectKey] || [];

  for (const objKey of relatedObjects) {
    const link = generateQlikLink(objKey, tenantId);
    if (link) {
      links.push(link);
    }
  }

  return links;
}

/**
 * Generate all available visualization links for the current tenant
 */
export function getAllVisualizationLinks(tenantId?: string): QlikSmartLink[] {
  const links: QlikSmartLink[] = [];

  for (const objectKey of Object.keys(EXISTING_APP_OBJECTS) as Array<keyof typeof EXISTING_APP_OBJECTS>) {
    const link = generateQlikLink(objectKey, tenantId);
    if (link) {
      links.push(link);
    }
  }

  return links;
}

/**
 * Format links for display in response
 */
export function formatLinksForResponse(links: QlikSmartLink[], language: 'he' | 'en' = 'he'): string {
  if (links.length === 0) return '';

  const header = language === 'he' ? '🔗 לינקים לניתוח נוסף:' : '🔗 Links for further analysis:';
  const formattedLinks = links.map(link => {
    const title = language === 'he' ? link.titleHe : link.title;
    return `- [${title}](${link.url})`;
  }).join('\n');

  return `\n\n${header}\n${formattedLinks}`;
}
