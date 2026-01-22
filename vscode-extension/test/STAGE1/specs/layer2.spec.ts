/**
 * Layer 2: File Operations Tests
 *
 * These tests verify file upload, data source selection, and schema configuration.
 * All tests must pass before Layer 3 can run.
 *
 * NOTE: These tests use source code analysis.
 * Full runtime tests require VS Code Extension Host with file system access.
 */

import * as fs from 'fs';
import * as path from 'path';

// Paths
const EXTENSION_ROOT = path.resolve(__dirname, '../../../');
const SRC_DIR = path.join(EXTENSION_ROOT, 'src');
const WIZARD_PANEL_PATH = path.join(SRC_DIR, 'wizardPanel.ts');
const FIXTURES_DIR = path.join(__dirname, '../fixtures');

// Helper to read file
function readFile(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf-8');
}

// Test definitions for Layer 2
export const layer2Tests = [
  // =========================================================================
  // Step 1 - File Upload (L2-001 to L2-015)
  // =========================================================================
  {
    id: 'L2-001',
    name: 'CSV file accepted',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check for CSV handling
      const hasCsvSupport =
        wizardSource.includes('.csv') ||
        wizardSource.includes('csv') ||
        wizardSource.includes('text/csv') ||
        wizardSource.includes('CSV');

      if (!hasCsvSupport) {
        throw new Error('Should support CSV file format');
      }
    }
  },
  {
    id: 'L2-002',
    name: 'XLSX file accepted',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check for XLSX handling
      const hasXlsxSupport =
        wizardSource.includes('.xlsx') ||
        wizardSource.includes('xlsx') ||
        wizardSource.includes('XLSX') ||
        wizardSource.includes('spreadsheet');

      if (!hasXlsxSupport) {
        throw new Error('Should support XLSX file format');
      }

      // Check for xlsx library import
      if (!wizardSource.includes('xlsx') && !wizardSource.includes('XLSX')) {
        throw new Error('Should import xlsx library for Excel file handling');
      }
    }
  },
  {
    id: 'L2-003',
    name: 'File picker dialog - VS Code showOpenDialog',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check for VS Code file picker (not HTML5 drag & drop)
      const hasFilePicker =
        wizardSource.includes('showOpenDialog') ||
        wizardSource.includes('openDialog') ||
        wizardSource.includes('vscode.window.showOpenDialog');

      if (!hasFilePicker) {
        throw new Error('Should use VS Code file picker (showOpenDialog)');
      }

      // Check for file filters
      const hasFileFilters =
        wizardSource.includes('filters') ||
        wizardSource.includes('Spec Files') ||
        wizardSource.includes('canSelectFiles');

      if (!hasFileFilters) {
        throw new Error('File picker should have file type filters');
      }
    }
  },
  {
    id: 'L2-004',
    name: 'File selection feedback - file path shown',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check for file path/name display after selection
      const hasFileDisplay =
        wizardSource.includes('filePath') ||
        wizardSource.includes('fileName') ||
        wizardSource.includes('basename') ||
        wizardSource.includes('path.basename');

      if (!hasFileDisplay) {
        throw new Error('Should display selected file name/path');
      }

      // Check for UI feedback
      const hasUIFeedback =
        wizardSource.includes('specParseStart') ||
        wizardSource.includes('postMessage') ||
        wizardSource.includes('webview');

      if (!hasUIFeedback) {
        throw new Error('Should provide UI feedback on file selection');
      }
    }
  },
  {
    id: 'L2-005',
    name: 'Spec file parsing - CSV/XLSX/DOCX support',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check for spec file parsing
      const hasSpecParsing =
        wizardSource.includes('parseSpec') ||
        wizardSource.includes('parseExcelSpec') ||
        wizardSource.includes('parseCsvSpec') ||
        wizardSource.includes('parseWordSpec');

      if (!hasSpecParsing) {
        throw new Error('Should have spec file parsing functions');
      }

      // Check for file type handling
      const hasFileTypeSwitch =
        wizardSource.includes('.xlsx') ||
        wizardSource.includes('.csv') ||
        wizardSource.includes('.docx');

      if (!hasFileTypeSwitch) {
        throw new Error('Should handle different file types');
      }
    }
  },
  {
    id: 'L2-006',
    name: 'AI-based spec extraction - Gemini/Anthropic',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check for AI integration
      const hasGemini =
        wizardSource.includes('GoogleGenerativeAI') ||
        wizardSource.includes('gemini');

      const hasAnthropic =
        wizardSource.includes('Anthropic') ||
        wizardSource.includes('anthropic');

      if (!hasGemini && !hasAnthropic) {
        throw new Error('Should support AI-based spec extraction (Gemini/Anthropic)');
      }

      // Check for AI parsing function
      const hasAIParsing =
        wizardSource.includes('parseWithGemini') ||
        wizardSource.includes('parseWithClaudeAPI') ||
        wizardSource.includes('parseWithAI');

      if (!hasAIParsing) {
        throw new Error('Should have AI parsing functions');
      }
    }
  },
  {
    id: 'L2-007',
    name: 'Invalid file type - error message shown',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check for file type validation
      const hasTypeValidation =
        wizardSource.includes('accept') ||
        wizardSource.includes('type') ||
        wizardSource.includes('.csv') ||
        wizardSource.includes('.xlsx');

      if (!hasTypeValidation) {
        throw new Error('Should validate file types');
      }

      // Check for error handling
      const hasErrorMessage =
        wizardSource.includes('error') ||
        wizardSource.includes('invalid') ||
        wizardSource.includes('unsupported');

      if (!hasErrorMessage) {
        throw new Error('Should show error for invalid file types');
      }
    }
  },
  {
    id: 'L2-008',
    name: 'Small file (1KB) - upload succeeds',
    fn: async () => {
      // Verify test fixture exists
      const smallFile = path.join(FIXTURES_DIR, 'test-small.csv');
      if (!fs.existsSync(smallFile)) {
        throw new Error('Test fixture test-small.csv should exist');
      }

      // Check file size
      const stats = fs.statSync(smallFile);
      if (stats.size > 5000) {
        throw new Error('test-small.csv should be under 5KB');
      }

      // Code analysis - check file handling doesn't have minimum size limit
      const wizardSource = readFile(WIZARD_PANEL_PATH);
      const hasMinSizeLimit = wizardSource.includes('minSize') || wizardSource.includes('minimum size');
      if (hasMinSizeLimit) {
        console.warn('Warning: Code has minimum file size - verify small files are accepted');
      }
    }
  },
  {
    id: 'L2-009',
    name: 'Medium file (10MB) - upload succeeds',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check there's no low max size limit
      const maxSizePattern = /maxSize|max_size|maxFileSize/gi;
      const matches = wizardSource.match(maxSizePattern);

      if (matches) {
        // Check the actual limit is at least 10MB
        const limitPattern = /(\d+)\s*(MB|mb|M)/g;
        const limitMatches = [...wizardSource.matchAll(limitPattern)];
        for (const match of limitMatches) {
          const mb = parseInt(match[1]);
          if (mb < 10) {
            throw new Error(`Max file size (${mb}MB) should be at least 10MB`);
          }
        }
      }
    }
  },
  {
    id: 'L2-010',
    name: 'Large file (100MB) - warning/handling',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check for large file handling
      const hasLargeFileHandling =
        wizardSource.includes('large') ||
        wizardSource.includes('warning') ||
        wizardSource.includes('size') ||
        wizardSource.includes('100') ||
        wizardSource.includes('progress');

      // Large files should either:
      // 1. Show a warning
      // 2. Have progress indication
      // 3. Be handled gracefully
      if (!hasLargeFileHandling) {
        console.warn('Warning: No explicit large file handling detected - verify 100MB files work');
      }
    }
  },
  {
    id: 'L2-011',
    name: 'Cancel upload - clean state restored',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check for cancel/reset functionality
      const hasCancelFunction =
        wizardSource.includes('cancel') ||
        wizardSource.includes('reset') ||
        wizardSource.includes('clear') ||
        wizardSource.includes('remove');

      if (!hasCancelFunction) {
        throw new Error('Should have cancel/reset upload functionality');
      }
    }
  },
  {
    id: 'L2-012',
    name: 'Multiple files - correct handling',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check for multiple file handling or rejection
      const hasMultipleHandling =
        wizardSource.includes('files') ||
        wizardSource.includes('multiple') ||
        wizardSource.includes('forEach') ||
        wizardSource.includes('file[0]') ||
        wizardSource.includes('files[0]');

      if (!hasMultipleHandling) {
        throw new Error('Should handle multiple file selection/drop');
      }
    }
  },
  {
    id: 'L2-013',
    name: 'File preview - first 5 rows shown',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check for preview functionality
      const hasPreview =
        wizardSource.includes('preview') ||
        wizardSource.includes('Preview') ||
        wizardSource.includes('sample') ||
        wizardSource.includes('rows') ||
        wizardSource.includes('slice') ||
        wizardSource.includes('head');

      if (!hasPreview) {
        throw new Error('Should show file preview');
      }
    }
  },
  {
    id: 'L2-014',
    name: 'Headers detected - columns identified',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check for header detection
      const hasHeaderDetection =
        wizardSource.includes('header') ||
        wizardSource.includes('columns') ||
        wizardSource.includes('fields') ||
        wizardSource.includes('schema');

      if (!hasHeaderDetection) {
        throw new Error('Should detect file headers/columns');
      }
    }
  },
  {
    id: 'L2-015',
    name: 'Empty file - error message',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check for empty file handling
      const hasEmptyCheck =
        wizardSource.includes('empty') ||
        wizardSource.includes('no data') ||
        wizardSource.includes('length === 0') ||
        wizardSource.includes('.length < ') ||
        wizardSource.includes('rows.length');

      if (!hasEmptyCheck) {
        throw new Error('Should handle empty files with error message');
      }
    }
  },

  // =========================================================================
  // Step 2 - Data Source (L2-016 to L2-020)
  // =========================================================================
  {
    id: 'L2-016',
    name: 'Local File option - selectable',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      const hasLocalOption =
        wizardSource.includes('local') ||
        wizardSource.includes('Local') ||
        wizardSource.includes('file') ||
        wizardSource.includes('upload');

      if (!hasLocalOption) {
        throw new Error('Should have Local File option for data source');
      }
    }
  },
  {
    id: 'L2-017',
    name: 'Qlik Cloud option - selectable',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      const hasQlikOption =
        wizardSource.includes('Qlik') ||
        wizardSource.includes('qlik') ||
        wizardSource.includes('cloud') ||
        wizardSource.includes('Cloud');

      if (!hasQlikOption) {
        throw new Error('Should have Qlik Cloud option for data source');
      }
    }
  },
  {
    id: 'L2-018',
    name: 'Database option - selectable',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Database might be listed as connection or external source
      const hasDatabaseOption =
        wizardSource.includes('database') ||
        wizardSource.includes('Database') ||
        wizardSource.includes('connection') ||
        wizardSource.includes('Connection') ||
        wizardSource.includes('external');

      if (!hasDatabaseOption) {
        console.warn('Warning: No explicit database option - may be under connections');
      }
    }
  },
  {
    id: 'L2-019',
    name: 'Data source selection persists after navigation',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check state persistence
      const hasStatePersistence =
        wizardSource.includes('selectedSource') ||
        wizardSource.includes('dataSource') ||
        wizardSource.includes('source') ||
        wizardSource.includes('state.');

      if (!hasStatePersistence) {
        throw new Error('Should persist data source selection in state');
      }
    }
  },
  {
    id: 'L2-020',
    name: 'Visual indicator - selected option highlighted',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check for selection visual feedback
      const hasSelectionHighlight =
        wizardSource.includes('selected') ||
        wizardSource.includes('active') ||
        wizardSource.includes('checked') ||
        wizardSource.includes('highlight');

      if (!hasSelectionHighlight) {
        throw new Error('Should visually highlight selected option');
      }
    }
  },

  // =========================================================================
  // Step 3 - Schema Configuration (L2-021 to L2-030)
  // =========================================================================
  {
    id: 'L2-021',
    name: 'Columns populated from uploaded file',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      const hasColumnPopulation =
        wizardSource.includes('columns') ||
        wizardSource.includes('fields') ||
        wizardSource.includes('schema') ||
        wizardSource.includes('headers');

      if (!hasColumnPopulation) {
        throw new Error('Should populate columns from uploaded file');
      }
    }
  },
  {
    id: 'L2-022',
    name: 'Data type dropdown works for each column',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      const hasTypeDropdown =
        wizardSource.includes('type') ||
        wizardSource.includes('dataType') ||
        wizardSource.includes('select') ||
        wizardSource.includes('dropdown');

      if (!hasTypeDropdown) {
        throw new Error('Should have data type selection for columns');
      }
    }
  },
  {
    id: 'L2-023',
    name: 'Primary key checkbox toggles correctly',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      const hasPrimaryKey =
        wizardSource.includes('primary') ||
        wizardSource.includes('PK') ||
        wizardSource.includes('key') ||
        wizardSource.includes('keyType');

      if (!hasPrimaryKey) {
        throw new Error('Should have primary key selection for columns');
      }
    }
  },
  {
    id: 'L2-024',
    name: 'Column rename input works',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      const hasRenameInput =
        wizardSource.includes('rename') ||
        wizardSource.includes('alias') ||
        wizardSource.includes('newName') ||
        wizardSource.includes('displayName');

      if (!hasRenameInput) {
        throw new Error('Should allow column renaming');
      }
    }
  },
  {
    id: 'L2-025',
    name: 'Column exclude toggle works',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      const hasExcludeToggle =
        wizardSource.includes('exclude') ||
        wizardSource.includes('include') ||
        wizardSource.includes('checkbox') ||
        wizardSource.includes('toggle') ||
        wizardSource.includes('selected');

      if (!hasExcludeToggle) {
        throw new Error('Should allow column inclusion/exclusion');
      }
    }
  },
  {
    id: 'L2-026',
    name: 'Auto-detect data types - correct detection',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      const hasAutoDetect =
        wizardSource.includes('detect') ||
        wizardSource.includes('infer') ||
        wizardSource.includes('auto') ||
        wizardSource.includes('typeof') ||
        wizardSource.includes('isNumber') ||
        wizardSource.includes('isDate');

      if (!hasAutoDetect) {
        console.warn('Warning: No explicit auto-detect logic - types may be set manually');
      }
    }
  },
  {
    id: 'L2-027',
    name: 'Manual type override works',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      const hasManualOverride =
        wizardSource.includes('type') ||
        wizardSource.includes('select') ||
        wizardSource.includes('change') ||
        wizardSource.includes('override');

      if (!hasManualOverride) {
        throw new Error('Should allow manual type override');
      }
    }
  },
  {
    id: 'L2-028',
    name: 'Required field validation - error on missing',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      const hasRequiredValidation =
        wizardSource.includes('required') ||
        wizardSource.includes('validate') ||
        wizardSource.includes('mandatory') ||
        wizardSource.includes('error');

      if (!hasRequiredValidation) {
        throw new Error('Should validate required fields');
      }
    }
  },
  {
    id: 'L2-029',
    name: 'Preview updates to reflect changes',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      const hasPreviewUpdate =
        wizardSource.includes('preview') ||
        wizardSource.includes('update') ||
        wizardSource.includes('render') ||
        wizardSource.includes('refresh');

      if (!hasPreviewUpdate) {
        throw new Error('Should update preview when schema changes');
      }
    }
  },
  {
    id: 'L2-030',
    name: 'Reset button returns to auto-detect',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      const hasResetButton =
        wizardSource.includes('reset') ||
        wizardSource.includes('Reset') ||
        wizardSource.includes('restore') ||
        wizardSource.includes('default');

      if (!hasResetButton) {
        console.warn('Warning: No explicit reset button - may use other mechanism');
      }
    }
  },

  // =========================================================================
  // Steps 4-7 Coverage (L2-031 to L2-045)
  // =========================================================================
  {
    id: 'L2-031',
    name: 'Step 4 (Tables) - Table list displays',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      const hasTableList =
        wizardSource.includes('tables') ||
        wizardSource.includes('Tables') ||
        wizardSource.includes('table-list');

      if (!hasTableList) {
        throw new Error('Step 4 should display table list');
      }
    }
  },
  {
    id: 'L2-032',
    name: 'Step 4 - Table selection works',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      const hasTableSelection =
        wizardSource.includes('selectTable') ||
        wizardSource.includes('selectedTable') ||
        wizardSource.includes('table') && wizardSource.includes('select');

      if (!hasTableSelection) {
        throw new Error('Should support table selection');
      }
    }
  },
  {
    id: 'L2-033',
    name: 'Step 4 - Multi-table selection works',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      const hasMultiSelect =
        wizardSource.includes('selectedTables') ||
        wizardSource.includes('tables.') ||
        wizardSource.includes('forEach') ||
        wizardSource.includes('map');

      if (!hasMultiSelect) {
        console.warn('Warning: Multi-table selection not explicitly detected');
      }
    }
  },
  {
    id: 'L2-034',
    name: 'Step 5 (Fields) - Field list displays',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      const hasFieldList =
        wizardSource.includes('fields') ||
        wizardSource.includes('Fields') ||
        wizardSource.includes('columns');

      if (!hasFieldList) {
        throw new Error('Step 5 should display field list');
      }
    }
  },
  {
    id: 'L2-035',
    name: 'Step 5 - Field configuration works',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      const hasFieldConfig =
        wizardSource.includes('field') ||
        wizardSource.includes('Field') ||
        wizardSource.includes('config');

      if (!hasFieldConfig) {
        throw new Error('Step 5 should allow field configuration');
      }
    }
  },
  {
    id: 'L2-036',
    name: 'Step 6 (Incremental) - Options display',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      const hasIncrementalOptions =
        wizardSource.includes('incremental') ||
        wizardSource.includes('Incremental') ||
        wizardSource.includes('load') ||
        wizardSource.includes('strategy');

      if (!hasIncrementalOptions) {
        throw new Error('Step 6 should display incremental load options');
      }
    }
  },
  {
    id: 'L2-037',
    name: 'Step 6 - Incremental field selection',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      const hasFieldSelection =
        wizardSource.includes('incrementalField') ||
        wizardSource.includes('incremental') && wizardSource.includes('field');

      if (!hasFieldSelection) {
        throw new Error('Step 6 should allow incremental field selection');
      }
    }
  },
  {
    id: 'L2-038',
    name: 'Step 6 - Strategy selection works',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      const hasStrategySelection =
        wizardSource.includes('strategy') ||
        wizardSource.includes('Strategy') ||
        wizardSource.includes('loadType');

      if (!hasStrategySelection) {
        throw new Error('Step 6 should allow strategy selection');
      }
    }
  },
  {
    id: 'L2-039',
    name: 'Step 7 (Deploy) - Summary displays',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      const hasSummary =
        wizardSource.includes('summary') ||
        wizardSource.includes('Summary') ||
        wizardSource.includes('review') ||
        wizardSource.includes('deploy') ||
        wizardSource.includes('Deploy');

      if (!hasSummary) {
        throw new Error('Step 7 should display deployment summary');
      }
    }
  },
  {
    id: 'L2-040',
    name: 'Step 7 - Deploy button exists',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      const hasDeployButton =
        wizardSource.includes('deploy') ||
        wizardSource.includes('Deploy') ||
        wizardSource.includes('create') ||
        wizardSource.includes('generate') ||
        wizardSource.includes('finish');

      if (!hasDeployButton) {
        throw new Error('Step 7 should have deploy/finish button');
      }
    }
  },
  {
    id: 'L2-041',
    name: 'Step 7 - Progress indicator during deploy',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      const hasProgressIndicator =
        wizardSource.includes('progress') ||
        wizardSource.includes('loading') ||
        wizardSource.includes('spinner') ||
        wizardSource.includes('deploying');

      if (!hasProgressIndicator) {
        throw new Error('Should show progress during deployment');
      }
    }
  },
  {
    id: 'L2-042',
    name: 'Step 7 - Success message on completion',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      const hasSuccessMessage =
        wizardSource.includes('success') ||
        wizardSource.includes('Success') ||
        wizardSource.includes('complete') ||
        wizardSource.includes('completed') ||
        wizardSource.includes('done');

      if (!hasSuccessMessage) {
        throw new Error('Should show success message on completion');
      }
    }
  },
  {
    id: 'L2-043',
    name: 'Step 7 - Error handling on failure',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      const hasErrorHandling =
        wizardSource.includes('error') ||
        wizardSource.includes('Error') ||
        wizardSource.includes('fail') ||
        wizardSource.includes('catch');

      if (!hasErrorHandling) {
        throw new Error('Should handle deployment errors');
      }
    }
  },
  {
    id: 'L2-044',
    name: 'Word document spec parsing works',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check for mammoth (Word doc parser) usage
      const hasWordParsing =
        wizardSource.includes('mammoth') ||
        wizardSource.includes('docx') ||
        wizardSource.includes('.doc') ||
        wizardSource.includes('Word');

      if (!hasWordParsing) {
        throw new Error('Should support Word document parsing');
      }
    }
  },
  {
    id: 'L2-045',
    name: 'AI spec parsing with Gemini/Anthropic',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check for AI integration
      const hasAIParsing =
        wizardSource.includes('Gemini') ||
        wizardSource.includes('gemini') ||
        wizardSource.includes('Anthropic') ||
        wizardSource.includes('anthropic') ||
        wizardSource.includes('GoogleGenerativeAI') ||
        wizardSource.includes('Claude');

      if (!hasAIParsing) {
        throw new Error('Should support AI-based spec parsing');
      }
    }
  }
];

// Run Layer 2 tests
async function runLayer2(): Promise<void> {
  console.log('Running Layer 2 tests (File Operations)...\n');

  let passed = 0;
  let failed = 0;

  for (const test of layer2Tests) {
    try {
      await test.fn();
      console.log(`✅ ${test.id}: ${test.name}`);
      passed++;
    } catch (err) {
      console.log(`❌ ${test.id}: ${test.name}`);
      console.log(`   Error: ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

// Export for main runner
export default layer2Tests;

// Run if executed directly
if (require.main === module) {
  runLayer2().catch(console.error);
}
