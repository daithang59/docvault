# Row-Level Security (RLS) — DocVault multi-tenancy

RLS is a **second line of defense** for tenant isolation at the PostgreSQL
layer. The **primary** mechanism remains app-layer `organizationId` filtering
in metadata-service (every query is org-scoped, covered by tests). RLS protects
against a missed filter or direct DB access.

## Files

- `prisma/rls/enable-rls.sql` — enable RLS + policies (safe, reversible, no-op
  for the table owner until forced).
- `prisma/rls/enable-rls-force.sql` — Stage 2: `FORCE ROW LEVEL SECURITY` so
  policies apply even to the owner (the connection Prisma uses).

## How isolation works

The app sets a transaction-scoped session variable per request:

```sql
SELECT set_config('app.current_org', '<organizationId>', true);  -- SET LOCAL
```

Policies allow a row when **either** the context is unset (NULL) **or** the
row's `organizationId` matches `app.current_org`. Child tables (versions, acl,
workflow history, comments, share links) inherit isolation by requiring their
parent document to be visible under the same context.

Use the helper in `PrismaService`:

```ts
await prisma.withOrgContext(orgId, async (tx) => {
  return tx.document.findMany({ where: { /* ... */ } });
});
```

`SET LOCAL` is transaction-scoped, so the value never leaks between requests
sharing a pooled connection.

## Why it's safe to enable in stages

1. The table **owner bypasses RLS** unless `FORCE ROW LEVEL SECURITY` is set.
   If Prisma connects as the owner (default), `enable-rls.sql` has **no
   functional effect** until you opt into FORCE.
2. Policies allow rows when the context is unset, so unwired queries and
   system jobs (retention cron, trash purge) keep working during rollout.

## Staged rollout (requires a live Postgres to verify)

1. **Apply policies:** `psql "$DATABASE_URL" -f prisma/rls/enable-rls.sql`.
   Verify the app behaves exactly as before (RLS is a no-op for the owner).
2. **Wire context:** route org-scoped reads/writes through
   `prisma.withOrgContext(orgId, ...)`. Confirm with two orgs that cross-org
   reads return empty and same-org reads work.
3. **Force:** `psql "$DATABASE_URL" -f prisma/rls/enable-rls-force.sql`.
   Now isolation is enforced at the DB even for the owner connection.

## Rollback

```sql
ALTER TABLE "documents" NO FORCE ROW LEVEL SECURITY;   -- undo Stage 2
ALTER TABLE "documents" DISABLE ROW LEVEL SECURITY;    -- undo Stage 1
-- repeat per table
```

## Status

- Policies + force scripts: written, **not** auto-applied (not under migrations).
- `withOrgContext` helper: implemented + unit-tested (param-safe, tx-scoped).
- DB-level enforcement: **not yet activated** — requires Docker/Postgres to
  verify the staged rollout before enabling in any real environment.
