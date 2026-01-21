/**
 * @fileoverview Analyzer for Model Builder
 * @module model-builder/services/analyzer
 *
 * Analyzes enriched model spec to classify tables as Fact/Dimension
 * and detect optimal model type (Star, Snowflake, Link Table, Concatenated).
 */

import {
  EnrichedModelSpec,
  EnrichedTable,
  EnrichedField,
  EnrichedRelationship,
  TableClassification,
  ModelType,
} from '../types.js';
import { Logger } from './logger.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Result of table classification
 */
export interface TableClassificationResult {
  table_name: string;
  classification: TableClassification;
  confidence: number;
  reasoning: string[];
}

/**
 * Alternative model type suggestion
 */
export interface ModelTypeAlternative {
  model: ModelType;
  reason: string;
  pros: string[];
  cons: string[];
}

/**
 * Model type recommendation
 */
export interface ModelTypeRecommendation {
  recommended_model: ModelType;
  confidence: number;
  alternatives: ModelTypeAlternative[];
  reasoning: string;
}

/**
 * Analysis warning
 */
export interface AnalysisWarning {
  type: 'ambiguous_classification' | 'orphan_table' | 'circular_relationship' |
        'fan_trap' | 'chasm_trap' | 'missing_relationships' | 'low_confidence';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  tables_involved: string[];
  recommendation?: string;
}

/**
 * Complete analysis result
 */
export interface AnalysisResult {
  classifications: Map<string, TableClassificationResult>;
  model_recommendation: ModelTypeRecommendation;
  warnings: AnalysisWarning[];
  recommendations: string[];
}

// ============================================================================
// Constants
// ============================================================================

/** Measure field name patterns */
const MEASURE_PATTERNS = [
  /amount/i, /total/i, /sum/i, /count/i,
  /quantity/i, /qty/i, /price/i, /cost/i,
  /value/i, /revenue/i, /profit/i, /margin/i,
  /rate/i, /percent/i, /ratio/i, /weight/i,
];

/** Descriptive field name patterns */
const DESCRIPTIVE_PATTERNS = [
  /name$/i, /description/i, /desc$/i,
  /category/i, /type$/i, /status/i,
  /label/i, /title/i, /address/i,
  /city/i, /state/i, /country/i, /region/i,
];

/** Fact table naming patterns */
const FACT_NAME_PATTERNS = [
  /orders?$/i, /sales$/i, /transactions?$/i, /events?$/i,
  /payments?$/i, /invoices?$/i, /shipments?$/i, /bookings?$/i,
  /clicks?$/i, /logs?$/i, /activities?$/i, /movements?$/i,
  /_fact$/i, /^fact_/i, /^fct_/i,
];

/** Dimension table naming patterns */
const DIMENSION_NAME_PATTERNS = [
  /customers?$/i, /products?$/i, /categories?$/i, /locations?$/i,
  /employees?$/i, /vendors?$/i, /suppliers?$/i, /stores?$/i,
  /regions?$/i, /territories?$/i, /departments?$/i, /accounts?$/i,
  /_dim$/i, /^dim_/i, /^d_/i, /lookup$/i, /reference$/i,
];

/** Calendar table field patterns */
const CALENDAR_FIELDS = ['year', 'month', 'day', 'quarter', 'week'];

/** Numeric types */
const NUMERIC_TYPES = ['integer', 'decimal', 'number', 'float', 'double', 'int', 'numeric'];

/** String types */
const STRING_TYPES = ['string', 'varchar', 'text', 'char', 'nvarchar'];

// ============================================================================
// Analyzer Implementation
// ============================================================================

/**
 * Analyzer Implementation
 *
 * Analyzes model specifications to classify tables and recommend model types.
 */
export class Analyzer {
  private logger?: Logger;

  /**
   * Create a new Analyzer
   * @param logger - Optional logger instance
   */
  constructor(logger?: Logger) {
    this.logger = logger;
  }

  /**
   * Main analysis method
   * @param spec - Enriched model specification
   * @returns Complete analysis result
   */
  analyze(spec: EnrichedModelSpec): AnalysisResult {
    if (!spec.tables || spec.tables.length === 0) {
      throw new Error('AnalysisError: EnrichedModelSpec must contain at least one table');
    }

    const classifications = new Map<string, TableClassificationResult>();

    // Classify all tables
    for (const table of spec.tables) {
      const result = this.classifyTable(table, spec.tables);
      classifications.set(table.name, result);

      // Update table with classification
      table.classification = result.classification;
      table.classification_confidence = result.confidence;
    }

    // Detect model type
    const classMap = new Map(
      [...classifications.entries()].map(([name, r]) => [name, r.classification])
    );
    const modelRecommendation = this.detectModelType(classMap, spec.relationships);

    // Generate warnings
    const warnings = this.generateWarnings(classifications, spec.relationships, spec.tables);

    // Generate recommendations
    const recommendations = this.generateRecommendations({
      classifications,
      model_recommendation: modelRecommendation,
      warnings,
      recommendations: [],
    });

    this.logger?.info('analyzer', 'analysis_complete', {
      tables: spec.tables.length,
      facts: [...classMap.values()].filter(c => c === 'fact').length,
      dimensions: [...classMap.values()].filter(c => c === 'dimension').length,
      model_type: modelRecommendation.recommended_model,
      warnings: warnings.length,
    });

    return {
      classifications,
      model_recommendation: modelRecommendation,
      warnings,
      recommendations,
    };
  }

  /**
   * Classify a single table
   * @param table - Table to classify
   * @param allTables - All tables for context
   * @returns Classification result
   */
  classifyTable(table: EnrichedTable, allTables: EnrichedTable[]): TableClassificationResult {
    const scores: Record<TableClassification, number> = {
      fact: 0,
      dimension: 0,
      link: 0,
      calendar: 0,
    };
    const reasoning: string[] = [];

    // Rule 1: Check for calendar table first (takes priority)
    if (this.isCalendarTable(table)) {
      return {
        table_name: table.name,
        classification: 'calendar',
        confidence: 0.95,
        reasoning: ['Table structure matches calendar/date dimension pattern'],
      };
    }

    // Rule 2: Row count
    if (table.row_count > 10000) {
      scores.fact += 2;
      reasoning.push(`High row count (${table.row_count.toLocaleString()}) suggests transactional data`);
    } else if (table.row_count < 1000 && table.row_count > 0) {
      scores.dimension += 2;
      reasoning.push(`Low row count (${table.row_count.toLocaleString()}) suggests reference data`);
    }

    // Rule 3: Numeric measure fields
    const measureFields = table.fields.filter(f => this.isMeasureField(f));
    if (measureFields.length >= 2) {
      scores.fact += 3;
      reasoning.push(`Contains ${measureFields.length} measure fields (${measureFields.map(f => f.name).join(', ')})`);
    } else if (measureFields.length === 1) {
      scores.fact += 1;
      reasoning.push(`Contains 1 measure field (${measureFields[0].name})`);
    }

    // Rule 4: Foreign key count
    const fkCount = this.countForeignKeys(table, allTables);
    if (fkCount >= 2) {
      scores.fact += 2;
      reasoning.push(`References ${fkCount} other tables via foreign keys`);
    }

    // Rule 5: Date fields with high row count
    const dateFields = table.fields.filter(f => f.is_date_field);
    if (dateFields.length >= 1 && table.row_count > 5000) {
      scores.fact += 1;
      reasoning.push('Contains date field(s) with high row count');
    }

    // Rule 6: Descriptive string fields
    const descriptiveFields = table.fields.filter(f => this.isDescriptiveField(f));
    if (descriptiveFields.length >= 3) {
      scores.dimension += 2;
      reasoning.push(`Contains ${descriptiveFields.length} descriptive fields`);
    }

    // Rule 7: Table naming patterns
    if (this.matchesFactNaming(table.name)) {
      scores.fact += 1;
      reasoning.push(`Table name "${table.name}" matches transactional pattern`);
    }
    if (this.matchesDimensionNaming(table.name)) {
      scores.dimension += 1;
      reasoning.push(`Table name "${table.name}" matches dimension pattern`);
    }

    // Rule 8: Link/bridge table detection
    const bridgeResult = this.detectBridgeTable(table, allTables);
    if (bridgeResult.isBridge) {
      scores.link += 5;
      reasoning.push(...bridgeResult.reasoning);
    }

    // Determine classification
    const classification = this.getHighestScore(scores);
    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
    const confidence = totalScore > 0 ? Math.min(0.95, scores[classification] / totalScore) : 0.5;

    // Default to dimension with low confidence if no clear winner
    if (totalScore === 0 || confidence < 0.3) {
      return {
        table_name: table.name,
        classification: 'dimension',
        confidence: 0.3,
        reasoning: ['Low confidence: defaulting to dimension due to insufficient signals'],
      };
    }

    return {
      table_name: table.name,
      classification,
      confidence: Math.round(confidence * 100) / 100,
      reasoning,
    };
  }

  /**
   * Detect model type based on classifications and relationships
   * @param classifications - Table classifications
   * @param relationships - Enriched relationships
   * @returns Model type recommendation
   */
  detectModelType(
    classifications: Map<string, TableClassification>,
    relationships: EnrichedRelationship[]
  ): ModelTypeRecommendation {
    const facts = [...classifications.entries()].filter(([_, c]) => c === 'fact');
    const dimensions = [...classifications.entries()].filter(([_, c]) => c === 'dimension');
    const links = [...classifications.entries()].filter(([_, c]) => c === 'link');

    const alternatives: ModelTypeAlternative[] = [];
    let recommended: ModelType = 'star_schema';
    let confidence = 0.8;
    let reasoning = '';

    // Check for Snowflake: Dimension -> Dimension relationships
    const dimToDimRelations = relationships.filter(r => {
      const fromClass = classifications.get(r.from_table);
      const toClass = classifications.get(r.to_table);
      return fromClass === 'dimension' && toClass === 'dimension';
    });

    if (dimToDimRelations.length > 0) {
      recommended = 'snowflake';
      confidence = 0.85;
      reasoning = `${dimToDimRelations.length} dimension-to-dimension relationships form hierarchy`;
      alternatives.push({
        model: 'star_schema',
        reason: 'Can flatten hierarchies for simpler queries',
        pros: ['Simpler queries', 'Better performance', 'Easier to understand'],
        cons: ['Some denormalization required', 'Larger dimension tables'],
      });
    }

    // Check for Link Table: Multiple facts or N:M relationships
    const factToFactRelations = relationships.filter(r => {
      const fromClass = classifications.get(r.from_table);
      const toClass = classifications.get(r.to_table);
      return fromClass === 'fact' && toClass === 'fact';
    });

    if (factToFactRelations.length > 0 || links.length > 0) {
      recommended = 'link_table';
      confidence = 0.85;
      reasoning = 'Multiple fact tables or N:M relationships require Link Table approach';
      alternatives.push({
        model: 'star_schema',
        reason: 'Simpler if relationships can be restructured',
        pros: ['Simpler queries', 'Standard pattern'],
        cons: ['May lose relationship granularity'],
      });
    }

    // Check for Concatenated: Multiple similar facts
    if (facts.length >= 2 && recommended !== 'link_table') {
      const areSimilar = this.areSimilarFacts(facts.map(([name]) => name), classifications);
      if (areSimilar) {
        alternatives.push({
          model: 'concatenated',
          reason: 'Multiple similar fact tables could be concatenated',
          pros: ['Single unified fact table', 'Simplified analysis'],
          cons: ['Larger table', 'Need to track source'],
        });
      }
    }

    // Default Star Schema reasoning
    if (recommended === 'star_schema' && alternatives.length === 0) {
      reasoning = `${facts.length} fact(s) and ${dimensions.length} dimension(s) form a classic star schema`;
    }

    return {
      recommended_model: recommended,
      confidence,
      alternatives,
      reasoning,
    };
  }

  /**
   * Generate warnings for analysis issues
   */
  generateWarnings(
    classifications: Map<string, TableClassificationResult>,
    relationships: EnrichedRelationship[],
    tables: EnrichedTable[]
  ): AnalysisWarning[] {
    const warnings: AnalysisWarning[] = [];

    // Check for low confidence classifications
    for (const [name, result] of classifications) {
      if (result.confidence < 0.5) {
        warnings.push({
          type: 'low_confidence',
          severity: 'warning',
          message: `Low confidence (${(result.confidence * 100).toFixed(0)}%) for "${name}" as ${result.classification}`,
          tables_involved: [name],
          recommendation: 'Review and confirm classification manually',
        });
      }
    }

    // Check for orphan tables (no relationships)
    for (const table of tables) {
      const hasRelationship = relationships.some(
        r => r.from_table === table.name || r.to_table === table.name
      );
      if (!hasRelationship && tables.length > 1) {
        warnings.push({
          type: 'orphan_table',
          severity: 'warning',
          message: `Table "${table.name}" has no relationships to other tables`,
          tables_involved: [table.name],
          recommendation: 'Verify if this is a standalone lookup or if relationships are missing',
        });
      }
    }

    // Check for missing relationships (only dimension tables)
    const facts = [...classifications.entries()].filter(([_, c]) => c.classification === 'fact');
    if (facts.length === 0 && tables.length > 1) {
      warnings.push({
        type: 'missing_relationships',
        severity: 'warning',
        message: 'No fact tables identified - model may need review',
        tables_involved: tables.map(t => t.name),
        recommendation: 'Verify table classifications and add fact table indicators',
      });
    }

    // Check for circular relationships
    const circularPaths = this.findCircularPaths(tables, relationships);
    for (const path of circularPaths) {
      warnings.push({
        type: 'circular_relationship',
        severity: 'critical',
        message: `Circular relationship: ${path.join(' → ')} → ${path[0]}`,
        tables_involved: path,
        recommendation: 'Break the cycle by removing one relationship or introducing a link table',
      });
    }

    return warnings;
  }

  /**
   * Generate recommendations based on analysis
   */
  generateRecommendations(result: AnalysisResult): string[] {
    const recommendations: string[] = [];

    // Model type recommendations
    if (result.model_recommendation.alternatives.length > 0) {
      recommendations.push(
        `Consider ${result.model_recommendation.alternatives[0].model} as an alternative: ` +
        result.model_recommendation.alternatives[0].reason
      );
    }

    // Classification-based recommendations
    const facts = [...result.classifications.values()].filter(c => c.classification === 'fact');
    const dimensions = [...result.classifications.values()].filter(c => c.classification === 'dimension');

    if (facts.length === 0) {
      recommendations.push('No fact tables detected. Ensure transaction/event data is properly identified.');
    }

    if (dimensions.length === 0 && facts.length > 0) {
      recommendations.push('No dimension tables detected. Consider adding lookup tables for analysis context.');
    }

    // Warning-based recommendations
    const criticalWarnings = result.warnings.filter(w => w.severity === 'critical');
    if (criticalWarnings.length > 0) {
      recommendations.push('Address critical issues before proceeding with model generation.');
    }

    return recommendations;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Check if field is a measure (numeric with measure-like name)
   */
  private isMeasureField(field: EnrichedField): boolean {
    const isNumericType = NUMERIC_TYPES.some(t =>
      field.type.toLowerCase().includes(t)
    );
    const isMeasureName = MEASURE_PATTERNS.some(p => p.test(field.name));
    return isNumericType && isMeasureName;
  }

  /**
   * Check if field is descriptive (string with descriptive name)
   */
  private isDescriptiveField(field: EnrichedField): boolean {
    const isStringType = STRING_TYPES.some(t =>
      field.type.toLowerCase().includes(t)
    );
    const isDescriptiveName = DESCRIPTIVE_PATTERNS.some(p => p.test(field.name));
    return isStringType && isDescriptiveName;
  }

  /**
   * Check if table is a calendar/date dimension
   */
  private isCalendarTable(table: EnrichedTable): boolean {
    const fieldNamesLower = table.fields.map(f => f.name.toLowerCase());
    const matchCount = CALENDAR_FIELDS.filter(cf =>
      fieldNamesLower.some(fn => fn.includes(cf))
    ).length;
    return matchCount >= 3;
  }

  /**
   * Check if table name matches fact patterns
   */
  private matchesFactNaming(name: string): boolean {
    return FACT_NAME_PATTERNS.some(p => p.test(name));
  }

  /**
   * Check if table name matches dimension patterns
   */
  private matchesDimensionNaming(name: string): boolean {
    return DIMENSION_NAME_PATTERNS.some(p => p.test(name));
  }

  /**
   * Count foreign keys to other tables
   */
  private countForeignKeys(table: EnrichedTable, allTables: EnrichedTable[]): number {
    const fkPattern = /_id$/i;
    const fkFields = table.fields.filter(f => fkPattern.test(f.name));

    let count = 0;
    for (const fkField of fkFields) {
      const baseName = fkField.name.replace(/_id$/i, '').toLowerCase();
      const matchesOther = allTables.some(
        t => t.name !== table.name &&
             (t.name.toLowerCase().includes(baseName) ||
              baseName.includes(t.name.toLowerCase().replace(/s$/, '')))
      );
      if (matchesOther) count++;
    }
    return count;
  }

  /**
   * Detect if table is a bridge/link table
   */
  private detectBridgeTable(
    table: EnrichedTable,
    allTables: EnrichedTable[]
  ): { isBridge: boolean; reasoning: string[] } {
    const bridgePatterns = [
      /_items$/i, /_link$/i, /_map$/i, /_rel$/i,
      /_association$/i, /_junction$/i, /_xref$/i,
      /^rel_/i, /^link_/i, /^map_/i,
    ];

    const fkFields = table.fields.filter(f =>
      /_id$/i.test(f.name) || /_key$/i.test(f.name) || /_fk$/i.test(f.name)
    );

    const nonKeyFields = table.fields.filter(f =>
      !/_id$/i.test(f.name) && !/_key$/i.test(f.name) && !/_fk$/i.test(f.name)
    );

    const hasNamePattern = bridgePatterns.some(p => p.test(table.name));
    const hasTwoOrMoreFKs = fkFields.length >= 2;
    const fewAttributes = nonKeyFields.length <= 3;

    const reasoning: string[] = [];
    let score = 0;

    if (hasTwoOrMoreFKs) {
      score += 2;
      reasoning.push(`Contains ${fkFields.length} FK fields: ${fkFields.map(f => f.name).join(', ')}`);
    }
    if (fewAttributes) {
      score += 1;
      reasoning.push(`Only ${nonKeyFields.length} non-key attribute(s)`);
    }
    if (hasNamePattern) {
      score += 1;
      reasoning.push('Table name matches bridge/junction pattern');
    }

    return {
      isBridge: score >= 3,
      reasoning,
    };
  }

  /**
   * Check if multiple facts are similar (could be concatenated)
   */
  private areSimilarFacts(
    factNames: string[],
    classifications: Map<string, TableClassification>
  ): boolean {
    // Simple heuristic: check for similar naming patterns
    if (factNames.length < 2) return false;

    const normalized = factNames.map(n =>
      n.toLowerCase()
        .replace(/\d+/g, '')
        .replace(/_+/g, '_')
    );

    // Check for common prefixes
    const first = normalized[0];
    return normalized.slice(1).some(n => {
      const commonLength = this.commonPrefixLength(first, n);
      return commonLength > first.length * 0.5;
    });
  }

  /**
   * Get length of common prefix
   */
  private commonPrefixLength(a: string, b: string): number {
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return i;
  }

  /**
   * Get classification with highest score
   */
  private getHighestScore(scores: Record<TableClassification, number>): TableClassification {
    let maxClass: TableClassification = 'dimension';
    let maxScore = -1;

    for (const [cls, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        maxClass = cls as TableClassification;
      }
    }

    return maxClass;
  }

  /**
   * Find circular paths in relationships (DFS)
   */
  private findCircularPaths(
    tables: EnrichedTable[],
    relationships: EnrichedRelationship[]
  ): string[][] {
    const adjacency = new Map<string, string[]>();

    // Build bidirectional adjacency list
    for (const rel of relationships) {
      if (!adjacency.has(rel.from_table)) adjacency.set(rel.from_table, []);
      if (!adjacency.has(rel.to_table)) adjacency.set(rel.to_table, []);
      adjacency.get(rel.from_table)!.push(rel.to_table);
      adjacency.get(rel.to_table)!.push(rel.from_table);
    }

    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string, parent: string | null): void => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      for (const neighbor of adjacency.get(node) || []) {
        if (neighbor === parent) continue;

        if (!visited.has(neighbor)) {
          dfs(neighbor, node);
        } else if (recursionStack.has(neighbor)) {
          const cycleStart = path.indexOf(neighbor);
          if (cycleStart !== -1 && path.slice(cycleStart).length >= 3) {
            cycles.push([...path.slice(cycleStart)]);
          }
        }
      }

      path.pop();
      recursionStack.delete(node);
    };

    for (const table of tables) {
      if (!visited.has(table.name)) {
        dfs(table.name, null);
      }
    }

    return cycles;
  }
}

/**
 * Factory function to create an Analyzer
 * @param logger - Optional logger instance
 * @returns Analyzer instance
 */
export function createAnalyzer(logger?: Logger): Analyzer {
  return new Analyzer(logger);
}

export default Analyzer;
