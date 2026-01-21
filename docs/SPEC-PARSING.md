# Specification Parsing - QlikModelBuilder

## מה זה פרסור איפיון?

פרסור איפיון הוא התהליך שבו המערכת לוקחת **מסמך תיאור** (Excel, Word, PDF) של מודל נתונים, ומפיקה ממנו אוטומטית את כל ההגדרות הנדרשות לבניית המודל ב-Qlik.

```
מסמך איפיון (Excel/Word/PDF)
         ↓
    [פרסור]
         ↓
ProjectState JSON (מבנה נתונים מובנה)
         ↓
    Qlik Script
         ↓
    Qlik App
```

---

## מצב נוכחי

| Component | Status | Location |
|-----------|--------|----------|
| Tool Definition | ✅ מוגדר | `src/tools/qmb-tools.ts:397-413` |
| Type Definitions | ✅ מוגדר | `src/wizard/types.ts:211-218` |
| Handler | ⚠️ Placeholder | `src/handlers/qmb-handlers.ts:331-336` |
| Extraction Logic | ❌ לא ממומש | - |
| Claude Integration | ❌ לא ממומש | - |
| Parsing Libraries | ❌ לא מותקן | - |

---

## ה-Tool: `qmb_load_spec`

### הגדרה

```typescript
{
  name: 'qmb_load_spec',
  description: 'Load and extract configuration from a specification document',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Path to the specification file (Excel, Word, PDF)',
      },
      content: {
        type: 'string',
        description: 'Or provide the content directly',
      },
    },
  },
}
```

### קריאה לדוגמה

```json
// Option 1: מנתיב קובץ
{
  "tool": "qmb_load_spec",
  "args": {
    "filePath": "C:/Docs/DataModel_Specification.xlsx"
  }
}

// Option 2: מתוכן ישיר
{
  "tool": "qmb_load_spec",
  "args": {
    "content": "Table: orders\nFields: order_id (PK), customer_id (FK), order_date, amount\n..."
  }
}
```

### מימוש נוכחי (Placeholder)

```typescript
// src/handlers/qmb-handlers.ts:331-336
case 'qmb_load_spec': {
  const filePath = args.filePath as string | undefined;
  const content = args.content as string | undefined;
  // TODO: Implement spec extraction
  return success('Spec import not yet fully implemented. Will use Claude to extract...');
}
```

---

## הזרימה המתוכננת - Parsing Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                        INPUT LAYER                                   │
├─────────────────────────────────────────────────────────────────────┤
│  File Path                           OR         Raw Content          │
│  "C:/Docs/spec.xlsx"                            "Table: orders..."   │
└───────────────────────────────────────┬─────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     FORMAT DETECTION                                 │
├─────────────────────────────────────────────────────────────────────┤
│  Extension Analysis:                                                 │
│  .xlsx, .xls    → Excel Parser                                      │
│  .docx          → Word Parser                                       │
│  .pdf           → PDF Parser                                        │
│  .json, .yaml   → Direct Parser                                     │
│  .csv           → CSV Parser                                        │
│  .txt, unknown  → AI Extraction (Claude)                            │
└───────────────────────────────────────┬─────────────────────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
                    ▼                   ▼                   ▼
┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐
│    STRUCTURED         │ │   SEMI-STRUCTURED     │ │    UNSTRUCTURED       │
│    PARSER             │ │   PARSER              │ │    PARSER             │
├───────────────────────┤ ├───────────────────────┤ ├───────────────────────┤
│ JSON/YAML:            │ │ Excel:                │ │ Word/PDF/Text:        │
│ • Direct mapping      │ │ • Sheet detection     │ │ • Send to Claude API  │
│ • Schema validation   │ │ • Column mapping      │ │ • Entity extraction   │
│                       │ │ • Type inference      │ │ • Relationship detect │
│ CSV:                  │ │                       │ │ • Confidence scoring  │
│ • Header detection    │ │                       │ │                       │
│ • Type inference      │ │                       │ │                       │
└───────────────────────┘ └───────────────────────┘ └───────────────────────┘
                    │                   │                   │
                    └───────────────────┼───────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     ENTITY EXTRACTION                                │
├─────────────────────────────────────────────────────────────────────┤
│  Extract the following entities:                                     │
│                                                                      │
│  1. PROJECT METADATA                                                 │
│     • Project name                                                   │
│     • Description                                                    │
│     • Target space/environment                                       │
│                                                                      │
│  2. DATA SOURCE                                                      │
│     • Connection type (SQL Server, PostgreSQL, REST API...)         │
│     • Server/Host details                                           │
│     • Database name                                                  │
│     • Schema                                                         │
│                                                                      │
│  3. TABLES                                                           │
│     • Table names                                                    │
│     • Table types (Fact/Dimension/Bridge)                           │
│     • Approximate row counts                                         │
│     • Source schema                                                  │
│                                                                      │
│  4. FIELDS (per table)                                               │
│     • Field names                                                    │
│     • Data types (string, integer, date, decimal...)                │
│     • Primary key indicators                                         │
│     • Foreign key relationships                                      │
│     • Nullable flags                                                 │
│     • Incremental field indicators                                   │
│                                                                      │
│  5. RELATIONSHIPS                                                    │
│     • Source table + field                                          │
│     • Target table + field                                          │
│     • Cardinality (1:1, 1:M, M:M)                                   │
│                                                                      │
│  6. INCREMENTAL HINTS                                                │
│     • Which tables need incremental load                            │
│     • Key field for change detection                                │
│     • Time window preferences                                        │
└───────────────────────────────────────┬─────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   PROJECTSTATE BUILDER                               │
├─────────────────────────────────────────────────────────────────────┤
│  Map extracted entities to ProjectState JSON structure:              │
│                                                                      │
│  {                                                                   │
│    id: generateUUID(),                                               │
│    name: extracted.projectName,                                      │
│    entryMode: 'spec',                                               │
│    currentStep: calculateFirstIncompleteStep(),                     │
│    space: mapSpaceConfig(extracted),                                │
│    connection: mapConnectionConfig(extracted),                      │
│    tables: mapTables(extracted),                                    │
│    relationships: mapRelationships(extracted),                      │
│    metadata: {                                                       │
│      sourceDocument: filePath,                                      │
│      parsedAt: new Date().toISOString(),                           │
│      parsedBy: 'spec-parser',                                       │
│      confidence: calculateConfidence()                              │
│    }                                                                 │
│  }                                                                   │
└───────────────────────────────────────┬─────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   VALIDATION & GAPS                                  │
├─────────────────────────────────────────────────────────────────────┤
│  1. Check required fields:                                           │
│     ✓ At least one table defined                                    │
│     ✓ Each table has at least one field                             │
│     ✓ Primary keys identified                                       │
│                                                                      │
│  2. Identify gaps:                                                   │
│     • Missing connection details                                    │
│     • Missing field types                                           │
│     • Unresolved relationships                                      │
│                                                                      │
│  3. Calculate confidence:                                            │
│     HIGH (0.8-1.0): All entities extracted clearly                  │
│     MEDIUM (0.5-0.8): Some inference/assumptions made               │
│     LOW (0.0-0.5): Many gaps, needs user input                      │
└───────────────────────────────────────┬─────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     OUTPUT: SpecExtractionResult                     │
├─────────────────────────────────────────────────────────────────────┤
│  {                                                                   │
│    success: true,                                                    │
│    format: 'excel',                                                  │
│    extracted: { ...ProjectState },                                  │
│    missing: ['connection.password', 'tables[2].fields[0].type'],   │
│    confidence: 0.85                                                  │
│  }                                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Type Definitions

### SpecExtractionResult

```typescript
// src/wizard/types.ts:211-218
export interface SpecExtractionResult {
  success: boolean;           // האם הפרסור הצליח
  format: SpecFormat;         // פורמט הקובץ שזוהה
  extracted: Partial<ProjectState>;  // הנתונים שחולצו
  missing: string[];          // שדות חסרים
  confidence: number;         // רמת ביטחון (0-1)
}

type SpecFormat = 'excel' | 'word' | 'pdf' | 'json' | 'csv' | 'yaml' | 'unknown';
```

### ProjectState (Target Output)

```typescript
// src/wizard/types.ts
export interface ProjectState {
  // === IDENTITY ===
  id: string;                           // UUID ייחודי
  name: string;                         // שם הפרויקט
  description?: string;                 // תיאור

  // === TIMESTAMPS ===
  createdAt: Date;
  updatedAt: Date;

  // === WIZARD STATE ===
  currentStep: WizardStepId;
  entryMode: 'scratch' | 'spec' | 'template';
  completedSteps: WizardStepId[];

  // === CONFIGURATION ===
  space: SpaceConfig | null;
  connection: ConnectionConfig | null;
  tables: TableConfig[];
  relationships?: RelationshipConfig[];

  // === OUTPUTS ===
  generatedScript?: string;
  qvdPath?: string;
  appId?: string;

  // === METADATA ===
  metadata?: {
    sourceDocument?: string;    // נתיב המסמך המקורי
    parsedAt?: string;          // זמן הפרסור
    parsedBy?: string;          // שם הפרסר
    version?: string;
    confidence?: number;        // רמת ביטחון
  };

  // === VALIDATION ===
  lastValidation?: ValidationResult;
}
```

---

## פורמטי קלט נתמכים

### 1. Excel (.xlsx, .xls)

**מבנה מצופה:**

```
Sheet: "Tables"
┌──────────────────────┬──────────┬────────────┬──────────────┐
│ table_name           │ type     │ row_count  │ description  │
├──────────────────────┼──────────┼────────────┼──────────────┤
│ orders               │ Fact     │ 500000     │ הזמנות       │
│ customers            │ Dimension│ 50000      │ לקוחות       │
│ products             │ Dimension│ 10000      │ מוצרים       │
└──────────────────────┴──────────┴────────────┴──────────────┘

Sheet: "Fields"
┌──────────────────┬───────────────┬──────────┬─────┬─────┬─────────────┐
│ table_name       │ field_name    │ type     │ PK  │ FK  │ incremental │
├──────────────────┼───────────────┼──────────┼─────┼─────┼─────────────┤
│ orders           │ order_id      │ integer  │ Y   │     │             │
│ orders           │ customer_id   │ integer  │     │ Y   │             │
│ orders           │ order_date    │ date     │     │     │             │
│ orders           │ modified_date │ datetime │     │     │ Y           │
│ customers        │ customer_id   │ integer  │ Y   │     │             │
│ customers        │ name          │ string   │     │     │             │
└──────────────────┴───────────────┴──────────┴─────┴─────┴─────────────┘

Sheet: "Relationships"
┌──────────────┬───────────────┬──────────────┬───────────────┬─────────────┐
│ from_table   │ from_field    │ to_table     │ to_field      │ cardinality │
├──────────────┼───────────────┼──────────────┼───────────────┼─────────────┤
│ orders       │ customer_id   │ customers    │ customer_id   │ M:1         │
│ order_items  │ order_id      │ orders       │ order_id      │ M:1         │
└──────────────┴───────────────┴──────────────┴───────────────┴─────────────┘
```

**אלגוריתם פרסור:**

```typescript
async function parseExcel(filePath: string): Promise<ExtractedEntities> {
  const workbook = xlsx.readFile(filePath);

  // 1. Find relevant sheets
  const tablesSheet = findSheet(workbook, ['tables', 'טבלאות', 'entities']);
  const fieldsSheet = findSheet(workbook, ['fields', 'שדות', 'columns']);
  const relationsSheet = findSheet(workbook, ['relationships', 'קשרים', 'relations']);

  // 2. Parse each sheet
  const tables = parseTablesSheet(tablesSheet);
  const fields = parseFieldsSheet(fieldsSheet);
  const relationships = parseRelationshipsSheet(relationsSheet);

  // 3. Merge fields into tables
  const mergedTables = mergeFieldsIntoTables(tables, fields);

  return {
    tables: mergedTables,
    relationships,
    confidence: calculateConfidence(tables, fields)
  };
}
```

---

### 2. CSV (.csv)

**מבנה: קובץ טבלאות**

```csv
table_name,table_type,num_fields,approx_rows,key_field,description
olist_orders_dataset,Fact,8,99441,order_id,הזמנות מרכזי
olist_customers_dataset,Dimension,5,99441,customer_id,לקוחות
olist_products_dataset,Dimension,9,32951,product_id,מוצרים
```

**מבנה: קובץ קשרים**

```csv
rel_id,from_table,from_field,to_table,to_field,cardinality,description
REL_01,orders,order_id,order_items,order_id,1:M,הזמנה לפריטים
REL_02,customers,customer_id,orders,customer_id,1:M,לקוח להזמנות
```

**אלגוריתם:**

```typescript
async function parseCSV(filePath: string): Promise<ExtractedEntities> {
  const content = await fs.readFile(filePath, 'utf-8');
  const rows = parseCSVRows(content);

  // Detect type by headers
  const headers = rows[0];

  if (isTablesCSV(headers)) {
    return parseTablesCSV(rows);
  } else if (isRelationshipsCSV(headers)) {
    return parseRelationshipsCSV(rows);
  } else if (isFieldsCSV(headers)) {
    return parseFieldsCSV(rows);
  }

  throw new Error('Unknown CSV format');
}
```

---

### 3. JSON (.json)

**מבנה מצופה:**

```json
{
  "projectName": "Sales Data Model",
  "description": "מודל נתונים למכירות",

  "dataSource": {
    "type": "sqlserver",
    "server": "sql.company.com",
    "database": "SalesDB",
    "schema": "dbo"
  },

  "tables": [
    {
      "name": "orders",
      "type": "fact",
      "fields": [
        { "name": "order_id", "type": "integer", "isPrimaryKey": true },
        { "name": "customer_id", "type": "integer", "isForeignKey": true },
        { "name": "order_date", "type": "date" },
        { "name": "modified_date", "type": "datetime", "isIncremental": true }
      ],
      "incremental": {
        "strategy": "by_date",
        "field": "modified_date"
      }
    },
    {
      "name": "customers",
      "type": "dimension",
      "fields": [
        { "name": "customer_id", "type": "integer", "isPrimaryKey": true },
        { "name": "name", "type": "string" },
        { "name": "city", "type": "string" }
      ],
      "incremental": { "strategy": "none" }
    }
  ],

  "relationships": [
    {
      "from": { "table": "orders", "field": "customer_id" },
      "to": { "table": "customers", "field": "customer_id" },
      "cardinality": "many-to-one"
    }
  ]
}
```

**אלגוריתם:**

```typescript
async function parseJSON(filePath: string): Promise<ExtractedEntities> {
  const content = await fs.readFile(filePath, 'utf-8');
  const spec = JSON.parse(content);

  // Validate against schema
  const validation = validateSpecSchema(spec);
  if (!validation.valid) {
    throw new Error(`Invalid spec: ${validation.errors.join(', ')}`);
  }

  // Direct mapping to ProjectState
  return {
    name: spec.projectName,
    description: spec.description,
    connection: mapDataSource(spec.dataSource),
    tables: spec.tables.map(mapTable),
    relationships: spec.relationships?.map(mapRelationship),
    confidence: 1.0  // JSON is structured, high confidence
  };
}
```

---

### 4. Word/PDF (Unstructured)

**דוגמה לתוכן:**

```
מודל נתונים - מערכת מכירות

1. תיאור כללי
המודל מכיל נתונים של הזמנות, לקוחות ומוצרים.
מקור הנתונים: SQL Server בשרת sql.company.com

2. טבלאות

2.1 טבלת הזמנות (orders) - Fact Table
   - order_id: מספר הזמנה (PK)
   - customer_id: מספר לקוח (FK → customers)
   - order_date: תאריך הזמנה
   - total_amount: סכום כולל
   - modified_date: תאריך עדכון (לטעינה אינקרמנטלית)

2.2 טבלת לקוחות (customers) - Dimension Table
   - customer_id: מספר לקוח (PK)
   - customer_name: שם לקוח
   - city: עיר

3. קשרים
   - orders.customer_id → customers.customer_id (M:1)
```

**אלגוריתם - Claude Integration:**

```typescript
async function parseUnstructured(content: string, format: string): Promise<ExtractedEntities> {
  const claude = new Anthropic({ apiKey: config.claudeApiKey });

  const prompt = `
You are a data model specification parser. Extract structured information from the following ${format} document.

DOCUMENT:
${content}

Extract and return a JSON object with:
1. projectName: The name of the project/model
2. description: A brief description
3. dataSource: { type, server, database, schema } if mentioned
4. tables: Array of tables, each with:
   - name: table name
   - type: "fact" or "dimension"
   - fields: Array of { name, type, isPrimaryKey, isForeignKey, isIncremental }
5. relationships: Array of { fromTable, fromField, toTable, toField, cardinality }

Return ONLY valid JSON, no explanations.
`;

  const response = await claude.messages.create({
    model: config.claudeModel,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }]
  });

  const extracted = JSON.parse(response.content[0].text);

  return {
    ...extracted,
    confidence: calculateAIConfidence(extracted)
  };
}
```

---

## Output JSON - דוגמה מלאה

לאחר פרסור של מסמך איפיון, נוצר ה-JSON הבא:

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Olist E-Commerce Model",
  "description": "Brazilian E-commerce dataset with 9 tables",
  "createdAt": "2026-01-19T10:30:00.000Z",
  "updatedAt": "2026-01-19T10:30:00.000Z",

  "currentStep": "table_selection",
  "entryMode": "spec",
  "completedSteps": [],

  "space": null,

  "connection": {
    "id": null,
    "name": "OlistDB",
    "type": "postgresql",
    "server": "db.olist.com",
    "database": "ecommerce",
    "port": 5432,
    "schema": "public",
    "isNew": true
  },

  "tables": [
    {
      "name": "olist_orders_dataset",
      "schema": "public",
      "alias": "Orders",
      "tableType": "fact",
      "approximateRows": 99441,
      "fields": [
        {
          "name": "order_id",
          "alias": "OrderKey",
          "type": "string",
          "include": true,
          "isPrimaryKey": true,
          "isForeignKey": false,
          "isIncrementalField": false
        },
        {
          "name": "customer_id",
          "type": "string",
          "include": true,
          "isPrimaryKey": false,
          "isForeignKey": true,
          "referencesTable": "olist_customers_dataset",
          "referencesField": "customer_id"
        },
        {
          "name": "order_status",
          "type": "string",
          "include": true
        },
        {
          "name": "order_purchase_timestamp",
          "type": "datetime",
          "include": true,
          "isIncrementalField": true
        },
        {
          "name": "order_approved_at",
          "type": "datetime",
          "include": true
        },
        {
          "name": "order_delivered_carrier_date",
          "type": "datetime",
          "include": true
        },
        {
          "name": "order_delivered_customer_date",
          "type": "datetime",
          "include": true
        },
        {
          "name": "order_estimated_delivery_date",
          "type": "datetime",
          "include": true
        }
      ],
      "incremental": {
        "strategy": "by_date",
        "field": "order_purchase_timestamp",
        "keepHistory": true
      }
    },
    {
      "name": "olist_customers_dataset",
      "schema": "public",
      "alias": "Customers",
      "tableType": "dimension",
      "approximateRows": 99441,
      "fields": [
        {
          "name": "customer_id",
          "type": "string",
          "include": true,
          "isPrimaryKey": true
        },
        {
          "name": "customer_unique_id",
          "type": "string",
          "include": true
        },
        {
          "name": "customer_zip_code_prefix",
          "type": "string",
          "include": true,
          "isForeignKey": true,
          "referencesTable": "olist_geolocation_dataset",
          "referencesField": "geolocation_zip_code_prefix"
        },
        {
          "name": "customer_city",
          "type": "string",
          "include": true
        },
        {
          "name": "customer_state",
          "type": "string",
          "include": true
        }
      ],
      "incremental": {
        "strategy": "none",
        "field": null,
        "keepHistory": false
      }
    },
    {
      "name": "olist_order_items_dataset",
      "schema": "public",
      "alias": "OrderItems",
      "tableType": "fact",
      "approximateRows": 112650,
      "fields": [
        {
          "name": "order_id",
          "type": "string",
          "include": true,
          "isForeignKey": true,
          "referencesTable": "olist_orders_dataset",
          "referencesField": "order_id"
        },
        {
          "name": "order_item_id",
          "type": "integer",
          "include": true,
          "isPrimaryKey": true
        },
        {
          "name": "product_id",
          "type": "string",
          "include": true,
          "isForeignKey": true,
          "referencesTable": "olist_products_dataset",
          "referencesField": "product_id"
        },
        {
          "name": "seller_id",
          "type": "string",
          "include": true,
          "isForeignKey": true,
          "referencesTable": "olist_sellers_dataset",
          "referencesField": "seller_id"
        },
        {
          "name": "shipping_limit_date",
          "type": "datetime",
          "include": true
        },
        {
          "name": "price",
          "type": "decimal",
          "include": true
        },
        {
          "name": "freight_value",
          "type": "decimal",
          "include": true
        }
      ],
      "incremental": {
        "strategy": "by_id",
        "field": "order_item_id",
        "keepHistory": true
      }
    }
  ],

  "relationships": [
    {
      "id": "rel-001",
      "fromTable": "olist_orders_dataset",
      "fromField": "customer_id",
      "toTable": "olist_customers_dataset",
      "toField": "customer_id",
      "cardinality": "many-to-one"
    },
    {
      "id": "rel-002",
      "fromTable": "olist_order_items_dataset",
      "fromField": "order_id",
      "toTable": "olist_orders_dataset",
      "toField": "order_id",
      "cardinality": "many-to-one"
    },
    {
      "id": "rel-003",
      "fromTable": "olist_order_items_dataset",
      "fromField": "product_id",
      "toTable": "olist_products_dataset",
      "toField": "product_id",
      "cardinality": "many-to-one"
    },
    {
      "id": "rel-004",
      "fromTable": "olist_order_items_dataset",
      "fromField": "seller_id",
      "toTable": "olist_sellers_dataset",
      "toField": "seller_id",
      "cardinality": "many-to-one"
    }
  ],

  "qvdPath": "lib://QVD_Storage/Olist/",
  "generatedScript": null,
  "appId": null,

  "metadata": {
    "sourceDocument": "docs/Olist_Tables_Summary.csv",
    "parsedAt": "2026-01-19T10:30:00.000Z",
    "parsedBy": "csv-parser",
    "version": "1.0",
    "confidence": 0.92
  },

  "lastValidation": {
    "isValid": true,
    "errors": [],
    "warnings": [
      "Table 'olist_geolocation_dataset' referenced but not defined",
      "Table 'olist_order_items_dataset' has composite primary key"
    ],
    "validatedAt": "2026-01-19T10:30:05.000Z"
  }
}
```

---

## Confidence Scoring - חישוב רמת ביטחון

```typescript
function calculateConfidence(extracted: ExtractedEntities): number {
  let score = 0;
  let maxScore = 0;

  // Project name (weight: 10)
  maxScore += 10;
  if (extracted.name) score += 10;

  // Tables (weight: 30)
  maxScore += 30;
  if (extracted.tables.length > 0) {
    const tableScore = Math.min(extracted.tables.length * 5, 30);
    score += tableScore;
  }

  // Fields per table (weight: 25)
  maxScore += 25;
  const tablesWithFields = extracted.tables.filter(t => t.fields?.length > 0);
  if (tablesWithFields.length > 0) {
    score += (tablesWithFields.length / extracted.tables.length) * 25;
  }

  // Primary keys identified (weight: 15)
  maxScore += 15;
  const tablesWithPK = extracted.tables.filter(t =>
    t.fields?.some(f => f.isPrimaryKey)
  );
  if (tablesWithPK.length > 0) {
    score += (tablesWithPK.length / extracted.tables.length) * 15;
  }

  // Relationships (weight: 10)
  maxScore += 10;
  if (extracted.relationships?.length > 0) {
    score += Math.min(extracted.relationships.length * 2, 10);
  }

  // Data types (weight: 10)
  maxScore += 10;
  const fieldsWithTypes = extracted.tables.flatMap(t =>
    t.fields?.filter(f => f.type && f.type !== 'unknown') || []
  );
  const totalFields = extracted.tables.flatMap(t => t.fields || []).length;
  if (totalFields > 0) {
    score += (fieldsWithTypes.length / totalFields) * 10;
  }

  return Math.round((score / maxScore) * 100) / 100;
}
```

**Confidence Levels:**

| Score | Level | משמעות |
|-------|-------|--------|
| 0.9 - 1.0 | HIGH | כל הנתונים חולצו בהצלחה |
| 0.7 - 0.9 | MEDIUM | רוב הנתונים חולצו, יש כמה הנחות |
| 0.5 - 0.7 | LOW | נתונים חלקיים, נדרש אישור משתמש |
| 0.0 - 0.5 | VERY LOW | נתונים מינימליים, נדרשת השלמה ידנית |

---

## Integration with Wizard

לאחר הפרסור, ה-ProjectState נטען ל-Wizard:

```typescript
// src/wizard/wizard-engine.ts
async startFromSpec(filePath: string): Promise<ProjectState> {
  // 1. Parse specification
  const result = await this.importFromSpec(filePath);

  if (!result.success) {
    throw new Error(`Failed to parse spec: ${result.missing.join(', ')}`);
  }

  // 2. Create new project with extracted data
  const state = this.createProject({
    name: result.extracted.name || 'Imported Project',
    entryMode: 'spec',
    ...result.extracted
  });

  // 3. Calculate which steps are already complete
  const completedSteps = this.calculateCompletedSteps(state);
  state.completedSteps = completedSteps;

  // 4. Set current step to first incomplete
  state.currentStep = this.getFirstIncompleteStep(completedSteps);

  // 5. Store metadata
  state.metadata = {
    sourceDocument: filePath,
    parsedAt: new Date().toISOString(),
    parsedBy: 'spec-parser',
    confidence: result.confidence
  };

  // 6. Save state
  this.stateStore.setState(state);

  return state;
}

private calculateCompletedSteps(state: ProjectState): WizardStepId[] {
  const completed: WizardStepId[] = [];

  if (state.space?.id) {
    completed.push('space_setup');
  }

  if (state.connection?.server || state.connection?.baseUrl) {
    completed.push('data_source');
  }

  if (state.tables.length > 0) {
    completed.push('table_selection');
  }

  if (state.tables.every(t => t.fields?.length > 0)) {
    completed.push('field_mapping');
  }

  if (state.tables.every(t => t.incremental?.strategy)) {
    completed.push('incremental_config');
  }

  return completed;
}
```

---

## דוגמאות קבצי איפיון

הפרויקט כולל דוגמאות ב-`docs/`:

| קובץ | תיאור | מבנה |
|------|-------|------|
| `Olist_Tables_Summary.csv` | 9 טבלאות עם מטאדאטה | CSV עם headers |
| `Olist_Relationships.csv` | 9 קשרים בין טבלאות | CSV עם headers |
| `Olist_Brazilian_Ecommerce_Specification.docx` | מסמך Word מלא | Unstructured |

---

## מה נדרש למימוש

### ספריות חסרות

```bash
npm install xlsx          # Excel parsing
npm install pdf-parse     # PDF parsing
npm install mammoth       # Word/docx parsing
npm install @anthropic-ai/sdk  # Claude API
npm install yaml          # YAML parsing
```

### קבצים ליצירה

```
src/
├── parsers/
│   ├── index.ts              # Parser factory
│   ├── format-detector.ts    # Format detection
│   ├── excel-parser.ts       # Excel/XLSX
│   ├── csv-parser.ts         # CSV
│   ├── json-parser.ts        # JSON
│   ├── yaml-parser.ts        # YAML
│   ├── unstructured-parser.ts # Word/PDF via Claude
│   └── confidence-calculator.ts
├── services/
│   └── spec-extraction-service.ts
```

---

## סיכום

פרסור האיפיון הוא **הליבה** של QMB - הוא מאפשר למשתמש לייבא מודל נתונים קיים ולהתחיל לעבוד מיידית.

**הזרימה:**
1. משתמש מספק מסמך (Excel/Word/PDF/JSON)
2. המערכת מזהה פורמט ובוחרת parser מתאים
3. Parser מחלץ entities (tables, fields, relationships)
4. נבנה ProjectState JSON
5. מחושבת רמת ביטחון ומזוהים gaps
6. ProjectState נטען ל-Wizard
7. Wizard מדלג על שלבים שכבר מלאים
8. משתמש משלים רק את החסר
