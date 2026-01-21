/**
 * @fileoverview Structured JSON logging service for Model Builder
 * @module model-builder/services/logger
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { LogEntry, AuditEntry, LogLevel, BuildStage } from '../types.js';

/** Maximum buffer size before auto-flush */
const MAX_BUFFER_SIZE = 100;

/** Maximum log file size in bytes (10MB) */
const MAX_LOG_FILE_SIZE = 10 * 1024 * 1024;

/** Number of rotated files to keep */
const MAX_ROTATED_FILES = 5;

/** Sensitive field patterns to redact */
const SENSITIVE_PATTERNS = [
  /api[_-]?key/i,
  /password/i,
  /secret/i,
  /token/i,
  /credential/i,
  /auth/i,
  /bearer/i,
];

/**
 * Sanitize an object by redacting sensitive fields
 */
function sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(details)) {
    // Check if key matches sensitive patterns
    const isSensitive = SENSITIVE_PATTERNS.some(pattern => pattern.test(key));

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeDetails(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Safe JSON stringify that handles circular references
 */
function safeStringify(obj: unknown, maxDepth = 10): string {
  const seen = new WeakSet();
  let depth = 0;

  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value) || depth > maxDepth) {
        return '[Circular or Max Depth]';
      }
      seen.add(value);
      depth++;
    }
    return value;
  });
}

/**
 * Logger class for structured JSON logging
 */
export class Logger {
  private sessionId: string;
  private userId?: string;
  private logDir: string;
  private logBuffer: LogEntry[] = [];
  private fileLoggingEnabled = true;
  private errorCount = 0;
  private lastErrorTime = 0;

  /**
   * Create a new Logger instance
   * @param sessionId - Session identifier
   * @param userId - Optional user identifier
   * @param logDir - Directory for log files (defaults to .qmb/logs)
   */
  constructor(sessionId: string, userId?: string, logDir?: string) {
    this.sessionId = sessionId;
    this.userId = userId;
    this.logDir = logDir || path.join(process.cwd(), '.qmb', 'logs');

    // Ensure log directory exists
    this.ensureLogDirectory();
  }

  /**
   * Create log directory if it doesn't exist
   */
  private ensureLogDirectory(): void {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (error) {
      console.warn(`[Logger] Could not create log directory: ${this.logDir}`, error);
      this.fileLoggingEnabled = false;
    }
  }

  /**
   * Get the current log file path
   */
  private getLogFilePath(): string {
    return path.join(this.logDir, `${this.sessionId}.log`);
  }

  /**
   * Get the audit file path
   */
  private getAuditFilePath(): string {
    return path.join(this.logDir, `${this.sessionId}.audit.json`);
  }

  /**
   * Create a log entry with common fields
   */
  private createEntry(
    level: LogLevel,
    component: string,
    action: string,
    details: Record<string, unknown>,
    stage?: BuildStage
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      session_id: this.sessionId,
      component,
      action,
      details: sanitizeDetails(details),
    };

    if (stage) {
      entry.stage = stage;
    }
    if (this.userId) {
      entry.user_id = this.userId;
    }

    return entry;
  }

  /**
   * Add entry to buffer and auto-flush if needed
   */
  private addToBuffer(entry: LogEntry): void {
    this.logBuffer.push(entry);

    // Auto-flush at threshold
    if (this.logBuffer.length >= MAX_BUFFER_SIZE) {
      this.flush();
    }
  }

  /**
   * Handle file write errors
   */
  private handleWriteError(error: unknown): void {
    const now = Date.now();
    this.errorCount++;

    // Reset error count if more than 1 minute has passed
    if (now - this.lastErrorTime > 60000) {
      this.errorCount = 1;
    }
    this.lastErrorTime = now;

    // Disable file logging after too many errors
    if (this.errorCount > 5) {
      console.warn('[Logger] Too many file write errors, disabling file logging');
      this.fileLoggingEnabled = false;

      // Schedule re-enable after 5 minutes
      setTimeout(() => {
        this.fileLoggingEnabled = true;
        this.errorCount = 0;
        console.info('[Logger] Re-enabling file logging');
      }, 5 * 60 * 1000);
    }
  }

  /**
   * Check and perform log rotation if needed
   */
  private checkRotation(): void {
    const logPath = this.getLogFilePath();

    try {
      if (!fs.existsSync(logPath)) {
        return;
      }

      const stats = fs.statSync(logPath);
      if (stats.size < MAX_LOG_FILE_SIZE) {
        return;
      }

      // Rotate files
      for (let i = MAX_ROTATED_FILES - 1; i >= 1; i--) {
        const oldPath = `${logPath}.${i}`;
        const newPath = `${logPath}.${i + 1}`;

        if (fs.existsSync(oldPath)) {
          if (i === MAX_ROTATED_FILES - 1) {
            fs.unlinkSync(oldPath); // Delete oldest
          } else {
            fs.renameSync(oldPath, newPath);
          }
        }
      }

      // Rotate current to .1
      fs.renameSync(logPath, `${logPath}.1`);
    } catch (error) {
      console.warn('[Logger] Error during log rotation:', error);
    }
  }

  /**
   * Log an ERROR level message
   */
  error(
    component: string,
    action: string,
    details: Record<string, unknown>,
    stage?: BuildStage
  ): LogEntry {
    const entry = this.createEntry('ERROR', component, action, details, stage);
    this.addToBuffer(entry);

    // Also output to console for errors
    console.error(`[${entry.timestamp}] ERROR ${component}:${action}`, details);

    return entry;
  }

  /**
   * Log a WARN level message
   */
  warn(
    component: string,
    action: string,
    details: Record<string, unknown>,
    stage?: BuildStage
  ): LogEntry {
    const entry = this.createEntry('WARN', component, action, details, stage);
    this.addToBuffer(entry);
    return entry;
  }

  /**
   * Log an INFO level message
   */
  info(
    component: string,
    action: string,
    details: Record<string, unknown>,
    stage?: BuildStage
  ): LogEntry {
    const entry = this.createEntry('INFO', component, action, details, stage);
    this.addToBuffer(entry);
    return entry;
  }

  /**
   * Log a DEBUG level message
   */
  debug(
    component: string,
    action: string,
    details: Record<string, unknown>,
    stage?: BuildStage
  ): LogEntry {
    const entry = this.createEntry('DEBUG', component, action, details, stage);
    this.addToBuffer(entry);
    return entry;
  }

  /**
   * Create an audit entry (written immediately for compliance)
   */
  audit(entry: Omit<AuditEntry, 'timestamp' | 'session_id'>): AuditEntry {
    const auditEntry: AuditEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
      session_id: this.sessionId,
    };

    if (this.userId && !auditEntry.user_id) {
      auditEntry.user_id = this.userId;
    }

    // Write immediately to audit file (compliance requirement)
    this.writeAuditEntry(auditEntry);

    return auditEntry;
  }

  /**
   * Calculate SHA256 hash of a script
   */
  static hashScript(script: string): string {
    return crypto.createHash('sha256').update(script).digest('hex');
  }

  /**
   * Write audit entry to file immediately
   */
  private writeAuditEntry(entry: AuditEntry): void {
    if (!this.fileLoggingEnabled) {
      console.info('[Audit]', safeStringify(entry));
      return;
    }

    try {
      const auditPath = this.getAuditFilePath();
      let entries: AuditEntry[] = [];

      // Load existing entries
      if (fs.existsSync(auditPath)) {
        const content = fs.readFileSync(auditPath, 'utf-8');
        entries = JSON.parse(content);
      }

      // Add new entry
      entries.push(entry);

      // Write back (atomic via sync write)
      fs.writeFileSync(auditPath, JSON.stringify(entries, null, 2));
    } catch (error) {
      console.warn('[Logger] Failed to write audit entry:', error);
      console.info('[Audit]', safeStringify(entry));
      this.handleWriteError(error);
    }
  }

  /**
   * Flush buffered logs to file
   */
  flush(): void {
    if (this.logBuffer.length === 0) {
      return;
    }

    const entries = [...this.logBuffer];
    this.logBuffer = [];

    if (!this.fileLoggingEnabled) {
      // Fallback to console
      entries.forEach(entry => {
        console.log(`[${entry.level}] ${entry.component}:${entry.action}`, entry.details);
      });
      return;
    }

    try {
      // Check rotation before writing
      this.checkRotation();

      const logPath = this.getLogFilePath();
      const lines = entries.map(e => safeStringify(e)).join('\n') + '\n';

      fs.appendFileSync(logPath, lines);
    } catch (error) {
      console.warn('[Logger] Failed to write logs to file:', error);
      // Fallback to console
      entries.forEach(entry => {
        console.log(`[${entry.level}] ${entry.component}:${entry.action}`, entry.details);
      });
      this.handleWriteError(error);
    }
  }

  /**
   * Get the current log buffer (for testing/debugging)
   */
  getBuffer(): LogEntry[] {
    return this.logBuffer;
  }

  /**
   * Get buffer size
   */
  getBufferSize(): number {
    return this.logBuffer.length;
  }

  /**
   * Clear the buffer without writing
   */
  clearBuffer(): void {
    this.logBuffer = [];
  }

  /**
   * Check if file logging is enabled
   */
  isFileLoggingEnabled(): boolean {
    return this.fileLoggingEnabled;
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Set user ID
   */
  setUserId(userId: string): void {
    this.userId = userId;
  }
}

/**
 * Factory function to create a Logger instance
 */
export function createLogger(sessionId: string, userId?: string, logDir?: string): Logger {
  return new Logger(sessionId, userId, logDir);
}

export default Logger;
