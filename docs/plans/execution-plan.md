# QlikModelBuilder - Execution Plan v2

**תאריך עדכון:** 2026-01-16
**סטטוס:** ממתין לאישור

---

## Overview - ה-FLOW האמיתי

```
STEP 1: Parse Spec → Full JSON (tables, fields, relationships, formulas, business rules)
STEP 2: Create Space + Permissions
STEP 3: Create Application
STEP 4: Create Connection(s) - DB + Files
STEP 5: Wizard - Choose mode (All / Spec / Manual)
STEP 6: Incremental Config per table
STEP 7: Generate Script
STEP 8: Run + Schedule
```

---

## Phase 1: Full Spec Parsing & Persistence

### Task 1.1: Define ProjectSpec Interface
**File:** `src/types/ProjectSpec.ts`
**Dependencies:** None

**Interface:**
```typescript
interface ProjectSpec {
  // Metadata
  version: string;
  createdAt: string;
  updatedAt: string;
  sourceFile: string;

  // Tables
  tables: TableSpec[];

  // Relationships
  relationships: RelationshipSpec[];

  // Business Rules
  businessRules: BusinessRule[];

  // Formulas
  formulas: FormulaSpec[];

  // Qlik Config
  qlikConfig: QlikConfig;

  // User Selections
  userSelections: UserSelections;
}

interface TableSpec {
  name: string;
  type: 'Fact' | 'Dimension' | 'Bridge' | 'Unknown';
  description: string;
  rowCount?: number;
  keyField?: string;
  incrementalField?: string;
  fields: FieldSpec[];
}

interface FieldSpec {
  name: string;
  dataType?: string;
  keyType: 'PK' | 'BK' | 'FK' | null;
  description?: string;
  include: boolean;
  rename?: string;
}

interface RelationshipSpec {
  id: string;
  sourceTable: string;
  sourceField: string;
  targetTable: string;
  targetField: string;
  cardinality: '1:1' | '1:M' | 'M:1' | 'M:M';
  isRequired: boolean;
  description?: string;
}

interface BusinessRule {
  id: string;
  name: string;
  description: string;
  affectedTables: string[];
  formula?: string;
}

interface FormulaSpec {
  name: string;
  expression: string;
  description?: string;
  type: 'measure' | 'dimension' | 'calculated_field';
}

interface QlikConfig {
  tenantUrl?: string;
  spaceId?: string;
  spaceName?: string;
  appId?: string;
  appName?: string;
  connections: ConnectionConfig[];
}

interface ConnectionConfig {
  id?: string;
  name: string;
  type: 'database' | 'datafiles' | 'rest';
  connectionString?: string;
  path?: string;
}

interface UserSelections {
  mode: 'all' | 'spec' | 'manual';
  selectedTables: string[];
  incrementalConfig: Record<string, IncrementalConfig>;
}

interface IncrementalConfig {
  enabled: boolean;
  strategy: 'full' | 'insert_only' | 'insert_update' | 'time_window';
  field: string;
  keepHistory: boolean;
}
```

**Acceptance:**
- [ ] File exists at `src/types/ProjectSpec.ts`
- [ ] All interfaces exported
- [ ] Compiles without errors

---

### Task 1.2: Update Spec Parsers to Return Full ProjectSpec
**Files:** `src/wizardPanel.ts`
**Dependencies:** Task 1.1

**Actions:**
1. Update `parseExcelSpec()` to extract relationships if present
2. Update `parseCSVSpec()` to handle relationship CSV files
3. Update `parseDocumentSpec()` AI prompt to return full schema:
   - Tables + fields
   - Relationships
   - Business rules
   - Formulas

**AI Prompt Update:**
```
Extract from this document:
1. Tables with fields (name, type: Fact/Dimension, key fields)
2. Relationships between tables (source, target, cardinality)
3. Business rules/requirements
4. Formulas/calculations mentioned

Return as JSON with structure:
{ tables: [...], relationships: [...], businessRules: [...], formulas: [...] }
```

**Acceptance:**
- [ ] `parseExcelSpec()` returns `ProjectSpec`
- [ ] `parseCSVSpec()` returns `ProjectSpec`
- [ ] `parseDocumentSpec()` returns `ProjectSpec` with all sections
- [ ] Compiles without errors

---

### Task 1.3: Create ProjectManager for Persistence
**File:** `src/state/ProjectManager.ts`
**Dependencies:** Task 1.1

**Actions:**
```typescript
export class ProjectManager {
  private static readonly PROJECT_KEY = 'qlikModelBuilder.project';

  constructor(private context: vscode.ExtensionContext) {}

  // Save full project to disk
  async save(project: ProjectSpec): Promise<void>;

  // Load project from disk
  async load(): Promise<ProjectSpec | null>;

  // Export to JSON file
  async exportToFile(filePath: string): Promise<void>;

  // Import from JSON file
  async importFromFile(filePath: string): Promise<ProjectSpec>;

  // Clear project
  async clear(): Promise<void>;
}
```

**Acceptance:**
- [ ] File exists at `src/state/ProjectManager.ts`
- [ ] All methods implemented
- [ ] Uses VS Code globalState for persistence
- [ ] Compiles without errors

---

## Phase 2: Space & Permissions

### Task 2.1: Add Space Creation API
**File:** `src/qlikApi.ts`
**Dependencies:** None

**Actions:**
```typescript
// Add to QlikApi class:

async createSpace(name: string, type: 'shared' | 'managed' = 'shared'): Promise<Space>;

async assignSpaceRole(
  spaceId: string,
  userId: string,
  role: 'owner' | 'producer' | 'consumer'
): Promise<void>;

async getCurrentUserId(): Promise<string>;
```

**Acceptance:**
- [ ] `createSpace()` creates space via Qlik API
- [ ] `assignSpaceRole()` grants permissions
- [ ] `getCurrentUserId()` returns logged-in user
- [ ] Compiles without errors

---

### Task 2.2: Add Space Creation Step to Wizard
**File:** `src/wizardPanel.ts`
**Dependencies:** Task 2.1

**UI:**
```
┌─────────────────────────────────────────────┐
│  STEP 2: יצירת Space                        │
├─────────────────────────────────────────────┤
│                                             │
│  ○ בחר Space קיים                           │
│    [Dropdown: existing spaces]              │
│                                             │
│  ● צור Space חדש                            │
│    שם: [________________]                   │
│    סוג: ○ Shared  ○ Managed                 │
│                                             │
│  [צור Space]                                │
│                                             │
│  ✓ הרשאות מלאות יינתנו אוטומטית             │
│                                             │
└─────────────────────────────────────────────┘
```

**Acceptance:**
- [ ] Can select existing space
- [ ] Can create new space
- [ ] Permissions granted automatically
- [ ] Space ID saved to ProjectSpec

---

## Phase 3: Application Creation

### Task 3.1: Add App Creation API
**File:** `src/qlikApi.ts`
**Dependencies:** Task 2.1

**Actions:**
```typescript
async createApp(name: string, spaceId: string): Promise<App>;

async getApp(appId: string): Promise<App>;

async updateAppScript(appId: string, script: string): Promise<void>;
```

**Acceptance:**
- [ ] `createApp()` creates app in specified space
- [ ] `updateAppScript()` uploads script to app
- [ ] Compiles without errors

---

### Task 3.2: Add App Creation Step to Wizard
**File:** `src/wizardPanel.ts`
**Dependencies:** Task 3.1

**UI:**
```
┌─────────────────────────────────────────────┐
│  STEP 3: יצירת Application                  │
├─────────────────────────────────────────────┤
│                                             │
│  שם האפליקציה: [________________]           │
│  (ברירת מחדל: שם מהאיפיון)                  │
│                                             │
│  Space: Production (from step 2)            │
│                                             │
│  [צור אפליקציה]                             │
│                                             │
└─────────────────────────────────────────────┘
```

**Acceptance:**
- [ ] App name field with default from spec
- [ ] Shows selected space
- [ ] Creates app and saves ID to ProjectSpec

---

## Phase 4: Connection Management

### Task 4.1: Add Connection Creation API
**File:** `src/qlikApi.ts`
**Dependencies:** Task 2.1

**Actions:**
```typescript
interface ConnectionCreateParams {
  name: string;
  type: 'database' | 'datafiles';
  spaceId: string;
  // For database:
  connectionString?: string;
  // For datafiles:
  path?: string;
}

async createConnection(params: ConnectionCreateParams): Promise<Connection>;

async testConnection(connectionId: string): Promise<boolean>;

async listConnections(spaceId: string): Promise<Connection[]>;
```

**Acceptance:**
- [ ] `createConnection()` for DB and DataFiles
- [ ] `testConnection()` validates connection
- [ ] `listConnections()` returns connections in space
- [ ] Compiles without errors

---

### Task 4.2: Add Connection Step to Wizard
**File:** `src/wizardPanel.ts`
**Dependencies:** Task 4.1

**UI:**
```
┌─────────────────────────────────────────────┐
│  STEP 4: חיבורים                            │
├─────────────────────────────────────────────┤
│                                             │
│  📊 מקור נתונים (Database)                  │
│  ├─ ○ בחר קיים: [Dropdown]                 │
│  └─ ● צור חדש:                              │
│       שם: [SalesDB___________]              │
│       סוג: [SQL Server ▼]                   │
│       Connection String: [__________]       │
│       [בדוק חיבור] ✓                        │
│                                             │
│  📁 קבצים מקומיים (DataFiles)               │
│  ├─ ☑ יש קבצים מקומיים                     │
│  └─ נתיב: [lib://DataFiles/____]           │
│                                             │
│  [הבא →]                                    │
│                                             │
└─────────────────────────────────────────────┘
```

**Acceptance:**
- [ ] Can select existing or create new DB connection
- [ ] Can add DataFiles connection
- [ ] Test connection button works
- [ ] Multiple connections supported

---

## Phase 5: Wizard - Selection Mode

### Task 5.1: Add Selection Mode UI
**File:** `src/wizardPanel.ts`
**Dependencies:** Task 1.2

**UI:**
```
┌─────────────────────────────────────────────┐
│  STEP 5: בחירת טבלאות ושדות                 │
├─────────────────────────────────────────────┤
│                                             │
│  מצב עבודה:                                 │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ (A) כל הטבלאות                      │   │
│  │     משיכת כל הדאטה מהמקור           │   │
│  │     9 טבלאות, ~52 שדות              │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ (B) לפי האיפיון                     │   │
│  │     רק מה שמוגדר בקובץ האיפיון      │   │
│  │     9 טבלאות, 47 שדות נבחרים        │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ (C) ידני + חיווי                    │   │
│  │     בחירה ידנית עם הצגת האיפיון    │   │
│  └─────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

**Acceptance:**
- [ ] Three modes visible: All / Spec / Manual
- [ ] Each mode shows count preview
- [ ] Selection saved to `userSelections.mode`

---

### Task 5.2: Implement Manual Mode with Spec Hints
**File:** `src/wizardPanel.ts`
**Dependencies:** Task 5.1

**UI for Manual Mode:**
```
┌─────────────────────────────────────────────┐
│  טבלאות ושדות                               │
├─────────────────────────────────────────────┤
│  [🔍 חיפוש...]                              │
│                                             │
│  ☑ olist_orders_dataset (Fact) ★ באיפיון   │
│    ├─ ☑ order_id (PK)                      │
│    ├─ ☑ customer_id (FK)                   │
│    ├─ ☐ order_status                       │
│    └─ ...                                   │
│                                             │
│  ☑ olist_customers_dataset (Dim) ★ באיפיון │
│    ├─ ☑ customer_id (PK)                   │
│    └─ ...                                   │
│                                             │
│  ☐ some_other_table                        │
│    (לא מופיע באיפיון)                       │
│                                             │
│  Legend: ★ = מופיע באיפיון                  │
│                                             │
└─────────────────────────────────────────────┘
```

**Acceptance:**
- [ ] Tables from spec marked with ★
- [ ] Fields from spec pre-selected
- [ ] Non-spec tables shown but not selected
- [ ] Search/filter works

---

## Phase 6: Incremental Configuration

### Task 6.1: Enhanced Incremental UI
**File:** `src/wizardPanel.ts`
**Dependencies:** Task 5.2

**UI:**
```
┌─────────────────────────────────────────────┐
│  STEP 6: הגדרות Incremental                 │
├─────────────────────────────────────────────┤
│                                             │
│  olist_orders_dataset (Fact)                │
│  ├─ ☑ Incremental Load                      │
│  ├─ Strategy: [Insert + Update ▼]           │
│  ├─ Field: [order_approved_at ▼]           │
│  └─ 💡 המלצה: by_date (יש תאריך עדכון)     │
│                                             │
│  olist_customers_dataset (Dimension)        │
│  ├─ ☐ Incremental Load                      │
│  └─ 💡 המלצה: Full Reload (מימד קטן)       │
│                                             │
│  [החל על כל ה-Facts] [החל על כל ה-Dims]    │
│                                             │
└─────────────────────────────────────────────┘
```

**Acceptance:**
- [ ] Suggestions based on table type (Fact/Dim)
- [ ] Bulk apply buttons
- [ ] Shows recommended strategy with explanation

---

## Phase 7: Script Generation

### Task 7.1: Enhanced Script Generator
**File:** `src/scriptGenerator.ts` (new)
**Dependencies:** Task 6.1

**Actions:**
```typescript
export class ScriptGenerator {
  generate(project: ProjectSpec): string {
    let script = '';

    // 1. Variables
    script += this.generateVariables(project);

    // 2. Connections
    script += this.generateConnections(project);

    // 3. For each table
    for (const table of project.tables) {
      if (table.incremental.enabled) {
        script += this.generateIncrementalLoad(table);
      } else {
        script += this.generateFullLoad(table);
      }
    }

    return script;
  }

  private generateIncrementalLoad(table: TableSpec): string;
  private generateFullLoad(table: TableSpec): string;
  private generateVariables(project: ProjectSpec): string;
  private generateConnections(project: ProjectSpec): string;
}
```

**Output Example:**
```qlik
// ============================================
// Auto-generated by QlikModelBuilder
// Project: Olist E-commerce
// Generated: 2026-01-16
// ============================================

// Variables
LET vQVDPath = 'lib://DataFiles/QVD/';
LET vLastReload = Now();

// ============================================
// olist_orders_dataset (Fact - Incremental)
// ============================================
LET vQVDFile = '$(vQVDPath)olist_orders_dataset.qvd';

IF NOT IsNull(FileSize('$(vQVDFile)')) THEN
  // Incremental: Load only new records
  LET vMaxDate = Peek('order_approved_at', 0, 'LastLoad_olist_orders');

  olist_orders_dataset:
  LOAD * FROM [$(vQVDFile)] (qvd);

  Concatenate(olist_orders_dataset)
  LOAD *
  FROM [lib://SalesDB/olist_orders_dataset]
  WHERE order_approved_at > '$(vMaxDate)';
ELSE
  // First load: Full extract
  olist_orders_dataset:
  LOAD *
  FROM [lib://SalesDB/olist_orders_dataset];
END IF

STORE olist_orders_dataset INTO [$(vQVDFile)] (qvd);
```

**Acceptance:**
- [ ] Generates valid Qlik script
- [ ] Handles incremental patterns correctly
- [ ] Includes IF EXISTS check for QVD
- [ ] Proper LIB references

---

## Phase 8: Run & Schedule

### Task 8.1: Add Reload & Automation APIs
**File:** `src/qlikApi.ts`
**Dependencies:** Task 3.1

**Actions:**
```typescript
async reloadApp(appId: string): Promise<ReloadResult>;

async getReloadStatus(reloadId: string): Promise<ReloadStatus>;

async createAutomation(params: AutomationParams): Promise<Automation>;

interface AutomationParams {
  name: string;
  appId: string;
  schedule: {
    type: 'daily' | 'weekly' | 'monthly' | 'cron';
    time?: string;
    dayOfWeek?: number;
    cronExpression?: string;
  };
}
```

**Acceptance:**
- [ ] `reloadApp()` triggers app reload
- [ ] `getReloadStatus()` checks reload progress
- [ ] `createAutomation()` sets up schedule
- [ ] Compiles without errors

---

### Task 8.2: Add Run & Schedule UI
**File:** `src/wizardPanel.ts`
**Dependencies:** Task 8.1

**UI:**
```
┌─────────────────────────────────────────────┐
│  STEP 8: הרצה ותזמון                        │
├─────────────────────────────────────────────┤
│                                             │
│  סקריפט הועלה לאפליקציה ✓                   │
│                                             │
│  [▶ הרץ עכשיו]                              │
│                                             │
│  סטטוס: ⏳ טוען... (45%)                    │
│  ████████░░░░░░░░                           │
│                                             │
│  ─────────────────────────────────────────  │
│                                             │
│  תזמון:                                      │
│  ☑ הפעל תזמון אוטומטי                       │
│                                             │
│  תדירות: [יומי ▼]                           │
│  שעה: [02:00 ▼]                             │
│                                             │
│  [צור תזמון]                                │
│                                             │
│  ─────────────────────────────────────────  │
│                                             │
│  ✅ הושלם בהצלחה!                           │
│  [פתח באפליקציה] [סיום]                     │
│                                             │
└─────────────────────────────────────────────┘
```

**Acceptance:**
- [ ] Run Now button triggers reload
- [ ] Progress bar shows reload status
- [ ] Schedule options (daily/weekly/monthly)
- [ ] Creates automation in Qlik

---

## Execution Order

```
Phase 1 (Spec & Persistence):
  1.1 → 1.2 → 1.3
       ↓
Phase 2 (Space):
  2.1 → 2.2
       ↓
Phase 3 (App):
  3.1 → 3.2
       ↓
Phase 4 (Connection):
  4.1 → 4.2
       ↓
Phase 5 (Selection):
  5.1 → 5.2
       ↓
Phase 6 (Incremental):
  6.1
       ↓
Phase 7 (Script):
  7.1
       ↓
Phase 8 (Run):
  8.1 → 8.2
```

---

## Files Summary

| Phase | New Files | Modified Files |
|-------|-----------|----------------|
| 1 | `src/types/ProjectSpec.ts`, `src/state/ProjectManager.ts` | `src/wizardPanel.ts` |
| 2 | - | `src/qlikApi.ts`, `src/wizardPanel.ts` |
| 3 | - | `src/qlikApi.ts`, `src/wizardPanel.ts` |
| 4 | - | `src/qlikApi.ts`, `src/wizardPanel.ts` |
| 5 | - | `src/wizardPanel.ts` |
| 6 | - | `src/wizardPanel.ts` |
| 7 | `src/scriptGenerator.ts` | - |
| 8 | - | `src/qlikApi.ts`, `src/wizardPanel.ts` |

---

## Testing with Real Data

**Use Olist specification:**
- Tables: `docs/Olist_Tables_Summary.csv` (9 tables)
- Relationships: `docs/Olist_Relationships.csv` (9 relationships)

**Test scenarios:**
1. Parse Olist spec → verify 9 tables, 9 relationships extracted
2. Create Space → verify permissions granted
3. Create App → verify app exists in Qlik
4. Mode A (All) → verify all 9 tables selected
5. Mode B (Spec) → verify only spec fields selected
6. Generate script → verify valid Qlik syntax
7. Run → verify successful reload

---

## Notes for Implementation

1. **Always save state** - After each step, persist to ProjectManager
2. **Never invent data** - Use real Olist spec for testing
3. **Ask before action** - Get approval before API calls
4. **Show progress** - User should always know current step
5. **Handle errors** - Graceful error messages in Hebrew

---

## Testing Strategy

### Available Testing Tools

| Tool | Purpose | Location |
|------|---------|----------|
| vscode-extension-tester | VS Code UI automation | `test/ui/wizard.test.ts` |
| Playwright | Browser/Webview testing | `test/playwright/` |
| Mocha + Chai | Unit tests | `src/test/suite/` |
| Real Spec Data | Test fixtures | `docs/Olist_*.csv` |

### Testing Layers

```
LAYER 1: Unit Tests (Mocha)
• Test individual functions in isolation
• Fast, no VS Code needed
• Run: npm test

LAYER 2: Integration Tests (vscode-extension-tester)
• Test VS Code extension commands
• Webview interactions
• Run: npm run test:ui

LAYER 3: E2E Tests (Playwright + Mock API)
• Full flow simulation
• Mock Qlik API responses
• Run: npx playwright test

LAYER 4: Live API Tests (Manual/Supervised)
• Real Qlik Cloud connection
• Requires human approval
• Run: npm run test:live
```

---

## Test Plan per Phase

### Phase 1 Tests - Spec Parsing

**Unit Tests:** `test/unit/projectSpec.test.ts`
```typescript
describe('ProjectSpec Parsing', () => {
  const tablesCSV = 'docs/Olist_Tables_Summary.csv';
  const relationsCSV = 'docs/Olist_Relationships.csv';

  it('should parse 9 tables from Olist spec', () => {
    const result = parseCSVSpec(tablesCSV);
    expect(result.tables).to.have.length(9);
  });

  it('should parse 9 relationships', () => {
    const result = parseRelationshipsCSV(relationsCSV);
    expect(result.relationships).to.have.length(9);
  });

  it('should identify 4 Fact + 5 Dimension tables', () => {
    const result = parseCSVSpec(tablesCSV);
    expect(result.tables.filter(t => t.type === 'Fact')).to.have.length(4);
    expect(result.tables.filter(t => t.type === 'Dimension')).to.have.length(5);
  });
});
```

**Success:** `npm test` passes, 9 tables, 9 relationships parsed
**Limitation:** AI parsing (Word) requires API keys

---

### Phase 2 Tests - Space Creation

**Unit Tests:** Mock API
```typescript
it('should create space with correct payload', async () => {
  const mockFetch = sinon.stub(global, 'fetch');
  mockFetch.resolves({ ok: true, json: () => ({ id: 'space-123' }) });

  const result = await qlikApi.createSpace('TestSpace', 'shared');
  expect(result.id).to.equal('space-123');
});
```

**UI Tests:**
```typescript
it('Should show space creation form', async () => {
  const webview = new WebView();
  await webview.switchToFrame();
  const createBtn = await webview.findWebElement({ id: 'btnCreateSpace' });
  expect(await createBtn.isDisplayed()).to.be.true;
});
```

**Success:** API payload correct, UI form works
**Limitation:** Real API requires Qlik credentials

---

### Phase 5 Tests - Selection Mode

**UI Tests:**
```typescript
it('Should show three mode options', async () => {
  const modeAll = await webview.findWebElement({ id: 'modeAll' });
  const modeSpec = await webview.findWebElement({ id: 'modeSpec' });
  const modeManual = await webview.findWebElement({ id: 'modeManual' });
  expect(await modeAll.isDisplayed()).to.be.true;
});

it('Mode B should select 9 tables from Olist spec', async () => {
  await modeSpec.click();
  const count = await webview.findWebElement({ id: 'selectedCount' });
  expect(await count.getText()).to.include('9');
});
```

**Success:** 3 modes visible, Mode B selects 9 tables

---

### Phase 7 Tests - Script Generation

**Unit Tests:**
```typescript
it('should generate valid Qlik script', () => {
  const project = createOlistProject();
  const script = new ScriptGenerator().generate(project);

  expect(script).to.include('LET vQVDPath');
  expect(script).to.include('olist_orders_dataset:');
  expect(script).to.include('STORE');
});

it('should generate IF EXISTS for incremental', () => {
  const script = generateIncrementalScript(table);
  expect(script).to.include('IF NOT IsNull(FileSize');
  expect(script).to.include('Concatenate');
});
```

**Success:** Valid Qlik syntax, correct incremental pattern

---

## Subagent Execution Strategy

```
MAIN AGENT (Orchestrator)
│
├──→ SUBAGENT: Task 1.1
│    ├─ Write code
│    ├─ Run: npm run compile
│    ├─ Run: npm test
│    └─ Return: ✅/❌
│
├──→ SUBAGENT: Task 1.2
│    ├─ Write code
│    ├─ Run: npm run compile && npm test
│    └─ Return: ✅/❌
│
├──→ ... (fresh subagent per task)
│
└──→ SUBAGENT: E2E Validation
     ├─ Run: npm run test:ui
     └─ Report full results
```

### Test Commands

| When | Command |
|------|---------|
| After every code change | `npm run compile` |
| After every task | `npm run compile && npm test` |
| After UI changes | `npm run compile && npm test && npm run test:ui` |
| After phase complete | Full suite + Playwright |

---

## Limitations & Blockers

| Limitation | Mitigation |
|------------|------------|
| No real Qlik Cloud in CI | Use mocks for automated tests |
| AI API keys required | Skip Word parsing in CI |
| VS Code UI tests slow (~60s) | Run only on significant changes |
| No Windows GUI in CI | Use xvfb on Linux |

---

## Success Definition

| Phase | Success = ALL pass |
|-------|---------------------|
| 1 | 9 tables + 9 relationships parsed from Olist |
| 2 | Space form visible + mock API works |
| 3 | App created in mock + ID saved |
| 4 | Connection test returns status |
| 5 | 3 modes work + correct counts (9 tables in Mode B) |
| 6 | Correct suggestions per table type |
| 7 | Valid Qlik script generated |
| 8 | Reload progress shows + schedule created |
