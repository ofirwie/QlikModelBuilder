/**
 * Analysis-to-Dashboard Service
 *
 * Converts Claude analysis output into Qlik visualizations
 * Uses cognitive visualization rules from qlik-semantic-bridge.skill
 */

import {
  AnalysisOutput,
  AnalysisBreakdown,
  AnalysisTrend,
  AnalysisMetric,
  AnalysisTable,
  VisualizationSpec,
  VisualizationType,
  GridPosition,
  CRITICAL_VIZ_RULES
} from '../types/analysis.js';
import { logger } from '../utils/logger.js';
import { getActiveTenant } from '../config/tenants.js';
import { TENANT_APP_IDS } from './app/visualization-service.js';

const log = logger.child({ service: 'AnalysisToDashboard' });

// ===== CONSTANTS =====

/** Default App ID for qmb-main tenant */
const DEFAULT_APP_ID = 'a30ab30d-cf2a-41fa-86ef-cf4f189deecf';

/** Grid dimensions (Qlik standard) */
const GRID_COLUMNS = 24;
const GRID_ROWS = 12;

/** Default sizes */
const KPI_HEIGHT = 3;
const CHART_HEIGHT = 5;
const TABLE_HEIGHT = 4;

/** Maximum items before switching to table */
const MAX_BAR_CHART_ITEMS = 15;
const MAX_PIE_CHART_ITEMS = 3; // Per rule 31: prefer bars over pie

// ===== MAIN FUNCTIONS =====

/**
 * Map analysis output to visualization specifications
 */
export function mapAnalysisToVisualizations(analysis: AnalysisOutput): VisualizationSpec[] {
  const specs: VisualizationSpec[] = [];
  let currentRow = 0;

  // 1. KPIs at the top
  if (analysis.metrics && analysis.metrics.length > 0) {
    const kpiSpecs = mapMetricsToKPIs(analysis.metrics, currentRow);
    specs.push(...kpiSpecs);
    currentRow += KPI_HEIGHT;
  }

  // 2. Breakdowns as charts (middle section)
  if (analysis.breakdowns && analysis.breakdowns.length > 0) {
    const breakdownSpecs = mapBreakdownsToCharts(analysis.breakdowns, currentRow);
    specs.push(...breakdownSpecs);
    currentRow += Math.ceil(analysis.breakdowns.length / 2) * CHART_HEIGHT;
  }

  // 3. Trends as line/combo charts
  if (analysis.trends && analysis.trends.length > 0) {
    const trendSpecs = mapTrendsToCharts(analysis.trends, currentRow);
    specs.push(...trendSpecs);
    currentRow += CHART_HEIGHT;
  }

  // 4. Tables at the bottom
  if (analysis.tables && analysis.tables.length > 0) {
    const tableSpecs = mapTablesToVisualizations(analysis.tables, currentRow);
    specs.push(...tableSpecs);
  }

  log.info(`[AnalysisToDashboard] Mapped ${specs.length} visualizations from analysis`);
  return specs;
}

/**
 * Map metrics to KPI objects
 */
function mapMetricsToKPIs(metrics: AnalysisMetric[], startRow: number): VisualizationSpec[] {
  const specs: VisualizationSpec[] = [];
  const maxKPIs = Math.min(metrics.length, 4); // Rule 27: max 5-7 KPIs, we use 4 per row
  const kpiWidth = Math.floor(GRID_COLUMNS / maxKPIs);

  for (let i = 0; i < maxKPIs; i++) {
    const metric = metrics[i];
    const expression = metric.expression || generateMetricExpression(metric);

    specs.push({
      type: 'kpi',
      title: metric.name,
      dimensions: [],
      measures: [{ expression, label: metric.name }],
      position: {
        x: i * kpiWidth,
        y: startRow,
        width: kpiWidth,
        height: KPI_HEIGHT
      }
    });
  }

  return specs;
}

/**
 * Map breakdowns to chart visualizations
 */
function mapBreakdownsToCharts(breakdowns: AnalysisBreakdown[], startRow: number): VisualizationSpec[] {
  const specs: VisualizationSpec[] = [];

  for (let i = 0; i < breakdowns.length; i++) {
    const breakdown = breakdowns[i];
    const chartType = selectChartType(breakdown);
    const position = calculateBreakdownPosition(i, breakdowns.length, startRow);

    specs.push({
      type: chartType,
      title: `${breakdown.measure} by ${breakdown.dimension}`,
      dimensions: [breakdown.dimension],
      measures: [generateBreakdownMeasure(breakdown)],
      position,
      sourceData: breakdown.data
    });
  }

  return specs;
}

/**
 * Map trends to line/combo charts
 */
function mapTrendsToCharts(trends: AnalysisTrend[], startRow: number): VisualizationSpec[] {
  const specs: VisualizationSpec[] = [];

  for (let i = 0; i < trends.length; i++) {
    const trend = trends[i];
    const chartType = selectTrendChartType(trend);

    specs.push({
      type: chartType,
      title: `${trend.measures.join(', ')} Trend`,
      dimensions: [trend.dimension],
      measures: trend.measures.map(m => ({ expression: `Sum(${m})`, label: m })),
      position: {
        x: 0,
        y: startRow + (i * CHART_HEIGHT),
        width: GRID_COLUMNS,
        height: CHART_HEIGHT
      },
      sourceData: trend.data
    });
  }

  return specs;
}

/**
 * Map tables to table visualizations
 */
function mapTablesToVisualizations(tables: AnalysisTable[], startRow: number): VisualizationSpec[] {
  const specs: VisualizationSpec[] = [];

  for (let i = 0; i < tables.length; i++) {
    const table = tables[i];

    specs.push({
      type: 'table',
      title: table.title,
      dimensions: table.columns.filter(c => c.type === 'dimension').map(c => c.field),
      measures: table.columns
        .filter(c => c.type === 'measure')
        .map(c => ({ expression: `Sum(${c.field})`, label: c.label })),
      position: {
        x: 0,
        y: startRow + (i * TABLE_HEIGHT),
        width: GRID_COLUMNS,
        height: TABLE_HEIGHT
      }
    });
  }

  return specs;
}

// ===== CHART TYPE SELECTION =====

/**
 * Select chart type based on cognitive rules
 * Decision tree from qlik-semantic-bridge.skill
 */
function selectChartType(breakdown: AnalysisBreakdown): VisualizationType {
  // If explicitly specified, use it (unless it violates critical rules)
  if (breakdown.visualizationType) {
    // Rule 31: Don't use pie charts for more than 3 items
    if (breakdown.visualizationType === 'piechart' && breakdown.data.length > MAX_PIE_CHART_ITEMS) {
      log.warn(`[ChartSelection] Overriding piechart to barchart (Rule 31: ${breakdown.data.length} items > ${MAX_PIE_CHART_ITEMS})`);
      return 'barchart';
    }
    return breakdown.visualizationType;
  }

  const itemCount = breakdown.data.length;

  // Decision tree based on item count
  if (itemCount <= MAX_PIE_CHART_ITEMS) {
    // 2-3 items: Pie is OK
    return 'piechart';
  } else if (itemCount <= MAX_BAR_CHART_ITEMS) {
    // 4-15 items: Bar chart
    return 'barchart';
  } else {
    // >15 items: Table
    return 'table';
  }
}

/**
 * Select chart type for trend data
 */
function selectTrendChartType(trend: AnalysisTrend): VisualizationType {
  if (trend.visualizationType) {
    return trend.visualizationType;
  }

  // Rule 33: Use line charts for continuous time data
  if (trend.measures.length > 1) {
    // Multiple measures: combo chart
    return 'combochart';
  }

  return 'linechart';
}

// ===== POSITION CALCULATION =====

/**
 * Calculate position for breakdown charts
 * Uses 2-column grid layout
 */
function calculateBreakdownPosition(index: number, total: number, startRow: number): GridPosition {
  const isFullWidth = total === 1;
  const column = index % 2;
  const row = Math.floor(index / 2);

  return {
    x: isFullWidth ? 0 : column * 12,
    y: startRow + (row * CHART_HEIGHT),
    width: isFullWidth ? GRID_COLUMNS : 12,
    height: CHART_HEIGHT
  };
}

/**
 * Calculate overall grid layout for dashboard
 */
export function calculateDashboardLayout(analysis: AnalysisOutput): {
  totalHeight: number;
  sections: Array<{ name: string; startRow: number; height: number }>;
} {
  const sections: Array<{ name: string; startRow: number; height: number }> = [];
  let currentRow = 0;

  if (analysis.metrics && analysis.metrics.length > 0) {
    sections.push({ name: 'KPIs', startRow: currentRow, height: KPI_HEIGHT });
    currentRow += KPI_HEIGHT;
  }

  if (analysis.breakdowns && analysis.breakdowns.length > 0) {
    const breakdownHeight = Math.ceil(analysis.breakdowns.length / 2) * CHART_HEIGHT;
    sections.push({ name: 'Breakdowns', startRow: currentRow, height: breakdownHeight });
    currentRow += breakdownHeight;
  }

  if (analysis.trends && analysis.trends.length > 0) {
    const trendHeight = analysis.trends.length * CHART_HEIGHT;
    sections.push({ name: 'Trends', startRow: currentRow, height: trendHeight });
    currentRow += trendHeight;
  }

  if (analysis.tables && analysis.tables.length > 0) {
    const tableHeight = analysis.tables.length * TABLE_HEIGHT;
    sections.push({ name: 'Tables', startRow: currentRow, height: tableHeight });
    currentRow += tableHeight;
  }

  return { totalHeight: currentRow, sections };
}

// ===== EXPRESSION GENERATION =====

/**
 * Generate Qlik expression for a metric
 */
function generateMetricExpression(metric: AnalysisMetric): string {
  // If expression provided, use it
  if (metric.expression) {
    return metric.expression;
  }

  // Generate a static value expression for now
  // In real usage, this would be replaced with actual Qlik expressions
  return `${metric.value}`;
}

/**
 * Generate Qlik expression for a breakdown measure
 */
function generateBreakdownMeasure(breakdown: AnalysisBreakdown): string {
  // Map common measure names to Qlik expressions
  const measureExpressions: Record<string, string> = {
    count: 'Count(distinct sr_id)',
    mttr: 'Avg(SR_AGE_NUM/3600/24)',
    satisfaction: 'Avg(satisfaction_survey_answer)',
    sla: 'Sum(SLA_MET)/Count(distinct sr_id)',
    total: 'Count(distinct sr_id)'
  };

  return measureExpressions[breakdown.measure.toLowerCase()] || `Sum(${breakdown.measure})`;
}

// ===== URL GENERATION =====

/**
 * Generate sheet URL based on platform
 * - Cloud: Direct URL to sheet in browser
 * - On-Premise: Instructions to open in Desktop/Hub (no direct URL)
 */
export function generateSheetUrl(
  appId: string,
  sheetId: string,
  platform: 'cloud' | 'on-premise' = 'cloud'
): string {
  const tenant = getActiveTenant();

  if (platform === 'on-premise') {
    // On-Premise: Qlik Sense Enterprise uses different URL structure
    // or may require opening via Desktop/Hub
    return `${tenant.url}/sense/app/${appId}/sheet/${sheetId}`;
  }

  // Cloud: Full URL with state/analysis
  return `${tenant.url}/sense/app/${appId}/sheet/${sheetId}/state/analysis`;
}

/**
 * Get access instructions based on platform
 */
export function getAccessInstructions(platform: 'cloud' | 'on-premise'): string {
  if (platform === 'on-premise') {
    return 'Open in Qlik Sense Desktop or Hub and navigate to the app';
  }
  return 'Click the URL to open in browser';
}

/**
 * Get default App ID for current tenant
 */
export function getDefaultAppId(): string {
  const tenant = getActiveTenant();
  return TENANT_APP_IDS[tenant.id] || DEFAULT_APP_ID;
}

// ===== VALIDATION =====

/**
 * Validate analysis output structure
 */
export function validateAnalysisOutput(analysis: AnalysisOutput): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!analysis.title) {
    errors.push('Analysis must have a title');
  }

  const hasContent = (
    (analysis.metrics && analysis.metrics.length > 0) ||
    (analysis.breakdowns && analysis.breakdowns.length > 0) ||
    (analysis.trends && analysis.trends.length > 0) ||
    (analysis.tables && analysis.tables.length > 0)
  );

  if (!hasContent) {
    errors.push('Analysis must have at least one metric, breakdown, trend, or table');
  }

  // Validate metrics
  if (analysis.metrics) {
    for (const metric of analysis.metrics) {
      if (!metric.name) errors.push('Metric must have a name');
      if (metric.value === undefined) errors.push(`Metric "${metric.name}" must have a value`);
    }
  }

  // Validate breakdowns
  if (analysis.breakdowns) {
    for (const breakdown of analysis.breakdowns) {
      if (!breakdown.dimension) errors.push('Breakdown must have a dimension');
      if (!breakdown.measure) errors.push('Breakdown must have a measure');
      if (!breakdown.data || breakdown.data.length === 0) {
        errors.push(`Breakdown "${breakdown.dimension}" must have data`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ===== RULE ENFORCEMENT =====

/**
 * Apply critical visualization rules
 */
export function applyVisualizationRules(spec: VisualizationSpec): VisualizationSpec {
  const updatedSpec = { ...spec };

  // Rule 18 & 32: Bar charts start from 0
  if (spec.type === 'barchart') {
    log.debug('[Rules] Applying Rule 18: Bar chart Y-axis starts from 0');
    // This would be applied in the actual Qlik object properties
  }

  // Rule 31: Prefer bar over pie for many items
  if (spec.type === 'piechart' && spec.sourceData && spec.sourceData.length > MAX_PIE_CHART_ITEMS) {
    log.warn('[Rules] Applying Rule 31: Converting pie to bar chart');
    updatedSpec.type = 'barchart';
  }

  return updatedSpec;
}

/**
 * Get visualization rules summary
 */
export function getVisualizationRulesSummary(): string[] {
  return CRITICAL_VIZ_RULES.map(rule =>
    `Rule ${rule.id}: ${rule.name} (${rule.priority}) - ${rule.qlikProperty || 'N/A'}`
  );
}
