// ===== TOOLS INDEX =====
// Central registry of all tool definitions and registration logic

import { ToolDefinition, CLOUD_ONLY_TOOLS } from '../server/tool-registry.js';
import { APP_TOOLS } from './app-tools.js';
import { AUTOMATION_TOOLS } from './automation-tools.js';
import { RELOAD_TOOLS } from './reload-tools.js';
import { CATALOG_TOOLS } from './catalog-tools.js';
import { GOVERNANCE_TOOLS } from './governance-tools.js';
import { LINEAGE_TOOLS } from './lineage-tools.js';
import { DATA_TOOLS } from './data-tools.js';
import { MISC_TOOLS } from './misc-tools.js';
// Qlik Answers removed - not relevant for this deployment
import { ALERTS_TOOLS } from './alerts-tools.js';
// AutoML removed - not relevant for this deployment
import { SEARCH_TOOLS } from './search-tools.js';
import { COLLECTIONS_TOOLS } from './collections-tools.js';
import { TENANT_TOOLS } from './tenant-tools.js';
import { SEMANTIC_TOOLS } from './semantic-tools.js';
import { intentTools } from './intent-tools.js';
import { HandlerRouter } from '../server/handler-router.js';
import { logger } from '../utils/logger.js';

/**
 * Universal tools - available on both cloud and on-premise
 */
export const UNIVERSAL_TOOLS = [
  'qlik_search',  // Unified search for both platforms
];

/**
 * Cloud-only tools - only available on Qlik Cloud
 */
export { CLOUD_ONLY_TOOLS };

/**
 * Export all tool definitions
 */
export {
  APP_TOOLS,
  AUTOMATION_TOOLS,
  RELOAD_TOOLS,
  CATALOG_TOOLS,
  GOVERNANCE_TOOLS,
  LINEAGE_TOOLS,
  DATA_TOOLS,
  MISC_TOOLS,
  ALERTS_TOOLS,
  SEARCH_TOOLS,
  COLLECTIONS_TOOLS,
  SEMANTIC_TOOLS,
  intentTools
};

/**
 * Convert tool definitions to ToolDefinition format with handlers
 */
export function createToolDefinitions(
  router: HandlerRouter,
  platform: 'cloud' | 'on-premise'
): ToolDefinition[] {
  const tools: ToolDefinition[] = [];

  // ===== TENANT MANAGEMENT TOOLS (Both platforms) =====
  tools.push({
    name: TENANT_TOOLS.qlik_list_tenants.name,
    description: TENANT_TOOLS.qlik_list_tenants.description,
    inputSchema: TENANT_TOOLS.qlik_list_tenants.inputSchema,
    handler: async (args) => await router.route('qlik_list_tenants', args),
  });

  tools.push({
    name: TENANT_TOOLS.qlik_switch_tenant.name,
    description: TENANT_TOOLS.qlik_switch_tenant.description,
    inputSchema: TENANT_TOOLS.qlik_switch_tenant.inputSchema,
    handler: async (args) => await router.route('qlik_switch_tenant', args),
  });

  tools.push({
    name: TENANT_TOOLS.qlik_get_active_tenant.name,
    description: TENANT_TOOLS.qlik_get_active_tenant.description,
    inputSchema: TENANT_TOOLS.qlik_get_active_tenant.inputSchema,
    handler: async (args) => await router.route('qlik_get_active_tenant', args),
  });

  // ===== UNIFIED SEARCH TOOL (Both platforms) =====
  tools.push({
    name: SEARCH_TOOLS.qlik_search.name,
    description: SEARCH_TOOLS.qlik_search.description,
    inputSchema: SEARCH_TOOLS.qlik_search.inputSchema,
    handler: async (args) => await router.route('qlik_search', args),
    // No cloudOnly flag - available on both platforms
  });

  // ===== RELOAD TOOLS (Both platforms) =====
  tools.push({
    name: RELOAD_TOOLS.qlik_trigger_app_reload.name,
    description: RELOAD_TOOLS.qlik_trigger_app_reload.description,
    inputSchema: RELOAD_TOOLS.qlik_trigger_app_reload.inputSchema,
    handler: async (args) => await router.route('qlik_trigger_app_reload', args),
  });

  tools.push({
    name: RELOAD_TOOLS.qlik_get_reload_status.name,
    description: RELOAD_TOOLS.qlik_get_reload_status.description,
    inputSchema: RELOAD_TOOLS.qlik_get_reload_status.inputSchema,
    handler: async (args) => await router.route('qlik_get_reload_status', args),
  });

  tools.push({
    name: RELOAD_TOOLS.qlik_cancel_reload.name,
    description: RELOAD_TOOLS.qlik_cancel_reload.description,
    inputSchema: RELOAD_TOOLS.qlik_cancel_reload.inputSchema,
    handler: async (args) => await router.route('qlik_cancel_reload', args),
  });

  // ===== CATALOG TOOLS (Both platforms - Spaces for Cloud, Streams for On-Prem) =====
  tools.push({
    name: CATALOG_TOOLS.qlik_get_spaces_catalog.name,
    description: CATALOG_TOOLS.qlik_get_spaces_catalog.description,
    inputSchema: CATALOG_TOOLS.qlik_get_spaces_catalog.inputSchema,
    handler: async (args) => await router.route('qlik_get_spaces_catalog', args),
  });

  // ===== GOVERNANCE TOOLS (Both platforms) =====
  tools.push({
    name: GOVERNANCE_TOOLS.qlik_get_tenant_info.name,
    description: GOVERNANCE_TOOLS.qlik_get_tenant_info.description,
    inputSchema: GOVERNANCE_TOOLS.qlik_get_tenant_info.inputSchema,
    handler: async (args) => await router.route('qlik_get_tenant_info', args),
  });

  tools.push({
    name: GOVERNANCE_TOOLS.qlik_get_user_info.name,
    description: GOVERNANCE_TOOLS.qlik_get_user_info.description,
    inputSchema: GOVERNANCE_TOOLS.qlik_get_user_info.inputSchema,
    handler: async (args) => await router.route('qlik_get_user_info', args),
  });

  tools.push({
    name: GOVERNANCE_TOOLS.qlik_search_users.name,
    description: GOVERNANCE_TOOLS.qlik_search_users.description,
    inputSchema: GOVERNANCE_TOOLS.qlik_search_users.inputSchema,
    handler: async (args) => await router.route('qlik_search_users', args),
  });

  tools.push({
    name: GOVERNANCE_TOOLS.qlik_health_check.name,
    description: GOVERNANCE_TOOLS.qlik_health_check.description,
    inputSchema: GOVERNANCE_TOOLS.qlik_health_check.inputSchema,
    handler: async (args) => await router.route('qlik_health_check', args),
  });

  tools.push({
    name: GOVERNANCE_TOOLS.qlik_get_license_info.name,
    description: GOVERNANCE_TOOLS.qlik_get_license_info.description,
    inputSchema: GOVERNANCE_TOOLS.qlik_get_license_info.inputSchema,
    handler: async (args) => await router.route('qlik_get_license_info', args),
  });

  // ===== DATA TOOLS - Engine API (Both platforms) =====
  tools.push({
    name: DATA_TOOLS.qlik_apply_selections.name,
    description: DATA_TOOLS.qlik_apply_selections.description,
    inputSchema: DATA_TOOLS.qlik_apply_selections.inputSchema,
    handler: async (args) => await router.route('qlik_apply_selections', args),
  });

  tools.push({
    name: DATA_TOOLS.qlik_clear_selections.name,
    description: DATA_TOOLS.qlik_clear_selections.description,
    inputSchema: DATA_TOOLS.qlik_clear_selections.inputSchema,
    handler: async (args) => await router.route('qlik_clear_selections', args),
  });

  tools.push({
    name: DATA_TOOLS.qlik_get_current_selections.name,
    description: DATA_TOOLS.qlik_get_current_selections.description,
    inputSchema: DATA_TOOLS.qlik_get_current_selections.inputSchema,
    handler: async (args) => await router.route('qlik_get_current_selections', args),
  });

  tools.push({
    name: DATA_TOOLS.qlik_get_available_fields.name,
    description: DATA_TOOLS.qlik_get_available_fields.description,
    inputSchema: DATA_TOOLS.qlik_get_available_fields.inputSchema,
    handler: async (args) => await router.route('qlik_get_available_fields', args),
  });

  // ===== NEW DATA TOOLS - Combined from existing + external repos =====

  tools.push({
    name: DATA_TOOLS.qlik_get_app_metadata.name,
    description: DATA_TOOLS.qlik_get_app_metadata.description,
    inputSchema: DATA_TOOLS.qlik_get_app_metadata.inputSchema,
    handler: async (args) => await router.route('qlik_get_app_metadata', args),
  });

  tools.push({
    name: DATA_TOOLS.qlik_get_object_data.name,
    description: DATA_TOOLS.qlik_get_object_data.description,
    inputSchema: DATA_TOOLS.qlik_get_object_data.inputSchema,
    handler: async (args) => await router.route('qlik_get_object_data', args),
  });

  tools.push({
    name: DATA_TOOLS.qlik_create_hypercube.name,
    description: DATA_TOOLS.qlik_create_hypercube.description,
    inputSchema: DATA_TOOLS.qlik_create_hypercube.inputSchema,
    handler: async (args) => await router.route('qlik_create_hypercube', args),
  });

  tools.push({
    name: DATA_TOOLS.qlik_get_app_sheets.name,
    description: DATA_TOOLS.qlik_get_app_sheets.description,
    inputSchema: DATA_TOOLS.qlik_get_app_sheets.inputSchema,
    handler: async (args) => await router.route('qlik_get_app_sheets', args),
  });

  tools.push({
    name: DATA_TOOLS.qlik_get_sheet_objects.name,
    description: DATA_TOOLS.qlik_get_sheet_objects.description,
    inputSchema: DATA_TOOLS.qlik_get_sheet_objects.inputSchema,
    handler: async (args) => await router.route('qlik_get_sheet_objects', args),
  });

  tools.push({
    name: DATA_TOOLS.qlik_get_field_values.name,
    description: DATA_TOOLS.qlik_get_field_values.description,
    inputSchema: DATA_TOOLS.qlik_get_field_values.inputSchema,
    handler: async (args) => await router.route('qlik_get_field_values', args),
  });

  tools.push({
    name: DATA_TOOLS.qlik_get_app_script.name,
    description: DATA_TOOLS.qlik_get_app_script.description,
    inputSchema: DATA_TOOLS.qlik_get_app_script.inputSchema,
    handler: async (args) => await router.route('qlik_get_app_script', args),
  });

  tools.push({
    name: DATA_TOOLS.qlik_evaluate_expression.name,
    description: DATA_TOOLS.qlik_evaluate_expression.description,
    inputSchema: DATA_TOOLS.qlik_evaluate_expression.inputSchema,
    handler: async (args) => await router.route('qlik_evaluate_expression', args),
  });

  // ===== VISUALIZATION CREATION TOOLS (Both platforms) =====
  tools.push({
    name: DATA_TOOLS.qlik_create_sheet.name,
    description: DATA_TOOLS.qlik_create_sheet.description,
    inputSchema: DATA_TOOLS.qlik_create_sheet.inputSchema,
    handler: async (args) => await router.route('qlik_create_sheet', args),
  });

  tools.push({
    name: DATA_TOOLS.qlik_create_visualization.name,
    description: DATA_TOOLS.qlik_create_visualization.description,
    inputSchema: DATA_TOOLS.qlik_create_visualization.inputSchema,
    handler: async (args) => await router.route('qlik_create_visualization', args),
  });

  tools.push({
    name: DATA_TOOLS.qlik_create_ai_cache.name,
    description: DATA_TOOLS.qlik_create_ai_cache.description,
    inputSchema: DATA_TOOLS.qlik_create_ai_cache.inputSchema,
    handler: async (args) => await router.route('qlik_create_ai_cache', args),
  });

  tools.push({
    name: DATA_TOOLS.qlik_get_ai_cache_data.name,
    description: DATA_TOOLS.qlik_get_ai_cache_data.description,
    inputSchema: DATA_TOOLS.qlik_get_ai_cache_data.inputSchema,
    handler: async (args) => await router.route('qlik_get_ai_cache_data', args),
  });

  tools.push({
    name: DATA_TOOLS.qlik_get_existing_kpis.name,
    description: DATA_TOOLS.qlik_get_existing_kpis.description,
    inputSchema: DATA_TOOLS.qlik_get_existing_kpis.inputSchema,
    handler: async (args) => await router.route('qlik_get_existing_kpis', args),
  });

  tools.push({
    name: DATA_TOOLS.qlik_create_dashboard_from_analysis.name,
    description: DATA_TOOLS.qlik_create_dashboard_from_analysis.description,
    inputSchema: DATA_TOOLS.qlik_create_dashboard_from_analysis.inputSchema,
    handler: async (args) => await router.route('qlik_create_dashboard_from_analysis', args),
  });

  // ===== APP TOOLS (Both platforms) =====
  tools.push({
    name: APP_TOOLS.qlik_generate_app.name,
    description: APP_TOOLS.qlik_generate_app.description,
    inputSchema: APP_TOOLS.qlik_generate_app.inputSchema,
    handler: async (args) => await router.route('qlik_generate_app', args),
  });

  // ===== MISC TOOLS - NL/Insight Advisor (Both platforms) =====
  tools.push({
    name: MISC_TOOLS.qlik_insight_advisor.name,
    description: MISC_TOOLS.qlik_insight_advisor.description,
    inputSchema: MISC_TOOLS.qlik_insight_advisor.inputSchema,
    handler: async (args) => await router.route('qlik_insight_advisor', args),
  });

  tools.push({
    name: MISC_TOOLS.qlik_get_reload_info.name,
    description: MISC_TOOLS.qlik_get_reload_info.description,
    inputSchema: MISC_TOOLS.qlik_get_reload_info.inputSchema,
    handler: async (args) => await router.route('qlik_get_reload_info', args),
  });

  // ===== SEMANTIC LAYER TOOLS (Both platforms - local knowledge base) =====
  for (const [key, tool] of Object.entries(SEMANTIC_TOOLS)) {
    tools.push({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      handler: async (args) => await router.route(tool.name, args),
    });
  }

  // ===== INTENT RECOGNITION TOOLS (V4 - Both platforms) =====
  for (const tool of intentTools) {
    tools.push({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      handler: async (args) => await router.route(tool.name, args),
    });
  }

  // ===== CLOUD-ONLY TOOLS =====
  if (platform === 'cloud') {
    // ===== LINEAGE TOOLS (Cloud only) =====
    tools.push({
      name: LINEAGE_TOOLS.qlik_get_lineage.name,
      description: LINEAGE_TOOLS.qlik_get_lineage.description,
      inputSchema: LINEAGE_TOOLS.qlik_get_lineage.inputSchema,
      handler: async (args) => await router.route('qlik_get_lineage', args),
      cloudOnly: true,
    });

    // ===== DATA TOOLS - Cloud REST APIs (Cloud only) =====
    tools.push({
      name: DATA_TOOLS.qlik_get_dataset_details.name,
      description: DATA_TOOLS.qlik_get_dataset_details.description,
      inputSchema: DATA_TOOLS.qlik_get_dataset_details.inputSchema,
      handler: async (args) => await router.route('qlik_get_dataset_details', args),
      cloudOnly: true,
    });

    // Qlik Answers tools removed - not relevant for this deployment

    // ===== QLIK ALERTS TOOLS (Cloud only) =====
    for (const [key, tool] of Object.entries(ALERTS_TOOLS)) {
      tools.push({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        handler: async (args) => await router.route(tool.name, args),
        cloudOnly: true,
      });
    }

    // AutoML tools removed - not relevant for this deployment

    // ===== AUTOMATION TOOLS (Cloud only) =====
    for (const [key, tool] of Object.entries(AUTOMATION_TOOLS)) {
      tools.push({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        handler: async (args) => await router.route(tool.name, args),
        cloudOnly: true,
      });
    }

    // ===== COLLECTIONS TOOLS (Cloud only, uses @qlik/api) =====
    for (const [key, tool] of Object.entries(COLLECTIONS_TOOLS)) {
      tools.push({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        handler: async (args) => await router.route(tool.name, args),
        cloudOnly: true,
      });
    }
  }

  return tools;
}

/**
 * Register all tools based on platform
 */
export function registerAllTools(
  registry: any,
  router: HandlerRouter,
  platform: 'cloud' | 'on-premise'
): void {
  const tools = createToolDefinitions(router, platform);
  registry.registerTools(tools);
}

/**
 * Get adapted tools list for the current platform
 */
export function getAdaptedTools(platform: 'cloud' | 'on-premise'): string[] {
  if (platform === 'cloud') {
    return [...UNIVERSAL_TOOLS, ...CLOUD_ONLY_TOOLS];
  } else {
    return UNIVERSAL_TOOLS;
  }
}

/**
 * Export all tool arrays
 */
export const ADAPTED_TOOLS = {
  universal: UNIVERSAL_TOOLS,
  cloudOnly: CLOUD_ONLY_TOOLS,
};
