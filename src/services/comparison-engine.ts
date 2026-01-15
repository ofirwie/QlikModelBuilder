/**
 * Comparison Engine Service - Compares data across periods, entities, and dimensions
 *
 * Capabilities:
 * - Period-over-period comparison (month, year)
 * - Entity comparison (incidents vs requests)
 * - Dimension comparison (category, technician, etc.)
 * - Percentage and absolute difference calculation
 * - Bilingual result formatting
 *
 * TaskGuard: services-016
 */

// ===== TYPE DEFINITIONS =====

export type ComparisonType = 'period' | 'entity' | 'dimension' | 'benchmark';

export interface DataSet {
  label: string;
  labelHe?: string;
  value: number;
  breakdown?: DataPoint[];
}

export interface DataPoint {
  dimension: string;
  value: number;
  label?: string;
}

export interface ComparisonInput {
  type: ComparisonType;
  current: DataSet;
  previous: DataSet;
  breakdownDimension?: string;
}

export interface ComparisonResult {
  type: ComparisonType;
  currentLabel: string;
  currentLabelHe: string;
  previousLabel: string;
  previousLabelHe: string;
  currentValue: number;
  previousValue: number;
  absoluteDiff: number;
  percentDiff: number;
  direction: 'up' | 'down' | 'unchanged';
  significance: 'critical' | 'significant' | 'moderate' | 'minor' | 'negligible';
  summary: string;
  summaryHe: string;
  breakdown?: BreakdownComparison[];
}

export interface BreakdownComparison {
  dimension: string;
  currentValue: number;
  previousValue: number;
  absoluteDiff: number;
  percentDiff: number;
  direction: 'up' | 'down' | 'unchanged';
}

export interface PeriodComparisonResult extends ComparisonResult {
  periodType: 'month' | 'year' | 'week' | 'custom';
}

// ===== COMPARISON ENGINE CLASS =====

export class ComparisonEngine {
  // Thresholds for significance
  private readonly CRITICAL_THRESHOLD = 0.5;    // 50% change
  private readonly SIGNIFICANT_THRESHOLD = 0.3; // 30% change
  private readonly MODERATE_THRESHOLD = 0.15;   // 15% change
  private readonly MINOR_THRESHOLD = 0.05;      // 5% change

  /**
   * Compare two data sets
   */
  compare(input: ComparisonInput): ComparisonResult {
    const { type, current, previous } = input;

    // Calculate differences
    const absoluteDiff = current.value - previous.value;
    const percentDiff = previous.value !== 0
      ? (absoluteDiff / previous.value)
      : (current.value !== 0 ? 1 : 0);

    // Determine direction
    const direction = this.getDirection(absoluteDiff);

    // Determine significance
    const significance = this.getSignificance(percentDiff);

    // Build breakdown comparison if available
    let breakdown: BreakdownComparison[] | undefined;
    if (current.breakdown && previous.breakdown) {
      breakdown = this.compareBreakdowns(current.breakdown, previous.breakdown);
    }

    // Generate summaries
    const summary = this.generateSummary(current, previous, percentDiff, direction, 'en');
    const summaryHe = this.generateSummary(current, previous, percentDiff, direction, 'he');

    return {
      type,
      currentLabel: current.label,
      currentLabelHe: current.labelHe || current.label,
      previousLabel: previous.label,
      previousLabelHe: previous.labelHe || previous.label,
      currentValue: current.value,
      previousValue: previous.value,
      absoluteDiff,
      percentDiff: Math.round(percentDiff * 100),
      direction,
      significance,
      summary,
      summaryHe,
      breakdown
    };
  }

  /**
   * Compare current month to previous month
   */
  compareMonths(currentValue: number, previousValue: number): PeriodComparisonResult {
    const input: ComparisonInput = {
      type: 'period',
      current: {
        label: 'This month',
        labelHe: 'החודש',
        value: currentValue
      },
      previous: {
        label: 'Last month',
        labelHe: 'חודש שעבר',
        value: previousValue
      }
    };

    const result = this.compare(input);
    return {
      ...result,
      periodType: 'month'
    };
  }

  /**
   * Compare current year to previous year
   */
  compareYears(currentValue: number, previousValue: number): PeriodComparisonResult {
    const input: ComparisonInput = {
      type: 'period',
      current: {
        label: 'This year',
        labelHe: 'השנה',
        value: currentValue
      },
      previous: {
        label: 'Last year',
        labelHe: 'שנה שעברה',
        value: previousValue
      }
    };

    const result = this.compare(input);
    return {
      ...result,
      periodType: 'year'
    };
  }

  /**
   * Compare two entities (e.g., incidents vs requests)
   */
  compareEntities(
    entity1: { name: string; nameHe: string; value: number },
    entity2: { name: string; nameHe: string; value: number }
  ): ComparisonResult {
    const input: ComparisonInput = {
      type: 'entity',
      current: {
        label: entity1.name,
        labelHe: entity1.nameHe,
        value: entity1.value
      },
      previous: {
        label: entity2.name,
        labelHe: entity2.nameHe,
        value: entity2.value
      }
    };

    return this.compare(input);
  }

  /**
   * Compare breakdown distributions
   */
  private compareBreakdowns(current: DataPoint[], previous: DataPoint[]): BreakdownComparison[] {
    const comparisons: BreakdownComparison[] = [];

    // Create map of previous values
    const previousMap = new Map<string, number>();
    for (const dp of previous) {
      previousMap.set(dp.dimension, dp.value);
    }

    // Compare each current dimension
    for (const dp of current) {
      const prevValue = previousMap.get(dp.dimension) || 0;
      const absoluteDiff = dp.value - prevValue;
      const percentDiff = prevValue !== 0
        ? (absoluteDiff / prevValue)
        : (dp.value !== 0 ? 1 : 0);

      comparisons.push({
        dimension: dp.dimension,
        currentValue: dp.value,
        previousValue: prevValue,
        absoluteDiff,
        percentDiff: Math.round(percentDiff * 100),
        direction: this.getDirection(absoluteDiff)
      });
    }

    // Sort by absolute difference (largest changes first)
    comparisons.sort((a, b) => Math.abs(b.absoluteDiff) - Math.abs(a.absoluteDiff));

    return comparisons;
  }

  /**
   * Get direction from difference
   */
  private getDirection(diff: number): 'up' | 'down' | 'unchanged' {
    if (diff > 0) return 'up';
    if (diff < 0) return 'down';
    return 'unchanged';
  }

  /**
   * Get significance level from percent difference
   */
  private getSignificance(percentDiff: number): 'critical' | 'significant' | 'moderate' | 'minor' | 'negligible' {
    const abs = Math.abs(percentDiff);
    if (abs >= this.CRITICAL_THRESHOLD) return 'critical';
    if (abs >= this.SIGNIFICANT_THRESHOLD) return 'significant';
    if (abs >= this.MODERATE_THRESHOLD) return 'moderate';
    if (abs >= this.MINOR_THRESHOLD) return 'minor';
    return 'negligible';
  }

  /**
   * Generate human-readable summary
   */
  private generateSummary(
    current: DataSet,
    previous: DataSet,
    percentDiff: number,
    direction: 'up' | 'down' | 'unchanged',
    language: 'he' | 'en'
  ): string {
    const absPercent = Math.abs(Math.round(percentDiff * 100));
    const currentLabel = language === 'he' ? (current.labelHe || current.label) : current.label;
    const previousLabel = language === 'he' ? (previous.labelHe || previous.label) : previous.label;

    if (direction === 'unchanged') {
      return language === 'he'
        ? `אין שינוי בין ${currentLabel} ל-${previousLabel}`
        : `No change between ${currentLabel} and ${previousLabel}`;
    }

    if (language === 'he') {
      const directionText = direction === 'up' ? 'עלייה' : 'ירידה';
      return `${directionText} של ${absPercent}% מ-${previous.value} ל-${current.value} (${previousLabel} לעומת ${currentLabel})`;
    } else {
      const directionText = direction === 'up' ? 'increase' : 'decrease';
      return `${absPercent}% ${directionText} from ${previous.value} to ${current.value} (${previousLabel} vs ${currentLabel})`;
    }
  }

  /**
   * Format comparison for display
   */
  formatForDisplay(result: ComparisonResult, language: 'he' | 'en'): string {
    const lines: string[] = [];
    const summary = language === 'he' ? result.summaryHe : result.summary;

    lines.push(summary);

    if (result.breakdown && result.breakdown.length > 0) {
      const headerText = language === 'he' ? 'פירוט לפי מימד:' : 'Breakdown by dimension:';
      lines.push('');
      lines.push(headerText);

      // Show top 5 changes
      const topChanges = result.breakdown.slice(0, 5);
      for (const item of topChanges) {
        const arrow = item.direction === 'up' ? '↑' : item.direction === 'down' ? '↓' : '→';
        const sign = item.percentDiff >= 0 ? '+' : '';
        lines.push(`  ${arrow} ${item.dimension}: ${item.previousValue} → ${item.currentValue} (${sign}${item.percentDiff}%)`);
      }

      if (result.breakdown.length > 5) {
        const moreText = language === 'he'
          ? `  ... ועוד ${result.breakdown.length - 5}`
          : `  ... and ${result.breakdown.length - 5} more`;
        lines.push(moreText);
      }
    }

    return lines.join('\n');
  }

  /**
   * Get emoji indicator for direction
   */
  getDirectionEmoji(direction: 'up' | 'down' | 'unchanged', isPositive: boolean = true): string {
    if (direction === 'unchanged') return '➡️';

    // For some metrics, up is bad (e.g., open tickets)
    if (direction === 'up') {
      return isPositive ? '📈' : '📈⚠️';
    } else {
      return isPositive ? '📉⚠️' : '📉';
    }
  }

  /**
   * Check if comparison shows a problem
   */
  isProblematic(result: ComparisonResult, upIsGood: boolean = false): boolean {
    // If no change or negligible, not problematic
    if (result.direction === 'unchanged' || result.significance === 'negligible') {
      return false;
    }

    // Critical or significant changes are problematic if in wrong direction
    if (result.significance === 'critical' || result.significance === 'significant') {
      if (upIsGood) {
        return result.direction === 'down';
      } else {
        return result.direction === 'up';
      }
    }

    return false;
  }

  /**
   * Calculate ratio between two values
   */
  calculateRatio(value1: number, value2: number): number {
    if (value2 === 0) return value1 === 0 ? 1 : Infinity;
    return value1 / value2;
  }

  /**
   * Quick comparison of two numbers
   */
  quickCompare(current: number, previous: number): {
    diff: number;
    percentDiff: number;
    direction: 'up' | 'down' | 'unchanged';
    significance: 'critical' | 'significant' | 'moderate' | 'minor' | 'negligible';
  } {
    const diff = current - previous;
    const percentDiff = previous !== 0 ? diff / previous : (current !== 0 ? 1 : 0);

    return {
      diff,
      percentDiff: Math.round(percentDiff * 100),
      direction: this.getDirection(diff),
      significance: this.getSignificance(percentDiff)
    };
  }
}

// Export singleton instance
export const comparisonEngine = new ComparisonEngine();
