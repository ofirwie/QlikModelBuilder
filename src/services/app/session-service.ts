/**
 * Session Service - Manages Enigma.js sessions for Qlik apps
 *
 * Handles:
 * - Cloud and On-Premise connections
 * - Session pooling and reuse
 * - Timeout management
 * - Certificate-based auth for on-premise
 */

import WebSocket from 'ws';
import { readFileSync, existsSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import enigma from 'enigma.js';
import https from 'https';
import { ApiClient } from '../../utils/api-client.js';
import { AppSession, QlikAppServiceOptions } from './app-types.js';
import { logger } from '../../utils/logger.js';
import { getActiveTenant } from '../../config/tenants.js';

const log = logger.child({ service: 'Session' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load Enigma schema
let schema: any;
try {
  const schemaPath = join(__dirname, '../../../node_modules/enigma.js/schemas/12.20.0.json');
  schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
} catch (error) {
  try {
    const schemaPath = join(__dirname, '../../../../node_modules/enigma.js/schemas/12.20.0.json');
    schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
  } catch (fallbackError) {
    log.debug('Failed to load Enigma.js schema:', fallbackError);
    schema = { structs: {}, enums: {} };
  }
}

export { schema };

// Singleton instance for session management
let sessionServiceInstance: SessionService | null = null;

/**
 * Get or create the singleton SessionService instance
 * Uses active tenant configuration from tenants.ts
 */
export function getSessionService(
  apiClient: ApiClient,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = '',
  options?: QlikAppServiceOptions
): SessionService {
  // Check if we need to recreate (tenant changed)
  if (sessionServiceInstance) {
    const currentUrl = sessionServiceInstance.getCleanTenantUrl();
    const newUrl = tenantUrl.replace('https://', '').replace('http://', '').replace('/api/v1', '');

    // If tenant URL changed, close all sessions and recreate
    if (currentUrl !== newUrl && newUrl) {
      log.debug(`🔄 Tenant changed from ${currentUrl} to ${newUrl}, recreating SessionService`);
      sessionServiceInstance.closeAllSessions().catch(() => {});
      sessionServiceInstance = null;
    }
  }

  if (!sessionServiceInstance) {
    sessionServiceInstance = new SessionService(apiClient, platform, tenantUrl, options);
    log.debug(`🆕 Created singleton SessionService for ${tenantUrl || 'default tenant'}`);
  }

  return sessionServiceInstance;
}

export class SessionService {
  private apiClient: ApiClient;
  private platform: 'cloud' | 'on-premise';
  private tenantUrl: string;

  // On-premise configuration
  private certPath?: string;
  private keyPath?: string;
  private userDirectory: string;
  private userId: string;
  private httpsAgent?: https.Agent;
  private enginePort: string;
  private virtualProxy?: string;

  // Certificate caching (avoid reading from disk on every connection)
  private cachedCertificates?: { cert: Buffer; key: Buffer; rootCa?: Buffer };

  // Session management
  private sessions: Map<string, AppSession> = new Map();
  private sessionTimeout: number = 300000; // 5 minutes
  private sessionTimers: Map<string, NodeJS.Timeout> = new Map();

  // Keep-alive management
  private keepAliveIntervals: Map<string, NodeJS.Timeout> = new Map();
  private readonly KEEP_ALIVE_INTERVAL = 15000; // 15 seconds

  constructor(
    apiClient: ApiClient,
    platform: 'cloud' | 'on-premise' = 'cloud',
    tenantUrl: string = '',
    options?: QlikAppServiceOptions
  ) {
    this.apiClient = apiClient;
    this.platform = platform;
    this.tenantUrl = tenantUrl;

    // On-premise configuration
    this.certPath = options?.certPath || process.env.QLIK_CERT_PATH;
    this.keyPath = options?.keyPath || process.env.QLIK_KEY_PATH;
    this.userDirectory = options?.userDirectory || process.env.QLIK_USER_DIRECTORY || 'INTERNAL';
    this.userId = options?.userId || process.env.QLIK_USER_ID || 'sa_api';
    this.enginePort = process.env.QLIK_ENGINE_PORT || '4747';
    this.virtualProxy = process.env.QLIK_VIRTUAL_PROXY;

    if (this.platform === 'on-premise' && this.certPath) {
      this.initializeOnPremiseAgent();
    }
  }

  /**
   * Initialize HTTPS agent with certificates for on-premise
   */
  private initializeOnPremiseAgent(): void {
    if (!this.certPath) return;

    let certDir = this.certPath;
    let clientCertPath: string;
    let clientKeyPath: string;

    try {
      const stat = statSync(certDir);
      if (stat.isDirectory()) {
        clientCertPath = join(certDir, 'client.pem');
        clientKeyPath = join(certDir, 'client_key.pem');
      } else {
        clientCertPath = this.certPath;
        clientKeyPath = this.keyPath || '';
      }
    } catch (error) {
      log.debug(`[SessionService] Certificate path not found: ${certDir}`);
      return;
    }

    if (!existsSync(clientCertPath) || !existsSync(clientKeyPath)) {
      log.debug(`[SessionService] Certificate files not found`);
      return;
    }

    try {
      this.httpsAgent = new https.Agent({
        cert: readFileSync(clientCertPath),
        key: readFileSync(clientKeyPath),
        rejectUnauthorized: false,
      });
      this.certPath = clientCertPath;
      this.keyPath = clientKeyPath;
      log.debug('[SessionService] On-premise HTTPS agent initialized');
    } catch (error) {
      log.debug('[SessionService] Failed to load certificates:', error);
    }
  }

  /**
   * Check if on-premise is properly configured
   */
  isOnPremiseConfigured(): boolean {
    return this.platform === 'on-premise' &&
           !!this.certPath &&
           !!this.keyPath &&
           !!this.httpsAgent;
  }

  /**
   * Check platform support and throw error if on-premise without certificates
   */
  checkPlatformSupport(operation: string): void {
    if (this.platform === 'on-premise' && !this.isOnPremiseConfigured()) {
      throw new Error(
        `On-premise Engine API requires certificate configuration: ${operation}\n\n` +
        `Configure certificates via environment variables:\n` +
        `  QLIK_CERT_PATH=/path/to/certs\n` +
        `  QLIK_USER_DIRECTORY=INTERNAL\n` +
        `  QLIK_USER_ID=sa_api`
      );
    }
  }

  /**
   * Get API key - uses active tenant (supports multi-tenant switching)
   */
  getApiKeyFromEnv(): string {
    // Use active tenant's API key for multi-tenant support
    const activeTenant = getActiveTenant();
    if (activeTenant.apiKey) {
      return activeTenant.apiKey;
    }
    // Fallback to env variable
    const apiKey = process.env.QLIK_API_KEY;
    if (!apiKey) {
      throw new Error('QLIK_API_KEY environment variable is required');
    }
    return apiKey;
  }

  /**
   * Get clean tenant URL for WebSocket connection - uses active tenant
   */
  getCleanTenantUrl(): string {
    // Use active tenant URL for multi-tenant support
    const activeTenant = getActiveTenant();
    const tenantUrl = activeTenant.url || this.apiClient.getConfigInfo().tenantUrl;
    return tenantUrl.replace('https://', '').replace('http://', '').replace('/api/v1', '');
  }

  /**
   * Create Enigma config for Qlik Cloud
   */
  createCloudEnigmaConfig(appId: string): any {
    const apiKey = this.getApiKeyFromEnv();
    const cleanTenantUrl = this.getCleanTenantUrl();
    const wsUrl = `wss://${cleanTenantUrl}/app/${appId}`;

    log.debug(`[Cloud] WebSocket URL: ${wsUrl}`);

    return {
      schema,
      url: wsUrl,
      createSocket: (url: string) => {
        const ws = new WebSocket(url, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        return ws as any;
      }
    };
  }

  /**
   * Build WebSocket URL for On-Premise
   * Supports configurable port and virtual proxy
   */
  private buildOnPremiseWebSocketUrl(appId: string): string {
    const config = this.apiClient.getConfigInfo();
    const tenantUrl = config.tenantUrl || this.tenantUrl;

    let hostname = tenantUrl.replace('https://', '').replace('http://', '');
    hostname = hostname.split(':')[0].split('/')[0];

    if (this.virtualProxy) {
      // With virtual proxy - typically uses port 443 (implicit in wss://)
      return `wss://${hostname}/${this.virtualProxy}/app/${appId}`;
    }
    // Direct Engine API connection with configurable port
    return `wss://${hostname}:${this.enginePort}/app/${appId}`;
  }

  /**
   * Get cached certificates or load from disk (once)
   */
  private getCachedCertificates(): { cert: Buffer; key: Buffer; rootCa?: Buffer } {
    if (this.cachedCertificates) {
      return this.cachedCertificates;
    }

    if (!this.certPath || !this.keyPath) {
      throw new Error('Certificate paths not configured for On-Premise');
    }

    this.cachedCertificates = {
      cert: readFileSync(this.certPath),
      key: readFileSync(this.keyPath),
    };

    // Load root CA if available
    const rootCaPath = process.env.QLIK_ROOT_CERT_PATH;
    if (rootCaPath && existsSync(rootCaPath)) {
      this.cachedCertificates.rootCa = readFileSync(rootCaPath);
      log.debug('[On-Premise] Root CA certificate loaded');
    }

    return this.cachedCertificates;
  }

  /**
   * Create Enigma config for On-Premise
   * Now uses configurable port, virtual proxy, and cached certificates
   */
  createOnPremiseEnigmaConfig(appId: string): any {
    const wsUrl = this.buildOnPremiseWebSocketUrl(appId);
    log.debug(`[On-Premise] WebSocket URL: ${wsUrl}`);
    log.debug(`[On-Premise] User: ${this.userDirectory}\\${this.userId}`);
    if (this.virtualProxy) {
      log.debug(`[On-Premise] Virtual Proxy: ${this.virtualProxy}`);
    }

    // Get cached certificates (loads once, reuses on subsequent calls)
    const certs = this.getCachedCertificates();

    return {
      schema,
      url: wsUrl,
      createSocket: (url: string) => {
        const wsOptions: any = {
          headers: {
            'X-Qlik-User': `UserDirectory=${this.userDirectory}; UserId=${this.userId}`
          },
          cert: certs.cert,
          key: certs.key,
          rejectUnauthorized: false,
        };

        // Use Root CA if available (enables proper certificate validation)
        if (certs.rootCa) {
          wsOptions.ca = [certs.rootCa];
          wsOptions.rejectUnauthorized = true;
          log.debug('[On-Premise] Using Root CA for certificate validation');
        }

        const ws = new WebSocket(url, wsOptions);
        return ws as any;
      }
    };
  }

  /**
   * Get or create a persistent session for an app
   */
  async getOrCreateSession(appId: string): Promise<AppSession> {
    this.checkPlatformSupport('getOrCreateSession');

    // Return existing session if available
    if (this.sessions.has(appId)) {
      const session = this.sessions.get(appId)!;
      session.lastAccessed = new Date();
      this.resetSessionTimer(appId);
      log.debug(`♻️ Reusing existing session for app ${appId}`);
      return session;
    }

    log.debug(`🔌 Creating new session for app ${appId} (${this.platform})`);

    const enigmaConfig = this.platform === 'on-premise'
      ? this.createOnPremiseEnigmaConfig(appId)
      : this.createCloudEnigmaConfig(appId);

    try {
      const session = enigma.create(enigmaConfig);

      // Add WebSocket event handlers BEFORE opening
      session.on('closed', () => {
        log.debug(`⚠️ Session closed for app ${appId}`);
        this.handleSessionClosed(appId);
      });

      session.on('suspended', () => {
        log.debug(`⏸️ Session suspended for ${appId}, resuming...`);
        session.resume();
      });

      session.on('error', (error: Error) => {
        log.debug(`❌ Session error for ${appId}:`, error.message);
        this.handleSessionClosed(appId);
      });

      const global = await session.open();

      let doc: any;
      try {
        doc = await (global as any).openDoc(appId);
      } catch (error: any) {
        log.debug('Error opening doc:', error);
        throw error;
      }

      const appSession: AppSession = {
        session,
        global,
        doc,
        appId,
        lastAccessed: new Date(),
        currentSelections: new Map()
      };

      this.sessions.set(appId, appSession);
      this.startSessionTimer(appId);
      this.startKeepAlive(appId, doc);

      log.debug(`✅ Session created for app ${appId} (${this.platform})`);
      return appSession;

    } catch (error) {
      log.debug(`❌ Failed to create session for app ${appId}:`, error);
      throw error;
    }
  }

  /**
   * Handle session closed event - cleanup without trying to close again
   */
  private handleSessionClosed(appId: string): void {
    this.sessions.delete(appId);
    this.stopKeepAlive(appId);

    if (this.sessionTimers.has(appId)) {
      clearTimeout(this.sessionTimers.get(appId)!);
      this.sessionTimers.delete(appId);
    }
  }

  /**
   * Create a temporary session (not pooled)
   */
  async createTemporarySession(appId: string): Promise<{ session: any; doc: any }> {
    const enigmaConfig = this.platform === 'on-premise'
      ? this.createOnPremiseEnigmaConfig(appId)
      : this.createCloudEnigmaConfig(appId);

    const session = enigma.create(enigmaConfig);
    const global = await session.open();
    const doc = await (global as any).openDoc(appId);

    return { session, doc };
  }

  /**
   * Connect with retry logic
   */
  async connectWithRetry(appId: string, maxRetries: number = 3): Promise<{ session: any; doc: any }> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        log.debug(`🔌 Connection attempt ${attempt}/${maxRetries}...`);
        const { session, doc } = await this.createTemporarySession(appId);
        log.debug('✅ Connected!');
        return { session, doc };
      } catch (error: any) {
        log.debug(`❌ Attempt ${attempt} failed: ${error.message}`);
        if (attempt === maxRetries) throw error;
        const backoffMs = 2000 * attempt;
        log.debug(`⏳ Waiting ${backoffMs / 1000}s before retry...`);
        await new Promise(r => setTimeout(r, backoffMs));
      }
    }
    throw new Error('Failed to connect after all retries');
  }

  /**
   * Execute promise with timeout
   */
  async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    operationName: string
  ): Promise<T> {
    let timeoutId: NodeJS.Timeout;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Timeout: ${operationName} exceeded ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutId!);
      return result;
    } catch (error) {
      clearTimeout(timeoutId!);
      throw error;
    }
  }

  /**
   * Check if error is a connection error
   */
  isConnectionError(error: any): boolean {
    const msg = error?.message || '';
    return msg.includes('Socket closed') ||
           msg.includes('Not connected') ||
           msg.includes('ECONNRESET') ||
           msg.includes('WebSocket') ||
           msg.includes('connection');
  }

  // ===== SESSION TIMER MANAGEMENT =====

  private startSessionTimer(appId: string): void {
    this.resetSessionTimer(appId);
  }

  private resetSessionTimer(appId: string): void {
    if (this.sessionTimers.has(appId)) {
      clearTimeout(this.sessionTimers.get(appId)!);
    }

    const timer = setTimeout(() => {
      log.debug(`⏰ Session timeout for app ${appId}`);
      this.closeSession(appId);
    }, this.sessionTimeout);

    this.sessionTimers.set(appId, timer);
  }

  /**
   * Close a specific session
   */
  async closeSession(appId: string): Promise<void> {
    const appSession = this.sessions.get(appId);
    if (appSession) {
      // Stop keep-alive first
      this.stopKeepAlive(appId);

      try {
        await appSession.session.close();
        log.debug(`🔌 Closed session for app ${appId}`);
      } catch (error) {
        log.debug(`Error closing session for app ${appId}:`, error);
      }

      this.sessions.delete(appId);

      if (this.sessionTimers.has(appId)) {
        clearTimeout(this.sessionTimers.get(appId)!);
        this.sessionTimers.delete(appId);
      }
    }
  }

  /**
   * Close all sessions
   */
  async closeAllSessions(): Promise<void> {
    log.debug('🔌 Closing all sessions...');
    const closePromises = Array.from(this.sessions.keys()).map(appId =>
      this.closeSession(appId)
    );
    await Promise.all(closePromises);
  }

  /**
   * Get ApiClient reference
   */
  getApiClient(): ApiClient {
    return this.apiClient;
  }

  /**
   * Get platform
   */
  getPlatform(): 'cloud' | 'on-premise' {
    return this.platform;
  }

  // ===== KEEP-ALIVE MANAGEMENT =====

  /**
   * Start keep-alive ping for a session
   */
  private startKeepAlive(appId: string, doc: any): void {
    // Don't start if already exists
    if (this.keepAliveIntervals.has(appId)) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        await doc.getAppLayout();
        log.debug(`💓 Keep-alive ping for ${appId}`);
      } catch (error) {
        log.debug(`❌ Keep-alive failed for ${appId}, session may be stale`);
        this.handleSessionClosed(appId);
      }
    }, this.KEEP_ALIVE_INTERVAL);

    this.keepAliveIntervals.set(appId, interval);
  }

  /**
   * Stop keep-alive for a session
   */
  private stopKeepAlive(appId: string): void {
    if (this.keepAliveIntervals.has(appId)) {
      clearInterval(this.keepAliveIntervals.get(appId)!);
      this.keepAliveIntervals.delete(appId);
    }
  }

  // ===== EXECUTE WITH RETRY =====

  /**
   * Execute an operation with automatic retry on connection errors
   * This is the recommended way to execute Engine API operations
   */
  async executeWithRetry<T>(
    appId: string,
    operation: (doc: any, appSession: AppSession) => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const appSession = await this.getOrCreateSession(appId);
        return await operation(appSession.doc, appSession);
      } catch (error: any) {
        const isSocketError = this.isConnectionError(error);

        if (!isSocketError || attempt === maxRetries) {
          throw error;
        }

        log.debug(`🔄 Retry ${attempt}/${maxRetries} for ${appId}: ${error?.message || 'Unknown error'}`);

        // Force reconnect by closing the stale session
        await this.closeSession(appId);

        // Exponential backoff
        const backoffMs = 1000 * attempt;
        await new Promise(r => setTimeout(r, backoffMs));
      }
    }

    throw new Error(`Failed after ${maxRetries} retries`);
  }
}
