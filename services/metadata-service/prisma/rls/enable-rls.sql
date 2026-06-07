-- ============================================================================
-- Row-Level Security (RLS) for DocVault multi-tenancy — DEFENSE IN DEPTH
-- ============================================================================
-- This is a MANUAL, OPT-IN script. It is intentionally NOT placed under
-- prisma/migrations so it is never auto-applied by `prisma migrate deploy`.
-- App-layer organizationId filtering (in metadata-service) remains the
-- PRIMARY isolation mechanism; RLS is a second layer at the database itself.
--
-- HOW IT STAYS SAFE
-- -----------------
-- 1. The table OWNER bypasses RLS unless FORCE ROW LEVEL SECURITY is set.
--    If Prisma connects as the table owner (the common dev/default case),
--    running this script has NO functional effect until you opt into FORCE.
-- 2. Policies also allow rows when the request context is unset
--    (current_setting('app.current_org', true) IS NULL), so unwired queries
--    and system jobs keep working during a staged rollout.
--
-- STAGED ROLLOUT
-- --------------
--   Stage 1 (this script): enable RLS + policies. Safe, reversible, no-op for
--           the owner. Verify the app still behaves normally.
--   Stage 2 (later, with Docker/Postgres to verify): wire the app to set
--           `app.current_org` per request via withOrgContext(), confirm
--           cross-org reads return empty, THEN run enable-rls-force.sql.
--
-- The session variable is set per transaction by the app:
--   SET LOCAL app.current_org = '<organizationId>';
-- ============================================================================

-- ── documents ──────────────────────────────────────────────────────────────
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS documents_org_isolation ON "documents";
CREATE POLICY documents_org_isolation ON "documents"
  USING (
    current_setting('app.current_org', true) IS NULL
    OR "organizationId" = current_setting('app.current_org', true)
  )
  WITH CHECK (
    current_setting('app.current_org', true) IS NULL
    OR "organizationId" = current_setting('app.current_org', true)
  );

-- ── document_saved_views ─────────────────────────────────────────────────────
ALTER TABLE "document_saved_views" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS saved_views_org_isolation ON "document_saved_views";
CREATE POLICY saved_views_org_isolation ON "document_saved_views"
  USING (
    current_setting('app.current_org', true) IS NULL
    OR "organizationId" = current_setting('app.current_org', true)
  )
  WITH CHECK (
    current_setting('app.current_org', true) IS NULL
    OR "organizationId" = current_setting('app.current_org', true)
  );

-- ── Child tables (joined via docId) — isolate via parent document's org ──────
-- These have no organizationId column; they inherit isolation by requiring the
-- parent document to be visible under the same org context.
DO $$
DECLARE
  child TEXT;
  children TEXT[] := ARRAY[
    'document_versions',
    'document_acl',
    'document_workflow_history',
    'document_comments',
    'document_share_links'
  ];
BEGIN
  FOREACH child IN ARRAY children LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', child);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', child || '_org_isolation', child);
    EXECUTE format($f$
      CREATE POLICY %I ON %I
        USING (
          current_setting('app.current_org', true) IS NULL
          OR EXISTS (
            SELECT 1 FROM "documents" d
            WHERE d.id = %I."docId"
              AND d."organizationId" = current_setting('app.current_org', true)
          )
        );
    $f$, child || '_org_isolation', child, child);
  END LOOP;
END $$;
