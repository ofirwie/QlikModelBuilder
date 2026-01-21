/**
 * Tenant Management Tools
 * Switch between multiple Qlik Cloud tenants
 */

export const TENANT_TOOLS = {
  qlik_list_tenants: {
    name: 'qlik_list_tenants',
    description: `List all configured Qlik Cloud tenants.

Shows all available tenants with their:
- ID (for switching)
- Name
- URL
- Active status

Use this to see which tenants are available before switching.`,
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  qlik_switch_tenant: {
    name: 'qlik_switch_tenant',
    description: `Switch to a different Qlik Cloud tenant.

**Available Tenants:**
- qmb-main: QMB Main (iyil7lpmybpzhbm.de.qlikcloud.com)
- qmb-main: QMB Main (iyil7lpmybpzhbm.de.qlikcloud.com)

**Usage:**
After switching, all subsequent Qlik tools will use the new tenant.

**Example:**
{ "tenantId": "qmb-main" }`,
    inputSchema: {
      type: 'object',
      properties: {
        tenantId: {
          type: 'string',
          description: 'Tenant ID to switch to (e.g., "qmb-main" or "qmb-main")',
          enum: ['qmb-main', 'qmb-main'],
        },
      },
      required: ['tenantId'],
    },
  },

  qlik_get_active_tenant: {
    name: 'qlik_get_active_tenant',
    description: `Get information about the currently active Qlik Cloud tenant.

Returns:
- Tenant ID
- Tenant name
- URL
- Connection status`,
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
};
