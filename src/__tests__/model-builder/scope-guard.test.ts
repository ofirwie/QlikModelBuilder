/**
 * @fileoverview Unit tests for Scope Guard
 */

import {
  ScopeGuard,
  createScopeGuard,
  RequestContext,
} from '../../model-builder/services/scope-guard.js';

describe('ScopeGuard', () => {
  let guard: ScopeGuard;

  beforeEach(() => {
    guard = new ScopeGuard();
  });

  describe('classifyIntent', () => {
    it('should classify "build a star schema" as build_model', () => {
      const result = guard.classifyIntent('build a star schema for sales data');
      expect(result.intent).toBe('build_model');
      expect(result.keywords_found).toContain('star');
      expect(result.keywords_found).toContain('schema');
    });

    it('should classify "add field CustomerName" as add_field', () => {
      const result = guard.classifyIntent('add field CustomerName to the table');
      expect(result.intent).toBe('add_field');
    });

    it('should classify "remove field OldColumn" as remove_field', () => {
      const result = guard.classifyIntent('remove field OldColumn');
      expect(result.intent).toBe('remove_field');
    });

    it('should classify "explain QUALIFY" as explain_code', () => {
      const result = guard.classifyIntent('explain how QUALIFY works in Qlik');
      expect(result.intent).toBe('explain_code');
    });

    it('should classify "fix the issue" as fix_issue', () => {
      const result = guard.classifyIntent('fix the issue in my script');
      expect(result.intent).toBe('fix_issue');
    });

    it('should classify "review the script" as review_script', () => {
      const result = guard.classifyIntent('review the script for errors');
      expect(result.intent).toBe('review_script');
    });

    it('should classify "approve stage" as approve_stage', () => {
      const result = guard.classifyIntent('approve this stage and continue');
      expect(result.intent).toBe('approve_stage');
    });

    it('should classify "go back" as go_back', () => {
      const result = guard.classifyIntent('go back to previous stage');
      expect(result.intent).toBe('go_back');
    });

    it('should classify "show progress" as show_progress', () => {
      const result = guard.classifyIntent('show my current progress');
      expect(result.intent).toBe('show_progress');
    });

    it('should classify "configure calendar" as configure_calendar', () => {
      const result = guard.classifyIntent('configure calendar dimension');
      expect(result.intent).toBe('configure_calendar');
    });

    it('should return low confidence for non-Qlik requests', () => {
      const result = guard.classifyIntent('what is the weather today');
      expect(result.confidence).toBeLessThan(0.3);
      expect(result.keywords_found.length).toBe(0);
    });

    it('should have high confidence for requests with multiple Qlik keywords', () => {
      const result = guard.classifyIntent('create a star schema model with dimension tables');
      expect(result.confidence).toBeGreaterThanOrEqual(0.6);
      expect(result.keywords_found.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('validateRequest', () => {
    it('should allow Qlik-related requests', () => {
      const result = guard.validateRequest('build a star schema model');
      expect(result.allowed).toBe(true);
    });

    it('should allow requests that explicitly mention Qlik', () => {
      const result = guard.validateRequest('help me with Qlik');
      expect(result.allowed).toBe(true);
      expect(result.intent).toBe('qlik_explicit');
    });

    it('should block email-related requests', () => {
      const result = guard.validateRequest('write an email to my boss');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('blocked_pattern');
    });

    it('should block translation requests', () => {
      const result = guard.validateRequest('translate this text to Spanish');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('blocked_pattern');
    });

    it('should block weather requests', () => {
      const result = guard.validateRequest('what is the weather in London');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('blocked_pattern');
    });

    it('should block code requests for other languages', () => {
      const result = guard.validateRequest('write python code for sorting');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('blocked_pattern');
    });

    it('should block joke requests', () => {
      const result = guard.validateRequest('tell me a joke');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('blocked_pattern');
    });

    it('should provide rejection message when blocked', () => {
      const result = guard.validateRequest('write an email');
      expect(result.rejection_message).toBeDefined();
      expect(result.rejection_message).toContain('Qlik');
    });

    it('should allow requests with Qlik keywords even if intent is unknown', () => {
      const result = guard.validateRequest('something about dimension tables and fact tables');
      expect(result.allowed).toBe(true);
    });
  });

  describe('checkRateLimit', () => {
    it('should allow requests under limit', () => {
      const result = guard.checkRateLimit('user1');
      expect(result.allowed).toBe(true);
      expect(result.requests_remaining).toBe(10);
    });

    it('should block requests over limit', () => {
      // Record 10 requests
      for (let i = 0; i < 10; i++) {
        guard.recordRequest('user2');
      }

      const result = guard.checkRateLimit('user2');
      expect(result.allowed).toBe(false);
      expect(result.requests_remaining).toBe(0);
    });

    it('should track remaining requests', () => {
      guard.recordRequest('user3');
      guard.recordRequest('user3');
      guard.recordRequest('user3');

      const result = guard.checkRateLimit('user3');
      expect(result.allowed).toBe(true);
      expect(result.requests_remaining).toBe(7);
    });

    it('should include reset_at timestamp', () => {
      const result = guard.checkRateLimit('user4');
      expect(result.reset_at).toBeDefined();
      expect(new Date(result.reset_at!).getTime()).toBeGreaterThanOrEqual(Date.now());
    });
  });

  describe('recordRequest', () => {
    it('should block user after 3 consecutive failures', () => {
      guard.recordRequest('user5', false);
      guard.recordRequest('user5', false);
      guard.recordRequest('user5', false);

      const result = guard.checkRateLimit('user5');
      expect(result.allowed).toBe(false);
      expect(result.blocked_until).toBeDefined();
    });

    it('should not block user with mixed success/failure', () => {
      guard.recordRequest('user6', false);
      guard.recordRequest('user6', true);
      guard.recordRequest('user6', false);

      const result = guard.checkRateLimit('user6');
      expect(result.allowed).toBe(true);
    });

    it('should track successful requests', () => {
      guard.recordRequest('user7', true);
      guard.recordRequest('user7', true);

      const result = guard.checkRateLimit('user7');
      expect(result.requests_remaining).toBe(8);
    });
  });

  describe('context validation', () => {
    it('should validate intent for current stage', () => {
      const context: RequestContext = {
        current_stage: 'A',
      };

      const result = guard.validateRequest('build a model', context);
      expect(result.allowed).toBe(true);
    });

    it('should allow approve during any stage', () => {
      const stages = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

      for (const stage of stages) {
        const context: RequestContext = { current_stage: stage };
        const result = guard.validateRequest('approve this stage', context);
        expect(result.allowed).toBe(true);
      }
    });

    it('should allow go_back when not at stage A', () => {
      const context: RequestContext = { current_stage: 'B' };
      const result = guard.validateRequest('go back', context);
      expect(result.allowed).toBe(true);
    });

    it('should block invalid action for stage', () => {
      const context: RequestContext = { current_stage: 'A' };
      // go_back is not valid for stage A
      const result = guard.validateRequest('go back to previous', context);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('invalid_for_stage');
    });

    it('should include valid actions in rejection message', () => {
      const context: RequestContext = { current_stage: 'A' };
      const result = guard.validateRequest('go back', context);

      if (!result.allowed) {
        expect(result.rejection_message).toContain('Stage A');
      }
    });
  });

  describe('configuration', () => {
    it('should allow updating allowed intents', () => {
      guard.updateAllowedIntents(['custom_intent']);

      const classification = guard.classifyIntent('custom request');
      expect(classification.intent).toBe('unknown');
    });

    it('should allow updating blocked patterns', () => {
      guard.updateBlockedPatterns(['custom_block']);

      const result = guard.validateRequest('custom_block request');
      expect(result.allowed).toBe(false);
    });

    it('should allow clearing rate limit data', () => {
      // Add requests and block
      for (let i = 0; i < 10; i++) {
        guard.recordRequest('user8');
      }
      expect(guard.checkRateLimit('user8').allowed).toBe(false);

      // Clear data
      guard.clearRateLimitData('user8');
      expect(guard.checkRateLimit('user8').allowed).toBe(true);
    });
  });

  describe('isUserBlocked', () => {
    it('should return false for unblocked user', () => {
      expect(guard.isUserBlocked('user9')).toBe(false);
    });

    it('should return true for blocked user', () => {
      guard.recordRequest('user10', false);
      guard.recordRequest('user10', false);
      guard.recordRequest('user10', false);

      expect(guard.isUserBlocked('user10')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty request', () => {
      const result = guard.validateRequest('');
      expect(result.allowed).toBe(false);
    });

    it('should handle very long request', () => {
      const longRequest = 'build model '.repeat(100);
      const result = guard.validateRequest(longRequest);
      expect(result.allowed).toBe(true);
    });

    it('should handle special characters', () => {
      const result = guard.validateRequest('build a star schema! @#$%');
      expect(result.allowed).toBe(true);
    });

    it('should be case insensitive', () => {
      const result1 = guard.validateRequest('BUILD A STAR SCHEMA');
      const result2 = guard.validateRequest('build a star schema');

      expect(result1.allowed).toBe(result2.allowed);
    });
  });

  describe('createScopeGuard factory', () => {
    it('should create ScopeGuard instance', () => {
      const sg = createScopeGuard();
      expect(sg).toBeInstanceOf(ScopeGuard);
    });
  });
});
