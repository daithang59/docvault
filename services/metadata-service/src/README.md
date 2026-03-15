# `services/metadata-service/src`

Thu muc nay chua source code runtime cua metadata-service.

## Cau truc hien tai

- `main.ts`
  - Bootstrap NestJS va Swagger
- `app.module.ts`
  - Dang ky `AuthModule`, `PrismaModule`, `DocumentsModule`
- `app.controller.ts`
  - Chua route `health` va `me`
- `app.service.ts`
  - File scaffold, hien khong duoc su dung
- `documents/`
  - Chua module/controller/service cho metadata document
- `prisma/`
  - Chua Prisma module/service
- `auth/`
  - JWT strategy va RBAC helper

## Ghi chu

Service nay da tach auth, documents va prisma thanh module rieng. Tuy nhien nghiep vu van moi o muc list/create co ban, chua co CRUD day du va validation chat che.
