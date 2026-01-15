/**
 * Intent Tools - MCP tool definitions for intent recognition
 *
 * Tools:
 * - qlik_recognize_intent: Recognize intent from user query
 * - qlik_get_conversation_context: Get current conversation context
 * - qlik_set_user_context: Set user context (role, team, etc.)
 */

// ===== TYPE DEFINITION =====

export interface IntentToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
}

// ===== INTENT TOOLS DEFINITIONS =====

export const intentTools: IntentToolDefinition[] = [
  {
    name: 'qlik_recognize_intent',
    description: `Recognize intent from a natural language query (Hebrew or English).

🚀 **START HERE for any data question!**
This is the FIRST tool to call for questions about incidents, tickets, SLA, satisfaction.

**Mandatory Workflow:**
1. qlik_recognize_intent(query) → Get intent, entities, measure, prebuiltObject
2. CHECK: Does prebuiltObject exist in response?
   ├── YES → qlik_get_existing_kpis(objectKey) [FAST: ~500ms] ⭐ USE THIS!
   └── NO  → qlik_get_domain_schema → qlik_create_hypercube [SLOW: ~2000ms]

**Fixed App IDs (use directly):**
- sysaid-internal: a30ab30d-cf2a-41fa-86ef-cf4f189deecf
- sysaid-main: e2f1700e-98dc-4ac9-b483-ca4a0de183ce

**What it does:**
- Analyzes user query to determine intent
- Extracts entities (incident, request, technician, etc.)
- Detects time periods (today, this month, etc.)
- Identifies requested dimensions for drill-down
- Returns confidence score
- **IMPORTANT:** Returns prebuiltObject when an existing visualization matches the query

**Returns:**
- intent: Matched intent (status_overview, urgent_attention, etc.)
- confidence: Confidence score (0-1)
- entities: Extracted entities with types
- timePeriod: Detected time period
- dimension: Requested dimension for breakdown
- drillOptions: Available drill-down dimensions
- requiresTimePeriod: Whether measure requires time specification
- suggestedQueries: Follow-up queries
- **prebuiltObject**: If present, use qlik_get_existing_kpis(objectKey) - DO NOT use qlik_create_hypercube!
  - objectKey: Use this with qlik_get_existing_kpis (e.g., MTTR_PER_CATEGORY)
  - useInsteadOfHypercube: true = MUST use qlik_get_existing_kpis!
  - description: Why this object matches

**Pre-built Objects (use qlik_get_existing_kpis):**
| objectKey | Use For |
|-----------|---------|
| MTTR_PER_ADMIN_GROUP | Team performance, workload analysis |
| MTTR_PER_CATEGORY | Category breakdown, problem areas |
| INCIDENTS_VS_REQUESTS | Monthly trends, volume analysis |

**Intents:**
- status_overview: Current status summary
- urgent_attention: What needs immediate attention
- overnight_activity: What happened while away
- trend_comparison: Comparing periods
- workload_check: Team workload analysis
- my_work: Personal queue (requires user context)
- my_performance: Personal performance
- stuck_tickets: Tickets not progressing
- recurring_issues: Pattern detection
- why_question: Root cause exploration
- prediction_capacity: Forecasting
- customer_experience: CX and satisfaction

**Example:**
{ "query": "מה המצב?" }
→ { "intent": "status_overview", "confidence": 0.95, ... }

**Example with prebuiltObject:**
{ "query": "נתח ביצועי צוות" }
→ Response includes: "prebuiltObject": { "objectKey": "MTTR_PER_ADMIN_GROUP", "useInsteadOfHypercube": true }
→ CORRECT: qlik_get_existing_kpis({ objectKey: "MTTR_PER_ADMIN_GROUP" })
→ WRONG: qlik_create_hypercube(...) ❌`,
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language query in Hebrew or English'
        },
        sessionId: {
          type: 'string',
          description: 'Optional session ID for context continuity'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'qlik_get_conversation_context',
    description: `Get the current conversation context for a session.

**Returns:**
- sessionId: Current session ID
- userContext: User information (role, team, language)
- history: Recent query history
- activeFilters: Currently applied filters
- currentEntity: Last queried entity
- currentMeasure: Last queried measure
- currentDimension: Last queried dimension
- isFollowUp: Whether last query was a follow-up

**Use cases:**
- Understanding context for follow-up questions
- Checking what filters are active
- Verifying user role for personalized responses

**Example:**
{ "sessionId": "user-123" }
→ { "userContext": { "role": "manager", "team": "IT" }, ... }`,
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'Session ID (uses default if not provided)'
        }
      },
      required: []
    }
  },
  {
    name: 'qlik_set_user_context',
    description: `Set user context for personalized responses.

**Parameters:**
- userId: User identifier
- userName: Display name
- role: User role (technician, manager, team_lead, executive)
- team: Team name
- department: Department name
- language: Preferred language (he, en)

**Use cases:**
- Personalize "my tickets" queries
- Show role-appropriate insights
- Remember language preference

**Example:**
{ "userName": "דני", "role": "technician", "team": "Desktop Support" }`,
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'Session ID (uses default if not provided)'
        },
        userId: {
          type: 'string',
          description: 'User ID for filtering data'
        },
        userName: {
          type: 'string',
          description: 'User display name'
        },
        role: {
          type: 'string',
          enum: ['technician', 'manager', 'team_lead', 'executive', 'unknown'],
          description: 'User role'
        },
        team: {
          type: 'string',
          description: 'Team name'
        },
        department: {
          type: 'string',
          description: 'Department name'
        },
        language: {
          type: 'string',
          enum: ['he', 'en'],
          description: 'Preferred language'
        }
      },
      required: []
    }
  },
  {
    name: 'qlik_compose_response',
    description: `Compose an intelligent response based on intent and data.

**What it does:**
- Formats data according to intent type
- Adds proactive insights
- Suggests follow-up actions
- Translates to user's language
- Limits lists to top 10 with "others"

**Parameters:**
- intent: The recognized intent result
- data: The data to include in response
- sessionId: Session for context

**Returns:**
- answer: Formatted answer text
- insights: Proactive insights detected
- suggestedActions: Recommended next actions
- followUpQuestions: Suggested follow-up queries

**Example:**
{
  "intent": { "intent": "status_overview" },
  "data": { "value": 47, "breached": 3 }
}
→ { "answer": "🟢 יש 47 תקלות פתוחות. 3 חריגות SLA.", ... }`,
    inputSchema: {
      type: 'object',
      properties: {
        intent: {
          type: 'object',
          description: 'Intent result from qlik_recognize_intent'
        },
        data: {
          type: 'object',
          description: 'Data to format in response'
        },
        sessionId: {
          type: 'string',
          description: 'Session ID for context'
        }
      },
      required: ['intent', 'data']
    }
  },
  {
    name: 'qlik_detect_insights',
    description: `Detect insights and anomalies in data.

**What it does:**
- Detects anomalies (spikes, drops)
- Identifies trends
- Finds SLA breaches
- Spots distribution patterns
- Compares to benchmarks

**Parameters:**
- current: Current period data points
- previous: Previous period for comparison
- breakdown: Data breakdown by dimension
- slaData: SLA compliance data
- benchmarks: Team/industry benchmarks

**Returns:**
- Array of insights with:
  - type: anomaly, trend, breach, pattern, etc.
  - severity: critical, high, medium, low, info
  - title: Short description
  - description: Full explanation
  - suggestion: Recommended action

**Example:**
{
  "current": [{ "value": 150 }],
  "previous": [{ "value": 100 }],
  "slaData": { "met": 85, "breached": 15 }
}
→ [{ "type": "trend", "title": "Significant increase", "severity": "high" }, ...]`,
    inputSchema: {
      type: 'object',
      properties: {
        current: {
          type: 'array',
          items: { type: 'object' },
          description: 'Current period data points'
        },
        previous: {
          type: 'array',
          items: { type: 'object' },
          description: 'Previous period data points'
        },
        breakdown: {
          type: 'array',
          items: { type: 'object' },
          description: 'Data breakdown by dimension'
        },
        slaData: {
          type: 'object',
          properties: {
            met: { type: 'number' },
            breached: { type: 'number' },
            nearBreach: { type: 'number' }
          },
          description: 'SLA compliance data'
        },
        benchmarks: {
          type: 'object',
          properties: {
            teamAverage: { type: 'number' },
            industryAverage: { type: 'number' }
          },
          description: 'Benchmark values for comparison'
        }
      },
      required: []
    }
  },
  {
    name: 'qlik_suggest_actions',
    description: `Get suggested actions based on intent and data.

**What it does:**
- Suggests drill-down dimensions
- Recommends comparisons
- Identifies investigations needed
- Provides role-specific suggestions

**Parameters:**
- intent: The recognized intent
- data: Current data
- insights: Detected insights (optional)
- userRole: User's role for role-specific suggestions

**Returns:**
- Array of suggested actions with:
  - type: drill_down, compare, filter, investigate, etc.
  - priority: immediate, high, medium, low
  - title: Action title
  - description: What the action does
  - query: Follow-up query to execute

**Example:**
{
  "intent": { "intent": "status_overview", "drillOptions": ["category", "technician"] },
  "userRole": "manager"
}
→ [
  { "type": "drill_down", "title": "פירוט לפי קטגוריה", "query": "תראה לפי קטגוריה" },
  { "type": "investigate", "title": "בדוק עומס צוות", "query": "מה העומס של הצוות?" }
]`,
    inputSchema: {
      type: 'object',
      properties: {
        intent: {
          type: 'object',
          description: 'Intent result from qlik_recognize_intent'
        },
        data: {
          type: 'object',
          description: 'Current data'
        },
        insights: {
          type: 'array',
          items: { type: 'object' },
          description: 'Detected insights'
        },
        userRole: {
          type: 'string',
          enum: ['technician', 'manager', 'team_lead', 'executive'],
          description: 'User role for role-specific suggestions'
        }
      },
      required: ['intent']
    }
  },
  {
    name: 'qlik_add_to_history',
    description: `Add a query and result to conversation history.

**What it does:**
- Records query for context
- Stores recognized intent
- Saves result summary
- Updates current entity/measure/dimension

**Use cases:**
- Maintaining conversation context
- Enabling follow-up questions
- Tracking user patterns

**Example:**
{
  "query": "כמה תקלות פתוחות?",
  "intent": "count_query",
  "entity": "incident",
  "measure": "active_count",
  "resultSummary": "47 תקלות פתוחות"
}`,
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'Session ID'
        },
        query: {
          type: 'string',
          description: 'User query'
        },
        intent: {
          type: 'string',
          description: 'Recognized intent'
        },
        entity: {
          type: 'string',
          description: 'Entity type (incident, request, etc.)'
        },
        measure: {
          type: 'string',
          description: 'Measure name'
        },
        dimension: {
          type: 'string',
          description: 'Dimension for breakdown'
        },
        timePeriod: {
          type: 'string',
          description: 'Time period'
        },
        resultSummary: {
          type: 'string',
          description: 'Summary of result'
        }
      },
      required: ['query']
    }
  }
];

export default intentTools;
