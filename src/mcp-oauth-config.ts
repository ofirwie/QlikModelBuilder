// ===== MCP SERVER OAUTH CONFIGURATION =====

import { logger } from './utils/logger.js';

export interface MCPAuthConfig {
  // Authentication method
  authMethod: 'api-key' | 'oauth' | 'hybrid';

  // API Key (for api-key or hybrid mode)
  apiKey?: string;

  // OAuth Token (for oauth or hybrid mode)
  oauthToken?: string;

  // OAuth Refresh Token (optional)
  refreshToken?: string;

  // OAuth Token Expiry (optional)
  tokenExpiry?: Date;

  // Tenant URL
  tenantUrl: string;

  // User context (from OAuth)
  userContext?: {
    userId: string;
    email: string;
    name: string;
    tenantId: string;
    roles?: string[];
  };
}

/**
 * Method-level authentication requirements
 */
export const MCP_METHOD_AUTH_REQUIREMENTS: Record<string, {
  minAuth: 'api-key' | 'oauth';
  preferred: 'api-key' | 'oauth';
  reason: string;
}> = {
  // ===== SYSTEM OPERATIONS =====
  'health_check': {
    minAuth: 'api-key',
    preferred: 'api-key',
    reason: 'System health check only needs basic auth'
  },
  'get_tenant_info': {
    minAuth: 'api-key',
    preferred: 'api-key',
    reason: 'Tenant info available with API key'
  },

  // ===== SPACE OPERATIONS =====
  'get_spaces_catalog': {
    minAuth: 'api-key',
    preferred: 'oauth',
    reason: 'OAuth provides access to personal spaces'
  },
  'get_space_items': {
    minAuth: 'api-key',
    preferred: 'oauth',
    reason: 'OAuth can access private space items'
  },

  // ===== SEARCH OPERATIONS =====
  'search_apps': {
    minAuth: 'api-key',
    preferred: 'oauth',
    reason: 'OAuth provides personalized search results'
  },
  'search_users': {
    minAuth: 'api-key',
    preferred: 'api-key',
    reason: 'User search works with API key'
  },

  // ===== RELOAD OPERATIONS (OAuth Required) =====
  'get_tenant_reload_history': {
    minAuth: 'oauth',
    preferred: 'oauth',
    reason: 'Requires OAuth for tenant-wide reload access without specific appId'
  },
  'get_app_reload_history': {
    minAuth: 'api-key',
    preferred: 'api-key',
    reason: 'Works with API key when appId is provided'
  },
  'trigger_app_reload': {
    minAuth: 'api-key',
    preferred: 'oauth',
    reason: 'OAuth ensures proper reload permissions'
  },
  'trigger_bulk_reload': {
    minAuth: 'oauth',
    preferred: 'oauth',
    reason: 'Bulk operations require user session'
  },
  'get_reload_status': {
    minAuth: 'api-key',
    preferred: 'api-key',
    reason: 'Status check works with API key'
  },
  'get_reload_info': {
    minAuth: 'api-key',
    preferred: 'api-key',
    reason: 'Info retrieval works with API key when appId provided'
  },

  // ===== GOVERNANCE (OAuth Required) =====
  'get_tenant_governance': {
    minAuth: 'oauth',
    preferred: 'oauth',
    reason: 'Governance data requires user session and permissions'
  },

  // ===== APP OPERATIONS =====
  'get_app_metadata_complete': {
    minAuth: 'api-key',
    preferred: 'oauth',
    reason: 'OAuth provides ownership and permission details'
  },
  'get_app_performance_metrics': {
    minAuth: 'api-key',
    preferred: 'api-key',
    reason: 'Performance metrics available with API key'
  },
  'analyze_data_model': {
    minAuth: 'api-key',
    preferred: 'api-key',
    reason: 'Data model analysis works with API key'
  },
  'get_object_data': {
    minAuth: 'api-key',
    preferred: 'oauth',
    reason: 'OAuth may provide better data access'
  },
  'generate_app': {
    minAuth: 'oauth',
    preferred: 'oauth',
    reason: 'App creation requires user context'
  },

  // ===== DATA OPERATIONS =====
  'get_dataset_details': {
    minAuth: 'api-key',
    preferred: 'oauth',
    reason: 'OAuth provides access to private datasets'
  },
  'get_content_statistics': {
    minAuth: 'api-key',
    preferred: 'api-key',
    reason: 'Statistics available with API key'
  },

  // ===== CAPACITY & CONSUMPTION =====
  'get_monthly_capacity_consumption': {
    minAuth: 'api-key',
    preferred: 'api-key',
    reason: 'Capacity data available with API key'
  },
  'get_latest_evaluation_for_app': {
    minAuth: 'api-key',
    preferred: 'api-key',
    reason: 'Evaluation data available with API key'
  },

  // ===== NATURAL LANGUAGE =====
  'intelligent_nl_question': {
    minAuth: 'api-key',
    preferred: 'oauth',
    reason: 'OAuth provides personalized context for better answers'
  },

  // ===== QLIK ANSWERS =====
  'qlik_answers_list_assistants': {
    minAuth: 'api-key',
    preferred: 'oauth',
    reason: 'OAuth shows personal assistants'
  },
  'qlik_answers_create_assistant': {
    minAuth: 'oauth',
    preferred: 'oauth',
    reason: 'Assistant creation requires user context'
  },
  'qlik_answers_ask_question': {
    minAuth: 'api-key',
    preferred: 'oauth',
    reason: 'OAuth provides better context for answers'
  },
  'qlik_answers_list_threads': {
    minAuth: 'oauth',
    preferred: 'oauth',
    reason: 'Thread access requires user session'
  },
  'qlik_answers_get_thread': {
    minAuth: 'oauth',
    preferred: 'oauth',
    reason: 'Thread details require user session'
  },
  'qlik_answers_delete_thread': {
    minAuth: 'oauth',
    preferred: 'oauth',
    reason: 'Thread deletion requires ownership'
  },
  'qlik_answers_list_knowledge_bases': {
    minAuth: 'api-key',
    preferred: 'oauth',
    reason: 'OAuth shows personal knowledge bases'
  },
  'qlik_answers_get_assistant': {
    minAuth: 'api-key',
    preferred: 'api-key',
    reason: 'Assistant info available with API key'
  },
  'qlik_answers_delete_assistant': {
    minAuth: 'oauth',
    preferred: 'oauth',
    reason: 'Deletion requires ownership verification'
  },

  // ===== AUTOML =====
  'automl_get_experiments': {
    minAuth: 'api-key',
    preferred: 'oauth',
    reason: 'OAuth shows personal experiments'
  },
  'automl_create_experiment': {
    minAuth: 'oauth',
    preferred: 'oauth',
    reason: 'Experiment creation requires user context'
  },
  'automl_analyze_dataset': {
    minAuth: 'api-key',
    preferred: 'oauth',
    reason: 'OAuth may provide better dataset access'
  },

  // ===== ALERTS =====
  'qlik_alert_list': {
    minAuth: 'oauth',
    preferred: 'oauth',
    reason: 'Personal alerts require user session'
  },
  'qlik_alert_create_from_prompt': {
    minAuth: 'oauth',
    preferred: 'oauth',
    reason: 'Alert creation requires user context'
  },
  'qlik_alert_trigger': {
    minAuth: 'oauth',
    preferred: 'oauth',
    reason: 'Alert triggering requires ownership'
  },

  // ===== USER OPERATIONS =====
  'get_user_info': {
    minAuth: 'api-key',
    preferred: 'api-key',
    reason: 'User info available with API key when userId provided'
  }
};

/**
 * Check if a method can be executed with current auth
 */
export function canExecuteMethod(
  method: string,
  authType: 'api-key' | 'oauth'
): { allowed: boolean; reason?: string } {
  const requirements = MCP_METHOD_AUTH_REQUIREMENTS[method];

  if (!requirements) {
    return {
      allowed: true,
      reason: 'Method has no specific auth requirements'
    };
  }

  if (requirements.minAuth === 'oauth' && authType === 'api-key') {
    return {
      allowed: false,
      reason: `Method '${method}' requires OAuth authentication. ${requirements.reason}`
    };
  }

  if (authType !== requirements.preferred) {
    logger.warn(
      `Method '${method}' prefers ${requirements.preferred} auth but using ${authType}. ` +
      `${requirements.reason}`
    );
  }

  return { allowed: true };
}

/**
 * Get authentication summary for all methods
 */
export function getAuthenticationSummary(): {
  oauthOnly: string[];
  apiKeySupported: string[];
  preferOAuth: string[];
} {
  const oauthOnly: string[] = [];
  const apiKeySupported: string[] = [];
  const preferOAuth: string[] = [];

  for (const [method, req] of Object.entries(MCP_METHOD_AUTH_REQUIREMENTS)) {
    if (req.minAuth === 'oauth') {
      oauthOnly.push(method);
    } else {
      apiKeySupported.push(method);
      if (req.preferred === 'oauth') {
        preferOAuth.push(method);
      }
    }
  }

  return {
    oauthOnly,
    apiKeySupported,
    preferOAuth
  };
}

/**
 * Environment variable names for auth configuration
 */
export const AUTH_ENV_VARS = {
  // API Key authentication
  QLIK_API_KEY: 'QLIK_API_KEY',

  // OAuth authentication
  QLIK_OAUTH_TOKEN: 'QLIK_OAUTH_TOKEN',
  QLIK_OAUTH_REFRESH_TOKEN: 'QLIK_OAUTH_REFRESH_TOKEN',

  // Tenant URL
  QLIK_TENANT_URL: 'QLIK_TENANT_URL',

  // Auth method preference
  QLIK_AUTH_METHOD: 'QLIK_AUTH_METHOD', // 'api-key' | 'oauth' | 'hybrid'
};

/**
 * Load authentication configuration from environment
 */
export function loadAuthConfig(): MCPAuthConfig {
  const authMethod = (process.env[AUTH_ENV_VARS.QLIK_AUTH_METHOD] as any) || 'api-key';
  const tenantUrl = process.env[AUTH_ENV_VARS.QLIK_TENANT_URL];

  if (!tenantUrl) {
    throw new Error('QLIK_TENANT_URL environment variable is required');
  }

  const config: MCPAuthConfig = {
    authMethod,
    tenantUrl
  };

  // Load API key if available
  if (process.env[AUTH_ENV_VARS.QLIK_API_KEY]) {
    config.apiKey = process.env[AUTH_ENV_VARS.QLIK_API_KEY];
  }

  // Load OAuth tokens if available
  if (process.env[AUTH_ENV_VARS.QLIK_OAUTH_TOKEN]) {
    config.oauthToken = process.env[AUTH_ENV_VARS.QLIK_OAUTH_TOKEN];
    config.authMethod = config.apiKey ? 'hybrid' : 'oauth';
  }

  if (process.env[AUTH_ENV_VARS.QLIK_OAUTH_REFRESH_TOKEN]) {
    config.refreshToken = process.env[AUTH_ENV_VARS.QLIK_OAUTH_REFRESH_TOKEN];
  }

  // Validate configuration
  if (authMethod === 'api-key' && !config.apiKey) {
    throw new Error('QLIK_API_KEY environment variable is required for api-key authentication');
  }

  if (authMethod === 'oauth' && !config.oauthToken) {
    throw new Error('QLIK_OAUTH_TOKEN environment variable is required for OAuth authentication');
  }

  return config;
}