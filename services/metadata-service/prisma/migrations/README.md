# `services/metadata-service/prisma/migrations`

Thu muc nay chua migration cua Prisma.

## Trang thai hien tai

- Da co migration khoi tao `document_metadata`
- Co `migration_lock.toml` do Prisma quan ly

## Cach dung

Sau khi Postgres da chay, co the ap migration bang:

```bash
pnpm --filter metadata-service exec prisma migrate deploy
```
