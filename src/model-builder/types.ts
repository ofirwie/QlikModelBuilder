/**
 * @fileoverview Type definitions for the Data Model Builder (Stage 2)
 * @version 1.0.0
 * @module model-builder/types
 */

// ============================================================================
// Type Version
// ============================================================================

/**
 * Type definition version for compatibility tracking
 */
export const TYPE_VERSION = {
  major: 1,
  minor: 0,
  patch: 0,
  toString(): string {
    return `${this.major}.${this.minor}.${this.patch}`;
  },
};

// ============================================================================
// Section 1: Core Enums/Union Types
// ============================================================================

/**
 * Supported data model types for Qlik
 */
export type ModelType = 'star_schema' | 'snowflake' | 'link_table' | 'concatenated';

/**
 * Table classification in data model
 */
export type TableClassification = 'fact' | 'dimension' | 'link' | 'calendar';

/**
 * Build stages (A-F) with user approval at each stage
 * - A: Configuration & setup
 * - B: Dimension tables
 * - C: Fact tables
 * - D: Calendar/Date tables
 * - E: Link tables (if needed)
 * - F: Final review & optimization
 */
export type BuildStage = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

/**
 * Issue severity levels for Gemini review
 */
export type IssueSeverity = 'critical' | 'warning' | 'info';

/**
 * Categories of issues that can be found in script review
 */
export type IssueCategory = 'syntax' | 'anti-pattern' | 'best-practice' | 'model-size';

/**
 * Log levels for structured logging
 */
export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';

/**
 * Field semantic types for classification
 */
export type FieldSemanticType = 'key' | 'measure' | 'dimension' | 'attribute' | 'date' | 'timestamp';

/**
 * Relationship cardinality types
 */
export type RelationshipType = 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';

/**
 * Primitive data types supported by Stage 1 parser
 */
export type FieldDataType = 'string' | 'integer' | 'decimal' | 'date' | 'datetime' | 'boolean';

// ============================================================================
// Section 2: Input Interfaces (Stage 1 -> Stage 2)
// ============================================================================

/**
 * Field definition from Stage 1 parser
 */
export interface Stage1Field {
  /** Field name as defined in source */
  name: string;
  /** Data type detected by parser */
  type: FieldDataType;
}

/**
 * Table definition from Stage 1 parser
 */
export interface Stage1Table {
  /** Logical table name */
  name: string;
  /** Original source name (QVD file name, etc.) */
  source_name: string;
  /** Fields in this table */
  fields: Stage1Field[];
}

/**
 * Relationship hint from specification document
 */
export interface RelationshipHint {
  /** Source field in format "Table.Field" */
  from: string;
  /** Target field in format "Table.Field" */
  to: string;
  /** Cardinality type */
  type: RelationshipType;
}

/**
 * Complete input from Stage 1 (Parser) to Stage 2 (Model Builder)
 */
export interface Stage1Input {
  /** Schema version for compatibility */
  version: string;
  /** Source document path */
  source: string;
  /** ISO 8601 timestamp when parsed */
  parsed_at: string;
  /** Tables defined in the specification */
  tables: Stage1Table[];
  /** Relationship hints from specification */
  relationship_hints: RelationshipHint[];
}

// ============================================================================
// Section 3: QVD Sample Data
// ============================================================================

/**
 * Field statistics from QVD sampling
 */
export interface QvdFieldSample {
  /** Field name */
  name: string;
  /** Detected data type */
  type: string;
  /** Number of distinct values */
  cardinality: number;
  /** Percentage of null values (0-100) */
  null_percent: number;
  /** Sample values from the field */
  sample_values: string[];
  /** Minimum value (for numeric/date fields) */
  min_value?: string | number;
  /** Maximum value (for numeric/date fields) */
  max_value?: string | number;
}

/**
 * Sample data from a QVD file
 */
export interface QvdSampleData {
  /** Table name */
  table_name: string;
  /** Total row count in QVD */
  row_count: number;
  /** Field samples */
  fields: QvdFieldSample[];
}

// ============================================================================
// Section 4: Enriched Model Spec (after analysis)
// ============================================================================

/**
 * Field enriched with analysis results
 */
export interface EnrichedField {
  /** Field name */
  name: string;
  /** Data type */
  type: string;
  /** Number of distinct values */
  cardinality: number;
  /** Percentage of null values */
  null_percent: number;
  /** Whether this field is a key candidate */
  is_key_candidate: boolean;
  /** Whether this field contains dates */
  is_date_field: boolean;
  /** Sample values for reference */
  sample_values: string[];
  /** Semantic type classification */
  semantic_type?: FieldSemanticType;
}

/**
 * Table enriched with classification and analysis
 */
export interface EnrichedTable {
  /** Logical table name */
  name: string;
  /** Original source name */
  source_name: string;
  /** Total row count */
  row_count: number;
  /** Enriched field definitions */
  fields: EnrichedField[];
  /** Table classification (fact, dimension, etc.) */
  classification?: TableClassification;
  /** Confidence score for classification (0-1) */
  classification_confidence?: number;
}

/**
 * Relationship enriched with analysis
 */
export interface EnrichedRelationship {
  /** Source table name */
  from_table: string;
  /** Source field name */
  from_field: string;
  /** Target table name */
  to_table: string;
  /** Target field name */
  to_field: string;
  /** Relationship cardinality */
  type: RelationshipType;
  /** Cardinality of from field */
  from_cardinality: number;
  /** Cardinality of to field */
  to_cardinality: number;
  /** Whether relationship was validated (both tables/fields exist) */
  validated: boolean;
  /** Confidence score (0-1) */
  confidence?: number;
  /** Whether this was inferred or explicit from spec */
  inferred?: boolean;
}

/**
 * Date field information for calendar generation
 */
export interface DateFieldInfo {
  /** Table containing the date field */
  table_name: string;
  /** Field name */
  field_name: string;
  /** Field data type */
  type: string;
  /** Sample values from the field */
  sample_values?: string[];
  /** Minimum date value */
  min_date?: string;
  /** Maximum date value */
  max_date?: string;
  /** Date format detected */
  format?: string;
}

/**
 * Complete enriched model specification
 */
export interface EnrichedModelSpec {
  /** Enriched tables */
  tables: EnrichedTable[];
  /** Enriched relationships */
  relationships: EnrichedRelationship[];
  /** Date fields for calendar generation */
  date_fields: DateFieldInfo[];
  /** Recommended model type */
  recommended_model_type?: ModelType;
  /** Confidence in recommendation (0-1) */
  recommendation_confidence?: number;
}

// ============================================================================
// Section 5: Review Types (Gemini Integration)
// ============================================================================

/**
 * Location of an issue in the script
 */
export interface IssueLocation {
  /** Line number (1-based) */
  line?: number;
  /** Column number (1-based) */
  column?: number;
  /** Table name if applicable */
  table?: string;
  /** Field name if applicable */
  field?: string;
  /** Code snippet around the issue */
  snippet?: string;
}

/**
 * A single issue found during review
 */
export interface ReviewIssue {
  /** Unique issue identifier */
  issue_id: string;
  /** Issue severity */
  severity: IssueSeverity;
  /** Issue category */
  category: IssueCategory;
  /** Short issue title */
  title: string;
  /** Where the issue was found */
  location: IssueLocation;
  /** Detailed description */
  description: string;
  /** How to fix it */
  recommendation: string;
  /** Example of the fix */
  fix_example: string;
}

/**
 * Request payload for Gemini review
 */
export interface GeminiReviewRequest {
  /** The Qlik script to review */
  script: string;
  /** Model type for context */
  model_type: ModelType;
  /** Number of fact tables */
  facts_count: number;
  /** Number of dimension tables */
  dimensions_count: number;
  /** Expected total row count */
  expected_rows: number;
}

/**
 * Response from Gemini review
 */
export interface GeminiReviewResponse {
  /** Overall review status */
  review_status: 'issues_found' | 'approved';
  /** Score from 0-100 */
  score: number;
  /** List of issues found */
  issues: ReviewIssue[];
  /** Human-readable summary */
  summary: string;
}

// ============================================================================
// Section 5.4b: Analysis Types (for BuildContext)
// Note: TableClassification is already defined above in Section 2.3
// ============================================================================

/**
 * Result of classifying a single table
 */
export interface TableClassificationResult {
  table_name: string;
  classification: TableClassification;
  confidence: number;
  reasoning: string[];
}

/**
 * Alternative model type suggestion
 */
export interface ModelTypeAlternative {
  model: ModelType;
  reason: string;
  pros: string[];
  cons: string[];
}

/**
 * Model type recommendation
 */
export interface ModelTypeRecommendation {
  recommended_model: ModelType;
  confidence: number;
  alternatives: ModelTypeAlternative[];
  reasoning: string;
}

/**
 * Warning from analysis
 */
export interface AnalysisWarning {
  type: string;
  severity: string;
  message: string;
  tables_involved: string[];
  recommendation?: string;
}

/**
 * Complete analysis result
 */
export interface AnalysisResult {
  classifications: Map<string, TableClassificationResult>;
  model_recommendation: ModelTypeRecommendation;
  warnings: AnalysisWarning[];
  recommendations: string[];
}

// ============================================================================
// Section 5.5: Script Builder Types
// ============================================================================

/**
 * Configuration for script building
 */
export interface BuildConfig {
  /** Project name for script header */
  project_name: string;
  /** Path to QVD files (e.g., 'lib://QVD/') */
  qvd_path: string;
  /** Calendar language ('EN' | 'HE') */
  calendar_language: 'EN' | 'HE';
  /** Whether to use AUTONUMBER for Link Table keys */
  use_autonumber: boolean;
}

/**
 * Context for building a script stage
 */
export interface BuildContext {
  /** Current session state */
  session: ModelBuilderSession;
  /** Enriched model specification */
  spec: EnrichedModelSpec;
  /** Analysis results with classifications */
  analysis: AnalysisResult;
  /** Build configuration */
  config: BuildConfig;
}

/**
 * Output from building a single stage
 */
export interface StageScript {
  /** Build stage identifier */
  stage: BuildStage;
  /** Generated Qlik script content */
  script: string;
  /** Table names included in this stage */
  tables_included: string[];
  /** Estimated number of lines in script */
  estimated_lines: number;
}

/**
 * Result of script validation
 */
export interface ScriptValidationResult {
  /** Whether script is valid */
  valid: boolean;
  /** List of validation errors */
  errors: ScriptValidationError[];
  /** List of validation warnings */
  warnings: ScriptValidationWarning[];
}

/**
 * Script validation error
 */
export interface ScriptValidationError {
  /** Line number (1-based) */
  line?: number;
  /** Error message */
  message: string;
  /** Error code */
  code: string;
}

/**
 * Script validation warning
 */
export interface ScriptValidationWarning {
  /** Line number (1-based) */
  line?: number;
  /** Warning message */
  message: string;
  /** Warning code */
  code: string;
}

// ============================================================================
// Section 6: Session State
// ============================================================================

/**
 * Complete session state for Model Builder
 */
export interface ModelBuilderSession {
  /** Unique session identifier */
  session_id: string;
  /** Project name */
  project_name: string;
  /** ISO 8601 creation timestamp */
  created_at: string;
  /** ISO 8601 last update timestamp */
  updated_at: string;
  /** Current build stage */
  current_stage: BuildStage;
  /** Stages that have been approved */
  completed_stages: BuildStage[];
  /** Selected model type (null if not yet chosen) */
  model_type: ModelType | null;
  /** Approved script parts by stage */
  approved_script_parts: Partial<Record<BuildStage, string>>;
  /** Tables pending processing */
  pending_tables: string[];
  /** History of Gemini reviews */
  gemini_reviews: GeminiReviewResponse[];
  /** Optional user identifier */
  user_id?: string;
}

// ============================================================================
// Section 7: Logging Types
// ============================================================================

/**
 * A single log entry
 */
export interface LogEntry {
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Log level */
  level: LogLevel;
  /** Session this log belongs to */
  session_id: string;
  /** Build stage if applicable */
  stage?: BuildStage;
  /** Component that generated the log */
  component: string;
  /** Action being performed */
  action: string;
  /** Additional details */
  details: Record<string, unknown>;
  /** User identifier if available */
  user_id?: string;
}

/**
 * Audit trail entry for compliance
 */
export interface AuditEntry {
  /** Type of audit event */
  audit_type: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Session identifier */
  session_id: string;
  /** User who performed the action */
  user_id?: string;
  /** Action description */
  action: string;
  /** SHA256 hash of script content */
  script_hash?: string;
  /** Gemini review score */
  gemini_score?: number;
  /** Number of issues fixed */
  issues_fixed?: number;
}

// ============================================================================
// Section 8: Output Interfaces (Stage 2 -> Stage 3)
// ============================================================================

/**
 * Fact table definition for output
 */
export interface FactDefinition {
  /** Table name */
  name: string;
  /** Source QVD or table */
  source: string;
  /** Fields in the fact table */
  fields: string[];
  /** Foreign keys to dimensions */
  dimension_keys: string[];
  /** Measures (numeric fields) */
  measures: string[];
}

/**
 * Dimension table definition for output
 */
export interface DimensionDefinition {
  /** Table name */
  name: string;
  /** Source QVD or table */
  source: string;
  /** Primary key field */
  primary_key: string;
  /** Attribute fields */
  attributes: string[];
}

/**
 * Calendar table definition for output
 */
export interface CalendarDefinition {
  /** Table name */
  name: string;
  /** Date field to link */
  date_field: string;
  /** Minimum date */
  min_date: string;
  /** Maximum date */
  max_date: string;
  /** Fields to generate */
  fields: string[];
}

/**
 * Relationship definition for output
 */
export interface OutputRelationship {
  /** Source table */
  from_table: string;
  /** Source field */
  from_field: string;
  /** Target table */
  to_table: string;
  /** Target field */
  to_field: string;
}

/**
 * Complete output from Stage 2 to Stage 3
 */
export interface Stage2Output {
  /** Schema version */
  version: string;
  /** Selected model type */
  model_type: ModelType;
  /** ISO 8601 creation timestamp */
  created_at: string;
  /** Fact table definitions */
  facts: FactDefinition[];
  /** Dimension table definitions */
  dimensions: DimensionDefinition[];
  /** Calendar table definitions */
  calendars: CalendarDefinition[];
  /** Relationship definitions */
  relationships: OutputRelationship[];
  /** Gemini review summary */
  gemini_review: {
    /** Final score */
    score: number;
    /** Approval status */
    status: 'approved' | 'approved_with_warnings';
    /** Number of issues fixed */
    issues_fixed: number;
  };
}

// ============================================================================
// Section 9: Transformation & Script Types
// ============================================================================

/**
 * Data transformation rule for cleansing/manipulation
 */
export interface TransformationRule {
  /** Field to transform */
  field: string;
  /** Transformation type */
  type: 'trim' | 'uppercase' | 'lowercase' | 'replace' | 'format_date' | 'custom';
  /** Parameters for the transformation */
  params?: Record<string, string>;
  /** Custom expression (for type='custom') */
  expression?: string;
}

/**
 * Reusable script snippet/template
 */
export interface ScriptSnippet {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description of what it does */
  description: string;
  /** The actual Qlik script code */
  code: string;
  /** Placeholders to replace: ${tableName}, ${fieldName} */
  placeholders: string[];
  /** Category for organization */
  category: 'calendar' | 'incremental' | 'qualify' | 'store' | 'custom';
}

/**
 * Data load options for incremental loading
 */
export interface DataLoadOptions {
  /** Incremental load settings */
  incremental: {
    /** Whether incremental load is enabled */
    enabled: boolean;
    /** Strategy for incremental load */
    strategy: 'by_date' | 'by_id' | 'full_reload';
    /** Field to use for incremental detection */
    field?: string;
    /** Last loaded value */
    last_value?: string | number;
  };
  /** WHERE clause for filtering */
  where_clause?: string;
  /** Row limit */
  limit?: number;
  /** Whether to use DISTINCT */
  distinct?: boolean;
}

// ============================================================================
// Section 10: Qlik Constraints & Validation
// ============================================================================

/**
 * Qlik-specific constraints and limits
 */
export const QLIK_CONSTRAINTS = {
  /** Maximum length for field names */
  MAX_FIELD_NAME_LENGTH: 128,
  /** Maximum length for table names */
  MAX_TABLE_NAME_LENGTH: 128,
  /** Reserved words that cannot be used as identifiers */
  RESERVED_WORDS: [
    'IF', 'THEN', 'ELSE', 'AND', 'OR', 'NOT', 'LOAD', 'FROM', 'WHERE',
    'SELECT', 'DISTINCT', 'AS', 'RESIDENT', 'STORE', 'DROP', 'TABLE',
    'LEFT', 'RIGHT', 'INNER', 'OUTER', 'JOIN', 'ON', 'GROUP', 'BY',
    'ORDER', 'ASC', 'DESC', 'NULL', 'TRUE', 'FALSE',
  ],
  /** Characters not allowed in identifiers */
  INVALID_CHARS: ['/', '\\', ':', '*', '?', '"', '<', '>', '|'],
} as const;

/**
 * Result of field name validation
 */
export interface FieldValidation {
  /** Whether the name is valid */
  valid: boolean;
  /** Error messages */
  errors: string[];
  /** Warning messages */
  warnings: string[];
  /** Suggested corrected name */
  suggested_name?: string;
}

// ============================================================================
// Section 11: Versioned Payload for Stage Handoff
// ============================================================================

/**
 * Payload types for versioned handoffs
 */
export type PayloadType = 'Stage1Input' | 'Stage2Output' | 'ModelBuilderSession';

/**
 * Wrapper for versioned payloads
 */
export interface VersionedPayload<T> {
  /** Type version string */
  type_version: string;
  /** Type of payload */
  payload_type: PayloadType;
  /** The actual payload */
  data: T;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a value is a valid ModelType
 */
export function isModelType(value: unknown): value is ModelType {
  return ['star_schema', 'snowflake', 'link_table', 'concatenated'].includes(value as string);
}

/**
 * Check if a value is a valid BuildStage
 */
export function isBuildStage(value: unknown): value is BuildStage {
  return ['A', 'B', 'C', 'D', 'E', 'F'].includes(value as string);
}

/**
 * Check if a value is a valid LogLevel
 */
export function isLogLevel(value: unknown): value is LogLevel {
  return ['ERROR', 'WARN', 'INFO', 'DEBUG'].includes(value as string);
}

/**
 * Check if a value is a valid IssueSeverity
 */
export function isIssueSeverity(value: unknown): value is IssueSeverity {
  return ['critical', 'warning', 'info'].includes(value as string);
}

/**
 * Validate a field name against Qlik constraints
 */
export function validateFieldName(name: string): FieldValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  let suggested_name: string | undefined;

  // Check length
  if (name.length > QLIK_CONSTRAINTS.MAX_FIELD_NAME_LENGTH) {
    errors.push(`Field name exceeds ${QLIK_CONSTRAINTS.MAX_FIELD_NAME_LENGTH} characters`);
    suggested_name = name.substring(0, QLIK_CONSTRAINTS.MAX_FIELD_NAME_LENGTH);
  }

  // Check for invalid characters
  for (const char of QLIK_CONSTRAINTS.INVALID_CHARS) {
    if (name.includes(char)) {
      errors.push(`Field name contains invalid character: ${char}`);
      suggested_name = (suggested_name || name).replace(new RegExp(`\\${char}`, 'g'), '_');
    }
  }

  // Check for reserved words
  if ((QLIK_CONSTRAINTS.RESERVED_WORDS as readonly string[]).includes(name.toUpperCase())) {
    warnings.push(`Field name '${name}' is a reserved word`);
    suggested_name = `[${name}]`;
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggested_name: errors.length > 0 || warnings.length > 0 ? suggested_name : undefined,
  };
}

