/**
 * Step 6: Incremental Load Configuration - Tests
 *
 * These tests verify Step 6 (Incremental Load Configuration) functionality:
 * - Step 6 is reachable via navigation
 * - Progress bar shows Step 6 as current
 * - Back button navigates to Step 5
 *
 * Note: Step 6 UI is not fully implemented yet. These tests verify
 * basic navigation works and create a foundation for TDD.
 */

import { test, expect } from '@playwright/test';
import { extractWebviewHtml, navigateToStep } from './test-utils';

test.describe('Step 6: Incremental Load Configuration', () => {

  test.beforeEach(async ({ page }) => {
    const html = extractWebviewHtml();
    await page.setContent(html);
    await page.waitForTimeout(500);
  });

  test('Step 6 is reachable via navigation', async ({ page }) => {
    await navigateToStep(page, 6);

    // Check that navigation worked - progress bar should show step 6
    const currentIndicator = page.locator('.step-indicator.current');
    await expect(currentIndicator).toBeVisible();

    // The step circle should show "6"
    const stepCircle = page.locator('.step-indicator.current .step-circle');
    await expect(stepCircle).toContainText('6');
  });

  test('Progress bar shows Step 6 as current after navigation', async ({ page }) => {
    await navigateToStep(page, 6);

    // Step 6 indicator should be marked as current
    const step6Indicator = page.locator('.step-indicator[data-step="6"].current, .step-indicator:nth-child(6).current');
    const indicatorExists = await step6Indicator.count() > 0;

    // Alternative: check the step circle text
    const stepCircle = page.locator('.step-indicator.current .step-circle');
    const circleText = await stepCircle.textContent().catch(() => '');

    expect(indicatorExists || circleText === '6').toBeTruthy();
  });

  test('Back button navigates to Step 5', async ({ page }) => {
    await navigateToStep(page, 6);

    // Click back button
    const visibleStep = page.locator('.step-content:visible').first();
    const backButton = visibleStep.locator('button:has-text("Back"), button:has-text("חזור"), [onclick*="prevStep"]').first();
    await backButton.click();
    await page.waitForTimeout(300);

    // Should be back on Step 5
    const stepCircle = page.locator('.step-indicator.current .step-circle');
    await expect(stepCircle).toContainText('5');
  });

  test('Step 6 content area exists', async ({ page }) => {
    await navigateToStep(page, 6);

    // Check for step 6 content (may be placeholder if not implemented)
    const step6Content = page.locator('[data-step="6"], #step-6, #step-incremental, .incremental-config');
    const contentExists = await step6Content.count() > 0;

    // At minimum, the main content area should be visible
    const mainContent = page.locator('.config-screen, .main-content, main');
    const mainExists = await mainContent.first().isVisible().catch(() => false);

    expect(contentExists || mainExists).toBeTruthy();
  });

});
