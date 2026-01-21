# Step 2: Space Selection - Design Document

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create implementation plan from this design.

**Goal:** Enable users to select or create a Qlik Cloud Space in Step 2 of the wizard.

**Architecture:** Radio button list for existing spaces + input field for creating new space.

**Tech Stack:** TypeScript, VS Code Webview, Qlik Cloud REST API

---

## UI Design

```
┌─────────────────────────────────────────────┐
│  Step 2: Space Selection                    │
│  ─────────────────────────────────────────  │
│  Select a Qlik Cloud Space for your model   │
│                                             │
│  ┌─ Spaces ──────────────────────────────┐  │
│  │  ○ Personal Space (default)           │  │
│  │  ○ Sales Team Space                   │  │
│  │  ○ Marketing Analytics                │  │
│  │  ● QMB_TEST_MyNewSpace  ← selected    │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌─ Or Create New ───────────────────────┐  │
│  │  [_______________] [+ Create]         │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  [Back]                            [Next]   │
└─────────────────────────────────────────────┘
```

### Elements:
1. **Spaces List** - Radio buttons for selection
2. **Loading Indicator** - While fetching from Qlik Cloud
3. **Create Input** - Text input + Create button
4. **Validation** - Cannot click Next without selection

---

## Data Flow & State

### State in UI:

```typescript
// In dashboardUI.ts
state = {
  // ... existing from Step 1
  spaces: [],              // List of spaces from Qlik Cloud
  selectedSpaceId: null,   // ID of selected space
  newSpaceName: '',        // Name for new space (if creating)
  spacesLoading: true,     // Loading spaces?
  createSpaceLoading: false // Creating space?
}
```

### Messages between UI and Extension:

| Direction | Message Type | Data | When |
|-----------|--------------|------|------|
| UI → Ext | `getSpaces` | - | Entering Step 2 |
| Ext → UI | `spaces` | `{data: Space[]}` | After loading |
| UI → Ext | `createSpace` | `{name: string}` | Clicking Create |
| Ext → UI | `spaceCreated` | `{space: Space}` | After successful creation |
| Ext → UI | `error` | `{source: 'spaces', message}` | On failure |

### Space Object:
```typescript
interface Space {
  id: string;
  name: string;
  type: 'shared' | 'managed' | 'personal';
}
```

---

## Error Handling & Validation

### Possible Errors:

| Error | Source | Handling |
|-------|--------|----------|
| Not connected to Qlik Cloud | `getSpaces` | Show message + "Configure" button |
| API timeout | `getSpaces` | Show message + "Retry" button |
| Space name already exists | `createSpace` | Show error below input |
| Invalid space name | validation | Show error (letters, numbers, _ only) |

### Validation before Next:

```typescript
function canProceedToStep3(): boolean {
  return state.selectedSpaceId !== null;
}
```

### UI States:

```
State: LOADING
┌─────────────────────────────────┐
│  ⏳ Loading spaces...           │
└─────────────────────────────────┘

State: ERROR
┌─────────────────────────────────┐
│  ❌ Not connected to Qlik Cloud │
│  [Configure] [Retry]            │
└─────────────────────────────────┘

State: EMPTY (no spaces)
┌─────────────────────────────────┐
│  No spaces found.               │
│  Create your first space below. │
└─────────────────────────────────┘
```

---

## Testing Strategy

### Unit Tests (Playwright isolated):
```typescript
// test/wizard/step2-space.spec.ts
- 'shows loading state initially'
- 'displays spaces list when loaded'
- 'selects space on click'
- 'shows create input section'
- 'validates space name'
- 'Next is disabled without selection'
- 'Next is enabled with selection'
```

### Integration Tests (with mocked API):
```typescript
- 'fetches spaces on step entry'
- 'creates new space and selects it'
- 'handles API error gracefully'
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/wizardPanel.ts` | HTML for Step 2 |
| `src/ui/dashboardUI.ts` | Render + Event handlers |
| `src/wizardPanel.ts` | `createSpace` message handler |
| `src/qlikApi.ts` | `createSpace()` method (if missing) |
| `test/wizard/step2-space.spec.ts` | **Create** |

---

## Summary

| Item | Description |
|------|-------------|
| **UI** | Radio button list + Create input |
| **State** | `selectedSpaceId`, `newSpaceName`, `spacesLoading` |
| **Messages** | `getSpaces`, `spaces`, `createSpace`, `spaceCreated` |
| **Validation** | Must select space before Next |
| **Error States** | Loading, Error, Empty |
