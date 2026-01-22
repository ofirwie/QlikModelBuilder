/**
 * STAGE1 Test Suite - Entry Point
 *
 * This file is loaded by VS Code Extension Host and runs all tests
 */

import * as path from 'path';
import * as Mocha from 'mocha';
import * as glob from 'glob';

export async function run(): Promise<void> {
  // Create the mocha test runner
  const mocha = new Mocha({
    ui: 'bdd',
    timeout: 60000, // 60 seconds for VS Code tests
    color: true,
    reporter: 'spec',
  });

  const testsRoot = __dirname;

  return new Promise((resolve, reject) => {
    // Find all test files
    glob('**/*.test.js', { cwd: testsRoot }, (err, files) => {
      if (err) {
        return reject(err);
      }

      // Add files to the test suite
      files.forEach(f => {
        mocha.addFile(path.resolve(testsRoot, f));
      });

      try {
        // Run the mocha test
        mocha.run(failures => {
          if (failures > 0) {
            reject(new Error(`${failures} tests failed.`));
          } else {
            resolve();
          }
        });
      } catch (err) {
        console.error('Failed to run tests:', err);
        reject(err);
      }
    });
  });
}
