/**
 * Gemini API Client
 * Handles AI-powered script review and model type recommendations
 */
import { fetchWithRetry } from './base-client'
import type {
  GeminiReviewResponse,
  EnrichedModelSpec,
  ModelType,
} from '@/types/model-builder.types'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta'
const getApiKey = () => import.meta.env.VITE_GEMINI_API_KEY || ''

// Rate limit configuration
const GEMINI_RATE_LIMIT = {
  maxRequestsPerMinute: 60,
  retryDelay: 1000,
  maxRetries: 3,
}

/**
 * Sanitize script before sending to Gemini
 * Removes any potentially sensitive information
 */
function sanitizeForReview(script: string): string {
  return script
    .replace(/connectionstring=[^;]+/gi, 'connectionstring=[REDACTED]')
    .replace(/password=[^;]+/gi, 'password=[REDACTED]')
    .replace(/lib:\/\/[^\s'"]+/g, 'lib://[PATH]')
    .replace(/Bearer [^\s'"]+/gi, 'Bearer [REDACTED]')
}

/**
 * Build review prompt for Gemini
 */
function buildReviewPrompt(script: string, spec: EnrichedModelSpec): string {
  const factTables = spec.tables
    .filter((t) => t.classification === 'fact')
    .map((t) => t.name)
    .join(', ')
  const dimTables = spec.tables
    .filter((t) => t.classification === 'dimension')
    .map((t) => t.name)
    .join(', ')

  return `You are a Qlik Sense ETL expert reviewing a generated data model script.

## Specification
- Project: ${spec.projectName}
- Tables: ${spec.tables.length}
- Relationships: ${spec.relationships.length}
- Fact Tables: ${factTables || 'None'}
- Dimension Tables: ${dimTables || 'None'}

## Script to Review
\`\`\`qlik
${sanitizeForReview(script)}
\`\`\`

## Review Criteria
1. Syntax correctness (Qlik script syntax)
2. Key integrity (PK/FK/BK properly handled)
3. Star schema adherence (if applicable)
4. Performance (avoid nested loads, use QVD optimization)
5. Maintainability (comments, clear naming)
6. Completeness (all tables/fields from spec)

## Required Response Format (JSON only, no markdown)
{
  "score": <number 0-100>,
  "summary": "<brief assessment>",
  "issues": [
    {
      "severity": "critical|warning|info",
      "category": "<category>",
      "description": "<issue description>",
      "suggestion": "<fix suggestion>"
    }
  ],
  "strengths": ["<strength 1>", "<strength 2>"],
  "approved": <boolean - true if score >= 80>
}`
}

/**
 * Build model type recommendation prompt
 */
function buildRecommendationPrompt(
  tables: { name: string; classification: string; metrics: { rowCount: number } }[]
): string {
  const tableList = tables
    .map((t) => `- ${t.name}: ${t.classification} (${t.metrics.rowCount} rows)`)
    .join('\n')

  return `You are a data modeling expert. Based on the following table analysis, recommend the best model type.

## Tables Analyzed
${tableList}

## Available Model Types
1. star_schema - Best for simple fact-dimension relationships
2. snowflake - Best for complex dimension hierarchies
3. link_table - Best for many-to-many relationships
4. normalized - Best for OLTP-style queries

## Required Response Format (JSON only, no markdown)
{
  "recommendedType": "<star_schema|snowflake|link_table|normalized>",
  "confidence": <number 0-100>,
  "reasoning": "<explanation of why this model type is best>"
}`
}

/**
 * Parse Gemini response text as JSON
 */
function parseJsonResponse<T>(text: string): T {
  // Remove markdown code blocks if present
  const cleaned = text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()

  return JSON.parse(cleaned)
}

export const geminiClient = {
  /**
   * Review a Qlik script with Gemini
   */
  async reviewScript(
    script: string,
    spec: EnrichedModelSpec
  ): Promise<GeminiReviewResponse> {
    const prompt = buildReviewPrompt(script, spec)

    const response = await fetchWithRetry(
      async () => {
        const res = await fetch(
          `${GEMINI_API_URL}/models/gemini-2.5-pro:generateContent?key=${getApiKey()}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 4096,
              },
            }),
          }
        )

        if (!res.ok) {
          throw new Error(`Gemini API error: ${res.status}`)
        }

        return res.json()
      },
      {
        maxRetries: GEMINI_RATE_LIMIT.maxRetries,
        baseDelay: GEMINI_RATE_LIMIT.retryDelay,
      }
    )

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) {
      throw new Error('No response from Gemini')
    }

    const review = parseJsonResponse<GeminiReviewResponse>(text)
    return {
      ...review,
      timestamp: new Date().toISOString(),
    }
  },

  /**
   * Get model type recommendation from Gemini
   */
  async getModelTypeRecommendation(
    tables: { name: string; classification: string; metrics: { rowCount: number } }[]
  ): Promise<{ recommendedType: ModelType; confidence: number; reasoning: string }> {
    const prompt = buildRecommendationPrompt(tables)

    const response = await fetchWithRetry(
      async () => {
        const res = await fetch(
          `${GEMINI_API_URL}/models/gemini-2.5-pro:generateContent?key=${getApiKey()}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 1024,
              },
            }),
          }
        )

        if (!res.ok) {
          throw new Error(`Gemini API error: ${res.status}`)
        }

        return res.json()
      },
      {
        maxRetries: GEMINI_RATE_LIMIT.maxRetries,
        baseDelay: GEMINI_RATE_LIMIT.retryDelay,
      }
    )

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) {
      throw new Error('No response from Gemini')
    }

    return parseJsonResponse<{
      recommendedType: ModelType
      confidence: number
      reasoning: string
    }>(text)
  },

  /**
   * Check if Gemini API is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(
        `${GEMINI_API_URL}/models/gemini-2.5-pro?key=${getApiKey()}`
      )
      return res.ok
    } catch {
      return false
    }
  },
}
