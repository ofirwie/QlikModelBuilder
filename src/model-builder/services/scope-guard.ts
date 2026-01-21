/**
 * @fileoverview Scope Guard for Model Builder
 * @module model-builder/services/scope-guard
 *
 * Validates requests to ensure only Qlik-related operations are processed.
 * Implements rate limiting and intent classification.
 */

import { BuildStage } from '../types.js';
import { Logger } from './logger.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Context for request validation
 */
export interface RequestContext {
  session_id?: string;
  current_stage?: BuildStage;
  previous_intents?: string[];
}

/**
 * Result of scope validation
 */
export interface ScopeValidationResult {
  allowed: boolean;
  intent?: string;
  reason?: string;
  rejection_message?: string;
}

/**
 * Result of rate limit check
 */
export interface RateLimitResult {
  allowed: boolean;
  requests_remaining: number;
  reset_at?: string;
  blocked_until?: string;
}

/**
 * Result of intent classification
 */
export interface IntentClassification {
  intent: string;
  confidence: number;
  keywords_found: string[];
}

/**
 * Request record for rate limiting
 */
interface RequestRecord {
  timestamp: number;
  success: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Allowed intents for Qlik operations */
const ALLOWED_INTENTS = [
  'build_model',
  'modify_script',
  'add_table',
  'add_field',
  'remove_field',
  'explain_code',
  'fix_issue',
  'change_model_type',
  'configure_calendar',
  'review_script',
  'ask_qlik_question',
  'approve_stage',
  'go_back',
  'show_progress',
  'qlik_explicit',
];

/** Qlik-related keywords for intent classification */
const QLIK_KEYWORDS = new Set([
  'model', 'script', 'table', 'field', 'dimension', 'fact',
  'qlik', 'qvd', 'load', 'calendar', 'qualify', 'store',
  'star', 'snowflake', 'link', 'concatenate', 'key',
  'relationship', 'join', 'mapping', 'autonumber',
  'schema', 'data', 'measure', 'master', 'variable',
  'set', 'analysis', 'resident', 'where', 'inner',
]);

/** Blocked patterns for non-Qlik requests */
const BLOCKED_PATTERNS = [
  /write.*email/i,
  /send.*message/i,
  /translate.*to/i,
  /weather/i,
  /python\s+code/i,
  /javascript\s+code/i,
  /java\s+code/i,
  /cook.*recipe/i,
  /tell.*joke/i,
  /write.*story/i,
  /summarize.*article/i,
  /search.*web/i,
  /book.*flight/i,
  /order.*food/i,
  /play.*music/i,
];

/** Rate limit configuration */
const RATE_CONFIG = {
  REQUESTS_PER_MINUTE: 10,
  BLOCK_DURATION_MS: 5 * 60 * 1000,  // 5 minutes
  MAX_CONSECUTIVE_FAILURES: 3,
};

/** Valid actions per stage */
const STAGE_VALID_ACTIONS: Record<BuildStage, string[]> = {
  'A': ['build_model', 'ask_qlik_question', 'explain_code', 'approve_stage', 'show_progress'],
  'B': ['add_table', 'add_field', 'remove_field', 'ask_qlik_question', 'explain_code', 'approve_stage', 'go_back', 'show_progress'],
  'C': ['modify_script', 'add_field', 'remove_field', 'ask_qlik_question', 'explain_code', 'approve_stage', 'go_back', 'show_progress'],
  'D': ['fix_issue', 'review_script', 'ask_qlik_question', 'explain_code', 'approve_stage', 'go_back', 'show_progress'],
  'E': ['configure_calendar', 'modify_script', 'ask_qlik_question', 'explain_code', 'approve_stage', 'go_back', 'show_progress'],
  'F': ['review_script', 'ask_qlik_question', 'explain_code', 'approve_stage', 'go_back', 'show_progress'],
};

// ============================================================================
// Implementation
// ============================================================================

/**
 * Scope Guard Implementation
 *
 * Validates requests to ensure only Qlik-related operations are processed.
 */
export class ScopeGuard {
  private logger?: Logger;
  private requestCounts: Map<string, RequestRecord[]> = new Map();
  private blockedUsers: Map<string, string> = new Map();  // userId -> blockedUntil ISO string
  private allowedIntents: Set<string> = new Set(ALLOWED_INTENTS);
  private blockedPatterns: RegExp[] = [...BLOCKED_PATTERNS];

  /**
   * Create a new ScopeGuard
   * @param logger - Optional logger instance
   */
  constructor(logger?: Logger) {
    this.logger = logger;
  }

  /**
   * Validate a request
   * @param request - User's natural language request
   * @param context - Optional request context
   * @returns Validation result
   */
  validateRequest(request: string, context?: RequestContext): ScopeValidationResult {
    // Quick check: explicit Qlik mention always allowed
    if (request.toLowerCase().includes('qlik')) {
      return { allowed: true, intent: 'qlik_explicit' };
    }

    // Check for blocked patterns
    for (const pattern of this.blockedPatterns) {
      if (pattern.test(request)) {
        this.logger?.warn('scope_guard', 'blocked_pattern', {
          pattern: pattern.toString(),
          request: request.substring(0, 100),
        });
        return {
          allowed: false,
          reason: 'blocked_pattern',
          rejection_message: this.getRejectionMessage(),
        };
      }
    }

    // Classify intent
    const classification = this.classifyIntent(request);

    // Check if intent is in allowed list
    if (this.allowedIntents.has(classification.intent)) {
      // Context-aware validation if context provided
      if (context?.current_stage) {
        const stageValid = this.validateForStage(classification.intent, context.current_stage);
        if (!stageValid) {
          const validActions = STAGE_VALID_ACTIONS[context.current_stage];
          return {
            allowed: false,
            intent: classification.intent,
            reason: 'invalid_for_stage',
            rejection_message: `This action is not available during Stage ${context.current_stage}. ` +
              `Valid actions: ${validActions.join(', ')}`,
          };
        }
      }
      return { allowed: true, intent: classification.intent };
    }

    // Unknown intent - check confidence
    if (classification.confidence < 0.3) {
      this.logger?.warn('scope_guard', 'low_confidence', {
        intent: classification.intent,
        confidence: classification.confidence,
        keywords: classification.keywords_found,
      });
      return {
        allowed: false,
        intent: classification.intent,
        reason: 'low_confidence',
        rejection_message: this.getRejectionMessage(),
      };
    }

    // Borderline case - allow with warning
    if (classification.confidence >= 0.3 && classification.keywords_found.length > 0) {
      this.logger?.info('scope_guard', 'borderline_allowed', {
        intent: classification.intent,
        confidence: classification.confidence,
        keywords: classification.keywords_found,
      });
      return { allowed: true, intent: 'ask_qlik_question' };
    }

    // Default: reject
    return {
      allowed: false,
      intent: classification.intent,
      reason: 'unknown_intent',
      rejection_message: this.getRejectionMessage(),
    };
  }

  /**
   * Classify the intent of a request
   * @param request - User's request
   * @returns Intent classification
   */
  classifyIntent(request: string): IntentClassification {
    const requestLower = request.toLowerCase();

    // Find Qlik keywords
    const keywordsFound: string[] = [];
    for (const keyword of QLIK_KEYWORDS) {
      if (requestLower.includes(keyword)) {
        keywordsFound.push(keyword);
      }
    }

    // Calculate confidence based on keywords
    const confidence = Math.min(keywordsFound.length / 3, 1);

    // Determine intent based on patterns
    let intent = 'unknown';

    if (/build|create|generate/i.test(request) && keywordsFound.length > 0) {
      intent = 'build_model';
    } else if (/add.*field|new.*field/i.test(request)) {
      intent = 'add_field';
    } else if (/remove.*field|delete.*field/i.test(request)) {
      intent = 'remove_field';
    } else if (/add.*table|new.*table/i.test(request)) {
      intent = 'add_table';
    } else if (/modify|change|update.*script/i.test(request)) {
      intent = 'modify_script';
    } else if (/explain|what.*is|how.*does/i.test(request) && keywordsFound.length > 0) {
      intent = 'explain_code';
    } else if (/fix|correct|repair/i.test(request)) {
      intent = 'fix_issue';
    } else if (/review|check|validate/i.test(request)) {
      intent = 'review_script';
    } else if (/approve|accept|confirm/i.test(request)) {
      intent = 'approve_stage';
    } else if (/back|previous|undo/i.test(request)) {
      intent = 'go_back';
    } else if (/progress|status|where/i.test(request)) {
      intent = 'show_progress';
    } else if (/calendar|date.*dimension/i.test(request)) {
      intent = 'configure_calendar';
    } else if (/star|snowflake|model.*type/i.test(request)) {
      intent = 'change_model_type';
    } else if (keywordsFound.length >= 2) {
      // Has enough Qlik keywords, treat as general question
      intent = 'ask_qlik_question';
    }

    return { intent, confidence, keywords_found: keywordsFound };
  }

  /**
   * Check rate limit for a user
   * @param userId - User identifier
   * @returns Rate limit result
   */
  checkRateLimit(userId: string): RateLimitResult {
    // Check if user is blocked
    const blockedUntil = this.blockedUsers.get(userId);
    if (blockedUntil) {
      const now = new Date();
      const blockEnd = new Date(blockedUntil);
      if (now < blockEnd) {
        return {
          allowed: false,
          requests_remaining: 0,
          blocked_until: blockedUntil,
        };
      } else {
        this.blockedUsers.delete(userId);
      }
    }

    // Get recent requests
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    let records = this.requestCounts.get(userId) || [];

    // Filter to last minute
    records = records.filter(r => r.timestamp > oneMinuteAgo);
    this.requestCounts.set(userId, records);

    const requestsInWindow = records.length;
    const remaining = Math.max(0, RATE_CONFIG.REQUESTS_PER_MINUTE - requestsInWindow);
    const resetAt = new Date(oneMinuteAgo + 60000).toISOString();

    return {
      allowed: requestsInWindow < RATE_CONFIG.REQUESTS_PER_MINUTE,
      requests_remaining: remaining,
      reset_at: resetAt,
    };
  }

  /**
   * Record a request for rate limiting
   * @param userId - User identifier
   * @param success - Whether request was successful
   */
  recordRequest(userId: string, success: boolean = true): void {
    const records = this.requestCounts.get(userId) || [];
    records.push({ timestamp: Date.now(), success });
    this.requestCounts.set(userId, records);

    // Check consecutive failures
    if (!success) {
      const recentRecords = records.slice(-RATE_CONFIG.MAX_CONSECUTIVE_FAILURES);
      const allFailed = recentRecords.length >= RATE_CONFIG.MAX_CONSECUTIVE_FAILURES &&
                        recentRecords.every(r => !r.success);

      if (allFailed) {
        const blockedUntil = new Date(Date.now() + RATE_CONFIG.BLOCK_DURATION_MS).toISOString();
        this.blockedUsers.set(userId, blockedUntil);
        this.logger?.warn('scope_guard', 'user_blocked', { userId, blockedUntil });
      }
    }
  }

  /**
   * Update allowed intents
   * @param intents - New list of allowed intents
   */
  updateAllowedIntents(intents: string[]): void {
    this.allowedIntents = new Set(intents);
  }

  /**
   * Update blocked patterns
   * @param patterns - New list of patterns (as strings)
   */
  updateBlockedPatterns(patterns: string[]): void {
    this.blockedPatterns = patterns.map(p => new RegExp(p, 'i'));
  }

  /**
   * Clear rate limit data for a user
   * @param userId - User identifier
   */
  clearRateLimitData(userId: string): void {
    this.requestCounts.delete(userId);
    this.blockedUsers.delete(userId);
  }

  /**
   * Check if user is blocked
   * @param userId - User identifier
   * @returns True if blocked
   */
  isUserBlocked(userId: string): boolean {
    const blockedUntil = this.blockedUsers.get(userId);
    if (!blockedUntil) return false;
    return new Date() < new Date(blockedUntil);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Validate if an intent is valid for a specific stage
   */
  private validateForStage(intent: string, stage: BuildStage): boolean {
    const validActions = STAGE_VALID_ACTIONS[stage];
    // qlik_explicit and ask_qlik_question always allowed
    if (intent === 'qlik_explicit' || intent === 'ask_qlik_question') {
      return true;
    }
    return validActions.includes(intent);
  }

  /**
   * Get rejection message for out-of-scope requests
   */
  private getRejectionMessage(): string {
    return `This system is designed for Qlik model building only.

I can help you with:
- Building data models (Star, Snowflake, Link Tables)
- Writing Qlik Load Scripts
- Reviewing and fixing script issues
- Explaining Qlik concepts
- Configuring calendars and relationships

For other requests, please use a general assistant.`;
  }
}

/**
 * Factory function to create a ScopeGuard
 * @param logger - Optional logger instance
 * @returns ScopeGuard instance
 */
export function createScopeGuard(logger?: Logger): ScopeGuard {
  return new ScopeGuard(logger);
}

export default ScopeGuard;
