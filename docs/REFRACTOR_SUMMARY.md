# REFACTOR_SUMMARY.md

Cập nhật: 2026-03-15

Tài liệu này tổng hợp các thay đổi đã được thực hiện khi refactor DocVault từ trạng thái "proto-microservice" sang microservices MVP đúng boundary.

## 1. Mục tiêu đã xử lý

- Tách logic blob upload/download/presign ra khỏi `metadata-service`
- Tách workflow state machine submit/approve/reject ra service riêng
- Tách audit ingest/query append-only ra service riêng
- Tạo `notification-service` tối thiểu cho MVP
- Mở rộng `gateway` thành entrypoint đúng nghĩa cho tất cả service
- Giữ JWT Keycloak, route-level RBAC, và enforce compliance policy download ở backend

## 2. Boundary mới sau refactor

### gateway

- Verify JWT bằng issuer/audience/expiration
- Route đầy đủ:
  - `/api/metadata/**`
  - `/api/documents/**`
  - `/api/workflow/**`
  - `/api/audit/**`
  - `/api/notify/**`
- Forward:
  - `X-Request-Id`
  - `X-User-Id`
  - `X-Roles`
- Phát audit wrapper event:
  - `REQUEST_RECEIVED`
  - `REQUEST_OK`
  - `REQUEST_DENIED`

### metadata-service

Giữ lại:

- document metadata CRUD
- ACL
- status pointer
- version pointer registration
- download authorization / policy check

Đã loại bỏ:

- MinIO upload/download
- presigned URL generation
- workflow transition logic
- audit persistence/query logic

Endpoint chính:

- `POST /documents`
- `GET /documents`
- `GET /documents/:docId`
- `PATCH /documents/:docId`
- `POST /documents/:docId/acl`
- `GET /documents/:docId/acl`
- `POST /documents/:docId/versions`
- `POST /documents/:docId/status`
- `POST /documents/:docId/download-authorize`

### document-service

Sở hữu:

- MinIO/S3 client
- upload multipart
- checksum SHA-256
- object key `doc/{docId}/v{n}/{filename}`
- presign download
- direct stream download

Endpoint chính:

- `POST /documents/:docId/upload`
- `POST /documents/:docId/presign-download`
- `GET /documents/:docId/versions/:version/stream`

Sau upload, service gọi metadata-service để ghi version pointer.

### workflow-service

Sở hữu:

- workflow state machine MVP
- transition validation
- role/status/owner check
- call metadata-service để update status
- call audit-service và notification-service

Transition MVP:

- `DRAFT -> PENDING` qua `submit`
- `PENDING -> PUBLISHED` qua `approve`
- `PENDING -> DRAFT` qua `reject`

Endpoint chính:

- `POST /workflow/:docId/submit`
- `POST /workflow/:docId/approve`
- `POST /workflow/:docId/reject`

### audit-service

Sở hữu:

- append-only ingest
- query theo actor/time/action/resource/result
- role gate cho query

Endpoint chính:

- `POST /audit/events`
- `GET /audit/query`

`GET /audit/query` chỉ cho `compliance_officer`.

### notification-service

Sở hữu:

- `POST /notify`
- dev mode log ra console
- event type:
  - `SUBMITTED`
  - `APPROVED`
  - `REJECTED`

## 3. Role và policy

- Roles đang dùng:
  - `viewer`
  - `editor`
  - `approver`
  - `compliance_officer`
  - `admin` vẫn được giữ cho local admin task
- `co` trong Keycloak được alias thành `compliance_officer` để không phá seed cũ
- `compliance_officer` xem audit được nhưng luôn bị deny download file
- Viewer chỉ download được khi document đã `PUBLISHED`

## 4. Data model và migration

### Metadata DB

Bảng runtime mới:

- `documents`
- `document_versions`
- `document_acl`

Migration mới:

- `services/metadata-service/prisma/migrations/20260315000000_refactor_microservices_boundary`

### Audit DB

Database mới:

- `docvault_audit`

Bảng runtime mới:

- `audit_events`

Migration mới:

- `services/audit-service/prisma/migrations/20260315001000_init_audit_service`

### Infra

- `infra/db/init-postgres.sql` được cập nhật để tạo `docvault_audit`
- `uuid-ossp` được enable cho cả `docvault_metadata` và `docvault_audit`
- `infra/keycloak/realm-docvault.json` được cập nhật để `co1` có thêm role `compliance_officer`

## 5. Logging, validation, error contract

Tất cả service mới/đã refactor đều được bổ sung:

- Swagger/OpenAPI
- DTO validation (`class-validator`)
- standard error response thông qua global exception filter
- structured JSON log với:
  - `traceId`
  - `service`
  - `route`
  - `actorId`
  - `action`
  - `result`
  - `latencyMs`

## 6. Script và tài liệu đã thêm/cập nhật

### Script

- `scripts/demo.sh`
- `scripts/e2e-check.mjs`

`scripts/e2e-check.mjs` cover các case chính:

- no token -> 401
- expired-like token -> 401
- viewer create -> 403
- editor create -> 201
- upload -> object có trong MinIO
- viewer download DRAFT -> 403
- submit -> `PENDING`
- approve -> `PUBLISHED`
- approve lần 2 -> 409
- viewer published download -> 200
- compliance officer download -> 403
- compliance officer audit query -> 200
- viewer audit query -> 403

### Tài liệu

- `README.md`
- `docs/PROJECT_STATUS.md`
- `docs/README.md`
- README riêng của từng service đã được đổi từ placeholder sang boundary thực tế

## 7. Các file/chủng loại thay đổi quan trọng

- gateway:
  - thêm `src/proxy/*`
  - thêm gateway-level audit wrapper trong `src/main.ts`
- metadata-service:
  - xóa `src/storage/*`
  - xóa audit persistence cũ
  - thêm `src/acl/*`, `src/status/*`, `src/versions/*`, `src/policy/*`
- document-service:
  - tạo source code đầy đủ cho storage, metadata client, audit client, upload/download module
- workflow-service:
  - tạo source code đầy đủ cho workflow, metadata/audit/notification client
- audit-service:
  - tạo source code đầy đủ + Prisma schema/migration
- notification-service:
  - tạo source code đầy đủ cho notify endpoint

## 8. Phần đã verify

Đã chạy thành công:

- `pnpm build`
- `pnpm test`
- `node --check scripts/e2e-check.mjs`
- `docker compose -f infra/docker-compose.dev.yml --env-file infra/.env.example up -d`
- `pnpm --filter metadata-service prisma:deploy`
- `pnpm --filter audit-service prisma:deploy`
- `node scripts/e2e-check.mjs`

Các case live E2E đã pass:

- no token -> `401`
- expired-like token -> `401`
- viewer create -> `403`
- editor create -> `201`
- upload -> object xuất hiện trong MinIO
- viewer download DRAFT -> `403`
- submit -> `PENDING`
- approve -> `PUBLISHED`
- approve lần 2 -> `409`
- viewer published download -> `200`
- compliance officer download -> `403`
- compliance officer audit query -> `200`
- viewer audit query -> `403`

## 9. Ghi chú thực tế

- Workspace hiện có thể build, lint, và chạy live E2E pass
- Trong lúc bring-up runtime đã phải fix thêm một số vấn đề hạ tầng/code:
  - Prisma client của `metadata-service` và `audit-service` bị đè lẫn nhau trong workspace
  - JWT verification cần tương thích token Keycloak có `azp` thay vì `aud`
  - downstream `403/409` từ metadata bị nuốt thành `500` ở service trung gian
  - một số service thiếu hẳn cấu hình ESLint dù đã khai báo script `lint`

Nếu cần, file này có thể được dùng làm changelog implementation cho PR hoặc checkpoint.
