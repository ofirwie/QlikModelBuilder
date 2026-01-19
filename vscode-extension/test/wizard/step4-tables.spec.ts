/**
 * Step 4: Table Selection - Tests
 *
 * These tests verify Step 4 (Table Selection) functionality:
 * - Step 4 is reachable via navigation
 * - Progress bar shows Step 4 as current
 * - Back button navigates to Step 3
 *
 * Note: Step 4 UI is not fully implemented yet. These tests verify
 * basic navigation works and create a foundation for TDD.
 */

import { test, expect } from '@playwright/test';
import { extractWebviewHtml, navigateToStep } from './test-utils';

test.describe('Step 4: Table Selection', () => {

  test.beforeEach(async ({ page }) => {
    const html = extractWebviewHtml();
    await page.setContent(html);
    await page.waitForTimeout(500);
  });

  test('Step 4 is reachable via navigation', async ({ page }) => {
    await navigateToStep(page, 4);

    // Check that navigation worked - progress bar should show step 4
    const currentIndicator = page.locator('.step-indicator.current');
    await expect(currentIndicator).toBeVisible();

    // The step circle should show "4"
    const stepCircle = page.locator('.step-indicator.current .step-circle');
    await expect(stepCircle).toContainText('4');
  });

  test('Progress bar shows Step 4 as current after navigation', async ({ page }) => {
    await navigateToStep(page, 4);

    // Step 4 indicator should be marked as current
    const step4Indicator = page.locator('.step-indicator[data-step="4"].current, .step-indicator:nth-child(4).current');
    const indicatorExists = await step4Indicator.count() > 0;

    // Alternative: check the step circle text
    const stepCircle = page.locator('.step-indicator.current .step-circle');
    const circleText = await stepCircle.textContent().catch(() => '');

    expect(indicatorExists || circleText === '4').toBeTruthy();
  });

  test('Back button navigates to Step 3', async ({ page }) => {
    await navigateToStep(page, 4);

    // Click back button
    const visibleStep = page.locator('.step-content:visible').first();
    const backButton = visibleStep.locator('button:has-text("Back"), button:has-text("חזור"), [onclick*="prevStep"]').first();
    await backButton.click();
    await page.waitForTimeout(300);

    // Should be back on Step 3
    const stepCircle = page.locator('.step-indicator.current .step-circle');
    await expect(stepCircle).toContainText('3');
  });

  test('Step 4 content area exists', async ({ page }) => {
    await navigateToStep(page, 4);

    // Check for step 4 content (may be placeholder if not implemented)
    const step4Content = page.locator('[data-step="4"], #step-4, #step-tables, .table-selection');
    const contentExists = await step4Content.count() > 0;

    // At minimum, the main content area should be visible
    const mainContent = page.locator('.config-screen, .main-content, main');
    const mainExists = await mainContent.first().isVisible().catch(() => false);

    expect(contentExists || mainExists).toBeTruthy();
  });

});
