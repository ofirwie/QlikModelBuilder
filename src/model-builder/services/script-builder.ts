/**
 * @fileoverview Script Builder Service for Model Builder
 * @module model-builder/services/script-builder
 *
 * Generates Qlik Load Scripts in staged increments (A-F) with
 * support for all model types (star, snowflake, link table, concatenated).
 */

import {
  BuildStage,
  BuildContext,
  BuildConfig,
  StageScript,
  ScriptValidationResult,
  EnrichedTable,
  EnrichedField,
  DateFieldInfo,
  TableClassification,
} from '../types.js';
import { AnalysisResult, TableClassificationResult } from './analyzer.js';
import { Logger } from './logger.js';

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Error for build context issues
 */
export class BuildContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BuildContextError';
  }
}

// ============================================================================
// Constants
// ============================================================================

const STAGE_ORDER: BuildStage[] = ['A', 'B', 'C', 'D', 'E', 'F'];

/** Hebrew month names */
const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

/** English month abbreviations */
const ENGLISH_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// ============================================================================
// Script Builder Class
// ============================================================================

/**
 * Script Builder implementation
 */
export class ScriptBuilder {
  private logger?: Logger;

  constructor(logger?: Logger) {
    this.logger = logger;
  }

  // ==========================================================================
  // Public Methods - Stage Building
  // ==========================================================================

  /**
   * Build a specific stage
   */
  buildStage(stage: BuildStage, context: BuildContext): StageScript {
    this.validateContext(context);

    this.logger?.info('script_builder', 'building_stage', {
      stage,
      project: context.config.project_name,
    });

    switch (stage) {
      case 'A':
        return this.buildStageA(context);
      case 'B':
        return this.buildStageB(context);
      case 'C':
        return this.buildStageC(context);
      case 'D':
        return this.buildStageD(context);
      case 'E':
        return this.buildStageE(context);
      case 'F':
        return this.buildStageF(context);
      default:
        throw new BuildContextError(`Unknown stage: ${stage}`);
    }
  }

  /**
   * Assemble full script from approved stages
   */
  assembleFullScript(approvedStages: Partial<Record<BuildStage, string>>): string {
    const sections: string[] = [];

    for (const stage of STAGE_ORDER) {
      const script = approvedStages[stage];
      if (script) {
        sections.push(script);
        sections.push(''); // Empty line between stages
      }
    }

    return sections.join('\n').trim();
  }

  // ==========================================================================
  // Public Methods - Table Building
  // ==========================================================================

  /**
   * Build a dimension table script
   */
  buildDimensionTable(table: EnrichedTable, qvdPath: string): string {
    const tableName = this.formatTableName(table.name, 'dimension');
    const pkField = table.fields.find(f => f.is_key_candidate);

    const fieldLines = table.fields.map((f, idx) => {
      const isLast = idx === table.fields.length - 1;
      const comma = isLast ? '' : ',';

      if (f.is_key_candidate) {
        const keyName = this.convertIdToKey(f.name);
        return `    ${this.escapeFieldName(f.name)} AS ${keyName}${comma}    // PK`;
      }

      return `    ${this.escapeFieldName(f.name)}${comma}`;
    });

    return `
// ${tableName}
${tableName}:
LOAD
${fieldLines.join('\n')}
FROM [\$(vPathQVD)${table.source_name}] (qvd);
`.trim();
  }

  /**
   * Build a fact table script
   */
  buildFactTable(
    table: EnrichedTable,
    dimensions: EnrichedTable[],
    qvdPath: string
  ): string {
    const tableName = this.formatTableName(table.name, 'fact');

    // Build dimension key lookup map
    const dimKeys = this.buildDimensionKeyMap(dimensions);

    const fieldLines = table.fields.map((f, idx) => {
      const isLast = idx === table.fields.length - 1;
      const comma = isLast ? '' : ',';
      const fieldLower = f.name.toLowerCase();

      // Check if this is a FK to a dimension
      const matchedKey = dimKeys.get(fieldLower);
      if (matchedKey) {
        return `    ${this.escapeFieldName(f.name)} AS ${matchedKey}${comma}    // FK to DIM`;
      }

      // PK for the fact table
      if (f.is_key_candidate) {
        const keyName = this.convertIdToKey(f.name);
        return `    ${this.escapeFieldName(f.name)} AS ${keyName}${comma}`;
      }

      return `    ${this.escapeFieldName(f.name)}${comma}`;
    });

    return `
// ${tableName}
${tableName}:
LOAD
${fieldLines.join('\n')}
FROM [\$(vPathQVD)${table.source_name}] (qvd);
`.trim();
  }

  /**
   * Build a link table script
   */
  buildLinkTable(facts: EnrichedTable[], linkFields: string[], useAutonumber: boolean): string {
    if (linkFields.length === 0) {
      return '// No common fields found for Link Table';
    }

    const fieldList = linkFields.map(f => this.escapeFieldName(f)).join(', ');

    const unionParts = facts.map((fact, idx) => {
      const factTableName = this.formatTableName(fact.name, 'fact');
      const prefix = idx === 0 ? '' : 'Concatenate(LINK_Facts)\n';
      return `${prefix}LOAD DISTINCT ${fieldList} RESIDENT ${factTableName};`;
    });

    const linkKeyExpr = useAutonumber
      ? 'AUTONUMBER(' + linkFields.map(f => this.escapeFieldName(f)).join(" & '|' & ") + ') AS LinkKey'
      : linkFields.map(f => this.escapeFieldName(f)).join(" & '|' & ") + ' AS LinkKey';

    return `
// Link Table connecting Facts
LINK_Facts_Temp:
${unionParts.join('\n\n')}

// Add link key
LINK_Facts:
LOAD
    ${linkKeyExpr},
    *
RESIDENT LINK_Facts_Temp;

DROP TABLE LINK_Facts_Temp;
`.trim();
  }

  /**
   * Build a calendar script for a date field
   */
  buildCalendar(dateField: DateFieldInfo, language: 'EN' | 'HE'): string {
    const fieldName = dateField.field_name;
    return `CALL CreateMasterCalendar('${fieldName}', Num(MakeDate(2020,1,1)), Num(MakeDate(2030,12,31)));`;
  }

  // ==========================================================================
  // Public Methods - Validation
  // ==========================================================================

  /**
   * Validate a generated script
   */
  validateScript(script: string): ScriptValidationResult {
    const errors: ScriptValidationResult['errors'] = [];
    const warnings: ScriptValidationResult['warnings'] = [];
    const lines = script.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Check for LOAD *
      if (/\bLOAD\s+\*/i.test(line)) {
        warnings.push({
          line: lineNum,
          message: 'LOAD * detected - consider selecting specific fields',
          code: 'LOAD_STAR',
        });
      }

      // Check for unclosed brackets
      const openBrackets = (line.match(/\[/g) || []).length;
      const closeBrackets = (line.match(/\]/g) || []).length;
      if (openBrackets !== closeBrackets) {
        errors.push({
          line: lineNum,
          message: 'Mismatched brackets',
          code: 'BRACKET_MISMATCH',
        });
      }

      // Check for missing semicolon after statements
      if (/\b(LOAD|FROM|STORE|DROP TABLE|RENAME TABLE)\b/i.test(line)) {
        const isStatementEnd = line.trim().endsWith(';') ||
          line.trim().endsWith(':') ||
          line.trim().startsWith('//') ||
          line.trim() === '';

        // Check if next non-empty line starts a new statement
        let nextLine = '';
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].trim() !== '') {
            nextLine = lines[j].trim();
            break;
          }
        }

        const nextIsNewStatement = /^(LOAD|FROM|STORE|DROP|RENAME|QUALIFY|UNQUALIFY|SET|LET|SUB|END SUB|CALL|\/\/|[A-Z_]+:)/i.test(nextLine);

        if (!isStatementEnd && !nextIsNewStatement && !line.includes('LOAD')) {
          // This is complex to detect accurately, skip for now
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ==========================================================================
  // Private Methods - Stage Builders
  // ==========================================================================

  private buildStageA(context: BuildContext): StageScript {
    const { config, analysis } = context;
    const date = new Date().toISOString().split('T')[0];
    const modelType = analysis.model_recommendation.recommended_model;

    const script = `
//=============================================================
// Project: ${config.project_name}
// Created: ${date} by QlikModelBuilder
// Model Type: ${modelType}
//=============================================================

//-------------------------------------------------------------
// SECTION 0: QUALIFY ALL (Synthetic Key Prevention)
//-------------------------------------------------------------
QUALIFY *;

//-------------------------------------------------------------
// SECTION 1: Variables & Configuration
//-------------------------------------------------------------
SET vPathQVD = '${config.qvd_path}';
SET vPathDB = 'lib://DB/';
SET vReloadDate = Today();
SET vReloadTime = Now();
SET vCalendarLanguage = '${config.calendar_language}';
`.trim();

    this.logger?.debug('script_builder', 'stage_a_built', {
      lines: script.split('\n').length,
    });

    return {
      stage: 'A',
      script,
      tables_included: [],
      estimated_lines: script.split('\n').length,
    };
  }

  private buildStageB(context: BuildContext): StageScript {
    const dimensions = this.getTablesByClassification(context, 'dimension');

    const scripts: string[] = [
      '//-------------------------------------------------------------',
      '// SECTION 2: Dimensions',
      '//-------------------------------------------------------------',
      '',
    ];

    for (const dim of dimensions) {
      scripts.push(this.buildDimensionTable(dim, context.config.qvd_path));
      scripts.push('');
    }

    const script = scripts.join('\n').trim();

    this.logger?.debug('script_builder', 'stage_b_built', {
      dimension_count: dimensions.length,
    });

    return {
      stage: 'B',
      script,
      tables_included: dimensions.map(d => d.name),
      estimated_lines: script.split('\n').length,
    };
  }

  private buildStageC(context: BuildContext): StageScript {
    const facts = this.getTablesByClassification(context, 'fact');
    const dimensions = this.getTablesByClassification(context, 'dimension');

    const scripts: string[] = [
      '//-------------------------------------------------------------',
      '// SECTION 3: Facts',
      '//-------------------------------------------------------------',
      '',
    ];

    for (const fact of facts) {
      scripts.push(this.buildFactTable(fact, dimensions, context.config.qvd_path));
      scripts.push('');
    }

    const script = scripts.join('\n').trim();

    this.logger?.debug('script_builder', 'stage_c_built', {
      fact_count: facts.length,
    });

    return {
      stage: 'C',
      script,
      tables_included: facts.map(f => f.name),
      estimated_lines: script.split('\n').length,
    };
  }

  private buildStageD(context: BuildContext): StageScript {
    const { analysis, spec, config } = context;

    // Only needed for link_table model type
    if (analysis.model_recommendation.recommended_model !== 'link_table') {
      return {
        stage: 'D',
        script: '// No Link Tables needed for this model type',
        tables_included: [],
        estimated_lines: 1,
      };
    }

    const facts = this.getTablesByClassification(context, 'fact');

    // Find common fields between facts
    const commonFields = this.findCommonFields(facts);

    const scripts: string[] = [
      '//-------------------------------------------------------------',
      '// SECTION 4: Link Tables',
      '//-------------------------------------------------------------',
      '',
    ];

    if (commonFields.length > 0) {
      scripts.push(this.buildLinkTable(facts, commonFields, config.use_autonumber));
    } else {
      scripts.push('// No common fields found between fact tables');
    }

    const script = scripts.join('\n').trim();

    this.logger?.debug('script_builder', 'stage_d_built', {
      common_fields: commonFields.length,
    });

    return {
      stage: 'D',
      script,
      tables_included: commonFields.length > 0 ? ['LINK_Facts'] : [],
      estimated_lines: script.split('\n').length,
    };
  }

  private buildStageE(context: BuildContext): StageScript {
    const dateFields = context.spec.date_fields;
    const language = context.config.calendar_language;

    const scripts: string[] = [
      '//-------------------------------------------------------------',
      '// SECTION 5: Calendars (Per Date Field)',
      '//-------------------------------------------------------------',
      '',
      this.getCalendarSubroutine(language),
      '',
    ];

    for (const dateField of dateFields) {
      scripts.push(this.buildCalendar(dateField, language));
    }

    const script = scripts.join('\n').trim();

    this.logger?.debug('script_builder', 'stage_e_built', {
      calendar_count: dateFields.length,
    });

    return {
      stage: 'E',
      script,
      tables_included: dateFields.map(d => `DIM_${d.field_name}`),
      estimated_lines: script.split('\n').length,
    };
  }

  private buildStageF(context: BuildContext): StageScript {
    const dimensions = this.getTablesByClassification(context, 'dimension');
    const facts = this.getTablesByClassification(context, 'fact');
    const dateFields = context.spec.date_fields;

    const allTables = [
      ...dimensions.map(t => this.formatTableName(t.name, 'dimension')),
      ...facts.map(t => this.formatTableName(t.name, 'fact')),
      ...dateFields.map(d => `DIM_${d.field_name}`),
    ];

    // Add link table if present
    if (context.analysis.model_recommendation.recommended_model === 'link_table') {
      const commonFields = this.findCommonFields(facts);
      if (commonFields.length > 0) {
        allTables.push('LINK_Facts');
      }
    }

    // Collect all keys to unqualify
    const allKeys = this.collectAllKeys(context);

    const scripts: string[] = [
      '//-------------------------------------------------------------',
      '// SECTION 6: UNQUALIFY Keys Only',
      '//-------------------------------------------------------------',
    ];

    if (allKeys.length > 0) {
      scripts.push(`UNQUALIFY ${allKeys.join(', ')};`);
    }

    scripts.push('');
    scripts.push('//-------------------------------------------------------------');
    scripts.push('// SECTION 7: Store to Final QVD');
    scripts.push('//-------------------------------------------------------------');

    for (const tableName of allTables) {
      scripts.push(`STORE ${tableName} INTO [\$(vPathQVD)Final/${tableName}.qvd] (qvd);`);
    }

    const script = scripts.join('\n').trim();

    this.logger?.debug('script_builder', 'stage_f_built', {
      table_count: allTables.length,
      key_count: allKeys.length,
    });

    return {
      stage: 'F',
      script,
      tables_included: allTables,
      estimated_lines: script.split('\n').length,
    };
  }

  // ==========================================================================
  // Private Methods - Helpers
  // ==========================================================================

  private validateContext(context: BuildContext): void {
    if (!context.session) {
      throw new BuildContextError('BuildContext is missing session');
    }
    if (!context.spec) {
      throw new BuildContextError('BuildContext is missing spec');
    }
    if (!context.analysis) {
      throw new BuildContextError('BuildContext is missing analysis');
    }
    if (!context.config) {
      throw new BuildContextError('BuildContext is missing config');
    }
  }

  private getTablesByClassification(
    context: BuildContext,
    classification: TableClassification
  ): EnrichedTable[] {
    const result: EnrichedTable[] = [];

    for (const table of context.spec.tables) {
      const classResult = context.analysis.classifications.get(table.name);
      if (classResult?.classification === classification) {
        result.push(table);
      }
    }

    return result;
  }

  private formatTableName(name: string, type: 'dimension' | 'fact'): string {
    const prefix = type === 'dimension' ? 'DIM_' : 'FACT_';
    const cleanName = name
      .replace(/^(dim_|dimension_|fact_)/i, '')
      .replace(/[^a-zA-Z0-9_]/g, '_');
    return `${prefix}${cleanName}`;
  }

  private convertIdToKey(fieldName: string): string {
    // Replace ID suffix with Key, case-insensitive
    if (/ID$/i.test(fieldName)) {
      return fieldName.replace(/ID$/i, 'Key');
    }
    // If no ID suffix, just add Key
    return `${fieldName}Key`;
  }

  private escapeFieldName(name: string): string {
    // Qlik requires brackets for special characters or names starting with numbers
    if (/[\s\-\.\(\)\[\]\/\\]/.test(name) || /^\d/.test(name)) {
      return `[${name}]`;
    }
    return name;
  }

  private buildDimensionKeyMap(dimensions: EnrichedTable[]): Map<string, string> {
    const keyMap = new Map<string, string>();

    for (const dim of dimensions) {
      const pk = dim.fields.find(f => f.is_key_candidate);
      if (pk) {
        const keyName = this.convertIdToKey(pk.name);
        keyMap.set(pk.name.toLowerCase(), keyName);
      }
    }

    return keyMap;
  }

  private findCommonFields(tables: EnrichedTable[]): string[] {
    if (tables.length < 2) {
      return [];
    }

    // Get field names from first table
    const firstTableFields = new Set(tables[0].fields.map(f => f.name.toLowerCase()));

    // Find fields that exist in all tables
    const common: string[] = [];

    for (const fieldName of firstTableFields) {
      const existsInAll = tables.every(table =>
        table.fields.some(f => f.name.toLowerCase() === fieldName)
      );

      if (existsInAll) {
        // Get original field name from first table
        const originalField = tables[0].fields.find(
          f => f.name.toLowerCase() === fieldName
        );
        if (originalField) {
          common.push(originalField.name);
        }
      }
    }

    return common;
  }

  private collectAllKeys(context: BuildContext): string[] {
    const keys = new Set<string>();

    for (const table of context.spec.tables) {
      for (const field of table.fields) {
        if (field.is_key_candidate) {
          keys.add(this.convertIdToKey(field.name));
        }
      }
    }

    // Add LinkKey if link table model
    if (context.analysis.model_recommendation.recommended_model === 'link_table') {
      keys.add('LinkKey');
    }

    // Add calendar date field keys
    for (const dateField of context.spec.date_fields) {
      keys.add(dateField.field_name);
    }

    return [...keys];
  }

  private getCalendarSubroutine(language: 'EN' | 'HE'): string {
    const monthNames = language === 'HE'
      ? `Pick(Month(TempDate), '${HEBREW_MONTHS.join("','")}')`
      : `Pick(Month(TempDate), '${ENGLISH_MONTHS.join("','")}')`;

    return `
SUB CreateMasterCalendar(vFieldName, vMinDate, vMaxDate)

    TempCal_\$(vFieldName):
    LOAD
        Date(\$(vMinDate) + RowNo() - 1) AS TempDate
    AUTOGENERATE \$(vMaxDate) - \$(vMinDate) + 1;

    DIM_\$(vFieldName):
    LOAD
        TempDate AS \$(vFieldName),
        Year(TempDate) AS \$(vFieldName)_Year,
        Month(TempDate) AS \$(vFieldName)_MonthNum,
        Date(MonthStart(TempDate), 'MMM-YYYY') AS \$(vFieldName)_MonthYear,
        Day(TempDate) AS \$(vFieldName)_Day,
        Week(TempDate) AS \$(vFieldName)_Week,
        'Q' & Ceil(Month(TempDate)/3) AS \$(vFieldName)_Quarter,
        ${monthNames} AS \$(vFieldName)_MonthName
    RESIDENT TempCal_\$(vFieldName);

    DROP TABLE TempCal_\$(vFieldName);

END SUB
`.trim();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new ScriptBuilder instance
 */
export function createScriptBuilder(logger?: Logger): ScriptBuilder {
  return new ScriptBuilder(logger);
}

export default ScriptBuilder;
