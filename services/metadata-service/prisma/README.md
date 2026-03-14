# `services/metadata-service/prisma`

Thu muc nay chua schema Prisma cua metadata-service.

## File hien co

- `schema.prisma`
  - Dinh nghia datasource PostgreSQL
  - Dinh nghia enum `DocumentStatus`
  - Dinh nghia model `DocumentMetadata`

## Trang thai hien tai

- Da co schema
- Chua co migration trong `prisma/migrations`
- Runtime chua goi Prisma Client

## Vai tro

Day la nen tang de chuyen metadata-service tu demo in-memory sang persistence that su voi Postgres.
