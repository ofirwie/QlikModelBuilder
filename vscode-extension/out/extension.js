"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
// Top-level log to verify module loading
console.log('[QMB] Extension module loading...');
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
console.log('[QMB] Core modules loaded, loading local modules...');
const wizardPanel_1 = require("./wizardPanel");
const qlikApi_1 = require("./qlikApi");
console.log('[QMB] All modules loaded successfully');
// Debug logging to file
const debugLogPath = path.join(__dirname, '..', 'extension-debug.log');
function debugLog(msg) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${msg}\n`;
    try {
        fs.appendFileSync(debugLogPath, line);
    }
    catch (e) {
        // Ignore file write errors
    }
    console.log(msg);
}
let qlikApi;
function activate(context) {
    // Clear previous log
    try {
        fs.writeFileSync(debugLogPath, '');
    }
    catch (e) { /* ignore */ }
    debugLog('=== Extension activate() called ===');
    debugLog(`Extension path: ${context.extensionPath}`);
    try {
        debugLog('Initializing extension...');
        // Initialize Qlik API service
        qlikApi = new qlikApi_1.QlikApiService(context);
        debugLog('QlikApiService created');
        // Register command to open wizard
        const openWizardCmd = vscode.commands.registerCommand('qmb.openWizard', () => {
            debugLog('qmb.openWizard command executed');
            wizardPanel_1.WizardPanel.createOrShow(context.extensionUri, qlikApi);
        });
        debugLog('qmb.openWizard registered');
        // Register command for new project
        const newProjectCmd = vscode.commands.registerCommand('qmb.newProject', () => {
            debugLog('qmb.newProject command executed');
            wizardPanel_1.WizardPanel.createOrShow(context.extensionUri, qlikApi);
            wizardPanel_1.WizardPanel.currentPanel?.postMessage({ type: 'startWizard', mode: 'scratch' });
        });
        debugLog('qmb.newProject registered');
        // Register command to configure credentials
        const configureCmd = vscode.commands.registerCommand('qmb.configure', async () => {
            debugLog('qmb.configure command executed');
            const tenantUrl = await vscode.window.showInputBox({
                prompt: 'Qlik Cloud Tenant URL',
                placeHolder: 'https://your-tenant.region.qlikcloud.com',
                value: qlikApi.getCredentials().tenantUrl
            });
            if (!tenantUrl) {
                return;
            }
            const apiKey = await vscode.window.showInputBox({
                prompt: 'Qlik Cloud API Key',
                placeHolder: 'eyJhbGciOiJFUzM4NCIs...',
                password: true
            });
            if (!apiKey) {
                return;
            }
            await qlikApi.saveCredentials(tenantUrl, apiKey);
            const result = await qlikApi.testConnection();
            if (result.success) {
                vscode.window.showInformationMessage(`Qlik Cloud: ${result.message}`);
            }
            else {
                vscode.window.showErrorMessage(`Connection failed: ${result.message}`);
            }
        });
        debugLog('qmb.configure registered');
        // Register webview provider for sidebar
        const provider = new WizardViewProvider(context.extensionUri, qlikApi);
        const webviewProvider = vscode.window.registerWebviewViewProvider('qmb.wizardView', provider);
        debugLog('Webview provider registered');
        context.subscriptions.push(openWizardCmd, newProjectCmd, configureCmd, webviewProvider);
        debugLog('Extension activation complete!');
    }
    catch (err) {
        debugLog(`ERROR during activation: ${err instanceof Error ? err.message : err}`);
        debugLog(`Stack: ${err instanceof Error ? err.stack : 'no stack'}`);
        throw err;
    }
}
function deactivate() {
    debugLog('Extension deactivate() called');
}
/**
 * Webview provider for the sidebar view
 */
class WizardViewProvider {
    constructor(extensionUri, qlikApi) {
        this.extensionUri = extensionUri;
        this.qlikApi = qlikApi;
    }
    resolveWebviewView(webviewView, _context, _token) {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri],
        };
        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
        // Handle messages from webview
        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.type) {
                case 'callTool':
                    const result = await this.handleToolCall(message.tool, message.args);
                    webviewView.webview.postMessage({ type: 'toolResult', id: message.id, result });
                    break;
                case 'openFullWizard':
                    wizardPanel_1.WizardPanel.createOrShow(this.extensionUri, this.qlikApi);
                    break;
                case 'checkConnection':
                    const isConfigured = this.qlikApi.isConfigured();
                    webviewView.webview.postMessage({ type: 'connectionStatus', configured: isConfigured });
                    break;
                case 'configure':
                    vscode.commands.executeCommand('qmb.configure');
                    break;
            }
        });
    }
    async handleToolCall(tool, _args) {
        if (!this.qlikApi.isConfigured()) {
            return { error: 'NOT_CONFIGURED', message: 'Please configure Qlik Cloud credentials first' };
        }
        try {
            switch (tool) {
                case 'getSpaces':
                    return { success: true, data: await this.qlikApi.getSpaces() };
                case 'getConnections':
                    return { success: true, data: await this.qlikApi.getConnections() };
                case 'getApps':
                    return { success: true, data: await this.qlikApi.getApps() };
                case 'testConnection':
                    return await this.qlikApi.testConnection();
                default:
                    return { error: 'UNKNOWN_TOOL', message: `Unknown tool: ${tool}` };
            }
        }
        catch (err) {
            return { error: 'API_ERROR', message: err instanceof Error ? err.message : 'Unknown error' };
        }
    }
    getHtmlForWebview(webview) {
        return getWizardHtml(webview, this.extensionUri);
    }
}
/**
 * Generate the wizard HTML
 */
function getWizardHtml(webview, extensionUri) {
    const nonce = getNonce();
    return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>Qlik Model Builder</title>
  <style>
    :root {
      --bg-primary: var(--vscode-editor-background);
      --bg-secondary: var(--vscode-sideBar-background);
      --text-primary: var(--vscode-editor-foreground);
      --text-secondary: var(--vscode-descriptionForeground);
      --accent: var(--vscode-button-background);
      --accent-hover: var(--vscode-button-hoverBackground);
      --border: var(--vscode-panel-border);
      --success: #4caf50;
      --warning: #ff9800;
      --error: #f44336;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--vscode-font-family);
      background: var(--bg-primary);
      color: var(--text-primary);
      padding: 16px;
      min-height: 100vh;
    }

    .header {
      text-align: center;
      margin-bottom: 24px;
    }

    .header h1 {
      font-size: 1.5em;
      margin-bottom: 8px;
    }

    /* Progress Steps */
    .progress-bar {
      display: flex;
      justify-content: space-between;
      margin-bottom: 32px;
      padding: 0 8px;
    }

    .step-indicator {
      display: flex;
      flex-direction: column;
      align-items: center;
      flex: 1;
      position: relative;
    }

    .step-indicator:not(:last-child)::after {
      content: '';
      position: absolute;
      top: 15px;
      right: -50%;
      width: 100%;
      height: 2px;
      background: var(--border);
      z-index: 0;
    }

    .step-indicator.completed:not(:last-child)::after {
      background: var(--success);
    }

    .step-circle {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: var(--bg-secondary);
      border: 2px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: bold;
      z-index: 1;
      transition: all 0.3s;
    }

    .step-indicator.completed .step-circle {
      background: var(--success);
      border-color: var(--success);
      color: white;
    }

    .step-indicator.current .step-circle {
      background: var(--accent);
      border-color: var(--accent);
      color: white;
      transform: scale(1.1);
    }

    .step-label {
      font-size: 10px;
      margin-top: 4px;
      color: var(--text-secondary);
      text-align: center;
    }

    .step-indicator.current .step-label {
      color: var(--accent);
      font-weight: bold;
    }

    /* Content Area */
    .content {
      background: var(--bg-secondary);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 16px;
    }

    .content h2 {
      font-size: 1.2em;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* Form Elements */
    .form-group {
      margin-bottom: 16px;
    }

    .form-group label {
      display: block;
      margin-bottom: 6px;
      font-size: 13px;
      color: var(--text-secondary);
    }

    select, input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: var(--bg-primary);
      color: var(--text-primary);
      font-size: 14px;
    }

    select:focus, input:focus {
      outline: none;
      border-color: var(--accent);
    }

    /* Buttons */
    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;
    }

    .btn-primary {
      background: var(--accent);
      color: white;
    }

    .btn-primary:hover {
      background: var(--accent-hover);
    }

    .btn-secondary {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text-primary);
    }

    .btn-secondary:hover {
      background: var(--bg-secondary);
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .button-row {
      display: flex;
      gap: 12px;
      justify-content: space-between;
      margin-top: 20px;
    }

    /* List Items */
    .item-list {
      list-style: none;
    }

    .item-list li {
      padding: 12px;
      background: var(--bg-primary);
      border-radius: 4px;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.2s;
    }

    .item-list li:hover {
      border-color: var(--accent);
    }

    .item-list li.selected {
      border-color: var(--success);
      background: rgba(76, 175, 80, 0.1);
    }

    .item-info {
      display: flex;
      flex-direction: column;
    }

    .item-name {
      font-weight: 500;
    }

    .item-type {
      font-size: 12px;
      color: var(--text-secondary);
    }

    /* Status Badge */
    .badge {
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
    }

    .badge-managed { background: #e3f2fd; color: #1976d2; }
    .badge-shared { background: #f3e5f5; color: #7b1fa2; }
    .badge-personal { background: #fff3e0; color: #f57c00; }

    /* Loading */
    .loading {
      text-align: center;
      padding: 40px;
      color: var(--text-secondary);
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Messages */
    .message {
      padding: 12px;
      border-radius: 4px;
      margin-bottom: 16px;
    }

    .message-success { background: rgba(76, 175, 80, 0.1); border-right: 3px solid var(--success); }
    .message-error { background: rgba(244, 67, 54, 0.1); border-right: 3px solid var(--error); }
    .message-warning { background: rgba(255, 152, 0, 0.1); border-right: 3px solid var(--warning); }
  </style>
</head>
<body>
  <div class="header">
    <h1>Qlik Model Builder</h1>
    <p>בניית מודל נתונים צעד אחר צעד</p>
  </div>

  <div class="progress-bar" id="progressBar">
    <div class="step-indicator current" data-step="1">
      <div class="step-circle">1</div>
      <span class="step-label">Entry</span>
    </div>
    <div class="step-indicator" data-step="2">
      <div class="step-circle">2</div>
      <span class="step-label">Space</span>
    </div>
    <div class="step-indicator" data-step="3">
      <div class="step-circle">3</div>
      <span class="step-label">Source</span>
    </div>
    <div class="step-indicator" data-step="4">
      <div class="step-circle">4</div>
      <span class="step-label">Tables</span>
    </div>
    <div class="step-indicator" data-step="5">
      <div class="step-circle">5</div>
      <span class="step-label">Fields</span>
    </div>
    <div class="step-indicator" data-step="6">
      <div class="step-circle">6</div>
      <span class="step-label">Incremental</span>
    </div>
    <div class="step-indicator" data-step="7">
      <div class="step-circle">7</div>
      <span class="step-label">Deploy</span>
    </div>
  </div>

  <div class="content" id="content">
    <!-- Step 1: Space Selection -->
    <div id="step-space" class="step-content">
      <h2>📁 בחירת Space</h2>
      <p style="margin-bottom: 16px; color: var(--text-secondary);">
        בחר את ה-Space שבו תרצה ליצור את האפליקציה
      </p>

      <div id="spaces-loading" class="loading">
        <div class="spinner"></div>
        <p>טוען Spaces...</p>
      </div>

      <ul class="item-list" id="spaces-list" style="display: none;"></ul>

      <div class="button-row">
        <button class="btn btn-secondary" onclick="createNewSpace()">
          + צור Space חדש
        </button>
        <button class="btn btn-primary" id="btn-next-space" disabled onclick="nextStep()">
          המשך →
        </button>
      </div>
    </div>

    <!-- Step 2: Connection -->
    <div id="step-source" class="step-content" style="display: none;">
      <h2>🔗 מקור נתונים</h2>
      <p style="margin-bottom: 16px; color: var(--text-secondary);">
        בחר חיבור קיים או צור חדש
      </p>

      <ul class="item-list" id="connections-list"></ul>

      <div class="button-row">
        <button class="btn btn-secondary" onclick="prevStep()">← חזור</button>
        <button class="btn btn-secondary" onclick="createNewConnection()">
          + חיבור חדש
        </button>
        <button class="btn btn-primary" id="btn-next-conn" disabled onclick="nextStep()">
          המשך →
        </button>
      </div>
    </div>

    <!-- More steps will be added dynamically -->
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    // State
    let state = {
      currentStep: 0,
      steps: ['entry', 'space', 'source', 'tables', 'fields', 'incremental', 'deploy'],
      selectedSpace: null,
      selectedConnection: null,
      selectedTables: [],
      spaces: [],
      connections: []
    };

    // Initialize
    document.addEventListener('DOMContentLoaded', () => {
      loadSpaces();
    });

    // Call MCP tool
    function callTool(tool, args = {}) {
      return new Promise((resolve) => {
        const id = Date.now().toString();
        const handler = (event) => {
          const message = event.data;
          if (message.type === 'toolResult' && message.id === id) {
            window.removeEventListener('message', handler);
            resolve(message.result);
          }
        };
        window.addEventListener('message', handler);
        vscode.postMessage({ type: 'callTool', tool, args, id });
      });
    }

    // Load spaces
    async function loadSpaces() {
      const loading = document.getElementById('spaces-loading');
      const list = document.getElementById('spaces-list');

      try {
        const result = await callTool('qmb_list_spaces');

        // Mock data for now
        state.spaces = [
          { id: 'space-1', name: 'Production', type: 'managed' },
          { id: 'space-2', name: 'Development', type: 'shared' },
          { id: 'space-3', name: 'Personal', type: 'personal' }
        ];

        loading.style.display = 'none';
        list.style.display = 'block';

        renderSpaces();
      } catch (err) {
        loading.innerHTML = '<p style="color: var(--error);">שגיאה בטעינת Spaces</p>';
      }
    }

    // Render spaces list
    function renderSpaces() {
      const list = document.getElementById('spaces-list');
      list.innerHTML = state.spaces.map(space => \`
        <li onclick="selectSpace('\${space.id}')" class="\${state.selectedSpace === space.id ? 'selected' : ''}">
          <div class="item-info">
            <span class="item-name">\${space.name}</span>
            <span class="item-type">\${space.type}</span>
          </div>
          <span class="badge badge-\${space.type}">\${space.type}</span>
        </li>
      \`).join('');
    }

    // Select space
    function selectSpace(id) {
      state.selectedSpace = id;
      renderSpaces();
      document.getElementById('btn-next-space').disabled = false;
    }

    // Create new space
    function createNewSpace() {
      // TODO: Show create space dialog
      vscode.postMessage({ type: 'showInput', title: 'שם ל-Space החדש' });
    }

    // Navigation
    function nextStep() {
      if (state.currentStep < state.steps.length - 1) {
        state.currentStep++;
        updateUI();
      }
    }

    function prevStep() {
      if (state.currentStep > 0) {
        state.currentStep--;
        updateUI();
      }
    }

    function updateUI() {
      // Update progress bar
      const indicators = document.querySelectorAll('.step-indicator');
      indicators.forEach((ind, i) => {
        ind.classList.remove('completed', 'current');
        if (i < state.currentStep) ind.classList.add('completed');
        if (i === state.currentStep) ind.classList.add('current');
      });

      // Show current step content
      document.querySelectorAll('.step-content').forEach(el => {
        el.style.display = 'none';
      });
      const currentStepEl = document.getElementById('step-' + state.steps[state.currentStep]);
      if (currentStepEl) {
        currentStepEl.style.display = 'block';
      }
    }

    // Handle messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      switch (message.type) {
        case 'startWizard':
          state.currentStep = 0;
          updateUI();
          loadSpaces();
          break;
      }
    });
  </script>
</body>
</html>`;
}
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
//# sourceMappingURL=extension.js.map