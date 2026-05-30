# DocVault Web Runtime Demo Evidence Package

Updated: 2026-05-30

Scope: Web/runtime application security evidence only. DevSecOps pipeline evidence is intentionally out of scope.

## Goal

Use this package to present DocVault as an enterprise-style secure document management system, not only a CRUD web app.

The demo story:

1. Users authenticate through Keycloak roles and groups.
2. Documents move through draft, pending, published, and archived states.
3. Access decisions combine role, ownership, status, classification, ACL, and group membership.
4. File content has a stricter boundary than metadata.
5. Security events are auditable and summarized for compliance review.

## Prerequisites

```powershell
docker compose -f infra/docker-compose.dev.yml --env-file infra/.env up -d
pnpm start:sequential
pnpm --filter web dev
```

If GROUP ACL evidence is skipped, reimport/recreate Keycloak from the checked-in realm:

```powershell
docker compose -f infra/docker-compose.dev.yml --env-file infra/.env up -d --force-recreate keycloak keycloak-init
```

## Automated Evidence Command

```powershell
pnpm test:e2e
```

Expected final line:

```text
All required E2E checks passed.
```

## Evidence Map

| Demo claim | Automated proof |
| --- | --- |
| No anonymous access | `PASS no token metadata list: 401` |
| Expired token rejected | `PASS expired token metadata list: 401` |
| Viewer cannot create documents | `PASS viewer create document denied: 403` |
| Confidential metadata is protected | `PASS viewer guessed confidential metadata denied: 403` |
| Workflow/history/comments/ACL follow metadata policy | guessed confidential history/comments/ACL all return `403` |
| GROUP ACL is real, not schema-only | `PASS editor GROUP READ ACL metadata access: 200` |
| Sensitive documents avoid direct presigned URL exposure | `PASS confidential presign withheld direct URL` |
| Sensitive documents use controlled stream path | `PASS editor confidential stream download: 200` |
| Malware is blocked before storage | `PASS editor EICAR upload blocked: 400` and `PASS EICAR upload not stored in MinIO` |
| DLP escalates classification | `PASS DLP upload escalated classification` |
| DLP downgrade is blocked | `PASS editor downgrade DLP document denied: 403` |
| Published records carry retention evidence | `PASS approve stamped retention evidence` |
| Retention job archives due records | `PASS retention run sets status=ARCHIVED` |
| Retention is visible in workflow/audit | `PASS retention workflow history actor=system:retention` and `PASS retention audit event DOCUMENT_AUTO_ARCHIVED` |
| Compliance can inspect evidence but not file content | compliance metadata/audit/retention pass; preview/presign/stream/download return `403` |
| Audit tamper evidence exists | `PASS audit verify-chain valid=false` |
| Security summary aggregates evidence | `PASS security summary includes malware/DLP/deny evidence` |
| Normal users cannot forge audit events | `PASS viewer audit ingest denied: 403` |

## Manual Browser Demo Path

1. Login as `editor1`.
2. Create an `INTERNAL` document, upload a normal file, and submit it.
3. Login as `approver1`, approve the document.
4. Login as `viewer1`, download the published normal document.
5. Login as `co1`, open Audit and Retention pages.
6. Verify compliance officer can inspect audit/retention evidence but cannot preview/download file content.
7. Login as `admin1`, run retention from the Retention page.
8. Return to Audit and filter for `DOCUMENT_AUTO_ARCHIVED`.

## Presenter Notes

- Explain `GROUP` ACL with the normalized Keycloak claim: `/finance-team` becomes `finance-team`.
- Explain that direct presigned URLs are acceptable for lower-sensitivity downloads, while `CONFIDENTIAL`/`SECRET` documents are forced through stream/watermark handling.
- Explain MinIO SSE-S3 as the local MVP at-rest encryption posture, with KMS/E2EE left as future work.
- Explain audit hash-chain as tamper-evidence, not immutable storage.
- Keep pipeline/registry/Kubernetes claims separate from this Web runtime evidence package.
