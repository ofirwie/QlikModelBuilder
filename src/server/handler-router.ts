// ===== HANDLER ROUTER =====
// Routes tool calls to appropriate service handlers

import { SimpleAppDeveloperService } from '../services/app-developer-service-simple.js';
import { AutomationService } from '../services/automation-service.js';
import { QlikApiAdapter } from '../adapters/base-adapter.js';
import { ApiClient } from '../utils/api-client.js';
import { CacheManager } from '../utils/cache-manager.js';
import { logger } from '../utils/logger.js';
import { formatErrorForUser } from '../utils/errors.js';
import * as reloadHandlers from '../handlers/reload-handlers.js';
import * as catalogHandlers from '../handlers/catalog-handlers.js';
import * as governanceHandlers from '../handlers/governance-handlers.js';
import * as lineageHandlers from '../handlers/lineage-handlers.js';
import * as dataHandlers from '../handlers/data-handlers.js';
import * as miscHandlers from '../handlers/misc-handlers.js';
// Qlik Answers removed - not relevant for this deployment
import * as alertsHandlers from '../handlers/alerts-handlers.js';
// AutoML removed - not relevant for this deployment
import * as searchHandlers from '../handlers/search-handlers.js';
import * as collectionsHandlers from '../handlers/collections-handlers.js';
import * as tenantHandlers from '../handlers/tenant-handlers.js';
import * as semanticHandlers from '../handlers/semantic-handlers.js';
import * as intentHandlers from '../handlers/intent-handlers.js';

/**
 * Handler router that maps tool names to service methods
 */
export class HandlerRouter {
  private appDeveloperService: SimpleAppDeveloperService;
  private automationService: AutomationService;
  private adapter: QlikApiAdapter;
  private apiClient: ApiClient;
  private cacheManager: CacheManager;
  private tenantUrl: string;
  private platform: 'cloud' | 'on-premise';

  constructor(
    appDeveloperService: SimpleAppDeveloperService,
    automationService: AutomationService,
    adapter: QlikApiAdapter,
    apiClient: ApiClient,
    cacheManager: CacheManager,
    tenantUrl: string,
    platform: 'cloud' | 'on-premise' = 'cloud'
  ) {
    this.appDeveloperService = appDeveloperService;
    this.automationService = automationService;
    this.adapter = adapter;
    this.apiClient = apiClient;
    this.cacheManager = cacheManager;
    this.tenantUrl = tenantUrl;
    this.platform = platform;
  }

  /**
   * Route a tool call to the appropriate handler
   */
  async route(toolName: string, args: any): Promise<any> {
    try {
      switch (toolName) {
        // ===== TENANT MANAGEMENT TOOLS =====
        case 'qlik_list_tenants':
          return await tenantHandlers.handleListTenants();
        case 'qlik_switch_tenant':
          return await tenantHandlers.handleSwitchTenant(args);
        case 'qlik_get_active_tenant':
          return await tenantHandlers.handleGetActiveTenant();

        // ===== APP TOOLS =====
        case 'qlik_generate_app':
          return await this.handleGenerateApp(args);

        // ===== AUTOMATION TOOLS =====
        case 'qlik_automation_list':
          return await this.handleAutomationList(args);

        case 'qlik_automation_get_details':
          return await this.handleAutomationGetDetails(args);

        case 'qlik_automation_run':
          return await this.handleAutomationRun(args);

        case 'qlik_automation_list_runs':
          return await this.handleAutomationListRuns(args);

        // ===== RELOAD TOOLS =====
        case 'qlik_trigger_app_reload':
          return await this.handleReloadTool('trigger_app_reload', args);

        case 'qlik_get_reload_status':
          return await this.handleReloadTool('get_reload_status', args);

        case 'qlik_cancel_reload':
          return await this.handleReloadTool('cancel_reload', args);

        // ===== UNIFIED SEARCH TOOL =====
        case 'qlik_search':
          return await searchHandlers.handleUnifiedSearch(
            args,
            this.apiClient,
            this.cacheManager,
            this.platform,
            this.tenantUrl
          );

        // ===== CATALOG TOOLS =====
        case 'qlik_get_spaces_catalog':
          return await this.handleCatalogTool('get_spaces_catalog', args);

        // ===== GOVERNANCE TOOLS =====
        case 'qlik_get_tenant_info':
          return await this.handleGovernanceTool('handleGetTenantInfo', args);
        case 'qlik_get_user_info':
          return await this.handleGovernanceTool('handleGetUserInfo', args);
        case 'qlik_search_users':
          return await this.handleGovernanceTool('handleSearchUsers', args);
        case 'qlik_health_check':
          return await this.handleGovernanceTool('handleHealthCheck', args);
        case 'qlik_get_license_info':
          return await this.handleGovernanceTool('handleGetLicenseInfo', args);

        // ===== LINEAGE TOOLS (Cloud-only) =====
        case 'qlik_get_lineage':
          return await this.handleLineageTool('handleGetLineage', args);

        // ===== DATA TOOLS =====
        case 'qlik_get_dataset_details':
          return await this.handleDataTool('handleGetDatasetDetails', args);
        case 'qlik_apply_selections':
          return await this.handleDataTool('handleApplySelections', args);
        case 'qlik_clear_selections':
          return await this.handleDataTool('handleClearSelections', args);
        case 'qlik_get_current_selections':
          return await this.handleDataTool('handleGetCurrentSelections', args);
        case 'qlik_get_available_fields':
          return await this.handleDataTool('handleGetAvailableFields', args);

        // ===== NEW DATA TOOLS - Combined =====
        case 'qlik_get_app_metadata':
          return await this.handleDataTool('handleGetAppMetadata', args);
        case 'qlik_get_object_data':
          return await this.handleDataTool('handleGetObjectData', args);
        case 'qlik_create_hypercube':
          return await this.handleDataTool('handleCreateHypercube', args);
        case 'qlik_get_app_sheets':
          return await this.handleDataTool('handleGetAppSheets', args);
        case 'qlik_get_sheet_objects':
          return await this.handleDataTool('handleGetSheetObjects', args);
        case 'qlik_get_field_values':
          return await this.handleDataTool('handleGetFieldValues', args);
        case 'qlik_get_app_script':
          return await this.handleDataTool('handleGetAppScript', args);
        case 'qlik_evaluate_expression':
          return await this.handleDataTool('handleEvaluateExpression', args);

        // ===== FIELD AND MASTER ITEMS MAPPING =====
        case 'qlik_map_fields':
          return await this.handleDataTool('handleMapFields', args);
        case 'qlik_map_master_dimensions':
          return await this.handleDataTool('handleMapMasterDimensions', args);
        case 'qlik_map_master_measures':
          return await this.handleDataTool('handleMapMasterMeasures', args);
        case 'qlik_map_all':
          return await this.handleDataTool('handleMapAll', args);

        // ===== VISUALIZATION CREATION TOOLS =====
        case 'qlik_create_sheet':
          return await this.handleDataTool('handleCreateSheet', args);
        case 'qlik_create_visualization':
          return await this.handleDataTool('handleCreateVisualization', args);
        case 'qlik_create_ai_cache':
          return await this.handleDataTool('handleCreateAICache', args);
        case 'qlik_get_ai_cache_data':
          return await this.handleDataTool('handleGetAICacheData', args);
        case 'qlik_get_existing_kpis':
          return await this.handleDataTool('handleGetExistingKpis', args);
        case 'qlik_create_dashboard_from_analysis':
          return await this.handleDataTool('handleCreateDashboardFromAnalysis', args);

        // ===== MISC TOOLS =====
        case 'qlik_insight_advisor':
          return await this.handleMiscTool('handleInsightAdvisor', args);
        case 'qlik_get_reload_info':
          return await this.handleMiscTool('handleGetReloadInfo', args);

        // Qlik Answers tools removed - not relevant for this deployment

        // ===== QLIK ALERTS TOOLS =====
        case 'qlik_alert_list':
          return await this.handleAlertsTool('handleAlertList', args);
        case 'qlik_alert_get':
          return await this.handleAlertsTool('handleAlertGet', args);
        case 'qlik_alert_trigger':
          return await this.handleAlertsTool('handleAlertTrigger', args);
        case 'qlik_alert_delete':
          return await this.handleAlertsTool('handleAlertDelete', args);

        // AutoML tools removed - not relevant for this deployment

        // ===== COLLECTIONS TOOLS (Cloud-only, uses @qlik/api) =====
        case 'qlik_list_collections':
          return await collectionsHandlers.handleListCollections(args);
        case 'qlik_get_collection':
          return await collectionsHandlers.handleGetCollection(args);
        case 'qlik_list_collection_items':
          return await collectionsHandlers.handleListCollectionItems(args);
        case 'qlik_get_favorites':
          return await collectionsHandlers.handleGetFavorites();

        // ===== SEMANTIC LAYER TOOLS (Local knowledge base) =====
        case 'qlik_get_domain_schema':
          return await semanticHandlers.handleGetDomainSchema(args);
        case 'qlik_get_measure_type':
          return await semanticHandlers.handleGetMeasureType(args);
        case 'qlik_get_drill_options':
          return await semanticHandlers.handleGetDrillOptions(args);
        case 'qlik_translate_hebrew':
          return await semanticHandlers.handleTranslateHebrew(args);

        // ===== INTENT RECOGNITION TOOLS (V4) =====
        case 'qlik_recognize_intent':
          return await intentHandlers.handleRecognizeIntent({ params: args });
        case 'qlik_get_conversation_context':
          return await intentHandlers.handleGetConversationContext({ params: args });
        case 'qlik_set_user_context':
          return await intentHandlers.handleSetUserContext({ params: args });
        case 'qlik_compose_response':
          return await intentHandlers.handleComposeResponse({ params: args });
        case 'qlik_detect_insights':
          return await intentHandlers.handleDetectInsights({ params: args });
        case 'qlik_suggest_actions':
          return await intentHandlers.handleSuggestActions({ params: args });
        case 'qlik_add_to_history':
          return await intentHandlers.handleAddToHistory({ params: args });

        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    } catch (error) {
      return {
        success: false,
        error: formatErrorForUser(error),
      };
    }
  }

  // ===== RELOAD TOOL HANDLER =====

  private async handleReloadTool(toolName: string, args: any): Promise<any> {
    const handler = (reloadHandlers as any)[`handle${this.toCamelCase(toolName)}`];
    if (!handler) {
      throw new Error(`Reload handler not found: ${toolName}`);
    }

    // Pass platform and tenantUrl for on-premise support
    const result = await handler(this.apiClient, this.cacheManager, args, this.platform, this.tenantUrl);
    return result;
  }

  // ===== GOVERNANCE TOOL HANDLER =====

  private async handleGovernanceTool(handlerName: string, args: any): Promise<any> {
    const handler = (governanceHandlers as any)[handlerName];
    if (!handler) {
      throw new Error(`Governance handler not found: ${handlerName}`);
    }

    // Pass platform and tenantUrl for on-premise support
    const result = await handler(this.apiClient, this.cacheManager, args, this.platform, this.tenantUrl);
    return result;
  }

  // ===== LINEAGE TOOL HANDLER (Cloud-only) =====

  private async handleLineageTool(handlerName: string, args: any): Promise<any> {
    const handler = (lineageHandlers as any)[handlerName];
    if (!handler) {
      throw new Error(`Lineage handler not found: ${handlerName}`);
    }

    // Pass platform for Cloud-only check
    const result = await handler(this.apiClient, this.cacheManager, args, this.platform, this.tenantUrl);
    return result;
  }

  // ===== CATALOG TOOL HANDLER =====

  private async handleCatalogTool(toolName: string, args: any): Promise<any> {
    const handler = (catalogHandlers as any)[`handle${this.toCamelCase(toolName)}`];
    if (!handler) {
      throw new Error(`Catalog handler not found: ${toolName}`);
    }

    // Pass platform and tenantUrl for on-premise support
    const result = await handler(this.apiClient, this.cacheManager, args, this.platform, this.tenantUrl);
    return result;
  }

  // ===== DATA TOOL HANDLER =====

  private async handleDataTool(handlerName: string, args: any): Promise<any> {
    const handler = (dataHandlers as any)[handlerName];
    if (!handler) {
      throw new Error(`Data handler not found: ${handlerName}`);
    }

    // Pass platform and tenantUrl for platform-specific behavior
    const result = await handler(this.apiClient, this.cacheManager, args, this.platform, this.tenantUrl);
    return result;
  }

  // ===== MISC TOOL HANDLER =====

  private async handleMiscTool(handlerName: string, args: any): Promise<any> {
    const handler = (miscHandlers as any)[handlerName];
    if (!handler) {
      throw new Error(`Misc handler not found: ${handlerName}`);
    }

    // Pass platform and tenantUrl for platform-specific behavior
    const result = await handler(this.apiClient, this.cacheManager, args, this.platform, this.tenantUrl);
    return result;
  }

  // Qlik Answers handler removed - not relevant for this deployment

  // ===== ALERTS TOOL HANDLER =====

  private async handleAlertsTool(handlerName: string, args: any): Promise<any> {
    const handler = (alertsHandlers as any)[handlerName];
    if (!handler) {
      throw new Error(`Alerts handler not found: ${handlerName}`);
    }
    const result = await handler(this.apiClient, this.cacheManager, args, this.platform, this.tenantUrl);
    return result;
  }

  // AutoML handler removed - not relevant for this deployment

  // ===== GENERIC TOOL HANDLER =====

  private async handleGenericTool(handlers: any, handlerName: string, args: any): Promise<any> {
    const handler = handlers[handlerName];
    if (!handler) {
      throw new Error(`Handler not found: ${handlerName}`);
    }

    const result = await handler(this.apiClient, this.cacheManager, args);
    return result;
  }

  // ===== UTILITY =====

  private toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
      .replace(/^([a-z])/, (_, letter) => letter.toUpperCase());
  }

  // ===== APP GENERATION HANDLERS =====

  private async handleGenerateApp(args: any): Promise<any> {
    const isUpdate = !!args.appId;
    const isListConnections = !!args.listConnections;
    const isListOdbcDsns = !!args.listOdbcDsns;

    logger.info('Handling generate_app', {
      mode: isUpdate ? 'update' : 'create',
      hasLoadScript: !!args.loadScript,
      listConnections: isListConnections,
      listOdbcDsns: isListOdbcDsns,
    });

    // Pass all parameters including on-premise discovery features
    const result = await this.appDeveloperService.createOrUpdateApp({
      appName: args.appName,
      appId: args.appId,
      loadScript: args.loadScript,
      dataConnection: args.dataConnection,
      listConnections: args.listConnections,
      listOdbcDsns: args.listOdbcDsns,
    });

    return result;
  }

  // ===== AUTOMATION HANDLERS =====

  private async handleAutomationList(args: any): Promise<any> {
    logger.info('Handling automation_list');

    const automations = await this.automationService.listAutomations({
      filter: args.filter,
      sort: args.sort,
      limit: args.limit,
      fields: args.fields,
    });

    return {
      success: true,
      count: automations.length,
      automations,
    };
  }

  private async handleAutomationGetDetails(args: any): Promise<any> {
    logger.info('Handling automation_get_details', {
      automationId: args.automationId,
    });

    const automation = await this.automationService.getAutomationDetails(
      args.automationId
    );

    return {
      success: true,
      automation,
    };
  }

  private async handleAutomationListRuns(args: any): Promise<any> {
    logger.info('Handling automation_list_runs', {
      automationId: args.automationId,
    });

    const runs = await this.automationService.listAutomationRuns(
      args.automationId,
      {
        filter: args.filter,
        sort: args.sort,
        limit: args.limit,
        fields: args.fields,
      }
    );

    return {
      success: true,
      count: runs.length,
      runs,
    };
  }

  private async handleAutomationRun(args: any): Promise<any> {
    logger.info('Handling automation_run', {
      automationId: args.automationId,
    });

    const run = await this.automationService.runAutomation(args.automationId);

    return {
      success: true,
      run,
    };
  }

}
