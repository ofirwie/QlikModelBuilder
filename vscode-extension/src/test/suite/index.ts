import * as path from 'path';
import * as fs from 'fs';
import Mocha from 'mocha';
import { glob } from 'glob';

// Write to a log file for debugging
const logFile = path.join(__dirname, '../../..', 'test-output.log');

function log(msg: string) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}\n`;
  fs.appendFileSync(logFile, line);
  console.log(msg);
}

export async function run(): Promise<void> {
  // Clear previous log
  fs.writeFileSync(logFile, '');
  log('=== Test suite starting ===');

  // Create the mocha test
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: 60000,  // 60 seconds for VS Code tests
    reporter: 'spec' // Verbose output
  });

  const testsRoot = path.resolve(__dirname, '.');
  log(`Tests root: ${testsRoot}`);

  const files = await glob('**/**.test.js', { cwd: testsRoot });
  log(`Found test files: ${files.join(', ')}`);

  // Add files to the test suite
  files.forEach((f: string) => mocha.addFile(path.resolve(testsRoot, f)));

  // Run the mocha test
  return new Promise((resolve, reject) => {
    mocha.run((failures: number) => {
      log(`Test run complete. Failures: ${failures}`);
      if (failures > 0) {
        reject(new Error(`${failures} tests failed.`));
      } else {
        resolve();
      }
    });
  });
}
