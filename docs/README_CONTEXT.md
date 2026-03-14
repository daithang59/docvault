# README_CONTEXT.md — DocVault (Part 1: Web Microservices MVP)

> Luu y: day la tai lieu context/ke hoach ban dau. De xem implementation hien tai cua repo, uu tien doc `docs/PROJECT_STATUS.md`.

> Scope hiện tại: **chỉ phần 1 — xây dựng web microservices** (chưa DevSecOps).  
> Mục tiêu: có **E2E demo flow** chạy local bằng Docker Compose.

---

## 1) MVP E2E Flow (bắt buộc demo được)

**Editor** tạo document + upload file → **Submit** (Pending) → **Approver** approve → **Published** → **Viewer** download.

**Compliance Officer**: xem **audit logs** OK, nhưng **bị deny download** (phải enforce ở backend, không phải chỉ ẩn nút ở frontend).

---

## 2) RBAC (tối thiểu)

Roles (Keycloak):
- `viewer`: xem metadata + download **Published** nếu policy allow
- `editor`: tạo document, upload version, submit workflow
- `approver`: approve/reject workflow
- `compliance_officer`: **audit:read**, **không được download file**

Permission rules cốt lõi:
- Download chỉ cho phép khi `status=Published` và user có quyền theo ACL/policy.
- Compliance Officer luôn bị deny download (dù status Published).

---

## 3) Kiến trúc Microservices (Service Boundaries)

Services (MVP):
1. **Gateway**: verify JWT + route requests.
2. **Metadata Service (Postgres)**: source of truth metadata + ACL + status.
3. **Document Service (MinIO)**: upload/download blob + version objects.
4. **Workflow Service**: state machine Draft→Pending→Published.
5. **Audit Service (MongoDB optional)**: append-only audit events + query.
6. **Notification Service (optional)**: notify submit/approve (REST trước, queue sau).

Nguyên tắc:
- Document Service **không** quyết định policy download (policy check nằm ở Gateway/Metadata).
- Workflow Service chỉ điều phối trạng thái, update status qua Metadata.
- Audit Service là nơi tập trung ghi “ai làm gì khi nào”.

---

## 4) Monorepo Structure (khuyến nghị)

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

Docker Compose tối thiểu:
- Keycloak
- Postgres (metadata)
- MinIO (document blobs)
- MongoDB (audit) *(tuỳ chọn)*
- services (gateway + microservices)
- apps/web

**Definition of Done**
- `docker compose up` chạy ổn
- login Keycloak lấy JWT
- upload file vào MinIO qua Document Service
- flow submit/approve/publish và download theo RBAC chạy đúng

---

## 6) API Contract Summary (agent-friendly)

> Tất cả FE gọi qua **Gateway**.  
> JWT role claims được đọc từ Keycloak.

### Metadata Service
- `POST /documents` → create Draft metadata
- `GET /documents/:id` → get document (policy-filtered fields)
- `GET /documents` → search list (filters: status/tag/owner)
- `POST /documents/:id/acl` → set ACL (editor/admin)
- `POST /documents/:id/version` → add version pointer (document-service gọi)
- `POST /documents/:id/status` → update status (workflow gọi)
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

## 7) Demo Script (vai trò và kịch bản)

Seed users:
- `viewer1` (role viewer)
- `editor1` (role editor)
- `approver1` (role approver)
- `co1` (role compliance_officer)

Demo steps:
1) editor1: create doc + upload + submit  
2) approver1: approve → published  
3) viewer1: download OK  
4) co1: xem audit OK; cố download → 403 (deny)

---

# DocVault_KeHoach.md — Kế hoạch triển khai Microservices (MVP)

## 0) Nguyên tắc làm MVP để nhanh “ra demo”
- Ưu tiên **REST sync** để flow chạy ổn trước.
- Event/Queue (RabbitMQ) chỉ thêm sau, cho audit/notify.
- Chốt states & RBAC sớm để tránh refactor tốn kém.

---

## 1) Setup repo + local env (Day 1–2)

### 1.1 Compose dev
Chạy: Keycloak + Postgres + MinIO + (MongoDB) + services.

**DoD**
- healthchecks ok
- Keycloak realm + roles + users seed được
- MinIO console + bucket sẵn
- Postgres migrations chạy

---

## 2) Contract-first (Day 2–3)

### 2.1 Entities MVP
**Document**
- `docId, ownerId, title, classification, tags[]`
- `status: Draft | Pending | Published`
- `currentVersion`

**Version**
- `version, objectKey, checksum, size, createdAt, createdBy`

**ACL**
- allow theo role/user/group (MVP có thể bắt đầu allow theo role + owner)

**AuditEvent**
- `eventId, actorId, actorRole, action, resourceType, resourceId, result, ip, timestamp`

### 2.2 RBAC rules
- Viewer: read + download Published allow
- Editor: create + upload + submit
- Approver: approve/reject
- Compliance Officer: audit read only; **deny download**

**DoD**
- OpenAPI YAML cho từng service ở `libs/contracts/openapi/`
- Shared schemas ở `libs/contracts/schemas/`

---

## 3) IAM + Gateway skeleton (Day 3–5)

### 3.1 Keycloak
- realm `docvault`
- roles: viewer/editor/approver/compliance_officer
- seed users

### 3.2 Gateway
- verify JWT (iss/aud/exp)
- routing
- RBAC guard cơ bản (endpoint-level)

**DoD**
- no token → 401
- wrong role → 403
- correct role → 200

---

## 4) Build theo thứ tự (Week 2)

### 4.1 Metadata Service (Postgres)
Chức năng:
- CRUD metadata
- store status + versions pointers
- policy check download/fields

Endpoints tối thiểu:
- `POST /documents`
- `GET /documents/:id`
- `GET /documents`
- `POST /documents/:id/version`
- `POST /documents/:id/status`
- `GET /documents/:id/download` (authorize)

**DoD**
- migrations chuẩn
- policy middleware chạy đúng
- compliance_officer download luôn 403

---

### 4.2 Document Service (MinIO)
Chức năng:
- upload multipart → MinIO
- checksum/size
- gọi metadata add version pointer

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
- submit/approve update status qua metadata

---

### 4.4 Audit Service
- ingest events
- query theo user/time/action
- CO-only access

Endpoints:
- `POST /audit/events`
- `GET /audit/query`

**DoD**
- CO query OK; others deny

---

### 4.5 Notification Service (optional)
MVP:
- workflow gọi REST notify, log console/email/Slack sau

**DoD**
- submit/approve tạo notify log

---

## 5) Checklist E2E Demo Ready (Week 3–4)
- RBAC đúng theo matrix
- audit coverage: upload, submit, approve, download allow/deny
- 1-click local demo: compose + seed + Postman collection

---

## 6) Timeline đề xuất (14 ngày)
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

# DocVault_KeHoachFE.md — Kế hoạch Frontend (MVP)

## 1) Stack FE
- Next.js 14 + TypeScript
- TailwindCSS + shadcn/ui
- TanStack Query + Zustand
- React Hook Form + Zod
- OIDC: keycloak-js hoặc oidc-client-ts

**DoD**
- login OIDC
- gọi API qua Gateway kèm Bearer token

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

## 3) RBAC UX matrix

| Feature | Viewer | Editor | Approver | Compliance Officer |
|---|---:|---:|---:|---:|
| View published docs | ✅ | ✅ | ✅ | ✅ |
| Download file | ✅ | ✅ | ✅ | ❌ |
| Upload doc/version | ❌ | ✅ | ✅ (opt) | ❌ |
| Submit workflow | ❌ | ✅ | ✅ (opt) | ❌ |
| Approve/Reject | ❌ | ❌ | ✅ | ❌ |
| View audit logs | ❌ | ❌ | ❌ | ✅ |

> FE chỉ ẩn/hiện; backend mới là enforcement chính.

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

## 5) UI theo màn (đủ demo)
- Documents list: search/filter/status badge
- Create+Upload: wizard 2 bước
- Detail: actions theo role & status
- Approvals: approve/reject modal
- Audit: filter time range/user/action + table

---

## 6) E2E tests (Playwright/Cypress)
1) Editor upload → submit → Approver approve → Viewer download OK  
2) Compliance Officer download → 403; audit query OK

---

## 7) Timeline FE (8 ngày)
- D1: scaffold + layout + env
- D2: OIDC + apiClient + route guard
- D3: documents list + detail read-only
- D4: create metadata + upload
- D5: submit + approvals
- D6: download flow + handle 403
- D7: audit page
- D8: polish + dockerfile + E2E
