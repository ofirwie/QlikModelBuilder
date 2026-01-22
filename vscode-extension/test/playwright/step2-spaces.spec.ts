/**
 * Playwright tests for Step 2: Space Selection
 * Tests the Space Selection UI independently of VS Code
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Mock spaces data
const mockSpaces = [
  { id: 'space-1', name: 'Personal Space', type: 'personal' },
  { id: 'space-2', name: 'Sales Team', type: 'shared' },
  { id: 'space-3', name: 'Marketing Analytics', type: 'managed' },
];

/**
 * Extracts the getDashboardScript content from the compiled dashboardUI.js
 */
function extractDashboardScript(): string {
  const dashboardUIPath = path.join(__dirname, '../../out/ui/dashboardUI.js');

  if (!fs.existsSync(dashboardUIPath)) {
    return '// dashboardUI.js not found';
  }

  const code = fs.readFileSync(dashboardUIPath, 'utf-8');

  const funcStartMatch = code.match(/function getDashboardScript\(\)\s*\{\s*return\s*`/);
  if (!funcStartMatch) {
    return '// Could not find getDashboardScript start';
  }

  const startIndex = funcStartMatch.index! + funcStartMatch[0].length;

  const endPattern = /`;\s*\n\}/g;
  endPattern.lastIndex = startIndex;
  const endMatch = endPattern.exec(code);

  if (!endMatch) {
    return '// Could not find getDashboardScript end';
  }

  let script = code.substring(startIndex, endMatch.index);
  script = script.replace(/\\`/g, '`');
  script = script.replace(/\\\$/g, '$');

  return script;
}

/**
 * Extracts the getDashboardStyles content from the compiled dashboardUI.js
 */
function extractDashboardStyles(): string {
  const dashboardUIPath = path.join(__dirname, '../../out/ui/dashboardUI.js');

  if (!fs.existsSync(dashboardUIPath)) {
    return '/* dashboardUI.js not found */';
  }

  const code = fs.readFileSync(dashboardUIPath, 'utf-8');

  const stylesMatch = code.match(/function getDashboardStyles\(\)\s*\{[\s\S]*?return\s*`([\s\S]*?)`;[\s\S]*?\}/);

  if (!stylesMatch) {
    return '/* Could not extract getDashboardStyles */';
  }

  return stylesMatch[1];
}

/**
 * Extracts the wizard HTML from the compiled wizardPanel.js
 */
function extractWebviewHtml(): string {
  const wizardPanelPath = path.join(__dirname, '../../out/wizardPanel.js');

  if (!fs.existsSync(wizardPanelPath)) {
    throw new Error(`wizardPanel.js not found at ${wizardPanelPath}. Run: npm run compile`);
  }

  const code = fs.readFileSync(wizardPanelPath, 'utf-8');
  const htmlMatch = code.match(/return\s*`(<!DOCTYPE html>[\s\S]*?)<\/html>`/);

  if (!htmlMatch) {
    throw new Error('Could not extract HTML from wizardPanel.js');
  }

  let html = htmlMatch[1] + '</html>';

  // Replace template literals with test values
  html = html.replace(/\$\{nonce\}/g, 'test-nonce');
  html = html.replace(/\$\{[^}]*cspSource[^}]*\}/g, "'self' 'unsafe-inline'");
  html = html.replace(/\$\{[^}]+styleUri[^}]*\}/g, '');
  html = html.replace(/\$\{[^}]+scriptUri[^}]*\}/g, '');

  // Replace CSP meta tag to allow inline scripts for testing
  html = html.replace(
    /<meta http-equiv="Content-Security-Policy"[^>]*>/,
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'self\' \'unsafe-inline\'; script-src \'unsafe-inline\';">'
  );

  // Remove nonce attributes from script tags
  html = html.replace(/ nonce="[^"]*"/g, '');

  // Replace getDashboardStyles placeholder with actual styles
  const dashboardStyles = extractDashboardStyles();
  html = html.replace('${(0, dashboardUI_1.getDashboardStyles)()}', dashboardStyles);

  // Replace getDashboardScript placeholder with actual script content
  const dashboardScript = extractDashboardScript();
  html = html.replace('${(0, dashboardUI_1.getDashboardScript)()}', dashboardScript);

  // Inject mock vscode API with spaces support
  const mockVsCodeApi = `
    <script>
      window.wizardState = {
        currentStep: 1,
        entryPoint: null,
        selectedSpaceId: null,
        selectedTables: [],
        spaces: [],
        spacesLoading: true,
        spacesError: null,
        createSpaceLoading: false
      };

      window.setStateCalls = [];
      window.postMessageLog = [];

      window.acquireVsCodeApi = function() {
        return {
          postMessage: function(msg) {
            console.log('postMessage:', JSON.stringify(msg));
            window.lastMessage = msg;
            window.postMessageLog.push(msg);

            // Auto-respond to getInitialData
            if (msg.type === 'getInitialData') {
              setTimeout(() => {
                window.dispatchEvent(new MessageEvent('message', {
                  data: {
                    type: 'initialData',
                    configured: true,
                    tenantUrl: 'https://test.qlik.com'
                  }
                }));
              }, 50);
            }

            // Auto-respond to getSpaces request
            if (msg.type === 'getSpaces') {
              setTimeout(() => {
                window.dispatchEvent(new MessageEvent('message', {
                  data: {
                    type: 'spaces',
                    data: ${JSON.stringify(mockSpaces)}
                  }
                }));
              }, 100);
            }

            // Auto-respond to createSpace request
            if (msg.type === 'createSpace') {
              const name = msg.name;
              if (name && name.trim()) {
                setTimeout(() => {
                  window.dispatchEvent(new MessageEvent('message', {
                    data: {
                      type: 'spaceCreated',
                      space: { id: 'new-space-' + Date.now(), name: name, type: 'shared' }
                    }
                  }));
                }, 100);
              } else {
                setTimeout(() => {
                  window.dispatchEvent(new MessageEvent('message', {
                    data: {
                      type: 'createSpaceError',
                      message: 'Space name is required'
                    }
                  }));
                }, 100);
              }
            }
          },
          getState: function() { return window.wizardState; },
          setState: function(state) {
            window.setStateCalls.push(state);
            window.wizardState = { ...window.wizardState, ...state };
            return window.wizardState;
          }
        };
      };
    </script>
  `;
  html = html.replace('</head>', mockVsCodeApi + '</head>');

  return html;
}

/**
 * Navigates to Step 2 by selecting an entry point and clicking Next
 */
async function navigateToStep2(page: any) {
  // Wait for initialization
  await page.waitForTimeout(500);

  // Debug: check what functions are available
  const debug = await page.evaluate(() => {
    return {
      hasSelectEntry: !!(window as any).selectEntry,
      hasNextStep: !!(window as any).nextStep,
      hasVscode: typeof (window as any).vscode !== 'undefined',
      hasWizardState: !!(window as any).wizardState
    };
  });
  console.log('Debug:', debug);

  // Select "From Spec File" entry option
  await page.evaluate(() => {
    if ((window as any).selectEntry) {
      (window as any).selectEntry('spec');
    }
  });
  await page.waitForTimeout(200);

  // Go to Step 2 using nextStep or manual state change
  await page.evaluate(() => {
    if ((window as any).nextStep) {
      (window as any).nextStep();
    } else {
      // Fallback: manually show Step 2
      const step1 = document.getElementById('step-1');
      const step2 = document.getElementById('step-2');
      if (step1) step1.style.display = 'none';
      if (step2) step2.style.display = 'block';
    }
  });
  await page.waitForTimeout(300);
}

test.describe('Step 2: Space Selection UI Tests', () => {

  test.beforeEach(async ({ page }) => {
    const html = extractWebviewHtml();
    await page.setContent(html);
    await page.waitForTimeout(500);
  });

  test('shows loading state initially when navigating to Step 2', async ({ page }) => {
    // Navigate to Step 2
    await navigateToStep2(page);

    // Initially, loading state should be shown briefly
    // Since mock auto-responds, we check the loading element exists
    const loadingEl = page.locator('#spaces-loading');
    await expect(loadingEl).toBeAttached();
  });

  test('displays spaces list when loaded', async ({ page }) => {
    // Navigate to Step 2
    await navigateToStep2(page);

    // Verify Step 2 is visible
    const step2 = page.locator('#step-2');
    await expect(step2).toBeVisible({ timeout: 5000 });

    // Wait for spaces to load (mock responds after 100ms)
    await page.waitForTimeout(500);

    // Spaces list should be visible (or loading)
    const spacesList = page.locator('#spaces-list');
    await expect(spacesList).toBeVisible({ timeout: 5000 });

    // Should show all 3 mock spaces
    const spaceItems = page.locator('#spaces-radio-list li');
    await expect(spaceItems).toHaveCount(3);

    // Check space names are displayed
    await expect(page.locator('text=Personal Space')).toBeVisible();
    await expect(page.locator('text=Sales Team')).toBeVisible();
    await expect(page.locator('text=Marketing Analytics')).toBeVisible();
  });

  test('selects space on click', async ({ page }) => {
    // Navigate to Step 2
    await navigateToStep2(page);

    // Wait for spaces to load
    await page.waitForTimeout(300);

    // Click on Sales Team space radio button
    const salesTeamRadio = page.locator('input[type="radio"][value="space-2"]');
    await salesTeamRadio.click();

    // Radio should be checked
    await expect(salesTeamRadio).toBeChecked();
  });

  test('Next button is enabled when space is selected', async ({ page }) => {
    // Navigate to Step 2
    await navigateToStep2(page);

    // Wait for spaces to load
    await page.waitForTimeout(300);

    // Select a space (ensure one is selected)
    const radio = page.locator('input[type="radio"][value="space-1"]');
    await radio.click();
    await page.waitForTimeout(100);

    // Next button should be enabled when a space is selected
    const nextButton = page.locator('#btn-next-2');
    await expect(nextButton).toBeEnabled();

    // Verify the radio is checked
    await expect(radio).toBeChecked();
  });

  test('shows create space input section', async ({ page }) => {
    // Navigate to Step 2
    await navigateToStep2(page);

    // Wait for page to render
    await page.waitForTimeout(300);

    // Create space section should be visible
    const createSection = page.locator('#create-space-section');
    await expect(createSection).toBeVisible();

    // Input field should exist
    const nameInput = page.locator('#new-space-name');
    await expect(nameInput).toBeVisible();

    // Create button should exist
    const createButton = page.locator('#btn-create-space');
    await expect(createButton).toBeVisible();
  });

  test('validates empty space name', async ({ page }) => {
    // Navigate to Step 2
    await navigateToStep2(page);

    // Wait for page to render
    await page.waitForTimeout(300);

    // Ensure input is empty
    const nameInput = page.locator('#new-space-name');
    await nameInput.fill('');

    // Click create button with empty name
    await page.locator('#btn-create-space').click();
    await page.waitForTimeout(150);

    // Error message should be displayed
    const errorEl = page.locator('#create-space-error');
    await expect(errorEl).toBeVisible();
    const errorText = await errorEl.textContent();
    expect(errorText).toContain('name');
  });

  test('creates new space and selects it', async ({ page }) => {
    // Navigate to Step 2
    await navigateToStep2(page);

    // Wait for spaces to load
    await page.waitForTimeout(300);

    // Enter new space name
    const nameInput = page.locator('#new-space-name');
    await nameInput.fill('My New Space');

    // Click create button
    await page.locator('#btn-create-space').click();

    // Wait for space creation response
    await page.waitForTimeout(300);

    // New space should appear in the list
    await expect(page.locator('text=My New Space')).toBeVisible();

    // The new space should be selected (radio checked)
    // Find the radio button in the list item containing "My New Space"
    const newSpaceItem = page.locator('#spaces-radio-list li').filter({ hasText: 'My New Space' });
    const newSpaceRadio = newSpaceItem.locator('input[type="radio"]');
    await expect(newSpaceRadio).toBeChecked();

    // Next button should be enabled after creation
    const nextButton = page.locator('#btn-next-2');
    await expect(nextButton).toBeEnabled();
  });

  test('Back button navigates to Step 1', async ({ page }) => {
    // Navigate to Step 2
    await navigateToStep2(page);

    // Wait for page to render
    await page.waitForTimeout(300);

    // Click Back button
    await page.locator('#btn-back').click();
    await page.waitForTimeout(200);

    // Step 1 should be visible again
    const step1 = page.locator('#step-1, [data-step="1"]').first();
    await expect(step1).toBeVisible();

    // Step 2 should be hidden
    const step2 = page.locator('#step-2');
    await expect(step2).not.toBeVisible();
  });

  test('displays space type information', async ({ page }) => {
    // Navigate to Step 2
    await navigateToStep2(page);

    // Wait for spaces to load
    await page.waitForTimeout(300);

    // Check that space types are displayed (use exact match for type spans)
    await expect(page.locator('.item-type:has-text("personal")')).toBeVisible();
    await expect(page.locator('.item-type:has-text("shared")')).toBeVisible();
    await expect(page.locator('.item-type:has-text("managed")')).toBeVisible();
  });

});
