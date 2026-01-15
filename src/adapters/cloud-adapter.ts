// ===== CLOUD API ADAPTER =====
// Implements QlikApiAdapter for Qlik Cloud

import {
  QlikApiAdapter,
  App,
  ReloadTask,
  Container,
  Item,
  User,
  ListOptions,
  ReloadOptions,
} from './base-adapter.js';
import { AuthProvider } from '../config/auth.js';
import { API_PATHS, TIMEOUT, RETRY } from '../config/constants.js';

export class CloudApiAdapter implements QlikApiAdapter {
  private baseUrl: string;
  private authProvider: AuthProvider;

  constructor(tenantUrl: string, authProvider: AuthProvider) {
    this.baseUrl = tenantUrl;
    this.authProvider = authProvider;
  }

  // ===== CORE REQUEST METHOD =====

  private async request<T>(
    path: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: any;
      timeout?: number;
      retries?: number;
    } = {}
  ): Promise<T> {
    const {
      method = 'GET',
      body,
      timeout = TIMEOUT.API_REQUEST,
      retries = RETRY.MAX_ATTEMPTS,
    } = options;

    const url = `${this.baseUrl}${path}`;
    const headers = await this.authProvider.getAuthHeaders();

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `API request failed: ${response.status} ${response.statusText} - ${errorText}`
          );
        }

        // Handle empty responses
        const text = await response.text();
        return text ? JSON.parse(text) : ({} as T);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on 4xx errors (client errors)
        if (lastError.message.includes('400') ||
            lastError.message.includes('401') ||
            lastError.message.includes('403') ||
            lastError.message.includes('404')) {
          throw lastError;
        }

        // Wait before retry with exponential backoff
        if (attempt < retries - 1) {
          await new Promise(resolve =>
            setTimeout(resolve, RETRY.BACKOFF_MS * Math.pow(RETRY.BACKOFF_MULTIPLIER, attempt))
          );
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  // ===== APP OPERATIONS =====

  async getApp(appId: string): Promise<App> {
    return this.request<App>(`${API_PATHS.CLOUD.APPS}/${appId}`);
  }

  async listApps(options?: ListOptions): Promise<App[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.offset) params.append('skip', String(options.offset));
    if (options?.sort) params.append('sort', options.sort);

    const queryString = params.toString();
    const path = queryString ? `${API_PATHS.CLOUD.APPS}?${queryString}` : API_PATHS.CLOUD.APPS;

    const response = await this.request<{ data: App[] }>(path);
    return response.data || [];
  }

  async createApp(name: string, containerId?: string): Promise<App> {
    const body: any = {
      attributes: { name }
    };

    if (containerId) {
      body.spaceId = containerId;
    }

    return this.request<App>(API_PATHS.CLOUD.APPS, {
      method: 'POST',
      body,
    });
  }

  async deleteApp(appId: string): Promise<void> {
    await this.request(`${API_PATHS.CLOUD.APPS}/${appId}`, {
      method: 'DELETE',
    });
  }

  // ===== RELOAD OPERATIONS =====

  async triggerReload(appId: string, options?: ReloadOptions): Promise<ReloadTask> {
    const body: any = { appId };

    if (options?.partial) {
      body.partial = true;
    }

    return this.request<ReloadTask>(API_PATHS.CLOUD.RELOADS, {
      method: 'POST',
      body,
    });
  }

  async getReloadStatus(reloadId: string): Promise<ReloadTask> {
    return this.request<ReloadTask>(`${API_PATHS.CLOUD.RELOADS}/${reloadId}`);
  }

  async getReloadHistory(appId: string, limit: number = 10): Promise<ReloadTask[]> {
    const params = new URLSearchParams({
      appId,
      limit: String(limit),
      sort: '-createdDate',
    });

    const response = await this.request<{ data: ReloadTask[] }>(
      `${API_PATHS.CLOUD.RELOADS}?${params.toString()}`
    );

    return response.data || [];
  }

  async cancelReload(reloadId: string): Promise<void> {
    await this.request(`${API_PATHS.CLOUD.RELOADS}/${reloadId}/actions/cancel`, {
      method: 'POST',
    });
  }

  // ===== CONTAINER OPERATIONS (Spaces) =====

  async listContainers(): Promise<Container[]> {
    const response = await this.request<{ data: Container[] }>(API_PATHS.CLOUD.SPACES);
    return response.data || [];
  }

  async getContainer(id: string): Promise<Container> {
    return this.request<Container>(`${API_PATHS.CLOUD.SPACES}/${id}`);
  }

  async getContainerItems(id: string): Promise<Item[]> {
    const params = new URLSearchParams({ spaceId: id });
    const response = await this.request<{ data: Item[] }>(
      `${API_PATHS.CLOUD.ITEMS}?${params.toString()}`
    );
    return response.data || [];
  }

  // ===== USER OPERATIONS =====

  async listUsers(options?: ListOptions): Promise<User[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.offset) params.append('skip', String(options.offset));

    const queryString = params.toString();
    const path = queryString ? `${API_PATHS.CLOUD.USERS}?${queryString}` : API_PATHS.CLOUD.USERS;

    const response = await this.request<{ data: User[] }>(path);
    return response.data || [];
  }

  async getUser(userId: string): Promise<User> {
    return this.request<User>(`${API_PATHS.CLOUD.USERS}/${userId}`);
  }

  // ===== PLATFORM INFO =====

  getPlatform(): 'cloud' | 'on-premise' {
    return 'cloud';
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }
}
