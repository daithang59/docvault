# DocVault — Bảng Endpoint Gateway & Response DTOs

> Base URL: `http://localhost:3000/api`  
> Tất cả request phải gửi header: `Authorization: Bearer <keycloak_jwt>`

---

## 1. Documents — Metadata

### GET `/metadata/documents` — Danh sách tài liệu
**Roles:** viewer, editor, approver, compliance_officer, admin

**Query params:** _(none hiện tại, sorted by createdAt desc)_

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

### GET `/metadata/documents/:docId` — Chi tiết tài liệu
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

### POST `/metadata/documents` — Tạo tài liệu mới
**Roles:** editor, admin

**Request body:**
```jsonc
{
  "title": "string",          // bắt buộc
  "description": "string",   // tùy chọn
  "classification": "PUBLIC | INTERNAL | CONFIDENTIAL | SECRET", // tùy chọn, default INTERNAL
  "tags": ["string"]         // tùy chọn, tối đa 50 tags
}
```

**Response `201`:** (Document object — như list item nhưng tags đã sanitize)

---

### PATCH `/metadata/documents/:docId` — Cập nhật metadata
**Roles:** editor (phải là owner), admin

**Request body:** _(mọi field đều tùy chọn)_
```jsonc
{
  "title": "string",
  "description": "string",
  "classification": "PUBLIC | INTERNAL | CONFIDENTIAL | SECRET",
  "tags": ["string"]
}
```

**Response `200`:** Document object đã cập nhật

---

### GET `/metadata/documents/:docId/workflow-history` — Lịch sử workflow
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

### POST `/metadata/documents/:docId/acl` — Upsert ACL rule
**Roles:** editor, admin

**Request body:**
```jsonc
{
  "subjectType": "USER | ROLE | GROUP | ALL",
  "subjectId": "string",   // userId / roleName / groupName (null nếu ALL)
  "permission": "READ | DOWNLOAD | WRITE | APPROVE",
  "effect": "ALLOW | DENY"
}
```

**Response `200 | 201`:** ACL Entry object

---

### GET `/metadata/documents/:docId/acl` — Xem danh sách ACL
**Roles:** editor, approver, compliance_officer, admin

**Response `200`:** Array of ACL Entry objects

---

### POST `/metadata/documents/:docId/download-authorize` — Xin phép download
**Roles:** viewer, editor, approver, admin _(compliance_officer bị deny)_

**Request body:** _(tùy chọn)_
```jsonc
{
  "version": 1   // tùy chọn, default là currentVersion
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
> **FE dùng `grantToken` này để gọi tiếp `/documents/:docId/presign-download` hoặc `/stream`.**

**Response `403`:** Khi compliance_officer gọi, hoặc document chưa PUBLISHED:
```jsonc
{ "statusCode": 403, "message": "Only published documents can be downloaded" }
```

---

## 2. Documents — Blob (MinIO)

### POST `/documents/:docId/upload` — Upload file
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

### POST `/documents/:docId/presign-download` — Lấy presigned URL
**Roles:** viewer, editor, approver, admin _(compliance_officer bị deny)_

**Request body:**
```jsonc
{
  "grantToken": "base64url.signature",   // bắt buộc, lấy từ download-authorize
  "version": 1                           // tùy chọn
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

### GET `/documents/:docId/versions/:version/stream` — Stream file trực tiếp
**Roles:** viewer, editor, approver, admin

**Headers trả về:**
- `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename="file.pdf"`

**Response `200`:** Binary stream (file)

---

## 3. Workflow

### POST `/workflow/:docId/submit` — Submit (DRAFT → PENDING)
**Roles:** editor, admin

**Response `200`:** Document object có `status: "PENDING"`

---

### POST `/workflow/:docId/approve` — Approve (PENDING → PUBLISHED)
**Roles:** approver, admin

**Response `200`:** Document object có `status: "PUBLISHED"`, `publishedAt: "ISO8601"`

---

### POST `/workflow/:docId/reject` — Reject (PENDING → DRAFT)
**Roles:** approver, admin

**Request body:**
```jsonc
{
  "reason": "string"   // tùy chọn, lý do reject
}
```

**Response `200`:** Document object có `status: "DRAFT"`

---

### POST `/workflow/:docId/archive` — Archive (PUBLISHED → ARCHIVED)
**Roles:** approver, admin

> _Gateway proxy chưa có endpoint này — cần thêm vào `workflow.proxy.controller.ts`_

**Response `200`:** Document object có `status: "ARCHIVED"`, `archivedAt: "ISO8601"`

---

## 4. Audit

### GET `/audit/query` — Truy vấn audit logs
**Roles:** compliance_officer

**Query params:**
| Param | Type | Mô tả |
|---|---|---|
| `actorId` | string | Lọc theo user thực hiện |
| `action` | string | Lọc theo hành động (VD: `DOCUMENT_SUBMIT`) |
| `resourceType` | string | Lọc loại resource (VD: `DOCUMENT`) |
| `resourceId` | string | UUID tài liệu |
| `result` | string | `SUCCESS` hoặc `DENY` |
| `from` | ISO8601 | Từ thời điểm |
| `to` | ISO8601 | Đến thời điểm |
| `limit` | int (1-200) | Số bản ghi, default 100 |

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

## Tổng hợp bảng endpoint

| Method | Gateway path | Roles | Mô tả |
|---|---|---|---|
| GET | `/metadata/documents` | tất cả | Danh sách docs |
| POST | `/metadata/documents` | editor, admin | Tạo doc mới |
| GET | `/metadata/documents/:docId` | tất cả | Chi tiết doc + versions + ACL |
| PATCH | `/metadata/documents/:docId` | editor (owner), admin | Sửa metadata |
| GET | `/metadata/documents/:docId/workflow-history` | tất cả | Lịch sử workflow |
| POST | `/metadata/documents/:docId/acl` | editor, admin | Upsert ACL rule |
| GET | `/metadata/documents/:docId/acl` | editor, approver, CO, admin | Xem ACL |
| POST | `/metadata/documents/:docId/download-authorize` | tất cả (CO bị deny) | Xin grant token |
| POST | `/documents/:docId/upload` | editor, admin | Upload file |
| POST | `/documents/:docId/presign-download` | viewer, editor, approver, admin | Presigned URL |
| GET | `/documents/:docId/versions/:version/stream` | viewer, editor, approver, admin | Stream file |
| POST | `/workflow/:docId/submit` | editor, admin | DRAFT → PENDING |
| POST | `/workflow/:docId/approve` | approver, admin | PENDING → PUBLISHED |
| POST | `/workflow/:docId/reject` | approver, admin | PENDING → DRAFT |
| POST | `/workflow/:docId/archive` | approver, admin | PUBLISHED → ARCHIVED ⚠️ |
| GET | `/audit/query` | compliance_officer | Truy vấn audit log |

> ⚠️ **Archive endpoint chưa được thêm vào gateway proxy.** Cần thêm vào `workflow.proxy.controller.ts`.

---

## Error Response Format (chung)

```jsonc
{
  "statusCode": 400 | 401 | 403 | 404 | 409,
  "message": "string hoặc string[]",
  "error": "string"
}
```

| Code | Tình huống |
|---|---|
| 401 | Không có / sai / hết hạn JWT |
| 403 | Sai role hoặc bị ACL deny |
| 404 | DocId không tồn tại |
| 409 | Conflict (VD: approve doc đã published) |
| 400 | Request body không hợp lệ |
