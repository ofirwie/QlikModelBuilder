/**
 * @fileoverview Unit tests for Model Builder MCP Handlers
 */

import { jest } from '@jest/globals';
import {
  handleModelBuilderTool,
  resetModelBuilder,
} from '../../handlers/model-builder-handlers.js';
import {
  Stage1Input,
  QvdSampleData,
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
        { name: 'CustomerID', type: 'integer', cardinality: 1000, null_percent: 0, sample_values: ['1', '2'] },
        { name: 'CustomerName', type: 'string', cardinality: 950, null_percent: 0, sample_values: ['John'] },
        { name: 'City', type: 'string', cardinality: 50, null_percent: 2, sample_values: ['NYC'] },
      ],
    },
    {
      table_name: 'Orders',
      row_count: 50000,
      fields: [
        { name: 'OrderID', type: 'integer', cardinality: 50000, null_percent: 0, sample_values: ['1001'] },
        { name: 'CustomerID', type: 'integer', cardinality: 980, null_percent: 0, sample_values: ['1'] },
        { name: 'OrderDate', type: 'date', cardinality: 365, null_percent: 0, sample_values: ['2024-01-01'] },
        { name: 'Amount', type: 'decimal', cardinality: 5000, null_percent: 1, sample_values: ['99.99'] },
      ],
    },
  ];
}

// ============================================================================
// Tests
// ============================================================================

describe('Model Builder MCP Handlers', () => {
  afterEach(() => {
    resetModelBuilder();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const result = await handleModelBuilderTool('dmb_initialize', {});

      expect(result.isError).toBeFalsy();
      expect(result.content[0]).toHaveProperty('text');
      expect((result.content[0] as { text: string }).text).toContain('initialized');
    });
  });

  describe('session management', () => {
    it('should start a new session', async () => {
      const result = await handleModelBuilderTool('dmb_start_session', {
        projectName: 'TestProject',
      });

      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('Session started');
      expect(text).toContain('TestProject');
    });

    it('should require projectName', async () => {
      const result = await handleModelBuilderTool('dmb_start_session', {});

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('projectName is required');
    });

    it('should list sessions', async () => {
      // Start a session first
      await handleModelBuilderTool('dmb_start_session', { projectName: 'TestProject' });

      const result = await handleModelBuilderTool('dmb_list_sessions', {});

      expect(result.isError).toBeFalsy();
      // May or may not find sessions depending on persistence
    });

    it('should show status', async () => {
      const resultNoSession = await handleModelBuilderTool('dmb_status', {});
      expect((resultNoSession.content[0] as { text: string }).text).toContain('No active session');

      await handleModelBuilderTool('dmb_start_session', { projectName: 'TestProject' });
      const resultWithSession = await handleModelBuilderTool('dmb_status', {});
      expect((resultWithSession.content[0] as { text: string }).text).toContain('TestProject');
    });
  });

  describe('input processing', () => {
    beforeEach(async () => {
      await handleModelBuilderTool('dmb_start_session', { projectName: 'TestProject' });
    });

    it('should process input successfully', async () => {
      const result = await handleModelBuilderTool('dmb_process_input', {
        stage1Json: createMockStage1Input(),
        qvdSamples: createMockQvdSamples(),
      });

      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('Input processed successfully');
      expect(text).toContain('Tables: 2');
    });

    it('should require stage1Json', async () => {
      const result = await handleModelBuilderTool('dmb_process_input', {
        qvdSamples: [],
      });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('stage1Json is required');
    });

    it('should require qvdSamples array', async () => {
      const result = await handleModelBuilderTool('dmb_process_input', {
        stage1Json: createMockStage1Input(),
      });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('qvdSamples is required');
    });

    it('should get analysis after processing', async () => {
      await handleModelBuilderTool('dmb_process_input', {
        stage1Json: createMockStage1Input(),
        qvdSamples: createMockQvdSamples(),
      });

      const result = await handleModelBuilderTool('dmb_get_analysis', {});

      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('Model Analysis Report');
      expect(text).toContain('Customers');
      expect(text).toContain('Orders');
    });
  });

  describe('model type selection', () => {
    beforeEach(async () => {
      await handleModelBuilderTool('dmb_start_session', { projectName: 'TestProject' });
      await handleModelBuilderTool('dmb_process_input', {
        stage1Json: createMockStage1Input(),
        qvdSamples: createMockQvdSamples(),
      });
    });

    it('should select model type', async () => {
      const result = await handleModelBuilderTool('dmb_select_model_type', {
        modelType: 'star_schema',
      });

      expect(result.isError).toBeFalsy();
      expect((result.content[0] as { text: string }).text).toContain('star_schema');
    });

    it('should reject invalid model type', async () => {
      const result = await handleModelBuilderTool('dmb_select_model_type', {
        modelType: 'invalid_type',
      });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('Invalid model type');
    });

    it('should update config', async () => {
      await handleModelBuilderTool('dmb_select_model_type', { modelType: 'star_schema' });

      const result = await handleModelBuilderTool('dmb_update_config', {
        qvdPath: 'lib://CustomPath/',
        calendarLanguage: 'HE',
      });

      expect(result.isError).toBeFalsy();
      expect((result.content[0] as { text: string }).text).toContain('updated');
    });
  });

  describe('stage building', () => {
    beforeEach(async () => {
      await handleModelBuilderTool('dmb_start_session', { projectName: 'TestProject' });
      await handleModelBuilderTool('dmb_process_input', {
        stage1Json: createMockStage1Input(),
        qvdSamples: createMockQvdSamples(),
      });
      await handleModelBuilderTool('dmb_select_model_type', { modelType: 'star_schema' });
    });

    it('should build current stage', async () => {
      const result = await handleModelBuilderTool('dmb_build_stage', {});

      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('Stage A built successfully');
      expect(text).toContain('QUALIFY');
    });

    it('should build specific stage', async () => {
      const result = await handleModelBuilderTool('dmb_build_stage', { stage: 'B' });

      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('Stage B built successfully');
    });

    it('should approve stage', async () => {
      await handleModelBuilderTool('dmb_build_stage', {});

      const result = await handleModelBuilderTool('dmb_approve_stage', {});

      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('Stage approved');
      expect(text).toContain('Current stage: B');
    });

    it('should go back to earlier stage', async () => {
      // Build and approve two stages
      await handleModelBuilderTool('dmb_build_stage', {});
      await handleModelBuilderTool('dmb_approve_stage', {});
      await handleModelBuilderTool('dmb_build_stage', {});
      await handleModelBuilderTool('dmb_approve_stage', {});

      const result = await handleModelBuilderTool('dmb_go_back', { stage: 'A' });

      expect(result.isError).toBeFalsy();
      expect((result.content[0] as { text: string }).text).toContain('Reverted to stage A');
    });

    it('should get assembled script', async () => {
      await handleModelBuilderTool('dmb_build_stage', {});
      await handleModelBuilderTool('dmb_approve_stage', {});

      const result = await handleModelBuilderTool('dmb_get_script', {});

      expect(result.isError).toBeFalsy();
      expect((result.content[0] as { text: string }).text).toContain('QUALIFY');
    });
  });

  describe('scope validation', () => {
    beforeEach(async () => {
      await handleModelBuilderTool('dmb_start_session', { projectName: 'TestProject' });
    });

    it('should allow Qlik-related requests', async () => {
      const result = await handleModelBuilderTool('dmb_validate_request', {
        request: 'build a star schema for sales',
      });

      expect(result.isError).toBeFalsy();
      expect((result.content[0] as { text: string }).text).toContain('allowed');
    });

    it('should block non-Qlik requests', async () => {
      const result = await handleModelBuilderTool('dmb_validate_request', {
        request: 'write an email to my boss',
      });

      expect(result.isError).toBeFalsy();
      expect((result.content[0] as { text: string }).text).toContain('blocked');
    });
  });

  describe('export', () => {
    beforeEach(async () => {
      await handleModelBuilderTool('dmb_start_session', { projectName: 'TestProject' });
      await handleModelBuilderTool('dmb_process_input', {
        stage1Json: createMockStage1Input(),
        qvdSamples: createMockQvdSamples(),
      });
      await handleModelBuilderTool('dmb_select_model_type', { modelType: 'star_schema' });
    });

    it('should export Stage 2 output', async () => {
      const result = await handleModelBuilderTool('dmb_export', {});

      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('Stage 2 Output Exported');
      expect(text).toContain('star_schema');
    });
  });

  describe('help', () => {
    it('should show overview help', async () => {
      const result = await handleModelBuilderTool('dmb_help', {});

      expect(result.isError).toBeFalsy();
      expect((result.content[0] as { text: string }).text).toContain('Overview');
    });

    it('should show specific help topic', async () => {
      const result = await handleModelBuilderTool('dmb_help', { topic: 'stages' });

      expect(result.isError).toBeFalsy();
      expect((result.content[0] as { text: string }).text).toContain('Build Stages');
    });

    it('should show commands help', async () => {
      const result = await handleModelBuilderTool('dmb_help', { topic: 'commands' });

      expect(result.isError).toBeFalsy();
      expect((result.content[0] as { text: string }).text).toContain('Available Commands');
    });
  });

  describe('error handling', () => {
    it('should handle unknown tool', async () => {
      const result = await handleModelBuilderTool('dmb_unknown_tool', {});

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('Unknown');
    });

    it('should handle session errors gracefully', async () => {
      // Try to process input without a session
      const result = await handleModelBuilderTool('dmb_process_input', {
        stage1Json: createMockStage1Input(),
        qvdSamples: createMockQvdSamples(),
      });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('Session error');
    });

    it('should handle workflow errors gracefully', async () => {
      await handleModelBuilderTool('dmb_start_session', { projectName: 'TestProject' });

      // Try to build without selecting model type
      const result = await handleModelBuilderTool('dmb_build_stage', {});

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('Workflow error');
    });
  });

  describe('full workflow', () => {
    it('should complete full Stage 2 workflow', async () => {
      // 1. Start session
      const startResult = await handleModelBuilderTool('dmb_start_session', {
        projectName: 'FullWorkflowTest',
      });
      expect(startResult.isError).toBeFalsy();

      // 2. Process input
      const processResult = await handleModelBuilderTool('dmb_process_input', {
        stage1Json: createMockStage1Input(),
        qvdSamples: createMockQvdSamples(),
      });
      expect(processResult.isError).toBeFalsy();

      // 3. Select model type
      const selectResult = await handleModelBuilderTool('dmb_select_model_type', {
        modelType: 'star_schema',
      });
      expect(selectResult.isError).toBeFalsy();

      // 4. Build and approve all stages
      const stages = ['A', 'B', 'C', 'D', 'E', 'F'];
      for (const stage of stages) {
        const buildResult = await handleModelBuilderTool('dmb_build_stage', {});
        expect(buildResult.isError).toBeFalsy();

        const approveResult = await handleModelBuilderTool('dmb_approve_stage', {});
        expect(approveResult.isError).toBeFalsy();
      }

      // 5. Get assembled script
      const scriptResult = await handleModelBuilderTool('dmb_get_script', {});
      expect(scriptResult.isError).toBeFalsy();
      expect((scriptResult.content[0] as { text: string }).text).toContain('QUALIFY');

      // 6. Export
      const exportResult = await handleModelBuilderTool('dmb_export', {});
      expect(exportResult.isError).toBeFalsy();
      expect((exportResult.content[0] as { text: string }).text).toContain('star_schema');

      // 7. Check progress
      const statusResult = await handleModelBuilderTool('dmb_status', {});
      expect((statusResult.content[0] as { text: string }).text).toContain('100%');
    });
  });
});
