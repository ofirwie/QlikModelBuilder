// ===== TOOL REGISTRY =====
// Manages registration and lookup of MCP tools with platform awareness

import { logger } from '../utils/logger.js';

/**
 * Tool definition with handler function
 */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any; // Use any to match MCP SDK's flexible schema format
  handler: (args: any) => Promise<any>;
  cloudOnly?: boolean; // If true, only available on cloud platform
  onPremOnly?: boolean; // If true, only available on on-premise platform
}

/**
 * List of tools that are ONLY available on Qlik Cloud
 * Note: qlik_generate_app, qlik_insight_advisor, qlik_get_reload_info
 *       now support on-premise via QRS API and NL Query API
 */
export const CLOUD_ONLY_TOOLS = [
  // Lineage (no on-premise equivalent)
  'qlik_get_lineage',

  // Data (Cloud REST only - no QRS equivalent)
  'qlik_get_dataset_details',

  // Answers
  'qlik_answers_list_assistants',
  'qlik_answers_get_assistant',
  'qlik_answers_ask_question',

  // Alerts
  'qlik_alert_list',
  'qlik_alert_get',
  'qlik_alert_trigger',
  'qlik_alert_delete',

  // AutoML
  'qlik_automl_get_experiments',
  'qlik_automl_get_experiment',
  'qlik_automl_list_deployments',
  'qlik_automl_get_deployment',

  // Automation (Cloud API)
  'qlik_automation_list',
  'qlik_automation_get_details',
  'qlik_automation_run',
  'qlik_automation_list_runs',

  // Collections (@qlik/api)
  'qlik_list_collections',
  'qlik_get_collection',
  'qlik_list_collection_items',
  'qlik_get_favorites',
];

/**
 * Tool registry that manages tool registration and lookup
 */
export class ToolRegistry {
  private tools: Map<string, ToolDefinition>;
  private platform: 'cloud' | 'on-premise';

  constructor(platform: 'cloud' | 'on-premise') {
    this.tools = new Map();
    this.platform = platform;
  }

  /**
   * Register a single tool
   */
  registerTool(tool: ToolDefinition): void {
    // Check if tool is compatible with current platform
    if (tool.cloudOnly && this.platform !== 'cloud') {
      logger.warn('Skipping cloud-only tool on on-premise platform', {
        tool: tool.name,
      });
      return;
    }

    if (tool.onPremOnly && this.platform !== 'on-premise') {
      logger.warn('Skipping on-premise-only tool on cloud platform', {
        tool: tool.name,
      });
      return;
    }

    // Check if tool already exists
    if (this.tools.has(tool.name)) {
      logger.warn('Tool already registered, overwriting', { tool: tool.name });
    }

    this.tools.set(tool.name, tool);
    logger.debug('Tool registered', { tool: tool.name });
  }

  /**
   * Register multiple tools
   */
  registerTools(tools: ToolDefinition[]): void {
    for (const tool of tools) {
      this.registerTool(tool);
    }
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   */
  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Check if a tool is available on the current platform
   */
  isToolAvailable(name: string, platform: 'cloud' | 'on-premise'): boolean {
    const tool = this.tools.get(name);

    if (!tool) {
      return false;
    }

    // Check platform restrictions
    if (tool.cloudOnly && platform !== 'cloud') {
      return false;
    }

    if (tool.onPremOnly && platform !== 'on-premise') {
      return false;
    }

    return true;
  }

  /**
   * Get count of registered tools
   */
  getToolCount(): number {
    return this.tools.size;
  }

  /**
   * Get list of tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Check if a tool exists
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Clear all registered tools (for testing)
   */
  clear(): void {
    this.tools.clear();
    logger.debug('Tool registry cleared');
  }
}
