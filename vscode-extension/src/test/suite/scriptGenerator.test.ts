/**
 * Script Generator Unit Tests
 * Tests script generation using REAL Olist specification data
 */

import * as assert from 'assert';
import { ScriptGenerator } from '../../scriptGenerator';
import {
  ProjectSpec,
  TableSpec,
  createEmptyProjectSpec
} from '../../types/ProjectSpec';

// Real Olist data from docs/Olist_Tables_Summary.csv
const OLIST_TABLES: Array<{
  name: string;
  type: 'Fact' | 'Dimension';
  numFields: number;
  keyField: string;
}> = [
  { name: 'olist_orders_dataset', type: 'Fact', numFields: 8, keyField: 'order_id' },
  { name: 'olist_order_items_dataset', type: 'Fact', numFields: 7, keyField: 'order_id' },
  { name: 'olist_customers_dataset', type: 'Dimension', numFields: 5, keyField: 'customer_id' },
  { name: 'olist_products_dataset', type: 'Dimension', numFields: 9, keyField: 'product_id' },
  { name: 'olist_sellers_dataset', type: 'Dimension', numFields: 4, keyField: 'seller_id' },
  { name: 'olist_order_payments_dataset', type: 'Fact', numFields: 5, keyField: 'order_id' },
  { name: 'olist_order_reviews_dataset', type: 'Fact', numFields: 7, keyField: 'review_id' },
  { name: 'olist_geolocation_dataset', type: 'Dimension', numFields: 5, keyField: 'geolocation_zip_code_prefix' },
  { name: 'product_category_name_translation', type: 'Dimension', numFields: 2, keyField: 'product_category_name' }
];

/**
 * Create a test ProjectSpec based on real Olist data
 */
function createOlistProject(): ProjectSpec {
  const project = createEmptyProjectSpec('docs/Olist_Tables_Summary.csv');

  project.qlikConfig = {
    appName: 'Olist E-commerce Analytics',
    connections: [
      { name: 'OlistDB', type: 'database' },
      { name: 'DataFiles', type: 'datafiles' }
    ]
  };

  // Create tables from real Olist data
  project.tables = OLIST_TABLES.map((t): TableSpec => ({
    name: t.name,
    type: t.type,
    description: `${t.type} table with ${t.numFields} fields`,
    keyField: t.keyField,
    incrementalField: t.type === 'Fact' ? 'order_approved_at' : undefined,
    fields: generateFieldsForTable(t.name, t.numFields, t.keyField)
  }));

  // Set incremental config for Fact tables
  project.userSelections = {
    mode: 'spec',
    selectedTables: project.tables.map(t => t.name),
    incrementalConfig: {}
  };

  // Configure incremental for Fact tables
  project.tables
    .filter(t => t.type === 'Fact')
    .forEach(t => {
      project.userSelections.incrementalConfig[t.name] = {
        enabled: true,
        strategy: 'insert_only',
        field: 'order_approved_at',
        keepHistory: false
      };
    });

  return project;
}

/**
 * Generate realistic field list for a table
 */
function generateFieldsForTable(
  tableName: string,
  numFields: number,
  keyField: string
) {
  const fields = [];

  // Add key field first
  fields.push({
    name: keyField,
    keyType: 'PK' as const,
    include: true
  });

  // Add remaining fields
  for (let i = 1; i < numFields; i++) {
    fields.push({
      name: `field_${i}`,
      keyType: null,
      include: true
    });
  }

  return fields;
}

suite('ScriptGenerator Tests', () => {

  test('should generate script with correct header', () => {
    const generator = new ScriptGenerator();
    const project = createOlistProject();
    const script = generator.generate(project);

    assert.ok(script.includes('QlikModelBuilder'), 'Should include generator name');
    assert.ok(script.includes('Olist E-commerce Analytics'), 'Should include project name');
    assert.ok(script.includes('9'), 'Should mention table count');
  });

  test('should generate script for all 9 Olist tables', () => {
    const generator = new ScriptGenerator();
    const project = createOlistProject();
    const script = generator.generate(project);

    // Verify all 9 tables are in the script
    for (const table of OLIST_TABLES) {
      assert.ok(
        script.includes(table.name),
        `Script should include table: ${table.name}`
      );
    }
  });

  test('should generate incremental pattern for Fact tables', () => {
    const generator = new ScriptGenerator();
    const project = createOlistProject();
    const script = generator.generate(project);

    // Fact tables should have incremental pattern
    assert.ok(script.includes('IF NOT IsNull(FileSize'), 'Should have incremental IF check');
    assert.ok(script.includes('Concatenate'), 'Should have Concatenate for incremental');
    assert.ok(script.includes('END IF'), 'Should have END IF');
  });

  test('should generate full load for Dimension tables', () => {
    const generator = new ScriptGenerator();
    const project = createOlistProject();
    const script = generator.generate(project);

    // Check that dimension tables are loaded
    assert.ok(
      script.includes('olist_customers_dataset'),
      'Should include customer dimension'
    );
  });

  test('should generate valid QVD store statements', () => {
    const generator = new ScriptGenerator();
    const project = createOlistProject();
    const script = generator.generate(project);

    // Should have STORE statements for QVD files
    assert.ok(script.includes('STORE'), 'Should have STORE statements');
    assert.ok(script.includes('.qvd'), 'Should reference QVD files');
  });

  test('should generate LIB connection references', () => {
    const generator = new ScriptGenerator();
    const project = createOlistProject();
    const script = generator.generate(project);

    // Should have LIB references
    assert.ok(script.includes('lib://'), 'Should have lib:// references');
  });

  test('should validate script syntax', () => {
    const generator = new ScriptGenerator();
    const project = createOlistProject();
    const script = generator.generate(project);

    const validation = generator.validateScript(script);
    assert.ok(
      validation.valid,
      `Script should be valid. Errors: ${validation.errors.join(', ')}`
    );
  });

  test('should have 4 Fact and 5 Dimension tables', () => {
    const project = createOlistProject();

    const factCount = project.tables.filter(t => t.type === 'Fact').length;
    const dimCount = project.tables.filter(t => t.type === 'Dimension').length;

    assert.strictEqual(factCount, 4, 'Should have 4 Fact tables');
    assert.strictEqual(dimCount, 5, 'Should have 5 Dimension tables');
  });

  test('should generate variables section', () => {
    const generator = new ScriptGenerator();
    const project = createOlistProject();
    const script = generator.generate(project);

    assert.ok(script.includes('LET vQVDPath'), 'Should have QVD path variable');
    assert.ok(script.includes('LET vLastReload'), 'Should have reload timestamp');
  });

  test('should support Hebrew comments option', () => {
    const generator = new ScriptGenerator({ hebrewComments: true });
    const project = createOlistProject();
    const script = generator.generate(project);

    // Hebrew comments
    assert.ok(
      script.includes('נוצר אוטומטית') || script.includes('משתנים'),
      'Should have Hebrew comments'
    );
  });

  test('should support English comments option', () => {
    const generator = new ScriptGenerator({ hebrewComments: false });
    const project = createOlistProject();
    const script = generator.generate(project);

    assert.ok(script.includes('Auto-generated'), 'Should have English comments');
  });

});
