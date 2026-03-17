# DocVault — Verification Report

## Overview

Verification performed on: 2026-03-17  
Phase: FE-BE Integration Verification (After Phase 3B)

---

## A. Code Analysis Verification (Static)

All flows verified through code-level analysis (reading gateway controllers, services, FE hooks):

| Flow | Method | Result |
|------|--------|--------|
| Auth/Session | localStorage + axios interceptor 401 → redirect /login | ✅ Verified via code |
| Login (Demo mode) | Client-side mock session | ✅ Verified via code |
| Login (JWT token) | Decode JWT, extract roles/sub, store session | ✅ Verified via code |
| Logout | Clear localStorage session, redirect /login | ✅ Verified via code |
| Document list | GET /api/metadata/documents | ✅ Verified via code |
| Document detail | GET /api/metadata/documents/:id | ✅ Verified via code |
| Create document | POST /api/metadata/documents | ✅ Verified via code |
| Upload file | POST /api/documents/:docId/upload | ✅ Verified via code |
| Submit document | POST /api/workflow/:docId/submit | ✅ Verified via code |
| Approve document | POST /api/workflow/:docId/approve | ✅ Verified via code |
| Reject document | POST /api/workflow/:docId/reject | ✅ Verified via code |
| Archive document | POST /api/workflow/:docId/archive | ✅ Verified via code |
| Download (authorize) | POST /api/metadata/documents/:docId/download-authorize | ✅ Verified via code |
| Download (presign) | POST /api/documents/:docId/presign-download | ✅ Verified via code |
| Workflow history | GET /api/metadata/documents/:docId/workflow-history | ✅ Endpoint added (was missing) |
| ACL list | GET /api/metadata/documents/:docId/acl | ✅ Verified via code |
| Audit query | GET /api/audit/query | ✅ Verified via code |
| Compliance block download | metadata-service getDeniedReason check | ✅ Verified via code |

---

## B. Bugs Found and Fixed

### Bug 1 — Gateway Archive Role Mismatch (CRITICAL)

**Symptom:** Editor could not archive own published documents.

**Root cause:** `workflow.proxy.controller.ts:64` had `@Roles('approver', 'admin')` for the archive endpoint, but `workflow.service.ts:168` checks for `editor` (owner) or `admin`.

**Fix:** Changed gateway `@Roles('approver', 'admin')` → `@Roles('editor', 'admin')` to match workflow-service business logic.

**File:** `services/gateway/src/proxy/workflow.proxy.controller.ts`

---

### Bug 2 — Gateway Missing workflow-history Endpoint (CRITICAL)

**Symptom:** Document detail page and approval drawer could not load workflow history (HTTP 404).

**Root cause:** `metadata.proxy.controller.ts` did not expose `GET /metadata/documents/:docId/workflow-history`, even though metadata-service has this endpoint (`GET /documents/:docId/workflow-history`).

**Fix:** Added `GET documents/:docId/workflow-history` endpoint to `MetadataProxyController`.

**File:** `services/gateway/src/proxy/metadata.proxy.controller.ts`

---

### Bug 3 — (Phase 3B) Approvals invalidation missing (LOW)

**Symptom:** After submit/approve/reject/archive, approvals list would not auto-refresh.

**Root cause:** `use-documents.ts` mutations only invalidated document queries, not the `approvals` query key.

**Fix:** Added `qc.invalidateQueries({ queryKey: queryKeys.approvals })` to all 4 workflow mutations.

**File:** `apps/web/src/lib/hooks/use-documents.ts`

---

## C. Flows NOT Verified via Runtime Browser

These flows were verified via code analysis only. Runtime browser verification was not possible because the backend services were not running during this verification session.

| Flow | Reason not verified live |
|------|--------------------------|
| Login with real JWT | Keycloak not running |
| Real document creation | Gateway not running |
| File upload to MinIO | MinIO/document-service not running |
| Approve/reject in browser | Services not running |
| Download in browser | Gateway/MinIO not running |
| Audit table data | audit-service not running |
| 401 redirect in browser | Cannot test without real token expiry |

**Alternative verification available:** `node scripts/e2e-check.mjs` (requires services running) covers all main flows with real API calls.

---

## D. UI/UX Verification (Code-based)

| Feature | Status |
|---------|--------|
| Role-based sidebar nav | ✅ Verified: `NAV_ITEMS.filter(item.roles.includes(userRole))` |
| Action button visibility based on role+status | ✅ `canSubmitDocument`, `canApproveDocument`, etc. guards |
| Forbidden state for approvals (wrong role) | ✅ `canViewApprovals` guard + `ForbiddenState` component |
| Forbidden state for audit (wrong role) | ✅ `canViewAudit` guard |
| 403 error message | ✅ `getUserFriendlyErrorMessage` in `errors.ts` |
| 409 conflict messages (business-specific) | ✅ `CONFLICT_SUBMIT`, `CONFLICT_APPROVE`, etc. |
| Loading states | ✅ All pages have loading skeleton |
| Empty states | ✅ All tables have empty state |
| Error states | ✅ All pages have error state component |
| Toast notifications | ✅ `sonner` toast on all mutations |
| Confirm dialogs | ✅ `ConfirmDialog` for destructive actions |
| Logout | ✅ Topbar dropdown with Sign out |

---

## E. Build & Lint Results

```
npm run build → Exit code: 0 ✅
npm run lint  → Exit code: 0 (4 warnings, 0 errors) ✅
```

---

## F. Remaining Risks

| Risk | Severity | Notes |
|------|----------|-------|
| No refresh token handling | Medium | Session expires → 401 → redirect login. User must login again. Acceptable for MVP. |
| ACL editing UI is read-only | Medium | Can view ACLs but no in-app editor. Admin must use API directly. |
| Client-side pagination/filter | Low | For large datasets, could be slow. Server-side pagination not implemented. |
| ownerDisplay field dependency | Low | `document-header.tsx` shows `ownerDisplay` if backend returns it, else falls back to ownerId slice. |
| Upload progress bar absent | Low | Only show loading spinner, no % progress. |
| Notification service MVP | Low | Logs notifications to console only, no email/webhook delivery. |
| Archive by editor in FE | Medium | After fixing gateway, editor can archive own published docs. This is the intended design per workflow-service code. |
