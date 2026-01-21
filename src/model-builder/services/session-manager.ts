/**
 * @fileoverview Session Manager for Model Builder
 * @module model-builder/services/session-manager
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { ModelBuilderSession, BuildStage, ModelType, GeminiReviewResponse } from '../types.js';
import { Logger } from './logger.js';

/** Stage order for validation */
const STAGE_ORDER: BuildStage[] = ['A', 'B', 'C', 'D', 'E', 'F'];

/** Maximum session age for resume (24 hours) */
const MAX_RESUME_AGE_HOURS = 24;

/**
 * Summary of a session for listing
 */
export interface SessionSummary {
  session_id: string;
  project_name: string;
  current_stage: BuildStage;
  updated_at: string;
  progress_percent: number;
  model_type: ModelType | null;
}

/**
 * Session Manager Implementation
 */
export class SessionManager {
  private sessionsDir: string;
  private archiveDir: string;
  private logger?: Logger;

  /**
   * Create a new SessionManager
   * @param baseDir - Base directory for .qmb files
   * @param logger - Optional logger instance
   */
  constructor(baseDir: string = '.qmb', logger?: Logger) {
    // Handle both absolute and relative paths
    const resolvedBase = path.isAbsolute(baseDir) ? baseDir : path.join(process.cwd(), baseDir);
    this.sessionsDir = path.join(resolvedBase, 'sessions');
    this.archiveDir = path.join(resolvedBase, 'archive');
    this.logger = logger;
    this.ensureDirectoryExists();
  }

  /**
   * Ensure sessions directory exists
   */
  private ensureDirectoryExists(): void {
    try {
      if (!fs.existsSync(this.sessionsDir)) {
        fs.mkdirSync(this.sessionsDir, { recursive: true });
      }
    } catch (error) {
      this.logger?.error('session_manager', 'directory_creation_failed', {
        path: this.sessionsDir,
        error: String(error),
      });
      throw new Error(`Failed to create sessions directory: ${this.sessionsDir}`);
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    return `qmb-${timestamp}-${random}`;
  }

  /**
   * Get file path for a session
   */
  private getSessionPath(sessionId: string): string {
    return path.join(this.sessionsDir, `${sessionId}.json`);
  }

  /**
   * Calculate progress percentage based on completed stages
   */
  private calculateProgress(session: ModelBuilderSession): number {
    const completedCount = session.completed_stages.length;
    return Math.round((completedCount / STAGE_ORDER.length) * 100);
  }

  /**
   * Create a new session
   */
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
    this.logger?.info('session_manager', 'session_created', {
      session_id: session.session_id,
      project_name: projectName,
    });

    return session;
  }

  /**
   * Save session with atomic write
   */
  saveSession(session: ModelBuilderSession): void {
    const filePath = this.getSessionPath(session.session_id);
    const tempPath = `${filePath}.tmp`;
    const backupPath = `${filePath}.bak`;

    // Update timestamp
    session.updated_at = new Date().toISOString();

    try {
      const content = JSON.stringify(session, null, 2);

      // Write to temp file first
      fs.writeFileSync(tempPath, content, 'utf8');

      // Backup existing file if it exists
      if (fs.existsSync(filePath)) {
        fs.renameSync(filePath, backupPath);
      }

      // Atomic rename
      fs.renameSync(tempPath, filePath);

      this.logger?.debug('session_manager', 'session_saved', {
        session_id: session.session_id,
        stage: session.current_stage,
      });
    } catch (error) {
      // Cleanup temp file if it exists
      if (fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
        } catch {
          // Ignore cleanup errors
        }
      }

      this.logger?.error('session_manager', 'session_save_failed', {
        session_id: session.session_id,
        error: String(error),
      });

      throw new Error(`Failed to save session: ${error}`);
    }
  }

  /**
   * Load session by ID
   */
  loadSession(sessionId: string): ModelBuilderSession | null {
    const filePath = this.getSessionPath(sessionId);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const session = JSON.parse(content) as ModelBuilderSession;

      // Validate required fields
      if (!session.session_id || !session.project_name || !session.current_stage) {
        this.logger?.warn('session_manager', 'invalid_session_file', {
          session_id: sessionId,
          reason: 'missing required fields',
        });
        return null;
      }

      return session;
    } catch (error) {
      // Try loading from backup
      const backupPath = `${filePath}.bak`;
      if (fs.existsSync(backupPath)) {
        this.logger?.warn('session_manager', 'loading_from_backup', {
          session_id: sessionId,
        });
        try {
          const backupContent = fs.readFileSync(backupPath, 'utf8');
          return JSON.parse(backupContent) as ModelBuilderSession;
        } catch {
          // Backup also corrupted
        }
      }

      this.logger?.error('session_manager', 'session_load_failed', {
        session_id: sessionId,
        error: String(error),
      });
      return null;
    }
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): boolean {
    const filePath = this.getSessionPath(sessionId);
    const backupPath = `${filePath}.bak`;

    // Check if session exists before attempting delete
    if (!fs.existsSync(filePath) && !fs.existsSync(backupPath)) {
      return false;
    }

    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }

      this.logger?.info('session_manager', 'session_deleted', {
        session_id: sessionId,
      });
      return true;
    } catch (error) {
      this.logger?.error('session_manager', 'session_delete_failed', {
        session_id: sessionId,
        error: String(error),
      });
      return false;
    }
  }

  /**
   * Advance to the next stage
   */
  advanceStage(session: ModelBuilderSession, targetStage: BuildStage): void {
    const currentIndex = STAGE_ORDER.indexOf(session.current_stage);
    const targetIndex = STAGE_ORDER.indexOf(targetStage);

    if (targetIndex !== currentIndex + 1) {
      throw new Error(
        `Cannot advance from stage ${session.current_stage} to ${targetStage}. ` +
        `Expected next stage: ${STAGE_ORDER[currentIndex + 1] || 'complete'}`
      );
    }

    session.current_stage = targetStage;
    this.saveSession(session);

    this.logger?.info('session_manager', 'stage_advanced', {
      session_id: session.session_id,
      from_stage: STAGE_ORDER[currentIndex],
      to_stage: targetStage,
    });
  }

  /**
   * Approve a stage and store the script
   */
  approveStage(session: ModelBuilderSession, stage: BuildStage, script: string): void {
    // Add to completed stages if not already there
    if (!session.completed_stages.includes(stage)) {
      session.completed_stages.push(stage);
      // Sort to maintain order
      session.completed_stages.sort(
        (a, b) => STAGE_ORDER.indexOf(a) - STAGE_ORDER.indexOf(b)
      );
    }

    // Store the approved script
    session.approved_script_parts[stage] = script;

    this.saveSession(session);

    this.logger?.info('session_manager', 'stage_approved', {
      session_id: session.session_id,
      stage,
      script_length: script.length,
    });
  }

  /**
   * Revert to a previous stage (clears later stages)
   */
  revertToStage(session: ModelBuilderSession, targetStage: BuildStage): void {
    const targetIndex = STAGE_ORDER.indexOf(targetStage);
    const currentIndex = STAGE_ORDER.indexOf(session.current_stage);

    if (targetIndex >= currentIndex) {
      throw new Error(`Cannot revert forward from ${session.current_stage} to ${targetStage}`);
    }

    // Remove completed stages after target
    session.completed_stages = session.completed_stages.filter(
      s => STAGE_ORDER.indexOf(s) <= targetIndex
    );

    // Remove approved scripts for later stages
    for (let i = targetIndex + 1; i < STAGE_ORDER.length; i++) {
      delete session.approved_script_parts[STAGE_ORDER[i]];
    }

    session.current_stage = targetStage;
    this.saveSession(session);

    this.logger?.info('session_manager', 'stage_reverted', {
      session_id: session.session_id,
      from_stage: STAGE_ORDER[currentIndex],
      to_stage: targetStage,
    });
  }

  /**
   * Set model type for session
   */
  setModelType(session: ModelBuilderSession, modelType: ModelType): void {
    session.model_type = modelType;
    this.saveSession(session);

    this.logger?.info('session_manager', 'model_type_set', {
      session_id: session.session_id,
      model_type: modelType,
    });
  }

  /**
   * Add Gemini review to session
   */
  addGeminiReview(session: ModelBuilderSession, review: GeminiReviewResponse): void {
    session.gemini_reviews.push(review);
    this.saveSession(session);

    this.logger?.info('session_manager', 'gemini_review_added', {
      session_id: session.session_id,
      score: review.score,
      status: review.review_status,
    });
  }

  /**
   * Update pending tables
   */
  setPendingTables(session: ModelBuilderSession, tables: string[]): void {
    session.pending_tables = tables;
    this.saveSession(session);
  }

  /**
   * List all sessions
   */
  listSessions(userId?: string): SessionSummary[] {
    const summaries: SessionSummary[] = [];

    try {
      const files = fs.readdirSync(this.sessionsDir);

      for (const file of files) {
        if (!file.endsWith('.json') || file.endsWith('.bak') || file.endsWith('.tmp')) {
          continue;
        }

        const sessionId = file.replace('.json', '');
        const session = this.loadSession(sessionId);

        if (!session) continue;

        // Filter by userId if provided
        if (userId && session.user_id !== userId) {
          continue;
        }

        summaries.push({
          session_id: session.session_id,
          project_name: session.project_name,
          current_stage: session.current_stage,
          updated_at: session.updated_at,
          progress_percent: this.calculateProgress(session),
          model_type: session.model_type,
        });
      }

      // Sort by updated_at descending (most recent first)
      summaries.sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    } catch (error) {
      this.logger?.error('session_manager', 'list_sessions_failed', {
        error: String(error),
      });
    }

    return summaries;
  }

  /**
   * Find the most recent session for a project
   */
  findRecentSession(projectName: string): ModelBuilderSession | null {
    const sessions = this.listSessions()
      .filter(s => s.project_name === projectName);

    if (sessions.length === 0) {
      return null;
    }

    // Get most recent
    const recent = sessions[0];
    const ageHours =
      (Date.now() - new Date(recent.updated_at).getTime()) / (1000 * 60 * 60);

    // Only return if within resume window
    if (ageHours > MAX_RESUME_AGE_HOURS) {
      return null;
    }

    return this.loadSession(recent.session_id);
  }

  /**
   * Archive a completed session
   */
  archiveSession(sessionId: string): string | null {
    const session = this.loadSession(sessionId);
    if (!session) {
      return null;
    }

    try {
      // Ensure archive directory exists
      if (!fs.existsSync(this.archiveDir)) {
        fs.mkdirSync(this.archiveDir, { recursive: true });
      }

      const archivePath = path.join(this.archiveDir, `${sessionId}.json`);
      fs.writeFileSync(archivePath, JSON.stringify(session, null, 2));

      // Delete from active sessions
      this.deleteSession(sessionId);

      this.logger?.info('session_manager', 'session_archived', {
        session_id: sessionId,
        archive_path: archivePath,
      });

      return archivePath;
    } catch (error) {
      this.logger?.error('session_manager', 'archive_failed', {
        session_id: sessionId,
        error: String(error),
      });
      return null;
    }
  }

  /**
   * Cleanup old sessions
   */
  cleanupOldSessions(maxAgeDays: number): number {
    const cutoffTime = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    const sessions = this.listSessions();

    for (const summary of sessions) {
      const sessionTime = new Date(summary.updated_at).getTime();

      if (sessionTime < cutoffTime) {
        if (this.deleteSession(summary.session_id)) {
          deletedCount++;
        }
      }
    }

    this.logger?.info('session_manager', 'cleanup_completed', {
      deleted_count: deletedCount,
      max_age_days: maxAgeDays,
    });

    return deletedCount;
  }

  /**
   * Check if a session exists
   */
  sessionExists(sessionId: string): boolean {
    return fs.existsSync(this.getSessionPath(sessionId));
  }

  /**
   * Get sessions directory path
   */
  getSessionsDir(): string {
    return this.sessionsDir;
  }
}

/**
 * Factory function to create a SessionManager
 */
export function createSessionManager(baseDir?: string, logger?: Logger): SessionManager {
  return new SessionManager(baseDir, logger);
}

export default SessionManager;
