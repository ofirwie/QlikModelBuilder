/**
 * Tool definitions for miscellaneous operations (NL queries, bulk operations, etc.)
 */

export const MISC_TOOLS = {
  qlik_insight_advisor: {
    name: 'qlik_insight_advisor',
    description: `⚠️ DEPRECATED - DO NOT USE THIS TOOL ⚠️

**Use these tools instead:**
1. qlik_recognize_intent - Understand user query (Hebrew/English)
2. qlik_get_domain_schema - Get entity measures and dimensions
3. qlik_create_hypercube - Query data with dimensions + measures
4. qlik_evaluate_expression - Calculate single measures

**Why not use Insight Advisor:**
- Unreliable results
- Requires extra API calls
- Doesn't support Hebrew
- Our semantic layer is smarter

**Correct workflow:**
1. qlik_recognize_intent → Get entity, measure type, dimension
2. qlik_get_domain_schema → Get correct expressions
3. qlik_create_hypercube → Execute query with known App ID

**App IDs (don't search - use these):**
- qmb-main: e2f1700e-98dc-4ac9-b483-ca4a0de183ce
- qmb-main: a30ab30d-cf2a-41fa-86ef-cf4f189deecf`,
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Natural language question'
        },
        refinedQuestion: {
          type: 'string',
          description: 'Refined question using exact field names from model (Step 2)'
        },
        appId: {
          type: 'string',
          description: 'App ID - provide this to skip auto-detection and get model directly'
        },
        conversationId: {
          type: 'string',
          description: 'Conversation ID for multi-app selection'
        },
        selectedAppId: {
          type: 'string',
          description: 'App ID when continuing after multiple app selection'
        }
      },
      required: ['text']
    }
  },

  qlik_get_reload_info: {
    name: 'qlik_get_reload_info',
    description: `Get app reload history and status`,
    inputSchema: {
      type: 'object',
      properties: {
        appId: {
          type: 'string',
          description: 'App ID'
        },
        limit: {
          type: 'number',
          default: 10,
          description: 'Number of reload records to return'
        }
      },
      required: ['appId']
    }
  }
};
