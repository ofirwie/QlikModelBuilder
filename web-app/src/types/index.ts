/**
 * Central type exports for QlikFox
 */

// Wizard types (Stage 1)
export * from './wizard.types'

// Model Builder types (Stage 2)
export * from './model-builder.types'

// Common types
export interface AppError {
  code: string
  message: string
  details?: Record<string, unknown>
  recoverable: boolean
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: AppError
}

// Step definitions
export const STEPS = [
  { id: 1, name: 'Connect', stage: 1, description: 'Connect to Qlik Cloud tenant' },
  { id: 2, name: 'Source', stage: 1, description: 'Select data source type' },
  { id: 3, name: 'Tables', stage: 1, description: 'Select tables for extraction' },
  { id: 4, name: 'Fields', stage: 1, description: 'Map fields and types' },
  { id: 5, name: 'Incremental', stage: 1, description: 'Configure incremental load' },
  { id: 6, name: 'Extract', stage: 1, description: 'Run extraction to QVD' },
  { id: 7, name: 'Analyze', stage: 2, description: 'Classify tables (Fact/Dim/Bridge)' },
  { id: 8, name: 'Model Type', stage: 2, description: 'Select data model type' },
  { id: 9, name: 'Build', stage: 2, description: 'Build model (stages A-F)' },
  { id: 10, name: 'Review', stage: 2, description: 'Gemini review and approval' },
  { id: 11, name: 'Deploy', stage: 2, description: 'Deploy to Qlik Cloud' },
] as const

export type StepId = (typeof STEPS)[number]['id']
export type StepName = (typeof STEPS)[number]['name']
