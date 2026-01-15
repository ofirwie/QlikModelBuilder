// ===== RELOAD TOOLS =====
// Tool definitions for app reload operations

/**
 * Tool definitions for reload operations
 */
export const RELOAD_TOOLS = {
  qlik_trigger_app_reload: {
    name: 'qlik_trigger_app_reload',
    description: `Triggers a reload for a Qlik Cloud app. Can optionally wait for completion and poll for status.

Usage scenarios:
- Trigger immediate reload after data source update
- Schedule reload with monitoring
- Partial reload to refresh specific data
- Test reload with skip-store option

Parameters:
- appId (required): The Qlik app ID to reload
- partial (optional): If true, performs partial reload (default: false)
- skipStore (optional): If true, skip saving to disk (default: false)
- waitForCompletion (optional): If true, waits for reload to complete (default: false)
- timeoutSeconds (optional): Timeout for waiting in seconds (default: 300)
- pollIntervalSeconds (optional): How often to check status in seconds (default: 5)`,
    inputSchema: {
      type: 'object',
      properties: {
        appId: {
          type: 'string',
          description: 'The Qlik app ID to reload',
        },
        partial: {
          type: 'boolean',
          description: 'Perform partial reload instead of full reload',
          default: false,
        },
        skipStore: {
          type: 'boolean',
          description: 'Skip storing the app after reload',
          default: false,
        },
        waitForCompletion: {
          type: 'boolean',
          description: 'Wait for the reload to complete before returning',
          default: false,
        },
        timeoutSeconds: {
          type: 'number',
          description: 'Maximum time to wait for completion (seconds)',
          default: 300,
        },
        pollIntervalSeconds: {
          type: 'number',
          description: 'Interval between status checks (seconds)',
          default: 5,
        },
      },
      required: ['appId'],
    },
  },

  qlik_get_reload_status: {
    name: 'qlik_get_reload_status',
    description: `Gets the current status of a reload task in Qlik Cloud.

Returns information about:
- Current reload state (queued, running, succeeded, failed)
- Progress percentage
- Start and end times
- Error messages if failed
- Duration and performance metrics

Use this to monitor ongoing reloads or check historical reload results.`,
    inputSchema: {
      type: 'object',
      properties: {
        reloadId: {
          type: 'string',
          description: 'The reload task ID to check',
        },
      },
      required: ['reloadId'],
    },
  },

  qlik_cancel_reload: {
    name: 'qlik_cancel_reload',
    description: `Cancels a running reload task in Qlik Cloud.

Use cases:
- Stop long-running reload that's hung
- Cancel reload after detecting errors
- Free up resources
- Emergency stop during maintenance

Note: Only running or queued reloads can be cancelled.
Completed or already failed reloads cannot be cancelled.`,
    inputSchema: {
      type: 'object',
      properties: {
        reloadId: {
          type: 'string',
          description: 'The reload task ID to cancel',
        },
      },
      required: ['reloadId'],
    },
  },
};
