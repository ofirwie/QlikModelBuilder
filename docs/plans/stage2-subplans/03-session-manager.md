# Sub-Plan 03: Session Manager

> **Part of:** Data Model Builder (Stage 2) Implementation
> **Dependencies:** Sub-Plan 01 (Types), Sub-Plan 02 (Logger)
> **Output:** `src/model-builder/services/session-manager.ts`

---

## Goal

Implement session state persistence, stage tracking, and resume capability for interrupted model building workflows.

## Context

From design document (section 7.2-7.3):
- Sessions saved at `.qmb/sessions/{session_id}.json`
- Track current stage (A-F) and completed stages
- Store approved script parts per stage
- Enable resume after disconnect/error

## Files to Create

| File | Purpose |
|------|---------|
| `src/model-builder/services/session-manager.ts` | Session management implementation |
| `src/__tests__/model-builder/session-manager.test.ts` | Unit tests |

## Key Interfaces

```typescript
interface SessionManager {
  // Session lifecycle
  createSession(projectName: string, userId?: string): ModelBuilderSession;
  loadSession(sessionId: string): ModelBuilderSession | null;
  saveSession(session: ModelBuilderSession): void;
  deleteSession(sessionId: string): void;

  // Stage management
  advanceStage(session: ModelBuilderSession, stage: BuildStage): void;
  approveStage(session: ModelBuilderSession, stage: BuildStage, script: string): void;
  revertToStage(session: ModelBuilderSession, stage: BuildStage): void;

  // Discovery
  listSessions(userId?: string): SessionSummary[];
  findRecentSession(projectName: string): ModelBuilderSession | null;

  // Cleanup
  cleanupOldSessions(maxAgeDays: number): number;
}

interface SessionSummary {
  session_id: string;
  project_name: string;
  current_stage: BuildStage;
  updated_at: string;
  progress_percent: number;
}
```

## Implementation Steps

### Step 1: Directory Management

```typescript
class SessionManagerImpl implements SessionManager {
  private sessionsDir: string;
  private logger: Logger;

  constructor(baseDir: string = '.qmb', logger?: Logger) {
    this.sessionsDir = path.join(baseDir, 'sessions');
    this.ensureDirectoryExists();
  }

  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }
}
```

### Step 2: Session Creation

```typescript
createSession(projectName: string, userId?: string): ModelBuilderSession {
  const session: ModelBuilderSession = {
    session_id: this.generateSessionId(),
    project_name: projectName,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    current_stage: 'A',
    completed_stages: [],
    model_type: null,
    approved_script_parts: {},
    pending_tables: [],
    gemini_reviews: [],
    user_id: userId,
  };

  this.saveSession(session);
  this.logger?.info('session_manager', 'session_created', { session_id: session.session_id });
  return session;
}

private generateSessionId(): string {
  return `qmb-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}
```

### Step 3: Stage Tracking

```typescript
advanceStage(session: ModelBuilderSession, stage: BuildStage): void {
  const stageOrder: BuildStage[] = ['A', 'B', 'C', 'D', 'E', 'F'];
  const currentIndex = stageOrder.indexOf(session.current_stage);
  const targetIndex = stageOrder.indexOf(stage);

  if (targetIndex !== currentIndex + 1) {
    throw new Error(`Cannot advance from ${session.current_stage} to ${stage}`);
  }

  session.current_stage = stage;
  session.updated_at = new Date().toISOString();
  this.saveSession(session);
}

approveStage(session: ModelBuilderSession, stage: BuildStage, script: string): void {
  if (!session.completed_stages.includes(stage)) {
    session.completed_stages.push(stage);
  }
  session.approved_script_parts[stage] = script;
  session.updated_at = new Date().toISOString();
  this.saveSession(session);
}
```

### Step 4: Persistence

```typescript
saveSession(session: ModelBuilderSession): void {
  const filePath = this.getSessionPath(session.session_id);
  const content = JSON.stringify(session, null, 2);
  fs.writeFileSync(filePath, content, 'utf8');
}

loadSession(sessionId: string): ModelBuilderSession | null {
  const filePath = this.getSessionPath(sessionId);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content) as ModelBuilderSession;
}

private getSessionPath(sessionId: string): string {
  return path.join(this.sessionsDir, `${sessionId}.json`);
}
```

### Step 5: Resume Flow

```typescript
findRecentSession(projectName: string): ModelBuilderSession | null {
  const sessions = this.listSessions()
    .filter(s => s.project_name === projectName)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  if (sessions.length === 0) return null;

  // Only return if session is less than 24 hours old
  const recent = sessions[0];
  const ageHours = (Date.now() - new Date(recent.updated_at).getTime()) / (1000 * 60 * 60);

  if (ageHours > 24) return null;

  return this.loadSession(recent.session_id);
}
```

## Session State Diagram

```
                    ┌─────────────────────────────────────┐
                    │         SESSION LIFECYCLE            │
                    └─────────────────────────────────────┘

    createSession()          advanceStage()           complete
         │                        │                      │
         ▼                        ▼                      ▼
    ┌─────────┐    approve   ┌─────────┐            ┌─────────┐
    │ Stage A │ ───────────→ │ Stage B │ ─ ... ─→  │ Stage F │
    └─────────┘              └─────────┘            └─────────┘
         │                        │                      │
         ▼                        ▼                      ▼
    [Save to disk]          [Save to disk]         [Save to disk]
         │                        │                      │
         └────────── Resume any time ────────────────────┘
```

## Potential Failure Points

1. **File system permissions** - Cannot write to `.qmb/sessions/`
2. **Concurrent access** - Two processes writing same session
3. **Corrupted JSON** - Session file becomes invalid
4. **Disk full** - Cannot save session
5. **Session ID collision** - Extremely unlikely but possible

## Mitigation Strategies

1. Check permissions on startup, fail fast with clear error
2. Use file locking or atomic writes (write to temp, then rename)
3. Validate JSON on load, backup before save
4. Check disk space before save, warn user
5. Include timestamp + random bytes in session ID

## Test Plan

```typescript
describe('SessionManager', () => {
  describe('createSession', () => {
    it('should create session with unique ID');
    it('should initialize at stage A');
    it('should save to disk immediately');
    it('should include project name and timestamps');
  });

  describe('loadSession', () => {
    it('should load existing session');
    it('should return null for non-existent session');
    it('should handle corrupted JSON gracefully');
  });

  describe('advanceStage', () => {
    it('should advance from A to B');
    it('should reject skip from A to C');
    it('should update timestamp on advance');
  });

  describe('approveStage', () => {
    it('should add stage to completed_stages');
    it('should store script in approved_script_parts');
    it('should not duplicate stages');
  });

  describe('findRecentSession', () => {
    it('should find session by project name');
    it('should return most recent session');
    it('should ignore sessions older than 24 hours');
  });

  describe('cleanupOldSessions', () => {
    it('should delete sessions older than specified days');
    it('should return count of deleted sessions');
  });
});
```

## Error Handling Strategy

| Error Type | Possible Cause | Handling Approach | Recovery |
|------------|----------------|-------------------|----------|
| `EACCES` | No write permission to sessions dir | Fail fast with clear error message | Request proper permissions |
| `ENOENT` | Session file not found | Return `null` from `loadSession` | Caller creates new session |
| `ENOSPC` | Disk full | Throw error, warn user | Free disk space, cleanup old sessions |
| JSON Parse Error | Corrupted session file | Backup corrupt file, return `null` | Create new session |
| Concurrent Write | Two processes saving same session | Use atomic write (temp → rename) | Last write wins |
| Stage Order Violation | Attempt to skip stages | Throw `StageOrderError` | Caller handles, shows valid options |
| Session ID Collision | Duplicate ID generated | Retry with new random bytes | Extremely rare (timestamp+random) |

**Error Recovery Flow:**
```
1. Catch error in save/load operation
2. Log error with full context
3. For load errors: return null, let caller decide
4. For save errors: attempt retry once
5. If persistent failure: throw with actionable message
```

**Atomic Write Pattern:**
```typescript
saveSession(session: ModelBuilderSession): void {
  const tempPath = `${filePath}.tmp`;
  const backupPath = `${filePath}.bak`;

  fs.writeFileSync(tempPath, JSON.stringify(session, null, 2));
  if (fs.existsSync(filePath)) {
    fs.renameSync(filePath, backupPath);  // Backup
  }
  fs.renameSync(tempPath, filePath);      // Atomic replace
}
```

## Performance Considerations

| Operation | Time Complexity | Space Complexity | Notes |
|-----------|-----------------|------------------|-------|
| `createSession()` | O(1) | O(1) | ID generation + file write |
| `loadSession()` | O(n) | O(n) | n = session file size |
| `saveSession()` | O(n) | O(1) | n = session object size |
| `listSessions()` | O(m) | O(m) | m = number of session files |
| `findRecentSession()` | O(m log m) | O(m) | Sort by date |
| `advanceStage()` | O(1) | O(1) | Update + save |
| `cleanupOldSessions()` | O(m) | O(1) | Delete files sequentially |

**Memory Usage:**
- Session object: ~5KB (average, depends on script size)
- Large scripts: Up to ~500KB per completed session
- List cache: Not cached, read on demand

**Optimization Tips:**
1. Use `readdir` with `withFileTypes` for faster listing
2. Cache `listSessions` result for 30 seconds
3. Use streaming JSON parser for very large sessions
4. Index sessions by project_name in metadata file
5. Lazy-load script parts (only when accessed)

**File System Layout:**
```
.qmb/
├── sessions/
│   ├── qmb-1234567890-abcd.json
│   ├── qmb-1234567891-efgh.json
│   └── .index.json  (optional: project→session mapping)
└── logs/
```

## Integration Points

| Component | Direction | Data Exchange | Contract |
|-----------|-----------|---------------|----------|
| Logger | SM → Logger | Log session events | `logger.info('session_manager', action, details)` |
| Orchestrator | SM ← Orch | Session CRUD operations | Full SessionManager interface |
| Script Builder | SM ← SB | Store approved scripts | `approveStage(session, stage, script)` |
| File System | SM ↔ FS | Session JSON files | `.qmb/sessions/{session_id}.json` |

**Input Contract (createSession):**
```typescript
{
  projectName: string;   // Required, user's project name
  userId?: string;       // Optional, for multi-user tracking
}
```

**Output Contract (ModelBuilderSession):**
```typescript
{
  session_id: string;           // Format: qmb-{timestamp}-{random}
  project_name: string;
  created_at: string;           // ISO 8601
  updated_at: string;           // ISO 8601
  current_stage: BuildStage;    // A-F
  completed_stages: BuildStage[];
  model_type: ModelType | null;
  approved_script_parts: Record<BuildStage, string>;
  pending_tables: string[];
  gemini_reviews: GeminiReviewResponse[];
  user_id?: string;
}
```

**Event Pattern:**
```
SessionManager does NOT emit events.
State changes are persisted immediately.
Callers poll for state via loadSession/getStatus.
```

**Session File Format:**
```json
{
  "session_id": "qmb-1234567890-abcd",
  "project_name": "SalesModel",
  "current_stage": "C",
  "completed_stages": ["A", "B"],
  "approved_script_parts": {
    "A": "QUALIFY *;\n...",
    "B": "// Dimensions\n..."
  }
}
```

## Gemini Review
**Date:** 2026-01-21
**Status:** ✅ APPROVED

| Metric | Score |
|--------|-------|
| Completeness | 9/10 |
| Correctness | 9/10 |

---

## Success Criteria

- [ ] Sessions persist across process restarts
- [ ] Stage tracking works correctly (A -> B -> C -> D -> E -> F)
- [ ] Resume flow finds and loads recent sessions
- [ ] Approved scripts stored per stage
- [ ] Cleanup removes old sessions
- [ ] All tests passing
