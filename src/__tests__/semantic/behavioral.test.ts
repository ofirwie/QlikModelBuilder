/**
 * Semantic Layer Behavioral Tests
 * Tests AI behavior patterns using mocked semantic handlers
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load test cases
const TEST_CASES_PATH = path.join(__dirname, '../../../tests/behavioral-test-cases.json');
const KNOWLEDGE_DIR = path.join(__dirname, '../../../docs/knowledge');

interface TestCase {
  id: string;
  category: string;
  query: string;
  language?: string;
  expectedBehavior: {
    shouldAskForTimePeriod?: boolean;
    shouldExecuteImmediately?: boolean;
    shouldAskForClarification?: boolean;
    shouldReturnBreakdown?: boolean;
    shouldIndicateNoData?: boolean;
    shouldOfferDrillOptions?: boolean;
    shouldReturnComparison?: boolean;
    expectedEntity?: string;
    expectedMeasure?: string;
    expectedDimension?: string;
    expectedTimePeriod?: string;
    expectedTimePeriods?: string[];
    maxResults?: number;
  };
  passCriteria: string[];
  failCriteria?: string[];
}

interface TestCasesFile {
  testCases: TestCase[];
  evaluationCriteria: {
    timeQuestionPhrases: string[];
    clarificationPhrases: string[];
    noDataPhrases: string[];
  };
}

// Load semantic layer files
const loadJsonFile = (filename: string): any => {
  const filePath = path.join(KNOWLEDGE_DIR, filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
};

/**
 * Mock semantic query analyzer
 * Simulates AI behavior based on semantic layer rules
 */
class SemanticQueryAnalyzer {
  private schema: any;
  private measures: any;
  private guidance: any;
  private i18n: any;

  constructor() {
    this.schema = loadJsonFile('semantic-schema.json');
    this.measures = loadJsonFile('semantic-measures.json');
    this.guidance = loadJsonFile('semantic-ai-guidance.json');
    this.i18n = loadJsonFile('semantic-i18n-he.json');
  }

  /**
   * Analyze a query and determine expected AI behavior
   */
  analyzeQuery(query: string): {
    detectedEntity: string | null;
    detectedMeasure: string | null;
    measureType: 'stock' | 'flow' | null;
    requiresTimePeriod: boolean;
    hasTimePeriod: boolean;
    isAmbiguous: boolean;
    suggestedAction: 'execute' | 'ask_time' | 'ask_clarify';
  } {
    const lowerQuery = query.toLowerCase();

    // Detect entity
    let detectedEntity: string | null = null;
    for (const [entityName, entity] of Object.entries(this.schema.entities)) {
      const entityDef = entity as any;
      const allNames = [
        entityName,
        ...entityDef.aliases.map((a: string) => a.toLowerCase())
      ];

      // Also check Hebrew names
      const hebrewEntity = this.i18n.entities[entityName];
      if (hebrewEntity) {
        allNames.push(hebrewEntity.name, hebrewEntity.plural);
        allNames.push(...(hebrewEntity.aliases || []));
      }

      if (allNames.some(name => lowerQuery.includes(name.toLowerCase()))) {
        detectedEntity = entityName;
        break;
      }
    }

    // Detect measure from context
    let detectedMeasure: string | null = null;
    let measureType: 'stock' | 'flow' | null = null;
    let requiresTimePeriod = false;

    // Check for technician queries FIRST (before "open" detection)
    // "Who has the most open tickets?" is about technicians, not incidents
    if (lowerQuery.includes('who has') || lowerQuery.includes('technician') ||
        (lowerQuery.includes('who') && lowerQuery.includes('most'))) {
      detectedEntity = 'technician';
      detectedMeasure = 'active_tickets';
      measureType = 'stock';
      requiresTimePeriod = false;
    }
    // Check for historical indicators (flow metrics)
    else if (lowerQuery.includes('opened') || lowerQuery.includes('were') ||
             lowerQuery.includes('total') || lowerQuery.includes('נפתחו')) {
      detectedMeasure = 'total_volume';
      measureType = 'flow';
      requiresTimePeriod = true;
    }
    // Check for current state indicators - stock measure
    else if (lowerQuery.includes('open') || lowerQuery.includes('current') ||
             lowerQuery.includes('backlog') || lowerQuery.includes('פתוח') ||
             lowerQuery.includes('פתוחות')) {
      detectedMeasure = 'active_count';
      measureType = 'stock';
      requiresTimePeriod = false;
    }

    // "backlog" always implies incident entity
    if (lowerQuery.includes('backlog') && !detectedEntity) {
      detectedEntity = 'incident';
    }

    // Check for resolution time (only if not already set)
    if (!detectedMeasure && (lowerQuery.includes('resolution time') || lowerQuery.includes('זמן טיפול'))) {
      detectedMeasure = 'avg_resolution_time';
      measureType = 'flow';
      requiresTimePeriod = true;
    }

    // Check for SLA
    if (!detectedMeasure && (lowerQuery.includes('sla') || lowerQuery.includes('compliance'))) {
      detectedMeasure = 'compliance_rate';
      measureType = 'flow';
      requiresTimePeriod = true;
    }

    // Check if time period is provided in query
    const hasTimePeriod = this.hasTimePeriodInQuery(lowerQuery);

    // Determine if query is ambiguous
    // Ambiguous if no entity detected but measure type could apply to multiple entities
    const hasExplicitEntity = lowerQuery.includes('incident') || lowerQuery.includes('request') ||
                              lowerQuery.includes('ticket') || lowerQuery.includes('תקלה') ||
                              lowerQuery.includes('בקשה');
    const isAmbiguous = !detectedEntity && !hasExplicitEntity;

    // Determine suggested action
    let suggestedAction: 'execute' | 'ask_time' | 'ask_clarify';
    if (isAmbiguous) {
      suggestedAction = 'ask_clarify';
    } else if (measureType === 'flow' && !hasTimePeriod) {
      suggestedAction = 'ask_time';
    } else {
      suggestedAction = 'execute';
    }

    return {
      detectedEntity,
      detectedMeasure,
      measureType,
      requiresTimePeriod,
      hasTimePeriod,
      isAmbiguous,
      suggestedAction
    };
  }

  /**
   * Check if query contains a time period
   */
  private hasTimePeriodInQuery(query: string): boolean {
    const timePhrases = [
      'this month', 'last month', 'this year', 'last year',
      'this quarter', 'last quarter', 'today', 'yesterday',
      'החודש', 'חודש שעבר', 'השנה', 'שנה שעברה'
    ];

    return timePhrases.some(phrase => query.includes(phrase));
  }

  /**
   * Get measure definition
   */
  getMeasureDefinition(entity: string, measure: string): any {
    return this.measures.measures[entity]?.[measure];
  }

  /**
   * Get drill options for entity
   */
  getDrillOptions(entity: string): string[] {
    return this.schema.entities[entity]?.drillPath || [];
  }
}

// Load test cases at module level for test.each to work
const testCasesData: TestCasesFile = JSON.parse(fs.readFileSync(TEST_CASES_PATH, 'utf-8'));

describe('Semantic Layer Behavioral Tests', () => {
  let analyzer: SemanticQueryAnalyzer;

  beforeAll(() => {
    analyzer = new SemanticQueryAnalyzer();
  });

  describe('Stock Metric Behavior', () => {
    const stockTests = testCasesData.testCases.filter(tc =>
      tc.category.includes('Stock Metric')
    );

    test.each(stockTests.map(tc => [tc.id, tc]))('%s: %s', (id, testCase) => {
      const tc = testCase as TestCase;
      const analysis = analyzer.analyzeQuery(tc.query);

      // Stock metrics should NOT require time period
      if (tc.expectedBehavior.shouldAskForTimePeriod === false) {
        expect(analysis.suggestedAction).not.toBe('ask_time');
      }

      // Should execute immediately
      if (tc.expectedBehavior.shouldExecuteImmediately) {
        expect(analysis.suggestedAction).toBe('execute');
      }

      // Verify entity detection if specified
      if (tc.expectedBehavior.expectedEntity) {
        expect(analysis.detectedEntity).toBe(tc.expectedBehavior.expectedEntity);
      }
    });
  });

  describe('Flow Metric Behavior', () => {
    const flowTests = testCasesData.testCases.filter(tc =>
      tc.category.includes('Flow Metric')
    );

    test.each(flowTests.map(tc => [tc.id, tc]))('%s: %s', (id, testCase) => {
      const tc = testCase as TestCase;
      const analysis = analyzer.analyzeQuery(tc.query);

      // Flow metrics without time period should ask for it
      if (tc.expectedBehavior.shouldAskForTimePeriod === true) {
        expect(analysis.suggestedAction).toBe('ask_time');
        expect(analysis.requiresTimePeriod).toBe(true);
      }

      // Flow metrics with time period should execute
      if (tc.expectedBehavior.shouldAskForTimePeriod === false &&
          tc.expectedBehavior.expectedTimePeriod) {
        expect(analysis.hasTimePeriod).toBe(true);
        expect(analysis.suggestedAction).toBe('execute');
      }
    });
  });

  describe('Drill Down Behavior', () => {
    const drillTests = testCasesData.testCases.filter(tc =>
      tc.category.includes('Drill Down')
    );

    test.each(drillTests.map(tc => [tc.id, tc]))('%s: %s', (id, testCase) => {
      const tc = testCase as TestCase;
      const analysis = analyzer.analyzeQuery(tc.query);

      // If entity is detected, verify drill options exist
      if (analysis.detectedEntity) {
        const drillOptions = analyzer.getDrillOptions(analysis.detectedEntity);
        expect(drillOptions.length).toBeGreaterThan(0);

        // If specific dimension expected, verify it's available
        if (tc.expectedBehavior.expectedDimension) {
          expect(drillOptions).toContain(tc.expectedBehavior.expectedDimension);
        }
      }
    });
  });

  describe('Ambiguity Handling', () => {
    const ambigTests = testCasesData.testCases.filter(tc =>
      tc.category.includes('Ambiguous')
    );

    test.each(ambigTests.map(tc => [tc.id, tc]))('%s: %s', (id, testCase) => {
      const tc = testCase as TestCase;
      const analysis = analyzer.analyzeQuery(tc.query);

      // Ambiguous queries should trigger clarification
      if (tc.expectedBehavior.shouldAskForClarification) {
        expect(analysis.suggestedAction).toBe('ask_clarify');
      }
    });
  });

  describe('Measure Type Consistency', () => {
    test('All stock measures in schema do not require time period', () => {
      const measures = loadJsonFile('semantic-measures.json');

      Object.entries(measures.measures).forEach(([entity, entityMeasures]) => {
        Object.entries(entityMeasures as object).forEach(([measureName, measure]: [string, any]) => {
          if (measure.type === 'stock') {
            expect(measure.requiresTimePeriod).toBe(false);
          }
        });
      });
    });

    test('Flow measures with V_ToDate require time period', () => {
      const measures = loadJsonFile('semantic-measures.json');

      Object.entries(measures.measures).forEach(([entity, entityMeasures]) => {
        Object.entries(entityMeasures as object).forEach(([measureName, measure]: [string, any]) => {
          // Only flow measures that use V_ToDate must require time period
          if (measure.type === 'flow' && measure.expression?.includes('V_ToDate')) {
            expect(measure.requiresTimePeriod).toBe(true);
          }
        });
      });
    });
  });

  describe('AI Guidance Compliance', () => {
    test('Guidance specifies different behavior for stock vs flow', () => {
      const guidance = loadJsonFile('semantic-ai-guidance.json');

      expect(guidance.measureTypeHandling.stock.requiresTimePeriod).toBe(false);
      expect(guidance.measureTypeHandling.flow.requiresTimePeriod).toBe(true);
    });

    test('Flow guidance has clarification template', () => {
      const guidance = loadJsonFile('semantic-ai-guidance.json');

      expect(guidance.measureTypeHandling.flow.clarificationTemplate).toBeDefined();
      expect(guidance.measureTypeHandling.flow.clarificationTemplate).toContain('time period');
    });

    test('Anti-patterns include assuming time period', () => {
      const guidance = loadJsonFile('semantic-ai-guidance.json');

      const assumptionAntiPattern = guidance.antiPatterns.find((ap: any) =>
        ap.pattern.toLowerCase().includes('assuming') &&
        ap.pattern.toLowerCase().includes('period')
      );

      expect(assumptionAntiPattern).toBeDefined();
    });
  });

  describe('Entity Recognition', () => {
    test('Recognizes incident from various keywords', () => {
      const queries = [
        'How many incidents are there?',
        'Show me tickets',
        'כמה תקלות יש?'
      ];

      queries.forEach(query => {
        const analysis = analyzer.analyzeQuery(query);
        expect(analysis.detectedEntity).toBe('incident');
      });
    });

    test('Recognizes technician queries', () => {
      const query = 'Who has the most open tickets?';
      const analysis = analyzer.analyzeQuery(query);

      expect(analysis.detectedEntity).toBe('technician');
      expect(analysis.detectedMeasure).toBe('active_tickets');
    });
  });

  describe('Time Period Detection', () => {
    test('Detects "this month" as time period', () => {
      const analysis = analyzer.analyzeQuery('Show incidents this month');
      expect(analysis.hasTimePeriod).toBe(true);
    });

    test('Detects "last month" as time period', () => {
      const analysis = analyzer.analyzeQuery('Show incidents last month');
      expect(analysis.hasTimePeriod).toBe(true);
    });

    test('Detects Hebrew time period', () => {
      const analysis = analyzer.analyzeQuery('תקלות החודש');
      expect(analysis.hasTimePeriod).toBe(true);
    });

    test('No time period in simple query', () => {
      const analysis = analyzer.analyzeQuery('How many incidents were opened?');
      expect(analysis.hasTimePeriod).toBe(false);
    });
  });
});
