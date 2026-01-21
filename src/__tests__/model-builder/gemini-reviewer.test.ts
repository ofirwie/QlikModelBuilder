/**
 * @fileoverview Unit tests for Gemini Reviewer
 */

import { jest } from '@jest/globals';
import {
  GeminiReviewer,
  createGeminiReviewer,
  GeminiConfig,
  GeminiReviewError,
  GeminiAuthError,
  GeminiTimeoutError,
} from '../../model-builder/services/gemini-reviewer.js';
import { GeminiReviewRequest } from '../../model-builder/types.js';

// Mock fetch globally
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('GeminiReviewer', () => {
  let reviewer: GeminiReviewer;
  const validConfig: GeminiConfig = {
    api_key: 'AIzaValidTestKeyForTestingPurposes123456',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    reviewer = new GeminiReviewer(validConfig);
  });

  const createRequest = (): GeminiReviewRequest => ({
    script: `
QUALIFY *;

Sales:
LOAD
  SaleID,
  Amount,
  CustomerID,
  ProductID,
  SaleDate
FROM [lib://DataFiles/sales.qvd] (qvd);

STORE Sales INTO [lib://DataFiles/sales_out.qvd] (qvd);
`,
    model_type: 'star_schema',
    facts_count: 1,
    dimensions_count: 3,
    expected_rows: 100000,
  });

  const createMockResponse = (body: object, status = 200) =>
    ({
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      json: async () => body,
      text: async () => JSON.stringify(body),
    }) as unknown as Response;

  const createErrorResponse = (status: number, statusText: string, errorText: string) =>
    ({
      ok: false,
      status,
      statusText,
      text: async () => errorText,
    }) as unknown as Response;

  describe('constructor', () => {
    it('should create with valid config', () => {
      const r = new GeminiReviewer(validConfig);
      expect(r).toBeInstanceOf(GeminiReviewer);
    });

    it('should use default values for optional config', () => {
      const r = new GeminiReviewer({ api_key: 'AIzaTestKey12345678901234567890123' });
      expect(r).toBeInstanceOf(GeminiReviewer);
    });

    it('should allow custom model', () => {
      const r = new GeminiReviewer({
        ...validConfig,
        model: 'gemini-1.5-flash',
      });
      expect(r).toBeInstanceOf(GeminiReviewer);
    });
  });

  describe('checkConnection', () => {
    it('should return connected true when API responds with OK', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          candidates: [{ content: { parts: [{ text: 'OK' }] } }],
        })
      );

      const result = await reviewer.checkConnection();

      expect(result.connected).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return connected false when API responds unexpectedly', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          candidates: [{ content: { parts: [{ text: 'Something else' }] } }],
        })
      );

      const result = await reviewer.checkConnection();

      expect(result.connected).toBe(false);
      expect(result.error).toContain('unexpected content');
    });

    it('should return error for invalid API key format', async () => {
      const invalidReviewer = new GeminiReviewer({ api_key: 'invalid' });

      const result = await invalidReviewer.checkConnection();

      expect(result.connected).toBe(false);
      expect(result.error).toContain('Invalid API key format');
    });

    it('should return error for empty API key', async () => {
      const emptyReviewer = new GeminiReviewer({ api_key: '' });

      const result = await emptyReviewer.checkConnection();

      expect(result.connected).toBe(false);
      expect(result.error).toContain('not configured');
    });

    it('should return error when API call fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await reviewer.checkConnection();

      expect(result.connected).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });

  describe('reviewScript', () => {
    it('should return approved response for clean script', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      review_status: 'approved',
                      score: 100,
                      issues: [],
                      summary: 'Script follows all best practices',
                    }),
                  },
                ],
              },
            },
          ],
        })
      );

      const result = await reviewer.reviewScript(createRequest());

      expect(result.review_status).toBe('approved');
      expect(result.score).toBe(100);
      expect(result.issues).toHaveLength(0);
    });

    it('should return issues when problems found', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      review_status: 'issues_found',
                      score: 70,
                      issues: [
                        {
                          issue_id: 'AP-001',
                          severity: 'warning',
                          category: 'anti-pattern',
                          title: 'LOAD * detected',
                          location: { table: 'Sales', line: 5 },
                          description: 'Using LOAD * loads all fields',
                          recommendation: 'Specify fields explicitly',
                          fix_example: 'LOAD Field1, Field2 FROM...',
                        },
                      ],
                      summary: 'One anti-pattern found',
                    }),
                  },
                ],
              },
            },
          ],
        })
      );

      const result = await reviewer.reviewScript(createRequest());

      expect(result.review_status).toBe('issues_found');
      expect(result.score).toBe(70);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].severity).toBe('warning');
      expect(result.issues[0].category).toBe('anti-pattern');
    });

    it('should throw GeminiAuthError for invalid API key', async () => {
      const invalidReviewer = new GeminiReviewer({ api_key: 'bad' });

      await expect(invalidReviewer.reviewScript(createRequest())).rejects.toThrow(
        GeminiAuthError
      );
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValueOnce(
        createErrorResponse(500, 'Internal Server Error', 'Server error')
      );

      await expect(reviewer.reviewScript(createRequest())).rejects.toThrow('API error');
    });
  });

  describe('reviewWithRetry', () => {
    it('should succeed on first attempt', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      review_status: 'approved',
                      score: 100,
                      issues: [],
                      summary: 'OK',
                    }),
                  },
                ],
              },
            },
          ],
        })
      );

      const result = await reviewer.reviewWithRetry(createRequest());

      expect(result.review_status).toBe('approved');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on transient failure', async () => {
      // First call fails
      mockFetch.mockResolvedValueOnce(
        createErrorResponse(500, 'Internal Server Error', 'Server error')
      );

      // Second call succeeds
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      review_status: 'approved',
                      score: 100,
                      issues: [],
                      summary: 'OK',
                    }),
                  },
                ],
              },
            },
          ],
        })
      );

      const result = await reviewer.reviewWithRetry(createRequest(), 2);

      expect(result.review_status).toBe('approved');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries', async () => {
      // All calls fail
      mockFetch.mockResolvedValue(
        createErrorResponse(500, 'Internal Server Error', 'Server error')
      );

      await expect(reviewer.reviewWithRetry(createRequest(), 2)).rejects.toThrow(
        GeminiReviewError
      );

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry on auth errors (401)', async () => {
      mockFetch.mockResolvedValueOnce(
        createErrorResponse(401, 'Unauthorized', 'Invalid API key')
      );

      await expect(reviewer.reviewWithRetry(createRequest(), 3)).rejects.toThrow(
        GeminiAuthError
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not retry on permission errors (403)', async () => {
      mockFetch.mockResolvedValueOnce(
        createErrorResponse(403, 'Forbidden', 'Permission denied')
      );

      await expect(reviewer.reviewWithRetry(createRequest(), 3)).rejects.toThrow(
        GeminiAuthError
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should use exponential backoff timing', async () => {
      const startTime = Date.now();

      // All calls fail with 500
      mockFetch.mockResolvedValue(
        createErrorResponse(500, 'Internal Server Error', 'Server error')
      );

      await expect(reviewer.reviewWithRetry(createRequest(), 2)).rejects.toThrow();

      const elapsedTime = Date.now() - startTime;
      // Should have waited at least 1 second (first backoff delay)
      expect(elapsedTime).toBeGreaterThanOrEqual(800); // Allow some timing variance
    });
  });

  describe('parseResponse', () => {
    it('should parse valid JSON directly', () => {
      const json = JSON.stringify({
        review_status: 'approved',
        score: 100,
        issues: [],
        summary: 'OK',
      });

      const result = reviewer.parseResponse(json);

      expect(result.review_status).toBe('approved');
      expect(result.score).toBe(100);
    });

    it('should extract JSON from markdown code block', () => {
      const markdown = `Here is the review:

\`\`\`json
{
  "review_status": "approved",
  "score": 95,
  "issues": [],
  "summary": "Good script"
}
\`\`\`

That's all.`;

      const result = reviewer.parseResponse(markdown);

      expect(result.review_status).toBe('approved');
      expect(result.score).toBe(95);
    });

    it('should extract JSON from code block without language', () => {
      const markdown = `\`\`\`
{
  "review_status": "issues_found",
  "score": 80,
  "issues": [],
  "summary": "Minor issues"
}
\`\`\``;

      const result = reviewer.parseResponse(markdown);

      expect(result.review_status).toBe('issues_found');
      expect(result.score).toBe(80);
    });

    it('should find JSON embedded in text', () => {
      const text = `Based on my analysis, here is the review:
{"review_status": "approved", "score": 100, "issues": [], "summary": "Good"}
The script looks fine.`;

      const result = reviewer.parseResponse(text);

      expect(result.review_status).toBe('approved');
      expect(result.score).toBe(100);
    });

    it('should extract approval from text when JSON parsing fails', () => {
      const text = 'The script is approved and looks good. Everything is correct.';

      const result = reviewer.parseResponse(text);

      expect(result.review_status).toBe('approved');
      expect(result.score).toBe(90);
    });

    it('should extract issues from text when JSON parsing fails', () => {
      const text = `Issue: Missing QUALIFY statement
Problem: No STORE command found
Warning: Field naming is inconsistent`;

      const result = reviewer.parseResponse(text);

      expect(result.review_status).toBe('issues_found');
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('should return fallback for completely unparseable response', () => {
      const gibberish = 'asdfghjkl qwerty 12345';

      const result = reviewer.parseResponse(gibberish);

      expect(result.review_status).toBe('issues_found');
      expect(result.score).toBe(0);
      expect(result.issues.length).toBe(1);
      expect(result.issues[0].issue_id).toBe('PARSE-001');
    });

    it('should normalize severity values', () => {
      const json = JSON.stringify({
        review_status: 'issues_found',
        score: 70,
        issues: [
          { issue_id: '1', severity: 'error', category: 'syntax', title: 'T', description: 'D' },
          { issue_id: '2', severity: 'warn', category: 'syntax', title: 'T', description: 'D' },
          { issue_id: '3', severity: 'information', category: 'syntax', title: 'T', description: 'D' },
        ],
        summary: 'Issues',
      });

      const result = reviewer.parseResponse(json);

      expect(result.issues[0].severity).toBe('critical');
      expect(result.issues[1].severity).toBe('warning');
      expect(result.issues[2].severity).toBe('info');
    });

    it('should normalize category values', () => {
      const json = JSON.stringify({
        review_status: 'issues_found',
        score: 70,
        issues: [
          { issue_id: '1', severity: 'warning', category: 'syntax-error', title: 'T', description: 'D' },
          { issue_id: '2', severity: 'warning', category: 'antipattern', title: 'T', description: 'D' },
          { issue_id: '3', severity: 'warning', category: 'best practice', title: 'T', description: 'D' },
          { issue_id: '4', severity: 'warning', category: 'model size issue', title: 'T', description: 'D' },
        ],
        summary: 'Issues',
      });

      const result = reviewer.parseResponse(json);

      expect(result.issues[0].category).toBe('syntax');
      expect(result.issues[1].category).toBe('anti-pattern');
      expect(result.issues[2].category).toBe('best-practice');
      expect(result.issues[3].category).toBe('model-size');
    });

    it('should handle missing issue fields gracefully', () => {
      const json = JSON.stringify({
        review_status: 'issues_found',
        score: 70,
        issues: [
          { issue_id: 'ID1' }, // Missing most fields
          { severity: 'critical' }, // Missing issue_id and others
        ],
        summary: 'Incomplete issues',
      });

      const result = reviewer.parseResponse(json);

      expect(result.issues).toHaveLength(2);
      expect(result.issues[0].issue_id).toBe('ID1');
      expect(result.issues[0].severity).toBe('warning'); // Default
      expect(result.issues[1].severity).toBe('critical');
      expect(result.issues[1].title).toBe('Untitled Issue');
    });

    it('should handle location field correctly', () => {
      const json = JSON.stringify({
        review_status: 'issues_found',
        score: 70,
        issues: [
          {
            issue_id: 'LOC-001',
            severity: 'warning',
            category: 'syntax',
            title: 'Test',
            description: 'Test desc',
            location: {
              line: 10,
              column: 5,
              table: 'Sales',
              field: 'Amount',
              snippet: 'LOAD *',
            },
          },
        ],
        summary: 'Location test',
      });

      const result = reviewer.parseResponse(json);

      expect(result.issues[0].location.line).toBe(10);
      expect(result.issues[0].location.column).toBe(5);
      expect(result.issues[0].location.table).toBe('Sales');
      expect(result.issues[0].location.field).toBe('Amount');
      expect(result.issues[0].location.snippet).toBe('LOAD *');
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens based on character count', () => {
      const script = 'x'.repeat(400); // 400 chars = ~100 tokens

      const tokens = reviewer.estimateTokens(script);

      expect(tokens).toBe(100);
    });

    it('should round up token estimate', () => {
      const script = 'x'.repeat(401); // 401 chars = 101 tokens

      const tokens = reviewer.estimateTokens(script);

      expect(tokens).toBe(101);
    });
  });

  describe('shouldChunkScript', () => {
    it('should return false for small scripts', () => {
      const script = 'x'.repeat(1000);

      expect(reviewer.shouldChunkScript(script)).toBe(false);
    });

    it('should return true for large scripts', () => {
      const script = 'x'.repeat(150000);

      expect(reviewer.shouldChunkScript(script)).toBe(true);
    });

    it('should return false at exactly max size', () => {
      const script = 'x'.repeat(100000);

      expect(reviewer.shouldChunkScript(script)).toBe(false);
    });

    it('should return true just over max size', () => {
      const script = 'x'.repeat(100001);

      expect(reviewer.shouldChunkScript(script)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty script', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      review_status: 'issues_found',
                      score: 0,
                      issues: [
                        {
                          issue_id: 'EMPTY-001',
                          severity: 'critical',
                          category: 'syntax',
                          title: 'Empty script',
                          description: 'Script is empty',
                          recommendation: 'Add content',
                        },
                      ],
                      summary: 'Empty script',
                    }),
                  },
                ],
              },
            },
          ],
        })
      );

      const request = createRequest();
      request.script = '';

      const result = await reviewer.reviewScript(request);

      expect(result.review_status).toBe('issues_found');
    });

    it('should handle response with no candidates', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          candidates: [],
        })
      );

      await expect(reviewer.reviewScript(createRequest())).rejects.toThrow(
        'No text in API response'
      );
    });

    it('should handle malformed API response', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          unexpected: 'structure',
        })
      );

      await expect(reviewer.reviewScript(createRequest())).rejects.toThrow(
        'No text in API response'
      );
    });

    it('should handle very large issue counts', () => {
      const issues = Array.from({ length: 100 }, (_, i) => ({
        issue_id: `ISSUE-${i + 1}`,
        severity: 'warning',
        category: 'syntax',
        title: `Issue ${i + 1}`,
        description: 'Description',
      }));

      const json = JSON.stringify({
        review_status: 'issues_found',
        score: 0,
        issues,
        summary: 'Many issues',
      });

      const result = reviewer.parseResponse(json);

      expect(result.issues).toHaveLength(100);
    });

    it('should handle unicode in script', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      review_status: 'approved',
                      score: 100,
                      issues: [],
                      summary: 'OK',
                    }),
                  },
                ],
              },
            },
          ],
        })
      );

      const request = createRequest();
      request.script = '// קוד בעברית\nSales:\nLOAD * FROM data.qvd;';

      const result = await reviewer.reviewScript(request);

      expect(result.review_status).toBe('approved');
    });
  });

  describe('createGeminiReviewer factory', () => {
    it('should create GeminiReviewer instance', () => {
      const r = createGeminiReviewer(validConfig);

      expect(r).toBeInstanceOf(GeminiReviewer);
    });

    it('should accept logger parameter', () => {
      const mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      } as unknown as import('../../model-builder/services/logger.js').Logger;

      const r = createGeminiReviewer(validConfig, mockLogger);

      expect(r).toBeInstanceOf(GeminiReviewer);
    });
  });
});
