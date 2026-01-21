# VS Code Extension Wizard - Comprehensive Test Plan (STAGE1)

## Overview

**Purpose:** Comprehensive functional testing for the VS Code Extension Wizard
**Goal:** Zero defects before manual acceptance testing
**Total Tests:** ~143 automated + 15 manual checklists
**Testing Environment:** Docker + VS Code Server with real Qlik Cloud tenant

---

## 1. Layer Architecture (Blocking Principle)

```
Layer 0: Infrastructure Tests (15 tests)
    ↓ BLOCKS (must pass 100%)
Layer 1: Step Navigation Tests (28 tests)
    ↓ BLOCKS (must pass 100%)
Layer 2: File Operations Tests (45 tests)
    ↓ BLOCKS (must pass 100%)
Layer 3: Integration Tests (40 tests)
    ↓ BLOCKS (must pass 100%)
Layer 4: Manual Acceptance (15 checklists)
```

**Rule:** If Layer N fails, Layer N+1 does NOT run.

---

## 2. Folder Structure

```
vscode-extension/test/STAGE1/
├── checkpoints/
│   ├── layer0-complete.json
│   ├── layer1-complete.json
│   ├── layer2-complete.json
│   └── layer3-complete.json
├── screenshots/
│   ├── baseline/          # Reference images
│   └── actual/            # Current run images
├── logs/
│   ├── test-run-{timestamp}.log
│   └── failures/          # Failure logs only
├── fixtures/
│   ├── test-data.csv
│   ├── test-data.xlsx
│   └── mock-qlik-responses.json
├── results/
│   └── report-{timestamp}.html
├── specs/
│   ├── layer0.spec.ts
│   ├── layer1.spec.ts
│   ├── layer2.spec.ts
│   └── layer3.spec.ts
├── runner.ts              # Main test runner
└── TEST-PLAN.md           # This file
```

---

## 3. Recovery Mechanism

### Checkpoint System
```typescript
interface Checkpoint {
  layer: number;
  timestamp: string;
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
  lastPassedTest: string;
  state: 'complete' | 'partial' | 'failed';
}
```

### Recovery Flow
1. On start: Check for existing checkpoints
2. If found: Ask "Resume from Layer X?"
3. If crash: Save checkpoint immediately before each test
4. On resume: Skip completed layers, continue from last checkpoint

### Crash Detection
- Heartbeat file updated every 5 seconds
- If heartbeat > 30 seconds old on start → previous run crashed
- Automatic recovery prompt with saved state

---

## 4. Test Cases by Layer

### Layer 0: Infrastructure (15 tests)

| ID | Test Name | Assertion | Critical |
|----|-----------|-----------|----------|
| L0-001 | Extension activates | No activation errors | YES |
| L0-002 | Command exists | "QMB: Open Wizard" registered | YES |
| L0-003 | Webview opens | Panel visible | YES |
| L0-004 | HTML renders | Body not empty | YES |
| L0-005 | No console errors | Zero JS errors | YES |
| L0-006 | CSS variables resolve | No "undefined" values | YES |
| L0-007 | Progress bar exists | Element found | YES |
| L0-008 | All step buttons exist | 7 buttons found | YES |
| L0-009 | Step 1 active by default | Step 1 has active class | YES |
| L0-010 | VS Code API works | postMessage callable | YES |
| L0-011 | State persistence | setState/getState work | YES |
| L0-012 | Panel hide/show | Survives cycle | NO |
| L0-013 | Clean close | No orphan processes | NO |
| L0-014 | Memory usage | Under 100MB | NO |
| L0-015 | Load time | Under 3 seconds | NO |

### Layer 1: Step Navigation (28 tests)

| ID | Test Name | Assertion |
|----|-----------|-----------|
| L1-001 to L1-007 | Click step N | Step N content displays |
| L1-008 to L1-014 | Step N content | Content area updates correctly |
| L1-015 to L1-021 | Progress bar step N | Visual position correct |
| L1-022 | Skip prevention | Cannot skip to Step 7 without prior steps |
| L1-023 | Back button | Returns to previous step |
| L1-024 | Next disabled | Disabled when step incomplete |
| L1-025 | Next enabled | Enabled when step complete |
| L1-026 | Keyboard nav | Tab and Enter work |
| L1-027 | State persistence | Step state survives hide/show |
| L1-028 | Validation messages | Appear correctly |

### Layer 2: File Operations (45 tests)

**Step 1 - File Upload (15 tests):**
| ID | Test Name | Assertion |
|----|-----------|-----------|
| L2-001 | CSV accepted | File input accepts .csv |
| L2-002 | XLSX accepted | File input accepts .xlsx |
| L2-003 | Drag zone visible | Drop zone element exists |
| L2-004 | Drag feedback | Highlight on drag over |
| L2-005 | Drop CSV | File name displays |
| L2-006 | Drop XLSX | File name displays |
| L2-007 | Invalid type | Error message shown |
| L2-008 | Small file (1KB) | Upload succeeds |
| L2-009 | Medium file (10MB) | Upload succeeds |
| L2-010 | Large file (100MB) | Warning/handling |
| L2-011 | Cancel upload | Clean state restored |
| L2-012 | Multiple files | Correct handling |
| L2-013 | File preview | First 5 rows shown |
| L2-014 | Headers detected | Columns identified |
| L2-015 | Empty file | Error message |

**Step 2 - Data Source (5 tests):**
| ID | Test Name | Assertion |
|----|-----------|-----------|
| L2-016 | Local File option | Selectable |
| L2-017 | Qlik Cloud option | Selectable |
| L2-018 | Database option | Selectable |
| L2-019 | Selection persists | After navigation |
| L2-020 | Visual indicator | Selected option highlighted |

**Step 3 - Schema Configuration (10 tests):**
| ID | Test Name | Assertion |
|----|-----------|-----------|
| L2-021 | Columns populated | From uploaded file |
| L2-022 | Data type dropdown | Works for each column |
| L2-023 | Primary key checkbox | Toggles correctly |
| L2-024 | Column rename | Input works |
| L2-025 | Column exclude | Toggle works |
| L2-026 | Auto-detect types | Correct detection |
| L2-027 | Manual override | Type can be changed |
| L2-028 | Required validation | Error on missing |
| L2-029 | Preview updates | Reflects changes |
| L2-030 | Reset button | Returns to auto-detect |

**Steps 4-7 (15 tests):** Similar pattern for remaining steps

### Layer 3: Integration Tests (40 tests)

**Full Flow Tests (5 tests):**
| ID | Test Name | Assertion |
|----|-----------|-----------|
| L3-001 | Complete CSV flow | End-to-end success |
| L3-002 | Complete XLSX flow | End-to-end success |
| L3-003 | Qlik Cloud flow | Real API connection |
| L3-004 | All options modified | Complex flow works |
| L3-005 | Interrupt and resume | State preserved |

**Error Recovery (5 tests):**
| ID | Test Name | Assertion |
|----|-----------|-----------|
| L3-006 | Network disconnect | Recovery message |
| L3-007 | File read error | Meaningful error |
| L3-008 | Invalid credentials | Re-prompt shown |
| L3-009 | Timeout handling | Retry option |
| L3-010 | Partial completion | Can continue |

**State Management (5 tests):**
| ID | Test Name | Assertion |
|----|-----------|-----------|
| L3-011 | Browser refresh | State restored |
| L3-012 | Panel reopen | State restored |
| L3-013 | Multiple instances | Isolated state |
| L3-014 | Completion cleanup | State cleared |
| L3-015 | Cancel cleanup | State cleared |

**Visual Regression (20 tests):**
| ID | Test Name | Assertion |
|----|-----------|-----------|
| L3-016 to L3-035 | Screenshot step N | Matches baseline |

**Real Qlik Cloud Tests (5 tests):**
| ID | Test Name | Assertion |
|----|-----------|-----------|
| L3-036 | Connect to tenant | API responds |
| L3-037 | List apps | Apps returned |
| L3-038 | Select app | App data loaded |
| L3-039 | Get fields | Fields returned |
| L3-040 | Full model creation | Model created in Qlik |

### Layer 4: Manual Acceptance (15 checklists)

| ID | Checklist Item | Pass Criteria |
|----|----------------|---------------|
| L4-001 | First impression | Looks professional |
| L4-002 | Text readability | No truncation |
| L4-003 | Button usability | Clickable, appropriate size |
| L4-004 | Error messages | Helpful and clear |
| L4-005 | Loading states | Visible and clear |
| L4-006 | Success states | Satisfying feedback |
| L4-007 | Flow intuition | No confusion |
| L4-008 | No dead ends | Always a way forward |
| L4-009 | Panel resize | Responsive layout |
| L4-010 | Light theme | Works correctly |
| L4-011 | Dark theme | Works correctly |
| L4-012 | High contrast | Works correctly |
| L4-013 | Keyboard only | Full navigation possible |
| L4-014 | Screen reader | Compatible |
| L4-015 | Overall polish | Production ready |

---

## 5. Risk Mitigation & Contingency

| Risk | Impact (days) | Probability | Contingency | Trigger |
|------|--------------|-------------|-------------|---------|
| VS Code Server Docker fails to start | 1 | Medium (25%) | Fallback to local VS Code with Extension Host; document manual steps | Docker container exits with error |
| Qlik Cloud API rate limiting | 0.5 | Medium (30%) | Add retry with exponential backoff; cache responses; reduce test parallelism | 429 response code |
| Visual regression false positives | 1 | High (40%) | Increase pixel tolerance threshold; use structural comparison; manual review queue | >10% baseline mismatches |
| Test flakiness (timing issues) | 1.5 | High (45%) | Add explicit waits; retry failed tests 2x; flag intermittent failures separately | Same test fails then passes on retry |
| Large file upload timeout | 0.5 | Medium (30%) | Increase timeout to 5 minutes; add progress tracking; test with smaller files first | Upload hangs >60 seconds |
| Checkpoint corruption | 0.5 | Low (15%) | Atomic writes with .bak backup; validate JSON on load; auto-repair from last valid | JSON parse error on checkpoint load |

---

## 6. Task Breakdown & Dependencies

| Task | Duration | Dependencies | Critical Path | DoD |
|------|----------|--------------|---------------|-----|
| 1.1 Create STAGE1 folder structure | 0.5 day | None | YES | ✓ All folders exist, ✓ .gitkeep files added, ✓ TEST-PLAN.md in place |
| 1.2 Implement checkpoint system | 1 day | 1.1 | YES | ✓ Save/load checkpoints works, ✓ Crash recovery tested, ✓ Resume prompt works |
| 1.3 Set up Docker + VS Code Server | 1 day | None | YES | ✓ Container builds, ✓ Extension loads, ✓ Webview renders |
| 1.4 Write Layer 0 tests | 0.5 day | 1.3 | YES | ✓ All 15 tests written, ✓ Pass on clean extension, ✓ Fail detection works |
| 1.5 Write Layer 1 tests | 1 day | 1.4 | YES | ✓ All 28 tests written, ✓ Navigation fully covered, ✓ State persistence tested |
| 1.6 Write Layer 2 tests | 1.5 days | 1.5 | YES | ✓ All 45 tests written, ✓ File upload works, ✓ All steps covered |
| 1.7 Write Layer 3 tests | 1.5 days | 1.6 | YES | ✓ All 40 tests written, ✓ Real Qlik connection tested, ✓ Visual baselines captured |
| 1.8 Create test runner | 0.5 day | 1.2, 1.7 | YES | ✓ Runs all layers, ✓ Blocks on failure, ✓ Generates report |
| 1.9 Run full test suite | 1 day | 1.8 | YES | ✓ All tests pass, ✓ No flaky tests, ✓ Report generated |
| 1.10 Prepare manual checklist | 0.5 day | 1.9 | NO | ✓ Checklist document ready, ✓ Screenshots attached, ✓ Pass criteria clear |

**Critical Path:** 1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 1.7 → 1.8 → 1.9 (8.5 days)

---

## 7. Resource Requirements

| Resource | Type | Availability | Skills Required |
|----------|------|--------------|-----------------|
| TypeScript Developer | Human | 1 FTE | Playwright, VS Code Extension API, Docker |
| Docker Desktop | Tool | Installed | Container management |
| VS Code Server image | Infrastructure | Docker Hub | N/A |
| Qlik Cloud tenant | External Service | Available | API key configured |
| Test data files | Data | Create fixtures | CSV/XLSX generation |
| Baseline screenshots | Data | Capture during 1.7 | Visual comparison setup |

---

## 8. Testing Strategy

| Phase | Coverage | Tools | Acceptance Criteria | Rollback Plan |
|-------|----------|-------|---------------------|---------------|
| Layer 0 | Infrastructure | Playwright, VS Code API | All 15 tests pass; extension activates cleanly | Fix extension activation before proceeding |
| Layer 1 | Navigation | Playwright | All 28 tests pass; all steps reachable | Fix navigation bugs before Layer 2 |
| Layer 2 | Functionality | Playwright, File API | All 45 tests pass; file operations work | Fix file handling before integration |
| Layer 3 | Integration | Playwright, Qlik API | All 40 tests pass; real cloud works | Fix integration issues before manual |
| Layer 4 | Acceptance | Human reviewer | All 15 checklists pass; user approves | Return to automated fixes if issues found |

---

## 9. Communication Plan

- **Per Test:** Log result to test-run-{timestamp}.log with full details
- **Per Layer:** Generate checkpoint; output summary to console
- **On Failure:** Stop immediately; save failure log to logs/failures/; notify via console
- **On Completion:** Generate HTML report; display summary; prepare for Layer 4
- **Escalation:** Any Layer 3 Qlik API failure → check tenant status; verify API key; retry once
- **User Communication:** Clear progress bar in test output; estimated remaining tests; current layer indicator

---

## 10. Security Testing Strategy

### Scope
Testing for security vulnerabilities given interaction with real Qlik Cloud tenant.

### Test Cases

| ID | Test Name | Type | Assertion |
|----|-----------|------|-----------|
| SEC-001 | API Key not exposed in logs | Data Leakage | No credentials in console/logs |
| SEC-002 | API Key not hardcoded | Code Review | Key comes from env/config only |
| SEC-003 | Input sanitization | Injection | No XSS in user inputs |
| SEC-004 | File path validation | Path Traversal | Cannot access files outside workspace |
| SEC-005 | HTTPS enforcement | Transport | All API calls use HTTPS |
| SEC-006 | Token storage secure | Credential Storage | Tokens in VS Code SecretStorage |
| SEC-007 | Session timeout | Access Control | Sessions expire after inactivity |
| SEC-008 | Error messages safe | Information Disclosure | No stack traces/paths to user |

### Tools
- Manual code review for credential handling
- Console/log inspection for data leakage
- Input fuzzing for injection testing

### Acceptance Criteria
- Zero credentials exposed in any output
- All inputs validated before processing
- HTTPS for all external communications

---

## 11. Performance Testing

### Benchmarks

| Metric | Target | Critical | Tool |
|--------|--------|----------|------|
| Extension activation time | < 500ms | < 1000ms | VS Code Extension Profiler |
| Wizard panel open time | < 200ms | < 500ms | Performance.now() |
| File upload (1MB) | < 2s | < 5s | Stopwatch |
| File upload (10MB) | < 10s | < 30s | Stopwatch |
| Qlik API response | < 1s | < 3s | Network timing |
| Memory usage (idle) | < 50MB | < 100MB | VS Code Process Monitor |
| Memory usage (with file) | < 100MB | < 200MB | VS Code Process Monitor |

### Load Profiles

| Profile | Description | Duration |
|---------|-------------|----------|
| Normal | Single file, sequential steps | Full flow |
| Stress | 100MB file, rapid navigation | 5 minutes |
| Soak | Repeated wizard open/close | 30 minutes |

### Test Cases

| ID | Test Name | Assertion |
|----|-----------|-----------|
| PERF-001 | Cold start activation | < 500ms |
| PERF-002 | Warm start activation | < 200ms |
| PERF-003 | Panel render time | < 200ms |
| PERF-004 | Step navigation time | < 100ms |
| PERF-005 | File parse time (1MB CSV) | < 1s |
| PERF-006 | Memory leak check (soak) | No growth > 10% |

---

## 12. Localization/Internationalization (L10n/I18n)

### Scope
Ensure correct functionality for different locales, even if UI is English-only.

### Test Cases

| ID | Test Name | Assertion |
|----|-----------|-----------|
| L10N-001 | UTF-8 file names | Files with Hebrew/Arabic names work |
| L10N-002 | UTF-8 file content | Non-ASCII data displays correctly |
| L10N-003 | Date formats | ISO dates parsed regardless of locale |
| L10N-004 | Number formats | Decimal separators handled |
| L10N-005 | RTL data display | Hebrew/Arabic text renders correctly |
| L10N-006 | Long text wrapping | No truncation in UI |

### Note
Extension UI is English-only. L10n testing focuses on DATA handling, not UI translation.

---

## 13. Test Data Management Plan

### Real Qlik Cloud Tenant Strategy

| Aspect | Strategy |
|--------|----------|
| **Tenant** | Dedicated test tenant (not production) |
| **Data Creation** | Fixtures uploaded before test run |
| **Data Reset** | API call to delete test apps before each run |
| **Isolation** | Unique test prefix: `STAGE1_TEST_*` |
| **Cleanup** | Post-test script removes all `STAGE1_TEST_*` items |
| **Sensitive Data** | No real customer data; use synthetic Olist dataset |

### Test Data Files

| File | Size | Purpose |
|------|------|---------|
| test-small.csv | 1KB | Basic functionality |
| test-medium.csv | 1MB | Normal usage |
| test-large.csv | 10MB | Performance testing |
| test-huge.csv | 100MB | Stress testing |
| test-unicode.csv | 10KB | L10n testing |
| test-malformed.csv | 1KB | Error handling |

### Refresh Cycle
- Before each test run: Reset test data via API
- After each test run: Cleanup script removes artifacts
- Weekly: Full tenant cleanup

---

## 14. Backward Compatibility Testing

### VS Code Version Support

| Version | Support Level | Test Coverage |
|---------|---------------|---------------|
| 1.85+ (current) | Full | All tests |
| 1.80-1.84 | Supported | Layer 0 + Layer 3 |
| < 1.80 | Unsupported | None |

### Test Cases

| ID | Test Name | Assertion |
|----|-----------|-----------|
| COMPAT-001 | Activation on VS Code 1.85 | Extension activates |
| COMPAT-002 | Activation on VS Code 1.80 | Extension activates |
| COMPAT-003 | Webview on VS Code 1.85 | Panel renders |
| COMPAT-004 | Webview on VS Code 1.80 | Panel renders |
| COMPAT-005 | Extension upgrade | No state loss on upgrade |
| COMPAT-006 | Fresh install after uninstall | Clean state |

### Upgrade Testing
- Install v1.0 → upgrade to v1.1 → verify state preserved
- Uninstall → reinstall → verify clean start

---

## 15. Automated Accessibility

### Tools
- **axe-core**: Automated accessibility scanning
- **VS Code Accessibility Inspector**: Built-in tool

### Automated Checks

| ID | Check | Tool | Acceptance |
|----|-------|------|------------|
| A11Y-001 | Color contrast | axe-core | WCAG AA compliant |
| A11Y-002 | Focus indicators | axe-core | Visible focus states |
| A11Y-003 | ARIA labels | axe-core | All interactive elements labeled |
| A11Y-004 | Keyboard traps | Manual + axe | No trapped focus |
| A11Y-005 | Heading hierarchy | axe-core | Proper H1-H6 structure |
| A11Y-006 | Alt text | axe-core | All images have alt |

### Integration
- axe-core runs automatically in Layer 3 tests
- Failures block test suite
- Manual A11Y checklist in Layer 4 supplements automation

---

## 16. Test Count Reconciliation

### Detailed Breakdown (190 Total)

| Layer | Category | Tests | ID Range |
|-------|----------|-------|----------|
| Layer 0 | Infrastructure | 15 | L0-001 to L0-015 |
| Layer 1 | Step Navigation | 28 | L1-001 to L1-028 |
| Layer 2 | File Operations | 45 | L2-001 to L2-045 |
| Layer 3 | Integration | 40 | L3-001 to L3-040 |
| - | Security | 8 | SEC-001 to SEC-008 |
| - | Performance | 6 | PERF-001 to PERF-006 |
| - | L10n/I18n | 6 | L10N-001 to L10N-006 |
| - | Compatibility | 6 | COMPAT-001 to COMPAT-006 |
| - | Accessibility (auto) | 6 | A11Y-001 to A11Y-006 |
| **Subtotal** | **Automated** | **160** | |
| Layer 4 | Manual Acceptance | 15 | L4-001 to L4-015 |
| - | Exploratory | 15 | EXP-001 to EXP-015 |
| **Subtotal** | **Manual** | **30** | |
| **TOTAL** | **All Tests** | **190** | |

### L3 Integration Breakdown (40 tests)
- L3-001 to L3-005: Full flow tests (5)
- L3-006 to L3-010: Error recovery tests (5)
- L3-011 to L3-015: State management tests (5)
- L3-016 to L3-035: Visual regression tests (20)
- L3-036 to L3-040: Real Qlik Cloud tests (5)

---

## 17. Exploratory Testing

### Purpose
Time-boxed sessions to discover unanticipated issues not covered by scripted tests.

### Sessions (15 total, ~6 hours)

| ID | Focus Area | Duration | Charter |
|----|------------|----------|---------|
| EXP-001 | First impression | 30 min | New user experience, discoverability |
| EXP-002 | Break the wizard | 30 min | Try unusual inputs, edge cases |
| EXP-003 | Large data | 30 min | 100MB files, many columns |
| EXP-004 | Rapid interactions | 20 min | Fast clicking, interrupting flows |
| EXP-005 | State manipulation | 20 min | DevTools, storage editing |
| EXP-006 | Network conditions | 20 min | Slow/offline network |
| EXP-007 | Theme variations | 15 min | Light, dark, high contrast |
| EXP-008 | Panel resizing | 15 min | Different sizes, edge cases |
| EXP-009 | Concurrent ops | 20 min | Multiple files, wizards |
| EXP-010 | Memory pressure | 20 min | Many extensions loaded |
| EXP-011 | Qlik edge cases | 30 min | Large apps, many fields |
| EXP-012 | Keyboard-only | 20 min | Complete flow, no mouse |
| EXP-013 | Screen reader | 30 min | NVDA/VoiceOver |
| EXP-014 | Error messages | 20 min | Clarity, helpfulness |
| EXP-015 | Recovery flows | 20 min | Resume after issues |

### Execution
- Run AFTER all 160 automated tests pass
- Run BEFORE formal manual acceptance (Layer 4)
- Document findings in `exploratory-findings.md`
- Critical issues block release
- Findings may generate new automated tests

---

## 18. Flaky Test Management

### Policy
- **Goal**: Zero flaky tests in main suite
- **Definition**: Test that fails then passes on immediate retry

### Process
1. **Detection**: Retry failed tests 2x automatically
2. **Quarantine**: Move flaky test to `flaky/` folder
3. **Investigation**: Root cause analysis within 24 hours
4. **Fix**: Address timing, async, or state issues
5. **Reintegration**: 3 consecutive passes required

### Flaky Test Indicators
- Uses `setTimeout` or `sleep`
- Depends on network timing
- Tests DOM without explicit waits
- Shared state between tests

---

## 19. Success Criteria

### Automated Tests (160 tests)
- [ ] All 160 automated tests passing
- [ ] Zero flaky tests (all pass 3x consecutively)
- [ ] All 20 visual baselines captured and approved
- [ ] Qlik Cloud integration verified with real tenant
- [ ] Checkpoint/recovery system tested and working
- [ ] Security tests (8) all pass
- [ ] Performance benchmarks met
- [ ] Accessibility checks (6) all pass

### Exploratory Testing (15 sessions)
- [ ] All 15 exploratory sessions completed
- [ ] Findings documented in exploratory-findings.md
- [ ] No critical issues found (or fixed)

### Manual Acceptance (15 checklists)
- [ ] All 15 checklist items pass
- [ ] User confirms "production ready"
- [ ] No critical or major issues found
- [ ] Sign-off documented with date

---

## Gemini Review

**Date:** 2026-01-21
**Status:** ✅ APPROVED (10/10)

| Metric | Score |
|--------|-------|
| Completeness | 10/10 |
| Correctness | 10/10 |

**Review History:**
1. Initial submission: Completeness 9/10, Correctness 9.5/10
   - Missing: Security, Performance, L10n, Test Data Management, Compatibility, Accessibility, Flaky Management
2. Second submission: Completeness 10/10, Correctness 9/10
   - Missing: Test count reconciliation, Exploratory testing
3. Final submission: **Completeness 10/10, Correctness 10/10** ✅

**Final Review Notes:**
- All 19 sections present and complete
- Test count fully reconciled: 160 automated + 30 manual = 190 total
- Exploratory testing: 15 time-boxed sessions (~6 hours)
- All previously identified gaps addressed

**Optional Recommendations (not blocking):**
1. Specify target locales for L10n tests
2. Add data privacy note for Qlik tenant (synthetic data policy)
3. Detail CI/CD integration for test reporting
