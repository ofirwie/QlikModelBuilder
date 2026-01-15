/**
 * Action Suggester Service - Suggests follow-up actions based on context
 *
 * Capabilities:
 * - Suggest drill-down dimensions
 * - Recommend comparisons
 * - Identify investigations needed
 * - Provide role-specific suggestions
 *
 * TaskGuard: services-015
 */

import { Insight, InsightSeverity } from './insight-detector.js';

// ===== TYPE DEFINITIONS =====

export type ActionType = 'drill_down' | 'compare' | 'filter' | 'investigate' | 'export' | 'alert' | 'escalate';
export type ActionPriority = 'immediate' | 'high' | 'medium' | 'low';
export type UserRole = 'technician' | 'team_lead' | 'manager' | 'executive' | 'unknown';

export interface IntentInfo {
  intent: string;
  confidence?: number;
  entities?: string[];
  dimension?: string;
  drillOptions?: string[];
  timePeriod?: string;
}

export interface SuggestedAction {
  type: ActionType;
  priority: ActionPriority;
  title: string;
  titleHe: string;
  description: string;
  descriptionHe: string;
  query?: string;
  queryHe?: string;
  targetDimension?: string;
  targetMeasure?: string;
}

export interface SuggestionInput {
  intent: IntentInfo;
  data?: Record<string, any>;
  insights?: Insight[];
  userRole?: UserRole;
}

export interface SuggestionResult {
  actions: SuggestedAction[];
  hasImmediate: boolean;
  summary: string;
  summaryHe: string;
}

// ===== DIMENSION MAPPINGS =====

const DIMENSION_LABELS: Record<string, { en: string; he: string }> = {
  category: { en: 'category', he: 'קטגוריה' },
  Category: { en: 'category', he: 'קטגוריה' },
  sub_category: { en: 'sub-category', he: 'תת-קטגוריה' },
  assigned_user: { en: 'technician', he: 'טכנאי' },
  assigned_user_display_name: { en: 'technician', he: 'טכנאי' },
  technician: { en: 'technician', he: 'טכנאי' },
  priority: { en: 'priority', he: 'עדיפות' },
  urgency: { en: 'urgency', he: 'דחיפות' },
  status: { en: 'status', he: 'סטטוס' },
  status_class: { en: 'status', he: 'סטטוס' },
  requester: { en: 'requester', he: 'מבקש' },
  submit_user_display_name: { en: 'requester', he: 'מבקש' },
  source: { en: 'source', he: 'מקור' },
  admin_group: { en: 'team', he: 'צוות' },
  department: { en: 'department', he: 'מחלקה' },
  company: { en: 'company', he: 'חברה' },
  nps_group: { en: 'NPS group', he: 'קבוצת NPS' },
  NPS_Group: { en: 'NPS group', he: 'קבוצת NPS' }
};

// ===== ACTION SUGGESTER CLASS =====

export class ActionSuggester {
  /**
   * Generate suggested actions based on input
   */
  suggest(input: SuggestionInput): SuggestionResult {
    const actions: SuggestedAction[] = [];
    const role = input.userRole || 'unknown';

    // Add drill-down suggestions based on intent
    if (input.intent.drillOptions && input.intent.drillOptions.length > 0) {
      actions.push(...this.suggestDrillDowns(input.intent.drillOptions, input.intent.intent));
    }

    // Add comparison suggestions based on intent
    actions.push(...this.suggestComparisons(input.intent, input.data));

    // Add investigation suggestions based on insights
    if (input.insights && input.insights.length > 0) {
      actions.push(...this.suggestInvestigations(input.insights));
    }

    // Add role-specific suggestions
    actions.push(...this.suggestRoleSpecific(input.intent, role, input.data));

    // Add filter suggestions
    actions.push(...this.suggestFilters(input.intent, input.data));

    // Deduplicate by title
    const uniqueActions = this.deduplicateActions(actions);

    // Sort by priority
    const sortedActions = this.sortByPriority(uniqueActions);

    // Limit to top 5
    const limitedActions = sortedActions.slice(0, 5);

    const hasImmediate = limitedActions.some(a => a.priority === 'immediate');

    return {
      actions: limitedActions,
      hasImmediate,
      summary: this.generateSummary(limitedActions, 'en'),
      summaryHe: this.generateSummary(limitedActions, 'he')
    };
  }

  /**
   * Suggest drill-down actions
   */
  private suggestDrillDowns(drillOptions: string[], intent: string): SuggestedAction[] {
    const actions: SuggestedAction[] = [];

    // Take first 3 drill options
    const topOptions = drillOptions.slice(0, 3);

    for (const dimension of topOptions) {
      const label = DIMENSION_LABELS[dimension] || { en: dimension, he: dimension };

      actions.push({
        type: 'drill_down',
        priority: 'medium',
        title: `Breakdown by ${label.en}`,
        titleHe: `פירוט לפי ${label.he}`,
        description: `Show the distribution by ${label.en}`,
        descriptionHe: `הצג התפלגות לפי ${label.he}`,
        query: `show by ${label.en}`,
        queryHe: `תראה לפי ${label.he}`,
        targetDimension: dimension
      });
    }

    return actions;
  }

  /**
   * Suggest comparison actions
   */
  private suggestComparisons(intent: IntentInfo, data?: Record<string, any>): SuggestedAction[] {
    const actions: SuggestedAction[] = [];

    // Time-based comparisons
    if (!intent.timePeriod || intent.timePeriod === 'current_month') {
      actions.push({
        type: 'compare',
        priority: 'low',
        title: 'Compare to last month',
        titleHe: 'השווה לחודש שעבר',
        description: 'See how this compares to the previous month',
        descriptionHe: 'ראה איך זה מושווה לחודש הקודם',
        query: 'compared to last month',
        queryHe: 'לעומת חודש שעבר'
      });
    }

    if (!intent.timePeriod || intent.timePeriod !== 'current_year') {
      actions.push({
        type: 'compare',
        priority: 'low',
        title: 'Compare to last year',
        titleHe: 'השווה לשנה שעברה',
        description: 'See the year-over-year comparison',
        descriptionHe: 'ראה השוואה שנתית',
        query: 'compared to last year',
        queryHe: 'לעומת שנה שעברה'
      });
    }

    // If showing one entity, suggest comparing to another
    if (intent.entities && intent.entities.length === 1) {
      const entity = intent.entities[0];
      if (entity === 'incident') {
        actions.push({
          type: 'compare',
          priority: 'low',
          title: 'Compare to requests',
          titleHe: 'השווה לבקשות',
          description: 'See how incidents compare to service requests',
          descriptionHe: 'ראה איך תקלות מושוות לבקשות שירות',
          query: 'compare incidents to requests',
          queryHe: 'השווה תקלות לבקשות'
        });
      } else if (entity === 'request') {
        actions.push({
          type: 'compare',
          priority: 'low',
          title: 'Compare to incidents',
          titleHe: 'השווה לתקלות',
          description: 'See how requests compare to incidents',
          descriptionHe: 'ראה איך בקשות מושוות לתקלות',
          query: 'compare requests to incidents',
          queryHe: 'השווה בקשות לתקלות'
        });
      }
    }

    return actions;
  }

  /**
   * Suggest investigations based on insights
   */
  private suggestInvestigations(insights: Insight[]): SuggestedAction[] {
    const actions: SuggestedAction[] = [];

    for (const insight of insights) {
      if (insight.severity === 'critical') {
        actions.push({
          type: 'investigate',
          priority: 'immediate',
          title: `Investigate: ${insight.title}`,
          titleHe: `חקור: ${insight.titleHe}`,
          description: insight.suggestion || 'This requires immediate attention',
          descriptionHe: insight.suggestionHe || 'זה דורש תשומת לב מיידית',
          query: `show details for ${insight.title}`,
          queryHe: `הראה פרטים עבור ${insight.titleHe}`
        });
      } else if (insight.severity === 'high' && insight.type === 'breach') {
        actions.push({
          type: 'investigate',
          priority: 'high',
          title: 'Review SLA breaches',
          titleHe: 'בדוק חריגות SLA',
          description: 'Identify the root cause of SLA breaches',
          descriptionHe: 'זהה את סיבת השורש לחריגות SLA',
          query: 'show breached tickets',
          queryHe: 'הראה קריאות שחרגו'
        });
      } else if (insight.type === 'workload') {
        actions.push({
          type: 'investigate',
          priority: 'high',
          title: 'Review workload distribution',
          titleHe: 'בדוק חלוקת עומס',
          description: 'Analyze workload balance across the team',
          descriptionHe: 'נתח את איזון העומס בצוות',
          query: 'show workload by technician',
          queryHe: 'הראה עומס לפי טכנאי'
        });
      }
    }

    return actions;
  }

  /**
   * Suggest role-specific actions
   */
  private suggestRoleSpecific(intent: IntentInfo, role: UserRole, data?: Record<string, any>): SuggestedAction[] {
    const actions: SuggestedAction[] = [];

    switch (role) {
      case 'technician':
        if (intent.intent !== 'my_work') {
          actions.push({
            type: 'filter',
            priority: 'medium',
            title: 'Show my tickets',
            titleHe: 'הראה את הקריאות שלי',
            description: 'Focus on tickets assigned to you',
            descriptionHe: 'התמקד בקריאות שמוקצות לך',
            query: 'my tickets',
            queryHe: 'הקריאות שלי'
          });
        }
        if (intent.intent !== 'my_performance') {
          actions.push({
            type: 'drill_down',
            priority: 'low',
            title: 'Check my performance',
            titleHe: 'בדוק את הביצועים שלי',
            description: 'View your performance metrics',
            descriptionHe: 'צפה במדדי הביצועים שלך',
            query: 'my performance',
            queryHe: 'הביצועים שלי'
          });
        }
        break;

      case 'team_lead':
        actions.push({
          type: 'drill_down',
          priority: 'medium',
          title: 'Team workload',
          titleHe: 'עומס הצוות',
          description: "View your team's workload distribution",
          descriptionHe: 'צפה בחלוקת העומס של הצוות',
          query: 'team workload',
          queryHe: 'עומס הצוות'
        });
        break;

      case 'manager':
        actions.push({
          type: 'compare',
          priority: 'medium',
          title: 'Team comparison',
          titleHe: 'השוואת צוותים',
          description: 'Compare performance across teams',
          descriptionHe: 'השווה ביצועים בין צוותים',
          query: 'compare teams',
          queryHe: 'השווה צוותים'
        });
        if (intent.intent !== 'trend_comparison') {
          actions.push({
            type: 'compare',
            priority: 'medium',
            title: 'Show trends',
            titleHe: 'הצג מגמות',
            description: 'View trends over time',
            descriptionHe: 'צפה במגמות לאורך זמן',
            query: 'show trends',
            queryHe: 'הצג מגמות'
          });
        }
        break;

      case 'executive':
        actions.push({
          type: 'drill_down',
          priority: 'high',
          title: 'Executive summary',
          titleHe: 'סיכום הנהלה',
          description: 'High-level overview for executives',
          descriptionHe: 'סקירה כללית להנהלה',
          query: 'executive summary',
          queryHe: 'דוח הנהלה'
        });
        actions.push({
          type: 'export',
          priority: 'low',
          title: 'Export report',
          titleHe: 'ייצא דוח',
          description: 'Export data for presentation',
          descriptionHe: 'ייצא נתונים למצגת',
          query: 'export report',
          queryHe: 'ייצא דוח'
        });
        break;
    }

    return actions;
  }

  /**
   * Suggest filter actions
   */
  private suggestFilters(intent: IntentInfo, data?: Record<string, any>): SuggestedAction[] {
    const actions: SuggestedAction[] = [];

    // If not already filtered by urgency
    if (intent.intent !== 'urgent_attention') {
      actions.push({
        type: 'filter',
        priority: 'medium',
        title: 'Show urgent only',
        titleHe: 'הראה דחופים בלבד',
        description: 'Filter to show only urgent/high priority items',
        descriptionHe: 'סנן כדי להציג רק פריטים דחופים',
        query: 'urgent only',
        queryHe: 'רק דחופים'
      });
    }

    // If showing all, suggest filtering to open only
    if (!intent.entities?.includes('closed')) {
      actions.push({
        type: 'filter',
        priority: 'low',
        title: 'Show closed tickets',
        titleHe: 'הראה קריאות סגורות',
        description: 'View closed tickets for analysis',
        descriptionHe: 'צפה בקריאות סגורות לניתוח',
        query: 'closed tickets',
        queryHe: 'קריאות סגורות'
      });
    }

    return actions;
  }

  /**
   * Deduplicate actions by title
   */
  private deduplicateActions(actions: SuggestedAction[]): SuggestedAction[] {
    const seen = new Set<string>();
    return actions.filter(action => {
      const key = action.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Sort actions by priority
   */
  private sortByPriority(actions: SuggestedAction[]): SuggestedAction[] {
    const priorityOrder: Record<ActionPriority, number> = {
      immediate: 0,
      high: 1,
      medium: 2,
      low: 3
    };

    return [...actions].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }

  /**
   * Generate summary
   */
  private generateSummary(actions: SuggestedAction[], language: 'he' | 'en'): string {
    if (actions.length === 0) {
      return language === 'he' ? 'אין המלצות נוספות' : 'No additional recommendations';
    }

    const immediate = actions.filter(a => a.priority === 'immediate').length;
    const high = actions.filter(a => a.priority === 'high').length;

    if (language === 'he') {
      if (immediate > 0) {
        return `${actions.length} פעולות מומלצות, ${immediate} דורשות תשומת לב מיידית`;
      }
      return `${actions.length} פעולות מומלצות`;
    } else {
      if (immediate > 0) {
        return `${actions.length} suggested actions, ${immediate} require immediate attention`;
      }
      return `${actions.length} suggested actions`;
    }
  }

  /**
   * Get immediate actions only
   */
  getImmediateActions(input: SuggestionInput): SuggestedAction[] {
    const result = this.suggest(input);
    return result.actions.filter(a => a.priority === 'immediate');
  }

  /**
   * Get high priority actions
   */
  getHighPriorityActions(input: SuggestionInput): SuggestedAction[] {
    const result = this.suggest(input);
    return result.actions.filter(a => a.priority === 'immediate' || a.priority === 'high');
  }
}

// Export singleton instance
export const actionSuggester = new ActionSuggester();
