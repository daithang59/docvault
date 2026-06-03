# Tổng hợp Web Runtime đã triển khai và hướng dẫn kiểm thử

Ngày lập: 2026-05-31

Phạm vi: tài liệu này chỉ tổng hợp các cải tiến Web App / runtime security của DocVault. Không bao gồm DevSecOps pipeline, GitOps, registry, Kubernetes policy, Jenkins, ArgoCD hay các hạng mục hạ tầng pipeline.

Nguồn đối chiếu:

- `docs/ke_hoach_uu_tien_cai_thien_docvault_theo_gop_y_gvhd.md`
- `docs/tong_hop_gop_y_docvault_webapp_devsecops_v2.md`
- `docs/web-security-evidence.md`
- `docs/web-key-rotation-and-mfa-runbook.md`

## 1. Tổng quan kết quả

DocVault đã được nâng cấp từ một web app quản lý tài liệu có upload/download thành một hệ thống quản lý tài liệu bảo mật có các lớp kiểm soát sau:

- Kiểm soát truy cập theo RBAC + ACL + trạng thái tài liệu + classification.
- Compliance Officer có thể kiểm toán metadata/audit nhưng không được xem nội dung file.
- Download/preview nhạy cảm đi qua grant token ngắn hạn, có hỗ trợ key rotation bằng `kid`.
- Audit event có trust boundary service-to-service và hash-chain để phát hiện sửa log.
- Upload file có malware scan và DLP scan trước/sau khi lưu metadata.
- Tài liệu nhạy cảm bị hạn chế presigned URL trực tiếp, ưu tiên stream qua service để watermark.
- Retention/records management có trường dữ liệu, endpoint, audit và workflow history.
- Security dashboard tổng hợp deny, malware, DLP, audit-chain, risk scoring, behavior anomaly và recommendation.
- Evidence Center gom audit-chain, recommendation packet, document packet và retention evidence thành workspace compliance riêng.
- AI-ready guardrails xác định rõ metadata-safe và content-denied operations trước khi tích hợp LLM thật.
- Access impact preview giúp thay đổi classification có cảnh báo trước khi submit.
- One-click compliance evidence packet để xuất gói bằng chứng cho từng document.

Ước lượng theo kế hoạch Web App: khoảng 90-93% hoàn thành. Các hạng mục bắt buộc cho demo bảo mật web app đã có code và test; phần còn lại chủ yếu là chụp evidence, polish báo cáo và các nâng cấp AI/enterprise thật sự.

## 2. Bảng đối chiếu hạng mục đã làm

| Mã mục | Nội dung | Trạng thái | Bằng chứng chính |
|---|---|---|---|
| W-P0.1 | Secret/key lifecycle, MFA, grant token rotation | Gần xong | `docs/web-key-rotation-and-mfa-runbook.md`, grant token env `GRANT_TOKEN_CURRENT_KID` / `GRANT_TOKEN_PREVIOUS_KID` |
| W-P0.2 | RBAC + ACL + status + classification policy | Gần xong | `services/metadata-service/src/policy/policy.service.ts`, `apps/web/src/lib/auth/permissions.ts` |
| W-P0.3 | Audit ingestion trust boundary | Xong | `services/audit-service/src/auth/service-token.guard.ts` |
| W-P0.4 | Audit hash-chain tamper evidence | Gần xong | `GET /audit/verify-chain`, audit tamper demo script |
| W-P0.5 | E2E security evidence | Gần xong | `scripts/e2e-check.mjs`, `pnpm test:e2e` |
| W-P1.1 | Malware scan upload | Gần xong | `services/document-service/src/security/malware-scanner.service.ts` |
| W-P1.2 | DLP và classification policy | Gần xong | DLP state, downgrade guard, admin override audit |
| W-P1.3 | Encryption at rest và presigned URL posture | Đủ cho MVP | MinIO SSE, sensitive stream-only download |
| W-P1.4 | Security dashboard | Xong | `apps/web/src/app/(app)/security/page.tsx` |
| W-P1.5 | Evidence Center | Xong | `apps/web/src/app/(app)/evidence/page.tsx` |
| W-P1.6 | Retention / records management | Gần xong | `/metadata/retention/documents`, `/metadata/retention/run` |
| W-P2.1 | Shared auth/contracts | Một phần lớn | `@docvault/auth/rbac`, OpenAPI gateway contract |
| W-P3 | AI-ready / future security intelligence | AI-ready đã mạnh, chưa có LLM thật | AI guardrails, access impact, risk scoring, anomaly, recommendation |

## 3. Các tính năng mới và ý nghĩa

### 3.1. Secret, grant token và key rotation

**Đã làm**

- `DOWNLOAD_GRANT_SECRET` và `PREVIEW_GRANT_SECRET` không còn fallback hard-code.
- Metadata-service ký grant token cho download/preview.
- Document-service verify grant token trước khi stream/download.
- Có cơ chế zero-downtime rotation bằng:
  - `GRANT_TOKEN_CURRENT_KID`
  - `GRANT_TOKEN_PREVIOUS_KID`
  - `DOWNLOAD_GRANT_SECRET_<kid>`
  - `PREVIEW_GRANT_SECRET_<kid>`
- Có runbook MFA và key rotation tại `docs/web-key-rotation-and-mfa-runbook.md`.

**Ý nghĩa**

- Nếu secret bị lộ, có thể rotate key mà không làm logout/deny tất cả grant đang còn TTL.
- Grant token chỉ sống ngắn hạn, giảm rủi ro nếu token bị copy.
- Tách download grant và preview grant giúp hạn chế ảnh hưởng khi một loại secret gặp sự cố.

**Cách sử dụng / kiểm tra**

1. Đảm bảo `services/metadata-service/.env` và `services/document-service/.env` có cùng bộ secret.
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

4. Chạy unit test liên quan:

```bash
pnpm --filter metadata-service test -- policy.service.spec.ts
pnpm --filter document-service test -- download-grant.util.spec.ts preview-grant.util.spec.ts
```

### 3.2. MFA demo posture

**Đã làm**

- Keycloak realm có required action `CONFIGURE_TOTP`.
- Có tài khoản demo MFA riêng cho admin/compliance:
  - `co-mfa-demo`
  - `admin-mfa-demo`
- Các tài khoản automation như `co1`, `admin1` vẫn giữ không bật OTP để E2E/password-grant chạy được.

**Ý nghĩa**

- Báo cáo có thể trả lời góp ý về MFA/2FA mà không làm hỏng automation test.
- Tách human admin/compliance và automation service account là cách trình bày đúng hơn về production posture.

**Cách kiểm tra thủ công**

1. Mở Keycloak local: `http://localhost:8080`.
2. Đăng nhập realm `docvault`.
3. Kiểm tra user `co-mfa-demo` hoặc `admin-mfa-demo`.
4. Xác nhận user có required action `CONFIGURE_TOTP`.
5. Đăng nhập interactive để thấy yêu cầu cấu hình OTP.

### 3.3. Authorization policy thống nhất

**Đã làm**

- Metadata detail, workflow history, comments và ACL list cùng đi qua policy read metadata.
- Download/preview phân biệt rõ:
  - metadata read
  - preview file content
  - download/presign/stream file content
- ACL hỗ trợ `USER`, `ROLE`, `GROUP`, `ALL`.
- GROUP ACL normalize group Keycloak, ví dụ `/finance-team` thành `finance-team`.
- DENY ACL ưu tiên cao hơn baseline allow.
- Compliance Officer bị chặn preview, stream, presign và download file content.
- Frontend action visibility dùng helper `getDocumentAccessDecision(...)` để hiện lý do bị chặn.

**Ý nghĩa**

- Hệ thống không còn chỉ check role đơn giản.
- Người dùng không thể đoán docId để xem detail/history/comment/ACL khi không có quyền.
- Compliance Officer đúng vai trò kiểm toán: xem audit/metadata theo policy, không xem nội dung file.

**Cách kiểm tra thủ công**

1. Đăng nhập `editor1`, tạo document và upload file.
2. Submit document sang Pending.
3. Đăng nhập `approver1`, approve document thành Published.
4. Đăng nhập `viewer1`, thử xem/download document Published nếu ACL cho phép.
5. Đăng nhập `co1`, vào detail/audit để kiểm tra metadata/audit, sau đó thử preview/download:
   - Kết quả đúng: preview/download bị deny.
6. Tạo document `CONFIDENTIAL` hoặc `SECRET`, thử download bằng viewer không có ACL:
   - Kết quả đúng: deny hoặc không có direct presigned URL.

**Lệnh test liên quan**

```bash
pnpm --filter metadata-service test
pnpm --filter web test -- permissions.spec.ts document-preview-dialog.spec.ts
pnpm test:e2e
```

### 3.4. Audit ingestion boundary

**Đã làm**

- `POST /audit/events` là endpoint internal.
- Muốn ghi audit event phải có header `x-docvault-service-token`.
- Token này được validate bằng `AUDIT_INGEST_TOKEN`.
- Gateway và audit-service cùng chặn user JWT thường append audit giả.

**Ý nghĩa**

- Audit trail đáng tin cậy hơn vì user thường không thể tự tạo event "giả".
- Hash-chain audit chỉ có ý nghĩa khi nguồn ghi event bị kiểm soát.

**Cách kiểm tra**

1. Đảm bảo `AUDIT_INGEST_TOKEN` giống nhau trong:
   - `services/gateway/.env`
   - `services/metadata-service/.env`
   - `services/document-service/.env`
   - `services/audit-service/.env`
2. Chạy:

```bash
pnpm --filter audit-service test -- service-token.guard.spec.ts
pnpm --filter gateway test
pnpm test:e2e
```

3. Trong E2E, viewer thường gọi audit ingest phải bị deny.

### 3.5. Audit hash-chain và tamper evidence

**Đã làm**

- Mỗi audit event có `prevHash` và `hash`.
- Có endpoint verify-chain:
  - Backend: `GET /audit/verify-chain`
  - Gateway/API: `/api/audit/verify-chain`
- Web Audit page có action verify chain.
- Có script demo sửa event cũ trong MongoDB để chain invalid.
- Evidence packet ghi lại audit-chain status tại thời điểm export.

**Ý nghĩa**

- Audit log là tamper-evident: nếu ai đó sửa event cũ trong storage, verify-chain sẽ báo invalid.
- Đây không phải blockchain và không làm log bất biến tuyệt đối; nó dùng để phát hiện log bị sửa.

**Cách kiểm tra**

```bash
pnpm --filter audit-service test -- audit-hash.spec.ts
pnpm --filter audit-service audit:tamper-demo:test
```

Demo local an toàn:

```bash
pnpm --filter audit-service audit:tamper-demo -- --dry-run
```

Chỉ khi muốn cố tình sửa dữ liệu demo local mới chạy:

```powershell
$env:DOCVAULT_ALLOW_AUDIT_TAMPER_DEMO='true'
pnpm --filter audit-service audit:tamper-demo -- --apply
```

Sau đó mở trang Audit và bấm Verify Chain. Kết quả kỳ vọng: `valid=false`.

### 3.6. Malware scan khi upload

**Đã làm**

- Document-service scan file upload trước khi ghi MinIO.
- Chế độ demo mặc định `local-eicar` chặn EICAR payload.
- Có chế độ optional `clamav`.
- Nếu malware bị phát hiện:
  - không ghi object vào MinIO
  - không tạo metadata version chính thức
  - emit audit `MALWARE_UPLOAD_BLOCKED`

**Ý nghĩa**

- DocVault có lớp threat protection như các DMS enterprise.
- Demo bằng EICAR giúp chứng minh flow chặn malware mà không cần file độc hại thật.

**Cách kiểm tra**

1. Đặt mode demo:

```env
MALWARE_SCANNER_MODE=local-eicar
```

2. Tạo file EICAR test và upload qua UI hoặc E2E.
3. Kết quả đúng:
   - upload bị deny
   - không có version mới
   - audit có `MALWARE_UPLOAD_BLOCKED`

Unit test:

```bash
pnpm --filter document-service test -- malware-scanner.service.spec.ts documents.service.spec.ts
```

### 3.7. DLP và classification guard

**Đã làm**

- DLP scan phát hiện:
  - email
  - phone/national-id-like values
  - keyword `secret`, `confidential`, `internal only`
- Nếu tài liệu `PUBLIC` / `INTERNAL` có DLP hit, hệ thống escalate lên `CONFIDENTIAL`.
- Non-admin không được downgrade tài liệu có DLP hit xuống `PUBLIC`.
- Admin downgrade override phải nhập `classificationOverrideReason`.
- Audit event liên quan:
  - `DLP_PATTERN_DETECTED`
  - `DLP_CLASSIFICATION_DOWNGRADE_DENIED`
  - `DLP_CLASSIFICATION_OVERRIDE_APPROVED`
- Web document detail hiện DLP evidence nhưng không hiện raw sensitive value.

**Ý nghĩa**

- Tránh public hóa tài liệu có dữ liệu nhạy cảm.
- Admin vẫn có đường override có lý do và có audit, phù hợp với compliance workflow.
- UI chỉ hiện count/category/severity, không rò rỉ nội dung sensitive.

**Cách kiểm tra thủ công**

1. Đăng nhập `editor1`.
2. Tạo/upload file có nội dung ví dụ:

```text
confidential internal only contact test@example.com
```

3. Kiểm tra document detail:
   - classification bị gợi ý/escalate lên `CONFIDENTIAL`
   - DLP evidence hiện category/count/severity
4. Thử edit classification xuống `PUBLIC` bằng editor:
   - Kết quả đúng: bị deny.
5. Đăng nhập admin, thử downgrade và nhập override reason:
   - Kết quả đúng: được chấp nhận và có audit override.

Test:

```bash
pnpm --filter metadata-service test -- documents.service.spec.ts
pnpm --filter document-service test -- documents.service.spec.ts
pnpm --filter web test
```

### 3.8. Encryption at rest và download posture

**Đã làm**

- MinIO local bucket init có SSE-S3.
- `PUBLIC` / `INTERNAL` Published có thể nhận presigned URL ngắn hạn nếu policy cho phép.
- `CONFIDENTIAL` / `SECRET` đánh dấu `watermarkRequired=true`.
- Khi `watermarkRequired=true`, response không trả direct `url`, chỉ trả `streamingEndpoint`.
- Stream path re-authorize/verify grant token và watermark trước khi trả file.
- Compliance Officer luôn bị chặn preview/stream/presign/download.

**Ý nghĩa**

- File nhạy cảm không lộ direct presigned URL để tải thẳng từ object storage.
- Luồng stream qua service cho phép enforce watermark và audit.
- Có câu trả lời rõ cho câu hỏi "file được mã hóa và tải về an toàn như thế nào".

**Cách kiểm tra**

1. Tạo tài liệu `CONFIDENTIAL`, approve thành `PUBLISHED`.
2. Gọi download authorize bằng editor/owner.
3. Kết quả đúng:
   - `url: null`
   - `watermarkRequired: true`
   - có `streamingEndpoint`
4. Mở streaming endpoint để tải file qua controlled path.
5. Thử cùng thao tác bằng `co1`:
   - Kết quả đúng: deny.

E2E đã cover:

```bash
pnpm test:e2e
```

### 3.9. Security dashboard và recommendation engine

**Đã làm**

- Web page: `/security`.
- Chỉ Compliance Officer/Admin được xem.
- Dashboard hiện:
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
- Recommendation engine tạo action deterministic từ audit metadata, không dùng file content.
- Khi xem recommendation, audit event `SECURITY_RECOMMENDATIONS_VIEWED` được ghi với ids/counts/types/filter, không ghi token hay nội dung file.
- Recommendation có workflow trạng thái qua `PATCH /audit/security-recommendations/:id/workflow`.
- Enum workflow: `OPEN`, `INVESTIGATING`, `REVIEWED`, `RESOLVED`; security summary overlay `recommendation.workflow`, mặc định `OPEN` nếu chưa có event workflow.
- Khi cập nhật workflow, audit event `SECURITY_RECOMMENDATION_STATUS_UPDATED` được ghi với `resourceType=SECURITY_RECOMMENDATION`, `resourceId` là recommendation id.
- Recommendation card có History timeline để xem lịch sử workflow metadata-only.
- History endpoint:
  - `GET /audit/security-recommendations/:id/workflow-history`
- Workflow history chỉ trả metadata entries:
  - `eventId`
  - `status`
  - `note?`
  - `updatedAt`
  - `updatedBy`
- Recommendation card có action download evidence packet JSON.
- Recommendation evidence packet được tạo client-side từ recommendation, audit-chain status và workflow history.
- Packet là metadata-only và có `excludedSensitiveFields` để ghi rõ các trường nhạy cảm bị loại trừ.
- Recommendation card có Playbook deterministic:
  - owner gợi ý theo loại recommendation
  - SLA target theo severity
  - due date tính từ lần workflow update gần nhất
  - checklist triage/investigate/review/resolve tự cập nhật theo workflow status

**Ý nghĩa**

- Đây là điểm vượt lên web quản lý tài liệu thông thường: compliance/admin có màn hình an ninh tổng hợp và có hành động gợi ý.
- Recommendation deterministic giúp demo ổn định, không phụ thuộc LLM.
- Không đưa file content/object key/presigned URL/grant token vào recommendation metadata.
- Workflow recommendation giúp compliance/admin ghi nhận điều tra/review/resolve mà vẫn giữ audit trail metadata-safe.
- History timeline giúp chứng minh tiến trình xử lý recommendation mà không mở rộng quyền xem nội dung file.
- Evidence packet JSON giúp xuất bằng chứng kiểm toán riêng cho recommendation, vẫn loại trừ file content, object key, presigned URL và grant token.
- Playbook biến recommendation từ cảnh báo tĩnh thành quy trình xử lý có owner, SLA và checklist, giúp demo rõ hơn phần vận hành sau phát hiện rủi ro.

**Cách sử dụng**

1. Chạy web:

```bash
pnpm --filter web dev
```

2. Mở:

```text
http://localhost:3006/security
```

3. Đăng nhập bằng `co1` hoặc `admin1`.
4. Bấm các link Open audit trong quick filters, risky documents, behavior anomalies hoặc recommendations.
5. Kiểm tra trang Audit được mở với filter tương ứng.
6. Cập nhật workflow cho một recommendation qua UI hoặc API:

```json
{
  "status": "INVESTIGATING",
  "note": "Đang kiểm tra chuỗi deny liên quan."
}
```

7. Gọi lại `GET /audit/security-summary` và kiểm tra recommendation tương ứng có `workflow.status`.
8. Mở Audit và lọc `action=SECURITY_RECOMMENDATION_STATUS_UPDATED`, `resourceType=SECURITY_RECOMMENDATION`, `resourceId=<recommendation-id>`.
9. Kiểm tra metadata audit chỉ có dữ liệu như `recommendationId`, `status`, `note`; không có file content, object key, presigned URL hoặc grant token.
10. Mở History trên recommendation card và kiểm tra timeline có entry metadata-only tương ứng với status vừa cập nhật.
11. Download evidence packet JSON từ recommendation card.
12. Kiểm tra packet có recommendation, audit-chain status, playbook, workflow history và `excludedSensitiveFields`; không có file content, object key, presigned URL hoặc grant token.
13. Kiểm tra Playbook hiển thị owner gợi ý, SLA badge, due date và checklist đổi trạng thái theo workflow.

**Cách test**

```bash
pnpm --filter audit-service test -- security-summary.spec.ts
pnpm --filter web test -- security-dashboard.spec.ts
pnpm --filter audit-service build
pnpm --filter web exec tsc --noEmit
pnpm --filter web build
```

### 3.10. Evidence Center

**Đã triển khai**

- Web page: `/evidence`.
- Role: compliance/admin.
- Source cards cho:
  - Audit Chain
  - Recommendation Packets
  - Retention Evidence
  - Document Packets
- Export `docvault-evidence-center-manifest.json`.
- Export từng recommendation evidence packet trực tiếp từ Evidence Center.
- Export từng document evidence packet từ retention evidence records.
- Manifest và document packet export là metadata-only và ghi `excludedSensitiveFields`.
- Document packet export loại bỏ cả alias nhạy cảm như `storagePath` và `downloadToken`, ngoài `objectKey`, `presignedUrl`, `grantToken`, `fileContent`.
- Evidence Bundle Builder cho phép chọn nhiều recommendation/document packet và export một case bundle manifest metadata-only.

**Ý nghĩa**

- Gom bằng chứng compliance vào một workspace riêng thay vì bắt người demo nhảy qua nhiều trang.
- Tạo “demo bundle manifest” để trình bày báo cáo: audit-chain, recommendation ids, document packet ids, retention summary.
- Tạo case bundle manifest có counts, checklist, audit-chain status, retention summary và danh sách packet đã chọn để trình bày một hồ sơ kiểm toán có cấu trúc.
- Không phải DevSecOps; đây là tính năng web/runtime compliance evidence.

**Cách sử dụng**

1. Đăng nhập `co1` hoặc admin.
2. Mở:

```text
http://localhost:3006/evidence
```

3. Kiểm tra 4 source cards.
4. Nhấn `Export manifest`.
5. Kiểm tra manifest có `metadataOnly`, `excludedSensitiveFields`, audit-chain status, recommendation packet ids và document packet ids.
6. Export một recommendation packet.
7. Export một document evidence packet.
8. Tick các packet cần gom vào bundle, hoặc dùng `Select recommendations` / `Select documents`.
9. Nhấn `Export bundle`.
10. Kiểm tra bundle manifest có `metadataOnly`, `excludedSensitiveFields`, counts, checklist, audit-chain status, retention summary và packet filenames.
11. Dùng deep link sang Audit/Security/Retention/Document detail để chỉ ra evidence chain.

**Cách test**

```bash
pnpm --filter web test -- evidence-center.spec.ts
pnpm --filter web exec tsc --noEmit
```

### 3.11. Retention và records management

**Đã làm**

- Metadata-service lưu:
  - `retentionClass`
  - `retentionUntil`
  - `retentionReason`
- Khi document được approve/publish, retention được tính theo classification:
  - `PUBLIC_730D`
  - `INTERNAL_365D`
  - `CONFIDENTIAL_180D`
  - `SECRET_30D`
- Endpoint:
  - `GET /metadata/retention/documents`
  - `POST /metadata/retention/run`
- Due records được auto-archive thành `ARCHIVED`.
- Workflow history ghi `action=RETENTION`, `actorId=system:retention`.
- Audit ghi `DOCUMENT_AUTO_ARCHIVED`.
- Web page: `/retention`.

**Ý nghĩa**

- DocVault có records management/compliance lifecycle, không chỉ là CRUD document.
- Có bằng chứng document được lưu giữ theo classification và auto-archive khi quá hạn.

**Cách sử dụng**

1. Đăng nhập `co1` hoặc `admin1`.
2. Mở:

```text
http://localhost:3006/retention
```

3. Xem các cột retention class, deadline, status, days remaining.
4. Admin có thể chạy retention demo endpoint nếu UI/action có hỗ trợ trong flow local.

**Cách test**

```bash
pnpm --filter metadata-service test
pnpm test:e2e
```

### 3.12. One-click compliance evidence packet

**Đã làm**

- Compliance/admin có thể export evidence packet theo document:
  - `GET /metadata/documents/:docId/evidence-packet`
- Packet gồm:
  - metadata
  - version checksum
  - ACL
  - workflow history
  - retention evidence
  - audit hash-chain status
  - related audit events
- Packet không gồm:
  - file content
  - object key
  - storage path alias
  - presigned URL
  - preview grant
  - download grant token / download token alias
- Security dashboard cũng có recommendation evidence packet JSON metadata-only, tạo client-side từ recommendation + audit-chain status + playbook + workflow history và ghi `excludedSensitiveFields`.
- Viewer/editor/approver không có role compliance/admin sẽ bị deny.

**Ý nghĩa**

- Rất hữu ích khi báo cáo/demo: một endpoint gom đủ bằng chứng compliance cho tài liệu.
- Bảo đảm compliance officer xem đủ evidence nhưng vẫn không xem nội dung file.

**Cách kiểm tra**

1. Đăng nhập `co1`.
2. Mở document detail có quyền metadata.
3. Chọn action export evidence packet nếu UI hiện.
4. Kiểm tra JSON không có grant token/presigned URL/file content.
5. Đăng nhập `viewer1` và gọi cùng endpoint:
   - Kết quả đúng: 403.

Test:

```bash
pnpm --filter gateway test -- metadata.proxy.controller.spec.ts
pnpm test:e2e
```

### 3.13. AI-ready guardrails

**Đã làm**

- Endpoint:
  - `GET /metadata/documents/:docId/ai-guardrails`
- Trước khi trả AI context decision, endpoint check `assertCanReadMetadata(...)`.
- Response tách rõ:
  - metadata-safe operations: classification/tagging
  - content operations: summarization/Q&A
- Compliance Officer chỉ được metadata-only, bị deny content operations.
- Response không trả file content, object key, presigned URL hay grant token.
- Audit event: `AI_GUARDRAILS_EVALUATED`.
- Web document detail có card AI guardrails.

**Ý nghĩa**

- Đây là nền tảng đúng để tích hợp LLM sau này mà không phá policy hiện tại.
- AI không được đọc nội dung mà user không có quyền đọc.
- Compliance Officer không được dùng AI để "đi vòng" vào nội dung file.

**Cách kiểm tra**

```bash
pnpm --filter metadata-service test -- policy.service.spec.ts
pnpm --filter gateway test -- metadata.proxy.controller.spec.ts
pnpm --filter web test -- document-ai-guardrails-card.spec.ts
```

Kiểm tra thủ công:

1. Mở document detail.
2. Xem AI guardrails card.
3. Đăng nhập `co1` và xác nhận content summarization/Q&A bị deny.

### 3.14. Access impact preview

**Đã làm**

- Endpoint:
  - `POST /metadata/documents/:docId/access-impact`
- Gateway proxy:
  - `POST /metadata/documents/:docId/access-impact`
- Web edit document hiện access impact card khi classification mới khác classification hiện tại.
- Response cho biết:
  - current/proposed classification
  - watermark posture
  - access expansion/reduction warning
  - DLP override requirement
  - role-level metadata/download delta
- Không enumerate user thật và không trả file content/grant/object key.
- Audit event: `DOCUMENT_ACCESS_IMPACT_SIMULATED`.

**Ý nghĩa**

- Trước khi hạ classification, editor/admin thấy được rủi ro mở rộng truy cập.
- Đây là tính năng enterprise-like vì nó giải thích tác động policy trước khi mutate metadata.

**Cách kiểm tra**

1. Đăng nhập owner editor hoặc admin.
2. Mở document edit.
3. Đổi classification, ví dụ `CONFIDENTIAL -> PUBLIC`.
4. Xem access impact card.
5. Nếu document có DLP hit, kiểm tra UI cảnh báo override requirement.

Test:

```bash
pnpm --filter metadata-service test -- policy.service.spec.ts
pnpm --filter gateway test -- metadata.proxy.controller.spec.ts
pnpm --filter web test -- document-access-impact-card.spec.ts
```

### 3.15. Shared auth/contracts và OpenAPI alignment

**Đã làm**

- Các service downstream re-export `Roles`, `ROLES_KEY`, `RolesGuard` từ `@docvault/auth/rbac`.
- OpenAPI gateway contract được cập nhật cho:
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

**Ý nghĩa**

- Giảm drift giữa frontend/backend/contract.
- Swagger/OpenAPI đúng hơn với runtime, tiện cho báo cáo và demo API.

**Cách kiểm tra**

```bash
pnpm --filter @docvault/auth build
pnpm --filter gateway build
pnpm --filter gateway test
node -e "const fs=require('fs'); const yaml=require('js-yaml'); yaml.load(fs.readFileSync('libs/contracts
```

## 4. Hướng dẫn chạy local để demo các tính năng

### 4.1. Chuẩn bị

Yêu cầu:

- Node.js 20+
- pnpm 9+
- Docker Desktop / Docker Engine

Cài dependency:

```bash
pnpm install
```

Start infra local:

```bash
docker compose -f infra/docker-compose.dev.yml --env-file infra/.env up -d
```

Chạy migration metadata:

```bash
pnpm --filter metadata-service prisma:deploy
```

### 4.2. Chạy backend

Cách dễ theo dõi log nhất là mở từng terminal:

```bash
pnpm --filter metadata-service start:dev
pnpm --filter audit-service start:dev
pnpm --filter document-service start:dev
pnpm --filter notification-service start:dev
pnpm --filter workflow-service start:dev
pnpm --filter gateway start:dev
```

Hoặc dùng script root nếu môi trường local đã cấu hình ổn định:

```bash
pnpm start:sequential
```

### 4.3. Chạy frontend

Package web hiện cấu hình mặc định port `3006`:

```bash
pnpm --filter web dev
```

Mở:

```text
http://localhost:3006
```

API base mặc định:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
```

### 4.4. Tài khoản demo

Password seed mặc định: `Passw0rd!`

| Username | Role | Mục đích demo |
|---|---|---|
| `viewer1` | `viewer` | Xem/download tài liệu Published nếu policy cho phép |
| `editor1` | `editor` | Tạo document, upload, submit, edit metadata |
| `approver1` | `approver` | Approve/reject Pending document |
| `co1` | `compliance_officer` | Xem audit/security/retention/evidence, không xem file content |
| `admin1` | `admin` | Thao tác admin và override có audit reason |

## 5. Checklist test nhanh theo mục tiêu demo

### 5.1. Test tự động đầy đủ nhất

Sau khi local stack đang chạy:

```bash
pnpm test:e2e
```

Kết quả kỳ vọng:

- Unauthorized/expired token bị reject.
- Viewer không tạo document được.
- Editor tạo/upload/submit được.
- Approver approve được.
- Viewer download Published document khi policy cho phép.
- Confidential/Secret không lộ direct presigned URL.
- Compliance Officer preview/download/stream bị deny.
- Compliance Officer audit query/verify-chain/security summary được allow.
- Malware EICAR upload bị chặn.
- DLP upload escalate classification.
- DLP downgrade bị chặn nếu không có override hợp lệ.
- Evidence packet có metadata/version/workflow/retention/audit evidence.
- Recommendation evidence packet có recommendation metadata, audit-chain status, playbook, workflow history và `excludedSensitiveFields`.
- Viewer bị deny evidence packet/audit ingest.
- Retention auto-archive tạo workflow history và audit.

### 5.2. Test backend theo service

```bash
pnpm --filter metadata-service test
pnpm --filter document-service test
pnpm --filter audit-service test
pnpm --filter gateway test
```

### 5.3. Test frontend

```bash
pnpm --filter web test
pnpm --filter web exec tsc --noEmit
pnpm --filter web lint
pnpm --filter web build
```

Lưu ý: lần verify gần nhất có web lint pass với 0 error và còn một số warning sẵn có ở các component/hook cũ.

### 5.4. Test OpenAPI

```bash
node -e "const fs=require('fs'); const yaml=require('js-yaml'); yaml.load(fs.readFileSync('libs/contracts
```

### 5.5. Test tamper audit local

```bash
pnpm --filter audit-service audit:tamper-demo:test
pnpm --filter audit-service audit:tamper-demo -- --dry-run
```

Chỉ sửa dữ liệu local khi cần demo tamper:

```powershell
$env:DOCVAULT_ALLOW_AUDIT_TAMPER_DEMO='true'
pnpm --filter audit-service audit:tamper-demo -- --apply
```

Sau đó mở `/audit` và verify chain.

## 6. Checklist sử dụng trên UI

| Trang | URL local | Role nên dùng | Kiểm tra |
|---|---|---|---|
| Documents | `http://localhost:3006/documents` | viewer/editor/admin | List, detail, preview/download button policy |
| New Document | `http://localhost:3006/documents/new` | editor/admin | Tạo document và upload file |
| Document Detail | `http://localhost:3006/documents/:id` | editor/approver/co/admin | DLP evidence, AI guardrails, evidence packet |
| Document Edit | `http://localhost:3006/documents/:id/edit` | owner editor/admin | Access impact preview khi đổi classification |
| Approvals | `http://localhost:3006/approvals` | approver/admin | Approve/reject Pending document |
| Evidence | `http://localhost:3006/evidence` | compliance/admin | Export evidence manifest, recommendation packets, document packets |
| Audit | `http://localhost:3006/audit` | compliance/admin | Query audit, quick filters, verify chain |
| Security | `http://localhost:3006/security` | compliance/admin | Counters, alerts, risk scoring, anomalies, recommendations, playbook, recommendation history/evidence packet |
| Retention | `http://localhost:3006/retention` | compliance/admin | Retention status và records evidence |

## 7. Demo flow để trình bày với giảng viên

1. Đăng nhập `editor1`.
2. Tạo document mới, upload file bình thường.
3. Submit document.
4. Đăng nhập `approver1`, approve document.
5. Đăng nhập `viewer1`, mở document và download nếu policy cho phép.
6. Tạo/upload tài liệu có nội dung nhạy cảm, ví dụ có email và keyword `confidential`.
7. Chỉ ra DLP evidence và classification escalation.
8. Tạo/upload EICAR test file để chứng minh malware bị chặn.
9. Đăng nhập `co1`.
10. Vào `/audit`, query event và verify hash-chain.
11. Thử preview/download document bằng `co1` và chỉ ra bị deny.
12. Vào `/security`, trình bày:
    - deny/malware/DLP counters
    - risky documents
    - behavior anomaly
    - security recommendations
13. Đổi workflow status của một recommendation và chỉ ra Playbook cập nhật checklist/SLA.
14. Mở History timeline và download recommendation evidence packet JSON.
15. Chỉ ra recommendation packet có playbook, `excludedSensitiveFields` và không có file content/object key/presigned URL/grant token.
16. Vào `/evidence`, export manifest, recommendation packet và document evidence packet.
17. Tick nhiều packet, export Evidence Bundle manifest và chỉ ra checklist/counts/packet filenames.
18. Chỉ ra manifest có `metadataOnly`, audit-chain status, recommendation ids, document packet ids và `excludedSensitiveFields`.
19. Vào document detail, export evidence packet và chỉ ra packet không có file content/object key/storage path/token.
20. Vào `/retention`, trình bày retention class/deadline/status.
21. Vào edit document, đổi classification để xem access impact preview.

## 8. Điểm cần nói rõ trong báo cáo

- Hash-chain là tamper-evident, không phải blockchain và không thay thế immutable storage.
- AI hiện tại là AI-ready guardrails / deterministic security intelligence, chưa phải LLM summarization/QA thật.
- Malware scanning local dùng EICAR deterministic mode; ClamAV là optional mode.
- MinIO SSE là encryption-at-rest MVP; hướng nâng cao là Vault/KMS/client-side encryption/E2EE.
- Compliance Officer có thể xem audit/metadata/evidence theo policy, nhưng không được xem file content.
- Security Recommendation Engine chỉ dùng audit metadata, không đưa nội dung file, object key, presigned URL hay grant token vào output/audit.
- Recommendation history và recommendation evidence packet cũng metadata-only; packet ghi `excludedSensitiveFields` để chứng minh các trường nhạy cảm đã bị loại trừ.
- Recommendation Playbook là lớp điều phối deterministic trên metadata/workflow, không phải DevSecOps pipeline và không mở quyền xem file content.
- Evidence Center là workspace runtime để gom/export evidence; Evidence Bundle manifest chỉ là metadata index có checklist/counts, document packet export được scrub các content-bearing fields trước khi tải xuống.

## 9. Verification đã ghi nhận gần nhất

Theo evidence hiện tại, các lệnh sau đã được chạy và pass trong đợt verify gần nhất:

```bash
pnpm --filter audit-service test
pnpm --filter audit-service build
pnpm --filter gateway test
pnpm --filter gateway build
pnpm --filter web test
pnpm --filter web exec tsc --noEmit
pnpm --filter web lint
pnpm --filter web build
```

OpenAPI YAML parse check: openapi ok

```bash
git diff --check
pnpm test:e2e
```

Ghi chú:

- web lint pass với 0 error và còn 5 warning sẵn có.
- git diff --check pass, Git chỉ cảnh báo line-ending conversion.
- pnpm test:e2e cần local stack đang chạy.

## 10. Việc còn nên làm nếu muốn polish thêm

1. Chụp ảnh UI các trang `/security`, `/audit`, `/retention`, document detail và access impact preview để đưa vào báo cáo.
2. Tạo bảng completion matrix ngắn trong slide: W-P item, status, file evidence, command test.
3. Chụp evidence workflow security recommendation: chuyển `OPEN -> INVESTIGATING -> REVIEWED/RESOLVED`, chỉ ra Playbook owner/SLA/checklist, mở History timeline, tải recommendation evidence packet JSON và audit event tương ứng.
4. Chụp `/evidence`: source cards, export manifest, export recommendation packet, export document packet.
5. Chụp Evidence Bundle Builder: chọn nhiều packet, export bundle manifest, chỉ ra checklist/counts.
6. Nếu muốn claim AI thật, cần bổ sung LLM summarization/QA có enforcement policy; hiện tại nên claim là AI-ready.
7. Nếu muốn production-like encryption, bổ sung Vault/KMS hoặc client-side encryption trong future work.
