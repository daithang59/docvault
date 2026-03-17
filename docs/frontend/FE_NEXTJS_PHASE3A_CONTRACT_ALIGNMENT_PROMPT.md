# FE Next.js — Phase 3A Prompt
## Mục tiêu: Contract Alignment + Backend Integration Hardening

Bạn là AI Agent đang làm việc trên codebase FE Next.js của dự án **DocVault**.  
Nhiệm vụ của bạn trong **Phase 3A** KHÔNG phải là hoàn thiện toàn bộ business logic UI, mà là:

1. **Rà soát và sửa toàn bộ mismatch giữa FE hiện tại và backend contract**
2. **Kết nối FE với backend/gateway thật**
3. **Chuẩn hóa DTO / endpoint / error handling / auth assumptions**
4. **Chạy smoke test integration cho các flow chính**
5. **Chỉ sửa những gì cần để FE sẵn sàng bước sang Phase 3B**

---

# 1. Bối cảnh dự án

DocVault là hệ thống web quản lý tài liệu bảo mật theo mô hình microservices.  
Frontend dùng **Next.js App Router + TypeScript + Tailwind + TanStack Query + Axios**.

Backend hiện có các domain chính:
- **metadata-service**
- **document-service**
- **workflow-service**
- **audit-service**
- **gateway**
- auth theo **Keycloak/JWT-compatible role claims**

Các role nghiệp vụ:
- `viewer`
- `editor`
- `approver`
- `compliance_officer`
- `admin` (dev/local convenience)

Workflow hiện tại:
- `DRAFT -> PENDING -> PUBLISHED -> ARCHIVED`
- reject: `PENDING -> DRAFT`

---

# 2. Phạm vi Phase 3A

## BẮT BUỘC làm
- Soát toàn bộ API endpoints FE đang gọi
- Đối chiếu với backend contract cuối cùng
- Chuẩn hóa request/response DTO
- Chuẩn hóa error mapping
- Chuẩn hóa auth/session/token assumption
- Kiểm tra query key và mutation invalidation
- Nối backend thật cho các flow quan trọng
- Chạy smoke test integration
- Xuất báo cáo mismatch đã sửa và blocker còn lại

## KHÔNG làm trong phase này
- Không polish UI quá sâu
- Không redesign component lớn
- Không thêm feature ngoài contract
- Không làm animation/visual enhancement không cần thiết
- Không mở rộng scope sang DevSecOps, test automation full suite, e2e phức tạp
- Không “đoán” contract nếu có thể suy ra từ code backend hiện có

---

# 3. Mục tiêu đầu ra

Sau khi hoàn thành Phase 3A, codebase FE phải đạt trạng thái:

- build được
- lint được
- route chính render được
- các flow chính gọi đúng endpoint thật
- DTO dùng nhất quán
- auth/token handling không tự mâu thuẫn
- loading/error/empty state cơ bản hoạt động
- có report rõ ràng: cái gì đã verified, cái gì còn blocked

---

# 4. Việc cần làm chi tiết

## 4.1. Tạo bảng đối chiếu contract
Tạo một tài liệu markdown trong repo, ví dụ:

`docs/phase3a-contract-alignment-report.md`

Bảng phải có các cột:
- FE module / function
- current FE endpoint
- expected backend contract endpoint
- request shape
- response shape
- auth requirement
- status: `match` / `fixed` / `blocked`
- note

Rà ít nhất các flow sau:
1. session / current user
2. document list
3. document detail
4. create document metadata
5. upload document version
6. submit document
7. approve document
8. reject document
9. archive document
10. workflow history
11. document ACL read/update
12. audit query
13. download authorize
14. presign download / stream download

---

## 4.2. Chuẩn hóa endpoint map
Tạo hoặc sửa một file trung tâm, ví dụ:
- `src/lib/api/endpoints.ts`

Mục tiêu:
- toàn bộ endpoint path nằm ở một chỗ
- không hardcode path rải rác trong service/hooks/components
- naming thống nhất
- prefix rõ ràng

Ví dụ kiểu tổ chức:
- `metadata.documents.list`
- `metadata.documents.detail(docId)`
- `metadata.documents.create`
- `metadata.documents.workflowHistory(docId)`
- `metadata.documents.downloadAuthorize(docId)`
- `metadata.documents.acl(docId)`
- `documents.upload(docId)`
- `documents.presignDownload(docId)`
- `workflow.submit(docId)`
- `workflow.approve(docId)`
- `workflow.reject(docId)`
- `workflow.archive(docId)`
- `audit.query`

Nếu endpoint thật khác structure này thì sửa theo contract/backend thật, nhưng vẫn giữ cách tổ chức tập trung.

---

## 4.3. Chuẩn hóa DTO types
Rà soát toàn bộ type/interface hiện có.

Mục tiêu:
- xác định **canonical DTO** theo backend thật
- xóa bớt alias không cần thiết
- chỉ giữ adapter khi thật sự bắt buộc để tương thích tạm thời

Ưu tiên chuẩn hóa:
- `DocumentSummaryDto`
- `DocumentDetailDto`
- `CreateDocumentRequest`
- `UploadVersionRequest/Response`
- `SubmitDocumentRequest`
- `ApproveDocumentRequest`
- `RejectDocumentRequest`
- `ArchiveDocumentRequest`
- `WorkflowHistoryItemDto`
- `DocumentAclEntryDto`
- `AuditLogItemDto`
- `PaginatedResponse<T>`
- `ApiErrorResponse`
- `CurrentUserDto`

Nếu backend đang trả field khác với FE hiện dùng, sửa FE để bám field thật.  
Chỉ dùng adapter mapping nếu cần để giảm ảnh hưởng lan rộng.

---

## 4.4. Chuẩn hóa paginated response
Kiểm tra tất cả endpoint list có cùng envelope hay không:
- raw array?
- `{ data: T[] }`?
- `{ data: T[], meta: ... }`?
- `{ items: T[], total: number, page: number, pageSize: number }`?

Mục tiêu:
- tạo utility parse nhất quán
- tránh page này dùng `docs.data`, page khác dùng `docs.items`, page khác nữa dùng raw array
- service layer phải normalize shape trước khi lên hook/UI

Nếu cần, tạo helper:
- `normalizePaginatedResponse`
- `normalizeListResponse`

---

## 4.5. Auth / token / role alignment
Rà session/auth hiện có và chốt các assumption sau:

1. token lấy từ đâu:
- localStorage?
- cookie?
- memory state?

2. JWT claims chứa role ở đâu:
- realm_access.roles?
- resource_access?
- custom claim?

3. user identity dùng field nào:
- `sub`
- `preferred_username`
- `email`
- `name`

4. 401 / 403 handling:
- 401 -> clear session + redirect login?
- 403 -> giữ nguyên page + toast / forbidden state?

5. có refresh token không?
- nếu chưa có thì document rõ là chưa implement

Mục tiêu:
- có một nơi parse token/user
- có một nơi check permission
- không duplicated logic ở page/component/service

Nếu backend thật chưa có endpoint `/me`, có thể derive current user từ token, nhưng phải document rõ.

---

## 4.6. Error handling normalization
Tạo hoặc chỉnh một tầng chuẩn hóa lỗi API.

Mục tiêu:
- mọi mutation/query quan trọng đều map lỗi nhất quán
- UI không hiện message kỹ thuật thô một cách bừa bãi
- xử lý được các nhóm lỗi:
  - validation
  - unauthorized
  - forbidden
  - not found
  - conflict
  - server error
  - network error

Cần có helper kiểu:
- `parseApiError`
- `getUserFriendlyErrorMessage`
- `isForbiddenError`
- `isUnauthorizedError`

Toast/message nên thân thiện nhưng không làm mất ngữ nghĩa lỗi.

Ví dụ:
- “Bạn không có quyền tải tài liệu này.”
- “Tài liệu chưa ở trạng thái cho phép tải xuống.”
- “Phiên đăng nhập đã hết hạn.”
- “Không thể kết nối máy chủ.”

---

## 4.7. Query key + invalidation review
Rà toàn bộ TanStack Query keys và mutation invalidation.

Đảm bảo sau các action sau UI tự cập nhật đúng:
- create document
- upload version
- submit
- approve
- reject
- archive
- update ACL

Ít nhất phải invalidation đúng:
- documents list
- document detail
- workflow history
- acl
- approvals list
- audit list (nếu cần)
- dashboard counters (nếu có)

Tạo file query key tập trung nếu chưa có, ví dụ:
- `documentKeys`
- `workflowKeys`
- `auditKeys`
- `authKeys`

---

## 4.8. Nối backend thật cho các flow chính
Bắt buộc verify trực tiếp các flow sau ở mức FE integration:

### A. Document List
- load list thành công
- filter/query params nếu có hoạt động
- loading/empty/error state ổn

### B. Document Detail
- load chi tiết thành công
- hiển thị status/classification/version
- hiển thị action theo role/status

### C. Create Metadata
- editor tạo metadata thành công
- redirect hoặc refresh list đúng

### D. Upload Version
- upload file cho document thành công
- trạng thái/version hiển thị lại đúng
- xử lý trường hợp file lỗi/oversize nếu backend trả

### E. Submit
- editor submit từ `DRAFT -> PENDING`
- UI cập nhật ngay hoặc sau refetch

### F. Approve / Reject
- approver approve `PENDING -> PUBLISHED`
- approver reject `PENDING -> DRAFT`
- lý do/comment nếu contract yêu cầu thì gửi đúng field

### G. Workflow History
- history load đúng theo tài liệu
- hiển thị timeline/table cơ bản

### H. ACL Read / Update
- đọc được ACL
- nếu feature update ACL đã trong scope hiện tại thì save được và UI refresh đúng
- nếu backend chưa sẵn sàng thì mark blocked

### I. Audit Query
- compliance officer query được audit logs
- filter cơ bản hoạt động nếu backend support

### J. Download Flow
Verify đúng 2 bước:
1. authorize download để lấy grant token
2. dùng grant token để presign/stream download

Kiểm tra cả trường hợp:
- viewer được download khi tài liệu hợp lệ
- compliance_officer bị từ chối
- document chưa published bị từ chối (nếu policy backend áp dụng)

---

# 5. Quy tắc triển khai trong code

## 5.1. Không hardcode role/status logic rải rác
Tạo helper trung tâm, ví dụ:
- `canViewDocument`
- `canEditDocument`
- `canSubmitDocument`
- `canApproveDocument`
- `canRejectDocument`
- `canArchiveDocument`
- `canDownloadDocument`
- `canManageAcl`

Page/component chỉ gọi helper, không tự viết điều kiện dài lặp lại.

---

## 5.2. Service layer phải là nơi absorb mismatch
Nếu backend trả shape không đẹp hoặc không nhất quán, ưu tiên normalize tại:
- api service
- adapter / mapper
- transform function

Tránh để component phải biết raw backend quirks.

---

## 5.3. Form validation
Nếu chưa có validation đủ tốt, thêm validation mức cơ bản cho:
- create document
- reject reason/comment
- audit filter
- ACL form nếu có

Không cần làm UI quá đẹp, nhưng phải ngăn submit payload sai rõ ràng.

---

## 5.4. Không phá scaffold phase 2
Giữ nguyên tinh thần architecture phase 2:
- `features/*`
- `lib/api/*`
- `providers/*`
- `components/*`
- `hooks/*`

Chỉ refactor khi nó giúp contract alignment rõ rệt hơn.

---

# 6. Các file dự kiến nên tạo hoặc sửa

Tùy codebase thực tế, nhưng ưu tiên có:

- `docs/phase3a-contract-alignment-report.md`
- `src/lib/api/endpoints.ts`
- `src/lib/api/http.ts`
- `src/lib/api/errors.ts`
- `src/lib/auth/session.ts`
- `src/lib/auth/token.ts`
- `src/lib/permissions/*`
- `src/lib/types/api.ts`
- `src/features/documents/api/*`
- `src/features/workflow/api/*`
- `src/features/audit/api/*`
- `src/features/auth/api/*`
- `src/lib/queryKeys.ts` hoặc files tương đương

Nếu codebase đang dùng alias/path khác thì giữ cấu trúc phù hợp repo hiện tại, nhưng vẫn phải đạt các mục tiêu trên.

---

# 7. Smoke test checklist bắt buộc
Sau khi sửa xong, tự chạy và ghi lại kết quả:

- install dependencies thành công
- typecheck pass
- lint pass
- build pass
- dev server chạy
- truy cập được các route chính
- login/session hoạt động theo cách hiện tại của project
- list documents gọi đúng backend
- detail gọi đúng backend
- submit/approve/reject ít nhất đã verify request path + payload + response handling
- audit query verify
- download flow verify

Nếu phần nào không verify được vì backend chưa chạy hoặc contract thiếu, ghi rõ:
- endpoint nào
- thiếu gì
- FE hiện đã chuẩn bị đến mức nào
- cần backend/gateway sửa gì

---

# 8. Kết quả đầu ra mong muốn từ bạn
Khi hoàn tất, hãy trả về:

## A. Tóm tắt thay đổi
- đã sửa endpoint nào
- đã sửa DTO nào
- đã sửa auth/error/query layer nào

## B. Contract alignment report
- link/tên file report
- các mismatch chính đã fix
- các mismatch còn blocked

## C. Verification results
- build/lint/typecheck
- smoke test flow nào pass
- flow nào chưa pass và vì sao

## D. Risk còn lại trước Phase 3B
Nêu rõ những gì còn có thể gây lỗi nếu bước sang full business logic:
- archive gateway chưa map?
- audit filter chưa đúng shape?
- ACL update chưa có contract?
- token refresh chưa có?

---

# 9. Tiêu chí hoàn thành (Definition of Done)

Phase 3A chỉ được xem là xong khi:
- endpoint FE đã được rà và chuẩn hóa
- DTO chính đã được chuẩn hóa hoặc adapter hóa rõ ràng
- auth/token assumptions được document
- error handling đã nhất quán hơn
- query invalidation chính đã đúng
- các flow trọng yếu đã smoke test được ở mức hợp lý
- có report markdown mô tả rõ match/fixed/blocked
- code vẫn build/lint/typecheck pass

---

# 10. Ràng buộc quan trọng

- Không tự bịa endpoint
- Không đổi contract backend tùy tiện
- Không mở rộng scope Phase 3A sang Phase 3B
- Nếu gặp mismatch giữa tài liệu và backend code thật, ưu tiên backend code thật và ghi rõ vào report
- Nếu một flow chưa verify được hoàn toàn, không nói chung chung là “done”; phải ghi rõ mức độ verified

---

# 11. Thứ tự thực hiện đề xuất

1. scan code FE hiện tại
2. lập bảng contract alignment
3. chuẩn hóa endpoint map
4. chuẩn hóa DTO + adapters
5. chuẩn hóa auth/session/errors
6. fix query hooks/mutations/invalidation
7. verify từng flow chính với backend
8. xuất report
9. commit thay đổi gọn, rõ, không lan scope

---

Hãy bắt đầu thực hiện Phase 3A theo đúng các yêu cầu trên. Ưu tiên tính chính xác contract và khả năng integration thực tế hơn là UI polish.
