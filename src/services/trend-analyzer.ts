/**
 * Trend Analyzer Service - Analyzes time-series data for trends and patterns
 *
 * Capabilities:
 * - Trend direction detection (increasing, decreasing, stable, volatile)
 * - Trend strength calculation
 * - Simple linear regression for slope
 * - Moving average smoothing
 * - Outlier detection
 * - Simple prediction
 * - Bilingual summaries
 *
 * TaskGuard: services-017
 */

import { comparisonEngine } from './comparison-engine.js';

// ===== TYPE DEFINITIONS =====

export type TrendDirection = 'increasing' | 'decreasing' | 'stable' | 'volatile';
export type TrendStrength = 'strong' | 'moderate' | 'weak' | 'none';

export interface TimeSeriesPoint {
  timestamp: string | number;
  value: number;
  label?: string;
}

export interface TrendResult {
  direction: TrendDirection;
  strength: TrendStrength;
  slope: number;
  slopePercent: number;
  volatility: number;
  average: number;
  min: number;
  max: number;
  prediction?: number[];
  summary: string;
  summaryHe: string;
}

export interface SeasonalityResult {
  hasSeasonality: boolean;
  pattern: 'weekly' | 'monthly' | 'none';
  peakPeriod?: string;
  peakPeriodHe?: string;
  troughPeriod?: string;
  troughPeriodHe?: string;
}

export interface OutlierResult {
  outliers: TimeSeriesPoint[];
  threshold: number;
  count: number;
}

// ===== TREND ANALYZER CLASS =====

export class TrendAnalyzer {
  // Thresholds
  private readonly STRONG_SLOPE_THRESHOLD = 0.1;   // 10% change per period
  private readonly MODERATE_SLOPE_THRESHOLD = 0.05; // 5% change per period
  private readonly WEAK_SLOPE_THRESHOLD = 0.02;    // 2% change per period
  private readonly VOLATILITY_THRESHOLD = 0.3;     // 30% coefficient of variation
  private readonly OUTLIER_THRESHOLD = 2;          // 2 standard deviations

  /**
   * Analyze trend in time-series data
   */
  analyzeTrend(dataPoints: TimeSeriesPoint[]): TrendResult {
    if (dataPoints.length < 2) {
      return this.getEmptyResult();
    }

    const values = dataPoints.map(dp => dp.value);

    // Calculate basic statistics
    const average = this.calculateAverage(values);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const volatility = this.calculateVolatility(values, average);

    // Calculate slope using linear regression
    const slope = this.calculateSlope(values);
    const slopePercent = average !== 0 ? (slope / average) * 100 : 0;

    // Determine direction and strength
    const direction = this.getDirection(slope, volatility, values);
    const strength = this.getTrendStrength(slopePercent, volatility);

    // Generate summaries
    const summary = this.generateSummary(direction, strength, slopePercent, 'en');
    const summaryHe = this.generateSummary(direction, strength, slopePercent, 'he');

    return {
      direction,
      strength,
      slope: Math.round(slope * 100) / 100,
      slopePercent: Math.round(slopePercent * 10) / 10,
      volatility: Math.round(volatility * 100) / 100,
      average: Math.round(average * 100) / 100,
      min,
      max,
      summary,
      summaryHe
    };
  }

  /**
   * Calculate linear regression slope
   */
  private calculateSlope(values: number[]): number {
    const n = values.length;
    if (n < 2) return 0;

    // Simple linear regression: y = mx + b
    // m = (n*Σxy - Σx*Σy) / (n*Σx² - (Σx)²)
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }

    const denominator = n * sumX2 - sumX * sumX;
    if (denominator === 0) return 0;

    return (n * sumXY - sumX * sumY) / denominator;
  }

  /**
   * Calculate average
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * Calculate volatility (coefficient of variation)
   */
  private calculateVolatility(values: number[], average: number): number {
    if (values.length < 2 || average === 0) return 0;

    const variance = values.reduce((sum, v) => sum + Math.pow(v - average, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return stdDev / Math.abs(average);
  }

  /**
   * Determine trend direction
   */
  private getDirection(slope: number, volatility: number, values: number[]): TrendDirection {
    // High volatility means volatile
    if (volatility > this.VOLATILITY_THRESHOLD) {
      return 'volatile';
    }

    // Check slope significance relative to average
    const average = this.calculateAverage(values);
    const slopePercent = average !== 0 ? Math.abs(slope / average) : 0;

    if (slopePercent < this.WEAK_SLOPE_THRESHOLD) {
      return 'stable';
    }

    return slope > 0 ? 'increasing' : 'decreasing';
  }

  /**
   * Get trend strength
   */
  private getTrendStrength(slopePercent: number, volatility: number): TrendStrength {
    const absSlopePercent = Math.abs(slopePercent) / 100;

    // High volatility weakens the trend
    const adjustedSlope = absSlopePercent * (1 - Math.min(volatility, 0.5));

    if (adjustedSlope >= this.STRONG_SLOPE_THRESHOLD) return 'strong';
    if (adjustedSlope >= this.MODERATE_SLOPE_THRESHOLD) return 'moderate';
    if (adjustedSlope >= this.WEAK_SLOPE_THRESHOLD) return 'weak';
    return 'none';
  }

  /**
   * Calculate moving average
   */
  getMovingAverage(dataPoints: TimeSeriesPoint[], window: number = 3): number[] {
    const values = dataPoints.map(dp => dp.value);
    if (values.length < window) return values;

    const result: number[] = [];

    for (let i = 0; i <= values.length - window; i++) {
      const windowSlice = values.slice(i, i + window);
      const avg = windowSlice.reduce((sum, v) => sum + v, 0) / window;
      result.push(Math.round(avg * 100) / 100);
    }

    return result;
  }

  /**
   * Identify outliers using standard deviation
   */
  identifyOutliers(dataPoints: TimeSeriesPoint[]): OutlierResult {
    if (dataPoints.length < 3) {
      return { outliers: [], threshold: 0, count: 0 };
    }

    const values = dataPoints.map(dp => dp.value);
    const average = this.calculateAverage(values);
    const variance = values.reduce((sum, v) => sum + Math.pow(v - average, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    const threshold = this.OUTLIER_THRESHOLD * stdDev;
    const outliers = dataPoints.filter(dp =>
      Math.abs(dp.value - average) > threshold
    );

    return {
      outliers,
      threshold: Math.round(threshold * 100) / 100,
      count: outliers.length
    };
  }

  /**
   * Simple prediction for next N periods
   */
  predictNext(dataPoints: TimeSeriesPoint[], periods: number = 3): number[] {
    if (dataPoints.length < 2) return [];

    const values = dataPoints.map(dp => dp.value);
    const slope = this.calculateSlope(values);
    const lastValue = values[values.length - 1];
    const lastIndex = values.length - 1;

    const predictions: number[] = [];
    for (let i = 1; i <= periods; i++) {
      // y = last + slope * i (simple linear extrapolation)
      const predicted = lastValue + slope * i;
      predictions.push(Math.max(0, Math.round(predicted * 100) / 100));
    }

    return predictions;
  }

  /**
   * Detect seasonality patterns
   */
  detectSeasonality(dataPoints: TimeSeriesPoint[]): SeasonalityResult {
    // Need at least 7 points for weekly, 30 for monthly
    if (dataPoints.length < 7) {
      return { hasSeasonality: false, pattern: 'none' };
    }

    const values = dataPoints.map(dp => dp.value);

    // Simple approach: check if weekly pattern exists (every 7 days)
    if (dataPoints.length >= 14) {
      const weeklyCorrelation = this.calculateAutocorrelation(values, 7);
      if (weeklyCorrelation > 0.5) {
        const peakDay = this.findPeakPeriod(values, 7);
        return {
          hasSeasonality: true,
          pattern: 'weekly',
          peakPeriod: this.getDayName(peakDay, 'en'),
          peakPeriodHe: this.getDayName(peakDay, 'he'),
          troughPeriod: this.getDayName((peakDay + 3) % 7, 'en'),
          troughPeriodHe: this.getDayName((peakDay + 3) % 7, 'he')
        };
      }
    }

    // Check monthly pattern (every 30 days)
    if (dataPoints.length >= 60) {
      const monthlyCorrelation = this.calculateAutocorrelation(values, 30);
      if (monthlyCorrelation > 0.5) {
        return {
          hasSeasonality: true,
          pattern: 'monthly',
          peakPeriod: 'Start of month',
          peakPeriodHe: 'תחילת החודש'
        };
      }
    }

    return { hasSeasonality: false, pattern: 'none' };
  }

  /**
   * Calculate autocorrelation at a given lag
   */
  private calculateAutocorrelation(values: number[], lag: number): number {
    if (values.length <= lag) return 0;

    const n = values.length - lag;
    const average = this.calculateAverage(values);

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (values[i] - average) * (values[i + lag] - average);
    }

    for (let i = 0; i < values.length; i++) {
      denominator += Math.pow(values[i] - average, 2);
    }

    if (denominator === 0) return 0;
    return numerator / denominator;
  }

  /**
   * Find peak period in a cycle
   */
  private findPeakPeriod(values: number[], period: number): number {
    const periodAverages: number[] = [];

    for (let p = 0; p < period; p++) {
      let sum = 0, count = 0;
      for (let i = p; i < values.length; i += period) {
        sum += values[i];
        count++;
      }
      periodAverages.push(count > 0 ? sum / count : 0);
    }

    let maxIndex = 0;
    let maxValue = periodAverages[0];
    for (let i = 1; i < periodAverages.length; i++) {
      if (periodAverages[i] > maxValue) {
        maxValue = periodAverages[i];
        maxIndex = i;
      }
    }

    return maxIndex;
  }

  /**
   * Get day name
   */
  private getDayName(dayIndex: number, language: 'he' | 'en'): string {
    const days = {
      en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      he: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
    };
    return days[language][dayIndex % 7];
  }

  /**
   * Generate human-readable summary
   */
  private generateSummary(
    direction: TrendDirection,
    strength: TrendStrength,
    slopePercent: number,
    language: 'he' | 'en'
  ): string {
    const absSlope = Math.abs(Math.round(slopePercent * 10) / 10);

    if (language === 'he') {
      switch (direction) {
        case 'increasing':
          return `מגמת עלייה ${this.getStrengthHe(strength)} (${absSlope}% לתקופה)`;
        case 'decreasing':
          return `מגמת ירידה ${this.getStrengthHe(strength)} (${absSlope}% לתקופה)`;
        case 'stable':
          return 'מגמה יציבה, ללא שינוי משמעותי';
        case 'volatile':
          return 'תנודתיות גבוהה, ללא מגמה ברורה';
      }
    } else {
      switch (direction) {
        case 'increasing':
          return `${this.getStrengthEn(strength)} upward trend (${absSlope}% per period)`;
        case 'decreasing':
          return `${this.getStrengthEn(strength)} downward trend (${absSlope}% per period)`;
        case 'stable':
          return 'Stable trend, no significant change';
        case 'volatile':
          return 'High volatility, no clear trend';
      }
    }
  }

  private getStrengthHe(strength: TrendStrength): string {
    switch (strength) {
      case 'strong': return 'חזקה';
      case 'moderate': return 'בינונית';
      case 'weak': return 'חלשה';
      default: return '';
    }
  }

  private getStrengthEn(strength: TrendStrength): string {
    switch (strength) {
      case 'strong': return 'Strong';
      case 'moderate': return 'Moderate';
      case 'weak': return 'Weak';
      default: return '';
    }
  }

  /**
   * Get empty result for insufficient data
   */
  private getEmptyResult(): TrendResult {
    return {
      direction: 'stable',
      strength: 'none',
      slope: 0,
      slopePercent: 0,
      volatility: 0,
      average: 0,
      min: 0,
      max: 0,
      summary: 'Insufficient data for trend analysis',
      summaryHe: 'אין מספיק נתונים לניתוח מגמה'
    };
  }

  /**
   * Compare two periods and analyze the trend between them
   */
  comparePeriods(current: number, previous: number): {
    comparison: ReturnType<typeof comparisonEngine.quickCompare>;
    trendDescription: string;
    trendDescriptionHe: string;
  } {
    const comparison = comparisonEngine.quickCompare(current, previous);

    let trendDescription: string;
    let trendDescriptionHe: string;

    if (comparison.direction === 'unchanged') {
      trendDescription = 'No change between periods';
      trendDescriptionHe = 'אין שינוי בין התקופות';
    } else {
      const arrow = comparison.direction === 'up' ? '↑' : '↓';
      const sign = comparison.percentDiff >= 0 ? '+' : '';
      trendDescription = `${arrow} ${sign}${comparison.percentDiff}% (${previous} → ${current})`;
      trendDescriptionHe = `${arrow} ${sign}${comparison.percentDiff}% (${previous} ← ${current})`;
    }

    return { comparison, trendDescription, trendDescriptionHe };
  }
}

// Export singleton instance
export const trendAnalyzer = new TrendAnalyzer();
