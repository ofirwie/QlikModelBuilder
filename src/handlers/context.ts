/**
 * Handler Context - Shared context for all handlers
 */

import { ApiClient } from '../utils/api-client.js';
import { CacheManager } from '../utils/cache-manager.js';
import { QlikConfig } from '../config/qlik-config.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ service: 'HandlerContext' });

/**
 * Logger interface for consistent logging
 */
export interface Logger {
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
  debug: (message: string, ...args: any[]) => void;
}

/**
 * Default console-based logger implementation
 */
export const defaultLogger: Logger = {
  info: (message: string, ...args: any[]) => log.debug(`[INFO] ${message}`, ...args),
  warn: (message: string, ...args: any[]) => log.debug(`[WARN] ${message}`, ...args),
  error: (message: string, ...args: any[]) => log.debug(`[ERROR] ${message}`, ...args),
  debug: (message: string, ...args: any[]) => log.debug(`[DEBUG] ${message}`, ...args)
};

/**
 * Handler Context
 * Provides shared resources to all handler functions
 */
export interface HandlerContext {
  apiClient: ApiClient;
  cacheManager: CacheManager;
  config: QlikConfig;
  logger: Logger;
}

/**
 * Create a handler context
 */
export function createHandlerContext(
  apiClient: ApiClient,
  cacheManager: CacheManager,
  config: QlikConfig,
  logger?: Logger
): HandlerContext {
  return {
    apiClient,
    cacheManager,
    config,
    logger: logger || defaultLogger
  };
}

/**
 * Handler function type
 * All handlers follow this signature
 */
export type HandlerFunction = (
  apiClient: ApiClient,
  cacheManager: CacheManager,
  args: any
) => Promise<{ content: Array<{ type: string; text: string }> }>;

/**
 * Standard error response format
 */
export function createErrorResponse(error: unknown): { content: Array<{ type: string; text: string }> } {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }, null, 2)
    }]
  };
}

/**
 * Standard success response format
 */
export function createSuccessResponse(data: any): { content: Array<{ type: string; text: string }> } {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: true,
        ...data
      }, null, 2)
    }]
  };
}
