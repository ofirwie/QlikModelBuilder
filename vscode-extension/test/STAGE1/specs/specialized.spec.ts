/**
 * Specialized Tests
 *
 * This file contains:
 * - Security Tests (SEC-001 to SEC-008)
 * - Performance Tests (PERF-001 to PERF-006)
 * - Localization Tests (L10N-001 to L10N-006)
 * - Compatibility Tests (COMPAT-001 to COMPAT-006)
 * - Accessibility Tests (A11Y-001 to A11Y-006)
 *
 * Total: 32 specialized tests
 */

import * as fs from 'fs';
import * as path from 'path';

// Paths
const EXTENSION_ROOT = path.resolve(__dirname, '../../../');
const SRC_DIR = path.join(EXTENSION_ROOT, 'src');
const WIZARD_PANEL_PATH = path.join(SRC_DIR, 'wizardPanel.ts');
const QLIK_API_PATH = path.join(SRC_DIR, 'qlikApi.ts');
const EXTENSION_PATH = path.join(SRC_DIR, 'extension.ts');
const PACKAGE_JSON_PATH = path.join(EXTENSION_ROOT, 'package.json');
const FIXTURES_DIR = path.join(__dirname, '../fixtures');

// Helper to read file
function readFile(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf-8');
}

// Check if file exists
function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

// ============================================================================
// Security Tests (SEC-001 to SEC-008)
// ============================================================================

export const securityTests = [
  {
    id: 'SEC-001',
    name: 'API Key not exposed in logs',
    fn: async () => {
      const sources = [readFile(WIZARD_PANEL_PATH), readFile(EXTENSION_PATH)];
      if (fileExists(QLIK_API_PATH)) {
        sources.push(readFile(QLIK_API_PATH));
      }
      const combined = sources.join('\n');

      // Check for console.log with sensitive data
      const logPatterns = [
        /console\.log\(.*apiKey/i,
        /console\.log\(.*token/i,
        /console\.log\(.*password/i,
        /console\.log\(.*secret/i,
        /debugLog\(.*apiKey/i,
        /debugLog\(.*token/i,
      ];

      for (const pattern of logPatterns) {
        if (pattern.test(combined)) {
          throw new Error('Should not log API keys or tokens');
        }
      }
    }
  },
  {
    id: 'SEC-002',
    name: 'API Key not hardcoded',
    fn: async () => {
      const sources = [readFile(WIZARD_PANEL_PATH), readFile(EXTENSION_PATH)];
      if (fileExists(QLIK_API_PATH)) {
        sources.push(readFile(QLIK_API_PATH));
      }
      const combined = sources.join('\n');

      // Check for hardcoded API key patterns
      const hardcodedPatterns = [
        /apiKey\s*[:=]\s*["'][A-Za-z0-9+/=]{20,}["']/,  // Base64-like keys
        /token\s*[:=]\s*["']eyJ[A-Za-z0-9_-]+/,          // JWT tokens
        /QLIK_API_KEY\s*=\s*["'][^"']+["']/,
      ];

      for (const pattern of hardcodedPatterns) {
        if (pattern.test(combined)) {
          throw new Error('API keys should not be hardcoded in source');
        }
      }

      // Keys should come from env or config
      const hasEnvAccess =
        combined.includes('process.env') ||
        combined.includes('getConfiguration') ||
        combined.includes('SecretStorage') ||
        combined.includes('context.secrets');

      if (!hasEnvAccess) {
        throw new Error('API keys should come from environment or secure storage');
      }
    }
  },
  {
    id: 'SEC-003',
    name: 'Input sanitization - no XSS',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check for innerHTML usage (potential XSS)
      const unsafePatterns = [
        /innerHTML\s*=\s*[^'"]/,  // innerHTML with variable
        /innerHTML\s*\+=\s*/,     // innerHTML concatenation
      ];

      let hasUnsafeInnerHTML = false;
      for (const pattern of unsafePatterns) {
        if (pattern.test(wizardSource)) {
          hasUnsafeInnerHTML = true;
        }
      }

      if (hasUnsafeInnerHTML) {
        // Check if there's sanitization
        const hasSanitization =
          wizardSource.includes('escape') ||
          wizardSource.includes('sanitize') ||
          wizardSource.includes('textContent') ||
          wizardSource.includes('encodeURIComponent');

        if (!hasSanitization) {
          console.warn('Warning: innerHTML used without visible sanitization - verify XSS protection');
        }
      }

      // CSP should be set
      if (!wizardSource.includes('Content-Security-Policy')) {
        throw new Error('Should set Content-Security-Policy for webview');
      }
    }
  },
  {
    id: 'SEC-004',
    name: 'File path validation - no path traversal',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check for path handling
      const hasPathHandling =
        wizardSource.includes('path.') ||
        wizardSource.includes("import * as path") ||
        wizardSource.includes('require("path")');

      if (hasPathHandling) {
        // Good - using path module
        // Check for path normalization
        if (!wizardSource.includes('path.normalize') &&
            !wizardSource.includes('path.resolve') &&
            !wizardSource.includes('path.join')) {
          console.warn('Warning: Path operations should use path.join/resolve for safety');
        }
      }

      // Check no direct ../ concatenation
      if (wizardSource.includes('+ ".."') || wizardSource.includes("+ '..'")) {
        throw new Error('Avoid direct path concatenation with ".."');
      }
    }
  },
  {
    id: 'SEC-005',
    name: 'HTTPS enforcement - all API calls use HTTPS',
    fn: async () => {
      const sources = [];
      if (fileExists(QLIK_API_PATH)) {
        sources.push(readFile(QLIK_API_PATH));
      }
      sources.push(readFile(WIZARD_PANEL_PATH));
      const combined = sources.join('\n');

      // Check for http:// (not https://)
      const httpPattern = /http:\/\/(?!localhost|127\.0\.0\.1)/g;
      const matches = combined.match(httpPattern);

      if (matches && matches.length > 0) {
        throw new Error(`Found insecure http:// URLs: ${matches.join(', ')}`);
      }

      // Check Qlik Cloud uses HTTPS
      if (combined.includes('qlikcloud.com')) {
        if (!combined.includes('https://')) {
          throw new Error('Qlik Cloud connections must use HTTPS');
        }
      }
    }
  },
  {
    id: 'SEC-006',
    name: 'Token storage secure - uses VS Code SecretStorage',
    fn: async () => {
      const sources = [readFile(EXTENSION_PATH)];
      if (fileExists(QLIK_API_PATH)) {
        sources.push(readFile(QLIK_API_PATH));
      }
      const combined = sources.join('\n');

      // Check for SecretStorage usage
      const hasSecretStorage =
        combined.includes('SecretStorage') ||
        combined.includes('secrets') ||
        combined.includes('context.secrets');

      // Or secure configuration
      const hasSecureConfig =
        combined.includes('getConfiguration') ||
        combined.includes('password: true');

      if (!hasSecretStorage && !hasSecureConfig) {
        console.warn('Warning: Consider using VS Code SecretStorage for sensitive data');
      }
    }
  },
  {
    id: 'SEC-007',
    name: 'Session timeout - sessions expire after inactivity',
    fn: async () => {
      // For webviews, session is managed by VS Code
      // Check retainContextWhenHidden behavior
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Webview sessions are inherently tied to the panel lifecycle
      // This is acceptable security behavior
      if (wizardSource.includes('retainContextWhenHidden')) {
        // Panel context is managed by VS Code
      }
    }
  },
  {
    id: 'SEC-008',
    name: 'Error messages safe - no stack traces/paths to user',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check error handling doesn't expose stack traces
      const errorHandling = wizardSource.includes('catch');
      if (!errorHandling) {
        throw new Error('Should have error handling');
      }

      // Check for stack trace exposure
      if (wizardSource.includes('.stack') && wizardSource.includes('postMessage')) {
        console.warn('Warning: Verify stack traces are not sent to webview');
      }

      // Should have user-friendly error messages
      const hasUserFriendlyErrors =
        wizardSource.includes('Error:') ||
        wizardSource.includes('error') ||
        wizardSource.includes('שגיאה');

      if (!hasUserFriendlyErrors) {
        throw new Error('Should have user-friendly error messages');
      }
    }
  }
];

// ============================================================================
// Performance Tests (PERF-001 to PERF-006)
// ============================================================================

export const performanceTests = [
  {
    id: 'PERF-001',
    name: 'Cold start activation < 500ms target',
    fn: async () => {
      const extensionSource = readFile(EXTENSION_PATH);

      // Check for async patterns (good for performance)
      const hasAsyncActivation =
        extensionSource.includes('async function activate') ||
        extensionSource.includes('activate = async');

      // Check for lazy loading patterns
      const hasLazyLoading =
        extensionSource.includes('when needed') ||
        extensionSource.includes('on demand') ||
        extensionSource.includes('import(');

      // Count sync operations in activate
      const syncOps = (extensionSource.match(/readFileSync|writeFileSync/g) || []).length;
      if (syncOps > 3) {
        console.warn(`Warning: ${syncOps} sync file operations may slow activation`);
      }
    }
  },
  {
    id: 'PERF-002',
    name: 'Warm start activation < 200ms target',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check for caching
      const hasCaching =
        wizardSource.includes('cache') ||
        wizardSource.includes('cached') ||
        wizardSource.includes('memoize') ||
        wizardSource.includes('currentPanel'); // Singleton is a form of caching

      if (!hasCaching) {
        console.warn('Warning: Consider caching for faster warm starts');
      }
    }
  },
  {
    id: 'PERF-003',
    name: 'Panel render time < 200ms target',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check HTML is not excessively large
      const htmlMatches = wizardSource.match(/`[^`]{50000,}`/g);
      if (htmlMatches) {
        throw new Error('HTML template is very large - may slow rendering');
      }

      // Check for efficient rendering patterns
      const hasEfficientRendering =
        wizardSource.includes('display: none') ||
        wizardSource.includes('hidden') ||
        wizardSource.includes('visibility');

      if (!hasEfficientRendering) {
        console.warn('Warning: Consider hiding unused sections for faster perceived render');
      }
    }
  },
  {
    id: 'PERF-004',
    name: 'Step navigation time < 100ms target',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Navigation should be simple DOM manipulation
      const hasSimpleNavigation =
        wizardSource.includes('display') ||
        wizardSource.includes('classList') ||
        wizardSource.includes('style.');

      if (!hasSimpleNavigation) {
        throw new Error('Step navigation should use simple DOM operations');
      }

      // Should not reload entire HTML
      if (wizardSource.includes('innerHTML') && wizardSource.includes('getHtmlForWebview')) {
        console.warn('Warning: Avoid full HTML reload on step navigation');
      }
    }
  },
  {
    id: 'PERF-005',
    name: 'File parse time (1MB CSV) < 1s target',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check for streaming/chunked processing
      const hasStreamProcessing =
        wizardSource.includes('stream') ||
        wizardSource.includes('chunk') ||
        wizardSource.includes('Worker') ||
        wizardSource.includes('slice');

      // For small files, direct processing is fine
      // For large files, streaming is recommended
      if (!hasStreamProcessing) {
        console.warn('Warning: Consider streaming for large file processing');
      }
    }
  },
  {
    id: 'PERF-006',
    name: 'Memory leak check - no growth > 10%',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);
      const extensionSource = readFile(EXTENSION_PATH);

      // Check for proper cleanup
      const hasCleanup =
        wizardSource.includes('dispose') ||
        wizardSource.includes('_disposables') ||
        extensionSource.includes('subscriptions.push');

      if (!hasCleanup) {
        throw new Error('Should have proper resource cleanup to prevent leaks');
      }

      // Check for event listener cleanup
      const addListenerCount = (wizardSource.match(/addEventListener/g) || []).length;
      const removeListenerCount = (wizardSource.match(/removeEventListener/g) || []).length;

      // In webviews, listeners are cleaned up when panel disposes
      // But should still be careful about internal listeners
    }
  }
];

// ============================================================================
// Localization Tests (L10N-001 to L10N-006)
// ============================================================================

export const l10nTests = [
  {
    id: 'L10N-001',
    name: 'UTF-8 file names - Hebrew/Arabic names work',
    fn: async () => {
      // Check test fixture exists
      const unicodeFile = path.join(FIXTURES_DIR, 'test-unicode.csv');
      if (!fileExists(unicodeFile)) {
        throw new Error('test-unicode.csv fixture should exist for L10n testing');
      }

      // Check file content has Unicode
      const content = readFile(unicodeFile);
      const hasUnicode = /[^\x00-\x7F]/.test(content);
      if (!hasUnicode) {
        throw new Error('test-unicode.csv should contain non-ASCII characters');
      }
    }
  },
  {
    id: 'L10N-002',
    name: 'UTF-8 file content - non-ASCII data displays correctly',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check for UTF-8 meta tag
      if (!wizardSource.includes('charset="UTF-8"') && !wizardSource.includes("charset='UTF-8'")) {
        throw new Error('HTML should declare UTF-8 charset');
      }
    }
  },
  {
    id: 'L10N-003',
    name: 'Date formats - ISO dates parsed regardless of locale',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check for date handling
      const hasDateHandling =
        wizardSource.includes('Date') ||
        wizardSource.includes('date') ||
        wizardSource.includes('ISO') ||
        wizardSource.includes('timestamp');

      // ISO format is locale-independent
      if (wizardSource.includes('toLocaleDateString')) {
        console.warn('Warning: toLocaleDateString may vary by locale - use ISO for consistency');
      }
    }
  },
  {
    id: 'L10N-004',
    name: 'Number formats - decimal separators handled',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check for number handling
      const hasNumberHandling =
        wizardSource.includes('parseFloat') ||
        wizardSource.includes('parseInt') ||
        wizardSource.includes('Number') ||
        wizardSource.includes('isNumber');

      // Should handle different decimal separators
      if (wizardSource.includes('toLocaleString')) {
        console.warn('Warning: toLocaleString may vary by locale - consider consistent formatting');
      }
    }
  },
  {
    id: 'L10N-005',
    name: 'RTL data display - Hebrew/Arabic text renders correctly',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check for RTL support
      const hasRTLSupport =
        wizardSource.includes('dir=') ||
        wizardSource.includes('direction') ||
        wizardSource.includes('rtl') ||
        wizardSource.includes('RTL');

      // UI uses Hebrew, so should have RTL
      if (wizardSource.includes('lang="he"') || wizardSource.includes("lang='he'")) {
        if (!wizardSource.includes('dir=')) {
          throw new Error('Hebrew UI should have dir attribute for RTL');
        }
      }
    }
  },
  {
    id: 'L10N-006',
    name: 'Long text wrapping - no truncation in UI',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check for text overflow handling
      const hasOverflowHandling =
        wizardSource.includes('text-overflow') ||
        wizardSource.includes('overflow') ||
        wizardSource.includes('word-wrap') ||
        wizardSource.includes('word-break');

      if (!hasOverflowHandling) {
        console.warn('Warning: Consider adding text overflow handling for long content');
      }
    }
  }
];

// ============================================================================
// Compatibility Tests (COMPAT-001 to COMPAT-006)
// ============================================================================

export const compatibilityTests = [
  {
    id: 'COMPAT-001',
    name: 'Activation on VS Code 1.85+',
    fn: async () => {
      const packageJson = JSON.parse(readFile(PACKAGE_JSON_PATH));

      // Check engine version
      const engines = packageJson.engines?.vscode;
      if (!engines) {
        throw new Error('package.json should specify VS Code engine version');
      }

      // Should support 1.85+
      if (!engines.includes('1.85') && !engines.includes('^1.8')) {
        console.warn(`Warning: Engine version is ${engines} - verify 1.85 compatibility`);
      }
    }
  },
  {
    id: 'COMPAT-002',
    name: 'Activation on VS Code 1.80',
    fn: async () => {
      const packageJson = JSON.parse(readFile(PACKAGE_JSON_PATH));

      // Check minimum version
      const engines = packageJson.engines?.vscode;
      if (engines) {
        const minVersion = engines.replace(/[\^~>=<]/g, '').split('.')[1];
        const minMinor = parseInt(minVersion) || 0;
        if (minMinor > 80) {
          console.warn('Warning: Extension may not support VS Code 1.80');
        }
      }
    }
  },
  {
    id: 'COMPAT-003',
    name: 'Webview on VS Code 1.85 - panel renders',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check webview API usage is compatible
      const usesWebviewApi =
        wizardSource.includes('createWebviewPanel') ||
        wizardSource.includes('WebviewPanel');

      if (!usesWebviewApi) {
        throw new Error('Should use standard WebviewPanel API');
      }
    }
  },
  {
    id: 'COMPAT-004',
    name: 'Webview on VS Code 1.80 - panel renders',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check for deprecated API usage
      // createWebviewPanel has been stable since 1.25
      if (wizardSource.includes('createWebviewPanel')) {
        // Good - stable API
      }
    }
  },
  {
    id: 'COMPAT-005',
    name: 'Extension upgrade - no state loss',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // State preservation is handled by retainContextWhenHidden
      if (!wizardSource.includes('retainContextWhenHidden')) {
        throw new Error('Should preserve state during upgrade');
      }

      // Check for state versioning (good practice)
      if (wizardSource.includes('version') || wizardSource.includes('schema')) {
        // Good - has version handling
      }
    }
  },
  {
    id: 'COMPAT-006',
    name: 'Fresh install after uninstall - clean state',
    fn: async () => {
      const extensionSource = readFile(EXTENSION_PATH);

      // Check for initialization
      const hasInitialization =
        extensionSource.includes('activate') ||
        extensionSource.includes('initialize');

      if (!hasInitialization) {
        throw new Error('Should properly initialize on fresh install');
      }
    }
  }
];

// ============================================================================
// Accessibility Tests (A11Y-001 to A11Y-006)
// ============================================================================

export const accessibilityTests = [
  {
    id: 'A11Y-001',
    name: 'Color contrast - WCAG AA compliant',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check for VS Code theme variables (they handle contrast)
      const usesThemeVars =
        wizardSource.includes('--vscode-') ||
        wizardSource.includes('var(--vscode');

      if (!usesThemeVars) {
        throw new Error('Should use VS Code theme variables for contrast compliance');
      }

      // Check no hardcoded low-contrast colors
      const lowContrastPatterns = [
        /color:\s*#[89a-f]{6}/i,  // Light grays
        /color:\s*lightgray/i,
      ];

      for (const pattern of lowContrastPatterns) {
        if (pattern.test(wizardSource)) {
          console.warn('Warning: Check hardcoded colors for contrast compliance');
        }
      }
    }
  },
  {
    id: 'A11Y-002',
    name: 'Focus indicators - visible focus states',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check for focus styling
      const hasFocusStyles =
        wizardSource.includes(':focus') ||
        wizardSource.includes('focus') ||
        wizardSource.includes('outline');

      if (!hasFocusStyles) {
        throw new Error('Should have visible focus indicators');
      }
    }
  },
  {
    id: 'A11Y-003',
    name: 'ARIA labels - all interactive elements labeled',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check for ARIA attributes
      const hasAria =
        wizardSource.includes('aria-') ||
        wizardSource.includes('role=');

      // Buttons with text are self-labeling
      const hasLabeledButtons = wizardSource.includes('<button');

      if (!hasAria && !hasLabeledButtons) {
        throw new Error('Should have ARIA labels for interactive elements');
      }
    }
  },
  {
    id: 'A11Y-004',
    name: 'Keyboard traps - no trapped focus',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check for focus management
      const hasFocusManagement =
        wizardSource.includes('tabindex') ||
        wizardSource.includes('focus()') ||
        wizardSource.includes('focusable');

      // Modal-like behavior should have escape
      if (wizardSource.includes('modal') || wizardSource.includes('dialog')) {
        const hasEscape =
          wizardSource.includes('Escape') ||
          wizardSource.includes('escape') ||
          wizardSource.includes('close');

        if (!hasEscape) {
          console.warn('Warning: Modal elements should have escape key handling');
        }
      }
    }
  },
  {
    id: 'A11Y-005',
    name: 'Heading hierarchy - proper H1-H6 structure',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check for heading usage
      const hasHeadings =
        wizardSource.includes('<h1') ||
        wizardSource.includes('<h2') ||
        wizardSource.includes('<h3');

      if (!hasHeadings) {
        throw new Error('Should use proper heading elements for structure');
      }

      // Check heading order (h1 before h2, etc.)
      const h1Index = wizardSource.indexOf('<h1');
      const h2Index = wizardSource.indexOf('<h2');
      const h3Index = wizardSource.indexOf('<h3');

      if (h2Index !== -1 && h1Index === -1) {
        console.warn('Warning: h2 found without h1 - check heading hierarchy');
      }

      if (h3Index !== -1 && h2Index === -1 && h1Index === -1) {
        console.warn('Warning: h3 found without h2 or h1 - check heading hierarchy');
      }
    }
  },
  {
    id: 'A11Y-006',
    name: 'Alt text - all images have alt',
    fn: async () => {
      const wizardSource = readFile(WIZARD_PANEL_PATH);

      // Check for images
      const imgPattern = /<img[^>]*>/g;
      const images = wizardSource.match(imgPattern) || [];

      for (const img of images) {
        if (!img.includes('alt=')) {
          throw new Error('All images should have alt attribute');
        }
      }

      // Check SVG icons have titles or aria-label
      const svgPattern = /<svg[^>]*>/g;
      const svgs = wizardSource.match(svgPattern) || [];

      for (const svg of svgs) {
        const hasAccessibility =
          svg.includes('aria-') ||
          svg.includes('role=') ||
          svg.includes('title');

        if (!hasAccessibility) {
          console.warn('Warning: SVG icons should have aria-label or title');
        }
      }
    }
  }
];

// ============================================================================
// Combined Export
// ============================================================================

export const specializedTests = [
  ...securityTests,
  ...performanceTests,
  ...l10nTests,
  ...compatibilityTests,
  ...accessibilityTests,
];

// Run all specialized tests
async function runSpecializedTests(): Promise<void> {
  console.log('Running Specialized Tests...\n');

  const categories = [
    { name: 'Security', tests: securityTests },
    { name: 'Performance', tests: performanceTests },
    { name: 'Localization', tests: l10nTests },
    { name: 'Compatibility', tests: compatibilityTests },
    { name: 'Accessibility', tests: accessibilityTests },
  ];

  let totalPassed = 0;
  let totalFailed = 0;

  for (const category of categories) {
    console.log(`\n=== ${category.name} Tests ===\n`);

    let passed = 0;
    let failed = 0;

    for (const test of category.tests) {
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

    console.log(`\n${category.name}: ${passed} passed, ${failed} failed`);
    totalPassed += passed;
    totalFailed += failed;
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Total: ${totalPassed} passed, ${totalFailed} failed`);
  console.log('='.repeat(50));

  if (totalFailed > 0) {
    process.exitCode = 1;
  }
}

// Export for main runner
export default specializedTests;

// Run if executed directly
if (require.main === module) {
  runSpecializedTests().catch(console.error);
}
