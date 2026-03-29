# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo Setup

- **Package manager**: pnpm 9+, **Node.js**: 18+
- **Build orchestrator**: Turbo (configured in `turbo.json`)
- **Workspaces**: `apps/*`, `services/*`, `libs/*`

## Commands

```bash
# Start all services simultaneously (does not enforce startup order — see below)
pnpm dev

# Build all (follows turbo dependency order)
pnpm build

# Lint all
pnpm lint

# Test all
pnpm test

# Run a specific service
pnpm --filter <service-name> start:dev
# Example: pnpm --filter gateway start:dev

# Run a specific test file in a service
pnpm --filter <service-name> test -- --testPathPattern=foo.spec.ts

# Prisma migration (run after Docker infra is healthy)
pnpm --filter metadata-service prisma:deploy

# Prisma Studio — GUI for PostgreSQL data (run when Docker infra is running)
pnpm --filter metadata-service prisma:studio

# Migrate audit logs from PostgreSQL → MongoDB (run while audit-service is STOPPED)
pnpm --filter audit-service migrate:to-mongo

# E2E verification script (run when all services + infra are running)
pnpm test:e2e

# Format code (Prettier)
pnpm format

# One-command sequential startup (requires Docker infra already running)
pnpm start:sequential
```

## Architecture Overview

### Request Flow

```
Client → Gateway (:3000) → Backend Services (:3001–:3005)
                      ↓
            JWT verification (Keycloak JWKS)
            Role-based routing
            Audit event emission
```

### Gateway (`services/gateway/`)

- **Single entry point** for all clients. JWT authentication happens here before proxying to services.
- `src/proxy/` — Each backend service has a corresponding proxy controller:
  - `metadata.proxy.controller.ts` → `:3001/api`
  - `documents.proxy.controller.ts` → `:3002/api`
  - `workflow.proxy.controller.ts` → `:3003/api`
  - `audit.proxy.controller.ts` → `:3004/api`
  - `notify.proxy.controller.ts` → `:3005/api`
- `src/auth/` — JWT strategy, roles guard, roles decorator shared across the entire gateway.
- **No business logic here** — only routing, auth, and audit wrapper.

### Backend Services (NestJS)

| Service | Port | Primary Role | Database |
|---|---|---|---|
| `metadata-service` | 3001 | Metadata, ACL, status, history | PostgreSQL (Prisma) |
| `document-service` | 3002 | File upload/download, MinIO S3 | — |
| `workflow-service` | 3003 | State machine DRAFT→PENDING→PUBLISHED→ARCHIVED | — |
| `audit-service` | 3004 | Audit log with SHA-256 hash chain | MongoDB (Mongoose) |
| `notification-service` | 3005 | Notifications | — |

### Auth Flow (important)

Every service uses `@nestjs/passport` + `passport-jwt` + `jwks-rsa` to self-verify JWTs directly with Keycloak. Gateway does **not** pass tokens down to backend services — each service verifies independently. Roles: `viewer`, `editor`, `approver`, `compliance_officer`, `admin`.

### Enforcing Access

- **ACL metadata** is checked in `metadata-service/src/acl/`
- **File download** is checked in `metadata-service/src/policy/policy.service.ts`
  - **Special rule**: `compliance_officer` is **always denied** file downloads regardless of ACL — logic lives in `policy.service.ts`, not at the gateway or document-service.
- **Archive** is only allowed for editors who own the document or admins.

### Document Lifecycle

```
DRAFT → PENDING → PUBLISHED → ARCHIVED
```

- Editor submits → `workflow-service` calls `metadata-service` to change status, then calls `notification-service`.
- Approver approves/rejects → `workflow-service` updates status.
- Services communicate via **Axios HTTP** (no message queue).

### Prisma Schema

- `metadata-service/prisma/schema.prisma` — 4 tables: `documents`, `document_versions`, `document_acl`, `document_workflow_history`.
- Generated client lives in `generated/prisma/` — **do not edit manually**.

### MongoDB Schema

- `audit-service/src/mongo/audit-event.schema.ts` — Mongoose schema for `audit_events` collection. SHA-256 hash chain is fully recalculated at runtime.

### libs/contracts

- `libs/contracts/openapi/gateway.yaml` — Full OpenAPI 3.0 spec for all endpoints (metadata, documents, workflow, audit, notify).
- `libs/contracts/events/` — Directory for event schemas (currently empty).

### libs/auth

- `libs/auth/` — Shared auth primitives for all services:
  - `JwtStrategy` — Passport strategy Keycloak JWKS + RS256
  - `RolesGuard` + `Roles()` — Role-based access control
  - `AuthModule` — NestJS module re-export
  - `ServiceUser`, `RequestContext`, `buildActorId()`, `buildRequestContext()` — Shared types & helpers
  - `ROLES`, `READER_ROLES` — Canonical role constants
- **Migration**: All 6 services still have inline auth files; should migrate to use `@docvault/auth`.

## Infrastructure

- Docker Compose: `infra/docker-compose.dev.yml` — PostgreSQL, MinIO, Keycloak.
- Keycloak realm seed: `infra/keycloak/` — realm definitions and seed users.
- MinIO: endpoint `:9000`, console `:9001`.
- Keycloak: `:8080`, realm `docvault`, client `docvault-gateway`.

## Startup Order

**Important**: Gateway must start **last**, after all backend services are ready. Use `pnpm start:sequential` (recommended) or do it manually:

### Using `pnpm start:sequential`
```bash
pnpm start:sequential                    # fast — skips migrations
RUN_PRISMA_DEPLOY=1 pnpm start:sequential  # with Prisma migrations
```

### Manual
1. Docker infra (PostgreSQL, MinIO, Keycloak, MongoDB)
2. `pnpm --filter metadata-service prisma:deploy` (MongoDB does not need migration)
3. Backend services: metadata → document → workflow → notification → audit
4. Gateway
5. Frontend (`apps/web/` — Next.js on port 3010)

> `migrate:to-mongo` is a one-time migration from PostgreSQL → MongoDB for old audit logs; run while audit-service is **stopped**.

## First-time Setup (after clone)

```bash
# 1. Copy environment files (not tracked by git)
cp .env.example .env

# 2. Install dependencies
pnpm install

# 3. Generate Prisma client
pnpm --filter metadata-service prisma:generate

# 4. Apply database migrations
pnpm --filter metadata-service prisma:deploy

# 5. Seed sample data
pnpm --filter metadata-service db:seed

# 6. Start all services
pnpm start:sequential
```
