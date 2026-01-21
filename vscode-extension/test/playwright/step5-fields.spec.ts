/**
 * Step 5: Field Configuration - Unit Tests (TDD)
 *
 * Tests HTML structure extracted from compiled wizardPanel.js
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Step 5: Field Configuration', () => {
  let htmlContent: string;

  test.beforeAll(async () => {
    // Extract HTML from compiled wizardPanel.js
    const wizardPath = path.join(__dirname, '../../out/wizardPanel.js');
    if (fs.existsSync(wizardPath)) {
      const content = fs.readFileSync(wizardPath, 'utf-8');
      // Match the Step 5 HTML section
      const htmlMatches = content.match(/`([^`]*<div id="step-5"[^`]*)`/);
      if (htmlMatches) {
        htmlContent = htmlMatches[1];
      }
    }
    if (!htmlContent) {
      htmlContent = '<div>Step 5 not found</div>';
    }
  });

  test('should have step-5 container with correct data-step attribute', async ({ page }) => {
    await page.setContent(htmlContent);
    const step5 = page.locator('#step-5');
    await expect(step5).toHaveAttribute('data-step', '5');
  });

  test('should have loading state element', async ({ page }) => {
    await page.setContent(htmlContent);
    const loading = page.locator('#fields-loading');
    await expect(loading).toBeAttached();
  });

  test('should have error state with retry button', async ({ page }) => {
    await page.setContent(htmlContent);
    const error = page.locator('#fields-error');
    const retry = page.locator('#btn-fields-retry');
    await expect(error).toBeAttached();
    await expect(retry).toBeAttached();
  });

  test('should have table selector dropdown', async ({ page }) => {
    await page.setContent(htmlContent);
    const tableSelect = page.locator('#field-table-select');
    await expect(tableSelect).toBeAttached();
  });

  test('should have fields list container', async ({ page }) => {
    await page.setContent(htmlContent);
    const list = page.locator('#fields-list');
    const checkboxList = page.locator('#fields-checkbox-list');
    await expect(list).toBeAttached();
    await expect(checkboxList).toBeAttached();
  });

  test('should have select all checkbox', async ({ page }) => {
    await page.setContent(htmlContent);
    const selectAll = page.locator('#fields-select-all');
    await expect(selectAll).toBeAttached();
  });

  test('should have field count badge', async ({ page }) => {
    await page.setContent(htmlContent);
    const count = page.locator('#fields-count');
    await expect(count).toBeAttached();
  });

  test('should have search filter input', async ({ page }) => {
    await page.setContent(htmlContent);
    const search = page.locator('#fields-search');
    await expect(search).toBeAttached();
  });

  test('should have navigation buttons (back, next)', async ({ page }) => {
    await page.setContent(htmlContent);
    await expect(page.locator('#btn-back-5')).toBeAttached();
    await expect(page.locator('#btn-next-5')).toBeAttached();
  });

  test('should have next button disabled by default', async ({ page }) => {
    await page.setContent(htmlContent);
    await expect(page.locator('#btn-next-5')).toBeDisabled();
  });
});
