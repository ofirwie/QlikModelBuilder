/**
 * Unified Search Tool Definition
 * Replaces: qlik_search_apps, qlik_get_space_items
 * Supports: Cloud and On-Premise deployments
 */

export const SEARCH_TOOLS = {
  qlik_search: {
    name: 'qlik_search',
    description: `Unified search for Qlik resources across Cloud and On-Premise deployments.

⚠️ **DO NOT USE for data/analytics queries!**
For questions about incidents, tickets, SLA, satisfaction - use the semantic layer:
1. qlik_recognize_intent → understand query
2. qlik_get_domain_schema → get expressions
3. qlik_create_hypercube → get data with FIXED App ID

**Fixed App IDs (use directly, don't search):**
- qmb-main: a30ab30d-cf2a-41fa-86ef-cf4f189deecf
- qmb-main: e2f1700e-98dc-4ac9-b483-ca4a0de183ce

**Use qlik_search ONLY for:**
- Finding apps by name when you don't know the ID
- Listing datasets, automations, connections
- Admin/governance tasks

**Replaces:** qlik_search_apps, qlik_get_space_items

**Supported resource types:**
- app: Qlik Sense applications
- dataset: Data files and datasets (Cloud only)
- dataconnection: Data connections (Cloud only)
- automation: Automations (Cloud only)
- all: Search all types

**Platform differences:**
- Cloud: Uses Spaces, supports all resource types
- On-Premise: Uses Streams, apps only

**Search examples:**
- Find apps by name: { "query": "Sales Report" }
- Find in specific space: { "spaceName": "Finance" }
- Find by owner: { "ownerName": "john" }
- Apps with reload info: { "types": ["app"], "includeReloadInfo": true }
- Recent items: { "sortBy": "modified", "sortOrder": "desc" }
- Group by space: { "groupBy": "space" }
- Items created this year: { "createdAfter": "2024-01-01" }
- Items modified last month: { "modifiedAfter": "2024-11-01" }
- Old items: { "modifiedBefore": "2023-01-01" }

**Response ID fields:**
- id/resourceId: Use this for other tools (qlik_get_dataset_details, qlik_trigger_app_reload, etc.)
- itemId: Only for items API operations (rarely needed)
- resourceType: Original resource type from API

**Parameters:**
- query: Text search (name, description, tags)
- types: Resource types to search ['app', 'dataset', 'automation', 'dataconnection', 'all']
- spaceId/spaceName: Filter by space (Cloud) or stream (On-Premise)
- ownerId/ownerName: Filter by owner
- tags: Filter by tags
- includeReloadInfo: Include reload status for apps
- groupBy: Group results by 'space' or 'type'
- limit/offset: Pagination
- sortBy/sortOrder: Sorting`,
    inputSchema: {
      type: 'object',
      properties: {
        // What to search
        query: {
          type: 'string',
          description: 'Search text - matches name, description, and tags'
        },
        types: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['app', 'dataset', 'automation', 'dataconnection', 'all']
          },
          default: ['all'],
          description: 'Resource types to search. On-Premise only supports "app"'
        },

        // Where to search
        spaceId: {
          type: 'string',
          description: 'Space ID (Cloud) or Stream ID (On-Premise)'
        },
        spaceName: {
          type: 'string',
          description: 'Space name (Cloud) or Stream name (On-Premise) - resolved to ID'
        },
        allSpaces: {
          type: 'boolean',
          default: true,
          description: 'Search all spaces/streams'
        },

        // Filters
        ownerId: {
          type: 'string',
          description: 'Filter by owner user ID'
        },
        ownerName: {
          type: 'string',
          description: 'Filter by owner name or email'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by tags'
        },

        // Date filters
        createdAfter: {
          type: 'string',
          description: 'Filter items created after this date (ISO format, e.g., "2024-01-01")'
        },
        createdBefore: {
          type: 'string',
          description: 'Filter items created before this date (ISO format)'
        },
        modifiedAfter: {
          type: 'string',
          description: 'Filter items modified after this date (ISO format, e.g., "2024-06-01")'
        },
        modifiedBefore: {
          type: 'string',
          description: 'Filter items modified before this date (ISO format)'
        },

        // Options
        includeReloadInfo: {
          type: 'boolean',
          default: false,
          description: 'Include reload status for apps (adds extra API calls)'
        },
        includeDetails: {
          type: 'boolean',
          default: false,
          description: 'Include full metadata'
        },
        groupBy: {
          type: 'string',
          enum: ['none', 'space', 'type'],
          default: 'none',
          description: 'Group results by space or type'
        },

        // Pagination & Limits
        limit: {
          type: 'number',
          default: 50,
          description: 'Maximum results to return (after filtering)'
        },
        offset: {
          type: 'number',
          default: 0,
          description: 'Offset for pagination'
        },
        maxFetchItems: {
          type: 'number',
          default: 10000,
          description: 'Maximum items to fetch from API before filtering (default: 10000). Use lower values for faster searches on large tenants.'
        },
        sortBy: {
          type: 'string',
          enum: ['name', 'modified', 'created', 'type'],
          default: 'name',
          description: 'Sort field'
        },
        sortOrder: {
          type: 'string',
          enum: ['asc', 'desc'],
          default: 'asc',
          description: 'Sort order'
        }
      }
    },
    // Available for both Cloud and On-Premise (no cloudOnly flag)
  }
};
