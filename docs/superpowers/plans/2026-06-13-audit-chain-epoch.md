# Audit Chain Epoch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add production-safe audit chain epochs so DocVault can seal a compromised chain and continue auditing in a new trusted chain without rewriting old evidence.

**Architecture:** Extend audit events with `epochId`, add epoch and incident collections, scope append/verify logic to the active epoch, and expose a guarded recovery endpoint that marks the current epoch compromised and starts a new one. The UI will show active epoch validity separately from historical compromise posture.

**Tech Stack:** NestJS, Mongoose, Jest, Next.js, React Query, TypeScript.

---

## File Structure

- Modify `services/audit-service/src/mongo/audit-event.schema.ts`: add `epochId` and scope the unique `prevHash` index by epoch.
- Create `services/audit-service/src/mongo/audit-chain-epoch.schema.ts`: persistence model for active/sealed/compromised epochs.
- Create `services/audit-service/src/mongo/audit-chain-incident.schema.ts`: persistence model for compromise incidents.
- Modify `services/audit-service/src/mongo/mongo.module.ts`: register the new schemas.
- Modify `services/audit-service/src/audit/dto/seal-audit-chain.dto.ts`: validate recovery reason.
- Modify `services/audit-service/src/audit/audit.service.ts`: active epoch creation, epoch-scoped append, epoch-aware verify, seal-and-start recovery.
- Modify `services/audit-service/src/audit/audit.controller.ts`: expose `POST /audit/chain/seal-and-start-epoch` for admin/compliance users.
- Modify `services/audit-service/src/audit/audit-hash.spec.ts`: backend red/green coverage for epoch append, verify, and recovery.
- Modify `apps/web/src/features/audit/audit.types.ts`: add epoch/incident fields to chain status.
- Modify `apps/web/src/features/audit/audit.api.ts`: add recovery API client.
- Modify `apps/web/src/app/(app)/audit/page.tsx`: show current epoch and historical compromise state, add a guarded recovery action for invalid chains.

## Tasks

### Task 1: Backend Epoch Persistence

**Files:**
- Modify: `services/audit-service/src/mongo/audit-event.schema.ts`
- Create: `services/audit-service/src/mongo/audit-chain-epoch.schema.ts`
- Create: `services/audit-service/src/mongo/audit-chain-incident.schema.ts`
- Modify: `services/audit-service/src/mongo/mongo.module.ts`
- Test: `services/audit-service/src/audit/audit-hash.spec.ts`

- [ ] **Step 1: Write failing tests**

Add tests asserting that new audit events receive `epochId: 'default'` when no epoch collection is injected, and that the previous head lookup is scoped by active epoch.

- [ ] **Step 2: Run test to verify RED**

Run: `pnpm --filter audit-service test -- audit-hash.spec.ts --runInBand`

Expected: fail because `epochId` is not persisted and `findOne` is not scoped by epoch.

- [ ] **Step 3: Implement schema and append changes**

Add `epochId` to event records, add the epoch/incident schemas, register them, and make `create()` append to the active epoch or `default` fallback.

- [ ] **Step 4: Run test to verify GREEN**

Run: `pnpm --filter audit-service test -- audit-hash.spec.ts --runInBand`

Expected: pass for existing hash tests and new epoch append tests.

### Task 2: Epoch-Aware Verification

**Files:**
- Modify: `services/audit-service/src/audit/audit.service.ts`
- Test: `services/audit-service/src/audit/audit-hash.spec.ts`

- [ ] **Step 1: Write failing tests**

Add tests for a compromised historical epoch plus valid active epoch. `verifyChain()` should report `valid: true`, active epoch details, and historical compromised epoch details.

- [ ] **Step 2: Run test to verify RED**

Run: `pnpm --filter audit-service test -- audit-hash.spec.ts --runInBand`

Expected: fail because current verification only knows one chain.

- [ ] **Step 3: Implement epoch verification**

Add helpers to verify one epoch in timestamp order and aggregate active/historical posture. Preserve existing response fields so current consumers keep working.

- [ ] **Step 4: Run test to verify GREEN**

Run: `pnpm --filter audit-service test -- audit-hash.spec.ts --runInBand`

Expected: pass.

### Task 3: Seal And Start New Epoch

**Files:**
- Create: `services/audit-service/src/audit/dto/seal-audit-chain.dto.ts`
- Modify: `services/audit-service/src/audit/audit.service.ts`
- Modify: `services/audit-service/src/audit/audit.controller.ts`
- Test: `services/audit-service/src/audit/audit-hash.spec.ts`

- [ ] **Step 1: Write failing tests**

Add a test where verification is invalid, `sealCompromisedChainAndStartEpoch()` creates an incident, marks the old epoch `COMPROMISED`, creates a new `ACTIVE` epoch, and appends `AUDIT_CHAIN_EPOCH_STARTED`.

- [ ] **Step 2: Run test to verify RED**

Run: `pnpm --filter audit-service test -- audit-hash.spec.ts --runInBand`

Expected: fail because the method and DTO do not exist.

- [ ] **Step 3: Implement recovery method and endpoint**

Add DTO validation, service method, and controller route with admin/compliance auth. Reject the action when the active chain is already valid.

- [ ] **Step 4: Run test to verify GREEN**

Run: `pnpm --filter audit-service test -- audit-hash.spec.ts --runInBand`

Expected: pass.

### Task 4: Frontend Posture Display

**Files:**
- Modify: `apps/web/src/features/audit/audit.types.ts`
- Modify: `apps/web/src/features/audit/audit.api.ts`
- Modify: `apps/web/src/app/(app)/audit/page.tsx`
- Test: existing web lint/type/test commands if available.

- [ ] **Step 1: Write failing frontend test if a nearby component test exists**

If no route test harness exists for `audit/page.tsx`, keep frontend changes type-safe and verify with lint/build.

- [ ] **Step 2: Implement UI**

Show active epoch status, historical compromised count, incident id, and a guarded "Seal and Start New Epoch" action only when chain verification is invalid.

- [ ] **Step 3: Verify frontend**

Run: `pnpm --filter web lint`

Expected: no lint errors from changed files.

### Task 5: Final Verification

**Files:**
- All changed files.

- [ ] **Step 1: Run targeted backend tests**

Run: `pnpm --filter audit-service test -- audit-hash.spec.ts --runInBand`

Expected: pass.

- [ ] **Step 2: Run audit-service build**

Run: `pnpm --filter audit-service build`

Expected: TypeScript build succeeds.

- [ ] **Step 3: Run web verification**

Run: `pnpm --filter web lint`

Expected: no lint errors from changed files.

- [ ] **Step 4: Review diff**

Run: `git diff -- services/audit-service/src apps/web/src docs/superpowers`

Expected: diff only contains audit epoch implementation, docs/spec/plan, and no unrelated rewrites.
