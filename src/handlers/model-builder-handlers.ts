/**
 * Data Model Builder Stage 2 - MCP Handlers
 * Handler implementations for Stage 2 model building tools
 */

import { CallToolResult, TextContent } from '@modelcontextprotocol/sdk/types.js';
import {
  ModelBuilder,
  createModelBuilder,
  ModelBuilderConfig,
  SessionError,
  WorkflowError,
} from '../model-builder/model-builder.js';
import {
  ModelType,
  BuildStage,
  Stage1Input,
  QvdSampleData,
} from '../model-builder/types.js';

// ============================================================================
// Singleton ModelBuilder Instance
// ============================================================================

let modelBuilderInstance: ModelBuilder | null = null;

/**
 * Get or create the ModelBuilder singleton instance
 */
function getModelBuilder(config?: ModelBuilderConfig): ModelBuilder {
  if (!modelBuilderInstance) {
    const apiKey = process.env.GEMINI_API_KEY || '';
    modelBuilderInstance = createModelBuilder({
      baseDir: '.qmb',
      geminiConfig: { api_key: apiKey },
      defaultQvdPath: 'lib://QVD/',
      defaultCalendarLanguage: 'EN',
      useAutonumber: true,
      ...config,
    });
  }
  return modelBuilderInstance;
}

/**
 * Reset the ModelBuilder instance (for testing)
 */
export function resetModelBuilder(): void {
  if (modelBuilderInstance) {
    modelBuilderInstance.shutdown();
    modelBuilderInstance = null;
  }
}

// ============================================================================
// Main Handler
// ============================================================================

/**
 * Handle Data Model Builder Stage 2 tool calls
 */
export async function handleModelBuilderTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<CallToolResult> {
  const builder = getModelBuilder();

  try {
    switch (toolName) {
      // ============================================================
      // Initialization
      // ============================================================
      case 'dmb_initialize': {
        await builder.initialize();
        return success('Data Model Builder initialized successfully.\n\nUse dmb_start_session to begin a new project.');
      }

      // ============================================================
      // Session Management
      // ============================================================
      case 'dmb_start_session': {
        const projectName = args.projectName as string;
        if (!projectName) {
          return error('projectName is required');
        }

        const session = builder.startSession(projectName);
        return success(
          `Session started successfully!\n\n` +
          `Session ID: ${session.session_id}\n` +
          `Project: ${session.project_name}\n` +
          `Current Stage: ${session.current_stage}\n\n` +
          `Next step: Use dmb_process_input to load your Stage 1 JSON and QVD samples.`
        );
      }

      case 'dmb_resume_session': {
        const sessionId = args.sessionId as string;
        if (!sessionId) {
          return error('sessionId is required');
        }

        const session = builder.resumeSession(sessionId);
        return success(
          `Session resumed!\n\n` +
          `Session ID: ${session.session_id}\n` +
          `Project: ${session.project_name}\n` +
          `Current Stage: ${session.current_stage}\n` +
          `Completed Stages: ${session.completed_stages.join(', ') || 'None'}\n` +
          `Model Type: ${session.model_type || 'Not selected'}`
        );
      }

      case 'dmb_find_session': {
        const projectName = args.projectName as string;
        if (!projectName) {
          return error('projectName is required');
        }

        const session = builder.findRecentSession(projectName);
        if (session) {
          return success(
            `Found recent session for "${projectName}":\n\n` +
            `Session ID: ${session.session_id}\n` +
            `Current Stage: ${session.current_stage}\n` +
            `Last Updated: ${session.updated_at}\n\n` +
            `Use dmb_resume_session to continue.`
          );
        } else {
          return success(
            `No existing session found for "${projectName}".\n\n` +
            `Use dmb_start_session to create a new session.`
          );
        }
      }

      case 'dmb_list_sessions': {
        const sessions = builder.listSessions();
        if (sessions.length === 0) {
          return success('No sessions found.\n\nUse dmb_start_session to create a new session.');
        }

        const sessionList = sessions.map(s =>
          `- ${s.project_name} (${s.session_id})\n  Stage: ${s.current_stage} | Model: ${s.model_type || 'N/A'} | Updated: ${s.updated_at}`
        ).join('\n\n');

        return success(`Found ${sessions.length} sessions:\n\n${sessionList}`);
      }

      case 'dmb_status': {
        const progress = builder.getProgress();
        if (!progress) {
          return success('No active session. Use dmb_start_session to begin.');
        }

        return success(formatProgress(progress as unknown as Record<string, unknown>));
      }

      // ============================================================
      // Input Processing
      // ============================================================
      case 'dmb_process_input': {
        const stage1Json = args.stage1Json as unknown;
        const qvdSamples = args.qvdSamples as unknown[];

        if (!stage1Json) {
          return error('stage1Json is required (Stage 1 parser output)');
        }
        if (!qvdSamples || !Array.isArray(qvdSamples)) {
          return error('qvdSamples is required (array of QVD sample data)');
        }

        const spec = builder.processInput(stage1Json, qvdSamples);
        const analysis = builder.getAnalysisResult();

        let response = `Input processed successfully!\n\n`;
        response += `Tables: ${spec.tables.length}\n`;
        response += `Relationships: ${spec.relationships.length}\n`;
        response += `Date Fields: ${spec.date_fields.length}\n\n`;

        if (spec.recommended_model_type) {
          response += `Recommended Model: ${spec.recommended_model_type}\n`;
          response += `Confidence: ${(spec.recommendation_confidence! * 100).toFixed(0)}%\n\n`;
        }

        if (analysis) {
          response += `Table Classifications:\n`;
          for (const [tableName, classification] of analysis.classifications) {
            response += `- ${tableName}: ${classification.classification} (${(classification.confidence * 100).toFixed(0)}% confidence)\n`;
          }
        }

        response += `\nNext step: Use dmb_select_model_type to choose your data model type.`;
        return success(response);
      }

      case 'dmb_get_analysis': {
        const analysis = builder.getAnalysisResult();
        if (!analysis) {
          return error('No analysis available. Call dmb_process_input first.');
        }

        let response = `Model Analysis Report\n`;
        response += `${'='.repeat(50)}\n\n`;

        response += `Recommended Model: ${analysis.model_recommendation.recommended_model}\n`;
        response += `Confidence: ${(analysis.model_recommendation.confidence * 100).toFixed(0)}%\n`;
        response += `Reasoning: ${analysis.model_recommendation.reasoning}\n\n`;

        response += `Table Classifications:\n`;
        for (const [tableName, classification] of analysis.classifications) {
          response += `\n${tableName}:\n`;
          response += `  Type: ${classification.classification}\n`;
          response += `  Confidence: ${(classification.confidence * 100).toFixed(0)}%\n`;
          response += `  Evidence: ${classification.reasoning.slice(0, 3).join('; ')}\n`;
        }

        return success(response);
      }

      // ============================================================
      // Model Type Selection
      // ============================================================
      case 'dmb_select_model_type': {
        const modelType = args.modelType as ModelType;
        const validTypes: ModelType[] = ['star_schema', 'snowflake', 'link_table', 'concatenated'];

        if (!modelType || !validTypes.includes(modelType)) {
          return error(
            `Invalid model type. Choose one of:\n` +
            `- star_schema: Central fact table with dimension tables\n` +
            `- snowflake: Normalized dimensions (dimensions of dimensions)\n` +
            `- link_table: Uses link tables for M:N relationships\n` +
            `- concatenated: Concatenated fact tables with shared dimensions`
          );
        }

        builder.selectModelType(modelType);

        return success(
          `Model type selected: ${modelType}\n\n` +
          `Next step: Use dmb_build_stage to generate scripts stage by stage.`
        );
      }

      case 'dmb_update_config': {
        const updates: Record<string, unknown> = {};
        if (args.qvdPath) updates.qvd_path = args.qvdPath as string;
        if (args.calendarLanguage) updates.calendar_language = args.calendarLanguage as 'EN' | 'HE';
        if (args.useAutonumber !== undefined) updates.use_autonumber = args.useAutonumber as boolean;
        if (args.projectName) updates.project_name = args.projectName as string;

        builder.updateBuildConfig(updates as any);

        return success(
          `Build configuration updated:\n` +
          Object.entries(updates).map(([k, v]) => `- ${k}: ${v}`).join('\n')
        );
      }

      // ============================================================
      // Stage Building
      // ============================================================
      case 'dmb_build_stage': {
        const stage = args.stage as BuildStage | undefined;
        const result = stage
          ? builder.buildStage(stage)
          : builder.buildCurrentStage();

        if (!result.success) {
          return error(`Failed to build stage ${result.stage}: ${result.error}`);
        }

        let response = `Stage ${result.stage} built successfully!\n\n`;
        response += `Tables included: ${result.script!.tables_included.join(', ') || 'None'}\n`;
        response += `Estimated lines: ${result.script!.estimated_lines}\n\n`;
        response += `Script:\n\`\`\`qlik\n${result.script!.script}\n\`\`\`\n\n`;
        response += `Use dmb_approve_stage to approve and proceed, or dmb_build_stage to regenerate.`;

        return success(response);
      }

      case 'dmb_approve_stage': {
        const script = args.script as string;
        if (!script) {
          // Get current stage script
          const result = builder.buildCurrentStage();
          if (!result.success) {
            return error('No script to approve. Build the stage first.');
          }
          builder.approveCurrentStage(result.script!.script);
        } else {
          builder.approveCurrentStage(script);
        }

        const progress = builder.getProgress();
        return success(
          `Stage approved!\n\n` +
          `Current stage: ${progress!.current_stage}\n` +
          `Completed: ${progress!.completed_stages.join(', ')}\n` +
          `Progress: ${progress!.progress_percent}%\n\n` +
          (progress!.progress_percent < 100
            ? `Next: Use dmb_build_stage to build stage ${progress!.current_stage}.`
            : `All stages complete! Use dmb_request_review to get Gemini review.`)
        );
      }

      case 'dmb_go_back': {
        const targetStage = args.stage as BuildStage;
        if (!targetStage) {
          return error('stage is required (A, B, C, D, E, or F)');
        }

        builder.goBackToStage(targetStage);

        const progress = builder.getProgress();
        return success(
          `Reverted to stage ${targetStage}.\n\n` +
          `Current stage: ${progress!.current_stage}\n` +
          `Completed: ${progress!.completed_stages.join(', ') || 'None'}`
        );
      }

      case 'dmb_get_script': {
        const script = builder.getAssembledScript();
        if (!script) {
          return success('No script generated yet. Build and approve stages first.');
        }

        return success(`Assembled Qlik Script:\n\n\`\`\`qlik\n${script}\n\`\`\``);
      }

      // ============================================================
      // Scope Validation
      // ============================================================
      case 'dmb_validate_request': {
        const request = args.request as string;
        if (!request) {
          return error('request is required');
        }

        const result = builder.validateRequest(request);

        if (result.allowed) {
          return success(
            `Request allowed.\n\n` +
            `Intent: ${result.intent}\n` +
            `You can proceed with this request.`
          );
        } else {
          return success(
            `Request blocked.\n\n` +
            `Reason: ${result.reason}\n\n` +
            `${result.rejection_message}`
          );
        }
      }

      // ============================================================
      // Review
      // ============================================================
      case 'dmb_request_review': {
        const result = await builder.requestReview();

        if (!result.success) {
          return error(`Review failed: ${result.error}`);
        }

        const review = result.review!;
        let response = `Gemini Review Complete!\n\n`;
        response += `Status: ${review.review_status}\n`;
        response += `Score: ${review.score}/100\n\n`;

        if (review.issues.length > 0) {
          response += `Issues Found (${review.issues.length}):\n`;
          for (const issue of review.issues) {
            response += `\n[${issue.severity.toUpperCase()}] ${issue.title}\n`;
            response += `  ${issue.description}\n`;
            response += `  → ${issue.recommendation}\n`;
          }
        } else {
          response += `No issues found! Script follows best practices.\n`;
        }

        response += `\n${review.summary}`;
        return success(response);
      }

      case 'dmb_get_reviews': {
        const reviews = builder.getReviews();
        if (reviews.length === 0) {
          return success('No reviews yet. Use dmb_request_review to get a Gemini review.');
        }

        let response = `Review History (${reviews.length} reviews):\n\n`;
        for (let i = 0; i < reviews.length; i++) {
          const review = reviews[i];
          response += `Review ${i + 1}: Score ${review.score}/100 - ${review.review_status}\n`;
          response += `  Issues: ${review.issues.length}\n`;
        }

        return success(response);
      }

      // ============================================================
      // Export
      // ============================================================
      case 'dmb_export': {
        const output = builder.exportOutput();

        let response = `Stage 2 Output Exported!\n\n`;
        response += `Model Type: ${output.model_type}\n`;
        response += `Created: ${output.created_at}\n\n`;
        response += `Facts: ${output.facts.length}\n`;
        response += `Dimensions: ${output.dimensions.length}\n`;
        response += `Calendars: ${output.calendars.length}\n`;
        response += `Relationships: ${output.relationships.length}\n\n`;
        response += `Gemini Review Score: ${output.gemini_review.score}/100\n`;
        response += `Status: ${output.gemini_review.status}\n\n`;
        response += `Full output:\n\`\`\`json\n${JSON.stringify(output, null, 2)}\n\`\`\``;

        return success(response);
      }

      // ============================================================
      // Help
      // ============================================================
      case 'dmb_help': {
        const topic = args.topic as string | undefined;
        return success(getHelp(topic));
      }

      default:
        return error(`Unknown Data Model Builder tool: ${toolName}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Provide helpful context for common errors
    if (err instanceof SessionError) {
      return error(`Session error: ${message}\n\nUse dmb_start_session to begin.`);
    }
    if (err instanceof WorkflowError) {
      return error(`Workflow error: ${message}\n\nUse dmb_status to check your progress.`);
    }

    return error(`Error in ${toolName}: ${message}`);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format progress information
 */
function formatProgress(progress: Record<string, unknown>): string {
  const p = progress as {
    session_id: string;
    project_name: string;
    current_stage: string;
    completed_stages: string[];
    progress_percent: number;
    model_type: string | null;
    pending_tables: string[];
    total_reviews: number;
    latest_score?: number;
  };

  const stageBar = ['A', 'B', 'C', 'D', 'E', 'F'].map(s => {
    if (p.completed_stages.includes(s as BuildStage)) return `[${s}]`;
    if (s === p.current_stage) return `>${s}<`;
    return ` ${s} `;
  }).join(' ');

  let response = `Data Model Builder Progress\n`;
  response += `${'='.repeat(50)}\n\n`;
  response += `Project: ${p.project_name}\n`;
  response += `Session: ${p.session_id}\n\n`;
  response += `Stages: ${stageBar}\n`;
  response += `Progress: ${p.progress_percent}%\n\n`;
  response += `Model Type: ${p.model_type || 'Not selected'}\n`;
  response += `Pending Tables: ${p.pending_tables.length}\n`;
  response += `Reviews: ${p.total_reviews}`;
  if (p.latest_score !== undefined) {
    response += ` (Latest: ${p.latest_score}/100)`;
  }
  response += `\n`;

  return response;
}

/**
 * Get help text
 */
function getHelp(topic?: string): string {
  const topics: Record<string, string> = {
    overview: `
Data Model Builder Stage 2 - Overview
=====================================

Stage 2 transforms Stage 1 JSON output into optimized Qlik load scripts.

Workflow:
1. dmb_start_session - Start a new project
2. dmb_process_input - Load Stage 1 JSON + QVD samples
3. dmb_select_model_type - Choose star/snowflake/link/flat
4. dmb_build_stage (x6) - Build stages A-F
5. dmb_request_review - Get Gemini review
6. dmb_export - Export final output

Stages:
- A: Configuration (QUALIFY, variables)
- B: Dimension tables
- C: Fact tables
- D: Link tables
- E: Calendar subroutines
- F: Final assembly (UNQUALIFY, STORE)
`,

    stages: `
Build Stages
============

Stage A - Configuration
  Sets up QUALIFY *, project variables, connection paths

Stage B - Dimensions
  Loads dimension tables with ID→Key renaming
  Selects attributes, excludes unnecessary fields

Stage C - Facts
  Loads fact tables with FK links to dimensions
  Includes measures and date keys

Stage D - Link Tables
  Creates link tables for M:N relationships
  Uses AUTONUMBER for synthetic keys

Stage E - Calendars
  Generates calendar subroutine for date dimensions
  Supports EN/HE calendar field names

Stage F - Assembly
  UNQUALIFY keys for association
  STORE to QVD statements
`,

    commands: `
Available Commands
==================

Session:
  dmb_start_session     - Start new project
  dmb_resume_session    - Resume existing session
  dmb_find_session      - Find session by project name
  dmb_list_sessions     - List all sessions
  dmb_status            - Show current progress

Input:
  dmb_process_input     - Load Stage 1 JSON + QVD samples
  dmb_get_analysis      - View table analysis

Configuration:
  dmb_select_model_type - Choose model type
  dmb_update_config     - Update build settings

Building:
  dmb_build_stage       - Build a stage script
  dmb_approve_stage     - Approve and advance
  dmb_go_back           - Go back to earlier stage
  dmb_get_script        - Get assembled script

Review:
  dmb_request_review    - Request Gemini review
  dmb_get_reviews       - View review history

Export:
  dmb_export            - Export Stage 2 output
`,
  };

  if (topic && topics[topic]) {
    return topics[topic];
  }

  return topics.overview + '\n\nUse dmb_help topic:"stages" or dmb_help topic:"commands" for more details.';
}

/**
 * Create success response
 */
function success(message: string): CallToolResult {
  return {
    content: [{ type: 'text', text: message } as TextContent],
  };
}

/**
 * Create error response
 */
function error(message: string): CallToolResult {
  return {
    content: [{ type: 'text', text: `Error: ${message}` } as TextContent],
    isError: true,
  };
}
