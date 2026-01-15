/**
 * Semantic Layer Expression Validation Tests
 * Validates Qlik expression syntax in measure definitions
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KNOWLEDGE_DIR = path.join(__dirname, '../../../docs/knowledge');

// Load measures file
const loadMeasures = (): any => {
  const filePath = path.join(KNOWLEDGE_DIR, 'semantic-measures.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
};

// Helper to count occurrences of a character
const countChar = (str: string, char: string): number => {
  return (str.match(new RegExp(`\\${char}`, 'g')) || []).length;
};

// Helper to check balanced brackets
const isBalanced = (expr: string, open: string, close: string): boolean => {
  return countChar(expr, open) === countChar(expr, close);
};

describe('Qlik Expression Validation', () => {
  let measures: any;
  let allExpressions: Array<{ entity: string; measure: string; expression: string; type: string }>;

  beforeAll(() => {
    measures = loadMeasures();

    // Collect all expressions for testing
    allExpressions = [];
    Object.entries(measures.measures).forEach(([entityName, entityMeasures]) => {
      Object.entries(entityMeasures as object).forEach(([measureName, measure]: [string, any]) => {
        if (measure.expression) {
          allExpressions.push({
            entity: entityName,
            measure: measureName,
            expression: measure.expression,
            type: measure.type
          });
        }
      });
    });
  });

  describe('Bracket Balance', () => {
    test('All expressions have balanced parentheses', () => {
      allExpressions.forEach(({ entity, measure, expression }) => {
        const openCount = countChar(expression, '(');
        const closeCount = countChar(expression, ')');

        expect({
          expression: `${entity}.${measure}`,
          openParens: openCount,
          closeParens: closeCount,
          balanced: openCount === closeCount
        }).toMatchObject({
          balanced: true
        });
      });
    });

    test('All expressions have balanced curly braces', () => {
      allExpressions.forEach(({ entity, measure, expression }) => {
        const openCount = countChar(expression, '{');
        const closeCount = countChar(expression, '}');

        expect({
          expression: `${entity}.${measure}`,
          openBraces: openCount,
          closeBraces: closeCount,
          balanced: openCount === closeCount
        }).toMatchObject({
          balanced: true
        });
      });
    });

    test('Most expressions have balanced angle brackets in set analysis', () => {
      let balancedCount = 0;

      allExpressions.forEach(({ entity, measure, expression }) => {
        // Remove quoted strings that may contain < or > comparison operators
        // Match patterns like {'>0'}, {'>=5'}, {"<10"}, etc.
        let cleanExpr = expression.replace(/'[^']*'/g, '""');
        cleanExpr = cleanExpr.replace(/"[^"]*"/g, '""');
        // Also remove >= and <= comparison operators outside quotes
        cleanExpr = cleanExpr.replace(/<=/g, ' ').replace(/>=/g, ' ');

        const openCount = countChar(cleanExpr, '<');
        const closeCount = countChar(cleanExpr, '>');

        if (openCount === closeCount) {
          balancedCount++;
        }
      });

      // At least 95% should have balanced brackets
      const percentage = allExpressions.length > 0 ? (balancedCount / allExpressions.length) * 100 : 100;
      expect(percentage).toBeGreaterThan(95);
    });

    test('All expressions have balanced single quotes', () => {
      allExpressions.forEach(({ entity, measure, expression }) => {
        const quoteCount = countChar(expression, "'");

        expect({
          expression: `${entity}.${measure}`,
          quotes: quoteCount,
          balanced: quoteCount % 2 === 0
        }).toMatchObject({
          balanced: true
        });
      });
    });
  });

  describe('V_ToDate Variable Usage', () => {
    test('Most flow expressions that require time period contain V_ToDate', () => {
      // Only check flow expressions that specifically require time period
      const flowWithTimePeriod = allExpressions.filter(e => {
        const measureDef = measures.measures[e.entity]?.[e.measure];
        return e.type === 'flow' && measureDef?.requiresTimePeriod === true;
      });

      let withVToDate = 0;
      flowWithTimePeriod.forEach(({ expression }) => {
        if (expression.includes('$(V_ToDate)') || expression.includes('$(V_FromDate)')) {
          withVToDate++;
        }
      });

      // At least 90% should have V_ToDate
      const percentage = flowWithTimePeriod.length > 0 ? (withVToDate / flowWithTimePeriod.length) * 100 : 100;
      expect(percentage).toBeGreaterThan(90);
    });

    test('Stock expressions do NOT contain $(V_ToDate)', () => {
      const stockExpressions = allExpressions.filter(e => e.type === 'stock');

      stockExpressions.forEach(({ entity, measure, expression }) => {
        expect({
          expression: `${entity}.${measure}`,
          containsVToDate: expression.includes('$(V_ToDate)')
        }).toMatchObject({
          containsVToDate: false
        });
      });
    });
  });

  describe('Expression Patterns', () => {
    test('Most expressions use aggregation functions', () => {
      const validAggregations = ['Count', 'Sum', 'Avg', 'Min', 'Max', 'Only', 'Concat', 'FirstSortedValue', 'RangeSum', 'RangeAvg', 'If'];

      // Count how many use aggregations
      let withAggregation = 0;
      allExpressions.forEach(({ expression }) => {
        const hasAggregation = validAggregations.some(agg =>
          expression.includes(`${agg}(`) || expression.includes(`${agg.toLowerCase()}(`)
        );
        if (hasAggregation) withAggregation++;
      });

      // At least 80% should use standard aggregation functions
      const percentage = (withAggregation / allExpressions.length) * 100;
      expect(percentage).toBeGreaterThan(80);
    });

    test('Most Count expressions use distinct pattern', () => {
      const countExpressions = allExpressions.filter(e =>
        e.expression.toLowerCase().includes('count(')
      );

      let withDistinct = 0;
      countExpressions.forEach(({ expression }) => {
        const usesDistinct = expression.includes('distinct(sr_id)') ||
                            expression.includes('distinct sr_id') ||
                            expression.includes('DISTINCT(sr_id)') ||
                            expression.includes('distinct(');
        if (usesDistinct) withDistinct++;
      });

      // At least 70% of count expressions should use distinct
      const percentage = countExpressions.length > 0 ? (withDistinct / countExpressions.length) * 100 : 100;
      expect(percentage).toBeGreaterThan(70);
    });

    test('Set analysis uses proper syntax {<...>}', () => {
      allExpressions.forEach(({ entity, measure, expression }) => {
        // If expression has set analysis, it should use {<...>} format
        if (expression.includes('{<')) {
          // Find all {< ... >} blocks and verify each one is properly closed
          // This regex matches set analysis blocks including nested quotes
          const setBlocks = expression.match(/\{<[^>]*(?:>[^>]*)*>\}/g) || [];
          const hasSetAnalysis = expression.includes('{<');
          const hasProperSetSyntax = setBlocks.length > 0 || !hasSetAnalysis;

          expect({
            expression: `${entity}.${measure}`,
            hasProperSetSyntax
          }).toMatchObject({
            hasProperSetSyntax: true
          });
        }
      });
    });
  });

  describe('Entity-Specific Filters', () => {
    test('Most Incident measures use sr_type_index filter', () => {
      const incidentExpressions = allExpressions.filter(e => e.entity === 'incident');

      let withFilter = 0;
      incidentExpressions.forEach(({ expression }) => {
        const hasIncidentFilter = expression.includes('sr_type_index={1}') ||
                                  expression.includes("sr_type_index={'1'}") ||
                                  expression.includes('sr_type_index=');
        if (hasIncidentFilter) withFilter++;
      });

      // At least 70% should have the filter
      const percentage = incidentExpressions.length > 0 ? (withFilter / incidentExpressions.length) * 100 : 100;
      expect(percentage).toBeGreaterThan(70);
    });

    test('Most Request measures use sr_type_index filter', () => {
      const requestExpressions = allExpressions.filter(e => e.entity === 'request');

      let withFilter = 0;
      requestExpressions.forEach(({ expression }) => {
        const hasRequestFilter = expression.includes('sr_type_index={10}') ||
                                 expression.includes("sr_type_index={'10'}") ||
                                 expression.includes('sr_type_index=');
        if (hasRequestFilter) withFilter++;
      });

      // At least 70% should have the filter
      const percentage = requestExpressions.length > 0 ? (withFilter / requestExpressions.length) * 100 : 100;
      expect(percentage).toBeGreaterThan(70);
    });
  });

  describe('Expression Format', () => {
    test('All expressions are non-empty strings', () => {
      allExpressions.forEach(({ entity, measure, expression }) => {
        expect(typeof expression).toBe('string');
        expect(expression.trim().length).toBeGreaterThan(0);
      });
    });

    test('No expressions contain line breaks', () => {
      allExpressions.forEach(({ entity, measure, expression }) => {
        expect(expression.includes('\n')).toBe(false);
        expect(expression.includes('\r')).toBe(false);
      });
    });

    test('No expressions have trailing/leading whitespace', () => {
      allExpressions.forEach(({ entity, measure, expression }) => {
        expect(expression).toBe(expression.trim());
      });
    });
  });

  describe('Measure Metadata', () => {
    test('All measures have unit defined', () => {
      allExpressions.forEach(({ entity, measure }) => {
        const measureDef = measures.measures[entity][measure];
        expect(measureDef.unit).toBeDefined();
      });
    });

    test('All measures have format defined', () => {
      allExpressions.forEach(({ entity, measure }) => {
        const measureDef = measures.measures[entity][measure];
        expect(measureDef.format).toBeDefined();
      });
    });

    test('All measures have description defined', () => {
      allExpressions.forEach(({ entity, measure }) => {
        const measureDef = measures.measures[entity][measure];
        expect(measureDef.description).toBeDefined();
        expect(measureDef.description.length).toBeGreaterThan(0);
      });
    });
  });
});
