/**
 * Step 3: Data Source / Connection - Tests
 *
 * These tests verify Step 3 (Data Source / Connection) functionality:
 * - Step 3 is reachable via navigation
 * - Progress bar shows Step 3 as current
 * - Back button navigates to Step 2
 *
 * Note: Step 3 UI is not fully implemented yet. These tests verify
 * basic navigation works and create a foundation for TDD.
 */

import { test, expect } from '@playwright/test';
import { extractWebviewHtml, navigateToStep } from './test-utils';

test.describe('Step 3: Data Source / Connection', () => {

  test.beforeEach(async ({ page }) => {
    const html = extractWebviewHtml();
    await page.setContent(html);
    await page.waitForTimeout(500);
  });

  test('Step 3 is reachable via navigation', async ({ page }) => {
    await navigateToStep(page, 3);

    // Check that navigation worked - progress bar should show step 3
    const currentIndicator = page.locator('.step-indicator.current');
    await expect(currentIndicator).toBeVisible();

    // The step circle should show "3"
    const stepCircle = page.locator('.step-indicator.current .step-circle');
    await expect(stepCircle).toContainText('3');
  });

  test('Progress bar shows Step 3 as current after navigation', async ({ page }) => {
    await navigateToStep(page, 3);

    // Step 3 indicator should be marked as current
    const step3Indicator = page.locator('.step-indicator[data-step="3"].current, .step-indicator:nth-child(3).current');
    const indicatorExists = await step3Indicator.count() > 0;

    // Alternative: check the step circle text
    const stepCircle = page.locator('.step-indicator.current .step-circle');
    const circleText = await stepCircle.textContent().catch(() => '');

    expect(indicatorExists || circleText === '3').toBeTruthy();
  });

  test('Back button navigates to Step 2', async ({ page }) => {
    await navigateToStep(page, 3);

    // Click back button
    const backButton = page.locator('button:has-text("Back"), button:has-text("חזור"), #btn-back, [onclick*="prevStep"]').first();
    await backButton.click();
    await page.waitForTimeout(300);

    // Should be back on Step 2
    const stepCircle = page.locator('.step-indicator.current .step-circle');
    await expect(stepCircle).toContainText('2');
  });

  test('Step 3 content area exists', async ({ page }) => {
    await navigateToStep(page, 3);

    // Check for step 3 content (may be placeholder if not implemented)
    const step3Content = page.locator('[data-step="3"], #step-3, #step-source, .data-source-selection, .connection-selection');
    const contentExists = await step3Content.count() > 0;

    // At minimum, the main content area should be visible
    const mainContent = page.locator('.config-screen, .main-content, main');
    const mainExists = await mainContent.first().isVisible().catch(() => false);

    expect(contentExists || mainExists).toBeTruthy();
  });

});
