# Trang Thai Thuc Te Cua Du An DocVault

Cap nhat theo codebase hien co trong repo tai thoi diem hien tai.

## 1. Muc tieu cua repo

DocVault huong toi mot he thong quan ly tai lieu theo mo hinh microservices, co xac thuc bang Keycloak va phan quyen theo role. Tuy nhien implementation hien tai moi o giai doan khoi tao backend va ha tang local, chua dat den day du flow document-vault trong tai lieu dinh huong ban dau.

## 2. Nhung gi da duoc implementation

### 2.1. Monorepo va tooling

- Repo dung `pnpm` workspace de quan ly package.
- `turbo.json` da khai bao task `build`, `lint`, `test`.
- Root `package.json` da co script cho `dev`, `build`, `lint`, `test`, `format`.
- Hien tai chi co 2 package thuc su nam trong workspace:
  - `services/gateway`
  - `services/metadata-service`

### 2.2. Infrastructure local

Thu muc `infra/` da co stack local cho:

- Postgres 16
- MongoDB 7
- MinIO + bucket init script
- Keycloak 26 voi realm import san

`docker-compose.dev.yml` hien moi khoi dong dependency infrastructure, chua khoi dong service cua ung dung.

### 2.3. Keycloak va IAM

File `infra/keycloak/realm-docvault.json` da seed:

- Realm: `docvault`
- Client confidential: `docvault-gateway`
- Direct access grants: bat
- Roles:
  - `viewer`
  - `editor`
  - `approver`
  - `co`
  - `admin`
- Users demo:
  - `viewer1`
  - `editor1`
  - `approver1`
  - `co1`
  - `admin1`

Tat ca user tren deu co password `Passw0rd!`.

### 2.4. Gateway service

`services/gateway` da co cac phan sau:

- Bootstrap NestJS + Swagger tai `/docs`
- JWT verification qua Keycloak JWKS
- Route `GET /health`
- Route `GET /me` de tra thong tin user da duoc resolve tu access token
- Route `GET /admin-only` de demo role-based authorization cho `admin`
- Metadata proxy controller:
  - `GET /metadata/documents` -> forward toi metadata-service
  - `POST /metadata/documents` -> forward toi metadata-service

Gateway hien da lam dung 2 vai tro chinh:

1. Xac thuc access token tu Keycloak
2. Chuyen tiep request metadata kem header `Authorization`

Han che hien tai:

- URL metadata-service dang hardcode thanh `http://localhost:3001`
- `KEYCLOAK_AUDIENCE` co trong file `.env.example` nhung chua duoc enforce trong strategy
- Chua co logging, validation, error mapping, rate limit

### 2.5. Metadata service

`services/metadata-service` da co:

- Bootstrap NestJS + Swagger tai `/docs`
- JWT verification qua Keycloak JWKS
- Role guard bang `RolesGuard`
- `PrismaModule` va `PrismaService`
- `DocumentsModule` tach rieng controller/service/dto
- Cac endpoint:
  - `GET /health`
  - `GET /me`
  - `GET /documents`
  - `POST /documents`

Logic hien tai:

- `GET /documents` doc du lieu tu bang `document_metadata` qua Prisma
- `POST /documents` tao ban ghi moi trong Postgres
- `GET /documents` cho phep cac role `viewer`, `editor`, `approver`, `co`, `admin`
- `POST /documents` chi cho `editor` va `admin`
- `ownerId` duoc gan tu `req.user.username` neu co, neu khong se fallback sang `sub`
- Co `CreateDocumentDto` cho payload tao metadata
- Da co migration khoi tao bang `document_metadata`

Han che hien tai:

- Chua co validation decorator tren DTO
- Chua co endpoint get-by-id, update, delete
- Chua co ACL, upload workflow, audit event, download authorization
- Chua co query/filter/pagination

### 2.6. Prisma schema va migration

`services/metadata-service/prisma/schema.prisma` da dinh nghia model `DocumentMetadata` voi:

- `id`
- `title`
- `description`
- `ownerId`
- `filename`
- `contentType`
- `objectKey`
- `status`
- `version`
- `createdAt`
- `updatedAt`

Enum `DocumentStatus` hien gom:

- `DRAFT`
- `PENDING_APPROVAL`
- `APPROVED`
- `REJECTED`
- `ARCHIVED`

Ngoai schema, service da co:

- `prisma.config.ts`
- `src/prisma/prisma.module.ts`
- `src/prisma/prisma.service.ts`
- migration `20260314091050_init_document_metadata`

Dieu nay cho thay metadata-service da di qua muc demo in-memory va da co persistence co ban bang Postgres + Prisma.

### 2.7. Contracts va tai lieu API

- `libs/contracts/openapi/gateway.yaml` da co OpenAPI toi thieu cho route `/health`
- Thu muc `libs/contracts/events/` da duoc tao nhung chua co event schema
- `docs/README_CONTEXT.md` dang mo ta context va roadmap ban dau, khong phan anh day du implementation hien tai

## 3. Nhung folder da duoc tao nhung chua co implementation

### 3.1. Frontend

- `apps/web/` moi co `.gitkeep`
- Chua co Next.js app, route, UI hay logic login

### 3.2. Cac service placeholder

Da co folder nhung chua co source code:

- `services/document-service`
- `services/workflow-service`
- `services/audit-service`
- `services/notification-service`

Nhung folder nay hien dong vai tro danh dau boundary cho kien truc du kien, khong phai implementation da hoan thanh.

### 3.3. Shared libs placeholder

- `libs/auth` chua co ma dung chung
- `libs/contracts/events` chua co file schema

## 4. Hanh vi phan quyen hien co

Role dang duoc dung trong code la:

- `viewer`
- `editor`
- `approver`
- `co`
- `admin`

RBAC hien tai da enforce duoc o 2 noi:

- Gateway:
  - `GET /admin-only` chi `admin`
- Metadata service:
  - `GET /documents`: `viewer|editor|approver|co|admin`
  - `POST /documents`: `editor|admin`

Luu y quan trong:

- Trong code hien tai role compliance officer duoc dat ten la `co`, khong phai `compliance_officer`
- Chua co logic "CO xem audit duoc nhung download bi 403" o runtime vi document-service, audit-service va luong download chua duoc implement

## 5. Cach chay va quan sat he thong

### 5.1. Khoi dong dependency

```bash
docker compose -f infra/docker-compose.dev.yml --env-file infra/.env up -d
```

### 5.2. Chay service

```bash
pnpm --filter metadata-service exec prisma migrate deploy
pnpm --filter metadata-service start:dev
pnpm --filter gateway start:dev
```

### 5.3. Xem Swagger

- Gateway: `http://localhost:3000/docs`
- Metadata service: `http://localhost:3001/docs`

### 5.4. Lay access token tu Keycloak

Vi client `docvault-gateway` dang bat direct access grants, co the lay token bang `curl`:

```bash
curl -X POST "http://localhost:8080/realms/docvault/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=docvault-gateway" \
  -d "client_secret=dev-gateway-secret" \
  -d "grant_type=password" \
  -d "username=editor1" \
  -d "password=Passw0rd!"
```

Sau do goi gateway:

```bash
curl http://localhost:3000/me -H "Authorization: Bearer <access_token>"
```

## 6. Khoang cach giua roadmap va implementation

Tai lieu cu trong repo mo ta mot MVP day du hon hien trang. Neu doi chieu voi codebase hien tai thi:

- Da co skeleton auth/RBAC va infra
- Da co metadata persistence co ban bang Prisma/Postgres
- Chua co flow upload file
- Chua co workflow Draft -> Pending -> Published
- Chua co audit service
- Chua co notification service
- Chua co frontend
- Chua co compose full stack cho toan bo ung dung

Noi cach khac, repo dang o giai doan "foundation + demo auth/metadata", chua phai "E2E document vault MVP hoan chinh".

## 7. Huong uu tien tiep theo neu tiep tuc phat trien

1. Bo sung get-by-id, update, delete va validation cho `metadata-service`.
2. Rut hardcode metadata URL khoi gateway va dua vao env.
3. Viet `document-service` de xu ly upload/download qua MinIO.
4. Bo sung workflow service va trang thai `Draft -> Pending -> Approved/Rejected`.
5. Bo sung audit service de thuc hien use case `co` xem audit.
6. Cap nhat test e2e theo route thuc te thay vi scaffold mac dinh cua Nest.

## 8. Tai lieu lien quan

- `README.md`: tong quan nhanh cua repo
- `docs/README.md`: muc luc tai lieu
- `docs/README_CONTEXT.md`: context va roadmap ban dau
