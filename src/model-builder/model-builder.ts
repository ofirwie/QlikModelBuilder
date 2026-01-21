/**
 * @fileoverview Main Orchestrator for Model Builder
 * @module model-builder/model-builder
 *
 * The ModelBuilder class orchestrates all Stage 2 components:
 * - SessionManager: Manages session persistence and state
 * - InputProcessor: Enriches input data with QVD samples
 * - Analyzer: Classifies tables and recommends model type
 * - ScopeGuard: Validates requests and rate limits
 * - ScriptBuilder: Generates Qlik load scripts
 * - GeminiReviewer: AI-powered script review
 * - Logger: Structured logging and auditing
 */

import {
  ModelBuilderSession,
  BuildStage,
  ModelType,
  Stage1Input,
  QvdSampleData,
  EnrichedModelSpec,
  BuildConfig,
  BuildContext,
  StageScript,
  GeminiReviewResponse,
  Stage2Output,
  FactDefinition,
  DimensionDefinition,
  CalendarDefinition,
  OutputRelationship,
} from './types.js';

import { Logger, createLogger } from './services/logger.js';
import { SessionManager, createSessionManager, SessionSummary } from './services/session-manager.js';
import { InputProcessor, createInputProcessor, ValidationError, EmptyInputError } from './services/input-processor.js';
import { Analyzer, createAnalyzer, AnalysisResult } from './services/analyzer.js';
import { ScopeGuard, createScopeGuard, ScopeValidationResult, RateLimitResult } from './services/scope-guard.js';
import { ScriptBuilder, createScriptBuilder, BuildContextError } from './services/script-builder.js';
import {
  GeminiReviewer,
  createGeminiReviewer,
  GeminiConfig,
  GeminiReviewError,
  GeminiAuthError,
  GeminiTimeoutError,
} from './services/gemini-reviewer.js';

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Base error for ModelBuilder operations
 */
export class ModelBuilderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelBuilderError';
  }
}

/**
 * Error for session-related issues
 */
export class SessionError extends ModelBuilderError {
  constructor(message: string) {
    super(message);
    this.name = 'SessionError';
  }
}

/**
 * Error for workflow violations
 */
export class WorkflowError extends ModelBuilderError {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowError';
  }
}

/**
 * Error for configuration issues
 */
export class ConfigurationError extends ModelBuilderError {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration options for ModelBuilder
 */
export interface ModelBuilderConfig {
  /** Base directory for session/log files (default: .qmb) */
  baseDir?: string;
  /** Gemini API configuration */
  geminiConfig?: GeminiConfig;
  /** Default QVD path for scripts */
  defaultQvdPath?: string;
  /** Default calendar language */
  defaultCalendarLanguage?: 'EN' | 'HE';
  /** Whether to use autonumber for link tables */
  useAutonumber?: boolean;
  /** User ID for tracking */
  userId?: string;
}

/**
 * Result of a stage build operation
 */
export interface StageBuildResult {
  success: boolean;
  stage: BuildStage;
  script?: StageScript;
  error?: string;
}

/**
 * Result of a review operation
 */
export interface ReviewResult {
  success: boolean;
  review?: GeminiReviewResponse;
  error?: string;
}

/**
 * Progress information
 */
export interface ProgressInfo {
  session_id: string;
  project_name: string;
  current_stage: BuildStage;
  completed_stages: BuildStage[];
  progress_percent: number;
  model_type: ModelType | null;
  pending_tables: string[];
  total_reviews: number;
  latest_score?: number;
}

// ============================================================================
// Stage Order
// ============================================================================

const STAGE_ORDER: BuildStage[] = ['A', 'B', 'C', 'D', 'E', 'F'];

// ============================================================================
// ModelBuilder Class
// ============================================================================

/**
 * Main orchestrator for the Data Model Builder
 *
 * @example
 * ```typescript
 * const builder = new ModelBuilder({ geminiConfig: { api_key: 'AIza...' } });
 * await builder.initialize();
 *
 * const session = builder.startSession('SalesModel');
 * builder.processInput(stage1Json, qvdSamples);
 * builder.selectModelType('star_schema');
 *
 * // Build stages with review
 * for (const stage of ['A', 'B', 'C', 'D', 'E', 'F']) {
 *   const result = builder.buildCurrentStage();
 *   if (result.success) {
 *     builder.approveCurrentStage(result.script.script);
 *   }
 * }
 *
 * const review = await builder.requestReview();
 * const output = builder.exportOutput();
 * ```
 */
export class ModelBuilder {
  private config: Required<ModelBuilderConfig>;
  private logger: Logger;
  private sessionManager: SessionManager;
  private inputProcessor: InputProcessor;
  private analyzer: Analyzer;
  private scopeGuard: ScopeGuard;
  private scriptBuilder: ScriptBuilder;
  private geminiReviewer?: GeminiReviewer;

  // Current state
  private currentSession: ModelBuilderSession | null = null;
  private enrichedSpec: EnrichedModelSpec | null = null;
  private analysisResult: AnalysisResult | null = null;
  private buildConfig: BuildConfig | null = null;
  private initialized = false;

  /**
   * Create a new ModelBuilder instance
   */
  constructor(config: ModelBuilderConfig = {}) {
    // Apply defaults
    this.config = {
      baseDir: config.baseDir ?? '.qmb',
      geminiConfig: config.geminiConfig ?? { api_key: '' },
      defaultQvdPath: config.defaultQvdPath ?? 'lib://QVD/',
      defaultCalendarLanguage: config.defaultCalendarLanguage ?? 'EN',
      useAutonumber: config.useAutonumber ?? true,
      userId: config.userId ?? '',
    };

    // Create temporary logger for initialization
    this.logger = createLogger('init', this.config.userId, this.config.baseDir);

    // Initialize components (without full setup)
    this.sessionManager = createSessionManager(this.config.baseDir, this.logger);
    this.inputProcessor = createInputProcessor(this.logger);
    this.analyzer = createAnalyzer(this.logger);
    this.scopeGuard = createScopeGuard(this.logger);
    this.scriptBuilder = createScriptBuilder(this.logger);

    // Gemini reviewer is optional (requires API key)
    if (this.config.geminiConfig.api_key) {
      this.geminiReviewer = createGeminiReviewer(this.config.geminiConfig, this.logger);
    }
  }

  // ==========================================================================
  // Lifecycle Methods
  // ==========================================================================

  /**
   * Initialize the ModelBuilder
   * Creates necessary directories and validates configuration
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.logger.info('model_builder', 'initializing', {
      baseDir: this.config.baseDir,
      hasGeminiKey: !!this.config.geminiConfig.api_key,
    });

    // Verify Gemini connection if configured
    if (this.geminiReviewer) {
      const result = await this.geminiReviewer.checkConnection();
      if (!result.connected) {
        this.logger.warn('model_builder', 'gemini_unavailable', {
          error: result.error,
        });
        // Don't throw - allow operation without Gemini
      } else {
        this.logger.info('model_builder', 'gemini_connected', {});
      }
    }

    this.initialized = true;
    this.logger.info('model_builder', 'initialized', {});
  }

  /**
   * Shutdown the ModelBuilder
   * Flushes logs and saves current session
   */
  shutdown(): void {
    this.logger.info('model_builder', 'shutting_down', {});

    if (this.currentSession) {
      this.sessionManager.saveSession(this.currentSession);
    }

    this.logger.flush();
  }

  // ==========================================================================
  // Session Management
  // ==========================================================================

  /**
   * Start a new session
   */
  startSession(projectName: string): ModelBuilderSession {
    // Create new session logger
    const tempId = `qmb-${Date.now()}`;
    this.logger = createLogger(tempId, this.config.userId, this.config.baseDir);

    // Create session
    this.currentSession = this.sessionManager.createSession(
      projectName,
      this.config.userId || undefined
    );

    // Update logger with real session ID
    this.logger = createLogger(
      this.currentSession.session_id,
      this.config.userId,
      this.config.baseDir
    );

    // Re-initialize components with new logger
    this.inputProcessor = createInputProcessor(this.logger);
    this.analyzer = createAnalyzer(this.logger);
    this.scopeGuard = createScopeGuard(this.logger);
    this.scriptBuilder = createScriptBuilder(this.logger);

    // Reset state
    this.enrichedSpec = null;
    this.analysisResult = null;
    this.buildConfig = null;

    this.logger.info('model_builder', 'session_started', {
      session_id: this.currentSession.session_id,
      project_name: projectName,
    });

    this.logger.audit({
      audit_type: 'session_created',
      action: `Created new session for project: ${projectName}`,
    });

    return this.currentSession;
  }

  /**
   * Resume an existing session
   */
  resumeSession(sessionId: string): ModelBuilderSession {
    const session = this.sessionManager.loadSession(sessionId);

    if (!session) {
      throw new SessionError(`Session not found: ${sessionId}`);
    }

    this.currentSession = session;

    // Update logger for session
    this.logger = createLogger(sessionId, this.config.userId, this.config.baseDir);

    // Re-initialize components
    this.inputProcessor = createInputProcessor(this.logger);
    this.analyzer = createAnalyzer(this.logger);
    this.scopeGuard = createScopeGuard(this.logger);
    this.scriptBuilder = createScriptBuilder(this.logger);

    this.logger.info('model_builder', 'session_resumed', {
      session_id: sessionId,
      stage: session.current_stage,
    });

    return session;
  }

  /**
   * Find and resume the most recent session for a project
   */
  findRecentSession(projectName: string): ModelBuilderSession | null {
    return this.sessionManager.findRecentSession(projectName);
  }

  /**
   * List all sessions
   */
  listSessions(): SessionSummary[] {
    return this.sessionManager.listSessions(this.config.userId || undefined);
  }

  /**
   * Get current session
   */
  getCurrentSession(): ModelBuilderSession | null {
    return this.currentSession;
  }

  // ==========================================================================
  // Input Processing
  // ==========================================================================

  /**
   * Process Stage 1 input and QVD samples
   */
  processInput(stage1Json: unknown, qvdSamples: unknown[]): EnrichedModelSpec {
    this.ensureSession();

    this.logger.info('model_builder', 'processing_input', {
      session_id: this.currentSession!.session_id,
    });

    // Validate inputs
    const validatedStage1 = this.inputProcessor.validateStage1Input(stage1Json);
    const validatedSamples = this.inputProcessor.validateQvdSamples(qvdSamples);

    // Process and enrich
    this.enrichedSpec = this.inputProcessor.process(validatedStage1, validatedSamples);

    // Analyze
    this.analysisResult = this.analyzer.analyze(this.enrichedSpec);

    // Update enriched spec with recommendations
    this.enrichedSpec.recommended_model_type = this.analysisResult.model_recommendation.recommended_model;
    this.enrichedSpec.recommendation_confidence = this.analysisResult.model_recommendation.confidence;

    // Update session with pending tables
    const pendingTables = this.enrichedSpec.tables.map(t => t.name);
    this.sessionManager.setPendingTables(this.currentSession!, pendingTables);

    this.logger.info('model_builder', 'input_processed', {
      tables: this.enrichedSpec.tables.length,
      relationships: this.enrichedSpec.relationships.length,
      recommended_model: this.enrichedSpec.recommended_model_type,
    });

    return this.enrichedSpec;
  }

  /**
   * Get analysis result
   */
  getAnalysisResult(): AnalysisResult | null {
    return this.analysisResult;
  }

  /**
   * Get enriched specification
   */
  getEnrichedSpec(): EnrichedModelSpec | null {
    return this.enrichedSpec;
  }

  // ==========================================================================
  // Model Type Selection
  // ==========================================================================

  /**
   * Select the model type for this session
   */
  selectModelType(modelType: ModelType): void {
    this.ensureSession();

    this.logger.info('model_builder', 'model_type_selected', {
      model_type: modelType,
      previous_type: this.currentSession!.model_type,
    });

    this.sessionManager.setModelType(this.currentSession!, modelType);

    // Initialize build config
    this.buildConfig = {
      project_name: this.currentSession!.project_name,
      qvd_path: this.config.defaultQvdPath,
      calendar_language: this.config.defaultCalendarLanguage,
      use_autonumber: this.config.useAutonumber,
    };

    this.logger.audit({
      audit_type: 'model_type_selected',
      action: `Selected model type: ${modelType}`,
    });
  }

  /**
   * Update build configuration
   */
  updateBuildConfig(updates: Partial<BuildConfig>): void {
    this.ensureSession();

    if (!this.buildConfig) {
      throw new WorkflowError('Build config not initialized. Call selectModelType first.');
    }

    this.buildConfig = { ...this.buildConfig, ...updates };

    this.logger.info('model_builder', 'build_config_updated', {
      updates: Object.keys(updates),
    });
  }

  // ==========================================================================
  // Stage Building
  // ==========================================================================

  /**
   * Build the current stage
   */
  buildCurrentStage(): StageBuildResult {
    this.ensureSession();
    this.ensureReadyForBuild();

    const stage = this.currentSession!.current_stage;

    this.logger.info('model_builder', 'building_stage', {
      stage,
      session_id: this.currentSession!.session_id,
    });

    try {
      const context = this.createBuildContext();
      const script = this.scriptBuilder.buildStage(stage, context);

      this.logger.info('model_builder', 'stage_built', {
        stage,
        lines: script.estimated_lines,
        tables: script.tables_included.length,
      });

      return {
        success: true,
        stage,
        script,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error('model_builder', 'stage_build_failed', {
        stage,
        error: err.message,
      });

      return {
        success: false,
        stage,
        error: err.message,
      };
    }
  }

  /**
   * Build a specific stage
   */
  buildStage(stage: BuildStage): StageBuildResult {
    this.ensureSession();
    this.ensureReadyForBuild();

    try {
      const context = this.createBuildContext();
      const script = this.scriptBuilder.buildStage(stage, context);

      return {
        success: true,
        stage,
        script,
      };
    } catch (error) {
      return {
        success: false,
        stage,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Approve the current stage and advance
   */
  approveCurrentStage(script: string): void {
    this.ensureSession();

    const stage = this.currentSession!.current_stage;

    this.logger.info('model_builder', 'approving_stage', {
      stage,
      script_length: script.length,
    });

    // Store approved script
    this.sessionManager.approveStage(this.currentSession!, stage, script);

    // Calculate script hash for audit
    const scriptHash = Logger.hashScript(script);

    // Advance to next stage if not at end
    const currentIndex = STAGE_ORDER.indexOf(stage);
    if (currentIndex < STAGE_ORDER.length - 1) {
      const nextStage = STAGE_ORDER[currentIndex + 1];
      this.sessionManager.advanceStage(this.currentSession!, nextStage);
    }

    this.logger.audit({
      audit_type: 'stage_approved',
      action: `Approved stage ${stage}`,
      script_hash: scriptHash,
    });
  }

  /**
   * Go back to a previous stage
   */
  goBackToStage(targetStage: BuildStage): void {
    this.ensureSession();

    const currentStage = this.currentSession!.current_stage;

    this.logger.info('model_builder', 'going_back', {
      from: currentStage,
      to: targetStage,
    });

    this.sessionManager.revertToStage(this.currentSession!, targetStage);

    this.logger.audit({
      audit_type: 'stage_reverted',
      action: `Reverted from ${currentStage} to ${targetStage}`,
    });
  }

  /**
   * Get assembled script from all approved stages
   */
  getAssembledScript(): string {
    this.ensureSession();

    return this.scriptBuilder.assembleFullScript(
      this.currentSession!.approved_script_parts
    );
  }

  // ==========================================================================
  // Review
  // ==========================================================================

  /**
   * Request Gemini review of current script
   */
  async requestReview(): Promise<ReviewResult> {
    this.ensureSession();

    if (!this.geminiReviewer) {
      return {
        success: false,
        error: 'Gemini reviewer not configured. Set GEMINI_API_KEY.',
      };
    }

    const script = this.getAssembledScript();
    if (!script) {
      return {
        success: false,
        error: 'No script to review. Build and approve stages first.',
      };
    }

    this.logger.info('model_builder', 'requesting_review', {
      script_length: script.length,
    });

    try {
      // Build review request
      const factsCount = this.analysisResult
        ? [...this.analysisResult.classifications.values()]
            .filter(c => c.classification === 'fact').length
        : 0;
      const dimensionsCount = this.analysisResult
        ? [...this.analysisResult.classifications.values()]
            .filter(c => c.classification === 'dimension').length
        : 0;
      const expectedRows = this.enrichedSpec
        ? this.enrichedSpec.tables.reduce((sum, t) => sum + t.row_count, 0)
        : 0;

      const review = await this.geminiReviewer.reviewWithRetry({
        script,
        model_type: this.currentSession!.model_type || 'star_schema',
        facts_count: factsCount,
        dimensions_count: dimensionsCount,
        expected_rows: expectedRows,
      });

      // Store review in session
      this.sessionManager.addGeminiReview(this.currentSession!, review);

      // Create audit entry
      this.logger.audit({
        audit_type: 'gemini_review',
        action: `Gemini review completed with score ${review.score}`,
        gemini_score: review.score,
        issues_fixed: 0,
        script_hash: Logger.hashScript(script),
      });

      return {
        success: true,
        review,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error('model_builder', 'review_failed', {
        error: err.message,
      });

      return {
        success: false,
        error: err.message,
      };
    }
  }

  /**
   * Get all reviews for current session
   */
  getReviews(): GeminiReviewResponse[] {
    return this.currentSession?.gemini_reviews || [];
  }

  // ==========================================================================
  // Scope Validation
  // ==========================================================================

  /**
   * Validate a user request
   */
  validateRequest(request: string): ScopeValidationResult {
    const context = this.currentSession
      ? {
          session_id: this.currentSession.session_id,
          current_stage: this.currentSession.current_stage,
        }
      : undefined;

    return this.scopeGuard.validateRequest(request, context);
  }

  /**
   * Check rate limit for user
   */
  checkRateLimit(): RateLimitResult {
    const userId = this.config.userId || 'default';
    return this.scopeGuard.checkRateLimit(userId);
  }

  /**
   * Record a request for rate limiting
   */
  recordRequest(success: boolean = true): void {
    const userId = this.config.userId || 'default';
    this.scopeGuard.recordRequest(userId, success);
  }

  // ==========================================================================
  // Export
  // ==========================================================================

  /**
   * Export the final Stage 2 output
   */
  exportOutput(): Stage2Output {
    this.ensureSession();

    if (!this.enrichedSpec || !this.analysisResult) {
      throw new WorkflowError('Input not processed. Call processInput first.');
    }

    const lastReview = this.currentSession!.gemini_reviews.slice(-1)[0];

    // Extract facts
    const facts: FactDefinition[] = [];
    for (const table of this.enrichedSpec.tables) {
      const classification = this.analysisResult.classifications.get(table.name);
      if (classification?.classification === 'fact') {
        const measures = table.fields
          .filter(f => !f.is_key_candidate && !f.is_date_field)
          .map(f => f.name);
        const dimensionKeys = table.fields
          .filter(f => f.is_key_candidate)
          .map(f => f.name);

        facts.push({
          name: table.name,
          source: table.source_name,
          fields: table.fields.map(f => f.name),
          dimension_keys: dimensionKeys,
          measures,
        });
      }
    }

    // Extract dimensions
    const dimensions: DimensionDefinition[] = [];
    for (const table of this.enrichedSpec.tables) {
      const classification = this.analysisResult.classifications.get(table.name);
      if (classification?.classification === 'dimension') {
        const pk = table.fields.find(f => f.is_key_candidate);
        dimensions.push({
          name: table.name,
          source: table.source_name,
          primary_key: pk?.name || `${table.name}_ID`,
          attributes: table.fields.filter(f => !f.is_key_candidate).map(f => f.name),
        });
      }
    }

    // Extract calendars
    const calendars: CalendarDefinition[] = this.enrichedSpec.date_fields.map(df => ({
      name: `DIM_${df.field_name}`,
      date_field: df.field_name,
      min_date: df.min_date || '2020-01-01',
      max_date: df.max_date || '2030-12-31',
      fields: [
        `${df.field_name}`,
        `${df.field_name}_Year`,
        `${df.field_name}_Month`,
        `${df.field_name}_Day`,
        `${df.field_name}_Quarter`,
        `${df.field_name}_Week`,
      ],
    }));

    // Extract relationships
    const relationships: OutputRelationship[] = this.enrichedSpec.relationships.map(r => ({
      from_table: r.from_table,
      from_field: r.from_field,
      to_table: r.to_table,
      to_field: r.to_field,
    }));

    const output: Stage2Output = {
      version: '1.0.0',
      model_type: this.currentSession!.model_type || 'star_schema',
      created_at: new Date().toISOString(),
      facts,
      dimensions,
      calendars,
      relationships,
      gemini_review: {
        score: lastReview?.score || 0,
        status: (lastReview?.score || 0) >= 80 ? 'approved' : 'approved_with_warnings',
        issues_fixed: 0,
      },
    };

    this.logger.info('model_builder', 'output_exported', {
      facts: facts.length,
      dimensions: dimensions.length,
      calendars: calendars.length,
    });

    this.logger.audit({
      audit_type: 'output_exported',
      action: 'Exported Stage 2 output',
      gemini_score: lastReview?.score,
    });

    return output;
  }

  // ==========================================================================
  // Progress
  // ==========================================================================

  /**
   * Get current progress information
   */
  getProgress(): ProgressInfo | null {
    if (!this.currentSession) {
      return null;
    }

    const completedCount = this.currentSession.completed_stages.length;
    const progressPercent = Math.round((completedCount / STAGE_ORDER.length) * 100);

    const latestReview = this.currentSession.gemini_reviews.slice(-1)[0];

    return {
      session_id: this.currentSession.session_id,
      project_name: this.currentSession.project_name,
      current_stage: this.currentSession.current_stage,
      completed_stages: this.currentSession.completed_stages,
      progress_percent: progressPercent,
      model_type: this.currentSession.model_type,
      pending_tables: this.currentSession.pending_tables,
      total_reviews: this.currentSession.gemini_reviews.length,
      latest_score: latestReview?.score,
    };
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Ensure a session is active
   */
  private ensureSession(): void {
    if (!this.currentSession) {
      throw new SessionError('No active session. Call startSession or resumeSession first.');
    }
  }

  /**
   * Ensure ready for building
   */
  private ensureReadyForBuild(): void {
    if (!this.enrichedSpec) {
      throw new WorkflowError('Input not processed. Call processInput first.');
    }
    if (!this.analysisResult) {
      throw new WorkflowError('Analysis not complete. Call processInput first.');
    }
    if (!this.currentSession!.model_type) {
      throw new WorkflowError('Model type not selected. Call selectModelType first.');
    }
    if (!this.buildConfig) {
      throw new WorkflowError('Build config not initialized. Call selectModelType first.');
    }
  }

  /**
   * Create build context for script generation
   */
  private createBuildContext(): BuildContext {
    return {
      session: this.currentSession!,
      spec: this.enrichedSpec!,
      analysis: this.analysisResult!,
      config: this.buildConfig!,
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new ModelBuilder instance
 */
export function createModelBuilder(config?: ModelBuilderConfig): ModelBuilder {
  return new ModelBuilder(config);
}

// Re-export error classes
export {
  ValidationError,
  EmptyInputError,
  BuildContextError,
  GeminiReviewError,
  GeminiAuthError,
  GeminiTimeoutError,
};

export default ModelBuilder;
