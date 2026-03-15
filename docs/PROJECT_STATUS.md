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

## ERD MVP Sync (Latest Updates)

The codebase has been successfully synchronized with the updated MVP ERD:
- **Metadata-Service**: 
  - `Document` model now supports `tags` (with GIN indexing) and `ClassificationLevel` enum.
  - New `document_workflow_history` table automatically records state transitions.
  - ACL supports `GROUP` subject types.
  - New endpoints: `GET /documents/:docId/workflow-history`
- **Workflow-Service**: 
  - Added transition guards validating states (`DRAFT` → `PENDING` → `PUBLISHED` → `ARCHIVED`).
  - Added `archive` capability: `POST /workflow/:docId/archive`.
- **Audit-Service**: 
  - Improved data integrity by implementing a **Tamper-evident Hash Chain** log structure. `hash = SHA-256(prevHash + payload)`.

## Local ops summary

- Infra: `docker compose -f infra/docker-compose.dev.yml --env-file infra/.env.example up -d postgres` (Requires PostgreSQL database to be running for Prisma migrations)
- Metadata migration: `cd services/metadata-service && npx prisma migrate dev --name sync_erd_mvp`
- Audit migration: `cd services/audit-service && npx prisma migrate dev --name add_hash_chain`
- Build: `pnpm build`
- Custom Node Test: `npx ts-node services/metadata-service/src/test-flow.ts`

See the root [README](../README.md) for full architecture, use cases, sequence flows, demo, and migration notes.
