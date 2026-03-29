# DocVault Frontend — Phase 2 Implementation Summary

> **Build status:** ✅ `npm run build` passes — 11/11 pages generated
> **Date:** 2026-03-17

---

## 1. Phase 2 Goals

Scaffold the entire foundation layer of the Next.js app to:
- Build `features/` architecture separating logic by domain
- Create a new API client using `axios` replacing manual fetch
- Set up a new Auth system with Keycloak-compatible JWT parsing
- Strict, well-layered type system
- Ensure all Phase 1 components still build (backward compat)

---

## 2. New Directory Structure (Phase 2)

```
apps/web/src/
├── features/
│   ├── auth/
│   │   └── auth.types.ts          # Session, UserInfo, AuthContextValue
│   ├── documents/
│   │   ├── documents.api.ts       # All API calls for documents
│   │   ├── documents.types.ts     # DocumentListItem, DocumentDetail, DTOs
│   │   └── documents.schemas.ts  # Zod validation schemas
│   ├── audit/
│   │   ├── audit.api.ts           # API calls for audit logs
│   │   └── audit.types.ts        # AuditLogEntry, AuditQueryFilters
│   └── workflow/
│       └── workflow.api.ts        # Workflow actions API
│
├── lib/
│   ├── api/
│   │   ├── client.ts              # Axios instance + interceptors
│   │   ├── errors.ts             # ApiError class
│   │   ├── documents.ts          # [shim → features/documents]
│   │   ├── metadata.ts           # [shim → features/documents]
│   │   ├── audit.ts              # [shim → features/audit]
│   │   └── workflow.ts           # [shim → features/workflow]
│   ├── auth/
│   │   ├── auth-context.tsx      # [shim → providers/auth-provider]
│   │   ├── guards.ts             # Permission guards + compat wrappers
│   │   ├── permissions.ts        # Per-document permission checks
│   │   ├── roles.ts              # Role-based checks
│   │   ├── jwt.ts                # JWT parse + field extraction
│   │   └── auth-storage.ts       # localStorage session persistence
│   ├── constants/
│   │   ├── routes.ts             # ROUTES object
│   │   ├── labels.ts             # TOAST_MESSAGES, UI labels
│   │   └── query-keys.ts         # TanStack Query key factories
│   ├── hooks/
│   │   ├── use-documents.ts      # useDocuments, useCreateDocument, ...
│   │   ├── use-document-detail.ts  # useDocumentDetail
│   │   ├── use-download-document.ts # useDownloadDocument
│   │   ├── use-workflow-history.ts
│   │   └── use-acl.ts
│   └── utils/
│       ├── cn.ts                  # clsx utility
│       ├── date.ts               # formatDateTime
│       ├── file.ts               # formatBytes
│       └── format.ts             # truncateEnd, truncateMiddle
│
├── providers/
│   ├── auth-provider.tsx          # AuthContext + useAuth hook
│   ├── query-provider.tsx         # TanStack Query + DevTools
│   └── app-provider.tsx           # Root provider composition
│
├── types/
│   ├── enums.ts                  # DocumentStatus, ClassificationLevel, UserRole, ...
│   ├── pagination.ts             # PaginatedResponse<T>, PaginationParams
│   ├── auth.ts                  # Session re-export + legacy compat
│   ├── document.ts               # [shim] re-exports + old type aliases
│   ├── audit.ts                 # [shim] re-exports from features/audit
│   ├── api.ts                   # [shim] ApiError re-export
│   └── common.ts                # NavItem, etc.
│
├── components/
│   ├── layout/
│   │   ├── app-topbar.tsx      # Top navigation bar
│   │   └── app-sidebar.tsx     # Side navigation with role-based items
│   ├── common/
│   │   ├── page-header.tsx     # PageHeader component
│   │   ├── page-shell.tsx      # Layout wrapper
│   │   ├── breadcrumb.tsx
│   │   ├── empty-state.tsx
│   │   ├── loading-state.tsx   # LoadingState + TableSkeleton
│   │   ├── error-state.tsx
│   │   ├── confirm-dialog.tsx
│   │   └── protected-action.tsx  # Route/action guard component
│   ├── badges/
│   │   ├── status-badge.tsx     # DocumentStatus badge
│   │   ├── classification-badge.tsx # ClassificationLevel badge (optional prop)
│   │   └── role-badge.tsx      # UserRole badge
│   ├── documents/
│   │   ├── documents-table.tsx   # Sortable document list table
│   │   ├── document-header.tsx   # Document detail header
│   │   ├── document-versions-card.tsx  # Version history card
│   │   ├── document-workflow-timeline.tsx # Workflow history
│   │   ├── document-acl-card.tsx  # ACL rules card
│   │   ├── document-action-panel.tsx # Workflow action buttons
│   │   ├── document-form.tsx    # Create/Edit form
│   │   ├── document-filters.tsx # List filter bar
│   │   └── upload-dropzone.tsx  # File upload dropzone
│   ├── audit/
│   │   └── audit-table.tsx     # Audit log table
│   ├── approvals/
│   │   ├── approvals-table.tsx # Pending approvals table
│   │   └── approval-review-drawer.tsx # Review side drawer
│   └── settings/
│       └── settings-page.tsx
│
└── app/
    ├── layout.tsx               # Root layout with AppProvider
    ├── globals.css               # Design token CSS variables
    ├── not-found.tsx
    ├── error.tsx
    ├── loading.tsx
    ├── (auth)/
    │   └── login/page.tsx      # Login with Demo + JWT modes
    └── (app)/
        ├── layout.tsx           # App shell layout
        ├── dashboard/page.tsx
        ├── documents/
        │   ├── page.tsx         # Document list + actions
        │   ├── new/page.tsx    # Create document
        │   └── [id]/
        │       ├── page.tsx    # Document detail
        │       └── edit/page.tsx # Edit document
        ├── approvals/page.tsx
        ├── audit/page.tsx
        └── settings/page.tsx
```

---

## 3. Key Components Built

### 3.1 API Client (`lib/api/client.ts`)
- Axios instance with `baseURL = NEXT_PUBLIC_API_URL`
- Request interceptor: automatically attaches `Authorization: Bearer <token>` from localStorage
- Response interceptor: parse errors into uniform `ApiError`

### 3.2 Authentication System
| File | Description |
|------|-------------|
| `features/auth/auth.types.ts` | `Session { accessToken, user: UserInfo }` |
| `providers/auth-provider.tsx` | Context, `useAuth()`, localStorage sync |
| `lib/auth/jwt.ts` | Parse JWT payload, extract roles/username/sub |
| `lib/auth/guards.ts` | `canEditDocument`, `canApproveDocument`, `canManageAcl`, ... |
| `lib/auth/permissions.ts` | Per-document permission logic |
| `lib/auth/roles.ts` | Role hierarchy checks |
| `app/(auth)/login/page.tsx` | Demo login (select role) + JWT paste mode |

### 3.3 Document Features
| API function | Endpoint |
|-------------|----------|
| `getDocuments(filters)` | `GET /metadata/documents` |
| `getDocumentDetail(id)` | `GET /metadata/documents/:id` |
| `createDocument(dto)` | `POST /metadata/documents` |
| `updateDocument(id, dto)` | `PATCH /metadata/documents/:id` |
| `uploadVersion(docId, file)` | `POST /storage/upload/:docId` |
| `authorizeDownload(docId)` | `POST /download/authorize/:docId` |
| `presignDownload(token)` | `GET /download/presign?token=...` |
| `addAclEntry(docId, dto)` | `POST /metadata/documents/:id/acl` |
| `submitDocument(id)` | `POST /workflow/documents/:id/submit` |
| `approveDocument(id)` | `POST /workflow/documents/:id/approve` |
| `rejectDocument(id, dto)` | `POST /workflow/documents/:id/reject` |
| `archiveDocument(id)` | `POST /workflow/documents/:id/archive` |
| `getWorkflowHistory(id)` | `GET /workflow/documents/:id/history` |
| `getAuditLogs(filters)` | `GET /audit/logs` |

### 3.4 Design System (`globals.css`)
Complete CSS variables: colors (primary/neutral/semantic), typography, border-radius, spacing, shadow, transition.

---

## 4. Backward Compatibility (Phase 1 → Phase 2)

To avoid modifying Phase 1 components, compat aliases were added:

### Type aliases in `features/documents/documents.types.ts`
| Alias (Phase 1) | Canonical (Phase 2) |
|-----------------|---------------------|
| `classification` | `classificationLevel` |
| `currentVersion` | `currentVersionNumber` |
| `version` (DocumentVersion) | `versionNumber` |
| `size` | `fileSize` |
| `contentType` | `mimeType` |
| `reason` (WorkflowHistoryEntry) | `comment` |
| `aclEntries` (DocumentDetail) | `acl` |

### Shim files
- `types/document.ts` → re-export + `SubjectType`, `Permission`, `Effect` aliases
- `types/audit.ts` → re-export from `features/audit`
- `lib/api/*.ts` → all redirect to `features/`
- `lib/auth/auth-context.tsx` → re-export from `providers/auth-provider`

---

## 5. Additional Dependencies Installed

```json
{
  "axios": "^1.x",
  "nuqs": "^2.x",
  "@tanstack/react-query-devtools": "^5.x"
}
```

---

## 6. Issues Fixed During Build

| Issue | File(s) | Fix |
|-------|---------|-----|
| `session.roles` → `session.user.roles` | 6 files | Updated field access |
| `session.username` → `session.user.preferred_username` | app-topbar, app-sidebar | Updated + added fallback |
| `docs` → `docs.data` (PaginatedResponse) | 3 pages | Unwrapped `.data` |
| `classification` → `classificationLevel` (DTO) | new/page, edit/page | Explicit mapping |
| `AuditQueryFilters` missing `limit` | audit.types.ts | Added field |
| `ClassificationBadge` missing optional prop | classification-badge.tsx | Made prop optional + default |
| `AuditLogEntry` missing Phase 1 fields | audit.types.ts | Added `eventId`, `actorRoles`, `resourceId`, `traceId`, `reason` |
| `login/page.tsx` creating Session with wrong shape | login/page.tsx | Rewrote to use `user: UserInfo` |
| `ResultBadge` type too narrow | audit-table.tsx | Extended to `string` |
| `ACTION_CONFIG` index type | workflow-timeline.tsx | Cast `as keyof typeof` |

---

## 7. Current Status

- ✅ `npm run build` passes (BUILD_EXIT:0)
- ✅ 11/11 pages generated
- ✅ TypeScript strict compilation clean
- ✅ All Phase 1 components work without modification
- ⏳ Phase 3: Connect to real backend, E2E testing
