// test/wizard/wizard-state.spec.ts
import { test, expect } from '@playwright/test';
import { extractWebviewHtml } from './test-utils';

test.describe('Wizard State Management', () => {

  test.beforeEach(async ({ page }) => {
    const html = extractWebviewHtml();
    await page.setContent(html);
    await page.waitForTimeout(500);
  });

  test('initial state has currentStep=1 and entryPoint=null', async ({ page }) => {
    const state = await page.evaluate(() => (window as any).wizardState);
    expect(state.currentStep).toBe(1);
    expect(state.entryPoint).toBeNull();
  });

  test('state.entryPoint updates when option selected', async ({ page }) => {
    // Select scratch option
    await page.locator('[data-entry="scratch"]').click();

    const state = await page.evaluate(() => (window as any).wizardState);
    expect(state.entryPoint).toBe('scratch');
  });

  test('state.currentStep updates when navigating', async ({ page }) => {
    // Select entry and navigate
    await page.locator('[data-entry="scratch"]').click();
    await page.locator('#btn-next, .btn-next-action, .btn-next').first().click();
    await page.waitForTimeout(300);

    const state = await page.evaluate(() => (window as any).wizardState);
    expect(state.currentStep).toBe(2);
  });

  test('state persists across step navigation', async ({ page }) => {
    // Select entry
    await page.locator('[data-entry="template"]').click();

    // Navigate forward
    await page.locator('#btn-next, .btn-next-action, .btn-next').first().click();
    await page.waitForTimeout(300);

    // Navigate back
    await page.locator('#btn-back, .btn-back-action, .btn-back').first().click();
    await page.waitForTimeout(300);

    // Check state still has the entry
    const state = await page.evaluate(() => (window as any).wizardState);
    expect(state.entryPoint).toBe('template');
    expect(state.currentStep).toBe(1);
  });

  test('vscode.setState is called on state changes', async ({ page }) => {
    // Clear previous setState calls from initialization
    await page.evaluate(() => {
      (window as any).setStateCalls = [];
    });

    // Make a selection
    await page.locator('[data-entry="spec"]').click();
    await page.waitForTimeout(300);

    // Check setState was called (tracked by mock vscode API in test-utils.ts)
    const calls = await page.evaluate(() => (window as any).setStateCalls);
    expect(calls.length).toBeGreaterThan(0);
  });

});
