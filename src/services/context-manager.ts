/**
 * Context Manager - Session and conversation context for Semantic Layer V4
 *
 * Manages:
 * - User context (role, team, language preference)
 * - Conversation history (last N queries)
 * - Active filters and selections
 * - Follow-up detection
 *
 * TaskGuard: services-009
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const log = logger.child({ service: 'ContextManager' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to hebrew-aliases.json
const ALIASES_PATH = path.join(__dirname, '../../docs/knowledge/hebrew-aliases.json');

// ===== TYPE DEFINITIONS =====

export type UserRole = 'technician' | 'team_lead' | 'manager' | 'executive' | 'unknown';
export type Language = 'he' | 'en';

export interface UserContext {
  userId?: string;
  userName?: string;
  role: UserRole;
  team?: string;
  department?: string;
  language: Language;
}

export interface QueryHistoryItem {
  query: string;
  intent: string | null;
  entity: string | null;
  measure: string | null;
  dimension: string | null;
  timePeriod: string | null;
  timestamp: Date;
  resultSummary?: string;
}

export interface ActiveFilters {
  entity?: string;
  status?: string;
  timePeriod?: string;
  dimensions: Record<string, string[]>;
  customFilters: Record<string, string>;
}

export interface ConversationContext {
  sessionId: string;
  userContext: UserContext;
  history: QueryHistoryItem[];
  activeFilters: ActiveFilters;
  currentEntity: string | null;
  currentMeasure: string | null;
  currentDimension: string | null;
  isFollowUp: boolean;
  lastQueryTime: Date | null;
}

export interface HebrewAliases {
  version: string;
  fields: Record<string, {
    hebrew: string[];
    category: string;
    values?: Record<string, string[]>;
  }>;
  synonymGroups: Record<string, string[]>;
  commonQueries: Record<string, any>;
}

// ===== CONTEXT MANAGER CLASS =====

export class ContextManager {
  private sessions: Map<string, ConversationContext> = new Map();
  private aliases: HebrewAliases | null = null;
  private defaultSessionId = 'default';
  private maxHistorySize = 5;
  private followUpTimeoutMs = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.loadAliases();
  }

  /**
   * Load hebrew-aliases.json
   */
  private loadAliases(): void {
    try {
      if (fs.existsSync(ALIASES_PATH)) {
        const content = fs.readFileSync(ALIASES_PATH, 'utf-8');
        this.aliases = JSON.parse(content);
        log.warn('[ContextManager] Loaded aliases v' + this.aliases?.version);
      } else {
        log.warn('[ContextManager] aliases file not found:', ALIASES_PATH);
      }
    } catch (error) {
      log.warn('[ContextManager] Failed to load aliases:', error);
    }
  }

  /**
   * Get or create session context
   */
  getSession(sessionId?: string): ConversationContext {
    const id = sessionId || this.defaultSessionId;

    if (!this.sessions.has(id)) {
      this.sessions.set(id, this.createNewSession(id));
    }

    return this.sessions.get(id)!;
  }

  /**
   * Create a new session
   */
  private createNewSession(sessionId: string): ConversationContext {
    return {
      sessionId,
      userContext: {
        role: 'unknown',
        language: 'he' // Default to Hebrew
      },
      history: [],
      activeFilters: {
        dimensions: {},
        customFilters: {}
      },
      currentEntity: null,
      currentMeasure: null,
      currentDimension: null,
      isFollowUp: false,
      lastQueryTime: null
    };
  }

  /**
   * Set user context for a session
   */
  setUserContext(context: Partial<UserContext>, sessionId?: string): void {
    const session = this.getSession(sessionId);
    session.userContext = {
      ...session.userContext,
      ...context
    };
  }

  /**
   * Get user context
   */
  getUserContext(sessionId?: string): UserContext {
    return this.getSession(sessionId).userContext;
  }

  /**
   * Add query to history
   */
  addToHistory(
    query: string,
    intent: string | null,
    entity: string | null,
    measure: string | null,
    dimension: string | null,
    timePeriod: string | null,
    resultSummary?: string,
    sessionId?: string
  ): void {
    const session = this.getSession(sessionId);

    // Add to history
    session.history.push({
      query,
      intent,
      entity,
      measure,
      dimension,
      timePeriod,
      timestamp: new Date(),
      resultSummary
    });

    // Trim history if too long
    if (session.history.length > this.maxHistorySize) {
      session.history.shift();
    }

    // Update current context
    if (entity) session.currentEntity = entity;
    if (measure) session.currentMeasure = measure;
    if (dimension) session.currentDimension = dimension;
    session.lastQueryTime = new Date();
  }

  /**
   * Detect if query is a follow-up to previous query
   */
  isFollowUpQuery(query: string, sessionId?: string): boolean {
    const session = this.getSession(sessionId);

    // No history = not a follow-up
    if (session.history.length === 0) {
      return false;
    }

    // Check time since last query
    if (session.lastQueryTime) {
      const timeSinceLastQuery = Date.now() - session.lastQueryTime.getTime();
      if (timeSinceLastQuery > this.followUpTimeoutMs) {
        return false; // Too long since last query
      }
    }

    const lowerQuery = query.toLowerCase();

    // Hebrew follow-up indicators
    const hebrewFollowUp = [
      'ומה עם', 'ואת', 'ואיפה', 'ואיך', 'תראה גם',
      'תפרט', 'פרט', 'תרחיב', 'הרחב',
      'עוד', 'גם', 'בנוסף',
      'אבל', 'ואם',
      'לפי', 'מחולק לפי'
    ];

    // English follow-up indicators
    const englishFollowUp = [
      'and what about', 'what about', 'also', 'show me',
      'drill down', 'break down', 'by',
      'more', 'details', 'elaborate',
      'but', 'what if'
    ];

    const allIndicators = [...hebrewFollowUp, ...englishFollowUp];

    for (const indicator of allIndicators) {
      if (lowerQuery.startsWith(indicator) || lowerQuery.includes(indicator)) {
        session.isFollowUp = true;
        return true;
      }
    }

    // Check if query is very short (likely a dimension name)
    if (query.trim().length < 15 && !query.includes('?')) {
      // Check if it's a known dimension
      const isDimension = this.isDimensionReference(query);
      if (isDimension) {
        session.isFollowUp = true;
        return true;
      }
    }

    session.isFollowUp = false;
    return false;
  }

  /**
   * Check if text references a known dimension
   */
  private isDimensionReference(text: string): boolean {
    if (!this.aliases) return false;

    const lowerText = text.toLowerCase().trim();

    // Check synonym groups
    const dimensionGroups = ['technician', 'customer'];
    for (const group of dimensionGroups) {
      const synonyms = this.aliases.synonymGroups[group] || [];
      if (synonyms.some(s => lowerText.includes(s))) {
        return true;
      }
    }

    // Check field aliases
    const dimensionFields = ['Category', 'sub_category', 'assigned_user_display_name', 'priority', 'urgency', 'source'];
    for (const field of dimensionFields) {
      const fieldDef = this.aliases.fields[field];
      if (fieldDef?.hebrew.some(h => lowerText.includes(h))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get context from previous query for follow-ups
   */
  getContextFromPrevious(sessionId?: string): {
    entity: string | null;
    measure: string | null;
    dimension: string | null;
    timePeriod: string | null;
  } {
    const session = this.getSession(sessionId);

    if (session.history.length === 0) {
      return {
        entity: null,
        measure: null,
        dimension: null,
        timePeriod: null
      };
    }

    const lastQuery = session.history[session.history.length - 1];

    return {
      entity: lastQuery.entity || session.currentEntity,
      measure: lastQuery.measure || session.currentMeasure,
      dimension: lastQuery.dimension || session.currentDimension,
      timePeriod: lastQuery.timePeriod
    };
  }

  /**
   * Set active filter
   */
  setFilter(
    filterType: 'entity' | 'status' | 'timePeriod',
    value: string,
    sessionId?: string
  ): void {
    const session = this.getSession(sessionId);
    session.activeFilters[filterType] = value;
  }

  /**
   * Set dimension filter
   */
  setDimensionFilter(
    dimension: string,
    values: string[],
    sessionId?: string
  ): void {
    const session = this.getSession(sessionId);
    session.activeFilters.dimensions[dimension] = values;
  }

  /**
   * Get active filters
   */
  getActiveFilters(sessionId?: string): ActiveFilters {
    return this.getSession(sessionId).activeFilters;
  }

  /**
   * Clear all filters
   */
  clearFilters(sessionId?: string): void {
    const session = this.getSession(sessionId);
    session.activeFilters = {
      dimensions: {},
      customFilters: {}
    };
  }

  /**
   * Clear session
   */
  clearSession(sessionId?: string): void {
    const id = sessionId || this.defaultSessionId;
    this.sessions.delete(id);
  }

  /**
   * Get conversation history
   */
  getHistory(sessionId?: string): QueryHistoryItem[] {
    return this.getSession(sessionId).history;
  }

  /**
   * Get last N queries
   */
  getRecentQueries(count: number = 3, sessionId?: string): QueryHistoryItem[] {
    const history = this.getHistory(sessionId);
    return history.slice(-count);
  }

  /**
   * Translate Hebrew term using aliases
   */
  translateTerm(hebrewTerm: string): string | null {
    if (!this.aliases) return null;

    const lowerTerm = hebrewTerm.toLowerCase().trim();

    // Check each field's Hebrew aliases
    for (const [fieldName, fieldDef] of Object.entries(this.aliases.fields)) {
      for (const alias of fieldDef.hebrew) {
        if (alias.toLowerCase() === lowerTerm || lowerTerm.includes(alias.toLowerCase())) {
          return fieldName;
        }
      }
    }

    return null;
  }

  /**
   * Get synonyms for a term
   */
  getSynonyms(term: string): string[] {
    if (!this.aliases) return [];

    const lowerTerm = term.toLowerCase();

    for (const [, synonyms] of Object.entries(this.aliases.synonymGroups)) {
      if (synonyms.some(s => s.toLowerCase() === lowerTerm)) {
        return synonyms;
      }
    }

    return [];
  }

  // ===== USER ROLE DETECTION (services-010) =====

  /**
   * Detect user role from query text
   *
   * Analyzes the query to determine if user is asking from perspective of:
   * - technician: "שלי", "my tickets", personal queue
   * - team_lead: "הצוות שלי", "my team", team metrics
   * - manager: "הצוות", "מחלקה", department view
   * - executive: "דוח הנהלה", "executive report", high-level summary
   */
  detectUserRole(query: string): UserRole {
    const lowerQuery = query.toLowerCase();

    // Executive patterns (check first - most specific)
    const executivePatterns = [
      'דוח הנהלה', 'דו"ח הנהלה', 'executive', 'summary for management',
      'סיכום להנהלה', 'דשבורד מנהלים', 'תמונת מצב כללית', 'high level',
      'אסטרטגי', 'strategic'
    ];
    if (executivePatterns.some(p => lowerQuery.includes(p))) {
      return 'executive';
    }

    // Team lead patterns (personal team)
    const teamLeadPatterns = [
      'הצוות שלי', 'הקבוצה שלי', 'my team', 'האנשים שלי',
      'הטכנאים שלי', 'העובדים שלי', 'under me', 'תחתי',
      'אני מנהל', 'i manage'
    ];
    if (teamLeadPatterns.some(p => lowerQuery.includes(p))) {
      return 'team_lead';
    }

    // Manager patterns (department/general team)
    const managerPatterns = [
      'הצוות', 'הקבוצה', 'המחלקה', 'the team', 'the department',
      'כל הטכנאים', 'all technicians', 'עומס הצוות', 'team workload',
      'חלוקת עבודה', 'work distribution', 'ביצועי הצוות', 'team performance'
    ];
    if (managerPatterns.some(p => lowerQuery.includes(p))) {
      return 'manager';
    }

    // Technician patterns (personal)
    const technicianPatterns = [
      'שלי', 'לי', 'אני', 'my ', 'mine', ' me',
      'העבודה שלי', 'הקריאות שלי', 'התקלות שלי',
      'my tickets', 'my work', 'assigned to me',
      'מה יש לי', 'what do i have'
    ];
    if (technicianPatterns.some(p => lowerQuery.includes(p))) {
      return 'technician';
    }

    return 'unknown';
  }

  /**
   * Update user role based on detected role from query
   * Only updates if confidence is high (detected role != unknown)
   */
  updateRoleFromQuery(query: string, sessionId?: string): UserRole {
    const detectedRole = this.detectUserRole(query);

    if (detectedRole !== 'unknown') {
      const session = this.getSession(sessionId);
      // Only update if current role is unknown or detected role is more specific
      if (session.userContext.role === 'unknown') {
        session.userContext.role = detectedRole;
      }
    }

    return detectedRole;
  }

  /**
   * Get role-appropriate greeting
   */
  getRoleGreeting(sessionId?: string): string {
    const role = this.getUserContext(sessionId).role;
    const lang = this.getUserContext(sessionId).language;

    const greetings: Record<UserRole, { he: string; en: string }> = {
      technician: {
        he: 'הנה מה שמחכה לך',
        en: 'Here is what is waiting for you'
      },
      team_lead: {
        he: 'הנה סקירת הצוות שלך',
        en: 'Here is your team overview'
      },
      manager: {
        he: 'הנה סקירת המחלקה',
        en: 'Here is the department overview'
      },
      executive: {
        he: 'הנה סיכום מנהלים',
        en: 'Here is the executive summary'
      },
      unknown: {
        he: 'הנה המצב',
        en: 'Here is the status'
      }
    };

    return lang === 'he' ? greetings[role].he : greetings[role].en;
  }

  /**
   * Check if query is personal (about user's own work)
   */
  isPersonalQuery(query: string): boolean {
    const role = this.detectUserRole(query);
    return role === 'technician';
  }

  /**
   * Check if query is about team (team lead perspective)
   */
  isTeamQuery(query: string): boolean {
    const role = this.detectUserRole(query);
    return role === 'team_lead' || role === 'manager';
  }

  /**
   * Get default filter based on role
   */
  getRoleBasedFilter(sessionId?: string): Record<string, string> | null {
    const session = this.getSession(sessionId);
    const { role, userId, team } = session.userContext;

    switch (role) {
      case 'technician':
        if (userId) {
          return { assigned_user: userId };
        }
        break;
      case 'team_lead':
        if (team) {
          return { admin_group: team };
        }
        break;
      case 'manager':
        if (team) {
          return { admin_group: team };
        }
        break;
      case 'executive':
        // No filter - see everything
        return null;
    }

    return null;
  }

  // ===== CONVERSATION MEMORY (services-011) =====

  /**
   * Get merged context from query and previous history
   * Carries over entity, measure, dimension, and time period if not specified in current query
   */
  getMergedContext(
    currentEntity: string | null,
    currentMeasure: string | null,
    currentDimension: string | null,
    currentTimePeriod: string | null,
    sessionId?: string
  ): {
    entity: string | null;
    measure: string | null;
    dimension: string | null;
    timePeriod: string | null;
    source: 'current' | 'previous' | 'mixed';
  } {
    const previous = this.getContextFromPrevious(sessionId);

    const entity = currentEntity || previous.entity;
    const measure = currentMeasure || previous.measure;
    const dimension = currentDimension || previous.dimension;
    const timePeriod = currentTimePeriod || previous.timePeriod;

    // Determine source
    let source: 'current' | 'previous' | 'mixed' = 'current';
    if (!currentEntity && previous.entity) {
      source = currentMeasure || currentDimension || currentTimePeriod ? 'mixed' : 'previous';
    }

    return { entity, measure, dimension, timePeriod, source };
  }

  /**
   * Extract dimension request from follow-up query
   * Handles queries like "לפי קטגוריה", "break down by technician"
   */
  extractFollowUpDimension(query: string): string | null {
    const lowerQuery = query.toLowerCase();

    // Hebrew patterns
    const hebrewPatterns: Record<string, string> = {
      'לפי קטגוריה': 'Category',
      'לפי תת-קטגוריה': 'sub_category',
      'לפי תת קטגוריה': 'sub_category',
      'לפי טכנאי': 'assigned_user_display_name',
      'לפי מטפל': 'assigned_user_display_name',
      'לפי נציג': 'assigned_user_display_name',
      'לפי עדיפות': 'priority',
      'לפי דחיפות': 'urgency',
      'לפי מקור': 'source',
      'לפי סטטוס': 'status',
      'לפי חודש': 'Request_Month',
      'לפי שנה': 'Request_Year',
      'לפי לקוח': 'submit_user_display_name',
      'לפי פותח': 'submit_user_display_name',
      'לפי צוות': 'admin_group',
      'לפי קבוצה': 'admin_group'
    };

    // English patterns
    const englishPatterns: Record<string, string> = {
      'by category': 'Category',
      'by subcategory': 'sub_category',
      'by sub-category': 'sub_category',
      'by technician': 'assigned_user_display_name',
      'by assignee': 'assigned_user_display_name',
      'by agent': 'assigned_user_display_name',
      'by priority': 'priority',
      'by urgency': 'urgency',
      'by source': 'source',
      'by status': 'status',
      'by month': 'Request_Month',
      'by year': 'Request_Year',
      'by requester': 'submit_user_display_name',
      'by customer': 'submit_user_display_name',
      'by team': 'admin_group',
      'by group': 'admin_group'
    };

    const allPatterns = { ...hebrewPatterns, ...englishPatterns };

    for (const [pattern, dimension] of Object.entries(allPatterns)) {
      if (lowerQuery.includes(pattern)) {
        return dimension;
      }
    }

    return null;
  }

  /**
   * Summarize conversation for context window
   * Returns a compact summary of the conversation
   */
  getConversationSummary(sessionId?: string): string {
    const session = this.getSession(sessionId);
    const history = session.history;

    if (history.length === 0) {
      return 'No previous conversation.';
    }

    const summaries = history.map((item, index) => {
      const parts = [];
      if (item.intent) parts.push(`intent: ${item.intent}`);
      if (item.entity) parts.push(`entity: ${item.entity}`);
      if (item.measure) parts.push(`measure: ${item.measure}`);
      if (item.timePeriod) parts.push(`period: ${item.timePeriod}`);
      if (item.resultSummary) parts.push(`result: ${item.resultSummary}`);

      return `[${index + 1}] "${item.query}" → ${parts.join(', ') || 'general query'}`;
    });

    return summaries.join('\n');
  }

  /**
   * Check if current query continues a topic from history
   */
  isContinuingTopic(query: string, sessionId?: string): boolean {
    const session = this.getSession(sessionId);

    if (session.history.length === 0) {
      return false;
    }

    const lastQuery = session.history[session.history.length - 1];
    const lowerQuery = query.toLowerCase();

    // Check if entity from last query is mentioned
    if (lastQuery.entity) {
      const entityAliases: Record<string, string[]> = {
        incident: ['תקלות', 'תקלה', 'incidents', 'ticket'],
        request: ['בקשות', 'בקשה', 'requests'],
        satisfaction: ['שביעות רצון', 'satisfaction', 'nps'],
        sla: ['sla', 'חריגות'],
        technician: ['טכנאי', 'מטפל', 'technician']
      };

      const aliases = entityAliases[lastQuery.entity] || [];
      if (aliases.some(a => lowerQuery.includes(a))) {
        return true;
      }
    }

    // Check for "same" indicators
    const sameIndicators = ['אותו דבר', 'אותם', 'גם', 'עוד', 'same', 'also', 'too'];
    if (sameIndicators.some(i => lowerQuery.includes(i))) {
      return true;
    }

    return false;
  }

  /**
   * Get suggested follow-up questions based on current context
   */
  getSuggestedFollowUps(sessionId?: string): string[] {
    const session = this.getSession(sessionId);
    const suggestions: string[] = [];

    const lastQuery = session.history[session.history.length - 1];
    if (!lastQuery) {
      return ['מה המצב?', 'מה דחוף?', 'כמה תקלות פתוחות?'];
    }

    // Based on entity
    if (lastQuery.entity === 'incident') {
      suggestions.push('תראה לפי קטגוריה');
      suggestions.push('מי הטכנאי הכי עמוס?');
      suggestions.push('כמה חריגות SLA?');
    } else if (lastQuery.entity === 'request') {
      suggestions.push('תראה לפי מקור');
      suggestions.push('מה הזמן הממוצע?');
    } else if (lastQuery.entity === 'satisfaction') {
      suggestions.push('תראה לפי טכנאי');
      suggestions.push('מה ה-NPS?');
    }

    // Based on measure
    if (lastQuery.measure === 'active_count') {
      suggestions.push('תשווה לחודש שעבר');
      suggestions.push('מה הטרנד?');
    }

    // If dimension was used, suggest drill-down
    if (lastQuery.dimension) {
      suggestions.push(`תרחיב את ${lastQuery.dimension}`);
    }

    return suggestions.slice(0, 3);
  }

  /**
   * Reset conversation but keep user context
   */
  resetConversation(sessionId?: string): void {
    const session = this.getSession(sessionId);
    const userContext = { ...session.userContext };

    // Clear conversation-specific data
    session.history = [];
    session.activeFilters = {
      dimensions: {},
      customFilters: {}
    };
    session.currentEntity = null;
    session.currentMeasure = null;
    session.currentDimension = null;
    session.isFollowUp = false;
    session.lastQueryTime = null;

    // Restore user context
    session.userContext = userContext;
  }

  // ===== FILTER STATE TRACKING (services-012) =====

  /**
   * Apply multiple filters at once
   */
  applyFilters(
    filters: {
      entity?: string;
      status?: string;
      timePeriod?: string;
      dimensions?: Record<string, string[]>;
    },
    sessionId?: string
  ): void {
    const session = this.getSession(sessionId);

    if (filters.entity) {
      session.activeFilters.entity = filters.entity;
    }
    if (filters.status) {
      session.activeFilters.status = filters.status;
    }
    if (filters.timePeriod) {
      session.activeFilters.timePeriod = filters.timePeriod;
    }
    if (filters.dimensions) {
      for (const [dim, values] of Object.entries(filters.dimensions)) {
        session.activeFilters.dimensions[dim] = values;
      }
    }
  }

  /**
   * Remove a specific filter
   */
  removeFilter(
    filterType: 'entity' | 'status' | 'timePeriod' | 'dimension',
    dimensionName?: string,
    sessionId?: string
  ): void {
    const session = this.getSession(sessionId);

    switch (filterType) {
      case 'entity':
        delete session.activeFilters.entity;
        break;
      case 'status':
        delete session.activeFilters.status;
        break;
      case 'timePeriod':
        delete session.activeFilters.timePeriod;
        break;
      case 'dimension':
        if (dimensionName) {
          delete session.activeFilters.dimensions[dimensionName];
        }
        break;
    }
  }

  /**
   * Get filter count
   */
  getFilterCount(sessionId?: string): number {
    const filters = this.getActiveFilters(sessionId);
    let count = 0;

    if (filters.entity) count++;
    if (filters.status) count++;
    if (filters.timePeriod) count++;
    count += Object.keys(filters.dimensions).length;
    count += Object.keys(filters.customFilters).length;

    return count;
  }

  /**
   * Get human-readable filter description
   */
  getFilterDescription(sessionId?: string): string {
    const filters = this.getActiveFilters(sessionId);
    const lang = this.getUserContext(sessionId).language;
    const parts: string[] = [];

    // Entity filter
    if (filters.entity) {
      const entityNames: Record<string, { he: string; en: string }> = {
        incident: { he: 'תקלות', en: 'Incidents' },
        request: { he: 'בקשות', en: 'Requests' },
        satisfaction: { he: 'שביעות רצון', en: 'Satisfaction' },
        sla: { he: 'SLA', en: 'SLA' },
        technician: { he: 'טכנאים', en: 'Technicians' }
      };
      const name = entityNames[filters.entity];
      parts.push(lang === 'he' ? name?.he || filters.entity : name?.en || filters.entity);
    }

    // Status filter
    if (filters.status) {
      const statusNames: Record<string, { he: string; en: string }> = {
        Open: { he: 'פתוחות', en: 'Open' },
        Closed: { he: 'סגורות', en: 'Closed' }
      };
      const name = statusNames[filters.status];
      parts.push(lang === 'he' ? name?.he || filters.status : name?.en || filters.status);
    }

    // Time period filter
    if (filters.timePeriod) {
      const periodNames: Record<string, { he: string; en: string }> = {
        this_month: { he: 'החודש', en: 'This month' },
        last_month: { he: 'חודש שעבר', en: 'Last month' },
        this_year: { he: 'השנה', en: 'This year' },
        today: { he: 'היום', en: 'Today' },
        yesterday: { he: 'אתמול', en: 'Yesterday' }
      };
      const name = periodNames[filters.timePeriod];
      parts.push(lang === 'he' ? name?.he || filters.timePeriod : name?.en || filters.timePeriod);
    }

    // Dimension filters
    for (const [dim, values] of Object.entries(filters.dimensions)) {
      if (values.length > 0) {
        const dimLabel = lang === 'he' ? this.getDimensionHebrewName(dim) : dim;
        parts.push(`${dimLabel}: ${values.join(', ')}`);
      }
    }

    if (parts.length === 0) {
      return lang === 'he' ? 'ללא סינון' : 'No filters';
    }

    return parts.join(' | ');
  }

  /**
   * Get Hebrew name for dimension
   */
  private getDimensionHebrewName(dimension: string): string {
    const names: Record<string, string> = {
      Category: 'קטגוריה',
      sub_category: 'תת-קטגוריה',
      assigned_user_display_name: 'טכנאי',
      submit_user_display_name: 'פותח',
      priority: 'עדיפות',
      urgency: 'דחיפות',
      source: 'מקור',
      status: 'סטטוס',
      admin_group: 'צוות'
    };
    return names[dimension] || dimension;
  }

  /**
   * Generate Qlik set expression from active filters
   */
  toQlikSetExpression(sessionId?: string): string {
    const filters = this.getActiveFilters(sessionId);
    const parts: string[] = [];

    // Entity filter (sr_type_index)
    if (filters.entity) {
      const entityIndexes: Record<string, string> = {
        incident: '1',
        request: '10'
      };
      const index = entityIndexes[filters.entity];
      if (index) {
        parts.push(`sr_type_index={${index}}`);
      }
    }

    // Status filter
    if (filters.status) {
      parts.push(`status_class={'${filters.status}'}`);
    }

    // Time period filter
    if (filters.timePeriod) {
      const periodFilters: Record<string, string> = {
        this_month: "Request_Current_Month={'1'}",
        last_month: "Request_LastMonth={'1'}",
        this_year: "Request_Current_Year={'1'}"
      };
      const filter = periodFilters[filters.timePeriod];
      if (filter) {
        parts.push(filter);
      }
    }

    // Dimension filters
    for (const [dim, values] of Object.entries(filters.dimensions)) {
      if (values.length > 0) {
        const quotedValues = values.map(v => `'${v}'`).join(',');
        parts.push(`${dim}={${quotedValues}}`);
      }
    }

    if (parts.length === 0) {
      return '';
    }

    return `<${parts.join(',')}>`;
  }

  /**
   * Check if a filter is active
   */
  hasFilter(
    filterType: 'entity' | 'status' | 'timePeriod' | 'dimension' | 'any',
    dimensionName?: string,
    sessionId?: string
  ): boolean {
    const filters = this.getActiveFilters(sessionId);

    switch (filterType) {
      case 'entity':
        return !!filters.entity;
      case 'status':
        return !!filters.status;
      case 'timePeriod':
        return !!filters.timePeriod;
      case 'dimension':
        if (dimensionName) {
          return !!filters.dimensions[dimensionName];
        }
        return Object.keys(filters.dimensions).length > 0;
      case 'any':
        return this.getFilterCount(sessionId) > 0;
      default:
        return false;
    }
  }

  /**
   * Clone current filters (for comparison operations)
   */
  cloneFilters(sessionId?: string): ActiveFilters {
    const filters = this.getActiveFilters(sessionId);
    return {
      entity: filters.entity,
      status: filters.status,
      timePeriod: filters.timePeriod,
      dimensions: { ...filters.dimensions },
      customFilters: { ...filters.customFilters }
    };
  }
}

// ===== SINGLETON EXPORT =====

export const contextManager = new ContextManager();
