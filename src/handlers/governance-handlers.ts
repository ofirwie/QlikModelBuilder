/**
 * Governance Handlers - Connect MCP tools to governance services
 * Updated with platform support for Cloud and On-Premise
 */

import { ApiClient } from '../utils/api-client.js';
import { CacheManager } from '../utils/cache-manager.js';
import { logger } from '../utils/logger.js';
import { createMcpResponse, createMcpError, McpResponse } from './response-helper.js';

const log = logger.child({ service: 'GovernanceHandlers' });

/**
 * Handler for get_tenant_info tool
 * Get basic tenant information
 */
export async function handleGetTenantInfo(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<McpResponse> {
  log.debug(`[GovernanceHandlers] get_tenant_info called (platform: ${platform})`);

  try {
    let tenantInfo: any;

    if (platform === 'on-premise') {
      const aboutResponse = await apiClient.makeRequest('/qrs/about');
      tenantInfo = {
        platform: 'on-premise',
        serverVersion: aboutResponse.buildVersion,
        serverNodeId: aboutResponse.serverNodeId,
        addOns: aboutResponse.addOns,
        schemaPath: aboutResponse.schemaPath
      };

      try {
        const licenseResponse = await apiClient.makeRequest('/qrs/license');
        tenantInfo.license = {
          serial: licenseResponse.serial,
          name: licenseResponse.name,
          organization: licenseResponse.organization,
          product: licenseResponse.product,
          numberOfCores: licenseResponse.numberOfCores,
          lef: licenseResponse.lef
        };
      } catch (e) {
        log.debug('[GovernanceHandlers] Error fetching QRS license:', e);
      }
    } else {
      tenantInfo = await apiClient.makeRequest('/api/v1/users/me');
    }

    return createMcpResponse({
      success: true,
      platform,
      tenantInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.debug('[GovernanceHandlers] Error in get_tenant_info:', error);
    return createMcpError(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Handler for get_user_info tool
 * Get detailed user information
 */
export async function handleGetUserInfo(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<McpResponse> {
  log.debug(`[GovernanceHandlers] get_user_info called (platform: ${platform})`);

  try {
    if (!args?.userId) {
      throw new Error('User ID is required');
    }

    let userInfo: any;

    if (platform === 'on-premise') {
      const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(args.userId);
      let userResponse: any;

      if (isGuid) {
        userResponse = await apiClient.makeRequest(`/qrs/user/${args.userId}`);
      } else {
        const filter = `userId eq '${args.userId}'`;
        const encodedFilter = encodeURIComponent(filter);
        const users = await apiClient.makeRequest(`/qrs/user?filter=${encodedFilter}`);

        if (!users || users.length === 0) {
          throw new Error(`User not found: ${args.userId}`);
        }
        userResponse = users[0];
      }

      userInfo = {
        id: userResponse.id,
        userId: userResponse.userId,
        userDirectory: userResponse.userDirectory,
        name: userResponse.name,
        roles: userResponse.roles || [],
        inactive: userResponse.inactive,
        removed: userResponse.removedExternally,
        createdDate: userResponse.createdDate,
        modifiedDate: userResponse.modifiedDate,
        platform: 'on-premise'
      };
    } else {
      userInfo = await apiClient.makeRequest(`/api/v1/users/${args.userId}`);
    }

    return createMcpResponse({
      success: true,
      platform,
      userInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.debug('[GovernanceHandlers] Error in get_user_info:', error);
    return createMcpError(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Handler for search_users tool
 * Search for users by name or email
 */
export async function handleSearchUsers(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<McpResponse> {
  log.debug(`[GovernanceHandlers] search_users called (platform: ${platform})`);

  try {
    if (!args?.query) {
      throw new Error('Search query is required');
    }

    let users: any[];
    let totalCount: number;

    if (platform === 'on-premise') {
      const filter = `name so '${args.query}' or userId so '${args.query}'`;
      const encodedFilter = encodeURIComponent(filter);
      const response = await apiClient.makeRequest(`/qrs/user?filter=${encodedFilter}`);
      const qrsUsers = response.data || response || [];

      users = qrsUsers.slice(0, args.limit || 50).map((user: any) => ({
        id: user.id,
        userId: user.userId,
        userDirectory: user.userDirectory,
        name: user.name,
        inactive: user.inactive,
        createdDate: user.createdDate
      }));
      totalCount = qrsUsers.length;
    } else {
      const response = await apiClient.getUsers({
        search: args.query,
        limit: args.limit || 50
      });
      users = response.data || [];
      totalCount = response.totalCount || users.length;
    }

    return createMcpResponse({
      success: true,
      platform,
      query: args.query,
      users,
      totalCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.debug('[GovernanceHandlers] Error in search_users:', error);
    return createMcpError(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Handler for health_check tool
 * Check server status and service health
 */
export async function handleHealthCheck(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<McpResponse> {
  log.debug(`[GovernanceHandlers] health_check called (platform: ${platform})`);

  try {
    let healthData: any;

    if (platform === 'on-premise') {
      healthData = await apiClient.makeRequest('/qrs/about');

      return createMcpResponse({
        success: true,
        status: 'healthy',
        platform: 'on-premise',
        services: {
          qrs: 'operational',
          cache: cacheManager ? 'operational' : 'unavailable'
        },
        serverInfo: {
          version: healthData.buildVersion,
          nodeId: healthData.serverNodeId
        },
        timestamp: new Date().toISOString()
      });
    }

    healthData = await apiClient.makeRequest('/api/v1/users/me');

    return createMcpResponse({
      success: true,
      status: 'healthy',
      platform: 'cloud',
      services: {
        api: 'operational',
        cache: cacheManager ? 'operational' : 'unavailable'
      },
      timestamp: new Date().toISOString(),
      tenant: healthData.tenantId || 'unknown'
    });
  } catch (error) {
    log.debug('[GovernanceHandlers] Error in health_check:', error);
    return createMcpError(
      error instanceof Error ? error.message : String(error),
      { status: 'unhealthy', platform, timestamp: new Date().toISOString() }
    );
  }
}

/**
 * Handler for get_license_info tool (New)
 * Get license information
 */
export async function handleGetLicenseInfo(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any,
  platform: 'cloud' | 'on-premise' = 'cloud',
  tenantUrl: string = ''
): Promise<McpResponse> {
  log.debug(`[GovernanceHandlers] get_license_info called (platform: ${platform})`);

  try {
    let licenseInfo: any;

    if (platform === 'on-premise') {
      const licenseResponse = await apiClient.makeRequest('/qrs/license');
      licenseInfo = {
        platform: 'on-premise',
        serial: licenseResponse.serial,
        name: licenseResponse.name,
        organization: licenseResponse.organization,
        product: licenseResponse.product,
        numberOfCores: licenseResponse.numberOfCores,
        lef: licenseResponse.lef,
        isExpired: licenseResponse.isExpired,
        expiredReason: licenseResponse.expiredReason
      };

      try {
        const accessTypes = await apiClient.makeRequest('/qrs/license/accesstypeinfo');
        licenseInfo.accessTypes = accessTypes;
      } catch (e) {
        // Access type info might not be available
      }
    } else {
      licenseInfo = await apiClient.makeRequest('/api/v1/licenses/overview');
      licenseInfo.platform = 'cloud';
    }

    return createMcpResponse({
      success: true,
      platform,
      licenseInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.debug('[GovernanceHandlers] Error in get_license_info:', error);
    return createMcpError(error instanceof Error ? error.message : String(error));
  }
}
