// ===== API ADAPTER FACTORY =====

import { QlikApiAdapter } from './base-adapter.js';
import { CloudApiAdapter } from './cloud-adapter.js';
import { OnPremApiAdapter } from './onprem-adapter.js';
import { QlikMCPConfig } from '../config/index.js';
import { PLATFORM } from '../config/constants.js';

/**
 * Create the appropriate API adapter based on deployment configuration
 */
export function createApiAdapter(config: QlikMCPConfig): QlikApiAdapter {
  if (config.deployment === PLATFORM.CLOUD) {
    return new CloudApiAdapter(config.tenantUrl, config.authProvider);
  } else if (config.deployment === PLATFORM.ONPREM) {
    return new OnPremApiAdapter(
      config.tenantUrl,
      config.authProvider,
      config.virtualProxy
    );
  } else {
    throw new Error(`Unsupported deployment type: ${config.deployment}`);
  }
}

// Re-export types and classes
export { QlikApiAdapter } from './base-adapter.js';
export { CloudApiAdapter } from './cloud-adapter.js';
export { OnPremApiAdapter } from './onprem-adapter.js';
export type {
  App,
  ReloadTask,
  Container,
  Item,
  User,
  ListOptions,
  ReloadOptions,
} from './base-adapter.js';
