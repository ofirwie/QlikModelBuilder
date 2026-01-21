# Sub-Plan 00: Operations & Recovery Master Plan

> **Part of:** Data Model Builder (Stage 2) Implementation
> **Purpose:** META document explaining how the system manages itself
> **Dependencies:** All other sub-plans (01-10)

---

## Overview

This document explains:
1. **How logging works** - Where logs go, what format, how to access
2. **What happens on crash** - Automatic recovery, state preservation
3. **How to resume** - Manual and automatic resume flows
4. **How all pieces connect** - End-to-end operation flow

---

## 1. File System Structure

```
project_folder/
├── .qmb/                           # QlikModelBuilder working directory
│   ├── sessions/                   # Session state files
│   │   ├── {session_id}.json       # Active session state
│   │   └── {session_id}.json.bak   # Backup before each write
│   ├── logs/                       # Log files
│   │   ├── {session_id}.log        # Per-session log (JSON lines)
│   │   ├── {session_id}.log.1      # Rotated log (older)
│   │   ├── {session_id}.log.2      # Rotated log (oldest)
│   │   └── qmb.log                 # Global log (rolling, max 10MB)
│   └── audit/                      # Audit trail for compliance
│       └── {session_id}.audit.json # Audit entries per session
├── stage1_output/                  # Input from Parser (Stage 1)
│   └── spec.json                   # Parsed specification
├── stage2_output/                  # Output from Model Builder
│   ├── model.json                  # Final model definition
│   ├── script.qvs                  # Approved Qlik script
│   └── gemini_review.json          # Last Gemini review result
└── qvd/                            # QVD files (from DB Load)
    └── *.qvd                       # Source data files
```

---

## 2. Logging System

### 2.1 Log Types

| Type | File | Format | Purpose |
|------|------|--------|---------|
| **Session Log** | `.qmb/logs/{session_id}.log` | JSON Lines | All operations for one session |
| **Global Log** | `.qmb/logs/qmb.log` | JSON Lines | Cross-session errors and system events |
| **Audit Log** | `.qmb/audit/{session_id}.audit.json` | JSON | Compliance - approvals, score changes |

### 2.2 Log Entry Structure

```json
{
  "timestamp": "2026-01-21T14:30:00.123Z",
  "level": "INFO",
  "session_id": "abc-123-xyz",
  "stage": "B",
  "component": "script_builder",
  "action": "table_generated",
  "details": {
    "table": "DIM_Customers",
    "fields": 5,
    "rows_estimated": 5000
  },
  "user_id": "user@company.com"
}
```

### 2.3 Log Levels

| Level | When Used | Example |
|-------|-----------|---------|
| **ERROR** | Operation failed | `"Gemini API timeout after 3 retries"` |
| **WARN** | Issue but can continue | `"QVD sample empty, using JSON hints only"` |
| **INFO** | Normal operation | `"Stage B approved"` |
| **DEBUG** | Detailed tracing | `"Sending 1,234 tokens to Gemini"` |

### 2.4 How to Read Logs

```bash
# View all logs for a session
cat .qmb/logs/{session_id}.log | jq .

# Filter by level
cat .qmb/logs/{session_id}.log | jq 'select(.level == "ERROR")'

# Filter by stage
cat .qmb/logs/{session_id}.log | jq 'select(.stage == "C")'

# Last 10 entries
tail -10 .qmb/logs/{session_id}.log | jq .
```

---

## 3. Session State Persistence

### 3.1 State Structure

```json
{
  "session_id": "abc-123-xyz",
  "project_name": "SalesModel",
  "created_at": "2026-01-21T10:00:00Z",
  "updated_at": "2026-01-21T14:35:00Z",
  "current_stage": "C",
  "completed_stages": ["A", "B"],
  "model_type": "star_schema",
  "approved_script_parts": {
    "A": "QUALIFY *;\nSET vPath...",
    "B": "DIM_Customers:\nLOAD..."
  },
  "pending_tables": ["FACT_Orders", "FACT_Returns"],
  "gemini_reviews": [...],
  "user_id": "user@company.com"
}
```

### 3.2 When State is Saved

State is saved **immediately** after each of these events:

| Event | What's Saved | Why |
|-------|--------------|-----|
| Session created | Full state | Enable resume if browser closes |
| Stage approved | approved_script_parts updated | Preserve approved work |
| Gemini review complete | gemini_reviews array updated | Track review history |
| Table added/removed | pending_tables updated | Track user changes |
| Model type selected | model_type updated | Key decision point |

### 3.3 Atomic Write Strategy

```
1. Write to {session_id}.json.tmp
2. Rename {session_id}.json → {session_id}.json.bak
3. Rename {session_id}.json.tmp → {session_id}.json
4. Keep .bak for recovery
```

This ensures no corruption even if process crashes mid-write.

---

## 4. Crash Recovery

### 4.1 What Can Crash

| Crash Type | Cause | Impact | Recovery |
|------------|-------|--------|----------|
| **Process crash** | OS kill, OOM | Session in memory lost | Restore from .json file |
| **Network timeout** | Gemini API slow | Review not complete | Retry from last stage |
| **File write error** | Disk full, permissions | State not saved | Restore from .bak |
| **Browser close** | User closes tab | Session interrupted | Resume from saved state |

### 4.2 Recovery Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    USER RETURNS                               │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│              CHECK FOR EXISTING SESSION                       │
│                                                               │
│  1. Look in .qmb/sessions/ for project name                  │
│  2. If found, load session state                             │
│  3. Validate state integrity (JSON parse, required fields)    │
└──────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            │                               │
    Found valid session              No session found
            │                               │
            ▼                               ▼
┌───────────────────────┐       ┌───────────────────────┐
│  SHOW RESUME PROMPT   │       │   START NEW SESSION   │
│                       │       │                       │
│  "Found session:      │       │   Normal start flow   │
│   SalesModel          │       │                       │
│   Progress: Stage C   │       └───────────────────────┘
│   Last: 10 min ago    │
│                       │
│  [Continue] [Start    │
│   over] [View saved]" │
└───────────────────────┘
            │
            ▼ (Continue)
┌──────────────────────────────────────────────────────────────┐
│               RESTORE SESSION STATE                           │
│                                                               │
│  1. Load approved_script_parts into memory                   │
│  2. Set current_stage to saved value                         │
│  3. Restore pending_tables list                              │
│  4. Show progress: "Restored! Continuing from Stage C..."    │
└──────────────────────────────────────────────────────────────┘
```

### 4.3 Corrupted State Recovery

```
IF session.json is corrupted:
    1. Try to load session.json.bak
    2. If .bak exists and valid:
        - Restore from .bak
        - Warn user: "Restored from backup, last change may be lost"
    3. If .bak also corrupted:
        - Check audit log for last known good state
        - Offer partial recovery: "Can restore up to Stage B"
    4. If all recovery fails:
        - Keep corrupted files for analysis
        - Start fresh with apology
```

---

## 5. End-to-End Operation Flow

### 5.1 Normal Flow (No Crashes)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           COMPLETE WORKFLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  USER                    SYSTEM                         FILES                │
│    │                        │                              │                 │
│    │ "Start new project"   │                              │                 │
│    │──────────────────────►│                              │                 │
│    │                        │ Create session               │                 │
│    │                        │─────────────────────────────►│ sessions/x.json │
│    │                        │ Log: session_started         │                 │
│    │                        │─────────────────────────────►│ logs/x.log     │
│    │                        │                              │                 │
│    │◄──────────────────────│ "Session created. Stage A"   │                 │
│    │                        │                              │                 │
│    │ [Approve Stage A]      │                              │                 │
│    │──────────────────────►│                              │                 │
│    │                        │ Save approved_script_parts.A │                 │
│    │                        │─────────────────────────────►│ sessions/x.json │
│    │                        │ Log: stage_approved          │                 │
│    │                        │─────────────────────────────►│ logs/x.log     │
│    │                        │ Audit: stage_a_approved      │                 │
│    │                        │─────────────────────────────►│ audit/x.audit  │
│    │                        │                              │                 │
│    │◄──────────────────────│ "Stage A done. Building B..."│                 │
│    │                        │                              │                 │
│    │        ... stages B, C, D, E ...                      │                 │
│    │                        │                              │                 │
│    │ [Approve Stage F]      │                              │                 │
│    │──────────────────────►│                              │                 │
│    │                        │ Send to Gemini for review    │                 │
│    │                        │────────────────────────────► │ (API call)     │
│    │                        │ ◄────────────────────────────│                 │
│    │                        │ Log: gemini_review_complete  │                 │
│    │                        │─────────────────────────────►│ logs/x.log     │
│    │                        │ Save model.json + script.qvs │                 │
│    │                        │─────────────────────────────►│ stage2_output/ │
│    │                        │ Audit: script_approved       │                 │
│    │                        │─────────────────────────────►│ audit/x.audit  │
│    │                        │                              │                 │
│    │◄──────────────────────│ "✅ Complete! Score: 95/100" │                 │
│    │                        │                              │                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Crash During Stage C

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CRASH RECOVERY SCENARIO                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  BEFORE CRASH:                                                               │
│    - Stages A, B approved and saved                                         │
│    - Stage C being built                                                     │
│    - Process crashes (OOM, network, user closes)                            │
│                                                                              │
│  STATE ON DISK:                                                              │
│    sessions/abc.json: {                                                      │
│      current_stage: "C",                                                     │
│      completed_stages: ["A", "B"],                                           │
│      approved_script_parts: { A: "...", B: "..." }  ← B is saved!           │
│    }                                                                         │
│                                                                              │
│  USER RETURNS:                                                               │
│    │                                                                         │
│    │ (Opens Claude Code)                                                    │
│    │──────────────────────►│                                                │
│    │                        │ Check .qmb/sessions/                          │
│    │                        │ Found: abc.json                               │
│    │                        │                                                │
│    │◄──────────────────────│ "Found saved session:                         │
│    │                        │  Project: SalesModel                          │
│    │                        │  Progress: Stage C (2/6 done)                 │
│    │                        │  Last saved: 10 minutes ago                   │
│    │                        │                                                │
│    │                        │  [Continue] [Start over] [View]"              │
│    │                        │                                                │
│    │ [Continue]             │                                                │
│    │──────────────────────►│                                                │
│    │                        │ Load state from disk                          │
│    │                        │ Restore A, B scripts to memory                │
│    │                        │ Log: session_resumed                          │
│    │                        │                                                │
│    │◄──────────────────────│ "✓ Restored! A, B already done.               │
│    │                        │  Continuing from Stage C..."                  │
│    │                        │                                                │
│    │                        │ (Rebuilds Stage C from scratch)               │
│    │                        │                                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Component Responsibilities

| Component | Saves | Reads | Recovery Role |
|-----------|-------|-------|---------------|
| **Logger** | .qmb/logs/*.log | - | Provides debug info for crash analysis |
| **Session Manager** | .qmb/sessions/*.json | .qmb/sessions/*.json | Core recovery - saves/loads state |
| **Orchestrator** | (delegates to SM) | (delegates to SM) | Coordinates recovery flow |
| **MCP Handlers** | - | - | Exposes `qmb_resume_session` tool |

---

## 7. Recovery Commands (MCP Tools)

### 7.1 List Saved Sessions

```
Tool: qmb_list_sessions

Response:
┌────────────────────────────────────────────────────────────┐
│ Found 2 saved sessions:                                     │
│                                                             │
│ 1. SalesModel                                              │
│    ID: abc-123-xyz                                         │
│    Progress: Stage C (33%)                                 │
│    Last saved: 10 minutes ago                              │
│                                                             │
│ 2. InventoryModel                                          │
│    ID: def-456-uvw                                         │
│    Progress: Stage F (100%, pending review)                │
│    Last saved: 2 days ago                                  │
└────────────────────────────────────────────────────────────┘
```

### 7.2 Resume Session

```
Tool: qmb_resume_session
Input: { session_id: "abc-123-xyz" }

Response:
┌────────────────────────────────────────────────────────────┐
│ ✓ Session restored: SalesModel                             │
│                                                             │
│ Progress recovered:                                         │
│ ✅ Stage A: Configuration (approved)                        │
│ ✅ Stage B: Dimensions - 3 tables (approved)                │
│ ○ Stage C: Facts - ready to build                          │
│ ○ Stage D-F: Pending                                       │
│                                                             │
│ Continuing from Stage C...                                  │
└────────────────────────────────────────────────────────────┘
```

### 7.3 Export Session (for Backup)

```
Tool: qmb_export_session
Input: { session_id: "abc-123-xyz" }

Response: Full session JSON (can be saved externally)
```

---

## 8. Monitoring & Alerts

### 8.1 Health Checks

| Check | Frequency | Alert Trigger |
|-------|-----------|---------------|
| Disk space | Every flush | <500MB free |
| Log file size | Every 100 logs | >10MB single file |
| Session age | On access | >7 days since last update |
| Gemini failures | Per request | >3 consecutive failures |

### 8.2 Alert Actions

```typescript
// Example: Low disk space
if (diskSpace < 500_000_000) {
  logger.warn('system', 'low_disk_space', { available: diskSpace });
  // Auto-rotate logs aggressively
  rotateLogs({ keepLast: 2 });
  // Notify user
  notifyUser('Disk space low. Old logs rotated.');
}
```

---

## 9. Data Retention

| Data Type | Retention | Cleanup |
|-----------|-----------|---------|
| Active session | Until completed or 30 days | Auto-archive after 30 days inactive |
| Session logs | 7 days after session complete | Auto-delete |
| Audit logs | 90 days | Archive to compressed file |
| Completed output | Permanent | User manages |

---

## 10. Summary: What Happens When...

### Q: Process crashes mid-stage?
**A:** State was saved at last approved stage. Resume picks up from there. Work-in-progress on current stage is lost and rebuilt.

### Q: Gemini API times out?
**A:** Automatic retry with exponential backoff (3 attempts). If all fail, save state and notify user. User can retry later.

### Q: Disk is full?
**A:** Logger detects and rotates old logs. Session save fails gracefully with warning. User prompted to free space.

### Q: User closes browser accidentally?
**A:** Same as crash - state is saved. User sees "Resume?" prompt next time.

### Q: Corrupted session file?
**A:** Automatic fallback to .bak file. If both corrupted, partial recovery from audit log or start fresh with apology.

---

## Risk Mitigation & Contingency

| Risk | Impact (days) | Probability | Contingency | Trigger |
|------|--------------|-------------|-------------|---------|
| Session file corruption during crash | 1 | Medium (30%) | Automatic .bak file fallback; audit log partial recovery | JSON parse fails on session load |
| Log files fill disk completely | 0.5 | Low (15%) | Auto-rotation at 10MB; aggressive rotation at <500MB free; alert user | Disk space <500MB or write fails |
| Gemini API unavailable for >1 hour | 2 | Low (10%) | Cache last successful review; allow manual approval bypass; queue for retry | 3 consecutive API failures |
| Multiple concurrent sessions corrupt shared state | 1 | Low (15%) | Session isolation via unique IDs; file locking on write; detect conflicts | Two sessions write same file |
| Recovery flow confuses user (data loss perception) | 0.5 | Medium (25%) | Clear messaging showing exactly what was saved; "View saved state" option before deciding | User reports confusion or data loss |
| Audit trail incomplete for compliance audit | 2 | Medium (35%) | Immediate writes (not buffered); backup audit to separate location; integrity checksums | Missing audit entries detected |

## Task Breakdown & Dependencies

| Task | Duration | Dependencies | Critical Path | DoD |
|------|----------|--------------|---------------|-----|
| 0.1 Design file system structure | 0.5 day | None | YES | ✓ All directories documented, ✓ Naming conventions defined, ✓ .gitignore updated |
| 0.2 Implement atomic write strategy | 0.5 day | 0.1 | YES | ✓ tmp→bak→final rename sequence works, ✓ Crash mid-write recovers from .bak, ✓ Unit tests pass |
| 0.3 Implement session state save/load | 1 day | 0.2 | YES | ✓ State serializes/deserializes correctly, ✓ All fields persisted, ✓ Version field included |
| 0.4 Implement recovery detection flow | 0.5 day | 0.3 | YES | ✓ Detects existing sessions on start, ✓ Shows resume prompt, ✓ Handles corrupted files gracefully |
| 0.5 Implement log rotation | 0.5 day | Sub-Plan 02 | NO | ✓ Rotates at 10MB, ✓ Keeps last 5 files, ✓ Works during high log volume |
| 0.6 Implement audit trail persistence | 0.5 day | Sub-Plan 02 | NO | ✓ Immediate write (not buffered), ✓ Includes all approval events, ✓ SHA256 hash of scripts |
| 0.7 Implement MCP recovery tools | 0.5 day | 0.4, Sub-Plan 10 | NO | ✓ qmb_list_sessions works, ✓ qmb_resume_session restores state, ✓ qmb_export_session exports JSON |
| 0.8 Integration testing | 1 day | 0.1-0.7 | YES | ✓ Full crash/recovery cycle tested, ✓ All scenarios in section 10 verified, ✓ No data loss in any test |
| 0.9 Documentation and runbook | 0.5 day | 0.8 | NO | ✓ User-facing docs for recovery, ✓ Troubleshooting guide, ✓ Examples for all MCP tools |

**Critical Path:** 0.1 → 0.2 → 0.3 → 0.4 → 0.8 (3.5 days)

## Resource Requirements

| Resource | Type | Availability | Skills Required |
|----------|------|--------------|-----------------|
| TypeScript Developer | Human | 1 FTE for 4 days | Node.js fs module, async file operations, JSON serialization, error handling |
| Node.js runtime | Tool | Available | N/A |
| File system with write access | Infrastructure | Available | .qmb directory creation permissions |
| Test fixtures | Data | Create during 0.8 | Sample session states, corrupted JSON files, large log files |
| Disk space monitoring tool | Tool | Node.js fs.statfs | N/A |

## Testing Strategy

| Phase | Coverage | Tools | Acceptance Criteria | Rollback Plan |
|-------|----------|-------|---------------------|---------------|
| Unit Testing | Atomic write, state serialization | Jest, mock-fs | 100% of save/load paths covered; corruption detected | Use in-memory state only |
| Crash Simulation | Process kill, disk full, timeout | Custom test harness | All 5 crash scenarios in section 4.1 recover correctly | Increase save frequency |
| Recovery Testing | Resume flow, .bak fallback, partial recovery | Jest, real fs | User can resume from any saved state; no silent data loss | Manual recovery instructions |
| Load Testing | 1000+ log entries, 10MB+ log files | Custom benchmark | Rotation triggers correctly; no performance degradation | Reduce log retention |
| Compliance Testing | Audit trail completeness | Manual verification | All approvals logged; timestamps accurate; hashes verifiable | Add missing audit points |

## Communication Plan

- **Daily:** Log any file system or recovery issues in dev standup; flag disk space warnings
- **Weekly:** Review recovery metrics (sessions resumed, .bak fallbacks, data loss incidents)
- **Escalation:** If any user reports data loss → P1 incident → post-mortem within 24 hours
- **Change Requests:** Changes to file structure or recovery flow require migration plan for existing sessions
- **User Communication:** Recovery prompts must be clear, non-technical, and show exactly what will be restored

---

## Gemini Review
**Date:** 2026-01-21
**Status:** ✅ APPROVED (10/10)

| Metric | Score |
|--------|-------|
| Completeness | 10/10 |
| Correctness | 10/10 |

**Review Notes:** All required sections present including Risk Mitigation, Task Breakdown with DoD, Resources, Testing Strategy, and Communication Plan.
