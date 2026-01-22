/**
 * TanStack Query hooks for Wizard API (Stage 1)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { wizardClient } from '../clients'
import type { ConnectionConfig, TableConfig } from '@/types/wizard.types'

// Query keys
export const wizardKeys = {
  all: ['wizard'] as const,
  schema: (connectionId?: string) => [...wizardKeys.all, 'schema', connectionId] as const,
  tablePreview: (connectionId: string, tableName: string) =>
    [...wizardKeys.all, 'tablePreview', connectionId, tableName] as const,
  extraction: (jobId: string) => [...wizardKeys.all, 'extraction', jobId] as const,
  progress: (jobId: string) => [...wizardKeys.extraction(jobId), 'progress'] as const,
  result: (jobId: string) => [...wizardKeys.extraction(jobId), 'result'] as const,
}

/**
 * Test database connection
 */
export function useTestDbConnection() {
  return useMutation({
    mutationFn: (connection: ConnectionConfig) =>
      wizardClient.testConnection(connection),
  })
}

/**
 * Get database schema
 */
export function useSchema(connection: ConnectionConfig | null) {
  return useQuery({
    queryKey: wizardKeys.schema(connection?.id),
    queryFn: () => wizardClient.getSchema(connection!),
    enabled: !!connection?.validated,
    staleTime: 10 * 60 * 1000, // 10 minutes
  })
}

/**
 * Get table preview with sample data
 */
export function useTablePreview(
  connection: ConnectionConfig | null,
  tableName: string,
  limit: number = 100
) {
  return useQuery({
    queryKey: wizardKeys.tablePreview(connection?.id || '', tableName),
    queryFn: () => wizardClient.getTablePreview(connection!, tableName, limit),
    enabled: !!connection?.validated && !!tableName,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Generate extraction script
 */
export function useGenerateScript() {
  return useMutation({
    mutationFn: (config: {
      connection: ConnectionConfig
      tables: TableConfig[]
      qvdPath: string
    }) => wizardClient.generateScript(config),
  })
}

/**
 * Start extraction
 */
export function useStartExtraction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (config: {
      connection: ConnectionConfig
      tables: TableConfig[]
      spaceId: string
      projectName: string
    }) => wizardClient.startExtraction(config),
    onSuccess: (data) => {
      // Start polling for progress
      queryClient.invalidateQueries({ queryKey: wizardKeys.extraction(data.jobId) })
    },
  })
}

/**
 * Get extraction progress (with polling)
 */
export function useExtractionProgress(jobId: string | null, enabled: boolean = true) {
  return useQuery({
    queryKey: wizardKeys.progress(jobId || ''),
    queryFn: () => wizardClient.getExtractionProgress(jobId!),
    enabled: !!jobId && enabled,
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return 2000
      if (data.status === 'completed' || data.status === 'failed') return false
      return 2000 // Poll every 2 seconds while running
    },
  })
}

/**
 * Get extraction result
 */
export function useExtractionResult(jobId: string | null, enabled: boolean = true) {
  return useQuery({
    queryKey: wizardKeys.result(jobId || ''),
    queryFn: () => wizardClient.getExtractionResult(jobId!),
    enabled: !!jobId && enabled,
    staleTime: Infinity, // Result doesn't change
  })
}

/**
 * Cancel extraction
 */
export function useCancelExtraction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (jobId: string) => wizardClient.cancelExtraction(jobId),
    onSuccess: (_, jobId) => {
      queryClient.invalidateQueries({ queryKey: wizardKeys.extraction(jobId) })
    },
  })
}
