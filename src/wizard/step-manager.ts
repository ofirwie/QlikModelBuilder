/**
 * QlikModelBuilder - Step Manager
 * Manages wizard step navigation and validation
 */

import {
  WizardStep,
  WizardStepId,
  ProjectState,
  ValidationResult,
  StepNavigationResult,
  ValidationError,
  ValidationWarning,
} from './types.js';
import { getStateStore } from './state-store.js';

/**
 * Step definitions with validation logic
 */
const WIZARD_STEPS: WizardStep[] = [
  {
    id: 'space_setup',
    name: 'Space Setup',
    nameHe: 'הגדרת Space',
    description: 'Select or create a Qlik Cloud Space',
    order: 1,
    required: true,
    canGoBack: false,
    validate: (state: ProjectState): ValidationResult => {
      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];

      if (!state.space) {
        errors.push({
          code: 'SPACE_REQUIRED',
          message: 'Space must be selected or created',
          step: 'space_setup' as WizardStepId,
        });
      } else {
        if (!state.space.name || state.space.name.trim() === '') {
          errors.push({
            code: 'SPACE_NAME_REQUIRED',
            message: 'Space name is required',
            field: 'space.name',
            step: 'space_setup' as WizardStepId,
          });
        }
        if (!state.space.type) {
          errors.push({
            code: 'SPACE_TYPE_REQUIRED',
            message: 'Space type must be selected',
            field: 'space.type',
            step: 'space_setup' as WizardStepId,
          });
        }
      }

      return { valid: errors.length === 0, errors, warnings };
    },
  },
  {
    id: 'data_source',
    name: 'Data Source',
    nameHe: 'מקור נתונים',
    description: 'Configure the data source connection',
    order: 2,
    required: true,
    canGoBack: true,
    validate: (state: ProjectState): ValidationResult => {
      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];

      if (!state.connection) {
        errors.push({
          code: 'CONNECTION_REQUIRED',
          message: 'Data connection must be configured',
          step: 'data_source' as WizardStepId,
        });
      } else {
        if (!state.connection.name) {
          errors.push({
            code: 'CONNECTION_NAME_REQUIRED',
            message: 'Connection name is required',
            field: 'connection.name',
            step: 'data_source' as WizardStepId,
          });
        }
        if (!state.connection.type) {
          errors.push({
            code: 'CONNECTION_TYPE_REQUIRED',
            message: 'Connection type must be selected',
            field: 'connection.type',
            step: 'data_source' as WizardStepId,
          });
        }
      }

      return { valid: errors.length === 0, errors, warnings };
    },
  },
  {
    id: 'table_selection',
    name: 'Table Selection',
    nameHe: 'בחירת טבלאות',
    description: 'Select tables to extract',
    order: 3,
    required: true,
    canGoBack: true,
    validate: (state: ProjectState): ValidationResult => {
      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];

      if (!state.tables || state.tables.length === 0) {
        errors.push({
          code: 'TABLES_REQUIRED',
          message: 'At least one table must be selected',
          step: 'table_selection' as WizardStepId,
        });
      }

      // Warn about too many tables
      if (state.tables.length > 50) {
        warnings.push({
          code: 'MANY_TABLES',
          message: `${state.tables.length} tables selected. Consider splitting into multiple apps.`,
        });
      }

      return { valid: errors.length === 0, errors, warnings };
    },
  },
  {
    id: 'field_mapping',
    name: 'Field Mapping',
    nameHe: 'מיפוי שדות',
    description: 'Configure fields for each table',
    order: 4,
    required: true,
    canGoBack: true,
    validate: (state: ProjectState): ValidationResult => {
      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];

      for (const table of state.tables) {
        const includedFields = table.fields.filter((f) => f.include);
        if (includedFields.length === 0) {
          errors.push({
            code: 'NO_FIELDS_SELECTED',
            message: `Table '${table.name}' has no fields selected`,
            field: `tables.${table.name}.fields`,
            step: 'field_mapping' as WizardStepId,
          });
        }
      }

      return { valid: errors.length === 0, errors, warnings };
    },
  },
  {
    id: 'incremental_config',
    name: 'Incremental Load',
    nameHe: 'טעינה אינקרמנטלית',
    description: 'Configure incremental load strategy',
    order: 5,
    required: true,
    canGoBack: true,
    validate: (state: ProjectState): ValidationResult => {
      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];

      for (const table of state.tables) {
        if (!table.incremental) {
          errors.push({
            code: 'INCREMENTAL_REQUIRED',
            message: `Table '${table.name}' needs incremental configuration`,
            field: `tables.${table.name}.incremental`,
            step: 'incremental_config' as WizardStepId,
          });
        } else if (
          table.incremental.strategy !== 'none' &&
          !table.incremental.field &&
          table.incremental.strategy !== 'time_window'
        ) {
          errors.push({
            code: 'INCREMENTAL_FIELD_REQUIRED',
            message: `Table '${table.name}' needs an incremental field`,
            field: `tables.${table.name}.incremental.field`,
            step: 'incremental_config' as WizardStepId,
          });
        }
      }

      // Warn about tables without incremental
      const fullReloadTables = state.tables.filter(
        (t) => t.incremental?.strategy === 'none'
      );
      if (fullReloadTables.length > 10) {
        warnings.push({
          code: 'MANY_FULL_RELOAD',
          message: `${fullReloadTables.length} tables set to full reload. Consider incremental for large tables.`,
        });
      }

      return { valid: errors.length === 0, errors, warnings };
    },
  },
  {
    id: 'review',
    name: 'Review & Generate',
    nameHe: 'סקירה ויצירה',
    description: 'Review configuration and generate script',
    order: 6,
    required: true,
    canGoBack: true,
    validate: (state: ProjectState): ValidationResult => {
      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];

      // All previous steps must be valid
      if (!state.name || state.name.trim() === '') {
        errors.push({
          code: 'PROJECT_NAME_REQUIRED',
          message: 'Project name is required',
          field: 'name',
          step: 'review' as WizardStepId,
        });
      }

      return { valid: errors.length === 0, errors, warnings };
    },
  },
  {
    id: 'deploy',
    name: 'Deploy',
    nameHe: 'פריסה',
    description: 'Create app in Qlik Cloud',
    order: 7,
    required: false,
    canGoBack: true,
    validate: (state: ProjectState): ValidationResult => {
      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];

      if (!state.generatedScript) {
        errors.push({
          code: 'SCRIPT_REQUIRED',
          message: 'Script must be generated before deploy',
          step: 'deploy' as WizardStepId,
        });
      }

      return { valid: errors.length === 0, errors, warnings };
    },
  },
];

/**
 * StepManager - Handles wizard step navigation
 */
export class StepManager {
  private steps: Map<WizardStepId, WizardStep>;

  constructor() {
    this.steps = new Map();
    WIZARD_STEPS.forEach((step) => {
      this.steps.set(step.id, step);
    });
  }

  /**
   * Get all steps in order
   */
  getAllSteps(): WizardStep[] {
    return WIZARD_STEPS;
  }

  /**
   * Get step by ID
   */
  getStep(id: WizardStepId): WizardStep | undefined {
    return this.steps.get(id);
  }

  /**
   * Get current step
   */
  getCurrentStep(): WizardStep {
    const state = getStateStore().getState();
    return this.steps.get(state.currentStep) || WIZARD_STEPS[0];
  }

  /**
   * Get next step
   */
  getNextStep(): WizardStep | null {
    const current = this.getCurrentStep();
    const nextOrder = current.order + 1;
    return WIZARD_STEPS.find((s) => s.order === nextOrder) || null;
  }

  /**
   * Get previous step
   */
  getPreviousStep(): WizardStep | null {
    const current = this.getCurrentStep();
    const prevOrder = current.order - 1;
    return WIZARD_STEPS.find((s) => s.order === prevOrder) || null;
  }

  /**
   * Validate current step
   */
  validateCurrentStep(): ValidationResult {
    const state = getStateStore().getState();
    const step = this.getCurrentStep();
    return step.validate(state);
  }

  /**
   * Validate specific step
   */
  validateStep(stepId: WizardStepId): ValidationResult {
    const state = getStateStore().getState();
    const step = this.steps.get(stepId);
    if (!step) {
      return {
        valid: false,
        errors: [{ code: 'STEP_NOT_FOUND', message: `Step '${stepId}' not found` }],
        warnings: [],
      };
    }
    return step.validate(state);
  }

  /**
   * Validate all steps up to current
   */
  validateAllSteps(): ValidationResult {
    const state = getStateStore().getState();
    const currentStep = this.getCurrentStep();
    const allErrors = [];
    const allWarnings = [];

    for (const step of WIZARD_STEPS) {
      if (step.order <= currentStep.order) {
        const result = step.validate(state);
        allErrors.push(...result.errors);
        allWarnings.push(...result.warnings);
      }
    }

    return {
      valid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
    };
  }

  /**
   * Navigate to next step
   */
  goToNextStep(): StepNavigationResult {
    const store = getStateStore();
    const state = store.getState();
    const currentStep = this.getCurrentStep();

    // Validate current step first
    const validation = currentStep.validate(state);
    if (!validation.valid) {
      return {
        success: false,
        currentStep: state.currentStep,
        error: validation.errors[0]?.message || 'Validation failed',
      };
    }

    // Get next step
    const nextStep = this.getNextStep();
    if (!nextStep) {
      return {
        success: false,
        currentStep: state.currentStep,
        error: 'Already at last step',
      };
    }

    // Mark current as completed and move to next
    store.markStepCompleted(currentStep.id);
    store.setCurrentStep(nextStep.id);

    return {
      success: true,
      currentStep: nextStep.id,
      previousStep: currentStep.id,
    };
  }

  /**
   * Navigate to previous step
   */
  goToPreviousStep(): StepNavigationResult {
    const store = getStateStore();
    const state = store.getState();
    const currentStep = this.getCurrentStep();

    if (!currentStep.canGoBack) {
      return {
        success: false,
        currentStep: state.currentStep,
        error: 'Cannot go back from this step',
      };
    }

    const prevStep = this.getPreviousStep();
    if (!prevStep) {
      return {
        success: false,
        currentStep: state.currentStep,
        error: 'Already at first step',
      };
    }

    store.setCurrentStep(prevStep.id);

    return {
      success: true,
      currentStep: prevStep.id,
      previousStep: currentStep.id,
    };
  }

  /**
   * Navigate to specific step
   */
  goToStep(stepId: WizardStepId): StepNavigationResult {
    const store = getStateStore();
    const state = store.getState();
    const targetStep = this.steps.get(stepId);

    if (!targetStep) {
      return {
        success: false,
        currentStep: state.currentStep,
        error: `Step '${stepId}' not found`,
      };
    }

    const currentStep = this.getCurrentStep();

    // Can always go back to completed steps
    if (store.isStepCompleted(stepId) || targetStep.order < currentStep.order) {
      store.setCurrentStep(stepId);
      return {
        success: true,
        currentStep: stepId,
        previousStep: currentStep.id,
      };
    }

    // For forward navigation, validate all steps in between
    for (const step of WIZARD_STEPS) {
      if (step.order >= currentStep.order && step.order < targetStep.order) {
        const validation = step.validate(state);
        if (!validation.valid) {
          return {
            success: false,
            currentStep: state.currentStep,
            error: `Step '${step.name}' validation failed: ${validation.errors[0]?.message}`,
          };
        }
        store.markStepCompleted(step.id);
      }
    }

    store.setCurrentStep(stepId);
    return {
      success: true,
      currentStep: stepId,
      previousStep: currentStep.id,
    };
  }

  /**
   * Get step progress
   */
  getProgress(): { current: number; total: number; percentage: number } {
    const currentStep = this.getCurrentStep();
    const total = WIZARD_STEPS.length;
    const current = currentStep.order;
    return {
      current,
      total,
      percentage: Math.round((current / total) * 100),
    };
  }

  /**
   * Get step status summary
   */
  getStepStatus(): Array<{
    id: WizardStepId;
    name: string;
    status: 'completed' | 'current' | 'pending';
  }> {
    const store = getStateStore();
    const state = store.getState();

    return WIZARD_STEPS.map((step) => ({
      id: step.id,
      name: step.name,
      status: store.isStepCompleted(step.id)
        ? 'completed'
        : step.id === state.currentStep
          ? 'current'
          : 'pending',
    }));
  }
}

// Singleton instance
let stepManagerInstance: StepManager | null = null;

/**
 * Get the singleton StepManager instance
 */
export function getStepManager(): StepManager {
  if (!stepManagerInstance) {
    stepManagerInstance = new StepManager();
  }
  return stepManagerInstance;
}
