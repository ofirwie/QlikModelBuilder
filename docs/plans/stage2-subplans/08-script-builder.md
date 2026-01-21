# Sub-Plan 08: Script Builder

> **Part of:** Data Model Builder (Stage 2) Implementation
> **Dependencies:** Sub-Plan 01 (Types), Sub-Plan 02 (Logger), Sub-Plan 05 (Analyzer)
> **Output:** `src/model-builder/services/script-builder.ts`

---

## Goal

Generate Qlik Load Scripts in staged increments (A-F) with user approval at each stage, supporting all model types.

## Context

From design document (sections 3.4-3.6, 5.1-5.3):
- 6 build stages: Configuration, Dimensions, Facts, Link Tables, Calendars, STORE
- User approves each stage before proceeding
- QUALIFY * default, UNQUALIFY only for keys
- Calendar per date field, multilingual support

## Files to Create

| File | Purpose |
|------|---------|
| `src/model-builder/services/script-builder.ts` | Script generation implementation |
| `src/model-builder/templates/calendar.qvs` | Calendar template |
| `src/__tests__/model-builder/script-builder.test.ts` | Unit tests |

## Key Interfaces

```typescript
interface ScriptBuilder {
  // Stage building
  buildStage(stage: BuildStage, context: BuildContext): StageScript;

  // Full script assembly
  assembleFullScript(approvedStages: Record<BuildStage, string>): string;

  // Template application
  buildDimensionTable(table: EnrichedTable): string;
  buildFactTable(table: EnrichedTable, dimensions: EnrichedTable[]): string;
  buildLinkTable(facts: EnrichedTable[], linkFields: string[]): string;
  buildCalendar(dateField: DateFieldInfo, language: string): string;

  // Validation
  validateScript(script: string): ScriptValidationResult;
}

interface BuildContext {
  session: ModelBuilderSession;
  spec: EnrichedModelSpec;
  analysis: AnalysisResult;
  config: BuildConfig;
}

interface BuildConfig {
  project_name: string;
  qvd_path: string;
  calendar_language: string;
  use_autonumber: boolean;
}

interface StageScript {
  stage: BuildStage;
  script: string;
  tables_included: string[];
  estimated_lines: number;
}
```

## Implementation Steps

### Step 1: Stage A - Configuration

```typescript
buildStageA(context: BuildContext): StageScript {
  const { config, analysis } = context;

  const script = `
//=============================================================
// Project: ${config.project_name}
// Created: ${new Date().toISOString().split('T')[0]} by QlikModelBuilder
// Model Type: ${analysis.model_recommendation.recommended_model}
//=============================================================

//-------------------------------------------------------------
// SECTION 0: QUALIFY ALL (Synthetic Key Prevention)
//-------------------------------------------------------------
QUALIFY *;

//-------------------------------------------------------------
// SECTION 1: Variables & Configuration
//-------------------------------------------------------------
SET vPathQVD = '${config.qvd_path}';
SET vPathDB = 'lib://DB/';
SET vReloadDate = Today();
SET vReloadTime = Now();
SET vCalendarLanguage = '${config.calendar_language}';
`.trim();

  return {
    stage: 'A',
    script,
    tables_included: [],
    estimated_lines: script.split('\n').length,
  };
}
```

### Step 2: Stage B - Dimensions

```typescript
buildStageB(context: BuildContext): StageScript {
  const dimensions = context.spec.tables.filter(t =>
    t.classification === 'dimension'
  );

  const scripts: string[] = [
    '//-------------------------------------------------------------',
    '// SECTION 2: Dimensions',
    '//-------------------------------------------------------------',
    '',
  ];

  for (const dim of dimensions) {
    scripts.push(this.buildDimensionTable(dim));
    scripts.push('');
  }

  return {
    stage: 'B',
    script: scripts.join('\n'),
    tables_included: dimensions.map(d => d.name),
    estimated_lines: scripts.length,
  };
}

buildDimensionTable(table: EnrichedTable): string {
  const tableName = `DIM_${table.name.replace(/^(dim_|dimension_)/i, '')}`;
  const pkField = table.fields.find(f => f.is_key_candidate);

  const fieldLines = table.fields.map(f => {
    if (f.is_key_candidate) {
      return `    ${f.name} AS ${f.name.replace(/ID$/i, 'Key')},    // PK`;
    }
    return `    ${f.name},`;
  });

  // Remove trailing comma from last field
  fieldLines[fieldLines.length - 1] = fieldLines[fieldLines.length - 1].replace(/,$/, '');

  return `
// ${tableName}
${tableName}:
LOAD
${fieldLines.join('\n')}
FROM [$(vPathQVD)${table.source_name}.qvd] (qvd);
`.trim();
}
```

### Step 3: Stage C - Facts

```typescript
buildStageC(context: BuildContext): StageScript {
  const facts = context.spec.tables.filter(t => t.classification === 'fact');
  const dimensions = context.spec.tables.filter(t => t.classification === 'dimension');

  const scripts: string[] = [
    '//-------------------------------------------------------------',
    '// SECTION 3: Facts',
    '//-------------------------------------------------------------',
    '',
  ];

  for (const fact of facts) {
    scripts.push(this.buildFactTable(fact, dimensions));
    scripts.push('');
  }

  return {
    stage: 'C',
    script: scripts.join('\n'),
    tables_included: facts.map(f => f.name),
    estimated_lines: scripts.length,
  };
}

buildFactTable(table: EnrichedTable, dimensions: EnrichedTable[]): string {
  const tableName = `FACT_${table.name.replace(/^(fact_)/i, '')}`;

  // Build dimension key lookup
  const dimKeys = new Map<string, string>();
  for (const dim of dimensions) {
    const pk = dim.fields.find(f => f.is_key_candidate);
    if (pk) {
      dimKeys.set(pk.name.toLowerCase(), pk.name.replace(/ID$/i, 'Key'));
    }
  }

  const fieldLines = table.fields.map(f => {
    const fieldLower = f.name.toLowerCase();

    // Check if this is a FK to a dimension
    const matchedKey = dimKeys.get(fieldLower);
    if (matchedKey) {
      return `    ${f.name} AS ${matchedKey},    // FK to DIM`;
    }

    // PK
    if (f.is_key_candidate && f.name.toLowerCase().includes(table.name.toLowerCase())) {
      return `    ${f.name} AS ${f.name.replace(/ID$/i, 'Key')},`;
    }

    return `    ${f.name},`;
  });

  fieldLines[fieldLines.length - 1] = fieldLines[fieldLines.length - 1].replace(/,$/, '');

  return `
// ${tableName}
${tableName}:
LOAD
${fieldLines.join('\n')}
FROM [$(vPathQVD)${table.source_name}.qvd] (qvd);
`.trim();
}
```

### Step 4: Stage D - Link Tables

```typescript
buildStageD(context: BuildContext): StageScript {
  const { analysis, spec } = context;

  // Only needed for link_table model type
  if (analysis.model_recommendation.recommended_model !== 'link_table') {
    return {
      stage: 'D',
      script: '// No Link Tables needed for this model type',
      tables_included: [],
      estimated_lines: 1,
    };
  }

  const facts = spec.tables.filter(t => t.classification === 'fact');

  // Find common fields between facts
  const commonFields = this.findCommonFields(facts);

  const scripts: string[] = [
    '//-------------------------------------------------------------',
    '// SECTION 4: Link Tables',
    '//-------------------------------------------------------------',
    '',
  ];

  if (commonFields.length > 0) {
    scripts.push(this.buildLinkTable(facts, commonFields));
  }

  return {
    stage: 'D',
    script: scripts.join('\n'),
    tables_included: ['LINK_Facts'],
    estimated_lines: scripts.length,
  };
}

buildLinkTable(facts: EnrichedTable[], linkFields: string[]): string {
  const fieldList = linkFields.join(', ');

  const unionParts = facts.map((fact, idx) => {
    const prefix = idx === 0 ? '' : 'Concatenate(LINK_Facts)\n';
    return `${prefix}LOAD DISTINCT ${fieldList} RESIDENT FACT_${fact.name};`;
  });

  return `
// Link Table connecting Facts
LINK_Facts:
${unionParts.join('\n\n')}

// Add link key
LOAD
    ${linkFields.join(' & \'|\' & ')} AS LinkKey,
    *
RESIDENT LINK_Facts;
DROP TABLE LINK_Facts;
RENAME TABLE LINK_Facts_1 TO LINK_Facts;
`.trim();
}
```

### Step 5: Stage E - Calendars

```typescript
buildStageE(context: BuildContext): StageScript {
  const dateFields = context.spec.date_fields;
  const language = context.config.calendar_language;

  const scripts: string[] = [
    '//-------------------------------------------------------------',
    '// SECTION 4: Calendars (Per Date Field)',
    '//-------------------------------------------------------------',
    '',
    this.getCalendarSubroutine(language),
    '',
  ];

  for (const dateField of dateFields) {
    scripts.push(`CALL CreateMasterCalendar('${dateField.field_name}', Num(MakeDate(2020,1,1)), Num(MakeDate(2030,12,31)));`);
  }

  return {
    stage: 'E',
    script: scripts.join('\n'),
    tables_included: dateFields.map(d => `DIM_${d.field_name}`),
    estimated_lines: scripts.length,
  };
}

private getCalendarSubroutine(language: string): string {
  const monthNames = language === 'HE'
    ? `Pick(Month(TempDate), 'ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר')`
    : `Pick(Month(TempDate), 'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec')`;

  return `
SUB CreateMasterCalendar(vFieldName, vMinDate, vMaxDate)

    TempCal_$(vFieldName):
    LOAD
        Date($(vMinDate) + RowNo() - 1) AS TempDate
    AUTOGENERATE $(vMaxDate) - $(vMinDate) + 1;

    DIM_$(vFieldName):
    LOAD
        TempDate AS $(vFieldName),
        Year(TempDate) AS $(vFieldName)_Year,
        Month(TempDate) AS $(vFieldName)_MonthNum,
        Date(MonthStart(TempDate), 'MMM-YYYY') AS $(vFieldName)_MonthYear,
        Day(TempDate) AS $(vFieldName)_Day,
        Week(TempDate) AS $(vFieldName)_Week,
        'Q' & Ceil(Month(TempDate)/3) AS $(vFieldName)_Quarter,
        ${monthNames} AS $(vFieldName)_MonthName
    RESIDENT TempCal_$(vFieldName);

    DROP TABLE TempCal_$(vFieldName);

END SUB
`.trim();
}
```

### Step 6: Stage F - STORE & Cleanup

```typescript
buildStageF(context: BuildContext): StageScript {
  const allTables = [
    ...context.spec.tables.filter(t => t.classification === 'dimension').map(t => `DIM_${t.name}`),
    ...context.spec.tables.filter(t => t.classification === 'fact').map(t => `FACT_${t.name}`),
    ...context.spec.date_fields.map(d => `DIM_${d.field_name}`),
  ];

  // Collect all keys to unqualify
  const allKeys = new Set<string>();
  for (const table of context.spec.tables) {
    for (const field of table.fields) {
      if (field.is_key_candidate) {
        allKeys.add(field.name.replace(/ID$/i, 'Key'));
      }
    }
  }

  const scripts: string[] = [
    '//-------------------------------------------------------------',
    '// SECTION 5: UNQUALIFY Keys Only',
    '//-------------------------------------------------------------',
    `UNQUALIFY ${[...allKeys].join(', ')};`,
    '',
    '//-------------------------------------------------------------',
    '// SECTION 6: Store to Final QVD',
    '//-------------------------------------------------------------',
  ];

  for (const tableName of allTables) {
    scripts.push(`STORE ${tableName} INTO [$(vPathQVD)Final/${tableName}.qvd] (qvd);`);
  }

  return {
    stage: 'F',
    script: scripts.join('\n'),
    tables_included: allTables,
    estimated_lines: scripts.length,
  };
}
```

## Stage Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    SCRIPT BUILDER                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Stage A: Configuration                                     │
│   ┌──────────────────────────────────────────┐              │
│   │ QUALIFY *, Variables, Settings           │ → Approve    │
│   └──────────────────────────────────────────┘              │
│                       ↓                                      │
│   Stage B: Dimensions (each table)                          │
│   ┌──────────────────────────────────────────┐              │
│   │ DIM_Customers, DIM_Products, ...         │ → Approve    │
│   └──────────────────────────────────────────┘              │
│                       ↓                                      │
│   Stage C: Facts (each table)                               │
│   ┌──────────────────────────────────────────┐              │
│   │ FACT_Orders, FACT_Returns, ...           │ → Approve    │
│   └──────────────────────────────────────────┘              │
│                       ↓                                      │
│   Stage D: Link Tables (if needed)                          │
│   ┌──────────────────────────────────────────┐              │
│   │ LINK_Facts (for N:M relationships)       │ → Approve    │
│   └──────────────────────────────────────────┘              │
│                       ↓                                      │
│   Stage E: Calendars (per date field)                       │
│   ┌──────────────────────────────────────────┐              │
│   │ DIM_OrderDate, DIM_ShipDate, ...         │ → Approve    │
│   └──────────────────────────────────────────┘              │
│                       ↓                                      │
│   Stage F: STORE + Cleanup                                  │
│   ┌──────────────────────────────────────────┐              │
│   │ UNQUALIFY keys, STORE all tables         │ → Approve    │
│   └──────────────────────────────────────────┘              │
│                       ↓                                      │
│               COMPLETE SCRIPT                                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Potential Failure Points

1. **Field naming conflicts** - Same field name in multiple tables
2. **Missing key detection** - Can't identify PK/FK relationships
3. **Calendar date range** - Dates outside default range
4. **Large scripts** - Token limit exceeded for review
5. **Invalid Qlik syntax** - Generated code has errors

## Mitigation Strategies

1. QUALIFY * prevents conflicts, only UNQUALIFY explicit keys
2. Use name patterns + cardinality heuristics, allow user override
3. Make date range configurable, detect from data if possible
4. Chunk scripts by table for large models
5. Validate syntax patterns before output, Gemini will catch issues

## Test Plan

```typescript
describe('ScriptBuilder', () => {
  describe('buildStageA', () => {
    it('should generate QUALIFY and variables');
    it('should include project name and date');
    it('should set correct QVD path');
  });

  describe('buildDimensionTable', () => {
    it('should prefix with DIM_');
    it('should convert ID to Key');
    it('should include all fields');
    it('should use correct QVD path');
  });

  describe('buildFactTable', () => {
    it('should prefix with FACT_');
    it('should add FK comments');
    it('should link to dimension keys');
  });

  describe('buildCalendar', () => {
    it('should generate calendar subroutine');
    it('should support multiple languages');
    it('should create calendar per date field');
  });

  describe('buildStageF', () => {
    it('should UNQUALIFY all keys');
    it('should STORE all tables');
    it('should use Final/ path');
  });

  describe('assembleFullScript', () => {
    it('should combine all stages in order');
    it('should produce valid Qlik syntax');
  });
});
```

## Error Handling Strategy

| Error Type | Possible Cause | Handling Approach | Recovery |
|------------|----------------|-------------------|----------|
| Missing Context | Build called without analysis | Throw `BuildContextError` | Complete analysis first |
| Empty Tables | No tables for current stage | Generate comment, skip stage content | Proceed to next stage |
| Invalid Field Names | Special characters in field names | Escape with brackets `[field name]` | Auto-escape |
| Duplicate Keys | Same key name in multiple tables | Prefix with table name | Log warning |
| Missing Key | Table has no key candidate | Generate warning, omit key logic | User adds key manually |
| Calendar Conflict | Date field shares name with table | Suffix calendar with `_Cal` | Auto-rename |
| Path Not Found | QVD path variable undefined | Use placeholder, warn user | User sets path |

**Field Name Escaping:**
```typescript
function escapeFieldName(name: string): string {
  // Qlik requires brackets for special characters
  if (/[\s\-\.\(\)\[\]\/\\]/.test(name) || /^\d/.test(name)) {
    return `[${name}]`;
  }
  return name;
}
```

**Error Recovery Flow:**
```
1. Validate build context
   ├── Missing session/spec/analysis → Throw error
   └── Valid → Continue
2. Build stage
   ├── Stage has tables → Generate script
   └── Stage empty → Generate comment placeholder
3. Validate generated script
   ├── Syntax check passes → Return script
   └── Issues found → Log warning, return with comments
4. Return StageScript result
```

## Performance Considerations

| Operation | Time Complexity | Space Complexity | Notes |
|-----------|-----------------|------------------|-------|
| `buildStage()` | O(t × f) | O(t × f) | t=tables, f=fields |
| `buildDimensionTable()` | O(f) | O(f) | f = fields in table |
| `buildFactTable()` | O(f × d) | O(f) | d = dimensions for key lookup |
| `buildLinkTable()` | O(t × f) | O(f) | t = fact tables |
| `buildCalendar()` | O(1) | O(1) | Static template |
| `assembleFullScript()` | O(s) | O(s) | s = total script size |
| Template string ops | O(n) | O(n) | n = output length |

**Memory Usage:**
- Script buffers: ~1KB per table (average)
- Calendar template: ~2KB per date field
- Full script: Sum of all stages
- Peak: 2x full script during assembly

**Optimization Tips:**
1. Use array join instead of string concatenation
2. Pre-build static parts (header, calendar template)
3. Cache dimension key lookups in Map
4. Generate scripts lazily (on demand per stage)
5. Use template literals with tagged templates for escaping

**Script Size Estimates:**
| Component | Lines (approx) |
|-----------|----------------|
| Stage A (Config) | 15-25 |
| Per Dimension Table | 10-30 |
| Per Fact Table | 15-40 |
| Link Table | 20-50 |
| Per Calendar | 25-35 |
| Stage F (Store) | 5 + tables |

## Integration Points

| Component | Direction | Data Exchange | Contract |
|-----------|-----------|---------------|----------|
| Logger | SB → Logger | Stage builds, warnings | `logger.info('script_builder', ...)` |
| Orchestrator | SB ← Orch | BuildContext | `buildStage(stage, context)` |
| Analyzer | SB ← An | Classification results | Via BuildContext.analysis |
| Session Manager | SB → SM | Via Orch for approved scripts | Orch calls SM.approveStage |

**Input Contract (BuildContext):**
```typescript
{
  session: ModelBuilderSession;
  spec: EnrichedModelSpec;
  analysis: AnalysisResult;
  config: BuildConfig;
}

interface BuildConfig {
  project_name: string;
  qvd_path: string;          // e.g., 'lib://QVD/'
  calendar_language: string; // 'EN' | 'HE'
  use_autonumber: boolean;   // For Link Table keys
}
```

**Output Contract (StageScript):**
```typescript
{
  stage: BuildStage;         // A-F
  script: string;            // Generated Qlik script
  tables_included: string[]; // Table names in this stage
  estimated_lines: number;
}
```

**Stage Output Examples:**
```qlik
// Stage A Output
QUALIFY *;
SET vPathQVD = 'lib://QVD/';

// Stage B Output
DIM_Customer:
LOAD CustomerID AS CustomerKey, CustomerName, ...
FROM [$(vPathQVD)Customer.qvd] (qvd);

// Stage F Output
UNQUALIFY CustomerKey, ProductKey;
STORE DIM_Customer INTO [...] (qvd);
```

**Event Pattern:**
```
ScriptBuilder does NOT emit events.
Synchronous script generation.
Returns complete StageScript object.
```

## Risk Mitigation & Contingency

| Risk | Impact (days) | Probability | Contingency | Trigger |
|------|--------------|-------------|-------------|---------|
| Generated Qlik script has syntax errors | 2 | High (50%) | Implement syntax validation; add Gemini review as safety net | Qlik load fails with syntax error |
| Field naming conflicts cause synthetic keys | 1 | Medium (40%) | Enforce QUALIFY * pattern; auto-prefix ambiguous fields | Qlik reports synthetic key warning |
| Calendar generation fails for non-standard date formats | 1 | Medium (35%) | Add date format detection; allow user to specify format | Calendar shows invalid dates |
| Script exceeds Qlik complexity limits | 1 | Low (20%) | Split into multiple load scripts; warn user before generating | Script execution timeout or memory error |

## Task Breakdown & Dependencies

| Task | Duration | Dependencies | Critical Path | DoD |
|------|----------|--------------|---------------|-----|
| 8.1 Implement ScriptBuilder class skeleton | 0.5 day | Sub-Plan 01 (Types), Sub-Plan 02 (Logger), Sub-Plan 05 (Analyzer) | YES | ✓ Class compiles, ✓ Implements ScriptBuilder interface, ✓ buildStage() dispatches correctly |
| 8.2 Implement Stage A (Configuration) | 0.5 day | 8.1 | YES | ✓ QUALIFY * statement, ✓ Variables defined, ✓ Project header with date |
| 8.3 Implement Stage B (Dimensions) | 1 day | 8.2 | YES | ✓ DIM_ prefix applied, ✓ ID→Key conversion, ✓ QVD path variable used |
| 8.4 Implement Stage C (Facts) | 1 day | 8.3 | YES | ✓ FACT_ prefix applied, ✓ FK comments added, ✓ Dimension key links correct |
| 8.5 Implement Stage D (Link Tables) | 1 day | 8.4 | NO | ✓ LINK_Facts created when needed, ✓ LinkKey generated, ✓ Concatenate syntax correct |
| 8.6 Implement Stage E (Calendars) | 1 day | 8.4 | NO | ✓ Subroutine defined, ✓ One calendar per date field, ✓ Year/Month/Day fields generated |
| 8.7 Implement Stage F (STORE & Cleanup) | 0.5 day | 8.3, 8.4 | YES | ✓ UNQUALIFY keys only, ✓ STORE all tables, ✓ Final/ path used |
| 8.8 Create calendar template (Hebrew/English) | 0.5 day | 8.6 | NO | ✓ Hebrew month names correct, ✓ English month names correct, ✓ Language configurable |
| 8.9 Implement assembleFullScript | 0.5 day | 8.2-8.7 | YES | ✓ Stages combined in order, ✓ Proper section separators, ✓ No duplicate statements |
| 8.10 Write unit tests | 1.5 days | 8.1-8.9 | YES | ✓ All 6 stages tested, ✓ Valid Qlik syntax verified, ✓ >90% coverage |
| 8.11 Test with Olist dataset | 0.5 day | 8.10 | YES | ✓ Script generates for all 9 tables, ✓ No syntax errors, ✓ Keys linked correctly |

**Critical Path:** 8.1 → 8.2 → 8.3 → 8.4 → 8.7 → 8.9 → 8.10 → 8.11 (6.5 days)

## Resource Requirements

| Resource | Type | Availability | Skills Required |
|----------|------|--------------|-----------------|
| TypeScript Developer | Human | 1 FTE for 7 days | Template string manipulation, Qlik script syntax |
| Qlik Script Expert | Human | Consultation (0.5 day) | Review generated script patterns |
| Analyzer Component | Component | After Sub-Plan 05 | N/A |
| Logger Service | Component | After Sub-Plan 02 | N/A |
| Olist enriched specification | Data | After Sub-Plan 04 | N/A |
| Qlik syntax reference | Data | Qlik Help documentation | N/A |

## Testing Strategy

| Phase | Coverage | Tools | Acceptance Criteria | Rollback Plan |
|-------|----------|-------|---------------------|---------------|
| Unit Testing | All stage builders | Jest | 100% method coverage; valid Qlik syntax patterns | N/A - core functionality |
| Syntax Validation Testing | Generated scripts | Qlik script validator (if available) | No syntax errors in generated scripts | Manual syntax review |
| Integration Testing | Full 6-stage assembly | Jest with Olist data | Complete script generates for Olist (9 tables) | Build stages individually |
| End-to-End Testing | Load script in Qlik | Manual Qlik Sense test | Script loads without errors; correct data model | Revert to simpler script template |

## Communication Plan

- **Daily:** Share generated script samples; flag any Qlik syntax questions for expert review
- **Weekly:** Demo generated scripts to Qlik expert; incorporate feedback on best practices
- **Escalation:** If generated scripts fail in Qlik >3 times, pause development and conduct syntax audit
- **Change Requests:** Template changes require Qlik expert sign-off and full regression test

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

- [ ] All 6 stages generate correct Qlik syntax
- [ ] Dimension tables correctly formatted
- [ ] Fact tables link to dimensions correctly
- [ ] Link tables created when needed
- [ ] Calendars generated per date field
- [ ] STORE statements for all tables
- [ ] Multilingual calendar support
- [ ] All tests passing
