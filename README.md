# DocVault

DocVault la mot monorepo cho MVP he thong luu tru tai lieu theo huong microservices. Trang thai hien tai cua repo la mot skeleton backend da co xac thuc JWT bang Keycloak, route protection theo role, metadata service da ket noi Prisma/Postgres o muc co ban, va bo ha tang local de phuc vu viec phat trien.

Tai lieu nay mo ta dung implementation hien co trong repo. Cac thanh phan nhu frontend, document-service, workflow-service, audit-service va notification-service moi duoc tao folder, chua co ma nguon van hanh.

## Da lam duoc gi

- Thiet lap monorepo bang `pnpm` workspace + `turbo`.
- Tao `gateway` va `metadata-service` bang NestJS.
- Tich hop xac thuc JWT voi Keycloak qua JWKS (`passport-jwt` + `jwks-rsa`).
- Tao RBAC co ban bang `Roles` decorator va `RolesGuard`.
- Gateway da proxy 2 API metadata:
  - `GET /metadata/documents`
  - `POST /metadata/documents`
- Metadata service da co API co ban cho document metadata:
  - `GET /health`
  - `GET /me`
  - `GET /documents`
  - `POST /documents`
- Bo sung Prisma schema, Prisma module/service va migration cho `metadata-service`.
- Tao stack local trong `infra/` cho Postgres, MongoDB, MinIO, MinIO init va Keycloak realm seed.
- Seed san realm `docvault`, client `docvault-gateway` va cac user demo trong Keycloak.
- Tao OpenAPI contract toi thieu cho gateway trong `libs/contracts/openapi/gateway.yaml`.

## Chua lam xong

- `apps/web` chua co frontend, hien chi co `.gitkeep`.
- `document-service`, `workflow-service`, `audit-service`, `notification-service` chua co source code.
- `metadata-service` moi co list/create metadata co ban, chua co CRUD day du, ACL, workflow hay upload.
- `docker-compose.dev.yml` hien chi khoi dong dependency infrastructure, chua khoi dong gateway, metadata-service hoac frontend.
- Root script `pnpm dev` chua kha dung vi cac package chua dinh nghia task `dev`, hien tai can chay tung service bang `start:dev`.

## Cau truc repo

```text
docvault/
  apps/
    web/                       # Placeholder cho frontend
  docs/
    PROJECT_STATUS.md          # Tai lieu tong hop implementation hien tai
    README_CONTEXT.md          # Context/roadmap ban dau
  infra/
    db/                        # Bootstrap SQL cho Postgres
    keycloak/                  # Realm export + user/role/client seed
    minio/                     # Script khoi tao bucket MinIO
    docker-compose.dev.yml     # Stack local cho dependency infrastructure
  libs/
    auth/                      # Placeholder cho thu vien auth dung chung
    contracts/                 # OpenAPI va event contract
  services/
    gateway/                   # API gateway, auth, proxy metadata
    metadata-service/          # Metadata service demo + Prisma schema
    document-service/          # Placeholder
    workflow-service/          # Placeholder
    audit-service/             # Placeholder
    notification-service/      # Placeholder
```

## Cach chay hien tai

### 1. Cai dependency

```bash
pnpm install
```

### 2. Khoi dong infrastructure

```bash
docker compose -f infra/docker-compose.dev.yml --env-file infra/.env up -d
```

Mac dinh se co:

- Keycloak: `http://localhost:8080`
- Postgres: `localhost:5432`
- MongoDB: `localhost:27017`
- MinIO API: `http://localhost:9000`
- MinIO Console: `http://localhost:9001`

### 3. Tao file env cho service

Sao chep:

- `services/gateway/.env.example` thanh `services/gateway/.env`
- `services/metadata-service/.env.example` thanh `services/metadata-service/.env`

### 4. Chay service

Ap migration cho metadata-service:

```bash
pnpm --filter metadata-service exec prisma migrate deploy
```

Sau do chay service:

```bash
pnpm --filter metadata-service start:dev
pnpm --filter gateway start:dev
```

Sau khi chay:

- Gateway Swagger: `http://localhost:3000/docs`
- Metadata Swagger: `http://localhost:3001/docs`

## Tai khoan demo Keycloak

Tat ca user nam trong realm `docvault` va dung password `Passw0rd!`.

| Username | Role |
|----------|------|
| `viewer1` | `viewer` |
| `editor1` | `editor` |
| `approver1` | `approver` |
| `co1` | `co` |
| `admin1` | `admin` |

## Tai lieu bo sung

- Xem tong hop implementation: [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)
- Xem chi muc tai lieu: [docs/README.md](docs/README.md)
- Xem context va roadmap ban dau: [docs/README_CONTEXT.md](docs/README_CONTEXT.md)

## License

MIT
