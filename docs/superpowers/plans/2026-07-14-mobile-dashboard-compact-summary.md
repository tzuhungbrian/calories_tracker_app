# Mobile Dashboard Compact Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the crowded mobile Dashboard nutrition summary with the approved Compact Cards layout while preserving desktop behavior and nutrition calculations.

**Architecture:** Keep `nutrientStatus()` as the single source of truth. `CompactNutritionSummary` renders a dedicated mobile 2-by-2 presentation below `xl` and the existing five-column presentation at `xl` and above. Playwright verifies the mobile content hierarchy and viewport width.

**Tech Stack:** Next.js 14, React, TypeScript, Tailwind CSS, Playwright.

## Global Constraints

- Do not change Google Sheets schema or API routes.
- Do not add dependencies.
- Keep all nutrition calculations and status semantics unchanged.
- Keep desktop Dashboard content unchanged.
- Respect dark mode and reduced-motion behavior.

---

### Task 1: Mobile compact nutrition summary

**Files:**
- Modify: `e2e/ux.spec.ts`
- Modify: `components/stats_dashboard.tsx`

**Interfaces:**
- Consumes: existing `DashboardData`, `nutrientStatus()`, `nutrientValue()`, and `nutrientKeys`.
- Produces: an accessible `Today's nutrition summary` region with mobile compact cards and a full-width mobile TDEE row.

- [x] **Step 1: Write the failing mobile regression test**

Add a Playwright test at 390x844 that locates `Today's nutrition summary`, expects `Recent history`, all four nutrient labels, `Dynamic TDEE`, and verifies `document.documentElement.scrollWidth <= document.documentElement.clientWidth`.

- [x] **Step 2: Run the focused test and verify RED**

Run: `npm.cmd run test:e2e -- --grep "mobile Dashboard keeps nutrition cards compact"`

Expected: FAIL because the summary region and `Recent history` mobile label do not exist yet.

- [x] **Step 3: Implement the approved compact layout**

In `StatsDashboard`:

- Replace the mobile `Analysis window` label with `Recent history` and hide the generic explanatory sentence below `sm`.
- Add `aria-label="Today's nutrition summary"` to the summary section.
- Hide the calorie target context chip below `xl`.
- Render Calories, Protein, Fat, and Carbs in a mobile 2-by-2 grid with metric name, short text status, primary total, one supporting line, and a thin progress bar.
- Render mobile TDEE as one full-width row below the four cards.
- Preserve the existing five-column card layout inside `hidden xl:grid`.

- [x] **Step 4: Run the focused test and verify GREEN**

Run: `npm.cmd run test:e2e -- --grep "mobile Dashboard keeps nutrition cards compact"`

Expected: PASS.

- [x] **Step 5: Verify quality and responsive behavior**

Run:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:e2e
npm.cmd run build
```

Inspect 375x812, 390x844, and 430x932 in light and dark mode. Confirm there is no horizontal overflow and the energy chart begins higher on the page than before.

- [x] **Step 6: Commit the implementation**

```powershell
git add components/stats_dashboard.tsx e2e/ux.spec.ts docs/superpowers/plans/2026-07-14-mobile-dashboard-compact-summary.md
git commit -m "Improve mobile dashboard nutrition summary"
```
