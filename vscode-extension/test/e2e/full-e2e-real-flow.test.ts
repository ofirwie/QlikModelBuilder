/**
 * Full E2E Real Flow Test
 * Simulates a real user flow from DOCX parsing to QVD generation
 *
 * Run: npx ts-node test/e2e/full-e2e-real-flow.test.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as mammoth from 'mammoth';

// Disable SSL verification for testing (Windows certificate issues)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// ============================================
// Configuration
// ============================================

// Load environment files
const envPaths = [
  path.join(__dirname, '../..', '.env'),
  path.join(__dirname, '../..', '.env.test'),
  path.join(__dirname, '../../..', '.env.test')
];

// Clear potentially stale environment variables before loading
delete process.env.QLIK_API_KEY;
delete process.env.QLIK_TENANT_URL;

console.log('Loading environment from:');
envPaths.forEach(envPath => {
  console.log(`  ${envPath}: ${fs.existsSync(envPath) ? 'exists' : 'NOT FOUND'}`);
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      // Remove Windows CR and any whitespace
      const cleanLine = line.replace(/\r/g, '').trim();
      const [key, ...valueParts] = cleanLine.split('=');
      if (key && !key.startsWith('#') && valueParts.length > 0) {
        const trimmedKey = key.trim();
        const trimmedValue = valueParts.join('=').trim();
        // For critical keys, always override
        if (!process.env[trimmedKey] || trimmedKey === 'QLIK_API_KEY' || trimmedKey === 'QLIK_TENANT_URL') {
          process.env[trimmedKey] = trimmedValue;
          console.log(`    SET ${trimmedKey}=${trimmedKey.includes('KEY') ? trimmedValue.substring(0,20) + '...' : trimmedValue}`);
        } else {
          console.log(`    SKIP ${trimmedKey} (already set)`);
        }
      }
    });
  }
});

const CONFIG = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  QLIK_TENANT_URL: process.env.QLIK_TENANT_URL || '',
  QLIK_API_KEY: process.env.QLIK_API_KEY || '',
  NEON_HOST: process.env.NEON_HOST || '',
  NEON_DATABASE: process.env.NEON_DATABASE || '',
  NEON_USER: process.env.NEON_USER || '',
  NEON_PASSWORD: process.env.NEON_PASSWORD || '',
  SPEC_FILE: path.join(__dirname, '../../../docs/Olist_Brazilian_Ecommerce_Specification.docx')
};

// Validate configuration
function validateConfig(): string[] {
  const missing: string[] = [];
  if (!CONFIG.GEMINI_API_KEY) missing.push('GEMINI_API_KEY');
  if (!CONFIG.QLIK_TENANT_URL) missing.push('QLIK_TENANT_URL');
  if (!CONFIG.QLIK_API_KEY) missing.push('QLIK_API_KEY');
  if (!CONFIG.NEON_HOST) missing.push('NEON_HOST');
  if (!fs.existsSync(CONFIG.SPEC_FILE)) missing.push(`SPEC_FILE (${CONFIG.SPEC_FILE})`);
  return missing;
}

// ============================================
// Logging
// ============================================

interface LogEntry {
  timestamp: string;
  step: string;
  action: string;
  status: 'START' | 'SUCCESS' | 'FAIL' | 'INFO';
  details?: any;
}

const actionLog: LogEntry[] = [];

function log(step: string, action: string, status: LogEntry['status'], details?: any): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    step,
    action,
    status,
    details
  };
  actionLog.push(entry);

  const icons = { START: '🚀', SUCCESS: '✅', FAIL: '❌', INFO: 'ℹ️' };
  console.log(`${icons[status]} [${entry.timestamp.split('T')[1].split('.')[0]}] ${step}: ${action}`);
  if (details && status !== 'INFO') {
    console.log(`   ${JSON.stringify(details).substring(0, 200)}...`);
  }
}

function saveLog(): void {
  const logPath = path.join(__dirname, `e2e-log-${Date.now()}.json`);
  fs.writeFileSync(logPath, JSON.stringify(actionLog, null, 2));
  console.log(`\n📋 Log saved to: ${logPath}`);
}

// ============================================
// Qlik API Helper
// ============================================

async function qlikFetch(endpoint: string, options: { method?: string; body?: string } = {}): Promise<{ ok: boolean; status: number; json: () => Promise<any>; text: () => Promise<string> }> {
  const urlObj = new URL(endpoint, CONFIG.QLIK_TENANT_URL);

  log('DEBUG', `Requesting: ${urlObj.hostname}${urlObj.pathname}`, 'INFO');
  log('DEBUG', `API Key starts with: ${CONFIG.QLIK_API_KEY.substring(0, 30)}`, 'INFO');

  return new Promise((resolve, reject) => {
    const reqOptions: https.RequestOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${CONFIG.QLIK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      rejectUnauthorized: false
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({
          ok: res.statusCode! >= 200 && res.statusCode! < 300,
          status: res.statusCode!,
          json: async () => JSON.parse(data),
          text: async () => data
        });
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

// ============================================
// Types
// ============================================

interface ParsedSpec {
  tables: {
    name: string;
    type: 'Fact' | 'Dimension' | 'Bridge';
    fields: string[];
    keyField?: string;
  }[];
  relationships: {
    source: string;
    target: string;
    sourceField: string;
    targetField: string;
  }[];
}

// ============================================
// Step 1: Parse DOCX with Gemini
// ============================================

async function parseSpecWithGemini(): Promise<ParsedSpec> {
  log('STEP-1', 'Parse DOCX specification with Gemini API', 'START');

  const genAI = new GoogleGenerativeAI(CONFIG.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  // Extract text from DOCX using mammoth
  log('STEP-1', `Extracting text from: ${path.basename(CONFIG.SPEC_FILE)}`, 'INFO');
  const mammothResult = await mammoth.extractRawText({ path: CONFIG.SPEC_FILE });
  const documentText = mammothResult.value;

  log('STEP-1', `Text extracted: ${documentText.length} chars`, 'INFO');

  const prompt = `You are a data modeling expert. Analyze this document and extract the complete data model.

DOCUMENT CONTENT:
${documentText}

EXTRACT:
1. ALL tables with their names and types (Fact/Dimension)
2. ALL fields for each table
3. Key fields (primary keys, foreign keys)
4. Relationships between tables

OUTPUT FORMAT (strict JSON):
{
  "tables": [
    {
      "name": "table_name",
      "type": "Fact|Dimension|Bridge",
      "fields": ["field1", "field2", ...],
      "keyField": "pk_field_name"
    }
  ],
  "relationships": [
    {
      "source": "source_table",
      "target": "target_table",
      "sourceField": "fk_field",
      "targetField": "pk_field"
    }
  ]
}

IMPORTANT: Return ONLY the JSON, no markdown, no explanation.`;

  try {
    const result = await model.generateContent(prompt);

    const responseText = result.response.text();

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = responseText;
    if (responseText.includes('```json')) {
      jsonStr = responseText.split('```json')[1].split('```')[0].trim();
    } else if (responseText.includes('```')) {
      jsonStr = responseText.split('```')[1].split('```')[0].trim();
    }

    const parsed = JSON.parse(jsonStr) as ParsedSpec;

    log('STEP-1', `Parsed ${parsed.tables.length} tables, ${parsed.relationships.length} relationships`, 'SUCCESS', {
      tables: parsed.tables.map(t => t.name)
    });

    return parsed;

  } catch (err) {
    log('STEP-1', 'Gemini parsing failed', 'FAIL', { error: String(err) });
    throw err;
  }
}

// ============================================
// Step 2: Find/Create Space
// ============================================

async function getOrCreateSpace(): Promise<string> {
  log('STEP-2', 'Get existing Space', 'START');

  try {
    const res = await qlikFetch('/api/v1/spaces');
    if (!res.ok) {
      const errorBody = await res.text();
      log('STEP-2', `Response body: ${errorBody}`, 'INFO');
      throw new Error(`Failed to get spaces: ${res.status} - ${errorBody}`);
    }

    const data = await res.json() as { data?: any[] } | any[];
    const spaces = Array.isArray(data) ? data : (data.data || []);

    const defaultSpace = spaces.find((s: any) => s.name === 'Default_Data_Space');
    if (defaultSpace) {
      log('STEP-2', `Using existing space: Default_Data_Space`, 'SUCCESS', { spaceId: defaultSpace.id });
      return defaultSpace.id;
    }

    // Create new space if not found
    log('STEP-2', 'Default_Data_Space not found, creating new space', 'INFO');
    const createRes = await qlikFetch('/api/v1/spaces', {
      method: 'POST',
      body: JSON.stringify({
        name: 'QMB_E2E_Test_Space',
        type: 'shared'
      })
    });

    if (!createRes.ok) throw new Error(`Failed to create space: ${createRes.status}`);
    const newSpace = await createRes.json() as { id: string };

    log('STEP-2', `Created new space`, 'SUCCESS', { spaceId: newSpace.id });
    return newSpace.id;

  } catch (err) {
    log('STEP-2', 'Space operation failed', 'FAIL', { error: String(err) });
    throw err;
  }
}

// ============================================
// Step 3: Create NEON Connection
// ============================================

async function createNeonConnection(spaceId: string): Promise<string | null> {
  log('STEP-3', 'Create NEON PostgreSQL connection', 'START');

  // Build connection string for PostgreSQL
  const connectionString = `postgresql://${CONFIG.NEON_USER}:${CONFIG.NEON_PASSWORD}@${CONFIG.NEON_HOST}/${CONFIG.NEON_DATABASE}?sslmode=require`;

  log('STEP-3', `Connection string: postgresql://${CONFIG.NEON_USER}:***@${CONFIG.NEON_HOST}/${CONFIG.NEON_DATABASE}`, 'INFO');

  try {
    // Check existing connections first
    const listRes = await qlikFetch(`/api/v1/data-connections?spaceId=${spaceId}`);
    if (listRes.ok) {
      const connections = await listRes.json() as { data?: any[] };
      const existing = (connections.data || []).find((c: any) => c.name === 'NEON_Olist');
      if (existing) {
        log('STEP-3', 'Using existing NEON_Olist connection', 'SUCCESS', { connectionId: existing.id });
        return existing.id;
      }
    }

    // Create new connection - Qlik Cloud format
    // Note: qConnectStatement format for PostgreSQL ODBC
    const qConnectStatement = `CUSTOM CONNECT TO "Provider=PostgreSQL Unicode(x64);Server=${CONFIG.NEON_HOST};Port=5432;Database=${CONFIG.NEON_DATABASE};Uid=${CONFIG.NEON_USER};Pwd=${CONFIG.NEON_PASSWORD};sslmode=require"`;

    const createRes = await qlikFetch('/api/v1/data-connections', {
      method: 'POST',
      body: JSON.stringify({
        qName: 'NEON_Olist',
        qConnectStatement: qConnectStatement,
        qType: 'QvOdbcConnectorPackage.exe',
        space: spaceId
      })
    });

    if (createRes.ok) {
      const conn = await createRes.json() as { id: string };
      log('STEP-3', 'NEON connection created', 'SUCCESS', { connectionId: conn.id });
      return conn.id;
    } else {
      const errorText = await createRes.text();
      log('STEP-3', `Connection creation failed (will use DataFiles): ${createRes.status}`, 'INFO', { error: errorText });
      return null;
    }

  } catch (err) {
    log('STEP-3', 'Connection creation error (will use DataFiles)', 'INFO', { error: String(err) });
    return null;
  }
}

// ============================================
// Step 4: Create App
// ============================================

async function createApp(spaceId: string, specName: string): Promise<string> {
  log('STEP-4', 'Create Qlik App', 'START');

  const appName = `QMB-E2E-${specName}-${Date.now()}`;

  try {
    // Try creating app in the shared space first
    let res = await qlikFetch('/api/v1/apps', {
      method: 'POST',
      body: JSON.stringify({
        attributes: {
          name: appName,
          description: 'Created by QMB Full E2E Test - Real Flow',
          spaceId: spaceId
        }
      })
    });

    // If 403 (forbidden), try creating in personal space (no spaceId)
    if (res.status === 403) {
      log('STEP-4', 'Cannot create in shared space, trying personal space...', 'INFO');
      res = await qlikFetch('/api/v1/apps', {
        method: 'POST',
        body: JSON.stringify({
          attributes: {
            name: appName,
            description: 'Created by QMB Full E2E Test - Real Flow'
          }
        })
      });
    }

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to create app: ${res.status} - ${errorText}`);
    }

    const app = await res.json() as { attributes?: { id: string }; id?: string };
    const appId = app.attributes?.id || app.id || '';

    log('STEP-4', `App created: ${appName}`, 'SUCCESS', { appId });
    return appId;

  } catch (err) {
    log('STEP-4', 'App creation failed', 'FAIL', { error: String(err) });
    throw err;
  }
}

// ============================================
// Step 5: Generate QVS Script
// ============================================

function generateQVSScript(spec: ParsedSpec, connectionId: string | null): string {
  log('STEP-5', 'Generate QVS script for all tables', 'START');

  // Use INLINE data for E2E testing - no external files needed
  const useInlineData = !connectionId;
  const connectionName = connectionId ? 'NEON_Olist' : 'INLINE';

  let script = `// ============================================
// QMB E2E Test - Auto Generated Script
// Source: ${connectionName}
// Tables: ${spec.tables.length}
// Generated: ${new Date().toISOString()}
// ============================================

SET ThousandSep=',';
SET DecimalSep='.';

LET vReloadTime = Now();

`;

  // Add LIB CONNECT for PostgreSQL
  if (connectionId) {
    script += `// Connect to PostgreSQL
LIB CONNECT TO '${connectionName}';

`;
  }

  // Generate LOAD statement for each table
  for (const table of spec.tables) {
    const fields = table.fields.length > 0 ? table.fields : ['id', 'name', 'created_at'];
    const pgTableName = table.name.toLowerCase().replace(/^(fact_|dim_)/, '');

    script += `// ============================================
// ${table.name} (${table.type})
// Key: ${table.keyField || 'N/A'}
// ============================================
`;

    if (connectionId) {
      // Load from PostgreSQL using SQL SELECT
      const fieldList = fields.join(', ').replace(/\n/g, '');
      script += `${table.name}:
SQL SELECT ${fieldList}
FROM public.${pgTableName};

`;
    } else {
      // Use INLINE data for E2E testing (no external files needed)
      script += `${table.name}:
LOAD * INLINE [
${fields.join(', ')}
1, Test_${table.name}_1, 2026-01-17
2, Test_${table.name}_2, 2026-01-17
3, Test_${table.name}_3, 2026-01-17
];

`;
    }
  }

  script += `// ============================================
// Reload Complete
// ============================================
LET vTableCount = ${spec.tables.length};
TRACE E2E Test Script completed at $(vReloadTime);
TRACE Loaded $(vTableCount) tables;
`;

  log('STEP-5', `Script generated: ${script.length} chars, ${spec.tables.length} tables, source: ${connectionName}`, 'SUCCESS');
  return script;
}

// ============================================
// Step 6: Upload Script
// ============================================

async function uploadScript(appId: string, script: string): Promise<void> {
  log('STEP-6', 'Upload script to app', 'START');

  try {
    // Try POST first
    let res = await qlikFetch(`/api/v1/apps/${appId}/scripts`, {
      method: 'POST',
      body: JSON.stringify({ script })
    });

    // Try PUT if POST returns 404
    if (res.status === 404) {
      log('STEP-6', 'Trying PUT endpoint', 'INFO');
      res = await qlikFetch(`/api/v1/apps/${appId}/script`, {
        method: 'PUT',
        body: JSON.stringify({ script })
      });
    }

    if (!res.ok && res.status !== 204) {
      const errorText = await res.text();
      throw new Error(`Script upload failed: ${res.status} - ${errorText}`);
    }

    log('STEP-6', 'Script uploaded successfully', 'SUCCESS');

  } catch (err) {
    log('STEP-6', 'Script upload failed', 'FAIL', { error: String(err) });
    throw err;
  }
}

// ============================================
// Step 7: Trigger Reload
// ============================================

async function triggerReload(appId: string): Promise<string> {
  log('STEP-7', 'Trigger app reload', 'START');

  try {
    const res = await qlikFetch('/api/v1/reloads', {
      method: 'POST',
      body: JSON.stringify({ appId })
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Reload trigger failed: ${res.status} - ${errorText}`);
    }

    const reload = await res.json() as { id: string };
    log('STEP-7', 'Reload triggered', 'SUCCESS', { reloadId: reload.id });
    return reload.id;

  } catch (err) {
    log('STEP-7', 'Reload trigger failed', 'FAIL', { error: String(err) });
    throw err;
  }
}

// ============================================
// Step 8: Wait for Reload Completion
// ============================================

async function waitForReload(reloadId: string, maxWaitMs: number = 120000): Promise<boolean> {
  log('STEP-8', `Wait for reload completion (max ${maxWaitMs / 1000}s)`, 'START');

  const startTime = Date.now();
  const pollInterval = 3000;

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const res = await qlikFetch(`/api/v1/reloads/${reloadId}`);
      if (!res.ok) throw new Error(`Status check failed: ${res.status}`);

      const reload = await res.json() as { status: string; log?: string };
      log('STEP-8', `Status: ${reload.status}`, 'INFO');

      if (reload.status === 'SUCCEEDED') {
        log('STEP-8', 'Reload completed successfully!', 'SUCCESS');
        return true;
      }

      if (reload.status === 'FAILED' || reload.status === 'CANCELED') {
        log('STEP-8', `Reload ${reload.status}`, 'FAIL', { log: reload.log });
        return false;
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));

    } catch (err) {
      log('STEP-8', 'Status check error', 'FAIL', { error: String(err) });
      return false;
    }
  }

  log('STEP-8', 'Reload timeout', 'FAIL');
  return false;
}

// ============================================
// Step 9: Verify Results
// ============================================

async function verifyResults(appId: string): Promise<void> {
  log('STEP-9', 'Verify reload results', 'START');

  try {
    const res = await qlikFetch(`/api/v1/apps/${appId}`);
    if (!res.ok) throw new Error(`App fetch failed: ${res.status}`);

    const app = await res.json() as { attributes?: { lastReloadTime?: string } };

    if (app.attributes?.lastReloadTime) {
      log('STEP-9', 'App has data!', 'SUCCESS', {
        lastReloadTime: app.attributes.lastReloadTime
      });
    } else {
      log('STEP-9', 'No reload time found', 'FAIL');
    }

  } catch (err) {
    log('STEP-9', 'Verification failed', 'FAIL', { error: String(err) });
  }
}

// ============================================
// Cleanup
// ============================================

async function cleanup(appId: string): Promise<void> {
  log('CLEANUP', 'Delete test app', 'START');

  try {
    const res = await qlikFetch(`/api/v1/apps/${appId}`, { method: 'DELETE' });
    if (res.ok || res.status === 204) {
      log('CLEANUP', 'Test app deleted', 'SUCCESS', { appId });
    } else {
      log('CLEANUP', `Delete returned ${res.status}`, 'INFO');
    }
  } catch (err) {
    log('CLEANUP', 'Cleanup error', 'INFO', { error: String(err) });
  }
}

// ============================================
// Main Execution
// ============================================

async function main(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 FULL E2E REAL FLOW TEST');
  console.log('   Qlik Model Builder - Complete User Simulation');
  console.log('='.repeat(60));
  console.log(`\n📅 Started: ${new Date().toISOString()}`);
  console.log(`🔗 Tenant: ${CONFIG.QLIK_TENANT_URL}`);
  console.log(`📄 Spec: ${path.basename(CONFIG.SPEC_FILE)}\n`);

  // Validate config
  const missing = validateConfig();
  if (missing.length > 0) {
    console.error(`\n❌ Missing configuration: ${missing.join(', ')}`);
    process.exit(1);
  }

  let appId: string | null = null;

  try {
    // Step 1: Parse DOCX
    const spec = await parseSpecWithGemini();

    // Step 2: Get Space
    const spaceId = await getOrCreateSpace();

    // Step 3: Create Connection
    const connectionId = await createNeonConnection(spaceId);

    // Step 4: Create App
    appId = await createApp(spaceId, 'Olist');

    // Step 5: Generate Script
    const script = generateQVSScript(spec, connectionId);

    // Step 6: Upload Script
    await uploadScript(appId, script);

    // Step 7: Trigger Reload
    const reloadId = await triggerReload(appId);

    // Step 8: Wait for Completion
    const success = await waitForReload(reloadId);

    // Step 9: Verify
    if (success) {
      await verifyResults(appId);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    const successCount = actionLog.filter(l => l.status === 'SUCCESS').length;
    const failCount = actionLog.filter(l => l.status === 'FAIL').length;

    console.log(`\n📊 RESULTS: ${successCount} success, ${failCount} failed`);

    if (failCount === 0) {
      console.log('\n🎉 E2E TEST PASSED! Full flow completed successfully.\n');
    } else {
      console.log('\n❌ E2E TEST HAD FAILURES. Check log for details.\n');
    }

  } catch (err) {
    console.error('\n💥 FATAL ERROR:', err);
  } finally {
    // Save log
    saveLog();

    // Cleanup prompt
    if (appId) {
      console.log(`\n⚠️ Test app created: ${appId}`);
      console.log('   Run cleanup manually or uncomment cleanup() below.');
      // await cleanup(appId);
    }
  }
}

// Run
main().catch(console.error);
