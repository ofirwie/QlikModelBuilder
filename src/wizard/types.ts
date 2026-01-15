/**
 * QlikModelBuilder - Wizard Types
 * Type definitions for the wizard engine
 */

// Wizard step identifiers
export type WizardStepId =
  | 'space_setup'
  | 'data_source'
  | 'table_selection'
  | 'field_mapping'
  | 'incremental_config'
  | 'review'
  | 'deploy';

// Wizard entry mode
export type WizardEntryMode = 'scratch' | 'spec' | 'template';

// Data source types
export type DataSourceType =
  | 'sqlserver'
  | 'oracle'
  | 'postgresql'
  | 'mysql'
  | 'rest_api'
  | 'excel'
  | 'csv'
  | 'json'
  | 'qvd';

// Incremental load strategies
export type IncrementalStrategy =
  | 'none'           // Full reload
  | 'by_date'        // By date field
  | 'by_id'          // By ID field
  | 'time_window'    // Last N days/weeks
  | 'custom';        // Custom logic

// Space types in Qlik Cloud
export type SpaceType = 'shared' | 'managed' | 'personal';

// Validation result
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
  step?: WizardStepId;
}

export interface ValidationWarning {
  code: string;
  message: string;
  field?: string;
}

// Space configuration
export interface SpaceConfig {
  id?: string;
  name: string;
  type: SpaceType;
  description?: string;
  isNew: boolean;
}

// Data connection / LIB configuration
export interface ConnectionConfig {
  id?: string;
  name: string;
  type: DataSourceType;
  connectionString?: string;
  // For REST API
  baseUrl?: string;
  authType?: 'none' | 'api_key' | 'bearer' | 'basic' | 'oauth2';
  authConfig?: Record<string, string>;
  headers?: Record<string, string>;
  // For database
  server?: string;
  database?: string;
  username?: string;
  password?: string;
  port?: number;
}

// Table configuration
export interface TableConfig {
  name: string;
  alias?: string;
  schema?: string;
  fields: FieldConfig[];
  incremental: IncrementalConfig;
  whereClause?: string;
}

// Field configuration
export interface FieldConfig {
  name: string;
  alias?: string;
  type: string;
  include: boolean;
  isPrimaryKey?: boolean;
  isIncrementalField?: boolean;
}

// Incremental load configuration
export interface IncrementalConfig {
  strategy: IncrementalStrategy;
  field?: string;
  // For time window
  windowSize?: number;
  windowUnit?: 'days' | 'weeks' | 'months';
  // For custom
  customLogic?: string;
  // Keep history
  keepHistory?: boolean;
}

// Project state - the full wizard state
export interface ProjectState {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;

  // Current wizard state
  currentStep: WizardStepId;
  entryMode: WizardEntryMode;
  completedSteps: WizardStepId[];

  // Configuration
  space: SpaceConfig | null;
  connection: ConnectionConfig | null;
  tables: TableConfig[];

  // Generated output
  generatedScript?: string;
  qvdPath?: string;
  appId?: string;

  // Validation
  lastValidation?: ValidationResult;
}

// Wizard step definition
export interface WizardStep {
  id: WizardStepId;
  name: string;
  nameHe: string;
  description: string;
  order: number;
  required: boolean;
  canGoBack: boolean;
  validate: (state: ProjectState) => ValidationResult;
}

// Step navigation result
export interface StepNavigationResult {
  success: boolean;
  currentStep: WizardStepId;
  previousStep?: WizardStepId;
  error?: string;
}

// Script generation options
export interface ScriptGenerationOptions {
  includeComments: boolean;
  commentLanguage: 'en' | 'he';
  useVariables: boolean;
  createQvdFolder: boolean;
}

// Deploy result
export interface DeployResult {
  success: boolean;
  appId?: string;
  appUrl?: string;
  errors?: string[];
  warnings?: string[];
  reloadStatus?: 'success' | 'failed' | 'pending';
  reloadErrors?: string[];
}

// Template metadata
export interface TemplateMetadata {
  id: string;
  name: string;
  description: string;
  category: 'source' | 'pattern' | 'domain';
  sourceType?: DataSourceType;
  patternType?: 'fact' | 'dimension' | 'bridge' | 'scd2' | 'snapshot';
  domain?: string;
  version: string;
  author?: string;
  tags: string[];
}

// Template definition
export interface Template extends TemplateMetadata {
  sourceConfig?: Partial<ConnectionConfig>;
  tableTemplates?: Partial<TableConfig>[];
  incrementalDefaults?: Partial<IncrementalConfig>;
  scriptSnippets?: Record<string, string>;
}

// Spec extraction result
export interface SpecExtractionResult {
  success: boolean;
  format: 'excel' | 'word' | 'pdf' | 'json' | 'unknown';
  extracted: Partial<ProjectState>;
  missing: string[];
  confidence: number;
}
