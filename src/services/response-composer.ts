/**
 * Response Composer - Formats data responses intelligently
 *
 * Composes responses based on:
 * - Intent type (status, breakdown, comparison)
 * - Data content
 * - User's language preference
 * - Display rules (max 10 items, etc.)
 *
 * TaskGuard: services-026
 */

import { logger } from '../utils/logger.js';

const log = logger.child({ service: 'ResponseComposer' });

// ===== TYPE DEFINITIONS =====

export interface IntentInfo {
  intent: string | null;
  confidence: number;
  entities: any[];
  timePeriod: string | null;
  dimension: string | null;
}

export interface ComposerInput {
  intent: IntentInfo;
  data: Record<string, any>;
  language?: 'he' | 'en';
  sessionId?: string;
}

export interface ComposerOutput {
  answer: string;
  answerHe?: string;
  answerEn?: string;
  insights: string[];
  suggestedActions: string[];
  followUpQuestions: string[];
  hasData: boolean;
  itemCount: number;
}

// ===== CONSTANTS =====

const MAX_LIST_ITEMS = 10;

const INTENT_TEMPLATES_HE: Record<string, string> = {
  status_overview: 'מצב נוכחי: {summary}',
  urgent_attention: '{count} פריטים דורשים תשומת לב מיידית',
  overnight_activity: 'סיכום הלילה: {summary}',
  trend_comparison: 'השוואה: {summary}',
  workload_check: 'מצב עומס: {summary}',
  my_work: 'יש לך {count} פריטים פתוחים',
  my_performance: 'הביצועים שלך: {summary}',
  stuck_tickets: '{count} פריטים תקועים',
  recurring_issues: 'בעיות חוזרות: {summary}',
  why_question: 'סיבות אפשריות: {summary}',
  prediction_capacity: 'תחזית: {summary}',
  customer_experience: 'שביעות רצון: {score}'
};

const INTENT_TEMPLATES_EN: Record<string, string> = {
  status_overview: 'Current status: {summary}',
  urgent_attention: '{count} items need immediate attention',
  overnight_activity: 'Overnight summary: {summary}',
  trend_comparison: 'Comparison: {summary}',
  workload_check: 'Workload status: {summary}',
  my_work: 'You have {count} open items',
  my_performance: 'Your performance: {summary}',
  stuck_tickets: '{count} stuck items',
  recurring_issues: 'Recurring issues: {summary}',
  why_question: 'Possible causes: {summary}',
  prediction_capacity: 'Forecast: {summary}',
  customer_experience: 'Satisfaction: {score}'
};

// ===== RESPONSE COMPOSER CLASS =====

export class ResponseComposer {
  /**
   * Compose a response based on intent and data
   */
  compose(input: ComposerInput): ComposerOutput {
    const { intent, data, language = 'he' } = input;

    log.debug('Composing response', { intent: intent.intent, dataKeys: Object.keys(data) });

    // Handle empty data
    if (!data || Object.keys(data).length === 0) {
      return this.composeEmptyResponse(intent, language);
    }

    // Handle array data (breakdown/list)
    if (data.rows || data.items || Array.isArray(data)) {
      return this.composeListResponse(intent, data, language);
    }

    // Handle single value data
    if (data.value !== undefined || data.count !== undefined) {
      return this.composeSingleValueResponse(intent, data, language);
    }

    // Handle comparison data
    if (data.current !== undefined && data.previous !== undefined) {
      return this.composeComparisonResponse(intent, data, language);
    }

    // Default: format as summary
    return this.composeSummaryResponse(intent, data, language);
  }

  /**
   * Compose response for empty data
   */
  private composeEmptyResponse(intent: IntentInfo, language: 'he' | 'en'): ComposerOutput {
    const answer = language === 'he'
      ? 'לא נמצאו נתונים לשאילתה זו'
      : 'No data found for this query';

    return {
      answer,
      answerHe: 'לא נמצאו נתונים לשאילתה זו',
      answerEn: 'No data found for this query',
      insights: [],
      suggestedActions: [],
      followUpQuestions: this.getFollowUpQuestions(intent, language),
      hasData: false,
      itemCount: 0
    };
  }

  /**
   * Compose response for list/breakdown data
   */
  private composeListResponse(
    intent: IntentInfo,
    data: Record<string, any>,
    language: 'he' | 'en'
  ): ComposerOutput {
    const items = data.rows || data.items || data;
    const isArray = Array.isArray(items);
    const itemList = isArray ? items : [];

    // Limit to max items
    const displayItems = itemList.slice(0, MAX_LIST_ITEMS);
    const remainingCount = itemList.length - MAX_LIST_ITEMS;

    // Build answer
    const lines: string[] = [];

    for (const item of displayItems) {
      const label = item.label || item.name || item.dimension || item[0];
      const value = item.value || item.count || item.measure || item[1];
      lines.push(`• ${label}: ${this.formatNumber(value)}`);
    }

    if (remainingCount > 0) {
      const othersLabel = language === 'he' ? `ו-${remainingCount} נוספים` : `and ${remainingCount} more`;
      lines.push(`• ${othersLabel}`);
    }

    let answer = lines.join('\n');

    // Add total if available
    if (data.total !== undefined) {
      const totalLabel = language === 'he' ? 'סה"כ' : 'Total';
      answer = `${totalLabel}: ${this.formatNumber(data.total)}\n\n${answer}`;
    }

    // Detect insights
    const insights = this.detectListInsights(itemList, language);

    return {
      answer,
      answerHe: language === 'he' ? answer : this.translateToHebrew(answer),
      answerEn: language === 'en' ? answer : this.translateToEnglish(answer),
      insights,
      suggestedActions: this.getSuggestedActions(intent, 'list', language),
      followUpQuestions: this.getFollowUpQuestions(intent, language),
      hasData: true,
      itemCount: itemList.length
    };
  }

  /**
   * Compose response for single value
   */
  private composeSingleValueResponse(
    intent: IntentInfo,
    data: Record<string, any>,
    language: 'he' | 'en'
  ): ComposerOutput {
    const value = data.value ?? data.count ?? 0;
    const templates = language === 'he' ? INTENT_TEMPLATES_HE : INTENT_TEMPLATES_EN;
    const template = templates[intent.intent || 'status_overview'] || '{summary}';

    const answer = template
      .replace('{count}', this.formatNumber(value))
      .replace('{value}', this.formatNumber(value))
      .replace('{score}', this.formatNumber(value, 1))
      .replace('{summary}', `${this.formatNumber(value)}`);

    // Detect insights
    const insights: string[] = [];
    if (data.breached && data.breached > 0) {
      insights.push(language === 'he'
        ? `⚠️ ${data.breached} חריגות SLA`
        : `⚠️ ${data.breached} SLA breaches`);
    }

    return {
      answer,
      answerHe: language === 'he' ? answer : this.translateToHebrew(answer),
      answerEn: language === 'en' ? answer : this.translateToEnglish(answer),
      insights,
      suggestedActions: this.getSuggestedActions(intent, 'single', language),
      followUpQuestions: this.getFollowUpQuestions(intent, language),
      hasData: true,
      itemCount: 1
    };
  }

  /**
   * Compose response for comparison data
   */
  private composeComparisonResponse(
    intent: IntentInfo,
    data: Record<string, any>,
    language: 'he' | 'en'
  ): ComposerOutput {
    const current = data.current;
    const previous = data.previous;
    const diff = current - previous;
    const pctChange = previous !== 0 ? (diff / previous * 100) : 0;

    const direction = diff > 0
      ? (language === 'he' ? 'עלייה' : 'increase')
      : (language === 'he' ? 'ירידה' : 'decrease');

    const answer = language === 'he'
      ? `${this.formatNumber(current)} (${direction} של ${Math.abs(pctChange).toFixed(1)}% מ-${this.formatNumber(previous)})`
      : `${this.formatNumber(current)} (${Math.abs(pctChange).toFixed(1)}% ${direction} from ${this.formatNumber(previous)})`;

    // Insights based on change
    const insights: string[] = [];
    if (Math.abs(pctChange) > 20) {
      insights.push(language === 'he'
        ? `📊 שינוי משמעותי של ${Math.abs(pctChange).toFixed(0)}%`
        : `📊 Significant change of ${Math.abs(pctChange).toFixed(0)}%`);
    }

    return {
      answer,
      answerHe: language === 'he' ? answer : this.translateToHebrew(answer),
      answerEn: language === 'en' ? answer : this.translateToEnglish(answer),
      insights,
      suggestedActions: this.getSuggestedActions(intent, 'comparison', language),
      followUpQuestions: this.getFollowUpQuestions(intent, language),
      hasData: true,
      itemCount: 2
    };
  }

  /**
   * Compose summary response
   */
  private composeSummaryResponse(
    intent: IntentInfo,
    data: Record<string, any>,
    language: 'he' | 'en'
  ): ComposerOutput {
    // Format data as key-value pairs
    const lines: string[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'number') {
        lines.push(`• ${key}: ${this.formatNumber(value)}`);
      } else if (typeof value === 'string') {
        lines.push(`• ${key}: ${value}`);
      }
    }

    const answer = lines.join('\n');

    return {
      answer,
      answerHe: language === 'he' ? answer : this.translateToHebrew(answer),
      answerEn: language === 'en' ? answer : this.translateToEnglish(answer),
      insights: [],
      suggestedActions: this.getSuggestedActions(intent, 'summary', language),
      followUpQuestions: this.getFollowUpQuestions(intent, language),
      hasData: true,
      itemCount: Object.keys(data).length
    };
  }

  /**
   * Detect insights from list data
   */
  private detectListInsights(items: any[], language: 'he' | 'en'): string[] {
    const insights: string[] = [];

    if (items.length === 0) return insights;

    // Calculate total
    const total = items.reduce((sum, item) => {
      const val = item.value || item.count || item[1] || 0;
      return sum + (typeof val === 'number' ? val : 0);
    }, 0);

    // Check concentration (first item)
    if (items.length > 1 && total > 0) {
      const firstValue = items[0].value || items[0].count || items[0][1] || 0;
      const firstPct = (firstValue / total * 100);
      if (firstPct > 40) {
        const firstLabel = items[0].label || items[0].name || items[0][0];
        insights.push(language === 'he'
          ? `📌 ${firstLabel} מהווה ${firstPct.toFixed(0)}% מהכל`
          : `📌 ${firstLabel} accounts for ${firstPct.toFixed(0)}% of total`);
      }
    }

    return insights;
  }

  /**
   * Get suggested actions based on context
   */
  private getSuggestedActions(
    intent: IntentInfo,
    responseType: string,
    language: 'he' | 'en'
  ): string[] {
    const actions: string[] = [];

    if (responseType === 'single' && intent.dimension === null) {
      actions.push(language === 'he' ? 'פירוט לפי קטגוריה' : 'Break down by category');
      actions.push(language === 'he' ? 'פירוט לפי טכנאי' : 'Break down by technician');
    }

    if (intent.intent === 'status_overview') {
      actions.push(language === 'he' ? 'מה דורש תשומת לב?' : 'What needs attention?');
    }

    return actions;
  }

  /**
   * Get follow-up questions
   */
  private getFollowUpQuestions(intent: IntentInfo, language: 'he' | 'en'): string[] {
    const questions: string[] = [];

    if (intent.intent === 'status_overview') {
      questions.push(language === 'he' ? 'מה קרה בלילה?' : 'What happened overnight?');
      questions.push(language === 'he' ? 'מה דחוף?' : 'What\'s urgent?');
    }

    if (intent.intent === 'urgent_attention') {
      questions.push(language === 'he' ? 'תפרט לפי צוות' : 'Show by team');
    }

    return questions;
  }

  /**
   * Format number with locale
   */
  private formatNumber(value: number, decimals: number = 0): string {
    if (typeof value !== 'number' || isNaN(value)) {
      return String(value);
    }
    return value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  /**
   * Simple translation to Hebrew (placeholder)
   */
  private translateToHebrew(text: string): string {
    // In a real implementation, this would use a translation service
    return text;
  }

  /**
   * Simple translation to English (placeholder)
   */
  private translateToEnglish(text: string): string {
    // In a real implementation, this would use a translation service
    return text;
  }
}

// Export singleton instance
export const responseComposer = new ResponseComposer();
