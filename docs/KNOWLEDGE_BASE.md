# מסמך ידע מלא - מערכת בניית מודלי Qlik אוטומטית

**תאריך:** 19/01/2026  
**סוג מסמך:** איפיון מערכת (System Specification) - לא איפיון פרויקט ספציפי  
**מטרה:** תיעוד המתודולוגיה, דרישות המערכת, והידע שנצבר על תהליך הבניה האוטומטי

---

## 1. מטרת המערכת

### 1.1 Vision
בניית מערכת MCP (Model Context Protocol) שמאפשרת בניית מודלי Qlik Sense **ברבע מהזמן** - מאפיון ועד QVF מוכן.

### 1.2 שלבי הפיתוח
- ✅ **שלב A הושלם:** DB Space + חיבור + משיכת נתונים + יצירת QVD files
- 🚧 **שלב B (הנוכחי):** מאפיון ל-QVF מלא עם UI

### 1.3 ערך מוסף
- הפחתת זמן פיתוח מ-33 ימים ל-~8 ימים
- סטנדרטיזציה של תהליך הפיתוח
- הפחתת שגיאות אנוש
- אוטומציה של משימות חוזרות

---

## 2. ארכיטקטורה כללית

### 2.1 רכיבי המערכת

```
┌─────────────────────────────────────────────────────────────┐
│                    INPUT LAYER                               │
├─────────────────────────────────────────────────────────────┤
│  • מסמך אפיון.docx (ממולא לפי תבנית)                        │
│  • QVD Files (משלב A)                                        │
│  • metadata.json (משלב A)                                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  PROCESSING LAYER                            │
├─────────────────────────────────────────────────────────────┤
│  Phase 1: Parser (Word → JSON)                               │
│  Phase 2: Enricher (Merge + Validate)                        │
│  Phase 3: Mapper (Dimensions → Fields)                       │
│  Phase 4: Script Generator (Qlik Load Script)                │
│  Phase 5: Model Builder (Data Model + Master Items)          │
│  Phase 6: UI Builder (Sheets + Visualizations)               │
│  Phase 7: Assembler (JSON → QVF)                             │
│  Phase 8: Validator (Quality Checks)                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    OUTPUT LAYER                              │
├─────────────────────────────────────────────────────────────┤
│  • final_app.qvf (ready to import)                           │
│  • validation_report.json                                    │
│  • documentation.md                                           │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 טכנולוגיות
- **MCP:** Model Context Protocol
- **Claude AI:** לניתוח, מיפוי, וולידציה
- **Python:** לפרסור ועיבוד
- **Qlik Engine API / QRS API:** ליצירת QVF
- **n8n:** אורקסטרציה (אופציונלי)

---

## 3. מבנה התבנית (Template) - הידע המרכזי

### 3.1 תפקיד התבנית

**חשוב:** התבנית היא **כלי עבודה** לאיסוף דרישות לפרויקטים ספציפיים.

```
תבנית אפיון ריקה (מסמך_אפיון_מפורט.docx)
        ↓ ממולאת על ידי יועץ + לקוח
פרויקט ספציפי (Olist_Specification.docx)
        ↓ מוזן למערכת
מודל Qlik אוטומטי
```

התבנית מגדירה **את המבנה הסטנדרטי** שכל פרויקט צריך למלא.

### 3.2 רשימת סעיפים בתבנית

```
1. פרטים כלליים על המסמך
2. פרטים כלליים על הלקוח
3. מצב קיים
4. הבעיה העסקית
5. מטרת המערכת
6. לקוח המטרה
7. תכולת אפיון הפרויקט
   ├── 7.1 דרישות עסקיות
   ├── 7.2 מקורות המידע ★
   ├── 7.3 שדות מרכזיים ★
   ├── 7.4 קשרים בין טבלאות ★
   ├── 7.5 סכמת ERD ★
   ├── 7.6 מימדים ★
   ├── 7.7 מדדים ★
   └── 7.8 תצוגה ★
8. טעינת נתונים
9. הרשאות
10. הערכת זמנים
```

★ = קריטי לבניית המודל

---

## 4. מבנה מסמך אפיון ממולא - דוגמה Olist

### 4.1 מקורות המידע (טבלה)

**עמודות:**
- שם טבלה (technical name)
- מקור (CSV/Database/Excel)
- תיאור (fact/dimension)
- מספר רשומות (~100,000)
- טבלה ב-ERD (FACT_Orders, DIM_Customers)
- הערות

**דוגמה:**
```
שם טבלה                      | מקור         | תיאור              | מספר רשומות | טבלה ב-ERD     | הערות
olist_orders_dataset         | CSV/Database | טבלת עובדות-הזמנות | ~100,000    | FACT_Orders    | טבלה מרכזית
olist_customers_dataset      | CSV/Database | מימד לקוחות        | ~99,000     | DIM_Customers  | כולל מיקום
olist_products_dataset       | CSV/Database | מימד מוצרים        | ~32,000     | DIM_Products   | כולל קטגוריות
```

**תובנות:**
- שמות טבלאות טכניים (לא בעברית)
- יש distinction ברור: Fact vs Dimension
- יש שם לוגי (ERD name) לכל טבלה

---

### 4.2 שדות מרכזיים (טבלה)

**עמודות:**
- שם שדה
- טבלה
- הערות

**דוגמה:**
```
שם שדה                      | טבלה              | הערות
order_id                     | olist_orders      | מפתח ראשי - מזהה ייחודי להזמנה
customer_id                  | olist_customers   | מפתח ראשי - מזהה לקוח
customer_unique_id           | olist_customers   | מזהה לקוח ייחודי - לזיהוי לקוחות חוזרים
product_id                   | olist_products    | מפתח ראשי - מזהה מוצר
order_purchase_timestamp     | olist_orders      | תאריך ושעת רכישה
price                        | olist_order_items | מחיר פריט
payment_value               | olist_order_payments | סכום תשלום
review_score                | olist_order_reviews | דירוג (1-5)
```

**תובנות:**
- שמות שדות טכניים (snake_case)
- יש תיאור תפקיד לכל שדה
- מזוהים מפתחות ראשיים
- יש שדות מיוחדים (customer_unique_id לחוזרים)

---

### 4.3 קשרים בין טבלאות (טבלה)

**עמודות:**
- טבלה 1
- שדה מקשר
- טבלה 2
- שדה מקשר
- סוג קשר (1:M, M:1, 1:1, M:N)

**דוגמה:**
```
טבלה 1              | שדה מקשר | טבלה 2                | שדה מקשר | סוג קשר
olist_orders        | order_id | olist_order_items     | order_id | 1:M
olist_orders        | customer_id | olist_customers    | customer_id | M:1
olist_order_items   | product_id | olist_products      | product_id | M:1
olist_order_items   | seller_id | olist_sellers        | seller_id | M:1
olist_orders        | order_id | olist_order_payments  | order_id | 1:M
olist_orders        | order_id | olist_order_reviews   | order_id | 1:1
olist_products      | product_category_name | product_category_translation | product_category_name | M:1
```

**תובנות:**
- 7 קשרים מוגדרים בבירור
- יש קשרים מסוג 1:M, M:1, 1:1
- אין קשרים M:N (צריך Link Table)
- הקשרים מגדירים Star Schema ברור

---

### 4.4 ERD Description

**טקסט תיאורי:**
```
מבנה Star Schema:

טבלאות עובדות (Fact Tables):
- FACT_Orders - הזמנות (מרכז הכוכב)
- FACT_Order_Items - פריטים בהזמנה (רמת פירוט)
- FACT_Payments - תשלומים
- FACT_Reviews - ביקורות

טבלאות מימד (Dimension Tables):
- DIM_Customers - לקוחות (כולל מיקום גיאוגרפי)
- DIM_Products - מוצרים
- DIM_Categories - קטגוריות מוצרים
- DIM_Sellers - מוכרים (כולל מיקום גיאוגרפי)
- DIM_Date - מימד זמן (יווצר מ-timestamps)
- DIM_Geolocation - מיקום גיאוגרפי מפורט

הערה: יש ליצור מימד תאריכים (Date Dimension) מתאריכי הרכישה והמשלוח.
```

**תובנות:**
- יש הבחנה ברורה: Fact vs Dimension
- מוזכר שצריך ליצור Calendar
- ישנם טיפוסי Fact שונים (transactional, snapshot)

---

### 4.5 מימדים (טבלה) - 🔴 נקודה קריטית

**עמודות:**
- שם המימד (עברית)
- הערות (תיאור)

**דוגמה:**
```
שם המימד          | הערות
תאריך רכישה       | מימד זמן: יום, שבוע, חודש, רבעון, שנה
תאריך אספקה       | מימד זמן: ניתוח זמני אספקה
לקוח               | מזהה לקוח, לקוח ייחודי (לחוזרים)
מיקום לקוח         | עיר, מדינה, מיקוד - היררכיה גיאוגרפית
מוצר                | מזהה מוצר, שם מוצר
קטגוריית מוצר      | קטגוריות ברמות שונות
מוכר                | מזהה מוכר
מיקום מוכר          | עיר, מדינה של מוכר
אמצעי תשלום        | כרטיס אשראי, בוליטו, שובר, דביט
סטטוס הזמנה        | נמסר, בוטל, בעיבוד, וכו'
```

**🔴 הבעיה:**
- שמות המימדים בעברית
- אין מיפוי ישיר לשדות טכניים
- צריך להסיק: "לקוח" = customer_id או customer_unique_id?
- צריך להסיק: "מיקום לקוח" = customer_city + customer_state

**פתרון נדרש:**
- Intelligent Mapping (LLM-based)
- או: קובץ mapping נפרד
- או: convention-based (חיפוש "*customer*")

---

### 4.6 מדדים (טבלה) - ✅ הכי חשוב!

**עמודות:**
- שם מדד (עברית)
- תיאור מדד
- אופן חישוב (נוסחה) ← **Qlik Expression מוכן!**

**דוגמאות:**

#### מדדים פשוטים:
```
שם מדד              | תיאור                    | נוסחה
סה"כ הכנסות         | סכום כולל של כל המכירות  | Sum(payment_value)
מספר הזמנות         | כמות הזמנות כוללת        | Count(DISTINCT order_id)
מספר פריטים         | כמות פריטים שנמכרו       | Sum(quantity)
מחיר ממוצע לפריט    | מחיר ממוצע לפריט         | Avg(price)
```

#### מדדים מורכבים:
```
שם מדד                    | נוסחה
AOV - ממוצע להזמנה        | Sum(payment_value) / Count(DISTINCT order_id)
% עלות משלוח              | (Sum(freight_value) / Sum(price)) * 100
דירוג ממוצע               | Avg(review_score)
% ביקורות חיוביות         | Count(review_score >= 4) / Count(review_score) * 100
ימי אספקה ממוצעים         | Avg(order_delivered_date - order_purchase_date)
% עיכוב באספקה            | Count(delivered > estimated) / Count(orders) * 100
לקוחות חוזרים             | Count(customer_unique_id WHERE orders > 1)
% לקוחות חוזרים           | (לקוחות חוזרים / לקוחות ייחודיים) * 100
% ביטולים                 | Count(status = "canceled") / Count(orders) * 100
```

**תובנות קריטיות:**
- ✅ הנוסחאות כבר בפורמט Qlik מוכן
- ✅ יש שימוש ב-aggregations: Sum, Count, Avg
- ✅ יש שימוש ב-DISTINCT
- ✅ יש חישובים מורכבים (ratio, percentage)
- ✅ יש conditional counts: Count(field > value)
- ✅ יש date arithmetic: date1 - date2
- ⚠️ יש pseudo-code: "WHERE orders > 1" (צריך תרגום ל-Set Analysis)

**Validation נדרשת:**
- בדיקת קיום שדות
- בדיקת טיפוסים (Sum רק על numeric)
- תרגום pseudo-code ל-Qlik syntax
- אופטימיזציה (Aggr, Set Analysis)

---

### 4.7 תצוגה (טבלה) - ✅ מפורט מאוד

**עמודות:**
- לשונית (Sheet name)
- מימד
- מדד
- ייצוג גרפי (chart type)

**דוגמה:**
```
לשונית                  | מימד                    | מדד                          | ייצוג גרפי
Executive Dashboard     | תאריך, קטגוריה         | הכנסות, הזמנות, AOV, דירוג  | KPI Cards, Line Chart (טרנד), Bar Chart (קטגוריות)
Sales Analysis          | תאריך, קטגוריה, מוצר   | הכנסות, פריטים, AOV         | Combo Chart (זמן), TreeMap (קטגוריות), Table (מוצרים)
Customer Analytics      | מיקום לקוח, תאריך      | לקוחות ייחודיים, חוזרים    | Map (גיאוגרפי), Bar Chart (ערים), Funnel (retention)
Product Performance     | קטגוריה, מוצר          | מכירות, כמות, דירוג ממוצע   | Bar Chart (top products), Scatter Plot (price vs rating)
Delivery & Satisfaction | תאריך, מיקום           | ימי אספקה, עיכובים, דירוג   | Line Chart (זמנים), Heat Map (עיכובים), Gauge (satisfaction)
Seller Performance      | מוכר, מיקום מוכר       | הכנסות, הזמנות, דירוג       | Bar Chart (top sellers), Map (מיקומים), Table (פירוט)
Payment Analysis        | אמצעי תשלום, תאריך     | הכנסות, מספר תשלומים        | Pie Chart (התפלגות), Bar Chart (trends)
```

**תובנות:**
- 7 לשוניות מוגדרות
- לכל לשונית יש מימדים + מדדים + סוגי תרשימים
- סוגי תרשימים מגוונים: KPI, Line, Bar, Combo, TreeMap, Map, Table, Funnel, Scatter, Heat Map, Gauge, Pie
- יש הערות בסוגריים (טרנד, גיאוגרפי, וכו')
- ⚠️ אין layout מדויק (position, size)

**מה חסר:**
- מיקום התרשים בלשונית (col, row)
- גודל התרשים (colspan, rowspan)
- הגדרות נוספות (colors, sorting, etc.)

**פתרון:**
- Auto-layout algorithm
- או: שימוש ב-Templates
- או: grid system (24 columns)

---

### 4.8 טעינת נתונים

**פורמט:**
```
תדירות: יומית - בשעות הלילה (02:00)
סוג טעינה: Incremental Load - טעינה מצטברת של רשומות חדשות בלבד
```

**הערות נוספות מהאפיון:**
- הטעינה תתבצע באמצעות Qlik Data Load Editor
- יש ליצור מנגנון לזיהוי רשומות חדשות (לפי order_purchase_timestamp)
- יש לבנות לוגיקה לטיפול ב-Late Arriving Facts
- מומלץ ליצור QVD files לאופטימיזציה
- יש לבנות Error Handling

---

### 4.9 הרשאות

**פורמט:**
```
Admin - גישה מלאה
Management - קריאה בלבד
Sales Managers - נתוני מכירות ולקוחות
Product Managers - נתוני מוצרים וקטגוריות
Sellers - מוגבל למוכר ספציפי (Section Access)
```

**הרשאת נתונים (Section Access):**
- מימדי הרשאות: Seller ID, Geographic Region
- מבנה קונפיגורציה יסופק ע"י הלקוח

---

## 5. מבנה JSON משלב A (הנחות)

### 5.1 מבנה קיים (משלב A)

```json
{
  "project_name": "olist_ecommerce",
  "space_name": "DataFiles",
  "space_path": "lib://DataFiles",
  "created_at": "2026-01-15T10:00:00Z",
  
  "tables": [
    {
      "name": "olist_orders_dataset",
      "qvd_file": "olist_orders_dataset.qvd",
      "full_path": "lib://DataFiles/olist_orders_dataset.qvd",
      "row_count": 99441,
      "fields": [
        {
          "name": "order_id",
          "type": "string",
          "is_key": true,
          "distinct_count": 99441,
          "null_count": 0
        },
        {
          "name": "customer_id",
          "type": "string",
          "is_key": false,
          "distinct_count": 96096,
          "null_count": 0
        },
        {
          "name": "order_status",
          "type": "string",
          "is_key": false,
          "distinct_count": 8,
          "null_count": 0,
          "sample_values": ["delivered", "shipped", "canceled", "processing"]
        },
        {
          "name": "order_purchase_timestamp",
          "type": "timestamp",
          "is_key": false,
          "null_count": 0
        },
        {
          "name": "order_delivered_customer_date",
          "type": "timestamp",
          "is_key": false,
          "null_count": 2965
        }
      ]
    },
    {
      "name": "olist_customers_dataset",
      "qvd_file": "olist_customers_dataset.qvd",
      "full_path": "lib://DataFiles/olist_customers_dataset.qvd",
      "row_count": 99441,
      "fields": [
        {
          "name": "customer_id",
          "type": "string",
          "is_key": true
        },
        {
          "name": "customer_unique_id",
          "type": "string",
          "is_key": false
        },
        {
          "name": "customer_zip_code_prefix",
          "type": "integer"
        },
        {
          "name": "customer_city",
          "type": "string"
        },
        {
          "name": "customer_state",
          "type": "string"
        }
      ]
    }
    // ... more tables
  ]
}
```

### 5.2 מה צריך להוסיף (שלב B)

```json
{
  // ... existing from Phase A
  
  "data_model": {
    "relationships": [
      {
        "left_table": "olist_orders_dataset",
        "left_field": "order_id",
        "right_table": "olist_order_items_dataset",
        "right_field": "order_id",
        "type": "1:M",
        "join_type": "left"
      }
      // ... more relationships
    ],
    
    "calendar": {
      "auto_generate": true,
      "master_date_field": "order_purchase_timestamp",
      "table": "olist_orders_dataset",
      "fiscal_year_start": "01-01",
      "additional_date_fields": [
        "order_delivered_customer_date",
        "order_estimated_delivery_date"
      ]
    }
  },
  
  "business_layer": {
    "dimensions": [
      {
        "id": "dim_purchase_date",
        "name_he": "תאריך רכישה",
        "name_en": "Purchase Date",
        "field": "OrderDate",
        "table": "DIM_Date",
        "description": "מימד זמן ראשי",
        "drill_group": "time_hierarchy"
      },
      {
        "id": "dim_customer",
        "name_he": "לקוח",
        "name_en": "Customer",
        "field": "customer_id",
        "table": "olist_customers_dataset",
        "description": "מזהה לקוח"
      }
      // ... more dimensions
    ],
    
    "measures": [
      {
        "id": "msr_total_revenue",
        "name_he": "סה\"כ הכנסות",
        "name_en": "Total Revenue",
        "expression": "Sum(payment_value)",
        "format": "#,##0",
        "description": "סכום כולל של כל המכירות"
      },
      {
        "id": "msr_order_count",
        "name_he": "מספר הזמנות",
        "name_en": "Order Count",
        "expression": "Count(DISTINCT order_id)",
        "format": "#,##0",
        "description": "כמות הזמנות כוללת"
      },
      {
        "id": "msr_aov",
        "name_he": "ממוצע להזמנה",
        "name_en": "AOV",
        "expression": "Sum(payment_value) / Count(DISTINCT order_id)",
        "format": "#,##0.00",
        "description": "ערך ממוצע להזמנה"
      }
      // ... more measures
    ],
    
    "drill_groups": [
      {
        "id": "time_hierarchy",
        "name": "Time Hierarchy",
        "dimensions": ["dim_year", "dim_quarter", "dim_month", "dim_week", "dim_day"]
      },
      {
        "id": "geo_hierarchy",
        "name": "Geography Hierarchy",
        "dimensions": ["dim_country", "dim_state", "dim_city"]
      }
    ],
    
    "variables": [
      {
        "name": "vCurrentYear",
        "definition": "=Max(Year)",
        "description": "השנה האחרונה בנתונים"
      },
      {
        "name": "vPreviousYear",
        "definition": "=$(vCurrentYear) - 1",
        "description": "השנה הקודמת"
      }
    ]
  },
  
  "presentation": {
    "theme": {
      "name": "olist_theme",
      "colors": {
        "primary": ["#1E88E5", "#42A5F5", "#64B5F6"],
        "secondary": ["#FFA726", "#FFB74D", "#FFC107"]
      }
    },
    
    "sheets": [
      {
        "id": "sheet_executive",
        "title_he": "Executive Dashboard",
        "title_en": "Executive Dashboard",
        "rank": 1,
        "objects": [
          {
            "id": "kpi_revenue",
            "type": "kpi",
            "title": "סה\"כ הכנסות",
            "measures": ["msr_total_revenue"],
            "layout": {
              "col": 0,
              "row": 0,
              "colspan": 6,
              "rowspan": 4
            }
          },
          {
            "id": "chart_revenue_trend",
            "type": "linechart",
            "title": "מגמת הכנסות",
            "dimensions": ["dim_month"],
            "measures": ["msr_total_revenue"],
            "layout": {
              "col": 6,
              "row": 0,
              "colspan": 18,
              "rowspan": 8
            }
          }
          // ... more objects
        ]
      }
      // ... more sheets
    ]
  },
  
  "load_script": {
    "reload_type": "incremental",
    "reload_schedule": "daily",
    "reload_time": "02:00",
    "incremental_config": {
      "delta_field": "order_purchase_timestamp",
      "delta_table": "olist_orders_dataset"
    }
  },
  
  "security": {
    "section_access": {
      "enabled": true,
      "reduction_fields": ["seller_id", "customer_state"]
    }
  }
}
```

---

## 6. הבעיות הקריטיות שצריך לפתור

### 6.1 Dimension Mapping - הבעיה מספר 1

**הבעיה:**
```
אפיון אומר: "מימד: לקוח"
שלב A יש: customer_id, customer_unique_id
איזה לבחור?
```

**אפשרויות פתרון:**

#### אופציה A: Convention-Based
```python
def map_dimension(dimension_name, available_fields):
    # חיפוש לפי keyword
    if "לקוח" in dimension_name or "customer" in dimension_name.lower():
        # חיפוש שדות עם "customer"
        candidates = [f for f in available_fields if "customer" in f.lower()]
        
        # עדיפות למפתח ראשי
        if "customer_id" in candidates:
            return "customer_id"
    
    return None
```

**יתרונות:** פשוט, מהיר
**חסרונות:** לא אמין, עלול לטעות

#### אופציה B: LLM-Based (המלצה)
```python
def map_dimension_with_llm(dimension_name, dimension_description, available_fields):
    prompt = f"""
    צריך למפות מימד עסקי לשדה טכני:
    
    מימד: {dimension_name}
    תיאור: {dimension_description}
    
    שדות זמינים:
    {json.dumps(available_fields, indent=2)}
    
    החזר בפורמט JSON:
    {{
      "field": "customer_id",
      "table": "olist_customers_dataset",
      "reasoning": "customer_id is the primary key..."
    }}
    """
    
    response = claude.complete(prompt)
    return json.loads(response)
```

**יתרונות:** אינטליגנטי, מטפל במקרי קצה
**חסרונות:** איטי, דורש API calls

#### אופציה C: Hybrid (המלצה הסופית)
```python
# 1. ניסיון convention
mapping = try_convention_mapping(dimension_name, fields)

if mapping:
    # 2. בקש אישור מהמשתמש/LLM
    confirmed = confirm_mapping(dimension_name, mapping)
    if confirmed:
        # 3. שמירה בcache לפעם הבאה
        cache_mapping(dimension_name, mapping)
        return mapping

# 4. אם נכשל - שאל LLM
return ask_llm_for_mapping(dimension_name, fields)
```

---

### 6.2 Expression Validation - הבעיה מספר 2

**הבעיה:**
```
נוסחה: Count(review_score >= 4) / Count(review_score) * 100

זה לא Qlik syntax תקני!
צריך: Count({<review_score={">=$(=4)"}>} review_score) / Count(review_score) * 100
```

**פתרון:**

```python
def validate_and_fix_expression(expression, available_fields):
    # 1. Parse הביטוי
    parsed = parse_qlik_expression(expression)
    
    # 2. זיהוי pseudo-code patterns
    patterns = [
        r"Count\((\w+)\s*(>=|<=|>|<|=)\s*(\d+)\)",  # Count(field >= value)
        r"WHERE\s+(\w+)\s*(>|<)\s*(\d+)",            # WHERE field > value
    ]
    
    # 3. תרגום ל-Qlik syntax תקני
    for pattern in patterns:
        if re.search(pattern, expression):
            expression = convert_to_set_analysis(expression, pattern)
    
    # 4. בדיקת שדות
    fields_used = extract_fields(expression)
    for field in fields_used:
        if field not in available_fields:
            raise FieldNotFoundError(f"Field '{field}' not found")
    
    # 5. בדיקת טיפוסים
    validate_types(expression, available_fields)
    
    return expression

def convert_to_set_analysis(expression, pattern):
    # המרה של Count(field >= 4) ל-Set Analysis
    # Count(review_score >= 4) → 
    # Count({<review_score={">=$(=4)"}>} review_score)
    pass
```

---

### 6.3 Calendar Generation - הבעיה מספר 3

**הבעיה:**
```
האפיון אומר: "יש ליצור מימד תאריכים"
אבל אין פירוט איך
```

**פתרון:**

```qlik
//===== AUTO-GENERATED CALENDAR =====

// Find date range
TempDates:
LOAD
    Date(Floor(Min(order_purchase_timestamp))) as MinDate,
    Date(Floor(Max(order_purchase_timestamp))) as MaxDate
RESIDENT FACT_Orders;

LET vMinDate = Peek('MinDate', 0, 'TempDates');
LET vMaxDate = Peek('MaxDate', 0, 'TempDates');

DROP TABLE TempDates;

// Generate Calendar
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
    If(WeekDay(Date) >= 5, 'Weekend', 'Weekday') as DayType,
    If(Month(Date) <= 3, 'Q1',
       If(Month(Date) <= 6, 'Q2',
          If(Month(Date) <= 9, 'Q3', 'Q4'))) as QuarterName
;
LOAD
    Date($(vMinDate) + IterNo() - 1) as Date
AUTOGENERATE 1
WHILE $(vMinDate) + IterNo() - 1 <= $(vMaxDate);

// Link to Facts
LEFT JOIN (FACT_Orders)
LOAD
    order_purchase_timestamp,
    Date(Floor(order_purchase_timestamp)) as OrderDate
RESIDENT FACT_Orders;
```

**שאלות:**
- מה תחילת שנה פיסקלית?
- האם צריך Hebrew month names?
- האם צריך holiday flags?

---

### 6.4 Layout Generation - הבעיה מספר 4

**הבעיה:**
```
האפיון אומר:
"Executive Dashboard - KPI Cards, Line Chart, Bar Chart"

אבל איפה לשים כל אחד?
```

**פתרון: Auto-Layout Algorithm**

```python
def generate_layout(sheet_definition):
    """
    Grid: 24 columns x unlimited rows
    Row height: 1 unit = 50px
    """
    
    objects = sheet_definition['objects']
    layouts = []
    
    current_row = 0
    current_col = 0
    
    for obj in objects:
        if obj['type'] == 'kpi':
            # KPIs: small, 4 columns wide
            layout = {
                "col": current_col,
                "row": current_row,
                "colspan": 4,
                "rowspan": 3
            }
            current_col += 4
            
            # Wrap to next row if needed
            if current_col >= 24:
                current_col = 0
                current_row += 3
        
        elif obj['type'] in ['barchart', 'linechart']:
            # Charts: wider, full width or half
            layout = {
                "col": 0,
                "row": current_row,
                "colspan": 24,
                "rowspan": 8
            }
            current_row += 8
        
        elif obj['type'] == 'table':
            # Tables: full width, taller
            layout = {
                "col": 0,
                "row": current_row,
                "colspan": 24,
                "rowspan": 12
            }
            current_row += 12
        
        layouts.append(layout)
    
    return layouts
```

**אופציה 2: Template-Based**
```json
{
  "template": "executive_dashboard",
  "layout": [
    {"type": "kpi_row", "kpi_count": 4},
    {"type": "chart_row", "charts": ["line", "bar"]},
    {"type": "detail_table"}
  ]
}
```

---

## 7. תהליך העבודה המלא (Step-by-Step)

### Phase 1: Document Parser
**Input:** מסמך_אפיון.docx  
**Output:** spec_parsed.json

```python
def parse_spec_document(docx_path):
    doc = Document(docx_path)
    tables = doc.tables
    
    parsed = {
        "metadata": extract_metadata(doc),
        "data_sources": parse_table(tables[1]),  # טבלת מקורות
        "fields": parse_table(tables[2]),         # טבלת שדות
        "relationships": parse_table(tables[3]),  # טבלת קשרים
        "dimensions": parse_table(tables[4]),     # טבלת מימדים
        "measures": parse_table(tables[5]),       # טבלת מדדים
        "sheets": parse_table(tables[6]),         # טבלת תצוגה
        "load_config": extract_load_config(doc),
        "security": extract_security_config(doc)
    }
    
    return parsed
```

---

### Phase 2: Enricher & Validator
**Input:** spec_parsed.json + db_metadata.json  
**Output:** enriched_model.json

```python
def enrich_and_validate(spec, db_metadata):
    enriched = {
        "metadata": spec["metadata"],
        "tables": merge_table_info(spec["data_sources"], db_metadata["tables"]),
        "data_model": {
            "relationships": validate_relationships(spec["relationships"], db_metadata),
            "calendar": generate_calendar_config(spec, db_metadata)
        },
        "business_layer": {
            "dimensions": map_dimensions(spec["dimensions"], db_metadata),
            "measures": validate_measures(spec["measures"], db_metadata)
        },
        "presentation": {
            "sheets": parse_sheets(spec["sheets"])
        }
    }
    
    return enriched
```

---

### Phase 3: Script Generator
**Input:** enriched_model.json  
**Output:** load_script.qvs

```python
def generate_load_script(model):
    script = []
    
    # 1. Variables
    script.append(generate_variables(model))
    
    # 2. Load tables
    for table in model["tables"]:
        script.append(generate_table_load(table))
    
    # 3. Calendar
    if model["data_model"]["calendar"]["auto_generate"]:
        script.append(generate_calendar(model))
    
    # 4. Link tables (if synthetic keys detected)
    if has_synthetic_keys(model):
        script.append(generate_link_tables(model))
    
    return "\n\n".join(script)
```

---

### Phase 4: Master Items Generator
**Input:** enriched_model.json  
**Output:** master_items.json

```python
def generate_master_items(model):
    items = {
        "dimensions": [],
        "measures": []
    }
    
    # Dimensions
    for dim in model["business_layer"]["dimensions"]:
        items["dimensions"].append({
            "qInfo": {"qType": "dimension", "qId": dim["id"]},
            "qDim": {
                "qFieldDefs": [dim["field"]],
                "qFieldLabels": [dim["name_he"]]
            },
            "qMetaDef": {
                "title": dim["name_he"],
                "description": dim.get("description", "")
            }
        })
    
    # Measures
    for msr in model["business_layer"]["measures"]:
        items["measures"].append({
            "qInfo": {"qType": "measure", "qId": msr["id"]},
            "qMeasure": {
                "qDef": msr["expression"],
                "qLabel": msr["name_he"],
                "qNumFormat": {"qType": "M", "qFmt": msr.get("format", "#,##0")}
            },
            "qMetaDef": {
                "title": msr["name_he"],
                "description": msr.get("description", "")
            }
        })
    
    return items
```

---

### Phase 5: Sheets & Visualizations Generator
**Input:** enriched_model.json  
**Output:** sheets.json

```python
def generate_sheets(model):
    sheets = []
    
    for sheet_def in model["presentation"]["sheets"]:
        sheet = {
            "qInfo": {"qType": "sheet", "qId": sheet_def["id"]},
            "qMetaDef": {"title": sheet_def["title_he"]},
            "rank": sheet_def["rank"],
            "cells": []
        }
        
        # Generate layouts
        layouts = auto_generate_layouts(sheet_def["objects"])
        
        # Create visualizations
        for i, obj_def in enumerate(sheet_def["objects"]):
            viz = create_visualization(
                obj_type=obj_def["type"],
                dimensions=obj_def.get("dimensions", []),
                measures=obj_def.get("measures", []),
                layout=layouts[i],
                model=model
            )
            sheet["cells"].append(viz)
        
        sheets.append(sheet)
    
    return sheets
```

---

### Phase 6: QVF Assembler
**Input:** load_script.qvs + master_items.json + sheets.json  
**Output:** final_app.qvf

```python
def assemble_qvf(script, master_items, sheets, output_path):
    # Option A: Qlik Engine API
    engine = connect_to_qlik_engine()
    app = engine.create_app("Generated App")
    
    # Set script
    app.set_script(script)
    
    # Reload data
    app.do_reload()
    
    # Create master items
    for dim in master_items["dimensions"]:
        app.create_dimension(dim)
    
    for msr in master_items["measures"]:
        app.create_measure(msr)
    
    # Create sheets
    for sheet in sheets:
        app.create_sheet(sheet)
    
    # Save
    app.save_as(output_path)
    
    # Option B: Direct QVF manipulation
    # with zipfile.ZipFile(output_path, 'w') as qvf:
    #     qvf.writestr('LoadScript.txt', script)
    #     qvf.writestr('masteritems.json', json.dumps(master_items))
    #     ...
```

---

### Phase 7: Validator
**Input:** final_app.qvf  
**Output:** validation_report.json

```python
def validate_app(qvf_path):
    app = open_qlik_app(qvf_path)
    
    checks = {
        "script_errors": check_script_errors(app),
        "data_loaded": check_data_loaded(app),
        "synthetic_keys": check_synthetic_keys(app),
        "data_islands": check_data_islands(app),
        "expressions_valid": check_all_expressions(app),
        "row_counts": verify_row_counts(app)
    }
    
    report = {
        "timestamp": datetime.now().isoformat(),
        "status": "PASS" if all_passed(checks) else "FAIL",
        "checks": checks
    }
    
    return report
```

---

## 8. טכנולוגיות ו-APIs

### 8.1 Qlik Engine API (WebSocket)
```python
import websocket
import json

ws = websocket.create_connection("ws://localhost:4848/app")

# Create app
ws.send(json.dumps({
    "method": "CreateApp",
    "params": {"qAppName": "MyApp"},
    "id": 1
}))

response = json.loads(ws.recv())
app_handle = response["result"]["qReturn"]["qHandle"]

# Set script
ws.send(json.dumps({
    "method": "SetScript",
    "handle": app_handle,
    "params": {"qScript": load_script},
    "id": 2
}))

# Reload
ws.send(json.dumps({
    "method": "DoReload",
    "handle": app_handle,
    "id": 3
}))
```

### 8.2 Qlik Sense Repository Service (QRS) API
```python
import requests

base_url = "https://qlik-server/qrs"
headers = {
    "X-Qlik-User": "UserDirectory=INTERNAL;UserId=sa_api"
}

# Upload QVF
with open("app.qvf", "rb") as f:
    response = requests.post(
        f"{base_url}/app/upload",
        headers=headers,
        files={"file": f}
    )

app_id = response.json()["id"]
```

### 8.3 Qlik CLI (qlik-cli)
```bash
# Create app
qlik app create --name "My App" --space "Personal"

# Upload script
qlik app script set --app <app-id> --file load_script.qvs

# Reload
qlik app reload --app <app-id>
```

---

## 9. נקודות פתוחות לדיון

### 9.1 שאלות טכניות
- [ ] איזה Qlik API להשתמש? (Engine/QRS/CLI)
- [ ] Qlik Cloud או On-Premise?
- [ ] איך לטפל ב-Section Access?
- [ ] איך להריץ Reload אוטומטי?

### 9.2 שאלות עסקיות
- [ ] מה עושים עם שגיאות validation?
- [ ] איך מטפלים בשינויים באפיון?
- [ ] מה התהליך לעדכון מודל קיים?
- [ ] איך מנהלים גרסאות (DEV/TEST/PROD)?

### 9.3 שאלות UX
- [ ] האם צריך UI לבניית המודל?
- [ ] איך משתמש אישר את ה-mapping?
- [ ] מה קורה כשיש שגיאה?

---

## 10. Gaps & Missing Info

### 10.1 מה חסר באפיון הנוכחי?
- ❌ Calculated Dimensions
- ❌ Variables (נוספות)
- ❌ Alternate States
- ❌ Themes/Colors (מלא)
- ❌ Bookmarks
- ❌ Stories
- ❌ Extensions

### 10.2 מה חסר ב-JSON משלב A?
- ❌ Field descriptions
- ❌ Sample values לכל שדה
- ❌ Data quality metrics (null%, distinct%)
- ❌ Field relationships (inferred)
- ❌ Recommended data types

### 10.3 מה צריך כדי להתקדם?
1. ✅ דוגמה של JSON משלב A (צריך לראות)
2. ✅ החלטה על Mapping strategy (LLM/Convention/Hybrid)
3. ✅ החלטה על Qlik API (Engine/QRS/CLI)
4. ⏳ בניית Parser ראשוני
5. ⏳ בניית Dimension Mapper
6. ⏳ בניית Expression Validator

---

## 11. Success Criteria

### 11.1 Definition of Done (DoD)
- [ ] Parser מחלץ 100% מהאפיון
- [ ] Mapper ממפה 95%+ מימדים בהצלחה
- [ ] Validator מזהה כל שגיאות expression
- [ ] Script Generator יוצר script תקין
- [ ] QVF נטען ב-Qlik ללא שגיאות
- [ ] כל הויזואליזציות מציגות נתונים
- [ ] אין Synthetic Keys (או מטופלים)
- [ ] Row counts תואמים לציפיות

### 11.2 Performance Targets
- Parser: < 5 שניות
- Enricher: < 10 שניות
- Mapper: < 30 שניות (כולל LLM calls)
- Script Generation: < 5 שניות
- QVF Creation: < 60 שניות
- **Total: < 2 דקות מאפיון ל-QVF**

---

## 12. Next Steps

1. **קבלת JSON משלב A** - דוגמה אמיתית
2. **בחירת Qlik API** - Engine/QRS/CLI
3. **בניית Parser MVP** - רק טבלאות + מדדים
4. **בניית Mapper MVP** - convention-based
5. **בניית Script Generator MVP** - basic load
6. **POC מלא** - מאפיון ל-QVF פשוט
7. **הרחבה** - master items, sheets, viz
8. **Production** - error handling, validation, monitoring

---

---

## 12. Data Modeling Best Practices - Grok Guide

**מקור:** Qlik Sense Data Modeling Optimization: A Definitive Guide

### 12.1 ארבעת הגישות המרכזיות

#### 1. Link Table (Bridge Table)
- **מתי:** Many-to-Many relationships ללא Synthetic Keys
- **יתרונות:** טיפול ב-granularity מורכבת, ניווט קל
- **חסרונות:** תחזוקה מורכבת, potential loops
- **RAM Impact:** +10-20% (טבלה נוספת)
- **CPU Impact:** +15-25% ל-joins מורכבים
- **Pattern:**
```qlik
Facts1: LOAD Key1, Key2, Measure1 FROM Source1;
Facts2: LOAD Key1, Key2, Measure2 FROM Source2;

LinkTable: 
LOAD DISTINCT Key1&'|'&Key2 AS %LinkKey, Key1, Key2 
RESIDENT Facts1;

Concatenate (LinkTable) 
LOAD DISTINCT Key1&'|'&Key2 AS %LinkKey, Key1, Key2 
RESIDENT Facts2;

DROP FIELDS Key1, Key2 FROM Facts1, Facts2;
```

#### 2. Concatenated Fact Table
- **מתי:** Facts דומים, Volume > 50M rows
- **יתרונות:** מודל פשוט, ביצועים מצוינים (30% מהירות)
- **חסרונות:** redundancy אפשרי, nulls inflate size
- **RAM Impact:** Variable (גבוה אם duplicated)
- **CPU Impact:** נמוך (-20-30% ב-UI)
- **Pattern:**
```qlik
Facts: 
LOAD *, 'Type1' AS FactType FROM Source1;
Concatenate (Facts) 
LOAD *, 'Type2' AS FactType FROM Source2;
```

#### 3. Star Schema (מומלץ!)
- **מתי:** Query Speed קריטי, Data < 100M rows
- **יתרונות:** 
  - אופטימלי ל-Associative Engine
  - Sub-second queries על 100M rows
  - CPU נמוך (15-25% utilization)
- **חסרונות:** Redundancy בdimensions
- **RAM Impact:** גבוה (+10-30%)
- **CPU Impact:** **נמוך מאוד** (optimal!)

**⭐ המלצה:** זו הגישה המועדפת ברוב המקרים!

#### 4. Snowflake Schema
- **מתי:** Storage Efficiency קריטי, Updates תכופים
- **יתרונות:** חיסכון ב-RAM (10-30% על datasets גדולים)
- **חסרונות:** Queries **20-50% יותר איטיים** (joins רבים)
- **RAM Impact:** נמוך (-10-30%)
- **CPU Impact:** גבוה (+20-50% for queries)

**⚠️ השתמש רק:** כאשר RAM באמת מוגבל!

### 12.2 Decision Tree - "The Holy Grail"

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

### 12.3 Performance Benchmarks

| Method | RAM | CPU | Query Speed | Load Time |
|--------|-----|-----|-------------|-----------|
| **Link Table** | +10-20% | +15-25% | Medium | Slow (transformations) |
| **Concatenated** | Variable | -20-30% | **Fast** ⚡ | **Fastest** ⚡ |
| **Star Schema** | +10-30% | **15-25%** ⚡ | **Sub-second** ⭐ | Medium |
| **Snowflake** | **-10-30%** 💾 | +20-50% 🐌 | Slow (joins) | Medium |

**At Scale (100M+ rows):**
- Concatenation: 125 users @ 2.5s response ⭐
- Link Tables: High cardinality risks CPU spike to 75%
- Snowflake: Saves RAM (21GB vs 25GB) but queries 3-5s 🐌

### 12.4 Advanced Techniques

#### Master Calendar Integration
```qlik
// Generate calendar from min/max dates
TempCalendar:
LOAD
    Date(MinDate + IterNo() - 1) AS TempDate
    AutoGenerate(1)
WHILE MinDate + IterNo() - 1 <= MaxDate;

MasterCalendar:
LOAD
    TempDate AS Date,
    Year(TempDate) AS Year,
    Month(TempDate) AS Month,
    Week(TempDate) AS Week,
    Day(TempDate) AS Day,
    WeekDay(TempDate) AS WeekDay
RESIDENT TempCalendar;

DROP TABLE TempCalendar;
```

#### Composite Keys
```qlik
// Instead of synthetic keys
LOAD 
    AutoNumberHash128(Key1, Key2) AS %CompositeKey,
    *
FROM Source;
```

#### IntervalMatch (for date ranges)
```qlik
// Match numeric intervals to discrete keys
Transactions:
LOAD TransactionID, Amount, TransactionDate FROM [...];

Promotions:
LOAD PromotionID, StartDate, EndDate FROM [...];

IntervalTable:
IntervalMatch(TransactionDate)
LOAD DISTINCT StartDate, EndDate RESIDENT Promotions;
```

#### Generic Load (hierarchical data)
```qlik
// Transform attribute-value pairs into pivoted structure
GenericLoad:
GENERIC LOAD
    ID,
    Attribute,
    Value
FROM Source;
```

### 12.5 Anti-Patterns (להימנע!)

❌ **Joining huge tables unnecessarily**
- גורם ל-Cartesian products
- RAM explodes (10x increase!)

❌ **Creating Synthetic Keys unknowingly**
- מבוסס על multi-field shares
- גורם ל-data inconsistencies

❌ **Over-normalization in Snowflake**
- הרבה joins = queries איטיים
- פוגע ב-Associative queries

❌ **Data Islands** (unconnected tables)
- בזבוז resources
- משפיע על performance

### 12.6 Optimization Functions

```qlik
// AutoNumber - Convert keys to integers (RAM savings)
AutoNumber(CustomerID) AS CustomerID_KEY

// AutoNumberHash128 - For composite keys
AutoNumberHash128(Field1, Field2) AS %CompositeKey

// Exists - Check for loaded values (incremental loads)
WHERE NOT Exists(OrderID, OrderID)

// Keep - Filter joins without merging tables
INNER KEEP (Sales) LOAD * FROM Products;
```

### 12.7 Checklist for New Model

```
□ Sketch data model on paper (facts/dimensions)
□ Aim for Star Schema unless normalization needed
□ Resolve synthetic keys (rename/qualify/composite)
□ Check for circular references; break if found
□ Use AutoNumber for keys to optimize RAM
□ Integrate Master Calendar for dates
□ Implement IntervalMatch/Generic for special data
□ Test with 10% data; monitor RAM/CPU
□ Use QVDs for incremental loads
□ Validate associations in Data Model Viewer
```

### 12.8 Maintenance Complexity

| Method | Update Difficulty | Debt Level |
|--------|------------------|------------|
| **Link Tables** | ⚠️ Hardest | High (complex scripts, evolving models) |
| **Snowflake** | ⚠️ Medium | Medium (more tables = more changes) |
| **Concatenation** | ✅ Simpler | Low |
| **Star Schema** | ✅ Simpler | Low |

**המלצה:** התחל פשוט (Star/Concatenation), עבור ל-Link/Snowflake רק אם הכרחי.

### 12.9 Best Practices Synthesis

**From Henric Cronström (Qlik Design Blog):**
- Favor **Star Schemas** for optimal structure
- Use **Symbol Tables** for compression
- Avoid loops with careful key design

**From Qlik Luminary:**
- **Single-fact models** for usability

**From Official Whitepapers:**
- **Incremental loads** and **QVDs** for large data

**המלצה הכללית:**
```
1st Choice: Star Schema (speed + simplicity)
2nd Choice: Concatenated Fact (if similar facts)
3rd Choice: Link Table (if many-to-many unavoidable)
Last Resort: Snowflake (only if RAM critical)
```

### 12.10 ⚠️ אזהרות ארכיטקטוניות קריטיות

#### Star Schema Warnings
- ❌ **God Tables**: הימנעו מטבלאות עם עשרות שדות לא בשימוש
- 💡 **סיבה**: כל שדה = Symbol Table נפרדת ב-RAM
- ✅ **פתרון**: טענו רק שדות נדרשים, השתמשו ב-`LOAD` סלקטיבי

```qlik
// ❌ Wrong - loads everything
DIM_Customers: LOAD * FROM [lib://DB/customers.qvd] (qvd);

// ✅ Correct - selective loading
DIM_Customers: 
LOAD 
    CustomerID_KEY,
    CustomerName,
    City,
    Segment
FROM [lib://DB/customers.qvd] (qvd);
```

#### Snowflake Schema Warnings
- ⚠️ **Single-threaded Resolution**: שלב Resolution ב-Qlik הוא חד-תהליכי!
- 💡 **השפעה**: Snowflake עמוק = צוואר בקבוק, לא מנצל ליבות CPU
- 📊 **מתי זה בעיה**: מעל 4-5 רמות עומק בהיררכיה
- ✅ **פתרון**: שטח (flatten) היררכיות ל-Star Schema

```
❌ Too Deep (Snowflake):
Product → Category → Department → Division → Company
(5 hops from Fact!)

✅ Flattened (Star):
Product [with denormalized: Category, Department, Division, Company]
(1 hop from Fact!)
```

#### Concatenated Fact Warnings
- ⚠️ **High Cardinality Risk**: קרדינליות > 10,000 ערכים = בעיה
- 💡 **Sparse Table**: NULL רבים = בזבוז RAM
- 📊 **כלל אצבע**: אם > 30% מהטבלה NULL → שקול Link Table
- ✅ **מתי להשתמש**: Facts דומים בגרנולריות

```qlik
// Good use case - similar granularity
Facts:
LOAD *, 'Actual' AS FactType FROM Sales;
CONCATENATE (Facts)
LOAD *, 'Budget' AS FactType FROM Budgets;

// Bad use case - different granularity
// Sales (daily) + Inventory (hourly) → lots of NULLs!
```

#### Link Table Warnings
- 🔥 **Cardinality Explosion**: הסכנה הכי גדולה!
- 💡 **כלל קריטי**:
  - < 1,000 combinations → Link Table **יעיל** (חוסך 15-40% RAM)
  - > 10,000 combinations → Link Table **מסוכן** (**ברחו!**)
  - 10,000-100,000 → CPU spike ל-75%, RAM explosion
  
```qlik
// Calculate cardinality BEFORE creating link table
LinkCardinality:
LOAD 
    Count(DISTINCT Key1 & '|' & Key2 & '|' & Key3) AS Combos
RESIDENT Facts;

LET vCombos = Peek('Combos', 0, 'LinkCardinality');

IF $(vCombos) > 10000 THEN
    TRACE WARNING: High cardinality ($(vCombos)) - consider Concatenation!;
END IF
```

### 12.11 פונקציות אופטימיזציה קריטיות

#### AutoNumber - חיסכון ב-RAM
```qlik
// Before: String keys (high RAM)
OrderID: '2024-ORD-00001'  // ~20 bytes per value

// After: AutoNumber (60% savings!)
AutoNumber(OrderID) AS OrderID_KEY  // ~4 bytes per value

// For composite keys:
AutoNumberHash128(CustomerID, ProductID) AS %CompositeKey
```

**💰 חיסכון:** עד **60% מצריכת RAM** של מפתחות!

#### Exists - טעינה אופטימלית
```qlik
// Incremental load with Exists
Customers_New:
LOAD * 
FROM [lib://DB/customers.csv]
WHERE NOT Exists(CustomerID);  // Only new records!

// Optimized QVD load
CONCATENATE (Customers)
LOAD * 
FROM [lib://QVD/customers.qvd] (qvd)
WHERE Exists(CustomerID);  // Only relevant records!
```

**🚀 תועלת:** מהירות טעינה + חיסכון ב-RAM

#### Keep - סינון ללא מיזוג
```qlik
// Instead of JOIN (creates wide table):
Sales:
LOAD * FROM sales.qvd (qvd);
LEFT JOIN (Sales)
LOAD * FROM products.qvd (qvd);  // ❌ Creates wide table!

// Use KEEP (preserves structure):
Sales:
LOAD * FROM sales.qvd (qvd);

Products:
LOAD * FROM products.qvd (qvd);

INNER KEEP (Sales) LOAD * RESIDENT Products;  // ✅ Filters only!
```

### 12.12 טבלת השוואה מלאה

| קריטריון | Star Schema ⭐ | Snowflake ⚠️ | Concatenated Fact 🚀 | Link Table 🔗 |
|----------|---------------|---------------|---------------------|---------------|
| **מהירות חישוב** | ⭐⭐⭐⭐⭐ מקסימלית | ⭐⭐ בינונית-נמוכה | ⭐⭐⭐⭐⭐ גבוהה מאוד | ⭐⭐⭐ בינונית |
| **צריכת RAM** | ⭐⭐⭐⭐ מאוזנת | ⭐⭐⭐⭐⭐ נמוכה | ⭐⭐⭐ משתנה | ⭐⭐ גבוהה בקרדינליות |
| **תחזוקה** | ⭐⭐⭐⭐⭐ קלה | ⭐⭐ קשה (הרבה טבלאות) | ⭐⭐⭐⭐⭐ קלה מאוד | ⭐⭐ קשה (ניהול מפתחות) |
| **חוויית משתמש** | ⭐⭐⭐⭐⭐ אינטואיטיבית | ⭐⭐ מורכבת | ⭐⭐⭐⭐ טובה (דורש Set Analysis) | ⭐⭐⭐⭐ נקייה |
| **Scalability** | ⭐⭐⭐⭐ עד 100M | ⭐⭐⭐ מוגבל | ⭐⭐⭐⭐⭐ מעל 100M | ⭐⭐ תלוי קרדינליות |
| **CPU Utilization** | 15-25% ⭐ | 40-75% ⚠️ | 10-20% ⭐⭐ | 20-75% (תלוי) |

### 12.13 Decision Tree - המדריך המלא

**שלב 1: מספר Fact Tables?**
```
האם מדובר בטבלת עובדות (Fact) יחידה?
│
├─ YES → Star Schema ⭐⭐⭐
│        BEST CHOICE!
│        - טבלת Fact אחת + מימדים דה-נורמליזטוריים
│        - ביצועים מקסימליים
│        - פשטות למשתמש
│
└─ NO → המשך לשלב 2 ↓
```

**שלב 2: רמת פירוט (Granularity)**
```
האם לטבלאות העובדות יש מבנה ורמת פירוט זהים?
│
├─ YES → Concatenate ✅
│        - שרשור לטבלת Fact אחת רחבה
│        - הוסף שדה FactType לזיהוי
│        - ביצועים מעולים
│        Example: Sales + Budget (both monthly)
│
└─ NO → המשך לשלב 3 ↓
```

**שלב 3: נפח נתונים**
```
האם רמת הפירוט שונה (Mixed Granularity) 
AND נפח הכולל > 50-100M שורות?
│
├─ YES → Concatenate (with dummy keys) ✅
│        - בנפחים כאלה, יעילות המנוע בטבלה אחת
│          גוברת על מורכבות ה-UI
│        - השתמש ב-Set Analysis להפרדה לוגית
│        Example: Sales (daily) + Inventory (hourly)
│
└─ NO → המשך לשלב 4 ↓
```

**שלב 4: הפרדה לוגית**
```
האם קריטי להפריד לוגית בין העובדות 
עבור משתמשי Self-Service?
│
├─ YES → בדוק Cardinality ↓
│        
│        ┌─ קרדינליות נמוכה (<1,000 שילובים)?
│        │  └─ YES → Link Table ✅
│        │           - חוויית משתמש נקייה
│        │           - חיסכון RAM של 15-40%
│        │
│        └─ קרדינליות גבוהה (>10,000) OR >5 מימדים משותפים?
│           └─ YES → Concatenate ⚠️
│                    - למנוע קריסת ביצועים
│                    - Link Table יצרוך יותר RAM מהעובדות!
│
└─ NO → Concatenate או Star (לפי מקרה)
```

**שלב 5: RAM vs Speed (אם עדיין לא הוחלט)**
```
מה הקריטריון החשוב ביותר?
│
├─ Query Speed → Star Schema ⭐
│                - CPU: 15-25%
│                - Response: Sub-second
│
├─ RAM Efficiency → Snowflake ⚠️
│                    - RAM: -10-30%
│                    - ⚠️ Max 3-4 levels depth!
│                    - ⚠️ Single-threaded Resolution
│
└─ Balance → Star Schema (מומלץ)
```

### 12.14 Anti-Patterns - טעויות קריטיות

#### א. Synthetic Keys 🔥 הבעיה הכי נפוצה!

**מה קורה:**
- Qlik יוצר טבלה נסתרת אוטומטית כאשר >1 שדה משותף
- טבלה זו מנהלת את כל השילובים
- **תוצאה:** ניפוח RAM + חישובים איטיים ומסורבלים

**דוגמה:**
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
- המנוע "מנתק" קשר אחד (Loose Coupling) באופן שרירותי
- **תוצאה:** תוצאות לא עקביות, עמימות לוגית

**דוגמה:**
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

**אלטרנטיבה: Qualify Prefix**
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
- **תוצאה:** 
  - בזבוז RAM על NULLs רבים
  - כל שדה = Symbol Table נפרדת
  - קושי בתחזוקה

**דוגמה:**
```qlik
// ❌ BAD - God Table (100 columns!)
Everything:
LOAD 
    OrderID,
    CustomerName, CustomerCity, CustomerCountry, CustomerSegment,
    ProductName, ProductCategory, ProductSubCategory, ProductBrand,
    SupplierName, SupplierCity, SupplierCountry,
    OrderDate, ShipDate, DeliveryDate,
    Quantity, UnitPrice, Discount, Tax, Total,
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
    UnitPrice,
    Total
FROM orders.csv;

DIM_Customers:
LOAD 
    CustomerID_KEY,
    CustomerName,
    City,
    Country,
    Segment
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

**דוגמה:**
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
Sum({<FactType={'Sales'}>} Amount)
```

**חישוב קרדינליות לפני יצירה:**
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
- חישובים מורכבים מדי (`Aggr`) בUI במקום בסקריפט
- ללא QVDs
- **תוצאה:** 
  - כל שינוי דורש עדכון עשרות אובייקטים
  - אפליקציה כבדה ולא יציבה
  - טעינה איטית

**דוגמה:**
```qlik
// ❌ BAD
Orders: LOAD * FROM huge_table.csv;  // Loads everything!

// And in UI, heavy calculations:
Aggr(Sum(Amount), Customer, Product, Month)  // Slow!
```

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
FROM [lib://DB/orders] (txt);

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

### 12.15 Anti-Patterns Checklist

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

### 12.14 המלצות זהב - סיכום ביצועים

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

### 12.15 Calculation Examples

#### Estimating Link Table Size
```qlik
// Check before creating Link Table
TempCheck:
LOAD
    Key1,
    Key2,
    Key3
FROM Facts;

LinkEstimate:
LOAD
    Count(DISTINCT Key1 & '|' & Key2 & '|' & Key3) AS EstimatedRows
RESIDENT TempCheck;

LET vEstimate = Peek('EstimatedRows', 0, 'LinkEstimate');

IF $(vEstimate) < 1000 THEN
    TRACE Link Table recommended - low cardinality ($(vEstimate));
ELSEIF $(vEstimate) > 10000 THEN
    TRACE WARNING: Link Table NOT recommended - high cardinality ($(vEstimate))!;
    TRACE Suggestion: Use Concatenated Fact instead;
ELSE
    TRACE Link Table possible but monitor performance ($(vEstimate));
END IF

DROP TABLES TempCheck, LinkEstimate;
```

#### RAM Savings with AutoNumber
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

### 13.1 9 שלבי פרויקט BI מקצועי

הפרויקט מחולק ל-9 אבני דרך עיקריות:

| שלב | שם | זמן משוער | תוצרים |
|------|-----|-----------|---------|
| 01 | אפיון על | 2-3 ימים | מסמך אפיון-על |
| 02 | התנעת פרויקט | 1 יום | סיכום פגישה, רשימת גורמים |
| 03 | אפיון מפורט | 5-7 ימים | מסמך אפיון מפורט מלא |
| 04 | ETL | 8-12 ימים | סקריפטים טעינה, QVD files |
| 05 | ERD | 3-5 ימים | סכמת נתונים, קשרים |
| 06 | ממשק משתמש | 5-7 ימים | Mockup + מסמך אפיון GUI |
| 07 | תיקונים/שינויים | 2-4 ימים | רשימת תקלות + תיקונים |
| 08 | עליה לאוויר | 1-2 ימים | Production deployment |
| 09 | סיכום + תכנית הטמעה | 1 יום | מצגת סיכום, תכנית המשך |

**סה"כ:** ~33 ימי עבודה למודל ממוצע

### 13.2 CSF - גורמים קריטיים להצלחה

1. **מחויבות הנהלה** לפרויקט
2. **יעדים מוסכמים וברורים**
3. **מעורבות גבוהה של הלקוח** בפרויקט
4. **מנהל פרויקט מנוסה**
5. **מיישמים מקצועיים**
6. **נהלי עבודה ברורים**
7. **עמידה בלוחות זמנים** שנקבעו

### 13.3 מבנה אפליקציות מומלץ

כל מודל מחולק ל-4 אפליקציות נפרדות:

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

### 13.4 קונבנציות קוד (Naming Conventions)

#### שדות
```qlik
// CamelCase - כל מילה עם אות גדולה
CustomerName
OrderDate
ProductCategory

// סיומות מיוחדות
IsActive_FLAG          // דגלים בינריים
CustomerID_KEY         // מפתחות
ProductType_IND        // ציון סיווג
```

#### משתנים
```qlik
// v + CamelCase
LET vMaxDate = Today();
LET vQVDPath = 'lib://DataFiles/';
SET vCurrentYear = 2024;
```

#### מדדים
```qlik
// אותיות גדולות בלבד (לצורך Section Access)
TOTAL_REVENUE
ORDER_COUNT
AVERAGE_PRICE
```

### 13.5 עץ ספריות מומלץ

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
└── Final/                 # Final data - מוכן לGUI
    ├── FACT_Orders.qvd
    ├── DIM_Customers.qvd
    └── DIM_Calendar.qvd
```

### 13.6 כללי פיתוח חובה

#### כלליים
- ❌ **אין פיתוח ללא אפיון** מסודר, מלא ומפורט
- ✅ כל הפיתוחים **רק בסביבת DEV**
- ✅ חובה לתחזק **גרסאות מסמכי אפיון**
- ✅ לא לעבור ל-Production **ללא בדיקות**
- ✅ בסיום פיתוח - **בדיקות מסירה חובה**

#### טעינת נתונים
- ✅ **Delta Load בלבד** - לא Full (חוץ מטבלאות קטנות)
- ✅ כל חיבור למקור = **משתנה בקוד**
- ✅ קונפיגורציה **בקובץ חיצוני** - לא Hard-Coded
- ✅ תיעוד **קטעי קוד חשובים**
- ✅ Sections עם **מספור רץ** (הפרשים של 10)
- ✅ שינויים **עם תאריך + שם מתקן**

#### Best Practices
- ❌ להימנע מ-`LOAD BINARY` → להשתמש ב-QVD Final
- ❌ להימנע מ-`LOAD RESIDENT` → להעדיף QVD Load
- ✅ Calendar: Auto-generate מכל שדות timestamp
- ✅ לשדה dimension: שם בעברית (תרגום)
- ✅ כל dimension/measure → **Master Item**

### 13.7 בדיקות QA חובה

#### בדיקות נתונים
- ✅ בדיקת **כמות רשומות** מול מקור
- ✅ בדיקת **אמינות נתונים** - חיתוכים שונים
- ✅ אימות עם **גורמים עסקיים**
- ✅ בדיקת **מימדים עם NULL**
- ✅ בדיקת **מדדים שמחזירים 0**
- ✅ בדיקת **אחוז ערכים מלאים** בטבלת מפתחות

#### בדיקות ביצועים
- ✅ בדיקת **מהירות תגובה** - חיתוכים שונים
- ✅ בדיקת **אלמנטים גרפיים** - אמינות לאחר aggregations
- ✅ **בדיקות רגרסיה** - השוואה למודל קודם

### 13.8 GUI Best Practices

#### אפיון GUI
- ✅ אפיון רק **לאחר סיום ERD**
- ✅ שפה **עברית** מימין לשמאל
- ✅ פורמט **עברי** למשתני מערכת
- ✅ כל dimension לסינון → **שדה בעברית**
- ✅ תיעוד: היסטוריה, מטבעות, **סכמת צבעים**
- ✅ **Mockup** לתצורת מסך - מיקום + צבעים
- ✅ רשימת **תמונות ל-Sheets**

#### Master Items
- ✅ כל measure/dimension → Master Item
- ✅ משתנים עם **הסבר + נוסחה בסוגריים**

#### Theme
- ✅ Logo + Theme מותאם
- ✅ אם אין - להגדיר איזה Qlik Theme להשתמש

---

## 14. QlikModelBuilder (QMB) - הארכיטקטורה הקיימת

### 14.1 מבנה גבוה

**QMB** הוא MCP Server שכבר בנוי ועובד (MVP v0.1.0), המשמש כ-Wizard אינטראקטיבי.

```
Technology Stack:
- TypeScript + Node.js ≥18
- MCP SDK 0.5.0
- @qlik/api 2.2.0
- enigma.js 2.14.0
```

**ארכיטקטורה:**
```
MCP Server (index.ts)
    ↓
┌───────────┬───────────┬───────────┐
│ Handlers  │ Services  │  Wizard   │
│ (40+)     │ (20+)     │ (7 steps) │
└───────────┴───────────┴───────────┘
    ↓                       ↓
┌─────────────┐    ┌──────────────┐
│  Adapters   │    │ Config/Utils │
│ Cloud/OnPre │    │ Cache/Logs   │
└─────────────┘    └──────────────┘
```

### 14.2 Wizard - 7 שלבים

| # | שם | תפקיד | Output |
|---|----|----|--------|
| 1 | `space_setup` | בחירת Space | space config |
| 2 | `data_source` | הגדרת חיבור | connection config |
| 3 | `table_selection` | בחירת טבלאות | tables[] |
| 4 | `field_mapping` | שדות + טיפוסים | fields[] |
| 5 | `incremental_config` | Delta logic | incremental config |
| 6 | `review` | סקירה | generatedScript |
| 7 | `deploy` | העלאה לQlik | appId |

**תהליך:**
```
START → space_setup → data_source → table_selection
                                          ↓
                                    field_mapping
                                          ↓
                    deploy ← review ← incremental_config
                      ↓
                    END
```

### 14.3 ProjectState JSON - המבנה המרכזי

זהו ה-JSON שנוצר **אחרי פרסור האיפיון**:

```typescript
interface ProjectState {
  // Metadata
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Wizard state
  currentStep: WizardStep;
  entryMode: 'scratch' | 'spec' | 'template';
  completedSteps: WizardStep[];
  
  // Qlik resources
  space: SpaceConfig;
  connection: ConnectionConfig;
  tables: TableConfig[];
  relationships?: Relationship[];
  
  // Generated
  generatedScript?: string;
  deployedAppId?: string;
  lastValidation?: ValidationResult;
}
```

**דוגמה:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Sales Data Model",
  "entryMode": "spec",
  "currentStep": "review",
  
  "space": {
    "id": "65a4b3c2d1e0f9876543210",
    "name": "Production Analytics",
    "type": "managed"
  },
  
  "connection": {
    "id": "conn-abc123",
    "name": "SalesDB",
    "type": "sqlserver",
    "server": "sql.company.com",
    "database": "SalesData"
  },
  
  "tables": [
    {
      "name": "orders",
      "alias": "Orders",
      "tableType": "fact",
      "fields": [
        {
          "name": "order_id",
          "alias": "OrderKey",
          "type": "integer",
          "isPrimaryKey": true
        }
      ],
      "incremental": {
        "strategy": "by_date",
        "field": "modified_date"
      }
    }
  ]
}
```

### 14.4 Incremental Strategies בQMB

| Strategy | שימוש | Script Pattern |
|----------|-------|---------------|
| `none` | טבלאות קטנות | Full reload |
| `by_date` | Fact עם ModifiedDate | WHERE date > vMaxDate |
| `by_id` | Auto-increment ID | WHERE id > vMaxId |
| `time_window` | N ימים אחרונים | WHERE date > AddDays(-90) |
| `custom` | לוגיקה מיוחדת | Custom WHERE clause |

### 14.5 Entry Modes

1. **`scratch`** - בניה מאפס, צעד אחר צעד
2. **`spec`** - **זה מה שאנחנו צריכים!** - Parser של Word/Excel → JSON
3. **`template`** - תבנית מוכנה

### 14.6 Tools (31 Wizard Tools)

הכלים שכבר קיימים ב-QMB:

```typescript
// State Management
qmb_get_state
qmb_export_state
qmb_import_state

// Wizard Navigation
qmb_start_wizard
qmb_next_step
qmb_previous_step
qmb_goto_step

// Configuration
qmb_set_space
qmb_set_connection
qmb_add_table
qmb_set_field_config
qmb_set_incremental

// Generation & Deploy
qmb_generate_script
qmb_validate_config
qmb_deploy_app
```

### 14.7 מה QMB כבר יודע לעשות

✅ **כבר מיושם (Phase A):**
- חיבור ל-Qlik Cloud/On-Premise
- יצירת Spaces
- הגדרת Data Connections
- בחירת טבלאות ממקור נתונים
- Mapping שדות
- הגדרת Incremental Load
- יצירת Qlik Script
- Deploy של App

❌ **חסר (Phase B - מה שאנחנו צריכים):**
- **Parser של Word/Excel לJSON** 👈 זה המשימה!
- Dimension Mapper (Hebrew → Field)
- Measure Validator (Qlik expressions)
- Calendar Auto-Generator
- Master Items Creator
- Sheets & Visualizations Builder
- GUI Layout Generator

---

## 15. Integration Plan - איך לשלב הכל

### 15.1 הקשר בין המסמכים

```
┌────────────────────────────────────────────────────────┐
│  מתודולוגיה Qlik Israel (2020)                        │
│  • 9 שלבים                                             │
│  • Best practices                                      │
│  • Naming conventions                                  │
│  • 4-app architecture                                  │
└────────────────────────────────────────────────────────┘
                    ↓ מנחה את
┌────────────────────────────────────────────────────────┐
│  מסמך אפיון מפורט (Word/Excel)                        │
│  • מקורות מידע                                        │
│  • שדות מרכזיים                                       │
│  • קשרים                                              │
│  • מימדים + מדדים                                     │
│  • תצוגה (Sheets)                                     │
└────────────────────────────────────────────────────────┘
                    ↓ Parser (חסר!)
┌────────────────────────────────────────────────────────┐
│  ProjectState JSON (QMB)                               │
│  • space, connection, tables                           │
│  • fields, incremental                                 │
│  • relationships                                       │
└────────────────────────────────────────────────────────┘
                    ↓ QMB Wizard
┌────────────────────────────────────────────────────────┐
│  Generated Qlik App                                    │
│  • Load Script (ETL)                                   │
│  • Data Model (ERD)                                    │
│  • Master Items (Dimensions + Measures)                │
│  • Sheets & Visualizations (GUI)                       │
└────────────────────────────────────────────────────────┘
```

### 15.2 Updated Architecture - 8 Phases

בהתבסס על QMB הקיים + המתודולוגיה:

| Phase | Name | Input | Output | Status |
|-------|------|-------|--------|--------|
| 0 | **Spec Parser** | Word/Excel | ProjectState JSON | 🆕 צריך לבנות |
| 1 | Space Setup | JSON | space config | ✅ קיים |
| 2 | Data Source | JSON | connection config | ✅ קיים |
| 3 | Table Selection | JSON | tables[] | ✅ קיים |
| 4 | Field Mapping | JSON + LLM | fields[] mapped | 🔨 צריך לשפר |
| 5 | Incremental Config | JSON | incremental config | ✅ קיים |
| 6 | Script Generation | ProjectState | .qvs script | ✅ קיים |
| 7 | Deploy | script + config | appId | ✅ קיים |

**Phase 0 הוא הכי קריטי** - זה הגשר בין האפיון לQMB.

### 15.3 מה צריך לבנות

#### Phase 0: Specification Parser

**Input:** מסמך_אפיון.docx  
**Output:** ProjectState JSON

**רכיבים:**
```python
class SpecificationParser:
    def parse_document(docx_path) -> Dict:
        """Parse Word/Excel to structured data"""
        
    def extract_tables_metadata() -> List[TableConfig]:
        """Extract tables from section 7.2"""
        
    def extract_fields() -> List[FieldConfig]:
        """Extract fields from section 7.3"""
        
    def extract_relationships() -> List[Relationship]:
        """Extract from section 7.4"""
        
    def extract_dimensions() -> List[DimensionSpec]:
        """Extract from section 7.6"""
        
    def extract_measures() -> List[MeasureSpec]:
        """Extract from section 7.7"""
        
    def extract_sheets() -> List[SheetSpec]:
        """Extract from section 7.8"""
        
    def build_project_state() -> ProjectState:
        """Combine all into QMB format"""
```

#### Phase 4+: Dimension Mapper Enhancement

```python
class DimensionMapper:
    def map_hebrew_to_field(
        dimension_name: str,    # "לקוח"
        description: str,       # "מזהה לקוח, לקוח ייחודי"
        available_fields: List  # ["customer_id", "customer_unique_id"]
    ) -> FieldMapping:
        """LLM-based mapping with caching"""
```

#### Phase 5+: Data Model Optimizer (🆕 חדש!)

```python
class DataModelOptimizer:
    def analyze_requirements(
        tables: List[TableConfig],
        relationships: List[Relationship],
        volume_estimate: int
    ) -> ModelingStrategy:
        """
        Applies Grok Decision Tree:
        1. Check granularity + volume → Concatenated?
        2. Check many-to-many → Link Table?
        3. Check query speed priority → Star Schema?
        4. Check storage priority → Snowflake?
        """
        
    def detect_synthetic_keys() -> List[SyntheticKeyWarning]:
        """Find potential synthetic key issues"""
        
    def suggest_composite_keys() -> List[CompositeKeyRecommendation]:
        """Recommend AutoNumberHash128 usage"""
        
    def detect_circular_refs() -> List[CircularReference]:
        """Find and suggest fixes for circular associations"""
        
    def generate_calendar(
        date_fields: List[str]
    ) -> CalendarTableScript:
        """Auto-generate Master Calendar"""
```

#### Phase 6+: Enhanced Script Generator

צריך להוסיף לScript Generator הקיים:
- **Calendar generation** (Qlik Israel + Grok methodology)
- **Master Items creation**
- **4-app separation** (DB/ERD/Permissions/GUI)
- **Naming conventions** (CamelCase, _KEY, _FLAG)
- **Data modeling strategy** selection (Star/Snowflake/Concatenated/Link)
- **Optimization functions** (AutoNumber, Exists, Keep)
- **Circular reference handling**

**דוגמה לקוד שנוצר:**
```qlik
//=================================================================
// Data Modeling Strategy: STAR SCHEMA
// Reason: Query speed critical, data volume ~50M rows
// Performance: Sub-second queries, 15-25% CPU utilization
//=================================================================

//=================================================================
// Section 010: Master Calendar
//=================================================================
// Auto-generated from date fields: OrderDate, ShipDate
//=================================================================

LET vMinDate = Num(Date#('2020-01-01', 'YYYY-MM-DD'));
LET vMaxDate = Num(Today());

TempCalendar:
LOAD
    Date($(vMinDate) + IterNo() - 1) AS TempDate
    AutoGenerate(1)
WHILE $(vMinDate) + IterNo() - 1 <= $(vMaxDate);

MasterCalendar:
LOAD
    TempDate AS Date,
    Year(TempDate) AS Year,
    Month(TempDate) AS Month,
    Week(TempDate) AS Week,
    Day(TempDate) AS Day,
    WeekDay(TempDate) AS WeekDay,
    'Q' & Ceil(Month(TempDate)/3) AS Quarter
RESIDENT TempCalendar;

DROP TABLE TempCalendar;

//=================================================================
// Section 020: Fact Table - Orders (Star Schema)
//=================================================================
// Using AutoNumber for RAM optimization
// Incremental Load Strategy: by_date
//=================================================================

IF FileSize('$(vQVDPath)FACT_Orders.qvd') > 0 THEN
  FACT_Orders_Existing:
  LOAD * FROM [$(vQVDPath)FACT_Orders.qvd] (qvd);
  
  LET vMaxDate = Peek('ModifiedDate', -1, 'FACT_Orders_Existing');
END IF

FACT_Orders_New:
LOAD
    AutoNumber(OrderID) AS OrderID_KEY,        // RAM optimization
    AutoNumber(CustomerID) AS CustomerID_KEY,  // RAM optimization
    OrderDate,
    TotalAmount AS TOTAL_AMOUNT,               // Upper case for measures
    ModifiedDate
FROM [lib://SalesDB/dbo.orders]
WHERE ModifiedDate > '$(vMaxDate)';

FACT_Orders:
NOCONCATENATE LOAD * RESIDENT FACT_Orders_Existing;
CONCATENATE LOAD * RESIDENT FACT_Orders_New;

DROP TABLES FACT_Orders_Existing, FACT_Orders_New;

STORE FACT_Orders INTO [$(vQVDPath)FACT_Orders.qvd] (qvd);
```

---

## 16. System Requirements - דרישות המערכת

### 16.1 מטרות המערכת (System Goals)

**Vision:**
מערכת שמאפשרת בניית מודלי Qlik Sense **באופן אוטומטי או חצי-אוטומטי** ממסמך איפיון סטנדרטי.

**Business Goals:**
- 🎯 הפחתת זמן פיתוח מ-**33 ימים ל-~8 ימים** (75% חיסכון)
- 🎯 סטנדרטיזציה של תהליך הפיתוח
- 🎯 הפחתת שגיאות אנוש
- 🎯 אוטומציה של משימות חוזרות
- 🎯 שמירה על Best Practices (Qlik Israel 2020)

**Technical Goals:**
- ✅ תמיכה ב-Qlik Cloud וב-On-Premise
- ✅ Incremental Load מובנה
- ✅ Data Model Validation אוטומטי
- ✅ Master Items generation
- ✅ GUI/UX אוטומטי או חצי-אוטומטי

### 16.2 Scope - תחום המערכת

**In Scope:**
- ✅ Data Extraction (DB → QVD) - **Phase A הושלם**
- ✅ Data Model Generation (ERD)
- ✅ Load Script Generation (Qlik Script)
- ✅ Master Items (Dimensions + Measures)
- ✅ Basic GUI (Sheets + Charts)
- ✅ Validation & Quality Checks

**Out of Scope (MVP):**
- ❌ Advanced visualizations (Extensions)
- ❌ Qlik NPrinting integration
- ❌ Complex Section Access
- ❌ Real-time streaming
- ❌ Multi-tenant architecture

**Future Enhancements:**
- 🔮 AI-powered dimension mapping
- 🔮 Auto Layout optimization
- 🔮 Performance tuning suggestions
- 🔮 Data quality profiling
- 🔮 Automated testing

### 16.3 User Personas

**Primary User: Qlik Developer/Consultant**
- יש לו איפיון ממולא מהלקוח
- רוצה לבנות מודל מהר
- מכיר Qlik אבל לא רוצה לכתוב הכל ידנית
- צריך שהמערכת תעקוב אחרי Best Practices

**Secondary User: Project Manager**
- רוצה לראות progress
- צריך הערכת זמנים
- רוצה validation reports

**Not Target User:**
- End users (הם משתמשים במודל המוכן)
- Business analysts (הם ממלאים את האיפיון)

### 16.4 System Inputs & Outputs

**Inputs:**
```
1. Specification Document (Word/Excel)
   - מבנה סטנדרטי לפי תבנית
   - ממולא על ידי יועץ + לקוח
   
2. Database Connection
   - Credentials
   - Connection string
   
3. User Preferences
   - Color scheme
   - Language (Hebrew/English)
   - Naming conventions
```

**Outputs:**
```
1. Qlik App (QVF)
   - Load Script
   - Data Model
   - Master Items
   - Sheets & Charts
   
2. Documentation
   - Data dictionary
   - ERD diagram
   - Validation report
   
3. Deployment Package
   - QVF file
   - Connection configs
   - Deployment script
```

### 16.5 System Architecture Decisions

**מה כבר הוחלט (קיים ב-QMB):**
- ✅ **MCP Server** (Model Context Protocol)
- ✅ **TypeScript + Node.js**
- ✅ **Qlik APIs**: @qlik/api + enigma.js
- ✅ **7-Step Wizard** לבניית המודל
- ✅ **ProjectState JSON** כמבנה מרכזי
- ✅ **Incremental Load** מובנה

**מה צריך להחליט:**
- ❓ איך לפרסר את מסמך האיפיון?
  - Python script חיצוני?
  - Node.js module?
  - Claude AI לפרסור?
  
- ❓ איך למפות dimensions?
  - LLM-based (Claude)?
  - Rule-based?
  - Hybrid?
  
- ❓ איך לייצר GUI?
  - Templates מוכנים?
  - AI-generated layouts?
  - User-guided wizard?

---

## 17. System Workflow - תהליך העבודה

### 17.1 High-Level Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. Project Initiation                                   │
│    • יועץ פוגש לקוח                                     │
│    • ממלאים ביחד את תבנית האיפיון                       │
│    • מאשרים Scope + Timeline                            │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 2. Specification Upload                                 │
│    • מעלים את מסמך_אפיון_מפורט.docx למערכת             │
│    • המערכת מזהה את המבנה                               │
│    • Validation ראשוני                                  │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 3. Parsing & Enrichment                                 │
│    • חילוץ טבלאות, שדות, קשרים                         │
│    • Dimension mapping (semi-automatic)                 │
│    • Measure validation                                 │
│    • ERD generation                                     │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 4. Wizard Walkthrough (QMB)                             │
│    • Space setup                                        │
│    • Connection config                                  │
│    • Table/Field selection (pre-filled)                 │
│    • Incremental strategy                               │
│    • Review & approve                                   │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 5. Generation                                           │
│    • Load Script (Qlik)                                 │
│    • Master Items                                       │
│    • Sheets & Charts (basic)                            │
│    • Documentation                                      │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 6. Deploy & Test                                        │
│    • Upload to Qlik Cloud/Server                        │
│    • Initial reload                                     │
│    • Validation tests                                   │
│    • Performance check                                  │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 7. Handoff                                              │
│    • Documentation delivery                             │
│    • Training (if needed)                               │
│    • Support handoff                                    │
└─────────────────────────────────────────────────────────┘
```

### 17.2 Time Estimates

| Phase | Manual (Now) | With System | Savings |
|-------|--------------|-------------|---------|
| Specification | 7 days | 7 days | 0% (same) |
| ETL Development | 12 days | **2 days** ✨ | 83% |
| ERD Building | 5 days | **1 day** ✨ | 80% |
| GUI/UX | 7 days | **3 days** ✨ | 57% |
| Testing | 4 days | **2 days** ✨ | 50% |
| **TOTAL** | **35 days** | **15 days** | **57% faster** |

### 17.3 Methodology Comparison

**Traditional (Qlik Israel 2020):**
```
אפיון-על → התנעה → אפיון מפורט → ETL → ERD → 
GUI → תיקונים → עליה לאוויר → סיכום

⏱️ 33 ימי עבודה
👨‍💻 2-3 מפתחים
📊 100% ידני
```

**With Automation:**
```
אפיון-על → התנעה → אפיון מפורט → 
🤖 Upload to System → 🤖 Generation → 
Review & Adjust → Deploy → סיכום

⏱️ 15 ימי עבודה
👨‍💻 1 מפתח + 🤖 System
📊 70% אוטומטי
```

---

## 18. Open Questions - שאלות פתוחות

### 18.1 Technical Questions

1. **Specification Parser:**
   - בנוי בתוך QMB (TypeScript)?
   - Python script חיצוני?
   - Claude AI API לפרסור?

2. **Dimension Mapping:**
   - LLM prompt engineering?
   - Fuzzy matching + rules?
   - User-in-the-loop confirmation?
   - Cache של mappings?

3. **GUI Generation:**
   - Templates בלבד?
   - AI layout optimization?
   - User review required?

4. **Validation:**
   - Automatic fixes?
   - User approval required?
   - Quality score threshold?

### 18.2 Process Questions

1. **Entry Points:**
   - רק Word/Excel?
   - גם JSON ישיר?
   - גם UI form?

2. **Collaboration:**
   - Multi-user support?
   - Version control?
   - Comments/reviews?

3. **Templates:**
   - Industry-specific templates?
   - Custom templates?
   - Template marketplace?

### 18.3 Business Questions

1. **Pricing Model:**
   - Per project?
   - Subscription?
   - Free tier?

2. **Support:**
   - Self-service?
   - Consulting included?
   - Training required?

3. **Ownership:**
   - Who owns the code?
   - Open source?
   - Enterprise license?

---

## סיכום מעודכן

**מה המסמך הזה:**
- ✅ איפיון של **המערכת** - לא פרויקט ספציפי
- ✅ תיעוד **המתודולוגיה** והתהליך
- ✅ דרישות המערכת (Requirements)
- ✅ ארכיטקטורה (קיים + חסר)
- ✅ תבנית עבודה סטנדרטית

**מה יש:**
- ✅ QMB עובד (Phase A)
- ✅ מתודולוגיה מוכחת (Qlik 2020)
- ✅ תבנית איפיון ברורה
- ✅ דוגמה לאיפיון ממולא (Olist)

**מה צריך להחליט:**
- ❓ איך לפרסר specifications?
- ❓ איך למפות dimensions?
- ❓ איך לייצר GUI?
- ❓ מה רמת האוטומציה?

**הצעד הבא:**
לענות על השאלות הפתוחות ולהחליט על אסטרטגיית היישום.

---

## 13. QA Validation - בדיקות תקינות

### 13.1 בדיקת תקינות לוגית - "No-Go Zone"

**מתבצע ב-Data Model Viewer של Qlik Sense:**

#### 1. Synthetic Keys ⚠️ קריטי!
```
Status: מפתחות צהובים במודל
Impact: ניפוח RAM קריטי
Action: חובה לתקן!
```

**איך לזהות:**
- פתח Data Model Viewer
- חפש טבלאות עם רקע צהוב ($Syn1, $Syn2, etc.)

**איך לתקן:**
```qlik
// Before: Synthetic Key
Table1: LOAD Key1, Key2, Data1 FROM [...];
Table2: LOAD Key1, Key2, Data2 FROM [...];
// Creates $Syn1 with Key1+Key2

// Solution: Composite Key
Table1:
LOAD 
    AutoNumberHash128(Key1, Key2) AS %CompositeKey,
    Data1
FROM [...];

Table2:
LOAD 
    AutoNumberHash128(Key1, Key2) AS %CompositeKey,
    Data2
FROM [...];
```

#### 2. Circular References 🔴 קריטי!
```
Status: קווים אדומים מקווקווים במודל
Impact: עמימות לוגית, תוצאות שגויות
Action: חובה לתקן!
```

#### 3. Subset Ratio - חוזק הקשר
```
Target: 100% במימדים
Minimum: 70% בFacts
```

#### 4. Data Islands - איים של נתונים
```
Status: טבלאות לא מקושרות
Impact: בזבוז משאבים
Exception: טבלאות משתנים/פרמטרים
```

### 13.2 בדיקת ניצול משאבים - "RAM Savers"

#### 1. AutoNumber על מפתחות ✅ חובה!
```
Impact: חיסכון עד 60% ב-RAM של מפתחות
Status: Check all composite keys
```

#### 2. הסרת שדות מיותרים ✅ חובה!
```
Rule: אסור LOAD *
Impact: כל שדה = Symbol Table ב-RAM
```

#### 3. פירוק Timestamps ✅ מומלץ
```
Problem: DateTime field = אינסוף קרדינליות
Solution: Split to Date + Time
```

#### 4. דגלים נומריים vs טקסט
```
Prefer: 0/1
Avoid: 'Yes'/'No', 'True'/'False'
Impact: מספרים יעילים יותר במנוע
```

### 13.3 בדיקת ביצועים - "Speed Factors"

#### 1. QVD Optimized Load ⚡ קריטי!
```
Status: Check in Script Log → "X lines fetched"
Target: "Optimized" message
Rule: רק WHERE EXISTS() מותר!
```

#### 2. ⚠️ Mapping vs Join - הבהרה חשובה!

**⚠️ לפי הוראתך: לעולם לא להשתמש ב-ApplyMap**

```qlik
// ❌ AVOID - ApplyMap (per your instruction)
Mapping_Table:
MAPPING LOAD Key, Value FROM source;

Main:
LOAD 
    *,
    ApplyMap('Mapping_Table', Key, 'Unknown') AS NewField
FROM main_source;

// ✅ PREFERRED - JOIN or KEEP
Main:
LOAD * FROM main_source;

LEFT JOIN (Main)
LOAD Key, Value AS NewField FROM source;
```

**הערה:** 
ApplyMap מהיר ב-RAM אבל יכול ליצור בעיות:
- קשה לדבג
- לא רואים קשרים ב-Data Model Viewer
- בעיות עם NULL handling
- המלצה: השתמש ב-JOIN מפורש

#### 3. Pre-Calculate בסקריפט ✅ מומלץ
```
Problem: חישובים חוזרים ב-UI
Solution: דגלים בוליאניים בסקריפט
Impact: ביצועים פי כמה טובים יותר
```

#### 4. HidePrefix - ניקיון המודל
```
Purpose: הסתרת שדות טכניים
Rule: SET HidePrefix='%';
Usage: כל שדה טכני מתחיל ב-%
```

### 13.4 🔥 שלוש נורות אדומות - טיפול מיידי!

#### 1. Synthetic Keys 🔴 קריטי ביותר!
```
Impact: ניפוח RAM קריטי
Detection: צהוב ב-Data Model Viewer
Fix: Composite Keys עם AutoNumberHash128
```

#### 2. Non-Optimized QVD 🟠 ביצועים
```
Impact: Reload איטי מיותר
Detection: Script Log → "NOT Optimized"
Fix: הסר transformations, השתמש ב-WHERE EXISTS() בלבד
```

#### 3. UI Aggr() Overload 🟡 חוויית משתמש
```
Impact: מסכים איטיים
Detection: ביקורת expressions בcharts
Fix: Pre-calculate בסקריפט, דגלים בוליאניים
```

### 13.5 QA Checklist - לפני Production

```
□ Data Model Viewer נקי (אין צהוב, אין אדום)
□ Subset Ratio > 70% בכל Facts
□ אין Data Islands (מלבד טבלאות משתנים)
□ AutoNumber על כל מפתחות מורכבים
□ אין LOAD * (selective loading בלבד)
□ Timestamps מפורקים (Date + Time נפרדים)
□ דגלים = 0/1 (לא טקסט)
□ QVD Optimized (בדיקה ב-Script Log)
□ אין ApplyMap (השתמש ב-JOIN מפורש)
□ Pre-calculated flags בסקריפט
□ HidePrefix = '%' מוגדר
□ אין Aggr() מיותר ב-UI
□ בדיקת ביצועים עם 10% data
□ Validation מול מערכת מקור
```

---

## סיכום כולל - המסמך המלא

**מה המסמך מכיל:**
1. ✅ מתודולוגיה (Qlik Israel 2020) - 9 שלבים
2. ✅ Data Modeling (Grok + Expert) - 4 שיטות + Decision Tree
3. ✅ QMB Architecture - 7-step wizard + ProjectState
4. ✅ Anti-Patterns - 5 טעויות קריטיות
5. ✅ QA Validation - 3 רמות בדיקה
6. ✅ Performance Optimization - RAM/CPU/Speed
7. ✅ Best Practices - קונבנציות + כללים
8. ✅ Integration Plan - 8 phases

**מוכן לפיתוח! 🚀**
