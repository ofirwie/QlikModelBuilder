/**
 * Intent Engine - Core intent recognition for Semantic Layer V4
 *
 * Matches user queries to defined intents from semantic-intents.json
 * Supports Hebrew and English queries with fuzzy matching
 *
 * TaskGuard: services-003
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';
import { findMatchingObject, EXISTING_APP_OBJECTS } from './app/visualization-service.js';

const log = logger.child({ service: 'IntentEngine' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to intents file
const INTENTS_PATH = path.join(__dirname, '../../semantic-intents.json');

// ===== TYPE DEFINITIONS =====

export interface ExtractedEntity {
  type: 'entity' | 'measure' | 'dimension' | 'time_period' | 'filter';
  value: string;
  originalText: string;
  confidence: number;
  source?: string;  // e.g., 'context', 'query'
}

export interface IntentResult {
  intent: string | null;
  confidence: number;
  matchedTrigger: string | null;
  entities: ExtractedEntity[];
  timePeriod: string | null;
  dimension: string | null;
  filters: Record<string, string[]>;
  responseType: string | null;
  components: any[] | null;
  originalQuery?: string;
  drillOptions?: string[];
  requiresTimePeriod?: boolean;
  // Pre-built object recommendation (when available)
  prebuiltObject?: {
    objectKey: keyof typeof EXISTING_APP_OBJECTS;
    objectId: string;
    description: string;
    useInsteadOfHypercube: boolean;
  };
}

export interface IntentDefinition {
  description: string;
  triggers: string[];
  response_type: string;
  components?: any[];
  logic?: any;
  requires?: string;
  example_response?: string;
}

export interface AnalysisTarget {
  entity: string;
  measure: string;
}

export interface IntentsFile {
  version: string;
  approach: string;
  philosophy: string;
  intents: Record<string, IntentDefinition>;
  language_understanding: {
    hebrew_mappings: {
      entities: Record<string, string>;
      status: Record<string, string>;
      time: Record<string, string>;
      urgency: Record<string, string | string[]>;
      dimensions: Record<string, string>;
    };
    implicit_intents: Record<string, any>;
    analysis_targets?: Record<string, AnalysisTarget>;
  };
  response_principles: any;
}

// ===== INTENT ENGINE CLASS =====

export class IntentEngine {
  private intents: IntentsFile | null = null;
  private hebrewMappings: IntentsFile['language_understanding']['hebrew_mappings'] | null = null;
  private analysisTargets: Record<string, AnalysisTarget> | null = null;

  constructor() {
    this.loadIntents();
  }

  /**
   * Load intents from JSON file
   */
  private loadIntents(): void {
    try {
      if (fs.existsSync(INTENTS_PATH)) {
        const content = fs.readFileSync(INTENTS_PATH, 'utf-8');
        this.intents = JSON.parse(content);
        this.hebrewMappings = this.intents?.language_understanding?.hebrew_mappings || null;
        this.analysisTargets = this.intents?.language_understanding?.analysis_targets || null;
        log.warn('[IntentEngine] Loaded intents:', Object.keys(this.intents?.intents || {}).length);
      } else {
        log.warn('[IntentEngine] Intents file not found:', INTENTS_PATH);
      }
    } catch (error) {
      log.warn('[IntentEngine] Failed to load intents:', error);
    }
  }

  /**
   * Recognize intent from user query
   */
  recognize(query: string, context?: any): IntentResult {
    const result: IntentResult = {
      intent: null,
      confidence: 0,
      matchedTrigger: null,
      entities: [],
      timePeriod: null,
      dimension: null,
      filters: {},
      responseType: null,
      components: null
    };

    if (!this.intents) {
      return result;
    }

    const normalizedQuery = this.normalizeQuery(query);

    // Handle empty or whitespace-only queries
    if (!normalizedQuery || normalizedQuery.trim().length === 0) {
      return result;
    }

    // Try to match each intent
    let bestMatch: { intent: string; confidence: number; trigger: string } | null = null;

    for (const [intentName, intentDef] of Object.entries(this.intents.intents)) {
      for (const trigger of intentDef.triggers) {
        const confidence = this.calculateMatchConfidence(normalizedQuery, trigger);

        if (confidence > 0 && (!bestMatch || confidence > bestMatch.confidence)) {
          bestMatch = {
            intent: intentName,
            confidence,
            trigger
          };
        }
      }
    }

    // Check implicit intents (greetings, etc.)
    if (!bestMatch || bestMatch.confidence < 0.5) {
      const implicitMatch = this.checkImplicitIntents(normalizedQuery);
      if (implicitMatch && (!bestMatch || implicitMatch.confidence > bestMatch.confidence)) {
        bestMatch = implicitMatch;
      }
    }

    if (bestMatch && bestMatch.confidence >= 0.3) {
      const intentDef = this.intents.intents[bestMatch.intent];
      result.intent = bestMatch.intent;
      result.confidence = bestMatch.confidence;
      result.matchedTrigger = bestMatch.trigger;
      // Only set response type and components if we have intent definition
      if (intentDef) {
        result.responseType = intentDef.response_type;
        result.components = intentDef.components || null;
      }
    }

    // Extract entities regardless of intent match
    result.entities = this.extractEntities(query);
    result.timePeriod = this.detectTimePeriod(query);
    result.dimension = this.detectDimension(query);

    // Check for pre-built object match
    const entityValue = result.entities.find(e => e.type === 'entity')?.value;
    const measureValue = result.entities.find(e => e.type === 'measure')?.value;
    const dimensionValue = result.dimension;

    // Extract keywords from query for matching
    const keywords = this.extractKeywords(query);

    const objectMatch = findMatchingObject(entityValue, measureValue, dimensionValue || undefined, keywords);
    if (objectMatch) {
      const objectConfig = EXISTING_APP_OBJECTS[objectMatch.objectKey];
      result.prebuiltObject = {
        objectKey: objectMatch.objectKey,
        objectId: objectConfig.objectId,
        description: objectMatch.mapping.description,
        useInsteadOfHypercube: true
      };
      log.warn(`[IntentEngine] Found pre-built object match: ${objectMatch.objectKey} - ${objectMatch.mapping.description}`);
    }

    return result;
  }

  /**
   * Extract keywords from query for object matching
   */
  private extractKeywords(query: string): string[] {
    const keywords: string[] = [];
    const lowerQuery = query.toLowerCase();

    // Hebrew keywords - comprehensive list for object matching
    const hebrewKeywords = [
      'נתח', 'ביצועים', 'מגמה', 'שביעות רצון', 'סיכום',
      'חריגה', 'חריגות', 'עמידה',                          // SLA keywords
      'מקור', 'ערוץ',                                      // Source keywords
      'צבר', 'פתוחות',                                     // Backlog keywords
      'יעילות', 'העברות',                                  // Efficiency keywords
      'זמן סגירה',                                         // Resolution time keywords
      'סוכנים', 'בינה מלאכותית'                           // AI keywords
    ];
    for (const kw of hebrewKeywords) {
      if (query.includes(kw)) {
        keywords.push(kw);
      }
    }

    // English keywords - CRITICAL: must include SLA, source, channel, tickets for proper object matching
    const englishKeywords = [
      'analyze', 'performance', 'trend', 'satisfaction', 'summary', 'monthly', 'breakdown', 'mttr',
      'sla', 'compliance', 'breach', 'breaches', 'breached',  // SLA keywords
      'source', 'channel', 'chatbot', 'email', 'ssp',         // Source keywords
      'tickets', 'incidents', 'requests',                     // Entity keywords
      'backlog', 'open', 'pending',                           // Backlog keywords
      'efficiency', 'handoffs', 'assignments',                // Efficiency keywords
      'resolution', 'time',                                   // Resolution time keywords
      'ai', 'agents', 'copilot'                              // AI keywords
    ];
    for (const kw of englishKeywords) {
      if (lowerQuery.includes(kw)) {
        keywords.push(kw);
      }
    }

    return keywords;
  }

  /**
   * Normalize query for matching
   */
  private normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .trim()
      .replace(/[?!.,]/g, '')
      .replace(/\s+/g, ' ');
  }

  /**
   * Calculate match confidence between query and trigger
   */
  private calculateMatchConfidence(query: string, trigger: string): number {
    const normalizedTrigger = this.normalizeQuery(trigger);

    // Exact match
    if (query === normalizedTrigger) {
      return 1.0;
    }

    // Query contains trigger
    if (query.includes(normalizedTrigger)) {
      return 0.9;
    }

    // Trigger contains query
    if (normalizedTrigger.includes(query)) {
      return 0.7;
    }

    // Word overlap matching
    const queryWords = query.split(' ');
    const triggerWords = normalizedTrigger.split(' ');

    let matchedWords = 0;
    for (const qWord of queryWords) {
      for (const tWord of triggerWords) {
        if (qWord === tWord || this.fuzzyMatch(qWord, tWord)) {
          matchedWords++;
          break;
        }
      }
    }

    const overlapScore = matchedWords / Math.max(queryWords.length, triggerWords.length);

    if (overlapScore >= 0.5) {
      return overlapScore * 0.8;
    }

    return 0;
  }

  /**
   * Simple fuzzy match for typos
   */
  private fuzzyMatch(str1: string, str2: string): boolean {
    if (str1.length < 3 || str2.length < 3) {
      return str1 === str2;
    }

    // Levenshtein distance threshold
    const maxDistance = Math.floor(Math.min(str1.length, str2.length) / 3);
    const distance = this.levenshteinDistance(str1, str2);

    return distance <= maxDistance;
  }

  /**
   * Calculate Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
      }
    }

    return dp[m][n];
  }

  /**
   * Check for implicit intents (greetings that imply status check)
   */
  private checkImplicitIntents(query: string): { intent: string; confidence: number; trigger: string } | null {
    if (!this.intents?.language_understanding?.implicit_intents) {
      return null;
    }

    for (const [implicitName, implicitDef] of Object.entries(this.intents.language_understanding.implicit_intents)) {
      for (const pattern of implicitDef.patterns || []) {
        if (query.includes(pattern.toLowerCase())) {
          return {
            intent: implicitDef.assume_intent,
            confidence: 0.6,
            trigger: pattern
          };
        }
      }
    }

    return null;
  }

  /**
   * Extract entities from query
   */
  extractEntities(query: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    const lowerQuery = query.toLowerCase();

    // ===== ENGLISH ENTITY MAPPINGS =====
    const englishEntities: Record<string, string> = {
      'incident': 'incident',
      'incidents': 'incident',
      'ticket': 'incident',
      'tickets': 'incident',
      'issue': 'incident',
      'issues': 'incident',
      'problem': 'incident',
      'problems': 'incident',
      'request': 'request',
      'requests': 'request',
      'service request': 'request',
      'sr': 'request',
      'technician': 'technician',
      'technicians': 'technician',
      'agent': 'technician',
      'agents': 'technician',
      'satisfaction': 'satisfaction',
      'nps': 'satisfaction',
      'sla': 'sla',
      'breach': 'sla',
      'breaches': 'sla'
    };

    // Check English entities
    for (const [term, entityName] of Object.entries(englishEntities)) {
      if (lowerQuery.includes(term)) {
        // Avoid duplicates
        if (!entities.find(e => e.type === 'entity' && e.value === entityName)) {
          entities.push({
            type: 'entity',
            value: entityName,
            originalText: term,
            confidence: 1.0
          });
        }
      }
    }

    // ===== ENGLISH STATUS MAPPINGS =====
    const englishStatus: Record<string, string> = {
      'open': 'Open',
      'opened': 'Open',
      'active': 'Open',
      'closed': 'Closed',
      'resolved': 'Closed',
      'pending': 'Pending'
    };

    for (const [term, status] of Object.entries(englishStatus)) {
      if (lowerQuery.includes(term)) {
        entities.push({
          type: 'filter',
          value: `status_class=${status}`,
          originalText: term,
          confidence: 1.0
        });
      }
    }

    // ===== HEBREW MAPPINGS =====
    if (this.hebrewMappings) {
      // Check entity mappings (תקלה, בקשה, etc.)
      for (const [hebrewTerm, englishName] of Object.entries(this.hebrewMappings.entities)) {
        if (query.includes(hebrewTerm)) {
          // Avoid duplicates
          if (!entities.find(e => e.type === 'entity' && e.value === englishName)) {
            entities.push({
              type: 'entity',
              value: englishName,
              originalText: hebrewTerm,
              confidence: 1.0
            });
          }
        }
      }

      // Check dimension mappings (צוות, טכנאי, etc.)
      for (const [hebrewTerm, fieldName] of Object.entries(this.hebrewMappings.dimensions)) {
        if (query.includes(hebrewTerm)) {
          entities.push({
            type: 'dimension',
            value: fieldName,
            originalText: hebrewTerm,
            confidence: 1.0
          });
        }
      }

      // Check status mappings
      for (const [hebrewTerm, statusValue] of Object.entries(this.hebrewMappings.status)) {
        if (query.includes(hebrewTerm)) {
          entities.push({
            type: 'filter',
            value: `status_class=${statusValue}`,
            originalText: hebrewTerm,
            confidence: 1.0
          });
        }
      }
    }

    // ===== ANALYSIS TARGETS (Hebrew) =====
    if (this.analysisTargets) {
      for (const [hebrewTerm, target] of Object.entries(this.analysisTargets)) {
        if (query.includes(hebrewTerm)) {
          // Add entity from analysis target
          if (!entities.find(e => e.type === 'entity' && e.value === target.entity)) {
            entities.push({
              type: 'entity',
              value: target.entity,
              originalText: hebrewTerm,
              confidence: 1.0,
              source: 'analysis_target'
            });
          }
          // Add measure from analysis target
          entities.push({
            type: 'measure',
            value: target.measure,
            originalText: hebrewTerm,
            confidence: 1.0,
            source: 'analysis_target'
          });
        }
      }
    }

    // ===== ENGLISH ANALYSIS TARGETS =====
    const englishAnalysisTargets: Record<string, { entity: string; measure: string }> = {
      'breach': { entity: 'sla', measure: 'breached_count' },
      'breaches': { entity: 'sla', measure: 'breached_count' },
      'performance': { entity: 'technician', measure: 'closed_count' },
      'workload': { entity: 'technician', measure: 'active_tickets' },
      'load': { entity: 'technician', measure: 'active_tickets' }
    };

    for (const [term, target] of Object.entries(englishAnalysisTargets)) {
      if (lowerQuery.includes(term)) {
        // Add entity if not already present
        if (!entities.find(e => e.type === 'entity' && e.value === target.entity)) {
          entities.push({
            type: 'entity',
            value: target.entity,
            originalText: term,
            confidence: 0.9,
            source: 'analysis_target'
          });
        }
        // Add measure
        if (!entities.find(e => e.type === 'measure' && e.value === target.measure)) {
          entities.push({
            type: 'measure',
            value: target.measure,
            originalText: term,
            confidence: 0.9,
            source: 'analysis_target'
          });
        }
      }
    }

    return entities;
  }

  /**
   * Detect time period from query
   */
  detectTimePeriod(query: string): string | null {
    if (!this.hebrewMappings?.time) {
      return null;
    }

    for (const [hebrewTerm, periodKey] of Object.entries(this.hebrewMappings.time)) {
      if (query.includes(hebrewTerm)) {
        return periodKey;
      }
    }

    // English time period detection
    const englishPeriods: Record<string, string> = {
      'today': 'today',
      'yesterday': 'yesterday',
      'this week': 'this_week',
      'this month': 'this_month',
      'this year': 'this_year',
      'last month': 'last_month',
      'last year': 'last_year'
    };

    const lowerQuery = query.toLowerCase();
    for (const [term, period] of Object.entries(englishPeriods)) {
      if (lowerQuery.includes(term)) {
        return period;
      }
    }

    return null;
  }

  /**
   * Detect dimension for drill-down from query
   */
  detectDimension(query: string): string | null {
    if (!this.hebrewMappings?.dimensions) {
      return null;
    }

    for (const [hebrewTerm, dimension] of Object.entries(this.hebrewMappings.dimensions)) {
      if (query.includes(hebrewTerm)) {
        return dimension;
      }
    }

    // English dimension detection
    const englishDimensions: Record<string, string> = {
      'by category': 'category',
      'by team': 'admin_group',
      'by technician': 'assigned_user',
      'by source': 'source',
      'by priority': 'priority',
      'by status': 'status'
    };

    const lowerQuery = query.toLowerCase();
    for (const [term, dimension] of Object.entries(englishDimensions)) {
      if (lowerQuery.includes(term)) {
        return dimension;
      }
    }

    return null;
  }

  /**
   * Get all available intents
   */
  getAvailableIntents(): string[] {
    return this.intents ? Object.keys(this.intents.intents) : [];
  }

  /**
   * Get intent definition by name
   */
  getIntentDefinition(intentName: string): IntentDefinition | null {
    return this.intents?.intents[intentName] || null;
  }

  /**
   * Get response principles
   */
  getResponsePrinciples(): any {
    return this.intents?.response_principles || null;
  }
}

// Export singleton instance
export const intentEngine = new IntentEngine();
