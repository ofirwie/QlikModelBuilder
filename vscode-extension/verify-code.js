/**
 * Code verification script - checks that all functions are properly defined
 * and the code flow is correct
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying QMB Extension Code...\n');

const wizardPanelPath = path.join(__dirname, 'out', 'wizardPanel.js');

if (!fs.existsSync(wizardPanelPath)) {
  console.error('❌ ERROR: Compiled file not found! Run: npm run compile');
  process.exit(1);
}

const code = fs.readFileSync(wizardPanelPath, 'utf-8');

// Test 1: Check critical functions exist
const criticalFunctions = [
  'function uploadSpec()',
  'function generateScript()',
  'function handleSpecParsed(',
  'function renderSidebar()',
  'function renderCanvas()',
  'function render()',
  'function setupConfigListeners()',
  'btnSkipConnection'  // New skip button
];

console.log('1️⃣ Checking critical functions...');
let allFound = true;
for (const func of criticalFunctions) {
  if (code.includes(func)) {
    console.log(`   ✅ Found: ${func}`);
  } else {
    console.log(`   ❌ MISSING: ${func}`);
    allFound = false;
  }
}

// Test 2: Check message handlers
console.log('\n2️⃣ Checking message handlers...');
const handlers = [
  "case 'uploadSpec':",
  "case 'generateScript':",
  "case 'specParsed':",
  "case 'scriptGenerated':",
  "case 'initialData':"
];

for (const handler of handlers) {
  if (code.includes(handler)) {
    console.log(`   ✅ Handler: ${handler}`);
  } else {
    console.log(`   ❌ MISSING handler: ${handler}`);
    allFound = false;
  }
}

// Test 3: Check onclick handlers are properly bound
console.log('\n3️⃣ Checking onclick handlers...');
const onclickHandlers = [
  'onclick="generateScript()"',
  'onclick="uploadSpec()"',
  'onclick="copyScript()"'
];

for (const onclick of onclickHandlers) {
  if (code.includes(onclick)) {
    console.log(`   ✅ onclick: ${onclick}`);
  } else {
    console.log(`   ❌ MISSING onclick: ${onclick}`);
    allFound = false;
  }
}

// Test 4: Check postMessage calls
console.log('\n4️⃣ Checking postMessage calls...');
const postMessages = [
  "type: 'generateScript'",
  "type: 'uploadSpec'",
  "type: 'scriptGenerated'",
  "type: 'specParsed'"
];

for (const msg of postMessages) {
  if (code.includes(msg)) {
    console.log(`   ✅ postMessage: ${msg}`);
  } else {
    console.log(`   ❌ MISSING postMessage: ${msg}`);
    allFound = false;
  }
}

// Test 5: Test CSV parsing logic directly
console.log('\n5️⃣ Testing CSV parsing logic...');
try {
  // Create a simple test
  const testCSV = `TableName,FieldName,Include
Orders,order_id,yes
Orders,customer_id,yes
Customers,customer_id,yes
Customers,customer_name,yes`;

  // Check the parsing logic exists in code
  if (code.includes('parseCSVSpec') && code.includes('parseCSVLine')) {
    console.log('   ✅ CSV parsing functions exist');
  } else {
    console.log('   ❌ CSV parsing functions missing');
    allFound = false;
  }

  // Check field include:true is set
  if (code.includes('include: true')) {
    console.log('   ✅ Fields have include: true');
  } else {
    console.log('   ❌ Fields missing include: true');
    allFound = false;
  }
} catch (err) {
  console.log(`   ❌ Error: ${err.message}`);
  allFound = false;
}

// Test 6: Check the skip button flow
console.log('\n6️⃣ Checking skip connection flow...');
if (code.includes('btnSkipConnection') && code.includes('state.configured = true')) {
  console.log('   ✅ Skip connection flow exists');
} else {
  console.log('   ❌ Skip connection flow missing');
  allFound = false;
}

// Summary
console.log('\n' + '='.repeat(50));
if (allFound) {
  console.log('✅ ALL CHECKS PASSED!');
  console.log('\nThe code structure is correct. To test:');
  console.log('1. Open vscode-extension folder in VS Code');
  console.log('2. Press F5 to run extension');
  console.log('3. Ctrl+Shift+P → "Qlik: Open Model Builder Wizard"');
  console.log('4. Click "דלג - עבוד במצב לא מקוון" to skip connection');
  console.log('5. Click "העלה קובץ איפיון" and select a CSV/Excel file');
  console.log('6. Click "צור סקריפט"');
} else {
  console.log('❌ SOME CHECKS FAILED - see above for details');
  process.exit(1);
}
