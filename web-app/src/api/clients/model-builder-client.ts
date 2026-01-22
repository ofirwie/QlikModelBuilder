/**
 * Model Builder API Client - Stage 2 Backend
 * Handles model building operations (Steps 7-11)
 */
import { createFetch, fetchWithRetry } from './base-client'
import type {
  ModelType,
  BuildStage,
  AnalysisResult,
  EnrichedModelSpec,
  StageScript,
  DeployResult,
} from '@/types/model-builder.types'

const getBackendUrl = () => import.meta.env.VITE_MODEL_BUILDER_BACKEND_URL || 'http://localhost:3002'

export interface BuildProgress {
  status: 'pending' | 'building' | 'completed' | 'failed'
  currentStage: BuildStage
  stagesCompleted: BuildStage[]
  error?: string
}

export const modelBuilderClient = {
  /**
   * Start a new model builder session
   */
  async createSession(config: {
    projectName: string
    qvdPaths: string[]
    spaceId: string
  }): Promise<{ sessionId: string }> {
    const fetch = createFetch(getBackendUrl())

    return fetchWithRetry(() =>
      fetch<{ sessionId: string }>('/api/model-builder/session', {
        method: 'POST',
        body: JSON.stringify(config),
      })
    )
  },

  /**
   * Analyze QVD files and classify tables
   */
  async analyzeQvds(sessionId: string): Promise<AnalysisResult> {
    const fetch = createFetch(getBackendUrl())

    return fetchWithRetry(() =>
      fetch<AnalysisResult>(`/api/model-builder/${sessionId}/analyze`, {
        method: 'POST',
      })
    )
  },

  /**
   * Get model type recommendation
   */
  async getModelTypeRecommendation(
    sessionId: string,
    analysisResult: AnalysisResult
  ): Promise<{ recommendedType: ModelType; reasoning: string; confidence: number }> {
    const fetch = createFetch(getBackendUrl())

    return fetchWithRetry(() =>
      fetch<{ recommendedType: ModelType; reasoning: string; confidence: number }>(
        `/api/model-builder/${sessionId}/recommend`,
        {
          method: 'POST',
          body: JSON.stringify({ analysisResult }),
        }
      )
    )
  },

  /**
   * Set model type and get enriched spec
   */
  async setModelType(
    sessionId: string,
    modelType: ModelType
  ): Promise<EnrichedModelSpec> {
    const fetch = createFetch(getBackendUrl())

    return fetchWithRetry(() =>
      fetch<EnrichedModelSpec>(`/api/model-builder/${sessionId}/model-type`, {
        method: 'PUT',
        body: JSON.stringify({ modelType }),
      })
    )
  },

  /**
   * Build a specific stage
   */
  async buildStage(
    sessionId: string,
    stage: BuildStage,
    spec: EnrichedModelSpec
  ): Promise<StageScript> {
    const fetch = createFetch(getBackendUrl())

    return fetchWithRetry(() =>
      fetch<StageScript>(`/api/model-builder/${sessionId}/build/${stage}`, {
        method: 'POST',
        body: JSON.stringify({ spec }),
      })
    )
  },

  /**
   * Validate stage script
   */
  async validateStage(
    sessionId: string,
    stage: BuildStage,
    script: string
  ): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
    const fetch = createFetch(getBackendUrl())

    return fetchWithRetry(() =>
      fetch<{ isValid: boolean; errors: string[]; warnings: string[] }>(
        `/api/model-builder/${sessionId}/validate/${stage}`,
        {
          method: 'POST',
          body: JSON.stringify({ script }),
        }
      )
    )
  },

  /**
   * Get combined final script
   */
  async getFinalScript(sessionId: string): Promise<{ script: string }> {
    const fetch = createFetch(getBackendUrl())

    return fetchWithRetry(() =>
      fetch<{ script: string }>(`/api/model-builder/${sessionId}/final-script`)
    )
  },

  /**
   * Deploy model to Qlik Cloud
   */
  async deploy(config: {
    sessionId: string
    appName: string
    spaceId: string
    script: string
  }): Promise<DeployResult> {
    const fetch = createFetch(getBackendUrl())

    return fetchWithRetry(() =>
      fetch<DeployResult>('/api/model-builder/deploy', {
        method: 'POST',
        body: JSON.stringify(config),
      })
    )
  },

  /**
   * Get build progress
   */
  async getBuildProgress(sessionId: string): Promise<BuildProgress> {
    const fetch = createFetch(getBackendUrl())

    return fetchWithRetry(() =>
      fetch<BuildProgress>(`/api/model-builder/${sessionId}/progress`)
    )
  },
}
