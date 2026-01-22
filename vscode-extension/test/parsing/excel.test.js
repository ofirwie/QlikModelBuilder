/**
 * Excel parsing tests
 */

const assert = require('assert');
const path = require('path');
const XLSX = require('xlsx');

describe('Excel Parsing Tests', function() {

  // Create test Excel file
  before(function() {
    const data = [
      ['TableName', 'FieldName', 'Include', 'KeyType', 'Description'],
      ['Sales', 'sale_id', 'yes', 'PK', 'Sale identifier'],
      ['Sales', 'product_id', 'yes', 'FK', 'Product reference'],
      ['Sales', 'quantity', 'yes', '', 'Quantity sold'],
      ['Sales', 'sale_date', 'yes', '', 'Date of sale'],
      ['Inventory', 'product_id', 'yes', 'PK', 'Product ID'],
      ['Inventory', 'warehouse_id', 'yes', 'FK', 'Warehouse'],
      ['Inventory', 'stock_level', 'yes', '', 'Current stock']
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Spec');

    const excelPath = path.join(__dirname, 'test-data.xlsx');
    XLSX.writeFile(wb, excelPath);
  });

  it('should parse Excel file and extract tables', function() {
    const excelPath = path.join(__dirname, 'test-data.xlsx');
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Find column indices
    const headers = jsonData[0].map(h => h?.toString().toLowerCase() || '');
    const tableNameIdx = headers.findIndex(h => h.includes('table'));
    const fieldNameIdx = headers.findIndex(h => h.includes('field'));
    const includeIdx = headers.findIndex(h => h.includes('include'));

    assert.ok(tableNameIdx >= 0, 'Should find TableName column');
    assert.ok(fieldNameIdx >= 0, 'Should find FieldName column');

    // Parse into tables
    const tablesMap = new Map();

    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      const tableName = row[tableNameIdx]?.toString().trim();
      const fieldName = row[fieldNameIdx]?.toString().trim();

      if (!tableName || !fieldName) continue;

      if (!tablesMap.has(tableName)) {
        tablesMap.set(tableName, {
          name: tableName,
          fields: [],
          incremental: { enabled: false, field: '', strategy: 'timestamp' }
        });
      }

      const include = includeIdx >= 0 ?
        ['yes', 'true', '1'].includes(row[includeIdx]?.toString().toLowerCase().trim()) :
        true;

      tablesMap.get(tableName).fields.push({
        name: fieldName,
        include: include
      });
    }

    const tables = Array.from(tablesMap.values());

    // Assertions
    assert.strictEqual(tables.length, 2, 'Should extract 2 tables');

    const salesTable = tables.find(t => t.name === 'Sales');
    assert.ok(salesTable, 'Should have Sales table');
    assert.strictEqual(salesTable.fields.length, 4, 'Sales should have 4 fields');

    const inventoryTable = tables.find(t => t.name === 'Inventory');
    assert.ok(inventoryTable, 'Should have Inventory table');
    assert.strictEqual(inventoryTable.fields.length, 3, 'Inventory should have 3 fields');
  });

  it('should handle include column correctly', function() {
    const excelPath = path.join(__dirname, 'test-data.xlsx');
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const headers = jsonData[0].map(h => h?.toString().toLowerCase() || '');
    const includeIdx = headers.findIndex(h => h.includes('include'));

    let includedCount = 0;
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      const includeValue = row[includeIdx]?.toString().toLowerCase().trim();
      if (['yes', 'true', '1'].includes(includeValue)) {
        includedCount++;
      }
    }

    assert.strictEqual(includedCount, 7, 'All 7 fields should be marked as included');
  });
});

console.log('Running Excel parsing tests...');
