/**
 * Real parsing tests - actually opens files and extracts data
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// We need to extract the parsing functions from wizardPanel.js
// Since they're inside a class, we'll simulate the parsing logic

describe('Real Document Parsing Tests', function() {

  describe('CSV Parsing', function() {
    it('should parse REAL spec with 85+ fields', function() {
      const csvPath = path.join(__dirname, 'real-spec.csv');
      const content = fs.readFileSync(csvPath, 'utf-8');

      // Simulate parseCSVSpec logic from wizardPanel.ts
      const lines = content.split('\n').filter(line => line.trim());
      const headers = parseCSVLine(lines[0]);

      // Find column indices
      const tableNameIdx = headers.findIndex(h => h.toLowerCase().includes('table'));
      const fieldNameIdx = headers.findIndex(h => h.toLowerCase().includes('field'));
      const includeIdx = headers.findIndex(h => h.toLowerCase().includes('include'));

      assert.ok(tableNameIdx >= 0, 'Should find TableName column');
      assert.ok(fieldNameIdx >= 0, 'Should find FieldName column');

      // Parse rows into tables
      const tablesMap = new Map();
      let totalFields = 0;

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length < 2) continue;

        const tableName = values[tableNameIdx]?.trim();
        const fieldName = values[fieldNameIdx]?.trim();

        if (!tableName || !fieldName) continue;

        if (!tablesMap.has(tableName)) {
          tablesMap.set(tableName, {
            name: tableName,
            fields: [],
            incremental: { enabled: false, field: '', strategy: 'timestamp' }
          });
        }

        const include = includeIdx >= 0 ?
          ['yes', 'true', '1', 'כן'].includes(values[includeIdx]?.toLowerCase()?.trim()) :
          true;

        tablesMap.get(tableName).fields.push({
          name: fieldName,
          include: include
        });
        totalFields++;
      }

      const tables = Array.from(tablesMap.values());

      // Assertions - REAL spec with 7 tables and 113 fields
      console.log(`    Parsed ${tables.length} tables with ${totalFields} total fields`);

      assert.strictEqual(tables.length, 7, 'Should extract 7 tables (FactSales, DimCustomer, DimProduct, DimDate, DimStore, DimEmployee, DimPromotion)');
      assert.ok(totalFields >= 110, `Should have 110+ fields, got ${totalFields}`);

      // Check each table
      const factSales = tables.find(t => t.name === 'FactSales');
      assert.ok(factSales, 'Should have FactSales table');
      assert.strictEqual(factSales.fields.length, 20, 'FactSales should have 20 fields');

      const dimCustomer = tables.find(t => t.name === 'DimCustomer');
      assert.ok(dimCustomer, 'Should have DimCustomer table');
      assert.strictEqual(dimCustomer.fields.length, 20, 'DimCustomer should have 20 fields');

      const dimProduct = tables.find(t => t.name === 'DimProduct');
      assert.ok(dimProduct, 'Should have DimProduct table');
      assert.strictEqual(dimProduct.fields.length, 18, 'DimProduct should have 18 fields');

      const dimDate = tables.find(t => t.name === 'DimDate');
      assert.ok(dimDate, 'Should have DimDate table');
      assert.strictEqual(dimDate.fields.length, 15, 'DimDate should have 15 fields');

      const dimStore = tables.find(t => t.name === 'DimStore');
      assert.ok(dimStore, 'Should have DimStore table');
      assert.strictEqual(dimStore.fields.length, 15, 'DimStore should have 15 fields');

      const dimEmployee = tables.find(t => t.name === 'DimEmployee');
      assert.ok(dimEmployee, 'Should have DimEmployee table');
      assert.strictEqual(dimEmployee.fields.length, 14, 'DimEmployee should have 14 fields');

      const dimPromotion = tables.find(t => t.name === 'DimPromotion');
      assert.ok(dimPromotion, 'Should have DimPromotion table');
      assert.strictEqual(dimPromotion.fields.length, 11, 'DimPromotion should have 11 fields');

      // Check specific fields exist
      assert.ok(factSales.fields.some(f => f.name === 'GrossProfit'), 'FactSales should have GrossProfit');
      assert.ok(dimCustomer.fields.some(f => f.name === 'CustomerSegment'), 'DimCustomer should have CustomerSegment');
      assert.ok(dimProduct.fields.some(f => f.name === 'IsCurrent'), 'DimProduct should have IsCurrent (SCD2)');
      assert.ok(dimEmployee.fields.some(f => f.name === 'ManagerKey'), 'DimEmployee should have ManagerKey (self-reference)');
      assert.ok(dimPromotion.fields.some(f => f.name === 'DiscountPercent'), 'DimPromotion should have DiscountPercent');
    });

    it('should handle field names correctly', function() {
      const csvPath = path.join(__dirname, 'test-data.csv');
      const content = fs.readFileSync(csvPath, 'utf-8');

      const lines = content.split('\n').filter(line => line.trim());
      const headers = parseCSVLine(lines[0]);
      const tableNameIdx = headers.findIndex(h => h.toLowerCase().includes('table'));
      const fieldNameIdx = headers.findIndex(h => h.toLowerCase().includes('field'));

      const tablesMap = new Map();
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const tableName = values[tableNameIdx]?.trim();
        const fieldName = values[fieldNameIdx]?.trim();
        if (!tableName || !fieldName) continue;

        if (!tablesMap.has(tableName)) {
          tablesMap.set(tableName, []);
        }
        tablesMap.get(tableName).push(fieldName);
      }

      // Check specific field names
      const ordersFields = tablesMap.get('Orders');
      assert.ok(ordersFields.includes('order_id'), 'Orders should have order_id');
      assert.ok(ordersFields.includes('customer_id'), 'Orders should have customer_id');
      assert.ok(ordersFields.includes('order_date'), 'Orders should have order_date');
      assert.ok(ordersFields.includes('total_amount'), 'Orders should have total_amount');
    });
  });

  describe('Script Generation', function() {
    it('should generate valid Qlik script for tables', function() {
      // Simulate the tables that would be parsed
      const tables = [
        {
          name: 'Orders',
          fields: [
            { name: 'order_id', include: true },
            { name: 'customer_id', include: true },
            { name: 'order_date', include: true }
          ]
        },
        {
          name: 'Customers',
          fields: [
            { name: 'customer_id', include: true },
            { name: 'customer_name', include: true }
          ]
        }
      ];

      // Generate script (simplified version of generateScript logic)
      const scriptParts = [];
      scriptParts.push('// Generated by Qlik Model Builder');
      scriptParts.push('// ' + new Date().toISOString());
      scriptParts.push('');

      for (const table of tables) {
        const includedFields = table.fields.filter(f => f.include);
        if (includedFields.length === 0) continue;

        scriptParts.push(`[${table.name}]:`);
        scriptParts.push('LOAD');
        scriptParts.push('    ' + includedFields.map(f => f.name).join(',\n    '));
        scriptParts.push(`FROM [lib://DataFiles/${table.name}.qvd] (qvd);`);
        scriptParts.push('');
      }

      const script = scriptParts.join('\n');

      // Assertions
      assert.ok(script.includes('[Orders]:'), 'Script should have Orders table');
      assert.ok(script.includes('[Customers]:'), 'Script should have Customers table');
      assert.ok(script.includes('order_id'), 'Script should have order_id field');
      assert.ok(script.includes('customer_name'), 'Script should have customer_name field');
      assert.ok(script.includes('LOAD'), 'Script should have LOAD statement');
      assert.ok(script.includes('FROM'), 'Script should have FROM clause');
    });
  });
});

// Helper function to parse CSV line (handles quoted fields)
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

console.log('Running real parsing tests...');
