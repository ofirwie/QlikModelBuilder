# QlikFox Web App - Design Document

**Date:** 2026-01-22
**Status:** Approved
**Product:** QlikFox

---

## 1. Overview

QlikFox is a unified 11-step wizard that combines Stage 1 (Data Extraction) and Stage 2 (Model Building) into a single end-to-end flow. From data source to complete ETL model in Qlik Cloud.

---

## 2. Architecture

### 2.1 Directory Structure

```
QlikFox/
├── src/
│   ├── wizard/              ← Stage 1 Backend (from stage1-testing)
│   ├── model-builder/       ← Stage 2 Backend (from stage1-testing)
│   └── ...
│
└── web-app/
    └── src/
        ├── features/        ← 11 Steps (new)
        │   ├── step01-connect/
        │   ├── step02-source/
        │   ├── step03-tables/
        │   ├── step04-fields/
        │   ├── step05-incremental/
        │   ├── step06-extract/
        │   ├── step07-analyze/
        │   ├── step08-model-type/
        │   ├── step09-build/
        │   ├── step10-review/
        │   └── step11-deploy/
        │
        ├── api/             ← API Clients (new)
        │   ├── wizard-client.ts
        │   └── model-builder-client.ts
        │
        ├── store/           ← 3 Zustand Stores (new)
        │   ├── appStore.ts
        │   ├── wizardStore.ts
        │   └── modelBuilderStore.ts
        │
        ├── components/      ← UI (preserved from feature/ui-design)
        │   ├── ui/
        │   └── layout/
        │
        └── lib/             ← Utils (preserved)
```

### 2.2 Data Flow

```
User Input → Store → API Client → Backend → Qlik Cloud
                ↓
           SessionStorage (persistence)
```

---

## 3. The 11 Steps

### Stage 1: Data Extraction (Steps 1-6)

| Step | Name | Action | Output |
|------|------|--------|--------|
| 1 | **Connect** | Connect to Qlik Cloud tenant | `tenantUrl`, `spaceId` |
| 2 | **Source** | Select source type (DB/API/File) | `sourceType`, `connectionString` |
| 3 | **Tables** | Select tables for extraction | `selectedTables[]` |
| 4 | **Fields** | Map fields + types | `fieldMappings[]` |
| 5 | **Incremental** | Configure incremental load strategy | `incrementalConfig` |
| 6 | **Extract** | Run extraction → QVD files | `qvdPaths[]` |

### Stage 2: Model Building (Steps 7-11)

| Step | Name | Action | Output |
|------|------|--------|--------|
| 7 | **Analyze** | Classify QVDs (Fact/Dim/Bridge) | `analysisResult` |
| 8 | **Model Type** | AI recommends optimal model type | `modelType` |
| 9 | **Build** | Build model (stages A-F) | `stageScripts{}` |
| 10 | **Review** | Gemini review + approval | `geminiReview` |
| 11 | **Deploy** | Deploy to Qlik Cloud | `deployResult` |

---

## 4. AI Architecture

### 4.1 Dual AI System

```
┌─────────────────────────────────────────────────────────────┐
│                    QlikFox AI Layer                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────┐    ┌─────────────────────┐        │
│  │   Claude Opus 4.5   │    │      Gemini         │        │
│  │   ─────────────────  │    │   ─────────────────  │        │
│  │   • Builds code     │    │   • Validates code  │        │
│  │   • Manages flow    │───▶│   • Extra control   │        │
│  │   • Makes decisions │    │   • Optimization    │        │
│  │   • Creates scripts │◀───│   • Review + score  │        │
│  └─────────────────────┘    └─────────────────────┘        │
│                                                             │
│  ┌─────────────────────────────────────────────────┐       │
│  │   Future: Translation Layer                     │       │
│  │   Hebrew ↔ English (token optimization)         │       │
│  └─────────────────────────────────────────────────┘       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 AI Roles

| AI | Role | When |
|----|------|------|
| **Claude Opus 4.5** | Build code, manage flow, decisions | Steps 1-11 |
| **Gemini** | Validate, review, optimize | Step 8 (recommendation), Step 10 (review) |

### 4.3 Step 8 - AI-Assisted Model Type Selection

```
┌─────────────────────────────────────────────────────────────┐
│  Step 8: Model Type Selection                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Analysis Result (from Step 7):                             │
│     • 3 Fact tables                                         │
│     • 8 Dimension tables                                    │
│     • 2 Bridge tables                                       │
│                                                             │
│  Gemini Recommendation:                                     │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ "Based on the analysis, I recommend a                 │ │
│  │  **Snowflake Schema** because:                        │ │
│  │  • Multiple dimension hierarchies detected            │ │
│  │  • Bridge tables suggest M:N relationships            │ │
│  │  • Better query performance for your data volume"     │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  Choose Model Type:                                         │
│  ○ Star Schema                                              │
│  ● Snowflake Schema (Recommended)                           │
│  ○ Link Table                                               │
│                                                             │
│                          [Back] [Accept Recommendation]     │
└─────────────────────────────────────────────────────────────┘
```

### 4.4 Gemini Validation Toggle

```typescript
interface ValidationConfig {
  enableGeminiReview: boolean      // User toggle
  skipSimpleOperations: boolean    // Auto-skip flag
  simpleThreshold: number          // Lines of code (default: 50)
}

function shouldValidateWithGemini(script: string, config: ValidationConfig): boolean {
  if (!config.enableGeminiReview) return false
  if (config.skipSimpleOperations && script.split('\n').length < config.simpleThreshold) {
    return false
  }
  return true
}
```

| Situation | Gemini Review |
|-----------|---------------|
| Simple script (< 50 lines) | Skip (if flag enabled) |
| Complex script | Validate |
| Step 10 (Final Review) | Always (required) |
| User disabled manually | Skip |

---

## 5. Testing Strategy

### 5.1 Pre-flight Checks

```typescript
interface PreflightResult {
  ready: boolean
  checks: PreflightCheck[]
}

interface PreflightCheck {
  name: string
  status: 'pass' | 'fail' | 'warning'
  message: string
}

async function runPreflightChecks(): Promise<PreflightResult> {
  const checks = [
    checkQlikApiKey(),      // QLIK_API_KEY exists & valid
    checkGeminiApiKey(),    // GEMINI_API_KEY exists & valid
    checkQlikTenant(),      // Tenant is reachable
    checkSpaceAccess(),     // User has space permissions
    checkBackendHealth(),   // Backend services running
  ]

  const results = await Promise.all(checks)
  return {
    ready: results.every(c => c.status === 'pass'),
    checks: results
  }
}
```

### 5.2 E2E Simulation Test

```
┌────────────────────────────────────────────────────────┐
│  Full User Simulation Test                             │
├────────────────────────────────────────────────────────┤
│                                                        │
│  1. Pre-flight checks           ✓ All passed          │
│  2. Step 1: Connect             ✓ Connected           │
│  3. Step 2: Source              ✓ DB selected         │
│  4. Step 3: Tables              ✓ 5 tables            │
│  5. Step 4: Fields              ✓ Mapped              │
│  6. Step 5: Incremental         ✓ Configured          │
│  7. Step 6: Extract             ✓ 5 QVDs created      │
│  8. Step 7: Analyze             ✓ Classified          │
│  9. Step 8: Model Type          ✓ Snowflake (AI)      │
│  10. Step 9: Build              ✓ 6 stages done       │
│  11. Step 10: Review            ✓ Score: 95/100       │
│  12. Step 11: Deploy            ⏸️ Waiting approval   │
│                                                        │
│  [Run Test]  [Stop]  [View Logs]                      │
└────────────────────────────────────────────────────────┘
```

### 5.3 Test Modes

| Mode | Action | When |
|------|--------|------|
| **Dry Run** | Run everything without changing data | Development |
| **Sandbox** | Run on separate Qlik space | QA |
| **Production** | Real execution (requires approval) | Release |

---

## 6. Critical Rules

1. **No execution without explicit user approval**
2. **Pre-flight checks must pass before any run**
3. **Full E2E simulation before production**
4. **AI validation is optional (toggle) except for Step 10**

---

## 7. Implementation Phases

### Phase 0: Setup
- Create branch `feature/qlikfox-webapp`
- Merge backend from `stage1-testing`
- Keep UI components from `feature/ui-design`

### Phase 1: Foundation
- Create `features/` structure (11 steps)
- Setup 3 Zustand stores with persistence
- Create API clients

### Phase 2: Steps 1-6 (Stage 1)
- Connect, Source, Tables, Fields, Incremental, Extract

### Phase 3: Steps 7-11 (Stage 2)
- Analyze, Model Type (AI), Build, Review, Deploy

### Phase 4: Testing & Polish
- Pre-flight checks
- E2E simulation
- Full user flow test

---

## 8. Git Strategy

| Branch | Content |
|--------|---------|
| `stage1-testing` | Backend: wizard + model-builder |
| `feature/ui-design` | Current UI (basic) |
| `feature/qlikfox-webapp` | **New unified branch** |

---

## 9. Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React 18 + TypeScript |
| Build | Vite |
| State | Zustand + persist |
| Routing | React Router v6 |
| UI | Shadcn/ui + Tailwind |
| Forms | React Hook Form + Zod |
| API | TanStack Query |
| Testing | Vitest + Playwright |
| AI (Build) | Claude Opus 4.5 |
| AI (Validate) | Gemini |
