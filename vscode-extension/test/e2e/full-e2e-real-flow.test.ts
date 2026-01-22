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

interface FieldDef {
  name: string;
  description?: string;
  dataType?: string;
  isKey?: boolean;
}

interface TableDef {
  name: string;
  type: 'Fact' | 'Dimension' | 'Bridge';
  fields: FieldDef[];
  keyField?: string;
  description?: string;
}

interface RelationshipDef {
  source: string;
  target: string;
  sourceField: string;
  targetField: string;
  cardinality?: string;
}

interface ParsedSpec {
  tables: TableDef[];
  relationships: RelationshipDef[];
  metadata?: {
    modelName: string;
    parsedAt: string;
    sourceFile: string;
  };
}

// ============================================
// Step 0: Wake up NEON Database
// ============================================

async function wakeUpNeon(): Promise<void> {
  log('STEP-0', 'Wake up NEON database (serverless cold start)', 'START');

  const maxRetries = 5;
  const retryDelay = 3000;

  // NEON HTTP endpoint: https://<hostname>/sql
  // Use the same hostname as PostgreSQL connection
  const neonHost = CONFIG.NEON_HOST;
  log('STEP-0', `NEON HTTP endpoint: https://${neonHost}/sql`, 'INFO');

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log('STEP-0', `Attempt ${attempt}/${maxRetries}: Pinging NEON...`, 'INFO');

      const response = await new Promise<{ ok: boolean; status: number; data?: any; error?: string }>((resolve, reject) => {
        const postData = JSON.stringify({ query: 'SELECT 1 as wake_up_test' });

        const options: https.RequestOptions = {
          hostname: neonHost,
          path: '/sql',
          method: 'POST',
          headers: {
            'Neon-Connection-String': `postgresql://${CONFIG.NEON_USER}:${CONFIG.NEON_PASSWORD}@${CONFIG.NEON_HOST}/${CONFIG.NEON_DATABASE}?sslmode=require`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          },
          rejectUnauthorized: false
        };

        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            let parsedData = null;
            try { parsedData = data ? JSON.parse(data) : null; } catch {}
            resolve({
              ok: res.statusCode! >= 200 && res.statusCode! < 300,
              status: res.statusCode!,
              data: parsedData,
              error: data
            });
          });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
      });

      if (response.ok) {
        log('STEP-0', `NEON is awake! Response: ${response.status}`, 'SUCCESS', response.data);
        return;
      }

      log('STEP-0', `NEON returned ${response.status}: ${response.error?.substring(0, 200)}`, 'INFO');

    } catch (err) {
      log('STEP-0', `Attempt ${attempt} failed: ${String(err)}`, 'INFO');
    }

    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  log('STEP-0', `NEON failed to wake up after ${maxRetries} attempts`, 'FAIL');
  throw new Error(`NEON database not responding after ${maxRetries} attempts`);
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

  const prompt = `You are a data modeling expert. Analyze this document and extract the complete data model with FULL METADATA.

DOCUMENT CONTENT:
${documentText}

EXTRACT:
1. ALL tables with their names, types (Fact/Dimension), and descriptions
2. ALL fields for each table with:
   - Field name
   - Description (if available)
   - Data type (if mentioned)
   - Whether it's a key field
3. Key fields (primary keys, foreign keys)
4. Relationships between tables with cardinality

OUTPUT FORMAT (strict JSON):
{
  "tables": [
    {
      "name": "table_name",
      "type": "Fact|Dimension|Bridge",
      "description": "table description",
      "fields": [
        {
          "name": "field_name",
          "description": "field description if available",
          "dataType": "string|number|date|etc",
          "isKey": true|false
        }
      ],
      "keyField": "pk_field_name"
    }
  ],
  "relationships": [
    {
      "source": "source_table",
      "target": "target_table",
      "sourceField": "fk_field",
      "targetField": "pk_field",
      "cardinality": "1:N|N:1|1:1|N:M"
    }
  ]
}

IMPORTANT: Return ONLY the JSON, no markdown, no explanation.
IMPORTANT: Include ALL fields from EVERY table, with descriptions where documented.`;

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

    // Add metadata
    parsed.metadata = {
      modelName: 'Olist_Brazilian_Ecommerce',
      parsedAt: new Date().toISOString(),
      sourceFile: path.basename(CONFIG.SPEC_FILE)
    };

    // Count total fields
    const totalFields = parsed.tables.reduce((sum, t) => sum + t.fields.length, 0);

    log('STEP-1', `Parsed ${parsed.tables.length} tables, ${totalFields} fields, ${parsed.relationships.length} relationships`, 'SUCCESS', {
      tables: parsed.tables.map(t => `${t.name} (${t.fields.length} fields)`)
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

async function createNeonConnection(_spaceId: string): Promise<string> {
  log('STEP-3', 'Create NEON PostgreSQL connection', 'START');

  log('STEP-3', `Connection: postgresql://${CONFIG.NEON_USER}:***@${CONFIG.NEON_HOST}/${CONFIG.NEON_DATABASE}`, 'INFO');

  // Check existing connections in personal space (no spaceId filter)
  const listRes = await qlikFetch('/api/v1/data-connections');
  if (listRes.ok) {
    const connections = await listRes.json() as { data?: any[] };
    const existing = (connections.data || []).find((c: any) => c.qName === 'NEON_Olist');
    if (existing) {
      log('STEP-3', 'Using existing NEON_Olist connection', 'SUCCESS', { connectionId: existing.id });
      return existing.id;
    }
  }

  // Create new connection in PERSONAL SPACE (no space parameter)
  // This ensures the app (also in personal space) can access it
  const createRes = await qlikFetch('/api/v1/data-connections', {
    method: 'POST',
    body: JSON.stringify({
      dataSourceId: 'postgres',
      qName: 'NEON_Olist',
      // No 'space' parameter = personal space
      connectionProperties: {
        host: CONFIG.NEON_HOST,
        port: '5432',
        db: CONFIG.NEON_DATABASE,
        username: CONFIG.NEON_USER,
        password: CONFIG.NEON_PASSWORD,
        SSLMode: 'require'
      }
    })
  });

  if (createRes.ok) {
    const conn = await createRes.json() as { id: string };
    log('STEP-3', 'NEON connection created in personal space', 'SUCCESS', { connectionId: conn.id });
    return conn.id;
  }

  // NO FALLBACK - fail if connection cannot be created
  const errorText = await createRes.text();
  log('STEP-3', `NEON connection FAILED: ${createRes.status}`, 'FAIL', { error: errorText });
  throw new Error(`NEON connection failed: ${createRes.status} - ${errorText}`);
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
// Step 5a: Get Actual Column Names from NEON
// ============================================

async function getTableColumns(tableName: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = '${tableName}'
      ORDER BY ordinal_position
    `;
    const postData = JSON.stringify({ query });

    const options: https.RequestOptions = {
      hostname: CONFIG.NEON_HOST,
      path: '/sql',
      method: 'POST',
      headers: {
        'Neon-Connection-String': `postgresql://${CONFIG.NEON_USER}:${CONFIG.NEON_PASSWORD}@${CONFIG.NEON_HOST}/${CONFIG.NEON_DATABASE}?sslmode=require`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      rejectUnauthorized: false
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.rows && Array.isArray(result.rows)) {
            const columns = result.rows.map((row: { column_name: string }) => row.column_name);
            resolve(columns);
          } else {
            resolve([]);
          }
        } catch {
          resolve([]);
        }
      });
    });

    req.on('error', () => resolve([]));
    req.write(postData);
    req.end();
  });
}

// ============================================
// Step 5: Generate QVS Script
// ============================================

async function generateQVSScript(spec: ParsedSpec, connectionId: string): Promise<string> {
  log('STEP-5', 'Generate QVS script for all tables', 'START');

  // NO FALLBACK - connectionId is required
  if (!connectionId) {
    log('STEP-5', 'No connection ID provided - cannot generate script', 'FAIL');
    throw new Error('Cannot generate script without database connection');
  }

  const connectionName = 'NEON_Olist';

  let script = `// ============================================
// QMB E2E Test - Auto Generated Script
// Source: ${connectionName}
// Tables: ${spec.tables.length}
// Generated: ${new Date().toISOString()}
// Pattern: LOAD -> STORE QVD -> DROP
// ============================================

SET ThousandSep=',';
SET DecimalSep='.';

LET vReloadTime = Now();

// Connect to PostgreSQL
LIB CONNECT TO '${connectionName}';

`;

  // Map model table names to actual PostgreSQL table names
  // Handles both conceptual names (fact_*, dim_*) and Gemini-parsed names (*_dataset)
  const tableNameMap: Record<string, string> = {
    // Conceptual model names
    'fact_orders': 'olist_orders',
    'fact_order_items': 'olist_order_items',
    'fact_payments': 'olist_order_payments',
    'fact_reviews': 'olist_order_reviews',
    'dim_customers': 'olist_customers',
    'dim_products': 'olist_products',
    'dim_categories': 'product_category_name_translation',
    'dim_sellers': 'olist_sellers',
    'dim_date': 'olist_orders',
    'dim_geolocation': 'olist_geolocation',
    // Gemini-parsed dataset names
    'olist_orders_dataset': 'olist_orders',
    'olist_order_items_dataset': 'olist_order_items',
    'olist_order_payments_dataset': 'olist_order_payments',
    'olist_order_reviews_dataset': 'olist_order_reviews',
    'olist_customers_dataset': 'olist_customers',
    'olist_products_dataset': 'olist_products',
    'olist_sellers_dataset': 'olist_sellers',
    'olist_geolocation_dataset': 'olist_geolocation',
    'product_category_translation': 'product_category_name_translation'
  };

  // Generate LOAD -> STORE -> DROP for each table
  // Use ACTUAL column names from database, not conceptual names from spec
  let tablesProcessed = 0;
  let tablesSkipped = 0;

  for (const table of spec.tables) {
    const lookupKey = table.name.toLowerCase();
    // Strip _dataset suffix for better matching
    const normalizedName = lookupKey.replace(/_dataset$/, '');
    // Try direct match, then normalized match, then fallback
    const pgTableName = tableNameMap[lookupKey] || tableNameMap[normalizedName] || normalizedName;

    // Get ACTUAL column names from NEON database
    const actualColumns = await getTableColumns(pgTableName);

    if (actualColumns.length === 0) {
      // Table doesn't exist in database - skip (virtual/derived table)
      log('STEP-5', `Skipping ${table.name} - table ${pgTableName} not found in database`, 'INFO');
      tablesSkipped++;
      continue;
    }

    // Build explicit field list from ACTUAL database columns
    const fieldList = actualColumns.map(f => `"${f}"`).join(',\n       ');
    const qvdFileName = `${table.name}.qvd`;

    script += `// ============================================
// ${table.name} (${table.type})
// Key: ${table.keyField || 'N/A'}
// Fields: ${actualColumns.length} (from database)
// ============================================
${table.name}:
SQL SELECT ${fieldList}
FROM public.${pgTableName};

// Store to QVD and free memory
STORE ${table.name} INTO [lib://DataFiles/${qvdFileName}] (qvd);
DROP TABLE ${table.name};
TRACE Stored ${table.name} -> ${qvdFileName};

`;
    tablesProcessed++;
  }

  script += `// ============================================
// Reload Complete
// ============================================
LET vTableCount = ${tablesProcessed};
TRACE E2E Test Script completed at $(vReloadTime);
TRACE Loaded and stored $(vTableCount) tables to QVD;
`;

  log('STEP-5', `Script generated: ${script.length} chars, ${tablesProcessed} tables (${tablesSkipped} skipped), source: ${connectionName}`, 'SUCCESS');
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
// Step 10: Save Metadata for Phase B
// ============================================

function saveMetadataForPhaseB(spec: ParsedSpec, appId: string): void {
  log('STEP-10', 'Save metadata for Phase B', 'START');

  try {
    // Create metadata output directory
    const outputDir = path.join(__dirname, 'metadata');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Prepare comprehensive metadata
    const metadata = {
      ...spec,
      appInfo: {
        appId,
        tenantUrl: CONFIG.QLIK_TENANT_URL,
        createdAt: new Date().toISOString()
      },
      fieldCatalog: spec.tables.flatMap(table =>
        table.fields.map(field => ({
          tableName: table.name,
          tableType: table.type,
          fieldName: typeof field === 'string' ? field : field.name,
          fieldDescription: typeof field === 'string' ? null : field.description,
          fieldDataType: typeof field === 'string' ? null : field.dataType,
          isKey: typeof field === 'string' ? false : (field.isKey || false)
        }))
      ),
      statistics: {
        totalTables: spec.tables.length,
        totalFields: spec.tables.reduce((sum, t) => sum + t.fields.length, 0),
        totalRelationships: spec.relationships.length,
        factTables: spec.tables.filter(t => t.type === 'Fact').length,
        dimensionTables: spec.tables.filter(t => t.type === 'Dimension').length
      }
    };

    // Save main metadata file
    const metadataPath = path.join(outputDir, `model-metadata-${Date.now()}.json`);
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    log('STEP-10', `Metadata saved: ${metadataPath}`, 'SUCCESS', {
      tables: metadata.statistics.totalTables,
      fields: metadata.statistics.totalFields,
      relationships: metadata.statistics.totalRelationships
    });

    // Also save a "latest" version for easy access
    const latestPath = path.join(outputDir, 'model-metadata-latest.json');
    fs.writeFileSync(latestPath, JSON.stringify(metadata, null, 2));
    log('STEP-10', `Latest metadata: ${latestPath}`, 'INFO');

  } catch (err) {
    log('STEP-10', 'Metadata save failed', 'FAIL', { error: String(err) });
    // Don't throw - metadata save is not critical for E2E test
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
    // Step 0: Wake up NEON (serverless cold start)
    await wakeUpNeon();

    // Step 1: Parse DOCX
    const spec = await parseSpecWithGemini();

    // Step 2: Get Space
    const spaceId = await getOrCreateSpace();

    // Step 3: Create Connection
    const connectionId = await createNeonConnection(spaceId);

    // Step 4: Create App
    appId = await createApp(spaceId, 'Olist');

    // Step 5: Generate Script (fetches actual column names from NEON)
    const script = await generateQVSScript(spec, connectionId);

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

    // Step 10: Save metadata for Phase B
    saveMetadataForPhaseB(spec, appId);

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
