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

## Risk Mitigation & Contingency

| Risk | Impact (days) | Probability | Contingency | Trigger |
|------|--------------|-------------|-------------|---------|
| Type definitions don't cover all Qlik edge cases | 2 | Medium (40%) | Add additional types iteratively as discovered during Script Builder implementation | First script generation fails due to missing type |
| Circular import dependencies between type modules | 1 | Low (20%) | Consolidate all types in single file, use barrel exports | TypeScript compiler error on circular reference |
| Breaking changes in type structure during development | 3 | Medium (35%) | Implement versioning early (TYPE_VERSION constant), maintain backward compatibility | Downstream components fail after type change |
| Type validation overhead impacts performance | 1 | Low (15%) | Use compile-time validation only, avoid runtime type guards for hot paths | Profiling shows >5ms per validation |

## Task Breakdown & Dependencies

| Task | Duration | Dependencies | Critical Path | DoD |
|------|----------|--------------|---------------|-----|
| 1.1 Define core enums (ModelType, BuildStage, etc.) | 0.5 day | None | YES | ✓ All 6 enums defined, ✓ Exported from types.ts, ✓ JSDoc comments on each |
| 1.2 Define input interfaces (Stage1Input, QvdSampleData) | 0.5 day | 1.1 | YES | ✓ Stage1Input matches spec, ✓ QvdSampleData has all fields, ✓ Optional fields marked with ? |
| 1.3 Define enriched model interfaces | 0.5 day | 1.2 | YES | ✓ EnrichedTable/Field defined, ✓ Classification fields included, ✓ No TS errors |
| 1.4 Define review types (GeminiReviewRequest/Response) | 0.5 day | 1.1 | NO | ✓ ReviewIssue has all severity levels, ✓ IssueLocation defined, ✓ JSON serializable |
| 1.5 Define session state interfaces | 0.5 day | 1.1, 1.4 | YES | ✓ ModelBuilderSession complete, ✓ All BuildStages supported, ✓ Version tracking included |
| 1.6 Define transformation and script types | 0.5 day | 1.1 | NO | ✓ TransformationRule covers all types, ✓ ScriptSnippet has placeholders, ✓ DataLoadOptions complete |
| 1.7 Add Qlik constraints and validation types | 0.5 day | 1.1 | NO | ✓ QLIK_CONSTRAINTS constant defined, ✓ FieldValidation interface complete, ✓ Reserved words listed |
| 1.8 Write unit tests for type validation | 0.5 day | 1.1-1.7 | YES | ✓ Tests compile without errors, ✓ Type guards tested, ✓ All interfaces instantiable |
| 1.9 Code review and documentation | 0.5 day | 1.8 | YES | ✓ JSDoc on all exports, ✓ No circular imports, ✓ PR approved by reviewer |

**Critical Path:** 1.1 → 1.2 → 1.3 → 1.5 → 1.8 → 1.9 (3 days)

## Resource Requirements

| Resource | Type | Availability | Skills Required |
|----------|------|--------------|-----------------|
| Senior TypeScript Developer | Human | 1 FTE for 3 days | TypeScript generics, interface design, Qlik domain knowledge |
| TypeScript Compiler | Tool | Available | N/A |
| VS Code with TypeScript extension | Tool | Available | N/A |
| Qlik documentation access | Reference | qlik.dev | N/A |

## Testing Strategy

| Phase | Coverage | Tools | Acceptance Criteria | Rollback Plan |
|-------|----------|-------|---------------------|---------------|
| Unit Testing | 100% of exported types | Jest, ts-jest | All types compile without errors; type guards pass | Revert to previous type definitions |
| Type Inference Testing | All composite types | TypeScript compiler strict mode | No implicit `any` warnings | Add explicit type annotations |
| Integration Testing | Type usage in consumers | Manual verification | Input Processor, Analyzer can import and use types | Fix incompatible interfaces |
| Regression Testing | All types after changes | Automated CI | No breaking changes to existing consumers | Version bump with migration guide |

## Communication Plan

- **Daily:** Post type definition progress in team Slack channel; flag any interface changes that affect downstream components
- **Weekly:** Type review meeting with Script Builder and Analyzer teams to validate interface contracts
- **Escalation:** If type changes require >2 day rework in downstream components, escalate to Tech Lead for prioritization decision
- **Change Requests:** All breaking type changes require PR review from at least one downstream consumer team member

---

## Gemini Review
**Date:** 2026-01-21
**Status:** ✅ APPROVED (10/10)

| Metric | Score |
|--------|-------|
| Completeness | 10/10 |
| Correctness | 10/10 |

**Review Notes:** All criteria met including Definition of Done for each task.
