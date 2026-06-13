-- ============================================================================
-- Stage 2: FORCE Row-Level Security — ONLY run after verification
-- ============================================================================
-- Run enable-rls.sql FIRST. Then, ONLY once you have:
--   1. Wired the app to set `app.current_org` per request (withOrgContext)
--   2. Verified with a live Postgres that cross-org reads return empty
--      and same-org reads work normally
-- ...run this to make RLS apply even to the table OWNER (the connection
-- Prisma uses). This is what actually enforces isolation at the DB layer.
--
-- WARNING: If the app is NOT setting app.current_org on every transaction
-- before running this, queries WITHOUT context still pass (policies allow
-- NULL context), but any query that sets a WRONG/empty org will see no rows.
-- Do not run this in production until staged verification passes.
--
-- To roll back: ALTER TABLE <t> NO FORCE ROW LEVEL SECURITY;
-- ============================================================================

ALTER TABLE "documents" FORCE ROW LEVEL SECURITY;
ALTER TABLE "document_saved_views" FORCE ROW LEVEL SECURITY;
ALTER TABLE "document_versions" FORCE ROW LEVEL SECURITY;
ALTER TABLE "document_acl" FORCE ROW LEVEL SECURITY;
ALTER TABLE "document_workflow_history" FORCE ROW LEVEL SECURITY;
ALTER TABLE "document_comments" FORCE ROW LEVEL SECURITY;
ALTER TABLE "document_share_links" FORCE ROW LEVEL SECURITY;
