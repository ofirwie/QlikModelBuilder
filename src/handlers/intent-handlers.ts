/**
 * Intent Handlers - Request handlers for intent recognition tools
 *
 * Handles:
 * - qlik_recognize_intent
 * - qlik_get_conversation_context
 * - qlik_set_user_context
 * - qlik_add_to_history
 *
 * Note: Other intent tools (qlik_compose_response, qlik_detect_insights, etc.)
 * will be added when their dependent services are implemented.
 *
 * TaskGuard: tools-005, tools-007
 */

import { intentEngine, IntentResult } from '../services/intent-engine.js';
import { hebrewTokenizer } from '../services/hebrew-tokenizer.js';
import { intentMatcher } from '../services/intent-matcher.js';
import { contextManager, UserRole, Language } from '../services/context-manager.js';
import { insightDetector, DetectionInput, Insight } from '../services/insight-detector.js';
import { actionSuggester, SuggestionInput, IntentInfo } from '../services/action-suggester.js';
import { responseComposer, ComposerInput, IntentInfo as ComposerIntentInfo } from '../services/response-composer.js';
import {
  generateQlikLink,
  getDrillDownLinks,
  EXISTING_APP_OBJECTS
} from '../services/app/visualization-service.js';

// ===== TYPE DEFINITIONS =====

export interface IntentHandlerRequest {
  params: Record<string, any>;
}

export interface IntentHandlerResponse {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

// ===== HANDLERS =====

/**
 * Handle qlik_recognize_intent tool
 */
export async function handleRecognizeIntent(
  request: IntentHandlerRequest
): Promise<IntentHandlerResponse> {
  try {
    const { query, sessionId } = request.params;

    if (!query || typeof query !== 'string') {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          success: false,
          error: 'Query parameter is required'
        }, null, 2) }],
        isError: true
      };
    }

    // Recognize intent using the engine
    const result = intentEngine.recognize(query);

    // Get additional info from tokenizer for language detection
    const tokenResult = hebrewTokenizer.tokenize(query);

    // Build response
    const response: any = {
      success: true,
      intent: result.intent,
      confidence: result.confidence,
      matchedTrigger: result.matchedTrigger,
      matchType: result.matchedTrigger ?
        (query.toLowerCase().includes(result.matchedTrigger.toLowerCase()) ? 'contains' : 'fuzzy') :
        null,
      entities: result.entities,
      timePeriod: result.timePeriod,
      dimension: result.dimension,
      filters: result.filters,
      responseType: result.responseType,
      components: result.components,
      language: tokenResult.dominantLanguage,
      wordCount: tokenResult.wordCount,
      drillOptions: result.drillOptions || [],
      requiresTimePeriod: result.requiresTimePeriod || false,
      suggestedQueries: getSuggestedQueries(result.intent),
      availableIntents: intentEngine.getAvailableIntents()
    };

    // Add pre-built object recommendation if available
    if (result.prebuiltObject) {
      response.prebuiltObject = result.prebuiltObject;
      response.dataSourceRecommendation = {
        type: 'prebuilt',
        tool: 'qlik_get_object_data',
        objectKey: result.prebuiltObject.objectKey,
        objectId: result.prebuiltObject.objectId,
        reason: result.prebuiltObject.description,
        note: 'Use qlik_get_object_data instead of qlik_create_hypercube for ~75% faster response'
      };

      // Add smart links for drill-down
      const objectKey = result.prebuiltObject.objectKey as keyof typeof EXISTING_APP_OBJECTS;
      const mainLink = generateQlikLink(objectKey);
      const drillLinks = getDrillDownLinks(objectKey);

      response.links = {
        current: mainLink ? {
          url: mainLink.url,
          title: mainLink.title,
          titleHe: mainLink.titleHe
        } : null,
        drillDown: drillLinks.map(link => ({
          url: link.url,
          title: link.title,
          titleHe: link.titleHe,
          objectKey: link.objectKey
        }))
      };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(response, null, 2) }]
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text', text: JSON.stringify({
        success: false,
        error: errorMessage
      }, null, 2) }],
      isError: true
    };
  }
}

/**
 * Get suggested follow-up queries based on intent
 */
function getSuggestedQueries(intent: string | null): string[] {
  if (!intent) return [];

  const suggestions: Record<string, string[]> = {
    'status_overview': [
      'תראה לפי קטגוריה',
      'מה דחוף?',
      'מה קרה בלילה?'
    ],
    'urgent_attention': [
      'תפרט את החריגות',
      'מי מטפל בזה?',
      'מה המצב הכללי?'
    ],
    'overnight_activity': [
      'תראה פירוט',
      'מה דורש תשומת לב?',
      'מה העומס היום?'
    ],
    'trend_comparison': [
      'לעומת השבוע שעבר',
      'תראה לפי חודש',
      'מה השתפר?'
    ],
    'workload_check': [
      'מי הכי עמוס?',
      'תראה לפי טכנאי',
      'מה המצב הכללי?'
    ],
    'my_work': [
      'מה דחוף?',
      'מה הביצועים שלי?',
      'מה סגרתי החודש?'
    ],
    'stuck_tickets': [
      'תראה פירוט',
      'מי אחראי?',
      'מה הסיבה?'
    ]
  };

  return suggestions[intent] || [];
}

/**
 * Handle qlik_get_conversation_context tool
 * TaskGuard: tools-007
 */
export async function handleGetConversationContext(
  request: IntentHandlerRequest
): Promise<IntentHandlerResponse> {
  try {
    const { sessionId } = request.params;

    const session = contextManager.getSession(sessionId);
    const filterDescription = contextManager.getFilterDescription(sessionId);
    const qlikExpression = contextManager.toQlikSetExpression(sessionId);

    const response = {
      success: true,
      sessionId: session.sessionId,
      userContext: session.userContext,
      history: session.history.map(h => ({
        query: h.query,
        intent: h.intent,
        entity: h.entity,
        timestamp: h.timestamp
      })),
      activeFilters: session.activeFilters,
      filterDescription,
      qlikSetExpression: qlikExpression || null,
      currentEntity: session.currentEntity,
      currentMeasure: session.currentMeasure,
      currentDimension: session.currentDimension,
      isFollowUp: session.isFollowUp,
      historyCount: session.history.length,
      filterCount: contextManager.getFilterCount(sessionId)
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(response, null, 2) }]
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text', text: JSON.stringify({
        success: false,
        error: errorMessage
      }, null, 2) }],
      isError: true
    };
  }
}

/**
 * Handle qlik_set_user_context tool
 * TaskGuard: tools-007
 */
export async function handleSetUserContext(
  request: IntentHandlerRequest
): Promise<IntentHandlerResponse> {
  try {
    const { sessionId, userId, userName, role, team, department, language } = request.params;

    // Build context update
    const contextUpdate: {
      userId?: string;
      userName?: string;
      role?: UserRole;
      team?: string;
      department?: string;
      language?: Language;
    } = {};

    if (userId) contextUpdate.userId = userId;
    if (userName) contextUpdate.userName = userName;
    if (role && ['technician', 'manager', 'team_lead', 'executive', 'unknown'].includes(role)) {
      contextUpdate.role = role as UserRole;
    }
    if (team) contextUpdate.team = team;
    if (department) contextUpdate.department = department;
    if (language && ['he', 'en'].includes(language)) {
      contextUpdate.language = language as Language;
    }

    // Apply update
    contextManager.setUserContext(contextUpdate, sessionId);

    // Get updated context
    const updatedContext = contextManager.getUserContext(sessionId);
    const greeting = contextManager.getRoleGreeting(sessionId);
    const roleBasedFilter = contextManager.getRoleBasedFilter(sessionId);

    const response = {
      success: true,
      message: 'User context updated',
      userContext: updatedContext,
      greeting,
      roleBasedFilter: roleBasedFilter || 'No automatic filter for this role'
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(response, null, 2) }]
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text', text: JSON.stringify({
        success: false,
        error: errorMessage
      }, null, 2) }],
      isError: true
    };
  }
}

/**
 * Handle qlik_compose_response tool
 * TaskGuard: services-026
 */
export async function handleComposeResponse(
  request: IntentHandlerRequest
): Promise<IntentHandlerResponse> {
  try {
    const { intent, data, sessionId } = request.params;

    if (!intent || typeof intent !== 'object') {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          success: false,
          error: 'Intent parameter is required'
        }, null, 2) }],
        isError: true
      };
    }

    if (!data || typeof data !== 'object') {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          success: false,
          error: 'Data parameter is required'
        }, null, 2) }],
        isError: true
      };
    }

    // Get language from session context or default to Hebrew
    const session = contextManager.getSession(sessionId);
    const language = session.userContext?.language || 'he';

    // Build composer input
    const composerInput: ComposerInput = {
      intent: intent as ComposerIntentInfo,
      data,
      language,
      sessionId
    };

    // Compose the response
    const result = responseComposer.compose(composerInput);

    const response = {
      success: true,
      answer: result.answer,
      answerHe: result.answerHe,
      answerEn: result.answerEn,
      insights: result.insights,
      suggestedActions: result.suggestedActions,
      followUpQuestions: result.followUpQuestions,
      hasData: result.hasData,
      itemCount: result.itemCount,
      language
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(response, null, 2) }]
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text', text: JSON.stringify({
        success: false,
        error: errorMessage
      }, null, 2) }],
      isError: true
    };
  }
}

/**
 * Handle qlik_detect_insights tool
 * TaskGuard: services-014
 */
export async function handleDetectInsights(
  request: IntentHandlerRequest
): Promise<IntentHandlerResponse> {
  try {
    const { current, previous, breakdown, slaData, benchmarks } = request.params;

    // Build detection input
    const input: DetectionInput = {};

    if (current && Array.isArray(current)) {
      input.current = current;
    }
    if (previous && Array.isArray(previous)) {
      input.previous = previous;
    }
    if (breakdown && Array.isArray(breakdown)) {
      input.breakdown = breakdown;
    }
    if (slaData && typeof slaData === 'object') {
      input.slaData = slaData;
    }
    if (benchmarks && typeof benchmarks === 'object') {
      input.benchmarks = benchmarks;
    }

    // Check if we have any data to analyze
    const hasData = input.current || input.previous || input.breakdown || input.slaData;
    if (!hasData) {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          success: true,
          insights: [],
          hasAnomalies: false,
          hasCritical: false,
          summary: 'No data provided for analysis',
          summaryHe: 'לא סופקו נתונים לניתוח'
        }, null, 2) }]
      };
    }

    // Detect insights
    const result = insightDetector.detect(input);

    const response = {
      success: true,
      insights: result.insights,
      hasAnomalies: result.hasAnomalies,
      hasCritical: result.hasCritical,
      summary: result.summary,
      summaryHe: result.summaryHe,
      insightCount: result.insights.length,
      criticalCount: result.insights.filter(i => i.severity === 'critical').length,
      highCount: result.insights.filter(i => i.severity === 'high').length
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(response, null, 2) }]
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text', text: JSON.stringify({
        success: false,
        error: errorMessage
      }, null, 2) }],
      isError: true
    };
  }
}

/**
 * Handle qlik_suggest_actions tool
 * TaskGuard: services-015
 */
export async function handleSuggestActions(
  request: IntentHandlerRequest
): Promise<IntentHandlerResponse> {
  try {
    const { intent, data, insights, userRole } = request.params;

    if (!intent || typeof intent !== 'object') {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          success: false,
          error: 'Intent parameter is required'
        }, null, 2) }],
        isError: true
      };
    }

    // Build suggestion input
    const input: SuggestionInput = {
      intent: intent as IntentInfo
    };

    if (data && typeof data === 'object') {
      input.data = data;
    }
    if (insights && Array.isArray(insights)) {
      input.insights = insights as Insight[];
    }
    if (userRole && typeof userRole === 'string') {
      input.userRole = userRole as 'technician' | 'team_lead' | 'manager' | 'executive' | 'unknown';
    }

    // Get suggestions
    const result = actionSuggester.suggest(input);

    const response = {
      success: true,
      actions: result.actions,
      hasImmediate: result.hasImmediate,
      summary: result.summary,
      summaryHe: result.summaryHe,
      actionCount: result.actions.length,
      immediateCount: result.actions.filter(a => a.priority === 'immediate').length,
      highCount: result.actions.filter(a => a.priority === 'high').length
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(response, null, 2) }]
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text', text: JSON.stringify({
        success: false,
        error: errorMessage
      }, null, 2) }],
      isError: true
    };
  }
}

/**
 * Handle qlik_add_to_history tool
 * TaskGuard: tools-007
 */
export async function handleAddToHistory(
  request: IntentHandlerRequest
): Promise<IntentHandlerResponse> {
  try {
    const { sessionId, query, intent, entity, measure, dimension, timePeriod, resultSummary } = request.params;

    if (!query || typeof query !== 'string') {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          success: false,
          error: 'Query parameter is required'
        }, null, 2) }],
        isError: true
      };
    }

    // Add to history
    contextManager.addToHistory(
      query,
      intent || null,
      entity || null,
      measure || null,
      dimension || null,
      timePeriod || null,
      resultSummary,
      sessionId
    );

    // Get updated history info
    const history = contextManager.getHistory(sessionId);
    const suggestedFollowUps = contextManager.getSuggestedFollowUps(sessionId);

    const response = {
      success: true,
      message: 'Query added to history',
      historyCount: history.length,
      currentContext: {
        entity: contextManager.getSession(sessionId).currentEntity,
        measure: contextManager.getSession(sessionId).currentMeasure,
        dimension: contextManager.getSession(sessionId).currentDimension
      },
      suggestedFollowUps
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(response, null, 2) }]
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text', text: JSON.stringify({
        success: false,
        error: errorMessage
      }, null, 2) }],
      isError: true
    };
  }
}
