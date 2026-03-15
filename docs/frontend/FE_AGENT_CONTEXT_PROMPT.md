# Prompt cho AI Agent — Dựng FE DocVault

Hãy xây dựng frontend cho dự án **DocVault** theo các yêu cầu sau.

## 1) Product context
DocVault là hệ thống quản lý tài liệu bảo mật theo mô hình microservices. Frontend phải mang phong cách modern enterprise dashboard, rõ ràng, chuyên nghiệp, và thể hiện được cảm giác bảo mật/tin cậy.

## 2) Tech stack mong muốn
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui
- Lucide icons
- TanStack Table
- React Hook Form + Zod
- TanStack Query cho data fetching

## 3) Visual direction
- Nền sáng, card trắng, border nhẹ, shadow nhẹ
- Tông màu chủ đạo navy/slate + blue accent
- Sidebar tối, content sáng
- Typography Inter
- Bo góc vừa phải (`xl` đến `2xl` hợp lý)
- Tránh màu quá rực, tránh hiệu ứng nặng

Đọc thêm file palette và bám theo đúng bảng màu đã định nghĩa trong `FE_COLOR_PALETTE.md`.

## 4) Workflow nghiệp vụ phải phản ánh đúng
Trạng thái tài liệu:
- `DRAFT`
- `PENDING`
- `PUBLISHED`
- `ARCHIVED`

Transition:
- `DRAFT -> PENDING` bằng submit
- `PENDING -> PUBLISHED` bằng approve
- `PENDING -> DRAFT` bằng reject
- `PUBLISHED -> ARCHIVED` bằng archive

## 5) RBAC cần phản ánh đúng ở UI
### viewer
- xem danh sách tài liệu
- xem chi tiết
- download khi document đã published và backend cho phép

### editor
- tạo document
- upload file
- sửa metadata khi là owner/admin
- submit document
- quản lý ACL cơ bản nếu được phép

### approver
- xem queue approvals
- approve / reject
- archive published document

### compliance_officer
- xem metadata
- xem audit logs
- không có download button

### admin
- có toàn quyền cho MVP

## 6) API gateway base
Base URL: `http://localhost:3000/api`

### Metadata
- `GET /metadata/documents`
- `GET /metadata/documents/:docId`
- `POST /metadata/documents`
- `PATCH /metadata/documents/:docId`
- `GET /metadata/documents/:docId/workflow-history`
- `GET /metadata/documents/:docId/acl`
- `POST /metadata/documents/:docId/acl`
- `POST /metadata/documents/:docId/download-authorize`

### Blob/document
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

## 7) Cấu trúc màn hình cần có
- `/login`
- `/dashboard`
- `/documents`
- `/documents/new`
- `/documents/[id]`
- `/documents/[id]/edit`
- `/approvals`
- `/audit`

## 8) Thiết kế từng màn hình
### Dashboard
- stat cards
- recent documents
- recent activity
- quick actions theo role

### Documents List
- table đẹp, sạch, enterprise
- toolbar search/filter/sort
- badges status/classification
- action menu theo role

### New Document
- form metadata
- classification
- tags
- upload zone đẹp, rõ ràng

### Document Detail
- header tài liệu
- versions list
- workflow timeline
- ACL summary
- action panel bên phải

### Approvals
- queue pending
- review nhanh
- approve/reject UX rõ ràng

### Audit
- filter bar
- table logs
- style nghiêm túc, dữ liệu dễ đọc

## 9) Output mong muốn từ bạn
Hãy tạo:
1. app shell hoàn chỉnh
2. design system components cơ bản
3. page components cho toàn bộ màn chính
4. mock data layer hoặc service layer typed theo API DTO
5. reusable badges cho status / classification / role
6. form create/edit document
7. approvals queue UI
8. audit logs UI

## 10) Chú ý quan trọng
- Không thiết kế thêm state `APPROVED`
- Compliance Officer tuyệt đối không có nút download trong UI
- Ưu tiên trải nghiệm demo MVP đẹp và hợp lý hơn là làm quá nhiều tính năng phụ
- Tập trung vào tính nhất quán, readability, role-aware UI, và cảm giác “secure document platform”

