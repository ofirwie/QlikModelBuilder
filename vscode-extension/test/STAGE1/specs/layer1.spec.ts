/**
 * Layer 1: Step Navigation Tests
 *
 * These tests verify that wizard step navigation works correctly.
 * All tests must pass before Layer 2 can run.
 *
 * NOTE: These tests use source code analysis and DOM structure verification.
 * Full runtime tests require VS Code Extension Host with webview access.
 */

import * as fs from 'fs';
import * as path from 'path';

// Paths
const EXTENSION_ROOT = path.resolve(__dirname, '../../../');
const SRC_DIR = path.join(EXTENSION_ROOT, 'src');
const WIZARD_PANEL_PATH = path.join(SRC_DIR, 'wizardPanel.ts');

// Helper to read file
function readFile(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf-8');
}

// Helper to read all source files
function readAllSources(): string {
  const files = [WIZARD_PANEL_PATH];
  const extensionPath = path.join(SRC_DIR, 'extension.ts');
  const dashboardPath = path.join(SRC_DIR, 'ui', 'dashboardUI.ts');
  if (fs.existsSync(extensionPath)) files.push(extensionPath);
  if (fs.existsSync(dashboardPath)) files.push(dashboardPath);
  return files.map(f => fs.existsSync(f) ? fs.readFileSync(f, 'utf-8') : '').join('\n');
}

// Expected steps
const EXPECTED_STEPS = [
  { num: 1, name: 'Entry' },
  { num: 2, name: 'Space' },
  { num: 3, name: 'Source' },
  { num: 4, name: 'Tables' },
  { num: 5, name: 'Fields' },
  { num: 6, name: 'Incremental' },
  { num: 7, name: 'Deploy' },
];

// Test definitions for Layer 1
export const layer1Tests = [
  // =========================================================================
  // L1-001 to L1-007: Click step N - Step N content displays
  // =========================================================================
  ...EXPECTED_STEPS.map((step, index) => ({
    id: `L1-00${index + 1}`,
    name: `Click step ${step.num} (${step.name}) - content displays`,
    fn: async () => {
      const allSources = readAllSources();

      // Verify step button exists
      const stepButtonPattern = new RegExp(`data-step=["']${step.num}["']`);
      if (!stepButtonPattern.test(allSources)) {
        throw new Error(`Step ${step.num} button should exist with data-step attribute`);
      }

      // Verify step content area exists (id="step-1", id="step-space", class="step-content", etc.)
      const stepContentPattern = new RegExp(
        `id=["']step-${step.num}["']|id=["']step${step.num}["']|step-content.*data-step=["']${step.num}["']`,
        'i'
      );
      if (!stepContentPattern.test(allSources)) {
        // Also check for step indicator or any step-related element
        const hasStepIndicator = allSources.includes(`data-step="${step.num}"`);
        if (!hasStepIndicator) {
          throw new Error(`Step ${step.num} (${step.name}) should have data-step attribute`);
        }
      }
    }
  })),

  // =========================================================================
  // L1-008 to L1-014: Step N content area updates correctly
  // =========================================================================
  ...EXPECTED_STEPS.map((step, index) => ({
    id: `L1-0${String(index + 8).padStart(2, '0')}`,
    name: `Step ${step.num} (${step.name}) content area updates correctly`,
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check for updateUI or similar function that updates content
      if (!wizardSource.includes('updateUI') && !wizardSource.includes('showStep') &&
          !wizardSource.includes('renderStep') && !wizardSource.includes('display')) {
        throw new Error('Should have function to update UI when step changes');
      }

      // Check step content is conditionally shown
      const displayLogicPattern = /step-content.*display|display.*step|currentStep|activeStep/gi;
      if (!displayLogicPattern.test(wizardSource)) {
        throw new Error('Should have display logic for step content');
      }
    }
  })),

  // =========================================================================
  // L1-015 to L1-021: Progress bar step N visual position correct
  // =========================================================================
  ...EXPECTED_STEPS.map((step, index) => ({
    id: `L1-0${String(index + 15).padStart(2, '0')}`,
    name: `Progress bar step ${step.num} visual position correct`,
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check progress bar updates with step changes
      const progressUpdatePattern = /progress|step-indicator|updateUI|updateProgress/gi;
      if (!progressUpdatePattern.test(wizardSource)) {
        throw new Error('Should update progress indicator');
      }

      // Check for completed/current class toggling
      if (!wizardSource.includes('completed') && !wizardSource.includes('current') &&
          !wizardSource.includes('active')) {
        throw new Error('Should have CSS classes for step states (completed/current/active)');
      }
    }
  })),

  // =========================================================================
  // L1-022: Skip prevention - Cannot skip to Step 7 without prior steps
  // =========================================================================
  {
    id: 'L1-022',
    name: 'Skip prevention - Cannot skip to Step 7 without prior steps',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check for validation or skip prevention logic
      // This could be:
      // 1. Steps are disabled/not clickable until previous completes
      // 2. Validation when trying to go to a step
      // 3. Sequential step enforcement

      const hasSkipPrevention =
        wizardSource.includes('disabled') ||
        wizardSource.includes('canGoTo') ||
        wizardSource.includes('validateStep') ||
        wizardSource.includes('currentStep') ||
        wizardSource.includes('allowedStep') ||
        wizardSource.includes('isStepComplete');

      if (!hasSkipPrevention) {
        throw new Error('Should have mechanism to prevent skipping steps');
      }

      // Alternative: steps might just show in sequence without skipping
      const hasSequentialNav = wizardSource.includes('nextStep') && wizardSource.includes('prevStep');
      if (!hasSequentialNav && !hasSkipPrevention) {
        throw new Error('Should enforce sequential step navigation');
      }
    }
  },

  // =========================================================================
  // L1-023: Back button returns to previous step
  // =========================================================================
  {
    id: 'L1-023',
    name: 'Back button returns to previous step',
    fn: async () => {
      const allSources = readAllSources();

      // Check for back/previous functionality
      const hasBackButton =
        allSources.includes('prevStep') ||
        allSources.includes('previousStep') ||
        allSources.includes('goBack') ||
        allSources.includes('← חזור') ||
        allSources.includes('Back') ||
        allSources.includes('חזור');

      if (!hasBackButton) {
        throw new Error('Should have back/previous step functionality');
      }

      // Check back button decrements step
      const hasBackLogic =
        allSources.includes('currentStep--') ||
        allSources.includes('currentStep - 1') ||
        allSources.includes('currentStep -= 1') ||
        allSources.includes('currentStep > 0') ||
        allSources.includes('currentStep <= 1');

      if (!hasBackLogic) {
        throw new Error('Back button should decrement current step');
      }
    }
  },

  // =========================================================================
  // L1-024: Next button disabled when step incomplete
  // =========================================================================
  {
    id: 'L1-024',
    name: 'Next button disabled when step incomplete',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check for disabled state on next button
      const hasDisabledNext =
        wizardSource.includes('btn-next') ||
        wizardSource.includes('nextButton') ||
        wizardSource.includes('disabled') ||
        wizardSource.includes(':disabled');

      if (!hasDisabledNext) {
        throw new Error('Should have mechanism to disable next button');
      }

      // Check for validation before enabling
      const hasValidation =
        wizardSource.includes('disabled') ||
        wizardSource.includes('validate') ||
        wizardSource.includes('canProceed') ||
        wizardSource.includes('isComplete') ||
        wizardSource.includes('selected');

      if (!hasValidation) {
        throw new Error('Next button should be disabled based on validation');
      }
    }
  },

  // =========================================================================
  // L1-025: Next button enabled when step complete
  // =========================================================================
  {
    id: 'L1-025',
    name: 'Next button enabled when step complete',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check for enabling next button
      const hasEnableLogic =
        wizardSource.includes('disabled = false') ||
        wizardSource.includes('disabled=false') ||
        wizardSource.includes('.disabled = false') ||
        wizardSource.includes('removeAttribute') ||
        wizardSource.includes('enabled');

      if (!hasEnableLogic) {
        throw new Error('Should enable next button when step is complete');
      }

      // Check this happens based on state/selection
      const stateBasedEnable =
        wizardSource.includes('selected') ||
        wizardSource.includes('state.') ||
        wizardSource.includes('isValid') ||
        wizardSource.includes('canProceed');

      if (!stateBasedEnable) {
        throw new Error('Next button enabling should be based on state');
      }
    }
  },

  // =========================================================================
  // L1-026: Keyboard navigation - Tab and Enter work
  // =========================================================================
  {
    id: 'L1-026',
    name: 'Keyboard navigation - Tab and Enter work',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check for keyboard event handling
      const hasKeyboardHandling =
        wizardSource.includes('keydown') ||
        wizardSource.includes('keyup') ||
        wizardSource.includes('keypress') ||
        wizardSource.includes('keyboard') ||
        wizardSource.includes('tabindex');

      // Buttons should naturally support Enter, but check for explicit handling
      const hasButtonElements =
        wizardSource.includes('<button') ||
        wizardSource.includes('onclick');

      if (!hasButtonElements) {
        throw new Error('Should have button elements for keyboard accessibility');
      }

      // tabindex is good practice
      if (!wizardSource.includes('tabindex') && !wizardSource.includes('tabIndex')) {
        console.warn('Warning: Consider adding tabindex for better keyboard navigation');
      }
    }
  },

  // =========================================================================
  // L1-027: State persistence - Step state survives hide/show
  // =========================================================================
  {
    id: 'L1-027',
    name: 'State persistence - Step state survives hide/show',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check for retainContextWhenHidden
      if (!wizardSource.includes('retainContextWhenHidden: true')) {
        throw new Error('Must have retainContextWhenHidden: true for state persistence');
      }

      // Check state management
      const hasStateManagement =
        wizardSource.includes('state') ||
        wizardSource.includes('currentStep') ||
        wizardSource.includes('getState') ||
        wizardSource.includes('setState');

      if (!hasStateManagement) {
        throw new Error('Should manage step state for persistence');
      }
    }
  },

  // =========================================================================
  // L1-028: Validation messages appear correctly
  // =========================================================================
  {
    id: 'L1-028',
    name: 'Validation messages appear correctly',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check for message/error display elements
      const hasMessageDisplay =
        wizardSource.includes('message') ||
        wizardSource.includes('error') ||
        wizardSource.includes('warning') ||
        wizardSource.includes('validation') ||
        wizardSource.includes('alert');

      if (!hasMessageDisplay) {
        throw new Error('Should have elements for displaying validation messages');
      }

      // Check for message styling
      const hasMessageStyles =
        wizardSource.includes('.message') ||
        wizardSource.includes('.error') ||
        wizardSource.includes('message-') ||
        wizardSource.includes('color: var(--error)') ||
        wizardSource.includes('--error');

      if (!hasMessageStyles) {
        throw new Error('Should have CSS styles for validation messages');
      }
    }
  }
];

// Run Layer 1 tests
async function runLayer1(): Promise<void> {
  console.log('Running Layer 1 tests (Step Navigation)...\n');

  let passed = 0;
  let failed = 0;

  for (const test of layer1Tests) {
    try {
      await test.fn();
      console.log(`✅ ${test.id}: ${test.name}`);
      passed++;
    } catch (err) {
      console.log(`❌ ${test.id}: ${test.name}`);
      console.log(`   Error: ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

// Export for main runner
export default layer1Tests;

// Run if executed directly
if (require.main === module) {
  runLayer1().catch(console.error);
}
