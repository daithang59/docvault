# `services/metadata-service/prisma`

Thu muc nay chua schema Prisma cua metadata-service.

## File hien co

- `schema.prisma`
  - Dinh nghia datasource PostgreSQL
  - Dinh nghia enum `DocumentStatus`
  - Dinh nghia model `DocumentMetadata`

## Trang thai hien tai

- Da co schema
- Da co migration trong `prisma/migrations`
- Runtime da goi Prisma Client qua `PrismaService`

## Vai tro

Day la noi dinh nghia schema va migration cho persistence that su cua metadata-service voi Postgres.
