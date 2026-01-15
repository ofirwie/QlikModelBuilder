// ===== ON-PREMISE API ADAPTER =====
// Implements QlikApiAdapter for Qlik Sense On-Premise

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
import { AuthProvider, CertificateAuthProvider } from '../config/auth.js';
import { API_PATHS, TIMEOUT, RETRY, XRFKEY } from '../config/constants.js';
import https from 'https';
import fs from 'fs';
import axios, { AxiosInstance } from 'axios';

export class OnPremApiAdapter implements QlikApiAdapter {
  private baseUrl: string;
  private authProvider: AuthProvider;
  private virtualProxy?: string;
  private xrfKey: string;
  private httpsAgent?: https.Agent;
  private axiosInstance: AxiosInstance;

  constructor(
    tenantUrl: string,
    authProvider: AuthProvider,
    virtualProxy?: string
  ) {
    this.baseUrl = tenantUrl;
    this.authProvider = authProvider;
    this.virtualProxy = virtualProxy;
    this.xrfKey = this.generateXrfKey();

    // Initialize HTTPS agent with certificates if using certificate auth
    if (authProvider instanceof CertificateAuthProvider) {
      const certPath = authProvider.getCertPath();
      const keyPath = authProvider.getKeyPath();

      try {
        this.httpsAgent = new https.Agent({
          cert: fs.readFileSync(certPath),
          key: fs.readFileSync(keyPath),
          rejectUnauthorized: false, // Qlik self-signed certs
        });
      } catch (error) {
        throw new Error(`Failed to load certificates: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Create axios instance with optional certificate support
    this.axiosInstance = axios.create({
      httpsAgent: this.httpsAgent,
      timeout: TIMEOUT.API_REQUEST,
    });
  }

  // ===== XRFKEY GENERATION =====

  private generateXrfKey(): string {
    let result = '';
    for (let i = 0; i < XRFKEY.LENGTH; i++) {
      result += XRFKEY.CHARS.charAt(Math.floor(Math.random() * XRFKEY.CHARS.length));
    }
    return result;
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
      retries = RETRY.MAX_ATTEMPTS,
    } = options;

    // Build URL with virtual proxy and xrfkey
    let url = `${this.baseUrl}`;
    if (this.virtualProxy) {
      url += `/${this.virtualProxy}`;
    }
    url += path;

    // Add xrfkey query parameter
    const separator = url.includes('?') ? '&' : '?';
    url += `${separator}${XRFKEY.QUERY_PARAM}=${this.xrfKey}`;

    const headers = await this.authProvider.getAuthHeaders();
    // Add XrfKey header (required for QRS API)
    headers[XRFKEY.HEADER_NAME] = this.xrfKey;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await this.axiosInstance.request({
          url,
          method,
          headers,
          data: body,
        });

        return response.data as T;
      } catch (error: any) {
        // Handle axios errors
        if (error.response) {
          const status = error.response.status;
          const errorText = error.response.data ? JSON.stringify(error.response.data) : error.message;
          lastError = new Error(`API request failed: ${status} - ${errorText}`);

          // Don't retry on 4xx errors
          if (status >= 400 && status < 500) {
            throw lastError;
          }
        } else {
          lastError = error instanceof Error ? error : new Error(String(error));
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
    const qrsApp = await this.request<any>(`${API_PATHS.ONPREM.APPS}/${appId}`);
    return this.normalizeApp(qrsApp);
  }

  async listApps(options?: ListOptions): Promise<App[]> {
    const qrsApps = await this.request<any[]>(`${API_PATHS.ONPREM.APPS}/full`);
    return qrsApps.map(app => this.normalizeApp(app));
  }

  async createApp(name: string, containerId?: string): Promise<App> {
    const body: any = { name };

    if (containerId) {
      body.stream = { id: containerId };
    }

    const qrsApp = await this.request<any>(API_PATHS.ONPREM.APPS, {
      method: 'POST',
      body,
    });

    return this.normalizeApp(qrsApp);
  }

  async deleteApp(appId: string): Promise<void> {
    await this.request(`${API_PATHS.ONPREM.APPS}/${appId}`, {
      method: 'DELETE',
    });
  }

  // ===== RELOAD OPERATIONS =====

  async triggerReload(appId: string, options?: ReloadOptions): Promise<ReloadTask> {
    // On-Premise: Create reload task, then start it
    const taskBody: any = {
      task: {
        app: { id: appId },
        isManuallyTriggered: true,
        taskType: options?.partial ? 1 : 0, // 0 = full, 1 = partial
      }
    };

    const task = await this.request<any>(`${API_PATHS.ONPREM.RELOADS}`, {
      method: 'POST',
      body: taskBody,
    });

    // Start the task
    await this.request(`${API_PATHS.ONPREM.RELOADS}/${task.id}/start`, {
      method: 'POST',
    });

    return this.normalizeReloadTask(task);
  }

  async getReloadStatus(reloadId: string): Promise<ReloadTask> {
    const task = await this.request<any>(`${API_PATHS.ONPREM.RELOADS}/${reloadId}`);
    return this.normalizeReloadTask(task);
  }

  async getReloadHistory(appId: string, limit: number = 10): Promise<ReloadTask[]> {
    const filter = `app.id eq ${appId}`;
    const tasks = await this.request<any[]>(
      `${API_PATHS.ONPREM.RELOADS}/full?filter=${encodeURIComponent(filter)}`
    );

    return tasks
      .slice(0, limit)
      .map(task => this.normalizeReloadTask(task));
  }

  async cancelReload(reloadId: string): Promise<void> {
    await this.request(`${API_PATHS.ONPREM.RELOADS}/${reloadId}/stop`, {
      method: 'POST',
    });
  }

  // ===== CONTAINER OPERATIONS (Streams) =====

  async listContainers(): Promise<Container[]> {
    const streams = await this.request<any[]>(`${API_PATHS.ONPREM.STREAMS}/full`);
    return streams.map(stream => this.normalizeContainer(stream));
  }

  async getContainer(id: string): Promise<Container> {
    const stream = await this.request<any>(`${API_PATHS.ONPREM.STREAMS}/${id}`);
    return this.normalizeContainer(stream);
  }

  async getContainerItems(id: string): Promise<Item[]> {
    const filter = `stream.id eq ${id}`;
    const apps = await this.request<any[]>(
      `${API_PATHS.ONPREM.APPS}/full?filter=${encodeURIComponent(filter)}`
    );

    return apps.map(app => ({
      id: app.id,
      name: app.name,
      resourceType: 'app',
      streamId: id,
    }));
  }

  // ===== USER OPERATIONS =====

  async listUsers(options?: ListOptions): Promise<User[]> {
    const qrsUsers = await this.request<any[]>(`${API_PATHS.ONPREM.USERS}/full`);
    return qrsUsers.map(user => this.normalizeUser(user));
  }

  async getUser(userId: string): Promise<User> {
    const qrsUser = await this.request<any>(`${API_PATHS.ONPREM.USERS}/${userId}`);
    return this.normalizeUser(qrsUser);
  }

  // ===== NORMALIZATION METHODS =====
  // Convert QRS API format to common format

  private normalizeApp(qrsApp: any): App {
    return {
      id: qrsApp.id,
      name: qrsApp.name,
      description: qrsApp.description,
      ownerId: qrsApp.owner?.id,
      spaceId: qrsApp.stream?.id,
      createdDate: qrsApp.createdDate,
      modifiedDate: qrsApp.modifiedDate,
      // Keep original data for reference
      _raw: qrsApp,
    };
  }

  private normalizeReloadTask(qrsTask: any): ReloadTask {
    // Map QRS task status to common format
    let status: ReloadTask['status'] = 'PENDING';
    if (qrsTask.operational?.lastExecutionResult) {
      const result = qrsTask.operational.lastExecutionResult;
      if (result.status === 0 || result.status === 'Success') status = 'SUCCESS';
      else if (result.status === 1 || result.status === 'Failed') status = 'FAILED';
      else if (result.status === 2 || result.status === 'Running') status = 'RUNNING';
    }

    return {
      id: qrsTask.id,
      appId: qrsTask.app?.id || qrsTask.task?.app?.id,
      status,
      startTime: qrsTask.operational?.lastExecutionResult?.startTime,
      endTime: qrsTask.operational?.lastExecutionResult?.stopTime,
      duration: qrsTask.operational?.lastExecutionResult?.duration,
      log: qrsTask.operational?.lastExecutionResult?.details,
      errorMessage: qrsTask.operational?.lastExecutionResult?.fileReferenceDetails,
      _raw: qrsTask,
    };
  }

  private normalizeContainer(qrsStream: any): Container {
    return {
      id: qrsStream.id,
      name: qrsStream.name,
      type: 'stream' as any,
      description: qrsStream.description,
      _raw: qrsStream,
    };
  }

  private normalizeUser(qrsUser: any): User {
    return {
      id: qrsUser.id,
      name: qrsUser.name || qrsUser.userDirectory + '\\' + qrsUser.userId,
      email: qrsUser.email,
      status: qrsUser.inactive ? 'inactive' : 'active',
      _raw: qrsUser,
    };
  }

  // ===== PLATFORM INFO =====

  getPlatform(): 'cloud' | 'on-premise' {
    return 'on-premise';
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }
}
