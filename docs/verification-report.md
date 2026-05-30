# DocVault Web Runtime Verification Report

Updated: 2026-05-30

Scope: Web/runtime DocVault only. This report excludes DevSecOps, CI/CD pipeline, cluster policy, image registry, and deployment evidence.

## Summary

The local Web/runtime evidence suite now verifies the main enterprise DMS security controls end to end through `pnpm test:e2e`.

Latest verified command:

```powershell
pnpm test:e2e
```

Result:

- `All required E2E checks passed.`
- GROUP ACL live branch ran with `finance-team`.
- Confidential presign posture returned stream-only evidence instead of a direct URL.
- Malware, DLP, retention, audit verify-chain, and audit security summary probes passed.

## Runtime Evidence Covered

| Area | Evidence | Result |
| --- | --- | --- |
| Auth boundary | missing token and expired token rejected | PASS |
| Create policy | viewer create denied, editor create allowed | PASS |
| Metadata policy | viewer guessed confidential detail/history/comments/ACL denied | PASS |
| GROUP ACL | admin grants `GROUP READ` to `finance-team`; editor can read; viewer denied | PASS |
| Confidential download posture | viewer presign denied; editor presign returns `url: null`; editor streams through controlled path | PASS |
| Malware scan | EICAR upload blocked before MinIO and no metadata version created | PASS |
| DLP | sensitive upload detected, classification escalated to `CONFIDENTIAL`, downgrade denied | PASS |
| Workflow | editor submit, approver approve, duplicate approve conflict | PASS |
| Retention | approval stamps retention fields, admin run archives due record, workflow history has `system:retention` | PASS |
| Compliance officer | metadata/audit/retention allowed, preview/presign/stream/download denied | PASS |
| Audit | query, verify-chain, retention event query, security summary | PASS |
| Audit ingest boundary | viewer cannot ingest fake audit event | PASS |

## Key PASS Lines

```text
PASS editor confidential presign returns stream-only response: 200
PASS confidential presign withheld direct URL
PASS editor confidential stream download: 200
PASS GROUP ACL stored with normalized group name
PASS editor GROUP READ ACL metadata access: 200
PASS editor EICAR upload blocked: 400
PASS DLP upload escalated classification
PASS retention workflow history actor=system:retention
PASS security summary includes malware/DLP/deny evidence
All required E2E checks passed.
```

## Local Stack Notes

- Keycloak realm import uses `infra/keycloak/realm-docvault.json`.
- `editor1` belongs to `/finance-team`; reimporting the realm enables live GROUP ACL evidence.
- `infra/keycloak/seed-roles.sh` waits for the realm OIDC discovery endpoint and is LF-normalized for Linux containers on Windows checkouts.
- MinIO init enables bucket SSE-S3 in `infra/minio/init.sh`.

## Remaining Non-Blocking Gaps

- Browser-level Playwright/Cypress flows are still not part of this report; current proof is API/runtime E2E plus frontend build/lint from earlier sprint verification.
- Shared auth/contracts can be consolidated further in a later cleanup sprint.
- Notification delivery remains a dev sink rather than email/webhook delivery.
