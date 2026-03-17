# Phase 3A Contract Alignment Report

Date: 2026-03-17

## Scope

Frontend area reviewed: `apps/web`

Backend contract sources used:

- `services/gateway/src/proxy/*.controller.ts`
- `services/gateway/src/app.controller.ts`
- `services/metadata-service/src/documents/documents.controller.ts`
- `services/metadata-service/src/documents/documents.service.ts`
- `services/metadata-service/src/policy/policy.service.ts`
- `services/document-service/src/documents/documents.controller.ts`
- `services/document-service/src/documents/documents.service.ts`
- `services/workflow-service/src/workflow/workflow.controller.ts`
- `services/workflow-service/src/workflow/workflow.service.ts`
- `services/audit-service/src/audit/audit.controller.ts`
- `services/audit-service/src/audit/audit.service.ts`
- `scripts/e2e-check.mjs`

## Contract Alignment Matrix

| FE module / function | Current FE endpoint | Expected backend contract endpoint | Request shape | Response shape | Auth requirement | Status | Note |
|---|---|---|---|---|---|---|---|
| `login/page.tsx` JWT sign-in | `GET /me` with JWT, fallback to local JWT parse | `GET /me` | none | `CurrentUserDto` | valid bearer token | `fixed` | FE now prefers gateway `/me` and falls back to decoded token only if `/me` is unreachable or unavailable. |
| `features/documents/documents.api.getDocuments` | `GET /metadata/documents` | `GET /metadata/documents` | none | raw `Document[]`, normalized to `PaginatedResponse<DocumentSummaryDto>` | viewer/editor/approver/compliance_officer/admin | `fixed` | Backend does not support server-side filter/pagination here; FE now normalizes raw array and applies client-side filters only. |
| `features/documents/documents.api.getDocument` | `GET /metadata/documents/:docId` | `GET /metadata/documents/:docId` | none | `DocumentDetailDto` | viewer/editor/approver/compliance_officer/admin | `fixed` | FE now treats backend field names `classification`, `currentVersion`, `aclEntries`, `version`, `size`, `contentType`, `createdAt`, `createdBy` as canonical and adds compatibility aliases locally. |
| `features/documents/documents.api.createDocument` | `POST /metadata/documents` | `POST /metadata/documents` | `{ title, description?, classification?, tags? }` | `DocumentSummaryDto` normalized for UI | editor/admin | `fixed` | FE stopped sending `classificationLevel`; backend expects `classification`. |
| `features/documents/documents.api.uploadDocumentFile` | `POST /documents/:docId/upload` | `POST /documents/:docId/upload` | `multipart/form-data` with `file` | `UploadVersionResponse` | owner editor/admin | `fixed` | New document flow no longer uploads with stale empty `docId`; create + upload now uses the returned document id directly. |
| `lib/hooks/use-documents.useSubmitDocument` | `POST /workflow/:docId/submit` | `POST /workflow/:docId/submit` | none | `DocumentSummaryDto` | owner editor/admin | `fixed` | FE permission helper now matches backend owner check instead of allowing any editor. |
| `lib/hooks/use-documents.useApproveDocument` | `POST /workflow/:docId/approve` | `POST /workflow/:docId/approve` | none | `DocumentSummaryDto` | approver/admin | `match` | Hook invalidation remains aligned with list/detail/history refresh. |
| `lib/hooks/use-documents.useRejectDocument` | `POST /workflow/:docId/reject` | `POST /workflow/:docId/reject` | `{ reason? }` | `DocumentSummaryDto` | approver/admin | `fixed` | FE previously sent `{ comment }`; backend only accepts `{ reason }`. |
| `lib/hooks/use-documents.useArchiveDocument` | `POST /workflow/:docId/archive` | `POST /workflow/:docId/archive` | none | `DocumentSummaryDto` | owner editor/admin | `fixed` | Backend code differs from prompt/docs here: archive is `editor(owner)/admin`, not `approver/admin`. FE now follows backend code. |
| `features/documents/documents.api.getWorkflowHistory` | `GET /metadata/documents/:docId/workflow-history` | `GET /metadata/documents/:docId/workflow-history` | none | raw `WorkflowHistoryItemDto[]` | viewer/editor/approver/compliance_officer/admin | `fixed` | FE normalizes raw `reason` and keeps `comment` alias only for compatibility. |
| `features/documents/documents.api.getDocumentAcl` / `addAclEntry` | `GET/POST /metadata/documents/:docId/acl` | `GET/POST /metadata/documents/:docId/acl` | `{ subjectType, subjectId?, permission, effect }` | `DocumentAclEntryDto` / array | read: editor/approver/compliance_officer/admin; write: owner editor/admin | `fixed` | FE ACL enums now match backend: subject type supports `ALL`, permission supports `READ/DOWNLOAD/WRITE/APPROVE`. Detail page no longer forces a forbidden `/acl` fetch for viewers. |
| `features/audit/audit.api.queryAuditLog` | `GET /audit/query` | `GET /audit/query` | `actorId, action, resourceType, resourceId, result, from, to, limit` | raw `AuditLogItemDto[]`, normalized to `PaginatedResponse<AuditLogItemDto>` | compliance_officer only | `fixed` | FE stopped treating audit as admin-accessible to avoid backend 403 mismatch. `targetType/targetId` remain aliases mapped to canonical resource fields. |
| `features/documents/documents.api.authorizeDownload` | `POST /metadata/documents/:docId/download-authorize` | `POST /metadata/documents/:docId/download-authorize` | `{ version? }` | `{ grantToken, version, filename, expiresAt, ... }` | viewer/editor/approver/admin; compliance_officer denied | `fixed` | FE now exposes canonical `grantToken` and keeps `downloadToken` only as a compatibility alias. |
| `features/documents/documents.api.presignDownload` / stream flow | `POST /documents/:docId/presign-download`, `GET /documents/:docId/versions/:version/stream` | same | `presign-download`: `{ version? }`; `stream`: path param version | `{ url, expiresAt, ... }` / binary stream | viewer/editor/approver/admin; compliance_officer denied | `fixed` | Important mismatch: backend code does **not** accept `grantToken` in `presign-download`; it re-authorizes internally using `version`. FE download flow was updated to follow backend code instead of outdated docs. |

## Auth / Session Assumptions

- Session is persisted in `localStorage` under `docvault_session`.
- FE sends bearer token through the shared Axios interceptor.
- FE resolves current user by calling gateway `GET /me` when possible.
- If `/me` cannot be reached, FE derives user identity from JWT claims as a fallback.
- Role extraction now normalizes:
  - `realm_access.roles`
  - top-level `roles`
  - `resource_access.*.roles`
  - `co` -> `compliance_officer`
- Identity display priority:
  - `preferred_username`
  - `username`
  - `name`
  - `email`
  - `sub`
- `401` handling:
  - clear local session
  - redirect to `/login`
- `403` handling:
  - keep user in place
  - show normalized user-facing error
- Refresh token flow is still not implemented in FE.

## Error Handling Normalization

- API error parsing now supports backend error arrays like `message: ["..."]`.
- FE maps common failures to stable user-facing messages:
  - expired session
  - forbidden action
  - forbidden download on non-published document
  - compliance-officer download denial
  - not found
  - conflict
  - server/network error

## Verification Results

Completed locally:

- `apps/web`: `npx tsc --noEmit` -> pass
- `apps/web`: `npm run lint` -> pass
- `apps/web`: `npm run build` -> pass
- Build output confirmed primary routes compile:
  - `/`
  - `/login`
  - `/documents`
  - `/documents/[id]`
  - `/documents/[id]/edit`
  - `/documents/new`
  - `/dashboard`
  - `/approvals`
  - `/audit`
  - `/settings`

Blocked in current environment:

- Gateway unavailable at `http://localhost:3000`
- Keycloak unavailable at `http://localhost:8080`
- Metadata/document/workflow/audit services unavailable at `localhost:3001-3004`
- End-to-end smoke script `node scripts/e2e-check.mjs` therefore could not be executed
- Live integration verification for document list/detail/upload/submit/approve/reject/archive/audit/download remains blocked by missing running backend
- Runtime route smoke via a started Next server could not be completed from this tool because background process launch was blocked by shell policy; build-time route generation still succeeded

## Remaining Risks Before Phase 3B

- `GET /metadata/documents` still lacks backend-side filter and pagination support; FE currently compensates client-side only.
- Download flow documentation is stale versus backend code:
  - docs mention `grantToken` exchange
  - actual `document-service` currently accepts `version` and re-authorizes internally
- Archive role semantics differ between prompt/docs and `workflow-service` code.
- Gateway CORS behavior is still unclear from this FE workspace; JWT login therefore keeps a token-parse fallback when `/me` cannot be called from the browser.
- Refresh token / silent re-auth is still absent.

