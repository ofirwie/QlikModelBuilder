# Sub-Plan 06: Scope Guard

> **Part of:** Data Model Builder (Stage 2) Implementation
> **Dependencies:** Sub-Plan 01 (Types), Sub-Plan 02 (Logger)
> **Output:** `src/model-builder/services/scope-guard.ts`

---

## Goal

Filter and validate user requests to ensure only Qlik-related operations are processed, blocking non-Qlik requests and implementing rate limiting.

## Context

From design document (section 6):
- System is designed ONLY for Qlik model building
- Block non-Qlik requests (emails, translations, weather, etc.)
- Rate limit Claude calls (10/min), no limit on Gemini
- Return friendly rejection message for out-of-scope requests

## Files to Create

| File | Purpose |
|------|---------|
| `src/model-builder/services/scope-guard.ts` | Scope validation implementation |
| `src/__tests__/model-builder/scope-guard.test.ts` | Unit tests |

## Key Interfaces

```typescript
interface ScopeGuard {
  // Request validation
  validateRequest(request: string, context?: RequestContext): ScopeValidationResult;

  // Rate limiting
  checkRateLimit(userId: string): RateLimitResult;
  recordRequest(userId: string): void;

  // Intent classification
  classifyIntent(request: string): IntentClassification;

  // Configuration
  updateAllowedIntents(intents: string[]): void;
  updateBlockedPatterns(patterns: string[]): void;
}

interface ScopeValidationResult {
  allowed: boolean;
  intent?: string;
  reason?: string;
  rejection_message?: string;
}

interface RateLimitResult {
  allowed: boolean;
  requests_remaining: number;
  reset_at?: string;
  blocked_until?: string;
}

interface IntentClassification {
  intent: string;
  confidence: number;
  keywords_found: string[];
}

interface RequestContext {
  session_id?: string;
  current_stage?: BuildStage;
  previous_intents?: string[];
}
```

## Implementation Steps

### Step 1: Intent Classification

```typescript
private readonly ALLOWED_INTENTS = [
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
];

private readonly QLIK_KEYWORDS = [
  'model', 'script', 'table', 'field', 'dimension', 'fact',
  'qlik', 'qvd', 'load', 'calendar', 'qualify', 'store',
  'star', 'snowflake', 'link', 'concatenate', 'key',
  'relationship', 'join', 'mapping', 'autonumber',
];

private readonly BLOCKED_PATTERNS = [
  /write.*email/i,
  /send.*message/i,
  /translate/i,
  /weather/i,
  /python.*code/i,
  /javascript.*code/i,
  /java.*code/i,
  /cook.*recipe/i,
  /tell.*joke/i,
  /write.*story/i,
  /summarize.*article/i,
  /search.*web/i,
];

classifyIntent(request: string): IntentClassification {
  const requestLower = request.toLowerCase();
  const keywordsFound = this.QLIK_KEYWORDS.filter(kw =>
    requestLower.includes(kw.toLowerCase())
  );

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
  }

  return { intent, confidence, keywords_found: keywordsFound };
}
```

### Step 2: Request Validation

```typescript
validateRequest(request: string, context?: RequestContext): ScopeValidationResult {
  // Check for blocked patterns first
  for (const pattern of this.BLOCKED_PATTERNS) {
    if (pattern.test(request)) {
      this.logger.warn('scope_guard', 'blocked_pattern', {
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

  // Check if intent is allowed
  if (!this.ALLOWED_INTENTS.includes(classification.intent)) {
    // Low confidence and unknown intent - likely out of scope
    if (classification.confidence < 0.3) {
      this.logger.warn('scope_guard', 'low_confidence', {
        intent: classification.intent,
        confidence: classification.confidence,
      });
      return {
        allowed: false,
        intent: classification.intent,
        reason: 'low_confidence',
        rejection_message: this.getRejectionMessage(),
      };
    }
  }

  // Context-aware validation
  if (context?.current_stage) {
    const stageValid = this.validateForStage(classification.intent, context.current_stage);
    if (!stageValid) {
      return {
        allowed: false,
        intent: classification.intent,
        reason: 'invalid_for_stage',
        rejection_message: `This action is not available during Stage ${context.current_stage}`,
      };
    }
  }

  return {
    allowed: true,
    intent: classification.intent,
  };
}
```

### Step 3: Rate Limiting

```typescript
private requestCounts: Map<string, RequestRecord[]> = new Map();
private blockedUsers: Map<string, string> = new Map();  // userId -> blockedUntil

private readonly RATE_LIMIT = 10;  // requests per minute
private readonly BLOCK_DURATION_MS = 5 * 60 * 1000;  // 5 minutes
private readonly MAX_CONSECUTIVE_FAILURES = 3;

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
  const remaining = Math.max(0, this.RATE_LIMIT - requestsInWindow);

  return {
    allowed: requestsInWindow < this.RATE_LIMIT,
    requests_remaining: remaining,
    reset_at: new Date(oneMinuteAgo + 60000).toISOString(),
  };
}

recordRequest(userId: string, success: boolean = true): void {
  const records = this.requestCounts.get(userId) || [];
  records.push({ timestamp: Date.now(), success });
  this.requestCounts.set(userId, records);

  // Check consecutive failures
  if (!success) {
    const recentRecords = records.slice(-this.MAX_CONSECUTIVE_FAILURES);
    const allFailed = recentRecords.length >= this.MAX_CONSECUTIVE_FAILURES &&
                      recentRecords.every(r => !r.success);

    if (allFailed) {
      const blockedUntil = new Date(Date.now() + this.BLOCK_DURATION_MS).toISOString();
      this.blockedUsers.set(userId, blockedUntil);
      this.logger.warn('scope_guard', 'user_blocked', { userId, blockedUntil });
    }
  }
}
```

### Step 4: Rejection Message

```typescript
private getRejectionMessage(): string {
  return `
This system is designed for Qlik model building only.

I can help you with:
- Building data models (Star, Snowflake, Link Tables)
- Writing Qlik Load Scripts
- Reviewing and fixing script issues
- Explaining Qlik concepts
- Configuring calendars and relationships

For other requests, please use a general assistant.
`.trim();
}
```

## Request Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      SCOPE GUARD                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   User Request                                               │
│        │                                                     │
│        ▼                                                     │
│   ┌─────────────┐                                           │
│   │ Rate Limit  │ ──── Exceeded? ──→ BLOCK (5 min)         │
│   │   Check     │                                           │
│   └──────┬──────┘                                           │
│          │ OK                                                │
│          ▼                                                   │
│   ┌─────────────┐                                           │
│   │  Blocked    │ ──── Matches? ──→ REJECT                  │
│   │  Patterns   │                                           │
│   └──────┬──────┘                                           │
│          │ No match                                          │
│          ▼                                                   │
│   ┌─────────────┐                                           │
│   │   Intent    │                                           │
│   │ Classifier  │                                           │
│   └──────┬──────┘                                           │
│          │                                                   │
│          ▼                                                   │
│   ┌─────────────┐                                           │
│   │  Allowed    │ ──── Not in list ──→ CHECK CONFIDENCE    │
│   │  Intents?   │          │                                │
│   └──────┬──────┘          ▼                                │
│          │          Low confidence → REJECT                 │
│          │ Allowed                                           │
│          ▼                                                   │
│   ┌─────────────┐                                           │
│   │  Context    │ ──── Invalid ──→ REJECT (stage-specific) │
│   │ Validation  │                                           │
│   └──────┬──────┘                                           │
│          │ Valid                                             │
│          ▼                                                   │
│       ALLOW                                                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Potential Failure Points

1. **False positives** - Legitimate Qlik request blocked
2. **False negatives** - Non-Qlik request allowed
3. **Keyword gaming** - Adding Qlik keywords to bypass filter
4. **Rate limit evasion** - User creates multiple sessions
5. **Context loss** - Stage validation fails without context

## Mitigation Strategies

1. Keep allowed intents broad, err on side of allowing
2. Blocked patterns are strict and specific
3. Require minimum keyword count AND intent match
4. Track by user ID across sessions
5. Default to allowing if context unavailable, log warning

## Test Plan

```typescript
describe('ScopeGuard', () => {
  describe('classifyIntent', () => {
    it('should classify "build a star schema" as build_model');
    it('should classify "add field CustomerName" as add_field');
    it('should classify "explain QUALIFY" as explain_code');
    it('should return low confidence for non-Qlik requests');
  });

  describe('validateRequest', () => {
    it('should allow Qlik-related requests');
    it('should block email-related requests');
    it('should block translation requests');
    it('should block weather requests');
    it('should block code requests for other languages');
  });

  describe('checkRateLimit', () => {
    it('should allow requests under limit');
    it('should block requests over limit');
    it('should reset after one minute');
    it('should block user after 3 consecutive failures');
  });

  describe('context validation', () => {
    it('should validate intent for current stage');
    it('should allow approve during any stage');
    it('should allow go_back when not at stage A');
  });
});
```

## Error Handling Strategy

| Error Type | Possible Cause | Handling Approach | Recovery |
|------------|----------------|-------------------|----------|
| Rate Limit Exceeded | User sent too many requests | Return `allowed: false` with reset time | User waits, then retries |
| Blocked Pattern Match | Non-Qlik request detected | Return `allowed: false` with message | User rephrases request |
| Low Confidence | Ambiguous request | Return `allowed: false` or prompt user | User clarifies intent |
| Context Missing | No session context provided | Default to allowing, log warning | Validate after context available |
| Invalid Stage | Action invalid for current stage | Return `allowed: false` with valid actions | User chooses valid action |
| User Blocked | Consecutive failures | Return `allowed: false` with unblock time | User waits 5 minutes |

**False Positive Mitigation:**
```typescript
// If user explicitly mentions Qlik, always allow
if (request.toLowerCase().includes('qlik')) {
  return { allowed: true, intent: 'qlik_explicit' };
}

// Borderline cases: ask for clarification
if (confidence > 0.3 && confidence < 0.5) {
  return {
    allowed: false,
    reason: 'unclear_intent',
    rejection_message: 'האם זה קשור ל-Qlik? אם כן, אנא הבהר.'
  };
}
```

**Error Recovery Flow:**
```
1. Check rate limit
   ├── Exceeded → Return blocked result with reset time
   └── OK → Continue
2. Check blocked patterns
   ├── Match → Return rejection with friendly message
   └── No match → Continue
3. Classify intent
   ├── Known Qlik intent → Allow
   ├── Unknown + high Qlik keywords → Allow with low confidence
   └── Unknown + low/no Qlik keywords → Reject
4. Validate for current stage (if context)
   ├── Valid → Allow
   └── Invalid → Reject with valid options
```

## Performance Considerations

| Operation | Time Complexity | Space Complexity | Notes |
|-----------|-----------------|------------------|-------|
| `validateRequest()` | O(p + k) | O(1) | p=blocked patterns, k=keywords |
| `classifyIntent()` | O(k + i) | O(k) | k=keywords, i=intent patterns |
| `checkRateLimit()` | O(r) | O(r) | r=requests in window (max 10) |
| `recordRequest()` | O(1) | O(1) | Append to array |
| Pattern matching | O(n × p) | O(1) | n=request length, p=pattern count |

**Memory Usage:**
- Request counts per user: ~100 bytes per user (10 records × 10 bytes)
- Blocked users map: ~50 bytes per blocked user
- Pattern arrays: Static, ~2KB total
- Intent patterns: Static, ~1KB total

**Optimization Tips:**
1. Compile regex patterns once at class initialization
2. Use early return for obvious Qlik keywords
3. Limit request history to last 60 seconds only
4. Use `Set` for keyword lookup instead of array
5. Cache intent classification for identical requests (LRU, 100 entries)

**Rate Limit Configuration:**
```typescript
const RATE_CONFIG = {
  REQUESTS_PER_MINUTE: 10,
  BLOCK_DURATION_MS: 5 * 60 * 1000,  // 5 minutes
  MAX_CONSECUTIVE_FAILURES: 3,
  CLEANUP_INTERVAL_MS: 60 * 1000,    // Clean old records every minute
};
```

## Integration Points

| Component | Direction | Data Exchange | Contract |
|-----------|-----------|---------------|----------|
| Logger | SG → Logger | Blocked requests, rate limits | `logger.warn('scope_guard', ...)` |
| Orchestrator | SG ← Orch | Validate user requests | `validateRequest(request, context)` |
| MCP Handlers | SG ← MCP | Pre-validate tool calls | Called before handler execution |
| Session Manager | SG ← SM | Session context for stage validation | Context passed to validateRequest |

**Input Contract (validateRequest):**
```typescript
{
  request: string;              // User's natural language request
  context?: RequestContext;     // Optional session context
}

interface RequestContext {
  session_id?: string;
  current_stage?: BuildStage;   // A-F
  previous_intents?: string[];  // For context-aware classification
}
```

**Output Contract (ScopeValidationResult):**
```typescript
{
  allowed: boolean;
  intent?: string;              // Classified intent if allowed
  reason?: string;              // Why rejected (for logging)
  rejection_message?: string;   // User-friendly message (Hebrew)
}
```

**Rate Limit Contract (RateLimitResult):**
```typescript
{
  allowed: boolean;
  requests_remaining: number;   // 0-10
  reset_at?: string;            // ISO timestamp when limit resets
  blocked_until?: string;       // ISO timestamp if user is blocked
}
```

**Event Pattern:**
```
ScopeGuard does NOT emit events.
Synchronous validation, returns result immediately.
All decisions logged for audit trail.
```

## Risk Mitigation & Contingency

| Risk | Impact (days) | Probability | Contingency | Trigger |
|------|--------------|-------------|-------------|---------|
| False positives block legitimate Qlik requests | 2 | Medium (40%) | Add whitelist for known patterns; implement "ask user" mode for borderline cases | User reports blocked valid request |
| False negatives allow out-of-scope requests | 1 | Medium (35%) | Add audit logging; implement pattern learning from blocked requests | Out-of-scope request reaches Gemini |
| Rate limiting too aggressive for normal usage | 0.5 | Low (20%) | Make rate limits configurable; add burst allowance | User reports throttling during normal workflow |
| Pattern matching overhead impacts response time | 1 | Low (15%) | Pre-compile regex patterns; cache validation results | Request validation takes >50ms |

## Task Breakdown & Dependencies

| Task | Duration | Dependencies | Critical Path | DoD |
|------|----------|--------------|---------------|-----|
| 6.1 Implement ScopeGuard class skeleton | 0.5 day | Sub-Plan 01 (Types), Sub-Plan 02 (Logger) | YES | ✓ Class compiles, ✓ Implements ScopeGuard interface, ✓ Logger injected |
| 6.2 Define Qlik domain patterns and whitelist | 0.5 day | 6.1 | YES | ✓ ALLOWED_INTENTS array defined, ✓ QLIK_KEYWORDS array defined, ✓ BLOCKED_PATTERNS regex array |
| 6.3 Implement request classification | 1 day | 6.2 | YES | ✓ classifyIntent returns intent+confidence, ✓ Keywords detected, ✓ >95% accuracy on test samples |
| 6.4 Implement rate limiting | 0.5 day | 6.1 | NO | ✓ 10 req/min limit enforced, ✓ 5-min block after 3 failures, ✓ Reset timing works |
| 6.5 Implement context validation (session state) | 0.5 day | 6.1 | NO | ✓ Stage-aware validation works, ✓ Invalid actions rejected, ✓ Valid actions per stage defined |
| 6.6 Implement denial reason generation | 0.5 day | 6.3 | NO | ✓ User-friendly Hebrew messages, ✓ Includes valid alternatives, ✓ Logs denial reason |
| 6.7 Write unit tests with Qlik/non-Qlik samples | 1 day | 6.1-6.6 | YES | ✓ >95% true positive rate, ✓ >95% true negative rate, ✓ 20+ test cases |
| 6.8 Write integration tests with Orchestrator | 0.5 day | 6.7 | NO | ✓ Guard called before operations, ✓ Blocked requests logged, ✓ No false positives in workflow |

**Critical Path:** 6.1 → 6.2 → 6.3 → 6.7 (3 days)

## Resource Requirements

| Resource | Type | Availability | Skills Required |
|----------|------|--------------|-----------------|
| TypeScript Developer | Human | 1 FTE for 3 days | Regex patterns, rate limiting algorithms |
| Logger Service | Component | After Sub-Plan 02 | N/A |
| Qlik terminology reference | Data | qlik.dev documentation | N/A |
| Sample requests (valid/invalid) | Data | Create test fixtures | N/A |
| Rate limiting library (optional) | Dependency | npm package | N/A |

## Testing Strategy

| Phase | Coverage | Tools | Acceptance Criteria | Rollback Plan |
|-------|----------|-------|---------------------|---------------|
| Unit Testing | All validation methods | Jest | 100% method coverage; >95% accuracy on test cases | N/A - core functionality |
| Pattern Accuracy Testing | Qlik vs non-Qlik classification | Jest with request fixtures | >95% true positive, >95% true negative | Expand pattern list; add fuzzy matching |
| Rate Limiting Testing | Concurrent request scenarios | Jest with fake timers | Correct throttling behavior; no race conditions | Increase rate limits |
| Integration Testing | Full validation pipeline | Jest | Validation integrates correctly with Orchestrator | Bypass guard in debug mode |

## Communication Plan

- **Daily:** Report false positive/negative rates; add any new patterns discovered
- **Weekly:** Review blocked requests log; refine pattern matching rules
- **Escalation:** If false positive rate exceeds 5%, immediately notify Tech Lead and add temporary whitelist
- **Change Requests:** New patterns require test cases demonstrating both positive and negative matches

---

## Gemini Review
**Date:** 2026-01-21
**Status:** ✅ APPROVED (10/10)

| Metric | Score |
|--------|-------|
| Completeness | 10/10 |
| Correctness | 10/10 |

**Review Notes:** All criteria met including Definition of Done for each task.

---

## Success Criteria

- [ ] Qlik requests allowed with high accuracy (>95%)
- [ ] Non-Qlik requests blocked with high accuracy (>95%)
- [ ] Rate limiting works correctly
- [ ] Consecutive failure blocking works
- [ ] Context-aware validation implemented
- [ ] Friendly rejection messages shown
- [ ] All tests passing
