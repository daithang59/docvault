-- ============================================================================
-- Create a NON-SUPERUSER application role so Row-Level Security is enforced.
-- ============================================================================
-- RLS is bypassed by superuser / BYPASSRLS roles. The default `docvault` role
-- is a superuser, so RLS never applies when the app connects as it. The app
-- must instead connect as a restricted role at RUNTIME, while migrations/seed
-- keep using the owner role for DDL.
--
-- This script is idempotent and safe to re-run. Dev password is a fixture
-- (allowlisted in .gitleaks.toml); use a real secret outside dev.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'docvault_app') THEN
    CREATE ROLE docvault_app LOGIN PASSWORD 'docvault_app_pw';
  END IF;
END $$;

-- Explicitly ensure the role can NEVER bypass RLS.
ALTER ROLE docvault_app NOSUPERUSER NOBYPASSRLS;

-- Connect + schema usage.
GRANT CONNECT ON DATABASE docvault_metadata TO docvault_app;
GRANT USAGE ON SCHEMA public TO docvault_app;

-- DML on existing tables (no DDL — schema changes stay with the owner role).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO docvault_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO docvault_app;

-- Future tables created by the owner are auto-granted to the app role.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO docvault_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO docvault_app;
