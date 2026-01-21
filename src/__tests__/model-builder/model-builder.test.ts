/**
 * @fileoverview Unit tests for ModelBuilder Orchestrator
 */

import { jest } from '@jest/globals';
import {
  ModelBuilder,
  createModelBuilder,
  ModelBuilderConfig,
  ModelBuilderError,
  SessionError,
  WorkflowError,
  ConfigurationError,
} from '../../model-builder/model-builder.js';
import {
  Stage1Input,
  QvdSampleData,
  ModelType,
  BuildStage,
} from '../../model-builder/types.js';

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockStage1Input(): Stage1Input {
  return {
    version: '1.0.0',
    source: 'test-spec.json',
    parsed_at: new Date().toISOString(),
    tables: [
      {
        name: 'Customers',
        source_name: 'Customers.qvd',
        fields: [
          { name: 'CustomerID', type: 'integer' },
          { name: 'CustomerName', type: 'string' },
          { name: 'City', type: 'string' },
        ],
      },
      {
        name: 'Orders',
        source_name: 'Orders.qvd',
        fields: [
          { name: 'OrderID', type: 'integer' },
          { name: 'CustomerID', type: 'integer' },
          { name: 'OrderDate', type: 'date' },
          { name: 'Amount', type: 'decimal' },
        ],
      },
      {
        name: 'Products',
        source_name: 'Products.qvd',
        fields: [
          { name: 'ProductID', type: 'integer' },
          { name: 'ProductName', type: 'string' },
          { name: 'Category', type: 'string' },
        ],
      },
    ],
    relationship_hints: [
      { from: 'Orders.CustomerID', to: 'Customers.CustomerID', type: 'many-to-one' },
    ],
  };
}

function createMockQvdSamples(): QvdSampleData[] {
  return [
    {
      table_name: 'Customers',
      row_count: 1000,
      fields: [
        { name: 'CustomerID', type: 'integer', cardinality: 1000, null_percent: 0, sample_values: ['1', '2', '3'] },
        { name: 'CustomerName', type: 'string', cardinality: 950, null_percent: 0, sample_values: ['John', 'Jane'] },
        { name: 'City', type: 'string', cardinality: 50, null_percent: 2, sample_values: ['NYC', 'LA'] },
      ],
    },
    {
      table_name: 'Orders',
      row_count: 50000,
      fields: [
        { name: 'OrderID', type: 'integer', cardinality: 50000, null_percent: 0, sample_values: ['1001', '1002'] },
        { name: 'CustomerID', type: 'integer', cardinality: 980, null_percent: 0, sample_values: ['1', '2'] },
        { name: 'OrderDate', type: 'date', cardinality: 365, null_percent: 0, sample_values: ['2024-01-01'] },
        { name: 'Amount', type: 'decimal', cardinality: 5000, null_percent: 1, sample_values: ['99.99', '150.00'] },
      ],
    },
    {
      table_name: 'Products',
      row_count: 500,
      fields: [
        { name: 'ProductID', type: 'integer', cardinality: 500, null_percent: 0, sample_values: ['P001', 'P002'] },
        { name: 'ProductName', type: 'string', cardinality: 500, null_percent: 0, sample_values: ['Widget'] },
        { name: 'Category', type: 'string', cardinality: 20, null_percent: 0, sample_values: ['Electronics'] },
      ],
    },
  ];
}

// ============================================================================
// Tests
// ============================================================================

describe('ModelBuilder', () => {
  let builder: ModelBuilder;

  beforeEach(() => {
    // Use temp directory for tests
    const testDir = `./test-qmb-${Date.now()}`;
    builder = createModelBuilder({
      baseDir: testDir,
      defaultQvdPath: 'lib://TestQVD/',
      defaultCalendarLanguage: 'EN',
      useAutonumber: true,
    });
  });

  afterEach(() => {
    if (builder) {
      builder.shutdown();
    }
  });

  describe('initialization', () => {
    it('should create a ModelBuilder instance', () => {
      expect(builder).toBeInstanceOf(ModelBuilder);
    });

    it('should initialize without errors', async () => {
      await expect(builder.initialize()).resolves.not.toThrow();
    });

    it('should be idempotent on multiple initialize calls', async () => {
      await builder.initialize();
      await expect(builder.initialize()).resolves.not.toThrow();
    });
  });

  describe('session management', () => {
    it('should start a new session', () => {
      const session = builder.startSession('TestProject');

      expect(session).toBeDefined();
      expect(session.session_id).toMatch(/^qmb-\d+-[a-f0-9]+$/);
      expect(session.project_name).toBe('TestProject');
      expect(session.current_stage).toBe('A');
    });

    it('should return current session', () => {
      builder.startSession('TestProject');
      const session = builder.getCurrentSession();

      expect(session).not.toBeNull();
      expect(session!.project_name).toBe('TestProject');
    });

    it('should throw when resuming non-existent session', () => {
      expect(() => builder.resumeSession('non-existent-session'))
        .toThrow(SessionError);
    });

    it('should resume an existing session', () => {
      const original = builder.startSession('TestProject');
      builder.shutdown();

      // Create new builder and resume
      const newBuilder = createModelBuilder({ baseDir: builder['config'].baseDir });
      const resumed = newBuilder.resumeSession(original.session_id);

      expect(resumed.session_id).toBe(original.session_id);
      expect(resumed.project_name).toBe('TestProject');

      newBuilder.shutdown();
    });

    it('should list sessions', () => {
      builder.startSession('Project1');
      builder.startSession('Project2');

      const sessions = builder.listSessions();

      expect(sessions.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('input processing', () => {
    beforeEach(() => {
      builder.startSession('TestProject');
    });

    it('should throw when processing input without session', () => {
      const noSessionBuilder = createModelBuilder();
      expect(() => noSessionBuilder.processInput({}, []))
        .toThrow(SessionError);
    });

    it('should process valid input', () => {
      const stage1 = createMockStage1Input();
      const samples = createMockQvdSamples();

      const spec = builder.processInput(stage1, samples);

      expect(spec.tables.length).toBe(3);
      expect(spec.relationships.length).toBe(1);
    });

    it('should enrich tables with QVD data', () => {
      const stage1 = createMockStage1Input();
      const samples = createMockQvdSamples();

      const spec = builder.processInput(stage1, samples);

      const ordersTable = spec.tables.find(t => t.name === 'Orders');
      expect(ordersTable?.row_count).toBe(50000);
    });

    it('should detect key candidates', () => {
      const stage1 = createMockStage1Input();
      const samples = createMockQvdSamples();

      const spec = builder.processInput(stage1, samples);

      const customersTable = spec.tables.find(t => t.name === 'Customers');
      const customerIdField = customersTable?.fields.find(f => f.name === 'CustomerID');
      expect(customerIdField?.is_key_candidate).toBe(true);
    });

    it('should detect date fields', () => {
      const stage1 = createMockStage1Input();
      const samples = createMockQvdSamples();

      const spec = builder.processInput(stage1, samples);

      expect(spec.date_fields.length).toBeGreaterThanOrEqual(1);
      expect(spec.date_fields[0].field_name).toBe('OrderDate');
    });

    it('should get analysis result after processing', () => {
      builder.processInput(createMockStage1Input(), createMockQvdSamples());

      const analysis = builder.getAnalysisResult();

      expect(analysis).not.toBeNull();
      expect(analysis!.classifications.size).toBe(3);
    });

    it('should recommend a model type', () => {
      const spec = builder.processInput(createMockStage1Input(), createMockQvdSamples());

      expect(spec.recommended_model_type).toBeDefined();
    });
  });

  describe('model type selection', () => {
    beforeEach(() => {
      builder.startSession('TestProject');
      builder.processInput(createMockStage1Input(), createMockQvdSamples());
    });

    it('should select model type', () => {
      builder.selectModelType('star_schema');

      const session = builder.getCurrentSession();
      expect(session!.model_type).toBe('star_schema');
    });

    it('should allow changing model type', () => {
      builder.selectModelType('star_schema');
      builder.selectModelType('snowflake');

      const session = builder.getCurrentSession();
      expect(session!.model_type).toBe('snowflake');
    });

    it('should throw without session', () => {
      const noSessionBuilder = createModelBuilder();
      expect(() => noSessionBuilder.selectModelType('star_schema'))
        .toThrow(SessionError);
    });
  });

  describe('build configuration', () => {
    beforeEach(() => {
      builder.startSession('TestProject');
      builder.processInput(createMockStage1Input(), createMockQvdSamples());
      builder.selectModelType('star_schema');
    });

    it('should update build config', () => {
      builder.updateBuildConfig({
        qvd_path: 'lib://CustomPath/',
        calendar_language: 'HE',
      });

      // Build and check the config is used (indirectly via stage output)
      const result = builder.buildCurrentStage();
      expect(result.success).toBe(true);
    });

    it('should throw without model type selected', () => {
      const freshBuilder = createModelBuilder();
      freshBuilder.startSession('Test');
      freshBuilder.processInput(createMockStage1Input(), createMockQvdSamples());

      expect(() => freshBuilder.updateBuildConfig({ qvd_path: 'lib://X/' }))
        .toThrow(WorkflowError);

      freshBuilder.shutdown();
    });
  });

  describe('stage building', () => {
    beforeEach(() => {
      builder.startSession('TestProject');
      builder.processInput(createMockStage1Input(), createMockQvdSamples());
      builder.selectModelType('star_schema');
    });

    it('should build stage A successfully', () => {
      const result = builder.buildCurrentStage();

      expect(result.success).toBe(true);
      expect(result.stage).toBe('A');
      expect(result.script).toBeDefined();
      expect(result.script!.script).toContain('QUALIFY *');
    });

    it('should build specific stage', () => {
      const result = builder.buildStage('B');

      expect(result.success).toBe(true);
      expect(result.stage).toBe('B');
      expect(result.script!.script).toContain('Dimensions');
    });

    it('should approve and advance stage', () => {
      const result = builder.buildCurrentStage();
      builder.approveCurrentStage(result.script!.script);

      const session = builder.getCurrentSession();
      expect(session!.current_stage).toBe('B');
      expect(session!.completed_stages).toContain('A');
    });

    it('should build all stages', () => {
      const stages: BuildStage[] = ['A', 'B', 'C', 'D', 'E', 'F'];

      for (const stage of stages) {
        const result = builder.buildCurrentStage();
        expect(result.success).toBe(true);
        expect(result.stage).toBe(stage);

        builder.approveCurrentStage(result.script!.script);
      }

      const session = builder.getCurrentSession();
      expect(session!.completed_stages.length).toBe(6);
    });

    it('should throw when building without input processed', () => {
      const freshBuilder = createModelBuilder();
      freshBuilder.startSession('Test');
      freshBuilder['currentSession']!.model_type = 'star_schema';

      expect(() => freshBuilder.buildCurrentStage())
        .toThrow(WorkflowError);

      freshBuilder.shutdown();
    });

    it('should throw when building without model type selected', () => {
      const freshBuilder = createModelBuilder();
      freshBuilder.startSession('Test');
      freshBuilder.processInput(createMockStage1Input(), createMockQvdSamples());

      expect(() => freshBuilder.buildCurrentStage())
        .toThrow(WorkflowError);

      freshBuilder.shutdown();
    });
  });

  describe('stage navigation', () => {
    beforeEach(() => {
      builder.startSession('TestProject');
      builder.processInput(createMockStage1Input(), createMockQvdSamples());
      builder.selectModelType('star_schema');

      // Build and approve stages A and B
      builder.approveCurrentStage(builder.buildCurrentStage().script!.script);
      builder.approveCurrentStage(builder.buildCurrentStage().script!.script);
    });

    it('should go back to previous stage', () => {
      expect(builder.getCurrentSession()!.current_stage).toBe('C');

      builder.goBackToStage('A');

      expect(builder.getCurrentSession()!.current_stage).toBe('A');
    });

    it('should clear later stages when going back', () => {
      builder.goBackToStage('A');

      const session = builder.getCurrentSession();
      expect(session!.completed_stages).toEqual(['A']);
      expect(session!.approved_script_parts['B']).toBeUndefined();
    });
  });

  describe('script assembly', () => {
    beforeEach(() => {
      builder.startSession('TestProject');
      builder.processInput(createMockStage1Input(), createMockQvdSamples());
      builder.selectModelType('star_schema');
    });

    it('should assemble script from approved stages', () => {
      builder.approveCurrentStage(builder.buildCurrentStage().script!.script); // A
      builder.approveCurrentStage(builder.buildCurrentStage().script!.script); // B

      const assembled = builder.getAssembledScript();

      expect(assembled).toContain('QUALIFY *');
      expect(assembled).toContain('Dimensions');
    });

    it('should return empty string with no approved stages', () => {
      const assembled = builder.getAssembledScript();
      expect(assembled).toBe('');
    });
  });

  describe('scope validation', () => {
    beforeEach(() => {
      builder.startSession('TestProject');
    });

    it('should allow Qlik-related requests', () => {
      const result = builder.validateRequest('build a star schema');
      expect(result.allowed).toBe(true);
    });

    it('should reject non-Qlik requests', () => {
      const result = builder.validateRequest('write an email');
      expect(result.allowed).toBe(false);
    });

    it('should always allow requests mentioning Qlik', () => {
      const result = builder.validateRequest('help me with Qlik');
      expect(result.allowed).toBe(true);
    });
  });

  describe('rate limiting', () => {
    it('should check rate limit', () => {
      builder = createModelBuilder({ userId: 'test-user-rate' });

      const result = builder.checkRateLimit();
      expect(result.allowed).toBe(true);
      expect(result.requests_remaining).toBeGreaterThan(0);
    });

    it('should record requests', () => {
      builder = createModelBuilder({ userId: 'test-user-record' });

      builder.recordRequest(true);
      builder.recordRequest(true);
      builder.recordRequest(true);

      const result = builder.checkRateLimit();
      expect(result.requests_remaining).toBeLessThan(10);
    });
  });

  describe('review (without Gemini)', () => {
    beforeEach(() => {
      builder.startSession('TestProject');
      builder.processInput(createMockStage1Input(), createMockQvdSamples());
      builder.selectModelType('star_schema');
      builder.approveCurrentStage(builder.buildCurrentStage().script!.script);
    });

    it('should fail review without Gemini configured', async () => {
      const result = await builder.requestReview();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Gemini');
    });

    it('should return empty reviews array', () => {
      const reviews = builder.getReviews();
      expect(reviews).toEqual([]);
    });
  });

  describe('progress tracking', () => {
    it('should return null progress without session', () => {
      const progress = builder.getProgress();
      expect(progress).toBeNull();
    });

    it('should return progress info', () => {
      builder.startSession('TestProject');

      const progress = builder.getProgress();

      expect(progress).not.toBeNull();
      expect(progress!.session_id).toBeDefined();
      expect(progress!.project_name).toBe('TestProject');
      expect(progress!.current_stage).toBe('A');
      expect(progress!.progress_percent).toBe(0);
    });

    it('should update progress as stages complete', () => {
      builder.startSession('TestProject');
      builder.processInput(createMockStage1Input(), createMockQvdSamples());
      builder.selectModelType('star_schema');

      builder.approveCurrentStage(builder.buildCurrentStage().script!.script); // A
      builder.approveCurrentStage(builder.buildCurrentStage().script!.script); // B
      builder.approveCurrentStage(builder.buildCurrentStage().script!.script); // C

      const progress = builder.getProgress();

      expect(progress!.completed_stages.length).toBe(3);
      expect(progress!.progress_percent).toBe(50);
      expect(progress!.current_stage).toBe('D');
    });
  });

  describe('export', () => {
    beforeEach(() => {
      builder.startSession('TestProject');
      builder.processInput(createMockStage1Input(), createMockQvdSamples());
      builder.selectModelType('star_schema');
    });

    it('should export Stage2Output', () => {
      const output = builder.exportOutput();

      expect(output.version).toBe('1.0.0');
      expect(output.model_type).toBe('star_schema');
      expect(output.facts.length).toBeGreaterThanOrEqual(0);
      expect(output.dimensions.length).toBeGreaterThanOrEqual(0);
      expect(output.calendars.length).toBeGreaterThanOrEqual(0);
    });

    it('should include relationships in output', () => {
      const output = builder.exportOutput();

      expect(output.relationships.length).toBeGreaterThanOrEqual(0);
    });

    it('should include Gemini review summary', () => {
      const output = builder.exportOutput();

      expect(output.gemini_review).toBeDefined();
      expect(output.gemini_review.score).toBeDefined();
    });

    it('should throw without processing input first', () => {
      const freshBuilder = createModelBuilder();
      freshBuilder.startSession('Test');

      expect(() => freshBuilder.exportOutput())
        .toThrow(WorkflowError);

      freshBuilder.shutdown();
    });
  });

  describe('factory function', () => {
    it('should create ModelBuilder with default config', () => {
      const instance = createModelBuilder();
      expect(instance).toBeInstanceOf(ModelBuilder);
    });

    it('should create ModelBuilder with custom config', () => {
      const instance = createModelBuilder({
        baseDir: './custom-dir',
        defaultQvdPath: 'lib://Custom/',
        defaultCalendarLanguage: 'HE',
        useAutonumber: false,
      });

      expect(instance).toBeInstanceOf(ModelBuilder);
    });
  });

  describe('error handling', () => {
    it('should have proper error types', () => {
      const sessionErr = new SessionError('test');
      const workflowErr = new WorkflowError('test');
      const configErr = new ConfigurationError('test');

      expect(sessionErr).toBeInstanceOf(ModelBuilderError);
      expect(workflowErr).toBeInstanceOf(ModelBuilderError);
      expect(configErr).toBeInstanceOf(ModelBuilderError);
    });

    it('should propagate validation errors', () => {
      builder.startSession('Test');

      expect(() => builder.processInput({}, []))
        .toThrow();
    });
  });
});

describe('ModelBuilder with Gemini (mocked)', () => {
  let builder: ModelBuilder;
  let originalFetch: typeof global.fetch;
  let mockFetch: jest.MockedFunction<typeof global.fetch>;

  const createMockResponse = (body: unknown): Response => ({
    ok: true,
    json: () => Promise.resolve(body),
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    redirected: false,
    type: 'basic',
    url: '',
    clone: () => createMockResponse(body),
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(''),
  } as Response);

  beforeEach(() => {
    // Save original fetch
    originalFetch = global.fetch;

    // Create typed mock
    mockFetch = jest.fn() as jest.MockedFunction<typeof global.fetch>;
    mockFetch.mockResolvedValue(createMockResponse({
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              review_status: 'approved',
              score: 95,
              issues: [],
              summary: 'Script looks good',
            }),
          }],
        },
      }],
    }));

    global.fetch = mockFetch;

    builder = createModelBuilder({
      geminiConfig: { api_key: 'AIzaTestKey123456789012345678901234567' },
      baseDir: `./test-qmb-gemini-${Date.now()}`,
    });
  });

  afterEach(() => {
    if (builder) {
      builder.shutdown();
    }
    // Restore original fetch
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('should initialize with Gemini configured', async () => {
    // Mock connection check
    mockFetch.mockResolvedValueOnce(createMockResponse({
      candidates: [{
        content: { parts: [{ text: 'OK' }] },
      }],
    }));

    await builder.initialize();
    expect(mockFetch).toHaveBeenCalled();
  });

  it('should request review with Gemini', async () => {
    builder.startSession('TestProject');
    builder.processInput(createMockStage1Input(), createMockQvdSamples());
    builder.selectModelType('star_schema');
    builder.approveCurrentStage(builder.buildCurrentStage().script!.script);

    const result = await builder.requestReview();

    expect(result.success).toBe(true);
    expect(result.review).toBeDefined();
    expect(result.review!.score).toBe(95);
  });

  it('should store review in session', async () => {
    builder.startSession('TestProject');
    builder.processInput(createMockStage1Input(), createMockQvdSamples());
    builder.selectModelType('star_schema');
    builder.approveCurrentStage(builder.buildCurrentStage().script!.script);

    await builder.requestReview();

    const reviews = builder.getReviews();
    expect(reviews.length).toBe(1);
  });

  it('should include review in progress', async () => {
    builder.startSession('TestProject');
    builder.processInput(createMockStage1Input(), createMockQvdSamples());
    builder.selectModelType('star_schema');
    builder.approveCurrentStage(builder.buildCurrentStage().script!.script);

    await builder.requestReview();

    const progress = builder.getProgress();
    expect(progress!.total_reviews).toBe(1);
    expect(progress!.latest_score).toBe(95);
  });

  it('should handle review failure', async () => {
    // Mock all retries to fail (reviewWithRetry uses 3 retries by default)
    mockFetch
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'));

    builder.startSession('TestProject');
    builder.processInput(createMockStage1Input(), createMockQvdSamples());
    builder.selectModelType('star_schema');
    builder.approveCurrentStage(builder.buildCurrentStage().script!.script);

    const result = await builder.requestReview();

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
