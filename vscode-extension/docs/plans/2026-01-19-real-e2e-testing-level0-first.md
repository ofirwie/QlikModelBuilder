# Real E2E Testing - Level 0 First Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> **CRITICAL:** Use superpowers:real-app-testing before claiming ANYTHING works.

**Goal:** Test the wizard "From Spec File" flow by ACTUALLY running the VS Code extension - not isolated tests.

**Architecture:** Level 0 (smoke test in real VS Code) → Level 1 (basic flow) → Level 2 (detailed) → Level 3 (unit tests)

**Tech Stack:** VS Code Extension, Qlik Cloud REST API, TypeScript

---

## Phase 0: Level 0 Smoke Test (MANDATORY FIRST)

### Task 0.1: Compile the extension

**Files:**
- None (just compile)

**Step 1:** Compile
```powershell
cd "C:\Users\fires\OneDrive\Git\QlikModelBuilder\vscode-extension"
npm run compile
```

**Expected:** No errors. If errors → STOP. Fix them first.

**Step 2:** Report result
- If PASS: "Compilation successful, proceeding to Task 0.2"
- If FAIL: "Compilation failed with: [error]. Stopping to fix."

---

### Task 0.2: Launch VS Code with extension

**Step 1:** Open VS Code with extension development host
```powershell
cd "C:\Users\fires\OneDrive\Git\QlikModelBuilder\vscode-extension"
code --extensionDevelopmentPath=.
```

**Step 2:** Wait for VS Code to open

**Step 3:** Report
- "VS Code opened successfully" OR
- "VS Code failed to open: [error]"

---

### Task 0.3: Run the extension command

**Step 1:** In VS Code Extension Development Host:
1. Press `Ctrl+Shift+P`
2. Type "Qlik"
3. Select "Qlik Model Builder: Open Dashboard" (or similar command)

**Step 2:** Observe and report EXACTLY what happens:
- Did a panel open?
- What does it show?
- Are there any errors in the Developer Tools console?

**Expected:** Dashboard panel opens with "New Model" button visible.

**Step 3:** If FAIL → STOP. Do not proceed to Level 1.

---

### Task 0.4: Test New Model → From Spec File

**Step 1:** In the dashboard panel:
1. Click "New Model" button
2. Observe what happens

**Step 2:** Report:
- Did the wizard open?
- Is Step 1 visible with entry options?
- Are "From Spec File", "From Template", "Start from Scratch" visible?

**Step 3:** Click "From Spec File" option

**Step 4:** Report:
- Did the upload section appear?
- Is the "Select Spec File" button visible?

**Expected:** Upload section appears with button.

**Step 5:** If FAIL → STOP. Do not proceed.

---

### Task 0.5: Test file upload dialog

**Step 1:** Click "Select Spec File" button

**Step 2:** Report:
- Did a file dialog open?
- What file types are shown in the filter?

**Expected:** Windows file dialog opens with filter for .xlsx, .docx, etc.

**Step 3:** If FAIL → STOP. Do not proceed.

---

## Phase 1: Level 1 Basic Flow (Only after Phase 0 passes)

### Task 1.1: Upload a real spec file

**Files:**
- Test with: Any .xlsx or .docx file with table definitions

**Step 1:** In the file dialog, select a spec file

**Step 2:** Report:
- Did the file get processed?
- Did a message appear showing parsed tables?
- Any errors?

**Step 3:** If errors → investigate and fix before proceeding.

---

### Task 1.2: Navigate through wizard steps

**Step 1:** Click "Next" to go to Step 2 (Space Selection)

**Step 2:** Report:
- Does Step 2 show?
- Are spaces loading from Qlik Cloud?
- Or is there an error?

**Step 3:** Continue through Steps 3-7, reporting what each step shows.

**Expected:** Can navigate through all 7 steps without crashes.

---

### Task 1.3: Test space creation in Qlik Cloud

**Step 1:** In Step 2, enter a new space name: "QMB_TEST_RealE2E"

**Step 2:** Click "Create" button

**Step 3:** Report:
- Did the space get created?
- Check Qlik Cloud to verify: `https://iyil7lpmybpzhbm.de.qlikcloud.com`
- Any errors?

---

### Task 1.4: Test app deployment

**Step 1:** Complete the wizard:
- Select the created space
- Configure connection (use DataFiles for simplicity)
- Select tables
- Go to Step 7 (Deploy)

**Step 2:** Enter app name: "QMB_TEST_RealE2E_App"

**Step 3:** Click "Deploy"

**Step 4:** Report:
- Did the deploy start?
- What status messages appear?
- Did it succeed or fail?
- Check Qlik Cloud for the app.

---

## Phase 2: Level 2 Error Handling (Only after Phase 1 passes)

### Task 2.1: Test with invalid credentials

**Step 1:** Change API key to invalid value in VS Code settings

**Step 2:** Try to load spaces

**Step 3:** Report:
- Does it show a helpful error message?
- Or does it crash?

---

### Task 2.2: Test with malformed spec file

**Step 1:** Upload an empty Excel file

**Step 2:** Report:
- Does it show a helpful error?
- Or does it crash?

---

## Phase 3: Cleanup

### Task 3.1: Delete test artifacts from Qlik Cloud

**Step 1:** Run cleanup
```powershell
cd "C:\Users\fires\OneDrive\Git\QlikModelBuilder\vscode-extension"
npx ts-node test/e2e/cleanup-qlik.ts
```

**Expected:**
```
🧹 Starting Qlik Cloud cleanup...
   Found 1 test spaces
   Deleting space: QMB_TEST_RealE2E
   Found 1 test apps
   Deleting app: QMB_TEST_RealE2E_App
✅ Cleanup complete
```

---

## Success Criteria

Level 0 must pass FIRST:
- [ ] Extension compiles without errors
- [ ] VS Code opens with extension
- [ ] Dashboard command works
- [ ] Wizard opens with entry options
- [ ] Upload section appears for "From Spec File"
- [ ] File dialog opens when clicking upload button

Level 1 (only after Level 0):
- [ ] Spec file uploads and parses
- [ ] Can navigate through all steps
- [ ] Space creation works
- [ ] App deployment works

**IMPORTANT:** If Level 0 fails, DO NOT run Playwright tests. Fix the real app first.

---

## How to Run This Plan

```
I'm using the executing-plans skill to implement this plan.
```

Execute tasks in order. Stop immediately if any Level 0 task fails.
Report EXACTLY what you see, not what you expect to see.
