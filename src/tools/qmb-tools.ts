/**
 * QlikModelBuilder - MCP Tools
 * Tool definitions for the Model Builder wizard
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * QMB Tool Definitions
 */
export const qmbTools: Tool[] = [
  // ============================================================
  // Wizard Lifecycle Tools
  // ============================================================
  {
    name: 'qmb_start_wizard',
    description: 'Start a new QlikModelBuilder wizard session. Choose entry mode: scratch (step-by-step), spec (from document), or template.',
    inputSchema: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['scratch', 'spec', 'template'],
          description: 'Entry mode: scratch for step-by-step, spec for document import, template for pre-built template',
          default: 'scratch',
        },
        projectName: {
          type: 'string',
          description: 'Optional project name',
        },
      },
    },
  },
  {
    name: 'qmb_status',
    description: 'Get current wizard status including current step, progress, and configuration summary',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'qmb_go_back',
    description: 'Navigate back to the previous step in the wizard',
    inputSchema: {
      type: 'object',
      properties: {
        stepId: {
          type: 'string',
          enum: ['space_setup', 'data_source', 'table_selection', 'field_mapping', 'incremental_config', 'review', 'deploy'],
          description: 'Optional: specific step to go back to',
        },
      },
    },
  },

  // ============================================================
  // Space Management Tools
  // ============================================================
  {
    name: 'qmb_list_spaces',
    description: 'List available Qlik Cloud Spaces for the project',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['all', 'shared', 'managed', 'personal'],
          description: 'Filter by space type',
          default: 'all',
        },
      },
    },
  },
  {
    name: 'qmb_select_space',
    description: 'Select an existing Space for the project',
    inputSchema: {
      type: 'object',
      properties: {
        spaceId: {
          type: 'string',
          description: 'The ID of the space to select',
        },
      },
      required: ['spaceId'],
    },
  },
  {
    name: 'qmb_create_space',
    description: 'Create a new Space for the project',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name for the new Space',
        },
        type: {
          type: 'string',
          enum: ['shared', 'managed'],
          description: 'Space type',
        },
        description: {
          type: 'string',
          description: 'Optional description',
        },
      },
      required: ['name', 'type'],
    },
  },

  // ============================================================
  // Connection Tools
  // ============================================================
  {
    name: 'qmb_list_connections',
    description: 'List available data connections (LIBs)',
    inputSchema: {
      type: 'object',
      properties: {
        spaceId: {
          type: 'string',
          description: 'Filter by space ID',
        },
        type: {
          type: 'string',
          description: 'Filter by connection type (e.g., sqlserver, rest_api)',
        },
      },
    },
  },
  {
    name: 'qmb_select_connection',
    description: 'Select an existing data connection',
    inputSchema: {
      type: 'object',
      properties: {
        connectionId: {
          type: 'string',
          description: 'The ID of the connection to select',
        },
      },
      required: ['connectionId'],
    },
  },
  {
    name: 'qmb_create_connection',
    description: 'Configure a new data connection',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Connection name',
        },
        type: {
          type: 'string',
          enum: ['sqlserver', 'oracle', 'postgresql', 'mysql', 'rest_api', 'excel', 'csv', 'json', 'qvd'],
          description: 'Connection type',
        },
        server: {
          type: 'string',
          description: 'Server address (for database connections)',
        },
        database: {
          type: 'string',
          description: 'Database name',
        },
        username: {
          type: 'string',
          description: 'Username for authentication',
        },
        password: {
          type: 'string',
          description: 'Password for authentication',
        },
      },
      required: ['name', 'type'],
    },
  },
  {
    name: 'qmb_api_wizard',
    description: 'Start the API connection wizard for REST API configuration',
    inputSchema: {
      type: 'object',
      properties: {
        baseUrl: {
          type: 'string',
          description: 'Base URL of the API',
        },
        authType: {
          type: 'string',
          enum: ['none', 'api_key', 'bearer', 'basic', 'oauth2'],
          description: 'Authentication type',
        },
      },
    },
  },
  {
    name: 'qmb_test_connection',
    description: 'Test the current connection configuration',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  // ============================================================
  // Table Configuration Tools
  // ============================================================
  {
    name: 'qmb_list_tables',
    description: 'List available tables from the configured data source',
    inputSchema: {
      type: 'object',
      properties: {
        schema: {
          type: 'string',
          description: 'Filter by schema name',
        },
        search: {
          type: 'string',
          description: 'Search filter for table names',
        },
      },
    },
  },
  {
    name: 'qmb_add_table',
    description: 'Add a table to the project configuration',
    inputSchema: {
      type: 'object',
      properties: {
        tableName: {
          type: 'string',
          description: 'Name of the table to add',
        },
        schema: {
          type: 'string',
          description: 'Schema name',
        },
        alias: {
          type: 'string',
          description: 'Optional alias for the table in Qlik',
        },
      },
      required: ['tableName'],
    },
  },
  {
    name: 'qmb_remove_table',
    description: 'Remove a table from the project configuration',
    inputSchema: {
      type: 'object',
      properties: {
        tableName: {
          type: 'string',
          description: 'Name of the table to remove',
        },
      },
      required: ['tableName'],
    },
  },
  {
    name: 'qmb_get_table_fields',
    description: 'Get fields/columns for a specific table',
    inputSchema: {
      type: 'object',
      properties: {
        tableName: {
          type: 'string',
          description: 'Name of the table',
        },
      },
      required: ['tableName'],
    },
  },
  {
    name: 'qmb_set_table_fields',
    description: 'Configure which fields to include for a table',
    inputSchema: {
      type: 'object',
      properties: {
        tableName: {
          type: 'string',
          description: 'Name of the table',
        },
        includeFields: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of field names to include',
        },
        excludeFields: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of field names to exclude',
        },
      },
      required: ['tableName'],
    },
  },

  // ============================================================
  // Incremental Configuration Tools
  // ============================================================
  {
    name: 'qmb_set_incremental',
    description: 'Configure incremental load strategy for a table',
    inputSchema: {
      type: 'object',
      properties: {
        tableName: {
          type: 'string',
          description: 'Name of the table',
        },
        strategy: {
          type: 'string',
          enum: ['none', 'by_date', 'by_id', 'time_window', 'custom'],
          description: 'Incremental strategy',
        },
        field: {
          type: 'string',
          description: 'Field to use for incremental (for by_date or by_id)',
        },
        windowSize: {
          type: 'number',
          description: 'Window size for time_window strategy',
        },
        windowUnit: {
          type: 'string',
          enum: ['days', 'weeks', 'months'],
          description: 'Window unit for time_window strategy',
        },
        keepHistory: {
          type: 'boolean',
          description: 'Whether to keep historical data in QVD',
        },
      },
      required: ['tableName', 'strategy'],
    },
  },
  {
    name: 'qmb_suggest_incremental',
    description: 'Get AI suggestions for incremental load configuration based on table structure',
    inputSchema: {
      type: 'object',
      properties: {
        tableName: {
          type: 'string',
          description: 'Name of the table to analyze',
        },
      },
      required: ['tableName'],
    },
  },

  // ============================================================
  // Template Tools
  // ============================================================
  {
    name: 'qmb_list_templates',
    description: 'List available templates',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['all', 'source', 'pattern', 'domain'],
          description: 'Filter by template category',
        },
        sourceType: {
          type: 'string',
          description: 'Filter by source type (e.g., sqlserver, rest_api)',
        },
      },
    },
  },
  {
    name: 'qmb_use_template',
    description: 'Apply a template to the current project',
    inputSchema: {
      type: 'object',
      properties: {
        templateId: {
          type: 'string',
          description: 'ID of the template to apply',
        },
      },
      required: ['templateId'],
    },
  },

  // ============================================================
  // Spec Import Tools
  // ============================================================
  {
    name: 'qmb_load_spec',
    description: 'Load and extract configuration from a specification document',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to the specification file (Excel, Word, PDF)',
        },
        content: {
          type: 'string',
          description: 'Or provide the content directly',
        },
      },
    },
  },

  // ============================================================
  // Validation & Review Tools
  // ============================================================
  {
    name: 'qmb_validate',
    description: 'Validate current wizard configuration',
    inputSchema: {
      type: 'object',
      properties: {
        step: {
          type: 'string',
          enum: ['current', 'all', 'space_setup', 'data_source', 'table_selection', 'field_mapping', 'incremental_config', 'review'],
          description: 'Which step(s) to validate',
          default: 'current',
        },
      },
    },
  },
  {
    name: 'qmb_preview_script',
    description: 'Preview the generated Qlik script without saving',
    inputSchema: {
      type: 'object',
      properties: {
        includeComments: {
          type: 'boolean',
          description: 'Include comments in the script',
          default: true,
        },
        language: {
          type: 'string',
          enum: ['en', 'he'],
          description: 'Comment language',
          default: 'en',
        },
      },
    },
  },

  // ============================================================
  // Deploy Tools
  // ============================================================
  {
    name: 'qmb_deploy',
    description: 'Deploy the model to Qlik Cloud - creates app, uploads script, runs reload',
    inputSchema: {
      type: 'object',
      properties: {
        appName: {
          type: 'string',
          description: 'Name for the Qlik app (defaults to project name)',
        },
        runReload: {
          type: 'boolean',
          description: 'Whether to run a reload after creating the app',
          default: true,
        },
      },
    },
  },

  // ============================================================
  // Utility Tools
  // ============================================================
  {
    name: 'qmb_export_state',
    description: 'Export current wizard state to JSON for later resume',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'qmb_import_state',
    description: 'Import wizard state from previously exported JSON',
    inputSchema: {
      type: 'object',
      properties: {
        stateJson: {
          type: 'string',
          description: 'The exported state JSON',
        },
      },
      required: ['stateJson'],
    },
  },
  {
    name: 'qmb_quick_start',
    description: 'Quick start wizard with common defaults - minimal questions',
    inputSchema: {
      type: 'object',
      properties: {
        projectName: {
          type: 'string',
          description: 'Project name',
        },
        sourceType: {
          type: 'string',
          enum: ['sqlserver', 'oracle', 'postgresql', 'mysql'],
          description: 'Database type',
        },
        connectionString: {
          type: 'string',
          description: 'Connection string or server address',
        },
      },
      required: ['projectName', 'sourceType'],
    },
  },
  {
    name: 'qmb_clone',
    description: 'Clone an existing Qlik app configuration for modifications',
    inputSchema: {
      type: 'object',
      properties: {
        appId: {
          type: 'string',
          description: 'ID of the app to clone',
        },
        newName: {
          type: 'string',
          description: 'Name for the new project',
        },
      },
      required: ['appId'],
    },
  },

  // ============================================================
  // Smart Guide Tool
  // ============================================================
  {
    name: 'qmb_guide',
    description: 'Get contextual guidance for the current wizard step - what to do next, available actions, and recommendations',
    inputSchema: {
      type: 'object',
      properties: {
        language: {
          type: 'string',
          enum: ['en', 'he'],
          description: 'Response language',
          default: 'he',
        },
      },
    },
  },
];

/**
 * Get all QMB tool names
 */
export function getQmbToolNames(): string[] {
  return qmbTools.map((tool) => tool.name);
}

/**
 * Check if a tool name is a QMB tool
 */
export function isQmbTool(toolName: string): boolean {
  return toolName.startsWith('qmb_');
}
