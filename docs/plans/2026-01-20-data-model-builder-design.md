# QlikModelBuilder - Data Model Builder Design Document

**Date:** 2026-01-20
**Version:** 1.1.0 (Complete + Logging)
**Status:** Ready for Review
**Session:** Brainstorming with Claude Code

---

## Document Purpose

This document captures the complete design for **Stage 2: Data Model Builder** of Phase B.
It defines how the system transforms JSON from Stage 1 (Parser) into a complete Qlik data model.

---

## 1. Context & Background

### Where This Fits

```
PHASE B PIPELINE:
┌─────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────┐
│ Stage 1 │ →  │   Stage 2   │ →  │   Stage 3   │ →  │ Stage 4 │
│ Parser  │    │ Data Model  │    │ Script Gen  │    │ Output  │
│         │    │  Builder    │    │             │    │         │
└─────────┘    └─────────────┘    └─────────────┘    └─────────┘
Word/PDF        JSON → Model      Model → Script    Tables+GUI
  ↓                 ↓                  ↓                ↓
 JSON           Star/Snow/Link      Qlik Code         QVD+App
```

### Related Documents

- `docs/PHASE_B_SPEC.md` (v0.4) - Full Phase B specification
- `docs/plans/2026-01-15-data-extraction-design.md` - Phase 1 design
- `docs/KNOWLEDGE_BASE.md` - Qlik best practices and methodology

### Prerequisites

- Stage 1 (Parser) completed - outputs JSON
- DB Load App completed - QVD files exist
- PHASE_B_SPEC.md approved by Gemini (10/10)

---

## 2. Decisions Made

### 2.1 Model Types Supported

**Decision:** Support ALL model types, not just Star Schema.

| Model Type | When Used |
|------------|-----------|
| **Star Schema** | Default - Fact center with Dimensions around |
| **Snowflake** | When Dimensions have hierarchies (Country→Region→City) |
| **Link Tables** | When N:M relationships between Facts |
| **Concatenated Facts** | When multiple similar Facts (Sales + Budget) |

**Reasoning:** Not every data model is Star Schema. System must identify the BEST model for the specific data.

---

### 2.2 Model Selection Approach

**Decision:** System proposes options with pros/cons, user has dialogue.

**NOT:** Automatic selection
**NOT:** User picks from dropdown
**YES:** Interactive conversation where:
1. System analyzes data
2. System explains options with pros/cons
3. System gives recommendation with reasoning
4. User can ask questions
5. User approves or requests changes

---

### 2.3 Input Sources

**Decision:** Two input sources combined.

**Source 1: JSON from Stage 1 (Parser)**
```json
{
  "tables": [...],
  "fields": [...],
  "field_types": [...],
  "relationship_hints": [...]
}
```

**Source 2: Sample Data from QVD (after DB Load)**
- 100 rows per table
- Distinct values per field
- NULL count per field
- Cardinality (unique value count)
- Row count

**Important:** At spec level (Stage 1) there's no sample data.
Sample data becomes available AFTER DB Load App creates QVD files.

---

### 2.4 Synthetic Key Prevention

**Decision:** QUALIFY * on ALL fields EXCEPT key fields.

```qlik
// Prevent Synthetic Keys
QUALIFY *;

// Load with qualified fields
Orders:
LOAD * FROM orders.qvd;

// Unqualify only the keys that need to connect
UNQUALIFY CustomerID, ProductID;
```

**Reasoning:** This prevents accidental synthetic keys from fields with same names in different tables.

---

### 2.5 User Interface

**Decision:** Claude Code CLI + Chat-like dialogue with Gemini review.

**NOT:** Standalone VSCode Extension UI
**NOT:** Web Interface
**YES:** Chat through Claude Code where:
- User talks to Claude
- Claude builds the model/script
- Gemini reviews and provides feedback
- Claude shows results and recommendations
- User approves or requests changes

**On-Prem Consideration:** Both Claude API and Gemini Pro 1.5 API will be available.

---

### 2.6 AI Architecture

**Decision:** Two AI systems in dialogue.

```
User ←→ Claude Code ←→ Gemini Pro 1.5
              ↓              ↓
         Builds Script   Reviews Script
              ↓              ↓
         Receives Feedback   Provides Feedback
              ↓
         Fixes Issues
```

**Roles:**
- **Claude:** Builds the Qlik script based on model decisions
- **Gemini:** Reviews the script, checks for issues, provides feedback

---

### 2.7 Review Loop Rounds

**Decision:** Tiered approach with user control.

| Round | Behavior |
|-------|----------|
| **Round 1** | Automatic: Claude builds → Gemini reviews → Result |
| **Rounds 2-3** | Only if user requests WITH justification ("why another round?") |
| **Round 4+** | HITL - Manual approval required for each round |

**Scope Guard:** System ONLY processes code-related requests to prevent abuse.

---

### 2.8 Gemini Review Scope

**Decision:** Comprehensive review - everything.

| Category | What's Checked |
|----------|----------------|
| **Syntax** | Valid Qlik code, no errors |
| **Best Practices** | QUALIFY usage, AutoNumber, no LOAD *, etc. |
| **Anti-Patterns** | Synthetic Keys, Circular References, God Tables |
| **Model Size** | Estimated impact on model size (Cloud has size limits, not RAM) |

**Note:** Cloud has model SIZE limits, not RAM limits. We can't measure actual performance, but we know best practices.

---

### 2.9 Issue Reporting Format

**Decision:** Structured JSON for each issue found.

```json
{
  "issue_id": "AP-001",
  "severity": "critical | warning | info",
  "category": "syntax | anti-pattern | best-practice | model-size",
  "title": "Synthetic Key Detected",
  "location": {
    "table": "FACT_Orders",
    "line": 45,
    "field": "CustomerID"
  },
  "description": "Two shared fields create synthetic key",
  "recommendation": "Use QUALIFY or rename fields",
  "fix_example": "QUALIFY CustomerID;",
  "best_practice_ref": "Appendix: Anti-Patterns",
  "estimated_impact": "Increases model size, slows calculations"
}
```

---

### 2.10 Fix Application

**Decision:** Claude shows planned fixes, user approves before execution.

**NOT:** Automatic fix of all issues
**NOT:** Fix only critical automatically
**YES:**
1. Claude analyzes Gemini's feedback
2. Claude prepares list of fixes
3. Claude shows user: "I plan to fix these issues: [list]"
4. User reviews and approves
5. Only then Claude applies fixes

---

### 2.11 AutoNumber Usage

**Decision:** AutoNumber only when user explicitly requests.

| Situation | Behavior |
|-----------|----------|
| **Default** | No AutoNumber - keeps original values for easier debugging |
| **User requests** | Add AutoNumber to all keys |
| **Very large model** | Suggest to user: "AutoNumber can save ~60% RAM. Enable?" |
| **Long composite key** | Suggest: "3+ field composite key, recommend AutoNumberHash128" |

**Reasoning:** AutoNumber helps performance but makes debugging harder.

---

### 2.12 Calendar Generation

**Decision:** Separate Master Calendar for each date field.

**NOT:** One shared calendar for all dates
**YES:** Each date field gets its own calendar dimension

Example:
- `FACT_Orders.OrderDate` → `DIM_OrderDate`
- `FACT_Orders.ShipDate` → `DIM_ShipDate`
- `DIM_Customers.CreatedDate` → `DIM_CreatedDate`

**Language:** Configurable (EN, HE, AR, etc.) - project is multilingual.

---

### 2.13 Script Building Approach

**Decision:** Build script in stages with approval at each stage.

**NOT:** Build entire script at once
**YES:** 6 stages with user approval after each:
1. Configuration
2. Dimensions (each table separately)
3. Facts (each table separately)
4. Link Tables (if needed)
5. Calendars
6. STORE + Cleanup

---

## 3. Architecture Design

### 3.1 High-Level Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    DATA MODEL BUILDER                           │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │   INPUT     │    │  ANALYZER   │    │  BUILDER    │        │
│  │  Processor  │ →  │   Engine    │ →  │   Engine    │        │
│  └─────────────┘    └─────────────┘    └─────────────┘        │
│        ↓                  ↓                  ↓                 │
│   JSON + QVD         Model Type         Qlik Script           │
│   Sample Data        Detection          Generation            │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│                    REVIEW LOOP                                  │
│  ┌─────────────┐              ┌─────────────┐                  │
│  │   CLAUDE    │ ←─────────── │   GEMINI    │                  │
│  │   Builder   │ ───────────→ │   Reviewer  │                  │
│  └─────────────┘   Script     └─────────────┘                  │
│        ↑           + Issues         │                          │
│        │                            │                          │
│        └────────── Feedback ────────┘                          │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│                    USER INTERFACE                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Claude Code CLI + Chat Interface                        │   │
│  │  • Present options and recommendations                   │   │
│  │  • Dialogue with user                                    │   │
│  │  • Approve fixes before execution                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

### 3.2 Input Processor

```
┌─────────────────────────────────────────────────────────────┐
│                    INPUT PROCESSOR                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  SOURCE 1: JSON from Stage 1 (Parser)                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ {                                                    │    │
│  │   "tables": [...],                                   │    │
│  │   "fields": [...],                                   │    │
│  │   "field_types": [...],                              │    │
│  │   "relationship_hints": [...]                        │    │
│  │ }                                                    │    │
│  └─────────────────────────────────────────────────────┘    │
│                          +                                   │
│  SOURCE 2: Sample Data from QVD (after DB Load)             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ • 100 rows per table                                 │    │
│  │ • Distinct values per field                          │    │
│  │ • NULL count per field                               │    │
│  │ • Cardinality (unique value count)                   │    │
│  └─────────────────────────────────────────────────────┘    │
│                          ↓                                   │
│  OUTPUT: Enriched Model Spec                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ {                                                    │    │
│  │   "tables": [{                                       │    │
│  │     "name": "Orders",                                │    │
│  │     "row_count": 150000,                             │    │
│  │     "fields": [{                                     │    │
│  │       "name": "CustomerID",                          │    │
│  │       "type": "string",                              │    │
│  │       "cardinality": 5230,                           │    │
│  │       "null_percent": 0.02,                          │    │
│  │       "sample_values": ["C001", "C002", ...]         │    │
│  │     }]                                               │    │
│  │   }]                                                 │    │
│  │ }                                                    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Why Sample Data Matters:**

| Data | Usage |
|------|-------|
| **Cardinality** | Identify Fact vs Dimension (high cardinality = Fact) |
| **NULL percent** | Identify optional fields |
| **Sample values** | Identify keys (similar format between tables) |
| **Row count** | Estimate final model size |

---

### 3.3 Analyzer Engine

```
┌─────────────────────────────────────────────────────────────┐
│                    ANALYZER ENGINE                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  INPUT: Enriched Model Spec                                  │
│                     ↓                                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │            CLASSIFICATION RULES                      │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │                                                      │    │
│  │  FACT Detection:                                     │    │
│  │  • Cardinality high (>10K rows)                      │    │
│  │  • Numeric fields (Amount, Quantity, Total)          │    │
│  │  • Date fields (OrderDate, CreatedAt)                │    │
│  │  • Contains FK to other tables                       │    │
│  │                                                      │    │
│  │  DIMENSION Detection:                                │    │
│  │  • Cardinality low relative (<10K rows)              │    │
│  │  • Descriptive fields (Name, Description, Category)  │    │
│  │  • Unique PK                                         │    │
│  │  • Used as lookup                                    │    │
│  │                                                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                     ↓                                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │            MODEL TYPE DETECTION                      │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │                                                      │    │
│  │  IF: Dimension → Dimension relationship              │    │
│  │      → SNOWFLAKE                                     │    │
│  │                                                      │    │
│  │  IF: Fact ←→ Fact relationship (N:M)                 │    │
│  │      → LINK TABLE needed                             │    │
│  │                                                      │    │
│  │  IF: Multiple Facts with same dimensions             │    │
│  │      → CONCATENATED FACTS candidate                  │    │
│  │                                                      │    │
│  │  ELSE: → STAR SCHEMA                                 │    │
│  │                                                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Output: Recommendations to User**

```json
{
  "recommended_model": "star_schema",
  "confidence": 0.85,
  "alternatives": [
    {
      "model": "snowflake",
      "reason": "Geography has hierarchy (Country→Region→City)",
      "pros": ["Preserves natural hierarchy", "Easy to maintain"],
      "cons": ["More JOINs", "Slightly slower"]
    }
  ],
  "classifications": {
    "facts": ["Orders", "Returns"],
    "dimensions": ["Customers", "Products", "Geography"]
  }
}
```

---

### 3.4 Builder Engine

```
┌─────────────────────────────────────────────────────────────┐
│                    BUILDER ENGINE                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  INPUT: Model Spec (from Analyzer)                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ {                                                    │    │
│  │   "model_type": "star_schema",                       │    │
│  │   "facts": ["Orders"],                               │    │
│  │   "dimensions": ["Customers", "Products", "Date"],   │    │
│  │   "relationships": [...],                            │    │
│  │   "keys": {...}                                      │    │
│  │ }                                                    │    │
│  └─────────────────────────────────────────────────────┘    │
│                          ↓                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │            SCRIPT GENERATION STEPS                   │    │
│  │                                                      │    │
│  │  1. QUALIFY * (Synthetic Key prevention)            │    │
│  │  2. Variables Section (vPath, vReloadDate)          │    │
│  │  3. Dimension Tables                                │    │
│  │  4. Fact Tables (with FK references)                │    │
│  │  5. Link Tables (if needed)                         │    │
│  │  6. Calendar Tables (per date field)                │    │
│  │  7. UNQUALIFY for keys only                         │    │
│  │  8. STORE to QVD                                    │    │
│  │                                                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                          ↓                                   │
│  OUTPUT: Complete Qlik Load Script                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Script Generation Order:**

| Step | What's Created | Why This Order |
|------|----------------|----------------|
| 1 | `QUALIFY *` | Must be first - prevents issues |
| 2 | Variables | Global definitions before use |
| 3 | Dimensions | Loaded before Facts (Facts reference them) |
| 4 | Facts | After Dimensions - have FK |
| 5 | Link Tables | After Facts - connect between Facts |
| 6 | Calendars | Last - connect to all date fields |
| 7 | `UNQUALIFY` | Only for keys that need to connect |
| 8 | STORE | Save to QVD |

---

### 3.5 Script Template (Default - No AutoNumber)

```qlik
//=============================================================
// Project: [ProjectName]
// Created: [Date] by QlikModelBuilder
// Model Type: [star_schema | snowflake | link_table | concatenated]
//=============================================================

//-------------------------------------------------------------
// SECTION 0: QUALIFY ALL (Synthetic Key Prevention)
//-------------------------------------------------------------
QUALIFY *;

//-------------------------------------------------------------
// SECTION 1: Variables & Configuration
//-------------------------------------------------------------
SET vPathQVD = 'lib://QVD/[ProjectName]/';
SET vPathDB = 'lib://DB/';
SET vReloadDate = Today();
SET vReloadTime = Now();
SET vCalendarLanguage = 'EN';  // EN | HE | AR | ...

//-------------------------------------------------------------
// SECTION 2: Dimensions
//-------------------------------------------------------------

// DIM_Customers
DIM_Customers:
LOAD
    CustomerID AS CustomerKey,    // PK - keeps original value
    CustomerName,
    City,
    Country
FROM [$(vPathQVD)customers.qvd] (qvd);

// DIM_Products
DIM_Products:
LOAD
    ProductID AS ProductKey,      // PK - keeps original value
    ProductName,
    Category,
    Brand
FROM [$(vPathQVD)products.qvd] (qvd);

//-------------------------------------------------------------
// SECTION 3: Facts
//-------------------------------------------------------------

// FACT_Orders
FACT_Orders:
LOAD
    OrderID AS OrderKey,
    CustomerID AS CustomerKey,    // FK to DIM_Customers
    ProductID AS ProductKey,      // FK to DIM_Products
    OrderDate,
    Quantity,
    Amount
FROM [$(vPathQVD)orders.qvd] (qvd);

//-------------------------------------------------------------
// SECTION 4: Calendars (Per Date Field)
//-------------------------------------------------------------
// [See Calendar Template below]

//-------------------------------------------------------------
// SECTION 5: UNQUALIFY Keys Only
//-------------------------------------------------------------
UNQUALIFY CustomerKey, ProductKey, OrderKey, DateKey;

//-------------------------------------------------------------
// SECTION 6: Store to Final QVD
//-------------------------------------------------------------
STORE DIM_Customers INTO [$(vPathQVD)Final/DIM_Customers.qvd] (qvd);
STORE DIM_Products INTO [$(vPathQVD)Final/DIM_Products.qvd] (qvd);
STORE FACT_Orders INTO [$(vPathQVD)Final/FACT_Orders.qvd] (qvd);
```

---

### 3.6 Calendar Template (Per Date Field, Multilingual)

```qlik
//-------------------------------------------------------------
// Master Calendar Generator - Per Date Field
//-------------------------------------------------------------

SUB CreateMasterCalendar(vFieldName, vMinDate, vMaxDate)

    // Generate base dates
    TempCal_$(vFieldName):
    LOAD
        Date($(vMinDate) + RowNo() - 1) AS TempDate
    AUTOGENERATE $(vMaxDate) - $(vMinDate) + 1;

    // Create DIM for this specific date field
    DIM_$(vFieldName):
    LOAD
        TempDate AS $(vFieldName),           // Links to original field
        Year(TempDate) AS $(vFieldName)_Year,
        Month(TempDate) AS $(vFieldName)_MonthNum,
        Date(MonthStart(TempDate), 'MMM-YYYY') AS $(vFieldName)_MonthYear,
        Day(TempDate) AS $(vFieldName)_Day,
        Week(TempDate) AS $(vFieldName)_Week,
        'Q' & Ceil(Month(TempDate)/3) AS $(vFieldName)_Quarter,
        // Language-aware month name
        $(IF(vCalendarLanguage='HE',
            Pick(Month(TempDate), 'ינואר','פברואר','מרץ','אפריל','מאי','יוני',
                 'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'),
            Pick(Month(TempDate), 'Jan','Feb','Mar','Apr','May','Jun',
                 'Jul','Aug','Sep','Oct','Nov','Dec'))) AS $(vFieldName)_MonthName
    RESIDENT TempCal_$(vFieldName);

    DROP TABLE TempCal_$(vFieldName);

END SUB

// Generate Calendar for each date field
CALL CreateMasterCalendar('OrderDate', Num(MakeDate(2020,1,1)), Num(MakeDate(2027,1,20)));
CALL CreateMasterCalendar('ShipDate', Num(MakeDate(2020,1,1)), Num(MakeDate(2027,1,20)));
```

**Output per Calendar:**

| Source Field | Calendar Table | Generated Fields |
|--------------|----------------|------------------|
| `OrderDate` | `DIM_OrderDate` | OrderDate_Year, OrderDate_Month, OrderDate_Quarter... |
| `ShipDate` | `DIM_ShipDate` | ShipDate_Year, ShipDate_Month, ShipDate_Quarter... |

---

## 4. Review Loop

### 4.1 Gemini Review Prompt

```
SYSTEM PROMPT:
┌─────────────────────────────────────────────────────────────┐
│  You are a Qlik Sense expert reviewer.                      │
│  Review the following Qlik Load Script and check:           │
│                                                             │
│  1. SYNTAX: Valid Qlik syntax, no errors                   │
│  2. BEST PRACTICES:                                         │
│     - QUALIFY * used correctly                              │
│     - No LOAD * (selective fields only)                    │
│     - Variables defined before use                          │
│     - STORE to QVD for each table                          │
│  3. ANTI-PATTERNS:                                          │
│     - Synthetic Keys (shared fields between tables)        │
│     - Circular References                                   │
│     - God Tables (>50 fields)                              │
│  4. MODEL SIZE:                                             │
│     - High cardinality Link Tables                         │
│     - Unnecessary fields loaded                             │
│                                                             │
│  Return issues as JSON array.                               │
│  If no issues found, return empty array.                   │
└─────────────────────────────────────────────────────────────┘

USER PROMPT:
┌─────────────────────────────────────────────────────────────┐
│  Review this script:                                        │
│  ```qlik                                                    │
│  [GENERATED SCRIPT HERE]                                    │
│  ```                                                        │
│                                                             │
│  Model info:                                                │
│  - Type: star_schema                                        │
│  - Facts: 1 (Orders)                                       │
│  - Dimensions: 3 (Customers, Products, Date)               │
│  - Expected rows: ~100K                                     │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Gemini Response Format

```json
{
  "review_status": "issues_found | approved",
  "score": 85,
  "issues": [
    {
      "issue_id": "BP-001",
      "severity": "warning",
      "category": "best-practice",
      "title": "LOAD * detected",
      "location": { "table": "DIM_Products", "line": 45 },
      "description": "Using LOAD * loads all fields, including unnecessary ones",
      "recommendation": "Specify only required fields explicitly",
      "fix_example": "LOAD ProductID, ProductName, Category FROM..."
    }
  ],
  "summary": "Script is functional but has 2 best practice issues"
}
```

### 4.3 Review Round Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    REVIEW ROUND FLOW                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Claude sends script to Gemini                           │
│     │                                                        │
│     ▼                                                        │
│  2. Gemini returns JSON with issues[]                       │
│     │                                                        │
│     ▼                                                        │
│  3. Claude parses response                                  │
│     │                                                        │
│     ├── issues.length == 0 → "Script approved! ✅"          │
│     │                                                        │
│     └── issues.length > 0 →                                 │
│         │                                                    │
│         ▼                                                    │
│  4. Claude shows user:                                      │
│     ┌─────────────────────────────────────────┐             │
│     │ Gemini found 2 issues:                  │             │
│     │                                         │             │
│     │ ⚠️ WARNING: LOAD * in DIM_Products     │             │
│     │ ⚠️ WARNING: Missing STORE for DIM_Date │             │
│     │                                         │             │
│     │ Proposed fixes:                         │             │
│     │ 1. Change to selective LOAD             │             │
│     │ 2. Add STORE statement                  │             │
│     │                                         │             │
│     │ [Approve fixes] [Modify] [Ignore]       │             │
│     └─────────────────────────────────────────┘             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. User Dialogue Flow (Staged Building)

### 5.1 Staged Script Building

```
┌─────────────────────────────────────────────────────────────┐
│              STAGED SCRIPT BUILDING                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  STAGE A: Configuration                                      │
│     ↓ ✓ User approves                                       │
│  STAGE B: Dimensions (each table separately)                │
│     ↓ ✓ User approves                                       │
│  STAGE C: Facts (each table separately)                     │
│     ↓ ✓ User approves                                       │
│  STAGE D: Link Tables (if needed)                           │
│     ↓ ✓ User approves                                       │
│  STAGE E: Calendars (per date field)                        │
│     ↓ ✓ User approves                                       │
│  STAGE F: STORE + Cleanup                                    │
│     ↓ ✓ User approves                                       │
│  COMPLETE → Send to Gemini for final review                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Stage Approval Table

| Stage | Content | User Approves |
|-------|---------|---------------|
| A | Configuration | QUALIFY, Variables, Settings |
| B | Dimensions | Each DIM separately - fields, types |
| C | Facts | Each FACT separately - fields, FK |
| D | Link Tables | If exists - link structure |
| E | Calendars | Each Calendar - date fields |
| F | STORE + Cleanup | QVD paths, DROP statements |

### 5.3 Example Dialogue

```
USER: Build me a model from the data

CLAUDE:
┌─────────────────────────────────────────────────────────────┐
│ 📊 Analyzing your data...                                    │
│                                                              │
│ Detected: 2 Facts, 3 Dimensions                             │
│ Recommended: Star Schema                                     │
│                                                              │
│ [Star Schema] [Concatenated Facts] [Ask question]           │
└─────────────────────────────────────────────────────────────┘

USER: Star Schema

CLAUDE:
┌─────────────────────────────────────────────────────────────┐
│ ✅ Star Schema selected                                      │
│                                                              │
│ Building script in 6 stages:                                │
│ ○ Stage A: Configuration                                    │
│ ○ Stage B: Dimensions (3)                                   │
│ ○ Stage C: Facts (2)                                        │
│ ○ Stage D: Link Tables (0 - not needed)                     │
│ ○ Stage E: Calendars (2)                                    │
│ ○ Stage F: STORE + Cleanup                                  │
│                                                              │
│ Starting Stage A...                                          │
└─────────────────────────────────────────────────────────────┘

CLAUDE:
┌─────────────────────────────────────────────────────────────┐
│ 📝 STAGE A: Configuration                                    │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                              │
│ ```qlik                                                      │
│ //=========================================================  │
│ // Project: SalesModel                                       │
│ // Created: 2026-01-20 by QlikModelBuilder                  │
│ // Model Type: Star Schema                                   │
│ //=========================================================  │
│                                                              │
│ // Prevent Synthetic Keys                                    │
│ QUALIFY *;                                                   │
│                                                              │
│ // Variables                                                 │
│ SET vPathQVD = 'lib://QVD/SalesModel/';                     │
│ SET vReloadDate = Today();                                   │
│ SET vCalendarLanguage = 'EN';                               │
│ ```                                                          │
│                                                              │
│ [✓ Approve] [✏️ Edit] [❓ Question]                          │
└─────────────────────────────────────────────────────────────┘

USER: Approve

CLAUDE:
┌─────────────────────────────────────────────────────────────┐
│ ✅ Stage A approved                                          │
│                                                              │
│ Progress: ████░░░░░░░░░░░░░░░░ 1/6                          │
│                                                              │
│ 📝 STAGE B: Dimensions (1/3) - DIM_Customers                │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                              │
│ ```qlik                                                      │
│ DIM_Customers:                                               │
│ LOAD                                                         │
│     CustomerID AS CustomerKey,                               │
│     CustomerName,                                            │
│     City,                                                    │
│     Country,                                                 │
│     Segment                                                  │
│ FROM [$(vPathQVD)customers.qvd] (qvd);                      │
│ ```                                                          │
│                                                              │
│ Fields: 5 | Rows: ~5,000                                    │
│                                                              │
│ [✓ Approve] [✏️ Edit] [➕ Add field] [➖ Remove field]       │
└─────────────────────────────────────────────────────────────┘

USER: Remove City

CLAUDE:
┌─────────────────────────────────────────────────────────────┐
│ ✅ Updated - City removed                                    │
│                                                              │
│ ```qlik                                                      │
│ DIM_Customers:                                               │
│ LOAD                                                         │
│     CustomerID AS CustomerKey,                               │
│     CustomerName,                                            │
│     Country,                                                 │
│     Segment                                                  │
│ FROM [$(vPathQVD)customers.qvd] (qvd);                      │
│ ```                                                          │
│                                                              │
│ Fields: 4 | Rows: ~5,000                                    │
│                                                              │
│ [✓ Approve] [✏️ Edit more]                                   │
└─────────────────────────────────────────────────────────────┘

... (continues for each stage) ...

[After all stages approved]

CLAUDE:
┌─────────────────────────────────────────────────────────────┐
│ ✅ All 6 stages approved                                     │
│                                                              │
│ Progress: ████████████████████ 6/6                          │
│                                                              │
│ 📊 Summary:                                                  │
│ • Configuration: ✓                                          │
│ • Dimensions: 3 tables, 14 fields                           │
│ • Facts: 2 tables, 18 fields                                │
│ • Link Tables: 0                                            │
│ • Calendars: 2 (OrderDate, ReturnDate)                      │
│ • Total script: 187 lines                                   │
│                                                              │
│ 🔍 Sending to Gemini for final review...                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Scope Guard Implementation

### 6.1 Purpose & Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SCOPE GUARD                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  PURPOSE: Ensure system is used only for Qlik code          │
│                                                              │
│     USER                                                     │
│       │                                                      │
│       ▼                                                      │
│  ┌─────────┐                                                │
│  │ CLAUDE  │ ←── Scope Guard + Rate Limit HERE             │
│  └────┬────┘                                                │
│       │                                                      │
│       ▼                                                      │
│  ┌─────────┐                                                │
│  │ GEMINI  │ ←── No limit (only Claude can call)           │
│  └─────────┘                                                │
│                                                              │
│  USER ──✗──→ GEMINI   (no direct access)                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Classification Rules

```json
{
  "allowed_intents": [
    "build_model",
    "modify_script",
    "add_table",
    "add_field",
    "remove_field",
    "explain_code",
    "fix_issue",
    "change_model_type",
    "configure_calendar",
    "review_script",
    "ask_qlik_question"
  ],

  "blocked_patterns": [
    "write email",
    "translate",
    "weather",
    "python",
    "javascript",
    "unrelated to qlik"
  ],

  "keywords_must_contain_one": [
    "model", "script", "table", "field",
    "dimension", "fact", "qlik", "qvd",
    "load", "calendar"
  ]
}
```

### 6.3 Rate Limiting (Claude Only)

| Metric | Limit | Action |
|--------|-------|--------|
| Requests per minute | 10 | Slow down warning |
| Failed scope checks | 3 consecutive | Temporary block (5 min) |
| **Gemini calls** | **No limit** | Claude decides when to call |

### 6.4 Rejection Message

```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ Out of Scope                                              │
│                                                              │
│ This system is designed for Qlik model building only.       │
│                                                              │
│ I can help you with:                                         │
│ • Building data models (Star, Snowflake, Link Tables)       │
│ • Writing Qlik Load Scripts                                  │
│ • Reviewing and fixing script issues                        │
│ • Explaining Qlik concepts                                   │
│                                                              │
│ For other requests, please use a general assistant.         │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Error Handling

### 7.1 Error Categories

```
┌─────────────────────────────────────────────────────────────┐
│                    ERROR HANDLING                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  CATEGORY 1: API Errors                                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Gemini API fails                                    │    │
│  │  ────────────────                                    │    │
│  │  • Retry: 3 attempts with exponential backoff       │    │
│  │  • If still fails: Continue WITHOUT review          │    │
│  │  • Notify user: "Gemini unavailable, proceed        │    │
│  │    without review or wait?"                          │    │
│  │                                                      │    │
│  │  Claude API fails                                    │    │
│  │  ─────────────────                                   │    │
│  │  • Cannot continue - Claude is the main engine      │    │
│  │  • Show error + save current state                  │    │
│  │  • User can resume later                            │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  CATEGORY 2: Data Errors                                     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  QVD file not found                                  │    │
│  │  ───────────────────                                 │    │
│  │  • List available QVDs                              │    │
│  │  • Ask user to select correct file                  │    │
│  │                                                      │    │
│  │  JSON from Stage 1 invalid                          │    │
│  │  ──────────────────────────                          │    │
│  │  • Show validation errors                           │    │
│  │  • Ask user to fix or return to Stage 1             │    │
│  │                                                      │    │
│  │  Sample data empty                                   │    │
│  │  ──────────────────                                  │    │
│  │  • Warn user: "No data in QVD, continuing without   │    │
│  │    sample analysis"                                  │    │
│  │  • Use JSON hints only                              │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  CATEGORY 3: Script Errors                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Gemini finds critical issue                         │    │
│  │  ────────────────────────────                        │    │
│  │  • Block progress until fixed                       │    │
│  │  • Show issue + proposed fix                        │    │
│  │  • User must approve fix or provide alternative     │    │
│  │                                                      │    │
│  │  Claude can't fix an issue                          │    │
│  │  ──────────────────────────                          │    │
│  │  • Explain why fix is not possible                  │    │
│  │  • Offer options:                                   │    │
│  │    [1] Ignore (with warning)                        │    │
│  │    [2] Manual edit by user                          │    │
│  │    [3] Go back to previous stage                    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 State Persistence

```json
{
  "session_id": "abc-123",
  "project_name": "SalesModel",
  "current_stage": "C",
  "completed_stages": ["A", "B"],
  "model_type": "star_schema",
  "approved_script_parts": {
    "A_config": "QUALIFY *; SET vPath...",
    "B_dimensions": "DIM_Customers: LOAD..."
  },
  "pending_tables": ["FACT_Orders", "FACT_Returns"],
  "timestamp": "2026-01-20T14:30:00Z"
}
```

**Location:** `.qmb/sessions/{session_id}.json`

### 7.3 Resume Flow

```
USER: (returns after disconnect)

CLAUDE:
┌─────────────────────────────────────────────────────────────┐
│ 🔄 Found saved session                                       │
│                                                              │
│ Project: SalesModel                                          │
│ Progress: Stage C (Facts)                                   │
│ Last saved: 10 minutes ago                                  │
│                                                              │
│ Completed:                                                   │
│ ✅ Stage A: Configuration                                    │
│ ✅ Stage B: Dimensions (3 tables)                           │
│                                                              │
│ Pending:                                                     │
│ ○ Stage C: Facts (2 tables)                                 │
│ ○ Stage D-F                                                  │
│                                                              │
│ [Continue from Stage C] [Start over] [View saved script]    │
└─────────────────────────────────────────────────────────────┘
```

---

### 7.4 Logging & Monitoring

#### Log Levels

| Level | Usage | Examples |
|-------|-------|----------|
| **ERROR** | Critical failures | API timeout, file not found, script execution failed |
| **WARN** | Issues that don't block | Gemini unavailable, empty sample data |
| **INFO** | Normal operations | Stage completed, user approved, script generated |
| **DEBUG** | Detailed tracing | API requests/responses, parsing steps |

#### Log Structure

```json
{
  "timestamp": "2026-01-20T14:30:00.123Z",
  "level": "INFO",
  "session_id": "abc-123",
  "stage": "B",
  "component": "builder_engine",
  "action": "table_generated",
  "details": {
    "table": "DIM_Customers",
    "fields": 5,
    "rows_estimated": 5000
  },
  "user_id": "user@company.com"
}
```

#### What Gets Logged

| Category | Events |
|----------|--------|
| **Session** | Start, resume, complete, abandon |
| **Stages** | Enter, approve, reject, edit |
| **AI Calls** | Claude request/response, Gemini request/response, tokens used |
| **Errors** | All errors with stack trace |
| **User Actions** | Approve, edit, add field, remove field, question asked |
| **Script** | Generated script hash, validation results |

#### Log Files

```
.qmb/
├── sessions/
│   └── {session_id}.json      # Session state
└── logs/
    ├── {session_id}.log       # Session-specific log
    └── qmb.log                # Global log (rolling, max 10MB)
```

#### Audit Trail (for compliance)

```json
{
  "audit_type": "script_approved",
  "timestamp": "2026-01-20T14:35:00Z",
  "session_id": "abc-123",
  "user_id": "user@company.com",
  "action": "approved_stage_c",
  "script_hash": "sha256:a1b2c3...",
  "gemini_score": 95,
  "issues_fixed": 2
}
```

---

## 8. Integration with Stage 1 & 3

### 8.1 JSON Schema: Stage 1 → Stage 2

```json
{
  "version": "1.0",
  "source": "specification.docx",
  "parsed_at": "2026-01-20T10:00:00Z",

  "tables": [
    {
      "name": "Orders",
      "source_name": "dbo.Orders",
      "fields": [
        {"name": "OrderID", "type": "integer"},
        {"name": "CustomerID", "type": "string"},
        {"name": "OrderDate", "type": "date"},
        {"name": "Amount", "type": "decimal"}
      ]
    }
  ],

  "relationship_hints": [
    {
      "from": "Orders.CustomerID",
      "to": "Customers.CustomerID",
      "type": "many-to-one"
    }
  ]
}
```

### 8.2 JSON Schema: Stage 2 → Stage 3

**model.json:**
```json
{
  "version": "1.0",
  "model_type": "star_schema",
  "created_at": "2026-01-20T12:00:00Z",

  "facts": [
    {
      "name": "FACT_Orders",
      "source_table": "Orders",
      "keys": ["OrderKey", "CustomerKey"],
      "measures": ["Amount", "Quantity"]
    }
  ],

  "dimensions": [
    {
      "name": "DIM_Customers",
      "source_table": "Customers",
      "pk": "CustomerKey",
      "fields": ["CustomerName", "Country"]
    }
  ],

  "calendars": [
    {"name": "DIM_OrderDate", "field": "OrderDate"}
  ],

  "relationships": [
    {
      "from": "FACT_Orders.CustomerKey",
      "to": "DIM_Customers.CustomerKey",
      "cardinality": "N:1"
    }
  ],

  "gemini_review": {
    "score": 95,
    "status": "approved",
    "issues_fixed": 2
  }
}
```

**script.qvs:** Full approved Qlik Load Script

### 8.3 JSON Schema: Stage 3 Output

```json
{
  "status": "success",
  "tables_created": 6,
  "qvd_files": [
    "Final/FACT_Orders.qvd",
    "Final/DIM_Customers.qvd"
  ],
  "app_id": "abc-123-xyz"
}
```

### 8.4 File Structure

```
project_folder/
├── input/
│   └── specification.docx       # Original document
│
├── stage1_output/
│   └── spec.json                # Parser output
│
├── stage2_output/
│   ├── model.json               # Model definition
│   ├── script.qvs               # Approved script
│   └── gemini_review.json       # Review results
│
├── stage3_output/
│   ├── execution_result.json    # Execution status
│   └── qvd/
│       └── Final/               # Generated QVDs
│
└── .qmb/
    └── sessions/                # Saved session states
```

### 8.5 Handoff Protocol

| From | To | Files | Validation |
|------|-----|-------|------------|
| Stage 1 → Stage 2 | `spec.json` | JSON Schema check |
| Stage 2 → Stage 3 | `model.json` + `script.qvs` | Gemini approved |
| Stage 3 → Stage 4 | `execution_result.json` | Tables exist in Qlik |

---

## 9. Issue Severity & Category Definitions

### 9.1 Severity Levels

| Severity | Definition | Examples | Action |
|----------|------------|----------|--------|
| **critical** | Must fix - will cause failure or major problems | Synthetic Key, Circular Reference, Syntax Error | Block until fixed |
| **warning** | Should fix - causes performance/maintenance issues | LOAD *, Missing AutoNumber, Snowflake >4 levels | Recommend fix |
| **info** | Nice to fix - minor improvements | Missing comments, Naming convention | Optional |

### 9.2 Category Definitions

| Category | Description | Examples |
|----------|-------------|----------|
| **syntax** | Code won't run | Missing semicolon, Invalid function |
| **anti-pattern** | Known bad practices | Synthetic Keys, Circular Refs, God Tables |
| **best-practice** | Not following standards | No QUALIFY, Missing AutoNumber, LOAD * |
| **model-size** | Will cause large model | High cardinality Link Table, Too many fields |

---

## 10. Open Questions (Resolved)

| Question | Resolution |
|----------|------------|
| AutoNumber by default? | NO - only on user request (debugging is harder) |
| One calendar or many? | MANY - separate calendar per date field |
| Build script at once? | NO - build in stages with approval |
| Gemini rate limit? | NO - Gemini has no limit, only Claude does |
| Language hardcoded? | NO - configurable (multilingual project) |

---

## 11. Next Steps

1. **Implementation Planning** - Use `/write-plan` to create detailed implementation plan
2. **Stage 1 Integration** - Ensure Parser outputs correct JSON schema
3. **Stage 3 Integration** - Define execution engine requirements
4. **Testing** - Create test cases for each model type

---

**Document End**

**Version:** 1.1.0 (Complete + Logging)
**Last Updated:** 2026-01-20
**Status:** Ready for Gemini Review
