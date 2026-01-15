/**
 * Tool definitions for Qlik Answers management
 * Cloud-only feature for AI assistants
 */

export const ANSWERS_TOOLS = {
  qlik_answers_list_assistants: {
    name: 'qlik_answers_list_assistants',
    description: 'List Qlik Answers AI assistants',
    inputSchema: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Search assistants by name'
        },
        limit: {
          type: 'number',
          default: 50,
          description: 'Maximum number of assistants to return'
        },
        offset: {
          type: 'number',
          default: 0,
          description: 'Offset for pagination'
        },
        spaceId: {
          type: 'string',
          description: 'Filter by space ID'
        }
      }
    },
    cloudOnly: true
  },

  qlik_answers_get_assistant: {
    name: 'qlik_answers_get_assistant',
    description: 'Get details of a specific assistant',
    inputSchema: {
      type: 'object',
      properties: {
        assistantId: {
          type: 'string',
          description: 'Assistant ID'
        }
      },
      required: ['assistantId']
    },
    cloudOnly: true
  },

  qlik_answers_ask_question: {
    name: 'qlik_answers_ask_question',
    description: `Ask a question to a Qlik Answers AI assistant.

**What is Qlik Answers?**
- Native Qlik Cloud Q&A assistant feature
- Requires pre-configured assistant with knowledge base
- Manages conversation threads
- Uses Qlik's built-in AI

**When to use this tool:**
- User has a Qlik Answers assistant configured
- User wants to chat with their Qlik Answers assistant
- User wants to continue an existing conversation thread

**Workflow:**
1. First use qlik_answers_list_assistants to find the assistant ID
2. Then use this tool with the assistantId and your question
3. Optionally provide threadId to continue an existing conversation

**Parameters:**
- assistantId (required): ID of the Qlik Answers assistant
- question (required): The question to ask
- threadId (optional): Continue existing conversation
- createNewThread (default: true): Create new thread if none provided
- threadName (optional): Name for new conversation thread`,
    inputSchema: {
      type: 'object',
      properties: {
        assistantId: {
          type: 'string',
          description: 'Assistant ID (use qlik_answers_list_assistants to find it)'
        },
        question: {
          type: 'string',
          description: 'The question to ask the assistant'
        },
        threadId: {
          type: 'string',
          description: 'Existing thread ID to continue conversation (optional)'
        },
        createNewThread: {
          type: 'boolean',
          default: true,
          description: 'Create new thread if no threadId provided'
        },
        threadName: {
          type: 'string',
          description: 'Name for new conversation thread (optional)'
        }
      },
      required: ['assistantId', 'question']
    },
    cloudOnly: true
  }
};
