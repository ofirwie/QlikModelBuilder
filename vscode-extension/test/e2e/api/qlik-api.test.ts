/**
 * Qlik Cloud API Tests
 * Tests real API connectivity to Qlik Cloud
 *
 * Run: npx ts-node test/e2e/api/qlik-api.test.ts
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';

// Load env files (higher priority files loaded last to override)
const envFiles = [
  path.join(__dirname, '../../..', '.env'),
  path.join(__dirname, '../../..', '.env.test')
];

for (const envPath of envFiles) {
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && !key.startsWith('#') && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    });
  }
}

// Get credentials from environment
const TENANT_URL = process.env.QLIK_TENANT_URL || 'https://iyil7lpmybpzhbm.de.qlikcloud.com';
const API_KEY = process.env.QLIK_API_KEY;

// Test results tracking
const results: { id: string; name: string; status: 'PASS' | 'FAIL' | 'SKIP'; error?: string; data?: any }[] = [];

async function test(id: string, name: string, fn: () => Promise<void>) {
  if (!API_KEY && id.startsWith('API')) {
    results.push({ id, name, status: 'SKIP', error: 'QLIK_API_KEY not set' });
    console.log(`  ⏭️  ${id}: ${name} (SKIPPED - no API key)`);
    return;
  }

  try {
    await fn();
    results.push({ id, name, status: 'PASS' });
    console.log(`  ✅ ${id}: ${name}`);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    results.push({ id, name, status: 'FAIL', error });
    console.log(`  ❌ ${id}: ${name}`);
    console.log(`     Error: ${error}`);
  }
}

// Helper for API calls
async function qlikFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const url = `${TENANT_URL}${endpoint}`;
  const headers = {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
    ...options.headers
  };

  return fetch(url, { ...options, headers });
}

console.log('\n🧪 Qlik Cloud API Tests\n');
console.log('='.repeat(50));
console.log(`Tenant: ${TENANT_URL}`);
console.log(`API Key: ${API_KEY ? '***' + API_KEY.slice(-4) : 'NOT SET'}`);
console.log('='.repeat(50));

async function runTests() {
  // ============================================
  // API-1: Authentication Tests
  // ============================================
  console.log('\n🔐 API-1: Authentication\n');

  await test('API-1-01', 'GET /api/v1/users/me returns user info', async () => {
    const res = await qlikFetch('/api/v1/users/me');
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);

    const user = await res.json() as { id: string; name: string; email?: string };
    assert.ok(user.id, 'User should have id');
    assert.ok(user.name, 'User should have name');
    console.log(`     User: ${user.name} (${user.email || 'no email'})`);
  });

  await test('API-1-02', 'Invalid API key returns 401', async () => {
    const res = await fetch(`${TENANT_URL}/api/v1/users/me`, {
      headers: {
        'Authorization': 'Bearer invalid-key-12345',
        'Content-Type': 'application/json'
      }
    });
    assert.strictEqual(res.status, 401, `Expected 401, got ${res.status}`);
  });

  // ============================================
  // API-2: Spaces Tests
  // ============================================
  console.log('\n📁 API-2: Spaces\n');

  let spaces: any[] = [];

  await test('API-2-01', 'GET /api/v1/spaces returns array', async () => {
    const res = await qlikFetch('/api/v1/spaces');
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);

    const data = await res.json() as { data?: any[] } | any[];
    spaces = Array.isArray(data) ? data : (data.data || []);
    assert.ok(Array.isArray(spaces), 'Should return array');
    console.log(`     Found ${spaces.length} spaces`);
  });

  await test('API-2-02', 'Spaces have required fields', async () => {
    assert.ok(spaces.length > 0, 'Should have at least one space');

    const space = spaces[0];
    assert.ok(space.id, 'Space should have id');
    assert.ok(space.name, 'Space should have name');
    assert.ok(space.type, 'Space should have type');
    console.log(`     First space: ${space.name} (${space.type})`);
  });

  await test('API-2-03', 'GET /api/v1/spaces/{id} returns space details', async () => {
    if (spaces.length === 0) throw new Error('No spaces to test');

    const spaceId = spaces[0].id;
    const res = await qlikFetch(`/api/v1/spaces/${spaceId}`);
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);

    const space = await res.json() as { id: string };
    assert.strictEqual(space.id, spaceId, 'Should return correct space');
  });

  // ============================================
  // API-3: Apps Tests
  // ============================================
  console.log('\n📱 API-3: Apps\n');

  let apps: any[] = [];

  await test('API-3-01', 'GET /api/v1/apps returns array', async () => {
    const res = await qlikFetch('/api/v1/apps');
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);

    const data = await res.json() as { data?: any[] } | any[];
    apps = Array.isArray(data) ? data : (data.data || []);
    assert.ok(Array.isArray(apps), 'Should return array');
    console.log(`     Found ${apps.length} apps`);
  });

  await test('API-3-02', 'Apps have required fields', async () => {
    if (apps.length === 0) {
      console.log('     No apps found - skipping field validation');
      return;
    }

    const app = apps[0];
    // Apps API may return 'id' or 'resourceId' depending on endpoint
    const appId = app.id || app.resourceId || app.attributes?.id;
    const appName = app.name || app.attributes?.name;
    assert.ok(appId, 'App should have id/resourceId');
    assert.ok(appName, 'App should have name');
    console.log(`     First app: ${appName} (${appId})`);
  });

  // ============================================
  // API-4: Data Connections Tests
  // ============================================
  console.log('\n🔗 API-4: Data Connections\n');

  let connections: any[] = [];

  await test('API-4-01', 'GET /api/v1/data-connections returns array', async () => {
    const res = await qlikFetch('/api/v1/data-connections');
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);

    const data = await res.json() as { data?: any[] } | any[];
    connections = Array.isArray(data) ? data : (data.data || []);
    assert.ok(Array.isArray(connections), 'Should return array');
    console.log(`     Found ${connections.length} connections`);
  });

  await test('API-4-02', 'Connections have required fields', async () => {
    if (connections.length === 0) {
      console.log('     No connections found - skipping field validation');
      return;
    }

    const conn = connections[0];
    assert.ok(conn.id, 'Connection should have id');
    assert.ok(conn.qName || conn.name, 'Connection should have name');
    console.log(`     First connection: ${conn.qName || conn.name}`);
  });

  // ============================================
  // API-5: Items/Search Tests
  // ============================================
  console.log('\n🔍 API-5: Items & Search\n');

  await test('API-5-01', 'GET /api/v1/items returns items', async () => {
    const res = await qlikFetch('/api/v1/items?limit=10');
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);

    const data = await res.json() as { data?: any[] } | any[];
    const items = Array.isArray(data) ? data : (data.data || []);
    assert.ok(Array.isArray(items), 'Should return array');
    console.log(`     Found ${items.length} items`);
  });

  await test('API-5-02', 'Search apps by type', async () => {
    const res = await qlikFetch('/api/v1/items?resourceType=app&limit=5');
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);

    const data = await res.json() as { data?: any[] } | any[];
    const items = Array.isArray(data) ? data : (data.data || []);
    items.forEach((item: any) => {
      assert.strictEqual(item.resourceType, 'app', 'All items should be apps');
    });
  });

  // ============================================
  // Summary
  // ============================================
  console.log('\n' + '='.repeat(50));
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;

  console.log(`\n📊 API Test Results: ${passed} passed, ${failed} failed, ${skipped} skipped\n`);

  if (failed > 0) {
    console.log('❌ Failed tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`   ${r.id}: ${r.name}`);
      console.log(`      ${r.error}`);
    });
    process.exit(1);
  } else if (skipped === results.length) {
    console.log('⚠️  All tests skipped - set QLIK_API_KEY environment variable\n');
    process.exit(0);
  } else {
    console.log('✅ All API tests passed!\n');
  }
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
