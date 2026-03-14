# Metadata Service

`metadata-service` la service metadata hien co trong DocVault. O trang thai hien tai, day la mot API demo co xac thuc va phan quyen theo role, nhung logic du lieu van dang chay bang in-memory thay vi Postgres.

## Da co gi trong implementation

- NestJS application voi Swagger tai `/docs`
- JWT verification bang Keycloak JWKS
- `RolesGuard` + `Roles` decorator
- Cac route demo cho metadata:
  - `GET /health`
  - `GET /me`
  - `GET /documents`
  - `POST /documents`
  - `GET /documents/audit-view`
- Prisma schema va `prisma.config.ts` de dinh nghia huong ket noi Postgres ve sau

## Hanh vi API hien tai

| Method | Route | Mo ta | Role duoc phep |
|--------|------|-------|----------------|
| `GET` | `/health` | Health check | Public |
| `GET` | `/me` | Xem thong tin user tu token | Bat ky user da dang nhap |
| `GET` | `/documents` | Lay danh sach document demo | `viewer`, `editor`, `approver`, `co`, `admin` |
| `POST` | `/documents` | Tao document demo | `editor`, `admin` |
| `GET` | `/documents/audit-view` | View danh cho compliance/audit | `co`, `admin` |

## Du lieu hien tai

Danh sach document mau dang duoc khai bao truc tiep trong controller va chi ton tai trong bo nho cua process:

- Khong ghi vao Postgres
- Khoi dong lai service se mat du lieu moi tao
- Chua co layer repository/service rieng

## Prisma va database

Folder `prisma/` da dinh nghia model `DocumentMetadata`, enum `DocumentStatus` va `prisma.config.ts`.

Dieu nay cho thay huong thiet ke da duoc dat nen:

- metadata luu o Postgres
- document co `objectKey` de lien ket ve object storage
- co versioning co ban
- co lifecycle status

Nhung o runtime hien tai controller chua goi Prisma Client.

## Bien moi truong

Tham khao file `.env.example`:

```env
PORT=3001
KEYCLOAK_BASE_URL=http://localhost:8080
KEYCLOAK_REALM=docvault
KEYCLOAK_AUDIENCE=docvault-gateway
DATABASE_URL="postgresql://docvault:docvaultpw@localhost:5432/docvault_metadata?schema=public"
```

Luu y:

- `DATABASE_URL` da co, nhung hien tai chua duoc service su dung
- `KEYCLOAK_AUDIENCE` chua duoc enforce trong strategy

## Cach chay

Tu root repo:

```bash
pnpm --filter metadata-service start:dev
```

Hoac trong folder nay:

```bash
pnpm start:dev
```

Swagger mac dinh:

```text
http://localhost:3001/docs
```

## Cac file quan trong

- `src/app.controller.ts`: chua tat ca route hien tai
- `src/auth/`: JWT strategy, role decorator, role guard
- `prisma/schema.prisma`: model du lieu cho giai doan tiep theo
- `prisma.config.ts`: cau hinh Prisma theo `DATABASE_URL`

## Gioi han hien tai

- Chua co Postgres integration that su
- Chua co DTO/validation/service layer
- Chua co endpoint update/delete/get by id
- Chua co ACL, upload version, workflow status update
- Chua co audit event publishing
