CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

SELECT 'CREATE DATABASE docvault_audit WITH ENCODING ''UTF8'' LC_COLLATE ''C'' LC_CTYPE ''C''
WHERE NOT EXISTS (
  SELECT 1 FROM pg_database WHERE datname = 'docvault_audit'
)\gexec

\connect docvault_audit
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\connect docvault_metadata

SELECT 'CREATE DATABASE docvault_metadata WITH ENCODING ''UTF8'' LC_COLLATE ''C'' LC_CTYPE ''C''
WHERE NOT EXISTS (
  SELECT 1 FROM pg_database WHERE datname = 'docvault_metadata'
)\gexec

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS _bootstrap (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at timestamptz NOT NULL DEFAULT now()
);
