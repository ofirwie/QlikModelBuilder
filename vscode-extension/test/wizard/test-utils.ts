/**
 * Shared test utilities for wizard smoke tests
 * Extracts and processes the wizard webview HTML for testing
 */
import * as fs from 'fs';
import * as path from 'path';
import type { Page } from '@playwright/test';

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

  // Replace template literals with test values
  html = html.replace(/\$\{[^}]+nonce[^}]*\}/g, 'test-nonce');
  html = html.replace(/\$\{[^}]+cspSource[^}]*\}/g, "'self'");
  html = html.replace(/\$\{[^}]+styleUri[^}]*\}/g, '');
  html = html.replace(/\$\{[^}]+scriptUri[^}]*\}/g, '');

  // Inject mock vscode API with wizard state support
  const mockVsCodeApi = `
    <script>
      window.wizardState = {
        currentStep: 1,
        entryPoint: null,
        selectedSpaceId: null,
        selectedTables: []
      };

      window.acquireVsCodeApi = function() {
        return {
          postMessage: function(msg) {
            console.log('postMessage:', JSON.stringify(msg));
            window.lastMessage = msg;
          },
          getState: function() { return window.wizardState; },
          setState: function(state) {
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
  }

  // Click next button to reach target step
  for (let i = 1; i < targetStep; i++) {
    const nextButton = page.locator('button:has-text("Next"), button:has-text("המשך"), #btn-next, [onclick*="nextStep"]');
    if (await nextButton.isEnabled()) {
      await nextButton.click();
      await page.waitForTimeout(300);
    }
  }
}
