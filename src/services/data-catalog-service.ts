/**
 * Data Catalog Service - Backward Compatibility Re-export
 *
 * This file now re-exports from the split catalog module.
 * The original 3,734 line file has been split into:
 * - catalog/catalog-types.ts: All interfaces and type definitions
 * - catalog/space-catalog-service.ts: Space management and member resolution
 * - catalog/dataset-service.ts: Dataset details and connection analysis
 * - catalog/item-search-service.ts: Item search, filtering, and content statistics
 * - catalog/index.ts: Re-exports and backward-compatible facade
 */
export * from './catalog/index.js';
