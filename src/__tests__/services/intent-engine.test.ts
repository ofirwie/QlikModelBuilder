/**
 * Unit Tests for Intent Engine
 *
 * TaskGuard: testing-003
 * Tests the core intent recognition for Semantic Layer V4
 */

import { IntentEngine, IntentResult, ExtractedEntity } from '../../services/intent-engine.js';

describe('IntentEngine', () => {
  let engine: IntentEngine;

  beforeEach(() => {
    engine = new IntentEngine();
  });

  describe('recognize()', () => {
    describe('Hebrew intent matching', () => {
      it('should recognize status_overview intent from "מה המצב"', () => {
        const result = engine.recognize('מה המצב');
        expect(result.intent).toBe('status_overview');
        expect(result.confidence).toBeGreaterThanOrEqual(0.3);
      });

      it('should recognize urgent_attention intent from "מה דחוף"', () => {
        const result = engine.recognize('מה דחוף');
        expect(result.intent).toBe('urgent_attention');
        expect(result.confidence).toBeGreaterThanOrEqual(0.3);
      });

      it('should recognize overnight_activity intent from "מה קרה בלילה"', () => {
        const result = engine.recognize('מה קרה בלילה');
        expect(result.intent).toBe('overnight_activity');
        expect(result.confidence).toBeGreaterThanOrEqual(0.3);
      });

      it('should recognize workload_check intent from "מי עמוס"', () => {
        const result = engine.recognize('מי עמוס');
        expect(result.intent).toBe('workload_check');
        expect(result.confidence).toBeGreaterThanOrEqual(0.3);
      });

      it('should recognize my_work intent from "מה יש לי"', () => {
        const result = engine.recognize('מה יש לי');
        expect(result.intent).toBe('my_work');
        expect(result.confidence).toBeGreaterThanOrEqual(0.3);
      });

      it('should recognize stuck_tickets intent from "תקלות תקועות"', () => {
        const result = engine.recognize('תקלות תקועות');
        expect(result.intent).toBe('stuck_tickets');
        expect(result.confidence).toBeGreaterThanOrEqual(0.3);
      });

      it('should recognize recurring_issues intent from "תקלות חוזרות"', () => {
        const result = engine.recognize('תקלות חוזרות');
        expect(result.intent).toBe('recurring_issues');
        expect(result.confidence).toBeGreaterThanOrEqual(0.3);
      });

      it('should recognize why_question intent from "למה"', () => {
        const result = engine.recognize('למה יש כל כך הרבה תקלות');
        expect(result.intent).toBe('why_question');
        expect(result.confidence).toBeGreaterThanOrEqual(0.3);
      });

      it('should recognize customer_experience intent from "שביעות רצון"', () => {
        const result = engine.recognize('שביעות רצון');
        expect(result.intent).toBe('customer_experience');
        expect(result.confidence).toBeGreaterThanOrEqual(0.3);
      });
    });

    describe('English intent matching', () => {
      it('should recognize status_overview from "what\'s the status"', () => {
        const result = engine.recognize("what's the status");
        expect(result.intent).toBe('status_overview');
        expect(result.confidence).toBeGreaterThanOrEqual(0.3);
      });

      it('should recognize urgent_attention from "what\'s urgent"', () => {
        const result = engine.recognize("what's urgent");
        expect(result.intent).toBe('urgent_attention');
        expect(result.confidence).toBeGreaterThanOrEqual(0.3);
      });

      it('should recognize overnight_activity from "what happened overnight"', () => {
        const result = engine.recognize('what happened overnight');
        expect(result.intent).toBe('overnight_activity');
        expect(result.confidence).toBeGreaterThanOrEqual(0.3);
      });

      it('should recognize my_work from "my tickets"', () => {
        const result = engine.recognize('my tickets');
        expect(result.intent).toBe('my_work');
        expect(result.confidence).toBeGreaterThanOrEqual(0.3);
      });

      it('should recognize stuck_tickets from "stuck tickets"', () => {
        const result = engine.recognize('stuck tickets');
        expect(result.intent).toBe('stuck_tickets');
        expect(result.confidence).toBeGreaterThanOrEqual(0.3);
      });
    });

    describe('Implicit intents', () => {
      it('should recognize greeting "בוקר טוב מה המצב" as overnight_activity or status_overview', () => {
        // "בוקר טוב מה המצב" is a trigger for overnight_activity in intents file
        const result = engine.recognize('בוקר טוב');
        // Accept either overnight_activity (direct trigger match) or status_overview (implicit)
        expect(['overnight_activity', 'status_overview']).toContain(result.intent);
        expect(result.confidence).toBeGreaterThanOrEqual(0.3);
      });

      it('should recognize שלום as status_overview', () => {
        const result = engine.recognize('שלום');
        expect(result.intent).toBe('status_overview');
        expect(result.confidence).toBeGreaterThanOrEqual(0.3);
      });

      it('should recognize היי as status_overview', () => {
        const result = engine.recognize('היי');
        expect(result.intent).toBe('status_overview');
        expect(result.confidence).toBeGreaterThanOrEqual(0.3);
      });
    });

    describe('Edge cases', () => {
      it('should handle empty query', () => {
        const result = engine.recognize('');
        expect(result.intent).toBeNull();
        expect(result.confidence).toBe(0);
      });

      it('should handle whitespace-only query', () => {
        const result = engine.recognize('   ');
        expect(result.intent).toBeNull();
        expect(result.confidence).toBe(0);
      });

      it('should handle unknown query with low confidence', () => {
        const result = engine.recognize('random nonsense text xyz123');
        expect(result.confidence).toBeLessThan(0.3);
      });

      it('should normalize punctuation', () => {
        const result1 = engine.recognize('מה המצב?');
        const result2 = engine.recognize('מה המצב');
        expect(result1.intent).toBe(result2.intent);
      });

      it('should handle mixed case English', () => {
        const result = engine.recognize("WHAT'S THE STATUS");
        expect(result.intent).toBe('status_overview');
      });
    });

    describe('Confidence levels', () => {
      it('should return high confidence for exact match', () => {
        const result = engine.recognize('מה המצב');
        expect(result.confidence).toBeGreaterThanOrEqual(0.9);
      });

      it('should return medium confidence for partial match', () => {
        const result = engine.recognize('תגיד לי מה המצב בבקשה');
        expect(result.confidence).toBeGreaterThanOrEqual(0.5);
        expect(result.confidence).toBeLessThan(1.0);
      });
    });
  });

  describe('extractEntities()', () => {
    it('should extract incident entity from תקלה', () => {
      const entities = engine.extractEntities('יש לי תקלה');
      const incidentEntity = entities.find(e => e.type === 'entity' && e.value === 'incident');
      expect(incidentEntity).toBeDefined();
      expect(incidentEntity?.originalText).toBe('תקלה');
    });

    it('should extract incident entity from תקלות', () => {
      const entities = engine.extractEntities('כמה תקלות פתוחות');
      const incidentEntity = entities.find(e => e.type === 'entity' && e.value === 'incident');
      expect(incidentEntity).toBeDefined();
    });

    it('should extract request entity from בקשה', () => {
      const entities = engine.extractEntities('בקשה חדשה');
      const requestEntity = entities.find(e => e.type === 'entity' && e.value === 'request');
      expect(requestEntity).toBeDefined();
    });

    it('should extract dimension from טכנאי', () => {
      const entities = engine.extractEntities('לפי טכנאי');
      const dimEntity = entities.find(e => e.type === 'dimension' && e.value === 'assigned_user');
      expect(dimEntity).toBeDefined();
    });

    it('should extract dimension from קטגוריה', () => {
      const entities = engine.extractEntities('לפי קטגוריה');
      const dimEntity = entities.find(e => e.type === 'dimension' && e.value === 'category');
      expect(dimEntity).toBeDefined();
    });

    it('should extract status filter from פתוח', () => {
      const entities = engine.extractEntities('תקלות פתוח');
      const statusFilter = entities.find(e => e.type === 'filter' && e.value.includes('Open'));
      expect(statusFilter).toBeDefined();
    });

    it('should extract multiple entities', () => {
      const entities = engine.extractEntities('תקלות פתוחות לפי צוות');
      expect(entities.length).toBeGreaterThanOrEqual(2);
    });

    it('should return empty array for no entities', () => {
      const entities = engine.extractEntities('hello world');
      expect(entities).toEqual([]);
    });
  });

  describe('detectTimePeriod()', () => {
    describe('Hebrew time periods', () => {
      it('should detect היום as today', () => {
        const period = engine.detectTimePeriod('מה קרה היום');
        expect(period).toBe('today');
      });

      it('should detect אתמול as yesterday', () => {
        const period = engine.detectTimePeriod('מה קרה אתמול');
        expect(period).toBe('yesterday');
      });

      it('should detect החודש as this_month', () => {
        const period = engine.detectTimePeriod('תקלות החודש');
        expect(period).toBe('this_month');
      });

      it('should detect השבוע as this_week', () => {
        const period = engine.detectTimePeriod('תקלות השבוע');
        expect(period).toBe('this_week');
      });

      it('should detect השנה as this_year', () => {
        const period = engine.detectTimePeriod('תקלות השנה');
        expect(period).toBe('this_year');
      });

      it('should detect בלילה as overnight', () => {
        const period = engine.detectTimePeriod('מה קרה בלילה');
        expect(period).toBe('overnight');
      });
    });

    describe('English time periods', () => {
      it('should detect today', () => {
        const period = engine.detectTimePeriod('what happened today');
        expect(period).toBe('today');
      });

      it('should detect yesterday', () => {
        const period = engine.detectTimePeriod('what happened yesterday');
        expect(period).toBe('yesterday');
      });

      it('should detect this week', () => {
        const period = engine.detectTimePeriod('tickets this week');
        expect(period).toBe('this_week');
      });

      it('should detect this month', () => {
        const period = engine.detectTimePeriod('tickets this month');
        expect(period).toBe('this_month');
      });

      it('should detect last month', () => {
        const period = engine.detectTimePeriod('compared to last month');
        expect(period).toBe('last_month');
      });
    });

    it('should return null for no time period', () => {
      const period = engine.detectTimePeriod('מה המצב');
      expect(period).toBeNull();
    });
  });

  describe('detectDimension()', () => {
    describe('Hebrew dimensions', () => {
      it('should detect צוות as admin_group', () => {
        const dim = engine.detectDimension('לפי צוות');
        expect(dim).toBe('admin_group');
      });

      it('should detect טכנאי as assigned_user', () => {
        const dim = engine.detectDimension('לפי טכנאי');
        expect(dim).toBe('assigned_user');
      });

      it('should detect קטגוריה as category', () => {
        const dim = engine.detectDimension('לפי קטגוריה');
        expect(dim).toBe('category');
      });

      it('should detect מקור as source', () => {
        const dim = engine.detectDimension('לפי מקור');
        expect(dim).toBe('source');
      });
    });

    describe('English dimensions', () => {
      it('should detect by category', () => {
        const dim = engine.detectDimension('show by category');
        expect(dim).toBe('category');
      });

      it('should detect by team', () => {
        const dim = engine.detectDimension('breakdown by team');
        expect(dim).toBe('admin_group');
      });

      it('should detect by technician', () => {
        const dim = engine.detectDimension('show by technician');
        expect(dim).toBe('assigned_user');
      });

      it('should detect by priority', () => {
        const dim = engine.detectDimension('group by priority');
        expect(dim).toBe('priority');
      });
    });

    it('should return null for no dimension', () => {
      const dim = engine.detectDimension('מה המצב');
      expect(dim).toBeNull();
    });
  });

  describe('getAvailableIntents()', () => {
    it('should return array of intent names', () => {
      const intents = engine.getAvailableIntents();
      expect(Array.isArray(intents)).toBe(true);
      expect(intents.length).toBeGreaterThan(0);
    });

    it('should include status_overview', () => {
      const intents = engine.getAvailableIntents();
      expect(intents).toContain('status_overview');
    });

    it('should include urgent_attention', () => {
      const intents = engine.getAvailableIntents();
      expect(intents).toContain('urgent_attention');
    });
  });

  describe('getIntentDefinition()', () => {
    it('should return definition for valid intent', () => {
      const def = engine.getIntentDefinition('status_overview');
      expect(def).not.toBeNull();
      expect(def?.triggers).toBeDefined();
      expect(def?.response_type).toBe('dashboard');
    });

    it('should return null for invalid intent', () => {
      const def = engine.getIntentDefinition('nonexistent_intent');
      expect(def).toBeNull();
    });
  });

  describe('IntentResult structure', () => {
    it('should return complete IntentResult object', () => {
      const result = engine.recognize('מה המצב');

      expect(result).toHaveProperty('intent');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('matchedTrigger');
      expect(result).toHaveProperty('entities');
      expect(result).toHaveProperty('timePeriod');
      expect(result).toHaveProperty('dimension');
      expect(result).toHaveProperty('filters');
      expect(result).toHaveProperty('responseType');
      expect(result).toHaveProperty('components');
    });

    it('should have entities as array', () => {
      const result = engine.recognize('תקלות פתוחות');
      expect(Array.isArray(result.entities)).toBe(true);
    });

    it('should have filters as object', () => {
      const result = engine.recognize('מה המצב');
      expect(typeof result.filters).toBe('object');
    });
  });
});
