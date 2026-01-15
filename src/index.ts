// ===== QLIK MCP SERVER =====
// Production-ready MCP server with full tool registration
// Environment variables are passed by Claude Desktop via config

import { loadConfig, validateConfig } from './config/index.js';
import { initializeQlikApi } from './config/qlik-api-config.js';
import { createApiAdapter } from './adapters/index.js';
import { logger } from './utils/logger.js';
import { formatErrorForUser } from './utils/errors.js';
import { MCPServer } from './server/mcp-server.js';
import { HandlerRouter } from './server/handler-router.js';
import { registerAllTools } from './tools/index.js';
import { SimpleAppDeveloperService } from './services/app-developer-service-simple.js';
import { AutomationService } from './services/automation-service.js';
import { CacheManager } from './utils/cache-manager.js';
import { ApiClient } from './utils/api-client.js';

/**
 * Main entry point for Qlik MCP Server
 */
async function main() {
  try {
    // 1. Load and validate configuration
    const config = loadConfig();
    validateConfig(config);

    // 1.5. For on-premise with self-signed certificates, disable SSL verification
    if (config.deployment === 'on-premise') {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
      logger.info('On-premise mode: SSL certificate verification disabled');
    }

    // 1.6. Initialize @qlik/api for new tools (Cloud only)
    const qlikApiReady = initializeQlikApi();
    if (qlikApiReady) {
      logger.debug('@qlik/api initialized for Cloud');
    }

    // 2. Create platform-specific API adapter
    const adapter = createApiAdapter(config);

    // 3. Initialize core services
    const apiClient = new ApiClient({
      tenantUrl: config.tenantUrl,
      apiKey: config.authProvider.getAuthType() === 'api-key'
        ? (config.authProvider as any).apiKey
        : undefined,
      // Certificate auth for on-premise
      certPath: process.env.QLIK_CERT_PATH,
      keyPath: process.env.QLIK_CERT_KEY_PATH,
      rootCertPath: process.env.QLIK_ROOT_CERT_PATH,
      userDirectory: process.env.QLIK_USER_DIRECTORY,
      userId: process.env.QLIK_USER_ID,
    });

    const cacheManager = new CacheManager();
    const appDeveloperService = new SimpleAppDeveloperService(
      apiClient,
      cacheManager,
      config.deployment,  // 'cloud' or 'on-premise'
      config.tenantUrl
    );
    const automationService = new AutomationService(apiClient);

    // 4. Create handler router
    const router = new HandlerRouter(
      appDeveloperService,
      automationService,
      adapter,
      apiClient,
      cacheManager,
      config.tenantUrl,
      config.deployment  // Pass platform for on-premise support
    );

    // 5. Create MCP server
    const server = new MCPServer({
      name: 'qlik-mcp-server',
      version: '1.0.0',
      platform: config.deployment,
    });

    // 6. Register all tools
    registerAllTools(server.getRegistry(), router, config.deployment);
    const toolCount = server.getRegistry().getToolCount();

    // 7. Start server
    await server.start();

    // Single startup message
    logger.warn('Qlik MCP Server started', {
      platform: config.deployment,
      tools: toolCount,
      tenant: config.tenantUrl,
    });

  } catch (error) {
    logger.error('Failed to start MCP Server', error as Error);
    logger.error(formatErrorForUser(error));
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  logger.error(formatErrorForUser(error));
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', reason as Error);
  logger.error(formatErrorForUser(reason));
  process.exit(1);
});

// Start the server
main();
