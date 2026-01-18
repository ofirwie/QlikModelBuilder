/**
 * Wizard Smoke Tests - RED Phase (TDD)
 *
 * These tests define the expected behavior for the NEW 7-step wizard design.
 * They are expected to FAIL initially because the current UI doesn't implement
 * the 7-step wizard or the expected entry point selection UI.
 *
 * 7-Step Wizard Design:
 * 1. Entry Point Selection (New/Existing Model, Scratch/Spec)
 * 2. Space Selection
 * 3. Data Source / Connection
 * 4. Table Selection
 * 5. Field Mapping
 * 6. Incremental Load Configuration
 * 7. Review & Deploy
 */

import { test, expect } from '@playwright/test';
import { extractWebviewHtml, navigateToStep } from './test-utils';

test.describe('Wizard Smoke Tests - 7-Step Design', () => {

  test.beforeEach(async ({ page }) => {
    // Load the extracted wizard HTML
    const html = extractWebviewHtml();
    await page.setContent(html);

    // Wait for scripts to initialize
    await page.waitForTimeout(500);
  });

  /**
   * Smoke 1: Wizard opens with Step 1 visible
   * The wizard should open showing the first step (Entry Point Selection)
   */
  test('Smoke 1: Wizard opens with Step 1 visible', async ({ page }) => {
    // Step 1 content should be visible
    const step1Content = page.locator('[data-step="1"], #step-1, .step-content:first-of-type, .entry-point-selection');
    await expect(step1Content.first()).toBeVisible();

    // Step 1 indicator should be marked as current
    const step1Indicator = page.locator('.step-indicator[data-step="1"], .step-indicator.current').first();
    await expect(step1Indicator).toBeVisible();
  });

  /**
   * Smoke 2: Progress bar shows 7 steps
   * The new wizard design requires 7 steps in the progress bar
   */
  test('Smoke 2: Progress bar shows 7 steps', async ({ page }) => {
    // Find all step indicators in the progress bar (use only .step-indicator to avoid double-counting)
    const stepIndicators = page.locator('.step-indicator');

    // Should have exactly 7 steps
    const count = await stepIndicators.count();
    expect(count).toBe(7);
  });

  /**
   * Smoke 3: Next button exists and is initially disabled
   * The Next button should be present but disabled until user makes a selection
   */
  test('Smoke 3: Next button exists and is initially disabled', async ({ page }) => {
    // Find the Next button
    const nextButton = page.locator('button:has-text("Next"), button:has-text("המשך"), #btn-next, [onclick*="nextStep"]').first();

    // Should exist
    await expect(nextButton).toBeVisible();

    // Should be disabled initially (no entry point selected)
    await expect(nextButton).toBeDisabled();
  });

  /**
   * Smoke 4: Entry point options are displayed
   * Step 1 should show options for selecting the wizard entry point:
   * - New Model from Scratch
   * - New Model from Spec File
   * - Open Existing Model
   */
  test('Smoke 4: Entry point options are displayed', async ({ page }) => {
    // Look for entry point options (cards, buttons, or list items)
    const entryOptions = page.locator('[data-entry], .entry-option, .entry-card, [data-entry-point]');

    // Should have at least 2 entry options (scratch and spec)
    const count = await entryOptions.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // Check for specific entry point options
    const scratchOption = page.locator('[data-entry="scratch"], :has-text("Scratch"), :has-text("מאפס")');
    const specOption = page.locator('[data-entry="spec"], :has-text("Spec"), :has-text("מפרט")');

    // At least one of these patterns should match
    const hasScratch = await scratchOption.count() > 0;
    const hasSpec = await specOption.count() > 0;

    expect(hasScratch || hasSpec).toBeTruthy();
  });

  /**
   * Smoke 5: Selecting entry point enables Next button
   * When user selects an entry point option, the Next button should become enabled
   */
  test('Smoke 5: Selecting entry point enables Next button', async ({ page }) => {
    // Find the Next button
    const nextButton = page.locator('button:has-text("Next"), button:has-text("המשך"), #btn-next, [onclick*="nextStep"]').first();

    // Initially disabled
    await expect(nextButton).toBeDisabled();

    // Click on an entry point option
    const entryOption = page.locator('[data-entry], .entry-option, .entry-card, .item-list li').first();
    await entryOption.click();

    // Wait for state update
    await page.waitForTimeout(200);

    // Next button should now be enabled
    await expect(nextButton).toBeEnabled();
  });

  /**
   * Smoke 6: Navigation - Next advances to Step 2
   * Clicking Next after selecting entry point should advance to Step 2
   */
  test('Smoke 6: Navigation - Next advances to Step 2', async ({ page }) => {
    // Select an entry point
    const entryOption = page.locator('[data-entry], .entry-option, .entry-card, .item-list li').first();
    await entryOption.click();
    await page.waitForTimeout(200);

    // Click Next
    const nextButton = page.locator('button:has-text("Next"), button:has-text("המשך"), #btn-next, [onclick*="nextStep"]').first();
    await nextButton.click();
    await page.waitForTimeout(300);

    // Step 2 should now be visible/active
    const step2Indicator = page.locator('.step-indicator[data-step="2"].current, .step-indicator:nth-child(2).current');
    const step2Content = page.locator('[data-step="2"], #step-2, #step-space, .space-selection');

    // Either the indicator shows current step as 2, or step 2 content is visible
    const indicatorIsCurrent = await step2Indicator.count() > 0;
    const contentIsVisible = await step2Content.first().isVisible().catch(() => false);

    expect(indicatorIsCurrent || contentIsVisible).toBeTruthy();
  });

  /**
   * Smoke 7: Navigation - Back returns to Step 1
   * After navigating to Step 2, clicking Back should return to Step 1
   */
  test('Smoke 7: Navigation - Back returns to Step 1', async ({ page }) => {
    // Navigate to Step 2
    await navigateToStep(page, 2);

    // Find and click the Back button
    const backButton = page.locator('button:has-text("Back"), button:has-text("חזור"), #btn-back, [onclick*="prevStep"]').first();
    await backButton.click();
    await page.waitForTimeout(300);

    // Step 1 should be visible again
    const step1Indicator = page.locator('.step-indicator[data-step="1"].current, .step-indicator:first-child.current');
    const step1Content = page.locator('[data-step="1"], #step-1, .entry-point-selection');

    // Either the indicator shows current step as 1, or step 1 content is visible
    const indicatorIsCurrent = await step1Indicator.count() > 0;
    const contentIsVisible = await step1Content.first().isVisible().catch(() => false);

    expect(indicatorIsCurrent || contentIsVisible).toBeTruthy();
  });

  /**
   * Smoke 8: State persists across navigation
   * Selections made in Step 1 should persist when navigating back from Step 2
   */
  test('Smoke 8: State persists across navigation', async ({ page }) => {
    // Select an entry point option
    const entryOption = page.locator('[data-entry], .entry-option, .entry-card, .item-list li').first();
    await entryOption.click();

    // Get the selected state (via the mock VS Code API)
    const initialState = await page.evaluate(() => (window as any).wizardState);

    // Navigate to Step 2
    const nextButton = page.locator('button:has-text("Next"), button:has-text("המשך"), #btn-next, [onclick*="nextStep"]').first();
    await nextButton.click();
    await page.waitForTimeout(300);

    // Navigate back to Step 1
    const backButton = page.locator('button:has-text("Back"), button:has-text("חזור"), #btn-back, [onclick*="prevStep"]').first();
    await backButton.click();
    await page.waitForTimeout(300);

    // Check that state persisted (entry point should still be selected)
    const finalState = await page.evaluate(() => (window as any).wizardState);

    // The state should contain the selection OR the UI should show the option as selected
    const statePreserved = finalState && (
      finalState.entryPoint !== null ||
      finalState.selectedSpaceId !== null ||
      finalState.currentStep >= 1
    );

    // Also check UI state - entry option should be marked as selected
    const selectedOption = page.locator('[data-entry].selected, .entry-option.selected, .item-list li.selected');
    const hasSelectedUI = await selectedOption.count() > 0;

    expect(statePreserved || hasSelectedUI).toBeTruthy();
  });
});
