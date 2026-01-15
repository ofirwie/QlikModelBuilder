/**
 * QlikModelBuilder - Wizard Engine
 * Main orchestrator for the wizard flow
 */

import {
  ProjectState,
  WizardStepId,
  WizardEntryMode,
  SpaceConfig,
  ConnectionConfig,
  TableConfig,
  IncrementalConfig,
  ValidationResult,
  StepNavigationResult,
  ScriptGenerationOptions,
  DeployResult,
  Template,
  SpecExtractionResult,
} from './types.js';
import { StateStore, getStateStore } from './state-store.js';
import { StepManager, getStepManager } from './step-manager.js';
import { ScriptGenerator } from './script-generator.js';

/**
 * WizardEngine - Main orchestrator for the model building wizard
 */
export class WizardEngine {
  private stateStore: StateStore;
  private stepManager: StepManager;
  private scriptGenerator: ScriptGenerator;

  constructor() {
    this.stateStore = getStateStore();
    this.stepManager = getStepManager();
    this.scriptGenerator = new ScriptGenerator();
  }

  // ============================================================
  // Wizard Lifecycle
  // ============================================================

  /**
   * Start a new wizard session
   */
  startWizard(mode: WizardEntryMode = 'scratch', projectName?: string): ProjectState {
    this.stateStore.reset();
    this.stateStore.setEntryMode(mode);

    if (projectName) {
      this.stateStore.updateState({ name: projectName });
    }

    return this.stateStore.getState();
  }

  /**
   * Resume an existing wizard session
   */
  resumeWizard(stateJson: string): boolean {
    return this.stateStore.importState(stateJson);
  }

  /**
   * Get current wizard state
   */
  getState(): ProjectState {
    return this.stateStore.getState();
  }

  /**
   * Get wizard status summary
   */
  getStatus(): Record<string, unknown> {
    const state = this.stateStore.getState();
    const progress = this.stepManager.getProgress();
    const stepStatus = this.stepManager.getStepStatus();

    return {
      projectId: state.id,
      projectName: state.name,
      entryMode: state.entryMode,
      currentStep: state.currentStep,
      progress,
      steps: stepStatus,
      hasSpace: !!state.space,
      hasConnection: !!state.connection,
      tableCount: state.tables.length,
      isScriptGenerated: !!state.generatedScript,
      isDeployed: !!state.appId,
    };
  }

  // ============================================================
  // Navigation
  // ============================================================

  /**
   * Go to next step
   */
  next(): StepNavigationResult {
    return this.stepManager.goToNextStep();
  }

  /**
   * Go to previous step
   */
  back(): StepNavigationResult {
    return this.stepManager.goToPreviousStep();
  }

  /**
   * Go to specific step
   */
  goTo(stepId: WizardStepId): StepNavigationResult {
    return this.stepManager.goToStep(stepId);
  }

  /**
   * Get current step info
   */
  getCurrentStep() {
    return this.stepManager.getCurrentStep();
  }

  // ============================================================
  // Space Configuration
  // ============================================================

  /**
   * Set space configuration
   */
  setSpace(space: SpaceConfig): void {
    this.stateStore.updateState({ space });
  }

  /**
   * Select existing space by ID
   */
  selectSpace(spaceId: string, spaceName: string, spaceType: 'shared' | 'managed' | 'personal'): void {
    this.setSpace({
      id: spaceId,
      name: spaceName,
      type: spaceType,
      isNew: false,
    });
  }

  /**
   * Create new space configuration
   */
  createNewSpace(name: string, type: 'shared' | 'managed', description?: string): void {
    this.setSpace({
      name,
      type,
      description,
      isNew: true,
    });
  }

  // ============================================================
  // Connection Configuration
  // ============================================================

  /**
   * Set connection configuration
   */
  setConnection(connection: ConnectionConfig): void {
    this.stateStore.updateState({ connection });
  }

  /**
   * Select existing connection
   */
  selectConnection(connectionId: string, connectionName: string): void {
    const state = this.stateStore.getState();
    this.setConnection({
      ...state.connection,
      id: connectionId,
      name: connectionName,
    } as ConnectionConfig);
  }

  // ============================================================
  // Table Configuration
  // ============================================================

  /**
   * Add a table to the project
   */
  addTable(table: TableConfig): void {
    const state = this.stateStore.getState();
    const tables = [...state.tables, table];
    this.stateStore.updateState({ tables });
  }

  /**
   * Update a table configuration
   */
  updateTable(tableName: string, updates: Partial<TableConfig>): void {
    const state = this.stateStore.getState();
    const tables = state.tables.map((t) =>
      t.name === tableName ? { ...t, ...updates } : t
    );
    this.stateStore.updateState({ tables });
  }

  /**
   * Remove a table
   */
  removeTable(tableName: string): void {
    const state = this.stateStore.getState();
    const tables = state.tables.filter((t) => t.name !== tableName);
    this.stateStore.updateState({ tables });
  }

  /**
   * Set tables (replace all)
   */
  setTables(tables: TableConfig[]): void {
    this.stateStore.updateState({ tables });
  }

  /**
   * Set incremental config for a table
   */
  setTableIncremental(tableName: string, config: IncrementalConfig): void {
    this.updateTable(tableName, { incremental: config });
  }

  // ============================================================
  // Validation
  // ============================================================

  /**
   * Validate current step
   */
  validateCurrentStep(): ValidationResult {
    return this.stepManager.validateCurrentStep();
  }

  /**
   * Validate specific step
   */
  validateStep(stepId: WizardStepId): ValidationResult {
    return this.stepManager.validateStep(stepId);
  }

  /**
   * Validate entire wizard
   */
  validateAll(): ValidationResult {
    return this.stepManager.validateAllSteps();
  }

  // ============================================================
  // Script Generation
  // ============================================================

  /**
   * Generate the Qlik script
   */
  generateScript(options?: Partial<ScriptGenerationOptions>): string {
    const state = this.stateStore.getState();
    const script = this.scriptGenerator.generate(state, options);
    this.stateStore.updateState({ generatedScript: script });
    return script;
  }

  /**
   * Preview script without saving
   */
  previewScript(options?: Partial<ScriptGenerationOptions>): string {
    const state = this.stateStore.getState();
    return this.scriptGenerator.generate(state, options);
  }

  // ============================================================
  // Template Support
  // ============================================================

  /**
   * Apply a template to the current state
   */
  applyTemplate(template: Template): void {
    const state = this.stateStore.getState();

    // Apply source config if present
    if (template.sourceConfig) {
      this.setConnection({
        ...state.connection,
        ...template.sourceConfig,
      } as ConnectionConfig);
    }

    // Apply table templates if present
    if (template.tableTemplates) {
      const tables = template.tableTemplates.map((t) => ({
        name: t.name || 'NewTable',
        fields: t.fields || [],
        incremental: t.incremental || template.incrementalDefaults || { strategy: 'none' as const },
        ...t,
      })) as TableConfig[];
      this.setTables(tables);
    }
  }

  // ============================================================
  // Spec Import
  // ============================================================

  /**
   * Import from specification document
   * This is a placeholder - actual implementation will use Claude for extraction
   */
  async importFromSpec(specContent: string, format: string): Promise<SpecExtractionResult> {
    // TODO: Implement spec extraction using Claude
    // For now, return a placeholder result
    return {
      success: false,
      format: 'unknown',
      extracted: {},
      missing: ['Project name', 'Data source', 'Tables'],
      confidence: 0,
    };
  }

  // ============================================================
  // Deploy
  // ============================================================

  /**
   * Deploy the model to Qlik Cloud
   * This is a placeholder - actual implementation will use Qlik APIs
   */
  async deploy(): Promise<DeployResult> {
    const state = this.stateStore.getState();

    if (!state.generatedScript) {
      return {
        success: false,
        errors: ['Script must be generated before deploy'],
      };
    }

    // TODO: Implement actual deployment using Qlik APIs
    // For now, return a placeholder result
    return {
      success: false,
      errors: ['Deploy not yet implemented'],
    };
  }

  // ============================================================
  // State Persistence
  // ============================================================

  /**
   * Export wizard state
   */
  exportState(): string {
    return this.stateStore.exportState();
  }

  /**
   * Save snapshot
   */
  saveSnapshot(name: string): void {
    this.stateStore.saveSnapshot(name);
  }

  /**
   * Restore snapshot
   */
  restoreSnapshot(name: string): boolean {
    return this.stateStore.restoreSnapshot(name);
  }

  /**
   * Get available snapshots
   */
  getSnapshots(): string[] {
    return this.stateStore.getSnapshots();
  }
}

// Singleton instance
let wizardEngineInstance: WizardEngine | null = null;

/**
 * Get the singleton WizardEngine instance
 */
export function getWizardEngine(): WizardEngine {
  if (!wizardEngineInstance) {
    wizardEngineInstance = new WizardEngine();
  }
  return wizardEngineInstance;
}

/**
 * Reset the singleton instance
 */
export function resetWizardEngine(): void {
  wizardEngineInstance = null;
}
