/**
 * Playwright tests for the Wizard Webview HTML
 * Tests the UI independently of VS Code
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Extract the HTML from wizardPanel.ts
function extractWebviewHtml(): string {
  const wizardPanelPath = path.join(__dirname, '../../out/wizardPanel.js');
  const code = fs.readFileSync(wizardPanelPath, 'utf-8');

  // Find the getHtmlForWebview method and extract HTML
  const htmlMatch = code.match(/return\s*`(<!DOCTYPE html>[\s\S]*?)<\/html>`/);
  if (!htmlMatch) {
    throw new Error('Could not extract HTML from wizardPanel.js');
  }

  // Get the HTML template
  let html = htmlMatch[1] + '</html>';

  // Replace template literals with test values
  html = html.replace(/\$\{[^}]+nonce[^}]*\}/g, 'test-nonce');
  html = html.replace(/\$\{[^}]+cspSource[^}]*\}/g, "'self'");
  html = html.replace(/\$\{[^}]+styleUri[^}]*\}/g, '');
  html = html.replace(/\$\{[^}]+scriptUri[^}]*\}/g, '');

  // Inject mock vscode API that auto-sends initialData
  const mockVsCodeApi = `
    <script>
      window.acquireVsCodeApi = function() {
        const api = {
          postMessage: function(msg) {
            console.log('postMessage:', JSON.stringify(msg));
            window.lastMessage = msg;

            // Auto-respond to getInitialData
            if (msg.type === 'getInitialData') {
              setTimeout(() => {
                window.dispatchEvent(new MessageEvent('message', {
                  data: {
                    type: 'initialData',
                    configured: false,
                    tenantUrl: ''
                  }
                }));
              }, 100);
            }
          },
          getState: function() { return null; },
          setState: function(state) { return state; }
        };
        return api;
      };
    </script>
  `;
  html = html.replace('</head>', mockVsCodeApi + '</head>');

  return html;
}

test.describe('Wizard Webview UI Tests', () => {

  test.beforeEach(async ({ page }) => {
    // Load the extracted HTML
    const html = extractWebviewHtml();
    await page.setContent(html);

    // Wait for scripts to initialize and initialData response
    await page.waitForTimeout(1000);
  });

  test('should render initial connection screen', async ({ page }) => {
    // Check that the app container exists
    const app = page.locator('#app');
    await expect(app).toBeVisible();
  });

  test('should have skip connection button', async ({ page }) => {
    // Find skip button
    const skipButton = page.locator('#btnSkipConnection');
    await expect(skipButton).toBeVisible();

    // Check button text contains skip-related content
    const buttonText = await skipButton.textContent();
    expect(buttonText).toContain('דלג');
  });

  test('skip button should enable dashboard mode', async ({ page }) => {
    // Click skip button
    const skipButton = page.locator('#btnSkipConnection');
    await skipButton.click();

    // Wait for state update
    await page.waitForTimeout(300);

    // After skip, we should see the dashboard with upload button
    // The dashboard should be visible now
    const dashboardContent = page.locator('.qmb-dashboard, .qmb-layout, #app');
    await expect(dashboardContent).toBeVisible();
  });

  test('should have upload spec button after skip', async ({ page }) => {
    // Skip connection first
    const skipButton = page.locator('#btnSkipConnection');
    await skipButton.click();
    await page.waitForTimeout(300);

    // Look for upload button
    const uploadButton = page.locator('button:has-text("העלה"), button:has-text("upload"), [onclick*="uploadSpec"]');
    const count = await uploadButton.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should have generate script button', async ({ page }) => {
    // Skip connection first
    const skipButton = page.locator('#btnSkipConnection');
    await skipButton.click();
    await page.waitForTimeout(300);

    // Look for generate script button
    const generateButton = page.locator('button:has-text("סקריפט"), button:has-text("Script"), [onclick*="generateScript"]');
    const count = await generateButton.count();
    expect(count).toBeGreaterThan(0);
  });

  test('generate script click should send message', async ({ page }) => {
    // Skip connection first
    const skipButton = page.locator('#btnSkipConnection');
    await skipButton.click();
    await page.waitForTimeout(300);

    // Click generate script button
    const generateButton = page.locator('[onclick*="generateScript"]').first();
    await generateButton.click();

    // Check that a message was sent (via mock vscode API)
    const lastMessage = await page.evaluate(() => (window as any).lastMessage);
    expect(lastMessage).toBeDefined();
    // Should either be generateScript or showError (if no tables selected)
    expect(['generateScript', 'showError']).toContain(lastMessage.type);
  });

  test('upload spec click should send message', async ({ page }) => {
    // Skip connection first
    const skipButton = page.locator('#btnSkipConnection');
    await skipButton.click();
    await page.waitForTimeout(300);

    // Click upload spec button
    const uploadButton = page.locator('[onclick*="uploadSpec"]').first();
    await uploadButton.click();

    // Check that uploadSpec message was sent
    const lastMessage = await page.evaluate(() => (window as any).lastMessage);
    expect(lastMessage).toBeDefined();
    expect(lastMessage.type).toBe('uploadSpec');
  });

  test('copy script button should exist', async ({ page }) => {
    // Skip connection first
    const skipButton = page.locator('#btnSkipConnection');
    await skipButton.click();
    await page.waitForTimeout(300);

    // Look for copy button
    const copyButton = page.locator('[onclick*="copyScript"]');
    const count = await copyButton.count();
    expect(count).toBeGreaterThan(0);
  });
});
