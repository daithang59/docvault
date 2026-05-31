# Tong hop Web Runtime da trien khai va huong dan kiem thu

Ngay lap: 2026-05-31

Pham vi: tai lieu nay chi tong hop cac cai tien **Web App / runtime security** cua DocVault. Khong bao gom DevSecOps pipeline, GitOps, registry, Kubernetes policy, Jenkins, ArgoCD hay cac hang muc ha tang pipeline.

Nguon doi chieu:

- `docs/ke_hoach_uu_tien_cai_thien_docvault_theo_gop_y_gvhd.md`
- `docs/tong_hop_gop_y_docvault_webapp_devsecops_v2.md`
- `docs/web-security-evidence.md`
- `docs/web-key-rotation-and-mfa-runbook.md`

## 1. Tong quan ket qua

DocVault da duoc nang cap tu mot web app quan ly tai lieu co upload/download thanh mot he thong quan ly tai lieu bao mat co cac lop kiem soat sau:

- Kiem soat truy cap theo RBAC + ACL + trang thai tai lieu + classification.
- Compliance Officer co the kiem toan metadata/audit nhung khong duoc xem noi dung file.
- Download/preview nhay cam di qua grant token ngan han, co ho tro key rotation bang `kid`.
- Audit event co trust boundary service-to-service va hash-chain de phat hien sua log.
- Upload file co malware scan va DLP scan truoc/sau khi luu metadata.
- Tai lieu nhay cam bi han che presigned URL truc tiep, uu tien stream qua service de watermark.
- Retention/records management co truong du lieu, endpoint, audit va workflow history.
- Security dashboard tong hop deny, malware, DLP, audit-chain, risk scoring, behavior anomaly va recommendation.
- AI-ready guardrails xac dinh ro metadata-safe va content-denied operations truoc khi tich hop LLM that.
- Access impact preview giup thay doi classification co canh bao truoc khi submit.
- One-click compliance evidence packet de xuat goi bang chung cho tung document.

Uoc luong theo ke hoach Web App: **khoang 90-93% hoan thanh**. Cac hang muc bat buoc cho demo bao mat web app da co code va test; phan con lai chu yeu la chup evidence, polish bao cao va cac nang cap AI/enterprise that su.

## 2. Bang doi chieu hang muc da lam

| Ma muc | Noi dung | Trang thai | Bang chung chinh |
| --- | --- | --- | --- |
| W-P0.1 | Secret/key lifecycle, MFA, grant token rotation | Gan xong | `docs/web-key-rotation-and-mfa-runbook.md`, grant token env `GRANT_TOKEN_CURRENT_KID` / `GRANT_TOKEN_PREVIOUS_KID` |
| W-P0.2 | RBAC + ACL + status + classification policy | Gan xong | `services/metadata-service/src/policy/policy.service.ts`, `apps/web/src/lib/auth/permissions.ts` |
| W-P0.3 | Audit ingestion trust boundary | Xong | `services/audit-service/src/auth/service-token.guard.ts` |
| W-P0.4 | Audit hash-chain tamper evidence | Gan xong | `GET /audit/verify-chain`, audit tamper demo script |
| W-P0.5 | E2E security evidence | Gan xong | `scripts/e2e-check.mjs`, `pnpm test:e2e` |
| W-P1.1 | Malware scan upload | Gan xong | `services/document-service/src/security/malware-scanner.service.ts` |
| W-P1.2 | DLP va classification policy | Gan xong | DLP state, downgrade guard, admin override audit |
| W-P1.3 | Encryption at rest va presigned URL posture | Du cho MVP | MinIO SSE, sensitive stream-only download |
| W-P1.4 | Security dashboard | Xong | `apps/web/src/app/(app)/security/page.tsx` |
| W-P1.5 | Retention / records management | Gan xong | `/metadata/retention/documents`, `/metadata/retention/run` |
| W-P2.1 | Shared auth/contracts | Mot phan lon | `@docvault/auth/rbac`, OpenAPI gateway contract |
| W-P3 | AI-ready / future security intelligence | AI-ready da manh, chua co LLM that | AI guardrails, access impact, risk scoring, anomaly, recommendation |

## 3. Cac tinh nang moi va y nghia

### 3.1. Secret, grant token va key rotation

**Da lam**

- `DOWNLOAD_GRANT_SECRET` va `PREVIEW_GRANT_SECRET` khong con fallback hard-code.
- Metadata-service ky grant token cho download/preview.
- Document-service verify grant token truoc khi stream/download.
- Co co che zero-downtime rotation bang:
  - `GRANT_TOKEN_CURRENT_KID`
  - `GRANT_TOKEN_PREVIOUS_KID`
  - `DOWNLOAD_GRANT_SECRET_<kid>`
  - `PREVIEW_GRANT_SECRET_<kid>`
- Co runbook MFA va key rotation tai `docs/web-key-rotation-and-mfa-runbook.md`.

**Y nghia**

- Neu secret bi lo, co the rotate key ma khong lam logout/deny tat ca grant dang con TTL.
- Grant token chi song ngan han, giam rui ro neu token bi copy.
- Tach download grant va preview grant giup han che anh huong khi mot loai secret gap su co.

**Cach su dung / kiem tra**

1. Dam bao `services/metadata-service/.env` va `services/document-service/.env` co cung bo secret.
2. Legacy dev mode:

```env
DOWNLOAD_GRANT_SECRET=replace-with-strong-download-grant-secret
PREVIEW_GRANT_SECRET=replace-with-strong-preview-grant-secret
```

3. Rotation mode:

```env
GRANT_TOKEN_CURRENT_KID=2026_05
GRANT_TOKEN_PREVIOUS_KID=2026_04
DOWNLOAD_GRANT_SECRET_2026_05=replace-with-current-download-grant-secret
DOWNLOAD_GRANT_SECRET_2026_04=replace-with-previous-download-grant-secret
PREVIEW_GRANT_SECRET_2026_05=replace-with-current-preview-grant-secret
PREVIEW_GRANT_SECRET_2026_04=replace-with-previous-preview-grant-secret
```

4. Chay unit test lien quan:

```powershell
pnpm --filter metadata-service test -- policy.service.spec.ts
pnpm --filter document-service test -- download-grant.util.spec.ts preview-grant.util.spec.ts
```

### 3.2. MFA demo posture

**Da lam**

- Keycloak realm co required action `CONFIGURE_TOTP`.
- Co tai khoan demo MFA rieng cho admin/compliance:
  - `co-mfa-demo`
  - `admin-mfa-demo`
- Cac tai khoan automation nhu `co1`, `admin1` van giu khong bat OTP de E2E/password-grant chay duoc.

**Y nghia**

- Bao cao co the tra loi gop y ve MFA/2FA ma khong lam hong automation test.
- Tach human admin/compliance va automation service account la cach trinh bay dung hon ve production posture.

**Cach kiem tra thu cong**

1. Mo Keycloak local: `http://localhost:8080`.
2. Dang nhap realm `docvault`.
3. Kiem tra user `co-mfa-demo` hoac `admin-mfa-demo`.
4. Xac nhan user co required action `CONFIGURE_TOTP`.
5. Dang nhap interactive de thay yeu cau cau hinh OTP.

### 3.3. Authorization policy thong nhat

**Da lam**

- Metadata detail, workflow history, comments va ACL list cung di qua policy read metadata.
- Download/preview phan biet ro:
  - metadata read
  - preview file content
  - download/presign/stream file content
- ACL ho tro `USER`, `ROLE`, `GROUP`, `ALL`.
- `GROUP` ACL normalize group Keycloak, vi du `/finance-team` thanh `finance-team`.
- `DENY` ACL uu tien cao hon baseline allow.
- Compliance Officer bi chan preview, stream, presign va download file content.
- Frontend action visibility dung helper `getDocumentAccessDecision(...)` de hien ly do bi chan.

**Y nghia**

- He thong khong con chi check role don gian.
- Nguoi dung khong the doan `docId` de xem detail/history/comment/ACL khi khong co quyen.
- Compliance Officer dung vai tro kiem toan: xem audit/metadata theo policy, khong xem noi dung file.

**Cach kiem tra thu cong**

1. Dang nhap `editor1`, tao document va upload file.
2. Submit document sang Pending.
3. Dang nhap `approver1`, approve document thanh Published.
4. Dang nhap `viewer1`, thu xem/download document Published neu ACL cho phep.
5. Dang nhap `co1`, vao detail/audit de kiem tra metadata/audit, sau do thu preview/download:
   - Ket qua dung: preview/download bi deny.
6. Tao document `CONFIDENTIAL` hoac `SECRET`, thu download bang viewer khong co ACL:
   - Ket qua dung: deny hoac khong co direct presigned URL.

**Lenh test lien quan**

```powershell
pnpm --filter metadata-service test
pnpm --filter web test -- permissions.spec.ts document-preview-dialog.spec.ts
pnpm test:e2e
```

### 3.4. Audit ingestion boundary

**Da lam**

- `POST /audit/events` la endpoint internal.
- Muon ghi audit event phai co header `x-docvault-service-token`.
- Token nay duoc validate bang `AUDIT_INGEST_TOKEN`.
- Gateway va audit-service cung chan user JWT thuong append audit gia.

**Y nghia**

- Audit trail dang tin cay hon vi user thuong khong the tu tao event "gia".
- Hash-chain audit chi co y nghia khi nguon ghi event bi kiem soat.

**Cach kiem tra**

1. Dam bao `AUDIT_INGEST_TOKEN` giong nhau trong:
   - `services/gateway/.env`
   - `services/metadata-service/.env`
   - `services/document-service/.env`
   - `services/audit-service/.env`
2. Chay:

```powershell
pnpm --filter audit-service test -- service-token.guard.spec.ts
pnpm --filter gateway test
pnpm test:e2e
```

3. Trong E2E, viewer thuong goi audit ingest phai bi deny.

### 3.5. Audit hash-chain va tamper evidence

**Da lam**

- Moi audit event co `prevHash` va `hash`.
- Co endpoint verify-chain:
  - Backend: `GET /audit/verify-chain`
  - Gateway/API: `/api/audit/verify-chain`
- Web Audit page co action verify chain.
- Co script demo sua event cu trong MongoDB de chain invalid.
- Evidence packet ghi lai audit-chain status tai thoi diem export.

**Y nghia**

- Audit log la tamper-evident: neu ai do sua event cu trong storage, verify-chain se bao invalid.
- Day khong phai blockchain va khong lam log bat bien tuyet doi; no dung de phat hien log bi sua.

**Cach kiem tra**

```powershell
pnpm --filter audit-service test -- audit-hash.spec.ts
pnpm --filter audit-service audit:tamper-demo:test
```

Demo local an toan:

```powershell
pnpm --filter audit-service audit:tamper-demo -- --dry-run
```

Chi khi muon co tinh sua du lieu demo local moi chay:

```powershell
$env:DOCVAULT_ALLOW_AUDIT_TAMPER_DEMO='true'
pnpm --filter audit-service audit:tamper-demo -- --apply
```

Sau do mo trang Audit va bam Verify Chain. Ket qua ky vong: `valid=false`.

### 3.6. Malware scan khi upload

**Da lam**

- Document-service scan file upload truoc khi ghi MinIO.
- Che do demo mac dinh `local-eicar` chan EICAR payload.
- Co che do optional `clamav`.
- Neu malware bi phat hien:
  - khong ghi object vao MinIO
  - khong tao metadata version chinh thuc
  - emit audit `MALWARE_UPLOAD_BLOCKED`

**Y nghia**

- DocVault co lop threat protection nhu cac DMS enterprise.
- Demo bang EICAR giup chung minh flow chan malware ma khong can file doc hai that.

**Cach kiem tra**

1. Dat mode demo:

```env
MALWARE_SCANNER_MODE=local-eicar
```

2. Tao file EICAR test va upload qua UI hoac E2E.
3. Ket qua dung:
   - upload bi deny
   - khong co version moi
   - audit co `MALWARE_UPLOAD_BLOCKED`

Unit test:

```powershell
pnpm --filter document-service test -- malware-scanner.service.spec.ts documents.service.spec.ts
```

### 3.7. DLP va classification guard

**Da lam**

- DLP scan phat hien:
  - email
  - phone/national-id-like values
  - keyword `secret`, `confidential`, `internal only`
- Neu tai lieu `PUBLIC` / `INTERNAL` co DLP hit, he thong escalate len `CONFIDENTIAL`.
- Non-admin khong duoc downgrade tai lieu co DLP hit xuong `PUBLIC`.
- Admin downgrade override phai nhap `classificationOverrideReason`.
- Audit event lien quan:
  - `DLP_PATTERN_DETECTED`
  - `DLP_CLASSIFICATION_DOWNGRADE_DENIED`
  - `DLP_CLASSIFICATION_OVERRIDE_APPROVED`
- Web document detail hien DLP evidence nhung khong hien raw sensitive value.

**Y nghia**

- Tranh public hoa tai lieu co du lieu nhay cam.
- Admin van co duong override co ly do va co audit, phu hop voi compliance workflow.
- UI chi hien count/category/severity, khong ro ri noi dung sensitive.

**Cach kiem tra thu cong**

1. Dang nhap `editor1`.
2. Tao/upload file co noi dung vi du:

```text
confidential internal only contact test@example.com
```

3. Kiem tra document detail:
   - classification bi goi y/escalate len `CONFIDENTIAL`
   - DLP evidence hien category/count/severity
4. Thu edit classification xuong `PUBLIC` bang editor:
   - Ket qua dung: bi deny.
5. Dang nhap admin, thu downgrade va nhap override reason:
   - Ket qua dung: duoc chap nhan va co audit override.

Test:

```powershell
pnpm --filter metadata-service test -- documents.service.spec.ts
pnpm --filter document-service test -- documents.service.spec.ts
pnpm --filter web test
```

### 3.8. Encryption at rest va download posture

**Da lam**

- MinIO local bucket init co SSE-S3.
- `PUBLIC` / `INTERNAL` Published co the nhan presigned URL ngan han neu policy cho phep.
- `CONFIDENTIAL` / `SECRET` danh dau `watermarkRequired=true`.
- Khi `watermarkRequired=true`, response khong tra direct `url`, chi tra `streamingEndpoint`.
- Stream path re-authorize/verify grant token va watermark truoc khi tra file.
- Compliance Officer luon bi chan preview/stream/presign/download.

**Y nghia**

- File nhay cam khong lo direct presigned URL de tai thang tu object storage.
- Luong stream qua service cho phep enforce watermark va audit.
- Co cau tra loi ro cho cau hoi "file duoc ma hoa va tai ve an toan nhu the nao".

**Cach kiem tra**

1. Tao tai lieu `CONFIDENTIAL`, approve thanh `PUBLISHED`.
2. Goi download authorize bang editor/owner.
3. Ket qua dung:
   - `url: null`
   - `watermarkRequired: true`
   - co `streamingEndpoint`
4. Mo streaming endpoint de tai file qua controlled path.
5. Thu cung thao tac bang `co1`:
   - Ket qua dung: deny.

E2E da cover:

```powershell
pnpm test:e2e
```

### 3.9. Security dashboard va recommendation engine

**Da lam**

- Web page: `/security`.
- Chi Compliance Officer/Admin duoc xem.
- Dashboard hien:
  - audit-chain posture
  - deny counters
  - malware blocked
  - DLP detections
  - download denied
  - high-volume content access
  - sensitive preview/download grants
  - recent DENY/DLP events
  - risky documents
  - behavior anomaly signals
  - prioritized security recommendations
- Recommendation engine tao action deterministic tu audit metadata, khong dung file content.
- Khi xem recommendation, audit event `SECURITY_RECOMMENDATIONS_VIEWED` duoc ghi voi ids/counts/types/filter, khong ghi token hay noi dung file.

**Y nghia**

- Day la diem vuot len web quan ly tai lieu thong thuong: compliance/admin co man hinh an ninh tong hop va co hanh dong goi y.
- Recommendation deterministic giup demo on dinh, khong phu thuoc LLM.
- Khong dua file content/object key/presigned URL/grant token vao recommendation metadata.

**Cach su dung**

1. Chay web:

```powershell
pnpm --filter web dev
```

2. Mo:

```text
http://localhost:3006/security
```

3. Dang nhap bang `co1` hoac `admin1`.
4. Bam cac link `Open audit` trong quick filters, risky documents, behavior anomalies hoac recommendations.
5. Kiem tra trang Audit duoc mo voi filter tuong ung.

**Cach test**

```powershell
pnpm --filter audit-service test -- security-summary.spec.ts
pnpm --filter web test -- security-dashboard.spec.ts
pnpm --filter audit-service build
pnpm --filter web exec tsc --noEmit
pnpm --filter web build
```

### 3.10. Retention va records management

**Da lam**

- Metadata-service luu:
  - `retentionClass`
  - `retentionUntil`
  - `retentionReason`
- Khi document duoc approve/publish, retention duoc tinh theo classification:
  - `PUBLIC_730D`
  - `INTERNAL_365D`
  - `CONFIDENTIAL_180D`
  - `SECRET_30D`
- Endpoint:
  - `GET /metadata/retention/documents`
  - `POST /metadata/retention/run`
- Due records duoc auto-archive thanh `ARCHIVED`.
- Workflow history ghi `action=RETENTION`, `actorId=system:retention`.
- Audit ghi `DOCUMENT_AUTO_ARCHIVED`.
- Web page: `/retention`.

**Y nghia**

- DocVault co records management/compliance lifecycle, khong chi la CRUD document.
- Co bang chung document duoc luu giu theo classification va auto-archive khi qua han.

**Cach su dung**

1. Dang nhap `co1` hoac `admin1`.
2. Mo:

```text
http://localhost:3006/retention
```

3. Xem cac cot retention class, deadline, status, days remaining.
4. Admin co the chay retention demo endpoint neu UI/action co ho tro trong flow local.

**Cach test**

```powershell
pnpm --filter metadata-service test
pnpm test:e2e
```

### 3.11. One-click compliance evidence packet

**Da lam**

- Compliance/admin co the export evidence packet theo document:
  - `GET /metadata/documents/:docId/evidence-packet`
- Packet gom:
  - metadata
  - version checksum
  - ACL
  - workflow history
  - retention evidence
  - audit hash-chain status
  - related audit events
- Packet khong gom:
  - file content
  - object key
  - presigned URL
  - preview grant
  - download grant token
- Viewer/editor/approver khong co role compliance/admin se bi deny.

**Y nghia**

- Rat huu ich khi bao cao/demo: mot endpoint gom du bang chung compliance cho tai lieu.
- Bao dam compliance officer xem du evidence nhung van khong xem noi dung file.

**Cach kiem tra**

1. Dang nhap `co1`.
2. Mo document detail co quyen metadata.
3. Chon action export evidence packet neu UI hien.
4. Kiem tra JSON khong co grant token/presigned URL/file content.
5. Dang nhap `viewer1` va goi cung endpoint:
   - Ket qua dung: 403.

Test:

```powershell
pnpm --filter gateway test -- metadata.proxy.controller.spec.ts
pnpm test:e2e
```

### 3.12. AI-ready guardrails

**Da lam**

- Endpoint:
  - `GET /metadata/documents/:docId/ai-guardrails`
- Truoc khi tra AI context decision, endpoint check `assertCanReadMetadata(...)`.
- Response tach ro:
  - metadata-safe operations: classification/tagging
  - content operations: summarization/Q&A
- Compliance Officer chi duoc metadata-only, bi deny content operations.
- Response khong tra file content, object key, presigned URL hay grant token.
- Audit event: `AI_GUARDRAILS_EVALUATED`.
- Web document detail co card AI guardrails.

**Y nghia**

- Day la nen tang dung de tich hop LLM sau nay ma khong pha policy hien tai.
- AI khong duoc doc noi dung ma user khong co quyen doc.
- Compliance Officer khong duoc dung AI de "di vong" vao noi dung file.

**Cach kiem tra**

```powershell
pnpm --filter metadata-service test -- policy.service.spec.ts
pnpm --filter gateway test -- metadata.proxy.controller.spec.ts
pnpm --filter web test -- document-ai-guardrails-card.spec.ts
```

Kiem tra thu cong:

1. Mo document detail.
2. Xem AI guardrails card.
3. Dang nhap `co1` va xac nhan content summarization/Q&A bi deny.

### 3.13. Access impact preview

**Da lam**

- Endpoint:
  - `POST /metadata/documents/:docId/access-impact`
- Gateway proxy:
  - `POST /metadata/documents/:docId/access-impact`
- Web edit document hien access impact card khi classification moi khac classification hien tai.
- Response cho biet:
  - current/proposed classification
  - watermark posture
  - access expansion/reduction warning
  - DLP override requirement
  - role-level metadata/download delta
- Khong enumerate user that va khong tra file content/grant/object key.
- Audit event: `DOCUMENT_ACCESS_IMPACT_SIMULATED`.

**Y nghia**

- Truoc khi ha classification, editor/admin thay duoc rui ro mo rong truy cap.
- Day la tinh nang enterprise-like vi no giai thich tac dong policy truoc khi mutate metadata.

**Cach kiem tra**

1. Dang nhap owner editor hoac admin.
2. Mo document edit.
3. Doi classification, vi du `CONFIDENTIAL` -> `PUBLIC`.
4. Xem access impact card.
5. Neu document co DLP hit, kiem tra UI canh bao override requirement.

Test:

```powershell
pnpm --filter metadata-service test -- policy.service.spec.ts
pnpm --filter gateway test -- metadata.proxy.controller.spec.ts
pnpm --filter web test -- document-access-impact-card.spec.ts
```

### 3.14. Shared auth/contracts va OpenAPI alignment

**Da lam**

- Cac service downstream re-export `Roles`, `ROLES_KEY`, `RolesGuard` tu `@docvault/auth/rbac`.
- OpenAPI gateway contract duoc cap nhat cho:
  - comments
  - retention
  - evidence packet
  - audit security summary
  - risk scoring
  - behavior anomaly
  - recommendations
  - AI guardrails
  - access impact
  - malware/DLP upload behavior

**Y nghia**

- Giam drift giua frontend/backend/contract.
- Swagger/OpenAPI dung hon voi runtime, tien cho bao cao va demo API.

**Cach kiem tra**

```powershell
pnpm --filter @docvault/auth build
pnpm --filter gateway build
pnpm --filter gateway test
node -e "const fs=require('fs'); const yaml=require('js-yaml'); yaml.load(fs.readFileSync('libs/contracts/openapi/gateway.yaml','utf8')); console.log('openapi ok')"
```

## 4. Huong dan chay local de demo cac tinh nang

### 4.1. Chuan bi

Yeu cau:

- Node.js 20+
- pnpm 9+
- Docker Desktop / Docker Engine

Cai dependency:

```powershell
pnpm install
```

Start infra local:

```powershell
docker compose -f infra/docker-compose.dev.yml --env-file infra/.env up -d
```

Chay migration metadata:

```powershell
pnpm --filter metadata-service prisma:deploy
```

### 4.2. Chay backend

Cach de theo doi log ro nhat la mo tung terminal:

```powershell
pnpm --filter metadata-service start:dev
pnpm --filter audit-service start:dev
pnpm --filter document-service start:dev
pnpm --filter notification-service start:dev
pnpm --filter workflow-service start:dev
pnpm --filter gateway start:dev
```

Hoac dung script root neu moi truong local da cau hinh on dinh:

```powershell
pnpm start:sequential
```

### 4.3. Chay frontend

Package web hien cau hinh mac dinh port `3006`:

```powershell
pnpm --filter web dev
```

Mo:

```text
http://localhost:3006
```

API base mac dinh:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
```

### 4.4. Tai khoan demo

Password seed mac dinh: `Passw0rd!`

| Username | Role | Muc dich demo |
| --- | --- | --- |
| `viewer1` | `viewer` | Xem/download tai lieu Published neu policy cho phep |
| `editor1` | `editor` | Tao document, upload, submit, edit metadata |
| `approver1` | `approver` | Approve/reject Pending document |
| `co1` | `compliance_officer` | Xem audit/security/retention/evidence, khong xem file content |
| `admin1` | `admin` | Thao tac admin va override co audit reason |

## 5. Checklist test nhanh theo muc tieu demo

### 5.1. Test tu dong day du nhat

Sau khi local stack dang chay:

```powershell
pnpm test:e2e
```

Ket qua ky vong:

- Unauthorized/expired token bi reject.
- Viewer khong tao document duoc.
- Editor tao/upload/submit duoc.
- Approver approve duoc.
- Viewer download Published document khi policy cho phep.
- Confidential/Secret khong lo direct presigned URL.
- Compliance Officer preview/download/stream bi deny.
- Compliance Officer audit query/verify-chain/security summary duoc allow.
- Malware EICAR upload bi chan.
- DLP upload escalate classification.
- DLP downgrade bi chan neu khong co override hop le.
- Evidence packet co metadata/version/workflow/retention/audit evidence.
- Viewer bi deny evidence packet/audit ingest.
- Retention auto-archive tao workflow history va audit.

### 5.2. Test backend theo service

```powershell
pnpm --filter metadata-service test
pnpm --filter document-service test
pnpm --filter audit-service test
pnpm --filter gateway test
```

### 5.3. Test frontend

```powershell
pnpm --filter web test
pnpm --filter web exec tsc --noEmit
pnpm --filter web lint
pnpm --filter web build
```

Luu y: lan verify gan nhat co `web lint` pass voi 0 error va con mot so warning san co o cac component/hook cu.

### 5.4. Test OpenAPI

```powershell
node -e "const fs=require('fs'); const yaml=require('js-yaml'); yaml.load(fs.readFileSync('libs/contracts/openapi/gateway.yaml','utf8')); console.log('openapi ok')"
```

### 5.5. Test tamper audit local

```powershell
pnpm --filter audit-service audit:tamper-demo:test
pnpm --filter audit-service audit:tamper-demo -- --dry-run
```

Chi sua du lieu local khi can demo tamper:

```powershell
$env:DOCVAULT_ALLOW_AUDIT_TAMPER_DEMO='true'
pnpm --filter audit-service audit:tamper-demo -- --apply
```

Sau do mo `/audit` va verify chain.

## 6. Checklist su dung tren UI

| Trang | URL local | Role nen dung | Kiem tra |
| --- | --- | --- | --- |
| Documents | `http://localhost:3006/documents` | viewer/editor/admin | List, detail, preview/download button policy |
| New Document | `http://localhost:3006/documents/new` | editor/admin | Tao document va upload file |
| Document Detail | `http://localhost:3006/documents/:id` | editor/approver/co/admin | DLP evidence, AI guardrails, evidence packet |
| Document Edit | `http://localhost:3006/documents/:id/edit` | owner editor/admin | Access impact preview khi doi classification |
| Approvals | `http://localhost:3006/approvals` | approver/admin | Approve/reject Pending document |
| Audit | `http://localhost:3006/audit` | compliance/admin | Query audit, quick filters, verify chain |
| Security | `http://localhost:3006/security` | compliance/admin | Counters, alerts, risk scoring, anomalies, recommendations |
| Retention | `http://localhost:3006/retention` | compliance/admin | Retention status va records evidence |

## 7. Demo flow de trinh bay voi giang vien

1. Dang nhap `editor1`.
2. Tao document moi, upload file binh thuong.
3. Submit document.
4. Dang nhap `approver1`, approve document.
5. Dang nhap `viewer1`, mo document va download neu policy cho phep.
6. Tao/upload tai lieu co noi dung nhay cam, vi du co email va keyword `confidential`.
7. Chi ra DLP evidence va classification escalation.
8. Tao/upload EICAR test file de chung minh malware bị chan.
9. Dang nhap `co1`.
10. Vao `/audit`, query event va verify hash-chain.
11. Thu preview/download document bang `co1` va chi ra bi deny.
12. Vao `/security`, trinh bay:
    - deny/malware/DLP counters
    - risky documents
    - behavior anomaly
    - security recommendations
13. Vao document detail, export evidence packet va chi ra packet khong co file content/token.
14. Vao `/retention`, trinh bay retention class/deadline/status.
15. Vao edit document, doi classification de xem access impact preview.

## 8. Diem can noi ro trong bao cao

- Hash-chain la **tamper-evident**, khong phai blockchain va khong thay the immutable storage.
- AI hien tai la **AI-ready guardrails / deterministic security intelligence**, chua phai LLM summarization/QA that.
- Malware scanning local dung EICAR deterministic mode; ClamAV la optional mode.
- MinIO SSE la encryption-at-rest MVP; huong nang cao la Vault/KMS/client-side encryption/E2EE.
- Compliance Officer co the xem audit/metadata/evidence theo policy, nhung khong duoc xem file content.
- Security Recommendation Engine chi dung audit metadata, khong dua noi dung file, object key, presigned URL hay grant token vao output/audit.

## 9. Verification da ghi nhan gan nhat

Theo evidence hien tai, cac lenh sau da duoc chay va pass trong dot verify gan nhat:

- `pnpm --filter audit-service test`
- `pnpm --filter audit-service build`
- `pnpm --filter gateway test`
- `pnpm --filter gateway build`
- `pnpm --filter web test`
- `pnpm --filter web exec tsc --noEmit`
- `pnpm --filter web lint`
- `pnpm --filter web build`
- OpenAPI YAML parse check: `openapi ok`
- `git diff --check`
- `pnpm test:e2e`

Ghi chu:

- `web lint` pass voi 0 error va con 5 warning san co.
- `git diff --check` pass, Git chi canh bao line-ending conversion.
- `pnpm test:e2e` can local stack dang chay.

## 10. Viec con nen lam neu muon polish them

1. Chup anh UI cac trang `/security`, `/audit`, `/retention`, document detail va access impact preview de dua vao bao cao.
2. Tao bang completion matrix ngan trong slide: W-P item, status, file evidence, command test.
3. Neu can nang cao hon nua, them workflow "mark recommendation as reviewed" hoac "investigation note" cho security recommendation.
4. Neu muon claim AI that, can bo sung LLM summarization/QA co enforcement policy; hien tai nen claim la AI-ready.
5. Neu muon production-like encryption, bo sung Vault/KMS hoac client-side encryption trong future work.
