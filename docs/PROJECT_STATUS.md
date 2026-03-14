# PROJECT_STATUS.md — DocVault (Cập nhật theo codebase thực tế)

> Tài liệu này phản ánh **trạng thái implementation thực tế** của repo.  
> Cập nhật lần cuối: 2026-03-14.  
> Để đọc kế hoạch/roadmap ban đầu, xem [`docs/README_CONTEXT.md`](./README_CONTEXT.md).

---

## 1. Mục tiêu repo

DocVault là hệ thống quản lý tài liệu theo mô hình **microservices**, xác thực bằng **Keycloak**, lưu blob qua **MinIO**, metadata qua **PostgreSQL + Prisma**. Phân quyền theo role (`viewer`, `editor`, `approver`, `co`, `admin`).

---

## 2. Những gì đã được implement

### 2.1. Monorepo & Tooling

- Monorepo dùng **pnpm workspaces** + **Turborepo** (`turbo.json`).
- Root scripts: `dev`, `build`, `lint`, `test`, `format`.
- Hai package đang hoạt động trong workspace:
  - `services/gateway` (port **3000**)
  - `services/metadata-service` (port **3001**)

### 2.2. Infrastructure local (`infra/`)

Stack khởi động qua `infra/docker-compose.dev.yml`:

| Service     | Image             | Port  | Ghi chú                        |
|-------------|-------------------|-------|--------------------------------|
| PostgreSQL  | postgres:16       | 5432  | DB cho metadata-service        |
| MongoDB     | mongo:7           | 27017 | Dự phòng cho audit-service     |
| MinIO       | minio/minio       | 9000/9001 | Object storage + console  |
| Keycloak    | keycloak:26       | 8080  | IAM, realm import sẵn          |

> Compose hiện chỉ khởi động **dependency infrastructure**, không khởi động service ứng dụng.

### 2.3. Keycloak & IAM (`infra/keycloak/realm-docvault.json`)

- Realm: `docvault`
- Client confidential: `docvault-gateway` (direct access grants: bật)
- Client secret (dev): `dev-gateway-secret`
- Roles: `viewer`, `editor`, `approver`, `co`, `admin`
- Demo users (password `Passw0rd!`): `viewer1`, `editor1`, `approver1`, `co1`, `admin1`

> **Lưu ý:** Role compliance officer trong code được đặt tên là `co`, không phải `compliance_officer` như trong tài liệu kế hoạch ban đầu.

### 2.4. Gateway Service (`services/gateway`, port 3000)

**Tech:** NestJS + Swagger (`/docs`) + `@nestjs/axios` + `multer`

#### Endpoints:

| Method | Path | Auth | RBAC | Mô tả |
|--------|------|------|------|-------|
| GET | `/health` | ❌ | - | Healthcheck |
| GET | `/me` | JWT | any | Thông tin user từ token |
| GET | `/admin-only` | JWT | `admin` | Demo RBAC |
| GET | `/metadata/documents` | JWT | any | Proxy → metadata-service |
| POST | `/metadata/documents` | JWT | any | Proxy → metadata-service |
| POST | `/metadata/documents/upload` | JWT | any | Proxy multipart → metadata-service |
| GET | `/metadata/documents/:id/download-url` | JWT | any | Proxy → metadata-service |
| GET | `/metadata/documents/:id/download` | JWT | any | Proxy stream → metadata-service |

#### Cách hoạt động proxy upload:
Gateway nhận multipart/form-data, rebuild thành `FormData` rồi forward cùng `Authorization` header đến metadata-service.

#### Hạn chế hiện tại:
- URL metadata-service **hardcode** `http://localhost:3001` (chưa dùng env var).
- Chưa có logging, rate limit, error mapping trung tâm.
- RBAC ở gateway chỉ check `any authenticated` cho proxy routes — RBAC thực thi ở metadata-service.

### 2.5. Metadata Service (`services/metadata-service`, port 3001)

**Tech:** NestJS + Swagger (`/docs`) + Prisma + AWS SDK v3 + Multer

#### Modules:
- `AppModule` → imports `DocumentsModule`, `PrismaModule`, `StorageModule`
- `DocumentsModule` → `DocumentsController` + `DocumentsService` + `StorageService` + `PrismaService`
- `PrismaModule` → `PrismaService` (singleton, graceful shutdown)
- `StorageModule` → `StorageService` (MinIO via AWS SDK v3 S3 compatible)

#### Endpoints:

| Method | Path | RBAC | Mô tả |
|--------|------|------|-------|
| GET | `/health` | ❌ | Healthcheck |
| GET | `/me` | any | Thông tin user từ token |
| GET | `/documents` | `viewer/editor/approver/co/admin` | Danh sách tất cả documents |
| POST | `/documents` | `editor/admin` | Tạo metadata record (không kèm file) |
| POST | `/documents/upload` | `editor/admin` | Upload file → MinIO + tạo metadata |
| GET | `/documents/:id/download-url` | `viewer/editor/approver/co/admin` | Trả presigned URL (5 phút) — CO bị block |
| GET | `/documents/:id/download` | `viewer/editor/approver/co/admin` | Stream file trực tiếp — CO bị block |

#### Logic download authorization (`canDownload`):
```typescript
// CO bị block download ngay cả khi có role khác
const isComplianceOnly = roles.includes('co');
return (isOwner || isPrivileged) && !isComplianceOnly;
```

Các role được phép download: `admin`, `approver`, `editor`, `viewer` (hoặc là `ownerId`).  
Role `co` **luôn bị từ chối** (HTTP 403), kể cả khi là owner của document.

#### `StorageService` (MinIO via `@aws-sdk/client-s3`):
- `buildObjectKey(filename)` → `documents/YYYY-MM-DD/uuid-filename`
- `upload()` → `PutObjectCommand` lên MinIO
- `createDownloadUrl()` → `getSignedUrl` (presigned, mặc định 300 giây)
- `getObjectStream()` → `GetObjectCommand`, stream trực tiếp qua `StreamableFile`

#### Cấu hình env metadata-service (`.env.example`):
```env
PORT=3001
KEYCLOAK_BASE_URL=http://localhost:8080
KEYCLOAK_REALM=docvault
KEYCLOAK_AUDIENCE=docvault-gateway
DATABASE_URL=postgresql://docvault:docvaultpw@localhost:5432/docvault_metadata?schema=public
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadminpw
S3_BUCKET=docvault
S3_FORCE_PATH_STYLE=true
```

### 2.6. Prisma Schema & Migrations

**File:** `services/metadata-service/prisma/schema.prisma`

Model `DocumentMetadata` (table: `document_metadata`):

| Field | Type | Ghi chú |
|-------|------|---------|
| `id` | String (UUID) | PK |
| `title` | String | Bắt buộc |
| `description` | String? | |
| `ownerId` | String | `username ?? sub` từ JWT |
| `filename` | String? | Tên file gốc |
| `contentType` | String? | MIME type |
| `sizeBytes` | Int? | File size bytes |
| `bucket` | String? | MinIO bucket name |
| `objectKey` | String? (unique) | `documents/date/uuid-file` |
| `etag` | String? | ETag từ MinIO |
| `status` | `DocumentStatus` | Mặc định `DRAFT` |
| `version` | Int | Mặc định `1` |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

Enum `DocumentStatus`: `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `ARCHIVED`

Indexes: `ownerId`, `status`

**Migrations hiện có:**
1. `20260314091050_init_document_metadata` — tạo bảng và enum cơ bản
2. `20260314152014_add_storage_fields` — thêm `bucket`, `etag`, `sizeBytes`

### 2.7. DTOs

- `CreateDocumentDto` — `title`, `description?`, `filename?`, `contentType?`
- `UploadDocumentDto` — `title`, `description?` (file nhận qua `FileInterceptor`)

> Chưa có validation decorators (`@IsString`, `@IsNotEmpty`, v.v.) trên DTO.

### 2.8. RBAC matrix (trạng thái thực tế)

| Endpoint | viewer | editor | approver | co | admin |
|----------|--------|--------|----------|----|-------|
| `GET /documents` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /documents` | ❌ | ✅ | ❌ | ❌ | ✅ |
| `POST /documents/upload` | ❌ | ✅ | ❌ | ❌ | ✅ |
| `GET /documents/:id/download-url` | ✅ | ✅ | ✅ | **403** | ✅ |
| `GET /documents/:id/download` | ✅ | ✅ | ✅ | **403** | ✅ |
| `GET /admin-only` (gateway) | ❌ | ❌ | ❌ | ❌ | ✅ |

### 2.9. Contracts & Tài liệu API

- `libs/contracts/openapi/gateway.yaml` — OpenAPI tối thiểu, chỉ có route `/health`
- `libs/contracts/events/` — đã tạo folder, chưa có event schema
- Swagger UI tự sinh tại runtime qua NestJS decorators

---

## 3. Các thành phần chưa implement

### 3.1. Frontend (`apps/web/`)
- Chỉ có `.gitkeep`. Chưa có Next.js app, route, UI, OIDC login.

### 3.2. Service placeholder (folder tồn tại, chưa có source code)
- `services/document-service` — upload/download MinIO (nay đã tích hợp vào metadata-service)
- `services/workflow-service` — state machine Draft → Pending → Approved
- `services/audit-service` — ingest + query audit events
- `services/notification-service` — notify submit/approve

### 3.3. Shared libs chưa có code
- `libs/auth/` — chưa có JWT helpers/role constants dùng chung
- `libs/contracts/events/` — chưa có event schema

### 3.4. Chức năng còn thiếu trong metadata-service
- Chưa có `GET /documents/:id` (get-by-id)
- Chưa có update, delete document
- Chưa có validation decorators trên DTO
- Chưa có query/filter/pagination cho `GET /documents`
- Chưa có workflow endpoint (`/submit`, `/approve`, `/reject`)
- Chưa có ACL per-document
- Chưa có audit event emit

---

## 4. Cách chạy hệ thống

### 4.1. Khởi động dependency (Docker)

```bash
docker compose -f infra/docker-compose.dev.yml --env-file infra/.env up -d
```

### 4.2. Chạy services

```bash
# Metadata service (port 3001)
pnpm --filter metadata-service exec prisma migrate deploy
pnpm --filter metadata-service dev

# Gateway (port 3000)
pnpm --filter gateway start:dev
```

### 4.3. Swagger UI

- Gateway: http://localhost:3000/docs
- Metadata service: http://localhost:3001/docs

### 4.4. Lấy access token từ Keycloak

```bash
curl -X POST "http://localhost:8080/realms/docvault/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=docvault-gateway" \
  -d "client_secret=dev-gateway-secret" \
  -d "grant_type=password" \
  -d "username=editor1" \
  -d "password=Passw0rd!"
```

### 4.5. Ví dụ gọi upload (qua gateway)

```bash
curl -X POST http://localhost:3000/metadata/documents/upload \
  -H "Authorization: Bearer <access_token>" \
  -F "title=My Document" \
  -F "file=@/path/to/file.pdf"
```

### 4.6. Ví dụ lấy presigned download URL

```bash
curl http://localhost:3000/metadata/documents/<id>/download-url \
  -H "Authorization: Bearer <access_token>"
# Response: { id, filename, expiresInSeconds: 300, url: "https://..." }
```

---

## 5. Khoảng cách giữa roadmap và implementation hiện tại

| Hạng mục | Roadmap | Trạng thái |
|----------|---------|------------|
| IAM / Keycloak | ✅ | ✅ Done |
| Gateway auth + routing | ✅ | ✅ Done (URL hardcode) |
| Metadata CRUD | ✅ | ⚠️ Partial (thiếu get-by-id, update, delete) |
| Upload file → MinIO | ✅ | ✅ Done |
| Download presigned URL | ✅ | ✅ Done |
| Download stream | ✅ | ✅ Done |
| CO download block (403) | ✅ | ✅ Done |
| Workflow (submit/approve) | ✅ | ❌ Chưa có |
| Audit service | ✅ | ❌ Chưa có |
| Notification service | optional | ❌ Chưa có |
| Frontend (Next.js) | ✅ | ❌ Chưa có |
| Full-stack Docker Compose | ✅ | ❌ Chưa có |

---

## 6. Ưu tiên tiếp theo

1. **Validation DTO** — thêm `class-validator` decorators vào `CreateDocumentDto`, `UploadDocumentDto`.
2. **`GET /documents/:id`** — get-by-id endpoint trong metadata-service.
3. **Env var cho gateway** — đưa `METADATA_SERVICE_URL` ra env thay vì hardcode.
4. **Workflow service** — state machine `Draft → Pending → Approved/Rejected`.
5. **Audit service** — ingest events (upload, submit, approve, download allow/deny).
6. **Frontend** — scaffold Next.js với OIDC login + document list + upload form.

---

## 7. Tài liệu liên quan

- [`README.md`](../README.md) — tổng quan nhanh repo
- [`docs/README.md`](./README.md) — mục lục tài liệu
- [`docs/README_CONTEXT.md`](./README_CONTEXT.md) — context và roadmap ban đầu (kế hoạch)
