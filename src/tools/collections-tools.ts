/**
 * Collections Tool Definitions
 * Uses: @qlik/api (official Qlik library)
 * Platform: Cloud only
 */

export const COLLECTIONS_TOOLS = {
  qlik_list_collections: {
    name: 'qlik_list_collections',
    description: `List all collections in Qlik Cloud.

**What are Collections?**
Collections are a way to organize and share apps, datasets, and other resources.
- Public collections: Visible to everyone in the tenant
- Private collections: Only visible to you
- Favorites: Your personal favorites collection

**Examples:**
- List all collections: {}
- List only public collections: { "type": "public" }
- Get favorites: { "type": "favorite" }
- Limit results: { "limit": 10 }

**Note:** This tool is only available on Qlik Cloud.`,
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          default: 50,
          description: 'Maximum number of collections to return'
        },
        type: {
          type: 'string',
          enum: ['public', 'private', 'favorite'],
          description: 'Filter by collection type'
        },
        sort: {
          type: 'string',
          default: '-createdAt',
          description: 'Sort order (e.g., "-createdAt", "name", "-updatedAt")'
        }
      }
    },
    cloudOnly: true
  },

  qlik_get_collection: {
    name: 'qlik_get_collection',
    description: `Get details of a specific collection by ID.

Returns collection metadata including:
- Name and description
- Type (public, private, favorite)
- Owner information
- Creation and update timestamps
- Item count

**Note:** This tool is only available on Qlik Cloud.`,
    inputSchema: {
      type: 'object',
      properties: {
        collectionId: {
          type: 'string',
          description: 'The collection ID'
        }
      },
      required: ['collectionId']
    },
    cloudOnly: true
  },

  qlik_list_collection_items: {
    name: 'qlik_list_collection_items',
    description: `List all items in a specific collection.

Returns the apps, datasets, and other resources in the collection.

**Examples:**
- List items: { "collectionId": "abc123" }
- Limit results: { "collectionId": "abc123", "limit": 20 }

**Note:** This tool is only available on Qlik Cloud.`,
    inputSchema: {
      type: 'object',
      properties: {
        collectionId: {
          type: 'string',
          description: 'The collection ID'
        },
        limit: {
          type: 'number',
          default: 50,
          description: 'Maximum number of items to return'
        }
      },
      required: ['collectionId']
    },
    cloudOnly: true
  },

  qlik_get_favorites: {
    name: 'qlik_get_favorites',
    description: `Get the user's favorites collection.

Returns the favorites collection, which is a special collection that contains
all items the user has marked as favorites.

**Note:** This tool is only available on Qlik Cloud.`,
    inputSchema: {
      type: 'object',
      properties: {}
    },
    cloudOnly: true
  }
};
