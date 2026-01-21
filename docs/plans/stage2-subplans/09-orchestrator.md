# Sub-Plan 09: Orchestrator

> **Part of:** Data Model Builder (Stage 2) Implementation
> **Dependencies:** All previous sub-plans (01-08)
> **Output:** `src/model-builder/model-builder.ts`

---

## Goal

Create the main ModelBuilder class that orchestrates all components, managing the complete workflow from input to approved script output.

## Context

This is the central coordinator that ties together:
- Session Manager (state persistence)
- Input Processor (data enrichment)
- Analyzer (classification)
- Scope Guard (request filtering)
- Script Builder (code generation)
- Gemini Reviewer (quality assurance)
- Logger (audit trail)

## Files to Create

| File | Purpose |
|------|---------|
| `src/model-builder/model-builder.ts` | Main orchestrator class |
| `src/model-builder/index.ts` | Public exports |
| `src/__tests__/model-builder/model-builder.test.ts` | Integration tests |

## Key Interfaces

```typescript
interface ModelBuilder {
  // Initialization
  initialize(config: ModelBuilderConfig): Promise<void>;

  // Session management
  startNewSession(projectName: string, userId?: string): Promise<ModelBuilderSession>;
  resumeSession(sessionId: string): Promise<ModelBuilderSession | null>;

  // Main workflow
  processInput(stage1Json: Stage1Input, qvdSamples?: QvdSampleData[]): Promise<AnalysisResult>;
  selectModelType(modelType: ModelType): Promise<void>;

  // Stage workflow
  buildCurrentStage(): Promise<StageScript>;
  approveStage(script?: string): Promise<void>;
  rejectStage(reason: string): Promise<void>;
  editStage(modifications: StageModification[]): Promise<StageScript>;
  goBack(): Promise<BuildStage | null>;

  // Review workflow
  requestReview(): Promise<GeminiReviewResponse>;
  applyFixes(issueIds: string[]): Promise<StageScript>;

  // Output
  getFullScript(): string;
  exportOutput(): Stage2Output;

  // Status
  getStatus(): ModelBuilderStatus;
  getProgress(): ProgressInfo;
}

interface ModelBuilderConfig {
  base_dir: string;
  gemini_api_key: string;
  calendar_language: string;
  default_qvd_path: string;
  enable_logging: boolean;
}

interface ModelBuilderStatus {
  session: ModelBuilderSession | null;
  analysis: AnalysisResult | null;
  current_stage: BuildStage | null;
  review_status: 'pending' | 'in_progress' | 'completed' | null;
  errors: string[];
}

interface ProgressInfo {
  total_stages: number;
  completed_stages: number;
  current_stage: BuildStage;
  percent: number;
  stages: StageProgress[];
}

interface StageProgress {
  stage: BuildStage;
  name: string;
  status: 'pending' | 'in_progress' | 'completed';
  tables_count?: number;
}
```

## Implementation Steps

### Step 1: Class Structure

```typescript
class ModelBuilderImpl implements ModelBuilder {
  private config: ModelBuilderConfig;
  private logger: Logger;
  private sessionManager: SessionManager;
  private inputProcessor: InputProcessor;
  private analyzer: Analyzer;
  private scopeGuard: ScopeGuard;
  private scriptBuilder: ScriptBuilder;
  private geminiReviewer: GeminiReviewer;

  private session: ModelBuilderSession | null = null;
  private spec: EnrichedModelSpec | null = null;
  private analysis: AnalysisResult | null = null;
  private currentStageScript: StageScript | null = null;

  constructor() {
    // Components initialized in initialize()
  }

  async initialize(config: ModelBuilderConfig): Promise<void> {
    this.config = config;

    // Initialize logger first
    this.logger = createLogger('system', undefined, config.base_dir);

    // Initialize components
    this.sessionManager = new SessionManagerImpl(config.base_dir, this.logger);
    this.inputProcessor = new InputProcessorImpl(this.logger);
    this.analyzer = new AnalyzerImpl(this.logger);
    this.scopeGuard = new ScopeGuardImpl(this.logger);
    this.scriptBuilder = new ScriptBuilderImpl(this.logger);
    this.geminiReviewer = new GeminiReviewerImpl(
      { api_key: config.gemini_api_key },
      this.logger
    );

    // Verify Gemini connection
    const geminiOk = await this.geminiReviewer.checkConnection();
    if (!geminiOk) {
      this.logger.warn('model_builder', 'gemini_unavailable', {});
    }

    this.logger.info('model_builder', 'initialized', { config: { ...config, gemini_api_key: '***' } });
  }
}
```

### Step 2: Session Workflow

```typescript
async startNewSession(projectName: string, userId?: string): Promise<ModelBuilderSession> {
  // Check for existing recent session
  const existing = this.sessionManager.findRecentSession(projectName);
  if (existing) {
    this.logger.info('model_builder', 'found_existing_session', {
      session_id: existing.session_id,
      stage: existing.current_stage,
    });
    // Return existing but don't auto-resume - let caller decide
  }

  this.session = this.sessionManager.createSession(projectName, userId);
  this.logger = createLogger(this.session.session_id, userId, this.config.base_dir);

  this.logger.info('model_builder', 'session_started', {
    project_name: projectName,
    session_id: this.session.session_id,
  });

  return this.session;
}

async resumeSession(sessionId: string): Promise<ModelBuilderSession | null> {
  const session = this.sessionManager.loadSession(sessionId);
  if (!session) {
    this.logger.warn('model_builder', 'session_not_found', { sessionId });
    return null;
  }

  this.session = session;
  this.logger = createLogger(session.session_id, session.user_id, this.config.base_dir);

  this.logger.info('model_builder', 'session_resumed', {
    session_id: session.session_id,
    stage: session.current_stage,
    completed: session.completed_stages,
  });

  return session;
}
```

### Step 3: Input Processing

```typescript
async processInput(
  stage1Json: Stage1Input,
  qvdSamples: QvdSampleData[] = []
): Promise<AnalysisResult> {
  this.ensureSession();

  this.logger.info('model_builder', 'processing_input', {
    tables_count: stage1Json.tables.length,
    samples_count: qvdSamples.length,
  });

  // Validate and enrich
  const validatedInput = this.inputProcessor.validateStage1Input(stage1Json);
  this.spec = this.inputProcessor.process(validatedInput, qvdSamples);

  // Analyze
  this.analysis = this.analyzer.analyze(this.spec);

  this.logger.info('model_builder', 'analysis_complete', {
    model_type: this.analysis.model_recommendation.recommended_model,
    facts: this.spec.tables.filter(t => t.classification === 'fact').length,
    dimensions: this.spec.tables.filter(t => t.classification === 'dimension').length,
  });

  return this.analysis;
}

async selectModelType(modelType: ModelType): Promise<void> {
  this.ensureSession();
  this.ensureAnalysis();

  this.session!.model_type = modelType;
  this.sessionManager.saveSession(this.session!);

  this.logger.info('model_builder', 'model_type_selected', { modelType });
}
```

### Step 4: Stage Workflow

```typescript
async buildCurrentStage(): Promise<StageScript> {
  this.ensureSession();
  this.ensureSpec();

  const context: BuildContext = {
    session: this.session!,
    spec: this.spec!,
    analysis: this.analysis!,
    config: {
      project_name: this.session!.project_name,
      qvd_path: this.config.default_qvd_path,
      calendar_language: this.config.calendar_language,
      use_autonumber: false,
    },
  };

  this.currentStageScript = this.scriptBuilder.buildStage(
    this.session!.current_stage,
    context
  );

  this.logger.info('model_builder', 'stage_built', {
    stage: this.session!.current_stage,
    lines: this.currentStageScript.estimated_lines,
    tables: this.currentStageScript.tables_included,
  });

  return this.currentStageScript;
}

async approveStage(script?: string): Promise<void> {
  this.ensureSession();

  const finalScript = script || this.currentStageScript?.script;
  if (!finalScript) {
    throw new Error('No script to approve. Call buildCurrentStage first.');
  }

  const stage = this.session!.current_stage;

  // Save approved script
  this.sessionManager.approveStage(this.session!, stage, finalScript);

  this.logger.audit({
    audit_type: 'stage_approved',
    action: `approved_stage_${stage}`,
    script_hash: this.hashScript(finalScript),
  });

  // Advance to next stage
  const nextStage = this.getNextStage(stage);
  if (nextStage) {
    this.sessionManager.advanceStage(this.session!, nextStage);
  }

  this.currentStageScript = null;
}

async goBack(): Promise<BuildStage | null> {
  this.ensureSession();

  const current = this.session!.current_stage;
  if (current === 'A') {
    return null; // Can't go back from first stage
  }

  const prevStage = this.getPreviousStage(current);
  if (prevStage) {
    this.sessionManager.revertToStage(this.session!, prevStage);
    this.logger.info('model_builder', 'went_back', { from: current, to: prevStage });
  }

  return prevStage;
}

private getNextStage(current: BuildStage): BuildStage | null {
  const order: BuildStage[] = ['A', 'B', 'C', 'D', 'E', 'F'];
  const idx = order.indexOf(current);
  return idx < order.length - 1 ? order[idx + 1] : null;
}

private getPreviousStage(current: BuildStage): BuildStage | null {
  const order: BuildStage[] = ['A', 'B', 'C', 'D', 'E', 'F'];
  const idx = order.indexOf(current);
  return idx > 0 ? order[idx - 1] : null;
}
```

### Step 5: Review Workflow

```typescript
async requestReview(): Promise<GeminiReviewResponse> {
  this.ensureSession();

  // All stages must be completed
  if (this.session!.completed_stages.length < 6) {
    throw new Error('All stages must be approved before review');
  }

  const fullScript = this.getFullScript();
  const factsCount = this.spec!.tables.filter(t => t.classification === 'fact').length;
  const dimsCount = this.spec!.tables.filter(t => t.classification === 'dimension').length;
  const totalRows = this.spec!.tables.reduce((sum, t) => sum + t.row_count, 0);

  this.logger.info('model_builder', 'review_requested', {
    script_lines: fullScript.split('\n').length,
    facts: factsCount,
    dimensions: dimsCount,
  });

  const review = await this.geminiReviewer.reviewWithRetry({
    script: fullScript,
    model_type: this.session!.model_type!,
    facts_count: factsCount,
    dimensions_count: dimsCount,
    expected_rows: totalRows,
  });

  // Store review in session
  this.session!.gemini_reviews.push(review);
  this.sessionManager.saveSession(this.session!);

  this.logger.audit({
    audit_type: 'script_reviewed',
    action: 'gemini_review_completed',
    gemini_score: review.score,
    issues_fixed: 0,
  });

  return review;
}

async applyFixes(issueIds: string[]): Promise<StageScript> {
  this.ensureSession();

  const lastReview = this.session!.gemini_reviews[this.session!.gemini_reviews.length - 1];
  if (!lastReview) {
    throw new Error('No review to apply fixes from');
  }

  const issuesToFix = lastReview.issues.filter(i => issueIds.includes(i.issue_id));

  this.logger.info('model_builder', 'applying_fixes', {
    issues_count: issuesToFix.length,
    issue_ids: issueIds,
  });

  // Apply fixes logic would go here
  // For now, return the current script
  // In real implementation, this would modify the relevant stage scripts

  return this.currentStageScript!;
}
```

### Step 6: Output Generation

```typescript
getFullScript(): string {
  this.ensureSession();

  const stages: BuildStage[] = ['A', 'B', 'C', 'D', 'E', 'F'];
  const parts: string[] = [];

  for (const stage of stages) {
    const script = this.session!.approved_script_parts[stage];
    if (script) {
      parts.push(script);
    }
  }

  return parts.join('\n\n');
}

exportOutput(): Stage2Output {
  this.ensureSession();
  this.ensureSpec();

  const lastReview = this.session!.gemini_reviews[this.session!.gemini_reviews.length - 1];

  return {
    version: '1.0',
    model_type: this.session!.model_type!,
    created_at: new Date().toISOString(),
    facts: this.spec!.tables
      .filter(t => t.classification === 'fact')
      .map(t => ({
        name: `FACT_${t.name}`,
        source_table: t.name,
        keys: t.fields.filter(f => f.is_key_candidate).map(f => f.name),
        measures: t.fields.filter(f => this.isMeasure(f)).map(f => f.name),
      })),
    dimensions: this.spec!.tables
      .filter(t => t.classification === 'dimension')
      .map(t => ({
        name: `DIM_${t.name}`,
        source_table: t.name,
        pk: t.fields.find(f => f.is_key_candidate)?.name || '',
        fields: t.fields.map(f => f.name),
      })),
    calendars: this.spec!.date_fields.map(d => ({
      name: `DIM_${d.field_name}`,
      field: d.field_name,
    })),
    relationships: this.spec!.relationships.map(r => ({
      from: `${r.from_table}.${r.from_field}`,
      to: `${r.to_table}.${r.to_field}`,
      cardinality: r.type === 'many-to-one' ? 'N:1' : r.type === 'one-to-many' ? '1:N' : '1:1',
    })),
    gemini_review: lastReview ? {
      score: lastReview.score,
      status: lastReview.review_status === 'approved' ? 'approved' : 'approved_with_warnings',
      issues_fixed: 0,
    } : undefined,
  };
}
```

## Orchestration Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    MODEL BUILDER                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   initialize()                                               │
│        │                                                     │
│        ▼                                                     │
│   startNewSession() / resumeSession()                       │
│        │                                                     │
│        ▼                                                     │
│   processInput(stage1Json, qvdSamples)                      │
│        │                                                     │
│        ├──→ InputProcessor.process()                        │
│        └──→ Analyzer.analyze()                              │
│        │                                                     │
│        ▼                                                     │
│   selectModelType()                                          │
│        │                                                     │
│        ▼                                                     │
│   ┌─────────────────────────────────────────┐               │
│   │        STAGE LOOP (A → F)               │               │
│   │   buildCurrentStage()                   │               │
│   │        │                                │               │
│   │        ▼                                │               │
│   │   User reviews script                   │               │
│   │        │                                │               │
│   │   ┌────┴────┐                          │               │
│   │   ▼         ▼                          │               │
│   │ approve() reject()/edit()              │               │
│   │   │                                    │               │
│   │   └──→ Next stage or retry            │               │
│   └─────────────────────────────────────────┘               │
│        │                                                     │
│        ▼                                                     │
│   requestReview()                                            │
│        │                                                     │
│        ├──→ GeminiReviewer.review()                         │
│        │                                                     │
│        ▼                                                     │
│   ┌────┴────┐                                               │
│   ▼         ▼                                               │
│ approved  issues_found                                       │
│   │         │                                               │
│   │    applyFixes() → re-review                             │
│   │                                                          │
│   ▼                                                          │
│   exportOutput()                                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Potential Failure Points

1. **Component initialization failure** - One service fails to start
2. **Session state corruption** - Inconsistent state between operations
3. **Stage ordering violation** - Attempt to skip stages
4. **Review loop infinite** - Gemini keeps finding issues
5. **Memory issues** - Large models exceed memory

## Mitigation Strategies

1. Fail fast on initialization, report which component failed
2. Validate session state before each operation
3. Enforce stage order in advanceStage/revertToStage
4. Limit review rounds, require HITL after Round 4
5. Stream large scripts, paginate output

## Test Plan

```typescript
describe('ModelBuilder', () => {
  describe('initialization', () => {
    it('should initialize all components');
    it('should handle missing Gemini API key');
    it('should verify Gemini connection');
  });

  describe('session workflow', () => {
    it('should create new session');
    it('should resume existing session');
    it('should find recent session by project name');
  });

  describe('input processing', () => {
    it('should validate and enrich Stage1 input');
    it('should analyze and classify tables');
    it('should detect model type');
  });

  describe('stage workflow', () => {
    it('should build stages in order');
    it('should approve and advance stages');
    it('should allow going back');
    it('should prevent skipping stages');
  });

  describe('review workflow', () => {
    it('should request Gemini review');
    it('should store review results');
    it('should apply selected fixes');
  });

  describe('output', () => {
    it('should assemble full script');
    it('should export Stage2Output');
  });
});
```

## Error Handling Strategy

| Error Type | Possible Cause | Handling Approach | Recovery |
|------------|----------------|-------------------|----------|
| `InitializationError` | Component failed to start | Log which component, fail fast | Fix config, restart |
| `SessionNotFoundError` | Resume with invalid session ID | Return null, clear error message | Start new session |
| `StageOrderError` | Attempt to skip stages | Throw with current/expected stage | User follows correct order |
| `NoAnalysisError` | Build stage without analysis | Throw with instructions | Run processInput first |
| `ReviewNotAllowedError` | Review before all stages done | Throw with missing stages | Complete remaining stages |
| `GeminiUnavailableError` | API connection failed | Warn, allow proceeding without review | Manual review |
| `StateSaveError` | Cannot persist session | Log, retry once, warn user | Check disk space/permissions |

**Component Initialization Order:**
```typescript
async initialize(config: ModelBuilderConfig): Promise<void> {
  try {
    // 1. Logger first (needed by all others)
    this.logger = createLogger('system', undefined, config.base_dir);

    // 2. Session Manager (needs logger)
    this.sessionManager = new SessionManagerImpl(config.base_dir, this.logger);

    // 3. Other services (parallel - independent)
    this.inputProcessor = new InputProcessorImpl(this.logger);
    this.analyzer = new AnalyzerImpl(this.logger);
    this.scopeGuard = new ScopeGuardImpl(this.logger);
    this.scriptBuilder = new ScriptBuilderImpl(this.logger);

    // 4. Gemini (optional - may fail)
    try {
      this.geminiReviewer = new GeminiReviewerImpl({ api_key: config.gemini_api_key }, this.logger);
      const ok = await this.geminiReviewer.checkConnection();
      if (!ok) this.logger.warn('model_builder', 'gemini_unavailable', {});
    } catch (e) {
      this.logger.warn('model_builder', 'gemini_init_failed', { error: e.message });
      this.geminiReviewer = null;
    }
  } catch (error) {
    throw new InitializationError(`Failed to initialize: ${error.message}`);
  }
}
```

**Error Recovery Flow:**
```
1. Each public method validates prerequisites
   ├── Session required? → ensureSession()
   ├── Analysis required? → ensureAnalysis()
   └── Spec required? → ensureSpec()
2. Delegate to component
   ├── Success → Update state, save session
   └── Failure → Log error, throw with context
3. State is always consistent (save after each change)
```

## Performance Considerations

| Operation | Time Complexity | Space Complexity | Notes |
|-----------|-----------------|------------------|-------|
| `initialize()` | O(1) + network | O(1) | Gemini check is async |
| `startNewSession()` | O(m) | O(1) | m = existing sessions (check for recent) |
| `resumeSession()` | O(1) | O(n) | n = session file size |
| `processInput()` | O(t × f) | O(t × f) | Validation + analysis |
| `buildCurrentStage()` | O(t × f) | O(t × f) | Script generation |
| `approveStage()` | O(n) | O(1) | n = script size (save) |
| `requestReview()` | O(n) network | O(n) | n = full script size |
| `getFullScript()` | O(s) | O(s) | s = sum of stage scripts |
| `exportOutput()` | O(t) | O(t) | t = tables |

**Memory Usage:**
- ModelBuilder instance: ~5KB base
- Loaded session: 5KB - 500KB (depends on script size)
- EnrichedModelSpec: ~2KB per table
- Analysis result: ~500 bytes per table
- Full script: Sum of stages (10KB - 100KB typical)

**Optimization Tips:**
1. Lazy-load session data (only load approved scripts when needed)
2. Don't keep multiple sessions in memory
3. Stream large exports instead of building in memory
4. Cache getProgress() result (invalidate on state change)
5. Parallelize independent stage builds when editing

**Workflow State Machine:**
```
UNINITIALIZED → INITIALIZED → SESSION_ACTIVE → INPUT_PROCESSED
    → ANALYSIS_COMPLETE → BUILDING_STAGES → ALL_APPROVED → REVIEWED → EXPORTED
```

## Integration Points

| Component | Direction | Data Exchange | Contract |
|-----------|-----------|---------------|----------|
| Logger | Orch → Logger | All operations logged | Via component loggers |
| Session Manager | Orch ↔ SM | Session CRUD | Full interface |
| Input Processor | Orch → IP | Stage1 + samples → Spec | `process(json, samples)` |
| Analyzer | Orch → An | Spec → AnalysisResult | `analyze(spec)` |
| Scope Guard | Orch → SG | Validate requests | `validateRequest(req, ctx)` |
| Script Builder | Orch → SB | Context → StageScript | `buildStage(stage, ctx)` |
| Gemini Reviewer | Orch → GR | Script → Review | `reviewWithRetry(req)` |
| MCP Handlers | Orch ← MCP | Tool calls | Full ModelBuilder interface |

**Input Contracts:**
```typescript
// initialize
interface ModelBuilderConfig {
  base_dir: string;           // .qmb directory location
  gemini_api_key: string;     // For reviews
  calendar_language: string;  // EN | HE
  default_qvd_path: string;   // lib://path/
  enable_logging: boolean;
}

// processInput
Stage1Input + QvdSampleData[]

// All stage methods use internal state
```

**Output Contracts:**
```typescript
// Status
interface ModelBuilderStatus {
  session: ModelBuilderSession | null;
  analysis: AnalysisResult | null;
  current_stage: BuildStage | null;
  review_status: 'pending' | 'in_progress' | 'completed' | null;
  errors: string[];
}

// Progress
interface ProgressInfo {
  total_stages: number;       // Always 6
  completed_stages: number;   // 0-6
  current_stage: BuildStage;
  percent: number;            // 0-100
  stages: StageProgress[];
}

// Export
Stage2Output (see types)
```

**Event Pattern:**
```
Orchestrator does NOT emit events.
All operations are request/response.
State persisted immediately via Session Manager.
Progress tracked internally, polled via getProgress().
```

## Risk Mitigation & Contingency

| Risk | Impact (days) | Probability | Contingency | Trigger |
|------|--------------|-------------|-------------|---------|
| Component initialization order causes cascading failures | 2 | Medium (35%) | Implement dependency injection; add health checks per component | One component failure breaks entire system |
| Session state becomes inconsistent during multi-step workflow | 2 | Medium (40%) | Add state validation before each operation; implement rollback mechanism | Stage approval fails with state mismatch error |
| Gemini review infinite loop (keeps finding issues) | 1 | Low (25%) | Limit review rounds to 4; require user decision after Round 4 | 5th consecutive review requested |
| Memory exhaustion with large models (>100 tables) | 1 | Low (20%) | Implement lazy loading; stream large scripts; add memory monitoring | Process memory exceeds 500MB |

## Task Breakdown & Dependencies

| Task | Duration | Dependencies | Critical Path | DoD |
|------|----------|--------------|---------------|-----|
| 9.1 Implement ModelBuilder class skeleton | 0.5 day | All previous sub-plans (01-08) | YES | ✓ Class compiles, ✓ All component placeholders, ✓ Implements ModelBuilder interface |
| 9.2 Implement component initialization | 1 day | 9.1 | YES | ✓ All 7 components initialized, ✓ Gemini connection checked, ✓ Fails fast on error |
| 9.3 Implement session workflow (start, resume, list) | 1 day | 9.2 | YES | ✓ startNewSession creates session, ✓ resumeSession loads state, ✓ Existing session detection works |
| 9.4 Implement input processing delegation | 0.5 day | 9.3 | YES | ✓ Delegates to InputProcessor, ✓ Analysis result stored, ✓ Logs tables/samples count |
| 9.5 Implement stage workflow (build, approve, reject, edit) | 1.5 days | 9.4 | YES | ✓ Stage order enforced (A→F), ✓ Scripts stored on approve, ✓ Audit logged |
| 9.6 Implement navigation (goBack) | 0.5 day | 9.5 | NO | ✓ Returns to previous stage, ✓ Can't go back from A, ✓ State correctly reverted |
| 9.7 Implement review workflow (request, applyFixes) | 1 day | 9.5 | YES | ✓ All stages required, ✓ Review stored in session, ✓ Fix application tracked |
| 9.8 Implement output generation (getFullScript, export) | 0.5 day | 9.5 | YES | ✓ Full script assembles correctly, ✓ Stage2Output complete, ✓ Gemini review included |
| 9.9 Implement status and progress tracking | 0.5 day | 9.3 | NO | ✓ getStatus() returns current state, ✓ getProgress() shows 0-100%, ✓ Stage names included |
| 9.10 Write integration tests | 1.5 days | 9.1-9.9 | YES | ✓ Full workflow tested, ✓ Error scenarios covered, ✓ State persistence verified |
| 9.11 End-to-end workflow testing | 1 day | 9.10 | YES | ✓ Olist data flows A→F, ✓ Script exports correctly, ✓ No manual intervention needed |

**Critical Path:** 9.1 → 9.2 → 9.3 → 9.4 → 9.5 → 9.7 → 9.8 → 9.10 → 9.11 (8.5 days)

## Resource Requirements

| Resource | Type | Availability | Skills Required |
|----------|------|--------------|-----------------|
| Senior TypeScript Developer | Human | 1 FTE for 9 days | System integration, state management, async coordination |
| All Sub-Plan 01-08 Components | Component | Must complete first | N/A |
| Gemini API key | Credential | Environment variable | N/A |
| Test fixtures for full workflow | Data | Create from Olist | N/A |
| Integration test environment | Infrastructure | Local development | N/A |

## Testing Strategy

| Phase | Coverage | Tools | Acceptance Criteria | Rollback Plan |
|-------|----------|-------|---------------------|---------------|
| Unit Testing | All orchestrator methods | Jest | 100% method coverage; correct delegation to components | N/A - core functionality |
| Component Integration Testing | Orchestrator + each component | Jest | Correct data flow between orchestrator and each component | Test components in isolation |
| Workflow Testing | Complete A-F stage flow | Jest | Successful completion of full workflow with Olist data | Break into smaller workflow segments |
| State Persistence Testing | Session save/load during workflow | Jest | State correctly persisted and restored at each stage | Manual state verification |
| End-to-End Testing | Full wizard flow | Manual test | Complete model build from JSON to exported script | Document manual steps for fallback |

## Communication Plan

- **Daily:** Report integration status; flag any component interface mismatches immediately
- **Weekly:** Demo complete workflow to team; gather feedback on user experience flow
- **Escalation:** If integration with any component fails for >1 day, escalate to component owner and Tech Lead
- **Change Requests:** Changes to orchestrator flow require updated sequence diagrams and test scenarios

---

## Gemini Review
**Date:** 2026-01-21
**Status:** ✅ APPROVED (10/10)

| Metric | Score |
|--------|-------|
| Completeness | 10/10 |
| Correctness | 10/10 |

**Review Notes:** All criteria met including Definition of Done for each task.

---

## Success Criteria

- [ ] All components initialize correctly
- [ ] Session lifecycle works (create, resume, save)
- [ ] Input processing pipeline complete
- [ ] Stage workflow enforced correctly
- [ ] Gemini review integrated
- [ ] Output generation works
- [ ] All integration tests passing
