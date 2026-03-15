CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

SELECT 'CREATE DATABASE docvault_audit'
WHERE NOT EXISTS (
  SELECT 1 FROM pg_database WHERE datname = 'docvault_audit'
)\gexec

\connect docvault_audit
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\connect docvault_metadata
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS _bootstrap (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at timestamptz NOT NULL DEFAULT now()
);
