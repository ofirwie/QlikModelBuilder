/**
 * @fileoverview Unit tests for Model Builder types
 */

import {
  // Types
  ModelType,
  TableClassification,
  BuildStage,
  IssueSeverity,
  IssueCategory,
  LogLevel,
  FieldSemanticType,
  RelationshipType,
  FieldDataType,
  // Interfaces
  Stage1Input,
  Stage1Table,
  Stage1Field,
  RelationshipHint,
  QvdSampleData,
  QvdFieldSample,
  EnrichedModelSpec,
  EnrichedTable,
  EnrichedField,
  GeminiReviewRequest,
  GeminiReviewResponse,
  ReviewIssue,
  ModelBuilderSession,
  LogEntry,
  AuditEntry,
  Stage2Output,
  TransformationRule,
  ScriptSnippet,
  DataLoadOptions,
  FieldValidation,
  VersionedPayload,
  // Constants
  TYPE_VERSION,
  QLIK_CONSTRAINTS,
  // Type guards
  isModelType,
  isBuildStage,
  isLogLevel,
  isIssueSeverity,
  validateFieldName,
} from '../../model-builder/types';

describe('Model Builder Types', () => {
  describe('TYPE_VERSION', () => {
    it('should have correct version structure', () => {
      expect(TYPE_VERSION.major).toBe(1);
      expect(TYPE_VERSION.minor).toBe(0);
      expect(TYPE_VERSION.patch).toBe(0);
    });

    it('should return correct version string', () => {
      expect(TYPE_VERSION.toString()).toBe('1.0.0');
    });
  });

  describe('Core Type Values', () => {
    it('should allow valid ModelType values', () => {
      const validTypes: ModelType[] = ['star_schema', 'snowflake', 'link_table', 'concatenated'];
      validTypes.forEach(type => {
        expect(isModelType(type)).toBe(true);
      });
    });

    it('should reject invalid ModelType values', () => {
      expect(isModelType('invalid')).toBe(false);
      expect(isModelType(123)).toBe(false);
      expect(isModelType(null)).toBe(false);
    });

    it('should allow valid BuildStage values', () => {
      const validStages: BuildStage[] = ['A', 'B', 'C', 'D', 'E', 'F'];
      validStages.forEach(stage => {
        expect(isBuildStage(stage)).toBe(true);
      });
    });

    it('should reject invalid BuildStage values', () => {
      expect(isBuildStage('G')).toBe(false);
      expect(isBuildStage('a')).toBe(false);
      expect(isBuildStage(1)).toBe(false);
    });

    it('should allow valid LogLevel values', () => {
      const validLevels: LogLevel[] = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
      validLevels.forEach(level => {
        expect(isLogLevel(level)).toBe(true);
      });
    });

    it('should reject invalid LogLevel values', () => {
      expect(isLogLevel('error')).toBe(false);
      expect(isLogLevel('TRACE')).toBe(false);
    });

    it('should allow valid IssueSeverity values', () => {
      const validSeverities: IssueSeverity[] = ['critical', 'warning', 'info'];
      validSeverities.forEach(severity => {
        expect(isIssueSeverity(severity)).toBe(true);
      });
    });

    it('should reject invalid IssueSeverity values', () => {
      expect(isIssueSeverity('error')).toBe(false);
      expect(isIssueSeverity('CRITICAL')).toBe(false);
    });
  });

  describe('Stage1Input Interface', () => {
    it('should allow valid Stage1Input structure', () => {
      const input: Stage1Input = {
        version: '1.0',
        source: 'test.docx',
        parsed_at: '2026-01-21T10:00:00Z',
        tables: [],
        relationship_hints: [],
      };
      expect(input.version).toBeDefined();
      expect(input.tables).toEqual([]);
    });

    it('should allow Stage1Input with tables', () => {
      const field: Stage1Field = {
        name: 'CustomerID',
        type: 'integer',
      };
      const table: Stage1Table = {
        name: 'Customers',
        source_name: 'customers.qvd',
        fields: [field],
      };
      const input: Stage1Input = {
        version: '1.0',
        source: 'spec.docx',
        parsed_at: '2026-01-21T10:00:00Z',
        tables: [table],
        relationship_hints: [],
      };
      expect(input.tables.length).toBe(1);
      expect(input.tables[0].fields[0].name).toBe('CustomerID');
    });

    it('should allow relationship hints', () => {
      const hint: RelationshipHint = {
        from: 'Orders.CustomerID',
        to: 'Customers.CustomerID',
        type: 'many-to-one',
      };
      const input: Stage1Input = {
        version: '1.0',
        source: 'spec.docx',
        parsed_at: '2026-01-21T10:00:00Z',
        tables: [],
        relationship_hints: [hint],
      };
      expect(input.relationship_hints.length).toBe(1);
      expect(input.relationship_hints[0].type).toBe('many-to-one');
    });
  });

  describe('QvdSampleData Interface', () => {
    it('should allow valid QvdSampleData structure', () => {
      const fieldSample: QvdFieldSample = {
        name: 'Amount',
        type: 'decimal',
        cardinality: 1000,
        null_percent: 5.5,
        sample_values: ['100.50', '200.75', '350.00'],
        min_value: 0.01,
        max_value: 99999.99,
      };
      const sample: QvdSampleData = {
        table_name: 'Sales',
        row_count: 50000,
        fields: [fieldSample],
      };
      expect(sample.row_count).toBe(50000);
      expect(sample.fields[0].cardinality).toBe(1000);
    });

    it('should allow optional min/max values', () => {
      const fieldSample: QvdFieldSample = {
        name: 'Name',
        type: 'string',
        cardinality: 500,
        null_percent: 0,
        sample_values: ['John', 'Jane', 'Bob'],
      };
      expect(fieldSample.min_value).toBeUndefined();
      expect(fieldSample.max_value).toBeUndefined();
    });
  });

  describe('EnrichedModelSpec Interface', () => {
    it('should allow valid EnrichedModelSpec', () => {
      const enrichedField: EnrichedField = {
        name: 'CustomerID',
        type: 'integer',
        cardinality: 10000,
        null_percent: 0,
        is_key_candidate: true,
        is_date_field: false,
        sample_values: ['1', '2', '3'],
        semantic_type: 'key',
      };
      const enrichedTable: EnrichedTable = {
        name: 'DIM_Customers',
        source_name: 'customers.qvd',
        row_count: 10000,
        fields: [enrichedField],
        classification: 'dimension',
        classification_confidence: 0.95,
      };
      const spec: EnrichedModelSpec = {
        tables: [enrichedTable],
        relationships: [],
        date_fields: [],
        recommended_model_type: 'star_schema',
        recommendation_confidence: 0.85,
      };
      expect(spec.tables[0].classification).toBe('dimension');
      expect(spec.recommended_model_type).toBe('star_schema');
    });
  });

  describe('GeminiReviewResponse Interface', () => {
    it('should allow valid review response', () => {
      const issue: ReviewIssue = {
        issue_id: 'ISS-001',
        severity: 'warning',
        category: 'best-practice',
        title: 'Missing QUALIFY statement',
        location: { line: 10, table: 'Sales' },
        description: 'Consider using QUALIFY to avoid field name collisions',
        recommendation: 'Add QUALIFY * before loading tables',
        fix_example: 'QUALIFY *;',
      };
      const response: GeminiReviewResponse = {
        review_status: 'issues_found',
        score: 85,
        issues: [issue],
        summary: 'Script has minor issues that should be addressed',
      };
      expect(response.score).toBe(85);
      expect(response.issues.length).toBe(1);
      expect(response.issues[0].severity).toBe('warning');
    });

    it('should allow approved review', () => {
      const response: GeminiReviewResponse = {
        review_status: 'approved',
        score: 100,
        issues: [],
        summary: 'Script passes all checks',
      };
      expect(response.review_status).toBe('approved');
      expect(response.issues.length).toBe(0);
    });
  });

  describe('ModelBuilderSession Interface', () => {
    it('should allow valid session state', () => {
      const session: ModelBuilderSession = {
        session_id: 'sess-123-abc',
        project_name: 'SalesModel',
        created_at: '2026-01-21T10:00:00Z',
        updated_at: '2026-01-21T14:30:00Z',
        current_stage: 'C',
        completed_stages: ['A', 'B'],
        model_type: 'star_schema',
        approved_script_parts: {
          A: 'QUALIFY *;',
          B: 'DIM_Customers:\nLOAD * FROM customers.qvd;',
        },
        pending_tables: ['FACT_Orders', 'FACT_Returns'],
        gemini_reviews: [],
        user_id: 'user@example.com',
      };
      expect(session.current_stage).toBe('C');
      expect(session.completed_stages.length).toBe(2);
      expect(session.model_type).toBe('star_schema');
    });

    it('should allow null model_type initially', () => {
      const session: ModelBuilderSession = {
        session_id: 'sess-456',
        project_name: 'NewModel',
        created_at: '2026-01-21T10:00:00Z',
        updated_at: '2026-01-21T10:00:00Z',
        current_stage: 'A',
        completed_stages: [],
        model_type: null,
        approved_script_parts: {},
        pending_tables: [],
        gemini_reviews: [],
      };
      expect(session.model_type).toBeNull();
    });
  });

  describe('LogEntry and AuditEntry Interfaces', () => {
    it('should allow valid LogEntry', () => {
      const entry: LogEntry = {
        timestamp: '2026-01-21T14:30:00.123Z',
        level: 'INFO',
        session_id: 'sess-123',
        stage: 'B',
        component: 'script_builder',
        action: 'table_generated',
        details: { table: 'DIM_Customers', fields: 5 },
        user_id: 'user@example.com',
      };
      expect(entry.level).toBe('INFO');
      expect(entry.stage).toBe('B');
    });

    it('should allow valid AuditEntry', () => {
      const entry: AuditEntry = {
        audit_type: 'stage_approved',
        timestamp: '2026-01-21T14:30:00Z',
        session_id: 'sess-123',
        user_id: 'user@example.com',
        action: 'Approved Stage B',
        script_hash: 'abc123def456',
        gemini_score: 95,
        issues_fixed: 2,
      };
      expect(entry.audit_type).toBe('stage_approved');
      expect(entry.gemini_score).toBe(95);
    });
  });

  describe('TransformationRule Interface', () => {
    it('should allow various transformation types', () => {
      const trimRule: TransformationRule = {
        field: 'CustomerName',
        type: 'trim',
      };
      const replaceRule: TransformationRule = {
        field: 'Phone',
        type: 'replace',
        params: { pattern: '-', replacement: '' },
      };
      const customRule: TransformationRule = {
        field: 'FullName',
        type: 'custom',
        expression: "Upper(FirstName) & ' ' & Upper(LastName)",
      };
      expect(trimRule.type).toBe('trim');
      expect(replaceRule.params?.pattern).toBe('-');
      expect(customRule.expression).toContain('Upper');
    });
  });

  describe('QLIK_CONSTRAINTS', () => {
    it('should have correct constraint values', () => {
      expect(QLIK_CONSTRAINTS.MAX_FIELD_NAME_LENGTH).toBe(128);
      expect(QLIK_CONSTRAINTS.MAX_TABLE_NAME_LENGTH).toBe(128);
      expect(QLIK_CONSTRAINTS.RESERVED_WORDS).toContain('LOAD');
      expect(QLIK_CONSTRAINTS.RESERVED_WORDS).toContain('FROM');
      expect(QLIK_CONSTRAINTS.INVALID_CHARS).toContain('/');
      expect(QLIK_CONSTRAINTS.INVALID_CHARS).toContain('*');
    });
  });

  describe('validateFieldName', () => {
    it('should accept valid field names', () => {
      const result = validateFieldName('CustomerID');
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
      expect(result.warnings.length).toBe(0);
    });

    it('should reject field names that are too long', () => {
      const longName = 'A'.repeat(150);
      const result = validateFieldName(longName);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.suggested_name?.length).toBe(128);
    });

    it('should reject field names with invalid characters', () => {
      const result = validateFieldName('Customer/ID');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('/'))).toBe(true);
      expect(result.suggested_name).toBe('Customer_ID');
    });

    it('should warn about reserved words', () => {
      const result = validateFieldName('SELECT');
      expect(result.valid).toBe(true); // Still valid, just a warning
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.suggested_name).toBe('[SELECT]');
    });

    it('should handle multiple issues', () => {
      const result = validateFieldName('FROM/TO');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('VersionedPayload Interface', () => {
    it('should wrap Stage1Input correctly', () => {
      const input: Stage1Input = {
        version: '1.0',
        source: 'test.docx',
        parsed_at: '2026-01-21T10:00:00Z',
        tables: [],
        relationship_hints: [],
      };
      const payload: VersionedPayload<Stage1Input> = {
        type_version: TYPE_VERSION.toString(),
        payload_type: 'Stage1Input',
        data: input,
      };
      expect(payload.type_version).toBe('1.0.0');
      expect(payload.payload_type).toBe('Stage1Input');
      expect(payload.data.source).toBe('test.docx');
    });
  });
});
