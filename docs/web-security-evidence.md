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

Current rotation model: drain or pause new grant issuance for the 5-minute TTL window, then replace the matching secret in metadata-service and document-service. A current/previous `kid` keyring can be added later if zero-downtime overlapping rotation is required.

### Audit Ingestion Boundary

- User JWT identifies the actor for normal API requests.
- Audit event ingestion requires `x-docvault-service-token`.
- `AUDIT_INGEST_TOKEN` must match in the emitting service, gateway proxy, and audit-service.
- A normal viewer/editor/approver/compliance JWT cannot append fake audit events.

### Audit Hash-Chain Evidence

- Audit-service exposes `GET /audit/verify-chain`.
- Gateway proxies it to `GET /api/audit/verify-chain`.
- Web Audit page has a Verify Chain action and displays valid/invalid status.
- The hash chain is tamper-evident, not immutable storage. If an old audit event is edited directly in storage, verification should return `valid: false`.

## Demo Evidence Matrix

The root E2E script covers:

- No token rejected.
- Expired token rejected.
- Viewer create denied.
- Editor create/upload/submit allowed.
- Approver approve allowed.
- Viewer download published document allowed.
- Viewer guessed confidential detail/history/comments/ACL denied.
- Compliance metadata allowed where policy permits.
- Compliance preview denied.
- Compliance direct preview denied.
- Compliance download/presign/stream denied.
- Compliance audit query allowed.
- Compliance audit verify-chain allowed.
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
