/**
 * WizardState.ts - State interfaces for QlikModelBuilder Wizard
 * Raw Extract Philosophy: No type detection in Phase 1
 */

// ============================================
// Field Definition (Raw Extract - NO type!)
// ============================================
export interface FieldDefinition {
  name: string;           // Field name from source
  include: boolean;       // Whether to load this field
  rename?: string;        // Optional: new name in QVD
}

// ============================================
// Table Definition
// ============================================
export interface TableDefinition {
  name: string;
  sourceTable?: string;        // Original name in DB
  fields: FieldDefinition[];
  incremental: IncrementalConfig;
  validation: ValidationResult;
}

// ============================================
// Incremental Load Configuration
// ============================================
export interface IncrementalConfig {
  enabled: boolean;
  strategy: 'full' | 'insert_only' | 'insert_update' | 'time_window';
  field: string;
  keepHistory: boolean;
  qvdPath?: string;
}

// ============================================
// Validation Result
// ============================================
export interface ValidationResult {
  existsInSource: boolean;
  fieldsMatch: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================
// Data Model Warning (Synthetic Keys, etc.)
// ============================================
export interface DataModelWarning {
  type: 'synthetic_key' | 'circular_ref' | 'orphan_table';
  severity: 'warning' | 'error';
  message: string;
  tables: string[];
  fields?: string[];
  suggestion?: string;
}

// ============================================
// Main Wizard State
// ============================================
export interface WizardState {
  // Metadata
  version: number;
  createdAt: string;
  updatedAt: string;

  // Navigation
  currentStep: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  entryPoint: 'spec' | 'template' | 'scratch' | null;
  specFilePath?: string;

  // Connection
  configured: boolean;
  tenantUrl: string;

  // Source Connection
  selectedSpaceId: string | null;
  selectedSpaceName: string | null;
  selectedSourceConnectionId: string | null;
  selectedSourceConnectionName: string | null;
  selectedSourceConnectionType: string | null;

  // Storage Connection (for QVD output)
  selectedStorageConnectionId: string | null;
  selectedStorageConnectionName: string | null;
  selectedStoragePath: string;

  // Tables
  tables: TableDefinition[];

  // Script
  generatedScript: string;
  editedScript: string | null;
  scriptWasEdited: boolean;

  // Deployment
  deployedAppId?: string;

  // Validation
  dataModelWarnings: DataModelWarning[];

  // Cached API Data (for offline)
  cachedSpaces: Array<{ id: string; name: string; type: string }>;
  cachedConnections: Array<{ id: string; qName: string; qType: string }>;
}

// ============================================
// Default State
// ============================================
export const DEFAULT_STATE: WizardState = {
  version: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  currentStep: 1,
  entryPoint: null,
  configured: false,
  tenantUrl: '',

  // Source Connection
  selectedSpaceId: null,
  selectedSpaceName: null,
  selectedSourceConnectionId: null,
  selectedSourceConnectionName: null,
  selectedSourceConnectionType: null,

  // Storage Connection
  selectedStorageConnectionId: null,
  selectedStorageConnectionName: null,
  selectedStoragePath: '',

  // Data
  tables: [],
  generatedScript: '',
  editedScript: null,
  scriptWasEdited: false,
  dataModelWarnings: [],

  // Cache
  cachedSpaces: [],
  cachedConnections: []
};
