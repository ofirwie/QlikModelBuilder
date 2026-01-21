/**
 * @fileoverview Unit tests for Logger service
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Logger, createLogger } from '../../model-builder/services/logger.js';
import { LogEntry, AuditEntry } from '../../model-builder/types.js';

describe('Logger', () => {
  let testLogDir: string;
  let logger: Logger;

  beforeEach(() => {
    // Create temporary directory for test logs
    testLogDir = path.join(os.tmpdir(), `qmb-test-${Date.now()}`);
    fs.mkdirSync(testLogDir, { recursive: true });
    logger = new Logger('test-session-123', 'test-user', testLogDir);
  });

  afterEach(() => {
    // Cleanup test directory
    try {
      fs.rmSync(testLogDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('log creation', () => {
    it('should create entry with all required fields', () => {
      const entry = logger.info('test_component', 'test_action', { key: 'value' });

      expect(entry.timestamp).toBeDefined();
      expect(entry.level).toBe('INFO');
      expect(entry.session_id).toBe('test-session-123');
      expect(entry.component).toBe('test_component');
      expect(entry.action).toBe('test_action');
      expect(entry.details).toEqual({ key: 'value' });
      expect(entry.user_id).toBe('test-user');
    });

    it('should include timestamp in ISO format', () => {
      const entry = logger.info('test', 'action', {});
      const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;
      expect(entry.timestamp).toMatch(isoPattern);
    });

    it('should include session_id in all entries', () => {
      const entries = [
        logger.error('c', 'a', {}),
        logger.warn('c', 'a', {}),
        logger.info('c', 'a', {}),
        logger.debug('c', 'a', {}),
      ];

      entries.forEach(entry => {
        expect(entry.session_id).toBe('test-session-123');
      });
    });

    it('should include optional stage when provided', () => {
      const entry = logger.info('builder', 'table_generated', { table: 'DIM_Customer' }, 'B');
      expect(entry.stage).toBe('B');
    });

    it('should not include stage when not provided', () => {
      const entry = logger.info('builder', 'action', {});
      expect(entry.stage).toBeUndefined();
    });

    it('should use correct log level for each method', () => {
      expect(logger.error('c', 'a', {}).level).toBe('ERROR');
      expect(logger.warn('c', 'a', {}).level).toBe('WARN');
      expect(logger.info('c', 'a', {}).level).toBe('INFO');
      expect(logger.debug('c', 'a', {}).level).toBe('DEBUG');
    });
  });

  describe('buffer management', () => {
    it('should buffer logs until flush', () => {
      logger.info('c1', 'a1', {});
      logger.info('c2', 'a2', {});
      logger.info('c3', 'a3', {});

      expect(logger.getBufferSize()).toBe(3);

      const logPath = path.join(testLogDir, 'test-session-123.log');
      expect(fs.existsSync(logPath)).toBe(false);
    });

    it('should clear buffer after flush', () => {
      logger.info('c', 'a', {});
      logger.info('c', 'a', {});
      expect(logger.getBufferSize()).toBe(2);

      logger.flush();

      expect(logger.getBufferSize()).toBe(0);
    });

    it('should auto-flush at 100 entries', () => {
      // Add 99 entries - should not trigger auto-flush
      for (let i = 0; i < 99; i++) {
        logger.info('test', `action_${i}`, { index: i });
      }
      expect(logger.getBufferSize()).toBe(99);

      // Add one more - should trigger auto-flush
      logger.info('test', 'action_100', {});
      expect(logger.getBufferSize()).toBe(0);

      // Verify file was written
      const logPath = path.join(testLogDir, 'test-session-123.log');
      expect(fs.existsSync(logPath)).toBe(true);
    });

    it('should return buffer contents with getBuffer()', () => {
      logger.info('c1', 'a1', { x: 1 });
      logger.warn('c2', 'a2', { x: 2 });

      const buffer = logger.getBuffer();
      expect(buffer.length).toBe(2);
      expect(buffer[0].component).toBe('c1');
      expect(buffer[1].level).toBe('WARN');
    });
  });

  describe('audit trail', () => {
    it('should create audit entry immediately (not buffered)', () => {
      const entry = logger.audit({
        audit_type: 'stage_approved',
        action: 'User approved Stage B',
        gemini_score: 95,
      });

      // Entry should be returned
      expect(entry.audit_type).toBe('stage_approved');
      expect(entry.timestamp).toBeDefined();
      expect(entry.session_id).toBe('test-session-123');

      // File should exist immediately
      const auditPath = path.join(testLogDir, 'test-session-123.audit.json');
      expect(fs.existsSync(auditPath)).toBe(true);
    });

    it('should calculate script hash correctly', () => {
      const script = 'LOAD * FROM test.qvd;';
      const hash = Logger.hashScript(script);

      // SHA256 should be 64 hex characters
      expect(hash).toMatch(/^[a-f0-9]{64}$/);

      // Same script should produce same hash
      expect(Logger.hashScript(script)).toBe(hash);

      // Different script should produce different hash
      expect(Logger.hashScript('LOAD * FROM other.qvd;')).not.toBe(hash);
    });

    it('should include compliance fields', () => {
      const entry = logger.audit({
        audit_type: 'script_approved',
        action: 'Final script approved',
        script_hash: Logger.hashScript('test script'),
        gemini_score: 98,
        issues_fixed: 3,
      });

      expect(entry.script_hash).toBeDefined();
      expect(entry.gemini_score).toBe(98);
      expect(entry.issues_fixed).toBe(3);
      expect(entry.user_id).toBe('test-user');
    });

    it('should append to existing audit file', () => {
      logger.audit({ audit_type: 'type1', action: 'action1' });
      logger.audit({ audit_type: 'type2', action: 'action2' });
      logger.audit({ audit_type: 'type3', action: 'action3' });

      const auditPath = path.join(testLogDir, 'test-session-123.audit.json');
      const content = fs.readFileSync(auditPath, 'utf-8');
      const entries: AuditEntry[] = JSON.parse(content);

      expect(entries.length).toBe(3);
      expect(entries[0].audit_type).toBe('type1');
      expect(entries[2].audit_type).toBe('type3');
    });
  });

  describe('file persistence', () => {
    it('should create log directory if not exists', () => {
      const newDir = path.join(testLogDir, 'subdir', 'logs');
      const newLogger = new Logger('new-session', undefined, newDir);

      expect(fs.existsSync(newDir)).toBe(true);
    });

    it('should append to existing log file', () => {
      logger.info('c', 'a1', {});
      logger.flush();

      logger.info('c', 'a2', {});
      logger.flush();

      const logPath = path.join(testLogDir, 'test-session-123.log');
      const content = fs.readFileSync(logPath, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines.length).toBe(2);
      expect(JSON.parse(lines[0]).action).toBe('a1');
      expect(JSON.parse(lines[1]).action).toBe('a2');
    });

    it('should write logs in JSON Lines format', () => {
      logger.info('c1', 'a1', { key1: 'value1' });
      logger.warn('c2', 'a2', { key2: 'value2' });
      logger.flush();

      const logPath = path.join(testLogDir, 'test-session-123.log');
      const content = fs.readFileSync(logPath, 'utf-8');
      const lines = content.trim().split('\n');

      // Each line should be valid JSON
      lines.forEach(line => {
        expect(() => JSON.parse(line)).not.toThrow();
      });

      const entry1 = JSON.parse(lines[0]);
      expect(entry1.component).toBe('c1');
      expect(entry1.details.key1).toBe('value1');
    });
  });

  describe('sensitive data sanitization', () => {
    it('should redact API keys', () => {
      const entry = logger.info('test', 'action', {
        api_key: 'sk-secret-key-12345',
        apiKey: 'another-secret',
        API_KEY: 'yet-another',
      });

      expect(entry.details.api_key).toBe('[REDACTED]');
      expect(entry.details.apiKey).toBe('[REDACTED]');
      expect(entry.details.API_KEY).toBe('[REDACTED]');
    });

    it('should redact passwords', () => {
      const entry = logger.info('test', 'action', {
        password: 'secret123',
        user_password: 'alsosecret',
        normalField: 'visible',
      });

      expect(entry.details.password).toBe('[REDACTED]');
      expect(entry.details.user_password).toBe('[REDACTED]');
      expect(entry.details.normalField).toBe('visible');
    });

    it('should redact tokens and credentials', () => {
      const entry = logger.info('test', 'action', {
        token: 'jwt-token-here',
        auth_token: 'bearer-abc',
        credential: 'my-credential',
        secret: 'shh',
      });

      expect(entry.details.token).toBe('[REDACTED]');
      expect(entry.details.auth_token).toBe('[REDACTED]');
      expect(entry.details.credential).toBe('[REDACTED]');
      expect(entry.details.secret).toBe('[REDACTED]');
    });

    it('should handle nested objects', () => {
      const entry = logger.info('test', 'action', {
        config: {
          api_key: 'nested-secret',
          host: 'example.com',
        },
        normalData: 'visible',
      });

      const config = entry.details.config as Record<string, unknown>;
      expect(config.api_key).toBe('[REDACTED]');
      expect(config.host).toBe('example.com');
    });
  });

  describe('createLogger factory', () => {
    it('should create Logger instance', () => {
      const newLogger = createLogger('factory-session', 'factory-user', testLogDir);

      expect(newLogger).toBeInstanceOf(Logger);
      expect(newLogger.getSessionId()).toBe('factory-session');
    });

    it('should work without optional parameters', () => {
      const newLogger = createLogger('minimal-session');

      expect(newLogger).toBeInstanceOf(Logger);
      expect(newLogger.getSessionId()).toBe('minimal-session');
    });
  });

  describe('error handling', () => {
    it('should handle flush with empty buffer', () => {
      expect(() => logger.flush()).not.toThrow();
    });

    it('should clear buffer on clearBuffer()', () => {
      logger.info('c', 'a', {});
      logger.info('c', 'a', {});
      expect(logger.getBufferSize()).toBe(2);

      logger.clearBuffer();
      expect(logger.getBufferSize()).toBe(0);
    });

    it('should allow setting user ID after construction', () => {
      const newLogger = createLogger('session-no-user', undefined, testLogDir);
      newLogger.setUserId('late-user');

      const entry = newLogger.info('c', 'a', {});
      expect(entry.user_id).toBe('late-user');
    });
  });
});
