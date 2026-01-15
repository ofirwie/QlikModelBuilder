/**
 * Service Registry - Singleton pattern for services
 *
 * Provides a centralized registry for service instances to:
 * - Avoid creating duplicate instances
 * - Preserve cached data between calls
 * - Reduce memory usage
 */

import { logger } from './logger.js';

const log = logger.child({ service: 'ServiceRegistry' });

export class ServiceRegistry {
  private static services = new Map<string, any>();

  /**
   * Get or create a service instance
   * @param key Unique identifier for the service
   * @param factory Function to create the service if not exists
   */
  static get<T>(key: string, factory: () => T): T {
    if (!this.services.has(key)) {
      log.debug(`Creating new service instance: ${key}`);
      this.services.set(key, factory());
    }
    return this.services.get(key) as T;
  }

  /**
   * Check if a service exists in the registry
   */
  static has(key: string): boolean {
    return this.services.has(key);
  }

  /**
   * Remove a specific service from the registry
   */
  static remove(key: string): boolean {
    if (this.services.has(key)) {
      log.debug(`Removing service instance: ${key}`);
      this.services.delete(key);
      return true;
    }
    return false;
  }

  /**
   * Clear all services from the registry
   * Useful for testing or tenant switching
   */
  static reset(): void {
    log.debug(`Clearing all ${this.services.size} service instances`);
    this.services.clear();
  }

  /**
   * Get list of registered service keys
   */
  static getRegisteredServices(): string[] {
    return Array.from(this.services.keys());
  }
}
