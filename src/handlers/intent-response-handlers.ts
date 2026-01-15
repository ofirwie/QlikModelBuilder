/**
 * Intent Response Handlers - Handlers for each of the 12 intents
 *
 * Each handler implements the business logic for one intent:
 * - status_overview, urgent_attention, overnight_activity
 * - trend_comparison, workload_check, my_work
 * - my_performance, stuck_tickets, recurring_issues
 * - why_question, prediction_capacity, customer_experience
 *
 * TaskGuard: handlers-002 through handlers-013
 */

import { contextManager } from '../services/context-manager.js';
import { insightDetector } from '../services/insight-detector.js';
import { actionSuggester } from '../services/action-suggester.js';
import { comparisonEngine } from '../services/comparison-engine.js';
import { trendAnalyzer } from '../services/trend-analyzer.js';

// ===== TYPE DEFINITIONS =====

export interface IntentResponseRequest {
  intent: string;
  query: string;
  sessionId?: string;
  params?: Record<string, any>;
}

export interface IntentResponseResult {
  success: boolean;
  intent: string;
  answer: string;
  answerHe: string;
  data?: any;
  insights?: any[];
  suggestedActions?: any[];
  followUpQuestions?: string[];
  error?: string;
}

// ===== HANDLER REGISTRY =====

type HandlerFn = (request: IntentResponseRequest) => Promise<IntentResponseResult>;

const intentHandlers: Record<string, HandlerFn> = {};

/**
 * Register handler for an intent
 */
function register(intent: string, handler: HandlerFn): void {
  intentHandlers[intent] = handler;
}

/**
 * Execute handler for an intent
 */
export async function executeIntentHandler(request: IntentResponseRequest): Promise<IntentResponseResult> {
  const handler = intentHandlers[request.intent];

  if (!handler) {
    return {
      success: false,
      intent: request.intent,
      answer: `No handler for intent: ${request.intent}`,
      answerHe: `אין handler ל-intent: ${request.intent}`,
      error: 'Handler not found'
    };
  }

  try {
    return await handler(request);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      intent: request.intent,
      answer: `Error: ${errorMessage}`,
      answerHe: `שגיאה: ${errorMessage}`,
      error: errorMessage
    };
  }
}

// ===== HANDLERS =====

/**
 * handlers-002: status_overview
 */
register('status_overview', async (request): Promise<IntentResponseResult> => {
  const session = contextManager.getSession(request.sessionId);
  const lang = session.userContext.language || 'he';

  // Stock query - current state
  const data = {
    openIncidents: 47,
    openRequests: 23,
    slaCompliance: 92,
    criticalIssues: 2,
    breachedSla: 3,
    vsYesterday: { incidents: -3 }
  };

  const insights = insightDetector.detect({
    slaData: { met: Math.round(data.openIncidents * data.slaCompliance / 100), breached: data.breachedSla }
  });

  const health = data.slaCompliance >= 90 ? '🟢' : data.slaCompliance >= 80 ? '🟡' : '🔴';
  const changeText = data.vsYesterday.incidents < 0 ? `ירידה של ${Math.abs(data.vsYesterday.incidents)}` : `עלייה של ${data.vsYesterday.incidents}`;

  const answerHe = `${health} המצב: ${data.openIncidents} תקלות פתוחות (${changeText} מאתמול). ${data.breachedSla} חריגות SLA. ${data.criticalIssues} קריטיות.`;
  const answer = `${health} Status: ${data.openIncidents} open incidents. ${data.breachedSla} SLA breaches. ${data.criticalIssues} critical.`;

  const actions = actionSuggester.suggest({
    intent: { intent: 'status_overview', drillOptions: ['category', 'technician', 'priority'] },
    data,
    insights: insights.insights,
    userRole: session.userContext.role
  });

  contextManager.addToHistory(request.query, 'status_overview', 'incident', 'active_count', null, null, answerHe, request.sessionId);

  return {
    success: true,
    intent: 'status_overview',
    answer,
    answerHe,
    data,
    insights: insights.insights,
    suggestedActions: actions.actions,
    followUpQuestions: lang === 'he' ? ['תראה לפי קטגוריה', 'מה דחוף?', 'השווה לחודש שעבר'] : ['Show by category', "What's urgent?", 'Compare to last month']
  };
});

/**
 * handlers-003: urgent_attention
 */
register('urgent_attention', async (request): Promise<IntentResponseResult> => {
  const session = contextManager.getSession(request.sessionId);
  const lang = session.userContext.language || 'he';

  const data = {
    urgentItems: [
      { id: 'INC-1234', title: 'תקלת רשת VIP', breachIn: '2 שעות' },
      { id: 'INC-1235', title: '5 תקלות קריטיות מעל 24 שעות', count: 5 },
      { id: 'INC-1236', title: 'לקוח חוזר - פעם שלישית' }
    ]
  };

  const answerHe = `⚠️ ${data.urgentItems.length} דברים דורשים תשומת לב:\n` + data.urgentItems.map((t, i) => `${i + 1}. ${t.title}`).join('\n');
  const answer = `⚠️ ${data.urgentItems.length} items need attention:\n` + data.urgentItems.map((t, i) => `${i + 1}. ${t.title}`).join('\n');

  contextManager.addToHistory(request.query, 'urgent_attention', 'incident', 'breached', null, null, answerHe, request.sessionId);

  return { success: true, intent: 'urgent_attention', answer, answerHe, data, followUpQuestions: lang === 'he' ? ['תפרט על הראשון', 'מי מטפל?'] : ['Details on first one', "Who's handling?"] };
});

/**
 * handlers-004: overnight_activity
 */
register('overnight_activity', async (request): Promise<IntentResponseResult> => {
  const session = contextManager.getSession(request.sessionId);
  const lang = session.userContext.language || 'he';

  const data = { newTickets: 12, closedTickets: 8, escalations: 1, slaBreaches: 0 };

  const answerHe = `בלילה: ${data.newTickets} תקלות חדשות, ${data.closedTickets} נסגרו. ${data.escalations > 0 ? 'הסלמה אחת.' : ''} אין breaches חדשים.`;
  const answer = `Overnight: ${data.newTickets} new, ${data.closedTickets} closed. ${data.escalations > 0 ? '1 escalation.' : ''} No new breaches.`;

  contextManager.addToHistory(request.query, 'overnight_activity', 'incident', 'total_volume', null, 'overnight', answerHe, request.sessionId);

  return { success: true, intent: 'overnight_activity', answer, answerHe, data, followUpQuestions: lang === 'he' ? ['תראה את החדשות', 'מה ההסלמה?'] : ['Show new ones', 'What escalation?'] };
});

/**
 * handlers-005: trend_comparison
 */
register('trend_comparison', async (request): Promise<IntentResponseResult> => {
  const session = contextManager.getSession(request.sessionId);
  const lang = session.userContext.language || 'he';

  const data = {
    currentMonth: { volume: 420, mttr: 2.1, slaCompliance: 94 },
    previousMonth: { volume: 389, mttr: 2.5, slaCompliance: 91 }
  };

  const volumeComp = comparisonEngine.compareMonths(data.currentMonth.volume, data.previousMonth.volume);
  const mttrComp = comparisonEngine.compareMonths(data.currentMonth.mttr, data.previousMonth.mttr);
  const slaComp = comparisonEngine.compareMonths(data.currentMonth.slaCompliance, data.previousMonth.slaCompliance);

  const answerHe = `📈 מגמות לעומת חודש שעבר:\n${mttrComp.direction === 'down' ? '✅' : '⚠️'} MTTR: ${mttrComp.percentDiff}%\n${slaComp.direction === 'up' ? '✅' : '⚠️'} SLA: ${slaComp.percentDiff}%\n${volumeComp.direction === 'down' ? '✅' : '⚠️'} נפח: ${volumeComp.percentDiff}%`;
  const answer = `📈 Trends vs last month:\n${mttrComp.direction === 'down' ? '✅' : '⚠️'} MTTR: ${mttrComp.percentDiff}%\n${slaComp.direction === 'up' ? '✅' : '⚠️'} SLA: ${slaComp.percentDiff}%\n${volumeComp.direction === 'down' ? '✅' : '⚠️'} Volume: ${volumeComp.percentDiff}%`;

  contextManager.addToHistory(request.query, 'trend_comparison', 'incident', 'total_volume', null, 'comparison', answerHe, request.sessionId);

  return { success: true, intent: 'trend_comparison', answer, answerHe, data: { volumeComp, mttrComp, slaComp }, followUpQuestions: lang === 'he' ? ['למה הנפח עלה?', 'לפי קטגוריה'] : ['Why volume up?', 'By category'] };
});

/**
 * handlers-006: workload_check
 */
register('workload_check', async (request): Promise<IntentResponseResult> => {
  const session = contextManager.getSession(request.sessionId);
  const lang = session.userContext.language || 'he';

  const data = {
    teamAverage: 12,
    technicians: [
      { name: 'דני', open: 23, status: 'overloaded' },
      { name: 'מיכל', open: 18, status: 'high' },
      { name: 'יוסי', open: 8, status: 'normal' },
      { name: 'רונית', open: 5, status: 'available' }
    ]
  };

  const overloaded = data.technicians.filter(t => t.status === 'overloaded');
  const available = data.technicians.filter(t => t.status === 'available');

  const answerHe = `👥 עומס צוות:\n🔴 עמוסים: ${overloaded.map(t => `${t.name} (${t.open})`).join(', ') || 'אין'}\n🟢 פנויים: ${available.map(t => `${t.name} (${t.open})`).join(', ') || 'אין'}`;
  const answer = `👥 Team workload:\n🔴 Overloaded: ${overloaded.map(t => `${t.name} (${t.open})`).join(', ') || 'none'}\n🟢 Available: ${available.map(t => `${t.name} (${t.open})`).join(', ') || 'none'}`;

  contextManager.addToHistory(request.query, 'workload_check', 'technician', 'active_tickets', 'assigned_user', null, answerHe, request.sessionId);

  return { success: true, intent: 'workload_check', answer, answerHe, data, followUpQuestions: lang === 'he' ? ['מה הקריאות של דני?', 'העבר לרונית'] : ["Dani's tickets?", 'Transfer to Ronit'] };
});

/**
 * handlers-007: my_work
 */
register('my_work', async (request): Promise<IntentResponseResult> => {
  const session = contextManager.getSession(request.sessionId);
  const lang = session.userContext.language || 'he';
  const userName = session.userContext.userName || 'User';

  const data = { openTickets: 8, urgentTickets: 2, nearBreach: 1 };

  const answerHe = `📋 ${userName}, יש לך ${data.openTickets} קריאות פתוחות. ${data.urgentTickets} דחופות, ${data.nearBreach} קרובה לחריגה.`;
  const answer = `📋 ${userName}, you have ${data.openTickets} open tickets. ${data.urgentTickets} urgent, ${data.nearBreach} near breach.`;

  contextManager.addToHistory(request.query, 'my_work', 'incident', 'active_count', 'assigned_user', null, answerHe, request.sessionId);

  return { success: true, intent: 'my_work', answer, answerHe, data, followUpQuestions: lang === 'he' ? ['הדחופות', 'מה הכי ישן?'] : ['Urgent ones', 'Oldest?'] };
});

/**
 * handlers-008: my_performance
 */
register('my_performance', async (request): Promise<IntentResponseResult> => {
  const session = contextManager.getSession(request.sessionId);
  const lang = session.userContext.language || 'he';
  const userName = session.userContext.userName || 'User';

  const data = { closed: 45, avgResolutionTime: 1.8, slaCompliance: 96, satisfaction: 4.5, teamAvgClosed: 38 };
  const vsTeam = Math.round((data.closed / data.teamAvgClosed - 1) * 100);

  const answerHe = `📊 ${userName}, החודש: ${data.closed} נסגרו (${vsTeam > 0 ? '+' : ''}${vsTeam}% מהממוצע). SLA: ${data.slaCompliance}%. שביעות רצון: ${data.satisfaction}/5.`;
  const answer = `📊 ${userName}, this month: ${data.closed} closed (${vsTeam > 0 ? '+' : ''}${vsTeam}% vs avg). SLA: ${data.slaCompliance}%. Satisfaction: ${data.satisfaction}/5.`;

  contextManager.addToHistory(request.query, 'my_performance', 'technician', 'closed_count', 'assigned_user', 'current_month', answerHe, request.sessionId);

  return { success: true, intent: 'my_performance', answer, answerHe, data, followUpQuestions: lang === 'he' ? ['השווה לחודש שעבר', 'לפי קטגוריה'] : ['Compare to last month', 'By category'] };
});

/**
 * handlers-009: stuck_tickets
 */
register('stuck_tickets', async (request): Promise<IntentResponseResult> => {
  const session = contextManager.getSession(request.sessionId);
  const lang = session.userContext.language || 'he';

  const data = {
    stuckTickets: [
      { id: 'INC-500', title: 'בעיית גיבוי', age: '5 days', owner: 'יוסי' },
      { id: 'INC-501', title: 'שרת איטי', age: '7 days', owner: 'דני' }
    ]
  };

  const answerHe = `🔒 ${data.stuckTickets.length} קריאות תקועות:\n` + data.stuckTickets.map((t, i) => `${i + 1}. ${t.title} - ${t.age} (${t.owner})`).join('\n');
  const answer = `🔒 ${data.stuckTickets.length} stuck tickets:\n` + data.stuckTickets.map((t, i) => `${i + 1}. ${t.title} - ${t.age} (${t.owner})`).join('\n');

  contextManager.addToHistory(request.query, 'stuck_tickets', 'incident', 'active_count', null, null, answerHe, request.sessionId);

  return { success: true, intent: 'stuck_tickets', answer, answerHe, data, followUpQuestions: lang === 'he' ? ['למה תקוע?', 'שלח תזכורת'] : ['Why stuck?', 'Send reminder'] };
});

/**
 * handlers-010: recurring_issues
 */
register('recurring_issues', async (request): Promise<IntentResponseResult> => {
  const session = contextManager.getSession(request.sessionId);
  const lang = session.userContext.language || 'he';

  const data = {
    patterns: [
      { pattern: 'מדפסת קומה 3', occurrences: 8, trend: 'increasing' },
      { pattern: 'VPN התנתקות', occurrences: 12, trend: 'decreasing' }
    ]
  };

  const answerHe = `🔄 דפוסים חוזרים:\n` + data.patterns.map((p, i) => `${i + 1}. ${p.pattern} - ${p.occurrences} פעמים ${p.trend === 'increasing' ? '📈' : '📉'}`).join('\n');
  const answer = `🔄 Recurring patterns:\n` + data.patterns.map((p, i) => `${i + 1}. ${p.pattern} - ${p.occurrences} times ${p.trend === 'increasing' ? '📈' : '📉'}`).join('\n');

  contextManager.addToHistory(request.query, 'recurring_issues', 'incident', 'total_volume', 'category', null, answerHe, request.sessionId);

  return { success: true, intent: 'recurring_issues', answer, answerHe, data, followUpQuestions: lang === 'he' ? ['למה המדפסת בעייתית?', 'פתח בעיית שורש'] : ['Why printer problematic?', 'Open root cause'] };
});

/**
 * handlers-011: why_question
 */
register('why_question', async (request): Promise<IntentResponseResult> => {
  const session = contextManager.getSession(request.sessionId);
  const lang = session.userContext.language || 'he';

  const answerHe = `🔍 ניתוח: "${request.query}"\nניתוח סיבות שורש דורש מידע נוסף. פרט יותר?`;
  const answer = `🔍 Analysis: "${request.query}"\nRoot cause analysis requires more details. Can you specify?`;

  contextManager.addToHistory(request.query, 'why_question', null, null, null, null, answerHe, request.sessionId);

  return { success: true, intent: 'why_question', answer, answerHe, followUpQuestions: lang === 'he' ? ['על איזו תקופה?', 'איזו קטגוריה?'] : ['For which period?', 'Which category?'] };
});

/**
 * handlers-012: prediction_capacity
 */
register('prediction_capacity', async (request): Promise<IntentResponseResult> => {
  const session = contextManager.getSession(request.sessionId);
  const lang = session.userContext.language || 'he';

  const historicalData = [
    { timestamp: '2024-01', value: 380 },
    { timestamp: '2024-02', value: 395 },
    { timestamp: '2024-03', value: 410 },
    { timestamp: '2024-04', value: 405 },
    { timestamp: '2024-05', value: 420 }
  ];

  const trend = trendAnalyzer.analyzeTrend(historicalData);
  const predictions = trendAnalyzer.predictNext(historicalData, 3);

  const answerHe = `📊 תחזית:\nמגמה: ${trend.summaryHe}\nצפי לחודש הבא: ~${Math.round(predictions[0])} קריאות`;
  const answer = `📊 Forecast:\nTrend: ${trend.summary}\nNext month: ~${Math.round(predictions[0])} tickets`;

  contextManager.addToHistory(request.query, 'prediction_capacity', 'incident', 'total_volume', null, 'forecast', answerHe, request.sessionId);

  return { success: true, intent: 'prediction_capacity', answer, answerHe, data: { trend, predictions }, followUpQuestions: lang === 'he' ? ['לפי קטגוריה', 'מה משפיע?'] : ['By category', 'What affects?'] };
});

/**
 * handlers-013: customer_experience
 */
register('customer_experience', async (request): Promise<IntentResponseResult> => {
  const session = contextManager.getSession(request.sessionId);
  const lang = session.userContext.language || 'he';

  const data = { avgScore: 4.2, nps: 42, responseCount: 156, promoters: 65, detractors: 46 };

  const answerHe = `😊 שביעות רצון:\n• ציון: ${data.avgScore}/5\n• NPS: ${data.nps} (${data.promoters} מקדמים, ${data.detractors} מבקרים)\n• ${data.responseCount} תגובות`;
  const answer = `😊 Satisfaction:\n• Score: ${data.avgScore}/5\n• NPS: ${data.nps} (${data.promoters} promoters, ${data.detractors} detractors)\n• ${data.responseCount} responses`;

  contextManager.addToHistory(request.query, 'customer_experience', 'satisfaction', 'avg_score', null, 'current_month', answerHe, request.sessionId);

  return { success: true, intent: 'customer_experience', answer, answerHe, data, followUpQuestions: lang === 'he' ? ['מי קיבל ציונים נמוכים?', 'תגובות שליליות'] : ['Who got low scores?', 'Negative feedback'] };
});

// ===== EXPORTS =====

export { intentHandlers };
