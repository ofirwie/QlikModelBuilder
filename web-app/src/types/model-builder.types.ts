/**
 * Model Builder Types - Stage 2 (Model Building)
 * Steps 7-11: Analyze → Model Type → Build → Review → Deploy
 */

export type ModelType =
  | 'star_schema'
  | 'snowflake'
  | 'link_table'
  | 'normalized'

export type BuildStage = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'

export interface BuildStageInfo {
  id: BuildStage
  name: string
  description: string
}

export const BUILD_STAGES: BuildStageInfo[] = [
  { id: 'A', name: 'Configuration', description: 'Initialize model configuration and global variables' },
  { id: 'B', name: 'Dimensions', description: 'Generate dimension table LOAD statements' },
  { id: 'C', name: 'Facts', description: 'Generate fact table LOAD statements with FK resolution' },
  { id: 'D', name: 'Calendar', description: 'Create master calendar and date handling' },
  { id: 'E', name: 'Bridge Tables', description: 'Handle M:N relationships' },
  { id: 'F', name: 'Final Assembly', description: 'Combine all scripts and optimize' },
]

export interface EnrichedModelSpec {
  projectName: string
  qvdPath: string
  tables: EnrichedTableSpec[]
  relationships: RelationshipSpec[]
  calendarConfig?: CalendarConfig
}

export interface EnrichedTableSpec {
  name: string
  classification: TableClassification
  fields: EnrichedFieldSpec[]
  primaryKey?: string
  foreignKeys: ForeignKeySpec[]
  rowCount?: number
}

export type TableClassification =
  | 'fact'
  | 'dimension'
  | 'bridge'
  | 'lookup'
  | 'calendar'

export interface EnrichedFieldSpec {
  name: string
  dataType: string
  role: FieldRole
  targetName?: string
}

export type FieldRole =
  | 'surrogate_key'
  | 'business_key'
  | 'foreign_key'
  | 'attribute'
  | 'measure'
  | 'date'
  | 'degenerate_dimension'

export interface ForeignKeySpec {
  field: string
  referencesTable: string
  referencesField: string
}

export interface RelationshipSpec {
  fromTable: string
  fromField: string
  toTable: string
  toField: string
  cardinality: 'one-to-one' | 'one-to-many' | 'many-to-many'
}

export interface CalendarConfig {
  startDate: string
  endDate: string
  fields: string[]
  fiscalYearStart?: number
}

export interface AnalysisResult {
  sessionId: string
  timestamp: string
  tables: TableAnalysis[]
  recommendedModelType: ModelType
  confidence: number
  reasoning: string
}

export interface TableAnalysis {
  name: string
  classification: TableClassification
  classificationConfidence: number
  metrics: TableMetrics
}

export interface TableMetrics {
  rowCount: number
  columnCount: number
  nullPercentage: number
  uniqueKeyRatio: number
}

export interface GeminiReviewResponse {
  score: number
  summary: string
  issues: GeminiIssue[]
  strengths: string[]
  approved: boolean
  stage?: BuildStage
  timestamp: string
}

export interface GeminiIssue {
  severity: 'critical' | 'warning' | 'info'
  category: string
  description: string
  suggestion: string
}

export interface StageScript {
  script: string
  validation: ValidationResult
  approved: boolean
  approvedAt?: string
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface DeployResult {
  success: boolean
  appId: string | null
  appUrl?: string
  error?: string
  timestamp: string
}
