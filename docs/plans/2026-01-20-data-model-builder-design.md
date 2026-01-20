# QlikModelBuilder - Data Model Builder Design Document

**Date:** 2026-01-20
**Version:** 0.1.0 (In Progress)
**Status:** Brainstorming - 3/~8 sections completed
**Session:** Brainstorming with Claude Code

---

## Document Purpose

This document captures the complete brainstorming session for **Stage 2: Data Model Builder** of Phase B.
It contains all decisions made, reasoning, and design details to allow seamless continuation.

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
  "description": "שני שדות משותפים יוצרים מפתח סינטטי",
  "recommendation": "השתמש ב-QUALIFY או שנה שמות",
  "fix_example": "QUALIFY CustomerID;",
  "best_practice_ref": "נספח ו' - Anti-Patterns",
  "estimated_impact": "מגדיל את גודל המודל, מאט חישובים"
}
```

**Fields Explained:**
- `issue_id`: Unique identifier (category prefix + number)
- `severity`: How critical is this issue
- `category`: Type of issue for filtering/grouping
- `location`: Exact location in code
- `description`: Human-readable explanation (Hebrew)
- `recommendation`: What to do
- `fix_example`: Code example of the fix
- `best_practice_ref`: Reference to documentation
- `estimated_impact`: Expected effect (not measured, estimated)

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
│  │  • הצגת אופציות והמלצות                                  │   │
│  │  • דיאלוג עם המשתמש                                      │   │
│  │  • אישור תיקונים לפני ביצוע                              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

**Three Main Components:**
1. **Input Processor** - Receives JSON from Stage 1 + pulls Sample Data from QVD
2. **Analyzer Engine** - Identifies recommended model type, proposes options
3. **Builder Engine** - Builds the script + automatic QUALIFY

---

### 3.2 Input Processor (COMPLETED)

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

### 3.3 Analyzer Engine (COMPLETED)

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
│  │  IF: Dimension → Dimension relationship             │    │
│  │      → SNOWFLAKE                                     │    │
│  │                                                      │    │
│  │  IF: Fact ←→ Fact relationship (N:M)                │    │
│  │      → LINK TABLE needed                             │    │
│  │                                                      │    │
│  │  IF: Multiple Facts with same dimensions            │    │
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
      "pros": ["שומר על היררכיה טבעית", "קל לתחזוקה"],
      "cons": ["יותר JOINs", "מעט יותר איטי"]
    }
  ],
  "classifications": {
    "facts": ["Orders", "Returns"],
    "dimensions": ["Customers", "Products", "Geography"]
  }
}
```

---

## 4. Sections Still To Design

The following sections need to be designed in the next session:

### 4.1 Builder Engine (NOT STARTED)
- How Qlik script is generated
- QUALIFY/UNQUALIFY logic
- AutoNumber key generation
- Calendar table auto-creation

### 4.2 Review Loop Details (NOT STARTED)
- Exact prompts sent to Gemini
- How feedback is parsed
- How fixes are proposed to user

### 4.3 User Dialogue Flow (NOT STARTED)
- Conversation flow examples
- How options are presented
- How user approves/rejects

### 4.4 Scope Guard Implementation (NOT STARTED)
- How to detect non-code requests
- What happens when abuse detected
- Rate limiting considerations

### 4.5 Error Handling (NOT STARTED)
- What if Gemini API fails
- What if Claude can't fix an issue
- Rollback mechanisms

### 4.6 Integration with Stage 1 & 3 (NOT STARTED)
- Exact JSON schema between stages
- Handoff protocol
- State persistence

---

## 5. Q&A Summary

All questions asked and answers received during brainstorming:

| # | Question | Answer |
|---|----------|--------|
| 1 | מה לברינסטורם? | Data Model Builder (Stage 2) |
| 2 | מה האתגר העיקרי? | כל הנ"ל כחבילה (זיהוי Fact/Dim, קשרים, Anti-Patterns) |
| 3 | אילו סוגי מודלים? | Star + Snowflake + Link Tables + Concatenated Facts |
| 4 | איך בוחרים מודל? | משתמש בוחר - מערכת מסבירה אופציות, יתרונות, חסרונות, המלצה + דיאלוג |
| 5 | מה ה-Input? | JSON + QVD Sample Data (אחרי DB Load) |
| 6 | איפה השיחה מתנהלת? | VSCode + Chat (Claude Code + Gemini) |
| 7 | איך עובד AI ב-On-Prem? | API לשניהם - Claude בונה, Gemini בודק |
| 8 | מתי נגמר הדיאלוג Claude-Gemini? | 1 אוטומטי, 2-3 עם נימוק, 4+ HITL + Scope Guard |
| 9 | מה Gemini בודק? | הכל - Syntax, Best Practices, Anti-Patterns, Model Size |
| 10 | איך מדורגות בעיות? | JSON מובנה לכל בעיה |
| 11 | מה קורה בתיקון? | Claude מציג מה יתקן, משתמש מאשר לפני ביצוע |

---

## 6. Open Questions

Questions that came up but weren't fully resolved:

1. **Stage 1 Enhancement:** Should Stage 1 also do initial field mapping? (User suggested yes)
2. **Cardinality Thresholds:** Is 10K the right threshold for Fact vs Dimension?
3. **QVD Sample Size:** Is 100 rows enough for analysis?
4. **Confidence Score Calculation:** How exactly is confidence calculated?

---

## 7. Next Steps

To continue this brainstorming session:

1. **Read this document** to restore context
2. **Continue from Section 4.1** - Builder Engine design
3. **Complete remaining sections** (4.2 - 4.6)
4. **Validate complete design** with user
5. **Write final design document**
6. **Optionally:** Create implementation plan with /write-plan

---

## 8. Technical Notes

### Cloud vs On-Prem Differences

| Aspect | Cloud | On-Prem |
|--------|-------|---------|
| **Limit** | Model SIZE | RAM |
| **AI Access** | Claude + Gemini API | Claude + Gemini API (both available) |
| **Performance Testing** | Not possible | Not possible |
| **Best Practices** | Apply always | Apply always |

### Key Best Practices Referenced

From PHASE_B_SPEC.md and KNOWLEDGE_BASE.md:
- QUALIFY * except keys - prevents Synthetic Keys
- AutoNumber on all composite keys - 60% RAM savings
- Star Schema as default - unless proven otherwise
- No LOAD * - selective field loading
- No Circular References - use QUALIFY/Rename

---

## Appendix A: Complete Review Loop Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    COMPLETE REVIEW LOOP                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  ROUND 1: AUTOMATIC                                  │    │
│  │  ────────────────────────────────────────────────    │    │
│  │  1. Claude receives model spec                       │    │
│  │  2. Claude builds Qlik script                        │    │
│  │  3. Script sent to Gemini                            │    │
│  │  4. Gemini reviews (Syntax, BP, AP, Size)            │    │
│  │  5. Gemini returns issues[] as JSON                  │    │
│  │  6. Claude shows results to user                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                          ↓                                   │
│              User satisfied? ──YES──→ END                    │
│                          ↓ NO                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  ROUNDS 2-3: WITH JUSTIFICATION                      │    │
│  │  ────────────────────────────────────────────────    │    │
│  │  1. User must explain WHY another round needed       │    │
│  │  2. Claude proposes fixes based on issues            │    │
│  │  3. Claude shows: "I will fix: [list]"               │    │
│  │  4. User approves fix list                           │    │
│  │  5. Claude applies fixes                             │    │
│  │  6. New script sent to Gemini                        │    │
│  │  7. Repeat until satisfied or round 3 complete       │    │
│  └─────────────────────────────────────────────────────┘    │
│                          ↓                                   │
│              User satisfied? ──YES──→ END                    │
│                          ↓ NO                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  ROUND 4+: HITL (Human In The Loop)                  │    │
│  │  ────────────────────────────────────────────────    │    │
│  │  1. User must manually approve EACH round            │    │
│  │  2. System warns: "This requires manual approval"    │    │
│  │  3. Each fix requires explicit confirmation          │    │
│  │  4. Full audit trail maintained                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ⚠️ SCOPE GUARD: At any point, if request is not            │
│     code-related, system rejects with explanation            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Appendix B: Issue Severity Definitions

| Severity | Definition | Examples | Action |
|----------|------------|----------|--------|
| **critical** | Must fix - will cause failure or major problems | Synthetic Key, Circular Reference, Syntax Error | Block until fixed |
| **warning** | Should fix - causes performance/maintenance issues | LOAD *, Missing AutoNumber, Snowflake >4 levels | Recommend fix |
| **info** | Nice to fix - minor improvements | Missing comments, Naming convention | Optional |

---

## Appendix C: Category Definitions

| Category | Description | Examples |
|----------|-------------|----------|
| **syntax** | Code won't run | Missing semicolon, Invalid function |
| **anti-pattern** | Known bad practices | Synthetic Keys, Circular Refs, God Tables |
| **best-practice** | Not following standards | No QUALIFY, Missing AutoNumber, LOAD * |
| **model-size** | Will cause large model | High cardinality Link Table, Too many fields |

---

**Document End**

Last Updated: 2026-01-20
Session Status: Paused at Section 3.3 (Analyzer Engine)
Next: Continue with Section 4.1 (Builder Engine)
