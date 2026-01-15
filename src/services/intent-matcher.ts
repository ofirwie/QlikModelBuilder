/**
 * Intent Matcher - Advanced matching for intent triggers
 *
 * Provides:
 * - Fuzzy matching for typos
 * - Hebrew-aware matching
 * - Synonym expansion
 * - Partial word matching
 *
 * TaskGuard: services-005
 */

import { hebrewTokenizer } from './hebrew-tokenizer.js';

// ===== TYPE DEFINITIONS =====

export interface MatchResult {
  matched: boolean;
  confidence: number;
  matchedTrigger: string | null;
  matchType: 'exact' | 'contains' | 'fuzzy' | 'partial' | 'synonym' | 'none';
  details?: string;
}

export interface MatchOptions {
  minConfidence?: number;
  enableFuzzy?: boolean;
  enableSynonyms?: boolean;
  enablePartial?: boolean;
  hebrewAware?: boolean;
}

// ===== CONSTANTS =====

const DEFAULT_OPTIONS: MatchOptions = {
  minConfidence: 0.3,
  enableFuzzy: true,
  enableSynonyms: true,
  enablePartial: true,
  hebrewAware: true
};

/**
 * Common synonyms for intent matching
 */
const SYNONYMS: Record<string, string[]> = {
  // Status queries
  'status': ['מצב', 'סטטוס', 'overview', 'summary', 'סיכום'],
  'מה המצב': ['איך המצב', 'מה קורה', 'מה נשמע', 'what status'],

  // Urgent queries
  'urgent': ['דחוף', 'קריטי', 'critical', 'important', 'חשוב', 'בוער'],
  'דחוף': ['urgent', 'critical', 'קריטי', 'חשוב'],

  // Time periods
  'today': ['היום', 'הבוקר', 'this morning'],
  'yesterday': ['אתמול', 'יום קודם'],
  'overnight': ['בלילה', 'בערב', 'אחרי שעות'],

  // Entities
  'tickets': ['תקלות', 'קריאות', 'פניות', 'בעיות'],
  'תקלות': ['tickets', 'issues', 'problems', 'בעיות', 'קריאות'],

  // Actions
  'show': ['הצג', 'תראה', 'display', 'list'],
  'count': ['כמה', 'how many', 'ספור'],

  // Workload
  'workload': ['עומס', 'עבודה', 'load', 'capacity'],
  'עומס': ['workload', 'load', 'עבודה']
};

// ===== INTENT MATCHER CLASS =====

export class IntentMatcher {
  private synonymMap: Map<string, Set<string>>;

  constructor() {
    this.synonymMap = this.buildSynonymMap();
  }

  /**
   * Build bidirectional synonym map
   */
  private buildSynonymMap(): Map<string, Set<string>> {
    const map = new Map<string, Set<string>>();

    for (const [key, values] of Object.entries(SYNONYMS)) {
      // Add key -> values
      if (!map.has(key)) {
        map.set(key, new Set());
      }
      for (const v of values) {
        map.get(key)!.add(v);
      }

      // Add values -> key (bidirectional)
      for (const v of values) {
        if (!map.has(v)) {
          map.set(v, new Set());
        }
        map.get(v)!.add(key);
        // Also add cross-references
        for (const v2 of values) {
          if (v !== v2) {
            map.get(v)!.add(v2);
          }
        }
      }
    }

    return map;
  }

  /**
   * Match a query against a list of triggers
   */
  matchTriggers(
    query: string,
    triggers: string[],
    options: MatchOptions = {}
  ): MatchResult {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const normalizedQuery = this.normalizeText(query);

    if (!normalizedQuery || normalizedQuery.trim().length === 0) {
      return {
        matched: false,
        confidence: 0,
        matchedTrigger: null,
        matchType: 'none'
      };
    }

    let bestMatch: MatchResult = {
      matched: false,
      confidence: 0,
      matchedTrigger: null,
      matchType: 'none'
    };

    for (const trigger of triggers) {
      const result = this.matchSingle(normalizedQuery, trigger, opts);
      if (result.confidence > bestMatch.confidence) {
        bestMatch = result;
      }
    }

    // Apply minimum confidence threshold
    if (bestMatch.confidence < (opts.minConfidence || 0.3)) {
      return {
        matched: false,
        confidence: bestMatch.confidence,
        matchedTrigger: bestMatch.matchedTrigger,
        matchType: 'none',
        details: `Below confidence threshold (${bestMatch.confidence.toFixed(2)} < ${opts.minConfidence})`
      };
    }

    return bestMatch;
  }

  /**
   * Match query against a single trigger
   */
  private matchSingle(
    query: string,
    trigger: string,
    opts: MatchOptions
  ): MatchResult {
    const normalizedTrigger = this.normalizeText(trigger);

    // 1. Exact match
    if (query === normalizedTrigger) {
      return {
        matched: true,
        confidence: 1.0,
        matchedTrigger: trigger,
        matchType: 'exact'
      };
    }

    // 2. Contains match (query contains trigger or vice versa)
    if (query.includes(normalizedTrigger)) {
      return {
        matched: true,
        confidence: 0.9,
        matchedTrigger: trigger,
        matchType: 'contains',
        details: 'Query contains trigger'
      };
    }

    if (normalizedTrigger.includes(query)) {
      return {
        matched: true,
        confidence: 0.7,
        matchedTrigger: trigger,
        matchType: 'contains',
        details: 'Trigger contains query'
      };
    }

    // 3. Hebrew-aware matching (with prefix handling)
    if (opts.hebrewAware) {
      const hebrewResult = this.hebrewMatch(query, normalizedTrigger);
      if (hebrewResult.matched && hebrewResult.confidence > 0.5) {
        return {
          ...hebrewResult,
          matchedTrigger: trigger
        };
      }
    }

    // 4. Word overlap matching
    const overlapResult = this.wordOverlapMatch(query, normalizedTrigger);
    if (overlapResult.confidence > 0.4) {
      return {
        ...overlapResult,
        matchedTrigger: trigger
      };
    }

    // 5. Synonym matching
    if (opts.enableSynonyms) {
      const synonymResult = this.synonymMatch(query, normalizedTrigger);
      if (synonymResult.matched) {
        return {
          ...synonymResult,
          matchedTrigger: trigger
        };
      }
    }

    // 6. Fuzzy matching (for typos)
    if (opts.enableFuzzy) {
      const fuzzyResult = this.fuzzyMatch(query, normalizedTrigger);
      if (fuzzyResult.confidence > 0.5) {
        return {
          ...fuzzyResult,
          matchedTrigger: trigger
        };
      }
    }

    // 7. Partial word matching
    if (opts.enablePartial) {
      const partialResult = this.partialMatch(query, normalizedTrigger);
      if (partialResult.matched) {
        return {
          ...partialResult,
          matchedTrigger: trigger
        };
      }
    }

    return {
      matched: false,
      confidence: 0,
      matchedTrigger: null,
      matchType: 'none'
    };
  }

  /**
   * Hebrew-aware matching using tokenizer
   */
  private hebrewMatch(query: string, trigger: string): MatchResult {
    const queryTokens = hebrewTokenizer.tokenize(query);
    const triggerTokens = hebrewTokenizer.tokenize(trigger);

    if (queryTokens.hebrewTokens.length === 0 && triggerTokens.hebrewTokens.length === 0) {
      return { matched: false, confidence: 0, matchedTrigger: null, matchType: 'none' };
    }

    // Compare Hebrew roots
    const queryRoots = queryTokens.hebrewTokens.map(t => t.withoutPrefix);
    const triggerRoots = triggerTokens.hebrewTokens.map(t => t.withoutPrefix);

    let matches = 0;
    for (const qRoot of queryRoots) {
      for (const tRoot of triggerRoots) {
        if (qRoot === tRoot || hebrewTokenizer.hebrewWordsMatch(qRoot, tRoot)) {
          matches++;
          break;
        }
      }
    }

    const maxPossible = Math.max(queryRoots.length, triggerRoots.length);
    if (maxPossible === 0) {
      return { matched: false, confidence: 0, matchedTrigger: null, matchType: 'none' };
    }

    const confidence = matches / maxPossible;

    return {
      matched: confidence > 0.5,
      confidence: confidence * 0.85, // Slightly lower than exact match
      matchedTrigger: null,
      matchType: 'fuzzy',
      details: `Hebrew root match: ${matches}/${maxPossible}`
    };
  }

  /**
   * Word overlap matching
   */
  private wordOverlapMatch(query: string, trigger: string): MatchResult {
    const queryWords = this.getWords(query);
    const triggerWords = this.getWords(trigger);

    let matchedCount = 0;
    for (const qWord of queryWords) {
      for (const tWord of triggerWords) {
        if (qWord === tWord) {
          matchedCount++;
          break;
        }
      }
    }

    const maxWords = Math.max(queryWords.length, triggerWords.length);
    if (maxWords === 0) {
      return { matched: false, confidence: 0, matchedTrigger: null, matchType: 'none' };
    }

    const confidence = matchedCount / maxWords;

    return {
      matched: confidence > 0.4,
      confidence: confidence * 0.8,
      matchedTrigger: null,
      matchType: 'partial',
      details: `Word overlap: ${matchedCount}/${maxWords}`
    };
  }

  /**
   * Synonym matching
   */
  private synonymMatch(query: string, trigger: string): MatchResult {
    const queryWords = this.getWords(query);
    const triggerWords = this.getWords(trigger);

    let synonymMatches = 0;
    for (const qWord of queryWords) {
      const synonyms = this.synonymMap.get(qWord);
      if (synonyms) {
        for (const tWord of triggerWords) {
          if (synonyms.has(tWord)) {
            synonymMatches++;
            break;
          }
        }
      }
    }

    if (synonymMatches > 0) {
      const maxWords = Math.max(queryWords.length, triggerWords.length);
      const confidence = (synonymMatches / maxWords) * 0.75;

      return {
        matched: true,
        confidence,
        matchedTrigger: null,
        matchType: 'synonym',
        details: `Synonym matches: ${synonymMatches}`
      };
    }

    return { matched: false, confidence: 0, matchedTrigger: null, matchType: 'none' };
  }

  /**
   * Fuzzy matching using Levenshtein distance
   */
  private fuzzyMatch(query: string, trigger: string): MatchResult {
    const distance = this.levenshteinDistance(query, trigger);
    const maxLen = Math.max(query.length, trigger.length);

    if (maxLen === 0) {
      return { matched: false, confidence: 0, matchedTrigger: null, matchType: 'none' };
    }

    // Calculate similarity (1 - normalized distance)
    const similarity = 1 - (distance / maxLen);

    return {
      matched: similarity > 0.6,
      confidence: similarity * 0.7, // Lower weight for fuzzy matches
      matchedTrigger: null,
      matchType: 'fuzzy',
      details: `Levenshtein distance: ${distance}`
    };
  }

  /**
   * Partial word matching (prefix matching)
   */
  private partialMatch(query: string, trigger: string): MatchResult {
    const queryWords = this.getWords(query);
    const triggerWords = this.getWords(trigger);

    let partialMatches = 0;
    for (const qWord of queryWords) {
      if (qWord.length < 3) continue; // Skip very short words

      for (const tWord of triggerWords) {
        if (tWord.startsWith(qWord) || qWord.startsWith(tWord)) {
          partialMatches++;
          break;
        }
      }
    }

    if (partialMatches > 0) {
      const maxWords = Math.max(queryWords.length, triggerWords.length);
      const confidence = (partialMatches / maxWords) * 0.6;

      return {
        matched: true,
        confidence,
        matchedTrigger: null,
        matchType: 'partial',
        details: `Partial word matches: ${partialMatches}`
      };
    }

    return { matched: false, confidence: 0, matchedTrigger: null, matchType: 'none' };
  }

  /**
   * Calculate Levenshtein distance between two strings
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
   * Normalize text for matching
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[?!.,;:()[\]{}"']/g, '')
      .replace(/\s+/g, ' ');
  }

  /**
   * Get words from text
   */
  private getWords(text: string): string[] {
    return text.split(/\s+/).filter(w => w.length > 0);
  }

  /**
   * Add custom synonyms at runtime
   */
  addSynonyms(word: string, synonyms: string[]): void {
    if (!this.synonymMap.has(word)) {
      this.synonymMap.set(word, new Set());
    }

    for (const syn of synonyms) {
      this.synonymMap.get(word)!.add(syn);

      // Bidirectional
      if (!this.synonymMap.has(syn)) {
        this.synonymMap.set(syn, new Set());
      }
      this.synonymMap.get(syn)!.add(word);
    }
  }

  /**
   * Get all synonyms for a word
   */
  getSynonyms(word: string): string[] {
    const synonyms = this.synonymMap.get(word.toLowerCase());
    return synonyms ? Array.from(synonyms) : [];
  }
}

// ===== SINGLETON EXPORT =====

export const intentMatcher = new IntentMatcher();
