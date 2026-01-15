// ===== OAUTH ENHANCED API CLIENT =====
// Supports both API Key and OAuth token authentication

import { QlikConfig } from '../config/qlik-config.js';
import { logger } from './logger.js';

const log = logger.child({ service: 'OAuthApiClient' });

export interface AuthConfig {
  type: 'api-key' | 'oauth';
  apiKey?: string;
  oauthToken?: string;
  tenantUrl: string;
}

export class OAuthEnhancedApiClient {
  private config: AuthConfig;
  private requestCache: Map<string, { data: any; timestamp: number; ttl: number }>;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes default

  constructor(config: AuthConfig) {
    this.config = config;
    this.requestCache = new Map();
    this.validateConfig();
  }

  private validateConfig(): void {
    if (!this.config.tenantUrl) {
      throw new Error('Tenant URL is required');
    }

    if (this.config.type === 'api-key' && !this.config.apiKey) {
      throw new Error('API key is required for api-key authentication');
    }

    if (this.config.type === 'oauth' && !this.config.oauthToken) {
      throw new Error('OAuth token is required for OAuth authentication');
    }
  }

  /**
   * Get the appropriate authorization header based on auth type
   */
  private getAuthHeader(): string {
    if (this.config.type === 'oauth') {
      return `Bearer ${this.config.oauthToken}`;
    } else {
      return `Bearer ${this.config.apiKey}`;
    }
  }

  /**
   * Check if current auth method can access an endpoint
   */
  canAccessEndpoint(endpoint: string): boolean {
    // Endpoints that REQUIRE OAuth (user session)
    const oauthRequiredEndpoints = [
      '/reloads', // Without appId parameter
      '/governance',
      '/user-profile',
      '/personal-spaces',
      '/my-apps',
      '/consumption/user',
      '/automations/user'
    ];

    // Check if this endpoint requires OAuth
    const requiresOAuth = oauthRequiredEndpoints.some(ep =>
      endpoint.startsWith(ep) && !endpoint.includes('appId=')
    );

    if (requiresOAuth && this.config.type !== 'oauth') {
      log.warn(`Endpoint ${endpoint} requires OAuth authentication but API key is being used`);
      return false;
    }

    return true;
  }

  async makeRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any,
    options: {
      useCache?: boolean;
      cacheTTL?: number;
      timeout?: number;
      retries?: number;
      requireOAuth?: boolean; // Force OAuth requirement
    } = {}
  ): Promise<any> {
    // Check if OAuth is required for this endpoint
    if (options.requireOAuth && this.config.type !== 'oauth') {
      throw new Error(`This operation requires OAuth authentication. Current auth type: ${this.config.type}`);
    }

    // Check if we can access this endpoint
    if (!this.canAccessEndpoint(endpoint)) {
      throw new Error(`Endpoint ${endpoint} requires OAuth authentication but API key is being used`);
    }

    // Build full URL
    const url = `${this.config.tenantUrl}${endpoint}`;

    // Check cache for GET requests
    if (method === 'GET' && options.useCache !== false) {
      const cacheKey = `${method}:${endpoint}:${this.config.type}`;
      const cached = this.requestCache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < cached.ttl) {
        log.debug(`Returning cached response for ${endpoint}`);
        return cached.data;
      }
    }

    // Prepare request options
    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Authorization': this.getAuthHeader(),
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Auth-Type': this.config.type // Track which auth method was used
      },
      body: data ? JSON.stringify(data) : undefined
    };

    // Add timeout if specified
    const controller = new AbortController();
    if (options.timeout) {
      setTimeout(() => controller.abort(), options.timeout);
      fetchOptions.signal = controller.signal;
    }

    try {
      log.debug(`Making ${method} request to ${endpoint} with ${this.config.type} auth`);

      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        const errorText = await response.text();

        // Check if error is due to authentication
        if (response.status === 401 || response.status === 403) {
          if (this.config.type === 'api-key' && errorText.includes('user context')) {
            throw new Error(`This operation requires OAuth authentication (user session). API key is insufficient.`);
          }
        }

        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();

      // Cache successful GET requests
      if (method === 'GET' && options.useCache !== false) {
        const cacheKey = `${method}:${endpoint}:${this.config.type}`;
        this.requestCache.set(cacheKey, {
          data: result,
          timestamp: Date.now(),
          ttl: options.cacheTTL || this.CACHE_TTL
        });
      }

      return result;
    } catch (error: any) {
      log.debug(`Request failed for ${endpoint}: ${error.message}`);

      // Provide helpful error messages for auth issues
      if (error.message.includes('401') || error.message.includes('403')) {
        if (this.config.type === 'api-key') {
          throw new Error(
            `Authentication failed. This operation may require OAuth (user session) authentication. ` +
            `Current auth: API Key. Original error: ${error.message}`
          );
        } else {
          throw new Error(
            `OAuth token may be expired or invalid. Please refresh your session. ` +
            `Original error: ${error.message}`
          );
        }
      }

      throw error;
    }
  }

  /**
   * Switch authentication method at runtime
   */
  setAuthMethod(config: Partial<AuthConfig>): void {
    this.config = { ...this.config, ...config };
    this.validateConfig();
    // Clear cache when switching auth methods
    this.requestCache.clear();
    log.info(`Switched to ${this.config.type} authentication`);
  }

  /**
   * Get current authentication type
   */
  getAuthType(): 'api-key' | 'oauth' {
    return this.config.type;
  }

  /**
   * Check if OAuth token is available
   */
  hasOAuthToken(): boolean {
    return this.config.type === 'oauth' && !!this.config.oauthToken;
  }

  /**
   * Update OAuth token (for refresh scenarios)
   */
  updateOAuthToken(token: string): void {
    if (this.config.type === 'oauth') {
      this.config.oauthToken = token;
      this.requestCache.clear(); // Clear cache with old token
      log.info('OAuth token updated');
    }
  }
}

// ===== OPERATION REQUIREMENTS =====
export const OPERATION_AUTH_REQUIREMENTS = {
  // Operations that REQUIRE OAuth (user session)
  oauth_required: [
    'get_tenant_reload_history', // Needs user context for tenant-wide access
    'get_tenant_governance',      // User governance data
    'get_my_apps',                // Personal apps
    'get_my_spaces',              // Personal spaces
    'get_user_consumption',       // User-specific consumption
    'get_user_automations',       // User's automations
    'get_personal_alerts',        // User's alerts
    'bulk_operations',            // Tenant-wide operations
  ],

  // Operations that work with API Key
  api_key_supported: [
    'health_check',
    'get_tenant_info',
    'get_spaces_catalog',
    'get_space_items',
    'get_content_statistics',
    'search_apps',
    'search_users',
    'get_user_info',              // With specific userId
    'get_app_reload_history',     // With specific appId
    'get_app_metadata_complete',  // With specific appId
    'get_app_performance_metrics',// With specific appId
    'trigger_app_reload',         // With specific appId
    'get_reload_status',          // With specific reloadId
    'get_monthly_capacity_consumption',
    'qlik_answers_operations',    // All Q&A operations
    'automl_operations',          // All AutoML operations
  ],

  // Operations that work BETTER with OAuth but can fallback to API Key
  enhanced_with_oauth: [
    'search_apps',     // Can access more personal context
    'get_spaces',      // Can see personal spaces
    'get_datasets',    // Can see personal datasets
  ]
};

// Export helper to determine auth requirement
export function getAuthRequirement(operation: string): 'oauth' | 'api-key' | 'both' {
  if (OPERATION_AUTH_REQUIREMENTS.oauth_required.includes(operation)) {
    return 'oauth';
  }
  if (OPERATION_AUTH_REQUIREMENTS.enhanced_with_oauth.includes(operation)) {
    return 'both';
  }
  return 'api-key';
}