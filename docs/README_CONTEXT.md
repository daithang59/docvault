# README_CONTEXT.md — DocVault (Part 1: Web Microservices MVP)

> **Note:** This is an initial context/planning document. For the current implementation, refer to `docs/PROJECT_STATUS.md`.

> Current scope: **Phase 1 only — web microservices build** (no DevSecOps yet).
> Goal: have an **E2E demo flow** running locally via Docker Compose.

---

## 1) MVP E2E Flow (must be demonstrable)

**Editor** creates document + uploads file → **Submit** (Pending) → **Approver** approves → **Published** → **Viewer** downloads.

**Compliance Officer**: view **audit logs** OK, but **download denied** (must be enforced at backend, not just hiding the button in the frontend).

---

## 2) RBAC (minimum)

Roles (Keycloak):
- `viewer`: view metadata + download **Published** if policy allows
- `editor`: create document, upload version, submit workflow
- `approver`: approve/reject workflow
- `compliance_officer`: **audit:read**, **cannot download files**

Core permission rules:
- Download only allowed when `status=Published` and user has permission via ACL/policy.
- Compliance Officer always denied download (even if status is Published).

---

## 3) Microservices Architecture (Service Boundaries)

Services (MVP):
1. **Gateway**: verify JWT + route requests.
2. **Metadata Service (Postgres)**: source of truth for metadata + ACL + status.
3. **Document Service (MinIO)**: upload/download blob + version objects.
4. **Workflow Service**: state machine Draft→Pending→Published.
5. **Audit Service (MongoDB optional)**: append-only audit events + query.
6. **Notification Service (optional)**: notify submit/approve (REST first, queue later).

Principles:
- Document Service **does not** decide download policy (policy check lives at Gateway/Metadata).
- Workflow Service only orchestrates status, updates status via Metadata.
- Audit Service is the central place to record "who did what when".

---

## 4) Monorepo Structure (recommended)

```text
docvault/
  apps/
    web/                       # Next.js FE (MVP)
  services/
    gateway/
    metadata-service/
    document-service/
    workflow-service/
    audit-service/
    notification-service/
  libs/
    contracts/                 # OpenAPI + event schemas + generated types
    auth/                      # JWT helpers + role constants
  infra/
    docker-compose.dev.yml
    keycloak/                  # realm export, clients, roles, seed users
    db/                        # init scripts
    minio/                     # buckets/policies
  docs/
    context/
      README_CONTEXT.md
      DocVault_KeHoach.md
      DocVault_KeHoachFE.md
```

---

## 5) Local Dev (docker compose)

Minimum Docker Compose:
- Keycloak
- Postgres (metadata)
- MinIO (document blobs)
- MongoDB (audit) *(optional)*
- services (gateway + microservices)
- apps/web

**Definition of Done**
- `docker compose up` runs cleanly
- login to Keycloak to get JWT
- upload file to MinIO via Document Service
- submit/approve/publish and download flow works correctly per RBAC

---

## 6) API Contract Summary (agent-friendly)

> All FE calls go through **Gateway**.
> JWT role claims are read from Keycloak.

### Metadata Service
- `POST /documents` → create Draft metadata
- `GET /documents/:id` → get document (policy-filtered fields)
- `GET /documents` → search list (filters: status/tag/owner)
- `POST /documents/:id/acl` → set ACL (editor/admin)
- `POST /documents/:id/version` → add version pointer (document-service calls)
- `POST /documents/:id/status` → update status (workflow calls)
- `GET /documents/:id/download` → authorize download (return presigned or stream proxy)

### Document Service
- `POST /documents/:id/upload` → multipart upload, store MinIO, call metadata version endpoint
- `GET /documents/:id/versions/:v/download` → create presigned or stream (internal)

### Workflow Service
- `POST /workflow/:docId/submit` → Draft→Pending (editor)
- `POST /workflow/:docId/approve` → Pending→Published (approver)
- `POST /workflow/:docId/reject` *(optional)* → Pending→Draft

### Audit Service
- `POST /audit/events` (internal ingest)
- `GET /audit/query?userId=&from=&to=&action=` (compliance_officer only)

### Notification Service *(optional MVP)*
- `POST /notify` (workflow calls)
- event types: submitted/approved/published

---

## 7) Demo Script (roles and scenarios)

Seed users:
- `viewer1` (role viewer)
- `editor1` (role editor)
- `approver1` (role approver)
- `co1` (role compliance_officer)

Demo steps:
1) editor1: create doc + upload + submit
2) approver1: approve → published
3) viewer1: download OK
4) co1: view audit OK; attempt download → 403 (deny)

---

# DocVault_KeHoach.md — Microservices MVP Implementation Plan

## 0) MVP Principles for Fast Demo

- Prioritize **REST sync** so the flow runs reliably first.
- Event/Queue (RabbitMQ) only added later, for audit/notify.
- Lock down states & RBAC early to avoid expensive refactoring.

---

## 1) Repo Setup + Local Env (Day 1–2)

### 1.1 Compose Dev
Run: Keycloak + Postgres + MinIO + (MongoDB) + services.

**DoD**
- healthchecks ok
- Keycloak realm + roles + users seeded
- MinIO console + bucket ready
- Postgres migrations run

---

## 2) Contract-First (Day 2–3)

### 2.1 MVP Entities
**Document**
- `docId, ownerId, title, classification, tags[]`
- `status: Draft | Pending | Published`
- `currentVersion`

**Version**
- `version, objectKey, checksum, size, createdAt, createdBy`

**ACL**
- allow by role/user/group (MVP can start with role + owner)

**AuditEvent**
- `eventId, actorId, actorRole, action, resourceType, resourceId, result, ip, timestamp`

### 2.2 RBAC Rules
- Viewer: read + download Published allowed
- Editor: create + upload + submit
- Approver: approve/reject
- Compliance Officer: audit read only; **deny download**

**DoD**
- OpenAPI YAML for each service in `libs/contracts/openapi/`
- Shared schemas in `libs/contracts/schemas/`

---

## 3) IAM + Gateway Skeleton (Day 3–5)

### 3.1 Keycloak
- realm `docvault`
- roles: viewer/editor/approver/compliance_officer
- seed users

### 3.2 Gateway
- verify JWT (iss/aud/exp)
- routing
- basic RBAC guard (endpoint-level)

**DoD**
- no token → 401
- wrong role → 403
- correct role → 200

---

## 4) Build in Order (Week 2)

### 4.1 Metadata Service (Postgres)
Functions:
- CRUD metadata
- store status + version pointers
- policy check for download/fields

Minimal endpoints:
- `POST /documents`
- `GET /documents/:id`
- `GET /documents`
- `POST /documents/:id/version`
- `POST /documents/:id/status`
- `GET /documents/:id/download` (authorize)

**DoD**
- standard migrations
- policy middleware runs correctly
- compliance_officer download always 403

---

### 4.2 Document Service (MinIO)
Functions:
- multipart upload → MinIO
- checksum/size
- call metadata to add version pointer

Endpoints:
- `POST /documents/:id/upload`
- `GET /documents/:id/versions/:v/download`

**DoD**
- upload & download works (download only via authorized path)

---

### 4.3 Workflow Service
State machine:
- Draft → Pending → Published

Endpoints:
- `POST /workflow/:docId/submit`
- `POST /workflow/:docId/approve`
- `POST /workflow/:docId/reject` (optional)

**DoD**
- submit/approve update status via metadata

---

### 4.4 Audit Service
- ingest events
- query by user/time/action
- CO-only access

Endpoints:
- `POST /audit/events`
- `GET /audit/query`

**DoD**
- CO query OK; others denied

---

### 4.5 Notification Service (optional)
MVP:
- workflow calls REST notify, log console/email/Slack later

**DoD**
- submit/approve creates notify log

---

## 5) E2E Demo-Ready Checklist (Week 3–4)
- RBAC correct per matrix
- audit coverage: upload, submit, approve, download allow/deny
- 1-click local demo: compose + seed + Postman collection

---

## 6) Proposed Timeline (14 days)
- D1: monorepo + compose + healthchecks
- D2: contracts + schemas + migrations skeleton
- D3: keycloak realm/roles/users
- D4: gateway verify + routing
- D5–6: metadata service
- D7–8: document service
- D9–10: workflow service
- D11: audit service
- D12: notification service (optional)
- D13: E2E + Postman collection + demo script
- D14: hardening (validation/error codes/audit completeness)

---

# DocVault_KeHoachFE.md — Frontend Plan (MVP)

## 1) FE Stack
- Next.js 14 + TypeScript
- TailwindCSS + shadcn/ui
- TanStack Query + Zustand
- React Hook Form + Zod
- OIDC: keycloak-js or oidc-client-ts

**DoD**
- OIDC login
- call API via Gateway with Bearer token

---

## 2) Pages/Routes (MVP)
Public:
- `/login`
- `/callback`

Authenticated:
- `/` dashboard
- `/documents` list + filter
- `/documents/new` create metadata + upload
- `/documents/[id]` detail + versions + actions
- `/approvals` pending approvals
- `/audit` (CO only)

---

## 3) RBAC UX Matrix

| Feature | Viewer | Editor | Approver | Compliance Officer |
|---|---:|---:|---:|---:|
| View published docs | ✅ | ✅ | ✅ | ✅ |
| Download file | ✅ | ✅ | ✅ | ❌ |
| Upload doc/version | ❌ | ✅ | ✅ (opt) | ❌ |
| Submit workflow | ❌ | ✅ | ✅ (opt) | ❌ |
| Approve/Reject | ❌ | ❌ | ✅ | ❌ |
| View audit logs | ❌ | ❌ | ❌ | ✅ |

> FE only shows/hides; backend is the primary enforcement.

---

## 4) FE Integration Plan
- `GET /metadata/documents`
- `POST /metadata/documents`
- `POST /document/documents/:id/upload`
- `GET /metadata/documents/:id`
- `POST /workflow/:docId/submit`
- `POST /workflow/:docId/approve|reject`
- `GET /metadata/documents/:id/download`
- `GET /audit/query` (CO)

---

## 5) UI Per Screen (enough for demo)
- Documents list: search/filter/status badge
- Create+Upload: 2-step wizard
- Detail: actions per role & status
- Approvals: approve/reject modal
- Audit: filter time range/user/action + table

---

## 6) E2E Tests (Playwright/Cypress)
1) Editor upload → submit → Approver approve → Viewer download OK
2) Compliance Officer download → 403; audit query OK

---

## 7) FE Timeline (8 days)
- D1: scaffold + layout + env
- D2: OIDC + apiClient + route guard
- D3: documents list + detail read-only
- D4: create metadata + upload
- D5: submit + approvals
- D6: download flow + handle 403
- D7: audit page
- D8: polish + dockerfile + E2E
