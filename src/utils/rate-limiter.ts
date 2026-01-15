// ===== RATE LIMITER UTILITY =====
// Controls API request rate to prevent 429 (Too Many Requests) errors
// Configurable via QLIK_RATE_LIMIT environment variable

import { logger } from './logger.js';

const log = logger.child({ service: 'RateLimiter' });

/**
 * Configuration for the rate limiter
 */
interface RateLimiterConfig {
  /** Maximum concurrent requests (default: 10) */
  maxConcurrent: number;
  /** Minimum delay between requests in ms (default: 100) */
  minDelay: number;
  /** Maximum retries for 429 errors (default: 3) */
  maxRetries: number;
  /** Base delay for exponential backoff in ms (default: 1000) */
  baseRetryDelay: number;
}

/**
 * Result of a rate-limited request
 */
interface RateLimitedResult<T> {
  data: T;
  retries: number;
  totalDelay: number;
}

/**
 * Rate limiter for API requests
 * Uses a semaphore-style queue to limit concurrent requests
 */
export class RateLimiter {
  private config: RateLimiterConfig;
  private activeRequests: number = 0;
  private queue: Array<() => void> = [];
  private lastRequestTime: number = 0;

  constructor(config?: Partial<RateLimiterConfig>) {
    // Read from environment or use defaults
    const envLimit = parseInt(process.env.QLIK_RATE_LIMIT || '10', 10);

    this.config = {
      maxConcurrent: config?.maxConcurrent ?? envLimit,
      minDelay: config?.minDelay ?? 100,
      maxRetries: config?.maxRetries ?? 3,
      baseRetryDelay: config?.baseRetryDelay ?? 1000,
    };

    log.debug('Rate limiter initialized', {
      maxConcurrent: this.config.maxConcurrent,
      minDelay: this.config.minDelay,
      maxRetries: this.config.maxRetries,
    });
  }

  /**
   * Get current rate limiter stats
   */
  getStats(): { activeRequests: number; queuedRequests: number; config: RateLimiterConfig } {
    return {
      activeRequests: this.activeRequests,
      queuedRequests: this.queue.length,
      config: { ...this.config },
    };
  }

  /**
   * Wait for a slot to become available
   */
  private async acquireSlot(): Promise<void> {
    // If we have capacity, acquire immediately
    if (this.activeRequests < this.config.maxConcurrent) {
      this.activeRequests++;
      return;
    }

    // Otherwise, wait in queue
    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.activeRequests++;
        resolve();
      });
    });
  }

  /**
   * Release a slot and process next queued request
   */
  private releaseSlot(): void {
    this.activeRequests--;

    // Process next queued request if any
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) {
        next();
      }
    }
  }

  /**
   * Enforce minimum delay between requests
   */
  private async enforceMinDelay(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.config.minDelay) {
      const waitTime = this.config.minDelay - timeSinceLastRequest;
      await this.sleep(waitTime);
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(attempt: number, retryAfterHeader?: string): number {
    // If server provides Retry-After header, use it
    if (retryAfterHeader) {
      const retryAfterSeconds = parseInt(retryAfterHeader, 10);
      if (!isNaN(retryAfterSeconds)) {
        return retryAfterSeconds * 1000;
      }
    }

    // Exponential backoff: baseDelay * 2^attempt with jitter
    const exponentialDelay = this.config.baseRetryDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 1000; // Add up to 1 second of jitter
    return Math.min(exponentialDelay + jitter, 60000); // Cap at 60 seconds
  }

  /**
   * Check if an error is a rate limit error (429)
   */
  private isRateLimitError(error: unknown): { is429: boolean; retryAfter?: string } {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Check for 429 status code
      if (message.includes('429') || message.includes('too many requests')) {
        // Try to extract Retry-After from error message
        const retryAfterMatch = message.match(/retry-after[:\s]*(\d+)/i);
        return {
          is429: true,
          retryAfter: retryAfterMatch?.[1],
        };
      }
    }

    // Check for error object with status property
    if (typeof error === 'object' && error !== null) {
      const errorObj = error as Record<string, unknown>;
      if (errorObj.status === 429 || errorObj.statusCode === 429) {
        const headers = errorObj.headers as Record<string, string> | undefined;
        return {
          is429: true,
          retryAfter: headers?.['retry-after'],
        };
      }
    }

    return { is429: false };
  }

  /**
   * Execute a function with rate limiting and retry logic
   *
   * @param fn - The async function to execute
   * @param context - Optional context for logging
   * @returns The result of the function
   */
  async execute<T>(fn: () => Promise<T>, context?: string): Promise<T> {
    await this.acquireSlot();

    try {
      await this.enforceMinDelay();

      let lastError: unknown;
      let totalDelay = 0;

      for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
        try {
          const result = await fn();

          if (attempt > 0) {
            log.debug('Request succeeded after retry', {
              context,
              attempt,
              totalDelay,
            });
          }

          return result;
        } catch (error) {
          lastError = error;
          const { is429, retryAfter } = this.isRateLimitError(error);

          if (!is429) {
            // Not a rate limit error, throw immediately
            throw error;
          }

          if (attempt === this.config.maxRetries) {
            // Max retries reached, throw the error
            log.warn('Rate limit exceeded, max retries reached', {
              context,
              attempts: attempt + 1,
              totalDelay,
            });
            throw error;
          }

          // Calculate delay and wait
          const delay = this.calculateBackoffDelay(attempt, retryAfter);
          totalDelay += delay;

          log.debug('Rate limited (429), retrying', {
            context,
            attempt: attempt + 1,
            maxRetries: this.config.maxRetries,
            delay,
            retryAfter,
          });

          await this.sleep(delay);
        }
      }

      // Should never reach here, but TypeScript needs this
      throw lastError;
    } finally {
      this.releaseSlot();
    }
  }

  /**
   * Execute multiple functions in parallel with rate limiting
   *
   * @param fns - Array of async functions to execute
   * @param context - Optional context for logging
   * @returns Array of results
   */
  async executeAll<T>(fns: Array<() => Promise<T>>, context?: string): Promise<T[]> {
    log.debug('Executing batch with rate limiting', {
      context,
      count: fns.length,
      maxConcurrent: this.config.maxConcurrent,
    });

    const results = await Promise.all(
      fns.map((fn, index) => this.execute(fn, `${context}[${index}]`))
    );

    return results;
  }

  /**
   * Update rate limiter configuration at runtime
   */
  updateConfig(config: Partial<RateLimiterConfig>): void {
    if (config.maxConcurrent !== undefined) {
      this.config.maxConcurrent = config.maxConcurrent;
    }
    if (config.minDelay !== undefined) {
      this.config.minDelay = config.minDelay;
    }
    if (config.maxRetries !== undefined) {
      this.config.maxRetries = config.maxRetries;
    }
    if (config.baseRetryDelay !== undefined) {
      this.config.baseRetryDelay = config.baseRetryDelay;
    }

    log.info('Rate limiter config updated', this.config);
  }
}

// Export singleton instance for shared use
export const rateLimiter = new RateLimiter();

// Export types
export type { RateLimiterConfig, RateLimitedResult };
