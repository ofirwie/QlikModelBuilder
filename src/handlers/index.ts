/**
 * Handlers Index - Central export for all MCP tool handlers
 *
 * Note: Tool routing is handled by HandlerRouter in src/server/handler-router.ts
 * This file exports handler modules for direct imports where needed.
 */

// Import all handler modules
import * as appHandlers from './app-handlers.js';
import * as automationHandlers from './automation-handlers.js';
import * as reloadHandlers from './reload-handlers.js';
import * as catalogHandlers from './catalog-handlers.js';
import * as governanceHandlers from './governance-handlers.js';
import * as lineageHandlers from './lineage-handlers.js';
import * as dataHandlers from './data-handlers.js';
import * as miscHandlers from './misc-handlers.js';
import * as answersHandlers from './answers-handlers.js';
import * as alertsHandlers from './alerts-handlers.js';
import * as automlHandlers from './automl-handlers.js';
import * as searchHandlers from './search-handlers.js';
import * as semanticHandlers from './semantic-handlers.js';
import * as intentHandlers from './intent-handlers.js';

// Export context utilities
export * from './context.js';

// Export individual handler modules for direct use
export {
  appHandlers,
  automationHandlers,
  reloadHandlers,
  catalogHandlers,
  governanceHandlers,
  lineageHandlers,
  dataHandlers,
  miscHandlers,
  answersHandlers,
  alertsHandlers,
  automlHandlers,
  searchHandlers,
  semanticHandlers,
  intentHandlers
};
