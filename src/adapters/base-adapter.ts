// ===== QLIK API ADAPTER INTERFACE =====
// Platform-agnostic interface for Qlik API operations

/**
 * Minimal App representation
 */
export interface App {
  id: string;
  name: string;
  description?: string;
  ownerId?: string;
  spaceId?: string;
  createdDate?: string;
  modifiedDate?: string;
  [key: string]: any; // Allow additional properties
}

/**
 * Minimal Reload Task representation
 */
export interface ReloadTask {
  id: string;
  appId: string;
  status: 'SUCCESS' | 'FAILED' | 'RUNNING' | 'QUEUED' | 'PENDING';
  startTime?: string;
  endTime?: string;
  duration?: number;
  log?: string;
  errorMessage?: string;
  [key: string]: any; // Allow additional properties
}

/**
 * Container (Space for Cloud, Stream for On-Premise)
 */
export interface Container {
  id: string;
  name: string;
  type: 'personal' | 'shared' | 'managed' | 'data' | 'stream';
  description?: string;
  [key: string]: any;
}

/**
 * Item within a container
 */
export interface Item {
  id: string;
  name: string;
  resourceType: string;
  spaceId?: string;
  streamId?: string;
  [key: string]: any;
}

/**
 * User representation
 */
export interface User {
  id: string;
  name: string;
  email?: string;
  status?: string;
  [key: string]: any;
}

/**
 * List options for paginated requests
 */
export interface ListOptions {
  limit?: number;
  offset?: number;
  sort?: string;
  filter?: string;
  [key: string]: any;
}

/**
 * Reload options
 */
export interface ReloadOptions {
  partial?: boolean;
  debug?: boolean;
  [key: string]: any;
}

/**
 * Platform-agnostic Qlik API Adapter Interface
 *
 * This interface abstracts the differences between Cloud and On-Premise APIs,
 * allowing services and tools to work with either platform seamlessly.
 */
export interface QlikApiAdapter {
  // ===== APP OPERATIONS =====

  /**
   * Get a single app by ID
   */
  getApp(appId: string): Promise<App>;

  /**
   * List all apps (with optional filtering)
   */
  listApps(options?: ListOptions): Promise<App[]>;

  /**
   * Create a new app
   */
  createApp(name: string, containerId?: string): Promise<App>;

  /**
   * Delete an app
   */
  deleteApp(appId: string): Promise<void>;

  // ===== RELOAD OPERATIONS =====

  /**
   * Trigger an app reload
   */
  triggerReload(appId: string, options?: ReloadOptions): Promise<ReloadTask>;

  /**
   * Get reload task status
   */
  getReloadStatus(reloadId: string): Promise<ReloadTask>;

  /**
   * Get reload history for an app
   */
  getReloadHistory(appId: string, limit?: number): Promise<ReloadTask[]>;

  /**
   * Cancel a running reload
   */
  cancelReload(reloadId: string): Promise<void>;

  // ===== CONTAINER OPERATIONS (Spaces/Streams) =====

  /**
   * List all containers (Spaces or Streams)
   */
  listContainers(): Promise<Container[]>;

  /**
   * Get a specific container
   */
  getContainer(id: string): Promise<Container>;

  /**
   * Get items within a container
   */
  getContainerItems(id: string): Promise<Item[]>;

  // ===== USER OPERATIONS =====

  /**
   * List all users
   */
  listUsers(options?: ListOptions): Promise<User[]>;

  /**
   * Get a specific user
   */
  getUser(userId: string): Promise<User>;

  // ===== PLATFORM INFO =====

  /**
   * Get the platform type
   */
  getPlatform(): 'cloud' | 'on-premise';

  /**
   * Get the base URL for this adapter
   */
  getBaseUrl(): string;
}
