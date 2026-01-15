// ===== CENTRALIZED CONSTANTS FOR QLIK MCP SERVER =====
// All magic numbers and configuration values in one place

// ===== CACHE TTL VALUES =====
export const CACHE_TTL = {
  DEFAULT: 5 * 60 * 1000,           // 5 minutes
  USER_CACHE: 30 * 60 * 1000,       // 30 minutes
  APP_LIST: 2 * 60 * 1000,          // 2 minutes
  SPACE_LIST: 10 * 60 * 1000,       // 10 minutes
  METADATA: 15 * 60 * 1000,         // 15 minutes
  RELOAD_STATUS: 30 * 1000,         // 30 seconds (more dynamic)
} as const;

// ===== BATCH SIZES =====
export const BATCH_SIZE = {
  APPS: 100,                         // Apps per request
  USERS: 100,                        // Users per request
  RELOADS: 50,                       // Reload history items
  CONSUMPTION_RECORDS: 1000,         // License consumption records
} as const;

// ===== TIMEOUTS =====
export const TIMEOUT = {
  API_REQUEST: 30000,                // 30 seconds
  ENGINE_CONNECT: 10000,             // 10 seconds
  ENGINE_REQUEST: 60000,             // 60 seconds (for long operations)
  RELOAD_TRIGGER: 120000,            // 2 minutes
} as const;

// ===== RETRY SETTINGS =====
export const RETRY = {
  MAX_ATTEMPTS: 3,
  BACKOFF_MS: 1000,                  // Initial backoff
  BACKOFF_MULTIPLIER: 2,             // Exponential backoff
} as const;

// ===== VALIDATION LIMITS =====
export const VALIDATION = {
  DEFAULT_RECORD_LIMIT: 100,         // Records to load for validation
  MAX_ITERATIONS: 10,                // Max auto-fix iterations
  MAX_APP_NAME_LENGTH: 255,
  MAX_DESCRIPTION_LENGTH: 1000,
} as const;

// ===== API PATHS =====
export const API_PATHS = {
  CLOUD: {
    BASE: '/api/v1',
    APPS: '/api/v1/apps',
    RELOADS: '/api/v1/reloads',
    SPACES: '/api/v1/spaces',
    USERS: '/api/v1/users',
    ITEMS: '/api/v1/items',
    AUTOMATIONS: '/api/v1/automations',
    AUTOML: '/api/v1/ml',
    ANSWERS: '/api/v1/answers',
    ALERTS: '/api/v1/alerts',
  },
  ONPREM: {
    BASE: '/qrs',
    APPS: '/qrs/app',
    RELOADS: '/qrs/reloadtask',
    STREAMS: '/qrs/stream',
    USERS: '/qrs/user',
  },
} as const;

// ===== ENGINE API =====
export const ENGINE = {
  PROTOCOL: 'wss://',
  APP_PATH: '/app/',
  SCHEMA_VERSION: '12.936.0',
} as const;

// ===== XRFKEY SETTINGS (On-Premise) =====
export const XRFKEY = {
  LENGTH: 16,
  CHARS: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  HEADER_NAME: 'X-Qlik-Xrfkey',
  QUERY_PARAM: 'xrfkey',
} as const;

// ===== LOG LEVELS =====
export const LOG_LEVEL = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
} as const;

// ===== PLATFORM TYPES =====
export const PLATFORM = {
  CLOUD: 'cloud',
  ONPREM: 'on-premise',
} as const;

// ===== AUTH TYPES =====
export const AUTH_TYPE = {
  API_KEY: 'api-key',
  OAUTH: 'oauth',
  CERTIFICATE: 'certificate',
  WINDOWS: 'windows',
} as const;
