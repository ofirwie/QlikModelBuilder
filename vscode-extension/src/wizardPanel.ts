import * as vscode from 'vscode';
import * as XLSX from 'xlsx';
import * as mammoth from 'mammoth';
import * as fs from 'fs';
import * as path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import { QlikApiService } from './qlikApi';
import {
  ProjectSpec,
  TableSpec,
  FieldSpec,
  RelationshipSpec,
  BusinessRule,
  FormulaSpec,
  createEmptyProjectSpec
} from './types/ProjectSpec';
import { getDashboardStyles, getDashboardScript } from './ui/dashboardUI';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '..', '.env') });

/** Field definition with optional metadata from AI parsing */
interface FieldDef {
  name: string;
  include: boolean;
  rename?: string;
  description?: string;
  keyType?: string;  // PK, FK, BK, null
}

/** Relationship between tables */
interface TableRelationship {
  targetTable: string;
  sourceField: string;
  targetField: string;
  type?: string;  // many-to-one, one-to-many, one-to-one
}

/** Table definition extracted from spec file - Raw Extract (no type) */
interface TableDef {
  name: string;
  fields: FieldDef[];
  incremental: { enabled: boolean; field: string; strategy: string };
  // Extended fields from AI parsing
  tableType?: string;      // fact, dimension, staging, reference
  description?: string;
  relationships?: TableRelationship[];
}

/** Full ETL specification from AI parsing */
interface FullETLSpec {
  projectMetadata?: {
    name: string;
    version?: string;
    sourceDocument?: string;
    extractedDate?: string;
    description?: string;
  };
  businessContext?: {
    domain: string;
    description?: string;
    dataOwner?: string;
  };
  dataArchitecture?: {
    tables: Array<{
      name: string;
      type?: string;
      description?: string;
      fields: Array<{
        name: string;
        description?: string;
        keyType?: string;
        nullable?: boolean;
        incrementalCandidate?: boolean;
      }>;
      relationships?: TableRelationship[];
      incrementalField?: string | null;
      loadStrategy?: string;
    }>;
  };
  semanticLayer?: {
    calculations?: string[];
    dimensions?: string[];
    measures?: string[];
    hierarchies?: Array<{ name: string; levels: string[] }>;
  };
  etlConfig?: {
    loadOrder?: string[];
    parallelizable?: string[];
    dependencies?: Array<{ table: string; dependsOn: string[] }>;
  };
  dataQuality?: {
    globalRules?: string[];
    tableRules?: Record<string, string[]>;
  };
}

/** Result from spec parsing */
interface SpecParseResult {
  tables: TableDef[];
  source?: string;
  warnings?: string[];
  fullSpec?: FullETLSpec;  // Complete ETL specification for later use
}

/**
 * Convert SpecParseResult to ProjectSpec format
 * This bridges the old parsing format to the new comprehensive ProjectSpec
 */
function convertToProjectSpec(result: SpecParseResult, sourceFile: string): ProjectSpec {
  const project = createEmptyProjectSpec(sourceFile);

  // Convert tables
  project.tables = result.tables.map((tableDef): TableSpec => {
    // Determine table type
    let tableType: 'Fact' | 'Dimension' | 'Bridge' | 'Unknown' = 'Unknown';
    if (tableDef.tableType) {
      const type = tableDef.tableType.toLowerCase();
      if (type === 'fact') tableType = 'Fact';
      else if (type === 'dimension' || type === 'dim') tableType = 'Dimension';
      else if (type === 'bridge') tableType = 'Bridge';
    }

    // Convert fields
    const fields: FieldSpec[] = tableDef.fields.map((field): FieldSpec => ({
      name: field.name,
      dataType: undefined, // Raw Extract - no type detection
      keyType: (field.keyType as 'PK' | 'BK' | 'FK' | null) || null,
      description: field.description,
      include: field.include,
      rename: field.rename
    }));

    return {
      name: tableDef.name,
      type: tableType,
      description: tableDef.description || '',
      keyField: fields.find(f => f.keyType === 'PK')?.name,
      incrementalField: tableDef.incremental.field || undefined,
      fields
    };
  });

  // Convert relationships from tables
  const relationshipsMap = new Map<string, RelationshipSpec>();
  result.tables.forEach((tableDef, index) => {
    if (tableDef.relationships) {
      tableDef.relationships.forEach((rel, relIndex) => {
        const id = `rel_${index}_${relIndex}`;
        if (!relationshipsMap.has(id)) {
          // Determine cardinality from type
          let cardinality: '1:1' | '1:M' | 'M:1' | 'M:M' = '1:M';
          if (rel.type) {
            const type = rel.type.toLowerCase();
            if (type.includes('one-to-one') || type === '1:1') cardinality = '1:1';
            else if (type.includes('many-to-one') || type === 'm:1') cardinality = 'M:1';
            else if (type.includes('many-to-many') || type === 'm:m') cardinality = 'M:M';
          }

          relationshipsMap.set(id, {
            id,
            sourceTable: tableDef.name,
            sourceField: rel.sourceField,
            targetTable: rel.targetTable,
            targetField: rel.targetField,
            cardinality,
            isRequired: true
          });
        }
      });
    }
  });
  project.relationships = Array.from(relationshipsMap.values());

  // Extract from fullSpec if available
  if (result.fullSpec) {
    // Business rules from semantic layer
    if (result.fullSpec.semanticLayer?.calculations) {
      project.formulas = result.fullSpec.semanticLayer.calculations.map((calc, i): FormulaSpec => ({
        name: `calc_${i}`,
        expression: calc,
        type: 'calculated_field'
      }));
    }

    // Add measures
    if (result.fullSpec.semanticLayer?.measures) {
      project.formulas.push(...result.fullSpec.semanticLayer.measures.map((m, i): FormulaSpec => ({
        name: `measure_${i}`,
        expression: m,
        type: 'measure'
      })));
    }

    // Data quality rules as business rules
    if (result.fullSpec.dataQuality?.globalRules) {
      project.businessRules = result.fullSpec.dataQuality.globalRules.map((rule, i): BusinessRule => ({
        id: `rule_${i}`,
        name: `Data Quality Rule ${i + 1}`,
        description: rule,
        affectedTables: []
      }));
    }
  }

  // Set user selections based on parsed tables
  project.userSelections = {
    mode: 'spec',
    selectedTables: project.tables.map(t => t.name),
    incrementalConfig: {}
  };

  // Set incremental config from parsed data
  result.tables.forEach(tableDef => {
    if (tableDef.incremental.enabled) {
      project.userSelections.incrementalConfig[tableDef.name] = {
        enabled: true,
        strategy: tableDef.incremental.strategy as 'full' | 'insert_only' | 'insert_update' | 'time_window',
        field: tableDef.incremental.field,
        keepHistory: false
      };
    }
  });

  return project;
}

/**
 * Dashboard-style panel for Qlik Model Builder
 */
export class WizardPanel {
  public static currentPanel: WizardPanel | undefined;
  private static readonly viewType = 'qmbWizard';
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _qlikApi: QlikApiService;
  private _disposables: vscode.Disposable[] = [];
  private _currentProject: ProjectSpec | undefined;

  public static createOrShow(extensionUri: vscode.Uri, qlikApi: QlikApiService) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (WizardPanel.currentPanel) {
      WizardPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      WizardPanel.viewType,
      'Qlik Model Builder',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [extensionUri],
        retainContextWhenHidden: true,
      }
    );

    WizardPanel.currentPanel = new WizardPanel(panel, extensionUri, qlikApi);
  }

  /**
   * Get the current ProjectSpec (parsed from spec file)
   */
  public getCurrentProject(): ProjectSpec | undefined {
    return this._currentProject;
  }

  /**
   * Set/update the current ProjectSpec
   */
  public setCurrentProject(project: ProjectSpec): void {
    this._currentProject = project;
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, qlikApi: QlikApiService) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._qlikApi = qlikApi;

    this._update();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        console.log('Extension received message:', message.type);
        try {
          switch (message.type) {
            case 'getInitialData':
              await this.sendInitialData();
              break;

            case 'saveConfig':
              console.log('Processing saveConfig...');
              await this.handleSaveConfig(message.tenantUrl, message.apiKey);
              console.log('saveConfig completed');
              break;

          case 'getSpaces':
            await this.sendSpaces();
            break;

          case 'createSpace':
            try {
              const space = await this._qlikApi.createSpace(message.name);
              this._panel.webview.postMessage({ type: 'spaceCreated', space });
            } catch (error) {
              this._panel.webview.postMessage({
                type: 'createSpaceError',
                message: error instanceof Error ? error.message : 'Failed to create space'
              });
            }
            break;

          case 'getConnections':
            await this.sendConnections();
            break;

          case 'createConnection':
            try {
              const connection = await this._qlikApi.createConnection({
                name: message.name,
                type: message.connectionType,
                spaceId: message.spaceId,
                connectionString: message.connectionString
              });
              this._panel.webview.postMessage({ type: 'connectionCreated', connection });
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Failed to create connection';
              const correlationId = `create-conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

              // Determine error type
              let errorType: 'auth' | 'network' | 'server' | 'validation' | 'unknown' = 'unknown';
              if (errorMessage.includes('400') || errorMessage.includes('already exists') || errorMessage.includes('invalid')) {
                errorType = 'validation';
              } else if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
                errorType = 'auth';
              }

              console.error(`[${correlationId}] Create connection error (${errorType}): ${errorMessage}`);

              this._panel.webview.postMessage({
                type: 'createConnectionError',
                message: errorMessage,
                errorType: errorType,
                correlationId: correlationId
              });
            }
            break;

          case 'openSettings':
            vscode.commands.executeCommand('workbench.action.openSettings', 'qlik');
            break;

          case 'getTables':
            await this.sendTables(message.connectionId);
            break;

          case 'getFields':
            await this.sendFields(message.tables);
            break;

          case 'deploy':
            await this.deployApp(message.appName, message.spaceId, message.script);
            break;

          case 'openApp':
            await this.openAppInBrowser(message.appId);
            break;

          case 'showInfo':
            vscode.window.showInformationMessage(message.text);
            break;

          case 'showError':
            vscode.window.showErrorMessage(message.text);
            break;

          case 'generateScript':
            console.log('=== generateScript called ===');
            console.log('Tables received:', message.tables);
            console.log('_lastParsedSpec:', this._lastParsedSpec ? 'exists' : 'undefined');
            await this.generateScript(message.tables);
            console.log('=== generateScript completed ===');
            break;

          case 'uploadSpec':
            await this.handleUploadSpec();
            break;

          case 'parseSpecFile':
            await this.parseSpecFile(message.filePath);
            break;
        }
        } catch (err) {
          console.error('Message handler error:', err);
          vscode.window.showErrorMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      },
      null,
      this._disposables
    );
  }

  private async sendInitialData(): Promise<void> {
    const isConfigured = this._qlikApi.isConfigured();
    const credentials = isConfigured ? this._qlikApi.getCredentials() : null;

    this._panel.webview.postMessage({
      type: 'initialData',
      configured: isConfigured,
      tenantUrl: credentials?.tenantUrl || ''
    });

    if (isConfigured) {
      await this.sendSpaces();
      await this.sendConnections();
    }
  }

  private async sendSpaces(): Promise<void> {
    try {
      const spaces = await this._qlikApi.getSpaces();
      this._panel.webview.postMessage({ type: 'spaces', data: spaces });
    } catch (err) {
      this._panel.webview.postMessage({
        type: 'spacesError',
        message: err instanceof Error ? err.message : 'Failed to load spaces'
      });
    }
  }

  private async sendConnections(): Promise<void> {
    try {
      const connections = await this._qlikApi.getConnections();
      this._panel.webview.postMessage({ type: 'connections', data: connections });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load connections';
      const correlationId = `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Determine error type based on error message/status
      let errorType: 'auth' | 'network' | 'server' | 'validation' | 'unknown' = 'unknown';
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized') || errorMessage.includes('authentication')) {
        errorType = 'auth';
      } else if (errorMessage.includes('network') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('timeout')) {
        errorType = 'network';
      } else if (errorMessage.includes('500') || errorMessage.includes('502') || errorMessage.includes('503')) {
        errorType = 'server';
      } else if (errorMessage.includes('400') || errorMessage.includes('validation')) {
        errorType = 'validation';
      }

      // Log to VS Code Output channel
      console.error(`[${correlationId}] Connections error (${errorType}): ${errorMessage}`);

      this._panel.webview.postMessage({
        type: 'connectionsError',
        message: errorMessage,
        errorType: errorType,
        correlationId: correlationId
      });
    }
  }

  private async sendTables(connectionId: string): Promise<void> {
    try {
      const tables = await this._qlikApi.getTables(connectionId);
      this._panel.webview.postMessage({ type: 'tables', data: tables });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load tables';
      const correlationId = `tables-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Determine error type based on error message/status
      let errorType: 'auth' | 'network' | 'server' | 'validation' | 'unknown' = 'unknown';
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized') || errorMessage.includes('authentication')) {
        errorType = 'auth';
      } else if (errorMessage.includes('network') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('timeout')) {
        errorType = 'network';
      } else if (errorMessage.includes('500') || errorMessage.includes('502') || errorMessage.includes('503')) {
        errorType = 'server';
      } else if (errorMessage.includes('400') || errorMessage.includes('validation')) {
        errorType = 'validation';
      }

      // Log to VS Code Output channel
      console.error(`[${correlationId}] Tables error (${errorType}): ${errorMessage}`);

      this._panel.webview.postMessage({
        type: 'tablesError',
        message: errorMessage,
        errorType: errorType,
        correlationId: correlationId
      });
    }
  }

  private async sendFields(tables: string[]): Promise<void> {
    try {
      const fieldsByTable = await this._qlikApi.getFields(tables);
      this._panel.webview.postMessage({ type: 'fields', data: fieldsByTable });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load fields';
      const correlationId = `fields-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Determine error type based on error message/status
      let errorType: 'auth' | 'network' | 'server' | 'validation' | 'unknown' = 'unknown';
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized') || errorMessage.includes('authentication')) {
        errorType = 'auth';
      } else if (errorMessage.includes('network') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('timeout')) {
        errorType = 'network';
      } else if (errorMessage.includes('500') || errorMessage.includes('502') || errorMessage.includes('503')) {
        errorType = 'server';
      } else if (errorMessage.includes('400') || errorMessage.includes('validation')) {
        errorType = 'validation';
      }

      // Log to VS Code Output channel
      console.error(`[${correlationId}] Fields error (${errorType}): ${errorMessage}`);

      this._panel.webview.postMessage({
        type: 'fieldsError',
        message: errorMessage,
        errorType: errorType,
        correlationId: correlationId
      });
    }
  }

  /**
   * Deploy app to Qlik Cloud
   */
  private async deployApp(appName: string, spaceId: string, script: string): Promise<void> {
    try {
      // Create the app
      const app = await this._qlikApi.createApp(appName, spaceId);

      // Update the app script
      await this._qlikApi.updateAppScript(app.id, script);

      // Trigger initial reload
      const reloadResult = await this._qlikApi.reloadApp(app.id);

      // Wait for reload to complete (with timeout)
      await this._qlikApi.waitForReload(reloadResult.id, 120000);

      this._panel.webview.postMessage({
        type: 'deploySuccess',
        appId: app.id
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Deploy failed';
      console.error('[Deploy] Error:', errorMessage);

      this._panel.webview.postMessage({
        type: 'deployError',
        message: errorMessage
      });
    }
  }

  /**
   * Open app in browser
   */
  private async openAppInBrowser(appId: string): Promise<void> {
    const credentials = this._qlikApi.getCredentials();
    const url = `${credentials.tenantUrl}/sense/app/${appId}`;
    vscode.env.openExternal(vscode.Uri.parse(url));
  }

  private async handleSaveConfig(tenantUrl: string, apiKey: string): Promise<void> {
    console.log('handleSaveConfig called with:', tenantUrl);
    try {
      await this._qlikApi.saveCredentials(tenantUrl, apiKey);
      console.log('Credentials saved, testing connection...');
      const testResult = await this._qlikApi.testConnection();
      console.log('Test result:', testResult);

      this._panel.webview.postMessage({
        type: 'configResult',
        success: testResult.success,
        message: testResult.message
      });

      if (testResult.success) {
        await this.sendSpaces();
        await this.sendConnections();
      }
    } catch (err) {
      console.error('handleSaveConfig error:', err);
      this._panel.webview.postMessage({
        type: 'configResult',
        success: false,
        message: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  }

  // Store the last parsed spec for script generation
  private _lastParsedSpec?: FullETLSpec;

  private async generateScript(tables: string[]): Promise<void> {
    console.log('generateScript() - tables:', tables);

    // Generate intelligent Qlik script using fullSpec data
    const spec = this._lastParsedSpec;
    const scriptParts: string[] = [];

    console.log('generateScript() - spec exists:', !!spec);
    console.log('generateScript() - tables count:', tables.length);

    // Header comment with project info
    if (spec?.projectMetadata) {
      scriptParts.push(`//==================================================`);
      scriptParts.push(`// Project: ${spec.projectMetadata.name || 'Data Model'}`);
      scriptParts.push(`// Domain: ${spec.businessContext?.domain || 'Unknown'}`);
      scriptParts.push(`// Source: ${spec.projectMetadata.sourceDocument || 'Specification'}`);
      scriptParts.push(`// Generated: ${new Date().toISOString().split('T')[0]}`);
      scriptParts.push(`//==================================================\n`);
    }

    // Get load order from etlConfig or use tables as-is
    const loadOrder = spec?.etlConfig?.loadOrder?.filter(t => tables.includes(t)) || tables;
    // Add any tables not in loadOrder
    const remainingTables = tables.filter(t => !loadOrder.includes(t));
    const orderedTables = [...loadOrder, ...remainingTables];

    // Generate script for each table
    for (const tableName of orderedTables) {
      const tableSpec = spec?.dataArchitecture?.tables.find(t => t.name === tableName);

      scriptParts.push(`//--------------------------------------------------`);
      if (tableSpec?.description) {
        scriptParts.push(`// ${tableSpec.description}`);
      }
      if (tableSpec?.type) {
        scriptParts.push(`// Type: ${tableSpec.type}`);
      }
      scriptParts.push(`//--------------------------------------------------`);

      // Check for incremental loading
      if (tableSpec?.loadStrategy === 'incremental' && tableSpec.incrementalField) {
        // Incremental load script
        scriptParts.push(`LET vQVDPath = 'lib://QVD/${tableName}.qvd';`);
        scriptParts.push(`LET vLastLoad = IF(FileSize('\$(vQVDPath)') > 0, Peek('${tableSpec.incrementalField}', 0, '${tableName}'), 0);`);
        scriptParts.push(``);
        scriptParts.push(`[${tableName}]:`);
        scriptParts.push(`IF FileSize('\$(vQVDPath)') > 0 THEN`);
        scriptParts.push(`  // Incremental Load - new/updated records only`);
        scriptParts.push(`  LOAD *`);
        scriptParts.push(`  FROM [lib://DataFiles/${tableName}.*]`);
        scriptParts.push(`  WHERE ${tableSpec.incrementalField} > \$(vLastLoad);`);
        scriptParts.push(`  `);
        scriptParts.push(`  // Concatenate with existing data`);
        scriptParts.push(`  CONCATENATE`);
        scriptParts.push(`  LOAD * FROM [\$(vQVDPath)] (qvd);`);
        scriptParts.push(`ELSE`);
        scriptParts.push(`  // Full initial load`);
        scriptParts.push(`  LOAD *`);
        scriptParts.push(`  FROM [lib://DataFiles/${tableName}.*];`);
        scriptParts.push(`END IF`);
        scriptParts.push(``);
        scriptParts.push(`STORE [${tableName}] INTO [\$(vQVDPath)] (qvd);`);
        scriptParts.push(`DROP TABLE [${tableName}];`);
      } else {
        // Full load script
        scriptParts.push(`[${tableName}]:`);
        scriptParts.push(`LOAD *`);
        scriptParts.push(`FROM [lib://DataFiles/${tableName}.*];`);
      }

      // Add relationship comments
      if (tableSpec?.relationships && tableSpec.relationships.length > 0) {
        scriptParts.push(``);
        scriptParts.push(`// Relationships:`);
        for (const rel of tableSpec.relationships) {
          scriptParts.push(`//   ${tableName}.${rel.sourceField} -> ${rel.targetTable}.${rel.targetField} (${rel.type || 'FK'})`);
        }
      }

      scriptParts.push(``);
    }

    // Add data quality comments if available
    if (spec?.dataQuality?.globalRules && spec.dataQuality.globalRules.length > 0) {
      scriptParts.push(`//==================================================`);
      scriptParts.push(`// Data Quality Rules (for reference):`);
      for (const rule of spec.dataQuality.globalRules) {
        scriptParts.push(`//   - ${rule}`);
      }
      scriptParts.push(`//==================================================`);
    }

    const script = scriptParts.join('\n');

    console.log('generateScript() - script length:', script.length);
    console.log('generateScript() - sending to webview...');

    this._panel.webview.postMessage({
      type: 'scriptGenerated',
      script
    });

    console.log('generateScript() - sent to webview');
  }

  private async handleUploadSpec(): Promise<void> {
    const options: vscode.OpenDialogOptions = {
      canSelectMany: false,
      openLabel: 'בחר קובץ איפיון',
      filters: {
        'Spec Files': ['xlsx', 'xls', 'csv', 'docx', 'doc', 'pdf', 'json', 'yaml', 'yml'],
        'Excel': ['xlsx', 'xls'],
        'CSV': ['csv'],
        'Word': ['docx', 'doc'],
        'PDF': ['pdf'],
        'JSON/YAML': ['json', 'yaml', 'yml'],
        'All Files': ['*']
      }
    };

    const fileUri = await vscode.window.showOpenDialog(options);
    if (!fileUri || fileUri.length === 0) {
      return;
    }

    const filePath = fileUri[0].fsPath;
    await this.parseSpecFile(filePath);
  }

  private async parseSpecFile(filePath: string): Promise<void> {
    const ext = path.extname(filePath).toLowerCase();
    let result: SpecParseResult;

    try {
      this._panel.webview.postMessage({ type: 'specParseStart', fileName: path.basename(filePath) });

      switch (ext) {
        case '.xlsx':
        case '.xls':
          result = this.parseExcelSpec(filePath);
          break;
        case '.csv':
          result = this.parseCSVSpec(filePath);
          break;
        case '.json':
          result = this.parseJsonSpec(filePath);
          break;
        case '.yaml':
        case '.yml':
          result = this.parseYamlSpec(filePath);
          break;
        case '.docx':
        case '.doc':
        case '.pdf':
          // For Word/PDF - show message that AI extraction will be used
          vscode.window.showInformationMessage('קבצי Word/PDF ייפורשו באמצעות AI. נא להמתין...');
          result = await this.parseDocumentSpec(filePath);
          break;
        default:
          throw new Error(`פורמט לא נתמך: ${ext}`);
      }

      // Convert to ProjectSpec and store
      this._currentProject = convertToProjectSpec(result, filePath);

      // Send parsed data to webview (keep backward compatibility)
      this._panel.webview.postMessage({
        type: 'specParsed',
        tables: result.tables,
        source: result.source || filePath,
        warnings: result.warnings,
        // Also send ProjectSpec for new UI features
        projectSpec: this._currentProject
      });

      const factCount = this._currentProject.tables.filter(t => t.type === 'Fact').length;
      const dimCount = this._currentProject.tables.filter(t => t.type === 'Dimension').length;
      const relCount = this._currentProject.relationships.length;

      vscode.window.showInformationMessage(
        `נמצאו ${result.tables.length} טבלאות (${factCount} Fact, ${dimCount} Dim), ${relCount} קשרים`
      );

    } catch (err) {
      const message = err instanceof Error ? err.message : 'שגיאה בפענוח הקובץ';
      this._panel.webview.postMessage({ type: 'specParseError', message });
      vscode.window.showErrorMessage(message);
    }
  }

  private parseExcelSpec(filePath: string): SpecParseResult {
    const workbook = XLSX.readFile(filePath);
    const tables: TableDef[] = [];
    const warnings: string[] = [];

    // Strategy 1: Each sheet is a table, first row is headers
    for (const sheetName of workbook.SheetNames) {
      // Skip sheets that look like metadata
      if (sheetName.toLowerCase().includes('readme') ||
          sheetName.toLowerCase().includes('info') ||
          sheetName.startsWith('_')) {
        continue;
      }

      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      if (data.length === 0) {
        warnings.push(`גיליון "${sheetName}" ריק`);
        continue;
      }

      // First row = field names
      const headerRow = data[0] as string[];
      if (!headerRow || headerRow.length === 0) {
        warnings.push(`גיליון "${sheetName}" ללא כותרות`);
        continue;
      }

      // Raw Extract - just field names, no type detection
      const fields = headerRow
        .filter(h => h && String(h).trim())
        .map((fieldName) => ({
          name: String(fieldName).trim(),
          include: true
          // No type field - Raw Extract Philosophy
        }));

      if (fields.length === 0) {
        warnings.push(`גיליון "${sheetName}" ללא שדות תקינים`);
        continue;
      }

      // Detect incremental field
      const incrementalField = this.detectIncrementalField(fields);

      tables.push({
        name: sheetName,
        fields,
        incremental: {
          enabled: !!incrementalField,
          field: incrementalField || '',
          strategy: incrementalField ? 'insert_only' : 'full'
        }
      });
    }

    // Strategy 2: Look for "Tables" sheet with table definitions
    const tablesSheet = workbook.SheetNames.find(s =>
      s.toLowerCase() === 'tables' ||
      s.toLowerCase() === 'טבלאות' ||
      s.toLowerCase() === 'schema'
    );

    if (tablesSheet && tables.length === 0) {
      const sheet = workbook.Sheets[tablesSheet];
      const data = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

      for (const row of data) {
        const tableName = row['Table'] || row['TableName'] || row['טבלה'] || row['שם_טבלה'];
        const fieldName = row['Field'] || row['FieldName'] || row['Column'] || row['שדה'] || row['עמודה'];
        // Type column ignored - Raw Extract Philosophy

        if (tableName && fieldName) {
          let table = tables.find(t => t.name === tableName);
          if (!table) {
            table = {
              name: tableName,
              fields: [],
              incremental: { enabled: false, field: '', strategy: 'full' }
            };
            tables.push(table);
          }
          table.fields.push({
            name: fieldName,
            include: true
            // No type - Raw Extract Philosophy
          });
        }
      }
    }

    return { tables, source: filePath, warnings };
  }

  // detectFieldType removed - Raw Extract Philosophy
  // Qlik handles type detection automatically with Dual values

  // Raw Extract: detect incremental field by name pattern only (no type)
  private detectIncrementalField(fields: { name: string; include: boolean }[]): string | null {
    // Common incremental field patterns
    const patterns = [
      /modif(ied)?_?(date|time|at)/i,
      /update(d)?_?(date|time|at)/i,
      /last_?(modified|updated|changed)/i,
      /created_?(at|date|time)/i,
      /timestamp/i,
      /modifieddate/i,
      /updateddate/i,
      /תאריך_עדכון/i,
      /תאריך_יצירה/i
    ];

    // Search by field name only - no type check
    for (const field of fields) {
      for (const pattern of patterns) {
        if (pattern.test(field.name)) {
          return field.name;
        }
      }
    }

    return null;
  }

  // normalizeFieldType removed - Raw Extract Philosophy
  // No type normalization in Phase 1

  /**
   * Parse CSV spec file - supports two formats:
   * 1. Simple: Each column = table name, rows = field names
   * 2. Detailed: Columns = TableName, FieldName, Include, Rename
   */
  private parseCSVSpec(filePath: string): SpecParseResult {
    const content = fs.readFileSync(filePath, 'utf-8');
    const tables: TableDef[] = [];
    const warnings: string[] = [];

    // Parse CSV manually (simple implementation)
    const lines = content.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) {
      return { tables: [], source: filePath, warnings: ['קובץ CSV ריק'] };
    }

    // Parse header row
    const headerRow = this.parseCSVLine(lines[0]);

    // Detect format: detailed or simple
    const isDetailedFormat = headerRow.some(h =>
      /^(table|tablename|טבלה|שם_טבלה)$/i.test(h.trim())
    ) && headerRow.some(h =>
      /^(field|fieldname|column|שדה|עמודה)$/i.test(h.trim())
    );

    if (isDetailedFormat) {
      // Detailed format: TableName, FieldName, Include, Rename columns
      const tableIdx = headerRow.findIndex(h => /^(table|tablename|טבלה|שם_טבלה)$/i.test(h.trim()));
      const fieldIdx = headerRow.findIndex(h => /^(field|fieldname|column|שדה|עמודה)$/i.test(h.trim()));
      const includeIdx = headerRow.findIndex(h => /^(include|כלול)$/i.test(h.trim()));
      const renameIdx = headerRow.findIndex(h => /^(rename|newname|שם_חדש)$/i.test(h.trim()));

      for (let i = 1; i < lines.length; i++) {
        const cols = this.parseCSVLine(lines[i]);
        const tableName = cols[tableIdx]?.trim();
        const fieldName = cols[fieldIdx]?.trim();

        if (!tableName || !fieldName) continue;

        let table = tables.find(t => t.name === tableName);
        if (!table) {
          table = {
            name: tableName,
            fields: [],
            incremental: { enabled: false, field: '', strategy: 'full' }
          };
          tables.push(table);
        }

        const include = includeIdx >= 0 ?
          !['no', 'false', '0', 'לא'].includes(cols[includeIdx]?.toLowerCase() || '') : true;
        const rename = renameIdx >= 0 ? cols[renameIdx]?.trim() : undefined;

        table.fields.push({
          name: fieldName,
          include,
          ...(rename && { rename })
        });
      }

      // Detect incremental fields for each table
      for (const table of tables) {
        const incrementalField = this.detectIncrementalField(table.fields);
        if (incrementalField) {
          table.incremental = {
            enabled: true,
            field: incrementalField,
            strategy: 'insert_only'
          };
        }
      }

    } else {
      // Simple format: Each column = table name, rows = field names
      for (let colIdx = 0; colIdx < headerRow.length; colIdx++) {
        const tableName = headerRow[colIdx]?.trim();
        if (!tableName) continue;

        const fields: { name: string; include: boolean }[] = [];

        // Collect field names from rows
        for (let rowIdx = 1; rowIdx < lines.length; rowIdx++) {
          const cols = this.parseCSVLine(lines[rowIdx]);
          const fieldName = cols[colIdx]?.trim();
          if (fieldName) {
            fields.push({ name: fieldName, include: true });
          }
        }

        if (fields.length === 0) {
          warnings.push(`טבלה "${tableName}" ללא שדות`);
          continue;
        }

        const incrementalField = this.detectIncrementalField(fields);

        tables.push({
          name: tableName,
          fields,
          incremental: {
            enabled: !!incrementalField,
            field: incrementalField || '',
            strategy: incrementalField ? 'insert_only' : 'full'
          }
        });
      }
    }

    return { tables, source: filePath, warnings };
  }

  /**
   * Parse a single CSV line, handling quoted fields
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"' && !inQuotes) {
        inQuotes = true;
      } else if (char === '"' && inQuotes) {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);

    return result;
  }

  private parseJsonSpec(filePath: string): SpecParseResult {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    const tables: TableDef[] = [];

    // Support multiple JSON formats
    const tableArray = data.tables || data.schema || data;

    if (Array.isArray(tableArray)) {
      for (const t of tableArray) {
        tables.push({
          name: t.name || t.tableName || 'Unknown',
          fields: (t.fields || t.columns || []).map((f: { name?: string; fieldName?: string }) => ({
            name: f.name || f.fieldName || 'Unknown',
            include: true
            // No type - Raw Extract Philosophy
          })),
          incremental: {
            enabled: !!t.incremental,
            field: t.incremental?.field || '',
            strategy: t.incremental?.strategy || 'full'
          }
        });
      }
    }

    return { tables, source: filePath };
  }

  private parseYamlSpec(filePath: string): SpecParseResult {
    // Simple YAML parser for basic structure
    const content = fs.readFileSync(filePath, 'utf-8');
    const tables: TableDef[] = [];

    // Basic line-by-line YAML parsing
    let currentTable: TableDef | null = null;
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- name:') || trimmed.startsWith('- table:')) {
        if (currentTable) tables.push(currentTable);
        currentTable = {
          name: trimmed.split(':')[1].trim(),
          fields: [],
          incremental: { enabled: false, field: '', strategy: 'full' }
        };
      } else if (currentTable && trimmed.startsWith('- field:')) {
        const fieldName = trimmed.split(':')[1].trim();
        currentTable.fields.push({ name: fieldName, include: true });
      }
    }
    if (currentTable) tables.push(currentTable);

    return { tables, source: filePath };
  }

  /**
   * Parse Word document (.docx) for table specifications
   * Sends file directly to AI API for intelligent parsing
   */
  private async parseDocumentSpec(filePath: string): Promise<SpecParseResult> {
    const ext = path.extname(filePath).toLowerCase();
    const warnings: string[] = [];

    // Supported formats for direct file upload
    const supportedFormats = ['.docx', '.pdf'];
    const needsTextExtraction = ['.doc']; // Old formats need text extraction

    if (!supportedFormats.includes(ext) && !needsTextExtraction.includes(ext)) {
      vscode.window.showWarningMessage(
        `קבצי ${ext} לא נתמכים. השתמש ב-.docx, .pdf או Excel.`
      );
      return { tables: [], source: filePath, warnings: [`${ext} לא נתמך`] };
    }

    try {
      // Get API keys from environment or VS Code settings
      const config = vscode.workspace.getConfiguration('qmb');
      const geminiKey = process.env.GEMINI_API_KEY || config.get<string>('geminiApiKey');
      const claudeKey = process.env.ANTHROPIC_API_KEY || config.get<string>('anthropicApiKey');

      // Determine which AI to use
      let aiChoice: string | undefined;

      if (geminiKey && claudeKey) {
        // Both keys available - ask user
        aiChoice = await vscode.window.showQuickPick(
          ['Gemini (מומלץ - תומך בקבצים)', 'Claude'],
          { placeHolder: 'בחר AI לניתוח המסמך' }
        );
      } else if (geminiKey) {
        aiChoice = 'Gemini (מומלץ - תומך בקבצים)';
      } else if (claudeKey) {
        aiChoice = 'Claude';
      }

      if (!aiChoice) {
        // No API key available - ask user which they want to provide
        const keyChoice = await vscode.window.showQuickPick(
          ['Gemini API Key', 'Claude API Key'],
          { placeHolder: 'אין API Key זמין. בחר איזה להזין:' }
        );

        if (!keyChoice) {
          return { tables: [], source: filePath, warnings: ['נדרש API Key לניתוח מסמכי Word'] };
        }

        const inputKey = await vscode.window.showInputBox({
          prompt: `הזן ${keyChoice} לניתוח המסמך`,
          password: true,
          placeHolder: keyChoice.includes('Gemini') ? 'AIza...' : 'sk-ant-...'
        });

        if (!inputKey) {
          return { tables: [], source: filePath, warnings: ['נדרש API Key לניתוח מסמכי Word'] };
        }

        if (keyChoice.includes('Gemini')) {
          return await this.parseWithGeminiAPI(filePath, inputKey, warnings);
        } else {
          return await this.parseWithClaudeAPI(filePath, inputKey, warnings);
        }
      }

      // Use selected AI
      if (aiChoice.includes('Gemini')) {
        return await this.parseWithGeminiAPI(filePath, geminiKey!, warnings);
      } else {
        return await this.parseWithClaudeAPI(filePath, claudeKey!, warnings);
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : 'שגיאה בקריאת המסמך';
      vscode.window.showErrorMessage(`שגיאה בפענוח Word: ${message}`);
      return { tables: [], source: filePath, warnings: [message] };
    }
  }

  /**
   * Parse document using Gemini API - sends file directly
   */
  private async parseWithGeminiAPI(
    filePath: string,
    apiKey: string,
    warnings: string[]
  ): Promise<SpecParseResult> {
    const tables: TableDef[] = [];

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      // Use Pro model for better document understanding
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

      // Show progress
      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'מנתח מסמך עם Gemini AI...',
        cancellable: false
      }, async () => {
        // This is just for showing progress UI
      });

      // Read file and convert to base64
      const fileBuffer = fs.readFileSync(filePath);
      const base64Data = fileBuffer.toString('base64');

      // Determine MIME type
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.doc': 'application/msword',
        '.pdf': 'application/pdf'
      };
      const mimeType = mimeTypes[ext] || 'application/octet-stream';

      const prompt = `You are a data modeling expert specializing in ETL and data warehouse design.
Analyze this document and extract a COMPREHENSIVE data model specification for ETL processing.

INSTRUCTIONS:
1. Extract project metadata from the document (name, description, source)
2. Identify the business domain and context
3. Find ALL tables with their COMPLETE field definitions
4. Identify table types (fact/dimension), key fields, and relationships
5. Detect fields suitable for incremental loading
6. Infer potential data quality rules and transformations

OUTPUT FORMAT (strict JSON):
{
  "projectMetadata": {
    "name": "project_name_from_doc",
    "version": "1.0",
    "sourceDocument": "filename",
    "extractedDate": "YYYY-MM-DD",
    "description": "brief description"
  },
  "businessContext": {
    "domain": "e-commerce/finance/etc",
    "description": "business context description",
    "dataOwner": "if mentioned or null"
  },
  "dataArchitecture": {
    "tables": [
      {
        "name": "table_name",
        "type": "fact|dimension|staging|reference",
        "description": "table purpose",
        "fields": [
          {
            "name": "field_name",
            "description": "field meaning",
            "keyType": "PK|FK|BK|null",
            "nullable": true,
            "incrementalCandidate": false
          }
        ],
        "relationships": [
          {
            "targetTable": "other_table",
            "sourceField": "fk_field",
            "targetField": "pk_field",
            "type": "many-to-one|one-to-many|one-to-one"
          }
        ],
        "incrementalField": "timestamp_field_or_null",
        "loadStrategy": "full|incremental|scd2"
      }
    ]
  },
  "semanticLayer": {
    "calculations": ["calc_name: formula"],
    "dimensions": ["dim fields"],
    "measures": ["measure fields"],
    "hierarchies": [{"name": "hier_name", "levels": ["field1", "field2"]}]
  },
  "etlConfig": {
    "loadOrder": ["table1", "table2"],
    "parallelizable": ["independent tables"],
    "dependencies": [{"table": "fact", "dependsOn": ["dim1", "dim2"]}]
  },
  "dataQuality": {
    "globalRules": ["rule descriptions"],
    "tableRules": {"table_name": ["specific rules"]}
  }
}

IMPORTANT:
- Extract EVERY table and field mentioned, even if partially described
- Infer table types from naming patterns (Fact_, Dim_, stg_) or context
- Identify PK/FK relationships from field names (_id, _key patterns)
- Fields ending in _date, _timestamp, created_at, updated_at are incremental candidates
- Return ONLY valid JSON, no explanations or markdown

JSON OUTPUT:`;

      // Send file directly to Gemini
      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        },
        { text: prompt }
      ]);
      const responseText = result.response.text();

      // Parse JSON from response - now expecting an object with dataArchitecture.tables
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        warnings.push('Gemini לא הצליח לחלץ מבנה JSON תקין');
        return { tables: [], source: filePath, warnings };
      }

      const fullSpec = JSON.parse(jsonMatch[0]) as {
        projectMetadata?: { name: string; description?: string };
        businessContext?: { domain: string; description?: string };
        dataArchitecture?: {
          tables: Array<{
            name: string;
            type?: string;
            description?: string;
            fields: Array<{
              name: string;
              description?: string;
              keyType?: string;
              nullable?: boolean;
              incrementalCandidate?: boolean;
            }>;
            relationships?: Array<{
              targetTable: string;
              sourceField: string;
              targetField: string;
              type?: string;
            }>;
            incrementalField?: string | null;
            loadStrategy?: string;
          }>;
        };
        semanticLayer?: object;
        etlConfig?: { loadOrder?: string[]; dependencies?: object[] };
        dataQuality?: object;
      };

      // Store full spec for later use (ETL generation)
      this._lastParsedSpec = fullSpec as FullETLSpec;

      // Convert to TableDef format for UI display
      const tableList = fullSpec.dataArchitecture?.tables || [];
      for (const item of tableList) {
        if (!item.name || !item.fields) continue;

        const tableFields = item.fields.map(f => ({
          name: f.name,
          include: true,
          description: f.description,
          keyType: f.keyType
        }));
        const incrementalField = item.incrementalField || this.detectIncrementalField(tableFields);

        tables.push({
          name: item.name,
          fields: tableFields,
          incremental: {
            enabled: !!incrementalField,
            field: incrementalField || '',
            strategy: item.loadStrategy === 'scd2' ? 'scd2' :
                     item.loadStrategy === 'incremental' ? 'insert_only' : 'full'
          },
          tableType: item.type,
          description: item.description,
          relationships: item.relationships
        });
      }

      if (tables.length > 0) {
        const totalFields = tables.reduce((sum, t) => sum + t.fields.length, 0);
        const projectName = fullSpec.projectMetadata?.name || 'Unknown';
        vscode.window.showInformationMessage(
          `✅ Gemini חילץ "${projectName}": ${tables.length} טבלאות, ${totalFields} שדות`
        );
      } else {
        warnings.push('Gemini לא מצא טבלאות במסמך');
      }

      return { tables, source: filePath, warnings, fullSpec: fullSpec as FullETLSpec };

    } catch (err) {
      const message = err instanceof Error ? err.message : 'שגיאה בקריאה ל-Gemini API';
      warnings.push(`Gemini API Error: ${message}`);
      vscode.window.showErrorMessage(`שגיאה ב-Gemini API: ${message}`);
      return { tables: [], source: filePath, warnings };
    }
  }

  /**
   * Parse document using Claude API
   * PDF: sends file directly, DOCX: extracts text with mammoth
   */
  private async parseWithClaudeAPI(
    filePath: string,
    apiKey: string,
    warnings: string[]
  ): Promise<SpecParseResult> {
    const tables: TableDef[] = [];

    try {
      const client = new Anthropic({ apiKey });

      // Show progress
      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'מנתח מסמך עם Claude AI...',
        cancellable: false
      }, async () => {
        // This is just for showing progress UI
      });

      const ext = path.extname(filePath).toLowerCase();
      const prompt = `You are a data modeling expert specializing in ETL and data warehouse design.
Analyze this document and extract a COMPREHENSIVE data model specification for ETL processing.

INSTRUCTIONS:
1. Extract project metadata from the document (name, description, source)
2. Identify the business domain and context
3. Find ALL tables with their COMPLETE field definitions
4. Identify table types (fact/dimension), key fields, and relationships
5. Detect fields suitable for incremental loading
6. Infer potential data quality rules and transformations

OUTPUT FORMAT (strict JSON):
{
  "projectMetadata": {
    "name": "project_name_from_doc",
    "version": "1.0",
    "sourceDocument": "filename",
    "extractedDate": "YYYY-MM-DD",
    "description": "brief description"
  },
  "businessContext": {
    "domain": "e-commerce/finance/etc",
    "description": "business context description",
    "dataOwner": "if mentioned or null"
  },
  "dataArchitecture": {
    "tables": [
      {
        "name": "table_name",
        "type": "fact|dimension|staging|reference",
        "description": "table purpose",
        "fields": [
          {
            "name": "field_name",
            "description": "field meaning",
            "keyType": "PK|FK|BK|null",
            "nullable": true,
            "incrementalCandidate": false
          }
        ],
        "relationships": [
          {
            "targetTable": "other_table",
            "sourceField": "fk_field",
            "targetField": "pk_field",
            "type": "many-to-one|one-to-many|one-to-one"
          }
        ],
        "incrementalField": "timestamp_field_or_null",
        "loadStrategy": "full|incremental|scd2"
      }
    ]
  },
  "semanticLayer": {
    "calculations": ["calc_name: formula"],
    "dimensions": ["dim fields"],
    "measures": ["measure fields"],
    "hierarchies": [{"name": "hier_name", "levels": ["field1", "field2"]}]
  },
  "etlConfig": {
    "loadOrder": ["table1", "table2"],
    "parallelizable": ["independent tables"],
    "dependencies": [{"table": "fact", "dependsOn": ["dim1", "dim2"]}]
  },
  "dataQuality": {
    "globalRules": ["rule descriptions"],
    "tableRules": {"table_name": ["specific rules"]}
  }
}

IMPORTANT:
- Extract EVERY table and field mentioned, even if partially described
- Infer table types from naming patterns (Fact_, Dim_, stg_) or context
- Identify PK/FK relationships from field names (_id, _key patterns)
- Fields ending in _date, _timestamp, created_at, updated_at are incremental candidates
- Return ONLY valid JSON, no explanations or markdown

JSON OUTPUT:`;

      let response;

      if (ext === '.pdf') {
        // PDF: send file directly to Claude
        const fileBuffer = fs.readFileSync(filePath);
        const base64Data = fileBuffer.toString('base64');

        response = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'document',
                  source: {
                    type: 'base64',
                    media_type: 'application/pdf',
                    data: base64Data
                  }
                },
                { type: 'text', text: prompt }
              ]
            }
          ]
        });
      } else {
        // DOCX/DOC: extract text with mammoth first
        const mammothResult = await mammoth.extractRawText({ path: filePath });
        const text = mammothResult.value;

        if (!text || text.trim().length === 0) {
          return { tables: [], source: filePath, warnings: ['מסמך Word ריק'] };
        }

        response = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          messages: [
            {
              role: 'user',
              content: `${prompt}\n\nDOCUMENT TEXT:\n${text}`
            }
          ]
        });
      }

      // Extract text content from response
      const responseText = response.content
        .filter(block => block.type === 'text')
        .map(block => (block as { type: 'text'; text: string }).text)
        .join('');

      // Parse JSON from response - now expecting an object with dataArchitecture.tables
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        warnings.push('Claude לא הצליח לחלץ מבנה JSON תקין');
        return { tables: [], source: filePath, warnings };
      }

      const fullSpec = JSON.parse(jsonMatch[0]) as {
        projectMetadata?: { name: string; description?: string };
        businessContext?: { domain: string; description?: string };
        dataArchitecture?: {
          tables: Array<{
            name: string;
            type?: string;
            description?: string;
            fields: Array<{
              name: string;
              description?: string;
              keyType?: string;
              nullable?: boolean;
              incrementalCandidate?: boolean;
            }>;
            relationships?: Array<{
              targetTable: string;
              sourceField: string;
              targetField: string;
              type?: string;
            }>;
            incrementalField?: string | null;
            loadStrategy?: string;
          }>;
        };
        semanticLayer?: object;
        etlConfig?: { loadOrder?: string[]; dependencies?: object[] };
        dataQuality?: object;
      };

      // Store full spec for later use (ETL generation)
      this._lastParsedSpec = fullSpec as FullETLSpec;

      // Convert to TableDef format for UI display
      const tableList = fullSpec.dataArchitecture?.tables || [];
      for (const item of tableList) {
        if (!item.name || !item.fields) continue;

        const tableFields = item.fields.map(f => ({
          name: f.name,
          include: true,
          description: f.description,
          keyType: f.keyType
        }));
        const incrementalField = item.incrementalField || this.detectIncrementalField(tableFields);

        tables.push({
          name: item.name,
          fields: tableFields,
          incremental: {
            enabled: !!incrementalField,
            field: incrementalField || '',
            strategy: item.loadStrategy === 'scd2' ? 'scd2' :
                     item.loadStrategy === 'incremental' ? 'insert_only' : 'full'
          },
          tableType: item.type,
          description: item.description,
          relationships: item.relationships
        });
      }

      if (tables.length > 0) {
        const totalFields = tables.reduce((sum, t) => sum + t.fields.length, 0);
        const projectName = fullSpec.projectMetadata?.name || 'Unknown';
        vscode.window.showInformationMessage(
          `✅ Claude חילץ "${projectName}": ${tables.length} טבלאות, ${totalFields} שדות`
        );
      } else {
        warnings.push('Claude לא מצא טבלאות במסמך');
      }

      return { tables, source: filePath, warnings, fullSpec: fullSpec as FullETLSpec };

    } catch (err) {
      const message = err instanceof Error ? err.message : 'שגיאה בקריאה ל-Claude API';
      warnings.push(`Claude API Error: ${message}`);
      vscode.window.showErrorMessage(`שגיאה ב-Claude API: ${message}`);
      return { tables: [], source: filePath, warnings };
    }
  }

  public postMessage(message: unknown) {
    this._panel.webview.postMessage(message);
  }

  public dispose() {
    WizardPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private _update() {
    this._panel.webview.html = this._getHtmlForWebview();
  }

  private _getHtmlForWebview(): string {
    const webview = this._panel.webview;
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' 'unsafe-inline';">
  <title>Qlik Model Builder</title>
  <style>
    ${getDashboardStyles()}
  </style>
</head>
<body>
  <!-- Progress Bar - 7 Steps (shown during loading) -->
  <div class="progress-bar" id="progressBar">
    <div class="step-indicator current" data-step="1">
      <div class="step-circle">1</div>
      <span class="step-label">Entry</span>
    </div>
    <div class="step-indicator" data-step="2">
      <div class="step-circle">2</div>
      <span class="step-label">Space</span>
    </div>
    <div class="step-indicator" data-step="3">
      <div class="step-circle">3</div>
      <span class="step-label">Source</span>
    </div>
    <div class="step-indicator" data-step="4">
      <div class="step-circle">4</div>
      <span class="step-label">Tables</span>
    </div>
    <div class="step-indicator" data-step="5">
      <div class="step-circle">5</div>
      <span class="step-label">Fields</span>
    </div>
    <div class="step-indicator" data-step="6">
      <div class="step-circle">6</div>
      <span class="step-label">Incremental</span>
    </div>
    <div class="step-indicator" data-step="7">
      <div class="step-circle">7</div>
      <span class="step-label">Deploy</span>
    </div>
  </div>

  <!-- Step 1: Entry Point -->
  <div id="step-1" class="step-content" data-step="1">
    <h2>Entry Point</h2>
    <p style="margin-bottom: 16px; color: var(--text-secondary);">
      How would you like to start building your data model?
    </p>

    <ul class="item-list" id="entry-options">
      <li data-entry="spec">
        <div class="item-info">
          <span class="item-name">From Spec File</span>
          <span class="item-type">Upload a Word/Excel specification document</span>
        </div>
      </li>
      <li data-entry="template">
        <div class="item-info">
          <span class="item-name">From Template</span>
          <span class="item-type">Start with a predefined template</span>
        </div>
      </li>
      <li data-entry="scratch">
        <div class="item-info">
          <span class="item-name">Start from Scratch</span>
          <span class="item-type">Build your model step by step</span>
        </div>
      </li>
    </ul>

    <!-- Upload section - shown when "From Spec File" is selected -->
    <div id="spec-upload-section" style="display: none; margin-top: 16px; padding: 16px; background: var(--vscode-editor-background); border-radius: 8px; border: 1px solid var(--vscode-panel-border);">
      <button id="btn-upload-spec" class="btn btn-primary btn-upload-action">
        Select Spec File
      </button>
      <div id="selected-file" style="margin-top: 8px; color: var(--vscode-descriptionForeground);"></div>
    </div>

    <div class="button-row">
      <div></div>
      <button class="btn btn-primary" id="btn-next" disabled>
        Next
      </button>
    </div>
  </div>

  <!-- Step 2: Space Selection -->
  <div id="step-2" class="step-content" data-step="2" style="display: none;">
    <h2>Space Selection</h2>
    <p style="margin-bottom: 16px; color: var(--text-secondary);">
      Select a Qlik Cloud Space for your model
    </p>

    <!-- Loading State -->
    <div id="spaces-loading" style="display: none; padding: 20px; text-align: center;">
      <span class="codicon codicon-loading codicon-modifier-spin"></span>
      Loading spaces...
    </div>

    <!-- Error State -->
    <div id="spaces-error" style="display: none; padding: 20px; border: 1px solid var(--error-color); border-radius: 4px;">
      <p id="spaces-error-message" style="color: var(--error-color); margin-bottom: 12px;"></p>
      <button class="btn btn-secondary" id="btn-spaces-retry">Retry</button>
      <button class="btn btn-secondary" id="btn-spaces-configure" style="margin-left: 8px;">Configure</button>
    </div>

    <!-- Empty State -->
    <div id="spaces-empty" style="display: none; padding: 20px; text-align: center; color: var(--text-secondary);">
      <p>No spaces found.</p>
      <p>Create your first space below.</p>
    </div>

    <!-- Spaces List -->
    <div id="spaces-list" style="display: none;">
      <div class="section-box" style="margin-bottom: 16px;">
        <h3 style="font-size: 12px; margin-bottom: 12px; color: var(--text-secondary);">Available Spaces</h3>
        <ul id="spaces-radio-list" class="item-list" style="max-height: 300px; overflow-y: auto;">
          <!-- Radio buttons rendered here -->
        </ul>
      </div>
    </div>

    <!-- Create New Space -->
    <div id="create-space-section" class="section-box" style="margin-top: 16px;">
      <h3 style="font-size: 12px; margin-bottom: 12px; color: var(--text-secondary);">Or Create New Space</h3>
      <div style="display: flex; gap: 8px; align-items: center;">
        <input type="text" id="new-space-name" placeholder="Space name"
               style="flex: 1; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);" />
        <button class="btn btn-secondary" id="btn-create-space">
          <span class="codicon codicon-add"></span> Create
        </button>
      </div>
      <p id="create-space-error" style="display: none; color: var(--error-color); font-size: 12px; margin-top: 4px;"></p>
    </div>

    <div class="button-row" style="margin-top: 24px;">
      <button class="btn btn-secondary" id="btn-back">Back</button>
      <button class="btn btn-primary" id="btn-next-2" disabled>Next</button>
    </div>
  </div>

  <!-- Step 3: Source Selection -->
  <div id="step-3" class="step-content" data-step="3" style="display: none;">
    <h2>Source Selection</h2>
    <p style="margin-bottom: 16px; color: var(--text-secondary);">
      Select or create a data connection
    </p>

    <!-- Loading State -->
    <div id="connections-loading" class="loading-section" style="display: flex; padding: 20px; text-align: center; align-items: center; justify-content: center; gap: 8px;">
      <span class="codicon codicon-loading codicon-modifier-spin"></span>
      <span>Loading connections...</span>
    </div>

    <!-- Error State -->
    <div id="connections-error" class="error-section" style="display: none; padding: 20px; border: 1px solid var(--error-color); border-radius: 4px;">
      <p class="error-message" style="color: var(--error-color); margin-bottom: 12px;"></p>
      <p id="connections-error-id" style="font-size: 11px; color: var(--text-secondary); margin-bottom: 8px; display: none;">Error ID: <span></span></p>
      <div class="error-actions">
        <button id="btn-connections-retry" class="btn btn-secondary">Retry</button>
        <button id="btn-connections-configure" class="btn btn-secondary" style="display: none; margin-left: 8px;">Configure Credentials</button>
        <a id="btn-connections-report" href="#" style="display: none; margin-left: 8px; font-size: 12px;">Report Issue</a>
      </div>
    </div>

    <!-- Empty State -->
    <div id="connections-empty" class="empty-section" style="display: none; padding: 20px; text-align: center; color: var(--text-secondary);">
      <p>No connections found. Create one below.</p>
    </div>

    <!-- Connections List -->
    <div id="connections-list" style="display: none;">
      <div class="section-box" style="margin-bottom: 16px;">
        <h3 style="font-size: 12px; margin-bottom: 12px; color: var(--text-secondary);">Available Connections</h3>
        <div id="connections-radio-list" class="radio-list" style="max-height: 250px; overflow-y: auto;">
          <!-- Radio buttons rendered dynamically -->
        </div>
      </div>
    </div>

    <hr style="border: none; border-top: 1px solid var(--border-color); margin: 16px 0;">

    <!-- Create New Connection -->
    <div id="create-connection-section" class="section-box">
      <h3 style="font-size: 12px; margin-bottom: 12px; color: var(--text-secondary);">Or Create New Connection</h3>

      <div class="form-group" style="margin-bottom: 12px;">
        <label for="connection-type" style="display: block; font-size: 12px; margin-bottom: 4px;">Connection Type</label>
        <select id="connection-type" style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
          <option value="">Select type...</option>
          <option value="PostgreSQL">PostgreSQL</option>
          <option value="MySQL">MySQL</option>
          <option value="SQLServer">SQL Server</option>
          <option value="REST">REST API</option>
          <option value="folder">Folder (DataFiles)</option>
        </select>
      </div>

      <div class="form-group" style="margin-bottom: 12px;">
        <label for="new-connection-name" style="display: block; font-size: 12px; margin-bottom: 4px;">Connection Name</label>
        <input type="text" id="new-connection-name" placeholder="My Database" maxlength="100"
               style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);" />
      </div>

      <div id="connection-params" class="form-group" style="display: none; margin-bottom: 12px;">
        <label for="connection-string" style="display: block; font-size: 12px; margin-bottom: 4px;">Connection String</label>
        <input type="text" id="connection-string" placeholder="host=localhost;port=5432;database=mydb"
               style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);" />
      </div>

      <button id="btn-create-connection" class="btn btn-secondary" disabled>
        <span class="codicon codicon-add"></span> Create Connection
      </button>
      <span id="create-connection-error" class="error-text" style="display: none; color: var(--error-color); font-size: 12px; margin-left: 8px;"></span>
    </div>

    <div class="button-row" style="margin-top: 24px;">
      <button class="btn btn-secondary" id="btn-back-3">Back</button>
      <button class="btn btn-primary" id="btn-next-3" disabled>Next</button>
    </div>
  </div>

  <!-- Step 4: Table Selection -->
  <div id="step-4" class="step-content" data-step="4" style="display: none;">
    <h2>📊 Table Selection</h2>
    <p style="margin-bottom: 16px; color: var(--text-secondary);">
      Select tables to include in your data model
    </p>

    <div id="tables-loading" class="loading-section" style="display: flex; align-items: center; gap: 12px; padding: 24px; justify-content: center;">
      <div class="spinner"></div>
      <span>Loading tables...</span>
    </div>

    <div id="tables-error" class="error-section" style="display: none; background: var(--error-bg, rgba(255,0,0,0.1)); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
      <p class="error-message" style="color: var(--error-color, #f44336); margin-bottom: 12px;"></p>
      <p id="tables-error-id" style="font-size: 11px; color: var(--text-secondary); margin-bottom: 12px;">Error ID: <span></span></p>
      <div class="error-actions" style="display: flex; gap: 8px;">
        <button id="btn-tables-retry" class="btn btn-secondary">
          <span class="codicon codicon-refresh"></span> Retry
        </button>
      </div>
    </div>

    <div id="tables-empty" class="empty-section" style="display: none; text-align: center; padding: 32px; color: var(--text-secondary);">
      <p>No tables found in this connection.</p>
      <p class="empty-hint" style="font-size: 12px; margin-top: 8px;">Check that the connection has proper permissions.</p>
    </div>

    <div id="tables-list" style="display: none;">
      <div class="tables-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <label class="select-all-label" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
          <input type="checkbox" id="tables-select-all">
          <span>Select All</span>
        </label>
        <span id="tables-count" class="count-badge" style="background: var(--button-primary-bg, #0078d4); color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">0 selected</span>
      </div>
      <div class="tables-filter" style="margin-bottom: 12px;">
        <input type="text" id="tables-search" placeholder="Filter tables..." style="width: 100%; padding: 8px 12px; border: 1px solid var(--input-border); border-radius: 4px; background: var(--input-bg); color: var(--input-fg);">
      </div>
      <div id="tables-checkbox-list" class="checkbox-list" style="max-height: 300px; overflow-y: auto; border: 1px solid var(--input-border); border-radius: 4px; padding: 8px;">
        <!-- Dynamic table checkboxes -->
      </div>
    </div>

    <div class="button-row" style="margin-top: 24px; display: flex; justify-content: space-between;">
      <button class="btn btn-secondary" id="btn-back-4">Back</button>
      <button class="btn btn-primary" id="btn-next-4" disabled>Next</button>
    </div>
  </div>

  <!-- Step 5: Field Configuration -->
  <div id="step-5" class="step-content" data-step="5" style="display: none;">
    <h2>🔧 Field Configuration</h2>
    <p style="margin-bottom: 16px; color: var(--text-secondary);">
      Select fields to include for each table
    </p>

    <div id="fields-loading" class="loading-section" style="display: flex; align-items: center; gap: 12px; padding: 24px; justify-content: center;">
      <div class="spinner"></div>
      <span>Loading fields...</span>
    </div>

    <div id="fields-error" class="error-section" style="display: none; background: var(--error-bg, rgba(255,0,0,0.1)); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
      <p class="error-message" style="color: var(--error-color, #f44336); margin-bottom: 12px;"></p>
      <p id="fields-error-id" style="font-size: 11px; color: var(--text-secondary); margin-bottom: 12px;">Error ID: <span></span></p>
      <div class="error-actions" style="display: flex; gap: 8px;">
        <button id="btn-fields-retry" class="btn btn-secondary">
          <span class="codicon codicon-refresh"></span> Retry
        </button>
      </div>
    </div>

    <div id="fields-list" style="display: none;">
      <div class="fields-table-selector" style="margin-bottom: 16px;">
        <label for="field-table-select" style="display: block; margin-bottom: 4px; font-weight: 500;">Select Table:</label>
        <select id="field-table-select" style="width: 100%; padding: 8px 12px; border: 1px solid var(--input-border); border-radius: 4px; background: var(--input-bg); color: var(--input-fg);">
          <!-- Dynamic table options -->
        </select>
      </div>

      <div class="fields-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <label class="select-all-label" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
          <input type="checkbox" id="fields-select-all">
          <span>Select All Fields</span>
        </label>
        <span id="fields-count" class="count-badge" style="background: var(--button-primary-bg, #0078d4); color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">0 selected</span>
      </div>

      <div class="fields-filter" style="margin-bottom: 12px;">
        <input type="text" id="fields-search" placeholder="Filter fields..." style="width: 100%; padding: 8px 12px; border: 1px solid var(--input-border); border-radius: 4px; background: var(--input-bg); color: var(--input-fg);">
      </div>

      <div id="fields-checkbox-list" class="checkbox-list" style="max-height: 300px; overflow-y: auto; border: 1px solid var(--input-border); border-radius: 4px; padding: 8px;">
        <!-- Dynamic field checkboxes -->
      </div>
    </div>

    <div class="button-row" style="margin-top: 24px; display: flex; justify-content: space-between;">
      <button class="btn btn-secondary" id="btn-back-5">Back</button>
      <button class="btn btn-primary" id="btn-next-5" disabled>Next</button>
    </div>
  </div>

  <!-- Step 6: Incremental Load Configuration -->
  <div id="step-6" class="step-content" data-step="6" style="display: none;">
    <h2>⚡ Incremental Load</h2>
    <p style="margin-bottom: 16px; color: var(--text-secondary);">
      Configure incremental load settings for each table
    </p>

    <div class="incremental-table-selector" style="margin-bottom: 16px;">
      <label for="incremental-table-select" style="display: block; margin-bottom: 4px; font-weight: 500;">Select Table:</label>
      <select id="incremental-table-select" style="width: 100%; padding: 8px 12px; border: 1px solid var(--input-border); border-radius: 4px; background: var(--input-bg); color: var(--input-fg);">
        <!-- Dynamic table options -->
      </select>
    </div>

    <div id="incremental-config" style="background: var(--card-bg, rgba(0,0,0,0.1)); padding: 16px; border-radius: 8px;">
      <div class="config-row" style="margin-bottom: 12px;">
        <label for="incremental-mode" style="display: block; margin-bottom: 4px; font-weight: 500;">Load Mode:</label>
        <select id="incremental-mode" style="width: 100%; padding: 8px 12px; border: 1px solid var(--input-border); border-radius: 4px; background: var(--input-bg); color: var(--input-fg);">
          <option value="full">Full Load (Replace all data)</option>
          <option value="incremental">Incremental (Append new rows)</option>
          <option value="upsert">Upsert (Update or Insert)</option>
        </select>
      </div>

      <div id="incremental-options" style="display: none;">
        <div class="config-row" style="margin-bottom: 12px;">
          <label for="timestamp-field" style="display: block; margin-bottom: 4px; font-weight: 500;">Timestamp Field:</label>
          <input type="text" id="timestamp-field" placeholder="e.g., updated_at" style="width: 100%; padding: 8px 12px; border: 1px solid var(--input-border); border-radius: 4px; background: var(--input-bg); color: var(--input-fg);">
          <span style="font-size: 11px; color: var(--text-secondary);">Field used to detect changes</span>
        </div>

        <div class="config-row" style="margin-bottom: 12px;">
          <label for="key-field" style="display: block; margin-bottom: 4px; font-weight: 500;">Key Field:</label>
          <input type="text" id="key-field" placeholder="e.g., id" style="width: 100%; padding: 8px 12px; border: 1px solid var(--input-border); border-radius: 4px; background: var(--input-bg); color: var(--input-fg);">
          <span style="font-size: 11px; color: var(--text-secondary);">Primary key for upsert operations</span>
        </div>
      </div>
    </div>

    <div class="button-row" style="margin-top: 24px; display: flex; justify-content: space-between;">
      <button class="btn btn-secondary" id="btn-back-6">Back</button>
      <button class="btn btn-primary" id="btn-next-6">Next</button>
    </div>
  </div>

  <!-- Step 7: Review & Deploy -->
  <div id="step-7" class="step-content" data-step="7" style="display: none;">
    <h2>🚀 Review & Deploy</h2>
    <p style="margin-bottom: 16px; color: var(--text-secondary);">
      Review your configuration and deploy the app
    </p>

    <div id="review-summary" style="background: var(--card-bg, rgba(0,0,0,0.1)); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
      <div id="review-space" class="review-row" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--input-border);">
        <span>Space:</span>
        <span id="review-space-value" style="font-weight: 500;">-</span>
      </div>
      <div id="review-connection" class="review-row" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--input-border);">
        <span>Connection:</span>
        <span id="review-connection-value" style="font-weight: 500;">-</span>
      </div>
      <div id="review-tables" class="review-row" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--input-border);">
        <span>Tables:</span>
        <span id="review-tables-value" style="font-weight: 500;">0</span>
      </div>
      <div id="review-fields" class="review-row" style="display: flex; justify-content: space-between; padding: 8px 0;">
        <span>Total Fields:</span>
        <span id="review-fields-value" style="font-weight: 500;">0</span>
      </div>
    </div>

    <div class="app-name-section" style="margin-bottom: 16px;">
      <label for="app-name" style="display: block; margin-bottom: 4px; font-weight: 500;">App Name:</label>
      <input type="text" id="app-name" placeholder="My Data Model" style="width: 100%; padding: 8px 12px; border: 1px solid var(--input-border); border-radius: 4px; background: var(--input-bg); color: var(--input-fg);">
    </div>

    <div id="deploy-loading" style="display: none; text-align: center; padding: 24px;">
      <div class="spinner"></div>
      <span>Deploying...</span>
    </div>

    <div id="deploy-error" class="error-section" style="display: none; background: var(--error-bg, rgba(255,0,0,0.1)); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
      <p class="error-message" style="color: var(--error-color, #f44336);"></p>
      <button id="btn-deploy-retry" class="btn btn-secondary" style="margin-top: 8px;">Retry</button>
    </div>

    <div id="deploy-success" style="display: none; background: var(--success-bg, rgba(0,255,0,0.1)); padding: 16px; border-radius: 8px; margin-bottom: 16px; text-align: center;">
      <p style="color: var(--success-color, #4caf50); font-weight: 500;">✅ App deployed successfully!</p>
      <button id="btn-open-app" class="btn btn-primary" style="margin-top: 8px;">Open in Qlik Cloud</button>
    </div>

    <div class="button-row" style="margin-top: 24px; display: flex; justify-content: space-between;">
      <button class="btn btn-secondary" id="btn-back-7">Back</button>
      <button class="btn btn-primary" id="btn-deploy" style="background: var(--qlik-green, #4caf50);">Deploy App</button>
    </div>
  </div>

  <div id="app">
    <div class="loading">
      <div class="spinner"></div>
    </div>
  </div>

  <script nonce="${nonce}">
    ${getDashboardScript()}
  </script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function getStyles(): string {
  return `
    /* CSS Variables */
    :root {
      --qlik-green: #009845;
      --qlik-green-light: #00c853;
      --qlik-green-dark: #007a38;
      --bg-primary: var(--vscode-editor-background);
      --bg-secondary: var(--vscode-sideBar-background);
      --bg-hover: var(--vscode-list-hoverBackground);
      --text-primary: var(--vscode-editor-foreground);
      --text-secondary: var(--vscode-descriptionForeground);
      --border-color: var(--vscode-panel-border);
      --error-color: #ff5252;
      --success-color: #4caf50;
      --warning-color: #ff9800;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--vscode-font-family);
      background: var(--bg-primary);
      color: var(--text-primary);
      height: 100vh;
      overflow: hidden;
    }

    /* Dashboard Layout */
    .qmb-dashboard {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }

    /* Header */
    .qmb-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
    }

    .qmb-header h1 {
      font-size: 18px;
      font-weight: 600;
      color: var(--qlik-green);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .qmb-logo {
      width: 24px;
      height: 24px;
      background: var(--qlik-green);
      border-radius: 4px;
    }

    .connection-status {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      background: var(--bg-primary);
      border-radius: 20px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .connection-status:hover {
      background: var(--bg-hover);
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--error-color);
    }

    .status-dot.connected {
      background: var(--success-color);
    }

    /* Main Layout */
    .qmb-main {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    /* Sidebar */
    .qmb-sidebar {
      width: 280px;
      background: var(--bg-secondary);
      border-left: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .sidebar-section {
      border-bottom: 1px solid var(--border-color);
    }

    .sidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      cursor: pointer;
      user-select: none;
    }

    .sidebar-header:hover {
      background: var(--bg-hover);
    }

    .sidebar-header h3 {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .sidebar-content {
      padding: 0 8px 12px;
      max-height: 200px;
      overflow-y: auto;
    }

    .sidebar-content.collapsed {
      display: none;
    }

    /* Tree Items */
    .tree-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      transition: all 0.15s;
    }

    .tree-item:hover {
      background: var(--bg-hover);
    }

    .tree-item.selected {
      background: rgba(0, 152, 69, 0.15);
      color: var(--qlik-green);
    }

    .tree-item .icon {
      opacity: 0.7;
    }

    .tree-item.selected .icon {
      opacity: 1;
    }

    /* Checkbox Items (for tables) */
    .checkbox-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      transition: all 0.15s;
    }

    .checkbox-item:hover {
      background: var(--bg-hover);
    }

    .checkbox-item input[type="checkbox"] {
      width: 16px;
      height: 16px;
      accent-color: var(--qlik-green);
    }

    .checkbox-item.checked {
      background: rgba(0, 152, 69, 0.1);
    }

    /* Search Box */
    .search-box {
      padding: 8px 12px;
    }

    .search-input {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      background: var(--bg-primary);
      color: var(--text-primary);
      font-size: 13px;
    }

    .search-input:focus {
      outline: none;
      border-color: var(--qlik-green);
    }

    .search-input::placeholder {
      color: var(--text-secondary);
    }

    /* Canvas Area */
    .qmb-canvas {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .canvas-area {
      flex: 1;
      padding: 24px;
      overflow-y: auto;
    }

    /* Selection Summary */
    .selection-summary {
      background: var(--bg-secondary);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 20px;
    }

    .summary-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    .summary-header h2 {
      font-size: 16px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .summary-stats {
      display: flex;
      gap: 24px;
    }

    .stat-item {
      text-align: center;
    }

    .stat-value {
      font-size: 24px;
      font-weight: 700;
      color: var(--qlik-green);
    }

    .stat-label {
      font-size: 11px;
      color: var(--text-secondary);
      text-transform: uppercase;
    }

    /* Selected Tables Grid */
    .selected-tables {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 16px;
    }

    .table-chip {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      font-size: 12px;
    }

    .table-chip .remove {
      cursor: pointer;
      opacity: 0.6;
      font-size: 14px;
    }

    .table-chip .remove:hover {
      opacity: 1;
      color: var(--error-color);
    }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: var(--text-secondary);
    }

    .empty-state .icon {
      font-size: 48px;
      margin-bottom: 16px;
      opacity: 0.5;
    }

    .empty-state h3 {
      font-size: 18px;
      margin-bottom: 8px;
      color: var(--text-primary);
    }

    .empty-state p {
      font-size: 14px;
      max-width: 300px;
      margin: 0 auto;
    }

    /* Script Preview */
    .script-preview {
      background: var(--bg-secondary);
      border-radius: 12px;
      overflow: hidden;
    }

    .script-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color);
    }

    .script-header h3 {
      font-size: 14px;
      font-weight: 600;
    }

    .script-content {
      padding: 16px;
      max-height: 300px;
      overflow-y: auto;
    }

    .script-content pre {
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 12px;
      line-height: 1.6;
      white-space: pre-wrap;
      color: var(--text-secondary);
    }

    /* Action Bar */
    .action-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      background: var(--bg-secondary);
      border-top: 1px solid var(--border-color);
    }

    .action-info {
      font-size: 13px;
      color: var(--text-secondary);
    }

    .action-info strong {
      color: var(--qlik-green);
    }

    .action-buttons {
      display: flex;
      gap: 12px;
    }

    /* Buttons */
    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-primary {
      background: var(--qlik-green);
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: var(--qlik-green-dark);
    }

    .btn-outline {
      background: transparent;
      border: 1px solid var(--border-color);
      color: var(--text-primary);
    }

    .btn-outline:hover:not(:disabled) {
      background: var(--bg-hover);
      border-color: var(--qlik-green);
    }

    /* Config Form */
    .config-screen {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 40px;
    }

    .config-card {
      background: var(--bg-secondary);
      border-radius: 16px;
      padding: 40px;
      max-width: 450px;
      width: 100%;
    }

    .config-card h2 {
      font-size: 24px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .config-card > p {
      color: var(--text-secondary);
      margin-bottom: 32px;
    }

    .form-group {
      margin-bottom: 20px;
    }

    .form-group label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      margin-bottom: 8px;
    }

    .form-input {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid var(--border-color);
      border-radius: 8px;
      background: var(--bg-primary);
      color: var(--text-primary);
      font-size: 14px;
      transition: border-color 0.2s;
    }

    .form-input:focus {
      outline: none;
      border-color: var(--qlik-green);
    }

    .form-hint {
      font-size: 12px;
      color: var(--text-secondary);
      margin-top: 6px;
    }

    .form-hint a {
      color: var(--qlik-green);
      text-decoration: none;
    }

    .form-hint a:hover {
      text-decoration: underline;
    }

    .error-message {
      background: rgba(255, 82, 82, 0.1);
      border: 1px solid var(--error-color);
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 20px;
      color: var(--error-color);
      font-size: 13px;
    }

    /* Loading */
    .loading-screen {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      gap: 16px;
    }

    .loader {
      width: 40px;
      height: 40px;
      border: 3px solid var(--border-color);
      border-top-color: var(--qlik-green);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .loading-text {
      color: var(--text-secondary);
      font-size: 14px;
    }

    /* Skeleton Loading */
    .skeleton {
      background: linear-gradient(90deg, var(--bg-primary) 25%, var(--bg-hover) 50%, var(--bg-primary) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 4px;
    }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    .skeleton-item {
      height: 36px;
      margin-bottom: 8px;
    }

    /* Chevron */
    .chevron {
      transition: transform 0.2s;
    }

    .chevron.collapsed {
      transform: rotate(-90deg);
    }

    /* Button Spinner */
    .btn-spinner {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-left: 8px;
      vertical-align: middle;
    }
  `;
}

function getScript(): string {
  return `
    const vscode = acquireVsCodeApi();

    // Application State
    const state = {
      configured: false,
      tenantUrl: '',
      spaces: [],
      connections: [],
      selectedSpace: null,
      selectedConnection: null,
      tables: [],  // Array of {name, fields: [{name, type, include}], incremental: {enabled, field, strategy}}
      selectedTableIndex: null,
      generatedScript: ''
    };

    // Initialize
    init();

    function init() {
      vscode.postMessage({ type: 'getInitialData' });
    }

    // Message Handler
    window.addEventListener('message', (event) => {
      const msg = event.data;

      switch (msg.type) {
        case 'initialData':
          state.configured = msg.configured;
          state.tenantUrl = msg.tenantUrl;
          render();
          break;

        case 'configResult':
          console.log('Config result:', msg);
          if (msg.success) {
            state.configured = true;
            state.tenantUrl = document.getElementById('tenantUrl')?.value || state.tenantUrl;
            render();
          } else {
            showConfigError(msg.message || 'שגיאה לא ידועה');
          }
          break;

        case 'spaces':
          state.spaces = msg.data || [];
          if (state.spaces.length > 0 && !state.selectedSpace) {
            state.selectedSpace = state.spaces[0].id;
          }
          renderSidebar();
          break;

        case 'connections':
          state.connections = msg.data || [];
          if (state.connections.length > 0 && !state.selectedConnection) {
            state.selectedConnection = state.connections[0].id;
          }
          renderSidebar();
          break;

        case 'scriptGenerated':
          state.generatedScript = msg.script;
          renderCanvas();
          break;

        case 'error':
          console.error(msg.source, msg.message);
          break;

        case 'specParseStart':
          showSpecLoading(msg.fileName);
          break;

        case 'specParsed':
          handleSpecParsed(msg.tables, msg.source, msg.warnings);
          break;

        case 'specParseError':
          hideSpecLoading();
          alert('שגיאה בפענוח הקובץ: ' + msg.message);
          break;
      }
    });

    // Main Render
    function render() {
      const app = document.getElementById('app');

      if (!state.configured) {
        app.innerHTML = renderConfigScreen();
        setupConfigListeners();
      } else {
        app.innerHTML = renderDashboard();
        renderSidebar();
        renderCanvas();
      }
    }

    function setupConfigListeners() {
      const btnConnect = document.getElementById('btnConnect');
      if (btnConnect) {
        btnConnect.addEventListener('click', connect);
      }

      const btnSkip = document.getElementById('btnSkipConnection');
      if (btnSkip) {
        btnSkip.addEventListener('click', () => {
          state.configured = true;
          render();
          vscode.postMessage({ type: 'showInfo', text: 'עובד במצב לא מקוון - ללא חיבור לQlik Cloud' });
        });
      }
    }

    // Config Screen
    function renderConfigScreen() {
      return \`
        <div class="config-screen">
          <div class="config-card">
            <h2>🔗 התחבר ל-Qlik Cloud</h2>
            <p>הזן את פרטי החיבור כדי להתחיל לבנות מודלים</p>

            <div id="configError"></div>

            <div class="form-group">
              <label>כתובת Tenant</label>
              <input
                type="url"
                id="tenantUrl"
                class="form-input"
                placeholder="https://iyil7lpmybpzhbm.de.qlikcloud.com"
                value="\${state.tenantUrl || 'https://iyil7lpmybpzhbm.de.qlikcloud.com'}"
              />
              <p class="form-hint">הכתובת של סביבת ה-Qlik Cloud שלך</p>
            </div>

            <div class="form-group">
              <label>API Key</label>
              <input
                type="password"
                id="apiKey"
                class="form-input"
                placeholder="eyJhbGciOiJFUzM4NCIs..."
              />
              <p class="form-hint">
                <a href="https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Admin/mc-generate-api-keys.htm" target="_blank">
                  איך מייצרים API Key?
                </a>
              </p>
            </div>

            <button class="btn btn-primary" id="btnConnect" style="width: 100%; justify-content: center;">
              התחבר
            </button>

            <div style="text-align: center; margin-top: 16px;">
              <span style="color: var(--text-secondary); font-size: 12px;">או</span>
            </div>

            <button class="btn btn-outline" id="btnSkipConnection" style="width: 100%; justify-content: center; margin-top: 8px;">
              ⏭️ דלג - עבוד במצב לא מקוון
            </button>
          </div>
        </div>
      \`;
    }

    function connect() {
      const tenantUrl = document.getElementById('tenantUrl').value.trim();
      const apiKey = document.getElementById('apiKey').value.trim();

      if (!tenantUrl || !apiKey) {
        showConfigError('נא למלא את כל השדות');
        return;
      }

      // Show loading state
      const btn = document.getElementById('btnConnect');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="btn-spinner"></span> מתחבר...';
      }

      console.log('Connecting to:', tenantUrl);
      vscode.postMessage({ type: 'saveConfig', tenantUrl, apiKey });
    }

    function showConfigError(message) {
      const errorDiv = document.getElementById('configError');
      if (errorDiv) {
        errorDiv.innerHTML = \`<div class="error-message">\${message}</div>\`;
      }

      // Reset button
      const btn = document.getElementById('btnConnect');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'התחבר';
      }
    }


    // Dashboard Layout
    function renderDashboard() {
      return \`
        <header class="qmb-header">
          <h1>
            <div class="qmb-logo"></div>
            Qlik Model Builder
          </h1>
          <div class="connection-status" onclick="disconnect()">
            <span class="status-dot connected"></span>
            <span>\${extractTenantName(state.tenantUrl)}</span>
          </div>
        </header>

        <div class="qmb-main">
          <aside class="qmb-sidebar" id="sidebar">
            <div class="loading-text" style="padding: 20px; text-align: center;">טוען...</div>
          </aside>

          <main class="qmb-canvas" id="canvas">
            <div class="canvas-area">
              <div class="loading-text" style="text-align: center; padding: 40px;">טוען...</div>
            </div>
          </main>
        </div>
      \`;
    }

    function extractTenantName(url) {
      try {
        const hostname = new URL(url).hostname;
        return hostname.split('.')[0];
      } catch {
        return url;
      }
    }

    function disconnect() {
      if (confirm('האם לנתק מ-Qlik Cloud?')) {
        state.configured = false;
        state.tenantUrl = '';
        state.spaces = [];
        state.connections = [];
        state.selectedTables = [];
        render();
      }
    }

    // Sidebar Render
    function renderSidebar() {
      const sidebar = document.getElementById('sidebar');
      if (!sidebar) return;

      sidebar.innerHTML = \`
        <!-- Spaces Section -->
        <div class="sidebar-section">
          <div class="sidebar-header" onclick="toggleSection('spaces')">
            <h3>📁 איפה לשמור?</h3>
            <span class="chevron" id="chevron-spaces">▼</span>
          </div>
          <div class="sidebar-content" id="content-spaces">
            \${renderSpacesList()}
          </div>
        </div>

        <!-- Connections Section -->
        <div class="sidebar-section">
          <div class="sidebar-header" onclick="toggleSection('connections')">
            <h3>🔗 מאיפה הנתונים?</h3>
            <span class="chevron" id="chevron-connections">▼</span>
          </div>
          <div class="sidebar-content" id="content-connections">
            \${renderConnectionsList()}
          </div>
        </div>

        <!-- Tables Section -->
        <div class="sidebar-section" style="flex: 1; display: flex; flex-direction: column;">
          <div class="sidebar-header" onclick="toggleSection('tables')">
            <h3>📋 בחר טבלאות</h3>
            <span class="chevron" id="chevron-tables">▼</span>
          </div>
          <div class="search-box">
            <input
              type="text"
              class="search-input"
              placeholder="חפש טבלה..."
              oninput="filterTables(this.value)"
            />
          </div>
          <div class="sidebar-content" id="content-tables" style="flex: 1; max-height: none;">
            \${renderTablesList()}
          </div>
        </div>
      \`;
    }

    function renderSpacesList() {
      if (state.spaces.length === 0) {
        return '<div class="skeleton skeleton-item"></div>'.repeat(2);
      }

      return state.spaces.map(space => \`
        <div class="tree-item \${state.selectedSpace === space.id ? 'selected' : ''}"
             onclick="selectSpace('\${space.id}')">
          <span class="icon">📁</span>
          <span>\${space.name}</span>
        </div>
      \`).join('');
    }

    function renderConnectionsList() {
      if (state.connections.length === 0) {
        return '<div class="skeleton skeleton-item"></div>'.repeat(3);
      }

      return state.connections.map(conn => \`
        <div class="tree-item \${state.selectedConnection === conn.id ? 'selected' : ''}"
             onclick="selectConnection('\${conn.id}')">
          <span class="icon">\${conn.qType.includes('datafiles') ? '📄' : '🗄️'}</span>
          <span>\${conn.qName}</span>
        </div>
      \`).join('');
    }

    function renderTablesList() {
      if (!state.selectedConnection) {
        return '<div style="padding: 12px; color: var(--text-secondary); font-size: 13px;">בחר מקור נתונים קודם</div>';
      }

      // Show tables with field count
      const tablesHtml = state.tables.map((table, idx) => \`
        <div class="tree-item \${state.selectedTableIndex === idx ? 'selected' : ''}"
             onclick="selectTable(\${idx})">
          <span class="icon">📋</span>
          <span>\${table.name}</span>
          <span style="margin-right: auto; font-size: 11px; color: var(--text-secondary);">
            \${table.fields?.length || 0} שדות
          </span>
        </div>
      \`).join('');

      return \`
        <!-- Upload Spec Button -->
        <div style="padding: 8px 12px; border-bottom: 1px solid var(--border-color);">
          <button class="btn btn-outline" style="width: 100%; justify-content: center;" onclick="uploadSpec()">
            📄 העלה קובץ איפיון
          </button>
          <p style="font-size: 10px; color: var(--text-secondary); margin-top: 4px; text-align: center;">
            Excel, Word, PDF, JSON
          </p>
        </div>

        \${tablesHtml}

        \${state.tables.length === 0 ? \`
          <div style="padding: 20px; text-align: center; color: var(--text-secondary);">
            <p style="font-size: 13px;">אין טבלאות</p>
            <p style="font-size: 11px; margin-top: 4px;">העלה קובץ איפיון או הוסף ידנית</p>
          </div>
        \` : ''}

        <!-- Add Manual Table -->
        <div style="padding: 8px 12px; border-top: 1px solid var(--border-color);">
          <div style="display: flex; gap: 8px;">
            <input
              type="text"
              id="newTableName"
              class="search-input"
              placeholder="שם טבלה..."
              style="flex: 1;"
              onkeypress="if(event.key==='Enter') addTableManual()"
            />
            <button class="btn btn-primary" style="padding: 8px 12px;" onclick="addTableManual()">+</button>
          </div>
        </div>
      \`;
    }

    function uploadSpec() {
      vscode.postMessage({ type: 'uploadSpec' });
    }

    function addTableManual() {
      const input = document.getElementById('newTableName');
      if (input && input.value.trim()) {
        const tableName = input.value.trim();
        if (!state.tables.find(t => t.name === tableName)) {
          state.tables.push({
            name: tableName,
            fields: [],
            incremental: { enabled: false, field: '', strategy: 'full' }
          });
          state.selectedTableIndex = state.tables.length - 1;
          renderSidebar();
          renderCanvas();
        }
        input.value = '';
      }
    }

    function selectTable(idx) {
      state.selectedTableIndex = idx;
      renderSidebar();
      renderCanvas();
    }

    // Actions
    function selectSpace(id) {
      state.selectedSpace = id;
      renderSidebar();
      renderCanvas();
    }

    function selectConnection(id) {
      state.selectedConnection = id;
      renderSidebar();
      renderCanvas();
    }

    function removeTable(idx) {
      state.tables.splice(idx, 1);
      if (state.selectedTableIndex >= state.tables.length) {
        state.selectedTableIndex = state.tables.length > 0 ? state.tables.length - 1 : null;
      }
      renderSidebar();
      renderCanvas();
    }

    function toggleSection(id) {
      const content = document.getElementById('content-' + id);
      const chevron = document.getElementById('chevron-' + id);
      if (content && chevron) {
        content.classList.toggle('collapsed');
        chevron.classList.toggle('collapsed');
      }
    }

    function filterTables(query) {
      // TODO: Implement table filtering
    }

    // Canvas Render
    function renderCanvas() {
      const canvas = document.getElementById('canvas');
      if (!canvas) return;

      const selectedSpace = state.spaces.find(s => s.id === state.selectedSpace);
      const selectedConn = state.connections.find(c => c.id === state.selectedConnection);
      const selectedTable = state.selectedTableIndex !== null ? state.tables[state.selectedTableIndex] : null;

      canvas.innerHTML = \`
        <div class="canvas-area">
          <!-- Selection Summary -->
          <div class="selection-summary">
            <div class="summary-header">
              <h2>📊 סיכום</h2>
              <div class="summary-stats">
                <div class="stat-item">
                  <div class="stat-value">\${state.tables.length}</div>
                  <div class="stat-label">טבלאות</div>
                </div>
                <div class="stat-item">
                  <div class="stat-value">\${state.tables.reduce((sum, t) => sum + (t.fields?.length || 0), 0)}</div>
                  <div class="stat-label">שדות</div>
                </div>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">📁 Space</div>
                <div style="font-weight: 500;">\${selectedSpace?.name || 'לא נבחר'}</div>
              </div>
              <div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">🔗 מקור נתונים</div>
                <div style="font-weight: 500;">\${selectedConn?.qName || 'לא נבחר'}</div>
              </div>
            </div>
          </div>

          \${selectedTable ? renderTableEditor(selectedTable, state.selectedTableIndex) : renderEmptyCanvas()}

          \${state.generatedScript ? \`
            <div class="script-preview">
              <div class="script-header">
                <h3>📜 סקריפט QVS</h3>
                <button class="btn btn-outline" onclick="copyScript()">העתק</button>
              </div>
              <div class="script-content">
                <pre>\${state.generatedScript}</pre>
              </div>
            </div>
          \` : ''}
        </div>

        <div class="action-bar">
          <div class="action-info">
            \${state.tables.length > 0
              ? \`<strong>\${state.tables.length}</strong> טבלאות מוכנות\`
              : 'העלה קובץ איפיון או הוסף טבלאות'}
          </div>
          <div class="action-buttons">
            <button class="btn btn-outline" onclick="generateScript()">
              📜 צור סקריפט
            </button>
            <button class="btn btn-primary" onclick="deployToQlik()">
              🚀 Deploy ל-Qlik
            </button>
          </div>
        </div>
      \`;
    }

    function renderEmptyCanvas() {
      return \`
        <div class="empty-state" style="padding: 40px; text-align: center;">
          <div style="font-size: 48px; margin-bottom: 16px;">📋</div>
          <h3 style="margin-bottom: 8px;">\${!state.selectedConnection ? 'בחר מקור נתונים' : 'הוסף טבלאות'}</h3>
          <p style="color: var(--text-secondary);">
            \${!state.selectedConnection
              ? 'בחר Connection מהרשימה בצד ימין'
              : 'העלה קובץ איפיון או הוסף טבלאות ידנית'}
          </p>
        </div>
      \`;
    }

    function renderTableEditor(table, idx) {
      return \`
        <div class="selection-summary" style="margin-top: 16px;">
          <div class="summary-header">
            <h2>📋 \${table.name}</h2>
            <button class="btn btn-outline" style="padding: 4px 8px; font-size: 12px;" onclick="removeTable(\${idx})">
              🗑️ מחק
            </button>
          </div>

          <!-- Fields Section -->
          <div style="margin-top: 16px;">
            <h3 style="font-size: 14px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
              📊 שדות
              <span style="font-size: 11px; color: var(--text-secondary);">(\${table.fields?.length || 0})</span>
            </h3>

            \${table.fields && table.fields.length > 0 ? \`
              <div style="display: flex; flex-direction: column; gap: 8px;">
                \${table.fields.map((field, fIdx) => \`
                  <div style="display: flex; align-items: center; gap: 12px; padding: 8px; background: var(--bg-primary); border-radius: 6px;">
                    <input type="checkbox" \${field.include !== false ? 'checked' : ''} onchange="toggleField(\${idx}, \${fIdx})" />
                    <span style="flex: 1; font-weight: 500;">\${field.name}</span>
                    <select style="padding: 4px 8px; border-radius: 4px; background: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-primary);"
                            onchange="setFieldType(\${idx}, \${fIdx}, this.value)">
                      <option value="Text" \${field.type === 'Text' ? 'selected' : ''}>Text</option>
                      <option value="Number" \${field.type === 'Number' ? 'selected' : ''}>Number</option>
                      <option value="Date" \${field.type === 'Date' ? 'selected' : ''}>Date</option>
                      <option value="Timestamp" \${field.type === 'Timestamp' ? 'selected' : ''}>Timestamp</option>
                    </select>
                  </div>
                \`).join('')}
              </div>
            \` : \`
              <div style="padding: 16px; text-align: center; color: var(--text-secondary); background: var(--bg-primary); border-radius: 6px;">
                <p>אין שדות. הוסף ידנית או העלה קובץ איפיון.</p>
              </div>
            \`}

            <!-- Add Field -->
            <div style="display: flex; gap: 8px; margin-top: 12px;">
              <input type="text" id="newFieldName" class="search-input" placeholder="שם שדה..." style="flex: 1;"
                     onkeypress="if(event.key==='Enter') addField(\${idx})" />
              <select id="newFieldType" style="padding: 8px; border-radius: 6px; background: var(--bg-primary); border: 1px solid var(--border-color); color: var(--text-primary);">
                <option value="Text">Text</option>
                <option value="Number">Number</option>
                <option value="Date">Date</option>
                <option value="Timestamp">Timestamp</option>
              </select>
              <button class="btn btn-primary" style="padding: 8px 12px;" onclick="addField(\${idx})">+</button>
            </div>
          </div>

          <!-- Incremental Load Section -->
          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border-color);">
            <h3 style="font-size: 14px; margin-bottom: 12px;">⚡ Incremental Load</h3>

            <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
              <input type="checkbox" \${table.incremental?.enabled ? 'checked' : ''} onchange="toggleIncremental(\${idx})" />
              <span>הפעל Incremental Load</span>
            </label>

            \${table.incremental?.enabled ? \`
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div>
                  <label style="font-size: 12px; color: var(--text-secondary); display: block; margin-bottom: 4px;">שדה מפתח</label>
                  <select style="width: 100%; padding: 8px; border-radius: 6px; background: var(--bg-primary); border: 1px solid var(--border-color); color: var(--text-primary);"
                          onchange="setIncrementalField(\${idx}, this.value)">
                    <option value="">בחר שדה...</option>
                    \${(table.fields || []).map(f => \`
                      <option value="\${f.name}" \${table.incremental?.field === f.name ? 'selected' : ''}>\${f.name}</option>
                    \`).join('')}
                  </select>
                </div>
                <div>
                  <label style="font-size: 12px; color: var(--text-secondary); display: block; margin-bottom: 4px;">אסטרטגיה</label>
                  <select style="width: 100%; padding: 8px; border-radius: 6px; background: var(--bg-primary); border: 1px solid var(--border-color); color: var(--text-primary);"
                          onchange="setIncrementalStrategy(\${idx}, this.value)">
                    <option value="insert_only" \${table.incremental?.strategy === 'insert_only' ? 'selected' : ''}>Insert Only</option>
                    <option value="insert_update" \${table.incremental?.strategy === 'insert_update' ? 'selected' : ''}>Insert + Update</option>
                    <option value="time_window" \${table.incremental?.strategy === 'time_window' ? 'selected' : ''}>Time Window</option>
                  </select>
                </div>
              </div>
            \` : ''}
          </div>
        </div>
      \`;
    }

    function addField(tableIdx) {
      const nameInput = document.getElementById('newFieldName');
      const typeSelect = document.getElementById('newFieldType');
      if (nameInput && nameInput.value.trim()) {
        const table = state.tables[tableIdx];
        if (!table.fields) table.fields = [];
        table.fields.push({
          name: nameInput.value.trim(),
          type: typeSelect?.value || 'Text',
          include: true
        });
        nameInput.value = '';
        renderCanvas();
      }
    }

    function toggleField(tableIdx, fieldIdx) {
      const field = state.tables[tableIdx].fields[fieldIdx];
      field.include = !field.include;
      renderCanvas();
    }

    function setFieldType(tableIdx, fieldIdx, type) {
      state.tables[tableIdx].fields[fieldIdx].type = type;
    }

    function toggleIncremental(tableIdx) {
      const table = state.tables[tableIdx];
      if (!table.incremental) {
        table.incremental = { enabled: false, field: '', strategy: 'insert_only' };
      }
      table.incremental.enabled = !table.incremental.enabled;
      renderCanvas();
    }

    function setIncrementalField(tableIdx, field) {
      state.tables[tableIdx].incremental.field = field;
    }

    function setIncrementalStrategy(tableIdx, strategy) {
      state.tables[tableIdx].incremental.strategy = strategy;
    }

    function generateScript() {
      // Send only table names that have at least one included field
      const selectedTables = state.tables
        .filter(t => t.fields && t.fields.some(f => f.include))
        .map(t => t.name);

      if (selectedTables.length === 0) {
        vscode.postMessage({ type: 'showError', text: 'נא לבחור לפחות טבלה אחת עם שדות' });
        return;
      }

      console.log('Generating script for tables:', selectedTables);
      vscode.postMessage({ type: 'generateScript', tables: selectedTables });
    }

    function copyScript() {
      navigator.clipboard.writeText(state.generatedScript);
      vscode.postMessage({ type: 'showInfo', text: 'הסקריפט הועתק!' });
    }

    function deployToQlik() {
      if (state.tables.length === 0) {
        vscode.postMessage({ type: 'showError', text: 'נא להוסיף טבלאות לפני Deploy' });
        return;
      }
      if (!state.generatedScript) {
        // Generate script first
        generateScript();
      }
      vscode.postMessage({ type: 'showInfo', text: 'Deploy ל-Qlik יתווסף בגרסה הבאה' });
    }

    // Spec File Handling
    function showSpecLoading(fileName) {
      const tablesContent = document.getElementById('content-tables');
      if (tablesContent) {
        const existingContent = tablesContent.innerHTML;
        tablesContent.innerHTML = \`
          <div id="specLoadingOverlay" style="padding: 20px; text-align: center;">
            <div class="loader" style="margin: 0 auto 12px;"></div>
            <p style="font-size: 13px;">מפענח: \${fileName}</p>
          </div>
        \` + existingContent;
      }
    }

    function hideSpecLoading() {
      const overlay = document.getElementById('specLoadingOverlay');
      if (overlay) overlay.remove();
    }

    function handleSpecParsed(tables, source, warnings) {
      hideSpecLoading();

      // Merge with existing tables or replace
      if (tables && tables.length > 0) {
        // Add new tables, avoid duplicates
        for (const newTable of tables) {
          const existingIdx = state.tables.findIndex(t => t.name === newTable.name);
          if (existingIdx >= 0) {
            // Update existing table
            state.tables[existingIdx] = newTable;
          } else {
            // Add new table
            state.tables.push(newTable);
          }
        }

        // Select first new table
        state.selectedTableIndex = state.tables.length - tables.length;

        renderSidebar();
        renderCanvas();

        // Show warnings if any
        if (warnings && warnings.length > 0) {
          console.warn('Spec parsing warnings:', warnings);
        }
      }
    }
  `;
}
