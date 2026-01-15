/**
 * Collections Handlers
 * Handles collection tool requests using @qlik/api
 * Cloud only - uses the official Qlik API library
 */

import { CollectionsService } from '../services/collections-service.js';

const collectionsService = new CollectionsService();

/**
 * Handle qlik_list_collections
 */
export async function handleListCollections(args: any) {
  try {
    const collections = await collectionsService.listCollections({
      limit: args.limit,
      type: args.type,
      sort: args.sort,
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          count: collections.length,
          collections: collections.map(formatCollection),
        }, null, 2)
      }]
    };
  } catch (error: any) {
    return formatError(error, 'list collections');
  }
}

/**
 * Handle qlik_get_collection
 */
export async function handleGetCollection(args: any) {
  try {
    if (!args.collectionId) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'collectionId is required'
          }, null, 2)
        }]
      };
    }

    const collection = await collectionsService.getCollectionById(args.collectionId);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          collection: formatCollection(collection),
        }, null, 2)
      }]
    };
  } catch (error: any) {
    return formatError(error, 'get collection');
  }
}

/**
 * Handle qlik_list_collection_items
 */
export async function handleListCollectionItems(args: any) {
  try {
    if (!args.collectionId) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'collectionId is required'
          }, null, 2)
        }]
      };
    }

    const items = await collectionsService.listCollectionItems(
      args.collectionId,
      { limit: args.limit }
    );

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          collectionId: args.collectionId,
          count: items.length,
          items: items,
        }, null, 2)
      }]
    };
  } catch (error: any) {
    return formatError(error, 'list collection items');
  }
}

/**
 * Handle qlik_get_favorites
 */
export async function handleGetFavorites() {
  try {
    const favorites = await collectionsService.getFavorites();

    if (!favorites) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: 'No favorites collection found',
            favorites: null,
          }, null, 2)
        }]
      };
    }

    // Also get items in favorites
    const items = await collectionsService.listCollectionItems(favorites.id);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          favorites: formatCollection(favorites),
          itemCount: items.length,
          items: items,
        }, null, 2)
      }]
    };
  } catch (error: any) {
    return formatError(error, 'get favorites');
  }
}

/**
 * Format collection for response
 */
function formatCollection(collection: any) {
  return {
    id: collection.id,
    name: collection.name,
    description: collection.description,
    type: collection.type,
    ownerId: collection.ownerId,
    itemCount: collection.itemCount,
    createdAt: collection.createdAt,
    updatedAt: collection.updatedAt,
  };
}

/**
 * Format error response
 */
function formatError(error: any, operation: string) {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: false,
        error: error.message || `Failed to ${operation}`,
        hint: 'Collections are only available on Qlik Cloud'
      }, null, 2)
    }]
  };
}
