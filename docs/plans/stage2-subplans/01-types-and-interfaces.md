# Sub-Plan 01: Types & Interfaces

> **Part of:** Data Model Builder (Stage 2) Implementation
> **Dependencies:** None (First task)
> **Output:** `src/model-builder/types.ts`

---

## Goal

Define all TypeScript interfaces and types for the Data Model Builder system, establishing the contract between all components.

## Context

This is based on the design document `docs/plans/2026-01-20-data-model-builder-design.md` which defines:
- 6 build stages (A-F) with user approval
- Star/Snowflake/Link Table/Concatenated model types
- Claude builds scripts, Gemini reviews
- Structured JSON issue reporting
- Session state persistence

## Files to Create

| File | Purpose |
|------|---------|
| `src/model-builder/types.ts` | All type definitions |

## Type Categories

### 1. Core Enums

```typescript
// Model types
type ModelType = 'star_schema' | 'snowflake' | 'link_table' | 'concatenated';

// Table classifications
type TableClassification = 'fact' | 'dimension' | 'link' | 'calendar';

// Build stages
type BuildStage = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

// Issue severity
type IssueSeverity = 'critical' | 'warning' | 'info';

// Issue category
type IssueCategory = 'syntax' | 'anti-pattern' | 'best-practice' | 'model-size';

// Log levels
type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';

// [ADDED per Gemini] Field semantic types
type FieldSemanticType = 'key' | 'measure' | 'dimension' | 'attribute' | 'date' | 'timestamp';

// [ADDED per Gemini] Relationship types (explicit)
type RelationshipType = 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
```

### 2. Input Interfaces (Stage 1 → Stage 2)

```typescript
interface Stage1Input {
  version: string;
  source: string;
  parsed_at: string;
  tables: Stage1Table[];
  relationship_hints: RelationshipHint[];
}

interface Stage1Table {
  name: string;
  source_name: string;
  fields: Stage1Field[];
}

interface Stage1Field {
  name: string;
  type: 'string' | 'integer' | 'decimal' | 'date' | 'datetime' | 'boolean';
}

interface RelationshipHint {
  from: string;  // "Table.Field"
  to: string;    // "Table.Field"
  type: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
}
```

### 3. QVD Sample Data

```typescript
interface QvdSampleData {
  table_name: string;
  row_count: number;
  fields: QvdFieldSample[];
}

interface QvdFieldSample {
  name: string;
  type: string;
  cardinality: number;
  null_percent: number;
  sample_values: string[];
  min_value?: string | number;
  max_value?: string | number;
}
```

### 4. Enriched Model Spec

```typescript
interface EnrichedModelSpec {
  tables: EnrichedTable[];
  relationships: EnrichedRelationship[];
  date_fields: DateFieldInfo[];
}

interface EnrichedTable {
  name: string;
  source_name: string;
  row_count: number;
  fields: EnrichedField[];
  classification?: TableClassification;
  classification_confidence?: number;
}

interface EnrichedField {
  name: string;
  type: string;
  cardinality: number;
  null_percent: number;
  is_key_candidate: boolean;
  is_date_field: boolean;
  sample_values: string[];
}
```

### 5. Review Types

```typescript
interface GeminiReviewRequest {
  script: string;
  model_type: ModelType;
  facts_count: number;
  dimensions_count: number;
  expected_rows: number;
}

interface GeminiReviewResponse {
  review_status: 'issues_found' | 'approved';
  score: number;
  issues: ReviewIssue[];
  summary: string;
}

interface ReviewIssue {
  issue_id: string;
  severity: IssueSeverity;
  category: IssueCategory;
  title: string;
  location: IssueLocation;
  description: string;
  recommendation: string;
  fix_example: string;
}
```

### 6. Session State

```typescript
interface ModelBuilderSession {
  session_id: string;
  project_name: string;
  created_at: string;
  updated_at: string;
  current_stage: BuildStage;
  completed_stages: BuildStage[];
  model_type: ModelType | null;
  approved_script_parts: Record<BuildStage, string>;
  pending_tables: string[];
  gemini_reviews: GeminiReviewResponse[];
  user_id?: string;
}
```

### 7. Logging

```typescript
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  session_id: string;
  stage?: BuildStage;
  component: string;
  action: string;
  details: Record<string, unknown>;
  user_id?: string;
}

interface AuditEntry {
  audit_type: string;
  timestamp: string;
  session_id: string;
  user_id?: string;
  action: string;
  script_hash?: string;
  gemini_score?: number;
  issues_fixed?: number;
}
```

### 8. Output Interfaces (Stage 2 → Stage 3)

```typescript
interface Stage2Output {
  version: string;
  model_type: ModelType;
  created_at: string;
  facts: FactDefinition[];
  dimensions: DimensionDefinition[];
  calendars: CalendarDefinition[];
  relationships: OutputRelationship[];
  gemini_review: {
    score: number;
    status: 'approved' | 'approved_with_warnings';
    issues_fixed: number;
  };
}
```

### 9. [ADDED per Gemini] Transformation & Script Types

```typescript
/**
 * Data transformation rule for cleansing/manipulation
 */
interface TransformationRule {
  field: string;
  type: 'trim' | 'uppercase' | 'lowercase' | 'replace' | 'format_date' | 'custom';
  params?: Record<string, string>;
  expression?: string;  // For custom transformations
}

/**
 * Reusable script fragment
 */
interface ScriptSnippet {
  id: string;
  name: string;
  description: string;
  code: string;
  placeholders: string[];  // Variables to replace: ${tableName}, ${fieldName}
  category: 'calendar' | 'incremental' | 'qualify' | 'store' | 'custom';
}

/**
 * Data load options (incremental, filters, etc.)
 */
interface DataLoadOptions {
  incremental: {
    enabled: boolean;
    strategy: 'by_date' | 'by_id' | 'full_reload';
    field?: string;
    last_value?: string | number;
  };
  where_clause?: string;
  limit?: number;
  distinct?: boolean;
}
```

### 10. [ADDED per Gemini] Qlik Constraints

```typescript
/**
 * Qlik-specific constraints and limits
 */
const QLIK_CONSTRAINTS = {
  MAX_FIELD_NAME_LENGTH: 128,
  MAX_TABLE_NAME_LENGTH: 128,
  RESERVED_WORDS: ['IF', 'THEN', 'ELSE', 'AND', 'OR', 'NOT', 'LOAD', 'FROM', 'WHERE'],
  INVALID_CHARS: ['/', '\\', ':', '*', '?', '"', '<', '>', '|'],
} as const;

/**
 * Field validation result
 */
interface FieldValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggested_name?: string;  // If name needs fixing
}
```

### 11. [ADDED per Gemini] Type Versioning

```typescript
/**
 * Type definition version for compatibility tracking
 */
const TYPE_VERSION = {
  major: 1,
  minor: 0,
  patch: 0,
  toString: () => `${TYPE_VERSION.major}.${TYPE_VERSION.minor}.${TYPE_VERSION.patch}`,
} as const;

/**
 * Version check for Stage handoff
 */
interface VersionedPayload {
  type_version: string;
  payload_type: 'Stage1Input' | 'Stage2Output' | 'ModelBuilderSession';
}
```

## Validation Rules

- All interfaces must be exported
- All optional fields marked with `?`
- Enums/unions for restricted values
- JSDoc comments for ALL types (not just complex)
- [ADDED] Validate field names against QLIK_CONSTRAINTS
- [ADDED] Include type_version in all stage handoffs

## Test Plan

```typescript
// src/__tests__/model-builder/types.test.ts
describe('Types', () => {
  it('should allow valid ModelType values', () => {
    const valid: ModelType = 'star_schema';
    expect(['star_schema', 'snowflake', 'link_table', 'concatenated']).toContain(valid);
  });

  it('should validate Stage1Input structure', () => {
    const input: Stage1Input = {
      version: '1.0',
      source: 'test.docx',
      parsed_at: '2026-01-20T10:00:00Z',
      tables: [],
      relationship_hints: [],
    };
    expect(input.version).toBeDefined();
  });
});
```

## Potential Failure Points

1. **Missing type exports** - Forgetting to export a type will break imports
2. **Inconsistent naming** - Using `table_name` vs `tableName` inconsistently
3. **Optional vs required fields** - Getting this wrong causes runtime errors
4. **Circular imports** - If types import from other modules that import types

## Success Criteria

- [ ] All types defined and exported
- [ ] Types compile without errors
- [ ] Basic type tests pass
- [ ] No circular dependencies

---

## Gemini Review

**Date:** 2026-01-20
**Status:** ✅ APPROVED (Final)

| Metric | Round 1 | Round 2 (Final) |
|--------|---------|-----------------|
| Completeness | 8/10 | **9/10** |
| Correctness | 9/10 | **9/10** |

### Round 1 - Missing Types (FIXED)

- `TransformationRule` - for data cleansing/manipulation
- `ScriptSnippet` - reusable script fragments
- `DataLoadOptions` - options for loading data (e.g., incremental load)
- `FieldSemanticType` - e.g., measure, dimension, attribute, date, key
- `RelationshipType` - e.g., one-to-many, many-to-many, one-to-one

### Additional Failure Points from Gemini

1. Type definitions not reflecting Qlik's data model limitations (field name length, allowed characters)
2. Lack of versioning for type definitions
3. Insufficient documentation for each type
4. Over-reliance on optional fields
5. Lack of clear ownership and maintenance plan

### Recommendations from Gemini

1. Establish clear naming convention and enforce consistently
2. Prefer required fields with default values when appropriate
3. Document each type definition clearly
4. Consider using discriminated unions for `ReviewIssue`
5. Add validation logic to ensure data conforms to types

### Round 2 - Final Notes (Optional Improvements)

These are nice-to-have for future iterations:
- Add `DataType` enum for underlying data types
- Add `isNullable` property on Field types
- Add `DataQualityCheck` interface for validation rule definitions
- Add `SourceSystem` type to track data origin

**Gemini Summary:** "The core structure is solid and well-defined. The remaining suggestions are more about fine-tuning and adding robustness."
