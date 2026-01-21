// Quick NEON connection test
require('dotenv').config({ path: '.env.test' });
const { Client } = require('pg');

async function test() {
  const client = new Client({ connectionString: process.env.NEON_TEST_URL });

  try {
    await client.connect();
    console.log('✅ Connected to NEON\n');

    const tables = [
      'olist_orders',
      'olist_customers',
      'olist_products',
      'olist_sellers',
      'olist_order_items',
      'olist_order_payments',
      'olist_order_reviews',
      'olist_geolocation',
      'product_category_name_translation'
    ];

    console.log('Table counts:');
    for (const table of tables) {
      try {
        const res = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`  ${table}: ${Number(res.rows[0].count).toLocaleString()} rows`);
      } catch (e) {
        console.log(`  ${table}: ❌ Not found`);
      }
    }

  } catch (err) {
    console.error('❌ Connection failed:', err.message);
  } finally {
    await client.end();
  }
}

test();
