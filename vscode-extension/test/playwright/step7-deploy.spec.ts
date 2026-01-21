/**
 * Step 7: Review & Deploy - Unit Tests (TDD)
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Step 7: Review & Deploy', () => {
  let htmlContent: string;

  test.beforeAll(async () => {
    const wizardPath = path.join(__dirname, '../../out/wizardPanel.js');
    if (fs.existsSync(wizardPath)) {
      const content = fs.readFileSync(wizardPath, 'utf-8');
      const htmlMatches = content.match(/`([^`]*<div id="step-7"[^`]*)`/);
      if (htmlMatches) {
        htmlContent = htmlMatches[1];
      }
    }
    if (!htmlContent) {
      htmlContent = '<div>Step 7 not found</div>';
    }
  });

  test('should have step-7 container with correct data-step attribute', async ({ page }) => {
    await page.setContent(htmlContent);
    await expect(page.locator('#step-7')).toHaveAttribute('data-step', '7');
  });

  test('should have review summary section', async ({ page }) => {
    await page.setContent(htmlContent);
    await expect(page.locator('#review-summary')).toBeAttached();
    await expect(page.locator('#review-space-value')).toBeAttached();
    await expect(page.locator('#review-tables-value')).toBeAttached();
    await expect(page.locator('#review-fields-value')).toBeAttached();
  });

  test('should have app name input', async ({ page }) => {
    await page.setContent(htmlContent);
    await expect(page.locator('#app-name')).toBeAttached();
  });

  test('should have deploy button', async ({ page }) => {
    await page.setContent(htmlContent);
    await expect(page.locator('#btn-deploy')).toBeAttached();
  });

  test('should have deploy loading state', async ({ page }) => {
    await page.setContent(htmlContent);
    await expect(page.locator('#deploy-loading')).toBeAttached();
  });

  test('should have deploy error section', async ({ page }) => {
    await page.setContent(htmlContent);
    await expect(page.locator('#deploy-error')).toBeAttached();
    await expect(page.locator('#btn-deploy-retry')).toBeAttached();
  });

  test('should have deploy success section', async ({ page }) => {
    await page.setContent(htmlContent);
    await expect(page.locator('#deploy-success')).toBeAttached();
    await expect(page.locator('#btn-open-app')).toBeAttached();
  });

  test('should have navigation buttons (back)', async ({ page }) => {
    await page.setContent(htmlContent);
    await expect(page.locator('#btn-back-7')).toBeAttached();
  });
});
