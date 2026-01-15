/**
 * Tool definitions for Qlik Cloud data alerts management
 * Cloud-only feature for data monitoring and notifications
 */

export const ALERTS_TOOLS = {
  qlik_alert_list: {
    name: 'qlik_alert_list',
    description: `List all Qlik Cloud data alerts with optional filtering.

**Cloud-only feature** - Not available for on-premise deployments.

**Supports filtering and pagination:**
- spaceId: Filter by space ID
- enabled: Filter by enabled/disabled status
- limit: Maximum number of alerts to return (default: 50)
- offset: Pagination offset (default: 0)

**Returns:**
- Array of alert objects with configuration and status

**Example:**
{
  "enabled": true,
  "limit": 20,
  "spaceId": "space-id-here"
}`,
    inputSchema: {
      type: 'object',
      properties: {
        spaceId: {
          type: 'string',
          description: 'Filter by space ID'
        },
        enabled: {
          type: 'boolean',
          description: 'Filter by enabled/disabled status'
        },
        limit: {
          type: 'number',
          default: 50,
          description: 'Maximum number of alerts to return'
        },
        offset: {
          type: 'number',
          default: 0,
          description: 'Pagination offset'
        }
      }
    },
    cloudOnly: true
  },

  qlik_alert_get: {
    name: 'qlik_alert_get',
    description: `Get detailed information about a specific Qlik Cloud data alert.

**Cloud-only feature** - Not available for on-premise deployments.

**Parameters:**
- alertId: Alert ID to retrieve (required)

**Returns:**
- Full alert details including condition, recipients, schedule, and execution history

**Example:**
{
  "alertId": "alert-id-here"
}`,
    inputSchema: {
      type: 'object',
      properties: {
        alertId: {
          type: 'string',
          description: 'Alert ID to retrieve'
        }
      },
      required: ['alertId']
    },
    cloudOnly: true
  },

  qlik_alert_trigger: {
    name: 'qlik_alert_trigger',
    description: `Manually trigger a Qlik Cloud data alert.

**Cloud-only feature** - Not available for on-premise deployments.

Forces immediate execution of the alert to check conditions and send notifications if triggered.

**Parameters:**
- alertId: Alert ID to trigger (required)

**Returns:**
- Execution ID and status

**Example:**
{
  "alertId": "alert-id-here"
}`,
    inputSchema: {
      type: 'object',
      properties: {
        alertId: {
          type: 'string',
          description: 'Alert ID to trigger'
        }
      },
      required: ['alertId']
    },
    cloudOnly: true
  },

  qlik_alert_delete: {
    name: 'qlik_alert_delete',
    description: `Delete a Qlik Cloud data alert.

**Cloud-only feature** - Not available for on-premise deployments.

**Parameters:**
- alertId: Alert ID to delete (required)

**Example:**
{
  "alertId": "alert-id-here"
}`,
    inputSchema: {
      type: 'object',
      properties: {
        alertId: {
          type: 'string',
          description: 'Alert ID to delete'
        }
      },
      required: ['alertId']
    },
    cloudOnly: true
  }
};
