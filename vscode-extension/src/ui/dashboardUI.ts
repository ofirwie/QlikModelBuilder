/**
 * Dashboard UI - New Qlik Model Builder Interface
 * Single-screen dashboard with sidebar and canvas
 */

export function getDashboardStyles(): string {
  return `
    /* CSS Variables - Qlik Theme */
    :root {
      --qlik-green: #009845;
      --qlik-green-light: #00c853;
      --qlik-green-dark: #007a38;
      --bg-primary: var(--vscode-editor-background);
      --bg-secondary: var(--vscode-sideBar-background);
      --bg-card: var(--vscode-editorWidget-background);
      --bg-hover: var(--vscode-list-hoverBackground);
      --bg-active: var(--vscode-list-activeSelectionBackground);
      --text-primary: var(--vscode-editor-foreground);
      --text-secondary: var(--vscode-descriptionForeground);
      --border-color: var(--vscode-panel-border);
      --error-color: #ff5252;
      --success-color: #4caf50;
      --warning-color: #ff9800;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--text-primary);
      background: var(--bg-primary);
      height: 100vh;
      overflow: hidden;
    }

    /* Dashboard Layout */
    .dashboard {
      display: grid;
      grid-template-rows: 48px 1fr;
      grid-template-columns: 280px 1fr;
      height: 100vh;
    }

    /* Header */
    .header {
      grid-column: 1 / -1;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
    }

    .header-title {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header-title h1 {
      font-size: 16px;
      font-weight: 500;
    }

    .header-title .logo {
      width: 24px;
      height: 24px;
      background: var(--qlik-green);
      border-radius: 4px;
    }

    .connection-status {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--error-color);
    }

    .status-dot.connected {
      background: var(--success-color);
    }

    /* Sidebar */
    .sidebar {
      background: var(--bg-secondary);
      border-left: 1px solid var(--border-color);
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    }

    .sidebar-section {
      padding: 12px;
      border-bottom: 1px solid var(--border-color);
    }

    .sidebar-section h3 {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--text-secondary);
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .sidebar-section h3 .icon {
      font-size: 14px;
    }

    /* Tree View */
    .tree-view {
      list-style: none;
    }

    .tree-item {
      padding: 6px 8px;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
    }

    .tree-item:hover {
      background: var(--bg-hover);
    }

    .tree-item.selected {
      background: var(--bg-active);
    }

    .tree-item .icon {
      opacity: 0.7;
    }

    /* Tables List */
    .tables-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .table-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px;
      border-radius: 4px;
      cursor: pointer;
      border: 1px solid transparent;
    }

    .table-item:hover {
      background: var(--bg-hover);
    }

    .table-item.selected {
      border-color: var(--qlik-green);
      background: rgba(0, 152, 69, 0.1);
    }

    .table-item input[type="checkbox"] {
      accent-color: var(--qlik-green);
    }

    .table-info {
      flex: 1;
      min-width: 0;
    }

    .table-name {
      font-size: 13px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .table-meta {
      font-size: 11px;
      color: var(--text-secondary);
    }

    .table-type {
      display: inline-block;
      padding: 1px 4px;
      border-radius: 2px;
      font-size: 10px;
      font-weight: 600;
    }

    .table-type.fact {
      background: #2196f3;
      color: white;
    }

    .table-type.dimension {
      background: #9c27b0;
      color: white;
    }

    /* Main Canvas */
    .canvas {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .canvas-toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
    }

    .canvas-content {
      flex: 1;
      padding: 16px;
      overflow-y: auto;
    }

    /* Upload Area */
    .upload-area {
      border: 2px dashed var(--border-color);
      border-radius: 8px;
      padding: 40px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;
    }

    .upload-area:hover {
      border-color: var(--qlik-green);
      background: rgba(0, 152, 69, 0.05);
    }

    .upload-area.dragover {
      border-color: var(--qlik-green);
      background: rgba(0, 152, 69, 0.1);
    }

    .upload-area .icon {
      font-size: 48px;
      color: var(--text-secondary);
      margin-bottom: 16px;
    }

    .upload-area h3 {
      margin-bottom: 8px;
    }

    .upload-area p {
      color: var(--text-secondary);
      font-size: 13px;
    }

    /* Summary Cards */
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .summary-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 16px;
    }

    .summary-card h4 {
      font-size: 12px;
      color: var(--text-secondary);
      margin-bottom: 8px;
    }

    .summary-card .value {
      font-size: 24px;
      font-weight: 600;
    }

    /* Script Preview */
    .script-preview {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      overflow: hidden;
    }

    .script-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
    }

    .script-content {
      max-height: 400px;
      overflow: auto;
    }

    .script-content pre {
      margin: 0;
      padding: 16px;
      font-family: var(--vscode-editor-font-family);
      font-size: 12px;
      line-height: 1.5;
      white-space: pre-wrap;
    }

    /* Action Bar */
    .action-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: var(--bg-secondary);
      border-top: 1px solid var(--border-color);
    }

    .selection-info {
      font-size: 13px;
      color: var(--text-secondary);
    }

    .action-buttons {
      display: flex;
      gap: 8px;
    }

    /* Buttons */
    .btn {
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-primary {
      background: var(--qlik-green);
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: var(--qlik-green-dark);
    }

    .btn-secondary {
      background: transparent;
      color: var(--text-primary);
      border: 1px solid var(--border-color);
    }

    .btn-secondary:hover:not(:disabled) {
      background: var(--bg-hover);
    }

    .btn-icon {
      padding: 6px;
      background: transparent;
      border: none;
      cursor: pointer;
      color: var(--text-secondary);
      border-radius: 4px;
    }

    .btn-icon:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }

    /* Config Screen */
    .config-screen {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      padding: 24px;
    }

    .config-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 32px;
      max-width: 400px;
      width: 100%;
    }

    .config-card h2 {
      margin-bottom: 8px;
    }

    .config-card p {
      color: var(--text-secondary);
      margin-bottom: 24px;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-group label {
      display: block;
      font-size: 12px;
      font-weight: 500;
      margin-bottom: 6px;
    }

    .form-group input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      background: var(--bg-primary);
      color: var(--text-primary);
      font-size: 13px;
    }

    .form-group input:focus {
      outline: none;
      border-color: var(--qlik-green);
    }

    .form-error {
      color: var(--error-color);
      font-size: 12px;
      margin-top: 4px;
    }

    /* Loading */
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px;
    }

    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid var(--border-color);
      border-top-color: var(--qlik-green);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Toast / Notifications */
    .toast {
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 1000;
    }

    .toast.success {
      border-color: var(--success-color);
    }

    .toast.error {
      border-color: var(--error-color);
    }

    /* Incremental Config Panel */
    .incremental-panel {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 16px;
      margin-top: 16px;
    }

    .incremental-panel h4 {
      margin-bottom: 12px;
    }

    .incremental-option {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px;
      border-radius: 4px;
      cursor: pointer;
    }

    .incremental-option:hover {
      background: var(--bg-hover);
    }

    .incremental-option input[type="radio"] {
      accent-color: var(--qlik-green);
    }

    .incremental-option .label {
      font-weight: 500;
    }

    .incremental-option .desc {
      font-size: 12px;
      color: var(--text-secondary);
    }

    /* Hidden */
    .hidden {
      display: none !important;
    }

    /* Step Content */
    .step-content {
      padding: 24px;
      max-width: 600px;
      margin: 0 auto;
    }

    .step-content h2 {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--text-primary);
    }

    /* Item List (Entry Options) */
    .item-list {
      list-style: none;
      padding: 0;
      margin: 16px 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .item-list li {
      display: flex;
      align-items: center;
      padding: 16px;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .item-list li:hover {
      background: var(--bg-hover);
      border-color: var(--qlik-green);
    }

    .item-list li.selected {
      background: rgba(0, 152, 69, 0.1);
      border-color: var(--qlik-green);
    }

    .item-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .item-name {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .item-type {
      font-size: 12px;
      color: var(--text-secondary);
    }

    /* Button Row */
    .button-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid var(--border-color);
    }

    /* Progress Bar - 7 Step Wizard */
    .progress-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
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
      left: 50%;
      width: 100%;
      height: 2px;
      background: var(--border-color);
    }

    .step-indicator.completed:not(:last-child)::after {
      background: var(--qlik-green);
    }

    .step-circle {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: var(--bg-primary);
      border: 2px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 600;
      z-index: 1;
      transition: all 0.2s;
    }

    .step-indicator.completed .step-circle {
      background: var(--qlik-green);
      border-color: var(--qlik-green);
      color: white;
    }

    .step-indicator.current .step-circle {
      background: var(--qlik-green);
      border-color: var(--qlik-green);
      color: white;
      transform: scale(1.1);
    }

    .step-label {
      margin-top: 8px;
      font-size: 11px;
      color: var(--text-secondary);
      text-align: center;
    }

    .step-indicator.current .step-label {
      color: var(--qlik-green);
      font-weight: 600;
    }
  `;
}

export function getDashboardScript(): string {
  return `
    const vscode = acquireVsCodeApi();

    // =============================================
    // Application State
    // =============================================
    const state = {
      configured: false,
      tenantUrl: '',
      spaces: [],
      connections: [],
      selectedSpace: null,
      selectedConnection: null,
      tables: [],
      selectedTables: [],
      incrementalConfig: {},
      generatedScript: '',
      projectSpec: null,
      entryPoint: null,
      currentStep: 1,
      // Space selection state (Step 2)
      selectedSpaceId: null,
      newSpaceName: '',
      spacesLoading: true,
      createSpaceLoading: false,
      spacesError: null,
      // Source selection state (Step 3)
      connections: [],
      selectedConnectionId: null,
      connectionType: '',
      newConnectionName: '',
      connectionString: '',
      connectionsLoading: true,
      createConnectionLoading: false,
      connectionsError: null,
      connectionsErrorType: null,  // 'auth', 'network', 'server', 'validation'
      connectionsCorrelationId: null  // For error reporting
    };

    // =============================================
    // Entry Point Selection (Step 1)
    // =============================================
    window.selectEntry = function selectEntry(entry) {
      state.entryPoint = entry;

      // Update UI - mark selected item
      document.querySelectorAll('#entry-options li').forEach(li => {
        li.classList.toggle('selected', li.dataset.entry === entry);
      });

      // Show/hide upload section based on entry type
      const uploadSection = document.getElementById('spec-upload-section');
      if (uploadSection) {
        uploadSection.style.display = entry === 'spec' ? 'block' : 'none';
      }

      // Enable Next button
      const nextBtn = document.getElementById('btn-next');
      if (nextBtn) {
        nextBtn.disabled = false;
      }

      // Save state to VS Code
      if (typeof vscode !== 'undefined') {
        vscode.setState(state);
      }

      // Also expose for test access
      if (typeof window !== 'undefined') {
        window.wizardState = state;
      }
    }

    window.nextStep = function nextStep() {
      state.currentStep++;

      // Update progress bar indicators
      document.querySelectorAll('.step-indicator').forEach((indicator, idx) => {
        const step = idx + 1;
        indicator.classList.remove('current', 'completed');
        if (step < state.currentStep) {
          indicator.classList.add('completed');
        } else if (step === state.currentStep) {
          indicator.classList.add('current');
        }
      });

      // Hide current step content, show next step content
      document.querySelectorAll('.step-content').forEach(content => {
        const stepNum = parseInt(content.dataset.step, 10);
        if (stepNum === state.currentStep) {
          content.style.display = 'block';
        } else {
          content.style.display = 'none';
        }
      });

      // When entering Step 2, fetch spaces
      if (state.currentStep === 2) {
        state.spacesLoading = true;
        renderSpaces();
        vscode.postMessage({ type: 'getSpaces' });
      }

      // When entering Step 3, fetch connections
      if (state.currentStep === 3) {
        state.connectionsLoading = true;
        renderConnections();
        vscode.postMessage({ type: 'getConnections' });
      }

      // Save state
      if (typeof vscode !== 'undefined') {
        vscode.setState(state);
      }

      // Expose for tests
      if (typeof window !== 'undefined') {
        window.wizardState = state;
      }
    }

    window.prevStep = function prevStep() {
      if (state.currentStep <= 1) return;
      state.currentStep--;

      // Update progress bar indicators
      document.querySelectorAll('.step-indicator').forEach((indicator, idx) => {
        const step = idx + 1;
        indicator.classList.remove('current', 'completed');
        if (step < state.currentStep) {
          indicator.classList.add('completed');
        } else if (step === state.currentStep) {
          indicator.classList.add('current');
        }
      });

      // Hide current step content, show previous step content
      document.querySelectorAll('.step-content').forEach(content => {
        const stepNum = parseInt(content.dataset.step, 10);
        if (stepNum === state.currentStep) {
          content.style.display = 'block';
        } else {
          content.style.display = 'none';
        }
      });

      // Save state
      if (typeof vscode !== 'undefined') {
        vscode.setState(state);
      }

      // Expose for tests
      if (typeof window !== 'undefined') {
        window.wizardState = state;
      }
    }

    // =============================================
    // Wizard Event Listeners (CSP-safe, no inline onclick)
    // =============================================
    function setupWizardEventListeners() {
      // Entry point selection
      document.querySelectorAll('#entry-options li[data-entry]').forEach(li => {
        li.addEventListener('click', () => {
          const entry = li.dataset.entry;
          if (entry && window.selectEntry) {
            window.selectEntry(entry);
          }
        });
      });

      // Next buttons (Step 1)
      const btnNext = document.getElementById('btn-next');
      if (btnNext) {
        btnNext.addEventListener('click', () => {
          if (window.nextStep) window.nextStep();
        });
      }

      // Step 2 buttons
      const btnNext2 = document.getElementById('btn-next-2');
      if (btnNext2) {
        btnNext2.addEventListener('click', () => {
          if (window.nextStep) window.nextStep();
        });
      }
      const btnBack = document.getElementById('btn-back');
      if (btnBack) {
        btnBack.addEventListener('click', () => {
          if (window.prevStep) window.prevStep();
        });
      }

      // Generic next/back buttons (Steps 3-7)
      document.querySelectorAll('.btn-next-action').forEach(btn => {
        btn.addEventListener('click', () => {
          if (window.nextStep) window.nextStep();
        });
      });
      document.querySelectorAll('.btn-back-action').forEach(btn => {
        btn.addEventListener('click', () => {
          if (window.prevStep) window.prevStep();
        });
      });

      // Upload spec file button
      const btnUploadSpec = document.getElementById('btn-upload-spec');
      if (btnUploadSpec) {
        btnUploadSpec.addEventListener('click', () => {
          vscode.postMessage({ type: 'uploadSpec' });
        });
      }

      // Step 2: Create space button
      const btnCreateSpace = document.getElementById('btn-create-space');
      if (btnCreateSpace) {
        btnCreateSpace.addEventListener('click', () => {
          const nameInput = document.getElementById('new-space-name');
          const name = nameInput?.value?.trim();

          // Validation
          if (!name) {
            const errorEl = document.getElementById('create-space-error');
            if (errorEl) {
              errorEl.textContent = 'Please enter a space name';
              errorEl.style.display = 'block';
            }
            return;
          }

          // Clear previous error
          const errorEl = document.getElementById('create-space-error');
          if (errorEl) errorEl.style.display = 'none';

          // Send create message
          state.createSpaceLoading = true;
          vscode.postMessage({ type: 'createSpace', name: name });
        });
      }

      // Step 2: Retry spaces button
      const btnSpacesRetry = document.getElementById('btn-spaces-retry');
      if (btnSpacesRetry) {
        btnSpacesRetry.addEventListener('click', () => {
          state.spacesLoading = true;
          state.spacesError = null;
          renderSpaces();
          vscode.postMessage({ type: 'getSpaces' });
        });
      }

      // Step 2: Configure button (go back to config)
      const btnSpacesConfigure = document.getElementById('btn-spaces-configure');
      if (btnSpacesConfigure) {
        btnSpacesConfigure.addEventListener('click', () => {
          vscode.postMessage({ type: 'openSettings' });
        });
      }

      // =============================================
      // Step 3: Source Selection Event Listeners
      // =============================================

      // Step 3: Next button
      var btnNext3 = document.getElementById('btn-next-3');
      if (btnNext3) {
        btnNext3.addEventListener('click', function() {
          if (window.nextStep) window.nextStep();
        });
      }

      // Step 3: Back button
      var btnBack3 = document.getElementById('btn-back-3');
      if (btnBack3) {
        btnBack3.addEventListener('click', function() {
          if (window.prevStep) window.prevStep();
        });
      }

      // Step 3: Retry connections button
      var btnConnectionsRetry = document.getElementById('btn-connections-retry');
      if (btnConnectionsRetry) {
        btnConnectionsRetry.addEventListener('click', function() {
          state.connectionsLoading = true;
          state.connectionsError = null;
          state.connectionsErrorType = null;
          state.connectionsCorrelationId = null;
          renderConnections();
          vscode.postMessage({ type: 'getConnections' });
        });
      }

      // Step 3: Configure Credentials button (for auth errors)
      var btnConnectionsConfigure = document.getElementById('btn-connections-configure');
      if (btnConnectionsConfigure) {
        btnConnectionsConfigure.addEventListener('click', function() {
          vscode.postMessage({ type: 'openSettings' });
        });
      }

      // Step 3: Create Connection button
      var btnCreateConnection = document.getElementById('btn-create-connection');
      if (btnCreateConnection) {
        btnCreateConnection.addEventListener('click', function() {
          var nameInput = document.getElementById('new-connection-name');
          var typeSelect = document.getElementById('connection-type');
          var stringInput = document.getElementById('connection-string');

          var name = nameInput ? nameInput.value.trim() : '';
          var type = typeSelect ? typeSelect.value : '';
          var connString = stringInput ? stringInput.value : '';

          // Validation
          if (!name) {
            showConnectionFormError('Connection name is required');
            return;
          }
          if (name.length > 100) {
            showConnectionFormError('Connection name must be 100 characters or less');
            return;
          }
          if (!type) {
            showConnectionFormError('Connection type is required');
            return;
          }

          // Clear previous error
          var errorEl = document.getElementById('create-connection-error');
          if (errorEl) errorEl.style.display = 'none';

          state.createConnectionLoading = true;
          updateCreateConnectionButton();

          vscode.postMessage({
            type: 'createConnection',
            name: name,
            connectionType: type,
            connectionString: connString
          });
        });
      }

      function showConnectionFormError(message) {
        var errorEl = document.getElementById('create-connection-error');
        if (errorEl) {
          errorEl.textContent = message;
          errorEl.style.display = 'block';
          // Auto-hide after 5 seconds for validation errors
          setTimeout(function() {
            errorEl.style.display = 'none';
          }, 5000);
        }
      }

      // Step 3: Connection type dropdown (show/hide connection string)
      var connectionType = document.getElementById('connection-type');
      if (connectionType) {
        connectionType.addEventListener('change', function(e) {
          state.connectionType = e.target.value;
          var paramsEl = document.getElementById('connection-params');
          if (paramsEl) {
            // Show connection string for all types except folder
            paramsEl.style.display = state.connectionType && state.connectionType !== 'folder' ? 'block' : 'none';
          }
          updateCreateConnectionButton();
        });
      }

      // Step 3: Connection name input
      var newConnName = document.getElementById('new-connection-name');
      if (newConnName) {
        newConnName.addEventListener('input', function(e) {
          state.newConnectionName = e.target.value;
          updateCreateConnectionButton();
        });
      }

      // Step 3: Connection string input
      var connString = document.getElementById('connection-string');
      if (connString) {
        connString.addEventListener('input', function(e) {
          state.connectionString = e.target.value;
        });
      }
    }

    // Call setup after DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupWizardEventListeners);
    } else {
      setupWizardEventListeners();
    }

    // =============================================
    // Initialization
    // =============================================
    function init() {
      vscode.postMessage({ type: 'getInitialData' });
    }

    init();

    // =============================================
    // Message Handler
    // =============================================
    window.addEventListener('message', (event) => {
      const msg = event.data;
      console.log('Message received:', msg.type);

      switch (msg.type) {
        case 'initialData':
          state.configured = msg.configured;
          state.tenantUrl = msg.tenantUrl;
          render();
          break;

        case 'configResult':
          if (msg.success) {
            state.configured = true;
            state.tenantUrl = document.getElementById('tenantUrl')?.value || state.tenantUrl;
            render();
          } else {
            showError(msg.message || 'שגיאה בהתחברות');
          }
          break;

        case 'spaces':
          state.spaces = msg.data || [];
          state.spacesLoading = false;
          state.spacesError = null;
          if (state.spaces.length > 0 && !state.selectedSpaceId) {
            state.selectedSpaceId = state.spaces[0].id;
          }
          renderSpaces();
          break;

        case 'spacesError':
          state.spacesLoading = false;
          state.spacesError = msg.message || 'Failed to load spaces';
          renderSpaces();
          break;

        case 'spaceCreated':
          state.createSpaceLoading = false;
          if (msg.space) {
            state.spaces.push(msg.space);
            state.selectedSpaceId = msg.space.id;
          }
          const newSpaceInput = document.getElementById('new-space-name');
          if (newSpaceInput) newSpaceInput.value = '';
          renderSpaces();
          break;

        case 'createSpaceError':
          state.createSpaceLoading = false;
          const createError = document.getElementById('create-space-error');
          if (createError) {
            createError.textContent = msg.message || 'Failed to create space';
            createError.style.display = 'block';
          }
          break;

        // Step 3: Connection handlers
        case 'connections':
          state.connections = msg.data || [];
          state.connectionsLoading = false;
          state.connectionsError = null;
          state.connectionsErrorType = null;
          state.connectionsCorrelationId = null;
          // Also update old state for backward compatibility
          if (state.connections.length > 0 && !state.selectedConnection) {
            state.selectedConnection = state.connections[0].id;
          }
          renderConnections();
          renderSidebar();
          break;

        case 'connectionsError':
          state.connectionsLoading = false;
          state.connectionsError = msg.message || 'Failed to load connections';
          state.connectionsErrorType = msg.errorType || 'unknown';
          state.connectionsCorrelationId = msg.correlationId || null;
          // Log error for debugging
          console.error('[Step 3] Connection error:', state.connectionsError, 'Type:', state.connectionsErrorType);
          renderConnections();
          break;

        case 'connectionCreated':
          state.createConnectionLoading = false;
          if (msg.connection) {
            state.connections.push(msg.connection);
            state.selectedConnectionId = msg.connection.id;
          }
          // Clear form inputs
          state.newConnectionName = '';
          state.connectionType = '';
          state.connectionString = '';
          var connNameInput = document.getElementById('new-connection-name');
          var connTypeSelect = document.getElementById('connection-type');
          var connStringInput = document.getElementById('connection-string');
          if (connNameInput) connNameInput.value = '';
          if (connTypeSelect) connTypeSelect.value = '';
          if (connStringInput) connStringInput.value = '';
          renderConnections();
          updateCreateConnectionButton();
          break;

        case 'createConnectionError':
          state.createConnectionLoading = false;
          var connErrorEl = document.getElementById('create-connection-error');
          if (connErrorEl) {
            connErrorEl.textContent = msg.message || 'Failed to create connection';
            connErrorEl.style.display = 'block';
            // Auto-hide validation errors after 5 seconds
            if (msg.errorType === 'validation') {
              setTimeout(function() {
                connErrorEl.style.display = 'none';
              }, 5000);
            }
          }
          updateCreateConnectionButton();
          break;

        case 'specParsed':
          handleSpecParsed(msg);
          break;

        case 'specParseError':
          showError('שגיאה בפענוח: ' + msg.message);
          break;

        case 'scriptGenerated':
          state.generatedScript = msg.script;
          renderScriptPreview();
          break;

        case 'error':
          showError(msg.message);
          break;
      }
    });

    // =============================================
    // Render Functions
    // =============================================
    function render() {
      const app = document.getElementById('app');

      if (!state.configured) {
        app.innerHTML = renderConfigScreen();
        setupConfigListeners();
      } else {
        app.innerHTML = renderDashboard();
        setupDashboardListeners();
        vscode.postMessage({ type: 'getSpaces' });
        vscode.postMessage({ type: 'getConnections' });
      }
    }

    function renderConfigScreen() {
      return \`
        <div class="config-screen">
          <div class="config-card">
            <h2>🔗 התחבר ל-Qlik Cloud</h2>
            <p>הזן את פרטי החיבור ל-Qlik Cloud Tenant שלך</p>

            <div class="form-group">
              <label>Tenant URL</label>
              <input type="text" id="tenantUrl" placeholder="https://your-tenant.qlikcloud.com" value="\${state.tenantUrl}">
            </div>

            <div class="form-group">
              <label>API Key</label>
              <input type="password" id="apiKey" placeholder="הזן API Key">
            </div>

            <div id="configError" class="form-error hidden"></div>

            <button class="btn btn-primary" id="btnConnect" style="width: 100%; margin-top: 16px;">
              התחבר
            </button>

            <button class="btn btn-secondary" id="btnSkip" style="width: 100%; margin-top: 8px;">
              דלג (עבודה מקומית)
            </button>
          </div>
        </div>
      \`;
    }

    function renderDashboard() {
      return \`
        <div class="dashboard">
          <!-- Header -->
          <header class="header">
            <div class="header-title">
              <div class="logo"></div>
              <h1>Qlik Model Builder</h1>
            </div>
            <div class="connection-status">
              <span class="status-dot \${state.configured ? 'connected' : ''}"></span>
              <span>\${state.tenantUrl || 'לא מחובר'}</span>
            </div>
          </header>

          <!-- Sidebar -->
          <aside class="sidebar" id="sidebar">
            <!-- Will be rendered by renderSidebar() -->
          </aside>

          <!-- Canvas -->
          <main class="canvas">
            <div class="canvas-toolbar">
              <button class="btn btn-secondary" id="btnUpload">
                📄 העלה איפיון
              </button>
              <button class="btn btn-secondary" id="btnRefresh">
                🔄 רענן
              </button>
            </div>

            <div class="canvas-content" id="canvasContent">
              <!-- Will be rendered by renderCanvas() -->
            </div>

            <div class="action-bar">
              <div class="selection-info" id="selectionInfo">
                בחר טבלאות מהאיפיון
              </div>
              <div class="action-buttons">
                <button class="btn btn-secondary" id="btnPreview">
                  👁 תצוגה מקדימה
                </button>
                <button class="btn btn-primary" id="btnGenerate">
                  ⚡ צור סקריפט
                </button>
              </div>
            </div>
          </main>
        </div>
      \`;
    }

    function renderSidebar() {
      const sidebar = document.getElementById('sidebar');
      if (!sidebar) return;

      sidebar.innerHTML = \`
        <!-- Spaces -->
        <div class="sidebar-section">
          <h3><span class="icon">📁</span> Spaces</h3>
          <ul class="tree-view" id="spacesList">
            \${state.spaces.length === 0 ? '<li class="tree-item">טוען...</li>' :
              state.spaces.map(s => \`
                <li class="tree-item \${state.selectedSpace === s.id ? 'selected' : ''}"
                    data-space-id="\${s.id}">
                  <span class="icon">📂</span>
                  \${s.name}
                </li>
              \`).join('')}
          </ul>
        </div>

        <!-- Connections -->
        <div class="sidebar-section">
          <h3><span class="icon">🔗</span> חיבורים</h3>
          <ul class="tree-view" id="connectionsList">
            \${state.connections.length === 0 ? '<li class="tree-item">אין חיבורים</li>' :
              state.connections.map(c => \`
                <li class="tree-item \${state.selectedConnection === c.id ? 'selected' : ''}"
                    data-connection-id="\${c.id}">
                  <span class="icon">💾</span>
                  \${c.qName}
                </li>
              \`).join('')}
          </ul>
        </div>

        <!-- Tables -->
        <div class="sidebar-section" style="flex: 1; overflow-y: auto;">
          <h3><span class="icon">📋</span> טבלאות (\${state.tables.length})</h3>
          <div class="tables-list" id="tablesList">
            \${state.tables.length === 0 ?
              '<p style="color: var(--text-secondary); font-size: 12px;">העלה קובץ איפיון כדי לראות טבלאות</p>' :
              state.tables.map((t, i) => \`
                <div class="table-item \${state.selectedTables.includes(t.name) ? 'selected' : ''}"
                     data-table-index="\${i}">
                  <input type="checkbox"
                         \${state.selectedTables.includes(t.name) ? 'checked' : ''}
                         data-table-name="\${t.name}">
                  <div class="table-info">
                    <div class="table-name">\${t.name}</div>
                    <div class="table-meta">
                      <span class="table-type \${(t.tableType || 'unknown').toLowerCase()}">\${t.tableType || '?'}</span>
                      \${t.fields?.length || 0} שדות
                    </div>
                  </div>
                </div>
              \`).join('')}
          </div>
        </div>
      \`;

      setupSidebarListeners();
    }

    function renderCanvas() {
      const content = document.getElementById('canvasContent');
      if (!content) return;

      if (state.tables.length === 0) {
        content.innerHTML = \`
          <div class="upload-area" id="uploadArea">
            <div class="icon">📄</div>
            <h3>העלה קובץ איפיון</h3>
            <p>גרור קובץ או לחץ לבחירה</p>
            <p style="margin-top: 8px;">תומך: Excel, CSV, Word, JSON</p>
          </div>
        \`;
        setupUploadListeners();
      } else {
        content.innerHTML = \`
          <!-- Summary -->
          <div class="summary-cards">
            <div class="summary-card">
              <h4>טבלאות</h4>
              <div class="value">\${state.tables.length}</div>
            </div>
            <div class="summary-card">
              <h4>נבחרו</h4>
              <div class="value">\${state.selectedTables.length}</div>
            </div>
            <div class="summary-card">
              <h4>Fact</h4>
              <div class="value">\${state.tables.filter(t => t.tableType === 'Fact' || t.tableType === 'fact').length}</div>
            </div>
            <div class="summary-card">
              <h4>Dimension</h4>
              <div class="value">\${state.tables.filter(t => t.tableType === 'Dimension' || t.tableType === 'dimension').length}</div>
            </div>
          </div>

          <!-- Script Preview -->
          <div class="script-preview" id="scriptPreview">
            <div class="script-header">
              <span>📝 סקריפט</span>
              <button class="btn-icon" id="btnCopyScript" title="העתק">📋</button>
            </div>
            <div class="script-content">
              <pre id="scriptCode">\${state.generatedScript || '// לחץ "צור סקריפט" ליצירת קוד'}</pre>
            </div>
          </div>
        \`;

        updateSelectionInfo();
      }
    }

    function renderScriptPreview() {
      const scriptCode = document.getElementById('scriptCode');
      if (scriptCode) {
        scriptCode.textContent = state.generatedScript;
      }
    }

    function updateSelectionInfo() {
      const info = document.getElementById('selectionInfo');
      if (info) {
        const count = state.selectedTables.length;
        info.textContent = count === 0 ?
          'בחר טבלאות מהרשימה' :
          \`נבחרו \${count} טבלאות\`;
      }
    }

    function renderSpaces() {
      const loadingEl = document.getElementById('spaces-loading');
      const errorEl = document.getElementById('spaces-error');
      const emptyEl = document.getElementById('spaces-empty');
      const listEl = document.getElementById('spaces-list');
      const radioListEl = document.getElementById('spaces-radio-list');
      const btnNext2 = document.getElementById('btn-next-2');

      // Hide all states first
      if (loadingEl) loadingEl.style.display = 'none';
      if (errorEl) errorEl.style.display = 'none';
      if (emptyEl) emptyEl.style.display = 'none';
      if (listEl) listEl.style.display = 'none';

      // Show appropriate state
      if (state.spacesLoading) {
        if (loadingEl) loadingEl.style.display = 'block';
        return;
      }

      if (state.spacesError) {
        if (errorEl) errorEl.style.display = 'block';
        const errorMsg = document.getElementById('spaces-error-message');
        if (errorMsg) errorMsg.textContent = state.spacesError;
        return;
      }

      if (state.spaces.length === 0) {
        if (emptyEl) emptyEl.style.display = 'block';
        return;
      }

      // Show spaces list
      if (listEl) listEl.style.display = 'block';

      // Render radio buttons
      if (radioListEl) {
        radioListEl.innerHTML = state.spaces.map(space => \`
          <li style="padding: 8px; border-radius: 4px; cursor: pointer;" data-space-id="\${space.id}">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="radio" name="space" value="\${space.id}"
                     \${state.selectedSpaceId === space.id ? 'checked' : ''} />
              <span style="flex: 1;">
                <span class="item-name">\${space.name}</span>
                <span class="item-type" style="display: block; font-size: 11px; color: var(--text-secondary);">\${space.type}</span>
              </span>
            </label>
          </li>
        \`).join('');

        // Add click handlers for radio buttons
        radioListEl.querySelectorAll('input[type="radio"]').forEach(radio => {
          radio.addEventListener('change', (e) => {
            const target = e.target;
            state.selectedSpaceId = target.value;
            updateStep2NextButton();
          });
        });
      }

      // Update Next button state
      updateStep2NextButton();
    }

    function updateStep2NextButton() {
      const btnNext2 = document.getElementById('btn-next-2');
      if (btnNext2) {
        btnNext2.disabled = !state.selectedSpaceId;
      }
    }

    // =============================================
    // Step 3: Source Selection
    // =============================================

    // Helper to escape HTML (prevent XSS)
    function escapeHtml(text) {
      var div = document.createElement('div');
      div.textContent = text || '';
      return div.innerHTML;
    }

    function renderConnections() {
      var loadingEl = document.getElementById('connections-loading');
      var errorEl = document.getElementById('connections-error');
      var emptyEl = document.getElementById('connections-empty');
      var listEl = document.getElementById('connections-list');
      var radioList = document.getElementById('connections-radio-list');
      var configureBtn = document.getElementById('btn-connections-configure');
      var reportLink = document.getElementById('btn-connections-report');
      var errorIdEl = document.getElementById('connections-error-id');

      // Hide all states
      if (loadingEl) loadingEl.style.display = 'none';
      if (errorEl) errorEl.style.display = 'none';
      if (emptyEl) emptyEl.style.display = 'none';
      if (listEl) listEl.style.display = 'none';

      if (state.connectionsLoading) {
        if (loadingEl) loadingEl.style.display = 'flex';
        return;
      }

      if (state.connectionsError) {
        if (errorEl) {
          errorEl.style.display = 'block';
          var errorMsg = errorEl.querySelector('.error-message');
          if (errorMsg) errorMsg.textContent = state.connectionsError;

          // Show configure button for auth errors
          if (configureBtn) {
            configureBtn.style.display = state.connectionsErrorType === 'auth' ? 'inline-block' : 'none';
          }

          // Show error ID for support (persistent errors only)
          if (errorIdEl && state.connectionsCorrelationId) {
            errorIdEl.style.display = 'block';
            var idSpan = errorIdEl.querySelector('span');
            if (idSpan) idSpan.textContent = state.connectionsCorrelationId;
          }

          // Show report link for server errors
          if (reportLink) {
            if (state.connectionsErrorType === 'server' || state.connectionsErrorType === 'unknown') {
              reportLink.style.display = 'inline-block';
              var errorCode = state.connectionsCorrelationId || 'unknown';
              reportLink.href = 'https://github.com/your-repo/issues/new?title=Error:' + encodeURIComponent(errorCode);
            } else {
              reportLink.style.display = 'none';
            }
          }
        }
        return;
      }

      if (state.connections.length === 0) {
        if (emptyEl) emptyEl.style.display = 'block';
        return;
      }

      // Show connections list
      if (listEl) listEl.style.display = 'block';
      if (radioList) {
        radioList.innerHTML = state.connections.map(function(conn) {
          return '<li style="padding: 8px; border-radius: 4px; cursor: pointer;" data-connection-id="' + escapeHtml(conn.id) + '">' +
            '<label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">' +
            '<input type="radio" name="connection" value="' + escapeHtml(conn.id) + '"' +
            (state.selectedConnectionId === conn.id ? ' checked' : '') + ' />' +
            '<span style="flex: 1;">' +
            '<span class="item-name">' + escapeHtml(conn.qName) + '</span>' +
            '<span class="item-type" style="display: block; font-size: 11px; color: var(--text-secondary);">' + escapeHtml(conn.qType) + '</span>' +
            '</span>' +
            '</label>' +
            '</li>';
        }).join('');

        // Add click handlers for radio buttons
        radioList.querySelectorAll('input[type="radio"]').forEach(function(radio) {
          radio.addEventListener('change', function(e) {
            state.selectedConnectionId = e.target.value;
            updateStep3NextButton();
          });
        });
      }

      updateStep3NextButton();
    }

    function updateStep3NextButton() {
      var btnNext = document.getElementById('btn-next-3');
      if (btnNext) {
        btnNext.disabled = !state.selectedConnectionId;
      }
    }

    function updateCreateConnectionButton() {
      var btnCreate = document.getElementById('btn-create-connection');
      var nameInput = document.getElementById('new-connection-name');
      var typeSelect = document.getElementById('connection-type');
      if (btnCreate && nameInput && typeSelect) {
        var hasName = nameInput.value.trim().length > 0;
        var hasType = typeSelect.value !== '';
        btnCreate.disabled = !hasName || !hasType || state.createConnectionLoading;
      }
    }

    // =============================================
    // Event Handlers
    // =============================================
    function handleSpecParsed(msg) {
      state.tables = msg.tables || [];
      state.projectSpec = msg.projectSpec;

      // Auto-select all tables
      state.selectedTables = state.tables.map(t => t.name);

      renderSidebar();
      renderCanvas();
      showToast('נטענו ' + state.tables.length + ' טבלאות', 'success');
    }

    // =============================================
    // Setup Listeners
    // =============================================
    function setupConfigListeners() {
      const btnConnect = document.getElementById('btnConnect');
      const btnSkip = document.getElementById('btnSkip');

      btnConnect?.addEventListener('click', () => {
        const tenantUrl = document.getElementById('tenantUrl').value.trim();
        const apiKey = document.getElementById('apiKey').value.trim();

        if (!tenantUrl || !apiKey) {
          showError('נא למלא את כל השדות');
          return;
        }

        vscode.postMessage({ type: 'saveConfig', tenantUrl, apiKey });
      });

      btnSkip?.addEventListener('click', () => {
        state.configured = true;
        render();
      });
    }

    function setupDashboardListeners() {
      // Upload button
      document.getElementById('btnUpload')?.addEventListener('click', () => {
        vscode.postMessage({ type: 'uploadSpec' });
      });

      // Refresh
      document.getElementById('btnRefresh')?.addEventListener('click', () => {
        vscode.postMessage({ type: 'getSpaces' });
        vscode.postMessage({ type: 'getConnections' });
      });

      // Generate script
      document.getElementById('btnGenerate')?.addEventListener('click', () => {
        if (state.selectedTables.length === 0) {
          showError('בחר לפחות טבלה אחת');
          return;
        }
        vscode.postMessage({
          type: 'generateScript',
          tables: state.tables.filter(t => state.selectedTables.includes(t.name))
        });
      });

      // Preview (same as generate for now)
      document.getElementById('btnPreview')?.addEventListener('click', () => {
        document.getElementById('btnGenerate')?.click();
      });

      // Copy script
      document.getElementById('btnCopyScript')?.addEventListener('click', () => {
        if (state.generatedScript) {
          navigator.clipboard.writeText(state.generatedScript);
          showToast('הסקריפט הועתק!', 'success');
        }
      });

      // Initial canvas render
      renderCanvas();
    }

    function setupSidebarListeners() {
      // Space selection
      document.querySelectorAll('[data-space-id]').forEach(el => {
        el.addEventListener('click', () => {
          state.selectedSpace = el.dataset.spaceId;
          renderSidebar();
        });
      });

      // Connection selection
      document.querySelectorAll('[data-connection-id]').forEach(el => {
        el.addEventListener('click', () => {
          state.selectedConnection = el.dataset.connectionId;
          renderSidebar();
        });
      });

      // Table checkbox
      document.querySelectorAll('[data-table-name]').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
          const name = e.target.dataset.tableName;
          if (e.target.checked) {
            if (!state.selectedTables.includes(name)) {
              state.selectedTables.push(name);
            }
          } else {
            state.selectedTables = state.selectedTables.filter(t => t !== name);
          }
          renderSidebar();
          updateSelectionInfo();
        });
      });

      // Table item click (toggle checkbox)
      document.querySelectorAll('[data-table-index]').forEach(el => {
        el.addEventListener('click', (e) => {
          if (e.target.type !== 'checkbox') {
            const checkbox = el.querySelector('input[type="checkbox"]');
            if (checkbox) {
              checkbox.checked = !checkbox.checked;
              checkbox.dispatchEvent(new Event('change'));
            }
          }
        });
      });
    }

    function setupUploadListeners() {
      const uploadArea = document.getElementById('uploadArea');
      if (!uploadArea) return;

      uploadArea.addEventListener('click', () => {
        vscode.postMessage({ type: 'uploadSpec' });
      });

      uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
      });

      uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
      });

      uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        // File drop handled by VS Code
      });
    }

    // =============================================
    // UI Helpers
    // =============================================
    function showError(message) {
      const errorEl = document.getElementById('configError');
      if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
      } else {
        showToast(message, 'error');
      }
    }

    function showToast(message, type = 'info') {
      // Remove existing toast
      document.querySelector('.toast')?.remove();

      const toast = document.createElement('div');
      toast.className = 'toast ' + type;
      toast.innerHTML = \`
        <span>\${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
        <span>\${message}</span>
      \`;
      document.body.appendChild(toast);

      setTimeout(() => toast.remove(), 3000);
    }
  `;
}
