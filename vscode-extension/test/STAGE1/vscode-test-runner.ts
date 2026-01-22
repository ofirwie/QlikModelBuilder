/**
 * VS Code Extension Test Runner for STAGE1
 *
 * This module provides utilities to run tests inside VS Code Extension Host
 * using @vscode/test-electron
 */

import * as path from 'path';
import { runTests, downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath } from '@vscode/test-electron';

export interface VSCodeTestOptions {
  extensionDevelopmentPath: string;
  extensionTestsPath: string;
  launchArgs?: string[];
  version?: string;
}

/**
 * Run VS Code extension tests
 */
export async function runVSCodeTests(options: VSCodeTestOptions): Promise<void> {
  try {
    // Download VS Code if needed
    const vscodeExecutablePath = await downloadAndUnzipVSCode(options.version || 'stable');
    const [cliPath, ...args] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);

    // Run the tests
    await runTests({
      vscodeExecutablePath,
      extensionDevelopmentPath: options.extensionDevelopmentPath,
      extensionTestsPath: options.extensionTestsPath,
      launchArgs: [
        '--disable-extensions',
        '--disable-gpu',
        ...(options.launchArgs || [])
      ],
    });
  } catch (err) {
    console.error('Failed to run VS Code tests:', err);
    throw err;
  }
}

/**
 * Get paths for the test environment
 */
export function getTestPaths() {
  const stage1Dir = __dirname;
  const extensionRoot = path.resolve(stage1Dir, '../../');
  const testSuitePath = path.join(stage1Dir, 'suite');

  return {
    stage1Dir,
    extensionRoot,
    testSuitePath,
    fixturesDir: path.join(stage1Dir, 'fixtures'),
    checkpointsDir: path.join(stage1Dir, 'checkpoints'),
    logsDir: path.join(stage1Dir, 'logs'),
    resultsDir: path.join(stage1Dir, 'results'),
    screenshotsDir: path.join(stage1Dir, 'screenshots'),
  };
}

/**
 * Main entry point to run VS Code tests
 */
export async function main() {
  const paths = getTestPaths();

  console.log('='.repeat(60));
  console.log('STAGE1 VS Code Extension Tests');
  console.log('='.repeat(60));
  console.log(`Extension root: ${paths.extensionRoot}`);
  console.log(`Test suite: ${paths.testSuitePath}`);
  console.log('');

  await runVSCodeTests({
    extensionDevelopmentPath: paths.extensionRoot,
    extensionTestsPath: paths.testSuitePath,
  });
}

if (require.main === module) {
  main().catch(err => {
    console.error('Test runner failed:', err);
    process.exit(1);
  });
}
