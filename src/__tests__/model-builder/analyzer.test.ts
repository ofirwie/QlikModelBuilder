/**
 * @fileoverview Unit tests for Analyzer
 */

import {
  Analyzer,
  createAnalyzer,
  AnalysisResult,
  TableClassificationResult,
} from '../../model-builder/services/analyzer.js';
import {
  EnrichedModelSpec,
  EnrichedTable,
  EnrichedField,
  EnrichedRelationship,
  TableClassification,
} from '../../model-builder/types.js';

describe('Analyzer', () => {
  let analyzer: Analyzer;

  beforeEach(() => {
    analyzer = new Analyzer();
  });

  // Helper to create enriched field
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

  // Helper to create enriched table
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

  // Helper to create relationship
  const createRelationship = (
    from: string,
    fromField: string,
    to: string,
    toField: string
  ): EnrichedRelationship => ({
    from_table: from,
    from_field: fromField,
    to_table: to,
    to_field: toField,
    type: 'many-to-one',
    from_cardinality: 100,
    to_cardinality: 50,
    validated: true,
  });

  // Helper to create model spec
  const createSpec = (
    tables: EnrichedTable[],
    relationships: EnrichedRelationship[] = []
  ): EnrichedModelSpec => ({
    tables,
    relationships,
    date_fields: [],
  });

  describe('analyze', () => {
    it('should throw on empty spec', () => {
      const spec = createSpec([]);
      expect(() => analyzer.analyze(spec)).toThrow(/must contain at least one table/);
    });

    it('should classify all tables', () => {
      const spec = createSpec([
        createTable('Orders', [
          createField('OrderID', 'integer'),
          createField('Amount', 'decimal'),
          createField('Quantity', 'integer'),
          createField('CustomerID', 'integer'),
        ], 50000),
        createTable('Customers', [
          createField('CustomerID', 'integer'),
          createField('CustomerName', 'string'),
          createField('CustomerAddress', 'string'),
          createField('CustomerCity', 'string'),
        ], 500),
      ]);

      const result = analyzer.analyze(spec);

      expect(result.classifications.size).toBe(2);
      expect(result.classifications.has('Orders')).toBe(true);
      expect(result.classifications.has('Customers')).toBe(true);
    });

    it('should detect model type', () => {
      const spec = createSpec([
        createTable('Sales', [
          createField('SaleID', 'integer'),
          createField('Amount', 'decimal'),
          createField('ProductID', 'integer'),
        ], 100000),
        createTable('Products', [
          createField('ProductID', 'integer'),
          createField('ProductName', 'string'),
        ], 100),
      ], [
        createRelationship('Sales', 'ProductID', 'Products', 'ProductID'),
      ]);

      const result = analyzer.analyze(spec);

      expect(result.model_recommendation).toBeDefined();
      expect(result.model_recommendation.recommended_model).toBeDefined();
      expect(result.model_recommendation.confidence).toBeGreaterThan(0);
    });

    it('should generate warnings for ambiguous cases', () => {
      const spec = createSpec([
        createTable('AmbiguousTable', [
          createField('ID', 'integer'),
        ], 5000),
      ]);

      const result = analyzer.analyze(spec);

      // Should have some warnings or low confidence
      const classification = result.classifications.get('AmbiguousTable');
      expect(classification).toBeDefined();
    });

    it('should provide recommendations', () => {
      const spec = createSpec([
        createTable('OnlyDimensions', [
          createField('ID', 'integer'),
          createField('Name', 'string'),
        ], 100),
      ]);

      const result = analyzer.analyze(spec);

      // Should recommend adding fact tables
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('classifyTable', () => {
    it('should classify high-row-count table with measures as Fact', () => {
      const table = createTable('Orders', [
        createField('OrderID', 'integer'),
        createField('TotalAmount', 'decimal'),
        createField('TotalQuantity', 'integer'),
        createField('CustomerID', 'integer'),
        createField('ProductID', 'integer'),
        createField('OrderDate', 'date', { is_date_field: true }),
      ], 100000);

      const result = analyzer.classifyTable(table, [table]);

      expect(result.classification).toBe('fact');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should classify low-row-count table with descriptions as Dimension', () => {
      const table = createTable('Customers', [
        createField('CustomerID', 'integer'),
        createField('CustomerName', 'string'),
        createField('CustomerDescription', 'string'),
        createField('CustomerCategory', 'string'),
        createField('CustomerAddress', 'string'),
      ], 500);

      const result = analyzer.classifyTable(table, [table]);

      expect(result.classification).toBe('dimension');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect calendar tables', () => {
      const table = createTable('Calendar', [
        createField('DateKey', 'integer'),
        createField('Year', 'integer'),
        createField('Month', 'integer'),
        createField('MonthName', 'string'),
        createField('Day', 'integer'),
        createField('Quarter', 'integer'),
        createField('Week', 'integer'),
      ], 3650);

      const result = analyzer.classifyTable(table, [table]);

      expect(result.classification).toBe('calendar');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should return confidence score', () => {
      const table = createTable('Products', [
        createField('ProductID', 'integer'),
        createField('ProductName', 'string'),
      ], 100);

      const result = analyzer.classifyTable(table, [table]);

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should provide reasoning for classification', () => {
      const table = createTable('Sales', [
        createField('SaleID', 'integer'),
        createField('SaleAmount', 'decimal'),
        createField('CustomerID', 'integer'),
      ], 50000);

      const customers = createTable('Customers', [
        createField('CustomerID', 'integer'),
        createField('Name', 'string'),
      ], 100);

      const result = analyzer.classifyTable(table, [table, customers]);

      expect(result.reasoning.length).toBeGreaterThan(0);
    });

    it('should detect bridge/link tables', () => {
      const table = createTable('Order_Items', [
        createField('order_id', 'integer'),
        createField('product_id', 'integer'),
        createField('Quantity', 'integer'),
      ], 10000);

      const orders = createTable('Orders', [createField('OrderID', 'integer')], 5000);
      const products = createTable('Products', [createField('ProductID', 'integer')], 100);

      const result = analyzer.classifyTable(table, [table, orders, products]);

      // Should recognize bridge-like structure (has FK fields pattern and matching naming)
      expect(result.classification).toBe('link');
      expect(result.reasoning.length).toBeGreaterThan(0);
    });
  });

  describe('detectModelType', () => {
    it('should recommend Star Schema for simple Fact+Dimensions', () => {
      const classifications = new Map<string, TableClassification>([
        ['Sales', 'fact'],
        ['Products', 'dimension'],
        ['Customers', 'dimension'],
        ['Calendar', 'calendar'],
      ]);

      const result = analyzer.detectModelType(classifications, []);

      expect(result.recommended_model).toBe('star_schema');
      expect(result.reasoning).toContain('star');
    });

    it('should suggest Snowflake for Dimension hierarchies', () => {
      const classifications = new Map<string, TableClassification>([
        ['Sales', 'fact'],
        ['Products', 'dimension'],
        ['Categories', 'dimension'],
      ]);

      const relationships: EnrichedRelationship[] = [
        createRelationship('Products', 'CategoryID', 'Categories', 'CategoryID'),
      ];

      const result = analyzer.detectModelType(classifications, relationships);

      expect(result.recommended_model).toBe('snowflake');
      expect(result.alternatives.some(a => a.model === 'star_schema')).toBe(true);
    });

    it('should recommend Link Table for Fact-to-Fact relations', () => {
      const classifications = new Map<string, TableClassification>([
        ['Orders', 'fact'],
        ['Shipments', 'fact'],
        ['Customers', 'dimension'],
      ]);

      const relationships: EnrichedRelationship[] = [
        createRelationship('Orders', 'OrderID', 'Shipments', 'OrderID'),
      ];

      const result = analyzer.detectModelType(classifications, relationships);

      expect(result.recommended_model).toBe('link_table');
    });

    it('should suggest Concatenated for similar Facts', () => {
      const classifications = new Map<string, TableClassification>([
        ['Sales_2023', 'fact'],
        ['Sales_2024', 'fact'],
        ['Products', 'dimension'],
      ]);

      const result = analyzer.detectModelType(classifications, []);

      // Should have concatenated as an alternative
      expect(
        result.alternatives.some(a => a.model === 'concatenated') ||
        result.recommended_model === 'concatenated'
      ).toBe(true);
    });

    it('should provide alternatives', () => {
      const classifications = new Map<string, TableClassification>([
        ['Sales', 'fact'],
        ['Products', 'dimension'],
        ['Categories', 'dimension'],
      ]);

      const relationships: EnrichedRelationship[] = [
        createRelationship('Products', 'CategoryID', 'Categories', 'CategoryID'),
      ];

      const result = analyzer.detectModelType(classifications, relationships);

      expect(result.alternatives.length).toBeGreaterThan(0);
      result.alternatives.forEach(alt => {
        expect(alt.model).toBeDefined();
        expect(alt.reason).toBeDefined();
        expect(alt.pros.length).toBeGreaterThan(0);
        expect(alt.cons.length).toBeGreaterThan(0);
      });
    });
  });

  describe('generateWarnings', () => {
    it('should warn about low confidence classifications', () => {
      const classifications = new Map<string, TableClassificationResult>([
        ['AmbiguousTable', {
          table_name: 'AmbiguousTable',
          classification: 'dimension',
          confidence: 0.3,
          reasoning: ['Low confidence'],
        }],
      ]);

      const warnings = analyzer.generateWarnings(
        classifications,
        [],
        [createTable('AmbiguousTable', [])]
      );

      expect(warnings.some(w => w.type === 'low_confidence')).toBe(true);
    });

    it('should warn about orphan tables', () => {
      const classifications = new Map<string, TableClassificationResult>([
        ['Table1', { table_name: 'Table1', classification: 'dimension', confidence: 0.8, reasoning: [] }],
        ['Table2', { table_name: 'Table2', classification: 'fact', confidence: 0.8, reasoning: [] }],
      ]);

      const warnings = analyzer.generateWarnings(
        classifications,
        [], // No relationships
        [
          createTable('Table1', []),
          createTable('Table2', []),
        ]
      );

      expect(warnings.some(w => w.type === 'orphan_table')).toBe(true);
    });

    it('should detect circular relationships', () => {
      const tables = [
        createTable('A', [createField('ID', 'integer')]),
        createTable('B', [createField('ID', 'integer')]),
        createTable('C', [createField('ID', 'integer')]),
      ];

      const relationships: EnrichedRelationship[] = [
        createRelationship('A', 'ID', 'B', 'ID'),
        createRelationship('B', 'ID', 'C', 'ID'),
        createRelationship('C', 'ID', 'A', 'ID'),
      ];

      const classifications = new Map<string, TableClassificationResult>([
        ['A', { table_name: 'A', classification: 'dimension', confidence: 0.8, reasoning: [] }],
        ['B', { table_name: 'B', classification: 'dimension', confidence: 0.8, reasoning: [] }],
        ['C', { table_name: 'C', classification: 'dimension', confidence: 0.8, reasoning: [] }],
      ]);

      const warnings = analyzer.generateWarnings(classifications, relationships, tables);

      expect(warnings.some(w => w.type === 'circular_relationship')).toBe(true);
    });
  });

  describe('generateRecommendations', () => {
    it('should recommend adding fact tables when missing', () => {
      const result: AnalysisResult = {
        classifications: new Map([
          ['Customers', { table_name: 'Customers', classification: 'dimension', confidence: 0.8, reasoning: [] }],
        ]),
        model_recommendation: {
          recommended_model: 'star_schema',
          confidence: 0.5,
          alternatives: [],
          reasoning: 'Default',
        },
        warnings: [],
        recommendations: [],
      };

      const recommendations = analyzer.generateRecommendations(result);

      expect(recommendations.some(r => r.toLowerCase().includes('fact'))).toBe(true);
    });

    it('should suggest alternatives when available', () => {
      const result: AnalysisResult = {
        classifications: new Map([
          ['Sales', { table_name: 'Sales', classification: 'fact', confidence: 0.9, reasoning: [] }],
        ]),
        model_recommendation: {
          recommended_model: 'snowflake',
          confidence: 0.8,
          alternatives: [{
            model: 'star_schema',
            reason: 'Simpler structure',
            pros: ['Easy to query'],
            cons: ['Some denormalization'],
          }],
          reasoning: 'Hierarchy detected',
        },
        warnings: [],
        recommendations: [],
      };

      const recommendations = analyzer.generateRecommendations(result);

      expect(recommendations.some(r => r.includes('star_schema'))).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle single-table input', () => {
      const spec = createSpec([
        createTable('SingleTable', [
          createField('ID', 'integer'),
          createField('Name', 'string'),
        ]),
      ]);

      const result = analyzer.analyze(spec);

      expect(result.classifications.size).toBe(1);
      expect(result.model_recommendation).toBeDefined();
    });

    it('should handle no relationships', () => {
      const spec = createSpec([
        createTable('Table1', [createField('ID', 'integer')]),
        createTable('Table2', [createField('ID', 'integer')]),
      ], []);

      const result = analyzer.analyze(spec);

      expect(result.warnings.some(w => w.type === 'orphan_table')).toBe(true);
    });

    it('should handle all tables as same classification', () => {
      const spec = createSpec([
        createTable('Dim1', [
          createField('ID', 'integer'),
          createField('Name', 'string'),
          createField('Description', 'string'),
          createField('Category', 'string'),
        ], 100),
        createTable('Dim2', [
          createField('ID', 'integer'),
          createField('Title', 'string'),
          createField('Status', 'string'),
          createField('Label', 'string'),
        ], 50),
      ]);

      const result = analyzer.analyze(spec);

      // Should still return valid result
      expect(result.classifications.size).toBe(2);
      expect(result.model_recommendation).toBeDefined();
    });

    it('should handle empty row counts', () => {
      const spec = createSpec([
        createTable('EmptyTable', [
          createField('ID', 'integer'),
        ], 0),
      ]);

      const result = analyzer.analyze(spec);

      expect(result.classifications.size).toBe(1);
    });

    it('should handle tables with only one field', () => {
      const spec = createSpec([
        createTable('MinimalTable', [
          createField('ID', 'integer'),
        ]),
      ]);

      const result = analyzer.analyze(spec);

      expect(result.classifications.size).toBe(1);
    });
  });

  describe('createAnalyzer factory', () => {
    it('should create Analyzer instance', () => {
      const a = createAnalyzer();
      expect(a).toBeInstanceOf(Analyzer);
    });
  });
});
