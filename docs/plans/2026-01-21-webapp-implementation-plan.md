# QlikModelBuilder Web App - Implementation Plan

**Date:** 2026-01-21
**Version:** 3.5.0
**Status:** 🔄 PENDING GEMINI REVIEW
**Score History:** v1.0: 60 → v2.0: 87 → v2.1: 94 → v2.2: 97 → v3.0: 99 → v3.1: 100 → v3.2: +E2E (95) → v3.3: (95) → v3.4: (95) → v3.5: +Gemini details, CI/CD workflow diagram

---

## 1. Executive Summary

Implement a React-based Web App that provides a unified 11-step wizard combining Stage 1 (Data Extraction) and Stage 2 (Model Building) into a single end-to-end flow.

**Goal:** From data source to complete ETL model in Qlik Cloud.

**Key Improvements in v2.0:**
- State persistence with Zustand persist middleware (sessionStorage)
- Detailed Build Stages A-F specifications
- Feature-based architecture
- Cross-cutting concerns as architecture (not tasks)
- API clients moved to Phase 1
- Comprehensive NFRs
- Detailed testing strategy with coverage targets

---

## 2. Technical Stack

| Layer | Technology | Justification |
|-------|------------|---------------|
| Framework | React 18 + TypeScript | Type safety, ecosystem |
| Build | Vite | Fast HMR, modern bundling |
| State | Zustand + persist | Simple, browser persistence |
| Routing | React Router v6 | Standard, nested routes |
| UI | Shadcn/ui + Tailwind | Consistent design system |
| Forms | React Hook Form + Zod | Validation, type inference |
| API | TanStack Query | Caching, loading states |
| Testing | Vitest + React Testing Library + Playwright | Unit, integration, E2E |
| Observability | Sentry + LogRocket | Errors, session replay |

---

## 3. Architecture

### 3.1 Feature-Based Directory Structure

```
web-app/
├── src/
│   ├── api/                          # API clients (Phase 1)
│   │   ├── clients/
│   │   │   ├── qlik-client.ts        # Qlik Cloud API
│   │   │   ├── wizard-client.ts      # Stage 1 API
│   │   │   └── model-builder-client.ts # Stage 2 API
│   │   ├── hooks/
│   │   │   ├── useQlikQuery.ts       # TanStack Query hooks
│   │   │   ├── useWizardMutation.ts
│   │   │   └── useModelBuilderQuery.ts
│   │   └── index.ts
│   │
│   ├── features/                     # Feature modules
│   │   ├── step01-connect/
│   │   │   ├── components/
│   │   │   │   ├── ConnectForm.tsx
│   │   │   │   ├── SpaceSelector.tsx
│   │   │   │   └── TenantInput.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useConnectStep.ts
│   │   │   ├── Step01Connect.tsx     # Page component
│   │   │   └── index.ts
│   │   │
│   │   ├── step02-source/
│   │   │   ├── components/
│   │   │   │   ├── SourceTypeCards.tsx
│   │   │   │   ├── DatabaseForm.tsx
│   │   │   │   ├── ApiForm.tsx
│   │   │   │   └── FileUpload.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useSourceConfig.ts
│   │   │   ├── Step02Source.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── step03-tables/
│   │   ├── step04-fields/
│   │   ├── step05-incremental/
│   │   ├── step06-extract/
│   │   ├── step07-analyze/
│   │   ├── step08-model-type/
│   │   ├── step09-build/
│   │   │   ├── components/
│   │   │   │   ├── StageTabs.tsx
│   │   │   │   ├── StageA.tsx        # Configuration
│   │   │   │   ├── StageB.tsx        # Dimensions
│   │   │   │   ├── StageC.tsx        # Facts
│   │   │   │   ├── StageD.tsx        # Calendar
│   │   │   │   ├── StageE.tsx        # Links
│   │   │   │   └── StageF.tsx        # Final
│   │   │   ├── Step09Build.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── step10-review/
│   │   └── step11-deploy/
│   │
│   ├── shared/                       # Shared components & utils
│   │   ├── components/
│   │   │   ├── ui/                   # Shadcn components
│   │   │   ├── layout/
│   │   │   │   ├── AppLayout.tsx
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   └── StepIndicator.tsx
│   │   │   └── feedback/
│   │   │       ├── LoadingSpinner.tsx
│   │   │       ├── ErrorBoundary.tsx
│   │   │       ├── ErrorDisplay.tsx
│   │   │       └── Toast.tsx
│   │   │
│   │   ├── hooks/
│   │   │   ├── useLocalStorage.ts
│   │   │   ├── useDebounce.ts
│   │   │   └── useMediaQuery.ts
│   │   │
│   │   └── utils/
│   │       ├── cn.ts                 # Class merge util
│   │       ├── validation.ts         # Zod schemas
│   │       └── formatters.ts
│   │
│   ├── store/                        # Zustand stores with persistence
│   │   ├── appStore.ts               # Global + navigation
│   │   ├── wizardStore.ts            # Stage 1 state
│   │   ├── modelBuilderStore.ts      # Stage 2 state
│   │   └── index.ts
│   │
│   ├── types/                        # TypeScript types
│   │   ├── wizard.types.ts           # From src/wizard/types.ts
│   │   ├── model-builder.types.ts    # From src/model-builder/types.ts
│   │   └── api.types.ts              # API response types
│   │
│   ├── config/                       # Configuration
│   │   ├── routes.ts                 # Route definitions
│   │   ├── steps.ts                  # Step metadata
│   │   └── constants.ts              # App constants
│   │
│   ├── App.tsx                       # Router setup
│   ├── main.tsx                      # Entry point
│   └── index.css                     # Tailwind imports
│
├── tests/
│   ├── unit/                         # Unit tests
│   ├── integration/                  # Integration tests
│   └── e2e/                          # Playwright E2E
│
├── public/
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── vite.config.ts
└── playwright.config.ts
```

### 3.2 State Management with Persistence

**CRITICAL:** All stores use Zustand's `persist` middleware to prevent data loss on page refresh.

**appStore.ts:**
```typescript
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface AppState {
  // State
  currentStep: number
  maxReachedStep: number
  projectName: string
  projectId: string | null

  // UI State
  isLoading: boolean
  error: AppError | null

  // Actions
  setStep: (step: number) => void
  nextStep: () => void
  prevStep: () => void
  canGoToStep: (step: number) => boolean
  setProjectName: (name: string) => void
  setProjectId: (id: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: AppError | null) => void
  reset: () => void
}

interface AppError {
  code: string
  message: string
  details?: Record<string, unknown>
  recoverable: boolean
}

const initialState = {
  currentStep: 1,
  maxReachedStep: 1,
  projectName: '',
  projectId: null,
  isLoading: false,
  error: null,
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setStep: (step) => {
        const { maxReachedStep } = get()
        set({
          currentStep: step,
          maxReachedStep: Math.max(step, maxReachedStep)
        })
      },

      nextStep: () => {
        const { currentStep, maxReachedStep } = get()
        if (currentStep < 11) {
          set({
            currentStep: currentStep + 1,
            maxReachedStep: Math.max(currentStep + 1, maxReachedStep)
          })
        }
      },

      prevStep: () => {
        const { currentStep } = get()
        if (currentStep > 1) {
          set({ currentStep: currentStep - 1 })
        }
      },

      canGoToStep: (step) => {
        const { maxReachedStep } = get()
        return step <= maxReachedStep
      },

      setProjectName: (name) => set({ projectName: name }),
      setProjectId: (id) => set({ projectId: id }),
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      reset: () => set(initialState),
    }),
    {
      name: 'qmb-app-state',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        currentStep: state.currentStep,
        maxReachedStep: state.maxReachedStep,
        projectName: state.projectName,
        projectId: state.projectId,
      }),
    }
  )
)
```

**wizardStore.ts:**
```typescript
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { SpaceConfig, ConnectionConfig, TableConfig, IncrementalConfig } from '@/types/wizard.types'

interface WizardState {
  // State
  space: SpaceConfig | null
  connection: ConnectionConfig | null
  tables: TableConfig[]
  generatedScript: string | null
  extractResult: ExtractResult | null

  // Actions
  setSpace: (space: SpaceConfig) => void
  setConnection: (connection: ConnectionConfig) => void
  addTable: (table: TableConfig) => void
  updateTable: (name: string, updates: Partial<TableConfig>) => void
  removeTable: (name: string) => void
  setTables: (tables: TableConfig[]) => void
  setTableIncremental: (name: string, config: IncrementalConfig) => void
  setGeneratedScript: (script: string) => void
  setExtractResult: (result: ExtractResult) => void
  reset: () => void
}

interface ExtractResult {
  success: boolean
  qvdPaths: string[]
  appId: string | null
  error?: string
}

const initialState = {
  space: null,
  connection: null,
  tables: [],
  generatedScript: null,
  extractResult: null,
}

export const useWizardStore = create<WizardState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setSpace: (space) => set({ space }),

      setConnection: (connection) => set({ connection }),

      addTable: (table) => set((state) => ({
        tables: [...state.tables, table]
      })),

      updateTable: (name, updates) => set((state) => ({
        tables: state.tables.map((t) =>
          t.name === name ? { ...t, ...updates } : t
        )
      })),

      removeTable: (name) => set((state) => ({
        tables: state.tables.filter((t) => t.name !== name)
      })),

      setTables: (tables) => set({ tables }),

      setTableIncremental: (name, config) => {
        const { updateTable } = get()
        updateTable(name, { incremental: config })
      },

      setGeneratedScript: (script) => set({ generatedScript: script }),

      setExtractResult: (result) => set({ extractResult: result }),

      reset: () => set(initialState),
    }),
    {
      name: 'qmb-wizard-state',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
)
```

**modelBuilderStore.ts:**
```typescript
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  ModelType,
  BuildStage,
  EnrichedModelSpec,
  AnalysisResult,
  GeminiReviewResponse
} from '@/types/model-builder.types'

interface ModelBuilderState {
  // State
  sessionId: string | null
  enrichedSpec: EnrichedModelSpec | null
  analysisResult: AnalysisResult | null
  modelType: ModelType | null
  currentBuildStage: BuildStage
  stageScripts: Partial<Record<BuildStage, StageScript>>
  geminiReviews: GeminiReviewResponse[]
  finalScript: string | null

  // Actions
  setSessionId: (id: string) => void
  setEnrichedSpec: (spec: EnrichedModelSpec) => void
  setAnalysisResult: (result: AnalysisResult) => void
  setModelType: (type: ModelType) => void
  setBuildStage: (stage: BuildStage) => void
  setStageScript: (stage: BuildStage, script: StageScript) => void
  approveStage: (stage: BuildStage) => void
  addGeminiReview: (review: GeminiReviewResponse) => void
  setFinalScript: (script: string) => void
  reset: () => void
}

interface StageScript {
  script: string
  validation: ValidationResult
  approved: boolean
  approvedAt?: string
}

interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

const initialState = {
  sessionId: null,
  enrichedSpec: null,
  analysisResult: null,
  modelType: null,
  currentBuildStage: 'A' as BuildStage,
  stageScripts: {},
  geminiReviews: [],
  finalScript: null,
}

export const useModelBuilderStore = create<ModelBuilderState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setSessionId: (id) => set({ sessionId: id }),

      setEnrichedSpec: (spec) => set({ enrichedSpec: spec }),

      setAnalysisResult: (result) => set({ analysisResult: result }),

      setModelType: (type) => set({ modelType: type }),

      setBuildStage: (stage) => set({ currentBuildStage: stage }),

      setStageScript: (stage, script) => set((state) => ({
        stageScripts: { ...state.stageScripts, [stage]: script }
      })),

      approveStage: (stage) => {
        const { stageScripts, setBuildStage } = get()
        const currentScript = stageScripts[stage]
        if (currentScript) {
          set((state) => ({
            stageScripts: {
              ...state.stageScripts,
              [stage]: { ...currentScript, approved: true, approvedAt: new Date().toISOString() }
            }
          }))
          // Auto-advance to next stage
          const stages: BuildStage[] = ['A', 'B', 'C', 'D', 'E', 'F']
          const currentIndex = stages.indexOf(stage)
          if (currentIndex < stages.length - 1) {
            setBuildStage(stages[currentIndex + 1])
          }
        }
      },

      addGeminiReview: (review) => set((state) => ({
        geminiReviews: [...state.geminiReviews, review]
      })),

      setFinalScript: (script) => set({ finalScript: script }),

      reset: () => set(initialState),
    }),
    {
      name: 'qmb-model-builder-state',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
)
```

### 3.3 Cross-Cutting Concerns Architecture

**Error Handling:**
```typescript
// shared/components/feedback/ErrorBoundary.tsx
import { Component, ErrorInfo, ReactNode } from 'react'
import * as Sentry from '@sentry/react'
import { ErrorDisplay } from './ErrorDisplay'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    Sentry.captureException(error, { extra: { errorInfo } })
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <ErrorDisplay
          error={this.state.error}
          onRetry={() => this.setState({ hasError: false, error: null })}
        />
      )
    }
    return this.props.children
  }
}
```

**Loading States:**
```typescript
// shared/components/feedback/LoadingOverlay.tsx
interface LoadingOverlayProps {
  isLoading: boolean
  message?: string
  children: ReactNode
}

export function LoadingOverlay({ isLoading, message, children }: LoadingOverlayProps) {
  return (
    <div className="relative">
      {children}
      {isLoading && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-50">
          <div className="flex flex-col items-center gap-2">
            <Spinner size="lg" />
            {message && <p className="text-sm text-muted-foreground">{message}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
```

**Toast Notifications:**
```typescript
// shared/hooks/useToast.ts - using shadcn/ui toast
import { toast } from '@/shared/components/ui/use-toast'

export function useAppToast() {
  return {
    success: (message: string) => toast({ title: 'Success', description: message, variant: 'default' }),
    error: (message: string) => toast({ title: 'Error', description: message, variant: 'destructive' }),
    warning: (message: string) => toast({ title: 'Warning', description: message, variant: 'warning' }),
    info: (message: string) => toast({ title: 'Info', description: message }),
  }
}
```

---

## 4. Build Stages A-F Detailed Specification

### Stage A: Configuration & Setup

**Purpose:** Initialize model configuration, set global variables, create master calendar parameters.

**Inputs:**
- EnrichedModelSpec (from Step 7 analysis)
- ModelType (from Step 8 selection)

**Outputs:**
```qlik
//=============================================================================
// STAGE A: CONFIGURATION
// Generated: $(=Now())
// Model Type: Star Schema
//=============================================================================

SET ThousandSep=',';
SET DecimalSep='.';
SET MoneyThousandSep=',';
SET MoneyDecimalSep='.';
SET MoneyFormat='$ #,##0.00;-$ #,##0.00';
SET TimeFormat='hh:mm:ss';
SET DateFormat='YYYY-MM-DD';
SET TimestampFormat='YYYY-MM-DD hh:mm:ss[.fff]';

// Model Parameters
LET vModelType = 'star_schema';
LET vProjectName = 'OlistModel';
LET vQVDPath = 'lib://DataFiles/$(vProjectName)/';

// Calendar Parameters
LET vCalendarStartDate = Num(MakeDate(2016, 1, 1));
LET vCalendarEndDate = Num(Today());
```

**Validation Rules:**
- All SET statements valid
- LET variables properly quoted
- QVD path exists and accessible
- Date formats consistent

**UI:**
- Read-only preview of generated config
- Edit button for advanced users
- Validation status badge

---

### Stage B: Dimension Tables

**Purpose:** Generate LOAD statements for all dimension tables with proper key handling.

**Inputs:**
- Tables classified as 'dimension' from AnalysisResult
- Field mappings with PK/BK/FK designations

**Outputs (per dimension):**
```qlik
//=============================================================================
// DIMENSION: DimCustomer
// Source: olist_customers_dataset
// Type: SCD Type 1 (Overwrite)
//=============================================================================

DimCustomer:
LOAD
    // Surrogate Key
    AutoNumber(customer_id) as CustomerKey,

    // Business Key
    customer_id as Customer_BK,

    // Attributes
    customer_unique_id,
    customer_zip_code_prefix,
    customer_city,
    customer_state

FROM [$(vQVDPath)olist_customers_dataset.qvd] (qvd);

// Key mapping for facts
CustomerKeyMap:
MAPPING LOAD
    customer_id,
    CustomerKey
RESIDENT DimCustomer;
```

**Validation Rules:**
- AutoNumber for surrogate keys
- Business key preserved
- Mapping table created for FK resolution
- All fields from spec included
- No duplicate field aliases

**UI:**
- Table accordion (one per dimension)
- Field list with key type badges
- Preview sample data
- Approve/Reject per table

---

### Stage C: Fact Tables

**Purpose:** Generate LOAD statements for fact tables with FK resolution and measures.

**Inputs:**
- Tables classified as 'fact' from AnalysisResult
- FK relationships from spec
- Mapping tables from Stage B

**Outputs:**
```qlik
//=============================================================================
// FACT: FactOrders
// Source: olist_orders_dataset
// Grain: One row per order
//=============================================================================

FactOrders:
LOAD
    // Surrogate Key
    AutoNumber(order_id) as OrderKey,

    // Foreign Keys (resolved via mapping)
    ApplyMap('CustomerKeyMap', customer_id, -1) as CustomerKey,

    // Degenerate Dimensions
    order_id as Order_DD,
    order_status,

    // Dates (for calendar linking)
    Date(Floor(order_purchase_timestamp)) as OrderDate,

    // Measures
    1 as OrderCount

FROM [$(vQVDPath)olist_orders_dataset.qvd] (qvd);
```

**Validation Rules:**
- All FK columns mapped
- ApplyMap default value is -1 (unknown)
- Date fields properly formatted
- Measures aggregatable
- Grain documented

**UI:**
- Fact table list with relationship diagram
- FK mapping preview
- Grain description
- Measure list

---

### Stage D: Calendar/Date Tables

**Purpose:** Generate master calendar dimension for time-based analysis.

**Inputs:**
- Date range from vCalendarStartDate/vCalendarEndDate
- Date fields detected in facts

**Outputs:**
```qlik
//=============================================================================
// CALENDAR: MasterCalendar
// Range: $(=Date($(vCalendarStartDate))) to $(=Date($(vCalendarEndDate)))
//=============================================================================

TempCalendar:
LOAD
    Date($(vCalendarStartDate) + IterNo() - 1) as TempDate
AUTOGENERATE 1
WHILE $(vCalendarStartDate) + IterNo() - 1 <= $(vCalendarEndDate);

MasterCalendar:
LOAD
    TempDate as Date,
    Year(TempDate) as Year,
    Month(TempDate) as Month,
    MonthName(TempDate) as MonthName,
    Day(TempDate) as Day,
    WeekDay(TempDate) as WeekDay,
    Week(TempDate) as Week,
    Quarter(TempDate) as Quarter,
    'Q' & Quarter(TempDate) & '-' & Year(TempDate) as QuarterYear,
    MonthName(TempDate) & '-' & Year(TempDate) as MonthYear,
    If(WeekDay(TempDate) >= 5, 'Weekend', 'Weekday') as DayType,
    Dual(Year(TempDate) & '-' & Num(Month(TempDate), '00'), Year(TempDate) * 12 + Month(TempDate)) as YearMonth
RESIDENT TempCalendar;

DROP TABLE TempCalendar;
```

**Validation Rules:**
- Date range covers all fact dates
- All date components generated
- YearMonth sortable (Dual function)
- No orphan dates

**UI:**
- Date range selector
- Calendar preview (sample)
- Fiscal year option
- Custom date attributes

---

### Stage E: Link Tables (if Snowflake/Link model)

**Purpose:** Generate link tables for many-to-many or complex relationships.

**Inputs:**
- Relationship analysis showing M:M
- Tables requiring link resolution

**Outputs:**
```qlik
//=============================================================================
// LINK TABLE: LinkOrderItems
// Resolves: Orders <-> Products <-> Sellers
//=============================================================================

LinkOrderItems:
LOAD DISTINCT
    // Composite Key
    AutoNumber(order_id & '|' & product_id & '|' & seller_id) as LinkKey,

    // Foreign Keys
    ApplyMap('OrderKeyMap', order_id, -1) as OrderKey,
    ApplyMap('ProductKeyMap', product_id, -1) as ProductKey,
    ApplyMap('SellerKeyMap', seller_id, -1) as SellerKey,

    // Measures at this grain
    price as ItemPrice,
    freight_value as ItemFreight,
    1 as ItemCount

FROM [$(vQVDPath)olist_order_items_dataset.qvd] (qvd);
```

**Validation Rules:**
- Composite key unique
- All FK references valid
- Measures at correct grain
- DISTINCT to avoid duplication

**UI:**
- Link table builder
- Relationship visualization
- Composite key preview
- Grain verification

---

### Stage F: Final Assembly & Review

**Purpose:** Combine all stages, add cleanup, generate final script.

**Inputs:**
- Approved scripts from Stages A-E
- Final validation rules

**Outputs:**
```qlik
//=============================================================================
// QLIKMODELBUILDER - GENERATED ETL MODEL
// Project: $(vProjectName)
// Generated: $(=Now())
// Model Type: $(vModelType)
//=============================================================================

// [Stage A: Configuration]
$(Include=StageA.qvs);

// [Stage B: Dimensions]
$(Include=StageB.qvs);

// [Stage C: Facts]
$(Include=StageC.qvs);

// [Stage D: Calendar]
$(Include=StageD.qvs);

// [Stage E: Links]
$(Include=StageE.qvs);

//=============================================================================
// CLEANUP
//=============================================================================

// Drop mapping tables
DROP TABLE CustomerKeyMap;
DROP TABLE ProductKeyMap;
DROP TABLE SellerKeyMap;
DROP TABLE OrderKeyMap;

// Set variables for UI
LET vTableCount = NoOfTables();
LET vRowCount = NoOfRows('FactOrders');
LET vLastReload = Now();
```

**Validation Rules:**
- All DROP statements reference created tables
- Include paths valid
- Variables set for documentation
- No circular references
- Script executes without error

**UI:**
- Full script preview with syntax highlighting
- Execution simulation result
- Table statistics
- Relationship diagram
- "Ready for Gemini Review" button

---

## 5. AI Integration Specifications

### 5.1 Gemini API Configuration

```typescript
// api/clients/gemini-client.ts
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY)

export const geminiClient = {
  model: genAI.getGenerativeModel({ model: 'gemini-2.5-pro' }),

  async reviewScript(script: string, spec: EnrichedModelSpec): Promise<GeminiReviewResponse> {
    const prompt = buildReviewPrompt(script, spec)
    const result = await this.model.generateContent(prompt)
    return parseReviewResponse(result.response.text())
  }
}
```

### 5.2 Review Prompt Template

```typescript
function buildReviewPrompt(script: string, spec: EnrichedModelSpec): string {
  return `
You are a Qlik Sense ETL expert reviewing a generated data model script.

## Specification
- Model Type: ${spec.modelType}
- Tables: ${spec.tables.length}
- Relationships: ${spec.relationships.length}
- Fact Tables: ${spec.tables.filter(t => t.classification === 'fact').map(t => t.name).join(', ')}
- Dimension Tables: ${spec.tables.filter(t => t.classification === 'dimension').map(t => t.name).join(', ')}

## Script to Review
\`\`\`qlik
${script}
\`\`\`

## Review Criteria
1. Syntax correctness (Qlik script syntax)
2. Key integrity (PK/FK/BK properly handled)
3. Star schema adherence (if applicable)
4. Performance (avoid nested loads, use QVD optimization)
5. Maintainability (comments, clear naming)
6. Completeness (all tables/fields from spec)

## Required Response Format (JSON)
{
  "score": <number 0-100>,
  "summary": "<brief assessment>",
  "issues": [
    {
      "severity": "critical|warning|info",
      "category": "<category>",
      "description": "<issue description>",
      "line": <line number or null>,
      "suggestion": "<fix suggestion>"
    }
  ],
  "strengths": ["<strength 1>", "<strength 2>"],
  "approved": <boolean - true if score >= 80>
}
`
}
```

### 5.3 Response Schema

```typescript
interface GeminiReviewResponse {
  score: number                    // 0-100
  summary: string                  // Brief assessment
  issues: GeminiIssue[]           // List of issues found
  strengths: string[]              // Positive aspects
  approved: boolean                // Auto-approve if score >= 80
  reviewedAt: string               // ISO timestamp
  modelVersion: string             // gemini-2.5-pro
}

interface GeminiIssue {
  severity: 'critical' | 'warning' | 'info'
  category: 'syntax' | 'keys' | 'schema' | 'performance' | 'maintainability' | 'completeness'
  description: string
  line: number | null
  suggestion: string
}
```

### 5.4 Gemini Integration Details (NEW)

**Purpose:** Gemini AI provides automated expert review of generated Qlik scripts, identifying issues a human expert would catch, reducing review time and catching errors early.

**Workflow Integration:**
| Step | Gemini Role | Data Sent | Data Received |
|------|-------------|-----------|---------------|
| Step 10: Review | Script Review | Generated Qlik script + table spec (names, types, counts) | Score, issues, suggestions |
| Step 7: Analyze (optional) | Table Classification Assistance | Table names + field names | Classification suggestions (fact/dimension) |

**Data Privacy & Security:**

1. **What data is sent to Gemini:**
   - Generated Qlik script (text only, no actual data)
   - Table metadata: names, field names, data types
   - Relationship structure
   - NO actual data from user's database
   - NO connection credentials
   - NO personal data

2. **Data handling:**
   ```typescript
   // BEFORE sending to Gemini, sanitize any potentially sensitive info
   function sanitizeForReview(script: string): string {
     // Remove any connection strings that might have slipped in
     return script
       .replace(/connectionstring=[^;]+/gi, 'connectionstring=[REDACTED]')
       .replace(/password=[^;]+/gi, 'password=[REDACTED]')
       .replace(/lib:\/\/[^/]+/g, 'lib://[PATH]')
   }
   ```

3. **User consent:**
   - First review shows consent dialog explaining what data is sent
   - User can opt-out and do manual review instead
   - Consent stored in localStorage (separate from session)

4. **Rate limiting & Error handling:**
   ```typescript
   // Gemini rate limit: 60 RPM for free tier
   const GEMINI_RATE_LIMIT = {
     maxRequestsPerMinute: 60,
     retryDelay: 1000,
     maxRetries: 3,
   }

   async function safeGeminiCall<T>(fn: () => Promise<T>): Promise<T> {
     return fetchWithRetry(fn, {
       maxRetries: GEMINI_RATE_LIMIT.maxRetries,
       baseDelay: GEMINI_RATE_LIMIT.retryDelay,
       onRetry: (attempt) => {
         toast.info(`AI review rate limited, retrying (${attempt}/3)...`)
       }
     })
   }
   ```

5. **Fallback when Gemini unavailable:**
   - Show manual review checklist instead
   - User can approve manually with acknowledgment
   - Log that review was skipped for audit

---

## 6. Implementation Phases

### Phase 1: Foundation & API Clients (Tasks 1-8)

| Task | Description | Files | Priority |
|------|-------------|-------|----------|
| 1.1 | Create feature directory structure | All folders | P0 |
| 1.2 | Setup Zustand stores with persistence | 3 stores | P0 |
| 1.3 | Create API clients (Qlik, Wizard, ModelBuilder) | 3 clients | P0 |
| 1.4 | Setup TanStack Query provider & hooks | api/hooks/* | P0 |
| 1.5 | Create shared layout components | shared/components/layout/* | P0 |
| 1.6 | Create feedback components | shared/components/feedback/* | P0 |
| 1.7 | Setup router with step guards | config/routes.ts, App.tsx | P0 |
| 1.8 | Configure Sentry & LogRocket | main.tsx | P1 |

### Phase 2: Stage 1 Features (Tasks 9-14)

| Task | Description | Files | Dependencies |
|------|-------------|-------|--------------|
| 2.1 | Step01Connect feature | features/step01-connect/* | Phase 1 |
| 2.2 | Step02Source feature | features/step02-source/* | 2.1 |
| 2.3 | Step03Tables feature | features/step03-tables/* | 2.2 |
| 2.4 | Step04Fields feature | features/step04-fields/* | 2.3 |
| 2.5 | Step05Incremental feature | features/step05-incremental/* | 2.4 |
| 2.6 | Step06Extract feature | features/step06-extract/* | 2.5 |

### Phase 3: Stage 2 Features (Tasks 15-19)

| Task | Description | Files | Dependencies |
|------|-------------|-------|--------------|
| 3.1 | Step07Analyze feature | features/step07-analyze/* | Phase 2 |
| 3.2 | Step08ModelType feature | features/step08-model-type/* | 3.1 |
| 3.3 | Step09Build feature (stages A-F) | features/step09-build/* | 3.2 |
| 3.4 | Step10Review feature (Gemini) | features/step10-review/* | 3.3 |
| 3.5 | Step11Deploy feature | features/step11-deploy/* | 3.4 |

### Phase 4: Polish & Testing (Tasks 20-24)

| Task | Description | Files | Priority |
|------|-------------|-------|----------|
| 4.1 | Unit tests (stores, utils) | tests/unit/* | P0 |
| 4.2 | Integration tests (features) | tests/integration/* | P0 |
| 4.3 | E2E tests (full flow) | tests/e2e/* | P0 |
| 4.4 | Accessibility audit & fixes | All components | P1 |
| 4.5 | Performance optimization | Lazy loading, memoization | P1 |

---

## 7. Non-Functional Requirements (NFRs)

### 7.1 Performance

| Metric | Target | Measurement |
|--------|--------|-------------|
| Lighthouse Performance | > 90 | CI/CD check |
| First Contentful Paint | < 1.5s | Lighthouse |
| Time to Interactive | < 3s | Lighthouse |
| Bundle Size (gzipped) | < 200KB | Vite build |
| API Response Time | < 2s | TanStack Query |

**Implementation:**
- React.lazy for route-based code splitting
- useMemo/useCallback for expensive computations
- Virtual scrolling for large table lists (> 100 rows)
- Debounced inputs (300ms)
- Image optimization (WebP, lazy loading)

### 7.2 Security

| Requirement | Implementation |
|-------------|----------------|
| XSS Prevention | React's default escaping, DOMPurify for user content |
| CSRF Protection | Same-origin cookies, token validation |
| Secrets Management | Environment variables, no hardcoded keys |
| Input Validation | Zod schemas on all inputs |
| Content Security Policy | Strict CSP headers |

**API Security:**
```typescript
// No credentials in code
const config = {
  qlikTenant: import.meta.env.VITE_QLIK_TENANT,
  // API key stored in secure httpOnly cookie after OAuth
}
```

### 7.3 Accessibility (WCAG 2.1 AA)

| Requirement | Implementation |
|-------------|----------------|
| Keyboard Navigation | All interactive elements focusable, logical tab order |
| Screen Reader | ARIA labels, live regions for updates |
| Color Contrast | 4.5:1 minimum ratio |
| Focus Indicators | Visible focus rings |
| Error Announcements | aria-live for validation errors |

**Testing:**
- axe-core in CI
- Manual screen reader testing (NVDA/VoiceOver)

### 7.4 Observability

| Tool | Purpose |
|------|---------|
| Sentry | Error tracking, performance monitoring |
| LogRocket | Session replay, user journey |
| Custom Logging | Structured logs for debugging |

```typescript
// Structured logging
import * as Sentry from '@sentry/react'

export function logStepComplete(step: number, duration: number) {
  Sentry.addBreadcrumb({
    category: 'wizard',
    message: `Step ${step} completed`,
    level: 'info',
    data: { step, duration }
  })
}
```

---

## 8. Testing Strategy

### 8.1 Unit Tests (Vitest)

**Target Coverage:** 80% for stores and utils

```typescript
// tests/unit/stores/appStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '@/store/appStore'

describe('appStore', () => {
  beforeEach(() => {
    useAppStore.getState().reset()
  })

  it('should advance to next step', () => {
    const { nextStep, currentStep } = useAppStore.getState()
    expect(currentStep).toBe(1)
    nextStep()
    expect(useAppStore.getState().currentStep).toBe(2)
    expect(useAppStore.getState().maxReachedStep).toBe(2)
  })

  it('should not allow skipping steps', () => {
    const { canGoToStep } = useAppStore.getState()
    expect(canGoToStep(1)).toBe(true)
    expect(canGoToStep(5)).toBe(false) // Not reached yet
  })

  it('should persist state to sessionStorage', () => {
    const { setProjectName } = useAppStore.getState()
    setProjectName('TestProject')

    // Simulate page reload
    const stored = JSON.parse(sessionStorage.getItem('qmb-app-state') || '{}')
    expect(stored.state.projectName).toBe('TestProject')
  })
})
```

### 8.2 Integration Tests (React Testing Library)

**Target Coverage:** All critical user flows

```typescript
// tests/integration/step01-connect.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Step01Connect } from '@/features/step01-connect'
import { TestProviders } from '@/tests/utils/providers'

describe('Step01Connect', () => {
  it('should enable Next button when space is selected', async () => {
    render(<Step01Connect />, { wrapper: TestProviders })

    // Initially disabled
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()

    // Fill project name
    fireEvent.change(screen.getByLabelText(/project name/i), {
      target: { value: 'MyProject' }
    })

    // Select space
    fireEvent.click(screen.getByText(/development/i))

    // Now enabled
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /next/i })).toBeEnabled()
    })
  })
})
```

### 8.3 E2E Tests (Playwright)

**Target:** Complete flow with mocked APIs

```typescript
// tests/e2e/full-flow.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Full Wizard Flow', () => {
  test('should complete all 11 steps', async ({ page }) => {
    await page.goto('/')

    // Step 1: Connect
    await page.fill('[data-testid="project-name"]', 'E2E Test Project')
    await page.click('[data-testid="space-development"]')
    await page.click('[data-testid="next-button"]')

    // Step 2: Source
    await expect(page).toHaveURL('/source')
    await page.click('[data-testid="source-database"]')
    // ... continue through all steps

    // Step 11: Deploy
    await expect(page).toHaveURL('/deploy')
    await page.click('[data-testid="deploy-button"]')
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
  })
})
```

---

## 9. Success Criteria

| Criterion | Metric | Validation |
|-----------|--------|------------|
| All 11 steps implemented | 11/11 features | Manual test |
| State persistence | Data survives refresh | E2E test |
| Build stages A-F | All 6 stages functional | Integration test |
| Gemini integration | Review returns score | API test |
| Performance | Lighthouse > 90 | CI check |
| Accessibility | WCAG 2.1 AA | axe-core |
| Test coverage | > 80% | Coverage report |
| Error handling | User-friendly messages | Manual test |
| Mobile responsive | Works on 375px+ | Visual test |

---

## 10. Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Qlik API changes | Low | High | Use official SDK, version lock |
| Gemini rate limits | Medium | Medium | Retry with exponential backoff |
| Large QVD files | Medium | Medium | Streaming, progress indicators |
| Auth token expiry | High | Low | Auto-refresh, session persistence |
| Browser storage full | Low | Medium | Cleanup old sessions, warn user |
| Offline usage | Medium | Low | Service worker for static assets |

---

## 11. Deployment Strategy

### 11.1 Environments

| Environment | Purpose | URL | Deploy Trigger |
|-------------|---------|-----|----------------|
| Development | Local development | localhost:5173 | Manual |
| Staging | QA & testing | staging.qmb.app | PR merge to develop |
| Production | End users | app.qmb.app | Tag release |

### 11.2 CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test:unit -- --coverage
      - run: npm run test:e2e
      - uses: codecov/codecov-action@v4

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/

  deploy-staging:
    needs: build
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/download-artifact@v4
      - uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
          accountId: ${{ secrets.CF_ACCOUNT_ID }}
          projectName: qmb-staging
          directory: dist

  deploy-production:
    needs: build
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/download-artifact@v4
      - uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
          accountId: ${{ secrets.CF_ACCOUNT_ID }}
          projectName: qmb-production
          directory: dist
```

### 11.3 Rollback Strategy

| Scenario | Action | Recovery Time |
|----------|--------|---------------|
| Build failure | Auto-reject merge | Immediate |
| Test failure | Block deployment | Immediate |
| Post-deploy issues | Cloudflare instant rollback | < 1 minute |
| Data corruption | Restore sessionStorage defaults | Manual |

**Rollback Procedure:**
1. Detect issue via Sentry alerts
2. Navigate to Cloudflare Pages dashboard
3. Click "Rollback" on previous deployment
4. Verify rollback via health check endpoint
5. Investigate root cause
6. Create hotfix PR

### 11.4 Health Checks & Monitoring

**Health Check Implementation:**

```typescript
// api/health.ts
export interface HealthCheck {
  name: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  latency: number
  lastChecked: string
  error?: string
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  checks: HealthCheck[]
  version: string
}

export async function healthCheck(): Promise<HealthStatus> {
  const checks = await Promise.all([
    checkQlikApiConnection(),
    checkGeminiApiConnection(),
    checkBrowserStorage(),
  ])

  const status = checks.every(c => c.status === 'healthy')
    ? 'healthy'
    : checks.some(c => c.status === 'unhealthy')
      ? 'unhealthy'
      : 'degraded'

  return {
    status,
    timestamp: new Date().toISOString(),
    checks,
    version: import.meta.env.VITE_APP_VERSION,
  }
}

// Individual check implementations
async function checkQlikApiConnection(): Promise<HealthCheck> {
  const start = Date.now()
  try {
    const response = await fetch(`${QLIK_TENANT}/api/v1/health`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${getToken()}` },
      signal: AbortSignal.timeout(5000),
    })
    return {
      name: 'qlik-api',
      status: response.ok ? 'healthy' : 'degraded',
      latency: Date.now() - start,
      lastChecked: new Date().toISOString(),
    }
  } catch (error) {
    return {
      name: 'qlik-api',
      status: 'unhealthy',
      latency: Date.now() - start,
      lastChecked: new Date().toISOString(),
      error: error.message,
    }
  }
}
```

**Monitoring Integration:**

| Component | Tool | Purpose | Alert Threshold |
|-----------|------|---------|-----------------|
| Error Tracking | Sentry | Exception monitoring | Any uncaught error |
| Performance | Sentry Performance | Transaction tracing | P95 > 3s |
| Session Replay | LogRocket | User journey debugging | On error occurrence |
| Uptime | Cloudflare Analytics | Availability monitoring | < 99.9% uptime |
| Health Endpoint | UptimeRobot (free) | Periodic health checks | 3 consecutive failures |

**Alerting Configuration:**

```typescript
// Sentry alerting (configured in Sentry dashboard)
// Alert rules:
// 1. New issue → Slack #qmb-alerts
// 2. Issue spike (10+ events/hour) → PagerDuty
// 3. Performance regression → Slack #qmb-perf

// LogRocket integration
LogRocket.init('qmb/production', {
  release: import.meta.env.VITE_APP_VERSION,
  console: { isEnabled: true },
  network: {
    isEnabled: true,
    requestSanitizer: (request) => {
      // Redact sensitive headers
      if (request.headers.Authorization) {
        request.headers.Authorization = '[REDACTED]'
      }
      return request
    },
  },
})

// Connect LogRocket to Sentry
LogRocket.getSessionURL((sessionURL) => {
  Sentry.configureScope((scope) => {
    scope.setExtra('sessionURL', sessionURL)
  })
})
```

**Health Check Polling:**
- Development: Manual only (via /health route)
- Staging: Every 5 minutes via UptimeRobot
- Production: Every 1 minute via UptimeRobot + Cloudflare Analytics

### 11.5 Deployment Platform Justification

**Why Cloudflare Pages?**

| Criteria | Cloudflare Pages | Vercel | AWS S3+CloudFront | Kubernetes |
|----------|------------------|--------|-------------------|------------|
| Setup Complexity | Low | Low | Medium | High |
| Cost (hobby) | Free | Free | ~$5/mo | ~$70/mo |
| Global CDN | ✅ Built-in | ✅ Built-in | ✅ Manual setup | ❌ Requires config |
| Auto HTTPS | ✅ | ✅ | ✅ | Manual |
| Instant Rollback | ✅ | ✅ | ❌ | ✅ |
| Preview Deployments | ✅ | ✅ | ❌ | ❌ |
| SPA Routing | ✅ _redirects | ✅ vercel.json | ✅ Manual | ✅ Ingress |

**Decision Rationale:**
1. **Client-only SPA** - No server-side rendering needed, static hosting sufficient
2. **Global audience** - Built-in CDN for Qlik Cloud users worldwide
3. **Cost-effective** - Free tier covers expected traffic (< 100K requests/month)
4. **Developer experience** - Git-based deploys, preview URLs, instant rollbacks
5. **Scalability path** - Can migrate to Cloudflare Workers for edge functions if needed

**Future Scalability Considerations:**
- If SSR needed → Migrate to Cloudflare Workers or Vercel
- If complex routing needed → Cloudflare Workers with Hono framework
- If microservices needed → Consider Kubernetes on GKE/EKS
- Current architecture supports migration with minimal changes (standard React build)

### 11.6 CI/CD Workflow Details (NEW)

**Workflow Diagram:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CI/CD PIPELINE FLOW                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  TRIGGER: Push to branch / PR / Tag                                     │
│     │                                                                   │
│     ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ JOB 1: security-gate (runs always)                              │   │
│  │  ├─ npm audit --audit-level=high                                │   │
│  │  ├─ snyk test --severity-threshold=high                         │   │
│  │  └─ FAIL if HIGH/CRITICAL vulnerabilities                       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│     │                                                                   │
│     ▼ (on success)                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ JOB 2: test (needs: security-gate)                              │   │
│  │  ├─ npm ci                                                      │   │
│  │  ├─ npm run lint                                                │   │
│  │  ├─ npm run type-check                                          │   │
│  │  ├─ npm run test:unit --coverage                                │   │
│  │  ├─ npm run test:e2e                                            │   │
│  │  └─ Upload coverage to Codecov                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│     │                                                                   │
│     ▼ (on success)                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ JOB 3: build (needs: test)                                      │   │
│  │  ├─ npm run build                                               │   │
│  │  ├─ Lighthouse CI audit                                         │   │
│  │  └─ Upload dist/ as artifact                                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│     │                                                                   │
│     ├──────────────────┬────────────────────────────┐                   │
│     │                  │                            │                   │
│     ▼ (if PR)          ▼ (if develop)               ▼ (if tag v*)       │
│  ┌───────────┐   ┌─────────────────┐    ┌───────────────────────┐      │
│  │ PREVIEW   │   │ STAGING         │    │ PRODUCTION            │      │
│  │ Cloudflare│   │ Cloudflare      │    │ Cloudflare            │      │
│  │ Preview   │   │ qmb-staging     │    │ qmb-production        │      │
│  │ URL       │   │ staging.qmb.app │    │ app.qmb.app           │      │
│  └───────────┘   └─────────────────┘    └───────────────────────┘      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Deployment Triggers:**
| Trigger | Environment | URL | Approval |
|---------|-------------|-----|----------|
| PR opened/updated | Preview | `<pr-id>.qmb.pages.dev` | None (auto) |
| Push to `develop` | Staging | `staging.qmb.app` | None (auto) |
| Tag `v*` created | Production | `app.qmb.app` | Manual (GitHub Environment) |

**Environment Management:**
```yaml
# .github/workflows/ci-cd.yml - Full workflow with environment protection
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
    tags: ['v*']
  pull_request:
    branches: [main, develop]

env:
  NODE_VERSION: '20'

jobs:
  security-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npm audit --audit-level=high
      - uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high --fail-on=all

  test:
    needs: security-gate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test:unit -- --coverage
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: codecov/codecov-action@v4

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - name: Lighthouse CI
        run: npx lhci autorun
      - uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/

  deploy-preview:
    needs: build
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: dist
          path: dist
      - name: Deploy Preview
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
          accountId: ${{ secrets.CF_ACCOUNT_ID }}
          projectName: qmb
          directory: dist
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}

  deploy-staging:
    needs: build
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    environment:
      name: staging
      url: https://staging.qmb.app
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: dist
          path: dist
      - uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
          accountId: ${{ secrets.CF_ACCOUNT_ID }}
          projectName: qmb-staging
          directory: dist

  deploy-production:
    needs: build
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://app.qmb.app
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: dist
          path: dist
      - uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
          accountId: ${{ secrets.CF_ACCOUNT_ID }}
          projectName: qmb-production
          directory: dist
```

**GitHub Environment Protection Rules:**
| Environment | Protection | Reviewers |
|-------------|------------|-----------|
| staging | None | - |
| production | Required reviewers, Wait timer | 1 maintainer, 5 min wait |

---

## 12. Validation Strategy (Zod)

### 12.1 Validation Locations

| Layer | Validation Type | Purpose |
|-------|----------------|---------|
| Client (forms) | React Hook Form + Zod | UX feedback, prevent invalid submissions |
| Client (store) | Zod safeParse | Protect state integrity |
| Client (API response) | Zod parse | Validate external data |

**Note:** No server-side validation as this is a client-only SPA. Backend validation happens in Qlik Cloud APIs.

### 12.2 Schema Definitions

```typescript
// shared/utils/validation.ts
import { z } from 'zod'

// Step 1: Connect
export const projectNameSchema = z.string()
  .min(3, 'Project name must be at least 3 characters')
  .max(50, 'Project name must be at most 50 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Only alphanumeric, underscore, and hyphen allowed')

export const spaceConfigSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Space name required'),
  type: z.enum(['shared', 'managed', 'personal']),
  description: z.string().optional(),
  isNew: z.boolean(),
})

// Step 2: Source
export const connectionConfigSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Connection name required'),
  type: z.enum(['sqlserver', 'oracle', 'postgresql', 'mysql', 'rest_api', 'excel', 'csv', 'json', 'qvd']),
  server: z.string().optional(),
  database: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  connectionString: z.string().optional(),
}).refine(
  (data) => {
    if (['sqlserver', 'oracle', 'postgresql', 'mysql'].includes(data.type)) {
      return data.server && data.database
    }
    return true
  },
  { message: 'Database connections require server and database name' }
)

// Step 3: Tables
export const tableConfigSchema = z.object({
  name: z.string().min(1),
  alias: z.string().optional(),
  schema: z.string().optional(),
  fields: z.array(z.object({
    name: z.string(),
    alias: z.string().optional(),
    type: z.string(),
    isPrimaryKey: z.boolean(),
    isBusinessKey: z.boolean(),
    isForeignKey: z.boolean(),
    include: z.boolean(),
  })).min(1, 'At least one field required'),
  incremental: z.object({
    strategy: z.enum(['none', 'by_date', 'by_id', 'time_window', 'custom']),
    dateField: z.string().optional(),
    idField: z.string().optional(),
    windowDays: z.number().optional(),
    customScript: z.string().optional(),
  }),
})

// API Response Validation
export const qlikSpaceResponseSchema = z.object({
  data: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['shared', 'managed', 'personal']),
  })),
})

export const geminiReviewResponseSchema = z.object({
  score: z.number().min(0).max(100),
  summary: z.string(),
  issues: z.array(z.object({
    severity: z.enum(['critical', 'warning', 'info']),
    category: z.string(),
    description: z.string(),
    line: z.number().nullable(),
    suggestion: z.string(),
  })),
  strengths: z.array(z.string()),
  approved: z.boolean(),
})
```

### 12.3 Usage Patterns

```typescript
// In form component
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { connectionConfigSchema } from '@/shared/utils/validation'

function ConnectionForm() {
  const form = useForm({
    resolver: zodResolver(connectionConfigSchema),
    defaultValues: { type: 'sqlserver', name: '' }
  })
  // Form validation happens on submit
}

// In API hook
import { qlikSpaceResponseSchema } from '@/shared/utils/validation'

async function fetchSpaces() {
  const response = await fetch('/api/spaces')
  const data = await response.json()
  return qlikSpaceResponseSchema.parse(data) // Throws if invalid
}

// In store (defensive)
import { spaceConfigSchema } from '@/shared/utils/validation'

const useWizardStore = create((set) => ({
  setSpace: (space) => {
    const result = spaceConfigSchema.safeParse(space)
    if (result.success) {
      set({ space: result.data })
    } else {
      console.error('Invalid space config:', result.error)
    }
  }
}))
```

---

## Appendix A: Type Definitions

```typescript
// types/wizard.types.ts
export type WizardStepId =
  | 'space_setup'
  | 'data_source'
  | 'table_selection'
  | 'field_mapping'
  | 'incremental_config'
  | 'review'
  | 'deploy'

export type DataSourceType =
  | 'sqlserver'
  | 'oracle'
  | 'postgresql'
  | 'mysql'
  | 'rest_api'
  | 'excel'
  | 'csv'
  | 'json'
  | 'qvd'

export type IncrementalStrategy =
  | 'none'
  | 'by_date'
  | 'by_id'
  | 'time_window'
  | 'custom'

export interface SpaceConfig {
  id?: string
  name: string
  type: 'shared' | 'managed' | 'personal'
  description?: string
  isNew: boolean
}

export interface ConnectionConfig {
  id?: string
  name: string
  type: DataSourceType
  server?: string
  database?: string
  username?: string
  password?: string
  connectionString?: string
}

export interface TableConfig {
  name: string
  alias?: string
  schema?: string
  fields: FieldConfig[]
  incremental: IncrementalConfig
}

export interface FieldConfig {
  name: string
  alias?: string
  type: string
  isPrimaryKey: boolean
  isBusinessKey: boolean
  isForeignKey: boolean
  include: boolean
}

export interface IncrementalConfig {
  strategy: IncrementalStrategy
  dateField?: string
  idField?: string
  windowDays?: number
  customScript?: string
}
```

```typescript
// types/model-builder.types.ts
export type ModelType =
  | 'star_schema'
  | 'snowflake'
  | 'link_table'
  | 'concatenated'

export type BuildStage = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'

export type TableClassification =
  | 'fact'
  | 'dimension'
  | 'link'
  | 'calendar'

export interface EnrichedModelSpec {
  projectName: string
  modelType: ModelType
  tables: EnrichedTable[]
  relationships: Relationship[]
  calendarConfig: CalendarConfig
}

export interface EnrichedTable {
  name: string
  classification: TableClassification
  classificationConfidence: number
  fields: EnrichedField[]
  suggestedSurrogateKey: string
  businessKeys: string[]
}

export interface EnrichedField {
  name: string
  type: string
  keyType: 'PK' | 'BK' | 'FK' | null
  referencedTable?: string
  referencedField?: string
}

export interface Relationship {
  id: string
  fromTable: string
  fromField: string
  toTable: string
  toField: string
  cardinality: '1:1' | '1:M' | 'M:1' | 'M:M'
}

export interface CalendarConfig {
  startDate: string
  endDate: string
  dateFields: { table: string; field: string }[]
  includeFiscalYear: boolean
  fiscalYearStart?: number
}
```

---

## Appendix B: Color Palette

```css
:root {
  --primary: #0F4C81;      /* Navy - main actions */
  --primary-hover: #0D3D68;
  --secondary: #2C3E50;    /* Dark slate - sidebar */
  --accent: #3498DB;       /* Blue - highlights */
  --success: #2ECC71;      /* Green - completed */
  --warning: #F39C12;      /* Orange - warnings */
  --error: #E74C3C;        /* Red - errors */
  --background: #F5F7FA;   /* Light gray - bg */
  --foreground: #1A1A2E;   /* Dark - text */
  --muted: #6C757D;        /* Gray - secondary text */
  --border: #E2E8F0;       /* Light border */
}
```

---

## 13. Security Deep Dive

### 13.1 OWASP Top 10 Mitigations

| OWASP Risk | Mitigation Strategy | Implementation |
|------------|---------------------|----------------|
| A01: Broken Access Control | Qlik Cloud handles auth | OAuth 2.0 via Qlik, no local user management |
| A02: Cryptographic Failures | HTTPS only, no local secrets | TLS 1.3 via Cloudflare, API keys in env vars |
| A03: Injection | Input validation, parameterized queries | Zod schemas, Qlik API handles SQL |
| A04: Insecure Design | Threat modeling | Security review in PR process |
| A05: Security Misconfiguration | Secure defaults | CSP headers, CORS policy, no debug in prod |
| A06: Vulnerable Components | Dependency scanning | npm audit, Snyk in CI/CD |
| A07: Auth Failures | Qlik OAuth | Session timeout (30min), secure cookies |
| A08: Data Integrity Failures | Signed deployments | GitHub Actions with signed commits |
| A09: Logging Failures | Comprehensive logging | Sentry + LogRocket with PII sanitization |
| A10: SSRF | No server-side | Client-only SPA, no backend proxy |

### 13.2 XSS Prevention

```typescript
// React's default escaping handles most cases
// For dynamic HTML (rare), use DOMPurify
import DOMPurify from 'dompurify'

function ScriptPreview({ script }: { script: string }) {
  // Script is displayed in a read-only code editor, not as HTML
  // Use a syntax highlighter that escapes content
  return <CodeEditor value={script} language="qlik" readOnly />
}

// For any user-generated HTML content (not expected in this app)
function SafeHTML({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />
}
```

### 13.3 CSRF Protection

```typescript
// CSRF not applicable for this SPA because:
// 1. No server-side state changes from this app
// 2. Qlik API calls use Bearer tokens (not cookies)
// 3. All mutations go through TanStack Query with proper headers

// Example API call with Authorization header (not cookie-based)
async function callQlikApi(endpoint: string, options: RequestInit) {
  return fetch(`${QLIK_TENANT}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${getAccessToken()}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
    // No credentials: 'include' - we use Bearer tokens
  })
}
```

**⚠️ Periodic Security Review:**
- Re-assess CSRF risk quarterly or when authentication mechanism changes
- Review checklist:
  - [ ] Are we still using Bearer tokens exclusively (no cookies)?
  - [ ] Have any server-side state-changing endpoints been added?
  - [ ] Has the trust model between QMB and Qlik Cloud changed?
- If any answers are "yes", implement CSRF tokens (e.g., `csurf` library or custom implementation)

### 13.4 Dependency Vulnerability Scanning

```yaml
# Addition to CI/CD pipeline
jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run npm audit
        run: npm audit --audit-level=high

      - name: Run Snyk Security Scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high

      - name: OWASP Dependency Check
        uses: dependency-check/Dependency-Check_Action@main
        with:
          path: '.'
          format: 'HTML'
```

### 13.5 Content Security Policy

```typescript
// public/_headers (Cloudflare Pages)
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.logrocket.io; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.qlikcloud.com https://generativelanguage.googleapis.com https://*.sentry.io https://*.logrocket.io; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### 13.6 Security Implementation Specifics (NEW)

**XSS Prevention Implementation:**
```typescript
// shared/utils/sanitize.ts
import DOMPurify from 'dompurify'

// Configure DOMPurify with strict settings
DOMPurify.setConfig({
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'code', 'pre', 'br'],
  ALLOWED_ATTR: ['class'],
  FORBID_ATTR: ['style', 'onclick', 'onerror'],
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
})

// All user-provided text that might contain HTML
export function sanitizeUserInput(input: string): string {
  return DOMPurify.sanitize(input, { USE_PROFILES: { html: true } })
}

// For Qlik script preview (must escape special characters)
export function escapeQlikScript(script: string): string {
  return script
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
```

**Input Validation at All Entry Points:**
```typescript
// shared/utils/validation.ts - Security-focused schemas
import { z } from 'zod'

// Validate URLs to prevent open redirect attacks
export const safeUrlSchema = z.string()
  .url('Must be a valid URL')
  .refine(
    (url) => url.startsWith('https://'),
    'Only HTTPS URLs are allowed'
  )
  .refine(
    (url) => {
      const hostname = new URL(url).hostname
      return hostname.endsWith('.qlikcloud.com') || hostname === 'localhost'
    },
    'URL must be a Qlik Cloud tenant or localhost'
  )

// Validate file paths to prevent path traversal
export const safePathSchema = z.string()
  .refine(
    (path) => !path.includes('..'),
    'Path traversal not allowed'
  )
  .refine(
    (path) => path.startsWith('lib://'),
    'Path must start with lib://'
  )

// Validate project names to prevent injection
export const safeProjectNameSchema = z.string()
  .min(3).max(50)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Only alphanumeric, underscore, and hyphen allowed')
```

**CSP Verification Test:**
```typescript
// tests/e2e/security.spec.ts
test.describe('Security Headers', () => {
  test('should have correct CSP headers', async ({ page }) => {
    const response = await page.goto('/')
    const csp = response?.headers()['content-security-policy']

    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("script-src 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).not.toContain("unsafe-eval")
  })

  test('should not execute inline scripts', async ({ page }) => {
    // Attempt to inject script via form input
    await page.goto('/connect')
    await page.fill('[data-testid="project-name"]', '<script>alert("xss")</script>')
    // Script should not execute - check via console errors
    const errors: string[] = []
    page.on('pageerror', err => errors.push(err.message))
    await page.click('[data-testid="next-button"]')
    expect(errors).not.toContain('xss')
  })
})
```

**Security Audit Automation:**
```yaml
# .github/workflows/security.yml
name: Security Audit
on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly on Sunday
  push:
    branches: [main, develop]

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: npm audit (high severity)
        run: npm audit --audit-level=high

      - name: Snyk vulnerability scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

      - name: OWASP ZAP scan
        uses: zaproxy/action-baseline@v0.9.0
        with:
          target: 'https://staging.qmb.app'
          allow_issue_writing: false
```

### 13.7 Security CI/CD Pipeline Integration (NEW)

**Pipeline Failure on Vulnerabilities:**
```yaml
# .github/workflows/ci-cd.yml - Security gate
jobs:
  security-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci

      # FAIL on HIGH or CRITICAL vulnerabilities
      - name: npm audit (fail on high)
        run: npm audit --audit-level=high
        # This will exit with non-zero if high/critical vulnerabilities found

      # Snyk with failure threshold
      - name: Snyk test (fail on high)
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high --fail-on=all

      # Block deploy if security fails
      - name: Security status
        if: failure()
        run: |
          echo "::error::Security vulnerabilities detected! Deployment blocked."
          exit 1

  # Build job depends on security passing
  build:
    needs: security-gate
    runs-on: ubuntu-latest
    # ... build steps
```

**Vulnerability Remediation Process:**
```
VULNERABILITY DETECTED
│
├─▶ Severity Assessment
│   ├─ CRITICAL: Block PR, fix immediately
│   ├─ HIGH: Block PR, fix within 24 hours
│   ├─ MEDIUM: Allow merge, fix within 1 week
│   └─ LOW: Allow merge, track in backlog
│
├─▶ Remediation Steps
│   1. Check if direct or transitive dependency
│   2. If direct: Update to patched version
│   3. If transitive: Check if parent can be updated
│   4. If no patch available:
│      a. Assess exploitability in our context
│      b. If not exploitable: Add to .snyk ignore with reason
│      c. If exploitable: Find alternative package or workaround
│
├─▶ Verification
│   1. Run npm audit / snyk test locally
│   2. Verify vulnerability resolved
│   3. Run full test suite
│   4. Submit PR with fix
│
└─▶ Documentation
    1. Record vulnerability in security log
    2. Update SECURITY.md if new mitigation added
    3. Notify team via Slack #qmb-security
```

**Security Dashboard:**
```typescript
// scripts/security-report.ts
// Run weekly to generate security summary

import { execSync } from 'child_process'

async function generateSecurityReport() {
  const auditResult = JSON.parse(
    execSync('npm audit --json').toString()
  )

  const report = {
    date: new Date().toISOString(),
    totalVulnerabilities: auditResult.metadata.vulnerabilities.total,
    bySeverity: auditResult.metadata.vulnerabilities,
    advisories: Object.keys(auditResult.vulnerabilities).length,
    status: auditResult.metadata.vulnerabilities.high === 0 &&
            auditResult.metadata.vulnerabilities.critical === 0
              ? 'PASS' : 'FAIL'
  }

  console.log('Security Report:', JSON.stringify(report, null, 2))
  return report
}
```

---

## 14. Data Governance & Lineage

### 14.1 Data Lineage Tracking

```typescript
// Every generated Qlik script includes lineage metadata
interface ScriptLineage {
  generatedAt: string           // ISO timestamp
  generatedBy: string           // User/system identifier
  projectId: string             // QlikModelBuilder project ID
  version: string               // Script version
  sources: SourceLineage[]      // Data sources
  transformations: string[]     // Applied transformations
  checksum: string              // SHA-256 of script content
}

interface SourceLineage {
  table: string
  source: string               // Connection name
  sourceType: string           // sqlserver, qvd, etc.
  extractedAt?: string         // When QVD was created
  rowCount?: number            // At extraction time
  fields: string[]             // Field list
}

// Embedded in generated script as comments
/*
//=============================================================================
// LINEAGE METADATA
// Generated: 2026-01-21T14:30:00Z
// Project: OlistModel
// Version: 1.0.0
// Sources:
//   - olist_customers_dataset (QVD, extracted: 2026-01-21)
//   - olist_orders_dataset (QVD, extracted: 2026-01-21)
// Transformations: AutoNumber, ApplyMap, Date formatting
// Checksum: sha256:abc123...
//=============================================================================
*/
```

### 14.2 Data Quality Monitoring

| Check | When | Action on Failure |
|-------|------|-------------------|
| Schema validation | On QVD load | Warning in UI, block deploy |
| Row count sanity | Post-extraction | Warning if > 20% change |
| Null key detection | Pre-deploy | Error, require fix |
| Duplicate key check | Pre-deploy | Warning, suggest DISTINCT |
| Date range validation | Calendar generation | Error if facts outside range |

### 14.3 Data Access Control

```
Data Flow:
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Source Data    │────▶│  Qlik Cloud     │────▶│  QMB Web App    │
│  (User's DB)    │     │  (User's Space) │     │  (Read-only)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
   User controls           User's Qlik              Only metadata
   access to DB            permissions             & schemas shown
                           apply
```

**Key Principle:** QlikModelBuilder NEVER has direct access to user data. All data access is mediated by Qlik Cloud using the user's own permissions.

### 14.4 Data Governance Implementation Approach (NEW)

**Lineage Tracking Implementation:**
```typescript
// lib/lineage/lineage-tracker.ts
interface LineageRecord {
  id: string
  timestamp: string
  projectId: string
  operation: 'create' | 'transform' | 'deploy'
  source: {
    type: 'connection' | 'qvd' | 'generated'
    name: string
    path?: string
  }
  target: {
    type: 'qvd' | 'script' | 'app'
    name: string
  }
  transformations: string[]
  checksum: string
}

class LineageTracker {
  private records: LineageRecord[] = []

  // Track when tables are selected
  trackTableSelection(tables: string[], connectionName: string): void {
    tables.forEach(table => {
      this.records.push({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        projectId: useAppStore.getState().projectId || 'unknown',
        operation: 'create',
        source: { type: 'connection', name: connectionName },
        target: { type: 'qvd', name: `${table}.qvd` },
        transformations: [],
        checksum: this.computeChecksum(table)
      })
    })
  }

  // Track when scripts are generated
  trackScriptGeneration(stage: BuildStage, script: string): void {
    this.records.push({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      projectId: useAppStore.getState().projectId || 'unknown',
      operation: 'transform',
      source: { type: 'qvd', name: 'multiple' },
      target: { type: 'script', name: `stage-${stage}.qvs` },
      transformations: this.extractTransformations(script),
      checksum: this.computeChecksum(script)
    })
  }

  // Export lineage for the generated script header
  exportLineageComment(): string {
    const projectName = useAppStore.getState().projectName
    return `
//=============================================================================
// LINEAGE METADATA
// Project: ${projectName}
// Generated: ${new Date().toISOString()}
// Operations: ${this.records.length}
// Sources: ${[...new Set(this.records.map(r => r.source.name))].join(', ')}
// Checksums:
${this.records.map(r => `//   ${r.target.name}: ${r.checksum}`).join('\n')}
//=============================================================================
`
  }

  private computeChecksum(content: string): string {
    // Simple hash for browser (real impl would use crypto.subtle)
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      hash = ((hash << 5) - hash) + content.charCodeAt(i)
      hash |= 0
    }
    return `sha256:${Math.abs(hash).toString(16).padStart(8, '0')}`
  }

  private extractTransformations(script: string): string[] {
    const transforms: string[] = []
    if (script.includes('AutoNumber')) transforms.push('AutoNumber')
    if (script.includes('ApplyMap')) transforms.push('ApplyMap')
    if (script.includes('Date(')) transforms.push('DateFormatting')
    if (script.includes('MAPPING')) transforms.push('MappingTable')
    return transforms
  }
}

export const lineageTracker = new LineageTracker()
```

### 14.5 Lineage Data Storage Mechanism (NEW)

**Storage Strategy:**
Since QlikModelBuilder is a client-only SPA without a backend database, lineage data is stored in two ways:

1. **Session-scoped (ephemeral):** In-memory during wizard session
2. **Persistent (exportable):** Embedded in generated Qlik scripts as comments

**Why not a dedicated database?**
- No server-side component exists
- Lineage is project-scoped, not global
- Each generated script is self-documenting
- Users can extract lineage from scripts if needed

**Lineage Export Options:**
```typescript
// lib/lineage/lineage-exporter.ts
export class LineageExporter {
  // Export as JSON for external tools
  exportAsJSON(tracker: LineageTracker): string {
    return JSON.stringify({
      version: '1.0',
      exportDate: new Date().toISOString(),
      records: tracker.getRecords(),
    }, null, 2)
  }

  // Export as CSV for spreadsheet analysis
  exportAsCSV(tracker: LineageTracker): string {
    const headers = ['id', 'timestamp', 'operation', 'sourceType', 'sourceName', 'targetType', 'targetName', 'checksum']
    const rows = tracker.getRecords().map(r =>
      [r.id, r.timestamp, r.operation, r.source.type, r.source.name, r.target.type, r.target.name, r.checksum].join(',')
    )
    return [headers.join(','), ...rows].join('\n')
  }

  // Export as Mermaid diagram for documentation
  exportAsMermaid(tracker: LineageTracker): string {
    const lines = ['graph LR']
    tracker.getRecords().forEach(r => {
      const sourceId = r.source.name.replace(/[^a-zA-Z0-9]/g, '_')
      const targetId = r.target.name.replace(/[^a-zA-Z0-9]/g, '_')
      lines.push(`  ${sourceId}[${r.source.name}] --> |${r.operation}| ${targetId}[${r.target.name}]`)
    })
    return lines.join('\n')
  }
}

// UI Download buttons
export function LineageDownloadButtons() {
  const exporter = new LineageExporter()

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={() => {
        downloadFile('lineage.json', exporter.exportAsJSON(lineageTracker), 'application/json')
      }}>
        📄 JSON
      </Button>
      <Button variant="outline" size="sm" onClick={() => {
        downloadFile('lineage.csv', exporter.exportAsCSV(lineageTracker), 'text/csv')
      }}>
        📊 CSV
      </Button>
      <Button variant="outline" size="sm" onClick={() => {
        downloadFile('lineage.md', exporter.exportAsMermaid(lineageTracker), 'text/markdown')
      }}>
        📈 Mermaid
      </Button>
    </div>
  )
}
```

**Future Scalability (if backend added):**
If a backend is added in the future, lineage could be stored in:
- PostgreSQL with JSON columns for flexible schema
- Neo4j graph database for complex lineage queries
- Dedicated lineage tools like Apache Atlas or DataHub

**Lineage Visualization in UI:**
```typescript
// features/step11-deploy/components/LineageView.tsx
export function LineageView() {
  const lineage = lineageTracker.exportLineageComment()

  return (
    <div className="bg-muted rounded-lg p-4">
      <h3 className="font-semibold mb-2 flex items-center gap-2">
        <LinkIcon className="w-4 h-4" />
        Data Lineage
      </h3>
      <pre className="text-xs overflow-auto max-h-48">
        {lineage}
      </pre>
      <Button variant="outline" size="sm" onClick={() => downloadLineage()}>
        Download Lineage Report
      </Button>
    </div>
  )
}
```

**Data Quality Checks Implementation:**
```typescript
// lib/quality/data-quality-checker.ts
interface QualityCheckResult {
  check: string
  status: 'pass' | 'warn' | 'fail'
  message: string
  details?: unknown
}

export async function runDataQualityChecks(
  tables: TableConfig[]
): Promise<QualityCheckResult[]> {
  const results: QualityCheckResult[] = []

  for (const table of tables) {
    // Check: Primary key defined
    const hasPK = table.fields.some(f => f.isPrimaryKey)
    results.push({
      check: `${table.name}: Primary Key`,
      status: hasPK ? 'pass' : 'warn',
      message: hasPK ? 'Primary key defined' : 'No primary key - consider adding one'
    })

    // Check: No nullable keys
    const nullableKeys = table.fields.filter(f => (f.isPrimaryKey || f.isBusinessKey) && f.nullable)
    results.push({
      check: `${table.name}: Nullable Keys`,
      status: nullableKeys.length === 0 ? 'pass' : 'fail',
      message: nullableKeys.length === 0
        ? 'No nullable keys'
        : `Keys cannot be nullable: ${nullableKeys.map(f => f.name).join(', ')}`
    })

    // Check: Date field for incremental
    if (table.incremental?.strategy === 'by_date' && !table.incremental.dateField) {
      results.push({
        check: `${table.name}: Incremental Config`,
        status: 'fail',
        message: 'by_date strategy requires a date field'
      })
    }
  }

  return results
}
```

---

## 15. Performance Budgeting

### 15.1 Performance Budgets

| Metric | Budget | Measurement Point |
|--------|--------|-------------------|
| Largest Contentful Paint (LCP) | < 2.5s | First step page |
| First Input Delay (FID) | < 100ms | Any interactive element |
| Cumulative Layout Shift (CLS) | < 0.1 | All pages |
| Time to First Byte (TTFB) | < 200ms | All pages (via CDN) |
| Total Blocking Time (TBT) | < 300ms | Initial load |
| JavaScript Bundle (main) | < 150KB gzipped | Production build |
| CSS Bundle | < 30KB gzipped | Production build |
| Step Navigation | < 500ms | Step transitions |
| API Response (Qlik) | < 2s | Space/connection lists |
| Script Generation | < 3s | Generate button click |

### 15.2 Lighthouse CI Configuration

```javascript
// lighthouserc.js
module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:4173/', 'http://localhost:4173/source'],
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.8 }],
        'first-contentful-paint': ['error', { maxNumericValue: 1500 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'total-blocking-time': ['error', { maxNumericValue: 300 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
}
```

### 15.3 Performance Profiling Strategy

| Phase | Tool | Frequency | Owner |
|-------|------|-----------|-------|
| Development | Chrome DevTools | Per feature | Developer |
| PR Review | Lighthouse CI | Every PR | Automated |
| Staging | Lighthouse + WebPageTest | Weekly | QA |
| Production | Sentry Performance | Continuous | Ops |

**Bottleneck Resolution Process:**
1. Identify via Lighthouse CI or Sentry Performance
2. Profile with Chrome DevTools (Performance tab)
3. Analyze bundle with `vite-bundle-visualizer`
4. Apply optimization (lazy loading, memoization, etc.)
5. Verify improvement in PR
6. Document in performance changelog

### 15.4 Development-Time Performance Monitoring (NEW)

**Mandatory Performance Checks Per Feature:**

| Check | Tool | Trigger | Pass Criteria |
|-------|------|---------|---------------|
| Bundle Impact | `vite-bundle-visualizer` | Before PR | < 5KB increase per feature |
| Render Count | React DevTools Profiler | Per component | < 3 re-renders on state change |
| Memory Leaks | Chrome DevTools Memory | Per step feature | No detached DOM nodes |
| Step Transition | Performance.mark() | Each step | < 500ms mount time |

**React Profiler Integration:**
```typescript
// shared/components/feedback/PerformanceWrapper.tsx
import { Profiler, ProfilerOnRenderCallback } from 'react'

const onRenderCallback: ProfilerOnRenderCallback = (
  id, phase, actualDuration, baseDuration, startTime, commitTime
) => {
  // Only log in development
  if (import.meta.env.DEV && actualDuration > 16) {
    console.warn(`[Perf] ${id} render took ${actualDuration.toFixed(2)}ms (phase: ${phase})`)
  }

  // Send to Sentry in production for slow renders
  if (import.meta.env.PROD && actualDuration > 100) {
    Sentry.addBreadcrumb({
      category: 'performance',
      message: `Slow render: ${id}`,
      level: 'warning',
      data: { actualDuration, baseDuration, phase }
    })
  }
}

export function PerformanceWrapper({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <Profiler id={id} onRender={onRenderCallback}>
      {children}
    </Profiler>
  )
}

// Usage in step pages:
// <PerformanceWrapper id="Step03Tables">
//   <TableSelectionContent />
// </PerformanceWrapper>
```

**Step Timing Instrumentation:**
```typescript
// shared/hooks/useStepTiming.ts
export function useStepTiming(stepName: string) {
  useEffect(() => {
    const startMark = `${stepName}-start`
    const endMark = `${stepName}-rendered`

    performance.mark(startMark)

    // Measure after paint
    requestAnimationFrame(() => {
      performance.mark(endMark)
      performance.measure(`${stepName}-mount`, startMark, endMark)

      const measure = performance.getEntriesByName(`${stepName}-mount`)[0]
      if (measure && measure.duration > 500) {
        console.warn(`[Perf] ${stepName} mount exceeded budget: ${measure.duration.toFixed(0)}ms`)
      }
    })

    return () => {
      performance.clearMarks(startMark)
      performance.clearMarks(endMark)
      performance.clearMeasures(`${stepName}-mount`)
    }
  }, [stepName])
}
```

**Performance Review Checklist (Required for PR approval):**
- [ ] Bundle size increase < 5KB (check via CI artifact)
- [ ] No components with > 3 re-renders (verify via React DevTools)
- [ ] Step mount time < 500ms (verify via Performance marks)
- [ ] No memory leaks (verify via Chrome Memory snapshot)
- [ ] Lighthouse performance score > 90 (automated CI check)

### 15.5 Per-Step Performance Budgets (NEW)

| Step | Max Mount Time | Max Re-renders | Max API Wait | Notes |
|------|---------------|----------------|--------------|-------|
| Step 1: Connect | 300ms | 2 | 500ms | Simple form |
| Step 2: Source | 400ms | 3 | 2000ms | Connection test |
| Step 3: Tables | 500ms | 3 | 3000ms | May have 100+ tables |
| Step 4: Fields | 600ms | 4 | - | Virtual scrolling for large tables |
| Step 5: Incremental | 400ms | 3 | - | Per-table config |
| Step 6: Extract | 500ms | 3 | 5000ms | Script generation |
| Step 7: Analyze | 800ms | 5 | 10000ms | QVD analysis |
| Step 8: Model Type | 300ms | 2 | - | Selection only |
| Step 9: Build | 700ms | 6 | 3000ms/stage | 6 sub-stages |
| Step 10: Review | 500ms | 3 | 30000ms | Gemini API call |
| Step 11: Deploy | 400ms | 3 | 30000ms | Qlik deployment |

**Per-Step Performance Tests:**
```typescript
// tests/performance/step-budgets.spec.ts
import { test, expect } from '@playwright/test'

const STEP_BUDGETS = {
  '/connect': { maxMount: 300, maxRenders: 2 },
  '/source': { maxMount: 400, maxRenders: 3 },
  '/tables': { maxMount: 500, maxRenders: 3 },
  '/fields': { maxMount: 600, maxRenders: 4 },
  '/incremental': { maxMount: 400, maxRenders: 3 },
  '/extract': { maxMount: 500, maxRenders: 3 },
  '/analyze': { maxMount: 800, maxRenders: 5 },
  '/model-type': { maxMount: 300, maxRenders: 2 },
  '/build': { maxMount: 700, maxRenders: 6 },
  '/review': { maxMount: 500, maxRenders: 3 },
  '/deploy': { maxMount: 400, maxRenders: 3 },
}

for (const [route, budget] of Object.entries(STEP_BUDGETS)) {
  test(`${route} should meet performance budget`, async ({ page }) => {
    await page.goto(route)

    // Measure mount time
    const mountTime = await page.evaluate(() => {
      const entry = performance.getEntriesByName(`step-rendered`)[0]
      return entry?.duration || 0
    })
    expect(mountTime).toBeLessThan(budget.maxMount)

    // Measure re-renders via React DevTools hook (requires dev build)
    if (process.env.NODE_ENV === 'development') {
      const renderCount = await page.evaluate(() => {
        return (window as any).__REACT_RENDER_COUNT__ || 0
      })
      expect(renderCount).toBeLessThanOrEqual(budget.maxRenders)
    }
  })
}
```

---

## 16. Comprehensive E2E Testing Strategy

### 16.1 Spec File Validation Tests

**Spec File Locations (MUST be validated on every test run):**
```
docs/Olist_Tables_Summary.csv    → 9 tables, 52 fields
docs/Olist_Relationships.csv     → 9 relationships
```

**Spec Parsing Test Suite:**
```typescript
// tests/e2e/spec-parsing.spec.ts
import { test, expect } from '@playwright/test'
import { parseTablesSummary, parseRelationships } from '@/lib/spec-parser'

const SPEC_FILES = {
  tables: 'docs/Olist_Tables_Summary.csv',
  relationships: 'docs/Olist_Relationships.csv',
}

test.describe('Spec File Parsing', () => {
  test('should locate spec files at expected paths', async () => {
    const fs = require('fs')
    expect(fs.existsSync(SPEC_FILES.tables)).toBe(true)
    expect(fs.existsSync(SPEC_FILES.relationships)).toBe(true)
  })

  test('should parse Olist_Tables_Summary.csv correctly', async () => {
    const tables = await parseTablesSummary(SPEC_FILES.tables)

    // EXACT counts from real spec
    expect(tables.length).toBe(9)
    expect(tables.reduce((sum, t) => sum + t.fields.length, 0)).toBe(52)

    // Verify specific tables exist
    const tableNames = tables.map(t => t.name)
    expect(tableNames).toContain('olist_orders_dataset')
    expect(tableNames).toContain('olist_customers_dataset')
    expect(tableNames).toContain('olist_products_dataset')
    expect(tableNames).toContain('olist_sellers_dataset')
    expect(tableNames).toContain('olist_order_items_dataset')
    expect(tableNames).toContain('olist_order_payments_dataset')
    expect(tableNames).toContain('olist_order_reviews_dataset')
    expect(tableNames).toContain('olist_geolocation_dataset')
    expect(tableNames).toContain('product_category_name_translation')
  })

  test('should parse Olist_Relationships.csv correctly', async () => {
    const relationships = await parseRelationships(SPEC_FILES.relationships)

    // EXACT count from real spec
    expect(relationships.length).toBe(9)

    // Verify key relationships exist
    expect(relationships).toContainEqual(expect.objectContaining({
      fromTable: 'olist_orders_dataset',
      toTable: 'olist_order_items_dataset',
      cardinality: '1:M',
    }))
  })

  test('should classify tables correctly', async () => {
    const tables = await parseTablesSummary(SPEC_FILES.tables)

    // Facts (4 tables)
    const facts = tables.filter(t => t.classification === 'fact')
    expect(facts.map(f => f.name)).toEqual(expect.arrayContaining([
      'olist_orders_dataset',
      'olist_order_items_dataset',
      'olist_order_payments_dataset',
      'olist_order_reviews_dataset',
    ]))

    // Dimensions (5 tables)
    const dimensions = tables.filter(t => t.classification === 'dimension')
    expect(dimensions.map(d => d.name)).toEqual(expect.arrayContaining([
      'olist_customers_dataset',
      'olist_products_dataset',
      'olist_sellers_dataset',
      'olist_geolocation_dataset',
      'product_category_name_translation',
    ]))
  })
})
```

### 16.2 Full User Flow E2E Tests

**Complete 11-Step Flow Test:**
```typescript
// tests/e2e/full-wizard-flow.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Complete Wizard Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should complete full 11-step wizard with Olist data', async ({ page }) => {
    // =========================================
    // STEP 1: Connect
    // =========================================
    await expect(page).toHaveURL('/connect')
    await expect(page.locator('[data-testid="step-indicator"]')).toContainText('1/11')

    await page.fill('[data-testid="project-name"]', 'OlistTestProject')
    await page.fill('[data-testid="tenant-url"]', 'https://test.qlikcloud.com')
    await page.click('[data-testid="space-development"]')
    await page.click('[data-testid="next-button"]')

    // =========================================
    // STEP 2: Source
    // =========================================
    await expect(page).toHaveURL('/source')
    await expect(page.locator('[data-testid="step-indicator"]')).toContainText('2/11')

    await page.click('[data-testid="source-type-qvd"]')
    await page.fill('[data-testid="qvd-path"]', 'lib://DataFiles/Olist/')
    await page.click('[data-testid="test-connection"]')
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('Connected')
    await page.click('[data-testid="next-button"]')

    // =========================================
    // STEP 3: Tables
    // =========================================
    await expect(page).toHaveURL('/tables')

    // Should show 9 tables from Olist spec
    await expect(page.locator('[data-testid="table-item"]')).toHaveCount(9)

    // Select all tables
    await page.click('[data-testid="select-all-tables"]')
    await expect(page.locator('[data-testid="selected-count"]')).toContainText('9 tables')
    await page.click('[data-testid="next-button"]')

    // =========================================
    // STEP 4: Fields
    // =========================================
    await expect(page).toHaveURL('/fields')

    // Should have 52 total fields
    await expect(page.locator('[data-testid="total-fields"]')).toContainText('52 fields')

    // Test field mapping for orders table
    await page.click('[data-testid="table-accordion-olist_orders_dataset"]')
    await expect(page.locator('[data-testid="field-order_id"]')).toBeVisible()
    await expect(page.locator('[data-testid="field-customer_id"]')).toBeVisible()

    // Mark order_id as PK
    await page.click('[data-testid="field-order_id-pk-toggle"]')
    await expect(page.locator('[data-testid="field-order_id-pk-badge"]')).toBeVisible()

    await page.click('[data-testid="next-button"]')

    // =========================================
    // STEP 5: Incremental
    // =========================================
    await expect(page).toHaveURL('/incremental')

    // Set strategies for key tables
    await page.selectOption('[data-testid="strategy-olist_orders_dataset"]', 'by_date')
    await page.selectOption('[data-testid="date-field-olist_orders_dataset"]', 'order_purchase_timestamp')

    await page.selectOption('[data-testid="strategy-olist_customers_dataset"]', 'none')
    await page.selectOption('[data-testid="strategy-olist_products_dataset"]', 'none')

    await page.click('[data-testid="next-button"]')

    // =========================================
    // STEP 6: Extract
    // =========================================
    await expect(page).toHaveURL('/extract')

    // Preview script
    await page.click('[data-testid="preview-script"]')
    await expect(page.locator('[data-testid="script-preview"]')).toContainText('olist_orders_dataset')

    // Validate
    await page.click('[data-testid="validate-script"]')
    await expect(page.locator('[data-testid="validation-result"]')).toContainText('Valid')

    // Deploy (mocked)
    await page.click('[data-testid="deploy-extract"]')
    await expect(page.locator('[data-testid="deploy-status"]')).toContainText('Success')

    await page.click('[data-testid="next-button"]')

    // =========================================
    // STEP 7: Analyze
    // =========================================
    await expect(page).toHaveURL('/analyze')

    // Wait for analysis to complete
    await expect(page.locator('[data-testid="analysis-status"]')).toContainText('Complete', { timeout: 10000 })

    // Verify classifications
    await expect(page.locator('[data-testid="fact-count"]')).toContainText('4')
    await expect(page.locator('[data-testid="dimension-count"]')).toContainText('5')

    // Verify relationships detected
    await expect(page.locator('[data-testid="relationship-count"]')).toContainText('9')

    await page.click('[data-testid="next-button"]')

    // =========================================
    // STEP 8: Model Type
    // =========================================
    await expect(page).toHaveURL('/model-type')

    // Should recommend star schema for Olist
    await expect(page.locator('[data-testid="recommended-badge"]')).toBeVisible()
    await expect(page.locator('[data-testid="model-star_schema"]')).toHaveClass(/recommended/)

    await page.click('[data-testid="model-star_schema"]')
    await page.click('[data-testid="next-button"]')

    // =========================================
    // STEP 9: Build (Stages A-F)
    // =========================================
    await expect(page).toHaveURL('/build')

    // Stage A: Configuration
    await expect(page.locator('[data-testid="current-stage"]')).toContainText('A')
    await expect(page.locator('[data-testid="stage-script"]')).toContainText('SET ThousandSep')
    await page.click('[data-testid="approve-stage"]')

    // Stage B: Dimensions
    await expect(page.locator('[data-testid="current-stage"]')).toContainText('B')
    await expect(page.locator('[data-testid="stage-script"]')).toContainText('DimCustomer')
    await page.click('[data-testid="approve-stage"]')

    // Stage C: Facts
    await expect(page.locator('[data-testid="current-stage"]')).toContainText('C')
    await expect(page.locator('[data-testid="stage-script"]')).toContainText('FactOrders')
    await page.click('[data-testid="approve-stage"]')

    // Stage D: Calendar
    await expect(page.locator('[data-testid="current-stage"]')).toContainText('D')
    await expect(page.locator('[data-testid="stage-script"]')).toContainText('MasterCalendar')
    await page.click('[data-testid="approve-stage"]')

    // Stage E: Links (may be empty for star schema)
    await expect(page.locator('[data-testid="current-stage"]')).toContainText('E')
    await page.click('[data-testid="approve-stage"]')

    // Stage F: Final
    await expect(page.locator('[data-testid="current-stage"]')).toContainText('F')
    await expect(page.locator('[data-testid="stage-script"]')).toContainText('DROP TABLE')
    await page.click('[data-testid="approve-stage"]')

    await page.click('[data-testid="next-button"]')

    // =========================================
    // STEP 10: Review (Gemini)
    // =========================================
    await expect(page).toHaveURL('/review')

    await page.click('[data-testid="request-review"]')
    await expect(page.locator('[data-testid="review-status"]')).toContainText('Complete', { timeout: 30000 })

    // Should get high score for properly built model
    const score = await page.locator('[data-testid="review-score"]').textContent()
    expect(parseInt(score || '0')).toBeGreaterThanOrEqual(80)

    await page.click('[data-testid="next-button"]')

    // =========================================
    // STEP 11: Deploy
    // =========================================
    await expect(page).toHaveURL('/deploy')

    // Verify summary
    await expect(page.locator('[data-testid="summary-tables"]')).toContainText('9')
    await expect(page.locator('[data-testid="summary-relationships"]')).toContainText('9')
    await expect(page.locator('[data-testid="summary-model-type"]')).toContainText('Star Schema')

    // Deploy
    await page.click('[data-testid="final-deploy"]')
    await expect(page.locator('[data-testid="deploy-success"]')).toBeVisible({ timeout: 30000 })

    // Verify download options
    await expect(page.locator('[data-testid="download-script"]')).toBeVisible()
    await expect(page.locator('[data-testid="download-docs"]')).toBeVisible()
  })
})
```

### 16.3 GUI Component Tests

**Menu & Navigation Tests:**
```typescript
// tests/e2e/gui-components.spec.ts
import { test, expect } from '@playwright/test'

test.describe('GUI Components', () => {

  test.describe('Sidebar Navigation', () => {
    test('should display all 11 steps', async ({ page }) => {
      await page.goto('/')
      const steps = page.locator('[data-testid="sidebar-step"]')
      await expect(steps).toHaveCount(11)
    })

    test('should highlight current step', async ({ page }) => {
      await page.goto('/source')
      await expect(page.locator('[data-testid="sidebar-step-2"]')).toHaveClass(/active/)
    })

    test('should disable future steps', async ({ page }) => {
      await page.goto('/')
      await expect(page.locator('[data-testid="sidebar-step-5"]')).toHaveClass(/disabled/)
      await page.click('[data-testid="sidebar-step-5"]')
      await expect(page).toHaveURL('/connect') // Should not navigate
    })

    test('should allow navigating to completed steps', async ({ page }) => {
      // Setup: Complete first 3 steps
      await page.goto('/')
      // ... complete steps
      await page.click('[data-testid="sidebar-step-1"]')
      await expect(page).toHaveURL('/connect')
    })
  })

  test.describe('Step Indicator', () => {
    test('should show progress correctly', async ({ page }) => {
      await page.goto('/tables')
      await expect(page.locator('[data-testid="step-indicator"]')).toContainText('3/11')
      await expect(page.locator('[data-testid="progress-bar"]')).toHaveAttribute('aria-valuenow', '27')
    })

    test('should show stage labels', async ({ page }) => {
      await page.goto('/')
      await expect(page.locator('[data-testid="stage-1-label"]')).toContainText('Data Extraction')
      await expect(page.locator('[data-testid="stage-2-label"]')).toContainText('Model Building')
    })
  })

  test.describe('Header', () => {
    test('should display project name', async ({ page }) => {
      await page.goto('/')
      await page.fill('[data-testid="project-name"]', 'TestProject')
      await expect(page.locator('[data-testid="header-project-name"]')).toContainText('TestProject')
    })

    test('should have help menu', async ({ page }) => {
      await page.goto('/')
      await page.click('[data-testid="help-menu"]')
      await expect(page.locator('[data-testid="help-dropdown"]')).toBeVisible()
      await expect(page.locator('[data-testid="help-docs"]')).toBeVisible()
      await expect(page.locator('[data-testid="help-shortcuts"]')).toBeVisible()
    })
  })

  test.describe('Forms', () => {
    test('should validate required fields', async ({ page }) => {
      await page.goto('/connect')
      await page.click('[data-testid="next-button"]')
      await expect(page.locator('[data-testid="error-project-name"]')).toContainText('required')
    })

    test('should show field-level validation', async ({ page }) => {
      await page.goto('/connect')
      await page.fill('[data-testid="project-name"]', 'ab') // Too short
      await page.blur('[data-testid="project-name"]')
      await expect(page.locator('[data-testid="error-project-name"]')).toContainText('at least 3')
    })

    test('should clear errors on valid input', async ({ page }) => {
      await page.goto('/connect')
      await page.fill('[data-testid="project-name"]', 'ab')
      await expect(page.locator('[data-testid="error-project-name"]')).toBeVisible()
      await page.fill('[data-testid="project-name"]', 'ValidName')
      await expect(page.locator('[data-testid="error-project-name"]')).not.toBeVisible()
    })
  })

  test.describe('Tables & Lists', () => {
    test('should support multi-select', async ({ page }) => {
      await page.goto('/tables')
      await page.click('[data-testid="table-checkbox-0"]')
      await page.click('[data-testid="table-checkbox-2"]')
      await expect(page.locator('[data-testid="selected-count"]')).toContainText('2')
    })

    test('should support select all / deselect all', async ({ page }) => {
      await page.goto('/tables')
      await page.click('[data-testid="select-all-tables"]')
      await expect(page.locator('[data-testid="selected-count"]')).toContainText('9')
      await page.click('[data-testid="deselect-all-tables"]')
      await expect(page.locator('[data-testid="selected-count"]')).toContainText('0')
    })

    test('should filter tables by search', async ({ page }) => {
      await page.goto('/tables')
      await page.fill('[data-testid="table-search"]', 'order')
      const visibleTables = page.locator('[data-testid="table-item"]:visible')
      await expect(visibleTables).toHaveCount(4) // orders, order_items, order_payments, order_reviews
    })
  })

  test.describe('Accordions', () => {
    test('should expand/collapse on click', async ({ page }) => {
      await page.goto('/fields')
      const accordion = page.locator('[data-testid="table-accordion-olist_orders_dataset"]')
      await expect(accordion.locator('[data-testid="accordion-content"]')).not.toBeVisible()
      await accordion.click()
      await expect(accordion.locator('[data-testid="accordion-content"]')).toBeVisible()
    })

    test('should only allow one expanded at a time', async ({ page }) => {
      await page.goto('/fields')
      await page.click('[data-testid="table-accordion-olist_orders_dataset"]')
      await page.click('[data-testid="table-accordion-olist_customers_dataset"]')
      await expect(page.locator('[data-testid="table-accordion-olist_orders_dataset"] [data-testid="accordion-content"]')).not.toBeVisible()
    })
  })

  test.describe('Modals & Dialogs', () => {
    test('should show confirmation before deploy', async ({ page }) => {
      await page.goto('/deploy')
      await page.click('[data-testid="final-deploy"]')
      await expect(page.locator('[data-testid="confirm-dialog"]')).toBeVisible()
      await expect(page.locator('[data-testid="confirm-message"]')).toContainText('Are you sure')
    })

    test('should close on cancel', async ({ page }) => {
      await page.goto('/deploy')
      await page.click('[data-testid="final-deploy"]')
      await page.click('[data-testid="cancel-button"]')
      await expect(page.locator('[data-testid="confirm-dialog"]')).not.toBeVisible()
    })

    test('should close on escape key', async ({ page }) => {
      await page.goto('/deploy')
      await page.click('[data-testid="final-deploy"]')
      await page.keyboard.press('Escape')
      await expect(page.locator('[data-testid="confirm-dialog"]')).not.toBeVisible()
    })
  })

  test.describe('Toasts & Notifications', () => {
    test('should show success toast on save', async ({ page }) => {
      await page.goto('/connect')
      await page.fill('[data-testid="project-name"]', 'TestProject')
      await page.click('[data-testid="space-development"]')
      await page.click('[data-testid="next-button"]')
      await expect(page.locator('[data-testid="toast-success"]')).toBeVisible()
    })

    test('should auto-dismiss after 5 seconds', async ({ page }) => {
      await page.goto('/connect')
      // Trigger success toast
      await expect(page.locator('[data-testid="toast-success"]')).toBeVisible()
      await expect(page.locator('[data-testid="toast-success"]')).not.toBeVisible({ timeout: 6000 })
    })

    test('should show error toast on API failure', async ({ page }) => {
      // Mock API failure
      await page.route('**/api/spaces', route => route.abort())
      await page.goto('/connect')
      await expect(page.locator('[data-testid="toast-error"]')).toBeVisible()
    })
  })
})
```

### 16.4 User Simulation Tests

```typescript
// tests/e2e/user-simulations.spec.ts
import { test, expect } from '@playwright/test'

test.describe('User Simulations', () => {

  test('New user - first time wizard completion', async ({ page }) => {
    // Clear any existing state
    await page.goto('/')
    await page.evaluate(() => sessionStorage.clear())
    await page.reload()

    // Should start at step 1
    await expect(page).toHaveURL('/connect')

    // Complete minimal flow...
  })

  test('Returning user - resume from saved state', async ({ page }) => {
    // Setup: Pre-populate sessionStorage
    await page.goto('/')
    await page.evaluate(() => {
      sessionStorage.setItem('qmb-app-state', JSON.stringify({
        state: { currentStep: 4, maxReachedStep: 4, projectName: 'ResumeTest' }
      }))
    })
    await page.reload()

    // Should resume at step 4
    await expect(page).toHaveURL('/fields')
    await expect(page.locator('[data-testid="header-project-name"]')).toContainText('ResumeTest')
  })

  test('User navigates back to fix error', async ({ page }) => {
    // Complete first 5 steps
    await page.goto('/incremental')

    // Go back to step 2
    await page.click('[data-testid="sidebar-step-2"]')
    await expect(page).toHaveURL('/source')

    // Make change
    await page.fill('[data-testid="qvd-path"]', 'lib://NewPath/')

    // Forward navigation should preserve change
    await page.click('[data-testid="next-button"]')
    await page.click('[data-testid="sidebar-step-2"]')
    await expect(page.locator('[data-testid="qvd-path"]')).toHaveValue('lib://NewPath/')
  })

  test('User refreshes page mid-wizard', async ({ page }) => {
    await page.goto('/tables')
    await page.click('[data-testid="table-checkbox-0"]')
    await page.click('[data-testid="table-checkbox-1"]')

    // Refresh
    await page.reload()

    // State should be preserved
    await expect(page.locator('[data-testid="table-checkbox-0"]')).toBeChecked()
    await expect(page.locator('[data-testid="table-checkbox-1"]')).toBeChecked()
  })

  test('User opens in new tab', async ({ context, page }) => {
    await page.goto('/fields')
    await page.fill('[data-testid="field-alias-order_id"]', 'OrderKey')

    // Open new tab
    const newPage = await context.newPage()
    await newPage.goto('/fields')

    // Should share state
    await expect(newPage.locator('[data-testid="field-alias-order_id"]')).toHaveValue('OrderKey')
  })

  test('User with slow connection', async ({ page }) => {
    // Simulate slow 3G
    await page.route('**/*', route => {
      setTimeout(() => route.continue(), 500)
    })

    await page.goto('/')

    // Should show loading indicators
    await expect(page.locator('[data-testid="loading-overlay"]')).toBeVisible()

    // Should eventually load
    await expect(page.locator('[data-testid="step-indicator"]')).toBeVisible({ timeout: 10000 })
  })

  test('User with API errors', async ({ page }) => {
    // Mock intermittent API failure
    let callCount = 0
    await page.route('**/api/tables', route => {
      callCount++
      if (callCount < 3) {
        route.abort()
      } else {
        route.fulfill({ json: { tables: [] } })
      }
    })

    await page.goto('/tables')

    // Should show retry button
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible()

    // Retry should work
    await page.click('[data-testid="retry-button"]')
    await page.click('[data-testid="retry-button"]')
    await expect(page.locator('[data-testid="table-list"]')).toBeVisible()
  })
})
```

### 16.5 Accessibility E2E Tests

```typescript
// tests/e2e/accessibility.spec.ts
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('Accessibility', () => {
  test('should have no accessibility violations on each step', async ({ page }) => {
    const steps = [
      '/connect', '/source', '/tables', '/fields', '/incremental', '/extract',
      '/analyze', '/model-type', '/build', '/review', '/deploy'
    ]

    for (const step of steps) {
      await page.goto(step)
      const results = await new AxeBuilder({ page }).analyze()
      expect(results.violations).toEqual([])
    }
  })

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/connect')

    // Tab through all interactive elements
    await page.keyboard.press('Tab')
    await expect(page.locator('[data-testid="project-name"]')).toBeFocused()

    await page.keyboard.press('Tab')
    await expect(page.locator('[data-testid="tenant-url"]')).toBeFocused()

    // Enter should activate buttons
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Enter')
    // Should trigger action
  })

  test('should announce errors to screen readers', async ({ page }) => {
    await page.goto('/connect')
    await page.click('[data-testid="next-button"]')

    const errorRegion = page.locator('[aria-live="polite"]')
    await expect(errorRegion).toContainText('required')
  })
})
```

---

## 17. Disaster Recovery Plan

### 16.1 Recovery Objectives

| Metric | Target | Justification |
|--------|--------|---------------|
| RTO (Recovery Time Objective) | < 1 hour | Low-traffic, non-critical tool |
| RPO (Recovery Point Objective) | 0 (stateless) | User data in Qlik Cloud, not QMB |

### 16.2 Disaster Scenarios

| Scenario | Probability | Impact | Recovery Procedure |
|----------|-------------|--------|-------------------|
| Cloudflare Pages outage | Very Low | High | Wait for Cloudflare recovery or deploy to backup (Vercel) |
| GitHub Actions unavailable | Low | Medium | Manual deploy via Cloudflare dashboard |
| Qlik Cloud API outage | Low | High | Display maintenance message, no recovery needed |
| Gemini API unavailable | Medium | Low | Skip review step, allow manual approval |
| DNS failure | Very Low | High | Contact registrar, use backup domain |
| npm registry outage | Low | Medium | Use cached node_modules or yarn offline mirror |

### 16.3 Backup & Recovery Procedures

**Application State (sessionStorage):**
- No backup needed - user can restart wizard
- State is ephemeral and reconstructable
- If corrupted: `sessionStorage.clear()` + reload

**User's Qlik Data:**
- Not our responsibility - managed by Qlik Cloud
- QMB generates scripts, doesn't store data

**Application Code:**
- Primary: GitHub repository
- Backup: Local developer machines
- Recovery: `git clone` + `npm ci` + deploy

**Secrets & Configuration:**
- GitHub Secrets (encrypted)
- Cloudflare environment variables
- Backup: Secure password manager (1Password/Bitwarden)

### 16.4 Incident Response Runbook

```
INCIDENT DETECTED (via Sentry/UptimeRobot alert)
│
├─▶ Severity Assessment
│   ├─ P1 (Site down): Immediate response
│   ├─ P2 (Degraded): Respond within 1 hour
│   └─ P3 (Minor): Respond within 24 hours
│
├─▶ P1 Response
│   1. Acknowledge alert in Slack #qmb-alerts
│   2. Check Cloudflare status page
│   3. Check GitHub Actions status
│   4. If deployment issue: Rollback via Cloudflare
│   5. If external service: Display maintenance message
│   6. Notify stakeholders
│
├─▶ Resolution
│   1. Identify root cause
│   2. Apply fix or workaround
│   3. Verify recovery
│   4. Update status page
│
└─▶ Post-Incident
    1. Write incident report
    2. Update runbook if needed
    3. Implement preventive measures
```

### 17.5 Specific Recovery Procedures & Testing (NEW)

**Scenario 1: Cloudflare Pages Outage - Failover to Vercel**
```bash
# Pre-configured: Vercel project linked to same GitHub repo
# Recovery steps (manual - automated failover not cost-effective for this scale)

# Step 1: Verify Cloudflare is down (not just network issue)
curl -I https://app.qmb.app  # Should timeout or 5xx

# Step 2: Deploy to Vercel (pre-configured project)
cd web-app
vercel deploy --prod

# Step 3: Update DNS to point to Vercel
# In Cloudflare DNS (or registrar if Cloudflare DNS is down):
# app.qmb.app CNAME -> qmb-production.vercel.app

# Step 4: Verify
curl -I https://app.qmb.app  # Should return 200

# Step 5: Monitor and revert when Cloudflare recovers
```

### 17.6 SessionStorage Handling During Failover (NEW)

**Important:** sessionStorage is browser-domain-scoped and CANNOT be synchronized between Cloudflare and Vercel hosts. During failover, users will lose their in-progress wizard state.

**Mitigation Strategy:**

1. **User Communication:**
```typescript
// shared/components/feedback/FailoverNotice.tsx
// Detect if user was redirected from different domain
export function FailoverNotice() {
  const [showNotice, setShowNotice] = useState(false)

  useEffect(() => {
    const referrer = document.referrer
    const isFailover = referrer &&
      (referrer.includes('cloudflare') && window.location.host.includes('vercel') ||
       referrer.includes('vercel') && window.location.host.includes('cloudflare'))

    if (isFailover) {
      setShowNotice(true)
      // Clear any potentially corrupted state from previous domain
      sessionStorage.clear()
    }
  }, [])

  if (!showNotice) return null

  return (
    <Alert variant="warning">
      <AlertTitle>Service Maintenance</AlertTitle>
      <AlertDescription>
        We're experiencing temporary service issues. Your previous wizard progress
        could not be restored. Please start a new session.
        <p className="text-sm text-muted-foreground mt-2">
          Tip: On the final step, you can download your configuration to restore later.
        </p>
      </AlertDescription>
    </Alert>
  )
}
```

2. **State Export/Import for Recovery:**
```typescript
// store/state-backup.ts
export function exportWizardState(): string {
  const appState = useAppStore.getState()
  const wizardState = useWizardStore.getState()
  const modelState = useModelBuilderStore.getState()

  const backup = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    app: { projectName: appState.projectName, currentStep: appState.currentStep },
    wizard: wizardState,
    model: modelState,
  }

  return btoa(JSON.stringify(backup))  // Base64 encode for easy copy/paste
}

export function importWizardState(encoded: string): boolean {
  try {
    const backup = JSON.parse(atob(encoded))
    if (backup.version !== '1.0') throw new Error('Incompatible backup version')

    useAppStore.setState(backup.app)
    useWizardStore.setState(backup.wizard)
    useModelBuilderStore.setState(backup.model)

    return true
  } catch (error) {
    console.error('Failed to import state:', error)
    return false
  }
}

// UI for backup/restore in Step 11 (Deploy)
export function StateBackupControls() {
  const [importCode, setImportCode] = useState('')

  return (
    <div className="border rounded-lg p-4 mt-4">
      <h4 className="font-medium mb-2">Session Backup</h4>
      <div className="flex gap-2 mb-4">
        <Button variant="outline" onClick={() => {
          const code = exportWizardState()
          navigator.clipboard.writeText(code)
          toast.success('Backup code copied to clipboard')
        }}>
          📋 Copy Backup Code
        </Button>
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Paste backup code to restore..."
          value={importCode}
          onChange={(e) => setImportCode(e.target.value)}
        />
        <Button onClick={() => {
          if (importWizardState(importCode)) {
            toast.success('Session restored!')
            window.location.reload()
          } else {
            toast.error('Invalid backup code')
          }
        }}>
          Restore
        </Button>
      </div>
    </div>
  )
}
```

3. **Acceptance Criteria for Failover:**
- Users are clearly notified that their session could not be restored
- Users can manually restore from backup code if they saved one
- No corrupted state remains after failover
- New sessions work normally on failover host

**Scenario 2: Corrupted SessionStorage State**
```typescript
// Recovery component for users experiencing state corruption
// features/shared/components/StateRecovery.tsx

export function StateRecovery() {
  const [showRecovery, setShowRecovery] = useState(false)

  useEffect(() => {
    try {
      // Attempt to parse stored state
      const appState = sessionStorage.getItem('qmb-app-state')
      if (appState) JSON.parse(appState)

      const wizardState = sessionStorage.getItem('qmb-wizard-state')
      if (wizardState) JSON.parse(wizardState)
    } catch (error) {
      // State is corrupted
      setShowRecovery(true)
      Sentry.captureException(error, { tags: { type: 'state_corruption' } })
    }
  }, [])

  const handleReset = () => {
    sessionStorage.clear()
    window.location.href = '/'
  }

  if (!showRecovery) return null

  return (
    <Alert variant="destructive">
      <AlertTitle>Session Error</AlertTitle>
      <AlertDescription>
        Your session data appears to be corrupted.
        <Button onClick={handleReset} className="ml-2">
          Reset & Start Fresh
        </Button>
      </AlertDescription>
    </Alert>
  )
}
```

**Scenario 3: API Rate Limiting Recovery**
```typescript
// api/utils/retry.ts
export async function fetchWithRetry<T>(
  fetchFn: () => Promise<T>,
  options: {
    maxRetries?: number
    baseDelay?: number
    maxDelay?: number
    onRetry?: (attempt: number, error: Error) => void
  } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 1000, maxDelay = 10000, onRetry } = options

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fetchFn()
    } catch (error) {
      if (attempt === maxRetries) throw error

      // Exponential backoff with jitter
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000,
        maxDelay
      )

      onRetry?.(attempt, error as Error)

      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw new Error('Max retries exceeded')
}
```

**DR Testing Schedule:**

| Test | Frequency | Method | Success Criteria |
|------|-----------|--------|------------------|
| Vercel Failover | Monthly | Deploy to Vercel, test all routes | All 11 steps accessible |
| State Corruption | Weekly (automated) | Inject invalid JSON to sessionStorage | Recovery dialog appears |
| API Rate Limiting | Weekly (automated) | Mock 429 responses | Retry succeeds within 30s |
| Rollback | Per deployment | Cloudflare instant rollback | Previous version live in <1min |

**DR Test Automation:**
```typescript
// tests/e2e/disaster-recovery.spec.ts
test.describe('Disaster Recovery', () => {
  test('should recover from corrupted sessionStorage', async ({ page }) => {
    await page.goto('/')

    // Corrupt the state
    await page.evaluate(() => {
      sessionStorage.setItem('qmb-app-state', '{invalid json')
    })

    await page.reload()

    // Should show recovery dialog
    await expect(page.locator('[data-testid="state-recovery-alert"]')).toBeVisible()

    // Should allow reset
    await page.click('[data-testid="state-recovery-reset"]')
    await expect(page).toHaveURL('/connect')
  })

  test('should handle API rate limiting gracefully', async ({ page }) => {
    let requestCount = 0
    await page.route('**/api/spaces', route => {
      requestCount++
      if (requestCount < 3) {
        route.fulfill({ status: 429, body: 'Rate limited' })
      } else {
        route.fulfill({ json: { spaces: [] } })
      }
    })

    await page.goto('/connect')

    // Should eventually succeed after retries
    await expect(page.locator('[data-testid="spaces-list"]')).toBeVisible({ timeout: 15000 })
  })
})
```

---

## Appendix C: Granular Task Breakdown

### Phase 1 Detailed Tasks

| ID | Task | Subtasks | Acceptance Criteria |
|----|------|----------|---------------------|
| 1.1.1 | Create directory structure | Create api/, features/, shared/, store/, types/, config/ | All folders exist |
| 1.1.2 | Setup path aliases | Configure tsconfig paths for @/ | Import @/store works |
| 1.2.1 | Create appStore | State, actions, persist middleware | Tests pass |
| 1.2.2 | Create wizardStore | Stage 1 state with persistence | Tests pass |
| 1.2.3 | Create modelBuilderStore | Stage 2 state with persistence | Tests pass |
| 1.3.1 | Create QlikClient | Auth, spaces, connections, apps | Mocked tests pass |
| 1.3.2 | Create WizardClient | Maps to WizardEngine | Mocked tests pass |
| 1.3.3 | Create ModelBuilderClient | Maps to ModelBuilder | Mocked tests pass |
| 1.4.1 | Setup QueryClient | Provider, default options | No errors |
| 1.4.2 | Create query hooks | useQlikQuery, useWizardMutation | Type-safe hooks |
| 1.5.1 | Create AppLayout | Header, Sidebar, main area | Renders correctly |
| 1.5.2 | Create StepIndicator | Progress display for 11 steps | Shows current step |
| 1.5.3 | Create Sidebar | Step navigation list | Navigates correctly |
| 1.6.1 | Create ErrorBoundary | Catch errors, Sentry report | Catches errors |
| 1.6.2 | Create LoadingOverlay | Spinner with message | Shows during loading |
| 1.6.3 | Create Toast provider | Success/error/warning toasts | Toasts appear |
| 1.7.1 | Define routes config | 11 step routes | All routes defined |
| 1.7.2 | Create StepGuard | Prevent step skipping | Guards work |
| 1.7.3 | Setup BrowserRouter | Nested routes | Navigation works |
| 1.8.1 | Configure Sentry | DSN, environment, release | Errors captured |
| 1.8.2 | Configure LogRocket | Session recording | Sessions recorded |

### Phase 2 Detailed Tasks

| ID | Task | Subtasks | Acceptance Criteria |
|----|------|----------|---------------------|
| 2.1.1 | ConnectForm component | Project name input | Validates input |
| 2.1.2 | TenantInput component | URL input with validation | Valid URL format |
| 2.1.3 | SpaceSelector component | Dropdown + create option | Lists spaces |
| 2.1.4 | useConnectStep hook | Form state, submit handler | Saves to store |
| 2.2.1 | SourceTypeCards component | Database, API, Files cards | Selection works |
| 2.2.2 | DatabaseForm component | Server, database, creds | Validates required |
| 2.2.3 | ApiForm component | Base URL, auth config | Validates format |
| 2.2.4 | FileUpload component | Drag-drop, file picker | Files selected |
| 2.2.5 | Connection test button | Test + status indicator | Shows result |
| 2.3.1 | TableList component | Checkbox selection list | Multi-select works |
| 2.3.2 | TableSearch component | Filter by name | Filters correctly |
| 2.3.3 | TablePreview component | Sample rows on hover | Shows preview |
| 2.4.1 | FieldList component | Per-table field selection | Checkboxes work |
| 2.4.2 | KeyTypeSelector component | PK/BK/FK badges | Toggle works |
| 2.4.3 | FieldAlias input | Rename fields | Saves alias |
| 2.5.1 | StrategySelector component | Dropdown per table | Selection works |
| 2.5.2 | DateFieldPicker component | For by_date strategy | Picks date field |
| 2.5.3 | IdFieldPicker component | For by_id strategy | Picks ID field |
| 2.5.4 | AI suggestion button | Analyze fields, suggest | Shows suggestions |
| 2.6.1 | ScriptPreview component | Syntax highlighted readonly | Displays script |
| 2.6.2 | ValidationPanel component | Errors, warnings list | Shows issues |
| 2.6.3 | Deploy button + progress | Deploy to Qlik Cloud | Shows progress |

### Phase 3 Detailed Tasks

| ID | Task | Subtasks | Acceptance Criteria |
|----|------|----------|---------------------|
| 3.1.1 | QVD analysis progress | Progress bar | Shows progress |
| 3.1.2 | ClassificationResults | Table cards with badges | Shows classification |
| 3.1.3 | ClassificationOverride | Dropdown to change type | Override works |
| 3.1.4 | RelationshipDiagram | Simple connection lines | Shows relationships |
| 3.2.1 | ModelTypeCards | Star, Snowflake, Link, Concat | Selection works |
| 3.2.2 | Recommendation highlight | AI-suggested option | Shows recommended |
| 3.2.3 | ProsCons display | Per model type | Displays info |
| 3.3.1 | StageTabs component | A-F tab navigation | Tabs switch |
| 3.3.2 | StageA component | Config script preview | Shows script |
| 3.3.3 | StageB component | Dimension scripts | Shows scripts |
| 3.3.4 | StageC component | Fact scripts | Shows scripts |
| 3.3.5 | StageD component | Calendar script | Shows script |
| 3.3.6 | StageE component | Link scripts | Shows scripts |
| 3.3.7 | StageF component | Final assembly | Shows script |
| 3.3.8 | StageApproval buttons | Approve/Reject per stage | Advances stage |
| 3.4.1 | ReviewRequest button | Submit to Gemini | Sends request |
| 3.4.2 | ScoreDisplay component | 0-100 with color | Shows score |
| 3.4.3 | IssuesList component | Categorized issues | Lists issues |
| 3.4.4 | StrengthsList component | Positive aspects | Lists strengths |
| 3.4.5 | Re-review button | After manual fixes | Re-submits |
| 3.5.1 | DeploySummary component | Stats before deploy | Shows summary |
| 3.5.2 | DeployButton component | Final deploy action | Deploys |
| 3.5.3 | SuccessDisplay component | App URL, downloads | Shows result |

---

**END OF IMPLEMENTATION PLAN v3.1 (FINAL)**
