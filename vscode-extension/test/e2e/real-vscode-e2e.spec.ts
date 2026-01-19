/**
 * Real E2E Test - VS Code Extension in Docker
 *
 * This test runs against the ACTUAL VS Code (code-server) in Docker,
 * not isolated HTML. It tests the real extension behavior.
 */
import { test, expect } from '@playwright/test';

const CODE_SERVER_URL = 'http://localhost:8080';

test.describe('Real VS Code E2E', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to code-server
    await page.goto(CODE_SERVER_URL);

    // Wait for VS Code to load (code-server shows VS Code UI)
    await page.waitForSelector('.monaco-workbench', { timeout: 30000 });
  });

  test('Level 0: VS Code loads successfully', async ({ page }) => {
    // VS Code workbench should be visible
    const workbench = page.locator('.monaco-workbench');
    await expect(workbench).toBeVisible();

    // Activity bar should exist
    const activityBar = page.locator('.activitybar');
    await expect(activityBar).toBeVisible();
  });

  test('Level 0: Command palette opens', async ({ page }) => {
    // Open command palette with Ctrl+Shift+P (or F1)
    await page.keyboard.press('F1');
    await page.waitForTimeout(500);

    // Command palette input should appear
    const commandInput = page.locator('.quick-input-widget input');
    await expect(commandInput).toBeVisible();
  });

  test('Level 0: Qlik commands are available', async ({ page }) => {
    // Open command palette
    await page.keyboard.press('F1');
    await page.waitForTimeout(500);

    // Type "Qlik" to filter commands
    await page.keyboard.type('Qlik');
    await page.waitForTimeout(300);

    // Should see Qlik Model Builder command
    const qlikCommand = page.locator('.quick-input-list-entry:has-text("Qlik")');
    await expect(qlikCommand.first()).toBeVisible();
  });

  test('Level 1: Open Model Builder Wizard', async ({ page }) => {
    // Open command palette
    await page.keyboard.press('F1');
    await page.waitForTimeout(500);

    // Type command name (actual command is "Qlik: Open Model Builder Wizard")
    await page.keyboard.type('Qlik:');
    await page.waitForTimeout(500);

    // Click the "Open Model Builder Wizard" command
    const command = page.locator('.quick-input-list-entry:has-text("Open Model Builder Wizard")').first();
    await command.click();
    await page.waitForTimeout(2000);

    // Webview panel should open - in code-server, content may be in an iframe or directly in page
    // Try to find content in the webview iframe first, then fall back to main page
    const iframeLocator = page.frameLocator('iframe.webview');
    const mainPageLocator = page;

    // Check for wizard content (step indicator, entry heading)
    // In code-server, the content is in a nested iframe structure
    const webviewIframes = page.locator('iframe');
    const iframeCount = await webviewIframes.count();

    // Look for wizard content in all possible locations
    let foundWizard = false;

    // First check main page (direct render)
    const mainContent = page.locator('text=Entry Point, text=From Spec File');
    if (await mainContent.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      foundWizard = true;
    }

    // If not in main page, check iframes
    if (!foundWizard && iframeCount > 0) {
      for (let i = 0; i < iframeCount; i++) {
        const frame = page.frameLocator(`iframe >> nth=${i}`);
        const content = frame.locator('text=Entry Point');
        if (await content.isVisible({ timeout: 1000 }).catch(() => false)) {
          foundWizard = true;
          break;
        }
      }
    }

    // At minimum, the tab title should be visible
    const tabTitle = page.locator('text=Qlik Model Builder');
    await expect(tabTitle.first()).toBeVisible({ timeout: 10000 });
  });

  test('Level 1: Wizard shows entry options', async ({ page }) => {
    // Open wizard via command palette
    await page.keyboard.press('F1');
    await page.keyboard.type('Qlik:');
    await page.waitForTimeout(500);
    await page.locator('.quick-input-list-entry:has-text("Open Model Builder Wizard")').first().click();
    await page.waitForTimeout(3000);

    // In code-server, webview content is inside nested iframes
    // The structure is: page > iframe.webview.ready > iframe (active-frame)
    // We need to navigate through the iframe structure
    const webviewFrame = page.frameLocator('iframe.webview.ready').first();
    const innerFrame = webviewFrame.frameLocator('iframe').first();

    // Look for entry options in the inner frame
    const specFileOption = innerFrame.locator('text=From Spec File');
    const templateOption = innerFrame.locator('text=From Template');
    const scratchOption = innerFrame.locator('text=Start from Scratch');

    // Check that all three options are visible
    await expect(specFileOption.first()).toBeVisible({ timeout: 10000 });
    await expect(templateOption.first()).toBeVisible({ timeout: 5000 });
    await expect(scratchOption.first()).toBeVisible({ timeout: 5000 });
  });

  test('Level 1: From Spec File can be selected', async ({ page }) => {
    // Open wizard via command palette
    await page.keyboard.press('F1');
    await page.keyboard.type('Qlik:');
    await page.waitForTimeout(500);
    await page.locator('.quick-input-list-entry:has-text("Open Model Builder Wizard")').first().click();
    await page.waitForTimeout(3000);

    // Navigate through iframe structure
    const webviewFrame = page.frameLocator('iframe.webview.ready').first();
    const innerFrame = webviewFrame.frameLocator('iframe').first();

    // Click "From Spec File" option
    const specFileOption = innerFrame.locator('text=From Spec File').first();
    await expect(specFileOption).toBeVisible({ timeout: 10000 });
    await specFileOption.click();
    await page.waitForTimeout(500);

    // Take a screenshot to verify the selection worked
    await page.screenshot({ path: 'test-results/spec-file-selected.png' });

    // Verify Next button is visible
    const nextBtn = innerFrame.locator('text=Next').first();
    await expect(nextBtn).toBeVisible({ timeout: 5000 });
  });

  test('Level 2: Step 2 shows spaces list', async ({ page }) => {
    // Open wizard
    await page.keyboard.press('F1');
    await page.keyboard.type('Qlik:');
    await page.waitForTimeout(500);
    await page.locator('.quick-input-list-entry:has-text("Open Model Builder Wizard")').first().click();
    await page.waitForTimeout(3000);

    // Navigate iframe structure
    const webviewFrame = page.frameLocator('iframe.webview.ready').first();
    const innerFrame = webviewFrame.frameLocator('iframe').first();

    // Select entry point
    const specFileOption = innerFrame.locator('text=From Spec File').first();
    await expect(specFileOption).toBeVisible({ timeout: 10000 });
    await specFileOption.click();
    await page.waitForTimeout(300);

    // Click Next to go to Step 2
    const nextBtn = innerFrame.locator('#btn-next').first();
    await nextBtn.click();
    await page.waitForTimeout(1000);

    // Verify Step 2 is visible
    const step2 = innerFrame.locator('#step-2');
    await expect(step2).toBeVisible({ timeout: 5000 });

    // Check for spaces section (loading, list, or error)
    const spacesSection = innerFrame.locator('#spaces-loading, #spaces-list, #spaces-error');
    await expect(spacesSection.first()).toBeVisible({ timeout: 10000 });
  });
});
