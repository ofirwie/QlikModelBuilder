/**
 * Wizard Store - Stage 1 state (Data Extraction)
 * Steps 1-6: Connect → Source → Tables → Fields → Incremental → Extract
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  SpaceConfig,
  ConnectionConfig,
  TableConfig,
  IncrementalConfig,
  ExtractResult
} from '@/types/wizard.types'

interface WizardState {
  // State
  space: SpaceConfig | null
  connection: ConnectionConfig | null
  tables: TableConfig[]
  generatedScript: string | null
  extractResult: ExtractResult | null

  // Actions
  setSpace: (space: SpaceConfig) => void
  setConnection: (connection: ConnectionConfig | null) => void
  addTable: (table: TableConfig) => void
  updateTable: (name: string, updates: Partial<TableConfig>) => void
  removeTable: (name: string) => void
  setTables: (tables: TableConfig[]) => void
  setTableIncremental: (name: string, config: IncrementalConfig) => void
  setGeneratedScript: (script: string) => void
  setExtractResult: (result: ExtractResult) => void
  reset: () => void
}

const initialState = {
  space: null,
  connection: null,
  tables: [],
  generatedScript: null,
  extractResult: null,
}

export const useWizardStore = create<WizardState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setSpace: (space) => set({ space }),

      setConnection: (connection) => set({ connection }),

      addTable: (table) => set((state) => ({
        tables: [...state.tables, table]
      })),

      updateTable: (name, updates) => set((state) => ({
        tables: state.tables.map((t) =>
          t.name === name ? { ...t, ...updates } : t
        )
      })),

      removeTable: (name) => set((state) => ({
        tables: state.tables.filter((t) => t.name !== name)
      })),

      setTables: (tables) => set({ tables }),

      setTableIncremental: (name, config) => {
        const { updateTable } = get()
        updateTable(name, { incremental: config })
      },

      setGeneratedScript: (script) => set({ generatedScript: script }),

      setExtractResult: (result) => set({ extractResult: result }),

      reset: () => set(initialState),
    }),
    {
      name: 'qlikfox-wizard-state',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
)
