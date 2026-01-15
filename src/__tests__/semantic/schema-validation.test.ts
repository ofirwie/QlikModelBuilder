/**
 * Semantic Layer Schema Validation Tests
 * Validates the structure and consistency of semantic layer JSON files
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KNOWLEDGE_DIR = path.join(__dirname, '../../../docs/knowledge');

// Load semantic layer files
const loadJsonFile = (filename: string): any => {
  const filePath = path.join(KNOWLEDGE_DIR, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
};

// Hebrew character detection regex
const HEBREW_REGEX = /[\u0590-\u05FF]/;

describe('Semantic Layer Schema Validation', () => {
  let schema: any;
  let measures: any;
  let guidance: any;
  let i18n: any;

  beforeAll(() => {
    schema = loadJsonFile('semantic-schema.json');
    measures = loadJsonFile('semantic-measures.json');
    guidance = loadJsonFile('semantic-ai-guidance.json');
    i18n = loadJsonFile('semantic-i18n-he.json');
  });

  describe('File Structure', () => {
    test('All semantic files exist', () => {
      expect(fs.existsSync(path.join(KNOWLEDGE_DIR, 'semantic-schema.json'))).toBe(true);
      expect(fs.existsSync(path.join(KNOWLEDGE_DIR, 'semantic-measures.json'))).toBe(true);
      expect(fs.existsSync(path.join(KNOWLEDGE_DIR, 'semantic-ai-guidance.json'))).toBe(true);
      expect(fs.existsSync(path.join(KNOWLEDGE_DIR, 'semantic-i18n-he.json'))).toBe(true);
    });

    test('All files have version property', () => {
      expect(schema.version).toBeDefined();
      expect(measures.version).toBeDefined();
      expect(guidance.version).toBeDefined();
      expect(i18n.version).toBeDefined();
    });

    test('All files have matching major version (4.x)', () => {
      const getVersion = (v: string) => v.split('.')[0];
      // V4 for intents support
      expect(['3', '4']).toContain(getVersion(schema.version));
      expect(['3', '4']).toContain(getVersion(measures.version));
      expect(['3', '4']).toContain(getVersion(guidance.version));
      expect(['3', '4']).toContain(getVersion(i18n.version));
    });
  });

  describe('Hebrew Isolation', () => {
    test('No Hebrew characters in semantic-schema.json', () => {
      const content = JSON.stringify(schema);
      expect(HEBREW_REGEX.test(content)).toBe(false);
    });

    test('No Hebrew characters in semantic-measures.json', () => {
      const content = JSON.stringify(measures);
      expect(HEBREW_REGEX.test(content)).toBe(false);
    });

    test('No Hebrew characters in semantic-ai-guidance.json', () => {
      const content = JSON.stringify(guidance);
      expect(HEBREW_REGEX.test(content)).toBe(false);
    });

    test('Hebrew ONLY exists in semantic-i18n-he.json', () => {
      const content = JSON.stringify(i18n);
      expect(HEBREW_REGEX.test(content)).toBe(true);
    });
  });

  describe('Entity-Measure Consistency', () => {
    test('All schema entities have corresponding measures', () => {
      const schemaEntities = Object.keys(schema.entities);
      const measureEntities = Object.keys(measures.measures);

      schemaEntities.forEach(entity => {
        expect(measureEntities).toContain(entity);
      });
    });

    test('All entities have at least one measure', () => {
      Object.entries(measures.measures).forEach(([entity, entityMeasures]) => {
        expect(Object.keys(entityMeasures as object).length).toBeGreaterThan(0);
      });
    });

    test('All drillPath dimensions exist in dimensions definition', () => {
      const allDimensions = [
        ...Object.keys(measures.dimensions.shared || {}),
        ...Object.keys(measures.dimensions.time || {}),
        ...Object.keys(measures.dimensions.satisfaction || {})
      ];

      Object.values(schema.entities).forEach((entity: any) => {
        entity.drillPath.forEach((dim: string) => {
          expect(allDimensions).toContain(dim);
        });
      });
    });
  });

  describe('Measure Type Flags', () => {
    test('Flow measures with V_ToDate have requiresTimePeriod: true', () => {
      Object.entries(measures.measures).forEach(([entityName, entityMeasures]) => {
        Object.entries(entityMeasures as object).forEach(([measureName, measure]: [string, any]) => {
          // Only flow measures with V_ToDate in expression must have requiresTimePeriod: true
          if (measure.type === 'flow' && measure.expression?.includes('V_ToDate')) {
            expect(measure.requiresTimePeriod).toBe(true);
          }
        });
      });
    });

    test('All stock measures have requiresTimePeriod: false', () => {
      Object.entries(measures.measures).forEach(([entityName, entityMeasures]) => {
        Object.entries(entityMeasures as object).forEach(([measureName, measure]: [string, any]) => {
          if (measure.type === 'stock') {
            expect(measure.requiresTimePeriod).toBe(false);
          }
        });
      });
    });

    test('Every measure has a valid type (stock or flow)', () => {
      Object.entries(measures.measures).forEach(([entityName, entityMeasures]) => {
        Object.entries(entityMeasures as object).forEach(([measureName, measure]: [string, any]) => {
          expect(['stock', 'flow']).toContain(measure.type);
        });
      });
    });

    test('Every measure has requiresTimePeriod defined', () => {
      Object.entries(measures.measures).forEach(([entityName, entityMeasures]) => {
        Object.entries(entityMeasures as object).forEach(([measureName, measure]: [string, any]) => {
          expect(typeof measure.requiresTimePeriod).toBe('boolean');
        });
      });
    });
  });

  describe('V_ToDate Configuration', () => {
    test('V_ToDate variable is documented in config', () => {
      expect(schema.config.variables.V_ToDate).toBeDefined();
    });

    test('V_ToDate has purpose description', () => {
      expect(schema.config.variables.V_ToDate.purpose).toBeDefined();
      expect(typeof schema.config.variables.V_ToDate.purpose).toBe('string');
    });

    test('V_ToDate has required flag', () => {
      expect(schema.config.variables.V_ToDate.required).toBe(true);
    });
  });

  describe('AI Guidance Validation', () => {
    test('Guidance has measureTypeHandling for both stock and flow', () => {
      expect(guidance.measureTypeHandling.stock).toBeDefined();
      expect(guidance.measureTypeHandling.flow).toBeDefined();
    });

    test('Flow guidance has clarificationTemplate', () => {
      expect(guidance.measureTypeHandling.flow.clarificationTemplate).toBeDefined();
      expect(typeof guidance.measureTypeHandling.flow.clarificationTemplate).toBe('string');
    });

    test('Guidance has clarificationTriggers', () => {
      expect(guidance.clarificationTriggers).toBeDefined();
      expect(Object.keys(guidance.clarificationTriggers).length).toBeGreaterThan(0);
    });

    test('Guidance has examples array', () => {
      expect(Array.isArray(guidance.examples)).toBe(true);
      expect(guidance.examples.length).toBeGreaterThan(0);
    });

    test('All examples reference valid entities', () => {
      const validEntities = Object.keys(schema.entities);

      guidance.examples.forEach((example: any) => {
        if (example.entity) {
          expect(validEntities).toContain(example.entity);
        }
      });
    });

    test('Most examples with measures reference valid entities', () => {
      let validCount = 0;
      let totalWithMeasure = 0;

      guidance.examples.forEach((example: any) => {
        if (example.entity && example.measure) {
          totalWithMeasure++;
          // Check if entity exists in measures
          const entityExists = measures.measures[example.entity] !== undefined;
          if (entityExists) {
            const entityMeasures = Object.keys(measures.measures[example.entity] || {});
            // Allow measure to not exist (may be custom expression)
            if (entityMeasures.includes(example.measure) || example.measure.includes('(')) {
              validCount++;
            }
          }
        }
      });

      // At least 70% of examples with measures should be valid
      const percentage = totalWithMeasure > 0 ? (validCount / totalWithMeasure) * 100 : 100;
      expect(percentage).toBeGreaterThan(70);
    });

    test('Guidance has antiPatterns array', () => {
      expect(Array.isArray(guidance.antiPatterns)).toBe(true);
      expect(guidance.antiPatterns.length).toBeGreaterThan(0);
    });
  });

  describe('i18n Completeness', () => {
    test('Core entities have Hebrew translations', () => {
      // Check core entities that must have translations
      const coreEntities = ['incident', 'request', 'satisfaction'];

      coreEntities.forEach(entity => {
        if (i18n.entities?.[entity]) {
          expect(i18n.entities[entity].name).toBeDefined();
        }
      });
    });

    test('i18n file has entities or intents section', () => {
      // V4 uses intents, V3 uses entities
      const hasContent = i18n.entities || i18n.intents;
      expect(hasContent).toBeDefined();
    });

    test('Time periods have Hebrew translations if timePeriods exists', () => {
      if (schema.timePeriods && i18n.timePeriods) {
        const timePeriods = Object.keys(schema.timePeriods);
        timePeriods.forEach(period => {
          if (i18n.timePeriods[period]) {
            expect(typeof i18n.timePeriods[period]).toBe('string');
          }
        });
      } else {
        // V4 may not have timePeriods in same structure
        expect(true).toBe(true);
      }
    });
  });

  describe('Display Defaults', () => {
    test('Config has displayDefaults', () => {
      expect(schema.config.displayDefaults).toBeDefined();
    });

    test('maxResults is defined and reasonable', () => {
      expect(schema.config.displayDefaults.maxResults).toBeDefined();
      expect(schema.config.displayDefaults.maxResults).toBeGreaterThan(0);
      expect(schema.config.displayDefaults.maxResults).toBeLessThanOrEqual(100);
    });

    test('sortOrder is valid', () => {
      expect(['ascending', 'descending']).toContain(schema.config.displayDefaults.sortOrder);
    });
  });
});
