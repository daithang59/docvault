# DocVault — Frontend Implementation Summary

> **Tech stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS · TanStack Query · React Hook Form · Zod  
> **Thư mục:** `apps/web/`  
> **Dev server:** `npm run dev` → `http://localhost:3000`

---

## Tổng quan

Frontend DocVault là một enterprise dashboard hoàn chỉnh với:
- **Xác thực:** Demo login theo role (5 roles) + chế độ JWT Token thực tế (tương thích Keycloak)
- **RBAC:** Mọi UI element đều được kiểm soát theo role—sidebar nav, action buttons, page access
- **Workflow:** Các trạng thái `DRAFT → PENDING → PUBLISHED → ARCHIVED` được thực thi nghiêm ngặt
- **API Client:** Tự động đính kèm Bearer token, chuẩn hóa lỗi, hỗ trợ multipart upload
- **UX:** Đầy đủ loading / empty / error states cho mọi trang và component

---

## Cấu trúc thư mục

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
│   │   ├── client.ts        # apiRequest(): fetch wrapper với auth header + error norm
│   │   ├── metadata.ts      # getDocuments, getDocument, createDocument, updateDocument, getWorkflowHistory, getAcl
│   │   ├── documents.ts     # uploadDocument, presignDownload
│   │   ├── workflow.ts      # submitDocument, approveDocument, rejectDocument, archiveDocument
│   │   └── audit.ts         # queryAudit()
│   ├── auth/
│   │   ├── auth-context.tsx # AuthProvider, useAuth() (isAuthenticated, login, logout, hasAnyRole)
│   │   ├── auth-storage.ts  # localStorage session persistence
│   │   ├── jwt.ts           # parseJwt, extractRoles (hỗ trợ Keycloak realm_access)
│   │   └── guards.ts        # canEdit/Submit/Approve/Reject/Archive/Download + canManageAcl
│   ├── constants/
│   │   ├── routes.ts        # ROUTES.*
│   │   ├── nav.ts           # NAV_ITEMS với role visibility
│   │   ├── labels.ts        # STATUS_LABELS, CLASSIFICATION_LABELS, TOAST_MESSAGES
│   │   └── query-keys.ts    # queryKeys factory (TanStack Query)
│   ├── hooks/
│   │   ├── use-documents.ts             # useDocuments, useCreateDocument, useUpdateDocument, useUploadDocument, useSubmitDocument, useApproveDocument, useRejectDocument, useArchiveDocument
│   │   ├── use-document-detail.ts       # useDocumentDetail(id)
│   │   ├── use-workflow-history.ts      # useWorkflowHistory(id)
│   │   ├── use-acl.ts                   # useAcl(id), useAddAclEntry(docId)
│   │   ├── use-audit.ts                 # useAuditQuery(filters)
│   │   └── use-download-document.ts     # 2-step flow: authorize → presign → trigger download
│   └── utils/
│       ├── cn.ts            # clsx + tailwind-merge
│       ├── date.ts          # formatDate, formatDateTime
│       ├── file.ts          # formatBytes, isValidFileType
│       └── format.ts        # truncateEnd, truncateMiddle, titleCase
│
├── components/
│   ├── badges/
│   │   ├── status-badge.tsx         # DRAFT/PENDING/PUBLISHED/ARCHIVED với màu đúng palette
│   │   ├── classification-badge.tsx # PUBLIC/INTERNAL/CONFIDENTIAL/SECRET
│   │   └── role-badge.tsx           # viewer/editor/approver/compliance_officer/admin
│   ├── common/
│   │   ├── page-header.tsx      # Tiêu đề trang + subtitle + badge + actions slot
│   │   ├── empty-state.tsx      # Icon + title + description + CTA
│   │   ├── loading-state.tsx    # Spinner + TableSkeleton + CardSkeleton
│   │   ├── error-state.tsx      # Error icon + message + retry button
│   │   ├── confirm-dialog.tsx   # Modal xác nhận với variant destructive + async onConfirm
│   │   └── protected-action.tsx # Render children chỉ khi đủ role/condition
│   ├── layout/
│   │   ├── app-sidebar.tsx  # Dark sidebar (#0F172A), role-based nav, mobile drawer
│   │   ├── app-topbar.tsx   # Page title, role badge, user dropdown, logout
│   │   └── app-shell.tsx    # Sidebar + Topbar + scrollable main content
│   ├── documents/
│   │   ├── documents-table.tsx         # TanStack Table: sort, RBAC row actions dropdown
│   │   ├── document-filters.tsx        # Search (debounce 300ms), status/classification/sort selects
│   │   ├── document-form.tsx           # RHF + Zod: title, description, classification picker, tag chips
│   │   ├── upload-dropzone.tsx         # Drag & drop + click to browse, 100MB limit, preview
│   │   ├── document-header.tsx         # Status/classification badges, metadata grid, tags
│   │   ├── document-versions-card.tsx  # Version history list với download per version
│   │   ├── document-workflow-timeline.tsx # Vertical timeline: Submit/Approve/Reject/Archive
│   │   ├── document-acl-card.tsx       # ACL entries list + inline add-rule form (editor/admin)
│   │   └── document-action-panel.tsx   # RBAC-driven action buttons + confirm dialogs + inline upload
│   ├── approvals/
│   │   ├── approvals-table.tsx         # Clickable table of PENDING docs
│   │   └── approval-review-drawer.tsx  # Side drawer: metadata + workflow history + Approve/Reject
│   ├── audit/
│   │   ├── audit-filters.tsx           # Tất cả filter params của audit API
│   │   └── audit-table.tsx             # Dense table với truncated IDs, result badges
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
        │   ├── page.tsx              # List với filter/sort + workflow actions (submit/approve/reject/archive/download)
        │   ├── new/page.tsx          # Create form + file upload (editor/admin only)
        │   └── [id]/
        │       ├── page.tsx          # Detail: header + versions + timeline + ACL + action panel
        │       └── edit/page.tsx     # Edit metadata form (owner/admin only)
        ├── approvals/page.tsx        # PENDING queue + review drawer (approver/admin)
        └── audit/page.tsx            # Audit filter + log table (compliance_officer/admin)
```

---

## Các trang và RBAC

| Trang | Route | Roles có thể truy cập |
|---|---|---|
| Login | `/login` | Tất cả |
| Dashboard | `/dashboard` | Tất cả (sau login) |
| Documents List | `/documents` | Tất cả |
| New Document | `/documents/new` | `editor`, `admin` |
| Document Detail | `/documents/:id` | Tất cả (download theo role) |
| Edit Document | `/documents/:id/edit` | Owner hoặc `admin` (DRAFT only) |
| Approvals | `/approvals` | `approver`, `admin` |
| Audit | `/audit` | `compliance_officer`, `admin` |

---

## Kết nối Backend

Cấu hình trong `.env.local`:
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
```

Các endpoint đã được map:

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

## Palette màu (Enterprise)

| Mục đích | Màu |
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
