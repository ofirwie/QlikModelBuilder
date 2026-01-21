/**
 * ProjectSpec.ts - Full project specification types for QlikModelBuilder
 * This is the central data model for the entire application
 */

// ============================================
// Main Project Interface
// ============================================

export interface ProjectSpec {
  // Metadata
  version: string;
  createdAt: string;
  updatedAt: string;
  sourceFile: string;

  // Tables
  tables: TableSpec[];

  // Relationships
  relationships: RelationshipSpec[];

  // Business Rules
  businessRules: BusinessRule[];

  // Formulas
  formulas: FormulaSpec[];

  // Qlik Config
  qlikConfig: QlikConfig;

  // User Selections
  userSelections: UserSelections;
}

// ============================================
// Table & Field Definitions
// ============================================

export interface TableSpec {
  name: string;
  type: 'Fact' | 'Dimension' | 'Bridge' | 'Unknown';
  description: string;
  rowCount?: number;
  keyField?: string;
  incrementalField?: string;
  fields: FieldSpec[];
}

export interface FieldSpec {
  name: string;
  dataType?: string;
  keyType: 'PK' | 'BK' | 'FK' | null;
  description?: string;
  include: boolean;
  rename?: string;
}

// ============================================
// Relationships
// ============================================

export interface RelationshipSpec {
  id: string;
  sourceTable: string;
  sourceField: string;
  targetTable: string;
  targetField: string;
  cardinality: '1:1' | '1:M' | 'M:1' | 'M:M';
  isRequired: boolean;
  description?: string;
}

// ============================================
// Business Rules & Formulas
// ============================================

export interface BusinessRule {
  id: string;
  name: string;
  description: string;
  affectedTables: string[];
  formula?: string;
}

export interface FormulaSpec {
  name: string;
  expression: string;
  description?: string;
  type: 'measure' | 'dimension' | 'calculated_field';
}

// ============================================
// Qlik Configuration
// ============================================

export interface QlikConfig {
  tenantUrl?: string;
  spaceId?: string;
  spaceName?: string;
  appId?: string;
  appName?: string;
  connections: ConnectionConfig[];
}

export interface ConnectionConfig {
  id?: string;
  name: string;
  type: 'database' | 'datafiles' | 'rest';
  connectionString?: string;
  path?: string;
}

// ============================================
// User Selections
// ============================================

export interface UserSelections {
  mode: 'all' | 'spec' | 'manual';
  selectedTables: string[];
  incrementalConfig: Record<string, IncrementalConfig>;
}

export interface IncrementalConfig {
  enabled: boolean;
  strategy: 'full' | 'insert_only' | 'insert_update' | 'time_window';
  field: string;
  keepHistory: boolean;
}

// ============================================
// Default Values
// ============================================

export const DEFAULT_PROJECT_SPEC: ProjectSpec = {
  version: '2.0.0',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  sourceFile: '',
  tables: [],
  relationships: [],
  businessRules: [],
  formulas: [],
  qlikConfig: {
    connections: []
  },
  userSelections: {
    mode: 'spec',
    selectedTables: [],
    incrementalConfig: {}
  }
};

// ============================================
// Helper Functions
// ============================================

export function createEmptyProjectSpec(sourceFile: string = ''): ProjectSpec {
  return {
    ...DEFAULT_PROJECT_SPEC,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sourceFile
  };
}

export function getFactTables(project: ProjectSpec): TableSpec[] {
  return project.tables.filter(t => t.type === 'Fact');
}

export function getDimensionTables(project: ProjectSpec): TableSpec[] {
  return project.tables.filter(t => t.type === 'Dimension');
}

export function getTableByName(project: ProjectSpec, name: string): TableSpec | undefined {
  return project.tables.find(t => t.name === name);
}

export function getRelationshipsForTable(project: ProjectSpec, tableName: string): RelationshipSpec[] {
  return project.relationships.filter(
    r => r.sourceTable === tableName || r.targetTable === tableName
  );
}
