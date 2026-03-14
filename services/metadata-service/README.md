# Metadata Service

`metadata-service` la service metadata hien co trong DocVault. O trang thai hien tai, service nay da co xac thuc, phan quyen theo role, tach module cho documents va su dung Prisma/Postgres de luu metadata co ban.

## Da co gi trong implementation

- NestJS application voi Swagger tai `/docs`
- JWT verification bang Keycloak JWKS
- `RolesGuard` + `Roles` decorator
- `PrismaModule` + `PrismaService`
- `DocumentsModule` + `DocumentsService`
- Cac route cho metadata:
  - `GET /health`
  - `GET /me`
  - `GET /documents`
  - `POST /documents`
- Prisma schema, migration va `prisma.config.ts`
- Prisma schema va `prisma.config.ts` de dinh nghia huong ket noi Postgres ve sau

## Hanh vi API hien tai

| Method | Route | Mo ta | Role duoc phep |
|--------|------|-------|----------------|
| `GET` | `/health` | Health check | Public |
| `GET` | `/me` | Xem thong tin user tu token | Bat ky user da dang nhap |
| `GET` | `/documents` | Lay danh sach document demo | `viewer`, `editor`, `approver`, `co`, `admin` |
| `POST` | `/documents` | Tao document demo | `editor`, `admin` |

## Du lieu hien tai

Document da duoc doc/ghi qua Prisma tu bang `document_metadata`:

- `findAll()` sap xep theo `createdAt desc`
- `create()` luu `title`, `description`, `filename`, `contentType`, `ownerId`
- `ownerId` lay tu `username` trong token, fallback sang `sub`

Service da co layer rieng:

- controller trong `src/documents/documents.controller.ts`
- service trong `src/documents/documents.service.ts`
- DTO trong `src/documents/dto/create-document.dto.ts`

## Prisma va database

Folder `prisma/` da dinh nghia model `DocumentMetadata`, enum `DocumentStatus` va `prisma.config.ts`.

Dieu nay cho thay huong thiet ke da duoc dat nen va da duoc noi vao runtime o muc co ban:

- metadata dang luu o Postgres
- document co `objectKey` de lien ket ve object storage
- co versioning co ban
- co lifecycle status

Ngoai schema, folder `prisma/migrations/` da co migration tao bang `document_metadata`.

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
pnpm --filter metadata-service exec prisma migrate deploy
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
- `src/documents/`: module/controller/service cho metadata document
- `src/prisma/`: module/service ket noi Prisma
- `src/auth/`: JWT strategy, role decorator, role guard
- `prisma/schema.prisma`: model du lieu cho giai doan tiep theo
- `prisma.config.ts`: cau hinh Prisma theo `DATABASE_URL`

## Gioi han hien tai

- Chua co validation decorator tren DTO
- Chua co endpoint update/delete/get by id
- Chua co ACL, upload version, workflow status update
- Chua co audit event publishing
