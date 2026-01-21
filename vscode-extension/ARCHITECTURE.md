# QMB Extension Architecture

## Webview Components

### 1. Sidebar Webview (WizardViewProvider)
**Location:** `src/extension.ts` lines 100-180
**HTML:** `getHtmlForWebview()` line 174
**CSS Classes:**
- `.step-indicator` - wizard step indicators
- `.step-circle` - step number circles
- `.step-label` - step text labels
- `.progress-bar` - progress indicator

**Registered as:** `qmb.wizardView` in package.json

### 2. Panel Webview (WizardPanel)
**Location:** `src/wizardPanel.ts` lines 233-1537
**HTML:** `_getHtmlForWebview()` line 1500
**UI Source:** `src/ui/dashboardUI.ts`

**CSS Classes:**
- `.dashboard` - main layout container
- `.header` - top header bar
- `.sidebar` - left sidebar panel
- `.sidebar-section` - collapsible sections
- `.config-screen` / `.config-card` - configuration form (when not connected)
- `.connection-status` - connection indicator
- `.status-dot` - green/red status indicator
- `.tree-view` / `.tree-item` - hierarchical lists
- `.tables-list` / `.table-item` - table selection

**Opened via:** `qmb.openWizard` command

## Commands

| Command | Title | Handler |
|---------|-------|---------|
| `qmb.openWizard` | Open Model Builder Wizard | Opens WizardPanel |
| `qmb.newProject` | New Data Model Project | Opens WizardPanel in scratch mode |
| `qmb.configure` | Configure Qlik Cloud Connection | Shows input dialogs |

## Data Flow

```
User clicks sidebar icon
    → WizardViewProvider.resolveWebviewView()
    → getHtmlForWebview() [extension.ts:174]
    → Renders step-indicator UI

User runs "Open Model Builder Wizard"
    → qmb.openWizard command
    → WizardPanel.createOrShow()
    → _getHtmlForWebview() [wizardPanel.ts:1500]
    → getDashboardStyles() + getDashboardScript() [dashboardUI.ts]
    → Renders dashboard UI with config screen
```

## Testing

### Docker GUI Tests
**Config:** `test/docker/playwright.config.ts`
**Tests:** `test/docker/e2e-gui.spec.ts`

**Important:** Tests must use correct selectors for each webview:
- Sidebar tests → `.step-indicator`, `.step-label`
- Panel tests → `.dashboard`, `.sidebar`, `.config-screen`

### Test Levels
- Level 0: VS Code loads, no crashes
- Level 1: Commands registered, palette works
- Level 2: Activity bar icon exists
- Level 3: Webviews load content
- Level 4: Dashboard UI structure
- Level 5: State verification
