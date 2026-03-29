# Running the Project Locally

Updated: 2026-03-18

This document is a guide for running DocVault on a local machine based on the current code state.

## 1. Requirements

- Node.js 20+
- `pnpm` 9+
- Docker Desktop or Docker Engine + Docker Compose
- Free ports:
  - `3000` gateway
  - `3001` metadata-service
  - `3002` document-service
  - `3003` workflow-service
  - `3004` audit-service
  - `3005` notification-service
  - `3100` frontend web — use this port to avoid conflicts with backend
  - `5432` Postgres
  - `5555` Prisma Studio (PostgreSQL GUI)
  - `8080` Keycloak
  - `8081` MongoDB Express (MongoDB GUI)
  - `9000` MinIO API
  - `9001` MinIO Console

## 2. Install Dependencies

Run from the repo root:

```bash
pnpm install
```

## 3. Start Infrastructure

The local infra is in `infra/docker-compose.dev.yml`.

```bash
docker compose -f infra/docker-compose.dev.yml --env-file infra/.env up -d
```

This starts:

- Postgres
- MongoDB
- MongoDB Express (GUI for MongoDB)
- MinIO
- MinIO init job
- Keycloak

Note:

- MongoDB stores audit logs (audit-service uses MongoDB instead of PostgreSQL).
- If you already have an old Postgres volume from the proto-microservices phase, you should delete the old volume or recreate the database before migrating.

## 4. Create Environment Files

Create the following files by copying from `.env.example`:

- `services/gateway/.env`
- `services/metadata-service/.env`
- `services/document-service/.env`
- `services/workflow-service/.env`
- `services/audit-service/.env`
- `services/notification-service/.env`
- `apps/web/.env.local`

Default values in the repo already match the local stack:

- gateway: `http://localhost:3000`
- metadata-service: `http://localhost:3001`
- document-service: `http://localhost:3002`
- workflow-service: `http://localhost:3003`
- audit-service: `http://localhost:3004`
- notification-service: `http://localhost:3005`
- Keycloak: `http://localhost:8080`
- MinIO: `http://localhost:9000`

Important frontend variables:

```env
NEXT_PUBLIC_APP_NAME=DocVault
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
```

## 5. Run Migrations

After Postgres is up:

```bash
pnpm --filter metadata-service prisma:deploy
pnpm --filter audit-service prisma:deploy
```

### View Data (GUI)

With Docker infra running, you can open GUI tools to inspect data directly:

**PostgreSQL — Prisma Studio** (metadata-service):

```bash
pnpm --filter metadata-service prisma:studio
```

Open: http://localhost:5555

View 4 tables: `documents`, `document_versions`, `document_acl`, `document_workflow_history`.

**MongoDB — MongoDB Express**:

Open: http://localhost:8081

Login: `mongoadmin` / `mongoadminpw`

## 6. Start Backend

Recommended: run each service in a separate terminal in this order:

```bash
pnpm --filter metadata-service start:dev
pnpm --filter audit-service start:dev
pnpm --filter document-service start:dev
pnpm --filter notification-service start:dev
pnpm --filter workflow-service start:dev
pnpm --filter gateway start:dev
```

Backend URLs after startup:

- Gateway Swagger: `http://localhost:3000/docs`
- Metadata Swagger: `http://localhost:3001/docs`
- Document Swagger: `http://localhost:3002/docs`
- Workflow Swagger: `http://localhost:3003/docs`
- Audit Swagger: `http://localhost:3004/docs`
- Notification Swagger: `http://localhost:3005/docs`

Quick health check:

- `http://localhost:3000/health`
- `http://localhost:3001/health`
- `http://localhost:3002/health`
- `http://localhost:3003/health`
- `http://localhost:3004/health`
- `http://localhost:3005/health`

## 7. Start Frontend

The frontend should run separately on port `3100` to avoid conflicts with:

- gateway `3000`
- metadata-service `3001`
- remaining backend services `3002` to `3005`

Run:

```bash
pnpm --filter web dev -- --port 3100
```

Open:

- `http://localhost:3100`

Login page:

- `http://localhost:3100/login`

## 8. Login and Sample Users

Password for all seeded users:

- `Passw0rd!`

Available users:

- `viewer1`
- `editor1`
- `approver1`
- `co1`
- `admin1`

The frontend currently supports 2 login modes:

- Demo Login
  - good for quickly viewing UI/role guards
- JWT Token
  - use real token from Keycloak to go through the full backend

Keycloak local:

- `http://localhost:8080`

## 9. Quick Smoke Test

After all backend is running, you can run the E2E smoke test:

```bash
pnpm test:e2e
```

This script checks the main flows:

- unauthorized requests are blocked
- viewer cannot create
- editor can create/upload/submit
- approver can approve
- viewer can download file after publish
- compliance officer can query audit but cannot download files

## 10. Quick Run Mode and Notes

Root script currently has:

```bash
pnpm dev
```

However, this script runs the entire workspace through Turbo, including `apps/web`. Since web defaults to port `3000`, it may conflict with the gateway if you don't change the port.

Current recommendation:

- run backend services separately as in step 6
- run frontend separately as in step 7 on port `3100`

## 11. Common Errors

### Postgres Migration Error

Check:

- Postgres container is healthy
- database `docvault_metadata` and `docvault_audit` have been initialized
- old volume is not holding onto old schema

### Frontend API Call Error

Check:

- `apps/web/.env.local` points to correct `NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api`
- gateway is running on port `3000`
- frontend is open on `3100`, not `3000` or `3001`

### Cannot Get Keycloak Token

Check:

- Keycloak is up at `http://localhost:8080`
- realm `docvault` has been imported
- client secret in docs and `.env` matches the current seed

## 12. Related Documents

- `README.md`
- `docs/demo-flow.md`
- `docs/demo-users.md`
- `docs/PROJECT_STATUS.md`
- `infra/README.md`
- `services/README.md`
