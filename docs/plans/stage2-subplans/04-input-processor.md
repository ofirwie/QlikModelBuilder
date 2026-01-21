# Sub-Plan 04: Input Processor

> **Part of:** Data Model Builder (Stage 2) Implementation
> **Dependencies:** Sub-Plan 01 (Types), Sub-Plan 02 (Logger)
> **Output:** `src/model-builder/services/input-processor.ts`

---

## Goal

Merge Stage 1 JSON output with QVD sample data to create an enriched model specification with cardinality, null percentages, and sample values.

## Context

From design document (section 3.2):
- **Source 1:** JSON from Stage 1 Parser (tables, fields, types, relationship hints)
- **Source 2:** Sample data from QVD files (100 rows, cardinality, nulls)
- **Output:** Enriched Model Spec with combined metadata

## Files to Create

| File | Purpose |
|------|---------|
| `src/model-builder/services/input-processor.ts` | Input processing implementation |
| `src/__tests__/model-builder/input-processor.test.ts` | Unit tests |

## Key Interfaces

```typescript
interface InputProcessor {
  // Main processing
  process(stage1Json: Stage1Input, qvdSamples: QvdSampleData[]): EnrichedModelSpec;

  // Validation
  validateStage1Input(input: unknown): Stage1Input;
  validateQvdSamples(samples: unknown[]): QvdSampleData[];

  // Individual enrichment
  enrichTable(table: Stage1Table, sample: QvdSampleData | null): EnrichedTable;
  enrichField(field: Stage1Field, sampleField: QvdFieldSample | null): EnrichedField;

  // Key detection
  detectKeyCandidate(field: EnrichedField, tableName: string): boolean;
  detectDateField(field: EnrichedField): boolean;
}
```

## Implementation Steps

### Step 1: Input Validation

```typescript
validateStage1Input(input: unknown): Stage1Input {
  if (!input || typeof input !== 'object') {
    throw new ValidationError('Stage1 input must be an object');
  }

  const obj = input as Record<string, unknown>;

  // Required fields
  if (!obj.version || typeof obj.version !== 'string') {
    throw new ValidationError('Missing or invalid version');
  }
  if (!Array.isArray(obj.tables)) {
    throw new ValidationError('Tables must be an array');
  }

  // Validate each table
  for (const table of obj.tables) {
    this.validateTable(table);
  }

  return input as Stage1Input;
}
```

### Step 2: Table Matching

```typescript
process(stage1Json: Stage1Input, qvdSamples: QvdSampleData[]): EnrichedModelSpec {
  const sampleMap = new Map<string, QvdSampleData>();

  // Build lookup by table name (case-insensitive)
  for (const sample of qvdSamples) {
    sampleMap.set(sample.table_name.toLowerCase(), sample);
  }

  const enrichedTables: EnrichedTable[] = [];

  for (const table of stage1Json.tables) {
    const sample = sampleMap.get(table.name.toLowerCase()) || null;
    const enriched = this.enrichTable(table, sample);
    enrichedTables.push(enriched);

    if (!sample) {
      this.logger.warn('input_processor', 'no_sample_data', { table: table.name });
    }
  }

  return {
    tables: enrichedTables,
    relationships: this.processRelationships(stage1Json.relationship_hints, enrichedTables),
    date_fields: this.extractDateFields(enrichedTables),
  };
}
```

### Step 3: Field Enrichment

```typescript
enrichField(field: Stage1Field, sampleField: QvdFieldSample | null): EnrichedField {
  const enriched: EnrichedField = {
    name: field.name,
    type: sampleField?.type || field.type,
    cardinality: sampleField?.cardinality || 0,
    null_percent: sampleField?.null_percent || 0,
    is_key_candidate: false,
    is_date_field: false,
    sample_values: sampleField?.sample_values || [],
  };

  // Detect key candidate
  enriched.is_key_candidate = this.detectKeyCandidate(enriched, field.name);

  // Detect date field
  enriched.is_date_field = this.detectDateField(enriched);

  return enriched;
}
```

### Step 4: Key Detection Heuristics

```typescript
detectKeyCandidate(field: EnrichedField, fieldName: string): boolean {
  const nameLower = fieldName.toLowerCase();

  // Name-based detection
  const keyPatterns = [
    /^.*_?id$/i,           // CustomerID, customer_id
    /^.*_?key$/i,          // CustomerKey
    /^.*_?code$/i,         // ProductCode
    /^pk_/i,               // pk_customer
    /^fk_/i,               // fk_order
  ];

  const isKeyName = keyPatterns.some(p => p.test(nameLower));

  // Cardinality-based detection (high uniqueness suggests key)
  // If cardinality is close to row count, likely a key
  const highCardinality = field.cardinality > 0; // Will refine with row count

  // Low null percent for keys
  const lowNulls = field.null_percent < 1;

  return isKeyName && lowNulls;
}

detectDateField(field: EnrichedField): boolean {
  const nameLower = field.name.toLowerCase();

  const datePatterns = [
    /date$/i,              // OrderDate
    /^date_/i,             // date_created
    /_at$/i,               // created_at
    /timestamp/i,          // timestamp
    /time$/i,              // order_time (if datetime)
  ];

  const isDateName = datePatterns.some(p => p.test(nameLower));
  const isDateType = ['date', 'datetime', 'timestamp'].includes(field.type.toLowerCase());

  return isDateName || isDateType;
}
```

### Step 5: Relationship Processing

```typescript
processRelationships(
  hints: RelationshipHint[],
  tables: EnrichedTable[]
): EnrichedRelationship[] {
  const tableMap = new Map(tables.map(t => [t.name.toLowerCase(), t]));

  return hints.map(hint => {
    const [fromTable, fromField] = hint.from.split('.');
    const [toTable, toField] = hint.to.split('.');

    const fromTableData = tableMap.get(fromTable.toLowerCase());
    const toTableData = tableMap.get(toTable.toLowerCase());

    return {
      from_table: fromTable,
      from_field: fromField,
      to_table: toTable,
      to_field: toField,
      type: hint.type,
      from_cardinality: fromTableData?.fields.find(f => f.name === fromField)?.cardinality || 0,
      to_cardinality: toTableData?.fields.find(f => f.name === toField)?.cardinality || 0,
      validated: !!(fromTableData && toTableData),
    };
  });
}
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    INPUT PROCESSOR                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Stage1Input                  QvdSampleData[]              │
│   ┌──────────────┐             ┌──────────────┐             │
│   │ tables[]     │             │ table_name   │             │
│   │ fields[]     │      +      │ row_count    │             │
│   │ types[]      │             │ fields[]     │             │
│   │ hints[]      │             │ - cardinality│             │
│   └──────────────┘             │ - null%      │             │
│          │                     │ - samples    │             │
│          │                     └──────────────┘             │
│          │                            │                     │
│          └────────────┬───────────────┘                     │
│                       ▼                                      │
│              ┌──────────────────┐                           │
│              │ MERGE & ENRICH   │                           │
│              │ • Match tables   │                           │
│              │ • Combine fields │                           │
│              │ • Detect keys    │                           │
│              │ • Detect dates   │                           │
│              └──────────────────┘                           │
│                       │                                      │
│                       ▼                                      │
│              ┌──────────────────┐                           │
│              │ EnrichedModelSpec│                           │
│              │ • tables[]       │                           │
│              │ • relationships[]│                           │
│              │ • date_fields[]  │                           │
│              └──────────────────┘                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Potential Failure Points

1. **Schema mismatch** - Stage1 JSON doesn't match expected schema
2. **Table name mismatch** - QVD table names don't match Stage1 tables
3. **Empty QVD samples** - No sample data available for some tables
4. **Invalid relationships** - Hints reference non-existent tables/fields
5. **Type conflicts** - Stage1 type differs from QVD detected type

## Mitigation Strategies

1. Validate Stage1 input with detailed error messages
2. Use case-insensitive matching, log warnings for mismatches
3. Proceed with enrichment using Stage1 data only, warn user
4. Mark relationships as `validated: false`, warn user
5. Prefer QVD type (actual data), log conflict

## Test Plan

```typescript
describe('InputProcessor', () => {
  describe('validateStage1Input', () => {
    it('should validate correct Stage1 JSON');
    it('should reject missing version');
    it('should reject missing tables array');
    it('should validate table structure');
  });

  describe('process', () => {
    it('should merge Stage1 with QVD samples');
    it('should handle missing QVD samples gracefully');
    it('should match tables case-insensitively');
  });

  describe('enrichField', () => {
    it('should add cardinality from QVD sample');
    it('should add null_percent from QVD sample');
    it('should detect key candidates');
    it('should detect date fields');
  });

  describe('detectKeyCandidate', () => {
    it('should detect *ID fields as keys');
    it('should detect *Key fields as keys');
    it('should reject fields with high null percent');
  });

  describe('detectDateField', () => {
    it('should detect *Date fields');
    it('should detect *_at fields');
    it('should detect date/datetime types');
  });

  describe('processRelationships', () => {
    it('should enrich relationships with cardinality');
    it('should mark invalid relationships');
    it('should handle missing tables');
  });
});
```

## Error Handling Strategy

| Error Type | Possible Cause | Handling Approach | Recovery |
|------------|----------------|-------------------|----------|
| `ValidationError` | Missing required field in Stage1 JSON | Throw with specific field name | User fixes input file |
| Schema Mismatch | Unexpected version or structure | Throw with version info | Update processor or input |
| Table Not Found | QVD sample has unknown table | Log warning, continue without sample | Proceed with Stage1 data only |
| Field Not Found | Relationship references missing field | Mark relationship as `validated: false` | User reviews relationships |
| Type Conflict | Stage1 type differs from QVD type | Prefer QVD type, log conflict | User can override |
| Empty Input | No tables in Stage1 JSON | Throw `EmptyInputError` | User provides valid input |
| Circular Reference | Relationship creates cycle | Detect and warn, don't block | User reviews model |

**Validation Error Messages:**
```typescript
class ValidationError extends Error {
  constructor(field: string, expected: string, received: string) {
    super(`Validation failed: ${field} expected ${expected}, got ${received}`);
    this.name = 'ValidationError';
  }
}
```

**Error Recovery Flow:**
```
1. Validate Stage1 input structure
   ├── Invalid → Throw ValidationError with details
   └── Valid → Continue
2. Match tables to QVD samples
   ├── Match found → Enrich with sample data
   └── No match → Log warning, use Stage1 data only
3. Validate relationships
   ├── Both tables exist → Mark validated: true
   └── Table missing → Mark validated: false, log warning
4. Return enriched spec (may include warnings)
```

## Performance Considerations

| Operation | Time Complexity | Space Complexity | Notes |
|-----------|-----------------|------------------|-------|
| `validateStage1Input()` | O(t × f) | O(1) | t=tables, f=fields per table |
| `process()` | O(t × f) | O(t × f) | Build enriched tables |
| `enrichTable()` | O(f) | O(f) | f = fields in table |
| `enrichField()` | O(1) | O(1) | Per-field enrichment |
| `detectKeyCandidate()` | O(p) | O(1) | p = number of patterns (~5) |
| `detectDateField()` | O(p) | O(1) | p = number of patterns (~5) |
| `processRelationships()` | O(r × t) | O(r) | r=relationships, t=tables |

**Memory Usage:**
- Stage1 input: Held in memory during processing
- QVD samples: Map of table_name → sample (~1KB per table)
- Enriched spec: ~2x size of Stage1 input
- Peak: ~3x Stage1 input size during processing

**Optimization Tips:**
1. Use Map for table lookups (O(1) vs O(n) array search)
2. Pre-compile regex patterns (store as class constants)
3. Process tables in parallel if independent (Promise.all)
4. Stream large QVD sample files instead of loading all at once
5. Cache field pattern matches (same patterns used repeatedly)

**Sample Data Limits:**
- Max 100 sample values per field
- Max 1000 rows sampled per table
- Truncate string samples at 100 chars

## Integration Points

| Component | Direction | Data Exchange | Contract |
|-----------|-----------|---------------|----------|
| Logger | IP → Logger | Processing events, warnings | `logger.warn('input_processor', ...)` |
| Orchestrator | IP ← Orch | Stage1 JSON + QVD samples | `process(stage1Json, qvdSamples)` |
| Analyzer | IP → Analyzer | EnrichedModelSpec | Output passed to Analyzer |
| File System | IP ← FS | Read Stage1 JSON file | Called by orchestrator, not directly |

**Input Contract (Stage1Input):**
```typescript
{
  version: string;              // Required, e.g., "1.0"
  tables: Stage1Table[];        // Required, at least 1 table
  relationship_hints?: RelationshipHint[];  // Optional
}

interface Stage1Table {
  name: string;                 // Required
  source_name: string;          // QVD file name
  fields: Stage1Field[];        // Required, at least 1 field
}

interface Stage1Field {
  name: string;                 // Required
  type: string;                 // Required (string, integer, date, etc.)
}
```

**Input Contract (QvdSampleData):**
```typescript
{
  table_name: string;           // Must match Stage1 table name
  row_count: number;
  fields: QvdFieldSample[];
}

interface QvdFieldSample {
  name: string;
  type: string;
  cardinality: number;
  null_percent: number;
  sample_values: (string | number | null)[];
}
```

**Output Contract (EnrichedModelSpec):**
```typescript
{
  tables: EnrichedTable[];      // Enriched with cardinality, keys, dates
  relationships: EnrichedRelationship[];  // With cardinality, validated flag
  date_fields: DateFieldInfo[]; // All detected date fields
}
```

**Event Pattern:**
```
InputProcessor does NOT emit events.
Synchronous processing, returns result or throws.
Warnings collected in result object, not emitted.
```

## Risk Mitigation & Contingency

| Risk | Impact (days) | Probability | Contingency | Trigger |
|------|--------------|-------------|-------------|---------|
| Stage 1 JSON schema changes unexpectedly | 2 | Medium (35%) | Implement schema version detection; maintain backward compatibility for v1.0 | JSON validation fails on previously working input |
| QVD sample data unavailable or corrupted | 1 | Medium (40%) | Proceed with enrichment using heuristics only; mark spec as "partially enriched" | QVD file read error or empty sample |
| Field inference produces incorrect data types | 1 | High (50%) | Allow user override of inferred types; log confidence scores for each inference | User reports wrong field type classification |
| Very large input files cause memory issues | 2 | Low (20%) | Implement streaming JSON parser; process tables in chunks | Process crashes on >100MB input file |

## Task Breakdown & Dependencies

| Task | Duration | Dependencies | Critical Path | DoD |
|------|----------|--------------|---------------|-----|
| 4.1 Implement InputProcessor class skeleton | 0.5 day | Sub-Plan 01 (Types), Sub-Plan 02 (Logger) | YES | ✓ Class compiles, ✓ Implements InputProcessor interface, ✓ Logger injected |
| 4.2 Implement Stage 1 JSON validation | 1 day | 4.1 | YES | ✓ Validates version field, ✓ Validates tables array, ✓ Clear error messages for invalid input |
| 4.3 Implement date field detection | 0.5 day | 4.1 | YES | ✓ Detects *Date, *_at patterns, ✓ Detects date/datetime types, ✓ Sets is_date_field=true |
| 4.4 Implement key candidate detection | 0.5 day | 4.1 | YES | ✓ Detects *ID, *Key, *Code patterns, ✓ Considers cardinality, ✓ Sets is_key_candidate=true |
| 4.5 Implement relationship inference from naming | 0.5 day | 4.4 | NO | ✓ Matches FK fields to PKs, ✓ Infers cardinality (1:M, M:1), ✓ Creates RelationshipHint[] |
| 4.6 Implement QVD sample integration | 1 day | 4.1 | NO | ✓ Case-insensitive table matching, ✓ Merges cardinality/nulls, ✓ Logs warnings for mismatches |
| 4.7 Implement data type inference from samples | 0.5 day | 4.6 | NO | ✓ Prefers QVD type over Stage1, ✓ Logs type conflicts, ✓ Handles null samples gracefully |
| 4.8 Implement process() orchestration | 0.5 day | 4.2-4.7 | YES | ✓ Returns EnrichedModelSpec, ✓ All tables enriched, ✓ date_fields populated |
| 4.9 Write unit tests | 1 day | 4.1-4.8 | YES | ✓ >90% coverage, ✓ Edge cases tested, ✓ Invalid input handled |
| 4.10 Write tests with Olist dataset | 0.5 day | 4.9 | YES | ✓ All 9 Olist tables processed, ✓ Keys detected correctly, ✓ Dates identified correctly |

**Critical Path:** 4.1 → 4.2 → 4.3 → 4.4 → 4.8 → 4.9 → 4.10 (5 days)

## Resource Requirements

| Resource | Type | Availability | Skills Required |
|----------|------|--------------|-----------------|
| TypeScript Developer | Human | 1 FTE for 5 days | JSON schema validation, regex patterns, data type inference |
| Logger Service | Component | After Sub-Plan 02 | N/A |
| Olist dataset specification | Data | docs/Olist_Tables_Summary.csv | N/A |
| Sample Stage 1 JSON files | Data | Create from Olist spec | N/A |
| QVD sample files (optional) | Data | Generate or mock | N/A |

## Testing Strategy

| Phase | Coverage | Tools | Acceptance Criteria | Rollback Plan |
|-------|----------|-------|---------------------|---------------|
| Unit Testing | All validation and enrichment methods | Jest | 100% method coverage; correct handling of edge cases | N/A - core functionality |
| Schema Validation Testing | Valid/invalid JSON inputs | Jest with fixtures | All valid Olist data passes; invalid data fails with clear error | Loosen validation; add warnings instead of errors |
| Inference Accuracy Testing | Date and key detection | Jest with Olist data | >90% accuracy on Olist dataset (9 tables, 52 fields) | Lower confidence threshold; add manual override |
| Integration Testing | Full pipeline with QVD samples | Jest with mock QVD data | Enriched spec contains all expected fields | Disable QVD integration; use heuristics only |

## Communication Plan

- **Daily:** Share inference accuracy metrics; flag any false positives/negatives in key detection
- **Weekly:** Demo enriched output to Analyzer team; gather feedback on field classification
- **Escalation:** If inference accuracy falls below 80%, escalate to Tech Lead for algorithm review
- **Change Requests:** Changes to enrichment logic require updated test fixtures and documentation

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

- [ ] Stage1 JSON validated correctly
- [ ] QVD samples merged with table metadata
- [ ] Key candidates detected with good accuracy
- [ ] Date fields detected correctly
- [ ] Relationships enriched with cardinality
- [ ] Graceful handling of missing data
- [ ] All tests passing
