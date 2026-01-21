# Sub-Plan 02: Logger Service

> **Part of:** Data Model Builder (Stage 2) Implementation
> **Dependencies:** Sub-Plan 01 (Types)
> **Output:** `src/model-builder/services/logger.ts`

---

## Goal

Implement structured JSON logging service for audit trail, debugging, and compliance requirements.

## Context

From design document (section 7.4 Logging & Monitoring):
- Log levels: ERROR, WARN, INFO, DEBUG
- Structured JSON format with session_id, stage, component, action
- Session logs + audit trail for compliance
- File storage: `.qmb/logs/{session_id}.log`

## Files to Create

| File | Purpose |
|------|---------|
| `src/model-builder/services/logger.ts` | Logger implementation |
| `src/__tests__/model-builder/logger.test.ts` | Unit tests |

## Interface Design

```typescript
interface LogEntry {
  timestamp: string;      // ISO 8601
  level: LogLevel;        // ERROR | WARN | INFO | DEBUG
  session_id: string;
  stage?: BuildStage;     // A-F
  component: string;      // e.g., 'builder_engine', 'analyzer'
  action: string;         // e.g., 'table_generated', 'review_started'
  details: Record<string, unknown>;
  user_id?: string;
}

interface AuditEntry {
  audit_type: string;     // e.g., 'script_approved', 'stage_completed'
  timestamp: string;
  session_id: string;
  user_id?: string;
  action: string;
  script_hash?: string;   // SHA256 of script content
  gemini_score?: number;
  issues_fixed?: number;
}
```

## Class Design

```typescript
class Logger {
  private sessionId: string;
  private userId?: string;
  private logBuffer: LogEntry[];
  private logDir: string;

  constructor(sessionId: string, userId?: string, logDir?: string);

  // Log methods
  error(component: string, action: string, details: Record<string, unknown>, stage?: BuildStage): LogEntry;
  warn(component: string, action: string, details: Record<string, unknown>, stage?: BuildStage): LogEntry;
  info(component: string, action: string, details: Record<string, unknown>, stage?: BuildStage): LogEntry;
  debug(component: string, action: string, details: Record<string, unknown>, stage?: BuildStage): LogEntry;

  // Audit trail
  audit(entry: Omit<AuditEntry, 'timestamp' | 'session_id'>): AuditEntry;

  // Buffer management
  flush(): void;           // Write buffer to file
  getBuffer(): LogEntry[]; // Get in-memory logs
}

function createLogger(sessionId: string, userId?: string): Logger;
```

## Implementation Steps

### Step 1: Write failing test

```typescript
describe('Logger', () => {
  it('should create log entry with correct structure');
  it('should include timestamp in ISO format');
  it('should include session_id in all entries');
  it('should buffer logs until flush');
  it('should create audit entries with script hash');
});
```

### Step 2: Implement Logger class

Key implementation details:
1. Use `new Date().toISOString()` for timestamps
2. Buffer logs in memory, flush to file periodically
3. Audit entries written immediately (compliance)
4. Support for log rotation (max file size)

### Step 3: Add file persistence

```typescript
private persistToFile(entries: LogEntry[]): void {
  const logPath = path.join(this.logDir, `${this.sessionId}.log`);
  const lines = entries.map(e => JSON.stringify(e)).join('\n');
  fs.appendFileSync(logPath, lines + '\n');
}
```

## Log Categories

| Category | Events to Log |
|----------|---------------|
| Session | start, resume, complete, abandon |
| Stages | enter, approve, reject, edit |
| AI Calls | request/response, tokens used |
| Errors | all errors with stack trace |
| User Actions | approve, edit, add/remove field |
| Script | generated hash, validation results |

## Potential Failure Points

1. **File system permissions** - Can't write to .qmb/logs directory
2. **Disk space** - Log files grow too large
3. **Buffer overflow** - Too many logs in memory before flush
4. **Timestamp inconsistency** - Server time vs local time
5. **Sensitive data in logs** - Accidentally logging API keys or passwords

## Mitigation Strategies

1. Create directory if not exists with proper permissions
2. Implement log rotation (max 10MB per file)
3. Auto-flush every 100 entries or 30 seconds
4. Always use UTC timestamps
5. Sanitize details object before logging (redact sensitive fields)

## Test Plan

```typescript
describe('Logger', () => {
  describe('log creation', () => {
    it('should create entry with all required fields');
    it('should include optional stage when provided');
    it('should use correct log level');
  });

  describe('buffer management', () => {
    it('should buffer logs until flush');
    it('should clear buffer after flush');
    it('should auto-flush at 100 entries');
  });

  describe('audit trail', () => {
    it('should create audit entry immediately');
    it('should calculate script hash');
    it('should include compliance fields');
  });

  describe('file persistence', () => {
    it('should create log directory if not exists');
    it('should append to existing log file');
    it('should handle rotation when file too large');
  });
});
```

## Error Handling Strategy

| Error Type | Possible Cause | Handling Approach | Recovery |
|------------|----------------|-------------------|----------|
| `EACCES` | No write permission to log directory | Log to console as fallback, warn user | Create directory with proper permissions |
| `ENOSPC` | Disk full | Flush buffer, rotate old logs, alert user | Clear old log files, reduce log level |
| `EMFILE` | Too many open file handles | Use single file handle, batch writes | Close unused handles, increase ulimit |
| `ENAMETOOLONG` | Session ID too long for filename | Truncate/hash long session IDs | Use shorter session ID format |
| Buffer Overflow | Too many logs before flush | Auto-flush at threshold (100 entries) | Increase flush frequency |
| JSON Serialization | Circular references in details | Use safe-stringify with depth limit | Remove circular refs before logging |
| Timestamp Error | Invalid date/timezone | Always use UTC, handle invalid dates | Default to current time |

**Error Recovery Flow:**
```
1. Catch error in log/audit method
2. Attempt fallback (console output)
3. Store error count in memory
4. If errors > 5 in 1 minute → disable file logging, warn user
5. Retry file logging after 5 minutes
```

## Performance Considerations

| Operation | Time Complexity | Space Complexity | Notes |
|-----------|-----------------|------------------|-------|
| `log()` | O(1) | O(n) per entry | Append to buffer only |
| `flush()` | O(n) | O(1) | n = buffer size, sequential write |
| `audit()` | O(1) | O(1) | Immediate write, small payload |
| `getBuffer()` | O(1) | O(n) | Returns reference, not copy |
| Script hash (SHA256) | O(n) | O(1) | n = script length |

**Memory Usage:**
- Buffer: ~1KB per log entry (average)
- Max buffer size: 100 entries = ~100KB
- Audit entries: Immediate write, no buffer impact

**Optimization Tips:**
1. Use `appendFileSync` for audit (guaranteed write)
2. Use `appendFile` (async) for regular logs
3. Batch log rotation checks (every 100 flushes)
4. Lazy-load crypto module for hashing
5. Use string concatenation over template literals for hot paths

**Log Rotation Strategy:**
- Max file size: 10MB per session log
- Rotate: `{session_id}.log` → `{session_id}.log.1`
- Keep: Last 5 rotated files
- Check: Every flush, not every log

## Integration Points

| Component | Direction | Data Exchange | Contract |
|-----------|-----------|---------------|----------|
| Session Manager | Logger ← SM | `session_id`, `user_id` | Logger created per session |
| All Services | Logger ← * | Log entries | `log(level, component, action, details)` |
| Orchestrator | Logger ← Orch | Audit entries | `audit(AuditEntry)` |
| File System | Logger → FS | JSON lines | `.qmb/logs/{session_id}.log` |

**Input Contract (LogEntry):**
```typescript
{
  timestamp: string;    // ISO 8601, required
  level: LogLevel;      // ERROR|WARN|INFO|DEBUG, required
  session_id: string;   // From constructor, required
  component: string;    // Caller identifier, required
  action: string;       // What happened, required
  details: object;      // Additional data, required (can be {})
  stage?: BuildStage;   // A-F, optional
}
```

**Output Contract (Log File):**
- Format: JSON Lines (one JSON object per line)
- Encoding: UTF-8
- Line ending: `\n` (Unix-style)
- File path: `.qmb/logs/{session_id}.log`

**Event Pattern:**
```
Logger does NOT emit events.
Logger is a passive sink - it receives calls, writes data.
No callbacks or event listeners needed.
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

- [ ] All log levels implemented (ERROR, WARN, INFO, DEBUG)
- [ ] Structured JSON output
- [ ] Buffer + flush mechanism working
- [ ] Audit trail separate from regular logs
- [ ] File persistence working
- [ ] No sensitive data in logs
- [ ] Tests passing
