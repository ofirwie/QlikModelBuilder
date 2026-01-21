# QlikModelBuilder - Phase B Specification

**תאריך:** 2026-01-19
**גרסה:** 0.4 (Draft + Appendices + HITL + Phased Dev)
**סטטוס:** מוכן לבדיקה

---

## תוכן עניינים

1. [סקירה כללית](#פרק-1-סקירה-כללית)
2. [ארכיטקטורה ושלבי העיבוד](#פרק-2-ארכיטקטורה-ושלבי-העיבוד)
3. [פרסור מסמך אפיון](#פרק-3-פרסור-מסמך-אפיון-specification-parser)
4. [אסטרטגיית בניית מודל](#פרק-4-אסטרטגיית-בניית-מודל-נתונים-data-modeling)
5. [מיפוי מימדים ומדדים](#פרק-5-מיפוי-מימדים-ומדדים-dimension--measure-mapping)
6. [יצירת Load Script](#פרק-6-יצירת-load-script)
7. [GUI & Visualizations](#פרק-7-gui--visualizations)
8. [Validation & QA](#פרק-8-validation--quality-assurance)
9. [Human-in-the-Loop & פיתוח אינקרמנטלי](#פרק-9-human-in-the-loop--פיתוח-אינקרמנטלי)
   - [9.1 נקודות התערבות אנושית](#91-נקודות-התערבות-אנושית-hitl-decision-points)
   - [9.5 Script Chunking](#95-script-chunking---פירוק-סקריפט-לחלקים)
   - [9.6 Incremental Execution](#96-incremental-execution---הרצה-מדורגת)
   - [9.9 Rollback & Recovery](#99-rollback--recovery)
10. [נספחים](#נספחים)
   - [א: קונבנציות שמות](#נספח-א-קונבנציות-שמות-naming-conventions)
   - [ב: מפתחות מורכבים](#נספח-ב-מפתחות-מורכבים-composite-keys)
   - [ג: Qlik APIs](#נספח-ג-qlik-apis)
   - [ד: רשימת בדיקות](#נספח-ד-רשימת-בדיקות-checklist)
   - [ה: גלוסרי מונחים](#נספח-ה-גלוסרי-מונחים)
   - [ו: Anti-Patterns](#נספח-ו-anti-patterns---טעויות-קריטיות)
   - [ז: ארכיטקטורת 4 אפליקציות](#נספח-ז-ארכיטקטורת-4-אפליקציות-4-app-architecture)
   - [ח: עץ ספריות מומלץ](#נספח-ח-עץ-ספריות-מומלץ-directory-structure)
   - [ט: כללי פיתוח חובה](#נספח-ט-כללי-פיתוח-חובה-development-rules)
   - [י: בדיקות QA חובה](#נספח-י-בדיקות-qa-חובה)
   - [יא: גורמים קריטיים להצלחה](#נספח-יא-גורמים-קריטיים-להצלחה-csf)
   - [יב: אינטגרציה עם QMB](#נספח-יב-אינטגרציה-עם-qmb-הקיים)
   - [יג: המלצות זהב](#נספח-יג-המלצות-זהב---סיכום-ביצועים)

---

## פרק 1: סקירה כללית

### 1.1 Vision

בניית מערכת שמאפשרת יצירת מודלי Qlik Sense **מאפיון ועד QVF מוכן** - באופן אוטומטי או חצי-אוטומטי.

```
מסמך אפיון (Word/Excel)
         ↓
    [Phase B]
         ↓
Qlik App מוכן (QVF)
```

### 1.2 מצב נוכחי

| שלב | סטטוס | תיאור |
|-----|-------|-------|
| **Phase A** | ✅ הושלם | DB → QVD: חיבור, משיכת נתונים, יצירת QVD |
| **Phase B** | 🚧 נוכחי | אפיון → QVF: פרסור, מודל, GUI |

### 1.3 יעדים עסקיים

| יעד | מדד |
|-----|-----|
| הפחתת זמן פיתוח | מ-33 ימים ל-~8 ימים (75% חיסכון) |
| סטנדרטיזציה | 100% עמידה במתודולוגיה |
| הפחתת שגיאות | < 5% שגיאות במודל הסופי |
| אוטומציה | > 80% מהמשימות אוטומטיות |

### 1.4 יעדים טכניים

- ✅ תמיכה ב-Qlik Cloud וב-On-Premise
- ✅ Incremental Load מובנה
- ✅ Data Model Validation אוטומטי
- ✅ Master Items generation
- ✅ GUI אוטומטי או חצי-אוטומטי
- ✅ עמידה ב-Best Practices (Qlik Israel 2020)

### 1.5 Scope

**בתחום (In Scope):**
- פרסור מסמך אפיון (Word/Excel)
- יצירת Data Model (ERD)
- יצירת Load Script
- יצירת Master Items (Dimensions + Measures)
- יצירת GUI בסיסי (Sheets + Charts)
- Validation & Quality Checks

**מחוץ לתחום (Out of Scope - MVP):**
- Advanced visualizations (Extensions)
- Qlik NPrinting integration
- Complex Section Access
- Real-time streaming
- Multi-tenant architecture

### 1.6 ערך מוסף

| לפני (ידני) | אחרי (אוטומטי) |
|-------------|----------------|
| 33 ימי עבודה | ~8 ימים |
| שגיאות אנוש | Validation מובנה |
| סגנונות שונים | סטנדרט אחיד |
| תיעוד חסר | תיעוד אוטומטי |

---

## פרק 2: ארכיטקטורה ושלבי העיבוד

### 2.1 תרשים ארכיטקטורה

```
┌─────────────────────────────────────────────────────────────┐
│                      INPUT LAYER                            │
├─────────────────────────────────────────────────────────────┤
│  • מסמך אפיון.docx (ממולא לפי תבנית)                        │
│  • QVD Files (משלב A)                                        │
│  • metadata.json (משלב A)                                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   PROCESSING LAYER                          │
├─────────────────────────────────────────────────────────────┤
│  Phase 1: Parser         (Word/Excel → JSON)                │
│  Phase 2: Enricher       (Merge + Validate)                 │
│  Phase 3: Mapper         (Dimensions → Fields)              │
│  Phase 4: Script Gen     (Qlik Load Script)                 │
│  Phase 5: Model Builder  (Data Model + Master Items)        │
│  Phase 6: UI Builder     (Sheets + Visualizations)          │
│  Phase 7: Assembler      (JSON → QVF)                       │
│  Phase 8: Validator      (Quality Checks)                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                     OUTPUT LAYER                            │
├─────────────────────────────────────────────────────────────┤
│  • final_app.qvf (ready to import)                          │
│  • validation_report.json                                   │
│  • documentation.md                                          │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 שמונת שלבי העיבוד

| שלב | שם | קלט | פלט | תיאור |
|-----|----|-----|-----|-------|
| 1 | **Parser** | Word/Excel | `parsed_spec.json` | פרסור מסמך אפיון למבנה JSON |
| 2 | **Enricher** | `parsed_spec.json` + `metadata.json` | `enriched_spec.json` | מיזוג עם מידע משלב A, ולידציה |
| 3 | **Mapper** | `enriched_spec.json` | `mapped_model.json` | מיפוי מימדים עסקיים לשדות טכניים |
| 4 | **Script Generator** | `mapped_model.json` | `load_script.qvs` | יצירת Load Script מלא |
| 5 | **Model Builder** | `mapped_model.json` | `data_model.json` | בניית מודל נתונים + Master Items |
| 6 | **UI Builder** | `data_model.json` | `presentation.json` | בניית Sheets + Visualizations |
| 7 | **Assembler** | All JSONs | `app.qvf` | הרכבה ל-QVF |
| 8 | **Validator** | `app.qvf` | `validation_report.json` | בדיקות איכות |

### 2.3 פירוט שלבים

#### Phase 1: Parser
```
Input:  מסמך_אפיון.docx / spec.xlsx
Output: parsed_spec.json

תפקידים:
├── זיהוי מבנה המסמך (סעיפים)
├── חילוץ טבלאות (מקורות, שדות, קשרים)
├── חילוץ מימדים ומדדים
├── חילוץ הגדרות GUI
└── נרמול לפורמט אחיד
```

#### Phase 2: Enricher
```
Input:  parsed_spec.json + Phase A metadata.json
Output: enriched_spec.json

תפקידים:
├── מיזוג מידע משלב A (טבלאות, שדות, types)
├── בדיקת התאמה (טבלאות קיימות?)
├── השלמת מידע חסר (row_count, distinct_count)
├── זיהוי שדות תאריך (לבניית Calendar)
└── זיהוי מפתחות (PK/FK)
```

#### Phase 3: Mapper
```
Input:  enriched_spec.json
Output: mapped_model.json

תפקידים:
├── מיפוי שמות עבריים → שדות טכניים
├── מיפוי מימדים → שדות
├── וידוא קיום שדות בטבלאות
├── טיפול ב-ambiguity (customer_id vs unique_id)
└── יצירת mapping table
```

#### Phase 4: Script Generator
```
Input:  mapped_model.json
Output: load_script.qvs

תפקידים:
├── יצירת Load Script לפי Best Practices
├── יצירת Calendar אוטומטי
├── הגדרת Incremental Load
├── יצירת QVD Layers (Initial → Process → Final)
└── הוספת Error Handling
```

#### Phase 5: Model Builder
```
Input:  mapped_model.json
Output: data_model.json

תפקידים:
├── הגדרת קשרים בין טבלאות
├── יצירת Master Dimensions
├── יצירת Master Measures
├── יצירת Drill Groups
└── יצירת Variables
```

#### Phase 6: UI Builder
```
Input:  data_model.json
Output: presentation.json

תפקידים:
├── יצירת Sheets לפי הגדרות
├── יצירת Visualizations (KPI, Charts, Tables)
├── Auto-Layout (grid 24 columns)
├── הגדרת Filters
└── הגדרת Theme & Colors
```

#### Phase 7: Assembler
```
Input:  All JSONs
Output: app.qvf

תפקידים:
├── הרכבת כל הרכיבים ל-QVF
├── שימוש ב-Engine API / QRS API
├── Import למערכת Qlik
└── ביצוע Reload ראשוני
```

#### Phase 8: Validator
```
Input:  app.qvf
Output: validation_report.json

תפקידים:
├── בדיקת Data Model (synthetic keys, circular refs)
├── בדיקת Master Items (expressions תקינים)
├── בדיקת GUI (כל chart עובד)
├── בדיקת Performance (cardinality, RAM)
└── דוח שגיאות ואזהרות
```

### 2.4 טכנולוגיות

| רכיב | טכנולוגיה | תיאור |
|------|-----------|-------|
| MCP Server | TypeScript/Node.js | Model Context Protocol |
| AI Engine | Claude API | ניתוח, מיפוי, ולידציה |
| Parser | Python | python-docx, openpyxl |
| Qlik Integration | Qlik Engine API | יצירת אפליקציות |
| Orchestration | n8n (אופציונלי) | אוטומציית תהליכים |

### 2.5 אינטגרציה עם שלב A

```
שלב A מספק:
├── QVD Files (נתונים מוכנים)
├── metadata.json:
│   ├── tables[]: שם, נתיב, מספר שורות
│   ├── fields[]: שם, type, is_key, distinct_count
│   └── space_path: lib://DataFiles
└── חיבור מוגדר ל-DB

שלב B משתמש:
├── לוידוא שטבלאות קיימות
├── לקבלת רשימת שדות עדכנית
├── לזיהוי מפתחות וטיפוסים
├── לחישוב cardinality
└── לבניית Load Script מדויק
```

---

## פרק 3: פרסור מסמך אפיון (Specification Parser)

### 3.1 פורמטים נתמכים

| פורמט | סיומת | ספריית פרסור | עדיפות |
|-------|-------|--------------|--------|
| Word | `.docx` | python-docx | עיקרי |
| Excel | `.xlsx` | openpyxl | משני |
| CSV | `.csv` | pandas | משני |
| JSON | `.json` | built-in | ישיר |

### 3.2 מבנה תבנית האפיון

```
תבנית אפיון ריקה (מסמך_אפיון_מפורט.docx)
        ↓ ממולאת על ידי יועץ + לקוח
פרויקט ספציפי (Olist_Specification.docx)
        ↓ מוזן למערכת
מודל Qlik אוטומטי
```

#### רשימת סעיפים בתבנית:

| # | סעיף | קריטי? | תיאור |
|---|------|--------|-------|
| 1 | פרטים כלליים על המסמך | - | מטא-דאטא |
| 2 | פרטים כלליים על הלקוח | - | שם לקוח, תחום |
| 3 | מצב קיים | - | מערכות נוכחיות |
| 4 | הבעיה העסקית | - | רקע |
| 5 | מטרת המערכת | - | יעדים |
| 6 | לקוח המטרה | - | משתמשים |
| 7.1 | דרישות עסקיות | - | רשימה |
| 7.2 | מקורות המידע | ★ | טבלאות מקור |
| 7.3 | שדות מרכזיים | ★ | Fields + Keys |
| 7.4 | קשרים בין טבלאות | ★ | Relationships |
| 7.5 | סכמת ERD | ★ | Fact/Dim |
| 7.6 | מימדים | ★ | Dimensions |
| 7.7 | מדדים | ★ | Measures |
| 7.8 | תצוגה | ★ | Sheets + Charts |
| 8 | טעינת נתונים | ★ | Reload config |
| 9 | הרשאות | - | Section Access |
| 10 | הערכת זמנים | - | Timeline |

★ = קריטי לבניית המודל

### 3.3 מבנה טבלאות באפיון

#### 7.2 מקורות המידע
```
| שם טבלה               | מקור    | תיאור          | רשומות  | ERD Name       |
|-----------------------|---------|----------------|---------|----------------|
| olist_orders_dataset  | CSV/DB  | טבלת הזמנות   | ~100K   | FACT_Orders    |
| olist_customers_dataset| CSV/DB | מימד לקוחות   | ~99K    | DIM_Customers  |
```

#### 7.3 שדות מרכזיים
```
| שם שדה                  | טבלה           | הערות                    |
|-------------------------|----------------|--------------------------|
| order_id                | olist_orders   | מפתח ראשי               |
| customer_id             | olist_customers| מפתח ראשי               |
| order_purchase_timestamp| olist_orders   | תאריך רכישה             |
```

#### 7.4 קשרים בין טבלאות
```
| טבלה 1       | שדה מקשר | טבלה 2          | שדה מקשר | סוג קשר |
|--------------|----------|-----------------|----------|---------|
| olist_orders | order_id | olist_order_items| order_id | 1:M     |
| olist_orders | customer_id| olist_customers| customer_id| M:1   |
```

#### 7.6 מימדים
```
| שם המימד (עברית) | הערות                              |
|-----------------|-------------------------------------|
| תאריך רכישה     | מימד זמן: יום, שבוע, חודש, רבעון  |
| לקוח            | מזהה לקוח, לקוח ייחודי             |
| מיקום לקוח      | עיר, מדינה - היררכיה גיאוגרפית    |
```

#### 7.7 מדדים
```
| שם מדד        | תיאור              | נוסחה                            |
|---------------|-------------------|-----------------------------------|
| סה"כ הכנסות   | סכום כל המכירות  | Sum(payment_value)                |
| מספר הזמנות   | כמות הזמנות      | Count(DISTINCT order_id)          |
| AOV           | ממוצע להזמנה     | Sum(payment_value)/Count(DISTINCT order_id) |
```

#### 7.8 תצוגה
```
| לשונית           | מימד           | מדד                  | ייצוג גרפי          |
|-----------------|----------------|----------------------|---------------------|
| Executive Dashboard| תאריך, קטגוריה| הכנסות, הזמנות, AOV | KPI Cards, Line Chart|
| Sales Analysis  | תאריך, מוצר   | הכנסות, פריטים      | Combo Chart, Table  |
```

### 3.4 פייפליין פרסור

```
┌──────────────────┐
│ Input Document   │
│ (Word/Excel)     │
└────────┬─────────┘
         ↓
┌──────────────────┐
│ 1. Document Load │
│ python-docx      │
└────────┬─────────┘
         ↓
┌──────────────────┐
│ 2. Section       │
│    Detection     │
│ - Headings       │
│ - Table indices  │
└────────┬─────────┘
         ↓
┌──────────────────┐
│ 3. Table         │
│    Extraction    │
│ - Headers        │
│ - Rows           │
│ - Data types     │
└────────┬─────────┘
         ↓
┌──────────────────┐
│ 4. Normalization │
│ - Field names    │
│ - Empty values   │
│ - Hebrew→English │
└────────┬─────────┘
         ↓
┌──────────────────┐
│ 5. Validation    │
│ - Required fields│
│ - Data types     │
│ - References     │
└────────┬─────────┘
         ↓
┌──────────────────┐
│ Output JSON      │
│ parsed_spec.json │
└──────────────────┘
```

### 3.5 מבנה JSON פלט (parsed_spec.json)

```json
{
  "metadata": {
    "document_name": "Olist_Specification.docx",
    "client_name": "Olist",
    "created_at": "2026-01-19T10:00:00Z",
    "version": "1.0"
  },

  "data_sources": [
    {
      "source_name": "olist_orders_dataset",
      "source_type": "CSV",
      "description": "טבלת הזמנות",
      "estimated_rows": 100000,
      "erd_name": "FACT_Orders",
      "table_type": "fact"
    }
  ],

  "fields": [
    {
      "field_name": "order_id",
      "table_name": "olist_orders_dataset",
      "is_primary_key": true,
      "is_foreign_key": false,
      "notes": "מפתח ראשי"
    }
  ],

  "relationships": [
    {
      "left_table": "olist_orders",
      "left_field": "order_id",
      "right_table": "olist_order_items",
      "right_field": "order_id",
      "relationship_type": "1:M"
    }
  ],

  "dimensions": [
    {
      "name_he": "תאריך רכישה",
      "name_en": null,
      "description": "מימד זמן: יום, שבוע, חודש, רבעון",
      "field_mapping": null,
      "drill_down": ["year", "quarter", "month", "week", "day"]
    }
  ],

  "measures": [
    {
      "name_he": "סה\"כ הכנסות",
      "name_en": "Total Revenue",
      "description": "סכום כל המכירות",
      "expression_raw": "Sum(payment_value)",
      "format": "#,##0"
    }
  ],

  "sheets": [
    {
      "name": "Executive Dashboard",
      "dimensions_used": ["תאריך", "קטגוריה"],
      "measures_used": ["הכנסות", "הזמנות", "AOV", "דירוג"],
      "chart_types": ["kpi", "linechart", "barchart"]
    }
  ],

  "load_config": {
    "frequency": "daily",
    "time": "02:00",
    "type": "incremental",
    "delta_field": "order_purchase_timestamp"
  },

  "security": {
    "roles": [
      {"name": "Admin", "access": "full"},
      {"name": "Sales Manager", "access": "sales_data"}
    ],
    "section_access_enabled": true,
    "reduction_fields": ["seller_id"]
  }
}
```

### 3.6 טיפול בשגיאות פרסור

| שגיאה | סיבה | פתרון |
|-------|------|-------|
| `TableNotFound` | אין טבלה בסעיף | Warning + continue |
| `MissingRequiredField` | חסר עמודה קריטית | Error + stop |
| `InvalidRelationType` | סוג קשר לא תקני | Normalize (1:N → 1:M) |
| `EmptyTable` | טבלה ריקה | Warning + skip |
| `EncodingError` | בעיית UTF-8 | Try multiple encodings |

### 3.7 קוד לדוגמה

```python
def parse_spec_document(docx_path: str) -> dict:
    """
    Parse specification document to JSON

    Args:
        docx_path: Path to .docx file

    Returns:
        Parsed specification as dict
    """
    doc = Document(docx_path)
    tables = doc.tables

    parsed = {
        "metadata": extract_metadata(doc),
        "data_sources": parse_table(tables[1]),   # 7.2
        "fields": parse_table(tables[2]),          # 7.3
        "relationships": parse_table(tables[3]),   # 7.4
        "dimensions": parse_table(tables[4]),      # 7.6
        "measures": parse_table(tables[5]),        # 7.7
        "sheets": parse_table(tables[6]),          # 7.8
        "load_config": extract_load_config(doc),
        "security": extract_security_config(doc)
    }

    # Validate
    validate_parsed_spec(parsed)

    return parsed
```

---

## פרק 4: אסטרטגיית בניית מודל נתונים (Data Modeling)

### 4.1 ארבע גישות מרכזיות

| גישה | מתי להשתמש | יתרונות | חסרונות |
|------|----------|---------|---------|
| **Star Schema** ⭐ | Query Speed קריטי, < 100M rows | אופטימלי ל-Qlik, sub-second | Redundancy בdims |
| **Link Table** | Many-to-Many ללא Synthetic Keys | טיפול ב-granularity | תחזוקה מורכבת |
| **Concatenated Fact** | Facts דומים, > 50M rows | פשוט, 30% מהירות | nulls inflate |
| **Snowflake** | Storage קריטי, RAM מוגבל | חיסכון 10-30% RAM | queries איטיים 20-50% |

### 4.2 Decision Tree - בחירת גישה

```
START
  │
  ├─ Data has Mixed Granularity AND Volume > 50M rows?
  │  └─ YES → Concatenated Fact ✅
  │
  ├─ Relationships are Many-to-Many AND No Granularity Issues?
  │  └─ YES → Link Table ✅
  │
  ├─ Query Speed Critical AND Data < 100M rows?
  │  └─ YES → Star Schema ⭐ BEST!
  │
  ├─ Storage Efficiency Priority AND Updates Frequent?
  │  └─ YES → Snowflake Schema ⚠️
  │
  └─ Single Fact Possible?
     ├─ YES → Prefer it! (simplest)
     └─ NO → Multi-Fact with Concatenation or Links
```

### 4.3 Performance Benchmarks

| Method | RAM | CPU | Query Speed | Load Time |
|--------|-----|-----|-------------|-----------|
| **Link Table** | +10-20% | +15-25% | Medium | Slow |
| **Concatenated** | Variable | -20-30% | **Fast** ⚡ | **Fastest** ⚡ |
| **Star Schema** | +10-30% | **15-25%** ⚡ | **Sub-second** ⭐ | Medium |
| **Snowflake** | **-10-30%** 💾 | +20-50% 🐌 | Slow | Medium |

**בקנה מידה (100M+ rows):**
- Concatenation: 125 users @ 2.5s response ⭐
- Link Tables: High cardinality = CPU 75%
- Snowflake: חיסכון RAM (21GB vs 25GB) אך queries 3-5s 🐌

### 4.4 Star Schema - הגישה המומלצת

```
           ┌──────────────┐
           │ DIM_Date     │
           │ ────────────│
           │ DateKey (PK) │
           │ Year         │
           │ Month        │
           │ Quarter      │
           └──────┬───────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
┌───┴────┐  ┌────┴─────┐  ┌────┴────┐
│DIM_    │  │FACT_     │  │DIM_     │
│Customer│  │Orders    │  │Product  │
│────────│  │──────────│  │─────────│
│CustKey │←─│CustKey   │─→│ProdKey  │
│Name    │  │ProdKey   │  │Name     │
│City    │  │DateKey   │  │Category │
│State   │  │Revenue   │  │Price    │
└────────┘  │Quantity  │  └─────────┘
            └──────────┘
```

**יתרונות:**
- ✅ אופטימלי ל-Associative Engine של Qlik
- ✅ Queries sub-second על 100M rows
- ✅ CPU נמוך (15-25% utilization)
- ✅ קל להבנה ותחזוקה

### 4.5 Link Table - טיפול ב-M:N

```qlik
// בעיה: Synthetic Keys
// פתרון: Link Table

// 1. יצירת Link Table
LinkTable:
LOAD DISTINCT
    Key1 & '|' & Key2 AS %LinkKey,
    Key1,
    Key2
RESIDENT Facts1;

CONCATENATE (LinkTable)
LOAD DISTINCT
    Key1 & '|' & Key2 AS %LinkKey,
    Key1,
    Key2
RESIDENT Facts2;

// 2. הסרת מפתחות מהטבלאות המקוריות
DROP FIELDS Key1, Key2 FROM Facts1, Facts2;
```

### 4.6 Calendar Generation

```qlik
//===== AUTO-GENERATED CALENDAR =====

// 1. Find date range
TempDates:
LOAD
    Date(Floor(Min(order_purchase_timestamp))) as MinDate,
    Date(Floor(Max(order_purchase_timestamp))) as MaxDate
RESIDENT FACT_Orders;

LET vMinDate = Peek('MinDate', 0, 'TempDates');
LET vMaxDate = Peek('MaxDate', 0, 'TempDates');
DROP TABLE TempDates;

// 2. Generate Calendar
DIM_Date:
LOAD
    Date as OrderDate,
    Year(Date) as Year,
    Month(Date) as Month,
    MonthName(Date) as MonthYear,
    Week(Date) as Week,
    WeekDay(Date) as WeekDay,
    Day(Date) as Day,
    'Q' & Ceil(Month(Date)/3) as Quarter,
    If(WeekDay(Date) >= 5, 'Weekend', 'Weekday') as DayType
;
LOAD
    Date($(vMinDate) + IterNo() - 1) as Date
AUTOGENERATE 1
WHILE $(vMinDate) + IterNo() - 1 <= $(vMaxDate);

// 3. Link to Facts
LEFT JOIN (FACT_Orders)
LOAD
    order_purchase_timestamp,
    Date(Floor(order_purchase_timestamp)) as OrderDate
RESIDENT FACT_Orders;
```

### 4.7 Synthetic Keys - זיהוי וטיפול

```
בעיה: Synthetic Key נוצר כשיש יותר משדה מקשר אחד משותף

דוגמה:
┌─────────────┐        ┌─────────────┐
│ Orders      │        │ Items       │
├─────────────┤        ├─────────────┤
│ order_id    │───┐ ┌──│ order_id    │
│ customer_id │───┼─┼──│ customer_id │  ← Synthetic Key!
│ date        │   │ │  │ product_id  │
└─────────────┘   │ │  └─────────────┘
                  └─┴→ $Syn 1

פתרונות:
1. QUALIFY/UNQUALIFY - שינוי שמות שדות
2. DROP FIELD - הסרת שדה כפול
3. CONCATENATE - איחוד מפתחות
4. Link Table - טבלת גישור
```

### 4.8 מבנה QVD Layers

```
┌──────────────────────────────────────────────────────────┐
│                    QVD LAYER ARCHITECTURE                 │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────┐   ┌────────────┐   ┌────────────┐       │
│  │   SOURCE   │   │   SOURCE   │   │   SOURCE   │       │
│  │  Database  │   │    CSV     │   │   Excel    │       │
│  └─────┬──────┘   └─────┬──────┘   └─────┬──────┘       │
│        │                │                │              │
│        └────────────────┼────────────────┘              │
│                         ↓                               │
│  ┌──────────────────────────────────────────────────┐   │
│  │              INITIAL QVD LAYER                    │   │
│  │  Raw data, minimal transformations               │   │
│  │  • Initial_Orders.qvd                            │   │
│  │  • Initial_Customers.qvd                         │   │
│  │  • Initial_Products.qvd                          │   │
│  └───────────────────────┬──────────────────────────┘   │
│                          ↓                              │
│  ┌──────────────────────────────────────────────────┐   │
│  │              PROCESS QVD LAYER                    │   │
│  │  Business logic, transformations, calculations   │   │
│  │  • Process_Orders.qvd (with flags, calcs)        │   │
│  │  • Process_Customers.qvd (with segments)         │   │
│  └───────────────────────┬──────────────────────────┘   │
│                          ↓                              │
│  ┌──────────────────────────────────────────────────┐   │
│  │               FINAL QVD LAYER                     │   │
│  │  Ready for app, Star Schema format               │   │
│  │  • FACT_Orders.qvd                               │   │
│  │  • DIM_Customers.qvd                             │   │
│  │  • DIM_Date.qvd                                  │   │
│  └───────────────────────┬──────────────────────────┘   │
│                          ↓                              │
│  ┌──────────────────────────────────────────────────┐   │
│  │                  QLIK APP                         │   │
│  │  Loads from Final layer only                     │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 4.9 JSON Configuration

```json
{
  "data_model": {
    "strategy": "star_schema",

    "relationships": [
      {
        "left_table": "FACT_Orders",
        "left_field": "CustomerKey",
        "right_table": "DIM_Customers",
        "right_field": "CustomerKey",
        "type": "M:1"
      }
    ],

    "calendar": {
      "auto_generate": true,
      "master_date_field": "order_purchase_timestamp",
      "table": "FACT_Orders",
      "link_field": "OrderDate",
      "fiscal_year_start": "01-01",
      "generate_hebrew_months": false
    },

    "qvd_layers": {
      "initial": "lib://QVD/Initial/",
      "process": "lib://QVD/Process/",
      "final": "lib://QVD/Final/"
    },

    "synthetic_key_handling": "link_table"
  }
}
```

---

## פרק 5: מיפוי מימדים ומדדים (Dimension & Measure Mapping)

### 5.1 הבעיה המרכזית

```
אפיון אומר: "מימד: לקוח"
שלב A יש:  customer_id, customer_unique_id
איזה לבחור?
```

**אתגרים:**
- שמות מימדים בעברית
- אין מיפוי ישיר לשדות טכניים
- Ambiguity: "לקוח" = `customer_id` או `customer_unique_id`?
- Composite: "מיקום לקוח" = `customer_city` + `customer_state`

### 5.2 אסטרטגיות מיפוי

| אסטרטגיה | תיאור | יתרונות | חסרונות |
|----------|-------|---------|---------|
| **Convention-Based** | חיפוש לפי keywords | מהיר, פשוט | לא אמין |
| **LLM-Based** | AI לניתוח סמנטי | אינטליגנטי | איטי, עלות |
| **Hybrid** ⭐ | Convention + LLM backup | איזון | מורכב |

### 5.3 גישת Hybrid (מומלצת)

```python
def map_dimension(dimension_name, dimension_desc, available_fields):
    # 1. ניסיון Convention
    mapping = try_convention_mapping(dimension_name, available_fields)

    if mapping:
        # 2. וידוא עם LLM (confidence check)
        confidence = llm_verify_mapping(
            dimension_name,
            dimension_desc,
            mapping
        )
        if confidence > 0.8:
            cache_mapping(dimension_name, mapping)
            return mapping

    # 3. אם נכשל - שאל LLM
    return llm_full_mapping(dimension_name, dimension_desc, available_fields)
```

### 5.4 Convention-Based Mapping

```python
DIMENSION_KEYWORDS = {
    "לקוח": ["customer", "client", "cust"],
    "מוצר": ["product", "item", "prod"],
    "תאריך": ["date", "time", "timestamp"],
    "מיקום": ["location", "city", "state", "geo"],
    "קטגוריה": ["category", "cat", "type"]
}

def try_convention_mapping(dimension_name_he, fields):
    for keyword_he, keywords_en in DIMENSION_KEYWORDS.items():
        if keyword_he in dimension_name_he:
            for field in fields:
                field_lower = field['name'].lower()
                for kw in keywords_en:
                    if kw in field_lower:
                        # עדיפות למפתח ראשי
                        if field.get('is_key'):
                            return {
                                "field": field['name'],
                                "table": field['table'],
                                "confidence": 0.9
                            }
                        candidates.append(field)

            if candidates:
                return {
                    "field": candidates[0]['name'],
                    "table": candidates[0]['table'],
                    "confidence": 0.7
                }

    return None
```

### 5.5 LLM-Based Mapping

```python
def llm_full_mapping(dimension_name, description, fields):
    prompt = f"""
    צריך למפות מימד עסקי לשדה טכני:

    מימד: {dimension_name}
    תיאור: {description}

    שדות זמינים:
    {json.dumps(fields, indent=2)}

    החזר בפורמט JSON:
    {{
      "field": "customer_id",
      "table": "olist_customers_dataset",
      "reasoning": "customer_id is the primary key...",
      "confidence": 0.95
    }}
    """

    response = claude.complete(prompt)
    return json.loads(response)
```

### 5.6 Measure Validation

**בעיית Pseudo-Code:**
```
נוסחה מהאפיון: Count(review_score >= 4) / Count(review_score) * 100

❌ לא Qlik syntax תקני!

✅ צריך: Count({<review_score={">=4"}>} review_score) / Count(review_score) * 100
```

**פתרון - Expression Validator:**

```python
def validate_and_fix_expression(expression, available_fields):
    # 1. Parse הביטוי
    parsed = parse_qlik_expression(expression)

    # 2. זיהוי pseudo-code patterns
    patterns = [
        (r"Count\((\w+)\s*(>=|<=|>|<|=)\s*(\d+)\)",
         convert_count_condition),
        (r"WHERE\s+(\w+)\s*(>|<)\s*(\d+)",
         convert_where_clause),
    ]

    # 3. תרגום ל-Qlik syntax
    for pattern, converter in patterns:
        if re.search(pattern, expression):
            expression = converter(expression, pattern)

    # 4. בדיקת שדות
    fields_used = extract_fields_from_expression(expression)
    for field in fields_used:
        if field not in [f['name'] for f in available_fields]:
            raise FieldNotFoundError(f"Field '{field}' not found")

    # 5. בדיקת טיפוסים
    validate_aggregation_types(expression, available_fields)

    return expression

def convert_count_condition(expression, pattern):
    """Convert Count(field >= value) to Set Analysis"""
    # Count(review_score >= 4) →
    # Count({<review_score={">=4"}>} review_score)
    match = re.search(pattern, expression)
    field = match.group(1)
    operator = match.group(2)
    value = match.group(3)

    set_analysis = f'Count({{<{field}={{"{operator}{value}"}}>}} {field})'
    return re.sub(pattern, set_analysis, expression)
```

### 5.7 Master Items Structure

```json
{
  "master_items": {
    "dimensions": [
      {
        "id": "dim_customer",
        "name_he": "לקוח",
        "name_en": "Customer",
        "field": "customer_id",
        "table": "DIM_Customers",
        "description": "מזהה לקוח ייחודי",
        "drill_group": null,
        "tags": ["customer", "identifier"]
      },
      {
        "id": "dim_date",
        "name_he": "תאריך רכישה",
        "name_en": "Purchase Date",
        "field": "OrderDate",
        "table": "DIM_Date",
        "description": "מימד זמן ראשי",
        "drill_group": "time_hierarchy",
        "tags": ["date", "time"]
      }
    ],

    "measures": [
      {
        "id": "msr_revenue",
        "name_he": "סה\"כ הכנסות",
        "name_en": "Total Revenue",
        "expression": "Sum(payment_value)",
        "expression_raw": "Sum(payment_value)",
        "format": "#,##0",
        "description": "סכום כל המכירות",
        "tags": ["revenue", "kpi"]
      },
      {
        "id": "msr_aov",
        "name_he": "ממוצע להזמנה",
        "name_en": "AOV",
        "expression": "Sum(payment_value) / Count(DISTINCT order_id)",
        "expression_raw": "Sum(payment_value) / Count(DISTINCT order_id)",
        "format": "#,##0.00",
        "description": "ערך ממוצע להזמנה",
        "tags": ["aov", "kpi", "calculated"]
      }
    ],

    "drill_groups": [
      {
        "id": "time_hierarchy",
        "name": "Time Hierarchy",
        "dimensions": ["Year", "Quarter", "Month", "Week", "Day"]
      },
      {
        "id": "geo_hierarchy",
        "name": "Geography",
        "dimensions": ["State", "City"]
      }
    ],

    "variables": [
      {
        "name": "vCurrentYear",
        "definition": "=Year(Today())",
        "description": "השנה הנוכחית"
      },
      {
        "name": "vCurrency",
        "definition": "'$'",
        "description": "סימן מטבע"
      }
    ]
  }
}
```

### 5.8 Mapping Table Output

```
| מימד (עברית) | Field (טכני) | Table | Confidence | Method |
|--------------|--------------|-------|------------|--------|
| לקוח | customer_id | DIM_Customers | 0.95 | LLM |
| תאריך רכישה | OrderDate | DIM_Date | 0.90 | Convention |
| מיקום לקוח | customer_state | DIM_Customers | 0.85 | Convention |
| קטגוריה | product_category_name | DIM_Products | 0.80 | LLM |
```

### 5.9 Error Handling

| שגיאה | סיבה | פתרון |
|-------|------|-------|
| `FieldNotFound` | שדה לא קיים | הצע שדות דומים |
| `AmbiguousMapping` | יותר ממועמד אחד | שאל משתמש |
| `InvalidExpression` | syntax לא תקין | הצע תיקון |
| `TypeMismatch` | Sum על string | שנה ל-Count |
| `LowConfidence` | confidence < 0.6 | דרוש אישור ידני |

---

## פרק 6: יצירת Load Script

### 6.1 מבנה Script סטנדרטי

```
┌─────────────────────────────────────────────┐
│ 1. CONFIGURATION                            │
│    - Variables                              │
│    - Connection strings                     │
│    - Parameters                             │
├─────────────────────────────────────────────┤
│ 2. INITIAL QVD LAYER                        │
│    - Load from sources                      │
│    - Minimal transformations                │
│    - Store to QVD                           │
├─────────────────────────────────────────────┤
│ 3. PROCESS QVD LAYER                        │
│    - Business logic                         │
│    - Calculations                           │
│    - Flags & derived fields                 │
├─────────────────────────────────────────────┤
│ 4. CALENDAR                                 │
│    - Generate date dimension                │
│    - Link to facts                          │
├─────────────────────────────────────────────┤
│ 5. FINAL MODEL                              │
│    - Star Schema structure                  │
│    - Key relationships                      │
│    - Cleanup (DROP, RENAME)                 │
├─────────────────────────────────────────────┤
│ 6. EXIT SCRIPT                              │
│    - Cleanup temporary tables               │
│    - Log completion                         │
└─────────────────────────────────────────────┘
```

### 6.2 Section 1: Configuration

```qlik
//=====================================================
// CONFIGURATION SECTION
//=====================================================

SET ThousandSep=',';
SET DecimalSep='.';
SET MoneyThousandSep=',';
SET MoneyDecimalSep='.';
SET MoneyFormat='$#,##0.00;-$#,##0.00';
SET TimeFormat='hh:mm:ss';
SET DateFormat='YYYY-MM-DD';
SET TimestampFormat='YYYY-MM-DD hh:mm:ss';

//===== PATHS =====
LET vPathQVD = 'lib://QVD/';
LET vPathInitial = '$(vPathQVD)Initial/';
LET vPathProcess = '$(vPathQVD)Process/';
LET vPathFinal = '$(vPathQVD)Final/';

//===== INCREMENTAL LOAD =====
LET vReloadType = 'incremental';  // 'full' or 'incremental'
LET vDeltaField = 'order_purchase_timestamp';
LET vLastLoadTime = Timestamp#('2026-01-01 00:00:00', 'YYYY-MM-DD hh:mm:ss');

//===== DEBUG =====
LET vDebugMode = 0;  // 1 = verbose logging
```

### 6.3 Section 2: Initial QVD Layer

```qlik
//=====================================================
// INITIAL QVD LAYER - Raw Data
//=====================================================

//===== ORDERS =====
IF '$(vReloadType)' = 'full' THEN
    Orders_Initial:
    LOAD
        order_id,
        customer_id,
        order_status,
        order_purchase_timestamp,
        order_delivered_customer_date,
        order_estimated_delivery_date
    FROM [lib://DataFiles/olist_orders_dataset.csv]
    (txt, codepage is 1252, embedded labels, delimiter is ',', msq);

    STORE Orders_Initial INTO [$(vPathInitial)Orders_Initial.qvd] (qvd);
    DROP TABLE Orders_Initial;

ELSE
    // Incremental: Load only new records
    Orders_Existing:
    LOAD order_id FROM [$(vPathInitial)Orders_Initial.qvd] (qvd);

    Orders_New:
    LOAD
        order_id,
        customer_id,
        order_status,
        order_purchase_timestamp,
        order_delivered_customer_date,
        order_estimated_delivery_date
    FROM [lib://DataFiles/olist_orders_dataset.csv]
    (txt, codepage is 1252, embedded labels, delimiter is ',', msq)
    WHERE NOT Exists(order_id);

    DROP TABLE Orders_Existing;

    // Concatenate with existing
    CONCATENATE (Orders_New)
    LOAD * FROM [$(vPathInitial)Orders_Initial.qvd] (qvd);

    STORE Orders_New INTO [$(vPathInitial)Orders_Initial.qvd] (qvd);
    DROP TABLE Orders_New;
END IF

//===== CUSTOMERS =====
Customers_Initial:
LOAD
    customer_id,
    customer_unique_id,
    customer_zip_code_prefix,
    customer_city,
    customer_state
FROM [lib://DataFiles/olist_customers_dataset.csv]
(txt, codepage is 1252, embedded labels, delimiter is ',', msq);

STORE Customers_Initial INTO [$(vPathInitial)Customers_Initial.qvd] (qvd);
DROP TABLE Customers_Initial;
```

### 6.4 Section 3: Process QVD Layer

```qlik
//=====================================================
// PROCESS QVD LAYER - Business Logic
//=====================================================

FACT_Orders:
LOAD
    // Keys
    AutoNumber(order_id) AS OrderKey,
    AutoNumber(customer_id) AS CustomerKey,

    // Original fields
    order_id,
    customer_id,
    order_status,

    // Date fields (for Calendar link)
    Date(Floor(order_purchase_timestamp)) AS OrderDate,

    // Calculated fields
    If(order_status = 'delivered', 1, 0) AS IsDelivered_FLAG,
    If(order_delivered_customer_date > order_estimated_delivery_date, 1, 0)
        AS IsDelayed_FLAG,

    // Delivery days
    order_delivered_customer_date - order_purchase_timestamp AS DeliveryDays

FROM [$(vPathInitial)Orders_Initial.qvd] (qvd);

STORE FACT_Orders INTO [$(vPathProcess)FACT_Orders.qvd] (qvd);

//===== CUSTOMERS =====
DIM_Customers:
LOAD
    AutoNumber(customer_id) AS CustomerKey,
    customer_id,
    customer_unique_id,
    customer_city AS City,
    customer_state AS State,

    // Derived: Customer segment (example)
    If(Len(customer_unique_id) > 0, 'Identified', 'Anonymous') AS CustomerSegment

FROM [$(vPathInitial)Customers_Initial.qvd] (qvd);

STORE DIM_Customers INTO [$(vPathProcess)DIM_Customers.qvd] (qvd);
```

### 6.5 Section 4: Calendar Generation

```qlik
//=====================================================
// CALENDAR - Auto-Generated
//=====================================================

// 1. Find date range from facts
TempDates:
LOAD
    Date(Floor(Min(OrderDate))) AS MinDate,
    Date(Floor(Max(OrderDate))) AS MaxDate
RESIDENT FACT_Orders;

LET vMinDate = Num(Peek('MinDate', 0, 'TempDates'));
LET vMaxDate = Num(Peek('MaxDate', 0, 'TempDates'));
DROP TABLE TempDates;

// 2. Generate calendar table
DIM_Date:
LOAD
    Date AS OrderDate,
    Year(Date) AS Year,
    Month(Date) AS Month,
    MonthName(Date) AS MonthYear,
    'Q' & Ceil(Month(Date)/3) AS Quarter,
    Week(Date) AS Week,
    WeekDay(Date) AS WeekDay,
    Day(Date) AS Day,
    If(WeekDay(Date) >= 5, 'Weekend', 'Weekday') AS DayType,

    // Hebrew month names (optional)
    // Pick(Month(Date), 'ינואר', 'פברואר', ...) AS MonthHE

    // Fiscal Year (if different from calendar)
    If(Month(Date) >= 4, Year(Date), Year(Date) - 1) AS FiscalYear
;
LOAD
    Date($(vMinDate) + IterNo() - 1) AS Date
AUTOGENERATE 1
WHILE $(vMinDate) + IterNo() - 1 <= $(vMaxDate);

STORE DIM_Date INTO [$(vPathFinal)DIM_Date.qvd] (qvd);
```

### 6.6 Section 5: Final Model

```qlik
//=====================================================
// FINAL MODEL - Star Schema
//=====================================================

// Load Final tables from Process layer
FACT_Orders:
LOAD * FROM [$(vPathProcess)FACT_Orders.qvd] (qvd);

DIM_Customers:
LOAD * FROM [$(vPathProcess)DIM_Customers.qvd] (qvd);

DIM_Date:
LOAD * FROM [$(vPathFinal)DIM_Date.qvd] (qvd);

//===== CLEANUP =====
// Drop unnecessary fields
DROP FIELDS customer_id FROM FACT_Orders;

// Rename fields for clarity (if needed)
RENAME FIELD OrderKey TO %OrderKey;
RENAME FIELD CustomerKey TO %CustomerKey;
```

### 6.7 Incremental Load Strategies

| סוג | מתאים ל | שדה מפתח | יתרונות | חסרונות |
|-----|---------|---------|---------|---------|
| **none** | טבלאות קטנות | - | פשוט | איטי |
| **by_date** | נתונים עם timestamp | created_at | סטנדרטי | צריך index |
| **by_id** | נתונים עם ID רציף | id | מהיר | לא תומך עדכונים |
| **time_window** | נתונים משתנים | modified_at | תומך עדכונים | מורכב |
| **custom** | לוגיקה מיוחדת | - | גמיש | תחזוקה |

### 6.8 Incremental Load Template

```qlik
//===== INCREMENTAL LOAD TEMPLATE =====
SUB IncrementalLoad(vTableName, vSourcePath, vQVDPath, vDeltaField)

    // 1. Check if QVD exists
    LET vQVDExists = FileSize('$(vQVDPath)');

    IF IsNull(vQVDExists) THEN
        // Full load - QVD doesn't exist
        TRACE [INCREMENTAL] First load for $(vTableName);

        $(vTableName):
        LOAD * FROM [$(vSourcePath)];
        STORE $(vTableName) INTO [$(vQVDPath)] (qvd);

    ELSE
        // Incremental load
        TRACE [INCREMENTAL] Loading delta for $(vTableName);

        // Get last loaded value
        TempMax:
        LOAD Max($(vDeltaField)) AS LastValue
        FROM [$(vQVDPath)] (qvd);

        LET vLastValue = Peek('LastValue', 0, 'TempMax');
        DROP TABLE TempMax;

        // Load new records
        $(vTableName)_New:
        LOAD * FROM [$(vSourcePath)]
        WHERE $(vDeltaField) > '$(vLastValue)';

        // Concatenate with existing
        CONCATENATE ($(vTableName)_New)
        LOAD * FROM [$(vQVDPath)] (qvd);

        RENAME TABLE $(vTableName)_New TO $(vTableName);
        STORE $(vTableName) INTO [$(vQVDPath)] (qvd);

    END IF

    DROP TABLE $(vTableName);

END SUB

// Usage:
CALL IncrementalLoad('Orders', 'lib://DB/orders.csv', '$(vPathQVD)Orders.qvd', 'order_date');
```

### 6.9 אופטימיזציות ביצועים

```qlik
//===== OPTIMIZATION FUNCTIONS =====

// 1. AutoNumber - המר מחרוזות למספרים (חיסכון 60% RAM)
AutoNumber(order_id) AS %OrderKey

// 2. Exists - בדוק קיום לטעינה סלקטיבית
WHERE NOT Exists(order_id)

// 3. Keep - סינון ללא מיזוג טבלאות
INNER KEEP (FACT_Orders)
LOAD customer_id FROM DIM_Customers;

// 4. Selective Loading - טען רק שדות נדרשים
LOAD
    field1,
    field2
    // NOT: LOAD *
FROM source.qvd (qvd);

// 5. QVD Optimized Load - טעינה מהירה
// ללא WHERE, transformations
LOAD * FROM data.qvd (qvd);  // Uses optimized QVD reader
```

### 6.10 Error Handling

```qlik
//===== ERROR HANDLING =====

// Wrap critical sections
SET ErrorMode = 0;  // Continue on error

TRY:
    Orders:
    LOAD * FROM [lib://DataFiles/orders.csv];
CATCH:
    TRACE ERROR: Failed to load orders!;
    LET vErrorCount = vErrorCount + 1;
END TRY

// Check for errors at end
IF vErrorCount > 0 THEN
    TRACE SCRIPT COMPLETED WITH $(vErrorCount) ERRORS!;
ELSE
    TRACE SCRIPT COMPLETED SUCCESSFULLY;
END IF
```

---

## פרק 7: GUI & Visualizations

### 7.1 סקירת סוגי Visualizations

| Type | Qlik Name | מתי להשתמש | Master Items נדרשים |
|------|-----------|-----------|---------------------|
| `kpi` | KPI | מדד יחיד, הצגה בולטת | 1 Measure |
| `barchart` | Bar Chart | השוואה בין קטגוריות | 1 Dim + 1-3 Measures |
| `linechart` | Line Chart | מגמות לאורך זמן | 1 Dim (date) + 1-3 Measures |
| `combochart` | Combo Chart | שילוב Bar + Line | 1 Dim + 2+ Measures |
| `piechart` | Pie Chart | התפלגות (max 5-7 ערכים) | 1 Dim + 1 Measure |
| `table` | Table | פירוט מלא | Multiple Dims + Measures |
| `pivottable` | Pivot Table | ניתוח רב-מימדי | 2+ Dims + Measures |
| `treemap` | TreeMap | היררכיות + גדלים | 1-2 Dims + 1 Measure |
| `scatterplot` | Scatter Plot | קורלציות | 1 Dim + 2 Measures |
| `map` | Map | נתונים גיאוגרפיים | 1 Geo Dim + Measure |
| `gauge` | Gauge | מדד ביחס ליעד | 1 Measure + Target |

### 7.2 Grid System

```
Qlik Sense Sheet Grid:
├── Width: 24 columns
├── Height: Unlimited rows
├── Cell Unit: ~50px
└── Responsive: Auto-adjusts

Standard Layouts:
┌────────────────────────────────────────────────┐
│ KPI    │ KPI    │ KPI    │ KPI    │ KPI    │ KPI │  row 0-2
│ (4col) │ (4col) │ (4col) │ (4col) │ (4col) │(4col)│
├────────────────────────────────────────────────┤
│          Line Chart (24 columns)               │  row 3-10
│          Revenue Trend                         │
├────────────────────┬───────────────────────────┤
│   Bar Chart        │    Table                  │  row 11-20
│   (12 col)         │    (12 col)               │
└────────────────────┴───────────────────────────┘
```

### 7.3 Auto-Layout Algorithm

```python
def auto_layout(objects: List[dict]) -> List[dict]:
    """
    Auto-generate layout positions for visualizations.

    Grid: 24 columns x unlimited rows
    """
    layouts = []
    current_row = 0
    current_col = 0

    # Size presets by type
    SIZES = {
        'kpi':        {'colspan': 4,  'rowspan': 3},
        'barchart':   {'colspan': 12, 'rowspan': 8},
        'linechart':  {'colspan': 24, 'rowspan': 8},
        'combochart': {'colspan': 24, 'rowspan': 8},
        'piechart':   {'colspan': 8,  'rowspan': 8},
        'table':      {'colspan': 24, 'rowspan': 10},
        'pivottable': {'colspan': 24, 'rowspan': 12},
        'treemap':    {'colspan': 12, 'rowspan': 8},
        'scatterplot':{'colspan': 12, 'rowspan': 8},
        'map':        {'colspan': 24, 'rowspan': 12},
        'gauge':      {'colspan': 6,  'rowspan': 6},
    }

    for obj in objects:
        obj_type = obj['type']
        size = SIZES.get(obj_type, {'colspan': 12, 'rowspan': 8})

        # Check if fits in current row
        if current_col + size['colspan'] > 24:
            current_col = 0
            current_row += layouts[-1]['rowspan'] if layouts else 0

        layout = {
            'col': current_col,
            'row': current_row,
            'colspan': size['colspan'],
            'rowspan': size['rowspan']
        }

        layouts.append(layout)
        current_col += size['colspan']

        # Full width items force new row
        if size['colspan'] >= 24:
            current_col = 0
            current_row += size['rowspan']

    return layouts
```

### 7.4 Sheet Template

```json
{
  "sheets": [
    {
      "id": "sheet_executive",
      "title_he": "לוח מחוונים ראשי",
      "title_en": "Executive Dashboard",
      "rank": 1,
      "description": "סקירה כללית של ביצועי העסק",

      "objects": [
        {
          "id": "kpi_revenue",
          "type": "kpi",
          "title": "סה\"כ הכנסות",
          "measures": ["msr_total_revenue"],
          "layout": {"col": 0, "row": 0, "colspan": 4, "rowspan": 3}
        },
        {
          "id": "kpi_orders",
          "type": "kpi",
          "title": "מספר הזמנות",
          "measures": ["msr_order_count"],
          "layout": {"col": 4, "row": 0, "colspan": 4, "rowspan": 3}
        },
        {
          "id": "kpi_aov",
          "type": "kpi",
          "title": "ממוצע להזמנה",
          "measures": ["msr_aov"],
          "layout": {"col": 8, "row": 0, "colspan": 4, "rowspan": 3}
        },
        {
          "id": "chart_trend",
          "type": "linechart",
          "title": "מגמת הכנסות",
          "dimensions": ["dim_month"],
          "measures": ["msr_total_revenue"],
          "layout": {"col": 0, "row": 3, "colspan": 24, "rowspan": 8}
        },
        {
          "id": "chart_category",
          "type": "barchart",
          "title": "הכנסות לפי קטגוריה",
          "dimensions": ["dim_category"],
          "measures": ["msr_total_revenue"],
          "sorting": {"by": "msr_total_revenue", "order": "desc"},
          "layout": {"col": 0, "row": 11, "colspan": 12, "rowspan": 8}
        },
        {
          "id": "table_detail",
          "type": "table",
          "title": "פירוט מכירות",
          "dimensions": ["dim_product", "dim_customer"],
          "measures": ["msr_total_revenue", "msr_order_count"],
          "layout": {"col": 12, "row": 11, "colspan": 12, "rowspan": 8}
        }
      ]
    }
  ]
}
```

### 7.5 Visualization JSON Structure (Qlik API Format)

```json
{
  "qInfo": {
    "qType": "barchart",
    "qId": "chart_category"
  },
  "qMetaDef": {
    "title": "הכנסות לפי קטגוריה",
    "description": ""
  },
  "qHyperCubeDef": {
    "qDimensions": [
      {
        "qDef": {
          "qFieldDefs": ["product_category_name"],
          "qFieldLabels": ["קטגוריה"]
        },
        "qNullSuppression": true
      }
    ],
    "qMeasures": [
      {
        "qDef": {
          "qDef": "Sum(payment_value)",
          "qLabel": "סה\"כ הכנסות"
        },
        "qSortBy": {
          "qSortByNumeric": -1
        }
      }
    ],
    "qInitialDataFetch": [
      {
        "qWidth": 2,
        "qHeight": 100
      }
    ]
  },
  "visualization": "barchart"
}
```

### 7.6 Standard Sheets לפי סוג אפליקציה

#### Executive Dashboard
```
┌──────────────────────────────────────┐
│ KPI │ KPI │ KPI │ KPI │ KPI │ KPI   │  Main metrics
├──────────────────────────────────────┤
│         Line Chart (Trend)          │  Revenue over time
├──────────────────────────────────────┤
│  Bar (Categories)  │  Pie (Segments) │  Breakdowns
└──────────────────────────────────────┘
```

#### Sales Analysis
```
┌──────────────────────────────────────┐
│         Combo Chart (Time)          │  Sales + Qty
├──────────────────────────────────────┤
│  TreeMap (Products)│  Table (Detail) │  Product analysis
├──────────────────────────────────────┤
│       Pivot Table (Multi-dim)        │  Deep dive
└──────────────────────────────────────┘
```

#### Geographic Analysis
```
┌──────────────────────────────────────┐
│              Map                     │  Geographic view
├──────────────────────────────────────┤
│  Bar (Top Cities)  │ Table (Regions) │  Location details
└──────────────────────────────────────┘
```

### 7.7 Theme & Colors

```json
{
  "theme": {
    "name": "project_theme",
    "type": "custom",

    "color": {
      "paletteColor": {
        "primary": "#1E88E5",
        "secondary": "#FFA726"
      },
      "dataColors": {
        "primaryDataColor": "#1E88E5"
      },
      "scales": [
        {
          "scale": "default",
          "type": "sequential",
          "colors": ["#E3F2FD", "#1565C0"]
        }
      ]
    },

    "fontSize": "12px",
    "fontFamily": "Arial, Helvetica, sans-serif",

    "object": {
      "kpi": {
        "fontSize": "24px",
        "fontColor": "#333333"
      }
    }
  }
}
```

### 7.8 Filters & Selections

```json
{
  "filters": [
    {
      "id": "filter_date",
      "type": "filterpane",
      "dimensions": ["Year", "Quarter", "Month"],
      "layout": {"col": 0, "row": 0, "colspan": 24, "rowspan": 2}
    },
    {
      "id": "filter_category",
      "type": "listbox",
      "dimension": "product_category_name",
      "search": true,
      "layout": {"col": 0, "row": 2, "colspan": 6, "rowspan": 4}
    }
  ]
}
```

### 7.9 Sheet Generator Code

```python
def generate_sheets(model: dict) -> list:
    """Generate Qlik sheets from model definition"""
    sheets = []

    for sheet_def in model['presentation']['sheets']:
        sheet = {
            'qInfo': {'qType': 'sheet', 'qId': sheet_def['id']},
            'qMetaDef': {
                'title': sheet_def['title_he'],
                'description': sheet_def.get('description', '')
            },
            'rank': sheet_def['rank'],
            'cells': []
        }

        # Auto-layout if not specified
        if not all('layout' in obj for obj in sheet_def['objects']):
            layouts = auto_layout(sheet_def['objects'])
        else:
            layouts = [obj['layout'] for obj in sheet_def['objects']]

        # Create visualizations
        for i, obj_def in enumerate(sheet_def['objects']):
            viz = create_visualization(
                obj_type=obj_def['type'],
                obj_id=obj_def['id'],
                title=obj_def['title'],
                dimensions=obj_def.get('dimensions', []),
                measures=obj_def.get('measures', []),
                layout=layouts[i],
                model=model
            )
            sheet['cells'].append(viz)

        sheets.append(sheet)

    return sheets
```

---

## פרק 8: Validation & Quality Assurance

### 8.1 סקירת בדיקות

```
┌──────────────────────────────────────────────────────────────┐
│                    VALIDATION PIPELINE                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────┐   ┌────────────────┐   ┌──────────────┐  │
│  │ Phase 1        │   │ Phase 2        │   │ Phase 3      │  │
│  │ SPEC VALIDATION│ → │ MODEL VALIDATION│ → │ APP VALIDATION│  │
│  │                │   │                │   │              │  │
│  │ • Required     │   │ • Data Model   │   │ • Load Script│  │
│  │   fields       │   │ • Relationships│   │ • Master Items│  │
│  │ • Data types   │   │ • Synthetic    │   │ • Viz render │  │
│  │ • References   │   │   Keys         │   │ • Performance│  │
│  └────────────────┘   └────────────────┘   └──────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 8.2 Phase 1: Spec Validation

| בדיקה | סוג | תיאור | פעולה בכישלון |
|-------|-----|-------|---------------|
| Required Tables | ERROR | טבלאות מקור קיימות | Stop |
| Required Fields | ERROR | שדות מפתח קיימים | Stop |
| Relationship Refs | ERROR | טבלאות בקשר קיימות | Stop |
| Measure Fields | ERROR | שדות בנוסחאות קיימים | Stop |
| Dimension Mapping | WARNING | מיפוי לשדות טכניים | Ask user |
| Data Types | WARNING | סוגי נתונים תקינים | Auto-fix |

```python
def validate_spec(parsed_spec: dict, metadata: dict) -> ValidationResult:
    errors = []
    warnings = []

    # 1. Check required tables exist
    spec_tables = {t['source_name'] for t in parsed_spec['data_sources']}
    meta_tables = {t['name'] for t in metadata['tables']}

    missing_tables = spec_tables - meta_tables
    if missing_tables:
        errors.append(f"Missing tables: {missing_tables}")

    # 2. Check fields exist
    for measure in parsed_spec['measures']:
        fields_used = extract_fields(measure['expression_raw'])
        for field in fields_used:
            if not field_exists(field, metadata):
                errors.append(f"Field '{field}' not found in measure '{measure['name_he']}'")

    # 3. Check relationships
    for rel in parsed_spec['relationships']:
        if rel['left_table'] not in meta_tables:
            errors.append(f"Left table '{rel['left_table']}' not found")
        if rel['right_table'] not in meta_tables:
            errors.append(f"Right table '{rel['right_table']}' not found")

    return ValidationResult(
        status='FAIL' if errors else 'PASS',
        errors=errors,
        warnings=warnings
    )
```

### 8.3 Phase 2: Model Validation

| בדיקה | סוג | תיאור | פעולה |
|-------|-----|-------|-------|
| Synthetic Keys | WARNING | יותר משדה מקשר אחד | Link Table |
| Circular References | ERROR | לולאות במודל | Break loop |
| Data Islands | WARNING | טבלאות לא מקושרות | Connect/Remove |
| High Cardinality | WARNING | > 10,000 ערכים ב-Link | Alert |
| Missing Keys | ERROR | חסרים מפתחות | Add keys |

```python
def validate_model(model: dict) -> ValidationResult:
    errors = []
    warnings = []

    # 1. Check for synthetic keys
    field_usage = count_field_usage(model)
    for field, tables in field_usage.items():
        if len(tables) > 2:  # Appears in more than 2 tables
            warnings.append(f"Potential synthetic key: '{field}' in {tables}")

    # 2. Check for circular references
    graph = build_relationship_graph(model)
    cycles = find_cycles(graph)
    if cycles:
        errors.append(f"Circular references detected: {cycles}")

    # 3. Check for data islands
    connected = find_connected_components(graph)
    if len(connected) > 1:
        warnings.append(f"Data islands detected: {len(connected)} separate groups")

    # 4. Check cardinality for link tables
    for table in model.get('link_tables', []):
        cardinality = estimate_cardinality(table)
        if cardinality > 10000:
            warnings.append(f"High cardinality in link table '{table}': {cardinality}")

    return ValidationResult(
        status='FAIL' if errors else 'PASS',
        errors=errors,
        warnings=warnings
    )
```

### 8.4 Phase 3: App Validation

| בדיקה | סוג | תיאור | Threshold |
|-------|-----|-------|-----------|
| Script Execution | ERROR | Script רץ ללא שגיאות | 0 errors |
| Data Loaded | ERROR | נתונים נטענו | > 0 rows |
| Row Counts | WARNING | כמויות צפויות | ±10% |
| Expression Syntax | ERROR | ביטויים תקינים | All valid |
| Viz Rendering | WARNING | תרשימים מציגים | All render |
| Performance | WARNING | זמן טעינה סביר | < 60 sec |

```python
def validate_app(app_path: str, expected: dict) -> ValidationResult:
    errors = []
    warnings = []

    app = open_qlik_app(app_path)

    # 1. Check script execution
    reload_result = app.do_reload()
    if not reload_result.success:
        errors.append(f"Script error: {reload_result.error}")
        return ValidationResult(status='FAIL', errors=errors)

    # 2. Check data loaded
    tables = app.get_table_list()
    if not tables:
        errors.append("No tables loaded")

    # 3. Check row counts
    for table_name, expected_count in expected.get('row_counts', {}).items():
        actual_count = app.get_row_count(table_name)
        variance = abs(actual_count - expected_count) / expected_count

        if variance > 0.1:  # More than 10% difference
            warnings.append(
                f"Row count mismatch for '{table_name}': "
                f"expected {expected_count}, got {actual_count}"
            )

    # 4. Check expressions
    master_items = app.get_master_items()
    for item in master_items:
        if item['type'] == 'measure':
            result = app.evaluate_expression(item['expression'])
            if result.error:
                errors.append(f"Invalid expression in '{item['title']}': {result.error}")

    # 5. Check visualizations render
    sheets = app.get_sheets()
    for sheet in sheets:
        for viz in sheet['objects']:
            render_result = app.render_object(viz['id'])
            if not render_result.success:
                warnings.append(f"Visualization '{viz['title']}' failed to render")

    # 6. Check performance
    reload_time = app.get_last_reload_time()
    if reload_time > 60:
        warnings.append(f"Slow reload: {reload_time} seconds")

    return ValidationResult(
        status='FAIL' if errors else 'PASS',
        errors=errors,
        warnings=warnings
    )
```

### 8.5 Validation Report Format

```json
{
  "validation_report": {
    "timestamp": "2026-01-19T14:30:00Z",
    "project_name": "olist_ecommerce",
    "overall_status": "PASS",

    "phases": {
      "spec_validation": {
        "status": "PASS",
        "errors": [],
        "warnings": [
          "Dimension 'מיקום לקוח' mapped with 70% confidence"
        ]
      },

      "model_validation": {
        "status": "PASS",
        "errors": [],
        "warnings": [
          "Potential synthetic key: 'order_id' in [FACT_Orders, FACT_Items]"
        ]
      },

      "app_validation": {
        "status": "PASS",
        "errors": [],
        "warnings": [],
        "metrics": {
          "reload_time_seconds": 12.5,
          "total_rows": 500000,
          "tables_count": 8,
          "master_items_count": 15,
          "sheets_count": 5
        }
      }
    },

    "checks": [
      {"name": "Required tables exist", "status": "PASS"},
      {"name": "Required fields exist", "status": "PASS"},
      {"name": "Relationships valid", "status": "PASS"},
      {"name": "No synthetic keys", "status": "PASS"},
      {"name": "No circular references", "status": "PASS"},
      {"name": "No data islands", "status": "PASS"},
      {"name": "Script executed", "status": "PASS"},
      {"name": "Data loaded", "status": "PASS"},
      {"name": "Expressions valid", "status": "PASS"},
      {"name": "Visualizations render", "status": "PASS"}
    ],

    "recommendations": [
      "Consider creating Link Table for order_id relationship",
      "Add index on order_purchase_timestamp for faster incremental loads"
    ]
  }
}
```

### 8.6 Success Criteria (Definition of Done)

| קריטריון | יעד | מדידה |
|----------|-----|-------|
| Parser Accuracy | 100% | All spec fields extracted |
| Mapping Success | ≥ 95% | Dimensions mapped correctly |
| Expression Validity | 100% | All expressions execute |
| Script Execution | 0 errors | Clean reload |
| Visualizations | 100% | All charts render data |
| Synthetic Keys | 0 | No auto-generated keys |
| Row Count Accuracy | ±10% | Match expected counts |
| Performance | < 60 sec | Full reload time |

### 8.7 Performance Targets

| פעולה | יעד | מקסימום |
|-------|-----|---------|
| Spec Parsing | < 5 sec | 10 sec |
| Enrichment | < 10 sec | 20 sec |
| Dimension Mapping | < 30 sec | 60 sec |
| Script Generation | < 5 sec | 10 sec |
| QVF Assembly | < 60 sec | 120 sec |
| Full Pipeline | < 2 min | 5 min |

### 8.8 Error Handling Strategy

```python
class ValidationError(Exception):
    def __init__(self, code: str, message: str, recoverable: bool = False):
        self.code = code
        self.message = message
        self.recoverable = recoverable

ERROR_HANDLERS = {
    'MISSING_TABLE': lambda e: ask_user_to_add_table(e.details),
    'MISSING_FIELD': lambda e: suggest_similar_fields(e.details),
    'SYNTHETIC_KEY': lambda e: auto_create_link_table(e.details),
    'INVALID_EXPRESSION': lambda e: suggest_fix(e.details),
    'HIGH_CARDINALITY': lambda e: warn_and_continue(e.details),
}

def handle_validation_error(error: ValidationError):
    handler = ERROR_HANDLERS.get(error.code)
    if handler:
        return handler(error)
    elif error.recoverable:
        log_warning(error.message)
        return 'continue'
    else:
        raise error
```

### 8.9 Checklist - Pre-Deployment

```
□ Spec Validation
  □ All required tables exist in source
  □ All required fields exist
  □ Relationships reference valid tables
  □ Measure expressions use valid fields

□ Model Validation
  □ No synthetic keys (or properly handled)
  □ No circular references
  □ No data islands
  □ Link table cardinality < 10,000

□ App Validation
  □ Script executes without errors
  □ All tables load data
  □ Row counts match expectations (±10%)
  □ All expressions evaluate successfully
  □ All visualizations render

□ Performance
  □ Reload time < 60 seconds
  □ RAM usage reasonable
  □ No CPU spikes

□ Documentation
  □ Validation report generated
  □ Any warnings documented
  □ Recommendations logged
```

---

## פרק 9: Human-in-the-Loop & פיתוח אינקרמנטלי

### 9.1 נקודות התערבות אנושית (HITL Decision Points)

המערכת פועלת ב-3 מצבים:

```
┌─────────────────────────────────────────────────────────────┐
│                    OPERATION MODES                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  🟢 AUTO (Confidence > 90%)                                  │
│     המערכת מחליטה ומבצעת - ללא התערבות                      │
│                                                              │
│  🟡 SUGGEST (Confidence 60-90%)                              │
│     המערכת מציעה - המשתמש מאשר או בוחר אלטרנטיבה            │
│                                                              │
│  🔴 ASK (Confidence < 60% OR Critical Decision)              │
│     המערכת עוצרת ומבקשת החלטה מהמשתמש                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### מפת נקודות התערבות לפי שלב:

| שלב | נקודת החלטה | מצב | דוגמה |
|-----|-------------|-----|-------|
| **Parser** | זיהוי סעיף | 🟡 SUGGEST | "האם זו טבלת מקורות (7.2)?" |
| **Parser** | טבלה ריקה | 🔴 ASK | "הטבלה ריקה - לדלג או לעצור?" |
| **Enricher** | טבלה לא נמצאה | 🔴 ASK | "טבלה X לא קיימת ב-metadata" |
| **Mapper** | מיפוי מימד | 🟡 SUGGEST | "לקוח → customer_id (85%)" |
| **Mapper** | מיפוי עמום | 🔴 ASK | "לקוח: customer_id או customer_unique_id?" |
| **Mapper** | מיפוי מדד | 🟢 AUTO | "Sum(payment_value) תקין" |
| **Script Gen** | Synthetic Key | 🟡 SUGGEST | "זוהה SK - להשתמש ב-Link Table?" |
| **Script Gen** | Circular Ref | 🔴 ASK | "קשר מעגלי - איזה קשר לנתק?" |
| **Model** | Cardinality גבוה | 🟡 SUGGEST | "> 10,000 - להשתמש ב-Concatenate?" |
| **UI Builder** | Layout | 🟢 AUTO | "Auto-layout פועל" |
| **Validator** | שגיאה קריטית | 🔴 ASK | "Expression לא תקין - לתקן?" |

### 9.2 ממשק אינטראקטיבי

> ⚠️ **OUT OF SCOPE - MVP**: בשלב זה הממשק הוא CLI/Console בלבד.
> פלט: טבלאות + Simple Table ב-GUI לצורך בדיקות.

### 9.3 Decision Log - תיעוד החלטות

כל החלטה נשמרת ב-JSON:

```json
{
  "decision_log": [
    {
      "timestamp": "2026-01-19T10:15:32Z",
      "phase": "Mapper",
      "decision_type": "dimension_mapping",
      "question": "מיפוי מימד 'לקוח'",
      "options": [
        {"field": "customer_id", "confidence": 0.75},
        {"field": "customer_unique_id", "confidence": 0.85}
      ],
      "mode": "SUGGEST",
      "selected": "customer_unique_id",
      "selected_by": "user",
      "reasoning": "User selected for returning customers analysis"
    },
    {
      "timestamp": "2026-01-19T10:16:45Z",
      "phase": "Script Gen",
      "decision_type": "synthetic_key_handling",
      "question": "Synthetic Key בין Orders ל-Items",
      "options": ["link_table", "composite_key", "drop_field"],
      "mode": "SUGGEST",
      "selected": "link_table",
      "selected_by": "auto",
      "reasoning": "Low cardinality (< 5,000)"
    }
  ]
}
```

### 9.4 Learning from Decisions - למידה מהחלטות

```python
class DecisionLearner:
    def learn_from_decisions(self, project_decisions: List[Decision]):
        """
        לומד מהחלטות קודמות לשיפור המלצות עתידיות
        """
        for decision in project_decisions:
            if decision.selected_by == "user":
                # המשתמש בחר אחרת מההמלצה
                self.update_mapping_rules(
                    context=decision.context,
                    expected=decision.recommended,
                    actual=decision.selected
                )

        # שמירה ב-cache לפרויקטים עתידיים
        self.save_learned_mappings()

    def get_cached_mapping(self, dimension_name, context):
        """
        בדיקה אם יש מיפוי ידוע מפרויקטים קודמים
        """
        return self.mapping_cache.get(
            (dimension_name, context.client_domain)
        )
```

---

### 9.5 Script Chunking - פירוק סקריפט לחלקים

#### עקרון הפירוק:

```
סקריפט מלא (2000 שורות)
         ↓
┌────────────────────────────────────────────┐
│  Chunk 1: Configuration (50 lines)         │
│  ✅ בדיקה: Variables defined correctly     │
├────────────────────────────────────────────┤
│  Chunk 2: Initial Load - Table 1 (100 lines)│
│  ✅ בדיקה: Table loaded, row count OK      │
├────────────────────────────────────────────┤
│  Chunk 3: Initial Load - Table 2 (100 lines)│
│  ✅ בדיקה: Table loaded, row count OK      │
├────────────────────────────────────────────┤
│  Chunk 4: Process Layer (200 lines)        │
│  ✅ בדיקה: Transformations applied         │
├────────────────────────────────────────────┤
│  Chunk 5: Calendar (80 lines)              │
│  ✅ בדיקה: Date range correct              │
├────────────────────────────────────────────┤
│  Chunk 6: Final Model (150 lines)          │
│  ✅ בדיקה: No synthetic keys, no loops     │
├────────────────────────────────────────────┤
│  Chunk 7: Cleanup (20 lines)               │
│  ✅ בדיקה: Temp tables dropped             │
└────────────────────────────────────────────┘
```

#### מבנה Chunk:

```json
{
  "chunk": {
    "id": "chunk_003",
    "name": "Initial Load - Customers",
    "section": "010",
    "start_line": 150,
    "end_line": 220,
    "dependencies": ["chunk_001"],
    "produces": ["Customers_Initial"],

    "script": "//=== Section 010: Customers ===\nCustomers_Initial:\nLOAD...",

    "validation": {
      "pre_conditions": [
        {"type": "file_exists", "path": "lib://DataFiles/customers.csv"}
      ],
      "post_conditions": [
        {"type": "table_exists", "name": "Customers_Initial"},
        {"type": "row_count", "table": "Customers_Initial", "min": 90000, "max": 110000},
        {"type": "field_exists", "table": "Customers_Initial", "field": "customer_id"}
      ]
    }
  }
}
```

### 9.6 Incremental Execution - הרצה מדורגת

```python
class IncrementalExecutor:
    def execute_chunks(self, chunks: List[Chunk], mode: str = "step_by_step"):
        """
        הרצת סקריפט בחלקים עם בדיקה אחרי כל חלק

        Modes:
        - "step_by_step": עצור אחרי כל chunk, המתן לאישור
        - "auto_continue": המשך אוטומטי אם הבדיקות עברו
        - "stop_on_error": עצור רק בשגיאה
        """
        results = []

        for chunk in chunks:
            print(f"\n{'='*50}")
            print(f"🔄 Executing: {chunk.name}")
            print(f"{'='*50}")

            # 1. בדיקת pre-conditions
            pre_check = self.validate_pre_conditions(chunk)
            if not pre_check.passed:
                return self.handle_failure(chunk, pre_check, "pre")

            # 2. הרצת ה-chunk
            exec_result = self.run_qlik_script(chunk.script)
            if not exec_result.success:
                return self.handle_failure(chunk, exec_result, "exec")

            # 3. בדיקת post-conditions
            post_check = self.validate_post_conditions(chunk)
            if not post_check.passed:
                return self.handle_failure(chunk, post_check, "post")

            # 4. הצגת תוצאות
            print(f"✅ {chunk.name} - PASSED")
            print(f"   Tables: {exec_result.tables_created}")
            print(f"   Rows: {exec_result.total_rows}")
            print(f"   Time: {exec_result.duration_ms}ms")

            results.append({
                "chunk": chunk.id,
                "status": "passed",
                "details": exec_result
            })

            # 5. המתנה לאישור (ב-step_by_step mode)
            if mode == "step_by_step":
                user_input = input("\n[Enter] להמשיך | [s] לדלג | [q] לעצור: ")
                if user_input == 'q':
                    break
                if user_input == 's':
                    continue

        return results
```

### 9.7 Chunk Validation - בדיקות לכל חלק

```python
class ChunkValidator:
    """
    בדיקות ספציפיות לכל סוג chunk
    """

    VALIDATION_RULES = {
        "configuration": [
            {"check": "variables_defined", "vars": ["vPathQVD", "vReloadType"]},
            {"check": "no_syntax_errors"}
        ],

        "initial_load": [
            {"check": "table_created"},
            {"check": "row_count_in_range", "tolerance": 0.1},
            {"check": "no_null_keys"},
            {"check": "field_types_correct"}
        ],

        "process_layer": [
            {"check": "transformations_applied"},
            {"check": "calculated_fields_valid"},
            {"check": "no_synthetic_keys"}
        ],

        "calendar": [
            {"check": "date_range_complete"},
            {"check": "all_date_parts_exist"},  # Year, Month, Quarter, etc.
            {"check": "linked_to_facts"}
        ],

        "final_model": [
            {"check": "star_schema_valid"},
            {"check": "no_circular_references"},
            {"check": "no_data_islands"},
            {"check": "keys_connected"}
        ],

        "master_items": [
            {"check": "all_expressions_valid"},
            {"check": "no_missing_fields"},
            {"check": "formats_correct"}
        ]
    }

    def validate_chunk(self, chunk: Chunk, app_connection) -> ValidationResult:
        rules = self.VALIDATION_RULES.get(chunk.type, [])
        results = []

        for rule in rules:
            result = self.run_check(rule, chunk, app_connection)
            results.append(result)

            if not result.passed and rule.get("critical", False):
                return ValidationResult(
                    passed=False,
                    failed_check=rule["check"],
                    details=result.error
                )

        return ValidationResult(
            passed=all(r.passed for r in results),
            checks=results
        )
```

### 9.8 Interactive Testing UI

> **OUT OF SCOPE - MVP**: בשלב זה הממשק הוא CLI/Console בלבד.
> פלט: טבלאות + Simple Table ב-GUI לצורך בדיקות.
> ממשק גרפי אינטראקטיבי יתווסף בגרסאות עתידיות.

### 9.9 Rollback & Recovery

```python
class ChunkRollback:
    """
    מנגנון חזרה לאחור במקרה של כישלון
    """

    def __init__(self):
        self.checkpoints = []

    def save_checkpoint(self, chunk_id: str, app_state: dict):
        """שמירת מצב לפני הרצת chunk"""
        self.checkpoints.append({
            "chunk_id": chunk_id,
            "timestamp": datetime.now(),
            "tables": app_state["tables"].copy(),
            "qvd_files": self.snapshot_qvds()
        })

    def rollback_to(self, chunk_id: str):
        """חזרה למצב לפני chunk מסוים"""
        checkpoint = next(
            (c for c in self.checkpoints if c["chunk_id"] == chunk_id),
            None
        )

        if checkpoint:
            # 1. מחיקת טבלאות שנוספו
            self.drop_tables_after(checkpoint["tables"])

            # 2. שחזור QVD files
            self.restore_qvds(checkpoint["qvd_files"])

            print(f"🔄 Rolled back to before: {chunk_id}")
            return True

        return False
```

### 9.10 Testing Modes Summary

| Mode | תיאור | מתי להשתמש |
|------|-------|------------|
| **Full Auto** | הרצה מלאה ללא עצירות | Production, סקריפט מוכח |
| **Stop on Error** | עצירה רק בשגיאה | Testing, סקריפט חדש |
| **Step by Step** | אישור ידני לכל chunk | Debug, סקריפט בעייתי |
| **Validate Only** | בדיקת syntax בלבד | Quick check |
| **Dry Run** | הרצה ללא שמירה | בדיקת לוגיקה |

---

### 9.11 תוכנית פיתוח בשלבים (Phased Development Plan)

#### FLOW הפיתוח - מבט על

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PHASE B - DEVELOPMENT FLOW                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [STAGE 1]        [STAGE 2]        [STAGE 3]        [STAGE 4]               │
│  Parser           Data Model       Script Gen       Output                   │
│     │                 │                │               │                     │
│     ▼                 ▼                ▼               ▼                     │
│  ┌──────┐        ┌──────┐        ┌──────┐        ┌──────┐                   │
│  │ Word │   →    │ JSON │   →    │ Qlik │   →    │Tables│                   │
│  │ /PDF │        │Config│        │Script│        │ +GUI │                   │
│  └──────┘        └──────┘        └──────┘        └──────┘                   │
│     │                │                │               │                     │
│     ▼                ▼                ▼               ▼                     │
│  ✓ TEST 1        ✓ TEST 2        ✓ TEST 3        ✓ TEST 4                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### שלב 1: Parser - פרסור מסמך אפיון

**מה נבנה:**
- קריאת מסמך Word/PDF/Excel
- חילוץ טבלאות, מימדים, מדדים
- יצירת JSON מובנה

**Output:**
```json
{
  "spec_version": "1.0",
  "tables": [...],
  "dimensions": [...],
  "measures": [...],
  "relationships": [...]
}
```

**בדיקות שלב 1:**
| # | בדיקה | קריטריון עבר |
|---|-------|-------------|
| 1.1 | קריאת קובץ | קובץ נפתח ללא שגיאות |
| 1.2 | חילוץ טבלאות | מספר טבלאות = מספר טבלאות במסמך |
| 1.3 | חילוץ מימדים | רשימת מימדים מלאה |
| 1.4 | חילוץ מדדים | רשימת מדדים + נוסחאות |
| 1.5 | JSON תקין | JSON Schema validation עובר |
| 1.6 | אין שדות חסרים | required fields != null |

**נקודת אישור HITL:**
```
📋 Parser Output Review
──────────────────────
Tables found: 5
Dimensions: 12
Measures: 8
Relationships: 4

[✓] Approve and continue to Stage 2
[ ] Request changes
[ ] Stop and review manually
```

---

#### שלב 2: Data Model - בניית מודל נתונים

**מה נבנה:**
- Mapping טבלאות ל-Fact/Dimension
- זיהוי מפתחות (PK/FK)
- הגדרת קשרים
- Star Schema design

**Output:**
```json
{
  "model": {
    "facts": [
      {"name": "FACT_Orders", "keys": ["OrderKey"], "measures": [...]}
    ],
    "dimensions": [
      {"name": "DIM_Customers", "pk": "CustomerKey", "fields": [...]}
    ],
    "relationships": [
      {"from": "FACT_Orders.CustomerKey", "to": "DIM_Customers.CustomerKey"}
    ]
  }
}
```

**בדיקות שלב 2:**
| # | בדיקה | קריטריון עבר |
|---|-------|-------------|
| 2.1 | לכל Fact יש לפחות Dimension אחד | count(relationships) >= count(facts) |
| 2.2 | אין Orphan Dimensions | כל DIM מקושר ל-FACT |
| 2.3 | Star Schema תקין | אין קשרים בין Dimensions |
| 2.4 | מפתחות מוגדרים | PK != null לכל טבלה |
| 2.5 | אין מפתחות כפולים | unique(PK) |
| 2.6 | Cardinality מוגדר | 1:N or N:M לכל קשר |

**נקודת אישור HITL:**
```
📊 Data Model Review
──────────────────────
Facts: 2 (Orders, Returns)
Dimensions: 4 (Customers, Products, Time, Geography)
Relationships: 6 (all valid)

⚠️ Warning: Snowflake detected in Geography
   Geography → Region → Country (3 levels)

[✓] Accept as-is
[ ] Flatten to Star
[ ] Review manually
```

---

#### שלב 3: Script Generator - יצירת קוד Qlik

**מה נבנה:**
- Load Script מלא
- Variables והגדרות
- טעינת טבלאות
- Calendar אוטומטי
- QVD STORE statements

**Output:**
```qlik
//==== CONFIGURATION ====
SET vPathQVD = 'lib://QVD/';
SET vReloadType = 'FULL';

//==== FACT_Orders ====
FACT_Orders:
LOAD
    AutoNumber(OrderID) AS OrderKey,
    CustomerID,
    ...
FROM [lib://DB/orders];

//==== DIM_Customers ====
DIM_Customers:
LOAD
    AutoNumber(CustomerID) AS CustomerKey,
    ...
FROM [lib://DB/customers];

//==== CALENDAR ====
...
```

**בדיקות שלב 3:**
| # | בדיקה | קריטריון עבר |
|---|-------|-------------|
| 3.1 | Syntax תקין | No syntax errors in script |
| 3.2 | כל טבלאות קיימות | count(LOAD) = count(tables in model) |
| 3.3 | כל מפתחות נוצרים | AutoNumber() לכל PK |
| 3.4 | Calendar קיים | DIM_Date table defined |
| 3.5 | STORE statements | QVD לכל טבלה |
| 3.6 | Variables מוגדרים | vPath, vReloadType exist |

**נקודת אישור HITL:**
```
📜 Script Review
──────────────────────
Total lines: 245
Tables: 6
Variables: 8
STORE statements: 6

Script preview (first 50 lines):
[Show preview...]

[✓] Approve and execute
[ ] Edit script manually
[ ] Regenerate with changes
```

---

#### שלב 4: Output - יצירת טבלאות ובדיקה ב-GUI

**מה נבנה:**
- הרצת Script ב-Qlik
- יצירת טבלאות בפועל
- Simple Table ב-GUI לצורך בדיקות
- Validation של תוצאות

**Output - MVP:**
```
┌─────────────────────────────────────────────────────────────┐
│  📊 QMB - TEST OUTPUT                                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Created Tables:                                             │
│  ┌─────────────────────┬────────┬─────────┐                 │
│  │ Table               │ Rows   │ Fields  │                 │
│  ├─────────────────────┼────────┼─────────┤                 │
│  │ FACT_Orders         │ 99,441 │ 12      │                 │
│  │ DIM_Customers       │ 5,230  │ 8       │                 │
│  │ DIM_Products        │ 1,845  │ 6       │                 │
│  │ DIM_Date            │ 3,652  │ 15      │                 │
│  └─────────────────────┴────────┴─────────┘                 │
│                                                              │
│  Simple Table (for validation):                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Customer    │ Product    │ OrderDate  │ Total          ││
│  ├─────────────┼────────────┼────────────┼────────────────┤│
│  │ לקוח 001    │ מוצר A     │ 01/01/2024 │ ₪ 1,234        ││
│  │ לקוח 002    │ מוצר B     │ 02/01/2024 │ ₪ 5,678        ││
│  │ ...         │ ...        │ ...        │ ...            ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**בדיקות שלב 4:**
| # | בדיקה | קריטריון עבר |
|---|-------|-------------|
| 4.1 | Script רץ ללא שגיאות | No execution errors |
| 4.2 | כל הטבלאות נוצרו | count(tables) = expected |
| 4.3 | Row count סביר | rows > 0 לכל טבלה |
| 4.4 | אין Synthetic Keys | $Syn tables = 0 |
| 4.5 | אין Circular References | Data model valid |
| 4.6 | Keys מחוברים | All relationships active |
| 4.7 | Simple Table מציג נתונים | Visual validation |

**נקודת אישור HITL - FINAL:**
```
✅ PHASE B COMPLETE
──────────────────────
All 4 stages passed!

Summary:
- Parser: ✅ (JSON created)
- Model: ✅ (Star Schema valid)
- Script: ✅ (245 lines, no errors)
- Output: ✅ (4 tables, 110K rows)

QVD Files created:
- FACT_Orders.qvd (12MB)
- DIM_Customers.qvd (2MB)
- DIM_Products.qvd (1MB)
- DIM_Date.qvd (500KB)

[✓] Accept and close
[ ] Continue to Master Items (future)
[ ] Export report
```

---

#### 9.12 סיכום שלבי הבדיקה

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     DEVELOPMENT STAGES - TESTING CHECKLIST                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  STAGE 1: PARSER                    STAGE 2: DATA MODEL                     │
│  ─────────────────────              ─────────────────────                   │
│  □ 1.1 File read OK                 □ 2.1 Fact-Dim links                    │
│  □ 1.2 Tables extracted             □ 2.2 No orphan dims                    │
│  □ 1.3 Dimensions found             □ 2.3 Star schema valid                 │
│  □ 1.4 Measures found               □ 2.4 PKs defined                       │
│  □ 1.5 JSON valid                   □ 2.5 No duplicate keys                 │
│  □ 1.6 Required fields              □ 2.6 Cardinality set                   │
│       ↓ HITL CHECKPOINT                  ↓ HITL CHECKPOINT                  │
│                                                                              │
│  STAGE 3: SCRIPT GEN                STAGE 4: OUTPUT                         │
│  ─────────────────────              ─────────────────────                   │
│  □ 3.1 Syntax valid                 □ 4.1 No exec errors                    │
│  □ 3.2 All tables exist             □ 4.2 All tables created                │
│  □ 3.3 Keys created                 □ 4.3 Row count > 0                     │
│  □ 3.4 Calendar exists              □ 4.4 No synthetic keys                 │
│  □ 3.5 STORE statements             □ 4.5 No circular refs                  │
│  □ 3.6 Variables defined            □ 4.6 Keys connected                    │
│       ↓ HITL CHECKPOINT             □ 4.7 Simple Table OK                   │
│                                          ↓ FINAL APPROVAL                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**כלל זהב:** אין מעבר לשלב הבא ללא אישור כל הבדיקות של השלב הנוכחי!

---

## סיכום

מסמך זה מגדיר את Phase B של QlikModelBuilder - מאפיון ל-QVF מוכן.

**שלבי העיבוד:**
1. Parser - פרסור מסמך אפיון
2. Enricher - מיזוג עם מידע משלב A
3. Mapper - מיפוי מימדים ומדדים
4. Script Generator - יצירת Load Script
5. Model Builder - בניית מודל נתונים
6. UI Builder - יצירת GUI
7. Assembler - הרכבה ל-QVF
8. Validator - בדיקות איכות

**יעד:** מ-33 ימים ל-~8 ימים (75% חיסכון)

---

**גרסה:** 0.1 (Draft)
**תאריך:** 2026-01-19

---

## נספחים

### נספח א': קונבנציות שמות (Naming Conventions)

לפי מתודולוגיית Qlik Israel 2020:

#### שמות טבלאות
| סוג | תבנית | דוגמה |
|-----|-------|-------|
| Fact | `FACT_<Name>` | FACT_Orders, FACT_Sales |
| Dimension | `DIM_<Name>` | DIM_Customers, DIM_Products |
| Link | `LINK_<Name>` | LINK_OrderProduct |
| Bridge | `BRIDGE_<Name>` | BRIDGE_CustomerAddress |
| Calendar | `DIM_Date` | DIM_Date |

#### שמות שדות
| סוג | סיומת | דוגמה |
|-----|-------|-------|
| Primary Key | `_KEY` | CustomerKey, OrderKey |
| Foreign Key | `_KEY` | CustomerKey (ב-Fact) |
| Flag | `_FLAG` | IsActive_FLAG, IsDelayed_FLAG |
| Indicator | `_IND` | Status_IND |
| Amount | `_AMT` | Revenue_AMT, Cost_AMT |
| Count | `_CNT` | Items_CNT |
| Date | `_DT` | Order_DT, Created_DT |
| Code | `_CD` | Category_CD |

#### סגנון כתיבה
- **טבלאות:** UPPER_CASE עם underscore
- **שדות:** CamelCase או snake_case (לפי מקור)
- **Variables:** vCamelCase עם v prefix
- **Master Items:** שם עברי/אנגלי תיאורי

#### דוגמאות
```qlik
// Tables
FACT_Orders
DIM_Customers
LINK_OrderItems

// Fields
CustomerKey
OrderDate
IsDelivered_FLAG
TotalRevenue_AMT

// Variables
LET vCurrentYear = Year(Today());
LET vLastReload = Now();

// Master Items
[סה"כ הכנסות]  // Hebrew
[Total Revenue]  // English
```

### נספח ב': מפתחות מורכבים (Composite Keys)

#### פורמט באפיון
מפתחות מורכבים מופיעים בפורמט: `Field1||Field2||Field3`

**דוגמה:**
```
order_id||product_id  // מפתח מורכב של 2 שדות
order_id||product_id||seller_id  // מפתח מורכב של 3 שדות
```

#### מבנה JSON
```json
{
  "composite_key": {
    "raw": "order_id||product_id",
    "fields": ["order_id", "product_id"],
    "generated_key": "%OrderProductKey"
  }
}
```

#### יצירת מפתח ב-Script
```qlik
// Option 1: String concatenation
LOAD
    order_id & '|' & product_id AS %OrderProductKey,
    *
FROM source;

// Option 2: AutoNumberHash (recommended for performance)
LOAD
    AutoNumberHash128(order_id, product_id) AS %OrderProductKey,
    *
FROM source;
```

#### ברירת מחדל
- **שמירת שדות מקור:** כן (order_id, product_id נשמרים)
- **שם מפתח נוצר:** `%<Table>Key` או `%<Field1><Field2>Key`
- **המרה ל-AutoNumber:** אופציונלי לפי בחירת משתמש

### נספח ג': Qlik APIs

| API | שימוש | יתרונות | חסרונות |
|-----|-------|---------|---------|
| **Engine API** | WebSocket, real-time | גמיש, חזק | מורכב |
| **QRS API** | REST, management | פשוט, סטנדרטי | פחות שליטה |
| **Qlik CLI** | Command line | קל לאוטומציה | תלוי בהתקנה |

**המלצה:** Engine API לבנייה, QRS API לניהול

### נספח ד': רשימת בדיקות (Checklist)

#### לפני התחלה
- [ ] מסמך אפיון קיים ומלא
- [ ] QVD files זמינים (משלב A)
- [ ] metadata.json קיים
- [ ] גישה ל-Qlik (Cloud/Server)

#### אחרי יצירה
- [ ] Script רץ ללא שגיאות
- [ ] אין Synthetic Keys
- [ ] כל Master Items תקינים
- [ ] כל Visualizations מציגים נתונים
- [ ] Performance סביר (< 60 sec reload)

### נספח ה': גלוסרי מונחים

| מונח | הסבר |
|------|------|
| **QVD** | Qlik data file, פורמט דחוס לנתונים |
| **QVF** | Qlik application file |
| **Master Item** | מימד או מדד מוגדר מראש לשימוש חוזר |
| **Star Schema** | מודל נתונים עם Fact מרכזי ו-Dimensions |
| **Synthetic Key** | מפתח שנוצר אוטומטית כשיש שדות משותפים מרובים |
| **Set Analysis** | סינטקס Qlik לסינון בתוך aggregations |
| **Associative Model** | מודל הנתונים הייחודי של Qlik |
| **Incremental Load** | טעינת רק נתונים חדשים/משתנים |

---

### נספח ו': Anti-Patterns - טעויות קריטיות

#### א. Synthetic Keys 🔥 הבעיה הכי נפוצה!

**מה קורה:**
- Qlik יוצר טבלה נסתרת אוטומטית כאשר יותר משדה מקשר אחד משותף
- טבלה זו מנהלת את כל השילובים
- **תוצאה:** ניפוח RAM + חישובים איטיים

**דוגמה לבעיה:**
```qlik
// ❌ BAD - Creates Synthetic Key
Orders:
LOAD OrderID, CustomerID, ProductID FROM orders.csv;

Products:
LOAD ProductID, CustomerID, ProductName FROM products.csv;

// Qlik creates hidden $Syn1 table with CustomerID+ProductID combinations!
```

**פתרון 1: Aliasing (שינוי שמות)**
```qlik
Orders:
LOAD
    OrderID,
    CustomerID AS %CustomerKey,     // Renamed
    ProductID AS %ProductKey        // Renamed
FROM orders.csv;

Products:
LOAD
    ProductID AS %ProductKey,       // Match
    CustomerID_Supplier,            // Different name!
    ProductName
FROM products.csv;
```

**פתרון 2: Composite Key (מפתח מורכב)**
```qlik
Orders:
LOAD
    OrderID,
    AutoNumberHash128(CustomerID, ProductID) AS %OrderKey,
    CustomerID,
    ProductID
FROM orders.csv;

Products:
LOAD
    AutoNumberHash128(CustomerID, ProductID) AS %OrderKey,
    ProductName
FROM products.csv;

// Drop original keys if not needed
DROP FIELDS CustomerID, ProductID FROM Orders;
```

**פתרון 3: הסרת שדות מיותרים**
```qlik
Orders:
LOAD OrderID, CustomerID, ProductID FROM orders.csv;

Products:
LOAD
    ProductID,      // Keep only needed key
    ProductName
FROM products.csv;
// Don't load CustomerID from Products if not needed!
```

#### ב. Circular References (קשרים מעגליים) ♻️

**מה קורה:**
- יותר מנתיב אסוציאטיבי אחד בין שתי טבלאות
- המנוע "מנתק" קשר אחד באופן שרירותי
- **תוצאה:** תוצאות לא עקביות, עמימות לוגית

**דוגמה לבעיה:**
```qlik
// ❌ Creates Circular Reference
Customers:
LOAD CustomerID, Country FROM customers.csv;

Orders:
LOAD OrderID, CustomerID, Country FROM orders.csv;

Products:
LOAD ProductID, Country FROM products.csv;

// Paths: Customer->Country->Product->Customer (LOOP!)
```

**פתרון: Qualify/Rename**
```qlik
Customers:
LOAD
    CustomerID,
    Country AS CustomerCountry  // Specific name
FROM customers.csv;

Orders:
LOAD
    OrderID,
    CustomerID,
    Country AS OrderCountry     // Different name
FROM orders.csv;

Products:
LOAD
    ProductID,
    Country AS ProductCountry   // Different name
FROM products.csv;
```

**אלטרנטיבה: QUALIFY Prefix**
```qlik
QUALIFY Country;  // Auto-prefix with table name

Customers:
LOAD CustomerID, Country FROM customers.csv;
// Country becomes Customers.Country

Orders:
LOAD OrderID, CustomerID, Country FROM orders.csv;
// Country becomes Orders.Country

UNQUALIFY *;
```

#### ג. "God Table" (טבלת אלוהים) 📊❌

**מה קורה:**
- טבלה אחת שטוחה ורחבה עם עשרות עמודות
- ללא נורמליזציה
- **תוצאה:** בזבוז RAM על NULLs רבים, קושי בתחזוקה

**דוגמה לבעיה:**
```qlik
// ❌ BAD - God Table (100 columns!)
Everything:
LOAD
    OrderID,
    CustomerName, CustomerCity, CustomerCountry, CustomerSegment,
    ProductName, ProductCategory, ProductSubCategory, ProductBrand,
    SupplierName, SupplierCity, SupplierCountry,
    // ... 80 more fields ...
FROM mega_table.csv;
```

**פתרון: Star Schema**
```qlik
// ✅ GOOD - Separated Fact + Dimensions
FACT_Orders:
LOAD
    OrderID_KEY,
    CustomerID_KEY,
    ProductID_KEY,
    OrderDate,
    Quantity,
    Total
FROM orders.csv;

DIM_Customers:
LOAD
    CustomerID_KEY,
    CustomerName,
    City,
    Country
FROM customers.csv;

DIM_Products:
LOAD
    ProductID_KEY,
    ProductName,
    Category,
    Brand
FROM products.csv;
```

#### ד. Link Table Explosion 💥

**מה קורה:**
- יצירת Link Table עם קרדינליות גבוהה מאוד
- טבלת הקישור גדלה יותר מהעובדות עצמן!
- **תוצאה:** צריכת RAM אדירה, איטיות קיצונית

**דוגמה לבעיה:**
```qlik
// ❌ BAD - High cardinality Link Table
Facts1: LOAD CustomerID, ProductID, Date, Sales FROM sales.csv;
Facts2: LOAD CustomerID, ProductID, Date, Budget FROM budget.csv;

// If CustomerID: 10K, ProductID: 5K, Date: 365
// Possible combinations: 10K × 5K × 365 = 18.25 BILLION! 💣

LinkTable:
LOAD DISTINCT
    CustomerID & '|' & ProductID & '|' & Date AS %LinkKey,
    CustomerID,
    ProductID,
    Date
RESIDENT Facts1;
// This table will EXPLODE in size!
```

**פתרון: Concatenation במקום**
```qlik
// ✅ GOOD - Concatenate instead
Facts:
LOAD *, 'Sales' AS FactType FROM sales.csv;
CONCATENATE (Facts)
LOAD *, 'Budget' AS FactType FROM budget.csv;

// Use Set Analysis in charts:
// Sum({<FactType={'Sales'}>} Amount)
```

**חישוב קרדינליות לפני יצירה (חובה!):**
```qlik
// Always check BEFORE creating Link Table!
TempCheck:
LOAD
    CustomerID,
    ProductID,
    Date
FROM Facts;

CardinalityCheck:
LOAD
    Count(DISTINCT CustomerID & '|' & ProductID & '|' & Date) AS Combos
RESIDENT TempCheck;

LET vCombos = Peek('Combos', 0, 'CardinalityCheck');

IF $(vCombos) > 10000 THEN
    TRACE ========================================;
    TRACE ERROR: Cardinality too high ($(vCombos))!;
    TRACE Use Concatenation instead of Link Table;
    TRACE ========================================;
    EXIT Script;
END IF

DROP TABLES TempCheck, CardinalityCheck;
```

#### ה. Maintenance Debt (חוב תחזוקתי) 🔧

**מה קורה:**
- שימוש ב-`LOAD *` במקום selective loading
- חישובים מורכבים (`Aggr`) ב-UI במקום בסקריפט
- ללא QVDs
- **תוצאה:** אפליקציה כבדה ולא יציבה

**פתרון:**
```qlik
// ✅ GOOD - Selective + QVD + Pre-calc

//=== DB Load App ===
Orders_Raw:
LOAD
    OrderID,
    CustomerID,
    ProductID,
    OrderDate,
    Amount
FROM [lib://DB/orders];

STORE Orders_Raw INTO [lib://QVD/Orders_Raw.qvd] (qvd);

//=== ERD App ===
Orders_Processed:
LOAD
    AutoNumber(OrderID) AS OrderID_KEY,
    AutoNumber(CustomerID) AS CustomerID_KEY,
    Month(OrderDate) AS OrderMonth,
    Amount
FROM [lib://QVD/Orders_Raw.qvd] (qvd);

// Pre-calculate aggregations
MonthlyTotals:
LOAD
    CustomerID_KEY,
    OrderMonth,
    Sum(Amount) AS MONTHLY_TOTAL
RESIDENT Orders_Processed
GROUP BY CustomerID_KEY, OrderMonth;

STORE MonthlyTotals INTO [lib://QVD/MonthlyTotals.qvd] (qvd);

//=== GUI App ===
// Just use pre-calculated data!
LOAD * FROM [lib://QVD/MonthlyTotals.qvd] (qvd);
```

#### Anti-Patterns Checklist

```
❌ Synthetic Keys detected?
   → Rename fields, use Composite Keys, or remove duplicates

❌ Circular References found?
   → Qualify fields, rename for clarity

❌ God Table (>50 fields)?
   → Split into Star Schema

❌ Link Table cardinality > 10,000?
   → Use Concatenation instead

❌ Using LOAD *?
   → Switch to selective loading

❌ Heavy Aggr() in UI?
   → Pre-calculate in script

❌ No QVDs?
   → Implement 3-layer architecture (DB → ERD → GUI)

❌ Snowflake depth > 4 levels?
   → Flatten to Star Schema

❌ Missing AutoNumber on composite keys?
   → Add for 60% RAM savings
```

---

### נספח ז': ארכיטקטורת 4 אפליקציות (4-App Architecture)

לפי מתודולוגיית Qlik Israel 2020, כל מודל מחולק ל-4 אפליקציות נפרדות:

```
┌─────────────────────────────────────────────────────────────┐
│  DB Load App (1-n)                                          │
│  • העלאת נתונים ממקורות (Initial QVD)                      │
│  • ללא סינונים או עיבודים                                  │
│  • Incremental Load במקור                                  │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│  ERD App (1-n)                                              │
│  • עיבוד המידע (Process QVD)                               │
│  • יצירת קשרים, טרנספורמציות                               │
│  • Calendar generation                                      │
│  • Output: Final QVD                                        │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│  Permissions App (Optional)                                 │
│  • Section Access logic                                     │
│  • Reduction fields                                         │
│  • Output: Final QVD with permissions                       │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│  GUI App                                                    │
│  • טעינה מ-Final QVD                                        │
│  • ממשק משתמש, ויזואליזציות                                │
│  • Master Items (Dimensions + Measures)                     │
│  • Sheets, Charts, Filters                                 │
└─────────────────────────────────────────────────────────────┘
```

**הפצה:**
- DB, ERD, Permissions → QlikSense Processes Stream
- GUI → Stream רלוונטי למשתמשים

---

### נספח ח': עץ ספריות מומלץ (Directory Structure)

```
lib://DataFiles/
├── DB/                    # Raw data - ללא סינונים
│   ├── orders.qvd
│   ├── customers.qvd
│   └── products.qvd
│
├── ERD/                   # Process data - לאחר עיבוד
│   ├── fact_orders.qvd
│   ├── dim_customers.qvd
│   └── calendar.qvd
│
└── Final/                 # Final data - מוכן ל-GUI
    ├── FACT_Orders.qvd
    ├── DIM_Customers.qvd
    └── DIM_Calendar.qvd
```

---

### נספח ט': כללי פיתוח חובה (Development Rules)

#### כלליים
| כלל | תיאור |
|-----|-------|
| ❌ אין פיתוח ללא אפיון | מסודר, מלא ומפורט |
| ✅ פיתוח רק בסביבת DEV | לא ישירות ב-Production |
| ✅ גרסאות מסמכים | תחזוקת היסטוריה |
| ✅ בדיקות לפני Production | חובה |
| ✅ בדיקות מסירה | בסיום פיתוח |

#### טעינת נתונים
| כלל | תיאור |
|-----|-------|
| ✅ Delta Load בלבד | לא Full (חוץ מטבלאות קטנות) |
| ✅ חיבורים במשתנים | לא Hard-Coded |
| ✅ קונפיגורציה חיצונית | בקובץ נפרד |
| ✅ תיעוד קוד | הערות לקטעים חשובים |
| ✅ Sections ממוספרים | הפרשים של 10 |
| ✅ שינויים מתועדים | תאריך + שם מתקן |

#### Best Practices
| לעשות | לא לעשות |
|-------|----------|
| QVD Final | `LOAD BINARY` |
| QVD Load | `LOAD RESIDENT` (כשאפשר) |
| Calendar אוטומטי | שדות timestamp מכל הטבלאות |
| שם בעברית ל-Dimension | שם טכני בלבד |
| Master Item לכל dim/measure | שדות בודדים |

---

### נספח י': בדיקות QA חובה

#### בדיקות נתונים
- [ ] כמות רשומות מול מקור
- [ ] אמינות נתונים - חיתוכים שונים
- [ ] אימות עם גורמים עסקיים
- [ ] מימדים עם NULL
- [ ] מדדים שמחזירים 0
- [ ] אחוז ערכים מלאים בטבלת מפתחות

#### בדיקות ביצועים
- [ ] מהירות תגובה - חיתוכים שונים
- [ ] אלמנטים גרפיים - אמינות לאחר aggregations
- [ ] בדיקות רגרסיה - השוואה למודל קודם

#### GUI Best Practices
| קטגוריה | כלל |
|---------|-----|
| אפיון GUI | רק לאחר סיום ERD |
| שפה | עברית RTL |
| פורמט | עברי למשתני מערכת |
| Dimension לסינון | שדה בעברית |
| תיעוד | היסטוריה, מטבעות, סכמת צבעים |
| Mockup | תצורת מסך - מיקום + צבעים |
| תמונות | רשימה ל-Sheets |

---

### נספח יא': גורמים קריטיים להצלחה (CSF)

1. **מחויבות הנהלה** לפרויקט
2. **יעדים מוסכמים וברורים**
3. **מעורבות גבוהה של הלקוח** בפרויקט
4. **מנהל פרויקט מנוסה**
5. **מיישמים מקצועיים**
6. **נהלי עבודה ברורים**
7. **עמידה בלוחות זמנים** שנקבעו

---

### נספח יב': אינטגרציה עם QMB הקיים

#### מה QMB כבר יודע לעשות (Phase A)
- ✅ חיבור ל-Qlik Cloud/On-Premise
- ✅ יצירת Spaces
- ✅ הגדרת Data Connections
- ✅ בחירת טבלאות ממקור נתונים
- ✅ Mapping שדות
- ✅ הגדרת Incremental Load
- ✅ יצירת Qlik Script
- ✅ Deploy של App

#### מה חסר ב-QMB (Phase B)
- ❌ **Parser של Word/Excel ל-JSON** ← המשימה העיקרית!
- ❌ Dimension Mapper (Hebrew → Field)
- ❌ Measure Validator (Qlik expressions)
- ❌ Calendar Auto-Generator
- ❌ Master Items Creator
- ❌ Sheets & Visualizations Builder
- ❌ GUI Layout Generator

#### QMB Wizard - 7 שלבים

| # | שם | תפקיד | Output |
|---|----|----|--------|
| 1 | `space_setup` | בחירת Space | space config |
| 2 | `data_source` | הגדרת חיבור | connection config |
| 3 | `table_selection` | בחירת טבלאות | tables[] |
| 4 | `field_mapping` | שדות + טיפוסים | fields[] |
| 5 | `incremental_config` | Delta logic | incremental config |
| 6 | `review` | סקירה | generatedScript |
| 7 | `deploy` | העלאה ל-Qlik | appId |

#### Entry Modes

1. **`scratch`** - בניה מאפס, צעד אחר צעד
2. **`spec`** - Parser של Word/Excel → JSON ← **זה מה שאנחנו צריכים!**
3. **`template`** - תבנית מוכנה

#### Incremental Strategies

| Strategy | שימוש | Script Pattern |
|----------|-------|---------------|
| `none` | טבלאות קטנות | Full reload |
| `by_date` | Fact עם ModifiedDate | WHERE date > vMaxDate |
| `by_id` | Auto-increment ID | WHERE id > vMaxId |
| `time_window` | N ימים אחרונים | WHERE date > AddDays(-90) |
| `custom` | לוגיקה מיוחדת | Custom WHERE clause |

---

### נספח יג': המלצות זהב - סיכום ביצועים

1. **AutoNumber על כל מפתח מורכב** - חוסך עד 60% RAM
2. **Exists() לטעינות אינקרמנטליות** - אופטימיזציה של QVD
3. **אסור Synthetic Keys** - מעיד על תכנון לקוי
4. **Star Schema כברירת מחדל** - אלא אם יש סיבה מוכחת אחרת
5. **QVD תמיד** - עבור incremental loads וביצועים
6. **Monitor cardinality** - לפני Link Tables
7. **Flatten hierarchies** - במקום Snowflake עמוק
8. **Selective loading** - רק שדות נדרשים
9. **Test with 10% data** - לפני production
10. **Data Model Viewer** - validation חובה

#### RAM Savings with AutoNumber - דוגמה

```qlik
// Original string key: ~20 bytes average
// AutoNumber integer: ~4 bytes
// Savings per row: 16 bytes
// For 10M rows: 160MB saved!

Before_RAM:
LOAD
    CustomerID,  // String: 'CUST-2024-00001' (20 bytes)
    OrderID      // String: 'ORD-2024-12345' (18 bytes)
FROM Source;
// Estimated: 380MB for 10M rows

After_RAM:
LOAD
    AutoNumber(CustomerID) AS CustomerID_KEY,  // Integer (4 bytes)
    AutoNumber(OrderID) AS OrderID_KEY         // Integer (4 bytes)
FROM Source;
// Estimated: 80MB for 10M rows
// Savings: 300MB (79%!) ⭐
```

---

**סוף מסמך PHASE_B_SPEC.md**

**גרסה:** 0.2 (Draft + Appendices)
**תאריך עדכון:** 2026-01-19
**שורות:** ~2800
