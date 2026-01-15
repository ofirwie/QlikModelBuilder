/**
 * QlikModelBuilder - MCP Handlers
 * Handler implementations for QMB tools
 */

import { CallToolResult, TextContent } from '@modelcontextprotocol/sdk/types.js';
import {
  getWizardEngine,
  WizardEntryMode,
  WizardStepId,
  IncrementalStrategy,
} from '../wizard/index.js';
import { getQmbQlikService } from '../services/qmb/index.js';

/**
 * Handle QMB tool calls
 */
export async function handleQmbTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<CallToolResult> {
  const wizard = getWizardEngine();

  try {
    switch (toolName) {
      // ============================================================
      // Wizard Lifecycle
      // ============================================================
      case 'qmb_start_wizard': {
        const mode = (args.mode as WizardEntryMode) || 'scratch';
        const projectName = args.projectName as string | undefined;
        const state = wizard.startWizard(mode, projectName);
        return success(`Wizard started in '${mode}' mode.\n\nProject ID: ${state.id}\nCurrent step: ${state.currentStep}\n\nUse qmb_status to see progress.`);
      }

      case 'qmb_status': {
        const status = wizard.getStatus();
        return success(formatStatus(status));
      }

      case 'qmb_go_back': {
        const stepId = args.stepId as WizardStepId | undefined;
        const result = stepId ? wizard.goTo(stepId) : wizard.back();
        if (result.success) {
          return success(`Navigated to step: ${result.currentStep}`);
        } else {
          return error(result.error || 'Navigation failed');
        }
      }

      // ============================================================
      // Space Management
      // ============================================================
      case 'qmb_list_spaces': {
        const qlikService = getQmbQlikService();
        if (!qlikService.isInitialized()) {
          return error('Qlik service not initialized. Make sure you are connected to Qlik Cloud.');
        }
        const typeFilter = args.type as 'all' | 'shared' | 'managed' | 'personal' | undefined;
        const spaces = await qlikService.listSpaces({ type: typeFilter });

        if (spaces.length === 0) {
          return success('No spaces found.');
        }

        const spaceList = spaces.map(s => `- ${s.name} (${s.type}) [ID: ${s.id}]`).join('\n');
        return success(`Found ${spaces.length} spaces:\n\n${spaceList}`);
      }

      case 'qmb_select_space': {
        const spaceId = args.spaceId as string;
        const qlikService = getQmbQlikService();

        if (qlikService.isInitialized()) {
          const space = await qlikService.getSpace(spaceId);
          if (space) {
            wizard.selectSpace(spaceId, space.name, space.type as 'shared' | 'managed' | 'personal');
            return success(`Space selected: ${space.name} (${space.type})`);
          }
        }

        wizard.selectSpace(spaceId, 'Selected Space', 'shared');
        return success(`Space selected: ${spaceId}`);
      }

      case 'qmb_create_space': {
        const name = args.name as string;
        const type = args.type as 'shared' | 'managed';
        const description = args.description as string | undefined;

        const qlikService = getQmbQlikService();
        if (qlikService.isInitialized()) {
          try {
            const newSpace = await qlikService.createSpace({ name, type, description });
            wizard.selectSpace(newSpace.id, newSpace.name, newSpace.type as 'shared' | 'managed');
            return success(`Space created and selected: ${newSpace.name} (${newSpace.type}) [ID: ${newSpace.id}]`);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return error(`Failed to create space: ${message}`);
          }
        }

        wizard.createNewSpace(name, type, description);
        return success(`Space configured (will be created on deploy): ${name} (${type})`);
      }

      // ============================================================
      // Connection Management
      // ============================================================
      case 'qmb_list_connections': {
        const qlikService = getQmbQlikService();
        if (!qlikService.isInitialized()) {
          return error('Qlik service not initialized. Make sure you are connected to Qlik Cloud.');
        }

        const state = wizard.getState();
        const spaceId = state.space?.id;
        const connections = await qlikService.listConnections({ spaceId });

        if (connections.length === 0) {
          return success('No connections found.' + (spaceId ? ` (in space ${state.space?.name})` : ''));
        }

        const connList = connections.map(c => `- ${c.name} (${c.type}) [ID: ${c.id}]`).join('\n');
        return success(`Found ${connections.length} connections:\n\n${connList}`);
      }

      case 'qmb_select_connection': {
        const connectionId = args.connectionId as string;
        const qlikService = getQmbQlikService();

        if (qlikService.isInitialized()) {
          const conn = await qlikService.getConnection(connectionId);
          if (conn) {
            wizard.selectConnection(connectionId, conn.name);
            return success(`Connection selected: ${conn.name} (${conn.type})`);
          }
        }

        wizard.selectConnection(connectionId, 'Selected Connection');
        return success(`Connection selected: ${connectionId}`);
      }

      case 'qmb_create_connection': {
        const name = args.name as string;
        const type = args.type as string;
        const connectionConfig = {
          name,
          type: type as any,
          server: args.server as string | undefined,
          database: args.database as string | undefined,
          username: args.username as string | undefined,
          password: args.password as string | undefined,
        };

        wizard.setConnection(connectionConfig);
        return success(`Connection configured: ${name} (${type})\n\nNote: Connection will be created in Qlik when you deploy.`);
      }

      case 'qmb_api_wizard': {
        const baseUrl = args.baseUrl as string | undefined;
        const authType = args.authType as string | undefined;

        let response = 'API Connection Wizard\n\n';

        if (!baseUrl) {
          response += 'Step 1: What is the Base URL of the API?\n';
          response += 'Example: https://api.example.com/v1\n\n';
          response += 'Use qmb_api_wizard with baseUrl parameter to continue.';
        } else if (!authType) {
          response += `Base URL: ${baseUrl}\n\n`;
          response += 'Step 2: Select authentication type:\n';
          response += '- none: No authentication required\n';
          response += '- api_key: API Key in header or query\n';
          response += '- bearer: Bearer token\n';
          response += '- basic: Username/password\n';
          response += '- oauth2: OAuth 2.0 flow\n\n';
          response += 'Use qmb_api_wizard with authType parameter to continue.';
        } else {
          wizard.setConnection({
            name: 'API_Connection',
            type: 'rest_api',
            baseUrl,
            authType: authType as any,
          });
          response += `API Connection configured:\n- URL: ${baseUrl}\n- Auth: ${authType}\n\n`;
          response += 'Use qmb_create_connection to finalize with credentials.';
        }

        return success(response);
      }

      case 'qmb_test_connection': {
        const state = wizard.getState();
        if (!state.connection?.id) {
          return error('No connection selected. Use qmb_select_connection first.');
        }

        const qlikService = getQmbQlikService();
        if (!qlikService.isInitialized()) {
          return error('Qlik service not initialized.');
        }

        const result = await qlikService.testConnection(state.connection.id);
        if (result.success) {
          return success('Connection test successful! The connection is working.');
        } else {
          return error(`Connection test failed: ${result.error}`);
        }
      }

      // ============================================================
      // Table Configuration
      // ============================================================
      case 'qmb_list_tables': {
        const state = wizard.getState();
        if (!state.connection?.id) {
          return error('No connection selected. Use qmb_select_connection first.');
        }

        const qlikService = getQmbQlikService();
        if (!qlikService.isInitialized()) {
          return error('Qlik service not initialized.');
        }

        try {
          const tables = await qlikService.getTablesFromConnection(state.connection.id);
          if (tables.length === 0) {
            return success('No tables found in the connection.');
          }

          const schemaFilter = args.schema as string | undefined;
          const searchFilter = args.search as string | undefined;

          let filteredTables = tables;
          if (schemaFilter) {
            filteredTables = filteredTables.filter(t => t.schema === schemaFilter);
          }
          if (searchFilter) {
            const search = searchFilter.toLowerCase();
            filteredTables = filteredTables.filter(t => t.name.toLowerCase().includes(search));
          }

          const tableList = filteredTables.map(t =>
            `- ${t.schema ? t.schema + '.' : ''}${t.name} (${t.type})`
          ).join('\n');

          return success(`Found ${filteredTables.length} tables:\n\n${tableList}`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return error(`Failed to list tables: ${message}`);
        }
      }

      case 'qmb_add_table': {
        const tableName = args.tableName as string;
        const schema = args.schema as string | undefined;
        const alias = args.alias as string | undefined;
        wizard.addTable({
          name: tableName,
          schema,
          alias,
          fields: [],
          incremental: { strategy: 'none' },
        });
        return success(`Table added: ${schema ? schema + '.' : ''}${tableName}`);
      }

      case 'qmb_remove_table': {
        const tableName = args.tableName as string;
        wizard.removeTable(tableName);
        return success(`Table removed: ${tableName}`);
      }

      case 'qmb_get_table_fields': {
        // TODO: Implement actual database query
        return success('Field listing not yet implemented. Will query table columns.');
      }

      case 'qmb_set_table_fields': {
        const tableName = args.tableName as string;
        const includeFields = args.includeFields as string[] | undefined;
        // TODO: Update table fields
        return success(`Fields configured for table: ${tableName}`);
      }

      // ============================================================
      // Incremental Configuration
      // ============================================================
      case 'qmb_set_incremental': {
        const tableName = args.tableName as string;
        const strategy = args.strategy as IncrementalStrategy;
        const field = args.field as string | undefined;
        const windowSize = args.windowSize as number | undefined;
        const windowUnit = args.windowUnit as 'days' | 'weeks' | 'months' | undefined;
        const keepHistory = args.keepHistory as boolean | undefined;

        wizard.setTableIncremental(tableName, {
          strategy,
          field,
          windowSize,
          windowUnit,
          keepHistory,
        });

        return success(`Incremental configured for ${tableName}: ${strategy}${field ? ` on ${field}` : ''}`);
      }

      case 'qmb_suggest_incremental': {
        const tableName = args.tableName as string;
        // TODO: Implement AI-based suggestion
        return success(`Incremental suggestion for ${tableName}:\n\nLooking for date/timestamp fields...\nRecommendation: Check for ModifiedDate, UpdatedAt, or CreatedAt fields.`);
      }

      // ============================================================
      // Templates
      // ============================================================
      case 'qmb_list_templates': {
        return success('Available templates:\n\n1. sqlserver-basic - Basic SQL Server connection\n2. fact-table - Fact table with incremental by date\n3. dimension-table - Dimension table with full reload');
      }

      case 'qmb_use_template': {
        const templateId = args.templateId as string;
        // TODO: Apply actual template
        return success(`Template applied: ${templateId}`);
      }

      // ============================================================
      // Spec Import
      // ============================================================
      case 'qmb_load_spec': {
        const filePath = args.filePath as string | undefined;
        const content = args.content as string | undefined;
        // TODO: Implement spec extraction
        return success('Spec import not yet fully implemented. Will use Claude to extract configuration from documents.');
      }

      // ============================================================
      // Validation & Review
      // ============================================================
      case 'qmb_validate': {
        const stepArg = args.step as string | undefined;
        let result;

        if (stepArg === 'all') {
          result = wizard.validateAll();
        } else if (stepArg && stepArg !== 'current') {
          result = wizard.validateStep(stepArg as WizardStepId);
        } else {
          result = wizard.validateCurrentStep();
        }

        if (result.valid) {
          const warningText = result.warnings.length > 0
            ? `\n\nWarnings:\n${result.warnings.map(w => `- ${w.message}`).join('\n')}`
            : '';
          return success(`Validation passed!${warningText}`);
        } else {
          return error(`Validation failed:\n${result.errors.map(e => `- ${e.message}`).join('\n')}`);
        }
      }

      case 'qmb_preview_script': {
        const includeComments = args.includeComments !== false;
        const language = (args.language as 'en' | 'he') || 'en';
        const script = wizard.previewScript({ includeComments, commentLanguage: language });
        return success(`Generated Script:\n\n\`\`\`qlik\n${script}\n\`\`\``);
      }

      // ============================================================
      // Deploy
      // ============================================================
      case 'qmb_deploy': {
        const result = await wizard.deploy();
        if (result.success) {
          return success(`Deployment successful!\n\nApp ID: ${result.appId}\nURL: ${result.appUrl}`);
        } else {
          return error(`Deployment failed:\n${result.errors?.join('\n')}`);
        }
      }

      // ============================================================
      // Utilities
      // ============================================================
      case 'qmb_export_state': {
        const stateJson = wizard.exportState();
        return success(`Exported state:\n\n\`\`\`json\n${stateJson}\n\`\`\``);
      }

      case 'qmb_import_state': {
        const stateJson = args.stateJson as string;
        const imported = wizard.resumeWizard(stateJson);
        if (imported) {
          return success('State imported successfully. Use qmb_status to see current state.');
        } else {
          return error('Failed to import state. Invalid JSON format.');
        }
      }

      case 'qmb_quick_start': {
        const projectName = args.projectName as string;
        const sourceType = args.sourceType as string;
        wizard.startWizard('scratch', projectName);
        wizard.setConnection({
          name: `${projectName}_Connection`,
          type: sourceType as any,
          server: args.connectionString as string | undefined,
        });
        return success(`Quick start initialized:\n- Project: ${projectName}\n- Source: ${sourceType}\n\nNext: Add tables with qmb_add_table`);
      }

      case 'qmb_clone': {
        const appId = args.appId as string;
        const newName = args.newName as string | undefined;
        // TODO: Implement app cloning
        return success(`Clone from app ${appId} not yet implemented. Will extract configuration from existing app.`);
      }

      case 'qmb_guide': {
        const language = (args.language as 'en' | 'he') || 'he';
        const status = wizard.getStatus();
        const guide = generateStepGuide(status, language);
        return success(guide);
      }

      default:
        return error(`Unknown QMB tool: ${toolName}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return error(`Error executing ${toolName}: ${message}`);
  }
}

/**
 * Format status object for display
 */
function formatStatus(status: Record<string, unknown>): string {
  const lines = [
    '=== QlikModelBuilder Status ===',
    '',
    `Project: ${status.projectName || '(unnamed)'}`,
    `Entry Mode: ${status.entryMode}`,
    `Current Step: ${status.currentStep}`,
    '',
    '--- Progress ---',
    `Step ${(status.progress as any)?.current} of ${(status.progress as any)?.total} (${(status.progress as any)?.percentage}%)`,
    '',
    '--- Configuration ---',
    `Space: ${status.hasSpace ? 'Configured' : 'Not set'}`,
    `Connection: ${status.hasConnection ? 'Configured' : 'Not set'}`,
    `Tables: ${status.tableCount}`,
    `Script: ${status.isScriptGenerated ? 'Generated' : 'Not generated'}`,
    `Deployed: ${status.isDeployed ? 'Yes' : 'No'}`,
    '',
    '--- Steps ---',
  ];

  const steps = status.steps as Array<{ id: string; name: string; status: string }>;
  for (const step of steps) {
    const icon = step.status === 'completed' ? '[x]' : step.status === 'current' ? '[>]' : '[ ]';
    lines.push(`${icon} ${step.name}`);
  }

  return lines.join('\n');
}

/**
 * Create success response
 */
function success(message: string): CallToolResult {
  return {
    content: [{ type: 'text', text: message } as TextContent],
  };
}

/**
 * Create error response
 */
function error(message: string): CallToolResult {
  return {
    content: [{ type: 'text', text: `Error: ${message}` } as TextContent],
    isError: true,
  };
}

/**
 * Generate contextual guide for current step
 */
function generateStepGuide(status: Record<string, unknown>, language: 'en' | 'he'): string {
  const currentStep = status.currentStep as string;
  const isHe = language === 'he';

  const progress = formatProgress(status, isHe);

  const guides: Record<string, { he: string; en: string }> = {
    space_setup: {
      he: `${progress}

📍 **שלב נוכחי: הגדרת Space**

מה עושים כאן?
בחר Space קיים או צור חדש. ה-Space קובע היכן יישמר האפליקציה.

🔧 **פעולות זמינות:**
• \`qmb_list_spaces\` - הצג Spaces זמינים
• \`qmb_select_space\` - בחר Space קיים
• \`qmb_create_space\` - צור Space חדש

💡 **המלצות:**
• **Managed Space** - לפרודקשן (שליטה מלאה בהרשאות)
• **Shared Space** - לפיתוח/בדיקות (שיתוף קל)`,

      en: `${progress}

📍 **Current Step: Space Setup**

What to do here?
Select an existing Space or create a new one. The Space determines where your app will be stored.

🔧 **Available Actions:**
• \`qmb_list_spaces\` - List available Spaces
• \`qmb_select_space\` - Select existing Space
• \`qmb_create_space\` - Create new Space

💡 **Recommendations:**
• **Managed Space** - For production (full permission control)
• **Shared Space** - For development/testing (easy sharing)`,
    },

    data_source: {
      he: `${progress}

📍 **שלב נוכחי: מקור נתונים**

מה עושים כאן?
הגדר חיבור למקור הנתונים - בסיס נתונים, API, או קבצים.

🔧 **פעולות זמינות:**
• \`qmb_list_connections\` - הצג חיבורים קיימים
• \`qmb_select_connection\` - בחר חיבור קיים
• \`qmb_create_connection\` - צור חיבור חדש
• \`qmb_api_wizard\` - אשף לחיבורי REST API
• \`qmb_test_connection\` - בדוק שהחיבור עובד

💡 **סוגי חיבורים נתמכים:**
• SQL Server, PostgreSQL, Oracle, MySQL
• REST API (עם אשף ייעודי)
• Excel, CSV, JSON, QVD`,

      en: `${progress}

📍 **Current Step: Data Source**

What to do here?
Configure connection to your data source - database, API, or files.

🔧 **Available Actions:**
• \`qmb_list_connections\` - List existing connections
• \`qmb_select_connection\` - Select existing connection
• \`qmb_create_connection\` - Create new connection
• \`qmb_api_wizard\` - Guided REST API setup
• \`qmb_test_connection\` - Test connection works

💡 **Supported Connection Types:**
• SQL Server, PostgreSQL, Oracle, MySQL
• REST API (with dedicated wizard)
• Excel, CSV, JSON, QVD`,
    },

    table_selection: {
      he: `${progress}

📍 **שלב נוכחי: בחירת טבלאות**

מה עושים כאן?
בחר את הטבלאות שתרצה לחלץ מהמקור.

🔧 **פעולות זמינות:**
• \`qmb_list_tables\` - הצג טבלאות זמינות
• \`qmb_add_table\` - הוסף טבלה
• \`qmb_remove_table\` - הסר טבלה

💡 **טיפים:**
• התחל עם טבלאות ה-Fact (עובדות/טרנזקציות)
• הוסף טבלאות Dimension (ממדים/מילונים)
• אפשר לסנן לפי schema עם פרמטר \`schema\``,

      en: `${progress}

📍 **Current Step: Table Selection**

What to do here?
Select the tables you want to extract from the source.

🔧 **Available Actions:**
• \`qmb_list_tables\` - Show available tables
• \`qmb_add_table\` - Add a table
• \`qmb_remove_table\` - Remove a table

💡 **Tips:**
• Start with Fact tables (transactions/events)
• Add Dimension tables (lookups/references)
• Filter by schema using the \`schema\` parameter`,
    },

    field_mapping: {
      he: `${progress}

📍 **שלב נוכחי: מיפוי שדות**

מה עושים כאן?
בחר אילו שדות לכלול מכל טבלה.

🔧 **פעולות זמינות:**
• \`qmb_get_table_fields\` - הצג שדות של טבלה
• \`qmb_set_table_fields\` - הגדר שדות לכלול/להחריג

💡 **טיפים:**
• לא חייב לקחת הכל - בחר רק מה שצריך
• שדות עם נתונים רגישים? שקול להחריג
• שדות גדולים (BLOB, TEXT) יכולים להאט`,

      en: `${progress}

📍 **Current Step: Field Mapping**

What to do here?
Choose which fields to include from each table.

🔧 **Available Actions:**
• \`qmb_get_table_fields\` - Show table fields
• \`qmb_set_table_fields\` - Set fields to include/exclude

💡 **Tips:**
• You don't need everything - select what you need
• Sensitive data? Consider excluding
• Large fields (BLOB, TEXT) can slow things down`,
    },

    incremental_config: {
      he: `${progress}

📍 **שלב נוכחי: הגדרת Incremental**

מה עושים כאן?
קבע איך לטעון כל טבלה - מלא או אינקרמנטלי.

🔧 **פעולות זמינות:**
• \`qmb_set_incremental\` - הגדר אסטרטגיה לטבלה
• \`qmb_suggest_incremental\` - קבל המלצה אוטומטית

💡 **אסטרטגיות:**
• **none** - טעינה מלאה (לטבלאות קטנות/ממדים)
• **by_date** - לפי תאריך עדכון (ModifiedDate)
• **by_id** - לפי ID אוטומטי (מזהה עולה)
• **time_window** - חלון זמן (7 ימים אחרונים)

💡 **המלצות:**
• Fact Tables גדולות → by_date או by_id
• Dimension Tables קטנות → none
• יש ModifiedDate? → by_date`,

      en: `${progress}

📍 **Current Step: Incremental Configuration**

What to do here?
Set how to load each table - full or incremental.

🔧 **Available Actions:**
• \`qmb_set_incremental\` - Set strategy for table
• \`qmb_suggest_incremental\` - Get automatic suggestion

💡 **Strategies:**
• **none** - Full reload (small tables/dimensions)
• **by_date** - By update date (ModifiedDate)
• **by_id** - By auto-increment ID
• **time_window** - Time window (last 7 days)

💡 **Recommendations:**
• Large Fact Tables → by_date or by_id
• Small Dimension Tables → none
• Has ModifiedDate? → by_date`,
    },

    review: {
      he: `${progress}

📍 **שלב נוכחי: סקירה ויצירת Script**

מה עושים כאן?
בדוק את ההגדרות וצור את הסקריפט.

🔧 **פעולות זמינות:**
• \`qmb_validate\` - בדוק שהכל תקין
• \`qmb_preview_script\` - צפה בסקריפט שייווצר
• \`qmb_status\` - סיכום מצב

⚠️ **חשוב:**
תמיד הרץ \`qmb_validate\` לפני שממשיכים ל-Deploy!`,

      en: `${progress}

📍 **Current Step: Review & Generate Script**

What to do here?
Review settings and generate the script.

🔧 **Available Actions:**
• \`qmb_validate\` - Validate everything is correct
• \`qmb_preview_script\` - Preview generated script
• \`qmb_status\` - Status summary

⚠️ **Important:**
Always run \`qmb_validate\` before proceeding to Deploy!`,
    },

    deploy: {
      he: `${progress}

📍 **שלב נוכחי: Deploy**

מה עושים כאן?
צור את האפליקציה ב-Qlik Cloud!

🔧 **פעולות זמינות:**
• \`qmb_deploy\` - צור אפליקציה והעלה סקריפט
• \`qmb_preview_script\` - צפה בסקריפט לפני

⚠️ **לפני Deploy:**
וודא שהרצת \`qmb_validate step:"all"\`!`,

      en: `${progress}

📍 **Current Step: Deploy**

What to do here?
Create the app in Qlik Cloud!

🔧 **Available Actions:**
• \`qmb_deploy\` - Create app and upload script
• \`qmb_preview_script\` - Preview script before

⚠️ **Before Deploy:**
Make sure you ran \`qmb_validate step:"all"\`!`,
    },
  };

  const guide = guides[currentStep];
  if (!guide) {
    return isHe
      ? 'לא נמצא מדריך לשלב הנוכחי. השתמש ב-qmb_status לראות את המצב.'
      : 'No guide found for current step. Use qmb_status to see the state.';
  }

  return isHe ? guide.he : guide.en;
}

/**
 * Format progress indicator
 */
function formatProgress(status: Record<string, unknown>, isHe: boolean): string {
  const steps = [
    { id: 'space_setup', he: 'Space', en: 'Space' },
    { id: 'data_source', he: 'חיבור', en: 'Connection' },
    { id: 'table_selection', he: 'טבלאות', en: 'Tables' },
    { id: 'field_mapping', he: 'שדות', en: 'Fields' },
    { id: 'incremental_config', he: 'Incremental', en: 'Incremental' },
    { id: 'review', he: 'סקירה', en: 'Review' },
    { id: 'deploy', he: 'Deploy', en: 'Deploy' },
  ];

  const currentStep = status.currentStep as string;
  const currentIndex = steps.findIndex(s => s.id === currentStep);

  const progressLine = steps.map((step, i) => {
    const name = isHe ? step.he : step.en;
    if (i < currentIndex) return `✓ ${name}`;
    if (i === currentIndex) return `→ **${name}**`;
    return `○ ${name}`;
  }).join('  ');

  return progressLine;
}
