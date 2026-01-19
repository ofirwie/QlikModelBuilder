/**
 * Shared test utilities for wizard smoke tests
 * Extracts and processes the wizard webview HTML for testing
 */
import * as fs from 'fs';
import * as path from 'path';
import type { Page } from '@playwright/test';

/**
 * Extracts the getDashboardScript content from the compiled dashboardUI.js
 */
function extractDashboardScript(): string {
  const dashboardUIPath = path.join(__dirname, '../../out/ui/dashboardUI.js');

  if (!fs.existsSync(dashboardUIPath)) {
    return '// dashboardUI.js not found';
  }

  const code = fs.readFileSync(dashboardUIPath, 'utf-8');

  // Find the start of getDashboardScript function
  const funcStartMatch = code.match(/function getDashboardScript\(\)\s*\{\s*return\s*`/);
  if (!funcStartMatch) {
    return '// Could not find getDashboardScript start';
  }

  const startIndex = funcStartMatch.index! + funcStartMatch[0].length;

  // Find the closing backtick followed by semicolon and end of function
  // The function ends with `;\n} at the end
  const endPattern = /`;\s*\n\}/g;
  endPattern.lastIndex = startIndex;
  let endMatch = endPattern.exec(code);

  if (!endMatch) {
    return '// Could not find getDashboardScript end';
  }

  // Extract content between the backticks
  let script = code.substring(startIndex, endMatch.index);

  // The extracted content has escaped template literals (\${...}) that need to be
  // converted to actual template literals for execution in HTML context.
  // In the compiled JS, \` is escaped backtick, \$ is escaped dollar sign.
  // When placed in HTML <script>, we need these to be actual backticks and dollars.

  // Unescape backticks: \\` -> `
  script = script.replace(/\\`/g, '`');

  // Unescape dollar signs in template literals: \\${ -> ${
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

  // Find getDashboardStyles function and extract its return value
  const stylesMatch = code.match(/function getDashboardStyles\(\)\s*\{[\s\S]*?return\s*`([\s\S]*?)`;[\s\S]*?\}/);

  if (!stylesMatch) {
    return '/* Could not extract getDashboardStyles */';
  }

  return stylesMatch[1];
}

/**
 * Extracts the wizard HTML from the compiled wizardPanel.js
 * Replaces template literals with test values and injects mock VS Code API
 */
export function extractWebviewHtml(): string {
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

  // Replace template literals with test values (these use ${...} in the template)
  html = html.replace(/\$\{nonce\}/g, 'test-nonce');
  html = html.replace(/\$\{[^}]*cspSource[^}]*\}/g, "'self' 'unsafe-inline'");
  html = html.replace(/\$\{[^}]+styleUri[^}]*\}/g, '');
  html = html.replace(/\$\{[^}]+scriptUri[^}]*\}/g, '');

  // Replace the entire CSP meta tag to allow inline scripts for testing
  // Use 'unsafe-inline' only (no nonce) to allow both script tags and inline event handlers
  html = html.replace(
    /<meta http-equiv="Content-Security-Policy"[^>]*>/,
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'self\' \'unsafe-inline\'; script-src \'unsafe-inline\';">'
  );

  // Remove nonce attributes from script tags so they work with unsafe-inline
  html = html.replace(/ nonce="[^"]*"/g, '');

  // Replace getDashboardStyles placeholder with actual styles
  const dashboardStyles = extractDashboardStyles();
  html = html.replace('${(0, dashboardUI_1.getDashboardStyles)()}', dashboardStyles);

  // Replace getDashboardScript placeholder with actual script content
  const dashboardScript = extractDashboardScript();
  html = html.replace('${(0, dashboardUI_1.getDashboardScript)()}', dashboardScript);

  // Inject mock vscode API with wizard state support
  const mockVsCodeApi = `
    <script>
      window.wizardState = {
        currentStep: 1,
        entryPoint: null,
        selectedSpaceId: null,
        selectedTables: []
      };

      // Track setState calls for testing
      window.setStateCalls = [];

      window.acquireVsCodeApi = function() {
        return {
          postMessage: function(msg) {
            console.log('postMessage:', JSON.stringify(msg));
            window.lastMessage = msg;
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
 * Navigates to a specific step in the wizard by selecting entries and clicking Next
 * @param page - Playwright page instance
 * @param targetStep - The step number to navigate to (1-7)
 */
export async function navigateToStep(page: Page, targetStep: number): Promise<void> {
  // First select an entry on step 1 to enable navigation
  const entryOption = page.locator('[data-entry], .entry-option, .item-list li').first();
  if (await entryOption.count() > 0) {
    await entryOption.click();
    await page.waitForTimeout(200);
  }

  // Click next button to reach target step
  for (let i = 1; i < targetStep; i++) {
    // Look for visible Next button in current step content
    const currentStepContent = page.locator(`.step-content:visible, [data-step="${i}"]:visible`).first();
    const nextButton = currentStepContent.locator('button:has-text("Next"), button:has-text("המשך"), .btn-next-action, .btn-next').first();

    try {
      await nextButton.waitFor({ state: 'visible', timeout: 3000 });
      await nextButton.click();
      await page.waitForTimeout(300);
    } catch {
      // If we can't find button in step content, try global search for visible button
      const globalNext = page.locator('button:visible:has-text("Next"), button:visible:has-text("המשך")').first();
      const isVisible = await globalNext.isVisible().catch(() => false);
      if (isVisible) {
        await globalNext.click();
        await page.waitForTimeout(300);
      } else {
        break;
      }
    }
  }
}
