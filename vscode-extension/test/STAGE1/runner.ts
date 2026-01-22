/**
 * STAGE1 Test Runner
 *
 * Features:
 * - Checkpoint system for crash recovery
 * - Heartbeat monitoring
 * - Layer-based execution with blocking
 * - Detailed logging
 * - HTML report generation
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

interface Checkpoint {
  layer: number;
  timestamp: string;
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
  lastPassedTest: string;
  state: 'complete' | 'partial' | 'failed';
  version: string;
}

interface TestResult {
  id: string;
  name: string;
  layer: number;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  screenshot?: string;
}

interface LayerResult {
  layer: number;
  tests: TestResult[];
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  blocked: boolean;
}

interface RunState {
  startTime: string;
  currentLayer: number;
  currentTest: string;
  results: LayerResult[];
  heartbeat: string;
}

// ============================================================================
// Constants
// ============================================================================

const STAGE1_DIR = __dirname;
const CHECKPOINTS_DIR = path.join(STAGE1_DIR, 'checkpoints');
const LOGS_DIR = path.join(STAGE1_DIR, 'logs');
const FAILURES_DIR = path.join(LOGS_DIR, 'failures');
const RESULTS_DIR = path.join(STAGE1_DIR, 'results');

const HEARTBEAT_FILE = path.join(CHECKPOINTS_DIR, 'heartbeat.json');
const STATE_FILE = path.join(CHECKPOINTS_DIR, 'state.json');
const STATE_BAK_FILE = path.join(CHECKPOINTS_DIR, 'state.json.bak');

const HEARTBEAT_INTERVAL_MS = 5000;
const CRASH_THRESHOLD_MS = 30000;
const VERSION = '1.0.0';

// ============================================================================
// Logging
// ============================================================================

class Logger {
  private logFile: string;
  private failureLog: string;

  constructor() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFile = path.join(LOGS_DIR, `test-run-${timestamp}.log`);
    this.failureLog = path.join(FAILURES_DIR, `failures-${timestamp}.log`);
  }

  private write(level: string, message: string, toFile: string): void {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] [${level}] ${message}\n`;

    // Console output
    if (level === 'ERROR') {
      console.error(line.trim());
    } else {
      console.log(line.trim());
    }

    // File output
    fs.appendFileSync(toFile, line);
  }

  info(message: string): void {
    this.write('INFO', message, this.logFile);
  }

  error(message: string): void {
    this.write('ERROR', message, this.logFile);
    this.write('ERROR', message, this.failureLog);
  }

  success(message: string): void {
    this.write('PASS', message, this.logFile);
  }

  fail(message: string): void {
    this.write('FAIL', message, this.logFile);
    this.write('FAIL', message, this.failureLog);
  }

  layer(layerNum: number, status: string): void {
    const sep = '='.repeat(60);
    this.write('LAYER', `${sep}\nLayer ${layerNum}: ${status}\n${sep}`, this.logFile);
  }
}

// ============================================================================
// Checkpoint System
// ============================================================================

class CheckpointManager {
  private heartbeatTimer: NodeJS.Timeout | null = null;

  /**
   * Atomic write with backup
   */
  private atomicWrite(filePath: string, data: object): void {
    const content = JSON.stringify(data, null, 2);
    const tmpFile = filePath + '.tmp';
    const bakFile = filePath + '.bak';

    // Write to temp file
    fs.writeFileSync(tmpFile, content);

    // Backup existing file
    if (fs.existsSync(filePath)) {
      try {
        fs.copyFileSync(filePath, bakFile);
      } catch {
        // Ignore backup failures (OneDrive sync issues)
      }
    }

    // Rename temp to final with retry for OneDrive file locking
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        fs.renameSync(tmpFile, filePath);
        return; // Success
      } catch (err: unknown) {
        const error = err as NodeJS.ErrnoException;
        if (error.code === 'EPERM' && attempt < maxRetries) {
          // OneDrive might be locking the file, wait and retry
          const delay = attempt * 100; // 100ms, 200ms, 300ms
          const start = Date.now();
          while (Date.now() - start < delay) {
            // Busy wait (synchronous delay)
          }
          continue;
        }
        // Last resort: direct write (not atomic but works)
        try {
          fs.writeFileSync(filePath, content);
          // Clean up temp file
          try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
          return;
        } catch {
          throw err; // Re-throw original error
        }
      }
    }
  }

  /**
   * Safe read with backup fallback
   */
  private safeRead<T>(filePath: string, bakFile: string): T | null {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content) as T;
      }
    } catch (err) {
      console.warn(`Warning: Failed to read ${filePath}, trying backup...`);
    }

    try {
      if (fs.existsSync(bakFile)) {
        const content = fs.readFileSync(bakFile, 'utf-8');
        return JSON.parse(content) as T;
      }
    } catch (err) {
      console.warn(`Warning: Failed to read backup ${bakFile}`);
    }

    return null;
  }

  /**
   * Start heartbeat monitoring
   */
  startHeartbeat(): void {
    this.updateHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.updateHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);
  }

  /**
   * Stop heartbeat monitoring
   */
  stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Update heartbeat timestamp
   */
  private updateHeartbeat(): void {
    this.atomicWrite(HEARTBEAT_FILE, {
      timestamp: new Date().toISOString(),
      pid: process.pid
    });
  }

  /**
   * Check if previous run crashed
   */
  detectCrash(): boolean {
    if (!fs.existsSync(HEARTBEAT_FILE)) {
      return false;
    }

    try {
      const content = fs.readFileSync(HEARTBEAT_FILE, 'utf-8');
      const heartbeat = JSON.parse(content);
      const lastBeat = new Date(heartbeat.timestamp).getTime();
      const now = Date.now();

      return (now - lastBeat) > CRASH_THRESHOLD_MS;
    } catch {
      return false;
    }
  }

  /**
   * Save checkpoint for a completed layer
   */
  saveLayerCheckpoint(layer: number, result: LayerResult): void {
    const checkpoint: Checkpoint = {
      layer,
      timestamp: new Date().toISOString(),
      testsRun: result.tests.length,
      testsPassed: result.passed,
      testsFailed: result.failed,
      lastPassedTest: result.tests.filter(t => t.status === 'passed').pop()?.id || '',
      state: result.failed > 0 ? 'failed' : 'complete',
      version: VERSION
    };

    const checkpointFile = path.join(CHECKPOINTS_DIR, `layer${layer}-complete.json`);
    this.atomicWrite(checkpointFile, checkpoint);
  }

  /**
   * Save current run state
   */
  saveState(state: RunState): void {
    this.atomicWrite(STATE_FILE, state);
  }

  /**
   * Load previous run state
   */
  loadState(): RunState | null {
    return this.safeRead<RunState>(STATE_FILE, STATE_BAK_FILE);
  }

  /**
   * Get completed layers
   */
  getCompletedLayers(): number[] {
    const completed: number[] = [];

    for (let i = 0; i <= 3; i++) {
      const checkpointFile = path.join(CHECKPOINTS_DIR, `layer${i}-complete.json`);
      if (fs.existsSync(checkpointFile)) {
        try {
          const content = fs.readFileSync(checkpointFile, 'utf-8');
          const checkpoint: Checkpoint = JSON.parse(content);
          if (checkpoint.state === 'complete') {
            completed.push(i);
          }
        } catch {
          // Ignore corrupted checkpoint
        }
      }
    }

    return completed;
  }

  /**
   * Clear all checkpoints (for fresh start)
   */
  clearCheckpoints(): void {
    const files = fs.readdirSync(CHECKPOINTS_DIR);
    for (const file of files) {
      fs.unlinkSync(path.join(CHECKPOINTS_DIR, file));
    }
  }
}

// ============================================================================
// Report Generator
// ============================================================================

class ReportGenerator {
  generateHTML(results: LayerResult[], duration: number): string {
    const timestamp = new Date().toISOString();
    const totalTests = results.reduce((sum, r) => sum + r.tests.length, 0);
    const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
    const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);

    let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>STAGE1 Test Report - ${timestamp}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 20px; background: #1e1e1e; color: #ccc; }
    h1 { color: #fff; }
    .summary { display: flex; gap: 20px; margin: 20px 0; }
    .stat { padding: 20px; border-radius: 8px; min-width: 120px; text-align: center; }
    .stat-passed { background: #1b4332; }
    .stat-failed { background: #7f1d1d; }
    .stat-skipped { background: #374151; }
    .stat-total { background: #1e3a5f; }
    .stat h2 { margin: 0; font-size: 36px; }
    .stat p { margin: 5px 0 0; opacity: 0.8; }
    .layer { margin: 20px 0; border: 1px solid #444; border-radius: 8px; overflow: hidden; }
    .layer-header { background: #2d2d30; padding: 15px; display: flex; justify-content: space-between; }
    .layer-header.blocked { background: #7f1d1d; }
    .test { padding: 10px 15px; border-bottom: 1px solid #333; display: flex; justify-content: space-between; }
    .test:last-child { border-bottom: none; }
    .test.passed { border-left: 4px solid #22c55e; }
    .test.failed { border-left: 4px solid #ef4444; }
    .test.skipped { border-left: 4px solid #6b7280; }
    .test-id { font-family: monospace; color: #888; }
    .test-time { color: #666; }
    .error { color: #ef4444; font-size: 12px; margin-top: 5px; font-family: monospace; }
  </style>
</head>
<body>
  <h1>STAGE1 Test Report</h1>
  <p>Generated: ${timestamp}</p>
  <p>Duration: ${(duration / 1000).toFixed(2)}s</p>

  <div class="summary">
    <div class="stat stat-total"><h2>${totalTests}</h2><p>Total</p></div>
    <div class="stat stat-passed"><h2>${totalPassed}</h2><p>Passed</p></div>
    <div class="stat stat-failed"><h2>${totalFailed}</h2><p>Failed</p></div>
    <div class="stat stat-skipped"><h2>${totalSkipped}</h2><p>Skipped</p></div>
  </div>
`;

    for (const layer of results) {
      const blockedClass = layer.blocked ? 'blocked' : '';
      html += `
  <div class="layer">
    <div class="layer-header ${blockedClass}">
      <span><strong>Layer ${layer.layer}</strong> - ${layer.tests.length} tests</span>
      <span>${layer.passed} passed, ${layer.failed} failed, ${layer.skipped} skipped (${(layer.duration / 1000).toFixed(2)}s)</span>
    </div>
`;

      for (const test of layer.tests) {
        html += `
    <div class="test ${test.status}">
      <div>
        <span class="test-id">${test.id}</span>
        <span>${test.name}</span>
        ${test.error ? `<div class="error">${test.error}</div>` : ''}
      </div>
      <span class="test-time">${test.duration}ms</span>
    </div>
`;
      }

      html += `  </div>\n`;
    }

    html += `</body></html>`;
    return html;
  }

  saveReport(results: LayerResult[], duration: number): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = path.join(RESULTS_DIR, `report-${timestamp}.html`);
    const html = this.generateHTML(results, duration);
    fs.writeFileSync(reportFile, html);
    return reportFile;
  }
}

// ============================================================================
// Test Runner
// ============================================================================

export class TestRunner {
  private logger: Logger;
  private checkpoints: CheckpointManager;
  private reporter: ReportGenerator;
  private state: RunState;

  constructor() {
    this.logger = new Logger();
    this.checkpoints = new CheckpointManager();
    this.reporter = new ReportGenerator();
    this.state = {
      startTime: new Date().toISOString(),
      currentLayer: 0,
      currentTest: '',
      results: [],
      heartbeat: ''
    };
  }

  /**
   * Check for crash and prompt for recovery
   */
  async checkRecovery(): Promise<boolean> {
    if (this.checkpoints.detectCrash()) {
      const previousState = this.checkpoints.loadState();
      if (previousState) {
        console.log('\n⚠️  Previous run detected (crashed or interrupted)');
        console.log(`   Last layer: ${previousState.currentLayer}`);
        console.log(`   Last test: ${previousState.currentTest}`);
        console.log('');

        // In automated mode, resume automatically
        // In interactive mode, you could prompt the user
        const completedLayers = this.checkpoints.getCompletedLayers();
        if (completedLayers.length > 0) {
          console.log(`✅ Resuming from Layer ${completedLayers.length}`);
          this.state = previousState;
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Run a single test
   */
  private async runTest(testFn: () => Promise<void>, testInfo: { id: string; name: string; layer: number }): Promise<TestResult> {
    const startTime = Date.now();
    this.state.currentTest = testInfo.id;
    this.checkpoints.saveState(this.state);

    try {
      await testFn();
      const duration = Date.now() - startTime;
      this.logger.success(`${testInfo.id}: ${testInfo.name} (${duration}ms)`);
      return {
        ...testInfo,
        status: 'passed',
        duration
      };
    } catch (err) {
      const duration = Date.now() - startTime;
      const error = err instanceof Error ? err.message : String(err);
      this.logger.fail(`${testInfo.id}: ${testInfo.name} - ${error}`);
      return {
        ...testInfo,
        status: 'failed',
        duration,
        error
      };
    }
  }

  /**
   * Run a layer of tests
   */
  async runLayer(layerNum: number, tests: Array<{ id: string; name: string; fn: () => Promise<void> }>): Promise<LayerResult> {
    this.logger.layer(layerNum, 'Starting');
    this.state.currentLayer = layerNum;

    const startTime = Date.now();
    const results: TestResult[] = [];
    let passed = 0;
    let failed = 0;

    for (const test of tests) {
      const result = await this.runTest(test.fn, { id: test.id, name: test.name, layer: layerNum });
      results.push(result);

      if (result.status === 'passed') {
        passed++;
      } else {
        failed++;
      }
    }

    const duration = Date.now() - startTime;
    const layerResult: LayerResult = {
      layer: layerNum,
      tests: results,
      passed,
      failed,
      skipped: 0,
      duration,
      blocked: false
    };

    // Save checkpoint
    this.checkpoints.saveLayerCheckpoint(layerNum, layerResult);

    // Check blocking condition
    if (failed > 0) {
      this.logger.layer(layerNum, `BLOCKED - ${failed} test(s) failed`);
      layerResult.blocked = true;
    } else {
      this.logger.layer(layerNum, `PASSED - ${passed}/${tests.length} tests`);
    }

    return layerResult;
  }

  /**
   * Main run method
   */
  async run(layers: Array<{ layer: number; tests: Array<{ id: string; name: string; fn: () => Promise<void> }> }>): Promise<void> {
    const startTime = Date.now();

    this.logger.info('STAGE1 Test Runner starting...');
    this.checkpoints.startHeartbeat();

    try {
      // Check for recovery
      const resumed = await this.checkRecovery();
      const completedLayers = resumed ? this.checkpoints.getCompletedLayers() : [];

      // Run layers
      for (const layerDef of layers) {
        // Skip completed layers
        if (completedLayers.includes(layerDef.layer)) {
          this.logger.info(`Layer ${layerDef.layer}: Skipped (already completed)`);
          continue;
        }

        const result = await this.runLayer(layerDef.layer, layerDef.tests);
        this.state.results.push(result);

        // Block on failure
        if (result.blocked) {
          this.logger.error(`🛑 Stopping - Layer ${layerDef.layer} failed. Fix issues before proceeding.`);
          break;
        }
      }

      // Generate report
      const duration = Date.now() - startTime;
      const reportPath = this.reporter.saveReport(this.state.results, duration);
      this.logger.info(`📊 Report saved: ${reportPath}`);

      // Summary
      const totalPassed = this.state.results.reduce((sum, r) => sum + r.passed, 0);
      const totalFailed = this.state.results.reduce((sum, r) => sum + r.failed, 0);

      console.log('\n' + '='.repeat(60));
      console.log(`✅ Passed: ${totalPassed}`);
      console.log(`❌ Failed: ${totalFailed}`);
      console.log(`⏱️  Duration: ${(duration / 1000).toFixed(2)}s`);
      console.log('='.repeat(60) + '\n');

    } finally {
      this.checkpoints.stopHeartbeat();
      this.checkpoints.saveState(this.state);
    }
  }
}

// ============================================================================
// Export for use
// ============================================================================

export { Logger, CheckpointManager, ReportGenerator };
export type { Checkpoint, TestResult, LayerResult, RunState };
