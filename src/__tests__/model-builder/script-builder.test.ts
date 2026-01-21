/**
 * @fileoverview Unit tests for Script Builder
 */

import { jest } from '@jest/globals';
import {
  ScriptBuilder,
  createScriptBuilder,
  BuildContextError,
} from '../../model-builder/services/script-builder.js';
import {
  BuildContext,
  BuildConfig,
  EnrichedTable,
  EnrichedField,
  EnrichedModelSpec,
  DateFieldInfo,
  ModelBuilderSession,
  BuildStage,
} from '../../model-builder/types.js';
import {
  AnalysisResult,
  TableClassificationResult,
  ModelTypeRecommendation,
} from '../../model-builder/services/analyzer.js';

describe('ScriptBuilder', () => {
  let builder: ScriptBuilder;

  beforeEach(() => {
    builder = new ScriptBuilder();
  });

  // ==========================================================================
  // Test Helpers
  // ==========================================================================

  const createField = (
    name: string,
    type: string,
    options: Partial<EnrichedField> = {}
  ): EnrichedField => ({
    name,
    type,
    cardinality: 100,
    null_percent: 0,
    is_key_candidate: false,
    is_date_field: false,
    sample_values: [],
    ...options,
  });

  const createTable = (
    name: string,
    fields: EnrichedField[],
    rowCount = 1000
  ): EnrichedTable => ({
    name,
    source_name: `${name.toLowerCase()}.qvd`,
    row_count: rowCount,
    fields,
  });

  const createDateField = (name: string): DateFieldInfo => ({
    field_name: name,
    table_name: 'Orders',
    format: 'YYYY-MM-DD',
    type: 'date',
    sample_values: ['2024-01-01', '2024-12-31'],
  });

  const createConfig = (overrides: Partial<BuildConfig> = {}): BuildConfig => ({
    project_name: 'Test Project',
    qvd_path: 'lib://QVD/',
    calendar_language: 'EN',
    use_autonumber: false,
    ...overrides,
  });

  const createSession = (): ModelBuilderSession => ({
    session_id: 'test-session',
    project_name: 'Test Project',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    current_stage: 'A',
    completed_stages: [],
    model_type: null,
    approved_script_parts: {},
    pending_tables: [],
    gemini_reviews: [],
  });

  const createSpec = (
    tables: EnrichedTable[],
    dateFields: DateFieldInfo[] = []
  ): EnrichedModelSpec => ({
    tables,
    relationships: [],
    date_fields: dateFields,
  });

  const createClassificationResult = (
    tableName: string,
    classification: 'fact' | 'dimension' | 'link' | 'calendar'
  ): TableClassificationResult => ({
    table_name: tableName,
    classification,
    confidence: 0.9,
    reasoning: ['Test classification'],
  });

  const createAnalysis = (
    classifications: Map<string, TableClassificationResult>,
    recommendedModel: 'star_schema' | 'snowflake' | 'link_table' | 'concatenated' = 'star_schema'
  ): AnalysisResult => ({
    classifications,
    model_recommendation: {
      recommended_model: recommendedModel,
      confidence: 0.9,
      alternatives: [],
      reasoning: 'Test recommendation',
    },
    warnings: [],
    recommendations: [],
  });

  const createContext = (
    tables: EnrichedTable[],
    classifications: Map<string, TableClassificationResult>,
    options: {
      dateFields?: DateFieldInfo[];
      config?: Partial<BuildConfig>;
      recommendedModel?: 'star_schema' | 'snowflake' | 'link_table' | 'concatenated';
    } = {}
  ): BuildContext => ({
    session: createSession(),
    spec: createSpec(tables, options.dateFields || []),
    analysis: createAnalysis(classifications, options.recommendedModel),
    config: createConfig(options.config),
  });

  // ==========================================================================
  // Constructor Tests
  // ==========================================================================

  describe('constructor', () => {
    it('should create ScriptBuilder instance', () => {
      const sb = new ScriptBuilder();
      expect(sb).toBeInstanceOf(ScriptBuilder);
    });

    it('should accept logger parameter', () => {
      const mockLogger = {
        info: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      } as unknown as import('../../model-builder/services/logger.js').Logger;

      const sb = new ScriptBuilder(mockLogger);
      expect(sb).toBeInstanceOf(ScriptBuilder);
    });
  });

  // ==========================================================================
  // Stage A Tests
  // ==========================================================================

  describe('buildStage A (Configuration)', () => {
    it('should generate QUALIFY and variables', () => {
      const customers = createTable('Customers', [
        createField('CustomerID', 'integer', { is_key_candidate: true }),
        createField('CustomerName', 'string'),
      ], 500);

      const classifications = new Map([
        ['Customers', createClassificationResult('Customers', 'dimension')],
      ]);

      const context = createContext([customers], classifications);
      const result = builder.buildStage('A', context);

      expect(result.stage).toBe('A');
      expect(result.script).toContain('QUALIFY *;');
      expect(result.script).toContain("SET vPathQVD = 'lib://QVD/';");
      expect(result.script).toContain('SET vReloadDate = Today();');
      expect(result.script).toContain('SET vReloadTime = Now();');
    });

    it('should include project name and date', () => {
      const customers = createTable('Customers', [
        createField('CustomerID', 'integer', { is_key_candidate: true }),
      ]);

      const classifications = new Map([
        ['Customers', createClassificationResult('Customers', 'dimension')],
      ]);

      const context = createContext([customers], classifications, {
        config: { project_name: 'My Sales Project' },
      });
      const result = builder.buildStage('A', context);

      expect(result.script).toContain('Project: My Sales Project');
      expect(result.script).toMatch(/Created: \d{4}-\d{2}-\d{2}/);
    });

    it('should set correct QVD path', () => {
      const customers = createTable('Customers', [
        createField('CustomerID', 'integer', { is_key_candidate: true }),
      ]);

      const classifications = new Map([
        ['Customers', createClassificationResult('Customers', 'dimension')],
      ]);

      const context = createContext([customers], classifications, {
        config: { qvd_path: 'lib://MyData/QVD/' },
      });
      const result = builder.buildStage('A', context);

      expect(result.script).toContain("SET vPathQVD = 'lib://MyData/QVD/';");
    });

    it('should include model type in header', () => {
      const customers = createTable('Customers', [
        createField('CustomerID', 'integer', { is_key_candidate: true }),
      ]);

      const classifications = new Map([
        ['Customers', createClassificationResult('Customers', 'dimension')],
      ]);

      const context = createContext([customers], classifications, {
        recommendedModel: 'snowflake',
      });
      const result = builder.buildStage('A', context);

      expect(result.script).toContain('Model Type: snowflake');
    });
  });

  // ==========================================================================
  // Stage B Tests (Dimensions)
  // ==========================================================================

  describe('buildStage B (Dimensions)', () => {
    it('should prefix with DIM_', () => {
      const customers = createTable('Customers', [
        createField('CustomerID', 'integer', { is_key_candidate: true }),
        createField('CustomerName', 'string'),
      ]);

      const classifications = new Map([
        ['Customers', createClassificationResult('Customers', 'dimension')],
      ]);

      const context = createContext([customers], classifications);
      const result = builder.buildStage('B', context);

      expect(result.script).toContain('DIM_Customers:');
      expect(result.tables_included).toContain('Customers');
    });

    it('should convert ID to Key', () => {
      const customers = createTable('Customers', [
        createField('CustomerID', 'integer', { is_key_candidate: true }),
        createField('CustomerName', 'string'),
      ]);

      const classifications = new Map([
        ['Customers', createClassificationResult('Customers', 'dimension')],
      ]);

      const context = createContext([customers], classifications);
      const result = builder.buildStage('B', context);

      expect(result.script).toContain('CustomerID AS CustomerKey');
      expect(result.script).toContain('// PK');
    });

    it('should include all fields', () => {
      const products = createTable('Products', [
        createField('ProductID', 'integer', { is_key_candidate: true }),
        createField('ProductName', 'string'),
        createField('ProductCategory', 'string'),
        createField('Price', 'decimal'),
      ]);

      const classifications = new Map([
        ['Products', createClassificationResult('Products', 'dimension')],
      ]);

      const context = createContext([products], classifications);
      const result = builder.buildStage('B', context);

      expect(result.script).toContain('ProductName');
      expect(result.script).toContain('ProductCategory');
      expect(result.script).toContain('Price');
    });

    it('should use correct QVD path', () => {
      const customers = createTable('Customers', [
        createField('CustomerID', 'integer', { is_key_candidate: true }),
      ]);

      const classifications = new Map([
        ['Customers', createClassificationResult('Customers', 'dimension')],
      ]);

      const context = createContext([customers], classifications);
      const result = builder.buildStage('B', context);

      expect(result.script).toContain('FROM [$(vPathQVD)customers.qvd] (qvd);');
    });

    it('should handle multiple dimension tables', () => {
      const customers = createTable('Customers', [
        createField('CustomerID', 'integer', { is_key_candidate: true }),
      ]);
      const products = createTable('Products', [
        createField('ProductID', 'integer', { is_key_candidate: true }),
      ]);

      const classifications = new Map([
        ['Customers', createClassificationResult('Customers', 'dimension')],
        ['Products', createClassificationResult('Products', 'dimension')],
      ]);

      const context = createContext([customers, products], classifications);
      const result = builder.buildStage('B', context);

      expect(result.script).toContain('DIM_Customers:');
      expect(result.script).toContain('DIM_Products:');
      expect(result.tables_included).toHaveLength(2);
    });
  });

  // ==========================================================================
  // Stage C Tests (Facts)
  // ==========================================================================

  describe('buildStage C (Facts)', () => {
    it('should prefix with FACT_', () => {
      const orders = createTable('Orders', [
        createField('OrderID', 'integer', { is_key_candidate: true }),
        createField('Amount', 'decimal'),
      ], 50000);

      const classifications = new Map([
        ['Orders', createClassificationResult('Orders', 'fact')],
      ]);

      const context = createContext([orders], classifications);
      const result = builder.buildStage('C', context);

      expect(result.script).toContain('FACT_Orders:');
      expect(result.tables_included).toContain('Orders');
    });

    it('should add FK comments for dimension references', () => {
      const customers = createTable('Customers', [
        createField('CustomerID', 'integer', { is_key_candidate: true }),
        createField('CustomerName', 'string'),
      ]);
      const orders = createTable('Orders', [
        createField('OrderID', 'integer', { is_key_candidate: true }),
        createField('CustomerID', 'integer'),
        createField('Amount', 'decimal'),
      ]);

      const classifications = new Map([
        ['Customers', createClassificationResult('Customers', 'dimension')],
        ['Orders', createClassificationResult('Orders', 'fact')],
      ]);

      const context = createContext([customers, orders], classifications);
      const result = builder.buildStage('C', context);

      expect(result.script).toContain('CustomerID AS CustomerKey');
      expect(result.script).toContain('// FK to DIM');
    });

    it('should link to dimension keys correctly', () => {
      const customers = createTable('Customers', [
        createField('CustomerID', 'integer', { is_key_candidate: true }),
      ]);
      const products = createTable('Products', [
        createField('ProductID', 'integer', { is_key_candidate: true }),
      ]);
      const orders = createTable('Orders', [
        createField('OrderID', 'integer', { is_key_candidate: true }),
        createField('CustomerID', 'integer'),
        createField('ProductID', 'integer'),
        createField('Amount', 'decimal'),
      ]);

      const classifications = new Map([
        ['Customers', createClassificationResult('Customers', 'dimension')],
        ['Products', createClassificationResult('Products', 'dimension')],
        ['Orders', createClassificationResult('Orders', 'fact')],
      ]);

      const context = createContext([customers, products, orders], classifications);
      const result = builder.buildStage('C', context);

      // Both FKs should be converted to Keys
      expect(result.script).toContain('CustomerID AS CustomerKey');
      expect(result.script).toContain('ProductID AS ProductKey');
    });
  });

  // ==========================================================================
  // Stage D Tests (Link Tables)
  // ==========================================================================

  describe('buildStage D (Link Tables)', () => {
    it('should skip for non-link_table model', () => {
      const orders = createTable('Orders', [
        createField('OrderID', 'integer', { is_key_candidate: true }),
      ]);

      const classifications = new Map([
        ['Orders', createClassificationResult('Orders', 'fact')],
      ]);

      const context = createContext([orders], classifications, {
        recommendedModel: 'star_schema',
      });
      const result = builder.buildStage('D', context);

      expect(result.script).toContain('No Link Tables needed');
      expect(result.tables_included).toHaveLength(0);
    });

    it('should create LINK_Facts when needed', () => {
      const orders = createTable('Orders', [
        createField('OrderID', 'integer', { is_key_candidate: true }),
        createField('CustomerID', 'integer'),
      ]);
      const shipments = createTable('Shipments', [
        createField('ShipmentID', 'integer', { is_key_candidate: true }),
        createField('CustomerID', 'integer'),
      ]);

      const classifications = new Map([
        ['Orders', createClassificationResult('Orders', 'fact')],
        ['Shipments', createClassificationResult('Shipments', 'fact')],
      ]);

      const context = createContext([orders, shipments], classifications, {
        recommendedModel: 'link_table',
      });
      const result = builder.buildStage('D', context);

      expect(result.script).toContain('LINK_Facts');
      expect(result.script).toContain('LinkKey');
      expect(result.tables_included).toContain('LINK_Facts');
    });

    it('should use AUTONUMBER when configured', () => {
      const orders = createTable('Orders', [
        createField('CustomerID', 'integer'),
      ]);
      const returns = createTable('Returns', [
        createField('CustomerID', 'integer'),
      ]);

      const classifications = new Map([
        ['Orders', createClassificationResult('Orders', 'fact')],
        ['Returns', createClassificationResult('Returns', 'fact')],
      ]);

      const context = createContext([orders, returns], classifications, {
        recommendedModel: 'link_table',
        config: { use_autonumber: true },
      });
      const result = builder.buildStage('D', context);

      expect(result.script).toContain('AUTONUMBER(');
    });
  });

  // ==========================================================================
  // Stage E Tests (Calendars)
  // ==========================================================================

  describe('buildStage E (Calendars)', () => {
    it('should generate calendar subroutine', () => {
      const orders = createTable('Orders', [
        createField('OrderID', 'integer', { is_key_candidate: true }),
        createField('OrderDate', 'date', { is_date_field: true }),
      ]);

      const classifications = new Map([
        ['Orders', createClassificationResult('Orders', 'fact')],
      ]);

      const dateFields = [createDateField('OrderDate')];

      const context = createContext([orders], classifications, { dateFields });
      const result = builder.buildStage('E', context);

      expect(result.script).toContain('SUB CreateMasterCalendar');
      expect(result.script).toContain('END SUB');
    });

    it('should create calendar per date field', () => {
      const orders = createTable('Orders', [
        createField('OrderID', 'integer', { is_key_candidate: true }),
        createField('OrderDate', 'date', { is_date_field: true }),
        createField('ShipDate', 'date', { is_date_field: true }),
      ]);

      const classifications = new Map([
        ['Orders', createClassificationResult('Orders', 'fact')],
      ]);

      const dateFields = [
        createDateField('OrderDate'),
        createDateField('ShipDate'),
      ];

      const context = createContext([orders], classifications, { dateFields });
      const result = builder.buildStage('E', context);

      expect(result.script).toContain("CALL CreateMasterCalendar('OrderDate'");
      expect(result.script).toContain("CALL CreateMasterCalendar('ShipDate'");
      expect(result.tables_included).toContain('DIM_OrderDate');
      expect(result.tables_included).toContain('DIM_ShipDate');
    });

    it('should support English calendar', () => {
      const orders = createTable('Orders', [
        createField('OrderDate', 'date', { is_date_field: true }),
      ]);

      const classifications = new Map([
        ['Orders', createClassificationResult('Orders', 'fact')],
      ]);

      const dateFields = [createDateField('OrderDate')];

      const context = createContext([orders], classifications, {
        dateFields,
        config: { calendar_language: 'EN' },
      });
      const result = builder.buildStage('E', context);

      expect(result.script).toContain("'Jan'");
      expect(result.script).toContain("'Dec'");
    });

    it('should support Hebrew calendar', () => {
      const orders = createTable('Orders', [
        createField('OrderDate', 'date', { is_date_field: true }),
      ]);

      const classifications = new Map([
        ['Orders', createClassificationResult('Orders', 'fact')],
      ]);

      const dateFields = [createDateField('OrderDate')];

      const context = createContext([orders], classifications, {
        dateFields,
        config: { calendar_language: 'HE' },
      });
      const result = builder.buildStage('E', context);

      expect(result.script).toContain('ינואר');
      expect(result.script).toContain('דצמבר');
    });

    it('should generate Year/Month/Day fields', () => {
      const orders = createTable('Orders', [
        createField('OrderDate', 'date', { is_date_field: true }),
      ]);

      const classifications = new Map([
        ['Orders', createClassificationResult('Orders', 'fact')],
      ]);

      const dateFields = [createDateField('OrderDate')];

      const context = createContext([orders], classifications, { dateFields });
      const result = builder.buildStage('E', context);

      expect(result.script).toContain('$(vFieldName)_Year');
      expect(result.script).toContain('$(vFieldName)_MonthNum');
      expect(result.script).toContain('$(vFieldName)_Day');
      expect(result.script).toContain('$(vFieldName)_Week');
      expect(result.script).toContain('$(vFieldName)_Quarter');
    });
  });

  // ==========================================================================
  // Stage F Tests (STORE & Cleanup)
  // ==========================================================================

  describe('buildStage F (STORE & Cleanup)', () => {
    it('should UNQUALIFY all keys', () => {
      const customers = createTable('Customers', [
        createField('CustomerID', 'integer', { is_key_candidate: true }),
      ]);
      const orders = createTable('Orders', [
        createField('OrderID', 'integer', { is_key_candidate: true }),
        createField('CustomerID', 'integer'),
      ]);

      const classifications = new Map([
        ['Customers', createClassificationResult('Customers', 'dimension')],
        ['Orders', createClassificationResult('Orders', 'fact')],
      ]);

      const context = createContext([customers, orders], classifications);
      const result = builder.buildStage('F', context);

      expect(result.script).toContain('UNQUALIFY');
      expect(result.script).toContain('CustomerKey');
      expect(result.script).toContain('OrderKey');
    });

    it('should STORE all tables', () => {
      const customers = createTable('Customers', [
        createField('CustomerID', 'integer', { is_key_candidate: true }),
      ]);
      const orders = createTable('Orders', [
        createField('OrderID', 'integer', { is_key_candidate: true }),
      ]);

      const classifications = new Map([
        ['Customers', createClassificationResult('Customers', 'dimension')],
        ['Orders', createClassificationResult('Orders', 'fact')],
      ]);

      const context = createContext([customers, orders], classifications);
      const result = builder.buildStage('F', context);

      expect(result.script).toContain('STORE DIM_Customers INTO');
      expect(result.script).toContain('STORE FACT_Orders INTO');
    });

    it('should use Final/ path', () => {
      const customers = createTable('Customers', [
        createField('CustomerID', 'integer', { is_key_candidate: true }),
      ]);

      const classifications = new Map([
        ['Customers', createClassificationResult('Customers', 'dimension')],
      ]);

      const context = createContext([customers], classifications);
      const result = builder.buildStage('F', context);

      expect(result.script).toContain('[$(vPathQVD)Final/');
    });

    it('should include calendar tables in STORE', () => {
      const orders = createTable('Orders', [
        createField('OrderID', 'integer', { is_key_candidate: true }),
        createField('OrderDate', 'date', { is_date_field: true }),
      ]);

      const classifications = new Map([
        ['Orders', createClassificationResult('Orders', 'fact')],
      ]);

      const dateFields = [createDateField('OrderDate')];

      const context = createContext([orders], classifications, { dateFields });
      const result = builder.buildStage('F', context);

      expect(result.script).toContain('STORE DIM_OrderDate INTO');
    });
  });

  // ==========================================================================
  // assembleFullScript Tests
  // ==========================================================================

  describe('assembleFullScript', () => {
    it('should combine all stages in order', () => {
      const approvedStages: Partial<Record<BuildStage, string>> = {
        A: '// Stage A script',
        B: '// Stage B script',
        C: '// Stage C script',
      };

      const result = builder.assembleFullScript(approvedStages);

      expect(result).toContain('// Stage A script');
      expect(result).toContain('// Stage B script');
      expect(result).toContain('// Stage C script');

      // Check order
      const indexA = result.indexOf('// Stage A script');
      const indexB = result.indexOf('// Stage B script');
      const indexC = result.indexOf('// Stage C script');
      expect(indexA).toBeLessThan(indexB);
      expect(indexB).toBeLessThan(indexC);
    });

    it('should handle missing stages', () => {
      const approvedStages: Partial<Record<BuildStage, string>> = {
        A: '// Stage A',
        C: '// Stage C',
        // B is missing
      };

      const result = builder.assembleFullScript(approvedStages);

      expect(result).toContain('// Stage A');
      expect(result).toContain('// Stage C');
      expect(result).not.toContain('// Stage B');
    });
  });

  // ==========================================================================
  // validateScript Tests
  // ==========================================================================

  describe('validateScript', () => {
    it('should detect LOAD * warning', () => {
      const script = 'Sales:\nLOAD * FROM data.qvd;';

      const result = builder.validateScript(script);

      expect(result.warnings.some(w => w.code === 'LOAD_STAR')).toBe(true);
    });

    it('should detect mismatched brackets', () => {
      const script = 'Sales:\nLOAD [Field1, [Field2 FROM data.qvd;';

      const result = builder.validateScript(script);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'BRACKET_MISMATCH')).toBe(true);
    });

    it('should pass valid script', () => {
      const script = `
QUALIFY *;
SET vPath = 'lib://QVD/';

Sales:
LOAD
    SaleID,
    Amount
FROM [$(vPath)sales.qvd] (qvd);
`;

      const result = builder.validateScript(script);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('error handling', () => {
    it('should throw BuildContextError for missing session', () => {
      const context = {
        spec: createSpec([]),
        analysis: createAnalysis(new Map()),
        config: createConfig(),
      } as unknown as BuildContext;

      expect(() => builder.buildStage('A', context)).toThrow(BuildContextError);
    });

    it('should throw BuildContextError for missing spec', () => {
      const context = {
        session: createSession(),
        analysis: createAnalysis(new Map()),
        config: createConfig(),
      } as unknown as BuildContext;

      expect(() => builder.buildStage('A', context)).toThrow(BuildContextError);
    });

    it('should throw BuildContextError for missing analysis', () => {
      const context = {
        session: createSession(),
        spec: createSpec([]),
        config: createConfig(),
      } as unknown as BuildContext;

      expect(() => builder.buildStage('A', context)).toThrow(BuildContextError);
    });

    it('should throw for unknown stage', () => {
      const context = createContext([], new Map());

      expect(() => builder.buildStage('X' as BuildStage, context)).toThrow(
        BuildContextError
      );
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('edge cases', () => {
    it('should handle empty dimensions', () => {
      const orders = createTable('Orders', [
        createField('OrderID', 'integer', { is_key_candidate: true }),
      ]);

      const classifications = new Map([
        ['Orders', createClassificationResult('Orders', 'fact')],
      ]);

      const context = createContext([orders], classifications);
      const result = builder.buildStage('B', context);

      expect(result.tables_included).toHaveLength(0);
      expect(result.script).toContain('SECTION 2: Dimensions');
    });

    it('should handle empty facts', () => {
      const customers = createTable('Customers', [
        createField('CustomerID', 'integer', { is_key_candidate: true }),
      ]);

      const classifications = new Map([
        ['Customers', createClassificationResult('Customers', 'dimension')],
      ]);

      const context = createContext([customers], classifications);
      const result = builder.buildStage('C', context);

      expect(result.tables_included).toHaveLength(0);
      expect(result.script).toContain('SECTION 3: Facts');
    });

    it('should escape field names with special characters', () => {
      const data = createTable('Data', [
        createField('My Field', 'string'),
        createField('Field-Name', 'string'),
        createField('123Field', 'string'),
      ]);

      const classifications = new Map([
        ['Data', createClassificationResult('Data', 'dimension')],
      ]);

      const context = createContext([data], classifications);
      const result = builder.buildStage('B', context);

      expect(result.script).toContain('[My Field]');
      expect(result.script).toContain('[Field-Name]');
      expect(result.script).toContain('[123Field]');
    });

    it('should handle no date fields for calendars', () => {
      const orders = createTable('Orders', [
        createField('OrderID', 'integer', { is_key_candidate: true }),
      ]);

      const classifications = new Map([
        ['Orders', createClassificationResult('Orders', 'fact')],
      ]);

      const context = createContext([orders], classifications, {
        dateFields: [],
      });
      const result = builder.buildStage('E', context);

      expect(result.tables_included).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Factory Tests
  // ==========================================================================

  describe('createScriptBuilder factory', () => {
    it('should create ScriptBuilder instance', () => {
      const sb = createScriptBuilder();
      expect(sb).toBeInstanceOf(ScriptBuilder);
    });
  });
});
