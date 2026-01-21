/**
 * @fileoverview Gemini Reviewer Service for Model Builder
 * @module model-builder/services/gemini-reviewer
 *
 * Integrates with Gemini API to review generated Qlik scripts,
 * checking for syntax errors, anti-patterns, best practices, and model size concerns.
 */

import {
  GeminiReviewRequest,
  GeminiReviewResponse,
  ReviewIssue,
  IssueSeverity,
  IssueCategory,
  IssueLocation,
} from '../types.js';
import { Logger } from './logger.js';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration for Gemini API client
 */
export interface GeminiConfig {
  /** Gemini API key */
  api_key: string;
  /** Model to use (default: gemini-1.5-pro) */
  model?: string;
  /** Maximum output tokens (default: 4096) */
  max_tokens?: number;
  /** Temperature for responses (default: 0.2) */
  temperature?: number;
  /** Request timeout in milliseconds (default: 30000) */
  timeout_ms?: number;
}

/**
 * Rate limiting configuration with exponential backoff
 */
interface RateLimitConfig {
  /** Initial delay in ms */
  baseDelayMs: number;
  /** Maximum delay cap in ms */
  maxDelayMs: number;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Multiplier per retry */
  backoffMultiplier: number;
  /** Random jitter factor 0-1 */
  jitterFactor: number;
}

/**
 * Connection check result
 */
export interface ConnectionCheckResult {
  /** Whether connection was successful */
  connected: boolean;
  /** Error message if connection failed */
  error?: string;
}

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Base error class for Gemini Reviewer errors
 */
export class GeminiReviewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiReviewError';
  }
}

/**
 * Error for authentication failures
 */
export class GeminiAuthError extends GeminiReviewError {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiAuthError';
  }
}

/**
 * Error for timeout failures
 */
export class GeminiTimeoutError extends GeminiReviewError {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiTimeoutError';
  }
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG = {
  model: 'gemini-1.5-pro',
  max_tokens: 4096,
  temperature: 0.2,
  timeout_ms: 30000,
};

const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  baseDelayMs: 1000,
  maxDelayMs: 60000,
  maxRetries: 5,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
};

const TOKEN_LIMITS = {
  MAX_INPUT_TOKENS: 30000,
  MAX_OUTPUT_TOKENS: 4096,
  AVG_CHARS_PER_TOKEN: 4,
  MAX_SCRIPT_CHARS: 100000,
};

// ============================================================================
// Gemini Reviewer Class
// ============================================================================

/**
 * Gemini Reviewer implementation
 */
export class GeminiReviewer {
  private config: Required<GeminiConfig>;
  private logger?: Logger;

  constructor(config: GeminiConfig, logger?: Logger) {
    this.config = {
      model: config.model ?? DEFAULT_CONFIG.model,
      max_tokens: config.max_tokens ?? DEFAULT_CONFIG.max_tokens,
      temperature: config.temperature ?? DEFAULT_CONFIG.temperature,
      timeout_ms: config.timeout_ms ?? DEFAULT_CONFIG.timeout_ms,
      api_key: config.api_key,
    };
    this.logger = logger;
  }

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  /**
   * Check connection to Gemini API
   */
  async checkConnection(): Promise<ConnectionCheckResult> {
    try {
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

      this.logger?.error('gemini_reviewer', 'connection_check_failed', {
        error: err.message,
      });

      return {
        connected: false,
        error: `Connection failed: ${err.message}`,
      };
    }
  }

  /**
   * Review a Qlik script
   */
  async reviewScript(request: GeminiReviewRequest): Promise<GeminiReviewResponse> {
    this.validateApiKeyFormat(this.config.api_key);

    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(request);

    const startTime = Date.now();

    this.logger?.info('gemini_reviewer', 'review_started', {
      script_length: request.script.length,
      model_type: request.model_type,
    });

    const rawResponse = await this.callApi(userPrompt, systemPrompt);

    const response = this.parseResponse(rawResponse);

    const duration = Date.now() - startTime;
    this.logger?.info('gemini_reviewer', 'review_completed', {
      duration_ms: duration,
      score: response.score,
      issues_count: response.issues.length,
    });

    return response;
  }

  /**
   * Review with retry logic and exponential backoff
   */
  async reviewWithRetry(
    request: GeminiReviewRequest,
    maxRetries: number = 3
  ): Promise<GeminiReviewResponse> {
    let lastError: Error | null = null;
    const config = DEFAULT_RATE_LIMIT_CONFIG;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        this.logger?.info('gemini_reviewer', 'review_attempt', {
          attempt: attempt + 1,
          maxRetries,
        });

        const response = await this.reviewScript(request);

        this.logger?.info('gemini_reviewer', 'review_success', {
          score: response.score,
          issues_count: response.issues.length,
          attempt: attempt + 1,
        });

        return response;
      } catch (error) {
        lastError = error as Error;
        const statusCode = this.extractStatusCode(error);

        this.logger?.warn('gemini_reviewer', 'review_failed', {
          attempt: attempt + 1,
          error: lastError.message,
          statusCode,
        });

        // Don't retry authentication errors
        if (statusCode === 401 || statusCode === 403) {
          this.logger?.error('gemini_reviewer', 'auth_error_no_retry', {
            statusCode,
            message: this.getAuthErrorMessage(statusCode),
          });
          throw new GeminiAuthError(this.getAuthErrorMessage(statusCode));
        }

        // Handle rate limiting (429) with extended backoff
        if (statusCode === 429) {
          const retryAfter =
            this.extractRetryAfterHeader(error) ||
            this.calculateBackoffDelay(attempt, config);
          this.logger?.warn('gemini_reviewer', 'rate_limited', {
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
          this.logger?.info('gemini_reviewer', 'retry_scheduled', {
            delayMs,
            nextAttempt: attempt + 2,
          });
          await this.delay(delayMs);
        }
      }
    }

    // All retries exhausted
    this.logger?.error('gemini_reviewer', 'all_retries_exhausted', {
      totalAttempts: maxRetries,
      error: lastError?.message,
    });

    throw new GeminiReviewError(
      `Review failed after ${maxRetries} attempts: ${lastError?.message}`
    );
  }

  /**
   * Parse a raw Gemini response into structured format
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
    this.logger?.warn('gemini_reviewer', 'parse_failed_all_strategies', {
      responseLength: rawResponse.length,
      responsePreview: rawResponse.substring(0, 200),
    });

    return this.createFallbackResponse(
      'PARSE-001',
      'Could not parse Gemini response in any expected format',
      rawResponse
    );
  }

  /**
   * Estimate token count for a script
   */
  estimateTokens(script: string): number {
    return Math.ceil(script.length / TOKEN_LIMITS.AVG_CHARS_PER_TOKEN);
  }

  /**
   * Check if script should be chunked due to size
   */
  shouldChunkScript(script: string): boolean {
    return script.length > TOKEN_LIMITS.MAX_SCRIPT_CHARS;
  }

  // ==========================================================================
  // Private Methods - API Communication
  // ==========================================================================

  private async callApi(userPrompt: string, systemPrompt?: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout_ms);

    try {
      const fullPrompt = systemPrompt
        ? `${systemPrompt}\n\n${userPrompt}`
        : userPrompt;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/${this.config.model}:generateContent?key=${this.config.api_key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
            generationConfig: {
              maxOutputTokens: this.config.max_tokens,
              temperature: this.config.temperature,
            },
          }),
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        const error = new Error(
          `API error: ${response.status} ${response.statusText}`
        ) as Error & { status: number; body: string };
        error.status = response.status;
        error.body = errorBody;
        throw error;
      }

      const data = (await response.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('No text in API response');
      }

      return text;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new GeminiTimeoutError(
          `Request timed out after ${this.config.timeout_ms}ms`
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  // ==========================================================================
  // Private Methods - Prompt Building
  // ==========================================================================

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

  // ==========================================================================
  // Private Methods - Response Parsing
  // ==========================================================================

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
    const patterns = [/```json\s*([\s\S]*?)```/, /```\s*([\s\S]*?)```/, /`([\s\S]*?)`/];

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
    const jsonPattern = /\{[\s\S]*?"review_status"[\s\S]*?\}/;
    const match = rawResponse.match(jsonPattern);

    if (match) {
      try {
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

    const issueMatches = rawResponse.match(
      /(?:issue|error|problem|warning):\s*([^\n.]+)/gi
    );
    if (issueMatches && issueMatches.length > 0) {
      return {
        review_status: 'issues_found',
        score: 50,
        issues: issueMatches.slice(0, 5).map((match, idx) => ({
          issue_id: `TEXT-${String(idx + 1).padStart(3, '0')}`,
          severity: 'warning' as IssueSeverity,
          category: 'syntax' as IssueCategory,
          title: 'Extracted Issue',
          location: {},
          description: match.replace(/^(?:issue|error|problem|warning):\s*/i, ''),
          recommendation: 'Review manually for details',
          fix_example: '',
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
      summary:
        typeof parsed.summary === 'string' ? parsed.summary : 'Review completed',
    };
  }

  private normalizeIssue(issue: unknown): ReviewIssue {
    if (!issue || typeof issue !== 'object') {
      return this.createDefaultIssue('Invalid issue structure');
    }

    const obj = issue as Record<string, unknown>;

    return {
      issue_id:
        typeof obj.issue_id === 'string' ? obj.issue_id : `AUTO-${Date.now()}`,
      severity: this.normalizeSeverity(obj.severity),
      category: this.normalizeCategory(obj.category),
      title: typeof obj.title === 'string' ? obj.title : 'Untitled Issue',
      location: this.normalizeLocation(obj.location),
      description:
        typeof obj.description === 'string' ? obj.description : 'No description',
      recommendation:
        typeof obj.recommendation === 'string'
          ? obj.recommendation
          : 'Review manually',
      fix_example: typeof obj.fix_example === 'string' ? obj.fix_example : '',
    };
  }

  private normalizeLocation(location: unknown): IssueLocation {
    if (!location || typeof location !== 'object') {
      return {};
    }

    const loc = location as Record<string, unknown>;
    const result: IssueLocation = {};

    if (typeof loc.line === 'number') result.line = loc.line;
    if (typeof loc.column === 'number') result.column = loc.column;
    if (typeof loc.table === 'string') result.table = loc.table;
    if (typeof loc.field === 'string') result.field = loc.field;
    if (typeof loc.snippet === 'string') result.snippet = loc.snippet;

    return result;
  }

  private normalizeSeverity(value: unknown): IssueSeverity {
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'critical' || lower === 'error') return 'critical';
      if (lower === 'warning' || lower === 'warn') return 'warning';
      if (lower === 'info' || lower === 'information') return 'info';
    }
    return 'warning';
  }

  private normalizeCategory(value: unknown): IssueCategory {
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower.includes('syntax')) return 'syntax';
      if (lower.includes('anti') || lower.includes('pattern')) return 'anti-pattern';
      if (lower.includes('best') || lower.includes('practice')) return 'best-practice';
      if (lower.includes('size') || lower.includes('model')) return 'model-size';
    }
    return 'syntax';
  }

  private createDefaultIssue(description: string): ReviewIssue {
    return {
      issue_id: `DEFAULT-${Date.now()}`,
      severity: 'warning',
      category: 'syntax',
      title: 'Parsing Issue',
      location: {},
      description,
      recommendation: 'Manual review recommended',
      fix_example: '',
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
      issues: [
        {
          issue_id: issueId,
          severity: 'warning',
          category: 'syntax',
          title: 'Review Parse Error',
          location: {},
          description,
          recommendation: 'Manual review recommended. Raw response preserved in logs.',
          fix_example: rawResponse
            ? `Raw response preview: ${rawResponse.substring(0, 500)}`
            : '',
        },
      ],
      summary: 'Automated review response could not be parsed. Manual review recommended.',
    };
  }

  // ==========================================================================
  // Private Methods - Validation
  // ==========================================================================

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

  // ==========================================================================
  // Private Methods - Error Handling
  // ==========================================================================

  private extractStatusCode(error: unknown): number | null {
    if (error && typeof error === 'object') {
      const err = error as Record<string, unknown>;
      if ('status' in err && typeof err.status === 'number') return err.status;
      if ('statusCode' in err && typeof err.statusCode === 'number')
        return err.statusCode;
      if ('response' in err && err.response && typeof err.response === 'object') {
        const response = err.response as Record<string, unknown>;
        if ('status' in response && typeof response.status === 'number')
          return response.status;
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

  // ==========================================================================
  // Private Methods - Utilities
  // ==========================================================================

  private calculateBackoffDelay(attempt: number, config: RateLimitConfig): number {
    const exponentialDelay =
      config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt);
    const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
    const jitter = cappedDelay * config.jitterFactor * (Math.random() * 2 - 1);
    return Math.floor(cappedDelay + jitter);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new GeminiReviewer instance
 */
export function createGeminiReviewer(
  config: GeminiConfig,
  logger?: Logger
): GeminiReviewer {
  return new GeminiReviewer(config, logger);
}

export default GeminiReviewer;
