/**
 * Phase 0: Prerequisites & Setup Tests
 * Verifies extension compiles and loads correctly
 *
 * Run: npx ts-node test/e2e/00-prerequisites.test.ts
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

// Test results tracking
const results: { id: string; name: string; status: 'PASS' | 'FAIL'; error?: string }[] = [];

function test(id: string, name: string, fn: () => void | Promise<void>) {
  try {
    const result = fn();
    if (result instanceof Promise) {
      return result
        .then(() => {
          results.push({ id, name, status: 'PASS' });
          console.log(`  ✅ ${id}: ${name}`);
        })
        .catch((err) => {
          results.push({ id, name, status: 'FAIL', error: err.message });
          console.log(`  ❌ ${id}: ${name}`);
          console.log(`     Error: ${err.message}`);
        });
    }
    results.push({ id, name, status: 'PASS' });
    console.log(`  ✅ ${id}: ${name}`);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    results.push({ id, name, status: 'FAIL', error });
    console.log(`  ❌ ${id}: ${name}`);
    console.log(`     Error: ${error}`);
  }
}

// Paths
const ROOT = path.join(__dirname, '../..');
const OUT = path.join(ROOT, 'out');
const SRC = path.join(ROOT, 'src');

console.log('\n🧪 Phase 0: Prerequisites & Setup Tests\n');
console.log('='.repeat(50));

// ============================================
// 0.1 Extension Loading
// ============================================
console.log('\n📦 0.1 Extension Loading\n');

test('P0-01', 'Extension compiles without errors', () => {
  // Check that out folder exists with compiled files
  assert.ok(fs.existsSync(OUT), 'out/ folder should exist');
  assert.ok(fs.existsSync(path.join(OUT, 'extension.js')), 'extension.js should exist');
});

test('P0-02', 'wizardPanel.js exists and is recent', () => {
  const wizardPath = path.join(OUT, 'wizardPanel.js');
  assert.ok(fs.existsSync(wizardPath), 'wizardPanel.js should exist');

  const stats = fs.statSync(wizardPath);
  const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
  assert.ok(ageHours < 24, `wizardPanel.js should be recent (${ageHours.toFixed(1)}h old)`);
});

test('P0-03', 'dashboardUI.js exists', () => {
  const uiPath = path.join(OUT, 'ui', 'dashboardUI.js');
  assert.ok(fs.existsSync(uiPath), 'ui/dashboardUI.js should exist');
});

test('P0-04', 'qlikApi.js exists', () => {
  const apiPath = path.join(OUT, 'qlikApi.js');
  assert.ok(fs.existsSync(apiPath), 'qlikApi.js should exist');
});

test('P0-05', 'scriptGenerator.js exists', () => {
  const genPath = path.join(OUT, 'scriptGenerator.js');
  assert.ok(fs.existsSync(genPath), 'scriptGenerator.js should exist');
});

test('P0-06', 'ProjectSpec types exist', () => {
  const typesPath = path.join(OUT, 'types', 'ProjectSpec.js');
  assert.ok(fs.existsSync(typesPath), 'types/ProjectSpec.js should exist');
});

test('P0-07', 'package.json has correct main entry', () => {
  const pkgPath = path.join(ROOT, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  assert.strictEqual(pkg.main, './out/extension.js', 'main should point to out/extension.js');
});

// ============================================
// 0.2 Dependencies
// ============================================
console.log('\n📚 0.2 Dependencies\n');

test('P0-08', 'mammoth module available', () => {
  const mammothPath = path.join(ROOT, 'node_modules', 'mammoth');
  assert.ok(fs.existsSync(mammothPath), 'mammoth should be installed');
});

test('P0-09', 'xlsx module available', () => {
  const xlsxPath = path.join(ROOT, 'node_modules', 'xlsx');
  assert.ok(fs.existsSync(xlsxPath), 'xlsx should be installed');
});

test('P0-10', '@anthropic-ai/sdk module available', () => {
  const anthropicPath = path.join(ROOT, 'node_modules', '@anthropic-ai', 'sdk');
  assert.ok(fs.existsSync(anthropicPath), '@anthropic-ai/sdk should be installed');
});

test('P0-11', '@google/generative-ai module available', () => {
  const geminiPath = path.join(ROOT, 'node_modules', '@google', 'generative-ai');
  assert.ok(fs.existsSync(geminiPath), '@google/generative-ai should be installed');
});

// ============================================
// 0.3 Package.json Commands
// ============================================
console.log('\n⚙️ 0.3 Package.json Commands\n');

test('P0-12', 'Commands defined in package.json', () => {
  const pkgPath = path.join(ROOT, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

  const commands = pkg.contributes?.commands || [];
  const commandIds = commands.map((c: any) => c.command);

  assert.ok(commandIds.includes('qmb.openWizard'), 'qmb.openWizard command should exist');
  assert.ok(commandIds.includes('qmb.configure'), 'qmb.configure command should exist');
  assert.ok(commandIds.includes('qmb.newProject'), 'qmb.newProject command should exist');
});

test('P0-13', 'Views defined in package.json', () => {
  const pkgPath = path.join(ROOT, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

  const views = pkg.contributes?.views?.['qlik-model-builder'] || [];
  assert.ok(views.length > 0, 'Should have views defined');
  assert.ok(views.some((v: any) => v.id === 'qmb.wizardView'), 'wizardView should exist');
});

// ============================================
// Summary
// ============================================
console.log('\n' + '='.repeat(50));
const passed = results.filter(r => r.status === 'PASS').length;
const failed = results.filter(r => r.status === 'FAIL').length;
console.log(`\n📊 Phase 0 Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  console.log('❌ Failed tests:');
  results.filter(r => r.status === 'FAIL').forEach(r => {
    console.log(`   ${r.id}: ${r.name}`);
    console.log(`      ${r.error}`);
  });
  process.exit(1);
} else {
  console.log('✅ All Phase 0 tests passed!\n');
}
