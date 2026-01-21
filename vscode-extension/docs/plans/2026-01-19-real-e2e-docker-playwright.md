# Real E2E Testing with Docker + Playwright

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> **CRITICAL:** Use superpowers:real-app-testing - test the ACTUAL app, not isolated components.

**Goal:** Test the wizard "From Spec File" flow E2E using Docker + code-server + Playwright - automating real VS Code GUI interaction.

**Architecture:**
- Docker container running code-server (VS Code in browser)
- Extension installed in container
- Playwright automates the browser GUI
- Real Qlik Cloud API calls verified

**Tech Stack:** Docker, code-server, Playwright, Qlik Cloud REST API

---

## Phase 0: Setup Docker Environment

### Task 0.1: Verify Docker is running

**Step 1:** Check Docker
```powershell
docker info --format "{{.ServerVersion}}"
```
Expected: Version number (e.g., "24.0.7")

If FAIL → Start Docker Desktop first.

---

### Task 0.2: Build Docker image with extension

**Files:**
- Use existing: `Dockerfile`
- Use existing: `docker-compose.yml`

**Step 1:** Build the image
```powershell
cd "C:\Users\fires\OneDrive\Git\QlikModelBuilder\vscode-extension"
docker-compose build vscode-test
```

Expected: Build succeeds without errors.

**Step 2:** Verify image exists
```powershell
docker images | Select-String "qlik"
```

---

### Task 0.3: Start code-server container

**Step 1:** Start container
```powershell
docker-compose up -d vscode-test
```

**Step 2:** Wait for healthy
```powershell
docker-compose ps
```
Expected: Status "Up" or "healthy"

**Step 3:** Verify code-server accessible
```powershell
curl.exe -s http://localhost:8080 | Select-Object -First 5
```
Expected: HTML response (code-server login page or IDE)

---

## Phase 1: Create Playwright E2E Test for Real Extension

### Task 1.1: Create E2E test that opens real VS Code

**Files:**
- Create: `test/e2e/real-vscode-e2e.spec.ts`

**Step 1:** Write the test
```typescript
/**
 * Real E2E Test - VS Code Extension in Docker
 *
 * This test runs against the ACTUAL VS Code (code-server) in Docker,
 * not isolated HTML. It tests the real extension behavior.
 */
import { test, expect } from '@playwright/test';

const CODE_SERVER_URL = 'http://localhost:8080';

test.describe('Real VS Code E2E', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to code-server
    await page.goto(CODE_SERVER_URL);

    // Wait for VS Code to load (code-server shows VS Code UI)
    await page.waitForSelector('.monaco-workbench', { timeout: 30000 });
  });

  test('Level 0: VS Code loads successfully', async ({ page }) => {
    // VS Code workbench should be visible
    const workbench = page.locator('.monaco-workbench');
    await expect(workbench).toBeVisible();

    // Activity bar should exist
    const activityBar = page.locator('.activitybar');
    await expect(activityBar).toBeVisible();
  });

  test('Level 0: Command palette opens', async ({ page }) => {
    // Open command palette with Ctrl+Shift+P (or F1)
    await page.keyboard.press('F1');
    await page.waitForTimeout(500);

    // Command palette input should appear
    const commandInput = page.locator('.quick-input-widget input');
    await expect(commandInput).toBeVisible();
  });

  test('Level 0: Qlik commands are available', async ({ page }) => {
    // Open command palette
    await page.keyboard.press('F1');
    await page.waitForTimeout(500);

    // Type "Qlik" to filter commands
    await page.keyboard.type('Qlik');
    await page.waitForTimeout(300);

    // Should see Qlik Model Builder command
    const qlikCommand = page.locator('.quick-input-list-entry:has-text("Qlik")');
    await expect(qlikCommand.first()).toBeVisible();
  });

  test('Level 1: Open Model Builder Dashboard', async ({ page }) => {
    // Open command palette
    await page.keyboard.press('F1');
    await page.waitForTimeout(500);

    // Type command name
    await page.keyboard.type('Qlik Model Builder');
    await page.waitForTimeout(300);

    // Click the command
    const command = page.locator('.quick-input-list-entry:has-text("Open Dashboard")').first();
    await command.click();
    await page.waitForTimeout(1000);

    // Webview panel should open
    const webviewFrame = page.frameLocator('iframe.webview');

    // Check for dashboard content inside webview
    const dashboard = webviewFrame.locator('.config-screen, .dashboard-container, h1');
    await expect(dashboard.first()).toBeVisible({ timeout: 10000 });
  });

  test('Level 1: New Model wizard opens', async ({ page }) => {
    // Open dashboard first
    await page.keyboard.press('F1');
    await page.keyboard.type('Qlik Model Builder: Open Dashboard');
    await page.waitForTimeout(300);
    await page.locator('.quick-input-list-entry').first().click();
    await page.waitForTimeout(2000);

    // Find webview iframe
    const webviewFrame = page.frameLocator('iframe.webview');

    // Click "New Model" button
    const newModelBtn = webviewFrame.locator('button:has-text("New Model"), .new-model-btn');
    await newModelBtn.first().click();
    await page.waitForTimeout(500);

    // Wizard should show entry options
    const entryOptions = webviewFrame.locator('[data-entry]');
    const count = await entryOptions.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('Level 1: From Spec File shows upload button', async ({ page }) => {
    // Navigate to wizard
    await page.keyboard.press('F1');
    await page.keyboard.type('Qlik Model Builder: Open Dashboard');
    await page.waitForTimeout(300);
    await page.locator('.quick-input-list-entry').first().click();
    await page.waitForTimeout(2000);

    const webviewFrame = page.frameLocator('iframe.webview');

    // Click New Model
    await webviewFrame.locator('button:has-text("New Model"), .new-model-btn').first().click();
    await page.waitForTimeout(500);

    // Click "From Spec File" option
    await webviewFrame.locator('[data-entry="spec"]').click();
    await page.waitForTimeout(300);

    // Upload section should appear
    const uploadSection = webviewFrame.locator('#spec-upload-section');
    await expect(uploadSection).toBeVisible();

    // Upload button should exist
    const uploadBtn = webviewFrame.locator('#btn-upload-spec');
    await expect(uploadBtn).toBeVisible();
  });
});
```

---

### Task 1.2: Create Playwright config for Docker tests

**Files:**
- Create: `test/e2e/playwright.config.ts`

**Step 1:** Write config
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 60000,
  expect: {
    timeout: 10000
  },
  fullyParallel: false, // Run sequentially for VS Code tests
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

---

### Task 1.3: Run Level 0 tests

**Step 1:** Run Playwright tests
```powershell
cd "C:\Users\fires\OneDrive\Git\QlikModelBuilder\vscode-extension"
npx playwright test test/e2e/real-vscode-e2e.spec.ts --config=test/e2e/playwright.config.ts --reporter=line
```

**Expected:** All Level 0 tests pass:
- VS Code loads successfully
- Command palette opens
- Qlik commands are available

If Level 0 FAILS → STOP. Fix before continuing.

---

### Task 1.4: Run Level 1 tests

**Step 1:** Run tests
```powershell
npx playwright test test/e2e/real-vscode-e2e.spec.ts --config=test/e2e/playwright.config.ts --grep="Level 1" --reporter=line
```

**Expected:** All Level 1 tests pass:
- Dashboard opens
- New Model wizard works
- From Spec File shows upload button

---

## Phase 2: Full E2E Flow with Qlik Cloud

### Task 2.1: Create full flow test

**Files:**
- Create: `test/e2e/full-wizard-flow.spec.ts`

**Step 1:** Write full flow test
```typescript
/**
 * Full E2E Flow - From Spec File to Qlik Cloud Deploy
 */
import { test, expect } from '@playwright/test';
import { cleanupTestArtifacts, TEST_PREFIX } from './cleanup-qlik';

const CODE_SERVER_URL = 'http://localhost:8080';
const TEST_SPACE = `${TEST_PREFIX}E2E_Space`;
const TEST_APP = `${TEST_PREFIX}E2E_App`;

test.describe('Full Wizard Flow E2E', () => {

  test.beforeAll(async () => {
    await cleanupTestArtifacts();
  });

  test.afterAll(async () => {
    await cleanupTestArtifacts();
  });

  test('Complete flow: Spec File → Configure → Deploy', async ({ page }) => {
    // 1. Open VS Code
    await page.goto(CODE_SERVER_URL);
    await page.waitForSelector('.monaco-workbench', { timeout: 30000 });

    // 2. Open Dashboard
    await page.keyboard.press('F1');
    await page.keyboard.type('Qlik Model Builder: Open Dashboard');
    await page.waitForTimeout(300);
    await page.locator('.quick-input-list-entry').first().click();
    await page.waitForTimeout(2000);

    const webviewFrame = page.frameLocator('iframe.webview');

    // 3. Click New Model
    await webviewFrame.locator('button:has-text("New Model")').first().click();
    await page.waitForTimeout(500);

    // 4. Select "From Spec File"
    await webviewFrame.locator('[data-entry="spec"]').click();
    await page.waitForTimeout(300);

    // 5. Verify upload section appears
    await expect(webviewFrame.locator('#spec-upload-section')).toBeVisible();

    // 6. Click Next to Step 2
    await webviewFrame.locator('#btn-next').click();
    await page.waitForTimeout(500);

    // 7. Verify Step 2 (Space Selection)
    const step2 = webviewFrame.locator('[data-step="2"], #step-2');
    await expect(step2.first()).toBeVisible();

    // 8. Continue through steps...
    // (Navigate through all 7 steps)
    for (let step = 2; step < 7; step++) {
      const nextBtn = webviewFrame.locator('.btn-next-action:visible, #btn-next-' + (step) + ':visible').first();
      if (await nextBtn.isVisible()) {
        await nextBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // 9. Verify reached Step 7 (Deploy)
    const deploySection = webviewFrame.locator('[data-step="7"], #step-deploy, #step-7');
    await expect(deploySection.first()).toBeVisible({ timeout: 5000 });

    // 10. Take screenshot as evidence
    await page.screenshot({ path: 'test-results/full-flow-step7.png' });
  });
});
```

---

### Task 2.2: Run full flow test

**Step 1:** Run test
```powershell
npx playwright test test/e2e/full-wizard-flow.spec.ts --config=test/e2e/playwright.config.ts --reporter=html
```

**Step 2:** Check screenshots
```powershell
Get-ChildItem test-results/*.png
```

---

## Phase 3: Cleanup

### Task 3.1: Stop Docker container

**Step 1:** Stop and remove
```powershell
docker-compose down
```

### Task 3.2: Cleanup Qlik Cloud artifacts

**Step 1:** Run cleanup
```powershell
npx ts-node test/e2e/cleanup-qlik.ts
```

---

## Success Criteria

**Level 0 (MUST PASS FIRST):**
- [ ] Docker container starts
- [ ] code-server accessible at localhost:8080
- [ ] VS Code loads in browser
- [ ] Command palette works
- [ ] Qlik commands visible

**Level 1 (After Level 0):**
- [ ] Dashboard opens
- [ ] New Model wizard works
- [ ] Entry options visible
- [ ] Upload section appears for "From Spec File"

**Level 2 (After Level 1):**
- [ ] Full 7-step navigation works
- [ ] Can reach Step 7 (Deploy)

---

## Execution Command

To run this plan:
```
I'm using the subagent-driven-development skill to execute this plan.
```
