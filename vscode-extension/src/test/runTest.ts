import * as path from 'path';
import * as cp from 'child_process';
import * as fs from 'fs';

async function main() {
  const extensionPath = path.resolve(__dirname, '../../');
  const testsPath = path.resolve(__dirname, './suite/index');
  const logFile = path.join(extensionPath, 'extension-debug.log');

  // Clear previous log
  try { fs.writeFileSync(logFile, ''); } catch (e) { /* ignore */ }

  console.log('Extension path:', extensionPath);
  console.log('Tests path:', testsPath);

  // Use VS Code CLI (code.cmd) with proper arguments
  // The trick: use --wait and capture exit code
  const codeCmd = 'code';
  const args = [
    '--extensionDevelopmentPath=' + extensionPath,
    '--extensionTestsPath=' + testsPath,
    '--disable-extensions',
    '--new-window',
    '--wait'
  ];

  console.log('Running:', codeCmd, args.join(' '));

  return new Promise<void>((resolve, reject) => {
    const child = cp.spawn(codeCmd, args, {
      shell: true,
      stdio: 'inherit',
      env: {
        ...process.env,
        // Remove ELECTRON_RUN_AS_NODE to run as VS Code, not Node
        ELECTRON_RUN_AS_NODE: undefined
      }
    });

    child.on('error', (err) => {
      console.error('Failed to start VS Code:', err);
      reject(err);
    });

    child.on('close', (code) => {
      console.log('VS Code exited with code:', code);

      // Check if debug log was created (extension loaded)
      if (fs.existsSync(logFile)) {
        const log = fs.readFileSync(logFile, 'utf-8');
        console.log('\n=== Extension Debug Log ===');
        console.log(log);

        if (log.includes('Extension activation complete!')) {
          console.log('\n✅ Extension activated successfully!');
        }
        if (log.includes('ERROR')) {
          console.log('\n❌ Errors found in extension log');
          reject(new Error('Extension had errors'));
          return;
        }
      }

      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`VS Code exited with code ${code}`));
      }
    });
  });
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
