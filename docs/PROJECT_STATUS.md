# PROJECT_STATUS

Updated: 2026-03-17

This document reflects the current state of the repo based on runtime code in `apps/web`, `services/*`, `infra/*`, `libs/*`, and `scripts/e2e-check.mjs`, not just based on old markdown files.

## Project Summary

DocVault is currently a `pnpm` + `turbo` monorepo for secure, role-based document management.

The backend has been split into real running NestJS microservices:

- `gateway`
- `metadata-service`
- `document-service`
- `workflow-service`
- `audit-service`
- `notification-service`

The frontend is a real running Next.js application, no longer an empty scaffold. The web app now has login, dashboard, document list, document detail, create/edit documents, approvals, audit view, and settings screens.

Quick assessment of current status:

- Core MVP flows are implemented in the backend.
- Frontend covers most important user flows.
- Local development infrastructure has Postgres, MinIO, Keycloak.
- Shared library and contract layer is still thin.
- There are still some inconsistencies between documentation, UI, and runtime to clean up.

## Problem Being Solved

DocVault is a controlled document management system focused on:

- managing document metadata
- uploading and versioning document files
- orchestrating document lifecycle via workflow
- controlling file downloads via backend policy
- audit trail
- supporting compliance review while denying compliance officers the ability to download files

Roles currently used in code:

- `viewer`
- `editor`
- `approver`
- `compliance_officer`
- `admin`

The legacy Keycloak role `co` is normalized to `compliance_officer` in both backend and frontend.

## Monorepo Structure

- `apps/web`
  - Next.js 16 + React 19 frontend
- `services/gateway`
  - API gateway, JWT authentication, routing, context header forwarding
- `services/metadata-service`
  - document metadata, ACL, version pointer, workflow history, download authorization
- `services/document-service`
  - file upload/download via MinIO/S3
- `services/workflow-service`
  - validate workflow transitions and orchestration with metadata/audit/notification
- `services/audit-service`
  - write and query audit logs
- `services/notification-service`
  - notification sink for dev environment
- `infra`
  - Docker Compose for Postgres, MongoDB, MinIO, Keycloak
- `libs`
  - area for shared auth/contracts; currently at framework level only

## Current Runtime Architecture

### 1. Frontend

`apps/web` is a Next.js application using the following key components:

- App Router
- Axios
- TanStack Query
- React Hook Form
- Zod
- Tailwind CSS 4
- Radix UI

Existing screens:

- login
- dashboard
- documents list
- document detail
- new document
- edit document
- approvals
- audit
- settings

Frontend calls the gateway via the environment variable:

- `NEXT_PUBLIC_API_BASE_URL`
- defaults to `http://localhost:3000/api`

The login page currently supports 2 modes:

- demo login by role
- JWT token login

### 2. Gateway

`services/gateway` is the entry point at the system boundary. This service currently:

- authenticates JWT from Keycloak via JWKS
- checks roles at route level
- exposes `/health` and `/me`
- proxies requests to downstream services
- forwards the following headers:
  - `authorization`
  - `x-request-id`
  - `x-user-id`
  - `x-roles`

Route groups currently being proxied:

- `/metadata/*`
- `/documents/*`
- `/workflow/*`
- `/audit/*`
- `/notify`

### 3. Metadata Service

`services/metadata-service` is currently the source of truth for metadata and policy. This service owns:

- document record
- classification and tags
- `currentVersion`
- ACL entries
- workflow history
- download authorization logic

Current endpoints:

- `GET /documents`
- `GET /documents/:docId`
- `POST /documents`
- `PATCH /documents/:docId`
- `POST /documents/:docId/acl`
- `GET /documents/:docId/acl`
- `POST /documents/:docId/versions`
- `POST /documents/:docId/status`
- `GET /documents/:docId/workflow-history`
- `POST /documents/:docId/download-authorize`

### 4. Document Service

`services/document-service` currently owns blob file handling. This service:

- receives file uploads
- computes SHA-256 checksum
- generates object keys in format `doc/{docId}/v{n}/{filename}`
- uploads files to MinIO/S3
- calls metadata-service to register new version
- calls metadata-service to authorize download
- verifies grant token before issuing download permission
- supports both presigned URL and stream download

Current endpoints:

- `POST /documents/:docId/upload`
- `POST /documents/:docId/presign-download`
- `GET /documents/:docId/versions/:version/stream`

### 5. Workflow Service

`services/workflow-service` owns workflow status transition logic. This service:

- reads current status from metadata-service
- validates workflow transition
- updates status through metadata-service
- emits audit event
- calls notification-service

Current endpoints:

- `POST /workflow/:docId/submit`
- `POST /workflow/:docId/approve`
- `POST /workflow/:docId/reject`
- `POST /workflow/:docId/archive`

### 6. Audit Service

`services/audit-service` stores audit events in Postgres. This service:

- appends audit record
- supports query by actor/action/resource/result/time
- creates hash chain for tamper-evident audit

Current endpoints:

- `POST /audit/events`
- `GET /audit/query`

`GET /audit/query` is currently only accessible to `compliance_officer`.

### 7. Notification Service

`services/notification-service` is currently a simple sink. This service:

- receives `POST /notify`
- logs notification payload
- returns `{ accepted: true }`

It is not yet a full email/SMS/push system.

## Business Rules Currently in Code

### Metadata Access

All authenticated business roles can read metadata:

- list documents
- get document detail

This means ACL is not currently the primary control layer for metadata reads. ACL is most strongly used in download authorization.

### Ownership

For create/update/upload/version/ACL management, the system currently expects:

- `editor` to be the owner, or
- `admin`

Backend owner identity is currently built with the formula:

- `username ?? sub`

### Workflow

Transition map currently being enforced:

- `SUBMIT`: `DRAFT -> PENDING`
- `APPROVE`: `PENDING -> PUBLISHED`
- `REJECT`: `PENDING -> DRAFT`
- `ARCHIVE`: `PUBLISHED -> ARCHIVED`

Current side effects:

- `APPROVE` sets `publishedAt`
- `ARCHIVE` sets `archivedAt`
- each transition writes a row to `document_workflow_history`
- workflow action simultaneously emits an audit event

### Download Authorization

Current download flow is a two-step process:

1. metadata-service authorizes request and signs a short-lived grant token
2. document-service verifies token then returns presigned URL or stream

Current rules in code:

- only `PUBLISHED` documents can be downloaded
- `compliance_officer` is always blocked from downloading
- ACL `DENY` for `DOWNLOAD` permission blocks download
- ACL `ALLOW` can permit download
- document owner can download
- users with roles `viewer`, `editor`, `approver`, `admin` are currently considered to have default role access even without ACL `ALLOW`

Important consequence:

- ACL is currently functioning more like a deny/override layer for download, not a strict allow-list for all business roles

### Audit

Audit events are currently hash-linked using the formula:

- `hash = SHA-256(prevHash + "|" + canonicalPayload)`

This helps detect unauthorized modifications, but is not absolute immutability like a blockchain.

## Data Model Status

### Metadata DB

Prisma models currently used at runtime:

- `Document`
- `DocumentVersion`
- `DocumentAcl`
- `DocumentWorkflowHistory`

Important fields already present:

- `classification`
- `tags`
- `status`
- `currentVersion`
- `publishedAt`
- `archivedAt`

ACL schema supports subject types:

- `USER`
- `ROLE`
- `GROUP`
- `ALL`

ACL schema supports permissions:

- `READ`
- `DOWNLOAD`
- `WRITE`
- `APPROVE`

### Audit DB

Runtime model:

- `AuditEvent`

Important fields:

- actor info
- action
- resource info
- result
- reason
- trace id
- `prevHash`
- `hash`

## Frontend Status

The frontend is no longer at the level of a simple demo UI — it is now fairly tightly aligned with the MVP backend.

Implemented behaviors:

- login via demo role or JWT
- dashboard aggregating document status
- document list with client-side filter/search/sort
- create document and upload first file
- document detail page with:
  - versions card
  - workflow timeline
  - ACL panel
  - action panel
- approvals page for `PENDING` documents
- audit page for compliance users

Frontend permission helpers also model:

- create/edit/submit/archive for owner editor or admin
- approve/reject for approver or admin
- download only if document is published and not for compliance role
- ACL management for owner editor or admin

## Local Infrastructure Status

`infra/docker-compose.dev.yml` currently provides:

- Postgres
- MongoDB
- MinIO
- MinIO bucket init
- Keycloak

Notes:

- MongoDB is still in the compose but appears to no longer be used at current MVP runtime
- Postgres is used by metadata-service and audit-service
- MinIO is used by document-service
- Keycloak is used for JWT validation and local user seeding

## Build and Run Status

Tooling at root:

- package manager: `pnpm`
- task runner: `turbo`

Important scripts at root:

- `pnpm dev`
- `pnpm build`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`

All services currently have scripts for:

- `build`
- `start:dev`
- `test`

Prisma deploy script currently exists at:

- `metadata-service`
- `audit-service`

## Test and Verification Status

The repo has a reliable smoke test script at `scripts/e2e-check.mjs`.

This script covers the following main flows:

- requests without token are blocked
- expired token simulation is blocked
- viewer cannot create
- editor can create
- editor can upload
- viewer cannot download when document is draft
- editor can submit
- approver can approve
- double approve gets conflict
- viewer can download published document
- compliance officer can read metadata
- compliance officer cannot download files
- compliance officer can query audit
- viewer cannot query audit

Additionally, the repo has some unit tests per service, for example:

- transition tests in metadata status service
- hash-chain tests in audit service

## Shared Library and Contract Status

`libs/` is still in an early stage.

Current state:

- `libs/auth` is mostly just a README describing intent
- `libs/contracts/openapi/gateway.yaml` exists but is very minimal
- `libs/contracts/events` has directory structure only, no clear schema yet

Short conclusion:

- service boundaries are relatively clear at runtime
- but shared contracts and shared auth have not matured into a true shared package

## Current Gaps and Misalignments

### 1. Workflow history exists in metadata-service but gateway proxy is missing

Observed state:

- frontend calls `/metadata/documents/:docId/workflow-history`
- metadata-service has `GET /documents/:docId/workflow-history`
- gateway currently does not have the corresponding proxy route

Potential consequence:

- workflow timeline on the web may fail when going through gateway

### 2. ACL `GROUP` exists in schema and UI but policy download evaluation is missing

Observed state:

- Prisma schema supports `GROUP`
- ACL form on frontend allows selecting `GROUP`
- DTO allows `GROUP`
- `PolicyService.matchesAcl()` currently only handles:
  - `ALL`
  - `USER`
  - `ROLE`

Potential consequence:

- group-based download rules can be created but have no effect during authorization

### 3. Frontend owner check is misaligned with how backend stores owner

Observed state:

- backend stores owner/actor as `username ?? sub`
- frontend compares `doc.ownerId` with `session.user.sub`

Potential consequence:

- actions exclusive to owner like edit, upload, submit, archive, ACL management may be incorrectly hidden on UI with real Keycloak users

### 4. Archive permission is inconsistent between layers

Observed state:

- gateway `POST /workflow/:docId/archive` allows `approver` and `admin`
- workflow-service controller allows `editor` and `admin`
- workflow-service business logic actually only allows owner editor or admin

Potential consequence:

- approver may get past the gateway role layer but still be denied downstream
- runtime behavior and documentation can easily diverge

### 5. Documentation has not kept pace with runtime code

Observed state:

- `docs/PROJECT_STATUS.md` was a previous old snapshot
- `apps/web/README.md` is still the default Next.js README
- some markdown describes behavior different from current runtime

Potential consequence:

- source code is currently a more reliable source of truth than documentation in some areas

### 6. ACL is not yet a strict metadata-read control model

Observed state:

- all authenticated business roles can list/read metadata
- ACL is primarily applied to download authorization

Potential consequence:

- the system is currently closer to "metadata readable, files controlled" model than "everything ACL-gated"

### 7. Shared contract layer is still immature

Observed state:

- shared directory exists
- but most auth/contract logic is still duplicated across services instead of going through `libs`

Potential consequence:

- microservice boundaries are separated, but code reuse and contract hygiene are still not good

## Practical Conclusion

A one-sentence summary:

DocVault is currently a working MVP microservice for secure document lifecycle management, with a usable frontend and a backend with fairly clear boundary separation, but there are still several inconsistencies in contract, policy, ownership, and documentation to address before it can be considered production-ready.
