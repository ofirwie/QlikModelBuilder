/**
 * Step 2: Space Selection - Tests
 *
 * These tests verify Step 2 (Space Selection) functionality:
 * - Step 2 content is visible after navigation
 * - Title and description are displayed
 * - Back button navigates to Step 1
 * - Progress bar shows Step 2 as current
 */

import { test, expect } from '@playwright/test';
import { extractWebviewHtml, navigateToStep } from './test-utils';

test.describe('Step 2: Space Selection', () => {

  test.beforeEach(async ({ page }) => {
    const html = extractWebviewHtml();
    await page.setContent(html);
    await page.waitForTimeout(500);
    // Navigate to Step 2
    await navigateToStep(page, 2);
  });

  test('Step 2 content is visible after navigation', async ({ page }) => {
    // Step 2 should be visible
    const step2Content = page.locator('[data-step="2"], #step-2, #step-space');
    await expect(step2Content.first()).toBeVisible();
  });

  test('Step 2 shows space selection title', async ({ page }) => {
    // Should have a title related to space selection
    const title = page.locator('h2, .step-title').filter({ hasText: /space/i });
    const count = await title.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('Back button navigates to Step 1', async ({ page }) => {
    // Click back button
    const backButton = page.locator('button:has-text("Back"), button:has-text("חזור"), #btn-back, .btn-back-action, .btn-back').first();
    await backButton.click();
    await page.waitForTimeout(300);

    // Should be back on Step 1
    const step1Content = page.locator('[data-step="1"], #step-1');
    await expect(step1Content.first()).toBeVisible();
  });

  test('Progress bar shows Step 2 as current', async ({ page }) => {
    // Progress bar should show step 2 as current
    const currentStep = page.locator('.step-indicator.current[data-step="2"], .step-indicator[data-step="2"].current');
    await expect(currentStep).toBeVisible();
  });

});
