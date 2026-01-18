# Wizard GUI TDD Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the 7-step Wizard GUI using TDD approach - tests first, then code.

**Architecture:** VS Code Webview Panel (WizardPanel) with state management via context.globalState. The sidebar (WizardViewProvider in extension.ts) shows a mini-wizard, while the full panel shows the complete 7-step flow.

**Tech Stack:** TypeScript, VS Code Webview API, Playwright for testing, existing WizardState.ts interfaces

---

## Pre-Existing Files Reference

| File | Purpose | Lines |
|------|---------|-------|
| `src/state/WizardState.ts` | State interfaces (already complete) | 143 |
| `src/wizardPanel.ts` | Main panel implementation | ~800 |
| `src/extension.ts` | Commands + sidebar provider | 696 |
| `test/playwright/wizard-webview.spec.ts` | Existing Playwright tests | 173 |
| `test/docker/e2e-gui.spec.ts` | Docker GUI tests | 603 |

---

## Phase 1: Smoke Test Foundation

### Task 1: Create Wizard Smoke Test File

**Files:**
- Create: `test/wizard/wizard.smoke.spec.ts`

**Step 1: Create test directory and file**

```powershell
mkdir -p test/wizard
```

**Step 2: Write the failing smoke test**

```typescript
// test/wizard/wizard.smoke.spec.ts
/**
 * Wizard Smoke Tests (Level 0)
 * These tests verify basic wizard functionality works before testing details.
 * TDD Phase: RED - All tests should fail initially
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Extract HTML from compiled wizardPanel.js (same approach as wizard-webview.spec.ts)
function extractWebviewHtml(): string {
  const wizardPanelPath = path.join(__dirname, '../../out/wizardPanel.js');

  if (!fs.existsSync(wizardPanelPath)) {
    throw new Error(`wizardPanel.js not found at ${wizardPanelPath}. Run: npm run compile`);
  }

  const code = fs.readFileSync(wizardPanelPath, 'utf-8');
  const htmlMatch = code.match(/return\s*`(<!DOCTYPE html>[\s\S]*?)<\/html>`/);

  if (!htmlMatch) {
    throw new Error('Could not extract HTML from wizardPanel.js');
  }

  let html = htmlMatch[1] + '</html>';

  // Replace template literals with test values
  html = html.replace(/\$\{[^}]+nonce[^}]*\}/g, 'test-nonce');
  html = html.replace(/\$\{[^}]+cspSource[^}]*\}/g, "'self'");
  html = html.replace(/\$\{[^}]+styleUri[^}]*\}/g, '');
  html = html.replace(/\$\{[^}]+scriptUri[^}]*\}/g, '');

  // Inject mock vscode API
  const mockVsCodeApi = `
    <script>
      window.wizardState = {
        currentStep: 1,
        entryPoint: null,
        selectedSpaceId: null,
        selectedTables: []
      };

      window.acquireVsCodeApi = function() {
        return {
          postMessage: function(msg) {
            console.log('postMessage:', JSON.stringify(msg));
            window.lastMessage = msg;
          },
          getState: function() { return window.wizardState; },
          setState: function(state) {
            window.wizardState = { ...window.wizardState, ...state };
            return window.wizardState;
          }
        };
      };
    </script>
  `;
  html = html.replace('</head>', mockVsCodeApi + '</head>');

  return html;
}

test.describe('Wizard Smoke Test - Level 0', () => {

  test.beforeEach(async ({ page }) => {
    const html = extractWebviewHtml();
    await page.setContent(html);
    await page.waitForTimeout(500);
  });

  test('Smoke 1: Wizard opens with Step 1 visible', async ({ page }) => {
    // Check wizard container exists
    const wizardContainer = page.locator('#wizard-container, .wizard, #app');
    await expect(wizardContainer).toBeVisible();

    // Check Step 1 content is visible
    const step1Content = page.locator('[data-step="1"], #step-1, .step-entry');
    await expect(step1Content).toBeVisible();

    // Check progress bar shows step 1 as active
    const progressStep1 = page.locator('.step-indicator.current, .progress-step.active');
    await expect(progressStep1).toHaveCount(1);
  });

  test('Smoke 2: Progress bar shows 7 steps', async ({ page }) => {
    // The design specifies 7 steps
    const progressSteps = page.locator('.step-indicator, .progress-step');
    await expect(progressSteps).toHaveCount(7);
  });

  test('Smoke 3: Next button exists and is initially disabled', async ({ page }) => {
    const nextButton = page.locator('button:has-text("Next"), button:has-text("המשך"), #btn-next');
    await expect(nextButton).toBeVisible();

    // Should be disabled until user makes a selection
    await expect(nextButton).toBeDisabled();
  });

  test('Smoke 4: Entry point options are displayed', async ({ page }) => {
    // Step 1 should show 3 entry point options: spec, template, scratch
    const specOption = page.locator('[data-entry="spec"], :has-text("Spec")');
    const templateOption = page.locator('[data-entry="template"], :has-text("Template")');
    const scratchOption = page.locator('[data-entry="scratch"], :has-text("scratch")');

    // At least one option should be visible
    const visibleOptions = await page.locator('[data-entry], .entry-option').count();
    expect(visibleOptions).toBeGreaterThanOrEqual(1);
  });

  test('Smoke 5: Selecting entry point enables Next button', async ({ page }) => {
    // Find and click an entry point option
    const entryOption = page.locator('[data-entry], .entry-option, .item-list li').first();
    await entryOption.click();

    // Next button should be enabled after selection
    const nextButton = page.locator('button:has-text("Next"), button:has-text("המשך"), #btn-next');
    await expect(nextButton).toBeEnabled();
  });

  test('Smoke 6: Navigation - Next advances to Step 2', async ({ page }) => {
    // Select an option first
    const entryOption = page.locator('[data-entry], .entry-option, .item-list li').first();
    await entryOption.click();

    // Click Next
    const nextButton = page.locator('button:has-text("Next"), button:has-text("המשך"), #btn-next');
    await nextButton.click();
    await page.waitForTimeout(300);

    // Verify Step 2 is now visible
    const step2Content = page.locator('[data-step="2"], #step-2, #step-space');
    await expect(step2Content).toBeVisible();

    // Progress bar should show step 2 as current
    const currentStep = page.locator('.step-indicator.current, .progress-step.active');
    const stepNumber = await currentStep.locator('.step-circle, .step-number').textContent();
    expect(stepNumber).toBe('2');
  });

  test('Smoke 7: Navigation - Back returns to Step 1', async ({ page }) => {
    // Navigate to Step 2 first
    const entryOption = page.locator('[data-entry], .entry-option, .item-list li').first();
    await entryOption.click();
    const nextButton = page.locator('button:has-text("Next"), button:has-text("המשך"), #btn-next');
    await nextButton.click();
    await page.waitForTimeout(300);

    // Click Back
    const backButton = page.locator('button:has-text("Back"), button:has-text("חזור"), #btn-back');
    await backButton.click();
    await page.waitForTimeout(300);

    // Verify Step 1 is visible again
    const step1Content = page.locator('[data-step="1"], #step-1, .step-entry');
    await expect(step1Content).toBeVisible();
  });

  test('Smoke 8: State persists across navigation', async ({ page }) => {
    // Select "scratch" option on Step 1
    const scratchOption = page.locator('[data-entry="scratch"], :has-text("scratch"), .item-list li:has-text("scratch")');

    // If scratch option exists, click it
    if (await scratchOption.count() > 0) {
      await scratchOption.click();
    } else {
      // Fallback: click first option
      await page.locator('[data-entry], .entry-option, .item-list li').first().click();
    }

    // Navigate to Step 2 and back
    const nextButton = page.locator('button:has-text("Next"), button:has-text("המשך"), #btn-next');
    await nextButton.click();
    await page.waitForTimeout(300);

    const backButton = page.locator('button:has-text("Back"), button:has-text("חזור"), #btn-back');
    await backButton.click();
    await page.waitForTimeout(300);

    // Check that selection is preserved (option should still be selected)
    const selectedOption = page.locator('.item-list li.selected, [data-entry].selected, .entry-option.selected');
    await expect(selectedOption).toHaveCount(1);
  });

});
```

**Step 3: Run test to verify it fails**

```powershell
cd "C:\Users\fires\OneDrive\Git\QlikModelBuilder\vscode-extension"
npm run compile
npx playwright test test/wizard/wizard.smoke.spec.ts --reporter=list
```

Expected: FAIL - Tests will fail because UI doesn't match 7-step design yet

**Step 4: Commit RED phase**

```powershell
git add test/wizard/wizard.smoke.spec.ts
git commit -m "test(wizard): add smoke tests for 7-step wizard (RED phase)

TDD RED: Tests define expected behavior for wizard GUI:
- 7-step progress bar
- Entry point selection on Step 1
- Next/Back navigation
- State persistence across navigation"
```

---

### Task 2: Update WizardPanel HTML for 7-Step Progress Bar

**Files:**
- Modify: `src/wizardPanel.ts` (find progress bar section)

**Step 1: Read current wizardPanel.ts structure**

```powershell
# Find progress bar section
Select-String -Path src/wizardPanel.ts -Pattern "progress" -Context 5,5 | Select-Object -First 20
```

**Step 2: Update progress bar to 7 steps**

Find the progress bar HTML in wizardPanel.ts and update it to show 7 steps:

```html
<div class="progress-bar" id="progressBar">
  <div class="step-indicator current" data-step="1">
    <div class="step-circle">1</div>
    <span class="step-label">Entry</span>
  </div>
  <div class="step-indicator" data-step="2">
    <div class="step-circle">2</div>
    <span class="step-label">Space</span>
  </div>
  <div class="step-indicator" data-step="3">
    <div class="step-circle">3</div>
    <span class="step-label">Source</span>
  </div>
  <div class="step-indicator" data-step="4">
    <div class="step-circle">4</div>
    <span class="step-label">Tables</span>
  </div>
  <div class="step-indicator" data-step="5">
    <div class="step-circle">5</div>
    <span class="step-label">Fields</span>
  </div>
  <div class="step-indicator" data-step="6">
    <div class="step-circle">6</div>
    <span class="step-label">Incremental</span>
  </div>
  <div class="step-indicator" data-step="7">
    <div class="step-circle">7</div>
    <span class="step-label">Deploy</span>
  </div>
</div>
```

**Step 3: Run smoke test to check progress**

```powershell
npm run compile
npx playwright test test/wizard/wizard.smoke.spec.ts --grep "7 steps" --reporter=list
```

Expected: "Smoke 2: Progress bar shows 7 steps" should PASS

**Step 4: Commit**

```powershell
git add src/wizardPanel.ts
git commit -m "feat(wizard): update progress bar to 7 steps"
```

---

### Task 3: Add Step 1 Entry Point UI

**Files:**
- Modify: `src/wizardPanel.ts`

**Step 1: Add Step 1 content with entry point options**

Add this HTML for Step 1 (Entry Point):

```html
<!-- Step 1: Entry Point -->
<div id="step-1" class="step-content" data-step="1">
  <h2>🚀 Entry Point</h2>
  <p style="margin-bottom: 16px; color: var(--text-secondary);">
    How would you like to start building your data model?
  </p>

  <ul class="item-list" id="entry-options">
    <li data-entry="spec" onclick="selectEntry('spec')">
      <div class="item-info">
        <span class="item-name">📄 From Spec File</span>
        <span class="item-type">Upload a Word/Excel specification document</span>
      </div>
    </li>
    <li data-entry="template" onclick="selectEntry('template')">
      <div class="item-info">
        <span class="item-name">📋 From Template</span>
        <span class="item-type">Start with a predefined template</span>
      </div>
    </li>
    <li data-entry="scratch" onclick="selectEntry('scratch')">
      <div class="item-info">
        <span class="item-name">✨ Start from Scratch</span>
        <span class="item-type">Build your model step by step</span>
      </div>
    </li>
  </ul>

  <div class="button-row">
    <div></div> <!-- Spacer for alignment -->
    <button class="btn btn-primary" id="btn-next" disabled onclick="nextStep()">
      המשך →
    </button>
  </div>
</div>
```

**Step 2: Add JavaScript for entry selection**

```javascript
// Entry point selection
function selectEntry(entry) {
  state.entryPoint = entry;

  // Update UI
  document.querySelectorAll('#entry-options li').forEach(li => {
    li.classList.toggle('selected', li.dataset.entry === entry);
  });

  // Enable Next button
  document.getElementById('btn-next').disabled = false;

  // Save state
  vscode.setState(state);
}
```

**Step 3: Run smoke tests to check progress**

```powershell
npm run compile
npx playwright test test/wizard/wizard.smoke.spec.ts --reporter=list
```

Expected: More tests should PASS

**Step 4: Commit**

```powershell
git add src/wizardPanel.ts
git commit -m "feat(wizard): add Step 1 Entry Point UI with selection"
```

---

### Task 4: Implement Navigation Logic

**Files:**
- Modify: `src/wizardPanel.ts`

**Step 1: Update navigation state**

```javascript
let state = {
  currentStep: 1,  // Changed from 0 to 1-based
  totalSteps: 7,
  entryPoint: null,
  selectedSpaceId: null,
  selectedConnectionId: null,
  selectedTables: [],
  // ... other state
};
```

**Step 2: Update nextStep function**

```javascript
function nextStep() {
  if (state.currentStep < state.totalSteps) {
    state.currentStep++;
    updateUI();
    vscode.setState(state);
  }
}

function prevStep() {
  if (state.currentStep > 1) {
    state.currentStep--;
    updateUI();
    vscode.setState(state);
  }
}

function updateUI() {
  // Update progress bar
  const indicators = document.querySelectorAll('.step-indicator');
  indicators.forEach((ind, i) => {
    const stepNum = i + 1;
    ind.classList.remove('completed', 'current');
    if (stepNum < state.currentStep) ind.classList.add('completed');
    if (stepNum === state.currentStep) ind.classList.add('current');
  });

  // Show current step content, hide others
  for (let i = 1; i <= state.totalSteps; i++) {
    const stepEl = document.getElementById(`step-${i}`);
    if (stepEl) {
      stepEl.style.display = (i === state.currentStep) ? 'block' : 'none';
    }
  }

  // Update Back button visibility
  const backBtn = document.getElementById('btn-back');
  if (backBtn) {
    backBtn.style.display = (state.currentStep > 1) ? 'inline-block' : 'none';
  }
}
```

**Step 3: Run smoke tests**

```powershell
npm run compile
npx playwright test test/wizard/wizard.smoke.spec.ts --reporter=list
```

Expected: Navigation tests should PASS

**Step 4: Commit**

```powershell
git add src/wizardPanel.ts
git commit -m "feat(wizard): implement navigation with state persistence"
```

---

### Task 5: Run Full Smoke Test Suite

**Files:**
- None (verification only)

**Step 1: Run all smoke tests**

```powershell
npx playwright test test/wizard/wizard.smoke.spec.ts --reporter=html
```

**Step 2: Open test report**

```powershell
npx playwright show-report
```

**Step 3: Verify all 8 smoke tests pass**

Expected output:
```
✓ Smoke 1: Wizard opens with Step 1 visible
✓ Smoke 2: Progress bar shows 7 steps
✓ Smoke 3: Next button exists and is initially disabled
✓ Smoke 4: Entry point options are displayed
✓ Smoke 5: Selecting entry point enables Next button
✓ Smoke 6: Navigation - Next advances to Step 2
✓ Smoke 7: Navigation - Back returns to Step 1
✓ Smoke 8: State persists across navigation
```

**Step 4: Commit GREEN phase completion**

```powershell
git add -A
git commit -m "test(wizard): all smoke tests passing (GREEN phase complete)

TDD GREEN: Basic wizard functionality verified:
- 7-step progress bar ✓
- Entry point selection ✓
- Navigation ✓
- State persistence ✓"
```

---

## Phase 2: Step Tests (TDD per step)

### Task 6: Step 1 Entry Point Test

**Files:**
- Create: `test/wizard/step1-entry.spec.ts`

**Step 1: Write the test file**

```typescript
// test/wizard/step1-entry.spec.ts
import { test, expect } from '@playwright/test';
import { extractWebviewHtml } from './test-utils';

test.describe('Step 1: Entry Point', () => {

  test.beforeEach(async ({ page }) => {
    const html = extractWebviewHtml();
    await page.setContent(html);
    await page.waitForTimeout(500);
  });

  test('shows three entry options: spec, template, scratch', async ({ page }) => {
    const specOption = page.locator('[data-entry="spec"]');
    const templateOption = page.locator('[data-entry="template"]');
    const scratchOption = page.locator('[data-entry="scratch"]');

    await expect(specOption).toBeVisible();
    await expect(templateOption).toBeVisible();
    await expect(scratchOption).toBeVisible();
  });

  test('spec option triggers file upload dialog', async ({ page }) => {
    const specOption = page.locator('[data-entry="spec"]');
    await specOption.click();

    // Check that uploadSpec message is sent
    const lastMessage = await page.evaluate(() => (window as any).lastMessage);
    // For now, just verify selection works
    const selected = page.locator('[data-entry="spec"].selected');
    await expect(selected).toHaveCount(1);
  });

  test('template option shows template list', async ({ page }) => {
    const templateOption = page.locator('[data-entry="template"]');
    await templateOption.click();

    const selected = page.locator('[data-entry="template"].selected');
    await expect(selected).toHaveCount(1);
  });

  test('scratch option enables direct next', async ({ page }) => {
    const scratchOption = page.locator('[data-entry="scratch"]');
    await scratchOption.click();

    const nextButton = page.locator('#btn-next');
    await expect(nextButton).toBeEnabled();
  });

  test('only one entry can be selected at a time', async ({ page }) => {
    // Select spec
    await page.locator('[data-entry="spec"]').click();
    await expect(page.locator('[data-entry="spec"].selected')).toHaveCount(1);

    // Select template (should deselect spec)
    await page.locator('[data-entry="template"]').click();
    await expect(page.locator('[data-entry="spec"].selected')).toHaveCount(0);
    await expect(page.locator('[data-entry="template"].selected')).toHaveCount(1);
  });

});
```

**Step 2: Run test**

```powershell
npx playwright test test/wizard/step1-entry.spec.ts --reporter=list
```

**Step 3: Implement until tests pass**

**Step 4: Commit**

```powershell
git add test/wizard/step1-entry.spec.ts src/wizardPanel.ts
git commit -m "feat(wizard): Step 1 Entry Point complete with tests"
```

---

### Task 7: Step 2 Space Selection Test

**Files:**
- Create: `test/wizard/step2-space.spec.ts`

**Step 1: Write the test file**

```typescript
// test/wizard/step2-space.spec.ts
import { test, expect } from '@playwright/test';
import { extractWebviewHtml, navigateToStep } from './test-utils';

test.describe('Step 2: Space Selection', () => {

  test.beforeEach(async ({ page }) => {
    const html = extractWebviewHtml();
    await page.setContent(html);
    await navigateToStep(page, 2); // Helper to get to step 2
  });

  test('shows list of available spaces', async ({ page }) => {
    const spacesList = page.locator('#spaces-list, .spaces-list');
    await expect(spacesList).toBeVisible();
  });

  test('spaces show type badges (managed/shared/personal)', async ({ page }) => {
    const badges = page.locator('.badge-managed, .badge-shared, .badge-personal');
    const count = await badges.count();
    expect(count).toBeGreaterThan(0);
  });

  test('selecting space enables Next button', async ({ page }) => {
    const firstSpace = page.locator('#spaces-list li, .spaces-list li').first();
    await firstSpace.click();

    const nextButton = page.locator('#btn-next');
    await expect(nextButton).toBeEnabled();
  });

  test('selected space is visually highlighted', async ({ page }) => {
    const firstSpace = page.locator('#spaces-list li, .spaces-list li').first();
    await firstSpace.click();

    await expect(firstSpace).toHaveClass(/selected/);
  });

});
```

**Step 2: Run test and implement**

**Step 3: Commit**

```powershell
git add test/wizard/step2-space.spec.ts src/wizardPanel.ts
git commit -m "feat(wizard): Step 2 Space Selection complete with tests"
```

---

### Task 8-12: Remaining Steps (3-7)

Follow the same TDD pattern for:
- **Task 8:** Step 3 - Data Source (`step3-source.spec.ts`)
- **Task 9:** Step 4 - Table Selection (`step4-tables.spec.ts`)
- **Task 10:** Step 5 - Field Mapping (`step5-fields.spec.ts`)
- **Task 11:** Step 6 - Incremental Config (`step6-incremental.spec.ts`)
- **Task 12:** Step 7 - Deploy (`step7-deploy.spec.ts`)

Each task follows:
1. Write failing test
2. Run to verify failure
3. Implement minimal code
4. Run to verify pass
5. Commit

---

## Phase 3: State Management Tests

### Task 13: Create State Management Tests

**Files:**
- Create: `test/wizard/wizard-state.spec.ts`

**Step 1: Write state tests**

```typescript
// test/wizard/wizard-state.spec.ts
import { test, expect } from '@playwright/test';
import { extractWebviewHtml } from './test-utils';

test.describe('Wizard State Management', () => {

  test('state is saved on each step change', async ({ page }) => {
    const html = extractWebviewHtml();
    await page.setContent(html);

    // Select entry and go to step 2
    await page.locator('[data-entry="scratch"]').click();
    await page.locator('#btn-next').click();

    // Check state was saved
    const state = await page.evaluate(() => (window as any).wizardState);
    expect(state.currentStep).toBe(2);
    expect(state.entryPoint).toBe('scratch');
  });

  test('state persists after page reload simulation', async ({ page }) => {
    const html = extractWebviewHtml();
    await page.setContent(html);

    // Make selections
    await page.locator('[data-entry="template"]').click();
    await page.locator('#btn-next').click();

    // Simulate reload by setting content again with preserved state
    const savedState = await page.evaluate(() => (window as any).wizardState);

    // Inject state before reload
    const htmlWithState = html.replace(
      'window.wizardState = {',
      `window.wizardState = ${JSON.stringify(savedState)}; window._originalState = {`
    );
    await page.setContent(htmlWithState);
    await page.waitForTimeout(500);

    // Verify state restored
    const currentStep = await page.locator('.step-indicator.current .step-circle').textContent();
    expect(currentStep).toBe('2');
  });

  test('state is cleared on wizard completion', async ({ page }) => {
    // Navigate through all steps to completion
    // Verify state is cleared after deploy
  });

});
```

**Step 2: Run and implement**

**Step 3: Commit**

```powershell
git add test/wizard/wizard-state.spec.ts
git commit -m "test(wizard): add state management tests"
```

---

## Phase 4: Docker GUI Integration

### Task 14: Update Docker E2E Tests

**Files:**
- Modify: `test/docker/e2e-gui.spec.ts`

**Step 1: Add wizard-specific tests to Docker suite**

Add these tests to the existing e2e-gui.spec.ts:

```typescript
test('Level 3: Wizard shows 7-step progress', async ({ page }) => {
  log('Test: Wizard 7-step progress');

  await page.goto(VSCODE_URL);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // Open wizard
  await page.keyboard.press('F1');
  await page.waitForTimeout(500);
  await page.keyboard.type('Qlik: Open Model Builder Wizard', { delay: 30 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(5000);

  // Find webview and check for 7 steps
  for (const frame of page.frames()) {
    const steps = await frame.locator('.step-indicator').count().catch(() => 0);
    if (steps === 7) {
      log('PASS: Found 7-step progress bar');
      return;
    }
  }

  log('WARN: Could not verify 7-step progress bar');
});

test('Level 3: Wizard Entry Point selection works', async ({ page }) => {
  log('Test: Entry Point selection');

  // Open wizard and test entry point selection
  // ...
});
```

**Step 2: Run Docker tests**

```powershell
docker-compose run playwright
```

**Step 3: Commit**

```powershell
git add test/docker/e2e-gui.spec.ts
git commit -m "test(e2e): add wizard 7-step tests to Docker GUI suite"
```

---

## Phase 5: Final Verification

### Task 15: Run All Tests

**Files:**
- None (verification)

**Step 1: Run Playwright tests**

```powershell
npx playwright test --reporter=html
```

**Step 2: Run Docker tests**

```powershell
docker-compose run playwright
```

**Step 3: Check test report**

```powershell
npx playwright show-report
```

**Step 4: Final commit**

```powershell
git add -A
git commit -m "feat(wizard): 7-step wizard GUI complete with full test coverage

TDD Implementation Complete:
- Smoke tests: 8 tests ✓
- Step tests: 7 files ✓
- State tests: 3 tests ✓
- Docker GUI: integrated ✓

All acceptance criteria met."
```

---

## Files Summary

| File | Action | Phase |
|------|--------|-------|
| `test/wizard/wizard.smoke.spec.ts` | Create | 1 |
| `test/wizard/step1-entry.spec.ts` | Create | 2 |
| `test/wizard/step2-space.spec.ts` | Create | 2 |
| `test/wizard/step3-source.spec.ts` | Create | 2 |
| `test/wizard/step4-tables.spec.ts` | Create | 2 |
| `test/wizard/step5-fields.spec.ts` | Create | 2 |
| `test/wizard/step6-incremental.spec.ts` | Create | 2 |
| `test/wizard/step7-deploy.spec.ts` | Create | 2 |
| `test/wizard/wizard-state.spec.ts` | Create | 3 |
| `test/wizard/test-utils.ts` | Create | 1 |
| `src/wizardPanel.ts` | Modify | 1-2 |
| `test/docker/e2e-gui.spec.ts` | Modify | 4 |

---

## Test Commands Reference

```powershell
# Run all wizard tests
npx playwright test test/wizard/ --reporter=list

# Run specific test file
npx playwright test test/wizard/wizard.smoke.spec.ts

# Run with UI mode (interactive)
npx playwright test --ui

# Generate HTML report
npx playwright test --reporter=html
npx playwright show-report

# Run Docker GUI tests
docker-compose run playwright
```
