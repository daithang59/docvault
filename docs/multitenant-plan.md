# Kế hoạch: Thêm Multi-Tenancy (Organization) cho DocVault

## Bối cảnh
DocVault hiện là single-space: mọi tài liệu nằm chung. Mục tiêu là cho nhiều người
dùng tự đăng ký, mỗi người có không gian tổ chức (organization) riêng, dữ liệu cô lập —
để demo pipeline CI/CD triển khai một cụm phục vụ nhiều người dùng.

## Quyết định đã chốt
- **1 org / user** (mỗi tài khoản thuộc đúng 1 tổ chức).
- **App DB (Postgres ở metadata-service) là nguồn sự thật cho orgId** — KHÔNG nhúng vào JWT.
- **Đăng ký tự tạo org mới**: user đăng nhập lần đầu → tự động tạo Organization, user thành admin của org đó.

## Kiến trúc orgId (cốt lõi)
orgId được resolve **bên trong metadata-service** từ `actorId` (sub) qua bảng
`OrganizationMembership`, có cache ngắn hạn. Lý do: chỉ metadata-service có DB và
chứa toàn bộ dữ liệu org-scoped. Tránh thêm hop gateway→metadata mỗi request.

Lazy auto-provision: nếu user chưa có membership → tự tạo Organization + Membership
(user = admin). Đây là cơ chế "đăng ký tự tạo org".

Audit events được gắn `organizationId` (truyền qua RequestContext) để tách log theo org.

## Phạm vi thay đổi

### 1. Prisma schema (`services/metadata-service/prisma/schema.prisma`)
- Thêm model `Organization { id, name, slug, ownerId, createdAt }`.
- Thêm model `OrganizationMembership { id, organizationId, userId(sub), role, createdAt @@unique([organizationId, userId]) @@index([userId]) }`.
- Thêm `organizationId String` + `@@index([organizationId])` vào `Document` và `DocumentSavedView`.
- Migration: `prisma migrate dev --name add-multitenancy`.

### 2. Resolver + provisioning (mới, trong metadata-service)
- `src/org/org.service.ts`: `resolveOrgId(actorId)` (cache TTL ~60s) + `ensureMembership(actorId, username)` (lazy create).
- `src/org/org.controller.ts`: `GET /orgs/me` (org hiện tại), `GET /orgs/members` (liệt kê thành viên — admin).
- Inject orgId vào `RequestContext` (mở rộng `src/common/request-context.ts` + `libs/auth/src/types.ts`).

### 3. Áp org filter vào mọi query (metadata-service)
- `documents.service.ts`: thêm `organizationId: orgId` vào TẤT CẢ where của `findAll`, `findOneOrThrow`, `update`, `setLegalHold`, `listTrash`, `restoreFromTrash`, `setApprovalChain`, `markDeleted`; set `organizationId` khi `create`.
- Tương tự cho các module: `acl/`, `policy/`, `status/`, `versions/`, `comments/`, `retention/`, `document-saved-views/`, `document-share-links/` — mọi truy vấn root phải scope theo org hoặc verify doc thuộc org của caller.
- `trash-purge.service.ts`: job chạy cross-org (giữ nguyên, system actor).

### 4. Audit (gắn org)
- `AuditClient.emitEvent` nhận `organizationId` từ context; thêm field vào audit event schema (MongoDB) — optional cho phase này.

### 5. Frontend (`apps/web`)
- Sau login lần đầu: gọi `GET /orgs/me` (tự provision nếu chưa có) để hiển thị tên org.
- Thêm hiển thị org hiện tại trên header/sidebar.
- (Tùy chọn) trang quản lý thành viên org cho admin.

### 6. Seed (`prisma/seed.ts`)
- Tạo 1 Organization mẫu + membership cho 3 user seed; gắn `organizationId` vào 4 document mẫu.

## Thứ tự thực hiện
1. Schema + migration + seed.
2. OrgService (resolve + lazy provision) + RequestContext mở rộng.
3. Áp org filter vào documents.service (+ test).
4. Lan sang các module còn lại của metadata-service.
5. Endpoint /orgs/me, /orgs/members + gateway proxy.
6. Frontend hiển thị org.
7. Audit gắn org (nếu còn thời gian).

## Kiểm thử end-to-end
- Unit: org filter trong findAll (2 user khác org không thấy doc của nhau).
- `pnpm --filter metadata-service test`.
- Tích hợp: tạo 2 user qua Keycloak, đăng nhập → mỗi user thấy org riêng, không thấy tài liệu của org kia.
- `pnpm --filter metadata-service prisma:deploy && db:seed` chạy sạch.
- `pnpm build` xanh toàn monorepo.

## Rủi ro
- **Rò rỉ xuyên org** nếu bỏ sót 1 query → cần rà soát mọi `prisma.*.findUnique/findMany/update/delete`.
- Migration trên dữ liệu cũ: document hiện có cần gán org mặc định (backfill trong migration).
- Đây là multi-tenant mức demo (filter tầng app), KHÔNG phải row-level security tầng DB.
