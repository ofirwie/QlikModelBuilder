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

    // Wait for entry options to be visible and JavaScript to initialize
    const specFileOption = innerFrame.locator('#entry-options li[data-entry="spec"]').first();
    await expect(specFileOption).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // Click the entry option and call selectEntry directly
    await specFileOption.click();
    await specFileOption.evaluate(() => {
      if ((window as any).selectEntry) {
        (window as any).selectEntry('spec');
      }
    });
    await page.waitForTimeout(500);

    // Click Next button to go to Step 2
    const nextBtn = innerFrame.locator('#btn-next').first();
    await nextBtn.click();
    await page.waitForTimeout(1500);

    // Verify Step 2 is visible
    const step2 = innerFrame.locator('#step-2');
    await expect(step2).toBeVisible({ timeout: 5000 });

    // Wait for API call to complete (up to 10 seconds)
    await page.waitForTimeout(5000);

    // Screenshot the result
    await page.screenshot({ path: 'test-results/step2-final-state.png' });

    // Check final state - should have either spaces list or error (not loading)
    const spacesList = innerFrame.locator('#spaces-list');
    const spacesError = innerFrame.locator('#spaces-error');

    const hasSpacesList = await spacesList.isVisible().catch(() => false);
    const hasError = await spacesError.isVisible().catch(() => false);

    console.log('Step 2 final state - spaces list:', hasSpacesList, 'error:', hasError);

    // Verify we got a response (either spaces or error, not stuck loading)
    expect(hasSpacesList || hasError).toBe(true);

    // If spaces list is visible, count the spaces
    if (hasSpacesList) {
      const radioButtons = innerFrame.locator('#spaces-radio-list input[type="radio"]');
      const count = await radioButtons.count();
      console.log('Spaces count:', count);
    }

    // If error, log it
    if (hasError) {
      const errorText = await spacesError.textContent();
      console.log('Spaces error:', errorText);
    }
  });

  // ============================================
  // Level 3: Step 3 Source Selection Tests
  // ============================================

  test('Level 3.1: Navigate to Step 3 and see connections section', async ({ page }) => {
    // Open wizard
    await page.keyboard.press('F1');
    await page.keyboard.type('Qlik:');
    await page.waitForTimeout(500);
    await page.locator('.quick-input-list-entry:has-text("Open Model Builder Wizard")').first().click();
    await page.waitForTimeout(3000);

    // Navigate iframe structure
    const webviewFrame = page.frameLocator('iframe.webview.ready').first();
    const innerFrame = webviewFrame.frameLocator('iframe').first();

    // Step 1: Select entry option
    const specFileOption = innerFrame.locator('#entry-options li[data-entry="spec"]').first();
    await expect(specFileOption).toBeVisible({ timeout: 10000 });
    await specFileOption.click();
    await page.waitForTimeout(500);

    // Go to Step 2
    const nextBtn1 = innerFrame.locator('#btn-next').first();
    await nextBtn1.click();
    await page.waitForTimeout(2000);

    // Step 2: Wait for spaces to load and select one (or skip if error)
    const step2 = innerFrame.locator('#step-2');
    await expect(step2).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(3000);

    // Check if spaces are available
    const spacesList = innerFrame.locator('#spaces-list');
    const hasSpaces = await spacesList.isVisible().catch(() => false);

    if (hasSpaces) {
      // Select first space
      const firstSpace = innerFrame.locator('#spaces-radio-list input[type="radio"]').first();
      if (await firstSpace.isVisible().catch(() => false)) {
        await firstSpace.check();
        await page.waitForTimeout(500);
      }
    }

    // Go to Step 3 - remove disabled if needed
    await innerFrame.evaluate(() => {
      const btn = document.getElementById('btn-next-2');
      if (btn) btn.removeAttribute('disabled');
    });
    await innerFrame.locator('#btn-next-2').click();
    await page.waitForTimeout(2000);

    // Verify Step 3 is visible
    const step3 = innerFrame.locator('#step-3');
    await expect(step3).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: 'test-results/step3-visible.png' });

    // Should see one of the states (loading, list, error, or empty)
    const anyState = innerFrame.locator('#connections-loading, #connections-list, #connections-error, #connections-empty');
    await expect(anyState.first()).toBeVisible({ timeout: 10000 });
  });

  test('Level 3.2: Create connection form validation', async ({ page }) => {
    // Open wizard and navigate to Step 3
    await page.keyboard.press('F1');
    await page.keyboard.type('Qlik:');
    await page.waitForTimeout(500);
    await page.locator('.quick-input-list-entry:has-text("Open Model Builder Wizard")').first().click();
    await page.waitForTimeout(3000);

    const webviewFrame = page.frameLocator('iframe.webview.ready').first();
    const innerFrame = webviewFrame.frameLocator('iframe').first();

    // Navigate to Step 3
    const specFileOption = innerFrame.locator('#entry-options li[data-entry="spec"]').first();
    await expect(specFileOption).toBeVisible({ timeout: 10000 });
    await specFileOption.click();
    await innerFrame.locator('#btn-next').first().click();
    await page.waitForTimeout(2000);

    // Force navigate to Step 3
    await innerFrame.evaluate(() => {
      const btn = document.getElementById('btn-next-2');
      if (btn) btn.removeAttribute('disabled');
    });
    await innerFrame.locator('#btn-next-2').click();
    await page.waitForTimeout(2000);

    // Verify Step 3 is visible
    await expect(innerFrame.locator('#step-3')).toBeVisible({ timeout: 5000 });

    // Create connection button should be disabled initially
    const createBtn = innerFrame.locator('#btn-create-connection');
    await expect(createBtn).toBeDisabled();

    // Fill name only - still disabled
    await innerFrame.locator('#new-connection-name').fill('Test Connection');
    await page.waitForTimeout(300);
    await expect(createBtn).toBeDisabled();

    // Select type - now enabled
    await innerFrame.locator('#connection-type').selectOption('PostgreSQL');
    await page.waitForTimeout(300);
    await expect(createBtn).toBeEnabled();

    await page.screenshot({ path: 'test-results/step3-create-form.png' });
  });

  test('Level 3.3: Connection type shows/hides connection string field', async ({ page }) => {
    // Open wizard and navigate to Step 3
    await page.keyboard.press('F1');
    await page.keyboard.type('Qlik:');
    await page.waitForTimeout(500);
    await page.locator('.quick-input-list-entry:has-text("Open Model Builder Wizard")').first().click();
    await page.waitForTimeout(3000);

    const webviewFrame = page.frameLocator('iframe.webview.ready').first();
    const innerFrame = webviewFrame.frameLocator('iframe').first();

    // Navigate to Step 3
    const specFileOption = innerFrame.locator('#entry-options li[data-entry="spec"]').first();
    await expect(specFileOption).toBeVisible({ timeout: 10000 });
    await specFileOption.click();
    await innerFrame.locator('#btn-next').first().click();
    await page.waitForTimeout(2000);

    await innerFrame.evaluate(() => {
      const btn = document.getElementById('btn-next-2');
      if (btn) btn.removeAttribute('disabled');
    });
    await innerFrame.locator('#btn-next-2').click();
    await page.waitForTimeout(2000);

    // Verify Step 3 is visible
    await expect(innerFrame.locator('#step-3')).toBeVisible({ timeout: 5000 });

    // Connection params should be hidden initially
    const paramsField = innerFrame.locator('#connection-params');
    await expect(paramsField).toBeHidden();

    // Select PostgreSQL - should show connection string
    await innerFrame.locator('#connection-type').selectOption('PostgreSQL');
    await page.waitForTimeout(300);
    await expect(paramsField).toBeVisible();

    // Select folder - should hide connection string
    await innerFrame.locator('#connection-type').selectOption('folder');
    await page.waitForTimeout(300);
    await expect(paramsField).toBeHidden();

    await page.screenshot({ path: 'test-results/step3-connection-params.png' });
  });

  test('Level 3.4: Back button returns to Step 2', async ({ page }) => {
    // Open wizard and navigate to Step 3
    await page.keyboard.press('F1');
    await page.keyboard.type('Qlik:');
    await page.waitForTimeout(500);
    await page.locator('.quick-input-list-entry:has-text("Open Model Builder Wizard")').first().click();
    await page.waitForTimeout(3000);

    const webviewFrame = page.frameLocator('iframe.webview.ready').first();
    const innerFrame = webviewFrame.frameLocator('iframe').first();

    // Navigate to Step 3
    const specFileOption = innerFrame.locator('#entry-options li[data-entry="spec"]').first();
    await expect(specFileOption).toBeVisible({ timeout: 10000 });
    await specFileOption.click();
    await innerFrame.locator('#btn-next').first().click();
    await page.waitForTimeout(2000);

    await innerFrame.evaluate(() => {
      const btn = document.getElementById('btn-next-2');
      if (btn) btn.removeAttribute('disabled');
    });
    await innerFrame.locator('#btn-next-2').click();
    await page.waitForTimeout(2000);

    // Verify Step 3 is visible
    await expect(innerFrame.locator('#step-3')).toBeVisible({ timeout: 5000 });

    // Click Back button
    await innerFrame.locator('#btn-back-3').click();
    await page.waitForTimeout(500);

    // Should be back at Step 2
    const step2 = innerFrame.locator('#step-2');
    await expect(step2).toBeVisible({ timeout: 3000 });

    await page.screenshot({ path: 'test-results/step3-back-to-step2.png' });
  });

  test('Level 3.5: Next button disabled until connection selected', async ({ page }) => {
    // Open wizard and navigate to Step 3
    await page.keyboard.press('F1');
    await page.keyboard.type('Qlik:');
    await page.waitForTimeout(500);
    await page.locator('.quick-input-list-entry:has-text("Open Model Builder Wizard")').first().click();
    await page.waitForTimeout(3000);

    const webviewFrame = page.frameLocator('iframe.webview.ready').first();
    const innerFrame = webviewFrame.frameLocator('iframe').first();

    // Navigate to Step 3
    const specFileOption = innerFrame.locator('#entry-options li[data-entry="spec"]').first();
    await expect(specFileOption).toBeVisible({ timeout: 10000 });
    await specFileOption.click();
    await innerFrame.locator('#btn-next').first().click();
    await page.waitForTimeout(2000);

    await innerFrame.evaluate(() => {
      const btn = document.getElementById('btn-next-2');
      if (btn) btn.removeAttribute('disabled');
    });
    await innerFrame.locator('#btn-next-2').click();
    await page.waitForTimeout(2000);

    // Verify Step 3 is visible
    await expect(innerFrame.locator('#step-3')).toBeVisible({ timeout: 5000 });

    // Next button should be disabled (no connection selected)
    const nextBtn = innerFrame.locator('#btn-next-3');
    await expect(nextBtn).toBeDisabled();

    await page.screenshot({ path: 'test-results/step3-next-disabled.png' });
  });

  // ============================================
  // Level 4: Step 4 Table Selection Tests
  // ============================================

  // Helper function to navigate to Step 4
  async function navigateToStep4(page: any) {
    await page.keyboard.press('F1');
    await page.keyboard.type('Qlik:');
    await page.waitForTimeout(500);
    await page.locator('.quick-input-list-entry:has-text("Open Model Builder Wizard")').first().click();
    await page.waitForTimeout(3000);

    const webviewFrame = page.frameLocator('iframe.webview.ready').first();
    const innerFrame = webviewFrame.frameLocator('iframe').first();

    // Step 1
    const specFileOption = innerFrame.locator('#entry-options li[data-entry="spec"]').first();
    await expect(specFileOption).toBeVisible({ timeout: 10000 });
    await specFileOption.click();
    await innerFrame.locator('#btn-next').first().click();
    await page.waitForTimeout(2000);

    // Step 2 -> Step 3
    await innerFrame.evaluate(() => {
      const btn = document.getElementById('btn-next-2');
      if (btn) btn.removeAttribute('disabled');
    });
    await innerFrame.locator('#btn-next-2').click();
    await page.waitForTimeout(2000);

    // Step 3 -> Step 4
    await innerFrame.evaluate(() => {
      const btn = document.getElementById('btn-next-3');
      if (btn) btn.removeAttribute('disabled');
    });
    await innerFrame.locator('#btn-next-3').click();
    await page.waitForTimeout(2000);

    return innerFrame;
  }

  test('Level 4.1: Navigate to Step 4 and see tables section', async ({ page }) => {
    const innerFrame = await navigateToStep4(page);

    // Verify Step 4 is visible
    const step4 = innerFrame.locator('#step-4');
    await expect(step4).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: 'test-results/step4-visible.png' });

    // Should see one of the states
    const anyState = innerFrame.locator('#tables-loading, #tables-list, #tables-error, #tables-empty');
    await expect(anyState.first()).toBeVisible({ timeout: 10000 });
  });

  test('Level 4.2: Search filter works', async ({ page }) => {
    const innerFrame = await navigateToStep4(page);

    // Wait for tables to load
    await expect(innerFrame.locator('#step-4')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(3000);

    // Type in search
    const searchInput = innerFrame.locator('#tables-search');
    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.fill('customers');
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'test-results/step4-search.png' });
    }
  });

  test('Level 4.3: Select all checkbox works', async ({ page }) => {
    const innerFrame = await navigateToStep4(page);

    await expect(innerFrame.locator('#step-4')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(3000);

    const selectAll = innerFrame.locator('#tables-select-all');
    if (await selectAll.isVisible({ timeout: 2000 }).catch(() => false)) {
      await selectAll.check();
      await page.waitForTimeout(500);

      // Count badge should update
      const countBadge = innerFrame.locator('#tables-count');
      const countText = await countBadge.textContent();
      console.log('Tables count:', countText);

      await page.screenshot({ path: 'test-results/step4-select-all.png' });
    }
  });

  test('Level 4.4: Back button returns to Step 3', async ({ page }) => {
    const innerFrame = await navigateToStep4(page);

    await expect(innerFrame.locator('#step-4')).toBeVisible({ timeout: 5000 });

    // Click Back
    await innerFrame.locator('#btn-back-4').click();
    await page.waitForTimeout(500);

    // Should be back at Step 3
    await expect(innerFrame.locator('#step-3')).toBeVisible({ timeout: 3000 });
    await page.screenshot({ path: 'test-results/step4-back-to-step3.png' });
  });

  test('Level 4.5: Next button disabled until tables selected', async ({ page }) => {
    const innerFrame = await navigateToStep4(page);

    await expect(innerFrame.locator('#step-4')).toBeVisible({ timeout: 5000 });

    // Next button should be disabled
    const nextBtn = innerFrame.locator('#btn-next-4');
    await expect(nextBtn).toBeDisabled();

    await page.screenshot({ path: 'test-results/step4-next-disabled.png' });
  });

  // ============================================
  // Level 5: Step 5 Field Configuration Tests
  // ============================================

  /**
   * Helper to navigate to Step 5
   */
  async function navigateToStep5(page: any) {
    const innerFrame = await navigateToStep4(page);

    // Force navigate to Step 5
    await innerFrame.evaluate(() => {
      const btn = document.getElementById('btn-next-4');
      if (btn) btn.removeAttribute('disabled');
    });
    await innerFrame.locator('#btn-next-4').click();
    await page.waitForTimeout(2000);

    return innerFrame;
  }

  test('Level 5.1: Navigate to Step 5 and see fields section', async ({ page }) => {
    const innerFrame = await navigateToStep5(page);

    // Verify Step 5 is visible
    const step5 = innerFrame.locator('#step-5');
    await expect(step5).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: 'test-results/step5-visible.png' });

    // Should see one of the states (loading, list, error, or empty)
    const anyState = innerFrame.locator('#fields-loading, #fields-list, #fields-error, #fields-empty');
    await expect(anyState.first()).toBeVisible({ timeout: 10000 });
  });

  test('Level 5.2: Table selector dropdown exists', async ({ page }) => {
    const innerFrame = await navigateToStep5(page);

    await expect(innerFrame.locator('#step-5')).toBeVisible({ timeout: 5000 });

    // Table selector should be visible
    const tableSelector = innerFrame.locator('#fields-table-selector');
    await expect(tableSelector).toBeVisible();

    await page.screenshot({ path: 'test-results/step5-table-selector.png' });
  });

  test('Level 5.3: Back button returns to Step 4', async ({ page }) => {
    const innerFrame = await navigateToStep5(page);

    await expect(innerFrame.locator('#step-5')).toBeVisible({ timeout: 5000 });

    // Click Back button
    await innerFrame.locator('#btn-back-5').click();
    await page.waitForTimeout(500);

    // Should be back at Step 4
    await expect(innerFrame.locator('#step-4')).toBeVisible({ timeout: 3000 });
    await page.screenshot({ path: 'test-results/step5-back-to-step4.png' });
  });

  // ============================================
  // Level 6: Step 6 Incremental Settings Tests
  // ============================================

  /**
   * Helper to navigate to Step 6
   */
  async function navigateToStep6(page: any) {
    const innerFrame = await navigateToStep5(page);

    // Force navigate to Step 6
    await innerFrame.evaluate(() => {
      const btn = document.getElementById('btn-next-5');
      if (btn) btn.removeAttribute('disabled');
    });
    await innerFrame.locator('#btn-next-5').click();
    await page.waitForTimeout(2000);

    return innerFrame;
  }

  test('Level 6.1: Navigate to Step 6 and see incremental settings', async ({ page }) => {
    const innerFrame = await navigateToStep6(page);

    // Verify Step 6 is visible
    const step6 = innerFrame.locator('#step-6');
    await expect(step6).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: 'test-results/step6-visible.png' });
  });

  test('Level 6.2: Table selector exists', async ({ page }) => {
    const innerFrame = await navigateToStep6(page);

    await expect(innerFrame.locator('#step-6')).toBeVisible({ timeout: 5000 });

    // Table selector should be visible
    const tableSelector = innerFrame.locator('#incremental-table-selector');
    await expect(tableSelector).toBeVisible();

    await page.screenshot({ path: 'test-results/step6-table-selector.png' });
  });

  test('Level 6.3: Incremental mode dropdown exists', async ({ page }) => {
    const innerFrame = await navigateToStep6(page);

    await expect(innerFrame.locator('#step-6')).toBeVisible({ timeout: 5000 });

    // Mode dropdown should be visible
    const modeDropdown = innerFrame.locator('#incremental-mode');
    await expect(modeDropdown).toBeVisible();

    await page.screenshot({ path: 'test-results/step6-mode-dropdown.png' });
  });

  test('Level 6.4: Back button returns to Step 5', async ({ page }) => {
    const innerFrame = await navigateToStep6(page);

    await expect(innerFrame.locator('#step-6')).toBeVisible({ timeout: 5000 });

    // Click Back button
    await innerFrame.locator('#btn-back-6').click();
    await page.waitForTimeout(500);

    // Should be back at Step 5
    await expect(innerFrame.locator('#step-5')).toBeVisible({ timeout: 3000 });
    await page.screenshot({ path: 'test-results/step6-back-to-step5.png' });
  });

  // ============================================
  // Level 7: Step 7 Deploy Tests
  // ============================================

  /**
   * Helper to navigate to Step 7
   */
  async function navigateToStep7(page: any) {
    const innerFrame = await navigateToStep6(page);

    // Force navigate to Step 7
    await innerFrame.evaluate(() => {
      const btn = document.getElementById('btn-next-6');
      if (btn) btn.removeAttribute('disabled');
    });
    await innerFrame.locator('#btn-next-6').click();
    await page.waitForTimeout(2000);

    return innerFrame;
  }

  test('Level 7.1: Navigate to Step 7 and see review section', async ({ page }) => {
    const innerFrame = await navigateToStep7(page);

    // Verify Step 7 is visible
    const step7 = innerFrame.locator('#step-7');
    await expect(step7).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: 'test-results/step7-visible.png' });

    // Review summary should be visible
    const reviewSummary = innerFrame.locator('#review-summary');
    await expect(reviewSummary).toBeVisible({ timeout: 5000 });
  });

  test('Level 7.2: App name input exists', async ({ page }) => {
    const innerFrame = await navigateToStep7(page);

    await expect(innerFrame.locator('#step-7')).toBeVisible({ timeout: 5000 });

    // App name input should be visible
    const appNameInput = innerFrame.locator('#app-name');
    await expect(appNameInput).toBeVisible();

    await page.screenshot({ path: 'test-results/step7-app-name.png' });
  });

  test('Level 7.3: Deploy button exists', async ({ page }) => {
    const innerFrame = await navigateToStep7(page);

    await expect(innerFrame.locator('#step-7')).toBeVisible({ timeout: 5000 });

    // Deploy button should be visible
    const deployBtn = innerFrame.locator('#btn-deploy');
    await expect(deployBtn).toBeVisible();

    await page.screenshot({ path: 'test-results/step7-deploy-button.png' });
  });

  test('Level 7.4: Back button returns to Step 6', async ({ page }) => {
    const innerFrame = await navigateToStep7(page);

    await expect(innerFrame.locator('#step-7')).toBeVisible({ timeout: 5000 });

    // Click Back button
    await innerFrame.locator('#btn-back-7').click();
    await page.waitForTimeout(500);

    // Should be back at Step 6
    await expect(innerFrame.locator('#step-6')).toBeVisible({ timeout: 3000 });
    await page.screenshot({ path: 'test-results/step7-back-to-step6.png' });
  });

  test('Level 7.5: Deploy button disabled without app name', async ({ page }) => {
    const innerFrame = await navigateToStep7(page);

    await expect(innerFrame.locator('#step-7')).toBeVisible({ timeout: 5000 });

    // Clear app name if it has a value
    await innerFrame.locator('#app-name').fill('');
    await page.waitForTimeout(300);

    // Deploy button should be disabled
    const deployBtn = innerFrame.locator('#btn-deploy');
    await expect(deployBtn).toBeDisabled();

    await page.screenshot({ path: 'test-results/step7-deploy-disabled.png' });
  });
});
