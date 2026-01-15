/**
 * Insight Detector Service - Detects patterns, anomalies, and insights in data
 *
 * Capabilities:
 * - Anomaly detection (spikes, drops)
 * - Trend identification
 * - SLA breach detection
 * - Distribution pattern analysis
 * - Benchmark comparison
 *
 * TaskGuard: services-014
 */

// ===== TYPE DEFINITIONS =====

export type InsightType = 'anomaly' | 'trend' | 'breach' | 'pattern' | 'workload' | 'comparison';
export type InsightSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface DataPoint {
  value: number;
  label?: string;
  dimension?: string;
  timestamp?: string;
}

export interface SlaData {
  met: number;
  breached: number;
  nearBreach?: number;
}

export interface Benchmarks {
  teamAverage?: number;
  industryAverage?: number;
  target?: number;
  previousPeriod?: number;
}

export interface Insight {
  type: InsightType;
  severity: InsightSeverity;
  title: string;
  titleHe: string;
  description: string;
  descriptionHe: string;
  suggestion?: string;
  suggestionHe?: string;
  value?: number;
  change?: number;
  threshold?: number;
}

export interface DetectionInput {
  current?: DataPoint[];
  previous?: DataPoint[];
  breakdown?: DataPoint[];
  slaData?: SlaData;
  benchmarks?: Benchmarks;
}

export interface DetectionResult {
  insights: Insight[];
  hasAnomalies: boolean;
  hasCritical: boolean;
  summary: string;
  summaryHe: string;
}

// ===== INSIGHT DETECTOR CLASS =====

export class InsightDetector {
  // Thresholds for detection
  private readonly ANOMALY_THRESHOLD = 0.3; // 30% change is anomaly
  private readonly CRITICAL_THRESHOLD = 0.5; // 50% change is critical
  private readonly SLA_CRITICAL_THRESHOLD = 0.1; // 10% breach is critical
  private readonly SLA_WARNING_THRESHOLD = 0.05; // 5% breach is warning
  private readonly WORKLOAD_HIGH_THRESHOLD = 1.5; // 50% above average
  private readonly WORKLOAD_LOW_THRESHOLD = 0.5; // 50% below average

  /**
   * Detect all insights from input data
   */
  detect(input: DetectionInput): DetectionResult {
    const insights: Insight[] = [];

    // Detect trends if we have current and previous data
    if (input.current && input.previous) {
      insights.push(...this.detectTrends(input.current, input.previous));
    }

    // Detect anomalies in current data
    if (input.current && input.current.length > 1) {
      insights.push(...this.detectAnomalies(input.current));
    }

    // Detect SLA breaches
    if (input.slaData) {
      insights.push(...this.detectSlaBreaches(input.slaData));
    }

    // Detect distribution patterns in breakdown
    if (input.breakdown && input.breakdown.length > 0) {
      insights.push(...this.detectPatterns(input.breakdown));
    }

    // Detect workload imbalances
    if (input.breakdown && input.breakdown.length > 1) {
      insights.push(...this.detectWorkloadImbalance(input.breakdown));
    }

    // Compare to benchmarks
    if (input.current && input.benchmarks) {
      insights.push(...this.compareToBenchmarks(input.current, input.benchmarks));
    }

    // Sort by severity
    const sortedInsights = this.sortBySeverity(insights);

    // Generate summary
    const hasAnomalies = insights.some(i => i.type === 'anomaly');
    const hasCritical = insights.some(i => i.severity === 'critical');

    return {
      insights: sortedInsights,
      hasAnomalies,
      hasCritical,
      summary: this.generateSummary(sortedInsights, 'en'),
      summaryHe: this.generateSummary(sortedInsights, 'he')
    };
  }

  /**
   * Detect trends between two periods
   */
  private detectTrends(current: DataPoint[], previous: DataPoint[]): Insight[] {
    const insights: Insight[] = [];

    // Calculate totals
    const currentTotal = current.reduce((sum, dp) => sum + dp.value, 0);
    const previousTotal = previous.reduce((sum, dp) => sum + dp.value, 0);

    if (previousTotal === 0) return insights;

    const change = (currentTotal - previousTotal) / previousTotal;
    const absChange = Math.abs(change);
    const direction = change > 0 ? 'increase' : 'decrease';
    const directionHe = change > 0 ? 'עלייה' : 'ירידה';

    // Determine severity
    let severity: InsightSeverity = 'info';
    if (absChange >= this.CRITICAL_THRESHOLD) {
      severity = 'critical';
    } else if (absChange >= this.ANOMALY_THRESHOLD) {
      severity = 'high';
    } else if (absChange >= 0.15) {
      severity = 'medium';
    } else if (absChange >= 0.05) {
      severity = 'low';
    }

    if (absChange >= 0.05) {
      const percentChange = Math.round(absChange * 100);

      insights.push({
        type: 'trend',
        severity,
        title: `${percentChange}% ${direction} from previous period`,
        titleHe: `${directionHe} של ${percentChange}% מהתקופה הקודמת`,
        description: `Volume changed from ${previousTotal} to ${currentTotal} (${change > 0 ? '+' : ''}${percentChange}%)`,
        descriptionHe: `כמות השתנתה מ-${previousTotal} ל-${currentTotal} (${change > 0 ? '+' : ''}${percentChange}%)`,
        suggestion: change > 0
          ? 'Investigate the cause of the increase and allocate additional resources if needed'
          : 'Review if the decrease indicates improved efficiency or reduced demand',
        suggestionHe: change > 0
          ? 'בדוק את סיבת העלייה והקצה משאבים נוספים במידת הצורך'
          : 'בדוק האם הירידה מצביעה על יעילות משופרת או ביקוש נמוך',
        value: currentTotal,
        change: percentChange
      });
    }

    return insights;
  }

  /**
   * Detect anomalies within a dataset
   */
  private detectAnomalies(data: DataPoint[]): Insight[] {
    const insights: Insight[] = [];

    if (data.length < 2) return insights;

    // Calculate mean and standard deviation
    const values = data.map(dp => dp.value);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // Find outliers (more than 2 standard deviations from mean)
    const threshold = mean + 2 * stdDev;
    const lowThreshold = Math.max(0, mean - 2 * stdDev);

    for (const dp of data) {
      if (dp.value > threshold) {
        insights.push({
          type: 'anomaly',
          severity: 'high',
          title: `Spike detected${dp.label ? `: ${dp.label}` : ''}`,
          titleHe: `זוהה שיא${dp.label ? `: ${dp.label}` : ''}`,
          description: `Value ${dp.value} is significantly above average (${Math.round(mean)})`,
          descriptionHe: `הערך ${dp.value} גבוה משמעותית מהממוצע (${Math.round(mean)})`,
          suggestion: 'Investigate the cause of this spike',
          suggestionHe: 'בדוק את הסיבה לשיא זה',
          value: dp.value,
          threshold: Math.round(threshold)
        });
      } else if (dp.value < lowThreshold && lowThreshold > 0) {
        insights.push({
          type: 'anomaly',
          severity: 'medium',
          title: `Drop detected${dp.label ? `: ${dp.label}` : ''}`,
          titleHe: `זוהתה ירידה${dp.label ? `: ${dp.label}` : ''}`,
          description: `Value ${dp.value} is significantly below average (${Math.round(mean)})`,
          descriptionHe: `הערך ${dp.value} נמוך משמעותית מהממוצע (${Math.round(mean)})`,
          suggestion: 'Check if this indicates an issue or improvement',
          suggestionHe: 'בדוק האם זה מצביע על בעיה או שיפור',
          value: dp.value,
          threshold: Math.round(lowThreshold)
        });
      }
    }

    return insights;
  }

  /**
   * Detect SLA breaches
   */
  private detectSlaBreaches(slaData: SlaData): Insight[] {
    const insights: Insight[] = [];

    const total = slaData.met + slaData.breached;
    if (total === 0) return insights;

    const breachRate = slaData.breached / total;
    const complianceRate = slaData.met / total;

    // Critical if breach rate is high
    if (breachRate >= this.SLA_CRITICAL_THRESHOLD) {
      insights.push({
        type: 'breach',
        severity: 'critical',
        title: `${Math.round(breachRate * 100)}% SLA breach rate`,
        titleHe: `${Math.round(breachRate * 100)}% חריגה מ-SLA`,
        description: `${slaData.breached} out of ${total} tickets breached SLA`,
        descriptionHe: `${slaData.breached} מתוך ${total} קריאות חרגו מ-SLA`,
        suggestion: 'Immediate action required to address SLA breaches',
        suggestionHe: 'נדרשת פעולה מיידית לטיפול בחריגות SLA',
        value: slaData.breached,
        change: Math.round(breachRate * 100)
      });
    } else if (breachRate >= this.SLA_WARNING_THRESHOLD) {
      insights.push({
        type: 'breach',
        severity: 'high',
        title: `${Math.round(breachRate * 100)}% SLA breach rate`,
        titleHe: `${Math.round(breachRate * 100)}% חריגה מ-SLA`,
        description: `${slaData.breached} tickets breached SLA - compliance at ${Math.round(complianceRate * 100)}%`,
        descriptionHe: `${slaData.breached} קריאות חרגו מ-SLA - עמידה ב-${Math.round(complianceRate * 100)}%`,
        suggestion: 'Monitor SLA compliance and take preventive action',
        suggestionHe: 'עקוב אחר עמידה ב-SLA ונקוט פעולות מניעה',
        value: slaData.breached,
        change: Math.round(breachRate * 100)
      });
    }

    // Near-breach warning
    if (slaData.nearBreach && slaData.nearBreach > 0) {
      const nearBreachRate = slaData.nearBreach / total;
      if (nearBreachRate >= 0.1) {
        insights.push({
          type: 'breach',
          severity: 'medium',
          title: `${slaData.nearBreach} tickets near SLA breach`,
          titleHe: `${slaData.nearBreach} קריאות קרובות לחריגה`,
          description: `${Math.round(nearBreachRate * 100)}% of tickets are at risk of breaching SLA`,
          descriptionHe: `${Math.round(nearBreachRate * 100)}% מהקריאות בסיכון לחריגה מ-SLA`,
          suggestion: 'Prioritize these tickets to prevent SLA breaches',
          suggestionHe: 'תעדף קריאות אלו למניעת חריגה',
          value: slaData.nearBreach
        });
      }
    }

    // Good compliance
    if (complianceRate >= 0.95 && total >= 10) {
      insights.push({
        type: 'pattern',
        severity: 'info',
        title: `Excellent SLA compliance: ${Math.round(complianceRate * 100)}%`,
        titleHe: `עמידה מצוינת ב-SLA: ${Math.round(complianceRate * 100)}%`,
        description: `${slaData.met} out of ${total} tickets met SLA`,
        descriptionHe: `${slaData.met} מתוך ${total} קריאות עמדו ב-SLA`,
        value: slaData.met,
        change: Math.round(complianceRate * 100)
      });
    }

    return insights;
  }

  /**
   * Detect distribution patterns in breakdown data
   */
  private detectPatterns(breakdown: DataPoint[]): Insight[] {
    const insights: Insight[] = [];

    if (breakdown.length === 0) return insights;

    // Sort by value descending
    const sorted = [...breakdown].sort((a, b) => b.value - a.value);
    const total = sorted.reduce((sum, dp) => sum + dp.value, 0);

    if (total === 0) return insights;

    // Check for concentration (top item has majority)
    const topItem = sorted[0];
    const topShare = topItem.value / total;

    if (topShare >= 0.5 && sorted.length > 2) {
      insights.push({
        type: 'pattern',
        severity: 'medium',
        title: `High concentration: ${topItem.label || 'Top item'}`,
        titleHe: `ריכוז גבוה: ${topItem.label || 'פריט ראשון'}`,
        description: `${topItem.label || 'Top item'} accounts for ${Math.round(topShare * 100)}% of total`,
        descriptionHe: `${topItem.label || 'פריט ראשון'} מהווה ${Math.round(topShare * 100)}% מהסך הכל`,
        suggestion: 'Consider investigating this category for improvements',
        suggestionHe: 'שקול לחקור קטגוריה זו לשיפורים',
        value: topItem.value,
        change: Math.round(topShare * 100)
      });
    }

    // Check for 80/20 pattern
    let cumulative = 0;
    let count = 0;
    for (const dp of sorted) {
      cumulative += dp.value;
      count++;
      if (cumulative / total >= 0.8) {
        break;
      }
    }

    if (count <= Math.ceil(sorted.length * 0.2) && sorted.length >= 5) {
      insights.push({
        type: 'pattern',
        severity: 'info',
        title: '80/20 pattern detected',
        titleHe: 'זוהה דפוס 80/20',
        description: `Top ${count} items account for 80% of volume`,
        descriptionHe: `${count} הפריטים הראשונים מהווים 80% מהנפח`,
        suggestion: 'Focus on the top items for maximum impact',
        suggestionHe: 'התמקד בפריטים המובילים להשפעה מירבית',
        value: count
      });
    }

    return insights;
  }

  /**
   * Detect workload imbalances
   */
  private detectWorkloadImbalance(breakdown: DataPoint[]): Insight[] {
    const insights: Insight[] = [];

    if (breakdown.length < 2) return insights;

    // Calculate average
    const values = breakdown.map(dp => dp.value);
    const average = values.reduce((sum, v) => sum + v, 0) / values.length;

    if (average === 0) return insights;

    // Find overloaded and underloaded
    const overloaded = breakdown.filter(dp => dp.value > average * this.WORKLOAD_HIGH_THRESHOLD);
    const underloaded = breakdown.filter(dp => dp.value < average * this.WORKLOAD_LOW_THRESHOLD);

    if (overloaded.length > 0) {
      const topOverloaded = overloaded.sort((a, b) => b.value - a.value)[0];
      const ratio = topOverloaded.value / average;

      insights.push({
        type: 'workload',
        severity: ratio > 2 ? 'high' : 'medium',
        title: `Workload imbalance: ${topOverloaded.label || 'Top item'}`,
        titleHe: `חוסר איזון בעומס: ${topOverloaded.label || 'פריט ראשון'}`,
        description: `${topOverloaded.label || 'Top item'} has ${Math.round(ratio * 100)}% of average workload`,
        descriptionHe: `${topOverloaded.label || 'פריט ראשון'} בעומס של ${Math.round(ratio * 100)}% מהממוצע`,
        suggestion: 'Consider redistributing work to balance the load',
        suggestionHe: 'שקול חלוקה מחדש של העבודה לאיזון העומס',
        value: topOverloaded.value,
        change: Math.round((ratio - 1) * 100)
      });
    }

    return insights;
  }

  /**
   * Compare current data to benchmarks
   */
  private compareToBenchmarks(current: DataPoint[], benchmarks: Benchmarks): Insight[] {
    const insights: Insight[] = [];

    const currentTotal = current.reduce((sum, dp) => sum + dp.value, 0);

    // Compare to target
    if (benchmarks.target !== undefined && benchmarks.target > 0) {
      const ratio = currentTotal / benchmarks.target;

      if (ratio > 1.2) {
        insights.push({
          type: 'comparison',
          severity: 'high',
          title: `${Math.round((ratio - 1) * 100)}% above target`,
          titleHe: `${Math.round((ratio - 1) * 100)}% מעל היעד`,
          description: `Current value ${currentTotal} exceeds target ${benchmarks.target}`,
          descriptionHe: `ערך נוכחי ${currentTotal} חורג מהיעד ${benchmarks.target}`,
          suggestion: 'Review processes to reduce volume back to target',
          suggestionHe: 'בחן תהליכים להפחתת הנפח ליעד',
          value: currentTotal,
          change: Math.round((ratio - 1) * 100),
          threshold: benchmarks.target
        });
      } else if (ratio < 0.8) {
        insights.push({
          type: 'comparison',
          severity: 'info',
          title: `${Math.round((1 - ratio) * 100)}% below target`,
          titleHe: `${Math.round((1 - ratio) * 100)}% מתחת ליעד`,
          description: `Current value ${currentTotal} is below target ${benchmarks.target}`,
          descriptionHe: `ערך נוכחי ${currentTotal} מתחת ליעד ${benchmarks.target}`,
          value: currentTotal,
          change: Math.round((ratio - 1) * 100),
          threshold: benchmarks.target
        });
      }
    }

    // Compare to team average
    if (benchmarks.teamAverage !== undefined && benchmarks.teamAverage > 0) {
      const ratio = currentTotal / benchmarks.teamAverage;

      if (ratio > 1.5) {
        insights.push({
          type: 'comparison',
          severity: 'medium',
          title: `${Math.round((ratio - 1) * 100)}% above team average`,
          titleHe: `${Math.round((ratio - 1) * 100)}% מעל ממוצע הצוות`,
          description: `Current ${currentTotal} vs team average ${Math.round(benchmarks.teamAverage)}`,
          descriptionHe: `נוכחי ${currentTotal} לעומת ממוצע צוות ${Math.round(benchmarks.teamAverage)}`,
          value: currentTotal,
          change: Math.round((ratio - 1) * 100),
          threshold: Math.round(benchmarks.teamAverage)
        });
      }
    }

    return insights;
  }

  /**
   * Sort insights by severity
   */
  private sortBySeverity(insights: Insight[]): Insight[] {
    const severityOrder: Record<InsightSeverity, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
      info: 4
    };

    return [...insights].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  }

  /**
   * Generate human-readable summary
   */
  private generateSummary(insights: Insight[], language: 'he' | 'en'): string {
    if (insights.length === 0) {
      return language === 'he' ? 'לא זוהו תובנות משמעותיות' : 'No significant insights detected';
    }

    const critical = insights.filter(i => i.severity === 'critical').length;
    const high = insights.filter(i => i.severity === 'high').length;
    const medium = insights.filter(i => i.severity === 'medium').length;

    if (language === 'he') {
      const parts: string[] = [];
      if (critical > 0) parts.push(`${critical} קריטי`);
      if (high > 0) parts.push(`${high} גבוה`);
      if (medium > 0) parts.push(`${medium} בינוני`);

      return `זוהו ${insights.length} תובנות: ${parts.join(', ') || 'ללא בעיות חמורות'}`;
    } else {
      const parts: string[] = [];
      if (critical > 0) parts.push(`${critical} critical`);
      if (high > 0) parts.push(`${high} high`);
      if (medium > 0) parts.push(`${medium} medium`);

      return `Detected ${insights.length} insights: ${parts.join(', ') || 'no severe issues'}`;
    }
  }

  /**
   * Quick check: has any critical insights
   */
  hasCriticalInsights(input: DetectionInput): boolean {
    const result = this.detect(input);
    return result.hasCritical;
  }

  /**
   * Get only high-severity insights
   */
  getHighPriorityInsights(input: DetectionInput): Insight[] {
    const result = this.detect(input);
    return result.insights.filter(i => i.severity === 'critical' || i.severity === 'high');
  }
}

// Export singleton instance
export const insightDetector = new InsightDetector();
