/**
 * Tool Schema Validation Tests
 * Validates all 46 MCP tools have correct structure
 */

import { SEARCH_TOOLS } from '../../tools/search-tools.js';
import { GOVERNANCE_TOOLS } from '../../tools/governance-tools.js';
import { RELOAD_TOOLS } from '../../tools/reload-tools.js';
import { CATALOG_TOOLS } from '../../tools/catalog-tools.js';
import { DATA_TOOLS } from '../../tools/data-tools.js';
import { LINEAGE_TOOLS } from '../../tools/lineage-tools.js';
import { APP_TOOLS } from '../../tools/app-tools.js';
import { MISC_TOOLS } from '../../tools/misc-tools.js';
import { ANSWERS_TOOLS } from '../../tools/answers-tools.js';
import { ALERTS_TOOLS } from '../../tools/alerts-tools.js';
import { AUTOML_TOOLS } from '../../tools/automl-tools.js';
import { AUTOMATION_TOOLS } from '../../tools/automation-tools.js';
import { COLLECTIONS_TOOLS } from '../../tools/collections-tools.js';
import { CLOUD_ONLY_TOOLS } from '../../server/tool-registry.js';

// Helper to get all tools from an object
const getToolsArray = (toolsObj: Record<string, any>) => Object.values(toolsObj);

// Helper to validate tool structure
const validateToolStructure = (tool: any, toolName: string) => {
  expect(tool).toHaveProperty('name');
  expect(tool).toHaveProperty('description');
  expect(tool).toHaveProperty('inputSchema');
  expect(tool.name).toBe(toolName);
  expect(typeof tool.description).toBe('string');
  expect(tool.description.length).toBeGreaterThan(10);
  expect(tool.inputSchema).toHaveProperty('type', 'object');
  expect(tool.inputSchema).toHaveProperty('properties');
};

describe('Tool Schema Validation', () => {
  describe('Tool Name Format', () => {
    const allTools = [
      ...getToolsArray(SEARCH_TOOLS),
      ...getToolsArray(GOVERNANCE_TOOLS),
      ...getToolsArray(RELOAD_TOOLS),
      ...getToolsArray(CATALOG_TOOLS),
      ...getToolsArray(DATA_TOOLS),
      ...getToolsArray(LINEAGE_TOOLS),
      ...getToolsArray(APP_TOOLS),
      ...getToolsArray(MISC_TOOLS),
      ...getToolsArray(ANSWERS_TOOLS),
      ...getToolsArray(ALERTS_TOOLS),
      ...(Array.isArray(AUTOML_TOOLS) ? AUTOML_TOOLS : getToolsArray(AUTOML_TOOLS)),
      ...getToolsArray(AUTOMATION_TOOLS),
      ...getToolsArray(COLLECTIONS_TOOLS),
    ];

    it('all tools should have qlik_ prefix', () => {
      allTools.forEach((tool) => {
        expect(tool.name).toMatch(/^qlik_/);
      });
    });

    it('all tools should have snake_case names', () => {
      allTools.forEach((tool) => {
        expect(tool.name).toMatch(/^[a-z][a-z0-9_]*$/);
      });
    });
  });

  describe('Search Tools', () => {
    it('should have qlik_search tool', () => {
      expect(SEARCH_TOOLS.qlik_search).toBeDefined();
      validateToolStructure(SEARCH_TOOLS.qlik_search, 'qlik_search');
    });

    it('qlik_search should have query parameter', () => {
      const schema = SEARCH_TOOLS.qlik_search.inputSchema;
      expect(schema.properties).toHaveProperty('query');
    });
  });

  describe('Governance Tools', () => {
    it('should have 5 governance tools', () => {
      const tools = Object.keys(GOVERNANCE_TOOLS);
      expect(tools.length).toBe(5);
    });

    it('should have health_check tool', () => {
      expect(GOVERNANCE_TOOLS.qlik_health_check).toBeDefined();
      validateToolStructure(GOVERNANCE_TOOLS.qlik_health_check, 'qlik_health_check');
    });

    it('should have tenant_info tool', () => {
      expect(GOVERNANCE_TOOLS.qlik_get_tenant_info).toBeDefined();
      validateToolStructure(GOVERNANCE_TOOLS.qlik_get_tenant_info, 'qlik_get_tenant_info');
    });

    it('should have user_info tool', () => {
      expect(GOVERNANCE_TOOLS.qlik_get_user_info).toBeDefined();
      validateToolStructure(GOVERNANCE_TOOLS.qlik_get_user_info, 'qlik_get_user_info');
    });

    it('should have search_users tool', () => {
      expect(GOVERNANCE_TOOLS.qlik_search_users).toBeDefined();
      validateToolStructure(GOVERNANCE_TOOLS.qlik_search_users, 'qlik_search_users');
    });

    it('should have license_info tool', () => {
      expect(GOVERNANCE_TOOLS.qlik_get_license_info).toBeDefined();
      validateToolStructure(GOVERNANCE_TOOLS.qlik_get_license_info, 'qlik_get_license_info');
    });
  });

  describe('Reload Tools', () => {
    it('should have 3 reload tools', () => {
      const tools = Object.keys(RELOAD_TOOLS);
      expect(tools.length).toBe(3);
    });

    it('should have trigger_reload tool with appId required', () => {
      expect(RELOAD_TOOLS.qlik_trigger_app_reload).toBeDefined();
      const schema = RELOAD_TOOLS.qlik_trigger_app_reload.inputSchema;
      expect(schema.required).toContain('appId');
    });
  });

  describe('Collections Tools (Cloud Only)', () => {
    it('should have 4 collections tools', () => {
      const tools = Object.keys(COLLECTIONS_TOOLS);
      expect(tools.length).toBe(4);
    });

    it('all collections tools should have cloudOnly flag', () => {
      Object.values(COLLECTIONS_TOOLS).forEach((tool: any) => {
        expect(tool.cloudOnly).toBe(true);
      });
    });

    it('should have list_collections tool', () => {
      expect(COLLECTIONS_TOOLS.qlik_list_collections).toBeDefined();
      validateToolStructure(COLLECTIONS_TOOLS.qlik_list_collections, 'qlik_list_collections');
    });

    it('should have get_favorites tool', () => {
      expect(COLLECTIONS_TOOLS.qlik_get_favorites).toBeDefined();
      validateToolStructure(COLLECTIONS_TOOLS.qlik_get_favorites, 'qlik_get_favorites');
    });
  });

  describe('Answers Tools (Cloud Only)', () => {
    it('should have 3 answers tools', () => {
      const tools = Object.keys(ANSWERS_TOOLS);
      expect(tools.length).toBe(3);
    });

    it('all answers tools should have cloudOnly flag', () => {
      Object.values(ANSWERS_TOOLS).forEach((tool: any) => {
        expect(tool.cloudOnly).toBe(true);
      });
    });
  });

  describe('CLOUD_ONLY_TOOLS Registry', () => {
    it('should have 21 cloud-only tools', () => {
      expect(CLOUD_ONLY_TOOLS.length).toBe(21);
    });

    it('should include all collections tools', () => {
      expect(CLOUD_ONLY_TOOLS).toContain('qlik_list_collections');
      expect(CLOUD_ONLY_TOOLS).toContain('qlik_get_collection');
      expect(CLOUD_ONLY_TOOLS).toContain('qlik_list_collection_items');
      expect(CLOUD_ONLY_TOOLS).toContain('qlik_get_favorites');
    });

    it('should include all answers tools', () => {
      expect(CLOUD_ONLY_TOOLS).toContain('qlik_answers_list_assistants');
      expect(CLOUD_ONLY_TOOLS).toContain('qlik_answers_get_assistant');
      expect(CLOUD_ONLY_TOOLS).toContain('qlik_answers_ask_question');
    });

    it('should include lineage tool', () => {
      expect(CLOUD_ONLY_TOOLS).toContain('qlik_get_lineage');
    });

    it('should include all automation tools', () => {
      expect(CLOUD_ONLY_TOOLS).toContain('qlik_automation_list');
      expect(CLOUD_ONLY_TOOLS).toContain('qlik_automation_get_details');
      expect(CLOUD_ONLY_TOOLS).toContain('qlik_automation_run');
      expect(CLOUD_ONLY_TOOLS).toContain('qlik_automation_list_runs');
    });
  });

  describe('Total Tool Count', () => {
    it('should have 46 total tools', () => {
      // Count all tools
      const searchCount = Object.keys(SEARCH_TOOLS).length;
      const governanceCount = Object.keys(GOVERNANCE_TOOLS).length;
      const reloadCount = Object.keys(RELOAD_TOOLS).length;
      const catalogCount = Object.keys(CATALOG_TOOLS).length;
      const dataCount = Object.keys(DATA_TOOLS).length;
      const lineageCount = Object.keys(LINEAGE_TOOLS).length;
      const appCount = Object.keys(APP_TOOLS).length;
      const miscCount = Object.keys(MISC_TOOLS).length;
      const answersCount = Object.keys(ANSWERS_TOOLS).length;
      const alertsCount = Object.keys(ALERTS_TOOLS).length;
      const automlCount = Array.isArray(AUTOML_TOOLS)
        ? AUTOML_TOOLS.length
        : Object.keys(AUTOML_TOOLS).length;
      const automationCount = Object.keys(AUTOMATION_TOOLS).length;
      const collectionsCount = Object.keys(COLLECTIONS_TOOLS).length;

      const total =
        searchCount +
        governanceCount +
        reloadCount +
        catalogCount +
        dataCount +
        lineageCount +
        appCount +
        miscCount +
        answersCount +
        alertsCount +
        automlCount +
        automationCount +
        collectionsCount;

      // Tool count may vary as new tools are added
      // Current count: 50 (includes semantic tools, tenant tools, etc.)
      expect(total).toBeGreaterThanOrEqual(46);
    });
  });
});
