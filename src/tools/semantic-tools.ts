/**
 * Semantic Layer Tools for AI Assistant
 * Implements Lazy Loading from QLIK_AI_ASSISTANT_SPECIFICATION_V2
 */

export const SEMANTIC_TOOLS = {
  qlik_get_domain_schema: {
    name: 'qlik_get_domain_schema',
    description: 'Get semantic schema for a specific domain/topic. Returns only relevant fields, measures, dimensions, and drill options for the requested topic. Supports lazy loading to reduce token usage.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'The domain topic to get schema for',
          enum: ['incident', 'request', 'satisfaction', 'sla', 'technician']
        }
      },
      required: ['topic']
    }
  },

  qlik_get_measure_type: {
    name: 'qlik_get_measure_type',
    description: 'Check if a measure is Stock (current state, no date needed) or Flow (historical, requires date). Use this to determine if you need to ask the user for a time period.',
    inputSchema: {
      type: 'object',
      properties: {
        entity: {
          type: 'string',
          description: 'The entity type',
          enum: ['incident', 'request', 'satisfaction', 'sla', 'technician']
        },
        measure: {
          type: 'string',
          description: 'The measure name (e.g., active_count, total_volume, breached)'
        }
      },
      required: ['entity', 'measure']
    }
  },

  qlik_get_drill_options: {
    name: 'qlik_get_drill_options',
    description: 'Get available drill-down dimensions for an entity. Use when user asks to elaborate/detail/breakdown data.',
    inputSchema: {
      type: 'object',
      properties: {
        entity: {
          type: 'string',
          description: 'The entity type',
          enum: ['incident', 'request', 'satisfaction', 'sla', 'technician']
        }
      },
      required: ['entity']
    }
  },

  qlik_translate_hebrew: {
    name: 'qlik_translate_hebrew',
    description: 'Translate Hebrew business term to Qlik field name. Use when user asks questions in Hebrew.',
    inputSchema: {
      type: 'object',
      properties: {
        term: {
          type: 'string',
          description: 'Hebrew term to translate (e.g., תקלות, טכנאי, קטגוריה)'
        }
      },
      required: ['term']
    }
  }
};
