# `services/metadata-service/src/prisma`

Thu muc nay chua phan ket noi Prisma o runtime.

## File hien co

- `prisma.module.ts`
  - Dang ky `PrismaService` o muc global
- `prisma.service.ts`
  - Extend `PrismaClient`
  - Tu dong `connect()` khi module khoi tao

## Vai tro

Day la layer ha tang de cac module nghiep vu co the truy cap Postgres thong qua Prisma.
