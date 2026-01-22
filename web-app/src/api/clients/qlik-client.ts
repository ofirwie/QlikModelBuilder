/**
 * Qlik Cloud API Client
 * Handles all communication with Qlik Cloud tenant
 */
import { createFetch, fetchWithRetry } from './base-client'

export interface QlikSpace {
  id: string
  name: string
  type: 'managed' | 'shared' | 'data'
  createdAt: string
}

export interface QlikApp {
  id: string
  name: string
  spaceId: string
  createdAt: string
  modifiedAt: string
}

export interface QlikConnection {
  id: string
  name: string
  type: string
  connectionString?: string
}

export interface QlikTenantInfo {
  id: string
  name: string
  hostName: string
  region: string
}

const getApiKey = () => import.meta.env.VITE_QLIK_API_KEY || ''
const getTenantUrl = () => import.meta.env.VITE_QLIK_TENANT_URL || ''

export const qlikClient = {
  /**
   * Test connection to Qlik Cloud tenant
   */
  async testConnection(): Promise<{ success: boolean; tenantInfo?: QlikTenantInfo }> {
    try {
      const tenantInfo = await this.getTenantInfo()
      return { success: true, tenantInfo }
    } catch (error) {
      return { success: false }
    }
  },

  /**
   * Get tenant information
   */
  async getTenantInfo(): Promise<QlikTenantInfo> {
    const fetch = createFetch(getTenantUrl(), {
      Authorization: `Bearer ${getApiKey()}`,
    })

    return fetchWithRetry(() => fetch<QlikTenantInfo>('/api/v1/tenants/me'))
  },

  /**
   * List all spaces accessible to the user
   */
  async listSpaces(): Promise<QlikSpace[]> {
    const fetch = createFetch(getTenantUrl(), {
      Authorization: `Bearer ${getApiKey()}`,
    })

    const response = await fetchWithRetry(() =>
      fetch<{ data: QlikSpace[] }>('/api/v1/spaces')
    )
    return response.data
  },

  /**
   * Get space by ID
   */
  async getSpace(spaceId: string): Promise<QlikSpace> {
    const fetch = createFetch(getTenantUrl(), {
      Authorization: `Bearer ${getApiKey()}`,
    })

    return fetchWithRetry(() => fetch<QlikSpace>(`/api/v1/spaces/${spaceId}`))
  },

  /**
   * List apps in a space
   */
  async listApps(spaceId?: string): Promise<QlikApp[]> {
    const fetch = createFetch(getTenantUrl(), {
      Authorization: `Bearer ${getApiKey()}`,
    })

    const query = spaceId ? `?spaceId=${spaceId}` : ''
    const response = await fetchWithRetry(() =>
      fetch<{ data: QlikApp[] }>(`/api/v1/items?resourceType=app${query}`)
    )
    return response.data
  },

  /**
   * List data connections
   */
  async listConnections(): Promise<QlikConnection[]> {
    const fetch = createFetch(getTenantUrl(), {
      Authorization: `Bearer ${getApiKey()}`,
    })

    const response = await fetchWithRetry(() =>
      fetch<{ data: QlikConnection[] }>('/api/v1/data-connections')
    )
    return response.data
  },

  /**
   * Create a new app
   */
  async createApp(name: string, spaceId: string): Promise<QlikApp> {
    const fetch = createFetch(getTenantUrl(), {
      Authorization: `Bearer ${getApiKey()}`,
    })

    return fetchWithRetry(() =>
      fetch<QlikApp>('/api/v1/apps', {
        method: 'POST',
        body: JSON.stringify({
          attributes: { name, spaceId },
        }),
      })
    )
  },

  /**
   * Reload an app
   */
  async reloadApp(appId: string): Promise<{ reloadId: string }> {
    const fetch = createFetch(getTenantUrl(), {
      Authorization: `Bearer ${getApiKey()}`,
    })

    return fetchWithRetry(() =>
      fetch<{ reloadId: string }>(`/api/v1/reloads`, {
        method: 'POST',
        body: JSON.stringify({ appId }),
      })
    )
  },

  /**
   * Upload script to an app
   */
  async setAppScript(appId: string, script: string): Promise<void> {
    const fetch = createFetch(getTenantUrl(), {
      Authorization: `Bearer ${getApiKey()}`,
    })

    await fetchWithRetry(() =>
      fetch<void>(`/api/v1/apps/${appId}/data/script`, {
        method: 'PUT',
        body: JSON.stringify({ script }),
      })
    )
  },
}
