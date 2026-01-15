/**
 * Simple App Developer Service
 * Basic app creation and reload
 *
 * - Create app in personal space
 * - Update existing app by appId
 * - Always reload after setting script
 */

import { ApiClient } from '../utils/api-client.js';
import { CacheManager } from '../utils/cache-manager.js';
import { logger } from '../utils/logger.js';
import enigma from 'enigma.js';

import WebSocket from 'ws';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const log = logger.child({ service: 'AppDeveloper' });

// Load enigma schema
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let schema: any;
try {
  const schemaPath = join(__dirname, '../../node_modules/enigma.js/schemas/12.20.0.json');
  schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
} catch {
  try {
    const schemaPath = join(__dirname, '../../../node_modules/enigma.js/schemas/12.20.0.json');
    schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
  } catch (e) {
    log.debug('[SimpleAppDev] Failed to load enigma schema:', e);
  }
}

export interface DataConnectionInput {
  connectionName: string;
  connectionType: 'folder' | 'ODBC' | 'OLEDB';
  connectionString: string;
  username?: string;
  password?: string;
}

export interface SimpleAppInput {
  appName?: string;  // For new app (creates in personal space)
  appId?: string;    // For existing app (updates it)
  loadScript?: string;
  dataConnection?: DataConnectionInput;  // On-premise: Create data connection
  listConnections?: boolean;             // On-premise: List connections in app
  listOdbcDsns?: boolean;                // On-premise: List ODBC data sources
}

export interface ConnectionInfo {
  id: string;
  name: string;
  type: string;
  connectionString?: string;
}

export interface OdbcDsnInfo {
  name: string;
  description?: string;
  is64Bit?: boolean;
}

export interface SimpleAppResult {
  success: boolean;
  appId?: string;
  appName?: string;
  appLink?: string;
  reloadId?: string;
  reloadStatus?: string;
  message?: string;
  error?: string;
  rawError?: any;
  connections?: ConnectionInfo[];      // List of connections in app
  odbcDsns?: OdbcDsnInfo[];            // List of ODBC data sources
  connectionCreated?: string;          // ID of created connection
}

export class SimpleAppDeveloperService {
  private apiClient: ApiClient;
  private cacheManager: CacheManager;
  private platform: 'cloud' | 'on-premise';
  private tenantUrl: string;
  private readonly RELOAD_POLL_INTERVAL_MS = 2000;
  private readonly RELOAD_MAX_WAIT_MS = 300000; // 5 minutes

  constructor(
    apiClient: ApiClient,
    cacheManager: CacheManager,
    platform: 'cloud' | 'on-premise' = 'cloud',
    tenantUrl: string = ''
  ) {
    this.apiClient = apiClient;
    this.cacheManager = cacheManager;
    this.platform = platform;
    this.tenantUrl = tenantUrl;
  }

  /**
   * Create or update a Qlik app
   * - appId provided → update existing app
   * - appName provided → create new app in personal space
   * - Always reload after setting script
   *
   * Platform support:
   * - Cloud: Uses REST APIs (/api/v1/apps, /api/v1/reloads)
   * - On-premise: Uses QRS API for create, Engine API for script/reload
   */
  async createOrUpdateApp(input: SimpleAppInput): Promise<SimpleAppResult> {
    const isUpdate = !!input.appId;
    logger.debug(`[SimpleAppDev] ${isUpdate ? 'Updating' : 'Creating'} app (platform: ${this.platform})`);

    try {
      // Route to platform-specific implementation
      if (this.platform === 'on-premise') {
        return await this.createOrUpdateAppOnPremise(input);
      }

      // Cloud implementation
      let appId = input.appId;
      let appName = input.appName || `App_${Date.now()}`;

      // Step 1: Create new app in personal space (no spaceId = personal)
      if (!appId) {
        logger.debug('[SimpleAppDev] Creating new app in personal space...');
        const createResult = await this.createApp(appName);
        appId = createResult.appId;
        appName = createResult.appName;
      }

      // Step 2: Set script if provided
      if (input.loadScript) {
        logger.debug('[SimpleAppDev] Setting load script...');
        await this.setScript(appId, input.loadScript);
      }

      // Step 3: Trigger reload if script was set (don't wait - return immediately)
      let reloadId: string | undefined;

      if (input.loadScript) {
        logger.debug('[SimpleAppDev] Triggering reload...');
        const reloadResult = await this.triggerReload(appId);
        reloadId = reloadResult.reloadId;
        logger.debug(`[SimpleAppDev] Reload triggered with ID: ${reloadId}`);
      }

      const appLink = this.buildAppLink(appId);

      return {
        success: true,
        appId,
        appName,
        appLink,
        reloadId,
        reloadStatus: reloadId ? 'triggered' : 'no_script',
        message: reloadId ? `Reload triggered. Use qlik_get_reload_status with reloadId: ${reloadId} to check progress.` : 'App created without script.'
      };

    } catch (error) {
      logger.debug(`[SimpleAppDev] Error: ${error instanceof Error ? error.message : String(error)}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        rawError: error
      };
    }
  }

  /**
   * On-premise implementation using Engine API
   * Full workflow: CreateApp → CreateConnection → SetScript → DoReload → DoSave
   * Also supports: ListOdbcDsns, ListConnections
   */
  private async createOrUpdateAppOnPremise(input: SimpleAppInput): Promise<SimpleAppResult> {
    log.debug(`[SimpleAppDev] createOrUpdateAppOnPremise called`);
    log.debug(`[SimpleAppDev] Input: listOdbcDsns=${input.listOdbcDsns}, listConnections=${input.listConnections}, appId=${input.appId}`);

    try {
      // Discovery mode: List ODBC DSNs (no app needed)
      if (input.listOdbcDsns) {
        log.debug('[SimpleAppDev] Taking listOdbcDsns branch');
        logger.debug('[SimpleAppDev] Listing ODBC data sources...');
        const odbcDsns = await this.listOdbcDsnsOnPremise();
        return {
          success: true,
          odbcDsns,
          message: `Found ${odbcDsns.length} ODBC data source(s) on the server.`
        };
      }

      // Discovery mode: List connections in existing app
      log.debug(`[SimpleAppDev] listConnections check: listConnections=${input.listConnections}, appId=${input.appId}`);
      if (input.listConnections && input.appId) {
        log.debug('[SimpleAppDev] Taking listConnections branch');
        logger.debug(`[SimpleAppDev] Listing connections in app ${input.appId}...`);
        const connections = await this.listConnectionsOnPremise(input.appId);
        log.debug(`[SimpleAppDev] Got ${connections.length} connections`);
        return {
          success: true,
          appId: input.appId,
          connections,
          message: `Found ${connections.length} connection(s) in the app.`
        };
      }

      // App creation/update mode
      log.debug('[SimpleAppDev] Proceeding to app creation/update mode');
      let appId = input.appId;
      let appName = input.appName || `App_${Date.now()}`;
      let connectionCreated: string | undefined;

      // Step 1: Create new app via Engine API (Global.CreateApp)
      if (!appId && input.appName) {
        logger.debug('[SimpleAppDev] Creating new app via Engine API...');
        const createResult = await this.createAppOnPremise(appName);
        appId = createResult.appId;
        appName = createResult.appName;
        logger.debug(`[SimpleAppDev] App created: ${appId}`);
      }

      if (!appId) {
        return {
          success: false,
          error: 'Either appName (to create) or appId (to update) is required'
        };
      }

      // Step 2: Create data connection if provided
      if (input.dataConnection) {
        logger.debug(`[SimpleAppDev] Creating data connection: ${input.dataConnection.connectionName}`);
        connectionCreated = await this.createConnectionOnPremise(appId, input.dataConnection);
        logger.debug(`[SimpleAppDev] Connection created: ${connectionCreated}`);
      }

      // Step 3: If script provided, set it and reload via Engine API
      if (input.loadScript) {
        logger.debug('[SimpleAppDev] Setting script and reloading via Engine API...');
        await this.setScriptAndReloadOnPremise(appId, input.loadScript);
        logger.debug('[SimpleAppDev] Script set and reload completed');
      }

      const appLink = this.buildAppLink(appId);

      return {
        success: true,
        appId,
        appName,
        appLink,
        connectionCreated,
        reloadStatus: input.loadScript ? 'completed' : 'no_script',
        message: this.buildSuccessMessage(input, connectionCreated)
      };

    } catch (error) {
      logger.debug(`[SimpleAppDev] On-premise error: ${error instanceof Error ? error.message : String(error)}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        rawError: error
      };
    }
  }

  /**
   * Build success message based on what was done
   */
  private buildSuccessMessage(input: SimpleAppInput, connectionCreated?: string): string {
    const parts: string[] = [];
    if (input.appName && !input.appId) parts.push('App created');
    if (connectionCreated) parts.push(`connection '${input.dataConnection?.connectionName}' created`);
    if (input.loadScript) parts.push('script set and data loaded');
    return parts.length > 0 ? parts.join(', ') + ' successfully.' : 'Operation completed.';
  }

  /**
   * Set script and reload on-premise via Engine API
   * Opens the app, sets script, reloads, and saves
   */
  private async setScriptAndReloadOnPremise(appId: string, loadScript: string): Promise<void> {
    // Get connection config
    const hostname = this.getHostname();
    const { clientCertPath, clientKeyPath, userDirectory, userId } = this.getOnPremiseConfig();

    // Connect to the specific app
    const wsUrl = `wss://${hostname}:4747/app/${appId}`;
    logger.debug(`[SimpleAppDev] Opening app: ${wsUrl}`);

    const enigmaConfig = {
      schema,
      url: wsUrl,
      createSocket: (url: string) => {
        const ws = new WebSocket(url, {
          headers: {
            'X-Qlik-User': `UserDirectory=${userDirectory}; UserId=${userId}`
          },
          cert: readFileSync(clientCertPath),
          key: readFileSync(clientKeyPath),
          rejectUnauthorized: false,
        });
        return ws as any;
      }
    };

    let session: any;
    try {
      session = enigma.create(enigmaConfig);
      const global = await session.open();

      // Open the doc
      logger.debug(`[SimpleAppDev] Opening doc: ${appId}`);
      const doc = await (global as any).openDoc(appId);

      // Step 1: SetScript - Set the load script
      logger.debug('[SimpleAppDev] Calling Doc.SetScript...');
      await doc.setScript(loadScript);

      // Step 2: DoReload - Execute the script (mode=0: default, partial=false, debug=false)
      logger.debug('[SimpleAppDev] Calling Doc.DoReload...');
      const reloadResult = await doc.doReload(0, false, false);
      logger.debug(`[SimpleAppDev] DoReload result: ${reloadResult}`);

      if (!reloadResult) {
        throw new Error('DoReload returned false - script execution failed');
      }

      // Step 3: DoSave - Save the app
      logger.debug('[SimpleAppDev] Calling Doc.DoSave...');
      await doc.doSave();

      logger.debug('[SimpleAppDev] Script set, reload, and save completed successfully');

    } finally {
      if (session) {
        try {
          await session.close();
        } catch (e) {
          // Ignore close errors
        }
      }
    }
  }

  /**
   * Get hostname from tenant URL
   */
  private getHostname(): string {
    let hostname = this.tenantUrl.replace('https://', '').replace('http://', '');
    hostname = hostname.split(':')[0].split('/')[0];
    return hostname;
  }

  /**
   * Get on-premise configuration from environment
   */
  private getOnPremiseConfig(): {
    clientCertPath: string;
    clientKeyPath: string;
    userDirectory: string;
    userId: string;
  } {
    const certPath = process.env.QLIK_CERT_PATH;
    if (!certPath) {
      throw new Error('QLIK_CERT_PATH environment variable not set for on-premise');
    }

    const stat = statSync(certPath);
    if (!stat.isDirectory()) {
      throw new Error('QLIK_CERT_PATH must be a folder containing client.pem and client_key.pem');
    }

    return {
      clientCertPath: join(certPath, 'client.pem'),
      clientKeyPath: join(certPath, 'client_key.pem'),
      userDirectory: process.env.QLIK_USER_DIRECTORY || 'INTERNAL',
      userId: process.env.QLIK_USER_ID || 'sa_api'
    };
  }

  /**
   * List ODBC data sources on the server via Engine API (Global.GetOdbcDsns)
   * Useful for discovering available DSNs before creating connections
   */
  private async listOdbcDsnsOnPremise(): Promise<OdbcDsnInfo[]> {
    log.debug('[SimpleAppDev] listOdbcDsnsOnPremise() called');
    logger.debug('[SimpleAppDev] Listing ODBC data sources via Engine API');

    const hostname = this.getHostname();
    log.debug(`[SimpleAppDev] Hostname: ${hostname}`);
    const { clientCertPath, clientKeyPath, userDirectory, userId } = this.getOnPremiseConfig();

    // Connect to global scope using engineData (required for global methods like GetOdbcDsns)
    const wsUrl = `wss://${hostname}:4747/app/engineData`;

    const enigmaConfig = {
      schema,
      url: wsUrl,
      createSocket: (url: string) => {
        const ws = new WebSocket(url, {
          headers: {
            'X-Qlik-User': `UserDirectory=${userDirectory}; UserId=${userId}`
          },
          cert: readFileSync(clientCertPath),
          key: readFileSync(clientKeyPath),
          rejectUnauthorized: false,
        });
        return ws as any;
      }
    };

    let session: any;
    try {
      session = enigma.create(enigmaConfig);
      const global = await session.open();

      // Call Global.GetOdbcDsns()
      logger.debug('[SimpleAppDev] Calling Global.GetOdbcDsns()');
      const result = await (global as any).getOdbcDsns();

      logger.debug(`[SimpleAppDev] Found ${result?.length || 0} ODBC DSNs`);

      // Map to our interface
      return (result || []).map((dsn: any) => ({
        name: dsn.qName || dsn.name,
        description: dsn.qDescription || dsn.description,
        is64Bit: dsn.qBit64 ?? dsn.is64Bit
      }));

    } finally {
      if (session) {
        try {
          await session.close();
        } catch (e) {
          // Ignore close errors
        }
      }
    }
  }

  /**
   * List connections in an app via Engine API (Doc.GetConnections)
   * Returns all data connections configured in the app
   */
  private async listConnectionsOnPremise(appId: string): Promise<ConnectionInfo[]> {
    log.debug(`[SimpleAppDev] listConnectionsOnPremise() called with appId: ${appId}`);
    logger.debug(`[SimpleAppDev] Listing connections in app ${appId} via Engine API`);

    const hostname = this.getHostname();
    log.debug(`[SimpleAppDev] Hostname: ${hostname}`);
    const { clientCertPath, clientKeyPath, userDirectory, userId } = this.getOnPremiseConfig();

    // Connect to the specific app
    const wsUrl = `wss://${hostname}:4747/app/${appId}`;

    const enigmaConfig = {
      schema,
      url: wsUrl,
      createSocket: (url: string) => {
        const ws = new WebSocket(url, {
          headers: {
            'X-Qlik-User': `UserDirectory=${userDirectory}; UserId=${userId}`
          },
          cert: readFileSync(clientCertPath),
          key: readFileSync(clientKeyPath),
          rejectUnauthorized: false,
        });
        return ws as any;
      }
    };

    let session: any;
    try {
      session = enigma.create(enigmaConfig);
      const global = await session.open();

      // Open the doc
      const doc = await (global as any).openDoc(appId);

      // Call Doc.GetConnections()
      logger.debug('[SimpleAppDev] Calling Doc.GetConnections()');
      const result = await doc.getConnections();

      logger.debug(`[SimpleAppDev] Found ${result?.length || 0} connections`);

      // Map to our interface
      return (result || []).map((conn: any) => ({
        id: conn.qId || conn.id,
        name: conn.qName || conn.name,
        type: conn.qType || conn.type,
        connectionString: conn.qConnectionString || conn.connectionString
      }));

    } finally {
      if (session) {
        try {
          await session.close();
        } catch (e) {
          // Ignore close errors
        }
      }
    }
  }

  /**
   * Create a data connection in an app via Engine API (Doc.CreateConnection)
   * Supports folder, ODBC, and OLEDB connections
   * Returns the connection ID
   */
  private async createConnectionOnPremise(appId: string, dataConnection: DataConnectionInput): Promise<string> {
    logger.debug(`[SimpleAppDev] Creating connection '${dataConnection.connectionName}' in app ${appId}`);

    const hostname = this.getHostname();
    const { clientCertPath, clientKeyPath, userDirectory, userId } = this.getOnPremiseConfig();

    // Connect to the specific app
    const wsUrl = `wss://${hostname}:4747/app/${appId}`;

    const enigmaConfig = {
      schema,
      url: wsUrl,
      createSocket: (url: string) => {
        const ws = new WebSocket(url, {
          headers: {
            'X-Qlik-User': `UserDirectory=${userDirectory}; UserId=${userId}`
          },
          cert: readFileSync(clientCertPath),
          key: readFileSync(clientKeyPath),
          rejectUnauthorized: false,
        });
        return ws as any;
      }
    };

    let session: any;
    try {
      session = enigma.create(enigmaConfig);
      const global = await session.open();

      // Open the doc
      const doc = await (global as any).openDoc(appId);

      // Build connection object based on type
      // Doc.CreateConnection expects qConnection object
      const qConnection: any = {
        qName: dataConnection.connectionName,
        qConnectionString: dataConnection.connectionString,
        qType: dataConnection.connectionType
      };

      // Add credentials if provided (for ODBC/OLEDB)
      if (dataConnection.username) {
        qConnection.qUserName = dataConnection.username;
      }
      if (dataConnection.password) {
        qConnection.qPassword = dataConnection.password;
      }

      // Call Doc.CreateConnection(qConnection)
      logger.debug(`[SimpleAppDev] Calling Doc.CreateConnection(${JSON.stringify(qConnection)})`);
      const connectionId = await doc.createConnection(qConnection);

      logger.debug(`[SimpleAppDev] Connection created with ID: ${connectionId}`);

      // Save the app to persist the connection
      await doc.doSave();

      return connectionId;

    } finally {
      if (session) {
        try {
          await session.close();
        } catch (e) {
          // Ignore close errors
        }
      }
    }
  }

  /**
   * Create app on-premise using Engine API (Global.CreateApp)
   * Connects to Engine API on port 4747 with certificate auth
   */
  private async createAppOnPremise(appName: string): Promise<{ appId: string; appName: string }> {
    logger.debug(`[SimpleAppDev] Creating app via Engine API: ${appName}`);

    // Parse hostname from tenant URL
    let hostname = this.tenantUrl.replace('https://', '').replace('http://', '');
    hostname = hostname.split(':')[0].split('/')[0];

    // Get certificate path from environment
    const certPath = process.env.QLIK_CERT_PATH;
    if (!certPath) {
      throw new Error('QLIK_CERT_PATH environment variable not set for on-premise');
    }

    // Determine cert file paths (folder-based)
    let clientCertPath: string;
    let clientKeyPath: string;

    const stat = statSync(certPath);
    if (stat.isDirectory()) {
      clientCertPath = join(certPath, 'client.pem');
      clientKeyPath = join(certPath, 'client_key.pem');
    } else {
      throw new Error('QLIK_CERT_PATH must be a folder containing client.pem and client_key.pem');
    }

    // Get user credentials from environment
    const userDirectory = process.env.QLIK_USER_DIRECTORY || 'INTERNAL';
    const userId = process.env.QLIK_USER_ID || 'sa_api';

    // Engine API WebSocket URL (port 4747, engineData for global operations like CreateApp)
    const wsUrl = `wss://${hostname}:4747/app/engineData`;
    logger.debug(`[SimpleAppDev] Engine API WebSocket: ${wsUrl}`);

    // Create enigma config
    const enigmaConfig = {
      schema,
      url: wsUrl,
      createSocket: (url: string) => {
        const ws = new WebSocket(url, {
          headers: {
            'X-Qlik-User': `UserDirectory=${userDirectory}; UserId=${userId}`
          },
          cert: readFileSync(clientCertPath),
          key: readFileSync(clientKeyPath),
          rejectUnauthorized: false,
        });
        return ws as any;
      }
    };

    let session: any;
    try {
      // Connect to Engine API
      session = enigma.create(enigmaConfig);
      const global = await session.open();

      // Call Global.CreateApp
      logger.debug(`[SimpleAppDev] Calling Global.CreateApp(${appName})`);
      const result = await (global as any).createApp(appName);

      logger.debug(`[SimpleAppDev] CreateApp result: ${JSON.stringify(result)}`);

      if (!result.qSuccess) {
        throw new Error('CreateApp returned qSuccess: false');
      }

      const appId = result.qAppId;

      return {
        appId,
        appName
      };

    } finally {
      // Close session
      if (session) {
        try {
          await session.close();
        } catch (e) {
          // Ignore close errors
        }
      }
    }
  }

  /**
   * Create a new app in personal space
   */
  private async createApp(appName: string): Promise<{ appId: string; appName: string }> {
    const payload = {
      attributes: {
        name: appName,
        description: 'Created by Qlik MCP Server'
      }
    };

    // No spaceId = creates in personal space
    const response = await this.apiClient.makeRequest('/api/v1/apps', 'POST', payload);

    // Debug: Log full response
    logger.debug(`[SimpleAppDev] Create app response: ${JSON.stringify(response, null, 2)}`);

    // IMPORTANT: Use resourceId (UUID) not id (MongoDB ObjectId)!
    // resourceId is the UUID format needed for subsequent API calls
    const appId = response.attributes?.resourceId || response.resourceId || response.attributes?.id || response.id;
    logger.debug(`[SimpleAppDev] App created with resourceId: ${appId}`);

    return {
      appId,
      appName: response.attributes?.name || appName
    };
  }

  /**
   * Set load script for an app
   */
  private async setScript(appId: string, script: string): Promise<void> {
    // Cloud: POST /api/v1/apps/{appId}/scripts (plural!)
    await this.apiClient.makeRequest(
      `/api/v1/apps/${appId}/scripts`,
      'POST',
      {
        script,
        versionMessage: `Updated via MCP at ${new Date().toISOString()}`
      }
    );
  }

  /**
   * Trigger app reload
   */
  private async triggerReload(appId: string): Promise<{ reloadId: string }> {
    const response = await this.apiClient.makeRequest(
      `/api/v1/reloads`,
      'POST',
      { appId }
    );

    // Debug: Log full response
    logger.debug(`[SimpleAppDev] Reload API response: ${JSON.stringify(response, null, 2)}`);

    // Reload API returns id (MongoDB ObjectId format like "5be59decca62aa00097268a4")
    // Use this id for polling status via GET /api/v1/reloads/{id}
    const reloadId = response.id;
    logger.debug(`[SimpleAppDev] Reload triggered, id: ${reloadId}, status: ${response.status}`);

    return { reloadId };
  }

  /**
   * Wait for reload to complete
   */
  private async waitForReload(appId: string, reloadId: string): Promise<{ status: string; error?: string }> {
    const startTime = Date.now();
    logger.debug(`[SimpleAppDev] Waiting for reload ${reloadId} to complete...`);

    while (Date.now() - startTime < this.RELOAD_MAX_WAIT_MS) {
      try {
        const response = await this.apiClient.makeRequest(`/api/v1/reloads/${reloadId}`);
        const currentStatus = (response.status || '').toUpperCase();

        logger.debug(`[SimpleAppDev] Reload status: ${currentStatus}`);

        if (currentStatus === 'SUCCEEDED') {
          logger.debug('[SimpleAppDev] Reload succeeded!');
          return { status: 'succeeded' };
        }

        if (currentStatus === 'FAILED') {
          logger.debug('[SimpleAppDev] Reload failed!');
          return {
            status: 'failed',
            error: response.log || response.errorMessage || 'Reload failed'
          };
        }

        if (currentStatus === 'CANCELED' || currentStatus === 'CANCELLED') {
          logger.debug('[SimpleAppDev] Reload canceled!');
          return { status: 'canceled' };
        }

        // QUEUED, RELOADING, RUNNING - still in progress
        logger.debug(`[SimpleAppDev] Reload in progress (${currentStatus}), waiting...`);
        await this.sleep(this.RELOAD_POLL_INTERVAL_MS);

      } catch (error) {
        logger.debug(`[SimpleAppDev] Error polling reload status: ${error instanceof Error ? error.message : String(error)}`);
        await this.sleep(this.RELOAD_POLL_INTERVAL_MS);
      }
    }

    logger.debug('[SimpleAppDev] Reload timed out after 5 minutes');
    return { status: 'timeout', error: 'Reload timed out after 5 minutes' };
  }

  /**
   * Build app link
   */
  private buildAppLink(appId: string): string {
    if (this.platform === 'on-premise') {
      return `${this.tenantUrl}/sense/app/${appId}`;
    }
    return `${this.tenantUrl}/sense/app/${appId}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
