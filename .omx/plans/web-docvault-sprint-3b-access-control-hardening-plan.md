# Web DocVault Sprint 3B Access Control Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make DocVault authorization more consistent across RBAC, ACL, status, classification, and GROUP ACL evidence for the Web App scope.

**Architecture:** Keep `PolicyService` as the runtime authorization source for document metadata, preview, and download checks. Add canonical user group extraction from Keycloak JWTs and gateway forwarded headers, then evaluate `AclSubjectType.GROUP` alongside USER/ROLE/ALL in metadata, preview, download, and list visibility. Avoid DevSecOps/pipeline changes.

**Tech Stack:** NestJS, Prisma, Keycloak JWT claims, Next.js App Router, OpenAPI YAML, root E2E script.

---

## Requirements Summary

- Support real `GROUP` ACL evaluation instead of leaving it as schema-only.
- Parse Keycloak `groups` claim into `req.user.groups`.
- Forward groups through the gateway with `x-groups` for downstream context.
- Include groups in metadata-service `RequestContext`.
- Use group ACL in:
  - document detail / metadata policy;
  - workflow history/comment/ACL list through `assertCanReadMetadata`;
  - preview authorization;
  - download authorization;
  - document list visibility.
- Re-enable `GROUP` as a frontend ACL subject type because it is now enforced.
- Update OpenAPI/docs/E2E evidence for group ACL.

## Acceptance Criteria

- Unit tests prove:
  - GROUP `READ` allow lets a matching user read confidential metadata;
  - GROUP `DOWNLOAD` allow lets a matching editor download a confidential/secret document when classification role requirements are also met;
  - GROUP `READ` deny blocks metadata read even if role would otherwise allow;
  - document list query includes matching GROUP ACL allow entries and excludes DENY-only group entries.
- `pnpm --filter metadata-service test` passes.
- `pnpm --filter metadata-service build` passes.
- `pnpm --filter gateway build` passes.
- `pnpm --filter web build` passes.
- `pnpm test:e2e` still passes and includes group ACL evidence where possible.
- No DevSecOps/pipeline files are modified.

## Implementation Tasks

### Task 1: Add Failing Policy Tests for GROUP ACL

**Files:**
- Modify: `services/metadata-service/src/policy/policy.service.spec.ts`
- Modify: `services/metadata-service/src/documents/documents.service.spec.ts`

- [x] Add a failing test that calls `assertCanReadMetadata()` with `user.groups = ['finance-team']` and a confidential document ACL `{ subjectType: 'GROUP', subjectId: 'finance-team', permission: 'READ', effect: 'ALLOW' }`; expect success.
- [x] Add a failing test that calls `assertCanReadMetadata()` with `user.groups = ['blocked-team']` and an internal document ACL `{ subjectType: 'GROUP', subjectId: 'blocked-team', permission: 'READ', effect: 'DENY' }`; expect `ForbiddenException`.
- [x] Add a failing test that calls `authorizeDownload()` with an editor in group `finance-team` and confidential document ACL `{ subjectType: 'GROUP', subjectId: 'finance-team', permission: 'DOWNLOAD', effect: 'ALLOW' }`; expect a grant token.
- [x] Add a failing test for `DocumentsService.findAll()` proving the Prisma query includes GROUP READ ALLOW subjects from `context.groups` and does not treat DENY-only ACL as a visibility grant.
- [x] Run targeted Jest; expected failure: GROUP entries are ignored or list query lacks group filtering.

### Task 2: Parse and Propagate User Groups

**Files:**
- Modify: `services/metadata-service/src/common/request-context.ts`
- Modify: `services/metadata-service/src/auth/jwt.strategy.ts`
- Modify: `services/gateway/src/auth/jwt.strategy.ts`
- Modify: `services/gateway/src/proxy/proxy.service.ts`
- Modify: `libs/auth/src/types.ts`
- Modify: `libs/auth/src/jwt.strategy.ts`

- [x] Extend `ServiceUser` and `RequestContext` with `groups: string[]`.
- [x] Normalize groups from Keycloak `groups` claim by removing a leading slash, e.g. `/finance-team` becomes `finance-team`.
- [x] Parse `x-groups` in `buildRequestContext()`.
- [x] Forward `x-groups` from gateway to metadata-service.
- [x] Keep behavior backward-compatible when no groups claim exists.

### Task 3: Implement GROUP ACL Evaluation

**Files:**
- Modify: `services/metadata-service/src/policy/policy.service.ts`
- Modify: `services/metadata-service/src/documents/documents.service.ts`

- [x] Update `matchesPreviewAcl()` and `matchesAcl()` to accept `groups` and match `AclSubjectType.GROUP`.
- [x] Use groups in `assertCanReadMetadata()`, `authorizePreview()`, and `authorizeDownload()`.
- [x] Update audit metadata for deny/success events to include groups for evidence.
- [x] Tighten `DocumentsService.findAll()` ACL visibility to match explicit `ALLOW` entries by subject type and permission `READ`, including groups.
- [x] Preserve admin, owner, compliance, approver, and public/internal baseline visibility behavior.

### Task 4: Restore GROUP in Web ACL UI and Session Types

**Files:**
- Modify: `apps/web/src/components/documents/document-acl-card.tsx`
- Modify: `apps/web/src/features/auth/auth.types.ts`
- Modify: `apps/web/src/lib/auth/token.ts`

- [x] Add `GROUP` to the ACL form subject type options.
- [x] Update placeholder text to say group names should match Keycloak group claims.
- [x] Add optional `groups` to frontend session/user types.
- [x] Extract `groups` from JWT payload for local session evidence.

### Task 5: Update Contracts, Seed Realm, and Evidence Docs

**Files:**
- Modify: `libs/contracts/openapi/gateway.yaml`
- Modify: `docs/API_CONTRACT.md`
- Modify: `docs/web-security-evidence.md`
- Modify: `docs/demo-flow.md`
- Modify: `infra/keycloak/realm-docvault.json`
- Modify: `scripts/e2e-check.mjs`

- [x] Document that `GROUP` ACL subject IDs match normalized Keycloak group names.
- [x] Add demo group `finance-team` to Keycloak realm and assign it to `editor1` for fresh local stacks.
- [x] Extend E2E with a group ACL API check if the current token exposes groups; otherwise log a clear skipped evidence note and rely on unit tests for group claim behavior.
- [x] Update demo docs to include group ACL evidence.

### Task 6: Verification

**Files:**
- No code files unless a verification issue is found.

- [x] Run `pnpm --filter metadata-service test`.
- [x] Run `pnpm --filter metadata-service build`.
- [x] Run `pnpm --filter gateway build`.
- [x] Run `pnpm --filter web build`.
- [x] Run `pnpm --filter web lint`.
- [x] Run `pnpm test:e2e`.
- [x] Run `git diff --check`.

## Risks and Mitigations

- **Risk:** Current local Keycloak data may not include groups until realm is reimported.
  - **Mitigation:** Unit tests cover group claim behavior; E2E logs group evidence only when token includes the claim.
- **Risk:** Group ACL could accidentally bypass classification rules.
  - **Mitigation:** Keep existing classification checks; GROUP allow only satisfies the explicit ACL requirement, not role/classification baseline.
- **Risk:** List visibility could overexpose documents from DENY ACL entries.
  - **Mitigation:** Filter list ACL visibility to `effect = ALLOW` and `permission = READ`.
- **Risk:** Shared auth lib may be partially adopted.
  - **Mitigation:** Update both service-local auth code and `libs/auth` to keep future reuse consistent.

## Stop Condition

Stop when GROUP ACL is implemented and tested across metadata/detail/download/list policy, frontend can create GROUP rules, contracts/docs describe the behavior, and the local build/test/E2E suite passes.
