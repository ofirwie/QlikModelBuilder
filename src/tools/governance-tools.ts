/**
 * Tool definitions for governance and user management
 */

export const GOVERNANCE_TOOLS = {
  qlik_get_tenant_info: {
    name: 'qlik_get_tenant_info',
    description: 'Get Qlik Cloud tenant information',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },

  qlik_get_user_info: {
    name: 'qlik_get_user_info',
    description: 'Get detailed user information',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID' }
      },
      required: ['userId']
    }
  },

  qlik_search_users: {
    name: 'qlik_search_users',
    description: 'Search for users by name or email',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'User name or email to search' },
        limit: { type: 'number', default: 50 }
      },
      required: ['query']
    }
  },

  qlik_health_check: {
    name: 'qlik_health_check',
    description: 'Check server status and service health including governance capabilities',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },

  qlik_get_license_info: {
    name: 'qlik_get_license_info',
    description: 'Get license information including type, allocated seats, and usage. Works on both Cloud and On-Premise (QRS license endpoint).',
    inputSchema: {
      type: 'object',
      properties: {
        includeDetails: {
          type: 'boolean',
          default: true,
          description: 'Include detailed license breakdown by type'
        }
      }
    }
  }
};
