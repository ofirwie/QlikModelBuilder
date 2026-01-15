/**
 * Tool definitions for automation management
 */

export const AUTOMATION_TOOLS = {
  qlik_automation_list: {
    name: 'qlik_automation_list',
    description: `List all automations that the user has access to.

**Supports filtering, sorting, and pagination:**
- filter: Filter expression (e.g., "enabled eq true")
- sort: Sort by field (e.g., "-createdDate" for descending)
- limit: Maximum number of results to return

**Returns:**
- Array of automation objects with id, name, description, enabled status, etc.`,
    inputSchema: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          description: 'Filter expression (e.g., "enabled eq true")'
        },
        sort: {
          type: 'string',
          description: 'Sort by field (e.g., "-createdDate")'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results'
        }
      }
    }
  },

  qlik_automation_get_details: {
    name: 'qlik_automation_get_details',
    description: `Get full details of a specific automation including its workflow definition.

**Parameters:**
- automationId: The unique identifier of the automation

**Returns:**
- Full automation object with workflow definition, connections, and configuration`,
    inputSchema: {
      type: 'object',
      properties: {
        automationId: {
          type: 'string',
          description: 'The automation ID to retrieve'
        }
      },
      required: ['automationId']
    }
  },

  qlik_automation_run: {
    name: 'qlik_automation_run',
    description: `Execute an automation (queue a new run).

**Parameters:**
- automationId: The automation to execute

**Returns:**
- Run details including runId and status

**Note:** The automation must be enabled before it can be run.`,
    inputSchema: {
      type: 'object',
      properties: {
        automationId: {
          type: 'string',
          description: 'The automation ID to run'
        }
      },
      required: ['automationId']
    }
  },

  qlik_automation_list_runs: {
    name: 'qlik_automation_list_runs',
    description: `List all runs (executions) for a specific automation.

**Supports filtering and sorting:**
- filter: Filter expression (e.g., "status eq 'failed'")
- sort: Sort by field (e.g., "-startTime")
- limit: Maximum number of results

**Returns:**
- Array of run objects with id, status, startTime, endTime, etc.`,
    inputSchema: {
      type: 'object',
      properties: {
        automationId: {
          type: 'string',
          description: 'The automation ID'
        },
        filter: {
          type: 'string',
          description: 'Filter expression'
        },
        sort: {
          type: 'string',
          description: 'Sort by field'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results'
        }
      },
      required: ['automationId']
    }
  }
};
