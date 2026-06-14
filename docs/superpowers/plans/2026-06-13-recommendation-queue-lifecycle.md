# Recommendation Queue Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Security and Evidence recommendation lists usable over time by showing active work by default, moving resolved items into a history view, and limiting long queues without deleting audit evidence.

**Architecture:** This is a frontend/model-layer change. The audit log remains immutable and backend recommendation workflow events remain the source of truth. Existing `SecurityRecommendationWorkflowStatus` values drive queue views: `Active` shows non-resolved recommendations, `Resolved` shows closed recommendations, and `All` remains available for investigation/export.

**Tech Stack:** Next.js app router, React state, TypeScript feature model helpers, Vitest specs, existing DocVault components/styles.

---

## File Structure

- Modify `apps/web/src/features/audit/security-dashboard.ts`
  - Add reusable recommendation queue helpers and types.
  - Keep `buildSecurityDashboardModel` behavior intact, but expose pure functions for filtering/counting recommendation rows.
- Modify `apps/web/src/features/audit/security-dashboard.spec.ts`
  - Add focused model-helper tests for active/resolved/all views and default queue limits.
- Modify `apps/web/src/features/evidence/evidence-center.ts`
  - Add reusable evidence recommendation queue helpers if Evidence needs feature-local target filtering.
  - Keep bundle manifest generation unchanged so hidden selected IDs are still valid.
- Modify `apps/web/src/features/evidence/evidence-center.spec.ts`
  - Add tests that Evidence defaults to active recommendation packets and can show resolved/all.
- Modify `apps/web/src/app/(app)/security/page.tsx`
  - Add segmented controls for `Active`, `Resolved`, `All`.
  - Default to `Active`.
  - Show counts and a capped list with `Show more` / `Show fewer`.
- Modify `apps/web/src/app/(app)/evidence/page.tsx`
  - Add the same queue controls to `RecommendationPacketQueue`.
  - Default to active recommendation packets.
  - Preserve bundle selections even if the selected packet is hidden by the current filter.

No backend files should change for this plan.

---

### Task 1: Add Security Recommendation Queue Helpers

**Files:**
- Modify: `apps/web/src/features/audit/security-dashboard.ts`
- Test: `apps/web/src/features/audit/security-dashboard.spec.ts`

- [ ] **Step 1: Write failing tests for queue filtering**

Add tests near the existing recommendation model tests in `security-dashboard.spec.ts`:

```ts
import {
  filterSecurityRecommendationRows,
  getSecurityRecommendationQueueCounts,
} from './security-dashboard';

it('filters security recommendations by active, resolved, and all queue views', () => {
  const model = buildSecurityDashboardModel(
    summary({
      recommendations: [
        recommendationFixture('open-rec', 'OPEN'),
        recommendationFixture('investigating-rec', 'INVESTIGATING'),
        recommendationFixture('reviewed-rec', 'REVIEWED'),
        recommendationFixture('resolved-rec', 'RESOLVED'),
      ],
    }),
  );

  expect(
    filterSecurityRecommendationRows(model.recommendations.items, 'active').map(
      (item) => item.id,
    ),
  ).toEqual(['open-rec', 'investigating-rec', 'reviewed-rec']);
  expect(
    filterSecurityRecommendationRows(model.recommendations.items, 'resolved').map(
      (item) => item.id,
    ),
  ).toEqual(['resolved-rec']);
  expect(
    filterSecurityRecommendationRows(model.recommendations.items, 'all').map(
      (item) => item.id,
    ),
  ).toEqual(['open-rec', 'investigating-rec', 'reviewed-rec', 'resolved-rec']);
});

it('counts security recommendation queue views', () => {
  const model = buildSecurityDashboardModel(
    summary({
      recommendations: [
        recommendationFixture('open-rec', 'OPEN'),
        recommendationFixture('reviewed-rec', 'REVIEWED'),
        recommendationFixture('resolved-rec', 'RESOLVED'),
      ],
    }),
  );

  expect(getSecurityRecommendationQueueCounts(model.recommendations.items)).toEqual({
    active: 2,
    resolved: 1,
    all: 3,
  });
});
```

If no `recommendationFixture` helper exists in the spec, add this local helper:

```ts
function recommendationFixture(
  id: string,
  status: SecurityRecommendationWorkflowStatus,
): SecurityRecommendationSummary {
  return {
    id,
    type: 'ACTOR_ACCESS_REVIEW',
    severity: 'warning',
    title: id,
    reason: 'Test recommendation',
    recommendedAction: 'Review the audit evidence.',
    evidence: ['1 audit signal'],
    affectedDocumentIds: [],
    affectedActorIds: [],
    auditFilters: { actorId: 'actor-1' },
    workflow: { status },
  };
}
```

- [ ] **Step 2: Run the failing test**

Run:

```powershell
pnpm --filter web test security-dashboard.spec.ts
```

Expected: fail because `filterSecurityRecommendationRows` and `getSecurityRecommendationQueueCounts` are not implemented/exported.

- [ ] **Step 3: Implement the helpers**

In `security-dashboard.ts`, add:

```ts
export type SecurityRecommendationQueueView = 'active' | 'resolved' | 'all';

export const SECURITY_RECOMMENDATION_PREVIEW_LIMIT = 6;

export function filterSecurityRecommendationRows(
  items: SecurityRecommendationRow[],
  view: SecurityRecommendationQueueView,
): SecurityRecommendationRow[] {
  if (view === 'all') return items;
  if (view === 'resolved') {
    return items.filter((item) => item.workflow.status === 'RESOLVED');
  }
  return items.filter((item) => item.workflow.status !== 'RESOLVED');
}

export function getSecurityRecommendationQueueCounts(
  items: SecurityRecommendationRow[],
): Record<SecurityRecommendationQueueView, number> {
  const resolved = items.filter(
    (item) => item.workflow.status === 'RESOLVED',
  ).length;
  return {
    active: items.length - resolved,
    resolved,
    all: items.length,
  };
}
```

- [ ] **Step 4: Run the test again**

Run:

```powershell
pnpm --filter web test security-dashboard.spec.ts
```

Expected: pass.

---

### Task 2: Add Security Page Queue Controls

**Files:**
- Modify: `apps/web/src/app/(app)/security/page.tsx`
- Test: `apps/web/src/features/audit/security-dashboard.spec.ts` stays as helper coverage; page has no existing component test.

- [ ] **Step 1: Import helper APIs**

In `security/page.tsx`, extend the existing import from `security-dashboard`:

```ts
import {
  buildSecurityDashboardModel,
  buildAuditFilterQuery,
  buildRecommendationEvidencePacket,
  filterSecurityRecommendationRows,
  getSecurityRecommendationQueueCounts,
  SECURITY_RECOMMENDATION_PREVIEW_LIMIT,
  type SecurityDashboardMetric,
  type SecurityRecommendationPlaybook,
  type SecurityRecommendationQueueView,
  type SecurityRecommendationSlaState,
} from '@/features/audit/security-dashboard';
```

- [ ] **Step 2: Add page state**

Inside `SecurityPage`, near the other `useState` calls:

```ts
const [recommendationQueueView, setRecommendationQueueView] =
  useState<SecurityRecommendationQueueView>('active');
const [showAllRecommendations, setShowAllRecommendations] = useState(false);
```

- [ ] **Step 3: Pass queue state into the panel**

Update the `RecommendationsPanel` call:

```tsx
<RecommendationsPanel
  recommendations={model.recommendations}
  auditChain={auditChain}
  queueView={recommendationQueueView}
  showAll={showAllRecommendations}
  onQueueViewChange={(view) => {
    setRecommendationQueueView(view);
    setShowAllRecommendations(false);
  }}
  onToggleShowAll={() => setShowAllRecommendations((current) => !current)}
  pendingRecommendationId={pendingRecommendationId}
  workflowError={workflowError}
  expandedHistoryIds={expandedHistoryIds}
  workflowHistoryByRecommendationId={workflowHistoryByRecommendationId}
  historyLoadingId={historyLoadingId}
  historyErrors={historyErrors}
  onSaveWorkflow={saveRecommendationWorkflow}
  onToggleHistory={toggleRecommendationHistory}
  onDownloadEvidence={downloadRecommendationEvidence}
/>
```

- [ ] **Step 4: Extend `RecommendationsPanel` props and derive visible items**

Add props:

```ts
queueView: SecurityRecommendationQueueView;
showAll: boolean;
onQueueViewChange: (view: SecurityRecommendationQueueView) => void;
onToggleShowAll: () => void;
```

Replace:

```ts
const items = recommendations.items;
```

with:

```ts
const counts = getSecurityRecommendationQueueCounts(recommendations.items);
const filteredItems = filterSecurityRecommendationRows(
  recommendations.items,
  queueView,
);
const hiddenCount = Math.max(
  0,
  filteredItems.length - SECURITY_RECOMMENDATION_PREVIEW_LIMIT,
);
const items = showAll
  ? filteredItems
  : filteredItems.slice(0, SECURITY_RECOMMENDATION_PREVIEW_LIMIT);
```

- [ ] **Step 5: Add segmented controls in the panel header**

Place this under the header description and before the empty/list block:

```tsx
<div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
  <div className="inline-flex w-fit rounded-lg border border-[var(--border-soft)] bg-[var(--bg-subtle)] p-1">
    {(['active', 'resolved', 'all'] as SecurityRecommendationQueueView[]).map(
      (view) => (
        <button
          key={view}
          type="button"
          aria-pressed={queueView === view}
          onClick={() => onQueueViewChange(view)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            queueView === view
              ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-sm'
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          {getRecommendationQueueViewLabel(view)} {counts[view]}
        </button>
      ),
    )}
  </div>
  <p className="text-xs text-[var(--text-muted)]">
    Active hides resolved recommendations without deleting audit evidence.
  </p>
</div>
```

Add helper near other page helpers:

```ts
function getRecommendationQueueViewLabel(
  view: SecurityRecommendationQueueView,
): string {
  if (view === 'active') return 'Active';
  if (view === 'resolved') return 'Resolved';
  return 'All';
}
```

- [ ] **Step 6: Update empty-state copy**

Replace the no-item copy with:

```tsx
<p className="mt-4 text-sm text-[var(--text-muted)]">
  {queueView === 'active'
    ? 'No active recommendations need review.'
    : queueView === 'resolved'
      ? 'No resolved recommendations are available.'
      : 'No recommendation is raised by the current security summary.'}
</p>
```

- [ ] **Step 7: Add show more / show fewer footer**

After the cards grid:

```tsx
{filteredItems.length > SECURITY_RECOMMENDATION_PREVIEW_LIMIT ? (
  <div className="mt-4 flex justify-center">
    <button
      type="button"
      onClick={onToggleShowAll}
      className="inline-flex items-center rounded-lg border border-[var(--border-soft)] px-3 py-2 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--bg-subtle)]"
    >
      {showAll ? 'Show fewer' : `Show ${hiddenCount} more`}
    </button>
  </div>
) : null}
```

- [ ] **Step 8: Run verification**

Run:

```powershell
pnpm --filter web test security-dashboard.spec.ts
pnpm --filter web lint
```

Expected: both pass.

---

### Task 3: Add Evidence Recommendation Queue Helpers

**Files:**
- Modify: `apps/web/src/features/evidence/evidence-center.ts`
- Test: `apps/web/src/features/evidence/evidence-center.spec.ts`

- [ ] **Step 1: Write failing tests for Evidence target filtering**

Add tests in `evidence-center.spec.ts`:

```ts
import {
  filterEvidenceRecommendationTargets,
  getEvidenceRecommendationQueueCounts,
} from './evidence-center';

it('filters evidence recommendation packet targets by active, resolved, and all views', () => {
  const model = buildEvidenceCenterModel({
    securitySummary: securitySummaryWithRecommendationStatuses([
      ['open-rec', 'OPEN'],
      ['reviewed-rec', 'REVIEWED'],
      ['resolved-rec', 'RESOLVED'],
    ]),
    retentionEvidence: retentionEvidence(),
    generatedAt: '2026-06-13T10:00:00.000Z',
  });

  expect(
    filterEvidenceRecommendationTargets(model.recommendationTargets, 'active').map(
      (item) => item.id,
    ),
  ).toEqual(['open-rec', 'reviewed-rec']);
  expect(
    filterEvidenceRecommendationTargets(model.recommendationTargets, 'resolved').map(
      (item) => item.id,
    ),
  ).toEqual(['resolved-rec']);
  expect(
    filterEvidenceRecommendationTargets(model.recommendationTargets, 'all').map(
      (item) => item.id,
    ),
  ).toEqual(['open-rec', 'reviewed-rec', 'resolved-rec']);
});

it('counts evidence recommendation packet queue views', () => {
  const model = buildEvidenceCenterModel({
    securitySummary: securitySummaryWithRecommendationStatuses([
      ['open-rec', 'OPEN'],
      ['resolved-rec', 'RESOLVED'],
    ]),
    retentionEvidence: retentionEvidence(),
    generatedAt: '2026-06-13T10:00:00.000Z',
  });

  expect(getEvidenceRecommendationQueueCounts(model.recommendationTargets)).toEqual({
    active: 1,
    resolved: 1,
    all: 2,
  });
});
```

Add a spec-local helper if the existing fixtures cannot express statuses:

```ts
function securitySummaryWithRecommendationStatuses(
  statuses: Array<[string, SecurityRecommendationWorkflowStatus]>,
): SecuritySummary {
  return {
    ...securitySummary(),
    recommendations: statuses.map(([id, status]) => ({
      id,
      type: 'ACTOR_ACCESS_REVIEW',
      severity: 'warning',
      title: id,
      reason: 'Test recommendation',
      recommendedAction: 'Review audit evidence.',
      evidence: ['1 audit signal'],
      affectedDocumentIds: [],
      affectedActorIds: [],
      auditFilters: { actorId: 'actor-1' },
      workflow: { status },
    })),
  };
}
```

- [ ] **Step 2: Run the failing test**

Run:

```powershell
pnpm --filter web test evidence-center.spec.ts
```

Expected: fail because helper exports do not exist.

- [ ] **Step 3: Implement Evidence queue helpers**

In `evidence-center.ts`, add:

```ts
export type EvidenceRecommendationQueueView = 'active' | 'resolved' | 'all';

export const EVIDENCE_RECOMMENDATION_PREVIEW_LIMIT = 6;

export function filterEvidenceRecommendationTargets(
  items: EvidenceRecommendationTarget[],
  view: EvidenceRecommendationQueueView,
): EvidenceRecommendationTarget[] {
  if (view === 'all') return items;
  if (view === 'resolved') {
    return items.filter((item) => item.workflowStatus === 'RESOLVED');
  }
  return items.filter((item) => item.workflowStatus !== 'RESOLVED');
}

export function getEvidenceRecommendationQueueCounts(
  items: EvidenceRecommendationTarget[],
): Record<EvidenceRecommendationQueueView, number> {
  const resolved = items.filter(
    (item) => item.workflowStatus === 'RESOLVED',
  ).length;
  return {
    active: items.length - resolved,
    resolved,
    all: items.length,
  };
}
```

- [ ] **Step 4: Run the test again**

Run:

```powershell
pnpm --filter web test evidence-center.spec.ts
```

Expected: pass.

---

### Task 4: Add Evidence Page Queue Controls

**Files:**
- Modify: `apps/web/src/app/(app)/evidence/page.tsx`
- Test: `apps/web/src/features/evidence/evidence-center.spec.ts` remains helper coverage.

- [ ] **Step 1: Import helper APIs**

Extend the existing import from `evidence-center`:

```ts
import {
  buildEvidenceBundle,
  buildEvidenceCaseNarrative,
  buildEvidenceCenterManifest,
  buildEvidenceCenterModel,
  buildEvidenceCenterDocumentPacket,
  filterEvidenceRecommendationTargets,
  getEvidenceRecommendationQueueCounts,
  resolveActorIdsInText,
  EVIDENCE_RECOMMENDATION_PREVIEW_LIMIT,
  type EvidenceBundleManifest,
  type EvidenceCaseNarrative,
  type EvidenceCenterModel,
  type EvidenceCommandMetric,
  type EvidenceDocumentPacketTarget,
  type EvidenceRecommendationQueueView,
  type EvidenceRecommendationTarget,
  type UserDisplayNameMap,
} from '@/features/evidence/evidence-center';
```

- [ ] **Step 2: Add page state**

Inside `EvidenceCenterPage`:

```ts
const [recommendationQueueView, setRecommendationQueueView] =
  useState<EvidenceRecommendationQueueView>('active');
const [showAllRecommendations, setShowAllRecommendations] = useState(false);
```

- [ ] **Step 3: Pass queue state into `RecommendationPacketQueue`**

Update the `RecommendationPacketQueue` call:

```tsx
<RecommendationPacketQueue
  items={model.recommendationTargets}
  queueView={recommendationQueueView}
  showAll={showAllRecommendations}
  pendingId={pendingRecommendationId}
  selectedIds={selectedRecommendationIdSet}
  actorDisplayNames={actorDisplayNames}
  onQueueViewChange={(view) => {
    setRecommendationQueueView(view);
    setShowAllRecommendations(false);
  }}
  onToggleShowAll={() => setShowAllRecommendations((current) => !current)}
  onToggleSelection={toggleRecommendationSelection}
  onDownload={downloadRecommendationPacket}
/>
```

- [ ] **Step 4: Extend `RecommendationPacketQueue` props and derive visible items**

Add props:

```ts
queueView: EvidenceRecommendationQueueView;
showAll: boolean;
onQueueViewChange: (view: EvidenceRecommendationQueueView) => void;
onToggleShowAll: () => void;
```

Inside the component:

```ts
const counts = getEvidenceRecommendationQueueCounts(items);
const filteredItems = filterEvidenceRecommendationTargets(items, queueView);
const hiddenCount = Math.max(
  0,
  filteredItems.length - EVIDENCE_RECOMMENDATION_PREVIEW_LIMIT,
);
const visibleItems = showAll
  ? filteredItems
  : filteredItems.slice(0, EVIDENCE_RECOMMENDATION_PREVIEW_LIMIT);
```

Use `visibleItems.map(...)` instead of `items.map(...)`.

- [ ] **Step 5: Add segmented controls to the queue header**

Under the queue description:

```tsx
<div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
  <div className="inline-flex w-fit rounded-lg border border-[var(--border-soft)] bg-[var(--bg-subtle)] p-1">
    {(['active', 'resolved', 'all'] as EvidenceRecommendationQueueView[]).map(
      (view) => (
        <button
          key={view}
          type="button"
          aria-pressed={queueView === view}
          onClick={() => onQueueViewChange(view)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            queueView === view
              ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-sm'
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          {getEvidenceQueueViewLabel(view)} {counts[view]}
        </button>
      ),
    )}
  </div>
  <p className="text-xs text-[var(--text-muted)]">
    Resolved packets remain exportable from history.
  </p>
</div>
```

Add helper near page helpers:

```ts
function getEvidenceQueueViewLabel(view: EvidenceRecommendationQueueView): string {
  if (view === 'active') return 'Active';
  if (view === 'resolved') return 'Resolved';
  return 'All';
}
```

- [ ] **Step 6: Update empty-state copy**

Use `filteredItems.length` for queue emptiness:

```tsx
{filteredItems.length === 0 ? (
  <p className="p-4 text-sm text-[var(--text-muted)]">
    {queueView === 'active'
      ? 'No active recommendation packets are waiting.'
      : queueView === 'resolved'
        ? 'No resolved recommendation packets are available.'
        : 'No security recommendation packets are waiting.'}
  </p>
) : (
  ...
)}
```

- [ ] **Step 7: Add show more / show fewer footer**

After the visible queue rows:

```tsx
{filteredItems.length > EVIDENCE_RECOMMENDATION_PREVIEW_LIMIT ? (
  <div className="border-t border-[var(--border-soft)] px-4 py-3 text-center">
    <button
      type="button"
      onClick={onToggleShowAll}
      className="inline-flex items-center rounded-lg border border-[var(--border-soft)] px-3 py-2 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--bg-subtle)]"
    >
      {showAll ? 'Show fewer' : `Show ${hiddenCount} more`}
    </button>
  </div>
) : null}
```

- [ ] **Step 8: Run verification**

Run:

```powershell
pnpm --filter web test evidence-center.spec.ts
pnpm --filter web lint
```

Expected: both pass.

---

### Task 5: Final Verification

**Files:**
- No new implementation files.

- [ ] **Step 1: Run focused tests**

Run:

```powershell
pnpm --filter web test security-dashboard.spec.ts evidence-center.spec.ts
```

Expected: both specs pass.

- [ ] **Step 2: Run regression tests touched by prior audit-link work**

Run:

```powershell
pnpm --filter web test audit-filter-query.spec.ts audit.api.spec.ts
```

Expected: both specs pass.

- [ ] **Step 3: Run frontend lint**

Run:

```powershell
pnpm --filter web lint
```

Expected: exit code 0.

- [ ] **Step 4: Run frontend build**

Run:

```powershell
pnpm --filter web build
```

Expected: Next.js build completes successfully.

- [ ] **Step 5: Run diff check**

Run:

```powershell
git diff --check
```

Expected: exit code 0.

---

## Self-Review

- Spec coverage: The plan keeps audit/evidence immutable, hides resolved items by default, preserves all/history access, adds counts, and caps long lists with show-more controls.
- Placeholder scan: No placeholder tasks remain.
- Type consistency: Queue view names are consistent across Security and Evidence: `active`, `resolved`, `all`.
- Scope check: Backend deletion/archive is intentionally out of scope. Existing workflow status is sufficient for this UI lifecycle.
