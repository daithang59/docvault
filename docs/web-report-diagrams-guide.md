# Hướng dẫn vẽ và chèn sơ đồ web vào báo cáo DocVault

Tài liệu này hướng dẫn vẽ các sơ đồ nên bổ sung cho phần web/runtime của DocVault, không bao gồm pipeline DevSecOps.

Report LaTeX đã cấu hình `\graphicspath` trỏ tới `../docs/images/web/`, nên sau khi render Mermaid, hãy đặt file ảnh PNG vào:

```text
docs/images/web/
```

Khi chèn vào LaTeX, chỉ cần dùng tên file, ví dụ:

```tex
\includegraphics[width=\textwidth]{web-runtime-architecture.png}
```

## Quy trình chung

1. Tạo thư mục chứa source Mermaid:

```powershell
New-Item -ItemType Directory -Force docs\diagrams\web
```

2. Với mỗi sơ đồ bên dưới, lưu phần Mermaid vào file `.mmd`, ví dụ:

```text
docs/diagrams/web/01-web-runtime-architecture.mmd
```

3. Render ra PNG bằng Mermaid CLI:

```powershell
pnpm dlx @mermaid-js/mermaid-cli -i docs/diagrams/web/01-web-runtime-architecture.mmd -o docs/images/web/web-runtime-architecture.png -t neutral -b white -s 2
```

Nếu không muốn dùng CLI, có thể mở Mermaid Live Editor, dán code Mermaid, export PNG, rồi lưu đúng tên file trong `docs/images/web/`.

4. Chèn snippet LaTeX tương ứng vào file chương được gợi ý.

5. Build lại report và kiểm tra `\listoffigures` tự cập nhật.

## Danh sách hình nên thêm

| STT | File PNG | Vị trí nên chèn | Mục đích |
| --- | --- | --- | --- |
| 1 | `web-runtime-architecture.png` | `report/chapters/05_trien_khai_ung_dung.tex`, sau đoạn giới thiệu Frontend Next.js | Giải thích web app kết nối Auth, API client, gateway và service backend như thế nào. |
| 2 | `web-role-screen-map.png` | `report/chapters/03_phan_tich_thiet_ke.tex`, sau bảng tác nhân hoặc phần yêu cầu chức năng | Thể hiện màn hình/chức năng theo từng vai trò. |
| 3 | `document-lifecycle-state.png` | `report/chapters/04_du_lieu_api_bao_mat.tex`, thay block `lstlisting` vòng đời tài liệu | Trình bày state machine rõ hơn dạng text. |
| 4 | `download-authorization-sequence.png` | `report/chapters/04_du_lieu_api_bao_mat.tex`, thay block `lstlisting` download authorization | Làm rõ grant token, policy check và stream qua gateway. |
| 5 | `compliance-evidence-flow.png` | `report/chapters/05_trien_khai_ung_dung.tex` hoặc `07_kiem_thu_danh_gia.tex` | Làm rõ Audit, Security, Evidence, Retention, Access Review liên kết thế nào. |
| 6 | `sso-session-sequence.png` | `report/chapters/05_trien_khai_ung_dung.tex`, phần Frontend hoặc Auth | Bổ sung luồng SSO Keycloak và session frontend. |
| 7 | `document-detail-composition.png` | `report/chapters/05_trien_khai_ung_dung.tex`, sau đoạn mô tả Document Detail | Cho thấy trang chi tiết tài liệu không chỉ là xem metadata mà là trung tâm nghiệp vụ. |

## 1. Kiến trúc web runtime

Lưu thành:

```text
docs/diagrams/web/01-web-runtime-architecture.mmd
```

Render:

```powershell
pnpm dlx @mermaid-js/mermaid-cli -i docs/diagrams/web/01-web-runtime-architecture.mmd -o docs/images/web/web-runtime-architecture.png -t neutral -b white -s 2
```

Mermaid:

```mermaid
%%{init: {"theme": "neutral", "flowchart": {"curve": "basis", "htmlLabels": true}}}%%
flowchart TB
  User["Người dùng<br/>Browser"]

  subgraph Web["Frontend Next.js - apps/web"]
    Pages["App Router pages<br/>dashboard, documents, approvals, audit, security, evidence"]
    Shell["AppShell<br/>Sidebar, topbar, command palette"]
    Providers["AppProvider<br/>ThemeProvider, QueryProvider, AuthProvider"]
    ApiClient["Axios apiClient<br/>Bearer token, refresh on 401, error normalization"]
    NextApi["Next API routes<br/>/api/auth/* và /api/[...path] proxy"]
  end

  Keycloak["Keycloak<br/>SSO, realm roles, JWT"]
  Gateway["API Gateway<br/>JWT validation, RBAC route guard, proxy, context headers"]

  subgraph Services["Backend services"]
    Metadata["metadata-service<br/>documents, ACL, policy, retention, evidence packet"]
    Document["document-service<br/>upload, malware/DLP scan, preview, stream, MinIO/S3"]
    Workflow["workflow-service<br/>submit, approve, reject, archive, delete"]
    Audit["audit-service<br/>audit query, verify-chain, security summary"]
    Notify["notification-service<br/>workflow/security/retention notifications"]
  end

  subgraph Data["Runtime data stores"]
    PostgreSQL["PostgreSQL<br/>metadata DB"]
    MongoDB["MongoDB<br/>audit DB"]
    MinIO["MinIO/S3<br/>file objects"]
  end

  User --> Pages
  Pages --> Shell
  Pages --> Providers
  Providers --> ApiClient
  ApiClient --> NextApi
  NextApi --> Gateway

  NextApi <-->|login/callback/logout| Keycloak
  Gateway --> Metadata
  Gateway --> Document
  Gateway --> Workflow
  Gateway --> Audit
  Gateway --> Notify

  Metadata --> PostgreSQL
  Audit --> MongoDB
  Document --> MinIO
  Workflow --> Metadata
  Workflow --> Audit
  Workflow --> Notify
  Document --> Metadata
  Document --> Audit
```

Chèn vào LaTeX:

```tex
\begin{figure}[H]
\centering
\includegraphics[width=\textwidth]{web-runtime-architecture.png}
\caption{Kiến trúc runtime của frontend DocVault}
\label{fig:web-runtime-architecture}
\end{figure}
```

## 2. Sơ đồ role và màn hình web

Lưu thành:

```text
docs/diagrams/web/02-web-role-screen-map.mmd
```

Render:

```powershell
pnpm dlx @mermaid-js/mermaid-cli -i docs/diagrams/web/02-web-role-screen-map.mmd -o docs/images/web/web-role-screen-map.png -t neutral -b white -s 2
```

Mermaid:

```mermaid
%%{init: {"theme": "neutral", "flowchart": {"curve": "basis", "htmlLabels": true}}}%%
flowchart LR
  subgraph Roles["Vai trò"]
    Viewer["Viewer"]
    Editor["Editor"]
    Approver["Approver"]
    Compliance["Compliance Officer"]
    Admin["Admin"]
    ShareUser["Người có share token"]
  end

  subgraph Common["Màn hình chung sau đăng nhập"]
    Dashboard["Dashboard"]
    Documents["Documents"]
    Notifications["Notifications"]
    Profile["Profile"]
    Settings["Settings"]
  end

  subgraph EditorScreens["Editor/Admin"]
    MyDocs["My Documents"]
    NewDoc["New Document"]
    EditDoc["Edit Document"]
    Trash["Trash / Restore"]
  end

  subgraph ApprovalScreens["Approver/Admin"]
    Approvals["Approvals<br/>SLA summary, review drawer"]
  end

  subgraph ComplianceScreens["Compliance/Admin"]
    Audit["Audit"]
    Security["Security posture"]
    Evidence["Evidence Center"]
    Retention["Retention"]
    AccessReview["Access Review"]
  end

  subgraph AdminScreens["Admin"]
    Members["Members"]
  end

  Shared["Shared route<br/>/shared?token=..."]
  Detail["Document Detail<br/>metadata, versions, workflow, ACL, comments, evidence links"]

  Viewer --> Common
  Editor --> Common
  Approver --> Common
  Compliance --> Common
  Admin --> Common

  Viewer --> Detail
  Editor --> Detail
  Approver --> Detail
  Compliance --> Detail
  Admin --> Detail

  Editor --> EditorScreens
  Admin --> EditorScreens
  Approver --> ApprovalScreens
  Admin --> ApprovalScreens
  Compliance --> ComplianceScreens
  Admin --> ComplianceScreens
  Admin --> AdminScreens
  ShareUser --> Shared --> Detail
```

Chèn vào LaTeX:

```tex
\begin{figure}[H]
\centering
\includegraphics[width=\textwidth]{web-role-screen-map.png}
\caption{Phân quyền truy cập màn hình web theo vai trò}
\label{fig:web-role-screen-map}
\end{figure}
```

## 3. State machine vòng đời tài liệu

Lưu thành:

```text
docs/diagrams/web/03-document-lifecycle-state.mmd
```

Render:

```powershell
pnpm dlx @mermaid-js/mermaid-cli -i docs/diagrams/web/03-document-lifecycle-state.mmd -o docs/images/web/document-lifecycle-state.png -t neutral -b white -s 2
```

Mermaid:

```mermaid
%%{init: {"theme": "neutral"}}%%
stateDiagram-v2
  [*] --> DRAFT: Editor/Admin tạo tài liệu

  DRAFT --> DRAFT: cập nhật metadata / upload version
  DRAFT --> PENDING: submit<br/>Editor owner hoặc Admin
  PENDING --> PUBLISHED: approve<br/>Approver hoặc Admin
  PENDING --> DRAFT: reject(reason)<br/>Approver hoặc Admin
  PUBLISHED --> ARCHIVED: archive<br/>Editor owner hoặc Admin
  PUBLISHED --> ARCHIVED: retention auto-archive
  DRAFT --> DELETED: soft delete<br/>Editor owner hoặc Admin
  DELETED --> DRAFT: restore trong recovery window

  ARCHIVED --> [*]

  note right of PENDING
    Trang Approvals hiển thị hàng đợi PENDING,
    SLA summary, readiness và review drawer.
  end note

  note right of ARCHIVED
    ARCHIVED vẫn có thể xem metadata/preview
    theo policy, nhưng download bị giới hạn.
  end note
```

Chèn vào LaTeX:

```tex
\begin{figure}[H]
\centering
\includegraphics[width=0.9\textwidth]{document-lifecycle-state.png}
\caption{State machine vòng đời tài liệu trong DocVault}
\label{fig:document-lifecycle-state}
\end{figure}
```

Gợi ý: hình này nên thay cho block `lstlisting` hiện tại trong section `Document lifecycle`.

## 4. Sequence diagram download authorization

Lưu thành:

```text
docs/diagrams/web/04-download-authorization-sequence.mmd
```

Render:

```powershell
pnpm dlx @mermaid-js/mermaid-cli -i docs/diagrams/web/04-download-authorization-sequence.mmd -o docs/images/web/download-authorization-sequence.png -t neutral -b white -s 2
```

Mermaid:

```mermaid
%%{init: {"theme": "neutral", "sequence": {"mirrorActors": false}}}%%
sequenceDiagram
  autonumber
  actor User as User
  participant Web as Next.js Web
  participant Gateway as API Gateway
  participant Metadata as metadata-service
  participant Document as document-service
  participant Audit as audit-service
  participant Storage as MinIO/S3

  User->>Web: Click Download on Document Detail
  Web->>Gateway: POST /metadata/documents/:id/download-authorize
  Gateway->>Metadata: Forward JWT + actor context
  Metadata->>Metadata: Check status, role, owner, ACL, classification, version

  alt Denied by policy
    Metadata-->>Gateway: 403 + deny reason
    Metadata-->>Audit: Record DENY event
    Gateway-->>Web: Error response
    Web-->>User: Show disabled/denied reason
  else Allowed
    Metadata-->>Gateway: grantToken + version + filename
    Gateway-->>Web: Authorization result
    Web->>Gateway: POST /documents/:id/presign-download with grantToken
    Gateway->>Document: Forward grantToken
    Document->>Metadata: Verify grant or re-authorize if needed
    Metadata-->>Document: Grant valid
    Document-->>Gateway: Version/download posture
    Gateway-->>Web: Stream posture + filename
    Web->>Gateway: GET /documents/:id/versions/:v/stream?token=grantToken
    Gateway->>Document: Stream request
    Document->>Storage: Read object by objectKey
    Storage-->>Document: File bytes
    Document-->>Gateway: Controlled stream
    Gateway-->>Web: Blob response
    Document-->>Audit: Record authorized content access
    Web-->>User: Browser download starts
  end

  Note over Web,Document: Frontend always downloads through gateway stream so internal MinIO URLs are not exposed to the browser.
  Note over Metadata: Compliance Officer is always denied file content access.
```

Chèn vào LaTeX:

```tex
\begin{figure}[H]
\centering
\includegraphics[width=\textwidth]{download-authorization-sequence.png}
\caption{Luồng cấp quyền và tải file qua grant token}
\label{fig:download-authorization-sequence}
\end{figure}
```

Gợi ý: hình này nên thay cho block `lstlisting` trong section `Thiết kế preview/download authorization`.

## 5. Luồng compliance evidence của web

Lưu thành:

```text
docs/diagrams/web/05-compliance-evidence-flow.mmd
```

Render:

```powershell
pnpm dlx @mermaid-js/mermaid-cli -i docs/diagrams/web/05-compliance-evidence-flow.mmd -o docs/images/web/compliance-evidence-flow.png -t neutral -b white -s 2
```

Mermaid:

```mermaid
%%{init: {"theme": "neutral", "flowchart": {"curve": "basis", "htmlLabels": true}}}%%
flowchart TB
  subgraph Signals["Runtime signals"]
    WorkflowEvents["Workflow events<br/>submit, approve, reject, archive"]
    AccessEvents["Access events<br/>preview/download allow/deny"]
    UploadEvents["Upload controls<br/>malware blocked, DLP detected"]
    RetentionEvents["Retention records<br/>due soon, overdue, archived"]
    AclEvents["ACL/access review signals<br/>broad grants, stale permissions"]
  end

  Audit["audit-service<br/>append-only events + hash-chain"]
  Security["Security page<br/>posture, policy denies, DLP, malware, risk scoring, anomalies"]
  Recommendations["Security recommendations<br/>OPEN -> INVESTIGATING -> REVIEWED -> RESOLVED"]
  AuditPage["Audit page<br/>filters, verify-chain, drill-down"]
  RetentionPage["Retention page<br/>records lifecycle evidence"]
  AccessReview["Access Review<br/>permission recertification"]
  Evidence["Evidence Center<br/>builder + presentation"]
  StepUp["Step-up proof<br/>for sensitive export/run actions"]
  Output["Evidence output<br/>manifest JSON, bundle JSON, report HTML, document packets"]

  WorkflowEvents --> Audit
  AccessEvents --> Audit
  UploadEvents --> Audit
  RetentionEvents --> Audit
  AclEvents --> Audit

  Audit --> AuditPage
  Audit --> Security
  Security --> Recommendations
  Recommendations --> Evidence
  AuditPage --> Evidence
  RetentionPage --> Evidence
  AccessReview --> Evidence
  Evidence --> StepUp
  StepUp --> Output

  Output -. excludes .-> Sensitive["Không đưa vào evidence:<br/>file content, object key, presigned URL, grant token"]
```

Chèn vào LaTeX:

```tex
\begin{figure}[H]
\centering
\includegraphics[width=\textwidth]{compliance-evidence-flow.png}
\caption{Luồng tổng hợp bằng chứng tuân thủ trong web runtime}
\label{fig:compliance-evidence-flow}
\end{figure}
```

## 6. Sequence diagram SSO và session frontend

Sơ đồ này là bổ sung. Nên dùng nếu muốn giải thích vì sao frontend có thể lấy role, lọc menu và gắn Bearer token cho API.

Lưu thành:

```text
docs/diagrams/web/06-sso-session-sequence.mmd
```

Render:

```powershell
pnpm dlx @mermaid-js/mermaid-cli -i docs/diagrams/web/06-sso-session-sequence.mmd -o docs/images/web/sso-session-sequence.png -t neutral -b white -s 2
```

Mermaid:

```mermaid
%%{init: {"theme": "neutral", "sequence": {"mirrorActors": false}}}%%
sequenceDiagram
  autonumber
  actor User as User
  participant Web as Next.js Web
  participant Login as /api/auth/login
  participant Keycloak as Keycloak
  participant Callback as /api/auth/callback
  participant Me as /api/auth/me
  participant AuthProvider as AuthProvider
  participant ApiClient as Axios apiClient

  User->>Web: Open /login
  User->>Login: Sign in with SSO
  Login-->>User: Redirect to Keycloak auth URL + kc_state cookie
  User->>Keycloak: Authenticate
  Keycloak-->>Callback: Redirect with code + state
  Callback->>Callback: Validate state
  Callback->>Keycloak: Exchange code for tokens
  Keycloak-->>Callback: access_token, refresh_token, id_token
  Callback-->>User: Set auth cookies and redirect /login?auth=ok
  Web->>Me: Fetch active cookie session
  Me-->>Web: accessToken + user roles
  Web->>AuthProvider: Save session to localStorage/context
  AuthProvider->>Web: Filter routes, sidebar, command palette
  ApiClient->>ApiClient: Add Authorization: Bearer accessToken
```

Chèn vào LaTeX:

```tex
\begin{figure}[H]
\centering
\includegraphics[width=\textwidth]{sso-session-sequence.png}
\caption{Luồng SSO Keycloak và khởi tạo session frontend}
\label{fig:sso-session-sequence}
\end{figure}
```

## 7. Sơ đồ cấu trúc Document Detail

Sơ đồ này là bổ sung nhưng rất đáng có vì trang `/documents/[id]` là màn hình trung tâm của phần web.

Lưu thành:

```text
docs/diagrams/web/07-document-detail-composition.mmd
```

Render:

```powershell
pnpm dlx @mermaid-js/mermaid-cli -i docs/diagrams/web/07-document-detail-composition.mmd -o docs/images/web/document-detail-composition.png -t neutral -b white -s 2
```

Mermaid:

```mermaid
%%{init: {"theme": "neutral", "flowchart": {"curve": "basis", "htmlLabels": true}}}%%
flowchart TB
  Detail["Document Detail<br/>/documents/:id"]

  subgraph MetadataZone["Metadata and readiness"]
    Header["Document header<br/>title, status, classification, owner"]
    Summary["Metadata summary<br/>tags, current version, retention"]
    Readiness["Approval readiness<br/>missing metadata, DLP, retention signals"]
    Dlp["DLP findings"]
    Guardrails["AI guardrails<br/>metadata-only policy hints"]
  end

  subgraph FileZone["File and version controls"]
    Versions["Version history<br/>checksum, size, MIME, uploader"]
    Preview["Preview latest/version"]
    Download["Download latest/version"]
    Diff["Version diff"]
    Restore["Restore version"]
  end

  subgraph WorkflowZone["Workflow and collaboration"]
    Actions["Action panel<br/>submit, approve, reject, archive, delete, upload"]
    Timeline["Workflow timeline"]
    ApprovalChain["Approval chain"]
    Comments["Comments"]
    Activity["Activity feed"]
  end

  subgraph SecurityZone["Security and compliance"]
    Acl["Access Control<br/>USER, ROLE, GROUP, ALL; ALLOW/DENY"]
    Share["Share links<br/>create/revoke, expiry, permission"]
    LegalHold["Legal hold"]
    EvidenceLinks["Evidence links<br/>audit, security, retention, evidence packet"]
    ExportEvidence["Export evidence packet<br/>step-up proof"]
  end

  Detail --> MetadataZone
  Detail --> FileZone
  Detail --> WorkflowZone
  Detail --> SecurityZone

  Download --> Policy["Frontend permission helper<br/>backend remains source of truth"]
  Preview --> Policy
  Acl --> Policy
  ExportEvidence --> Policy
```

Chèn vào LaTeX:

```tex
\begin{figure}[H]
\centering
\includegraphics[width=\textwidth]{document-detail-composition.png}
\caption{Các khối nghiệp vụ trong màn hình chi tiết tài liệu}
\label{fig:document-detail-composition}
\end{figure}
```

## Gợi ý chèn vào các chương

### Chương 3 - Phân tích yêu cầu và thiết kế tổng thể

Nên thêm:

- `web-role-screen-map.png` sau bảng tác nhân chính.

Lý do: chương này đang nói về actor và yêu cầu chức năng, nên sơ đồ role-to-screen giúp nối actor với giao diện.

### Chương 4 - Thiết kế dữ liệu, API và chính sách bảo mật

Nên thay hai block `lstlisting` bằng hình:

- `document-lifecycle-state.png`
- `download-authorization-sequence.png`

Lý do: hai nội dung này là state machine và sequence, thể hiện bằng sơ đồ sẽ rõ hơn text.

### Chương 5 - Triển khai ứng dụng DocVault

Nên thêm:

- `web-runtime-architecture.png` sau đoạn giới thiệu frontend Next.js.
- `sso-session-sequence.png` nếu muốn làm rõ đăng nhập SSO.
- `document-detail-composition.png` sau đoạn mô tả Document Detail.
- `compliance-evidence-flow.png` sau phần Audit/Security/Evidence/Retention hoặc trước phần screenshot.

Lý do: chương này hiện có screenshot, nhưng thiếu sơ đồ giải thích web app vận hành như một runtime có policy, workflow và evidence.

### Chương 7 - Kiểm thử, đánh giá và bằng chứng

Có thể dùng lại:

- `compliance-evidence-flow.png`

Lý do: nếu chương 7 nhấn mạnh evidence, sơ đồ này giải thích nguồn evidence từ runtime trước khi trình bày ảnh/bảng kiểm thử.

## Lưu ý chất lượng hình

- Ưu tiên PNG nền trắng để in báo cáo dễ đọc.
- Nếu hình quá nhỏ trong PDF, render lại với `-s 3` hoặc tăng width/height:

```powershell
pnpm dlx @mermaid-js/mermaid-cli -i docs/diagrams/web/04-download-authorization-sequence.mmd -o docs/images/web/download-authorization-sequence.png -t neutral -b white -s 3
```

- Không nên chèn Mermaid source trực tiếp vào LaTeX hiện tại, vì report đang dùng `graphicx`, không cấu hình package render Mermaid.
- Đặt `\label{...}` ngay sau `\caption{...}` để reference đúng.
- Caption nên mô tả ý nghĩa nghiệp vụ, không chỉ ghi tên kỹ thuật.
- Nếu một sơ đồ quá rộng, dùng:

```tex
\includegraphics[width=\textwidth]{ten-hinh.png}
```

- Nếu sơ đồ state machine nhỏ hơn, dùng:

```tex
\includegraphics[width=0.85\textwidth]{ten-hinh.png}
```

## Thứ tự nên làm

Nếu thời gian hạn chế, làm trước 4 hình này:

1. `web-runtime-architecture.png`
2. `document-lifecycle-state.png`
3. `download-authorization-sequence.png`
4. `compliance-evidence-flow.png`

Sau đó bổ sung `web-role-screen-map.png`, `sso-session-sequence.png`, và `document-detail-composition.png` nếu báo cáo còn chỗ.
