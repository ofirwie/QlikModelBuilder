# Sub-Plan 10: MCP Handlers

> **Part of:** Data Model Builder (Stage 2) Implementation
> **Dependencies:** Sub-Plan 09 (Orchestrator), all previous sub-plans
> **Output:** `src/model-builder/handlers/*.ts`

---

## Goal

Create MCP (Model Context Protocol) tool handlers that expose the ModelBuilder functionality to Claude Code, enabling the wizard-like interaction flow.

## Context

The MCP handlers bridge between Claude Code and the ModelBuilder system:
- Each handler corresponds to a user action/command
- Handlers validate input via Scope Guard
- Handlers delegate to ModelBuilder orchestrator
- Return structured responses for Claude to present

## Files to Create

| File | Purpose |
|------|---------|
| `src/model-builder/handlers/index.ts` | Handler registry and exports |
| `src/model-builder/handlers/session-handlers.ts` | Session management handlers |
| `src/model-builder/handlers/stage-handlers.ts` | Stage workflow handlers |
| `src/model-builder/handlers/review-handlers.ts` | Review workflow handlers |
| `src/model-builder/handlers/utility-handlers.ts` | Status, progress, export handlers |
| `src/__tests__/model-builder/handlers.test.ts` | Handler tests |

## Key Interfaces

```typescript
interface MCPHandler<TInput, TOutput> {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  handler: (input: TInput, context: HandlerContext) => Promise<TOutput>;
}

interface HandlerContext {
  modelBuilder: ModelBuilder;
  userId?: string;
  sessionId?: string;
}

interface HandlerResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Tool definitions for MCP
interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, JSONSchema>;
    required?: string[];
  };
}
```

## Handler Definitions

### Session Handlers

```typescript
// qmb_start_session
const startSessionHandler: MCPHandler<StartSessionInput, SessionResult> = {
  name: 'qmb_start_session',
  description: 'Start a new model building session for a project',
  inputSchema: {
    type: 'object',
    properties: {
      project_name: { type: 'string', description: 'Name of the project' },
      qvd_path: { type: 'string', description: 'Path to QVD files (optional)' },
    },
    required: ['project_name'],
  },
  async handler(input, context) {
    const session = await context.modelBuilder.startNewSession(
      input.project_name,
      context.userId
    );
    return {
      success: true,
      data: {
        session_id: session.session_id,
        project_name: session.project_name,
        current_stage: session.current_stage,
      },
      message: `Session started for project "${input.project_name}"`,
    };
  },
};

// qmb_resume_session
const resumeSessionHandler: MCPHandler<ResumeSessionInput, SessionResult> = {
  name: 'qmb_resume_session',
  description: 'Resume an existing model building session',
  inputSchema: {
    type: 'object',
    properties: {
      session_id: { type: 'string', description: 'Session ID to resume' },
    },
    required: ['session_id'],
  },
  async handler(input, context) {
    const session = await context.modelBuilder.resumeSession(input.session_id);
    if (!session) {
      return {
        success: false,
        error: `Session not found: ${input.session_id}`,
      };
    }
    return {
      success: true,
      data: {
        session_id: session.session_id,
        project_name: session.project_name,
        current_stage: session.current_stage,
        completed_stages: session.completed_stages,
      },
      message: `Resumed session at Stage ${session.current_stage}`,
    };
  },
};

// qmb_list_sessions
const listSessionsHandler: MCPHandler<{}, SessionListResult> = {
  name: 'qmb_list_sessions',
  description: 'List available model building sessions',
  inputSchema: { type: 'object', properties: {} },
  async handler(input, context) {
    const sessions = context.modelBuilder.sessionManager.listSessions(context.userId);
    return {
      success: true,
      data: { sessions },
    };
  },
};
```

### Input Processing Handlers

```typescript
// qmb_load_spec
const loadSpecHandler: MCPHandler<LoadSpecInput, AnalysisResult> = {
  name: 'qmb_load_spec',
  description: 'Load Stage 1 JSON specification and analyze',
  inputSchema: {
    type: 'object',
    properties: {
      spec_path: { type: 'string', description: 'Path to Stage 1 JSON file' },
      qvd_samples_path: { type: 'string', description: 'Path to QVD samples (optional)' },
    },
    required: ['spec_path'],
  },
  async handler(input, context) {
    const spec = await loadJsonFile(input.spec_path);
    const samples = input.qvd_samples_path
      ? await loadJsonFile(input.qvd_samples_path)
      : [];

    const analysis = await context.modelBuilder.processInput(spec, samples);

    return {
      success: true,
      data: {
        recommended_model: analysis.model_recommendation.recommended_model,
        confidence: analysis.model_recommendation.confidence,
        facts: [...analysis.classifications.entries()]
          .filter(([_, r]) => r.classification === 'fact')
          .map(([name]) => name),
        dimensions: [...analysis.classifications.entries()]
          .filter(([_, r]) => r.classification === 'dimension')
          .map(([name]) => name),
        alternatives: analysis.model_recommendation.alternatives,
        warnings: analysis.warnings,
      },
      message: `Analyzed ${spec.tables.length} tables. Recommended: ${analysis.model_recommendation.recommended_model}`,
    };
  },
};

// qmb_select_model
const selectModelHandler: MCPHandler<SelectModelInput, void> = {
  name: 'qmb_select_model',
  description: 'Select the model type to build',
  inputSchema: {
    type: 'object',
    properties: {
      model_type: {
        type: 'string',
        enum: ['star_schema', 'snowflake', 'link_table', 'concatenated'],
        description: 'The model type to use',
      },
    },
    required: ['model_type'],
  },
  async handler(input, context) {
    await context.modelBuilder.selectModelType(input.model_type);
    return {
      success: true,
      message: `Model type set to ${input.model_type}`,
    };
  },
};
```

### Stage Workflow Handlers

```typescript
// qmb_build_stage
const buildStageHandler: MCPHandler<{}, StageScriptResult> = {
  name: 'qmb_build_stage',
  description: 'Build the script for the current stage',
  inputSchema: { type: 'object', properties: {} },
  async handler(input, context) {
    const stageScript = await context.modelBuilder.buildCurrentStage();
    const status = context.modelBuilder.getStatus();

    return {
      success: true,
      data: {
        stage: stageScript.stage,
        script: stageScript.script,
        tables: stageScript.tables_included,
        lines: stageScript.estimated_lines,
      },
      message: `Stage ${stageScript.stage} generated (${stageScript.estimated_lines} lines)`,
    };
  },
};

// qmb_approve_stage
const approveStageHandler: MCPHandler<ApproveStageInput, ProgressResult> = {
  name: 'qmb_approve_stage',
  description: 'Approve the current stage script',
  inputSchema: {
    type: 'object',
    properties: {
      modified_script: { type: 'string', description: 'Modified script (optional)' },
    },
  },
  async handler(input, context) {
    await context.modelBuilder.approveStage(input.modified_script);
    const progress = context.modelBuilder.getProgress();

    return {
      success: true,
      data: progress,
      message: `Stage approved. Progress: ${progress.completed_stages}/${progress.total_stages}`,
    };
  },
};

// qmb_edit_stage
const editStageHandler: MCPHandler<EditStageInput, StageScriptResult> = {
  name: 'qmb_edit_stage',
  description: 'Edit the current stage script',
  inputSchema: {
    type: 'object',
    properties: {
      modifications: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['add_field', 'remove_field', 'rename_field', 'modify'] },
            table: { type: 'string' },
            field: { type: 'string' },
            new_value: { type: 'string' },
          },
        },
        description: 'List of modifications to apply',
      },
    },
    required: ['modifications'],
  },
  async handler(input, context) {
    const stageScript = await context.modelBuilder.editStage(input.modifications);
    return {
      success: true,
      data: {
        stage: stageScript.stage,
        script: stageScript.script,
        tables: stageScript.tables_included,
      },
      message: `Applied ${input.modifications.length} modification(s)`,
    };
  },
};

// qmb_go_back
const goBackHandler: MCPHandler<{}, ProgressResult> = {
  name: 'qmb_go_back',
  description: 'Go back to the previous stage',
  inputSchema: { type: 'object', properties: {} },
  async handler(input, context) {
    const prevStage = await context.modelBuilder.goBack();
    if (!prevStage) {
      return {
        success: false,
        error: 'Already at first stage, cannot go back',
      };
    }
    const progress = context.modelBuilder.getProgress();
    return {
      success: true,
      data: progress,
      message: `Returned to Stage ${prevStage}`,
    };
  },
};
```

### Review Handlers

```typescript
// qmb_request_review
const requestReviewHandler: MCPHandler<{}, ReviewResult> = {
  name: 'qmb_request_review',
  description: 'Request Gemini review of the complete script',
  inputSchema: { type: 'object', properties: {} },
  async handler(input, context) {
    const review = await context.modelBuilder.requestReview();

    return {
      success: true,
      data: {
        status: review.review_status,
        score: review.score,
        issues: review.issues.map(i => ({
          id: i.issue_id,
          severity: i.severity,
          title: i.title,
          recommendation: i.recommendation,
        })),
        summary: review.summary,
      },
      message: review.review_status === 'approved'
        ? `Script approved with score ${review.score}/100`
        : `Found ${review.issues.length} issue(s). Score: ${review.score}/100`,
    };
  },
};

// qmb_apply_fixes
const applyFixesHandler: MCPHandler<ApplyFixesInput, StageScriptResult> = {
  name: 'qmb_apply_fixes',
  description: 'Apply selected fixes from Gemini review',
  inputSchema: {
    type: 'object',
    properties: {
      issue_ids: {
        type: 'array',
        items: { type: 'string' },
        description: 'IDs of issues to fix',
      },
    },
    required: ['issue_ids'],
  },
  async handler(input, context) {
    const stageScript = await context.modelBuilder.applyFixes(input.issue_ids);
    return {
      success: true,
      data: {
        stage: stageScript.stage,
        script: stageScript.script,
      },
      message: `Applied fixes for ${input.issue_ids.length} issue(s)`,
    };
  },
};
```

### Utility Handlers

```typescript
// qmb_status
const statusHandler: MCPHandler<{}, StatusResult> = {
  name: 'qmb_status',
  description: 'Get current model builder status',
  inputSchema: { type: 'object', properties: {} },
  async handler(input, context) {
    const status = context.modelBuilder.getStatus();
    const progress = context.modelBuilder.getProgress();

    return {
      success: true,
      data: {
        session: status.session ? {
          id: status.session.session_id,
          project: status.session.project_name,
          model_type: status.session.model_type,
        } : null,
        current_stage: status.current_stage,
        progress,
        review_status: status.review_status,
      },
    };
  },
};

// qmb_preview_script
const previewScriptHandler: MCPHandler<{}, ScriptPreviewResult> = {
  name: 'qmb_preview_script',
  description: 'Preview the complete assembled script',
  inputSchema: { type: 'object', properties: {} },
  async handler(input, context) {
    const script = context.modelBuilder.getFullScript();
    const lines = script.split('\n').length;

    return {
      success: true,
      data: {
        script,
        lines,
      },
    };
  },
};

// qmb_export
const exportHandler: MCPHandler<ExportInput, ExportResult> = {
  name: 'qmb_export',
  description: 'Export the model definition and script',
  inputSchema: {
    type: 'object',
    properties: {
      output_dir: { type: 'string', description: 'Directory to export to' },
    },
    required: ['output_dir'],
  },
  async handler(input, context) {
    const output = context.modelBuilder.exportOutput();
    const script = context.modelBuilder.getFullScript();

    // Write files
    const modelPath = path.join(input.output_dir, 'model.json');
    const scriptPath = path.join(input.output_dir, 'script.qvs');

    await fs.promises.writeFile(modelPath, JSON.stringify(output, null, 2));
    await fs.promises.writeFile(scriptPath, script);

    return {
      success: true,
      data: {
        model_path: modelPath,
        script_path: scriptPath,
        facts_count: output.facts.length,
        dimensions_count: output.dimensions.length,
      },
      message: `Exported to ${input.output_dir}`,
    };
  },
};
```

## Handler Registration

```typescript
// src/model-builder/handlers/index.ts

export const modelBuilderHandlers: MCPHandler<any, any>[] = [
  // Session
  startSessionHandler,
  resumeSessionHandler,
  listSessionsHandler,

  // Input
  loadSpecHandler,
  selectModelHandler,

  // Stages
  buildStageHandler,
  approveStageHandler,
  editStageHandler,
  goBackHandler,

  // Review
  requestReviewHandler,
  applyFixesHandler,

  // Utility
  statusHandler,
  previewScriptHandler,
  exportHandler,
];

export function registerModelBuilderTools(server: MCPServer, modelBuilder: ModelBuilder): void {
  for (const handler of modelBuilderHandlers) {
    server.tool(
      handler.name,
      handler.description,
      handler.inputSchema,
      async (params) => {
        const context: HandlerContext = {
          modelBuilder,
          userId: params._userId,
          sessionId: params._sessionId,
        };

        try {
          const result = await handler.handler(params, context);
          return { content: [{ type: 'text', text: JSON.stringify(result) }] };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error.message,
              }),
            }],
            isError: true,
          };
        }
      }
    );
  }
}
```

## Handler Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP HANDLERS                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Claude Code                                                │
│        │                                                     │
│        │  Tool Call: qmb_build_stage                        │
│        ▼                                                     │
│   ┌─────────────┐                                           │
│   │   Handler   │                                           │
│   │   Registry  │                                           │
│   └──────┬──────┘                                           │
│          │                                                   │
│          ▼                                                   │
│   ┌─────────────┐    ┌─────────────┐                       │
│   │   Scope     │ →  │   Model     │                       │
│   │   Guard     │    │   Builder   │                       │
│   └─────────────┘    └──────┬──────┘                       │
│                             │                               │
│                             ▼                               │
│                      ┌─────────────┐                       │
│                      │  Handler    │                       │
│                      │  Logic      │                       │
│                      └──────┬──────┘                       │
│                             │                               │
│                             ▼                               │
│                      ┌─────────────┐                       │
│                      │  Handler    │                       │
│                      │  Result     │                       │
│                      └──────┬──────┘                       │
│                             │                               │
│                             ▼                               │
│   Claude Code ← JSON Response                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Complete Tool List

| Tool Name | Purpose | Stage |
|-----------|---------|-------|
| `qmb_start_session` | Start new session | - |
| `qmb_resume_session` | Resume existing session | - |
| `qmb_list_sessions` | List available sessions | - |
| `qmb_load_spec` | Load and analyze Stage 1 JSON | - |
| `qmb_select_model` | Select model type | - |
| `qmb_build_stage` | Build current stage script | A-F |
| `qmb_approve_stage` | Approve current stage | A-F |
| `qmb_edit_stage` | Edit current stage | A-F |
| `qmb_go_back` | Return to previous stage | B-F |
| `qmb_request_review` | Request Gemini review | Post-F |
| `qmb_apply_fixes` | Apply review fixes | Post-F |
| `qmb_status` | Get current status | Any |
| `qmb_preview_script` | Preview full script | Post-A |
| `qmb_export` | Export model and script | Post-F |

## Potential Failure Points

1. **Invalid input** - User provides malformed parameters
2. **Session not found** - Operations without active session
3. **Stage order violation** - Calling handlers out of order
4. **ModelBuilder not initialized** - Handlers called before init
5. **Concurrent access** - Multiple handlers modifying state

## Mitigation Strategies

1. Validate input against JSON schema before handler execution
2. Return clear error message with instructions to start/resume session
3. Return error with current stage and expected actions
4. Ensure initialization in MCP server startup
5. Session-level locking for state modifications

## Test Plan

```typescript
describe('MCP Handlers', () => {
  describe('session handlers', () => {
    it('should start new session');
    it('should resume existing session');
    it('should list sessions');
    it('should handle session not found');
  });

  describe('stage handlers', () => {
    it('should build current stage');
    it('should approve stage and advance');
    it('should edit stage');
    it('should go back');
    it('should prevent going back from stage A');
  });

  describe('review handlers', () => {
    it('should request review');
    it('should apply fixes');
    it('should handle Gemini unavailable');
  });

  describe('utility handlers', () => {
    it('should return status');
    it('should preview script');
    it('should export files');
  });

  describe('error handling', () => {
    it('should return error for invalid input');
    it('should return error for missing session');
    it('should return error for out-of-order operations');
  });
});
```

## Error Handling Strategy

| Error Type | Possible Cause | Handling Approach | Recovery |
|------------|----------------|-------------------|----------|
| `ValidationError` | Invalid input schema | Return error with field details | User fixes input |
| `SessionRequiredError` | Tool called without session | Return error with start_session hint | User starts session |
| `OrderViolationError` | Tool called out of order | Return error with valid actions | User follows order |
| `NotInitializedError` | ModelBuilder not ready | Return error, suggest restart | Reinitialize |
| `GeminiError` | Review API failed | Return partial result, suggest retry | Retry or skip review |
| `FileSystemError` | Export path invalid | Return error with path details | User fixes path |
| `ConcurrentAccessError` | Multiple handlers modifying state | Queue operations, serialize access | Retry after lock |

### Comprehensive Error Handling with Retry Mechanisms

```typescript
/**
 * Retry configuration for handler operations.
 * Different operations may have different retry needs.
 */
interface RetryConfig {
  maxRetries: number;           // Maximum retry attempts (default: 3)
  baseDelayMs: number;          // Initial delay between retries (default: 1000ms)
  maxDelayMs: number;           // Maximum delay cap (default: 10000ms)
  backoffMultiplier: number;    // Exponential backoff multiplier (default: 2)
  retryableErrors: string[];    // Error codes that should trigger retry
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableErrors: [
    'NETWORK_ERROR',
    'TIMEOUT_ERROR',
    'TEMPORARY_FAILURE',
    'RATE_LIMITED',
    'SERVICE_UNAVAILABLE',
  ],
};

/**
 * Wrapper function that adds retry capability to any handler.
 */
async function withRetry<TInput, TOutput>(
  handler: MCPHandler<TInput, TOutput>,
  input: TInput,
  context: HandlerContext,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<HandlerResult<TOutput>> {
  let lastError: Error | null = null;
  const startTime = Date.now();

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      // Log attempt
      context.modelBuilder.logger.info('mcp_handler', 'handler_attempt', {
        handler: handler.name,
        attempt,
        maxRetries: config.maxRetries,
      });

      // Execute handler
      const result = await handler.handler(input, context);

      // Log success
      context.modelBuilder.logger.info('mcp_handler', 'handler_success', {
        handler: handler.name,
        attempt,
        durationMs: Date.now() - startTime,
      });

      return result;

    } catch (error) {
      lastError = error as Error;
      const errorCode = extractErrorCode(error);

      // Log failure
      context.modelBuilder.logger.warn('mcp_handler', 'handler_failed', {
        handler: handler.name,
        attempt,
        error: lastError.message,
        errorCode,
      });

      // Check if error is retryable
      if (!config.retryableErrors.includes(errorCode)) {
        // Non-retryable error - fail immediately
        context.modelBuilder.logger.error('mcp_handler', 'non_retryable_error', {
          handler: handler.name,
          errorCode,
          error: lastError.message,
        });
        break;
      }

      // Calculate delay with exponential backoff
      if (attempt < config.maxRetries) {
        const delay = Math.min(
          config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt - 1),
          config.maxDelayMs
        );

        context.modelBuilder.logger.info('mcp_handler', 'retry_scheduled', {
          handler: handler.name,
          nextAttempt: attempt + 1,
          delayMs: delay,
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries exhausted
  context.modelBuilder.logger.error('mcp_handler', 'all_retries_exhausted', {
    handler: handler.name,
    totalAttempts: config.maxRetries,
    totalDurationMs: Date.now() - startTime,
    error: lastError?.message,
  });

  return {
    success: false,
    error: extractErrorCode(lastError),
    message: `Operation failed after ${config.maxRetries} attempts: ${lastError?.message}`,
  };
}

function extractErrorCode(error: unknown): string {
  if (!error) return 'UNKNOWN_ERROR';

  if (error instanceof Error) {
    // Check for specific error types
    if (error.name === 'ValidationError') return 'VALIDATION_ERROR';
    if (error.name === 'SessionRequiredError') return 'SESSION_REQUIRED';
    if (error.name === 'TimeoutError') return 'TIMEOUT_ERROR';
    if (error.message.includes('ECONNREFUSED')) return 'NETWORK_ERROR';
    if (error.message.includes('timeout')) return 'TIMEOUT_ERROR';
    if (error.message.includes('rate limit')) return 'RATE_LIMITED';

    // Check for custom code property
    const errWithCode = error as Error & { code?: string };
    if (errWithCode.code) return errWithCode.code;
  }

  return 'UNKNOWN_ERROR';
}

/**
 * Enhanced handler wrapper with retry and error classification.
 */
function createRetryableHandler<TInput, TOutput>(
  handler: MCPHandler<TInput, TOutput>,
  retryConfig?: Partial<RetryConfig>
): MCPHandler<TInput, TOutput> {
  const config = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };

  return {
    ...handler,
    async handler(input: TInput, context: HandlerContext): Promise<HandlerResult<TOutput>> {
      return withRetry(handler, input, context, config);
    },
  };
}
```

### Input Validation and Sanitization

```typescript
/**
 * Input validation service for handler parameters.
 * Validates against JSON schema and sanitizes potentially dangerous input.
 */
class InputValidator {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Validates input against JSON schema and sanitizes values.
   */
  validate<T>(input: unknown, schema: JSONSchema, handlerName: string): ValidationResult<T> {
    const errors: ValidationError[] = [];

    // Step 1: Type validation
    if (schema.type === 'object' && (typeof input !== 'object' || input === null)) {
      return {
        valid: false,
        errors: [{
          field: 'root',
          message: `Expected object, got ${typeof input}`,
          code: 'INVALID_TYPE',
        }],
      };
    }

    const inputObj = input as Record<string, unknown>;

    // Step 2: Required field validation
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in inputObj) || inputObj[field] === undefined) {
          errors.push({
            field,
            message: `Required field '${field}' is missing`,
            code: 'MISSING_REQUIRED',
          });
        }
      }
    }

    // Step 3: Property validation and sanitization
    const sanitized: Record<string, unknown> = {};
    const properties = schema.properties || {};

    for (const [key, value] of Object.entries(inputObj)) {
      const propSchema = properties[key];

      // Skip unknown properties (could be optional metadata)
      if (!propSchema) {
        this.logger.debug('input_validator', 'unknown_property', {
          handler: handlerName,
          property: key,
        });
        continue;
      }

      // Validate and sanitize each property
      const propResult = this.validateProperty(key, value, propSchema);
      if (!propResult.valid) {
        errors.push(...propResult.errors);
      } else {
        sanitized[key] = propResult.sanitized;
      }
    }

    if (errors.length > 0) {
      this.logger.warn('input_validator', 'validation_failed', {
        handler: handlerName,
        errorCount: errors.length,
        errors: errors.map(e => `${e.field}: ${e.message}`),
      });

      return { valid: false, errors };
    }

    return { valid: true, data: sanitized as T };
  }

  private validateProperty(
    name: string,
    value: unknown,
    schema: JSONSchemaProperty
  ): { valid: boolean; errors: ValidationError[]; sanitized?: unknown } {
    const errors: ValidationError[] = [];

    // Type validation
    if (!this.validateType(value, schema.type)) {
      return {
        valid: false,
        errors: [{
          field: name,
          message: `Expected ${schema.type}, got ${typeof value}`,
          code: 'INVALID_TYPE',
        }],
      };
    }

    // String-specific validation and sanitization
    if (schema.type === 'string' && typeof value === 'string') {
      const sanitized = this.sanitizeString(value, name);

      // Length validation
      if (schema.minLength && sanitized.length < schema.minLength) {
        errors.push({
          field: name,
          message: `Minimum length is ${schema.minLength}, got ${sanitized.length}`,
          code: 'MIN_LENGTH',
        });
      }
      if (schema.maxLength && sanitized.length > schema.maxLength) {
        errors.push({
          field: name,
          message: `Maximum length is ${schema.maxLength}, got ${sanitized.length}`,
          code: 'MAX_LENGTH',
        });
      }

      // Enum validation
      if (schema.enum && !schema.enum.includes(sanitized)) {
        errors.push({
          field: name,
          message: `Value must be one of: ${schema.enum.join(', ')}`,
          code: 'INVALID_ENUM',
        });
      }

      // Pattern validation
      if (schema.pattern) {
        const regex = new RegExp(schema.pattern);
        if (!regex.test(sanitized)) {
          errors.push({
            field: name,
            message: `Value does not match required pattern`,
            code: 'PATTERN_MISMATCH',
          });
        }
      }

      return { valid: errors.length === 0, errors, sanitized };
    }

    // Number validation
    if (schema.type === 'number' || schema.type === 'integer') {
      const numValue = value as number;

      if (schema.minimum !== undefined && numValue < schema.minimum) {
        errors.push({
          field: name,
          message: `Minimum value is ${schema.minimum}`,
          code: 'MIN_VALUE',
        });
      }
      if (schema.maximum !== undefined && numValue > schema.maximum) {
        errors.push({
          field: name,
          message: `Maximum value is ${schema.maximum}`,
          code: 'MAX_VALUE',
        });
      }

      return { valid: errors.length === 0, errors, sanitized: numValue };
    }

    // Array validation
    if (schema.type === 'array' && Array.isArray(value)) {
      const sanitizedArray: unknown[] = [];

      for (let i = 0; i < value.length; i++) {
        if (schema.items) {
          const itemResult = this.validateProperty(`${name}[${i}]`, value[i], schema.items);
          if (!itemResult.valid) {
            errors.push(...itemResult.errors);
          } else {
            sanitizedArray.push(itemResult.sanitized);
          }
        } else {
          sanitizedArray.push(value[i]);
        }
      }

      return { valid: errors.length === 0, errors, sanitized: sanitizedArray };
    }

    return { valid: true, errors: [], sanitized: value };
  }

  private validateType(value: unknown, expectedType: string): boolean {
    switch (expectedType) {
      case 'string': return typeof value === 'string';
      case 'number': return typeof value === 'number' && !isNaN(value);
      case 'integer': return typeof value === 'number' && Number.isInteger(value);
      case 'boolean': return typeof value === 'boolean';
      case 'array': return Array.isArray(value);
      case 'object': return typeof value === 'object' && value !== null && !Array.isArray(value);
      default: return true;
    }
  }

  /**
   * Sanitizes string input to prevent injection attacks.
   */
  private sanitizeString(value: string, fieldName: string): string {
    let sanitized = value;

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');

    // Trim whitespace for most fields
    if (!fieldName.toLowerCase().includes('script')) {
      sanitized = sanitized.trim();
    }

    // Limit extreme lengths
    const maxLength = fieldName.toLowerCase().includes('script') ? 500000 : 10000;
    if (sanitized.length > maxLength) {
      this.logger.warn('input_validator', 'truncated_input', {
        field: fieldName,
        originalLength: sanitized.length,
        maxLength,
      });
      sanitized = sanitized.substring(0, maxLength);
    }

    // Path sanitization for file paths
    if (fieldName.toLowerCase().includes('path')) {
      // Prevent path traversal attacks
      sanitized = sanitized.replace(/\.\.[\/\\]/g, '');
      // Normalize path separators
      sanitized = sanitized.replace(/[\/\\]+/g, '/');
    }

    return sanitized;
  }
}

interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  errors?: ValidationError[];
}

interface ValidationError {
  field: string;
  message: string;
  code: string;
}
```

### Detailed Logging Integration

```typescript
/**
 * Logger integration for MCP handlers.
 * Provides structured logging with context for debugging and monitoring.
 */
class HandlerLogger {
  private logger: Logger;
  private handlerName: string;

  constructor(logger: Logger, handlerName: string) {
    this.logger = logger;
    this.handlerName = handlerName;
  }

  /**
   * Log handler invocation start.
   */
  logStart(input: unknown, context: HandlerContext): string {
    const requestId = this.generateRequestId();

    this.logger.info('mcp_handler', 'handler_start', {
      handler: this.handlerName,
      requestId,
      sessionId: context.sessionId,
      userId: context.userId,
      inputSize: JSON.stringify(input).length,
      timestamp: new Date().toISOString(),
    });

    return requestId;
  }

  /**
   * Log successful handler completion.
   */
  logSuccess(requestId: string, result: unknown, durationMs: number): void {
    this.logger.info('mcp_handler', 'handler_success', {
      handler: this.handlerName,
      requestId,
      durationMs,
      resultSize: JSON.stringify(result).length,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log handler failure.
   */
  logError(requestId: string, error: Error, durationMs: number): void {
    this.logger.error('mcp_handler', 'handler_error', {
      handler: this.handlerName,
      requestId,
      durationMs,
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack?.split('\n').slice(0, 5).join('\n'),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log validation failure.
   */
  logValidationError(requestId: string, errors: ValidationError[]): void {
    this.logger.warn('mcp_handler', 'validation_failed', {
      handler: this.handlerName,
      requestId,
      errorCount: errors.length,
      errors: errors.map(e => ({ field: e.field, code: e.code })),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log retry attempt.
   */
  logRetry(requestId: string, attempt: number, delayMs: number, reason: string): void {
    this.logger.info('mcp_handler', 'handler_retry', {
      handler: this.handlerName,
      requestId,
      attempt,
      delayMs,
      reason,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log operation within handler.
   */
  logOperation(requestId: string, operation: string, details?: Record<string, unknown>): void {
    this.logger.debug('mcp_handler', 'handler_operation', {
      handler: this.handlerName,
      requestId,
      operation,
      ...details,
      timestamp: new Date().toISOString(),
    });
  }

  private generateRequestId(): string {
    return `${this.handlerName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Handler wrapper that automatically adds logging.
 */
function createLoggingHandler<TInput, TOutput>(
  handler: MCPHandler<TInput, TOutput>
): MCPHandler<TInput, TOutput> {
  return {
    ...handler,
    async handler(input: TInput, context: HandlerContext): Promise<HandlerResult<TOutput>> {
      const handlerLogger = new HandlerLogger(context.modelBuilder.logger, handler.name);
      const requestId = handlerLogger.logStart(input, context);
      const startTime = Date.now();

      try {
        const result = await handler.handler(input, context);
        handlerLogger.logSuccess(requestId, result, Date.now() - startTime);
        return result;
      } catch (error) {
        handlerLogger.logError(requestId, error as Error, Date.now() - startTime);
        throw error;
      }
    },
  };
}
```

### Metrics Tracking

```typescript
/**
 * Metrics collection for handler performance monitoring.
 */
interface HandlerMetrics {
  totalCalls: number;
  successCount: number;
  failureCount: number;
  totalDurationMs: number;
  avgDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  lastCalledAt: Date | null;
  errorBreakdown: Map<string, number>;
}

class MetricsTracker {
  private metrics: Map<string, HandlerMetrics> = new Map();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Initialize metrics for a handler.
   */
  private initMetrics(handlerName: string): HandlerMetrics {
    return {
      totalCalls: 0,
      successCount: 0,
      failureCount: 0,
      totalDurationMs: 0,
      avgDurationMs: 0,
      minDurationMs: Infinity,
      maxDurationMs: 0,
      lastCalledAt: null,
      errorBreakdown: new Map(),
    };
  }

  /**
   * Record a successful handler execution.
   */
  recordSuccess(handlerName: string, durationMs: number): void {
    const metrics = this.metrics.get(handlerName) || this.initMetrics(handlerName);

    metrics.totalCalls++;
    metrics.successCount++;
    metrics.totalDurationMs += durationMs;
    metrics.avgDurationMs = metrics.totalDurationMs / metrics.totalCalls;
    metrics.minDurationMs = Math.min(metrics.minDurationMs, durationMs);
    metrics.maxDurationMs = Math.max(metrics.maxDurationMs, durationMs);
    metrics.lastCalledAt = new Date();

    this.metrics.set(handlerName, metrics);

    // Log metrics periodically (every 100 calls)
    if (metrics.totalCalls % 100 === 0) {
      this.logMetricsSummary(handlerName, metrics);
    }
  }

  /**
   * Record a failed handler execution.
   */
  recordFailure(handlerName: string, durationMs: number, errorCode: string): void {
    const metrics = this.metrics.get(handlerName) || this.initMetrics(handlerName);

    metrics.totalCalls++;
    metrics.failureCount++;
    metrics.totalDurationMs += durationMs;
    metrics.avgDurationMs = metrics.totalDurationMs / metrics.totalCalls;
    metrics.minDurationMs = Math.min(metrics.minDurationMs, durationMs);
    metrics.maxDurationMs = Math.max(metrics.maxDurationMs, durationMs);
    metrics.lastCalledAt = new Date();

    // Track error breakdown
    const currentErrorCount = metrics.errorBreakdown.get(errorCode) || 0;
    metrics.errorBreakdown.set(errorCode, currentErrorCount + 1);

    this.metrics.set(handlerName, metrics);

    // Log warning if failure rate is high
    const failureRate = metrics.failureCount / metrics.totalCalls;
    if (failureRate > 0.1 && metrics.totalCalls >= 10) {
      this.logger.warn('metrics', 'high_failure_rate', {
        handler: handlerName,
        failureRate: (failureRate * 100).toFixed(2) + '%',
        totalCalls: metrics.totalCalls,
        failureCount: metrics.failureCount,
      });
    }
  }

  /**
   * Get metrics for a specific handler.
   */
  getMetrics(handlerName: string): HandlerMetrics | null {
    return this.metrics.get(handlerName) || null;
  }

  /**
   * Get all handler metrics.
   */
  getAllMetrics(): Map<string, HandlerMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Get aggregated metrics summary.
   */
  getSummary(): {
    totalHandlerCalls: number;
    overallSuccessRate: number;
    avgResponseTime: number;
    slowestHandler: string | null;
    mostErrorsHandler: string | null;
  } {
    let totalCalls = 0;
    let totalSuccess = 0;
    let totalDuration = 0;
    let slowestAvg = 0;
    let slowestHandler: string | null = null;
    let mostErrors = 0;
    let mostErrorsHandler: string | null = null;

    for (const [name, metrics] of this.metrics) {
      totalCalls += metrics.totalCalls;
      totalSuccess += metrics.successCount;
      totalDuration += metrics.totalDurationMs;

      if (metrics.avgDurationMs > slowestAvg) {
        slowestAvg = metrics.avgDurationMs;
        slowestHandler = name;
      }

      if (metrics.failureCount > mostErrors) {
        mostErrors = metrics.failureCount;
        mostErrorsHandler = name;
      }
    }

    return {
      totalHandlerCalls: totalCalls,
      overallSuccessRate: totalCalls > 0 ? totalSuccess / totalCalls : 0,
      avgResponseTime: totalCalls > 0 ? totalDuration / totalCalls : 0,
      slowestHandler,
      mostErrorsHandler,
    };
  }

  private logMetricsSummary(handlerName: string, metrics: HandlerMetrics): void {
    this.logger.info('metrics', 'handler_metrics_summary', {
      handler: handlerName,
      totalCalls: metrics.totalCalls,
      successRate: ((metrics.successCount / metrics.totalCalls) * 100).toFixed(2) + '%',
      avgDurationMs: metrics.avgDurationMs.toFixed(2),
      minDurationMs: metrics.minDurationMs,
      maxDurationMs: metrics.maxDurationMs,
    });
  }
}

/**
 * Handler wrapper that automatically tracks metrics.
 */
function createMetricsHandler<TInput, TOutput>(
  handler: MCPHandler<TInput, TOutput>,
  metricsTracker: MetricsTracker
): MCPHandler<TInput, TOutput> {
  return {
    ...handler,
    async handler(input: TInput, context: HandlerContext): Promise<HandlerResult<TOutput>> {
      const startTime = Date.now();

      try {
        const result = await handler.handler(input, context);
        metricsTracker.recordSuccess(handler.name, Date.now() - startTime);
        return result;
      } catch (error) {
        const errorCode = extractErrorCode(error);
        metricsTracker.recordFailure(handler.name, Date.now() - startTime, errorCode);
        throw error;
      }
    },
  };
}
```

### Idempotency for Stage Approval Operations

```typescript
/**
 * Idempotency key storage and validation.
 * Ensures stage approval operations can be safely retried.
 */
interface IdempotencyRecord {
  key: string;
  handlerName: string;
  sessionId: string;
  inputHash: string;
  result: HandlerResult<unknown>;
  createdAt: Date;
  expiresAt: Date;
}

class IdempotencyManager {
  private records: Map<string, IdempotencyRecord> = new Map();
  private logger: Logger;
  private ttlMs: number;

  constructor(logger: Logger, ttlMs: number = 3600000) { // Default 1 hour TTL
    this.logger = logger;
    this.ttlMs = ttlMs;

    // Cleanup expired records periodically
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Generate idempotency key for an operation.
   */
  generateKey(
    sessionId: string,
    handlerName: string,
    input: unknown
  ): string {
    const inputStr = JSON.stringify(input);
    const hash = this.hashString(inputStr);
    return `${sessionId}:${handlerName}:${hash}`;
  }

  /**
   * Check if operation was already completed (idempotent check).
   */
  checkIdempotency<T>(key: string): IdempotencyRecord | null {
    const record = this.records.get(key);

    if (!record) {
      return null;
    }

    // Check if expired
    if (new Date() > record.expiresAt) {
      this.records.delete(key);
      return null;
    }

    this.logger.info('idempotency', 'returning_cached_result', {
      key,
      handlerName: record.handlerName,
      createdAt: record.createdAt.toISOString(),
    });

    return record;
  }

  /**
   * Store operation result for idempotency.
   */
  storeResult<T>(
    key: string,
    handlerName: string,
    sessionId: string,
    inputHash: string,
    result: HandlerResult<T>
  ): void {
    const record: IdempotencyRecord = {
      key,
      handlerName,
      sessionId,
      inputHash,
      result,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.ttlMs),
    };

    this.records.set(key, record);

    this.logger.debug('idempotency', 'result_stored', {
      key,
      handlerName,
      expiresAt: record.expiresAt.toISOString(),
    });
  }

  /**
   * Invalidate idempotency records for a session (e.g., when session state changes).
   */
  invalidateSession(sessionId: string): void {
    const keysToDelete: string[] = [];

    for (const [key, record] of this.records) {
      if (record.sessionId === sessionId) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.records.delete(key);
    }

    this.logger.info('idempotency', 'session_invalidated', {
      sessionId,
      recordsRemoved: keysToDelete.length,
    });
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private cleanup(): void {
    const now = new Date();
    let removed = 0;

    for (const [key, record] of this.records) {
      if (now > record.expiresAt) {
        this.records.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      this.logger.debug('idempotency', 'cleanup_completed', {
        recordsRemoved: removed,
        remainingRecords: this.records.size,
      });
    }
  }
}

/**
 * Idempotent handler wrapper for stage approval operations.
 */
function createIdempotentHandler<TInput, TOutput>(
  handler: MCPHandler<TInput, TOutput>,
  idempotencyManager: IdempotencyManager,
  options: { idempotentOperations: string[] }
): MCPHandler<TInput, TOutput> {
  // Only wrap handlers that need idempotency
  if (!options.idempotentOperations.includes(handler.name)) {
    return handler;
  }

  return {
    ...handler,
    async handler(input: TInput, context: HandlerContext): Promise<HandlerResult<TOutput>> {
      const sessionId = context.sessionId || 'unknown';
      const key = idempotencyManager.generateKey(sessionId, handler.name, input);

      // Check for existing result
      const existing = idempotencyManager.checkIdempotency<TOutput>(key);
      if (existing) {
        return existing.result as HandlerResult<TOutput>;
      }

      // Execute handler
      const result = await handler.handler(input, context);

      // Store result only for successful operations
      if (result.success) {
        const inputHash = idempotencyManager.generateKey(sessionId, '', input);
        idempotencyManager.storeResult(key, handler.name, sessionId, inputHash, result);
      }

      return result;
    },
  };
}

/**
 * Stage approval with idempotency guarantee.
 * Ensures approve_stage can be safely called multiple times with same result.
 */
const idempotentApproveStageHandler: MCPHandler<ApproveStageInput, ProgressResult> = {
  name: 'qmb_approve_stage',
  description: 'Approve the current stage script (idempotent)',
  inputSchema: {
    type: 'object',
    properties: {
      modified_script: { type: 'string', description: 'Modified script (optional)' },
      idempotency_key: { type: 'string', description: 'Optional client-provided idempotency key' },
    },
  },
  async handler(input, context) {
    // Get current stage state
    const currentStage = context.modelBuilder.getCurrentStage();
    const currentStageStatus = context.modelBuilder.getStageStatus(currentStage);

    // Idempotency check: if stage already approved, return success
    if (currentStageStatus === 'approved') {
      const progress = context.modelBuilder.getProgress();

      context.modelBuilder.logger.info('mcp_handler', 'idempotent_return', {
        handler: 'qmb_approve_stage',
        stage: currentStage,
        reason: 'Stage already approved',
      });

      return {
        success: true,
        data: progress,
        message: `Stage ${currentStage} already approved. Progress: ${progress.completed_stages}/${progress.total_stages}`,
      };
    }

    // Proceed with approval
    await context.modelBuilder.approveStage(input.modified_script);
    const progress = context.modelBuilder.getProgress();

    return {
      success: true,
      data: progress,
      message: `Stage approved. Progress: ${progress.completed_stages}/${progress.total_stages}`,
    };
  },
};

// List of handlers that should be idempotent
const IDEMPOTENT_HANDLERS = [
  'qmb_approve_stage',
  'qmb_apply_fixes',
  'qmb_export',
];
```

**Structured Error Response:**
```typescript
interface HandlerError {
  success: false;
  error: string;           // Error code
  message: string;         // User-friendly message
  details?: {
    expected?: string;     // What was expected
    received?: string;     // What was received
    suggestion?: string;   // How to fix
  };
}

// Example
{
  success: false,
  error: 'SESSION_REQUIRED',
  message: 'אין סשן פעיל. יש להתחיל סשן חדש.',
  details: {
    suggestion: 'Use qmb_start_session first'
  }
}
```

**Error Recovery Flow:**
```
1. Validate input against JSON schema
   ├── Invalid → Return ValidationError
   └── Valid → Continue
2. Check handler prerequisites
   ├── Session required but missing → Return SessionRequiredError
   ├── Wrong stage → Return OrderViolationError
   └── OK → Continue
3. Execute handler
   ├── Success → Return result
   └── Error → Catch, log, return HandlerError
4. Never throw - always return structured response
```

## Performance Considerations

| Operation | Time Complexity | Space Complexity | Notes |
|-----------|-----------------|------------------|-------|
| Handler lookup | O(1) | O(1) | Map-based registry |
| Input validation | O(p) | O(1) | p = properties in schema |
| `qmb_start_session` | O(m) | O(1) | m = existing sessions |
| `qmb_build_stage` | O(t × f) | O(t × f) | Delegates to ScriptBuilder |
| `qmb_request_review` | O(n) network | O(n) | n = script size |
| `qmb_export` | O(s) + disk | O(s) | s = output size |
| Response serialization | O(r) | O(r) | r = response size |

**Memory Usage:**
- Handler registry: ~2KB (14 handlers × ~150 bytes)
- Context per request: ~500 bytes
- Response buffers: Variable (script previews can be large)

**Optimization Tips:**
1. Use singleton pattern for handler instances
2. Reuse ModelBuilder instance across requests
3. Stream large script outputs instead of loading all
4. Cache status/progress responses (1 second TTL)
5. Validate input before acquiring locks

**Concurrency Model:**
```typescript
// Session-level locking for state modifications
const sessionLocks = new Map<string, Promise<void>>();

async function withSessionLock<T>(
  sessionId: string,
  operation: () => Promise<T>
): Promise<T> {
  const existing = sessionLocks.get(sessionId);
  const myLock = (async () => {
    if (existing) await existing;
    return operation();
  })();
  sessionLocks.set(sessionId, myLock.then(() => {}));
  try {
    return await myLock;
  } finally {
    sessionLocks.delete(sessionId);
  }
}
```

## Integration Points

| Component | Direction | Data Exchange | Contract |
|-----------|-----------|---------------|----------|
| MCP Server | Handlers ← MCP | Tool calls with params | JSON-RPC style |
| ModelBuilder | Handlers → MB | Orchestrator methods | Full interface |
| Logger | Handlers → Logger | Request/response logging | Via ModelBuilder.logger |
| Scope Guard | Handlers → SG | Pre-validate requests | Optional, for natural language |
| File System | Handlers → FS | Export operations | `qmb_export` only |

**Input Contract (Tool Call):**
```typescript
// MCP tool call format
{
  name: string;          // e.g., 'qmb_build_stage'
  arguments: {
    // Schema-defined properties
    [key: string]: unknown;
  }
}
```

**Output Contract (HandlerResult):**
```typescript
{
  success: boolean;
  data?: T;              // Type-specific result data
  error?: string;        // Error code if success=false
  message?: string;      // User-friendly message
}

// MCP response format
{
  content: [{
    type: 'text',
    text: string         // JSON-serialized HandlerResult
  }],
  isError?: boolean      // true if success=false
}
```

**Handler Registration Contract:**
```typescript
interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: JSONSchema;
}

// Registration
server.tool(
  handler.name,
  handler.description,
  handler.inputSchema,
  async (params) => handler.execute(params, context)
);
```

**Event Pattern:**
```
Handlers do NOT emit events.
Request/response model only.
All async operations return Promises.
Results serialized to JSON for MCP transport.
```

**Handler Dependencies:**
```
qmb_start_session → (none)
qmb_resume_session → (none)
qmb_list_sessions → (none)
qmb_load_spec → session
qmb_select_model → session, spec
qmb_build_stage → session, spec, analysis
qmb_approve_stage → session, current_stage_script
qmb_edit_stage → session, current_stage_script
qmb_go_back → session
qmb_request_review → session, all_stages_approved
qmb_apply_fixes → session, review
qmb_status → (none)
qmb_preview_script → session, approved_stages
qmb_export → session, all_stages_approved
```

## Risk Mitigation & Contingency

| Risk | Impact (days) | Probability | Contingency | Trigger |
|------|--------------|-------------|-------------|---------|
| Handler input validation misses edge cases | 1 | Medium (40%) | Add comprehensive input validation; implement "strict mode" for debugging | User provides unexpected input that causes crash |
| Concurrent handler calls cause state corruption | 2 | Medium (35%) | Implement session-level locking; use idempotency keys for critical operations | Race condition detected in logs |
| MCP protocol changes break handler registration | 2 | Low (20%) | Abstract MCP integration; implement adapter pattern for protocol versioning | MCP server fails to register tools |
| Handler response serialization fails for large scripts | 1 | Low (25%) | Implement pagination for large results; stream responses if possible | JSON serialization timeout or memory error |

## Task Breakdown & Dependencies

| Task | Duration | Dependencies | Critical Path | DoD |
|------|----------|--------------|---------------|-----|
| 10.1 Implement handler infrastructure (registry, context) | 1 day | Sub-Plan 09 (Orchestrator) | YES | ✓ MCPHandler interface defined, ✓ Registry holds all handlers, ✓ Context passed correctly |
| 10.2 Implement session handlers (start, resume, list) | 0.5 day | 10.1 | YES | ✓ qmb_start_session works, ✓ qmb_resume_session loads state, ✓ qmb_list_sessions returns array |
| 10.3 Implement input handlers (load_spec, select_model) | 0.5 day | 10.2 | YES | ✓ qmb_load_spec parses JSON, ✓ qmb_select_model validates enum, ✓ Analysis returned |
| 10.4 Implement stage handlers (build, approve, edit, go_back) | 1 day | 10.3 | YES | ✓ All 4 handlers work, ✓ Progress updated after approve, ✓ Script returned in response |
| 10.5 Implement review handlers (request_review, apply_fixes) | 0.5 day | 10.4 | YES | ✓ Review issues returned, ✓ Score included, ✓ Fix application confirmed |
| 10.6 Implement utility handlers (status, preview, export) | 0.5 day | 10.4 | NO | ✓ Status includes all fields, ✓ Preview returns full script, ✓ Export writes files |
| 10.7 Implement input validation for all handlers | 0.5 day | 10.2-10.6 | YES | ✓ JSON schema validation works, ✓ Required fields enforced, ✓ Path sanitization applied |
| 10.8 Implement error handling and response formatting | 0.5 day | 10.2-10.6 | YES | ✓ HandlerResult format consistent, ✓ Error codes defined, ✓ User-friendly messages (Hebrew) |
| 10.9 Write unit tests for all handlers | 1 day | 10.1-10.8 | YES | ✓ All 14 handlers tested, ✓ Error paths tested, ✓ >90% coverage |
| 10.10 Write MCP integration tests | 0.5 day | 10.9 | NO | ✓ Handlers register with MCP, ✓ Tool calls execute, ✓ Response format correct |

**Critical Path:** 10.1 → 10.2 → 10.3 → 10.4 → 10.5 → 10.7 → 10.8 → 10.9 (5.5 days)

## Resource Requirements

| Resource | Type | Availability | Skills Required |
|----------|------|--------------|-----------------|
| TypeScript Developer | Human | 1 FTE for 6 days | MCP protocol, JSON-RPC, input validation |
| Orchestrator Component | Component | After Sub-Plan 09 | N/A |
| MCP SDK | Dependency | npm package | N/A |
| Claude Code test environment | Infrastructure | Local installation | N/A |
| Sample tool call fixtures | Data | Create test fixtures | N/A |

## Testing Strategy

| Phase | Coverage | Tools | Acceptance Criteria | Rollback Plan |
|-------|----------|-------|---------------------|---------------|
| Unit Testing | All 14 handlers | Jest | 100% handler coverage; correct input validation | N/A - core functionality |
| Input Validation Testing | Edge cases and invalid inputs | Jest with fixtures | All invalid inputs rejected with clear error messages | Loosen validation; add warnings |
| Error Handling Testing | Error scenarios per handler | Jest | Correct error codes and messages; no unhandled exceptions | Add catch-all error handler |
| MCP Integration Testing | Handler registration and invocation | Jest with MCP mock | All handlers register correctly; correct response format | Manual handler testing |
| End-to-End Testing | Complete wizard via Claude Code | Manual test | Full workflow works through Claude Code interface | Document workarounds |

## Communication Plan

- **Daily:** Report handler test coverage; flag any MCP protocol issues
- **Weekly:** Demo Claude Code integration to team; gather UX feedback on tool responses
- **Escalation:** If MCP integration fails, immediately contact MCP SDK maintainers and notify Tech Lead
- **Change Requests:** New handlers require schema definition, test cases, and documentation before implementation

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

- [ ] All 14 handlers implemented
- [ ] Input validation via JSON schema
- [ ] Error handling with clear messages
- [ ] Integration with ModelBuilder orchestrator
- [ ] Handler registration working
- [ ] All tests passing
