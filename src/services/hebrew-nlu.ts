/**
 * Hebrew NLU Service - Natural Language Understanding for Hebrew
 *
 * Provides:
 * - Entity extraction from Hebrew text
 * - Field name translation (Hebrew → Qlik)
 * - Status and time period detection
 * - Dimension recognition
 *
 * Uses semantic-i18n-he.json for translations
 *
 * TaskGuard: services-006
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { hebrewTokenizer, TokenizationResult } from './hebrew-tokenizer.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ service: 'HebrewNLU' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to i18n file
const I18N_PATH = path.join(__dirname, '../../docs/knowledge/semantic-i18n-he.json');

// ===== TYPE DEFINITIONS =====

export interface ExtractedEntity {
  type: 'entity' | 'measure' | 'dimension' | 'time_period' | 'status' | 'urgency';
  hebrewText: string;
  englishValue: string;
  confidence: number;
  position?: number;
}

export interface NLUResult {
  originalText: string;
  tokenization: TokenizationResult;
  entities: ExtractedEntity[];
  timePeriod: string | null;
  status: string | null;
  urgency: string | null;
  dimensions: string[];
  isHebrew: boolean;
  confidence: number;
}

export interface I18NSchema {
  version: string;
  intents?: Record<string, {
    name: string;
    description: string;
    triggers: string[];
  }>;
  responseTypes?: Record<string, string>;
  implicitIntents?: Record<string, ImplicitIntentDef>;
  entities: Record<string, {
    name: string;
    plural: string;
    aliases: string[];
  }>;
  measures: Record<string, Record<string, string>>;
  dimensions: Record<string, string>;
  timePeriods: Record<string, string>;
  ui: Record<string, string>;
  prompts: Record<string, string>;
}

export interface ImplicitIntentDef {
  patterns: string[];
  assumeIntent?: string;
  defaultEntity?: string;
  defaultMeasure?: string;
  note?: string;
}

export interface ImplicitIntentResult {
  triggered: boolean;
  implicitType: string | null;
  assumedIntent: string | null;
  defaultEntity: string | null;
  defaultMeasure: string | null;
  matchedPattern: string | null;
  confidence: number;
}

// ===== HEBREW NLU CLASS =====

export class HebrewNLU {
  private i18n: I18NSchema | null = null;
  private hebrewToEnglish: Map<string, { type: string; value: string }> = new Map();
  private tokenizer = hebrewTokenizer;

  constructor() {
    this.loadI18N();
    this.buildMappings();
  }

  /**
   * Load i18n schema from JSON file
   */
  private loadI18N(): void {
    try {
      if (fs.existsSync(I18N_PATH)) {
        const content = fs.readFileSync(I18N_PATH, 'utf-8');
        this.i18n = JSON.parse(content);
        log.warn('[HebrewNLU] Loaded i18n schema v' + this.i18n?.version);
      } else {
        log.warn('[HebrewNLU] i18n file not found:', I18N_PATH);
      }
    } catch (error) {
      log.warn('[HebrewNLU] Failed to load i18n:', error);
    }
  }

  /**
   * Build Hebrew → English mappings for fast lookup
   */
  private buildMappings(): void {
    if (!this.i18n) return;

    // Map entity names and aliases
    for (const [englishName, entityDef] of Object.entries(this.i18n.entities)) {
      this.hebrewToEnglish.set(entityDef.name, { type: 'entity', value: englishName });
      this.hebrewToEnglish.set(entityDef.plural, { type: 'entity', value: englishName });
      for (const alias of entityDef.aliases) {
        this.hebrewToEnglish.set(alias, { type: 'entity', value: englishName });
      }
    }

    // Map dimensions
    for (const [englishName, hebrewName] of Object.entries(this.i18n.dimensions)) {
      this.hebrewToEnglish.set(hebrewName, { type: 'dimension', value: englishName });
    }

    // Map time periods
    for (const [englishName, hebrewName] of Object.entries(this.i18n.timePeriods)) {
      this.hebrewToEnglish.set(hebrewName, { type: 'time_period', value: englishName });
    }

    log.warn(`Built ${this.hebrewToEnglish.size} mappings`);
  }

  /**
   * Process Hebrew text and extract NLU information
   */
  process(text: string): NLUResult {
    const tokenization = this.tokenizer.tokenize(text);
    const entities: ExtractedEntity[] = [];
    let timePeriod: string | null = null;
    let status: string | null = null;
    let urgency: string | null = null;
    const dimensions: string[] = [];

    // Process each Hebrew token
    for (let i = 0; i < tokenization.hebrewTokens.length; i++) {
      const token = tokenization.hebrewTokens[i];

      // Try exact match first
      let mapping = this.hebrewToEnglish.get(token.original);

      // Try without prefix
      if (!mapping && token.prefix) {
        mapping = this.hebrewToEnglish.get(token.withoutPrefix);
      }

      if (mapping) {
        entities.push({
          type: mapping.type as ExtractedEntity['type'],
          hebrewText: token.original,
          englishValue: mapping.value,
          confidence: 1.0,
          position: i
        });

        // Track specific types
        if (mapping.type === 'time_period') {
          timePeriod = mapping.value;
        } else if (mapping.type === 'dimension') {
          dimensions.push(mapping.value);
        }
      }

      // Check for status keywords
      const statusMapping = this.detectStatus(token.original, token.withoutPrefix);
      if (statusMapping) {
        status = statusMapping;
        entities.push({
          type: 'status',
          hebrewText: token.original,
          englishValue: statusMapping,
          confidence: 1.0,
          position: i
        });
      }

      // Check for urgency keywords
      const urgencyMapping = this.detectUrgency(token.original, token.withoutPrefix);
      if (urgencyMapping) {
        urgency = urgencyMapping;
        entities.push({
          type: 'urgency',
          hebrewText: token.original,
          englishValue: urgencyMapping,
          confidence: 1.0,
          position: i
        });
      }
    }

    // Calculate overall confidence
    const confidence = entities.length > 0
      ? entities.reduce((sum, e) => sum + e.confidence, 0) / entities.length
      : 0;

    return {
      originalText: text,
      tokenization,
      entities,
      timePeriod,
      status,
      urgency,
      dimensions,
      isHebrew: tokenization.dominantLanguage === 'hebrew',
      confidence
    };
  }

  /**
   * Detect status keywords
   */
  private detectStatus(original: string, withoutPrefix: string): string | null {
    const statusKeywords: Record<string, string> = {
      'פתוח': 'Open',
      'פתוחות': 'Open',
      'פתוחים': 'Open',
      'סגור': 'Closed',
      'סגורות': 'Closed',
      'סגורים': 'Closed',
      'בטיפול': 'Open',
      'ממתין': 'Open',
      'ממתינות': 'Open',
      'חדש': 'New',
      'חדשות': 'New'
    };

    return statusKeywords[original] || statusKeywords[withoutPrefix] || null;
  }

  /**
   * Detect urgency keywords
   */
  private detectUrgency(original: string, withoutPrefix: string): string | null {
    const urgencyKeywords: Record<string, string> = {
      'דחוף': 'High',
      'דחופה': 'High',
      'דחופות': 'High',
      'קריטי': 'Highest',
      'קריטית': 'Highest',
      'קריטיות': 'Highest',
      'חשוב': 'High',
      'חשובה': 'High',
      'רגיל': 'Normal',
      'רגילה': 'Normal',
      'נמוך': 'Low',
      'נמוכה': 'Low'
    };

    return urgencyKeywords[original] || urgencyKeywords[withoutPrefix] || null;
  }

  /**
   * Translate Hebrew term to English field name
   */
  translate(hebrewTerm: string): string | null {
    // Try direct lookup
    const mapping = this.hebrewToEnglish.get(hebrewTerm);
    if (mapping) {
      return mapping.value;
    }

    // Try with prefix removed
    const { root } = this.tokenizer.removePrefix(hebrewTerm);
    const rootMapping = this.hebrewToEnglish.get(root);
    if (rootMapping) {
      return rootMapping.value;
    }

    return null;
  }

  /**
   * Get Hebrew name for English entity
   */
  getHebrewName(englishEntity: string): string | null {
    if (!this.i18n) return null;

    const entityDef = this.i18n.entities[englishEntity];
    return entityDef?.name || null;
  }

  /**
   * Get Hebrew name for intent
   */
  getIntentHebrewName(intentName: string): string | null {
    if (!this.i18n?.intents) return null;

    const intentDef = this.i18n.intents[intentName];
    return intentDef?.name || null;
  }

  /**
   * Get Hebrew triggers for intent
   */
  getIntentTriggers(intentName: string): string[] {
    if (!this.i18n?.intents) return [];

    const intentDef = this.i18n.intents[intentName];
    return intentDef?.triggers || [];
  }

  /**
   * Get all available dimensions in Hebrew
   */
  getAvailableDimensions(): Record<string, string> {
    if (!this.i18n) return {};
    return this.i18n.dimensions;
  }

  /**
   * Get all available time periods in Hebrew
   */
  getAvailableTimePeriods(): Record<string, string> {
    if (!this.i18n) return {};
    return this.i18n.timePeriods;
  }

  /**
   * Get UI string translation
   */
  getUIString(key: string): string {
    if (!this.i18n) return key;
    return this.i18n.ui[key] || key;
  }

  /**
   * Get prompt template
   */
  getPrompt(key: string): string {
    if (!this.i18n) return key;
    return this.i18n.prompts[key] || key;
  }

  /**
   * Check if text likely contains a question
   */
  isQuestion(text: string): boolean {
    const questionIndicators = [
      'מה', 'מי', 'איפה', 'מתי', 'למה', 'איך', 'כמה', 'האם',
      '?'
    ];

    const lowerText = text.toLowerCase();
    return questionIndicators.some(indicator => lowerText.includes(indicator));
  }

  // ===== IMPLICIT INTENT DETECTION (services-008) =====

  /**
   * Detect implicit intents from greeting patterns or partial queries
   *
   * Examples:
   * - "בוקר טוב" → assumes status_overview
   * - "כמה" (without context) → assumes ticket count
   * - "שלום" → assumes status_overview
   */
  detectImplicitIntent(text: string): ImplicitIntentResult {
    if (!this.i18n?.implicitIntents) {
      return {
        triggered: false,
        implicitType: null,
        assumedIntent: null,
        defaultEntity: null,
        defaultMeasure: null,
        matchedPattern: null,
        confidence: 0
      };
    }

    const lowerText = text.toLowerCase().trim();

    for (const [implicitType, def] of Object.entries(this.i18n.implicitIntents)) {
      for (const pattern of def.patterns) {
        // Check if text starts with or contains the pattern
        if (lowerText.startsWith(pattern) || lowerText.includes(pattern)) {
          // Calculate confidence based on match type
          let confidence = 0.7; // Base confidence for pattern match

          // Higher confidence if it's a greeting at the start
          if (lowerText.startsWith(pattern)) {
            confidence = 0.85;
          }

          // Lower confidence if there's more content after the pattern
          // (might be an explicit intent)
          const textAfterPattern = lowerText.slice(lowerText.indexOf(pattern) + pattern.length).trim();
          if (textAfterPattern.length > 10) {
            confidence = 0.5; // User probably has a specific question
          }

          return {
            triggered: true,
            implicitType,
            assumedIntent: def.assumeIntent || null,
            defaultEntity: def.defaultEntity || null,
            defaultMeasure: def.defaultMeasure || null,
            matchedPattern: pattern,
            confidence
          };
        }
      }
    }

    return {
      triggered: false,
      implicitType: null,
      assumedIntent: null,
      defaultEntity: null,
      defaultMeasure: null,
      matchedPattern: null,
      confidence: 0
    };
  }

  /**
   * Check if text is only a greeting (no actual question)
   */
  isOnlyGreeting(text: string): boolean {
    const greetings = ['בוקר טוב', 'ערב טוב', 'שלום', 'היי', 'הי', 'hello', 'hi', 'hey', 'good morning'];
    const normalized = text.toLowerCase().trim();

    for (const greeting of greetings) {
      if (normalized === greeting || normalized === greeting + '!') {
        return true;
      }
    }

    // Check if text is just a greeting plus punctuation
    const textWithoutPunctuation = normalized.replace(/[!.,?]/g, '').trim();
    return greetings.includes(textWithoutPunctuation);
  }

  /**
   * Detect if user is asking a number question without context
   * "כמה?" → default to open tickets count
   */
  isPartialNumberQuery(text: string): boolean {
    const normalized = text.trim();
    // Just "כמה" or "כמה?" without more context
    return /^כמה[?]?$/i.test(normalized) || /^how many[?]?$/i.test(normalized.toLowerCase());
  }

  /**
   * Get all implicit intent patterns
   */
  getImplicitIntentPatterns(): Record<string, string[]> {
    if (!this.i18n?.implicitIntents) return {};

    const result: Record<string, string[]> = {};
    for (const [type, def] of Object.entries(this.i18n.implicitIntents)) {
      result[type] = def.patterns;
    }
    return result;
  }

  /**
   * Detect if user is asking about personal work ("שלי")
   */
  isPersonalQuery(text: string): boolean {
    const personalIndicators = ['שלי', 'לי', 'אני', 'עלי'];
    return personalIndicators.some(indicator => text.includes(indicator));
  }

  /**
   * Extract numbers from Hebrew text
   */
  extractNumbers(text: string): number[] {
    const numbers: number[] = [];

    // Extract Arabic numerals
    const arabicMatches = text.match(/\d+/g);
    if (arabicMatches) {
      numbers.push(...arabicMatches.map(n => parseInt(n, 10)));
    }

    // Hebrew number words (basic)
    const hebrewNumbers: Record<string, number> = {
      'אחד': 1, 'אחת': 1,
      'שניים': 2, 'שתיים': 2,
      'שלוש': 3, 'שלושה': 3,
      'ארבע': 4, 'ארבעה': 4,
      'חמש': 5, 'חמישה': 5,
      'שש': 6, 'שישה': 6,
      'שבע': 7, 'שבעה': 7,
      'שמונה': 8,
      'תשע': 9, 'תשעה': 9,
      'עשר': 10, 'עשרה': 10
    };

    for (const [word, value] of Object.entries(hebrewNumbers)) {
      if (text.includes(word)) {
        numbers.push(value);
      }
    }

    return numbers;
  }

  // ===== TIME PERIOD RECOGNITION (services-007) =====

  /**
   * Enhanced time period detection with relative dates
   * Returns both the period key and calculated date range
   */
  detectTimePeriodAdvanced(text: string): TimePeriodResult | null {
    const now = new Date();

    // Hebrew time expressions with patterns
    const timePatterns: Array<{
      patterns: string[];
      period: string;
      getRange: () => { start: Date; end: Date };
    }> = [
      // Today
      {
        patterns: ['היום', 'today', 'עכשיו'],
        period: 'today',
        getRange: () => ({
          start: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          end: now
        })
      },
      // Yesterday
      {
        patterns: ['אתמול', 'yesterday'],
        period: 'yesterday',
        getRange: () => {
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          return {
            start: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()),
            end: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59)
          };
        }
      },
      // This week
      {
        patterns: ['השבוע', 'this week', 'בשבוע הזה'],
        period: 'this_week',
        getRange: () => {
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay());
          return {
            start: new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate()),
            end: now
          };
        }
      },
      // Last week
      {
        patterns: ['שבוע שעבר', 'last week', 'בשבוע שעבר'],
        period: 'last_week',
        getRange: () => {
          const startOfLastWeek = new Date(now);
          startOfLastWeek.setDate(now.getDate() - now.getDay() - 7);
          const endOfLastWeek = new Date(startOfLastWeek);
          endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
          return {
            start: new Date(startOfLastWeek.getFullYear(), startOfLastWeek.getMonth(), startOfLastWeek.getDate()),
            end: new Date(endOfLastWeek.getFullYear(), endOfLastWeek.getMonth(), endOfLastWeek.getDate(), 23, 59, 59)
          };
        }
      },
      // This month
      {
        patterns: ['החודש', 'this month', 'בחודש הזה'],
        period: 'this_month',
        getRange: () => ({
          start: new Date(now.getFullYear(), now.getMonth(), 1),
          end: now
        })
      },
      // Last month
      {
        patterns: ['חודש שעבר', 'last month', 'בחודש שעבר'],
        period: 'last_month',
        getRange: () => {
          const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
          return { start, end };
        }
      },
      // This year
      {
        patterns: ['השנה', 'this year', 'בשנה הזו'],
        period: 'this_year',
        getRange: () => ({
          start: new Date(now.getFullYear(), 0, 1),
          end: now
        })
      },
      // Last year
      {
        patterns: ['שנה שעברה', 'last year', 'בשנה שעברה'],
        period: 'last_year',
        getRange: () => ({
          start: new Date(now.getFullYear() - 1, 0, 1),
          end: new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59)
        })
      },
      // Overnight / last night
      {
        patterns: ['בלילה', 'overnight', 'אמש', 'הלילה'],
        period: 'overnight',
        getRange: () => {
          const lastNight = new Date(now);
          lastNight.setDate(lastNight.getDate() - 1);
          lastNight.setHours(18, 0, 0, 0);
          const thisMorning = new Date(now);
          thisMorning.setHours(6, 0, 0, 0);
          return { start: lastNight, end: thisMorning };
        }
      },
      // This morning
      {
        patterns: ['הבוקר', 'this morning', 'בבוקר'],
        period: 'this_morning',
        getRange: () => {
          const start = new Date(now);
          start.setHours(6, 0, 0, 0);
          return { start, end: now };
        }
      },
      // Last 24 hours
      {
        patterns: ['24 שעות', 'יממה', 'last 24 hours'],
        period: 'last_24h',
        getRange: () => {
          const start = new Date(now);
          start.setHours(start.getHours() - 24);
          return { start, end: now };
        }
      },
      // Last 7 days
      {
        patterns: ['7 ימים', 'שבעה ימים', 'last 7 days'],
        period: 'last_7d',
        getRange: () => {
          const start = new Date(now);
          start.setDate(start.getDate() - 7);
          return { start, end: now };
        }
      },
      // Last 30 days
      {
        patterns: ['30 יום', 'שלושים יום', 'last 30 days'],
        period: 'last_30d',
        getRange: () => {
          const start = new Date(now);
          start.setDate(start.getDate() - 30);
          return { start, end: now };
        }
      }
    ];

    const lowerText = text.toLowerCase();

    for (const pattern of timePatterns) {
      for (const trigger of pattern.patterns) {
        if (lowerText.includes(trigger) || text.includes(trigger)) {
          const range = pattern.getRange();
          return {
            period: pattern.period,
            matchedText: trigger,
            dateRange: range,
            qlikFilter: this.toQlikDateFilter(pattern.period, range)
          };
        }
      }
    }

    // Try to detect relative expressions like "לפני X ימים"
    const relativeMatch = this.detectRelativeTime(text);
    if (relativeMatch) {
      return relativeMatch;
    }

    return null;
  }

  /**
   * Detect relative time expressions like "לפני 3 ימים"
   */
  private detectRelativeTime(text: string): TimePeriodResult | null {
    const now = new Date();

    // "לפני X ימים" / "X days ago"
    const daysAgoPattern = /(?:לפני\s+)?(\d+)\s*(?:ימים|יום|days?\s*ago)/i;
    const daysMatch = text.match(daysAgoPattern);
    if (daysMatch) {
      const days = parseInt(daysMatch[1], 10);
      const start = new Date(now);
      start.setDate(start.getDate() - days);
      return {
        period: `last_${days}d`,
        matchedText: daysMatch[0],
        dateRange: { start, end: now },
        qlikFilter: this.toQlikDateFilter(`last_${days}d`, { start, end: now })
      };
    }

    // "לפני X שעות" / "X hours ago"
    const hoursAgoPattern = /(?:לפני\s+)?(\d+)\s*(?:שעות|שעה|hours?\s*ago)/i;
    const hoursMatch = text.match(hoursAgoPattern);
    if (hoursMatch) {
      const hours = parseInt(hoursMatch[1], 10);
      const start = new Date(now);
      start.setHours(start.getHours() - hours);
      return {
        period: `last_${hours}h`,
        matchedText: hoursMatch[0],
        dateRange: { start, end: now },
        qlikFilter: `Request_Date >= '${this.formatQlikDate(start)}'`
      };
    }

    return null;
  }

  /**
   * Convert time period to Qlik date filter expression
   */
  private toQlikDateFilter(period: string, range: { start: Date; end: Date }): string {
    // Use Qlik's V_ToDate variable for standard periods
    const standardFilters: Record<string, string> = {
      'this_month': "Request_Current_Month={'1'}",
      'last_month': "Request_LastMonth={'1'}",
      'this_year': "Request_Current_Year={'1'}",
      'today': `Request_Date='${this.formatQlikDate(range.start)}'`,
      'yesterday': `Request_Date='${this.formatQlikDate(range.start)}'`
    };

    if (standardFilters[period]) {
      return standardFilters[period];
    }

    // For custom ranges, use date comparison
    return `Request_Date >= '${this.formatQlikDate(range.start)}' AND Request_Date <= '${this.formatQlikDate(range.end)}'`;
  }

  /**
   * Format date for Qlik filter
   */
  private formatQlikDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Check if measure requires time period (Flow vs Stock)
   */
  requiresTimePeriod(measureName: string): boolean {
    // Stock measures (current state) - don't need time period
    const stockMeasures = [
      'active_count',
      'active_tickets',
      'open_count'
    ];

    // Flow measures (historical) - need time period
    const flowMeasures = [
      'total_volume',
      'breached',
      'avg_resolution_time',
      'satisfaction_avg',
      'reopen_rate',
      'closed_count'
    ];

    if (stockMeasures.includes(measureName)) {
      return false;
    }

    if (flowMeasures.includes(measureName)) {
      return true;
    }

    // Default: assume it needs time period
    return true;
  }
}

// ===== TIME PERIOD RESULT TYPE =====

export interface TimePeriodResult {
  period: string;
  matchedText: string;
  dateRange: {
    start: Date;
    end: Date;
  };
  qlikFilter: string;
}

// ===== SINGLETON EXPORT =====

export const hebrewNLU = new HebrewNLU();
