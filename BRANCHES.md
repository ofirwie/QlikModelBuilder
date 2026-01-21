# Git Branch Strategy - QlikModelBuilder

## Branch Structure

```
main                    ← Stable releases only
├── develop             ← Active development (wizard steps 1-7)
└── stage1-testing      ← STAGE1 test infrastructure
```

---

## Branch Rules

| Branch | Purpose | Merge From | Merge To |
|--------|---------|------------|----------|
| `main` | Production releases | `develop` only | Never |
| `develop` | Active wizard development | `stage1-testing` | `main` |
| `stage1-testing` | Test infrastructure | None | `develop` |

---

## Current Status

- **main**: 58 commits ahead of origin (needs push or cleanup)
- **develop**: To be created
- **stage1-testing**: To be created

---

## Workflow

### For Wizard Development:
```bash
git checkout develop
# work on wizard
git commit -m "feat: step X implementation"
```

### For Test Development:
```bash
git checkout stage1-testing
# work on tests
git commit -m "test: layer X tests"
```

### To Sync Tests with Development:
```bash
git checkout develop
git merge stage1-testing
```

### To Release:
```bash
git checkout main
git merge develop
git push
```

---

## Files per Branch

### `develop` branch contains:
- `vscode-extension/src/` - Wizard source code
- `vscode-extension/out/` - Compiled code
- `docs/plans/` - Design documents

### `stage1-testing` branch contains:
- `vscode-extension/test/STAGE1/` - Test infrastructure
- Test fixtures and specs

### `main` branch contains:
- Only merged, tested code
- Release tags

---

## Commands to Set Up

```bash
# 1. Save current work
git stash

# 2. Create develop branch from current state
git checkout -b develop
git add -A
git commit -m "chore: save current development state"

# 3. Create stage1-testing branch
git checkout -b stage1-testing develop
git add vscode-extension/test/STAGE1/
git commit -m "test: STAGE1 infrastructure setup"

# 4. Go back to develop for wizard work
git checkout develop
git stash pop
```

---

## Session Recovery

### For Wizard Development:
```
git checkout develop
Tell Claude: "אני רוצה לעבוד על ה-Wizard"
```

### For Testing:
```
git checkout stage1-testing
Tell Claude: "תקרא את vscode-extension/test/STAGE1/SESSION.md"
```
