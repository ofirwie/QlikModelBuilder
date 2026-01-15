/**
 * Analysis Types - Structured format for Claude analysis output
 *
 * Used by qlik_create_dashboard_from_analysis to generate Qlik visualizations
 */

// ===== MAIN ANALYSIS OUTPUT =====

export interface AnalysisOutput {
  /** Dashboard title (e.g., "MTTR Analysis Q4 2024") */
  title: string;

  /** Executive summary of the analysis */
  summary?: string;

  /** Key insights and findings */
  insights?: AnalysisInsight[];

  /** KPI metrics to display */
  metrics?: AnalysisMetric[];

  /** Dimensional breakdowns (categories, teams, etc.) */
  breakdowns?: AnalysisBreakdown[];

  /** Time-series trends */
  trends?: AnalysisTrend[];

  /** Detailed data for tables */
  tables?: AnalysisTable[];

  /** Action items and recommendations */
  recommendations?: string[];
}

// ===== INSIGHT =====

export type InsightType = 'highlight' | 'warning' | 'trend' | 'anomaly' | 'info';
export type InsightSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface AnalysisInsight {
  /** Type of insight */
  type: InsightType;

  /** Severity level */
  severity?: InsightSeverity;

  /** Short title */
  title: string;

  /** The key value or finding */
  value: string | number;

  /** Detailed description */
  description?: string;
}

// ===== METRIC (KPI) =====

export interface AnalysisMetric {
  /** Metric name (e.g., "Total Incidents") */
  name: string;

  /** Metric value */
  value: number;

  /** Unit of measurement (e.g., "hours", "%", "tickets") */
  unit?: string;

  /** Comparison with previous period */
  comparison?: {
    value: number;
    period: string;       // "vs last month"
    direction: 'up' | 'down' | 'same';
    percentChange?: number;
  };

  /** Optional Qlik expression for dynamic calculation */
  expression?: string;
}

// ===== BREAKDOWN =====

export type VisualizationType = 'barchart' | 'piechart' | 'table' | 'linechart' | 'combochart' | 'kpi';

export interface AnalysisBreakdown {
  /** Dimension field name (e.g., "category", "admin_group") */
  dimension: string;

  /** Measure being analyzed (e.g., "count", "mttr", "satisfaction") */
  measure: string;

  /** The breakdown data */
  data: BreakdownItem[];

  /** Preferred visualization type (auto-selected if not specified) */
  visualizationType?: VisualizationType;

  /** Whether to sort by value */
  sortDescending?: boolean;

  /** Limit to top N items */
  topN?: number;
}

export interface BreakdownItem {
  /** Category label */
  label: string;

  /** Value */
  value: number;

  /** Optional percentage */
  percentage?: number;
}

// ===== TREND =====

export interface AnalysisTrend {
  /** Time dimension (e.g., "month", "week", "day") */
  dimension: string;

  /** Measure names being tracked */
  measures: string[];

  /** Time-series data points */
  data: TrendDataPoint[];

  /** Preferred visualization type */
  visualizationType?: 'linechart' | 'combochart' | 'barchart';
}

export interface TrendDataPoint {
  /** Time period label (e.g., "2024-Q4", "December") */
  period: string;

  /** Values for each measure (in same order as measures array) */
  values: number[];
}

// ===== TABLE =====

export interface AnalysisTable {
  /** Table title */
  title: string;

  /** Column definitions */
  columns: TableColumn[];

  /** Row data */
  rows: Record<string, string | number>[];

  /** Whether to show totals row */
  showTotals?: boolean;
}

export interface TableColumn {
  /** Column field name */
  field: string;

  /** Display label */
  label: string;

  /** Column type */
  type: 'dimension' | 'measure';

  /** Number format for measures */
  format?: string;
}

// ===== VISUALIZATION SPECIFICATION =====

export interface VisualizationSpec {
  /** Visualization type */
  type: VisualizationType;

  /** Title */
  title: string;

  /** Dimension fields */
  dimensions: string[];

  /** Measure expressions */
  measures: Array<string | { expression: string; label: string }>;

  /** Position on grid */
  position: GridPosition;

  /** Source data (for reference) */
  sourceData?: BreakdownItem[] | TrendDataPoint[];
}

export interface GridPosition {
  /** X position (0-24) */
  x: number;

  /** Y position (0-12+) */
  y: number;

  /** Width in columns */
  width: number;

  /** Height in rows */
  height: number;
}

// ===== DASHBOARD RESULT =====

export interface DashboardCreationResult {
  /** Whether creation was successful */
  success: boolean;

  /** Created sheet ID */
  sheetId?: string;

  /** Direct link to the sheet */
  sheetUrl?: string;

  /** Created visualization object IDs */
  objects?: string[];

  /** Error message if failed */
  error?: string;

  /** Summary message */
  message: string;
}

// ===== VISUALIZATION RULES =====

/**
 * Cognitive visualization rules from qlik-semantic-bridge.skill
 * Based on 100 visualization rules for dashboards
 */
export interface VisualizationRule {
  id: number;
  name: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  qlikProperty?: string;
}

export const CRITICAL_VIZ_RULES: VisualizationRule[] = [
  // Note: Rule 8 (2D only) removed - Qlik Sense doesn't support 3D charts
  { id: 18, name: 'Y-axis from 0', priority: 'critical', qlikProperty: 'qMin: 0' },
  { id: 21, name: 'Single screen', priority: 'critical', qlikProperty: 'height ≤ 100vh' },
  { id: 27, name: '5 seconds rule', priority: 'critical', qlikProperty: 'max 5-7 KPIs' },
  { id: 31, name: 'No Pie Charts', priority: 'high', qlikProperty: 'use horizontal bar' },
  { id: 63, name: 'Color blind safe', priority: 'high', qlikProperty: 'blue-orange palette' },
  { id: 81, name: 'Credibility', priority: 'critical', qlikProperty: 'no scale manipulation' }
];

/**
 * Chart type selection based on data characteristics
 */
export const CHART_TYPE_RULES: Record<string, number[]> = {
  bar_chart: [18, 31, 32, 34, 51],
  line_chart: [33, 47, 38],
  heatmap: [40, 66, 63],
  scatter: [37, 48],
  kpi: []
};
