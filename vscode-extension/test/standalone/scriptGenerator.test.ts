/**
 * Standalone Script Generator Tests
 * Runs with: npx ts-node test/standalone/scriptGenerator.test.ts
 */

import * as assert from 'assert';

// Import directly from source
import { ScriptGenerator } from '../../src/scriptGenerator';
import {
  ProjectSpec,
  TableSpec,
  createEmptyProjectSpec
} from '../../src/types/ProjectSpec';

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

function createOlistProject(): ProjectSpec {
  const project = createEmptyProjectSpec('docs/Olist_Tables_Summary.csv');

  project.qlikConfig = {
    appName: 'Olist E-commerce Analytics',
    connections: [
      { name: 'OlistDB', type: 'database' },
      { name: 'DataFiles', type: 'datafiles' }
    ]
  };

  project.tables = OLIST_TABLES.map((t): TableSpec => ({
    name: t.name,
    type: t.type,
    description: `${t.type} table with ${t.numFields} fields`,
    keyField: t.keyField,
    incrementalField: t.type === 'Fact' ? 'order_approved_at' : undefined,
    fields: [
      { name: t.keyField, keyType: 'PK' as const, include: true },
      ...Array.from({ length: t.numFields - 1 }, (_, i) => ({
        name: `field_${i + 1}`,
        keyType: null,
        include: true
      }))
    ]
  }));

  project.userSelections = {
    mode: 'spec',
    selectedTables: project.tables.map(t => t.name),
    incrementalConfig: {}
  };

  // Incremental for Fact tables
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

// Test runner
let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}`);
    console.log(`     Error: ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

console.log('\n🧪 Script Generator Tests (Real Olist Data)\n');
console.log('=' .repeat(50));

// Test 1
test('Should have 9 tables in Olist spec', () => {
  const project = createOlistProject();
  assert.strictEqual(project.tables.length, 9);
});

// Test 2
test('Should have 4 Fact and 5 Dimension tables', () => {
  const project = createOlistProject();
  const factCount = project.tables.filter(t => t.type === 'Fact').length;
  const dimCount = project.tables.filter(t => t.type === 'Dimension').length;
  assert.strictEqual(factCount, 4, `Expected 4 Fact, got ${factCount}`);
  assert.strictEqual(dimCount, 5, `Expected 5 Dimension, got ${dimCount}`);
});

// Test 3
test('Should generate script with header', () => {
  const generator = new ScriptGenerator();
  const project = createOlistProject();
  const script = generator.generate(project);
  assert.ok(script.includes('QlikModelBuilder'));
  assert.ok(script.includes('Olist E-commerce Analytics'));
});

// Test 4
test('Should include all 9 table names in script', () => {
  const generator = new ScriptGenerator();
  const project = createOlistProject();
  const script = generator.generate(project);

  for (const table of OLIST_TABLES) {
    assert.ok(script.includes(table.name), `Missing table: ${table.name}`);
  }
});

// Test 5
test('Should generate incremental pattern for Fact tables', () => {
  const generator = new ScriptGenerator();
  const project = createOlistProject();
  const script = generator.generate(project);

  assert.ok(script.includes('IF NOT IsNull(FileSize'), 'Missing IF FileSize check');
  assert.ok(script.includes('Concatenate'), 'Missing Concatenate');
  assert.ok(script.includes('END IF'), 'Missing END IF');
});

// Test 6
test('Should generate STORE statements for QVD', () => {
  const generator = new ScriptGenerator();
  const project = createOlistProject();
  const script = generator.generate(project);

  assert.ok(script.includes('STORE'), 'Missing STORE');
  assert.ok(script.includes('.qvd'), 'Missing .qvd reference');
});

// Test 7
test('Should generate LIB connection references', () => {
  const generator = new ScriptGenerator();
  const project = createOlistProject();
  const script = generator.generate(project);

  assert.ok(script.includes('lib://'), 'Missing lib:// reference');
});

// Test 8
test('Should validate script syntax (balanced brackets)', () => {
  const generator = new ScriptGenerator();
  const project = createOlistProject();
  const script = generator.generate(project);

  const validation = generator.validateScript(script);
  assert.ok(validation.valid, `Validation failed: ${validation.errors.join(', ')}`);
});

// Test 9
test('Should generate variables section', () => {
  const generator = new ScriptGenerator();
  const project = createOlistProject();
  const script = generator.generate(project);

  assert.ok(script.includes('LET vQVDPath'), 'Missing vQVDPath');
  assert.ok(script.includes('LET vLastReload'), 'Missing vLastReload');
});

// Test 10 - Show actual output
test('Generated script length is reasonable', () => {
  const generator = new ScriptGenerator();
  const project = createOlistProject();
  const script = generator.generate(project);

  // Should be substantial (at least 2000 chars for 9 tables)
  assert.ok(script.length > 2000, `Script too short: ${script.length} chars`);
  console.log(`     Script length: ${script.length} characters`);
});

// Summary
console.log('\n' + '=' .repeat(50));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
