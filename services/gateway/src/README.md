# `services/gateway/src`

Thu muc nay chua source code runtime cua gateway.

## Cau truc hien tai

- `main.ts`
  - Bootstrap NestJS va expose Swagger
- `app.module.ts`
  - Dang ky `AuthModule`, `HttpModule` va controller
- `app.controller.ts`
  - Route `health`, `me`, `admin-only`
- `metadata.proxy.controller.ts`
  - Proxy request sang `metadata-service`
- `auth/`
  - JWT strategy va RBAC helper

## Ghi chu

Logic gateway hien tai van gon trong controller, phu hop muc demo skeleton hon la production-ready gateway.
