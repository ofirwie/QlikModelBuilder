/**
 * Step 1: Entry Point - Detailed Tests
 *
 * These tests verify the specific details of Step 1 Entry Point functionality
 * beyond the smoke tests. They check:
 * - All three entry options are visible (spec, template, scratch)
 * - Each option has correct labels and descriptions
 * - Only one entry can be selected at a time
 * - Selected entry is stored in state
 */

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

  test('spec option has correct label and description', async ({ page }) => {
    const specOption = page.locator('[data-entry="spec"]');
    const name = specOption.locator('.item-name');
    const type = specOption.locator('.item-type');

    await expect(name).toContainText('Spec');
    await expect(type).toContainText('Word');
  });

  test('template option has correct label and description', async ({ page }) => {
    const templateOption = page.locator('[data-entry="template"]');
    const name = templateOption.locator('.item-name');
    const type = templateOption.locator('.item-type');

    await expect(name).toContainText('Template');
    await expect(type).toContainText('predefined');
  });

  test('scratch option has correct label and description', async ({ page }) => {
    const scratchOption = page.locator('[data-entry="scratch"]');
    const name = scratchOption.locator('.item-name');
    const type = scratchOption.locator('.item-type');

    await expect(name).toContainText('Scratch');
    await expect(type).toContainText('step by step');
  });

  test('only one entry can be selected at a time', async ({ page }) => {
    // Select spec
    await page.locator('[data-entry="spec"]').click();
    await expect(page.locator('[data-entry="spec"].selected')).toHaveCount(1);

    // Select template (should deselect spec)
    await page.locator('[data-entry="template"]').click();
    await expect(page.locator('[data-entry="spec"].selected')).toHaveCount(0);
    await expect(page.locator('[data-entry="template"].selected')).toHaveCount(1);

    // Select scratch (should deselect template)
    await page.locator('[data-entry="scratch"]').click();
    await expect(page.locator('[data-entry="template"].selected')).toHaveCount(0);
    await expect(page.locator('[data-entry="scratch"].selected')).toHaveCount(1);
  });

  test('selected entry is stored in state', async ({ page }) => {
    await page.locator('[data-entry="scratch"]').click();

    const state = await page.evaluate(() => (window as any).wizardState);
    expect(state.entryPoint).toBe('scratch');
  });

  test('upload section is hidden initially', async ({ page }) => {
    const uploadSection = page.locator('#spec-upload-section');
    await expect(uploadSection).toBeHidden();
  });

  test('upload section appears when spec entry is selected', async ({ page }) => {
    // Select spec entry
    await page.locator('[data-entry="spec"]').click();
    await page.waitForTimeout(200);

    // Upload section should be visible
    const uploadSection = page.locator('#spec-upload-section');
    await expect(uploadSection).toBeVisible();

    // Upload button should exist
    const uploadButton = page.locator('#btn-upload-spec');
    await expect(uploadButton).toBeVisible();
  });

  test('upload section hides when other entry is selected', async ({ page }) => {
    // First select spec
    await page.locator('[data-entry="spec"]').click();
    await page.waitForTimeout(200);

    // Upload section should be visible
    await expect(page.locator('#spec-upload-section')).toBeVisible();

    // Select scratch
    await page.locator('[data-entry="scratch"]').click();
    await page.waitForTimeout(200);

    // Upload section should be hidden
    await expect(page.locator('#spec-upload-section')).toBeHidden();
  });

  test('upload button sends uploadSpec message', async ({ page }) => {
    // Select spec entry
    await page.locator('[data-entry="spec"]').click();
    await page.waitForTimeout(200);

    // Click upload button
    await page.locator('#btn-upload-spec').click();
    await page.waitForTimeout(100);

    // Check that message was sent
    const lastMessage = await page.evaluate(() => (window as any).lastMessage);
    expect(lastMessage?.type).toBe('uploadSpec');
  });

});
