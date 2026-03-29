# PROJECT_STATUS

Updated: 2026-03-17

Tài liệu này phản ánh trạng thái hiện tại của repo dựa trên code runtime trong `apps/web`, `services/*`, `infra/*`, `libs/*` và `scripts/e2e-check.mjs`, không chỉ dựa trên các file markdown cũ.

## Tóm tắt dự án

DocVault hiện là một monorepo `pnpm` + `turbo` cho bài toán quản lý tài liệu an toàn theo vai trò.

Backend đã được tách thành các microservice NestJS chạy thật:

- `gateway`
- `metadata-service`
- `document-service`
- `workflow-service`
- `audit-service`
- `notification-service`

Frontend là một ứng dụng Next.js chạy thật, không còn là scaffold rỗng. Ứng dụng web hiện đã có các màn hình đăng nhập, dashboard, danh sách tài liệu, chi tiết tài liệu, tạo/sửa tài liệu, duyệt tài liệu, xem audit và phần settings.

Đánh giá nhanh trạng thái hiện tại:

- Luồng MVP chính đã được hiện thực ở backend.
- Frontend đã bao phủ phần lớn user flow quan trọng.
- Hạ tầng local development đã có đủ Postgres, MinIO, Keycloak.
- Tầng thư viện dùng chung và contract còn mỏng.
- Vẫn còn một số điểm lệch giữa tài liệu, UI và runtime cần dọn tiếp.

## Dự án đang giải quyết bài toán gì

DocVault là hệ thống quản lý tài liệu có kiểm soát, tập trung vào các mục tiêu:

- quản lý metadata của tài liệu
- upload và version file tài liệu
- điều phối vòng đời tài liệu bằng workflow
- kiểm soát việc tải file bằng policy ở backend
- lưu vết audit
- hỗ trợ compliance review nhưng không cho compliance officer tải file

Các vai trò đang được dùng trong code:

- `viewer`
- `editor`
- `approver`
- `compliance_officer`
- `admin`

Role cũ `co` từ Keycloak được normalize thành `compliance_officer` ở cả backend lẫn frontend.

## Cấu trúc monorepo

- `apps/web`
  - frontend Next.js 16 + React 19
- `services/gateway`
  - API gateway, xác thực JWT, routing, truyền header ngữ cảnh
- `services/metadata-service`
  - metadata tài liệu, ACL, version pointer, workflow history, download authorization
- `services/document-service`
  - upload/download file qua MinIO/S3
- `services/workflow-service`
  - validate transition workflow và orchestration với metadata/audit/notification
- `services/audit-service`
  - ghi và truy vấn audit log
- `services/notification-service`
  - notification sink cho môi trường dev
- `infra`
  - Docker Compose cho Postgres, MongoDB, MinIO, Keycloak
- `libs`
  - vùng để shared auth/contracts; hiện mới ở mức khung

## Kiến trúc runtime hiện tại

### 1. Frontend

`apps/web` là ứng dụng Next.js dùng các thành phần chính sau:

- App Router
- Axios
- TanStack Query
- React Hook Form
- Zod
- Tailwind CSS 4
- Radix UI

Các màn hình đã có:

- login
- dashboard
- documents list
- document detail
- new document
- edit document
- approvals
- audit
- settings

Frontend gọi gateway qua biến:

- `NEXT_PUBLIC_API_BASE_URL`
- mặc định là `http://localhost:3000/api`

Trang login hiện hỗ trợ 2 chế độ:

- demo login theo role
- login bằng JWT token

### 2. Gateway

`services/gateway` là entry point ở biên hệ thống. Service này hiện đang:

- xác thực JWT từ Keycloak bằng JWKS
- kiểm tra role ở mức route
- expose `/health` và `/me`
- proxy request xuống các service phía sau
- forward các header:
  - `authorization`
  - `x-request-id`
  - `x-user-id`
  - `x-roles`

Các nhóm route đang được proxy:

- `/metadata/*`
- `/documents/*`
- `/workflow/*`
- `/audit/*`
- `/notify`

### 3. Metadata Service

`services/metadata-service` hiện là nguồn sự thật cho metadata và policy. Service này đang sở hữu:

- document record
- classification và tags
- `currentVersion`
- ACL entries
- workflow history
- logic authorize download

Các endpoint hiện có:

- `GET /documents`
- `GET /documents/:docId`
- `POST /documents`
- `PATCH /documents/:docId`
- `POST /documents/:docId/acl`
- `GET /documents/:docId/acl`
- `POST /documents/:docId/versions`
- `POST /documents/:docId/status`
- `GET /documents/:docId/workflow-history`
- `POST /documents/:docId/download-authorize`

### 4. Document Service

`services/document-service` đang sở hữu phần xử lý blob file. Service này hiện:

- nhận upload file
- tính checksum SHA-256
- sinh object key theo format `doc/{docId}/v{n}/{filename}`
- upload file lên MinIO/S3
- gọi metadata-service để đăng ký version mới
- gọi metadata-service để authorize download
- verify grant token đã ký trước khi phát quyền tải
- hỗ trợ cả presigned URL và stream download

Các endpoint hiện có:

- `POST /documents/:docId/upload`
- `POST /documents/:docId/presign-download`
- `GET /documents/:docId/versions/:version/stream`

### 5. Workflow Service

`services/workflow-service` sở hữu logic chuyển trạng thái workflow. Service này hiện:

- đọc trạng thái hiện tại từ metadata-service
- validate workflow transition
- cập nhật trạng thái thông qua metadata-service
- phát audit event
- gọi notification-service

Các endpoint hiện có:

- `POST /workflow/:docId/submit`
- `POST /workflow/:docId/approve`
- `POST /workflow/:docId/reject`
- `POST /workflow/:docId/archive`

### 6. Audit Service

`services/audit-service` lưu audit event trong Postgres. Service này hiện:

- append audit record
- hỗ trợ query theo actor/action/resource/result/time
- tạo hash chain để tăng tính tamper-evident

Các endpoint hiện có:

- `POST /audit/events`
- `GET /audit/query`

`GET /audit/query` hiện chỉ cho `compliance_officer`.

### 7. Notification Service

`services/notification-service` hiện vẫn là sink đơn giản. Service này:

- nhận `POST /notify`
- log payload notification
- trả về `{ accepted: true }`

Nó chưa phải một hệ thống email/SMS/push hoàn chỉnh.

## Luật nghiệp vụ đang có trong code

### Truy cập metadata

Tất cả business role đã xác thực đều có thể đọc metadata:

- list documents
- get document detail

Điều này có nghĩa là ACL hiện chưa phải lớp kiểm soát chính cho việc đọc metadata. ACL hiện được dùng mạnh nhất ở download authorization.

### Ownership

Với create/update/upload/version/ACL management, hệ thống hiện kỳ vọng:

- `editor` là owner, hoặc
- `admin`

Identity owner ở backend hiện được build theo công thức:

- `username ?? sub`

### Workflow

Map transition hiện đang được enforce:

- `SUBMIT`: `DRAFT -> PENDING`
- `APPROVE`: `PENDING -> PUBLISHED`
- `REJECT`: `PENDING -> DRAFT`
- `ARCHIVE`: `PUBLISHED -> ARCHIVED`

Các tác động đang có:

- `APPROVE` set `publishedAt`
- `ARCHIVE` set `archivedAt`
- mỗi transition ghi thêm một dòng vào `document_workflow_history`
- workflow action đồng thời phát audit event

### Download authorization

Luồng download hiện là luồng hai bước:

1. metadata-service authorize request và ký grant token có thời hạn ngắn
2. document-service verify token rồi trả presigned URL hoặc stream

Các rule hiện có trong code:

- chỉ tài liệu `PUBLISHED` mới được tải
- `compliance_officer` luôn bị chặn tải
- ACL `DENY` cho quyền `DOWNLOAD` sẽ chặn tải
- ACL `ALLOW` có thể cho phép tải
- owner của document có thể tải
- user có role `viewer`, `editor`, `approver`, `admin` hiện được xem là có default role access ngay cả khi không có ACL `ALLOW`

Hệ quả quan trọng:

- ACL hiện đang hoạt động gần giống lớp deny/override cho download, chưa phải allow-list chặt cho mọi business role

### Audit

Audit event đang được hash-linked theo công thức:

- `hash = SHA-256(prevHash + "|" + canonicalPayload)`

Điều này giúp tăng khả năng phát hiện chỉnh sửa trái phép, nhưng chưa phải bất biến tuyệt đối kiểu blockchain.

## Trạng thái mô hình dữ liệu

### Metadata DB

Các model Prisma đang dùng ở runtime:

- `Document`
- `DocumentVersion`
- `DocumentAcl`
- `DocumentWorkflowHistory`

Các trường quan trọng đã có:

- `classification`
- `tags`
- `status`
- `currentVersion`
- `publishedAt`
- `archivedAt`

Schema ACL hỗ trợ các subject type:

- `USER`
- `ROLE`
- `GROUP`
- `ALL`

Schema ACL hỗ trợ các permission:

- `READ`
- `DOWNLOAD`
- `WRITE`
- `APPROVE`

### Audit DB

Model runtime:

- `AuditEvent`

Các trường quan trọng:

- actor info
- action
- resource info
- result
- reason
- trace id
- `prevHash`
- `hash`

## Trạng thái frontend

Frontend hiện không còn ở mức demo UI đơn giản mà đã bám khá sát MVP backend.

Các hành vi đã hiện thực:

- login bằng demo role hoặc JWT
- dashboard tổng hợp trạng thái tài liệu
- danh sách tài liệu có filter/search/sort phía client
- tạo tài liệu và upload file đầu tiên
- trang chi tiết tài liệu với:
  - versions card
  - workflow timeline
  - ACL panel
  - action panel
- trang approvals cho tài liệu đang `PENDING`
- trang audit cho compliance user

Frontend permission helpers hiện cũng đã mô hình hóa:

- create/edit/submit/archive cho owner editor hoặc admin
- approve/reject cho approver hoặc admin
- download chỉ khi tài liệu đã publish và không cho compliance role
- ACL management cho owner editor hoặc admin

## Trạng thái hạ tầng local

`infra/docker-compose.dev.yml` hiện cung cấp:

- Postgres
- MongoDB
- MinIO
- MinIO bucket init
- Keycloak

Ghi chú:

- MongoDB vẫn còn trong compose nhưng có vẻ không còn được dùng ở runtime MVP hiện tại
- Postgres đang được metadata-service và audit-service dùng
- MinIO đang được document-service dùng
- Keycloak dùng cho JWT validation và seed user local

## Trạng thái build và chạy

Tooling ở root:

- package manager: `pnpm`
- task runner: `turbo`

Các script quan trọng ở root:

- `pnpm dev`
- `pnpm build`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`

Các service hiện đều có script cho:

- `build`
- `start:dev`
- `test`

Prisma deploy script hiện có ở:

- `metadata-service`
- `audit-service`

## Trạng thái test và verification

Repo hiện có script smoke test đáng tin cậy ở `scripts/e2e-check.mjs`.

Script này đang cover các luồng chính:

- request không có token bị chặn
- token hết hạn giả lập bị chặn
- viewer không thể create
- editor có thể create
- editor có thể upload
- viewer không thể tải khi document còn draft
- editor có thể submit
- approver có thể approve
- approve lần hai bị conflict
- viewer có thể tải document đã publish
- compliance officer có thể đọc metadata
- compliance officer không thể tải file
- compliance officer có thể query audit
- viewer không thể query audit

Ngoài ra repo còn có một số unit test theo service, ví dụ:

- test transition trong metadata status service
- test hash-chain trong audit service

## Trạng thái thư viện dùng chung và contract

`libs/` hiện vẫn ở giai đoạn sớm.

Tình trạng hiện tại:

- `libs/auth` chủ yếu mới là README mô tả ý định
- `libs/contracts/openapi/gateway.yaml` đã có nhưng còn rất tối thiểu
- `libs/contracts/events` mới có cấu trúc thư mục, chưa có schema rõ ràng

Kết luận ngắn:

- ranh giới service đã tương đối rõ ở runtime
- nhưng shared contracts và shared auth chưa trưởng thành thành package dùng chung thực thụ

## Các điểm lệch và khoảng trống hiện tại

### 1. Workflow history có ở metadata-service nhưng chưa được gateway proxy

Trạng thái quan sát được:

- frontend gọi `/metadata/documents/:docId/workflow-history`
- metadata-service có `GET /documents/:docId/workflow-history`
- gateway hiện chưa có route proxy tương ứng

Hệ quả có thể xảy ra:

- workflow timeline trên web có thể lỗi khi đi qua gateway

### 2. ACL `GROUP` có trong schema và UI nhưng policy download chưa evaluate

Trạng thái quan sát được:

- Prisma schema hỗ trợ `GROUP`
- form ACL trên frontend cho chọn `GROUP`
- DTO cho phép `GROUP`
- `PolicyService.matchesAcl()` hiện chỉ xử lý:
  - `ALL`
  - `USER`
  - `ROLE`

Hệ quả có thể xảy ra:

- rule download theo group có thể tạo được nhưng không có tác dụng khi authorize

### 3. Kiểm tra owner ở frontend đang lệch với cách backend lưu owner

Trạng thái quan sát được:

- backend lưu owner/actor theo `username ?? sub`
- frontend so `doc.ownerId` với `session.user.sub`

Hệ quả có thể xảy ra:

- các action chỉ dành cho owner như edit, upload, submit, archive, quản lý ACL có thể bị ẩn sai trên UI với user Keycloak thật

### 4. Quyền archive đang không nhất quán giữa các layer

Trạng thái quan sát được:

- gateway `POST /workflow/:docId/archive` cho `approver` và `admin`
- workflow-service controller lại cho `editor` và `admin`
- workflow-service business logic thực tế chỉ cho owner editor hoặc admin

Hệ quả có thể xảy ra:

- approver có thể qua được lớp role ở gateway nhưng vẫn bị từ chối ở downstream
- hành vi runtime và tài liệu dễ bị lệch nhau

### 5. Tài liệu hiện chưa theo kịp runtime code

Trạng thái quan sát được:

- `docs/PROJECT_STATUS.md` trước đó là snapshot cũ
- `apps/web/README.md` vẫn là README mặc định của Next.js
- một số markdown mô tả hành vi khác với runtime hiện tại

Hệ quả có thể xảy ra:

- source code đang là nguồn sự thật đáng tin hơn tài liệu ở một số phần

### 6. ACL chưa phải mô hình kiểm soát đọc metadata chặt chẽ

Trạng thái quan sát được:

- mọi business role đã xác thực đều có thể list/read metadata
- ACL chủ yếu được áp vào download authorization

Hệ quả có thể xảy ra:

- hệ thống hiện gần với mô hình "metadata đọc được, file thì bị kiểm soát" hơn là "mọi thứ đều bị ACL-gate"

### 7. Tầng shared contract còn non

Trạng thái quan sát được:

- thư mục shared đã có
- nhưng phần lớn logic auth/contract vẫn còn lặp ở từng service thay vì đi qua `libs`

Hệ quả có thể xảy ra:

- boundary microservice đã tách rõ, nhưng code reuse và contract hygiene còn chưa tốt

## Kết luận thực tế

Nếu mô tả ngắn gọn trong một câu:

DocVault hiện là một MVP microservice hoạt động được cho bài toán quản lý vòng đời tài liệu an toàn, có frontend usable và backend đã tách boundary khá rõ, nhưng vẫn còn một số bất nhất về contract, policy, ownership và tài liệu cần xử lý trước khi xem là đủ chín cho production.
