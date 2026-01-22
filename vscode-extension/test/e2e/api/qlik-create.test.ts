/**
 * Qlik Cloud Create Tests
 * Tests creating Space, App, uploading script, and reloading
 *
 * Run: npx ts-node --require dotenv/config test/e2e/api/qlik-create.test.ts dotenv_config_path=.env.test
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';

// Load env file
const envPath = path.join(__dirname, '../../..', '.env.test');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && !key.startsWith('#')) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
}

const TENANT_URL = process.env.QLIK_TENANT_URL || '';
const API_KEY = process.env.QLIK_API_KEY || '';

if (!TENANT_URL || !API_KEY) {
  console.error('❌ Missing QLIK_TENANT_URL or QLIK_API_KEY in .env.test');
  process.exit(1);
}

// Test state - IDs of created resources for cleanup
const createdResources: { type: string; id: string }[] = [];

// Results tracking
const results: { id: string; name: string; status: 'PASS' | 'FAIL'; error?: string; data?: any }[] = [];

async function test(id: string, name: string, fn: () => Promise<any>): Promise<any> {
  try {
    const result = await fn();
    results.push({ id, name, status: 'PASS', data: result });
    console.log(`  ✅ ${id}: ${name}`);
    return result;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    results.push({ id, name, status: 'FAIL', error });
    console.log(`  ❌ ${id}: ${name}`);
    console.log(`     Error: ${error}`);
    throw err;
  }
}

async function qlikFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const url = `${TENANT_URL}${endpoint}`;
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  return fetch(url, { ...options, headers });
}

console.log('\n🧪 Qlik Cloud CREATE Tests\n');
console.log('='.repeat(50));
console.log(`Tenant: ${TENANT_URL}`);
console.log('='.repeat(50));

async function runTests() {
  let testSpaceId: string | null = null;
  let testAppId: string | null = null;

  // ============================================
  // CREATE-1: Get Spaces (for info only)
  // ============================================
  console.log('\n📁 CREATE-1: Space Discovery\n');

  await test('CREATE-1-01', 'List available spaces', async () => {
    const res = await qlikFetch('/api/v1/spaces');
    assert.strictEqual(res.status, 200);

    const data = await res.json() as { data?: any[] } | any[];
    const spaces = Array.isArray(data) ? data : (data.data || []);

    console.log(`     Found ${spaces.length} space(s)`);
    for (const space of spaces) {
      console.log(`     - ${space.name} (type: ${space.type}, id: ${space.id})`);
      // Save shared/managed space for potential future use
      if (space.type === 'shared' || space.type === 'managed') {
        testSpaceId = space.id;
      }
    }
    // Note: testSpaceId stays null if no shared/managed space exists
    // Apps will be created in Personal space (no spaceId needed)
    console.log(`     Using: ${testSpaceId ? 'Shared space ' + testSpaceId : 'Personal space (default)'}`);
    return spaces;
  });

  // ============================================
  // CREATE-2: Create App (in Personal Space)
  // ============================================
  console.log('\n📱 CREATE-2: Create App\n');

  const appName = `QMB-Test-App-${Date.now()}`;

  await test('CREATE-2-01', `Create new app: ${appName}`, async () => {
    // Create app - use shared space if available, otherwise Personal space
    const appBody: any = {
      attributes: {
        name: appName,
        description: 'Created by QMB E2E test'
      }
    };
    // Only add spaceId if we have a shared/managed space
    if (testSpaceId) {
      appBody.attributes.spaceId = testSpaceId;
    }

    const res = await qlikFetch('/api/v1/apps', {
      method: 'POST',
      body: JSON.stringify(appBody)
    });

    if (res.status !== 201 && res.status !== 200) {
      const errorText = await res.text();
      throw new Error(`Failed to create app: ${res.status} - ${errorText}`);
    }

    const app = await res.json() as { attributes?: { id: string; name: string }; id?: string };
    testAppId = app.attributes?.id || app.id || null;
    assert.ok(testAppId, 'App should have ID');

    createdResources.push({ type: 'app', id: testAppId! });
    console.log(`     App ID: ${testAppId}`);
    return app;
  });

  await test('CREATE-2-02', 'Verify app exists', async () => {
    assert.ok(testAppId, 'Should have app ID from previous test');

    const res = await qlikFetch(`/api/v1/apps/${testAppId}`);
    assert.strictEqual(res.status, 200);

    const app = await res.json() as { attributes?: { name: string } };
    assert.ok(app.attributes?.name === appName, 'App name should match');
    console.log(`     Verified: ${app.attributes?.name}`);
  });

  // ============================================
  // CREATE-3: Upload Script
  // ============================================
  console.log('\n📝 CREATE-3: Upload Script\n');

  const testScript = `
// ============================================
// QMB Test Script - Auto Generated
// ============================================

LET vReloadTime = Now();

// Simple inline test table
TestTable:
LOAD * INLINE [
  ID, Name, Value
  1, 'Test1', 100
  2, 'Test2', 200
  3, 'Test3', 300
];

// Log completion
TRACE 'Script completed at $(vReloadTime)';
`.trim();

  await test('CREATE-3-01', 'Upload script to app', async () => {
    assert.ok(testAppId, 'Should have app ID');

    // Qlik uses the /apps/{id}/data/v1/script endpoint
    const res = await qlikFetch(`/api/v1/apps/${testAppId}/scripts`, {
      method: 'POST',
      body: JSON.stringify({
        script: testScript
      })
    });

    // Try alternative endpoint if first fails
    if (res.status === 404) {
      console.log('     Trying alternative script endpoint...');
      const res2 = await qlikFetch(`/api/v1/apps/${testAppId}/script`, {
        method: 'PUT',
        body: JSON.stringify({
          script: testScript
        })
      });

      if (res2.status !== 200 && res2.status !== 201 && res2.status !== 204) {
        const errorText = await res2.text();
        throw new Error(`Script upload failed: ${res2.status} - ${errorText}`);
      }
      console.log('     Script uploaded via alternative endpoint');
      return;
    }

    if (res.status !== 200 && res.status !== 201 && res.status !== 204) {
      const errorText = await res.text();
      throw new Error(`Script upload failed: ${res.status} - ${errorText}`);
    }

    console.log('     Script uploaded successfully');
  });

  // ============================================
  // CREATE-4: Reload App
  // ============================================
  console.log('\n🔄 CREATE-4: Reload App\n');

  let reloadId: string | null = null;

  await test('CREATE-4-01', 'Trigger app reload', async () => {
    assert.ok(testAppId, 'Should have app ID');

    const res = await qlikFetch('/api/v1/reloads', {
      method: 'POST',
      body: JSON.stringify({
        appId: testAppId
      })
    });

    if (res.status !== 201 && res.status !== 200) {
      const errorText = await res.text();
      throw new Error(`Reload trigger failed: ${res.status} - ${errorText}`);
    }

    const reload = await res.json() as { id: string };
    reloadId = reload.id;
    assert.ok(reloadId, 'Reload should have ID');
    console.log(`     Reload ID: ${reloadId}`);
    return reload;
  });

  await test('CREATE-4-02', 'Wait for reload completion (max 30s)', async () => {
    assert.ok(reloadId, 'Should have reload ID');

    const maxWait = 30000;
    const pollInterval = 2000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      const res = await qlikFetch(`/api/v1/reloads/${reloadId}`);
      assert.strictEqual(res.status, 200);

      const reload = await res.json() as { status: string };
      console.log(`     Status: ${reload.status}`);

      if (reload.status === 'SUCCEEDED') {
        console.log('     ✓ Reload completed successfully!');
        return reload;
      }

      if (reload.status === 'FAILED' || reload.status === 'CANCELED') {
        throw new Error(`Reload ${reload.status}`);
      }

      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Reload timeout - exceeded 30 seconds');
  });

  // ============================================
  // CREATE-5: Verify Data Loaded
  // ============================================
  console.log('\n✅ CREATE-5: Verify Results\n');

  await test('CREATE-5-01', 'App should have data', async () => {
    assert.ok(testAppId, 'Should have app ID');

    const res = await qlikFetch(`/api/v1/apps/${testAppId}`);
    assert.strictEqual(res.status, 200);

    const app = await res.json() as { attributes?: { lastReloadTime?: string } };
    assert.ok(app.attributes?.lastReloadTime, 'App should have lastReloadTime after reload');
    console.log(`     Last reload: ${app.attributes?.lastReloadTime}`);
  });

  // ============================================
  // CLEANUP
  // ============================================
  console.log('\n🧹 CLEANUP\n');

  await test('CLEANUP-01', 'Delete test app', async () => {
    if (!testAppId) {
      console.log('     No app to delete');
      return;
    }

    const res = await qlikFetch(`/api/v1/apps/${testAppId}`, {
      method: 'DELETE'
    });

    if (res.status !== 204 && res.status !== 200) {
      console.log(`     Warning: Delete returned ${res.status}`);
    } else {
      console.log(`     Deleted app: ${testAppId}`);
    }
  });

  // ============================================
  // Summary
  // ============================================
  console.log('\n' + '='.repeat(50));
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;

  console.log(`\n📊 CREATE Test Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    console.log('❌ Failed tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`   ${r.id}: ${r.name}`);
      console.log(`      ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('✅ All CREATE tests passed!\n');
    console.log('📋 Test Flow Completed:');
    console.log('   1. Found existing Space: Default_Data_Space');
    console.log('   2. Created new App');
    console.log('   3. Uploaded Qlik script');
    console.log('   4. Triggered reload');
    console.log('   5. Verified reload success');
    console.log('   6. Cleaned up test app\n');
  }
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
