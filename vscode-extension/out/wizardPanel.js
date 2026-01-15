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
exports.WizardPanel = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Full-screen wizard panel
 */
class WizardPanel {
    static createOrShow(extensionUri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        if (WizardPanel.currentPanel) {
            WizardPanel.currentPanel._panel.reveal(column);
            return;
        }
        const panel = vscode.window.createWebviewPanel(WizardPanel.viewType, 'Qlik Model Builder', column || vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [extensionUri],
            retainContextWhenHidden: true,
        });
        WizardPanel.currentPanel = new WizardPanel(panel, extensionUri);
    }
    constructor(panel, extensionUri) {
        this._disposables = [];
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._update();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.type) {
                case 'callTool':
                    const result = await this.callMcpTool(message.tool, message.args);
                    this._panel.webview.postMessage({
                        type: 'toolResult',
                        id: message.id,
                        result,
                    });
                    break;
                case 'showInfo':
                    vscode.window.showInformationMessage(message.text);
                    break;
                case 'showError':
                    vscode.window.showErrorMessage(message.text);
                    break;
            }
        }, null, this._disposables);
    }
    postMessage(message) {
        this._panel.webview.postMessage(message);
    }
    async callMcpTool(tool, args) {
        // TODO: Connect to actual MCP server via stdio or HTTP
        // For now, mock responses
        console.log(`Calling tool: ${tool}`, args);
        switch (tool) {
            case 'qmb_list_spaces':
                return {
                    spaces: [
                        { id: 'space-1', name: 'Production', type: 'managed' },
                        { id: 'space-2', name: 'Development', type: 'shared' },
                    ],
                };
            case 'qmb_list_connections':
                return {
                    connections: [
                        { id: 'conn-1', name: 'SalesDB', type: 'sqlserver' },
                        { id: 'conn-2', name: 'Analytics API', type: 'rest_api' },
                    ],
                };
            default:
                return { success: true };
        }
    }
    dispose() {
        WizardPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
    _update() {
        this._panel.webview.html = this._getHtmlForWebview();
    }
    _getHtmlForWebview() {
        const webview = this._panel.webview;
        const nonce = getNonce();
        return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>Qlik Model Builder</title>
  <style>
    ${getStyles()}
  </style>
</head>
<body>
  <div class="wizard-container">
    <header class="wizard-header">
      <h1>Qlik Model Builder</h1>
      <p>בניית מודל נתונים עם תמיכה ב-Incremental Load</p>
    </header>

    <nav class="wizard-steps" id="wizardSteps">
      <div class="step active" data-step="1">
        <div class="step-number">1</div>
        <div class="step-info">
          <span class="step-title">Space</span>
          <span class="step-desc">בחירת סביבת עבודה</span>
        </div>
      </div>
      <div class="step-connector"></div>
      <div class="step" data-step="2">
        <div class="step-number">2</div>
        <div class="step-info">
          <span class="step-title">מקור נתונים</span>
          <span class="step-desc">הגדרת חיבור</span>
        </div>
      </div>
      <div class="step-connector"></div>
      <div class="step" data-step="3">
        <div class="step-number">3</div>
        <div class="step-info">
          <span class="step-title">טבלאות</span>
          <span class="step-desc">בחירת טבלאות</span>
        </div>
      </div>
      <div class="step-connector"></div>
      <div class="step" data-step="4">
        <div class="step-number">4</div>
        <div class="step-info">
          <span class="step-title">Incremental</span>
          <span class="step-desc">אסטרטגיית טעינה</span>
        </div>
      </div>
      <div class="step-connector"></div>
      <div class="step" data-step="5">
        <div class="step-number">5</div>
        <div class="step-info">
          <span class="step-title">סקירה</span>
          <span class="step-desc">אימות והפקת סקריפט</span>
        </div>
      </div>
      <div class="step-connector"></div>
      <div class="step" data-step="6">
        <div class="step-number">6</div>
        <div class="step-info">
          <span class="step-title">Deploy</span>
          <span class="step-desc">יצירת אפליקציה</span>
        </div>
      </div>
    </nav>

    <main class="wizard-content" id="wizardContent">
      <!-- Content loaded dynamically -->
    </main>

    <footer class="wizard-footer">
      <button class="btn btn-outline" id="btnPrev" onclick="prevStep()" style="visibility: hidden;">
        ← הקודם
      </button>
      <div class="footer-info" id="footerInfo"></div>
      <button class="btn btn-primary" id="btnNext" onclick="nextStep()">
        הבא →
      </button>
    </footer>
  </div>

  <script nonce="${nonce}">
    ${getScript()}
  </script>
</body>
</html>`;
    }
}
exports.WizardPanel = WizardPanel;
WizardPanel.viewType = 'qmbWizard';
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
function getStyles() {
    return `
    :root {
      --primary: #009845;
      --primary-dark: #007a38;
      --bg: var(--vscode-editor-background);
      --bg-card: var(--vscode-sideBar-background);
      --text: var(--vscode-editor-foreground);
      --text-muted: var(--vscode-descriptionForeground);
      --border: var(--vscode-panel-border);
      --success: #4caf50;
      --warning: #ff9800;
      --error: #f44336;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--vscode-font-family);
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
    }

    .wizard-container {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px;
    }

    .wizard-header {
      text-align: center;
      padding: 24px 0;
      border-bottom: 1px solid var(--border);
      margin-bottom: 24px;
    }

    .wizard-header h1 {
      font-size: 28px;
      color: var(--primary);
      margin-bottom: 8px;
    }

    .wizard-header p {
      color: var(--text-muted);
    }

    /* Steps Navigation */
    .wizard-steps {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 20px;
      background: var(--bg-card);
      border-radius: 12px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }

    .step {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      opacity: 0.5;
    }

    .step:hover { opacity: 0.8; }
    .step.active { opacity: 1; background: rgba(0, 152, 69, 0.1); }
    .step.completed { opacity: 1; }

    .step-number {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--border);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 14px;
    }

    .step.active .step-number {
      background: var(--primary);
      color: white;
    }

    .step.completed .step-number {
      background: var(--success);
      color: white;
    }

    .step.completed .step-number::after {
      content: '✓';
    }

    .step-info {
      display: flex;
      flex-direction: column;
    }

    .step-title {
      font-weight: 600;
      font-size: 14px;
    }

    .step-desc {
      font-size: 11px;
      color: var(--text-muted);
    }

    .step-connector {
      width: 30px;
      height: 2px;
      background: var(--border);
    }

    /* Content Area */
    .wizard-content {
      flex: 1;
      background: var(--bg-card);
      border-radius: 12px;
      padding: 32px;
      margin-bottom: 24px;
    }

    .content-header {
      margin-bottom: 24px;
    }

    .content-header h2 {
      font-size: 24px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .content-header p {
      color: var(--text-muted);
    }

    /* Cards */
    .card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }

    .card {
      background: var(--bg);
      border: 2px solid var(--border);
      border-radius: 8px;
      padding: 20px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .card:hover {
      border-color: var(--primary);
      transform: translateY(-2px);
    }

    .card.selected {
      border-color: var(--success);
      background: rgba(76, 175, 80, 0.05);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }

    .card-title {
      font-size: 16px;
      font-weight: 600;
    }

    .card-badge {
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 500;
    }

    .badge-managed { background: #e3f2fd; color: #1976d2; }
    .badge-shared { background: #f3e5f5; color: #7b1fa2; }
    .badge-personal { background: #fff3e0; color: #f57c00; }
    .badge-sqlserver { background: #ffebee; color: #c62828; }
    .badge-rest { background: #e8f5e9; color: #2e7d32; }

    .card-desc {
      font-size: 13px;
      color: var(--text-muted);
    }

    /* Buttons */
    .btn {
      padding: 12px 24px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
    }

    .btn-primary {
      background: var(--primary);
      color: white;
    }

    .btn-primary:hover {
      background: var(--primary-dark);
    }

    .btn-outline {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text);
    }

    .btn-outline:hover {
      background: var(--bg-card);
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-create {
      width: 100%;
      padding: 16px;
      border: 2px dashed var(--border);
      background: transparent;
      color: var(--text-muted);
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-create:hover {
      border-color: var(--primary);
      color: var(--primary);
    }

    /* Footer */
    .wizard-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 0;
      border-top: 1px solid var(--border);
    }

    .footer-info {
      color: var(--text-muted);
      font-size: 13px;
    }

    /* Loading */
    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px;
    }

    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid var(--border);
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 16px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Tables list */
    .table-list {
      max-height: 400px;
      overflow-y: auto;
    }

    .table-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      border: 1px solid var(--border);
      border-radius: 6px;
      margin-bottom: 8px;
      cursor: pointer;
    }

    .table-item:hover {
      border-color: var(--primary);
    }

    .table-item.selected {
      border-color: var(--success);
      background: rgba(76, 175, 80, 0.05);
    }

    .table-checkbox {
      width: 20px;
      height: 20px;
    }
  `;
}
function getScript() {
    return `
    const vscode = acquireVsCodeApi();

    // State
    const state = {
      currentStep: 1,
      totalSteps: 6,
      selectedSpace: null,
      selectedConnection: null,
      selectedTables: [],
      incrementalConfig: {},
      spaces: [],
      connections: [],
      tables: []
    };

    // Initialize
    init();

    async function init() {
      renderStep(1);
    }

    // API Call
    function callTool(tool, args = {}) {
      return new Promise((resolve) => {
        const id = Date.now().toString();
        const handler = (event) => {
          const msg = event.data;
          if (msg.type === 'toolResult' && msg.id === id) {
            window.removeEventListener('message', handler);
            resolve(msg.result);
          }
        };
        window.addEventListener('message', handler);
        vscode.postMessage({ type: 'callTool', tool, args, id });

        // Timeout fallback
        setTimeout(() => resolve({ error: 'timeout' }), 5000);
      });
    }

    // Render current step
    async function renderStep(step) {
      const content = document.getElementById('wizardContent');
      const btnPrev = document.getElementById('btnPrev');
      const btnNext = document.getElementById('btnNext');

      btnPrev.style.visibility = step > 1 ? 'visible' : 'hidden';

      // Update step indicators
      document.querySelectorAll('.step').forEach((el, i) => {
        el.classList.remove('active', 'completed');
        if (i + 1 < step) el.classList.add('completed');
        if (i + 1 === step) el.classList.add('active');
      });

      switch (step) {
        case 1:
          content.innerHTML = renderSpaceStep();
          loadSpaces();
          break;
        case 2:
          content.innerHTML = renderConnectionStep();
          loadConnections();
          break;
        case 3:
          content.innerHTML = renderTablesStep();
          loadTables();
          break;
        case 4:
          content.innerHTML = renderIncrementalStep();
          break;
        case 5:
          content.innerHTML = renderReviewStep();
          break;
        case 6:
          content.innerHTML = renderDeployStep();
          btnNext.textContent = 'Deploy!';
          break;
      }

      updateFooter();
    }

    // Step 1: Space
    function renderSpaceStep() {
      return \`
        <div class="content-header">
          <h2>📁 בחירת Space</h2>
          <p>בחר את ה-Space שבו תרצה ליצור את האפליקציה</p>
        </div>
        <div id="spaceContent">
          <div class="loading">
            <div class="spinner"></div>
            <p>טוען Spaces...</p>
          </div>
        </div>
      \`;
    }

    async function loadSpaces() {
      const result = await callTool('qmb_list_spaces');
      state.spaces = result.spaces || [
        { id: 'space-1', name: 'Production', type: 'managed' },
        { id: 'space-2', name: 'Development', type: 'shared' },
        { id: 'space-3', name: 'My Space', type: 'personal' }
      ];

      document.getElementById('spaceContent').innerHTML = \`
        <div class="card-grid">
          \${state.spaces.map(s => \`
            <div class="card \${state.selectedSpace === s.id ? 'selected' : ''}" onclick="selectSpace('\${s.id}')">
              <div class="card-header">
                <span class="card-title">\${s.name}</span>
                <span class="card-badge badge-\${s.type}">\${s.type}</span>
              </div>
              <p class="card-desc">ID: \${s.id}</p>
            </div>
          \`).join('')}
        </div>
        <button class="btn-create" onclick="createSpace()" style="margin-top: 16px;">
          + צור Space חדש
        </button>
      \`;
    }

    function selectSpace(id) {
      state.selectedSpace = id;
      loadSpaces();
      updateFooter();
    }

    function createSpace() {
      // TODO: Show create dialog
      vscode.postMessage({ type: 'showInfo', text: 'יצירת Space חדש - בקרוב!' });
    }

    // Step 2: Connection
    function renderConnectionStep() {
      return \`
        <div class="content-header">
          <h2>🔗 מקור נתונים</h2>
          <p>בחר חיבור קיים או צור חיבור חדש</p>
        </div>
        <div id="connectionContent">
          <div class="loading">
            <div class="spinner"></div>
            <p>טוען חיבורים...</p>
          </div>
        </div>
      \`;
    }

    async function loadConnections() {
      const result = await callTool('qmb_list_connections');
      state.connections = result.connections || [
        { id: 'conn-1', name: 'SalesDB', type: 'sqlserver' },
        { id: 'conn-2', name: 'Analytics API', type: 'rest_api' }
      ];

      document.getElementById('connectionContent').innerHTML = \`
        <div class="card-grid">
          \${state.connections.map(c => \`
            <div class="card \${state.selectedConnection === c.id ? 'selected' : ''}" onclick="selectConnection('\${c.id}')">
              <div class="card-header">
                <span class="card-title">\${c.name}</span>
                <span class="card-badge badge-\${c.type === 'sqlserver' ? 'sqlserver' : 'rest'}">\${c.type}</span>
              </div>
              <p class="card-desc">ID: \${c.id}</p>
            </div>
          \`).join('')}
        </div>
        <button class="btn-create" onclick="createConnection()" style="margin-top: 16px;">
          + צור חיבור חדש
        </button>
      \`;
    }

    function selectConnection(id) {
      state.selectedConnection = id;
      loadConnections();
      updateFooter();
    }

    function createConnection() {
      vscode.postMessage({ type: 'showInfo', text: 'יצירת חיבור חדש - בקרוב!' });
    }

    // Step 3: Tables
    function renderTablesStep() {
      return \`
        <div class="content-header">
          <h2>📋 בחירת טבלאות</h2>
          <p>בחר את הטבלאות שברצונך לטעון</p>
        </div>
        <div id="tablesContent">
          <div class="loading">
            <div class="spinner"></div>
            <p>טוען טבלאות...</p>
          </div>
        </div>
      \`;
    }

    async function loadTables() {
      state.tables = [
        { name: 'Sales', schema: 'dbo', rows: '1.2M' },
        { name: 'Products', schema: 'dbo', rows: '5K' },
        { name: 'Customers', schema: 'dbo', rows: '50K' },
        { name: 'Orders', schema: 'dbo', rows: '800K' }
      ];

      document.getElementById('tablesContent').innerHTML = \`
        <div class="table-list">
          \${state.tables.map(t => \`
            <div class="table-item \${state.selectedTables.includes(t.name) ? 'selected' : ''}" onclick="toggleTable('\${t.name}')">
              <input type="checkbox" class="table-checkbox" \${state.selectedTables.includes(t.name) ? 'checked' : ''}>
              <div>
                <div style="font-weight: 600;">\${t.schema}.\${t.name}</div>
                <div style="font-size: 12px; color: var(--text-muted);">\${t.rows} rows</div>
              </div>
            </div>
          \`).join('')}
        </div>
      \`;
    }

    function toggleTable(name) {
      const idx = state.selectedTables.indexOf(name);
      if (idx > -1) {
        state.selectedTables.splice(idx, 1);
      } else {
        state.selectedTables.push(name);
      }
      loadTables();
      updateFooter();
    }

    // Step 4: Incremental
    function renderIncrementalStep() {
      return \`
        <div class="content-header">
          <h2>⚡ הגדרת Incremental Load</h2>
          <p>קבע כיצד לטעון כל טבלה</p>
        </div>
        <div class="table-list">
          \${state.selectedTables.map(t => \`
            <div class="card" style="margin-bottom: 12px;">
              <div class="card-header">
                <span class="card-title">\${t}</span>
              </div>
              <select style="width: 100%; padding: 8px; margin-top: 8px;" onchange="setIncremental('\${t}', this.value)">
                <option value="none">Full Reload (טעינה מלאה)</option>
                <option value="by_date">By Date (לפי תאריך)</option>
                <option value="by_id">By ID (לפי מזהה)</option>
                <option value="time_window">Time Window (חלון זמן)</option>
              </select>
            </div>
          \`).join('')}
        </div>
      \`;
    }

    function setIncremental(table, strategy) {
      state.incrementalConfig[table] = strategy;
    }

    // Step 5: Review
    function renderReviewStep() {
      return \`
        <div class="content-header">
          <h2>✅ סקירה</h2>
          <p>בדוק את ההגדרות לפני יצירת האפליקציה</p>
        </div>
        <div class="card" style="margin-bottom: 16px;">
          <h3 style="margin-bottom: 12px;">סיכום</h3>
          <p><strong>Space:</strong> \${state.spaces.find(s => s.id === state.selectedSpace)?.name || '-'}</p>
          <p><strong>חיבור:</strong> \${state.connections.find(c => c.id === state.selectedConnection)?.name || '-'}</p>
          <p><strong>טבלאות:</strong> \${state.selectedTables.length}</p>
        </div>
        <div class="card">
          <h3 style="margin-bottom: 12px;">טבלאות נבחרות</h3>
          \${state.selectedTables.map(t => \`<p>• \${t} (\${state.incrementalConfig[t] || 'none'})</p>\`).join('')}
        </div>
      \`;
    }

    // Step 6: Deploy
    function renderDeployStep() {
      return \`
        <div class="content-header">
          <h2>🚀 Deploy</h2>
          <p>יצירת האפליקציה ב-Qlik Cloud</p>
        </div>
        <div style="text-align: center; padding: 40px;">
          <p style="font-size: 18px; margin-bottom: 24px;">מוכן ליצור את האפליקציה?</p>
          <p style="color: var(--text-muted);">לחץ על Deploy ליצירת האפליקציה ב-Qlik Cloud</p>
        </div>
      \`;
    }

    // Navigation
    function nextStep() {
      if (state.currentStep < state.totalSteps) {
        state.currentStep++;
        renderStep(state.currentStep);
      } else {
        deploy();
      }
    }

    function prevStep() {
      if (state.currentStep > 1) {
        state.currentStep--;
        renderStep(state.currentStep);
      }
    }

    function updateFooter() {
      const info = document.getElementById('footerInfo');
      const btnNext = document.getElementById('btnNext');

      let canProceed = false;
      switch (state.currentStep) {
        case 1: canProceed = !!state.selectedSpace; break;
        case 2: canProceed = !!state.selectedConnection; break;
        case 3: canProceed = state.selectedTables.length > 0; break;
        default: canProceed = true;
      }

      btnNext.disabled = !canProceed;
      info.textContent = \`שלב \${state.currentStep} מתוך \${state.totalSteps}\`;
    }

    async function deploy() {
      vscode.postMessage({ type: 'showInfo', text: 'מתחיל Deploy...' });
      // TODO: Call qmb_deploy
    }
  `;
}
//# sourceMappingURL=wizardPanel.js.map