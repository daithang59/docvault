# DocVault FE Design System & UI Specification

Updated: 2026-03-15

## 1) Mục tiêu thiết kế

Thiết kế FE cho DocVault phải thể hiện được 3 tính chất cùng lúc:
- **Bảo mật và tin cậy**: giao diện phải tạo cảm giác hệ thống quản lý tài liệu nội bộ, không phải app chia sẻ file giải trí.
- **Rõ trạng thái nghiệp vụ**: người dùng nhìn vào là biết tài liệu đang ở `DRAFT`, `PENDING`, `PUBLISHED`, hay `ARCHIVED`.
- **Hiệu quả thao tác**: luồng chính phải nhanh, ít click, phù hợp demo MVP.

Phong cách đề xuất:
- Modern enterprise UI
- Clean, spacious, low-noise
- Dùng nền sáng để dễ đọc dữ liệu, nhấn bằng xanh navy/slate
- Trạng thái và classification dùng màu riêng nhưng tiết chế

---

## 2) Định hướng visual tổng thể

### Brand feeling
- Từ khóa: **Secure, Professional, Calm, Structured, Trustworthy**
- Tránh kiểu quá rực, gradient nặng, glassmorphism, hoặc card quá bóng
- Nên dùng bo góc vừa phải (`12px`–`16px`), shadow nhẹ, border rõ

### Layout principles
- App shell 3 phần:
  - **Sidebar trái**: điều hướng chính
  - **Topbar**: search, role badge, user menu
  - **Content area**: page header + content body
- Dùng grid/card/list tùy màn, nhưng ưu tiên consistency hơn đa dạng
- Khoảng trắng rộng vừa phải, tạo cảm giác “premium enterprise”

### Typography principles
- Heading rõ cấp bậc, sans-serif hiện đại
- Gợi ý font:
  - `Inter` cho text chính
  - fallback: `ui-sans-serif, system-ui, sans-serif`
- Kích thước tham chiếu:
  - Page title: 28/32 semibold
  - Section title: 20/28 semibold
  - Card title: 16/24 semibold
  - Body: 14/22 regular
  - Caption/meta: 12/18 medium

---

## 3) Sitemap FE MVP

## Public/Auth
- `/login`

## App authenticated
- `/dashboard`
- `/documents`
- `/documents/new`
- `/documents/[id]`
- `/documents/[id]/edit`
- `/approvals`
- `/audit`
- `/profile` (tuỳ chọn nhẹ)

---

## 4) Điều hướng theo role

### Viewer
Thấy:
- Dashboard
- Documents
- Document Detail

Không thấy:
- New Document
- Approvals
- Audit
- ACL management

### Editor
Thấy:
- Dashboard
- Documents
- New Document
- Document Detail
- Edit Document

Có thể:
- tạo metadata
- upload file
- sửa metadata khi là owner
- submit workflow
- quản lý ACL cơ bản nếu owner

### Approver
Thấy:
- Dashboard
- Documents
- Approvals
- Document Detail

Có thể:
- approve / reject
- archive published doc

### Compliance Officer
Thấy:
- Dashboard
- Documents
- Document Detail
- Audit

Không có nút download dù đọc metadata được.

### Admin
Thấy tất cả.

---

## 5) Màn hình chi tiết

## 5.1 Dashboard

### Mục tiêu
Cho user nhìn nhanh tình hình hệ thống theo role.

### Thành phần
- Hero header nhỏ: “Welcome back” + role badge
- 4 stat cards:
  - Total Documents
  - Draft
  - Pending Approval
  - Published
- Recent activity panel
- Recent documents table/list
- Quick actions

### Quick actions theo role
- Viewer: View documents
- Editor: New document, Continue drafts
- Approver: Review pending approvals
- Compliance Officer: Open audit logs

### UI notes
- Dashboard không nên quá nhiều chart
- 1 mini trend chart là đủ, hoặc bỏ hẳn chart nếu dữ liệu MVP ít
- Tập trung vào cards + recent items + actions

---

## 5.2 Documents List

### Mục tiêu
Màn quan trọng nhất. Phải cho cảm giác “document control center”.

### Header
- Title: `Documents`
- Subtitle ngắn: quản lý và tra cứu tài liệu
- CTA phải: `New Document` (editor/admin only)

### Toolbar
- Search input theo title/tag/owner (nếu backend chưa có search thật thì mock UI trước)
- Filter chips / selects:
  - Status
  - Classification
  - Tag
  - Ownership scope (Mine / All) nếu cần
- Sort dropdown
- View toggle: table / card (tuỳ chọn, table là mặc định)

### Table columns
- Title
- Classification
- Tags
- Status
- Current Version
- Owner
- Updated At
- Actions

### Row action gợi ý
- View
- Edit (owner/editor/admin)
- Download (khi allowed)
- Submit (editor owner, status DRAFT)
- Approve/Reject (ở approvals ưu tiên hơn, nhưng có thể hiện nhẹ ở detail)
- Archive (approver/admin khi published)

### UX notes
- Status badge phải rất rõ
- Classification badge nhỏ hơn status badge
- Tags không nên chiếm quá nhiều chiều ngang
- Với empty state: icon folder-lock + CTA rõ ràng

---

## 5.3 Create New Document

### Mục tiêu
Tạo tài liệu mới nhanh, ít friction.

### Form sections
1. Basic Info
- Title
- Description

2. Security Metadata
- Classification
- Tags

3. Initial File Upload
- Drag & drop zone
- File name / size / content type preview

4. Access Control (optional for MVP, có thể tách bước sau)
- ACL entries cơ bản

### CTA cuối form
- Save Draft
- Save and Upload
- Cancel

### UX notes
- Nên dùng step feel nhẹ nhưng vẫn cùng 1 page
- Không cần wizard nhiều bước cứng nhắc cho MVP
- Upload zone nên rất rõ và đẹp vì đây là thao tác trung tâm

---

## 5.4 Document Detail

### Mục tiêu
Đây là màn trung tâm nghiệp vụ.

### Bố cục đề xuất
Trang chia 2 cột:
- **Cột trái (main)**: metadata + versions + workflow history
- **Cột phải (side panel)**: status card + actions card + ACL summary

### Khối chính
1. Document header
- Title
- Description
- Status badge
- Classification badge
- Tags
- Owner / createdAt / updatedAt

2. Version history
- Danh sách version theo timeline hoặc list card
- Mỗi version có filename, size, checksum rút gọn, uploaded by, createdAt
- Action download ở current version nếu allowed

3. Workflow history
- Timeline dọc
- fromStatus → toStatus
- action, actorId, reason, createdAt

### Side panel
1. Status summary card
- Current status
- Published date / Archived date
- Current version

2. Actions card
Theo role và status:
- DRAFT + owner/editor: Edit, Upload new file, Submit
- PENDING + approver: Approve, Reject
- PUBLISHED + allowed: Download
- PUBLISHED + approver/admin: Archive
- Compliance officer: không hiện Download

3. ACL summary card
- Số rule
- Preview 3 rule đầu
- Button manage ACL nếu role phù hợp

### UX notes
- Tất cả action nguy hiểm phải có confirm modal
- Reject cần modal nhập reason
- Archive cần modal confirm ngắn

---

## 5.5 Approvals

### Mục tiêu
Màn làm việc cho approver.

### Cấu trúc
- Title + subtitle
- Filter bar: classification, owner, updatedAt
- Pending queue list/table

### Table columns
- Title
- Owner
- Classification
- Submitted At (nếu chưa có field riêng thì dùng updatedAt tạm)
- Current Version
- Actions

### Actions
- Review
- Approve
- Reject

### Review drawer/modal
Có thể dùng side drawer để xem nhanh:
- metadata
- version summary
- workflow history ngắn
- nút approve/reject ngay tại drawer

---

## 5.6 Audit

### Mục tiêu
Cho compliance officer tra cứu lịch sử thao tác dễ đọc và đáng tin.

### Header
- Title: `Audit Logs`
- Subtitle: truy vấn hoạt động hệ thống

### Filters
- Date range
- Actor/User
- Action
- Result
- Resource type/id (nếu mở rộng)

### Result table
- Timestamp
- Actor
- Action
- Resource
- Result
- IP / metadata nhẹ
- Hash indicator (tuỳ chọn hiển thị icon integrity)

### UX notes
- Thiết kế thiên về bảng dữ liệu sạch, nghiêm túc
- Không nên làm quá “security dashboard” với quá nhiều chart giả lập
- Có thể thêm badge “Tamper-evident logs” ở góc phải để tăng cảm giác tin cậy

---

## 5.7 Login

### Mục tiêu
Đơn giản, đẹp, đúng chất enterprise.

### Layout
- Trái: brand panel với mô tả ngắn về DocVault
- Phải: card login

### Nội dung
- Logo / tên sản phẩm
- Headline: `Secure document control for internal teams`
- Form username/password hoặc button SSO nếu đi qua Keycloak redirect

### Visual notes
- Nền sáng + abstract pattern rất nhẹ
- Không dùng minh họa quá vui tươi

---

## 6) Badge system

## Status badges
- `DRAFT`: neutral / slate
- `PENDING`: amber
- `PUBLISHED`: green
- `ARCHIVED`: gray

## Classification badges
- `PUBLIC`: blue-gray nhạt
- `INTERNAL`: blue
- `CONFIDENTIAL`: orange
- `SECRET`: red

## Role badges
- `viewer`: neutral
- `editor`: blue
- `approver`: violet
- `compliance_officer`: red-slate
- `admin`: dark navy

---

## 7) Component inventory

## Core layout
- AppShell
- SidebarNav
- Topbar
- Breadcrumbs
- PageHeader

## Data display
- StatCard
- DataTable
- EmptyState
- StatusBadge
- ClassificationBadge
- TagChip
- Timeline
- DetailList

## Forms
- TextInput
- TextArea
- Select
- MultiTagInput
- FileDropzone
- ACLRuleRow

## Feedback
- Toast
- InlineAlert
- ConfirmDialog
- RejectReasonDialog
- Skeleton loaders
- PermissionDeniedState

## Domain components
- DocumentListTable
- DocumentSummaryCard
- VersionList
- WorkflowTimeline
- ACLSummaryCard
- ApprovalQueueTable
- AuditLogTable

---

## 8) Trạng thái tương tác quan trọng

### Loading
- List page: skeleton rows
- Detail page: skeleton header + side card
- Buttons có loading state riêng

### Empty
- Documents empty
- Approvals empty
- Audit empty

### Error
- 401: session expired → redirect login
- 403: show permission message lịch sự, không quá kỹ thuật
- 404: document not found
- 500: generic retry state

### Success messaging
- `Document created successfully`
- `File uploaded successfully`
- `Submitted for approval`
- `Document approved`
- `Document rejected`
- `Download link generated`

---

## 9) RBAC UI matrix

## Documents List
- Viewer: view, maybe download when published
- Editor: create, edit own, submit own
- Approver: view, go to approvals
- Compliance Officer: view only, no download
- Admin: all

## Detail
- Download button chỉ hiện nếu role + policy cho phép
- Approve/Reject chỉ hiện ở `PENDING` với approver/admin
- Submit chỉ hiện ở `DRAFT` với owner/editor/admin
- Archive chỉ hiện ở `PUBLISHED` với approver/admin

## Audit
- Chỉ compliance_officer/admin

## ACL
- Editor owner/admin

---

## 10) Đề xuất tech UI

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui cho primitive components
- Lucide icons
- TanStack Table cho bảng
- React Hook Form + Zod cho form
- Zustand hoặc TanStack Query + local state tuỳ phong cách project

---

## 11) Nguyên tắc màu trong UI

- 70–80% UI dùng neutral palette
- Brand color chỉ dùng cho CTA chính, link, active nav, focus ring
- Màu trạng thái chỉ dùng cho badge, alert, action emphasis
- Background nên có nhiều layer sáng nhẹ thay vì đậm
- Tránh dùng đỏ quá nhiều, chỉ dùng cho `SECRET`, destructive, compliance accent

---

## 12) Prompt ngắn cho AI Agent dựng UI

Hãy xây dựng FE cho DocVault theo phong cách modern enterprise dashboard, clean, spacious, secure-by-design. Tông màu chủ đạo là navy/slate trên nền sáng, với badges trạng thái và phân loại tài liệu rõ ràng. Sidebar trái, topbar gọn, content area rộng. Ưu tiên readability, card/table rõ ràng, bo góc vừa phải, shadow nhẹ, typography Inter. Các trang cần có: Dashboard, Documents List, New Document, Document Detail, Approvals, Audit Logs, Login. UI phải phản ánh đúng RBAC và workflow thực tế: `DRAFT -> PENDING -> PUBLISHED -> ARCHIVED`, reject quay về `DRAFT`, compliance officer xem audit/metadata nhưng không có download.

