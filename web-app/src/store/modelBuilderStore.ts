/**
 * Model Builder Store - Stage 2 state (Model Building)
 * Steps 7-11: Analyze → Model Type → Build → Review → Deploy
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  ModelType,
  BuildStage,
  EnrichedModelSpec,
  AnalysisResult,
  GeminiReviewResponse,
  StageScript,
  DeployResult
} from '@/types/model-builder.types'

interface ModelBuilderState {
  // State
  sessionId: string | null
  enrichedSpec: EnrichedModelSpec | null
  analysisResult: AnalysisResult | null
  modelType: ModelType | null
  currentBuildStage: BuildStage
  stageScripts: Partial<Record<BuildStage, StageScript>>
  geminiReviews: GeminiReviewResponse[]
  finalScript: string | null
  deployResult: DeployResult | null

  // Settings
  enableGeminiValidation: boolean
  skipSimpleOperations: boolean
  simpleThreshold: number

  // Actions
  setSessionId: (id: string) => void
  setEnrichedSpec: (spec: EnrichedModelSpec) => void
  setAnalysisResult: (result: AnalysisResult) => void
  setModelType: (type: ModelType) => void
  setBuildStage: (stage: BuildStage) => void
  setStageScript: (stage: BuildStage, script: StageScript) => void
  approveStage: (stage: BuildStage) => void
  addGeminiReview: (review: GeminiReviewResponse) => void
  setFinalScript: (script: string) => void
  setDeployResult: (result: DeployResult) => void
  setGeminiValidation: (enabled: boolean) => void
  setSkipSimpleOperations: (skip: boolean) => void
  setSimpleThreshold: (threshold: number) => void
  shouldValidateWithGemini: (script: string) => boolean
  reset: () => void
}

const initialState = {
  sessionId: null,
  enrichedSpec: null,
  analysisResult: null,
  modelType: null,
  currentBuildStage: 'A' as BuildStage,
  stageScripts: {},
  geminiReviews: [],
  finalScript: null,
  deployResult: null,
  enableGeminiValidation: true,
  skipSimpleOperations: true,
  simpleThreshold: 50,
}

export const useModelBuilderStore = create<ModelBuilderState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setSessionId: (id) => set({ sessionId: id }),

      setEnrichedSpec: (spec) => set({ enrichedSpec: spec }),

      setAnalysisResult: (result) => set({ analysisResult: result }),

      setModelType: (type) => set({ modelType: type }),

      setBuildStage: (stage) => set({ currentBuildStage: stage }),

      setStageScript: (stage, script) => set((state) => ({
        stageScripts: { ...state.stageScripts, [stage]: script }
      })),

      approveStage: (stage) => {
        const { stageScripts, setBuildStage } = get()
        const currentScript = stageScripts[stage]
        if (currentScript) {
          set((state) => ({
            stageScripts: {
              ...state.stageScripts,
              [stage]: { ...currentScript, approved: true, approvedAt: new Date().toISOString() }
            }
          }))
          // Auto-advance to next stage
          const stages: BuildStage[] = ['A', 'B', 'C', 'D', 'E', 'F']
          const currentIndex = stages.indexOf(stage)
          if (currentIndex < stages.length - 1) {
            setBuildStage(stages[currentIndex + 1])
          }
        }
      },

      addGeminiReview: (review) => set((state) => ({
        geminiReviews: [...state.geminiReviews, review]
      })),

      setFinalScript: (script) => set({ finalScript: script }),

      setDeployResult: (result) => set({ deployResult: result }),

      setGeminiValidation: (enabled) => set({ enableGeminiValidation: enabled }),

      setSkipSimpleOperations: (skip) => set({ skipSimpleOperations: skip }),

      setSimpleThreshold: (threshold) => set({ simpleThreshold: threshold }),

      shouldValidateWithGemini: (script: string) => {
        const { enableGeminiValidation, skipSimpleOperations, simpleThreshold } = get()
        if (!enableGeminiValidation) return false
        if (skipSimpleOperations && script.split('\n').length < simpleThreshold) {
          return false
        }
        return true
      },

      reset: () => set(initialState),
    }),
    {
      name: 'qlikfox-model-builder-state',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
)
