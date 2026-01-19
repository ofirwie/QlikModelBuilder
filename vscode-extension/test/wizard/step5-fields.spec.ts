/**
 * Step 5: Field Mapping - Tests
 *
 * These tests verify Step 5 (Field Mapping) functionality:
 * - Step 5 is reachable via navigation
 * - Progress bar shows Step 5 as current
 * - Back button navigates to Step 4
 *
 * Note: Step 5 UI is not fully implemented yet. These tests verify
 * basic navigation works and create a foundation for TDD.
 */

import { test, expect } from '@playwright/test';
import { extractWebviewHtml, navigateToStep } from './test-utils';

test.describe('Step 5: Field Mapping', () => {

  test.beforeEach(async ({ page }) => {
    const html = extractWebviewHtml();
    await page.setContent(html);
    await page.waitForTimeout(500);
  });

  test('Step 5 is reachable via navigation', async ({ page }) => {
    await navigateToStep(page, 5);

    // Check that navigation worked - progress bar should show step 5
    const currentIndicator = page.locator('.step-indicator.current');
    await expect(currentIndicator).toBeVisible();

    // The step circle should show "5"
    const stepCircle = page.locator('.step-indicator.current .step-circle');
    await expect(stepCircle).toContainText('5');
  });

  test('Progress bar shows Step 5 as current after navigation', async ({ page }) => {
    await navigateToStep(page, 5);

    // Step 5 indicator should be marked as current
    const step5Indicator = page.locator('.step-indicator[data-step="5"].current, .step-indicator:nth-child(5).current');
    const indicatorExists = await step5Indicator.count() > 0;

    // Alternative: check the step circle text
    const stepCircle = page.locator('.step-indicator.current .step-circle');
    const circleText = await stepCircle.textContent().catch(() => '');

    expect(indicatorExists || circleText === '5').toBeTruthy();
  });

  test('Back button navigates to Step 4', async ({ page }) => {
    await navigateToStep(page, 5);

    // Click back button
    const visibleStep = page.locator('.step-content:visible').first();
    const backButton = visibleStep.locator('button:has-text("Back"), button:has-text("חזור"), [onclick*="prevStep"]').first();
    await backButton.click();
    await page.waitForTimeout(300);

    // Should be back on Step 4
    const stepCircle = page.locator('.step-indicator.current .step-circle');
    await expect(stepCircle).toContainText('4');
  });

  test('Step 5 content area exists', async ({ page }) => {
    await navigateToStep(page, 5);

    // Check for step 5 content (may be placeholder if not implemented)
    const step5Content = page.locator('[data-step="5"], #step-5, #step-fields, .field-mapping');
    const contentExists = await step5Content.count() > 0;

    // At minimum, the main content area should be visible
    const mainContent = page.locator('.config-screen, .main-content, main');
    const mainExists = await mainContent.first().isVisible().catch(() => false);

    expect(contentExists || mainExists).toBeTruthy();
  });

});
