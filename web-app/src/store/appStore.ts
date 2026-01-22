import { create } from 'zustand'

export type Phase = 'connect' | 'plan' | 'build' | 'validate' | 'deploy'
export type ChapterStatus = 'completed' | 'current' | 'pending'

export interface Chapter {
  id: string
  name: string
  status: ChapterStatus
}

export interface QlikConnection {
  tenantUrl: string
  isConnected: boolean
  spaceName?: string
  userId?: string
}

export interface ModelPlan {
  modelType: 'star_schema' | 'snowflake' | 'link_table' | 'concatenated' | null
  tables: string[]
  approved: boolean
}

export interface ValidationResult {
  id: string
  type: 'success' | 'warning' | 'error'
  message: string
  details?: string
}

interface AppState {
  // Project
  projectName: string
  setProjectName: (name: string) => void

  // Navigation
  currentPhase: Phase
  setPhase: (phase: Phase) => void
  canNavigateToPhase: (phase: Phase) => boolean

  // Connect Phase
  connection: QlikConnection
  setConnection: (connection: Partial<QlikConnection>) => void

  // Plan Phase
  plan: ModelPlan
  setPlan: (plan: Partial<ModelPlan>) => void
  approvePlan: () => void

  // Build Phase
  chapters: Chapter[]
  setChapters: (chapters: Chapter[]) => void
  updateChapterStatus: (id: string, status: ChapterStatus) => void
  currentChapterIndex: number

  // Validation
  validations: ValidationResult[]
  addValidation: (result: ValidationResult) => void
  clearValidations: () => void

  // Actions
  reset: () => void
}

const initialState = {
  projectName: '',
  currentPhase: 'connect' as Phase,
  connection: {
    tenantUrl: '',
    isConnected: false,
  },
  plan: {
    modelType: null,
    tables: [],
    approved: false,
  },
  chapters: [],
  currentChapterIndex: 0,
  validations: [],
}

export const useAppStore = create<AppState>((set, get) => ({
  ...initialState,

  setProjectName: (name) => set({ projectName: name }),

  setPhase: (phase) => {
    if (get().canNavigateToPhase(phase)) {
      set({ currentPhase: phase })
    }
  },

  canNavigateToPhase: (phase) => {
    const state = get()
    const phases: Phase[] = ['connect', 'plan', 'build', 'validate', 'deploy']
    const currentIndex = phases.indexOf(state.currentPhase)
    const targetIndex = phases.indexOf(phase)

    // Can go back freely, forward only if previous phase is complete
    if (targetIndex <= currentIndex) return true

    // Check completion for forward navigation
    switch (phase) {
      case 'plan':
        return state.connection.isConnected
      case 'build':
        return state.plan.approved
      case 'validate':
        return state.chapters.every(c => c.status === 'completed')
      case 'deploy':
        return state.validations.every(v => v.type !== 'error')
      default:
        return true
    }
  },

  setConnection: (connection) =>
    set((state) => ({
      connection: { ...state.connection, ...connection },
    })),

  setPlan: (plan) =>
    set((state) => ({
      plan: { ...state.plan, ...plan },
    })),

  approvePlan: () =>
    set((state) => ({
      plan: { ...state.plan, approved: true },
      currentPhase: 'build',
    })),

  setChapters: (chapters) => set({ chapters }),

  updateChapterStatus: (id, status) =>
    set((state) => ({
      chapters: state.chapters.map((c) =>
        c.id === id ? { ...c, status } : c
      ),
      currentChapterIndex:
        status === 'current'
          ? state.chapters.findIndex((c) => c.id === id)
          : state.currentChapterIndex,
    })),

  addValidation: (result) =>
    set((state) => ({
      validations: [...state.validations, result],
    })),

  clearValidations: () => set({ validations: [] }),

  reset: () => set(initialState),
}))
