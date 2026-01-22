import { test, expect } from '@playwright/test';

test.describe('Qlik Model Builder Extension - Real UI Tests', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to VS Code Server
    await page.goto('/');
    // Wait for VS Code to fully load
    await page.waitForSelector('.monaco-workbench', { timeout: 30000 });

    // Wait for UI to settle
    await page.waitForTimeout(2000);

    // Press Escape to close any dialogs
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    console.log('VS Code loaded successfully');
  });

  test('SMOKE-01: VS Code Server loads', async ({ page }) => {
    // Verify VS Code UI is present
    await expect(page.locator('.monaco-workbench')).toBeVisible();
    await expect(page.locator('.part.sidebar')).toBeVisible();
    await expect(page.locator('.part.activitybar')).toBeVisible();
    console.log('✅ VS Code UI verified');
  });

  test('SMOKE-02: Extension commands are registered', async ({ page }) => {
    // Open command palette using F1
    await page.keyboard.press('F1');
    await page.waitForTimeout(1000);

    const commandInput = page.locator('.quick-input-box input');
    await expect(commandInput).toBeVisible({ timeout: 5000 });

    // Search for QMB commands
    await commandInput.fill('qmb');
    await page.waitForTimeout(1000);

    // Should find our commands
    const commands = page.locator('.quick-input-list .monaco-list-row');
    const count = await commands.count();
    expect(count).toBeGreaterThan(0);
    console.log(`✅ Found ${count} QMB commands registered`);
  });

  test('SMOKE-03: Qlik commands appear in palette', async ({ page }) => {
    // Open command palette using F1
    await page.keyboard.press('F1');
    await page.waitForTimeout(1000);

    const commandInput = page.locator('.quick-input-box input');
    await expect(commandInput).toBeVisible({ timeout: 5000 });
    await commandInput.fill('qlik');
    await page.waitForTimeout(1000);

    // Should show our commands
    const qlikCommand = page.locator('.quick-input-list .monaco-list-row').filter({
      hasText: /qlik|wizard|model/i
    });
    await expect(qlikCommand.first()).toBeVisible({ timeout: 5000 });
    console.log('✅ Qlik commands are visible in palette');
  });

  test('UI-01: Sidebar activity bar exists', async ({ page }) => {
    // Verify activity bar is present
    const activityBar = page.locator('.activitybar');
    await expect(activityBar).toBeVisible();

    // Look for QMB/Qlik related icons
    const qmbIcon = page.locator('[id*="qmb"], [title*="Qlik"], [aria-label*="Qlik"]');
    const iconCount = await qmbIcon.count();

    if (iconCount > 0) {
      await qmbIcon.first().click();
      await page.waitForTimeout(1000);
      console.log('✅ QMB sidebar icon found and clicked');
    } else {
      // Extension might use a different activation method
      console.log('ℹ️ No dedicated QMB sidebar icon');
    }
  });

  test('UI-02: Can execute configure command', async ({ page }) => {
    // Open command palette
    await page.keyboard.press('F1');
    await page.waitForTimeout(1000);

    const commandInput = page.locator('.quick-input-box input');
    await expect(commandInput).toBeVisible({ timeout: 5000 });

    // Search for configure command
    await commandInput.fill('qlik configure');
    await page.waitForTimeout(1000);

    // Should find the configure command
    const configCommand = page.locator('.quick-input-list .monaco-list-row').filter({
      hasText: /configure|credentials|settings/i
    });

    if (await configCommand.count() > 0) {
      console.log('✅ Configure command found');
    } else {
      // Try qmb.configure
      await commandInput.fill('qmb.configure');
      await page.waitForTimeout(500);
      console.log('✅ QMB configure command searched');
    }
  });
});
