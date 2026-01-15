// ===== CONFIGURATION LOADER =====

import { PLATFORM } from './constants.js';
import { createAuthProvider, AuthProvider } from './auth.js';

export interface QlikMCPConfig {
  deployment: 'cloud' | 'on-premise';
  tenantUrl: string;
  virtualProxy?: string;
  authProvider: AuthProvider;
  claudeApiKey?: string;
  claudeModel?: string;
  logLevel?: string;
}

/**
 * Load configuration from environment variables
 */
export function loadConfig(): QlikMCPConfig {
  // 1. Determine deployment type (default to cloud)
  const deploymentEnv = process.env.QLIK_DEPLOYMENT?.toLowerCase();
  const deployment: 'cloud' | 'on-premise' =
    deploymentEnv === 'on-premise' || deploymentEnv === 'onprem' || deploymentEnv === 'on-prem'
      ? PLATFORM.ONPREM
      : PLATFORM.CLOUD;

  // 2. Get tenant URL
  const tenantUrl = process.env.QLIK_TENANT_URL;

  if (!tenantUrl) {
    throw new Error('QLIK_TENANT_URL is required');
  }

  // Remove trailing slash
  const normalizedUrl = tenantUrl.replace(/\/$/, '');

  // 3. Get virtual proxy (on-premise only)
  const virtualProxy = process.env.QLIK_VIRTUAL_PROXY;

  // 4. Get certificate paths (support both naming conventions)
  const certPath = process.env.QLIK_CERT_PATH;
  const keyPath = process.env.QLIK_KEY_PATH || process.env.QLIK_CERT_KEY_PATH;

  // 5. Get user identity for on-premise (required for certificate auth)
  const userDirectory = process.env.QLIK_USER_DIRECTORY;
  const userId = process.env.QLIK_USER_ID;

  // 6. Create auth provider
  const authProvider = createAuthProvider({
    apiKey: process.env.QLIK_API_KEY,
    oauth: process.env.QLIK_OAUTH_TOKEN ? {
      accessToken: process.env.QLIK_OAUTH_TOKEN,
      refreshToken: process.env.QLIK_OAUTH_REFRESH_TOKEN || '',
      clientId: process.env.QLIK_OAUTH_CLIENT_ID || '',
      clientSecret: process.env.QLIK_OAUTH_CLIENT_SECRET || '',
      tokenUrl: process.env.QLIK_OAUTH_TOKEN_URL || `${normalizedUrl}/oauth/token`,
    } : undefined,
    certificate: certPath ? {
      certPath: certPath,
      keyPath: keyPath || '',
      userDirectory: userDirectory,
      userId: userId,
    } : undefined,
  });

  // 5. Get optional Claude API configuration (for auto-fix features)
  const claudeApiKey = process.env.CLAUDE_API_KEY;
  const claudeModel = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';

  // 6. Get log level
  const logLevel = process.env.LOG_LEVEL || 'info';

  return {
    deployment,
    tenantUrl: normalizedUrl,
    virtualProxy,
    authProvider,
    claudeApiKey,
    claudeModel,
    logLevel,
  };
}

/**
 * Validate configuration
 */
export function validateConfig(config: QlikMCPConfig): void {
  // Check tenant URL format
  try {
    new URL(config.tenantUrl);
  } catch {
    throw new Error(`Invalid QLIK_TENANT_URL: ${config.tenantUrl}`);
  }

  // Validate deployment-specific requirements
  if (config.deployment === PLATFORM.ONPREM) {
    // On-premise specific validations
    if (config.virtualProxy && !/^[a-zA-Z0-9_-]+$/.test(config.virtualProxy)) {
      throw new Error('QLIK_VIRTUAL_PROXY must contain only alphanumeric characters, hyphens, and underscores');
    }
  }

  // Validate log level
  const validLogLevels = ['debug', 'info', 'warn', 'error'];
  if (config.logLevel && !validLogLevels.includes(config.logLevel)) {
    throw new Error(`LOG_LEVEL must be one of: ${validLogLevels.join(', ')}`);
  }
}

// Re-export types and utilities
export { AuthProvider, createAuthProvider } from './auth.js';
export * from './constants.js';
