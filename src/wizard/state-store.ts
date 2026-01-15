/**
 * QlikModelBuilder - State Store
 * Manages wizard state persistence and history
 */

import { ProjectState, WizardStepId, WizardEntryMode } from './types.js';
import { v4 as uuidv4 } from 'uuid';

// State change event
export interface StateChangeEvent {
  timestamp: Date;
  step: WizardStepId;
  field?: string;
  previousValue?: unknown;
  newValue?: unknown;
}

/**
 * StateStore - Manages wizard state with undo/redo support
 */
export class StateStore {
  private state: ProjectState;
  private history: StateChangeEvent[] = [];
  private snapshots: Map<string, ProjectState> = new Map();

  constructor() {
    this.state = this.createInitialState();
  }

  /**
   * Create initial empty state
   */
  private createInitialState(): ProjectState {
    return {
      id: uuidv4(),
      name: '',
      description: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      currentStep: 'space_setup',
      entryMode: 'scratch',
      completedSteps: [],
      space: null,
      connection: null,
      tables: [],
    };
  }

  /**
   * Get current state (immutable copy)
   */
  getState(): ProjectState {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Update state with partial changes
   */
  updateState(updates: Partial<ProjectState>): void {
    const previousState = this.getState();

    this.state = {
      ...this.state,
      ...updates,
      updatedAt: new Date(),
    };

    // Track changes in history
    Object.keys(updates).forEach((key) => {
      const typedKey = key as keyof ProjectState;
      if (previousState[typedKey] !== updates[typedKey]) {
        this.history.push({
          timestamp: new Date(),
          step: this.state.currentStep,
          field: key,
          previousValue: previousState[typedKey],
          newValue: updates[typedKey],
        });
      }
    });
  }

  /**
   * Set current step
   */
  setCurrentStep(step: WizardStepId): void {
    this.updateState({ currentStep: step });
  }

  /**
   * Mark step as completed
   */
  markStepCompleted(step: WizardStepId): void {
    if (!this.state.completedSteps.includes(step)) {
      this.updateState({
        completedSteps: [...this.state.completedSteps, step],
      });
    }
  }

  /**
   * Check if step is completed
   */
  isStepCompleted(step: WizardStepId): boolean {
    return this.state.completedSteps.includes(step);
  }

  /**
   * Set entry mode
   */
  setEntryMode(mode: WizardEntryMode): void {
    this.updateState({ entryMode: mode });
  }

  /**
   * Save a named snapshot of current state
   */
  saveSnapshot(name: string): void {
    this.snapshots.set(name, this.getState());
  }

  /**
   * Restore state from a named snapshot
   */
  restoreSnapshot(name: string): boolean {
    const snapshot = this.snapshots.get(name);
    if (snapshot) {
      this.state = JSON.parse(JSON.stringify(snapshot));
      this.state.updatedAt = new Date();
      return true;
    }
    return false;
  }

  /**
   * Get list of available snapshots
   */
  getSnapshots(): string[] {
    return Array.from(this.snapshots.keys());
  }

  /**
   * Reset state to initial
   */
  reset(): void {
    this.state = this.createInitialState();
    this.history = [];
  }

  /**
   * Get state history
   */
  getHistory(): StateChangeEvent[] {
    return [...this.history];
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Export state to JSON
   */
  exportState(): string {
    return JSON.stringify(this.state, null, 2);
  }

  /**
   * Import state from JSON
   */
  importState(json: string): boolean {
    try {
      const imported = JSON.parse(json) as ProjectState;
      // Validate required fields
      if (!imported.id || !imported.currentStep) {
        return false;
      }
      this.state = {
        ...imported,
        createdAt: new Date(imported.createdAt),
        updatedAt: new Date(),
      };
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get state summary for display
   */
  getStateSummary(): Record<string, unknown> {
    return {
      id: this.state.id,
      name: this.state.name,
      currentStep: this.state.currentStep,
      entryMode: this.state.entryMode,
      completedSteps: this.state.completedSteps.length,
      hasSpace: !!this.state.space,
      hasConnection: !!this.state.connection,
      tableCount: this.state.tables.length,
      hasGeneratedScript: !!this.state.generatedScript,
      isDeployed: !!this.state.appId,
    };
  }
}

// Singleton instance
let stateStoreInstance: StateStore | null = null;

/**
 * Get the singleton StateStore instance
 */
export function getStateStore(): StateStore {
  if (!stateStoreInstance) {
    stateStoreInstance = new StateStore();
  }
  return stateStoreInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetStateStore(): void {
  stateStoreInstance = null;
}
