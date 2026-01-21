const fs = require('fs');
const path = require('path');

const dashboardUIPath = path.join(__dirname, 'out/ui/dashboardUI.js');
const wizardPanelPath = path.join(__dirname, 'out/wizardPanel.js');

if (!fs.existsSync(dashboardUIPath)) {
  console.log('Need to compile first. Run: npm run compile');
  process.exit(1);
}

const code = fs.readFileSync(dashboardUIPath, 'utf-8');

// Extract styles
const stylesMatch = code.match(/function getDashboardStyles\(\)\s*\{[\s\S]*?return\s*`([\s\S]*?)`;[\s\S]*?\}/);
const styles = stylesMatch ? stylesMatch[1] : '';

// Extract script
const funcStartMatch = code.match(/function getDashboardScript\(\)\s*\{\s*return\s*`/);
if (!funcStartMatch) {
  console.log('Could not find getDashboardScript');
  process.exit(1);
}
const startIndex = funcStartMatch.index + funcStartMatch[0].length;
const endPattern = /`;\s*\n\}/g;
endPattern.lastIndex = startIndex;
const endMatch = endPattern.exec(code);
let script = code.substring(startIndex, endMatch.index);
script = script.replace(/\\`/g, '`');
script = script.replace(/\\\$/g, '$');

// Read wizardPanel for HTML structure
const wizardCode = fs.readFileSync(wizardPanelPath, 'utf-8');
const htmlMatch = wizardCode.match(/return\s*`(<!DOCTYPE html>[\s\S]*?)<\/html>`/);

if (!htmlMatch) {
  console.log('Could not extract HTML');
  process.exit(1);
}

let html = htmlMatch[1] + '</html>';

// Replace placeholders
html = html.replace(/\$\{nonce\}/g, 'test-nonce');
html = html.replace(/\$\{[^}]*cspSource[^}]*\}/g, "'self' 'unsafe-inline'");
html = html.replace(/\$\{[^}]+styleUri[^}]*\}/g, '');
html = html.replace(/\$\{[^}]+scriptUri[^}]*\}/g, '');
html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'self\' \'unsafe-inline\'; script-src \'unsafe-inline\';">');
html = html.replace(/ nonce="[^"]*"/g, '');

// FIX: Change RTL to LTR
html = html.replace('lang="he"', 'lang="en"');
html = html.replace('dir="rtl"', 'dir="ltr"');

html = html.replace('${(0, dashboardUI_1.getDashboardStyles)()}', styles);
html = html.replace('${(0, dashboardUI_1.getDashboardScript)()}', script);

// Add mock VS Code API and CSS variable fallbacks
const mockApi = `
<style>
  /* VS Code CSS Variable Fallbacks for standalone preview */
  :root {
    --vscode-editor-background: #1e1e1e;
    --vscode-sideBar-background: #252526;
    --vscode-editorWidget-background: #2d2d30;
    --vscode-list-hoverBackground: #2a2d2e;
    --vscode-list-activeSelectionBackground: #094771;
    --vscode-editor-foreground: #cccccc;
    --vscode-descriptionForeground: #8b8b8b;
    --vscode-panel-border: #3c3c3c;
    --vscode-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    --vscode-font-size: 13px;
    --vscode-button-background: #0e639c;
    --vscode-button-foreground: #ffffff;
    --vscode-button-hoverBackground: #1177bb;
    --vscode-input-background: #3c3c3c;
    --vscode-input-foreground: #cccccc;
    --vscode-input-border: #3c3c3c;
    --vscode-focusBorder: #007acc;
  }

  /* Force LTR direction */
  html, body {
    direction: ltr !important;
    text-align: left !important;
  }

  .progress-bar {
    direction: ltr !important;
  }
</style>
<script>
  window.wizardState = { currentStep: 1, entryPoint: null };
  window.acquireVsCodeApi = function() {
    return {
      postMessage: function(msg) { console.log('postMessage:', msg); },
      getState: function() { return window.wizardState; },
      setState: function(state) { window.wizardState = {...window.wizardState, ...state}; return window.wizardState; }
    };
  };
</script>
`;
// Inject CSS fallbacks BEFORE the main styles (after <head>)
html = html.replace('<head>', '<head>' + mockApi);

fs.writeFileSync(path.join(__dirname, 'preview.html'), html);
console.log('Created preview.html - open it in browser');
