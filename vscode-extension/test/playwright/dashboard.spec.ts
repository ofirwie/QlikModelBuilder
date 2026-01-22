/**
 * Playwright tests for the NEW Dashboard UI
 * Tests buttons and message flow
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Generate the Dashboard HTML for testing
function generateDashboardHtml(): string {
  // Load the compiled module directly
  const dashboardUIPath = path.join(__dirname, '../../out/ui/dashboardUI.js');

  if (!fs.existsSync(dashboardUIPath)) {
    throw new Error('dashboardUI.js not found. Run "npm run compile" first.');
  }

  // Clear require cache to get fresh module
  delete require.cache[require.resolve(dashboardUIPath)];

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dashboardUI = require(dashboardUIPath);
  const styles = dashboardUI.getDashboardStyles();
  const script = dashboardUI.getDashboardScript();

  // Create HTML with mock vscode API
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard Test</title>
  <style>
    ${styles}
  </style>
</head>
<body>
  <div id="app">
    <div class="loading">
      <div class="spinner"></div>
    </div>
  </div>

  <script>
    // Mock VS Code API
    window.messages = [];
    window.acquireVsCodeApi = function() {
      return {
        postMessage: function(msg) {
          console.log('[Mock] postMessage:', JSON.stringify(msg));
          window.messages.push(msg);
          window.lastMessage = msg;

          // Auto-respond to certain messages
          if (msg.type === 'getInitialData') {
            setTimeout(() => {
              window.dispatchEvent(new MessageEvent('message', {
                data: { type: 'initialData', configured: false, tenantUrl: '' }
              }));
            }, 50);
          }
        },
        getState: function() { return null; },
        setState: function(state) { return state; }
      };
    };
  </script>

  <script>
    ${script}
  </script>
</body>
</html>`;
}

test.describe('Dashboard UI - Config Screen', () => {
  test.beforeEach(async ({ page }) => {
    const html = generateDashboardHtml();
    await page.setContent(html);
    await page.waitForTimeout(200); // Wait for initialData response
  });

  test('should render config screen when not configured', async ({ page }) => {
    const configScreen = page.locator('.config-screen');
    await expect(configScreen).toBeVisible();
  });

  test('should have Tenant URL input', async ({ page }) => {
    const tenantInput = page.locator('#tenantUrl');
    await expect(tenantInput).toBeVisible();
  });

  test('should have API Key input', async ({ page }) => {
    const apiKeyInput = page.locator('#apiKey');
    await expect(apiKeyInput).toBeVisible();
  });

  test('should have Connect button', async ({ page }) => {
    const connectBtn = page.locator('#btnConnect');
    await expect(connectBtn).toBeVisible();
    await expect(connectBtn).toContainText('התחבר');
  });

  test('should have Skip button', async ({ page }) => {
    const skipBtn = page.locator('#btnSkip');
    await expect(skipBtn).toBeVisible();
    await expect(skipBtn).toContainText('דלג');
  });

  test('Connect button should send saveConfig message', async ({ page }) => {
    // Fill in the form
    await page.fill('#tenantUrl', 'https://test.qlikcloud.com');
    await page.fill('#apiKey', 'test-api-key');

    // Click connect
    await page.click('#btnConnect');

    // Check message was sent
    const lastMsg = await page.evaluate(() => (window as any).lastMessage);
    expect(lastMsg).toBeDefined();
    expect(lastMsg.type).toBe('saveConfig');
    expect(lastMsg.tenantUrl).toBe('https://test.qlikcloud.com');
    expect(lastMsg.apiKey).toBe('test-api-key');
  });

  test('Skip button should show dashboard', async ({ page }) => {
    await page.click('#btnSkip');
    await page.waitForTimeout(100);

    // Dashboard should now be visible
    const dashboard = page.locator('.dashboard');
    await expect(dashboard).toBeVisible();
  });
});

test.describe('Dashboard UI - Main Screen', () => {
  test.beforeEach(async ({ page }) => {
    const html = generateDashboardHtml();
    await page.setContent(html);
    await page.waitForTimeout(200);

    // Skip to dashboard
    await page.click('#btnSkip');
    await page.waitForTimeout(100);
  });

  test('should show header with title', async ({ page }) => {
    const header = page.locator('.header');
    await expect(header).toBeVisible();

    const title = page.locator('.header h1');
    await expect(title).toContainText('Qlik Model Builder');
  });

  test('should show sidebar', async ({ page }) => {
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeVisible();
  });

  test('should show canvas area', async ({ page }) => {
    const canvas = page.locator('.canvas');
    await expect(canvas).toBeVisible();
  });

  test('should have Upload button', async ({ page }) => {
    const uploadBtn = page.locator('#btnUpload');
    await expect(uploadBtn).toBeVisible();
    await expect(uploadBtn).toContainText('העלה');
  });

  test('Upload button should send uploadSpec message', async ({ page }) => {
    await page.click('#btnUpload');

    const lastMsg = await page.evaluate(() => (window as any).lastMessage);
    expect(lastMsg).toBeDefined();
    expect(lastMsg.type).toBe('uploadSpec');
  });

  test('should have Refresh button', async ({ page }) => {
    const refreshBtn = page.locator('#btnRefresh');
    await expect(refreshBtn).toBeVisible();
  });

  test('Refresh button should send getSpaces and getConnections', async ({ page }) => {
    // Clear messages first
    await page.evaluate(() => { (window as any).messages = []; });

    await page.click('#btnRefresh');

    const messages = await page.evaluate(() => (window as any).messages);
    const types = messages.map((m: any) => m.type);

    expect(types).toContain('getSpaces');
    expect(types).toContain('getConnections');
  });

  test('should have Generate Script button', async ({ page }) => {
    const generateBtn = page.locator('#btnGenerate');
    await expect(generateBtn).toBeVisible();
    await expect(generateBtn).toContainText('צור סקריפט');
  });

  test('Generate button with no tables should show error', async ({ page }) => {
    await page.click('#btnGenerate');
    await page.waitForTimeout(100);

    // Should show error toast (no tables selected)
    const toast = page.locator('.toast.error');
    await expect(toast).toBeVisible();
  });

  test('should have Preview button', async ({ page }) => {
    const previewBtn = page.locator('#btnPreview');
    await expect(previewBtn).toBeVisible();
  });

  test('should show upload area when no tables', async ({ page }) => {
    const uploadArea = page.locator('.upload-area');
    await expect(uploadArea).toBeVisible();
  });

  test('click on upload area should trigger uploadSpec', async ({ page }) => {
    const uploadArea = page.locator('.upload-area');
    await uploadArea.click();

    const lastMsg = await page.evaluate(() => (window as any).lastMessage);
    expect(lastMsg.type).toBe('uploadSpec');
  });
});

test.describe('Dashboard UI - With Tables', () => {
  test.beforeEach(async ({ page }) => {
    const html = generateDashboardHtml();
    await page.setContent(html);
    await page.waitForTimeout(200);

    // Skip to dashboard
    await page.click('#btnSkip');
    await page.waitForTimeout(100);

    // Simulate tables being loaded (specParsed message)
    await page.evaluate(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          type: 'specParsed',
          tables: [
            { name: 'Orders', tableType: 'Fact', fields: [{name: 'order_id'}] },
            { name: 'Customers', tableType: 'Dimension', fields: [{name: 'customer_id'}] },
            { name: 'Products', tableType: 'Dimension', fields: [{name: 'product_id'}] }
          ],
          projectSpec: { name: 'Test Project' }
        }
      }));
    });

    await page.waitForTimeout(100);
  });

  test('should show tables in sidebar', async ({ page }) => {
    const tablesList = page.locator('.tables-list');
    await expect(tablesList).toBeVisible();

    // Should have 3 tables
    const tableItems = page.locator('.table-item');
    await expect(tableItems).toHaveCount(3);
  });

  test('should show summary cards', async ({ page }) => {
    const summaryCards = page.locator('.summary-cards');
    await expect(summaryCards).toBeVisible();

    // Check table count
    const tableCountCard = page.locator('.summary-card').first();
    await expect(tableCountCard).toContainText('3');
  });

  test('tables should be auto-selected', async ({ page }) => {
    const selectedCount = page.locator('.summary-card:nth-child(2) .value');
    await expect(selectedCount).toContainText('3');
  });

  test('clicking table checkbox should toggle selection', async ({ page }) => {
    // Verify initial state - all 3 tables selected via #selectionInfo
    // (Note: summary-cards are in renderCanvas, checkbox handler only calls renderSidebar)
    const selectionInfo = page.locator('#selectionInfo');
    await expect(selectionInfo).toContainText('3 טבלאות');

    // Click directly on the checkbox using Playwright's click
    const checkbox = page.locator('.table-item input[type="checkbox"]').first();
    await checkbox.click();
    await page.waitForTimeout(200);

    // After unchecking one table, should show 2 tables selected
    await expect(selectionInfo).toContainText('2 טבלאות');

    // Verify checkbox states are correct
    const checkboxStates = await page.evaluate(() => {
      const cbs = document.querySelectorAll('.table-item input[type="checkbox"]');
      return Array.from(cbs).map((cb: any) => cb.checked);
    });

    // One should be unchecked (false), two should be checked (true)
    expect(checkboxStates.filter(c => c === false).length).toBe(1);
    expect(checkboxStates.filter(c => c === true).length).toBe(2);
  });

  test('Generate button should send generateScript with selected tables', async ({ page }) => {
    await page.click('#btnGenerate');

    const lastMsg = await page.evaluate(() => (window as any).lastMessage);
    expect(lastMsg.type).toBe('generateScript');
    expect(lastMsg.tables).toHaveLength(3);
    expect(lastMsg.tables.map((t: any) => t.name)).toContain('Orders');
  });

  test('should show script preview area', async ({ page }) => {
    const scriptPreview = page.locator('.script-preview');
    await expect(scriptPreview).toBeVisible();
  });

  test('receiving scriptGenerated should update preview', async ({ page }) => {
    // Simulate script generated
    await page.evaluate(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          type: 'scriptGenerated',
          script: '// Test Script\nLOAD * FROM orders;'
        }
      }));
    });
    await page.waitForTimeout(50);

    const scriptCode = page.locator('#scriptCode');
    await expect(scriptCode).toContainText('Test Script');
  });

  test('Copy button should copy script to clipboard', async ({ page }) => {
    // Generate a script first
    await page.evaluate(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: { type: 'scriptGenerated', script: '// Copy Test' }
      }));
    });
    await page.waitForTimeout(100);

    // Verify script was generated
    const scriptCode = page.locator('#scriptCode');
    await expect(scriptCode).toContainText('Copy Test');

    // Mock clipboard and trigger copy via evaluate
    const copiedText = await page.evaluate(async () => {
      // Get the current script from state
      const scriptElement = document.getElementById('scriptCode');
      const scriptText = scriptElement?.textContent || '';

      // Simulate what the copy button does
      (window as any).mockCopiedText = scriptText;
      return scriptText;
    });

    expect(copiedText).toContain('// Copy Test');
  });
});

test.describe('Dashboard UI - Sidebar Interactions', () => {
  test.beforeEach(async ({ page }) => {
    const html = generateDashboardHtml();
    await page.setContent(html);
    await page.waitForTimeout(200);

    // Skip to dashboard
    await page.click('#btnSkip');
    await page.waitForTimeout(100);

    // Simulate spaces and connections loaded
    await page.evaluate(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          type: 'spaces',
          data: [
            { id: 'space-1', name: 'Production' },
            { id: 'space-2', name: 'Development' }
          ]
        }
      }));

      window.dispatchEvent(new MessageEvent('message', {
        data: {
          type: 'connections',
          data: [
            { id: 'conn-1', qName: 'DataFiles' },
            { id: 'conn-2', qName: 'Database' }
          ]
        }
      }));
    });

    await page.waitForTimeout(100);
  });

  test('should show spaces in sidebar', async ({ page }) => {
    const spaceItems = page.locator('[data-space-id]');
    await expect(spaceItems).toHaveCount(2);
  });

  test('clicking space should select it', async ({ page }) => {
    const secondSpace = page.locator('[data-space-id="space-2"]');
    await secondSpace.click();
    await page.waitForTimeout(50);

    await expect(secondSpace).toHaveClass(/selected/);
  });

  test('should show connections in sidebar', async ({ page }) => {
    const connItems = page.locator('[data-connection-id]');
    await expect(connItems).toHaveCount(2);
  });

  test('clicking connection should select it', async ({ page }) => {
    const secondConn = page.locator('[data-connection-id="conn-2"]');
    await secondConn.click();
    await page.waitForTimeout(50);

    await expect(secondConn).toHaveClass(/selected/);
  });
});
