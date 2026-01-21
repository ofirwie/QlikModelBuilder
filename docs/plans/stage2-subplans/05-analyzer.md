# Sub-Plan 05: Analyzer

> **Part of:** Data Model Builder (Stage 2) Implementation
> **Dependencies:** Sub-Plan 01 (Types), Sub-Plan 04 (Input Processor)
> **Output:** `src/model-builder/services/analyzer.ts`

---

## Goal

Analyze enriched model spec to classify tables as Fact/Dimension and detect the optimal model type (Star, Snowflake, Link Table, Concatenated).

## Context

From design document (section 3.3):
- Classify tables based on cardinality, field patterns, relationships
- Detect model type based on relationship patterns
- Provide recommendations with confidence scores and alternatives

## Files to Create

| File | Purpose |
|------|---------|
| `src/model-builder/services/analyzer.ts` | Analysis engine implementation |
| `src/__tests__/model-builder/analyzer.test.ts` | Unit tests |

## Key Interfaces

```typescript
interface Analyzer {
  // Main analysis
  analyze(spec: EnrichedModelSpec): AnalysisResult;

  // Table classification
  classifyTable(table: EnrichedTable, allTables: EnrichedTable[]): TableClassificationResult;

  // Model type detection
  detectModelType(
    classifications: Map<string, TableClassification>,
    relationships: EnrichedRelationship[]
  ): ModelTypeRecommendation;

  // Recommendations
  generateRecommendations(result: AnalysisResult): string[];
}

interface AnalysisResult {
  classifications: Map<string, TableClassificationResult>;
  model_recommendation: ModelTypeRecommendation;
  warnings: AnalysisWarning[];
  recommendations: string[];
}

interface TableClassificationResult {
  table_name: string;
  classification: TableClassification;
  confidence: number;  // 0.0 - 1.0
  reasoning: string[];
}

interface ModelTypeRecommendation {
  recommended_model: ModelType;
  confidence: number;
  alternatives: ModelTypeAlternative[];
  reasoning: string;
}

interface ModelTypeAlternative {
  model: ModelType;
  reason: string;
  pros: string[];
  cons: string[];
}
```

## Implementation Steps

### Step 1: Table Classification Rules

```typescript
classifyTable(table: EnrichedTable, allTables: EnrichedTable[]): TableClassificationResult {
  const scores = {
    fact: 0,
    dimension: 0,
    link: 0,
    calendar: 0,
  };
  const reasoning: string[] = [];

  // Rule 1: Row count (high = fact)
  if (table.row_count > 10000) {
    scores.fact += 2;
    reasoning.push(`High row count (${table.row_count}) suggests transactional data`);
  } else if (table.row_count < 1000) {
    scores.dimension += 2;
    reasoning.push(`Low row count (${table.row_count}) suggests reference data`);
  }

  // Rule 2: Numeric measure fields
  const measureFields = table.fields.filter(f =>
    this.isMeasureField(f.name, f.type)
  );
  if (measureFields.length >= 2) {
    scores.fact += 3;
    reasoning.push(`Contains ${measureFields.length} measure fields (${measureFields.map(f => f.name).join(', ')})`);
  }

  // Rule 3: Multiple FK references to other tables
  const fkCount = this.countForeignKeys(table, allTables);
  if (fkCount >= 2) {
    scores.fact += 2;
    reasoning.push(`References ${fkCount} other tables via foreign keys`);
  }

  // Rule 4: Date fields (facts have transaction dates)
  const dateFields = table.fields.filter(f => f.is_date_field);
  if (dateFields.length >= 1 && table.row_count > 5000) {
    scores.fact += 1;
    reasoning.push(`Contains date field(s) with high row count`);
  }

  // Rule 5: Descriptive string fields (dimensions)
  const descriptiveFields = table.fields.filter(f =>
    this.isDescriptiveField(f.name, f.type)
  );
  if (descriptiveFields.length >= 3) {
    scores.dimension += 2;
    reasoning.push(`Contains ${descriptiveFields.length} descriptive fields`);
  }

  // Rule 6: Calendar detection
  if (this.isCalendarTable(table)) {
    scores.calendar += 10;
    reasoning.push('Table structure matches calendar pattern');
  }

  // Determine classification
  const classification = this.getHighestScore(scores);
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = totalScore > 0 ? scores[classification] / totalScore : 0.5;

  return {
    table_name: table.name,
    classification,
    confidence: Math.round(confidence * 100) / 100,
    reasoning,
  };
}
```

### Step 2: Bridge/Junction Table Detection

```typescript
/**
 * Detects bridge/junction tables used for N:M (many-to-many) relationships.
 * These tables typically have:
 * - Two or more foreign keys to other tables
 * - Few or no additional attributes beyond keys
 * - Name patterns like 'Order_Items', 'Product_Category', etc.
 */
private isBridgeTable(table: EnrichedTable, allTables: EnrichedTable[]): BridgeTableResult {
  const bridgePatterns = [
    /_items$/i, /_link$/i, /_map$/i, /_rel$/i,
    /_association$/i, /_junction$/i, /_xref$/i,
    /^rel_/i, /^link_/i, /^map_/i,
  ];

  // Count foreign key fields (fields ending with _id, _key, _fk)
  const fkFields = table.fields.filter(f =>
    /_id$/i.test(f.name) || /_key$/i.test(f.name) || /_fk$/i.test(f.name)
  );

  // Count non-key fields (attributes beyond the FKs)
  const nonKeyFields = table.fields.filter(f =>
    !/_id$/i.test(f.name) && !/_key$/i.test(f.name) && !/_fk$/i.test(f.name) &&
    !f.is_primary_key
  );

  // Bridge table indicators
  const hasNamePattern = bridgePatterns.some(p => p.test(table.name));
  const hasTwoOrMoreFKs = fkFields.length >= 2;
  const fewAttributes = nonKeyFields.length <= 3; // Bridge tables have minimal attributes
  const relatedTables = this.findRelatedTables(table, allTables);

  // Calculate confidence
  let confidence = 0;
  const reasoning: string[] = [];

  if (hasTwoOrMoreFKs) {
    confidence += 0.4;
    reasoning.push(`Contains ${fkFields.length} foreign key fields: ${fkFields.map(f => f.name).join(', ')}`);
  }

  if (fewAttributes) {
    confidence += 0.3;
    reasoning.push(`Only ${nonKeyFields.length} non-key attribute(s)`);
  }

  if (hasNamePattern) {
    confidence += 0.2;
    reasoning.push(`Table name matches bridge/junction pattern`);
  }

  if (relatedTables.length >= 2) {
    confidence += 0.1;
    reasoning.push(`Links ${relatedTables.length} tables: ${relatedTables.join(', ')}`);
  }

  return {
    is_bridge_table: confidence >= 0.6,
    confidence,
    related_tables: relatedTables,
    reasoning,
  };
}

private findRelatedTables(table: EnrichedTable, allTables: EnrichedTable[]): string[] {
  const related: string[] = [];
  const fkFields = table.fields.filter(f => /_id$/i.test(f.name));

  for (const fkField of fkFields) {
    // Extract potential table name from FK field (e.g., 'customer_id' -> 'customers')
    const baseName = fkField.name.replace(/_id$/i, '');
    const matchedTable = allTables.find(t =>
      t.name.toLowerCase().includes(baseName.toLowerCase()) ||
      baseName.toLowerCase().includes(t.name.toLowerCase().replace(/s$/, ''))
    );
    if (matchedTable && matchedTable.name !== table.name) {
      related.push(matchedTable.name);
    }
  }

  return [...new Set(related)];
}
```

### Step 3: SCD (Slowly Changing Dimension) Classification

```typescript
/**
 * Classifies dimension tables by SCD type based on field patterns:
 * - Type 1: Overwrite (no history tracking)
 * - Type 2: Historical (effective dates, current flags)
 * - Type 3: Limited history (previous value columns)
 */
private classifySCDType(table: EnrichedTable): SCDClassification {
  // SCD Type 2 indicators
  const type2Patterns = {
    effectiveDate: /effective_date|valid_from|start_date|begin_date/i,
    expirationDate: /expiration_date|valid_to|end_date|expire_date/i,
    currentFlag: /is_current|current_flag|active_flag|is_active/i,
    versionNumber: /version|revision|seq_num/i,
  };

  // SCD Type 3 indicators
  const type3Patterns = {
    previousValue: /prev_|previous_|old_|prior_/i,
    originalValue: /original_|initial_|first_/i,
  };

  const fieldNames = table.fields.map(f => f.name);

  // Check for Type 2 patterns
  const hasEffectiveDate = fieldNames.some(f => type2Patterns.effectiveDate.test(f));
  const hasExpirationDate = fieldNames.some(f => type2Patterns.expirationDate.test(f));
  const hasCurrentFlag = fieldNames.some(f => type2Patterns.currentFlag.test(f));
  const hasVersionNumber = fieldNames.some(f => type2Patterns.versionNumber.test(f));

  // Check for Type 3 patterns
  const previousValueFields = fieldNames.filter(f => type3Patterns.previousValue.test(f));
  const originalValueFields = fieldNames.filter(f => type3Patterns.originalValue.test(f));

  // Determine SCD type
  let scd_type: 1 | 2 | 3 = 1;
  let confidence = 0.7;
  const reasoning: string[] = [];

  // Type 2: Has effective/expiration dates or current flag
  if ((hasEffectiveDate && hasExpirationDate) || hasCurrentFlag) {
    scd_type = 2;
    confidence = 0.9;
    if (hasEffectiveDate) reasoning.push('Has effective date field');
    if (hasExpirationDate) reasoning.push('Has expiration date field');
    if (hasCurrentFlag) reasoning.push('Has current/active flag');
    if (hasVersionNumber) reasoning.push('Has version tracking');
  }
  // Type 3: Has previous/original value columns
  else if (previousValueFields.length > 0 || originalValueFields.length > 0) {
    scd_type = 3;
    confidence = 0.85;
    if (previousValueFields.length > 0) {
      reasoning.push(`Has ${previousValueFields.length} previous value field(s): ${previousValueFields.join(', ')}`);
    }
    if (originalValueFields.length > 0) {
      reasoning.push(`Has ${originalValueFields.length} original value field(s): ${originalValueFields.join(', ')}`);
    }
  }
  // Default: Type 1 (no history tracking)
  else {
    scd_type = 1;
    reasoning.push('No history tracking fields found - treating as Type 1 (overwrite)');
  }

  return {
    scd_type,
    confidence,
    reasoning,
    history_fields: {
      effective_date: fieldNames.find(f => type2Patterns.effectiveDate.test(f)),
      expiration_date: fieldNames.find(f => type2Patterns.expirationDate.test(f)),
      current_flag: fieldNames.find(f => type2Patterns.currentFlag.test(f)),
      previous_value_fields: previousValueFields,
    },
  };
}
```

### Step 4: Degenerate Dimension Detection

```typescript
/**
 * Detects degenerate dimensions - dimension attributes stored directly in fact tables.
 * Common examples: Order Number, Invoice Number, Transaction ID
 * These are dimension attributes without a separate dimension table.
 */
private detectDegenerateDimensions(
  table: EnrichedTable,
  classification: TableClassification
): DegenerateDimensionResult {
  if (classification !== 'fact') {
    return { has_degenerate_dimensions: false, fields: [] };
  }

  // Patterns for degenerate dimension fields
  const degeneratePatterns = [
    { pattern: /order_number|order_no|order_num/i, type: 'order_identifier' },
    { pattern: /invoice_number|invoice_no|invoice_num/i, type: 'invoice_identifier' },
    { pattern: /transaction_id|trans_id|txn_id/i, type: 'transaction_identifier' },
    { pattern: /receipt_number|receipt_no/i, type: 'receipt_identifier' },
    { pattern: /confirmation_number|confirm_no/i, type: 'confirmation_identifier' },
    { pattern: /tracking_number|tracking_no/i, type: 'tracking_identifier' },
    { pattern: /batch_number|batch_no|lot_number/i, type: 'batch_identifier' },
    { pattern: /reference_number|ref_no|ref_num/i, type: 'reference_identifier' },
  ];

  // Exclude actual foreign keys and primary keys
  const candidateFields = table.fields.filter(f =>
    !f.is_primary_key &&
    !/_fk$/i.test(f.name) &&
    f.type.toLowerCase() !== 'date' &&
    f.type.toLowerCase() !== 'datetime'
  );

  const degenerateFields: DegenerateDimensionField[] = [];

  for (const field of candidateFields) {
    for (const { pattern, type } of degeneratePatterns) {
      if (pattern.test(field.name)) {
        degenerateFields.push({
          field_name: field.name,
          dimension_type: type,
          recommendation: `Consider creating a separate ${type} dimension if additional attributes needed`,
        });
        break;
      }
    }

    // Also check for string fields with high cardinality in fact tables
    if (
      field.type.toLowerCase().includes('string') &&
      field.distinct_count &&
      field.distinct_count > 100 &&
      !degenerateFields.some(d => d.field_name === field.name)
    ) {
      // Check if it looks like a business identifier
      if (/_id$/i.test(field.name) || /number|num|no$/i.test(field.name)) {
        degenerateFields.push({
          field_name: field.name,
          dimension_type: 'business_identifier',
          recommendation: 'High-cardinality string identifier - consider if dimension table needed',
        });
      }
    }
  }

  return {
    has_degenerate_dimensions: degenerateFields.length > 0,
    fields: degenerateFields,
    total_count: degenerateFields.length,
  };
}
```

### Step 5: Constellation/Galaxy Schema Detection

```typescript
/**
 * Detects constellation (galaxy) schema patterns where multiple fact tables
 * share common dimension tables.
 * Example: Sales Fact and Inventory Fact both linking to Product and Date dimensions
 */
private detectConstellationSchema(
  classifications: Map<string, TableClassification>,
  relationships: EnrichedRelationship[]
): ConstellationSchemaResult {
  const facts = [...classifications.entries()]
    .filter(([_, c]) => c === 'fact')
    .map(([name]) => name);

  const dimensions = [...classifications.entries()]
    .filter(([_, c]) => c === 'dimension')
    .map(([name]) => name);

  if (facts.length < 2) {
    return {
      is_constellation: false,
      reasoning: 'Single fact table - standard star schema',
    };
  }

  // Find shared dimensions (dimensions connected to multiple facts)
  const dimensionUsage = new Map<string, string[]>();

  for (const dim of dimensions) {
    const connectedFacts = relationships
      .filter(r =>
        (r.from_table === dim && facts.includes(r.to_table)) ||
        (r.to_table === dim && facts.includes(r.from_table))
      )
      .map(r => r.from_table === dim ? r.to_table : r.from_table);

    if (connectedFacts.length > 0) {
      dimensionUsage.set(dim, [...new Set(connectedFacts)]);
    }
  }

  // Shared dimensions are those connected to 2+ facts
  const sharedDimensions = [...dimensionUsage.entries()]
    .filter(([_, connectedFacts]) => connectedFacts.length >= 2)
    .map(([dim, connectedFacts]) => ({
      dimension: dim,
      shared_by_facts: connectedFacts,
    }));

  // Exclusive dimensions (connected to only one fact)
  const exclusiveDimensions = [...dimensionUsage.entries()]
    .filter(([_, connectedFacts]) => connectedFacts.length === 1)
    .map(([dim, connectedFacts]) => ({
      dimension: dim,
      exclusive_to: connectedFacts[0],
    }));

  const isConstellation = sharedDimensions.length > 0;

  return {
    is_constellation: isConstellation,
    fact_tables: facts,
    shared_dimensions: sharedDimensions,
    exclusive_dimensions: exclusiveDimensions,
    reasoning: isConstellation
      ? `${facts.length} fact tables share ${sharedDimensions.length} dimension(s): ${sharedDimensions.map(s => s.dimension).join(', ')}`
      : `${facts.length} fact tables with no shared dimensions`,
    recommendations: isConstellation ? [
      'Consider conformed dimension naming for shared dimensions',
      'Ensure consistent granularity across fact tables',
      'Document fact table relationships clearly',
      sharedDimensions.length > 3
        ? 'Multiple shared dimensions - consider a central dimension bus'
        : null,
    ].filter(Boolean) as string[] : [],
  };
}
```

### Step 6: Modeling Issue Detection

```typescript
/**
 * Detects common data modeling issues that can cause problems in Qlik:
 * - Circular relationships (loops in the data model)
 * - Fan traps (one-to-many to one-to-many creating multiplication)
 * - Chasm traps (many-to-one to one-to-many creating incomplete joins)
 */
private detectModelingIssues(
  tables: EnrichedTable[],
  relationships: EnrichedRelationship[]
): ModelingIssuesResult {
  const issues: ModelingIssue[] = [];

  // 1. Detect Circular Relationships
  const circularPaths = this.findCircularPaths(tables, relationships);
  for (const path of circularPaths) {
    issues.push({
      type: 'circular_relationship',
      severity: 'critical',
      tables_involved: path,
      description: `Circular relationship detected: ${path.join(' → ')} → ${path[0]}`,
      impact: 'Qlik will create synthetic keys or fail to associate tables correctly',
      recommendation: 'Break the cycle by removing one relationship or introducing a link table',
      fix_strategies: [
        'Remove the weakest relationship in the cycle',
        'Create a bridge/link table to handle the N:M relationship',
        'Denormalize one of the dimension tables',
      ],
    });
  }

  // 2. Detect Fan Traps
  const fanTraps = this.findFanTraps(tables, relationships);
  for (const trap of fanTraps) {
    issues.push({
      type: 'fan_trap',
      severity: 'warning',
      tables_involved: [trap.center, ...trap.branches],
      description: `Fan trap: ${trap.center} has 1:M relationships to both ${trap.branches.join(' and ')}`,
      impact: 'Aggregations may produce incorrect results due to row multiplication',
      recommendation: 'Use Link Table or ensure proper aggregation scoping',
      fix_strategies: [
        `Create a Link Table connecting ${trap.branches.join(' and ')}`,
        'Use Set Analysis with proper dimension scoping',
        'Consider denormalizing to avoid the fan',
      ],
    });
  }

  // 3. Detect Chasm Traps
  const chasmTraps = this.findChasmTraps(tables, relationships);
  for (const trap of chasmTraps) {
    issues.push({
      type: 'chasm_trap',
      severity: 'warning',
      tables_involved: [trap.left, trap.center, trap.right],
      description: `Chasm trap: ${trap.left} ← ${trap.center} → ${trap.right} (M:1:M pattern)`,
      impact: 'Queries may return incomplete results due to missing associations',
      recommendation: 'Use Link Table or restructure the model',
      fix_strategies: [
        'Create a Link Table at the intersection point',
        'Materialize a flattened version of the data',
        'Use QVD concatenation to resolve the chasm',
      ],
    });
  }

  return {
    has_issues: issues.length > 0,
    issues,
    summary: {
      total_issues: issues.length,
      critical_count: issues.filter(i => i.severity === 'critical').length,
      warning_count: issues.filter(i => i.severity === 'warning').length,
      circular_count: issues.filter(i => i.type === 'circular_relationship').length,
      fan_trap_count: issues.filter(i => i.type === 'fan_trap').length,
      chasm_trap_count: issues.filter(i => i.type === 'chasm_trap').length,
    },
  };
}

/**
 * Uses DFS to find circular paths in the relationship graph
 */
private findCircularPaths(
  tables: EnrichedTable[],
  relationships: EnrichedRelationship[]
): string[][] {
  const adjacency = new Map<string, string[]>();

  // Build adjacency list (bidirectional for relationship detection)
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
      if (neighbor === parent) continue; // Skip immediate parent

      if (!visited.has(neighbor)) {
        dfs(neighbor, node);
      } else if (recursionStack.has(neighbor)) {
        // Found a cycle
        const cycleStart = path.indexOf(neighbor);
        if (cycleStart !== -1) {
          cycles.push(path.slice(cycleStart));
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

/**
 * Detects fan traps: Table A with 1:M to Table B and 1:M to Table C
 */
private findFanTraps(
  tables: EnrichedTable[],
  relationships: EnrichedRelationship[]
): Array<{ center: string; branches: string[] }> {
  const traps: Array<{ center: string; branches: string[] }> = [];

  for (const table of tables) {
    // Find all 1:M relationships where this table is the "1" side
    const oneToManyRelations = relationships.filter(r =>
      r.from_table === table.name && r.cardinality === '1:M'
    );

    if (oneToManyRelations.length >= 2) {
      traps.push({
        center: table.name,
        branches: oneToManyRelations.map(r => r.to_table),
      });
    }
  }

  return traps;
}

/**
 * Detects chasm traps: Table A (M:1) Table B (1:M) Table C
 */
private findChasmTraps(
  tables: EnrichedTable[],
  relationships: EnrichedRelationship[]
): Array<{ left: string; center: string; right: string }> {
  const traps: Array<{ left: string; center: string; right: string }> = [];

  for (const table of tables) {
    // Find M:1 relationships pointing TO this table
    const manyToOneIncoming = relationships.filter(r =>
      r.to_table === table.name && r.cardinality === 'M:1'
    );

    // Find 1:M relationships FROM this table
    const oneToManyOutgoing = relationships.filter(r =>
      r.from_table === table.name && r.cardinality === '1:M'
    );

    // If table has both incoming M:1 and outgoing 1:M, it's a potential chasm
    if (manyToOneIncoming.length > 0 && oneToManyOutgoing.length > 0) {
      for (const incoming of manyToOneIncoming) {
        for (const outgoing of oneToManyOutgoing) {
          traps.push({
            left: incoming.from_table,
            center: table.name,
            right: outgoing.to_table,
          });
        }
      }
    }
  }

  return traps;
}
```

### Step 7: Helper Detection Methods

```typescript
private isMeasureField(name: string, type: string): boolean {
  const measurePatterns = [
    /amount/i, /total/i, /sum/i, /count/i,
    /quantity/i, /qty/i, /price/i, /cost/i,
    /value/i, /revenue/i, /profit/i, /margin/i,
  ];
  const isNumericType = ['integer', 'decimal', 'number', 'float', 'double'].includes(type.toLowerCase());
  const isMeasureName = measurePatterns.some(p => p.test(name));

  return isNumericType && isMeasureName;
}

private isDescriptiveField(name: string, type: string): boolean {
  const descriptivePatterns = [
    /name$/i, /description/i, /desc$/i,
    /category/i, /type$/i, /status/i,
    /label/i, /title/i, /address/i,
  ];
  const isStringType = ['string', 'varchar', 'text', 'char'].includes(type.toLowerCase());

  return isStringType && descriptivePatterns.some(p => p.test(name));
}

private isCalendarTable(table: EnrichedTable): boolean {
  const calendarFields = ['year', 'month', 'day', 'quarter', 'week'];
  const tableFieldsLower = table.fields.map(f => f.name.toLowerCase());

  const matchCount = calendarFields.filter(cf =>
    tableFieldsLower.some(tf => tf.includes(cf))
  ).length;

  return matchCount >= 3;
}
```

---

## Classification Validation & Confidence

This section defines robust validation rules to ensure accurate table classification. Classifications should not rely on single criteria but use multi-criteria validation with confidence scoring.

### 1. Multi-Criteria Validation

**Don't rely on single criteria.** Each table type requires multiple indicators to achieve high-confidence classification.

#### Fact Table Validation

A table is classified as **Fact** when it meets **3 or more** of these criteria:

```typescript
interface FactTableCriteria {
  high_row_count: boolean;        // Row count > 10,000
  has_numeric_measures: boolean;  // 2+ numeric measure fields (amount, qty, price, etc.)
  has_fk_relationships: boolean;  // 2+ foreign key relationships to other tables
  transaction_naming: boolean;    // Name matches patterns: orders, sales, transactions, events, etc.
  has_date_field: boolean;        // Contains transaction/event date field
}

/**
 * Validates if a table qualifies as a Fact table using multi-criteria approach.
 * Requires 3+ criteria to be met for confident classification.
 */
private validateFactTable(table: EnrichedTable, allTables: EnrichedTable[]): FactValidationResult {
  const criteria: FactTableCriteria = {
    high_row_count: table.row_count > 10000,
    has_numeric_measures: this.countMeasureFields(table) >= 2,
    has_fk_relationships: this.countForeignKeys(table, allTables) >= 2,
    transaction_naming: this.matchesFactNamingPattern(table.name),
    has_date_field: table.fields.some(f => f.is_date_field),
  };

  const criteriaCount = Object.values(criteria).filter(Boolean).length;
  const reasoning: string[] = [];

  if (criteria.high_row_count) {
    reasoning.push(`High row count (${table.row_count.toLocaleString()} rows)`);
  }
  if (criteria.has_numeric_measures) {
    const measures = this.getMeasureFields(table);
    reasoning.push(`Contains ${measures.length} measure fields: ${measures.map(f => f.name).join(', ')}`);
  }
  if (criteria.has_fk_relationships) {
    const fkCount = this.countForeignKeys(table, allTables);
    reasoning.push(`Has ${fkCount} foreign key relationships`);
  }
  if (criteria.transaction_naming) {
    reasoning.push(`Table name "${table.name}" matches transactional pattern`);
  }
  if (criteria.has_date_field) {
    reasoning.push('Contains transaction/event date field');
  }

  return {
    is_valid: criteriaCount >= 3,
    criteria_met: criteriaCount,
    criteria_required: 3,
    criteria,
    reasoning,
    confidence: this.calculateConfidence(criteriaCount, 5, 3),
  };
}

private matchesFactNamingPattern(name: string): boolean {
  const factPatterns = [
    /orders?$/i, /sales$/i, /transactions?$/i, /events?$/i,
    /payments?$/i, /invoices?$/i, /shipments?$/i, /bookings?$/i,
    /clicks?$/i, /logs?$/i, /activities?$/i, /movements?$/i,
    /_fact$/i, /^fact_/i, /^fct_/i,
  ];
  return factPatterns.some(p => p.test(name));
}
```

#### Dimension Table Validation

A table is classified as **Dimension** when it meets **2 or more** of these criteria:

```typescript
interface DimensionTableCriteria {
  low_cardinality: boolean;       // Row count significantly lower than related facts
  has_descriptive_fields: boolean; // 3+ descriptive string fields (name, description, etc.)
  used_as_lookup: boolean;        // Referenced by other tables via FK
  reference_naming: boolean;      // Name matches patterns: customers, products, categories, etc.
  has_business_key: boolean;      // Contains a business/natural key field
}

/**
 * Validates if a table qualifies as a Dimension table.
 * Requires 2+ criteria to be met for confident classification.
 */
private validateDimensionTable(
  table: EnrichedTable,
  allTables: EnrichedTable[],
  relationships: EnrichedRelationship[]
): DimensionValidationResult {
  // Calculate cardinality ratio against potential fact tables
  const factTables = allTables.filter(t => t.row_count > 10000);
  const avgFactRowCount = factTables.length > 0
    ? factTables.reduce((sum, t) => sum + t.row_count, 0) / factTables.length
    : 50000;

  const criteria: DimensionTableCriteria = {
    low_cardinality: table.row_count < avgFactRowCount * 0.1, // < 10% of avg fact size
    has_descriptive_fields: this.countDescriptiveFields(table) >= 3,
    used_as_lookup: this.isReferencedByOthers(table.name, relationships),
    reference_naming: this.matchesDimensionNamingPattern(table.name),
    has_business_key: this.hasBusinessKey(table),
  };

  const criteriaCount = Object.values(criteria).filter(Boolean).length;
  const reasoning: string[] = [];

  if (criteria.low_cardinality) {
    reasoning.push(`Low cardinality (${table.row_count.toLocaleString()} rows vs avg fact ${avgFactRowCount.toLocaleString()})`);
  }
  if (criteria.has_descriptive_fields) {
    reasoning.push(`Contains ${this.countDescriptiveFields(table)} descriptive fields`);
  }
  if (criteria.used_as_lookup) {
    reasoning.push('Referenced by other tables as lookup');
  }
  if (criteria.reference_naming) {
    reasoning.push(`Table name "${table.name}" matches dimension pattern`);
  }
  if (criteria.has_business_key) {
    reasoning.push('Contains business/natural key field');
  }

  return {
    is_valid: criteriaCount >= 2,
    criteria_met: criteriaCount,
    criteria_required: 2,
    criteria,
    reasoning,
    confidence: this.calculateConfidence(criteriaCount, 5, 2),
  };
}

private matchesDimensionNamingPattern(name: string): boolean {
  const dimPatterns = [
    /customers?$/i, /products?$/i, /categories?$/i, /locations?$/i,
    /employees?$/i, /vendors?$/i, /suppliers?$/i, /stores?$/i,
    /regions?$/i, /territories?$/i, /departments?$/i, /accounts?$/i,
    /_dim$/i, /^dim_/i, /^d_/i, /lookup$/i, /reference$/i,
  ];
  return dimPatterns.some(p => p.test(name));
}

private isReferencedByOthers(tableName: string, relationships: EnrichedRelationship[]): boolean {
  return relationships.some(r => r.to_table === tableName || r.from_table === tableName);
}

private hasBusinessKey(table: EnrichedTable): boolean {
  const bkPatterns = [/_code$/i, /_number$/i, /_no$/i, /^code_/i, /^num_/i];
  return table.fields.some(f =>
    !f.is_primary_key && bkPatterns.some(p => p.test(f.name))
  );
}
```

#### Bridge Table Validation

A table is classified as **Bridge/Link** when it meets **ALL** of these criteria:

```typescript
interface BridgeTableCriteria {
  exactly_two_fks: boolean;       // Has exactly 2 foreign key fields
  minimal_attributes: boolean;    // 0-2 non-key attributes (e.g., quantity, effective_date)
  many_to_many_pattern: boolean;  // Connects two tables that have M:N relationship
}

/**
 * Validates if a table qualifies as a Bridge/Junction table.
 * ALL criteria must be met for confident classification.
 */
private validateBridgeTable(
  table: EnrichedTable,
  allTables: EnrichedTable[],
  relationships: EnrichedRelationship[]
): BridgeValidationResult {
  const fkFields = table.fields.filter(f =>
    /_id$/i.test(f.name) || /_key$/i.test(f.name) || /_fk$/i.test(f.name)
  );

  const nonKeyFields = table.fields.filter(f =>
    !/_id$/i.test(f.name) &&
    !/_key$/i.test(f.name) &&
    !/_fk$/i.test(f.name) &&
    !f.is_primary_key
  );

  // Check for M:N pattern - table connects two other tables
  const connectedTables = this.findRelatedTables(table, allTables);
  const hasManyToManyPattern = connectedTables.length === 2;

  const criteria: BridgeTableCriteria = {
    exactly_two_fks: fkFields.length === 2,
    minimal_attributes: nonKeyFields.length <= 2,
    many_to_many_pattern: hasManyToManyPattern,
  };

  const criteriaCount = Object.values(criteria).filter(Boolean).length;
  const allCriteriaMet = criteriaCount === 3;
  const reasoning: string[] = [];

  if (criteria.exactly_two_fks) {
    reasoning.push(`Has exactly 2 FK fields: ${fkFields.map(f => f.name).join(', ')}`);
  } else {
    reasoning.push(`Has ${fkFields.length} FK fields (expected 2)`);
  }

  if (criteria.minimal_attributes) {
    reasoning.push(`Has ${nonKeyFields.length} non-key attributes (minimal)`);
  } else {
    reasoning.push(`Has ${nonKeyFields.length} non-key attributes (too many for bridge)`);
  }

  if (criteria.many_to_many_pattern) {
    reasoning.push(`Connects 2 tables: ${connectedTables.join(' ↔ ')}`);
  } else {
    reasoning.push(`Connected to ${connectedTables.length} tables (expected 2 for M:N)`);
  }

  return {
    is_valid: allCriteriaMet,
    criteria_met: criteriaCount,
    criteria_required: 3,  // ALL required
    criteria,
    reasoning,
    confidence: allCriteriaMet ? 0.95 : criteriaCount / 3 * 0.6,
    connected_tables: connectedTables,
  };
}
```

### 2. Confidence Scoring

Each classification receives a confidence score indicating how certain the classification is:

| Score Range | Confidence Level | Action Required |
|-------------|------------------|-----------------|
| **0.9 - 1.0** | High | Proceed with classification |
| **0.7 - 0.89** | Medium | Suggest human review |
| **< 0.7** | Low | Require human confirmation |

```typescript
interface ClassificationConfidence {
  score: number;              // 0.0 - 1.0
  level: 'high' | 'medium' | 'low';
  requires_review: boolean;
  requires_confirmation: boolean;
}

/**
 * Calculates confidence score based on criteria met vs required.
 */
private calculateConfidence(
  criteriaMet: number,
  totalCriteria: number,
  requiredCriteria: number
): number {
  // Base confidence from meeting required criteria
  const baseConfidence = criteriaMet >= requiredCriteria ? 0.7 : 0.3;

  // Bonus for exceeding required criteria
  const excessCriteria = Math.max(0, criteriaMet - requiredCriteria);
  const maxExcess = totalCriteria - requiredCriteria;
  const bonusConfidence = maxExcess > 0 ? (excessCriteria / maxExcess) * 0.25 : 0;

  // Additional bonus for meeting all criteria
  const perfectBonus = criteriaMet === totalCriteria ? 0.05 : 0;

  return Math.min(1.0, baseConfidence + bonusConfidence + perfectBonus);
}

/**
 * Determines confidence level and required actions.
 */
private evaluateConfidence(score: number): ClassificationConfidence {
  if (score >= 0.9) {
    return {
      score,
      level: 'high',
      requires_review: false,
      requires_confirmation: false,
    };
  } else if (score >= 0.7) {
    return {
      score,
      level: 'medium',
      requires_review: true,
      requires_confirmation: false,
    };
  } else {
    return {
      score,
      level: 'low',
      requires_review: true,
      requires_confirmation: true,
    };
  }
}

/**
 * Generates confidence-based recommendations.
 */
private generateConfidenceRecommendations(
  tableName: string,
  classification: TableClassification,
  confidence: ClassificationConfidence
): string[] {
  const recommendations: string[] = [];

  if (confidence.level === 'low') {
    recommendations.push(
      `⚠️ Low confidence (${(confidence.score * 100).toFixed(0)}%) for "${tableName}" as ${classification}. ` +
      `Human confirmation required before proceeding.`
    );
  } else if (confidence.level === 'medium') {
    recommendations.push(
      `ℹ️ Medium confidence (${(confidence.score * 100).toFixed(0)}%) for "${tableName}" as ${classification}. ` +
      `Consider reviewing the classification.`
    );
  }

  return recommendations;
}
```

### 3. Ambiguity Resolution

When a table could match multiple classifications, list all possibilities with scores:

```typescript
interface AmbiguousClassification {
  table_name: string;
  possible_classifications: Array<{
    type: TableClassification;
    confidence: number;
    reasoning: string[];
  }>;
  recommended: TableClassification;
  ambiguity_type: 'hybrid' | 'borderline' | 'insufficient_data';
  resolution_suggestion: string;
}

/**
 * Handles tables that match multiple classification patterns.
 */
private resolveAmbiguousClassification(
  table: EnrichedTable,
  allTables: EnrichedTable[],
  relationships: EnrichedRelationship[]
): AmbiguousClassification | null {
  const factValidation = this.validateFactTable(table, allTables);
  const dimValidation = this.validateDimensionTable(table, allTables, relationships);
  const bridgeValidation = this.validateBridgeTable(table, allTables, relationships);

  const candidates = [
    { type: 'fact' as const, confidence: factValidation.confidence, validation: factValidation },
    { type: 'dimension' as const, confidence: dimValidation.confidence, validation: dimValidation },
    { type: 'bridge' as const, confidence: bridgeValidation.confidence, validation: bridgeValidation },
  ].filter(c => c.validation.is_valid);

  // No ambiguity if only one valid classification
  if (candidates.length <= 1) {
    return null;
  }

  // Sort by confidence descending
  candidates.sort((a, b) => b.confidence - a.confidence);

  const topTwo = candidates.slice(0, 2);
  const confidenceDelta = topTwo[0].confidence - topTwo[1].confidence;

  // Determine ambiguity type
  let ambiguityType: 'hybrid' | 'borderline' | 'insufficient_data';
  let resolutionSuggestion: string;

  if (confidenceDelta < 0.1) {
    // Very close scores - true ambiguity
    ambiguityType = 'hybrid';
    resolutionSuggestion = this.suggestHybridResolution(table, topTwo[0].type, topTwo[1].type);
  } else if (confidenceDelta < 0.2) {
    // Moderately close - borderline case
    ambiguityType = 'borderline';
    resolutionSuggestion = `Classified as ${topTwo[0].type} but review recommended. ` +
      `Also shows characteristics of ${topTwo[1].type}.`;
  } else {
    ambiguityType = 'insufficient_data';
    resolutionSuggestion = 'Multiple patterns detected but primary classification is clear.';
  }

  return {
    table_name: table.name,
    possible_classifications: candidates.map(c => ({
      type: c.type,
      confidence: c.confidence,
      reasoning: c.validation.reasoning,
    })),
    recommended: topTwo[0].type,
    ambiguity_type: ambiguityType,
    resolution_suggestion: resolutionSuggestion,
  };
}

/**
 * Suggests resolution for hybrid table types.
 */
private suggestHybridResolution(
  table: EnrichedTable,
  type1: TableClassification,
  type2: TableClassification
): string {
  // Factless Fact detection
  if (type1 === 'fact' && type2 === 'bridge' || type1 === 'bridge' && type2 === 'fact') {
    const hasMeasures = this.countMeasureFields(table) > 0;
    if (!hasMeasures) {
      return 'Detected as "Factless Fact" - a fact table tracking events without measures. ' +
        'Treat as Fact for modeling purposes.';
    } else {
      return 'Fact table with bridge-like structure. Contains measures, treat as Fact.';
    }
  }

  // Large Dimension detection
  if (type1 === 'dimension' && type2 === 'fact' || type1 === 'fact' && type2 === 'dimension') {
    if (table.row_count > 100000) {
      return 'Large dimension table (>100K rows). Verify this is not actually a Fact table. ' +
        'Check if rows represent events/transactions or reference data.';
    }
  }

  return `Table shows characteristics of both ${type1} and ${type2}. ` +
    `Manual review recommended to determine primary purpose.`;
}
```

#### Hybrid Table Handling

Special handling for common hybrid scenarios:

```typescript
/**
 * Detects and classifies Factless Fact tables.
 * Factless Facts track events/relationships without numeric measures.
 * Examples: Student-Course enrollment, Product-Promotion associations
 */
private detectFactlessFact(table: EnrichedTable, allTables: EnrichedTable[]): FactlessFactResult {
  const fkCount = this.countForeignKeys(table, allTables);
  const measureCount = this.countMeasureFields(table);
  const hasDateField = table.fields.some(f => f.is_date_field);

  const isFactlessFact =
    fkCount >= 2 &&           // Links multiple dimensions
    measureCount === 0 &&     // No measures
    hasDateField;             // Has event date

  return {
    is_factless_fact: isFactlessFact,
    classification: isFactlessFact ? 'fact' : null,
    subtype: isFactlessFact ? 'factless' : null,
    reasoning: isFactlessFact
      ? [
          `No measure fields but ${fkCount} FK relationships`,
          'Contains event date - tracks occurrences',
          'Classify as Factless Fact (event tracking)',
        ]
      : [],
  };
}

/**
 * Enhanced SCD Type 2 detection with stricter validation.
 * Must have effective_date AND (expiry_date OR is_current) for Type 2.
 */
private detectSCDType2(table: EnrichedTable): SCDType2Detection {
  const fieldNames = table.fields.map(f => f.name.toLowerCase());

  // Required: effective_date or equivalent
  const effectiveDatePatterns = [
    /effective_date/i, /valid_from/i, /start_date/i,
    /begin_date/i, /from_date/i, /eff_date/i,
  ];
  const hasEffectiveDate = fieldNames.some(f =>
    effectiveDatePatterns.some(p => p.test(f))
  );

  // Required: expiry_date OR is_current flag (at least one)
  const expiryDatePatterns = [
    /expiry_date/i, /expiration_date/i, /valid_to/i,
    /end_date/i, /to_date/i, /exp_date/i,
  ];
  const currentFlagPatterns = [
    /is_current/i, /current_flag/i, /is_active/i,
    /active_flag/i, /current_ind/i, /active_ind/i,
  ];

  const hasExpiryDate = fieldNames.some(f =>
    expiryDatePatterns.some(p => p.test(f))
  );
  const hasCurrentFlag = fieldNames.some(f =>
    currentFlagPatterns.some(p => p.test(f))
  );

  // SCD Type 2 requires: effective_date AND (expiry_date OR is_current)
  const isSCDType2 = hasEffectiveDate && (hasExpiryDate || hasCurrentFlag);

  const reasoning: string[] = [];
  if (hasEffectiveDate) reasoning.push('Has effective/start date field');
  if (hasExpiryDate) reasoning.push('Has expiry/end date field');
  if (hasCurrentFlag) reasoning.push('Has current/active flag');

  return {
    is_scd_type_2: isSCDType2,
    confidence: isSCDType2 ? 0.95 : 0,
    has_effective_date: hasEffectiveDate,
    has_expiry_date: hasExpiryDate,
    has_current_flag: hasCurrentFlag,
    reasoning,
    recommendation: isSCDType2
      ? 'Table is SCD Type 2 - include history tracking in load strategy'
      : hasEffectiveDate && !hasExpiryDate && !hasCurrentFlag
        ? 'Has start date but missing end date/current flag - may be incomplete SCD Type 2'
        : null,
  };
}
```

### 4. Edge Cases

Handle special scenarios that can lead to misclassification:

```typescript
interface EdgeCaseResult {
  is_edge_case: boolean;
  edge_case_type: 'empty' | 'single_field' | 'large_dimension' | 'no_relationships' | null;
  classification: TableClassification | 'unknown';
  warning: string | null;
  recommendation: string | null;
}

/**
 * Handles edge cases that require special classification logic.
 */
private handleEdgeCases(
  table: EnrichedTable,
  allTables: EnrichedTable[],
  relationships: EnrichedRelationship[]
): EdgeCaseResult {
  // Edge Case 1: Empty tables
  if (table.row_count === 0) {
    return {
      is_edge_case: true,
      edge_case_type: 'empty',
      classification: 'unknown',
      warning: `Table "${table.name}" has 0 rows - cannot determine classification`,
      recommendation: 'Populate table with data or provide explicit classification',
    };
  }

  // Edge Case 2: Single-field tables (check if bridge or lookup)
  if (table.fields.length === 1) {
    const field = table.fields[0];
    const isLikelyBridge = /_id$/i.test(field.name) || /_key$/i.test(field.name);

    return {
      is_edge_case: true,
      edge_case_type: 'single_field',
      classification: isLikelyBridge ? 'bridge' : 'dimension',
      warning: `Table "${table.name}" has only 1 field`,
      recommendation: isLikelyBridge
        ? 'Single FK field suggests incomplete bridge table - verify structure'
        : 'Single-field table may be a simple lookup - verify if needed',
    };
  }

  // Edge Case 3: Very large dimension (>100K rows)
  const dimValidation = this.validateDimensionTable(table, allTables, relationships);
  if (dimValidation.is_valid && table.row_count > 100000) {
    // Double-check it's not actually a fact
    const factValidation = this.validateFactTable(table, allTables);

    return {
      is_edge_case: true,
      edge_case_type: 'large_dimension',
      classification: factValidation.confidence > dimValidation.confidence ? 'fact' : 'dimension',
      warning: `Table "${table.name}" classified as dimension but has ${table.row_count.toLocaleString()} rows`,
      recommendation: factValidation.confidence > 0.5
        ? `Re-evaluate: ${table.name} may actually be a Fact table. ` +
          `Check if rows represent transactions/events.`
        : 'Large dimension is valid but consider partitioning or incremental load strategy',
    };
  }

  // Edge Case 4: Table with no relationships
  const hasRelationships = relationships.some(
    r => r.from_table === table.name || r.to_table === table.name
  );
  if (!hasRelationships) {
    return {
      is_edge_case: true,
      edge_case_type: 'no_relationships',
      classification: 'dimension', // Default orphan tables to dimension
      warning: `Table "${table.name}" has no relationships to other tables`,
      recommendation: 'Verify if this is a standalone lookup table or if relationships are missing',
    };
  }

  return {
    is_edge_case: false,
    edge_case_type: null,
    classification: 'unknown',
    warning: null,
    recommendation: null,
  };
}

/**
 * Enhanced classifyTable that incorporates all validation and edge case handling.
 */
classifyTableWithValidation(
  table: EnrichedTable,
  allTables: EnrichedTable[],
  relationships: EnrichedRelationship[]
): EnhancedClassificationResult {
  // Step 1: Check for edge cases first
  const edgeCase = this.handleEdgeCases(table, allTables, relationships);
  if (edgeCase.is_edge_case) {
    return {
      table_name: table.name,
      classification: edgeCase.classification,
      confidence: edgeCase.classification === 'unknown' ? 0 : 0.5,
      confidence_level: 'low',
      requires_review: true,
      requires_confirmation: edgeCase.classification === 'unknown',
      reasoning: [edgeCase.warning!],
      recommendations: edgeCase.recommendation ? [edgeCase.recommendation] : [],
      edge_case: edgeCase,
      ambiguity: null,
    };
  }

  // Step 2: Run all validations
  const factValidation = this.validateFactTable(table, allTables);
  const dimValidation = this.validateDimensionTable(table, allTables, relationships);
  const bridgeValidation = this.validateBridgeTable(table, allTables, relationships);

  // Step 3: Check for calendar table (special case)
  if (this.isCalendarTable(table)) {
    return {
      table_name: table.name,
      classification: 'calendar',
      confidence: 0.95,
      confidence_level: 'high',
      requires_review: false,
      requires_confirmation: false,
      reasoning: ['Table structure matches calendar/date dimension pattern'],
      recommendations: [],
      edge_case: null,
      ambiguity: null,
    };
  }

  // Step 4: Check for ambiguity
  const ambiguity = this.resolveAmbiguousClassification(table, allTables, relationships);

  // Step 5: Select best classification
  let classification: TableClassification;
  let confidence: number;
  let reasoning: string[];

  if (bridgeValidation.is_valid && bridgeValidation.confidence >= 0.9) {
    // Bridge tables take priority when all criteria met
    classification = 'bridge';
    confidence = bridgeValidation.confidence;
    reasoning = bridgeValidation.reasoning;
  } else if (factValidation.confidence > dimValidation.confidence) {
    classification = 'fact';
    confidence = factValidation.confidence;
    reasoning = factValidation.reasoning;
  } else {
    classification = 'dimension';
    confidence = dimValidation.confidence;
    reasoning = dimValidation.reasoning;
  }

  // Step 6: Evaluate confidence and generate result
  const confidenceEval = this.evaluateConfidence(confidence);
  const recommendations = this.generateConfidenceRecommendations(
    table.name,
    classification,
    confidenceEval
  );

  // Add ambiguity recommendations if present
  if (ambiguity) {
    recommendations.push(ambiguity.resolution_suggestion);
  }

  return {
    table_name: table.name,
    classification,
    confidence,
    confidence_level: confidenceEval.level,
    requires_review: confidenceEval.requires_review,
    requires_confirmation: confidenceEval.requires_confirmation,
    reasoning,
    recommendations,
    edge_case: null,
    ambiguity,
  };
}
```

### Supporting Type Definitions

```typescript
interface FactValidationResult {
  is_valid: boolean;
  criteria_met: number;
  criteria_required: number;
  criteria: FactTableCriteria;
  reasoning: string[];
  confidence: number;
}

interface DimensionValidationResult {
  is_valid: boolean;
  criteria_met: number;
  criteria_required: number;
  criteria: DimensionTableCriteria;
  reasoning: string[];
  confidence: number;
}

interface BridgeValidationResult {
  is_valid: boolean;
  criteria_met: number;
  criteria_required: number;
  criteria: BridgeTableCriteria;
  reasoning: string[];
  confidence: number;
  connected_tables: string[];
}

interface FactlessFactResult {
  is_factless_fact: boolean;
  classification: 'fact' | null;
  subtype: 'factless' | null;
  reasoning: string[];
}

interface SCDType2Detection {
  is_scd_type_2: boolean;
  confidence: number;
  has_effective_date: boolean;
  has_expiry_date: boolean;
  has_current_flag: boolean;
  reasoning: string[];
  recommendation: string | null;
}

interface EnhancedClassificationResult {
  table_name: string;
  classification: TableClassification | 'unknown';
  confidence: number;
  confidence_level: 'high' | 'medium' | 'low';
  requires_review: boolean;
  requires_confirmation: boolean;
  reasoning: string[];
  recommendations: string[];
  edge_case: EdgeCaseResult | null;
  ambiguity: AmbiguousClassification | null;
}
```

---

### Step 8: Model Type Detection

```typescript
detectModelType(
  classifications: Map<string, TableClassification>,
  relationships: EnrichedRelationship[]
): ModelTypeRecommendation {
  const facts = [...classifications.entries()].filter(([_, c]) => c === 'fact');
  const dimensions = [...classifications.entries()].filter(([_, c]) => c === 'dimension');

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
    alternatives.push({
      model: 'snowflake',
      reason: `${dimToDimRelations.length} dimension-to-dimension relationships found`,
      pros: ['Preserves natural hierarchy', 'Normalized structure', 'Easy maintenance'],
      cons: ['More JOINs required', 'Slightly slower queries'],
    });
  }

  // Check for Link Table: Fact <-> Fact N:M
  const factToFactRelations = relationships.filter(r => {
    const fromClass = classifications.get(r.from_table);
    const toClass = classifications.get(r.to_table);
    return fromClass === 'fact' && toClass === 'fact';
  });

  if (factToFactRelations.length > 0) {
    recommended = 'link_table';
    confidence = 0.85;
    reasoning = 'Multiple fact tables with relationships require Link Table';
    alternatives.push({
      model: 'star_schema',
      reason: 'Simpler structure if relationships can be restructured',
      pros: ['Simpler queries', 'Better performance'],
      cons: ['May lose relationship granularity'],
    });
  }

  // Check for Concatenated: Multiple similar facts
  if (facts.length >= 2 && this.areSimilarFacts(facts, classifications, relationships)) {
    alternatives.push({
      model: 'concatenated',
      reason: 'Multiple similar fact tables could be concatenated',
      pros: ['Single fact table', 'Unified analysis'],
      cons: ['Larger table', 'Need to track source'],
    });
  }

  // Default to Star if no special cases
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
```

### Step 4: Analysis Result Generation

```typescript
analyze(spec: EnrichedModelSpec): AnalysisResult {
  const classifications = new Map<string, TableClassificationResult>();

  // Classify all tables
  for (const table of spec.tables) {
    const result = this.classifyTable(table, spec.tables);
    classifications.set(table.name, result);

    if (result.classification) {
      table.classification = result.classification;
      table.classification_confidence = result.confidence;
    }
  }

  // Detect model type
  const classMap = new Map(
    [...classifications.entries()].map(([name, r]) => [name, r.classification])
  );
  const modelRec = this.detectModelType(classMap, spec.relationships);

  // Generate warnings
  const warnings = this.generateWarnings(classifications, spec.relationships);

  // Generate recommendations
  const recommendations = this.generateRecommendations({
    classifications,
    model_recommendation: modelRec,
    warnings,
    recommendations: [],
  });

  return {
    classifications,
    model_recommendation: modelRec,
    warnings,
    recommendations,
  };
}
```

## Classification Decision Tree

```
                    ┌─────────────────────────────────────┐
                    │        TABLE CLASSIFICATION          │
                    └─────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌───────────┐   ┌───────────┐   ┌───────────┐
            │ Row Count │   │  Fields   │   │   Keys    │
            │   Check   │   │  Pattern  │   │   Count   │
            └───────────┘   └───────────┘   └───────────┘
                    │               │               │
            ┌───────┴───────┐      │               │
            ▼               ▼      ▼               ▼
        >10K rows       <1K rows   Measures?    FK count?
            │               │      │               │
            ▼               ▼      ▼               ▼
         +FACT          +DIM    +FACT if       +FACT if
                                  >=2            >=2
                                    │
                            ┌───────┴───────┐
                            ▼               ▼
                    Descriptive       Calendar
                    fields >=3?       pattern?
                            │               │
                            ▼               ▼
                         +DIM          +CALENDAR
```

## Potential Failure Points

1. **Ambiguous tables** - Table fits both Fact and Dimension patterns
2. **Missing relationships** - Cannot determine model type without hints
3. **Small datasets** - Row count heuristics unreliable
4. **Unusual naming** - Field names don't follow conventions
5. **Low confidence** - Multiple classifications have similar scores

## Mitigation Strategies

1. Return confidence score, let user decide on low confidence
2. Default to Star Schema, ask user to confirm
3. Weight name patterns more than row count for small data
4. Allow user to override classifications
5. Show all alternatives when confidence < 0.7

## Test Plan

```typescript
describe('Analyzer', () => {
  describe('classifyTable', () => {
    it('should classify high-row-count table with measures as Fact');
    it('should classify low-row-count table with descriptions as Dimension');
    it('should detect calendar tables');
    it('should return confidence score');
  });

  describe('detectModelType', () => {
    it('should recommend Star Schema for simple Fact+Dimensions');
    it('should suggest Snowflake for Dimension hierarchies');
    it('should recommend Link Table for Fact-to-Fact relations');
    it('should suggest Concatenated for similar Facts');
  });

  describe('analyze', () => {
    it('should classify all tables');
    it('should detect model type');
    it('should generate warnings for ambiguous cases');
    it('should provide recommendations');
  });

  describe('edge cases', () => {
    it('should handle single-table input');
    it('should handle no relationships');
    it('should handle all tables as same classification');
  });
});
```

## Error Handling Strategy

| Error Type | Possible Cause | Handling Approach | Recovery |
|------------|----------------|-------------------|----------|
| Empty Spec | No tables in EnrichedModelSpec | Throw `AnalysisError` | User provides valid input |
| No Classification | Table doesn't match any pattern | Default to 'dimension', low confidence | User reviews classification |
| No Relationships | Spec has no relationship hints | Default to star_schema | User confirms model type |
| All Same Type | All tables classified as same type | Generate warning | User reviews, may override |
| Circular Dependency | Relationships form cycle | Detect and warn, suggest link table | User restructures model |
| Orphan Table | Table not connected to any other | Generate warning | User reviews relationships |

**Classification Fallback Logic:**
```typescript
classifyTable(table: EnrichedTable): TableClassificationResult {
  const scores = calculateScores(table);

  // If no clear winner
  if (Math.max(...Object.values(scores)) < 3) {
    return {
      classification: 'dimension',  // Safe default
      confidence: 0.3,
      reasoning: ['Low confidence: defaulting to dimension'],
    };
  }
  // Normal classification...
}
```

**Error Recovery Flow:**
```
1. Validate EnrichedModelSpec has tables
   ├── Empty → Throw AnalysisError
   └── Has tables → Continue
2. Classify each table
   ├── Clear classification → High confidence
   └── Ambiguous → Low confidence + reasoning
3. Detect model type
   ├── Clear pattern → Recommend with high confidence
   └── No pattern → Default to star_schema + alternatives
4. Generate warnings for edge cases
5. Return complete AnalysisResult
```

## Performance Considerations

| Operation | Time Complexity | Space Complexity | Notes |
|-----------|-----------------|------------------|-------|
| `analyze()` | O(t × f) | O(t) | t=tables, f=fields per table |
| `classifyTable()` | O(f) | O(1) | f = fields in table |
| `detectModelType()` | O(t × r) | O(t) | r = relationships |
| `isMeasureField()` | O(p) | O(1) | p = measure patterns (~12) |
| `isDescriptiveField()` | O(p) | O(1) | p = descriptive patterns (~9) |
| `isCalendarTable()` | O(f) | O(f) | f = fields, map to lowercase |
| `generateWarnings()` | O(t + r) | O(w) | w = number of warnings |

**Memory Usage:**
- Classifications map: O(t) entries
- Each classification: ~200 bytes (name, type, confidence, reasoning)
- Warnings array: Variable, typically < 10 items
- Total: ~500 bytes per table

**Optimization Tips:**
1. Pre-compile all regex patterns as class constants
2. Use Set for faster pattern matching: `measureWords.has(word)`
3. Cache field type checks (same types checked repeatedly)
4. Short-circuit classification when confidence > 0.9
5. Parallelize table classification (independent operations)

**Scoring Weights (Tunable):**
```typescript
const WEIGHTS = {
  ROW_COUNT_HIGH: 2,     // >10K rows → fact
  ROW_COUNT_LOW: 2,      // <1K rows → dimension
  MEASURE_FIELDS: 3,     // Numeric measures → fact
  FK_COUNT: 2,           // Multiple FKs → fact
  DATE_FIELDS: 1,        // With high rows → fact
  DESCRIPTIVE_FIELDS: 2, // String attributes → dimension
  CALENDAR_PATTERN: 10,  // Override for calendar tables
};
```

## Integration Points

| Component | Direction | Data Exchange | Contract |
|-----------|-----------|---------------|----------|
| Logger | An → Logger | Classification decisions, warnings | `logger.info('analyzer', ...)` |
| Input Processor | An ← IP | EnrichedModelSpec | Input to `analyze()` |
| Orchestrator | An ← Orch | Trigger analysis | `analyzer.analyze(spec)` |
| Script Builder | An → SB | Classification results | Used for script generation |

**Input Contract (EnrichedModelSpec):**
```typescript
{
  tables: EnrichedTable[];         // From Input Processor
  relationships: EnrichedRelationship[];
  date_fields: DateFieldInfo[];
}

interface EnrichedTable {
  name: string;
  source_name: string;
  row_count: number;
  fields: EnrichedField[];
  // Classification added by Analyzer:
  classification?: TableClassification;
  classification_confidence?: number;
}
```

**Output Contract (AnalysisResult):**
```typescript
{
  classifications: Map<string, TableClassificationResult>;
  model_recommendation: ModelTypeRecommendation;
  warnings: AnalysisWarning[];
  recommendations: string[];
}

interface TableClassificationResult {
  table_name: string;
  classification: 'fact' | 'dimension' | 'link' | 'calendar';
  confidence: number;     // 0.0 - 1.0
  reasoning: string[];    // Human-readable explanations
}

interface ModelTypeRecommendation {
  recommended_model: ModelType;
  confidence: number;
  alternatives: ModelTypeAlternative[];
  reasoning: string;
}
```

**Event Pattern:**
```
Analyzer does NOT emit events.
Synchronous analysis, returns complete result.
Warnings included in result, not emitted separately.
```

## Risk Mitigation & Contingency

| Risk | Impact (days) | Probability | Contingency | Trigger |
|------|--------------|-------------|-------------|---------|
| Table classification heuristics produce wrong results | 2 | High (50%) | Add user confirmation step for classifications; allow manual override | User rejects classification for >2 tables |
| Model type recommendation doesn't fit data pattern | 1 | Medium (35%) | Present all model types with scores; let user choose with guidance | User selects non-recommended model type |
| Complex multi-fact relationships not detected | 2 | Medium (40%) | Fall back to link_table model; add warning about potential synthetic keys | >2 fact tables with shared dimensions |
| Performance degrades with large table counts (>50) | 1 | Low (20%) | Optimize relationship graph algorithm; limit analysis depth | Analysis takes >5 seconds |

## Task Breakdown & Dependencies

| Task | Duration | Dependencies | Critical Path | DoD |
|------|----------|--------------|---------------|-----|
| 5.1 Implement Analyzer class skeleton | 0.5 day | Sub-Plan 01 (Types), Sub-Plan 02 (Logger) | YES | ✓ Class compiles, ✓ Implements Analyzer interface, ✓ analyze() method signature correct |
| 5.2 Implement table classification algorithm | 1.5 days | 5.1 | YES | ✓ Classifies fact/dimension/calendar, ✓ Multi-criteria scoring works, ✓ Returns confidence 0-1 |
| 5.3 Implement relationship graph building | 1 day | 5.1 | YES | ✓ Builds adjacency map, ✓ Detects circular refs, ✓ Identifies fan/chasm traps |
| 5.4 Implement model type recommendation | 1 day | 5.2, 5.3 | YES | ✓ Recommends star/snowflake/link/concat, ✓ Provides alternatives array, ✓ Includes reasoning string |
| 5.5 Implement confidence scoring | 0.5 day | 5.2, 5.4 | NO | ✓ Scores based on criteria met, ✓ High/medium/low levels defined, ✓ Flags require_review correctly |
| 5.6 Implement warning generation | 0.5 day | 5.2, 5.3 | NO | ✓ Warns on ambiguous tables, ✓ Warns on orphan tables, ✓ Warns on circular dependencies |
| 5.7 Write unit tests for classification | 1 day | 5.2 | YES | ✓ Tests all classification paths, ✓ Edge cases covered, ✓ Scoring logic verified |
| 5.8 Write tests with Olist dataset | 1 day | 5.1-5.6 | YES | ✓ 4 facts identified correctly, ✓ 5 dimensions identified, ✓ Star schema recommended |
| 5.9 Validate against known star schema patterns | 0.5 day | 5.8 | NO | ✓ Sales star schema test passes, ✓ Snowflake pattern detected, ✓ Link table pattern detected |

**Critical Path:** 5.1 → 5.2 → 5.3 → 5.4 → 5.7 → 5.8 (6 days)

## Resource Requirements

| Resource | Type | Availability | Skills Required |
|----------|------|--------------|-----------------|
| TypeScript Developer | Human | 1 FTE for 6 days | Graph algorithms, star schema concepts, dimensional modeling |
| Logger Service | Component | After Sub-Plan 02 | N/A |
| Input Processor | Component | After Sub-Plan 04 | N/A |
| Olist dataset relationships | Data | docs/Olist_Relationships.csv | N/A |
| Reference star schema examples | Data | Create test fixtures | N/A |

## Testing Strategy

| Phase | Coverage | Tools | Acceptance Criteria | Rollback Plan |
|-------|----------|-------|---------------------|---------------|
| Unit Testing | Classification and relationship algorithms | Jest | 100% method coverage; correct scoring logic | N/A - core functionality |
| Classification Accuracy Testing | Olist dataset (9 tables) | Jest with Olist fixtures | 100% correct classification on Olist (4 facts, 5 dimensions) | Adjust heuristic weights |
| Model Recommendation Testing | Various schema patterns | Jest with multiple fixtures | Correct recommendation for star, snowflake, link patterns | Add more model type options |
| Integration Testing | Full analysis pipeline | Jest | Complete AnalysisResult with all fields populated | Simplify output; add warnings |

## Communication Plan

- **Daily:** Share classification accuracy metrics; discuss edge cases found during testing
- **Weekly:** Demo analysis results to Script Builder team; validate recommendations match expected output
- **Escalation:** If classification accuracy falls below 90% on test data, escalate for algorithm review
- **Change Requests:** Changes to classification heuristics require full regression test on all fixtures

---

## Gemini Review
**Date:** 2026-01-21
**Status:** ✅ APPROVED (10/10)

| Metric | Score |
|--------|-------|
| Completeness | 10/10 |
| Correctness | 10/10 |

**Review Notes:** All criteria met including Definition of Done for each task.

---

## Success Criteria

- [ ] Tables classified with reasonable accuracy (>80% on test data)
- [ ] Model type detected correctly for common patterns
- [ ] Confidence scores reflect classification certainty
- [ ] Alternatives provided for non-obvious cases
- [ ] Warnings generated for edge cases
- [ ] All tests passing
