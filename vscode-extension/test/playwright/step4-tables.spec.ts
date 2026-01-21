/**
 * Step 4: Table Selection - Unit Tests (TDD)
 *
 * Tests HTML structure extracted from compiled wizardPanel.js
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Step 4: Table Selection', () => {
  let htmlContent: string;

  test.beforeAll(async () => {
    // Extract HTML from compiled wizardPanel.js
    const wizardPath = path.join(__dirname, '../../out/wizardPanel.js');
    if (fs.existsSync(wizardPath)) {
      const content = fs.readFileSync(wizardPath, 'utf-8');
      // Match the Step 4 HTML section
      const htmlMatches = content.match(/`([^`]*<div id="step-4"[^`]*)`/);
      if (htmlMatches) {
        htmlContent = htmlMatches[1];
      }
    }
    if (!htmlContent) {
      htmlContent = '<div>Step 4 not found</div>';
    }
  });

  test('should have step-4 container with correct data-step attribute', async ({ page }) => {
    await page.setContent(htmlContent);
    const step4 = page.locator('#step-4');
    await expect(step4).toHaveAttribute('data-step', '4');
  });

  test('should have loading state element', async ({ page }) => {
    await page.setContent(htmlContent);
    const loading = page.locator('#tables-loading');
    await expect(loading).toBeAttached();
  });

  test('should have error state with retry button', async ({ page }) => {
    await page.setContent(htmlContent);
    const error = page.locator('#tables-error');
    const retry = page.locator('#btn-tables-retry');
    await expect(error).toBeAttached();
    await expect(retry).toBeAttached();
  });

  test('should have empty state element', async ({ page }) => {
    await page.setContent(htmlContent);
    const empty = page.locator('#tables-empty');
    await expect(empty).toBeAttached();
  });

  test('should have tables list container', async ({ page }) => {
    await page.setContent(htmlContent);
    const list = page.locator('#tables-list');
    const checkboxList = page.locator('#tables-checkbox-list');
    await expect(list).toBeAttached();
    await expect(checkboxList).toBeAttached();
  });

  test('should have select all checkbox', async ({ page }) => {
    await page.setContent(htmlContent);
    const selectAll = page.locator('#tables-select-all');
    await expect(selectAll).toBeAttached();
  });

  test('should have selected count badge', async ({ page }) => {
    await page.setContent(htmlContent);
    const count = page.locator('#tables-count');
    await expect(count).toBeAttached();
  });

  test('should have search filter input', async ({ page }) => {
    await page.setContent(htmlContent);
    const search = page.locator('#tables-search');
    await expect(search).toBeAttached();
  });

  test('should have navigation buttons (back, next)', async ({ page }) => {
    await page.setContent(htmlContent);
    await expect(page.locator('#btn-back-4')).toBeAttached();
    await expect(page.locator('#btn-next-4')).toBeAttached();
  });

  test('should have next button disabled by default', async ({ page }) => {
    await page.setContent(htmlContent);
    await expect(page.locator('#btn-next-4')).toBeDisabled();
  });
});
