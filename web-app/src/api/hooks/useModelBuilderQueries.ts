/**
 * TanStack Query hooks for Model Builder API (Stage 2)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { modelBuilderClient, geminiClient } from '../clients'
import type { ModelType, BuildStage, EnrichedModelSpec, AnalysisResult } from '@/types/model-builder.types'

// Query keys
export const modelBuilderKeys = {
  all: ['modelBuilder'] as const,
  session: (sessionId: string) => [...modelBuilderKeys.all, 'session', sessionId] as const,
  analysis: (sessionId: string) => [...modelBuilderKeys.session(sessionId), 'analysis'] as const,
  recommendation: (sessionId: string) => [...modelBuilderKeys.session(sessionId), 'recommendation'] as const,
  spec: (sessionId: string) => [...modelBuilderKeys.session(sessionId), 'spec'] as const,
  stage: (sessionId: string, stage: BuildStage) =>
    [...modelBuilderKeys.session(sessionId), 'stage', stage] as const,
  finalScript: (sessionId: string) => [...modelBuilderKeys.session(sessionId), 'finalScript'] as const,
  progress: (sessionId: string) => [...modelBuilderKeys.session(sessionId), 'progress'] as const,
}

export const geminiKeys = {
  all: ['gemini'] as const,
  review: (script: string) => [...geminiKeys.all, 'review', script.substring(0, 50)] as const,
  health: () => [...geminiKeys.all, 'health'] as const,
}

/**
 * Create model builder session
 */
export function useCreateSession() {
  return useMutation({
    mutationFn: (config: { projectName: string; qvdPaths: string[]; spaceId: string }) =>
      modelBuilderClient.createSession(config),
  })
}

/**
 * Analyze QVD files
 */
export function useAnalyzeQvds(sessionId: string | null) {
  return useMutation({
    mutationFn: () => {
      if (!sessionId) throw new Error('No session ID')
      return modelBuilderClient.analyzeQvds(sessionId)
    },
  })
}

/**
 * Get analysis result (cached)
 */
export function useAnalysisResult(sessionId: string | null) {
  return useQuery({
    queryKey: modelBuilderKeys.analysis(sessionId || ''),
    queryFn: () => modelBuilderClient.analyzeQvds(sessionId!),
    enabled: false, // Only fetch on demand via mutation
    staleTime: Infinity,
  })
}

/**
 * Get model type recommendation
 */
export function useModelTypeRecommendation(sessionId: string | null, analysisResult: AnalysisResult | null) {
  return useQuery({
    queryKey: modelBuilderKeys.recommendation(sessionId || ''),
    queryFn: () => modelBuilderClient.getModelTypeRecommendation(sessionId!, analysisResult!),
    enabled: !!sessionId && !!analysisResult,
    staleTime: Infinity,
  })
}

/**
 * Set model type and get enriched spec
 */
export function useSetModelType() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ sessionId, modelType }: { sessionId: string; modelType: ModelType }) =>
      modelBuilderClient.setModelType(sessionId, modelType),
    onSuccess: (spec, { sessionId }) => {
      queryClient.setQueryData(modelBuilderKeys.spec(sessionId), spec)
    },
  })
}

/**
 * Build a stage
 */
export function useBuildStage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      sessionId,
      stage,
      spec,
    }: {
      sessionId: string
      stage: BuildStage
      spec: EnrichedModelSpec
    }) => modelBuilderClient.buildStage(sessionId, stage, spec),
    onSuccess: (stageScript, { sessionId, stage }) => {
      queryClient.setQueryData(modelBuilderKeys.stage(sessionId, stage), stageScript)
    },
  })
}

/**
 * Validate stage script
 */
export function useValidateStage() {
  return useMutation({
    mutationFn: ({
      sessionId,
      stage,
      script,
    }: {
      sessionId: string
      stage: BuildStage
      script: string
    }) => modelBuilderClient.validateStage(sessionId, stage, script),
  })
}

/**
 * Get final combined script
 */
export function useFinalScript(sessionId: string | null) {
  return useQuery({
    queryKey: modelBuilderKeys.finalScript(sessionId || ''),
    queryFn: () => modelBuilderClient.getFinalScript(sessionId!),
    enabled: !!sessionId,
    staleTime: 60 * 1000, // 1 minute
  })
}

/**
 * Deploy to Qlik Cloud
 */
export function useDeploy() {
  return useMutation({
    mutationFn: (config: {
      sessionId: string
      appName: string
      spaceId: string
      script: string
    }) => modelBuilderClient.deploy(config),
  })
}

/**
 * Get build progress (with polling)
 */
export function useBuildProgress(sessionId: string | null, enabled: boolean = true) {
  return useQuery({
    queryKey: modelBuilderKeys.progress(sessionId || ''),
    queryFn: () => modelBuilderClient.getBuildProgress(sessionId!),
    enabled: !!sessionId && enabled,
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return 2000
      if (data.status === 'completed' || data.status === 'failed') return false
      return 2000
    },
  })
}

// Gemini hooks

/**
 * Review script with Gemini
 */
export function useGeminiReview() {
  return useMutation({
    mutationFn: ({ script, spec }: { script: string; spec: EnrichedModelSpec }) =>
      geminiClient.reviewScript(script, spec),
  })
}

/**
 * Get Gemini model type recommendation
 */
export function useGeminiRecommendation() {
  return useMutation({
    mutationFn: (tables: { name: string; classification: string; metrics: { rowCount: number } }[]) =>
      geminiClient.getModelTypeRecommendation(tables),
  })
}

/**
 * Check Gemini health
 */
export function useGeminiHealth() {
  return useQuery({
    queryKey: geminiKeys.health(),
    queryFn: () => geminiClient.healthCheck(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
}
