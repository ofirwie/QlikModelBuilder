/**
 * Step 6: Incremental Load Settings - Unit Tests (TDD)
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Step 6: Incremental Load Settings', () => {
  let htmlContent: string;

  test.beforeAll(async () => {
    const wizardPath = path.join(__dirname, '../../out/wizardPanel.js');
    if (fs.existsSync(wizardPath)) {
      const content = fs.readFileSync(wizardPath, 'utf-8');
      const htmlMatches = content.match(/`([^`]*<div id="step-6"[^`]*)`/);
      if (htmlMatches) {
        htmlContent = htmlMatches[1];
      }
    }
    if (!htmlContent) {
      htmlContent = '<div>Step 6 not found</div>';
    }
  });

  test('should have step-6 container with correct data-step attribute', async ({ page }) => {
    await page.setContent(htmlContent);
    await expect(page.locator('#step-6')).toHaveAttribute('data-step', '6');
  });

  test('should have table selector dropdown', async ({ page }) => {
    await page.setContent(htmlContent);
    await expect(page.locator('#incremental-table-select')).toBeAttached();
  });

  test('should have incremental mode dropdown', async ({ page }) => {
    await page.setContent(htmlContent);
    await expect(page.locator('#incremental-mode')).toBeAttached();
  });

  test('should have timestamp field input', async ({ page }) => {
    await page.setContent(htmlContent);
    await expect(page.locator('#timestamp-field')).toBeAttached();
  });

  test('should have key field input', async ({ page }) => {
    await page.setContent(htmlContent);
    await expect(page.locator('#key-field')).toBeAttached();
  });

  test('should have navigation buttons (back, next)', async ({ page }) => {
    await page.setContent(htmlContent);
    await expect(page.locator('#btn-back-6')).toBeAttached();
    await expect(page.locator('#btn-next-6')).toBeAttached();
  });
});
