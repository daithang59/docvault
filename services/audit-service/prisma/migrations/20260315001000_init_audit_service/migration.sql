CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS "audit_events" (
  "eventId" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "timestamp" timestamptz NOT NULL DEFAULT now(),
  "actorId" text NOT NULL,
  "actorRoles" text[] NOT NULL,
  "action" text NOT NULL,
  "resourceType" text NOT NULL,
  "resourceId" text,
  "result" text NOT NULL,
  "reason" text,
  "ip" text,
  "traceId" text
);

CREATE INDEX IF NOT EXISTS "audit_events_actorId_timestamp_idx"
  ON "audit_events" ("actorId", "timestamp");
CREATE INDEX IF NOT EXISTS "audit_events_action_timestamp_idx"
  ON "audit_events" ("action", "timestamp");
CREATE INDEX IF NOT EXISTS "audit_events_resource_idx"
  ON "audit_events" ("resourceType", "resourceId");
CREATE INDEX IF NOT EXISTS "audit_events_result_timestamp_idx"
  ON "audit_events" ("result", "timestamp");
