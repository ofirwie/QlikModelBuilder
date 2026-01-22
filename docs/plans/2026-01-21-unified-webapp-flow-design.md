# QlikModelBuilder - Unified Web App Flow Design

**Date:** 2026-01-21
**Version:** 1.0.0
**Status:** Approved

---

## 1. Overview

The QlikModelBuilder Web App combines **Stage 1 (Data Extraction)** and **Stage 2 (Model Building)** into a single unified flow that takes the user from data source to complete ETL model in Qlik Cloud.

---

## 2. Architecture Reference

### Backend Components

#### Stage 1: Wizard Engine (`src/wizard/`)
| File | Purpose |
|------|---------|
| `wizard-engine.ts` | Main orchestrator for data extraction wizard |
| `step-manager.ts` | Step navigation and validation |
| `state-store.ts` | Project state persistence |
| `script-generator.ts` | Generate Qlik load scripts |
| `types.ts` | Type definitions |

#### Stage 2: Model Builder (`src/model-builder/`)
| File | Purpose |
|------|---------|
| `model-builder.ts` | Main orchestrator for model building |
| `services/session-manager.ts` | Session persistence |
| `services/input-processor.ts` | Enrich data with QVD samples |
| `services/analyzer.ts` | Classify tables, recommend model type |
| `services/scope-guard.ts` | Validate requests, rate limiting |
| `services/script-builder.ts` | Generate Qlik model scripts |
| `services/gemini-reviewer.ts` | AI-powered script review |
| `services/logger.ts` | Structured logging |
| `types.ts` | Type definitions |

---

## 3. Unified Flow (11 Steps)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    STAGE 1: DATA EXTRACTION                          │
│                    (Wizard Engine)                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Step 1: CONNECT                                                     │
│  ├── Connect to Qlik Cloud tenant                                    │
│  ├── Authenticate (OAuth / API Key)                                  │
│  └── Select or create Space                                          │
│                                                                      │
│  Step 2: SOURCE                                                      │
│  ├── Select data source type:                                        │
│  │   • Database: SQL Server, Oracle, PostgreSQL, MySQL               │
│  │   • API: REST API with auth config                                │
│  │   • Files: Excel, CSV, JSON, QVD                                  │
│  └── Configure connection string / credentials                       │
│                                                                      │
│  Step 3: TABLES                                                      │
│  ├── Browse available tables/endpoints                               │
│  ├── Select tables to include                                        │
│  └── Set table aliases if needed                                     │
│                                                                      │
│  Step 4: FIELDS                                                      │
│  ├── For each table, select fields                                   │
│  ├── Set field aliases                                               │
│  ├── Mark primary keys                                               │
│  └── Set data types                                                  │
│                                                                      │
│  Step 5: INCREMENTAL                                                 │
│  ├── For each table, configure incremental strategy:                 │
│  │   • none (full reload)                                            │
│  │   • by_date (incremental by date field)                           │
│  │   • by_id (incremental by ID field)                               │
│  │   • time_window (last N days/weeks)                               │
│  │   • custom (custom logic)                                         │
│  └── Configure history retention                                     │
│                                                                      │
│  Step 6: EXTRACT                                                     │
│  ├── Preview generated Load Script                                   │
│  ├── Validate script                                                 │
│  ├── Deploy to Qlik Cloud                                            │
│  └── OUTPUT: QVD files created in Space                              │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                    STAGE 2: MODEL BUILDING                           │
│                    (Model Builder)                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Step 7: ANALYZE                                                     │
│  ├── Read QVD files from Stage 1                                     │
│  ├── Sample data for analysis                                        │
│  ├── Classify tables:                                                │
│  │   • fact (contains measures)                                      │
│  │   • dimension (contains attributes)                               │
│  │   • link (bridge tables)                                          │
│  │   • calendar (date tables)                                        │
│  ├── Detect relationships                                            │
│  └── Identify date fields for calendar generation                    │
│                                                                      │
│  Step 8: MODEL TYPE                                                  │
│  ├── Show analysis results                                           │
│  ├── Present model type recommendations:                             │
│  │   • star_schema (central fact + dimensions)                       │
│  │   • snowflake (normalized dimensions)                             │
│  │   • link_table (M:N relationships)                                │
│  │   • concatenated (multiple facts)                                 │
│  └── User selects model type                                         │
│                                                                      │
│  Step 9: BUILD (Stages A-F)                                          │
│  ├── Stage A: Configuration & setup                                  │
│  ├── Stage B: Dimension tables                                       │
│  ├── Stage C: Fact tables                                            │
│  ├── Stage D: Calendar/Date tables                                   │
│  ├── Stage E: Link tables (if needed)                                │
│  ├── Stage F: Final review & optimization                            │
│  └── User approves each stage before continuing                      │
│                                                                      │
│  Step 10: REVIEW                                                     │
│  ├── Assemble full script from all stages                            │
│  ├── Send to Gemini for AI review                                    │
│  ├── Show issues (critical/warning/info)                             │
│  ├── Fix issues and re-review if needed                              │
│  └── Approval when score >= 80                                       │
│                                                                      │
│  Step 11: DEPLOY                                                     │
│  ├── Final validation                                                │
│  ├── Deploy complete ETL model to Qlik Cloud                         │
│  ├── Run initial reload                                              │
│  └── OUTPUT: Complete ETL Model App                                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Data Flow Between Stages

```
STAGE 1 OUTPUT                    STAGE 2 INPUT
──────────────                    ─────────────
ProjectState {                    Stage1Input {
  space: SpaceConfig                version: string
  connection: ConnectionConfig      source: string
  tables: TableConfig[]      →      tables: Stage1Table[]
  generatedScript: string           relationship_hints: RelationshipHint[]
  qvdPath: string                 }
}
                                  QvdSampleData[] (from QVD files)
```

---

## 5. Type Definitions Reference

### Stage 1 Types (`src/wizard/types.ts`)

```typescript
type WizardStepId = 'space_setup' | 'data_source' | 'table_selection'
                  | 'field_mapping' | 'incremental_config' | 'review' | 'deploy'

type DataSourceType = 'sqlserver' | 'oracle' | 'postgresql' | 'mysql'
                    | 'rest_api' | 'excel' | 'csv' | 'json' | 'qvd'

type IncrementalStrategy = 'none' | 'by_date' | 'by_id' | 'time_window' | 'custom'

interface ProjectState {
  id: string
  name: string
  currentStep: WizardStepId
  space: SpaceConfig | null
  connection: ConnectionConfig | null
  tables: TableConfig[]
  generatedScript?: string
  qvdPath?: string
  appId?: string
}
```

### Stage 2 Types (`src/model-builder/types.ts`)

```typescript
type ModelType = 'star_schema' | 'snowflake' | 'link_table' | 'concatenated'

type BuildStage = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'

type TableClassification = 'fact' | 'dimension' | 'link' | 'calendar'

interface ModelBuilderSession {
  session_id: string
  project_name: string
  current_stage: BuildStage
  completed_stages: BuildStage[]
  model_type: ModelType | null
  approved_script_parts: Partial<Record<BuildStage, string>>
  pending_tables: string[]
  gemini_reviews: GeminiReviewResponse[]
}
```

---

## 6. Web App UI Mapping

| Step | Route | Page Component | Backend |
|------|-------|----------------|---------|
| 1 | `/connect` | ConnectPage | Qlik Cloud API |
| 2 | `/source` | SourcePage | WizardEngine.setConnection() |
| 3 | `/tables` | TablesPage | WizardEngine.setTables() |
| 4 | `/fields` | FieldsPage | WizardEngine.updateTable() |
| 5 | `/incremental` | IncrementalPage | WizardEngine.setTableIncremental() |
| 6 | `/extract` | ExtractPage | WizardEngine.generateScript() + deploy() |
| 7 | `/analyze` | AnalyzePage | ModelBuilder.processInput() |
| 8 | `/model-type` | ModelTypePage | ModelBuilder.selectModelType() |
| 9 | `/build` | BuildPage | ModelBuilder.buildStage() + approveStage() |
| 10 | `/review` | ReviewPage | ModelBuilder.requestReview() |
| 11 | `/deploy` | DeployPage | Deploy to Qlik Cloud |

---

## 7. State Management

### Zustand Store Structure

```typescript
interface AppState {
  // Global
  projectName: string
  currentStep: number  // 1-11

  // Stage 1 State (Wizard)
  wizard: {
    space: SpaceConfig | null
    connection: ConnectionConfig | null
    tables: TableConfig[]
    generatedScript: string | null
    qvdPath: string | null
  }

  // Stage 2 State (Model Builder)
  modelBuilder: {
    session: ModelBuilderSession | null
    enrichedSpec: EnrichedModelSpec | null
    analysisResult: AnalysisResult | null
    currentBuildStage: BuildStage
    approvedScripts: Record<BuildStage, string>
    geminiReviews: GeminiReviewResponse[]
  }

  // Actions
  setStep: (step: number) => void
  nextStep: () => void
  prevStep: () => void
  // ... wizard actions
  // ... model builder actions
}
```

---

## 8. API Integration

### Stage 1 APIs
- Qlik Cloud Spaces API: `GET/POST /spaces`
- Qlik Cloud Connections API: `GET/POST /data-connections`
- Qlik Cloud Apps API: `POST /apps`, `PUT /apps/{id}/script`
- Qlik Cloud Reload API: `POST /apps/{id}/reload`

### Stage 2 APIs
- Gemini API: Script review
- QVD Reader: Sample data from QVD files

---

## 9. Branch Reference

| Branch | Content |
|--------|---------|
| `stage1-testing` | Complete Stage 1 (Wizard) + Stage 2 (Model Builder) implementation |
| `feature/ui-design` | Web App UI (needs to be aligned with this flow) |
| `develop` | Main development branch |

---

## 10. Next Steps

1. **Align Web App** - Update the web-app to match this 11-step flow
2. **Connect to Backend** - Wire up pages to WizardEngine and ModelBuilder
3. **Test End-to-End** - Full flow from data source to deployed ETL model

---

## 11. File Locations

```
QlikModelBuilder/
├── src/
│   ├── wizard/              # Stage 1: Data Extraction
│   │   ├── wizard-engine.ts
│   │   ├── step-manager.ts
│   │   ├── state-store.ts
│   │   ├── script-generator.ts
│   │   └── types.ts
│   │
│   └── model-builder/       # Stage 2: Model Building
│       ├── model-builder.ts
│       ├── types.ts
│       └── services/
│           ├── session-manager.ts
│           ├── input-processor.ts
│           ├── analyzer.ts
│           ├── scope-guard.ts
│           ├── script-builder.ts
│           ├── gemini-reviewer.ts
│           └── logger.ts
│
├── web-app/                 # React Web App
│   └── src/
│       ├── store/           # Zustand state
│       ├── pages/           # Step pages
│       └── components/      # UI components
│
└── docs/plans/
    └── 2026-01-21-unified-webapp-flow-design.md  # THIS FILE
```
