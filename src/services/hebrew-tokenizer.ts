/**
 * Hebrew Tokenizer - Text processing for Hebrew language
 *
 * Handles:
 * - Hebrew prefix removal (ה, ב, ל, מ, ו, כ, ש)
 * - Text tokenization
 * - Text normalization
 *
 * TaskGuard: services-004
 */

// ===== HEBREW PREFIXES =====

/**
 * Common Hebrew prefixes that attach to words
 * These are removed during tokenization to find root words
 */
export const HEBREW_PREFIXES = ['ה', 'ב', 'ל', 'מ', 'ו', 'כ', 'ש'] as const;

/**
 * Compound prefixes (two letters)
 * Order matters: check longer prefixes first
 */
export const HEBREW_COMPOUND_PREFIXES = [
  'וה', 'ול', 'וב', 'ומ', 'וכ', 'וש',  // vav + prefix
  'שה', 'של', 'שב', 'שמ', 'שכ',        // she + prefix
  'כש', 'לכ', 'מה', 'בה'               // other combinations
] as const;

// ===== TYPE DEFINITIONS =====

export interface TokenizedWord {
  original: string;
  normalized: string;
  withoutPrefix: string;
  prefix: string | null;
  isHebrew: boolean;
}

export interface TokenizationResult {
  originalText: string;
  normalizedText: string;
  tokens: TokenizedWord[];
  hebrewTokens: TokenizedWord[];
  englishTokens: TokenizedWord[];
  wordCount: number;
  dominantLanguage: 'hebrew' | 'english' | 'mixed';
}

// ===== HEBREW TOKENIZER CLASS =====

export class HebrewTokenizer {
  private prefixes: Set<string>;
  private compoundPrefixes: string[];

  constructor() {
    this.prefixes = new Set(HEBREW_PREFIXES);
    // Sort compound prefixes by length (longest first)
    this.compoundPrefixes = [...HEBREW_COMPOUND_PREFIXES].sort((a, b) => b.length - a.length);
  }

  /**
   * Tokenize text into individual words with Hebrew processing
   */
  tokenize(text: string): TokenizationResult {
    const normalizedText = this.normalizeText(text);

    // Split on whitespace and punctuation, keep only non-empty tokens
    const rawTokens = normalizedText
      .split(/[\s,.!?;:()\[\]{}"']+/)
      .filter(t => t.length > 0);

    const tokens: TokenizedWord[] = rawTokens.map(word => this.processWord(word));

    const hebrewTokens = tokens.filter(t => t.isHebrew);
    const englishTokens = tokens.filter(t => !t.isHebrew);

    // Determine dominant language
    let dominantLanguage: 'hebrew' | 'english' | 'mixed';
    if (hebrewTokens.length === 0 && englishTokens.length === 0) {
      dominantLanguage = 'mixed';
    } else if (hebrewTokens.length === 0) {
      dominantLanguage = 'english';
    } else if (englishTokens.length === 0) {
      dominantLanguage = 'hebrew';
    } else {
      // More than 60% determines dominance
      const hebrewRatio = hebrewTokens.length / tokens.length;
      dominantLanguage = hebrewRatio > 0.6 ? 'hebrew' : hebrewRatio < 0.4 ? 'english' : 'mixed';
    }

    return {
      originalText: text,
      normalizedText,
      tokens,
      hebrewTokens,
      englishTokens,
      wordCount: tokens.length,
      dominantLanguage
    };
  }

  /**
   * Process a single word - detect language, remove prefix if Hebrew
   */
  private processWord(word: string): TokenizedWord {
    const normalized = word.toLowerCase();
    const isHebrew = this.isHebrewWord(word);

    if (!isHebrew) {
      return {
        original: word,
        normalized,
        withoutPrefix: normalized,
        prefix: null,
        isHebrew: false
      };
    }

    // For Hebrew words, try to remove prefix
    const { root, prefix } = this.removePrefix(word);

    return {
      original: word,
      normalized: word, // Hebrew doesn't need lowercasing
      withoutPrefix: root,
      prefix,
      isHebrew: true
    };
  }

  /**
   * Check if a word is primarily Hebrew
   */
  isHebrewWord(word: string): boolean {
    // Hebrew Unicode range: \u0590-\u05FF
    const hebrewChars = (word.match(/[\u0590-\u05FF]/g) || []).length;
    const totalChars = word.replace(/[\s\d]/g, '').length;

    if (totalChars === 0) return false;

    // More than 50% Hebrew characters means it's a Hebrew word
    return hebrewChars / totalChars > 0.5;
  }

  /**
   * Remove Hebrew prefix from word
   * Returns the root word and the removed prefix
   */
  removePrefix(word: string): { root: string; prefix: string | null } {
    // Don't remove prefix from very short words (3 chars or less)
    if (word.length <= 3) {
      return { root: word, prefix: null };
    }

    // Try compound prefixes first (longer ones)
    for (const prefix of this.compoundPrefixes) {
      if (word.startsWith(prefix) && word.length > prefix.length + 1) {
        return {
          root: word.slice(prefix.length),
          prefix
        };
      }
    }

    // Try single prefixes
    const firstChar = word[0];
    if (this.prefixes.has(firstChar) && word.length > 2) {
      return {
        root: word.slice(1),
        prefix: firstChar
      };
    }

    return { root: word, prefix: null };
  }

  /**
   * Normalize text - clean up whitespace, standardize characters
   */
  normalizeText(text: string): string {
    return text
      .trim()
      // Normalize Unicode (NFC form)
      .normalize('NFC')
      // Replace multiple whitespace with single space
      .replace(/\s+/g, ' ')
      // Remove zero-width characters
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      // Normalize quotes
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      // Normalize dashes
      .replace(/[–—]/g, '-');
  }

  /**
   * Get all possible root forms of a Hebrew word
   * (useful for fuzzy matching)
   */
  getRootForms(word: string): string[] {
    const forms: Set<string> = new Set();
    forms.add(word);

    if (!this.isHebrewWord(word)) {
      return [word];
    }

    // Add form without prefix
    const { root, prefix } = this.removePrefix(word);
    if (prefix) {
      forms.add(root);
    }

    // For each possible prefix, try adding it back
    // (helps match "תקלות" with "התקלות")
    for (const p of HEBREW_PREFIXES) {
      if (!word.startsWith(p)) {
        forms.add(p + word);
      }
    }

    return Array.from(forms);
  }

  /**
   * Check if two Hebrew words match (considering prefixes)
   */
  hebrewWordsMatch(word1: string, word2: string): boolean {
    // Direct match
    if (word1 === word2) return true;

    // Compare roots
    const { root: root1 } = this.removePrefix(word1);
    const { root: root2 } = this.removePrefix(word2);

    if (root1 === root2) return true;

    // Check if one is prefix + other
    for (const prefix of HEBREW_PREFIXES) {
      if (word1 === prefix + word2 || word2 === prefix + word1) {
        return true;
      }
    }

    for (const prefix of this.compoundPrefixes) {
      if (word1 === prefix + word2 || word2 === prefix + word1) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract Hebrew words from text (with prefix removal)
   */
  extractHebrewWords(text: string): string[] {
    const result = this.tokenize(text);
    return result.hebrewTokens.map(t => t.withoutPrefix);
  }

  /**
   * Detect if text is primarily Hebrew
   */
  isHebrewText(text: string): boolean {
    const result = this.tokenize(text);
    return result.dominantLanguage === 'hebrew';
  }
}

// ===== SINGLETON EXPORT =====

export const hebrewTokenizer = new HebrewTokenizer();
