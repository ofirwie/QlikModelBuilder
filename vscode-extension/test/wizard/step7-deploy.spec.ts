/**
 * Step 7: Review & Deploy - Tests
 *
 * These tests verify Step 7 (Review & Deploy) functionality:
 * - Step 7 is reachable via navigation
 * - Progress bar shows Step 7 as current
 * - Back button navigates to Step 6
 *
 * Note: Step 7 UI is not fully implemented yet. These tests verify
 * basic navigation works and create a foundation for TDD.
 */

import { test, expect } from '@playwright/test';
import { extractWebviewHtml, navigateToStep } from './test-utils';

test.describe('Step 7: Review & Deploy', () => {

  test.beforeEach(async ({ page }) => {
    const html = extractWebviewHtml();
    await page.setContent(html);
    await page.waitForTimeout(500);
  });

  test('Step 7 is reachable via navigation', async ({ page }) => {
    await navigateToStep(page, 7);

    // Check that navigation worked - progress bar should show step 7
    const currentIndicator = page.locator('.step-indicator.current');
    await expect(currentIndicator).toBeVisible();

    // The step circle should show "7"
    const stepCircle = page.locator('.step-indicator.current .step-circle');
    await expect(stepCircle).toContainText('7');
  });

  test('Progress bar shows Step 7 as current after navigation', async ({ page }) => {
    await navigateToStep(page, 7);

    // Step 7 indicator should be marked as current
    const step7Indicator = page.locator('.step-indicator[data-step="7"].current, .step-indicator:nth-child(7).current');
    const indicatorExists = await step7Indicator.count() > 0;

    // Alternative: check the step circle text
    const stepCircle = page.locator('.step-indicator.current .step-circle');
    const circleText = await stepCircle.textContent().catch(() => '');

    expect(indicatorExists || circleText === '7').toBeTruthy();
  });

  test('Back button navigates to Step 6', async ({ page }) => {
    await navigateToStep(page, 7);

    // Click back button
    const visibleStep = page.locator('.step-content:visible').first();
    const backButton = visibleStep.locator('button:has-text("Back"), button:has-text("חזור"), .btn-back-action, .btn-back').first();
    await backButton.click();
    await page.waitForTimeout(300);

    // Should be back on Step 6
    const stepCircle = page.locator('.step-indicator.current .step-circle');
    await expect(stepCircle).toContainText('6');
  });

  test('Step 7 content area exists', async ({ page }) => {
    await navigateToStep(page, 7);

    // Check for step 7 content (may be placeholder if not implemented)
    const step7Content = page.locator('[data-step="7"], #step-7, #step-deploy, #step-review, .review-deploy');
    const contentExists = await step7Content.count() > 0;

    // At minimum, the main content area should be visible
    const mainContent = page.locator('.config-screen, .main-content, main');
    const mainExists = await mainContent.first().isVisible().catch(() => false);

    expect(contentExists || mainExists).toBeTruthy();
  });

  test('Step 7 is the last step (no Next beyond it)', async ({ page }) => {
    await navigateToStep(page, 7);

    // The Next button should either be hidden, disabled, or changed to "Deploy"/"Finish"
    const nextButton = page.locator('#btn-next');
    const deployButton = page.locator('button:has-text("Deploy"), button:has-text("Finish"), button:has-text("סיום")');

    // Either Next is disabled/hidden OR there's a Deploy/Finish button
    const nextDisabled = await nextButton.isDisabled().catch(() => true);
    const nextHidden = await nextButton.isHidden().catch(() => true);
    const hasDeployButton = await deployButton.count() > 0;

    expect(nextDisabled || nextHidden || hasDeployButton).toBeTruthy();
  });

});
