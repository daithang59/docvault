# REFACTOR_SUMMARY.md

Updated: 2026-03-15

This document summarizes the changes made when refactoring DocVault from a "proto-microservice" state to a proper microservices MVP with clear boundaries.

## 1. Goals Addressed

- Extracted blob upload/download/presign logic out of `metadata-service`
- Extracted workflow state machine submit/approve/reject into a separate service
- Extracted audit ingest/query append-only into a separate service
- Created minimal `notification-service` for MVP
- Expanded `gateway` into a proper entrypoint for all services
- Kept JWT Keycloak, route-level RBAC, and compliance policy download enforcement at the backend

## 2. New Boundaries After Refactor

### gateway

- Verify JWT by issuer/audience/expiration
- Full routing:
  - `/api/metadata/**`
  - `/api/documents/**`
  - `/api/workflow/**`
  - `/api/audit/**`
  - `/api/notify/**`
- Forward:
  - `X-Request-Id`
  - `X-User-Id`
  - `X-Roles`
- Emit audit wrapper events:
  - `REQUEST_RECEIVED`
  - `REQUEST_OK`
  - `REQUEST_DENIED`

### metadata-service

Retained:

- document metadata CRUD
- ACL
- status pointer
- version pointer registration
- download authorization / policy check

Removed:

- MinIO upload/download
- presigned URL generation
- workflow transition logic
- audit persistence/query logic

Key endpoints:

- `POST /documents`
- `GET /documents`
- `GET /documents/:docId`
- `PATCH /documents/:docId`
- `POST /documents/:docId/acl`
- `GET /documents/:docId/acl`
- `POST /documents/:docId/versions`
- `POST /documents/:docId/status`
- `POST /documents/:docId/download-authorize`

### document-service

Owns:

- MinIO/S3 client
- multipart upload
- checksum SHA-256
- object key `doc/{docId}/v{n}/{filename}`
- presign download
- direct stream download

Key endpoints:

- `POST /documents/:docId/upload`
- `POST /documents/:docId/presign-download`
- `GET /documents/:docId/versions/:version/stream`

After upload, the service calls metadata-service to write the version pointer.

### workflow-service

Owns:

- workflow state machine MVP
- transition validation
- role/status/owner check
- call metadata-service to update status
- call audit-service and notification-service

MVP transitions:

- `DRAFT -> PENDING` via `submit`
- `PENDING -> PUBLISHED` via `approve`
- `PENDING -> DRAFT` via `reject`

Key endpoints:

- `POST /workflow/:docId/submit`
- `POST /workflow/:docId/approve`
- `POST /workflow/:docId/reject`

### audit-service

Owns:

- append-only ingest
- query by actor/time/action/resource/result
- role gate for query

Key endpoints:

- `POST /audit/events`
- `GET /audit/query`

`GET /audit/query` is only accessible to `compliance_officer`.

### notification-service

Owns:

- `POST /notify`
- dev mode logs to console
- event types:
  - `SUBMITTED`
  - `APPROVED`
  - `REJECTED`

## 3. Roles and Policy

Roles currently in use:
- `viewer`
- `editor`
- `approver`
- `compliance_officer`
- `admin` still kept for local admin tasks

- `co` in Keycloak is aliased to `compliance_officer` to not break the old seed
- `compliance_officer` can view audit but always denied file downloads
- Viewer can only download when document is `PUBLISHED`

## 4. Data Model and Migration

### Metadata DB

Runtime tables:

- `documents`
- `document_versions`
- `document_acl`

New migration:

- `services/metadata-service/prisma/migrations/20260315000000_refactor_microservices_boundary`

### Audit DB

New database:

- `docvault_audit`

Runtime table:

- `audit_events`

New migration:

- `services/audit-service/prisma/migrations/20260315001000_init_audit_service`

### Infra

- `infra/db/init-postgres.sql` updated to create `docvault_audit`
- `uuid-ossp` enabled for both `docvault_metadata` and `docvault_audit`
- `infra/keycloak/realm-docvault.json` updated so `co1` has additional role `compliance_officer`

## 5. Logging, Validation, Error Contract

All new/refactored services received:

- Swagger/OpenAPI
- DTO validation (`class-validator`)
- standard error response via global exception filter
- structured JSON log with:
  - `traceId`
  - `service`
  - `route`
  - `actorId`
  - `action`
  - `result`
  - `latencyMs`

## 6. Scripts and Documentation Added/Updated

### Scripts

- `scripts/demo.sh`
- `scripts/e2e-check.mjs`

`scripts/e2e-check.mjs` covers the main cases:

- no token -> 401
- expired-like token -> 401
- viewer create -> 403
- editor create -> 201
- upload -> object in MinIO
- viewer download DRAFT -> 403
- submit -> `PENDING`
- approve -> `PUBLISHED`
- approve again -> 409
- viewer published download -> 200
- compliance officer download -> 403
- compliance officer audit query -> 200
- viewer audit query -> 403

### Documentation

- `README.md`
- `docs/PROJECT_STATUS.md`
- `docs/README.md`
- Per-service README updated from placeholder to actual boundary details

## 7. Important Files/Classes Changed

- gateway:
  - added `src/proxy/*`
  - added gateway-level audit wrapper in `src/main.ts`
- metadata-service:
  - removed `src/storage/*`
  - removed old audit persistence
  - added `src/acl/*`, `src/status/*`, `src/versions/*`, `src/policy/*`
- document-service:
  - created full source code for storage, metadata client, audit client, upload/download module
- workflow-service:
  - created full source code for workflow, metadata/audit/notification client
- audit-service:
  - created full source code + Prisma schema/migration
- notification-service:
  - created full source code for notify endpoint

## 8. Verified

Successfully ran:

- `pnpm build`
- `pnpm test`
- `node --check scripts/e2e-check.mjs`
- `docker compose -f infra/docker-compose.dev.yml --env-file infra/.env.example up -d`
- `pnpm --filter metadata-service prisma:deploy`
- `pnpm --filter audit-service prisma:deploy`
- `node scripts/e2e-check.mjs`

Live E2E cases passed:

- no token -> `401`
- expired-like token -> `401`
- viewer create -> `403`
- editor create -> `201`
- upload -> object appears in MinIO
- viewer download DRAFT -> `403`
- submit -> `PENDING`
- approve -> `PUBLISHED`
- approve again -> `409`
- viewer published download -> `200`
- compliance officer download -> `403`
- compliance officer audit query -> `200`
- viewer audit query -> `403`

## 9. Practical Notes

- Workspace can build, lint, and run live E2E passing
- During runtime bring-up, several infrastructure/code issues had to be fixed:
  - Prisma client of `metadata-service` and `audit-service` were overwriting each other in the workspace
  - JWT verification needed to be compatible with Keycloak tokens that have `azp` instead of `aud`
  - downstream `403/409` from metadata was being swallowed as `500` in intermediate services
  - some services were missing ESLint configuration entirely despite having `lint` scripts declared

If needed, this file can serve as an implementation changelog for PR or checkpoint.
