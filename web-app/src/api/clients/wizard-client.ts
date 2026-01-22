/**
 * Wizard API Client - Stage 1 Backend
 * Handles data extraction operations (Steps 1-6)
 */
import { createFetch, fetchWithRetry } from './base-client'
import type { TableConfig, ConnectionConfig } from '@/types/wizard.types'

const getBackendUrl = () => import.meta.env.VITE_WIZARD_BACKEND_URL || 'http://localhost:3001'

export interface SchemaTable {
  name: string
  schema?: string
  rowCount?: number
  columns: SchemaColumn[]
}

export interface SchemaColumn {
  name: string
  dataType: string
  isNullable: boolean
  isPrimaryKey: boolean
}

export interface ExtractionProgress {
  status: 'pending' | 'running' | 'completed' | 'failed'
  currentTable?: string
  tablesCompleted: number
  totalTables: number
  rowsExtracted: number
  error?: string
}

export interface ExtractionResult {
  success: boolean
  qvdPaths: string[]
  appId: string | null
  executionTime: number
  rowsExtracted: number
  error?: string
}

export const wizardClient = {
  /**
   * Test database connection
   */
  async testConnection(connection: ConnectionConfig): Promise<{ success: boolean; error?: string }> {
    const fetch = createFetch(getBackendUrl())

    try {
      await fetchWithRetry(() =>
        fetch<{ success: boolean }>('/api/wizard/test-connection', {
          method: 'POST',
          body: JSON.stringify(connection),
        })
      )
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      }
    }
  },

  /**
   * Get database schema (tables and columns)
   */
  async getSchema(connection: ConnectionConfig): Promise<SchemaTable[]> {
    const fetch = createFetch(getBackendUrl())

    return fetchWithRetry(() =>
      fetch<SchemaTable[]>('/api/wizard/schema', {
        method: 'POST',
        body: JSON.stringify(connection),
      })
    )
  },

  /**
   * Get row count and sample data for a table
   */
  async getTablePreview(
    connection: ConnectionConfig,
    tableName: string,
    limit: number = 100
  ): Promise<{ rowCount: number; sampleData: Record<string, unknown>[] }> {
    const fetch = createFetch(getBackendUrl())

    return fetchWithRetry(() =>
      fetch<{ rowCount: number; sampleData: Record<string, unknown>[] }>(
        '/api/wizard/table-preview',
        {
          method: 'POST',
          body: JSON.stringify({ connection, tableName, limit }),
        }
      )
    )
  },

  /**
   * Generate extraction script
   */
  async generateScript(config: {
    connection: ConnectionConfig
    tables: TableConfig[]
    qvdPath: string
  }): Promise<{ script: string }> {
    const fetch = createFetch(getBackendUrl())

    return fetchWithRetry(() =>
      fetch<{ script: string }>('/api/wizard/generate-script', {
        method: 'POST',
        body: JSON.stringify(config),
      })
    )
  },

  /**
   * Start extraction process
   */
  async startExtraction(config: {
    connection: ConnectionConfig
    tables: TableConfig[]
    spaceId: string
    projectName: string
  }): Promise<{ jobId: string }> {
    const fetch = createFetch(getBackendUrl())

    return fetchWithRetry(() =>
      fetch<{ jobId: string }>('/api/wizard/extract', {
        method: 'POST',
        body: JSON.stringify(config),
      })
    )
  },

  /**
   * Get extraction progress
   */
  async getExtractionProgress(jobId: string): Promise<ExtractionProgress> {
    const fetch = createFetch(getBackendUrl())

    return fetchWithRetry(() =>
      fetch<ExtractionProgress>(`/api/wizard/extract/${jobId}/progress`)
    )
  },

  /**
   * Get extraction result
   */
  async getExtractionResult(jobId: string): Promise<ExtractionResult> {
    const fetch = createFetch(getBackendUrl())

    return fetchWithRetry(() =>
      fetch<ExtractionResult>(`/api/wizard/extract/${jobId}/result`)
    )
  },

  /**
   * Cancel extraction
   */
  async cancelExtraction(jobId: string): Promise<void> {
    const fetch = createFetch(getBackendUrl())

    await fetchWithRetry(() =>
      fetch<void>(`/api/wizard/extract/${jobId}/cancel`, {
        method: 'POST',
      })
    )
  },
}
