/**
 * Type definitions for Automation Service
 * Ported from qlaude-saas project
 */

export interface Automation {
  id: string;
  name: string;
  description?: string;
  ownerId?: string;
  spaceId?: string;
  enabled?: boolean;
  createdDate?: string;
  modifiedDate?: string;
}

export interface AutomationRun {
  id: string;
  automationId: string;
  status: 'running' | 'finished' | 'failed' | 'succeeded' | 'error' | 'stopped' | 'finished with warnings';
  startTime?: string;
  endTime?: string;
  outputs?: any;
  error?: any;
}

export interface AutomationRunDetails extends AutomationRun {
  url?: string;  // Log URL
  context?: string;
  duration?: number;
}

export interface ParsedError {
  type: string;
  message: string;
  code?: string;
}

export interface AutomationTriggerRequest {
  automationId: string;
  executionToken: string;
  inputs: {
    vAppName: string;
    vSpaceName: string;
    vScript: string;
    vUpdate: number;      // 0 for create, 1 for update
    vAppID?: string;      // Only required when vUpdate=1
  };
}

export interface AutomationResult {
  success: boolean;
  runId?: string;
  status?: string;
  appId?: string;
  outputs?: any;
  error?: string;
  executionTime?: number;
  logs?: string;
  errors?: ParsedError[];
}

export interface UsageMetrics {
  automationId: string;
  runs: number;
  successRate: number;
  avgDuration: number;
  lastRun?: string;
}
