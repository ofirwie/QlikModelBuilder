/**
 * Tool definitions for AutoML management
 * All AutoML tools are cloud-only
 */

export const AUTOML_TOOLS = [
  // ===== EXPERIMENT MANAGEMENT =====
  {
    name: 'qlik_automl_get_experiments',
    description: 'List AutoML experiments',
    cloudOnly: true,
    inputSchema: {
      type: 'object',
      properties: {
        spaceId: { type: 'string', description: 'Filter by space ID' },
        limit: { type: 'number', description: 'Max results (default: 50)' },
        offset: { type: 'number', description: 'Pagination offset' }
      }
    }
  },

  {
    name: 'qlik_automl_get_experiment',
    description: 'Get experiment details',
    cloudOnly: true,
    inputSchema: {
      type: 'object',
      properties: {
        experimentId: { type: 'string', description: 'Experiment ID' },
        includeVersions: { type: 'boolean', description: 'Include version list' }
      },
      required: ['experimentId']
    }
  },

  // ===== DEPLOYMENT MANAGEMENT =====
  {
    name: 'qlik_automl_list_deployments',
    description: 'List all ML deployments',
    cloudOnly: true,
    inputSchema: {
      type: 'object',
      properties: {
        spaceId: { type: 'string', description: 'Filter by space ID' },
        limit: { type: 'number', description: 'Max results' },
        offset: { type: 'number', description: 'Pagination offset' }
      }
    }
  },

  {
    name: 'qlik_automl_get_deployment',
    description: 'Get deployment details',
    cloudOnly: true,
    inputSchema: {
      type: 'object',
      properties: {
        deploymentId: { type: 'string', description: 'Deployment ID' }
      },
      required: ['deploymentId']
    }
  }
];
