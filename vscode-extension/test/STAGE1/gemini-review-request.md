# Gemini Review Request - VS Code Extension Wizard Test Plan

## Instructions for Gemini

Please review this test plan for completeness and correctness. Score each metric from 1-10.

### Required Sections Checklist:
1. ✅ Overview with purpose, goal, test count, environment
2. ✅ Layer Architecture with blocking principle
3. ✅ Folder Structure with all required directories
4. ✅ Recovery Mechanism with checkpoint system
5. ✅ Test Cases - detailed for each layer (143 total)
6. ✅ Risk Mitigation & Contingency table (6 risks)
7. ✅ Task Breakdown & Dependencies with DoD (10 tasks)
8. ✅ Resource Requirements table
9. ✅ Testing Strategy with phases
10. ✅ Communication Plan
11. ✅ Success Criteria (automated + manual)

### Review Criteria:

**Completeness (Score /10):**
- All 11 required sections present?
- Each section has sufficient detail?
- No obvious gaps in coverage?
- Test cases cover all functionality?
- Risk mitigation is comprehensive?

**Correctness (Score /10):**
- Layer architecture makes logical sense?
- Test dependencies are valid?
- Task breakdown is achievable?
- Resource requirements are realistic?
- Success criteria are measurable?

### Questions for Review:

1. Are there any missing test scenarios for a VS Code Extension Wizard?
2. Is the layer blocking principle appropriate?
3. Are the risk probabilities realistic?
4. Is the critical path correctly identified?
5. Are the success criteria sufficient for "production ready"?

---

## Plan Summary

| Aspect | Value |
|--------|-------|
| Total Automated Tests | 143 |
| Manual Checklists | 15 |
| Layers | 5 (0-4) |
| Risks Identified | 6 |
| Tasks | 10 |
| Critical Path | 8.5 days |
| Test Environment | Docker + VS Code Server |
| Real Integration | Qlik Cloud tenant |

## What This Plan Tests

### Layer 0: Infrastructure (15 tests)
- Extension activation
- Command registration
- Webview rendering
- VS Code API mock
- Performance baseline

### Layer 1: Navigation (28 tests)
- All 7 step buttons
- Progress bar updates
- Back/Next navigation
- State persistence
- Validation messages

### Layer 2: File Operations (45 tests)
- File upload (CSV, XLSX)
- Drag and drop
- File preview
- Data source selection
- Schema configuration
- All wizard steps 1-7

### Layer 3: Integration (40 tests)
- Complete end-to-end flows
- Error recovery
- State management
- Visual regression (20 screenshots)
- Real Qlik Cloud API (5 tests)

### Layer 4: Manual Acceptance (15 checklists)
- Visual polish
- Usability
- Theme support
- Accessibility
- Production readiness

## Recovery Mechanism

- Checkpoint saved after each test
- Heartbeat every 5 seconds
- Crash detection on startup
- Resume from last checkpoint
- Atomic writes with .bak backup

## Risk Summary

| Risk | Probability | Contingency |
|------|-------------|-------------|
| Docker fails | 25% | Local VS Code fallback |
| API rate limit | 30% | Exponential backoff |
| Visual false positives | 40% | Increase tolerance |
| Test flakiness | 45% | Retry 2x, flag separately |
| Upload timeout | 30% | 5 minute timeout |
| Checkpoint corruption | 15% | .bak file fallback |

---

## Please Provide:

1. **Completeness Score:** /10
2. **Correctness Score:** /10
3. **Missing Items:** (list any gaps)
4. **Recommendations:** (improvements)
5. **Approval Status:** APPROVED / NEEDS REVISION

---

*Full test plan attached in TEST-PLAN.md*
