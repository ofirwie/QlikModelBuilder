/**
 * Tool definitions for data operations and analysis
 * Combined from: existing handlers + jwaxman19/qlik-mcp + bintocher/qlik-sense-mcp
 */

export const DATA_TOOLS = {
  // ===== EXISTING TOOLS =====

  qlik_get_dataset_details: {
    name: 'qlik_get_dataset_details',
    description: 'Get detailed information about a dataset from the data catalog.',
    inputSchema: {
      type: 'object',
      properties: {
        datasetId: {
          type: 'string',
          description: 'Dataset ID'
        }
      },
      required: ['datasetId']
    }
  },

  qlik_apply_selections: {
    name: 'qlik_apply_selections',
    description: 'Apply selections/filters to a Qlik app',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'App ID' },
        selections: {
          type: 'array',
          description: 'Selection criteria',
          items: {
            type: 'object',
            properties: {
              field: { type: 'string', description: 'Field name' },
              values: { type: 'array', description: 'Values to select' }
            },
            required: ['field']
          }
        }
      },
      required: ['appId', 'selections']
    }
  },

  qlik_clear_selections: {
    name: 'qlik_clear_selections',
    description: 'Clear all selections in an app',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'App ID' }
      },
      required: ['appId']
    }
  },

  qlik_get_current_selections: {
    name: 'qlik_get_current_selections',
    description: 'Get current selections in an app',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'App ID' }
      },
      required: ['appId']
    }
  },

  qlik_get_available_fields: {
    name: 'qlik_get_available_fields',
    description: 'Get all fields in an app',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'App ID' }
      },
      required: ['appId']
    }
  },

  // ===== NEW TOOLS - Exposing existing handlers =====

  qlik_get_app_metadata: {
    name: 'qlik_get_app_metadata',
    description: `Get comprehensive app metadata including sheets, objects, and data model.

Returns:
- App info (name, owner, size)
- All sheets with titles and descriptions
- All visualization objects per sheet
- Field list and data model info
- Optionally: sample data from objects

Use cases:
- Explore app structure before querying
- Find sheet and object IDs
- Understand data model`,
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'App ID' },
        includeSheets: { type: 'boolean', description: 'Include sheet list (default: true)', default: true },
        includeObjects: { type: 'boolean', description: 'Include objects per sheet (default: true)', default: true },
        includeObjectData: { type: 'boolean', description: 'Include sample data from objects (default: false)', default: false },
        maxDataRows: { type: 'number', description: 'Max rows per object when includeObjectData=true (default: 100)', default: 100 }
      },
      required: ['appId']
    }
  },

  qlik_get_object_data: {
    name: 'qlik_get_object_data',
    description: `Get data from a specific visualization object (chart, table, KPI, etc).

Returns actual data with:
- Column headers (dimensions + measures)
- Row data
- Total row count
- Data types per column

Respects current selections - apply selections first to filter data.

Use cases:
- Extract data from existing charts
- Get KPI values
- Export table data`,
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'App ID' },
        objectId: { type: 'string', description: 'Object ID (from qlik_get_app_metadata)' },
        maxRows: { type: 'number', description: 'Maximum rows to return (default: 100)', default: 100 },
        useSession: { type: 'boolean', description: 'Use session with selections (default: true)', default: true }
      },
      required: ['appId', 'objectId']
    }
  },

  qlik_create_hypercube: {
    name: 'qlik_create_hypercube',
    description: `⚠️ SLOW - LAST RESORT! Use qlik_get_existing_kpis FIRST!

Create a custom hypercube query (~2000ms) - only when pre-built objects don't exist.

**🔴 BEFORE using this tool, CHECK:**
1. Did qlik_recognize_intent return prebuiltObject? → Use qlik_get_existing_kpis instead!
2. Is this MTTR/Category/Admin Group query? → Use qlik_get_existing_kpis instead!

**Only use this tool when:**
- No matching pre-built object exists
- You need a custom dimension/measure combination

**SysAid App IDs:**
- sysaid-internal: a30ab30d-cf2a-41fa-86ef-cf4f189deecf
- sysaid-main: e2f1700e-98dc-4ac9-b483-ca4a0de183ce

Example:
{
  "appId": "a30ab30d-cf2a-41fa-86ef-cf4f189deecf",
  "dimensions": ["status_class", "urgency"],
  "measures": ["Count(distinct sr_id)"],
  "maxRows": 100
}`,
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'App ID' },
        dimensions: {
          type: 'array',
          description: 'Field names to use as dimensions (group by)',
          items: { type: 'string' }
        },
        measures: {
          type: 'array',
          description: 'Expressions for measures (e.g., "Sum(amount)", "Count(id)")',
          items: { type: 'string' }
        },
        maxRows: { type: 'number', description: 'Maximum rows to return (default: 1000)', default: 1000 },
        sortByMeasure: { type: 'number', description: 'Sort by measure index (0-based)', default: 0 },
        sortOrder: { type: 'string', enum: ['asc', 'desc'], description: 'Sort order', default: 'desc' }
      },
      required: ['appId', 'dimensions', 'measures']
    }
  },

  // ===== NEW TOOLS - From jwaxman19/qlik-mcp =====

  qlik_get_app_sheets: {
    name: 'qlik_get_app_sheets',
    description: `Get all sheets in a Qlik app with their objects.

Returns for each sheet:
- Sheet ID and title
- Description
- All visualization objects (charts, tables, KPIs)
- Object types and IDs

Use this to navigate app structure and find object IDs for data extraction.`,
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'App ID' },
        includeObjects: { type: 'boolean', description: 'Include objects per sheet (default: true)', default: true }
      },
      required: ['appId']
    }
  },

  qlik_get_sheet_objects: {
    name: 'qlik_get_sheet_objects',
    description: `Get all visualization objects from a specific sheet.

Returns:
- Object IDs
- Object types (barchart, linechart, table, kpi, etc.)
- Titles and subtitles
- Dimension and measure definitions

Use to find specific charts/tables to extract data from.`,
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'App ID' },
        sheetId: { type: 'string', description: 'Sheet ID' }
      },
      required: ['appId', 'sheetId']
    }
  },

  // ===== NEW TOOLS - From bintocher/qlik-sense-mcp =====

  qlik_get_field_values: {
    name: 'qlik_get_field_values',
    description: `Get distinct values from a field with optional search/filter.

Returns:
- List of distinct values
- Value count
- Selection state per value

Use cases:
- Explore field content before selecting
- Build filter UI
- Validate data quality`,
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'App ID' },
        fieldName: { type: 'string', description: 'Field name' },
        searchPattern: { type: 'string', description: 'Optional search pattern (supports wildcards *)' },
        maxValues: { type: 'number', description: 'Maximum values to return (default: 100)', default: 100 }
      },
      required: ['appId', 'fieldName']
    }
  },

  qlik_get_app_script: {
    name: 'qlik_get_app_script',
    description: `Get the load script from a Qlik app.

Returns the complete data load script including:
- Data connections used
- Table definitions
- Transformations
- Variables

Use to understand data sources and ETL logic.`,
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'App ID' }
      },
      required: ['appId']
    }
  },

  qlik_evaluate_expression: {
    name: 'qlik_evaluate_expression',
    description: `Evaluate a Qlik expression and return the result.

Supports any valid Qlik expression:
- Aggregations: Sum(), Count(), Avg(), Min(), Max()
- Set analysis: Sum({<Year={2024}>} Sales)
- Functions: Date(), Text(), If()

Respects current selections.

Example: "Count(DISTINCT customer_id)"`,
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'App ID' },
        expression: { type: 'string', description: 'Qlik expression to evaluate' }
      },
      required: ['appId', 'expression']
    }
  },

  // ===== FIELD AND MASTER ITEMS MAPPING =====

  qlik_map_fields: {
    name: 'qlik_map_fields',
    description: `Map all fields from an app with their properties.

Returns for each field:
- name: Field name
- cardinality: Number of unique values
- tags: System tags ($numeric, $date, etc.)
- isNumeric: Whether field is numeric
- dataType: Detected data type (text, numeric, date, timestamp)
- sampleValues: Up to 5 sample values

Processes in batches of 50 for large apps.`,
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'App ID' },
        batchSize: { type: 'number', description: 'Batch size (default: 50)', default: 50 }
      },
      required: ['appId']
    }
  },

  qlik_map_master_dimensions: {
    name: 'qlik_map_master_dimensions',
    description: `Map all master dimensions from an app library.

Returns for each dimension:
- id: Dimension ID
- title: Display name
- description: Description text
- tags: Organization tags
- grouping: N=None, H=Drill-down, C=Cyclic
- fieldDefs: Array of field definitions
- fieldLabels: Array of field labels

Processes in batches of 50 for large apps.`,
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'App ID' },
        batchSize: { type: 'number', description: 'Batch size (default: 50)', default: 50 }
      },
      required: ['appId']
    }
  },

  qlik_map_master_measures: {
    name: 'qlik_map_master_measures',
    description: `Map all master measures from an app library.

Returns for each measure:
- id: Measure ID
- title: Display name
- description: Description text
- tags: Organization tags
- expression: Aggregation expression (e.g., Sum(Sales))
- label: Display label
- numFormat: Number format settings

Processes in batches of 50 for large apps.`,
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'App ID' },
        batchSize: { type: 'number', description: 'Batch size (default: 50)', default: 50 }
      },
      required: ['appId']
    }
  },

  qlik_map_all: {
    name: 'qlik_map_all',
    description: `Map ALL fields and master items from an app in one call.

Returns:
- fields: All field info with properties
- masterDimensions: All master dimensions with properties
- masterMeasures: All master measures with properties
- summary: Total counts and batch statistics

Runs all three mappings sequentially with reconnect logic for reliability.
Use this to get a complete picture of an app's data model and library.`,
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'App ID' },
        batchSize: { type: 'number', description: 'Batch size (default: 50)', default: 50 }
      },
      required: ['appId']
    }
  },

  // ===== VISUALIZATION CREATION TOOLS =====

  qlik_create_sheet: {
    name: 'qlik_create_sheet',
    description: `Create a new sheet in a Qlik app.

Use cases:
- Create a dedicated sheet for AI analytics cache
- Organize visualizations into sheets
- Build custom dashboards programmatically

Returns the sheet ID for use in qlik_create_visualization.`,
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'App ID' },
        title: { type: 'string', description: 'Sheet title' },
        id: { type: 'string', description: 'Optional custom sheet ID' },
        description: { type: 'string', description: 'Optional description' }
      },
      required: ['appId', 'title']
    }
  },

  qlik_create_visualization: {
    name: 'qlik_create_visualization',
    description: `Create a visualization (chart, table, KPI) in a sheet.

Supported types:
- barchart, linechart, piechart, combochart
- table, pivot-table
- kpi

Use cases:
- Create pre-built hypercubes for faster queries
- Build dashboards programmatically
- Cache commonly used aggregations`,
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'App ID' },
        sheetId: { type: 'string', description: 'Sheet ID to add visualization to' },
        type: {
          type: 'string',
          enum: ['barchart', 'linechart', 'piechart', 'table', 'kpi', 'pivot-table', 'combochart'],
          description: 'Visualization type'
        },
        title: { type: 'string', description: 'Visualization title' },
        id: { type: 'string', description: 'Optional custom object ID' },
        dimensions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Field names for dimensions'
        },
        measures: {
          type: 'array',
          items: {
            oneOf: [
              { type: 'string' },
              {
                type: 'object',
                properties: {
                  expression: { type: 'string' },
                  label: { type: 'string' }
                },
                required: ['expression']
              }
            ]
          },
          description: 'Measure expressions (string or {expression, label})'
        },
        position: {
          type: 'object',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            width: { type: 'number' },
            height: { type: 'number' }
          },
          description: 'Optional position in sheet (col, row, colspan, rowspan)'
        }
      },
      required: ['appId', 'sheetId', 'type', 'title']
    }
  },

  qlik_create_ai_cache: {
    name: 'qlik_create_ai_cache',
    description: `Create AI Analytics Cache sheet with pre-built hypercubes.

Creates a hidden sheet with 5 optimized hypercubes based on ITSM Performance Dashboard:
- MONTHLY_MTTR: Tickets Closed & MTTR per month
- CATEGORY_MTTR: MTTR and satisfaction per category
- ADMIN_GROUP_MTTR: MTTR and satisfaction per admin group
- SLA_INDICATOR: SLA status breakdown
- STATUS_OVERVIEW: Open/Closed by type

Use these cached objects for faster data retrieval instead of creating hypercubes dynamically.`,
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'App ID' }
      },
      required: ['appId']
    }
  },

  qlik_get_ai_cache_data: {
    name: 'qlik_get_ai_cache_data',
    description: `Get data from AI Analytics Cache objects.

Valid cacheKey values:
- MONTHLY_MTTR: Monthly trend with incidents, requests, and MTTR
- CATEGORY_MTTR: Category breakdown with totals, MTTR, satisfaction
- ADMIN_GROUP_MTTR: Admin group breakdown with totals, MTTR, satisfaction
- SLA_INDICATOR: SLA breached/within target counts
- STATUS_OVERVIEW: Open/Closed counts by SR type

Use this instead of qlik_create_hypercube for common queries.
If cache doesn't exist, use qlik_create_ai_cache first.`,
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'App ID' },
        cacheKey: {
          type: 'string',
          enum: ['MONTHLY_MTTR', 'CATEGORY_MTTR', 'ADMIN_GROUP_MTTR', 'SLA_INDICATOR', 'STATUS_OVERVIEW'],
          description: 'Cache object key'
        }
      },
      required: ['appId', 'cacheKey']
    }
  },

  // ===== PRE-BUILT OBJECTS =====
  // Use existing objects in the app - faster than creating hypercubes!

  qlik_get_existing_kpis: {
    name: 'qlik_get_existing_kpis',
    description: `🚀 FAST (~500ms) - USE THIS FIRST for SysAid analytics!

Get data from pre-built objects with ALL KPIs already calculated:
- Total tickets, MTTR, % MTTR change, Satisfaction, % Satisfaction change

**🔴 MANDATORY: Use this instead of qlik_create_hypercube when query matches:**
- Team/Admin Group performance → MTTR_PER_ADMIN_GROUP
- Category analysis → MTTR_PER_CATEGORY
- Monthly trends → INCIDENTS_VS_REQUESTS

**Available objects:**
| Key | Contains | Use for |
|-----|----------|---------|
| MTTR_PER_ADMIN_GROUP | MTTR, Satisfaction by team | Team performance, workload |
| MTTR_PER_CATEGORY | MTTR, Satisfaction by category | Category analysis |
| INCIDENTS_VS_REQUESTS | Monthly incidents vs requests | Trend analysis |

**Performance:** ~500ms vs ~2000ms for qlik_create_hypercube

**Example:**
{
  "objectKey": "MTTR_PER_ADMIN_GROUP"
}`,
    inputSchema: {
      type: 'object',
      properties: {
        objectKey: {
          type: 'string',
          enum: ['INCIDENTS_VS_REQUESTS', 'MTTR_PER_CATEGORY', 'MTTR_PER_ADMIN_GROUP'],
          description: 'Pre-built object key'
        },
        maxRows: { type: 'number', description: 'Maximum rows to return (default: 50)', default: 50 }
      },
      required: ['objectKey']
    }
  },

  // ===== ANALYSIS-TO-DASHBOARD TOOL =====

  qlik_create_dashboard_from_analysis: {
    name: 'qlik_create_dashboard_from_analysis',
    description: `Create a Qlik dashboard from Claude analysis output.

Takes structured analysis output and automatically generates:
- A new unpublished sheet in the app
- KPI objects for key metrics (top row)
- Charts for breakdowns (bar, pie based on data)
- Trend charts for time series (line, combo)
- Tables for detailed data

**Uses cognitive visualization rules from qlik-semantic-bridge.skill:**
- Rule 18: Bar charts start from 0
- Rule 31: Prefer bars over pie (>3 items)
- Rule 63: Color-blind safe palette
- Rule 81: No data manipulation

**Parameters:**
- appId: Target app ID (defaults to sysaid-internal)
- analysis: Structured analysis object (see example)
- sheetTitle: Optional sheet name (defaults to analysis.title)

**Returns:**
- sheetId: Created sheet ID
- sheetUrl: Direct link to sheet in Qlik Cloud
- objects: Array of created visualization IDs
- message: Summary

**Example:**
{
  "appId": "a30ab30d-cf2a-41fa-86ef-cf4f189deecf",
  "analysis": {
    "title": "MTTR Analysis Q4 2024",
    "summary": "Analysis of mean time to resolution by category",
    "metrics": [
      { "name": "Total Incidents", "value": 1234 },
      { "name": "Avg MTTR", "value": 4.5, "unit": "days" }
    ],
    "breakdowns": [
      {
        "dimension": "Category",
        "measure": "mttr",
        "data": [
          { "label": "Hardware", "value": 5.2 },
          { "label": "Software", "value": 3.8 },
          { "label": "Network", "value": 4.1 }
        ]
      }
    ],
    "trends": [
      {
        "dimension": "Closed_MonthYear",
        "measures": ["Incidents", "MTTR"],
        "data": [
          { "period": "Oct 2024", "values": [120, 4.2] },
          { "period": "Nov 2024", "values": [135, 4.5] },
          { "period": "Dec 2024", "values": [115, 4.0] }
        ]
      }
    ]
  }
}`,
    inputSchema: {
      type: 'object',
      properties: {
        appId: {
          type: 'string',
          description: 'App ID (defaults to sysaid-internal: a30ab30d-cf2a-41fa-86ef-cf4f189deecf)'
        },
        analysis: {
          type: 'object',
          description: 'Structured analysis output with title, metrics, breakdowns, trends',
          properties: {
            title: { type: 'string', description: 'Dashboard title' },
            summary: { type: 'string', description: 'Executive summary' },
            metrics: {
              type: 'array',
              description: 'KPI metrics to display',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  value: { type: 'number' },
                  unit: { type: 'string' }
                },
                required: ['name', 'value']
              }
            },
            breakdowns: {
              type: 'array',
              description: 'Dimensional breakdowns',
              items: {
                type: 'object',
                properties: {
                  dimension: { type: 'string' },
                  measure: { type: 'string' },
                  data: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        label: { type: 'string' },
                        value: { type: 'number' }
                      }
                    }
                  }
                }
              }
            },
            trends: {
              type: 'array',
              description: 'Time-series trends',
              items: {
                type: 'object',
                properties: {
                  dimension: { type: 'string' },
                  measures: { type: 'array', items: { type: 'string' } },
                  data: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        period: { type: 'string' },
                        values: { type: 'array', items: { type: 'number' } }
                      }
                    }
                  }
                }
              }
            }
          },
          required: ['title']
        },
        sheetTitle: {
          type: 'string',
          description: 'Optional custom sheet title (defaults to analysis.title)'
        }
      },
      required: ['analysis']
    }
  }
};
