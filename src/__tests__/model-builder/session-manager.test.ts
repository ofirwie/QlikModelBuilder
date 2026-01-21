/**
 * @fileoverview Unit tests for Session Manager
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SessionManager, createSessionManager } from '../../model-builder/services/session-manager.js';
import { ModelBuilderSession, BuildStage } from '../../model-builder/types.js';

describe('SessionManager', () => {
  let testDir: string;
  let manager: SessionManager;

  beforeEach(() => {
    // Create temporary directory for test
    testDir = path.join(os.tmpdir(), `qmb-session-test-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });
    manager = new SessionManager(testDir);
  });

  afterEach(() => {
    // Cleanup
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('createSession', () => {
    it('should create session with unique ID', () => {
      const session1 = manager.createSession('Project1');
      const session2 = manager.createSession('Project2');

      expect(session1.session_id).not.toBe(session2.session_id);
      expect(session1.session_id).toMatch(/^qmb-\d+-[a-f0-9]{8}$/);
    });

    it('should initialize at stage A', () => {
      const session = manager.createSession('TestProject');
      expect(session.current_stage).toBe('A');
    });

    it('should save to disk immediately', () => {
      const session = manager.createSession('TestProject');
      const filePath = path.join(testDir, 'sessions', `${session.session_id}.json`);
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should include project name and timestamps', () => {
      const session = manager.createSession('MyProject', 'user123');

      expect(session.project_name).toBe('MyProject');
      expect(session.user_id).toBe('user123');
      expect(session.created_at).toBeDefined();
      expect(session.updated_at).toBeDefined();

      // Timestamps should be ISO format
      expect(new Date(session.created_at).toISOString()).toBe(session.created_at);
    });

    it('should initialize with empty collections', () => {
      const session = manager.createSession('TestProject');

      expect(session.completed_stages).toEqual([]);
      expect(session.pending_tables).toEqual([]);
      expect(session.gemini_reviews).toEqual([]);
      expect(session.approved_script_parts).toEqual({});
      expect(session.model_type).toBeNull();
    });
  });

  describe('loadSession', () => {
    it('should load existing session', () => {
      const created = manager.createSession('LoadTest');
      const loaded = manager.loadSession(created.session_id);

      expect(loaded).not.toBeNull();
      expect(loaded!.session_id).toBe(created.session_id);
      expect(loaded!.project_name).toBe('LoadTest');
    });

    it('should return null for non-existent session', () => {
      const loaded = manager.loadSession('non-existent-id');
      expect(loaded).toBeNull();
    });

    it('should handle corrupted JSON gracefully', () => {
      // Create a session
      const session = manager.createSession('CorruptTest');
      const filePath = path.join(testDir, 'sessions', `${session.session_id}.json`);

      // Corrupt the file
      fs.writeFileSync(filePath, 'not valid json {{{');

      // Should return null without throwing
      const loaded = manager.loadSession(session.session_id);
      expect(loaded).toBeNull();
    });

    it('should load from backup if main file is corrupted', () => {
      const session = manager.createSession('BackupTest');
      const filePath = path.join(testDir, 'sessions', `${session.session_id}.json`);
      const backupPath = `${filePath}.bak`;

      // Save a valid backup
      fs.writeFileSync(backupPath, JSON.stringify(session));

      // Corrupt main file
      fs.writeFileSync(filePath, 'corrupted');

      // Should load from backup
      const loaded = manager.loadSession(session.session_id);
      expect(loaded).not.toBeNull();
      expect(loaded!.session_id).toBe(session.session_id);
    });
  });

  describe('saveSession', () => {
    it('should save session changes', () => {
      const session = manager.createSession('SaveTest');
      session.model_type = 'star_schema';

      manager.saveSession(session);

      const loaded = manager.loadSession(session.session_id);
      expect(loaded!.model_type).toBe('star_schema');
    });

    it('should update timestamp on save', () => {
      const session = manager.createSession('TimestampTest');
      const originalTime = session.updated_at;

      // Wait a bit
      const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
      return wait(10).then(() => {
        manager.saveSession(session);
        const loaded = manager.loadSession(session.session_id);
        expect(loaded!.updated_at).not.toBe(originalTime);
      });
    });

    it('should create backup on save', () => {
      const session = manager.createSession('BackupSaveTest');
      const filePath = path.join(testDir, 'sessions', `${session.session_id}.json`);
      const backupPath = `${filePath}.bak`;

      // First save creates main file
      expect(fs.existsSync(filePath)).toBe(true);

      // Second save should create backup
      session.model_type = 'snowflake';
      manager.saveSession(session);

      expect(fs.existsSync(backupPath)).toBe(true);
    });
  });

  describe('deleteSession', () => {
    it('should delete session file', () => {
      const session = manager.createSession('DeleteTest');
      const filePath = path.join(testDir, 'sessions', `${session.session_id}.json`);

      expect(fs.existsSync(filePath)).toBe(true);

      const result = manager.deleteSession(session.session_id);
      expect(result).toBe(true);
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('should also delete backup file', () => {
      const session = manager.createSession('DeleteBackupTest');
      const filePath = path.join(testDir, 'sessions', `${session.session_id}.json`);
      const backupPath = `${filePath}.bak`;

      // Create backup by saving twice
      manager.saveSession(session);

      const result = manager.deleteSession(session.session_id);
      expect(result).toBe(true);
      expect(fs.existsSync(backupPath)).toBe(false);
    });

    it('should return false for non-existent session', () => {
      const result = manager.deleteSession('does-not-exist');
      expect(result).toBe(false);
    });
  });

  describe('advanceStage', () => {
    it('should advance from A to B', () => {
      const session = manager.createSession('AdvanceTest');
      expect(session.current_stage).toBe('A');

      manager.advanceStage(session, 'B');
      expect(session.current_stage).toBe('B');
    });

    it('should reject skip from A to C', () => {
      const session = manager.createSession('SkipTest');

      expect(() => {
        manager.advanceStage(session, 'C');
      }).toThrow(/Cannot advance from stage A to C/);
    });

    it('should update timestamp on advance', () => {
      const session = manager.createSession('AdvanceTimestampTest');
      const originalTime = session.updated_at;

      return new Promise<void>(resolve => {
        setTimeout(() => {
          manager.advanceStage(session, 'B');
          expect(session.updated_at).not.toBe(originalTime);
          resolve();
        }, 10);
      });
    });

    it('should persist advanced stage', () => {
      const session = manager.createSession('PersistStageTest');
      manager.advanceStage(session, 'B');

      const loaded = manager.loadSession(session.session_id);
      expect(loaded!.current_stage).toBe('B');
    });
  });

  describe('approveStage', () => {
    it('should add stage to completed_stages', () => {
      const session = manager.createSession('ApproveTest');
      manager.approveStage(session, 'A', 'QUALIFY *;');

      expect(session.completed_stages).toContain('A');
    });

    it('should store script in approved_script_parts', () => {
      const session = manager.createSession('ScriptTest');
      const script = 'LOAD * FROM data.qvd;';

      manager.approveStage(session, 'A', script);

      expect(session.approved_script_parts['A']).toBe(script);
    });

    it('should not duplicate stages', () => {
      const session = manager.createSession('DuplicateTest');

      manager.approveStage(session, 'A', 'script1');
      manager.approveStage(session, 'A', 'script2');

      // Should only have one 'A' in completed stages
      expect(session.completed_stages.filter(s => s === 'A').length).toBe(1);
      // But script should be updated
      expect(session.approved_script_parts['A']).toBe('script2');
    });

    it('should maintain stage order in completed_stages', () => {
      const session = manager.createSession('OrderTest');

      manager.approveStage(session, 'B', 'script B');
      manager.approveStage(session, 'A', 'script A');

      // Should be sorted
      expect(session.completed_stages[0]).toBe('A');
      expect(session.completed_stages[1]).toBe('B');
    });
  });

  describe('revertToStage', () => {
    it('should revert to earlier stage', () => {
      const session = manager.createSession('RevertTest');
      manager.approveStage(session, 'A', 'script A');
      manager.advanceStage(session, 'B');
      manager.approveStage(session, 'B', 'script B');
      manager.advanceStage(session, 'C');

      manager.revertToStage(session, 'A');

      expect(session.current_stage).toBe('A');
    });

    it('should clear later stages from completed', () => {
      const session = manager.createSession('RevertClearTest');
      manager.approveStage(session, 'A', 'script A');
      manager.advanceStage(session, 'B');
      manager.approveStage(session, 'B', 'script B');
      manager.advanceStage(session, 'C');

      manager.revertToStage(session, 'A');

      expect(session.completed_stages).toContain('A');
      expect(session.completed_stages).not.toContain('B');
    });

    it('should clear scripts for later stages', () => {
      const session = manager.createSession('RevertScriptsTest');
      manager.approveStage(session, 'A', 'script A');
      manager.advanceStage(session, 'B');
      manager.approveStage(session, 'B', 'script B');
      manager.advanceStage(session, 'C');

      manager.revertToStage(session, 'A');

      expect(session.approved_script_parts['A']).toBe('script A');
      expect(session.approved_script_parts['B']).toBeUndefined();
    });

    it('should reject revert forward', () => {
      const session = manager.createSession('RevertForwardTest');

      expect(() => {
        manager.revertToStage(session, 'B');
      }).toThrow(/Cannot revert forward/);
    });
  });

  describe('listSessions', () => {
    it('should list all sessions', () => {
      manager.createSession('Project1');
      manager.createSession('Project2');
      manager.createSession('Project3');

      const list = manager.listSessions();
      expect(list.length).toBe(3);
    });

    it('should filter by userId', () => {
      manager.createSession('Project1', 'user1');
      manager.createSession('Project2', 'user2');
      manager.createSession('Project3', 'user1');

      const list = manager.listSessions('user1');
      expect(list.length).toBe(2);
      expect(list.every(s => manager.loadSession(s.session_id)?.user_id === 'user1')).toBe(true);
    });

    it('should return SessionSummary with progress', () => {
      const session = manager.createSession('ProgressTest');
      manager.approveStage(session, 'A', 'script');
      manager.advanceStage(session, 'B');
      manager.approveStage(session, 'B', 'script');

      const list = manager.listSessions();
      const summary = list.find(s => s.session_id === session.session_id);

      expect(summary).toBeDefined();
      expect(summary!.progress_percent).toBe(33); // 2 of 6 stages
    });

    it('should sort by updated_at descending', () => {
      const session1 = manager.createSession('Old');

      // Wait and create another
      return new Promise<void>(resolve => {
        setTimeout(() => {
          const session2 = manager.createSession('New');
          const list = manager.listSessions();

          expect(list[0].session_id).toBe(session2.session_id);
          expect(list[1].session_id).toBe(session1.session_id);
          resolve();
        }, 10);
      });
    });
  });

  describe('findRecentSession', () => {
    it('should find session by project name', () => {
      manager.createSession('UniqueProject');

      const found = manager.findRecentSession('UniqueProject');
      expect(found).not.toBeNull();
      expect(found!.project_name).toBe('UniqueProject');
    });

    it('should return most recent session for project', () => {
      manager.createSession('MultiSession');

      return new Promise<void>(resolve => {
        setTimeout(() => {
          const newer = manager.createSession('MultiSession');
          const found = manager.findRecentSession('MultiSession');

          expect(found!.session_id).toBe(newer.session_id);
          resolve();
        }, 10);
      });
    });

    it('should return null for non-existent project', () => {
      const found = manager.findRecentSession('DoesNotExist');
      expect(found).toBeNull();
    });
  });

  describe('archiveSession', () => {
    it('should move session to archive folder', () => {
      const session = manager.createSession('ArchiveTest');
      const archivePath = manager.archiveSession(session.session_id);

      expect(archivePath).not.toBeNull();
      expect(fs.existsSync(archivePath!)).toBe(true);
    });

    it('should remove from active sessions', () => {
      const session = manager.createSession('ArchiveRemoveTest');
      manager.archiveSession(session.session_id);

      const loaded = manager.loadSession(session.session_id);
      expect(loaded).toBeNull();
    });

    it('should preserve session data', () => {
      const session = manager.createSession('ArchiveDataTest');
      session.model_type = 'star_schema';
      manager.approveStage(session, 'A', 'test script');
      manager.saveSession(session);

      const archivePath = manager.archiveSession(session.session_id);
      const archived = JSON.parse(fs.readFileSync(archivePath!, 'utf8'));

      expect(archived.model_type).toBe('star_schema');
      expect(archived.approved_script_parts['A']).toBe('test script');
    });
  });

  describe('cleanupOldSessions', () => {
    it('should delete sessions older than specified days', () => {
      // Create session and manually backdate it
      const session = manager.createSession('OldSession');
      const filePath = path.join(testDir, 'sessions', `${session.session_id}.json`);

      // Modify file to have old timestamp
      const oldSession = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      oldSession.updated_at = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      fs.writeFileSync(filePath, JSON.stringify(oldSession));

      // Cleanup sessions older than 7 days
      const deleted = manager.cleanupOldSessions(7);

      expect(deleted).toBe(1);
      expect(manager.loadSession(session.session_id)).toBeNull();
    });

    it('should not delete recent sessions', () => {
      const session = manager.createSession('RecentSession');

      const deleted = manager.cleanupOldSessions(7);

      expect(deleted).toBe(0);
      expect(manager.loadSession(session.session_id)).not.toBeNull();
    });

    it('should return count of deleted sessions', () => {
      // Create 3 old sessions
      for (let i = 0; i < 3; i++) {
        const session = manager.createSession(`OldSession${i}`);
        const filePath = path.join(testDir, 'sessions', `${session.session_id}.json`);
        const oldSession = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        oldSession.updated_at = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
        fs.writeFileSync(filePath, JSON.stringify(oldSession));
      }

      const deleted = manager.cleanupOldSessions(30);
      expect(deleted).toBe(3);
    });
  });

  describe('setModelType', () => {
    it('should set model type', () => {
      const session = manager.createSession('ModelTypeTest');
      manager.setModelType(session, 'snowflake');

      expect(session.model_type).toBe('snowflake');

      const loaded = manager.loadSession(session.session_id);
      expect(loaded!.model_type).toBe('snowflake');
    });
  });

  describe('createSessionManager factory', () => {
    it('should create SessionManager instance', () => {
      const sm = createSessionManager(testDir);
      expect(sm).toBeInstanceOf(SessionManager);
    });
  });
});
