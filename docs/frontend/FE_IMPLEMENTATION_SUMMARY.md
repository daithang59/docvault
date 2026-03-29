# DocVault — Frontend Implementation Summary

> **Tech stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS · TanStack Query · React Hook Form · Zod
> **Directory:** `apps/web/`
> **Dev server:** `npm run dev` → `http://localhost:3000`

---

## Overview

DocVault Frontend is a complete enterprise dashboard with:
- **Authentication:** Demo login by role (5 roles) + real JWT Token mode (Keycloak-compatible)
- **RBAC:** Every UI element is role-controlled — sidebar nav, action buttons, page access
- **Workflow:** States `DRAFT → PENDING → PUBLISHED → ARCHIVED` are strictly enforced
- **API Client:** Automatically attaches Bearer token, normalizes errors, supports multipart upload
- **UX:** Full loading / empty / error states for every page and component

---

## Directory Structure

```
apps/web/src/
├── types/
│   ├── document.ts          # DocumentStatus, ClassificationLevel, AclEntry, WorkflowHistory, DTOs
│   ├── audit.ts             # AuditLogEntry, AuditResult, AuditQueryFilters
│   ├── api.ts               # ApiErrorResponse, ApiError class
│   └── auth.ts              # UserRole, Session, AuthContextValue
│
├── lib/
│   ├── api/
│   │   ├── client.ts        # apiRequest(): fetch wrapper with auth header + error norm
│   │   ├── metadata.ts      # getDocuments, getDocument, createDocument, updateDocument, getWorkflowHistory, getAcl
│   │   ├── documents.ts     # uploadDocument, presignDownload
│   │   ├── workflow.ts       # submitDocument, approveDocument, rejectDocument, archiveDocument
│   │   └── audit.ts          # queryAudit()
│   ├── auth/
│   │   ├── auth-context.tsx # AuthProvider, useAuth() (isAuthenticated, login, logout, hasAnyRole)
│   │   ├── auth-storage.ts   # localStorage session persistence
│   │   ├── jwt.ts            # parseJwt, extractRoles (supports Keycloak realm_access)
│   │   └── guards.ts         # canEdit/Submit/Approve/Reject/Archive/Download + canManageAcl
│   ├── constants/
│   │   ├── routes.ts         # ROUTES.*
│   │   ├── nav.ts            # NAV_ITEMS with role visibility
│   │   ├── labels.ts         # STATUS_LABELS, CLASSIFICATION_LABELS, TOAST_MESSAGES
│   │   └── query-keys.ts     # queryKeys factory (TanStack Query)
│   ├── hooks/
│   │   ├── use-documents.ts              # useDocuments, useCreateDocument, useUpdateDocument, useUploadDocument, useSubmitDocument, useApproveDocument, useRejectDocument, useArchiveDocument
│   │   ├── use-document-detail.ts        # useDocumentDetail(id)
│   │   ├── use-workflow-history.ts       # useWorkflowHistory(id)
│   │   ├── use-acl.ts                    # useAcl(id), useAddAclEntry(docId)
│   │   ├── use-audit.ts                  # useAuditQuery(filters)
│   │   └── use-download-document.ts       # 2-step flow: authorize → presign → trigger download
│   └── utils/
│       ├── cn.ts            # clsx + tailwind-merge
│       ├── date.ts          # formatDate, formatDateTime
│       ├── file.ts          # formatBytes, isValidFileType
│       └── format.ts        # truncateEnd, truncateMiddle, titleCase
│
├── components/
│   ├── badges/
│   │   ├── status-badge.tsx         # DRAFT/PENDING/PUBLISHED/ARCHIVED with correct color palette
│   │   ├── classification-badge.tsx # PUBLIC/INTERNAL/CONFIDENTIAL/SECRET
│   │   └── role-badge.tsx           # viewer/editor/approver/compliance_officer/admin
│   ├── common/
│   │   ├── page-header.tsx      # Page title + subtitle + badge + actions slot
│   │   ├── empty-state.tsx      # Icon + title + description + CTA
│   │   ├── loading-state.tsx    # Spinner + TableSkeleton + CardSkeleton
│   │   ├── error-state.tsx      # Error icon + message + retry button
│   │   ├── confirm-dialog.tsx   # Confirmation modal with destructive variant + async onConfirm
│   │   └── protected-action.tsx  # Render children only if role/condition is met
│   ├── layout/
│   │   ├── app-sidebar.tsx  # Dark sidebar (#0F172A), role-based nav, mobile drawer
│   │   ├── app-topbar.tsx   # Page title, role badge, user dropdown, logout
│   │   └── app-shell.tsx    # Sidebar + Topbar + scrollable main content
│   ├── documents/
│   │   ├── documents-table.tsx          # TanStack Table: sort, RBAC row actions dropdown
│   │   ├── document-filters.tsx         # Search (debounce 300ms), status/classification/sort selects
│   │   ├── document-form.tsx            # RHF + Zod: title, description, classification picker, tag chips
│   │   ├── upload-dropzone.tsx          # Drag & drop + click to browse, 100MB limit, preview
│   │   ├── document-header.tsx          # Status/classification badges, metadata grid, tags
│   │   ├── document-versions-card.tsx   # Version history list with download per version
│   │   ├── document-workflow-timeline.tsx # Vertical timeline: Submit/Approve/Reject/Archive
│   │   ├── document-acl-card.tsx         # ACL entries list + inline add-rule form (editor/admin)
│   │   └── document-action-panel.tsx     # RBAC-driven action buttons + confirm dialogs + inline upload
│   ├── approvals/
│   │   ├── approvals-table.tsx          # Clickable table of PENDING docs
│   │   └── approval-review-drawer.tsx   # Side drawer: metadata + workflow history + Approve/Reject
│   ├── audit/
│   │   ├── audit-filters.tsx            # All filter params from audit API
│   │   └── audit-table.tsx              # Dense table with truncated IDs, result badges
│   └── providers.tsx        # QueryClient + AuthProvider + Sonner Toaster
│
└── app/
    ├── globals.css                   # Color tokens, scrollbar custom, focus outline
    ├── layout.tsx                    # Root layout (Inter font + Providers)
    ├── page.tsx                      # redirect → /dashboard
    ├── (auth)/login/page.tsx         # Login page (demo role picker + JWT mode)
    └── (app)/
        ├── layout.tsx                # Auth guard → AppShell
        ├── dashboard/page.tsx        # Stat cards + recent docs + quick actions
        ├── documents/
        │   ├── page.tsx              # List with filter/sort + workflow actions (submit/approve/reject/archive/download)
        │   ├── new/page.tsx          # Create form + file upload (editor/admin only)
        │   └── [id]/
        │       ├── page.tsx         # Detail: header + versions + timeline + ACL + action panel
        │       └── edit/page.tsx     # Edit metadata form (owner/admin only)
        ├── approvals/page.tsx        # PENDING queue + review drawer (approver/admin)
        └── audit/page.tsx            # Audit filter + log table (compliance_officer/admin)
```

---

## Pages and RBAC

| Page | Route | Roles with Access |
|---|---|---|
| Login | `/login` | All |
| Dashboard | `/dashboard` | All (after login) |
| Documents List | `/documents` | All |
| New Document | `/documents/new` | `editor`, `admin` |
| Document Detail | `/documents/:id` | All (download per role) |
| Edit Document | `/documents/:id/edit` | Owner or `admin` (DRAFT only) |
| Approvals | `/approvals` | `approver`, `admin` |
| Audit | `/audit` | `compliance_officer`, `admin` |

---

## Backend Integration

Configuration in `.env.local`:
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
```

Mapped endpoints:

| Feature | Endpoint |
|---|---|
| List documents | `GET /metadata/documents` |
| Create document | `POST /metadata/documents` |
| Update document | `PATCH /metadata/documents/:id` |
| Upload file | `POST /documents/:id/upload` |
| Download | `GET /documents/:id/authorize` → `GET /documents/:id/presign` |
| Submit | `POST /workflow/:id/submit` |
| Approve | `POST /workflow/:id/approve` |
| Reject | `POST /workflow/:id/reject` |
| Archive | `POST /workflow/:id/archive` |
| ACL | `GET/POST /metadata/documents/:id/acl` |
| Audit | `GET /audit/query` |

---

## Color Palette (Enterprise)

| Purpose | Color |
|---|---|
| Sidebar background | `#0F172A` |
| Primary brand button | `#2563EB` |
| App background | `#F8FAFC` |
| Card background | `#FFFFFF` |
| Text primary | `#0F172A` / `#1E293B` |
| Text muted | `#64748B` / `#94A3B8` |
| Status: DRAFT | `#F1F5F9` / `#334155` |
| Status: PENDING | `#FEF3C7` / `#92400E` |
| Status: PUBLISHED | `#DCFCE7` / `#166534` |
| Status: ARCHIVED | `#E5E7EB` / `#4B5563` |
| Classification: SECRET | `#FEE2E2` / `#B91C1C` |
| Classification: CONFIDENTIAL | `#FEF3C7` / `#92400E` |
| Classification: INTERNAL | `#DBEAFE` / `#1D4ED8` |
| Classification: PUBLIC | `#DCFCE7` / `#166534` |
