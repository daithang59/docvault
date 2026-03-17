# Chạy dự án local

Updated: 2026-03-18

Tài liệu này là hướng dẫn chạy DocVault trên máy local theo trạng thái code hiện tại.

## 1. Yêu cầu

- Node.js 20+
- `pnpm` 9+
- Docker Desktop hoặc Docker Engine + Docker Compose
- Các port còn trống:
  - `3000` gateway
  - `3001` metadata-service
  - `3002` document-service
  - `3003` workflow-service
  - `3004` audit-service
  - `3005` notification-service
  - `3100` frontend web, nên dùng port này để tránh đụng backend
  - `5432` Postgres
  - `8080` Keycloak
  - `9000` MinIO API
  - `9001` MinIO Console

## 2. Cài dependencies

Chạy ở thư mục gốc repo:

```bash
pnpm install
```

## 3. Khởi động hạ tầng

Infra local đang nằm trong `infra/docker-compose.dev.yml`.

```bash
docker compose -f infra/docker-compose.dev.yml --env-file infra/.env.example up -d
```

Lệnh này sẽ khởi động:

- Postgres
- MongoDB
- MinIO
- MinIO init job
- Keycloak

Lưu ý:

- MongoDB hiện vẫn còn trong compose nhưng không phải thành phần chính của MVP runtime hiện tại.
- Nếu bạn đã có volume Postgres cũ từ giai đoạn proto-microservice, nên xóa volume cũ hoặc tạo lại database trước khi migrate.

## 4. Tạo file môi trường

Tạo các file sau bằng cách copy từ `.env.example`:

- `services/gateway/.env`
- `services/metadata-service/.env`
- `services/document-service/.env`
- `services/workflow-service/.env`
- `services/audit-service/.env`
- `services/notification-service/.env`
- `apps/web/.env.local`

Giá trị mặc định trong repo hiện đã khớp với stack local:

- gateway: `http://localhost:3000`
- metadata-service: `http://localhost:3001`
- document-service: `http://localhost:3002`
- workflow-service: `http://localhost:3003`
- audit-service: `http://localhost:3004`
- notification-service: `http://localhost:3005`
- Keycloak: `http://localhost:8080`
- MinIO: `http://localhost:9000`

Biến quan trọng của frontend:

```env
NEXT_PUBLIC_APP_NAME=DocVault
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
```

## 5. Chạy migration

Sau khi Postgres đã lên:

```bash
pnpm --filter metadata-service prisma:deploy
pnpm --filter audit-service prisma:deploy
```

## 6. Khởi động backend

Khuyến nghị chạy từng service trong terminal riêng theo thứ tự sau:

```bash
pnpm --filter metadata-service start:dev
pnpm --filter audit-service start:dev
pnpm --filter document-service start:dev
pnpm --filter notification-service start:dev
pnpm --filter workflow-service start:dev
pnpm --filter gateway start:dev
```

Các URL backend sau khi chạy:

- Gateway Swagger: `http://localhost:3000/docs`
- Metadata Swagger: `http://localhost:3001/docs`
- Document Swagger: `http://localhost:3002/docs`
- Workflow Swagger: `http://localhost:3003/docs`
- Audit Swagger: `http://localhost:3004/docs`
- Notification Swagger: `http://localhost:3005/docs`

Health check nhanh:

- `http://localhost:3000/health`
- `http://localhost:3001/health`
- `http://localhost:3002/health`
- `http://localhost:3003/health`
- `http://localhost:3004/health`
- `http://localhost:3005/health`

## 7. Khởi động frontend

Frontend nên chạy riêng trên port `3100` để không đụng:

- gateway `3000`
- metadata-service `3001`
- các backend service còn lại `3002` đến `3005`

Chạy:

```bash
pnpm --filter web dev -- --port 3100
```

Mở:

- `http://localhost:3100`

Trang login:

- `http://localhost:3100/login`

## 8. Đăng nhập và user mẫu

Password cho toàn bộ user seed:

- `Passw0rd!`

Các user có sẵn:

- `viewer1`
- `editor1`
- `approver1`
- `co1`
- `admin1`

Frontend hiện hỗ trợ 2 cách đăng nhập:

- Demo Login
  - phù hợp để xem UI/role guard nhanh
- JWT Token
  - dùng token thật từ Keycloak để đi full backend

Keycloak local:

- `http://localhost:8080`

## 9. Smoke test nhanh

Sau khi toàn bộ backend đã chạy, có thể chạy e2e smoke test:

```bash
pnpm test:e2e
```

Script này sẽ kiểm tra các luồng chính:

- unauthorized bị chặn
- viewer không create được
- editor create/upload/submit được
- approver approve được
- viewer tải file sau publish
- compliance officer query audit được nhưng không tải file được

## 10. Chế độ chạy nhanh và các lưu ý

Root script hiện có:

```bash
pnpm dev
```

Tuy nhiên, script này chạy toàn bộ workspace qua Turbo, bao gồm cả `apps/web`. Vì web mặc định dùng port `3000`, nó có thể đụng với gateway nếu không tự đổi port.

Khuyến nghị hiện tại:

- chạy backend service riêng như ở bước 6
- chạy frontend riêng như ở bước 7 trên port `3100`

## 11. Nếu có lỗi thường gặp

### Postgres migrate lỗi

Kiểm tra:

- container Postgres đã healthy chưa
- database `docvault_metadata` và `docvault_audit` đã được init chưa
- volume cũ có đang giữ schema cũ hay không

### Frontend gọi API lỗi

Kiểm tra:

- `apps/web/.env.local` có trỏ đúng `NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api`
- gateway đã chạy ở port `3000`
- frontend đang mở ở `3100`, không phải `3000` hoặc `3001`

### Không lấy được token Keycloak

Kiểm tra:

- Keycloak đã lên ở `http://localhost:8080`
- realm `docvault` đã được import
- client secret trong docs và `.env` khớp với seed hiện tại

## 12. Tài liệu liên quan

- `README.md`
- `docs/demo-flow.md`
- `docs/demo-users.md`
- `docs/PROJECT_STATUS.md`
- `infra/README.md`
- `services/README.md`
