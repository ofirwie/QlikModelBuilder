/**
 * Wizard Types - Stage 1 (Data Extraction)
 * Steps 1-6: Connect → Source → Tables → Fields → Incremental → Extract
 */

export interface SpaceConfig {
  id: string
  name: string
  type: 'managed' | 'shared' | 'data'
  createdAt?: string
}

export interface ConnectionConfig {
  id: string
  name: string
  type: ConnectionType
  connectionString: string
  database?: string
  schema?: string
  validated: boolean
}

export type ConnectionType =
  | 'odbc'
  | 'oledb'
  | 'rest_api'
  | 'file'
  | 'qvd'

export interface TableConfig {
  name: string
  schema?: string
  fields: FieldConfig[]
  rowCount?: number
  incremental?: IncrementalConfig
  selected: boolean
}

export interface FieldConfig {
  name: string
  dataType: FieldDataType
  isPrimaryKey: boolean
  isForeignKey: boolean
  isBusinessKey: boolean
  isNullable: boolean
  sampleValues?: string[]
  targetName?: string // Renamed field in output
}

export type FieldDataType =
  | 'string'
  | 'integer'
  | 'decimal'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'binary'
  | 'unknown'

export interface IncrementalConfig {
  enabled: boolean
  strategy: IncrementalStrategy
  keyField?: string
  timestampField?: string
  lastValue?: string | number
}

export type IncrementalStrategy =
  | 'full_reload'
  | 'insert_only'
  | 'upsert'
  | 'delete_insert'

export interface ExtractResult {
  success: boolean
  qvdPaths: string[]
  appId: string | null
  executionTime?: number
  rowsExtracted?: number
  error?: string
}
