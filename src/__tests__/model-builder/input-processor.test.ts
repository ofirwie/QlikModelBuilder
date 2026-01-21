/**
 * @fileoverview Unit tests for Input Processor
 */

import {
  InputProcessor,
  createInputProcessor,
  ValidationError,
  EmptyInputError,
} from '../../model-builder/services/input-processor.js';
import {
  Stage1Input,
  Stage1Table,
  Stage1Field,
  QvdSampleData,
  QvdFieldSample,
  EnrichedField,
} from '../../model-builder/types.js';

describe('InputProcessor', () => {
  let processor: InputProcessor;

  beforeEach(() => {
    processor = new InputProcessor();
  });

  // Helper to create valid Stage1Input
  const createValidStage1Input = (overrides: Partial<Stage1Input> = {}): Stage1Input => ({
    version: '1.0',
    source: 'test.docx',
    parsed_at: '2026-01-21T10:00:00Z',
    tables: [
      {
        name: 'Customers',
        source_name: 'customers.qvd',
        fields: [
          { name: 'CustomerID', type: 'integer' },
          { name: 'CustomerName', type: 'string' },
        ],
      },
    ],
    relationship_hints: [],
    ...overrides,
  });

  // Helper to create valid QvdSampleData
  const createValidQvdSample = (tableName: string, fields: QvdFieldSample[]): QvdSampleData => ({
    table_name: tableName,
    row_count: 1000,
    fields,
  });

  describe('validateStage1Input', () => {
    it('should validate correct Stage1 JSON', () => {
      const input = createValidStage1Input();
      const result = processor.validateStage1Input(input);
      expect(result.version).toBe('1.0');
      expect(result.tables.length).toBe(1);
    });

    it('should reject null input', () => {
      expect(() => processor.validateStage1Input(null)).toThrow(ValidationError);
    });

    it('should reject non-object input', () => {
      expect(() => processor.validateStage1Input('string')).toThrow(ValidationError);
    });

    it('should reject missing version', () => {
      const input = { tables: [], source: 'x', parsed_at: 'x' };
      expect(() => processor.validateStage1Input(input)).toThrow(ValidationError);
    });

    it('should reject invalid version type', () => {
      const input = { version: 123, tables: [], source: 'x', parsed_at: 'x' };
      expect(() => processor.validateStage1Input(input)).toThrow(ValidationError);
    });

    it('should reject missing tables array', () => {
      const input = { version: '1.0', source: 'x', parsed_at: 'x' };
      expect(() => processor.validateStage1Input(input)).toThrow(ValidationError);
    });

    it('should reject non-array tables', () => {
      const input = { version: '1.0', tables: {}, source: 'x', parsed_at: 'x' };
      expect(() => processor.validateStage1Input(input)).toThrow(ValidationError);
    });

    it('should reject empty tables array', () => {
      const input = { version: '1.0', tables: [], source: 'x', parsed_at: 'x' };
      expect(() => processor.validateStage1Input(input)).toThrow(EmptyInputError);
    });

    it('should reject missing source', () => {
      const input = { version: '1.0', tables: [{ name: 'T', source_name: 's', fields: [{ name: 'f', type: 't' }] }], parsed_at: 'x' };
      expect(() => processor.validateStage1Input(input)).toThrow(ValidationError);
    });

    it('should reject missing parsed_at', () => {
      const input = { version: '1.0', tables: [{ name: 'T', source_name: 's', fields: [{ name: 'f', type: 't' }] }], source: 'x' };
      expect(() => processor.validateStage1Input(input)).toThrow(ValidationError);
    });

    it('should validate table structure', () => {
      const input = {
        version: '1.0',
        source: 'x',
        parsed_at: 'x',
        tables: [{ invalid: 'table' }],
      };
      expect(() => processor.validateStage1Input(input)).toThrow(ValidationError);
    });

    it('should reject table without name', () => {
      const input = {
        version: '1.0',
        source: 'x',
        parsed_at: 'x',
        tables: [{ source_name: 'test.qvd', fields: [] }],
      };
      expect(() => processor.validateStage1Input(input)).toThrow(ValidationError);
    });

    it('should reject table without fields', () => {
      const input = {
        version: '1.0',
        source: 'x',
        parsed_at: 'x',
        tables: [{ name: 'Test', source_name: 'test.qvd' }],
      };
      expect(() => processor.validateStage1Input(input)).toThrow(ValidationError);
    });

    it('should reject table with empty fields array', () => {
      const input = {
        version: '1.0',
        source: 'x',
        parsed_at: 'x',
        tables: [{ name: 'Test', source_name: 'test.qvd', fields: [] }],
      };
      expect(() => processor.validateStage1Input(input)).toThrow(ValidationError);
    });

    it('should validate field structure', () => {
      const input = {
        version: '1.0',
        source: 'x',
        parsed_at: 'x',
        tables: [
          {
            name: 'Test',
            source_name: 'test.qvd',
            fields: [{ invalid: 'field' }],
          },
        ],
      };
      expect(() => processor.validateStage1Input(input)).toThrow(ValidationError);
    });
  });

  describe('validateQvdSamples', () => {
    it('should validate correct QVD samples', () => {
      const samples = [
        createValidQvdSample('Customers', [
          { name: 'CustomerID', type: 'integer', cardinality: 100, null_percent: 0, sample_values: [] },
        ]),
      ];
      const result = processor.validateQvdSamples(samples);
      expect(result.length).toBe(1);
    });

    it('should skip invalid samples', () => {
      const samples = [
        { invalid: 'sample' },
        createValidQvdSample('Valid', []),
      ];
      const result = processor.validateQvdSamples(samples as unknown[]);
      expect(result.length).toBe(1);
      expect(result[0].table_name).toBe('Valid');
    });

    it('should skip samples without table_name', () => {
      const samples = [{ row_count: 100, fields: [] }];
      const result = processor.validateQvdSamples(samples as unknown[]);
      expect(result.length).toBe(0);
    });

    it('should skip samples without row_count', () => {
      const samples = [{ table_name: 'Test', fields: [] }];
      const result = processor.validateQvdSamples(samples as unknown[]);
      expect(result.length).toBe(0);
    });
  });

  describe('process', () => {
    it('should merge Stage1 with QVD samples', () => {
      const stage1 = createValidStage1Input();
      const qvdSamples = [
        createValidQvdSample('Customers', [
          { name: 'CustomerID', type: 'integer', cardinality: 950, null_percent: 0, sample_values: ['1', '2', '3'] },
          { name: 'CustomerName', type: 'string', cardinality: 900, null_percent: 2.5, sample_values: ['John', 'Jane'] },
        ]),
      ];

      const result = processor.process(stage1, qvdSamples);

      expect(result.tables.length).toBe(1);
      expect(result.tables[0].row_count).toBe(1000);
      expect(result.tables[0].fields[0].cardinality).toBe(950);
    });

    it('should handle missing QVD samples gracefully', () => {
      const stage1 = createValidStage1Input();
      const result = processor.process(stage1, []);

      expect(result.tables.length).toBe(1);
      expect(result.tables[0].row_count).toBe(0);
      expect(result.tables[0].fields[0].cardinality).toBe(0);
    });

    it('should match tables case-insensitively', () => {
      const stage1 = createValidStage1Input({
        tables: [{ name: 'CUSTOMERS', source_name: 'customers.qvd', fields: [{ name: 'ID', type: 'integer' }] }],
      });
      const qvdSamples = [
        createValidQvdSample('customers', [
          { name: 'ID', type: 'integer', cardinality: 500, null_percent: 0, sample_values: [] },
        ]),
      ];

      const result = processor.process(stage1, qvdSamples);

      expect(result.tables[0].row_count).toBe(1000);
      expect(result.tables[0].fields[0].cardinality).toBe(500);
    });

    it('should collect date fields', () => {
      const stage1 = createValidStage1Input({
        tables: [
          {
            name: 'Orders',
            source_name: 'orders.qvd',
            fields: [
              { name: 'OrderID', type: 'integer' },
              { name: 'OrderDate', type: 'date' },
              { name: 'created_at', type: 'datetime' },
            ],
          },
        ],
      });

      const result = processor.process(stage1, []);

      expect(result.date_fields.length).toBe(2);
      expect(result.date_fields.map(d => d.field_name)).toContain('OrderDate');
      expect(result.date_fields.map(d => d.field_name)).toContain('created_at');
    });

    it('should process relationships', () => {
      const stage1 = createValidStage1Input({
        tables: [
          { name: 'Orders', source_name: 'orders.qvd', fields: [{ name: 'CustomerID', type: 'integer' }] },
          { name: 'Customers', source_name: 'customers.qvd', fields: [{ name: 'CustomerID', type: 'integer' }] },
        ],
        relationship_hints: [
          { from: 'Orders.CustomerID', to: 'Customers.CustomerID', type: 'many-to-one' },
        ],
      });

      const result = processor.process(stage1, []);

      expect(result.relationships.length).toBe(1);
      expect(result.relationships[0].validated).toBe(true);
    });
  });

  describe('enrichTable', () => {
    it('should enrich table with QVD sample data', () => {
      const table: Stage1Table = {
        name: 'Products',
        source_name: 'products.qvd',
        fields: [
          { name: 'ProductID', type: 'integer' },
          { name: 'ProductName', type: 'string' },
        ],
      };
      const sample = createValidQvdSample('Products', [
        { name: 'ProductID', type: 'integer', cardinality: 500, null_percent: 0, sample_values: ['1', '2'] },
        { name: 'ProductName', type: 'string', cardinality: 450, null_percent: 1.5, sample_values: ['Widget', 'Gadget'] },
      ]);

      const result = processor.enrichTable(table, sample);

      expect(result.name).toBe('Products');
      expect(result.row_count).toBe(1000);
      expect(result.fields[0].cardinality).toBe(500);
      expect(result.fields[1].null_percent).toBe(1.5);
    });

    it('should handle null QVD sample', () => {
      const table: Stage1Table = {
        name: 'NoSample',
        source_name: 'nosample.qvd',
        fields: [{ name: 'ID', type: 'integer' }],
      };

      const result = processor.enrichTable(table, null);

      expect(result.row_count).toBe(0);
      expect(result.fields[0].cardinality).toBe(0);
    });

    it('should match fields case-insensitively', () => {
      const table: Stage1Table = {
        name: 'Test',
        source_name: 'test.qvd',
        fields: [{ name: 'FIELD_NAME', type: 'string' }],
      };
      const sample = createValidQvdSample('Test', [
        { name: 'field_name', type: 'string', cardinality: 100, null_percent: 5, sample_values: ['a'] },
      ]);

      const result = processor.enrichTable(table, sample);

      expect(result.fields[0].cardinality).toBe(100);
    });
  });

  describe('enrichField', () => {
    it('should add cardinality from QVD sample', () => {
      const field: Stage1Field = { name: 'Amount', type: 'decimal' };
      const sampleField: QvdFieldSample = {
        name: 'Amount',
        type: 'decimal',
        cardinality: 5000,
        null_percent: 3.5,
        sample_values: ['100.50', '200.75'],
      };

      const result = processor.enrichField(field, sampleField, 10000);

      expect(result.cardinality).toBe(5000);
      expect(result.null_percent).toBe(3.5);
    });

    it('should prefer QVD type over Stage1 type', () => {
      const field: Stage1Field = { name: 'Value', type: 'string' };
      const sampleField: QvdFieldSample = {
        name: 'Value',
        type: 'decimal',
        cardinality: 100,
        null_percent: 0,
        sample_values: [],
      };

      const result = processor.enrichField(field, sampleField, 1000);

      expect(result.type).toBe('decimal');
    });

    it('should handle null sample field', () => {
      const field: Stage1Field = { name: 'Test', type: 'string' };

      const result = processor.enrichField(field, null, 0);

      expect(result.type).toBe('string');
      expect(result.cardinality).toBe(0);
      expect(result.sample_values).toEqual([]);
    });

    it('should detect key candidates', () => {
      const field: Stage1Field = { name: 'CustomerID', type: 'integer' };
      const sampleField: QvdFieldSample = {
        name: 'CustomerID',
        type: 'integer',
        cardinality: 950,
        null_percent: 0,
        sample_values: ['1', '2'],
      };

      const result = processor.enrichField(field, sampleField, 1000);

      expect(result.is_key_candidate).toBe(true);
    });

    it('should detect date fields', () => {
      const field: Stage1Field = { name: 'OrderDate', type: 'date' };
      const result = processor.enrichField(field, null, 0);

      expect(result.is_date_field).toBe(true);
    });
  });

  describe('detectKeyCandidate', () => {
    const createEnrichedField = (name: string, cardinality: number, null_percent: number): EnrichedField => ({
      name,
      type: 'integer',
      cardinality,
      null_percent,
      is_key_candidate: false,
      is_date_field: false,
      sample_values: [],
    });

    it('should detect *ID fields as keys', () => {
      const field = createEnrichedField('CustomerID', 100, 0);
      expect(processor.detectKeyCandidate(field, 100)).toBe(true);
    });

    it('should detect *_id fields as keys', () => {
      const field = createEnrichedField('customer_id', 100, 0);
      expect(processor.detectKeyCandidate(field, 100)).toBe(true);
    });

    it('should detect *Key fields as keys', () => {
      const field = createEnrichedField('ProductKey', 100, 0);
      expect(processor.detectKeyCandidate(field, 100)).toBe(true);
    });

    it('should detect *Code fields as keys', () => {
      const field = createEnrichedField('CountryCode', 100, 0);
      expect(processor.detectKeyCandidate(field, 100)).toBe(true);
    });

    it('should detect pk_ prefixed fields as keys', () => {
      const field = createEnrichedField('pk_customer', 100, 0);
      expect(processor.detectKeyCandidate(field, 100)).toBe(true);
    });

    it('should detect fk_ prefixed fields as keys', () => {
      const field = createEnrichedField('fk_order', 100, 0);
      expect(processor.detectKeyCandidate(field, 100)).toBe(true);
    });

    it('should reject fields with high null percent', () => {
      const field = createEnrichedField('CustomerID', 100, 5);
      expect(processor.detectKeyCandidate(field, 100)).toBe(false);
    });

    it('should detect high uniqueness fields as keys', () => {
      const field = createEnrichedField('UniqueField', 950, 0);
      expect(processor.detectKeyCandidate(field, 1000)).toBe(true);
    });

    it('should reject low uniqueness non-key-named fields', () => {
      const field = createEnrichedField('Status', 5, 0);
      expect(processor.detectKeyCandidate(field, 1000)).toBe(false);
    });
  });

  describe('detectDateField', () => {
    const createEnrichedField = (name: string, type: string): EnrichedField => ({
      name,
      type,
      cardinality: 0,
      null_percent: 0,
      is_key_candidate: false,
      is_date_field: false,
      sample_values: [],
    });

    it('should detect *Date fields', () => {
      const field = createEnrichedField('OrderDate', 'date');
      expect(processor.detectDateField(field)).toBe(true);
    });

    it('should detect date_* fields', () => {
      const field = createEnrichedField('date_created', 'date');
      expect(processor.detectDateField(field)).toBe(true);
    });

    it('should detect *_at fields', () => {
      const field = createEnrichedField('created_at', 'datetime');
      expect(processor.detectDateField(field)).toBe(true);
    });

    it('should detect timestamp fields', () => {
      const field = createEnrichedField('timestamp', 'datetime');
      expect(processor.detectDateField(field)).toBe(true);
    });

    it('should detect date/datetime types', () => {
      const field = createEnrichedField('SomeField', 'datetime');
      expect(processor.detectDateField(field)).toBe(true);
    });

    it('should reject non-date fields', () => {
      const field = createEnrichedField('CustomerName', 'string');
      expect(processor.detectDateField(field)).toBe(false);
    });
  });

  describe('processRelationships', () => {
    it('should enrich relationships with cardinality', () => {
      const stage1 = createValidStage1Input({
        tables: [
          {
            name: 'Orders',
            source_name: 'orders.qvd',
            fields: [{ name: 'CustomerID', type: 'integer' }],
          },
          {
            name: 'Customers',
            source_name: 'customers.qvd',
            fields: [{ name: 'CustomerID', type: 'integer' }],
          },
        ],
        relationship_hints: [
          { from: 'Orders.CustomerID', to: 'Customers.CustomerID', type: 'many-to-one' },
        ],
      });

      const qvdSamples = [
        createValidQvdSample('Orders', [
          { name: 'CustomerID', type: 'integer', cardinality: 800, null_percent: 0, sample_values: [] },
        ]),
        createValidQvdSample('Customers', [
          { name: 'CustomerID', type: 'integer', cardinality: 1000, null_percent: 0, sample_values: [] },
        ]),
      ];

      const result = processor.process(stage1, qvdSamples);

      expect(result.relationships[0].from_cardinality).toBe(800);
      expect(result.relationships[0].to_cardinality).toBe(1000);
    });

    it('should mark invalid relationships', () => {
      const stage1 = createValidStage1Input({
        relationship_hints: [
          { from: 'NonExistent.Field', to: 'Customers.CustomerID', type: 'many-to-one' },
        ],
      });

      const result = processor.process(stage1, []);

      expect(result.relationships[0].validated).toBe(false);
    });

    it('should handle missing tables', () => {
      const stage1 = createValidStage1Input({
        relationship_hints: [
          { from: 'Customers.CustomerID', to: 'Missing.ID', type: 'one-to-one' },
        ],
      });

      const result = processor.process(stage1, []);

      expect(result.relationships[0].validated).toBe(false);
    });

    it('should handle missing fields', () => {
      const stage1 = createValidStage1Input({
        tables: [
          { name: 'Orders', source_name: 'orders.qvd', fields: [{ name: 'OrderID', type: 'integer' }] },
          { name: 'Customers', source_name: 'customers.qvd', fields: [{ name: 'CustomerID', type: 'integer' }] },
        ],
        relationship_hints: [
          { from: 'Orders.NonExistent', to: 'Customers.CustomerID', type: 'many-to-one' },
        ],
      });

      const result = processor.process(stage1, []);

      expect(result.relationships[0].validated).toBe(false);
    });
  });

  describe('inferRelationships', () => {
    it('should infer FK relationships from naming', () => {
      const stage1 = createValidStage1Input({
        tables: [
          {
            name: 'Orders',
            source_name: 'orders.qvd',
            fields: [
              { name: 'OrderID', type: 'integer' },
              { name: 'customer_id', type: 'integer' },
            ],
          },
          {
            name: 'Customers',
            source_name: 'customers.qvd',
            fields: [{ name: 'id', type: 'integer' }],
          },
        ],
      });

      const qvdSamples = [
        createValidQvdSample('Orders', [
          { name: 'OrderID', type: 'integer', cardinality: 10000, null_percent: 0, sample_values: [] },
          { name: 'customer_id', type: 'integer', cardinality: 500, null_percent: 0, sample_values: [] },
        ]),
        createValidQvdSample('Customers', [
          { name: 'id', type: 'integer', cardinality: 500, null_percent: 0, sample_values: [] },
        ]),
      ];

      const enriched = processor.process(stage1, qvdSamples);
      const hints = processor.inferRelationships(enriched.tables);

      expect(hints.length).toBeGreaterThan(0);
      expect(hints.some(h => h.from.includes('customer_id'))).toBe(true);
    });
  });

  describe('createInputProcessor factory', () => {
    it('should create InputProcessor instance', () => {
      const ip = createInputProcessor();
      expect(ip).toBeInstanceOf(InputProcessor);
    });
  });
});
