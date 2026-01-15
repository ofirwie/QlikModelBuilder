/**
 * QlikModelBuilder - Qlik Cloud Service
 * Handles all Qlik Cloud API operations for the wizard
 */

import { ApiClient } from '../../utils/api-client.js';
import { CacheManager } from '../../utils/cache-manager.js';
import { SpaceCatalogService } from '../catalog/space-catalog-service.js';
import { logger } from '../../utils/logger.js';
import {
  SpaceConfig,
  ConnectionConfig,
  DataSourceType,
} from '../../wizard/types.js';

const log = logger.child({ service: 'QmbQlikService' });

// Space creation request
export interface CreateSpaceRequest {
  name: string;
  type: 'shared' | 'managed';
  description?: string;
}

// Space response
export interface SpaceResponse {
  id: string;
  name: string;
  type: string;
  description?: string;
  ownerId?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Connection response
export interface DataConnectionResponse {
  id: string;
  name: string;
  type: string;
  spaceId?: string;
  connectionString?: string;
  createdAt?: string;
}

// App creation request
export interface CreateAppRequest {
  name: string;
  spaceId: string;
  description?: string;
}

// App response
export interface AppResponse {
  id: string;
  name: string;
  spaceId?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * QmbQlikService - Qlik Cloud operations for the wizard
 */
export class QmbQlikService {
  private apiClient: ApiClient | null = null;
  private cacheManager: CacheManager | null = null;
  private spaceCatalogService: SpaceCatalogService | null = null;
  private initialized = false;

  /**
   * Initialize the service with API client
   */
  async initialize(apiClient: ApiClient, cacheManager: CacheManager): Promise<void> {
    this.apiClient = apiClient;
    this.cacheManager = cacheManager;
    this.spaceCatalogService = new SpaceCatalogService(apiClient, cacheManager);
    this.initialized = true;
    log.info('QmbQlikService initialized');
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized && this.apiClient !== null;
  }

  /**
   * Ensure service is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.apiClient) {
      throw new Error('QmbQlikService not initialized. Call initialize() first.');
    }
  }

  // ============================================================
  // Space Operations
  // ============================================================

  /**
   * List all spaces
   */
  async listSpaces(options?: {
    type?: 'all' | 'shared' | 'managed' | 'personal';
    query?: string;
    limit?: number;
  }): Promise<SpaceResponse[]> {
    this.ensureInitialized();

    try {
      const result = await this.spaceCatalogService!.getSpacesCatalog({
        spaceType: options?.type === 'all' ? undefined : options?.type,
        query: options?.query,
        limit: options?.limit || 100,
        includeMembers: false,
        includeCounts: false,
      });

      return result.spaces.map(space => ({
        id: space.id,
        name: space.name,
        type: space.type,
        description: space.description,
        ownerId: space.spaceInfo.ownerId,
        createdAt: space.spaceInfo.createdDate,
        updatedAt: space.spaceInfo.modifiedDate,
      }));
    } catch (error) {
      log.error('Failed to list spaces:', error);
      throw error;
    }
  }

  /**
   * Get space by ID
   */
  async getSpace(spaceId: string): Promise<SpaceResponse | null> {
    this.ensureInitialized();

    try {
      const space = await this.spaceCatalogService!.getSpaceDetails(spaceId, false, false);
      if (!space) return null;

      return {
        id: space.id,
        name: space.name,
        type: space.type,
        description: space.description,
        ownerId: space.spaceInfo.ownerId,
        createdAt: space.spaceInfo.createdDate,
        updatedAt: space.spaceInfo.modifiedDate,
      };
    } catch (error) {
      log.error(`Failed to get space ${spaceId}:`, error);
      return null;
    }
  }

  /**
   * Create a new space
   */
  async createSpace(request: CreateSpaceRequest): Promise<SpaceResponse> {
    this.ensureInitialized();

    try {
      log.info(`Creating space: ${request.name} (${request.type})`);

      const response = await this.apiClient!.makeRequest('/api/v1/spaces', 'POST', {
        name: request.name,
        type: request.type,
        description: request.description || '',
      });

      return {
        id: response.id,
        name: response.name,
        type: response.type,
        description: response.description,
        ownerId: response.ownerId,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt,
      };
    } catch (error) {
      log.error('Failed to create space:', error);
      throw error;
    }
  }

  // ============================================================
  // Data Connection Operations
  // ============================================================

  /**
   * List data connections
   */
  async listConnections(options?: {
    spaceId?: string;
    type?: string;
  }): Promise<DataConnectionResponse[]> {
    this.ensureInitialized();

    try {
      let url = '/api/v1/data-connections?limit=100';
      if (options?.spaceId) {
        url += `&spaceId=${options.spaceId}`;
      }

      const response = await this.apiClient!.makeRequest(url, 'GET');
      const connections = response.data || response || [];

      return connections.map((conn: any) => ({
        id: conn.id,
        name: conn.qName || conn.name,
        type: conn.type || conn.datasourceType,
        spaceId: conn.spaceId,
        connectionString: conn.connectionString,
        createdAt: conn.createdAt,
      }));
    } catch (error) {
      log.error('Failed to list connections:', error);
      throw error;
    }
  }

  /**
   * Get connection by ID
   */
  async getConnection(connectionId: string): Promise<DataConnectionResponse | null> {
    this.ensureInitialized();

    try {
      const response = await this.apiClient!.makeRequest(`/api/v1/data-connections/${connectionId}`, 'GET');

      return {
        id: response.id,
        name: response.qName || response.name,
        type: response.type || response.datasourceType,
        spaceId: response.spaceId,
        connectionString: response.connectionString,
        createdAt: response.createdAt,
      };
    } catch (error) {
      log.error(`Failed to get connection ${connectionId}:`, error);
      return null;
    }
  }

  /**
   * Create a data connection
   */
  async createConnection(spaceId: string, config: ConnectionConfig): Promise<DataConnectionResponse> {
    this.ensureInitialized();

    try {
      log.info(`Creating connection: ${config.name} in space ${spaceId}`);

      // Build connection string based on type
      const connectionString = this.buildConnectionString(config);

      const response = await this.apiClient!.makeRequest('/api/v1/data-connections', 'POST', {
        qName: config.name,
        spaceId: spaceId,
        datasourceType: this.mapConnectionType(config.type),
        connectionString: connectionString,
        type: config.type,
      });

      return {
        id: response.id,
        name: response.qName || response.name,
        type: response.type,
        spaceId: response.spaceId,
        connectionString: response.connectionString,
        createdAt: response.createdAt,
      };
    } catch (error) {
      log.error('Failed to create connection:', error);
      throw error;
    }
  }

  /**
   * Test a connection
   */
  async testConnection(connectionId: string): Promise<{ success: boolean; error?: string }> {
    this.ensureInitialized();

    try {
      // Try to get metadata to verify connection works
      await this.apiClient!.makeRequest(`/api/v1/data-connections/${connectionId}/metadata`, 'GET');
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  // ============================================================
  // App Operations
  // ============================================================

  /**
   * List apps in a space
   */
  async listApps(spaceId?: string): Promise<AppResponse[]> {
    this.ensureInitialized();

    try {
      let url = '/api/v1/apps?limit=100';
      if (spaceId) {
        url += `&spaceId=${spaceId}`;
      }

      const response = await this.apiClient!.makeRequest(url, 'GET');
      const apps = response.data || response || [];

      return apps.map((app: any) => ({
        id: app.id,
        name: app.name,
        spaceId: app.spaceId,
        description: app.description,
        createdAt: app.createdDate,
        updatedAt: app.modifiedDate,
      }));
    } catch (error) {
      log.error('Failed to list apps:', error);
      throw error;
    }
  }

  /**
   * Create a new app
   */
  async createApp(request: CreateAppRequest): Promise<AppResponse> {
    this.ensureInitialized();

    try {
      log.info(`Creating app: ${request.name} in space ${request.spaceId}`);

      const response = await this.apiClient!.makeRequest('/api/v1/apps', 'POST', {
        attributes: {
          name: request.name,
          description: request.description || '',
          spaceId: request.spaceId,
        },
      });

      return {
        id: response.attributes?.id || response.id,
        name: response.attributes?.name || response.name,
        spaceId: response.attributes?.spaceId || response.spaceId,
        description: response.attributes?.description,
        createdAt: response.attributes?.createdDate,
        updatedAt: response.attributes?.modifiedDate,
      };
    } catch (error) {
      log.error('Failed to create app:', error);
      throw error;
    }
  }

  /**
   * Update app script
   */
  async updateAppScript(appId: string, script: string): Promise<boolean> {
    this.ensureInitialized();

    try {
      log.info(`Updating script for app: ${appId}`);

      await this.apiClient!.makeRequest(`/api/v1/apps/${appId}/script`, 'PUT', {
        script: script,
      });

      return true;
    } catch (error) {
      log.error('Failed to update app script:', error);
      throw error;
    }
  }

  /**
   * Reload an app
   */
  async reloadApp(appId: string): Promise<{ success: boolean; reloadId?: string; error?: string }> {
    this.ensureInitialized();

    try {
      log.info(`Reloading app: ${appId}`);

      const response = await this.apiClient!.makeRequest(`/api/v1/apps/${appId}/reloads`, 'POST', {
        partial: false,
      });

      return {
        success: true,
        reloadId: response.id,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  /**
   * Get reload status
   */
  async getReloadStatus(appId: string, reloadId: string): Promise<{
    status: 'queued' | 'running' | 'succeeded' | 'failed';
    error?: string;
  }> {
    this.ensureInitialized();

    try {
      const response = await this.apiClient!.makeRequest(`/api/v1/apps/${appId}/reloads/${reloadId}`, 'GET');

      return {
        status: response.status?.toLowerCase() || 'queued',
        error: response.errorMessage,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { status: 'failed', error: message };
    }
  }

  // ============================================================
  // Table Metadata Operations
  // ============================================================

  /**
   * Get tables from a connection
   */
  async getTablesFromConnection(connectionId: string): Promise<Array<{
    name: string;
    schema?: string;
    type: 'table' | 'view';
  }>> {
    this.ensureInitialized();

    try {
      const response = await this.apiClient!.makeRequest(
        `/api/v1/data-connections/${connectionId}/metadata/tables`,
        'GET'
      );

      const tables = response.data || response || [];
      return tables.map((t: any) => ({
        name: t.name || t.tableName,
        schema: t.schema || t.schemaName,
        type: t.type === 'VIEW' ? 'view' : 'table',
      }));
    } catch (error) {
      log.error('Failed to get tables from connection:', error);
      throw error;
    }
  }

  /**
   * Get columns from a table
   */
  async getColumnsFromTable(connectionId: string, tableName: string, schema?: string): Promise<Array<{
    name: string;
    type: string;
    nullable: boolean;
  }>> {
    this.ensureInitialized();

    try {
      const fullTableName = schema ? `${schema}.${tableName}` : tableName;
      const response = await this.apiClient!.makeRequest(
        `/api/v1/data-connections/${connectionId}/metadata/tables/${encodeURIComponent(fullTableName)}/columns`,
        'GET'
      );

      const columns = response.data || response || [];
      return columns.map((c: any) => ({
        name: c.name || c.columnName,
        type: c.dataType || c.type,
        nullable: c.nullable !== false,
      }));
    } catch (error) {
      log.error('Failed to get columns from table:', error);
      throw error;
    }
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  /**
   * Build connection string based on config
   */
  private buildConnectionString(config: ConnectionConfig): string {
    switch (config.type) {
      case 'sqlserver':
        return `OLEDB CONNECT TO [Provider=MSOLEDBSQL;Data Source=${config.server};Initial Catalog=${config.database};User Id=${config.username};Password=${config.password}]`;

      case 'postgresql':
        return `OLEDB CONNECT TO [Provider=POSTGRESQL;Server=${config.server};Port=${config.port || 5432};Database=${config.database};User Id=${config.username};Password=${config.password}]`;

      case 'oracle':
        return `OLEDB CONNECT TO [Provider=OraOLEDB.Oracle;Data Source=${config.server}/${config.database};User Id=${config.username};Password=${config.password}]`;

      case 'mysql':
        return `OLEDB CONNECT TO [Provider=MySQLProv;Data Source=${config.database};Server=${config.server};User Id=${config.username};Password=${config.password}]`;

      case 'rest_api':
        return `REST CONNECT TO [${config.baseUrl}]`;

      default:
        return config.connectionString || '';
    }
  }

  /**
   * Map connection type to Qlik datasource type
   */
  private mapConnectionType(type: DataSourceType): string {
    const mapping: Record<DataSourceType, string> = {
      'sqlserver': 'SqlServer',
      'postgresql': 'PostgreSQL',
      'oracle': 'Oracle',
      'mysql': 'MySQL',
      'rest_api': 'REST',
      'excel': 'Excel',
      'csv': 'LocalFile',
      'json': 'LocalFile',
      'qvd': 'QVD',
    };
    return mapping[type] || type;
  }
}

// Singleton instance
let qmbQlikServiceInstance: QmbQlikService | null = null;

/**
 * Get the singleton QmbQlikService instance
 */
export function getQmbQlikService(): QmbQlikService {
  if (!qmbQlikServiceInstance) {
    qmbQlikServiceInstance = new QmbQlikService();
  }
  return qmbQlikServiceInstance;
}
