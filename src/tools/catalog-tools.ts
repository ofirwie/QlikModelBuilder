// ===== CATALOG TOOLS =====
// Tool definitions for data catalog and space operations
// Note: qlik_search_apps and qlik_get_space_items have been replaced by qlik_search

/**
 * Tool definitions for catalog and space operations
 */
export const CATALOG_TOOLS = {
  qlik_get_spaces_catalog: {
    name: 'qlik_get_spaces_catalog',
    description: `Get comprehensive catalog of spaces in Qlik Cloud tenant.

Provides detailed information about:
- Space metadata (type, name, description)
- Members and permissions
- Item counts (apps, automations, data connections)
- Owner information
- Creation and modification dates

Filter by:
- Space type (personal, shared, managed, data)
- Owner ID
- Member user ID
- Spaces with data assets
- Minimum item count

Use cases:
- Audit all spaces in tenant
- Find unused spaces
- Analyze space membership
- Track space utilization`,
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for space name or description',
        },
        spaceType: {
          type: 'string',
          enum: ['personal', 'shared', 'managed', 'data', 'all'],
          description: 'Filter by space type',
        },
        ownerId: {
          type: 'string',
          description: 'Filter by space owner user ID',
        },
        memberUserId: {
          type: 'string',
          description: 'Filter spaces where user is a member',
        },
        hasDataAssets: {
          type: 'boolean',
          description: 'Filter spaces with data assets',
        },
        minItems: {
          type: 'number',
          description: 'Minimum number of items in space',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results',
          default: 50,
        },
        offset: {
          type: 'number',
          description: 'Offset for pagination',
          default: 0,
        },
        sortBy: {
          type: 'string',
          enum: ['name', 'type', 'createdAt', 'updatedAt'],
          description: 'Field to sort by',
          default: 'name',
        },
        sortOrder: {
          type: 'string',
          enum: ['asc', 'desc'],
          description: 'Sort order',
          default: 'asc',
        },
        includeMembers: {
          type: 'boolean',
          description: 'Include member list for each space',
          default: true,
        },
        includeCounts: {
          type: 'boolean',
          description: 'Include item counts for each space',
          default: true,
        },
        force: {
          type: 'boolean',
          description: 'Force refresh from server',
          default: false,
        },
        useCache: {
          type: 'boolean',
          description: 'Use cached data if available',
        },
      },
    },
  },
};
