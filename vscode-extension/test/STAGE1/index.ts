/**
 * STAGE1 Test Suite Entry Point
 *
 * Usage:
 *   npx tsx test/STAGE1/index.ts              # Run all tests
 *   npx tsx test/STAGE1/index.ts --layer 0    # Run specific layer
 *   npx tsx test/STAGE1/index.ts --resume     # Resume from checkpoint
 *   npx tsx test/STAGE1/index.ts --reset      # Clear checkpoints and start fresh
 *
 * Features:
 *   - Checkpoint-based crash recovery
 *   - Heartbeat monitoring (every 5 seconds)
 *   - Layer blocking (Layer N must pass 100% before N+1)
 *   - Detailed logging to logs/test-run-{timestamp}.log
 *   - HTML report generation to results/
 *   - Atomic writes with .bak backup for checkpoints
 */

import { TestRunner, CheckpointManager } from './runner';
import layer0Tests from './specs/layer0.spec';

// Parse command line arguments
const args = process.argv.slice(2);
const layerArg = args.find(a => a.startsWith('--layer'));
const resetFlag = args.includes('--reset');
const resumeFlag = args.includes('--resume');

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    STAGE1 Test Suite                         ║');
  console.log('║                                                              ║');
  console.log('║  VS Code Extension Wizard - Comprehensive Testing            ║');
  console.log('║  190 Tests: 160 Automated + 30 Manual                        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  const checkpoints = new CheckpointManager();

  // Handle reset
  if (resetFlag) {
    console.log('🗑️  Clearing all checkpoints...');
    checkpoints.clearCheckpoints();
    console.log('✅ Checkpoints cleared\n');
  }

  // Check for crash recovery
  if (checkpoints.detectCrash()) {
    console.log('⚠️  Previous run crashed or was interrupted!');
    const completedLayers = checkpoints.getCompletedLayers();
    if (completedLayers.length > 0) {
      console.log(`   Completed layers: ${completedLayers.join(', ')}`);
      if (resumeFlag || layerArg === undefined) {
        console.log('   Resuming automatically...\n');
      }
    }
  }

  // Create runner
  const runner = new TestRunner();

  // Define all layers
  const allLayers = [
    { layer: 0, tests: layer0Tests },
    // TODO: Add layer1Tests, layer2Tests, layer3Tests when implemented
  ];

  // Filter by layer if specified
  let layersToRun = allLayers;
  if (layerArg) {
    const layerNum = parseInt(layerArg.split('=')[1] || layerArg.replace('--layer', '').trim());
    layersToRun = allLayers.filter(l => l.layer === layerNum);
    if (layersToRun.length === 0) {
      console.error(`❌ Layer ${layerNum} not found`);
      process.exit(1);
    }
  }

  // Run tests
  await runner.run(layersToRun);
}

// Error handling
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n\n🛑 Interrupted. State saved to checkpoint.');
  process.exit(130);
});

// Run
main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
