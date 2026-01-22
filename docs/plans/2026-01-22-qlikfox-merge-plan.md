# QlikFox Branch Merge Plan

**Date:** 2026-01-22
**Version:** 2.0
**Status:** Pending Gemini Review
**Goal:** Create clean unified branch `feature/qlikfox-webapp`

---

## 1. Current State

| Branch | Content | Status |
|--------|---------|--------|
| `main` | Production baseline | Stable |
| `develop` | Development baseline | Stable |
| `stage1-testing` | Backend (wizard + model-builder) | Ready |
| `feature/ui-design` | Basic web-app UI | Current |

---

## 2. Target State

```
feature/qlikfox-webapp (NEW)
├── src/
│   ├── wizard/           ← From stage1-testing
│   ├── model-builder/    ← From stage1-testing
│   └── ...
│
└── web-app/
    └── src/
        ├── components/   ← From feature/ui-design (preserved)
        │   ├── ui/
        │   └── layout/
        ├── lib/          ← From feature/ui-design (preserved)
        └── features/     ← NEW (to be created)
```

---

## 3. Merge Strategy

**Selected: Sequential Merge with Backups**

This approach:
- Creates backup branches before any merge
- Merges branches sequentially with explicit commits
- Provides clear rollback points
- Maintains full git history

---

## 4. Pre-Merge Checklist

| # | Check | Command | Expected |
|---|-------|---------|----------|
| 1 | Clean working directory | `git status` | No uncommitted changes |
| 2 | All branches up to date | `git fetch --all` | Success |
| 3 | Tests pass on stage1-testing | `git checkout stage1-testing && npm test` | All green |
| 4 | Tests pass on feature/ui-design | `git checkout feature/ui-design && cd web-app && npm test` | All green |

---

## 5. Step-by-Step Merge Plan

### Phase 1: Preparation & Backups

```bash
# Step 1.1: Ensure clean state
git stash  # If needed
git fetch --all

# Step 1.2: Create backup branches (CRITICAL - Risk Mitigation)
git branch stage1-testing-backup stage1-testing
git branch feature-ui-design-backup feature/ui-design
git branch develop-backup develop

# Step 1.3: Verify backups exist
git branch | grep backup
# Expected: 3 backup branches listed
```

### Phase 2: Create New Branch

```bash
# Step 2.1: Start from develop (clean base)
git checkout develop
git pull origin develop

# Step 2.2: Create new feature branch
git checkout -b feature/qlikfox-webapp

# Step 2.3: Verify
git branch --show-current
# Expected: feature/qlikfox-webapp
```

### Phase 3: Merge Backend (stage1-testing)

```bash
# Step 3.1: Merge stage1-testing
git merge stage1-testing --no-ff -m "merge: add backend from stage1-testing (wizard + model-builder)"

# Step 3.2: If conflicts occur:
# - Review each conflict carefully
# - Resolve conflicts
# - git add <resolved-files>
# - git merge --continue

# Step 3.3: Verify backend files exist
ls src/wizard/
ls src/model-builder/
# Expected: Both directories exist with files
```

### Phase 4: Merge UI (feature/ui-design)

```bash
# Step 4.1: Merge feature/ui-design
git merge feature/ui-design --no-ff -m "merge: add web-app UI from feature/ui-design"

# Step 4.2: If conflicts occur:
# - Review each conflict carefully
# - Resolve conflicts
# - git add <resolved-files>
# - git merge --continue

# Step 4.3: Verify web-app files exist
ls web-app/src/components/
ls web-app/src/lib/
# Expected: Both directories exist with files
```

### Phase 5: Full Verification

```bash
# Step 5.1: Verify all expected directories
test -d src/wizard && echo "✓ wizard exists" || echo "✗ wizard MISSING"
test -d src/model-builder && echo "✓ model-builder exists" || echo "✗ model-builder MISSING"
test -d web-app/src/components && echo "✓ components exists" || echo "✗ components MISSING"
test -d web-app/src/lib && echo "✓ lib exists" || echo "✗ lib MISSING"

# Step 5.2: Install dependencies and run tests
cd web-app
npm install
npm run build
npm test
# Expected: Build succeeds, all tests pass

# Step 5.3: Return to root and verify git history
cd ..
git log --oneline -10
# Expected: See merge commits from both branches
```

### Phase 6: Push to Remote

```bash
# Step 6.1: Push new branch (only after ALL verification passes)
git push -u origin feature/qlikfox-webapp

# Step 6.2: Verify on remote
git branch -r | grep qlikfox
# Expected: origin/feature/qlikfox-webapp
```

---

## 6. Rollback Plan

### Scenario A: Problem discovered BEFORE push

```bash
# Delete local branch and start over
git checkout develop
git branch -D feature/qlikfox-webapp

# Restore from backups if needed
git checkout stage1-testing-backup
git checkout feature-ui-design-backup
```

### Scenario B: Problem discovered AFTER push (no PR)

```bash
# Delete remote branch
git push origin --delete feature/qlikfox-webapp

# Delete local branch
git checkout develop
git branch -D feature/qlikfox-webapp

# Start over from Phase 2
```

### Scenario C: Problem discovered AFTER PR created

```bash
# Option 1: Close PR, delete branch, start over
# - Close the PR on GitHub/GitLab
# - Follow Scenario B steps

# Option 2: Force-push corrected version (CAUTION)
# - Only if no one else has pulled the branch
git checkout feature/qlikfox-webapp
git reset --hard <last-good-commit>
git push --force-with-lease origin feature/qlikfox-webapp
# WARNING: Notify team before force-pushing
```

### Scenario D: Need to completely abort

```bash
# Restore all branches from backups
git checkout develop
git branch -D feature/qlikfox-webapp 2>/dev/null
git checkout -B stage1-testing stage1-testing-backup
git checkout -B feature/ui-design feature-ui-design-backup

# Clean up backup branches
git branch -D stage1-testing-backup
git branch -D feature-ui-design-backup
git branch -D develop-backup
```

---

## 7. Post-Merge Tasks

| # | Task | Description | Command/Action |
|---|------|-------------|----------------|
| 1 | Update CLAUDE.md | Point to new branch structure | Edit file |
| 2 | Commit design documents | Already created | `git add docs/plans/` |
| 3 | Run full E2E test | If available | `npm run test:e2e` |
| 4 | Clean up backup branches | After confirming success | `git branch -D *-backup` |

---

## 8. Risk Assessment

| Risk | Probability | Impact | Mitigation | Implementation Step |
|------|-------------|--------|------------|---------------------|
| Merge conflicts | Medium | Low | Resolve carefully, test after | Phase 3.2, 4.2 |
| Breaking changes | Low | Medium | Run full test suite | Phase 5.2 |
| Lost commits | Low | High | Create backup branches | Phase 1.2 |
| Wrong files merged | Low | Medium | Verify directories after each merge | Phase 3.3, 4.3, 5.1 |
| Push before ready | Low | Medium | Verification gate before push | Phase 5 complete |

---

## 9. Success Criteria

- [ ] Backup branches created (Phase 1.2)
- [ ] Branch `feature/qlikfox-webapp` exists
- [ ] Contains `src/wizard/` from stage1-testing
- [ ] Contains `src/model-builder/` from stage1-testing
- [ ] Contains `web-app/src/components/` from feature/ui-design
- [ ] `npm run build` succeeds in web-app
- [ ] `npm test` passes in web-app
- [ ] Clean git history with meaningful merge commits
- [ ] Pushed to remote
- [ ] Backup branches cleaned up (after confirmation)

---

## 10. Execution Summary

| Phase | Steps | Commands | Risk Level |
|-------|-------|----------|------------|
| 1. Preparation & Backups | 3 | 5 | Low |
| 2. Create Branch | 3 | 4 | Low |
| 3. Merge Backend | 3 | 4+ | Medium |
| 4. Merge UI | 3 | 4+ | Medium |
| 5. Verification | 3 | 6 | Low |
| 6. Push | 2 | 2 | Low |
| **Total** | **17** | **25+** | **Medium** |

---

## 11. Approval Requirements

- [ ] Gemini review score >= 90
- [ ] User explicit approval
- [ ] Pre-merge checklist complete
