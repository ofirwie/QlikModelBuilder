/**
 * App Store - Global application state with persistence
 * Manages navigation, project info, and UI state
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { AppError } from '@/types'

interface AppState {
  // State
  currentStep: number
  maxReachedStep: number
  projectName: string
  projectId: string | null

  // UI State
  isLoading: boolean
  error: AppError | null

  // Actions
  setStep: (step: number) => void
  nextStep: () => void
  prevStep: () => void
  canGoToStep: (step: number) => boolean
  setProjectName: (name: string) => void
  setProjectId: (id: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: AppError | null) => void
  reset: () => void
}

const initialState = {
  currentStep: 1,
  maxReachedStep: 1,
  projectName: '',
  projectId: null,
  isLoading: false,
  error: null,
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setStep: (step) => {
        const { maxReachedStep } = get()
        set({
          currentStep: step,
          maxReachedStep: Math.max(step, maxReachedStep)
        })
      },

      nextStep: () => {
        const { currentStep, maxReachedStep } = get()
        if (currentStep < 11) {
          set({
            currentStep: currentStep + 1,
            maxReachedStep: Math.max(currentStep + 1, maxReachedStep)
          })
        }
      },

      prevStep: () => {
        const { currentStep } = get()
        if (currentStep > 1) {
          set({ currentStep: currentStep - 1 })
        }
      },

      canGoToStep: (step) => {
        const { maxReachedStep } = get()
        return step <= maxReachedStep
      },

      setProjectName: (name) => set({ projectName: name }),
      setProjectId: (id) => set({ projectId: id }),
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      reset: () => set(initialState),
    }),
    {
      name: 'qlikfox-app-state',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        currentStep: state.currentStep,
        maxReachedStep: state.maxReachedStep,
        projectName: state.projectName,
        projectId: state.projectId,
      }),
    }
  )
)
