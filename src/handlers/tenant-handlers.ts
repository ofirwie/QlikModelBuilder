/**
 * Tenant Management Handlers
 * Handle switching between Qlik Cloud tenants
 */

import {
  getTenants,
  getActiveTenant,
  setActiveTenant,
  listTenantsFormatted,
} from '../config/tenants.js';
import { logger } from '../utils/logger.js';

/**
 * List all configured tenants
 */
export async function handleListTenants(): Promise<{
  content: Array<{ type: string; text: string }>;
}> {
  try {
    const tenants = getTenants();
    const activeTenant = getActiveTenant();

    const result = {
      success: true,
      activeTenant: activeTenant.id,
      tenants: tenants.map(t => ({
        id: t.id,
        name: t.name,
        url: t.url,
        description: t.description,
        isActive: t.id === activeTenant.id,
      })),
      formatted: listTenantsFormatted(),
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    logger.error('Failed to list tenants', error instanceof Error ? error : new Error(String(error)));
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      ],
    };
  }
}

/**
 * Switch to a different tenant
 */
export async function handleSwitchTenant(args: {
  tenantId: string;
}): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const { tenantId } = args;

    if (!tenantId) {
      throw new Error('tenantId is required');
    }

    const previousTenant = getActiveTenant();
    const newTenant = setActiveTenant(tenantId);

    // Test connection to new tenant
    let connectionStatus = 'unknown';
    try {
      const response = await fetch(`${newTenant.url}/api/v1/users/me`, {
        headers: { Authorization: `Bearer ${newTenant.apiKey}` },
      });

      if (response.ok) {
        const user = await response.json();
        connectionStatus = `connected as ${user.name} (${user.email})`;
      } else {
        connectionStatus = `connection failed: ${response.status}`;
      }
    } catch (e) {
      connectionStatus = `connection error: ${e instanceof Error ? e.message : String(e)}`;
    }

    const result = {
      success: true,
      message: `Switched from "${previousTenant.name}" to "${newTenant.name}"`,
      previousTenant: {
        id: previousTenant.id,
        name: previousTenant.name,
      },
      activeTenant: {
        id: newTenant.id,
        name: newTenant.name,
        url: newTenant.url,
        description: newTenant.description,
      },
      connectionStatus,
    };

    logger.info('Switched tenant', { from: previousTenant.id, to: newTenant.id });

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    logger.error('Failed to switch tenant', error instanceof Error ? error : new Error(String(error)));
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
            hint: 'Use qlik_list_tenants to see available tenants',
          }),
        },
      ],
    };
  }
}

/**
 * Get active tenant information
 */
export async function handleGetActiveTenant(): Promise<{
  content: Array<{ type: string; text: string }>;
}> {
  try {
    const tenant = getActiveTenant();

    // Test connection with 3 second timeout
    let connectionStatus = 'unknown';
    let userInfo = null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${tenant.url}/api/v1/users/me`, {
        headers: { Authorization: `Bearer ${tenant.apiKey}` },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        userInfo = await response.json();
        connectionStatus = 'connected';
      } else {
        connectionStatus = `error: ${response.status}`;
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        connectionStatus = 'timeout';
      } else {
        connectionStatus = `error: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    const result = {
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        url: tenant.url,
        description: tenant.description,
      },
      connection: {
        status: connectionStatus,
        user: userInfo
          ? {
              id: userInfo.id,
              name: userInfo.name,
              email: userInfo.email,
            }
          : null,
      },
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    logger.error('Failed to get active tenant', error instanceof Error ? error : new Error(String(error)));
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      ],
    };
  }
}
