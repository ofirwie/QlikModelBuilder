// ===== AUTHENTICATION PROVIDER INTERFACES =====

import { AUTH_TYPE } from './constants.js';

/**
 * Base interface for all authentication providers
 */
export interface AuthProvider {
  /**
   * Get authentication headers for API requests
   */
  getAuthHeaders(): Promise<Record<string, string>>;

  /**
   * Check if the current token/credential is expired
   */
  isTokenExpired(): boolean;

  /**
   * Refresh the authentication token if supported
   */
  refreshToken(): Promise<void>;

  /**
   * Get the authentication type
   */
  getAuthType(): string;
}

/**
 * API Key (JWT) Authentication Provider
 * Works for both Cloud and On-Premise deployments
 */
export class ApiKeyAuthProvider implements AuthProvider {
  constructor(private apiKey: string) {
    if (!apiKey) {
      throw new Error('API key is required for ApiKeyAuthProvider');
    }
  }

  async getAuthHeaders(): Promise<Record<string, string>> {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  isTokenExpired(): boolean {
    // API keys don't expire (or have very long expiry)
    return false;
  }

  async refreshToken(): Promise<void> {
    // API keys don't need refresh
  }

  getAuthType(): string {
    return AUTH_TYPE.API_KEY;
  }
}

/**
 * OAuth 2.1 Authentication Provider
 * Used for Cloud deployments with interactive authentication
 */
export class OAuthAuthProvider implements AuthProvider {
  private accessToken: string;
  private refreshTokenValue: string;
  private expiresAt: number;
  private clientId: string;
  private clientSecret: string;
  private tokenUrl: string;

  constructor(config: {
    accessToken: string;
    refreshToken: string;
    expiresAt?: number;
    clientId: string;
    clientSecret: string;
    tokenUrl: string;
  }) {
    this.accessToken = config.accessToken;
    this.refreshTokenValue = config.refreshToken;
    this.expiresAt = config.expiresAt || Date.now() + 3600000; // 1 hour default
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.tokenUrl = config.tokenUrl;
  }

  async getAuthHeaders(): Promise<Record<string, string>> {
    // Refresh if expired
    if (this.isTokenExpired()) {
      await this.refreshToken();
    }

    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  isTokenExpired(): boolean {
    // Add 5 minute buffer
    return Date.now() >= (this.expiresAt - 300000);
  }

  async refreshToken(): Promise<void> {
    try {
      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.refreshTokenValue,
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.expiresAt = Date.now() + (data.expires_in * 1000);

      if (data.refresh_token) {
        this.refreshTokenValue = data.refresh_token;
      }
    } catch (error) {
      throw new Error(`Failed to refresh OAuth token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getAuthType(): string {
    return AUTH_TYPE.OAUTH;
  }
}

/**
 * Certificate Authentication Provider
 * Used for On-Premise deployments with client certificates
 */
export class CertificateAuthProvider implements AuthProvider {
  private userDirectory: string;
  private userId: string;

  constructor(
    private certPath: string,
    private keyPath: string,
    userDirectory?: string,
    userId?: string
  ) {
    if (!certPath || !keyPath) {
      throw new Error('Certificate and key paths are required for CertificateAuthProvider');
    }
    // Default to internal service account if not specified
    this.userDirectory = userDirectory || 'INTERNAL';
    this.userId = userId || 'sa_api';
  }

  async getAuthHeaders(): Promise<Record<string, string>> {
    // Certificate auth requires X-Qlik-User header to identify the user
    return {
      'Content-Type': 'application/json',
      'X-Qlik-User': `UserDirectory=${this.userDirectory}; UserId=${this.userId}`,
    };
  }

  isTokenExpired(): boolean {
    return false;
  }

  async refreshToken(): Promise<void> {
    // Certificates don't need refresh
  }

  getAuthType(): string {
    return AUTH_TYPE.CERTIFICATE;
  }

  getCertPath(): string {
    return this.certPath;
  }

  getKeyPath(): string {
    return this.keyPath;
  }
}

/**
 * No Authentication Provider
 * Used for On-Premise deployments where ApiClient handles certificate auth directly
 */
export class NoAuthProvider implements AuthProvider {
  async getAuthHeaders(): Promise<Record<string, string>> {
    return {
      'Content-Type': 'application/json',
    };
  }

  isTokenExpired(): boolean {
    return false;
  }

  async refreshToken(): Promise<void> {
    // No auth to refresh
  }

  getAuthType(): string {
    return 'none';
  }
}

/**
 * Factory function to create appropriate auth provider based on configuration
 */
export function createAuthProvider(config: {
  apiKey?: string;
  oauth?: {
    accessToken: string;
    refreshToken: string;
    expiresAt?: number;
    clientId: string;
    clientSecret: string;
    tokenUrl: string;
  };
  certificate?: {
    certPath: string;
    keyPath: string;
    userDirectory?: string;
    userId?: string;
  };
}): AuthProvider {
  // Priority: API Key > OAuth > Certificate
  if (config.apiKey) {
    return new ApiKeyAuthProvider(config.apiKey);
  }

  if (config.oauth) {
    return new OAuthAuthProvider(config.oauth);
  }

  if (config.certificate && config.certificate.certPath && config.certificate.keyPath) {
    // Only use CertificateAuthProvider if both cert and key paths are provided
    return new CertificateAuthProvider(
      config.certificate.certPath,
      config.certificate.keyPath,
      config.certificate.userDirectory,
      config.certificate.userId
    );
  }

  // For on-premise with folder-based certs, return NoAuthProvider
  // ApiClient handles certificate auth directly for QRS calls
  if (config.certificate?.certPath) {
    return new NoAuthProvider();
  }

  throw new Error('No valid authentication configuration provided. Set QLIK_API_KEY for Cloud or QLIK_CERT_PATH for On-Premise.');
}
