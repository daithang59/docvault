# `services/metadata-service/src`

Thu muc nay chua source code runtime cua metadata-service.

## Cau truc hien tai

- `main.ts`
  - Bootstrap NestJS va Swagger
- `app.module.ts`
  - Dang ky `AuthModule`
- `app.controller.ts`
  - Chua toan bo route metadata demo hien co
- `app.service.ts`
  - File scaffold, hien khong duoc su dung
- `auth/`
  - JWT strategy va RBAC helper

## Ghi chu

Service nay hien chua tach service/repository layer. Phan lon nghiep vu dang nam trong controller de phuc vu muc demo nhanh.
