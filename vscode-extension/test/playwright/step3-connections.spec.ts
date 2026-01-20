import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Step 3: Source Selection - Unit Tests (TDD - RED phase)
 *
 * These tests verify the HTML structure for Step 3 of the wizard.
 * Run with: npx playwright test test/playwright/step3-connections.spec.ts
 */

test.describe('Step 3: Source Selection - HTML Structure', () => {
  let htmlContent: string;

  test.beforeAll(async () => {
    // Try to extract HTML from compiled wizardPanel.js
    const wizardPath = path.join(__dirname, '../../out/wizardPanel.js');

    if (fs.existsSync(wizardPath)) {
      const content = fs.readFileSync(wizardPath, 'utf-8');
      // Extract the HTML by finding content between backticks that contains step-3
      // Look for the template literal that starts with <!DOCTYPE or <style or <div
      const htmlMatches = content.match(/`([^`]*<div id="step-3"[^`]*)`/);
      if (htmlMatches) {
        htmlContent = htmlMatches[1];
      } else {
        // Alternative: extract from _getHtmlContent or getWizardHtml
        const altMatch = content.match(/return\s*`(<!DOCTYPE[^`]*)`/);
        htmlContent = altMatch ? altMatch[1] : '';
      }
    } else {
      htmlContent = '';
    }
  });

  test('should have step-3 container with correct data-step attribute', async ({ page }) => {
    test.skip(!htmlContent, 'wizardPanel.js not compiled');
    await page.setContent(htmlContent);
    const step3 = page.locator('#step-3');
    await expect(step3).toHaveAttribute('data-step', '3');
  });

  test('should have loading state element', async ({ page }) => {
    test.skip(!htmlContent, 'wizardPanel.js not compiled');
    await page.setContent(htmlContent);
    const loading = page.locator('#connections-loading');
    await expect(loading).toBeAttached();
  });

  test('should have error state with retry button', async ({ page }) => {
    test.skip(!htmlContent, 'wizardPanel.js not compiled');
    await page.setContent(htmlContent);
    const error = page.locator('#connections-error');
    const retry = page.locator('#btn-connections-retry');
    await expect(error).toBeAttached();
    await expect(retry).toBeAttached();
  });

  test('should have configure credentials button for auth errors', async ({ page }) => {
    test.skip(!htmlContent, 'wizardPanel.js not compiled');
    await page.setContent(htmlContent);
    const configureBtn = page.locator('#btn-connections-configure');
    await expect(configureBtn).toBeAttached();
  });

  test('should have empty state element', async ({ page }) => {
    test.skip(!htmlContent, 'wizardPanel.js not compiled');
    await page.setContent(htmlContent);
    const empty = page.locator('#connections-empty');
    await expect(empty).toBeAttached();
  });

  test('should have connections list container with radio list', async ({ page }) => {
    test.skip(!htmlContent, 'wizardPanel.js not compiled');
    await page.setContent(htmlContent);
    const list = page.locator('#connections-list');
    const radioList = page.locator('#connections-radio-list');
    await expect(list).toBeAttached();
    await expect(radioList).toBeAttached();
  });

  test('should have create connection form with all inputs', async ({ page }) => {
    test.skip(!htmlContent, 'wizardPanel.js not compiled');
    await page.setContent(htmlContent);
    await expect(page.locator('#connection-type')).toBeAttached();
    await expect(page.locator('#new-connection-name')).toBeAttached();
    await expect(page.locator('#connection-string')).toBeAttached();
    await expect(page.locator('#btn-create-connection')).toBeAttached();
  });

  test('should have connection type dropdown with 6 options', async ({ page }) => {
    test.skip(!htmlContent, 'wizardPanel.js not compiled');
    await page.setContent(htmlContent);
    const options = page.locator('#connection-type option');
    // empty + PostgreSQL + MySQL + SQLServer + REST + folder = 6 options
    await expect(options).toHaveCount(6);
  });

  test('should have navigation buttons (back, next)', async ({ page }) => {
    test.skip(!htmlContent, 'wizardPanel.js not compiled');
    await page.setContent(htmlContent);
    await expect(page.locator('#btn-back-3')).toBeAttached();
    await expect(page.locator('#btn-next-3')).toBeAttached();
  });

  test('should have next button disabled by default', async ({ page }) => {
    test.skip(!htmlContent, 'wizardPanel.js not compiled');
    await page.setContent(htmlContent);
    await expect(page.locator('#btn-next-3')).toBeDisabled();
  });

  test('should have create connection button disabled by default', async ({ page }) => {
    test.skip(!htmlContent, 'wizardPanel.js not compiled');
    await page.setContent(htmlContent);
    await expect(page.locator('#btn-create-connection')).toBeDisabled();
  });

  test('should have connection params section hidden by default', async ({ page }) => {
    test.skip(!htmlContent, 'wizardPanel.js not compiled');
    await page.setContent(htmlContent);
    const paramsEl = page.locator('#connection-params');
    await expect(paramsEl).toBeAttached();
    // Check it has style="display: none"
    await expect(paramsEl).toHaveCSS('display', 'none');
  });
});
