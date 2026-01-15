/**
 * Semantic Layer Handlers for AI Assistant
 * Version 3.0 - Optimized with split files and AI guidance
 *
 * Files:
 * - semantic-schema.json: Core schema, entities, time periods (always loaded)
 * - semantic-measures.json: Expressions, dimensions (loaded on demand)
 * - semantic-ai-guidance.json: AI behavior rules (always loaded)
 * - semantic-i18n-he.json: Hebrew translations (loaded on demand)
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const log = logger.child({ service: 'SemanticHandlers' });

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths to semantic layer files
const KNOWLEDGE_DIR = path.join(__dirname, '../../docs/knowledge');
const SCHEMA_PATH = path.join(KNOWLEDGE_DIR, 'semantic-schema.json');
const MEASURES_PATH = path.join(KNOWLEDGE_DIR, 'semantic-measures.json');
const GUIDANCE_PATH = path.join(KNOWLEDGE_DIR, 'semantic-ai-guidance.json');
const I18N_HE_PATH = path.join(KNOWLEDGE_DIR, 'semantic-i18n-he.json');

// Legacy path for backward compatibility
const LEGACY_PATH = path.join(KNOWLEDGE_DIR, 'semantic-layer.json');

// ===== TYPE DEFINITIONS =====

interface SchemaFile {
  version: string;
  config: {
    defaultApp: string;
    variables: Record<string, { purpose: string; defaultExpression: string; required: boolean }>;
    displayDefaults: {
      maxResults: number;
      sortOrder: string;
      groupOthersThreshold: number;
      groupOthersLabel: string;
      showTotals: boolean;
    };
  };
  entities: Record<string, EntitySchema>;
  timePeriods: Record<string, TimePeriod>;
}

interface EntitySchema {
  description: string;
  aliases: string[];
  baseFilter: string;
  defaultDateField: string;
  defaultMeasure: string;
  drillPath: string[];
}

interface MeasuresFile {
  version: string;
  measures: Record<string, Record<string, MeasureDefinition>>;
  dimensions: {
    shared: Record<string, DimensionDefinition>;
    time: Record<string, DimensionDefinition>;
    satisfaction?: Record<string, DimensionDefinition>;
  };
}

interface MeasureDefinition {
  type: 'stock' | 'flow';
  expression: string;
  description: string;
  unit: string;
  format: string;
  requiresTimePeriod: boolean;
  masterId?: string;
}

interface DimensionDefinition {
  field: string;
  description: string;
}

interface GuidanceFile {
  version: string;
  principles: {
    core: string[];
    dataIntegrity: string[];
    communication: string[];
  };
  measureTypeHandling: {
    stock: { description: string; requiresTimePeriod: boolean; behavior: string; examples: string[] };
    flow: { description: string; requiresTimePeriod: boolean; behavior: string; defaultSuggestion: string; clarificationTemplate: string; examples: string[] };
  };
  clarificationTriggers: Record<string, { condition: string; action: string; template: string }>;
  responseTemplates: Record<string, any>;
  examples: any[];
  antiPatterns: any[];
  contextRules: Record<string, any>;
}

interface I18nFile {
  version: string;
  language: string;
  entities: Record<string, { name: string; plural: string; aliases: string[] }>;
  measures: Record<string, Record<string, string>>;
  dimensions: Record<string, string>;
  timePeriods: Record<string, string>;
  ui: Record<string, string>;
  prompts: Record<string, string>;
}

interface TimePeriod {
  filter: string;
  aliases: string[];
}

// ===== FILE LOADERS =====

let schemaCache: SchemaFile | null = null;
let measuresCache: MeasuresFile | null = null;
let guidanceCache: GuidanceFile | null = null;
let i18nCache: I18nFile | null = null;

function loadSchema(): SchemaFile {
  if (schemaCache) return schemaCache;

  try {
    if (fs.existsSync(SCHEMA_PATH)) {
      const content = fs.readFileSync(SCHEMA_PATH, 'utf-8');
      schemaCache = JSON.parse(content);
      return schemaCache!;
    }
  } catch (error) {
    log.debug('[SemanticHandlers] Failed to load schema:', error);
  }

  // Fallback to legacy file
  return loadLegacyAsSchema();
}

function loadMeasures(): MeasuresFile {
  if (measuresCache) return measuresCache;

  try {
    if (fs.existsSync(MEASURES_PATH)) {
      const content = fs.readFileSync(MEASURES_PATH, 'utf-8');
      measuresCache = JSON.parse(content);
      return measuresCache!;
    }
  } catch (error) {
    log.debug('[SemanticHandlers] Failed to load measures:', error);
  }

  // Fallback to legacy file
  return loadLegacyAsMeasures();
}

function loadGuidance(): GuidanceFile | null {
  if (guidanceCache) return guidanceCache;

  try {
    if (fs.existsSync(GUIDANCE_PATH)) {
      const content = fs.readFileSync(GUIDANCE_PATH, 'utf-8');
      guidanceCache = JSON.parse(content);
      return guidanceCache;
    }
  } catch (error) {
    log.debug('[SemanticHandlers] Failed to load guidance:', error);
  }

  return null;
}

function loadI18n(language: string = 'he'): I18nFile | null {
  if (language === 'he' && i18nCache) return i18nCache;

  try {
    const i18nPath = path.join(KNOWLEDGE_DIR, `semantic-i18n-${language}.json`);
    if (fs.existsSync(i18nPath)) {
      const content = fs.readFileSync(i18nPath, 'utf-8');
      const parsed = JSON.parse(content);
      if (language === 'he') i18nCache = parsed;
      return parsed;
    }
  } catch (error) {
    log.debug(`[SemanticHandlers] Failed to load i18n for ${language}:`, error);
  }

  return null;
}

// ===== LEGACY COMPATIBILITY =====

function loadLegacyAsSchema(): SchemaFile {
  const legacy = JSON.parse(fs.readFileSync(LEGACY_PATH, 'utf-8'));

  const entities: Record<string, EntitySchema> = {};
  for (const [key, entity] of Object.entries(legacy.entities as Record<string, any>)) {
    entities[key] = {
      description: entity.description,
      aliases: entity.names.filter((n: string) => !/[\u0590-\u05FF]/.test(n)), // Filter out Hebrew
      baseFilter: entity.filters,
      defaultDateField: entity.default_date_field,
      defaultMeasure: 'active_count',
      drillPath: entity.drill_options
    };
  }

  const timePeriods: Record<string, TimePeriod> = {};
  for (const [key, period] of Object.entries(legacy.timePeriods as Record<string, any>)) {
    timePeriods[key] = {
      filter: period.filter,
      aliases: [period.description]
    };
  }

  return {
    version: '3.0-legacy',
    config: {
      defaultApp: 'a30ab30d-cf2a-41fa-86ef-cf4f189deecf',
      variables: {
        V_ToDate: { purpose: 'Date filter flag', defaultExpression: '=1', required: true }
      },
      displayDefaults: {
        maxResults: legacy.displayRules?.maxListItems || 10,
        sortOrder: legacy.displayRules?.sortOrder || 'descending',
        groupOthersThreshold: 10,
        groupOthersLabel: 'Others',
        showTotals: legacy.displayRules?.showTotal || true
      }
    },
    entities,
    timePeriods
  };
}

function loadLegacyAsMeasures(): MeasuresFile {
  const legacy = JSON.parse(fs.readFileSync(LEGACY_PATH, 'utf-8'));

  const measures: Record<string, Record<string, MeasureDefinition>> = {};
  const sharedDimensions: Record<string, DimensionDefinition> = {};

  for (const [entityKey, entity] of Object.entries(legacy.entities as Record<string, any>)) {
    measures[entityKey] = {};

    for (const [measureKey, measure] of Object.entries(entity.measures as Record<string, any>)) {
      measures[entityKey][measureKey] = {
        type: measure.type,
        expression: measure.expression || '',
        description: measure.description,
        unit: 'count',
        format: '#,##0',
        requiresTimePeriod: measure.type === 'flow',
        masterId: measure.id
      };
    }

    for (const [dimKey, dim] of Object.entries(entity.dimensions as Record<string, any>)) {
      if (!sharedDimensions[dimKey]) {
        sharedDimensions[dimKey] = {
          field: dim.field,
          description: dim.description
        };
      }
    }
  }

  return {
    version: '3.0-legacy',
    measures,
    dimensions: {
      shared: sharedDimensions,
      time: {
        request_date: { field: 'Request_Date', description: 'Date opened' },
        request_month: { field: 'Request_Month', description: 'Month opened' },
        request_year: { field: 'Request_Year', description: 'Year opened' }
      }
    }
  };
}

// ===== HANDLERS =====

/**
 * Handler for qlik_get_domain_schema
 * Returns relevant schema for a topic with AI guidance
 */
export async function handleGetDomainSchema(
  args: { topic: string }
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug(`[SemanticHandlers] get_domain_schema called for topic: ${args.topic}`);

  try {
    const schema = loadSchema();
    const measuresFile = loadMeasures();
    const guidance = loadGuidance();
    const i18n = loadI18n('he');

    const entity = schema.entities[args.topic];
    if (!entity) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: `Unknown topic: ${args.topic}`,
            availableTopics: Object.keys(schema.entities)
          }, null, 2)
        }]
      };
    }

    const entityMeasures = measuresFile.measures[args.topic] || {};

    // Build dimensions from shared + any entity-specific
    const allDimensions = {
      ...measuresFile.dimensions.shared,
      ...measuresFile.dimensions.time,
      ...(measuresFile.dimensions.satisfaction || {})
    };

    // Filter dimensions to those in drillPath
    const relevantDimensions: Record<string, any> = {};
    for (const dimKey of entity.drillPath) {
      if (allDimensions[dimKey]) {
        relevantDimensions[dimKey] = allDimensions[dimKey];
      }
    }

    // Get Hebrew translations if available
    const hebrewNames = i18n?.entities[args.topic];
    const hebrewMeasures = i18n?.measures[args.topic] || {};

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          topic: args.topic,
          schema: {
            description: entity.description,
            aliases: entity.aliases,
            baseFilter: entity.baseFilter,
            defaultDateField: entity.defaultDateField,
            defaultMeasure: entity.defaultMeasure,
            drillPath: entity.drillPath,
            measures: entityMeasures,
            dimensions: relevantDimensions
          },
          hebrew: hebrewNames ? {
            name: hebrewNames.name,
            plural: hebrewNames.plural,
            measures: hebrewMeasures
          } : null,
          config: schema.config,
          timePeriods: schema.timePeriods,
          aiGuidance: guidance ? {
            measureTypeHandling: guidance.measureTypeHandling,
            clarificationTriggers: guidance.clarificationTriggers,
            responseTemplates: guidance.responseTemplates
          } : null
        }, null, 2)
      }]
    };
  } catch (error) {
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
 * Handler for qlik_get_measure_type
 * Returns Stock or Flow type with AI guidance on behavior
 */
export async function handleGetMeasureType(
  args: { entity: string; measure: string }
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug(`[SemanticHandlers] get_measure_type called for ${args.entity}.${args.measure}`);

  try {
    const schema = loadSchema();
    const measuresFile = loadMeasures();
    const guidance = loadGuidance();
    const i18n = loadI18n('he');

    if (!schema.entities[args.entity]) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: `Unknown entity: ${args.entity}`,
            availableEntities: Object.keys(schema.entities)
          }, null, 2)
        }]
      };
    }

    const entityMeasures = measuresFile.measures[args.entity];
    if (!entityMeasures || !entityMeasures[args.measure]) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: `Unknown measure: ${args.measure}`,
            availableMeasures: entityMeasures ? Object.keys(entityMeasures) : []
          }, null, 2)
        }]
      };
    }

    const measure = entityMeasures[args.measure];
    const hebrewName = i18n?.measures[args.entity]?.[args.measure];
    const typeGuidance = guidance?.measureTypeHandling[measure.type];

    // Get clarification template for flow measures
    const flowGuidance = guidance?.measureTypeHandling.flow;
    const clarificationTemplate = measure.type === 'flow' && flowGuidance
      ? flowGuidance.clarificationTemplate
      : null;

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          entity: args.entity,
          measure: args.measure,
          type: measure.type,
          requiresTimePeriod: measure.requiresTimePeriod,
          description: measure.description,
          hebrew: hebrewName || null,
          expression: measure.expression,
          unit: measure.unit,
          format: measure.format,
          aiGuidance: typeGuidance ? {
            behavior: typeGuidance.behavior,
            clarificationTemplate
          } : {
            behavior: measure.type === 'stock'
              ? 'Answer immediately - no date period needed'
              : 'Ask user for time period before answering'
          }
        }, null, 2)
      }]
    };
  } catch (error) {
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
 * Handler for qlik_get_drill_options
 * Returns available drill-down dimensions for an entity
 */
export async function handleGetDrillOptions(
  args: { entity: string }
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug(`[SemanticHandlers] get_drill_options called for ${args.entity}`);

  try {
    const schema = loadSchema();
    const measuresFile = loadMeasures();
    const i18n = loadI18n('he');

    const entity = schema.entities[args.entity];
    if (!entity) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: `Unknown entity: ${args.entity}`,
            availableEntities: Object.keys(schema.entities)
          }, null, 2)
        }]
      };
    }

    const allDimensions = {
      ...measuresFile.dimensions.shared,
      ...measuresFile.dimensions.time,
      ...(measuresFile.dimensions.satisfaction || {})
    };

    const drillDetails = entity.drillPath.map(opt => {
      const dim = allDimensions[opt];
      const hebrewName = i18n?.dimensions[opt];
      return {
        name: opt,
        field: dim?.field || opt,
        description: dim?.description || '',
        hebrew: hebrewName || null
      };
    });

    const hebrewPrompt = drillDetails
      .map(d => d.hebrew)
      .filter(Boolean)
      .join(', ');

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          entity: args.entity,
          drillPath: entity.drillPath,
          details: drillDetails,
          prompts: {
            hebrew: hebrewPrompt ? `אפשר לפרט לפי: ${hebrewPrompt}` : null,
            english: `Can drill down by: ${entity.drillPath.join(', ')}`
          }
        }, null, 2)
      }]
    };
  } catch (error) {
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
 * Handler for qlik_translate_hebrew
 * Translates Hebrew business terms to Qlik field names
 */
export async function handleTranslateHebrew(
  args: { term: string }
): Promise<{ content: Array<{ type: string; text: string }> }> {
  log.debug(`[SemanticHandlers] translate_hebrew called for: ${args.term}`);

  try {
    const schema = loadSchema();
    const measuresFile = loadMeasures();
    const i18n = loadI18n('he');
    const term = args.term.trim();

    if (!i18n) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Hebrew translations not available'
          }, null, 2)
        }]
      };
    }

    // Check entities
    for (const [entityKey, entityI18n] of Object.entries(i18n.entities)) {
      if (entityI18n.name === term || entityI18n.plural === term || entityI18n.aliases.includes(term)) {
        const entity = schema.entities[entityKey];
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              term,
              type: 'entity',
              englishName: entityKey,
              filter: entity?.baseFilter || '',
              description: entity?.description || ''
            }, null, 2)
          }]
        };
      }
    }

    // Check measures
    for (const [entityKey, entityMeasures] of Object.entries(i18n.measures)) {
      for (const [measureKey, hebrewName] of Object.entries(entityMeasures)) {
        if (hebrewName === term || hebrewName.includes(term)) {
          const measure = measuresFile.measures[entityKey]?.[measureKey];
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                term,
                type: 'measure',
                englishName: measureKey,
                entity: entityKey,
                expression: measure?.expression || '',
                measureType: measure?.type || 'unknown',
                requiresTimePeriod: measure?.requiresTimePeriod || false,
                description: measure?.description || ''
              }, null, 2)
            }]
          };
        }
      }
    }

    // Check dimensions
    for (const [dimKey, hebrewName] of Object.entries(i18n.dimensions)) {
      if (hebrewName === term || hebrewName.includes(term)) {
        const dim = measuresFile.dimensions.shared[dimKey] ||
                    measuresFile.dimensions.time[dimKey] ||
                    measuresFile.dimensions.satisfaction?.[dimKey];
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              term,
              type: 'dimension',
              englishName: dimKey,
              field: dim?.field || dimKey,
              description: dim?.description || ''
            }, null, 2)
          }]
        };
      }
    }

    // Check time periods
    for (const [periodKey, hebrewName] of Object.entries(i18n.timePeriods)) {
      if (hebrewName === term || hebrewName.includes(term)) {
        const period = schema.timePeriods[periodKey];
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              term,
              type: 'time_period',
              englishName: periodKey,
              filter: period?.filter || '',
              aliases: period?.aliases || []
            }, null, 2)
          }]
        };
      }
    }

    // Not found
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          term,
          error: 'Term not found in semantic layer',
          suggestions: {
            entities: Object.keys(i18n.entities),
            sampleMeasures: Object.values(i18n.measures.incident || {}).slice(0, 5),
            sampleDimensions: Object.values(i18n.dimensions).slice(0, 5)
          }
        }, null, 2)
      }]
    };
  } catch (error) {
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
