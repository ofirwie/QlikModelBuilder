/**
 * @fileoverview Input Processor for Model Builder
 * @module model-builder/services/input-processor
 *
 * Merges Stage 1 JSON output with QVD sample data to create
 * an enriched model specification with cardinality, null percentages, and sample values.
 */

import {
  Stage1Input,
  Stage1Table,
  Stage1Field,
  QvdSampleData,
  QvdFieldSample,
  EnrichedModelSpec,
  EnrichedTable,
  EnrichedField,
  EnrichedRelationship,
  DateFieldInfo,
  RelationshipHint,
} from '../types.js';
import { Logger } from './logger.js';

/**
 * Validation error for input processing
 */
export class ValidationError extends Error {
  public field: string;
  public expected: string;
  public received: string;

  constructor(message: string);
  constructor(field: string, expected: string, received: string);
  constructor(fieldOrMessage: string, expected?: string, received?: string) {
    if (expected !== undefined && received !== undefined) {
      super(`Validation failed: ${fieldOrMessage} expected ${expected}, got ${received}`);
      this.field = fieldOrMessage;
      this.expected = expected;
      this.received = received;
    } else {
      super(fieldOrMessage);
      this.field = '';
      this.expected = '';
      this.received = '';
    }
    this.name = 'ValidationError';
  }
}

/**
 * Error for empty input scenarios
 */
export class EmptyInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmptyInputError';
  }
}

/** Key detection patterns - pre-compiled for performance */
const KEY_PATTERNS = [
  /^.*_?id$/i,           // CustomerID, customer_id
  /^.*_?key$/i,          // CustomerKey
  /^.*_?code$/i,         // ProductCode
  /^pk_/i,               // pk_customer
  /^fk_/i,               // fk_order
];

/** Date detection patterns - pre-compiled for performance */
const DATE_PATTERNS = [
  /date$/i,              // OrderDate
  /^date_/i,             // date_created
  /_at$/i,               // created_at
  /timestamp/i,          // timestamp
  /time$/i,              // order_time (if datetime)
];

/** Date types for detection */
const DATE_TYPES = ['date', 'datetime', 'timestamp'];

/**
 * Input Processor Implementation
 *
 * Merges Stage 1 JSON with QVD sample data to create enriched model specifications.
 */
export class InputProcessor {
  private logger?: Logger;

  /**
   * Create a new InputProcessor
   * @param logger - Optional logger instance
   */
  constructor(logger?: Logger) {
    this.logger = logger;
  }

  /**
   * Main processing method - merges Stage 1 JSON with QVD samples
   * @param stage1Json - Stage 1 parser output
   * @param qvdSamples - QVD sample data array
   * @returns Enriched model specification
   */
  process(stage1Json: Stage1Input, qvdSamples: QvdSampleData[]): EnrichedModelSpec {
    // Build lookup by table name (case-insensitive)
    const sampleMap = new Map<string, QvdSampleData>();
    for (const sample of qvdSamples) {
      sampleMap.set(sample.table_name.toLowerCase(), sample);
    }

    const enrichedTables: EnrichedTable[] = [];
    const dateFields: DateFieldInfo[] = [];

    for (const table of stage1Json.tables) {
      const sample = sampleMap.get(table.name.toLowerCase()) || null;
      const enriched = this.enrichTable(table, sample);
      enrichedTables.push(enriched);

      // Collect date fields
      for (const field of enriched.fields) {
        if (field.is_date_field) {
          dateFields.push({
            table_name: enriched.name,
            field_name: field.name,
            type: field.type,
            sample_values: field.sample_values.slice(0, 5),
          });
        }
      }

      if (!sample) {
        this.logger?.warn('input_processor', 'no_sample_data', { table: table.name });
      }
    }

    // Process relationships
    const relationships = this.processRelationships(
      stage1Json.relationship_hints || [],
      enrichedTables
    );

    this.logger?.info('input_processor', 'processing_complete', {
      tables: enrichedTables.length,
      relationships: relationships.length,
      date_fields: dateFields.length,
    });

    return {
      tables: enrichedTables,
      relationships,
      date_fields: dateFields,
      recommended_model_type: undefined,
      recommendation_confidence: 0,
    };
  }

  /**
   * Validate Stage 1 input structure
   * @param input - Unknown input to validate
   * @returns Validated Stage1Input
   * @throws ValidationError if validation fails
   */
  validateStage1Input(input: unknown): Stage1Input {
    if (!input || typeof input !== 'object') {
      throw new ValidationError('Stage1 input must be an object');
    }

    const obj = input as Record<string, unknown>;

    // Required fields
    if (!obj.version || typeof obj.version !== 'string') {
      throw new ValidationError('version', 'string', typeof obj.version);
    }

    if (!obj.source || typeof obj.source !== 'string') {
      throw new ValidationError('source', 'string', typeof obj.source);
    }

    if (!obj.parsed_at || typeof obj.parsed_at !== 'string') {
      throw new ValidationError('parsed_at', 'string (ISO date)', typeof obj.parsed_at);
    }

    if (!Array.isArray(obj.tables)) {
      throw new ValidationError('tables', 'array', typeof obj.tables);
    }

    if (obj.tables.length === 0) {
      throw new EmptyInputError('Stage1 input must contain at least one table');
    }

    // Validate each table
    for (let i = 0; i < obj.tables.length; i++) {
      this.validateTable(obj.tables[i], i);
    }

    // Validate relationship hints if present
    if (obj.relationship_hints !== undefined && !Array.isArray(obj.relationship_hints)) {
      throw new ValidationError('relationship_hints', 'array', typeof obj.relationship_hints);
    }

    return input as Stage1Input;
  }

  /**
   * Validate a single table structure
   * @param table - Table to validate
   * @param index - Table index for error messages
   */
  private validateTable(table: unknown, index: number): void {
    if (!table || typeof table !== 'object') {
      throw new ValidationError(`tables[${index}]`, 'object', typeof table);
    }

    const t = table as Record<string, unknown>;

    if (!t.name || typeof t.name !== 'string') {
      throw new ValidationError(`tables[${index}].name`, 'string', typeof t.name);
    }

    if (!t.source_name || typeof t.source_name !== 'string') {
      throw new ValidationError(`tables[${index}].source_name`, 'string', typeof t.source_name);
    }

    if (!Array.isArray(t.fields)) {
      throw new ValidationError(`tables[${index}].fields`, 'array', typeof t.fields);
    }

    if (t.fields.length === 0) {
      throw new ValidationError(`Table ${t.name} must have at least one field`);
    }

    // Validate each field
    for (let i = 0; i < t.fields.length; i++) {
      this.validateField(t.fields[i], `tables[${index}].fields[${i}]`);
    }
  }

  /**
   * Validate a single field structure
   * @param field - Field to validate
   * @param path - Path for error messages
   */
  private validateField(field: unknown, path: string): void {
    if (!field || typeof field !== 'object') {
      throw new ValidationError(path, 'object', typeof field);
    }

    const f = field as Record<string, unknown>;

    if (!f.name || typeof f.name !== 'string') {
      throw new ValidationError(`${path}.name`, 'string', typeof f.name);
    }

    if (!f.type || typeof f.type !== 'string') {
      throw new ValidationError(`${path}.type`, 'string', typeof f.type);
    }
  }

  /**
   * Validate QVD sample data array
   * @param samples - Unknown samples to validate
   * @returns Validated QvdSampleData array
   */
  validateQvdSamples(samples: unknown[]): QvdSampleData[] {
    if (!Array.isArray(samples)) {
      throw new ValidationError('QVD samples must be an array');
    }

    const validated: QvdSampleData[] = [];

    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      if (!sample || typeof sample !== 'object') {
        this.logger?.warn('input_processor', 'invalid_qvd_sample', { index: i });
        continue;
      }

      const s = sample as Record<string, unknown>;

      if (!s.table_name || typeof s.table_name !== 'string') {
        this.logger?.warn('input_processor', 'invalid_qvd_sample', {
          index: i,
          reason: 'missing table_name'
        });
        continue;
      }

      if (typeof s.row_count !== 'number') {
        this.logger?.warn('input_processor', 'invalid_qvd_sample', {
          index: i,
          reason: 'missing row_count'
        });
        continue;
      }

      if (!Array.isArray(s.fields)) {
        this.logger?.warn('input_processor', 'invalid_qvd_sample', {
          index: i,
          reason: 'missing fields array'
        });
        continue;
      }

      validated.push(sample as QvdSampleData);
    }

    return validated;
  }

  /**
   * Enrich a table with QVD sample data
   * @param table - Stage 1 table definition
   * @param sample - QVD sample data (may be null)
   * @returns Enriched table
   */
  enrichTable(table: Stage1Table, sample: QvdSampleData | null): EnrichedTable {
    // Build field sample lookup
    const fieldSampleMap = new Map<string, QvdFieldSample>();
    if (sample) {
      for (const fieldSample of sample.fields) {
        fieldSampleMap.set(fieldSample.name.toLowerCase(), fieldSample);
      }
    }

    const enrichedFields: EnrichedField[] = [];

    for (const field of table.fields) {
      const sampleField = fieldSampleMap.get(field.name.toLowerCase()) || null;
      const enrichedField = this.enrichField(field, sampleField, sample?.row_count || 0);
      enrichedFields.push(enrichedField);
    }

    // Check for QVD fields not in Stage 1 spec
    if (sample) {
      for (const fieldSample of sample.fields) {
        const exists = table.fields.some(
          f => f.name.toLowerCase() === fieldSample.name.toLowerCase()
        );
        if (!exists) {
          this.logger?.warn('input_processor', 'qvd_field_not_in_spec', {
            table: table.name,
            field: fieldSample.name,
          });
        }
      }
    }

    return {
      name: table.name,
      source_name: table.source_name,
      row_count: sample?.row_count || 0,
      fields: enrichedFields,
    };
  }

  /**
   * Enrich a field with QVD sample data
   * @param field - Stage 1 field definition
   * @param sampleField - QVD field sample (may be null)
   * @param rowCount - Table row count for cardinality ratio
   * @returns Enriched field
   */
  enrichField(
    field: Stage1Field,
    sampleField: QvdFieldSample | null,
    rowCount: number
  ): EnrichedField {
    // Log type conflicts
    if (sampleField && field.type !== sampleField.type) {
      this.logger?.debug('input_processor', 'type_conflict', {
        field: field.name,
        stage1_type: field.type,
        qvd_type: sampleField.type,
      });
    }

    const enriched: EnrichedField = {
      name: field.name,
      type: sampleField?.type || field.type,
      cardinality: sampleField?.cardinality || 0,
      null_percent: sampleField?.null_percent || 0,
      is_key_candidate: false,
      is_date_field: false,
      sample_values: sampleField?.sample_values?.map(v => String(v)) || [],
    };

    // Detect key candidate
    enriched.is_key_candidate = this.detectKeyCandidate(enriched, rowCount);

    // Detect date field
    enriched.is_date_field = this.detectDateField(enriched);

    return enriched;
  }

  /**
   * Detect if a field is a key candidate
   * @param field - Enriched field
   * @param rowCount - Table row count
   * @returns True if field is likely a key
   */
  detectKeyCandidate(field: EnrichedField, rowCount: number): boolean {
    const nameLower = field.name.toLowerCase();

    // Name-based detection
    const isKeyName = KEY_PATTERNS.some(p => p.test(nameLower));

    // Low null percent for keys
    const lowNulls = field.null_percent < 1;

    // Cardinality-based detection (high uniqueness suggests key)
    // If cardinality is close to row count, likely a key
    const highUniqueness = rowCount > 0 && field.cardinality > 0 &&
      (field.cardinality / rowCount) > 0.9;

    // Key if name pattern matches and low nulls
    // OR if high uniqueness and low nulls
    return (isKeyName && lowNulls) || (highUniqueness && lowNulls);
  }

  /**
   * Detect if a field is a date/datetime field
   * @param field - Enriched field
   * @returns True if field is likely a date field
   */
  detectDateField(field: EnrichedField): boolean {
    const nameLower = field.name.toLowerCase();

    // Name-based detection
    const isDateName = DATE_PATTERNS.some(p => p.test(nameLower));

    // Type-based detection
    const isDateType = DATE_TYPES.includes(field.type.toLowerCase());

    return isDateName || isDateType;
  }

  /**
   * Process relationship hints and enrich with cardinality
   * @param hints - Relationship hints from Stage 1
   * @param tables - Enriched tables
   * @returns Enriched relationships
   */
  processRelationships(
    hints: RelationshipHint[],
    tables: EnrichedTable[]
  ): EnrichedRelationship[] {
    const tableMap = new Map(tables.map(t => [t.name.toLowerCase(), t]));
    const relationships: EnrichedRelationship[] = [];

    for (const hint of hints) {
      const [fromTable, fromField] = hint.from.split('.');
      const [toTable, toField] = hint.to.split('.');

      const fromTableData = tableMap.get(fromTable.toLowerCase());
      const toTableData = tableMap.get(toTable.toLowerCase());

      const fromFieldData = fromTableData?.fields.find(
        f => f.name.toLowerCase() === fromField.toLowerCase()
      );
      const toFieldData = toTableData?.fields.find(
        f => f.name.toLowerCase() === toField.toLowerCase()
      );

      const validated = !!(fromTableData && toTableData && fromFieldData && toFieldData);

      if (!validated) {
        this.logger?.warn('input_processor', 'invalid_relationship', {
          from: hint.from,
          to: hint.to,
          reason: !fromTableData ? 'from_table_missing' :
                  !toTableData ? 'to_table_missing' :
                  !fromFieldData ? 'from_field_missing' : 'to_field_missing',
        });
      }

      relationships.push({
        from_table: fromTable,
        from_field: fromField,
        to_table: toTable,
        to_field: toField,
        type: hint.type,
        from_cardinality: fromFieldData?.cardinality || 0,
        to_cardinality: toFieldData?.cardinality || 0,
        validated,
      });
    }

    return relationships;
  }

  /**
   * Infer relationships from field naming patterns
   * @param tables - Enriched tables
   * @returns Inferred relationship hints
   */
  inferRelationships(tables: EnrichedTable[]): RelationshipHint[] {
    const hints: RelationshipHint[] = [];
    const tableMap = new Map(tables.map(t => [t.name.toLowerCase(), t]));

    // Look for FK patterns (e.g., customer_id in Orders referencing Customers.id)
    for (const table of tables) {
      for (const field of table.fields) {
        if (!field.is_key_candidate) continue;

        const nameLower = field.name.toLowerCase();

        // Pattern: <table_name>_id or <table_name>id
        const match = nameLower.match(/^(.+?)_?id$/);
        if (!match) continue;

        const potentialTable = match[1];
        const targetTable = tableMap.get(potentialTable) ||
                           tableMap.get(potentialTable + 's') ||
                           tableMap.get(potentialTable + 'es');

        if (targetTable && targetTable.name !== table.name) {
          // Find matching PK in target table
          const targetPk = targetTable.fields.find(
            f => f.is_key_candidate &&
                 (f.name.toLowerCase() === 'id' ||
                  f.name.toLowerCase() === `${potentialTable}_id` ||
                  f.name.toLowerCase() === `${potentialTable}id`)
          );

          if (targetPk) {
            hints.push({
              from: `${table.name}.${field.name}`,
              to: `${targetTable.name}.${targetPk.name}`,
              type: 'many-to-one',
            });
          }
        }
      }
    }

    return hints;
  }

  /**
   * Extract all date fields from enriched tables
   * @param tables - Enriched tables
   * @returns Array of date field information
   */
  extractDateFields(tables: EnrichedTable[]): DateFieldInfo[] {
    const dateFields: DateFieldInfo[] = [];

    for (const table of tables) {
      for (const field of table.fields) {
        if (field.is_date_field) {
          dateFields.push({
            table_name: table.name,
            field_name: field.name,
            type: field.type,
            sample_values: field.sample_values.slice(0, 5),
          });
        }
      }
    }

    return dateFields;
  }
}

/**
 * Factory function to create an InputProcessor
 * @param logger - Optional logger instance
 * @returns InputProcessor instance
 */
export function createInputProcessor(logger?: Logger): InputProcessor {
  return new InputProcessor(logger);
}

export default InputProcessor;
