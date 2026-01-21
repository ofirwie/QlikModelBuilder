/**
 * StateManager.ts - Persistent state management for QlikModelBuilder Wizard
 * Uses VS Code workspaceState for persistence
 */

import * as vscode from 'vscode';
import { WizardState, DEFAULT_STATE } from './WizardState';

export class StateManager {
  private static readonly STATE_KEY = 'qlikModelBuilder.wizardState';
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Load state from storage, returns default if none exists
   */
  async load(): Promise<WizardState> {
    const stored = this.context.workspaceState.get<WizardState>(
      StateManager.STATE_KEY
    );

    if (!stored) {
      return { ...DEFAULT_STATE };
    }

    // Merge with defaults to handle version migrations
    return {
      ...DEFAULT_STATE,
      ...stored,
      updatedAt: stored.updatedAt || new Date().toISOString()
    };
  }

  /**
   * Save state to storage
   */
  async save(state: WizardState): Promise<void> {
    state.updatedAt = new Date().toISOString();
    await this.context.workspaceState.update(
      StateManager.STATE_KEY,
      state
    );
  }

  /**
   * Clear state (start fresh)
   */
  async clear(): Promise<void> {
    await this.context.workspaceState.update(
      StateManager.STATE_KEY,
      undefined
    );
  }

  /**
   * Update a single field in state
   */
  async updateField<K extends keyof WizardState>(
    key: K,
    value: WizardState[K]
  ): Promise<WizardState> {
    const state = await this.load();
    state[key] = value;
    await this.save(state);
    return state;
  }

  /**
   * Update multiple fields at once
   */
  async updateFields(updates: Partial<WizardState>): Promise<WizardState> {
    const state = await this.load();
    Object.assign(state, updates);
    await this.save(state);
    return state;
  }
}
