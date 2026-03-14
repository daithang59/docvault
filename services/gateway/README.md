# Gateway Service

`gateway` la diem vao API hien tai cua DocVault. Service nay chiu trach nhiem xac thuc JWT tu Keycloak, enforce mot phan RBAC va proxy request sang `metadata-service`.

## Da co gi trong implementation

- NestJS application voi Swagger tai `/docs`
- JWT strategy dung JWKS cua Keycloak
- `RolesGuard` + `Roles` decorator
- Cac endpoint noi bo:
  - `GET /health`
  - `GET /me`
  - `GET /admin-only`
- Cac endpoint proxy:
  - `GET /metadata/documents`
  - `POST /metadata/documents`

## Cac endpoint hien co

| Method | Route | Mo ta | Bao ve |
|--------|------|-------|--------|
| `GET` | `/health` | Health check cua gateway | Public |
| `GET` | `/me` | Tra user resolve tu access token | JWT |
| `GET` | `/admin-only` | Demo route chi cho admin | JWT + role `admin` |
| `GET` | `/metadata/documents` | Proxy sang metadata-service | JWT |
| `POST` | `/metadata/documents` | Proxy tao document | JWT |

## Bien moi truong

Tham khao file `.env.example`:

```env
PORT=3000
KEYCLOAK_BASE_URL=http://localhost:8080
KEYCLOAK_REALM=docvault
KEYCLOAK_AUDIENCE=docvault-gateway
```

Luu y:

- `KEYCLOAK_AUDIENCE` hien duoc khai bao nhung chua duoc kiem tra trong `JwtStrategy`
- URL metadata-service dang hardcode trong controller la `http://localhost:3001`

## Cach chay

Tu root repo:

```bash
pnpm --filter gateway start:dev
```

Hoac trong chinh folder nay:

```bash
pnpm start:dev
```

Swagger mac dinh:

```text
http://localhost:3000/docs
```

## Cac file quan trong

- `src/main.ts`: bootstrap app va Swagger
- `src/app.controller.ts`: health, me, admin-only
- `src/metadata.proxy.controller.ts`: forward request sang metadata-service
- `src/auth/`: JWT strategy, role decorator, role guard

## Gioi han hien tai

- Chua co gateway routing cho document/workflow/audit/notification
- Chua co config service hoac env cho upstream URL
- Chua co validation, logging middleware, exception mapping
- Chua co test e2e dung voi route hien tai
