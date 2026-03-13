# DocVault — Web Microservices MVP

> **Scope:** Part 1 — Web Microservices (no DevSecOps yet).  
> **Goal:** A fully runnable E2E demo via `docker compose up`.

---

## Overview

DocVault is a document-vault platform built with a microservices architecture. It enforces **role-based access control (RBAC)** at the API level — not just in the UI — so that sensitive operations (e.g., download) are properly denied even when the frontend is bypassed.

### MVP E2E Flow

```
Editor   ──create doc + upload──► [Draft]
                                     │ submit
                                   [Pending]
Approver ────────────────approve──► [Published]
Viewer   ─────────────────────────► download ✅
CO       ──────────audit logs OK──► download ❌ (403 from backend)
```

The **"CO sees audit but is denied download"** scenario is the cornerstone demo requirement and is enforced at the **backend/gateway level**, not only hidden in the UI.

---

## Repo Structure

```
docvault/
  apps/
    web/                        # Next.js 14 + TypeScript frontend
  services/
    gateway/                    # JWT verify + routing + RBAC guard
    metadata-service/           # Source of truth: metadata, ACL, status (Postgres)
    document-service/           # Blob upload/download via MinIO
    workflow-service/           # State machine: Draft → Pending → Published
    audit-service/              # Append-only audit events + query (MongoDB)
    notification-service/       # REST notify on submit/approve (optional MVP)
  libs/
    contracts/                  # OpenAPI YAMLs + event schemas + generated types
    auth/                       # JWT helpers + role constants
  infra/
    docker-compose.dev.yml      # Full local dev stack
    keycloak/                   # Realm export, clients, roles, seed users
    db/                         # Postgres init/migration scripts
    minio/                      # Bucket + policy setup
  docs/
    README_CONTEXT.md           # Project context, architecture, API contracts
```

---

## Local Dev

> **Prerequisites:** Docker Desktop running.

```bash
# Start entire stack (Keycloak + Postgres + MinIO + MongoDB + all services + FE)
docker compose -f infra/docker-compose.dev.yml up

# First-time seed (Keycloak realm + users, MinIO bucket)
# (instructions TBD when infra scripts are ready)
```

### Definition of Done for local dev
- [ ] `docker compose up` runs without errors
- [ ] Login via Keycloak and receive a valid JWT
- [ ] Upload a file through Document Service → stored in MinIO
- [ ] Submit / Approve / Publish flow updates status correctly
- [ ] Viewer download succeeds; CO download returns **403**

---

## Demo Accounts

| Username  | Role                | Password   |
|-----------|---------------------|------------|
| `viewer1` | `viewer`            | `demo1234` |
| `editor1` | `editor`            | `demo1234` |
| `approver1` | `approver`        | `demo1234` |
| `co1`     | `compliance_officer`| `demo1234` |

> All accounts belong to Keycloak realm **`docvault`**.

---

## Services & Ports

| Service              | Port   | Notes                        |
|----------------------|--------|------------------------------|
| Gateway              | `8080` | All FE traffic routes here   |
| Metadata Service     | `8081` | Postgres-backed              |
| Document Service     | `8082` | MinIO-backed                 |
| Workflow Service     | `8083` | Stateless, calls Metadata    |
| Audit Service        | `8084` | MongoDB-backed               |
| Notification Service | `8085` | Optional MVP                 |
| Keycloak             | `9090` | Realm: `docvault`            |
| Postgres             | `5432` |                              |
| MinIO                | `9000` | Console: `9001`              |
| MongoDB              | `27017`| Audit storage                |
| Frontend (Next.js)   | `3000` |                              |

---

## RBAC Matrix

| Feature               | Viewer | Editor | Approver | Compliance Officer |
|-----------------------|:------:|:------:|:--------:|:------------------:|
| View published docs   | ✅     | ✅     | ✅       | ✅                 |
| **Download file**     | ✅     | ✅     | ✅       | ❌ **(always 403)**|
| Upload doc/version    | ❌     | ✅     | ✅ (opt) | ❌                 |
| Submit workflow       | ❌     | ✅     | ✅ (opt) | ❌                 |
| Approve / Reject      | ❌     | ❌     | ✅       | ❌                 |
| View audit logs       | ❌     | ❌     | ❌       | ✅                 |

> **⚠️ Enforcement is at the backend/gateway level.** Frontend only hides/shows UI elements.

---

## E2E Demo Script (Key Scenario)

```
1. editor1   → POST /documents            (create Draft)
2. editor1   → POST /documents/:id/upload (upload file)
3. editor1   → POST /workflow/:id/submit  (Draft → Pending)
4. approver1 → POST /workflow/:id/approve (Pending → Published)
5. viewer1   → GET  /documents/:id/download  → 200 OK ✅
6. co1       → GET  /audit/query             → 200 OK (audit logs) ✅
7. co1       → GET  /documents/:id/download  → 403 Forbidden ❌ ← KEY DEMO
```

> Step 7 must be **denied by the backend**, not merely hidden in the UI.

---

## Contributing

- All changes must go through a **Pull Request** to `main`.
- At least **1 approval** required before merge.
- Follow the service ownership defined in [CODEOWNERS](.github/CODEOWNERS).
- See the [PR template](.github/pull_request_template.md) for checklist.

---

## License

MIT