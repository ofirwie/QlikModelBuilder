import { ApiClient } from '../utils/api-client.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ service: 'Reload' });

// Types
export type ReloadState = 'queued' | 'reloading' | 'succeeded' | 'failed' | 'canceled' | 'skipped' | 'error';
export type ReloadTrigger = 'manual' | 'scheduled' | 'api' | 'automation' | 'external';

// QRS Task Operational Status codes (0-8)
export type QRSOperationalStatus = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface ReloadTask {
  id: string;
  appId: string;
  appName?: string;
  state: ReloadState;
  startTime?: string;
  endTime?: string;
  duration?: number;
  progress?: number;
  engineHasData?: boolean;
  partial?: boolean;
  log?: string;
  errorMessage?: string;
  userId?: string;
  userName?: string;
  tenantId?: string;
  spaceId?: string;
  spaceName?: string;
  trigger?: ReloadTrigger;
  // On-premise specific
  taskId?: string;       // QRS task ID (different from execution ID)
  executionId?: string;  // QRS execution ID
}

export interface ReloadOptions {
  partial?: boolean;
  skipStore?: boolean;
  waitForCompletion?: boolean;
  timeoutSeconds?: number;
  pollIntervalSeconds?: number;
  maxRetries?: number;
  maxConsecutiveErrors?: number;
}

export interface StatusHistoryEntry {
  timestamp: string;
  state: ReloadState;
  progress?: number;
  message?: string;
  error?: boolean;
}

export interface ReloadStatistics {
  total: number;
  succeeded: number;
  failed: number;
  canceled: number;
  averageDuration: number;
  successRate: number;
  failureRate: number;
  lastSuccessful?: {
    reloadId: string;
    timestamp: string;
    duration: number;
  };
  lastFailed?: {
    reloadId: string;
    timestamp: string;
    errorMessage?: string;
  };
}

export interface StatusUpdate {
  reloadId: string;
  state: ReloadState | 'error';
  progress?: number;
  message?: string;
  timestamp?: string;
  duration?: number;
}

export interface MonitoringResult {
  completed: boolean;
  finalStatus?: ReloadTask;
  timeout?: boolean;
  error?: Error;
}

export class ReloadService {
  private apiClient: ApiClient;
  private cacheManager: any; // Add cache manager for compatibility
  private platform: 'cloud' | 'on-premise';
  private tenantUrl: string;

  // Configuration constants
  private readonly DEFAULT_TIMEOUT_SECONDS = 300; // 5 minutes
  private readonly DEFAULT_POLL_INTERVAL_SECONDS = 2;
  private readonly DEFAULT_MAX_RETRIES = 3;
  private readonly DEFAULT_MAX_CONSECUTIVE_ERRORS = 5;
  private readonly STALL_DETECTION_THRESHOLD = 10; // Number of polls with no progress

  // QRS Status Code Mapping (On-Premise)
  // 0=NeverStarted, 1=Triggered, 2=Started, 3=Queued, 4=AbortInitiated, 5=Aborting, 6=Aborted, 7=Finished, 8=Error
  private readonly QRS_STATUS_MAP: Record<number, ReloadState> = {
    0: 'queued',      // NeverStarted
    1: 'queued',      // Triggered
    2: 'reloading',   // Started
    3: 'queued',      // Queued
    4: 'canceled',    // AbortInitiated
    5: 'canceled',    // Aborting
    6: 'canceled',    // Aborted
    7: 'succeeded',   // Finished
    8: 'failed'       // Error
  };

  constructor(
    apiClient: ApiClient,
    cacheManager?: any,
    platform: 'cloud' | 'on-premise' = 'cloud',
    tenantUrl: string = ''
  ) {
    this.apiClient = apiClient;
    this.cacheManager = cacheManager;
    this.platform = platform;
    this.tenantUrl = tenantUrl;
  }

  /**
   * Trigger a reload for an app with improved error handling
   * Routes to platform-specific implementation
   */
  async triggerReload(appId: string, options: ReloadOptions = {}): Promise<any> {
    log.info(` Triggering reload for app: ${appId} (platform: ${this.platform})`);

    if (this.platform === 'on-premise') {
      return this.triggerReloadOnPrem(appId, options);
    }
    return this.triggerReloadCloud(appId, options);
  }

  /**
   * Cloud implementation: Trigger reload via /api/v1/reloads
   */
  private async triggerReloadCloud(appId: string, options: ReloadOptions = {}): Promise<any> {
    try {
      // Get app details first
      const appResponse = await this.apiClient.makeRequest(`/api/v1/apps/${appId}`, 'GET');
      const app = appResponse.data || appResponse;

      // Trigger the reload
      const reloadPayload = {
        appId: appId,
        partial: options.partial || false,
        skipStore: options.skipStore || false
      };

      const reloadResponse = await this.apiClient.makeRequest('/api/v1/reloads', 'POST', reloadPayload);
      const reloadTask = reloadResponse.data || reloadResponse;

      log.info(` Reload triggered with ID: ${reloadTask.id}`);

      // IMPORTANT: Immediately check the reload status after triggering
      // Because the reload might complete very quickly or already be done
      await this.sleep(1000); // Brief pause to let the reload start

      try {
        const initialStatus = await this.getReloadStatus(reloadTask.id);
        log.info(` Initial reload status: ${initialStatus.state}`);

        // If the reload is already complete, return immediately
        if (this.isCompletionState(initialStatus.state)) {
          return {
            success: initialStatus.state === 'succeeded',
            message: `Reload ${initialStatus.state} immediately for app: ${app.name}`,
            app: {
              id: app.id,
              name: app.name,
              spaceId: app.spaceId
            },
            reload: {
              id: reloadTask.id,
              state: initialStatus.state,
              startTime: initialStatus.startTime,
              endTime: initialStatus.endTime,
              duration: initialStatus.duration,
              errorMessage: initialStatus.errorMessage
            }
          };
        }
      } catch (statusError) {
        log.warn(' Could not get initial status:', statusError);
      }

      // If wait for completion is requested, monitor the reload
      if (options.waitForCompletion) {
        return await this.waitForReloadCompletionSafe(
          reloadTask.id,
          appId,
          app.name,
          options
        );
      }

      // Return with reload info
      return {
        success: true,
        message: `Reload triggered for app: ${app.name}. Check status with reload ID: ${reloadTask.id}`,
        app: {
          id: app.id,
          name: app.name,
          spaceId: app.spaceId
        },
        reload: {
          id: reloadTask.id,
          state: reloadTask.state || 'queued',
          startTime: reloadTask.startTime || new Date().toISOString(),
          partial: options.partial || false
        },
        monitorUrl: `/reloads/${reloadTask.id}`,
        instructions: 'Use get_reload_status to check the reload progress'
      };
    } catch (error) {
      log.error(' Failed to trigger reload (Cloud):', error);
      throw error;
    }
  }

  /**
   * On-Premise implementation: 2-step QRS reload task workflow
   * Step 1: Create/find reload task for the app
   * Step 2: Start the task execution
   */
  private async triggerReloadOnPrem(appId: string, options: ReloadOptions = {}): Promise<any> {
    try {
      log.info(` On-premise reload for app: ${appId}`);

      // Get app details via QRS
      const appResponse = await this.apiClient.makeRequest(`/qrs/app/${appId}`, 'GET');
      const app = appResponse.data || appResponse;
      const appName = app.name || 'Unknown App';

      // Step 1: Find existing reload task for this app or create a new one
      let taskId: string;

      // Check for existing reload tasks for this app
      const existingTasks = await this.apiClient.makeRequest(
        `/qrs/reloadtask?filter=app.id eq ${appId}`,
        'GET'
      );
      const tasks = existingTasks.data || existingTasks || [];

      if (tasks.length > 0) {
        // Use the first existing task
        taskId = tasks[0].id;
        log.info(` Using existing reload task: ${taskId}`);
      } else {
        // Create a new reload task using correct QRS endpoint
        // POST /qrs/reloadtask/create - NOT /qrs/reloadtask
        // Note: 'operational' is read-only, don't include in POST body
        const newTask = await this.apiClient.makeRequest('/qrs/reloadtask/create', 'POST', {
          task: {
            app: { id: appId },
            name: `MCP Reload - ${appName}`,
            isManuallyTriggered: true
          }
        });
        taskId = (newTask.data || newTask).id;
        log.info(` Created new reload task: ${taskId}`);
      }

      // Step 2: Start the reload task using correct QRS endpoint
      // POST /qrs/task/{id}/start/synchronous - NOT /qrs/reloadtask/{id}/start
      // Returns GUID session ID for polling
      const startResponse = await this.apiClient.makeRequest(
        `/qrs/task/${taskId}/start/synchronous`,
        'POST'
      );

      // The start response returns a GUID (session ID) for polling
      const execution = startResponse.data || startResponse;
      // Response is typically just the GUID string or { value: "guid" }
      const executionId = typeof execution === 'string' ? execution : (execution.value || execution.id || taskId);

      log.info(` Reload task started. Task: ${taskId}, Execution: ${executionId}`);

      // Brief pause to let the reload start
      await this.sleep(1000);

      // Check initial status
      try {
        const initialStatus = await this.getReloadStatusOnPrem(taskId);
        log.info(` Initial reload status: ${initialStatus.state}`);

        if (this.isCompletionState(initialStatus.state)) {
          return {
            success: initialStatus.state === 'succeeded',
            platform: 'on-premise',
            message: `Reload ${initialStatus.state} immediately for app: ${appName}`,
            app: {
              id: appId,
              name: appName,
              streamId: app.stream?.id
            },
            reload: {
              id: executionId,
              taskId: taskId,
              state: initialStatus.state,
              startTime: initialStatus.startTime,
              endTime: initialStatus.endTime,
              duration: initialStatus.duration,
              errorMessage: initialStatus.errorMessage
            }
          };
        }
      } catch (statusError) {
        log.warn(' Could not get initial status:', statusError);
      }

      // If wait for completion is requested
      if (options.waitForCompletion) {
        return await this.waitForReloadCompletionOnPrem(
          taskId,
          appId,
          appName,
          options
        );
      }

      // Return with reload info
      return {
        success: true,
        platform: 'on-premise',
        message: `Reload triggered for app: ${appName}. Task ID: ${taskId}`,
        app: {
          id: appId,
          name: appName,
          streamId: app.stream?.id
        },
        reload: {
          id: executionId,
          taskId: taskId,
          state: 'queued',
          startTime: new Date().toISOString(),
          partial: options.partial || false
        },
        instructions: 'Use get_reload_status with the task ID to check progress'
      };
    } catch (error) {
      log.error(' Failed to trigger reload (On-Premise):', error);
      throw error;
    }
  }

  /**
   * Safe wait for reload completion with proper error handling and loop termination
   */
  private async waitForReloadCompletionSafe(
    reloadId: string,
    appId: string,
    appName: string,
    options: ReloadOptions
  ): Promise<any> {
    const timeoutSeconds = options.timeoutSeconds || this.DEFAULT_TIMEOUT_SECONDS;
    const pollIntervalSeconds = options.pollIntervalSeconds || this.DEFAULT_POLL_INTERVAL_SECONDS;
    
    const startTime = Date.now();
    const timeout = timeoutSeconds * 1000;
    const pollInterval = pollIntervalSeconds * 1000;

    log.info(` Monitoring reload ${reloadId} for app ${appId}`);

    let pollCount = 0;
    const statusHistory: StatusHistoryEntry[] = [];

    while (true) {
      pollCount++;
      
      // Check timeout
      if (Date.now() - startTime >= timeout) {
        return {
          success: false,
          message: `Reload timeout after ${timeoutSeconds} seconds`,
          app: { id: appId, name: appName },
          reload: { id: reloadId },
          timeout: true
        };
      }

      try {
        // GET RELOAD STATUS BY ID
        const status = await this.getReloadStatus(reloadId);
        
        log.info(` Poll #${pollCount}: ${status.state} ${status.progress !== undefined ? `(${status.progress}%)` : ''}`);
        
        // Add to history
        statusHistory.push({
          timestamp: new Date().toISOString(),
          state: status.state,
          progress: status.progress,
          message: this.getStatusMessage(status.state, status.progress)
        });

        // CHECK IF COMPLETE
        if (status.state === 'succeeded' || status.state === 'failed' || 
            status.state === 'canceled' || status.state === 'skipped') {
          
          log.info(` Reload completed: ${status.state}`);
          
          // Get error logs if failed
          let errorDetails = null;
          if (status.state === 'failed') {
            try {
              const logs = await this.getReloadLogs(reloadId);
              errorDetails = {
                errorMessage: status.errorMessage,
                logSummary: logs.summary
              };
            } catch (e) {
              // Ignore log fetch errors
            }
          }
          
          return {
            success: status.state === 'succeeded',
            message: `Reload ${status.state}`,
            app: { id: appId, name: appName },
            reload: {
              id: reloadId,
              state: status.state,
              startTime: status.startTime,
              endTime: status.endTime,
              duration: status.duration,
              progress: status.progress,
              errorMessage: status.errorMessage
            },
            statusHistory,
            ...(errorDetails && { error: errorDetails })
          };
        }

        // If still running, also check latest reload for the app
        // This helps catch cases where the API might not update the specific reload
        if (pollCount % 5 === 0) { // Every 5th poll
          const latestReload = await this.getLatestReloadForApp(appId);
          if (latestReload && latestReload.id === reloadId) {
            log.info(` Cross-check with latest reload: ${latestReload.state}`);
            if (latestReload.state !== status.state) {
              log.info(` State mismatch detected! Using latest: ${latestReload.state}`);
              // Use the latest reload status instead
              if (latestReload.state === 'succeeded' || latestReload.state === 'failed' || 
                  latestReload.state === 'canceled' || latestReload.state === 'skipped') {
                return {
                  success: latestReload.state === 'succeeded',
                  message: `Reload ${latestReload.state} (from latest check)`,
                  app: { id: appId, name: appName },
                  reload: latestReload,
                  statusHistory
                };
              }
            }
          }
        }

        // Wait before next check
        await this.sleep(pollInterval);

      } catch (error) {
        log.error(` Error checking status:`, error);
        
        // Try one more time with latest reload for app
        try {
          const latestReload = await this.getLatestReloadForApp(appId);
          if (latestReload && latestReload.id === reloadId) {
            if (latestReload.state === 'succeeded' || latestReload.state === 'failed' || 
                latestReload.state === 'canceled' || latestReload.state === 'skipped') {
              return {
                success: latestReload.state === 'succeeded',
                message: `Reload ${latestReload.state} (from fallback check)`,
                app: { id: appId, name: appName },
                reload: latestReload,
                statusHistory
              };
            }
          }
        } catch (fallbackError) {
          // Ignore fallback errors
        }
        
        throw error;
      }
    }
  }

  /**
   * Get reload status with error handling - routes to platform-specific implementation
   */
  async getReloadStatus(reloadId: string): Promise<ReloadTask> {
    if (this.platform === 'on-premise') {
      return this.getReloadStatusOnPrem(reloadId);
    }
    return this.getReloadStatusCloud(reloadId);
  }

  /**
   * Cloud: Get reload status by ID
   * IMPORTANT: useCache: false to always get fresh status
   */
  private async getReloadStatusCloud(reloadId: string): Promise<ReloadTask> {
    try {
      const response = await this.apiClient.makeRequest(
        `/api/v1/reloads/${reloadId}`,
        'GET',
        undefined,
        { useCache: false }  // Always get fresh reload status
      );
      const reload = response.data || response;
      return this.processReloadTask(reload);
    } catch (error) {
      log.error(' Failed to get reload status (Cloud):', error);
      throw error;
    }
  }

  /**
   * On-Premise: Get reload task status via QRS
   * Note: reloadId here is the task ID, not the execution ID
   */
  private async getReloadStatusOnPrem(taskId: string): Promise<ReloadTask> {
    try {
      // Get the reload task with operational status
      const response = await this.apiClient.makeRequest(`/qrs/reloadtask/${taskId}`, 'GET');
      const task = response.data || response;

      return this.processQRSReloadTask(task);
    } catch (error) {
      log.error(' Failed to get reload status (On-Premise):', error);
      throw error;
    }
  }

  /**
   * Wait for on-premise reload completion
   */
  private async waitForReloadCompletionOnPrem(
    taskId: string,
    appId: string,
    appName: string,
    options: ReloadOptions
  ): Promise<any> {
    const timeoutSeconds = options.timeoutSeconds || this.DEFAULT_TIMEOUT_SECONDS;
    const pollIntervalSeconds = options.pollIntervalSeconds || this.DEFAULT_POLL_INTERVAL_SECONDS;

    const startTime = Date.now();
    const timeout = timeoutSeconds * 1000;
    const pollInterval = pollIntervalSeconds * 1000;

    log.info(` Monitoring on-premise reload ${taskId} for app ${appId}`);

    let pollCount = 0;
    const statusHistory: StatusHistoryEntry[] = [];

    while (true) {
      pollCount++;

      // Check timeout
      if (Date.now() - startTime >= timeout) {
        return {
          success: false,
          platform: 'on-premise',
          message: `Reload timeout after ${timeoutSeconds} seconds`,
          app: { id: appId, name: appName },
          reload: { id: taskId, taskId },
          timeout: true
        };
      }

      try {
        const status = await this.getReloadStatusOnPrem(taskId);

        log.info(` Poll #${pollCount}: ${status.state}`);

        statusHistory.push({
          timestamp: new Date().toISOString(),
          state: status.state,
          progress: status.progress,
          message: this.getStatusMessage(status.state, status.progress)
        });

        // Check if complete
        if (this.isCompletionState(status.state)) {
          log.info(` On-premise reload completed: ${status.state}`);

          return {
            success: status.state === 'succeeded',
            platform: 'on-premise',
            message: `Reload ${status.state} for app: ${appName}`,
            app: { id: appId, name: appName },
            reload: {
              id: taskId,
              taskId: taskId,
              state: status.state,
              startTime: status.startTime,
              endTime: status.endTime,
              duration: status.duration,
              errorMessage: status.errorMessage
            },
            statusHistory
          };
        }

        await this.sleep(pollInterval);

      } catch (error) {
        log.error(` Error checking on-premise status:`, error);
        throw error;
      }
    }
  }

  /**
   * Get latest reload status for an app - routes to platform-specific implementation
   */
  async getLatestReloadForApp(appId: string): Promise<ReloadTask | null> {
    if (this.platform === 'on-premise') {
      return this.getLatestReloadForAppOnPrem(appId);
    }
    return this.getLatestReloadForAppCloud(appId);
  }

  /**
   * Cloud: Get latest reload for app
   * IMPORTANT: useCache: false to always get fresh status
   */
  private async getLatestReloadForAppCloud(appId: string): Promise<ReloadTask | null> {
    try {
      const response = await this.apiClient.makeRequest(
        `/api/v1/reloads?appId=${appId}&limit=1&sort=-createdAt`,
        'GET',
        undefined,
        { useCache: false }  // Always get fresh reload list
      );

      const reloads = response.data || response || [];
      if (reloads.length > 0) {
        return this.processReloadTask(reloads[0]);
      }
      return null;
    } catch (error) {
      log.error(' Failed to get latest reload for app (Cloud):', error);
      return null;
    }
  }

  /**
   * On-Premise: Get latest reload task for app
   */
  private async getLatestReloadForAppOnPrem(appId: string): Promise<ReloadTask | null> {
    try {
      // Get reload tasks for this app
      const response = await this.apiClient.makeRequest(
        `/qrs/reloadtask?filter=app.id eq ${appId}`,
        'GET'
      );

      const tasks = response.data || response || [];
      if (tasks.length > 0) {
        // Return the task with the most recent execution
        const sortedTasks = tasks.sort((a: any, b: any) => {
          const aTime = a.operational?.lastExecutionResult?.stopTime || '';
          const bTime = b.operational?.lastExecutionResult?.stopTime || '';
          return bTime.localeCompare(aTime);
        });
        return this.processQRSReloadTask(sortedTasks[0]);
      }
      return null;
    } catch (error) {
      log.error(' Failed to get latest reload for app (On-Premise):', error);
      return null;
    }
  }

  /**
   * Get reload logs - routes to platform-specific implementation
   */
  async getReloadLogs(reloadId: string): Promise<any> {
    if (this.platform === 'on-premise') {
      return this.getReloadLogsOnPrem(reloadId);
    }
    return this.getReloadLogsCloud(reloadId);
  }

  /**
   * Cloud: Get reload logs
   */
  private async getReloadLogsCloud(reloadId: string): Promise<any> {
    try {
      log.info(` Getting reload logs for: ${reloadId}`);
      const response = await this.apiClient.makeRequest(`/api/v1/reloads/${reloadId}/logs`, 'GET');
      const logs = response.data || response;
      const parsedLogs = this.parseReloadLogs(logs);

      return {
        success: true,
        reloadId: reloadId,
        logEntries: parsedLogs.entries,
        summary: parsedLogs.summary,
        rawLog: logs
      };
    } catch (error) {
      log.error(' Failed to get reload logs (Cloud):', error);
      throw error;
    }
  }

  /**
   * On-Premise: Get reload task execution logs
   * Note: QRS doesn't have direct log API, logs are typically in the file system
   */
  private async getReloadLogsOnPrem(taskId: string): Promise<any> {
    try {
      log.info(` Getting on-premise reload logs for task: ${taskId}`);

      // Get task details with execution result
      const response = await this.apiClient.makeRequest(`/qrs/reloadtask/${taskId}`, 'GET');
      const task = response.data || response;

      const executionResult = task.operational?.lastExecutionResult;

      return {
        success: true,
        taskId: taskId,
        platform: 'on-premise',
        logEntries: [],
        summary: {
          totalLines: 0,
          errors: executionResult?.status === 8 ? 1 : 0,
          warnings: 0,
          info: 0,
          note: 'On-premise logs are stored on the Qlik Sense server file system. Use QMC to view detailed logs.'
        },
        executionResult: executionResult ? {
          status: executionResult.status,
          statusName: this.getQRSStatusName(executionResult.status),
          startTime: executionResult.startTime,
          stopTime: executionResult.stopTime,
          duration: executionResult.duration,
          scriptLogLocation: executionResult.scriptLogLocation
        } : null
      };
    } catch (error) {
      log.error(' Failed to get reload logs (On-Premise):', error);
      throw error;
    }
  }

  /**
   * Cancel a reload task - routes to platform-specific implementation
   */
  async cancelReload(reloadId: string): Promise<any> {
    if (this.platform === 'on-premise') {
      return this.cancelReloadOnPrem(reloadId);
    }
    return this.cancelReloadCloud(reloadId);
  }

  /**
   * Cloud: Cancel reload
   */
  private async cancelReloadCloud(reloadId: string): Promise<any> {
    try {
      log.info(` Canceling reload task: ${reloadId}`);
      await this.apiClient.makeRequest(`/api/v1/reloads/${reloadId}/cancel`, 'PUT');

      return {
        success: true,
        message: 'Reload task canceled',
        reloadId: reloadId
      };
    } catch (error) {
      log.error(' Failed to cancel reload (Cloud):', error);
      throw error;
    }
  }

  /**
   * On-Premise: Stop reload task via QRS
   * Correct endpoint: POST /qrs/task/{id}/stop - NOT /qrs/reloadtask/{id}/stop
   */
  private async cancelReloadOnPrem(taskId: string): Promise<any> {
    try {
      log.info(` Stopping on-premise reload task: ${taskId}`);
      // POST /qrs/task/{id}/stop - operates on existing reloadtasks
      await this.apiClient.makeRequest(`/qrs/task/${taskId}/stop`, 'POST');

      return {
        success: true,
        platform: 'on-premise',
        message: 'Reload task stopped',
        taskId: taskId
      };
    } catch (error) {
      log.error(' Failed to cancel reload (On-Premise):', error);
      throw error;
    }
  }

  /**
   * Process QRS reload task to unified ReloadTask format
   */
  private processQRSReloadTask(task: any): ReloadTask {
    const execResult = task.operational?.lastExecutionResult;
    const statusCode = execResult?.status ?? 0;

    return {
      id: task.id,
      taskId: task.id,
      appId: task.app?.id,
      appName: task.app?.name,
      state: this.QRS_STATUS_MAP[statusCode] || 'queued',
      startTime: execResult?.startTime,
      endTime: execResult?.stopTime,
      duration: execResult?.duration,
      progress: this.estimateQRSProgress(statusCode),
      errorMessage: statusCode === 8 ? 'Reload failed - check QMC for details' : undefined,
      trigger: task.isManuallyTriggered ? 'manual' : 'scheduled'
    };
  }

  /**
   * Estimate progress based on QRS status
   */
  private estimateQRSProgress(status: number): number {
    switch (status) {
      case 0: return 0;   // NeverStarted
      case 1: return 5;   // Triggered
      case 2: return 50;  // Started (running)
      case 3: return 0;   // Queued
      case 4: return 90;  // AbortInitiated
      case 5: return 95;  // Aborting
      case 6: return 100; // Aborted
      case 7: return 100; // Finished
      case 8: return 100; // Error
      default: return 0;
    }
  }

  /**
   * Get human-readable QRS status name
   */
  private getQRSStatusName(status: number): string {
    const names: Record<number, string> = {
      0: 'NeverStarted',
      1: 'Triggered',
      2: 'Started',
      3: 'Queued',
      4: 'AbortInitiated',
      5: 'Aborting',
      6: 'Aborted',
      7: 'Finished',
      8: 'Error'
    };
    return names[status] || 'Unknown';
  }

  /**
   * Monitor active reloads across the tenant - routes to platform-specific implementation
   */
  async monitorActiveReloads(): Promise<any> {
    if (this.platform === 'on-premise') {
      return this.monitorActiveReloadsOnPrem();
    }
    return this.monitorActiveReloadsCloud();
  }

  /**
   * Cloud: Monitor active reloads
   */
  private async monitorActiveReloadsCloud(): Promise<any> {
    try {
      log.warn(' Monitoring active reloads (Cloud)...');

      const response = await this.apiClient.makeRequest(
        `/api/v1/reloads?state=queued&state=reloading&limit=100`,
        'GET'
      );

      const activeReloads = response.data || response || [];
      const processedReloads: ReloadTask[] = activeReloads.map((reload: any) =>
        this.processReloadTask(reload)
      );

      // Group by state
      const byState = processedReloads.reduce((acc: Record<string, ReloadTask[]>, reload) => {
        if (!acc[reload.state]) acc[reload.state] = [];
        acc[reload.state].push(reload);
        return acc;
      }, {});

      return {
        success: true,
        platform: 'cloud',
        summary: {
          total: processedReloads.length,
          queued: byState.queued?.length || 0,
          reloading: byState.reloading?.length || 0
        },
        activeReloads: processedReloads.map((r: ReloadTask) => ({
          id: r.id,
          appId: r.appId,
          appName: r.appName,
          state: r.state,
          progress: r.progress,
          startTime: r.startTime,
          runningTime: r.startTime ? this.calculateRunningTime(r.startTime) : 0,
          userName: r.userName,
          trigger: r.trigger
        })),
        estimatedCompletionTimes: processedReloads
          .filter((r: ReloadTask) => r.state === 'reloading')
          .map((r: ReloadTask) => ({
            reloadId: r.id,
            appName: r.appName,
            estimatedCompletion: this.estimateCompletion(r)
          }))
      };
    } catch (error) {
      log.error(' Failed to monitor active reloads (Cloud):', error);
      throw error;
    }
  }

  /**
   * On-Premise: Monitor active reload tasks via QRS
   */
  private async monitorActiveReloadsOnPrem(): Promise<any> {
    try {
      log.warn(' Monitoring active reloads (On-Premise)...');

      // Get all reload tasks and filter by operational status
      const response = await this.apiClient.makeRequest('/qrs/reloadtask/full', 'GET');
      const allTasks = response.data || response || [];

      // Filter for active tasks (status 1=Triggered, 2=Started, 3=Queued)
      const activeTasks = allTasks.filter((task: any) => {
        const status = task.operational?.lastExecutionResult?.status;
        return status === 1 || status === 2 || status === 3;
      });

      const processedReloads: ReloadTask[] = activeTasks.map((task: any) =>
        this.processQRSReloadTask(task)
      );

      // Group by state
      const byState = processedReloads.reduce((acc: Record<string, ReloadTask[]>, reload) => {
        if (!acc[reload.state]) acc[reload.state] = [];
        acc[reload.state].push(reload);
        return acc;
      }, {});

      return {
        success: true,
        platform: 'on-premise',
        summary: {
          total: processedReloads.length,
          queued: byState.queued?.length || 0,
          reloading: byState.reloading?.length || 0
        },
        activeReloads: processedReloads.map((r: ReloadTask) => ({
          id: r.id,
          taskId: r.taskId,
          appId: r.appId,
          appName: r.appName,
          state: r.state,
          progress: r.progress,
          startTime: r.startTime,
          runningTime: r.startTime ? this.calculateRunningTime(r.startTime) : 0,
          trigger: r.trigger
        })),
        estimatedCompletionTimes: processedReloads
          .filter((r: ReloadTask) => r.state === 'reloading')
          .map((r: ReloadTask) => ({
            taskId: r.id,
            appName: r.appName,
            estimatedCompletion: this.estimateCompletion(r)
          }))
      };
    } catch (error) {
      log.error(' Failed to monitor active reloads (On-Premise):', error);
      throw error;
    }
  }

  // ===== HELPER METHODS =====

  private isCompletionState(state: ReloadState): boolean {
    return ['succeeded', 'failed', 'canceled', 'skipped', 'error'].includes(state);
  }

  private isUnrecoverableError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    
    const unrecoverablePatterns = [
      'not found',
      '404',
      'unauthorized',
      '401',
      'forbidden',
      '403',
      'invalid reload',
      'invalid app'
    ];

    const errorMessage = error.message.toLowerCase();
    return unrecoverablePatterns.some(pattern => errorMessage.includes(pattern));
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private processReloadTask(reload: any): ReloadTask {
    const startTime = reload.startTime || reload.createdAt;
    const endTime = reload.endTime || reload.finishedAt || reload.finishedTime || reload.completedAt;

    // Get state - simple and direct
    let state = reload.state || reload.status || 'unknown';
    
    return {
      id: reload.id,
      appId: reload.appId,
      appName: reload.appName,
      state: this.normalizeReloadState(state),
      startTime: startTime,
      endTime: endTime,
      duration: startTime && endTime ? this.calculateDuration(startTime, endTime) : undefined,
      progress: reload.progress !== undefined ? reload.progress : undefined,
      engineHasData: reload.engineHasData,
      partial: reload.partial,
      log: reload.log,
      errorMessage: reload.errorMessage || reload.error,
      userId: reload.userId,
      userName: reload.userName,
      tenantId: reload.tenantId,
      spaceId: reload.spaceId,
      spaceName: reload.spaceName,
      trigger: this.detectTriggerType(reload)
    };
  }

  private normalizeReloadState(state: string | any): ReloadState {
    // Handle null/undefined
    if (!state) {
      return 'queued';
    }
    
    // Convert to string if needed
    const stateStr = String(state).toUpperCase();
    
    const stateMap: Record<string, ReloadState> = {
      QUEUED: 'queued',
      RELOADING: 'reloading',
      SUCCEEDED: 'succeeded',
      FAILED: 'failed',
      CANCELED: 'canceled',
      CANCELLED: 'canceled',
      SKIPPED: 'skipped',
      ERROR: 'error',
      // Additional possible state formats
      PENDING: 'queued',
      RUNNING: 'reloading',
      IN_PROGRESS: 'reloading',
      INPROGRESS: 'reloading',
      SUCCESS: 'succeeded',
      COMPLETE: 'succeeded',
      COMPLETED: 'succeeded',
      FAILURE: 'failed',
      ABORT: 'canceled',
      ABORTED: 'canceled'
    };

    return stateMap[stateStr] || 'failed';
  }

  private detectTriggerType(reload: any): ReloadTrigger {
    if (reload.trigger) return reload.trigger;
    if (reload.scheduledId) return 'scheduled';
    if (reload.automationId) return 'automation';
    if (reload.apiTriggered) return 'api';
    return 'manual';
  }

  private getStatusMessage(state: ReloadState, progress?: number): string {
    switch (state) {
      case 'queued':
        return '⏳ Reload queued';
      case 'reloading':
        return `🔄 Reloading... ${progress || 0}%`;
      case 'succeeded':
        return '✅ Reload completed successfully';
      case 'failed':
        return '❌ Reload failed';
      case 'canceled':
        return '🚫 Reload canceled';
      case 'skipped':
        return '⏭️ Reload skipped';
      default:
        return `Status: ${state}`;
    }
  }

  private calculateDuration(startTime: string, endTime: string): number {
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    return Math.round((end - start) / 1000);
  }

  private calculateRunningTime(startTime: string): number {
    const start = new Date(startTime).getTime();
    const now = Date.now();
    return Math.round((now - start) / 1000);
  }

  private estimateCompletion(reload: ReloadTask, averageDuration?: number): string | null {
    if (!reload.startTime || !reload.progress) return null;

    const runningTime = this.calculateRunningTime(reload.startTime);
    const estimatedTotal = averageDuration || (runningTime / (reload.progress / 100));
    const remainingSeconds = Math.max(0, estimatedTotal - runningTime);

    const completionTime = new Date(Date.now() + remainingSeconds * 1000);
    return completionTime.toISOString();
  }

  private parseReloadLogs(logs: any): {
    entries: Array<{
      lineNumber: number;
      timestamp: string | null;
      level: string;
      message: string;
      details?: any;
    }>;
    summary: {
      totalLines: number;
      errors: number;
      warnings: number;
      info: number;
    };
  } {
    // Simplified log parsing - implement based on actual log format
    const entries: any[] = [];
    const summary = {
      totalLines: 0,
      errors: 0,
      warnings: 0,
      info: 0
    };

    // Parse logs based on actual format
    if (typeof logs === 'string') {
      const lines = logs.split('\n');
      lines.forEach((line, index) => {
        if (line.trim()) {
          const level = this.detectLogLevel(line);
          entries.push({
            lineNumber: index + 1,
            timestamp: this.extractTimestamp(line),
            level: level,
            message: line.trim()
          });

          summary.totalLines++;
          if (level === 'ERROR') summary.errors++;
          else if (level === 'WARN') summary.warnings++;
          else summary.info++;
        }
      });
    }

    return { entries, summary };
  }

  private detectLogLevel(line: string): string {
    const upperLine = line.toUpperCase();
    if (upperLine.includes('ERROR') || upperLine.includes('FAILED')) return 'ERROR';
    if (upperLine.includes('WARN') || upperLine.includes('WARNING')) return 'WARN';
    return 'INFO';
  }

  private extractTimestamp(line: string): string | null {
    // Simple ISO timestamp extraction
    const timestampMatch = line.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    return timestampMatch ? timestampMatch[0] : null;
  }

  private calculateReloadStats(reloads: ReloadTask[]): ReloadStatistics {
    const total = reloads.length;
    const succeeded = reloads.filter(r => r.state === 'succeeded').length;
    const failed = reloads.filter(r => r.state === 'failed').length;
    const canceled = reloads.filter(r => r.state === 'canceled').length;

    const successfulReloads = reloads.filter(r => r.state === 'succeeded' && r.duration);
    const averageDuration = successfulReloads.length > 0
      ? successfulReloads.reduce((sum, r) => sum + (r.duration || 0), 0) / successfulReloads.length
      : 0;

    const lastSuccessful = reloads
      .filter(r => r.state === 'succeeded' && r.endTime)
      .sort((a, b) => (b.endTime || '').localeCompare(a.endTime || ''))[0];

    const lastFailed = reloads
      .filter(r => r.state === 'failed' && r.endTime)
      .sort((a, b) => (b.endTime || '').localeCompare(a.endTime || ''))[0];

    return {
      total,
      succeeded,
      failed,
      canceled,
      averageDuration: Math.round(averageDuration),
      successRate: total > 0 ? (succeeded / total) * 100 : 0,
      failureRate: total > 0 ? (failed / total) * 100 : 0,
      lastSuccessful: lastSuccessful ? {
        reloadId: lastSuccessful.id,
        timestamp: lastSuccessful.endTime!,
        duration: lastSuccessful.duration || 0
      } : undefined,
      lastFailed: lastFailed ? {
        reloadId: lastFailed.id,
        timestamp: lastFailed.endTime!,
        errorMessage: lastFailed.errorMessage
      } : undefined
    };
  }

  // ===== RESPONSE CREATION METHODS =====

  private async createCompletionResponse(
    status: ReloadTask,
    reloadId: string,
    appId: string,
    appName: string,
    startTime: number,
    statusHistory: StatusHistoryEntry[],
    pollCount: number
  ): Promise<any> {
    const totalDuration = Math.round((Date.now() - startTime) / 1000);

    // Get error details if failed
    let errorDetails = null;
    if (status.state === 'failed') {
      try {
        const logs = await this.getReloadLogs(reloadId);
        errorDetails = {
          errorMessage: status.errorMessage,
          logSummary: logs.summary,
          errorLogs: logs.logEntries
            .filter((e: any) => e.level === 'ERROR')
            .slice(-5)
        };
      } catch (logError) {
        log.error('Failed to fetch reload logs:', logError);
      }
    }

    return {
      success: status.state === 'succeeded',
      message: `Reload ${status.state} for app: ${appName}`,
      app: {
        id: appId,
        name: appName
      },
      reload: {
        id: reloadId,
        state: status.state,
        startTime: status.startTime,
        endTime: status.endTime,
        duration: status.duration || totalDuration,
        progress: status.progress || (status.state === 'succeeded' ? 100 : 0)
      },
      monitoring: {
        totalWaitTime: totalDuration,
        pollCount: pollCount,
        statusHistory: statusHistory
      },
      ...(errorDetails && { error: errorDetails })
    };
  }

  private createTimeoutResponse(
    reloadId: string,
    appId: string,
    appName: string,
    timeoutSeconds: number,
    statusHistory: StatusHistoryEntry[],
    lastStatus: ReloadState | null,
    lastProgress: number,
    pollCount: number
  ): any {
    return {
      success: false,
      message: `Reload timeout after ${timeoutSeconds} seconds`,
      app: {
        id: appId,
        name: appName
      },
      reload: {
        id: reloadId,
        state: lastStatus || 'unknown',
        progress: lastProgress
      },
      monitoring: {
        totalWaitTime: timeoutSeconds,
        pollCount: pollCount,
        statusHistory: statusHistory,
        timeoutReached: true
      }
    };
  }

  private createErrorResponse(
    reloadId: string,
    appId: string,
    appName: string,
    errorMessage: string,
    statusHistory: StatusHistoryEntry[],
    pollCount: number,
    elapsedTime: number
  ): any {
    return {
      success: false,
      message: `Reload monitoring failed: ${errorMessage}`,
      app: {
        id: appId,
        name: appName
      },
      reload: {
        id: reloadId,
        state: 'error'
      },
      monitoring: {
        totalWaitTime: Math.round(elapsedTime / 1000),
        pollCount: pollCount,
        statusHistory: statusHistory,
        abortedDueToErrors: true
      },
      error: errorMessage
    };
  }

  // ===== ADDITIONAL PUBLIC METHODS =====

  /**
   * Get app reload history - routes to platform-specific implementation
   */
  async getAppReloadHistory(
    appId: string,
    limit: number = 20,
    includeDetails: boolean = true
  ): Promise<any> {
    if (this.platform === 'on-premise') {
      return this.getAppReloadHistoryOnPrem(appId, limit, includeDetails);
    }
    return this.getAppReloadHistoryCloud(appId, limit, includeDetails);
  }

  /**
   * Cloud: Get app reload history
   */
  private async getAppReloadHistoryCloud(
    appId: string,
    limit: number = 20,
    includeDetails: boolean = true
  ): Promise<any> {
    try {
      log.info(` Getting reload history for app: ${appId} (Cloud)`);

      const appResponse = await this.apiClient.makeRequest(`/api/v1/apps/${appId}`, 'GET');
      const app = appResponse.data || appResponse;

      const reloadsResponse = await this.apiClient.makeRequest(
        `/api/v1/reloads?appId=${appId}&limit=${limit}&sort=-createdAt`,
        'GET'
      );

      const reloads = reloadsResponse.data || reloadsResponse || [];
      const processedReloads: ReloadTask[] = reloads.map((reload: any) =>
        this.processReloadTask(reload)
      );

      const stats = this.calculateReloadStats(processedReloads);
      const activeReload = processedReloads.find((r: ReloadTask) =>
        ['queued', 'reloading'].includes(r.state)
      );

      return {
        success: true,
        platform: 'cloud',
        app: {
          id: app.id,
          name: app.name,
          spaceId: app.spaceId,
          lastReloadTime: app.lastReloadTime,
          published: app.published
        },
        currentStatus: activeReload ? {
          state: activeReload.state,
          progress: activeReload.progress,
          startTime: activeReload.startTime,
          estimatedCompletion: this.estimateCompletion(activeReload, stats.averageDuration)
        } : null,
        statistics: stats,
        reloads: includeDetails ? processedReloads : processedReloads.map((r: ReloadTask) => ({
          id: r.id,
          state: r.state,
          startTime: r.startTime,
          endTime: r.endTime,
          duration: r.duration,
          trigger: r.trigger
        }))
      };
    } catch (error) {
      log.error(` Failed to get reload history (Cloud):`, error);
      throw error;
    }
  }

  /**
   * On-Premise: Get app reload history from QRS task history
   */
  private async getAppReloadHistoryOnPrem(
    appId: string,
    limit: number = 20,
    includeDetails: boolean = true
  ): Promise<any> {
    try {
      log.info(` Getting reload history for app: ${appId} (On-Premise)`);

      // Get app details via QRS
      const appResponse = await this.apiClient.makeRequest(`/qrs/app/${appId}`, 'GET');
      const app = appResponse.data || appResponse;

      // Get reload tasks for this app
      const tasksResponse = await this.apiClient.makeRequest(
        `/qrs/reloadtask?filter=app.id eq ${appId}`,
        'GET'
      );
      const tasks = tasksResponse.data || tasksResponse || [];

      // Process tasks
      const processedReloads: ReloadTask[] = tasks.slice(0, limit).map((task: any) =>
        this.processQRSReloadTask(task)
      );

      const stats = this.calculateReloadStats(processedReloads);
      const activeReload = processedReloads.find((r: ReloadTask) =>
        ['queued', 'reloading'].includes(r.state)
      );

      return {
        success: true,
        platform: 'on-premise',
        app: {
          id: app.id,
          name: app.name,
          streamId: app.stream?.id,
          streamName: app.stream?.name,
          lastReloadTime: app.lastReloadTime,
          published: app.published
        },
        currentStatus: activeReload ? {
          state: activeReload.state,
          progress: activeReload.progress,
          startTime: activeReload.startTime,
          estimatedCompletion: this.estimateCompletion(activeReload, stats.averageDuration)
        } : null,
        statistics: stats,
        reloads: includeDetails ? processedReloads : processedReloads.map((r: ReloadTask) => ({
          id: r.id,
          taskId: r.taskId,
          state: r.state,
          startTime: r.startTime,
          endTime: r.endTime,
          duration: r.duration,
          trigger: r.trigger
        }))
      };
    } catch (error) {
      log.error(` Failed to get reload history (On-Premise):`, error);
      throw error;
    }
  }

  /**
   * Get tenant reload history
   */
  async getTenantReloadHistory(options: {
    limit?: number;
    offset?: number;  // NEW: Add offset for pagination
    startDate?: string;
    endDate?: string;
    state?: ReloadState;
    appId?: string;
    spaceId?: string;
    includeAppDetails?: boolean;
    sortBy?: 'createdAt' | 'startTime' | 'endTime' | 'duration';  // NEW: Flexible sorting
    sortOrder?: 'asc' | 'desc';  // NEW: Sort order
} = {}): Promise<{
    success: boolean;
    pagination: {
        offset: number;
        limit: number;
        total: number;
        hasMore: boolean;
        nextOffset?: number;
    };
    statistics: ReloadStatistics;
    reloads: ReloadTask[];
    appDetails?: Record<string, any>;
}> {
    try {
        log.warn(' Getting tenant reload history with pagination...');

        const limit = Math.min(options.limit || 100, 100); // Ensure limit doesn't exceed 100
        const offset = options.offset || 0;
        const sortBy = options.sortBy || 'createdAt';
        const sortOrder = options.sortOrder || 'desc';
        
        // Build query endpoint - DO NOT add +1 to limit to avoid API error
        // Note: On-premise uses a different method; this is Cloud-only
        if (this.platform === 'on-premise') {
            log.warn(' On-premise does not support tenant-wide reload history');
            // Return empty result for on-premise
            return {
                success: true,
                platform: 'on-premise',
                pagination: { offset: 0, limit, total: 0, hasMore: false },
                statistics: this.calculateReloadStats([]),
                reloads: [],
                note: 'Tenant-wide reload history is not available on-premise. Use getAppReloadHistory for specific apps.'
            } as any;
        }

        let endpoint = `/api/v1/reloads?limit=${limit}`;
        if (offset > 0) endpoint += `&offset=${offset}`;
        if (options.state) endpoint += `&state=${options.state}`;
        if (options.appId) endpoint += `&appId=${options.appId}`;
        if (options.spaceId) endpoint += `&spaceId=${options.spaceId}`;
        endpoint += `&sort=${sortOrder === 'desc' ? '-' : ''}${sortBy}`;

        const response = await this.apiClient.makeRequest(endpoint, 'GET');
        const reloads = response.data || response || [];

        // Process reloads with date filtering
        const processedReloads: ReloadTask[] = reloads
            .map((reload: any) => this.processReloadTask(reload))
            .filter((reload: ReloadTask) => {
                if (options.startDate && reload.startTime && reload.startTime < options.startDate) return false;
                if (options.endDate && reload.startTime && reload.startTime > options.endDate) return false;
                return true;
            });

        // Calculate statistics from current page
        const stats = this.calculateReloadStats(processedReloads);

        // Determine if there are more results
        // Since we can't fetch limit+1, we check if we got exactly the limit
        const hasMore = reloads.length === limit;

        // Enhanced app details fetching with better error handling
        const appDetails: Record<string, any> = {};
        if (options.includeAppDetails) {
            const uniqueAppIds = [...new Set(processedReloads.map(r => r.appId))];
            
            // Fetch app details in parallel with proper 404 handling
            const appDetailsPromises = uniqueAppIds.slice(0, 50).map(async (appId) => {
                try {
                    const appResponse = await this.apiClient.makeRequest(`/api/v1/apps/${appId}`, 'GET');
                    const app = appResponse.data || appResponse;
                    
                    return {
                        appId,
                        name: app.attributes?.name || app.name || app.resourceAttributes?.name || 'Unknown',
                        spaceId: app.attributes?.spaceId || app.spaceId || app.resourceAttributes?.spaceId,
                        spaceName: app.attributes?.spaceName || app.spaceName,
                        ownerId: app.attributes?.ownerId || app.ownerId || app.resourceAttributes?.ownerId,
                        ownerName: app.attributes?.ownerName || app.ownerName
                    };
                } catch (error: any) {
                    // Don't log 404 errors - these are expected for deleted apps
                    if (!error.message?.includes('404')) {
                        log.warn(`Failed to get details for app ${appId}:`, error.message);
                    }
                    
                    // Return a placeholder for deleted apps
                    return {
                        appId,
                        name: error.message?.includes('404') ? '[Deleted App]' : 'Unknown',
                        deleted: error.message?.includes('404'),
                        error: error.message?.includes('404') ? 'App no longer exists' : error.message
                    };
                }
            });

            const appDetailsResults = await Promise.all(appDetailsPromises);
            appDetailsResults.forEach(detail => {
                appDetails[detail.appId] = detail;
            });
        }

        // Enrich reloads with app details
        const enrichedReloads = processedReloads.map(reload => ({
            ...reload,
            ...(appDetails[reload.appId] && {
                appName: appDetails[reload.appId].name,
                spaceName: appDetails[reload.appId].spaceName,
                ownerName: appDetails[reload.appId].ownerName
            })
        }));

        // Estimate total count (since we don't have a count endpoint)
        const estimatedTotal = hasMore ? offset + limit + 1 : offset + processedReloads.length;

        return {
            success: true,
            pagination: {
                offset,
                limit,
                total: estimatedTotal,
                hasMore,
                ...(hasMore && { nextOffset: offset + limit })
            },
            statistics: stats,
            reloads: enrichedReloads,
            ...(options.includeAppDetails && { appDetails })
        };

    } catch (error) {
        log.error(` Failed to get tenant reload history:`, error);
        throw error;
    }
}

// Helper method to get paginated results with automatic page fetching
async getAllTenantReloads(options: {
    limit?: number;
    startDate?: string;
    endDate?: string;
    state?: ReloadState;
    appId?: string;
    spaceId?: string;
    includeAppDetails?: boolean;
    sortBy?: 'createdAt' | 'startTime' | 'endTime' | 'duration';
    sortOrder?: 'asc' | 'desc';
    maxPages?: number;
} = {}): Promise<ReloadTask[]> {
    const allReloads: ReloadTask[] = [];
    const pageSize = Math.min(options.limit || 100, 100);
    const maxPages = options.maxPages || 10;
    let currentPage = 0;
    let hasMore = true;

    while (hasMore && currentPage < maxPages) {
        const result = await this.getTenantReloadHistory({
            ...options,
            limit: pageSize,
            offset: currentPage * pageSize
        });

        allReloads.push(...result.reloads);
        hasMore = result.pagination.hasMore;
        currentPage++;
    }

    return allReloads;
}
  /**
   * Trigger reload for multiple apps
   */
  async triggerBulkReload(
    appIds: string[],
    options: ReloadOptions = {}
  ): Promise<any> {
    try {
      log.info(` Triggering reload for ${appIds.length} apps...`);

      const results: any[] = [];
      const errors: Array<{ appId: string; error: string }> = [];

      for (const appId of appIds) {
        try {
          const result = await this.triggerReload(appId, {
            ...options,
            waitForCompletion: false // Don't wait for individual completions
          });
          results.push(result);
        } catch (error) {
          errors.push({
            appId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      return {
        success: errors.length === 0,
        summary: {
          requested: appIds.length,
          triggered: results.length,
          failed: errors.length
        },
        triggered: results,
        errors: errors
      };
    } catch (error) {
      log.error(' Failed to trigger bulk reload:', error);
      throw error;
    }
  }
}