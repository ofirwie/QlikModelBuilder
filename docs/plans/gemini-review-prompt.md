# Gemini Review Prompt

Copy everything below this line and paste into Google AI Studio:

---

You are a Senior UI/UX Designer and Product Architect with 20+ years of experience designing enterprise B2B SaaS applications. You have worked at companies like Salesforce, Tableau, and Microsoft on data visualization and analytics tools.

I am building a commercial web application called "QlikModelBuilder" that helps Qlik Sense developers build optimized data models. Please review my UI design specification and provide professional feedback.

## Context
- Target user: Junior Qlik Developer (understands data modeling concepts)
- Product type: Enterprise B2B SaaS (will be sold to companies)
- Platform: Cloud-hosted web application
- Core workflow: Guide user through building a Qlik data model step-by-step with validation

## My Design Specification

### User Flow (5 Phases)
1. **CONNECT** - Link to customer's Qlik Cloud tenant
2. **PLAN** - System analyzes data, proposes model type, shows execution plan
3. **BUILD** - Execute chapter by chapter, validate after each step
4. **VALIDATE** - Final quality checks, AI review
5. **DEPLOY** - Create real Qlik application in cloud

### Build Phase Detail
Each chapter follows: Generate Script → Execute on Qlik → Run Validations → Human Decision

Validation results show:
- ✅ Passed (green)
- ⚠️ Warning (amber) - user decides: approve, override, or stop
- ❌ Critical (red) - must fix before continuing

### Layout
- Fixed header with project name and status
- Left sidebar: Phase progress + chapter list + completion percentage
- Main content: Varies by phase (plan view, script editor, validation results)
- Bottom: Collapsible AI chat assistant

### Color Palette

**Primary Colors:**
- Primary: #1A56DB (Trust Blue) - main actions, links
- Secondary: #1E3A5F (Deep Navy) - headers, sidebar
- Accent: #0EA5E9 (Sky Blue) - highlights, hover states

**Status Colors:**
- Success: #059669 (Emerald)
- Warning: #D97706 (Amber)
- Error: #DC2626 (Red)
- Info: #6366F1 (Indigo)

**Neutrals (Light Theme):**
- Page background: #F9FAFB
- Cards: #FFFFFF
- Borders: #E5E7EB
- Primary text: #111827
- Secondary text: #4B5563

### Tech Stack
- React 18 + TypeScript
- Tailwind CSS
- Shadcn/ui components
- Monaco Editor for scripts

---

## Please Review and Answer:

1. **Flow Assessment (1-10):** Rate the Connect→Plan→Build→Validate→Deploy flow. Is it intuitive? Are there missing steps?

2. **Color Palette Assessment (1-10):** Is this palette professional and appropriate for enterprise software? Any specific colors to change?

3. **Layout Assessment (1-10):** Is the sidebar + main content + bottom chat layout effective? Would you change the structure?

4. **Human-in-the-Loop Design (1-10):** Is the "build → validate → decide" pattern clear? How would you improve the decision points?

5. **Enterprise Readiness (1-10):** Does this feel like a product worth paying $500+/month for? What's missing?

6. **Your Top 3 Recommendations:** What would you change as a 20-year UI veteran?

7. **Color Palette Alternative:** If you would change the colors, provide a complete alternative palette with hex codes.

8. **Overall Score (1-10):** With brief justification.

Please be critical and specific. I want honest professional feedback, not encouragement.
