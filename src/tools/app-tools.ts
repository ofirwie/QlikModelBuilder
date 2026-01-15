/**
 * Tool definitions for app generation and management
 * Simplified version - basic CRUD operations
 */

export const APP_TOOLS = {
  qlik_generate_app: {
    name: 'qlik_generate_app',
    description: `Create or update a Qlik Sense app with load script and data connections.

**Cloud workflow:**
1. qlik_get_dataset_details → get connection info
2. qlik_generate_app with script

**On-Premise workflow (Engine API):**
1. Create app via Global.CreateApp
2. Optionally create data connection via Doc.CreateConnection
3. Set script via Doc.SetScript
4. Reload via Doc.DoReload
5. Save via Doc.DoSave

**On-Premise Data Connections:**
- Folder: { "connectionName": "MyData", "connectionType": "folder", "connectionString": "C:\\\\Data\\\\" }
- ODBC: { "connectionName": "SQLServer", "connectionType": "ODBC", "connectionString": "DSN=MyDSN" }

**On-Premise Discovery (no appName/appId needed):**
- listOdbcDsns: true → List available ODBC data sources on server
- listConnections: true + appId → List connections in existing app

**Cloud Load Script - File from Space:**
IMPORTANT: Use format [lib://<SpaceName>:DataFiles/<filename>]
- Example: FROM [lib://BI TEAM WORKSPACE:DataFiles/sales.csv] (txt, codepage is 1252, embedded labels, delimiter is ',', msq);
- Example: FROM [lib://Finance Team:DataFiles/report.qvd] (qvd);
- WRONG format: FROM [lib://DataFiles (spaceId)/file.csv] ← Do NOT use this!

**On-Premise Load Script Examples:**
- Folder: LOAD * FROM [lib://MyData/sales.csv] (txt, codepage is 1252, embedded labels, delimiter is ',', msq);
- ODBC: LIB CONNECT TO 'MyODBC'; SQL SELECT * FROM Sales;

Returns: appId, appName, appLink, reloadStatus, connections, odbcDsns`,
    inputSchema: {
      type: 'object',
      properties: {
        appName: {
          type: 'string',
          description: 'Name for new app (creates in personal space)'
        },
        appId: {
          type: 'string',
          description: 'Existing app ID (updates the app)'
        },
        loadScript: {
          type: 'string',
          description: 'Qlik load script'
        },
        dataConnection: {
          type: 'object',
          description: 'On-Premise only: Create a data connection before loading',
          properties: {
            connectionName: {
              type: 'string',
              description: 'Name for the connection (used in LIB CONNECT TO)'
            },
            connectionType: {
              type: 'string',
              enum: ['folder', 'ODBC', 'OLEDB'],
              description: 'Type of connection'
            },
            connectionString: {
              type: 'string',
              description: 'Connection string (folder path, DSN name, etc.)'
            },
            username: {
              type: 'string',
              description: 'Optional: Username for database connections'
            },
            password: {
              type: 'string',
              description: 'Optional: Password for database connections'
            }
          }
        },
        listConnections: {
          type: 'boolean',
          description: 'On-Premise only: List existing connections in the app (requires appId)'
        },
        listOdbcDsns: {
          type: 'boolean',
          description: 'On-Premise only: List available ODBC data sources on the server'
        }
      }
    }
  }
};
