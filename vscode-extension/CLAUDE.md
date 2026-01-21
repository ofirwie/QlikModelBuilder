# Qlik Model Builder - VS Code Extension

## Critical Architecture Info

**TWO DIFFERENT WEBVIEWS - Don't confuse them:**

| Component | File | CSS Classes |
|-----------|------|-------------|
| Sidebar | `extension.ts:174` | `.step-indicator`, `.step-circle`, `.step-label` |
| Panel (Wizard) | `wizardPanel.ts:1500` + `ui/dashboardUI.ts` | `.dashboard`, `.sidebar`, `.config-screen` |

## Before Writing Tests

1. Read `ARCHITECTURE.md` first
2. Identify WHICH webview you're testing
3. Use CORRECT CSS selectors for that webview

## Commands

- `qmb.openWizard` → Opens WizardPanel (dashboard UI)
- `qmb.configure` → Shows input dialogs for credentials

## Testing

```bash
# Docker GUI tests (all 16)
docker-compose run --rm playwright npm test

# Specific test
docker-compose run --rm playwright npx playwright test -g "Level 4"
```

## Key Files

- `src/extension.ts` - Extension activation, sidebar webview
- `src/wizardPanel.ts` - Main panel webview
- `src/ui/dashboardUI.ts` - Dashboard HTML/CSS/JS
- `src/qlikApi.ts` - Qlik Cloud API service
- `test/docker/e2e-gui.spec.ts` - GUI tests

## Environment

Qlik Cloud credentials in `.env`:
```
QLIK_TENANT_URL=https://xxx.qlikcloud.com
QLIK_API_KEY=xxx
```

## E2E Testing Rules

### NO FALLBACKS IN TESTS
- A test either PASSES or FAILS - no middle ground
- If NEON connection fails → test FAILS (not fallback to INLINE)
- If any step fails → stop and fix, don't continue

### NEON Database
- NEON is serverless and sleeps after inactivity
- Before running tests: wake up NEON with SELECT 1
- Wait for response before continuing

### Reporting
- Report each step: STEP-1: ✅ | STEP-2: ❌
- If step failed → report ❌ (even if fallback exists)
- Never say "all passed" when fallbacks were used
