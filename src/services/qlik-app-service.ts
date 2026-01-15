/**
 * Qlik App Service - Backward Compatibility Re-export
 *
 * This file now re-exports from the split app module.
 * The original 3,493 line file has been split into:
 * - app/app-types.ts: All interfaces and type definitions
 * - app/session-service.ts: Enigma.js session management
 * - app/selection-service.ts: Field selections and values
 * - app/object-data-service.ts: Object data extraction and hypercubes
 * - app/field-mapping-service.ts: Field and master item mapping
 * - app/index.ts: Re-exports and backward-compatible facade
 */
export * from './app/index.js';
