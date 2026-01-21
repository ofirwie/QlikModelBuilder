import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// Log to file for debugging
const logFile = path.join(__dirname, '../../..', 'test-output.log');
function log(...args: any[]) {
  const timestamp = new Date().toISOString();
  const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
  const line = `[${timestamp}] ${msg}\n`;
  fs.appendFileSync(logFile, line);
  console.log(...args);
}

suite('Extension Test Suite', () => {
  log('=== Extension Test Suite Starting ===');
  vscode.window.showInformationMessage('Start all tests.');

  // Extension ID is publisher.name format: ofirwie.qlik-model-builder
  const EXTENSION_ID = 'ofirwie.qlik-model-builder';

  test('Extension should be present', () => {
    log('TEST: Extension should be present');
    const allExtensions = vscode.extensions.all.map(e => e.id);
    log('All extensions:', allExtensions.join(', '));
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    log('Found extension:', ext ? ext.id : 'NOT FOUND');
    assert.ok(ext, `Extension ${EXTENSION_ID} not found. Available: ${allExtensions.join(', ')}`);
  });

  test('Extension should activate', async () => {
    log('TEST: Extension should activate');
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    if (ext) {
      log('Activating extension...');
      await ext.activate();
      log('Extension active:', ext.isActive);
      assert.ok(ext.isActive);
    } else {
      assert.fail('Extension not found');
    }
  });

  test('Command "qmb.openWizard" should be registered', async () => {
    log('TEST: Command should be registered');
    const commands = await vscode.commands.getCommands(true);
    const qmbCommands = commands.filter(c => c.startsWith('qmb'));
    log('QMB commands:', qmbCommands.join(', '));
    assert.ok(commands.includes('qmb.openWizard'), 'Command qmb.openWizard not found');
  });

  test('Opening wizard should not throw error', async () => {
    log('TEST: Opening wizard');
    try {
      await vscode.commands.executeCommand('qmb.openWizard');
      // Wait for panel to open
      await new Promise(resolve => setTimeout(resolve, 2000));
      log('Wizard opened successfully');
      assert.ok(true, 'Wizard opened successfully');
    } catch (err) {
      log('Wizard error:', err);
      assert.fail(`Failed to open wizard: ${err}`);
    }
  });
});
