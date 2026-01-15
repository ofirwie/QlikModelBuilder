/**
 * QlikModelBuilder - Script Generator
 * Generates Qlik load scripts from project configuration
 */

import {
  ProjectState,
  TableConfig,
  IncrementalConfig,
  ScriptGenerationOptions,
  DataSourceType,
} from './types.js';

const DEFAULT_OPTIONS: ScriptGenerationOptions = {
  includeComments: true,
  commentLanguage: 'en',
  useVariables: true,
  createQvdFolder: true,
};

/**
 * ScriptGenerator - Generates Qlik load scripts
 */
export class ScriptGenerator {
  /**
   * Generate complete script from project state
   */
  generate(state: ProjectState, options?: Partial<ScriptGenerationOptions>): string {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const sections: string[] = [];

    // Header
    sections.push(this.generateHeader(state, opts));

    // Variables section
    if (opts.useVariables) {
      sections.push(this.generateVariables(state, opts));
    }

    // Connection section
    if (state.connection) {
      sections.push(this.generateConnection(state, opts));
    }

    // Tables - separate incremental and full reload
    const incrementalTables = state.tables.filter(
      (t) => t.incremental?.strategy !== 'none'
    );
    const fullReloadTables = state.tables.filter(
      (t) => t.incremental?.strategy === 'none'
    );

    // Incremental tables first
    if (incrementalTables.length > 0) {
      sections.push(this.generateIncrementalSection(incrementalTables, state, opts));
    }

    // Full reload tables
    if (fullReloadTables.length > 0) {
      sections.push(this.generateFullReloadSection(fullReloadTables, state, opts));
    }

    return sections.join('\n\n');
  }

  /**
   * Generate script header
   */
  private generateHeader(state: ProjectState, opts: ScriptGenerationOptions): string {
    const now = new Date().toISOString().split('T')[0];
    const lines = [
      '//=============================================================',
      `// Project: ${state.name || 'Untitled Project'}`,
      `// Created: ${now} by QlikModelBuilder`,
    ];

    if (state.description) {
      lines.push(`// Description: ${state.description}`);
    }

    if (state.connection) {
      lines.push(`// Source: ${state.connection.type}`);
    }

    lines.push('//=============================================================');

    return lines.join('\n');
  }

  /**
   * Generate variables section
   */
  private generateVariables(state: ProjectState, opts: ScriptGenerationOptions): string {
    const lines = [
      this.sectionComment('Variables & Configuration', opts),
      "SET vLoadDate = Today();",
      `SET vQVDPath = 'lib://QVD_Storage/${state.name || 'Project'}/';`,
    ];

    // Add incremental-specific variables
    const hasTimeWindow = state.tables.some(
      (t) => t.incremental?.strategy === 'time_window'
    );
    if (hasTimeWindow) {
      lines.push('SET vIncrementalDays = 7;');
    }

    // Check for tables with by_date strategy
    const hasDateIncremental = state.tables.some(
      (t) => t.incremental?.strategy === 'by_date'
    );
    if (hasDateIncremental) {
      lines.push("SET vMaxDate = '1900-01-01';");
    }

    return lines.join('\n');
  }

  /**
   * Generate connection section
   */
  private generateConnection(state: ProjectState, opts: ScriptGenerationOptions): string {
    const conn = state.connection!;
    const lines = [
      this.sectionComment('Data Connection', opts),
    ];

    if (conn.id) {
      lines.push(`LIB CONNECT TO '${conn.name}';`);
    } else {
      // For new connections, generate connection string based on type
      lines.push(`// Connection: ${conn.name} (${conn.type})`);
      lines.push(`// Note: Create this connection in Qlik Cloud before running`);
      lines.push(`LIB CONNECT TO '${conn.name}';`);
    }

    return lines.join('\n');
  }

  /**
   * Generate incremental load section
   */
  private generateIncrementalSection(
    tables: TableConfig[],
    state: ProjectState,
    opts: ScriptGenerationOptions
  ): string {
    const lines = [
      this.sectionComment('Incremental Load Tables', opts),
    ];

    for (const table of tables) {
      lines.push(this.generateIncrementalTable(table, state, opts));
    }

    return lines.join('\n\n');
  }

  /**
   * Generate full reload section
   */
  private generateFullReloadSection(
    tables: TableConfig[],
    state: ProjectState,
    opts: ScriptGenerationOptions
  ): string {
    const lines = [
      this.sectionComment('Full Reload Tables', opts),
    ];

    for (const table of tables) {
      lines.push(this.generateFullReloadTable(table, state, opts));
    }

    return lines.join('\n\n');
  }

  /**
   * Generate incremental table script
   */
  private generateIncrementalTable(
    table: TableConfig,
    state: ProjectState,
    opts: ScriptGenerationOptions
  ): string {
    const inc = table.incremental;
    const tableName = table.alias || table.name;
    const fields = table.fields.filter((f) => f.include);
    const fieldList = fields.map((f) => f.alias ? `${f.name} AS [${f.alias}]` : f.name).join(',\n    ');

    const lines: string[] = [];

    // Table comment
    lines.push(this.tableComment(table, opts));

    // Generate based on strategy
    switch (inc.strategy) {
      case 'by_date':
        lines.push(this.generateByDateIncremental(table, tableName, fieldList, state, opts));
        break;
      case 'by_id':
        lines.push(this.generateByIdIncremental(table, tableName, fieldList, state, opts));
        break;
      case 'time_window':
        lines.push(this.generateTimeWindowIncremental(table, tableName, fieldList, state, opts));
        break;
      case 'custom':
        lines.push(this.generateCustomIncremental(table, tableName, fieldList, state, opts));
        break;
    }

    return lines.join('\n');
  }

  /**
   * Generate by-date incremental load
   */
  private generateByDateIncremental(
    table: TableConfig,
    tableName: string,
    fieldList: string,
    state: ProjectState,
    opts: ScriptGenerationOptions
  ): string {
    const inc = table.incremental;
    const qvdPath = `$(vQVDPath)${tableName}.qvd`;

    return `// Load existing QVD (if exists)
IF FileSize('${qvdPath}') > 0 THEN
    ${tableName}_Existing:
    LOAD * FROM [${qvdPath}] (qvd);

    LET vMaxDate = Peek('${inc.field}', -1, '${tableName}_Existing');
END IF

// Load new records from source
${tableName}_New:
LOAD
    ${fieldList}
FROM [lib://${state.connection?.name}/${table.schema ? table.schema + '.' : ''}${table.name}]
WHERE ${inc.field} > '$(vMaxDate)';

// Concatenate and store
${tableName}:
LOAD * RESIDENT ${tableName}_Existing WHERE 1=1;
CONCATENATE LOAD * RESIDENT ${tableName}_New;

DROP TABLES ${tableName}_Existing, ${tableName}_New;

STORE ${tableName} INTO [${qvdPath}] (qvd);`;
  }

  /**
   * Generate by-ID incremental load
   */
  private generateByIdIncremental(
    table: TableConfig,
    tableName: string,
    fieldList: string,
    state: ProjectState,
    opts: ScriptGenerationOptions
  ): string {
    const inc = table.incremental;
    const qvdPath = `$(vQVDPath)${tableName}.qvd`;

    return `// Load existing QVD (if exists)
LET vMaxId = 0;
IF FileSize('${qvdPath}') > 0 THEN
    ${tableName}_Existing:
    LOAD * FROM [${qvdPath}] (qvd);

    LET vMaxId = Peek('${inc.field}', -1, '${tableName}_Existing');
END IF

// Load new records from source
${tableName}_New:
LOAD
    ${fieldList}
FROM [lib://${state.connection?.name}/${table.schema ? table.schema + '.' : ''}${table.name}]
WHERE ${inc.field} > $(vMaxId);

// Concatenate and store
${tableName}:
LOAD * RESIDENT ${tableName}_Existing WHERE 1=1;
CONCATENATE LOAD * RESIDENT ${tableName}_New;

DROP TABLES ${tableName}_Existing, ${tableName}_New;

STORE ${tableName} INTO [${qvdPath}] (qvd);`;
  }

  /**
   * Generate time window incremental load
   */
  private generateTimeWindowIncremental(
    table: TableConfig,
    tableName: string,
    fieldList: string,
    state: ProjectState,
    opts: ScriptGenerationOptions
  ): string {
    const inc = table.incremental;
    const windowDays = inc.windowSize || 7;
    const qvdPath = `$(vQVDPath)${tableName}.qvd`;
    const dateField = inc.field || 'ModifiedDate';

    return `// Load last ${windowDays} days from source
${tableName}:
LOAD
    ${fieldList}
FROM [lib://${state.connection?.name}/${table.schema ? table.schema + '.' : ''}${table.name}]
WHERE ${dateField} >= Today() - ${windowDays};

STORE ${tableName} INTO [${qvdPath}] (qvd);`;
  }

  /**
   * Generate custom incremental load
   */
  private generateCustomIncremental(
    table: TableConfig,
    tableName: string,
    fieldList: string,
    state: ProjectState,
    opts: ScriptGenerationOptions
  ): string {
    const inc = table.incremental;
    const qvdPath = `$(vQVDPath)${tableName}.qvd`;

    if (inc.customLogic) {
      return inc.customLogic
        .replace(/\$\{tableName\}/g, tableName)
        .replace(/\$\{fieldList\}/g, fieldList)
        .replace(/\$\{qvdPath\}/g, qvdPath);
    }

    return `// Custom incremental logic for ${tableName}
// TODO: Define custom logic
${tableName}:
LOAD
    ${fieldList}
FROM [lib://${state.connection?.name}/${table.schema ? table.schema + '.' : ''}${table.name}];

STORE ${tableName} INTO [${qvdPath}] (qvd);`;
  }

  /**
   * Generate full reload table script
   */
  private generateFullReloadTable(
    table: TableConfig,
    state: ProjectState,
    opts: ScriptGenerationOptions
  ): string {
    const tableName = table.alias || table.name;
    const fields = table.fields.filter((f) => f.include);
    const fieldList = fields.length > 0
      ? fields.map((f) => f.alias ? `${f.name} AS [${f.alias}]` : f.name).join(',\n    ')
      : '*';
    const qvdPath = `$(vQVDPath)${tableName}.qvd`;

    const lines: string[] = [];

    // Table comment
    lines.push(this.tableComment(table, opts));

    // Load statement
    lines.push(`${tableName}:`);
    lines.push('LOAD');
    lines.push(`    ${fieldList}`);
    lines.push(`FROM [lib://${state.connection?.name}/${table.schema ? table.schema + '.' : ''}${table.name}];`);
    lines.push('');
    lines.push(`STORE ${tableName} INTO [${qvdPath}] (qvd);`);

    return lines.join('\n');
  }

  /**
   * Generate section comment
   */
  private sectionComment(title: string, opts: ScriptGenerationOptions): string {
    if (!opts.includeComments) return '';
    return `//-------------------------------------------------------------
// ${title}
//-------------------------------------------------------------`;
  }

  /**
   * Generate table comment
   */
  private tableComment(table: TableConfig, opts: ScriptGenerationOptions): string {
    if (!opts.includeComments) return '';

    const inc = table.incremental;
    const lines = [
      `// Table: ${table.name}`,
    ];

    if (inc.strategy !== 'none') {
      const strategyDesc = {
        'by_date': `By date field (${inc.field})`,
        'by_id': `By ID field (${inc.field})`,
        'time_window': `Last ${inc.windowSize || 7} ${inc.windowUnit || 'days'}`,
        'custom': 'Custom logic',
        'none': 'Full Reload',
      };
      lines.push(`// Strategy: ${strategyDesc[inc.strategy]}`);
    } else {
      lines.push('// Strategy: Full Reload');
    }

    const includedFields = table.fields.filter((f) => f.include);
    if (includedFields.length > 0 && includedFields.length <= 5) {
      lines.push(`// Fields: ${includedFields.map((f) => f.name).join(', ')}`);
    } else if (includedFields.length > 5) {
      lines.push(`// Fields: ${includedFields.length} fields`);
    }

    return lines.join('\n');
  }
}
