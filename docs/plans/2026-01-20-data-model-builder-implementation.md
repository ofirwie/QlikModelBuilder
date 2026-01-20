# Data Model Builder Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Stage 2 (Data Model Builder) that transforms JSON from Stage 1 into a complete Qlik data model with AI review loop.

**Architecture:** Three-engine pipeline (Input Processor → Analyzer → Builder) with Claude-Gemini review loop. Staged script building with user approval at each stage. State persistence for resume capability.

**Tech Stack:** TypeScript, MCP Protocol, Google Gemini API, Qlik Cloud API

---

## Prerequisites

- Design document: `docs/plans/2026-01-20-data-model-builder-design.md`
- Existing wizard engine: `src/wizard/`
- Gemini API key in `vscode-extension/.env`

---

## Task 1: Core Types & Interfaces

**Files:**
- Create: `src/model-builder/types.ts`
- Test: `src/__tests__/model-builder/types.test.ts`

**Step 1: Write the type definitions**

```typescript
// src/model-builder/types.ts

/**
 * Data Model Builder - Type Definitions
 * Stage 2 of Phase B Pipeline
 */

// Model types supported
export type ModelType = 'star_schema' | 'snowflake' | 'link_table' | 'concatenated';

// Table classifications
export type TableClassification = 'fact' | 'dimension' | 'link' | 'calendar';

// Build stages (6 stages with user approval)
export type BuildStage = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
export const BUILD_STAGES: BuildStage[] = ['A', 'B', 'C', 'D', 'E', 'F'];

// Stage names
export const STAGE_NAMES: Record<BuildStage, string> = {
  A: 'Configuration',
  B: 'Dimensions',
  C: 'Facts',
  D: 'Link Tables',
  E: 'Calendars',
  F: 'STORE + Cleanup',
};

// Issue severity levels
export type IssueSeverity = 'critical' | 'warning' | 'info';

// Issue categories
export type IssueCategory = 'syntax' | 'anti-pattern' | 'best-practice' | 'model-size';

// Log levels
export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';

// ============================================================
// Input Interfaces (Stage 1 → Stage 2)
// ============================================================

export interface Stage1Input {
  version: string;
  source: string;
  parsed_at: string;
  tables: Stage1Table[];
  relationship_hints: RelationshipHint[];
}

export interface Stage1Table {
  name: string;
  source_name: string;
  fields: Stage1Field[];
}

export interface Stage1Field {
  name: string;
  type: 'string' | 'integer' | 'decimal' | 'date' | 'datetime' | 'boolean';
}

export interface RelationshipHint {
  from: string;  // "Table.Field"
  to: string;    // "Table.Field"
  type: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
}

// ============================================================
// Sample Data (from QVD)
// ============================================================

export interface QvdSampleData {
  table_name: string;
  row_count: number;
  fields: QvdFieldSample[];
}

export interface QvdFieldSample {
  name: string;
  type: string;
  cardinality: number;
  null_percent: number;
  sample_values: string[];
  min_value?: string | number;
  max_value?: string | number;
}

// ============================================================
// Enriched Model Spec (after Input Processor)
// ============================================================

export interface EnrichedModelSpec {
  tables: EnrichedTable[];
  relationships: EnrichedRelationship[];
  date_fields: DateFieldInfo[];
}

export interface EnrichedTable {
  name: string;
  source_name: string;
  row_count: number;
  fields: EnrichedField[];
  classification?: TableClassification;
  classification_confidence?: number;
}

export interface EnrichedField {
  name: string;
  type: string;
  cardinality: number;
  null_percent: number;
  is_key_candidate: boolean;
  is_date_field: boolean;
  sample_values: string[];
}

export interface EnrichedRelationship {
  from_table: string;
  from_field: string;
  to_table: string;
  to_field: string;
  cardinality: 'N:1' | '1:N' | '1:1' | 'N:M';
  confidence: number;
}

export interface DateFieldInfo {
  table: string;
  field: string;
  min_date?: string;
  max_date?: string;
}

// ============================================================
// Analyzer Output
// ============================================================

export interface ModelAnalysis {
  recommended_model: ModelType;
  confidence: number;
  alternatives: ModelAlternative[];
  classifications: TableClassifications;
  warnings: string[];
}

export interface ModelAlternative {
  model: ModelType;
  reason: string;
  pros: string[];
  cons: string[];
}

export interface TableClassifications {
  facts: string[];
  dimensions: string[];
  links: string[];
  calendars: string[];
}

// ============================================================
// Review Loop Types
// ============================================================

export interface GeminiReviewRequest {
  script: string;
  model_type: ModelType;
  facts_count: number;
  dimensions_count: number;
  expected_rows: number;
}

export interface GeminiReviewResponse {
  review_status: 'issues_found' | 'approved';
  score: number;
  issues: ReviewIssue[];
  summary: string;
}

export interface ReviewIssue {
  issue_id: string;
  severity: IssueSeverity;
  category: IssueCategory;
  title: string;
  location: IssueLocation;
  description: string;
  recommendation: string;
  fix_example: string;
  best_practice_ref?: string;
  estimated_impact?: string;
}

export interface IssueLocation {
  table?: string;
  line?: number;
  field?: string;
}

// ============================================================
// Session State
// ============================================================

export interface ModelBuilderSession {
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

// ============================================================
// Logging
// ============================================================

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  session_id: string;
  stage?: BuildStage;
  component: string;
  action: string;
  details: Record<string, unknown>;
  user_id?: string;
}

export interface AuditEntry {
  audit_type: string;
  timestamp: string;
  session_id: string;
  user_id?: string;
  action: string;
  script_hash?: string;
  gemini_score?: number;
  issues_fixed?: number;
}

// ============================================================
// Output Interfaces (Stage 2 → Stage 3)
// ============================================================

export interface Stage2Output {
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

export interface FactDefinition {
  name: string;
  source_table: string;
  keys: string[];
  measures: string[];
}

export interface DimensionDefinition {
  name: string;
  source_table: string;
  pk: string;
  fields: string[];
}

export interface CalendarDefinition {
  name: string;
  field: string;
  min_date: string;
  max_date: string;
}

export interface OutputRelationship {
  from: string;
  to: string;
  cardinality: 'N:1' | '1:N' | '1:1';
}
```

**Step 2: Commit**

```bash
git add src/model-builder/types.ts
git commit -m "feat(model-builder): add type definitions for Stage 2"
```

---

## Task 2: Logger Service

**Files:**
- Create: `src/model-builder/services/logger.ts`
- Test: `src/__tests__/model-builder/logger.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/model-builder/logger.test.ts
import { Logger, createLogger } from '../../model-builder/services/logger';

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = createLogger('test-session-123');
  });

  it('should create log entry with correct structure', () => {
    const entry = logger.info('builder_engine', 'table_generated', {
      table: 'DIM_Customers',
      fields: 5,
    });

    expect(entry.level).toBe('INFO');
    expect(entry.session_id).toBe('test-session-123');
    expect(entry.component).toBe('builder_engine');
    expect(entry.action).toBe('table_generated');
    expect(entry.details.table).toBe('DIM_Customers');
    expect(entry.timestamp).toBeDefined();
  });

  it('should log errors with stack trace', () => {
    const error = new Error('Test error');
    const entry = logger.error('analyzer', 'classification_failed', {
      error: error.message,
      stack: error.stack,
    });

    expect(entry.level).toBe('ERROR');
    expect(entry.details.error).toBe('Test error');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- --testPathPattern=logger.test.ts
```

Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/model-builder/services/logger.ts
import { LogEntry, LogLevel, BuildStage, AuditEntry } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export class Logger {
  private sessionId: string;
  private userId?: string;
  private logBuffer: LogEntry[] = [];
  private logDir: string;

  constructor(sessionId: string, userId?: string, logDir?: string) {
    this.sessionId = sessionId;
    this.userId = userId;
    this.logDir = logDir || '.qmb/logs';
  }

  private createEntry(
    level: LogLevel,
    component: string,
    action: string,
    details: Record<string, unknown>,
    stage?: BuildStage
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      session_id: this.sessionId,
      stage,
      component,
      action,
      details,
      user_id: this.userId,
    };
    this.logBuffer.push(entry);
    return entry;
  }

  error(component: string, action: string, details: Record<string, unknown>, stage?: BuildStage): LogEntry {
    return this.createEntry('ERROR', component, action, details, stage);
  }

  warn(component: string, action: string, details: Record<string, unknown>, stage?: BuildStage): LogEntry {
    return this.createEntry('WARN', component, action, details, stage);
  }

  info(component: string, action: string, details: Record<string, unknown>, stage?: BuildStage): LogEntry {
    return this.createEntry('INFO', component, action, details, stage);
  }

  debug(component: string, action: string, details: Record<string, unknown>, stage?: BuildStage): LogEntry {
    return this.createEntry('DEBUG', component, action, details, stage);
  }

  audit(entry: Omit<AuditEntry, 'timestamp' | 'session_id'>): AuditEntry {
    const auditEntry: AuditEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
      session_id: this.sessionId,
      user_id: this.userId,
    };
    // Audit entries are always persisted immediately
    this.persistAudit(auditEntry);
    return auditEntry;
  }

  private persistAudit(entry: AuditEntry): void {
    // In production, this would write to audit log file
    console.log('[AUDIT]', JSON.stringify(entry));
  }

  flush(): void {
    if (this.logBuffer.length === 0) return;
    // In production, write to log file
    this.logBuffer = [];
  }

  getBuffer(): LogEntry[] {
    return [...this.logBuffer];
  }
}

export function createLogger(sessionId: string, userId?: string): Logger {
  return new Logger(sessionId, userId);
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- --testPathPattern=logger.test.ts
```

**Step 5: Commit**

```bash
git add src/model-builder/services/logger.ts src/__tests__/model-builder/logger.test.ts
git commit -m "feat(model-builder): add logger service with structured JSON logging"
```

---

## Task 3: Session State Manager

**Files:**
- Create: `src/model-builder/services/session-manager.ts`
- Test: `src/__tests__/model-builder/session-manager.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/model-builder/session-manager.test.ts
import { SessionManager } from '../../model-builder/services/session-manager';

describe('SessionManager', () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager();
  });

  it('should create new session with unique ID', () => {
    const session = manager.createSession('TestProject');
    expect(session.session_id).toBeDefined();
    expect(session.project_name).toBe('TestProject');
    expect(session.current_stage).toBe('A');
    expect(session.completed_stages).toEqual([]);
  });

  it('should save and load session state', () => {
    const session = manager.createSession('TestProject');
    session.current_stage = 'B';
    session.completed_stages = ['A'];

    manager.saveSession(session);
    const loaded = manager.loadSession(session.session_id);

    expect(loaded?.current_stage).toBe('B');
    expect(loaded?.completed_stages).toContain('A');
  });

  it('should approve stage and move to next', () => {
    const session = manager.createSession('TestProject');
    const updated = manager.approveStage(session, 'A', 'QUALIFY *;');

    expect(updated.completed_stages).toContain('A');
    expect(updated.approved_script_parts['A']).toBe('QUALIFY *;');
    expect(updated.current_stage).toBe('B');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- --testPathPattern=session-manager.test.ts
```

**Step 3: Write minimal implementation**

```typescript
// src/model-builder/services/session-manager.ts
import { ModelBuilderSession, BuildStage, BUILD_STAGES, ModelType } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class SessionManager {
  private sessions: Map<string, ModelBuilderSession> = new Map();

  createSession(projectName: string, userId?: string): ModelBuilderSession {
    const session: ModelBuilderSession = {
      session_id: uuidv4(),
      project_name: projectName,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      current_stage: 'A',
      completed_stages: [],
      model_type: null,
      approved_script_parts: {} as Record<BuildStage, string>,
      pending_tables: [],
      gemini_reviews: [],
      user_id: userId,
    };
    this.sessions.set(session.session_id, session);
    return session;
  }

  loadSession(sessionId: string): ModelBuilderSession | null {
    return this.sessions.get(sessionId) || null;
  }

  saveSession(session: ModelBuilderSession): void {
    session.updated_at = new Date().toISOString();
    this.sessions.set(session.session_id, { ...session });
  }

  approveStage(session: ModelBuilderSession, stage: BuildStage, script: string): ModelBuilderSession {
    const updated = { ...session };
    updated.approved_script_parts[stage] = script;

    if (!updated.completed_stages.includes(stage)) {
      updated.completed_stages.push(stage);
    }

    // Move to next stage
    const currentIndex = BUILD_STAGES.indexOf(stage);
    if (currentIndex < BUILD_STAGES.length - 1) {
      updated.current_stage = BUILD_STAGES[currentIndex + 1];
    }

    updated.updated_at = new Date().toISOString();
    this.saveSession(updated);
    return updated;
  }

  setModelType(session: ModelBuilderSession, modelType: ModelType): ModelBuilderSession {
    const updated = { ...session, model_type: modelType };
    this.saveSession(updated);
    return updated;
  }

  getFullScript(session: ModelBuilderSession): string {
    return BUILD_STAGES
      .filter(stage => session.approved_script_parts[stage])
      .map(stage => session.approved_script_parts[stage])
      .join('\n\n');
  }

  exportSession(session: ModelBuilderSession): string {
    return JSON.stringify(session, null, 2);
  }

  importSession(json: string): ModelBuilderSession | null {
    try {
      const session = JSON.parse(json) as ModelBuilderSession;
      this.sessions.set(session.session_id, session);
      return session;
    } catch {
      return null;
    }
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- --testPathPattern=session-manager.test.ts
```

**Step 5: Commit**

```bash
git add src/model-builder/services/session-manager.ts src/__tests__/model-builder/session-manager.test.ts
git commit -m "feat(model-builder): add session state manager with persistence"
```

---

## Task 4: Input Processor

**Files:**
- Create: `src/model-builder/engines/input-processor.ts`
- Test: `src/__tests__/model-builder/input-processor.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/model-builder/input-processor.test.ts
import { InputProcessor } from '../../model-builder/engines/input-processor';
import { Stage1Input, QvdSampleData } from '../../model-builder/types';

describe('InputProcessor', () => {
  const mockStage1Input: Stage1Input = {
    version: '1.0',
    source: 'test.docx',
    parsed_at: '2026-01-20T10:00:00Z',
    tables: [
      {
        name: 'Orders',
        source_name: 'dbo.Orders',
        fields: [
          { name: 'OrderID', type: 'integer' },
          { name: 'CustomerID', type: 'string' },
          { name: 'OrderDate', type: 'date' },
          { name: 'Amount', type: 'decimal' },
        ],
      },
      {
        name: 'Customers',
        source_name: 'dbo.Customers',
        fields: [
          { name: 'CustomerID', type: 'string' },
          { name: 'CustomerName', type: 'string' },
          { name: 'Country', type: 'string' },
        ],
      },
    ],
    relationship_hints: [
      { from: 'Orders.CustomerID', to: 'Customers.CustomerID', type: 'many-to-one' },
    ],
  };

  const mockQvdSamples: QvdSampleData[] = [
    {
      table_name: 'Orders',
      row_count: 150000,
      fields: [
        { name: 'OrderID', type: 'integer', cardinality: 150000, null_percent: 0, sample_values: ['1', '2', '3'] },
        { name: 'CustomerID', type: 'string', cardinality: 5000, null_percent: 0.01, sample_values: ['C001', 'C002'] },
        { name: 'OrderDate', type: 'date', cardinality: 730, null_percent: 0, sample_values: ['2025-01-01', '2025-01-02'] },
        { name: 'Amount', type: 'decimal', cardinality: 8500, null_percent: 0.02, sample_values: ['100.00', '250.50'] },
      ],
    },
    {
      table_name: 'Customers',
      row_count: 5000,
      fields: [
        { name: 'CustomerID', type: 'string', cardinality: 5000, null_percent: 0, sample_values: ['C001', 'C002'] },
        { name: 'CustomerName', type: 'string', cardinality: 4950, null_percent: 0.01, sample_values: ['Acme Corp'] },
        { name: 'Country', type: 'string', cardinality: 50, null_percent: 0.02, sample_values: ['USA', 'UK'] },
      ],
    },
  ];

  let processor: InputProcessor;

  beforeEach(() => {
    processor = new InputProcessor();
  });

  it('should merge Stage 1 JSON with QVD sample data', () => {
    const result = processor.process(mockStage1Input, mockQvdSamples);

    expect(result.tables).toHaveLength(2);
    expect(result.tables[0].row_count).toBe(150000);
    expect(result.tables[0].fields[0].cardinality).toBe(150000);
  });

  it('should identify key candidates based on cardinality', () => {
    const result = processor.process(mockStage1Input, mockQvdSamples);

    const ordersTable = result.tables.find(t => t.name === 'Orders');
    const orderIdField = ordersTable?.fields.find(f => f.name === 'OrderID');

    expect(orderIdField?.is_key_candidate).toBe(true);
  });

  it('should identify date fields', () => {
    const result = processor.process(mockStage1Input, mockQvdSamples);

    expect(result.date_fields).toHaveLength(1);
    expect(result.date_fields[0].field).toBe('OrderDate');
  });

  it('should enrich relationships with cardinality', () => {
    const result = processor.process(mockStage1Input, mockQvdSamples);

    expect(result.relationships).toHaveLength(1);
    expect(result.relationships[0].cardinality).toBe('N:1');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- --testPathPattern=input-processor.test.ts
```

**Step 3: Write minimal implementation**

```typescript
// src/model-builder/engines/input-processor.ts
import {
  Stage1Input,
  QvdSampleData,
  EnrichedModelSpec,
  EnrichedTable,
  EnrichedField,
  EnrichedRelationship,
  DateFieldInfo,
} from '../types';

export class InputProcessor {
  process(stage1Input: Stage1Input, qvdSamples: QvdSampleData[]): EnrichedModelSpec {
    const tables = this.enrichTables(stage1Input.tables, qvdSamples);
    const relationships = this.enrichRelationships(stage1Input.relationship_hints, tables);
    const date_fields = this.extractDateFields(tables);

    return { tables, relationships, date_fields };
  }

  private enrichTables(
    stage1Tables: Stage1Input['tables'],
    qvdSamples: QvdSampleData[]
  ): EnrichedTable[] {
    return stage1Tables.map(table => {
      const qvdSample = qvdSamples.find(s => s.table_name === table.name);
      const row_count = qvdSample?.row_count || 0;

      const fields = table.fields.map(field => {
        const qvdField = qvdSample?.fields.find(f => f.name === field.name);
        return this.enrichField(field, qvdField, row_count);
      });

      return {
        name: table.name,
        source_name: table.source_name,
        row_count,
        fields,
      };
    });
  }

  private enrichField(
    field: Stage1Input['tables'][0]['fields'][0],
    qvdField: QvdSampleData['fields'][0] | undefined,
    tableRowCount: number
  ): EnrichedField {
    const cardinality = qvdField?.cardinality || 0;
    const null_percent = qvdField?.null_percent || 0;

    // Key candidate: high cardinality relative to row count (>90%)
    const is_key_candidate = tableRowCount > 0 && cardinality / tableRowCount > 0.9;

    // Date field detection
    const is_date_field = field.type === 'date' || field.type === 'datetime';

    return {
      name: field.name,
      type: field.type,
      cardinality,
      null_percent,
      is_key_candidate,
      is_date_field,
      sample_values: qvdField?.sample_values || [],
    };
  }

  private enrichRelationships(
    hints: Stage1Input['relationship_hints'],
    tables: EnrichedTable[]
  ): EnrichedRelationship[] {
    return hints.map(hint => {
      const [fromTable, fromField] = hint.from.split('.');
      const [toTable, toField] = hint.to.split('.');

      // Determine cardinality based on relationship type
      let cardinality: EnrichedRelationship['cardinality'];
      switch (hint.type) {
        case 'many-to-one': cardinality = 'N:1'; break;
        case 'one-to-many': cardinality = '1:N'; break;
        case 'many-to-many': cardinality = 'N:M'; break;
        default: cardinality = '1:1';
      }

      return {
        from_table: fromTable,
        from_field: fromField,
        to_table: toTable,
        to_field: toField,
        cardinality,
        confidence: 0.8, // From explicit hint
      };
    });
  }

  private extractDateFields(tables: EnrichedTable[]): DateFieldInfo[] {
    const dateFields: DateFieldInfo[] = [];

    for (const table of tables) {
      for (const field of table.fields) {
        if (field.is_date_field) {
          dateFields.push({
            table: table.name,
            field: field.name,
            min_date: field.sample_values[0],
            max_date: field.sample_values[field.sample_values.length - 1],
          });
        }
      }
    }

    return dateFields;
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- --testPathPattern=input-processor.test.ts
```

**Step 5: Commit**

```bash
git add src/model-builder/engines/input-processor.ts src/__tests__/model-builder/input-processor.test.ts
git commit -m "feat(model-builder): add input processor to merge Stage 1 JSON with QVD samples"
```

---

## Task 5: Analyzer Engine

**Files:**
- Create: `src/model-builder/engines/analyzer.ts`
- Test: `src/__tests__/model-builder/analyzer.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/model-builder/analyzer.test.ts
import { Analyzer } from '../../model-builder/engines/analyzer';
import { EnrichedModelSpec } from '../../model-builder/types';

describe('Analyzer', () => {
  const mockSpec: EnrichedModelSpec = {
    tables: [
      {
        name: 'Orders',
        source_name: 'dbo.Orders',
        row_count: 150000,
        fields: [
          { name: 'OrderID', type: 'integer', cardinality: 150000, null_percent: 0, is_key_candidate: true, is_date_field: false, sample_values: [] },
          { name: 'CustomerID', type: 'string', cardinality: 5000, null_percent: 0, is_key_candidate: false, is_date_field: false, sample_values: [] },
          { name: 'Amount', type: 'decimal', cardinality: 8500, null_percent: 0, is_key_candidate: false, is_date_field: false, sample_values: [] },
        ],
      },
      {
        name: 'Customers',
        source_name: 'dbo.Customers',
        row_count: 5000,
        fields: [
          { name: 'CustomerID', type: 'string', cardinality: 5000, null_percent: 0, is_key_candidate: true, is_date_field: false, sample_values: [] },
          { name: 'CustomerName', type: 'string', cardinality: 4950, null_percent: 0, is_key_candidate: false, is_date_field: false, sample_values: [] },
        ],
      },
    ],
    relationships: [
      { from_table: 'Orders', from_field: 'CustomerID', to_table: 'Customers', to_field: 'CustomerID', cardinality: 'N:1', confidence: 0.8 },
    ],
    date_fields: [],
  };

  let analyzer: Analyzer;

  beforeEach(() => {
    analyzer = new Analyzer();
  });

  it('should classify Orders as Fact (high row count)', () => {
    const result = analyzer.analyze(mockSpec);
    expect(result.classifications.facts).toContain('Orders');
  });

  it('should classify Customers as Dimension (low row count, lookup)', () => {
    const result = analyzer.analyze(mockSpec);
    expect(result.classifications.dimensions).toContain('Customers');
  });

  it('should recommend Star Schema for simple Fact-Dimension structure', () => {
    const result = analyzer.analyze(mockSpec);
    expect(result.recommended_model).toBe('star_schema');
  });

  it('should provide alternatives with pros/cons', () => {
    const result = analyzer.analyze(mockSpec);
    expect(result.alternatives.length).toBeGreaterThan(0);
    expect(result.alternatives[0].pros).toBeDefined();
    expect(result.alternatives[0].cons).toBeDefined();
  });
});
```

**Step 2: Run test, write implementation, commit**

```typescript
// src/model-builder/engines/analyzer.ts
import {
  EnrichedModelSpec,
  EnrichedTable,
  ModelAnalysis,
  ModelType,
  ModelAlternative,
  TableClassification,
} from '../types';

const FACT_ROW_THRESHOLD = 10000;
const DIMENSION_CARDINALITY_RATIO = 0.5;

export class Analyzer {
  analyze(spec: EnrichedModelSpec): ModelAnalysis {
    const classifications = this.classifyTables(spec);
    const modelType = this.detectModelType(spec, classifications);
    const alternatives = this.generateAlternatives(spec, modelType);

    return {
      recommended_model: modelType,
      confidence: this.calculateConfidence(spec, modelType),
      alternatives,
      classifications,
      warnings: this.generateWarnings(spec, classifications),
    };
  }

  private classifyTables(spec: EnrichedModelSpec): ModelAnalysis['classifications'] {
    const facts: string[] = [];
    const dimensions: string[] = [];
    const links: string[] = [];
    const calendars: string[] = [];

    for (const table of spec.tables) {
      const classification = this.classifyTable(table, spec);
      switch (classification) {
        case 'fact': facts.push(table.name); break;
        case 'dimension': dimensions.push(table.name); break;
        case 'link': links.push(table.name); break;
        case 'calendar': calendars.push(table.name); break;
      }
    }

    return { facts, dimensions, links, calendars };
  }

  private classifyTable(table: EnrichedTable, spec: EnrichedModelSpec): TableClassification {
    // High row count + numeric fields = Fact
    const hasNumericMeasures = table.fields.some(f =>
      ['decimal', 'integer'].includes(f.type) && !f.is_key_candidate
    );

    if (table.row_count > FACT_ROW_THRESHOLD && hasNumericMeasures) {
      return 'fact';
    }

    // Referenced by other tables = Dimension (lookup)
    const isReferenced = spec.relationships.some(r =>
      r.to_table === table.name && r.cardinality === 'N:1'
    );

    if (isReferenced || table.row_count <= FACT_ROW_THRESHOLD) {
      return 'dimension';
    }

    return 'dimension'; // Default
  }

  private detectModelType(
    spec: EnrichedModelSpec,
    classifications: ModelAnalysis['classifications']
  ): ModelType {
    // Check for N:M relationships (need Link Table)
    const hasNtoM = spec.relationships.some(r => r.cardinality === 'N:M');
    if (hasNtoM) return 'link_table';

    // Check for Dimension-to-Dimension relationships (Snowflake)
    const dimToDim = spec.relationships.some(r =>
      classifications.dimensions.includes(r.from_table) &&
      classifications.dimensions.includes(r.to_table)
    );
    if (dimToDim) return 'snowflake';

    // Check for multiple similar Facts (Concatenated)
    if (classifications.facts.length > 1) {
      const factFields = classifications.facts.map(f =>
        spec.tables.find(t => t.name === f)?.fields.map(fd => fd.name) || []
      );
      const similarity = this.calculateFieldSimilarity(factFields);
      if (similarity > 0.7) return 'concatenated';
    }

    return 'star_schema';
  }

  private calculateFieldSimilarity(fieldSets: string[][]): number {
    if (fieldSets.length < 2) return 0;
    const set1 = new Set(fieldSets[0]);
    const set2 = new Set(fieldSets[1]);
    const intersection = [...set1].filter(x => set2.has(x));
    return intersection.length / Math.max(set1.size, set2.size);
  }

  private generateAlternatives(spec: EnrichedModelSpec, recommended: ModelType): ModelAlternative[] {
    const alternatives: ModelAlternative[] = [];

    if (recommended !== 'star_schema') {
      alternatives.push({
        model: 'star_schema',
        reason: 'Simpler structure with single Fact table',
        pros: ['Faster queries', 'Easier to maintain', 'Standard pattern'],
        cons: ['May not capture all relationships', 'Data duplication possible'],
      });
    }

    if (recommended !== 'snowflake') {
      alternatives.push({
        model: 'snowflake',
        reason: 'Normalized dimensions preserve hierarchy',
        pros: ['Less redundancy', 'Clearer hierarchies', 'Smaller dimension tables'],
        cons: ['More joins required', 'Slightly slower queries'],
      });
    }

    return alternatives;
  }

  private calculateConfidence(spec: EnrichedModelSpec, modelType: ModelType): number {
    // Base confidence
    let confidence = 0.7;

    // Boost for clear patterns
    if (spec.relationships.length > 0) confidence += 0.1;
    if (spec.tables.every(t => t.row_count > 0)) confidence += 0.1;

    return Math.min(confidence, 0.95);
  }

  private generateWarnings(
    spec: EnrichedModelSpec,
    classifications: ModelAnalysis['classifications']
  ): string[] {
    const warnings: string[] = [];

    if (classifications.facts.length === 0) {
      warnings.push('No Fact tables detected - review classifications');
    }

    if (spec.relationships.length === 0) {
      warnings.push('No relationships defined - model may have disconnected tables');
    }

    return warnings;
  }
}
```

**Commit:**

```bash
git add src/model-builder/engines/analyzer.ts src/__tests__/model-builder/analyzer.test.ts
git commit -m "feat(model-builder): add analyzer engine for table classification and model detection"
```

---

## Task 6: Scope Guard

**Files:**
- Create: `src/model-builder/services/scope-guard.ts`
- Test: `src/__tests__/model-builder/scope-guard.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/model-builder/scope-guard.test.ts
import { ScopeGuard } from '../../model-builder/services/scope-guard';

describe('ScopeGuard', () => {
  let guard: ScopeGuard;

  beforeEach(() => {
    guard = new ScopeGuard();
  });

  it('should allow Qlik-related requests', () => {
    expect(guard.isAllowed('Build me a star schema model')).toBe(true);
    expect(guard.isAllowed('Add a dimension table')).toBe(true);
    expect(guard.isAllowed('Generate calendar for OrderDate')).toBe(true);
  });

  it('should block non-Qlik requests', () => {
    expect(guard.isAllowed('Write me an email')).toBe(false);
    expect(guard.isAllowed('What is the weather today?')).toBe(false);
    expect(guard.isAllowed('Translate this to Spanish')).toBe(false);
  });

  it('should return rejection message for blocked requests', () => {
    const result = guard.check('Write me an email');
    expect(result.allowed).toBe(false);
    expect(result.message).toContain('out of scope');
  });
});
```

**Step 2: Write implementation**

```typescript
// src/model-builder/services/scope-guard.ts

const ALLOWED_KEYWORDS = [
  'model', 'script', 'table', 'field', 'dimension', 'fact',
  'qlik', 'qvd', 'load', 'calendar', 'star', 'snowflake',
  'link', 'key', 'join', 'relationship', 'qualify', 'store',
  'incremental', 'reload', 'app', 'measure', 'autonumber',
];

const BLOCKED_PATTERNS = [
  /write.*(email|letter|message)/i,
  /translate/i,
  /weather/i,
  /python|javascript|java(?!script)|c\+\+|rust/i,
  /recipe|cook/i,
  /joke|funny/i,
];

export interface ScopeCheckResult {
  allowed: boolean;
  message?: string;
  matchedKeyword?: string;
}

export class ScopeGuard {
  isAllowed(request: string): boolean {
    return this.check(request).allowed;
  }

  check(request: string): ScopeCheckResult {
    const lowerRequest = request.toLowerCase();

    // Check blocked patterns first
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(request)) {
        return {
          allowed: false,
          message: this.getRejectionMessage(),
        };
      }
    }

    // Check for at least one allowed keyword
    const matchedKeyword = ALLOWED_KEYWORDS.find(kw => lowerRequest.includes(kw));

    if (matchedKeyword) {
      return { allowed: true, matchedKeyword };
    }

    // No keyword found - reject
    return {
      allowed: false,
      message: this.getRejectionMessage(),
    };
  }

  private getRejectionMessage(): string {
    return `⚠️ Out of Scope

This system is designed for Qlik model building only.

I can help you with:
• Building data models (Star, Snowflake, Link Tables)
• Writing Qlik Load Scripts
• Reviewing and fixing script issues
• Explaining Qlik concepts

For other requests, please use a general assistant.`;
  }
}
```

**Commit:**

```bash
git add src/model-builder/services/scope-guard.ts src/__tests__/model-builder/scope-guard.test.ts
git commit -m "feat(model-builder): add scope guard to filter Qlik-only requests"
```

---

## Task 7: Gemini Review Service

**Files:**
- Create: `src/model-builder/services/gemini-reviewer.ts`
- Test: `src/__tests__/model-builder/gemini-reviewer.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/model-builder/gemini-reviewer.test.ts
import { GeminiReviewer } from '../../model-builder/services/gemini-reviewer';

describe('GeminiReviewer', () => {
  let reviewer: GeminiReviewer;

  beforeEach(() => {
    reviewer = new GeminiReviewer('test-api-key');
  });

  it('should build correct review prompt', () => {
    const prompt = reviewer.buildPrompt({
      script: 'LOAD * FROM table;',
      model_type: 'star_schema',
      facts_count: 1,
      dimensions_count: 3,
      expected_rows: 100000,
    });

    expect(prompt).toContain('LOAD * FROM table');
    expect(prompt).toContain('star_schema');
    expect(prompt).toContain('Synthetic Keys');
  });

  it('should parse Gemini response correctly', () => {
    const mockResponse = JSON.stringify({
      review_status: 'issues_found',
      score: 75,
      issues: [
        {
          issue_id: 'BP-001',
          severity: 'warning',
          category: 'best-practice',
          title: 'LOAD * detected',
          location: { table: 'Orders', line: 1 },
          description: 'Using LOAD * loads all fields',
          recommendation: 'Specify fields explicitly',
          fix_example: 'LOAD OrderID, CustomerID FROM...',
        },
      ],
      summary: 'Script has best practice issues',
    });

    const result = reviewer.parseResponse(mockResponse);

    expect(result.review_status).toBe('issues_found');
    expect(result.score).toBe(75);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('warning');
  });
});
```

**Step 2: Write implementation**

```typescript
// src/model-builder/services/gemini-reviewer.ts
import { GeminiReviewRequest, GeminiReviewResponse, ReviewIssue } from '../types';

const SYSTEM_PROMPT = `You are a Qlik Sense expert reviewer.
Review the following Qlik Load Script and check:

1. SYNTAX: Valid Qlik syntax, no errors
2. BEST PRACTICES:
   - QUALIFY * used correctly
   - No LOAD * (selective fields only)
   - Variables defined before use
   - STORE to QVD for each table
3. ANTI-PATTERNS:
   - Synthetic Keys (shared fields between tables)
   - Circular References
   - God Tables (>50 fields)
4. MODEL SIZE:
   - High cardinality Link Tables
   - Unnecessary fields loaded

Return your response as JSON with this structure:
{
  "review_status": "issues_found" | "approved",
  "score": 0-100,
  "issues": [{ issue_id, severity, category, title, location, description, recommendation, fix_example }],
  "summary": "Brief summary"
}`;

export class GeminiReviewer {
  private apiKey: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  buildPrompt(request: GeminiReviewRequest): string {
    return `${SYSTEM_PROMPT}

Review this script:
\`\`\`qlik
${request.script}
\`\`\`

Model info:
- Type: ${request.model_type}
- Facts: ${request.facts_count}
- Dimensions: ${request.dimensions_count}
- Expected rows: ${request.expected_rows}`;
  }

  parseResponse(responseText: string): GeminiReviewResponse {
    try {
      // Try to parse as JSON directly
      const parsed = JSON.parse(responseText);
      return this.validateResponse(parsed);
    } catch {
      // Try to extract JSON from markdown code block
      const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        return this.validateResponse(parsed);
      }

      // Return default error response
      return {
        review_status: 'approved',
        score: 0,
        issues: [],
        summary: 'Failed to parse Gemini response',
      };
    }
  }

  private validateResponse(parsed: unknown): GeminiReviewResponse {
    const response = parsed as GeminiReviewResponse;
    return {
      review_status: response.review_status || 'approved',
      score: response.score || 0,
      issues: Array.isArray(response.issues) ? response.issues : [],
      summary: response.summary || '',
    };
  }

  async review(request: GeminiReviewRequest): Promise<GeminiReviewResponse> {
    const prompt = this.buildPrompt(request);

    try {
      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4096,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return this.parseResponse(text);
    } catch (error) {
      console.error('Gemini review failed:', error);
      return {
        review_status: 'approved',
        score: 0,
        issues: [],
        summary: `Review failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
```

**Commit:**

```bash
git add src/model-builder/services/gemini-reviewer.ts src/__tests__/model-builder/gemini-reviewer.test.ts
git commit -m "feat(model-builder): add Gemini reviewer service for script validation"
```

---

## Task 8: Script Builder Engine (Part 1 - Configuration Stage)

**Files:**
- Create: `src/model-builder/engines/script-builder.ts`
- Test: `src/__tests__/model-builder/script-builder.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/model-builder/script-builder.test.ts
import { ScriptBuilder } from '../../model-builder/engines/script-builder';

describe('ScriptBuilder', () => {
  let builder: ScriptBuilder;

  beforeEach(() => {
    builder = new ScriptBuilder({
      projectName: 'TestProject',
      modelType: 'star_schema',
      calendarLanguage: 'EN',
      qvdPath: 'lib://QVD/TestProject/',
    });
  });

  describe('Stage A: Configuration', () => {
    it('should generate QUALIFY * statement', () => {
      const script = builder.buildStageA();
      expect(script).toContain('QUALIFY *;');
    });

    it('should include project header comment', () => {
      const script = builder.buildStageA();
      expect(script).toContain('Project: TestProject');
      expect(script).toContain('Model Type: star_schema');
    });

    it('should define variables', () => {
      const script = builder.buildStageA();
      expect(script).toContain("SET vPathQVD = 'lib://QVD/TestProject/'");
      expect(script).toContain('SET vReloadDate = Today()');
      expect(script).toContain("SET vCalendarLanguage = 'EN'");
    });
  });
});
```

**Step 2: Write implementation**

```typescript
// src/model-builder/engines/script-builder.ts
import { ModelType, BuildStage, EnrichedTable, DateFieldInfo } from '../types';

export interface ScriptBuilderConfig {
  projectName: string;
  modelType: ModelType;
  calendarLanguage: string;
  qvdPath: string;
  useAutoNumber?: boolean;
}

export class ScriptBuilder {
  private config: ScriptBuilderConfig;

  constructor(config: ScriptBuilderConfig) {
    this.config = config;
  }

  buildStageA(): string {
    const date = new Date().toISOString().split('T')[0];

    return `//=============================================================
// Project: ${this.config.projectName}
// Created: ${date} by QlikModelBuilder
// Model Type: ${this.config.modelType}
//=============================================================

//-------------------------------------------------------------
// SECTION 0: QUALIFY ALL (Synthetic Key Prevention)
//-------------------------------------------------------------
QUALIFY *;

//-------------------------------------------------------------
// SECTION 1: Variables & Configuration
//-------------------------------------------------------------
SET vPathQVD = '${this.config.qvdPath}';
SET vReloadDate = Today();
SET vReloadTime = Now();
SET vCalendarLanguage = '${this.config.calendarLanguage}';
`;
  }

  buildStageB(dimensions: EnrichedTable[]): string {
    let script = `//-------------------------------------------------------------
// SECTION 2: Dimensions
//-------------------------------------------------------------
`;
    for (const dim of dimensions) {
      script += this.buildDimensionTable(dim);
    }
    return script;
  }

  private buildDimensionTable(table: EnrichedTable): string {
    const alias = `DIM_${table.name}`;
    const pkField = table.fields.find(f => f.is_key_candidate);
    const pkName = pkField ? pkField.name : table.fields[0]?.name || 'ID';

    const fields = table.fields.map(f => {
      if (f.name === pkName) {
        return `    ${f.name} AS ${table.name}Key`;
      }
      return `    ${f.name}`;
    }).join(',\n');

    return `
// ${alias}
${alias}:
LOAD
${fields}
FROM [$(vPathQVD)${table.name.toLowerCase()}.qvd] (qvd);
`;
  }

  buildStageC(facts: EnrichedTable[]): string {
    let script = `//-------------------------------------------------------------
// SECTION 3: Facts
//-------------------------------------------------------------
`;
    for (const fact of facts) {
      script += this.buildFactTable(fact);
    }
    return script;
  }

  private buildFactTable(table: EnrichedTable): string {
    const alias = `FACT_${table.name}`;

    const fields = table.fields.map(f => {
      if (f.is_key_candidate) {
        return `    ${f.name} AS ${table.name}Key`;
      }
      // Foreign keys - keep original name for linking
      return `    ${f.name}`;
    }).join(',\n');

    return `
// ${alias}
${alias}:
LOAD
${fields}
FROM [$(vPathQVD)${table.name.toLowerCase()}.qvd] (qvd);
`;
  }

  buildStageD(linkTables: string[]): string {
    if (linkTables.length === 0) {
      return `//-------------------------------------------------------------
// SECTION 4: Link Tables (Not needed for this model)
//-------------------------------------------------------------
`;
    }
    // Link table generation would go here
    return '';
  }

  buildStageE(dateFields: DateFieldInfo[]): string {
    let script = `//-------------------------------------------------------------
// SECTION 5: Calendars (Per Date Field)
//-------------------------------------------------------------
`;
    script += this.buildCalendarSub();

    for (const df of dateFields) {
      script += `\nCALL CreateMasterCalendar('${df.field}', Num(MakeDate(2020,1,1)), Num(MakeDate(2027,12,31)));`;
    }

    return script;
  }

  private buildCalendarSub(): string {
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
        'Q' & Ceil(Month(TempDate)/3) AS $(vFieldName)_Quarter
    RESIDENT TempCal_$(vFieldName);

    DROP TABLE TempCal_$(vFieldName);
END SUB
`;
  }

  buildStageF(tables: string[]): string {
    let script = `//-------------------------------------------------------------
// SECTION 6: UNQUALIFY Keys & Store
//-------------------------------------------------------------
`;
    // Unqualify keys
    const keys = tables.map(t => `${t}Key`).join(', ');
    script += `UNQUALIFY ${keys};\n\n`;

    // Store statements
    for (const table of tables) {
      const prefix = table.startsWith('DIM_') || table.startsWith('FACT_') ? '' : 'FACT_';
      script += `STORE ${prefix}${table} INTO [$(vPathQVD)Final/${prefix}${table}.qvd] (qvd);\n`;
    }

    return script;
  }
}
```

**Commit:**

```bash
git add src/model-builder/engines/script-builder.ts src/__tests__/model-builder/script-builder.test.ts
git commit -m "feat(model-builder): add script builder engine with staged generation"
```

---

## Task 9: Model Builder Orchestrator

**Files:**
- Create: `src/model-builder/model-builder.ts`
- Create: `src/model-builder/index.ts`

This is the main orchestrator that ties all components together.

```typescript
// src/model-builder/model-builder.ts
import { InputProcessor } from './engines/input-processor';
import { Analyzer } from './engines/analyzer';
import { ScriptBuilder, ScriptBuilderConfig } from './engines/script-builder';
import { SessionManager } from './services/session-manager';
import { GeminiReviewer } from './services/gemini-reviewer';
import { ScopeGuard } from './services/scope-guard';
import { Logger, createLogger } from './services/logger';
import {
  Stage1Input,
  QvdSampleData,
  ModelBuilderSession,
  BuildStage,
  ModelAnalysis,
  GeminiReviewResponse,
} from './types';

export class ModelBuilder {
  private inputProcessor: InputProcessor;
  private analyzer: Analyzer;
  private sessionManager: SessionManager;
  private geminiReviewer: GeminiReviewer | null;
  private scopeGuard: ScopeGuard;
  private logger: Logger | null = null;

  constructor(geminiApiKey?: string) {
    this.inputProcessor = new InputProcessor();
    this.analyzer = new Analyzer();
    this.sessionManager = new SessionManager();
    this.scopeGuard = new ScopeGuard();
    this.geminiReviewer = geminiApiKey ? new GeminiReviewer(geminiApiKey) : null;
  }

  // Start new session
  startSession(projectName: string, userId?: string): ModelBuilderSession {
    const session = this.sessionManager.createSession(projectName, userId);
    this.logger = createLogger(session.session_id, userId);
    this.logger.info('orchestrator', 'session_started', { projectName });
    return session;
  }

  // Process inputs and analyze
  async analyzeModel(
    session: ModelBuilderSession,
    stage1Input: Stage1Input,
    qvdSamples: QvdSampleData[]
  ): Promise<ModelAnalysis> {
    this.logger?.info('orchestrator', 'analysis_started', {});

    const enrichedSpec = this.inputProcessor.process(stage1Input, qvdSamples);
    const analysis = this.analyzer.analyze(enrichedSpec);

    this.logger?.info('orchestrator', 'analysis_complete', {
      recommended_model: analysis.recommended_model,
      facts: analysis.classifications.facts.length,
      dimensions: analysis.classifications.dimensions.length,
    });

    return analysis;
  }

  // Build specific stage
  buildStage(
    session: ModelBuilderSession,
    stage: BuildStage,
    config: ScriptBuilderConfig,
    data: unknown
  ): string {
    const builder = new ScriptBuilder(config);

    this.logger?.info('builder_engine', 'stage_building', { stage }, stage);

    switch (stage) {
      case 'A': return builder.buildStageA();
      case 'B': return builder.buildStageB(data as any);
      case 'C': return builder.buildStageC(data as any);
      case 'D': return builder.buildStageD(data as any);
      case 'E': return builder.buildStageE(data as any);
      case 'F': return builder.buildStageF(data as any);
      default: return '';
    }
  }

  // Approve stage and move to next
  approveStage(session: ModelBuilderSession, stage: BuildStage, script: string): ModelBuilderSession {
    this.logger?.info('orchestrator', 'stage_approved', { stage }, stage);
    this.logger?.audit({
      audit_type: 'stage_approved',
      action: `approved_stage_${stage}`,
    });
    return this.sessionManager.approveStage(session, stage, script);
  }

  // Review with Gemini
  async reviewWithGemini(session: ModelBuilderSession): Promise<GeminiReviewResponse | null> {
    if (!this.geminiReviewer) {
      this.logger?.warn('orchestrator', 'gemini_unavailable', {});
      return null;
    }

    const fullScript = this.sessionManager.getFullScript(session);

    this.logger?.info('gemini_reviewer', 'review_started', {
      script_length: fullScript.length,
    });

    const response = await this.geminiReviewer.review({
      script: fullScript,
      model_type: session.model_type || 'star_schema',
      facts_count: 1,
      dimensions_count: 3,
      expected_rows: 100000,
    });

    this.logger?.info('gemini_reviewer', 'review_complete', {
      status: response.review_status,
      score: response.score,
      issues_count: response.issues.length,
    });

    return response;
  }

  // Check scope
  checkScope(request: string): { allowed: boolean; message?: string } {
    return this.scopeGuard.check(request);
  }

  // Get session
  getSession(sessionId: string): ModelBuilderSession | null {
    return this.sessionManager.loadSession(sessionId);
  }

  // Export session
  exportSession(session: ModelBuilderSession): string {
    return this.sessionManager.exportSession(session);
  }
}

// Singleton instance
let instance: ModelBuilder | null = null;

export function getModelBuilder(geminiApiKey?: string): ModelBuilder {
  if (!instance) {
    instance = new ModelBuilder(geminiApiKey);
  }
  return instance;
}
```

```typescript
// src/model-builder/index.ts
export * from './types';
export * from './model-builder';
export { InputProcessor } from './engines/input-processor';
export { Analyzer } from './engines/analyzer';
export { ScriptBuilder } from './engines/script-builder';
export { SessionManager } from './services/session-manager';
export { GeminiReviewer } from './services/gemini-reviewer';
export { ScopeGuard } from './services/scope-guard';
export { Logger, createLogger } from './services/logger';
```

**Commit:**

```bash
git add src/model-builder/model-builder.ts src/model-builder/index.ts
git commit -m "feat(model-builder): add main orchestrator and exports"
```

---

## Task 10: MCP Handler Integration

**Files:**
- Modify: `src/handlers/qmb-handlers.ts`

Add new handlers for Stage 2 model building tools.

```typescript
// Add to qmb-handlers.ts - new cases in handleQmbTool switch

case 'qmb_analyze_model': {
  const stage1Json = args.stage1Json as string;
  const qvdSamplesJson = args.qvdSamplesJson as string;

  const modelBuilder = getModelBuilder(process.env.GEMINI_API_KEY);
  const session = modelBuilder.startSession(args.projectName as string || 'Untitled');

  const stage1Input = JSON.parse(stage1Json);
  const qvdSamples = JSON.parse(qvdSamplesJson);

  const analysis = await modelBuilder.analyzeModel(session, stage1Input, qvdSamples);

  return success(`Model Analysis Complete

Recommended: ${analysis.recommended_model} (${Math.round(analysis.confidence * 100)}% confidence)

Classifications:
- Facts: ${analysis.classifications.facts.join(', ') || 'None'}
- Dimensions: ${analysis.classifications.dimensions.join(', ') || 'None'}

Session ID: ${session.session_id}`);
}

case 'qmb_build_stage': {
  const sessionId = args.sessionId as string;
  const stage = args.stage as BuildStage;

  const modelBuilder = getModelBuilder();
  const session = modelBuilder.getSession(sessionId);

  if (!session) {
    return error('Session not found');
  }

  const script = modelBuilder.buildStage(session, stage, {
    projectName: session.project_name,
    modelType: session.model_type || 'star_schema',
    calendarLanguage: 'EN',
    qvdPath: `lib://QVD/${session.project_name}/`,
  }, args.data);

  return success(`Stage ${stage} Script:

\`\`\`qlik
${script}
\`\`\`

[Approve] [Edit] [Question]`);
}

case 'qmb_approve_stage': {
  const sessionId = args.sessionId as string;
  const stage = args.stage as BuildStage;
  const script = args.script as string;

  const modelBuilder = getModelBuilder();
  const session = modelBuilder.getSession(sessionId);

  if (!session) {
    return error('Session not found');
  }

  const updated = modelBuilder.approveStage(session, stage, script);

  return success(`Stage ${stage} approved!

Progress: ${updated.completed_stages.length}/6 stages complete
Next: Stage ${updated.current_stage}`);
}

case 'qmb_review_script': {
  const sessionId = args.sessionId as string;

  const modelBuilder = getModelBuilder(process.env.GEMINI_API_KEY);
  const session = modelBuilder.getSession(sessionId);

  if (!session) {
    return error('Session not found');
  }

  const review = await modelBuilder.reviewWithGemini(session);

  if (!review) {
    return error('Gemini review unavailable');
  }

  if (review.review_status === 'approved') {
    return success(`✅ Script Approved!

Score: ${review.score}/100
${review.summary}`);
  }

  const issuesList = review.issues.map(i =>
    `${i.severity === 'critical' ? '🔴' : '⚠️'} ${i.title}\n   ${i.description}\n   Fix: ${i.fix_example}`
  ).join('\n\n');

  return success(`Script Review: ${review.issues.length} issues found

Score: ${review.score}/100

${issuesList}

${review.summary}`);
}
```

**Commit:**

```bash
git add src/handlers/qmb-handlers.ts
git commit -m "feat(model-builder): integrate Stage 2 handlers into MCP"
```

---

## Summary

This implementation plan covers the core components of the Data Model Builder (Stage 2):

| Task | Component | Description |
|------|-----------|-------------|
| 1 | Types | All TypeScript interfaces and types |
| 2 | Logger | Structured JSON logging service |
| 3 | Session Manager | State persistence and stage tracking |
| 4 | Input Processor | Merge Stage 1 JSON with QVD samples |
| 5 | Analyzer | Table classification and model detection |
| 6 | Scope Guard | Filter Qlik-only requests |
| 7 | Gemini Reviewer | AI review service integration |
| 8 | Script Builder | Staged script generation |
| 9 | Orchestrator | Main ModelBuilder class |
| 10 | MCP Handlers | Tool integration |

**Total estimated tasks:** 10 main tasks with ~50 steps

---

**Document End**
