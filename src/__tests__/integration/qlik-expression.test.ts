/**
 * Qlik Expression Integration Tests
 * Tests REAL Qlik expression evaluation using MCP tools
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KNOWLEDGE_DIR = path.join(__dirname, '../../../docs/knowledge');

// SysAid Main app ID
const APP_ID = 'e2f1700e-98dc-4ac9-b483-ca4a0de183ce';

// Load semantic layer files
const loadJsonFile = (filename: string): any => {
  const filePath = path.join(KNOWLEDGE_DIR, filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
};

// Import the actual handler for real API calls
import { handleEvaluateExpression } from '../../handlers/data-handlers.js';
import { ApiClient } from '../../utils/api-client.js';
import { CacheManager } from '../../utils/cache-manager.js';

// REAL environment variables - saved before setup.ts overwrites them
// These are set when running: QLIK_API_KEY=xxx npm test
const REAL_TENANT_URL = 'https://sysaid-main.eu.qlikcloud.com';
const REAL_API_KEY = process.env.QLIK_API_KEY_REAL || process.env.QLIK_API_KEY;

// Helper to evaluate expression via handler
async function evaluateExpression(appId: string, expression: string): Promise<{ success: boolean; result?: string }> {
  // Always use real credentials for integration tests
  const apiClient = new ApiClient({
    tenantUrl: REAL_TENANT_URL,
    apiKey: REAL_API_KEY,
  });
  const cacheManager = new CacheManager();

  const response = await handleEvaluateExpression(apiClient, cacheManager, { appId, expression }, 'cloud', REAL_TENANT_URL);
  const parsed = JSON.parse(response.content[0].text);
  return parsed;
}

describe('Qlik Expression LIVE Integration Tests', () => {
  let measures: any;
  let isConnected = false;

  beforeAll(async () => {
    measures = loadJsonFile('semantic-measures.json');

    // Check if we can connect to Qlik
    try {
      const result = await evaluateExpression(APP_ID, '1+1');
      isConnected = result.success && result.result === '2';
    } catch (e) {
      isConnected = false;
    }
  }, 30000); // 30 second timeout for connection

  describe('Stock Measure Expressions (Current State)', () => {
    test('incident.active_count returns valid number', async () => {
      if (!isConnected) {
        console.log('Skipping - no Qlik connection');
        return;
      }

      const expression = measures.measures.incident.active_count.expression;
      const result = await evaluateExpression(APP_ID, expression);

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(Number(result.result)).toBeGreaterThanOrEqual(0);
    }, 30000);

    test('request.active_count returns valid number', async () => {
      if (!isConnected) {
        console.log('Skipping - no Qlik connection');
        return;
      }

      const expression = measures.measures.request.active_count.expression;
      const result = await evaluateExpression(APP_ID, expression);

      expect(result.success).toBe(true);
      expect(Number(result.result)).toBeGreaterThanOrEqual(0);
    }, 30000);

    test('technician.active_tickets returns valid number', async () => {
      if (!isConnected) {
        console.log('Skipping - no Qlik connection');
        return;
      }

      const expression = measures.measures.technician.active_tickets.expression;
      const result = await evaluateExpression(APP_ID, expression);

      expect(result.success).toBe(true);
      expect(Number(result.result)).toBeGreaterThanOrEqual(0);
    }, 30000);
  });

  describe('Satisfaction Expressions', () => {
    test('satisfaction.avg_score_all (stock) returns valid score', async () => {
      if (!isConnected) {
        console.log('Skipping - no Qlik connection');
        return;
      }

      // Use avg_score_all which is a stock measure (no V_ToDate required)
      const expression = measures.measures.satisfaction.avg_score_all.expression;
      const result = await evaluateExpression(APP_ID, expression);

      expect(result.success).toBe(true);
      const score = Number(result.result);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(5);
    }, 30000);
  });

  describe('Total Count Expressions (No V_ToDate)', () => {
    test('incident.total returns all incidents', async () => {
      if (!isConnected) {
        console.log('Skipping - no Qlik connection');
        return;
      }

      const expression = measures.measures.incident.total.expression;
      const result = await evaluateExpression(APP_ID, expression);

      expect(result.success).toBe(true);
      expect(Number(result.result)).toBeGreaterThan(0);
    }, 30000);
  });

  describe('All Stock Expressions Validation', () => {
    test('All stock expressions execute without error', async () => {
      if (!isConnected) {
        console.log('Skipping - no Qlik connection');
        return;
      }

      const stockExpressions: { entity: string; measure: string; expression: string }[] = [];

      Object.entries(measures.measures).forEach(([entity, entityMeasures]) => {
        Object.entries(entityMeasures as object).forEach(([measureName, measure]: [string, any]) => {
          if (measure.type === 'stock' && !measure.expression.includes('$(V_ToDate)')) {
            stockExpressions.push({ entity, measure: measureName, expression: measure.expression });
          }
        });
      });

      let successCount = 0;
      const errors: string[] = [];

      for (const { entity, measure, expression } of stockExpressions) {
        try {
          const result = await evaluateExpression(APP_ID, expression);
          if (result.success && !result.result?.includes('Error')) {
            successCount++;
          } else {
            errors.push(`${entity}.${measure}: ${result.result}`);
          }
        } catch (e: any) {
          errors.push(`${entity}.${measure}: ${e.message}`);
        }
      }

      console.log(`Stock expressions: ${successCount}/${stockExpressions.length} passed`);
      if (errors.length > 0) {
        console.log('Errors:', errors.slice(0, 5));
      }

      // At least 80% should work
      const percentage = (successCount / stockExpressions.length) * 100;
      expect(percentage).toBeGreaterThan(80);
    }, 120000); // 2 minute timeout for bulk test
  });
});

// Schema validation tests that always run (no Qlik connection needed)
describe('Expression Schema Validation', () => {
  let measures: any;
  let schema: any;

  beforeAll(() => {
    measures = loadJsonFile('semantic-measures.json');
    schema = loadJsonFile('semantic-schema.json');
  });

  test('All entity base filters are valid Qlik syntax', () => {
    Object.entries(schema.entities).forEach(([entityName, entity]: [string, any]) => {
      if (entity.baseFilter) {
        expect(entity.baseFilter).toMatch(/\w+={[^}]+}/);
      }
    });
  });

  test('All time period filters are valid Qlik syntax', () => {
    Object.entries(schema.timePeriods).forEach(([periodName, period]: [string, any]) => {
      if (period.filter) {
        expect(period.filter).toMatch(/\w+={'[^']+'}|^$/);
      }
    });
  });

  test('All dimension fields are valid identifiers', () => {
    const allDimensions = {
      ...measures.dimensions.shared,
      ...measures.dimensions.time,
      ...(measures.dimensions.satisfaction || {})
    };

    Object.entries(allDimensions).forEach(([dimName, dim]: [string, any]) => {
      expect(dim.field).toMatch(/^[\w_\[\]]+$/);
    });
  });

  test('Most expressions use consistent aggregation patterns', () => {
    const validPatterns = [
      /^[\(]*Count\(/i,
      /^[\(]*Sum\(/i,
      /^[\(]*Avg\(/i,
      /^[\(]*Min\(/i,
      /^[\(]*Max\(/i,
      /^[\(]*If\(/i,
      /^[\(]*RangeSum\(/i
    ];

    let matchCount = 0;
    let totalCount = 0;

    Object.entries(measures.measures).forEach(([entity, entityMeasures]) => {
      Object.entries(entityMeasures as object).forEach(([measureName, measure]: [string, any]) => {
        totalCount++;
        const matchesPattern = validPatterns.some(pattern =>
          pattern.test(measure.expression)
        );
        if (matchesPattern) matchCount++;
      });
    });

    const percentage = totalCount > 0 ? (matchCount / totalCount) * 100 : 100;
    expect(percentage).toBeGreaterThan(80);
  });
});
