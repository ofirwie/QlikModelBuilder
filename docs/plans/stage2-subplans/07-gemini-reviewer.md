# Sub-Plan 07: Gemini Reviewer

> **Part of:** Data Model Builder (Stage 2) Implementation
> **Dependencies:** Sub-Plan 01 (Types), Sub-Plan 02 (Logger)
> **Output:** `src/model-builder/services/gemini-reviewer.ts`

---

## Goal

Integrate with Gemini API to review generated Qlik scripts, checking for syntax errors, anti-patterns, best practices, and model size concerns.

## Context

From design document (sections 4.1-4.3):
- Gemini reviews scripts for syntax, best practices, anti-patterns, model size
- Returns structured JSON with issues, severity, recommendations
- Review loop: automatic Round 1, user-controlled Rounds 2-3, HITL for Round 4+

## Files to Create

| File | Purpose |
|------|---------|
| `src/model-builder/services/gemini-reviewer.ts` | Gemini API integration |
| `src/__tests__/model-builder/gemini-reviewer.test.ts` | Unit tests |

## Key Interfaces

```typescript
interface GeminiReviewer {
  // Main review
  reviewScript(request: GeminiReviewRequest): Promise<GeminiReviewResponse>;

  // Retry logic
  reviewWithRetry(request: GeminiReviewRequest, maxRetries?: number): Promise<GeminiReviewResponse>;

  // Response parsing
  parseResponse(rawResponse: string): GeminiReviewResponse;

  // Health check
  checkConnection(): Promise<boolean>;
}

interface GeminiConfig {
  api_key: string;
  model: string;  // e.g., 'gemini-pro-1.5'
  max_tokens: number;
  temperature: number;
  timeout_ms: number;
}
```

## Implementation Steps

### Step 1: API Client Setup

```typescript
class GeminiReviewerImpl implements GeminiReviewer {
  private config: GeminiConfig;
  private logger: Logger;

  constructor(config: GeminiConfig, logger: Logger) {
    this.config = {
      model: 'gemini-pro-1.5',
      max_tokens: 4096,
      temperature: 0.2,  // Low for consistent reviews
      timeout_ms: 30000,
      ...config,
    };
    this.logger = logger;
  }

  async checkConnection(): Promise<boolean> {
    try {
      const response = await this.callApi('Return "OK" if you can process this.');
      return response.includes('OK');
    } catch (error) {
      this.logger.error('gemini_reviewer', 'connection_check_failed', { error });
      return false;
    }
  }
}
```

### Step 2: System Prompt Construction

```typescript
private buildSystemPrompt(): string {
  return `
You are a Qlik Sense expert reviewer.
Review the following Qlik Load Script and check:

1. SYNTAX: Valid Qlik syntax, no errors
2. BEST PRACTICES:
   - QUALIFY * used correctly
   - No LOAD * (selective fields only)
   - Variables defined before use
   - STORE to QVD for each table
3. ANTI-PATTERNS:
   - Synthetic Keys (shared fields between tables)
   - Circular References
   - God Tables (>50 fields)
4. MODEL SIZE:
   - High cardinality Link Tables
   - Unnecessary fields loaded

Return your review as JSON with this exact structure:
{
  "review_status": "issues_found" | "approved",
  "score": <0-100>,
  "issues": [
    {
      "issue_id": "XX-NNN",
      "severity": "critical" | "warning" | "info",
      "category": "syntax" | "anti-pattern" | "best-practice" | "model-size",
      "title": "Issue title",
      "location": { "table": "TableName", "line": N, "field": "FieldName" },
      "description": "What's wrong",
      "recommendation": "How to fix",
      "fix_example": "Code example"
    }
  ],
  "summary": "Brief summary of findings"
}

If no issues found, return:
{
  "review_status": "approved",
  "score": 100,
  "issues": [],
  "summary": "Script follows all best practices"
}
`.trim();
}
```

### Step 3: User Prompt Construction

```typescript
private buildUserPrompt(request: GeminiReviewRequest): string {
  return `
Review this Qlik script:

\`\`\`qlik
${request.script}
\`\`\`

Model info:
- Type: ${request.model_type}
- Facts: ${request.facts_count}
- Dimensions: ${request.dimensions_count}
- Expected rows: ~${request.expected_rows.toLocaleString()}

Return ONLY the JSON review, no additional text.
`.trim();
}
```

### Step 4: API Call with Retry

```typescript
async reviewWithRetry(
  request: GeminiReviewRequest,
  maxRetries: number = 3
): Promise<GeminiReviewResponse> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      this.logger.info('gemini_reviewer', 'review_attempt', { attempt, maxRetries });

      const response = await this.reviewScript(request);

      this.logger.info('gemini_reviewer', 'review_completed', {
        score: response.score,
        issues_count: response.issues.length,
      });

      return response;

    } catch (error) {
      lastError = error as Error;
      this.logger.warn('gemini_reviewer', 'review_failed', {
        attempt,
        error: lastError.message,
      });

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delayMs = Math.pow(2, attempt - 1) * 1000;
        await this.delay(delayMs);
      }
    }
  }

  // All retries failed
  this.logger.error('gemini_reviewer', 'all_retries_failed', {
    error: lastError?.message,
  });

  throw new GeminiReviewError(`Review failed after ${maxRetries} attempts: ${lastError?.message}`);
}

private delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### Step 5: Response Parsing

```typescript
parseResponse(rawResponse: string): GeminiReviewResponse {
  // Extract JSON from response (may have markdown wrapper)
  let jsonStr = rawResponse;

  // Handle ```json wrapper
  const jsonMatch = rawResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  try {
    const parsed = JSON.parse(jsonStr.trim());

    // Validate required fields
    if (!parsed.review_status || !('score' in parsed) || !Array.isArray(parsed.issues)) {
      throw new Error('Missing required fields in response');
    }

    // Validate each issue
    for (const issue of parsed.issues) {
      this.validateIssue(issue);
    }

    return parsed as GeminiReviewResponse;

  } catch (error) {
    this.logger.error('gemini_reviewer', 'parse_failed', { rawResponse, error });

    // Return fallback response
    return {
      review_status: 'issues_found',
      score: 0,
      issues: [{
        issue_id: 'PARSE-001',
        severity: 'warning',
        category: 'syntax',
        title: 'Review Parse Error',
        location: {},
        description: 'Could not parse Gemini response',
        recommendation: 'Manual review recommended',
        fix_example: '',
      }],
      summary: 'Review response could not be parsed. Manual review recommended.',
    };
  }
}

private validateIssue(issue: unknown): void {
  const obj = issue as Record<string, unknown>;
  const required = ['issue_id', 'severity', 'category', 'title', 'description'];

  for (const field of required) {
    if (!obj[field]) {
      throw new Error(`Issue missing required field: ${field}`);
    }
  }

  const validSeverities = ['critical', 'warning', 'info'];
  if (!validSeverities.includes(obj.severity as string)) {
    throw new Error(`Invalid severity: ${obj.severity}`);
  }
}
```

### Step 6: Full Review Method

```typescript
async reviewScript(request: GeminiReviewRequest): Promise<GeminiReviewResponse> {
  const systemPrompt = this.buildSystemPrompt();
  const userPrompt = this.buildUserPrompt(request);

  const startTime = Date.now();

  const rawResponse = await this.callApi(userPrompt, systemPrompt);

  const response = this.parseResponse(rawResponse);

  const duration = Date.now() - startTime;
  this.logger.info('gemini_reviewer', 'review_duration', { duration_ms: duration });

  return response;
}

private async callApi(userPrompt: string, systemPrompt?: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), this.config.timeout_ms);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${this.config.model}:generateContent?key=${this.config.api_key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: systemPrompt + '\n\n' + userPrompt }] },
          ],
          generationConfig: {
            maxOutputTokens: this.config.max_tokens,
            temperature: this.config.temperature,
          },
        }),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;

  } finally {
    clearTimeout(timeout);
  }
}
```

## Review Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    GEMINI REVIEWER                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   GeminiReviewRequest                                        │
│   ┌──────────────────┐                                      │
│   │ script           │                                      │
│   │ model_type       │                                      │
│   │ facts_count      │                                      │
│   │ dimensions_count │                                      │
│   │ expected_rows    │                                      │
│   └────────┬─────────┘                                      │
│            │                                                 │
│            ▼                                                 │
│   ┌──────────────────┐                                      │
│   │  Build Prompts   │                                      │
│   │  • System prompt │                                      │
│   │  • User prompt   │                                      │
│   └────────┬─────────┘                                      │
│            │                                                 │
│            ▼                                                 │
│   ┌──────────────────┐                                      │
│   │   Call Gemini    │ ←── Retry up to 3x with backoff     │
│   │   API            │                                      │
│   └────────┬─────────┘                                      │
│            │                                                 │
│            ▼                                                 │
│   ┌──────────────────┐                                      │
│   │  Parse Response  │ ←── Extract JSON, validate           │
│   │                  │                                      │
│   └────────┬─────────┘                                      │
│            │                                                 │
│            ▼                                                 │
│   GeminiReviewResponse                                       │
│   ┌──────────────────┐                                      │
│   │ review_status    │                                      │
│   │ score            │                                      │
│   │ issues[]         │                                      │
│   │ summary          │                                      │
│   └──────────────────┘                                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Potential Failure Points

1. **API unavailable** - Gemini API down or unreachable
2. **Rate limiting** - Too many requests to Gemini
3. **Malformed response** - Gemini returns invalid JSON
4. **Timeout** - Review takes too long
5. **Invalid API key** - Key expired or revoked
6. **Token limit exceeded** - Script too large for API

## Mitigation Strategies

1. Retry with exponential backoff, allow proceeding without review
2. No rate limit on Gemini (only Claude), but implement backoff
3. Robust JSON parsing with fallback response
4. Configurable timeout, warn user on slow reviews
5. Validate API key on startup, clear error message
6. Chunk large scripts or warn user about size

## Test Plan

```typescript
describe('GeminiReviewer', () => {
  describe('reviewScript', () => {
    it('should return approved for clean script');
    it('should detect LOAD * anti-pattern');
    it('should detect synthetic key risk');
    it('should return structured issues');
  });

  describe('reviewWithRetry', () => {
    it('should retry on failure');
    it('should use exponential backoff');
    it('should give up after max retries');
  });

  describe('parseResponse', () => {
    it('should parse valid JSON');
    it('should extract JSON from markdown');
    it('should handle malformed response');
    it('should validate issue structure');
  });

  describe('checkConnection', () => {
    it('should return true when API is reachable');
    it('should return false when API is down');
  });
});
```

## Error Handling Strategy

| Error Type | Possible Cause | Handling Approach | Recovery |
|------------|----------------|-------------------|----------|
| `ECONNREFUSED` | Gemini API unreachable | Retry with backoff, then fail gracefully | Proceed without review |
| `401 Unauthorized` | Invalid or expired API key | Fail fast with clear message | User updates API key |
| `403 Forbidden` | API key lacks permissions | Fail fast with permission message | User checks API key scope |
| `429 Too Many Requests` | Rate limited by Gemini | Exponential backoff, max 3 retries | Wait and retry |
| `500+ Server Error` | Gemini service issue | Retry with backoff | Wait for service recovery |
| Timeout | Request took too long | Cancel request, retry once | Reduce script size or skip review |
| Parse Error | Invalid JSON in response | Return fallback review | Manual review recommended |
| Token Limit | Script too large | Chunk or summarize script | Split into smaller reviews |
| Validation Error | Issue structure invalid | Use partial response, log error | Fix parsing logic |

### Enhanced Rate Limiting with Exponential Backoff

```typescript
/**
 * Rate limiting configuration with exponential backoff.
 * Handles 429 responses from Gemini API gracefully.
 */
interface RateLimitConfig {
  baseDelayMs: number;           // Initial delay (1000ms)
  maxDelayMs: number;            // Maximum delay cap (60000ms)
  maxRetries: number;            // Maximum retry attempts (5)
  backoffMultiplier: number;     // Multiplier per retry (2)
  jitterFactor: number;          // Random jitter 0-1 (0.1)
}

const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  baseDelayMs: 1000,
  maxDelayMs: 60000,
  maxRetries: 5,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
};

/**
 * Implements exponential backoff with jitter for rate limiting.
 * Jitter prevents thundering herd when multiple requests retry simultaneously.
 */
private calculateBackoffDelay(attempt: number, config: RateLimitConfig): number {
  // Exponential: 1s, 2s, 4s, 8s, 16s...
  const exponentialDelay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt);

  // Cap at maximum delay
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);

  // Add jitter: ±10% randomization
  const jitter = cappedDelay * config.jitterFactor * (Math.random() * 2 - 1);

  return Math.floor(cappedDelay + jitter);
}

/**
 * Enhanced retry logic with rate limit detection and exponential backoff.
 */
async reviewWithRetry(
  request: GeminiReviewRequest,
  maxRetries: number = 3
): Promise<GeminiReviewResponse> {
  let lastError: Error | null = null;
  const config = DEFAULT_RATE_LIMIT_CONFIG;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      this.logger.info('gemini_reviewer', 'review_attempt', {
        attempt: attempt + 1,
        maxRetries,
      });

      const response = await this.reviewScript(request);

      this.logger.info('gemini_reviewer', 'review_completed', {
        score: response.score,
        issues_count: response.issues.length,
        attempt: attempt + 1,
      });

      return response;

    } catch (error) {
      lastError = error as Error;
      const statusCode = this.extractStatusCode(error);

      this.logger.warn('gemini_reviewer', 'review_failed', {
        attempt: attempt + 1,
        error: lastError.message,
        statusCode,
      });

      // Don't retry authentication errors
      if (statusCode === 401 || statusCode === 403) {
        this.logger.error('gemini_reviewer', 'auth_error_no_retry', {
          statusCode,
          message: this.getAuthErrorMessage(statusCode),
        });
        throw new GeminiAuthError(this.getAuthErrorMessage(statusCode));
      }

      // Handle rate limiting (429) with extended backoff
      if (statusCode === 429) {
        const retryAfter = this.extractRetryAfterHeader(error) || this.calculateBackoffDelay(attempt, config);
        this.logger.warn('gemini_reviewer', 'rate_limited', {
          retryAfterMs: retryAfter,
          attempt: attempt + 1,
        });

        if (attempt < maxRetries - 1) {
          await this.delay(retryAfter);
          continue;
        }
      }

      // Retry other errors with standard backoff
      if (attempt < maxRetries - 1) {
        const delayMs = this.calculateBackoffDelay(attempt, config);
        this.logger.info('gemini_reviewer', 'retry_scheduled', {
          delayMs,
          nextAttempt: attempt + 2,
        });
        await this.delay(delayMs);
      }
    }
  }

  // All retries exhausted
  this.logger.error('gemini_reviewer', 'all_retries_exhausted', {
    totalAttempts: maxRetries,
    error: lastError?.message,
  });

  throw new GeminiReviewError(
    `Review failed after ${maxRetries} attempts: ${lastError?.message}`
  );
}

private extractStatusCode(error: unknown): number | null {
  if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>;
    if ('status' in err && typeof err.status === 'number') return err.status;
    if ('statusCode' in err && typeof err.statusCode === 'number') return err.statusCode;
    if ('response' in err && err.response && typeof err.response === 'object') {
      const response = err.response as Record<string, unknown>;
      if ('status' in response && typeof response.status === 'number') return response.status;
    }
  }
  return null;
}

private extractRetryAfterHeader(error: unknown): number | null {
  if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>;
    if ('headers' in err && err.headers && typeof err.headers === 'object') {
      const headers = err.headers as Record<string, string>;
      const retryAfter = headers['retry-after'];
      if (retryAfter) {
        const seconds = parseInt(retryAfter, 10);
        if (!isNaN(seconds)) return seconds * 1000;
      }
    }
  }
  return null;
}
```

### Invalid API Key Detection and Clear Error Messages

```typescript
/**
 * Custom error class for authentication failures.
 * Provides clear, actionable error messages.
 */
class GeminiAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiAuthError';
  }
}

/**
 * Returns user-friendly error messages for authentication failures.
 */
private getAuthErrorMessage(statusCode: number): string {
  const messages: Record<number, string> = {
    401: `Invalid Gemini API key. Please check:
  1. The API key is correct (starts with 'AIza...')
  2. The API key has not expired
  3. The key is set in environment variable GEMINI_API_KEY

  To get a new API key: https://aistudio.google.com/app/apikey`,

    403: `Gemini API key lacks required permissions. Please check:
  1. The API key has access to the Gemini API
  2. The 'Generative Language API' is enabled in Google Cloud Console
  3. Billing is enabled for your Google Cloud project

  To check permissions: https://console.cloud.google.com/apis/credentials`,
  };

  return messages[statusCode] || `Authentication failed with status ${statusCode}`;
}

/**
 * Validates API key format before making requests.
 * Fails fast with clear message if key is obviously invalid.
 */
private validateApiKeyFormat(apiKey: string): void {
  if (!apiKey) {
    throw new GeminiAuthError(
      'Gemini API key is not configured. Set the GEMINI_API_KEY environment variable.'
    );
  }

  if (!apiKey.startsWith('AIza')) {
    throw new GeminiAuthError(
      `Invalid API key format. Gemini API keys should start with 'AIza'. ` +
      `Current key starts with: '${apiKey.substring(0, 4)}...'`
    );
  }

  if (apiKey.length < 30) {
    throw new GeminiAuthError(
      `API key appears too short (${apiKey.length} characters). ` +
      `Valid Gemini API keys are typically 39 characters.`
    );
  }
}

/**
 * Connection check with API key validation.
 */
async checkConnection(): Promise<{ connected: boolean; error?: string }> {
  try {
    // Validate key format first
    this.validateApiKeyFormat(this.config.api_key);

    const response = await this.callApi('Return "OK" if you can process this.');

    if (response.includes('OK')) {
      return { connected: true };
    }

    return {
      connected: false,
      error: 'API responded but with unexpected content',
    };

  } catch (error) {
    const err = error as Error;

    if (err instanceof GeminiAuthError) {
      return { connected: false, error: err.message };
    }

    this.logger.error('gemini_reviewer', 'connection_check_failed', {
      error: err.message,
    });

    return {
      connected: false,
      error: `Connection failed: ${err.message}`,
    };
  }
}
```

### Robust Response Parsing with Fallback for Unexpected Formats

```typescript
/**
 * Enhanced response parsing with multiple fallback strategies.
 * Handles various unexpected response formats gracefully.
 */
parseResponse(rawResponse: string): GeminiReviewResponse {
  // Strategy 1: Direct JSON parse
  const directParse = this.tryDirectJsonParse(rawResponse);
  if (directParse) return directParse;

  // Strategy 2: Extract JSON from markdown code blocks
  const markdownExtract = this.tryMarkdownExtract(rawResponse);
  if (markdownExtract) return markdownExtract;

  // Strategy 3: Find JSON object anywhere in response
  const jsonSearch = this.tryJsonSearch(rawResponse);
  if (jsonSearch) return jsonSearch;

  // Strategy 4: Extract partial information from text response
  const textExtract = this.tryTextExtraction(rawResponse);
  if (textExtract) return textExtract;

  // Strategy 5: Return fallback response with raw content preserved
  this.logger.warn('gemini_reviewer', 'parse_failed_all_strategies', {
    responseLength: rawResponse.length,
    responsePreview: rawResponse.substring(0, 200),
  });

  return this.createFallbackResponse(
    'PARSE-001',
    'Could not parse Gemini response in any expected format',
    rawResponse
  );
}

private tryDirectJsonParse(rawResponse: string): GeminiReviewResponse | null {
  try {
    const trimmed = rawResponse.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const parsed = JSON.parse(trimmed);
      if (this.isValidReviewResponse(parsed)) {
        return this.normalizeResponse(parsed);
      }
    }
  } catch {
    // Continue to next strategy
  }
  return null;
}

private tryMarkdownExtract(rawResponse: string): GeminiReviewResponse | null {
  // Handle ```json, ```, or ``` variations
  const patterns = [
    /```json\s*([\s\S]*?)```/,
    /```\s*([\s\S]*?)```/,
    /`([\s\S]*?)`/,
  ];

  for (const pattern of patterns) {
    const match = rawResponse.match(pattern);
    if (match && match[1]) {
      try {
        const parsed = JSON.parse(match[1].trim());
        if (this.isValidReviewResponse(parsed)) {
          return this.normalizeResponse(parsed);
        }
      } catch {
        continue;
      }
    }
  }
  return null;
}

private tryJsonSearch(rawResponse: string): GeminiReviewResponse | null {
  // Find JSON object pattern anywhere in response
  const jsonPattern = /\{[\s\S]*?"review_status"[\s\S]*?\}/;
  const match = rawResponse.match(jsonPattern);

  if (match) {
    try {
      // Find matching closing brace
      const jsonStr = this.extractBalancedJson(match[0]);
      const parsed = JSON.parse(jsonStr);
      if (this.isValidReviewResponse(parsed)) {
        return this.normalizeResponse(parsed);
      }
    } catch {
      // Continue to next strategy
    }
  }
  return null;
}

private extractBalancedJson(str: string): string {
  let depth = 0;
  let start = -1;

  for (let i = 0; i < str.length; i++) {
    if (str[i] === '{') {
      if (start === -1) start = i;
      depth++;
    } else if (str[i] === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        return str.substring(start, i + 1);
      }
    }
  }

  return str;
}

private tryTextExtraction(rawResponse: string): GeminiReviewResponse | null {
  // Extract information from natural language response
  const hasApproval = /approved|no issues|looks good|correct/i.test(rawResponse);
  const hasIssues = /issue|error|warning|problem|incorrect/i.test(rawResponse);

  if (hasApproval && !hasIssues) {
    return {
      review_status: 'approved',
      score: 90,
      issues: [],
      summary: 'Script appears correct based on text analysis (JSON parsing failed)',
    };
  }

  // Try to extract mentioned issues
  const issueMatches = rawResponse.match(/(?:issue|error|problem|warning):\s*([^\n.]+)/gi);
  if (issueMatches && issueMatches.length > 0) {
    return {
      review_status: 'issues_found',
      score: 50,
      issues: issueMatches.slice(0, 5).map((match, idx) => ({
        issue_id: `TEXT-${String(idx + 1).padStart(3, '0')}`,
        severity: 'warning' as const,
        category: 'syntax' as const,
        title: 'Extracted Issue',
        location: {},
        description: match.replace(/^(?:issue|error|problem|warning):\s*/i, ''),
        recommendation: 'Review manually for details',
      })),
      summary: 'Issues extracted from text response (JSON parsing failed)',
    };
  }

  return null;
}

private isValidReviewResponse(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false;

  const response = obj as Record<string, unknown>;

  return (
    typeof response.review_status === 'string' &&
    ['approved', 'issues_found'].includes(response.review_status) &&
    typeof response.score === 'number' &&
    Array.isArray(response.issues)
  );
}

private normalizeResponse(parsed: Record<string, unknown>): GeminiReviewResponse {
  return {
    review_status: parsed.review_status as 'approved' | 'issues_found',
    score: typeof parsed.score === 'number' ? parsed.score : 0,
    issues: Array.isArray(parsed.issues)
      ? parsed.issues.map(i => this.normalizeIssue(i))
      : [],
    summary: typeof parsed.summary === 'string'
      ? parsed.summary
      : 'Review completed',
  };
}

private normalizeIssue(issue: unknown): GeminiIssue {
  if (!issue || typeof issue !== 'object') {
    return this.createDefaultIssue('Invalid issue structure');
  }

  const obj = issue as Record<string, unknown>;

  return {
    issue_id: typeof obj.issue_id === 'string' ? obj.issue_id : `AUTO-${Date.now()}`,
    severity: this.normalizeSeverity(obj.severity),
    category: this.normalizeCategory(obj.category),
    title: typeof obj.title === 'string' ? obj.title : 'Untitled Issue',
    location: typeof obj.location === 'object' ? obj.location as Record<string, unknown> : {},
    description: typeof obj.description === 'string' ? obj.description : 'No description',
    recommendation: typeof obj.recommendation === 'string' ? obj.recommendation : 'Review manually',
    fix_example: typeof obj.fix_example === 'string' ? obj.fix_example : undefined,
  };
}

private normalizeSeverity(value: unknown): 'critical' | 'warning' | 'info' {
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower === 'critical' || lower === 'error') return 'critical';
    if (lower === 'warning' || lower === 'warn') return 'warning';
    if (lower === 'info' || lower === 'information') return 'info';
  }
  return 'warning';
}

private normalizeCategory(value: unknown): 'syntax' | 'anti-pattern' | 'best-practice' | 'model-size' {
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower.includes('syntax')) return 'syntax';
    if (lower.includes('anti') || lower.includes('pattern')) return 'anti-pattern';
    if (lower.includes('best') || lower.includes('practice')) return 'best-practice';
    if (lower.includes('size') || lower.includes('model')) return 'model-size';
  }
  return 'syntax';
}

private createDefaultIssue(description: string): GeminiIssue {
  return {
    issue_id: `DEFAULT-${Date.now()}`,
    severity: 'warning',
    category: 'syntax',
    title: 'Parsing Issue',
    location: {},
    description,
    recommendation: 'Manual review recommended',
  };
}

private createFallbackResponse(
  issueId: string,
  description: string,
  rawResponse?: string
): GeminiReviewResponse {
  return {
    review_status: 'issues_found',
    score: 0,
    issues: [{
      issue_id: issueId,
      severity: 'warning',
      category: 'syntax',
      title: 'Review Parse Error',
      location: {},
      description,
      recommendation: 'Manual review recommended. Raw response preserved in logs.',
      fix_example: rawResponse ? `Raw response preview: ${rawResponse.substring(0, 500)}` : '',
    }],
    summary: 'Automated review response could not be parsed. Manual review recommended.',
  };
}
```

### Handle Missing Data in Responses Gracefully

```typescript
/**
 * Validates and provides defaults for potentially missing response fields.
 * Ensures handlers always receive complete response objects.
 */
private ensureCompleteResponse(partial: Partial<GeminiReviewResponse>): GeminiReviewResponse {
  const defaults: GeminiReviewResponse = {
    review_status: 'issues_found',
    score: 0,
    issues: [],
    summary: 'Review completed with incomplete data',
  };

  // Merge with defaults, preserving valid partial data
  const response: GeminiReviewResponse = {
    review_status: partial.review_status ?? defaults.review_status,
    score: typeof partial.score === 'number' && !isNaN(partial.score)
      ? Math.max(0, Math.min(100, partial.score))  // Clamp to 0-100
      : defaults.score,
    issues: this.ensureValidIssuesArray(partial.issues),
    summary: typeof partial.summary === 'string' && partial.summary.trim()
      ? partial.summary
      : defaults.summary,
  };

  // Auto-detect status from issues if not provided
  if (!partial.review_status) {
    response.review_status = response.issues.length === 0 ? 'approved' : 'issues_found';
  }

  // Auto-calculate score if missing/invalid
  if (typeof partial.score !== 'number' || isNaN(partial.score)) {
    response.score = this.calculateScoreFromIssues(response.issues);
  }

  return response;
}

private ensureValidIssuesArray(issues: unknown): GeminiIssue[] {
  if (!Array.isArray(issues)) {
    return [];
  }

  return issues
    .filter(issue => issue !== null && issue !== undefined)
    .map((issue, index) => {
      if (typeof issue !== 'object') {
        return {
          issue_id: `UNKNOWN-${index + 1}`,
          severity: 'warning' as const,
          category: 'syntax' as const,
          title: 'Unknown Issue',
          location: {},
          description: String(issue),
          recommendation: 'Review manually',
        };
      }

      const obj = issue as Record<string, unknown>;

      return {
        issue_id: String(obj.issue_id || `ISSUE-${index + 1}`),
        severity: this.normalizeSeverity(obj.severity),
        category: this.normalizeCategory(obj.category),
        title: String(obj.title || 'Untitled Issue'),
        location: typeof obj.location === 'object' && obj.location !== null
          ? obj.location as Record<string, unknown>
          : {},
        description: String(obj.description || 'No description provided'),
        recommendation: String(obj.recommendation || 'Review and fix manually'),
        fix_example: obj.fix_example ? String(obj.fix_example) : undefined,
      };
    });
}

private calculateScoreFromIssues(issues: GeminiIssue[]): number {
  if (issues.length === 0) return 100;

  // Deduct points based on severity
  const deductions = {
    critical: 25,
    warning: 10,
    info: 5,
  };

  let score = 100;
  for (const issue of issues) {
    score -= deductions[issue.severity] || 10;
  }

  return Math.max(0, score);
}
```

**Fallback Review Response:**
```typescript
const FALLBACK_RESPONSE: GeminiReviewResponse = {
  review_status: 'issues_found',
  score: 0,
  issues: [{
    issue_id: 'SYS-001',
    severity: 'warning',
    category: 'system',
    title: 'Review Unavailable',
    description: 'Automated review could not be completed',
    recommendation: 'Manual review recommended',
  }],
  summary: 'Automated review unavailable. Please review script manually.',
};
```

## Performance Considerations

| Operation | Time Complexity | Space Complexity | Notes |
|-----------|-----------------|------------------|-------|
| `reviewScript()` | O(n) network | O(n) response | n = script tokens |
| `parseResponse()` | O(n) | O(n) | n = response size |
| `validateIssue()` | O(1) | O(1) | Fixed number of fields |
| `buildSystemPrompt()` | O(1) | O(1) | Static template |
| `buildUserPrompt()` | O(n) | O(n) | n = script size |
| `checkConnection()` | O(1) network | O(1) | Simple ping |

**Latency Expectations:**
- Average review: 5-15 seconds
- Large script (>500 lines): 15-30 seconds
- Timeout: 30 seconds default

**Memory Usage:**
- Request payload: ~2x script size (with prompts)
- Response: Typically 2-10KB
- Peak: Script size + response size

**Optimization Tips:**
1. Use streaming response if available
2. Cache system prompt (static content)
3. Truncate sample values in script comments
4. Batch small scripts into single review
5. Use lower temperature (0.2) for consistent output

**Token Limits:**
```typescript
const TOKEN_LIMITS = {
  MAX_INPUT_TOKENS: 30000,      // Gemini 1.5 Pro limit
  MAX_OUTPUT_TOKENS: 4096,      // Response limit
  AVG_CHARS_PER_TOKEN: 4,       // Approximate
  MAX_SCRIPT_CHARS: 100000,     // ~25K tokens
};

function shouldChunkScript(script: string): boolean {
  return script.length > TOKEN_LIMITS.MAX_SCRIPT_CHARS;
}
```

## Integration Points

| Component | Direction | Data Exchange | Contract |
|-----------|-----------|---------------|----------|
| Logger | GR → Logger | API calls, errors, timing | `logger.info('gemini_reviewer', ...)` |
| Orchestrator | GR ← Orch | Review requests | `reviewWithRetry(request)` |
| Session Manager | GR → SM | Store review results | Via orchestrator |
| Gemini API | GR ↔ API | HTTP requests/responses | REST API |

**Input Contract (GeminiReviewRequest):**
```typescript
{
  script: string;                // Full Qlik script to review
  model_type: ModelType;         // star_schema, snowflake, etc.
  facts_count: number;
  dimensions_count: number;
  expected_rows: number;         // Estimated total rows
}
```

**Output Contract (GeminiReviewResponse):**
```typescript
{
  review_status: 'approved' | 'issues_found';
  score: number;                 // 0-100
  issues: GeminiIssue[];
  summary: string;
}

interface GeminiIssue {
  issue_id: string;              // Format: XX-NNN
  severity: 'critical' | 'warning' | 'info';
  category: 'syntax' | 'anti-pattern' | 'best-practice' | 'model-size';
  title: string;
  location?: { table?: string; line?: number; field?: string };
  description: string;
  recommendation: string;
  fix_example?: string;
}
```

**API Contract (Gemini):**
```
POST /v1/models/gemini-pro-1.5:generateContent
Headers: Content-Type: application/json
Query: key={api_key}
Body: { contents, generationConfig }
Response: { candidates: [{ content: { parts: [{ text }] } }] }
```

**Event Pattern:**
```
GeminiReviewer does NOT emit events.
Async operations return Promises.
Retry logic is internal, transparent to caller.
```

## Risk Mitigation & Contingency

| Risk | Impact (days) | Probability | Contingency | Trigger |
|------|--------------|-------------|-------------|---------|
| Gemini API unavailable or rate limited | 1 | Medium (40%) | Implement retry with exponential backoff; allow manual review bypass | 3 consecutive API failures or 429 response |
| Gemini response format changes unexpectedly | 2 | Low (25%) | Implement defensive parsing; fall back to raw text extraction | JSON parse error on API response |
| Review takes too long (>30 seconds) | 0.5 | Medium (35%) | Add timeout with partial result; split large scripts for parallel review | API call exceeds 30 second timeout |
| API costs exceed budget | 1 | Low (20%) | Implement token counting pre-check; warn user before expensive reviews | Estimated tokens exceed 50K per request |

## Task Breakdown & Dependencies

| Task | Duration | Dependencies | Critical Path | DoD |
|------|----------|--------------|---------------|-----|
| 7.1 Implement GeminiReviewer class skeleton | 0.5 day | Sub-Plan 01 (Types), Sub-Plan 02 (Logger) | YES | ✓ Class compiles, ✓ Implements GeminiReviewer interface, ✓ Config accepts API key |
| 7.2 Implement Gemini API client with authentication | 1 day | 7.1 | YES | ✓ API key validated on init, ✓ Correct endpoint URL, ✓ Auth header set correctly |
| 7.3 Design and implement review prompt template | 1 day | 7.1 | YES | ✓ System prompt covers all 4 review areas, ✓ JSON output format specified, ✓ Model info included |
| 7.4 Implement response parsing (JSON extraction) | 1 day | 7.2 | YES | ✓ Extracts JSON from markdown, ✓ Validates required fields, ✓ Fallback for malformed response |
| 7.5 Implement retry mechanism with backoff | 0.5 day | 7.2 | NO | ✓ Exponential backoff (1s, 2s, 4s), ✓ Max 3 retries, ✓ Non-retryable errors fail fast |
| 7.6 Implement connection health check | 0.5 day | 7.2 | NO | ✓ checkConnection() returns boolean, ✓ Validates API key format, ✓ Clear error messages |
| 7.7 Implement token counting and cost estimation | 0.5 day | 7.2 | NO | ✓ Estimates input tokens, ✓ Warns if >30K tokens, ✓ Logs token usage |
| 7.8 Write unit tests with mocked API | 1 day | 7.1-7.6 | YES | ✓ All methods tested, ✓ Retry logic tested, ✓ Parse errors handled |
| 7.9 Write integration tests with real API | 0.5 day | 7.8 | NO | ✓ Real review completes, ✓ Issues extracted correctly, ✓ Score in valid range 0-100 |

**Critical Path:** 7.1 → 7.2 → 7.3 → 7.4 → 7.8 (4.5 days)

## Resource Requirements

| Resource | Type | Availability | Skills Required |
|----------|------|--------------|-----------------|
| TypeScript Developer | Human | 1 FTE for 5 days | REST API integration, async patterns, prompt engineering |
| Gemini API key | Credential | Environment variable | N/A |
| Logger Service | Component | After Sub-Plan 02 | N/A |
| Script Builder | Component | After Sub-Plan 08 (for test data) | N/A |
| Sample Qlik scripts | Data | Generate from test fixtures | N/A |
| API mock library | Dependency | nock or msw | N/A |

## Testing Strategy

| Phase | Coverage | Tools | Acceptance Criteria | Rollback Plan |
|-------|----------|-------|---------------------|---------------|
| Unit Testing | All methods with mocked API | Jest, nock | 100% method coverage; correct retry behavior | N/A - core functionality |
| Response Parsing Testing | Various Gemini response formats | Jest with fixtures | Correct parsing of valid responses; graceful handling of malformed responses | Use raw text extraction fallback |
| Integration Testing | Real Gemini API calls | Jest (manual trigger) | Successful review of sample scripts; correct issue extraction | Skip integration tests in CI |
| Performance Testing | Large script review | Manual test | Review completes in <30 seconds for typical scripts | Split script into chunks |

## Communication Plan

- **Daily:** Report API success/failure rates; flag any parsing issues with Gemini responses
- **Weekly:** Review API costs; optimize prompts if costs exceed budget; share review quality metrics
- **Escalation:** If API unavailable for >1 hour, notify Tech Lead and enable manual review bypass
- **Change Requests:** Prompt template changes require A/B testing with sample scripts before deployment

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

- [ ] Gemini API integration working
- [ ] Retry logic with exponential backoff
- [ ] Response parsing handles edge cases
- [ ] Structured issues returned correctly
- [ ] Timeout handling implemented
- [ ] Connection health check working
- [ ] All tests passing
