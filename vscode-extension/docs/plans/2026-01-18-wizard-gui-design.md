# Wizard GUI Design Document

> **Date:** 2026-01-18
> **Status:** Approved
> **Approach:** TDD (Test-Driven Development)

## Overview

7-Step Wizard for creating Qlik applications from data sources. Follows TDD approach - tests first, then implementation.

## Wizard Steps

| Step | Name | Purpose |
|------|------|---------|
| 1 | Entry Point | Choose: Spec file / Template / Start from scratch |
| 2 | Space Selection | Select Qlik Cloud space for the app |
| 3 | Data Source | Configure database/REST/files connection |
| 4 | Table Selection | Choose tables to include in model |
| 5 | Field Mapping | Configure fields, keys, relationships |
| 6 | Incremental Config | Set up incremental load settings |
| 7 | Deploy | Generate script, create app, reload |

---

## Part 1: Test Structure

```
test/
├── docker/
│   └── e2e-gui.spec.ts          # Existing 16 GUI tests
├── wizard/                       # NEW - Wizard tests
│   ├── wizard.smoke.spec.ts     # Level 0: Smoke Test
│   ├── step1-entry.spec.ts      # Step 1: Entry Point
│   ├── step2-space.spec.ts      # Step 2: Space Selection
│   ├── step3-source.spec.ts     # Step 3: Data Source
│   ├── step4-tables.spec.ts     # Step 4: Table Selection
│   ├── step5-fields.spec.ts     # Step 5: Field Mapping
│   ├── step6-incremental.spec.ts# Step 6: Incremental Config
│   ├── step7-deploy.spec.ts     # Step 7: Deploy
│   └── wizard-state.spec.ts     # State Management
└── e2e/
    └── full-e2e-real-flow.test.ts  # Existing E2E (API)
```

### Test Levels

| Level | Type | What it tests |
|-------|------|---------------|
| 0 | Smoke | Wizard opens, navigation works, state persists |
| 1 | Unit | Each step's logic in isolation |
| 2 | Integration | Step transitions, data flow between steps |
| 3 | E2E | Full wizard flow with real Qlik Cloud |

---

## Part 2: Smoke Test (Level 0)

```typescript
// test/wizard/wizard.smoke.spec.ts
describe('Wizard Smoke Test', () => {

  test('Wizard opens with Step 1 visible', async () => {
    // 1. Run command: qmb.openWizard
    // 2. Expect: Wizard panel opens
    // 3. Expect: Step 1 (Entry Point) is displayed
    // 4. Expect: Progress bar shows step 1 active
  });

  test('Navigation: Next button advances to Step 2', async () => {
    // 1. Open wizard
    // 2. Select an entry point option
    // 3. Click "Next"
    // 4. Expect: Step 2 (Space Selection) is displayed
    // 5. Expect: Progress bar shows step 2 active
  });

  test('Navigation: Back button returns to Step 1', async () => {
    // 1. Be on Step 2
    // 2. Click "Back"
    // 3. Expect: Step 1 is displayed
    // 4. Expect: Previous selection is preserved
  });

  test('State: Selection persists across navigation', async () => {
    // 1. On Step 1, select "Start from scratch"
    // 2. Navigate to Step 2
    // 3. Navigate back to Step 1
    // 4. Expect: "Start from scratch" is still selected
  });

});
```

### Smoke Test Success Criteria

- [ ] `qmb.openWizard` command opens the wizard panel
- [ ] Step 1 renders without errors
- [ ] Next/Back navigation works
- [ ] State persists during navigation
- [ ] No console errors

---

## Part 3: State Management

```typescript
// src/state/WizardState.ts

interface WizardState {
  // Navigation
  currentStep: 1 | 2 | 3 | 4 | 5 | 6 | 7;

  // Step 1: Entry Point
  entryPoint: 'spec' | 'template' | 'scratch' | null;
  specFile?: string;
  parsedTables?: TableDef[];

  // Step 2: Space Selection
  selectedSpaceId: string | null;
  selectedSpaceName?: string;

  // Step 3: Data Source
  selectedConnectionId: string | null;
  connectionType?: 'database' | 'rest' | 'files';

  // Step 4: Table Selection
  selectedTables: string[];

  // Step 5: Field Mapping
  fieldMappings: Map<string, FieldMapping[]>;

  // Step 6: Incremental Config
  incrementalConfig: Map<string, IncrementalConfig>;

  // Step 7: Deploy
  generatedScript?: string;
  createdAppId?: string;
}

// Supporting interfaces
interface TableDef {
  name: string;
  schema?: string;
  columns: ColumnDef[];
}

interface ColumnDef {
  name: string;
  type: string;
  nullable: boolean;
}

interface FieldMapping {
  sourceField: string;
  targetField: string;
  isKey: boolean;
  transformation?: string;
}

interface IncrementalConfig {
  tableName: string;
  enabled: boolean;
  keyField?: string;
  timestampField?: string;
  mode: 'append' | 'upsert' | 'full';
}
```

### State Persistence

- Use `context.globalState` for persistence across sessions
- State saved on every step change
- State cleared on wizard completion or cancel

---

## Implementation Order (TDD)

1. **RED**: Write `wizard.smoke.spec.ts` - tests will fail
2. **GREEN**: Implement minimal code to pass smoke tests
3. **REFACTOR**: Clean up code
4. Repeat for each step (1-7)

### Priority Order

1. Smoke Test + Basic Navigation
2. Step 1: Entry Point
3. Step 2: Space Selection
4. Step 7: Deploy (to enable full flow testing)
5. Steps 3-6 in order

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `test/wizard/wizard.smoke.spec.ts` | Create | Smoke tests |
| `test/wizard/step*.spec.ts` | Create | Step tests |
| `src/state/WizardState.ts` | Create | State interface |
| `src/panels/WizardPanel.ts` | Modify | Main wizard panel |
| `src/webview/wizard/*` | Create | Step components |

---

## Acceptance Criteria

- [ ] All smoke tests pass
- [ ] All step tests pass
- [ ] Docker GUI tests pass
- [ ] Full E2E flow works with real Qlik Cloud
- [ ] State persists across VS Code restarts
