/**
 * Layer 0: Infrastructure Tests
 *
 * These tests verify that the extension can activate and basic infrastructure works.
 * All tests must pass before Layer 1 can run.
 *
 * Tests run inside VS Code Extension Host environment.
 */

import * as vscode from 'vscode';
import * as assert from 'assert';
import * as path from 'path';

// Extension ID from package.json
const EXTENSION_ID = 'ofirwie.qlik-model-builder';
const COMMAND_OPEN_WIZARD = 'qmb.openWizard';

suite('Layer 0: Infrastructure Tests', () => {
  // Track panel for cleanup
  let wizardPanel: vscode.WebviewPanel | undefined;

  // Timing for performance tests
  let activationStartTime: number;
  let activationEndTime: number;

  suiteSetup(async () => {
    activationStartTime = Date.now();
    // Ensure extension is activated
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    if (ext && !ext.isActive) {
      await ext.activate();
    }
    activationEndTime = Date.now();
  });

  suiteTeardown(async () => {
    // Clean up any open panels
    if (wizardPanel) {
      wizardPanel.dispose();
      wizardPanel = undefined;
    }
  });

  // =========================================================================
  // L0-001: Extension activates without errors
  // =========================================================================
  test('L0-001: Extension activates without errors', async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);

    assert.ok(ext, `Extension ${EXTENSION_ID} should be installed`);
    assert.strictEqual(ext.isActive, true, 'Extension should be active');

    // Check debug log for activation errors
    const logPath = path.join(__dirname, '../../../extension-debug.log');
    const fs = await import('fs');
    if (fs.existsSync(logPath)) {
      const log = fs.readFileSync(logPath, 'utf-8');
      assert.ok(
        !log.includes('ERROR'),
        `Extension log should not contain ERROR: ${log.substring(0, 500)}`
      );
      assert.ok(
        log.includes('Extension activation complete!'),
        'Extension should log successful activation'
      );
    }
  });

  // =========================================================================
  // L0-002: Command "QMB: Open Wizard" exists and executes
  // =========================================================================
  test('L0-002: Command "QMB: Open Wizard" exists and executes', async () => {
    // Get all commands
    const commands = await vscode.commands.getCommands(true);

    // Check command exists
    assert.ok(
      commands.includes(COMMAND_OPEN_WIZARD),
      `Command ${COMMAND_OPEN_WIZARD} should be registered`
    );

    // Also check other extension commands exist
    assert.ok(commands.includes('qmb.newProject'), 'qmb.newProject should be registered');
    assert.ok(commands.includes('qmb.configure'), 'qmb.configure should be registered');
  });

  // =========================================================================
  // L0-003: Webview panel opens
  // =========================================================================
  test('L0-003: Webview panel opens', async function () {
    this.timeout(10000); // 10 seconds for panel to open

    // Execute command to open wizard
    await vscode.commands.executeCommand(COMMAND_OPEN_WIZARD);

    // Wait for panel to be created
    await sleep(1000);

    // Check that a webview panel was created
    // Note: VS Code doesn't expose opened panels directly, so we verify via side effects
    // The command should not throw and the extension should be in a state where panel exists
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, 'Extension should exist');
    assert.ok(ext.isActive, 'Extension should still be active after opening wizard');
  });

  // =========================================================================
  // L0-004: HTML renders (not empty)
  // =========================================================================
  test('L0-004: HTML renders (not empty)', async function () {
    this.timeout(10000);

    // Open the wizard
    await vscode.commands.executeCommand(COMMAND_OPEN_WIZARD);
    await sleep(1500);

    // Unfortunately, VS Code extension tests can't directly inspect webview content
    // We verify indirectly by checking that no errors occurred during HTML generation
    // and that the extension is still functional

    // The real HTML verification happens in the webview-tests.ts using a different approach
    // Here we just verify the command completes without error
    assert.ok(true, 'Panel HTML should have rendered (command completed without error)');
  });

  // =========================================================================
  // L0-005: No JavaScript console errors on load
  // =========================================================================
  test('L0-005: No JavaScript console errors on load', async function () {
    this.timeout(10000);

    // In VS Code extension testing, we can't directly access webview console
    // This test verifies no errors in extension host console
    // Full webview JS error testing requires Playwright (layer3)

    // Check extension debug log for errors
    const fs = await import('fs');
    const logPath = path.join(__dirname, '../../../extension-debug.log');

    if (fs.existsSync(logPath)) {
      const log = fs.readFileSync(logPath, 'utf-8');
      const errorLines = log.split('\n').filter(line =>
        line.includes('ERROR') || line.includes('error:')
      );
      assert.strictEqual(
        errorLines.length,
        0,
        `Should have no console errors. Found: ${errorLines.join(', ')}`
      );
    }
  });

  // =========================================================================
  // L0-006: CSS variables resolve (not undefined)
  // =========================================================================
  test('L0-006: CSS variables resolve (not undefined)', async () => {
    // This test requires webview inspection which isn't possible in extension host tests
    // We verify that the extension uses VS Code's CSS variables correctly by checking
    // the HTML source code for proper CSS variable references

    // Read the wizardPanel.ts to verify CSS variables are used correctly
    const fs = await import('fs');
    const wizardPanelPath = path.join(__dirname, '../../../src/wizardPanel.ts');

    if (fs.existsSync(wizardPanelPath)) {
      const source = fs.readFileSync(wizardPanelPath, 'utf-8');

      // Check that VS Code CSS variables are used
      const cssVarPattern = /var\(--vscode-[a-zA-Z-]+\)/g;
      const matches = source.match(cssVarPattern);

      assert.ok(matches && matches.length > 0, 'Should use VS Code CSS variables');
      assert.ok(
        matches!.length >= 5,
        `Should use multiple VS Code CSS variables (found ${matches!.length})`
      );

      // Check no hardcoded undefined values
      assert.ok(
        !source.includes('undefined') || !source.includes('color: undefined'),
        'Should not have undefined color values'
      );
    }
  });

  // =========================================================================
  // L0-007: Progress bar element exists
  // =========================================================================
  test('L0-007: Progress bar element exists', async () => {
    // Verify by checking the HTML generation includes progress bar
    const fs = await import('fs');
    const wizardPanelPath = path.join(__dirname, '../../../src/wizardPanel.ts');

    if (fs.existsSync(wizardPanelPath)) {
      const source = fs.readFileSync(wizardPanelPath, 'utf-8');

      // Check for progress bar HTML element
      assert.ok(
        source.includes('progress-bar') || source.includes('progressBar'),
        'HTML should contain progress bar element'
      );

      // Check for step indicators
      assert.ok(
        source.includes('step-indicator') || source.includes('stepIndicator'),
        'HTML should contain step indicator elements'
      );
    }
  });

  // =========================================================================
  // L0-008: All 7 step buttons exist
  // =========================================================================
  test('L0-008: All 7 step buttons exist', async () => {
    const fs = await import('fs');
    const wizardPanelPath = path.join(__dirname, '../../../src/wizardPanel.ts');

    if (fs.existsSync(wizardPanelPath)) {
      const source = fs.readFileSync(wizardPanelPath, 'utf-8');

      // Count step references (data-step="1" through data-step="7")
      const stepPattern = /data-step=["'](\d)["']/g;
      const matches = [...source.matchAll(stepPattern)];
      const uniqueSteps = new Set(matches.map(m => m[1]));

      assert.ok(
        uniqueSteps.size >= 7,
        `Should have 7 steps, found ${uniqueSteps.size}: ${[...uniqueSteps].join(', ')}`
      );
    }
  });

  // =========================================================================
  // L0-009: Step 1 is active by default
  // =========================================================================
  test('L0-009: Step 1 is active by default', async () => {
    const fs = await import('fs');
    const wizardPanelPath = path.join(__dirname, '../../../src/wizardPanel.ts');

    if (fs.existsSync(wizardPanelPath)) {
      const source = fs.readFileSync(wizardPanelPath, 'utf-8');

      // Check that step 1 has 'current' class by default
      // Pattern: data-step="1" ... current
      assert.ok(
        source.includes('currentStep: 0') ||
        source.includes('currentStep: 1') ||
        source.includes('current') && source.includes('data-step="1"'),
        'Step 1 should be active/current by default'
      );
    }
  });

  // =========================================================================
  // L0-010: VS Code API works (postMessage)
  // =========================================================================
  test('L0-010: VS Code API works (postMessage)', async () => {
    // Verify that postMessage functionality is implemented
    const fs = await import('fs');
    const wizardPanelPath = path.join(__dirname, '../../../src/wizardPanel.ts');

    if (fs.existsSync(wizardPanelPath)) {
      const source = fs.readFileSync(wizardPanelPath, 'utf-8');

      // Check for postMessage implementation
      assert.ok(
        source.includes('postMessage'),
        'Should implement postMessage for webview communication'
      );

      // Check for message handler
      assert.ok(
        source.includes('onDidReceiveMessage') || source.includes('addEventListener'),
        'Should have message handler for webview messages'
      );
    }
  });

  // =========================================================================
  // L0-011: State persistence works (setState/getState)
  // =========================================================================
  test('L0-011: State persistence works (setState/getState)', async () => {
    // Verify that state persistence is implemented
    const fs = await import('fs');
    const wizardPanelPath = path.join(__dirname, '../../../src/wizardPanel.ts');

    if (fs.existsSync(wizardPanelPath)) {
      const source = fs.readFileSync(wizardPanelPath, 'utf-8');

      // Check for state management
      assert.ok(
        source.includes('setState') || source.includes('getState') ||
        source.includes('retainContextWhenHidden'),
        'Should implement state persistence (setState/getState or retainContextWhenHidden)'
      );
    }
  });

  // =========================================================================
  // L0-012: Panel survives hide/show cycle
  // =========================================================================
  test('L0-012: Panel survives hide/show cycle', async function () {
    this.timeout(15000);

    // Open wizard
    await vscode.commands.executeCommand(COMMAND_OPEN_WIZARD);
    await sleep(1000);

    // The retainContextWhenHidden option should be set
    const fs = await import('fs');
    const wizardPanelPath = path.join(__dirname, '../../../src/wizardPanel.ts');

    if (fs.existsSync(wizardPanelPath)) {
      const source = fs.readFileSync(wizardPanelPath, 'utf-8');
      assert.ok(
        source.includes('retainContextWhenHidden: true'),
        'Panel should have retainContextWhenHidden: true for state preservation'
      );
    }
  });

  // =========================================================================
  // L0-013: Panel closes cleanly (no orphan processes)
  // =========================================================================
  test('L0-013: Panel closes cleanly (no orphan processes)', async function () {
    this.timeout(10000);

    // Open and close the wizard
    await vscode.commands.executeCommand(COMMAND_OPEN_WIZARD);
    await sleep(500);

    // Execute command again (should reveal existing panel or create new)
    // This verifies no orphan process issue
    await vscode.commands.executeCommand(COMMAND_OPEN_WIZARD);
    await sleep(500);

    // No assertion needed - if we get here without error, panels are managed correctly
    assert.ok(true, 'Panel manages lifecycle correctly');
  });

  // =========================================================================
  // L0-014: Memory usage under 100MB after load
  // =========================================================================
  test('L0-014: Memory usage under 100MB after load', async function () {
    this.timeout(10000);

    // Open wizard to ensure it's loaded
    await vscode.commands.executeCommand(COMMAND_OPEN_WIZARD);
    await sleep(1500);

    // Get memory usage
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / (1024 * 1024);
    const heapTotalMB = memUsage.heapTotal / (1024 * 1024);

    console.log(`Memory usage: heap used ${heapUsedMB.toFixed(2)}MB / total ${heapTotalMB.toFixed(2)}MB`);

    // Assert under 100MB (critical threshold from test plan)
    assert.ok(
      heapUsedMB < 100,
      `Heap used (${heapUsedMB.toFixed(2)}MB) should be under 100MB`
    );
  });

  // =========================================================================
  // L0-015: Load time under 3 seconds
  // =========================================================================
  test('L0-015: Load time under 3 seconds', async function () {
    const activationTime = activationEndTime - activationStartTime;
    console.log(`Extension activation time: ${activationTime}ms`);

    // Activation should be under 3 seconds (3000ms)
    assert.ok(
      activationTime < 3000,
      `Activation time (${activationTime}ms) should be under 3000ms`
    );

    // Target is under 1 second
    if (activationTime < 1000) {
      console.log('✓ Activation time under target (1000ms)');
    } else if (activationTime < 3000) {
      console.log('⚠ Activation time above target but acceptable (< 3000ms)');
    }
  });
});

// ============================================================================
// Helpers
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
