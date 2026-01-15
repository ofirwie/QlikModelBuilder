// ===== ERROR HANDLING UTILITIES =====

/**
 * Error codes for standardized error handling
 */
export enum ErrorCode {
  // Authentication errors
  AUTH_FAILED = 'AUTH_FAILED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',

  // Resource errors
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  PERMISSION_DENIED = 'PERMISSION_DENIED',

  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_PARAMS = 'INVALID_PARAMS',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // Platform errors
  PLATFORM_NOT_SUPPORTED = 'PLATFORM_NOT_SUPPORTED',
  FEATURE_NOT_AVAILABLE = 'FEATURE_NOT_AVAILABLE',

  // API errors
  API_ERROR = 'API_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMIT = 'RATE_LIMIT',

  // Engine errors
  ENGINE_ERROR = 'ENGINE_ERROR',
  ENGINE_CONNECTION_FAILED = 'ENGINE_CONNECTION_FAILED',
  ENGINE_SESSION_EXPIRED = 'ENGINE_SESSION_EXPIRED',

  // Reload errors
  RELOAD_FAILED = 'RELOAD_FAILED',
  RELOAD_TIMEOUT = 'RELOAD_TIMEOUT',

  // Configuration errors
  CONFIG_ERROR = 'CONFIG_ERROR',
  INVALID_CONFIG = 'INVALID_CONFIG',

  // Generic errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Base error class for Qlik MCP Server
 */
export class QlikMCPError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: Record<string, any>;
  public readonly timestamp: string;

  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'QlikMCPError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON for logging/serialization
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

/**
 * Platform not supported error
 */
export class PlatformNotSupportedError extends QlikMCPError {
  constructor(feature: string, platform: string) {
    super(
      ErrorCode.PLATFORM_NOT_SUPPORTED,
      `${feature} is not supported on ${platform}`,
      { feature, platform }
    );
    this.name = 'PlatformNotSupportedError';
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends QlikMCPError {
  constructor(message: string, details?: Record<string, any>) {
    super(ErrorCode.AUTH_FAILED, message, details);
    this.name = 'AuthenticationError';
  }
}

/**
 * Validation error
 */
export class ValidationError extends QlikMCPError {
  constructor(message: string, details?: Record<string, any>) {
    super(ErrorCode.VALIDATION_ERROR, message, details);
    this.name = 'ValidationError';
  }
}

/**
 * Resource not found error
 */
export class NotFoundError extends QlikMCPError {
  constructor(resourceType: string, resourceId: string) {
    super(
      ErrorCode.NOT_FOUND,
      `${resourceType} not found: ${resourceId}`,
      { resourceType, resourceId }
    );
    this.name = 'NotFoundError';
  }
}

/**
 * API error
 */
export class ApiError extends QlikMCPError {
  constructor(
    message: string,
    public readonly statusCode?: number,
    details?: Record<string, any>
  ) {
    super(ErrorCode.API_ERROR, message, { ...details, statusCode });
    this.name = 'ApiError';
  }
}

/**
 * Engine API error
 */
export class EngineError extends QlikMCPError {
  constructor(message: string, details?: Record<string, any>) {
    super(ErrorCode.ENGINE_ERROR, message, details);
    this.name = 'EngineError';
  }
}

/**
 * Configuration error
 */
export class ConfigError extends QlikMCPError {
  constructor(message: string, details?: Record<string, any>) {
    super(ErrorCode.CONFIG_ERROR, message, details);
    this.name = 'ConfigError';
  }
}

/**
 * Convert unknown errors to QlikMCPError
 */
export function normalizeError(error: unknown): QlikMCPError {
  if (error instanceof QlikMCPError) {
    return error;
  }

  if (error instanceof Error) {
    return new QlikMCPError(
      ErrorCode.UNKNOWN_ERROR,
      error.message,
      { originalError: error.name, stack: error.stack }
    );
  }

  return new QlikMCPError(
    ErrorCode.UNKNOWN_ERROR,
    String(error)
  );
}

/**
 * Error handler utility for consistent error formatting
 */
export function formatErrorForUser(error: unknown): string {
  const normalizedError = normalizeError(error);

  let message = `[${normalizedError.code}] ${normalizedError.message}`;

  if (normalizedError.details) {
    const detailsStr = Object.entries(normalizedError.details)
      .filter(([key]) => key !== 'stack' && key !== 'originalError')
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');

    if (detailsStr) {
      message += `\nDetails: ${detailsStr}`;
    }
  }

  return message;
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof QlikMCPError) {
    const retryableCodes = [
      ErrorCode.NETWORK_ERROR,
      ErrorCode.TIMEOUT,
      ErrorCode.RATE_LIMIT,
      ErrorCode.ENGINE_CONNECTION_FAILED,
    ];
    return retryableCodes.includes(error.code);
  }

  return false;
}
