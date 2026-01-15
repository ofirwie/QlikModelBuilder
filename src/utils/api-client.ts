// ===== REBUILT API CLIENT WITH FIXED MCP LOGGING AND LICENSE SUPPORT =====
// Supports both Qlik Cloud (Bearer token) and On-Premise (Certificate auth)
// Updated: Dynamic tenant support - uses getActiveTenant() for multi-tenant switching

import { QlikConfig } from '../config/qlik-config.js';
import { getActiveTenant } from '../config/tenants.js';
import { logger } from './logger.js';
import { RateLimiter } from './rate-limiter.js';

const log = logger.child({ service: 'ApiClient' });
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';

// Define error types properly
class McpError extends Error {
  code: string;
  
  constructor(code: string, message: string) {
    super(message);
    this.name = 'McpError';
    this.code = code;
  }
}

const ErrorCode = {
  InvalidParams: 'INVALID_PARAMS',
  InternalError: 'INTERNAL_ERROR'
};

/**
 * Sanitize response text by removing HTML, base64 data, and other noise
 * This prevents bloated error messages and logs
 */
function sanitizeResponseText(text: string, maxLength: number = 500): string {
  if (!text || typeof text !== 'string') return '';

  // Check if it's HTML
  if (text.includes('<!DOCTYPE') || text.includes('<html') || text.includes('<HTML')) {
    // Try to extract meaningful error message from HTML
    const titleMatch = text.match(/<title>([^<]+)<\/title>/i);
    const h1Match = text.match(/<h1>([^<]+)<\/h1>/i);
    const errorMatch = text.match(/error[:\s]*([^<\n]+)/i);

    if (titleMatch || h1Match || errorMatch) {
      return `HTML Error: ${titleMatch?.[1] || h1Match?.[1] || errorMatch?.[1]}`.substring(0, maxLength);
    }
    return 'HTML error page returned (content stripped)';
  }

  // Remove base64 data
  let sanitized = text.replace(/data:[^;]+;base64,[A-Za-z0-9+/=]+/g, '[base64-removed]');

  // Remove very long strings that look like encoded data
  sanitized = sanitized.replace(/[A-Za-z0-9+/=]{200,}/g, '[long-data-removed]');

  // Truncate if still too long
  if (sanitized.length > maxLength) {
    return sanitized.substring(0, maxLength) + '... [truncated]';
  }

  return sanitized;
}

export interface ResolvedUser {
  qlikUserId: string;
  auth0Subject: string;
  displayName: string;
  email: string;
  status: string;
}

// ===== LICENSE INTERFACE =====
export interface LicenseOverview {
  licenseNumber: string;
  licenseKey: string;
  valid: string;  // "2024-02-05/2026-03-02"
  status: string;
  trial: boolean;
  product: string;
  allotments: Array<{
    name: string;
    usageClass: string;
    units: number;
    unitsUsed: number;
    overage: number;
  }>;
  parameters: Array<{
    name: string;
    valid: string;
    values: {
      quantity?: number;
      title?: string;
      scope?: string;
      visible?: boolean;
      action?: string;
      periodType?: string;
      resourceType?: string;
      unit?: string;
      value?: string;
      toggle?: boolean;
      unlimited?: boolean;
    };
  }>;
}

// Extended config for certificate auth
export interface ExtendedQlikConfig extends QlikConfig {
  certPath?: string;      // Path to client certificate (client.pem)
  keyPath?: string;       // Path to client key (client_key.pem)
  rootCertPath?: string;  // Path to root certificate (root.pem)
  userDirectory?: string; // User directory for X-Qlik-User header
  userId?: string;        // User ID for X-Qlik-User header
}

export class ApiClient {
  private config: ExtendedQlikConfig;
  private requestCache: Map<string, { data: any; timestamp: number; ttl: number }>;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes default

  // Rate limiter for controlling API request rate
  private rateLimiter: RateLimiter;

  // REBUILT: Comprehensive user resolution caching
  private userCache: Map<string, any> = new Map();                    // Full user objects
  private auth0ToQlikIdCache: Map<string, string> = new Map();        // Auth0 → Qlik User ID mapping
  private qlikIdToAuth0Cache: Map<string, string> = new Map();        // Qlik User ID → Auth0 subject
  private displayNameCache: Map<string, string> = new Map();         // Any ID → Display name
  private emailCache: Map<string, string> = new Map();               // Any ID → Email
  private allUsersFetched: boolean = false;                          // Track if we've done full user fetch
  private lastFullUserFetch: number = 0;                             // Timestamp of last full fetch
  private readonly USER_CACHE_TTL = 30 * 60 * 1000;                  // 30 minutes for user cache

  // QRS certificate authentication
  private httpsAgent: https.Agent | null = null;
  private qrsXrfKey: string = '';

  constructor(config: ExtendedQlikConfig) {
    this.config = config;
    this.requestCache = new Map();
    this.rateLimiter = new RateLimiter();
    this.validateConfig();
    this.initializeCertificateAuth();
  }

  /**
   * Initialize certificate authentication for on-premise QRS API
   *
   * QLIK_CERT_PATH must point to a folder containing:
   * - client.pem (client certificate)
   * - client_key.pem (client key)
   * - root.pem (root certificate, optional)
   */
  private initializeCertificateAuth(): void {
    if (!this.config.certPath) {
      return; // No certificate configured - Cloud mode only
    }

    try {
      // Generate XRF key (16 random alphanumeric chars)
      this.qrsXrfKey = this.generateXrfKey();

      const certDir = this.config.certPath;

      // Validate certPath is a directory
      if (!fs.existsSync(certDir)) {
        log.debug(` Certificate folder not found: ${certDir}`);
        log.debug(` Set QLIK_CERT_PATH to the folder containing exported certificates`);
        return;
      }

      const certDirStat = fs.statSync(certDir);
      if (!certDirStat.isDirectory()) {
        log.debug(` QLIK_CERT_PATH must be a folder, not a file: ${certDir}`);
        log.debug(` Example: QLIK_CERT_PATH=C:\\Qlik\\Certs\\`);
        return;
      }

      // Build certificate paths
      const clientCertPath = path.join(certDir, 'client.pem');
      const clientKeyPath = path.join(certDir, 'client_key.pem');
      const rootCertPath = path.join(certDir, 'root.pem');

      // Validate required files exist
      if (!fs.existsSync(clientCertPath)) {
        log.debug(` client.pem not found in: ${certDir}`);
        log.debug(` Export certificates from QMC > Certificates`);
        return;
      }
      if (!fs.existsSync(clientKeyPath)) {
        log.debug(` client_key.pem not found in: ${certDir}`);
        log.debug(` Export certificates from QMC > Certificates`);
        return;
      }

      // Read certificates
      const cert = fs.readFileSync(clientCertPath);
      const key = fs.readFileSync(clientKeyPath);
      const ca = fs.existsSync(rootCertPath) ? fs.readFileSync(rootCertPath) : undefined;

      // Create HTTPS agent with certificates
      this.httpsAgent = new https.Agent({
        cert: cert,
        key: key,
        ca: ca,
        rejectUnauthorized: false // Allow self-signed certs
      });

      log.debug(` Certificate auth initialized for QRS API`);
      log.debug(` User: ${this.config.userDirectory}\\${this.config.userId}`);
    } catch (error) {
      log.debug(` Failed to initialize certificate auth:`, error);
    }
  }

  /**
   * Generate XRF key for QRS API (16 alphanumeric characters)
   */
  private generateXrfKey(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 16; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Check if certificate auth is available for QRS
   */
  hasCertificateAuth(): boolean {
    return this.httpsAgent !== null;
  }

  private validateConfig(): void {
    if (!this.config.tenantUrl) {
      throw new Error('Valid tenant URL is required');
    }
    // Note: apiKey is optional for certificate auth (on-premise)
  }

  /**
   * Check if this is a QRS (on-premise) endpoint
   * QRS endpoints start with /qrs/
   */
  private isQrsEndpoint(endpoint: string): boolean {
    return endpoint.startsWith('/qrs/') || endpoint.startsWith('qrs/');
  }

  /**
   * Throw informative error for QRS endpoints when certificates not configured
   */
  private throwQrsNotSupportedError(endpoint: string): never {
    throw new Error(
      `On-premise QRS API requires certificate authentication: ${endpoint}\n\n` +
      `Configure the following environment variables:\n` +
      `  QLIK_CERT_PATH: Path to exported certificates folder\n` +
      `  QLIK_USER_DIRECTORY: Windows domain (e.g., "DOMAIN")\n` +
      `  QLIK_USER_ID: Username (e.g., "administrator")\n\n` +
      `Certificate folder should contain:\n` +
      `  - client.pem (client certificate)\n` +
      `  - client_key.pem (client key)\n` +
      `  - root.pem (root certificate)\n\n` +
      `Export from: Qlik Management Console > Certificates`
    );
  }

  /**
   * Make QRS API request with certificate authentication
   */
  private async makeQrsRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any
  ): Promise<any> {
    if (!this.httpsAgent) {
      this.throwQrsNotSupportedError(endpoint);
    }

    // Add xrfkey to endpoint
    const separator = endpoint.includes('?') ? '&' : '?';
    const urlWithXrf = `${this.config.tenantUrl}${endpoint}${separator}xrfkey=${this.qrsXrfKey}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Qlik-Xrfkey': this.qrsXrfKey,
      'X-Qlik-User': `UserDirectory=${this.config.userDirectory || 'INTERNAL'}; UserId=${this.config.userId || 'sa_api'}`
    };

    log.debug(`[QRS] ${method} ${urlWithXrf}`);

    return new Promise((resolve, reject) => {
      const url = new URL(urlWithXrf);

      const options: https.RequestOptions = {
        hostname: url.hostname,
        port: url.port || 4242, // QRS default port
        path: url.pathname + url.search,
        method: method,
        headers: headers,
        agent: this.httpsAgent!
      };

      const req = https.request(options, (res) => {
        let body = '';

        res.on('data', (chunk) => {
          body += chunk;
        });

        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const result = body ? JSON.parse(body) : { success: true };
              log.debug(`[QRS] ✓ ${res.statusCode} - ${Array.isArray(result) ? result.length + ' items' : 'OK'}`);
              resolve(result);
            } catch {
              // Sanitize non-JSON response
              resolve({ success: true, response: sanitizeResponseText(body, 1000) });
            }
          } else {
            const sanitizedBody = sanitizeResponseText(body, 300);
            log.debug(`[QRS] ✗ ${res.statusCode} - ${sanitizedBody}`);
            reject(new Error(`QRS API error: ${res.statusCode} - ${sanitizedBody}`));
          }
        });
      });

      req.on('error', (error) => {
        log.debug(`[QRS] Request error:`, error.message);
        reject(error);
      });

      if (data) {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }

  // ===== CORE REQUEST HANDLING =====

  async makeRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any,
    options: {
      useCache?: boolean;
      cacheTTL?: number;
      timeout?: number;
      retries?: number;
    } = {}
  ): Promise<any> {
    // Route QRS (on-premise) endpoints to certificate-based handler
    if (this.isQrsEndpoint(endpoint)) {
      return this.makeQrsRequest(endpoint, method, data);
    }

    // Get current active tenant (supports dynamic tenant switching)
    const activeTenant = getActiveTenant();
    const tenantUrl = activeTenant.url;
    const apiKey = activeTenant.apiKey;

    // Build full URL using active tenant
    const url = `${tenantUrl}${endpoint}`;
    
    // Check cache for GET requests
    if (method === 'GET' && options.useCache !== false) {
      const cacheKey = `${method}:${endpoint}`;
      const cached = this.requestCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < cached.ttl) {
        log.debug(`📦 Returning cached response for ${endpoint}`);
        return cached.data;
      }
    }
    
    // Prepare request options (use dynamic apiKey from active tenant)
    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: data ? JSON.stringify(data) : undefined
    };
    
    // Add timeout if specified
    const controller = new AbortController();
    if (options.timeout) {
      setTimeout(() => controller.abort(), options.timeout);
      fetchOptions.signal = controller.signal;
    }
    
    // Use rate limiter to control request rate and handle 429 errors
    try {
      const result = await this.rateLimiter.execute(async () => {
      log.debug(`🔄 Making ${method} request to ${url}`);

      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        const errorText = await response.text();
        const sanitizedError = sanitizeResponseText(errorText, 300);

        // Create error with status for rate limiter to detect
        const error = new Error(`API request failed: ${response.status} ${response.statusText} - ${sanitizedError}`);
        (error as any).status = response.status;
        // Extract retry-after header if present
        const retryAfter = response.headers.get('retry-after');
        if (retryAfter) {
          (error as any).headers = { 'retry-after': retryAfter };
        }
        throw error;
      }

      // Handle empty responses (204 No Content, or empty body)
      const contentLength = response.headers.get('content-length');
      const contentType = response.headers.get('content-type');

      let result: any;
      if (response.status === 204 || contentLength === '0') {
        // No content - return empty success
        result = { success: true };
        log.debug(`✅ ${method} request successful (no content)`);
      } else if (contentType && contentType.includes('application/json')) {
        // Parse JSON response
        const text = await response.text();
        if (text && text.trim().length > 0) {
          result = JSON.parse(text);
        } else {
          result = { success: true };
          log.debug(`✅ ${method} request successful (empty JSON body)`);
        }
      } else {
        // Non-JSON response or unknown content type
        const text = await response.text();
        if (text && text.trim().length > 0) {
          try {
            result = JSON.parse(text);
          } catch {
            // Sanitize non-JSON text to remove HTML/base64
            result = { success: true, response: sanitizeResponseText(text, 1000) };
          }
        } else {
          result = { success: true };
        }
      }

      return result;
    }, `${method} ${endpoint}`);

      // Cache successful GET requests
      if (method === 'GET' && options.useCache !== false) {
        const cacheKey = `${method}:${endpoint}`;
        this.requestCache.set(cacheKey, {
          data: result,
          timestamp: Date.now(),
          ttl: options.cacheTTL || this.CACHE_TTL
        });
      }

      return result;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new McpError(ErrorCode.InternalError, `Request timeout after ${options.timeout}ms`);
      }
      throw error;
    }
  }

  // ===== CORE API METHODS =====

  async getTenantInfo(): Promise<any> {
    return await this.makeRequest('/api/v1/tenants/me');
  }

  async getLicenseOverview(): Promise<any> {
  try {
    log.debug('🔑 Fetching license overview from /licenses/overview');
    
    const response = await this.makeRequest('/api/v1/licenses/overview');
    
    log.debug('✅ License overview retrieved:', {
      status: response.status,
      valid: response.valid,
      trial: response.trial,
      product: response.product,
      allotmentsCount: response.allotments?.length || 0,
      parametersCount: response.parameters?.length || 0
    });
    
    return response;
  } catch (error) {
    log.error('❌ Failed to get license overview:', error);
    
    // Re-throw the error - let the governance service handle it
    throw error;
  }
}

  async getThemes(): Promise<any> {
    try {
      return await this.makeRequest('/api/v1/themes');
    } catch (error) {
      log.error('Failed to get themes:', error);
      return { data: [] };
    }
  }

  async getWebhooks(limit: number = 50): Promise<any> {
    try {
      const params = new URLSearchParams({
        limit: Math.min(limit, 100).toString()
      });
      return await this.makeRequest(`/api/v1/webhooks?${params.toString()}`);
    } catch (error) {
      log.error('Failed to get webhooks:', error);
      return { data: [] };
    }
  }

  // ===== USER MANAGEMENT =====

  async getUserById(userId: string): Promise<any> {
    if (!userId || typeof userId !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Valid user ID is required');
    }
    
    try {
      // First try to get from cache
      const cached = this.userCache.get(userId);
      if (cached) {
        return cached;
      }
      
      // Try the /users/{id} endpoint
      return await this.getUser(userId);
    } catch (error) {
      // If direct lookup fails, try resolution system
      const resolvedUsers = await this.resolveOwnersToUsers([userId]);
      const resolved = resolvedUsers.get(userId);
      
      if (resolved) {
        return {
          id: resolved.qlikUserId,
          subject: resolved.auth0Subject,
          name: resolved.displayName,
          displayName: resolved.displayName,
          email: resolved.email,
          status: resolved.status
        };
      }
      
      throw new McpError(ErrorCode.InvalidParams, `User not found: ${userId}`);
    }
  }

  async getUsers(params?: {
  limit?: number;
  offset?: number;
  filter?: string;
  sort?: string;
  search?: string;
  getAllUsers?: boolean;  // NEW: Flag to get all users with pagination
}): Promise<any> {
  try {
    // If getAllUsers is true, handle full pagination
    if (params?.getAllUsers) {
      const allUsers: any[] = [];
      let offset = 0;
      const batchSize = 100; // API max limit
      let hasMore = true;
      
      while (hasMore && (!params.limit || allUsers.length < params.limit)) {
        const searchParams = new URLSearchParams();
        searchParams.set('limit', String(batchSize));
        searchParams.set('offset', String(offset));
        if (params.filter) searchParams.set('filter', params.filter);
        if (params.sort) searchParams.set('sort', params.sort);
        if (params.search) searchParams.set('search', params.search);
        
        const endpoint = `/api/v1/users${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
        const response = await this.makeRequest(endpoint);
        const batch = response.data || response;
        
        if (!Array.isArray(batch) || batch.length === 0) {
          hasMore = false;
        } else {
          allUsers.push(...batch);
          offset += batch.length;
          hasMore = batch.length === batchSize;
          
          // If we have a limit, check if we've reached it
          if (params.limit && allUsers.length >= params.limit) {
            hasMore = false;
          }
        }
      }
      
      // Return only the requested number if limit specified
      if (params.limit) {
        return { data: allUsers.slice(0, params.limit), totalCount: allUsers.length };
      }
      
      return { data: allUsers, totalCount: allUsers.length };
    }
    
    // Original single-page logic for backward compatibility
    const searchParams = new URLSearchParams();
    if (params?.limit !== undefined) searchParams.set('limit', String(Math.min(params.limit, 100)));
    if (params?.offset !== undefined) searchParams.set('offset', String(params.offset));
    if (params?.filter) searchParams.set('filter', params.filter);
    if (params?.sort) searchParams.set('sort', params.sort);
    if (params?.search) searchParams.set('search', params.search);
    
    const endpoint = `/api/v1/users${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    return await this.makeRequest(endpoint);
  } catch (error) {
    log.error('Failed to get users:', error);
    return { data: [] };
  }
}

  async getUser(userId: string): Promise<any> {
    if (!userId || typeof userId !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Valid user ID is required');
    }
    
    try {
      return await this.makeRequest(`/api/v1/users/${userId}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async searchUsers(query: string, limit: number = 50): Promise<any[]> {
    if (!query || typeof query !== 'string') {
      return [];
    }
    
    try {
      const searchStrategies = [
        { filter: `name co "${query}"` },
        { filter: `email co "${query}"` },
        { filter: `displayName co "${query}"` },
        { search: query }
      ];
      
      const allResults = new Set<any>();
      
      for (const strategy of searchStrategies) {
        try {
          const response = await this.getUsers({ ...strategy, limit: Math.min(limit, 25) });
          const users = response.data || response;
          
          if (Array.isArray(users)) {
            users.forEach(user => allResults.add(user));
          }
        } catch (error) {
          log.warn(`Search strategy failed: ${strategy}`, error);
        }
      }
      
      return Array.from(allResults).slice(0, limit);
    } catch (error) {
      log.error('Failed to search users:', error);
      return [];
    }
  }

  // ===== APP MANAGEMENT =====

  async getApps(params?: Record<string, string>): Promise<any[]> {
    try {
      const searchParams = new URLSearchParams(params);
      const endpoint = `/api/v1/items${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
      const response = await this.makeRequest(endpoint);
      
      let apps = response.data || response;
      if (!Array.isArray(apps)) {
        log.warn('Apps response is not an array:', typeof apps);
        apps = [];
      }
      
      return apps;
    } catch (error) {
      log.error('Failed to get apps:', error);
      return [];
    }
  }

  async getApp(appId: string): Promise<any> {
    if (!appId || typeof appId !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Valid app ID is required');
    }
    return await this.makeRequest(`/api/v1/apps/${appId}`);
  }

  async createApp(appData: any): Promise<any> {
    return await this.makeRequest('/api/v1/apps', 'POST', appData);
  }

  async updateApp(appId: string, appData: any): Promise<any> {
    if (!appId || typeof appId !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Valid app ID is required');
    }
    return await this.makeRequest(`/api/v1/apps/${appId}`, 'PUT', appData);
  }

  async deleteApp(appId: string): Promise<any> {
    if (!appId || typeof appId !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Valid app ID is required');
    }
    return await this.makeRequest(`/api/v1/apps/${appId}`, 'DELETE');
  }

  async getAppMetadata(appId: string): Promise<any> {
    if (!appId || typeof appId !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Valid app ID is required');
    }

    try {
      return await this.makeRequest(`/api/v1/apps/${appId}/data/metadata`);
    } catch (error) {
      log.error(`Failed to get metadata for app ${appId}:`, error);
      return {};
    }
  }

  async getAppReloads(appId: string, limit: number = 10): Promise<any> {
    if (!appId || typeof appId !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Valid app ID is required');
    }
    
    try {
      const params = new URLSearchParams({
        appId: appId,
        limit: Math.min(Math.max(1, limit), 100).toString(),
        log: 'true'
      });
      
      const endpoint = `/api/v1/reloads?${params.toString()}`;
      const result = await this.makeRequest(endpoint);
      return result;
    } catch (error) {
      log.error(`Failed to get reloads for app ${appId}:`, error);
      return {
        data: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  // ===== SPACE MANAGEMENT =====

  async getSpaces(params?: Record<string, string>): Promise<any[]> {
    try {
      const searchParams = new URLSearchParams(params);
      const endpoint = `/api/v1/spaces${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
      const response = await this.makeRequest(endpoint);

      let spaces = response.data || response;
      if (!Array.isArray(spaces)) {
        spaces = [];
      }

      return spaces;
    } catch (error) {
      log.error('Failed to get spaces:', error);
      return [];
    }
  }

  async getSpace(spaceId: string): Promise<any> {
    if (!spaceId || typeof spaceId !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Valid space ID is required');
    }

    try {
      return await this.makeRequest(`/api/v1/spaces/${spaceId}`);
    } catch (error) {
      log.error(`Failed to get space ${spaceId}:`, error);
      return null;
    }
  }

  async getSpaceItems(spaceId: string, params?: Record<string, string>): Promise<any> {
    if (!spaceId || typeof spaceId !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Valid space ID is required');
    }

    try {
      const searchParams = new URLSearchParams(params);
      const endpoint = `/api/v1/spaces/${spaceId}/items${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
      return await this.makeRequest(endpoint);
    } catch (error) {
      log.error(`Failed to get items for space ${spaceId}:`, error);
      return { data: [] };
    }
  }

  // ===== RELOAD MANAGEMENT =====

  async getReloads(params?: Record<string, string>): Promise<any> {
    try {
      const searchParams = new URLSearchParams(params);
      const endpoint = `/api/v1/reloads${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
      return await this.makeRequest(endpoint);
    } catch (error) {
      log.error('Failed to get reloads:', error);
      return { data: [] };
    }
  }

  async getReloadTask(reloadId: string): Promise<any> {
    if (!reloadId || typeof reloadId !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Valid reload ID is required');
    }
    
    return await this.makeRequest(`/api/v1/reloads/${reloadId}`);
  }

  async triggerReload(appId: string, partial: boolean = false): Promise<any> {
    const payload = {
      appId: appId,
      partial: partial
    };
    
    return await this.makeRequest('/api/v1/reloads', 'POST', payload);
  }

  async cancelReload(reloadId: string): Promise<any> {
    if (!reloadId || typeof reloadId !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Valid reload ID is required');
    }
    
    return await this.makeRequest(`/api/v1/reloads/${reloadId}/cancel`, 'POST');
  }

  // ===== DATA CONNECTIONS =====

  async getDataConnections(params?: Record<string, string>): Promise<any> {
    try {
      const searchParams = new URLSearchParams(params);
      const endpoint = `/api/v1/data-connections${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
      return await this.makeRequest(endpoint);
    } catch (error) {
      log.error('Failed to get data connections:', error);
      return { data: [] };
    }
  }

  async getDataConnection(connectionId: string): Promise<any> {
    if (!connectionId || typeof connectionId !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Valid connection ID is required');
    }
    
    return await this.makeRequest(`/api/v1/data-connections/${connectionId}`);
  }

  // ===== CONSUMPTION & CAPACITY =====

  async getConsumption(params?: Record<string, string>): Promise<any> {
    log.debug('Getting consumption data with high limit');
    
    // Request ALL records with high limit
    const endpoint = `/api/v1/consumption/executions?limit=200`;
    log.debug('API endpoint:', endpoint);
    
    const response = await this.makeRequest(endpoint, 'GET', undefined, {
      useCache: false,
      timeout: 60000
    });
    
    // FORCED JSON PARSING FIX
    let parsedResponse = response;
    if (typeof response === 'string') {
      log.debug('Response is string, parsing as JSON...');
      parsedResponse = JSON.parse(response);
      log.debug('JSON parse successful');
    }
    
    log.debug('Response received:', {
      hasData: !!parsedResponse?.data,
      dataLength: parsedResponse?.data?.length || 0,
      totalCount: parsedResponse?.totalCount || 0
    });
    
    // Log data volume consumption specifically
    const dataVolumeRecords = (parsedResponse?.data || []).filter((r: any) => 
      r.resourceType === 'data.volume.consumption' && 
      r.resourceAction === 'aggregation'
    );
    
    log.debug(`Found ${dataVolumeRecords.length} data volume consumption records with localUsage:`, 
      dataVolumeRecords.map((r: any) => r.localUsage));
    
    return parsedResponse;
  }

  // ===== AUTOMATIONS =====

  async getAutomations(params?: Record<string, string>): Promise<any> {
    try {
      const searchParams = new URLSearchParams(params);
      const endpoint = `/api/v1/automations${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
      return await this.makeRequest(endpoint);
    } catch (error) {
      log.error('Failed to get automations:', error);
      return { data: [] };
    }
  }

  async getAutomation(automationId: string): Promise<any> {
    if (!automationId || typeof automationId !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Valid automation ID is required');
    }

    return await this.makeRequest(`/api/v1/automations/${automationId}`);
  }

  async runAutomation(automationId: string, inputs?: any): Promise<any> {
    if (!automationId || typeof automationId !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Valid automation ID is required');
    }

    return await this.makeRequest(`/api/v1/automations/${automationId}/run`, 'POST', inputs);
  }

  // ===== USER RESOLUTION SYSTEM =====

  async resolveOwnersToUsers(ownerIdentifiers: string[]): Promise<Map<string, ResolvedUser>> {
    const resolved = new Map<string, ResolvedUser>();
    
    if (!ownerIdentifiers || ownerIdentifiers.length === 0) {
      return resolved;
    }

    log.debug(`🔄 REBUILT: Resolving ${ownerIdentifiers.length} owner identifiers...`);

    // Step 1: Check cache for already resolved users
    const uncachedIdentifiers: string[] = [];
    
    ownerIdentifiers.forEach(identifier => {
      const cached = this.getCachedResolvedUser(identifier);
      if (cached) {
        resolved.set(identifier, cached);
        log.debug(`📦 CACHE HIT: ${this.truncateId(identifier)} → "${cached.displayName}"`);
      } else {
        uncachedIdentifiers.push(identifier);
      }
    });

    if (uncachedIdentifiers.length === 0) {
      log.debug(`✅ All ${ownerIdentifiers.length} users resolved from cache`);
      return resolved;
    }

    // Step 2: Ensure we have comprehensive user mapping
    await this.ensureComprehensiveUserMapping();

    // Step 3: Resolve using the comprehensive mapping
    uncachedIdentifiers.forEach(identifier => {
      const resolvedUser = this.resolveFromComprehensiveMapping(identifier);
      if (resolvedUser) {
        resolved.set(identifier, resolvedUser);
        this.cacheResolvedUser(resolvedUser, identifier);
        log.debug(`✅ RESOLVED: ${this.truncateId(identifier)} → "${resolvedUser.displayName}"`);
      } else {
        // Fallback resolution
        const fallbackUser = this.createFallbackUser(identifier);
        resolved.set(identifier, fallbackUser);
        this.cacheResolvedUser(fallbackUser, identifier);
        log.debug(`🔄 FALLBACK: ${this.truncateId(identifier)} → "${fallbackUser.displayName}"`);
      }
    });

    log.debug(`✅ REBUILT RESOLUTION COMPLETE: ${resolved.size}/${ownerIdentifiers.length} users resolved`);
    return resolved;
  }

  /**
   * REBUILT: Ensure we have comprehensive user mapping by fetching all users
   */
  private async ensureComprehensiveUserMapping(): Promise<void> {
    const now = Date.now();
    
    // Check if we need to refresh the comprehensive mapping
    if (this.allUsersFetched && (now - this.lastFullUserFetch) < this.USER_CACHE_TTL) {
      log.debug(`📋 Using cached comprehensive user mapping (${this.userCache.size} users)`);
      return;
    }

    log.debug('🔄 REBUILT: Fetching comprehensive user mapping...');
    
    try {
      let allUsers: any[] = [];
      let offset = 0;
      const limit = 100;
      let hasMore = true;
      
      while (hasMore) {
        const response = await this.getUsers({ limit, offset });
        const users = response.data || response;
        
        if (Array.isArray(users) && users.length > 0) {
          allUsers = allUsers.concat(users);
          log.debug(`   📥 Fetched ${users.length} users (total: ${allUsers.length})`);
          
          users.forEach(user => {
            this.indexUser(user);
          });
          
          offset += users.length;
          hasMore = users.length === limit;
        } else {
          hasMore = false;
        }
      }
      
      this.allUsersFetched = true;
      this.lastFullUserFetch = now;
      
      log.debug(`✅ REBUILT: Comprehensive mapping complete - ${allUsers.length} users indexed`);
      log.debug(`   Auth0 mappings: ${this.auth0ToQlikIdCache.size}`);
      log.debug(`   Display names: ${this.displayNameCache.size}`);
      log.debug(`   Emails: ${this.emailCache.size}`);
      
    } catch (error) {
      log.error('❌ REBUILT: Failed to fetch comprehensive user mapping:', error);
    }
  }

  /**
   * REBUILT: Index a user in all caches
   */
  private indexUser(user: any): void {
    if (!user) return;
    
    const qlikUserId = user.id;
    const auth0Subject = user.subject || user.auth0Subject || this.extractAuth0Subject(user);
    const displayName = user.name || user.displayName || user.email || 'Unknown User';
    const email = user.email || 'unknown@example.com';
    
    // Cache the full user object
    this.userCache.set(qlikUserId, user);
    
    // Create bidirectional Auth0 ↔ Qlik ID mapping
    if (auth0Subject && auth0Subject !== qlikUserId) {
      this.auth0ToQlikIdCache.set(auth0Subject, qlikUserId);
      this.qlikIdToAuth0Cache.set(qlikUserId, auth0Subject);
    }
    
    // Cache display name and email by multiple keys
    this.displayNameCache.set(qlikUserId, displayName);
    this.emailCache.set(qlikUserId, email);
    
    if (auth0Subject) {
      this.displayNameCache.set(auth0Subject, displayName);
      this.emailCache.set(auth0Subject, email);
    }
  }

  /**
   * REBUILT: Extract Auth0 subject from user object
   */
  private extractAuth0Subject(user: any): string | undefined {
    // Try multiple possible locations
    if (user.subject) return user.subject;
    if (user.auth0Subject) return user.auth0Subject;
    if (user.externalId && user.externalId.startsWith('auth0|')) return user.externalId;
    if (user.sub) return user.sub;
    
    // Check identities array
    if (Array.isArray(user.identities)) {
      const auth0Identity = user.identities.find((id: any) => 
        id.provider === 'auth0' || 
        (id.userId && id.userId.includes('auth0|'))
      );
      if (auth0Identity?.userId) return auth0Identity.userId;
    }
    
    return undefined;
  }

  /**
   * REBUILT: Resolve user from comprehensive mapping
   */
  private resolveFromComprehensiveMapping(identifier: string): ResolvedUser | undefined {
    // Direct lookup in user cache
    const cachedUser = this.userCache.get(identifier);
    if (cachedUser) {
      return this.userToResolvedUser(cachedUser, identifier);
    }
    
    // Check if it's an Auth0 ID that maps to a Qlik User ID
    const qlikUserId = this.auth0ToQlikIdCache.get(identifier);
    if (qlikUserId) {
      const user = this.userCache.get(qlikUserId);
      if (user) {
        return this.userToResolvedUser(user, identifier);
      }
    }
    
    // Check if we have display name or email for this identifier
    const displayName = this.displayNameCache.get(identifier);
    const email = this.emailCache.get(identifier);
    
    if (displayName || email) {
      // Try to find the full user object
      for (const [userId, user] of this.userCache.entries()) {
        if ((displayName && (user.name === displayName || user.displayName === displayName)) ||
            (email && user.email === email)) {
          return this.userToResolvedUser(user, identifier);
        }
      }
    }
    
    return undefined;
  }

  /**
   * REBUILT: Convert user object to ResolvedUser
   */
  private userToResolvedUser(user: any, originalIdentifier: string): ResolvedUser {
    const qlikUserId = user.id;
    const auth0Subject = user.subject || 
                        user.auth0Subject || 
                        this.qlikIdToAuth0Cache.get(qlikUserId) || 
                        this.extractAuth0Subject(user) || 
                        originalIdentifier;
    
    return {
      qlikUserId: qlikUserId,
      auth0Subject: auth0Subject,
      displayName: user.name || user.displayName || user.email || 'Unknown User',
      email: user.email || 'unknown@example.com',
      status: user.status || 'active'
    };
  }

  /**
   * REBUILT: Get cached resolved user
   */
  private getCachedResolvedUser(identifier: string): ResolvedUser | undefined {
    // Try direct user cache lookup
    const user = this.userCache.get(identifier);
    if (user) {
      return this.userToResolvedUser(user, identifier);
    }
    
    // Try Auth0 mapping
    const qlikUserId = this.auth0ToQlikIdCache.get(identifier);
    if (qlikUserId) {
      const mappedUser = this.userCache.get(qlikUserId);
      if (mappedUser) {
        return this.userToResolvedUser(mappedUser, identifier);
      }
    }
    
    return undefined;
  }

  /**
   * REBUILT: Cache resolved user
   */
  private cacheResolvedUser(resolvedUser: ResolvedUser, originalIdentifier: string): void {
    // Cache by original identifier
    this.displayNameCache.set(originalIdentifier, resolvedUser.displayName);
    this.emailCache.set(originalIdentifier, resolvedUser.email);
    
    // Ensure bidirectional mapping
    if (resolvedUser.qlikUserId !== resolvedUser.auth0Subject) {
      this.auth0ToQlikIdCache.set(resolvedUser.auth0Subject, resolvedUser.qlikUserId);
      this.qlikIdToAuth0Cache.set(resolvedUser.qlikUserId, resolvedUser.auth0Subject);
    }
  }

  /**
   * REBUILT: Create fallback user when resolution fails
   */
  private createFallbackUser(identifier: string): ResolvedUser {
    // Try to extract meaningful name from identifier
    let displayName = 'Unknown User';
    let email = 'unknown@example.com';
    
    if (identifier.includes('@')) {
      // Looks like an email
      email = identifier;
      displayName = identifier.split('@')[0];
    } else if (identifier.startsWith('auth0|')) {
      // Auth0 ID - try to make it more readable
      displayName = `User ${identifier.substring(6, 12)}...`;
    } else if (identifier.length === 24) {
      // Likely a MongoDB ObjectId
      displayName = `User ${identifier.substring(0, 8)}...`;
    }
    
    return {
      qlikUserId: identifier,
      auth0Subject: identifier,
      displayName: displayName,
      email: email,
      status: 'unknown'
    };
  }

  // ===== UTILITY METHODS =====
  
  private truncateId(id: string): string {
    if (!id || typeof id !== 'string') return 'undefined';
    if (id.length <= 25) return id;
    return id.substring(0, 22) + '...';
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.requestCache.clear();
    this.userCache.clear();
    this.auth0ToQlikIdCache.clear();
    this.qlikIdToAuth0Cache.clear();
    this.displayNameCache.clear();
    this.emailCache.clear();
    this.allUsersFetched = false;
    this.lastFullUserFetch = 0;
  }

  /**
   * Get comprehensive cache statistics
   */
  getCacheStats(): any {
    const entries = this.requestCache.size;
    let oldestTimestamp = Date.now();
    let oldestKey: string | null = null;
    
    for (const [key, value] of this.requestCache.entries()) {
      if (value.timestamp < oldestTimestamp) {
        oldestTimestamp = value.timestamp;
        oldestKey = key;
      }
    }
    
    return {
      totalRequestCache: entries,
      userCache: this.userCache.size,
      auth0ToQlikMapping: this.auth0ToQlikIdCache.size,
      qlikToAuth0Mapping: this.qlikIdToAuth0Cache.size,
      displayNameCache: this.displayNameCache.size,
      emailCache: this.emailCache.size,
      allUsersFetched: this.allUsersFetched,
      lastFullUserFetch: this.lastFullUserFetch ? new Date(this.lastFullUserFetch).toISOString() : null,
      oldestEntry: oldestKey,
      totalMappedUsers: new Set([
        ...this.auth0ToQlikIdCache.keys(),
        ...this.qlikIdToAuth0Cache.keys()
      ]).size
    };
  }

  /**
   * Health check - test API connectivity
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; latency: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      await this.makeRequest('/api/v1/tenants/me', 'GET', undefined, { useCache: false });
      const latency = Date.now() - startTime;
      
      return {
        status: 'healthy',
        latency
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      
      return {
        status: 'unhealthy',
        latency,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get API client configuration info
   */
  getConfigInfo(): {
    tenantUrl: string;
    hasApiKey: boolean;
    cacheEnabled: boolean;
    version: string;
  } {
    return {
      tenantUrl: this.config.tenantUrl,
      hasApiKey: !!this.config.apiKey,
      cacheEnabled: true,
      version: '2.1.0-with-rate-limiting'
    };
  }

  /**
   * Get rate limiter statistics
   */
  getRateLimiterStats(): { activeRequests: number; queuedRequests: number; config: any } {
    return this.rateLimiter.getStats();
  }

  /**
   * Test the rebuilt resolution system with known cases
   */
  async testRebuiltResolution(): Promise<any> {
    const testCases = [
      'auth0|54932d87-d37b-466c-ba10-d524789da004', // Önder's Auth0 subject
      '6698f79565ae0490ab2af669'                     // Önder's Qlik User ID
    ];
    
    log.debug('🧪 TESTING REBUILT RESOLUTION SYSTEM...');
    
    const results = await this.resolveOwnersToUsers(testCases);
    
    const testResults = {
      totalTested: testCases.length,
      resolved: results.size,
      cacheStats: this.getCacheStats(),
      resolutions: Array.from(results.entries()).map(([id, user]) => ({
        input: id,
        qlikUserId: user.qlikUserId,
        auth0Subject: user.auth0Subject,
        displayName: user.displayName,
        email: user.email,
        status: user.status,
        isOnderCase: id === 'auth0|54932d87-d37b-466c-ba10-d524789da004' || id === '6698f79565ae0490ab2af669'
      }))
    };
    
    log.debug('✅ REBUILT RESOLUTION TEST COMPLETE:', testResults);
    return testResults;
  }

  // ===== GENERIC REQUEST METHOD (for any endpoint) =====
  
  async request<T = any>(config: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    url: string;
    data?: any;
    params?: Record<string, string | number | boolean>;
    headers?: Record<string, string>;
  }): Promise<T> {
    let endpoint = config.url;
    
    // Add query parameters if provided
    if (config.params && Object.keys(config.params).length > 0) {
      const searchParams = new URLSearchParams();
      Object.entries(config.params).forEach(([key, value]) => {
        searchParams.set(key, String(value));
      });
      endpoint += (endpoint.includes('?') ? '&' : '?') + searchParams.toString();
    }
    
    return await this.makeRequest(endpoint, config.method, config.data);
  }
}