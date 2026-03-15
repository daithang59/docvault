# Prompt cực chi tiết cho AI Agent — Code toàn bộ FE Next.js cho DocVault

Bạn là senior frontend engineer. Hãy xây dựng **toàn bộ frontend Next.js** cho dự án **DocVault** theo đúng context nghiệp vụ, API contract, RBAC và visual system dưới đây. Mục tiêu là tạo ra một FE **đẹp, nhất quán, có thể demo được ngay, typed rõ ràng, dễ mở rộng**, và bám sát backend hiện tại.

---

## 0) Nguyên tắc làm việc bắt buộc

- Không tự ý thay đổi domain model cốt lõi.
- Không thêm workflow state `APPROVED`.
- Phải bám đúng state hiện tại:
  - `DRAFT`
  - `PENDING`
  - `PUBLISHED`
  - `ARCHIVED`
- RBAC trên UI phải phản ánh đúng backend.
- Mọi màn phải có loading, empty, error state.
- Code phải dùng TypeScript nghiêm ngặt.
- Tổ chức code sạch, tách component/service/type rõ ràng.
- Ưu tiên trải nghiệm demo MVP tốt, hiện đại, nhất quán hơn là nhồi nhiều tính năng phụ.
- Không dùng mock visual quá flashy; ưu tiên enterprise dashboard style.
- Không hardcode business text rải rác lung tung; tạo constants/helpers nơi hợp lý.

---

## 1) Product context

DocVault là hệ thống quản lý tài liệu bảo mật theo mô hình microservices.
Frontend phải thể hiện được các đặc tính sau:

- Secure
- Professional
- Trustworthy
- Structured
- Easy to scan
- Role-aware

Đây **không** phải file sharing app kiểu consumer. Đây là hệ thống quản lý tài liệu nội bộ / kiểm soát tài liệu bảo mật.

UI phải làm người dùng cảm thấy:
- dữ liệu quan trọng
- trạng thái nghiệp vụ rõ ràng
- thao tác chính nhanh
- phân quyền nghiêm túc

---

## 2) Tech stack bắt buộc

Hãy dùng các công nghệ sau:

- **Next.js 15+** với **App Router**
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui**
- **Lucide React**
- **TanStack Query** cho data fetching / mutation
- **TanStack Table** cho bảng dữ liệu
- **React Hook Form**
- **Zod** cho validation/schema
- **clsx** hoặc `cn` helper
- Có thể dùng `date-fns` cho format ngày giờ

Không dùng Redux nếu không cần.
Không dùng CSS module nếu Tailwind + shadcn đã đủ.

---

## 3) Kết quả đầu ra mong muốn

Hãy tạo một FE hoàn chỉnh gồm:

1. App shell đầy đủ
2. Login page
3. Dashboard page
4. Documents list page
5. Create new document page
6. Document detail page
7. Edit document page
8. Approvals page
9. Audit page
10. Reusable design system components
11. Typed API client layer
12. Query hooks + mutation hooks
13. Route guards cơ bản theo role
14. Mockable auth/session layer
15. Download flow 2 bước đúng contract
16. Status/classification/role badges
17. Upload UI đẹp và rõ ràng
18. Workflow timeline UI
19. ACL summary / ACL editor UI cơ bản
20. Toast/feedback UX cho action thành công/thất bại

---

## 4) Base URL và auth

### API base
Base URL gateway:

```ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api';
```

### Authorization
Tất cả request đến backend phải gửi:

```http
Authorization: Bearer <jwt>
```

### FE auth strategy cho MVP
Triển khai auth layer theo hướng **mockable nhưng có cấu trúc thực tế**:

- Tạo `AuthProvider` / `SessionProvider`
- Lưu session trong memory + `localStorage` cho demo
- Session shape gồm:
  - `accessToken`
  - `userId`
  - `username`
  - `roles: string[]`
- Có helper:
  - `hasRole(role)`
  - `hasAnyRole(roles)`
  - `isViewer`
  - `isEditor`
  - `isApprover`
  - `isComplianceOfficer`
  - `isAdmin`

### Login page cho MVP
Tạo login page có 2 mode:

1. **Demo login mode**
   - chọn role nhanh từ dropdown/pills
   - điền fake token tùy chọn
   - enter app để demo UI

2. **Real token mode**
   - form nhập JWT thủ công
   - parse payload JWT an toàn ở FE nếu có thể
   - trích roles nếu có structure đọc được
   - nếu không parse được thì cho user chọn role demo fallback

Không cần tích hợp Keycloak full ở bước này, nhưng structure phải dễ thay thế bằng real auth sau này.

---

## 5) Workflow nghiệp vụ phải phản ánh chính xác

### Document status
- `DRAFT`
- `PENDING`
- `PUBLISHED`
- `ARCHIVED`

### Transitions
- `DRAFT -> PENDING` qua submit
- `PENDING -> PUBLISHED` qua approve
- `PENDING -> DRAFT` qua reject
- `PUBLISHED -> ARCHIVED` qua archive

### Cấm
- Không thêm `APPROVED`
- Không hiển thị step ảo không tồn tại ở backend

---

## 6) RBAC trên UI phải đúng

### viewer
Được:
- xem dashboard
- xem documents list
- xem document detail
- tải file khi backend cho phép và document đã published

Không được:
- tạo document
- edit metadata
- submit
- approve/reject
- audit
- ACL management

### editor
Được:
- tạo document
- upload file
- sửa metadata khi là owner hoặc admin
- submit document
- xem detail
- quản lý ACL cơ bản nếu được phép

### approver
Được:
- xem documents
- xem approvals queue
- approve
- reject
- archive published document

### compliance_officer
Được:
- xem documents
- xem document detail metadata
- xem audit logs

Không được:
- không có nút download
- không được thấy download action ở bất kỳ đâu

### admin
- có full quyền cho MVP

### Ghi chú bắt buộc
- UI phải ẩn action không phù hợp role
- Nhưng đồng thời vẫn phải xử lý 403 từ backend nếu lỡ action bị gọi
- Compliance Officer **tuyệt đối không có download button**

---

## 7) API contract cần bám đúng

### Metadata
- `GET /metadata/documents`
- `GET /metadata/documents/:docId`
- `POST /metadata/documents`
- `PATCH /metadata/documents/:docId`
- `GET /metadata/documents/:docId/workflow-history`
- `GET /metadata/documents/:docId/acl`
- `POST /metadata/documents/:docId/acl`
- `POST /metadata/documents/:docId/download-authorize`

### Blob / document
- `POST /documents/:docId/upload`
- `POST /documents/:docId/presign-download`
- `GET /documents/:docId/versions/:version/stream`

### Workflow
- `POST /workflow/:docId/submit`
- `POST /workflow/:docId/approve`
- `POST /workflow/:docId/reject`
- `POST /workflow/:docId/archive`

### Audit
- `GET /audit/query`

### Lưu ý quan trọng
`POST /workflow/:docId/archive` hiện backend note rằng gateway proxy có thể chưa add xong. FE vẫn phải:
- triển khai UI archive đầy đủ
- xử lý nếu endpoint fail/404 bằng error toast rõ ràng
- không bỏ feature chỉ vì gateway chưa hoàn tất

---

## 8) DTO types phải tự định nghĩa rõ ràng

Hãy tạo file type riêng, ví dụ:

- `src/types/document.ts`
- `src/types/audit.ts`
- `src/types/api.ts`
- `src/types/auth.ts`

### Enums / unions

```ts
export type DocumentStatus = 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'ARCHIVED';
export type ClassificationLevel = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'SECRET';
export type SubjectType = 'USER' | 'ROLE' | 'GROUP' | 'ALL';
export type Permission = 'READ' | 'DOWNLOAD' | 'WRITE' | 'APPROVE';
export type Effect = 'ALLOW' | 'DENY';
export type WorkflowAction = 'SUBMIT' | 'APPROVE' | 'REJECT' | 'ARCHIVE';
export type AuditResult = 'SUCCESS' | 'DENY';
export type UserRole = 'viewer' | 'editor' | 'approver' | 'compliance_officer' | 'admin';
```

### List item DTO

```ts
export interface DocumentListItem {
  id: string;
  title: string;
  description: string | null;
  ownerId: string;
  classification: ClassificationLevel;
  tags: string[];
  status: DocumentStatus;
  currentVersion: number;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### Detail DTO

```ts
export interface DocumentVersion {
  id: string;
  docId: string;
  version: number;
  objectKey: string;
  checksum: string;
  size: number;
  filename: string;
  contentType: string | null;
  createdAt: string;
  createdBy: string;
}

export interface AclEntry {
  id: string;
  docId: string;
  subjectType: SubjectType;
  subjectId: string | null;
  permission: Permission;
  effect: Effect;
  createdAt: string;
}

export interface DocumentDetail extends DocumentListItem {
  versions: DocumentVersion[];
  aclEntries: AclEntry[];
}
```

### Workflow history DTO

```ts
export interface WorkflowHistoryEntry {
  id: string;
  docId: string;
  fromStatus: 'DRAFT' | 'PENDING' | 'PUBLISHED';
  toStatus: 'PENDING' | 'PUBLISHED' | 'ARCHIVED' | 'DRAFT';
  action: WorkflowAction;
  actorId: string;
  reason: string | null;
  createdAt: string;
}
```

### Download authorize DTO

```ts
export interface DownloadAuthorizeRequest {
  version?: number;
}

export interface DownloadAuthorizeResponse {
  docId: string;
  version: number;
  objectKey: string;
  filename: string;
  contentType: string | null;
  expiresInSeconds: number;
  expiresAt: string;
  grantToken: string;
}
```

### Presign DTO

```ts
export interface PresignDownloadRequest {
  grantToken: string;
  version?: number;
}

export interface PresignDownloadResponse {
  url: string;
  expiresAt: string;
}
```

### Upload response DTO

```ts
export interface UploadDocumentResponse {
  docId: string;
  version: number;
  filename: string;
  size: number;
  checksum: string;
  objectKey: string;
  contentType: string;
}
```

### Audit DTO

```ts
export interface AuditLogEntry {
  eventId: string;
  timestamp: string;
  actorId: string;
  actorRoles: string[];
  action: string;
  resourceType: string;
  resourceId: string;
  result: AuditResult;
  reason: string | null;
  ip: string | null;
  traceId: string | null;
  prevHash: string | null;
  hash: string;
}
```

### Standard API error

```ts
export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  error?: string;
}
```

---

## 9) Thư mục dự án mong muốn

Hãy tổ chức source rõ ràng theo dạng này hoặc tương đương:

```txt
src/
  app/
    (auth)/login/page.tsx
    (app)/layout.tsx
    (app)/dashboard/page.tsx
    (app)/documents/page.tsx
    (app)/documents/new/page.tsx
    (app)/documents/[id]/page.tsx
    (app)/documents/[id]/edit/page.tsx
    (app)/approvals/page.tsx
    (app)/audit/page.tsx
    globals.css

  components/
    layout/
      app-sidebar.tsx
      app-topbar.tsx
      app-shell.tsx
    documents/
      documents-table.tsx
      document-filters.tsx
      document-form.tsx
      document-header.tsx
      document-versions-card.tsx
      document-workflow-timeline.tsx
      document-acl-card.tsx
      document-action-panel.tsx
      upload-dropzone.tsx
    approvals/
      approvals-table.tsx
      approval-review-drawer.tsx
    audit/
      audit-filters.tsx
      audit-table.tsx
    dashboard/
      stat-card.tsx
      recent-documents-card.tsx
      recent-activity-card.tsx
      quick-actions-card.tsx
    common/
      page-header.tsx
      empty-state.tsx
      loading-state.tsx
      error-state.tsx
      confirm-dialog.tsx
      protected-action.tsx
    badges/
      status-badge.tsx
      classification-badge.tsx
      role-badge.tsx

  lib/
    api/
      client.ts
      metadata.ts
      documents.ts
      workflow.ts
      audit.ts
    auth/
      auth-context.tsx
      auth-storage.ts
      jwt.ts
      guards.ts
    hooks/
      use-documents.ts
      use-document-detail.ts
      use-workflow-history.ts
      use-acl.ts
      use-audit.ts
      use-download-document.ts
    utils/
      cn.ts
      date.ts
      file.ts
      format.ts
      permissions.ts
      document.ts
    constants/
      routes.ts
      nav.ts
      colors.ts
      labels.ts
      query-keys.ts

  types/
    document.ts
    audit.ts
    api.ts
    auth.ts
```

---

## 10) Visual direction bắt buộc

### Tone
- modern enterprise dashboard
- calm
- clean
- structured
- secure feeling

### Layout
- sidebar trái tối
- topbar sáng
- content nền sáng
- card trắng
- border mềm
- shadow nhẹ

### Typography
- dùng `Inter`
- heading rõ ràng
- text dễ đọc

### Style rules
- bo góc vừa phải (`xl` hoặc `2xl`)
- khoảng trắng rộng vừa phải
- tránh gradient nặng
- tránh màu neon
- tránh glassmorphism
- ưu tiên readability hơn hiệu ứng

---

## 11) Bảng màu bắt buộc phải bám theo

Sử dụng palette sau làm source of truth.

### Brand
- `brand-950: #0B1220`
- `brand-900: #111827`
- `brand-800: #1E293B`
- `brand-700: #334155`
- `brand-600: #475569`
- `brand-500: #2563EB`
- `brand-400: #60A5FA`
- `brand-300: #93C5FD`

### Neutral
- `bg-app: #F8FAFC`
- `bg-subtle: #F1F5F9`
- `bg-card: #FFFFFF`
- `bg-muted: #EEF2F7`
- `border-soft: #E2E8F0`
- `border-strong: #CBD5E1`
- `text-strong: #0F172A`
- `text-main: #1E293B`
- `text-muted: #64748B`
- `text-faint: #94A3B8`

### Status colors
#### DRAFT
- bg `#F1F5F9`
- text `#334155`
- border `#CBD5E1`

#### PENDING
- bg `#FEF3C7`
- text `#92400E`
- border `#FCD34D`

#### PUBLISHED
- bg `#DCFCE7`
- text `#166534`
- border `#86EFAC`

#### ARCHIVED
- bg `#E5E7EB`
- text `#4B5563`
- border `#D1D5DB`

### Classification colors
#### PUBLIC
- bg `#EFF6FF`
- text `#1D4ED8`
- border `#BFDBFE`

#### INTERNAL
- bg `#E0F2FE`
- text `#0369A1`
- border `#7DD3FC`

#### CONFIDENTIAL
- bg `#FFF7ED`
- text `#C2410C`
- border `#FDBA74`

#### SECRET
- bg `#FEF2F2`
- text `#B91C1C`
- border `#FCA5A5`

### Role badge colors
#### viewer
- bg `#F8FAFC`
- text `#475569`

#### editor
- bg `#EFF6FF`
- text `#1D4ED8`

#### approver
- bg `#F5F3FF`
- text `#6D28D9`

#### compliance_officer
- bg `#FFF1F2`
- text `#BE123C`

#### admin
- bg `#E2E8F0`
- text `#0F172A`

### Buttons
#### Primary
- bg `#2563EB`
- hover `#1D4ED8`
- text `#FFFFFF`

#### Secondary
- bg `#FFFFFF`
- border `#CBD5E1`
- text `#1E293B`
- hover bg `#F8FAFC`

#### Ghost
- bg transparent
- text `#334155`
- hover bg `#F1F5F9`

#### Destructive
- bg `#DC2626`
- hover `#B91C1C`
- text `#FFFFFF`

### Sidebar
- bg `#0F172A`
- text `#CBD5E1`
- muted `#94A3B8`
- active bg `#1E293B`
- active text `#FFFFFF`
- accent `#60A5FA`

### Yêu cầu implementation
- đưa các màu này vào `globals.css` hoặc theme tokens
- tạo reusable mapping helpers cho badge/button/status/classification
- không hardcode màu lặp đi lặp lại khắp project

---

## 12) Điều hướng và sitemap

Tạo các route sau:

- `/login`
- `/dashboard`
- `/documents`
- `/documents/new`
- `/documents/[id]`
- `/documents/[id]/edit`
- `/approvals`
- `/audit`

### Sidebar visibility theo role

#### viewer
- Dashboard
- Documents

#### editor
- Dashboard
- Documents
- New Document

#### approver
- Dashboard
- Documents
- Approvals

#### compliance_officer
- Dashboard
- Documents
- Audit

#### admin
- Dashboard
- Documents
- New Document
- Approvals
- Audit

### Guard behavior
- Nếu user vào route không được phép, redirect về route hợp lệ gần nhất hoặc `/dashboard`
- Hiển thị feedback phù hợp nếu cần

---

## 13) App shell cần code đẹp và dùng được ngay

### Sidebar
Bao gồm:
- logo DocVault
- nav items theo role
- active indicator rõ
- collapsed behavior optional

### Topbar
Bao gồm:
- search UI placeholder hoặc global search shell
- current role badge
- user dropdown
- logout button

### Content area
- page header tái sử dụng
- max width hợp lý
- spacing đồng bộ

---

## 14) Trang `/login`

Thiết kế login page đẹp, nghiêm túc, tối giản.

### Bố cục
- panel login bên phải / giữa
- panel brand message bên trái hoặc header gọn
- nền sáng, subtle grid/noise cực nhẹ nếu muốn nhưng đừng lố

### Nội dung
- logo/tên DocVault
- subtitle mô tả ngắn
- role selector demo
- optional JWT textarea/input
- username input demo
- login button

### UX
- cho phép vào app nhanh để demo
- sau login redirect `/dashboard`

---

## 15) Trang `/dashboard`

### Mục tiêu
Cho user thấy snapshot tình trạng hệ thống theo role.

### Thành phần bắt buộc
- Page header: title + subtitle + role badge
- 4 stat cards:
  - Total Documents
  - Draft
  - Pending Approval
  - Published
- Recent documents
- Recent activity
- Quick actions theo role

### Quick actions
#### viewer
- Browse documents

#### editor
- Create new document
- Continue draft documents

#### approver
- Review pending approvals

#### compliance_officer
- Open audit logs

#### admin
- Create document
- Review approvals
- Open audit logs

### Data strategy
- Có thể lấy từ documents list rồi derive stats ở FE nếu backend chưa có dashboard endpoint
- Recent activity có thể derive tạm từ workflow history/recent docs mock composition

### UI style
- Không lạm dụng chart
- Nếu có chart thì rất nhẹ, gọn
- Ưu tiên cards + lists

---

## 16) Trang `/documents`

Đây là màn quan trọng nhất. Phải làm đẹp và mạnh.

### Header
- title `Documents`
- subtitle ngắn
- CTA `New Document` nếu role là editor/admin

### Toolbar
- search input
- filter status
- filter classification
- tag filter UI cơ bản nếu hợp lý
- sort dropdown
- reset filters button

### Documents table
Dùng TanStack Table.

#### Columns
- Title
- Classification
- Tags
- Status
- Current Version
- Owner
- Updated At
- Actions

### Row interactions
- click row -> detail page
- action menu ở cột cuối

### Row actions theo role/status

#### viewer
- View
- Download nếu allowed và không phải compliance_officer

#### editor
- View
- Edit nếu owner/admin
- Submit nếu status = DRAFT và user có quyền
- Download nếu allowed

#### approver
- View
- Approve/Reject nếu status = PENDING
- Archive nếu status = PUBLISHED
- Download nếu allowed

#### compliance_officer
- View only
- Không download

#### admin
- tất cả action hợp lệ

### UX rules
- status badge phải nổi bật hơn classification badge
- classification badge nhỏ hơn status badge
- tags truncate hợp lý
- có empty state đẹp
- có skeleton loading
- có error retry state

---

## 17) Trang `/documents/new`

### Mục tiêu
Tạo tài liệu mới nhanh, ít friction.

### Form sections
1. Basic Info
- title
- description

2. Security Metadata
- classification select
- tags input (chip input)

3. Initial File Upload
- drag & drop zone
- file preview: name, type, size

4. Access Control (optional panel, collapsible)
- thêm ACL entries cơ bản

### Validation
- title bắt buộc
- tags tối đa 50
- trim string hợp lý
- classification default `INTERNAL`

### Submit UX
Có 2 action:
- `Save Draft`
- `Save Draft and Upload`

### Logic gợi ý
- Bước 1: `POST /metadata/documents`
- Nếu user chọn file thì bước 2: `POST /documents/:docId/upload`
- Sau thành công redirect sang detail page của document vừa tạo

### Error handling
- nếu create thành công nhưng upload lỗi, phải báo rõ metadata đã tạo nhưng upload thất bại

---

## 18) Trang `/documents/[id]` — Document Detail

Đây là màn trọng tâm thứ hai.

### Bố cục đề xuất
- Header tài liệu ở trên
- Main content chia 2 cột desktop
  - trái: metadata + versions + workflow timeline
  - phải: action panel + ACL summary

### Header document
Hiển thị:
- title
- description
- status badge
- classification badge
- owner
- current version
- created / updated / published / archived timestamps
- tags

### Cards bắt buộc
1. Metadata overview
2. Versions list
3. Workflow timeline
4. ACL summary
5. Action panel

### Versions list
Hiển thị:
- version number
- filename
- size
- contentType
- checksum (truncate)
- createdAt
- createdBy
- action download nếu version đó tải được

### Workflow timeline
Data từ:
- `GET /metadata/documents/:docId/workflow-history`

Hiển thị:
- action
- fromStatus -> toStatus
- actorId
- reason nếu có
- createdAt

### ACL summary
Data từ:
- `GET /metadata/documents/:docId/acl`

Hiển thị:
- subjectType
- subjectId
- permission
- effect
- createdAt

### Action panel phải rất rõ
Hiển thị action theo role/status:

#### editor owner/admin
- Edit Metadata
- Upload New Version
- Submit for Approval (khi DRAFT)
- Manage ACL

#### approver/admin
- Approve (khi PENDING)
- Reject (khi PENDING)
- Archive (khi PUBLISHED)

#### viewer
- Download nếu allowed

#### compliance_officer
- chỉ xem info, không download

### Download flow bắt buộc
Khi user bấm download:
1. gọi `POST /metadata/documents/:docId/download-authorize`
2. lấy `grantToken`
3. gọi `POST /documents/:docId/presign-download`
4. redirect browser đến presigned URL hoặc mở tab mới để tải

### Download error UX
- Nếu 403 vì chưa published -> toast rõ
- Nếu compliance_officer -> button không được render
- Nếu presign lỗi -> toast rõ

---

## 19) Trang `/documents/[id]/edit`

### Mục tiêu
Sửa metadata tài liệu.

### Fields
- title
- description
- classification
- tags

### Data flow
- fetch detail trước
- prefill form
- submit `PATCH /metadata/documents/:docId`

### Access rules
- editor là owner mới sửa được
- admin sửa được
- nếu không có quyền -> redirect hoặc disabled state rõ ràng

---

## 20) Upload new version UX

Trong detail page hoặc edit flow, cần có upload new version path.

### Cách làm
- Button `Upload New Version`
- mở dialog/sheet hoặc card inline
- drag-drop file
- submit lên `POST /documents/:docId/upload`
- sau thành công invalidate detail + list queries

### Hiển thị sau upload
- currentVersion tăng
- versions list refresh
- toast success

---

## 21) Trang `/approvals`

### Mục tiêu
Cho approver/admin xử lý tài liệu đang chờ duyệt.

### Access
- chỉ approver và admin thấy route này

### Dữ liệu
Backend hiện không có endpoint `GET /workflow/pending`, vì vậy cho MVP:
- lấy `GET /metadata/documents`
- filter ở FE các document có `status === 'PENDING'`

### Thành phần
- page header
- pending count
- approvals table
- review drawer hoặc side panel khi click row

### Table columns
- Title
- Classification
- Owner
- Current Version
- Submitted / Updated At
- Actions

### Review drawer
Hiển thị:
- metadata summary
- latest version summary
- workflow history ngắn
- quick approve/reject actions

### Actions
- Approve -> `POST /workflow/:docId/approve`
- Reject -> mở dialog nhập `reason` optional -> `POST /workflow/:docId/reject`

### UX
- approve/reject phải có confirm dialog
- mutation xong refresh list + detail liên quan

---

## 22) Trang `/audit`

### Access
- chỉ compliance_officer và admin thấy route này

### Mục tiêu
Cho compliance officer tra cứu audit logs rõ ràng, nghiêm túc.

### Filter bar
- actorId
- action
- resourceType
- resourceId
- result
- from
- to
- limit
- reset

### Table columns
- Timestamp
- Actor
- Roles
- Action
- Resource Type
- Resource ID
- Result
- Reason
- Trace ID

### UI rules
- dùng monospace cho hash / traceId / resourceId nếu cần
- result SUCCESS/DENY có badge rõ
- table dense nhưng vẫn thoáng
- có empty state và error state rõ ràng

### Query building
Map filter form thành query string đúng endpoint:
- `GET /audit/query?...`

### Notes
- compliance_officer không download file, nhưng vẫn xem được audit.

---

## 23) ACL UI

Với MVP, ACL UI không cần quá phức tạp nhưng phải có structure đúng.

### ACL summary card
- list các ACL entry hiện có
- hiển thị subjectType / subjectId / permission / effect

### ACL editor cơ bản
- dialog hoặc inline form thêm rule mới
- fields:
  - subjectType
  - subjectId
  - permission
  - effect
- submit `POST /metadata/documents/:docId/acl`
- refresh ACL list sau khi thành công

### Access
- editor / admin
- viewer không thấy
- compliance_officer có thể xem summary nhưng không edit nếu backend không cho

---

## 24) Components reusable bắt buộc

### Badge components
Tạo:
- `StatusBadge`
- `ClassificationBadge`
- `RoleBadge`

### Helper mappings
Tạo mapping helper để badge nhất quán:
- label text
- colors
- optional icon

### Common components
- `PageHeader`
- `EmptyState`
- `LoadingState`
- `ErrorState`
- `ConfirmDialog`
- `ProtectedAction`

### ProtectedAction
Component này nhận:
- role requirements
- optional condition
- fallback render

Dùng để ẩn/disable action theo role và trạng thái.

---

## 25) Query architecture bắt buộc rõ ràng

Dùng TanStack Query.

### Query keys đề xuất

```ts
export const queryKeys = {
  documents: ['documents'] as const,
  documentDetail: (id: string) => ['documents', id] as const,
  workflowHistory: (id: string) => ['documents', id, 'workflow-history'] as const,
  acl: (id: string) => ['documents', id, 'acl'] as const,
  audit: (params: Record<string, unknown>) => ['audit', params] as const,
};
```

### Hooks phải có
- `useDocuments()`
- `useDocumentDetail(id)`
- `useWorkflowHistory(id)`
- `useAcl(id)`
- `useCreateDocument()`
- `useUpdateDocument(id)`
- `useUploadDocument(docId)`
- `useSubmitDocument(docId)`
- `useApproveDocument(docId)`
- `useRejectDocument(docId)`
- `useArchiveDocument(docId)`
- `useAuditQuery(filters)`
- `useDownloadDocument()`

### Mutation behavior
Sau mutation, invalidate query hợp lý:
- documents list
- document detail
- workflow history
- acl

---

## 26) API client implementation yêu cầu

Tạo một API client wrapper chung:

### Tính năng
- tự thêm Authorization header
- parse JSON an toàn
- normalize error
- support multipart/form-data
- timeout optional

### Hàm gợi ý

```ts
async function apiRequest<T>(path: string, init?: RequestInit): Promise<T>
```

### Error normalization
Nếu backend trả lỗi dạng:

```json
{ "statusCode": 403, "message": "Only published documents can be downloaded" }
```

thì FE normalize thành Error object có:
- `statusCode`
- `message`
- `raw`

---

## 27) Forms và validation

### Create/Edit document schema
Dùng Zod.

```ts
const documentFormSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(255),
  description: z.string().trim().max(5000).optional().or(z.literal('')),
  classification: z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SECRET']),
  tags: z.array(z.string().trim().min(1).max(50)).max(50),
});
```

### Reject schema
```ts
const rejectSchema = z.object({
  reason: z.string().trim().max(1000).optional().or(z.literal('')),
});
```

---

## 28) Search / filter / sort behavior

### Documents page
Vì backend chưa có query params search/filter thật, hãy:
- fetch toàn bộ documents
- filter/sort client-side cho MVP

### Audit page
Audit có query params thật, build query string từ filter form.

### Filter UX
- debounce search input documents page
- show active filter pills nếu có
- reset filters một click

---

## 29) Date / size / text formatting helpers

Tạo helper cho:
- format ISO datetime -> readable local format
- format bytes -> KB/MB/GB
- truncate checksum / IDs
- title case labels nếu cần

Ví dụ:
- `formatDateTime`
- `formatBytes`
- `truncateMiddle`

---

## 30) Empty / loading / error states bắt buộc

### Loading
- page skeleton
- table skeleton
- card skeleton

### Empty
- documents empty
- approvals empty
- audit empty
- versions empty
- acl empty

### Error
- fetch detail lỗi
- fetch list lỗi
- mutation lỗi
- upload lỗi
- archive endpoint chưa sẵn sàng

Error text phải human-friendly.

---

## 31) Toast / notification UX

Dùng toast cho:
- create document success/fail
- upload success/fail
- submit success/fail
- approve success/fail
- reject success/fail
- archive success/fail
- ACL update success/fail
- download authorize/presign fail

Ví dụ message:
- `Document created successfully.`
- `Version uploaded successfully.`
- `Document submitted for approval.`
- `Document approved and published.`
- `Document rejected.`
- `Archive endpoint is not available yet.`
- `Only published documents can be downloaded.`

---

## 32) Download flow implementation bắt buộc

Tạo hook `useDownloadDocument` hoặc util tương đương.

### Required flow
1. `POST /metadata/documents/:docId/download-authorize`
2. nhận `grantToken`
3. `POST /documents/:docId/presign-download`
4. dùng URL để trigger download

### Parameters
- cho phép truyền `docId`
- optional `version`

### UX
- show loading state khi đang xin quyền tải
- disable nút tạm thời khi request đang chạy
- show error toast nếu authorize/presign fail

---

## 33) Accessibility và usability

- button/link/form input phải có focus state rõ
- label đầy đủ cho input
- keyboard friendly cơ bản
- contrast tốt
- table không quá chật
- icon không thay text quan trọng

---

## 34) Responsive behavior

### Desktop first nhưng mobile không được vỡ

- Sidebar có thể collapse hoặc sheet ở mobile
- Documents table có horizontal scroll hoặc chuyển card list ở màn nhỏ
- Detail page 2 cột -> 1 cột ở màn nhỏ
- Audit filters wrap hợp lý

---

## 35) Seed/mock strategy cho demo

Nếu chưa có backend live, hãy thiết kế theo hướng dễ mock:

- tạo sample data files hoặc mock adapters
- service layer có thể chuyển giữa mock mode / real mode bằng env
- nhưng code chính vẫn phải bám DTO thật

Ví dụ:

```ts
const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === 'true';
```

---

## 36) Implementation details cho từng page/component

### Documents table
- dùng TanStack Table
- sortable columns cho `title`, `updatedAt`, `status`, `classification`
- cột actions là dropdown menu

### UploadDropzone
- drag & drop
- click browse
- validate file presence
- hiển thị file preview

### Workflow timeline
- timeline vertical
- mỗi item có icon action
- hiển thị from -> to rõ ràng

### Approval review drawer
- mở từ row click/action
- hiển thị metadata và quick actions
- có reject reason input

### Audit table
- cột `result` dùng badge
- cột `traceId`, `hash`, `resourceId` dùng text truncate + tooltip

---

## 37) Điều kiện hiển thị action theo status

### DRAFT
- editor/admin: edit, upload, submit, manage ACL
- approver: không approve/reject
- viewer: chỉ view, download thường sẽ fail vì chưa published

### PENDING
- approver/admin: approve, reject
- editor: view
- viewer: view only

### PUBLISHED
- viewer/editor/approver/admin: download nếu backend cho phép
- approver/admin: archive
- compliance_officer: vẫn không download

### ARCHIVED
- mostly read-only
- download tùy backend behavior, nhưng nếu contract không cấm rõ thì action có thể giữ theo policy authorize; tuy nhiên UI nên conservative, chỉ hiển thị download khi policy helper cho phép

Tạo helper function ví dụ:
- `canEditDocument(session, doc)`
- `canSubmitDocument(session, doc)`
- `canApproveDocument(session, doc)`
- `canRejectDocument(session, doc)`
- `canArchiveDocument(session, doc)`
- `canDownloadDocument(session, doc)`
- `canManageAcl(session, doc)`

---

## 38) Owner logic

Do DTO có `ownerId`, hãy dùng `session.userId` để xác định owner khi cần.

### Rule
- editor chỉ edit doc nếu `session.userId === doc.ownerId`
- admin override được

---

## 39) Page copy / microcopy

Viết copy ngắn, rõ, enterprise.

Ví dụ:
- Documents subtitle: `Manage and review secure documents across their lifecycle.`
- Approvals subtitle: `Review pending submissions and publish approved documents.`
- Audit subtitle: `Inspect immutable audit records and access events.`

Không dùng copy quá marketing.

---

## 40) Code quality yêu cầu

- component không quá to nếu có thể tách
- hooks/data logic tách khỏi presentational components
- hạn chế prop drilling quá nhiều
- ưu tiên typed helper functions
- không lặp logic permission nhiều nơi
- tạo constants cho labels / status text / route names

---

## 41) Definition of Done

Chỉ xem là xong khi đạt tất cả điều sau:

1. Có thể login demo và vào app
2. Có app shell đẹp và nhất quán
3. Documents page hiển thị table đẹp với search/filter client-side
4. Create document form hoạt động
5. Detail page hiển thị metadata, versions, workflow history, ACL summary
6. Edit page hoạt động
7. Approvals page hoạt động với approve/reject flow
8. Audit page query/filter hoạt động
9. Download flow 2 bước được triển khai trong code
10. Role-based UI hiển thị đúng
11. Compliance Officer không có download button
12. Toàn bộ page có loading/empty/error states
13. Components reusable được tách hợp lý
14. Màu sắc và style bám đúng palette enterprise đã cho
15. Code compile được và cấu trúc rõ ràng

---

## 42) Output format bạn phải trả về

Khi thực hiện, hãy:

1. tạo toàn bộ source code FE
2. nếu cần, thêm file `README_FE.md` mô tả cách chạy
3. giải thích ngắn các quyết định kiến trúc chính
4. nêu các phần đang mock và các phần đã sẵn sàng nối backend thật

---

## 43) Bonus mong muốn

Nếu có thể, hãy làm thêm nhưng không bắt buộc:
- dark mode foundation nhưng chưa cần hoàn chỉnh
- command palette/search shell placeholder
- activity feed đẹp hơn
- document cards alternative view

Tuy nhiên đừng để bonus làm lệch MVP.

---

## 44) Tóm tắt chốt cuối cùng

Bạn cần code một frontend Next.js hoàn chỉnh cho DocVault với:
- App Router
- TypeScript
- Tailwind
- shadcn/ui
- TanStack Query
- TanStack Table
- RHF + Zod
- design enterprise bảo mật, sáng, sidebar tối
- route: login / dashboard / documents / documents-new / detail / edit / approvals / audit
- data types bám đúng API contract
- workflow đúng `DRAFT -> PENDING -> PUBLISHED -> ARCHIVED`
- RBAC đúng
- compliance officer không có download button
- upload và download flow đúng contract
- code sạch, reusable, typed, demo-ready

Hãy bắt đầu xây dựng toàn bộ frontend ngay bây giờ.
