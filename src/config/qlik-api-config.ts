// ===== @qlik/api CONFIGURATION =====
// This file initializes the official Qlik API library for new tools

import auth, { setDefaultHostConfig } from '@qlik/api/auth';
import { logger } from '../utils/logger.js';

const log = logger.child({ service: 'QlikApiConfig' });

let qlikApiInitialized = false;

/**
 * Initialize the @qlik/api library with credentials from environment variables.
 * This uses the same QLIK_TENANT_URL and QLIK_API_KEY as the legacy client.
 *
 * @returns true if initialization was successful, false otherwise
 */
export function initializeQlikApi(): boolean {
  if (qlikApiInitialized) {
    return true;
  }

  const tenantUrl = process.env.QLIK_TENANT_URL;
  const apiKey = process.env.QLIK_API_KEY;
  const deployment = process.env.QLIK_DEPLOYMENT?.toLowerCase();

  // @qlik/api only supports Qlik Cloud, not on-premise
  if (deployment === 'on-premise' || deployment === 'onprem' || deployment === 'on-prem') {
    log.warn('@qlik/api is only available for Qlik Cloud. On-premise will use legacy client.');
    return false;
  }

  if (!tenantUrl || !apiKey) {
    log.warn('Skipping @qlik/api initialization - missing QLIK_TENANT_URL or QLIK_API_KEY');
    return false;
  }

  try {
    // Extract hostname from tenant URL (remove https:// and any path)
    const hostUrl = new URL(tenantUrl).hostname;

    setDefaultHostConfig({
      host: hostUrl,
      authType: 'apikey',
      apiKey: apiKey,
    });

    qlikApiInitialized = true;
    return true;
  } catch (error) {
    log.error('Failed to initialize @qlik/api', error as Error);
    return false;
  }
}

/**
 * Check if @qlik/api has been initialized
 */
export function isQlikApiInitialized(): boolean {
  return qlikApiInitialized;
}
