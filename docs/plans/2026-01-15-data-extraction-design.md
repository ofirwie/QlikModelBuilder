# QlikModelBuilder - Data Extraction Design Document

**Date:** 2026-01-15
**Version:** 0.1.0
**Status:** Approved

---

## 1. Product Vision

**Name:** QlikModelBuilder

**Goal:** Reduce Qlik model development time from 20 days to minimum, enable Junior developers to produce Senior-level models.

### Three Phases
| Phase | Description | Status |
|-------|-------------|--------|
| 1 - Data Extraction | Data loading + Incremental Load | **MVP** |
| 2 - ETL | Transformations and data cleaning | Future |
| 3 - GUI | Dashboard and visualization building | Future |

### Target Audience
- Phase 1: Qlik Developers - time savings
- Phase 2: Analysts - independence in building

### Environments
- First: Qlik Cloud
- Later: On-Prem

---

## 2. Architecture

```
QlikModelBuilder MCP
├── Wizard Engine
│   ├── Step Manager - step management + back navigation
│   ├── State Store - project state persistence
│   └── Validation - checks at each step
│
├── Input Processors
│   ├── Spec Reader - reading specs (Word, Excel, PDF)
│   ├── Template Engine - template management
│   └── Interactive Q&A - user questions
│
├── Generators
│   ├── Script Generator - Qlik script generation
│   ├── App Creator - App creation in Qlik Cloud
│   └── Connection Manager - LIB management
│
└── Qlik Cloud Integration
    ├── Spaces API - Space management
    ├── Apps API - App creation and updates
    └── Connections API - Data Connection management
```

**Key Principle:** Each component is independent - can be replaced or extended without breaking others.

---

## 3. Wizard Flow (Phase 1 - Data Extraction)

### Three Entry Points

| Entry | Description |
|-------|-------------|
| From Spec | Upload document, extract automatically |
| From Template | Choose ready template |
| From Scratch | Full Wizard |

### Wizard Steps

| Step | Name | Description | Back? |
|------|------|-------------|-------|
| 1.1 | Project Setup | Name, description, Space | Yes |
| 1.2 | Data Source | Source type + Connection | Yes |
| 1.3 | Table Selection | Select tables/endpoints | Yes |
| 1.4 | Field Mapping | Select fields + types | Yes |
| 1.5 | Incremental Config | Strategy per table | Yes |
| 1.6 | Review & Generate | View script + approve | Yes |
| 1.7 | Deploy | Create App in Qlik | Yes (for fixes) |

---

## 4. Template System

### Template Structure

```
Template
├── metadata.json        # name, description, tags, version
├── source_config.json   # source settings (DB type, connection pattern)
├── tables/              # table templates
│   ├── fact.json        # Fact table pattern
│   ├── dimension.json   # Dimension pattern
│   └── bridge.json      # Bridge/link table pattern
├── incremental/         # incremental strategies
│   ├── by_date.qvs      # by date
│   ├── by_id.qvs        # by ID
│   └── full_reload.qvs  # Full reload
└── scripts/             # ready scripts
    └── base_script.qvs  # base skeleton
```

### Template Types

| Category | Examples |
|----------|----------|
| **By Source** | SQL Server, Oracle, REST API, Excel, JSON |
| **By Pattern** | Fact Table, Dimension, SCD Type 2, Snapshot |
| **By Domain** | Finance, HR, Sales (optional - user adds) |

### Features
- Built-in templates (common sources)
- User can create own templates
- Share templates between users (future)

---

## 5. Spec Reader

### Supported Formats

| Format | How Read | What Extracted |
|--------|----------|----------------|
| **Excel** | Direct sheet reading | Tables, fields, types from columns |
| **Word/PDF** | AI extraction (Claude) | Free text parsing to entities |
| **JSON/YAML** | Direct parsing | Pre-defined structure |

### Extraction Process

1. Auto-detect format
2. Extract available info:
   - Project name
   - Tables
   - Fields and types
   - Relationships
   - Incremental hints
3. What's missing? Ask user

---

## 6. Incremental Strategy Questions

### Smart Question Flow

```
Step 1: "Are there tables requiring incremental loading?"
        │
        ├─ No → Full Reload for all
        │
        └─ Yes → "Which tables?"
                    │
                    ▼
Step 2: For each selected table:
        │
        ├─ "Which field?" (date/ID/other)
        │
        ├─ "What type of load?"
        │   • New records only (Insert only)
        │   • New records + updates (Insert + Update)
        │   • Time window (last week/month)
        │   • Custom
        │
        └─ "Keep history?" (QVD archive)
```

---

## 7. Space Management (First Step)

### Space Selection Flow

```
"Which Space to work in?"
        │
        ├─ Select existing
        ├─ Create new
        └─ Show list
```

### New Space Creation

| Field | Required? | Options |
|-------|-----------|---------|
| Space Name | Yes | Free text |
| Type | Yes | Shared / Managed |
| Description | No | Optional |
| Permissions | No | Default or custom |

**Only after Space exists:**
- Create Data Connections (LIBs)
- Create App
- Save QVDs

---

## 8. Script Generation

### Generated Script Structure

```qlik
//=============================================================
// Project: [Project Name]
// Created: [Date] by QlikModelBuilder
//=============================================================

//-------------------------------------------------------------
// SECTION 1: Variables & Configuration
//-------------------------------------------------------------
SET vLoadDate = Today();
SET vQVDPath = 'lib://QVD_Storage/[ProjectName]/';

//-------------------------------------------------------------
// SECTION 2: Incremental Load - Orders
// Strategy: New records by OrderDate
//-------------------------------------------------------------

// Load existing QVD (if exists)
IF FileSize('$(vQVDPath)Orders.qvd') > 0 THEN
    Orders_Existing:
    LOAD * FROM [$(vQVDPath)Orders.qvd] (qvd);

    LET vMaxDate = Peek('OrderDate', -1, 'Orders_Existing');
END IF

// Load new records from source
Orders_New:
LOAD OrderID, CustomerID, OrderDate, Amount
FROM [lib://DB_Connection/Orders]
WHERE OrderDate > '$(vMaxDate)';

// Concatenate and store
Orders:
LOAD * RESIDENT Orders_Existing;
CONCATENATE LOAD * RESIDENT Orders_New;

DROP TABLES Orders_Existing, Orders_New;

STORE Orders INTO [$(vQVDPath)Orders.qvd] (qvd);

//-------------------------------------------------------------
// SECTION 3: Full Reload - Customers
//-------------------------------------------------------------
Customers:
LOAD * FROM [lib://DB_Connection/Customers];

STORE Customers INTO [$(vQVDPath)Customers.qvd] (qvd);
```

### Principles
- Clear comments for each Section
- Variables at script top
- Separation between Incremental and Full Reload
- STORE to QVD for each table

---

## 9. Qlik Cloud API Integration

### Operations

| Action | API Endpoint | When |
|--------|--------------|------|
| List Spaces | `GET /spaces` | Space selection |
| Create Space | `POST /spaces` | New Space |
| List Connections | `GET /data-connections` | LIB selection |
| Create Connection | `POST /data-connections` | New LIB |
| Create App | `POST /apps` | Deploy |
| Update Script | `PUT /apps/{id}/script` | Write script |
| Reload App | `POST /apps/{id}/reload` | Testing |

### Deploy Flow

1. Verify Space
2. Verify/Create LIB
3. Create new App
4. Upload Script
5. Run Reload
6. Check errors → If any, return to fix

---

## 10. Validation Before Deploy

### Check Order

1. **Variable check**
   - Valid names
   - No duplicates
   - Logical values

2. **Connection check**
   - DB/API connection
   - Read permissions

3. **Table check**
   - Tables exist
   - Fields exist
   - Data types match

4. **Space/LIB check**
   - Write permissions
   - Available space

**If check fails:**
- Show exact error
- Suggest return to relevant step
- Don't allow continue until fixed

---

## 11. API Connection Wizard

### Steps

1. **Base URL**
   - "What is the API Base URL?"

2. **Authentication Type**
   - No Auth (open)
   - API Key (Header / Query param)
   - Bearer Token
   - Basic Auth (user + password)
   - OAuth 2.0

3. **Auth Details**
   - Varies by selection in step 2

4. **Additional Headers**
   - Add custom headers

5. **Test Connection**
   - Verify connection works

### Additional Features

| Feature | Description |
|---------|-------------|
| **Pagination Helper** | Pagination setup - offset, cursor, next link |
| **Response Preview** | View returning JSON + select fields |
| **Templates** | Ready templates for common APIs (Salesforce, HubSpot...) |

---

## 12. Error Handling & Step Navigation

### Error Types

| Error | When Occurs | Action |
|-------|-------------|--------|
| Connection Failed | DB/API connection failed | Return to step 1.2 |
| Table Not Found | Table doesn't exist in source | Return to step 1.3 |
| Field Mismatch | Field doesn't exist/different type | Return to step 1.4 |
| Reload Failed | Script error | Show error + return to relevant step |
| Permission Denied | No Space/LIB permission | Return to step 1.1 |

### State Preserved
- All selections saved
- Return to step = fix only what needed
- Don't start from scratch

---

## 13. MCP Tools

| Tool | Description |
|------|-------------|
| `qmb_start_wizard` | Start new Wizard |
| `qmb_load_spec` | Load spec from file |
| `qmb_list_templates` | Show available templates |
| `qmb_use_template` | Use template |
| `qmb_list_spaces` | Show available Spaces |
| `qmb_create_space` | Create new Space |
| `qmb_list_connections` | Show existing connections |
| `qmb_create_connection` | Create new DB connection |
| `qmb_api_wizard` | API connection helper |
| `qmb_validate` | Check settings |
| `qmb_preview_script` | Show script to be created |
| `qmb_deploy` | Create model in Qlik |
| `qmb_go_back` | Return to step |
| `qmb_status` | Current process status |

### Shortcuts
- `qmb_quick_start` - Quick Wizard with defaults
- `qmb_clone` - Clone existing model with changes

---

## 14. Next Steps

1. **Phase 1 MVP:**
   - Implement Wizard Engine
   - Basic Space management
   - Script Generator for SQL Server
   - Incremental Load support

2. **Phase 1 Complete:**
   - Template system
   - Spec Reader
   - API Connection Wizard
   - Full validation

3. **Phase 2 (ETL):**
   - Transformation logic
   - Data cleaning
   - Field calculations

4. **Phase 3 (GUI):**
   - Dashboard templates
   - Visualization building
   - Object library
