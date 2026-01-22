/**
 * Simple Playwright tests - testing button functionality directly
 */

import { test, expect } from '@playwright/test';

// Create a simple test HTML that mimics the wizard structure
const testHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    .btn { padding: 10px; margin: 5px; cursor: pointer; }
    .btn-primary { background: green; color: white; }
    .btn-outline { background: transparent; border: 1px solid gray; }
    #app { padding: 20px; }
    .config-screen, .dashboard { display: none; }
    .config-screen.active, .dashboard.active { display: block; }
  </style>
</head>
<body>
  <div id="app">
    <!-- Config Screen (initial) -->
    <div class="config-screen active" id="configScreen">
      <h2>התחברות ל-Qlik Cloud</h2>
      <input type="text" id="tenantUrl" placeholder="Tenant URL">
      <input type="password" id="apiKey" placeholder="API Key">
      <button class="btn btn-primary" id="btnConnect">התחבר</button>
      <button class="btn btn-outline" id="btnSkipConnection">⏭️ דלג - עבוד במצב לא מקוון</button>
    </div>

    <!-- Dashboard (after skip/connect) -->
    <div class="dashboard" id="dashboard">
      <h2>Dashboard</h2>
      <div class="sidebar">
        <button class="btn btn-outline" id="btnUploadSpec" onclick="uploadSpec()">📋 העלה קובץ איפיון</button>
      </div>
      <div class="canvas">
        <div id="tablesList"></div>
        <button class="btn btn-outline" id="btnGenerateScript" onclick="generateScript()">📜 צור סקריפט</button>
        <button class="btn btn-primary" id="btnDeploy" onclick="deployToQlik()">🚀 Deploy ל-Qlik</button>
        <button class="btn btn-outline" id="btnCopyScript" onclick="copyScript()">📋 העתק סקריפט</button>
      </div>
      <div id="scriptPreview"></div>
    </div>
  </div>

  <script>
    // State
    const state = {
      configured: false,
      tables: [],
      generatedScript: ''
    };

    // Mock VS Code API
    window.vscode = {
      postMessage: function(msg) {
        console.log('postMessage:', JSON.stringify(msg));
        window.lastMessage = msg;
      }
    };

    // Skip connection - switch to dashboard
    document.getElementById('btnSkipConnection').addEventListener('click', function() {
      state.configured = true;
      document.getElementById('configScreen').classList.remove('active');
      document.getElementById('dashboard').classList.add('active');
      vscode.postMessage({ type: 'showInfo', text: 'עובד במצב לא מקוון' });
    });

    // Upload spec
    function uploadSpec() {
      vscode.postMessage({ type: 'uploadSpec' });
    }

    // Generate script
    function generateScript() {
      const selectedTables = state.tables.filter(t => t.fields && t.fields.some(f => f.include)).map(t => t.name);
      if (selectedTables.length === 0) {
        vscode.postMessage({ type: 'showError', text: 'נא לבחור לפחות טבלה אחת עם שדות' });
        return;
      }
      vscode.postMessage({ type: 'generateScript', tables: selectedTables });
    }

    // Copy script
    function copyScript() {
      navigator.clipboard.writeText(state.generatedScript);
      vscode.postMessage({ type: 'showInfo', text: 'הסקריפט הועתק!' });
    }

    // Deploy
    function deployToQlik() {
      if (state.tables.length === 0) {
        vscode.postMessage({ type: 'showError', text: 'נא להוסיף טבלאות לפני Deploy' });
        return;
      }
      vscode.postMessage({ type: 'showInfo', text: 'Deploy ל-Qlik יתווסף בגרסה הבאה' });
    }
  </script>
</body>
</html>
`;

test.describe('Wizard Button Tests', () => {

  test.beforeEach(async ({ page }) => {
    await page.setContent(testHtml);
    await page.waitForTimeout(100);
  });

  test('should show config screen initially', async ({ page }) => {
    const configScreen = page.locator('#configScreen');
    await expect(configScreen).toHaveClass(/active/);

    const dashboard = page.locator('#dashboard');
    await expect(dashboard).not.toHaveClass(/active/);
  });

  test('should have skip connection button', async ({ page }) => {
    const skipButton = page.locator('#btnSkipConnection');
    await expect(skipButton).toBeVisible();
    const text = await skipButton.textContent();
    expect(text).toContain('דלג');
  });

  test('clicking skip should show dashboard', async ({ page }) => {
    // Click skip
    await page.click('#btnSkipConnection');
    await page.waitForTimeout(100);

    // Config should be hidden
    const configScreen = page.locator('#configScreen');
    await expect(configScreen).not.toHaveClass(/active/);

    // Dashboard should be visible
    const dashboard = page.locator('#dashboard');
    await expect(dashboard).toHaveClass(/active/);
  });

  test('skip button should send showInfo message', async ({ page }) => {
    await page.click('#btnSkipConnection');

    const lastMessage = await page.evaluate(() => (window as any).lastMessage);
    expect(lastMessage).toBeDefined();
    expect(lastMessage.type).toBe('showInfo');
  });

  test('upload button should send uploadSpec message', async ({ page }) => {
    // First skip to get to dashboard
    await page.click('#btnSkipConnection');
    await page.waitForTimeout(100);

    // Click upload
    await page.click('#btnUploadSpec');

    const lastMessage = await page.evaluate(() => (window as any).lastMessage);
    expect(lastMessage).toBeDefined();
    expect(lastMessage.type).toBe('uploadSpec');
  });

  test('generate script with no tables should show error', async ({ page }) => {
    // First skip to get to dashboard
    await page.click('#btnSkipConnection');
    await page.waitForTimeout(100);

    // Click generate (no tables selected)
    await page.click('#btnGenerateScript');

    const lastMessage = await page.evaluate(() => (window as any).lastMessage);
    expect(lastMessage).toBeDefined();
    expect(lastMessage.type).toBe('showError');
    expect(lastMessage.text).toContain('טבלה');
  });

  test('deploy with no tables should show error', async ({ page }) => {
    // First skip to get to dashboard
    await page.click('#btnSkipConnection');
    await page.waitForTimeout(100);

    // Click deploy (no tables)
    await page.click('#btnDeploy');

    const lastMessage = await page.evaluate(() => (window as any).lastMessage);
    expect(lastMessage).toBeDefined();
    expect(lastMessage.type).toBe('showError');
  });

  test('all dashboard buttons should be visible after skip', async ({ page }) => {
    await page.click('#btnSkipConnection');
    await page.waitForTimeout(100);

    await expect(page.locator('#btnUploadSpec')).toBeVisible();
    await expect(page.locator('#btnGenerateScript')).toBeVisible();
    await expect(page.locator('#btnDeploy')).toBeVisible();
    await expect(page.locator('#btnCopyScript')).toBeVisible();
  });
});
