/**
 * ProjectManager.ts - Persistent project management for QlikModelBuilder
 * Handles save/load/export/import of ProjectSpec
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
  ProjectSpec,
  createEmptyProjectSpec,
  DEFAULT_PROJECT_SPEC
} from '../types/ProjectSpec';

export class ProjectManager {
  private static readonly PROJECT_KEY = 'qlikModelBuilder.currentProject';
  private static readonly RECENT_PROJECTS_KEY = 'qlikModelBuilder.recentProjects';
  private static readonly MAX_RECENT = 5;

  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Save project to VS Code globalState
   */
  async save(project: ProjectSpec): Promise<void> {
    project.updatedAt = new Date().toISOString();
    await this.context.globalState.update(ProjectManager.PROJECT_KEY, project);

    // Update recent projects list
    if (project.sourceFile) {
      await this.addToRecent(project.sourceFile);
    }
  }

  /**
   * Load project from VS Code globalState
   */
  async load(): Promise<ProjectSpec | null> {
    const stored = this.context.globalState.get<ProjectSpec>(ProjectManager.PROJECT_KEY);

    if (!stored) {
      return null;
    }

    // Merge with defaults for version compatibility
    return {
      ...DEFAULT_PROJECT_SPEC,
      ...stored,
      updatedAt: stored.updatedAt || new Date().toISOString()
    };
  }

  /**
   * Check if a project exists in storage
   */
  async hasProject(): Promise<boolean> {
    const stored = this.context.globalState.get<ProjectSpec>(ProjectManager.PROJECT_KEY);
    return stored !== undefined && stored !== null;
  }

  /**
   * Export project to JSON file
   */
  async exportToFile(filePath?: string): Promise<string> {
    const project = await this.load();
    if (!project) {
      throw new Error('No project to export');
    }

    // If no path provided, ask user
    if (!filePath) {
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(
          path.join(
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
            `${this.sanitizeFileName(project.qlikConfig.appName || 'project')}.qmb.json`
          )
        ),
        filters: {
          'QMB Project': ['qmb.json'],
          'JSON': ['json']
        },
        title: 'Export Project'
      });

      if (!uri) {
        throw new Error('Export cancelled');
      }
      filePath = uri.fsPath;
    }

    // Write to file
    const content = JSON.stringify(project, null, 2);
    fs.writeFileSync(filePath, content, 'utf-8');

    vscode.window.showInformationMessage(`Project exported to ${path.basename(filePath)}`);
    return filePath;
  }

  /**
   * Import project from JSON file
   */
  async importFromFile(filePath?: string): Promise<ProjectSpec> {
    // If no path provided, ask user
    if (!filePath) {
      const uris = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: {
          'QMB Project': ['qmb.json'],
          'JSON': ['json']
        },
        title: 'Import Project'
      });

      if (!uris || uris.length === 0) {
        throw new Error('Import cancelled');
      }
      filePath = uris[0].fsPath;
    }

    // Read and parse file
    const content = fs.readFileSync(filePath, 'utf-8');
    const imported = JSON.parse(content) as Partial<ProjectSpec>;

    // Validate and merge with defaults
    const project: ProjectSpec = {
      ...DEFAULT_PROJECT_SPEC,
      ...imported,
      sourceFile: imported.sourceFile || filePath,
      updatedAt: new Date().toISOString()
    };

    // Validate required fields
    if (!project.tables || !Array.isArray(project.tables)) {
      throw new Error('Invalid project file: missing tables array');
    }

    // Save imported project
    await this.save(project);

    vscode.window.showInformationMessage(
      `Imported project with ${project.tables.length} tables`
    );

    return project;
  }

  /**
   * Clear current project
   */
  async clear(): Promise<void> {
    await this.context.globalState.update(ProjectManager.PROJECT_KEY, undefined);
  }

  /**
   * Create a new empty project
   */
  async createNew(sourceFile: string = ''): Promise<ProjectSpec> {
    const project = createEmptyProjectSpec(sourceFile);
    await this.save(project);
    return project;
  }

  /**
   * Update specific fields in the project
   */
  async updateFields(updates: Partial<ProjectSpec>): Promise<ProjectSpec> {
    const project = await this.load();
    if (!project) {
      throw new Error('No project loaded');
    }

    Object.assign(project, updates);
    await this.save(project);
    return project;
  }

  /**
   * Update Qlik configuration
   */
  async updateQlikConfig(
    config: Partial<ProjectSpec['qlikConfig']>
  ): Promise<ProjectSpec> {
    const project = await this.load();
    if (!project) {
      throw new Error('No project loaded');
    }

    project.qlikConfig = {
      ...project.qlikConfig,
      ...config
    };
    await this.save(project);
    return project;
  }

  /**
   * Update user selections
   */
  async updateUserSelections(
    selections: Partial<ProjectSpec['userSelections']>
  ): Promise<ProjectSpec> {
    const project = await this.load();
    if (!project) {
      throw new Error('No project loaded');
    }

    project.userSelections = {
      ...project.userSelections,
      ...selections
    };
    await this.save(project);
    return project;
  }

  /**
   * Get list of recently opened projects
   */
  async getRecentProjects(): Promise<string[]> {
    return this.context.globalState.get<string[]>(
      ProjectManager.RECENT_PROJECTS_KEY,
      []
    );
  }

  /**
   * Add a file to recent projects
   */
  private async addToRecent(filePath: string): Promise<void> {
    const recent = await this.getRecentProjects();

    // Remove if already exists
    const filtered = recent.filter(p => p !== filePath);

    // Add to front
    filtered.unshift(filePath);

    // Keep only MAX_RECENT
    const trimmed = filtered.slice(0, ProjectManager.MAX_RECENT);

    await this.context.globalState.update(
      ProjectManager.RECENT_PROJECTS_KEY,
      trimmed
    );
  }

  /**
   * Sanitize filename for export
   */
  private sanitizeFileName(name: string): string {
    return name
      .replace(/[/\\?%*:|"<>]/g, '-')
      .replace(/\s+/g, '_')
      .toLowerCase();
  }
}
