/**
 * Seed Neon Database with Olist Test Data
 *
 * Usage:
 *   npm run seed:test          # Seed the database
 *   npm run seed:test:reset    # Drop and recreate tables, then seed
 */

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
import 'dotenv/config';

const BATCH_SIZE = 1000;

interface TableConfig {
  name: string;
  file: string;
  columns: string[];
}

const TABLES: TableConfig[] = [
  {
    name: 'product_category_name_translation',
    file: 'product_category_name_translation.csv',
    columns: ['product_category_name', 'product_category_name_english']
  },
  {
    name: 'olist_geolocation',
    file: 'olist_geolocation_dataset.csv',
    columns: ['geolocation_zip_code_prefix', 'geolocation_lat', 'geolocation_lng', 'geolocation_city', 'geolocation_state']
  },
  {
    name: 'olist_customers',
    file: 'olist_customers_dataset.csv',
    columns: ['customer_id', 'customer_unique_id', 'customer_zip_code_prefix', 'customer_city', 'customer_state']
  },
  {
    name: 'olist_sellers',
    file: 'olist_sellers_dataset.csv',
    columns: ['seller_id', 'seller_zip_code_prefix', 'seller_city', 'seller_state']
  },
  {
    name: 'olist_products',
    file: 'olist_products_dataset.csv',
    columns: ['product_id', 'product_category_name', 'product_name_lenght', 'product_description_lenght', 'product_photos_qty', 'product_weight_g', 'product_length_cm', 'product_height_cm', 'product_width_cm']
  },
  {
    name: 'olist_orders',
    file: 'olist_orders_dataset.csv',
    columns: ['order_id', 'customer_id', 'order_status', 'order_purchase_timestamp', 'order_approved_at', 'order_delivered_carrier_date', 'order_delivered_customer_date', 'order_estimated_delivery_date']
  },
  {
    name: 'olist_order_items',
    file: 'olist_order_items_dataset.csv',
    columns: ['order_id', 'order_item_id', 'product_id', 'seller_id', 'shipping_limit_date', 'price', 'freight_value']
  },
  {
    name: 'olist_order_payments',
    file: 'olist_order_payments_dataset.csv',
    columns: ['order_id', 'payment_sequential', 'payment_type', 'payment_installments', 'payment_value']
  },
  {
    name: 'olist_order_reviews',
    file: 'olist_order_reviews_dataset.csv',
    columns: ['review_id', 'order_id', 'review_score', 'review_comment_title', 'review_comment_message', 'review_creation_date', 'review_answer_timestamp']
  }
];

function parseCSV(content: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  let currentRow: string[] = [];
  let inQuotes = false;

  // Normalize line endings
  content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (char === '"') {
      if (inQuotes && content[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(current);
      current = '';
    } else if (char === '\n' && !inQuotes) {
      currentRow.push(current);
      if (currentRow.length > 1 || currentRow[0] !== '') {
        rows.push(currentRow);
      }
      currentRow = [];
      current = '';
    } else {
      current += char;
    }
  }

  // Handle last row
  if (current || currentRow.length > 0) {
    currentRow.push(current);
    if (currentRow.length > 1 || currentRow[0] !== '') {
      rows.push(currentRow);
    }
  }

  return rows;
}

function cleanValue(value: string, isNumeric: boolean = false): string | null {
  const cleaned = value.trim().replace(/^\ufeff/, ''); // Remove BOM

  if (cleaned === '' || cleaned.toLowerCase() === 'null') {
    return null;
  }

  if (isNumeric && isNaN(Number(cleaned))) {
    return null;
  }

  return cleaned;
}

async function loadCSV(filePath: string): Promise<string[][]> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const rows = parseCSV(content);

  // Skip header
  return rows.slice(1);
}

async function seedTable(client: Client, table: TableConfig, dataDir: string): Promise<number> {
  const filePath = path.join(dataDir, table.file);

  if (!fs.existsSync(filePath)) {
    console.log(`  Skipping ${table.name}: file not found`);
    return 0;
  }

  console.log(`  Loading ${table.name}...`);
  const rows = await loadCSV(filePath);

  const numericColumns = new Set([
    'geolocation_lat', 'geolocation_lng',
    'product_name_lenght', 'product_description_lenght', 'product_photos_qty',
    'product_weight_g', 'product_length_cm', 'product_height_cm', 'product_width_cm',
    'order_item_id', 'price', 'freight_value',
    'payment_sequential', 'payment_installments', 'payment_value',
    'review_score'
  ]);

  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    const placeholders: string[] = [];
    const values: (string | null)[] = [];
    let paramIndex = 1;

    for (const row of batch) {
      const rowPlaceholders: string[] = [];

      for (let j = 0; j < table.columns.length; j++) {
        rowPlaceholders.push(`$${paramIndex++}`);
        const isNumeric = numericColumns.has(table.columns[j]);
        values.push(cleanValue(row[j] || '', isNumeric));
      }

      placeholders.push(`(${rowPlaceholders.join(', ')})`);
    }

    const sql = `INSERT INTO ${table.name} (${table.columns.join(', ')}) VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING`;

    try {
      await client.query(sql, values);
      inserted += batch.length;
    } catch (err) {
      console.error(`  Error in batch ${i / BATCH_SIZE + 1}:`, err);
    }

    // Progress indicator
    if ((i / BATCH_SIZE) % 10 === 0 && i > 0) {
      process.stdout.write(`    ${inserted.toLocaleString()} rows...\r`);
    }
  }

  console.log(`    Inserted ${inserted.toLocaleString()} rows`);
  return inserted;
}

async function runSchema(client: Client): Promise<void> {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  console.log('Creating schema...');
  await client.query(schema);
  console.log('Schema created successfully');
}

async function main(): Promise<void> {
  const connectionString = process.env.NEON_TEST_URL;

  if (!connectionString) {
    console.error('Error: NEON_TEST_URL environment variable not set');
    console.error('Create a .env.test file with your Neon connection string');
    process.exit(1);
  }

  const client = new Client({ connectionString });

  try {
    console.log('Connecting to Neon...');
    await client.connect();
    console.log('Connected!\n');

    const resetFlag = process.argv.includes('--reset');

    if (resetFlag) {
      await runSchema(client);
      console.log('');
    }

    const dataDir = path.join(__dirname, '..', 'Project files');

    console.log('Seeding tables:');
    let totalRows = 0;

    for (const table of TABLES) {
      const count = await seedTable(client, table, dataDir);
      totalRows += count;
    }

    console.log('\n========================================');
    console.log(`Total rows inserted: ${totalRows.toLocaleString()}`);
    console.log('========================================\n');

    // Verify counts
    console.log('Verification:');
    for (const table of TABLES) {
      const result = await client.query(`SELECT COUNT(*) as count FROM ${table.name}`);
      console.log(`  ${table.name}: ${Number(result.rows[0].count).toLocaleString()} rows`);
    }

  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\nConnection closed.');
  }
}

main();
