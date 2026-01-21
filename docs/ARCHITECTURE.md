# QlikModelBuilder (QMB) - Architecture Document

## Overview

**QlikModelBuilder** הוא MCP Server (Model Context Protocol) שמשמש כ-Wizard אינטראקטיבי לבניית מודלי Qlik Sense עם תמיכה ב-Incremental Load.

```
Version: 0.1.0 (MVP - Data Extraction Phase)
Stack: TypeScript, Node.js, MCP SDK
License: MIT
```

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    MCP Server (index.ts)                         │
│  • טעינת קונפיגורציה ואימות סביבה                                │
│  • אתחול Qlik API, Adapters, Services                           │
│  • רישום כל ה-Tools והפעלת השרת                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Handlers   │      │  Services    │      │   Wizard     │
│  (40+ tools) │      │  (20+ svcs)  │      │  (7 steps)   │
└──────────────┘      └──────────────┘      └──────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        │                                           │
        ▼                                           ▼
┌──────────────────────┐              ┌──────────────────────┐
│   Adapters           │              │   Config & Utils     │
│ (Cloud/OnPrem)       │              │ (Cache, API, Logs)   │
└──────────────────────┘              └──────────────────────┘
```

---

## Project Structure

```
QlikModelBuilder/
├── src/                           # קוד מקור
│   ├── index.ts                   # Entry point - MCP server
│   ├── adapters/                  # Platform adapters
│   │   ├── base-adapter.ts        # Base abstraction
│   │   ├── cloud-adapter.ts       # Qlik Cloud
│   │   └── onprem-adapter.ts      # On-Premise
│   │
│   ├── config/                    # Configuration
│   │   ├── auth.ts                # Authentication
│   │   ├── constants.ts           # Constants
│   │   ├── qlik-api-config.ts     # @qlik/api init
│   │   └── qlik-config.ts         # Qlik connection
│   │
│   ├── handlers/                  # Tool Handlers (40+)
│   │   ├── qmb-handlers.ts        # Wizard tools
│   │   ├── data-handlers.ts       # Data tools
│   │   ├── intent-handlers.ts     # Intent recognition
│   │   └── ...                    # More handlers
│   │
│   ├── services/                  # Business Logic (20+)
│   │   ├── qmb/                   # QMB-specific
│   │   │   └── qmb-qlik-service.ts
│   │   ├── app-developer-service-simple.ts
│   │   ├── reload-service.ts
│   │   └── ...                    # More services
│   │
│   ├── wizard/                    # Wizard Engine (Core)
│   │   ├── types.ts               # Type definitions
│   │   ├── state-store.ts         # State persistence
│   │   ├── step-manager.ts        # Step navigation
│   │   ├── wizard-engine.ts       # Main orchestration
│   │   ├── script-generator.ts    # Qlik script generation
│   │   └── steps/                 # Step implementations
│   │
│   ├── tools/                     # Tool Definitions
│   │   ├── qmb-tools.ts           # 31 wizard tools
│   │   └── ...                    # More tools
│   │
│   ├── types/                     # Type Definitions
│   │   ├── analysis.ts            # AnalysisOutput
│   │   └── ...
│   │
│   └── utils/                     # Utilities
│       ├── api-client.ts
│       ├── cache-manager.ts
│       └── logger.ts
│
├── vscode-extension/              # VSCode Extension
├── docs/                          # Documentation
├── dist/                          # Compiled output
└── tasks/                         # TaskGuard definitions
```

---

## Wizard Engine - Core Component

ה-Wizard הוא הלב של QMB. הוא מנחה את המשתמש דרך 7 שלבים לבניית מודל נתונים.

### Wizard Steps (7 שלבים)

| Step | Name | תיאור | Output |
|------|------|-------|--------|
| 1 | `space_setup` | בחירת/יצירת Qlik Space | `space` config |
| 2 | `data_source` | הגדרת מקור נתונים | `connection` config |
| 3 | `table_selection` | בחירת טבלאות | `tables[]` names |
| 4 | `field_mapping` | בחירת שדות וטיפוסים | `tables[].fields[]` |
| 5 | `incremental_config` | אסטרטגיית טעינה | `tables[].incremental` |
| 6 | `review` | סקירה ואישור | `generatedScript` |
| 7 | `deploy` | העלאה ל-Qlik Cloud | `appId` |

### Wizard Flow

```
START → space_setup → data_source → table_selection
                                          ↓
                                    field_mapping
                                          ↓
                    deploy ← review ← incremental_config
                      ↓
                    END (App deployed with script)
```

---

## ProjectState JSON - מבנה מפורט

> **זהו ה-JSON שנשמר אחרי פרסור האיפיון (Specification)**

ה-`ProjectState` הוא האובייקט המרכזי שמכיל את כל ההגדרות שנאספו במהלך ה-Wizard. הוא נשמר כ-JSON ומאפשר:
- שמירה וטעינה של פרויקט
- ייצוא ויבוא של הגדרות
- יצירת סקריפט Qlik

### Full JSON Structure

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Sales Data Model",
  "description": "מודל נתונים למכירות עם incremental load",
  "createdAt": "2026-01-19T10:30:00.000Z",
  "updatedAt": "2026-01-19T14:45:00.000Z",

  "currentStep": "review",
  "entryMode": "spec",
  "completedSteps": [
    "space_setup",
    "data_source",
    "table_selection",
    "field_mapping",
    "incremental_config"
  ],

  "space": {
    "id": "65a4b3c2d1e0f9876543210",
    "name": "Production Analytics",
    "type": "managed",
    "isNew": false,
    "ownerId": "user-123"
  },

  "connection": {
    "id": "conn-abc123",
    "name": "SalesDB",
    "type": "sqlserver",
    "server": "sql.company.com",
    "database": "SalesData",
    "port": 1433,
    "schema": "dbo",
    "authentication": "windows",
    "isNew": false
  },

  "tables": [
    {
      "name": "orders",
      "schema": "dbo",
      "alias": "Orders",
      "tableType": "fact",
      "approximateRows": 500000,
      "fields": [
        {
          "name": "order_id",
          "alias": "OrderKey",
          "type": "integer",
          "include": true,
          "isPrimaryKey": true,
          "isIncrementalField": false,
          "isNullable": false
        },
        {
          "name": "customer_id",
          "alias": "CustomerKey",
          "type": "integer",
          "include": true,
          "isPrimaryKey": false,
          "isForeignKey": true,
          "referencesTable": "customers",
          "referencesField": "customer_id"
        },
        {
          "name": "order_date",
          "alias": "OrderDate",
          "type": "date",
          "include": true,
          "isPrimaryKey": false
        },
        {
          "name": "total_amount",
          "alias": "Amount",
          "type": "decimal",
          "include": true,
          "precision": 18,
          "scale": 2
        },
        {
          "name": "modified_date",
          "alias": "ModifiedDate",
          "type": "datetime",
          "include": true,
          "isIncrementalField": true
        }
      ],
      "incremental": {
        "strategy": "by_date",
        "field": "modified_date",
        "keepHistory": true,
        "windowSize": null,
        "windowUnit": null
      }
    },
    {
      "name": "customers",
      "schema": "dbo",
      "alias": "Customers",
      "tableType": "dimension",
      "approximateRows": 50000,
      "fields": [
        {
          "name": "customer_id",
          "alias": "CustomerKey",
          "type": "integer",
          "include": true,
          "isPrimaryKey": true
        },
        {
          "name": "customer_name",
          "alias": "CustomerName",
          "type": "string",
          "include": true,
          "maxLength": 255
        },
        {
          "name": "city",
          "alias": "City",
          "type": "string",
          "include": true
        },
        {
          "name": "segment",
          "alias": "Segment",
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
      "name": "order_items",
      "schema": "dbo",
      "alias": "OrderItems",
      "tableType": "fact",
      "approximateRows": 1500000,
      "fields": [
        {
          "name": "order_id",
          "type": "integer",
          "include": true,
          "isForeignKey": true
        },
        {
          "name": "item_id",
          "type": "integer",
          "include": true,
          "isPrimaryKey": true
        },
        {
          "name": "product_id",
          "type": "integer",
          "include": true,
          "isForeignKey": true
        },
        {
          "name": "quantity",
          "type": "integer",
          "include": true
        },
        {
          "name": "unit_price",
          "type": "decimal",
          "include": true
        }
      ],
      "incremental": {
        "strategy": "by_id",
        "field": "item_id",
        "keepHistory": true
      }
    }
  ],

  "relationships": [
    {
      "id": "rel-001",
      "fromTable": "orders",
      "fromField": "customer_id",
      "toTable": "customers",
      "toField": "customer_id",
      "cardinality": "many-to-one"
    },
    {
      "id": "rel-002",
      "fromTable": "order_items",
      "fromField": "order_id",
      "toTable": "orders",
      "toField": "order_id",
      "cardinality": "many-to-one"
    }
  ],

  "qvdPath": "lib://QVD_Storage/Sales/",
  "generatedScript": "// Generated Qlik Load Script\n// Project: Sales Data Model\n...",
  "appId": null,

  "metadata": {
    "sourceDocument": "Sales_Specification.xlsx",
    "parsedAt": "2026-01-19T10:30:00.000Z",
    "parsedBy": "spec-parser",
    "version": "1.0"
  },

  "lastValidation": {
    "isValid": true,
    "errors": [],
    "warnings": [
      "Table 'order_items' has 1.5M rows - consider partitioning"
    ],
    "validatedAt": "2026-01-19T14:40:00.000Z"
  }
}
```

---

## JSON Fields Explanation - הסבר שדות

### Root Level Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | מזהה ייחודי של הפרויקט |
| `name` | string | שם הפרויקט |
| `description` | string? | תיאור אופציונלי |
| `createdAt` | ISO-8601 | זמן יצירה |
| `updatedAt` | ISO-8601 | זמן עדכון אחרון |
| `currentStep` | WizardStepId | השלב הנוכחי ב-Wizard |
| `entryMode` | 'scratch' \| 'spec' \| 'template' | מצב כניסה |
| `completedSteps` | WizardStepId[] | שלבים שהושלמו |

### Space Configuration

```typescript
interface SpaceConfig {
  id: string;           // מזהה ה-Space ב-Qlik Cloud
  name: string;         // שם ה-Space
  type: 'personal' | 'shared' | 'managed';
  isNew: boolean;       // האם נוצר חדש או נבחר קיים
  ownerId?: string;     // בעלים (אם managed)
}
```

### Connection Configuration

```typescript
interface ConnectionConfig {
  id: string;           // מזהה החיבור
  name: string;         // שם החיבור (lib://NAME)
  type: 'sqlserver' | 'postgresql' | 'mysql' | 'oracle' | 'rest_api' | 'folder';

  // Database connections
  server?: string;      // כתובת השרת
  database?: string;    // שם הדאטהבייס
  port?: number;        // פורט
  schema?: string;      // סכמה (dbo, public, etc)
  authentication?: 'sql' | 'windows' | 'oauth';

  // REST API
  baseUrl?: string;     // URL בסיסי
  authType?: 'bearer' | 'basic' | 'oauth2';

  // File folder
  folderPath?: string;  // נתיב לתיקייה

  isNew: boolean;       // חיבור חדש או קיים
}
```

### Table Configuration

```typescript
interface TableConfig {
  name: string;              // שם הטבלה במקור
  schema?: string;           // סכמה (dbo, public)
  alias?: string;            // שם ב-Qlik (אופציונלי)
  tableType: 'fact' | 'dimension' | 'bridge' | 'calendar';
  approximateRows?: number;  // הערכת מספר שורות

  fields: FieldConfig[];     // רשימת השדות
  incremental: IncrementalConfig;  // הגדרות incremental
}
```

### Field Configuration

```typescript
interface FieldConfig {
  name: string;              // שם השדה במקור
  alias?: string;            // שם ב-Qlik
  type: FieldType;           // טיפוס הנתונים
  include: boolean;          // האם לכלול בטעינה

  // Key flags
  isPrimaryKey?: boolean;    // מפתח ראשי
  isForeignKey?: boolean;    // מפתח זר
  referencesTable?: string;  // טבלה מקושרת
  referencesField?: string;  // שדה מקושר

  // Incremental flag
  isIncrementalField?: boolean;  // שדה לזיהוי שינויים

  // Type-specific
  maxLength?: number;        // לטקסט
  precision?: number;        // לדצימל
  scale?: number;            // לדצימל
  isNullable?: boolean;      // מאפשר NULL
}

type FieldType =
  | 'string' | 'integer' | 'decimal' | 'date'
  | 'datetime' | 'time' | 'boolean' | 'binary';
```

### Incremental Configuration

```typescript
interface IncrementalConfig {
  strategy: IncrementalStrategy;
  field: string | null;      // שדה לזיהוי שינויים
  keepHistory: boolean;      // לשמור היסטוריה
  windowSize?: number;       // גודל חלון (ל-time_window)
  windowUnit?: 'days' | 'weeks' | 'months';
  customLogic?: string;      // לוגיקה מותאמת
}

type IncrementalStrategy =
  | 'none'         // Full reload - לטבלאות קטנות
  | 'by_date'      // לפי תאריך שינוי
  | 'by_id'        // לפי ID עולה
  | 'time_window'  // חלון זמן (N ימים אחרונים)
  | 'custom';      // לוגיקה מותאמת אישית
```

### Relationships

```typescript
interface Relationship {
  id: string;
  fromTable: string;         // טבלת מקור
  fromField: string;         // שדה מקור
  toTable: string;           // טבלת יעד
  toField: string;           // שדה יעד
  cardinality: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
}
```

---

## Entry Modes - מצבי כניסה

ה-Wizard תומך ב-3 מצבי כניסה:

### 1. `scratch` - התחלה מאפס
```json
{
  "entryMode": "scratch",
  "tables": [],
  "connection": null
}
```
המשתמש בונה הכל מאפס.

### 2. `spec` - מתוך מפרט (Specification)
```json
{
  "entryMode": "spec",
  "metadata": {
    "sourceDocument": "DataModel_Spec.xlsx",
    "parsedAt": "2026-01-19T10:30:00.000Z"
  }
}
```
ה-JSON נבנה אוטומטית מפרסור של מסמך (Excel, Word, PDF).

### 3. `template` - מתבנית
```json
{
  "entryMode": "template",
  "metadata": {
    "templateId": "ecommerce-standard",
    "templateVersion": "1.2"
  }
}
```
שימוש בתבנית מוכנה מראש.

---

## Incremental Strategies - אסטרטגיות טעינה

### 1. `none` - Full Reload
- **שימוש:** טבלאות קטנות (dimensions)
- **Script Pattern:**
```qlik
customers:
LOAD * FROM [lib://SalesDB/dbo.customers];
STORE customers INTO [$(vQVDPath)customers.qvd] (qvd);
```

### 2. `by_date` - לפי תאריך
- **שימוש:** Fact tables עם שדה ModifiedDate
- **Script Pattern:**
```qlik
// Load existing
IF FileSize('$(vQVDPath)orders.qvd') > 0 THEN
  orders_Existing: LOAD * FROM [orders.qvd] (qvd);
  LET vMaxDate = Peek('ModifiedDate', -1, 'orders_Existing');
END IF

// Load new records
orders_New:
LOAD * FROM [lib://SalesDB/dbo.orders]
WHERE ModifiedDate > '$(vMaxDate)';

// Merge
orders:
NOCONCATENATE LOAD * RESIDENT orders_Existing;
CONCATENATE LOAD * RESIDENT orders_New;
DROP TABLES orders_Existing, orders_New;
STORE orders INTO [$(vQVDPath)orders.qvd] (qvd);
```

### 3. `by_id` - לפי ID
- **שימוש:** טבלאות עם auto-increment ID
- **Script Pattern:**
```qlik
LET vMaxId = Peek('item_id', -1, 'order_items_Existing');
order_items_New:
LOAD * FROM [...] WHERE item_id > $(vMaxId);
```

### 4. `time_window` - חלון זמן
- **שימוש:** ניתוח של N ימים/שבועות אחרונים
- **Config:**
```json
{
  "strategy": "time_window",
  "field": "created_at",
  "windowSize": 90,
  "windowUnit": "days"
}
```

### 5. `custom` - לוגיקה מותאמת
- **שימוש:** מקרים מיוחדים
- **Config:**
```json
{
  "strategy": "custom",
  "customLogic": "WHERE status = 'ACTIVE' AND region = 'IL'"
}
```

---

## State Persistence - שמירת מצב

### Export State
```
Tool: qmb_export_state
Output: Full ProjectState as JSON string
```

### Import State
```
Tool: qmb_import_state
Input: JSON string
Result: Restores entire wizard state
```

### Snapshots
```typescript
// Save checkpoint
stateStore.saveSnapshot('before_deploy');

// Restore if needed
stateStore.restoreSnapshot('before_deploy');
```

---

## Validation Structure

```json
{
  "lastValidation": {
    "isValid": true,
    "errors": [],
    "warnings": [
      "Table 'orders' has no primary key defined",
      "Consider adding index on 'customer_id'"
    ],
    "suggestions": [
      "Use 'by_date' strategy for 'orders' table"
    ],
    "validatedAt": "2026-01-19T14:40:00.000Z"
  }
}
```

---

## Technologies & Dependencies

### Runtime
- Node.js ≥18.0.0
- TypeScript 5.3.3

### Key Packages
```json
{
  "@modelcontextprotocol/sdk": "^0.5.0",
  "@qlik/api": "^2.2.0",
  "enigma.js": "^2.14.0",
  "axios": "^1.10.0",
  "uuid": "^13.0.0",
  "lru-cache": "^11.1.0"
}
```

---

## Related Files

| File | Purpose |
|------|---------|
| [src/wizard/types.ts](src/wizard/types.ts) | TypeScript definitions for ProjectState |
| [src/wizard/state-store.ts](src/wizard/state-store.ts) | State management & persistence |
| [src/wizard/script-generator.ts](src/wizard/script-generator.ts) | Qlik script generation |
| [src/types/analysis.ts](src/types/analysis.ts) | Analysis output types |
| [src/handlers/qmb-handlers.ts](src/handlers/qmb-handlers.ts) | Wizard tool handlers |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2026-01 | MVP - Data Extraction Phase |
