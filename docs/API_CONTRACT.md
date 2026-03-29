# DocVault — Gateway Endpoint Table & Response DTOs

> Base URL: `http://localhost:3000/api`
> All requests must include header: `Authorization: Bearer <keycloak_jwt>`

---

## 1. Documents — Metadata

### GET `/metadata/documents` — Document List
**Roles:** viewer, editor, approver, compliance_officer, admin

**Query params:** _(none currently, sorted by createdAt desc)_

**Response `200`:**
```jsonc
[
  {
    "id": "uuid",
    "title": "string",
    "description": "string | null",
    "ownerId": "string",
    "classification": "PUBLIC | INTERNAL | CONFIDENTIAL | SECRET",
    "tags": ["string"],
    "status": "DRAFT | PENDING | PUBLISHED | ARCHIVED",
    "currentVersion": 0,
    "publishedAt": "ISO8601 | null",
    "archivedAt": "ISO8601 | null",
    "createdAt": "ISO8601",
    "updatedAt": "ISO8601"
  }
]
```

---

### GET `/metadata/documents/:docId` — Document Detail
**Roles:** viewer, editor, approver, compliance_officer, admin

**Response `200`:**
```jsonc
{
  "id": "uuid",
  "title": "string",
  "description": "string | null",
  "ownerId": "string",
  "classification": "PUBLIC | INTERNAL | CONFIDENTIAL | SECRET",
  "tags": ["string"],
  "status": "DRAFT | PENDING | PUBLISHED | ARCHIVED",
  "currentVersion": 1,
  "publishedAt": "ISO8601 | null",
  "archivedAt": "ISO8601 | null",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601",
  "versions": [
    {
      "id": "uuid",
      "docId": "uuid",
      "version": 1,
      "objectKey": "doc/{docId}/v1/filename.pdf",
      "checksum": "string",
      "size": 102400,
      "filename": "filename.pdf",
      "contentType": "application/pdf | null",
      "createdAt": "ISO8601",
      "createdBy": "string"
    }
  ],
  "aclEntries": [
    {
      "id": "uuid",
      "docId": "uuid",
      "subjectType": "USER | ROLE | GROUP | ALL",
      "subjectId": "string | null",
      "permission": "READ | DOWNLOAD | WRITE | APPROVE",
      "effect": "ALLOW | DENY",
      "createdAt": "ISO8601"
    }
  ]
}
```

---

### POST `/metadata/documents` — Create New Document
**Roles:** editor, admin

**Request body:**
```jsonc
{
  "title": "string",          // required
  "description": "string",     // optional
  "classification": "PUBLIC | INTERNAL | CONFIDENTIAL | SECRET", // optional, default INTERNAL
  "tags": ["string"]          // optional, max 50 tags
}
```

**Response `201`:** (Document object — same as list item, tags sanitized)

---

### PATCH `/metadata/documents/:docId` — Update Metadata
**Roles:** editor (must be owner), admin

**Request body:** _(all fields optional)_
```jsonc
{
  "title": "string",
  "description": "string",
  "classification": "PUBLIC | INTERNAL | CONFIDENTIAL | SECRET",
  "tags": ["string"]
}
```

**Response `200`:** Updated Document object

---

### GET `/metadata/documents/:docId/workflow-history` — Workflow History
**Roles:** viewer, editor, approver, compliance_officer, admin

**Response `200`:**
```jsonc
[
  {
    "id": "uuid",
    "docId": "uuid",
    "fromStatus": "DRAFT | PENDING | PUBLISHED",
    "toStatus": "PENDING | PUBLISHED | ARCHIVED | DRAFT",
    "action": "SUBMIT | APPROVE | REJECT | ARCHIVE",
    "actorId": "string",
    "reason": "string | null",
    "createdAt": "ISO8601"
  }
]
```

---

### POST `/metadata/documents/:docId/acl` — Upsert ACL Rule
**Roles:** editor, admin

**Request body:**
```jsonc
{
  "subjectType": "USER | ROLE | GROUP | ALL",
  "subjectId": "string",   // userId / roleName / groupName (null if ALL)
  "permission": "READ | DOWNLOAD | WRITE | APPROVE",
  "effect": "ALLOW | DENY"
}
```

**Response `200 | 201`:** ACL Entry object

---

### GET `/metadata/documents/:docId/acl` — View ACL List
**Roles:** editor, approver, compliance_officer, admin

**Response `200`:** Array of ACL Entry objects

---

### POST `/metadata/documents/:docId/download-authorize` — Request Download Permission
**Roles:** viewer, editor, approver, admin _(compliance_officer denied)_

**Request body:** _(optional)_
```jsonc
{
  "version": 1   // optional, defaults to currentVersion
}
```

**Response `200`:**
```jsonc
{
  "docId": "uuid",
  "version": 1,
  "objectKey": "doc/{docId}/v1/filename.pdf",
  "filename": "filename.pdf",
  "contentType": "application/pdf | null",
  "expiresInSeconds": 300,
  "expiresAt": "ISO8601",
  "grantToken": "base64url.signature"
}
```
> **FE uses this `grantToken` to call `/documents/:docId/presign-download` or `/stream`.**

**Response `403`:** When compliance_officer calls, or document is not yet PUBLISHED:
```jsonc
{ "statusCode": 403, "message": "Only published documents can be downloaded" }
```

---

## 2. Documents — Blob (MinIO)

### POST `/documents/:docId/upload` — Upload File
**Roles:** editor, admin
**Content-Type:** `multipart/form-data`

**Form field:** `file` — binary file

**Response `201`:**
```jsonc
{
  "docId": "uuid",
  "version": 1,
  "filename": "filename.pdf",
  "size": 102400,
  "checksum": "sha256hex",
  "objectKey": "doc/{docId}/v1/filename.pdf",
  "contentType": "application/pdf"
}
```

---

### POST `/documents/:docId/presign-download` — Get Presigned URL
**Roles:** viewer, editor, approver, admin _(compliance_officer denied)_

**Request body:**
```jsonc
{
  "grantToken": "base64url.signature",   // required, from download-authorize
  "version": 1                           // optional
}
```

**Response `200`:**
```jsonc
{
  "url": "https://minio.example.com/docvault/doc/{docId}/v1/file.pdf?X-Amz-...",
  "expiresAt": "ISO8601"
}
```

---

### GET `/documents/:docId/versions/:version/stream` — Stream File Directly
**Roles:** viewer, editor, approver, admin

**Response headers:**
- `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename="file.pdf"`

**Response `200`:** Binary stream (file)

---

## 3. Workflow

### POST `/workflow/:docId/submit` — Submit (DRAFT → PENDING)
**Roles:** editor, admin

**Response `200`:** Document object with `status: "PENDING"`

---

### POST `/workflow/:docId/approve` — Approve (PENDING → PUBLISHED)
**Roles:** approver, admin

**Response `200`:** Document object with `status: "PUBLISHED"`, `publishedAt: "ISO8601"`

---

### POST `/workflow/:docId/reject` — Reject (PENDING → DRAFT)
**Roles:** approver, admin

**Request body:**
```jsonc
{
  "reason": "string"   // optional, reason for rejection
}
```

**Response `200`:** Document object with `status: "DRAFT"`

---

### POST `/workflow/:docId/archive` — Archive (PUBLISHED → ARCHIVED)
**Roles:** approver, admin

> _Gateway proxy does not yet have this endpoint — needs to be added to `workflow.proxy.controller.ts`_

**Response `200`:** Document object with `status: "ARCHIVED"`, `archivedAt: "ISO8601"`

---

## 4. Audit

### GET `/audit/query` — Query Audit Logs
**Roles:** compliance_officer

**Query params:**
| Param | Type | Description |
|---|---|---|
| `actorId` | string | Filter by performing user |
| `action` | string | Filter by action (e.g. `DOCUMENT_SUBMIT`) |
| `resourceType` | string | Filter by resource type (e.g. `DOCUMENT`) |
| `resourceId` | string | Document UUID |
| `result` | string | `SUCCESS` or `DENY` |
| `from` | ISO8601 | Start time |
| `to` | ISO8601 | End time |
| `limit` | int (1-200) | Number of records, default 100 |

**Response `200`:**
```jsonc
[
  {
    "eventId": "uuid",
    "timestamp": "ISO8601",
    "actorId": "string",
    "actorRoles": ["viewer", "editor"],
    "action": "DOCUMENT_CREATED | DOCUMENT_SUBMIT | DOCUMENT_APPROVE | DOCUMENT_ARCHIVE | DOCUMENT_DOWNLOAD_AUTHORIZED | ...",
    "resourceType": "DOCUMENT",
    "resourceId": "uuid",
    "result": "SUCCESS | DENY",
    "reason": "string | null",
    "ip": "string | null",
    "traceId": "string | null",
    "prevHash": "hex | null",
    "hash": "hex"
  }
]
```

---

## Endpoint Summary Table

| Method | Gateway path | Roles | Description |
|---|---|---|---|
| GET | `/metadata/documents` | all | Document list |
| POST | `/metadata/documents` | editor, admin | Create new doc |
| GET | `/metadata/documents/:docId` | all | Doc detail + versions + ACL |
| PATCH | `/metadata/documents/:docId` | editor (owner), admin | Edit metadata |
| GET | `/metadata/documents/:docId/workflow-history` | all | Workflow history |
| POST | `/metadata/documents/:docId/acl` | editor, admin | Upsert ACL rule |
| GET | `/metadata/documents/:docId/acl` | editor, approver, CO, admin | View ACL |
| POST | `/metadata/documents/:docId/download-authorize` | all (CO denied) | Request grant token |
| POST | `/documents/:docId/upload` | editor, admin | Upload file |
| POST | `/documents/:docId/presign-download` | viewer, editor, approver, admin | Presigned URL |
| GET | `/documents/:docId/versions/:version/stream` | viewer, editor, approver, admin | Stream file |
| POST | `/workflow/:docId/submit` | editor, admin | DRAFT → PENDING |
| POST | `/workflow/:docId/approve` | approver, admin | PENDING → PUBLISHED |
| POST | `/workflow/:docId/reject` | approver, admin | PENDING → DRAFT |
| POST | `/workflow/:docId/archive` | approver, admin | PUBLISHED → ARCHIVED ⚠️ |
| GET | `/audit/query` | compliance_officer | Query audit log |

> ⚠️ **Archive endpoint has not been added to gateway proxy yet.** Needs to be added to `workflow.proxy.controller.ts`.

---

## Error Response Format

```jsonc
{
  "statusCode": 400 | 401 | 403 | 404 | 409,
  "message": "string or string[]",
  "error": "string"
}
```

| Code | Situation |
|---|---|
| 401 | Missing / invalid / expired JWT |
| 403 | Wrong role or ACL denied |
| 404 | DocId does not exist |
| 409 | Conflict (e.g. approving an already published doc) |
| 400 | Invalid request body |
