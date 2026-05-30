# DocVault Web Security Evidence

Scope: Web/runtime improvements for DocVault only. This evidence intentionally excludes CI/CD, deployment pipeline, cluster policy, image registry, and other infrastructure pipeline topics.

## Security Rules Implemented

### Compliance Officer

- Can query audit events through `GET /audit/query`.
- Can verify the audit hash chain through `GET /audit/verify-chain`.
- Can inspect metadata only when document policy allows it.
- Cannot preview, stream, presign, or download file content.

Enforced in:

- `apps/web/src/lib/auth/permissions.ts`
- `services/gateway/src/proxy/metadata.proxy.controller.ts`
- `services/gateway/src/proxy/documents.proxy.controller.ts`
- `services/metadata-service/src/policy/policy.service.ts`
- `services/document-service/src/documents/documents.controller.ts`

### Metadata Access Boundary

Document detail, workflow history, comments, and ACL list now share `PolicyService.assertCanReadMetadata(...)` before returning document-related data.

ACL matching supports `USER`, `ROLE`, `GROUP`, and `ALL` subjects. Group ACLs use normalized Keycloak group names, so a token claim such as `/finance-team` is matched as `finance-team`; matching `DENY` entries override baseline role/classification visibility and explicit `ALLOW` entries.

Covered routes:

- `GET /metadata/documents/:docId`
- `GET /metadata/documents/:docId/workflow-history`
- `GET /metadata/documents/:docId/comments`
- `GET /metadata/documents/:docId/acl`

Denied metadata reads emit `DOCUMENT_METADATA_READ_DENIED`.

### Grant Token Secrets

- Download grants require `DOWNLOAD_GRANT_SECRET`.
- Preview grants require `PREVIEW_GRANT_SECRET`.
- There is no hard-coded fallback secret.
- Grant TTL is 300 seconds.
- Zero-downtime rotation is supported with `GRANT_TOKEN_CURRENT_KID`, `GRANT_TOKEN_PREVIOUS_KID`, and kid-specific secrets such as `DOWNLOAD_GRANT_SECRET_2026_05` / `PREVIEW_GRANT_SECRET_2026_05`.
- Metadata-service signs new grants with the current `kid`; document-service accepts only current or previous `kid` values.

Legacy single-secret dev mode is still supported when `GRANT_TOKEN_CURRENT_KID` is not set.

### Upload Malware and DLP Controls

- Document-service scans uploads before MinIO writes.
- EICAR test payloads are rejected with `MALWARE_UPLOAD_BLOCKED`.
- Blocked malware uploads do not create a MinIO object and do not register a metadata version.
- DLP scan detects email, phone/national-id-like values, and sensitive keywords such as `secret`, `confidential`, and `internal only`.
- DLP detections emit `DLP_PATTERN_DETECTED`, persist DLP state on metadata/version records, and escalate `PUBLIC`/`INTERNAL` documents to `CONFIDENTIAL`.
- DLP-detected documents cannot be downgraded below `CONFIDENTIAL`; denied downgrade emits `DLP_CLASSIFICATION_DOWNGRADE_DENIED`.

### Audit Ingestion Boundary

- User JWT identifies the actor for normal API requests.
- Audit event ingestion requires `x-docvault-service-token`.
- `AUDIT_INGEST_TOKEN` must match in the emitting service, gateway proxy, and audit-service.
- A normal viewer/editor/approver/compliance JWT cannot append fake audit events.

### Audit Hash-Chain Evidence

- Audit-service exposes `GET /audit/verify-chain`.
- Audit-service exposes `GET /audit/security-summary`.
- Gateway proxies it to `GET /api/audit/verify-chain`.
- Gateway proxies security summary to `GET /api/audit/security-summary`.
- Web Audit page has a Verify Chain action, valid/invalid status, and security cards for deny, malware, DLP, and download-denied counters.
- The hash chain is tamper-evident, not immutable storage. If an old audit event is edited directly in storage, verification should return `valid: false`.

### Retention / Records Management Evidence

- Metadata-service stores `retentionClass`, `retentionUntil`, and `retentionReason` on published records.
- Approval stamps retention evidence from classification policy:
  - `PUBLIC_730D`
  - `INTERNAL_365D`
  - `CONFIDENTIAL_180D`
  - `SECRET_30D`
- Compliance/admin can inspect retention evidence through `GET /metadata/retention/documents`.
- Admin can trigger the local demo retention run through `POST /metadata/retention/run`.
- Due records are auto-archived as `ARCHIVED`.
- Retention archive writes workflow history with `action=RETENTION` and `actorId=system:retention`.
- Retention archive emits audit event `DOCUMENT_AUTO_ARCHIVED`.
- Web Retention page shows tracked, due soon, overdue, and archived record counts.

## Demo Evidence Matrix

The root E2E script covers:

- No token rejected.
- Expired token rejected.
- Viewer create denied.
- Editor create/upload/submit allowed.
- Approver approve allowed.
- Viewer download published document allowed.
- Viewer guessed confidential detail/history/comments/ACL denied.
- GROUP ACL read/download behavior covered by metadata unit tests; the root E2E script records live GROUP READ metadata evidence when the local Keycloak token exposes the `finance-team` group claim.
- EICAR upload blocked and no object/version created.
- Sensitive text upload creates DLP evidence and escalates classification.
- DLP-detected document downgrade to `PUBLIC` denied.
- Compliance metadata allowed where policy permits.
- Compliance preview denied.
- Compliance direct preview denied.
- Compliance download/presign/stream denied.
- Compliance audit query allowed.
- Compliance audit verify-chain allowed.
- Compliance security summary allowed and includes malware/DLP/deny evidence.
- Compliance retention evidence allowed.
- Admin retention run archives due published records.
- Retention workflow history records `system:retention`.
- Retention audit query includes `DOCUMENT_AUTO_ARCHIVED`.
- Viewer audit query denied.
- Viewer audit ingest denied.

## Verification Commands

```powershell
pnpm --filter metadata-service test
pnpm --filter document-service test
pnpm --filter audit-service test
pnpm --filter gateway test
pnpm --filter web lint
node --check scripts\e2e-check.mjs
pnpm test:e2e
```

`pnpm test:e2e` requires the local DocVault stack to be running.
