// test/e2e/cleanup-qlik.ts
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

// Load .env.test directly (more reliable than dotenv with ts-node)
function loadEnvFile(): { tenantUrl: string; apiKey: string } {
  const envPath = path.join(__dirname, '../../.env.test');
  const content = fs.readFileSync(envPath, 'utf8');
  const tenantMatch = content.match(/QLIK_TENANT_URL=(.+)/);
  const keyMatch = content.match(/QLIK_API_KEY=(.+)/);

  if (!tenantMatch || !keyMatch) {
    throw new Error('Missing QLIK_TENANT_URL or QLIK_API_KEY in .env.test');
  }

  return {
    tenantUrl: tenantMatch[1].trim(),
    apiKey: keyMatch[1].trim()
  };
}

const { tenantUrl: TENANT_URL, apiKey: API_KEY } = loadEnvFile();
const TEST_PREFIX = 'QMB_TEST_'; // All test artifacts use this prefix

interface QlikItem {
  id: string;
  name: string;
}

async function apiCall<T>(method: string, endpoint: string, body?: object): Promise<T> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${TENANT_URL}${endpoint}`);
    const bodyStr = body ? JSON.stringify(body) : '';

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        ...(body && { 'Content-Length': Buffer.byteLength(bodyStr) })
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data ? JSON.parse(data) : {} as T);
        } else {
          reject(new Error(`API Error ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function cleanupTestArtifacts(): Promise<void> {
  console.log('🧹 Starting Qlik Cloud cleanup...');
  console.log(`   Prefix: ${TEST_PREFIX}`);

  // 1. Get and delete test spaces
  const spacesResponse = await apiCall<{ data: QlikItem[] }>('GET', '/api/v1/spaces');
  const testSpaces = spacesResponse.data.filter(s => s.name.startsWith(TEST_PREFIX));

  console.log(`   Found ${testSpaces.length} test spaces`);
  for (const space of testSpaces) {
    console.log(`   Deleting space: ${space.name}`);
    await apiCall('DELETE', `/api/v1/spaces/${space.id}`);
  }

  // 2. Get and delete test apps (not in spaces)
  const appsResponse = await apiCall<{ data: QlikItem[] }>('GET', '/api/v1/items?resourceType=app');
  const testApps = appsResponse.data.filter(a => a.name.startsWith(TEST_PREFIX));

  console.log(`   Found ${testApps.length} test apps`);
  for (const app of testApps) {
    console.log(`   Deleting app: ${app.name}`);
    await apiCall('DELETE', `/api/v1/apps/${app.id}`);
  }

  console.log('✅ Cleanup complete');
}

// Run if called directly
cleanupTestArtifacts().catch(console.error);

export { cleanupTestArtifacts, TEST_PREFIX };
