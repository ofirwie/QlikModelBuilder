// ===== LOGGING UTILITY =====
// Simple structured logging using console (can be replaced with Pino/Winston later)

import { LOG_LEVEL } from '../config/constants.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  timestamp: string;
  message: string;
  context?: Record<string, any>;
}

class Logger {
  private level: LogLevel;
  private levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor() {
    const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel;
    // Default to 'warn' for minimal logs, set LOG_LEVEL=info for more detail
    this.level = envLevel || 'warn';
  }

  /**
   * Set the log level
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Check if a log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.level];
  }

  /**
   * Format log entry
   */
  private formatLog(entry: LogEntry): string {
    const contextStr = entry.context
      ? ' ' + JSON.stringify(entry.context)
      : '';

    return `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}${contextStr}`;
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      level,
      timestamp: new Date().toISOString(),
      message,
      context,
    };

    const formatted = this.formatLog(entry);

    // IMPORTANT: MCP uses stdout for JSON-RPC protocol
    // ALL logs must go to stderr to avoid breaking MCP communication
    console.error(formatted);
  }

  /**
   * Convert unknown to loggable context
   */
  private toContext(data: unknown): Record<string, any> | undefined {
    if (data === undefined || data === null) {
      return undefined;
    }
    if (data instanceof Error) {
      return {
        error: data.message,
        stack: data.stack,
        name: data.name,
      };
    }
    if (typeof data === 'object') {
      return data as Record<string, any>;
    }
    return { value: String(data) };
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: unknown): void {
    this.log('debug', message, this.toContext(context));
  }

  /**
   * Log info message
   */
  info(message: string, context?: unknown): void {
    this.log('info', message, this.toContext(context));
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: unknown): void {
    this.log('warn', message, this.toContext(context));
  }

  /**
   * Log error message
   */
  error(message: string, context?: unknown): void {
    this.log('error', message, this.toContext(context));
  }

  /**
   * Create a child logger with default context
   */
  child(defaultContext: Record<string, any>): ChildLogger {
    return new ChildLogger(this, defaultContext);
  }
}

/**
 * Child logger with default context
 */
class ChildLogger {
  constructor(
    private parent: Logger,
    private defaultContext: Record<string, any>
  ) {}

  private mergeContext(context?: unknown): Record<string, any> {
    if (context === undefined || context === null) {
      return this.defaultContext;
    }
    if (context instanceof Error) {
      return {
        ...this.defaultContext,
        error: context.message,
        stack: context.stack,
        name: context.name,
      };
    }
    if (typeof context === 'object') {
      return { ...this.defaultContext, ...context };
    }
    return { ...this.defaultContext, value: String(context) };
  }

  debug(message: string, context?: unknown): void {
    this.parent.debug(message, this.mergeContext(context));
  }

  info(message: string, context?: unknown): void {
    this.parent.info(message, this.mergeContext(context));
  }

  warn(message: string, context?: unknown): void {
    this.parent.warn(message, this.mergeContext(context));
  }

  error(message: string, context?: unknown): void {
    this.parent.error(message, this.mergeContext(context));
  }
}

// Export singleton instance
export const logger = new Logger();

// Export types
export type { LogLevel, ChildLogger };
