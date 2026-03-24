# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo Setup

- **Package manager**: pnpm 9+, **Node.js**: 18+
- **Build orchestrator**: Turbo (configured in `turbo.json`)
- **Workspaces**: `apps/*`, `services/*`, `libs/*`

## Commands

```bash
# Tất cả services cùng lúc (không chạy đủ thứ tự — xem bên dưới)
pnpm dev

# Build tất cả (theo dependency order của turbo)
pnpm build

# Lint tất cả
pnpm lint

# Test tất cả
pnpm test

# Chạy một service cụ thể
pnpm --filter <service-name> start:dev
# Ví dụ: pnpm --filter gateway start:dev

# Chạy một test file cụ thể trong service
pnpm --filter <service-name> test -- --testPathPattern=foo.spec.ts

# Prisma migration (chạy sau khi Docker infra đã healthy)
pnpm --filter metadata-service prisma:deploy

# Migrate audit logs từ PostgreSQL → MongoDB (chạy KHI audit-service đang STOP)
pnpm --filter audit-service migrate:to-mongo

# E2E verification script (chạy khi tất cả services + infra đã chạy)
node scripts/e2e-check.mjs

# Format code (Prettier)
pnpm format
```

## Kiến trúc tổng quan

### Luồng request

```
Client → Gateway (:3000) → Backend Services (:3001–:3005)
                      ↓
            JWT verification (Keycloak JWKS)
            Role-based routing
            Audit event emission
```

### Gateway (`services/gateway/`)

- **Entry point duy nhất** cho toàn bộ client. Xác thực JWT tại đây rồi proxy sang các service.
- `src/proxy/` — Mỗi backend service có một proxy controller tương ứng:
  - `metadata.proxy.controller.ts` → `:3001/api`
  - `documents.proxy.controller.ts` → `:3002/api`
  - `workflow.proxy.controller.ts` → `:3003/api`
  - `audit.proxy.controller.ts` → `:3004/api`
  - `notify.proxy.controller.ts` → `:3005/api`
- `src/auth/` — JWT strategy, roles guard, roles decorator dùng chung cho toàn gateway.
- **Không có logic nghiệp vụ** — chỉ routing, auth, và audit wrapper.

### Backend Services (NestJS)

| Service | Port | Vai trò chính | Database |
|---|---|---|---|
| `metadata-service` | 3001 | Metadata, ACL, trạng thái, lịch sử | PostgreSQL (Prisma) |
| `document-service` | 3002 | Upload/download file, MinIO S3 | — |
| `workflow-service` | 3003 | State machine DRAFT→PENDING→PUBLISHED→ARCHIVED | — |
| `audit-service` | 3004 | Audit log với hash-chain SHA-256 | MongoDB (Mongoose) |
| `notification-service` | 3005 | Thông báo | — |

### Auth flow (quan trọng)

Mỗi service đều có `@nestjs/passport` + `passport-jwt` + `jwks-rsa` để tự xác thực JWT trực tiếp với Keycloak. Gateway **không** truyền token xuống backend services — mỗi service tự verify. Các role: `viewer`, `editor`, `approver`, `compliance_officer`, `admin`.

### Enforcing quyền truy cập

- **ACL metadata** được kiểm tra trong `metadata-service/src/acl/`
- **Download file** được kiểm tra trong `metadata-service/src/policy/policy.service.ts`
  - **Quy tắc đặc biệt**: `compliance_officer` **luôn bị từ chối** tải file, bất kể ACL — logic nằm trong `policy.service.ts`, không phải ở gateway hay document-service.
- **Archive** chỉ cho phép editor sở hữu document hoặc admin.

### Document lifecycle

```
DRAFT → PENDING → PUBLISHED → ARCHIVED
```

- Editor submit → `workflow-service` gọi `metadata-service` đổi status, rồi gọi `notification-service`.
- Approver approve/reject → `workflow-service` cập nhật status.
- Services giao tiếp bằng **Axios HTTP** (không dùng message queue).

### Prisma schema

- `metadata-service/prisma/schema.prisma` — 4 bảng: `documents`, `document_versions`, `document_acl`, `document_workflow_history`.
- Generated client nằm trong `generated/prisma/` — **không chỉnh sửa tay**.

### MongoDB schema

- `audit-service/src/mongo/audit-event.schema.ts` — Mongoose schema cho `audit_events` collection. Hash chain SHA-256 được tính lại hoàn toàn tại runtime.

### libs/contracts

- `libs/contracts/openapi/gateway.yaml` — OpenAPI 3.0 spec đầy đủ cho tất cả endpoints (metadata, documents, workflow, audit, notify).
- `libs/contracts/events/` — Thư mục đặt event schema (hiện trống).

### libs/auth

- `libs/auth/` — Shared auth primitives cho tất cả services:
  - `JwtStrategy` — Passport strategy Keycloak JWKS + RS256
  - `RolesGuard` + `Roles()` — Role-based access control
  - `AuthModule` — NestJS module re-export
  - `ServiceUser`, `RequestContext`, `buildActorId()`, `buildRequestContext()` — Shared types & helpers
  - `ROLES`, `READER_ROLES` — Canonical role constants
- **Migration**: 6 services hiện vẫn có inline auth files; nên migrate sang dùng `@docvault/auth`.

## Infrastructure

- Docker Compose: `infra/docker-compose.dev.yml` — PostgreSQL, MinIO, Keycloak.
- Keycloak realm seed: `infra/keycloak/` — định nghĩa realm và seed users.
- MinIO: endpoint `:9000`, console `:9001`.
- Keycloak: `:8080`, realm `docvault`, client `docvault-gateway`.

## Thứ tự khởi động

**Quan trọng**: Gateway phải khởi động **sau cùng**, sau khi tất cả backend services đã ready:

1. Docker infra (PostgreSQL, MinIO, Keycloak, MongoDB)
2. `prisma:deploy` cho metadata-service
3. metadata-service → document-service → workflow-service → notification-service → audit-service (MongoDB không cần migration)
4. Chạy `migrate:to-mongo` để migrate audit logs cũ (nếu có)
4. Gateway
5. Frontend (`apps/web/`)
