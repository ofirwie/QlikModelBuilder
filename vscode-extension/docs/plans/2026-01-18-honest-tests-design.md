# Honest Tests Design

## Problem

Tests were reporting "PASS" when critical steps failed and fallbacks were used.
NEON connection failed → test used INLINE fake data → reported "success".
This is lying.

## Principle

**A test either passes or fails. There is no middle ground.**

- If something fails → the test fails
- Fallback that hides failure = test failure
- No "passed with fallback" - only PASS or FAIL

## Design

### Rule 1: No Fallbacks in Tests

Tests must not have fallbacks that hide failures:
- `createNeonConnection` fails → throw error, stop test
- `generateQVSScript` without connection → throw error, stop test
- No INLINE data as fallback

### Rule 2: Wake Up NEON Before Tests

NEON is a serverless database that sleeps after inactivity.

Before running tests:
1. Send simple query (SELECT 1)
2. Wait for response (with retries)
3. If no response after timeout → FAIL with clear message

### Rule 3: Fail Fast

Steps depend on each other:
- No connection → can't generate real script
- No script → can't upload
- No upload → can't reload

When a step fails:
1. Stop immediately
2. Report which step failed and why
3. Work on fixing it
4. Only continue after it passes

### Rule 4: Honest Reporting

When reporting test results:
- Each step reported separately: STEP-1: ✅ | STEP-2: ❌
- Clear failure message: "NEON connection failed: [error]"
- No "X success, 0 failed" when fallbacks were used

## Implementation Order

1. Write rules (global + project CLAUDE.md)
2. Fix E2E test - remove all fallbacks
3. Add NEON wake-up step
4. Fix NEON connection
5. Run test until it passes with real data

## Files to Change

- `~/.claude/CLAUDE.md` - add global rule
- `vscode-extension/CLAUDE.md` - add project rule
- `test/e2e/full-e2e-real-flow.test.ts` - remove fallbacks, add wake-up
