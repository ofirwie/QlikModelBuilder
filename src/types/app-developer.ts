/**
 * Type definitions for App Developer Service
 * Ported from qlaude-saas project
 */

export interface AppDeveloperInput {
  appName?: string;           // Optional - Claude will generate if not provided
  userPrompt: string;         // Required - what the app should do
  loadScript?: string;        // Load script written by Claude
  targetSpaceId?: string;     // Space ID - required or ask user
  updateMode?: boolean;       // true = update existing app
  appId?: string;             // Existing app ID (for update mode)
  fixedScript?: string;       // Corrected script from Claude after error analysis
  validateWithRecordLimit?: number;  // Default 100
  skipValidation?: boolean;   // Skip validation and load full data immediately
  skipReload?: boolean;       // Skip reload completely - just create app and set script
  maxIterations?: number;     // Max fix attempts (default 10)
  previousErrors?: ScriptError[];  // Errors from previous attempt
}

export interface AppDeveloperResult {
  success: boolean;
  stage?: 'NEEDS_SPACE' | 'NEEDS_FIX' | 'COMPLETE';
  appId?: string;
  appName?: string;
  appLink?: string;
  reloadStatus?: string;
  skippedReload?: boolean;  // True if reload was intentionally skipped
  loadScript?: string;  // The load script to display in Monaco editor
  logs?: string[];
  error?: string;
  errors?: ScriptError[];
  errorSummary?: string;
  fixInstructions?: string;
  scriptIntelligence?: ScriptIntelligence;
  needsFix?: boolean;
  needsSpace?: boolean;
  needsScript?: boolean;
  message?: string;
  currentScript?: string;
  suggestedVisualizations?: VisualizationSuggestion[];  // Auto-suggested charts after app creation
  details?: {
    created: boolean;
    scriptUpdated: boolean;
    reloadTriggered: boolean;
    reloadId?: string;
  };
}

export interface ScriptError {
  type: 'synthetic_key' | 'circular_reference' | 'island_table' | 'field_not_found' | 'syntax_error' | 'unknown';
  message: string;
  details?: any;
}

export interface ScriptIntelligence {
  totalPotentialConflicts: number;
  predictedSyntheticKeys: string[];
  recommendation: string;
  criticalFields?: Array<{field: string; tables: string[]}>;
}

export interface VisualizationSuggestion {
  chartType: 'barchart' | 'linechart' | 'piechart' | 'combochart' | 'scatterplot' | 'kpi' | 'table' | 'gauge' | 'treemap' | 'boxplot' | 'distributionplot' | 'histogram' | 'pivottable' | 'waterfall' | 'funnel' | 'mekko';
  title: string;
  dimensions: string[];
  measures: string[];
  rationale: string;
}

export interface FieldInfo {
  name: string;
  isDate?: boolean;
  isNumeric?: boolean;
  isDimension?: boolean;
}

export interface QlikApp {
  id: string;              // MongoDB ObjectId format (not used)
  resourceId?: string;     // UUID format - THIS is what we need!
  attributes?: {
    id?: string;           // Also might be here
  };
  name: string;
  description?: string;
  spaceId?: string;
}

export interface ReloadStatus {
  id: string;
  state: 'queued' | 'reloading' | 'succeeded' | 'failed' | 'canceled' | 'skipped';
  status?: string; // Fallback field
  appId: string;
  log?: string[];
}
