# PROJECT_STATUS.md

Updated: 2026-03-15

This file reflects the post-refactor state of the repo.

## Current status

- `gateway`, `metadata-service`, `document-service`, `workflow-service`, `audit-service`, and `notification-service` all contain real NestJS source code.
- `metadata-service` no longer owns MinIO upload/download, workflow transitions, or audit persistence/query.
- `document-service` owns MinIO upload/checksum/presign/stream and registers version pointers back to metadata.
- `workflow-service` owns `submit`, `approve`, `reject` and updates status through metadata.
- `audit-service` owns append-only audit ingest/query.
- `notification-service` owns `POST /notify` and logs dev notifications.
- `gateway` routes all service prefixes under `/api/*`, verifies JWT, propagates request/user headers, and emits route-level audit wrapper events.

## Role behavior

- `viewer`: can list/view metadata and download only after publish
- `editor`: can create metadata, upload blobs, submit workflow
- `approver`: can approve/reject
- `compliance_officer`: can query audit, can read metadata, can never download
- `admin`: kept for local admin convenience

## Required MVP flows

- Happy path:
  - editor create metadata
  - editor upload
  - editor submit
  - approver approve
  - viewer download published document
- Compliance path:
  - compliance officer audit query succeeds
  - compliance officer metadata read succeeds
  - compliance officer download authorization fails
  - compliance officer direct download fails

## Local ops summary

- Infra: `docker compose -f infra/docker-compose.dev.yml --env-file infra/.env.example up -d`
- Metadata migration: `pnpm --filter metadata-service prisma:deploy`
- Audit migration: `pnpm --filter audit-service prisma:deploy`
- Build: `pnpm build`
- E2E script: `pnpm test:e2e`

See the root [README](../README.md) for full architecture, sequence flows, demo, and migration notes.
