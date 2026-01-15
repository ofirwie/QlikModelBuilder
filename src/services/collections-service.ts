// ===== COLLECTIONS SERVICE =====
// Uses the official @qlik/api library for Collections API
// Collections are used to organize and share apps in Qlik Cloud

import {
  getCollections,
  getCollection,
  getCollectionItems,
  getFavoritesCollection,
  CollectionTypes
} from '@qlik/api/collections';
import { isQlikApiInitialized } from '../config/qlik-api-config.js';

export interface Collection {
  id: string;
  name: string;
  description?: string;
  type: string;
  tenantId: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  itemCount?: number;
}

export interface CollectionItem {
  id: string;
  name: string;
  resourceType: string;
  resourceId: string;
  collectionId: string;
}

// Map user-friendly type to API type
function mapTypeToApi(type?: string): CollectionTypes | undefined {
  if (!type) return undefined;
  switch (type) {
    case 'public': return 'public';
    case 'private': return 'private';
    case 'publicgoverned': return 'publicgoverned';
    default: return undefined;
  }
}

export class CollectionsService {
  /**
   * List all collections the user has access to
   */
  async listCollections(options?: {
    limit?: number;
    type?: string;
    sort?: '+createdAt' | '-createdAt' | '+name' | '-name' | '+updatedAt' | '-updatedAt';
  }): Promise<Collection[]> {
    if (!isQlikApiInitialized()) {
      throw new Error('Collections API is only available on Qlik Cloud. @qlik/api is not initialized.');
    }

    try {
      const response = await getCollections({
        limit: options?.limit || 50,
        type: mapTypeToApi(options?.type),
        sort: options?.sort || '-createdAt',
      });

      return (response.data.data || []).map(this.mapCollection);
    } catch (error) {
      throw this.handleError(error, 'listCollections');
    }
  }

  /**
   * Get a specific collection by ID
   */
  async getCollectionById(collectionId: string): Promise<Collection> {
    if (!isQlikApiInitialized()) {
      throw new Error('Collections API is only available on Qlik Cloud. @qlik/api is not initialized.');
    }

    try {
      const response = await getCollection(collectionId);
      return this.mapCollection(response.data);
    } catch (error) {
      throw this.handleError(error, 'getCollection');
    }
  }

  /**
   * List items in a collection
   */
  async listCollectionItems(
    collectionId: string,
    options?: { limit?: number }
  ): Promise<CollectionItem[]> {
    if (!isQlikApiInitialized()) {
      throw new Error('Collections API is only available on Qlik Cloud. @qlik/api is not initialized.');
    }

    try {
      const response = await getCollectionItems(collectionId, {
        limit: options?.limit || 50,
      });

      return (response.data.data || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        resourceType: item.resourceType,
        resourceId: item.resourceId,
        collectionId: item.collectionId,
      }));
    } catch (error) {
      throw this.handleError(error, 'listCollectionItems');
    }
  }

  /**
   * Get the user's favorites collection
   */
  async getFavorites(): Promise<Collection | null> {
    if (!isQlikApiInitialized()) {
      throw new Error('Collections API is only available on Qlik Cloud. @qlik/api is not initialized.');
    }

    try {
      const response = await getFavoritesCollection();
      return this.mapCollection(response.data);
    } catch (error: any) {
      // If no favorites collection exists, return null
      if (error?.status === 404) {
        return null;
      }
      throw this.handleError(error, 'getFavorites');
    }
  }

  private mapCollection(data: any): Collection {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      type: data.type,
      tenantId: data.tenantId,
      ownerId: data.meta?.creatorId || data.ownerId,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      itemCount: data.itemCount,
    };
  }

  private handleError(error: any, operation: string): Error {
    const message = error?.data?.message ||
      error?.message ||
      `Unknown error in ${operation}`;
    return new Error(`CollectionsService.${operation} failed: ${message}`);
  }
}
